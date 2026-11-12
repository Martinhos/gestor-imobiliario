// A Declaração, para lá dos quadros 4.1 e 4.2: «A tua situação» (tributação
// conjunta, o titular A ou B de cada proprietário, a dispensa dos recibos e o
// Modelo 44), guardada nas definições; o AIMI no quadro 9; os contratos
// isentos no 4.1 com o quadro 6D; a comunicação de fevereiro no 4.2A, o 4.2B
// e o 4.2C; e o englobamento (quadro 6G), que a página deixou de simular — os
// escalões continuam nas versões de cada ano, como dados.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, perto, repor } from './arnes.js';

// a app vive na primavera a seguir ao ano do resumo, que é o de 2025 — o
// primeiro com versão própria das regras
const app = carregarApp({ hoje: '2026-03-15' });
const ANO = 2025;
const copia = (x) => JSON.parse(JSON.stringify(x));

const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra));
  app.db.transactions.push(t);
  return t;
};
const rendas = (contractId, valor, propertyId) => {
  for (let i = 1; i <= 12; i++) {
    mov({ kind: 'income', category: 'Rendas', amount: valor, contractId, propertyId: propertyId || 'v1', recibo: true,
      date: `${ANO}-${String(i).padStart(2, '0')}-05` });
  }
};

beforeEach(() => {
  limpar(app);
  app.fiscoAno = String(ANO);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Vera', nif: '123456789' }));
  app.db.properties.push(
    app.normProp({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 },
      freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }),
    app.normProp({ id: 'v2', name: 'T1 Benfica', ownerIds: ['bruno'], freguesiaCodigo: '110601', tipoPredio: 'U', matrix: '77' }),
  );
  app.db.contracts.push(
    app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2020-01-01', active: true,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' } }),
  );
  rendas('C1', 1000);
});

describe('as escolhas guardadas nas definições', () => {
  afterEach(() => repor(app));

  test('o blank traz o bloco irs, e uma base antiga sem ele fica com ele completo', () => {
    assert.deepEqual(copia(app.blank.settings.irs), { conjunta: false, titulares: {}, dispensaRecibos: false, outrosRendimentos: {} });
    const d = app.normalizarBase({ settings: { growth: 3 } });
    assert.deepEqual(copia(d.settings.irs), { conjunta: false, titulares: {}, dispensaRecibos: false, outrosRendimentos: {} });
    const lixo = app.normalizarBase({ settings: { irs: { conjunta: 'sim', titulares: { ana: 'B', bruno: 'X' }, outrosRendimentos: { 2025: '1500', ano: 3, 2024: -5 } } } });
    assert.deepEqual(copia(lixo.settings.irs), { conjunta: false, titulares: { ana: 'B' }, dispensaRecibos: false, outrosRendimentos: { 2025: 1500 } });
  });

  test('o bloco irs da base nunca é o do blank (mudar um não muda o outro)', () => {
    app.render = () => {};
    app.fiscoSetIrs('conjunta', true);
    assert.equal(app.db.settings.irs.conjunta, true);
    assert.equal(app.blank.settings.irs.conjunta, false);
    const outra = app.normalizarBase({});
    assert.equal(outra.settings.irs.conjunta, false);
  });

  test('os interruptores e os titulares gravam-se no sítio', () => {
    app.render = () => {};
    app.fiscoSetIrs('conjunta', true);
    app.fiscoSetIrs('dispensaRecibos', true);
    app.fiscoSetIrs('outraCoisa', true);
    assert.equal(app.db.settings.irs.outraCoisa, undefined, 'um campo que não é escolha não se grava');
    app.fiscoSetTitular('bruno', 'B');
    assert.deepEqual(copia(app.db.settings.irs.titulares), { bruno: 'B' });
    app.fiscoSetTitular('bruno', 'X');
    assert.deepEqual(copia(app.db.settings.irs.titulares), { bruno: 'A' }, 'o que não é B é A');
    app.fiscoSetTitular('__proto__', 'B');
    app.fiscoSetTitular('ninguem', 'B');
    assert.deepEqual(copia(app.db.settings.irs.titulares), { bruno: 'A' }, 'só um proprietário que existe');
    assert.equal(app.db.settings.irs.dispensaRecibos, true);
    assert.equal(typeof app.fiscoSetOutros, 'undefined', 'os outros rendimentos do agregado já não se escrevem na página');
  });
});

