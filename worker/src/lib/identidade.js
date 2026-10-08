/* A identidade da app fora de produção: «Rendorium DEV», com ícones âmbar.
   -----------------------------------------------------------------------
   Os ficheiros de web/ são os mesmos nos dois ambientes — o manifesto diz
   «Rendorium» e a página aponta para os ícones verdes. Instalada a PWA de
   dev.rendorium.com ao lado da de app.rendorium.com, ficavam dois ícones
   iguais com o mesmo nome no ecrã inicial, e ninguém sabia qual era qual.

   Fora de produção (env.ENV_NAME) o worker reescreve, ao passar, o
   /manifest.webmanifest e a página «/»: o nome, o título, o nome debaixo do
   ícone no iPhone e os ícones passam a ser os de dev (web/icon-*-dev.png, do
   scripts/make-icons.js). Em produção não se toca em nada — a resposta dos
   assets sai tal e qual, byte a byte.

   O `id` do manifesto fica «/»: resolve contra a origem, e é isso que faz de
   app.rendorium.com e dev.rendorium.com duas apps distintas para o browser —
   as duas instalam-se ao mesmo tempo. Os scripts em linha da página não
   mudam, por isso os sha256 da CSP (worker/src/index.js) continuam a bater. */

// O nome que a app de dev mostra — no manifesto, no título e no iPhone.
export const NOME_DEV = 'Rendorium DEV';

// Os caminhos que este módulo reescreve; o index.js só chama para estes.
export const CAMINHOS_DE_IDENTIDADE = ['/', '/manifest.webmanifest'];

/* O manifesto com a identidade de dev.
   Recebe: texto — o JSON do manifesto de produção (web/manifest.webmanifest).
   Devolve: o JSON do manifesto de dev (texto): name e short_name com
   NOME_DEV, cada src de ícone com o sufixo -dev antes da extensão; o resto
   igual. Um texto que não seja JSON sai como entrou. */
export function manifestoDeDev(texto) {
  let m;
  try { m = JSON.parse(texto); } catch (e) { return texto; }
  if (!m || typeof m !== 'object') return texto;
  m.name = NOME_DEV;
  m.short_name = NOME_DEV;
  if (Array.isArray(m.icons)) {
    m.icons = m.icons.map((i) => Object.assign({}, i, { src: comSufixoDev(i.src) }));
  }
  return JSON.stringify(m, null, 2) + '\n';
}

/* A página com a identidade de dev: o <title>, o apple-mobile-web-app-title
   e os dois ícones do <head>. Só o <head> declarativo muda — nenhum <script>.
   Recebe: html — o web/index.html tal como os assets o servem.
   Devolve: o HTML de dev (texto). */
