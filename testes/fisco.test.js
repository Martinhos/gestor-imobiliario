// Fisco: o resumo do quadro 4.1 do Anexo F — rendas ilíquidas e retenções,
// gastos por coluna, obras dos 24 meses sem dupla contagem, o não declarado
// fora, a quota-parte do titular, as faltas apontadas, o CSV, a vista e o
// separador na navegação.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar } from './arnes.js';

const app = carregarApp();
const perto = (a, b, tol = 0.01) =>
  assert.ok(Math.abs(a - b) <= tol, `esperava ${b} (±${tol}), veio ${a}`);
const ANO = 2024;   // fixo: o resumo é de um ano, e o teste não pode depender do dia

const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra));
  app.db.transactions.push(t);
  return t;
};

beforeEach(() => {
  limpar(app);
  app.fiscoAno = String(ANO);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Vera' }));
  app.db.properties.push(
    app.normProp({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 60, bruno: 40 },
      freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }),
    app.normProp({ id: 'v2', name: 'T1 Benfica', ownerIds: ['ana'] }),
  );
  app.db.contracts.push(
    app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: `${ANO}-01-01`, active: true,
      fisco: { estado: 'declarado', numero: '1234567', finalidade: 'hp' } }),
    app.normContract({ id: 'C2', name: 'Benfica', propertyId: 'v2', tenantIds: ['t2'], rent: 400, start: `${ANO - 1}-06-01`, active: true,
      fisco: { estado: 'naoDeclarado' } }),
  );
  for (let i = 1; i <= 12; i++) {
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1',
      date: `${ANO}-${String(i).padStart(2, '0')}-05`, retencao: i <= 2 ? 250 : 0, recibo: i <= 10 });
  }
  mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 300, date: ANO + '-04-10' });
  mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 120, date: ANO + '-02-10' });
  mov({ kind: 'expense', category: 'Mobiliário e equipamento', sub: 'Mobiliário', amount: 500, date: ANO + '-05-10' });
  mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pintura', label: 'Pintura', amount: 200, date: `${ANO - 1}-07-01` });
  for (let i = 1; i <= 3; i++) mov({ kind: 'income', category: 'Rendas', amount: 400, propertyId: 'v2', contractId: 'C2', date: `${ANO}-0${i}-05` });
});

