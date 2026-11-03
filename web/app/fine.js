/* ================= A FINE NA HIPOTECA ================= */
/* Ler a hipoteca a partir de um PDF: a FINE (Ficha de Informação Normalizada
   Europeia) do banco, ou o documento complementar do contrato. A pessoa
   escolhe o ficheiro no topo do formulário da hipoteca (imovel.js:loanSect,
   o mesmo na ficha do imóvel e no modal «Nova/Editar hipoteca»), o PDF fica
   anexado à hipoteca pelo caminho de sempre (anexos.js:takeFiles, como o
   imovel.js:loanAddFiles) e os bytes vão à rota POST /api/creditos/fine, que
   os lê com o Workers AI e devolve {campos, ignorados, produtos?,
   prestacaoComProdutos?}.

   O que vem do servidor é uma PROPOSTA: entra nos campos do formulário (em
   pForm, nunca na base), cada campo preenchido fica marcado na cor da frente
   (o contorno e o rótulo no --accent — o Samsung Internet do Martinho
   escurece à força e só a frente sobrevive), a linha «Lido do documento — confirma
   antes de guardar.» diz o que aconteceu, e «Ficou por ler: …» o que
   faltou — frases impessoais, sem a app a falar como «eu». O spread e a
   TAN lidos são os base, sem os produtos facultativos (seguros, cartões,
   ordenado domiciliado); os produtos que o documento indica, cada um com a
   sua redução, entram na lista de produtos da hipoteca (imovel.js:
   loanProdSect) desligados — a pessoa liga os que tem —, e substituem os
   que lá estavam (fineAplicar). A prestação lida confere-se sem produtos
   ligados; com todos ligados, a prestação com eles (finePrestacaoAConferir).
   Nada se grava sem o Guardar da pessoa. Uma prestação lida que não bate
   com a que a app calcula dá um aviso junto ao bloco.

   Só aparece com sessão, fora de produção e a quem pode editar a casa
   (finePodeLer). Tudo o que vem do servidor entra por esc() ou por value,
   e passa outra vez pelas gamas do contrato (fineLimpar): a rota já as
   aplica, e a app não confia no que não escreveu. */

/* O estado das leituras, por hipoteca, preso ao formulário aberto: o pForm
   é um objeto novo a cada janela (imovel.js:propModal, creditos.js:mortModal
   e newMort copiam o imóvel), e por isso um formulário novo começa sem
   marcas — as marcas e as linhas ficam até se guardar ou fechar. */
var fineEstado={form:null,porHipoteca:{}};
/* A rota da leitura (worker/src/rotas/fine.js). */
var FINE_ROTA='/api/creditos/fine';
/* O mesmo teto da rota: um PDF maior nem sai do aparelho. */
var FINE_MAX_BYTES=5*1024*1024;
/* Quanto se espera pela leitura antes de desistir. O modelo lê um PDF de
   várias páginas em segundos; um minuto inteiro é uma rede que caiu. */
var FINE_TEMPO_MS=60000;
/* A tolerância da verificação cruzada da prestação: o maior de 2% da
   prestação da FINE e 5 €. Os 2% engolem o que é arredondamento honesto — o
   prazo em meses que vira anos inteiros (342 → 29 anos muda a prestação
   ~1%), a taxa escrita com três casas, os cêntimos da FINE —, e um engano a
   sério passa-os sempre: um spread a 0 em vez de 1% muda a prestação 10% ou
   mais, um dígito a menos no capital muda-a 90%. Os 5 € são o chão das
   prestações pequenas, onde 2% são cêntimos. O imposto do selo (4% dos
   juros, perto de 2–3% da prestação) não conta para isto: a FINE pode
   escrevê-la com ou sem ele, e a app compara com as duas (fineConferir). */
