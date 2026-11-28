// O mapa dos gastos, os papéis das receitas, as Definições e o Splitwise
// perante a Declaração (KAN-152, KAN-153, KAN-154). As obras ficam «a
// confirmar» onde dependem do caso, e a conservação por natureza continua na
// conservação (N011, N045); a quota do condomínio diz que o fundo comum de
// reserva vai à parte (N044); o «Fora dos totais» diz, onde se liga, que tira
// as despesas do Anexo F (N042); o reembolso do inquilino e o do condomínio com
// contrato declaram-se mesmo fora dos totais (N078); o do Estado num imóvel
// abate a um gasto (N071); a subcategoria que decide a coluna diz-se (N133);
// as linhas do Splitwise apagadas de propósito vivem na ficha do imóvel e
// juntam-se pela chave (N102); e os cartões da cópia de segurança e do
// Splitwise dizem o que fazem (N004, N038). No fim, as formas que outras
// partes da app pediram ao dados.js. As provas de duas contas e de dois
// aparelhos são clientes a sério (a app inteira com a nuvem, o fetch ligado
// ao worker) contra a D1 de teste. Cada achado tem aqui pelo menos um assert
// que falhava antes.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { carregarApp, carregarTudo, limpar, igual, repor } from './arnes.js';
import { ambiente, conta, casa, comproprietario, registo } from './lib/api.js';
import { handleApi } from '../worker/src/api.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

/* ------------------------------------------------------------- armações */

/* Tira o ecrã às ações (gravam, repintam e avisam).
   Devolve: {toasts} — os avisos. */
function semEcra() {
  const dito = { toasts: [] };
  app.save = () => {};
  app.render = () => {};
  app.buildNav = () => {};
  app.closeModal = () => {};
  app.closeAllModals = () => {};
  app.toast = (m) => { dito.toasts.push(m); };
  return dito;
}
/* Uma conta com o imóvel v1, só da Ana, e o contrato C1 de 800 € por mês desde
   janeiro de 2026, declarado, com as doze rendas de 2026.
   Devolve: nada — mexe na db. */
function casaComRendas() {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
  app.db.properties.push(app.normProp({ id: 'v1', name: 'T2', ownerIds: ['ana'], ownerShares: { ana: 100 }, comproprietariosFora: [],
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '1' }));
  app.db.contracts.push(app.normContract({ id: 'C1', name: 'C1', propertyId: 'v1', tenantIds: ['t1'], rent: 800, payDay: 5,
    start: '2026-01-01', end: '2030-12-31', active: true, fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } }));
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    app.db.transactions.push(app.normTx({ id: 'R' + mm, kind: 'income', label: 'Renda', amount: 800, date: '2026-' + mm + '-05', periodo: '2026-' + mm,
      propertyId: 'v1', contractId: 'C1', category: 'Rendas', sub: 'Renda mensal', recibo: true }));
  }
}
/* Uma despesa de 2026 no imóvel v1, já na base.
   Recebe: category, sub, amount; extra (opcional).
   Devolve: o movimento. */
function despesa(category, sub, amount, extra) {
  const t = app.normTx(Object.assign({ kind: 'expense', label: [category, sub].filter(Boolean).join(' › '), amount, date: '2026-05-10',
    propertyId: 'v1', category, sub }, extra || {}));
  app.db.transactions.push(t);
  return t;
}
/* Uma receita de 2026 no imóvel v1, já na base.
   Recebe: category, sub, amount; extra (opcional).
   Devolve: o movimento. */