describe('o titular A ou B', () => {
  afterEach(() => repor(app));

  test('sem tributação conjunta é sempre A, mesmo com uma letra escolhida', () => {
    app.db.settings.irs.titulares = { bruno: 'B' };
    assert.equal(app.resumoFiscal(ANO, 'bruno').linhas[0].titular, 'A');
    assert.equal(app.resumoFiscal(ANO, '').linhas[0].titular, 'A');
  });

  test('em conjunta, a letra de quem declara, e a do cônjuge (B) na linha dele; por inteiro, as letras dos donos do imóvel', () => {
    app.db.settings.irs = { conjunta: true, titulares: { ana: 'A', bruno: 'B' }, dispensaRecibos: false, outrosRendimentos: {} };
    assert.equal(app.resumoFiscal(ANO, 'bruno').linhas[0].titular, 'B', 'o Bruno declara sozinho: é ele o B, e não há outro B');
    const ana = app.resumoFiscal(ANO, 'ana').linhas;
    assert.deepEqual(copia(ana.map((l) => l.titular)), ['A', 'B'], 'a Ana declara com o cônjuge: uma linha de cada um, a A primeiro');
    assert.equal(app.resumoFiscal(ANO, '').linhas[0].titular, 'A/B', 'o imóvel é dos dois');
  });

  test('a letra está no cartão do contrato, no texto e no fim do CSV', () => {
    app.db.settings.irs = { conjunta: true, titulares: { bruno: 'B' }, dispensaRecibos: false, outrosRendimentos: {} };
    app.CW = { user: { id: 'bruno' } };
    const html = app.vFisco();
    assert.match(html, /<dt>Titular<\/dt><dd>B<\/dd>/);
    assert.match(app.fiscoTexto(), /· titular B\n/);
    let guardado = null;
    app.download = (nome, mime, conteudo) => { guardado = conteudo; };
    app.fiscoCsv();
    const linhas = guardado.split('\n');
    assert.match(linhas[0], /"ultima_renovacao";"titular";"isencao_6d";"comunicacao_4_2a";"reducao_4_2b";"renda_anterior_4_2b"$/);
    assert.match(linhas[1], /;"B";"";"";"";""$/);
    const n = linhas[0].split(';').length;
    linhas.forEach((l) => assert.equal(l.split(';').length, n));
  });

  test('o cartão «A tua situação fiscal» vem em linhas, ao lado dos prazos, com interruptores e o segmentado A/B só em conjunta', () => {
    let html = app.vFisco();
    const sit = html.indexOf('A tua situação fiscal');
    assert.ok(sit > html.indexOf('class="fis-grelha"') && sit > html.indexOf('A tratar antes de entregar') && sit < html.indexOf('fiscoPilha'), 'na grelha, depois das obrigações, antes dos quadros');
    assert.ok(html.includes('class="interruptor" role="switch" id="fiscoConjunta" aria-checked="false" aria-label="Tributação conjunta" data-toca="dados" data-click="fiscoSetIrs(\'conjunta\',true)"'));
    assert.match(html, /id="fiscoDispensa" aria-checked="false"[^>]*data-click="fiscoSetIrs\('dispensaRecibos',true\)"/);
    assert.doesNotMatch(html, /fiscoTit_/);
    app.db.settings.irs.conjunta = true;
    app.db.settings.irs.titulares = { bruno: 'B' };
    html = app.vFisco();
    assert.match(html, /id="fiscoConjunta" aria-checked="true"[^>]*data-click="fiscoSetIrs\('conjunta',false\)"/, 'ligado, o toque desliga');
    assert.match(html, /id="fiscoTit_ana"/);
    assert.match(html, /id="fiscoTit_bruno"/);
    assert.ok(html.includes('<button type="button" class="on" aria-pressed="true" data-toca="dados" data-click="fiscoSetTitular(\'bruno\',\'B\')">B</button>'), 'a letra do Bruno acesa no segmentado');
    assert.doesNotMatch(html, /\b(pôr|tirar|põe|tira)\b/i);
  });
});

