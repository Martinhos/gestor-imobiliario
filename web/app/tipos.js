/* ================= TIPOS E CATEGORIAS DE MOVIMENTO =================
   Os seis tipos de movimento (KIND) e os cinco que se escolhem ao criar
   (TX_TYPES), o sentido de cada um (entra, sai ou nenhum), as árvores de
   categorias das receitas e dos pagamentos, o que fica fora dos totais (as
   exclusões escolhidas nas definições e o passivo: a caução e os
   empréstimos recebidos), e as dívidas a terceiros por credor. */
const KIND={income:{short:'Receita',sign:'+',color:'pos',flow:'in'},expense:{short:'Despesa',sign:'−',color:'neg',flow:'out'},
  loan:{short:'Pagamento de crédito',sign:'−',color:'amber',flow:'out'},owed:{short:'Dívida recebida',sign:'+',color:'amber',flow:'in'},
  repay:{short:'Pagamento de dívida',sign:'−',color:'neg',flow:'out'},settle:{short:'Transferência',sign:'',color:'',flow:'none'}};
/* os cinco tipos que se escolhem ao criar um movimento */
const TX_TYPES=[['income','up','Receita','renda recebida, reembolso, subsídio'],['expense','dn','Despesa','impostos, obras, condomínio, seguros'],
  ['loan','bank','Pagamento de crédito','prestação ou amortização do crédito'],['owed','users','Dívida','dinheiro recebido de alguém, ou devolvido'],
  ['settle','swap','Transferência entre proprietários','um dono passa dinheiro a outro para acertar contas']];
/* O nome de um tipo de movimento, em minúsculas, para o meio das frases.
   Recebe: k — o tipo.
   Devolve: o texto; 'movimento' num tipo desconhecido. */
const txTypeName=k=>({income:'receita',expense:'despesa',loan:'pagamento de crédito',owed:'dívida',repay:'dívida',settle:'transferência'})[k]||'movimento';
/* «Novo » ou «Nova », a concordar com o nome do tipo (o pagamento de crédito é o
   único masculino).
   Recebe: k — o tipo.
   Devolve: o texto, com o espaço. */
const txNewWord=k=>(k==='loan'?'Novo ':'Nova ');
/* O sentido do dinheiro num tipo de movimento.
   Recebe: k — o tipo (um desconhecido conta como despesa).
   Devolve: 'in', 'out' ou 'none'. */
const flowOf=k=>(KIND[k]||KIND.expense).flow;
/* O tipo é de dinheiro que entra (receita, dívida recebida).
   Recebe: k — o tipo do movimento.
   Devolve: true/false. */
const isIn=k=>flowOf(k)==='in';
/* O tipo é de dinheiro que sai (despesa, pagamento de crédito, dívida paga).
   Recebe: k — o tipo do movimento.
   Devolve: true/false. */
const isOut=k=>flowOf(k)==='out';
// árvore de categorias das despesas e pagamentos: a das definições, ou a de fábrica.
// Devolve: a árvore (objeto {categoria: [subcategorias]}).
const cats=()=>db.settings.cats||CATS0;
// árvore de categorias das receitas: a das definições, ou a de fábrica.
// Devolve: a árvore (objeto {categoria: [subcategorias]}).
const catsIn=()=>db.settings.catsIn||CATS_IN0;
/* árvore de categorias de um tipo de movimento: receitas ou pagamentos (acertos não têm)
   Recebe: k — o tipo do movimento.
   Devolve: 'catsIn', 'cats', ou '' num acerto. */
const treeKey=k=>k==='settle'?'':(isIn(k)?'catsIn':'cats');
/* A árvore de categorias das definições para um tipo de movimento.
   Recebe: k — o tipo do movimento.
   Devolve: a árvore ({categoria: [subcategorias]}), ou null num acerto. */
const catsFor=k=>{const t=treeKey(k);return t?db.settings[t]:null};
/* categorias/subcategorias podem ficar fora dos totais de receitas e despesas
   Recebe: tk — a chave da árvore ('cats' ou 'catsIn'); cat — o nome da categoria;
   sub (opcional) — a subcategoria.
   Devolve: a chave da exclusão (string), ex.: "cats:Obras" ou "cats:Obras/Pinturas". */