var FINE_TOLERANCIA={pct:0.02,eur:5};
/* As frases da app (as do servidor chegam no error e dizem-se tal e qual). */
var FINE_FRASES={
  botao:'Ler a partir da FINE ou do contrato',
  aLer:'A ler o documento…',
  dica:'A app preenche os campos por ti, e tu confirmas antes de guardar. Se preferires, preenche à mão aqui em baixo.',
  produtos:'Se o documento indicar produtos facultativos (seguros, cartões, ordenado domiciliado), aparecem mais abaixo nos produtos da hipoteca, desligados: liga os que tens.',
  lido:'Lido do documento — confirma antes de guardar.',
  semRede:'Sem ligação ao servidor. Tenta daqui a pouco, ou preenche à mão.',
  demorou:'A leitura demorou de mais. Tenta daqui a pouco, ou preenche à mão.',
  falhou:'Não deu para ler o documento agora. Tenta daqui a pouco, ou preenche à mão.',
  grande:'O PDF é grande demais para ler (máx. 5 MB).',
  naoPdf:'Escolhe um PDF.',
  nada:'Este documento não tem os valores de um crédito.',
};
/* Os campos que a rota pode devolver, com o nome em português (para «Ficou
   por ler: …») e o sufixo do campo do loanSect (l_<sufixo>_<id>) onde a
   marca se acende. A prestação não tem campo: serve a verificação cruzada.
   Os produtos facultativos marcam o bloco deles (imovel.js:loanProdSect), e
   o nome serve o aviso do que o servidor recusou. */
var FINE_CAMPOS={
  bank:{nome:'o banco',campo:'bank'},
  outstanding:{nome:'o capital',campo:'out'},
  prazoMeses:{nome:'o prazo',campo:'years'},
  type:{nome:'o tipo de taxa',campo:''},
  rate:{nome:'a taxa',campo:'rate'},
  fixedYears:{nome:'os anos com taxa fixa',campo:'fy'},
  index:{nome:'o indexante',campo:'index'},
  euribor:{nome:'o valor do indexante',campo:'eur'},
  spread:{nome:'o spread',campo:'spr'},
  amortFeeFix:{nome:'a comissão de amortização da taxa fixa',campo:'ffix'},
  amortFeeVar:{nome:'a comissão de amortização da taxa variável',campo:'fvar'},
  prestacao:{nome:'a prestação',campo:''},
  produtos:{nome:'as reduções dos produtos facultativos',campo:''},
};
/* Quantos produtos facultativos se leem de um documento, no máximo (o mesmo
   teto da rota). */
var FINE_MAX_PRODUTOS=8;
/* O que cada tipo de taxa tem para ler, além do que todos têm: é a lista do
   que «faltou», e o que se aplica ao formulário (um campo de outro tipo não
   entra numa hipoteca que não o mostra). */
var FINE_COMUNS=['bank','outstanding','prazoMeses','type'];
var FINE_DO_TIPO={
  fixa:['rate','amortFeeFix'],
  mista:['fixedYears','rate','index','euribor','spread','amortFeeFix','amortFeeVar'],
  variavel:['index','euribor','spread','amortFeeVar'],
};

/* O estado da hipoteca lid no formulário aberto; um formulário novo esquece
   o do anterior.
   Recebe: lid — o id da hipoteca.
   Devolve: {ocupado, erro, marcas:{campo: valor aplicado}, lidos, faltou,
   estranhos (os nomes do que o servidor recusou), prazoMeses, prestacao,
   prestacaoComProdutos (a prestação com todos os produtos, 0 sem ela),
   produtosLidos (quantos produtos entraram), aviso (o HTML do último aviso
   pintado)} — o mesmo objeto enquanto o formulário for o mesmo. */
function fineDe(lid){
  if(fineEstado.form!==pForm)fineEstado={form:pForm,porHipoteca:{}};
  const t=fineEstado.porHipoteca;
  if(!t[lid])t[lid]={ocupado:false,erro:'',marcas:{},lidos:0,faltou:null,estranhos:[],prazoMeses:0,prestacao:0,prestacaoComProdutos:0,produtosLidos:0,aviso:''};
  return t[lid];
}
/* O botão aparece? Só com sessão (a rota pede-a), fora de produção (a rota
   responde 404 lá) e, numa casa que já existe, a quem a pode editar — quem
   só colabora sem «Editar a ficha» nem chega ao formulário, e a guarda
   repete-o.
   Devolve: true quando o botão se mostra. */