describe('o resumo do quadro 4.1', () => {
  test('uma linha por contrato declarado, com rendas ilíquidas, retenções e gastos por coluna', () => {
    const r = app.resumoFiscal(ANO, '');
    assert.equal(r.linhas.length, 1);
    const l = r.linhas[0];
    assert.equal(l.contratoId, 'C1');
    perto(l.rendas, 12500, 1e-9);            // 12 × 1000 + 2 × 250 retidos na fonte
    perto(l.retencoes, 500, 1e-9);
    perto(l.gastos.imi, 300, 1e-9);
    perto(l.gastos.condominio, 120, 1e-9);
    perto(l.gastos.outros, 0, 1e-9);
    perto(l.gastos.conservacao, 0, 1e-9, 'a pintura não entra em conservação: é obra dos 24 meses');
    const soma = Object.keys(l.gastos).reduce((n, k) => n + l.gastos[k], 0);
    perto(soma, 420, 1e-9, 'o mobiliário não é dedutível e fica fora');
    assert.equal(l.quota, 1);
    assert.equal(l.natureza, '07');
    assert.equal(l.atNumero, '1234567');
    assert.equal(l.inicio, `${ANO}-01-01`);
    assert.deepEqual(JSON.parse(JSON.stringify(l.inquilinos)), [{ id: 't1', nome: 'Tiago', nif: '123456789', pais: '' }]);
    assert.equal(l.freguesiaCodigo, '110623');
    assert.equal(l.tipoPredio, 'U');
    assert.equal(l.artigo, '4651');
    assert.equal(l.fracao, 'A');
    assert.equal(l.taxaReduzida, false, 'sem data de fim vale 25 %');
  });

  test('a pintura seis meses antes do início vai para as obras dos 24 meses, com a data do gasto mais antigo', () => {
    const r = app.resumoFiscal(ANO, '');
    const l = r.linhas[0];
    perto(l.obras24.valor, 200, 1e-9);
    assert.equal(l.obras24.inicioGastos, `${ANO - 1}-07-01`);
    perto(r.totais.obras24, 200, 1e-9);
    // no ano anterior a pintura não conta como gasto normal: pertence ao contrato que começou depois
    app.db.contracts.push(app.normContract({ id: 'C0', propertyId: 'v1', tenantIds: ['t1'], rent: 900, start: `${ANO - 2}-01-01`, end: `${ANO - 1}-03-31`, active: false,
      fisco: { estado: 'declarado', numero: '111' } }));
    mov({ kind: 'income', category: 'Rendas', amount: 900, contractId: 'C0', date: `${ANO - 1}-02-05` });
    const ant = app.resumoFiscal(ANO - 1, '');
    assert.equal(ant.linhas.length, 1);
    perto(ant.linhas[0].gastos.conservacao, 0, 1e-9, 'sem dupla contagem: a obra é do contrato seguinte');
    perto(ant.linhas[0].obras24.valor, 0, 1e-9, 'e não é obra do contrato antigo, que já estava a decorrer');
  });

  test('uma reparação durante um contrato em vigor é conservação, não obra dos 24 meses', () => {
    app.db.contracts.push(app.normContract({ id: 'C0', propertyId: 'v1', tenantIds: ['t1'], rent: 900, start: `${ANO - 2}-01-01`, end: `${ANO - 1}-12-31`, active: false }));
    mov({ kind: 'income', category: 'Rendas', amount: 900, contractId: 'C0', date: `${ANO - 1}-07-05` });
    const ant = app.resumoFiscal(ANO - 1, '');
    perto(ant.linhas[0].gastos.conservacao, 200, 1e-9);
    perto(app.resumoFiscal(ANO, '').linhas[0].obras24.valor, 0, 1e-9);
  });

  test('o contrato não declarado fica fora, com o valor e sem entrar nos totais', () => {
    const r = app.resumoFiscal(ANO, '');
    assert.equal(r.fora.length, 1);
    assert.equal(r.fora[0].contratoId, 'C2');
    perto(r.fora[0].rendas, 1200, 1e-9);
    assert.equal(r.fora[0].n, 3);
    perto(r.totais.rendas, 12500, 1e-9, 'os totais são só das linhas');
    perto(r.totais.retencoes, 500, 1e-9);
    perto(r.totais.gastos.imi, 300, 1e-9);
    perto(r.totais.gastos.condominio, 120, 1e-9);
    const neutro = r.avisos.find((a) => /não declarad/.test(a.texto));
    assert.ok(neutro && /fica fora deste resumo\.$/.test(neutro.texto), 'a frase é neutra');
    assert.equal(neutro.abrir, '', 'e não pede nada');
  });

  test('com um titular tudo entra na quota-parte dele', () => {
    const r = app.resumoFiscal(ANO, 'ana');
    assert.equal(r.titularId, 'ana');
    const l = r.linhas[0];
    perto(l.quota, 0.6, 1e-9);
    perto(l.rendas, 7500, 1e-9);
    perto(l.retencoes, 300, 1e-9);
    perto(l.gastos.imi, 180, 1e-9);
    perto(l.gastos.condominio, 72, 1e-9);
    perto(l.obras24.valor, 120, 1e-9);
    perto(r.fora[0].rendas, 1200, 1e-9, 'o Benfica é só da Ana');
    const b = app.resumoFiscal(ANO, 'bruno');
    perto(b.linhas[0].rendas, 5000, 1e-9);
    assert.equal(b.fora.length, 0, 'o Bruno não é dono do Benfica');
    assert.equal(b.imoveis, 1);
  });

  test('as faltas: nada falta ao contrato completo; sem NIF do inquilino aparece uma', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(app.resumoFiscal(ANO, '').linhas[0].faltas)), []);
    app.db.tenants.find((t) => t.id === 't1').nif = '';
    const l = app.resumoFiscal(ANO, '').linhas[0];
    assert.equal(l.faltas.length, 1);
    assert.match(l.faltas[0], /NIF ou país do inquilino Tiago/);
    app.db.tenants.find((t) => t.id === 't1').nif = '123456780';   // dígito de controlo errado
    assert.match(app.resumoFiscal(ANO, '').linhas[0].faltas[0], /não bate certo/);
    app.db.tenants.find((t) => t.id === 't1').nif = '';
    app.db.tenants.find((t) => t.id === 't1').pais = 'Espanha';
    assert.deepEqual(JSON.parse(JSON.stringify(app.resumoFiscal(ANO, '').linhas[0].faltas)), [], 'o país substitui o NIF');
    const p = app.db.properties.find((x) => x.id === 'v1');
    p.freguesiaCodigo = ''; p.tipoPredio = ''; p.matrix = '';
    app.db.contracts.find((c) => c.id === 'C1').fisco.numero = '';
    const f = app.resumoFiscal(ANO, '').linhas[0].faltas;
    assert.deepEqual(JSON.parse(JSON.stringify(f)), ['n.º do contrato na AT', 'código da freguesia', 'tipo de prédio', 'artigo matricial']);
  });

  test('os recibos por emitir contam-se só no contrato declarado, e viram aviso', () => {
    const r = app.resumoFiscal(ANO, '');
    assert.equal(r.linhas[0].recibosPorEmitir, 2);
    const a = r.avisos.find((x) => /recibo/.test(x.texto));
    assert.ok(a, 'há um aviso');
    assert.match(a.texto, /^2 rendas de 2024 sem recibo/);
    assert.equal(a.abrir, "ctView('C1')");
    assert.equal(a.toca, 'camada');
  });

  test('uma despesa sem regra de dedução conta em Outros e é apontada', () => {
    mov({ kind: 'expense', category: 'Coisas várias', amount: 50, date: ANO + '-06-10' });
    const r = app.resumoFiscal(ANO, '');
    assert.equal(r.semRegra, 1);
    perto(r.linhas[0].gastos.outros, 50, 1e-9);
    const a = r.avisos.find((x) => /sem regra de dedução/.test(x.texto));
    assert.ok(a);
    assert.match(a.texto, /IRS e dedução/);
    assert.equal(a.abrir, "go('settings');goSet('irs')");
    // uma despesa marcada à mão com a coluna manda sobre a categoria
    mov({ kind: 'expense', category: 'Coisas várias', amount: 70, irsCol: 'taxas', date: ANO + '-06-11' });
    const r2 = app.resumoFiscal(ANO, '');
    assert.equal(r2.semRegra, 1);
    perto(r2.linhas[0].gastos.taxas, 70, 1e-9);
  });

  test('rendas sem contrato ficam à parte, por imóvel; um contrato apagado conta como sem contrato', () => {
    mov({ kind: 'income', category: 'Rendas', amount: 350, contractId: null, date: ANO + '-07-05' });
    mov({ kind: 'income', category: 'Rendas', amount: 150, contractId: 'apagado', date: ANO + '-08-05' });
    const r = app.resumoFiscal(ANO, '');
    assert.equal(r.semContrato.length, 1);
    assert.equal(r.semContrato[0].imovel, 'T2 Arroios');
    perto(r.semContrato[0].rendas, 500, 1e-9);
    assert.equal(r.semContrato[0].n, 2);
    perto(r.linhas[0].rendas, 12500, 1e-9, 'não entram na linha');
    const a = r.avisos.find((x) => /sem contrato/.test(x.texto));
    assert.equal(a.abrir, "go('transactions')");
  });

  test('os gastos de um imóvel com dois contratos repartem-se pelas rendas de cada um', () => {
    app.db.contracts.push(app.normContract({ id: 'C3', propertyId: 'v1', tenantIds: ['t2'], rent: 300, start: `${ANO}-01-01`, active: true, roomId: 'q' }));
    for (let i = 1; i <= 12; i++) mov({ kind: 'income', category: 'Rendas', amount: 250, contractId: 'C3', date: `${ANO}-${String(i).padStart(2, '0')}-06` });
    const r = app.resumoFiscal(ANO, '');
    const c1 = r.linhas.find((l) => l.contratoId === 'C1'), c3 = r.linhas.find((l) => l.contratoId === 'C3');
    // C1 12 500, C3 3 000 → 80,6 % / 19,4 %
    perto(c1.gastos.imi + c3.gastos.imi, 300, 1e-9);
    perto(c3.gastos.imi, 300 * 3000 / 15500, 0.005, 'ao cêntimo');
    perto(c1.obras24.valor + c3.obras24.valor, 200, 1e-9, 'a obra reparte-se pelos dois contratos que começaram no mesmo dia');
  });

  test('um movimento de grupo é obra num imóvel vago e gasto corrente noutro, sem se perder nem se repetir', () => {
    app.db.properties.push(app.normProp({ id: 'v3', name: 'T0 Alvalade', ownerIds: ['ana'] }));
    app.db.contracts.push(app.normContract({ id: 'C4', propertyId: 'v3', tenantIds: ['t1'], rent: 500, start: `${ANO + 1}-01-01`, active: true,
      fisco: { estado: 'declarado', numero: '999' } }));
    app.db.groups.push(app.normGroup({ id: 'G', name: 'Lisboa', kind: 'prop', ids: ['v1', 'v3'] }));
    mov({ kind: 'expense', category: 'Manutenção e reparações', amount: 1000, propertyId: null, groupId: 'G', date: ANO + '-06-01' });
    const r = app.resumoFiscal(ANO, '');
    perto(r.linhas[0].gastos.conservacao, 500, 1e-9, 'a metade do Arroios é conservação de um contrato em vigor');
    perto(r.linhas[0].obras24.valor, 200, 1e-9);
    mov({ kind: 'income', category: 'Rendas', amount: 500, propertyId: 'v3', contractId: 'C4', date: `${ANO + 1}-01-05` });
    const seg = app.resumoFiscal(ANO + 1, '');
    const c4 = seg.linhas.find((l) => l.contratoId === 'C4');
    perto(c4.obras24.valor, 500, 1e-9, 'a metade do Alvalade é obra do contrato que começou depois');
    assert.equal(c4.obras24.inicioGastos, ANO + '-06-01');
    perto(c4.gastos.conservacao, 0, 1e-9);
  });

  test('uma despesa marcada como obras24 sem contrato a começar depois fica de fora, e diz-se', () => {
    mov({ kind: 'expense', category: 'Obras e benfeitorias', amount: 800, irsCol: 'obras24', date: ANO + '-09-01' });
    const r = app.resumoFiscal(ANO, '');
    assert.equal(r.obrasSoltas, 1);
    perto(r.linhas[0].obras24.valor, 200, 1e-9, 'não entra nas obras');
    perto(r.linhas[0].gastos.conservacao, 0, 1e-9, 'nem nas colunas');
    const a = r.avisos.find((x) => /obras dos 24 meses/.test(x.texto));
    assert.ok(a && /sem contrato a começar depois/.test(a.texto));
  });

  test('uma caução não é renda, e uma renda de contrato futuro não conta antes de entrar', () => {
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 2000, contractId: 'C1', date: ANO + '-01-02' });
    perto(app.resumoFiscal(ANO, '').linhas[0].rendas, 12500, 1e-9);
    assert.equal(app.resumoFiscal(ANO + 1, '').linhas.length, 0);
  });
});

