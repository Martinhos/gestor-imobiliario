/* ================= CONTINUIDADE =================
   Fazer com que uma repintura pareça um movimento, e não uma troca.

   A app repinta trocando HTML: o nó antigo é destruído no mesmo frame em que
   o novo nasce. É por isso que confirmar um planeado fazia o cartão
   DESAPARECER — não sobrava nó nenhum para desvanecer — e que o resto da
   lista não subia: também não subiu, são nós novos que nasceram mais acima.
   Nada se moveu, por isso nada podia deslizar.

   A técnica é a que os browsers chamam FLIP: mede-se onde cada peça está
   ANTES, repinta-se, mede-se onde ficou, põe-se cada uma de volta no sítio
   antigo com um transform e deixa-se ir. O layout acontece de uma vez, como
   sempre; o que se anima é a DIFERENÇA, que é só transform e opacity — as
   duas coisas que o browser mexe sem voltar a pedir contas ao layout. Uma
   lista de quinhentas linhas custa uma medição por linha, não uma animação de
   altura por linha.

   Quem sai não é clonado. Um nó que a repintura deita fora do documento
   continua a existir enquanto alguém lhe guardar a referência — e é esse
   mesmo, com o conteúdo que a pessoa estava a ver, que se volta a pôr por
   cima a desvanecer. Sai mais barato do que clonar e não pode divergir.

   As peças que participam trazem data-fk com uma chave estável (o id do
   registo). Sem chave, uma peça é só «mais uma»: não há como saber se a
   terceira linha de agora é a terceira de antes ou outra que lhe tomou o
   lugar. */

/* Quem pediu menos movimento ao sistema não recebe nenhum.

   A regra de CSS que anula animações e transições NÃO apanha isto: estas
   animações são feitas pela API do JavaScript, que o @media não vê. Tem de se
   perguntar à mão, e é a primeira coisa que cada função aqui faz.
   Devolve: verdadeiro se o sistema pediu menos movimento. */
function semMovimento(){
  try{return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)}
  catch(e){return false}
}

/* Lê um token do :root, para o JavaScript andar ao mesmo tempo que o CSS em
   vez de ter números próprios a envelhecer noutro sítio.
   Recebe: nome — o token (ex.: '--medio'); porOmissao — o texto a devolver se
   o token não existir (numa vm de testes, por exemplo).
   Devolve: o valor do token, em texto, ou porOmissao. */
function tokenTexto(nome,porOmissao){
  try{const v=getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v||porOmissao}catch(e){return porOmissao}
}

/* O mesmo, para durações, já convertido em milissegundos.
   Recebe: nome — o token (ex.: '--lento'); porOmissao — ms se não existir.
   Devolve: a duração em milissegundos (número). */
function msDoToken(nome,porOmissao){
  const v=tokenTexto(nome,'');
  if(/ms$/.test(v))return parseFloat(v)||porOmissao;
  if(/s$/.test(v))return (parseFloat(v)||0)*1000||porOmissao;
  return porOmissao;
}

/* A camada onde ficam, por um instante, os nós que a repintura deitou fora.

   Fixa e surda ao toque. O z-index é 19 de propósito: por baixo do cabeçalho
   pegajoso (20) e da barra de filtros (25), para um nó a sair não passar por
   cima deles, e acima do conteúdo da vista, para não ser tapado pelas linhas
   que estão a subir para o lugar dele.
   Devolve: o elemento da camada, criando-o na primeira vez. */
function camadaDeSaida(){
  let c=document.getElementById('saidas');
  if(!c){
    c=document.createElement('div');c.id='saidas';
    c.style.cssText='position:fixed;inset:0;z-index:19;pointer-events:none;overflow:hidden';
    document.body.appendChild(c);
  }
  return c;
}

/* Põe um nó já deitado fora de volta no ecrã, no sítio exato onde estava, e
   deixa-o desvanecer.
   Recebe: a — {el,x,y,w}: o nó e o retângulo que ocupava (coordenadas do ecrã).
   Devolve: nada — mete o nó na camada de saída e remove-o no fim. */
function sairDoEcra(a){
  const e=a.el,dur=msDoToken('--medio',200);
  e.style.position='fixed';e.style.left=a.x+'px';e.style.top=a.y+'px';
  e.style.width=a.w+'px';e.style.margin='0';e.style.pointerEvents='none';
  camadaDeSaida().appendChild(e);
  const an=e.animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.97)'}],
    {duration:dur,easing:tokenTexto('--curva-sai','cubic-bezier(.4,0,1,1)'),fill:'forwards'});
  const fora=()=>{try{e.remove()}catch(x){}};
  an.onfinish=fora;
  /* rede: num separador escondido a animação não corre e o onfinish nunca
     chega — o nó ficava para sempre por cima do ecrã */
  setTimeout(fora,dur+600);
}