function finePodeLer(){
  if(!(window.CW&&CW.ambiente&&CW.ambiente!=='producao'))return false;
  if(!haSessao())return false;
  const id=pForm&&pForm.id;
  if(id&&prop(id)&&!pode(id,'house.edit'))return false;
  return true;
}
/* O bloco da leitura, no topo do formulário da hipoteca: o botão, o input
   escondido e o que a última leitura disse. O contentor fica com id para o
   fineRedesenhar trocar só o miolo.
   Recebe: l — a hipoteca (de pForm).
   Devolve: o HTML do bloco; '' quando o botão não se mostra. */
function fineSect(l){
  if(!l||!finePodeLer())return '';
  return `<div class="fine-bloco" id="fine_${esc(l.id)}">${fineMiolo(l)}</div>`;
}
/* O miolo do bloco, a partir do estado: o botão (ocupado durante a
   leitura), a dica, o erro junto ao botão, as linhas do que se leu e do que
   faltou, e o aviso da prestação.
   Recebe: l — a hipoteca.
   Devolve: o HTML (texto). */
function fineMiolo(l){
  const e=fineDe(l.id),id=esc(l.id),ocup=e.ocupado;
  let h=`<input type="file" id="fine_in_${id}" accept="application/pdf" class="u-d-none" data-change="fineFicheiro(this,'${jsq(l.id)}')">
    <button type="button" class="btn fine-btn" id="fine_btn_${id}" data-toca="rascunho" aria-describedby="fine_dica_${id} fine_prod_${id}"${ocup?' disabled aria-busy="true"':''} data-click="abrirSeletorFicheiros('fine_in_${jsq(l.id)}')">${ic('file',16)} ${esc(ocup?FINE_FRASES.aLer:FINE_FRASES.botao)}</button>
    <div class="hint" id="fine_dica_${id}">${esc(FINE_FRASES.dica)}</div>
    <div class="hint" id="fine_prod_${id}">${esc(FINE_FRASES.produtos)}</div>`;
  if(e.erro)h+=`<p class="erro-campo fine-erro" id="fine_erro_${id}" role="alert">${esc(e.erro)}</p>`;
  if(e.lidos){
    h+=`<div class="fine-lido-caixa"><p class="fine-lido-linha">${esc(FINE_FRASES.lido)}</p>`;
    if(e.estranhos&&e.estranhos.length)h+=`<p class="fine-aviso fine-estranho" role="alert">${esc(fineFraseEstranhos(e.estranhos))}</p>`;
    if(e.produtosLidos)h+=`<p class="fine-nota">${esc(fineFraseProdutos(e.produtosLidos))}</p>`;
    if(e.prazoMeses&&e.prazoMeses%12)h+=`<p class="fine-nota">${esc(fineFrasePrazo(e.prazoMeses))}</p>`;
    if(e.faltou&&e.faltou.length)h+=`<p class="fine-nota fine-faltou">Ficou por ler: ${esc(fineJuntar(e.faltou))}.</p>`;
    h+=`</div>`;
  }
  e.aviso=fineAvisoHtml(l,e);
  return h+`<div class="fine-aviso-caixa" id="fine_av_${id}" role="status">${e.aviso}</div>`;
}
/* O aviso da verificação cruzada, quando a prestação não bate. Vive numa
   caixa própria (role=status, sempre no DOM): ao escrever só ela se troca,
   e só quando muda — o leitor de ecrã anuncia o aviso a chegar e a sair, e
   não o bloco inteiro a cada tecla.
   Recebe: l — a hipoteca; e — o estado dela (fineDe).
   Devolve: o HTML do aviso, ou '' quando bate (ou não se pode saber). */
