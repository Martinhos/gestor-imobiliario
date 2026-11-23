// O formulário e a ficha do imóvel num caminho linear, com o que o Anexo F
// pede: o grupo «Para o Anexo F» sempre aberto e o que falta dito na ficha;
// cada campo só quando as respostas de cima o fazem contar (fora de
// Portugal, uso próprio sem rendas, rústico, subarrendado), sem nunca
// esconder o que já tem valor; o «Uso próprio» com contratos por acabar; o
// «É só meu» dos donos fora da app; a parte arrendada de um imóvel por
// quartos; a parte subarrendada e a renda dela; o fundo de reserva do
// condomínio; o código do país com 1 a 3 algarismos; e a permilagem das
// frações do mesmo prédio numa despesa de grupo.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, limpar, repor, igual, elementos } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarTudo({ hoje: '2026-11-23' });
const el = elementos(app);
afterEach(() => repor(app));
const espera = () => new Promise((r) => setTimeout(r, 5));

/* Sem nuvem: um dono, as janelas numa pilha observável e os avisos guardados.
   Devolve: {abertas, avisos}. */
function local() {
  limpar(app);
  app.CW.user = null;
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Tiago', nif: '123456789' })];
  const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save', 'syncPropRecs', 'syncAllLoanRecs');
  const avisos = [];
  app.toast = (m) => { avisos.push(m); };
  app.crescerEmAltura = (q, f) => f();
  return { abertas, avisos };
}

/* Um imóvel na base (da Ana, de arrendamento por omissão).
   Recebe: o — os campos a juntar.
   Devolve: o imóvel. */
function casa(o) {
  const p = app.normProp(Object.assign({ id: 'P1', name: 'T2 Arroios', ownerIds: ['O1'] }, o || {}));
  app.db.properties.push(p);
  return p;
}

/* Um contrato declarado na base, do imóvel P1, em vigor de 2025 a 2027.
   Recebe: o — os campos a juntar.
   Devolve: o contrato. */
function contrato(o) {
  const c = app.normContract(Object.assign({ id: 'C1', propertyId: 'P1', tenantIds: ['T1'], rent: 800, start: '2025-01-01', end: '2027-12-31',
    fisco: { estado: 'declarado', finalidade: 'hp' } }, o || {}));
  app.db.contracts.push(c);
  return c;
}

/* O formulário de um imóvel pintado a partir dele, sem janela (o pForm e o
   que dele depende começam de novo).
   Recebe: p — o imóvel (objeto).
   Devolve: o HTML do formulário. */
function corpo(p) {
  app._imvForaPT = null;
  app.pForm = app.normProp(JSON.parse(JSON.stringify(p)));
  app.imvForaIniciar('p', app.pForm.comproprietariosFora);
  return app.propBody();
}

/* Escreve nos campos do formulário: texto no value, booleanos no checked. */
function escrever(v) {
  for (const [id, x] of Object.entries(v)) { if (typeof x === 'boolean') el[id].checked = x; else el[id].value = x; }
}

/* Abre o formulário (de um imóvel novo, ou de um que existe), escreve e guarda.
   Devolve: o imóvel gravado (o editado, ou o último da base). */
function guardar(v, id) {
  app.propModal(id);
  escrever(Object.assign({ p_name: 'Casa' }, v));
  app.onSave();
  return id ? app.prop(id) : app.db.properties[app.db.properties.length - 1];
}

/* O pedaço do HTML entre dois marcadores (para saber em que grupo está um campo). */
const entre = (h, a, b) => { const i = h.indexOf(a); if (i < 0) return ''; const j = b ? h.indexOf(b, i) : -1; return h.slice(i, j < 0 ? undefined : j); };

