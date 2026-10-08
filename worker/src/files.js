// Anexos: o conteúdo vive no R2, os metadados na D1. Quem pode ver um anexo
// é quem pode ver a casa a que ele pertence; enquanto não estiver guardado
// numa casa, só quem o carregou. Para um colaborador, a casa não chega: o
// anexo sabe a que registo pertence (record_kind/record_id) e o cargo tem
// de o poder ver — um CC digitalizado numa ficha de inquilino não sai para
// quem só marca visitas. Um anexo SEM kind (carregado antes da migração
// 0014, ou de um kind que o servidor não conhece) é «não classificado»: só
// o dono e os comproprietários o veem, até o dono voltar a gravar o registo
// (docs/armadilhas.md).

import { acessoACasa, apagarDoR2 } from './lib/acesso.js';
import { permDoKind, podeVerKind, temPerm, fraseRecusa } from './lib/permissoes.js';
import { json, err, now, CSP_ANEXO } from './lib/http.js';
import { rateLimit } from './lib/limites.js';

const MAX_FILE = 25 * 1024 * 1024;   // o mesmo limite que a app aplica

/* O espaço de uma conta no R2: a soma dos anexos que carregou. O plano
   gratuito do R2 são 10 GB para toda a gente; sem teto, uma conta (legítima
   com um bug no cliente, ou não) enchia-o com 400 PUTs e os anexos de todos
   deixavam de subir, sem ninguém ser avisado. */
export const TETO_POR_CONTA = 500 * 1024 * 1024;

/* Os tipos que abrem no sítio (inline): imagens e PDF, que o browser mostra
   sem correr nada. Tudo o resto — text/html, image/svg+xml, XML, scripts —
   sai como descarga, em application/octet-stream: um anexo é conteúdo de
   quem o carregou servido na origem da app, e com o tipo dele um HTML corria
   com a sessão de quem abrisse a ligação. Decide-se à saída, pelo que está na
   linha, e por isso vale também para os anexos gravados antes disto. */
const TIPOS_NO_SITIO = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

/* Quanto esperam os anexos de uma casa apagada antes de a varredura os levar:
   a app deixa desfazer o apagar (web/app/imovel.js, comDesfazer), e o
   desfazer volta a gravar a casa e os registos com os mesmos anexos. */
const PRAZO_CASA_APAGADA = 30 * 86400000;