function fineAvisoHtml(l,e){
  const av=fineConferir(l,finePrestacaoAConferir(l,e));
  return av?`<p class="fine-aviso" id="fine_aviso_${esc(l.id)}">A prestação calculada (${euro2(av.calculada)}) não bate com a do documento (${euro2(av.fine)}) — confirma a taxa, o prazo e o capital.</p>`:'';
}
/* Troca só o miolo do bloco da hipoteca lid (o botão ocupado, o erro, o
   aviso), sem repintar o formulário — o que a pessoa está a escrever fica.
   Recebe: lid — o id da hipoteca.
   Devolve: nada — reescreve o bloco no DOM, se ele lá estiver. */
function fineRedesenhar(lid){
  const b=document.getElementById('fine_'+lid),l=findLoan(pForm,lid);
  if(b&&l)b.innerHTML=fineMiolo(l);
}
/* A nota dos produtos facultativos lidos: onde ficaram e o que fazer.
   Recebe: n — quantos entraram (≥ 1).
   Devolve: a frase. */
function fineFraseProdutos(n){
  return n===1?'O documento indica 1 produto facultativo: está nos produtos da hipoteca, desligado. Liga-o se o tens.'
    :`O documento indica ${n} produtos facultativos: estão nos produtos da hipoteca, desligados. Liga os que tens.`;
}
/* O prazo da FINE em meses que não dá anos inteiros: diz o arredondamento.
   Recebe: m — o prazo em meses.
   Devolve: a frase. */
function fineFrasePrazo(m){
  const a=Math.max(1,Math.round(m/12));
  return `O documento diz ${m} meses: ${a===1?'ficou 1 ano':'ficaram '+a+' anos'}, arredondado ao ano.`;
}
/* O aviso de um documento que trouxe valores sem sentido num crédito.
   Recebe: nomes — os nomes em português do que o servidor recusou.
   Devolve: a frase. */
function fineFraseEstranhos(nomes){
  return `O documento traz valores que não fazem sentido num crédito (${fineJuntar(nomes)}). Pode não ser de confiança: confirma cada campo com o original antes de guardar.`;
}
/* Junta nomes como numa frase: «a», «a e b», «a, b e c».
   Recebe: lista — os nomes (textos).
   Devolve: o texto. */
function fineJuntar(lista){
  const l=(lista||[]).slice();
  if(l.length<2)return l.join('');
  return l.slice(0,-1).join(', ')+' e '+l[l.length-1];
}
/* Um número dentro de uma gama, ou nada.
   Recebe: v — o valor; min, max — os limites (inclusivos); inteiro (opcional) — exige inteiro.
   Devolve: o número, ou null quando não serve. */
function fineNumero(v,min,max,inteiro){
  if(typeof v!=='number'||!isFinite(v))return null;
  if(inteiro&&Math.round(v)!==v)return null;
  return v>=min&&v<=max?v:null;
}
/* Passa os campos da resposta pelas gamas do contrato outra vez (a rota já
   o fez; a app não confia no que não escreveu). Um campo desconhecido não
   entra; um fora de gama, do tipo errado ou vazio conta como não lido.
   Recebe: campos — o objeto campos da resposta (aguenta lixo).
   Devolve: um objeto novo só com os campos que servem. */