describe('N057 · o que o Anexo F pede, num grupo sempre aberto e dito na ficha', () => {
  test('num imóvel de arrendamento, o código da freguesia, o tipo, o artigo e a fração estão no grupo «Para o Anexo F», fora de qualquer dobra', () => {
    local();
    const html = corpo(app.normProp({ id: 'N1', name: 'Novo' }));
    const g = entre(html, 'id="imv_anexoF"', 'id="fold_');
    assert.match(g, /<h3>Para o Anexo F<\/h3>/);
    for (const id of ['p_freguesiaCodigo', 'p_tipoPredio', 'p_matrix', 'p_fraction']) assert.match(g, new RegExp('id="' + id + '"'), id + ' no grupo do Anexo F');
    const dobra = entre(html, 'id="fold_reg"', 'id="fold_text"');
    assert.ok(dobra, 'a dobra dos dados registais continua');
    assert.doesNotMatch(dobra, /p_freguesiaCodigo|p_matrix|p_tipoPredio|p_fraction/, 'nenhum dos quatro na dobra');
    assert.match(g, /o Anexo F pede-os em cada linha do quadro das rendas\. Podes guardar sem eles: a ficha e a Declaração dizem o que falta\./);
    assert.equal(app.__sel.p_tipoPredio.options.map((o) => o.label).join('|'), '—|Urbano|Rústico', 'o tipo nasce «—»: nunca se adivinha');
  });

  test('num rústico, o campo da fração é a secção; o tipo não se infere da fração', () => {
    local();
    const html = corpo(app.normProp({ id: 'N1', name: 'Terreno', tipoPredio: 'R', fraction: 'G', matrix: '155' }));
    assert.match(html, /<label>Secção \(opcional\)<input id="p_fraction" value="G" placeholder="Ex: G"/);
    assert.match(html, /no artigo R 155 G, a secção é a G/);
    const h2 = corpo(app.normProp({ id: 'N2', name: 'Fração', fraction: 'A' }));
    assert.match(h2, /<label>Fração autónoma \(opcional\)<input id="p_fraction"/);
    assert.equal(app.pForm.tipoPredio, '', 'com a fração escrita, o tipo continua por escolher');
  });

  test('o grupo decide-se pelas rendas e não pelo destino de hoje: um «Uso próprio» arrendado em 2025 tem-no; um sem rendas, não', () => {
    local();
    const p = casa({ use: 'proprio' });
    assert.doesNotMatch(corpo(p), /id="imv_anexoF"/, 'uso próprio sem rendas: sem o grupo');
    contrato({ start: '2024-03-01', end: '2025-06-30', active: false, fisco: { estado: 'declarado', finalidade: 'hp', cessacao: { data: '2025-06-30', motivo: '' } } });
    assert.match(corpo(p), /id="imv_anexoF"/, 'arrendado até junho de 2025: tem linha no Anexo F desse ano');
    app.db.contracts.length = 0;
    app.db.contracts.push(app.normContract({ id: 'C9', propertyId: 'P1', rent: 500, start: '2020-01-01', end: '2024-06-30', active: false }));
    assert.doesNotMatch(corpo(p), /id="imv_anexoF"/, 'um contrato que acabou em 2024 não conta');
    const q = app.normProp({ id: 'P2', name: 'Escrito', use: 'proprio', matrix: '4651' });
    assert.match(corpo(q), /id="imv_anexoF"/, 'com algum dos quatro escrito, fica à vista');
  });

  test('a ficha de um imóvel de arrendamento diz o que falta para o Anexo F, com o «Preencher» no primeiro campo em falta', () => {
    const { abertas } = local();
    casa({ freguesiaCodigo: '110623' });
    const f = app.propFicha('P1');
    assert.match(f, /Falta para o Anexo F: tipo de prédio e artigo matricial\./);
    assert.match(f, /data-click="imvAbrirNoCampo\('P1','p_tipoPredio'\)">Preencher</);
    app.imvAbrirNoCampo('P1', 'p_tipoPredio');
    assert.equal(abertas.at(-1).t, 'Editar imóvel');
    const p = app.prop('P1');
    p.tipoPredio = 'U'; p.matrix = '4651';
    assert.doesNotMatch(app.propFicha('P1'), /Falta para o Anexo F/, 'com os três, nada falta (a fração não é obrigatória)');
    p.tipoPredio = ''; p.use = 'proprio';
    assert.doesNotMatch(app.propFicha('P1'), /Falta para o Anexo F/, 'de uso próprio sem rendas, não vai ao Anexo F');
    p.use = 'investimento'; p.pais = 'Espanha';
    assert.doesNotMatch(app.propFicha('P1'), /Falta para o Anexo F/, 'lá fora vai ao Anexo J');
  });

  test('a quem não pode editar, a falta diz-se sem o botão', () => {
    local();
    casa();
    app.pode = (id, acao) => acao !== 'house.edit';
    const f = app.propFicha('P1');
    assert.match(f, /Falta para o Anexo F: código da freguesia, tipo de prédio e artigo matricial\./);
    assert.doesNotMatch(f, /imvAbrirNoCampo/);
  });
});

