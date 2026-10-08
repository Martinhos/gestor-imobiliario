/* ================= IRS 2026 =================
   As regras dos rendimentos de 2026: a declaração que se entrega de 1 de
   abril a 30 de junho de 2027. O formato é o do irs-2025.js.

   O que mudou de 2025 para cá: a taxa de 10 % nas rendas moderadas, criada
   pelo DL 97/2026 de 20 de maio (art. 45.º-C do EBF, ao abrigo da Lei
   9-A/2026), com efeitos desde 1 de janeiro de 2026 e até aos rendimentos de
   2029 — contrato exclusivamente para habitação (permanente ou não; a lei não
   o pede), renda mensal até 2,5 × a retribuição mínima de 2026 (920 €), ou
   seja 2 300 €; o não habitacional continua a 28 %, e uma taxa mais baixa
   pela duração (5 %, ou menos de 10 % com renovações) ganha. A retenção na
   fonte nessas rendas passa a 10 % (CIRS art. 101.º n.º 1 f)). E o RSAA
   (anexo III do mesmo DL), que isenta de IRS desde 1 de setembro de 2026 e
   substitui o PAA — ainda sem a portaria dos limites.

   PROVISÓRIO: o Anexo F para os rendimentos de 2026 ainda não foi aprovado
   (a 2026-10-08 não há portaria; nos últimos anos saiu entre fevereiro e
   março do ano da entrega). Os quadros, as colunas e os códigos aqui são os
   do modelo de 2025; quando a portaria sair, confirma-se tudo e muda-se o
   `modelo` para oficial. O OE 2027 (Proposta de Lei 110/XVII, entregue a
   2026-10-08) não mexe na categoria F.

   Fontes (consultadas a 2026-10-08): DL 97/2026 (DR 1.ª série n.º 97,
   2026-05-20), arts. 2.º, 3.º, 9.º, 14.º, 15.º, 17.º e 18.º e o anexo III;
   EBF art. 45.º-C; CIRS arts. 72.º e 101.º; a informação vinculativa
   PIV 30751 (2026-09-15, a taxa de 10 % com uma empresa inquilina); e o
   Doutor Finanças («10%? IRS sobre rendimentos prediais: o que muda com o OE
   2026?», 2026-01-05) — que atribui a taxa ao OE e lhe pede habitação
   permanente; seguiu-se a lei. */
