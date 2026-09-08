/* ================= LISTA VIVA =================
   Repintar uma lista mexendo só no que mudou.

   A app pinta trocando o innerHTML: a vista inteira é gerada em texto e o
   browser volta a construir tudo. Medido com 500 movimentos, uma pintura são
   6 097 nós e 36 ms, e a maior parte disso é o browser a ler HTML que descreve
   linhas que já lá estavam, iguais. Escrever uma letra na pesquisa pagava esse
   preço por tecla.

   A ideia aqui é banal e é a única que resolve isto sem reescrever a app: cada
   peça traz uma CHAVE (o id do registo), guarda-se o HTML com que foi feita, e
   na pintura seguinte compara-se texto com texto. Igual, não se toca — o nó
   fica onde está, com o scroll, o foco e as marcas de seleção que tinha.
   Diferente, refaz-se só essa. Nova, cria-se. Desaparecida, remove-se. A ordem
   acerta-se com insertBefore, que é mover e não recriar.

   Comparar o HTML em vez de comparar os dados é de propósito. Uma linha de
   movimento não depende só do movimento: depende do nome do imóvel, do
   contrato, do dono que pagou, do modo de seleção, do cargo de quem está a
   ver. Uma assinatura feita à mão sobre os dados esquecer-se-ia de um desses
   e a linha ficava desatualizada sem ninguém perceber porquê. O HTML é a
   assinatura que não se esquece de nada: se o que se ia desenhar é igual ao
   que está, é porque nada do que importa mudou. E gerar o texto é a parte
   barata — medida em 3 ms para as 500 linhas todas. O que custa é o browser
   lê-lo. */

/* onde fica guardado o HTML com que cada peça foi feita, por contentor: no
   próprio elemento, para morrer com ele em vez de crescer para sempre */
const CHAVE_CACHE='_htmlPorChave';

/* Constrói um elemento a partir do HTML de uma peça.
   Recebe: html — o HTML de UMA peça (o primeiro elemento é o que conta);
   chave — a chave a marcar no elemento, para a próxima pintura o reencontrar.
   Devolve: o elemento, ou null se o HTML não tinha nenhum. */
function pecaDe(html,chave){
  const molde=document.createElement('div');
  molde.innerHTML=html;
  const n=molde.firstElementChild;
  if(n)n.setAttribute('data-chave',chave);
  return n;
}

/* Põe o conteúdo de um contentor igual à lista pedida, mexendo o menos
   possível.

   Recebe: alvo — o elemento que contém a lista; itens — array de
   {chave,html} pela ordem em que devem ficar (chaves repetidas: fica a
   primeira, porque duas peças com a mesma chave não têm como ser
   distinguidas).
   Devolve: {mantidas,refeitas,criadas,movidas,removidas} — o que aconteceu, em
   número, para quem quiser medir se isto está mesmo a poupar trabalho. */
function reconciliar(alvo,itens){
  const conta={mantidas:0,refeitas:0,criadas:0,movidas:0,removidas:0};
  if(!alvo)return conta;
  const cache=alvo[CHAVE_CACHE]||(alvo[CHAVE_CACHE]={});
  const antigas={};
  [].slice.call(alvo.children).forEach(function(e){
    const k=e.getAttribute&&e.getAttribute('data-chave');
    /* um filho sem chave não se sabe o que é nem a quem pertence: sai, e o
       contentor volta a ser só o que esta função lá pôs */
    if(k&&!antigas[k])antigas[k]=e;else e.remove();
  });
  /* Primeiro sai o que ja nao pertence. Se ficasse para o fim, as pecas que
     sobram apareciam fora de ordem por causa das que ainda la estavam, e cada
     uma pedia um insertBefore que nao era preciso: medido, filtrar 501 linhas
     para 63 dava 61 movimentos de arvore por nada. */
  const querem={};
  itens.forEach(function(it){if(it&&it.chave)querem[it.chave]=1});
  Object.keys(antigas).forEach(function(k){
    if(querem[k])return;
    antigas[k].remove();delete antigas[k];delete cache[k];conta.removidas++;
  });
  const novas={};
  let anterior=null,vistas={};
  itens.forEach(function(it){
    if(!it||!it.chave||vistas[it.chave])return;
    vistas[it.chave]=1;
    let el=antigas[it.chave];
    if(el&&cache[it.chave]===it.html){conta.mantidas++}
    else{
      const nova=pecaDe(it.html,it.chave);
      if(!nova)return;
      if(el){alvo.replaceChild(nova,el);conta.refeitas++}
      else conta.criadas++;
      el=nova;novas[it.chave]=el;
    }
    cache[it.chave]=it.html;
    delete antigas[it.chave];
    /* a ordem certa é «a seguir à anterior»; se já lá está, não se lhe toca —
       um insertBefore no sítio onde o nó já está continua a ser uma mudança
       de árvore, e com seleção aberta isso apagava as marcas */
    const devia=anterior?anterior.nextSibling:alvo.firstChild;
    if(el!==devia){alvo.insertBefore(el,devia);if(!novas[it.chave])conta.movidas++}
    anterior=el;
  });
  /* o que sobrar aqui e o que tinha chave mas nao apareceu na lista pedida —
     ja saiu acima; isto e a rede para uma chave repetida */
  Object.keys(antigas).forEach(function(k){
    antigas[k].remove();delete cache[k];conta.removidas++;
  });
  return conta;
}

/* Esquece o que se guardou de um contentor.

   Serve para quando a lista foi repintada por outro caminho — um render
   completo, por exemplo — e o que está guardado deixou de dizer respeito ao
   que está no ecrã. Sem isto, a pintura seguinte julgava iguais peças que já
   tinham sido substituídas por baixo.
   Recebe: alvo — o contentor (com null não faz nada).
   Devolve: nada — deita fora o que estava guardado. */
function esquecerLista(alvo){
  if(alvo)delete alvo[CHAVE_CACHE];
}