describe('N058 · cada campo só quando conta, e nunca escondido com valor', () => {
  test('o país e o código da tabela X só com «O imóvel fica fora de Portugal»; lá fora sai o que é só de Portugal', () => {
    local();
    const comum = corpo(app.normProp({ id: 'N1', name: 'Comum' }));
    assert.doesNotMatch(comum, /id="p_pais"/, 'num imóvel comum, sem o país');
    assert.match(comum, /id="p_foraPT"/);
    const fora = corpo(app.normProp({ id: 'N2', name: 'Madrid', pais: 'Espanha' }));
    assert.match(fora, /id="p_foraPT" checked/);
    assert.match(fora, /id="p_pais" value="Espanha"/);
    assert.match(fora, /id="p_paisCodigo"/);
    for (const id of ['p_freguesiaCodigo', 'p_matrix', 'p_tipoPredio', 'p_reabTipo', 'p_afetacao', 'p_vpt', 'p_concelho', 'p_distrito']) {
      assert.doesNotMatch(fora, new RegExp('id="' + id + '"'), 'fora de Portugal, sem ' + id);
    }
  });

  test('ligar e desligar o interruptor: desligado, o país e o código saem (a resposta é «em Portugal»)', () => {
    const { abertas } = local();
    app.propModal();
    assert.doesNotMatch(abertas[0].b, /id="p_pais"/);
    escrever({ p_foraPT: true });
    app.imvForaPTMudou();
    assert.match(app.modalBodyEl().innerHTML, /<label>País <span class="req">\*<\/span><input id="p_pais"/);
    escrever({ p_pais: 'Brasil', p_paisCodigo: '76' });
    app.collectProp();
    assert.equal(app.pForm.pais, 'Brasil');
    escrever({ p_foraPT: false });
    app.imvForaPTMudou();
    assert.equal(app.pForm.pais, '');
    assert.equal(app.pForm.paisCodigo, '');
    assert.doesNotMatch(app.modalBodyEl().innerHTML, /id="p_pais"/);
  });

  test('com o interruptor ligado, o país é obrigatório e «PT» não passa', () => {
    const { avisos } = local();
    app.propModal();
    escrever({ p_foraPT: true });
    app.imvForaPTMudou();
    escrever({ p_name: 'Lá fora', p_pais: '' });
    app.onSave();
    assert.equal(avisos.at(-1), 'Escreve o país onde fica o imóvel.');
    escrever({ p_pais: 'PT' });
    app.onSave();
    assert.equal(avisos.at(-1), 'Um imóvel em Portugal não leva país: desliga «O imóvel fica fora de Portugal».');
    assert.equal(app.db.properties.length, 0, 'nada gravado');
  });

  test('«Uso próprio» sem rendas esconde o 6A e o subarrendamento; com um contrato de 2026, ficam', () => {
    local();
    const p = casa({ use: 'proprio' });
    let html = corpo(p);
    assert.doesNotMatch(html, /id="p_reabTipo"/);
    assert.doesNotMatch(html, /id="p_sub_ativo"/);
    contrato({ start: '2026-01-01', end: '2026-08-31' });
    html = corpo(p);
    assert.match(html, /id="p_reabTipo"/, 'arrendado em 2026: o 6A conta');
    assert.match(html, /id="p_sub_ativo"/);
  });

  test('um 6A marcado fica à vista e grava-se igual, mesmo num «Uso próprio» sem rendas', () => {
    local();
    const p = casa({ use: 'proprio', purchaseDate: '2017-03-10', reabilitacao: { tipo: 'aru', inicio: '2018-02-01', conclusao: '2019-06-30', certificado: true } });
    assert.match(corpo(p), /id="p_reabTipo"/);
    const g = guardar({ p_name: 'T2 Arroios', p_reabTipo: 'aru', p_reabInicio: '2018-02-01', p_reabConclusao: '2019-06-30', p_reabCertificado: true, p_purchaseDate: '2017-03-10' }, 'P1');
    igual(g.reabilitacao, { tipo: 'aru', inicio: '2018-02-01', conclusao: '2019-06-30', certificado: true });
  });

  test('a dica da lei do 6A só depois de uma resposta que não seja «Não»', () => {
    local();
    const html = corpo(app.normProp({ id: 'N1', name: 'Novo' }));
    assert.match(html, /Imóvel reabilitado \(quadro 6A\)/);
    assert.doesNotMatch(html, /as rendas pagam 5 %/);
    assert.match(corpo(app.normProp({ id: 'N2', name: 'Reab', reabilitacao: { tipo: 'nrau' } })), /as rendas pagam 5 %/);
  });

  test('num rústico saem a tipologia, o andar, o certificado energético e o 6A — menos o que já tem valor', () => {
    local();
    const html = corpo(app.normProp({ id: 'N1', name: 'Terreno', tipoPredio: 'R' }));
    for (const id of ['p_tipologia', 'p_floor', 'p_energyCert', 'p_reabTipo']) assert.doesNotMatch(html, new RegExp('id="' + id + '"'), 'num rústico, sem ' + id);
    assert.match(html, /id="p_fraction"/, 'a fração (a secção) fica');
    const h2 = corpo(app.normProp({ id: 'N2', name: 'Terreno', tipoPredio: 'R', tipologia: 'T2', floor: '1.º' }));
    assert.match(h2, /id="sel_p_tipologia"/, 'escrita, a tipologia fica à vista');
    assert.match(h2, /id="p_floor" value="1\.º"/);
    assert.equal(app.__sel.p_tipoPredio.onchange, 'imvTipoPredioMudou', 'mudar o tipo repinta');
  });

  test('num imóvel subarrendado saem a aquisição, as hipotecas, o IMI, o 6A e a pergunta dos donos de fora; o valor de mercado fica', () => {
    local();
    const html = corpo(app.normProp({ id: 'N1', name: 'Sub', subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 900 } }));
    for (const id of ['p_purchase', 'p_purchaseDate', 'p_imi', 'p_reabTipo', 'p_foraEstado', 'p_afetacao']) assert.doesNotMatch(html, new RegExp('id="' + id + '"'), 'subarrendado, sem ' + id);
    assert.doesNotMatch(html, /Adicionar hipoteca/);
    assert.match(html, /id="p_value"/);
    assert.match(html, /id="p_condominio"/);
    const h2 = corpo(app.normProp({ id: 'N2', name: 'Sub', imi: 300, purchaseDate: '2010-01-01', subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 900 } }));
    assert.match(h2, /id="p_imi"/, 'com valor, o IMI fica');
    assert.match(h2, /id="p_purchaseDate" type="date" value="2010-01-01"/);
  });

  test('o subarrendamento pergunta-se no primeiro grupo, a seguir ao destino, e não no fim da dobra', () => {
    local();
    const html = corpo(app.normProp({ id: 'N1', name: 'Novo' }));
    const g1 = entre(html, 'id="p_name"', 'id="imv_anexoF"');
    assert.match(g1, /id="p_sub_ativo"[^>]*> Não sou dono: arrendo-o ao senhorio e subarrendo-o/);
    assert.doesNotMatch(entre(html, 'id="fold_reg"', 'id="fold_text"'), /p_sub_ativo/);
  });
});

