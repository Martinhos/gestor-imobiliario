/* ================= IRS 2025 =================
   As regras dos rendimentos de 2025: a declaração que se entregou de 1 de
   abril a 30 de junho de 2026. Uma versão por ano dos rendimentos, com o nome
   do ano — a de 2026 está em irs-2026.js, e cada ano novo nasce de uma cópia
   da anterior (scripts/nova-versao-irs.js). O motor que lê isto é o irs.js;
   aqui só há dados, e cada um tem a fonte ao lado.

   O formato, campo a campo:
   - ano: o ano dos rendimentos (o do nome do ficheiro);
   - entrega: {de, ate} — o prazo do Modelo 3 (CIRS art. 60.º n.º 1);
   - modelo: {oficial, texto} — se o Anexo F deste ano já foi aprovado, e qual;
   - taxas: habitacional e naoHabitacional (CIRS art. 72.º n.º 1 e) e n.º 2);
     duracao — os regimes da redução pela duração, cada um com o intervalo de
     datas em que o contrato (ou a renovação) começou e os escalões
     {meses, taxa, porRenovacao, minimo}; rendaModerada — {taxa,
     limiteMensal, ate} ou null;
   - colunas: as colunas de gastos dos quadros 4.1 e 4.2, pela ordem do impresso;
   - naturezas: os códigos da natureza das rendas nos quadros 4.1 e 4.2;
   - quadros: onde vai cada coisa no Anexo F deste ano;
   - prazos: comunicacaoDuracao — o 15 de fevereiro da Portaria 110/2019;
   - englobamento: {escaloes, solidariedade} — as taxas gerais dos arts. 68.º
     e 68.º-A do CIRS desse ano, para simular o quadro 6G;
   - novidades: o que mudou neste ano, em frases para quem declara;
   - passos: o guia de preenchimento, [{titulo, texto}] — sem anos escritos:
     {ano} é o ano dos rendimentos e {ate} o último dia da entrega
     (fisco.js:fiscoGuiaCard troca-os).

   Fontes (consultadas a 2026-10-08): o impresso e as instruções do Anexo F
   «em vigor a partir de janeiro de 2025» (info.portaldasfinancas.gov.pt,
   Mod_3_anexo_F.pdf); a Portaria 72-B/2025/1, que o aprovou; a Portaria
   104/2026/1 (art. 1.º n.º 3 a)) e o Ofício-Circulado 20291, que o mantêm para
   os rendimentos de 2025; o CIRS, arts. 8.º, 41.º, 55.º, 60.º, 72.º, 74.º,
   101.º-B e 115.º; a Lei 56/2023 (art. 50.º, o regime transitório das
   reduções); o DL 49/2025 (Modelo 44 até ao fim de fevereiro); e, como guia
   de leitura, o Doutor Finanças («Rendimentos prediais: como preencher o
   anexo F do IRS», 2024-04-04). A pesquisa completa, com os pontos incertos,
   ficou no relatório do scope irs-anual. */
