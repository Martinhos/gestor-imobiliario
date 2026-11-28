/* ================= MODELOS DE DADOS · OS CENÁRIOS DE BASE =================
   Os modelos de dados do Lab (KAN-167) que vêm escritos em código: cada um é
   {id, nome, descricao, construir()}, e construir() devolve os dados de uma
   conta de teste já normalizados (os norm* do dados.js, os mesmos do seed):
   {owners, properties, tenants, contracts, transactions, templates,
   recurring}, sem tocar na base. Quem os usa é o Lab (cloud/modelos.js e o
   servidor, worker/src/rotas/modelos.js), que troca os dados da conta de teste
   pelos do cenário; o «Exemplo completo» é o mesmo que o «Carregar exemplo»
   (arranque.js:dadosDoExemplo).
   As datas geram-se ao construir, contadas de hoje e do ano corrente (YEAR),
   como no exemplo (decisão do Martinho, 2026-11-26): um cenário do IRS põe o
   que promete no ano que a Declaração abre sozinha (cenAnoDaDeclaracao — o
   fisco-resumo.js:fiscoAnoAuto), e só com movimentos até hoje. As datas da lei
   não andam: o ex-alojamento local é dos contratos de 2023 e 2024, a renda
   antiga dos de antes do RAU (1990).
   Os planeados automáticos (as rendas dos contratos, as prestações) não vêm:
   nascem dos Planeados (planeados.js:syncAllContractRecs e as irmãs), que
   quem aplica o cenário corre a seguir, como o seed.
   A proprietária é a da conta (arranque.js:donoDoExemplo): com sessão, a
   ficha da conta, com os campos vazios preenchidos pelos do exemplo. Os NIF
   são inventados e passam o dígito de controlo (irs-papeis.js:nifValido),
   como os do exemplo; nunca são de pessoas reais.
   Cada cenário do IRS responde a um subticket que pedia dados para testar
   (os comentários do Martinho de 2026-11-26): o prejuízo (KAN-126-3), as
   isenções 6H e 6F (KAN-126-7), a redução pela duração (KAN-127-3), a
   redução que terminou no ano (KAN-127-11) e a renda de dezembro por
   confirmar (KAN-127-4). Os testes (testes/modelos-cenarios.test.js) passam
   cada um no motor do IRS e confirmam o que a descrição promete.
   Os de 2026-11-27 têm base: false (não nascem a toda a gente: o servidor só
   semeia os outros, worker/src/rotas/modelos.js:semearBase) e criam-se para
   quem os pediu (scripts/modelos.mjs criar): a tributação conjunta
   (KAN-153-1, KAN-129-6), o imóvel em França (KAN-129-2), os donos por
   confirmar (KAN-128-6, KAN-154-4), o bloco fiscal do contrato (KAN-128-3),
   as obras antes do início (KAN-128-2), os encargos do inquilino (KAN-129-3),
   a renda paga em parte (KAN-129-4), a categoria B (KAN-129-5) e o imóvel por
   quartos (KAN-152-1).
   Cada cenário do IRS traz a situação fiscal do ano (settings, cenSituacao):
   quem o aplica junta-a às definições da conta, e por isso a conjunta de um
   não fica ligada no seguinte. */

/* O ano da Declaração que a página abre sem nenhum escolhido
   (fisco-resumo.js:fiscoAnoAuto): até junho o ano anterior — os cenários põem
   lá as rendas, que é o que o automático pede —, depois de junho o corrente.
   Devolve: o ano (número). */
function cenAnoDaDeclaracao(){return Number(today().slice(5,7))<=6?YEAR-1:YEAR}
/* Um dia, por extenso.
   Recebe: y — o ano; m — o mês (1 a 12); d — o dia.
   Devolve: 'AAAA-MM-DD'. */
function cenDia(y,m,d){return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
/* A véspera de um dia (o termo de um contrato de N anos é a véspera do mesmo
   dia N anos depois).
   Recebe: iso — 'AAAA-MM-DD'.
   Devolve: 'AAAA-MM-DD'. */
function cenVespera(iso){
  const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()-1);
  return cenDia(d.getFullYear(),d.getMonth()+1,d.getDate());
}
/* Só os movimentos que já aconteceram: um cenário não regista dinheiro
   depois de hoje.
   Recebe: txs — os movimentos.
   Devolve: os de data até hoje (array novo). */
function cenAteHoje(txs){const h=today();return txs.filter(t=>String(t.date||'')<=h)}
/* As rendas de um contrato num ano, uma por mês, no dia de pagamento, com o
   mês a que respeitam e o recibo eletrónico emitido; só as dos meses em que o
   contrato estava em vigor (do início ao fim que se lhe der) e até hoje.
   Recebe: c — o contrato; nome — a descrição; y — o ano; ate (opcional) —
   'AAAA-MM-DD', o último dia em que houve renda (o fim do contrato).
   Devolve: os movimentos (normTx). */
function cenRendas(c,nome,y,ate){
  const out=[],dia=Math.min(28,Math.max(1,Number(c.payDay)||1));
  for(let m=1;m<=12;m++){
    const d=cenDia(y,m,dia),mes=d.slice(0,7);
    if(String(c.start||'').slice(0,7)>mes||(ate&&ate.slice(0,7)<mes))continue;
    out.push(normTx({kind:'income',label:nome,amount:c.rent,date:d,propertyId:c.propertyId,contractId:c.id,
      category:'Rendas',sub:'Renda mensal',periodo:mes,recibo:true}));
  }
  return cenAteHoje(out);
}
/* O imposto do selo de um contrato (10 % de uma renda), pago com o Modelo 2
   no mês seguinte ao início: sem ele, a Declaração lembra-o — e os cenários
   só querem os avisos que prometem.
   Recebe: c — o contrato; o — a proprietária.
   Devolve: o movimento (normTx), ou nenhum se a data ainda não chegou ([]). */
