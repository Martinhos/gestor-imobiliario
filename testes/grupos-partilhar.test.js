// Partilhar um grupo que já existe, com o botão sempre à vista, e os
// formulários das Definições e dos grupos pela regra do asterisco, do
// «Opcional» e do «Ex: ». O «Partilhar» está em todos os grupos de imóveis
// privados sempre que a nuvem dos grupos está carregada — com sessão ou sem
// ela, com o serviço Colaboradores ligado ou não, com imóveis meus ou sem
// eles —, e o toque explica cada caso que não dá: sem sessão, o ecrã de
// entrada com o porquê; com o serviço desligado, a frase do serviço; um
// grupo vazio, ou só com imóveis de outras pessoas, a janela que o diz e
// leva à edição do grupo. Com imóveis meus, a confirmação de sempre; e se o
// servidor recusar a meio, o grupo criado lá apaga-se e o privado fica. E
// partilhar a avaliação: a cópia recusada pelo browser diz que falhou.
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
    assert.match(h, /<h3>Dos outros<\/h3>[\s\S]*?data-click="groupModal\('prop','GR'\)">[\s\S]*? Editar<\/button>\s*<button type="button" class="btn sm" data-toca="camada" data-click="CW\.grupoPartilhar\('GR'\)">[\s\S]*? Partilhar<\/button>/, 'ao lado de «Editar», cada um no seu botão');
    assert.match(h, /<h3>Apagado<\/h3><span class="badge grey">Privado<\/span><\/div>\s*<p class="small">Sem membros · 1 apagado<\/p>/, 'o imóvel que já não existe diz-se');
  });

  test('sem sessão e com os Colaboradores desligados o botão fica («Novo grupo partilhado» é que sai); sem a nuvem não há botão', () => {
    const { app } = comEstado();
    app.definirServicosDesligados(['colaboradores']);
    const desligado = app.vGrupos();
    assert.deepEqual(comBotao(desligado), ['GP', 'GR', 'GV', 'GX'], 'serviço desligado');
    assert.ok(!desligado.includes('CW.grupoNovo()'), 'sem «Novo grupo partilhado»');
    app.definirServicosDesligados([]);
    app.CW.user = null;
    const semSessao = app.vGrupos();
    assert.deepEqual(comBotao(semSessao), ['GP', 'GR', 'GV', 'GX'], 'sem sessão');
    assert.match(semSessao, /Partilhar um grupo é para sempre: não volta a ser privado\./, 'a nota diz o que é');
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

  /* «Partilhar um grupo que já tens» (a lista de todos os privados) saiu com
     o canvas de 2026-10: cada grupo tem o «Partilhar» no próprio cartão, que
     é a porta que o Martinho procurava. */
  test('«Partilhar um grupo que já tens» saiu: cada grupo de imóveis privado tem o seu «Partilhar», e um grupo só vazio também', () => {
    const { app } = comEstado();
    assert.equal(app.CW.grupoEscolherParaPartilhar, undefined);
    app.db.groups = app.db.groups.filter((g) => g.id === 'GV' || g._partilhado);
    assert.deepEqual(comBotao(app.vGrupos()), ['GV'], 'só com o grupo vazio, o botão está lá');
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
    assert.match(j.b, /Num grupo partilhado cada pessoa só adiciona imóveis seus/, 'porque não entram');
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
    esp.resposta = (m, p) => (p.endsWith('/partilhar') ? { ok: true, url: 'https://teste.local/?grupo=' + 'c'.repeat(64), expiresAt: 4102444800000 } : {});
    app.CW.grupoPartilhar('GP');
    await espera();
    assert.equal(esp.confirmados[0].t, 'Partilhar este grupo');
    assert.match(esp.confirmados[0].txt, /Só os imóveis teus entram: <b>Do Rui<\/b> sai do grupo\./);
    assert.deepEqual(esp.chamadas(), ['POST /api/shared-groups/GP/partilhar'], 'um pedido só');
    assert.deepEqual(esp.api[0].body, { name: 'Lisboa', houseIds: ['H1'] });
    assert.equal(app.db.groups.find((g) => g.id === 'GP')._partilhado, true);
  });

  test('um segundo toque enquanto a partilha não respondeu não começa outra; acabada, o grupo já é partilhado', async () => {
    const { app, esp } = comEstado();
    let responder;
    esp.resposta = () => new Promise((ok) => { responder = ok; });
    app.CW.grupoPartilhar('GP');
    app.CW.grupoPartilhar('GP');
    app.CW.grupoPartilhar('GP');
    assert.deepEqual(esp.chamadas(), ['POST /api/shared-groups/GP/partilhar'], 'um pedido, por mais toques');
    assert.equal(esp.confirmados.length, 1, 'e uma confirmação');
    assert.deepEqual(esp.toasts, ['Já estou a partilhar este grupo — a ligação aparece num instante.', 'Já estou a partilhar este grupo — a ligação aparece num instante.']);
    responder({ ok: true, url: 'https://teste.local/?grupo=' + 'd'.repeat(64), expiresAt: 4102444800000 });
    await espera();
    assert.equal(app.db.groups.find((g) => g.id === 'GP')._partilhado, true);
    // partilhado, o toque seguinte abre a janela do grupo em vez de partilhar outra vez
    esp.api.length = 0;
    app.CW.grupoPartilhar('GP');
    assert.deepEqual(esp.chamadas(), []);
  });

  test('se o servidor recusar, a janela de espera fecha, o toast diz porquê e que o grupo continua privado, e o «Partilhar» fica — sem nada a apagar', async () => {
    const { app, esp } = comEstado();
    esp.resposta = () => Object.assign(new Error('Só podes adicionar ao grupo imóveis teus.'), { status: 403 });
    app.CW.grupoPartilhar('GP');
    assert.equal(app.modalStack.length, 1, 'a janela de espera abriu');
    await espera();
    assert.deepEqual(esp.chamadas(), ['POST /api/shared-groups/GP/partilhar'], 'o servidor não deixou nada: nada a apagar');
    assert.equal(app.modalStack.length, 0, 'a janela de espera fechou');
    assert.equal(esp.toasts[esp.toasts.length - 1], 'Só podes adicionar ao grupo imóveis teus. O grupo continua privado.');
    const g = app.db.groups.find((x) => x.id === 'GP');
    assert.ok(!g._partilhado, 'o privado fica como estava');
    assert.ok(app.vGrupos().includes("CW.grupoPartilhar('GP')"));
    // e pode tentar-se outra vez
    esp.api.length = 0;
    app.CW.grupoPartilhar('GP');
    assert.deepEqual(esp.chamadas(), ['POST /api/shared-groups/GP/partilhar']);
  });

  test('um 409 (outro toque ou outro aparelho partilhou primeiro): diz que já estava partilhado, sincroniza e abre a janela do grupo', async () => {
    const { app, esp } = comEstado();
    esp.resposta = () => Object.assign(new Error('Este grupo já está partilhado.'), { status: 409 });
    let abriu = '';
    app.CW.grupoModal = (id) => { abriu = id; };
    app.CW.grupoPartilhar('GP');
    await espera();
    assert.ok(esp.toasts.includes('Este grupo já estava partilhado.'), esp.toasts.join(' | '));
    assert.equal(esp.puxou, 1);
    assert.equal(abriu, 'GP');
  });

  test('fechar a janela de espera não cancela: a partilha acaba, a ligação fica guardada, e o toast diz onde a achar', async () => {
    const { app, esp } = comEstado();
    let responder;
    esp.resposta = () => new Promise((ok) => { responder = ok; });
    app.CW.grupoPartilhar('GP');
    app.closeModal();
    responder({ ok: true, url: 'https://teste.local/?grupo=' + 'e'.repeat(64), expiresAt: 4102444800000 });
    await espera();
    assert.equal(app.db.groups.find((g) => g.id === 'GP')._partilhado, true);
    assert.ok(esp.toasts.includes('Grupo partilhado. Do Rui ficou de fora — não é teu. A ligação está na janela do grupo.'), esp.toasts.join(' | '));
    assert.equal(app.modalStack.length, 0, 'não volta a abrir nada por cima');
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
    app.CW.grupoNovo(); app.CW.grupoRenomear('G2'); app.mudarNomeCategoria('cats', 'Seguros');
    const esperado = [['Nova categoria', 'Jardim e piscina'], ['Nova categoria', 'Alojamento local'], ['Nova subcategoria', 'Canalização'],
      ['Mudar o nome da subcategoria', 'Canalização'], ['Nova etiqueta', 'Obras de 2026'], ['Novo grupo partilhado', 'Casas de Lisboa'], ['Mudar o nome', 'Casas de Lisboa'],
      ['Mudar o nome da categoria', 'Jardim e piscina']];
    assert.equal(esp.abertas.length, esperado.length);
    esp.abertas.forEach((j, i) => {
      assert.equal(j.t, esperado[i][0]);
      const cs = conferir(j.t, j.b, { obrigatorios: ['pm_v'] });
      assert.equal(cs[0].placeholder, EX + esperado[i][1], j.t);
      assert.match(cs[0].rotulo, /^Nome( d[ao] (categoria|subcategoria|etiqueta|grupo))$/, 'o rótulo diz o nome de quê: ' + cs[0].rotulo);
    });
    assert.match(esp.abertas[3].b, /value="Pintura"/, 'mudar o nome traz o atual');
    assert.match(esp.abertas[7].b, /value="Seguros"/, 'o da categoria também');
  });

  /* O que o falhaCampo escreve no campo: troca o classList do elemento do
     arnês (que não guarda nada) por um que se lembra das classes.
     Recebe: app — a app; id — o id do campo.
     Devolve: o array das classes acrescentadas. */
  const classesDe = (app, id) => {
    const el = app.document.getElementById(id), cls = [];
    el.classList = { add: (c) => cls.push(c), remove() {}, toggle() {}, contains: () => false };
    return cls;
  };

  test('um promptModal sem texto não fecha calado: a janela fica aberta, nada se cria, e o erro diz-se no campo', () => {
    const { app, esp } = comEstado();
    const criados = [];
    app.promptModal('Nova etiqueta', 'Nome da etiqueta', null, (v) => criados.push(v), 'Obras de 2026');
    const cls = classesDe(app, 'pm_v');
    app.document.getElementById('pm_v').value = '   ';
    app._pm();
    assert.equal(app.modalStack.length, 1, 'a janela fica aberta (fechava antes de olhar para o texto)');
    assert.deepEqual(criados, []);
    assert.ok(cls.includes('err'), 'o contorno vermelho no campo');
    assert.deepEqual(esp.toasts, ['Escreve um nome.']);
    app.document.getElementById('pm_v').value = ' Obras ';
    app._pm();
    assert.equal(app.modalStack.length, 0, 'com texto fecha');
    assert.deepEqual(criados, ['Obras'], 'e entrega o texto aparado');
  });

  test('o grupo sem nome ou sem membros não grava: o erro diz-se no campo do nome e na caixa dos membros', () => {
    const { app, esp } = comEstado();
    app.groupModal('owner');
    const j = esp.abertas[0];
    assert.match(j.b, /<div id="g_membros"><div class="tagbox">/, 'os membros numa caixa com id, para o erro');
    const nome = classesDe(app, 'g_name'), membros = classesDe(app, 'g_membros');
    const antes = app.db.groups.length;
    app.document.getElementById('g_name').value = ' ';
    j.onSave();
    assert.deepEqual([nome, membros], [['err'], []], 'sem nome, o erro no nome');
    app.document.getElementById('g_name').value = 'Família';
    j.onSave();
    assert.deepEqual(membros, ['err'], 'sem membros, o erro na caixa dos membros');
    assert.deepEqual(esp.toasts, ['Dá um nome ao grupo.', 'Escolhe pelo menos um membro.'], 'a frase continua no aviso');
    assert.equal(app.db.groups.length, antes, 'nada gravado');
    assert.equal(app.modalStack.length, 1, 'a janela fica');
  });

  test('valores por omissão: gravar ao sair do campo não repinta (o campo seguinte era destruído e o foco caía no body), e o campo mostra o que ficou gravado', () => {
    const { app } = comEstado();
    const h = app.vDefaults();
    assert.ok(!/setSet\(/.test(h), 'o setSet repintava a página');
    for (const [id, k] of [['def_growth', 'growth'], ['def_inflation', 'inflation'], ['def_years', 'years'], ['def_capTarget', 'capTarget'], ['def_stamp', 'stampPct']]) {
      assert.match(h, new RegExp('id="' + id + '"[^>]*data-change="gravarValorPorOmissao\\(this,\'' + k + '\'\\)"'), id);
    }
    let pinturas = 0, gravacoes = 0;
    app.render = () => { pinturas++; };
    app.save = () => { gravacoes++; };
    const muda = (k, v) => { const campo = { value: v }; app.gravarValorPorOmissao(campo, k); return [app.db.settings[k], campo.value]; };
    assert.deepEqual(muda('years', ''), [1, '1'], 'o horizonte em branco é 1 ano, e o campo di-lo');
    assert.deepEqual(muda('years', '45'), [30, '30'], 'no máximo 30');
    assert.deepEqual(muda('growth', '2,5'), [2.5, '2,5']);
    assert.deepEqual(muda('inflation', ''), [0, '0']);
    assert.deepEqual(muda('capTarget', ''), [5, '5'], 'o yield em branco volta aos 5 %, como no capTargetSet');
    assert.deepEqual(muda('capTarget', '0'), [5, '5']);
    assert.deepEqual(muda('stampPct', '-3'), [0, '0'], 'o selo não desce de 0');
    assert.equal(pinturas, 0, 'nada repinta');
    assert.equal(gravacoes, 7, 'cada mudança grava');
  });

  test('o tema escolhido no segmentado da raiz devolve o foco ao botão: o setTheme repinta', () => {
    const { app } = comEstado();
    assert.match(app.linhaDoTema(), /<button type="button" id="defTema_dark" role="radio"[^>]*data-click="temaEscolher\('dark'\)">Escuro<\/button>/);
    const focos = [];
    app.document.getElementById('defTema_dark').focus = () => focos.push('defTema_dark');
    app.temaEscolher('dark');
    assert.equal(app.db.settings.theme, 'dark');
    assert.deepEqual(focos, ['defTema_dark']);
    app.temaEscolher('roxo');
    assert.equal(app.db.settings.theme, 'dark', 'um tema que não existe não se grava');
  });

  test('apagar categoria, subcategoria e etiqueta dizem quantos movimentos, no singular e no plural, sem «(s)»', () => {
    const { app, esp } = comEstado();
    app.db.settings.cats = { Obras: ['Pintura'], Seguros: ['Casa'], 'Condomínio': [] };
    app.db.settings.tags = ['Urgente', 'Rara'];
    const tx = (id, category, sub, tags) => ({ id, kind: 'expense', category, sub, tags, amount: 1, date: '2026-01-01' });
    app.db.transactions = [tx('t1', 'Obras', 'Pintura', ['Urgente']), tx('t4', 'Obras', 'Pintura', []), tx('t2', 'Seguros', '', ['Urgente']),
      tx('t3', 'Seguros', 'Casa', ['Rara']), tx('t5', 'Condomínio', '', [])];
    app.delSub('cats', 'Obras', 'Pintura');
    app.delSub('cats', 'Seguros', 'Casa');
    app.delCat('cats', 'Condomínio');
    app.delCat('cats', 'Seguros');
    app.delTag('Urgente');
    app.delTag('Rara');
    assert.deepEqual(esp.confirmados.map((c) => c.txt), [
      '“Pintura” sai de Obras e de 2 movimentos que a usam.',
      '“Casa” sai de Seguros e de 1 movimento que a usa.',
      'Apagar “Condomínio”? 1 movimento fica sem categoria.',
      'Apagar “Seguros”? 2 movimentos ficam sem categoria.',
      'Apagar “Urgente”? Sai de 2 movimentos.',
      'Apagar “Rara”? Sai de 1 movimento.']);
  });

  test('categorias: o «Fora dos totais» é um label com o interruptor (o rótulo também liga), e «Repor as colunas do Anexo F» fica fora do parágrafo da nota', () => {
    const base = carregarApp();
    limpar(base);
    const h = base.vCats('cats');
    assert.match(h, /<label class="def-cat-fora"><span class="def-so-tel small" aria-hidden="true">Fora dos totais<\/span><button type="button" class="interruptor" role="switch"/);
    assert.match(h, /mas não somam\.<\/p>\s*<div class="def-repor"><button type="button" class="def-ligacao"[^>]*data-click="resetIrsMapa\(\)">Repor as colunas do Anexo F<\/button><\/div>/);
    assert.ok(!base.vCats('catsIn').includes('Repor as colunas do Anexo F'), 'só nos pagamentos');
  });

  /* As categorias deixaram de se renomear no próprio nome (o canvas de
     2026-10, D-DefCategorias: uma tabela): o nome muda-se no ⋯ da linha, num
     promptModal com o asterisco e o exemplo (o teste de cima). A página só
     tem escolhas — a coluna do Anexo F e o «Fora dos totais» —, sem campos de
     texto, sem asterisco e sem placeholder. */
  test('categorias, etiquetas e IRS: só escolhas, sem campos de texto nem asterisco; o nome muda-se pelo ⋯, num prompt com exemplo', () => {
    const base = carregarApp();
    limpar(base);
    const h = base.vCats();
    assert.ok(!/<input(?![^>]*type="hidden")|<textarea|placeholder=|class="req"/.test(h), 'nenhum campo de texto');
    assert.match(h, /closePops\(\);mudarNomeCategoria\('cats','[^']+'\)">/, 'o «Mudar o nome…» de cada categoria');
    assert.match(h, /role="switch" aria-checked="false" aria-label="Fora dos totais: /);
    assert.match(h, /<span class="def-oculto">Coluna no Anexo F de /, 'a coluna diz o que é ao leitor de ecrã');
    const receitas = base.vCats('catsIn');
    assert.ok(!receitas.includes('irsm_'), 'as receitas não vão ao Anexo F');
    assert.ok(!/<input(?![^>]*type="hidden")|placeholder=|class="req"/.test(base.vCats('cats')));
  });
});

/* Partilhar a avaliação (copias.js:shareReport): sem a folha de partilha, o
   texto vai para a área de transferência — e quando o browser a recusa, diz-se. */
describe('partilhar a avaliação', () => {
  test('a cópia recusada diz que falhou (a promessa rejeitava calada, sem aviso); a aceite diz que copiou', async () => {
    const { app, esp } = comEstado();
    app.navigator.clipboard = { writeText: () => Promise.reject(new Error('NotAllowedError')) };
    await app.shareReport();
    assert.deepEqual(esp.toasts, ['Não foi possível copiar o relatório.']);
    esp.toasts.length = 0;
    const copiado = [];
    app.navigator.clipboard = { writeText: (t) => { copiado.push(t); return Promise.resolve(); } };
    await app.shareReport();
    assert.deepEqual(esp.toasts, ['Relatório copiado.']);
    assert.equal(copiado.length, 1);
  });
});