function fineLimpar(campos){
  const c=campos&&typeof campos==='object'&&!Array.isArray(campos)?campos:{},o={};
  const n=(k,min,max,int)=>{const v=fineNumero(c[k],min,max,int);if(v!==null)o[k]=v};
  if(typeof c.bank==='string'){const b=c.bank.trim();if(b&&b.length<=80)o.bank=b}
  n('outstanding',1000,5000000);n('prazoMeses',12,600,true);
  if(['fixa','mista','variavel'].includes(c.type))o.type=c.type;
  n('rate',0,20);n('fixedYears',1,50,true);
  if(['3m','6m','12m'].includes(c.index))o.index=c.index;
  n('euribor',-1,10);n('spread',0,10);n('amortFeeFix',0,2);n('amortFeeVar',0,0.5);n('prestacao',1,50000);
  return o;
}
/* Os produtos facultativos da resposta passados outra vez pelas regras do
   contrato (a rota já o fez; a app não confia no que não escreveu): só os
   tipos da lista fechada (dados.js:PRODUTOS_HIPOTECA — um desconhecido não
   entra), sem tipos repetidos (fica o primeiro), só as reduções que o tipo
   de taxa tem (credito.js:produtosReducoes) e dentro de (0, 3]
   (dados.js:produtoReducao), um produto sem redução nenhuma não entra, e no
   máximo FINE_MAX_PRODUTOS.
   Recebe: lista — o produtos da resposta (aguenta lixo); tipo — o tipo de
   taxa da hipoteca ('fixa', 'mista', 'variavel').
   Devolve: [{tipo, spread, tan}] — spread e tan null quando não há. */
function fineLimparProdutos(lista,tipo){
  if(!Array.isArray(lista))return [];
  const red=produtosReducoes(tipo),vistos={},out=[];
  for(const x of lista){
    if(out.length>=FINE_MAX_PRODUTOS)break;
    if(!x||typeof x!=='object'||Array.isArray(x)||typeof x.tipo!=='string')continue;
    if(!PRODUTOS_HIPOTECA.some(p=>p.id===x.tipo)||vistos[x.tipo])continue;
    const spread=red.spread?produtoReducao(x.spread):null,tan=red.tan?produtoReducao(x.tan):null;
    if(spread===null&&tan===null)continue;
    vistos[x.tipo]=true;
    out.push({tipo:x.tipo,spread,tan});
  }
  return out;
}
/* A lista dos produtos como texto, para saber se a pessoa a mudou depois de
   lida: o tipo e as reduções de cada um, pela ordem — ligar e desligar não
   conta (é o que se espera que a pessoa faça).
   Recebe: l — a hipoteca.
   Devolve: o texto. */
function fineAssinaturaProdutos(l){
  return JSON.stringify((l&&l.produtos||[]).map(p=>[p.tipo,p.spread,p.tan]));
}
/* O valor de um campo como o formulário o tem agora, para saber se a pessoa
   o mudou depois de lido (a marca sai).
   Recebe: l — a hipoteca; k — o nome do campo na resposta.
   Devolve: o valor (número ou texto). */
function fineValorAtual(l,k){
  if(k==='outstanding')return capitalDoInicio(l,db.transactions);
  if(k==='prazoMeses')return Number(l.years)||0;
  if(k==='produtos')return fineAssinaturaProdutos(l);
  return l[k];
}
/* Dois valores iguais: os números com folga de vírgula flutuante (o campo
   volta pelo numTaxa), o resto à letra.
   Recebe: a, b — os valores.
   Devolve: true quando são o mesmo. */
function fineIgual(a,b){
  if(typeof b==='number')return Math.abs((Number(a)||0)-b)<1e-6;
  return String(a==null?'':a).trim()===String(b==null?'':b).trim();
}
/* Aplica os campos lidos à hipoteca do formulário (pForm — nunca à base):
   o tipo primeiro, como o setLType, e depois os campos comuns e os desse
   tipo; o capital vai para o capital da data de início (o do campo) e o
   capital em dívida deriva-se, como no collectProp; o prazo em meses passa a
   anos inteiros. Guarda no estado o que marcou, o que faltou e a prestação
   para a verificação cruzada.
   Os ignorados (o que o servidor leu e recusou por estar fora de gama ou
   ter o tipo errado) não entram, mas contam: um documento com um capital de
   milhões ou um prazo de séculos não é uma FINE de confiança. Pode trazer
   instruções escondidas que puseram o modelo a mentir também nos valores
   que passam nas gamas, e por isso a pessoa é avisada para conferir tudo.
   Os produtos facultativos lidos (limpos outra vez, fineLimparProdutos, com
   o tipo de taxa já aplicado) SUBSTITUEM os que a hipoteca tinha: todos
   desligados e com id novo — a pessoa liga os que tem. Sem nenhum que sirva,
   ficam os que lá estavam. A prestação com os produtos fica no estado para a
   verificação cruzada, só entre 1 e 50 000 € e abaixo da prestação base lida.
   Recebe: l — a hipoteca de pForm; campos — o campos da resposta; e — o
   estado dela (fineDe); ignorados (opcional) — os nomes que o servidor
   recusou; produtos (opcional) — o produtos da resposta;
   prestacaoComProdutos (opcional) — a prestação com eles.
   Devolve: quantos campos preencheu (os produtos contam como um). */
