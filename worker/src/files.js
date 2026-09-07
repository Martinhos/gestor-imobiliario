// Anexos: o conteúdo vive no R2, os metadados na D1. Quem pode ver um anexo
// é quem pode ver a casa a que ele pertence; enquanto não estiver guardado
// numa casa, só quem o carregou. Para um colaborador, a casa não chega: o
// anexo sabe a que registo pertence (record_kind/record_id) e o cargo tem
// de o poder ver — um CC digitalizado numa ficha de inquilino não sai para
// quem só marca visitas.

import { acessoACasa } from './lib/acesso.js';
import { podeVerKind, temPerm } from './lib/permissoes.js';

const MAX_FILE = 25 * 1024 * 1024;   // o mesmo limite que a app aplica

export const isFileId = (v) => /^[A-Za-z0-9_-]{1,64}$/.test(String(v || ''));

// Percorre um registo à procura dos anexos que ele refere.
// Recebe: data — o registo (objeto; olha para files, photos e loans[].files).
// Devolve: os ids de anexo válidos encontrados (array de strings; vazio sem nenhum).
export function fileIdsIn(data) {
  const out = [];
  const colher = (arr) => {
    if (Array.isArray(arr)) {
      arr.forEach((f) => { if (f && isFileId(f.id)) out.push(f.id); });
    }
  };
  if (!data || typeof data !== 'object') return out;
  colher(data.files);
  colher(data.photos);
  if (Array.isArray(data.loans)) data.loans.forEach((l) => colher(l && l.files));
  return out;
}

// Depois de guardar uma casa ou um registo, os anexos que ele refere passam a
// pertencer-lhe — é isto que os torna visíveis a quem partilha a casa — e
// ficam a saber a que registo pertencem, que é o que os cargos consultam.
// Só se movem anexos que sejam de quem grava, que ainda não estejam em casa
// nenhuma, ou que já estejam nesta: um id que circule não rouba o anexo de
// outra conta para uma casa onde o ladrão o possa ler.
// Recebe: env — o ambiente do worker (D1 em env.DB); houseId — o id da casa;
// data — o registo acabado de gravar, onde se procuram os anexos; kind — o
// kind do registo ('contract', 'tx', ...) ou 'house' para a casa inteira
// (as fotos ficam 'house.photos' e os documentos das hipotecas 'house.loans');
// recordId — o id do registo (a casa: o próprio houseId); userId (opcional) —
// quem grava; sem ele não se aplica o filtro de propriedade.
// Devolve: nada — atualiza house_id/record_kind/record_id dos anexos na D1
// (falhas são engolidas).
export async function linkFiles(env, houseId, data, kind, recordId, userId) {
  if (!houseId || !data || typeof data !== 'object') return;
  const grava = async (ids, rk) => {
    if (!ids.length) return;
    try {
      const ph = ids.map(() => '?').join(',');
      const filtro = userId ? ' AND (owner_id = ? OR house_id IS NULL OR house_id = ?)' : '';
      await env.DB.prepare(
        `UPDATE files SET house_id = ?, record_kind = ?, record_id = ? WHERE id IN (${ph})${filtro}`
      )
        .bind(houseId, rk, String(recordId || houseId), ...ids, ...(userId ? [userId, houseId] : []))
        .run();
    } catch (e) { /* o anexo pode ainda não ter sido carregado */ }
  };
  if (kind === 'house') {
    await grava(fileIdsIn({ photos: data.photos }), 'house.photos');
    await grava(fileIdsIn({ loans: data.loans }), 'house.loans');
    return;
  }
  await grava(fileIdsIn(data), String(kind || ''));
}

// A regra de acesso a um anexo: o dono vê sempre; guardado numa casa, vê
// quem tiver acesso à casa — dono e comproprietário a tudo; um colaborador
// só com file.view, e ao que o cargo cobre (documentos de hipoteca pedem
// loan.view; um anexo de inquilino pede tenant.view); solto e de outra
// pessoa, ninguém.
// Recebe: env — o ambiente do worker; me — o utilizador com sessão (usa me.id);
// row — a linha do anexo na D1 (ou null quando não existe).
// Devolve: promessa de { ver, apagar } — se este utilizador pode ver o anexo
// e se o pode apagar (o dono do anexo, o dono e os comproprietários da casa).
async function acessoAoAnexo(env, me, row) {
  if (!row) return { ver: false, apagar: false };
  if (row.owner_id === me.id) return { ver: true, apagar: true };
  if (!row.house_id) return { ver: false, apagar: false };
  const a = await acessoACasa(env, me.id, row.house_id);
  if (!a.ok) return { ver: false, apagar: false };
  if (a.owner || a.coowner) return { ver: true, apagar: true };
  const perms = a.collab.perms;
  const rk = row.record_kind || '';
  let ver;
  if (rk === 'house.loans') ver = temPerm(perms, 'loan.view');
  else if (rk === 'house.photos' || rk === '') ver = temPerm(perms, 'file.view');
  else ver = temPerm(perms, 'file.view') && podeVerKind(perms, rk);
  return { ver, apagar: false };
}

