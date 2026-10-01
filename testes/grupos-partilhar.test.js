// Partilhar um grupo que já existe, com o botão sempre à vista, e os
// formulários das Definições e dos grupos pela regra do asterisco, do
// «Opcional» e do «Ex: ». O «Partilhar» está em todos os grupos de imóveis
// privados sempre que a nuvem dos grupos está carregada — com sessão ou sem
// ela, com o serviço Colaboradores ligado ou não, com imóveis meus ou sem
// eles —, e o toque explica cada caso que não dá: sem sessão, o ecrã de
// entrada com o porquê; com o serviço desligado, a frase do serviço; um
// grupo vazio, ou só com imóveis de outras pessoas, a janela que o diz e
// leva à edição do grupo. Com imóveis meus, a confirmação de sempre; e se o
// servidor recusar a meio, o grupo criado lá apaga-se e o privado fica.
// A nuvem corre por cima da app do arnês, com a api, o pullNow, o toast, as
// confirmações, o ecrã de entrada e as janelas trocados por espiões.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { carregarApp, limpar } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';
import { conferir, EX } from './lib/formularios.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const le = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');
const espera = () => new Promise((r) => setTimeout(r, 5));
const cru = (x) => JSON.parse(JSON.stringify(x));

/* A app com a nuvem por cima e os espiões: esp.api as chamadas (esp.resposta
   decide o que devolvem; um Error rejeita), esp.toasts, esp.confirmados
   (aceites na hora), esp.entradas o ecrã de entrada (a frase e se é nota),
   as janelas numa pilha observável (esp.abertas) e esp.puxou as leituras.
   Devolve: {app, esp}. */
function montar() {
  const nova = carregarApp({ antes: (janela) => { janela.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }; } });
  nova.document.documentElement.style.removeProperty = () => {};
  const ctx = nova.__ctx;
  const carregar = (nome) => vm.runInContext(le('web/cloud/' + nome + '.js'), ctx, { filename: 'cloud/' + nome + '.js' });
  const esp = { api: [], toasts: [], confirmados: [], entradas: [], resposta: null, puxou: 0 };
  carregar('nucleo');
  nova.api = (method, p, body) => {
    esp.api.push({ method, path: p, body: body === undefined ? undefined : cru(body) });
    const r = esp.resposta ? esp.resposta(method, p, body) : {};
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  };
  for (const nome of ['utilizadores', 'partilha', 'colaboradores', 'grupos', 'ajuda', 'entrada']) carregar(nome);
  nova.toast = (m) => { esp.toasts.push(m); };
  esp.abertas = janelasFalsas(nova, 'render', 'setSyncBadge', 'subirPendentes', 'save', 'scheduleReminders', 'buildNav', 'schedulePush');
  nova.confirmModal = (t, txt, cb) => { esp.confirmados.push({ t, txt }); cb(); };
  nova.showAuth = (msg, nota) => { esp.entradas.push({ msg, nota }); };
  nova.pullNow = () => { esp.puxou++; return Promise.resolve(); };
  nova.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
  nova.CW._pulled = 1; nova.CW._esperaFim = 1;
  esp.chamadas = () => esp.api.map((x) => x.method + ' ' + x.path);
  return { app: nova, esp };
}

/* O estado: a Minha (H1) é minha; a Do Rui (H2) é dele, partilhada comigo
   por uma ligação (sou comproprietário, não a criei); a Casa da Ana (H4) é
   dela, e eu colaboro nela. Os grupos privados: GP «Lisboa» com a Minha e a
   Do Rui; GR «Dos outros» com a Do Rui e a Casa da Ana; GV «Vazio», sem
   imóveis; GX «Apagado», só com um imóvel que já não existe; GO, de
   proprietários. E o G2 «Família», já partilhado, meu. */