function receita(category, sub, amount, extra) {
  const t = app.normTx(Object.assign({ kind: 'income', label: [category, sub].filter(Boolean).join(' › '), amount, date: '2026-09-10',
    propertyId: 'v1', category, sub }, extra || {}));
  app.db.transactions.push(t);
  return t;
}
/* a coluna e o papel como objetos simples (atravessam o contexto isolado) */
const col = (t) => JSON.parse(JSON.stringify(app.irsColunaDe(t)));
const papel = (t) => JSON.parse(JSON.stringify(app.irsReceitaDe(t)));
/* uma despesa solta, para perguntar a coluna sem a pôr na base */
const solta = (category, sub) => app.normTx({ kind: 'expense', amount: 100, date: '2026-05-10', propertyId: 'v1', category, sub });
/* a Declaração de 2026 da Ana */
const declaracao = () => app.resumoFiscal(2026, 'ana');
/* o HTML de uma árvore das categorias */
const pagina = (tk) => app.vCats(tk);

/* ------------------------------------------------------- N011 e N045 */

describe('N011 — «Obras e benfeitorias» sem subcategoria, ou com uma da pessoa, fica a confirmar', () => {
  beforeEach(() => casaComRendas());

  test('a categoria e uma subcategoria da pessoa ficam a confirmar; pintura, canalização, eletricidade e janelas vão à conservação', () => {
    igual(col(solta('Obras e benfeitorias', '')), { col: 'confirmar', origem: 'categoria' });
    app.db.settings.cats['Obras e benfeitorias'].push('Ar condicionado');
    igual(col(solta('Obras e benfeitorias', 'Ar condicionado')), { col: 'confirmar', origem: 'categoria' }, 'uma subcategoria criada pela pessoa herda «a confirmar»');
    for (const s of ['Pintura', 'Canalização', 'Eletricidade', 'Janelas']) igual(col(solta('Obras e benfeitorias', s)), { col: 'conservacao', origem: 'sub' }, s);
    assert.match(app.IRS_MAPA_NOTAS['Obras e benfeitorias'], /é conservação: escolhe Conservação e manutenção\. O que acrescenta valor \(uma ampliação, ar condicionado, painéis solares, uma reabilitação profunda\) não se deduz\./);
  });

  test('o cenário do auditor: a remodelação geral e o ar condicionado não entram na conservação, e vão a «A tratar» com o nome e o valor', () => {
    app.db.settings.cats['Obras e benfeitorias'].push('Ar condicionado');
    despesa('Obras e benfeitorias', '', 15000, { label: 'Remodelação geral' });
    despesa('Obras e benfeitorias', 'Ar condicionado', 2500, { label: 'Ar condicionado' });
    despesa('Obras e benfeitorias', 'Pintura', 1800, { label: 'Pintura' });
    const r = declaracao();
    assert.equal(r.totais.gastos.conservacao, 1800, 'só a pintura');
    const conf = r.aConfirmar.map((d) => [d.nome, d.valor]);
    igual(conf.filter((x) => x[0] !== 'Pintura').sort(), [['Ar condicionado', 2500], ['Remodelação geral', 15000]]);
  });

  test('a migração (irsMapaV=3): só onde o valor gravado é ainda o de origem; a escolha da pessoa fica, e as subcategorias continuam a segui-la', () => {
    // uma conta de antes: o mapa de origem antigo, sem as chaves novas das subcategorias
    const antigo = () => {
      const m = Object.assign(JSON.parse(JSON.stringify(app.IRS_MAPA0)), JSON.parse(JSON.stringify(app.IRS_MAPA_MIGRA3)));
      for (const k of Object.keys(app.IRS_MAPA_SEGUE3)) delete m[k];
      return m;
    };
    const st = { cats: JSON.parse(JSON.stringify(app.CATS0)), catsIn: JSON.parse(JSON.stringify(app.CATS_IN0)), catsV: 2, irsMapaV: 2, irsMapa: antigo() };
    app.fillCats(st);
    assert.equal(st.irsMapaV, 3);
    for (const k of ['Obras e benfeitorias', 'Obras e benfeitorias / Remodelação', 'Obras e benfeitorias / Cozinha', 'Obras e benfeitorias / Casa de banho']) {
      assert.equal(st.irsMapa[k], 'confirmar', k);
    }
    assert.equal(st.irsMapa['Obras e benfeitorias / Pintura'], 'conservacao');
    // escolhido depois da marca, fica — também em cada leitura seguinte
    st.irsMapa['Obras e benfeitorias'] = 'conservacao';
    app.fillCats(st); app.fillCats(st);
    assert.equal(st.irsMapa['Obras e benfeitorias'], 'conservacao');
    // a pessoa tinha escolhido outra coluna para as obras e para a cozinha: fica, e as subcategorias seguem-na
    const st2 = { cats: JSON.parse(JSON.stringify(app.CATS0)), catsIn: JSON.parse(JSON.stringify(app.CATS_IN0)), catsV: 2, irsMapaV: 2,
      irsMapa: Object.assign(antigo(), { 'Obras e benfeitorias': 'outros', 'Obras e benfeitorias / Cozinha': 'conservacao' }) };
    app.fillCats(st2);
    assert.equal(st2.irsMapa['Obras e benfeitorias'], 'outros');
    assert.equal(st2.irsMapa['Obras e benfeitorias / Cozinha'], 'conservacao');
    assert.equal(st2.irsMapa['Obras e benfeitorias / Remodelação'], 'confirmar', 'a que estava na origem muda');
    assert.equal(st2.irsMapa['Obras e benfeitorias / Pintura'], app.IRS_MAPA_HERDA);
    app.db.settings.irsMapa = st2.irsMapa;
    igual(col(solta('Obras e benfeitorias', 'Pintura')), { col: 'outros', origem: 'categoria' }, 'a pintura continua onde a pessoa pôs as obras');
  });
});

