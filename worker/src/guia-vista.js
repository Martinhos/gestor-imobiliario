/* O guia «Declarar as rendas», em público.
   ---------------------------------------
   Um senhorio que pesquisa como declarar as rendas no IRS chega aqui, e o
   guia acompanha-o do princípio ao fim (ticket a89a5fcb, 2026-11-09): 1. se
   tem de declarar, 2. onde, 3. como preenche o Anexo F, 4. o que pode
   deduzir — e as fontes oficiais no fim. É informação, não uma função da
   app; a Declaração (em produção desde 2026-11-12) abre-o no botão «Guia»,
   e por isso a nota do fim leva o aviso dela, à letra (IRS_AVISO_GUIA).

   A 2026-11-17 (auditoria ao IRS, KAN-126) o guia corrigiu-se onde a
   auditoria o achou errado ou curto, cada frase nova com a fonte aberta
   nesse dia: a caução (D03), o seguro de renda (D07), as letras A e B do
   rosto (D30), os limites do n.º 23 desde a Portaria 454/2026/1 (D78), as
   rendas isentas e os outros quadros (D79), o Modelo 44 só para os
   dispensados do recibo eletrónico (D80), o prazo das substituições do 8B
   (D84), o quadro 4.4 (D106) e o limite das rendas moderadas como o
   Decreto-Lei n.º 97/2026 o escreve (D109). O Martinho verifica-as antes de
   promover, como as de 2026-11-09. No mesmo dia, a ronda 2 da auditoria
   (KAN-128): o que não vai ao Anexo F (a categoria B nos seus dois casos,
   D134; os imóveis fora de Portugal, D133, também na ficha «Para quem»; sem
   alojamento local, que a app não trata, por decisão do Martinho), a renda que se declara quando não chega inteira
   (D112, D113), os 5 % da reabilitação e os quadros 4.3, 6A, 6B e 6C (D118)
   e a caderneta atual depois da reposição das freguesias (D137).
   A 2026-11-23 (segunda auditoria de raiz, ronda 2 das correções) o guia
   passou a dizer o que a Declaração faz: o recibo eletrónico salvo nas rendas
   de um arrendamento rural e nas da categoria B (N029, N093), o IMI e o selo
   fora do período arrendado (N094), o regime de 2019 e o n.º 24 nos contratos
   longos (N095), o quadro 10 dos programas de arrendamento (N155), os
   benefícios fiscais e as dívidas (N151), a cozinha e a casa de banho «a
   confirmar» (N045) e os gastos de antes do contrato, que na dúvida não se
   abatem (N046, decisão D9 b do Martinho). O Martinho verifica-as antes de
   promover.

   A parte 4 (a regra geral, o que podes, o que não podes, o que pede
   cuidado, os documentos) e os quatro pontos do Anexo F na parte 3 são o
   texto que o Martinho verificou a 2026-11-08 contra o artigo 41.º do Código
   do IRS e as informações vinculativas da AT, palavra a palavra. As partes
   1 a 3 escreveram-se a 2026-11-09 só a partir de fontes oficiais abertas
   (o Código do IRS e o EBF na AT, as instruções do Anexo F, a Portaria
   104/2026/1, o folheto das senhas, o Diário da República), cada frase com a
   sua fonte em FONTES; o Martinho verifica-as antes de promover. A
   2026-11-09 (tickets de QA 75c3536b e 33db56fc) a parte 3 recebeu o que a
   Declaração da app dizia e o guia não dizia — os quadros 8, 9 e 10, o
   resultado negativo, os quatro anos dos documentos, o que mudou em 2025 —,
   também só de fontes oficiais abertas nesse dia; e o botão da parte 2 passou
   a levar à entrega do IRS (ticket 720b5908). Escrito por tu, como o resto da
   casa. Nenhuma regra fiscal se acrescenta aqui sem passar por ele.

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
// a última verificação do texto contra as fontes: a data de modificação do Article e
// do mapa do sítio (a ficha da página escreve-a por extenso, «Verificado a», pela
// dataPorExtenso: as duas mudam juntas)
export const GUIA_REVISTO = '2026-11-23';
// o dia em que o guia saiu, a data de publicação do Article (não muda com as revisões)
const GUIA_PUBLICADO = '2026-11-09';

/* O aviso da Declaração, à letra (web/app/irs.js:IRS_AVISO, decisão do
   Martinho de 2026-11-13: «igual em todos os sítios», o guia incluído). O
   guia é do worker e não pode ler o irs.js, que é um script do browser: o
   texto copia-se, e o testes/irs-guia-textos.test.js confere que é igual. */
export const IRS_AVISO_GUIA = 'A app resume; quem declara és tu, no Portal das Finanças. Confirma cada valor antes ' +
  'de entregar: o imposto aqui é uma estimativa.';

const MESES_POR_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
  'outubro', 'novembro', 'dezembro'];

/* Uma data AAAA-MM-DD por extenso, como se escreve em Portugal.
   Recebe: iso — a data. Devolve: o texto, ex.: «17 de novembro de 2026». */
export function dataPorExtenso(iso) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return d + ' de ' + MESES_POR_EXTENSO[m - 1] + ' de ' + a;
}

/* O que os motores de busca e as redes mostram (≤ 60 e ≤ 160 caracteres),
   com os termos de quem pesquisa: IRS, rendas, declarar, Anexo F, deduzir.
   O título é o h1 (decisão do Martinho, 2026-11-09), sem o « — Rendorium»,
   que o passava dos 60. O h1 é também o título do cartão da montra
   (landing.js, que o importa) e da secção dele no rasto (equipa-guiao.js);
   o nome curto é o do caminho, do rodapé da montra e do rasto. */
export const H1 = 'IRS das rendas: como declarar e o que podes deduzir';
const TITULO = H1;
const DESCRICAO = 'Vê se tens de declarar as rendas no IRS, como preencher o Anexo F e o que podes deduzir: ' +
  'IMI, condomínio, obras, seguro de renda e os documentos a guardar.';
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