const excKey=(tk,cat,sub)=>tk+':'+cat+(sub?'/'+sub:'');
// esta categoria (ou a subcategoria, se dada) está excluída dos totais deste tipo de movimento?
// Recebe: kind — o tipo do movimento (ex.: 'income', 'expense'); cat — a categoria;
// sub (opcional) — a subcategoria.
// Devolve: true se estiver excluída dos totais; false caso contrário.
function isExc(kind,cat,sub){
  if(!cat)return false;
  const e=(db.settings||{}).exclude||{},tk=treeKey(kind);
  return !!(e[excKey(tk,cat)]||(sub&&e[excKey(tk,cat,sub)]));
}
// liga/desliga a exclusão de uma categoria dos totais; tk é a chave da árvore
// ('cats' ou 'catsIn'), não o tipo do movimento. Grava e volta a desenhar tudo.
// Recebe: tk — a chave da árvore ('cats' ou 'catsIn'); cat — a categoria; sub (opcional) — a subcategoria.
// Devolve: nada — grava a alteração e volta a desenhar a vista.
function toggleExc(tk,cat,sub){
  const e=db.settings.exclude=db.settings.exclude||{},k=excKey(tk,cat,sub||null);
  if(e[k])delete e[k];else e[k]=true;
  save();render();
}
/* receitas que são passivo, não rendimento: a caução devolve-se e o empréstimo paga-se.
   Nunca entram nos totais, no resultado nem no cashflow — capitalizadas a 5 % inflavam a avaliação.
   Recebe: t — o movimento.
   Devolve: true se for uma caução ou um empréstimo recebido. */
const isPassivo=t=>t.kind==='income'&&(t.category==='Empréstimos recebidos'||t.sub==='Caução');
/* O movimento entra nos totais de receitas e despesas: não é passivo nem de uma
   categoria excluída.
   Recebe: t — o movimento.
   Devolve: true/false. */
const countsInTotals=t=>!isPassivo(t)&&!((t.kind==='income'||t.kind==='expense')&&isExc(t.kind,t.category,t.sub));
/* todas as categorias conhecidas, para o filtro (sem repetir)
   Recebe: kind (opcional) — o tipo de movimento; vazio junta receitas e despesas.
   Devolve: a árvore (objeto {categoria: [subcategorias]}), sem repetidos. */
function allCats(kind){
  if(kind)return catsFor(kind)||{};
  const out={};[catsIn(),cats()].forEach(tr=>Object.keys(tr).forEach(k=>{out[k]=(out[k]||[]).concat(tr[k].filter(x=>(out[k]||[]).indexOf(x)<0))}));
  return out;
}
/* de quem se recebeu / a quem se pagou uma dívida a terceiros, com o que falta devolver
   Recebe: pid (opcional) — o id de um imóvel; vazio vale o âmbito atual.
   Devolve: array de {creditor, propertyId, received, repaid, due} — valores em euros,
   do maior "due" (o que falta devolver) para o menor. */
function creditorBalances(pid){
  const map={};
  db.transactions.filter(t=>(t.kind==='owed'||t.kind==='repay')&&(pid?t.propertyId===pid:inScope(t.propertyId))).forEach(t=>{
    const k=(t.creditor||'').trim()||'—',pk=t.propertyId||'';
    const key=k+'|'+pk,e=map[key]||(map[key]={creditor:k,propertyId:pk||null,received:0,repaid:0});
    if(t.kind==='owed')e.received+=Number(t.amount)||0;else e.repaid+=Number(t.amount)||0;
  });
  return Object.keys(map).map(k=>map[k]).map(e=>Object.assign(e,{due:Math.round((e.received-e.repaid)*100)/100})).sort((a,b)=>b.due-a.due);
}
// credores já escritos nos movimentos, sem repetir e por ordem — para sugerir ao preencher.
// Devolve: os nomes dos credores (array de strings), sem repetidos e por ordem alfabética.
const knownCreditors=()=>[...new Set(db.transactions.map(t=>(t.creditor||'').trim()).filter(Boolean))].sort();

/* O nome de um tipo de movimento para os resumos de filtro. O 'debt' não é um
   tipo de movimento — é o pseudo-tipo do filtro que junta as duas dívidas —,
   por isso não está no KIND, e sem isto aparecia o código cru ao utilizador.
   Recebe: k — o tipo do filtro ('income', 'owed', 'debt'…).
   Devolve: o nome a mostrar (texto); o próprio código, se for um desconhecido. */
function nomeDoTipo(k){return (KIND[k]||{}).short||({debt:'Dívidas'})[k]||k}
