// A leitura da FINE (ou do documento complementar do contrato) para
// pré-preencher a hipoteca: POST /api/creditos/fine, com os bytes do PDF no
// corpo. Só com sessão; em produção como no dev, com o limite por conta.
//
// O PDF passa a texto no toMarkdown do Workers AI (de graça nos PDF), o texto
// vai a um modelo sem ferramentas que devolve um JSON de esquema fechado, e o
// lib/fine.js:validar decide o que chega ao cliente. Nada do documento se
// guarda: nem os bytes, nem o texto, nem a resposta do modelo vão para a base,
// para a consola ou para um relato de erro — por isso nenhum catch daqui lê a
// mensagem do erro, e nenhum erro sai daqui para o catch geral do index.js
// (que relata e.message).
import { json, err } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import { MODELO, MIN_TEXTO, textoUtil, pedidoAoModelo, respostaDoModelo, comOTexto, validar } from '../lib/fine.js';

// O caminho da rota.
const CAMINHO = '/api/creditos/fine';

// O PDF até 5 MB: uma FINE tem umas dez páginas de texto, muito menos do que isto.
export const MAX_PDF = 5 * 1024 * 1024;

// Leituras por conta e por dia (a decisão do Martinho: 5).
export const LEITURAS_POR_DIA = 5;

/* O teto de leituras por dia para a conta Cloudflare inteira. O plano
   gratuito do Workers AI são 10 000 neurons por dia para tudo; ficamos a 80%
   (8 000), e o custo de uma leitura é o MEDIDO (o `usage.neurons` que o
   modelo devolve, .unlazy/fine-ia/medir-1.1.mjs) com o granite-4.0-h-micro:
     · as FINE de prova (≈1 300 caracteres de texto), com a lista dos
       produtos facultativos no esquema e no prompt (2026-11-02,
       .unlazy/fine-produtos/medir-a.mjs): 4,4 a 5,9 neurons cada (≈1 700–1 820
       tokens de entrada, ≈180–430 de saída); o prompt e o esquema passaram
       de ≈1 350 para ≈1 670 tokens com a base e a contratada (2026-11-04,
       .unlazy/fine-mista-contratada), e o TETO_TEXTO desceu de 20 000 para
       19 000 caracteres para a conta continuar a caber;
     · o pior caso, com o texto cheio (TETO_TEXTO, 19 000 caracteres ≈ 7 380
       tokens de entrada com o prompt) e a resposta no teto
       (MAX_TOKENS_RESPOSTA, 600 tokens):
       7 380 × 1 542 / 1 000 000 + 600 × 10 158 / 1 000 000 ≈ 11,4 + 6,1 = 17,5 neurons;
     · 8 000 / 17,5 ≈ 457 leituras. Arredonda-se para baixo, 450 (eram 500
       com a resposta a 400 tokens, antes da lista dos produtos).
   O toMarkdown não gasta neurons nos PDF (só nas imagens). Muda o modelo
   (lib/fine.js:MODELO), mede-se de novo e refaz-se esta conta. */
export const TETO_GLOBAL = 450;

// A janela dos dois limites: um dia, a contar da primeira leitura.
const DIA = 86400;

// Quanto se espera pelo toMarkdown e pelo modelo, cada um, antes do 503.
const PRAZO_IA_MS = 30000;

/* A resposta de quando o Workers AI não está (sem a ligação), falha ou não
   responde a tempo. Sem pormenores: o erro de lá pode trazer o texto.
   Recebe: nada.
   Devolve: a Response 503. */
function indisponivel() {
  return err(503, 'Não deu para ler o documento agora. Tenta daqui a pouco, ou preenche à mão.');
}

/* POST /api/creditos/fine, já com sessão: as recusas pela ordem do contrato
   (tamanho, PDF, limite da conta, teto global, Workers AI, texto, campos) e,
   passadas todas, os campos lidos.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   method, path e o utilizador em c.me).
   Devolve: a Response — 200 {campos, ignorados, produtos?, prestacaoComProdutos?}; 413, 415,
   429, 503 ou 422 com a frase do contrato — ou nada (undefined) quando o
   pedido não é desta rota. */