const ESTADO = () => ({
  me: { id: 'EU' },
  houses: [
    { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1, data: { id: 'H1', name: 'Minha' } },
    { id: 'H2', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU'], updatedAt: 1, data: { id: 'H2', name: 'Do Rui' } },
    { id: 'H4', ownerId: 'ANA', ownerName: 'Ana', mine: false, participants: ['ANA'], updatedAt: 1,
      collab: { roleId: 'R1', roleName: 'Gestor', perms: ['tx.view'] }, data: { id: 'H4', name: 'Casa da Ana' } },
  ],
  records: [],
  userRecords: [
    { kind: 'group', id: 'GP', updatedAt: 1, data: { id: 'GP', kind: 'prop', name: 'Lisboa', ids: ['H1', 'H2'] } },
    { kind: 'group', id: 'GR', updatedAt: 1, data: { id: 'GR', kind: 'prop', name: 'Dos outros', ids: ['H2', 'H4'] } },
    { kind: 'group', id: 'GV', updatedAt: 1, data: { id: 'GV', kind: 'prop', name: 'Vazio', ids: [] } },
    { kind: 'group', id: 'GX', updatedAt: 1, data: { id: 'GX', kind: 'prop', name: 'Apagado', ids: ['HX'] } },
    { kind: 'group', id: 'GO', updatedAt: 1, data: { id: 'GO', kind: 'owner', name: 'Donos', ids: ['EU'] } },
  ],
  profiles: [{ userId: 'RUI', name: 'Rui', data: null }, { userId: 'ANA', name: 'Ana', data: null }],
  connections: [], roles: [], collaborators: [], invites: [], people: [],
  shareLink: null, shareRequests: { incoming: [], outgoing: [] },
  sharedGroupRequests: { incoming: [], outgoing: [] },
  sharedGroups: [
    { id: 'G2', name: 'Família', ownerId: 'EU', ownerName: 'Eu', mine: true,
      members: [{ id: 'EU', name: 'Eu' }], houses: [{ id: 'H1', name: 'Minha', ownerId: 'EU' }], link: null, pedidos: [] },
  ],
});

// A app montada com o estado na base e em CW.state.
// Devolve: {app, esp}.
function comEstado() {
  const { app, esp } = montar();
  const st = ESTADO();
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  esp.api.length = 0;
  return { app, esp };
}

// Os ids dos grupos com «Partilhar» no HTML, pela ordem.
// Recebe: h — o HTML.
// Devolve: array de ids.
const comBotao = (h) => (h.match(/CW\.grupoPartilhar\('([^']+)'\)/g) || []).map((x) => x.slice(19, -2));

// O rodapé que leva à edição do grupo, nas janelas que explicam.
// Recebe: id — o id do grupo.
// Devolve: o pedaço do HTML esperado.
const editar = (id) => 'data-click="closeAllModals();groupModal(\'prop\',\'' + id + '\')">Editar o grupo</button>';

describe('o «Partilhar» está sempre à vista', () => {
  test('em cada grupo de imóveis privado — com imóveis meus, só dos outros, vazio, com um imóvel apagado —, e não nos partilhados nem no de proprietários', () => {
    const { app } = comEstado();
    const h = app.vGrupos();
    assert.deepEqual(comBotao(h), ['GP', 'GR', 'GV', 'GX']);
    assert.ok(!h.includes("CW.grupoPartilhar('G2')") && !h.includes("CW.grupoPartilhar('GO')"));
    assert.match(h, /data-click="event\.stopPropagation\(\);CW\.grupoPartilhar\('GR'\)">[\s\S]*? Partilhar<\/button>/, 'trava o toque, para não abrir também a edição');
  });

  test('sem sessão e com os Colaboradores desligados o botão fica (o cartão dos partilhados é que sai); sem a nuvem não há botão', () => {
    const { app } = comEstado();
    app.definirServicosDesligados(['colaboradores']);
    const desligado = app.vGrupos();
    assert.deepEqual(comBotao(desligado), ['GP', 'GR', 'GV', 'GX'], 'serviço desligado');
    assert.ok(!desligado.includes('Grupos partilhados'), 'sem o cartão');
    app.definirServicosDesligados([]);
    app.CW.user = null;
    const semSessao = app.vGrupos();
    assert.deepEqual(comBotao(semSessao), ['GP', 'GR', 'GV', 'GX'], 'sem sessão');
    assert.match(semSessao, /«Partilhar» passa um grupo de imóveis a partilhado/, 'a nota diz o que é');
    const base = carregarApp();
    base.db.groups.push(base.normGroup({ id: 'B1', kind: 'prop', name: 'Lisboa', ids: [] }));
    assert.ok(!base.vGrupos().includes('grupoPartilhar'), 'a base sozinha não tem quem atenda o toque');
  });

  test('a janela de edição de cada grupo de imóveis privado guardado tem «Partilhar este grupo» no corpo e no ⋯; um grupo novo e o de proprietários não', () => {
    const { app, esp } = comEstado();
    app.CW.user = null;
    for (const id of ['GP', 'GR', 'GV']) app.groupModal('prop', id);
    esp.abertas.forEach((j, i) => {
      const id = ['GP', 'GR', 'GV'][i];
      assert.ok(j.b.includes("data-click=\"CW.grupoPartilhar('" + id + "')\""), id + ': no corpo');
      assert.ok(j.m.includes("CW.grupoPartilhar('" + id + "')"), id + ': no ⋯');
    });
    app.groupModal('prop');
    app.groupModal('owner', 'GO');
    assert.ok(!esp.abertas[3].b.includes('grupoPartilhar') && !esp.abertas[4].b.includes('grupoPartilhar'));
  });

  test('«Partilhar um grupo que já tens» aparece com qualquer grupo de imóveis privado e lista-os todos, a dizer quantos imóveis são meus', () => {
    const { app, esp } = comEstado();
    app.db.groups = app.db.groups.filter((g) => g.id === 'GV' || g._partilhado);
    assert.match(app.gruposCard(), /CW\.grupoEscolherParaPartilhar\(\)/, 'só com o grupo vazio, já aparece');
    const { app: outra, esp: e2 } = comEstado();
    outra.CW.grupoEscolherParaPartilhar();
    const j = e2.abertas[0];
    assert.equal(j.t, 'Partilhar um grupo que já tens');
    for (const [nome, sub] of [['Lisboa', '1 imóvel teu · 1 de outra pessoa fica de fora'], ['Dos outros', 'Nenhum imóvel teu · 2 de outras pessoas'],
      ['Vazio', 'Ainda sem imóveis'], ['Apagado', 'Ainda sem imóveis']]) {
      assert.match(j.b, new RegExp('<b class="u-d-block u-fs-14px">' + nome + '</b>\\s*<span class="small">' + sub + '</span>'), nome);
    }
    assert.ok(!j.b.includes('Família'), 'os partilhados não');
    assert.deepEqual(esp.toasts, []);
  });
});

describe('o toque explica cada caso que não dá', () => {
  test('sem sessão: o ecrã de entrada com o porquê, e nada vai ao servidor', async () => {
    const { app, esp } = comEstado();
    app.CW.user = null;
    app.CW.grupoPartilhar('GP');
    await espera();
    assert.equal(esp.entradas.length, 1);
    assert.match(esp.entradas[0].msg, /^Para partilhar o grupo «Lisboa», entra na tua conta/);
    assert.equal(esp.entradas[0].nota, true, 'uma nota, não um erro');
    assert.deepEqual(esp.api, []);
    assert.deepEqual(esp.confirmados, []);
  });

  test('com os Colaboradores desligados: a frase do serviço, com quem o liga', async () => {
    const { app, esp } = comEstado();
    app.definirServicosDesligados(['colaboradores']);
    app.CW.grupoPartilhar('GP');
    await espera();
    assert.equal(esp.toasts[0], app.fraseServicoDesligado('colaboradores'));
    assert.match(esp.toasts[0], /Colaboradores está desligado nesta conta\. O suporte pode ligá-lo/);
    assert.deepEqual(esp.api, []);
    assert.deepEqual(esp.confirmados, []);
  });

  test('um grupo vazio (ou só com um imóvel que já não existe): a janela «Este grupo ainda não tem imóveis», com «Editar o grupo»', async () => {
    for (const id of ['GV', 'GX']) {
      const { app, esp } = comEstado();
      app.CW.grupoPartilhar(id);
      await espera();
      const j = esp.abertas[0];
      assert.equal(j.t, 'Este grupo ainda não tem imóveis', id);
      assert.match(j.b, /junta-lhe pelo menos um em «Editar o grupo» e volta a tocar em «Partilhar»/);
      assert.ok(j.f.includes(editar(id)), id + ': leva à edição');
      assert.ok(j.f.includes('data-click="closeModal()">Fechar</button>'));
      assert.deepEqual(esp.api, [], id + ': nada vai ao servidor');
      assert.deepEqual(esp.confirmados, []);
    }
  });

  test('um grupo só com imóveis de outras pessoas: a janela diz de quem é cada um e porque não entram, com «Editar o grupo»', async () => {
    const { app, esp } = comEstado();
    app.CW.grupoPartilhar('GR');
    await espera();
    const j = esp.abertas[0];
    assert.equal(j.t, 'Estes imóveis não são teus');
    assert.match(j.b, /<b>Do Rui<\/b> é de Rui\. <b>Casa da Ana<\/b> é de Ana\./, 'de quem é cada um');
    assert.match(j.b, /Num grupo partilhado cada pessoa só põe imóveis seus/, 'porque não entram');
    assert.match(j.b, /o grupo <b>«Dos outros»<\/b> ficava vazio/);
    assert.match(j.b, /pede a quem é dono deles que crie o grupo partilhado/, 'dois donos: sem nome');
    assert.ok(j.f.includes(editar('GR')));
    assert.deepEqual(esp.api, []);
    // com um dono só, o nome dele
    app.db.groups.find((g) => g.id === 'GR').ids = ['H2'];
    app.CW.grupoPartilhar('GR');
    assert.equal(esp.abertas[1].t, 'Este imóvel não é teu');
    assert.match(esp.abertas[1].b, /pede a Rui que crie o grupo partilhado/);
    // e «Editar o grupo» abre mesmo a edição dele
    app.closeAllModals();
    app.groupModal('prop', 'GR');
    assert.equal(esp.abertas[2].t, 'Editar grupo');
  });

  test('com imóveis meus e de outros: a confirmação diz quais saem, e partilha com o mesmo id só com os meus', async () => {
    const { app, esp } = comEstado();
    esp.resposta = (m, p) => (p.endsWith('/link') ? { url: 'https://teste.local/?grupo=' + 'c'.repeat(64), expiresAt: 4102444800000 } : {});
    app.CW.grupoPartilhar('GP');
    await espera();
    assert.equal(esp.confirmados[0].t, 'Partilhar este grupo');
    assert.match(esp.confirmados[0].txt, /Só os imóveis teus entram: <b>Do Rui<\/b> sai do grupo\./);
    assert.deepEqual(esp.chamadas(), ['PUT /api/shared-groups/GP', 'PUT /api/shared-groups/GP/houses', 'POST /api/shared-groups/GP/link']);
    assert.deepEqual(esp.api[1].body, { houseIds: ['H1'] });
    assert.equal(app.db.groups.find((g) => g.id === 'GP')._partilhado, true);
  });

  test('se o servidor recusar as casas a meio, o grupo criado lá apaga-se, o toast diz que continua privado, e o «Partilhar» fica', async () => {
    const { app, esp } = comEstado();
    esp.resposta = (m, p) => (m === 'PUT' && p.endsWith('/houses') ? Object.assign(new Error('Só podes pôr no grupo imóveis teus.'), { status: 403 }) : {});
    app.CW.grupoPartilhar('GP');
    await espera();
    assert.deepEqual(esp.chamadas(), ['PUT /api/shared-groups/GP', 'PUT /api/shared-groups/GP/houses', 'DELETE /api/shared-groups/GP']);
    assert.equal(esp.toasts[esp.toasts.length - 1], 'Só podes pôr no grupo imóveis teus. O grupo continua privado.');
    const g = app.db.groups.find((x) => x.id === 'GP');
    assert.ok(!g._partilhado, 'o privado fica como estava');
    assert.ok(app.vGrupos().includes("CW.grupoPartilhar('GP')"));
    // a falha logo no PUT {name} não criou nada: nada a apagar
    const { app: outra, esp: e2 } = comEstado();
    e2.resposta = () => Object.assign(new Error('Sem ligação.'), { status: 0 });
    outra.CW.grupoPartilhar('GP');
    await espera();
    assert.deepEqual(e2.chamadas(), ['PUT /api/shared-groups/GP']);
    assert.equal(e2.toasts[0], 'Sem ligação.');
  });

  test('um grupo que não existe, ou que não é de imóveis, diz porquê em vez de não fazer nada', () => {
    const { app, esp } = comEstado();
    app.CW.grupoPartilhar('NAO');
    app.CW.grupoPartilhar('GO');
    assert.deepEqual(esp.toasts, ['Esse grupo já não está na lista.', 'Só os grupos de imóveis se partilham.']);
    app.CW.grupoPartilhar('G2');
    assert.equal(esp.abertas[0].t, 'Família', 'um partilhado abre a janela dele');
  });
});

describe('os formulários das Definições e dos grupos', () => {
  test('grupo: o nome é obrigatório, com o asterisco e o exemplo do tipo; os membros também levam o asterisco', () => {
    const { app, esp } = comEstado();
    app.groupModal('prop', 'GP');
    app.groupModal('owner');
    app.groupModal('contract');
    const exemplos = ['Casas de Lisboa', 'Família', 'Contratos T2'];
    esp.abertas.forEach((j, i) => {
      const cs = conferir('grupo ' + i, j.b, { obrigatorios: ['g_name'] });
      assert.equal(cs.find((c) => c.id === 'g_name').placeholder, EX + exemplos[i]);
      assert.match(j.b, /Nome do grupo <span class="req">\*<\/span><input id="g_name"/);
      assert.match(j.b, /<div class="flabel">(Imóveis|Proprietários|Contratos) no grupo <span class="req">\*<\/span><\/div>/, 'o guardar recusa um grupo sem membros');
    });
  });

  test('filtro comum: o nome é obrigatório com «Ex: »; as escolhas e as datas não levam asterisco nem placeholder', () => {
    const { app, esp } = comEstado();
    app.fcModal();
    const cs = conferir('filtro comum', esp.abertas[0].b, { obrigatorios: ['fc_name'] });
    assert.equal(cs.find((c) => c.id === 'fc_name').placeholder, EX + 'T2 Lisboa · rendas');
    assert.deepEqual(cs.filter((c) => c.type === 'date').map((c) => [c.id, c.placeholder, c.obrig]), [['fc_de', '', false], ['fc_ate', '', false]]);
    assert.equal((esp.abertas[0].b.match(/class="req"/g) || []).length, 1, 'só o nome');
  });

  test('valores por omissão: nenhum recusa o vazio — todos «Opcional», e as notas dizem o que vale em branco', () => {
    const { app } = comEstado();
    const h = app.vDefaults();
    const cs = conferir('valores por omissão', h, { obrigatorios: [] });
    assert.deepEqual(cs.map((c) => c.id), ['def_growth', 'def_inflation', 'def_years', 'def_capTarget', 'def_stamp']);
    assert.match(h, /Em branco, o aumento e a inflação contam 0 % e o horizonte 1 ano/);
    assert.match(h, /em branco volta aos 5 %/);
    assert.match(h, /em branco conta 0 %/);
    assert.ok(!h.includes('class="req"'));
  });

  test('os promptModal (categoria, subcategoria, etiqueta, grupo partilhado): o campo leva o asterisco e um exemplo com «Ex: »', () => {
    const { app, esp } = comEstado();
    app.addCat('cats'); app.addCat('catsIn'); app.addSub('cats', 'Obras'); app.renameSub('cats', 'Obras', 'Pintura'); app.addTag();
    app.CW.grupoNovo(); app.CW.grupoRenomear('G2');
    const esperado = [['Nova categoria', 'Jardim e piscina'], ['Nova categoria', 'Alojamento local'], ['Nova subcategoria', 'Canalização'],
      ['Mudar o nome da subcategoria', 'Canalização'], ['Nova etiqueta', 'Obras de 2026'], ['Novo grupo partilhado', 'Casas de Lisboa'], ['Mudar o nome', 'Casas de Lisboa']];
    assert.equal(esp.abertas.length, esperado.length);
    esp.abertas.forEach((j, i) => {
      assert.equal(j.t, esperado[i][0]);
      const cs = conferir(j.t, j.b, { obrigatorios: ['pm_v'] });
      assert.equal(cs[0].placeholder, EX + esperado[i][1], j.t);
      assert.match(cs[0].rotulo, /^Nome( d[ao] (categoria|subcategoria|etiqueta|grupo))$/, 'o rótulo diz o nome de quê: ' + cs[0].rotulo);
    });
    assert.match(esp.abertas[3].b, /value="Pintura"/, 'mudar o nome traz o atual');
  });

  test('tipos de movimento e IRS: o nome de cada categoria diz o que é e mostra um exemplo apagado; o IRS só tem escolhas, sem asterisco', () => {
    const base = carregarApp();
    limpar(base);
    const h = base.vCats();
    const cs = conferir('tipos de movimento', h, { obrigatorios: [], deixados: ['catn_'] });
    assert.ok(cs.length > 4 && cs.every((c) => /^catn_(cats|catsIn)_\d+$/.test(c.id)), 'só os nomes das categorias');
    assert.ok(cs.every((c) => c.placeholder.startsWith(EX)));
    assert.equal((h.match(/aria-label="Nome da categoria"/g) || []).length, cs.length);
    const irs = base.vIrsMapa();
    assert.ok(!/placeholder=|class="req"/.test(irs));
  });
});