/* As fontes oficiais, pela ordem do guia, cada uma com a chave (`id`) por
   que o texto, os blocos `fonte` e o `ir` a citam, e o endereço confirmado a
   abrir — uma ligação errada num guia fiscal é pior do que nenhuma.

   Desde 2026-11-26 (KAN-164, ticket de QA 457D3B07: «todas as referências
   devem estar inline… se for legislação, deve ser sempre no Diário da
   República») cada referência do texto é uma ligação para a fonte, escrita
   {o que se lê|chave} (comLigacoes). A legislação liga ao Diário da
   República: a versão consolidada quando existe, senão o diploma
   publicado. Os códigos, que antes ligavam às páginas da AT, ligam agora ao
   DR. O que é da AT (os ofícios-circulados, as informações vinculativas, as
   instruções dos anexos, o folheto, a tabela das freguesias, a entrega)
   continua na AT.

   Um artigo abre o documento, no artigo (noArtigo), e não a página do
   artigo: no telemóvel, essa página só mostra se ele está em vigor (KAN-164
   reaberto, 2026-11-27: «Devo poder ler o artigo (no documento)»). O
   documento consolidado é sempre a versão em vigor, por isso o endereço não
   envelhece. O artigo 71.º do EBF abre na redação em vigor, com o n.º 7
   revogado pela Lei n.º 56/2023 (o DR não tem a de antes). Os 75 endereços
   abriram-se um a um a 2026-11-27 com um toque na ligação, num telemóvel
   (os do DR à espera do texto, com o artigo, a epígrafe e uma frase dele
   no documento): .unlazy/kanban-11-27/guia/ligacoes.md.

   As das partes 1 a 3 abriram-se a 2026-11-09: as páginas do Código do IRS
   e do EBF na AT pelo texto em vigor; os PDF da AT (as instruções do Anexo
   F, «modelo em vigor a partir de janeiro de 2025»; a Portaria 104/2026/1,
   arts. 1.º e 2.º; o folheto das senhas) lidos por inteiro; a entrega do
   IRS no Portal das Finanças pelo endereço, que leva à autenticação; as do
   Diário da República (a app deles só mostra o texto com JavaScript) no
   headless, com o diploma e o artigo
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
   - portaria104 (e portaria104a2, no artigo): art. 2.º n.º 1, a Modelo 3 e os anexos entregam-se por
     transmissão eletrónica de dados; art. 1.º n.º 3 a), o Anexo F e as
     instruções da Portaria 72-B/2025/1 mantêm-se em vigor;
   - entrega: a entrega do IRS no Portal das Finanças (ticket 720b5908; a
     2026-11-09 respondia 302 para a autenticação do Modelo 3, acesso.gov.pt
     com partID=M3SV) — antes o botão levava à página inicial do Portal;
   - senhas: os meios de entrar no Portal (NIF e senha, ou Autenticação.gov
     com o Cartão de Cidadão ou a Chave Móvel Digital) e o registo;
   - anexoF: quem apresenta o anexo, uma linha por prédio e por fração, o
     número do contrato, a identificação matricial, o titular (B só na
     tributação conjunta), as rendas e a natureza (06 e 07), as retenções,
     o inquilino, os gastos, as obras dos 24 meses, os quadros 4.1, 4.2,
     4.2A e 6G, os quadros 8A e 8B (rendas de anos anteriores, incluídas
     nos 4.1 e 4.2), 9 (o AIMI, os prédios e os campos 9101 e 9102) e 10
     (os contratos com redução que cessaram, com a data e o motivo), e a
     comunicação da Portaria 110/2019 até 15 de fevereiro.
   As que entraram a 2026-11-09 com a parte 3 (tickets 75c3536b e 33db56fc),
   abertas nesse dia, as páginas da AT pelo texto em vigor e os PDF lidos:
   - cirs74: n.º 1, as rendas de anos anteriores englobadas dividem-se pelos
     anos a que respeitam; n.º 3, em alternativa, declarações de
     substituição até ao quinto ano anterior ao do pagamento;
   - cirs78: n.º 1 l), o AIMI deduz-se à coleta, nos termos do 135.º-I CIMI;
   - cimi135i: n.º 1, o AIMI é dedutível à coleta do IRS de quem tem rendas
     dos prédios sobre que incidiu, até a um limite (alíneas a) e b));
   - cirs55: n.º 1 b), o resultado negativo da categoria F reporta-se aos
     seis anos seguintes; n.º 8, perde-se se os prédios não derem rendas em
     36 meses dos cinco anos seguintes;
   - cirs128: n.os 1 a 3, 15 dias (25 com dificuldade) para apresentar os
     documentos que a AT pedir, durante os quatro anos seguintes;
   - cirs101b: n.º 1 a), a dispensa de retenção abaixo do limite do 53.º do
     CIVA; n.º 1 d), sem retenção abaixo de 25 € por retenção, na redação
     do DL 49/2025, em vigor desde 1 de julho de 2025 (a redação até junho
     de 2025 só dispensava a categoria E, abaixo de 5 €); n.os 2 e 3, a
     menção no recibo e quando não se pode usar;
   - civa53: n.º 1, o limite de 15 000 € (já era 15 000 € na redação da
     Lei 24-D/2022: em 2025 não subiu);
   - cirs115: n.º 5 b), a declaração anual das rendas até ao fim de
     fevereiro, na redação do DL 49/2025, desde 1 de julho de 2025 (a
     redação até junho de 2025 dizia janeiro);
   - cis60: n.º 1, o senhorio comunica o contrato à AT; n.º 4, se não o
     fizer, o inquilino pode fazê-lo;
   - portaria106: arts. 2.º e 3.º, a comunicação do inquilino, facultativa,
     com efeitos desde 1 de agosto de 2025.
   As que entraram a 2026-11-17 (auditoria ao IRS, KAN-126), abertas nesse
   dia: as páginas da AT pelo texto em vigor e os PDF da AT lidos por
   inteiro (pdftotext), com o que se cita de cada uma:
   - portaria454 (e portaria454a7, no art. 7.º): a Portaria 454/2026/1, de 13 de outubro (DR n.º 198/2026),
     fixa os limites máximos de renda do RSAA por tipologia e concelho; art.
     6.º b), revoga a Portaria 176/2019, com efeitos a 1 de setembro de 2026
     (art. 7.º n.º 2); art. 7.º n.º 3, entre 1 de setembro de 2026 e a
     entrada em vigor (14 de outubro) valem os valores da Portaria 176/2019;
     com ela, o dl97 (lido no PDF da AT, decreto-lei-97-2026.pdf): art. 14.º
     b), desde 1 de setembro de 2026 as referências aos limites da Portaria
     176/2019 são aos do art. 4.º do anexo III (o RSAA); anexo III, art. 6.º
     n.os 1 e 3, a isenção do RSAA e a submissão ao IHRU até 15 de janeiro
     do ano seguinte ao da celebração; art. 15.º n.º 2, os contratos do
     Programa de Arrendamento Acessível em vigor mantêm os efeitos fiscais;
     art. 2.º n.º 2 a), o limite das rendas moderadas, à letra;
   - dl68: art. 20.º n.º 1, a isenção das rendas do Programa de
     Arrendamento Acessível;
   - ebf71a: n.os 3 a 6, a isenção das rendas dos programas municipais de
     arrendamento a custos acessíveis e de alojamento estudantil, pelo tempo
     do contrato, que depende de reconhecimento (n.º 6);
   - ebf74a: n.os 1 e 2, a isenção das rendas do alojamento local passado a
     arrendamento para habitação permanente (registado e afeto até
     2022-12-31, contrato celebrado e inscrito no Portal até 2024-12-31),
     até às rendas de 2029;
   - ebf46a: n.º 1, a isenção, pelo tempo do contrato, das rendas dos
     contratos para habitação anteriores ao RAU (DL 321-B/90) e sujeitos aos
     arts. 35.º ou 36.º do NRAU;
   - cirs59: n.º 2 a), na tributação conjunta uma declaração com a
     totalidade dos rendimentos do agregado;
   - oc20256: o Ofício-Circulado 20256, de 2023-06-07, ponto 4 (a caução é
     renda no ano em que se recebe) e ponto 6 (a devolução pode ser gasto
     do Anexo F do ano em que se devolve);
   - portaria98a: art. 5.º n.º 1, o recibo de renda eletrónico é
     obrigatório, «ainda que a título de caução»; n.os 2 e 3, quem está
     dispensado; art. 8.º n.º 1, a declaração anual (Modelo 44) é de quem
     está dispensado (n.º 2 e n.º 3 b)) e não optou pelo recibo;
   - e, já na lista, o cirs74 (n.os 7 e 8: a opção pelo 8B faz-se na
     declaração do ano do pagamento, e as substituições entregam-se no prazo
     do art. 60.º n.º 2, contado do fim do prazo do n.º 1), o cirs60 (n.º 2,
     30 dias) e o anexoF (quadros 4.2C, 4.4, 5, 6D, 6F e 6H; a coluna
     Titular, A e B como no rosto; os gastos «a seguros de renda»).
   As da ronda 2 (KAN-128), abertas a 2026-11-17, as páginas da AT pelo
   texto em vigor e os PDF da AT lidos (pdftotext):
   - cirs3: n.º 2 a), os rendimentos prediais imputáveis a atividades
     empresariais e profissionais são categoria B;
   - cirs4: n.º 1 n), o arrendamento com opção pela categoria B; n.º 5, a
     opção na declaração de início ou de alterações;
   - anexoB: «modelo em vigor a partir de janeiro de 2026»; o campo 410 do
     quadro 4A (os dois casos da categoria B);
   - cirs15: n.º 1, os residentes pagam IRS sobre os rendimentos obtidos
     fora do território;
   - anexoJ: «modelo em vigor a partir de janeiro de 2026»; quadro 7A, o
     código F01, o país onde se situa o imóvel (tabela X), o rendimento
     líquido dos gastos do período arrendado e o imposto pago no estrangeiro;
   - cirs81: n.º 1, o crédito de imposto por dupla tributação internacional;
   - ebf71: o artigo 71.º, n.º 7, na redação até outubro de 2023 (os 5 %;
     até 2026-11-26 na página da AT dessa redação, ebf71_ra202310);
   - piv28153: despacho de 2026-09-25, pontos 10 e 11 — o antigo n.º 7
     continua a aplicar-se a quem era dono a 6-10-2023 de imóvel cuja
     reabilitação começou entre 2-1-2008 e 6-10-2023, mesmo nas rendas
     depois dessa data;
   - piv23119: despacho de 2025-05-26 — só as rendas até 2024 de contratos
     celebrados até 6-10-2023 (a posição anterior);
   - ebf59i: n.º 2, os gastos do art. 41.º, n.º 7, do CIRS a 110 % nas
     lojas com história (o quadro 6B, nas instruções do Anexo F, com a Lei
     42/2017);
   - ebf59g: n.os 11, 14 e 15, as rendas de arrendamentos a EGF ou UGF a
     50 %, até 2020 e por 12 anos; a vigência até 31-12-2026 (Lei 73-A/2025,
     art. 260.º, n.º 3);
   - cimi113: n.º 1, o IMI liquida-se com as matrizes a 31 de dezembro;
   - reposicao: os prédios passaram às freguesias repostas com a entrada em
     vigor da Lei 25-A/2025, em outubro de 2025;
   - lei25a: a ficha da AT da Lei n.º 25-A/2025, de 13 de março;
   - e, já na lista, o anexoF (os quadros 4.3, 6A, 6B e 6C, cada benefício
     indicado pelos campos do quadro 4.1) e o processo 615/2016 (a comissão
     da gestora).
   O «cerca de 300» das freguesias repostas é de propósito: a imprensa falou
   de 302, e a tabela da AT tem 303 linhas.
   As da segunda auditoria de raiz (2026-11-23, ronda 2 das correções),
   abertas nesse dia (a página da AT pelo texto em vigor e os PDF da AT lidos
   em pdftotext):
   - ebf14: n.º 5 a) e b), os impostos ou contribuições por pagar, sem
     reclamação, impugnação ou oposição com garantia; n.º 6, os benefícios
     automáticos não se aplicam no ano em que isso acontece; n.º 7 a), nos
     impostos sobre o rendimento conta o fim do ano, se se mantiver no fim
     do prazo de audição da liquidação (N151);
   - oc20268: o Ofício-Circulado 20268, de 2024-03-12, ponto 4 (os contratos
     de 2 a menos de 5 anos mantêm a taxa inferior a 25 % até ao termo ou à
     renovação, o n.º 8 do artigo 50.º da Lei 56/2023), ponto 6 (o regime
     novo é dos contratos e renovações desde 7 de outubro de 2023, o n.º 7),
     pontos 7 e 8 (na renovação, a redução conta-se a partir dos 25 %; o
     exemplo dos 13 %) e ponto 5 c) (o n.º 24) (N095);
   - o processo 26713 (despacho de 2024-08-29), ponto 7: antes do
     arrendamento, só as obras de conservação e manutenção dos 24 meses
     (N046, com o 1115/2017 em sentido contrário no certificado energético);
   - e, já na lista, a portaria98a (art. 5.º n.º 1, o recibo é de quem não
     optou pela categoria B; n.º 3 a), as rendas do arrendamento rural; art.
     8.º n.º 4, o Modelo 44 delas por opção — N029, N093, N030), o cirs115
     (n.º 1 a), a fatura, a fatura-recibo ou o recibo da categoria B), o
     cirs41 (n.º 5, o IMI e o selo — N094), a Lei 56/2023 (art. 50.º n.os 7 e
     8), o cirs72 (n.º 24), o anexoF (os quadros 4.2B e 10 — N155) e os
     processos 1115/2017 e 4074/2017 (a cozinha e a casa de banho — N045).
   As da parte 4, do texto do Martinho, verificadas a 2026-11-08. */
const DR = 'https://diariodarepublica.pt/dr/';
// os documentos consolidados do DR de onde saem os artigos (o texto inteiro, sempre na versão em vigor)
const CIRS = DR + 'legislacao-consolidada/lei/2014-70048167';
const EBF = DR + 'legislacao-consolidada/decreto-lei/1989-34554075';
const CIMI = DR + 'legislacao-consolidada/decreto-lei/2003-34499575';
const DL97 = DR + 'legislacao-consolidada/decreto-lei/2026-1124729375';
const NRAU = DR + 'legislacao-consolidada/lei/2006-34578375';
const DL68 = DR + 'legislacao-consolidada/decreto-lei/2019-150114015';
const LEI56_CONS = DR + 'legislacao-consolidada/lei/2023-222471959';
const PORTARIA98A = DR + 'legislacao-consolidada/portaria/2015-71124567';
const CIS = DR + 'legislacao-consolidada/lei/1999-34540175';
const CIVA = DR + 'legislacao-consolidada/decreto-lei/2008-34500675';
// os diplomas publicados (sem versão consolidada) de que o guia cita um artigo
const P454 = DR + 'detalhe/portaria/454-2026-1179722108';
const P104 = DR + 'detalhe/portaria/104-2026-1066993467';

/* Um pedaço de texto para um fragmento de texto (#:~:text=): em URL, e o
   hífen, a vírgula e o «&», que separam as partes do fragmento, também.
   Recebe: t — o texto. Devolve: o texto codificado. */
const noFragmento = (t) => encodeURIComponent(t).replace(/-/g, '%2D');

/* O endereço de um documento do DR aberto num artigo: o documento inteiro,
   com um fragmento de texto (o título do artigo seguido da epígrafe) que o
   browser procura e põe à vista, realçado. Não é garantido: o browser só o
   procura uns segundos depois de a página carregar, e o DR desenha o texto
   do diploma depois (num código grande, já tarde de mais); aí, e nos
   browsers que não conhecem o fragmento, o documento abre no topo. Não há
   melhor: a página do próprio artigo, no telemóvel, só mostra se ele está
   em vigor (KAN-164), e o DR não tem âncoras nem parâmetro para o artigo
   (os ids no documento mudam a cada carga, o índice leva à página do
   artigo, a pesquisa no texto não muda o endereço).
   Recebe: doc — o endereço do documento; titulo — «Artigo 8.º» (ou «Anexo
   III»), como o DR o escreve; epigrafe — a epígrafe, idem.
   Devolve: o endereço. */