registarAnoIrs({
  ano:2025,
  entrega:{de:'2026-04-01',ate:'2026-06-30'},
  modelo:{oficial:true,
    texto:'Anexo F em vigor desde janeiro de 2025 (Portaria 72-B/2025/1), mantido sem alterações para os rendimentos de 2025 pela Portaria 104/2026/1.'},
  taxas:{
    habitacional:25,
    naoHabitacional:28,
    duracao:[
      /* Lei 56/2023: contratos celebrados ou renovados desde 7 de outubro de
         2023. 5 a 10 anos −10 p.p., e −2 p.p. por renovação de igual duração
         até mais 10 p.p.; 10 a 20 anos −15 p.p.; 20 ou mais −20 p.p. */
      {desde:'2023-10-07',escaloes:[{meses:240,taxa:5},{meses:120,taxa:10},{meses:60,taxa:15,porRenovacao:2,minimo:5}]},
      /* o regime de 2019 (taxa base de 28 %), para quem começou ou renovou
         entre 2019 e 6 de outubro de 2023: fica a mais baixa entre ele e os
         25 % até ao termo ou à renovação (Lei 56/2023, art. 50.º n.º 8) */
      {desde:'2019-01-01',ate:'2023-10-06',escaloes:[{meses:240,taxa:10},{meses:120,taxa:14},{meses:60,taxa:23,porRenovacao:5,minimo:14},{meses:24,taxa:26,porRenovacao:2,minimo:14}]}],
    rendaModerada:null,
    /* CIRS art. 72.º n.º 23 (rendimentos de 2024 em diante): os contratos de
       habitação celebrados desde 1 de janeiro de 2024 com a renda mensal acima
       de 150 % dos limites gerais por tipologia e concelho (Portaria 176/2019,
       tabelas 1 e 2 do anexo I) não têm as reduções dos n.os 3 a 5; vão ao 4.1,
       e o 4.2C confirma-o. A app não tem as tabelas: pergunta-o
       (fisco.rendaAcimaDoLimite). O OC 20278 diz «a partir de 01.10.2024»;
       seguiu-se a lei e as instruções do Anexo F (1 de janeiro). */
    limiteRendaAlta:{desde:'2024-01-01',percentagem:150},
    /* n.º 24: −5 p.p. nos contratos novos com as reduções dos n.os 3 a 5 se a
       renda for pelo menos 5 % mais baixa do que a do contrato anterior no
       mesmo imóvel (quadro 4.2B, que pede as duas rendas). INCERTO: a pesquisa
       escreve «5 p.p. inferior»; lê-se 5 % da renda anterior. INCERTO: desde
       quando — usa-se a data do n.º 23 (contratos celebrados desde 1 de janeiro
       de 2024), a mais tardia, que é a prudente. INCERTO: num contrato de 20
       anos a letra daria 0 %; a leitura prudente nunca desce abaixo do
       `minimo` (5 %), e só vale no período inicial (uma renovação não é um
       «novo contrato»). */
    bonusRendaMenor:{desde:'2024-01-01',rendaMenorPct:5,pontos:5,minimo:5}},
  /* As isenções de IRS dos programas de arrendamento acessível, declaradas no
     quadro 6D do Anexo F (códigos da natureza do programa: 01 PAA, 02 PMA,
     03 PMAE — instruções do Anexo F; OC 20269). Um contrato isento paga 0 %
     (irs.js:irsTaxa); com englobamento as rendas isentas contam só para a taxa
     dos outros rendimentos (EBF art. 71.º-A n.º 3). Cada uma: {id — o valor de
     fisco.isencao, nome, curto, quadro, codigo, lei, texto — a explicação curta
     do formulário}. */
  isencoes:[
    {id:'paa',nome:'Programa de Apoio ao Arrendamento (PAA)',curto:'PAA',quadro:'6D',codigo:'01',lei:'DL 68/2019, art. 20.º',
      texto:'Contrato inscrito no Programa de Apoio ao Arrendamento (o antigo Arrendamento Acessível), no IHRU: as rendas ficam isentas de IRS enquanto o contrato estiver no programa.'},
    {id:'pma',nome:'Programa municipal de arrendamento acessível (PMA)',curto:'programa municipal',quadro:'6D',codigo:'02',lei:'EBF art. 71.º-A',
      texto:'Contrato celebrado num programa municipal de habitação a renda acessível: as rendas ficam isentas de IRS durante o contrato.'},
    {id:'pmae',nome:'Programa municipal de alojamento estudantil (PMAE)',curto:'alojamento estudantil municipal',quadro:'6D',codigo:'03',lei:'EBF art. 71.º-A',
      texto:'Contrato celebrado num programa municipal de alojamento para estudantes: as rendas ficam isentas de IRS durante o contrato.'}],
  colunas:['conservacao','condominio','imi','selo','taxas','outros'],
  naturezas:{habitacional:'07',naoHabitacional:'06'},
  quadros:{semReducao:'4.1',comReducao:'4.2',datas:'4.2A',anosAnteriores:'8',englobamento:'6G',aimi:'9',cessados:'10'},
  prazos:{comunicacaoDuracao:'2026-02-15'},
  /* Para simular o englobamento (quadro 6G; fisco.js:fiscoEnglobamento): as
     taxas gerais do CIRS art. 68.º dos rendimentos de 2025, na redação da Lei
     55-A/2025, de 22 de julho (que baixou do 1.º ao 8.º escalão para todo o
     ano de 2025) — a versão do art. 68.º «em vigor até dezembro de 2025» no
     Portal das Finanças (info.portaldasfinancas.gov.pt, cirs_rep/irs68.aspx,
     consultado a 2026-10-11), confirmada pelas taxas médias publicadas. Cada
     escalão: {ate — o limite do rendimento coletável (null no último), taxa —
     a normal, em %, parcela — a parcela a abater}; a coleta é rendimento ×
     taxa − parcela. As parcelas não vêm na lei: são as que fazem a tabela
     contínua (a anterior mais o limite anterior × a diferença das taxas),
     arredondadas ao cêntimo. solidariedade: a taxa adicional do art. 68.º-A
     (2,5 % de 80 000 € a 250 000 €, 5 % acima), por patamar {acima, taxa}. */
  englobamento:{
    escaloes:[{ate:8059,taxa:12.5,parcela:0},{ate:12160,taxa:16,parcela:282.07},{ate:17233,taxa:21.5,parcela:950.87},
      {ate:22306,taxa:24.4,parcela:1450.62},{ate:28400,taxa:31.4,parcela:3012.04},{ate:41629,taxa:34.9,parcela:4006.04},
      {ate:44987,taxa:43.1,parcela:7419.62},{ate:83696,taxa:44.6,parcela:8094.43},{ate:null,taxa:48,parcela:10940.09}],
    solidariedade:[{acima:80000,taxa:2.5},{acima:250000,taxa:5}]},
  novidades:[
    'O Anexo F é o mesmo dos rendimentos de 2024: nenhum quadro, coluna ou código mudou.',
    'Quem está dispensado do recibo de renda eletrónico (65 anos ou mais, ou sem caixa postal eletrónica e com poucas rendas) entrega a declaração anual das rendas até ao fim de fevereiro — era até ao fim de janeiro.',
    'Desde julho de 2025 o inquilino com contabilidade organizada não retém quando a retenção seria inferior a 25 €; e o limite abaixo do qual o senhorio pode dispensar a retenção (com a menção no recibo) sobe para 15 000 € de rendas no ano.',
    'Desde agosto de 2025 o inquilino pode comunicar o contrato às Finanças se o senhorio não o fizer — a obrigação continua a ser do senhorio.'],
  passos:[
    {titulo:'Antes de abrir o Portal',
      texto:'Confirma nesta página que não falta nada: cada contrato com o número que a AT lhe deu, cada imóvel com o código da freguesia, o tipo e o artigo, cada inquilino com NIF ou país. O que falta está em «Obrigações», e cada ponto abre o sítio onde se trata.'},
    {titulo:'O rosto da declaração',
      texto:'No Portal das Finanças, IRS › Entregar declaração, ano {ano}. Confirma o estado civil e se vais em tributação conjunta ou separada: é isso que decide o titular de cada linha do Anexo F — A és tu, B o cônjuge (só em conjunta). Com rendas não há IRS Automático.'},
    {titulo:'Quadros 4.1 e 4.2: uma linha por contrato',
      texto:'No 4.1 os contratos sem redução de taxa; no 4.2 os de habitação permanente com redução pela duração, e para cada um o 4.2A com as datas do contrato e da última renovação. De cada linha desta página copias o n.º do contrato, a data de início, a freguesia, o tipo, o artigo, a fração, o titular, a renda ilíquida, a natureza (07 habitacional, 06 não habitacional), as retenções e o NIF ou o país do inquilino. Uma fração por linha; num imóvel em compropriedade cada um declara a sua quota.'},
    {titulo:'Os gastos, na mesma linha',
      texto:'Na tabela de baixo, pelo mesmo número de campo: conservação e manutenção, condomínio, IMI pago no ano, imposto do selo, taxas autárquicas e outros — só os do período em que o imóvel esteve arrendado. As obras de conservação dos 24 meses antes de um contrato vão nas três colunas próprias, no ano em que ele começa. Guarda as faturas com o teu NIF: a AT pode pedi-las durante quatro anos.'},
    {titulo:'Rendas de anos anteriores (quadro 8)',
      texto:'Uma renda de outro ano recebida em {ano} já está no valor da linha. No quadro 8 dizes que parte é de que ano: no 8A se englobares (o valor reparte-se pelos anos a que respeita), ou no 8B se entregares declarações de substituição desses anos, até cinco para trás.'},
    {titulo:'Englobar ou não (quadro 6G)',
      texto:'Sem englobamento, as rendas pagam a taxa especial: 25 % na habitação, 28 % no resto, menos nos contratos longos. Com englobamento somam-se aos teus outros rendimentos e pagam a taxa dos escalões — compensa quando o teu escalão fica abaixo da taxa especial. A opção vale para todas as rendas: simula as duas no Portal antes de entregar.'},
    {titulo:'AIMI e contratos que acabaram (quadros 9 e 10)',
      texto:'Se pagaste o Adicional ao IMI, o quadro 9 abate-o ao imposto na parte dos prédios arrendados (não é um gasto do 4.1). Um contrato com redução de taxa que acabou antes do prazo por iniciativa do senhorio declara-se no quadro 10.'},
    {titulo:'Simular e entregar',
      texto:'Simula, confere o valor a pagar ou a receber e entrega até {ate}. Um resultado negativo das rendas não se perde: abate às rendas dos seis anos seguintes.'}],
});
