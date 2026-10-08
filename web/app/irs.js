/* ================= IRS =================
   O que a app sabe dizer sobre o IRS de um senhorio: a taxa especial sobre as
   rendas e a renda líquida que dela sai, a coluna do Anexo F onde um gasto
   cai, o que é renda, o estado de um contrato perante a AT, o NIF com dígito
   de controlo e o prazo do Modelo 2. Nada disto declara nada — resume, e
   aponta o que falta. Quem o mostra é o serviço Declaração (fisco.js); as
   regras são da base, porque as cópias (o CSV), as definições (IRS e
   dedução), os contratos e as projeções também as usam.

   O que muda de ano para ano NÃO vive aqui: as taxas, os escalões da
   duração, a taxa das rendas moderadas, as datas da AT, os quadros e os
   códigos do Anexo F, o que mudou e o guia de preenchimento vivem numa
   versão por ano dos rendimentos — um ficheiro cada, irs-2025.js,
   irs-2026.js… —, que se regista com registarAnoIrs. Aqui fica o motor que
   as lê. Um ano sem versão usa a mais recente antes dele, e diz-se. */

/* as versões registadas, pelo ano dos rendimentos (registarAnoIrs) */
const IRS_ANOS={};
/* Regista a versão de um ano dos rendimentos. Cada irs-AAAA.js chama-a uma vez,
   ao carregar, com tudo o que vale para os rendimentos desse ano (o formato
   está no próprio irs-2025.js). Uma versão é dados, nunca código: o motor que
   os lê é este ficheiro.
   Recebe: v — a versão ({ano, entrega, modelo, taxas, naturezas, quadros,
   prazos, novidades, passos}).
   Devolve: nada — guarda-a em IRS_ANOS. */
function registarAnoIrs(v){IRS_ANOS[v.ano]=v}
/* Os anos com versão própria, do mais antigo ao mais recente.
   Devolve: array de números. */
function irsAnosConhecidos(){return Object.keys(IRS_ANOS).map(Number).sort((a,b)=>a-b)}
/* Um ano dos rendimentos com sentido, ou o corrente. Protege quem passa o
   índice de um map (netRent como callback recebia 0, 1, 2…) e quem não passa
   ano nenhum.
   Recebe: a — o ano (número ou texto; aguenta tudo).
   Devolve: um ano (número inteiro). */
function anoIrs(a){const n=Number(a);return Number.isInteger(n)&&n>=1990&&n<=2200?n:YEAR}
/* A versão das regras para um ano dos rendimentos: a do próprio ano; sem ela,
   a mais recente antes dele (o ano corrente antes de haver a versão nova);
   antes da primeira, a primeira. O `exato` diz se é a do ano pedido — a
   página Declaração avisa quando não é. Emprestada a outro ano, as datas da
   AT (a entrega e a comunicação de fevereiro) passam para esse ano: são
   datas fixas da lei (CIRS art. 60.º, Portaria 110/2019), e a entrega dos
   rendimentos de 2027 nunca é em 2027.
   Recebe: ano (opcional) — o ano dos rendimentos; sem ele, o corrente.
   Devolve: a versão, com {pedido, exato} acrescentados (objeto novo). */
function irsAno(ano){
  const pedido=anoIrs(ano),anos=irsAnosConhecidos();
  const base=anos.filter(a=>a<=pedido).pop()||anos[0],v=IRS_ANOS[base],d=pedido-base;
  const out=Object.assign({},v,{pedido:pedido,exato:base===pedido});
  if(d){
    const mv=s=>/^\d{4}-/.test(String(s||''))?(Number(s.slice(0,4))+d)+s.slice(4):s;
    out.entrega={de:mv(v.entrega.de),ate:mv(v.entrega.ate)};
    out.prazos=Object.assign({},v.prazos,{comunicacaoDuracao:mv(v.prazos.comunicacaoDuracao)});
  }
  return out;
}
/* Meses entre duas datas, com o fim inclusive (1 jan a 31 dez são 12 meses).
   Recebe: ini, fim — 'AAAA-MM-DD'.
   Devolve: o número de meses inteiros, ou 0 sem as duas datas. */
