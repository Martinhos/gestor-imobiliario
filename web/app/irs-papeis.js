/* ================= IRS · PAPÉIS =================
   Os papéis que o IRS dá às coisas da app, e que não mudam de ano para ano: a
   coluna do Anexo F onde um gasto cai (irsMapa, irsColunaDe, irsColunaNome),
   o que é uma renda e a renda ilíquida (ehRenda, rendaBruta) e o NIF (o
   dígito de controlo, nifValido, e a pessoa coletiva, nifColetivo). Partiu-se
   do irs.js (KAN-125), que fica com o motor das taxas e o bloco fiscal do
   contrato. São da base pelas mesmas razões: as cópias, as definições, os
   contratos e a Declaração também os usam. */

/* o mapa categoria → coluna do Anexo F em vigor: o das definições, ou o de origem
   Devolve: o mapa (objeto {'Categoria' ou 'Categoria / Sub': id de IRS_COLUNAS}). */
const irsMapa=()=>(db.settings&&db.settings.irsMapa)||IRS_MAPA0;
/* A coluna do Anexo F onde um movimento cai, e porquê. Só as despesas têm coluna: uma
   prestação, uma dívida ou um acerto nunca são dedutíveis (os juros são gastos financeiros);
   uma despesa fora dos totais (categoria excluída nas definições) também não. Depois manda
   o que foi escolhido no próprio movimento, depois a subcategoria, depois a categoria; o que
   não tem regra cai em «outros» e a origem di-lo, para o resumo o apontar.
   Recebe: t — o movimento.
   Devolve: {col, origem} — col é um id de IRS_COLUNAS; origem é 'tipo', 'excluido',
   'movimento', 'sub', 'categoria' ou 'omissao'. */
function irsColunaDe(t){
  if(!t||t.kind!=='expense')return {col:'nao',origem:'tipo'};
  if(!countsInTotals(t))return {col:'nao',origem:'excluido'};
  if(t.irsCol&&IRS_COLUNAS.some(c=>c[0]===t.irsCol))return {col:t.irsCol,origem:'movimento'};
  const m=irsMapa(),cat=String(t.category||'').trim(),sub=String(t.sub||'').trim();
  if(cat&&sub&&m[cat+' / '+sub])return {col:m[cat+' / '+sub],origem:'sub'};
  if(cat&&m[cat])return {col:m[cat],origem:'categoria'};
  return {col:'outros',origem:'omissao'};
}
/* o rótulo de uma coluna do Anexo F
   Recebe: col — o id (de IRS_COLUNAS).
   Devolve: o rótulo (string), ou '' se não existir. */
const irsColunaNome=col=>{const c=IRS_COLUNAS.find(x=>x[0]===col);return c?c[1]:''};
/* É uma renda para o IRS? Uma receita que conta nos totais, da categoria «Rendas» — ou sem
   categoria mas presa a um contrato. A caução e os empréstimos ficam de fora (isPassivo), e
   um reembolso ou um subsídio não são rendas.
   Recebe: t — o movimento.
   Devolve: true se é renda. */
const ehRenda=t=>!!t&&t.kind==='income'&&countsInTotals(t)&&(t.category==='Rendas'||(!t.category&&!!t.contractId));
/* a renda ilíquida de um movimento: o que entrou mais o que o inquilino reteve na fonte
   Recebe: t — o movimento.
   Devolve: o valor bruto em euros (número). */
const rendaBruta=t=>(Number(t.amount)||0)+(Number(t.retencao)||0);
/* O NIF tem dígito de controlo (mod 11) e um primeiro dígito com sentido: um erro de dedo
   fica à vista antes de ir para o contrato em PDF ou para o Anexo F.
   Recebe: nif — o NIF como foi escrito (string ou número; espaços são ignorados).
   Devolve: null se está vazio; true se é válido; false se não é. */
function nifValido(nif){
  const s=String(nif==null?'':nif).replace(/\s/g,'');
  if(!s)return null;
  if(!/^\d{9}$/.test(s)||'12356789'.indexOf(s[0])<0)return false;
  let soma=0;for(let i=0;i<8;i++)soma+=Number(s[i])*(9-i);
  const r=soma%11,dc=r<2?0:11-r;
  return dc===Number(s[8]);
}
/* O NIF é de uma pessoa coletiva? Os que começam por 5, 6 ou 9 são de
   empresas, condomínios e outras entidades; a afinação por tipo (os 7x) é de
   uma vaga seguinte. Não diz se o NIF é válido (nifValido) nem é por si só o
   critério de nada.
   Recebe: nif — o NIF como foi escrito (string ou número; espaços são ignorados).
   Devolve: true se tem nove dígitos e começa por 5, 6 ou 9. */
function nifColetivo(nif){
  const s=String(nif==null?'':nif).replace(/\s/g,'');
  return /^\d{9}$/.test(s)&&'569'.indexOf(s[0])>-1;
}