function cenSelo(c,o){
  const s=String(c.start||''),y=Number(s.slice(0,4)),m=Number(s.slice(5,7));
  const d=m===12?cenDia(y+1,1,20):cenDia(y,m+1,20);
  return cenAteHoje([normTx({kind:'expense',label:'Imposto do selo do contrato',amount:Math.round(c.rent*10)/100,date:d,
    propertyId:c.propertyId,category:'Impostos',sub:'Imposto do selo',paidBy:o.id,notes:'Pago com o Modelo 2.'})]);
}
/* Um imóvel arrendado da proprietária, com o que o Anexo F pede (distrito,
   código da freguesia, tipo, artigo e fração) e sem donos fora da app,
   confirmado.
   Recebe: o — a proprietária; campos — o resto do imóvel.
   Devolve: o imóvel (normProp). */
function cenImovel(o,campos){
  return normProp(Object.assign({use:'investimento',rentalMode:'inteiro',ownerIds:[o.id],comproprietariosFora:[],tipoPredio:'U'},campos));
}
/* Um contrato de habitação permanente, declarado à AT com o número que ela
   deu, renovável; o bloco fiscal junta-se por cima.
   Recebe: campos — o contrato; fisco — o que muda no bloco fiscal.
   Devolve: o contrato (normContract). */
function cenContrato(campos,fisco){
  return normContract(Object.assign({},campos,{fisco:Object.assign({estado:'declarado',finalidade:'hp',renovavel:true},fisco)}));
}
/* Os dados de um cenário, com as coleções todas (as que não vêm, vazias).
   Recebe: o — a proprietária (null: nenhuma ficha); partes — as coleções (e,
   num cenário do IRS, settings: a situação fiscal do ano, cenSituacao).
   Devolve: {owners, properties, tenants, contracts, transactions, templates,
   recurring} e, quando veio, settings. */
function cenDados(o,partes){
  return Object.assign({owners:o?[o]:[],properties:[],tenants:[],contracts:[],transactions:[],templates:[],recurring:[]},partes);
}
/* A situação fiscal do ano da Declaração («A tua situação fiscal em AAAA»,
   db.settings.irs.porAno — irs-papeis.js:irsSituacao), por cima das
   escolhas do IRS que a conta já tem. Quem aplica o cenário junta as
   definições que ele traz às da conta (cloud/modelos.js:mdlEntidadesDoCenario):
   por isso cada cenário do IRS traz a sua, e um cenário de tributação conjunta
   não deixa a conjunta ligada no cenário que se usar a seguir. Do ano só muda
   a conjunta, o cônjuge e os bens comuns; a dispensa dos recibos e os números
   do AIMI ficam como estavam.
   Recebe: T — o ano; conjunta (opcional) — {bensComuns} para a tributação
   conjunta com os bens comuns do casal; sem ele, a separada.
   Devolve: {irs} — as escolhas do IRS inteiras (normIrsDefs), para as definições. */
function cenSituacao(T,conjunta){
  const irs=normIrsDefs(db.settings&&db.settings.irs),A=String(T),ja=irs.porAno[A]||{};
  const porAno=Object.assign({},irs.porAno,{[A]:Object.assign({minhaLetra:'A',dispensaRecibos:false},ja,
    {conjunta:!!conjunta,conjugeId:'',bensComuns:!!(conjunta&&conjunta.bensComuns)})});
  return {irs:normIrsDefs(Object.assign({},irs,{porAno:porAno}))};
}
/* O mês que foi há n meses (0 é o de hoje), para os cenários que contam de
   hoje e não do ano da Declaração.
   Recebe: n — quantos meses para trás.
   Devolve: {y, m} — o ano e o mês (1 a 12). */
function cenMesAtras(n){
  const h=today();let y=Number(h.slice(0,4)),m=Number(h.slice(5,7))-n;
  while(m<1){m+=12;y--}
  return {y:y,m:m};
}

/* «Exemplo completo»: o do «Carregar exemplo» (arranque.js:dadosDoExemplo).
   Chama-o na hora, e não guarda a função: o arranque carrega depois deste
   ficheiro, e na altura em que a lista nasce ela ainda não existe.
   Devolve: os dados do exemplo ({owners, properties, …}). */
function cenExemplo(){return dadosDoExemplo()}
/* «Vazio»: a conta sem dados. A ficha da conta fica como está (sem os campos
   do exemplo); sem sessão não há ficha nenhuma.
   Devolve: os dados (cenDados), todos vazios menos a ficha da conta. */
function cenVazio(){
  const eu=meuId(),ja=eu?(db.owners||[]).find(x=>x&&x.id===eu):null;
  let o=null;
  if(eu){o=ja?Object.assign({},ja):normPerson({});o.id=eu;const conta=(window.CW&&window.CW.user)||{};
    if(!o.name)o.name=conta.name||'';if(!o.email)o.email=conta.email||''}
  return cenDados(o,{});
}
/* «Ano com prejuízo» (KAN-126-3): um T1 arrendado o ano inteiro, em que a
   substituição da canalização (conservação, depois do início do arrendamento)
   passa as rendas do ano da Declaração. O rendimento líquido fica negativo, o
   imposto estimado fica em 0 € (nunca negativo) e o KPI diz «prejuízo a
   reportar» (CIRS art. 55.º: abate às rendas dos seis anos seguintes).
   Devolve: os dados (cenDados). */
