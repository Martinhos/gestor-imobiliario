/* ================= IRS 2025 =================
   As regras dos rendimentos de 2025: a declaração que se entregou de 1 de
   abril a 30 de junho de 2026. Uma versão por ano dos rendimentos, com o nome
   do ano — a de 2026 está em irs-2026.js, e cada ano novo nasce de uma cópia
   da anterior (scripts/nova-versao-irs.js). O motor que lê isto é o irs.js;
   aqui só há dados, e cada um tem a fonte ao lado.

   O formato, campo a campo:
   - ano: o ano dos rendimentos (o do nome do ficheiro);
   - revisto: 'AAAA-MM-DD' — o dia em que esta versão foi conferida pela última
     vez com as fontes do cabeçalho ('' numa cópia que ninguém reviu); o PDF,
     o CSV e o aviso das regras provisórias dizem-no;
   - entrega: {de, ate} — o prazo do Modelo 3 (CIRS art. 60.º n.º 1);
   - modelo: {oficial, texto} — se o Anexo F deste ano já foi aprovado, e qual;
   - ias: o valor do indexante dos apoios sociais (IAS) deste ano, em euros
     (null numa cópia que ninguém reviu). A dispensa do recibo eletrónico de um
     ano mede as rendas do ano anterior contra 2 × o IAS desse ano anterior —
     quem lê é irsAno(ano − 1).ias;
   - taxas: habitacional e naoHabitacional (CIRS art. 72.º n.º 1 e) e n.º 2);
     duracao — os regimes da redução pela duração, cada um com o intervalo de
     datas em que o contrato (ou a renovação) começou e os escalões
     {meses, taxa, n, porRenovacao, minimo}, em que n é o número do art. 72.º
     do escalão (o que o quadro 10 pede no «Regime fiscal»); rendaModerada —
     {taxa, limiteMensal, ate} ou null; limiteRendaAlta — o n.º 23 do art.
     72.º, {desde, percentagem, portaria:[{desde, ate, portaria, valoresDa,
     texto}]}: em cada intervalo de datas (ate '' = sem fim) a portaria em
     vigor e a portaria de onde vêm os valores da tabela, com a frase que se
     mostra; bonusRendaMenor — o n.º 24, {desde, rendaMenorPct, pontos, minimo};
     dhd — a taxa da prestação mensal de um direito real de habitação
     duradoura (art. 72.º n.º 5);
   - isencoes: as isenções de IRS que um contrato pode ter (fisco.isencao),
     cada uma {id, nome, curto, quadro, codigo, lei, texto} e as condições que
     o motor confere (irs.js:irsIsencao): desde e celebradoAte — o intervalo
     da data de celebração; ateAno — o último ano dos rendimentos isento;
     pedeIhru — a isenção só conta com a data do envio ao IHRU
     (fisco.ihru); prazoIhru — 'MM-DD' do ano seguinte à celebração até ao
     qual esse envio se faz; pede — o campo de fisco que tem de ser true;
     finalidade — os valores de fisco.finalidade aceites; semCodigo — true
     quando o quadro não tem código (6F e 6H: só o campo do 4.1);
   - colunas: as colunas de gastos dos quadros 4.1 e 4.2, pela ordem do impresso;
   - colunasNomes: os nomes do impresso — apos (o grupo «Após início do
     arrendamento»: {titulo, e um nome por coluna}) e obras (o grupo «Com obras
     de conservação e manutenção»: {titulo, inicioContrato, inicioGastos, valor});
   - naturezas: o código da natureza das rendas do 4.1/4.2 por papel
     {habitacional, naoHabitacional, indemnizacao, outras}, e dhd — o da
     prestação mensal de um DHD no 4.3; naturezasTexto — o texto de cada
     código da tabela das instruções do 4.1;
   - quadro5: a sublocação, {naturezas:{habitacional, naoHabitacional},
     naturezasTexto};
   - quadro43: o direito real de habitação duradoura, {colunas:[[id, nome]],
     naturezas:{prestacao, caucao, deducaoCaucao}, naturezasTexto, reduzidas
     — os códigos com a redução do n.º 5 —, gastos:[[id, nome]], motivos:
     [{codigo, texto, curto, regulariza}]};
   - beneficios: os benefícios que o quadro 6 identifica pelo campo do 4.1
     (6A, 6B, 6C), cada um {id, quadro, campos, marca, as condições e o que
     muda} — o formato está no comentário da lista;
   - quadro10: os contratos cessados — regimes [{codigo, texto, n | isencao,
     sub}] (n: o número do art. 72.º; isencao: o id da isenção; sub: true no
     subarrendamento) e motivos [{codigo, texto, curto, para, quem,
     regulariza}] (para: 'reducao' | o id da isenção; quem: 'senhorio' |
     'inquilino' | 'fim'; regulariza: true quando a redução se perde desde o
     início, art. 72.º n.º 20);
   - quadros: onde vai cada coisa no Anexo F deste ano;
   - prazos: comunicacaoDuracao — o 15 de fevereiro da Portaria 110/2019;
   - englobamento: {escaloes, solidariedade} — as taxas gerais dos arts. 68.º
     e 68.º-A do CIRS desse ano, para simular o quadro 6G;
   - novidades: o que mudou neste ano, em frases para quem declara;
   - passos: o guia de preenchimento, [{titulo, texto}] — sem anos escritos:
     {ano} é o ano dos rendimentos e {ate} o último dia da entrega
     (a página já não os mostra: os passos vivem no guia público).

   Fontes (consultadas a 2026-10-08): o impresso e as instruções do Anexo F
   «em vigor a partir de janeiro de 2025» (info.portaldasfinancas.gov.pt,
   Mod_3_anexo_F.pdf); a Portaria 72-B/2025/1, que o aprovou; a Portaria
   104/2026/1 (art. 1.º n.º 3 a)) e o Ofício-Circulado 20291, que o mantêm para
   os rendimentos de 2025; o CIRS, arts. 8.º, 41.º, 55.º, 60.º, 72.º, 74.º,
   101.º-B e 115.º; a Lei 56/2023 (art. 50.º, o regime transitório das
   reduções); o DL 49/2025 (Modelo 44 até ao fim de fevereiro); e, como guia
   de leitura, o Doutor Finanças («Rendimentos prediais: como preencher o
   anexo F do IRS», 2024-04-04). A pesquisa completa, com os pontos incertos,
   ficou no relatório do scope irs-anual.

   Revisão de 2026-11-17 (auditoria ao IRS, KAN-126), com estas fontes:
   - as instruções do Anexo F em vigor a partir de janeiro de 2025 (o mesmo
     Mod_3_anexo_F.pdf, texto em .unlazy/irs-auditoria/v-comunicacao-quadro-
     42-lei/anexo-f.txt): os códigos da natureza das rendas do 4.1 (01 a 07),
     as do quadro 5 (01 e 02), as tabelas «Regime fiscal» (01 a 10) e «Motivo
     da cessação» (01 a 12) do quadro 10, os quadros 4.4, 5, 6F e 6H, e os
     nomes das colunas de gastos do impresso;
   - o EBF art. 46.º-A (aditado pela Lei 82/2023, de 29 de dezembro) e art.
     74.º-A (aditado pelo art. 29.º da Lei 56/2023), no Portal das Finanças
     (bf_rep/EBF46A.aspx, bf_rep/ebf74a.aspx), lidos a 2026-11-17;
   - a Portaria 6-B/2025/1, de 6 de janeiro (IAS de 2025: 522,50 €);
   - a Lei 56/2023, arts. 50.º n.º 7 e 55.º (o n.º 24 do art. 72.º vale desde
     7 de outubro de 2023), como os citou o verificador da lei do D37.

   Revisão de 2026-11-17 (ronda 2 da auditoria, KAN-128), com estas fontes:
   - as instruções do Anexo F (o mesmo Mod_3_anexo_F.pdf): o quadro 4.3 (as
     colunas, as naturezas 01 a 03 e os motivos da cessação 01 a 06) e os
     quadros 6A, 6B e 6C (os campos 01 a 05, 08 a 12 e 13 a 17);
   - o CIRS art. 72.º n.os 5 e 20 (cirs_rep/irs72.aspx);
   - a informação vinculativa 28153 (despacho de 2026-09-25), o EBF arts.
     59.º-G e 59.º-I no Portal das Finanças, lidos a 2026-11-17 — o detalhe
     está no comentário dos beneficios. */
