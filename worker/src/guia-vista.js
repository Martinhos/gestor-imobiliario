/* O guia «Declarar as rendas», em público.
   ---------------------------------------
   Um senhorio que pesquisa o que pode abater às rendas no IRS chega aqui: o
   que a lei deixa deduzir, o que não deixa, o que pede cuidado, os papéis a
   guardar e onde se declara. É informação, não uma função da app — a montra
   continua a não prometer a Declaração, que só existe em dev
   (web/app/servicos.js, soDev). O texto é o que o Martinho verificou a
   2026-11-08 contra o artigo 41.º do Código do IRS e as informações
   vinculativas da AT, escrito por tu, como o resto da casa. Nenhuma regra
   fiscal se acrescenta aqui sem passar por ele.

   A página é da família dos documentos legais (legal-vista.js): o cabeçalho
   de vidro, a leitura num cartão a 820 px, as duas letras auto-alojadas. Não
   leva JavaScript nenhum: o conteúdo vive como dados (GUIA) e o HTML sai
   deles no servidor. O que se pode deduzir leva um visto, o que não se pode
   leva uma cruz — formas diferentes, e não só cores, porque o Samsung
   Internet escurece à força e pode trocar a cor de fundo. */

import { CSP_ESTRITA } from './lib/http.js';

const APP = 'https://app.rendorium.com';
// o endereço do guia, o mesmo em todos os hosts (index.js) e no rodapé da montra
export const CAMINHO_GUIA = '/guias/declarar-rendas';

// o que os motores de busca e as redes mostram (≤ 60 e ≤ 160 caracteres)
const TITULO = 'Despesas dedutíveis nas rendas: o guia do IRS — Rendorium';
const DESCRICAO = 'O que o senhorio pode e não pode deduzir às rendas no IRS (categoria F, artigo 41.º): ' +
  'IMI, condomínio, obras, seguros e os documentos a guardar.';

// os ícones de traço da casa (grelha de 24, traço 1.8), como os da montra
const VISTO = 'M5 12.5l4.5 4.5L19 7';
const CRUZ = 'M6.5 6.5l11 11M17.5 6.5l-11 11';
const AVISO = 'M12 8v5M12 16.5v.5M10.3 3.8L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z';
const ESCUDO = 'M12 3l7 3v5.5c0 4.3-2.9 8-7 9.5-4.1-1.5-7-5.2-7-9.5V6z';

/* As fontes oficiais, pela ordem do guia. `url` só quando o endereço oficial
   se confirmou a abrir (AT, Diário da República), verificados a 2026-11-08;
   sem ele, a fonte fica como texto — uma ligação errada num guia fiscal é
   pior do que nenhuma. */
