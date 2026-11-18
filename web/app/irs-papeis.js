/* ================= IRS · PAPÉIS =================
   Os papéis que o IRS dá às coisas da app, e que não mudam de ano para ano: a
   coluna do Anexo F onde um gasto cai (irsMapa, irsColunaDe, irsColunaNome),
   o papel de cada receita na Declaração (irsReceitaDe) e a devolução de uma
   renda (irsDevolucaoDeRenda), o que é uma renda fora da Declaração e a renda
   ilíquida (ehRenda, rendaBruta), o NIF (o dígito de controlo, nifValido, e a
   pessoa coletiva, nifColetivo, e o particular, nifParticular) e a situação de quem declara em cada ano
   (irsSituacao). Partiu-se do irs.js (KAN-125), que fica com o motor das
   taxas e o bloco fiscal do contrato. São da base pelas mesmas razões: as
   cópias, as definições, os contratos e a Declaração também os usam.

   As categorias que o IRS lê reconhecem-se pelo identificador fixo
   (dados.js:catIrsId, CATS_DO_IRS — rev. 5 §5.1, D19): o nome pode mudar à
   vontade. Os Empréstimos recebidos, as Outras receitas e os Subsídios e
   apoios não têm id e leem-se pelo nome; o ehRenda e o isPassivo, que servem
   tudo o que não é a Declaração (o cursor da renda planeada, o ano automático,
   os totais), continuam pelo nome. */

/* o mapa categoria → coluna do Anexo F em vigor: o das definições, ou o de origem
   Devolve: o mapa (objeto {'Categoria' ou 'Categoria / Sub': id de IRS_MAPA_VALORES}). */
const irsMapa=()=>(db.settings&&db.settings.irsMapa)||IRS_MAPA0;
/* As despesas das categorias do IRS em que o «Fora dos totais» não tira nada do
   Anexo F (plano §1.5, D19): o IMI e o imposto do selo, que têm coluna própria, e
   tudo o que está nas Devoluções ao inquilino (pelo id da categoria). O AIMI já é
   «não dedutível» fixo. Tirá-los dos totais é uma escolha de leitura dos gráficos,
   não da lei. */
const IRS_DESPESAS_SEMPRE=['impostos/imi','impostos/imposto-do-selo'];
/* A coluna do Anexo F onde um movimento cai, e porquê. Só as despesas têm coluna: uma
   prestação, uma dívida ou um acerto nunca são dedutíveis (os juros são gastos
   financeiros). O AIMI (Impostos › AIMI, pelo id) é sempre «não dedutível», à frente
   de tudo: a lei tira-o dos gastos (CIRS art. 41.º n.º 1) e ele vai ao quadro 9 —
   contá-lo também como gasto deduzia-o duas vezes (D66; só o AIMI: no mobiliário e nos
   eletrodomésticos a escolha do movimento manda). Uma despesa fora dos totais
   (categoria excluída nas definições) também não conta, salvo o IMI, o selo e as
   Devoluções ao inquilino (IRS_DESPESAS_SEMPRE). Depois manda o que foi escolhido no
   próprio movimento, depois a subcategoria, depois a categoria (o mapa, que pode dizer
   'confirmar'); o que não tem regra fica a confirmar, e a origem di-lo — na dúvida a
   app não deduz, e o resumo lista a despesa para a pessoa escolher (D61).
   Recebe: t — o movimento.
   Devolve: {col, origem} — col é um id de IRS_COLUNAS ou 'confirmar'; origem é 'tipo',
   'lei', 'excluido', 'movimento', 'sub', 'categoria' ou 'omissao'. */