registarAnoIrs({
  ano:2026,
  entrega:{de:'2027-04-01',ate:'2027-06-30'},
  modelo:{oficial:false,
    texto:'Ainda não há Anexo F aprovado para os rendimentos de 2026 — a portaria costuma sair entre fevereiro e março do ano da entrega. Até lá esta página segue os quadros do modelo de 2025, e o campo onde se assinala a taxa de 10 % ainda não se conhece.'},
  taxas:{
    habitacional:25,
    naoHabitacional:28,
    duracao:[
      {desde:'2023-10-07',escaloes:[{meses:240,taxa:5},{meses:120,taxa:10},{meses:60,taxa:15,porRenovacao:2,minimo:5}]},
      {desde:'2019-01-01',ate:'2023-10-06',escaloes:[{meses:240,taxa:10},{meses:120,taxa:14},{meses:60,taxa:23,porRenovacao:5,minimo:14},{meses:24,taxa:26,porRenovacao:2,minimo:14}]}],
    /* EBF art. 45.º-C: 10 % até aos rendimentos de 2029, renda até 2 300 €/mês */
    rendaModerada:{taxa:10,limiteMensal:2300,ate:2029}},
  colunas:['conservacao','condominio','imi','selo','taxas','outros'],
  naturezas:{habitacional:'07',naoHabitacional:'06'},
  quadros:{semReducao:'4.1',comReducao:'4.2',datas:'4.2A',anosAnteriores:'8',englobamento:'6G',aimi:'9',cessados:'10'},
  prazos:{comunicacaoDuracao:'2027-02-15'},
  novidades:[
    'Taxa de 10 % nas rendas de habitação até 2 300 € por mês, em contratos novos e já existentes, de 2026 a 2029 (Decreto-Lei 97/2026). Conta a renda inteira do contrato, com móveis e serviços. Se a duração já dá uma taxa mais baixa, fica essa; o não habitacional continua a 28 %.',
    'O inquilino com contabilidade organizada passa a reter 10 %, e não 25 %, nessas rendas. A retenção é um adiantamento do imposto: o que se reteve a mais acerta-se na declaração.',
    'Regime Simplificado de Arrendamento Acessível (RSAA), desde 1 de setembro de 2026: rendas isentas de IRS em contratos de habitação até ao limite por tipologia, com pelo menos três anos, submetidos ao IHRU até 15 de janeiro do ano seguinte. A portaria com os limites ainda não saiu.',
    'O Programa de Apoio ao Arrendamento acabou a 1 de setembro de 2026; os contratos que já estavam nele mantêm a isenção.',
    'O Anexo F destes rendimentos ainda não foi aprovado e deve trazer um campo para a taxa de 10 % e outro para o RSAA. Até a portaria sair, esta versão é provisória — e esta página di-lo.'],
  passos:[
    {titulo:'Antes de abrir o Portal',
      texto:'Confirma nesta página que não falta nada: cada contrato com o número que a AT lhe deu, cada imóvel com o código da freguesia, o tipo e o artigo, cada inquilino com NIF ou país. O que falta está em «Obrigações», e cada ponto abre o sítio onde se trata.'},
    {titulo:'O rosto da declaração',
      texto:'No Portal das Finanças, IRS › Entregar declaração, ano {ano}. Confirma o estado civil e se vais em tributação conjunta ou separada: é isso que decide o titular de cada linha do Anexo F — A és tu, B o cônjuge (só em conjunta). Com rendas não há IRS Automático.'},
    {titulo:'Quadros 4.1 e 4.2: uma linha por contrato',
      texto:'No 4.1 os contratos sem redução pela duração; no 4.2 os de habitação permanente com redução, e para cada um o 4.2A com as datas do contrato e da última renovação. De cada linha desta página copias o n.º do contrato, a data de início, a freguesia, o tipo, o artigo, a fração, o titular, a renda ilíquida, a natureza (07 habitacional, 06 não habitacional), as retenções e o NIF ou o país do inquilino. Nos contratos com renda até 2 300 €, procura no modelo novo o campo da taxa de 10 %.'},
    {titulo:'Os gastos, na mesma linha',
      texto:'Na tabela de baixo, pelo mesmo número de campo: conservação e manutenção, condomínio, IMI pago no ano, imposto do selo, taxas autárquicas e outros — só os do período em que o imóvel esteve arrendado. As obras de conservação dos 24 meses antes de um contrato vão nas três colunas próprias, no ano em que ele começa. Guarda as faturas com o teu NIF: a AT pode pedi-las durante quatro anos.'},
    {titulo:'Rendas de anos anteriores (quadro 8)',
      texto:'Uma renda de outro ano recebida em {ano} já está no valor da linha. No quadro 8 dizes que parte é de que ano: no 8A se englobares (o valor reparte-se pelos anos a que respeita), ou no 8B se entregares declarações de substituição desses anos, até cinco para trás.'},
    {titulo:'Englobar ou não (quadro 6G)',
      texto:'Sem englobamento, as rendas pagam a taxa especial: 10 % nas rendas moderadas, 25 % na restante habitação, 28 % no resto, menos nos contratos longos. Com englobamento somam-se aos teus outros rendimentos e pagam a taxa dos escalões — com rendas a 10 % quase nunca compensa (o primeiro escalão de 2026 é 12,5 %). A opção vale para todas as rendas: simula as duas no Portal.'},
    {titulo:'AIMI e contratos que acabaram (quadros 9 e 10)',
      texto:'Se pagaste o Adicional ao IMI, o quadro 9 abate-o ao imposto na parte dos prédios arrendados (não é um gasto do 4.1). Um contrato com redução de taxa que acabou antes do prazo por iniciativa do senhorio declara-se no quadro 10.'},
    {titulo:'Simular e entregar',
      texto:'Simula, confere o valor a pagar ou a receber e entrega até {ate}. Um resultado negativo das rendas não se perde: abate às rendas dos seis anos seguintes.'}],
});