/* Repinta, e faz o que mudou parecer que se moveu.

   Chama `pintar` uma vez, tal e qual. À volta disso: mede as peças com data-fk
   antes e depois, desliza as que mudaram de sítio, faz entrar as que chegaram
   e desvanecer as que saíram. Se o sistema pediu menos movimento, ou se não há
   onde medir, limita-se a chamar `pintar`.

   Recebe: pintar — a função que repinta; o (opcional) — {raiz} é uma função
   que devolve o elemento onde procurar as peças (por omissão o #view), e é
   chamada ANTES e DEPOIS de pintar, porque a repintura pode ter substituído o
   próprio elemento.
   Devolve: o que a função pintar devolver. */
function pintarComContinuidade(pintar,o){
  o=o||{};
  const obter=o.raiz||function(){return document.getElementById('view')};
  const r0=obter();
  if(semMovimento()||!r0||!r0.animate||!r0.querySelectorAll)return pintar();
  const dur=msDoToken('--medio',200),curva=tokenTexto('--curva-entra','cubic-bezier(0,0,.2,1)');
  const antes={};
  [].slice.call(r0.querySelectorAll('[data-fk]')).forEach(function(e){
    const r=e.getBoundingClientRect();
    if(r.width||r.height)antes[e.getAttribute('data-fk')]={el:e,x:r.left,y:r.top,w:r.width};
  });
  const res=pintar();
  const r1=obter();
  if(!r1||!r1.querySelectorAll)return res;
  const vistos={};
  [].slice.call(r1.querySelectorAll('[data-fk]')).forEach(function(e){
    const k=e.getAttribute('data-fk');vistos[k]=1;
    const a=antes[k],r=e.getBoundingClientRect();
    if(!r.width&&!r.height)return;
    if(!a){e.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'none'}],
      {duration:dur,easing:curva});return}
    const dx=a.x-r.left,dy=a.y-r.top;
    /* menos de um pixel não é um movimento, é ruído de arredondamento — e uma
       animação por linha que não sai do sítio custa o mesmo que uma que sai */
    if(Math.abs(dx)<1&&Math.abs(dy)<1)return;
    e.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],
      {duration:dur,easing:curva});
  });
  Object.keys(antes).forEach(function(k){if(!vistos[k])sairDoEcra(antes[k])});
  return res;
}

/* Troca o que está num sítio fazendo o que sai e o que entra deslizarem para
   o mesmo lado — o gesto de virar uma página.

   Serve onde não há peças a acompanhar de um lado para o outro, mas há uma
   direção: o mês seguinte do calendário, entrar numa categoria do gráfico. O
   deslocamento é uma fração da largura e não a largura toda, para não precisar
   de recorte: com o desvanecer, lê-se como uma página a virar sem que nada
   ande a voar pelo ecrã.

   Recebe: obter — função que devolve o elemento (chamada antes e depois de
   pintar); pintar — a função que repinta; dir — +1 para a frente (o novo entra
   pela direita), -1 para trás, 0 só desvanece.
   Devolve: o que a função pintar devolver. */
function deslizarEntre(obter,pintar,dir){
  const a=obter();
  if(semMovimento()||!a||!a.animate)return pintar();
  const r=a.getBoundingClientRect();
  const dur=msDoToken('--lento',340),curva=tokenTexto('--curva-entra','cubic-bezier(0,0,.2,1)');
  const salto=Math.round(Math.min(r.width*.18,90))*(dir||0);
  const res=pintar();
  const b=obter();
  /* o nó antigo saiu do documento com a repintura, mas continua vivo aqui: é
     ele que se põe de volta, no sítio onde estava, a sair */
  if(r.width&&!a.isConnected){
    a.style.position='fixed';a.style.left=r.left+'px';a.style.top=r.top+'px';
    a.style.width=r.width+'px';a.style.margin='0';a.style.pointerEvents='none';
    camadaDeSaida().appendChild(a);
    const sai=a.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateX('+(-salto)+'px)'}],
      {duration:dur,easing:tokenTexto('--curva-sai','cubic-bezier(.4,0,1,1)'),fill:'forwards'});
    const fora=function(){try{a.remove()}catch(x){}};
    sai.onfinish=fora;setTimeout(fora,dur+600);
  }
  if(b&&b.animate)b.animate([{opacity:0,transform:'translateX('+salto+'px)'},{opacity:1,transform:'none'}],
    {duration:dur,easing:curva});
  return res;
}
