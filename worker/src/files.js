// Anexos: o conteúdo vive no R2, os metadados na D1. Quem pode ver um anexo
// é quem pode ver a casa a que ele pertence; enquanto não estiver guardado
// numa casa, só quem o carregou. Para um colaborador, a casa não chega: o
// anexo sabe a que registo pertence (record_kind/record_id) e o cargo tem
// de o poder ver — um CC digitalizado numa ficha de inquilino não sai para
// quem só marca visitas. Um anexo SEM kind (carregado antes da migração
// 0014, ou de um kind que o servidor não conhece) é «não classificado»: só
// o dono e os comproprietários o veem, até o dono voltar a gravar o registo
// (docs/armadilhas.md).

import { acessoACasa } from './lib/acesso.js';
import { permDoKind, podeVerKind, temPerm, fraseRecusa } from './lib/permissoes.js';

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
// O filtro depende de quem grava. Dono e comproprietário movem os anexos
// que sejam deles, os soltos (sem casa) e qualquer anexo já nesta casa — é
// assim que os anexos anteriores à migração 0014 (sem kind), carregados por
// qualquer um dos dois, ganham kind ao regravar o registo. Um colaborador
// só move os dele, os soltos, ou os que já estejam presos a ESTE registo —
// o tuplo completo (casa, kind, id), o mesmo que regraDosAnexos compara:
// os ids de registo são do cliente e repetem-se entre kinds, e um tx com o
// id da ficha do inquilino (ou o da casa) re-etiquetava o CC (ou o documento
// da hipoteca) para um kind que o cargo lê. Um id que circule também não
// rouba o anexo de outra conta para uma casa onde o ladrão o possa ler. O
// que não passa no filtro fica como está — a gravação não falha por isso.
// Recebe: env — o ambiente do worker (D1 em env.DB); houseId — o id da casa;
// data — o registo acabado de gravar, onde se procuram os anexos; kind — o
// kind do registo ('contract', 'tx', ...) ou 'house' para a casa inteira
// (as fotos ficam 'house.photos' e os documentos das hipotecas 'house.loans');
// recordId — o id do registo (a casa: o próprio houseId); userId (opcional) —
// quem grava; sem ele não se aplica o filtro de propriedade; estrito
// (opcional) — true quando quem grava é colaborador (acesso.collab): só se
// movem anexos já presos a este registo, não qualquer anexo da casa.
// Devolve: nada — atualiza house_id/record_kind/record_id dos anexos na D1
// (falhas são engolidas).
export async function linkFiles(env, houseId, data, kind, recordId, userId, estrito) {
  if (!houseId || !data || typeof data !== 'object') return;
  const rid = String(recordId || houseId);
  const grava = async (ids, rk) => {
    if (!ids.length) return;
    try {
      const ph = ids.map(() => '?').join(',');
      const filtro = !userId ? ''
        : estrito ? ' AND (owner_id = ? OR house_id IS NULL OR (house_id = ? AND record_kind = ? AND record_id = ?))'
          : ' AND (owner_id = ? OR house_id IS NULL OR house_id = ?)';
      const binds = !userId ? [] : estrito ? [userId, houseId, rk, rid] : [userId, houseId];
      await env.DB.prepare(
        `UPDATE files SET house_id = ?, record_kind = ?, record_id = ? WHERE id IN (${ph})${filtro}`
      )
        .bind(houseId, rk, rid, ...ids, ...binds)
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

// A regra dos anexos numa escrita de registo: um colaborador só junta anexos
// a um registo com file.add. «Juntar» é referir um id que ainda não esteja
// preso a ESTE registo — o que já lá estava (posto pelo dono, ou por ele
// próprio antes) não conta, para editar o registo sem mexer nos anexos
// continuar a passar. Sem isto, carregar solto (PUT /api/files/:id sem
// ?casa=) e gravar o registo era o caminho por onde o file.add não se via.
// Recebe: env — o ambiente do worker (D1 em env.DB); acesso — o objeto de
// acessoACasa; houseId, kind, recordId — a linha do registo; data — o registo
// que se vai gravar (já passado por cleanData).
// Devolve: promessa de null quando pode, ou de { status: 403, error } com a
// frase para o cliente.
export async function regraDosAnexos(env, acesso, houseId, kind, recordId, data) {
  if (!acesso || !acesso.collab || temPerm(acesso.collab.perms, 'file.add')) return null;
  const ids = [...new Set(fileIdsIn(data))];
  if (!ids.length) return null;
  const presos = new Set();
  for (let i = 0; i < ids.length; i += 50) {   // o limite de parâmetros da D1
    const parte = ids.slice(i, i + 50);
    const rows = (await env.DB.prepare(
      `SELECT id FROM files WHERE house_id = ? AND record_kind = ? AND record_id = ?
          AND id IN (${parte.map(() => '?').join(',')})`
    ).bind(houseId, String(kind), String(recordId), ...parte).all()).results;
    rows.forEach((r) => presos.add(r.id));
  }
  return ids.every((id) => presos.has(id)) ? null : { status: 403, error: fraseRecusa('anexo') };
}

// A regra de acesso a um anexo: o dono vê sempre; guardado numa casa, vê
// quem tiver acesso à casa — dono e comproprietário a tudo; um colaborador
// só com file.view, e ao que o cargo cobre (documentos de hipoteca pedem
// loan.view; um anexo de inquilino pede tenant.view); um anexo sem kind
// (anterior à migração 0014) ou de kind desconhecido não sai para nenhum
// cargo — não se sabe o que é, logo não se sabe que permissão o abre;
// solto e de outra pessoa, ninguém.
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
  else if (rk === 'house.photos') ver = temPerm(perms, 'file.view');
  else if (permDoKind(rk)) ver = temPerm(perms, 'file.view') && podeVerKind(perms, rk);
  else ver = false;   // sem kind ou kind desconhecido: só dono e comproprietários
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
      if (a.collab && !temPerm(a.collab.perms, 'file.add')) return err(403, fraseRecusa('anexo'));
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
