// A camada da nuvem dos colaboradores. Os módulos de web/cloud ficam de fora
// do arnês (MODULOS só carrega web/app), por isso aqui carregam-se três deles
// — nucleo, partilha e colaboradores — por cima da app já carregada, com api,
// pullNow, toast e os modais trocados por espiões. O resto (entrada, anexos,
// guia, novidades, painel…) tem efeitos no arranque que não vale a pena
// fingir: fica o parse e a presença, em texto, do que o contrato manda.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { carregarApp } from './arnes.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const le = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');

const CLOUD = ['nucleo', 'anexos', 'utilizadores', 'partilha', 'colaboradores', 'ajuda', 'painel',
  'entrada', 'novidades', 'guia'];

describe('os módulos cloud fazem parse', () => {
  for (const nome of CLOUD) {
    test('web/cloud/' + nome + '.js', () => {
      assert.doesNotThrow(() => new vm.Script(le('web/cloud/' + nome + '.js'), { filename: nome + '.js' }));
    });
  }
});

describe('o contrato, em texto', () => {
  test('colaboradores.js tem os handlers e as chamadas à API do contrato', () => {
    const s = le('web/cloud/colaboradores.js');
    for (const h of ['cargoModal', 'guardarCargo', 'apagarCargo', 'criarConvite', 'revogarConvite', 'copiar',
      'mudarColaborador', 'removerColaborador', 'sairDeImovel', 'ligacaoCriar', 'ligacaoRodar', 'ligacaoDesativar',
      'pedidoAceitar', 'pedidoRecusar', 'aceitarConvite', 'pedirPartilha']) {
      assert.match(s, new RegExp('CW\\.' + h + ' = function'), 'CW.' + h);
    }
    for (const rota of ["'/api/roles/'", "'/api/collab-invites'", "'/api/collab-invites/'", "'/api/convite/'", "'/aceitar'",
      "'/api/collaborators/'", "'/api/share-link'", "'/api/ligar/'", "'/pedir'", "'/api/share-requests/'", "'/accept'", "'/reject'"]) {
      assert.ok(s.includes(rota), 'chama ' + rota);
    }
    for (const t of ['Cargo guardado.', 'Ligação de convite criada — copia-a e envia.', 'Ligação copiada.', 'Convite revogado.',
      'Colaborador removido — deixa de ver estes imóveis.', 'Ligação de partilha desativada — quem já pediu continua à espera da tua resposta.',
      'Pedido enviado — ', 'Partilha aceite: ', 'chaveDaLigacao()']) {
      assert.ok(s.includes(t), 'texto: ' + t);
    }
    // o fecho das permissões da app (um Set) não pode ser pisado por este módulo
    assert.ok(!/function fechoPerms\(/.test(s), 'não redefine fechoPerms (é de acessos.js)');
  });

  test('entrada.js aterra as ligações sem as gastar: token fora do URL, sessionStorage, GET só mostra', () => {
    const s = le('web/cloud/entrada.js');
    for (const t of ["'gi_convite'", "'gi_ligar'", 'history.replaceState', "'/api/convite/'", "'/api/ligar/'",
      'Entras como', 'Não sou eu', 'Agora não', 'Enviar pedido', 'CW.resgatarChegada']) {
      assert.ok(s.includes(t), 'texto: ' + t);
    }
    assert.match(s, /function chegadaNoEndereco/, 'lê o endereço');
    // o POST que gasta a ligação só acontece no botão, nunca ao chegar
    const ate = s.indexOf('CW.resgatarChegada = function');
    assert.ok(ate > -1);
    assert.ok(!/api\('POST', '\/api\/convite/.test(s), 'o aceitar (POST) vive em colaboradores.js, atrás do botão');
  });

  test('nucleo.js lê o cargo, os colaboradores e o criador, e trata o 403', () => {
    const s = le('web/cloud/nucleo.js');
    for (const t of ['cargosDoEstado', '_colaboradores', '_cargo', '_collabId', '_createdBy',
      'não foi guardado: sem permissão neste imóvel.', 'podeExportar', "'house.edit'"]) {
      assert.ok(s.includes(t), 'texto: ' + t);
    }
    const marca = s.match(/var marca = function[\s\S]*?\};/);
    assert.match(marca[0], /r\.createdBy/, 'o criador entra na marca');
  });

  test('partilha.js tem os cartões do contrato e a vista do separador', () => {
    const s = le('web/cloud/partilha.js');
    for (const t of ['A minha ligação de partilha', 'Pedidos de partilha', "'Cargos'", 'Convidar colaborador',
      "'Colaboradores'", 'Imóveis onde colaboras', 'Convites por usar', 'Escolher pelo grupo…', 'Vale 7 dias e uma só utilização',
      'Como dou acesso a um gestor sem o tornar comproprietário?', 'function vColaboradores()']) {
      assert.ok(s.includes(t), 'texto: ' + t);
    }
    assert.ok(!/function colabRow/.test(s), 'Conta e partilha não tem porta própria para os colaboradores: vivem no menu');
    const sub = /SUBPAGE\.cloud = .*/.exec(s)[0];
    assert.ok(!/colaborador/i.test(sub), 'o subtítulo de Conta e partilha já não fala em colaboradores: ' + sub);
  });

  test('a guarda de apagar o imóvel saiu de cloud/anexos.js (vive em imovel.js com souCriador)', () => {
    assert.ok(!/delProp = function/.test(le('web/cloud/anexos.js')));
    assert.match(le('web/app/imovel.js'), /souCriador\(id\)/);
  });
});

/* ------------------------------------------------------------------ o vm */

// A app com nucleo, partilha e colaboradores por cima, e os espiões.
function montar() {
  const app = carregarApp();
  app.document.documentElement.style.removeProperty = () => {};
  const ctx = app.__ctx;
  for (const nome of ['nucleo', 'partilha', 'colaboradores']) {
    vm.runInContext(le('web/cloud/' + nome + '.js'), ctx, { filename: 'cloud/' + nome + '.js' });
  }
  const esp = { api: [], toasts: [], modais: [], confirmados: [] };
  app.api = (method, p, body) => {
    esp.api.push({ method, path: p, body });
    const r = esp.resposta ? esp.resposta(method, p, body) : {};
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  };
  app.toast = (m) => { esp.toasts.push(m); };
  app.openModal = (t, b, f) => { esp.modais.push({ titulo: t, corpo: b, rodape: f || '' }); };
  app.closeModal = () => {};
  app.closeAllModals = () => {};
  app.confirmModal = (t, txt, cb) => { esp.confirmados.push(t); cb(); };
  app.pullNow = () => Promise.resolve();
  app.render = () => {};
  app.setSyncBadge = () => {};
  app.subirPendentes = () => {};
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt', token: 't' };
  return { app, esp };
}

const espera = () => new Promise((r) => setTimeout(r, 5));

const ESTADO = () => ({
  me: { id: 'EU' },
  houses: [
    { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1,
      data: { id: 'H1', name: 'Minha', address: 'Rua A' } },
    { id: 'H2', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'ANA'], updatedAt: 1,
      collab: { id: 'C9', roleId: 'R1', roleName: 'Contabilista', perms: ['tx.view', 'tx.add', 'rec.view'] },
      data: { id: 'H2', name: 'Do Rui' } },
  ],
  records: [
    { houseId: 'H2', kind: 'tx', id: 'T1', updatedAt: 5, author: 'RUI', createdBy: 'RUI',
      data: { id: 'T1', label: 'Renda', propertyId: 'H2', amount: 100, kind: 'income', date: '2026-01-01' } },
    { houseId: 'H2', kind: 'visit', id: 'V1', updatedAt: 5, author: 'RUI', createdBy: 'RUI',
      data: { id: 'V1', nomes: 'Ana', propertyId: 'H2', date: '2026-01-01' } },
    { houseId: 'H2', kind: 'tenant', id: 'P1', updatedAt: 5, author: 'RUI', createdBy: 'RUI',
      data: { id: 'P1', name: 'Inquilina' } },
  ],
  userRecords: [],
  profiles: [
    { userId: 'RUI', name: 'Rui', data: null }, { userId: 'ANA', name: 'Ana', data: null },
    { userId: 'MARIA', name: 'Maria', data: null },
  ],
  connections: [],
  roles: [{ id: 'R2', name: 'Gestor de visitas', perms: ['visit.view', 'visit.add'], n: 1 }],
  collaborators: [{ id: 'C1', userId: 'MARIA', name: 'Maria', roleId: 'R2', roleName: 'Gestor de visitas', houses: [{ id: 'H1', name: 'Minha' }] }],
  invites: [{ id: 'abc123', label: 'para a Ana', roleName: 'Gestor de visitas', houses: [{ id: 'H1', name: 'Minha' }], expiresAt: 4102444800000 }],
  people: [{ id: 'MARIA', name: 'Maria', kind: 'collab', roleName: 'Gestor de visitas' }],
  shareLink: { ativo: true, uses: 2 },
  shareRequests: { incoming: [{ id: 'p1', fromName: 'Ana', houseName: 'T2 Porto', createdAt: 1 }], outgoing: [] },
});

describe('rebuildDb com colaboração', () => {
  let app, esp, d;
  beforeEach(() => {
    ({ app, esp } = montar());
    d = app.rebuildDb(ESTADO());
  });

  test('o imóvel onde sou colaborador leva o cargo, a linha de colaboração e o dono — e eu nunca entro em ownerIds', () => {
    const h2 = d.properties.find((p) => p.id === 'H2');
    assert.equal(h2._cargo, 'Contabilista');
    assert.equal(h2._collabId, 'C9');
    assert.equal(h2._sharedFrom, 'Rui');
    assert.deepEqual(JSON.parse(JSON.stringify(h2.ownerIds)), ['RUI', 'ANA']);
    assert.equal(app.CW.cargos.H2.dono, false);
    assert.equal(app.CW.cargos.H1.dono, true);
  });

  test('o meu imóvel leva os colaboradores; o colaborador não vira proprietário, fica em CW.pessoas', () => {
    const h1 = d.properties.find((p) => p.id === 'H1');
    assert.equal(h1._colaboradores.length, 1);
    assert.equal(h1._colaboradores[0].userId, 'MARIA');
    assert.equal(h1._colaboradores[0].roleName, 'Gestor de visitas');
    const ids = JSON.parse(JSON.stringify(d.owners.map((o) => o.id).sort()));
    assert.deepEqual(ids, ['ANA', 'EU', 'RUI'], 'eu e os donos reais; a Maria não');
    assert.equal(app.CW.pessoas.MARIA.name, 'Maria');
  });

  test('os registos levam o criador e a ficha de inquilino o imóvel', () => {
    assert.equal(d.transactions.find((t) => t.id === 'T1')._createdBy, 'RUI');
    assert.equal(d.tenants.find((t) => t.id === 'P1')._houseId, 'H2');
  });

  test('exportEntities só sobe do imóvel de colaboração o que o cargo dá', () => {
    app.db = d;
    const mapa = app.exportEntities();
    const chaves = Object.keys(JSON.parse(JSON.stringify(mapa)));
    assert.ok(chaves.includes('h:H1'), 'a minha casa sobe');
    assert.ok(!chaves.includes('h:H2'), 'sem house.edit a ficha do imóvel não sobe');
    assert.ok(chaves.includes('r:H2:tx:T1'), 'com tx.add o movimento sobe');
    assert.ok(!chaves.includes('r:H2:visit:V1'), 'sem visit.add a visita não sobe');
  });

  test('um 403 num put de registo tira-o da base e do retrato, e avisa', async () => {
    app.db = d;
    esp.resposta = (m, p, body) => ({
      results: body.ops.map((o) => (o.scope === 'record' && o.kind === 'tx' ? { ok: false, status: 403, error: 'Sem permissão para adicionar movimentos neste imóvel.' } : { ok: true })),
    });
    await app.pushNow();
    assert.ok(!app.db.transactions.some((t) => t.id === 'T1'), 'o movimento saiu da base');
    assert.ok(!('r:H2:tx:T1' in app.snap), 'e do retrato: o que falta não é uma remoção por enviar');
    assert.ok(esp.toasts.some((t) => /Renda não foi guardado: sem permissão neste imóvel\./.test(t)), esp.toasts.join(' | '));
  });
});

describe('as ações da nuvem falam com a API do contrato', () => {
  let app, esp;
  beforeEach(() => {
    ({ app, esp } = montar());
    const st = ESTADO();
    app.db = app.rebuildDb(st);
    app.CW.state = st;
  });

  test('apagar cargo confirma e chama DELETE /api/roles/:id; o 409 do servidor chega tal e qual', async () => {
    esp.resposta = () => Object.assign(new Error('Este cargo está atribuído a 1 pessoas — troca-lhes o cargo primeiro.'), { status: 409 });
    app.CW.apagarCargo('R2');
    await espera();
    assert.deepEqual(esp.confirmados, ['Apagar cargo']);
    assert.equal(esp.api[0].method, 'DELETE');
    assert.equal(esp.api[0].path, '/api/roles/R2');
    assert.match(esp.toasts[0], /atribuído a 1 pessoas/);
  });

  test('a janela do cargo: cada caixa Ver/Adicionar/Editar tem o rótulo como área de toque (a classe da folha, e não letra de 13px)', () => {
    app.CW.cargoModal();
    const b = esp.modais[0].corpo;
    assert.ok(!b.includes('u-fs-13px'), 'sem a letra miúda');
    assert.match(b, /<div class="stat u-ai-center colab-perm-linha"><span>Visitas<\/span><span class="colab-perm-caixas"><label class="check colab-perm-caixa"><input type="checkbox" data-perm="visit\.view" id="cg_visit_view"/);
  });

  test('guardar cargo envia PUT /api/roles/:id com o nome e o fecho das permissões', async () => {
    const caixas = [{ checked: true, dataset: { perm: 'contract.add' } }, { checked: false, dataset: { perm: 'tx.view' } }];
    app.document.querySelectorAll = (q) => (q === 'input[data-perm]' ? caixas : []);
    app.document.getElementById = (id) => ({ value: id === 'cg_nome' ? ' Gestor ' : '', classList: { add() {}, remove() {} }, addEventListener() {}, focus() {}, scrollIntoView() {} });
    app.CW._cargoId = 'R7';
    app.CW.guardarCargo();
    await espera();
    assert.equal(esp.api[0].method, 'PUT');
    assert.equal(esp.api[0].path, '/api/roles/R7');
    assert.equal(esp.api[0].body.name, 'Gestor');
    const perms = JSON.parse(JSON.stringify(esp.api[0].body.perms)).sort();
    assert.deepEqual(perms, ['contract.add', 'contract.view', 'rec.add', 'rec.view'], 'contract.add traz contract.view, rec.add e rec.view');
    assert.deepEqual(esp.toasts, ['Cargo guardado.']);
  });

  test('criar convite: POST /api/collab-invites com cargo e imóveis, e a janela «Convite pronto» com a ligação, o cargo, os imóveis e quando expira', async () => {
    app.document.getElementById = (id) => ({ value: id === 'cw_inv_cargo' ? 'R2' : '', checked: id === 'cw_inv_h_H1' });
    const fim = new Date(2030, 9, 24, 12).getTime();
    esp.resposta = () => ({ token: 'x', url: 'https://app.rendorium.com/?convite=' + 'a'.repeat(64), expiresAt: fim });
    app.CW.criarConvite();
    await espera();
    assert.equal(esp.api[0].method, 'POST');
    assert.equal(esp.api[0].path, '/api/collab-invites');
    assert.deepEqual(JSON.parse(JSON.stringify(esp.api[0].body)), { roleId: 'R2', houseIds: ['H1'] });
    assert.equal(esp.toasts[0], 'Ligação de convite criada — copia-a e envia.');
    const j = esp.modais[0];
    assert.equal(j.titulo, 'Convite pronto');
    assert.match(j.corpo, /value="https:\/\/app\.rendorium\.com\/\?convite=a{64}"/);
    assert.match(j.corpo, /Gestor de visitas · Minha/, 'o cargo e os imóveis');
    assert.match(j.corpo, /CW\.copiar\('https:\/\/app\.rendorium\.com\/\?convite=a{64}'\)">Copiar ligação/);
    assert.match(j.corpo, /Serve uma vez · expira a 24\/10\/2030/);
    assert.match(j.corpo, /Esta ligação só se vê agora\. Se a perderes, revoga o convite e cria outro\./);
    assert.match(j.rodape, />Feito</);
    assert.ok(!/\son[a-z]+=|\sstyle=/.test(j.corpo + j.rodape), 'nada em linha');
  });

  test('a janela «Convidar colaborador»: o cargo em opções (o primeiro escolhido), os imóveis meus em caixas, os grupos em chips, a nota opcional com exemplo, e «Criar ligação de convite»', () => {
    app.db.groups = [app.normGroup({ id: 'G1', kind: 'prop', name: 'Casas minhas', ids: ['H1'] })];
    app.CW.conviteModal();
    const j = esp.modais[0];
    assert.equal(j.titulo, 'Convidar colaborador');
    assert.match(j.corpo, /role="radiogroup" aria-labelledby="cw_inv_cl"><p class="flabel" id="cw_inv_cl">Cargo <span class="req">\*<\/span>/);
    assert.match(j.corpo, /<input type="hidden" id="cw_inv_cargo" value="R2">/);
    assert.match(j.corpo, /role="radio" aria-checked="true" class="colab-cargo-op on" data-id="R2" data-toca="rascunho" data-click="CW\.conviteCargo\(this\)">[\s\S]*?Gestor de visitas[\s\S]*?Adiciona visitas/);
    assert.match(j.corpo, /data-click="CW\.cargoModal\(\)">[\s\S]*? Criar outro cargo/);
    assert.ok(j.corpo.includes('id="cw_inv_h_H1"') && !j.corpo.includes('cw_inv_h_H2'), 'só os imóveis meus');
    // os imóveis numa lista em cartão, linha a linha (o canvas, M-Convidar), e não caixas soltas
    assert.match(j.corpo, /<div class="colab-casas"><label class="check colab-casa"><input type="checkbox" id="cw_inv_h_H1"><span class="colab-txt"><b>Minha<\/b>/);
    assert.match(j.corpo, /class="chip" data-toca="rascunho" data-click="CW\.conviteGrupo\('G1'\)">Casas minhas</);
    assert.match(j.corpo, /<label>Nota para ti \(opcional\)<input id="cw_inv_label" maxlength="60" value="" placeholder="Ex: Para a Ana, contabilidade"/);
    assert.match(j.rodape, /data-toca="dados" data-click="CW\.criarConvite\(\)">Criar ligação de convite</);
    assert.ok(!/\son[a-z]+=|\sstyle=/.test(j.corpo + j.rodape), 'nada em linha');
  });

  test('sem cargos, «Convidar colaborador» diz que o primeiro passo é o cargo; sem imóveis meus, que não há para onde convidar', () => {
    app.CW.state.roles = [];
    app.CW.conviteModal();
    assert.match(esp.modais[0].corpo, /Primeiro, um cargo/);
    assert.match(esp.modais[0].rodape, /closeModal\(\);CW\.cargoModal\(\)/);
    app.CW.state.roles = [{ id: 'R2', name: 'Gestor de visitas', perms: ['visit.add'], n: 0 }];
    app.db.properties = app.db.properties.filter((p) => p.id !== 'H1');
    app.CW.conviteModal();
    assert.match(esp.modais[1].corpo, /Ainda não tens imóveis teus/);
    assert.match(esp.modais[1].rodape, /propModal\(\)/);
  });

  test('revogar convite e remover colaborador confirmam e chamam DELETE', async () => {
    app.CW.revogarConvite('abc123');
    app.CW.removerColaborador('C1');
    await espera();
    assert.deepEqual(esp.confirmados, ['Revogar convite', 'Remover colaborador']);
    assert.deepEqual(esp.api.map((x) => x.method + ' ' + x.path), ['DELETE /api/collab-invites/abc123', 'DELETE /api/collaborators/C1']);
    assert.deepEqual(esp.toasts, ['Convite revogado.', 'Colaborador removido — deixa de ver estes imóveis.']);
  });

  test('sair de um imóvel usa a linha de colaboração e diz de qual saí', async () => {
    app.CW.sairDeImovel('C9');
    await espera();
    assert.equal(esp.api[0].method + ' ' + esp.api[0].path, 'DELETE /api/collaborators/C9');
    assert.deepEqual(esp.toasts, ['Saíste de Do Rui.']);
  });

  test('mudar colaborador: PUT /api/collaborators/:id com cargo e imóveis', async () => {
    app.document.getElementById = (id) => ({ value: id === 'cw_col_cargo' ? 'R2' : '', checked: id === 'cw_col_h_H1' });
    // o onSave é uma propriedade da janela de cima da pilha: com o openModal
    // trocado por um espião, põe-se uma janela falsa na pilha para o apanhar
    const janela = { el: {}, onSave: null };
    app.modalStack.push(janela);
    app.CW.mudarColaborador('C1');
    assert.equal(esp.modais[0].titulo, 'Mudar cargo ou imóveis');
    assert.match(esp.modais[0].corpo, /<div class="colab-casas"><label class="check colab-casa"><input type="checkbox" id="cw_col_h_H1" checked>/, 'a mesma lista do convite');
    assert.equal(typeof janela.onSave, 'function', 'a gravação ficou pendurada na janela');
    janela.onSave();
    await espera();
    assert.equal(esp.api[0].method + ' ' + esp.api[0].path, 'PUT /api/collaborators/C1');
    assert.deepEqual(JSON.parse(JSON.stringify(esp.api[0].body)), { roleId: 'R2', houseIds: ['H1'] });
  });

  test('a ligação permanente: criar guarda o URL no aparelho, na chave da conta; desativar esquece-o', async () => {
    esp.resposta = () => ({ url: 'https://app.rendorium.com/?ligar=' + 'b'.repeat(64) });
    app.CW.ligacaoCriar();
    await espera();
    assert.equal(esp.api[0].method + ' ' + esp.api[0].path, 'POST /api/share-link');
    assert.match(app.localStorage.getItem('gi_ligacao_url_EU'), /ligar=b{64}/);
    assert.equal(esp.modais[0].titulo, 'A minha ligação de partilha');
    app.CW.ligacaoCopiar();
    assert.ok(esp.toasts.includes('Ligação copiada.'));
    esp.resposta = () => ({});
    app.CW.ligacaoDesativar();
    await espera();
    assert.equal(esp.confirmados[0], 'Desativar a ligação');
    assert.equal(esp.api[1].method + ' ' + esp.api[1].path, 'DELETE /api/share-link');
    assert.equal(app.localStorage.getItem('gi_ligacao_url_EU'), null);
    assert.ok(esp.toasts.some((t) => t.startsWith('Ligação de partilha desativada — quem já pediu continua à espera da tua resposta.')));
  });

  test('os pedidos de partilha: aceitar, recusar e cancelar', async () => {
    app.CW.pedidoAceitar('p1');
    app.CW.pedidoRecusar('p1');
    app.CW.pedidoCancelar('p2');
    await espera();
    assert.deepEqual(esp.api.map((x) => x.method + ' ' + x.path),
      ['POST /api/share-requests/p1/accept', 'POST /api/share-requests/p1/reject', 'DELETE /api/share-requests/p2']);
    assert.match(esp.toasts[0], /^Partilha aceite: passas a comproprietário de T2 Porto, de Ana\./);
  });

  test('aceitar convite: POST /api/convite/:token/aceitar e o modal «Agora és colaborador de…»', async () => {
    const tok = 'c'.repeat(64);
    app.CW._convitePrev = { ownerName: 'Rui', roleName: 'Contabilista', perms: ['tx.add'], houses: [{ name: 'Do Rui' }] };
    esp.resposta = () => ({ ownerName: 'Rui', roleName: 'Contabilista', houses: [{ id: 'H2', name: 'Do Rui' }], saltadas: [] });
    app.CW.aceitarConvite(tok);
    await espera();
    assert.equal(esp.api[0].method + ' ' + esp.api[0].path, 'POST /api/convite/' + tok + '/aceitar');
    assert.equal(esp.modais[0].titulo, 'Agora és colaborador de Rui');
    assert.match(esp.modais[0].corpo, /Contabilista/);
    assert.match(esp.modais[0].corpo, /ver movimentos/);
    assert.match(esp.modais[0].rodape, /Ver os imóveis/);
  });

  test('pedir partilha: POST /api/ligar/:token/pedir {houseIds} e o toast com quem tem de aceitar', async () => {
    const tok = 'd'.repeat(64);
    app.CW._ligarPrev = { ownerName: 'Rui' };
    esp.resposta = () => ({ pedidos: 1, saltadas: [] });
    app.CW.pedirPartilha(tok, ['H1']);
    await espera();
    assert.equal(esp.api[0].method + ' ' + esp.api[0].path, 'POST /api/ligar/' + tok + '/pedir');
    assert.deepEqual(JSON.parse(JSON.stringify(esp.api[0].body)), { houseIds: ['H1'] });
    assert.deepEqual(esp.toasts, ['Pedido enviado — Rui tem de aceitar.']);
  });

  test('copiar diz «Ligação copiada.» mesmo sem clipboard', () => {
    app.CW.copiar('x');
    assert.deepEqual(esp.toasts, ['Ligação copiada.']);
  });
});

describe('os textos das permissões', () => {
  const { app } = montar();
  test('o resumo de um cargo lê-se', () => {
    assert.equal(app.resumoPerms(['tx.view', 'visit.add']), 'Vê movimentos · Adiciona visitas');
    assert.equal(app.resumoPerms(['house.edit']), 'Vê hipotecas, fotos e documentos · Edita a ficha do imóvel');
    assert.equal(app.resumoPerms([]), 'Sem permissões');
  });
  test('o fecho em array é o de acessos.js, pela ordem de PERMS — sem cópia local das implicações', () => {
    const meu = JSON.parse(JSON.stringify(app.permsFechadas(['contract.add'])));
    const deles = Array.from(app.fechoPerms(['contract.add']));
    assert.deepEqual([...meu].sort(), deles.sort());
    assert.deepEqual(meu, ['rec.view', 'rec.add', 'contract.view', 'contract.add'], 'na ordem canónica');
    assert.ok(!/IMPLICA_LOCAL|ROTULOS_LOCAL|CARGOS_LOCAL/.test(le('web/cloud/colaboradores.js')));
  });
  test('os cargos de exemplo vêm de acessos.js com nome, permissões e sub', () => {
    const cs = app.cargosExemplo();
    assert.equal(cs.length, 3);
    assert.equal(cs[1].nome, 'Contabilista');
    assert.ok(cs[1].perms.includes('report.view'));
  });
});

// A app montada com o estado de ESTADO() (ou o que a função mudar) na base e
// em CW.state, para desenhar as vistas.
// Recebe: muda (opcional) — função que recebe o estado e o altera antes de o usar.
// Devolve: a janela da app, pronta para vCloud() e vColaboradores().
function comEstado(muda) {
  const { app } = montar();
  const st = ESTADO();
  if (muda) muda(st);
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  app.CW._pulled = 1;   // como depois de um applyState: o que estiver vazio está mesmo vazio
  return app;
}

describe('antes do primeiro sync', () => {
  test('o separador não diz «ainda não tens» a quem só ainda não sincronizou', () => {
    const app = comEstado((st) => { st.roles = []; st.collaborators = []; st.invites = []; });
    app.CW._pulled = 0;   // arranque sem rede: o estado do servidor ainda não chegou
    const html = app.paginaDosColaboradores();
    assert.match(html, /<div class="espera" role="status"><span class="roda" aria-hidden="true"><\/span><p class="u-m-0"><b>À espera do servidor\.<\/b>/);
    assert.doesNotMatch(html, /Ainda não tens colaboradores/, 'não mente a quem pode ter');
    assert.match(html, /Colaboras com/, 'os imóveis onde colaboro vêm do aparelho e mostram-se na mesma');
    app.CW._pulled = 1;
    assert.match(app.paginaDosColaboradores(), /Ainda não tens colaboradores/, 'depois do sync, o vazio é verdade');
  });
});

describe('a página Conta e partilha', () => {
  test('vCloud fica só com a partilha entre proprietários', () => {
    const app = comEstado();
    const h = app.vCloud();
    for (const t of ['A minha conta', 'A minha ligação de partilha', 'Pedidos de partilha', 'Ana quer partilhar T2 Porto contigo',
      'Ligar a outro utilizador', 'Ainda não estás ligado a ninguém.', 'Pedidos chegados por aqui', 'CW.ligacaoRodar()',
      'Segurança', 'Apagar a conta']) {
      assert.ok(h.includes(t), 'a página tem: ' + t);
    }
    for (const t of ['Convidar colaborador', 'cw_inv_h_H1', 'Convites por usar', 'Novo cargo', 'O que cada colaborador pode fazer',
      'Mudar cargo ou imóveis', 'Imóveis onde colaboras', "CW.sairDeImovel('C9')",
      "go('colaboradores')", 'Colaboradores']) {
      assert.ok(!h.includes(t), 'os cartões dos colaboradores saíram daqui: ' + t);
    }
  });

  test('sem ligação e sem pedidos, o cartão oferece criar e o dos pedidos não aparece', () => {
    const app = comEstado((st) => { st.shareLink = null; st.shareRequests = { incoming: [], outgoing: [] }; });
    const h = app.vCloud();
    assert.ok(h.includes('CW.ligacaoCriar()'));
    assert.ok(!h.includes('Pedidos de partilha'));
  });
});

describe('o separador Colaboradores (o canvas de 2026-10, D-Colaboradores)', () => {
  test('a página traz «Convidar colaborador», quem colabora, os convites por usar, os cargos e onde colaboro, por esta ordem', () => {
    const app = comEstado();
    const h = app.paginaDosColaboradores();
    for (const t of ['sem quota-parte', 'CW.conviteModal()', 'Convidar colaborador', 'Quem colabora', 'Maria', 'Minha',
      "CW.mudarColaborador('C1')", "CW.removerColaborador('C1')", 'Convites por usar', 'Gestor de visitas · «para a Ana»',
      "CW.revogarConvite('abc123')", 'Cargos', 'CW.cargoModal()', "CW.cargoModal('R2')", 'Onde colaboras', 'Colaboras com', 'Do Rui',
      "CW.sairDeImovel('C9')"]) {
      assert.ok(h.includes(t), 'a página tem: ' + t);
    }
    // a página já não traz o formulário do convite: ele vive na janela (CW.conviteModal)
    assert.ok(!h.includes('cw_inv_h_'), 'sem as caixas do convite na página');
    const ordem = ['Convidar colaborador', '<h3>Quem colabora</h3>', '<h3>Convites por usar</h3>', '<h3>Cargos</h3>', 'Onde colaboras'].map((t) => h.indexOf(t));
    assert.ok(ordem.every((i) => i > -1), 'os cinco blocos estão lá: ' + ordem.join(', '));
    assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b), 'e por esta ordem');
    assert.ok(!/\son[a-z]+=|\sstyle=/.test(h), 'nada em linha');
  });

  test('cada cargo diz quantas pessoas o têm, o resumo, «Editar», e a tabela das permissões (Ver/Adicionar) — a do primeiro aberta, e o botão abre e fecha no sítio', () => {
    const app = comEstado((st) => { st.roles.push({ id: 'R3', name: 'Ver tudo', perms: ['report.view'], n: 0 }); });
    const h = app.paginaDosColaboradores();
    assert.match(h, /<b class="u-d-block">Gestor de visitas<\/b><span class="small">1 pessoa · 1 convite<\/span>/);
    assert.match(h, /role="table" aria-label="Permissões do cargo Gestor de visitas">/, 'a do primeiro aberta');
    assert.match(h, /role="table" aria-label="Permissões do cargo Ver tudo" hidden>/, 'as outras fechadas');
    assert.match(h, /<span role="cell">Visitas<\/span><span role="cell" class="colab-sim" aria-label="Ver: sim">/);
    assert.match(h, /<span role="cell">Movimentos<\/span><span role="cell" class="colab-nao" aria-label="Ver: não">/);
    assert.match(h, /<span role="cell">Hipotecas<\/span><span role="cell" class="colab-nao" aria-label="Ver: não"><span class="colab-traco"><\/span><\/span><span role="cell" class="colab-na" aria-label="Adicionar: não se aplica">/);
    assert.match(h, /<span role="cell">Ficha do imóvel<\/span><span role="cell" class="colab-na" aria-label="Ver: não se aplica"><\/span><span role="cell" class="colab-nao" aria-label="Editar: não">/);
    // o botão abre e fecha a tabela sem repintar
    const tabela = { hidden: true };
    const attrs = { 'aria-expanded': 'false', 'aria-controls': 'cgperm_1' };
    const botao = { dataset: { id: 'R3' }, getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
    app.document.getElementById = (id) => (id === 'cgperm_1' ? tabela : null);
    app.CW.cargoPermissoes(botao);
    assert.equal(tabela.hidden, false);
    assert.equal(attrs['aria-expanded'], 'true');
    assert.match(app.paginaDosColaboradores(), /aria-label="Permissões do cargo Ver tudo">/, 'e lembra-se na pintura seguinte');
    // com dois cargos, o primeiro à parte e os outros num bloco (o canvas: duas colunas num cartão largo)
    assert.match(h, /<section class="card colab-cartao colab-cargos-cartao">[\s\S]*?<div class="colab-cargos-dois"><div class="colab-cargo">[\s\S]*?Gestor de visitas[\s\S]*?<div class="colab-cargos-resto"><div class="colab-cargo">[\s\S]*?Ver tudo/);
    // com um só, não há segunda coluna a ficar vazia
    assert.doesNotMatch(comEstado().paginaDosColaboradores(), /colab-cargos-dois|colab-cargos-resto/);
  });

  test('os convites dizem quanto falta, em dias de calendário: âmbar com dias, vermelho no último', () => {
    // a meio do dia daqui a 5 dias são 5 dias de calendário, seja qual for a hora a que a bateria corre
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const meioDia = (n) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n, 12).getTime();
    const app = comEstado((st) => { st.invites[0].expiresAt = meioDia(5); st.invites.push({ id: 'ff', roleName: 'Contabilista', houses: [], expiresAt: Date.now() + 3600000 }); });
    const h = app.paginaDosColaboradores();
    assert.match(h, /<span class="badge amber">5 dias<\/span>/);
    assert.match(h, /<span class="badge red">Expira amanhã<\/span>|<span class="badge red">Expira hoje<\/span>/);
  });

  test('o selo conta dias de calendário, e não fatias de 24 horas a partir de agora', () => {
    const app = comEstado();
    const as = (d, h, m) => new Date(2026, 9, d, h, m).getTime();
    const agora = as(17, 22, 47);
    // acaba hoje às 23:59: era «Expira amanhã» (faltava 1 h 12 min, que o Math.ceil subia a 1 dia)
    assert.equal(app.seloDoConvite(as(17, 23, 59), agora), '<span class="badge red">Expira hoje</span>');
    // acaba amanhã às 23:00: era «2 dias»
    assert.equal(app.seloDoConvite(as(18, 23, 0), agora), '<span class="badge red">Expira amanhã</span>');
    assert.equal(app.seloDoConvite(as(19, 1, 0), agora), '<span class="badge amber">2 dias</span>');
    // de manhã cedo, sete dias depois à mesma hora (como o servidor os cria) são 7 dias
    assert.equal(app.seloDoConvite(as(24, 8, 0), as(17, 8, 0)), '<span class="badge amber">7 dias</span>');
    // a mudança da hora (25 de outubro de 2026) não rouba nem dá um dia
    assert.equal(app.seloDoConvite(as(27, 9, 0), as(24, 9, 0)), '<span class="badge amber">3 dias</span>');
    assert.equal(app.seloDoConvite(as(17, 20, 0), agora), '<span class="badge red">Expirou</span>');
    assert.equal(app.seloDoConvite(0, agora), '');
  });

  test('sem cargos, sem convites e sem colaboradores, o vazio convida a criar o primeiro cargo', () => {
    const app = comEstado((st) => { st.roles = []; st.collaborators = []; st.invites = []; });
    const h = app.paginaDosColaboradores();
    assert.ok(h.includes('Ainda não tens colaboradores'));
    assert.ok(h.includes('CW.cargoModal()'), 'com o botão de criar o cargo');
    assert.ok(!h.includes('Convidar colaborador'), 'sem cargo não há convite a fazer');
    // os imóveis onde sou eu o colaborador continuam à vista
    assert.ok(h.includes('Colaboras com') && h.includes('Do Rui'));
  });

  test('onde colaboro: «Colaboras com <dono>», o cargo, o que o cargo deixa e em que imóveis, e as finanças com o dono quando o cargo não as vê', () => {
    const app = comEstado();
    const h = app.colaboroCartao();
    assert.match(h, /<span class="small">Colaboras com<\/span><b class="u-d-block">Rui<\/b><\/span><span class="badge">Contabilista<\/span>/);
    assert.match(h, /em <b>Do Rui<\/b>\./);
    assert.ok(!h.includes('As finanças destes imóveis ficam com o dono'), 'o contabilista vê os movimentos');
    const app2 = comEstado((st) => { st.houses[1].collab = { id: 'C9', roleId: 'R1', roleName: 'Gestor de visitas', perms: ['visit.view', 'visit.add'] }; });
    assert.match(app2.colaboroCartao(), /As finanças destes imóveis ficam com o dono\./);
  });

  test('sem sessão iniciada, a página pede a conta; e o separador (vColabTab) é um ecrã das Pessoas, sem a cabeça das Definições', () => {
    const { app } = montar();
    app.CW.user = null;
    assert.match(app.paginaDosColaboradores(), /Iniciar sessão/);
    const t = app.vColabTab();
    assert.match(t, /Iniciar sessão/);
    assert.doesNotMatch(t, /def-voltar|go\('settings'\)/, 'sem o Voltar às Definições');
    assert.doesNotMatch(t, /<nav class="def-nav"/, 'e sem a navegação lateral delas');
  });
});

