// Quem colabora encontra o que o cargo lhe deixa fazer, e onde: as ações por
// imóvel e as de todos, as frases, a barra de baixo, a ficha, a vista geral,
// o cartão do imóvel, «Imóveis onde colaboras» e os primeiros passos. As
// decisões vivem em web/app/acessos.js; a sessão simula-se com window.CW,
// como em cargos.test.js.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, limpar, repor, elementos, igual } from './arnes.js';

const app = carregarApp();
afterEach(() => app.definirServicosDesligados([]));
afterEach(() => repor(app));

const GESTOR = ['visit.view', 'visit.add', 'tenant.view', 'tenant.add'];
const CONTAB = ['tx.view', 'tx.add', 'rec.view', 'rec.add', 'contract.view', 'loan.view', 'file.view', 'file.add', 'report.view'];

// três imóveis do Rui; os cargos dizem-se por casa (null é «sou dono»)
function casas(a, cargos) {
  limpar(a);
  a.db.properties = ['P1', 'P2', 'P3'].map((id, i) =>
    Object.assign(a.normProp({ id, name: 'T' + (i + 1) + ' Rui', ownerIds: ['rui'] }), { _sharedFrom: 'Rui', _ownerUserId: 'rui', _cargo: 'Cargo ' + id }));
  a.db.owners = [a.normPerson({ id: 'eu', name: 'Eu' }), Object.assign(a.normPerson({ id: 'rui', name: 'Rui' }), { _userId: 'rui' })];
  const cs = {};
  ['P1', 'P2', 'P3'].forEach((id, i) => {
    const c = cargos[i];
    cs[id] = c === null ? { dono: true, criador: true } : { dono: false, nome: c.nome || 'Cargo ' + id, perms: c.perms || c };
  });
  a.window.CW = Object.assign(a.window.CW || {}, { user: { id: 'eu' }, cargos: cs, pessoas: {} });
}
const rotulos = (xs) => JSON.parse(JSON.stringify(xs.map((x) => x.rotulo)));
const acts = (xs) => JSON.parse(JSON.stringify(xs.map((x) => x.act)));

describe('acoesNoImovel', () => {
  test('o gestor de visitas marca visitas e adiciona inquilinos, com o imóvel na ação', () => {
    casas(app, [null, CONTAB, GESTOR]);
    const a = app.acoesNoImovel('P3');
    igual(rotulos(a), ['Marcar visita', 'Adicionar inquilino']);
    igual(acts(a), ["marcarVisitaNoImovel('P3')", "personModal('tenant',null,null,'P3')"]);
  });

  test('cada permissão de adicionar tem o seu botão, e as implicações contam', () => {
    casas(app, [['contract.add'], ['tx.add'], ['house.edit']]);
    igual(rotulos(app.acoesNoImovel('P1')), ['Novo contrato', 'Confirmar planeados'], 'contract.add traz os planeados');
    igual(acts(app.acoesNoImovel('P1')), ["ctModal(null,'P1')", "go('recurring')"]);
    igual(acts(app.acoesNoImovel('P2')), ["registarMovimentoNoImovel('P2')"]);
    igual(acts(app.acoesNoImovel('P3')), ["propModal('P3')"]);
    assert.equal(app.acoesNoImovel('P3')[0].rotulo, 'Editar a ficha');
    igual(rotulos(app.acoesNoImovel('P2')), ['Registar movimento']);
    assert.equal(app.acoesNoImovel('P1')[1].toca, 'ecra', 'ir aos planeados muda de ecrã');
    assert.equal(app.acoesNoImovel('P1')[0].toca, 'camada');
  });

  test('vazio para o dono, sem sessão, para um imóvel que não existe e num cargo que só vê', () => {
    casas(app, [null, ['visit.view', 'tx.view'], GESTOR]);
    igual(app.acoesNoImovel('P1'), []);
    igual(app.acoesNoImovel('P2'), [], 'ver não dá botões');
    igual(app.acoesNoImovel('X9'), []);
    igual(app.acoesNoImovel(''), []);
    delete app.window.CW;
    igual(app.acoesNoImovel('P3'), [], 'sem sessão tudo é meu');
  });

  test('um serviço desligado nesta conta tira o botão e a frase', () => {
    casas(app, [GESTOR, GESTOR, GESTOR]);
    app.definirServicosDesligados(['visits']);
    igual(rotulos(app.acoesNoImovel('P1')), ['Adicionar inquilino']);
    assert.equal(app.frasePodesNoImovel('P1'), 'Neste imóvel podes: adicionar inquilinos.');
    app.definirServicosDesligados(['tenants', 'visits']);
    igual(app.acoesNoImovel('P1'), []);
    assert.equal(app.frasePodesNoImovel('P1'), '');
  });

  test('«Novo contrato» só num imóvel de arrendamento', () => {
    casas(app, [['contract.add'], ['contract.add'], GESTOR]);
    app.db.properties[1].use = 'proprio';
    assert.ok(rotulos(app.acoesNoImovel('P1')).includes('Novo contrato'));
    assert.ok(!rotulos(app.acoesNoImovel('P2')).includes('Novo contrato'));
  });
});