function irsMeses(ini,fim){
  if(!ini||!fim)return 0;
  const s=new Date(ini+'T00:00:00'),e=new Date(fim+'T00:00:00');e.setDate(e.getDate()+1);
  return Math.max(0,(e.getFullYear()-s.getFullYear())*12+(e.getMonth()-s.getMonth())-(e.getDate()<s.getDate()?1:0));
}
/* Os períodos de um contrato: o inicial (início e fim) e cada renovação
   registada no bloco fiscal, pela ordem em que começam.
   Recebe: c — o contrato.
   Devolve: [{inicio, fim}] — o primeiro é sempre o do contrato. */
function irsPeriodos(c){
  const rs=(fiscoDe(c).renovacoes||[]).filter(r=>r&&r.inicio).map(r=>({inicio:r.inicio,fim:r.fim||''}))
    .sort((a,b)=>a.inicio<b.inicio?-1:a.inicio>b.inicio?1:0);
  return [{inicio:(c&&c.start)||'',fim:(c&&c.end)||''}].concat(rs);
}
/* A redução da taxa pela duração do contrato (CIRS art. 72.º n.ºs 3 a 5), só
   no arrendamento para habitação permanente — ou de finalidade por indicar,
   que a app assume habitação até a pessoa dizer outra coisa. Conta o período
   em vigor no ano (o contrato ou a última renovação começada até 31 de
   dezembro): o regime é o da data em que ele começou (os escalões da versão,
   cada um com `desde`/`ate`), o escalão é o da duração dele, e cada renovação
   anterior do mesmo escalão desce `porRenovacao` pontos até ao `minimo`.
   Sem fim no período, não há duração e não há redução.
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: {taxa, meses, renovacoes, desde} — desde é o início do período —
   ou null quando não há redução. */
function irsReducao(c,ano){
  if(!c)return null;
  const fin=fiscoDe(c).finalidade;if(fin&&fin!=='hp')return null;
  const a=anoIrs(ano),T=irsAno(a).taxas,ps=irsPeriodos(c),fimAno=a+'-12-31';
  const vivos=ps.filter(p=>p.inicio&&p.inicio<=fimAno),atual=vivos[vivos.length-1]||ps[0];
  if(!atual.inicio||!atual.fim)return null;
  const regime=(T.duracao||[]).find(r=>atual.inicio>=r.desde&&(!r.ate||atual.inicio<=r.ate));
  if(!regime)return null;
  const esc=m=>regime.escaloes.slice().sort((x,y)=>y.meses-x.meses).find(e=>m>=e.meses);
  const meses=irsMeses(atual.inicio,atual.fim),e=esc(meses);
  if(!e)return null;
  /* as renovações «com igual duração»: do escalão do período em vigor, e só se
     o contrato inicial também for desse escalão */
  const igual=esc(irsMeses(ps[0].inicio,ps[0].fim))===e;
  const renovacoes=igual?vivos.slice(1).filter(p=>esc(irsMeses(p.inicio,p.fim))===e).length:0;
  const taxa=e.porRenovacao?Math.max(e.minimo,e.taxa-renovacoes*e.porRenovacao):e.taxa;
  return {taxa:taxa,meses:meses,renovacoes:renovacoes,desde:atual.inicio};
}
/* A taxa especial do IRS sobre as rendas de um contrato num ano, e porquê
   (CIRS art. 72.º; EBF art. 45.º-C). Não habitacional: a taxa da versão (28 %).
   Habitacional: a base (25 %), a redução pela duração quando a há
   (irsReducao), e a das rendas moderadas quando a versão a tem, o ano está
   dentro dela e a renda mensal não passa o limite — fica sempre a mais baixa.
   É a estimativa: a taxa escrita no contrato manda sobre ela (taxRateOf).
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: {taxa, motivo, reducao} — motivo é 'nh', 'base', 'duracao' ou
   'moderada'; reducao o que irsReducao devolveu (ou null), mesmo quando a
   moderada ganha, porque é ela que manda o contrato para o quadro 4.2. */