function fineAplicar(l,campos,e,ignorados,produtos,prestacaoComProdutos){
  const c=fineLimpar(campos),tipo=c.type||l.type||'fixa',marcas={};
  const quer=FINE_COMUNS.concat(FINE_DO_TIPO[tipo]||[]);
  if(c.type){l.type=c.type;marcas.type=c.type}
  quer.forEach(k=>{
    if(k==='type'||c[k]===undefined)return;
    if(k==='outstanding'){l.capitalInicio=c[k];l.outstanding=saldoEmDivida(l,db.transactions);marcas[k]=capitalDoInicio(l,db.transactions);return}
    if(k==='prazoMeses'){l.years=Math.max(1,Math.round(c[k]/12));marcas[k]=l.years;return}
    l[k]=c[k];marcas[k]=c[k];
  });
  const ps=fineLimparProdutos(produtos,l.type);
  if(ps.length){
    l.produtos=ps.map(x=>normProduto({tipo:x.tipo,spread:x.spread,tan:x.tan,ativo:false}));
    marcas.produtos=fineAssinaturaProdutos(l);
  }
  e.produtosLidos=ps.length;
  e.marcas=marcas;
  e.lidos=Object.keys(marcas).length;
  e.prazoMeses=c.prazoMeses||0;
  e.prestacao=c.prestacao||0;
  e.faltou=quer.concat(['prestacao']).filter(k=>c[k]===undefined).map(k=>FINE_CAMPOS[k].nome);
  e.estranhos=Array.isArray(ignorados)?Object.keys(FINE_CAMPOS).filter(k=>ignorados.indexOf(k)>-1).map(k=>FINE_CAMPOS[k].nome):[];
  const pc=fineNumero(prestacaoComProdutos,1,50000);
  e.prestacaoComProdutos=pc!==null&&c.prestacao>0&&pc<c.prestacao?pc:0;
  e.erro='';
  return e.lidos;
}
/* A marca de um campo lido, para o rótulo do loanSect: acesa enquanto o
   valor for o que se leu; a pessoa muda-o e ela sai (e não volta). É a
   escolha: a marca diz «este valor veio do documento», e um valor escrito
   à mão já não veio.
   Recebe: l — a hipoteca; k — o nome do campo na resposta.
   Devolve: ' class="fine-lido"' ou ''. */
function fineMarca(l,k){
  if(!l||fineEstado.form!==pForm)return '';
  const e=fineEstado.porHipoteca[l.id];
  if(!e||!(k in e.marcas))return '';
  if(!fineIgual(fineValorAtual(l,k),e.marcas[k])){delete e.marcas[k];return ''}
  return ' class="fine-lido"';
}
/* Depois de a pessoa escrever (imovel.js:liveLoan e liveLoanAll, já com o
   collectProp feito): apaga as marcas dos campos que mudaram (a dos
   produtos sai do bloco deles) e refaz o aviso da prestação, sem repintar o
   formulário nem o resto do bloco.
   Recebe: l — a hipoteca (de pForm).
   Devolve: nada — mexe nas classes dos rótulos e na caixa do aviso. */