function irsColunaDe(t){
  if(!t||t.kind!=='expense')return {col:'nao',origem:'tipo'};
  const cat=String(t.category||'').trim(),sub=String(t.sub||'').trim();
  const sid=sub?catIrsId('cats',cat,sub):'',cid=catIrsId('cats',cat);
  if(sid==='impostos/aimi')return {col:'nao',origem:'lei'};
  if(!countsInTotals(t)&&cid!=='devolucoes'&&IRS_DESPESAS_SEMPRE.indexOf(sid)<0)return {col:'nao',origem:'excluido'};
  if(t.irsCol&&IRS_COLUNAS.some(c=>c[0]===t.irsCol))return {col:t.irsCol,origem:'movimento'};
  /* só valores que o mapa aceita: um mapa por normalizar (ou um nome como
     'constructor', que um objeto herda) não decide nada */
  const m=irsMapa(),ok=k=>Object.prototype.hasOwnProperty.call(m,k)&&IRS_MAPA_VALORES.some(c=>c[0]===m[k]);
  if(cat&&sub&&ok(cat+' / '+sub))return {col:m[cat+' / '+sub],origem:'sub'};
  if(cat&&ok(cat))return {col:m[cat],origem:'categoria'};
  return {col:'confirmar',origem:'omissao'};
}
/* o rótulo de uma coluna do Anexo F, e o da coluna 'confirmar' (a despesa não conta
   até a pessoa escolher a coluna) — é o que o formulário do movimento diz em «Pela
   categoria: …» e o que as cópias escrevem
   Recebe: col — o id (de IRS_COLUNAS, ou 'confirmar').
   Devolve: o rótulo (string), ou '' se não existir. */
const irsColunaNome=col=>{if(col==='confirmar')return 'A confirmar';const c=IRS_COLUNAS.find(x=>x[0]===col);return c?c[1]:''};
/* O papel de uma receita na Declaração (plano §1.5, D03, D05, D19, D20, D21, D51):
   · Rendas (pelo id), qualquer que seja o «Fora dos totais» (D19) — a Caução é
     'caucao' (renda do ano em que se recebe, Ofício-Circulado 20256, D03), a
     Indemnização 'indemnizacao' (natureza 05, art. 8.º n.º 2 g), D21), as Outras
     receitas prediais 'outra' (natureza 02, D51); a Renda mensal, a Renda em atraso,
     sem subcategoria ou uma subcategoria da pessoa, 'renda'.
   · Fora das Rendas o «Fora dos totais» vale (o countsInTotals, com o isPassivo dos
     Empréstimos recebidos): uma receita fora dos totais é 'fora'.
   · Reembolsos (pelo id) — do inquilino, e do condomínio com contrato ligado: 'renda'
     (art. 8.º n.º 2 a), com recibo); do condomínio sem contrato e do seguro:
     'reembolsoGasto' (abate ao gasto reembolsado; sem aviso a pedir o contrato, Q7);
     do Estado: 'fora'; sem subcategoria ou uma da pessoa: 'porClassificar'.
   · Empréstimos recebidos (pelo nome): 'fora'.
   · Sem categoria: 'renda' com contrato (como hoje), 'porClassificar' sem ele.
   · Outras receitas, Subsídios e apoios e as categorias da pessoa: 'porClassificar'.
   A natureza de uma renda ou de uma caução é a da linha do contrato
   (irs.js:naturezaIrs, no ano da data), null sem contrato; a da indemnização e a das
   outras receitas prediais vêm da versão do ano (irs.js:irsNaturezasDoAno); nos outros
   papéis, null.
   Recebe: t — o movimento.
   Devolve: {papel, natureza} — papel 'renda', 'caucao', 'indemnizacao', 'outra',
   'reembolsoGasto', 'fora', 'porClassificar', ou '' quando não é uma receita;
   natureza um código ('07', '05'…) ou null. */