// KAN-73: «Vale a pena ter o seletor de proprietário? O IRS deve ser só para
// mim. Os valores dividem-se pela percentagem de propriedade, ou é o valor
// total?» — a Declaração é sempre a de quem tem a sessão, sem seletor, pela
// quota-parte dela (o Anexo F é por titular, CIRS art. 19.º); em conjunta
// entra também a do cônjuge, o proprietário marcado como B.
describe('a Declaração é a de quem tem a sessão (KAN-73)', () => {
  afterEach(() => repor(app));

  /* o T1 Benfica (v2) é só do Bruno, com um contrato e rendas; o T2 Arroios
     (v1) é dos dois a meias, com uma renda de dezembro com retenção e o IMI */
  const casaDoBruno = () => {
    app.db.contracts.push(app.normContract({ id: 'C9', name: 'Benfica', propertyId: 'v2', tenantIds: ['t2'], rent: 800, start: '2021-01-01', active: true,
      fisco: { estado: 'declarado', numero: '999', finalidade: 'hp' } }));
    rendas('C9', 800, 'v2');
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 750, retencao: 250, contractId: 'C1', recibo: true, date: ANO + '-12-20' });
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 300, date: ANO + '-04-10' });
  };

  test('dois proprietários a 50/50 e eu num deles: metade das rendas, das retenções e dos gastos, e só as minhas casas', () => {
    casaDoBruno();
    app.CW = { user: { id: 'ana' } };
    const r = app.resumoFiscal(ANO);
    assert.equal(r.titularId, 'ana', 'sem ninguém escolhido, é a da sessão');
    assert.equal(r.porInteiro, false);
    assert.deepEqual(copia(r.linhas.map((l) => l.contratoId)), ['C1'], 'o Benfica não é meu');
    assert.equal(r.imoveis, 1);
    const l = r.linhas[0];
    perto(l.quota, 0.5);
    perto(l.rendas, 6500, 1e-9, 'metade de 12 × 1000 + 750 + 250 retidos');
    perto(l.retencoes, 125, 1e-9);
    perto(l.gastos.imi, 150, 1e-9);
    assert.equal(l.titular, 'A');
    // a página: os mesmos números, sem seletor, e o subtítulo diz que é a minha parte
    const html = app.vFisco();
    assert.ok(html.includes('class="label">Rendas ilíquidas</div><div class="value ">' + app.euro(6500)), 'metade à cabeça');
    assert.doesNotMatch(html, /Benfica/);
    assert.doesNotMatch(html, /id="ownerSel"|Todos os proprietários|quota-parte de Ana|valores por inteiro/, 'nem o seletor, nem o nome de um filtro');
    assert.match(html, /<span class="small">2025 · a tua quota-parte<\/span>/);
    assert.match(html, /A declaração é a tua: rendas, retenções e gastos entram pela tua quota-parte de cada imóvel\./);
    // o texto e o CSV são os mesmos
    assert.match(app.fiscoTexto(), /^ANEXO F · QUADROS 4\.1 E 4\.2 — 2025 · Ana \(quota-parte\)\n/);
    let csv = null;
    app.download = (nome, mime, conteudo) => { csv = conteudo; };
    app.fiscoCsv();
    const linhas = csv.split('\n');
    assert.equal(linhas.length, 2, 'o cabeçalho e o Arroios');
    assert.match(linhas[1], /;"50";"6500";"125";/);
    // o Bruno, na sessão dele, tem a outra metade e o Benfica inteiro
    app.CW = { user: { id: 'bruno' } };
    const b = app.resumoFiscal(ANO);
    assert.deepEqual(copia(b.linhas.map((x) => x.contratoId)), ['C9', 'C1'], 'pela ordem dos imóveis: o T1 Benfica antes do T2 Arroios');
    perto(b.totais.rendas, 6500 + 9600, 1e-9);
  });

  test('em conjunta com o cônjuge como B: entram as duas quotas, cada linha com a sua letra, e um contrato conta uma vez', () => {
    casaDoBruno();
    app.db.settings.irs = { conjunta: true, titulares: { bruno: 'B' }, dispensaRecibos: false, outrosRendimentos: {} };
    app.db.contracts.find((c) => c.id === 'C1').fisco.numero = '';
    app.CW = { user: { id: 'ana' } };
    const r = app.resumoFiscal(ANO);
    assert.deepEqual(copia(r.titulares), ['ana', 'bruno']);
    assert.equal(r.variosTitulares, true);
    // pela ordem dos imóveis (o T1 Benfica antes do T2 Arroios), e as duas linhas do Arroios juntas, a A primeiro
    assert.deepEqual(copia(r.linhas.map((l) => [l.contratoId, l.titular, l.quota])), [['C9', 'B', 1], ['C1', 'A', 0.5], ['C1', 'B', 0.5]]);
    const [c9, a, b] = r.linhas;
    perto(c9.rendas, 9600, 1e-9);
    perto(a.rendas, 6500, 1e-9);
    perto(b.rendas, 6500, 1e-9);
    perto(a.retencoes, 125, 1e-9);
    perto(b.retencoes, 125, 1e-9);
    perto(a.gastos.imi, 150, 1e-9);
    perto(b.gastos.imi, 150, 1e-9);
    perto(c9.gastos.imi, 0, 1e-9, 'o IMI é do Arroios');
    perto(r.totais.rendas, 22600, 1e-9);
    // o que é do contrato diz-se uma vez, e não «2 contratos»
    const semNum = r.avisos.filter((a) => /sem o n\.º do contrato/.test(a.texto));
    assert.equal(semNum.length, 1);
    assert.match(semNum[0].texto, /^Contrato Arroios: declarado à AT/);
    // a página: uma linha por titular, com a letra no campo e no cartão, e os contratos contados uma vez
    const html = app.vFisco();
    assert.match(html, /<dt>Titular<\/dt><dd>A<\/dd>/);
    assert.match(html, /<dt>Titular<\/dt><dd>B<\/dd>/);
    assert.match(html, /T2 Arroios · titular B · quota-parte 50%/);
    assert.match(html, /Preenche no <b>quadro 4\.1<\/b> do Anexo F: uma linha por contrato e por titular\./);
    assert.match(html, /<b>Total do quadro 4\.1<\/b><span class="small">2 contratos · líquido /);
    assert.match(html, /<span class="small">2025 · a tua parte e a do titular B<\/span>/);
    assert.match(html, /Em tributação conjunta entra também a do titular B, cada linha com a sua letra\./);
    assert.match(html, /<span class="fis-linha-txt">Ana \(eu\)<\/span>/, 'na situação fiscal, eu à cabeça');
    // o texto e o CSV também
    assert.match(app.fiscoTexto(), /— 2025 · Ana \(A\) e Bruno \(B\) \(quota-parte\)\n/);
    let csv = null;
    app.download = (nome, mime, conteudo) => { csv = conteudo; };
    app.fiscoCsv();
    const linhas = csv.split('\n').slice(1);
    assert.deepEqual(linhas.map((x) => x.match(/^"2025";"[^"]*";"([^"]+)"/)[1] + ' ' + x.match(/;"([AB])";"[^"]*";"[^"]*";"[^"]*";"[^"]*"$/)[1]),
      ['Benfica B', 'Arroios A', 'Arroios B']);
  });

  test('um movimento sem imóvel é de quem o registou: conta se é meu (ou sem «pago por») ou do B em conjunta, e não se é de outro', () => {
    app.CW = { user: { id: 'ana' } };
    mov({ kind: 'income', category: 'Rendas', amount: 300, propertyId: '', contractId: null, date: ANO + '-05-05' });
    mov({ kind: 'income', category: 'Rendas', amount: 200, propertyId: '', contractId: null, paidBy: 'bruno', date: ANO + '-05-06' });
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 400, propertyId: '', paidBy: 'ana', date: ANO + '-09-20' });
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 100, propertyId: '', paidBy: 'bruno', date: ANO + '-09-21' });
    let r = app.resumoFiscal(ANO);
    const sem = r.semContrato.find((s) => !s.propertyId);
    assert.ok(sem, 'as rendas sem imóvel ficam à vista, em «Rendas sem contrato»');
    perto(sem.rendas, 300, 1e-9, 'a do Bruno não');
    assert.equal(sem.n, 1);
    perto(r.aimi.total, 400, 1e-9, 'o AIMI que paguei, inteiro; o do Bruno não');
    app.db.settings.irs = { conjunta: true, titulares: { bruno: 'B' }, dispensaRecibos: false, outrosRendimentos: {} };
    r = app.resumoFiscal(ANO);
    perto(r.semContrato.find((s) => !s.propertyId).rendas, 500, 1e-9, 'em conjunta o do B entra');
    perto(r.aimi.total, 500, 1e-9);
  });

  test('quem sou eu sem sessão: o único proprietário; com vários, por inteiro; e com sessão sem imóveis meus, di-lo', () => {
    // sem sessão e com um proprietário só, é ele
    app.db.owners = app.db.owners.filter((o) => o.id === 'ana');
    let r = app.resumoFiscal(ANO);
    assert.equal(r.titularId, 'ana');
    assert.equal(r.porInteiro, false);
    assert.ok(!r.avisos.some((a) => /Sem sessão/.test(a.texto)));
    // sem proprietários nenhuns, por inteiro e sem aviso
    app.db.owners = [];
    r = app.resumoFiscal(ANO);
    assert.equal(r.porInteiro, true);
    assert.equal(r.semSessao, false);
    perto(r.totais.rendas, 12000, 1e-9);
    // com sessão de quem não é dono de nada: o Anexo F não é dos imóveis dos outros
    app.db.owners = [app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' })];
    app.CW = { user: { id: 'carla' } };
    r = app.resumoFiscal(ANO);
    assert.equal(r.imoveis, 0);
    assert.match(app.vFisco(), /<b>Nenhum imóvel teu<\/b>/);
  });
});