describe('N129 · «Uso próprio» com contratos que não acabaram', () => {
  test('o formulário diz quantos há e oferece «Terminar o contrato»; a ficha continua a mostrá-los', () => {
    const { abertas } = local();
    casa();
    contrato();
    app.propModal('P1');
    app.setUse('proprio');
    const b = app.modalBodyEl().innerHTML;
    assert.match(b, /Este imóvel tem um contrato em vigor \(Tiago, até 31\/12\/2027\)\. Passar a «Uso próprio» não o termina: as rendas continuam na Declaração/);
    assert.match(b, /data-click="imvTerminarDoFormulario\('C1'\)">Terminar o contrato</);
    app.imvTerminarDoFormulario('C1');
    assert.equal(abertas.at(-1).t, 'Terminar contrato', 'a folha de sempre, por cima do formulário');
    assert.equal(typeof abertas.at(-1).aoFechar, 'function', 'ao fechar, o formulário repinta-se');
    app.prop('P1').use = 'proprio';
    const f = app.propFicha('P1');
    assert.match(f, /O imóvel está em «Uso próprio», mas este contrato não acabou: as rendas dele contam na Declaração\./);
    assert.match(f, /data-click="ctView\('C1'\)"/);
  });

  test('um contrato por começar abre-se na ficha (não se termina); sem contratos vivos, nada', () => {
    local();
    casa({ use: 'proprio' });
    contrato({ start: '2027-02-01', end: '2029-01-31' });
    let html = corpo(app.prop('P1'));
    assert.match(html, /Este imóvel tem um contrato por começar \(Tiago, a partir de 01\/02\/2027\)/);
    assert.match(html, /data-click="ctView\('C1'\)">Ver o contrato</);
    app.db.contracts[0].active = false; app.db.contracts[0].end = '2026-01-31'; app.db.contracts[0].start = '2025-01-01';
    html = corpo(app.prop('P1'));
    assert.doesNotMatch(html, /imv_uso_proprio/);
  });
});