export async function rotasFine(c) {
  const { env, request, method, me } = c;
  if (c.path !== CAMINHO) return;
  if (method !== 'POST') return;

  const grande = () => err(413, 'O PDF é grande demais para ler (máx. 5 MB).');
  if (Number(request.headers.get('Content-Length') || 0) > MAX_PDF) return grande();
  const bytes = await lerAte(request, MAX_PDF);
  if (!bytes) return grande();
  if (!comecaPorPdf(bytes)) return err(415, 'Escolhe um PDF.');

  /* no dev (ENV_NAME "dev", o dev.rendorium.com) não há limite por conta: é
     onde se testa, a decisão do Martinho (2026-11-02). Fica no percurso local
     e na produção, quando se promover; o teto global fica em todo o lado,
     porque a quota do Workers AI é da conta Cloudflare inteira */
  if (env.ENV_NAME !== 'dev' && !(await rateLimit(env, 'fine:' + me.id, LEITURAS_POR_DIA, DIA))) {
    return err(429, 'Já leste 5 documentos hoje. Amanhã há mais — até lá, preenche à mão.');
  }
  if (!(await rateLimit(env, 'fineg:', TETO_GLOBAL, DIA))) {
    return err(429, 'Hoje já não dá para ler mais documentos. Preenche à mão, ou tenta amanhã.');
  }

  const ai = env.AI;
  if (!ai || typeof ai.toMarkdown !== 'function' || typeof ai.run !== 'function') return indisponivel();

  let texto;
  try {
    const conv = await comPrazo(ai.toMarkdown(
      { name: 'documento.pdf', blob: new Blob([bytes], { type: 'application/pdf' }) },
      { conversionOptions: { pdf: { metadata: false } } }));
    const um = Array.isArray(conv) ? conv[0] : conv;
    if (!um || typeof um !== 'object' || um.format === 'error' || typeof um.data !== 'string') return indisponivel();
    texto = textoUtil(um.data);
  } catch (e) {
    return indisponivel();   // a mensagem do erro não se lê: pode trazer o texto
  }
  if (texto.replace(/\s+/g, '').length < MIN_TEXTO) {
    return err(422, 'Este PDF não tem texto (parece uma digitalização). Preenche à mão.');
  }

  let bruto;
  try {
    bruto = respostaDoModelo(await comPrazo(ai.run(MODELO, pedidoAoModelo(texto))));
  } catch (e) {
    return indisponivel();   // idem: nem a mensagem, nem a resposta
  }
  if (!bruto) return indisponivel();   // o modelo não devolveu JSON nenhum

  // se é um crédito, di-lo o modelo: sem nada aceite do que ele leu, as
  // frases fixas sozinhas não fazem uma hipoteca
  if (!Object.keys(validar(bruto).campos).length) return err(422, 'Este documento não tem os valores de um crédito.');
  // o indexante, as taxas, as prestações e as comissões que as frases fixas
  // da ficha dizem passam por cima do modelo (lib/fine.js:lidoDoTexto)
  const { campos, ignorados, produtos, prestacaoComProdutos } = validar(comOTexto(bruto, texto));
  return json(resposta(campos, ignorados, produtos, prestacaoComProdutos));
}

/* O corpo do 200: os produtos facultativos e a prestação com eles só vão
   quando o documento os tem.
   Recebe: campos, ignorados, produtos, prestacaoComProdutos — o que o
   validar devolveu.
   Devolve: { campos, ignorados, produtos?, prestacaoComProdutos? }. */
function resposta(campos, ignorados, produtos, prestacaoComProdutos) {
  const r = { campos, ignorados };
  if (produtos.length) r.produtos = produtos;
  if (prestacaoComProdutos != null) r.prestacaoComProdutos = prestacaoComProdutos;
  return r;
}

/* Os bytes começam pela assinatura de um PDF («%PDF-»)? O Content-Type não
   conta: quem o escreve é o cliente.
   Recebe: b — os bytes (Uint8Array).
   Devolve: true quando é um PDF pelo início. */
function comecaPorPdf(b) {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d];   // %PDF-
  return b.byteLength >= sig.length && sig.every((x, i) => b[i] === x);
}

/* Uma promessa com prazo: o que ela der, ou um erro passado o PRAZO_IA_MS
   (um Workers AI pendurado não segura o pedido).
   Recebe: p — a promessa.
   Devolve: promessa do mesmo valor; rejeita no prazo. */
async function comPrazo(p) {
  let relogio;
  try {
    return await Promise.race([
      p,
      new Promise((_, falha) => { relogio = setTimeout(() => falha(new Error('prazo')), PRAZO_IA_MS); }),
    ]);
  } finally {
    clearTimeout(relogio);
  }
}

/* Lê o corpo de um pedido até um teto, aos bocados, e desiste logo que o
   passa — um corpo sem Content-Length (ou com um que mente) não chega a
   encher a memória do worker (a mesma leitura do rotas/qa.js).
   Recebe: request — o pedido; teto — o máximo de bytes.
   Devolve: promessa dos bytes (Uint8Array, vazio sem corpo), ou null quando
   passam do teto. */
async function lerAte(request, teto) {
  if (!request.body) return new Uint8Array(0);
  const leitor = request.body.getReader();
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > teto) {
      try { await leitor.cancel(); } catch (e) { /* já fechado */ }
      return null;
    }
    partes.push(value);
  }
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of partes) { out.set(p, i); i += p.byteLength; }
  return out;
}