describe('acoesDoColaborador', () => {
  test('une os imóveis sem repetir, pela ordem, e sem imóvel na ação', () => {
    casas(app, [GESTOR, CONTAB, ['visit.add', 'house.edit']]);
    const a = app.acoesDoColaborador();
    igual(rotulos(a), ['Marcar visita', 'Adicionar inquilino', 'Registar movimento', 'Confirmar planeados', 'Editar a ficha']);
    igual(acts(a), ['visitModal()', "personModal('tenant')", 'newTxPick()', "go('recurring')", 'editarFichaDeColaboracao()']);
  });

  test('um dono que também colabora: só os imóveis de colaboração contam', () => {
    casas(app, [null, ['tx.add'], null]);
    igual(rotulos(app.acoesDoColaborador()), ['Registar movimento']);
    casas(app, [null, null, null]);
    igual(app.acoesDoColaborador(), []);
  });
});

describe('as frases', () => {
  test('frasePodesNoImovel: uma, duas e três permissões, pela ordem de PERMS, com as implicações', () => {
    casas(app, [['visit.add'], GESTOR, ['house.edit', 'contract.add']]);
    assert.equal(app.frasePodesNoImovel('P1'), 'Neste imóvel podes: marcar visitas.');
    assert.equal(app.frasePodesNoImovel('P2'), 'Neste imóvel podes: marcar visitas e adicionar inquilinos.');
    assert.equal(app.frasePodesNoImovel('P3'), 'Neste imóvel podes: adicionar e confirmar planeados, adicionar contratos e editar a ficha do imóvel.');
  });

  test('frasePodesNoImovel e fraseCurtaPodes: vazias para o dono; a curta diz quando o cargo só vê', () => {
    casas(app, [null, ['tx.view'], GESTOR]);
    assert.equal(app.frasePodesNoImovel('P1'), '');
    assert.equal(app.fraseCurtaPodes('P1'), '');
    assert.equal(app.frasePodesNoImovel('P2'), '');
    assert.equal(app.fraseCurtaPodes('P2'), 'Só podes consultar');
    assert.equal(app.fraseCurtaPodes('P3'), 'Podes marcar visitas e adicionar inquilinos');
    casas(app, [CONTAB, CONTAB, CONTAB]);
    assert.equal(app.fraseCurtaPodes('P1'), 'Podes adicionar movimentos, adicionar e confirmar planeados e adicionar fotos e documentos');
  });
});