describe('N045 — a cozinha, a casa de banho e a remodelação dependem do caso', () => {
  beforeEach(() => casaComRendas());

  test('ficam a confirmar, com a nota de cada uma, e a Declaração lista-as em «A tratar» (antes saíam em silêncio)', () => {
    for (const s of ['Cozinha', 'Casa de banho', 'Remodelação']) {
      igual(col(solta('Obras e benfeitorias', s)), { col: 'confirmar', origem: 'sub' }, s);
      assert.match(app.IRS_MAPA_NOTAS['Obras e benfeitorias / ' + s], /é conservação: escolhe Conservação e manutenção/, s);
    }
    assert.match(app.IRS_MAPA_NOTAS['Obras e benfeitorias / Cozinha'], /armários fixos, bancada/);
    assert.match(app.IRS_MAPA_NOTAS['Obras e benfeitorias / Casa de banho'], /sanita, lavatório/);
    despesa('Obras e benfeitorias', 'Cozinha', 3000, { label: 'Armários e bancada' });
    despesa('Obras e benfeitorias', 'Casa de banho', 1200, { label: 'Sanita e lavatório' });
    igual(declaracao().aConfirmar.map((d) => [d.nome, d.valor]).sort(), [['Armários e bancada', 3000], ['Sanita e lavatório', 1200]]);
  });

  test('o cartão do art. 41.º põe as obras da cozinha e da casa de banho a confirmar, como o guia', () => {
    const h = pagina('cats');
    assert.match(h, /<b class="amber">A confirmar em cada despesa:<\/b> as obras sem subcategoria, as da cozinha e da casa de banho e as remodelações \(reparar ou substituir o que já existia/);
    assert.doesNotMatch(h, /beneficiações — uma cozinha nova, uma remodelação que acrescenta valor/);
    assert.match(h, /as beneficiações, que acrescentam valor — uma ampliação, uma cozinha ou uma casa de banho novas/);
  });
});

/* ---------------------------------------------------------------- N044 */

describe('N044 — a quota mensal do condomínio e o fundo comum de reserva', () => {
  beforeEach(() => casaComRendas());

  test('a nota da quota mensal diz que o fundo vai à parte, uma vez na página das categorias, e o cartão também', () => {
    const frase = 'Se a quota inclui o fundo comum de reserva (pelo menos 10 %), regista essa parte em Fundo de reserva: só se deduz no ano em que o condomínio a gasta numa obra, em Conservação e manutenção.';
    assert.equal(app.IRS_MAPA_NOTAS['Condomínio / Quota mensal'], frase);
    const h = pagina('cats');
    assert.equal(h.split('fundo comum de reserva (pelo menos 10 %)').length - 1, 1, 'na linha do Condomínio, sem a repetir na da quota mensal');
    assert.match(h, /as quotas do condomínio \(sem o fundo comum de reserva: se a quota o inclui, regista essa parte em Fundo de reserva\)/);
  });
});

/* ---------------------------------------------------------------- N042 */

describe('N042 — o «Fora dos totais» tira a despesa do Anexo F, e a página di-lo', () => {
  beforeEach(() => casaComRendas());

  test('numa categoria de pagamentos fora dos totais, a linha diz que as despesas saem do Anexo F; nos Impostos, que só o IMI e o selo ficam', () => {
    semEcra();
    assert.doesNotMatch(pagina('cats'), /saem do Anexo F|do Anexo F: estas despesas/);
    app.toggleExc('cats', 'Manutenção e reparações');
    app.toggleExc('cats', 'Impostos');
    const h = pagina('cats');
    assert.match(h, /Sai dos totais, dos gráficos e do Anexo F: estas despesas não contam na Declaração\./);
    assert.match(h, /«IMI» e «Imposto do selo» continuam a declarar-se\. As outras despesas saem do Anexo F e não contam na Declaração\./);
  });

  test('irsColunaSemFora diz a coluna que a despesa teria: é o que a lista das despesas tiradas usa', () => {
    const t = despesa('Manutenção e reparações', 'Pequenas reparações', 1800, { irsCol: 'conservacao' });
    app.db.settings.exclude[app.excKey('cats', 'Manutenção e reparações')] = true;
    igual(col(t), { col: 'nao', origem: 'excluido' }, 'a decisão D19 fica');
    igual(JSON.parse(JSON.stringify(app.irsColunaSemFora(t))), { col: 'conservacao', origem: 'movimento' });
    igual(JSON.parse(JSON.stringify(app.irsColunaSemFora(solta('Manutenção e reparações', '')))), { col: 'conservacao', origem: 'categoria' });
  });
});

/* ------------------------------------------------------- N078 e N071 */

describe('N078 — os reembolsos que são renda declaram-se mesmo fora dos totais', () => {
  beforeEach(() => casaComRendas());

  test('o cenário do auditor: com «Reembolsos» fora dos totais a Declaração continua com os 480 € do inquilino', () => {
    for (let i = 0; i < 4; i++) receita('Reembolsos', 'Inquilino', 120, { contractId: 'C1', date: '2026-0' + (3 + i) + '-20' });
    const antes = declaracao().totais.rendas;
    assert.equal(antes, 9600 + 480);
    app.db.settings.exclude[app.excKey('catsIn', 'Reembolsos')] = true;
    assert.equal(declaracao().totais.rendas, antes, 'o «Fora dos totais» não os tira');
    assert.ok(declaracao().rendasForaDosTotais.n >= 4, 'e contam-se como as rendas fora dos totais');
  });

  test('o do inquilino e o do condomínio com contrato são renda; os que devolvem um gasto continuam a abater-lhe; o do IRS e o sem subcategoria saem', () => {
    app.db.settings.exclude[app.excKey('catsIn', 'Reembolsos')] = true;
    const r = (sub, extra) => papel(app.normTx(Object.assign({ kind: 'income', amount: 50, date: '2026-03-01', propertyId: 'v1', category: 'Reembolsos', sub }, extra || {})));
    igual(r('Inquilino', { contractId: 'C1' }), { papel: 'renda', natureza: '07' });
    igual(r('Condomínio', { contractId: 'C1' }), { papel: 'renda', natureza: '07' });
    igual(r('Condomínio'), { papel: 'reembolsoGasto', natureza: null, tipo: 'condominio' });
    igual(r('Seguro'), { papel: 'reembolsoGasto', natureza: null, tipo: 'seguro' });
    igual(r('Estado'), { papel: 'reembolsoGasto', natureza: null, tipo: 'estado' });
    igual(r('Estado', { propertyId: null }), { papel: 'fora', natureza: null }, 'o reembolso do IRS');
    igual(r(''), { papel: 'fora', natureza: null });
    const h = pagina('catsIn');
    assert.match(h, /«Inquilino» continua a declarar-se como renda, e «Seguro», «Condomínio» e «Estado» continuam a abater ao gasto que devolvem/);
    assert.doesNotMatch(h, /Os outros reembolsos saem da Declaração/);
  });

  test('o cenário: um condomínio devolvido continua a abater ao condomínio deduzido com «Reembolsos» fora dos totais', () => {
    despesa('Condomínio', 'Quota mensal', 720, { date: '2026-06-01' });
    const t = receita('Reembolsos', 'Condomínio', 120, { label: 'Condomínio devolvido' });
    const antes = declaracao();
    assert.equal(antes.totais.gastos.condominio, 600);
    app.db.settings.exclude[app.excKey('catsIn', 'Reembolsos')] = true;
    const depois = declaracao();
    assert.equal(depois.totais.gastos.condominio, 600, 'continua a abater: o «Fora dos totais» é dos gráficos');
    assert.ok(depois.reembolsosGasto.some((x) => x.txId === t.id));
  });
});

describe('N071 — o reembolso do Estado num imóvel abate a um gasto', () => {
  beforeEach(() => casaComRendas());

  test('um IMI devolvido pela AT no imóvel é reembolsoGasto com o tipo estado, e a Declaração aponta-o; o do IRS, sem imóvel, fica fora', () => {
    despesa('Impostos', 'IMI', 600, { date: '2026-05-15' });
    const t = receita('Reembolsos', 'Estado', 250, { label: 'IMI devolvido' });
    igual(papel(t), { papel: 'reembolsoGasto', natureza: null, tipo: 'estado' });
    assert.ok(declaracao().reembolsosGasto.some((x) => x.txId === t.id), 'está na lista dos reembolsos de um gasto');
    igual(papel(app.normTx({ kind: 'income', amount: 900, date: '2026-08-01', category: 'Reembolsos', sub: 'Estado' })), { papel: 'fora', natureza: null });
  });
});

/* ---------------------------------------------------------------- N133 */

describe('N133 — a subcategoria que decide a coluna', () => {
  beforeEach(() => casaComRendas());

  test('nos Impostos, nos Seguros e nas Obras a subcategoria decide; no Condomínio, nos consumos e nos Outros não', () => {
    for (const c of ['Impostos', 'Seguros', 'Obras e benfeitorias', 'Serviços profissionais', 'Devoluções ao inquilino']) assert.equal(app.irsSubDecide('expense', c), true, c);
    for (const c of ['Condomínio', 'Água, luz e gás', 'Outros', 'Manutenção e reparações', 'Gestão e mediação', '']) assert.equal(app.irsSubDecide('expense', c), false, c || '(vazia)');
    assert.equal(app.irsSubDecide('income', 'Impostos'), false, 'só as despesas têm coluna');
    // uma categoria da pessoa sem regra, com uma subcategoria a que deu coluna
    app.db.settings.cats['Garagem'] = ['Portão', 'Luz'];
    assert.equal(app.irsSubDecide('expense', 'Garagem'), false);
    app.db.settings.irsMapa['Garagem / Portão'] = 'conservacao';
    assert.equal(app.irsSubDecide('expense', 'Garagem'), true);
    // fora dos totais continua: o IMI conta na mesma
    app.db.settings.exclude[app.excKey('cats', 'Impostos')] = true;
    assert.equal(app.irsSubDecide('expense', 'Impostos'), true);
  });
});

/* ---------------------------------------------------------------- N102 */

describe('N102 — as linhas do Splitwise apagadas de propósito vivem no imóvel', () => {
  beforeEach(() => casaComRendas());
  const chave = '2026-03-10|Canalizador|120.00|Maintenance';
  const importada = (id, k) => app.normTx({ id, kind: 'expense', label: 'Canalizador', amount: 120, date: '2026-03-10', propertyId: 'v1',
    category: 'Manutenção e reparações', src: 'splitwise', batch: 'b1', swKey: k });

  test('apagar uma importada guarda a linha na ficha do imóvel, com o dia, e não nas definições; o Anular tira-a', () => {
    semEcra();
    app.db.transactions.push(importada('SW1', chave));
    app.swIgnorar(app.db.transactions.find((t) => t.id === 'SW1'));
    const p = app.db.properties.find((x) => x.id === 'v1');
    igual(p.swIgnoradas, [{ id: app.swIdDaChave(chave), dia: '2026-11-17' }]);
    assert.match(p.swIgnoradas[0].id, /^id_[0-9a-f]{16}$/, 'sem a descrição nem o valor na ficha');
    igual(app.db.settings.swIgnoradas, []);
    app.swIgnorar(app.db.transactions.find((t) => t.id === 'SW1'));
    assert.equal(p.swIgnoradas.length, 1, 'a mesma linha uma vez só');
    app.swDesignorar(app.db.transactions.find((t) => t.id === 'SW1'));
    igual(p.swIgnoradas, []);
  });

  test('um colaborador sem «Editar a ficha» guarda-a nas definições (o servidor recusava a ficha inteira), e vale na mesma', () => {
    semEcra();
    app.CW = { cargos: { v1: { dono: false, perms: ['tx.view', 'tx.add'] } } };
    app.db.transactions.push(importada('SW1', chave));
    app.swIgnorar(app.db.transactions.find((t) => t.id === 'SW1'));
    assert.equal(app.db.properties.find((x) => x.id === 'v1').swIgnoradas, undefined, 'a ficha não muda');
    igual(app.db.settings.swIgnoradas, [chave]);
    assert.ok(app.swIgnoradasDoImovel('v1').has(app.swIdDaChave(chave)));
  });

  test('a ficha normaliza a lista: as chaves em texto passam a id, um id fora da forma cai, e a mesma linha fica uma vez', () => {
    const p = app.normProp({ id: 'x', swIgnoradas: [chave, { id: app.swIdDaChave(chave), dia: '2026-02-30' }, { id: 'lixo', dia: '2026-01-01' }, 7, null,
      { id: 'id_0123456789abcdef', dia: '2026-01-02' }] });
    igual(p.swIgnoradas, [{ id: app.swIdDaChave(chave), dia: '' }, { id: 'id_0123456789abcdef', dia: '2026-01-02' }]);
    assert.equal(Object.prototype.hasOwnProperty.call(app.normProp({ id: 'y' }), 'swIgnoradas'), false, 'uma casa que nunca as teve não ganha o campo');
  });
});

/* Um cliente a sério: a app inteira com a nuvem, o fetch ligado ao worker e a
   sessão da conta; o que pinta calado.
   Recebe: env; quem — a conta.
   Devolve: o proxy da app. */
function cliente(env, quem) {
  const a = carregarTudo({ hoje: '2026-11-17' });
  a.fetch = (url, opts) => {
    opts = opts || {};
    return handleApi(new Request('https://app.x.pt' + url, { method: opts.method || 'GET', headers: opts.headers, body: opts.body }), env, { waitUntil() {} });
  };
  a.toast = () => {};
  a.setSyncBadge = () => {};
  a.render = () => {};
  a.buildNav = () => {};
  a.closeAllModals = () => {};
  a.subirPendentes = () => {};
  a.CW.user = { id: quem.id, name: quem.name, email: quem.email, token: quem.token };
  return a;
}
// Lê o estado como o ciclo lê e desarma o envio que ele agenda.
async function ler(a) { await a.pullNow(true); a.clearTimeout(a.pushTimer); }
// Envia já o que houver por enviar.
async function enviar(a) { a.clearTimeout(a.pushTimer); await a.pushNow(); a.clearTimeout(a.pushTimer); }
/* O que a pré-visualização da importação faz a cada linha de um CSV, num cliente.
   Recebe: a — o cliente; linhas — as linhas do CSV (sem o cabeçalho).
   Devolve: {descrição: tipo}. */
function previa(a, linhas) {
  const t = ['Date,Description,Category,Cost,Currency,Ana,Bruno', ...linhas].join('\n');
  const rows = a.parseCsv(t, a.splitDelim(t.split('\n')[0]));
  a.swHead = rows[0].map((h) => String(h).trim());
  a.swRows = rows.slice(1);
  const out = {};
  for (const l of a.swPrepare({ pid: 'H1', desde: '' }).linhas) out[l.label] = l.tipo;
  return out;
}
const casaH1 = { name: 'Soure', address: '', freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '1' };
const linhaCanalizador = '2026-03-10,Canalizador,Maintenance,120.00,EUR,120.00,-120.00';
const linhaJantar = '2026-04-12,Jantar de anos,Maintenance,80.00,EUR,80.00,-80.00';
const sw = (id, label, date, amount, swKey) => ({ id, kind: 'expense', label, amount, date, propertyId: 'H1', category: 'Manutenção e reparações', sub: '',
  src: 'splitwise', batch: 'b1', swKey });
// a casa da ficha no servidor
const casaNaBase = async (env, id) => JSON.parse((await env.DB.prepare('SELECT data FROM houses WHERE id = ?').bind(id).first()).data);

describe('N102 — com a nuvem: a marca é da casa, para todas as contas e todos os aparelhos', () => {
  test('duas contas na mesma casa: a despesa que a Bia apagou não volta na reimportação da Ana', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana'), B = await conta(env, 'Bia');
    await casa(env, A, 'H1', casaH1);
    await comproprietario(env, A, B, ['H1']);
    await registo(env, 'H1', 'tx', 'SW1', sw('SW1', 'Canalizador', '2026-03-10', 120, '2026-03-10|Canalizador|120.00|Maintenance'), A);
    await registo(env, 'H1', 'tx', 'SW2', sw('SW2', 'Jantar de anos', '2026-04-12', 80, '2026-04-12|Jantar de anos|80.00|Maintenance'), A);
    const cA = cliente(env, A), cB = cliente(env, B);
    await ler(cA); await ler(cB);
    cB.delTx('SW2');
    await enviar(cB);
    assert.deepEqual((await casaNaBase(env, 'H1')).swIgnoradas.map((x) => x.id), [cB.swIdDaChave('2026-04-12|Jantar de anos|80.00|Maintenance')], 'na ficha da casa');
    igual(cB.db.settings.swIgnoradas, [], 'e não nas definições da Bia');
    await ler(cA);
    igual(previa(cA, [linhaCanalizador, linhaJantar]), { 'Canalizador': 'repetida', 'Jantar de anos': 'ignorada' });
  });

  test('uma conta, dois aparelhos que apagam linhas diferentes antes de se lerem: ficam as duas', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await casa(env, A, 'H1', casaH1);
    await registo(env, 'H1', 'tx', 'SW1', sw('SW1', 'Canalizador', '2026-03-10', 120, '2026-03-10|Canalizador|120.00|Maintenance'), A);
    await registo(env, 'H1', 'tx', 'SW2', sw('SW2', 'Jantar de anos', '2026-04-12', 80, '2026-04-12|Jantar de anos|80.00|Maintenance'), A);
    const tel = cliente(env, A), comp = cliente(env, A);
    await ler(tel); await ler(comp);
    tel.delTx('SW1');
    comp.delTx('SW2');
    await enviar(tel); await enviar(comp);
    await ler(tel); await ler(comp);
    assert.equal((await casaNaBase(env, 'H1')).swIgnoradas.length, 2, 'a fusão a três junta as duas pelo id');
    for (const a of [tel, comp]) igual(previa(a, [linhaCanalizador, linhaJantar]), { 'Canalizador': 'ignorada', 'Jantar de anos': 'ignorada' });
  });
});