/* ---------------------------------------------- fichas com imóvel, donos e colaboradores por casa */

// O estado de ESTADO() mais: H3, onde sou «Gestor de visitas» (tenant.add);
// H4, em compropriedade com o Rui, com a lista de colaboradores na própria
// casa; um movimento meu pago pelo ZE, cuja conta já não existe.
const ESTADO_FICHAS = () => {
  const st = ESTADO();
  st.houses[0].collaborators = [{ id: 'C1', userId: 'MARIA', name: 'Maria', roleName: 'Gestor de visitas' }];
  st.houses.push(
    { id: 'H3', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI'], updatedAt: 1,
      collab: { id: 'C8', roleId: 'R3', roleName: 'Gestor de visitas', perms: ['visit.view', 'visit.add', 'tenant.view', 'tenant.add'] },
      data: { id: 'H3', name: 'Visitas do Rui' } },
    { id: 'H4', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU'], updatedAt: 1,
      collaborators: [{ id: 'C7', userId: 'JOAO', name: 'João', roleName: 'Contabilista' }],
      data: { id: 'H4', name: 'A meias' } },
  );
  st.records.push({ houseId: 'H1', kind: 'tx', id: 'T2', updatedAt: 5, author: 'EU', createdBy: 'EU',
    data: { id: 'T2', label: 'Condomínio', propertyId: 'H1', amount: 40, kind: 'expense', date: '2026-02-01', paidBy: 'ZE' } });
  st.profiles.push({ userId: 'ZE', name: '[deleted]', data: null }, { userId: 'JOAO', name: 'João', data: null });
  st.people.push({ id: 'ZE', name: '[deleted]', kind: 'owner' }, { id: 'JOAO', name: 'João', kind: 'collab', roleName: 'Contabilista' });
  return st;
};