function noArtigo(doc, titulo, epigrafe) {
  return doc + '#:~:text=' + noFragmento(titulo) + '-,' + noFragmento(epigrafe);
}
const AT_DOC = 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/';
const PIV = AT_DOC + 'informacoes_vinculativas/rendimento/cirs/Documents/';
export const FONTES = [
  { id: 'cirs8', nome: 'Diário da República, Código do IRS, artigo 8.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 8.º', 'Rendimentos da categoria F') },
  { id: 'cirs57', nome: 'Diário da República, Código do IRS, artigo 57.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 57.º', 'Declaração de rendimentos') },
  { id: 'anexoF', nome: 'AT, Anexo F da declaração Modelo 3 e instruções de preenchimento, modelo em vigor desde janeiro de 2025', url: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/modelos_formularios/irs/Documents/Mod_3_anexo_F.pdf' },
  { id: 'cirs4', nome: 'Diário da República, Código do IRS, artigo 4.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 4.º', 'Atividades comerciais e industriais, agrícolas, silvícolas e pecuárias') },
  { id: 'cirs3', nome: 'Diário da República, Código do IRS, artigo 3.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 3.º', 'Rendimentos da categoria B') },
  { id: 'anexoB', nome: 'AT, Anexo B da declaração Modelo 3 e instruções de preenchimento, modelo em vigor desde janeiro de 2026', url: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/modelos_formularios/irs/Documents/Mod_3_anexo_B.pdf' },
  { id: 'cirs15', nome: 'Diário da República, Código do IRS, artigo 15.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 15.º', 'Âmbito da sujeição') },
  { id: 'anexoJ', nome: 'AT, Anexo J da declaração Modelo 3 e instruções de preenchimento, modelo em vigor desde janeiro de 2026', url: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/modelos_formularios/irs/Documents/Mod_3_anexo_J.pdf' },
  { id: 'cirs81', nome: 'Diário da República, Código do IRS, artigo 81.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 81.º', 'Eliminação da dupla tributação jurídica internacional') },
  { id: 'cirs60', nome: 'Diário da República, Código do IRS, artigo 60.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 60.º', 'Prazo de entrega da declaração') },
  { id: 'cirs22', nome: 'Diário da República, Código do IRS, artigo 22.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 22.º', 'Englobamento') },
  { id: 'cirs72', nome: 'Diário da República, Código do IRS, artigo 72.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 72.º', 'Taxas especiais') },
  { id: 'ebf45c', nome: 'Diário da República, Estatuto dos Benefícios Fiscais, artigo 45.º-C, versão consolidada', url: noArtigo(EBF, 'Artigo 45.º-C', 'Rendimentos prediais no âmbito do arrendamento para habitação') },
  { id: 'dl97a2', nome: 'Diário da República, Decreto-Lei n.º 97/2026, de 20 de maio, artigo 2.º, versão consolidada', url: noArtigo(DL97, 'Artigo 2.º', 'Âmbito de aplicação') },
  { id: 'dl139', nome: 'Diário da República, Decreto-Lei n.º 139/2025, de 29 de dezembro', url: DR + 'detalhe/decreto-lei/139-2025-992879809' },
  // o n.º 7 foi revogado pela Lei n.º 56/2023: o DR não tem a redação de antes, e o documento mostra-o revogado
  { id: 'ebf71', nome: 'Diário da República, Estatuto dos Benefícios Fiscais, artigo 71.º, versão consolidada (o n.º 7, revogado pela Lei n.º 56/2023)', url: noArtigo(EBF, 'Artigo 71.º', 'Incentivos à reabilitação urbana') },
  { id: 'lei56', nome: 'Diário da República, Lei n.º 56/2023, de 6 de outubro', url: DR + 'detalhe/lei/56-2023-222477692' },
  { id: 'nrau', nome: 'Diário da República, Novo Regime do Arrendamento Urbano (Lei n.º 6/2006, de 27 de fevereiro), versão consolidada', url: NRAU },
  { id: 'piv28153', nome: 'AT, Informação Vinculativa, processo 28153: a taxa de 5 % dos imóveis reabilitados depois da Lei n.º 56/2023', url: AT_DOC + 'informacoes_vinculativas/EBF/PIV_28153.pdf' },
  { id: 'piv23119', nome: 'AT, Informação Vinculativa, processo 23119: a posição anterior da AT sobre a mesma taxa', url: PIV + 'PIV_23119.pdf' },
  { id: 'dl68a20', nome: 'Diário da República, Decreto-Lei n.º 68/2019, de 22 de maio, artigo 20.º, versão consolidada', url: noArtigo(DL68, 'Artigo 20.º', 'Regime fiscal') },
  { id: 'ebf71a', nome: 'Diário da República, Estatuto dos Benefícios Fiscais, artigo 71.º-A, versão consolidada', url: noArtigo(EBF, 'Artigo 71.º-A', 'Incentivos ao arrendamento habitacional a custos acessíveis e à venda de imóveis ao Estado') },
  { id: 'dl97a15', nome: 'Diário da República, Decreto-Lei n.º 97/2026, artigo 15.º, versão consolidada', url: noArtigo(DL97, 'Artigo 15.º', 'Norma transitória') },
  { id: 'portaria454', nome: 'Diário da República, Portaria n.º 454/2026/1, de 13 de outubro: os limites de renda do Regime Simplificado de Arrendamento Acessível', url: P454 },
  { id: 'portaria454a7', nome: 'Diário da República, Portaria n.º 454/2026/1, artigo 7.º', url: noArtigo(P454, 'Artigo 7.º', 'Entrada em vigor e produção de efeitos') },
  { id: 'dl97x3', nome: 'Diário da República, Decreto-Lei n.º 97/2026, anexo III: o Regime Simplificado de Arrendamento Acessível, versão consolidada', url: noArtigo(DL97, 'Anexo III', 'Regime simplificado de arrendamento acessível') },
  { id: 'ebf74a', nome: 'Diário da República, Estatuto dos Benefícios Fiscais, artigo 74.º-A, versão consolidada', url: noArtigo(EBF, 'Artigo 74.º-A', 'Transferência de imóveis de alojamento local para arrendamento') },
  { id: 'dl321b', nome: 'Diário da República, Decreto-Lei n.º 321-B/90, de 15 de outubro: o Regime do Arrendamento Urbano', url: DR + 'detalhe/decreto-lei/321-b-1990-667147' },
  { id: 'nrau35', nome: 'Diário da República, Novo Regime do Arrendamento Urbano (Lei n.º 6/2006), artigo 35.º, versão consolidada', url: noArtigo(NRAU, 'Artigo 35.º', 'Arrendatário com RABC inferior a cinco RMNA') },
  { id: 'nrau36', nome: 'Diário da República, Novo Regime do Arrendamento Urbano (Lei n.º 6/2006), artigo 36.º, versão consolidada', url: noArtigo(NRAU, 'Artigo 36.º', 'Arrendatário com idade igual ou superior a 65 anos ou com deficiência com grau de incapacidade superior a 60 %') },
  { id: 'ebf46a', nome: 'Diário da República, Estatuto dos Benefícios Fiscais, artigo 46.º-A, versão consolidada', url: noArtigo(EBF, 'Artigo 46.º-A', 'Arrendamentos para habitação celebrados antes do Regime do Arrendamento Urbano') },
  { id: 'ebf14', nome: 'Diário da República, Estatuto dos Benefícios Fiscais, artigo 14.º, versão consolidada', url: noArtigo(EBF, 'Artigo 14.º', 'Extinção dos benefícios fiscais') },
  { id: 'lei56a50', nome: 'Diário da República, Lei n.º 56/2023, artigo 50.º, versão consolidada', url: noArtigo(LEI56_CONS, 'Artigo 50.º', 'Norma transitória em matéria fiscal') },
  { id: 'oc20268', nome: 'AT, Ofício-Circulado n.º 20268, de 12 de março de 2024: a Lei n.º 56/2023 e as rendas', url: AT_DOC + 'legislacao/instrucoes_administrativas/Documents/Oficio_circulado_20268_2024.pdf' },
  { id: 'portaria176', nome: 'Diário da República, Portaria n.º 176/2019, de 6 de junho, versão consolidada', url: DR + 'legislacao-consolidada/portaria/2019-853115784' },
  { id: 'dl97a14', nome: 'Diário da República, Decreto-Lei n.º 97/2026, artigo 14.º, versão consolidada', url: noArtigo(DL97, 'Artigo 14.º', 'Referências legais') },
  { id: 'portaria110', nome: 'Diário da República, Portaria n.º 110/2019, de 12 de abril', url: DR + 'detalhe/portaria/110-2019-122086336' },
  { id: 'cirs68', nome: 'Diário da República, Código do IRS, artigo 68.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 68.º', 'Taxas gerais') },
  { id: 'portaria104', nome: 'Diário da República, Portaria n.º 104/2026/1, de 5 de março: os modelos da declaração Modelo 3', url: P104 },
  { id: 'portaria104a2', nome: 'Diário da República, Portaria n.º 104/2026/1, artigos 2.º e 3.º', url: noArtigo(P104, 'Artigo 2.º', 'Cumprimento da obrigação') },
  { id: 'entrega', nome: 'Portal das Finanças, entrega da declaração de IRS', url: 'https://irs.portaldasfinancas.gov.pt/app/entrega' },
  { id: 'senhas', nome: 'AT, folheto «Acesso ao Portal das Finanças: autenticação e senhas»', url: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/Folhetos_informativos/Documents/senhas.pdf' },
  { id: 'lei25a', nome: 'Diário da República, Lei n.º 25-A/2025, de 13 de março: a reposição das freguesias agregadas, versão consolidada', url: DR + 'legislacao-consolidada/lei/2025-911088740' },
  { id: 'reposicao', nome: 'AT, «Reposição de freguesias agregadas 2025»: a tabela de correspondência', url: 'https://info.portaldasfinancas.gov.pt/pt/destaques/Paginas/Reposicao-freguesias-agregadas-2025-tab-correspondencia.aspx' },
  { id: 'cimi113', nome: 'Diário da República, Código do IMI, artigo 113.º, versão consolidada', url: noArtigo(CIMI, 'Artigo 113.º', 'Competência e prazo da liquidação') },
  { id: 'cirs59', nome: 'Diário da República, Código do IRS, artigo 59.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 59.º', 'Tributação de casados e de unidos de facto') },
  { id: 'cirs41', nome: 'Diário da República, Código do IRS, artigo 41.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 41.º', 'Deduções') },
  { id: 'piv615', nome: 'AT, Informação Vinculativa, processo 615/2016: mediação e gestão imobiliária', url: PIV + 'PIV_10049_Cat_F_despesas_com_agencia_imobiliaria_intermediacao_e_gestao_do_arrendamento.pdf' },
  { id: 'oc20256', nome: 'AT, Ofício-Circulado n.º 20256, de 7 de junho de 2023: a tributação da caução', url: AT_DOC + 'legislacao/instrucoes_administrativas/Documents/Oficio_Circulado_20256_2023.pdf' },
  { id: 'portaria98a5', nome: 'Diário da República, Portaria n.º 98-A/2015, de 31 de março, artigo 5.º, versão consolidada', url: noArtigo(PORTARIA98A, 'Artigo 5.º', 'Âmbito de aplicação') },
  { id: 'portaria98a', nome: 'Diário da República, Portaria n.º 98-A/2015: o recibo de renda eletrónico e a declaração Modelo 44, versão consolidada', url: PORTARIA98A },
  { id: 'portaria98a8', nome: 'Diário da República, Portaria n.º 98-A/2015, artigo 8.º, versão consolidada', url: noArtigo(PORTARIA98A, 'Artigo 8.º', 'Declaração de rendas') },
  { id: 'dl1', nome: 'Diário da República, Decreto-Lei n.º 1/2020, de 9 de janeiro: o direito real de habitação duradoura', url: DR + 'detalhe/decreto-lei/1-2020-127899795' },
  { id: 'lei42', nome: 'Diário da República, Lei n.º 42/2017, de 14 de junho: os estabelecimentos de interesse histórico, versão consolidada', url: DR + 'legislacao-consolidada/lei/2017-107516777' },
  { id: 'ebf59i', nome: 'Diário da República, Estatuto dos Benefícios Fiscais, artigo 59.º-I, versão consolidada', url: noArtigo(EBF, 'Artigo 59.º-I', 'Prédios ou parte de prédios afetos a lojas com história') },
  { id: 'ebf59g', nome: 'Diário da República, Estatuto dos Benefícios Fiscais, artigo 59.º-G, versão consolidada', url: noArtigo(EBF, 'Artigo 59.º-G', 'Entidades de gestão florestal e unidades de gestão florestal') },
  { id: 'cirs74', nome: 'Diário da República, Código do IRS, artigo 74.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 74.º', 'Rendimentos produzidos em anos anteriores') },
  { id: 'cirs78', nome: 'Diário da República, Código do IRS, artigo 78.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 78.º', 'Deduções à coleta') },
  { id: 'cimi135i', nome: 'Diário da República, Código do IMI, artigo 135.º-I, versão consolidada', url: noArtigo(CIMI, 'Artigo 135.º-I', 'Dedução em IRS') },
  { id: 'dl68', nome: 'Diário da República, Decreto-Lei n.º 68/2019, de 22 de maio: o Programa de Arrendamento Acessível, hoje Programa de Apoio ao Arrendamento, versão consolidada', url: DL68 },
  { id: 'cirs55', nome: 'Diário da República, Código do IRS, artigo 55.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 55.º', 'Dedução de perdas') },
  { id: 'cirs128', nome: 'Diário da República, Código do IRS, artigo 128.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 128.º', 'Obrigação de comprovar os elementos das declarações') },
  { id: 'cirs101b', nome: 'Diário da República, Código do IRS, artigo 101.º-B, versão consolidada', url: noArtigo(CIRS, 'Artigo 101.º-B', 'Dispensa de retenção na fonte') },
  { id: 'dl49', nome: 'Diário da República, Decreto-Lei n.º 49/2025, de 27 de março', url: DR + 'detalhe/decreto-lei/49-2025-912653926' },
  { id: 'cirs115', nome: 'Diário da República, Código do IRS, artigo 115.º, versão consolidada', url: noArtigo(CIRS, 'Artigo 115.º', 'Emissão de recibos e faturas') },
  { id: 'cis60', nome: 'Diário da República, Código do Imposto do Selo, artigo 60.º, versão consolidada', url: noArtigo(CIS, 'Artigo 60.º', 'Contratos de arrendamento') },
  { id: 'portaria106', nome: 'Diário da República, Portaria n.º 106/2025/1, de 13 de março: a comunicação do contrato pelo inquilino', url: DR + 'detalhe/portaria/106-2025-910702650' },
  { id: 'civa53', nome: 'Diário da República, Código do IVA, artigo 53.º, versão consolidada', url: noArtigo(CIVA, 'Artigo 53.º', 'Âmbito de aplicação no território nacional') },
  { id: 'apoio', nome: 'AT, página de apoio sobre rendimentos prediais', url: 'https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Cidadaos/Rendimentos/Prediais/Paginas/default.aspx' },
  { id: 'piv1115', nome: 'AT, Informação Vinculativa, processo 1115/2017: certificado energético, seguro, IMI, condomínio e reparações', url: PIV + 'PIV_11676_Cat_F_Despesas_elegiveis_certificado_energetico_pintura_proporcionalidade_mensal_IMI.pdf' },
  { id: 'piv4074', nome: 'AT, Informação Vinculativa, processo 4074/2017: instalações, sanita e eletrodomésticos', url: PIV + 'PIV_12846.pdf' },
  { id: 'piv26713', nome: 'AT, Informação Vinculativa, processo 26713: os gastos de antes do arrendamento e a reconstrução de um imóvel', url: PIV + 'PIV_26713.pdf' },
  { id: 'piv27168', nome: 'AT, Informação Vinculativa, processo 27168: fundo comum de reserva', url: PIV + 'PIV_27168.pdf' },
  { id: 'piv23002', nome: 'AT, Informação Vinculativa, processo 23002: água, luz e gás', url: PIV + 'PIV_23002.pdf' },
  { id: 'piv28509', nome: 'AT, Informação Vinculativa, processo 28509: água, eletricidade e Internet', url: PIV + 'PIV_28509.pdf' },
];

