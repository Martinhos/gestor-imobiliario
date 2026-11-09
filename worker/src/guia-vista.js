/* O guia «Declarar as rendas», em público.
   ---------------------------------------
   Um senhorio que pesquisa como declarar as rendas no IRS chega aqui, e o
   guia acompanha-o do princípio ao fim (ticket a89a5fcb, 2026-11-09): 1. se
   tem de declarar, 2. onde, 3. como preenche o Anexo F, 4. o que pode
   deduzir — e as fontes oficiais no fim. É informação, não uma função da
   app — a montra continua a não prometer a Declaração, que só existe em dev
   (web/app/servicos.js, soDev).

   A parte 4 (a regra geral, o que podes, o que não podes, o que pede
   cuidado, os documentos) e os quatro pontos do Anexo F na parte 3 são o
   texto que o Martinho verificou a 2026-11-08 contra o artigo 41.º do Código
   do IRS e as informações vinculativas da AT, palavra a palavra. As partes
   1 a 3 escreveram-se a 2026-11-09 só a partir de fontes oficiais abertas
   (o Código do IRS e o EBF na AT, as instruções do Anexo F, a Portaria
   104/2026/1, o folheto das senhas, o Diário da República), cada frase com a
   sua fonte em FONTES; o Martinho verifica-as antes de promover. Escrito por
   tu, como o resto da casa. Nenhuma regra fiscal se acrescenta aqui sem
   passar por ele.

   A página é da família dos documentos legais (legal-vista.js): o cabeçalho
   de vidro, a leitura num cartão a 820 px, as duas letras auto-alojadas. Não
   leva JavaScript nenhum: o conteúdo vive como dados (GUIA) e o HTML sai
   deles no servidor. O que se pode deduzir leva um visto, o que não se pode
   leva uma cruz — formas diferentes, e não só cores, porque o Samsung
   Internet escurece à força e pode trocar a cor de fundo.

   Desde 2026-11-08 o guia é a porta do IRS na pesquisa (decisão do
   Martinho): o título, a descrição e o h1 dizem IRS, e na raiz vão os dados
   estruturados (o caminho e o artigo). A montra leva até ele pelo botão
   «IRS» do cabeçalho, pelo cartão e pelo rodapé; daqui volta-se a ela pelo
   caminho no topo (Início › o guia) e pelo «Voltar ao início». */

import { CSP_ESTRITA } from './lib/http.js';

const APP = 'https://app.rendorium.com';
const SITIO = 'https://rendorium.com';
// o endereço do guia, o mesmo em todos os hosts (index.js) e no rodapé da montra
export const CAMINHO_GUIA = '/guias/declarar-rendas';
// a última revisão do texto com o Martinho: a data do Article e do mapa do sítio
// (a ficha da página escreve-a por extenso, «Verificado a»: as duas mudam juntas)
export const GUIA_REVISTO = '2026-11-08';

/* O que os motores de busca e as redes mostram (≤ 60 e ≤ 160 caracteres),
   com os termos de quem pesquisa: IRS, rendas, declarar, Anexo F, deduzir.
   O título é o h1 (decisão do Martinho, 2026-11-09), sem o « — Rendorium»,
   que o passava dos 60. O h1 é também o título do cartão da montra
   (landing.js, que o importa) e da secção dele no rasto (equipa-guiao.js);
   o nome curto é o do caminho, do rodapé da montra e do rasto. */
export const H1 = 'IRS das rendas: como declarar e o que podes deduzir';
const TITULO = H1;
const DESCRICAO = 'Se tens de declarar as rendas no IRS, onde e como preenches o Anexo F, e o que podes deduzir: ' +
  'IMI, condomínio, obras, seguros e os documentos a guardar.';
const NOME_CURTO = 'Guia do IRS das rendas';

// os ícones de traço da casa (grelha de 24, traço 1.8), como os da montra
const VISTO = 'M5 12.5l4.5 4.5L19 7';
const CRUZ = 'M6.5 6.5l11 11M17.5 6.5l-11 11';
const AVISO = 'M12 8v5M12 16.5v.5M10.3 3.8L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z';
const ESCUDO = 'M12 3l7 3v5.5c0 4.3-2.9 8-7 9.5-4.1-1.5-7-5.2-7-9.5V6z';
const VOLTAR = 'M19 12H5M11 6l-6 6 6 6';
// a gaveta do cabeçalho (a mesma da montra, landing.js:gavetaDoCabecalho): as riscas e o chevron
const MENU = 'M4 7h16M4 12h16M4 17h16';
const SEGUIR = 'M9 6l6 6-6 6';

/* As fontes oficiais, pela ordem do guia; as das partes 1 a 3 e a do artigo
   41.º têm uma chave (`id`), por que os blocos `fonte` e `ir` as citam. `url`
   só quando o endereço oficial
   se confirmou a abrir (AT, Portal das Finanças, Diário da República); sem
   ele, a fonte fica como texto — uma ligação errada num guia fiscal é pior
   do que nenhuma.

   As das partes 1 a 3 abriram-se a 2026-11-09: as páginas do Código do IRS
   e do EBF na AT pelo texto em vigor; os PDF da AT (as instruções do Anexo
   F, «modelo em vigor a partir de janeiro de 2025»; a Portaria 104/2026/1,
   arts. 1.º e 2.º; o folheto das senhas) lidos por inteiro; o Portal das
   Finanças pela página de entrada; as do Diário da República (a app deles
   só mostra o texto com JavaScript) no headless, com o diploma e o artigo
   citados à vista (.unlazy/qa-ronda8/guia-fontes-dr.mjs). O que se cita de
   cada uma:
   - cirs8: n.º 1, as rendas são rendimentos da categoria F, salvo a opção
     pela categoria B;
   - cirs57: n.º 1, a declaração anual, relativa aos rendimentos do ano
     anterior;
   - cirs60: n.º 1, de 1 de abril a 30 de junho;
   - cirs22: n.º 3 b), as rendas do art. 72.º não se englobam, salvo opção;
     n.º 5, quem opta engloba todos os rendimentos da mesma categoria;
   - cirs72: n.º 1 e) 28 %; n.º 2 25 % no habitacional; n.os 3 a 5 as
     reduções da habitação permanente; n.º 13 a opção pelo englobamento;
     n.º 20 a perda das reduções; n.º 23 sem reduções acima do limite;
   - ebf45c: n.º 1, 10 % nos contratos só para habitação com renda até aos
     limites do DL 97/2026, rendimentos até 31 de dezembro de 2029, salvo
     taxa mais favorável;
   - dl97: art. 2.º n.º 2 a), o limite é 2,5 vezes a retribuição mínima
     mensal de 2026; art. 18.º n.º 2, o 45.º-C produz efeitos desde 1 de
     janeiro de 2026;
   - dl139: art. 3.º, a retribuição mínima mensal de 2026 é 920 € (art. 2.º:
     no continente);
   - portaria104: art. 2.º n.º 1, a Modelo 3 e os anexos entregam-se por
     transmissão eletrónica de dados; art. 1.º n.º 3 a), o Anexo F e as
     instruções da Portaria 72-B/2025/1 mantêm-se em vigor;
   - portal: o endereço do Portal das Finanças (o da Portaria 104/2026/1,
     art. 3.º);
   - senhas: os meios de entrar no Portal (NIF e senha, ou Autenticação.gov
     com o Cartão de Cidadão ou a Chave Móvel Digital) e o registo;
   - anexoF: quem apresenta o anexo, uma linha por prédio e por fração, o
     número do contrato, a identificação matricial, o titular, as rendas e
     a natureza (06 e 07), as retenções, o inquilino, os gastos, as obras
     dos 24 meses, os quadros 4.1, 4.2, 4.2A e 6G, e a comunicação da
     Portaria 110/2019 até 15 de fevereiro.
   As da parte 4, do texto do Martinho, verificadas a 2026-11-08. */