describe('fichas de inquilino presas a um imóvel', () => {
  let app, d;
  beforeEach(() => {
    ({ app } = montar());
    d = app.rebuildDb(ESTADO_FICHAS());
    app.db = d;
  });

  test('a ficha vinda de um registo de casa leva houseId (na ficha) e _houseId (a marca)', () => {
    const p1 = d.tenants.find((t) => t.id === 'P1');
    assert.equal(p1.houseId, 'H2');
    assert.equal(p1._houseId, 'H2');
  });

  test('com houseId de um imóvel de colaboração a ficha sobe só como registo dessa casa (com tenant.add); presa a um imóvel meu também só como registo dele; a um apagado, como u:tenant', () => {
    const ficha = (id, houseId) => { const t = app.normPerson({ id, name: id }); if (houseId) t.houseId = houseId; return t; };
    app.db.tenants.push(ficha('TN', 'H3'));   // criada por mim (Gestor de visitas) a partir de uma visita, sem contrato
    app.db.tenants.push(ficha('TX', 'H2'));   // presa a um imóvel onde sou Contabilista (sem tenant.add)
    app.db.tenants.push(ficha('TM', 'H1'));   // presa a um imóvel meu, sem contrato
    app.db.tenants.push(ficha('TA', 'H9'));   // presa a um imóvel que já não existe (apagado; a ficha ficou)
    app.db.tenants.push(ficha('TU'));         // só minha
    const chaves = Object.keys(JSON.parse(JSON.stringify(app.exportEntities())));
    assert.ok(chaves.includes('r:H3:tenant:TN'), 'sobe para a casa do dono, sem contrato');
    assert.ok(!chaves.includes('u:tenant:TN'), 'e não fica privada de quem a criou');
    assert.ok(!chaves.includes('r:H2:tenant:TX') && !chaves.includes('u:tenant:TX'), 'sem tenant.add não sobe para lado nenhum');
    assert.ok(!chaves.includes('r:H2:tenant:P1') && !chaves.includes('u:tenant:P1'), 'a ficha do dono (sem tenant.add) não é minha');
    assert.ok(chaves.includes('r:H1:tenant:TM'), 'no imóvel meu é registo da casa (os comproprietários veem-na)');
    assert.ok(!chaves.includes('u:tenant:TM'), 'e só isso: uma ficha, uma chave (apagar o imóvel passa-a a u:tenant)');
    assert.ok(chaves.includes('u:tenant:TA'), 'a ficha de um imóvel apagado continua a ser minha');
    assert.ok(!chaves.some((k) => k.indexOf(':tenant:TA') > 0 && k[0] === 'r'), 'e não tem casa por onde subir');
    assert.ok(chaves.includes('u:tenant:TU'), 'sem imóvel continua a ser um registo meu');
    const dados = JSON.parse(JSON.stringify(app.exportEntities()['r:H3:tenant:TN'].data));
    assert.equal(dados.houseId, 'H3', 'o houseId vai na ficha');
    assert.ok(!('_houseId' in dados), 'a marca não');
  });
});