describe('N065 · «É só meu» responde a pergunta dos donos de fora', () => {
  test('sem nuvem: grava «Não, mais ninguém» (também nos períodos por confirmar), o aviso da Declaração some, e o Anular devolve', () => {
    local();
    const p = casa({ quotasHist: [{ ate: '2026-03-31', ownerIds: ['O1'], ownerShares: {}, fora: null }] });
    contrato();
    assert.equal(app.fiscoAvSoDeUmDono(app.prop('P1'), 2026), true, 'por omissão, o aviso');
    let desfazer = null;
    app.comDesfazer = (m, f) => { desfazer = { m, f }; };
    app.imvSoMeu('P1');
    const q = app.prop('P1');
    igual(q.comproprietariosFora, []);
    igual(q.quotasHist.map((e) => e.fora), [[]]);
    assert.equal(app.fiscoAvSoDeUmDono(q, 2026), false, 'respondido, sem aviso');
    assert.equal(desfazer.m, 'T2 Arroios: guardado que não há outros donos fora da app.');
    desfazer.f();
    assert.equal(app.prop('P1').comproprietariosFora, null, 'o Anular devolve o por confirmar');
    igual(app.prop('P1').quotasHist.map((e) => e.fora), [null]);
    assert.ok(p);
  });

  test('com donos de fora já escritos não os apaga (abre o formulário); sem poder, recusa', () => {
    const { abertas, avisos } = local();
    casa({ comproprietariosFora: [{ id: 'f1', nome: 'Rui', quota: 50 }] });
    app.imvSoMeu('P1');
    assert.equal(app.prop('P1').comproprietariosFora.length, 1, 'o Rui fica');
    assert.equal(abertas.at(-1).t, 'Editar imóvel');
    app.prop('P1').comproprietariosFora = null;
    app.pode = () => false;
    app.imvSoMeu('P1');
    assert.equal(app.prop('P1').comproprietariosFora, null);
    assert.equal(avisos.at(-1), app.fraseSemPerm('house.edit'));
  });

  test('o cartão das quotas responde-se ali: «É só meu» e «Há outros donos», que abre o formulário já no «Sim»', () => {
    const { abertas } = local();
    casa();
    const f = app.propFicha('P1');
    assert.match(f, /data-click="imvSoMeu\('P1'\)">É só meu</);
    assert.match(f, /data-click="imvAbrirQuotas\('P1','sim'\)">Há outros donos</);
    app.imvAbrirQuotas('P1', 'sim');
    assert.equal(abertas.at(-1).t, 'Editar imóvel');
    assert.match(app.modalBodyEl().innerHTML, /id="p_fn_0"/, 'a linha do nome e da quota, à espera');
  });

  test('com nuvem, numa casa só minha, vai numa proposta de um dono só com «desde sempre»; com várias contas, abre a janela das quotas', async () => {
    limpar(app);
    const api = [], toasts = [], janelas = [];
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
    const st = {
      me: { id: 'EU' },
      houses: [
        { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1, data: { id: 'H1', name: 'Minha' } },
        { id: 'H2', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'RUI'], updatedAt: 1, data: { id: 'H2', name: 'Dupla', ownerShares: { EU: 50, RUI: 50 } } },
      ],
      records: [], userRecords: [], profiles: [{ userId: 'RUI', name: 'Rui', data: null }],
      connections: [], roles: [], collaborators: [], invites: [], people: [], proposals: [],
      shareLink: null, shareRequests: { incoming: [], outgoing: [] }, sharedGroupRequests: { incoming: [], outgoing: [] }, sharedGroups: [],
    };
    app.db = app.rebuildDb(st);
    app.CW.state = st;
    app.api = (m, p, b) => { api.push({ m, p, b: b === undefined ? undefined : JSON.parse(JSON.stringify(b)) }); return Promise.resolve({ ok: true, applied: true }); };
    app.pullNow = () => Promise.resolve();
    janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save', 'setSyncBadge', 'subirPendentes');
    app.toast = (m) => { toasts.push(m); };
    app.CW.proposeShares = (hid) => { janelas.push(hid); };
    await app.imvSoMeu('H1');
    await espera();
    igual(api.map((x) => [x.m, x.p, x.b.shares, x.b.fora, x.b.desde]), [['POST', '/api/houses/H1/proposal', { EU: 100 }, [], 'sempre']]);
    assert.equal(toasts.at(-1), 'Minha: guardado que não há outros donos fora da app.');
    app.imvSoMeu('H2');
    igual(janelas, ['H2'], 'a resposta é de todos: a janela das quotas');
    assert.equal(api.length, 1);
  });
});