/* O conteúdo do guia. Cada secção tem o id da âncora, o título e os blocos,
   por ordem: `p` (parágrafo), `sim`/`nao` (listas com visto ou cruz), `cond`
   (condições, que se cumprem todas), `info` (factos soltos, com o ponto das
   condições), `doc` (papéis a guardar), `grupo` (um subtítulo com os seus
   blocos), `nota` (uma caixa âmbar), `fonte` (a linha da fonte principal,
   com a chave da fonte) e `ir` (o botão para um sítio oficial, idem).

   A parte 4, «As deduções», são as cinco secções do texto verificado pelo
   Martinho, com os mesmos factos, artigos e linhas, escritas no tom próximo
   que ele pediu para o guia todo (ticket 8615e719), cada uma com o id de
   antes (há ligações de fora para #pode-deduzir e as outras). */
const DEDUCOES = [
  { id: 'regra', titulo: 'A regra geral', blocos: [
    { p: 'Às rendas brutas de cada prédio, ou de cada parte de um prédio, podes abater os gastos que cumpram estas ' +
      'cinco condições, todas ao mesmo tempo ({artigo 41.º, n.os 1 e 9, do Código do IRS|cirs41}):' },
    { cond: [
      'Foste tu, senhorio, quem os suportou.',
      'Já estão pagos.',
      'Foram precisos para receberes ou garantires as rendas.',
      'São do imóvel que te deu essas rendas.',
      'Tens os documentos que os provam.',
    ] },
    { p: 'E há gastos que a lei deixa de fora com todas as letras: os gastos financeiros, as depreciações, o ' +
      'mobiliário, os eletrodomésticos, os artigos de conforto ou decoração e o Adicional ao IMI (AIMI).' },
    // N094 (2026-11-23): o período arrendado e a exceção do IMI e do selo (artigo 41.º, n.º 5)
    { p: 'Contam os gastos do tempo em que o imóvel esteve arrendado, como pedem as {instruções do Anexo F|anexoF}. O IMI e ' +
      'o imposto do selo são a exceção: contam os que pagaste no ano em que o imóvel deu rendas, mesmo que no dia ' +
      'do pagamento estivesse vazio ({artigo 41.º, n.º 5|cirs41}).' },
    { fonte: 'cirs41', texto: 'Fonte principal: artigo 41.º do Código do IRS, Diário da República.' },
  ] },

  { id: 'pode-deduzir', titulo: 'O que podes deduzir', blocos: [
    { grupo: 'Impostos e contrato', blocos: [{ sim: [
      'O IMI que pagaste no ano, se for de um imóvel, ou de parte dele, cujas rendas são tributadas nesse mesmo ano. ' +
        'Não tens de o dividir pelos meses em que esteve arrendado: a AT já aceitou o valor do ano inteiro quando o ' +
        'imóvel deu rendas nesse ano.',
      'O Imposto do Selo do contrato de arrendamento, pago no ano, de um imóvel que deu rendas tributadas nesse ano.',
      'O seguro de renda, que o {artigo 41.º, n.º 1|cirs41}, inclui expressamente.',
    ] }] },
    { grupo: 'Condomínio', blocos: [
      { sim: [
        'As quotas e os encargos obrigatórios do condomínio da fração arrendada, desde que tenhas sido tu a pagá-los.',
        'Se tens várias frações no mesmo prédio, só a parte da fração arrendada, calculada pela permilagem dela.',
        'As obras nas partes comuns, no ano em que o condomínio usa mesmo o dinheiro para pagar a obra, com um ' +
          'documento do administrador que diga qual é a obra e a parte que cabe à tua fração.',
      ] },
      { nota: 'Fundo comum de reserva', texto: 'O dinheiro que entregas ao fundo não se abate no ano em que o ' +
        'entregas, se ainda não tiver sido usado. Conta no ano em que o condomínio o usa para pagar obras que se podem ' +
        'abater e te passa o documento, como condómino.' },
    ] },
    { grupo: 'Conservação e manutenção', blocos: [
      { p: 'Desde que sirvam para manter ou repor o imóvel, e tenhas os documentos que o provam:' },
      { sim: [
        'Pintura.',
        'Reparação de paredes, tetos e pavimentos.',
        'Reparação de infiltrações e telhado.',
        'Canalização e instalação elétrica.',
        'Reparação ou substituição de portas e janelas integradas no imóvel.',
        // N045 (2026-11-23): os armários, as bancadas e a sanita passaram para «O que pede cuidado» (Cozinha e
        // casa de banho): repor o que havia deduz-se, uma cozinha ou casa de banho nova não
        'Inspeção da instalação de gás.',
        'Restauro, reparação e limpeza ligados à conservação do edifício.',
      ] },
    ] },
    { grupo: 'Despesas anteriores ao arrendamento', blocos: [{ sim: [
      'As obras de conservação e manutenção que pagaste nos 24 meses antes de o arrendamento começar, desde que, ' +
        'entretanto, não tenhas usado o imóvel para outro fim que não o de o arrendar.',
    ] }] },
    // N046 (2026-11-23): pagos antes de o contrato começar, a AT responde nos dois sentidos — vê «O que pede cuidado»
    { grupo: 'Serviços ligados ao arrendamento', blocos: [{ sim: [
      'O certificado energético e a comissão da imobiliária por te encontrar inquilino, pagos com o imóvel ' +
        'arrendado — a comissão, se os documentos mostrarem, sem margem para dúvidas, a ligação ao contrato e ao ' +
        'imóvel. Pagos antes de o arrendamento começar, vê «O que pede cuidado».',
      'A gestão do arrendamento por uma imobiliária, com a mesma prova e a mesma ligação direta.',
    ] }] },
    { grupo: 'Situação especial: mudança da habitação própria', blocos: [
      { p: 'Se mudaste de casa e arrendaste a antiga, podes abater às rendas que recebes as que pagas pela tua nova ' +
        'habitação própria e permanente, até ao valor das rendas brutas. Para isso, têm de se cumprir todas estas ' +
        'condições ({artigo 41.º, n.º 8|cirs41}):' },
      { cond: [
        'A casa que agora arrendas foi a tua habitação própria e permanente, ou a do teu agregado, durante pelo menos ' +
          '12 meses.',
        'Mudaste o domicílio fiscal para mais de 100 km de distância.',
        'A casa de onde saíste está arrendada para habitação.',
        'Os dois contratos de arrendamento estão registados no Portal das Finanças.',
      ] },
      { p: 'Estas rendas têm um quadro próprio: declara-las no quadro 4.4 do Anexo F, com o campo da ' +
        'linha da casa que arrendaste, o número do contrato em que és tu o inquilino, a identificação matricial da casa nova e as rendas que pagaste no ano ' +
        '({instruções do quadro 4.4 do Anexo F|anexoF}).' },
    ] },
  ] },

  { id: 'nao-pode-deduzir', titulo: 'O que não podes deduzir', blocos: [{ nao: [
    'O AIMI, o Adicional ao Imposto Municipal sobre Imóveis: o {artigo 41.º, n.º 1|cirs41}, deixa-o de fora expressamente.',
    'Os juros do crédito à habitação ou de outro financiamento.',
    'A amortização do capital do empréstimo.',
    'As comissões bancárias e outros gastos financeiros.',
    'O seguro de vida do empréstimo.',
    'A depreciação ou desvalorização contabilística do imóvel.',
    'Comprar ou substituir eletrodomésticos, como o frigorífico, o forno, a placa, a máquina de lavar, a televisão e ' +
      'afins.',
    'Reparar eletrodomésticos, incluindo os esquentadores que contam como eletrodomésticos, segundo a {posição ' +
      'expressa da AT|piv1115}.',
    'Móveis, como camas, sofás, mesas, cadeiras e armários que não fazem parte do imóvel.',
    'Lâmpadas, artigos de conforto e decoração.',
    'O seguro multirriscos facultativo da casa, segundo a {informação vinculativa da AT de 2017|piv1115}. O seguro obrigatório ' +
      'do prédio pode entrar nas despesas de manutenção, mas a parte facultativa ou do recheio não a deves deduzir se ' +
      'não estiver separada nos documentos.',
    'O dinheiro que entregas ao fundo comum de reserva, enquanto o condomínio não o usar numa obra que se possa abater.',
    'As despesas que o inquilino pagou.',
    'O trabalho que fizeste tu, sem fatura nem pagamento que o prove.',
    'As despesas das frações que não estão arrendadas.',
    'Multas, coimas e juros de mora.',
    'Na sublocação, nenhuma dedução à diferença entre a renda que recebes e a que pagas como sublocador.',
  ] }] },

  { id: 'cuidado', titulo: 'O que pede cuidado', blocos: [
    { nota: 'Água, eletricidade, gás e Internet', texto: 'Pagá-las não chega para as abateres. Pelas informações ' +
      'vinculativas mais recentes da AT ({processo 23002|piv23002} e {processo 28509|piv28509}), só contam quando:',
    cond: [
      'O contrato diz expressamente que estão incluídas na renda e que ficam a cargo do senhorio.',
      'Isso aparece na declaração Modelo 2 do Imposto do Selo, incluindo o campo do valor das despesas.',
      'Tens as faturas e a prova legal do pagamento.',
    ],
    fim: 'Se faltar alguma destas condições, não deduzas os consumos do inquilino.' },
    { nota: 'Honorários de advogado, solicitador, contabilista ou custos judiciais', texto: 'O {artigo 41.º|cirs41} tem uma ' +
      'regra geral ampla, mas não encontrámos orientação oficial concreta o bastante para dizer que todas estas ' +
      'despesas se abatem sempre. Não as incluas só por uma descrição genérica. Se o valor for alto, pede uma ' +
      'resposta escrita no e-balcão ou uma informação vinculativa, e diz qual é o serviço, o imóvel e a ligação ' +
      'direta às rendas que recebes ou garantes.' },
    { nota: 'Obras de melhoria ou ampliação', texto: 'A conservação e a manutenção abatem-se; uma ampliação, uma ' +
      'valorização ou uma transformação de fundo podem não se abater. Se a fatura junta reparação e melhoria, pede ao ' +
      'empreiteiro que separe os materiais e a mão de obra de cada intervenção.' },
    // N045 (2026-11-23): a cozinha e a casa de banho dependem do que se fez
    { nota: 'Cozinha e casa de banho', texto: 'Depende do que fizeste. Reparar ou substituir o que já lá estava é ' +
      'conservação: a AT já aceitou a reparação ou a substituição dos armários fixos e das bancadas da cozinha, desde ' +
      'que não sejam tratados como mobiliário, e a substituição da sanita (informações vinculativas, {processos ' +
      '1115/2017|piv1115} e {4074/2017|piv4074}). Uma cozinha ou uma casa de banho nova, que acrescenta ao que havia e valoriza o ' +
      'imóvel, é uma melhoria, e pode não se abater; os eletrodomésticos nunca se abatem. Guarda a fatura ' +
      'discriminada e as fotografias do antes e do depois.' },
    // N046 (2026-11-23, decisão D9 b do Martinho): na dúvida, não se abatem
    { nota: 'Gastos pagos antes de o arrendamento começar', texto: 'Antes de o arrendamento começar, só as obras de ' +
      'conservação e manutenção dos 24 meses anteriores têm regra própria ({artigo 41.º, n.º 7|cirs41}). O certificado ' +
      'energético, a comissão da imobiliária e os anúncios pagos antes do início do contrato não têm resposta certa: ' +
      'a AT já aceitou o certificado energético, por ser obrigatório para arrendar ({informação vinculativa, processo ' +
      '1115/2017|piv1115}), e noutra resposta disse que, antes do arrendamento, só as obras de conservação e manutenção se ' +
      'abatem ({processo 26713, de 2024|piv26713}). Na dúvida, não os abatas. Se o valor for alto, pede uma resposta escrita no ' +
      'e-balcão ou uma informação vinculativa.' },
  ] },

  { id: 'documentos', titulo: 'Os documentos a guardar', blocos: [
    { p: 'De cada imóvel, e em cada ano, guarda:' },
    { doc: [
      'A fatura ou o documento fiscal com o teu NIF.',
      'Uma descrição que diga qual foi o serviço e, de preferência, a morada ou o artigo matricial.',
      'O recibo e a prova bancária do pagamento.',
      'A liquidação e o comprovativo do IMI.',
      'O comprovativo do Imposto do Selo.',
      'O contrato de arrendamento e os aditamentos.',
      'A declaração e os recibos do condomínio.',
      'As atas que aprovaram quotas extraordinárias ou obras.',
      'A declaração do administrador sobre o uso do fundo de reserva e a parte da obra que cabe à tua fração.',
      'O orçamento, o contrato e a fatura discriminada das obras.',
      'Fotografias do antes e do depois, sobretudo nas obras maiores.',
      'As apólices e os recibos dos seguros, com as coberturas separadas.',
      'O contrato e a fatura da imobiliária.',
      'O certificado energético e a fatura dele.',
    ] },
    { nota: 'Os três elementos', texto: 'Uma fatura sozinha pode não provar que pagaste, nem que é daquele imóvel. ' +
      'Guarda os três: o que foi a despesa, de que imóvel é e a prova de que a pagaste.' },
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
      'que sejam da categoria B, nos dois casos que vês mais abaixo ({artigo 8.º, n.º 1, do Código do IRS|cirs8}).' },
    { p: 'Recebeste rendas num ano, tu ou um dependente do teu agregado? Então declara-las no IRS desse ano, na ' +
      'Modelo 3, com o Anexo F ({artigo 57.º|cirs57} e {instruções do Anexo F|anexoF}).' },
    // D133, D134 (2026-11-17): as rendas que saem do Anexo F, e para que anexo vão. Sem alojamento local
    // (decisão do Martinho, 2026-11-17: a app é só de arrendamento com contratos)
    { grupo: 'Quando não vão ao Anexo F', blocos: [
      { p: 'Há rendas que não se declaram no Anexo F:' },
      { info: [
        'As rendas da categoria B, em dois casos: optaste por tributar o arrendamento na categoria B, na ' +
          'declaração de início de atividade ou na de alterações ({artigo 4.º, n.º 1, alínea n), e n.º 5|cirs4}), ou o ' +
          'prédio está afeto a uma atividade tua, empresarial ou profissional, e as rendas são-lhe imputáveis ' +
          '({artigo 3.º, n.º 2, alínea a)|cirs3}). Nos dois, o resultado vai ao Anexo B, no campo 410 do quadro 4A ' +
          '({instruções do Anexo B|anexoB}), ou ao Anexo C, se a atividade tem contabilidade organizada.',
        'As rendas de um imóvel fora de Portugal. Se és residente, declara-las no Anexo J, no quadro 7A, com o ' +
          'código F01, o país onde fica o imóvel, o rendimento já líquido dos gastos do tempo em que esteve ' +
          'arrendado e o imposto que lá pagaste: o Anexo F é só dos rendimentos obtidos em Portugal ({artigo 15.º, ' +
          'n.º 1|cirs15}; {instruções do Anexo F|anexoF} e {do Anexo J|anexoJ}). O imposto pago no país do imóvel abate-se ao ' +
          'IRS, até a um limite ({artigo 81.º, n.º 1|cirs81}).',
      ] },
    ] },
    { grupo: 'O prazo', blocos: [
      { p: 'Entregas a declaração de 1 de abril a 30 de junho do ano seguinte ao das rendas. Ou seja, as rendas de ' +
        '2026 declaras de 1 de abril a 30 de junho de 2027 ({artigo 60.º, n.º 1|cirs60}).' },
    ] },
    { grupo: 'A taxa', blocos: [
      { p: 'Normalmente, as rendas não se juntam aos teus outros rendimentos: pagam uma taxa só delas, a taxa ' +
        'autónoma ({artigos 22.º, n.º 3|cirs22}, e {72.º|cirs72}).' },
      { info: [
        '25 % nas rendas de arrendamento habitacional ({artigo 72.º, n.º 2|cirs72}).',
        '28 % nas outras rendas prediais, como as de um arrendamento não habitacional ({artigo 72.º, n.º 1, alínea e)|cirs72}).',
        // D109: o limite como o Decreto-Lei n.º 97/2026 o escreve, sem «no continente», que sugeria outro nas
        // regiões autónomas; a lei não as distingue, e a AT ainda não disse qual retribuição vale nelas
        '10 % nas rendas de 2026 a 2029 de contratos só para habitação com renda mensal até 2,5 vezes o valor ' +
          'da retribuição mínima mensal prevista para 2026 (2 300 €, com a retribuição de 920 € do ' +
          '{Decreto-Lei n.º 139/2025|dl139}), salvo se te couber uma taxa mais baixa ({artigo 45.º-C do Estatuto dos ' +
          'Benefícios Fiscais|ebf45c}; {Decreto-Lei n.º 97/2026, artigo 2.º, n.º 2, alínea a)|dl97a2}).',
        // D118 (2026-11-17): os 5 % da reabilitação, pela doutrina da AT, que já mudou uma vez
        '5 % nas rendas de um imóvel reabilitado, em área de reabilitação urbana ou do {Novo Regime do ' +
          'Arrendamento Urbano|nrau}, com a reabilitação comprovada pela câmara, se ela começou entre 2 de janeiro de ' +
          '2008 e 6 de outubro de 2023 e já eras dono do imóvel a 6 de outubro de 2023. A norma que dava esta ' +
          'taxa ({artigo 71.º, n.º 7, do Estatuto dos Benefícios Fiscais|ebf71}) foi revogada pela {Lei n.º 56/2023|lei56}, ' +
          'mas a AT continua a aplicá-la a estes donos, também nas rendas depois dessa data ({informação vinculativa, ' +
          'processo 28153, de 25 de setembro de 2026|piv28153}). A AT já mudou de posição: em 2025 só a aplicava às rendas ' +
          'até 2024 de contratos feitos até 6 de outubro de 2023 ({processo 23119|piv23119}). Declaras estas rendas no ' +
          'quadro 4.1, e indicas a linha no quadro 6A ({instruções do quadro 6A|anexoF}).',
      ] },
    ] },
    { grupo: 'Rendas isentas', blocos: [
      { p: 'Algumas rendas estão isentas de IRS. No modelo do Anexo F em vigor, as que têm quadro próprio ' +
        'declaram-se na mesma no quadro 4.1, e o contrato identifica-se no 6D, no 6F ou no 6H ({instruções desses ' +
        'quadros do Anexo F|anexoF}):' },
      { info: [
        'As dos contratos do Programa de Arrendamento Acessível ({Decreto-Lei n.º 68/2019, artigo 20.º|dl68a20}) e as dos ' +
          'programas municipais de arrendamento a custos acessíveis ou de alojamento estudantil, depois de a isenção ' +
          'ser reconhecida ({artigo 71.º-A, n.os 3 a 6, do Estatuto dos Benefícios Fiscais|ebf71a}). Identificam-se no ' +
          'quadro 6D. Os contratos do Programa de Arrendamento Acessível que estavam em vigor quando ele deu lugar ' +
          'ao Regime Simplificado de Arrendamento Acessível mantêm os efeitos fiscais ({Decreto-Lei n.º 97/2026, ' +
          'artigo 15.º, n.º 2|dl97a15}).',
        'As dos contratos do Regime Simplificado de Arrendamento Acessível, desde 1 de setembro de 2026, se o ' +
          'contrato cumprir as condições dele, entre elas a renda até ao limite da tipologia no concelho, que a ' +
          '{Portaria n.º 454/2026/1|portaria454} fixou, e se o submeteres ao IHRU até 15 de janeiro do ano seguinte ao da ' +
          'celebração ({Decreto-Lei n.º 97/2026, anexo III, artigos 4.º e 6.º|dl97x3}). O modelo do Anexo F em vigor ainda ' +
          'não tem código para ele no quadro 6D: confirma o quadro nas instruções do modelo do teu ano.',
        'As de um imóvel que passou do alojamento local para arrendamento para habitação permanente, se o ' +
          'alojamento local estava registado e afeto a esse fim até 31 de dezembro de 2022 e o contrato foi ' +
          'celebrado e inscrito no Portal das Finanças até 31 de dezembro de 2024. Estão isentas até às rendas de ' +
          '2029, e o imóvel identifica-se no quadro 6F ({artigo 74.º-A do Estatuto dos Benefícios Fiscais|ebf74a}).',
        'As dos contratos de arrendamento para habitação celebrados antes do Regime do Arrendamento Urbano (o RAU, ' +
          'do {Decreto-Lei n.º 321-B/90|dl321b}) e sujeitos ao regime dos {artigos 35.º|nrau35} ou {36.º do Novo ' +
          'Regime do Arrendamento Urbano|nrau36}, enquanto o contrato durar. Não são todos os contratos antigos: só os que ficaram ' +
          'nesse regime. Identificam-se no quadro 6H ({artigo 46.º-A do Estatuto dos Benefícios Fiscais|ebf46a}).',
      ] },
      // N151 (2026-11-23): os benefícios fiscais caem com dívidas por regularizar (EBF, artigo 14.º)
      { p: 'Os benefícios fiscais — as isenções, a taxa de 10 % das rendas moderadas e os dos quadros 6A a 6C, ' +
        'que vês na parte 3 — só valem num ano se, no fim dele, não tiveres dívidas por regularizar às Finanças nem ' +
        'à Segurança Social: impostos ou contribuições por pagar, sem reclamação, impugnação ou oposição com ' +
        'garantia ({artigo 14.º, n.os 5 a 7, do Estatuto dos Benefícios Fiscais|ebf14}).' },
    ] },
    { grupo: 'Os contratos longos', blocos: [
      { p: 'Num contrato de arrendamento para habitação permanente, a taxa autónoma baixa quanto mais longo for o ' +
        'contrato ({artigo 72.º, n.os 3 a 5|cirs72}):' },
      { info: [
        'De 5 a menos de 10 anos: menos 10 pontos percentuais, e menos 2 por cada renovação com a mesma duração, até ' +
          'mais 10 pontos.',
        'De 10 a menos de 20 anos: menos 15 pontos percentuais.',
        '20 anos ou mais: menos 20 pontos percentuais.',
      ] },
      // N095 (2026-11-23): o regime de 2019 dos contratos de antes de 7 de outubro de 2023, o recálculo na
      // renovação (o exemplo é o do ofício-circulado, ponto 8) e o n.º 24
      { p: 'Estas são as reduções da {Lei n.º 56/2023|lei56}, a partir dos 25 %, para os contratos celebrados ou renovados ' +
        'desde 7 de outubro de 2023. Um contrato celebrado ou renovado de 1 de janeiro de 2019 a 6 de outubro de 2023 ' +
        'mantém as reduções do regime anterior, que contavam a partir dos 28 %, até à renovação seguinte ({Lei ' +
        'n.º 56/2023, artigo 50.º, n.º 7|lei56a50}): 23 % num contrato de 5 a menos de 10 anos, por exemplo. Os de 2 a menos ' +
        'de 5 anos, que no regime novo deixaram de ter redução, mantêm a taxa que tinham, se for mais baixa do que ' +
        '25 %, até ao fim do prazo ou à renovação ({artigo 50.º, n.º 8|lei56a50}). Na primeira renovação desde 7 de outubro de ' +
        '2023, a redução conta-se de novo a partir dos 25 %, como se o contrato tivesse sido feito já no regime ' +
        'novo: um contrato de 5 anos de 2019, renovado em 2024 por mais 5, fica com 13 % (25 %, menos 10 pontos ' +
        'e menos 2 pela renovação) ({Ofício-Circulado n.º 20268, de 12 de março de 2024, pontos 4 e 6 a 8|oc20268}).' },
      { p: 'Num contrato novo com uma destas reduções, se a renda for inferior, em pelo menos 5 pontos percentuais, à ' +
        'do contrato anterior sobre o mesmo imóvel, a taxa desce mais 5 pontos ({artigo 72.º, n.º 24|cirs72}). No Anexo F, ' +
        'indicas as duas rendas no quadro 4.2B ({instruções do quadro 4.2B|anexoF}).' },
      { p: 'A redução não vale para os contratos de arrendamento habitacional feitos desde 1 de janeiro de 2024 cuja ' +
        'renda mensal exceda em 50 % os limites gerais de preço de renda por tipologia e concelho ({artigo 72.º, ' +
        'n.º 23|cirs72}). Até 31 de agosto de 2026 esses limites eram os da {Portaria n.º 176/2019|portaria176}. Desde 1 de ' +
        'setembro de 2026 são os limites máximos de renda do Regime Simplificado de Arrendamento Acessível, que a ' +
        '{Portaria n.º 454/2026/1|portaria454} fixou ({Decreto-Lei n.º 97/2026, artigo 14.º, alínea b)|dl97a14}); até ela ' +
        'entrar em vigor, a 14 de outubro de 2026, valeram ainda os valores da {Portaria n.º 176/2019|portaria176} ' +
        '({Portaria n.º 454/2026/1, artigo 7.º, n.º 3|portaria454a7}). No Anexo F, confirmas isto no quadro 4.2C, para os contratos que declaras no 4.2.' },
      { p: 'Se o contrato acabar antes do prazo por causa tua, senhorio, perdes as reduções desde o início do contrato ' +
        'ou da renovação. No ano em que acabou, declaras isso, para pagares a diferença com juros compensatórios ' +
        '({artigo 72.º, n.º 20|cirs72}).' },
      { p: 'Para teres direito à redução, além de comunicares o contrato na declaração Modelo 2 do Imposto do Selo, ' +
        'indicas no Portal das Finanças, até 15 de fevereiro do ano seguinte, quando começou e quanto dura o ' +
        'contrato, e mais tarde as renovações e o fim dele ({Portaria n.º 110/2019|portaria110}, nas {instruções do ' +
        'Anexo F|anexoF}).' },
    ] },
    { grupo: 'Ou o englobamento', blocos: [
      { p: 'Em vez da taxa autónoma, podes optar por englobar as rendas: juntam-se aos teus outros rendimentos e ' +
        'pagam as taxas gerais do {artigo 68.º|cirs68} ({artigo 72.º, n.º 13|cirs72}; {instruções do quadro 6G do ' +
        'Anexo F|anexoF}).' },
      { p: 'Se escolheres englobar, entram todas as rendas da categoria F desse ano, e não só as de um imóvel ' +
        '({artigo 22.º, n.º 5|cirs22}).' },
    ] },
    { fonte: 'cirs72', texto: 'Fonte principal: artigo 72.º do Código do IRS, Diário da República.' },
  ] },

  { id: 'onde-declarar', titulo: 'Onde declaras', blocos: [
    { p: 'É tudo pela Internet, no Portal das Finanças: a declaração Modelo 3 e os anexos, como o Anexo F, só se ' +
      'entregam por transmissão eletrónica de dados ({Portaria n.º 104/2026/1, artigos 2.º e 3.º|portaria104a2}).' },
    { ir: 'Entregar o IRS no Portal das Finanças', fonte: 'entrega' },
    { p: 'Para entrar, usas o teu NIF e a senha de acesso, ou a Autenticação.gov, com a Chave Móvel Digital ou o ' +
      'Cartão de Cidadão. Se ainda não tens senha, registas-te no Portal e pedes uma ({folheto da AT sobre o acesso ' +
      'ao Portal|senhas}).' },
    { fonte: 'portaria104a2', texto: 'Fonte principal: Portaria n.º 104/2026/1, artigos 2.º e 3.º, Diário da República.' },
  ] },

  { id: 'como-preencher', titulo: 'Como preenches', blocos: [
    { p: 'No Anexo F da declaração Modelo 3, declara:' },
    { cond: [
      'As rendas pelo valor bruto, sem descontar antes os gastos.',
      'Os gastos à parte, cada um no seu campo e no imóvel certo.',
      'Só a parte que te cabe: a da tua quota no imóvel, e só do imóvel, ou da parte dele, que esteve mesmo arrendada.',
      'As obras nas partes comuns no campo de conservação e manutenção, e não como uma simples quota de condomínio, ' +
        'quando a despesa foi mesmo uma obra.',
    ] },
    { grupo: 'Linha a linha', blocos: [
      { p: 'Cada prédio vai numa linha própria, e cada fração em separado, mesmo que sejam do mesmo contrato. Um ' +
        'prédio que não deu rendas no ano não se declara. Em cada linha indicas:' },
      { info: [
        'O número do contrato, que vem da declaração Modelo 2 do Imposto do Selo (ou do registo do contrato no Portal ' +
          'das Finanças, se for anterior a 1 de abril de 2015), e a data de início.',
        // D137 (2026-11-17): de que caderneta, e a reposição das freguesias
        'A identificação matricial: o código da freguesia, de seis caracteres (quatro algarismos e, desde 2025, às vezes duas letras no fim), que está nos documentos de cobrança do ' +
          'IMI, o tipo de prédio (U, urbano, ou R, rústico), o artigo e a fração. Tira-os da caderneta predial ' +
          'atual, que obténs no Portal das Finanças, ou da nota de cobrança do IMI mais recente.',
        'Em outubro de 2025 foram repostas cerca de 300 freguesias que estavam agregadas em uniões de freguesias, ' +
          'e os prédios delas passaram para as freguesias repostas ({Lei n.º 25-A/2025|lei25a}; {AT, reposição das ' +
          'freguesias agregadas|reposicao}). Se o teu prédio era de uma união de freguesias, o código e o artigo podem ter ' +
          'mudado, e a caderneta da compra ou uma nota do IMI antiga trazem os de antes. O IMI de cada ano ' +
          'liquida-se com as matrizes a 31 de dezembro ({artigo 113.º, n.º 1, do Código do IMI|cimi113}): a nota do IMI de ' +
          '2025, que pagas em 2026, já traz os novos.',
        'O titular das rendas: A ou B, a posição de cada um no rosto da declaração (o sujeito passivo A no quadro ' +
          '3, o B no quadro 5A), ou o código do dependente (D1, D2…). O B só existe quando és casado ou unido de ' +
          'facto e optam pela tributação conjunta. Aí a declaração é uma só, com as rendas de todo o agregado, as ' +
          'tuas e as do teu cônjuge também, cada linha ' +
          'com a letra de quem é titular delas ({artigo 59.º, n.º 2, alínea a)|cirs59}; {instruções do quadro 3 e da ' +
          'coluna Titular do Anexo F|anexoF}).',
        'As rendas pelo valor ilíquido (a renda do recibo, antes da retenção, da comissão e de descontos), pagas ' +
          'ou colocadas à tua disposição no ano, e a natureza: 07 no arrendamento habitacional, 06 no não ' +
          'habitacional.',
        'As retenções na fonte de IRS feitas sobre essas rendas.',
        'O NIF português do inquilino ou, se ele não o tiver, o código do país.',
        // N094 (2026-11-23): o IMI e o selo pelo ano em que o prédio deu rendas, sem o período (artigo 41.º, n.º 5)
        'Os gastos suportados e pagos no ano, enquanto o prédio esteve arrendado, cada um na sua coluna: conservação ' +
          'e manutenção, condomínio, IMI, imposto do selo, taxas autárquicas e outros. O IMI e o imposto do selo são ' +
          'a exceção: contam os que pagaste no ano, mesmo com o prédio vazio, desde que ele tenha dado rendas ' +
          'tributadas nesse ano ({artigo 41.º, n.º 5|cirs41}; vê a parte 4).',
        'As obras de conservação e manutenção pagas nos 24 meses antes do arrendamento, nas colunas próprias, só no ' +
          'ano em que o arrendamento começa.',
      ] },
    ] },
    // D112, D113 (2026-11-17): a renda é a do recibo, e o que fica pelo caminho é gasto, se for
    { grupo: 'Quando a renda não chega inteira', blocos: [
      { p: 'Declaras a renda do recibo, antes da retenção, da comissão e de descontos: a que o inquilino paga, ou ' +
        'que fica à tua disposição, e não só o que chega à tua conta ({artigo 8.º, n.º 1|cirs8}; {instruções do ' +
        'quadro 4.1 do Anexo F|anexoF}).' },
      { info: [
        'Se uma imobiliária ou gestora cobra a renda em teu nome e te transfere o resto, declaras a renda inteira, e a ' +
          'comissão dela é um gasto, na coluna de outros, com os documentos que a ligam ao contrato e ao imóvel ' +
          '({artigo 41.º, n.º 1|cirs41}; {informação vinculativa, processo 615/2016|piv615}).',
        'Se o inquilino pagou uma obra e a descontou na renda, declaras a renda inteira. A obra só se deduz se for ' +
          'de conservação ou manutenção e tiveres a fatura em teu nome; uma melhoria não se deduz ({artigo 41.º, ' +
          'n.os 1 e 9|cirs41}).',
      ] },
    ] },
    { grupo: 'A caução', blocos: [
      { p: 'Para a AT, a caução que recebes do inquilino é renda do ano em que a recebes: entra nas rendas desse ano, ' +
        'na linha do contrato ({Ofício-Circulado n.º 20256, de 7 de junho de 2023, ponto 4|oc20256}). E passas recibo de ' +
        'renda eletrónico dela, como das outras rendas ({Portaria n.º 98-A/2015, artigo 5.º, n.º 1|portaria98a5}).' },
      { p: 'Quando a devolves ao inquilino, o que devolves pode ser abatido como gasto no Anexo F do ano em que o ' +
        'devolves (o {mesmo ofício-circulado, ponto 6|oc20256}).' },
    ] },
    { grupo: 'O quadro de cada contrato', blocos: [
      { p: 'No modelo do Anexo F em vigor desde janeiro de 2025, que a {Portaria n.º 104/2026/1|portaria104} manteve:' },
      { info: [
        'Quadro 4.1: os contratos sem redução de taxa pela duração.',
        'Quadro 4.2: os contratos para habitação permanente com essa redução, celebrados ou renovados desde 1 de ' +
          'janeiro de 2019, com o quadro 4.2A preenchido (as datas do contrato e da última renovação). Um contrato ' +
          'celebrado desde 1 de janeiro de 2024 com a renda acima do limite do {artigo 72.º, n.º 23|cirs72}, vai para o 4.1.',
        // D118 (2026-11-17)
        'Quadro 4.3: o direito real de habitação duradoura ({Decreto-Lei n.º 1/2020|dl1}): a prestação mensal que o ' +
          'morador te paga, com a taxa reduzida em 20 pontos, como nos contratos de 20 anos ou mais ({artigo 72.º, ' +
          'n.º 5|cirs72}; {instruções do quadro 4.3|anexoF}).',
        'Quadro 6G: a opção pelo englobamento (campo 06).',
      ] },
      { p: 'Se sair um modelo novo para o ano das tuas rendas, confirma os quadros nas instruções dele.' },
    ] },
    { grupo: 'Os outros quadros', blocos: [
      { p: 'Conforme o teu caso, há outros quadros a preencher ({instruções do Anexo F|anexoF}):' },
      { info: [
        'Quadro 4.4: as rendas que pagas pela tua nova habitação própria e permanente, a mais de 100 km da casa que ' +
          'arrendaste, se esta foi a tua habitação própria e permanente durante pelo menos 12 meses e os dois ' +
          'contratos estão registados no Portal das Finanças. Abatem às rendas brutas de arrendamento habitacional, até ao valor ' +
          'delas ({artigo 41.º, n.º 8|cirs41}; vê a parte 4).',
        'Quadro 5: a sublocação. Se és inquilino de um imóvel e o subarrendas, declaras aqui a renda que recebes e ' +
          'a que pagas ao senhorio, e não no 4.1 nem no 4.2.',
        'Quadros 6D, 6F e 6H: os contratos com rendas isentas, que declaraste no quadro 4.1 (vê «Rendas isentas», ' +
          'na parte 1).',
        // D118 (2026-11-17): os benefícios raros, cada um indicado pelos campos do quadro 4.1
        'Quadros 6A, 6B e 6C: benefícios de linhas que declaraste no quadro 4.1, indicadas pelo campo de cada ' +
          'uma. No 6A, o imóvel reabilitado com a taxa de 5 % (vê «A taxa», na parte 1). No 6B, um prédio ' +
          'arrendado que o município reconheceu como loja com história ({Lei n.º 42/2017|lei42}): as obras de conservação ' +
          'e manutenção dos 24 meses antes do arrendamento contam 110 % ({artigo 59.º-I, n.º 2, do Estatuto dos ' +
          'Benefícios Fiscais|ebf59i}). No 6C, um prédio rústico florestal arrendado a uma entidade ou unidade de gestão ' +
          'florestal reconhecida: as rendas contam 50 %, nos arrendamentos feitos até 31 de dezembro de 2020 e ' +
          'durante 12 anos a contar do ano do contrato, com o artigo em vigor até 31 de dezembro de 2026 ({artigo ' +
          '59.º-G, n.os 11, 14 e 15, do Estatuto dos Benefícios Fiscais|ebf59g}).',
        'Quadro 8: as rendas de anos anteriores que recebeste no ano, e que já estão no valor da linha. Se quiseres ' +
          'usar o {artigo 74.º|cirs74}, indicas de que ano é cada uma: no 8A, se englobares, e o valor reparte-se pelos ' +
          'anos a que respeita ({artigo 74.º, n.º 1|cirs74}); ou no 8B, se em vez disso entregares declarações de ' +
          'substituição desses anos, até ao quinto ano anterior ao do pagamento ({artigo 74.º, n.º 3|cirs74}). O 8B escolhe-se na declaração do ano em que recebeste as rendas, e as ' +
          'declarações de substituição entregam-se até 30 dias depois do fim do prazo dela, ou seja, até 30 de ' +
          'julho do ano em que a entregas ({artigo 74.º, n.os 7 e 8|cirs74}; {artigo 60.º, n.º 2|cirs60}).',
        'Quadro 9: o Adicional ao IMI (AIMI) dos prédios que te deram rendas. Não entra nos gastos da linha, mas abate-se ' +
          'ao imposto, até a um limite: indicas cada prédio, com o valor patrimonial tributário, e os totais da ' +
          'liquidação do AIMI ({artigo 78.º, n.º 1, alínea l), do Código do IRS|cirs78}; {artigo 135.º-I do Código do ' +
          'IMI|cimi135i}).',
        // N155 (2026-11-23): também os do Programa de Apoio ao Arrendamento e dos programas municipais, com isenção
        'Quadro 10: os contratos para habitação permanente que tiveram redução de taxa, e os do Programa de Apoio ao ' +
          'Arrendamento ({Decreto-Lei n.º 68/2019|dl68}) ou de um programa municipal com isenção, que acabaram ou saíram do ' +
          'programa, com a data e o motivo ({instruções do quadro 10|anexoF}).',
      ] },
    ] },
    { grupo: 'Se os gastos passarem as rendas', blocos: [
      { p: 'O resultado negativo das rendas de um ano não se perde: abate ao resultado positivo das rendas dos seis anos ' +
        'seguintes ({artigo 55.º, n.º 1, alínea b)|cirs55}). Perdes esse direito se os prédios desses gastos não derem ' +
        'rendas durante pelo menos 36 meses, seguidos ou não, nos cinco anos seguintes ({artigo 55.º, n.º 8|cirs55}).' },
    ] },
    { grupo: 'Depois de entregares', blocos: [
      { p: 'A AT pode pedir-te os documentos do que declaraste durante os quatro anos seguintes ao ano a que respeitam. ' +
        'Tens 15 dias para os apresentar, ou 25 se explicares que te é difícil obtê-los ({artigo 128.º|cirs128}).' },
    ] },
    { grupo: 'O que mudou em 2025', blocos: [
      { info: [
        'Desde 1 de julho de 2025, não há retenção na fonte sobre as rendas quando o valor de cada retenção seria ' +
          'inferior a 25 € ({artigo 101.º-B, n.º 1, alínea d)|cirs101b}, na redação do {Decreto-Lei n.º 49/2025|dl49}).',
        // N029, N093, N030 (2026-11-23): sem recibo nas rendas de um arrendamento rural (o Modelo 44 delas é uma
        // opção) e nas da categoria B (o documento é o da atividade); e a outra hipótese da dispensa do n.º 2
        'Desde 1 de julho de 2025, a declaração anual das rendas (Modelo 44) entrega-se até ao fim de fevereiro do ' +
          'ano seguinte, e já não até ao fim de janeiro ({artigo 115.º, n.º 5, alínea b)|cirs115}, na mesma redação). Não é ' +
          'uma escolha: o recibo de renda eletrónico de cada renda é obrigatório, salvo nas rendas de um arrendamento ' +
          'rural (agrícola, florestal ou de campanha) e nas que tributas na categoria B, que levam a fatura, a ' +
          'fatura-recibo ou o recibo da tua atividade ({artigo 115.º, n.º 1, alínea a)|cirs115}). E o Modelo 44 é só de quem ' +
          'está dispensado dele e não o passa — quem não tem nem é obrigado a ter caixa postal eletrónica e, no ano ' +
          'anterior, não recebeu mais de duas vezes o IAS em rendas (ou não as recebeu e não conta passar esse ' +
          'valor), ou quem tinha 65 anos ou mais a 31 de dezembro do ano anterior ({Portaria n.º 98-A/2015, artigos ' +
          '5.º e 8.º|portaria98a}). As rendas de um arrendamento rural podes declará-las no Modelo 44, se quiseres; isso não te ' +
          'dispensa dos recibos das outras rendas ({artigo 5.º, n.º 3, alínea a)|portaria98a5}, e {artigo 8.º, n.º 4, ' +
          'da mesma portaria|portaria98a8}).',
        'Desde 1 de agosto de 2025, se não comunicares o contrato à AT no prazo, o inquilino pode comunicá-lo ele. A obrigação ' +
          'continua a ser tua ({artigo 60.º, n.os 1 e 4, do Código do Imposto do Selo|cis60}; {Portaria n.º ' +
          '106/2025/1|portaria106}).',
      ] },
      { p: 'O que não mudou: podes dispensar a retenção se previres receber menos de 15 000 € de rendas no ano, ' +
        'o limite do {artigo 53.º do Código do IVA|civa53}. Para isso, escreves no recibo «Sem retenção, nos termos do n.º 1 do ' +
        'artigo 101.º-B do Código do IRS.» Não o podes fazer se, no ano anterior, recebeste esse valor ou mais ({artigo ' +
        '101.º-B, n.os 1 a 3|cirs101b}).' },
    ] },
    { fonte: 'anexoF', texto: 'Fonte principal: instruções de preenchimento do Anexo F, AT.' },
  ] },

  { id: 'deducoes', titulo: 'As deduções', intro: [
    'Aqui vês o que a lei te deixa abater às rendas, o que não deixa e os documentos que deves guardar de cada imóvel.',
    'Seguimos a redação atual do {artigo 41.º do Código do IRS|cirs41}, publicada pela Autoridade Tributária e Aduaneira ' +
      '(AT), e as informações vinculativas da AT. Quando uma despesa não está claramente coberta pela lei, nem por ' +
      'uma orientação concreta da AT, dizemos-te que é duvidosa, em vez de a darmos como certa.',
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
${linhas.map((t) => `      <li>${marca}<span>${comLigacoes(t)}</span></li>`).join('\n')}
    </ul>`;
}

/* Uma ligação para um sítio oficial (o Diário da República ou a AT), com o
   padrão das ligações para fora do guia: abre noutra aba, sem dar a esta
   página acesso à que abre nem lhe dizer de onde se veio (KAN-164).
   Recebe: url — o endereço; html — o conteúdo da ligação, já escapado;
   classe — a classe da <a>, ou nada. Devolve: o HTML da <a>. */
function ligacaoExterna(url, html, classe) {
  return `<a${classe ? ` class="${classe}"` : ''} href="${esc(url)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
}

/* Um texto do guia em HTML, com as referências em ligação no próprio texto
   (KAN-164: cada artigo, diploma, ofício, informação vinculativa e instrução
   leva à fonte). No texto de GUIA e de DEDUCOES uma referência escreve-se
   {o que se lê|chave}, com a chave da fonte em FONTES; o resto escapa-se.
   Recebe: t — o texto. Devolve: o HTML; falha alto com uma chave que não
   existe ou uma chaveta que sobrou (a referência ficava sem ligação). */
function comLigacoes(t) {
  const html = esc(t).replace(/\{([^{}|]+)\|([A-Za-z0-9]+)\}/g,
    (_, texto, id) => ligacaoExterna(fontePorId(id).url, texto, 'ref'));
  if (/[{}|]/.test(html)) throw new Error('referência do guia mal escrita: ' + t);
  return html;
}

/* As fontes oficiais, todas com o endereço confirmado a abrir.
   Devolve: o HTML da <ul> das fontes. */
function listaDeFontes() {
  return `<ul class="fontes">
${FONTES.map((f) => `      <li>${ligacaoExterna(f.url, esc(f.nome))}</li>`).join('\n')}
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
        <p>${comLigacoes(b.texto)}</p>${b.cond ? '\n        ' + lista('cond', b.cond) : ''}${b.fim ? `\n        <p>${comLigacoes(b.fim)}</p>` : ''}
      </div>
    </div>`;
  if (b.fontes) return listaDeFontes();
  if (b.ir) {
    const f = fontePorId(b.fonte);
    return `<p class="ir">${ligacaoExterna(f.url, `<span>${esc(b.ir)}</span>${icone(SEGUIR, 'seguir')}`, 'btn')}</p>`;
  }
  if (b.fonte != null) return `<p class="fonte">${ligacaoExterna(fontePorId(b.fonte).url, esc(b.texto))}</p>`;
  if (b.p) return `<p>${comLigacoes(b.p)}</p>`;
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
      ${s.intro.map((t) => `<p>${comLigacoes(t)}</p>`).join('\n      ')}
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
        mainEntityOfPage: url, datePublished: GUIA_PUBLICADO, dateModified: GUIA_REVISTO, author: casa,
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
    <p class="sub">Neste guia podes encontrar se tens de declarar as rendas no IRS, como o fazer e algumas despesas que
    podes descontar.</p>
  </div>

  <dl class="ficha">
    <div><dt>Para quem</dt><dd>Para ti, se és residente em Portugal e recebes rendas de imóveis em Portugal, que
    declaras como rendimentos prediais, da categoria F, sem teres escolhido as regras da categoria B. As de um imóvel
    fora de Portugal vão ao Anexo J.</dd></div>
    <div><dt>Verificado a</dt><dd><time datetime="${GUIA_REVISTO}">${dataPorExtenso(GUIA_REVISTO)}</time></dd></div>
  </dl>

  <p class="intro">Começas por ver se tens de declarar, depois onde e como, e no fim o que podes deduzir. Tudo o que
  aqui está vem da lei ou da Autoridade Tributária e Aduaneira (AT), e tens as fontes oficiais no fim.</p>

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
      <p>As informações vinculativas que a AT publica mostram como ela leu casos concretos. Se o teu caso for
      diferente, ou a despesa for fora do comum, não substituem uma informação vinculativa pedida por ti. Se tiveres
      uma despesa importante que não encaixe bem nas listas de cima, o mais seguro é não a deduzir até teres uma
      resposta escrita da AT.</p>
      <p>Se preparas a declaração com o resumo do IRS da Rendorium, lembra-te:</p>
      <p class="aviso-app">${esc(IRS_AVISO_GUIA)}</p>
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
/* as referências no próprio texto (KAN-164): a ligação da casa, no cobalto e sublinhada (a
   frente sobrevive ao escuro forçado do Samsung Internet), com o traço fino para a frase se ler
   de seguida; mais grosso com o rato por cima, no portão do hover */
.ref{text-decoration-thickness:1px;text-underline-offset:2px}

/* a parte 4, as deduções: o título e a introdução sobre o fundo, como a
   cabeça da página, e as cinco secções em cartões mais juntos (24 px) do
   que as partes (48 px), cada uma com o seu h3 numerado (4.1…) */
.parte{margin-top:48px;scroll-margin-top:80px}
.parte-cabeca{display:flex;flex-direction:column;gap:12px}
.parte-cabeca p{max-width:70ch;color:var(--muted)}
.parte .bloco{margin-top:24px}
.bloco > h3{font-size:24px;line-height:1.15;display:flex;align-items:baseline;gap:12px}

/* o botão para o sítio oficial (o Portal das Finanças), o secundário da
   casa, com o chevron. O rótulo é comprido: num telemóvel estreito quebra
   em duas linhas dentro do botão, em vez de o alargar para fora do ecrã
   (o nowrap dos botões da página), e continua com 44 px de altura */
.ir a.btn{gap:8px;padding-right:12px;max-width:100%;white-space:normal;text-align:left;padding-top:8px;padding-bottom:8px}
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
/* o aviso da Declaração (IRS_AVISO_GUIA), à letra, a seguir à nota: separado
   dela por 12 px e no peso dos rótulos, para se ler como a frase da app que é */
.seguranca p + p{margin-top:12px}
.seguranca .aviso-app{font-weight:600}
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
  a.ref:hover{text-decoration-thickness:2px}
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