describe('as linhas da situação fiscal e o foco depois de gravar', () => {
  afterEach(() => repor(app));

  test('a linha de cada interruptor é o rótulo dele: toca-se inteira', () => {
    const html = app.vFisco();
    assert.ok(html.includes('<label class="fis-linha fis-linha-toque"><span class="fis-linha-txt"><b>Tributação conjunta</b><span class="small">Casados ou unidos de facto</span></span><button type="button" class="interruptor" role="switch" id="fiscoConjunta"'));
    assert.match(html, /<label class="fis-linha fis-linha-toque"><span class="fis-linha-txt"><b>Tenho dispensa dos recibos de renda eletrónicos<\/b><\/span><button type="button" class="interruptor" role="switch" id="fiscoDispensa"/);
    const rotulos = html.match(/<label class="fis-linha[\s\S]*?<\/label>/g) || [];
    assert.equal(rotulos.length, 2);
    rotulos.forEach((r) => {
      assert.doesNotMatch(r, /<(p|div)[\s>]/, 'um <label> só leva texto corrido');
      assert.equal((r.match(/<button/g) || []).length, 1, 'e um controlo só');
    });
  });

  test('o interruptor e o A/B ficam com o foco depois de redesenhar', () => {
    const doc = app.document;
    const sw = doc.getElementById('fiscoConjunta');
    sw.id = 'fiscoConjunta';
    const focos = [];
    let pintou = 0;
    sw.focus = () => { focos.push('conjunta'); doc.activeElement = sw; };
    // o render troca a vista inteira: quem tinha o foco desaparece e ele cai no body
    app.render = () => { pintou++; doc.activeElement = doc.body; };
    doc.activeElement = sw;
    app.fiscoSetIrs('conjunta', true);
    assert.equal(app.db.settings.irs.conjunta, true);
    assert.equal(pintou, 1, 'num clique redesenha já, com o botão focado');
    assert.deepEqual(focos, ['conjunta'], 'pelo id');
    // o A/B não tem id: volta-se ao botão com o mesmo data-click, que não muda ao redesenhar
    const acao = (x) => "fiscoSetTitular('bruno','" + x + "')";
    const botao = (x, foco) => ({ getAttribute: (k) => (k === 'data-click' ? acao(x) : null), focus: foco });
    const novoA = botao('A', () => focos.push('A'));
    const novoB = botao('B', () => { focos.push('B'); doc.activeElement = novoB; });
    doc.getElementById('view').querySelectorAll = () => [novoA, novoB];
    doc.activeElement = botao('B', () => {});
    app.fiscoSetTitular('bruno', 'B');
    assert.equal(app.db.settings.irs.titulares.bruno, 'B');
    assert.equal(pintou, 2);
    assert.deepEqual(focos, ['conjunta', 'B'], 'pelo data-click');
  });

  test('gravar no change de um campo grava já, e o redesenho espera que o foco chegue ao campo seguinte', async () => {
    const doc = app.document;
    const seguinte = doc.getElementById('fisSeguinte');
    seguinte.id = 'fisSeguinte';
    let pintou = 0, focado = 0;
    seguinte.focus = () => { focado++; doc.activeElement = seguinte; };
    app.render = () => { pintou++; doc.activeElement = doc.body; };
    doc.activeElement = doc.body;        // no change, o foco ainda vai a caminho do campo seguinte
    app.fiscoGravarIrs((d) => { d.conjunta = true; }, true);
    assert.equal(app.db.settings.irs.conjunta, true, 'grava já');
    assert.equal(pintou, 0, 'o redesenho espera que o foco assente');
    doc.activeElement = seguinte;        // o Tab acabou de o levar ao campo seguinte
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(pintou, 1);
    assert.equal(focado, 1, 'o campo seguinte tem o foco outra vez');
  });
});

describe('o AIMI no quadro 9', () => {
  afterEach(() => repor(app));

  test('o AIMI fica fora dos gastos e vai ao quadro 9, com a parte do VPT dos prédios arrendados', () => {
    app.db.properties[0].vpt = 300000;
    app.db.properties[1].vpt = 100000;
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 400, propertyId: '', date: ANO + '-09-20' });
    const r = app.resumoFiscal(ANO, '');
    const soma = Object.keys(r.linhas[0].gastos).reduce((n, k) => n + r.linhas[0].gastos[k], 0);
    perto(soma, 0, 1e-9, 'não é gasto');
    perto(r.aimi.total, 400);
    perto(r.aimi.vptArrendados, 300000);
    perto(r.aimi.vptTotal, 400000);
    perto(r.aimi.parte, 300, 0.01, '400 × 300 000 / 400 000');
    perto(r.aimi.abate, 300, 0.01, 'o imposto das rendas (25 % de 12 000) chega para a parte toda');
    const html = app.vFisco();
    assert.match(html, /Quadro 9 — AIMI/);
    assert.match(html, /9101/);
    assert.match(html, /9102/);
  });

  test('sem o VPT de um prédio a parte não se calcula e diz-se qual falta; sem AIMI não há cartão', () => {
    assert.equal(app.resumoFiscal(ANO, '').aimi, null);
    assert.doesNotMatch(app.vFisco(), /Quadro 9 — AIMI/);
    app.db.properties[0].vpt = 300000;
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 400, propertyId: 'v1', date: ANO + '-09-20' });
    const a = app.resumoFiscal(ANO, '').aimi;
    assert.equal(a.parte, null);
    assert.deepEqual(copia(a.semVpt), ['T1 Benfica']);
    assert.match(app.vFisco(), /Falta o VPT de T1 Benfica/);
  });

  test('com um titular, o AIMI do imóvel entra pela quota dele', () => {
    app.db.properties[0].vpt = 300000;
    app.db.properties[1].vpt = 100000;
    mov({ kind: 'expense', category: 'Impostos', sub: 'AIMI', amount: 400, propertyId: 'v1', date: ANO + '-09-20' });
    const a = app.resumoFiscal(ANO, 'ana').aimi;
    perto(a.total, 200);
    perto(a.vptTotal, 150000, 0.01, 'a Ana só tem metade do v1, e nada do v2');
  });
});