/* As rotas /api/files/:id. PUT carrega (o corpo para o R2, os metadados
   para a D1, com os limites de tamanho e o id preso ao primeiro dono); GET
   devolve o conteúdo com o tipo e o nome originais; DELETE apaga dos dois
   lados. O GET responde 404 tanto ao que não existe como ao que não se pode
   ver — não se confirma a existência do que é dos outros. Um colaborador
   carrega para uma casa só com file.add, e só apaga o que ele próprio
   carregou (o DELETE do que não pode apagar responde ok sem tocar em nada,
   como já fazia ao que não se vê).
   Recebe: request — o pedido HTTP (Request); env — o ambiente do worker (R2
   em env.FILES, D1 em env.DB); me — o utilizador com sessão; seg — os
   segmentos do caminho (seg[2] é o id do anexo); method — o método HTTP;
   deps — os ajudantes { json, err, now } (canAccessHouse já não é usado:
   o acesso decide-se por acessoACasa).
   Devolve: uma Response — JSON { ok: true } no PUT e no DELETE, o conteúdo
   com o tipo e o nome originais no GET, ou o erro que couber. */
export async function handleFiles(request, env, me, seg, method, deps) {
  const { json, err, now } = deps;
  const id = seg[2];
  if (!isFileId(id)) return err(400, 'Identificador inválido.');

  if (method === 'PUT') {
    const tam = Number(request.headers.get('Content-Length') || 0);
    if (tam > MAX_FILE) return err(413, 'O ficheiro é demasiado grande (máx. 25 MB).');
    const url = new URL(request.url);
    const casa = url.searchParams.get('casa') || null;
    if (casa && !isFileId(casa)) return err(400, 'Identificador inválido.');
    if (casa) {
      const a = await acessoACasa(env, me.id, casa);
      if (!a.ok) return err(403, 'Sem acesso a esta casa.');
      if (a.collab && !temPerm(a.collab.perms, 'file.add')) {
        return err(403, 'Sem permissão para adicionar fotos e documentos neste imóvel.');
      }
    }

    const existe = await env.DB.prepare('SELECT owner_id FROM files WHERE id = ?').bind(id).first();
    if (existe && existe.owner_id !== me.id) return err(409, 'Já existe um anexo com este id.');

    const tipo = String(request.headers.get('X-Ficheiro-Tipo') || 'application/octet-stream').slice(0, 120);
    const nome = decodeURIComponent(String(request.headers.get('X-Ficheiro-Nome') || '')).slice(0, 200);
    const corpo = await request.arrayBuffer();
    if (corpo.byteLength > MAX_FILE) return err(413, 'O ficheiro é demasiado grande (máx. 25 MB).');

    await env.FILES.put(id, corpo, { httpMetadata: { contentType: tipo } });
    await env.DB.prepare(
      `INSERT INTO files (id, owner_id, house_id, name, type, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET house_id = COALESCE(excluded.house_id, files.house_id),
         name = excluded.name, type = excluded.type, size = excluded.size`
    ).bind(id, me.id, casa, nome, tipo, corpo.byteLength, now()).run();
    return json({ ok: true, id });
  }

  const row = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();

  if (method === 'GET') {
    if (!(await acessoAoAnexo(env, me, row)).ver) return err(404, 'Anexo não encontrado.');
    const obj = await env.FILES.get(id);
    if (!obj) return err(404, 'Anexo não encontrado.');
    return new Response(obj.body, {
      headers: {
        'Content-Type': row.type || 'application/octet-stream',
        'Content-Length': String(row.size || 0),
        'Cache-Control': 'private, max-age=86400',
        'Content-Disposition': 'inline; filename="' + encodeURIComponent(row.name || id) + '"',
      },
    });
  }

  if (method === 'DELETE') {
    if (!(await acessoAoAnexo(env, me, row)).apagar) return json({ ok: true });
    await env.FILES.delete(id);
    await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return err(404, 'Rota desconhecida.');
}