describe('a barra de baixo', () => {
  const TB = ['dashboard', 'transactions', 'properties', 'calendar'];

  test('barraDeBaixo: quem nada esconde fica com a de sempre', () => {
    igual(app.barraDeBaixo(TB, []), TB);
    igual(app.barraDeBaixo(TB), TB);
    igual(app.barraDeBaixo(TB, ['credits', 'fisco']), TB, 'esconder o que não está na barra não mexe nela');
  });

  test('barraDeBaixo: o lugar escondido vai para o primeiro visível, e sem substituto some', () => {
    igual(app.barraDeBaixo(TB, ['transactions', 'recurring', 'contracts']), ['dashboard', 'visits', 'properties', 'calendar']);
    igual(app.barraDeBaixo(TB, ['transactions', 'visits']), ['dashboard', 'contracts', 'properties', 'calendar']);
    igual(app.barraDeBaixo(TB, ['transactions', 'visits', 'contracts', 'tenants', 'recurring']), ['dashboard', 'properties', 'calendar']);
  });

  test('barraDeBaixo nunca repete um destino', () => {
    const dois = app.barraDeBaixo(TB, ['transactions', 'calendar']);
    igual(dois, ['dashboard', 'visits', 'properties', 'contracts']);
    const comVisitas = app.barraDeBaixo(['dashboard', 'visits', 'transactions', 'calendar'], ['transactions']);
    igual(comVisitas, ['dashboard', 'visits', 'contracts', 'calendar'], 'o que já está na barra não é substituto');
    const x = app.barraDeBaixo(TB, ['dashboard', 'transactions', 'properties', 'calendar']);
    assert.equal(new Set(x).size, x.length);
  });

  test('buildTabbar: o gestor de visitas tem as Visitas no lugar dos Movimentos; o dono, a de sempre', () => {
    const fixos = elementos(app);
    casas(app, [null, CONTAB, GESTOR]);
    app.buildNav();
    const dono = fixos.tabbar.innerHTML;
    igual((dono.match(/goBarra\('(\w+)'\)/g) || []).map((s) => s.slice(9, -2)), TB);
    casas(app, [GESTOR, GESTOR, GESTOR]);
    app.buildNav();
    const gestor = fixos.tabbar.innerHTML;
    igual((gestor.match(/goBarra\('(\w+)'\)/g) || []).map((s) => s.slice(9, -2)), ['dashboard', 'visits', 'properties', 'calendar']);
    assert.match(gestor, />Visitas</);
    assert.doesNotMatch(gestor, /Movimentos/);
  });

  test('separadoresEscondidos esconde Movimentos e Planeados a quem vê hipotecas sem ver movimentos', () => {
    casas(app, [['house.edit'], ['house.edit'], ['house.edit']]);
    assert.ok(app.scope().length > 0, 'o âmbito das finanças não está vazio (loan.view)');
    const fora = Array.from(app.separadoresEscondidos());
    assert.ok(fora.includes('transactions'), fora.join(', '));
    assert.ok(fora.includes('recurring'), fora.join(', '));
    assert.ok(!fora.includes('credits'), 'as hipotecas veem-se');
    assert.equal(new Set(fora).size, fora.length, 'sem repetidos');
    // com um movimento na base, o separador fica: há o que mostrar
    app.db.transactions = [app.normTx({ id: 'T1', propertyId: 'P1', amount: 1 })];
    assert.ok(!Array.from(app.separadoresEscondidos()).includes('transactions'));
  });
});

