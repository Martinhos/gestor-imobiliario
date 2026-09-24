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

/* Veste uma resposta dos assets com a identidade de dev, quando é de um dos
   dois caminhos e vem inteira (200). Qualquer outra — um 304, um erro, um
   caminho que não é destes — sai como entrou.
   Recebe: res — a Response dos assets; caminho — o pathname do pedido.
   Devolve: promessa da Response de dev (nova; a original consome-se), ou da
   própria res quando não há nada a reescrever. */
export async function identidadeDeDev(res, caminho) {
  if (CAMINHOS_DE_IDENTIDADE.indexOf(caminho) < 0 || res.status !== 200) return res;
  const texto = await res.text();
  const corpo = caminho === '/' ? paginaDeDev(texto) : manifestoDeDev(texto);
  const out = new Response(corpo, res);
  /* o tamanho, a etiqueta e a codificação eram do corpo antigo: o corpo novo
     vai em claro e a Cloudflare comprime-o à saída como a qualquer outro */
  out.headers.delete('Content-Length');
  out.headers.delete('ETag');
  out.headers.delete('Content-Encoding');
  return out;
}
