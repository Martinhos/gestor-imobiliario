// Anexos: o conteúdo vive no R2, os metadados na D1. Quem pode ver um anexo
// é quem pode ver a casa a que ele pertence; enquanto não estiver guardado
// numa casa, só quem o carregou.

const MAX_FILE = 25 * 1024 * 1024;   // o mesmo limite que a app aplica

export const isFileId = (v) => /^[A-Za-z0-9_-]{1,64}$/.test(String(v || ''));

// Percorre um registo à procura dos anexos que ele refere.
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
// pertencer-lhe — é isto que os torna visíveis a quem partilha a casa.
export async function linkFiles(env, houseId, data) {
  const ids = fileIdsIn(data);
  if (!ids.length || !houseId) return;
  try {
    const ph = ids.map(() => '?').join(',');
    await env.DB.prepare(`UPDATE files SET house_id = ? WHERE id IN (${ph})`)
      .bind(houseId, ...ids)
      .run();
  } catch (e) { /* o anexo pode ainda não ter sido carregado */ }
}

// A regra de acesso a um anexo: o dono vê sempre; guardado numa casa, vê
// quem tiver acesso à casa; solto e de outra pessoa, ninguém.
async function podeVer(env, me, row, canAccessHouse) {
  if (!row) return false;
  if (row.owner_id === me.id) return true;
  if (!row.house_id) return false;
  return (await canAccessHouse(env, me.id, row.house_id)).ok;
}

/* As rotas /api/files/:id. PUT carrega (o corpo para o R2, os metadados
   para a D1, com os limites de tamanho e o id preso ao primeiro dono); GET
   devolve o conteúdo com o tipo e o nome originais; DELETE apaga dos dois
   lados. O GET responde 404 tanto ao que não existe como ao que não se pode
   ver — não se confirma a existência do que é dos outros. */
export async function handleFiles(request, env, me, seg, method, deps) {
  const { json, err, canAccessHouse, now } = deps;
  const id = seg[2];
  if (!isFileId(id)) return err(400, 'Identificador inválido.');

  if (method === 'PUT') {
    const tam = Number(request.headers.get('Content-Length') || 0);
    if (tam > MAX_FILE) return err(413, 'O ficheiro é demasiado grande (máx. 25 MB).');
    const url = new URL(request.url);
    const casa = url.searchParams.get('casa') || null;
    if (casa && !isFileId(casa)) return err(400, 'Identificador inválido.');
    if (casa && !(await canAccessHouse(env, me.id, casa)).ok) return err(403, 'Sem acesso a esta casa.');

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
    if (!(await podeVer(env, me, row, canAccessHouse))) return err(404, 'Anexo não encontrado.');
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
    if (!(await podeVer(env, me, row, canAccessHouse))) return json({ ok: true });
    await env.FILES.delete(id);
    await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return err(404, 'Rota desconhecida.');
}
