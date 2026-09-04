// Anexos: o conteudo vive no R2, o acesso segue a casa.
import { handleFiles } from '../files.js';

// Rota dos anexos (/api/files/:id): entrega tudo ao handleFiles, que fala com
// o R2 e verifica o acesso pela casa a que o ficheiro pertence.
export async function rotasAnexos(c) {
  const { env, request, ctx, path, method, seg, me, json, err, body, now, rateLimit, canAccessHouse, participantsOf, preserveOwnership, connectionForUser, badId, cleanData, tooBig, clientIp, TERMS_VERSION, purgeAccount } = c;

  // ---- Anexos ------------------------------------------------------------

  if (seg[1] === 'files' && seg.length === 3) {
    return handleFiles(request, env, me, seg, method, { json, err, canAccessHouse, now });
  }
}