function fineRefrescar(l){
  if(!l||fineEstado.form!==pForm||!fineEstado.porHipoteca[l.id])return;
  const e=fineEstado.porHipoteca[l.id];
  Object.keys(e.marcas).forEach(k=>{
    if(fineMarca(l,k))return;
    if(k==='produtos'){const b=document.getElementById('l_prods_'+l.id);if(b)b.classList.remove('fine-lido');return}
    const suf=(FINE_CAMPOS[k]||{}).campo,el=suf?document.getElementById('l_'+suf+'_'+l.id):null;
    const lab=el&&typeof el.closest==='function'?el.closest('label'):null;
    if(lab)lab.classList.remove('fine-lido');
  });
  const novo=fineAvisoHtml(l,e),caixa=document.getElementById('fine_av_'+l.id);
  if(novo!==e.aviso&&caixa)caixa.innerHTML=novo;
  e.aviso=novo;
}
/* A prestação do documento que se confere com a hipoteca como está: sem
   produtos ligados, a prestação lida (a base); com todos os produtos
   ligados, a prestação com eles (sem ela lida, não se confere); com uns
   ligados e outros não, o documento não diz essa prestação, e não se
   confere.
   Recebe: l — a hipoteca; e — o estado dela (fineDe).
   Devolve: a prestação a conferir, ou 0 quando não há. */
function finePrestacaoAConferir(l,e){
  const ps=(l&&l.produtos)||[],lig=ps.filter(p=>p&&p.ativo===true).length;
  if(!lig)return e.prestacao||0;
  return lig===ps.length?(e.prestacaoComProdutos||0):0;
}
/* A verificação cruzada: a prestação que a app calcula para a hipoteca como
   está (credito.js:loanCalc) contra a da FINE. Compara com a prestação sem
   selo e com ela, e fica com a mais perto (a FINE pode dizer qualquer das
   duas); acima da tolerância (FINE_TOLERANCIA), há aviso. Sem capital, sem
   prazo ou sem prestação lida não há conta a fazer.
   Recebe: l — a hipoteca; p — a prestação da FINE (0 quando não se leu).
   Devolve: null quando bate (ou não se pode saber); {calculada, fine} quando
   não bate — a calculada é a da caixa da simulação (com o selo, se o paga). */
function fineConferir(l,p){
  if(!(p>0)||!l||!(Number(l.outstanding)>0)||!(Number(l.years)>0))return null;
  const c=loanCalc(l);
  if(c.esgotado||!(c.total>0))return null;
  const dif=Math.min(Math.abs(c.base-p),Math.abs(c.total-p));
  if(dif<=Math.max(FINE_TOLERANCIA.pct*p,FINE_TOLERANCIA.eur))return null;
  return {calculada:c.total,fine:p};
}
/* O que se recusa antes de enviar: o mesmo que a rota recusaria, sem gastar
   uma das leituras do dia.
   Recebe: f — o File escolhido.
   Devolve: a frase do erro, ou '' quando pode ir. */
function fineRecusaLocal(f){
  const pdf=f.type==='application/pdf'||/\.pdf$/i.test(String(f.name||''));
  if(!pdf)return FINE_FRASES.naoPdf;
  if(f.size>FINE_MAX_BYTES)return FINE_FRASES.grande;
  return '';
}
/* Envia os bytes do PDF à rota, com a sessão como os outros pedidos
   (nucleo.js:api: o Authorization e o X-Rendorium-Token, e o cookie
   same-origin), e com tempo limite.
   Recebe: f — o File (ou Blob) do PDF.
   Devolve: Promise que resolve sempre: {campos, ignorados, produtos,
   prestacaoComProdutos} com 200 (os dois últimos tal como vieram: o
   fineAplicar é que os limpa), ou
   {erro} com a frase a mostrar (a do servidor, quando a há). */