function cenPrejuizo(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo();
  const p=cenImovel(o,{name:'T1 Campo de Ourique',address:'Campo de Ourique, Lisboa',value:245000,purchase:198000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T1',vpt:61000,matrix:'3127',fraction:'B',purchaseDate:cenDia(T-5,3,14)});
  const t=normPerson({name:'Gonçalo Pires',phone:'912 000 011',nif:'220000042',gender:'m',marital:'Solteiro(a)'});
  const c=cenContrato({propertyId:p.id,tenantIds:[t.id],rent:650,deposit:1300,payDay:5,start:cenDia(T-1,9,1)},
    {numero:'1102233',celebracao:cenDia(T-1,8,22)});
  const txs=cenRendas(c,'Renda T1 Campo de Ourique',T);
  for(let m=1;m<=12;m++)txs.push(...cenAteHoje([normTx({kind:'expense',label:'Quota do condomínio',amount:40,date:cenDia(T,m,5),propertyId:p.id,
    category:'Condomínio',sub:'Quota mensal',paidBy:o.id})]));
  txs.push(...cenAteHoje([
    normTx({kind:'expense',label:'Substituição da canalização',amount:9500,date:cenDia(T,3,14),propertyId:p.id,
      category:'Obras e benfeitorias',sub:'Canalização',paidBy:o.id,notes:'Rotura na coluna da cozinha: canos novos na casa toda.'}),
    normTx({kind:'expense',label:'IMI '+(T-1),amount:260,date:cenDia(T,5,20),propertyId:p.id,category:'Impostos',sub:'IMI',paidBy:o.id})]));
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:txs,settings:cenSituacao(T)});
}
/* «Isenções 6H e 6F» (KAN-126-7): três contratos de habitação permanente,
   declarados, sem isenção escolhida — para a escolher no formulário. O de
   2024 (um ex-alojamento local) pode ter a do 6F (EBF art. 74.º-A: celebrado
   entre 1/1/2023 e 31/12/2024), o de 1985 a renda antiga do 6H (EBF art.
   46.º-A: celebrado antes do RAU), e o de 2025 nenhuma das duas
   (contrato.js:ctIsencoesOferecidas só as mostra quando as datas servem).
   E mais dois com a isenção já escolhida e confirmada (KAN-126-10: ver os
   dois na Declaração, no 6F e no 6H): um ex-alojamento local de 2023 com a
   do 6F e o AL registado a 31/12/2022, e uma renda antiga de 1988 com a do
   6H e o contrato sujeito ao NRAU.
   Devolve: os dados (cenDados). */
function cenIsencoes(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo();
  const pA=cenImovel(o,{name:'T2 Campo de Ourique',address:'Campo de Ourique, Lisboa',value:330000,purchase:262000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T2',vpt:105000,matrix:'2214',fraction:'C',purchaseDate:'2017-06-12',
    notes:'Esteve em alojamento local até fevereiro de 2024.'});
  const pB=cenImovel(o,{name:'T1 Solum',address:'Solum, Coimbra',value:160000,purchase:9500,
    distrito:'Coimbra',freguesiaCodigo:'060316',tipologia:'T1',vpt:38000,matrix:'987',fraction:'A',purchaseDate:'1979-04-10'});
  const pC=cenImovel(o,{name:'T2 Sintra',address:'Sintra',value:285000,purchase:231000,
    distrito:'Lisboa',freguesiaCodigo:'111124',tipologia:'T2',vpt:92000,matrix:'5520',fraction:'D',purchaseDate:'2019-09-30'});
  const tA=normPerson({name:'Helena Duarte',phone:'912 000 021',nif:'220000050',gender:'f',marital:'Solteiro(a)'});
  const tB=normPerson({name:'Albertina Ferreira',phone:'912 000 022',nif:'190000015',gender:'f',marital:'Viúvo(a)'});
  const tC=normPerson({name:'Rui Carvalho',phone:'912 000 023',nif:'220000069',gender:'m',marital:'Casado(a)'});
  const cA=cenContrato({propertyId:pA.id,tenantIds:[tA.id],rent:980,deposit:1960,payDay:1,start:'2024-03-01',
    notes:'Ex-alojamento local: o registo do AL estava ativo a 31/12/2022.'},{numero:'1215560',celebracao:'2024-02-20'});
  const cB=cenContrato({propertyId:pB.id,tenantIds:[tB.id],rent:215,payDay:8,start:'1985-06-01',
    notes:'Contrato anterior ao RAU; a inquilina tem mais de 65 anos.'},{numero:'1004129',celebracao:'1985-05-15',atualizacao2023:'nao'});
  const cC=cenContrato({propertyId:pC.id,tenantIds:[tC.id],rent:1050,deposit:2100,payDay:1,start:'2025-04-01'},
    {numero:'1236641',celebracao:'2025-03-20'});
  const pD=cenImovel(o,{name:'T1 Graça',address:'Graça, Lisboa',value:295000,purchase:214000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T1',vpt:84000,matrix:'3390',fraction:'B',purchaseDate:'2018-05-22',
    notes:'Esteve em alojamento local até dezembro de 2022.'});
  const pE=cenImovel(o,{name:'T2 Baixa de Coimbra',address:'Baixa, Coimbra',value:142000,purchase:12500,
    distrito:'Coimbra',freguesiaCodigo:'060316',tipologia:'T2',vpt:41000,matrix:'1544',fraction:'C',purchaseDate:'1982-11-03'});
  const tD=normPerson({name:'Daniel Fonseca',phone:'912 000 024',nif:'220000107',gender:'m',marital:'Solteiro(a)'});
  const tE=normPerson({name:'Manuel Teixeira',phone:'912 000 025',nif:'190000023',gender:'m',marital:'Viúvo(a)'});
  const cD=cenContrato({propertyId:pD.id,tenantIds:[tD.id],rent:890,deposit:1780,payDay:1,start:'2023-04-01',
    notes:'Ex-alojamento local: o registo do AL estava ativo a 31/12/2022.'},
    {numero:'1188431',celebracao:'2023-03-24',isencao:'al',alRegistado2022:true});
  const cE=cenContrato({propertyId:pE.id,tenantIds:[tE.id],rent:180,payDay:8,start:'1988-02-01',
    notes:'Contrato anterior ao RAU; o inquilino tem mais de 65 anos.'},
    {numero:'1003377',celebracao:'1988-01-12',atualizacao2023:'nao',isencao:'prerau',nrau3536:true});
  const txs=[].concat(cenRendas(cA,'Renda T2 Campo de Ourique',T),cenRendas(cB,'Renda T1 Solum',T),cenRendas(cC,'Renda T2 Sintra',T),
    cenRendas(cD,'Renda T1 Graça',T),cenRendas(cE,'Renda T2 Baixa de Coimbra',T),cenSelo(cA,o),cenSelo(cC,o));
  return cenDados(o,{properties:[pA,pB,pC,pD,pE],tenants:[tA,tB,tC,tD,tE],contracts:[cA,cB,cC,cD,cE],transactions:txs,settings:cenSituacao(T)});
}
/* «Contrato com redução» (KAN-127-3): um contrato de habitação permanente de
   5 anos, celebrado no ano da Declaração, com a redução pela duração (CIRS
   art. 72.º n.º 3, regime de 2023: 15 % em vez dos 25 %; nas rendas de 2026
   os 10 % das rendas moderadas ficam abaixo e ganham), e por isso no quadro
   4.2 do Anexo F. A comunicação da duração às Finanças ainda não está marcada, e
   a renda está dentro do limite do concelho (o 4.2C, já indicado).
   Devolve: os dados (cenDados). */