describe('a janela das quotas a quem acabou de entrar na casa', () => {
  test('quando quem entrou fui eu (um pedido de partilha aceite, um grupo), a janela fala comigo', () => {
    limpar(app);
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
    const st = {
      me: { id: 'EU' },
      houses: [{ id: 'H2', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU'], updatedAt: 1,
        data: { id: 'H2', name: 'Do Rui', ownerShares: { RUI: 50, EU: 50 }, quotasHist: [{ ate: '2026-11-01', ownerIds: ['RUI'], ownerShares: {}, fora: [] }] } }],
      records: [], userRecords: [], profiles: [{ userId: 'RUI', name: 'Rui', data: null }],
      connections: [], roles: [], collaborators: [], invites: [], people: [], proposals: [],
      shareLink: null, shareRequests: { incoming: [], outgoing: [] }, sharedGroupRequests: { incoming: [], outgoing: [] }, sharedGroups: [],
    };
    app.db = app.rebuildDb(st);
    app.CW.state = st;
    const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save', 'setSyncBadge', 'subirPendentes');
    app.nextShareProposal = () => {};
    app.imvPropostaAbrir('H2', true);
    const b = abertas.at(-1).b;
    assert.match(b, /Aceitaste a partilha de <b>Do Rui<\/b>\. Indica a quota de cada um, da casa toda, e desde quando és dono\./);
    assert.match(b, /<label>Já eras dono antes de entrar na app\?/);
    assert.match(b, /como se tivesses entrado na app no dia em que passaste a ser dono/);
    assert.doesNotMatch(b, /\(tu\)<\/b> já era dono/);
  });
});

describe('N012 · a parte da casa que se arrenda, num imóvel por quartos', () => {
  test('pergunta-se só num imóvel por quartos, com a regra da área e a omissão dos quartos com contrato', () => {
    local();
    const q = app.normProp({ id: 'N1', name: 'T3', rentalMode: 'quartos', rooms: [{ id: 'r1', name: 'Quarto 1' }, { id: 'r2', name: 'Quarto 2' }, { id: 'r3', name: 'Quarto 3' }] });
    const html = corpo(q);
    assert.match(html, /<label>Parte da casa que se arrenda \(%\)<input id="p_parteArrendada" type="text" inputmode="decimal" value="" placeholder="Opcional"/);
    assert.match(html, /só contam na parte arrendada \(CIRS art\. 41\.º\)\. A lei manda repartir pela área/);
    assert.match(html, /Em branco, a app conta os quartos com contrato, dia a dia/);
    assert.doesNotMatch(corpo(app.normProp({ id: 'N2', name: 'T2' })), /p_parteArrendada/, 'num imóvel inteiro, não');
  });

  test('grava a percentagem (o que a Declaração lê em p.parteArrendada), recusa fora de (0, 100], e em branco fica a omissão', () => {
    const { avisos } = local();
    casa({ rentalMode: 'quartos', rooms: [{ id: 'r1', name: 'Quarto 1' }, { id: 'r2', name: 'Quarto 2' }] });
    let p = guardar({ p_name: 'T2 Arroios', p_parteArrendada: '40' }, 'P1');
    assert.equal(p.parteArrendada, 40);
    app.modalStack.length = 0;
    guardar({ p_name: 'T2 Arroios', p_parteArrendada: '150' }, 'P1');
    assert.equal(avisos.at(-1), 'A parte arrendada é uma percentagem acima de 0 e até 100.');
    assert.equal(app.prop('P1').parteArrendada, 40, 'nada gravado');
    app.modalStack.length = 0;
    p = guardar({ p_name: 'T2 Arroios', p_parteArrendada: '' }, 'P1');
    assert.equal(p.parteArrendada, null);
    app.prop('P1').parteArrendada = 37.5;
    assert.match(app.propFicha('P1'), /parte arrendada: 37,5 % da casa/);
  });
});

