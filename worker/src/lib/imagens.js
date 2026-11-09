/* Os corpos com imagens que chegam ao worker: ler até um teto e conhecer o
   tipo pelos próprios bytes. Usam-nos as capturas dos tickets de QA
   (rotas/qa.js) e os anexos do kanban (rotas/kanban.js) — e vivem aqui, e
   não numa das duas rotas, porque a do QA também chama a do kanban (o
   cartão de cada ticket): com estas funções lá, as duas importavam-se uma à
   outra (testes/quatro-olhos.test.js não deixa ciclos). */

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