function cenReducao(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo();
  const p=cenImovel(o,{name:'T2 Solum',address:'Solum, Coimbra',value:198000,purchase:151000,
    distrito:'Coimbra',freguesiaCodigo:'060316',tipologia:'T2',vpt:69000,matrix:'4410',fraction:'E',purchaseDate:cenDia(T-3,10,2)});
  const t=normPerson({name:'Inês Moura',phone:'912 000 031',email:'ines@exemplo.pt',nif:'220000077',gender:'f',marital:'Solteiro(a)'});
  const ini=cenDia(T,2,1);
  const c=cenContrato({propertyId:p.id,tenantIds:[t.id],rent:800,deposit:1600,payDay:1,start:ini,end:cenVespera(cenDia(T+5,2,1))},
    {numero:'1240318',celebracao:cenDia(T,1,22),rendaAcimaDoLimite:false});
  const txs=[].concat(cenRendas(c,'Renda T2 Solum',T),cenSelo(c,o));
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:txs,settings:cenSituacao(T)});
}
/* «Redução terminada» (KAN-127-11): dois contratos de habitação permanente
   de 5 anos com a redução pela duração, celebrados no ano antes da Declaração e
   terminados nela antes do prazo, os dois no quadro 10 do Anexo F. Um acabou
   por motivo do senhorio (o motivo 01): a redução cai desde o início do
   período (art. 72.º n.º 20), e «A tratar» pede a regularização do ano
   anterior. O outro acabou sem o motivo escrito, e «A tratar» pede-o. As
   comunicações da duração foram feitas a tempo.
   Devolve: os dados (cenDados). */
function cenReducaoTerminada(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo();
  const pA=cenImovel(o,{name:'T2 Campo de Ourique',address:'Campo de Ourique, Lisboa',value:315000,purchase:240000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T2',vpt:101000,matrix:'2871',fraction:'F',purchaseDate:cenDia(T-8,6,3)});
  const pB=cenImovel(o,{name:'T1 Solum',address:'Solum, Coimbra',value:152000,purchase:118000,
    distrito:'Coimbra',freguesiaCodigo:'060316',tipologia:'T1',vpt:52000,matrix:'3306',fraction:'G',purchaseDate:cenDia(T-6,9,19)});
  const tA=normPerson({name:'Miguel Antunes',phone:'912 000 041',nif:'220000085',gender:'m',marital:'Casado(a)'});
  const tB=normPerson({name:'Sofia Lopes',phone:'912 000 042',nif:'220000093',gender:'f',marital:'Solteiro(a)'});
  const iniA=cenDia(T-1,3,1),iniB=cenDia(T-1,5,1),fimA=cenDia(T,6,30),fimB=cenDia(T,4,30);
  const cA=cenContrato({propertyId:pA.id,tenantIds:[tA.id],rent:900,deposit:1800,payDay:1,start:iniA,end:cenVespera(cenDia(T+4,3,1)),active:false,
    notes:'Acabou antes do prazo, por iniciativa do senhorio.'},
    {numero:'1198702',celebracao:cenDia(T-1,2,20),rendaAcimaDoLimite:false,comunicacoes:{[T-1]:cenDia(T-1,3,20)},comunicacoesV:2,
      cessacao:{data:fimA,motivo:'01'}});
  const cB=cenContrato({propertyId:pB.id,tenantIds:[tB.id],rent:600,deposit:1200,payDay:1,start:iniB,end:cenVespera(cenDia(T+4,5,1)),active:false},
    {numero:'1201147',celebracao:cenDia(T-1,4,18),rendaAcimaDoLimite:false,comunicacoes:{[T-1]:cenDia(T-1,5,25)},comunicacoesV:2,
      cessacao:{data:fimB,motivo:''}});
  const txs=[].concat(cenRendas(cA,'Renda T2 Campo de Ourique',T-1),cenRendas(cA,'Renda T2 Campo de Ourique',T,fimA),
    cenRendas(cB,'Renda T1 Solum',T-1),cenRendas(cB,'Renda T1 Solum',T,fimB),cenSelo(cA,o),cenSelo(cB,o));
  return cenDados(o,{properties:[pA,pB],tenants:[tA,tB],contracts:[cA,cB],transactions:txs,settings:cenSituacao(T)});
}
/* «Renda de dezembro por confirmar» (KAN-127-4): um contrato desde junho do
   ano passado, com as rendas registadas até novembro e mais nenhuma. O
   planeado da renda (que os Planeados derivam do contrato) fica na de
   dezembro do ano passado, em atraso: confirmada este ano, a data de hoje é
   de outro ano que o do mês da renda, e a app pergunta o dia em que entrou
   (planeados.js:recPedeODia) — é ele que decide a Declaração (D22).
   Devolve: os dados (cenDados). */
function cenRendaDezembro(){
  const Y=YEAR-1,o=donoDoExemplo();
  const p=cenImovel(o,{name:'T1 Sintra',address:'Sintra',value:210000,purchase:174000,
    distrito:'Lisboa',freguesiaCodigo:'111124',tipologia:'T1',vpt:64000,matrix:'6012',fraction:'H',purchaseDate:cenDia(Y-4,11,8)});
  const t=normPerson({name:'Tiago Rocha',phone:'912 000 051',nif:'230000010',gender:'m',marital:'Solteiro(a)'});
  const c=cenContrato({propertyId:p.id,tenantIds:[t.id],rent:750,deposit:1500,payDay:8,start:cenDia(Y,6,1)},
    {numero:'1229874',celebracao:cenDia(Y,5,25)});
  const txs=[].concat(cenRendas(c,'Renda T1 Sintra',Y,cenDia(Y,11,30)),cenSelo(c,o));
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:txs,settings:cenSituacao(cenAnoDaDeclaracao())});
}

/* ---- Os cenários dos subtickets do IRS de 2026-11-27 (base: false: só
   nascem a quem os pediu, scripts/modelos.mjs criar) ---- */

