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
   cada um no motor do IRS e confirmam o que a descrição promete. */

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
   Recebe: o — a proprietária (null: nenhuma ficha); partes — as coleções.
   Devolve: {owners, properties, tenants, contracts, transactions, templates, recurring}. */
function cenDados(o,partes){
  return Object.assign({owners:o?[o]:[],properties:[],tenants:[],contracts:[],transactions:[],templates:[],recurring:[]},partes);
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
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:txs});
}
/* «Isenções 6H e 6F» (KAN-126-7): três contratos de habitação permanente,
   declarados, sem isenção escolhida — para a escolher no formulário. O de
   2024 (um ex-alojamento local) pode ter a do 6F (EBF art. 74.º-A: celebrado
   entre 1/1/2023 e 31/12/2024), o de 1985 a renda antiga do 6H (EBF art.
   46.º-A: celebrado antes do RAU), e o de 2025 nenhuma das duas
   (contrato.js:ctIsencoesOferecidas só as mostra quando as datas servem).
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
  const txs=[].concat(cenRendas(cA,'Renda T2 Campo de Ourique',T),cenRendas(cB,'Renda T1 Solum',T),cenRendas(cC,'Renda T2 Sintra',T),
    cenSelo(cA,o),cenSelo(cC,o));
  return cenDados(o,{properties:[pA,pB,pC],tenants:[tA,tB,tC],contracts:[cA,cB,cC],transactions:txs});
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
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:txs});
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
  return cenDados(o,{properties:[pA,pB],tenants:[tA,tB],contracts:[cA,cB],transactions:txs});
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
  return cenDados(o,{properties:[p],tenants:[t],contracts:[c],transactions:txs});
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
    descricao:'Contratos de 2024, de 1985 e de 2025: o primeiro pode ter a isenção do 6F, o segundo a do 6H, o terceiro nenhuma.',
    construir:cenIsencoes},
  {id:'reducao',nome:'Contrato com redução',
    descricao:'Um contrato de 5 anos com redução pela duração (quadro 4.2) e a comunicação da duração por marcar.',
    construir:cenReducao},
  {id:'reducao-terminada',nome:'Redução terminada',
    descricao:'Dois contratos com redução que acabaram este ano: vão ao quadro 10 e «A tratar» pede o motivo e a regularização.',
    construir:cenReducaoTerminada},
  {id:'renda-dezembro',nome:'Renda de dezembro por confirmar',
    descricao:'A renda de dezembro do ano passado ainda está nos Planeados: ao confirmá-la, a app pergunta o dia em que entrou.',
    construir:cenRendaDezembro}];
/* Um modelo de base pelo id.
   Recebe: id — o id do cenário (texto).
   Devolve: o cenário ({id, nome, descricao, construir}), ou null. */
function cenarioDeBase(id){return MODELOS_CENARIOS.find(x=>x.id===id)||null}