/* -------------------------------------------------------- N004 e N038 */

describe('N004 e N038 — os cartões da cópia de segurança e do Splitwise', () => {
  beforeEach(() => casaComRendas());

  test('sem sessão, repor substitui os dados do aparelho; com sessão, o que outros registaram e o que é mais recente fica', () => {
    assert.match(app.vImport(), /Repor substitui os dados deste aparelho pelos da cópia e mostra antes o que sai\./);
    assert.doesNotMatch(app.vImport(), /Repor substitui tudo o que está na app/);
    app.CW = { user: { id: 'ana' } };
    assert.match(app.vImport(), /Repor traz de volta o que a cópia tem e mostra antes o que muda; o que outros registaram e o que é mais recente do que a cópia fica\./);
  });

  test('o Splitwise lança o custo dos donos: sem a parte de quem não é dono', () => {
    const h = app.vImport();
    assert.match(h, /A app lança o custo de cada uma — sem a parte de quem não é dono, se o grupo tiver o inquilino — e a Declaração conta a tua quota do imóvel\./);
    assert.doesNotMatch(h, /A app lança o custo total de cada uma/);
  });
});

/* ------------------------------------------- as formas pedidas ao dados.js */

describe('as formas que outras partes da app pediram ao dados.js', () => {
  test('o arrendamento rural do contrato (N093): true ou false, só quando veio', () => {
    assert.equal('arrendamentoRural' in app.normFisco({}), false, 'um contrato que nunca o teve não muda de forma');
    assert.equal(app.normFisco({ arrendamentoRural: true }).arrendamentoRural, true);
    for (const lixo of ['sim', 1, {}, null]) assert.equal(app.normFisco({ arrendamentoRural: lixo }).arrendamentoRural, false, JSON.stringify(lixo));
  });

  test('o pagador e a cedência da natureza 02 (N076): só numa receita, só quando vêm, e repetem-se no planeado', () => {
    const t = app.normTx({ kind: 'income', pagadorNif: ' 501 234 567 ', pagadorNome: '  Antena\u0000Lda ', cedenciaNumero: 'x'.repeat(60) });
    assert.equal(t.pagadorNif, '501234567');
    assert.equal(t.pagadorNome, 'Antena Lda');
    assert.equal(t.cedenciaNumero.length, 40);
    const d = app.normTx({ kind: 'expense', pagadorNif: '501234567', cedenciaNumero: 'A1' });
    assert.equal('pagadorNif' in d || 'cedenciaNumero' in d, false, 'numa despesa saem');
    const r = app.normTx({ kind: 'income' });
    assert.equal('pagadorNif' in r || 'pagadorNome' in r || 'cedenciaNumero' in r, false, 'um movimento que nunca os teve não os ganha');
    for (const k of ['pagadorNif', 'pagadorNome', 'cedenciaNumero']) assert.ok(app.TX_TPL_KEYS.includes(k), k);
  });

  test('a parte de cada quarto (KAN-152), a parte subarrendada (N023) e o código do país sem os zeros (N105)', () => {
    const parte = (v) => app.normProp({ rooms: [{ id: 'r1', name: 'Q', parte: v }] }).rooms[0].parte;
    assert.equal(parte(undefined), null);
    assert.equal(parte(37.555), 37.56);
    assert.equal(parte(100), 100);
    for (const lixo of [0, -5, 100.01, '50', true, 0.001]) assert.equal(parte(lixo), null, JSON.stringify(lixo));
    assert.equal('parteArrendada' in app.normProp({ parteArrendada: 40 }), false, 'o campo único da casa já não existe');
    igual(app.normProp({ subarrendamento: { ativo: true, parte: 'toda', rendaParte: 450 } }).subarrendamento,
      { ativo: true, nifSenhorio: '', rendaMensal: 0, parte: 'toda', rendaParte: 450 });
    assert.equal(app.codigoDoPais('76'), '076');
    assert.equal(app.codigoDoPais(' 4 '), '004');
    assert.equal(app.codigoDoPais('0'), '');
  });
});