function irsReceitaDe(t){
  if(!t||t.kind!=='income')return {papel:'',natureza:null};
  const cat=String(t.category||'').trim(),sub=String(t.sub||'').trim();
  const sid=sub?catIrsId('catsIn',cat,sub):'',cid=catIrsId('catsIn',cat),temCt=!!t.contractId;
  const ano=anoIrs(String(t.date||'').slice(0,4));
  const papel=(p,n)=>({papel:p,natureza:n===undefined?null:n});
  /* a natureza da linha do contrato a que a receita está ligada */
  const daLinha=()=>{const c=temCt?(db.contracts||[]).find(x=>x&&x.id===t.contractId):null;return c?naturezaIrs(c,ano):null};
  const daVersao=k=>{const n=irsNaturezasDoAno(ano);return n[k]||null};
  if(cid==='rendas'){
    if(sid==='rendas/caucao')return papel('caucao',daLinha());
    if(sid==='rendas/indemnizacao')return papel('indemnizacao',daVersao('indemnizacao'));
    if(sid==='rendas/outras-receitas-prediais')return papel('outra',daVersao('outras'));
    return papel('renda',daLinha());
  }
  if(!countsInTotals(t)||cat==='Empréstimos recebidos')return papel('fora');
  if(cid==='reembolsos'){
    if(sid==='reembolsos/inquilino')return papel('renda',daLinha());
    if(sid==='reembolsos/condominio')return temCt?papel('renda',daLinha()):papel('reembolsoGasto');
    if(sid==='reembolsos/seguro')return papel('reembolsoGasto');
    if(sid==='reembolsos/estado')return papel('fora');
    return papel('porClassificar');
  }
  if(!cat&&temCt)return papel('renda',daLinha());
  return papel('porClassificar');
}
/* Uma despesa «Devoluções ao inquilino › Devolução de renda» (pelo id, D53): abate às
   rendas da linha do contrato, e não é gasto. Vale também fora dos totais.
   Recebe: t — o movimento.
   Devolve: true ou false. */
function irsDevolucaoDeRenda(t){
  return !!t&&t.kind==='expense'&&!!String(t.sub||'').trim()&&catIrsId('cats',t.category,t.sub)==='devolucoes/renda';
}
/* É uma renda para tudo o que não é a Declaração (o cursor dos planeados, o ano
   automático, os totais)? Uma receita que conta nos totais, da categoria «Rendas» — ou
   sem categoria mas presa a um contrato. A caução e os empréstimos ficam de fora
   (isPassivo), e um reembolso ou um subsídio não são rendas. Lê pelo nome, de propósito
   (plano §1.5): a Declaração lê pelo papel (irsReceitaDe).
   Recebe: t — o movimento.
   Devolve: true se é renda. */
const ehRenda=t=>!!t&&t.kind==='income'&&countsInTotals(t)&&(t.category==='Rendas'||(!t.category&&!!t.contractId));
/* a renda ilíquida de um movimento: o que entrou mais o que o inquilino reteve na fonte
   Recebe: t — o movimento.
   Devolve: o valor bruto em euros (número). */
const rendaBruta=t=>(Number(t.amount)||0)+(Number(t.retencao)||0);
/* O NIF tem dígito de controlo (mod 11) e um primeiro dígito com sentido: um erro de dedo
   fica à vista antes de ir para o contrato em PDF ou para o Anexo F. O 4 só com o 5 a
   seguir: o 45 é o das pessoas singulares não residentes (DL 14/2013, art. 4.º n.º 3;
   D59); nenhum começa por 0.
   Recebe: nif — o NIF como foi escrito (string ou número; espaços são ignorados).
   Devolve: null se está vazio; true se é válido; false se não é. */
function nifValido(nif){
  const s=String(nif==null?'':nif).replace(/\s/g,'');
  if(!s)return null;
  if(!/^\d{9}$/.test(s)||('12356789'.indexOf(s[0])<0&&s.slice(0,2)!=='45'))return false;
  let soma=0;for(let i=0;i<8;i++)soma+=Number(s[i])*(9-i);
  const r=soma%11,dc=r<2?0:11-r;
  return dc===Number(s[8]);
}
/* O NIF é de uma pessoa coletiva ou de outra entidade que não uma pessoa? Pelo
   primeiro dígito: 5 (pessoas coletivas), 6 (administração pública), 7 (heranças
   indivisas, não residentes coletivos, fundos de investimento, atribuições
   oficiosas) e 9 (condomínios, sociedades irregulares e civis, não residentes sem
   estabelecimento estável). Os 1, 2 e 3 são de pessoas singulares, o 45 de não
   residentes singulares e o 8 (empresário em nome individual) já não se atribui
   (DL 14/2013 art. 4.º; INCERTO o detalhe dos 7x e 9x, que a AT dá no manual do
   início de atividade e não na lei — por isso o 7 e o 9 inteiros). É um sinal para
   perguntar (D47, D58), nunca por si só o critério de nada, e não diz se o NIF é
   válido (nifValido).
   Recebe: nif — o NIF como foi escrito (string ou número; espaços são ignorados).
   Devolve: true se tem nove dígitos e começa por 5, 6, 7 ou 9. */