describe('N023 · a parte subarrendada e a renda dela', () => {
  test('ligado, pergunta se é a casa toda ou uma parte; com parte, a renda dessa parte, obrigatória e nunca acima da da casa', () => {
    const { avisos } = local();
    casa();
    app.propModal('P1');
    escrever({ p_sub_ativo: true });
    app.imvSubMudou();
    let b = app.modalBodyEl().innerHTML;
    assert.match(b, /Subarrendas a casa toda ou só uma parte\? <span class="req">\*<\/span><div class="sel" id="sel_p_sub_parte">/);
    assert.equal(app.__sel.p_sub_parte.onchange, 'imvSubMudou');
    escrever({ p_name: 'T2 Arroios', p_sub_nif: '123456789', p_sub_renda: '1200', p_sub_parte: 'parte' });
    app.imvSubMudou();
    b = app.modalBodyEl().innerHTML;
    assert.match(b, /Renda que pagas pela parte subarrendada \(€\/mês\) <span class="req">\*<\/span><input id="p_sub_rendaParte"/);
    assert.match(b, /O quadro 5 só abate esta à renda que recebes\./);
    escrever({ p_sub_rendaParte: '' });
    app.onSave();
    assert.equal(avisos.at(-1), 'Escreve a renda que pagas pela parte que subarrendas.');
    escrever({ p_sub_rendaParte: '1300' });
    app.onSave();
    assert.match(avisos.at(-1), /^A renda da parte subarrendada não pode passar a que pagas pela casa \(1\s?200,00\s€\)\.$/);
    escrever({ p_sub_rendaParte: '400' });
    app.onSave();
    const s = app.prop('P1').subarrendamento;
    igual({ parte: s.parte, rendaParte: s.rendaParte, rendaMensal: s.rendaMensal }, { parte: 'parte', rendaParte: 400, rendaMensal: 1200 });
    assert.match(app.propFicha('P1'), /subarrendado: pagas 1\s?200,00\s€\/mês ao senhorio, dos quais 400,00\s€ pela parte subarrendada/);
  });

  test('com «A casa toda», a renda da parte não se grava', () => {
    local();
    casa({ subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 900, parte: 'parte', rendaParte: 300 } });
    const p = guardar({ p_name: 'T2 Arroios', p_sub_ativo: true, p_sub_nif: '123456789', p_sub_renda: '900', p_sub_parte: 'toda' }, 'P1');
    assert.equal(p.subarrendamento.parte, 'toda');
    assert.equal(p.subarrendamento.rendaParte, 0);
  });
});

describe('N044 · o fundo comum de reserva por baixo do condomínio', () => {
  test('com o condomínio escrito, a regra do fundo (a mesma das categorias); sem ele, escondida, e acompanha o que se escreve', () => {
    local();
    let html = corpo(app.normProp({ id: 'N1', name: 'T2', condominio: 60 }));
    const frase = /<p class="hint imv-colado" id="imv_cond_frase" aria-live="polite">Se a quota inclui o fundo comum de reserva \(pelo menos 10 %\), regista essa parte em Fundo de reserva: só se deduz no ano em que o condomínio a gasta numa obra[^<]*Nesse caso, escreve aqui a quota sem o fundo\.<\/p>/;
    assert.match(html, frase);
    assert.match(html, /id="p_condominio"[^>]*data-input="imvCondominioMudou\(this\.value\)"/);
    html = corpo(app.normProp({ id: 'N2', name: 'T2' }));
    assert.match(html, /<p class="hint imv-colado u-d-none" id="imv_cond_frase" aria-live="polite"><\/p>/);
    const e = el.imv_cond_frase, classes = new Set();
    e.classList = { toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); } };
    app.imvCondominioMudou('45');
    assert.match(e.textContent, /fundo comum de reserva/);
    assert.equal(classes.has('u-d-none'), false);
    app.imvCondominioMudou('');
    assert.equal(e.textContent, '');
    assert.equal(classes.has('u-d-none'), true);
  });
});

describe('N105 · o código do país com 1 a 3 algarismos, como na tabela X', () => {
  test('o Brasil é 76 na tabela: aceita-se e grava-se 076; letras não passam', () => {
    const { avisos } = local();
    const p = guardar({ p_name: 'São Paulo', p_pais: 'Brasil', p_paisCodigo: '76' });
    assert.equal(p.paisCodigo, '076');
    assert.equal(app.imvCodigoPais(' 4 '), '004');
    assert.equal(app.imvCodigoPais('724'), '724');
    guardar({ p_name: 'Paris', p_pais: 'França', p_paisCodigo: 'FR' });
    assert.equal(avisos.at(-1), 'O código do país são 1 a 3 algarismos, como na tabela X das instruções do Anexo J (o Brasil é 76).');
  });
});