/* O cônjuge sem conta na app dos cenários da conjunta: um dono fora da app
   (comproprietariosFora) com metade da casa. Com «Os bens são comuns do
   casal», é ele o outro titular da Declaração (fisco-titulares.js:fiscoTitulares e
   fisco-titulares.js:fiscoConjugeForaId — D5); o id é o mesmo em todas as casas,
   como quando se escreve o mesmo nome em cada ficha.
   Devolve: a lista do comproprietariosFora (array novo). */
function cenConjugeFora(){return [{id:'conjuge-fora',nome:'Jorge Almeida',quota:50}]}
/* «Tributação conjunta» (KAN-153-1, KAN-129-6): a proprietária em tributação
   conjunta com os bens comuns do casal, e o cônjuge sem conta na app escrito
   como dono fora da app, a metade, em dois imóveis: um T3 em Lisboa e um
   apartamento em Lyon (França, código 250 da tabela X), os dois arrendados
   no ano. As rendas de Lyon saem do Anexo F para o quadro 7A do Anexo J, uma
   entrada por titular (o Anexo J é individual: o PDF e o CSV fazem um por
   titular, cada um com o seu total — fisco-exportar.js:fiscoExpAnexoJ). E
   «A tratar» diz, a cinzento, que a parte do cônjuge nos imóveis em comum vai
   às linhas do outro titular e que os imóveis só dele, que não estão na app,
   se inserem à mão no Portal (fisco-avisos.js:fiscoAvConjuntaSemConjuge).
   Um cônjuge com conta própria escolhido na situação não se faz com um
   modelo: as fichas dos outros proprietários vêm das contas que partilham
   casas com esta (cloud/nucleo.js:exportEntities só sobe o perfil da conta).
   Devolve: os dados (cenDados), com a situação fiscal do ano (settings). */
function cenConjunta(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo();
  const pA=cenImovel(o,{name:'T3 Alvalade',address:'Alvalade, Lisboa',value:420000,purchase:298000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T3',vpt:132000,matrix:'4718',fraction:'D',purchaseDate:cenDia(T-9,4,7),
    comproprietariosFora:cenConjugeFora(),notes:'Comprado pelo casal: bem comum.'});
  const pB=cenImovel(o,{name:'Apartamento em Lyon',address:'Croix-Rousse, Lyon, França',value:265000,purchase:228000,
    pais:'França',paisCodigo:'250',tipologia:'T2',purchaseDate:cenDia(T-4,6,18),
    comproprietariosFora:cenConjugeFora(),notes:'Comprado pelo casal: bem comum.'});
  const tA=normPerson({name:'Beatriz Nogueira',phone:'912 000 061',nif:'220000115',gender:'f',marital:'Solteiro(a)'});
  const tB=normPerson({name:'Camille Martin',phone:'912 000 062',gender:'f',marital:'Solteiro(a)',nationality:'Francesa',pais:'França'});
  const cA=cenContrato({propertyId:pA.id,tenantIds:[tA.id],rent:1350,deposit:2700,payDay:1,start:cenDia(T-2,9,1)},
    {numero:'1172290',celebracao:cenDia(T-2,8,20)});
  const cB=cenContrato({propertyId:pB.id,tenantIds:[tB.id],rent:900,deposit:1800,payDay:5,start:cenDia(T-1,10,1)},
    {celebracao:cenDia(T-1,9,15),impostoEstrangeiro:{[T]:1600}});
  const txs=[].concat(cenRendas(cA,'Renda T3 Alvalade',T),cenRendas(cB,'Renda Lyon',T));
  return cenDados(o,{properties:[pA,pB],tenants:[tA,tB],contracts:[cA,cB],transactions:txs,settings:cenSituacao(T,{bensComuns:true})});
}
/* «Imóvel em França» (KAN-129-2): um apartamento só da proprietária, em
   Paris (França, código 250), arrendado no ano, com o imposto pago lá. As
   rendas saem do Anexo F para o quadro 7A do Anexo J (o cartão «Anexo J» da
   Declaração, fisco-quadros.js), e os prazos do Código Civil português (a
   oposição à renovação) não se lhe aplicam (prazos.js:pzForaDePortugal).
   Devolve: os dados (cenDados). */
function cenImovelFranca(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo();
  const p=cenImovel(o,{name:'Estúdio em Paris',address:'Montmartre, Paris, França',value:310000,purchase:262000,
    pais:'França',paisCodigo:'250',tipologia:'T1',purchaseDate:cenDia(T-3,2,11)});
  const t=normPerson({name:'Louis Bernard',phone:'912 000 071',gender:'m',marital:'Solteiro(a)',nationality:'Francesa',pais:'França'});
  const c=cenContrato({propertyId:p.id,tenantIds:[t.id],rent:1100,deposit:2200,payDay:3,start:cenDia(T-1,3,1),end:cenVespera(cenDia(T+2,3,1))},
    {celebracao:cenDia(T-1,2,14),impostoEstrangeiro:{[T]:2100}});
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:cenRendas(c,'Renda Paris',T),settings:cenSituacao(T)});
}
/* «Donos por confirmar» (KAN-128-6, KAN-154-4): um T2 só da proprietária,
   a 100 %, arrendado no ano, sem resposta a «Há outros donos fora da app?»
   (comproprietariosFora null). «A tratar» pergunta «há mais donos além de
   ti?», com «É só meu» e «Há outros donos» (fisco-avisos.js, as quotas —
   fiscoAvSoDeUmDono).
   Devolve: os dados (cenDados). */
function cenDonosPorConfirmar(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo();
  const p=cenImovel(o,{name:'T2 Arroios',address:'Arroios, Lisboa',value:305000,purchase:226000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T2',vpt:88000,matrix:'2963',fraction:'E',purchaseDate:cenDia(T-6,1,25),
    comproprietariosFora:null});
  const t=normPerson({name:'Sara Pinto',phone:'912 000 081',nif:'220000123',gender:'f',marital:'Solteiro(a)'});
  const c=cenContrato({propertyId:p.id,tenantIds:[t.id],rent:950,deposit:1900,payDay:1,start:cenDia(T-1,6,1)},
    {numero:'1207785',celebracao:cenDia(T-1,5,21)});
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:cenRendas(c,'Renda T2 Arroios',T),settings:cenSituacao(T)});
}
/* O primeiro dia do contrato do RSAA do «Bloco fiscal»: o primeiro do mês
   de há dois meses, nunca antes de 1/10/2026 (o RSAA é dos contratos
   celebrados desde 1/9/2026, nas isenções do irs-2026.js; as datas da lei não andam).
   Devolve: 'AAAA-MM-DD'. */