function irsTaxa(c,ano){
  const a=anoIrs(ano),T=irsAno(a).taxas;
  if(c&&fiscoDe(c).finalidade==='nh')return {taxa:T.naoHabitacional,motivo:'nh',reducao:null};
  const r=irsReducao(c,a),m=T.rendaModerada,renda=Number(c&&c.rent)||0;
  let out={taxa:T.habitacional,motivo:'base',reducao:r};
  if(r&&r.taxa<out.taxa)out={taxa:r.taxa,motivo:'duracao',reducao:r};
  if(m&&a<=m.ate&&renda>0&&renda<=m.limiteMensal&&m.taxa<out.taxa)out={taxa:m.taxa,motivo:'moderada',reducao:r};
  return out;
}
/* A taxa estimada de um contrato num ano (irsTaxa), só o número.
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: a taxa em percentagem (número). */
function irsRate(c,ano){return irsTaxa(c,ano).taxa}
/* Porque é que a taxa estimada é a que é, para o meio de uma frase
   («estimado: renda moderada»).
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: o texto curto. */
function irsTaxaPorque(c,ano){
  const t=irsTaxa(c,ano);
  return t.motivo==='nh'?'não habitacional':t.motivo==='duracao'?'pela duração':t.motivo==='moderada'?'renda moderada':'taxa base';
}
/* As taxas especiais de um ano numa frase, para a dica do formulário do
   contrato: a da habitação e a do resto, os escalões da duração do regime em
   vigor e, quando a versão a tem, a das rendas moderadas — tudo lido da
   versão, nada escrito à mão.
   Recebe: ano (opcional) — o ano dos rendimentos.
   Devolve: o texto (sem HTML). */
function irsTaxasTexto(ano){
  const a=anoIrs(ano),T=irsAno(a).taxas,atual=(T.duracao||[]).find(r=>!r.ate);
  const es=atual?atual.escaloes.slice().sort((x,y)=>x.meses-y.meses):[];
  let t='A taxa especial de IRS sobre rendas de habitação é '+dec(T.habitacional)+' % ('+dec(T.naoHabitacional)+' % no não habitacional)';
  if(es.length)t+=', e desce na habitação permanente pela duração: '+es.map(e=>dec(e.taxa)+' % com '+Math.round(e.meses/12)+' anos').join(', ')+' ou mais';
  t+='.';
  const m=T.rendaModerada;
  if(m&&a<=m.ate)t+=' Até '+m.ate+', as rendas de habitação até '+euro(m.limiteMensal)+' por mês pagam '+dec(m.taxa)+' %, se a duração não der menos.';
  return t;
}
/* a taxa de imposto que se aplica à renda de um contrato num ano: a que foi escrita; em
   branco (ou 0, que é como o formulário guarda o branco) a estimativa (irsRate)
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: a taxa em percentagem (número). */
const taxRateOf=(c,ano)=>Number(c.taxRate)>0?Number(c.taxRate):irsRate(c,ano);
/* A renda mensal de um contrato depois do imposto, à taxa que se lhe aplica
   (taxRateOf).
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: euros (número). */
const netRent=(c,ano)=>c.rent*(1-taxRateOf(c,ano)/100);
/* A renda líquida mensal dos contratos em vigor de um imóvel, no ano corrente.
   Recebe: p — o imóvel.
   Devolve: euros (número). */
const netRentOf=p=>sum(activeContracts(p.id).map(c=>netRent(c)));

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
/* Uma data por extenso sem o ano, como se diz um prazo da AT («1 de abril»,
   «30 de junho»): o nome do mês vem do pt-PT do aparelho. Em hora local.
   Recebe: iso — 'AAAA-MM-DD' (aguenta vazio).
   Devolve: o texto, ou '' sem data válida. */
function irsDiaMes(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));if(!m)return '';
  return new Date(Number(m[1]),Number(m[2])-1,Number(m[3])).toLocaleDateString('pt-PT',{day:'numeric',month:'long'});
}
/* o código da natureza das rendas nos quadros 4.1 e 4.2 do Anexo F, o da versão do ano
   (desde os rendimentos de 2023: 07 arrendamento habitacional, 06 não habitacional); sem
   finalidade assume-se habitação, como na taxa
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: o código (string). */
const naturezaIrs=(c,ano)=>{const n=irsAno(ano).naturezas;return fiscoDe(c).finalidade==='nh'?n.naoHabitacional:n.habitacional};