function fineLer(f){
  const h={'Content-Type':'application/pdf'};
  if(window.CW&&CW.user&&CW.user.token){h.Authorization='Bearer '+CW.user.token;h['X-Rendorium-Token']='1'}
  const ctl=typeof AbortController==='function'?new AbortController():null;
  const opts={method:'POST',body:f,headers:h,credentials:'same-origin'};
  if(ctl)opts.signal=ctl.signal;
  const relogio=ctl?setTimeout(()=>ctl.abort(),FINE_TEMPO_MS):null;
  const fim=v=>{if(relogio)clearTimeout(relogio);return v};
  const rasto=t=>{if(typeof rastoPoe==='function')rastoPoe('POST '+FINE_ROTA+' → '+t)};
  return fetch(FINE_ROTA,opts).then(r=>{
    rasto(r.status);
    const corpo=r&&typeof r.json==='function'?Promise.resolve().then(()=>r.json()).catch(()=>({})):Promise.resolve({});
    return corpo.then(j=>{
      j=j&&typeof j==='object'?j:{};
      if(r.ok){
        if(j.campos&&typeof j.campos==='object'&&!Array.isArray(j.campos))return fim({campos:j.campos,ignorados:Array.isArray(j.ignorados)?j.ignorados:[],produtos:j.produtos,prestacaoComProdutos:j.prestacaoComProdutos});
        return fim({erro:FINE_FRASES.falhou});
      }
      const frase=typeof j.error==='string'&&j.error.trim()?j.error.trim().slice(0,240):FINE_FRASES.falhou;
      return fim({erro:frase,status:r.status});
    });
  },x=>{
    rasto('sem rede');
    return fim({erro:x&&x.name==='AbortError'?FINE_FRASES.demorou:FINE_FRASES.semRede});
  });
}
/* A pessoa escolheu o PDF: anexa-o à hipoteca (fica mesmo que a leitura
   falhe, como o imovel.js:loanAddFiles), e, se pode ir, envia-o e aplica o
   que voltar ao formulário — sempre a colher antes de repintar, e só se o
   formulário ainda for o mesmo (fechado ou trocado, a resposta perde-se).
   Nada vai para a base: grava o Guardar da janela.
   Recebe: input — o <input type="file"> (o this da ação); lid — o id da hipoteca.
   Devolve: Promise que resolve quando a leitura acabou (os testes esperam por ela). */
function fineFicheiro(input,lid){
  const f=input&&input.files&&input.files[0];
  if(!f)return Promise.resolve();
  collectProp();
  const form=pForm,e=fineDe(lid);
  e.erro='';
  /* ler o mesmo PDF outra vez não o anexa outra vez: o que já lá está com o
     mesmo nome e tamanho fica, e a cópia nova sai do aparelho */
  takeFiles(input).then(ms=>{
    if(pForm!==form||!ms.length)return;
    collectProp();
    const l=findLoan(pForm,lid);if(!l)return;
    const ja=new Set((l.files||[]).map(x=>x.name+'|'+x.size));
    const novos=ms.filter(m=>!ja.has(m.name+'|'+m.size));
    ms.filter(m=>novos.indexOf(m)<0).forEach(m=>{idbDel(m.id).catch(()=>{})});
    if(!novos.length)return;
    l.files=(l.files||[]).concat(novos);repaintProp();
    toast('Documento anexado.');
  });
  const recusa=fineRecusaLocal(f);
  if(recusa){e.erro=recusa;fineRedesenhar(lid);return Promise.resolve()}
  e.ocupado=true;fineRedesenhar(lid);
  return fineLer(f).then(res=>{
    if(pForm!==form)return;
    e.ocupado=false;
    if(res.erro){e.erro=res.erro;fineRedesenhar(lid);return}
    collectProp();
    const l=findLoan(pForm,lid);if(!l)return;
    const n=fineAplicar(l,res.campos,e,res.ignorados,res.produtos,res.prestacaoComProdutos);
    if(!n){e.lidos=0;e.erro=FINE_FRASES.nada;fineRedesenhar(lid);return}
    repaintProp();
  });
}