function cenInicioRsaa(){
  const x=cenMesAtras(2),d=cenDia(x.y,x.m,1);
  return d<'2026-10-01'?'2026-10-01':d;
}
/* «Bloco fiscal do contrato» (KAN-128-3): dois contratos declarados de
   habitação permanente que, juntos, fazem aparecer cada pergunta do bloco
   fiscal (contrato.js:fiscoSect). O do T2 Benfica, de 2019 e sem termo: a
   renda de 2023 (começou antes de 2022, por responder), as renovações (é
   antigo), e os consumos incluídos na renda (na pergunta dos encargos do
   inquilino). O do T1 Lumiar, do RSAA, com 5 anos: a particularidade fiscal
   aberta com a isenção do RSAA escolhida e o envio ao IHRU por escrever
   (com o «Responder»), o que se paga à parte (40 € por mês de móveis), as
   perguntas dos n.os 23 e 24 (celebrado depois de 2024, teria redução), e
   as obras antes do início (pintura nos meses antes, por responder).
   Devolve: os dados (cenDados). */
function cenBlocoFiscal(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo();
  const pA=cenImovel(o,{name:'T2 Benfica',address:'Benfica, Lisboa',value:280000,purchase:176000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T2',vpt:79000,matrix:'5081',fraction:'A',purchaseDate:'2015-10-09'});
  const pB=cenImovel(o,{name:'T1 Lumiar',address:'Lumiar, Lisboa',value:248000,purchase:221000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T1',vpt:71000,matrix:'6230',fraction:'C',purchaseDate:'2025-11-17'});
  const tA=normPerson({name:'Nuno Ribeiro',phone:'912 000 091',nif:'220000131',gender:'m',marital:'Casado(a)'});
  const tB=normPerson({name:'Joana Correia',phone:'912 000 092',nif:'220000140',gender:'f',marital:'Solteiro(a)'});
  const cA=cenContrato({propertyId:pA.id,tenantIds:[tA.id],rent:720,deposit:1440,payDay:1,start:'2019-03-01',
    notes:'Sem termo. A renda inclui a água e a luz.'},{numero:'1061852',celebracao:'2019-02-18',renovavel:null,consumosIncluidos:true});
  const ini=cenInicioRsaa(),cel=addDays(ini,-14);
  const cB=cenContrato({propertyId:pB.id,tenantIds:[tB.id],rent:850,deposit:1700,payDay:1,start:ini,end:cenVespera(cenDia(Number(ini.slice(0,4))+5,Number(ini.slice(5,7)),1)),
    notes:'Arrendamento acessível (RSAA). Os móveis pagam-se à parte.'},{numero:'1251609',celebracao:cel,isencao:'rsaa',extrasMensais:40});
  const obras=cenAteHoje([normTx({kind:'expense',label:'Pintura do T1 Lumiar',amount:1650,date:addDays(ini,-60),propertyId:pB.id,
    category:'Obras e benfeitorias',sub:'Pintura',paidBy:o.id,notes:'Paredes e tetos, antes de o arrendar.'})]);
  const txs=[].concat(cenRendas(cA,'Renda T2 Benfica',T),cenRendas(cB,'Renda T1 Lumiar',T),obras,cenSelo(cB,o));
  return cenDados(o,{properties:[pA,pB],tenants:[tA,tB],contracts:[cA,cB],transactions:txs,settings:cenSituacao(T)});
}
/* «Obras antes do início» (KAN-128-2): um contrato declarado que começou em
   março do ano da Declaração, com a pintura e a canalização pagas nos meses
   antes, com a casa vazia (conservação nos 24 meses antes do início — CIRS
   art. 41.º n.º 7). A pergunta «o imóvel esteve só à espera de inquilino?»
   está por responder: as obras ficam fora dos gastos e «A tratar» pede a
   resposta, com o toque que abre a pergunta no contrato
   (o r.obrasPorConfirmar do fisco-resumo.js:resumoFiscal).
   Devolve: os dados (cenDados). */
function cenObrasAntes(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo();
  const p=cenImovel(o,{name:'T2 Marvila',address:'Marvila, Lisboa',value:265000,purchase:212000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T2',vpt:74000,matrix:'7104',fraction:'F',purchaseDate:cenDia(T-2,6,30)});
  const t=normPerson({name:'Pedro Lima',phone:'912 000 101',nif:'220000158',gender:'m',marital:'Solteiro(a)'});
  const c=cenContrato({propertyId:p.id,tenantIds:[t.id],rent:900,deposit:1800,payDay:1,start:cenDia(T,3,1)},
    {numero:'1238814',celebracao:cenDia(T,2,18)});
  const obras=cenAteHoje([
    normTx({kind:'expense',label:'Pintura da casa',amount:2400,date:cenDia(T-1,10,15),propertyId:p.id,
      category:'Obras e benfeitorias',sub:'Pintura',paidBy:o.id,notes:'Antes de arrendar: a casa estava vazia.'}),
    normTx({kind:'expense',label:'Canos da cozinha',amount:1350,date:cenDia(T-1,12,5),propertyId:p.id,
      category:'Obras e benfeitorias',sub:'Canalização',paidBy:o.id})]);
  const txs=[].concat(cenRendas(c,'Renda T2 Marvila',T),obras,cenSelo(c,o));
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:txs,settings:cenSituacao(T)});
}
/* «Encargos do inquilino» (KAN-129-3): um T1 com um planeado do condomínio
   feito à mão (mensal, Condomínio › Quota mensal, do imóvel) com a quota
   deste mês por confirmar, e um contrato em vigor sem nenhum encargo a cargo
   do inquilino marcado. O teste: no contrato, marcar «Condomínio» nos
   encargos do inquilino — o planeado passa os meses em que o contrato está em
   vigor (planeados.js:recSaltarEncargosDoInquilino) e deixa de se pedir.
   Devolve: os dados (cenDados). */
function cenEncargosInquilino(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo(),h=cenMesAtras(0);
  const p=cenImovel(o,{name:'T1 Penha de França',address:'Penha de França, Lisboa',value:228000,purchase:171000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T1',vpt:63000,matrix:'3815',fraction:'G',purchaseDate:cenDia(T-5,9,12)});
  const t=normPerson({name:'Marta Silva',phone:'912 000 111',nif:'220000166',gender:'f',marital:'Solteiro(a)'});
  const c=cenContrato({propertyId:p.id,tenantIds:[t.id],rent:780,deposit:1560,payDay:1,start:cenDia(T-1,4,1)},
    {numero:'1199360',celebracao:cenDia(T-1,3,22)});
  const quota={kind:'expense',label:'Quota do condomínio',amount:45,propertyId:p.id,category:'Condomínio',sub:'Quota mensal',paidBy:o.id};
  const rec=normRec({name:'Condomínio · T1 Penha de França',every:'month',next:cenDia(h.y,h.m,1),tx:quota});
  const pagas=[];
  for(let n=12;n>=1;n--){const x=cenMesAtras(n);pagas.push(normTx(Object.assign({},quota,{date:cenDia(x.y,x.m,1)})))}
  const txs=[].concat(cenRendas(c,'Renda T1 Penha de França',T-1),cenRendas(c,'Renda T1 Penha de França',T),
    T<YEAR?cenRendas(c,'Renda T1 Penha de França',YEAR):[],cenAteHoje(pagas));
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:txs,recurring:[rec],settings:cenSituacao(T)});
}
/* «Renda paga em parte» (KAN-129-4): um contrato de 800 € por mês, com as
   rendas pagas até há três meses, a de há dois meses paga só em parte (500 €,
   a resposta «Pagamento parcial» — t.parcial, D115: os 300 € que faltam
   ficam em dívida, e o planeado continua a pedir essa renda), e as duas
   seguintes (a do mês passado e a deste mês) por pagar.
   Devolve: os dados (cenDados). */
function cenRendaParcial(){
  const o=donoDoExemplo(),i=cenMesAtras(9),par=cenMesAtras(2);
  const p=cenImovel(o,{name:'T2 Olivais',address:'Olivais, Lisboa',value:236000,purchase:183000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T2',vpt:66000,matrix:'8250',fraction:'H',purchaseDate:cenDia(i.y-4,5,6)});
  const t=normPerson({name:'Ricardo Gomes',phone:'912 000 121',nif:'220000174',gender:'m',marital:'Casado(a)'});
  const c=cenContrato({propertyId:p.id,tenantIds:[t.id],rent:800,deposit:1600,payDay:1,start:cenDia(i.y,i.m,1)},
    {numero:'1245572',celebracao:addDays(cenDia(i.y,i.m,1),-10)});
  const txs=[];
  for(let n=9;n>=3;n--){const x=cenMesAtras(n),d=cenDia(x.y,x.m,1);
    txs.push(normTx({kind:'income',label:'Renda T2 Olivais',amount:800,date:d,propertyId:p.id,contractId:c.id,category:'Rendas',sub:'Renda mensal',periodo:d.slice(0,7),recibo:true}))}
  const dp=cenDia(par.y,par.m,1);
  txs.push(normTx({kind:'income',label:'Renda T2 Olivais',amount:500,date:dp,propertyId:p.id,contractId:c.id,category:'Rendas',sub:'Renda mensal',
    periodo:dp.slice(0,7),recibo:true,parcial:true,notes:'O inquilino pagou só uma parte: faltam 300 €.'}));
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:txs.concat(cenSelo(c,o)),settings:cenSituacao(cenAnoDaDeclaracao())});
}
/* «Categoria B» (KAN-129-5): um contrato declarado de 1 500 € por mês com as
   rendas tributadas na categoria B (c.fisco.categoriaB, D134: o imóvel
   afeto à atividade, ou a opção por ela), arrendado no ano: saem do Anexo F, e o cartão
   «Fora do Anexo F» mostra o total, de cinco algarismos (mais de 10 000 €
   desde julho, quando a Declaração passa ao ano corrente).
   Devolve: os dados (cenDados). */
function cenCategoriaB(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo();
  const p=cenImovel(o,{name:'T3 Parque das Nações',address:'Parque das Nações, Lisboa',value:610000,purchase:455000,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T3',vpt:168000,matrix:'9012',fraction:'J',purchaseDate:cenDia(T-4,7,1)});
  const t=normPerson({name:'Vasco Mendes',phone:'912 000 131',nif:'220000182',gender:'m',marital:'Casado(a)'});
  const c=cenContrato({propertyId:p.id,tenantIds:[t.id],rent:1500,deposit:3000,payDay:1,start:cenDia(T-1,7,1),
    notes:'Rendas tributadas na categoria B, com a minha atividade.'},
    {numero:'1218846',celebracao:cenDia(T-1,6,20),categoriaB:true});
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:cenRendas(c,'Renda T3 Parque das Nações',T),settings:cenSituacao(T)});
}
/* «Imóvel por quartos» (KAN-152-1): um T4 arrendado por quartos, com a
   parte da casa de cada quarto (rooms[].parte, em %, já com a sua quota das
   zonas comuns — a decisão do Martinho de 2026-11-27): 18 %, 22 % e 30 %; o
   resto são as zonas do dono. Os quartos de 18 e de 22 % têm contrato o ano
   todo; o de 30 % está vazio. Os gastos da casa (o condomínio, o IMI e uma
   reparação) contam só na parte arrendada: 40 %
   (fisco-resumo.js:fiscoParteArrendada).
   Devolve: os dados (cenDados). */
function cenQuartos(){
  const T=cenAnoDaDeclaracao(),o=donoDoExemplo();
  const rooms=[{id:'quarto-a',name:'Quarto A',parte:18},{id:'quarto-b',name:'Quarto B',parte:22},{id:'quarto-c',name:'Quarto C',parte:30}];
  const p=cenImovel(o,{name:'T4 Avenidas Novas',address:'Avenidas Novas, Lisboa',value:540000,purchase:395000,rentalMode:'quartos',rooms:rooms,
    distrito:'Lisboa',freguesiaCodigo:'110659',tipologia:'T4',vpt:142000,matrix:'2547',fraction:'K',purchaseDate:cenDia(T-7,3,3)});
  const tA=normPerson({name:'Inês Carvalho',phone:'912 000 141',nif:'220000190',gender:'f',marital:'Solteiro(a)'});
  const tB=normPerson({name:'Tomás Araújo',phone:'912 000 142',nif:'220000204',gender:'m',marital:'Solteiro(a)'});
  const cA=cenContrato({propertyId:p.id,roomId:p.rooms[0].id,tenantIds:[tA.id],rent:420,deposit:840,payDay:1,start:cenDia(T-1,9,1)},
    {numero:'1225407',celebracao:cenDia(T-1,8,24)});
  const cB=cenContrato({propertyId:p.id,roomId:p.rooms[1].id,tenantIds:[tB.id],rent:480,deposit:960,payDay:1,start:cenDia(T-1,10,1)},
    {numero:'1226930',celebracao:cenDia(T-1,9,23)});
  const gastos=[];
  for(let m=1;m<=12;m++)gastos.push(normTx({kind:'expense',label:'Quota do condomínio',amount:90,date:cenDia(T,m,8),propertyId:p.id,
    category:'Condomínio',sub:'Quota mensal',paidBy:o.id}));
  gastos.push(normTx({kind:'expense',label:'IMI '+(T-1),amount:520,date:cenDia(T,5,20),propertyId:p.id,category:'Impostos',sub:'IMI',paidBy:o.id}),
    normTx({kind:'expense',label:'Reparação do esquentador',amount:350,date:cenDia(T,4,14),propertyId:p.id,
      category:'Manutenção e reparações',sub:'',paidBy:o.id,notes:'Na cozinha, que os quartos partilham.'}));
  const txs=[].concat(cenRendas(cA,'Renda Quarto A',T),cenRendas(cB,'Renda Quarto B',T),cenAteHoje(gastos));
  return cenDados(o,{properties:[p],tenants:[tA,tB],contracts:[cA,cB],transactions:txs,settings:cenSituacao(T)});
}

/* Os modelos de base, pela ordem em que nascem a cada pessoa no Lab. O id é
   o que fica gravado (qa_modelos, tipo «cenario»): nunca muda. O nome é curto
   e a descrição diz numa linha o que o cenário deixa testar. */
const MODELOS_CENARIOS=[
  {id:'exemplo',nome:'Exemplo completo',
    descricao:'Três imóveis, cinco contratos, hipotecas e o ano em curso: o mesmo do «Carregar exemplo».',
    construir:cenExemplo},
  {id:'vazio',nome:'Vazio',
    descricao:'A conta sem imóveis, pessoas, contratos nem movimentos.',
    construir:cenVazio},
  {id:'prejuizo',nome:'Ano com prejuízo',
    descricao:'As obras passam as rendas do ano: o imposto estimado fica em 0 € e aparece o prejuízo a reportar.',
    construir:cenPrejuizo},
  {id:'isencoes-6h-6f',nome:'Isenções 6H e 6F',
    descricao:'Um de 2024 pode ter o 6F, um de 1985 o 6H, um de 2025 nenhuma; e dois já com o 6F e o 6H escolhidos.',
    construir:cenIsencoes},
  {id:'reducao',nome:'Contrato com redução',
    descricao:'Um contrato de 5 anos com redução pela duração (quadro 4.2) e a comunicação da duração por marcar.',
    construir:cenReducao},
  {id:'reducao-terminada',nome:'Redução terminada',
    descricao:'Dois contratos com redução que acabaram este ano: vão ao quadro 10 e «A tratar» pede o motivo e a regularização.',
    construir:cenReducaoTerminada},
  {id:'renda-dezembro',nome:'Renda de dezembro por confirmar',
    descricao:'A renda de dezembro do ano passado ainda está nos Planeados: ao confirmá-la, a app pergunta o dia em que entrou.',
    construir:cenRendaDezembro},
  {id:'conjunta',nome:'Tributação conjunta',base:false,
    descricao:'Conjunta com os bens comuns do casal: um imóvel em Lisboa e um em França a meias, com um Anexo J por titular.',
    construir:cenConjunta},
  {id:'imovel-franca',nome:'Imóvel em França',base:false,
    descricao:'Um estúdio em Paris arrendado no ano: as rendas vão ao Anexo J, com o imposto pago lá.',
    construir:cenImovelFranca},
  {id:'donos-por-confirmar',nome:'Donos por confirmar',base:false,
    descricao:'Um imóvel só teu sem resposta a «Há outros donos fora da app?»: «A tratar» pergunta se há mais donos.',
    construir:cenDonosPorConfirmar},
  {id:'bloco-fiscal',nome:'Bloco fiscal do contrato',base:false,
    descricao:'Dois contratos que mostram todas as perguntas do bloco fiscal: isenção, IHRU, consumos, pago à parte, obras e 2023.',
    construir:cenBlocoFiscal},
  {id:'obras-antes',nome:'Obras antes do início',base:false,
    descricao:'Obras pagas nos meses antes do contrato, sem resposta no contrato: «A tratar» pede a resposta.',
    construir:cenObrasAntes},
  {id:'encargos-inquilino',nome:'Encargos do inquilino',base:false,
    descricao:'Um planeado do condomínio por confirmar e um contrato sem encargos do inquilino: marca o condomínio no contrato.',
    construir:cenEncargosInquilino},
  {id:'renda-parcial',nome:'Renda paga em parte',base:false,
    descricao:'Uma renda de 800 € paga só com 500 € há dois meses, e as duas seguintes por pagar.',
    construir:cenRendaParcial},
  {id:'categoria-b',nome:'Categoria B',base:false,
    descricao:'Um contrato de 1 500 € por mês com as rendas na categoria B: saem do Anexo F, com um total de cinco algarismos.',
    construir:cenCategoriaB},
  {id:'quartos',nome:'Imóvel por quartos',base:false,
    descricao:'Três quartos com 18, 22 e 30 % da casa, dois arrendados e um vazio: os gastos da casa contam em 40 %.',
    construir:cenQuartos}];
/* Um modelo de base pelo id.
   Recebe: id — o id do cenário (texto).
   Devolve: o cenário ({id, nome, descricao, construir}), ou null. */
function cenarioDeBase(id){return MODELOS_CENARIOS.find(x=>x.id===id)||null}