describe('db.owners e os colaboradores por casa', () => {
  let app, d;
  beforeEach(() => {
    ({ app } = montar());
    d = app.rebuildDb(ESTADO_FICHAS());
  });

  test('quem só é referido num movimento («[deleted]», ex-comproprietário) continua a virar ficha; o colaborador puro não', () => {
    const ids = JSON.parse(JSON.stringify(d.owners.map((o) => o.id).sort()));
    assert.deepEqual(ids, ['ANA', 'EU', 'RUI', 'ZE']);
    const ze = d.owners.find((o) => o.id === 'ZE');
    assert.equal(ze.name, '[deleted]');
    assert.equal(ze._userId, 'ZE');
    assert.ok(!d.owners.some((o) => o.id === 'MARIA' || o.id === 'JOAO'), 'os colaboradores ficam em CW.pessoas');
    assert.equal(app.CW.pessoas.JOAO.kind, 'collab');
  });

  test('um colaborador referido em «pago por» ou num acerto (o ex-comproprietário que hoje só colabora) ganha ficha só com o nome; o não referido não', () => {
    const st = ESTADO_FICHAS();
    st.records.push({ houseId: 'H4', kind: 'tx', id: 'T3', updatedAt: 5, author: 'RUI', createdBy: 'RUI',
      data: { id: 'T3', label: 'Condomínio', propertyId: 'H4', amount: 60, kind: 'expense', date: '2026-03-01', paidBy: 'JOAO' } });
    const d2 = app.rebuildDb(st);
    const joao = d2.owners.find((o) => o.id === 'JOAO');
    assert.ok(joao, 'o João pagou o condomínio: tem ficha, para o «Pago por» e os acertos');
    assert.equal(joao.name, 'João');
    assert.equal(joao._userId, 'JOAO');
    assert.ok(!d2.owners.some((o) => o.id === 'MARIA'), 'a Maria não é referida em movimento nenhum: fica só em CW.pessoas');
    assert.equal(app.CW.pessoas.JOAO.kind, 'collab', 'e o João continua colaborador em CW.pessoas');
    assert.ok(!d2.properties.some((p) => (p.ownerIds || []).indexOf('JOAO') > -1), 'sem nunca entrar em ownerIds');
    // o nome vem de CW.pessoas quando o perfil não o traz
    st.profiles.find((p) => p.userId === 'JOAO').name = '';
    assert.equal(app.rebuildDb(st).owners.find((o) => o.id === 'JOAO').name, 'João');
    // por toId também, num acerto meu sem imóvel
    const st2 = ESTADO_FICHAS();
    st2.userRecords.push({ kind: 'tx', id: 'T4', data: { id: 'T4', kind: 'settle', label: 'Acerto', amount: 10, date: '2026-03-02', paidBy: 'EU', toId: 'MARIA' } });
    assert.ok(app.rebuildDb(st2).owners.some((o) => o.id === 'MARIA'));
  });

  test('_colaboradores lê h.collaborators por casa — também na compropriedade; sem o campo, a lista global do dono', () => {
    const h4 = d.properties.find((p) => p.id === 'H4');
    assert.deepEqual(JSON.parse(JSON.stringify(h4._colaboradores)),
      [{ id: 'C7', userId: 'JOAO', name: 'João', roleId: '', roleName: 'Contabilista' }]);
    const h1 = d.properties.find((p) => p.id === 'H1');
    assert.equal(h1._colaboradores.length, 1);
    assert.equal(h1._colaboradores[0].userId, 'MARIA');
    assert.equal(d.properties.find((p) => p.id === 'H3')._colaboradores, undefined, 'onde sou colaborador não há lista');
    // um servidor que ainda não manda a lista por casa: vale a global, só nas minhas
    const st = ESTADO_FICHAS();
    delete st.houses[0].collaborators; delete st.houses[3].collaborators;
    const d2 = app.rebuildDb(st);
    assert.equal(d2.properties.find((p) => p.id === 'H1')._colaboradores[0].id, 'C1');
    assert.deepEqual(JSON.parse(JSON.stringify(d2.properties.find((p) => p.id === 'H4')._colaboradores)), []);
  });
});