function nifColetivo(nif){
  const s=String(nif==null?'':nif).replace(/\s/g,'');
  return /^\d{9}$/.test(s)&&'5679'.indexOf(s[0])>-1;
}
/* O NIF é de uma pessoa singular residente? Pelo primeiro dígito: 1, 2 ou 3 (DL
   14/2013 art. 4.º). Serve para perguntar pelas retenções de um inquilino particular
   (D116): só retém quem tem, ou devia ter, contabilidade organizada (CIRS art. 101.º
   n.º 1), e um empresário em nome individual com contabilidade também tem um NIF
   destes — por isso é um «confirma», nunca um bloqueio. O 45 (não residentes
   singulares) fica de fora, como no contrato de interfaces. Não diz se o NIF é
   válido (nifValido).
   Recebe: nif — o NIF como foi escrito (string ou número; espaços são ignorados).
   Devolve: true se tem nove dígitos e começa por 1, 2 ou 3. */
function nifParticular(nif){
  const s=String(nif==null?'':nif).replace(/\s/g,'');
  return /^\d{9}$/.test(s)&&'123'.indexOf(s[0])>-1;
}
/* A situação de quem declara num ano dos rendimentos (D30, D71, D91): a de
   settings.irs.porAno desse ano; sem ela, a do ano anterior mais perto (a situação
   herda-se até mudar); sem nenhuma, a dos campos de topo antigos, lida sem gravar.
   O cônjuge (conjugeId) é separado da minha letra no Rosto (minhaLetra): o cônjuge
   leva a outra (letraConjuge), e as letras são só rótulos (D30). Nos campos antigos,
   o cônjuge é o único proprietário, além de mim, marcado B quando eu não sou B; se eu
   me marquei B, ou há mais do que um marcado B, fica '' — não se adivinha. Os números
   da demonstração do AIMI (aimi) são do próprio ano e nunca se herdam: a liquidação
   de um ano não é a do seguinte. A conjunta liga-se e desliga-se aqui; quem a lê
   decide se o cônjuge entra (só com conjunta).
   Recebe: ano — o ano dos rendimentos; eu (opcional) — o id de quem declara (só
   serve aos campos antigos: sem ele não há cônjuge).
   Devolve: {conjunta, conjugeId, minhaLetra, letraConjuge, dispensaRecibos,
   aimi:{total, valorTributavel}, deAno} — conjugeId '' sem cônjuge; minhaLetra 'A'
   ou 'B'; letraConjuge '' sem cônjuge; deAno o ano de onde a situação veio ('' dos
   campos antigos). Objeto novo. */
function irsSituacao(ano,eu){
  const d=normIrsDefs(db&&db.settings&&db.settings.irs),A=String(anoIrs(ano)),pa=d.porAno;
  const k=Object.keys(pa).filter(y=>y<=A).sort().pop()||'';
  const me=String(eu||'');
  let conjunta,conjugeId,minhaLetra,dispensaRecibos,aimi={total:null,valorTributavel:null};
  if(k){
    const e=pa[k];
    conjunta=e.conjunta;minhaLetra=e.minhaLetra;dispensaRecibos=e.dispensaRecibos;
    conjugeId=e.conjugeId&&e.conjugeId!==me?e.conjugeId:'';
    if(k===A)aimi={total:e.aimi.total,valorTributavel:e.aimi.valorTributavel};
  }else{
    conjunta=d.conjunta;dispensaRecibos=d.dispensaRecibos;
    minhaLetra=me&&d.titulares[me]==='B'?'B':'A';
    const bs=me&&minhaLetra!=='B'?(db.owners||[]).filter(o=>o&&o.id&&o.id!==me&&d.titulares[o.id]==='B'):[];
    conjugeId=bs.length===1?bs[0].id:'';
  }
  return {conjunta:conjunta,conjugeId:conjugeId,minhaLetra:minhaLetra,
    letraConjuge:conjugeId?(minhaLetra==='B'?'A':'B'):'',dispensaRecibos:dispensaRecibos,aimi:aimi,deAno:k};
}