// O tipo MIME de um anexo como fica guardado e como se lê: minúsculas, sem
// parâmetros (charset…), e só com a forma tipo/subtipo — senão, o genérico.
// Recebe: bruto — o que veio no X-Ficheiro-Tipo (ou o que está na linha).
// Devolve: o tipo normalizado, ou 'application/octet-stream'.
function tipoDoAnexo(bruto) {
  const t = String(bruto || '').split(';')[0].trim().toLowerCase();
  return /^[a-z0-9][a-z0-9!#$&^_.+-]{0,62}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,62}$/.test(t) ? t : 'application/octet-stream';
}

// Megabytes para uma frase, arredondados às unidades.
// Recebe: bytes — um número de bytes.
// Devolve: o texto, ex.: '512 MB'.
function emMB(bytes) {
  return Math.max(0, Math.round(bytes / (1024 * 1024))) + ' MB';
}

/* Os anexos que já não pertencem a nada que se veja: os de uma casa apagada
   há mais de PRAZO_CASA_APAGADA, os presos a uma casa que já não existe, e os
   de uma conta apagada que não estejam numa casa viva (os que ficaram de
   antes de o purgeAccount os apagar). O que está numa casa viva — mesmo
   carregado por uma conta que entretanto se apagou — pertence à casa e fica. */
const ANEXO_ABANDONADO = `(f.house_id IS NOT NULL AND h.id IS NULL)
    OR (h.deleted = 1 AND h.updated_at < ?1)
    OR (u.deleted_at IS NOT NULL AND (h.id IS NULL OR h.deleted = 1))`;

/* A varredura do cron diário: apaga do R2 e da D1 os anexos abandonados
   (ANEXO_ABANDONADO), mil de cada vez e até cinco voltas por dia. As chaves
   saem do R2 antes das linhas: se a D1 falhar a meio, a linha fica a apontar
   para nada (o GET dá 404) e a volta seguinte volta a apanhá-la; o contrário
   deixava objetos no R2 que já ninguém sabia que existiam.
   Recebe: env — o ambiente do worker (D1 e R2); agora (opcional) — o
   instante de referência em milissegundos.
   Devolve: promessa de quantos anexos saíram. */
export async function varrerAnexos(env, agora) {
  const limite = (agora || now()) - PRAZO_CASA_APAGADA;
  const de = `FROM files f LEFT JOIN houses h ON h.id = f.house_id LEFT JOIN users u ON u.id = f.owner_id
    WHERE (${ANEXO_ABANDONADO})`;
  let total = 0;
  for (let volta = 0; volta < 5; volta++) {
    const ids = (await env.DB.prepare(`SELECT f.id ${de} ORDER BY f.id LIMIT 1000`).bind(limite).all())
      .results.map((r) => r.id);
    if (!ids.length) break;
    await apagarDoR2(env, ids);
    // os mesmos: a mesma condição, até ao último id desta volta
    await env.DB.prepare(`DELETE FROM files WHERE id IN (SELECT f.id ${de} AND f.id <= ?2)`)
      .bind(limite, ids[ids.length - 1]).run();
    total += ids.length;
    if (ids.length < 1000) break;
  }
  return total;
}

// Um id de anexo tem a forma dos ids da app: letras, algarismos, _ e -, até 64.
// Recebe: v — o id (qualquer valor; null e undefined contam como vazio).
// Devolve: true quando tem essa forma.
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

/* As rotas /api/files/:id. PUT carrega (os metadados para a D1 e depois o
   corpo para o R2, com os limites de tamanho, o teto da conta, o travão de
   ritmo e o id preso ao primeiro dono); GET devolve o conteúdo — no sítio só
   imagens e PDF (TIPOS_NO_SITIO), o resto como descarga, e tudo em caixa de
   areia (CSP_ANEXO); DELETE apaga dos dois lados. O GET responde 404 tanto
   ao que não existe como ao que não se pode ver — não se confirma a
   existência do que é dos outros. Um colaborador carrega para uma casa só
   com file.add, e só apaga o que ele próprio carregou (o DELETE do que não
   pode apagar responde ok sem tocar em nada, como já fazia ao que não se vê).
   Recebe: request — o pedido HTTP (Request); env — o ambiente do worker (R2
   em env.FILES, D1 em env.DB); me — o utilizador com sessão; seg — os
   segmentos do caminho (seg[2] é o id do anexo); method — o método HTTP.
   Devolve: uma Response — JSON { ok: true } no PUT e no DELETE, o conteúdo
   com o nome original no GET, ou o erro que couber. */
export async function handleFiles(request, env, me, seg, method) {
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
    /* o travão conta só anexos novos: o cliente volta a subir os que tem no
       aparelho depois de cada sincronização (web/cloud/anexos.js:
       subirPendentes), e isso não pode esgotar a hora de quem só editou */
    if (!existe && !(await rateLimit(env, 'up:' + me.id, 60, 3600))) {
      return err(429, 'Demasiados anexos seguidos. Ficam neste aparelho e sobem daqui a pouco.');
    }

    const tipo = tipoDoAnexo(request.headers.get('X-Ficheiro-Tipo'));
    // um nome mal codificado é um defeito do pedido, não do servidor: fica como veio
    const bruto = String(request.headers.get('X-Ficheiro-Nome') || '');
    let nome = bruto;
    try { nome = decodeURIComponent(bruto); } catch (e) { /* URIError: fica o bruto */ }
    nome = nome.slice(0, 200);
    const corpo = await request.arrayBuffer();
    if (corpo.byteLength > MAX_FILE) return err(413, 'O ficheiro é demasiado grande (máx. 25 MB).');

    // o teto da conta; o próprio anexo, se já existia, não conta duas vezes
    const usado = await env.DB.prepare('SELECT COALESCE(SUM(size), 0) AS n FROM files WHERE owner_id = ? AND id <> ?')
      .bind(me.id, id).first();
    const livre = TETO_POR_CONTA - ((usado && usado.n) || 0);
    if (corpo.byteLength > livre) {
      return err(413, 'Sem espaço para este anexo: cada conta tem ' + emMB(TETO_POR_CONTA) +
        ' e sobram ' + emMB(livre) + '. Apaga anexos de que já não precisas.');
    }

    /* a linha na D1 primeiro, o objeto no R2 depois: um INSERT que falhe não
       deixa um objeto que ninguém sabe que existe; e se for o R2 a falhar,
       a linha nova sai (a de um anexo que já existia fica — o objeto antigo
       continua lá) */
    await env.DB.prepare(
      `INSERT INTO files (id, owner_id, house_id, name, type, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET house_id = COALESCE(excluded.house_id, files.house_id),
         name = excluded.name, type = excluded.type, size = excluded.size`
    ).bind(id, me.id, casa, nome, tipo, corpo.byteLength, now()).run();
    try {
      await env.FILES.put(id, corpo, { httpMetadata: { contentType: tipo } });
    } catch (e) {
      if (!existe) {
        try { await env.DB.prepare('DELETE FROM files WHERE id = ? AND owner_id = ?').bind(id, me.id).run(); } catch (e2) {}
      }
      throw e;
    }
    return json({ ok: true, id });
  }

  const row = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();

  if (method === 'GET') {
    if (!(await acessoAoAnexo(env, me, row)).ver) return err(404, 'Anexo não encontrado.');
    const obj = await env.FILES.get(id);
    if (!obj) return err(404, 'Anexo não encontrado.');
    const tipo = tipoDoAnexo(row.type);
    const noSitio = TIPOS_NO_SITIO.has(tipo);
    return new Response(obj.body, {
      headers: {
        'Content-Type': noSitio ? tipo : 'application/octet-stream',
        'Content-Length': String(row.size || 0),
        'Cache-Control': 'private, max-age=86400',
        'Content-Disposition': (noSitio ? 'inline' : 'attachment') + '; filename="' + encodeURIComponent(row.name || id) + '"',
        // o index.js deixa passar este valor exato pelo harden (PODE_APERTAR)
        'Content-Security-Policy': CSP_ANEXO,
        'X-Content-Type-Options': 'nosniff',
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
