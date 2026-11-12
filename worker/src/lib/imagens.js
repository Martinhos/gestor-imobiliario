/* Os corpos com imagens e ficheiros que chegam ao worker: ler até um teto e
   conhecer o tipo pelos próprios bytes. Usam-nos as capturas dos tickets de
   QA (rotas/qa.js), que só aceitam imagens, e os anexos do kanban
   (rotas/kanban.js), que aceitam também os ficheiros de TIPOS_DOS_ANEXOS — e
   vivem aqui, e não numa das duas rotas, porque a do QA também chama a do
   kanban (o cartão de cada ticket): com estas funções lá, as duas
   importavam-se uma à outra (testes/quatro-olhos.test.js não deixa ciclos).
   O scripts/kanban.mjs lê daqui o tipo de cada anexo que descarrega. */

/* Lê o corpo de um pedido até um teto, aos bocados, e desiste logo que o
   passa — um corpo sem Content-Length (ou com um que mente) não chega a
   encher a memória do worker.
   Recebe: request — o pedido; teto — o máximo de bytes.
   Devolve: promessa dos bytes (Uint8Array, vazio sem corpo), ou null quando
   passam do teto. */
export async function lerAte(request, teto) {
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

/* O tipo de uma imagem pelos primeiros bytes (a assinatura), sem confiar no
   que o pedido diz: PNG (89 50 4E 47 0D 0A 1A 0A), JPEG (FF D8 FF) ou WebP
   (RIFF….WEBP).
   Recebe: b — os bytes (Uint8Array).
   Devolve: 'image/png', 'image/jpeg' ou 'image/webp', ou null se não for
   nenhuma delas. */
export function tipoDaImagem(b) {
  const tem = (bs, de) => bs.every((x, i) => b[(de || 0) + i] === x);
  if (b.length >= 8 && tem([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (b.length >= 3 && tem([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (b.length >= 12 && tem([0x52, 0x49, 0x46, 0x46]) && tem([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

// Os documentos do Office de agora, que se reconhecem pela peça principal dentro do ZIP.
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/* Os ficheiros que um cartão do kanban aceita como anexo: uma lista fechada,
   cada tipo reconhecido pelos próprios bytes (tipoDoFicheiro), nunca pelo
   Content-Type nem pela extensão que o browser manda. Um anexo é escrito por
   alguém da equipa e aberto por outros na origem do back office, que tem a
   sessão de equipa: o que o browser pudesse correr como página (HTML, SVG,
   XML) não entra, nem disfarçado de texto. Entram:
   - as imagens de sempre (PNG, JPEG, WebP), as únicas que abrem no sítio;
   - o PDF, pela assinatura %PDF- logo no primeiro byte;
   - o Word, o Excel e o PowerPoint de agora (docx, xlsx, pptx): um ZIP com o
     [Content_Types].xml e a peça principal de um deles, sem macros nem
     controlos ActiveX (CODIGO_NO_OFFICE) — os .doc e .xls antigos (OLE) e os
     docm e xlsm ficam de fora, que é onde as macros vivem;
   - o texto simples e o CSV: UTF-8 válido, sem nulos nem caracteres de
     controlo e sem marcação (MARCACAO); o CSV distingue-se só pelo nome.
   Tudo o que não é imagem desce como ficheiro (attachment), com a extensão
   do tipo (comExtensao). Em cada um: ext — as extensões que o nome pode ter
   (a primeira é a que se acrescenta); nome — o nome por omissão, sem a
   extensão; imagem — abre no sítio. */
export const TIPOS_DOS_ANEXOS = {
  'image/png': { ext: ['png'], nome: 'imagem', imagem: true },
  'image/jpeg': { ext: ['jpg', 'jpeg'], nome: 'imagem', imagem: true },
  'image/webp': { ext: ['webp'], nome: 'imagem', imagem: true },
  'application/pdf': { ext: ['pdf'], nome: 'documento' },
  [DOCX]: { ext: ['docx'], nome: 'documento' },
  [XLSX]: { ext: ['xlsx'], nome: 'documento' },
  [PPTX]: { ext: ['pptx'], nome: 'documento' },
  'text/plain': { ext: ['txt', 'log'], nome: 'texto' },
  'text/csv': { ext: ['csv'], nome: 'texto' },
};

// A frase do 415 de um anexo: o que se aceita.
export const FRASE_DOS_TIPOS = 'Esse ficheiro não entra: aceitam-se imagens (PNG, JPEG, WebP), PDF, documentos Word, Excel e PowerPoint ' +
  '(DOCX, XLSX, PPTX) e texto ou CSV (sem HTML).';

// A peça principal de cada documento do Office, dentro do ZIP.
const PECA_DO_OFFICE = { 'word/document.xml': DOCX, 'xl/workbook.xml': XLSX, 'ppt/presentation.xml': PPTX };
// O que, dentro de um ZIP do Office, é código: as macros (vbaProject.bin) e os controlos ActiveX.
const CODIGO_NO_OFFICE = /(?:^|\/)vbaProject\.bin$|(?:^|\/)activeX\//i;
// O começo de uma etiqueta que um browser corre ou desenha: HTML, SVG, XML e o que eles embebem.
const MARCACAO = /<(?:!doctype|\?xml|html|head|body|script|style|svg|math|iframe|frame|frameset|object|embed|applet|meta|link|base|form|img|template|xsl)\b/i;
// Os caracteres de controlo que um texto não tem: os C0 menos o tab, as mudanças de linha, o form feed e o ESC (as cores de um registo).
const CONTROLO = /[\u0000-\u0008\u000b\u000e-\u001a\u001c-\u001f\u007f]/;

/* Os nomes das entradas de um ZIP, lidos do diretório central (o registo do
   fim diz onde ele começa), sem descomprimir nada. Um ZIP partido, um ZIP64
   ou um diretório que aponte para fora do ficheiro dão null.
   Recebe: b — os bytes (Uint8Array).
   Devolve: a lista dos nomes, ou null quando não é um ZIP que se leia. */
export function nomesNoZip(b) {
  if (b.length < 30 || b[0] !== 0x50 || b[1] !== 0x4b || b[2] !== 0x03 || b[3] !== 0x04) return null;
  const u16 = (o) => b[o] | (b[o + 1] << 8);
  const u32 = (o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000;
  // o registo do fim (PK 05 06): nos últimos 22 bytes, ou antes deles quando o ZIP traz um comentário
  let fim = -1;
  for (let i = b.length - 22, ate = Math.max(0, b.length - 22 - 0xffff); i >= ate; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { fim = i; break; }
  }
  if (fim < 0) return null;
  const total = u16(fim + 10), inicio = u32(fim + 16);
  if (!total || total === 0xffff || inicio + u32(fim + 12) > fim) return null;
  const nomes = [];
  for (let p = inicio, k = 0; k < total; k++) {
    if (p + 46 > fim || u32(p) !== 0x02014b50) return null;
    const n = u16(p + 28);
    if (p + 46 + n > fim) return null;
    nomes.push(String.fromCharCode.apply(null, b.subarray(p + 46, p + 46 + n)));
    p += 46 + n + u16(p + 30) + u16(p + 32);
  }
  return nomes;
}

/* O documento do Office dentro de um ZIP, pela peça principal: um só dos
   três, com o [Content_Types].xml, e sem macros nem ActiveX.
   Recebe: b — os bytes (Uint8Array).
   Devolve: o tipo do Word, do Excel ou do PowerPoint, ou null. */
function tipoDoOffice(b) {
  const nomes = nomesNoZip(b);
  if (!nomes || nomes.indexOf('[Content_Types].xml') < 0 || nomes.some((n) => CODIGO_NO_OFFICE.test(n))) return null;
  const tipos = nomes.map((n) => PECA_DO_OFFICE[n]).filter(Boolean);
  return tipos.length === 1 ? tipos[0] : null;
}

/* O texto que se aceita: UTF-8 válido (com ou sem BOM), sem nulos nem
   caracteres de controlo, que não começa por uma etiqueta nem traz uma
   (MARCACAO) — um HTML, um SVG ou um XML com outro nome não passam por texto.
   Recebe: b — os bytes (Uint8Array).
   Devolve: true quando é texto que se aceita. */
function eTexto(b) {
  let t;
  try { t = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return false; }
  return !CONTROLO.test(t) && !/^\s*</.test(t) && !MARCACAO.test(t);
}

/* O tipo de um anexo do kanban pelos próprios bytes, da lista fechada
   TIPOS_DOS_ANEXOS: uma imagem (tipoDaImagem), um PDF (%PDF- no primeiro
   byte), um documento do Office (tipoDoOffice) ou texto (eTexto). O nome só
   escolhe entre o texto simples e o CSV: nunca faz de um ficheiro outra coisa.
   Recebe: b — os bytes (Uint8Array); nome (opcional) — o nome do ficheiro.
   Devolve: o tipo (uma chave de TIPOS_DOS_ANEXOS), ou null quando não entra. */
export function tipoDoFicheiro(b, nome) {
  if (!b || !b.length) return null;
  const imagem = tipoDaImagem(b);
  if (imagem) return imagem;
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return 'application/pdf';
  const office = tipoDoOffice(b);
  if (office) return office;
  if (!eTexto(b)) return null;
  return /\.csv$/i.test(String(nome || '').trim()) ? 'text/csv' : 'text/plain';
}

/* O nome de um anexo quando não veio nenhum: «imagem.png», «documento.pdf»,
   «texto.txt» (e «anexo.bin» para um tipo que não está na lista).
   Recebe: tipo — uma chave de TIPOS_DOS_ANEXOS, ou null.
   Devolve: o nome. */
export function nomePorOmissao(tipo) {
  const t = TIPOS_DOS_ANEXOS[tipo];
  return t ? t.nome + '.' + t.ext[0] : 'anexo.bin';
}

/* Um nome com a extensão do tipo verdadeiro: fica como está se já acaba numa
   das extensões dele (sem olhar a maiúsculas); senão leva a primeira, e o
   resto encurta para tudo caber no teto. «FINE» desce como «FINE.pdf», e um
   texto chamado «instalar.bat» como «instalar.bat.txt»: nunca com a
   extensão de um programa.
   Recebe: nome — o nome, já limpo; tipo — uma chave de TIPOS_DOS_ANEXOS (com
   outro, ou null, leva .bin); max — o teto, em caracteres.
   Devolve: o nome. */
export function comExtensao(nome, tipo, max) {
  const t = TIPOS_DOS_ANEXOS[tipo], exts = t ? t.ext : ['bin'];
  const s = String(nome || ''), m = /\.([^.]+)$/.exec(s);
  if (m && exts.indexOf(m[1].toLowerCase()) > -1) return s;
  const fim = '.' + exts[0];
  return s.slice(0, Math.max(0, max - fim.length)) + fim;
}

/* O Content-Disposition de uma descarga: attachment, com o nome em ASCII no
   filename (o que não é ASCII, as aspas e a barra invertida passam a _) e o
   nome inteiro em UTF-8 no filename* (RFC 6266), que é o que os browsers de
   agora usam.
   Recebe: nome — o nome do ficheiro, já limpo de controlos e barras.
   Devolve: o valor do cabeçalho. */
export function disposicaoDeDescarga(nome) {
  const s = String(nome || 'anexo');
  const ascii = s.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const utf8 = encodeURIComponent(s).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return 'attachment; filename="' + ascii + '"; filename*=UTF-8\'\'' + utf8;
}
