/* ================= IRS =================
   O que a app sabe dizer sobre o IRS de um senhorio: a taxa especial sobre as
   rendas pela duração do contrato e a renda líquida que dela sai, a coluna do
   Anexo F onde um gasto cai, o que é renda, o estado de um contrato perante a
   AT, o NIF com dígito de controlo e o prazo do Modelo 2. Nada disto declara
   nada — resume, e aponta o que falta. Quem o mostra é o serviço Declaração
   (fisco.js); as regras são da base, porque as cópias (o CSV), as definições
   (IRS e dedução) e os contratos também as usam. */
/* taxa especial de IRS sobre rendas de habitação, pela duração do contrato (Lei 56/2023):
   25 %; 15 % com 5 anos ou mais; 10 % com 10 ou mais; 5 % com 20 ou mais. A duração
   conta do início ao fim inclusive (1 jan a 31 dez são 12 meses); sem fim, vale 25 %.
   Recebe: c — o contrato (usa start e end, 'AAAA-MM-DD'; aguenta null).
   Devolve: a taxa em percentagem (número: 25, 15, 10 ou 5). */
function irsRate(c){
  if(!c||!c.start||!c.end)return 25;
  const s=new Date(c.start+'T00:00:00'),e=new Date(c.end+'T00:00:00');e.setDate(e.getDate()+1);
  const meses=(e.getFullYear()-s.getFullYear())*12+(e.getMonth()-s.getMonth())-(e.getDate()<s.getDate()?1:0);
  return meses>=240?5:meses>=120?10:meses>=60?15:25;
}
/* a taxa de imposto que se aplica à renda de um contrato: a que foi escrita; em branco
   (ou 0, que é como o formulário guarda o branco) a estimativa pela duração (irsRate)
   Recebe: c — o contrato.
   Devolve: a taxa em percentagem (número). */
const taxRateOf=c=>Number(c.taxRate)>0?Number(c.taxRate):irsRate(c);
/* A renda mensal de um contrato depois do imposto, à taxa que se lhe aplica
   (taxRateOf).
   Recebe: c — o contrato.
   Devolve: euros (número). */
const netRent=c=>c.rent*(1-taxRateOf(c)/100);
/* A renda líquida mensal dos contratos em vigor de um imóvel.
   Recebe: p — o imóvel.
   Devolve: euros (número). */
const netRentOf=p=>sum(activeContracts(p.id).map(netRent));

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
/* o bloco fiscal de um contrato, sempre completo (um contrato que ainda não passou pelo
   normContract não o tem)
   Recebe: c — o contrato (aguenta null).
   Devolve: o bloco no formato de normFisco (o próprio, quando existe). */
const fiscoDe=c=>(c&&c.fisco)||normFisco(null);
/* o contrato foi comunicado à AT (Modelo 2)
   Recebe: c — o contrato.
   Devolve: true se o estado fiscal é «declarado». */
const ctDeclarado=c=>fiscoDe(c).estado==='declarado';
/* o senhorio marcou o contrato como não declarado: fica fora do resumo e dos prazos da AT
   Recebe: c — o contrato.
   Devolve: true se o estado fiscal é «naoDeclarado». */
const ctNaoDeclarado=c=>fiscoDe(c).estado==='naoDeclarado';
/* ainda não se disse se o contrato foi comunicado à AT
   Recebe: c — o contrato.
   Devolve: true se o estado fiscal está por indicar. */
const ctFiscoPorIndicar=c=>!fiscoDe(c).estado;
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
/* O último dia do mês seguinte ao de uma data — o prazo do Modelo 2 («até ao fim do mês
   seguinte» ao início, à alteração ou à cessação). Em hora local, sem toISOString.
   Recebe: iso — a data 'AAAA-MM-DD' (aguenta vazio).
   Devolve: 'AAAA-MM-DD', ou '' sem data válida. */
function fimDoMesSeguinte(iso){
  const m=/^(\d{4})-(\d{2})/.exec(String(iso||''));if(!m)return '';
  const d=new Date(Number(m[1]),Number(m[2])+1,0);   /* dia 0 de dois meses à frente = último dia do mês seguinte */
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
/* o código da natureza dos rendimentos no Anexo F: 07 arrendamento habitacional, 06 não habitacional
   Recebe: c — o contrato.
   Devolve: '07' ou '06' (string). */
const naturezaIrs=c=>fiscoDe(c).finalidade==='nh'?'06':'07';