describe('os contratos isentos (quadro 6D)', () => {
  afterEach(() => repor(app));

  test('um contrato no PAA fica no 4.1 com o código 01, a imposto zero e fora do líquido e do imposto', () => {
    app.db.contracts.push(app.normContract({ id: 'C2', name: 'Benfica', propertyId: 'v2', tenantIds: ['t2'], rent: 500, start: '2022-01-01', active: true,
      fisco: { estado: 'declarado', numero: '222', finalidade: 'hp', isencao: 'paa' } }));
    rendas('C2', 500, 'v2');
    const r = app.resumoFiscal(ANO, '');
    const l = r.linhas.find((x) => x.contratoId === 'C2');
    assert.equal(l.quadro, '4.1', 'o 6D aponta para o campo do 4.1 onde o imóvel está');
    assert.equal(l.isencao.codigo, '01');
    assert.equal(l.imposto, 0);
    assert.equal(r.totais.isentos.n, 1);
    perto(r.totais.isentos.liquido, 6000);
    perto(r.totais.rendas, 18000, 0.01, 'as rendas do 4.1 contam-nas');
    perto(r.totais.liquido, 12000, 0.01, 'o líquido não');
    perto(r.totais.imposto, 3000, 0.01, 'nem o imposto');
    const html = app.vFisco();
    assert.match(html, /Quadro 6D — rendimentos isentos/);
    assert.match(html, /código 01/);
    assert.match(app.fiscoTexto(), /isento \(quadro 6D, código 01\)/);
  });
});