const FONTES = [
  { id: 'cirs8', nome: 'AT, Código do IRS, artigo 8.º, redação vigente', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs8.aspx' },
  { id: 'cirs57', nome: 'AT, Código do IRS, artigo 57.º, redação vigente', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs57.aspx' },
  { id: 'cirs60', nome: 'AT, Código do IRS, artigo 60.º, redação vigente', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs60.aspx' },
  { id: 'cirs22', nome: 'AT, Código do IRS, artigo 22.º, redação vigente', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs22.aspx' },
  { id: 'cirs72', nome: 'AT, Código do IRS, artigo 72.º, redação vigente', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs72.aspx' },
  { id: 'ebf45c', nome: 'AT, Estatuto dos Benefícios Fiscais, artigo 45.º-C', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/bf_rep/Pages/ebf45c.aspx' },
  { id: 'dl97', nome: 'Diário da República, Decreto-Lei n.º 97/2026, de 20 de maio', url: 'https://diariodarepublica.pt/dr/detalhe/decreto-lei/97-2026-1124493227' },
  { id: 'dl139', nome: 'Diário da República, Decreto-Lei n.º 139/2025, de 29 de dezembro', url: 'https://diariodarepublica.pt/dr/detalhe/decreto-lei/139-2025-992879809' },
  { id: 'portaria104', nome: 'AT, Portaria n.º 104/2026/1, de 5 de março: os modelos da declaração Modelo 3', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/legislacao/diplomas_legislativos/Documents/portaria-104-2026-1.pdf' },
  { id: 'portal', nome: 'Portal das Finanças', url: 'https://www.portaldasfinancas.gov.pt/' },
  { id: 'senhas', nome: 'AT, folheto «Acesso ao Portal das Finanças: autenticação e senhas»', url: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/Folhetos_informativos/Documents/senhas.pdf' },
  { id: 'anexoF', nome: 'AT, Anexo F da declaração Modelo 3 e instruções de preenchimento, modelo em vigor desde janeiro de 2025', url: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/modelos_formularios/irs/Documents/Mod_3_anexo_F.pdf' },
  { id: 'cirs41', nome: 'AT, Código do IRS, artigo 41.º, redação vigente', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs41.aspx' },
  { nome: 'AT, página de apoio sobre rendimentos prediais', url: 'https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Cidadaos/Rendimentos/Prediais/Paginas/default.aspx' },
  { nome: 'AT, Informação Vinculativa, processo 1115/2017: certificado energético, seguro, IMI, condomínio e reparações', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/informacoes_vinculativas/rendimento/cirs/Documents/PIV_11676_Cat_F_Despesas_elegiveis_certificado_energetico_pintura_proporcionalidade_mensal_IMI.pdf' },
  { nome: 'AT, Informação Vinculativa, processo 4074/2017: instalações, sanita e eletrodomésticos', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/informacoes_vinculativas/rendimento/cirs/Documents/PIV_12846.pdf' },
  { nome: 'AT, Informação Vinculativa, processo 615/2016: mediação e gestão imobiliária', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/informacoes_vinculativas/rendimento/cirs/Documents/PIV_10049_Cat_F_despesas_com_agencia_imobiliaria_intermediacao_e_gestao_do_arrendamento.pdf' },
  { nome: 'AT, Informação Vinculativa, processo 27168: fundo comum de reserva', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/informacoes_vinculativas/rendimento/cirs/Documents/PIV_27168.pdf' },
  { nome: 'AT, Informação Vinculativa, processo 23002: água, luz e gás', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/informacoes_vinculativas/rendimento/cirs/Documents/PIV_23002.pdf' },
  { nome: 'AT, Informação Vinculativa, processo 28509: água, eletricidade e Internet', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/informacoes_vinculativas/rendimento/cirs/Documents/PIV_28509.pdf' },
  { nome: 'Diário da República, Lei n.º 56/2023, de 6 de outubro', url: 'https://diariodarepublica.pt/dr/detalhe/lei/56-2023-222477692' },
];

/* O conteúdo do guia. Cada secção tem o id da âncora, o título e os blocos,
   por ordem: `p` (parágrafo), `sim`/`nao` (listas com visto ou cruz), `cond`
   (condições, que se cumprem todas), `info` (factos soltos, com o ponto das
   condições), `doc` (papéis a guardar), `grupo` (um subtítulo com os seus
   blocos), `nota` (uma caixa âmbar), `fonte` (a linha da fonte principal,
   com a chave da fonte) e `ir` (o botão para um sítio oficial, idem).

   A parte 4, «As deduções», são as cinco secções do texto verificado pelo
   Martinho, tal e qual, cada uma com o id de antes (há ligações de fora para
   #pode-deduzir e as outras). */
const DEDUCOES = [
  { id: 'regra', titulo: 'A regra geral', blocos: [
    { p: 'Nos termos do artigo 41.º, n.os 1 e 9, do Código do IRS, podes deduzir aos rendimentos prediais brutos, ' +
      'relativamente a cada prédio ou parte de prédio, os gastos que sejam, cumulativamente:' },
    { cond: [
      'Efetivamente suportados por ti, senhorio.',
      'Efetivamente pagos.',
      'Necessários para obter ou garantir as rendas.',
      'Relativos ao imóvel que gerou os rendimentos.',
      'Documentalmente comprovados.',
    ] },
    { p: 'A lei exclui expressamente gastos financeiros, depreciações, mobiliário, eletrodomésticos, artigos de ' +
      'conforto ou decoração e o Adicional ao IMI (AIMI).' },
    { fonte: 'cirs41', texto: 'Fonte principal: artigo 41.º do Código do IRS, AT.' },
  ] },

  { id: 'pode-deduzir', titulo: 'O que podes deduzir', blocos: [
    { grupo: 'Impostos e contrato', blocos: [{ sim: [
      'IMI pago no ano, desde que respeite a imóvel ou parte de imóvel cujo rendimento seja tributado nesse mesmo ' +
        'ano. A lei não exige rateio pelos meses arrendados: a AT já aceitou o valor anual integral quando o imóvel ' +
        'produziu rendas nesse ano.',
      'Imposto do Selo do contrato de arrendamento, pago no ano e referente a imóvel que produziu rendas tributadas ' +
        'nesse ano.',
      'Seguro de renda, expressamente incluído no artigo 41.º, n.º 1.',
    ] }] },
    { grupo: 'Condomínio', blocos: [
      { sim: [
        'Quotas e encargos obrigatórios de condomínio, efetivamente pagos por ti, relativos à fração arrendada.',
        'Se tiveres várias frações no mesmo edifício, apenas a parte correspondente à fração arrendada, imputada de ' +
          'acordo com a respetiva permilagem.',
        'Obras nas partes comuns, no ano em que o condomínio utiliza efetivamente as verbas para pagar a obra, com ' +
          'documento do administrador que identifique a obra e a quota-parte da fração.',
      ] },
      { nota: 'Fundo comum de reserva', texto: 'A mera entrega de dinheiro ao fundo não é dedutível no ano da entrega ' +
        'se a verba ainda não tiver sido utilizada. A despesa conta no ano em que o condomínio usa o fundo para pagar ' +
        'obras elegíveis e te emite o respetivo documento, como condómino.' },
    ] },
    { grupo: 'Conservação e manutenção', blocos: [
      { p: 'Desde que se destinem a manter ou repor o imóvel e estejam devidamente documentadas:' },
      { sim: [
        'Pintura.',
        'Reparação de paredes, tetos e pavimentos.',
        'Reparação de infiltrações e telhado.',
        'Canalização e instalação elétrica.',
        'Reparação ou substituição de portas e janelas integradas no imóvel.',
        'Reparação ou substituição de armários fixos e bancadas de cozinha, desde que não sejam tratados como mobiliário.',
        'Substituição de sanita.',
        'Inspeção da instalação de gás.',
        'Restauro, reparação e limpeza ligados à conservação do edifício.',
      ] },
    ] },
    { grupo: 'Despesas anteriores ao arrendamento', blocos: [{ sim: [
      'Obras de conservação e manutenção pagas nos 24 meses anteriores ao início do arrendamento, desde que o imóvel ' +
        'não tenha sido utilizado entretanto para fim diferente do arrendamento.',
    ] }] },
    { grupo: 'Serviços ligados ao arrendamento', blocos: [{ sim: [
      'Certificado energético, por ser necessário à operação de arrendamento.',
      'Comissão de mediação imobiliária para encontrar inquilino, se a ligação ao contrato e ao imóvel estiver ' +
        'inequivocamente documentada.',
      'Gestão do arrendamento por agência imobiliária, nas mesmas condições de prova e conexão direta.',
    ] }] },
    { grupo: 'Situação especial: mudança da habitação própria', blocos: [
      { p: 'Podes abater, até ao valor das rendas prediais brutas, as rendas que pagas por uma nova habitação própria ' +
        'e permanente, quando se verificarem cumulativamente as condições do artigo 41.º, n.º 8:' },
      { cond: [
        'O imóvel agora arrendado foi habitação própria e permanente tua ou do teu agregado durante pelo menos 12 meses.',
        'O domicílio fiscal foi transferido para local situado a mais de 100 km.',
        'O imóvel de origem é objeto de arrendamento habitacional.',
        'Os dois contratos de arrendamento estão registados no Portal das Finanças.',
      ] },
    ] },
  ] },

  { id: 'nao-pode-deduzir', titulo: 'O que não podes deduzir', blocos: [{ nao: [
    'AIMI, Adicional ao Imposto Municipal sobre Imóveis. Está expressamente excluído no artigo 41.º, n.º 1.',
    'Juros do crédito à habitação ou de outro financiamento.',
    'Amortização do capital do empréstimo.',
    'Comissões bancárias e outros gastos financeiros.',
    'Seguro de vida associado ao empréstimo.',
    'Depreciação ou desvalorização contabilística do imóvel.',
    'Compra ou substituição de eletrodomésticos, incluindo frigorífico, forno, placa, máquina de lavar, televisão e similares.',
    'Reparação de eletrodomésticos, incluindo esquentadores classificados como eletrodomésticos, segundo a posição ' +
      'expressa da AT.',
    'Móveis, como camas, sofás, mesas, cadeiras e armários não incorporados no imóvel.',
    'Lâmpadas, artigos de conforto e decoração.',
    'Seguro multirriscos facultativo da habitação, segundo a informação vinculativa da AT de 2017. O seguro ' +
      'obrigatório do prédio pode integrar as despesas de manutenção, mas a componente facultativa ou de recheio não ' +
      'deve ser deduzida sem separação documental.',
    'Entrega para o fundo comum de reserva enquanto a verba não tiver sido efetivamente usada pelo condomínio numa ' +
      'obra elegível.',
    'Despesas pagas pelo inquilino.',
    'Trabalho feito por ti próprio, sem fatura nem pagamento comprovável.',
    'Despesas relativas a frações não arrendadas.',
    'Multas, coimas e juros de mora.',
    'Na sublocação, quaisquer deduções à diferença entre a renda recebida e a renda paga pelo sublocador.',
  ] }] },

  { id: 'cuidado', titulo: 'O que pede cuidado', blocos: [
    { nota: 'Água, eletricidade, gás e Internet', texto: 'Não são dedutíveis só porque as pagaste. De acordo com as ' +
      'informações vinculativas mais recentes da AT, só as deves considerar quando:',
    cond: [
      'O contrato declare expressamente que estão incluídas na renda e são responsabilidade do senhorio.',
      'Essa estrutura esteja refletida na declaração Modelo 2 do Imposto do Selo, incluindo o campo aplicável ao ' +
        'valor das despesas.',
      'Existam faturas e prova legal do pagamento.',
    ],
    fim: 'Se estas condições não estiverem cumpridas, não deduzas os consumos do inquilino.' },
    { nota: 'Honorários de advogado, solicitador, contabilista ou custos judiciais', texto: 'O artigo 41.º contém uma ' +
      'regra geral ampla, mas, para este guia, não foi localizada orientação oficial suficientemente específica que ' +
      'permita classificar todas estas despesas como automaticamente dedutíveis. Não as incluas só com base numa ' +
      'descrição genérica. Para montantes relevantes, obtém resposta escrita através do e-balcão ou apresenta um ' +
      'pedido de informação vinculativa, identificando o serviço, o imóvel e a ligação direta à obtenção ou garantia ' +
      'das rendas.' },
    { nota: 'Obras de melhoria ou ampliação', texto: 'Conservação e manutenção são dedutíveis; uma ampliação, ' +
      'valorização ou transformação substancial pode não o ser. Quando uma fatura mistura reparação com melhoria, ' +
      'pede ao empreiteiro a discriminação de materiais e mão de obra por intervenção.' },
  ] },

  { id: 'documentos', titulo: 'Os documentos a guardar', blocos: [
    { p: 'Para cada imóvel e ano, conserva:' },
    { doc: [
      'Fatura ou documento fiscal com o teu NIF.',
      'Descrição que identifique o serviço e, idealmente, a morada ou o artigo matricial.',
      'Recibo e prova bancária do pagamento.',
      'Liquidação e comprovativo do IMI.',
      'Comprovativo do Imposto do Selo.',
      'Contrato de arrendamento e aditamentos.',
      'Declaração e recibos do condomínio.',
      'Atas que aprovaram quotas extraordinárias ou obras.',
      'Declaração do administrador sobre a utilização do fundo de reserva e a quota-parte da obra.',
      'Orçamento, contrato e fatura discriminada das obras.',
      'Fotografias antes e depois, sobretudo em obras relevantes.',
      'Apólices e recibos de seguros, com separação das coberturas.',
      'Contrato e fatura da agência imobiliária.',
      'Certificado energético e respetiva fatura.',
    ] },
    { nota: 'Os três elementos', texto: 'Uma fatura isolada pode não demonstrar o pagamento nem a ligação ao imóvel. ' +
      'Guarda os três: a natureza da despesa, a identificação do imóvel e a prova do pagamento.' },
  ] },
];

/* O guia, pela ordem de quem declara: se tens de declarar, onde, como, o
   que podes deduzir (a parte com `intro` e `seccoes`, numeradas 4.1 a 4.5)
   e as fontes. Nas partes 1 a 3 cada frase fiscal tem a fonte entre
   parênteses e em FONTES (o comentário diz o artigo de cada uma). O id
   `onde-declarar` era o da nota curta do Anexo F, que passou para a parte 3:
   fica com a parte 2, que é onde quem chega por ele quer ir. */
const GUIA = [
  { id: 'tens-de-declarar', titulo: 'Tens de declarar?', blocos: [
    { p: 'As rendas que recebes de um prédio arrendado são rendimentos prediais, da categoria F do IRS, a não ser ' +
      'que optes pela tributação segundo as regras da categoria B (artigo 8.º do Código do IRS).' },
    { p: 'Se tu ou um dependente do teu agregado receberam rendas num ano, declaras-as na declaração de IRS desse ' +
      'ano, a Modelo 3, com o Anexo F (artigo 57.º e instruções do Anexo F).' },
    { grupo: 'O prazo', blocos: [
      { p: 'Entregas a declaração de 1 de abril a 30 de junho do ano seguinte ao das rendas: as de 2026 declaram-se ' +
        'de 1 de abril a 30 de junho de 2027 (artigo 60.º, n.º 1).' },
    ] },
    { grupo: 'A taxa', blocos: [
      { p: 'Por regra, as rendas não se somam aos teus outros rendimentos: pagam uma taxa autónoma (artigos 22.º, ' +
        'n.º 3, e 72.º).' },
      { info: [
        '25 % nas rendas de arrendamento habitacional (artigo 72.º, n.º 2).',
        '28 % nas outras rendas prediais, como as de um arrendamento não habitacional (artigo 72.º, n.º 1, alínea e)).',
        '10 % nas rendas de 2026 a 2029 de contratos só para habitação com renda mensal até 2,5 vezes a retribuição ' +
          'mínima mensal de 2026, ou seja, 2 300 € no continente, salvo se te couber uma taxa mais baixa (artigo ' +
          '45.º-C do Estatuto dos Benefícios Fiscais; Decreto-Lei n.º 97/2026, artigo 2.º; Decreto-Lei n.º 139/2025).',
      ] },
    ] },
    { grupo: 'Os contratos longos', blocos: [
      { p: 'Nas rendas de um contrato de arrendamento para habitação permanente, a taxa autónoma baixa com a duração ' +
        'do contrato (artigo 72.º, n.os 3 a 5):' },
      { info: [
        'De 5 a menos de 10 anos: menos 10 pontos percentuais, e menos 2 por cada renovação com a mesma duração, até ' +
          'mais 10 pontos.',
        'De 10 a menos de 20 anos: menos 15 pontos percentuais.',
        '20 anos ou mais: menos 20 pontos percentuais.',
      ] },
      { p: 'Não há redução nos contratos de arrendamento habitacional celebrados desde 1 de janeiro de 2024 cuja ' +
        'renda mensal exceda em 50 % os limites gerais de preço de renda por tipologia e concelho, da Portaria ' +
        'n.º 176/2019 (artigo 72.º, n.º 23).' },
      { p: 'Se o contrato acabar antes do prazo por motivo imputável a ti, senhorio, perdes as reduções desde o início ' +
        'do contrato ou da renovação, e no ano em que acabou declaras esse facto, para pagares a diferença com juros ' +
        'compensatórios (artigo 72.º, n.º 20).' },
      { p: 'Para teres direito à redução, além de comunicares o contrato com a declaração Modelo 2 do Imposto do Selo, ' +
        'indicas no Portal das Finanças, até 15 de fevereiro do ano seguinte, a data de início e a duração do ' +
        'contrato, e depois as renovações e a cessação (Portaria n.º 110/2019, nas instruções do Anexo F).' },
    ] },
    { grupo: 'Ou o englobamento', blocos: [
      { p: 'Em vez da taxa autónoma, podes optar por englobar as rendas: somam-se aos teus outros rendimentos e pagam ' +
        'as taxas gerais do artigo 68.º (artigo 72.º, n.º 13; instruções do quadro 6G do Anexo F).' },
      { p: 'Se optares, englobas todas as rendas da categoria F desse ano, e não só as de um imóvel (artigo 22.º, ' +
        'n.º 5).' },
    ] },
    { fonte: 'cirs72', texto: 'Fonte principal: artigo 72.º do Código do IRS, AT.' },
  ] },

  { id: 'onde-declarar', titulo: 'Onde declaras', blocos: [
    { p: 'No Portal das Finanças, pela Internet: a declaração Modelo 3 e os anexos, como o Anexo F, são ' +
      'obrigatoriamente entregues por transmissão eletrónica de dados (Portaria n.º 104/2026/1, artigos 2.º e 3.º).' },
    { ir: 'Ir ao Portal das Finanças', fonte: 'portal' },
    { p: 'Para entrar, usas o teu NIF e a senha de acesso, ou a Autenticação.gov, com a Chave Móvel Digital ou o ' +
      'Cartão de Cidadão. Se ainda não tens senha, registas-te no Portal para a obter (folheto da AT sobre o acesso ' +
      'ao Portal).' },
    { fonte: 'portaria104', texto: 'Fonte principal: Portaria n.º 104/2026/1, artigos 2.º e 3.º, AT.' },
  ] },

  { id: 'como-preencher', titulo: 'Como preenches', blocos: [
    { p: 'No Anexo F da declaração Modelo 3, declara:' },
    { cond: [
      'As rendas pelo valor bruto, sem retirar antes os encargos.',
      'Os gastos em campos separados, associados ao imóvel correto.',
      'Apenas o montante correspondente à tua quota de propriedade e ao imóvel ou parte efetivamente arrendada.',
      'As obras em partes comuns no campo de conservação e manutenção, e não como simples quota de condomínio, quando ' +
        'essa for a natureza efetiva da despesa.',
    ] },
    { grupo: 'Linha a linha', blocos: [
      { p: 'Cada prédio vai numa linha própria, e cada fração em separado, mesmo que sejam do mesmo contrato. Um ' +
        'prédio que não deu rendas no ano não se declara. Em cada linha indicas:' },
      { info: [
        'O número do contrato, que vem da declaração Modelo 2 do Imposto do Selo (ou do registo do contrato no Portal ' +
          'das Finanças, se for anterior a 1 de abril de 2015), e a data de início.',
        'A identificação matricial: o código da freguesia, de seis dígitos, que está nos documentos de cobrança do ' +
          'IMI, o tipo de prédio (U, urbano, ou R, rústico), o artigo e a fração.',
        'O titular das rendas: A ou B, como no rosto da declaração, ou o código do dependente (D1, D2…).',
        'As rendas pelo valor ilíquido, pagas ou colocadas à tua disposição no ano, e a natureza: 07 no arrendamento ' +
          'habitacional, 06 no não habitacional.',
        'As retenções na fonte de IRS feitas sobre essas rendas.',
        'O NIF português do inquilino ou, se ele não o tiver, o código do país.',
        'Os gastos suportados e pagos no ano, enquanto o prédio esteve arrendado, cada um na sua coluna: conservação ' +
          'e manutenção, condomínio, IMI pago no ano, imposto do selo, taxas autárquicas e outros.',
        'As obras de conservação e manutenção pagas nos 24 meses antes do arrendamento, nas colunas próprias, só no ' +
          'ano em que o arrendamento começa.',
      ] },
    ] },
    { grupo: 'O quadro de cada contrato', blocos: [
      { p: 'No modelo do Anexo F em vigor desde janeiro de 2025, mantido pela Portaria n.º 104/2026/1:' },
      { info: [
        'Quadro 4.1: os contratos sem redução de taxa pela duração.',
        'Quadro 4.2: os contratos para habitação permanente com essa redução, celebrados ou renovados desde 1 de ' +
          'janeiro de 2019, com o quadro 4.2A preenchido (as datas do contrato e da última renovação). Um contrato ' +
          'celebrado desde 1 de janeiro de 2024 com a renda acima do limite do artigo 72.º, n.º 23, vai para o 4.1.',
        'Quadro 6G: a opção pelo englobamento (campo 06).',
      ] },
      { p: 'Se sair um modelo novo para o ano das tuas rendas, confirma os quadros nas instruções dele.' },
    ] },
    { fonte: 'anexoF', texto: 'Fonte principal: instruções de preenchimento do Anexo F, AT.' },
  ] },

  { id: 'deducoes', titulo: 'As deduções', intro: [
    'Os encargos que a lei deixa abater às rendas, os que não deixa, e os documentos que tens de guardar para cada ' +
      'imóvel.',
    'Este guia segue a redação vigente do artigo 41.º do Código do IRS publicada pela Autoridade Tributária e ' +
      'Aduaneira (AT), complementada por informações vinculativas da AT. Quando uma despesa não está claramente ' +
      'coberta pela lei ou por orientação administrativa específica, fica assinalada como duvidosa, em vez de ' +
      'aparecer como seguramente dedutível.',
  ], seccoes: DEDUCOES },

  { id: 'fontes', titulo: 'As fontes oficiais', blocos: [{ fontes: true }] },
];

/* Escapa texto para HTML (o conteúdo é nosso, mas um «<» ou um «&» num texto
   futuro não pode partir a página).
   Recebe: t — o texto. Devolve: o texto com & < > " escapados. */
function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Um ícone de traço da casa, decorativo (o mesmo desenho de landing.js:icone).
   Recebe: d — o caminho SVG; classe — a classe a somar à .i.
   Devolve: o HTML do <svg>, escondido dos leitores de ecrã. */
function icone(d, classe) {
  return `<svg class="i ${classe}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

/* Uma lista do guia. O sentido (pode, não pode, condição, papel) vai no
   ícone e na classe, e também no texto escondido de cada linha — quem ouve a
   página não vê o visto nem a cruz. Os factos soltos (`info`) levam o mesmo
   ponto das condições: não dizem que se pode nem que não se pode.
   Recebe: tipo — 'sim', 'nao', 'cond', 'info' ou 'doc'; linhas — os textos.
   Devolve: o HTML da <ul>. */
function lista(tipo, linhas) {
  const ponto = '<span class="ponto" aria-hidden="true"></span>';
  const marca = {
    sim: icone(VISTO, 'sim') + '<span class="so-leitor">Podes deduzir: </span>',
    nao: icone(CRUZ, 'nao') + '<span class="so-leitor">Não podes deduzir: </span>',
    doc: icone(VISTO, 'doc'),
    cond: ponto,
    info: ponto,
  }[tipo];
  return `<ul class="lista ${tipo}">
${linhas.map((t) => `      <li>${marca}<span>${esc(t)}</span></li>`).join('\n')}
    </ul>`;
}

/* As fontes oficiais, com ligação só onde o endereço oficial se confirmou.
   Devolve: o HTML da <ul> das fontes. */
function listaDeFontes() {
  return `<ul class="fontes">
${FONTES.map((f) => `      <li>${f.url
    ? `<a href="${esc(f.url)}" rel="noopener">${esc(f.nome)}</a>`
    : `<span>${esc(f.nome)}</span>`}</li>`).join('\n')}
    </ul>`;
}

/* Uma fonte de FONTES pela chave.
   Recebe: id — a chave. Devolve: a fonte; falha alto se a chave não existe
   (um bloco a citar uma fonte que não está na lista partia a regra do guia). */
function fontePorId(id) {
  const f = FONTES.find((x) => x.id === id);
  if (!f) throw new Error('fonte do guia sem entrada em FONTES: ' + id);
  return f;
}

/* Um bloco do guia em HTML (ver o formato em DEDUCOES).
   Recebe: b — o bloco; nivel — o nível do subtítulo de um grupo (3 numa
   secção das partes 1 a 3, 4 numa secção da parte 4, que já é um h3).
   Devolve: o HTML dele. */
function bloco(b, nivel = 3) {
  if (b.grupo) return `<div class="grupo">
    <h${nivel}>${esc(b.grupo)}</h${nivel}>
    ${b.blocos.map((x) => bloco(x, nivel)).join('\n    ')}
    </div>`;
  if (b.nota) return `<div class="nota" role="note">
      ${icone(AVISO, 'aviso')}
      <div class="nota-corpo">
        <p class="nota-tit">${esc(b.nota)}</p>
        <p>${esc(b.texto)}</p>${b.cond ? '\n        ' + lista('cond', b.cond) : ''}${b.fim ? `\n        <p>${esc(b.fim)}</p>` : ''}
      </div>
    </div>`;
  if (b.fontes) return listaDeFontes();
  if (b.ir) {
    const f = fontePorId(b.fonte);
    return `<p class="ir"><a class="btn" href="${esc(f.url)}" rel="noopener"><span>${esc(b.ir)}</span>${icone(SEGUIR, 'seguir')}</a></p>`;
  }
  if (b.fonte != null) {
    const f = fontePorId(b.fonte);
    return `<p class="fonte">${f.url ? `<a href="${esc(f.url)}" rel="noopener">${esc(b.texto)}</a>` : esc(b.texto)}</p>`;
  }
  if (b.p) return `<p>${esc(b.p)}</p>`;
  for (const tipo of ['sim', 'nao', 'cond', 'info', 'doc']) if (b[tipo]) return lista(tipo, b[tipo]);
  throw new Error('bloco do guia sem tipo');
}

/* As secções pela ordem de leitura, com o número que a página lhes mostra
   — as partes (1 a 5) e, dentro da 4, as cinco secções (4.1 a 4.5) —, para
   os testes conferirem a página e o índice.
   Devolve: [{id, titulo, num, parte}] — parte é o id da parte de uma secção
   de dentro, ou null. */
export function seccoesDoGuia() {
  return GUIA.flatMap((s, i) => {
    const num = String(i + 1);
    return [{ id: s.id, titulo: s.titulo, num, parte: null },
      ...(s.seccoes || []).map((x, j) => ({ id: x.id, titulo: x.titulo, num: num + '.' + (j + 1), parte: s.id }))];
  });
}

/* Uma secção em cartão: o título com o número e os blocos.
   Recebe: s — a secção ({id, titulo, blocos}); num — o número à vista
   ('2', '4.1'); nivel — 2 numa parte, 3 numa secção da parte 4.
   Devolve: o HTML da <section>. */
function seccaoEmCartao(s, num, nivel) {
  return `  <section class="bloco" id="${s.id}" aria-labelledby="t-${s.id}">
    <h${nivel} id="t-${s.id}"><span class="num" aria-hidden="true">${num}</span>${esc(s.titulo)}</h${nivel}>
    ${s.blocos.map((b) => bloco(b, nivel + 1)).join('\n    ')}
  </section>`;
}

/* Uma parte do guia. A que tem secções dentro (a 4, as deduções) abre com o
   título e a introdução sobre o fundo, e as secções seguem em cartões, cada
   uma com o seu h3 e o seu número (4.1…); as outras são um cartão só.
   Recebe: s — a parte; i — a posição em GUIA. Devolve: o HTML dela. */
function parteDoGuia(s, i) {
  const num = String(i + 1);
  if (!s.seccoes) return seccaoEmCartao(s, num, 2);
  return `  <section class="parte" id="${s.id}" aria-labelledby="t-${s.id}">
    <div class="parte-cabeca">
      <h2 id="t-${s.id}"><span class="num" aria-hidden="true">${num}</span>${esc(s.titulo)}</h2>
      ${s.intro.map((t) => `<p>${esc(t)}</p>`).join('\n      ')}
    </div>
${s.seccoes.map((x, j) => seccaoEmCartao(x, num + '.' + (j + 1), 3)).join('\n')}
  </section>`;
}

/* O índice: as partes numeradas pela lista e, dentro da 4, as secções com
   o número escrito (4.1…), que a lista não sabe fazer.
   Devolve: o HTML das <li> do índice (sem a da nota de segurança). */
function linhasDoIndice() {
  return GUIA.map((s, i) => {
    if (!s.seccoes) return `      <li><a href="#${s.id}">${esc(s.titulo)}</a></li>`;
    return `      <li><a href="#${s.id}">${esc(s.titulo)}</a>
        <ol>
${s.seccoes.map((x, j) => `          <li><a href="#${x.id}"><span class="num-ind" aria-hidden="true">${i + 1}.${j + 1}</span>${esc(x.titulo)}</a></li>`).join('\n')}
        </ol>
      </li>`;
  }).join('\n');
}

/* Os dados estruturados do guia, para os motores de busca: o caminho
   (BreadcrumbList, Início › o guia) e o artigo (Article), com a data da
   última revisão. Vão num <script type="application/ld+json">, um bloco de
   dados que não corre (a CSP_ESTRITA deixa-o), e só na raiz: a
   pré-visualização não se apresenta como a original. O «<» sai escapado
   (a sequência unicode 003C do JSON), para nenhum texto futuro fechar o
   bloco antes do tempo.
   Devolve: o HTML do bloco. */
function dadosEstruturados() {
  const url = SITIO + CAMINHO_GUIA;
  const casa = { '@type': 'Organization', name: 'Rendorium', url: SITIO + '/' };
  const dados = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: SITIO + '/' },
        { '@type': 'ListItem', position: 2, name: NOME_CURTO, item: url },
      ] },
      { '@type': 'Article', headline: H1, description: DESCRICAO, inLanguage: 'pt-PT', url,
        mainEntityOfPage: url, datePublished: GUIA_REVISTO, dateModified: GUIA_REVISTO, author: casa,
        publisher: { ...casa, logo: { '@type': 'ImageObject', url: SITIO + '/icon-512.png' } } },
    ],
  };
  return '<script type="application/ld+json">' + JSON.stringify(dados).replace(/</g, '\\u003c') + '</script>';
}

/* A página do guia.

   Fora do domínio raiz é uma pré-visualização, como os documentos legais:
   leva `noindex`, não declara canonical nem dados estruturados, e o «início»
   aponta para /montra — ali a raiz é a app.
   Recebe: op — {raiz, qa}: raiz verdadeiro quando está a ser servido em
   rendorium.com; qa — o HTML da pílula do QA (equipa-qa.js:pilulaDasPaginas),
   já pronto e escrito tal e qual antes do </body>; só o index.js o passa, e
   só no dev (por omissão, nada).
   Devolve: uma Response HTML. */
export function paginaGuia(op) {
  const raiz = !!(op && op.raiz);
  const qa = op && typeof op.qa === 'string' ? op.qa : '';
  const inicio = raiz ? '/' : '/montra';
  const cabecaRaiz = raiz
    ? `<meta name="robots" content="index,follow">
<link rel="canonical" href="${SITIO}${CAMINHO_GUIA}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(H1)}">
<meta property="og:description" content="${esc(DESCRICAO)}">
<meta property="og:url" content="${SITIO}${CAMINHO_GUIA}">
<meta property="og:locale" content="pt_PT">
<meta name="twitter:card" content="summary">
${dadosEstruturados()}`
    : '<meta name="robots" content="noindex,nofollow">';
  const html = `<!doctype html>
<html lang="pt-PT"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F2F3F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B111E" media="(prefers-color-scheme: dark)">
<title>${esc(TITULO)}</title>
<meta name="description" content="${esc(DESCRICAO)}">
${cabecaRaiz}
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/paginas/guia.css">
</head><body>
<a class="saltar" href="#conteudo">Saltar para o conteúdo</a>
<div class="faixa-topo">
  <header>
    <a class="marca" href="${inicio}"><span class="mark" aria-hidden="true"></span><span>Rendorium</span></a>
    <a class="btn fantasma em-linha guias" href="${CAMINHO_GUIA}" aria-label="Guia do IRS das rendas" aria-current="page">IRS</a>
    <a class="btn fantasma em-linha entrar" href="${APP}">Entrar</a>
    <a class="btn primary" href="${APP}/?criar=1">Criar conta</a>
    <details class="gaveta">
      <summary class="gaveta-botao" aria-label="Menu">${icone(MENU, 'riscas')}${icone(CRUZ, 'cruz')}</summary>
      <nav class="gaveta-painel" aria-label="Menu">
        <a href="${CAMINHO_GUIA}" aria-current="page"><span>IRS</span>${icone(SEGUIR, 'seguir')}</a>
        <a href="${APP}"><span>Entrar</span>${icone(SEGUIR, 'seguir')}</a>
      </nav>
    </details>
  </header>
</div>
<main class="wrap" id="conteudo">
  <nav class="caminho" aria-label="Caminho">
    <ol>
      <li><a href="${inicio}">Início</a></li>
      <li><span class="separador" aria-hidden="true">›</span><span class="atual" aria-current="page">${esc(NOME_CURTO)}</span></li>
    </ol>
  </nav>
  <div class="cabeca">
    <p class="chapeu">Guia · IRS do senhorio</p>
    <h1>${esc(H1)}</h1>
    <p class="sub">Se tens de declarar as rendas, onde as declaras, como preenches o Anexo F e o que podes abater em
    cada imóvel.</p>
  </div>

  <dl class="ficha">
    <div><dt>Para quem</dt><dd>Pessoa singular, residente em Portugal, com rendas declaradas como rendimentos prediais
    da categoria F, sem opção pela tributação segundo as regras da categoria B.</dd></div>
    <div><dt>Verificado a</dt><dd>8 de novembro de 2026</dd></div>
  </dl>

  <p class="intro">Primeiro vês se tens de declarar, depois onde e como, e por fim o que podes deduzir. Cada regra
  vem da lei ou da Autoridade Tributária e Aduaneira (AT), e as fontes oficiais estão no fim.</p>

  <nav class="indice" aria-label="Neste guia">
    <p class="indice-tit">Neste guia</p>
    <ol>
${linhasDoIndice()}
      <li><a href="#seguranca">A nota de segurança</a></li>
    </ol>
  </nav>

${GUIA.map(parteDoGuia).join('\n\n')}

  <aside class="seguranca" id="seguranca" aria-labelledby="t-seguranca">
    ${icone(ESCUDO, 'escudo')}
    <div>
      <h2 id="t-seguranca">Uma nota de segurança</h2>
      <p>As informações vinculativas publicadas mostram a interpretação administrativa da AT para factos concretos.
      Não substituem uma informação vinculativa pedida por ti quando os factos forem diferentes ou a despesa for
      atípica. Para uma despesa relevante que não se enquadre claramente nas listas anteriores, a opção sem risco é não
      a deduzir até teres resposta escrita da AT.</p>
    </div>
  </aside>

  <p class="voltar"><a class="btn" href="${inicio}">${icone(VOLTAR, 'seta')}<span>Voltar ao início</span></a></p>

  <section class="fecho" aria-labelledby="t-fecho">
    <div class="fecho-texto">
      <h2 id="t-fecho">As rendas e as despesas, imóvel a imóvel</h2>
      <p>A Rendorium regista cada renda e cada despesa no imóvel a que pertence, e lembra-te de cada pagamento.
      Grátis, sem planos.</p>
    </div>
    <div class="fecho-botoes">
      <a class="btn claro" href="${APP}/?criar=1">Criar conta grátis</a>
    </div>
  </section>
</main>
<footer class="wrap rodape">
  <span class="rodape-marca"><span class="mark" aria-hidden="true"></span><span>© ${new Date().getFullYear()} Rendorium</span></span>
  <a href="${inicio}">Início</a>
  <a href="/termos">Termos e Condições</a>
  <a href="/privacidade">Política de Privacidade</a>
</footer>
${qa}</body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': CSP_ESTRITA,
      // como os documentos: uma hora na raiz, nada na pré-visualização
      'Cache-Control': raiz ? 'public, max-age=3600' : 'no-store',
    },
  });
}

/* Os estilos do guia, servidos em /paginas/guia.css (paginas-recursos.js):
   a página vai com a CSP_ESTRITA, que não aplica estilos escritos no HTML.
   As letras e os tokens são os da montra (landing.js:CSS_LANDING), e a
   escala de letra e de espaço é a da skill da montra (B1, B2). */
export const CSS_GUIA = `/* As letras da app, auto-alojadas (a CSP só deixa font-src 'self'): as
   mesmas declarações do CSS_LANDING (landing.js), do CSS_LEGAL e do CSS_TESTE,
   e um teste confere que não divergem. */
@font-face{font-family:'Geist';src:url(/fonts/geist.woff2) format('woff2');font-weight:100 900;font-style:normal;font-display:swap;
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Bricolage Grotesque';src:url(/fonts/bricolage-grotesque.woff2) format('woff2');font-weight:200 800;font-style:normal;font-display:swap;
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}

/* os tokens da app que o guia usa; a marca é cobalto nos dois temas */
:root{color-scheme:light dark;
  --bg:#F2F3F6;--card:#FFFFFF;--tint:#F6F7F9;--press:#E9ECF2;
  --ink:#121826;--muted:#4F586B;--line:#E2E5EB;--line2:#CDD2DB;
  --accent:#2952D9;--accent-ink:#FFFFFF;--accent-soft:#E9EEFC;--accent-text:#1D3FB0;--accent-press:#1D3FB0;
  --in:#16775A;--in-soft:#E2F3EB;--warn:#8F5600;--warn-soft:#FFF1D1;--danger:#B42318;--danger-soft:#FDE8E6;
  --blur:rgba(242,243,246,.94);--marca:#2952D9;--marca-arco:#FFFFFF;
  --fecho-fundo:#2952D9;--fecho-tinta:#FFFFFF;--fecho-sub:#DCE4FB;
  --fecho-botao:#FFFFFF;--fecho-botao-tinta:#1D3FB0;--fecho-botao-hover:#E9EEFC;
  --rapido:.12s;--curva:cubic-bezier(.22,1,.36,1)}
@media(prefers-color-scheme:dark){:root{
  --bg:#0B111E;--card:#141C2C;--tint:#1A2335;--press:#253049;
  --ink:#E9EDF5;--muted:#AEB7C9;--line:#253049;--line2:#33405C;
  --accent:#7C9BFF;--accent-ink:#0B111E;--accent-soft:#1E2A4D;--accent-text:#B5C6FF;--accent-press:#9DB3FF;
  --in:#4CC79A;--in-soft:#123327;--warn:#F2C25A;--warn-soft:#352A12;--danger:#FF8A80;--danger-soft:#3D1A1A;
  --blur:rgba(11,17,30,.92);
  --fecho-fundo:#1E2A4D;--fecho-tinta:#E9EDF5;--fecho-sub:#AEB7C9;
  --fecho-botao:#7C9BFF;--fecho-botao-tinta:#0B111E;--fecho-botao-hover:#9DB3FF}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:'Geist',system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;
  padding:0 env(safe-area-inset-right) 0 env(safe-area-inset-left)}
h1,h2,h3,h4{font-family:'Bricolage Grotesque','Geist',system-ui,sans-serif;font-weight:650;letter-spacing:-.02em;
  margin:0;text-wrap:balance}
p{margin:0;text-wrap:pretty}
a{color:var(--accent-text)}
a:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}
.wrap{max-width:820px;margin:0 auto;padding-left:clamp(16px,4vw,32px);padding-right:clamp(16px,4vw,32px)}
.i{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
/* o que só o leitor de ecrã ouve */
.so-leitor{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);
  white-space:nowrap;border:0}

/* a ligação para saltar o cabeçalho, que só aparece com o foco do teclado */
.saltar{position:absolute;left:16px;top:-64px;z-index:30;display:inline-flex;align-items:center;min-height:44px;
  padding:0 16px;border-radius:12px;background:var(--card);color:var(--ink);font-weight:600;
  border:1px solid var(--line2);text-decoration:none}
.saltar:focus{top:12px}

/* o cabeçalho de vidro da montra e dos documentos, que acompanha o scroll */
.faixa-topo{position:sticky;top:0;z-index:20;background:var(--blur);
  -webkit-backdrop-filter:blur(12px) saturate(140%);backdrop-filter:blur(12px) saturate(140%);
  border-bottom:1px solid var(--line)}
header{display:flex;align-items:center;gap:8px;max-width:820px;margin:0 auto;min-height:64px;
  padding:0 clamp(16px,4vw,32px)}
.marca{display:flex;align-items:center;gap:8px;min-height:44px;margin-right:auto;color:var(--ink);text-decoration:none;
  font-family:'Bricolage Grotesque','Geist',system-ui,sans-serif;font-weight:650;font-size:20px;letter-spacing:-.02em}
/* a marca da app: o quadrado cobalto com dois arcos brancos, em CSS */
.mark{display:block;flex:none;width:30px;height:30px;border-radius:8px;
  background:radial-gradient(circle at 0 0,transparent 23%,var(--marca-arco) 24%,var(--marca-arco) 30.2%,transparent 31.2%),
    radial-gradient(circle at 100% 100%,transparent 23%,var(--marca-arco) 24%,var(--marca-arco) 30.2%,transparent 31.2%),var(--marca)}

/* os botões da montra: os da app, 44 px e raio 12 */
a.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:12px;
  border:1px solid var(--line2);background:var(--card);color:var(--ink);text-decoration:none;
  font-weight:600;font-size:16px;white-space:nowrap;
  transition:transform var(--rapido) var(--curva),background-color var(--rapido) var(--curva),
    border-color var(--rapido) var(--curva)}
a.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
a.btn.fantasma{background:transparent;border-color:transparent}
a.btn:active{transform:scale(.97)}
a.btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:12px}

/* ------------------------------------------------------------ o caminho
   Início › o guia, no topo. A página atual distingue-se pela tinta e pelo
   peso, e a ligação pelo cobalto e pelo sublinhado: o escuro forçado do
   Samsung Internet mexe nos fundos, e a frente sobrevive. */
.caminho{padding-top:16px;font-size:14px}
.caminho ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;align-items:center;column-gap:8px}
.caminho li{display:flex;align-items:center;gap:8px;min-width:0}
.caminho a{position:relative;display:inline-flex;align-items:center;min-height:44px;font-weight:500;
  text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--accent-text) 40%,transparent);
  text-underline-offset:3px}
/* o «Início» é curto: o alvo do dedo alarga-se 8 px para cada lado, sem
   empurrar o separador (44 px ou mais) */
.caminho a::after{content:'';position:absolute;top:0;bottom:0;left:-8px;right:-8px}
.caminho .separador{color:var(--muted)}
.caminho .atual{color:var(--ink);font-weight:600}

/* ------------------------------------------------------------ a cabeça */
.cabeca{display:flex;flex-direction:column;gap:12px;padding-top:16px;max-width:680px}
.chapeu{font-size:14px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--accent-text)}
h1{font-size:clamp(30px,5.4vw,48px);line-height:1.08}
.sub{font-size:18px;color:var(--muted)}
.ficha{display:flex;flex-wrap:wrap;gap:12px 32px;margin:24px 0 0;padding:16px 24px;border-radius:16px;
  background:var(--card);border:1px solid var(--line);font-size:14px}
.ficha div{flex:1 1 220px;min-width:0}
.ficha div:last-child{flex:0 1 auto}
.ficha dt{font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-size:12px}
.ficha dd{margin:4px 0 0}
.intro{margin-top:24px;color:var(--muted);max-width:70ch}

/* o índice: as partes numeradas, com os alvos de 44 px de um dedo; dentro
   da parte 4, as secções com o número escrito (4.1…), sem o da lista. A
   parte 4 pode partir-se entre as duas colunas do computador (os números
   dizem a ordem), para as colunas ficarem do mesmo tamanho */
.indice{margin-top:32px;padding:16px 24px;border-radius:16px;border:1px solid var(--line);background:var(--card)}
.indice-tit{font-weight:600;font-size:14px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.indice ol{margin:8px 0 0;padding-left:24px;columns:2 240px;column-gap:32px}
.indice li{break-inside:avoid}
.indice li:has(> ol){break-inside:auto}
.indice ol ol{columns:auto;margin:0;padding-left:0;list-style:none}
.indice a{display:inline-flex;align-items:center;min-height:44px;font-weight:500;text-decoration:none}
.indice ol ol a{gap:8px}
.num-ind{min-width:3ch;color:var(--muted);font-variant-numeric:tabular-nums}

/* ------------------------------------------------------------ as secções */
.bloco{margin-top:32px;padding:clamp(24px,4vw,40px);border-radius:16px;background:var(--card);
  border:1px solid var(--line);display:flex;flex-direction:column;gap:16px;
  /* a âncora do índice pousa abaixo do cabeçalho pegajoso (64 px) */
  scroll-margin-top:80px}
.bloco > p,.grupo > p{max-width:70ch}
h2{font-size:clamp(24px,3.6vw,30px);line-height:1.15;display:flex;align-items:baseline;gap:12px}
.num{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:32px;height:32px;
  padding:0 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent-text);
  font-family:'Geist',system-ui,sans-serif;font-size:16px;font-weight:600;letter-spacing:0;
  font-variant-numeric:tabular-nums;align-self:center}
.grupo{display:flex;flex-direction:column;gap:12px;padding-top:16px;border-top:1px solid var(--line)}
.bloco > h2 + .grupo,.bloco > h3 + .grupo{border-top:0;padding-top:0}
h3,h4{font-size:20px;line-height:1.25}
.fonte{font-size:14px;color:var(--muted)}

/* a parte 4, as deduções: o título e a introdução sobre o fundo, como a
   cabeça da página, e as cinco secções em cartões mais juntos (24 px) do
   que as partes (48 px), cada uma com o seu h3 numerado (4.1…) */
.parte{margin-top:48px;scroll-margin-top:80px}
.parte-cabeca{display:flex;flex-direction:column;gap:12px}
.parte-cabeca p{max-width:70ch;color:var(--muted)}
.parte .bloco{margin-top:24px}
.bloco > h3{font-size:24px;line-height:1.15;display:flex;align-items:baseline;gap:12px}

/* o botão para o sítio oficial (o Portal das Finanças), o secundário da
   casa, com o chevron */
.ir a.btn{gap:8px;padding-right:12px}
.ir .i{width:20px;height:20px}

/* as listas: o visto do que podes deduzir, a cruz do que não podes, o visto
   neutro dos papéis, e o ponto das condições — formas diferentes, para o
   sentido sobreviver ao escuro forçado, que mexe nas cores */
.lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.lista li{display:flex;gap:12px;align-items:flex-start;max-width:70ch}
.lista .i{margin-top:0}
.i.sim{color:var(--in)}
.i.nao{color:var(--danger)}
.i.doc{color:var(--accent)}
.ponto{flex:none;width:8px;height:8px;margin:8px 8px 0;border-radius:999px;background:var(--accent);
  border:2px solid var(--accent)}

/* o que pede cuidado: a caixa âmbar da app (o aviso dos prazos) */
.nota{display:flex;gap:12px;align-items:flex-start;padding:16px 24px 16px 16px;border-radius:16px;
  background:var(--warn-soft);border:1px solid color-mix(in srgb,var(--warn) 24%,var(--warn-soft))}
.i.aviso{color:var(--warn)}
.nota-corpo{display:flex;flex-direction:column;gap:8px;min-width:0}
.nota-tit{font-weight:600;color:var(--ink)}
.nota .lista{gap:8px;margin:4px 0}

.fontes{margin:0;padding-left:24px;display:flex;flex-direction:column;gap:8px}
.fontes a{text-decoration:underline;text-underline-offset:3px}

/* a nota de segurança: um cartão de contorno cobalto, que fecha o guia */
.seguranca{margin-top:32px;display:flex;gap:16px;align-items:flex-start;padding:clamp(24px,4vw,40px);
  border-radius:16px;background:var(--card);border:2px solid var(--accent);scroll-margin-top:80px}
.seguranca h2{font-size:24px;margin-bottom:8px}
.seguranca p{max-width:70ch}
.i.escudo{color:var(--accent);width:32px;height:32px}

/* o voltar ao início: o botão secundário, com a seta da casa, no fim da leitura */
.voltar{margin-top:32px}
.voltar a.btn{gap:8px;padding-left:12px}
.i.seta{width:20px;height:20px}

/* o fecho: o bloco cobalto da montra, em ponto pequeno */
.fecho{margin-top:48px;display:flex;flex-wrap:wrap;align-items:center;gap:24px;padding:clamp(24px,5vw,48px);
  border-radius:20px;background:var(--fecho-fundo);color:var(--fecho-tinta)}
.fecho-texto{flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:8px}
.fecho h2{font-size:clamp(24px,3.6vw,30px)}
.fecho p{color:var(--fecho-sub)}
.fecho-botoes{display:flex;flex-wrap:wrap;gap:12px}
.fecho a.btn.claro{background:var(--fecho-botao);border-color:var(--fecho-botao);color:var(--fecho-botao-tinta)}
.fecho a.btn:focus-visible{outline-color:var(--fecho-tinta)}

.rodape{display:flex;flex-wrap:wrap;align-items:center;gap:4px 24px;margin-top:48px;padding-top:24px;padding-bottom:40px;
  border-top:1px solid var(--line);font-size:16px}
.rodape-marca{display:flex;align-items:center;gap:8px;margin-right:auto;color:var(--muted)}
.rodape .mark{width:24px;height:24px;border-radius:6px}
.rodape a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none}

/* o hover só existe onde há rato: só cor, nada levanta */
@media(hover:hover) and (pointer:fine){
  a.btn:hover{background:var(--tint)}
  a.btn.primary:hover{background:var(--accent-press);border-color:var(--accent-press)}
  a.btn.fantasma:hover{background:var(--press);border-color:var(--press)}
  .fecho a.btn.claro:hover{background:var(--fecho-botao-hover);border-color:var(--fecho-botao-hover)}
  .indice a:hover,.rodape a:hover{text-decoration:underline}
  .caminho a:hover{text-decoration-color:currentColor}
}

/* ------------------------------------------------------------ telemóvel */
@media(max-width:619px){
  .rodape-marca{flex-basis:100%}
  .seguranca{flex-direction:column;gap:12px}
}
@media(max-width:480px){
  /* os botões do cabeçalho mais justos num telemóvel, como os da montra */
  header{gap:4px}
  header a.btn{padding:0 12px}
  .caminho{padding-top:8px}
  .cabeca{padding-top:8px}
  .ficha,.indice{padding:16px}
  .nota{padding:16px}
  .fecho-botoes,.fecho-botoes a.btn{flex:1 1 100%}
}
/* ------------------------------------------------- a gaveta do cabeçalho
   A mesma da montra (landing.js, «a gaveta do cabeçalho»). Medido no
   Chromium (2026-11-08): a marca 141 px, o «IRS» 50, o «Entrar» 74 e o
   «Criar conta» 111, com 4 de intervalo e 16 de margem, pedem 420 px. Até
   aos 439 o «IRS» e o «Entrar» passam para a gaveta, e o topo fica com a
   marca, o «Criar conta» e o ☰ (141 + 111 + 44, 336 px); dos 440 para cima
   vão em linha. Aqui o «IRS» é a página atual: diz-se com aria-current e na
   tinta da frente, no cabeçalho e na gaveta. */
@media(max-width:439px){a.btn.em-linha{display:none}}
@media(min-width:440px){.gaveta{display:none}}
/* abaixo dos 360 (o ecrã de fora de um dobrável, 320) aperta-se tudo um
   pouco, e a marca continua inteira */
@media(max-width:359px){
  .marca{font-size:18px}
  header a.btn{padding:0 8px}
}
a.btn[aria-current="page"]{color:var(--accent-text);text-decoration:underline;text-decoration-thickness:2px;
  text-underline-offset:6px}
.gaveta{flex:none}
.gaveta-botao{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;
  border:1px solid var(--line2);color:var(--ink);cursor:pointer;list-style:none;-webkit-tap-highlight-color:transparent;
  transition:transform var(--rapido) var(--curva),border-color var(--rapido) var(--curva),color var(--rapido) var(--curva)}
.gaveta-botao::-webkit-details-marker{display:none}
.gaveta-botao::marker{content:''}
.gaveta-botao:active{transform:scale(.97)}
.gaveta-botao:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.gaveta[open] .gaveta-botao{border-color:var(--accent);color:var(--accent-text)}
.gaveta .i.cruz,.gaveta[open] .i.riscas{display:none}
.gaveta[open] .i.cruz{display:block}
.gaveta-painel{position:absolute;top:100%;left:0;right:0;display:flex;flex-direction:column;
  padding:8px clamp(16px,4vw,32px) 16px;background:var(--bg);border-top:1px solid var(--line);
  border-bottom:1px solid var(--line);animation:gaveta-desce .2s var(--curva)}
/* fechada, o painel não existe: preso ao ::details-content do <details>
   fechado, saía pela direita do ecrã (o mesmo da montra, landing.js) */
.gaveta:not([open]) .gaveta-painel{display:none}
@keyframes gaveta-desce{from{clip-path:inset(0 0 100% 0);opacity:0}}
.gaveta-painel a{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;
  color:var(--ink);text-decoration:none;font-weight:600;font-size:16px;border-bottom:1px solid var(--line)}
.gaveta-painel a:last-child{border-bottom:0}
.gaveta-painel a[aria-current="page"]{color:var(--accent-text)}
.gaveta-painel a:active{color:var(--accent-text)}
.gaveta-painel a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.gaveta-painel .i{width:20px;height:20px;color:var(--muted)}
@media(hover:hover) and (pointer:fine){
  .gaveta-botao:hover{border-color:var(--accent)}
  .gaveta-painel a:hover{color:var(--accent-text)}
}

@media(prefers-reduced-motion:reduce){a.btn:active,.gaveta-botao:active{transform:none}.gaveta-painel{animation:none}}
/* quem pediu menos transparência recebe o cabeçalho sólido, e quem pediu
   mais contraste recebe contornos e texto secundário que se veem */
@media(prefers-reduced-transparency:reduce){
  .faixa-topo{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}}
@media(prefers-contrast:more){:root{--line:#8A93A5;--line2:#6B7385;--muted:#384152}}
@media(prefers-contrast:more) and (prefers-color-scheme:dark){:root{--line:#56627D;--line2:#6E7A96;--muted:#C9D0DD}}
`;
