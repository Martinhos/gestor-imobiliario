// Dois comentários do Martinho de 2026-11-26 à vaga 2 da auditoria ao IRS:
// - KAN-127-9: o ⋯ de uma categoria que o IRS lê (definicoes.js:menuDaCategoria)
//   tinha um texto de ajuda («O IRS usa esta categoria: podes mudar-lhe o
//   nome.») que não fazia falta. Sai do ⋯; o delCat e o delSub continuam a
//   recusá-las com o aviso.
// - KAN-127-10: o cartão da situação fiscal (fisco.js:fiscoSituacaoCard)
//   fechava numa linha com um «Mudar» no canto, que não dizia o que fazia nem
//   porque importava. Agora diz o que está escolhido em frases inteiras
//   (fiscoSituacaoResumo), porque importa (fiscoSituacaoPorque) e o botão
//   chama-se «Mudar a situação fiscal». Desde o KAN-127-17 (2026-11-27) o
//   porquê está atrás do «?» do título (fisco.js:fisAjudaTexto), e à vista
//   fica só o resumo e o botão.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-03-15' });
afterEach(() => repor(app));

/* o texto de um bocado de HTML, sem as etiquetas e com as entidades do esc de volta */
const texto = (html) => String(html).replace(/<[^>]+>/g, ' ')
  .replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

/* uma renda de 2025 do contrato C1, já na base */
const renda = (mes) => app.db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 800, propertyId: 'v1',
  contractId: 'C1', recibo: true, date: '2025-' + String(mes).padStart(2, '0') + '-05' }));

beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'rui', name: 'Rui' }));
  /* um inquilino sem NIF nem país: a Declaração aponta-o em «A tratar» */
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago' }));
  app.db.properties.push(app.normProp({ id: 'v1', name: 'T2 Lumiar', ownerIds: ['ana'], freguesiaCodigo: '110621', tipoPredio: 'U', matrix: '7000', fraction: 'C' }));
  app.db.contracts.push(app.normContract({ id: 'C1', name: 'Lumiar', propertyId: 'v1', tenantIds: ['t1'], rent: 800, active: true, start: '2024-01-01',
    fisco: { estado: 'declarado', numero: '1010101', finalidade: 'hp' } }));
  for (let m = 1; m <= 12; m++) renda(m);
  app.CW = { user: { id: 'ana' }, _esperaFim: true };
  app.fiscoAno = '2025';
  app.fiscoSitAberta = null;
  app.render = () => {};
  app.toast = () => {};
});