const FONTES = [
  { nome: 'AT, Código do IRS, artigo 41.º, redação vigente', url: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs41.aspx' },
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
   (condições, que se cumprem todas), `doc` (papéis a guardar), `grupo` (um
   subtítulo com os seus blocos) e `nota` (uma caixa âmbar). */
const GUIA = [
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
    { fonte: 0, texto: 'Fonte principal: artigo 41.º do Código do IRS, AT.' },
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

  { id: 'onde-declarar', titulo: 'Onde declarar', blocos: [
    { p: 'No Anexo F da declaração Modelo 3, declara:' },
    { cond: [
      'As rendas pelo valor bruto, sem retirar antes os encargos.',
      'Os gastos em campos separados, associados ao imóvel correto.',
      'Apenas o montante correspondente à tua quota de propriedade e ao imóvel ou parte efetivamente arrendada.',
      'As obras em partes comuns no campo de conservação e manutenção, e não como simples quota de condomínio, quando ' +
        'essa for a natureza efetiva da despesa.',
    ] },
  ] },

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
   página não vê o visto nem a cruz.
   Recebe: tipo — 'sim', 'nao', 'cond' ou 'doc'; linhas — os textos.
   Devolve: o HTML da <ul>. */
function lista(tipo, linhas) {
  const marca = {
    sim: icone(VISTO, 'sim') + '<span class="so-leitor">Podes deduzir: </span>',
    nao: icone(CRUZ, 'nao') + '<span class="so-leitor">Não podes deduzir: </span>',
    doc: icone(VISTO, 'doc'),
    cond: '<span class="ponto" aria-hidden="true"></span>',
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

/* Um bloco do guia em HTML (ver o formato em GUIA).
   Recebe: b — o bloco. Devolve: o HTML dele. */
function bloco(b) {
  if (b.grupo) return `<div class="grupo">
    <h3>${esc(b.grupo)}</h3>
    ${b.blocos.map(bloco).join('\n    ')}
    </div>`;
  if (b.nota) return `<div class="nota" role="note">
      ${icone(AVISO, 'aviso')}
      <div class="nota-corpo">
        <p class="nota-tit">${esc(b.nota)}</p>
        <p>${esc(b.texto)}</p>${b.cond ? '\n        ' + lista('cond', b.cond) : ''}${b.fim ? `\n        <p>${esc(b.fim)}</p>` : ''}
      </div>
    </div>`;
  if (b.fontes) return listaDeFontes();
  if (b.fonte != null) {
    const f = FONTES[b.fonte];
    return `<p class="fonte">${f.url ? `<a href="${esc(f.url)}" rel="noopener">${esc(b.texto)}</a>` : esc(b.texto)}</p>`;
  }
  if (b.p) return `<p>${esc(b.p)}</p>`;
  for (const tipo of ['sim', 'nao', 'cond', 'doc']) if (b[tipo]) return lista(tipo, b[tipo]);
  throw new Error('bloco do guia sem tipo');
}

/* As secções e o índice, para os testes conferirem o que a página mostra.
   Devolve: [{id, titulo}] pela ordem do guia. */
export function seccoesDoGuia() {
  return GUIA.map((s) => ({ id: s.id, titulo: s.titulo }));
}

/* A página do guia.

   Fora do domínio raiz é uma pré-visualização, como os documentos legais:
   leva `noindex`, não declara canonical, e o «início» aponta para /montra —
   ali a raiz é a app.
   Recebe: op — {raiz: true} quando está a ser servido em rendorium.com.
   Devolve: uma Response HTML. */
export function paginaGuia(op) {
  const raiz = !!(op && op.raiz);
  const inicio = raiz ? '/' : '/montra';
  const cabecaRaiz = raiz
    ? `<meta name="robots" content="index,follow">
<link rel="canonical" href="https://rendorium.com${CAMINHO_GUIA}">
<meta property="og:type" content="article">
<meta property="og:title" content="Declarar as rendas: o que podes deduzir">
<meta property="og:description" content="${esc(DESCRICAO)}">
<meta property="og:url" content="https://rendorium.com${CAMINHO_GUIA}">
<meta property="og:locale" content="pt_PT">
<meta name="twitter:card" content="summary">`
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
    <a class="btn fantasma entrar" href="${APP}">Entrar</a>
    <a class="btn primary" href="${APP}/?criar=1">Criar conta</a>
  </header>
</div>
<main class="wrap" id="conteudo">
  <div class="cabeca">
    <p class="chapeu">Guia · IRS do senhorio</p>
    <h1>Declarar as rendas: o que podes deduzir</h1>
    <p class="sub">Os encargos que a lei deixa abater às rendas, os que não deixa, e os documentos que tens de guardar
    para cada imóvel.</p>
  </div>

  <dl class="ficha">
    <div><dt>Para quem</dt><dd>Pessoa singular, residente em Portugal, com rendas declaradas como rendimentos prediais
    da categoria F, sem opção pela tributação segundo as regras da categoria B.</dd></div>
    <div><dt>Verificado a</dt><dd>8 de novembro de 2026</dd></div>
  </dl>

  <p class="intro">Este guia segue a redação vigente do artigo 41.º do Código do IRS publicada pela Autoridade
  Tributária e Aduaneira (AT), complementada por informações vinculativas da AT. Quando uma despesa não está
  claramente coberta pela lei ou por orientação administrativa específica, fica assinalada como duvidosa, em vez de
  aparecer como seguramente dedutível.</p>

  <nav class="indice" aria-label="Neste guia">
    <p class="indice-tit">Neste guia</p>
    <ol>
${GUIA.map((s) => `      <li><a href="#${s.id}">${esc(s.titulo)}</a></li>`).join('\n')}
      <li><a href="#seguranca">A nota de segurança</a></li>
    </ol>
  </nav>

${GUIA.map((s, i) => `  <section class="bloco" id="${s.id}" aria-labelledby="t-${s.id}">
    <h2 id="t-${s.id}"><span class="num" aria-hidden="true">${i + 1}</span>${esc(s.titulo)}</h2>
    ${s.blocos.map(bloco).join('\n    ')}
  </section>`).join('\n\n')}

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

  <section class="fecho" aria-labelledby="t-fecho">
    <div class="fecho-texto">
      <h2 id="t-fecho">As rendas e as despesas, imóvel a imóvel</h2>
      <p>A Rendorium regista cada renda e cada despesa no imóvel a que pertence, e lembra-te de cada pagamento.
      Grátis, sem planos.</p>
    </div>
    <div class="fecho-botoes">
      <a class="btn claro" href="${APP}/?criar=1">Criar conta grátis</a>
      <a class="btn contorno" href="${inicio}">Conhecer a Rendorium</a>
    </div>
  </section>
</main>
<footer class="wrap rodape">
  <span class="rodape-marca"><span class="mark" aria-hidden="true"></span><span>© ${new Date().getFullYear()} Rendorium</span></span>
  <a href="${inicio}">Início</a>
  <a href="/termos">Termos e Condições</a>
  <a href="/privacidade">Política de Privacidade</a>
</footer>
</body></html>`;
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
h1,h2,h3{font-family:'Bricolage Grotesque','Geist',system-ui,sans-serif;font-weight:650;letter-spacing:-.02em;
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

/* ------------------------------------------------------------ a cabeça */
.cabeca{display:flex;flex-direction:column;gap:12px;padding-top:48px;max-width:680px}
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

/* o índice: as secções numeradas, com os alvos de 44 px de um dedo */
.indice{margin-top:32px;padding:16px 24px;border-radius:16px;border:1px solid var(--line);background:var(--card)}
.indice-tit{font-weight:600;font-size:14px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.indice ol{margin:8px 0 0;padding-left:24px;columns:2 240px;column-gap:32px}
.indice li{break-inside:avoid}
.indice a{display:inline-flex;align-items:center;min-height:44px;font-weight:500;text-decoration:none}

/* ------------------------------------------------------------ as secções */
.bloco{margin-top:32px;padding:clamp(24px,4vw,40px);border-radius:16px;background:var(--card);
  border:1px solid var(--line);display:flex;flex-direction:column;gap:16px;
  /* a âncora do índice pousa abaixo do cabeçalho pegajoso (64 px) */
  scroll-margin-top:80px}
.bloco > p,.grupo > p{max-width:70ch}
h2{font-size:clamp(24px,3.6vw,30px);line-height:1.15;display:flex;align-items:baseline;gap:12px}
.num{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:32px;height:32px;
  border-radius:999px;background:var(--accent-soft);color:var(--accent-text);
  font-family:'Geist',system-ui,sans-serif;font-size:16px;font-weight:600;letter-spacing:0;
  font-variant-numeric:tabular-nums;align-self:center}
.grupo{display:flex;flex-direction:column;gap:12px;padding-top:16px;border-top:1px solid var(--line)}
.bloco > h2 + .grupo{border-top:0;padding-top:0}
h3{font-size:20px;line-height:1.25}
.fonte{font-size:14px;color:var(--muted)}

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

/* o fecho: o bloco cobalto da montra, em ponto pequeno */
.fecho{margin-top:48px;display:flex;flex-wrap:wrap;align-items:center;gap:24px;padding:clamp(24px,5vw,48px);
  border-radius:20px;background:var(--fecho-fundo);color:var(--fecho-tinta)}
.fecho-texto{flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:8px}
.fecho h2{font-size:clamp(24px,3.6vw,30px)}
.fecho p{color:var(--fecho-sub)}
.fecho-botoes{display:flex;flex-wrap:wrap;gap:12px}
.fecho a.btn.claro{background:var(--fecho-botao);border-color:var(--fecho-botao);color:var(--fecho-botao-tinta)}
.fecho a.btn.contorno{background:transparent;border-color:var(--fecho-sub);color:var(--fecho-tinta)}
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
  .fecho a.btn.contorno:hover{background:color-mix(in srgb,var(--fecho-tinta) 12%,transparent)}
  .indice a:hover,.rodape a:hover{text-decoration:underline}
}

/* ------------------------------------------------------------ telemóvel */
@media(max-width:619px){
  .rodape-marca{flex-basis:100%}
  .seguranca{flex-direction:column;gap:12px}
}
@media(max-width:480px){
  .cabeca{padding-top:32px}
  .ficha,.indice{padding:16px}
  .nota{padding:16px}
  .fecho-botoes,.fecho-botoes a.btn{flex:1 1 100%}
}
/* num ecrã muito estreito não cabem dois botões ao lado da marca */
@media(max-width:359px){a.btn.entrar{display:none}}

@media(prefers-reduced-motion:reduce){a.btn:active{transform:none}}
/* quem pediu menos transparência recebe o cabeçalho sólido, e quem pediu
   mais contraste recebe contornos e texto secundário que se veem */
@media(prefers-reduced-transparency:reduce){
  .faixa-topo{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}}
@media(prefers-contrast:more){:root{--line:#8A93A5;--line2:#6B7385;--muted:#384152}}
@media(prefers-contrast:more) and (prefers-color-scheme:dark){:root{--line:#56627D;--line2:#6E7A96;--muted:#C9D0DD}}
`;