describe('a vista, o texto e o CSV', () => {
  test('vFisco mostra o quadro, as obrigações, as obras, o que ficou fora e os seletores', () => {
    const html = app.vFisco();
    assert.match(html, /Anexo F/);
    assert.match(html, /Fora da declaração/);
    assert.match(html, /Obrigações de 2024/);
    assert.match(html, /Obras antes do arrendamento/);
    assert.equal((html.match(/class="card kpi why"/g) || []).length, 4, 'quatro indicadores com explicação');
    assert.ok(html.includes('class="label">Rendas ilíquidas</div><div class="value ">' + app.euro(12500)));
    assert.match(html, /id="fiscoSel"/);
    assert.match(html, /id="ownerSel"/);
    assert.match(html, /fiscoPartilhar\(\)/);
    assert.match(html, /fiscoCsv\(\)/);
    assert.match(html, /class="tablewrap"><table class="table"/);
    assert.match(html, /1234567/);
    assert.match(html, /110623 · U · art\. 4651 · fr\. A/);
    assert.match(html, /ctView\('C1'\)/, 'a linha abre a ficha do contrato');
    assert.match(html, /ctView\('C2'\)/, 'e o não declarado também');
    assert.doesNotMatch(html, /Falta:/, 'nada falta ao contrato completo');
    assert.ok(html.indexOf('data-toca="vista"') > -1 && html.indexOf('data-toca="nada"') > -1 && html.indexOf('data-toca="camada"') > -1);
  });

  test('sem rendas no ano diz-o e aponta os anos que têm', () => {
    app.fiscoAno = String(ANO + 3);
    const html = app.vFisco();
    assert.match(html, /Sem rendas em 2027/);
    assert.match(html, /Há rendas em 2024/);
    assert.match(html, /Escolher outro ano/);
    assert.doesNotMatch(html, /Anexo F · quadro/);
  });

  test('sem imóveis convida a criar o primeiro', () => {
    app.db.properties = []; app.db.transactions = []; app.db.contracts = [];
    assert.match(app.vFisco(), /Sem imóveis/);
  });

  test('com um grupo de proprietários no filtro, os valores vão por inteiro e diz-se', () => {
    app.db.groups.push(app.normGroup({ id: 'G', name: 'Família', kind: 'owner', ids: ['ana'] }));
    app.ownerFilter = 'g:G';
    const html = app.vFisco();
    assert.match(html, /não se aplica aqui/);
    assert.equal(app.resumoFiscal(ANO, '').linhas[0].quota, 1);
    perto(app.resumoFiscal(ANO, '').linhas[0].rendas, 12500, 1e-9);
    app.ownerFilter = '';
  });

  test('o texto traz os mesmos números da página', () => {
    const t = app.fiscoTexto();
    assert.match(t, /ANEXO F · QUADRO 4\.1 — 2024/);
    assert.ok(t.includes('Rendas ilíquidas ' + app.euro2(12500)));
    assert.ok(t.includes('IMI ' + app.euro2(300)));
    assert.ok(t.includes('n.º 1234567'));
    assert.match(t, /FORA DA DECLARAÇÃO\n  Benfica — T1 Benfica: /);
    assert.match(t, /Obras antes do arrendamento .* \(desde 01\/07\/2023\)/);
  });

  test('o CSV tem um cabeçalho e uma linha por contrato, com o não declarado marcado', () => {
    let guardado = null;
    app.download = (nome, mime, conteudo) => { guardado = { nome, mime, conteudo }; };
    app.fiscoCsv();
    assert.ok(guardado, 'descarregou');
    assert.equal(guardado.nome, 'anexo-f-2024.csv');
    const linhas = guardado.conteudo.split('\n');
    assert.equal(linhas.length, 3, 'cabeçalho + C1 + C2');
    assert.match(linhas[0], /^"ano";"declarado";"contrato";"n_at"/);
    assert.match(linhas[0], /"conservacao";"condominio";"imi";"selo";"taxas";"outros";"obras24"/);
    assert.match(linhas[1], /^"2024";"sim";"Arroios";"1234567";"2024-01-01";"T2 Arroios";"110623";"U";"4651";"A";"07";"Tiago";"123456789";"100";"12500";"500"/);
    assert.match(linhas[1], /;"0";"120";"300";"0";"0";"0";"200";"2023-07-01";"2";""$/);
    assert.match(linhas[2], /^"2024";"nao";"Benfica";"";"2023-06-01";"T1 Benfica"/);
    assert.match(linhas[2], /"1200";"0"/);
    const n = linhas[0].split(';').length;
    linhas.forEach((l) => assert.equal(l.split(';').length, n, 'todas as linhas com as mesmas colunas'));
  });

  test('o ano automático: até junho o anterior, se tiver rendas', () => {
    app.fiscoAno = '';
    const mes = new Date().getMonth() + 1, Y = app.YEAR;
    const tem = (y) => app.db.transactions.some((t) => app.ehRenda(t) && String(t.date).startsWith(String(y)));
    assert.equal(app.fiscoAnoAtual(), mes <= 6 && tem(Y - 1) ? Y - 1 : Y);
    app.fiscoAno = '2019';
    assert.equal(app.fiscoAnoAtual(), 2019);
  });
});