describe('KAN-127-9 · o ⋯ de uma categoria do IRS sem o texto de ajuda', () => {
  /* o ⋯ de uma linha, pelo id do menu */
  const menuDe = (h, id) => { const i = h.indexOf('id="menu_' + id + '"'); assert.ok(i > -1, 'há o menu ' + id); return h.slice(i, h.indexOf('</span>', h.indexOf('</div>', i)) + 7); };

  test('o ⋯ das Rendas e da Caução: «Mudar o nome…», sem «Apagar» e sem nota', () => {
    const h = app.vCats('catsIn');
    const ks = Object.keys(app.db.settings.catsIn), i = ks.indexOf('Rendas'), j = app.db.settings.catsIn.Rendas.indexOf('Caução');
    const cat = menuDe(h, 'dc_catsIn_' + i), sub = menuDe(h, 'ds_catsIn_' + i + '_' + j);
    for (const m of [cat, sub]) {
      assert.doesNotMatch(m, /def-menu-nota|O IRS usa esta|podes mudar-lhe o nome/, 'sem o texto de ajuda');
      assert.doesNotMatch(m, /del(Cat|Sub)\(/, 'sem «Apagar»');
      assert.doesNotMatch(m, /<p[ >]/, 'só botões');
    }
    assert.match(cat, /mudarNomeCategoria\(/);
    // uma categoria sem id continua com o «Apagar»
    assert.match(menuDe(h, 'dc_catsIn_' + ks.indexOf('Empréstimos recebidos')), /delCat\('catsIn','Empréstimos recebidos'\)/);
  });

  test('o delCat e o delSub continuam a recusá-las, com o aviso', () => {
    let dito = '';
    app.toast = (m) => { dito = m; };
    app.save = () => {};
    app.delCat('catsIn', 'Rendas');
    assert.ok(app.db.settings.catsIn.Rendas);
    assert.equal(dito, 'O IRS usa esta categoria: podes mudar-lhe o nome.');
  });
});

describe('KAN-127-10 · a situação fiscal diz o que está escolhido, porque importa e o que o botão faz', () => {
  /* o cartão da situação de 2025, como a página o desenha (sem forçar aberto nem fechado) */
  const cartao = () => app.fiscoSituacaoCard(app.resumoFiscal(2025, 'ana'));
  const PORQUE = 'Daqui depende o Anexo F de 2025. Em separado entram só as tuas rendas; em conjunta, as do cônjuge que estão nesta app juntam-se às tuas numa só declaração, e o imposto estimado muda com elas. A dispensa dos recibos eletrónicos muda o que fica a tratar antes de entregar.';

  test('fechado: o que está escolhido, o porquê no «?» e «Mudar a situação fiscal» por baixo', () => {
    const h = cartao(), t = texto(h);
    assert.match(h, /<h2 class="ana-tit">A tua situação fiscal em 2025<\/h2><span class="small">Declaração em separado, és o titular A · passas recibos eletrónicos<\/span><span class="ana-extra"><button type="button" class="ct-ajuda fis-ajuda" id="fis_aj_situacao"[^>]*data-click="fisExplicar\('situacao',2025\)" aria-label="Explicar: A tua situação fiscal"/,
      'o resumo em frases, logo por baixo do título, e o «?» no canto do cabeçalho (KAN-127-17)');
    assert.ok(!t.includes(PORQUE), 'o porquê já não está à vista');
    assert.equal(app.fisAjudaTexto('situacao', 2025)[0], PORQUE, 'está no «?»');
    assert.match(h, /<p class="fis-sit-nota fis-sit-mudar"><button type="button" class="btn sm" id="fiscoSitMudar" data-toca="nada" data-click="fiscoSitMudar\(true\)" aria-expanded="false" aria-controls="fiscoSitCorpo">Mudar a situação fiscal<\/button><\/p><div class="fis-sit-corpo" id="fiscoSitCorpo" hidden>/);
    assert.doesNotMatch(h, />Mudar<\/button>/, 'nunca um «Mudar» sozinho');
    assert.doesNotMatch(t, /Modelo 44/, 'o Modelo 44 só se nomeia com a dispensa (N063)');
    assert.doesNotMatch(h, /style=|onclick=/);
  });

  test('aberto: «Fechar» no mesmo sítio, e os interruptores por baixo, cada um com o seu «?»', () => {
    app.fiscoSitMudar(true);
    const h = cartao(), t = texto(h);
    assert.ok(!t.includes(PORQUE));
    assert.match(h, /aria-expanded="true" aria-controls="fiscoSitCorpo">Fechar<\/button><\/p><div class="fis-sit-corpo" id="fiscoSitCorpo">/);
    assert.match(t, /^A tua situação fiscal em 2025 Grava ao mexer\./);
    assert.match(h, /data-click="fisExplicar\('conjunta',2025\)"/);
    assert.match(h, /data-click="fisExplicar\('dispensa',2025\)"/);
    assert.match(h, /id="fiscoConjunta"/);
    app.fiscoSitMudar(false);
    assert.match(cartao(), /id="fiscoSitCorpo" hidden/);
  });

  test('o resumo de cada situação, em frases inteiras', () => {
    const resumo = (s) => app.fiscoSituacaoResumo({ ano: 2025, titularId: 'ana', porInteiro: false }, s);
    assert.equal(resumo({ conjunta: false }), 'Declaração em separado, és o titular A · passas recibos eletrónicos');
    assert.equal(resumo({ conjunta: true, conjugeId: 'rui', minhaLetra: 'B', dispensaRecibos: true }), 'Declaração conjunta com Rui, és o titular B · tens dispensa dos recibos eletrónicos');
    assert.equal(resumo({ conjunta: true, bensComuns: true, minhaLetra: 'A' }), 'Declaração conjunta com os bens comuns do casal, és o titular A · passas recibos eletrónicos');
    assert.equal(resumo({ conjunta: true }), 'Declaração conjunta, sem o cônjuge escolhido · passas recibos eletrónicos');
    assert.equal(app.fiscoSituacaoResumo({ ano: 2025, porInteiro: true }, { conjunta: true }), 'Declaração conjunta · passas recibos eletrónicos');
  });

  test('cada ano diz o seu: o título, o porquê e o que se grava são do ano da página', () => {
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: true, conjugeId: 'rui', minhaLetra: 'A' } } });
    const h26 = app.fiscoSituacaoCard(Object.assign(app.resumoFiscal(2026, 'ana'), { ano: 2026 }), false);
    assert.match(h26, /A tua situação fiscal em 2026<\/h2><span class="small">Declaração conjunta com Rui, és o titular A/);
    assert.match(app.fisAjudaTexto('situacao', 2026)[0], /^Daqui depende o Anexo F de 2026\./);
    assert.match(cartao(), /Declaração em separado, és o titular A/, '2025 continua em separado');
  });
});
