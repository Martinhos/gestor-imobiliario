// Os planeados que a pessoa cria identificam-se como «personalizado» (o selo
// da lista, planeados.js:recOrigem) e o filtro do estado chama-lhes
// «Personalizados» (planeados.js:REC_ESTADOS, com o valor 'manual' de
// sempre). A secção dos Modelos já não tem o «Novo modelo» ao lado do título
// (o vazio continua com o seu), e o + dos Planeados põe o «Modelo» à cabeça,
// com o «Movimento recorrente», os dois «neste ecrã»
// (acessos.js:outrasDoSeparador, navegacao.js:abrirAdicionar).
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, igual } from './arnes.js';

const app = carregarApp({ hoje: '2026-09-06' });
beforeEach(() => { limpar(app); app.render = () => {}; app.buildNav = () => {}; app.toast = () => {}; });
afterEach(() => repor(app));

/* Uma casa minha com um planeado criado por mim e um modelo. */
function planeados() {
  app.db.owners.push(app.normPerson({ id: 'o1', name: 'Ana' }));
  app.db.properties.push(app.normProp({ id: 'p1', name: 'Casa', ownerIds: ['o1'] }));
  app.db.recurring.push(app.normRec({ id: 'rm', name: 'Limpeza das escadas', every: 'month', next: '2026-10-05',
    tx: { kind: 'expense', label: 'Limpeza das escadas', amount: 30, propertyId: 'p1' } }));
  app.db.templates.push(app.normTpl({ id: 'm1', name: 'Luz', tx: { kind: 'expense', label: 'Luz', amount: 30, propertyId: 'p1' } }));
}
const botao = (act) => 'data-click="' + act + '"';

describe('o selo e o filtro dos planeados criados pela pessoa', () => {
  test('recOrigem: «personalizado» a cinzento, como os irmãos em minúsculas; os automáticos como antes', () => {
    assert.equal(app.recOrigem({ auto: false, tx: {} }), '<span class="badge grey">personalizado</span>');
    assert.equal(app.recOrigem(null), '<span class="badge grey">personalizado</span>');
    assert.equal(app.recOrigem({ auto: true, tx: { loanId: 'a' } }), '<span class="badge loan">da hipoteca</span>');
    assert.equal(app.recOrigem({ auto: true, tx: { propRec: 'imi' } }), '<span class="badge grey">do imóvel</span>');
    assert.equal(app.recOrigem({ auto: true, tx: {} }), '<span class="badge">do contrato</span>');
  });

  test('a lista e o filtro do estado dizem «personalizado» e «Personalizados», e nunca «à mão»', () => {
    planeados();
    const html = app.vRecurring();
    assert.match(html, /<span class="badge grey">personalizado<\/span>/);
    assert.match(html, /id="pop_lfc_lrec_st"[\s\S]*?<span>Personalizados · 1<\/span>/);
    assert.doesNotMatch(html, /à mão/);
    app.recChip('manual');
    const so = app.vRecurring();
    assert.match(so, /<span id="lab_lfc_lrec_st">Personalizados<\/span>/, 'o chip ligado diz o estado');
    assert.match(so, /data-lp="rec:rm"/);
    assert.match(so, /<h2>Modelos<\/h2>[\s\S]*tplView\('m1'\)/, 'os modelos ficam, que são todos da pessoa');
    app.recChip('');
  });
});

describe('o «Novo modelo» sai da secção e o «Modelo» sobe no + dos Planeados', () => {
  test('com modelos, a secção só tem o título; sem modelos, o vazio continua com o seu «Novo modelo»', () => {
    planeados();
    const html = app.vRecurring();
    assert.match(html, /<div class="plan-cab"><h2>Modelos<\/h2><\/div>/);
    assert.ok(!html.includes(botao('newTpl()')), 'nenhum «Novo modelo» na página com modelos');
    app.db.templates = [];
    const vazio = app.vRecurring();
    assert.match(vazio, /Sem modelos/);
    assert.ok(vazio.includes(botao('newTpl()')), 'o vazio convida, como os outros vazios');
  });

  test('o + nos Planeados: «Movimento recorrente» e «Modelo» à cabeça, os dois «neste ecrã», sem se repetirem em baixo', () => {
    planeados();
    let aberta = null;
    app.openModal = (title, body) => { aberta = { title, body }; };
    const corridas = [];
    app.correrAcao = (t) => { corridas.push(t); };
    app.closeModal = () => {};
    app.tab = 'recurring';
    app.abrirAdicionar();
    const corpo = aberta.body, i = corpo.indexOf('Novo movimento');
    const topo = /<div class="criar-outros criar-aqui">([\s\S]*?)<\/div>/.exec(corpo);
    assert.ok(topo && topo.index < i, 'o bloco do ecrã por cima dos tipos de movimento');
    const aqui = [...topo[1].matchAll(/criarEscolha\((\d+)\)"><svg[\s\S]*?<\/svg><span>([^<]+)<small>neste ecrã<\/small>/g)].map((m) => [Number(m[1]), m[2]]);
    igual(aqui.map((x) => x[1]), ['Movimento recorrente', 'Modelo']);
    assert.equal((corpo.match(/neste ecrã/g) || []).length, 2);
    assert.equal((corpo.match(/<span>Modelo(<small>|<\/span>)/g) || []).length, 1, 'o Modelo aparece uma vez só');
    assert.match(corpo, /criarEscolha\(0\)[^>]*><span class="ic in">/, 'as posições 0…4 continuam a ser os cinco tipos');
    app.criarEscolha(aqui[1][0]);
    igual(corridas, ['newTpl()']);
  });

  test('noutros ecrãs o «Modelo» fica em «Outros registos», sem marca; sem poder criar planeados, não sobe', () => {
    planeados();
    let aberta = null;
    app.openModal = (title, body) => { aberta = { title, body }; };
    app.tab = 'contracts';
    app.abrirAdicionar();
    assert.match(aberta.body, /Outros registos[\s\S]*<span>Modelo<\/span>/);
    assert.equal((aberta.body.match(/neste ecrã/g) || []).length, 1, 'só o Contrato');
    igual(app.outrasDoSeparador('recurring'), ['modelo']);
    igual(app.outrasDoSeparador('contracts'), []);
    igual(app.outrasDoSeparador(''), []);
  });
});
