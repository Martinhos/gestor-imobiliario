// Os dados de exemplo e os quadros 4.1 e 4.2 do Anexo F (KAN-78). A página da
// Declaração (fisco.js) mostra um cartão por quadro: o 4.1 com os contratos
// sem redução pela duração, o 4.2 com os de habitação permanente que a têm
// (e o 4.2A com as datas de cada um). O exemplo é o que quem testa vê numa
// conta nova do /test com dados — e só tinha contratos sem termo, todos no
// 4.1: o cartão do 4.2 nunca aparecia. O contrato do quarto 4 tem 10 anos de
// prazo, e é ele que o mostra.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, repor } from './arnes.js';

const app = carregarTudo();
app.render = () => {}; app.buildNav = () => {}; app.toast = () => {};
app.CW.ambiente = 'desenvolvimento';   // o seed() recusa-se em produção
app.seed();
app.clearTimeout(app.pushTimer);
afterEach(() => repor(app));
const ano = app.fiscoAnoAtual();
const r = app.resumoFiscal(ano);
const Q = r.versao.quadros;
/* o texto de um bocado de HTML, sem as etiquetas */
const texto = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('o exemplo tem contratos no quadro 4.1 e no quadro 4.2', () => {
  test('as linhas do Anexo F do ano da página caem nos dois quadros (4.1 e 4.2)', () => {
    assert.equal(Q.semReducao, '4.1');
    assert.equal(Q.comReducao, '4.2');
    const q41 = r.linhas.filter((l) => l.quadro === Q.semReducao);
    const q42 = r.linhas.filter((l) => l.quadro === Q.comReducao);
    assert.ok(q41.length >= 1, 'pelo menos um contrato no 4.1 (' + q41.length + ')');
    assert.ok(q42.length >= 1, 'pelo menos um contrato no 4.2 (' + q42.length + ')');
    assert.ok(q41.some((l) => l.nome === 'Ana Rodrigues'), 'o T2 Lisboa continua no 4.1');
  });

  test('o contrato do 4.2: habitação permanente, declarado, com prazo de 10 anos e a taxa pela duração', () => {
    const l = r.linhas.find((x) => x.quadro === Q.comReducao);
    const c = app.db.contracts.find((x) => x.id === l.contratoId);
    assert.equal(c.fisco.finalidade, 'hp', 'habitação permanente');
    assert.equal(app.ctDeclarado(c), true, 'declarado');
    assert.match(c.fisco.numero, /^\d{7}$/, 'com o número da AT');
    assert.ok(c.end, 'tem termo (sem ele não há duração nem redução)');
    const red = app.irsReducao(c, ano);
    assert.ok(red && red.meses >= 60, 'duração que dá redução (' + (red && red.meses) + ' meses)');
    assert.equal(l.taxaReduzida, true);
    assert.equal(l.motivoTaxa, 'duracao', 'a taxa é a da duração');
    assert.ok(l.rendas > 0, 'com rendas no ano: sem elas não há linha');
    assert.equal(l.datas.inicio, c.start, '4.2A: início');
    assert.equal(l.datas.fim, c.end, '4.2A: termo');
    c.tenantIds.forEach((id) => {
      const t = app.db.tenants.find((x) => x.id === id);
      assert.equal(app.nifValido(t.nif), true, t.name + ': NIF inventado que passa o dígito de controlo');
    });
    // um quarto livre: nenhum outro contrato no mesmo quarto
    assert.equal(app.db.contracts.filter((x) => x.propertyId === c.propertyId && x.roomId === c.roomId).length, 1, 'o quarto era livre');
  });

  test('a página pinta o cartão do quadro 4.2 com o contrato, e o do 4.1 sem ele', () => {
    const l = r.linhas.find((x) => x.quadro === Q.comReducao);
    const c42 = texto(app.fiscoQuadroCard(r, Q.comReducao));
    const c41 = texto(app.fiscoQuadroCard(r, Q.semReducao));
    assert.match(c42, /Quadro 4\.2 /, 'o cartão do 4.2 existe');
    assert.ok(c42.includes(l.nome), 'com o contrato do quarto 4');
    assert.ok(c42.includes('4.2A'), 'e as datas do 4.2A');
    assert.ok(!c41.includes(l.nome), 'que não aparece no 4.1');
    assert.ok(c41.includes('Ana Rodrigues'), 'o 4.1 continua com o T2 Lisboa');
  });

  test('o contrato novo não estraga o que os outros mostravam', () => {
    // o selo do contrato novo está nos gastos: nenhum aviso de selo esquecido
    assert.ok(!r.avisos.some((a) => /imposto do selo nos gastos/.test(a.texto)), 'sem aviso do selo');
    // a pintura e a caldeira continuam a ser obras antes do arrendamento do quarto 3
    const q3 = r.linhas.find((x) => x.nome.includes('Quarto 3'));
    assert.ok(q3 && q3.obras24.valor > 0, 'as obras dos 24 meses continuam no quarto 3');
    // o prazo do Modelo 2 do c4 e o dos recibos do T2 continuam
    assert.ok(r.avisos.some((a) => /por indicar se foi declarado/.test(a.texto)), 'o contrato por indicar');
    assert.ok(r.avisos.some((a) => /1 renda de \d{4} sem recibo/.test(a.texto)), 'uma renda só sem recibo, a do T2');
  });
});