describe('aceitar um convite que já não serve', () => {
  const armar = () => {
    const { app, esp } = montar();
    const m = new Map();
    app.sessionStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
    app.sessionStorage.setItem('gi_convite', 'c'.repeat(64));
    app.CW._convitePrev = { ownerName: 'Eu', roleName: 'Contabilista', perms: [], houses: [] };
    esp.fechados = 0;
    app.closeAllModals = () => { esp.fechados++; };
    return { app, esp };
  };

  test('um 400 («A ligação é tua…») fecha o modal antes do toast e esquece o token', async () => {
    const { app, esp } = armar();
    esp.resposta = () => Object.assign(new Error('A ligação é tua — envia-a a quem vai colaborar.'), { status: 400 });
    app.CW.aceitarConvite('c'.repeat(64));
    await espera();
    assert.equal(esp.fechados, 1, 'o modal «Convite de …» fechou');
    assert.equal(app.sessionStorage.getItem('gi_convite'), null);
    assert.equal(app.CW._convitePrev, null);
    assert.deepEqual(esp.toasts, ['A ligação é tua — envia-a a quem vai colaborar.']);
    assert.equal(esp.modais.length, 0);
  });

  test('um erro passageiro (500) deixa o modal e o token, para se tentar outra vez', async () => {
    const { app, esp } = armar();
    esp.resposta = () => Object.assign(new Error('Erro 500'), { status: 500 });
    app.CW.aceitarConvite('c'.repeat(64));
    await espera();
    assert.equal(esp.fechados, 0);
    assert.equal(app.sessionStorage.getItem('gi_convite'), 'c'.repeat(64));
    assert.ok(app.CW._convitePrev);
    assert.deepEqual(esp.toasts, ['Erro 500']);
  });
});