describe('o «Por confirmar» da ficha com «Confirmar e emiti o recibo»', () => {
  test('a renda que pede o recibo eletrónico leva os dois botões numa fila; a que não pede, só o «Confirmar»', () => {
    local();
    casa();
    const r = { id: 'R1', name: 'Renda', next: '2026-12-01', tx: { kind: 'income', propertyId: 'P1', amount: 800 } };
    app.recActive = () => [r];
    app.recPedeRecibo = () => true;
    let h = app.imvPorConfirmar(app.prop('P1'), { dono: true });
    assert.match(h, /class="imv-linha imv-pend imv-pend-recibo"/);
    assert.match(h, /<div class="imv-botoes"><button type="button" class="btn sm primary" data-toca="dados" data-click="quickConfirmRec\('R1'\)">Confirmar<\/button><button type="button" class="btn sm" data-toca="dados" data-click="recConfirmarComRecibo\('R1'\)">Confirmar e emiti o recibo<\/button><\/div>/);
    app.recPedeRecibo = () => false;
    h = app.imvPorConfirmar(app.prop('P1'), { dono: true });
    assert.doesNotMatch(h, /recConfirmarComRecibo|imv-pend-recibo/);
    assert.match(h, /data-click="quickConfirmRec\('R1'\)">Confirmar<\/button><\/div>/);
  });
});

describe('N114 · a permilagem das frações do mesmo prédio numa despesa de grupo', () => {
  test('duas frações do mesmo artigo urbano, ou da mesma rua e porta: a frase da permilagem; dois imóveis quaisquer, nada', () => {
    local();
    const ap = app.normProp({ id: 'A', name: 'Apartamento', freguesiaCodigo: '110623', matrix: '4651', fraction: 'A', tipoPredio: 'U' });
    const gar = app.normProp({ id: 'G', name: 'Garagem', freguesiaCodigo: '110623', matrix: ' 4651 ', fraction: 'Z' });
    const outro = app.normProp({ id: 'O', name: 'Outro', freguesiaCodigo: '110623', matrix: '999' });
    const f = app.psplitFrasePermilagem([ap, gar, outro]);
    assert.match(f, /^Frações do mesmo prédio \(Apartamento e Garagem\): os encargos comuns, como o condomínio, repartem-se pela permilagem de cada uma, a do título da propriedade horizontal \(CIRS art\. 41\.º n\.º 3\)\./);
    assert.match(f, /Escolhe «Quotas a definir» e escreve a permilagem de cada fração — 800 e 200, por exemplo\./);
    assert.equal(app.psplitFrasePermilagem([ap, outro]), '', 'prédios diferentes: nada');
    const r1 = app.normProp({ id: 'R1', name: 'R/C', street: 'Rua do Sol', doorNumber: '12', postalCode: '1200-195' });
    const r2 = app.normProp({ id: 'R2', name: '1.º', street: 'rua do sol', doorNumber: '12' });
    assert.match(app.psplitFrasePermilagem([r1, r2]), /\(R\/C e 1\.º\)/, 'a mesma rua e porta, sem código postal diferente');
    const r3 = app.normProp({ id: 'R3', name: 'Porto', street: 'Rua do Sol', doorNumber: '12', postalCode: '4000-001' });
    assert.equal(app.psplitFrasePermilagem([r1, r3]), '', 'a mesma rua noutra cidade não é o mesmo prédio');
    const t1 = app.normProp({ id: 'T1', name: 'Terreno 1', tipoPredio: 'R', freguesiaCodigo: '110623', matrix: '155' });
    const t2 = app.normProp({ id: 'T2', name: 'Terreno 2', tipoPredio: 'R', freguesiaCodigo: '110623', matrix: '155' });
    assert.equal(app.psplitFrasePermilagem([t1, t2]), '', 'rústicos não têm permilagem');
    assert.equal(app.psplitFrasePermilagem([app.normProp({ id: 'X', name: 'X' }), app.normProp({ id: 'Y', name: 'Y' })]), '', 'sem dados, não se adivinha');
  });
});