describe('o separador e o registo', () => {
  test('a Declaração (id fisco) está em TABS, no grupo Finanças a seguir à Avaliação, e a subpágina irs existe', () => {
    const t = app.TABS.find((x) => x.id === 'fisco');
    assert.ok(t, 'TABS tem fisco');
    assert.equal(t.label, 'Declaração', 'o nome que se lê no menu — «Fisco» foi rejeitado como nome');
    assert.ok(t.icon && app.ic(t.icon).indexOf('<path') > -1, 'o ícone existe no ic()');
    const g = app.NAV_GROUPS.find((x) => x.ids.indexOf('fisco') > -1);
    assert.ok(g, 'um NAV_GROUP contém-no');
    assert.equal(g.label, 'Finanças');
    assert.equal(g.ids[g.ids.indexOf('fisco') - 1], 'reports');
    assert.equal(app.SUBPAGE.irs.label, 'IRS e dedução');
  });

  test('a vista está nos mapas do render e o painel de análise conta o proprietário', () => {
    app.tab = 'fisco';
    assert.equal(app.ANA_N(), 0);
    app.ownerFilter = 'ana';
    assert.equal(app.ANA_N(), 1);
    app.render = () => {};
    app.fiscoAno = '2020';
    app.anaClear();
    assert.equal(app.fiscoAno, '', 'o Limpar repõe o ano automático');
    assert.equal(app.ownerFilter, '');
    app.tab = 'dashboard';
  });

  test('quem só colabora sem finanças não vê o separador', () => {
    app.window.CW = { user: { id: 'eu' }, cargos: { v1: { dono: false, perms: ['visit.view'] }, v2: { dono: false, perms: ['visit.view'] } } };
    const fora = Array.from(app.separadoresEscondidos());
    assert.ok(fora.includes('fisco'));
    assert.ok(fora.includes('reports'));
    delete app.window.CW;
  });
});
