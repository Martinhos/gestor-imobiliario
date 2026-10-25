// Anexos: o conteudo vive no R2, o acesso segue a casa.
import { handleFiles, handleMiniatura, handlePrender } from '../files.js';

// Rota dos anexos (/api/files/:id): entrega tudo ao handleFiles, que fala com
// o R2 e verifica o acesso pela casa a que o ficheiro pertence; a miniatura
// de uma foto (/api/files/:id/miniatura) ao handleMiniatura, e o prender a
// um registo de um anexo que subiu depois dele (POST /api/files/:id/prender)
// ao handlePrender.
// Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
// seg, method e o utilizador em c.me).
// Devolve: a Response do handleFiles, handleMiniatura ou handlePrender; nada (undefined)
// noutros caminhos, para o encaminhador tentar a rota seguinte.
export async function rotasAnexos(c) {
  const { env, request, method, seg, me } = c;

  // ---- Anexos ------------------------------------------------------------

  if (seg[1] === 'files' && seg.length === 3) {
    return handleFiles(request, env, me, seg, method);
  }
  if (seg[1] === 'files' && seg.length === 4 && seg[3] === 'miniatura') {
    return handleMiniatura(request, env, me, seg[2], method);
  }
  if (seg[1] === 'files' && seg.length === 4 && seg[3] === 'prender' && method === 'POST') {
    return handlePrender(request, env, me, seg[2]);
  }
}