describe('o 4.2: a comunicação de fevereiro, o 4.2B e o 4.2C', () => {
  afterEach(() => repor(app));

  beforeEach(() => {
    app.db.contracts.push(
      app.normContract({ id: 'L1', name: 'Longo comunicado', propertyId: 'v2', tenantIds: ['t2'], rent: 900, start: '2024-03-01', end: '2034-02-28', active: true,
        fisco: { estado: 'declarado', numero: '333', finalidade: 'hp', celebracao: '2024-02-15', comunicacoes: { 2025: '2026-02-10' }, rendaAnterior: 1000, rendaAcimaDoLimite: false } }),
      app.normContract({ id: 'L2', name: 'Longo por comunicar', propertyId: 'v1', tenantIds: ['t1'], rent: 700, start: '2023-01-01', end: '2033-12-31', active: true,
        fisco: { estado: 'declarado', numero: '444', finalidade: 'hp' } }),
    );
    rendas('L1', 900, 'v2');
    rendas('L2', 700, 'v1');
  });

  test('cada contrato do 4.2A diz se foi comunicado, com a data no ecrã em dd/mm/aaaa', () => {
    const r = app.resumoFiscal(ANO, '');
    assert.equal(r.linhas.find((l) => l.contratoId === 'L1').comunicado, '2026-02-10');
    assert.equal(r.linhas.find((l) => l.contratoId === 'L2').comunicado, '');
    const html = app.vFisco();
    assert.match(html, /comunicada a 10\/02\/2026/);
    assert.match(html, /por comunicar/);
    assert.match(html, /até 15\/02\/2026/);
    assert.doesNotMatch(html, /O 4\.2A pergunta ainda se a duração/, 'o aviso fixo saiu');
    assert.match(app.fiscoTexto(), /4\.2A: comunicada a 10\/02\/2026 · início/);
  });

  test('a renda 10 % abaixo da anterior vai ao 4.2B; o celebrado desde 2024 e confirmado responde Sim no 4.2C', () => {
    const l = app.resumoFiscal(ANO, '').linhas.find((x) => x.contratoId === 'L1');
    assert.equal(l.quadro, '4.2');
    assert.equal(l.bonus, true);
    const html = app.vFisco();
    assert.match(html, /Quadro 4\.2B/);
    assert.match(html, /Quadro 4\.2C/);
    assert.match(html, /responde «Sim» \(01\)/);
    app.db.contracts.find((c) => c.id === 'L1').fisco.rendaAcimaDoLimite = null;
    assert.match(app.vFisco(), /Por confirmar na ficha do contrato: Longo comunicado/);
  });

  test('o termo do 4.2A é o do contrato inicial; o fim da renovação vai na coluna dela', () => {
    const c = app.db.contracts.find((x) => x.id === 'L2');
    c.start = '2015-01-01'; c.end = '2029-12-31';
    c.fisco = app.normFisco(Object.assign({}, c.fisco, { renovacoes: [{ id: 'R1', inicio: '2025-01-01', fim: '2029-12-31' }] }));
    const l = app.resumoFiscal(ANO, '').linhas.find((x) => x.contratoId === 'L2');
    assert.deepEqual(JSON.parse(JSON.stringify(l.datas)),
      { inicio: '2015-01-01', fim: '2024-12-31', renovacaoInicio: '2025-01-01', renovacaoFim: '2029-12-31' });
  });
});