describe('a ficha do imóvel', () => {
  test('não diz «só de leitura» a quem pode editar a ficha, e tem os botões sem o de editar', () => {
    casas(app, [['house.edit', 'contract.add'], GESTOR, ['tx.view']]);
    const f1 = app.propFicha('P1');
    assert.doesNotMatch(f1, /só de leitura/);
    assert.match(f1, /És colaborador como <b>Cargo P1<\/b>\./);
    assert.match(f1, /Neste imóvel podes: adicionar e confirmar planeados, adicionar contratos e editar a ficha do imóvel\./);
    assert.match(f1, /data-click="ctModal\(null,'P1'\)"[^>]*>.*Novo contrato/);
    assert.match(f1, /data-click="closeAllModals\(\);go\('recurring'\)"/, 'mudar de ecrã fecha a ficha');
    assert.doesNotMatch(f1, /propModal\(/, 'o editar é o do rodapé');
    const f2 = app.propFicha('P2');
    assert.match(f2, /os dados do imóvel são só de leitura/, 'com ações, só os dados é que não se mexem');
    assert.match(f2, /marcarVisitaNoImovel\('P2'\)/);
    assert.match(f2, /Marcar visita/);
    const f3 = app.propFicha('P3');
    assert.match(f3, /a ficha é só de leitura/);
    assert.doesNotMatch(f3, /Neste imóvel podes|<button/, 'um cargo que só vê não tem botões');
  });

  test('a ficha do dono fica como era', () => {
    casas(app, [null, GESTOR, GESTOR]);
    const f = app.propFicha('P1');
    assert.doesNotMatch(f, /És colaborador|Neste imóvel podes|colab-acoes/);
    assert.ok(f.startsWith('<div class="form">'));
  });
});

describe('a vista geral', () => {
  test('quem só colabora tem «O que podes fazer», com o botão das visitas primeiro; o dono não', () => {
    casas(app, [GESTOR, GESTOR, GESTOR]);
    const html = app.vDashboard();
    assert.match(html, /O que podes fazer/);
    assert.match(html, /És colaborador de Rui em 3 imóveis como Cargo P1, Cargo P2 e Cargo P3\./);
    assert.match(html, /class="btn primary" data-toca="camada" data-click="visitModal\(\)">.*Marcar visita/);
    assert.match(html, /personModal\('tenant'\)/);
    assert.match(html, /Ver os imóveis/);
    assert.doesNotMatch(html, /nada para somar/);
    assert.ok(html.indexOf('O que podes fazer') < html.indexOf('Ver os imóveis'));
    casas(app, [null, GESTOR, GESTOR]);
    assert.doesNotMatch(app.vDashboard(), /O que podes fazer/, 'um dono que também colabora não vê o cartão');
  });

  test('com finanças o cartão vai por cima das contas; as próximas visitas aparecem até três', () => {
    casas(app, [CONTAB, CONTAB, CONTAB]);
    const fin = app.vDashboard();
    assert.match(fin, /Registar movimento/);
    assert.ok(fin.indexOf('O que podes fazer') < fin.indexOf('Receita'), 'por cima de tudo');
    assert.doesNotMatch(fin, /Ver os imóveis/, 'com contas, o cartão não precisa da porta dos imóveis');
    casas(app, [GESTOR, GESTOR, GESTOR]);
    const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    app.db.visits = [1, 2, 3, 4].map((n) => app.normVisit({ id: 'V' + n, nomes: 'Pessoa ' + n, propertyId: 'P1', date: d(n) }))
      .concat([app.normVisit({ id: 'V0', nomes: 'Antiga', propertyId: 'P1', date: '2020-01-01' })]);
    const html = app.vDashboard();
    assert.match(html, /Próximas visitas/);
    assert.match(html, /go\('visits'\)">Ver todas/);
    assert.equal((html.match(/data-lp="vis:/g) || []).length, 3, 'até três');
    assert.doesNotMatch(html, /Antiga/, 'só as que vêm');
  });
});

describe('o cartão e o menu do imóvel', () => {
  test('o cartão de um imóvel de colaboração diz o que o cargo deixa fazer; o menu ⋯ tem as ações', () => {
    casas(app, [null, GESTOR, ['tx.view']]);
    const html = app.vProperties();
    const cartao = (id) => { const i = html.indexOf('data-lp="prop:' + id + '"'), j = html.indexOf('data-lp="prop:', i + 1); return html.slice(i, j < 0 ? undefined : j); };
    assert.match(cartao('P2'), /Podes marcar visitas e adicionar inquilinos/);
    assert.match(cartao('P3'), /Só podes consultar/);
    assert.doesNotMatch(cartao('P1'), /Podes |Só podes/, 'o dono não tem frase');
    let opts = null;
    app.lpShow = (t, o) => { opts = o; };
    app.lpImovel(['prop', 'P2']);
    igual(opts.map((o) => o.label), ['Marcar visita', 'Adicionar inquilino']);
  });
});

describe('a camada da nuvem', () => {
  test('«Imóveis onde colaboras» diz o que o cargo deixa fazer, linha a linha', () => {
    const tudo = carregarTudo();
    casas(tudo, [GESTOR, ['tx.view'], null]);
    tudo.db.properties[2]._cargo = '';
    const html = tudo.colaboroCard();
    assert.match(html, /Cargo P1<\/span><span class="small u-d-block u-mt-3px">Podes marcar visitas e adicionar inquilinos<\/span>/);
    assert.match(html, /Só podes consultar/);
    assert.doesNotMatch(html, /T3 Rui/, 'o meu imóvel não é de colaboração');
  });

  test('os primeiros passos de quem só colabora e marca visitas: «Marca a primeira visita», feito com uma visita sua', () => {
    const tudo = carregarTudo();
    casas(tudo, [GESTOR, GESTOR, GESTOR]);
    tudo.CW.user = { id: 'eu', name: 'Eu', email: 'eu@exemplo.pt', token: 't' };
    const passo = () => JSON.parse(JSON.stringify(tudo.passos())).find((p) => p.id === 'visitas');
    assert.ok(passo(), 'o passo existe');
    assert.equal(passo().titulo, 'Marca a primeira visita');
    assert.equal(passo().act, 'visitModal()');
    assert.equal(passo().feito, false);
    const doDono = tudo.normVisit({ id: 'V1', nomes: 'Ana', propertyId: 'P1', date: '2030-01-01' });
    doDono._createdBy = 'rui'; doDono._atServidor = 5;
    tudo.db.visits = [doDono];
    assert.equal(passo().feito, false, 'uma visita do dono não conta');
    const minha = tudo.normVisit({ id: 'V2', nomes: 'Rui', propertyId: 'P1', date: '2030-01-02' });
    minha._createdBy = 'eu'; minha._atServidor = 6;
    tudo.db.visits.push(minha);
    assert.equal(passo().feito, true);
    // o cartão do guia entra depois do «O que podes fazer», e não por cima dele
    tudo.db.visits = [];
    const html = tudo.vDashboard();
    assert.ok(html.indexOf('O que podes fazer') > -1 && html.indexOf('Primeiros passos') > html.indexOf('O que podes fazer'), 'os passos vêm a seguir');
    // quem tem imóveis seus não tem este passo
    casas(tudo, [null, GESTOR, GESTOR]);
    assert.ok(!JSON.parse(JSON.stringify(tudo.passos())).some((p) => p.id === 'visitas'));
  });
});