registarAnoIrs({
  ano:2025,
  revisto:'2026-11-17',
  entrega:{de:'2026-04-01',ate:'2026-06-30'},
  modelo:{oficial:true,
    texto:'Anexo F em vigor desde janeiro de 2025 (Portaria 72-B/2025/1), mantido sem alterações para os rendimentos de 2025 pela Portaria 104/2026/1.'},
  /* Portaria 6-B/2025/1, de 6 de janeiro, art. 2.º: o IAS de 2025 é 522,50 €
     (o folheto da AT do Modelo 44, de março de 2026, faz a conta da dispensa
     dos recibos de 2026 com ele: 2 × 522,50 = 1 045,00 €). INCERTO: que IAS
     conta na dispensa — a Portaria 98-A/2015 (art. 5.º n.º 2 b)) diz «duas
     vezes o IAS» sem dizer de que ano; o folheto e a FAQ 5929 da AT usam o do
     ano das rendas, a FAQ 5937 o do ano da dispensa (537,13 € em 2026). Segue-
     se o primeiro, que dá o limite mais baixo (D111). */
  ias:522.5,
  /* A retenção na fonte das rendas (CIRS art. 101.º n.º 1 e)): 25 %, que os
     avisos conferem renda a renda (fisco-avisos.js:fiscoAvRetencaoCerta). Em
     2025 não há a taxa das rendas moderadas. O mínimo abaixo do qual não se
     retém fica por confirmar na fonte (INCERTO): sem ele, a app não acusa
     nada abaixo de nenhum valor. */
  retencao:{taxa:25,moderada:null,moderadaDesde:'',minimo:null,minimoDesde:''},
  taxas:{
    habitacional:25,
    naoHabitacional:28,
    duracao:[
      /* Lei 56/2023: contratos celebrados ou renovados desde 7 de outubro de
         2023. 5 a 10 anos −10 p.p. (art. 72.º n.º 3), e −2 p.p. por
         renovação até mais 10 p.p.; 10 a 20 anos −15 p.p. (n.º 4); 20 ou
         mais −20 p.p. (n.º 5). O n de cada escalão é o número do art. 72.º. */
      {desde:'2023-10-07',escaloes:[{meses:240,taxa:5,n:5},{meses:120,taxa:10,n:4},{meses:60,taxa:15,n:3,porRenovacao:2,minimo:5}]},
      /* o regime de 2019 (Lei 3/2019, taxa base de 28 %), para quem começou
         ou renovou entre 2019 e 6 de outubro de 2023: 2 a 5 anos é o n.º 2,
         5 a 10 o n.º 3, 10 a 20 o n.º 4, 20 ou mais o n.º 5. Fica a mais
         baixa entre ele e os 25 % até ao termo ou à renovação (Lei 56/2023,
         art. 50.º n.º 8) */
      {desde:'2019-01-01',ate:'2023-10-06',escaloes:[{meses:240,taxa:10,n:5},{meses:120,taxa:14,n:4},{meses:60,taxa:23,n:3,porRenovacao:5,minimo:14},{meses:24,taxa:26,n:2,porRenovacao:2,minimo:14}]}],
    rendaModerada:null,
    /* CIRS art. 72.º n.º 23 (rendimentos de 2024 em diante): os contratos de
       habitação celebrados desde 1 de janeiro de 2024 com a renda mensal acima
       de 150 % dos limites gerais por tipologia e concelho (Portaria 176/2019,
       tabelas 1 e 2 do anexo I) não têm as reduções dos n.os 3 a 5; vão ao 4.1,
       e o 4.2C confirma-o. A app não tem as tabelas: pergunta-o
       (fisco.rendaAcimaDoLimite). O OC 20278 diz «a partir de 01.10.2024»;
       seguiu-se a lei e as instruções do Anexo F (1 de janeiro). Nos
       rendimentos de 2025 só vale a Portaria 176/2019 (as instruções do 4.2
       do modelo de 2025 citam-na); a troca de setembro de 2026 está no
       irs-2026.js. */
    limiteRendaAlta:{desde:'2024-01-01',percentagem:150,
      portaria:[{desde:'2024-01-01',ate:'',portaria:'Portaria 176/2019',valoresDa:'Portaria 176/2019',
        texto:'os limites gerais por tipologia e concelho das tabelas 1 e 2 do anexo I à Portaria 176/2019, de 6 de junho'}]},
    /* n.º 24: −5 p.p. nos contratos novos com as reduções dos n.os 3 a 5 se a
       renda for pelo menos 5 % mais baixa do que a do contrato anterior no
       mesmo imóvel (quadro 4.2B, que pede as duas rendas). Desde 7 de outubro
       de 2023: o n.º 24 foi aditado pela Lei 56/2023 sem data própria, e a lei
       entrou em vigor no dia seguinte ao da publicação (art. 55.º); a data de
       1 de janeiro de 2024 é só do n.º 23 (D37). INCERTO: a pesquisa escreve
       «5 p.p. inferior»; lê-se 5 % da renda anterior. INCERTO: num contrato de
       20 anos a letra daria 0 %; a leitura prudente nunca desce abaixo do
       `minimo` (5 %), e só vale no período inicial (uma renovação não é um
       «novo contrato»). */
    bonusRendaMenor:{desde:'2023-10-07',rendaMenorPct:5,pontos:5,minimo:5},
    /* CIRS art. 72.º n.º 5 (Lei 56/2023): as rendas de um direito real de
       habitação duradoura (DHD, DL 1/2020), «na parte respeitante ao pagamento
       da prestação pecuniária mensal», têm a redução de 20 pontos: 25 − 20 =
       5 %. Vão ao quadro 4.3, não ao 4.2 (não há comunicação da duração). A
       caução (naturezas 02 e 03 do 4.3) não tem a redução: paga a taxa da
       habitação (quadro43.reduzidas). */
    dhd:5},
  /* As isenções de IRS. As dos programas de arrendamento acessível declaram-se
     no quadro 6D do Anexo F (códigos da natureza do programa: 01 PAA, 02 PMA,
     03 PMAE — instruções do Anexo F; OC 20269); as rendas antigas anteriores
     ao RAU no 6H (EBF art. 46.º-A) e o ex-alojamento local no 6F (EBF art.
     74.º-A) — nesses dois só se indica o campo do 4.1, sem código. Um
     contrato isento paga 0 % (irs.js:irsTaxa); com englobamento as rendas
     isentas contam só para a taxa dos outros rendimentos (EBF art. 71.º-A n.º
     3). Os programas são todos de arrendamento habitacional (instruções do
     6D: «contratos de arrendamento habitacional»).
     INCERTO (6H): a data em que o RAU (DL 321-B/90, de 15 de outubro) entrou
     em vigor — umas fontes dizem 14, outras 18 de novembro de 1990 —, por
     isso a versão não a escreve: a pergunta do contrato (fisco.nrau3536)
     já diz «anterior ao RAU». */
  isencoes:[
    {id:'paa',nome:'Programa de Apoio ao Arrendamento (PAA)',curto:'PAA',quadro:'6D',codigo:'01',lei:'DL 68/2019, art. 20.º',finalidade:['hp','hnp'],
      texto:'Contrato inscrito no Programa de Apoio ao Arrendamento (o antigo Arrendamento Acessível), no IHRU: as rendas ficam isentas de IRS enquanto o contrato estiver no programa.'},
    {id:'pma',nome:'Programa municipal de arrendamento acessível (PMA)',curto:'programa municipal',quadro:'6D',codigo:'02',lei:'EBF art. 71.º-A',finalidade:['hp','hnp'],
      texto:'Contrato celebrado num programa municipal de habitação a renda acessível: as rendas ficam isentas de IRS durante o contrato.'},
    {id:'pmae',nome:'Programa municipal de alojamento estudantil (PMAE)',curto:'alojamento estudantil municipal',quadro:'6D',codigo:'03',lei:'EBF art. 71.º-A',finalidade:['hp','hnp'],
      texto:'Contrato celebrado num programa municipal de alojamento para estudantes: as rendas ficam isentas de IRS durante o contrato.'},
    /* EBF art. 46.º-A n.º 1: contratos de arrendamento para habitação
       celebrados antes do RAU e sujeitos aos arts. 35.º ou 36.º do NRAU,
       isentos pelo período de duração do contrato; quadro 6H, com o campo do
       4.1 (instruções do Anexo F). */
    {id:'prerau',nome:'Renda antiga: contrato anterior ao RAU, sujeito ao NRAU',curto:'renda antiga (anterior ao RAU)',quadro:'6H',codigo:'',semCodigo:true,lei:'EBF art. 46.º-A',
      pede:'nrau3536',finalidade:['hp','hnp'],
      texto:'Contrato de habitação celebrado antes do Regime do Arrendamento Urbano (o RAU, de 1990) e que ficou sujeito aos artigos 35.º ou 36.º do NRAU — o inquilino com rendimentos baixos, ou com 65 ou mais anos ou deficiência de 60 % ou mais: as rendas ficam isentas de IRS enquanto o contrato durar.'},
    /* EBF art. 74.º-A: imóvel em alojamento local registado e afeto a esse fim
       até 31/12/2022, passado a arrendamento para habitação permanente com o
       contrato celebrado e inscrito no Portal das Finanças até 31/12/2024
       (n.º 1); rendimentos até 31/12/2029 (n.º 2); quadro 6F, com o campo do
       4.1. A data de inscrição no Portal não está no contrato da app: a
       pergunta fisco.alRegistado2022 junta as duas condições. */
    {id:'al',nome:'Ex-alojamento local passado a arrendamento',curto:'ex-alojamento local',quadro:'6F',codigo:'',semCodigo:true,lei:'EBF art. 74.º-A',
      pede:'alRegistado2022',celebradoAte:'2024-12-31',ateAno:2029,finalidade:['hp'],
      texto:'Imóvel que estava em alojamento local registado até 31 de dezembro de 2022 e passou a arrendamento para habitação permanente, com o contrato celebrado e inscrito no Portal das Finanças até 31 de dezembro de 2024: as rendas ficam isentas de IRS até às de 2029.'}],
  colunas:['conservacao','condominio','imi','selo','taxas','outros'],
  /* os nomes das colunas no impresso do 4.1 e do 4.2, com os dois grupos */
  colunasNomes:{
    apos:{titulo:'Após início do arrendamento',conservacao:'Conservação e manutenção',condominio:'Condomínio',imi:'Imposto municipal sobre imóveis',selo:'Imposto do selo',taxas:'Taxas autárquicas',outros:'Outros'},
    obras:{titulo:'Com obras de conservação e manutenção',inicioContrato:'Data de início do contrato de arrendamento (ano, mês)',inicioGastos:'Data de início dos gastos (ano, mês)',valor:'Valor'},
    /* a última coluna das linhas do 4.1 e do 4.2, nos contratos em vigor antes de 2022 (D76) */
    atualizacao:'Atualização da renda superior a 1,02?'},
  /* «Códigos natureza das rendas» das instruções do quadro 4.1: 07 e 06 o
     arrendamento habitacional e o não habitacional (desde os rendimentos de
     2023), 05 as indemnizações que compensam perdas de rendas (CIRS art. 8.º
     n.º 2 g)), 02 a cedência de uso que não é arrendamento (publicidade,
     antenas, partes comuns: art. 8.º n.º 2 d) e e)). O dhd é o código da
     prestação mensal de um direito real de habitação duradoura no quadro 4.3
     (a tabela inteira, com a caução, está no quadro43). */
  naturezas:{habitacional:'07',naoHabitacional:'06',indemnizacao:'05',outras:'02',dhd:'01'},
  naturezasTexto:{'01':'Arrendamento (anos de 2015 a 2022)','02':'Cedência de uso do prédio ou de parte dele, que não arrendamento',
    '03':'Aluguer de maquinismos e mobiliários instalados no imóvel locado',
    '04':'Constituição, a título oneroso, de direitos reais de gozo temporários, ainda que vitalícios, sobre prédios rústicos, urbanos ou mistos',
    '05':'Indemnizações que visem compensar perdas de rendimentos da categoria F','06':'Arrendamento não habitacional','07':'Arrendamento habitacional'},
  /* Quadro 5 (sublocação): só a diferença entre a renda recebida e a paga ao
     senhorio, sem dedução nenhuma (CIRS art. 8.º n.º 2 c) e art. 41.º n.º
     6); «Códigos natureza das rendas» do quadro 5 nas instruções. */
  quadro5:{naturezas:{habitacional:'02',naoHabitacional:'01'},
    naturezasTexto:{'01':'Subarrendamento não habitacional','02':'Subarrendamento habitacional'}},
  /* Quadro 4.3 (instruções do Anexo F, «Quadro 4.3 – Contratos de direito
     real de habitação duradoura / gastos suportados e pagos / cessação dos
     contratos»; DL 1/2020): uma linha por DHD, campos 4901 e seguintes. As
     colunas, pela ordem do impresso (o nome de cada uma é o das instruções);
     as naturezas do rendimento (01 a prestação mensal — a única com a redução
     do art. 72.º n.º 5, `reduzidas` —, 02 a prestação anual da caução do 11.º
     ano em diante, 03 a dedução à caução por incumprimento do morador); os
     gastos obrigatórios (conservação extraordinária, condomínio e outros); e
     os motivos da cessação (01 a 06; o 01, por acordo, é o que regulariza a
     redução desde o início, art. 72.º n.º 20). */
  quadro43:{
    colunas:[['numero','Contrato – Número'],['inicio','Contrato – Data de início'],['escritura','Escritura pública ou documento particular – Data da celebração'],
      ['caucao','Escritura pública ou documento particular – Valor da caução'],['titular','Titular'],['matriz','Identificação matricial dos prédios'],
      ['valor','Rendimento – Valor ilíquido'],['natureza','Rendimento – Natureza'],['retencoes','Retenções na fonte'],['moradores','NIF morador(es)'],
      ['atualizacao','Atualização da renda superior a 1,02?'],['gastos','Gastos obrigatórios suportados e pagos'],['cessacao','Cessação dos efeitos do DHD']],
    naturezas:{prestacao:'01',caucao:'02',deducaoCaucao:'03'},
    naturezasTexto:{'01':'Prestação pecuniária mensal (rendas)','02':'Prestação pecuniária anual (caução) - 11.º ano e seguintes',
      '03':'Dedução ao montante da caução por incumprimento dos deveres do morador'},
    reduzidas:['01'],
    gastos:[['conservacaoExtra','Conservação extraordinária'],['condominio','Condomínio'],['outros','Outros']],
    motivos:[
      {codigo:'01',regulariza:true,curto:'Por acordo das partes',texto:'Cessação do DHD por acordo das partes (n.º 20 do artigo 72.º do Código do IRS)'},
      {codigo:'02',curto:'Morte do morador',texto:'Caducidade por morte do morador(es) (artigo 16.º do Decreto-Lei n.º 1/2020, de 9 de janeiro)'},
      {codigo:'03',curto:'Renúncia do morador',texto:'Extinção do DHD por renúncia do morador (artigo 17.º do Decreto-Lei n.º 1/2020, de 9 de janeiro)'},
      {codigo:'04',curto:'Incumprimento do proprietário',texto:'Resolução do DHD por incumprimento definitivo imputável ao proprietário (artigo 18.º do Decreto-Lei n.º 1/2020, de 9 de janeiro)'},
      {codigo:'05',curto:'O morador comprou o imóvel',texto:'Extinção do DHD por aquisição da propriedade pelo morador'},
      {codigo:'06',curto:'Fim do prazo',texto:'Cessação do DHD no final do prazo'}]},
  /* Os benefícios que não são isenções e que o quadro 6 identifica pelo campo
     do 4.1 (irs.js:irsBeneficios). Cada um diz onde se marca (`marca`: o
     campo do imóvel ou do bloco fiscal do contrato que o liga) e as condições
     que o motor confere: tipos, certificado, inicioDesde/inicioAte,
     concluida e donoEm (a reabilitação do imóvel e a data de compra),
     tipoPredio, finalidade, contratosAte e anos (pela data de celebração),
     vigenteAte (o último dia em que a lei o tem em vigor). E o que muda:
     taxa (a taxa especial da linha), fator (a parte das rendas que conta),
     fatorObras24 (a parte das obras dos 24 meses que conta). Os textos
     (nome, curto, texto, taxaTexto, aviso) são os da app.

     6A — o antigo art. 71.º n.º 7 do EBF (5 % nas rendas de imóveis em ARU
     recuperados, a), ou do NRAU objeto de ações de reabilitação, b); a
     comprovação do início e da conclusão pela câmara, n.os 23 e 24), na
     redação até 6/10/2023: https://info.portaldasfinancas.gov.pt/pt/
     informacao_fiscal/codigos_tributarios/bf_rep/ra/Pages/ebf71_ra202310.aspx.
     A Lei 56/2023 revogou-o sem regime transitório. A AT mudou de posição: a
     PIV 23119 (despacho de 2025-05-26) só o deixava até às rendas de 2024 de
     contratos celebrados até 6/10/2023; a PIV 28153 (despacho de 2026-09-25,
     pontos 10 e 11, lida a 2026-11-17 em informacoes_vinculativas/EBF/
     PIV_28153.pdf), pelo art. 11.º n.º 1 do EBF, mantém os 5 % «mesmo após
     essa data» a quem, «sendo em 6 de outubro de 2023 proprietário do
     imóvel», com a reabilitação «iniciada entre 2 de janeiro de 2008 e 6 de
     outubro de 2023», o arrende — sem limite de data do contrato. Segue-se a
     PIV 28153 (a mais recente; a PIV 30890 diz o mesmo), e a linha avisa
     (`aviso`). INCERTO: a parte de um imóvel comprada depois de 6/10/2023
     (PIV 28189 e 30028 recusam-na) — a app olha só para a data de compra do
     imóvel; e as rendas de um ano em que a reabilitação acabou a meio (a app
     dá os 5 % ao ano inteiro). Campos 01 a 05 do quadro 6A (instruções). O
     n.º 7 não distingue a finalidade: o não habitacional também paga 5 %.

     6B — EBF art. 59.º-I n.º 2 (aditado pela Lei 114/2017): os gastos do
     art. 41.º n.º 7 do CIRS (as obras dos 24 meses antes do arrendamento) em
     prédios afetos a lojas com história reconhecidas pelo município e no
     inventário nacional (Lei 42/2017, de 14 de junho) contam 110 % —
     bf_rep/Pages/ebf59i.aspx, lido a 2026-11-17. Campos 08 a 12 do quadro 6B.
     INCERTO: a vigência — o artigo não tem prazo próprio nem nota de
     prorrogação, e o art. 3.º do EBF faz caducar ao fim de cinco anos os
     benefícios da parte II; o modelo em vigor mantém o 6B, e o Martinho
     decidiu suportá-lo (2026-11-13). Só no não habitacional (uma loja).

     6C — EBF art. 59.º-G n.º 11 (as rendas de arrendamentos a entidades de
     gestão florestal reconhecidas «são considerados em 50 % do seu valor»),
     n.º 14 (arrendamentos até 31/12/2020, «12 anos, contados desde o ano da
     celebração do contrato») e n.º 15 (também as UGF); vigência prorrogada
     até 31/12/2025 (Lei 45-A/2024, art. 333.º) e até 31/12/2026 (Lei
     73-A/2025, art. 260.º n.º 3) — bf_rep/Pages/ebf59g.aspx, lido a
     2026-11-17. Para os rendimentos de 2027 só se o Orçamento o prorrogar
     outra vez (`vigenteAte`). Campos 13 a 17 do quadro 6C; só prédios
     rústicos (destinados à exploração florestal). */
  beneficios:[
    {id:'reab71',quadro:'6A',campos:['01','02','03','04','05'],marca:'imovel.reabilitacao',taxa:5,
      tipos:['aru','nrau'],certificado:true,inicioDesde:'2008-01-02',inicioAte:'2023-10-06',concluida:true,donoEm:'2023-10-06',
      nome:'Imóvel reabilitado (ARU ou NRAU)',curto:'imóvel reabilitado',
      lei:'EBF art. 71.º n.º 7, revogado pela Lei 56/2023; EBF art. 11.º n.º 1; PIV 28153',
      texto:'Imóvel numa área de reabilitação urbana recuperado, ou arrendado no NRAU e objeto de ações de reabilitação, com o início e a conclusão certificados pela câmara: as rendas pagam 5 %, se a reabilitação começou entre 2 de janeiro de 2008 e 6 de outubro de 2023 e já eras dono a 6 de outubro de 2023.',
      taxaTexto:'Nas rendas de imóveis reabilitados com certificado da câmara, se já eras dono a 6 de outubro de 2023',
      aviso:'Os 5 % seguem a posição mais recente da AT (informação vinculativa 28153, de setembro de 2026): a lei que os dava foi revogada em 2023, e em 2025 a AT chegou a dizer que só valiam até às rendas de 2024 (informação vinculativa 23119). Confirma antes de entregar.'},
    {id:'lojaHistoria',quadro:'6B',campos:['08','09','10','11','12'],marca:'imovel.lojaComHistoria',fatorObras24:1.1,finalidade:['nh'],
      nome:'Loja com História (Lei 42/2017)',curto:'Loja com História',
      lei:'EBF art. 59.º-I n.º 2; Lei 42/2017',
      texto:'Imóvel reconhecido pelo município como Loja com História e inscrito no inventário nacional: as obras de conservação dos 24 meses antes do arrendamento contam 110 %.'},
    {id:'egf',quadro:'6C',campos:['13','14','15','16','17'],marca:'contrato.egf',fator:0.5,tipoPredio:'R',contratosAte:'2020-12-31',anos:12,vigenteAte:'2026-12-31',
      nome:'Prédio rústico arrendado a uma entidade de gestão florestal (EGF ou UGF)',curto:'arrendado a uma EGF',
      lei:'EBF art. 59.º-G n.os 11, 14 e 15; Lei 45-A/2024, art. 333.º; Lei 73-A/2025, art. 260.º n.º 3',
      texto:'Prédio rústico florestal arrendado até 31 de dezembro de 2020 a uma entidade ou unidade de gestão florestal reconhecida: as rendas contam 50 %, durante 12 anos a contar do ano do contrato.'}],
  /* Quadro 10 (instruções do Anexo F): todos os contratos de habitação
     permanente com redução do art. 72.º que cessaram no ano, seja qual for o
     motivo, e os que saíram do PAA, PMA ou PMAE. Os textos das duas tabelas
     são os das instruções; o curto é o da app. */
  quadro10:{
    regimes:[
      {codigo:'01',texto:'Artigo 72.º, n.º 2, do Código do IRS',n:2},
      {codigo:'02',texto:'Artigo 72.º, n.º 3, do Código do IRS',n:3},
      {codigo:'03',texto:'Artigo 72.º, n.º 4, do Código do IRS',n:4},
      {codigo:'04',texto:'Artigo 72.º, n.º 5, do Código do IRS',n:5},
      {codigo:'05',texto:'Apoio ao Arrendamento',isencao:'paa'},
      {codigo:'06',texto:'Apoio ao Subarrendamento',isencao:'paa',sub:true},
      {codigo:'07',texto:'Arrendamento Municipal',isencao:'pma'},
      {codigo:'08',texto:'Subarrendamento Municipal',isencao:'pma',sub:true},
      {codigo:'09',texto:'Arrendamento para Alojamento Estudantil',isencao:'pmae'},
      {codigo:'10',texto:'Subarrendamento para Alojamento Estudantil',isencao:'pmae',sub:true}],
    motivos:[
      {codigo:'01',para:'reducao',quem:'senhorio',regulariza:true,curto:'Acabou antes do prazo, por motivo do senhorio',
        texto:'Cessação do contrato de arrendamento antes de decorridos os prazos de duração dos mesmos ou das suas renovações por motivo imputável ao senhorio/locador (número 20 do artigo 72.º do Código do IRS)'},
      {codigo:'02',para:'reducao',quem:'inquilino',curto:'Acabou antes do prazo, por motivo do inquilino',
        texto:'Cessação do contrato de arrendamento antes de decorridos os prazos de duração dos mesmos ou das suas renovações por motivo imputável ao inquilino/locatário'},
      {codigo:'03',para:'reducao',quem:'fim',curto:'Acabou no fim do prazo ou de uma renovação',
        texto:'Cessação do contrato de arrendamento no final dos prazos de duração dos mesmos ou das suas renovações'},
      {codigo:'04',para:'paa',quem:'senhorio',curto:'Saiu do PAA por motivo do senhorio',
        texto:'Cessação do enquadramento no Programa de Apoio ao Arrendamento por motivos imputáveis ao prestador (senhorio/locador/sublocador)'},
      {codigo:'05',para:'paa',quem:'inquilino',curto:'Saiu do PAA por motivo do inquilino',
        texto:'Cessação do enquadramento no Programa de Apoio ao Arrendamento por motivos imputáveis ao candidato (inquilino/locatário/sublocatário)'},
      {codigo:'06',para:'pma',quem:'senhorio',curto:'Saiu do programa municipal por motivo do senhorio',
        texto:'Cessação do enquadramento nos Programas Municipais para arrendamento habitacional a custos acessíveis, por motivo imputável ao prestador (senhorio/locador/sublocador)'},
      {codigo:'07',para:'pma',quem:'inquilino',curto:'Saiu do programa municipal por motivo do inquilino',
        texto:'Cessação do enquadramento nos Programas Municipais para arrendamento habitacional a custos acessíveis, por motivo imputável ao candidato (inquilino/locatário/sublocatário)'},
      {codigo:'08',para:'paa',quem:'fim',curto:'Saiu do PAA no fim do prazo ou de uma renovação',
        texto:'Cessação do enquadramento no Programa de Apoio ao Arrendamento – contratos no final dos prazos de duração dos mesmos ou das suas renovações'},
      {codigo:'09',para:'pma',quem:'fim',curto:'Saiu do programa municipal no fim do prazo ou de uma renovação',
        texto:'Cessação do enquadramento nos Programas Municipais para arrendamento habitacional a custos acessíveis – contratos no final dos prazos de duração dos mesmos ou das suas renovações'},
      {codigo:'10',para:'pmae',quem:'senhorio',curto:'Saiu do alojamento estudantil municipal por motivo do senhorio',
        texto:'Cessação do enquadramento nos Programas municipais para alojamento estudantil por motivos imputáveis ao prestador (senhorio/locador/sublocador)'},
      {codigo:'11',para:'pmae',quem:'inquilino',curto:'Saiu do alojamento estudantil municipal por motivo do inquilino',
        texto:'Cessação do enquadramento nos Programas municipais para alojamento estudantil por motivos imputáveis ao candidato (inquilino/locatário/sublocatário)'},
      {codigo:'12',para:'pmae',quem:'fim',curto:'Saiu do alojamento estudantil municipal no fim do prazo ou de uma renovação',
        texto:'Cessação do enquadramento nos Programas municipais para alojamento estudantil - contratos no final dos prazos de duração dos mesmos ou das suas renovações'}]},
  /* 4.4: as rendas que o senhorio paga pela casa nova a mais de 100 km da
     antiga, que arrendou (CIRS art. 41.º n.º 8, na redação do DL 57/2024);
     5: a sublocação; 4.3: o direito real de habitação duradoura (quadro43).
     campos: o número do primeiro campo de cada quadro de linhas no impresso
     (4001 no 4.1, 4501 no 4.2, 4901 no 4.3), que o fisco-resumo.js lê para
     numerar as linhas. */
  quadros:{semReducao:'4.1',comReducao:'4.2',datas:'4.2A',dhd:'4.3',mudanca100km:'4.4',sublocacao:'5',anosAnteriores:'8',englobamento:'6G',aimi:'9',cessados:'10',
    /* 9: as linhas dos prédios do quadro 9 (campos 9001 a 9020 do impresso do
       Anexo F, lidos pelo voto da lei do D71) */
    campos:{'4.1':4001,'4.2':4501,'4.3':4901,'9':9001}},
  prazos:{comunicacaoDuracao:'2026-02-15'},
  /* Para simular o englobamento (quadro 6G; a página já não o simula): as
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
    'Quem tem dispensa do recibo de renda eletrónico (65 anos ou mais, ou sem caixa postal eletrónica e com poucas rendas) entrega a declaração anual das rendas até ao fim de fevereiro — era até ao fim de janeiro.',
    'Desde julho de 2025 o inquilino com contabilidade organizada não retém quando a retenção seria inferior a 25 €.',
    'Desde agosto de 2025 o inquilino pode comunicar o contrato às Finanças se o senhorio não o fizer — a obrigação continua a ser do senhorio.'],
  passos:[
    {titulo:'Antes de abrir o Portal',
      texto:'Confirma nesta página que não falta nada: cada contrato com o número que a AT lhe deu, cada imóvel com o código da freguesia, o tipo e o artigo, cada inquilino com NIF ou país. O que falta está em «A tratar antes de entregar», e cada ponto abre o sítio onde se trata.'},
    {titulo:'O rosto da declaração',
      texto:'No Portal das Finanças, IRS › Entregar declaração, ano {ano}. Confirma o estado civil e se vais em tributação conjunta ou separada. Na coluna «Titular» do Anexo F, A e B são as posições no rosto: A é o sujeito passivo A (quadro 3 do rosto) e B o sujeito passivo B (quadro 5A), só em conjunta — quem é A e quem é B decide-o o casal no rosto. Em conjunta entram as rendas dos dois. Com rendas não há IRS Automático.'},
    {titulo:'Quadros 4.1 e 4.2: uma linha por contrato',
      texto:'No 4.1 os contratos sem redução de taxa; no 4.2 os de habitação permanente com redução pela duração, e para cada um o 4.2A com as datas do contrato e da última renovação. De cada linha desta página copias o n.º do contrato, a data de início, a freguesia, o tipo, o artigo, a fração, o titular, a renda ilíquida, a natureza (07 habitacional, 06 não habitacional, 05 indemnizações que compensam rendas perdidas, 02 cedência de uso que não é arrendamento), as retenções e o NIF ou o país do inquilino. Uma fração por linha; num imóvel em compropriedade cada um declara a sua quota.'},
    {titulo:'Os gastos, na mesma linha',
      texto:'Na tabela de baixo, pelo mesmo número de campo, no grupo «Após início do arrendamento»: conservação e manutenção, condomínio, imposto municipal sobre imóveis pago no ano, imposto do selo, taxas autárquicas e outros — só os do período em que o imóvel esteve arrendado. As obras de conservação dos 24 meses antes de um contrato vão no grupo «Com obras de conservação e manutenção», no ano em que ele começa, com o ano e o mês do início do contrato e do primeiro pagamento — e só se, entretanto, o imóvel não teve outro uso (a tua casa, a de férias, alojamento local). Guarda as faturas com o teu NIF: a AT pode pedi-las durante quatro anos.'},
    {titulo:'Sublocação e casa nova a mais de 100 km (quadros 5 e 4.4)',
      texto:'Se arrendas um imóvel e o subarrendas, não vai ao 4.1: vai ao quadro 5, com a renda que recebes, a que pagas ao senhorio e o NIF dele, e paga-se sobre a diferença, sem gastos. Se mudaste a tua casa para mais de 100 km da antiga, onde viveste pelo menos 12 meses, e arrendaste a antiga, o quadro 4.4 deduz às rendas dela a renda que pagas na nova — com os dois contratos registados no Portal.'},
    {titulo:'Rendas de anos anteriores (quadro 8)',
      texto:'Uma renda de outro ano recebida em {ano} já está no valor da linha. No quadro 8 dizes que parte é de que ano: no 8A se englobares (o valor reparte-se pelos anos a que respeita), ou no 8B se entregares declarações de substituição desses anos, até cinco para trás.'},
    {titulo:'Englobar ou não (quadro 6G)',
      texto:'Sem englobamento, as rendas pagam a taxa especial: 25 % na habitação, 28 % no resto, menos nos contratos longos, 5 % nos imóveis reabilitados do quadro 6A e na prestação de um direito real de habitação duradoura (quadro 4.3). Com englobamento somam-se aos teus outros rendimentos e pagam a taxa dos escalões — compensa quando o teu escalão fica abaixo da taxa especial. A opção vale para todas as rendas: simula as duas no Portal antes de entregar.'},
    {titulo:'AIMI e contratos que acabaram (quadros 9 e 10)',
      texto:'Se pagaste o Adicional ao IMI, o quadro 9 abate-o ao imposto na parte dos prédios arrendados (não é um gasto do 4.1). Cada contrato com redução de taxa, ou isento num programa de arrendamento acessível, que acabou no ano vai ao quadro 10, seja qual for o motivo: o regime, o n.º, o ano de início do benefício, a data e o motivo (nos contratos com redução, a data e o motivo também se comunicam no Portal até 15 de fevereiro do ano seguinte). Se acabou antes do prazo por motivo do senhorio, a redução perde-se desde o início do contrato ou da renovação, e a diferença de imposto de cada ano paga-se nesta declaração, com juros compensatórios.'},
    {titulo:'Simular e entregar',
      texto:'Simula, confere o valor a pagar ou a receber e entrega até {ate}. Um resultado negativo das rendas não se perde: abate às rendas dos seis anos seguintes.'}],
});