export function paginaDeDev(html) {
  return html
    .replace(/<title>[^<]*<\/title>/, '<title>' + NOME_DEV + '</title>')
    .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/, '$1' + NOME_DEV + '$2')
    .replace(/(<link rel="icon" href=")([^"]+)(")/, (_, a, src, b) => a + comSufixoDev(src) + b)
    .replace(/(<link rel="apple-touch-icon"[^>]*href=")([^"]+)(")/, (_, a, src, b) => a + comSufixoDev(src) + b);
}

/* Um caminho de ícone com o sufixo -dev antes da extensão: icon-192.png →
   icon-192-dev.png. Um caminho que já o tenha, ou sem extensão, sai igual.
   Recebe: src — o caminho (texto).
   Devolve: o caminho de dev (texto). */
function comSufixoDev(src) {
  if (typeof src !== 'string' || /-dev\.[a-z0-9]+$/i.test(src)) return src;
  return src.replace(/\.([a-z0-9]+)$/i, '-dev.$1');
}

/* Serve um pedido pelos assets, vestido com a identidade de dev quando é de
   um dos dois caminhos. Qualquer outro caminho, e qualquer resposta que não
   venha inteira (um erro, um 404), sai dos assets como entrou.

   O pedido vai aos assets SEM as condições (If-None-Match, If-Modified-Since).
   Os ficheiros de web/ são os de produção, e a etiqueta que os assets lhes
   põem também: um browser que tivesse o manifesto em cache de antes desta
   reescrita — ou o de produção, que é o mesmo ficheiro — trazia essa etiqueta,
   os assets respondiam 304 «não mudou», e não havia corpo nenhum para
   reescrever. A PWA de dev instalava-se «Rendorium», com os ícones verdes, e
   nunca saía disso, porque o ficheiro do manifesto não muda de uma publicação
   para a outra. Foi o que aconteceu. Agora a resposta de dev leva a sua
   própria etiqueta — a do ficheiro, com «-dev» — e o 304 dá-se aqui, contra
   essa: quem já tem o de dev continua a revalidar de graça.
   Recebe: assets — o binding ASSETS (tem fetch); request — o pedido tal como
   chegou ao worker.
   Devolve: promessa da Response: a de dev (200 com o corpo reescrito, ou 304
   quando o browser já o tem), ou a dos assets tal e qual. */
export async function identidadeDeDev(assets, request) {
  const caminho = new URL(request.url).pathname;
  if (CAMINHOS_DE_IDENTIDADE.indexOf(caminho) < 0) return assets.fetch(request);
  const cabecalhos = new Headers(request.headers);
  cabecalhos.delete('If-None-Match');
  cabecalhos.delete('If-Modified-Since');
  const res = await assets.fetch(new Request(request, { headers: cabecalhos }));
  if (res.status !== 200) return res;
  const etiqueta = etiquetaDeDev(res.headers.get('ETag'));
  if (etiqueta && trazEtiqueta(request.headers.get('If-None-Match'), etiqueta)) {
    const h = new Headers({ ETag: etiqueta });
    const cc = res.headers.get('Cache-Control');
    if (cc) h.set('Cache-Control', cc);
    return new Response(null, { status: 304, headers: h });
  }
  const texto = await res.text();
  const corpo = caminho === '/' ? paginaDeDev(texto) : manifestoDeDev(texto);
  const out = new Response(corpo, res);
  /* o tamanho, a etiqueta e a codificação eram do corpo antigo: o corpo novo
     vai em claro e a Cloudflare comprime-o à saída como a qualquer outro */
  out.headers.delete('Content-Length');
  out.headers.delete('Content-Encoding');
  if (etiqueta) out.headers.set('ETag', etiqueta); else out.headers.delete('ETag');
  return out;
}

/* A etiqueta da resposta de dev: a do ficheiro nos assets, com «-dev» dentro
   das aspas. Distinta da de produção, para o browser nunca confundir os dois
   corpos; derivada dela, para mudar quando o ficheiro mudar.
   Recebe: original — o ETag dos assets (texto), ou null.
   Devolve: o ETag de dev (texto), ou null quando não havia nenhum. */
export function etiquetaDeDev(original) {
  if (typeof original !== 'string' || !original) return null;
  const m = original.match(/^(W\/)?"(.*)"$/);
  return m ? (m[1] || '') + '"' + m[2] + '-dev"' : original + '-dev';
}

/* Se um If-None-Match traz uma dada etiqueta. A lista vem separada por
   vírgulas, e compara-se sem o W/ dos dois lados (RFC 9110, comparação fraca:
   a de dev é sempre do mesmo corpo). Um «*» conta como sim.
   Recebe: ifNoneMatch — o cabeçalho (texto), ou null; etiqueta — o ETag a procurar.
   Devolve: true quando a etiqueta lá está. */
export function trazEtiqueta(ifNoneMatch, etiqueta) {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === '*') return true;
  const semW = (e) => e.trim().replace(/^W\//, '');
  return ifNoneMatch.split(',').some((e) => semW(e) === semW(etiqueta));
}