describe('o englobamento (quadro 6G)', () => {
  afterEach(() => repor(app));

  test('as versões de 2025 e de 2026 trazem os escalões, e as parcelas fazem a tabela contínua', () => {
    for (const a of [2025, 2026]) {
      const eng = copia(app.irsAno(a).englobamento);
      assert.equal(eng.escaloes.length, 9, a + ': nove escalões');
      assert.equal(eng.escaloes[8].ate, null);
      assert.equal(eng.escaloes[8].taxa, 48);
      for (let i = 0; i < 8; i++) {
        const e = eng.escaloes[i], s = eng.escaloes[i + 1];
        perto(e.ate * e.taxa / 100 - e.parcela, e.ate * s.taxa / 100 - s.parcela, 0.02, a + ' no limite de ' + e.ate);
      }
    }
    assert.equal(app.irsAno(2025).englobamento.escaloes[0].ate, 8059, 'Lei 55-A/2025');
    assert.equal(app.irsAno(2026).englobamento.escaloes[0].ate, 8342, 'Lei 73-A/2025');
    assert.equal(app.irsAno(2027).englobamento.escaloes[0].ate, 8342, 'um ano sem versão usa os da mais recente');
  });

  test('a página já não simula o englobamento: nem o cartão, nem o campo, nem a linha no texto', () => {
    app.db.settings.irs.outrosRendimentos = { 2025: 90000 };
    const html = app.vFisco();
    assert.doesNotMatch(html, /Englobar ou não\?|fiscoOutros|Outros rendimentos coletáveis|quociente conjugal/);
    assert.match(html, /sem englobamento/, 'o imposto estimado continua a dizer que é sem englobamento');
    assert.doesNotMatch(app.fiscoTexto(), /Englobamento \(quadro 6G/);
    assert.match(app.fiscoTexto(), /\(sem englobamento\)/);
    for (const f of ['fiscoColeta', 'fiscoEnglobamento', 'fiscoEnglobamentoCard', 'fiscoSetOutros']) assert.equal(typeof app[f], 'undefined', f + ' saiu');
  });
});

describe('a dispensa dos recibos e o Modelo 44', () => {
  afterEach(() => repor(app));

  test('ligada, as rendas sem recibo deixam de ser falta e entra o Modelo 44 com o prazo', () => {
    app.db.transactions.forEach((t) => { t.recibo = false; });
    assert.ok(app.resumoFiscal(ANO, '').avisos.some((a) => /sem recibo eletrónico/.test(a.texto)));
    app.db.settings.irs.dispensaRecibos = true;
    const av = app.resumoFiscal(ANO, '').avisos;
    assert.ok(!av.some((a) => /sem recibo eletrónico/.test(a.texto)));
    const m44 = av.find((a) => /Modelo 44/.test(a.texto));
    assert.ok(m44, 'a linha do Modelo 44');
    assert.match(m44.texto, /até 28\/02\/2026/);
    assert.match(app.vFisco(), /Modelo 44: tens dispensa/);
    assert.equal(app.fiscoPrazoModelo44(2024), '2025-01-31', 'até às rendas de 2024 era o fim de janeiro');
    assert.equal(app.fiscoPrazoModelo44(2027), '2028-02-29', 'ano bissexto');
  });
});
