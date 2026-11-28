// A página da Declaração depois das rondas 10 e 11 de QA: a barra só com o
// «Guia» e o botão de partilha (o ano e o titular ficam no painel do funil; o
// CSV e o PDF numa janela), sem o cartão azul das regras nem a dobra
// do guia (o guia é o público, /guias/declarar-rendas, e a barra leva lá), sem
// o englobamento, o aviso do ano sem versão em «A tratar antes de entregar»,
// os quadros 4.1 e 4.2 em cartões — um por contrato, campo → valor pela ordem
// do impresso, sem rolar de lado — e o «Exportar PDF» só com o fisco-pdf.js.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor } from './arnes.js';

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');

const app = carregarApp({ hoje: '2026-03-15' });
// o repor não liga os serviços que um teste desligou
afterEach(() => app.definirServicosDesligados([]));
afterEach(() => repor(app));
const ANO = 2025;

const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra));
  app.db.transactions.push(t);
  return t;
};

beforeEach(() => {
  limpar(app);
  app.fiscoAno = String(ANO);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Vera', pais: 'Espanha' }));
  app.db.properties.push(
    app.normProp({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'], freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }),
    app.normProp({ id: 'v2', name: 'T1 Benfica', ownerIds: ['ana'] }),
  );
  app.db.contracts.push(
    app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2024-01-01', active: true,
      fisco: { estado: 'declarado', numero: '1234567', finalidade: 'hp' } }),
    // longo, com redução: vai ao 4.2; o imóvel não tem os dados matriciais
    app.normContract({ id: 'L1', name: 'Benfica longo', propertyId: 'v2', tenantIds: ['t2'], rent: 600, start: '2024-03-01', end: '2034-02-28', active: true,
      fisco: { estado: 'declarado', finalidade: 'hp' } }),
  );
  for (let i = 1; i <= 12; i++) {
    const m = String(i).padStart(2, '0');
    mov({ kind: 'income', category: 'Rendas', amount: 1000, contractId: 'C1', recibo: true, retencao: i === 1 ? 250 : 0, date: `${ANO}-${m}-05` });
    mov({ kind: 'income', category: 'Rendas', amount: 600, contractId: 'L1', propertyId: 'v2', recibo: true, date: `${ANO}-${m}-06` });
  }
  mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 300, date: ANO + '-04-10' });
  mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 120, date: ANO + '-02-10' });
});

/* o HTML do cartão de um contrato na página, pelo nome
   Recebe: html — a página; nome — o nome do contrato.
   Devolve: o HTML desse cartão (até ao cartão seguinte). */
function cartaoDe(html, nome) {
  const i = html.indexOf('<div class="fis-ctc-nome"><b>' + nome + '</b>');
  assert.ok(i > -1, 'há o cartão de ' + nome);
  const ini = html.lastIndexOf('<div class="fis-ctc', html.lastIndexOf('<div class="fis-ctc-cab">', i) - 1);
  const re = /<div class="fis-ctc[ "]/g;
  re.lastIndex = i;
  const m = re.exec(html);
  return html.slice(ini, m ? m.index : undefined);
}

/* o valor de um campo num cartão
   Recebe: h — o HTML do cartão; campo — o rótulo do campo.
   Devolve: o HTML do <dd>, ou null. */
function valorDe(h, campo) {
  const m = new RegExp('<dt>' + campo.replace(/[()]/g, '\\$&') + '(?:<span class="small">[^<]*</span>)?</dt><dd>(.*?)</dd>').exec(h);
  return m ? semCopia(m[1]) : null;
}
/* um valor que se copia limpo (formato.js:fmtCopiavel, N107: os separadores no CSS) de
   volta ao texto do euro2 e do fmtNIF, para o comparar com eles */
function semCopia(h) {
  const sep = app.euro2(1000).charAt(1), fim = app.euro2(1).slice(-2, -1), menos = app.euro2(-1).charAt(0), sepNif = app.fmtNIF('123456789').charAt(3);
  const grupos = (gs, s) => gs.replace(/<span class="cp-g">(\d{3})<\/span>/g, s + '$1');
  return String(h).replace(/<span class="cp-eur">(-?)(\d+)((?:<span class="cp-g">\d{3}<\/span>)*)(,\d+)?<\/span>/g,
    (x, neg, a, gs, dec) => (neg ? menos : '') + a + grupos(gs, sep) + (dec || '') + fim + '€').replace(/<span class="cp-g">(\d{3})<\/span>/g, sepNif + '$1');
}

/* abre a janela do botão de partilha com o pickModal apanhado
   Devolve: {titulo, opcoes, escolher} — o que a janela recebeu. */
function abrirPartilha() {
  const antes = app.pickModal, visto = {};
  app.pickModal = (titulo, opcoes, escolher) => { Object.assign(visto, { titulo, opcoes, escolher }); };
  try { app.fiscoPartilha(); } finally { app.pickModal = antes; }
  return visto;
}

describe('a barra', () => {
  test('só as ações, juntas: o guia (pequeno, com o livro) e o botão de partilha', () => {
    const html = app.vFisco();
    // a barra acaba onde começa o primeiro cartão, a situação fiscal (KAN-127-17)
    const barra = html.slice(html.indexOf('<div class="ana-barra">'), html.indexOf('<section class="card ana-cartao fis-sit'));
    assert.equal(barra,
      '<div class="ana-barra"><div class="ana-acoes fis-acoes">'
      + '<a class="btn sm fis-guia" href="/guias/declarar-rendas" target="_blank" rel="noopener" data-toca="nada" aria-label="Guia de preenchimento do Anexo F" title="Guia de preenchimento do Anexo F">'
      + app.ic('livro', 18) + '<span>Guia</span></a>'
      + '<button type="button" class="btn sm so-icone" data-toca="camada" data-click="fiscoPartilha()" aria-haspopup="dialog" aria-label="Partilhar" title="Partilhar">'
      + app.ic('partilhar', 18) + '</button></div></div>');
    // o CSV e o PDF não são botões soltos na barra (o cartão do aviso, no fim, pode levar à mesma janela: é da página)
    assert.doesNotMatch(barra, /Exportar CSV|Exportar PDF/, 'sem os botões soltos na barra');
    assert.doesNotMatch(html, /Guia de preenchimento<\/a>|Partilhar resumo|fiscoAnoSel/, 'nem o ano na barra');
  });

  test('o livro do guia: no traço da casa, sem preenchimento', () => {
    const s = app.ic('livro');
    assert.match(s, /fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="[^"]+"\/><path d="[^"]+"\/><\/svg>$/);
    assert.notEqual(s, app.ic('ajuda'), 'é o livro, e não o ?');
  });

  test('o ano escolhe-se no painel do funil, e o vazio de um ano aponta para lá', () => {
    let html = app.vFisco();
    assert.equal(app.window.__sel.fiscoSel.onchange, 'onFiscoAno');
    const anos = app.window.__sel.fiscoSel.options.map((o) => o.v);
    assert.ok(anos.includes('2025') && anos.every((y) => /^\d{4}$/.test(y)), 'um ano por opção, com o da página');
    app.fiscoAno = '2027';
    html = app.vFisco();
    assert.match(html, /Sem rendas em 2027/);
    assert.match(html, /Escolher outro ano/);
    assert.match(html, /hdrFiltToggle\(\)/, 'que abre o painel do funil');
    assert.doesNotMatch(html, /ana-barra|fiscoPartilha|Guia/, 'sem rendas, sem a barra das ações');
  });

  test('a partilha abre a janela com a folha de cálculo e o PDF, cada um com o ícone e o que leva (KAN-126-8)', () => {
    const j = abrirPartilha();
    assert.equal(j.titulo, 'Partilhar');
    assert.deepEqual(JSON.parse(JSON.stringify(j.opcoes.map((o) => [o.v, o.label, o.icon]))), [['xlsx', 'Exportar folha de cálculo', 'down'], ['pdf', 'Exportar PDF', 'contract']]);
    assert.ok(j.opcoes.every((o) => o.sub && o.sub.length < 80), 'uma linha curta a dizer o que leva');
    // escolher fecha a janela e exporta
    const feito = [], antes = { closeModal: app.closeModal, fiscoXlsx: app.fiscoXlsx, fiscoPdf: app.fiscoPdf };
    app.closeModal = () => feito.push('fechar');
    app.fiscoXlsx = () => feito.push('xlsx');
    app.fiscoPdf = () => feito.push('pdf');
    try {
      j.escolher(j.opcoes[0]);
      j.escolher(j.opcoes[1]);
    } finally { Object.assign(app, antes); }
    assert.deepEqual(feito, ['fechar', 'xlsx', 'fechar', 'pdf']);
  });

  test('os estilos: as ações juntas à direita, numa linha, e nada do ano nem do titular na barra', () => {
    assert.match(css, /\n\.fis-acoes\{margin-left:auto;flex-wrap:nowrap;gap:8px\}/);
    assert.match(css, /\n\.apr-a-fis-acoes\{display:flex;align-items:center;justify-content:flex-end;gap:6px\}/);
    assert.doesNotMatch(css, /\.fis-ano|\.fis-titular|\.fis-lbl|\.ana-ambito/, 'o CSS sem uso saiu');
    assert.doesNotMatch(css, /\.ana-acoes\{width:100%/, 'as ações já não ocupam uma linha inteira no telemóvel');
    // no dedo, os dois botões pequenos sobem aos 44px (o .ana .btn.sm e o quadrado do ícone)
    assert.match(css, /@media\(pointer:coarse\)\{\n {2}\.fis-ab>button,\.ana \.btn\.sm\{min-height:44px\}\n[^}]*\.ana \.btn\.sm\.so-icone\{width:44px\}/);
  });

  // a Declaração requer os Contratos e os Movimentos (D57): sem um deles não há página, e o
  // «só de leitura sem os Contratos» deixou de existir — os testes que desligavam os Contratos
  // e chamavam o vFisco() à mão testavam um estado que já não se alcança
  test('sem os Contratos ou sem os Movimentos, a Declaração desliga-se; com ela, o PDF está sempre', () => {
    assert.equal(typeof app.fiscoPdf, 'function', 'o fisco-pdf.js vem com o serviço da Declaração');
    assert.equal(app.servicoLigado('fisco'), true);
    app.definirServicosDesligados(['contracts']);
    assert.equal(app.servicoLigado('fisco'), false, 'sem os Contratos');
    assert.equal(app.separadorLigado('fisco'), false, 'e o separador não abre');
    app.definirServicosDesligados(['transactions']);
    assert.equal(app.servicoLigado('fisco'), false, 'sem os Movimentos');
    app.definirServicosDesligados([]);
    assert.deepEqual(JSON.parse(JSON.stringify(abrirPartilha().opcoes.map((o) => o.v))), ['xlsx', 'pdf']);
  });
});

describe('o que saiu', () => {
  test('sem o cartão azul, sem a dobra do guia e sem o englobamento; a grelha só com «A tratar» (D8, maqueta 6)', () => {
    const html = app.vFisco();
    assert.doesNotMatch(html, /fis-regras|fiscoVerGuia|fold_fiscoGuia|Como preencher, passo a passo|O que mudou em|Englobar ou não/);
    for (const f of ['fiscoAnoCard', 'fiscoVerGuia', 'fiscoGuiaCard', 'fiscoEnglobamentoCard', 'fiscoEscolherAno', 'fiscoLinhaHtml'])
      assert.equal(typeof app[f], 'undefined', f + ' saiu');
    const g = html.slice(html.indexOf('class="fis-grelha"'), html.indexOf('fiscoPilha'));
    assert.equal((g.match(/<section class="card ana-cartao/g) || []).length, 1, 'só «A tratar»: a situação e os prazos vêm depois dos quadros');
    assert.match(g, /<section class="card ana-cartao fis-tratar">/);
  });

  test('2025 tem versão própria: nenhum aviso das regras do ano', () => {
    const r = app.resumoFiscal(ANO, '');
    assert.ok(!r.avisos.some((a) => /versão das regras|Anexo F aprovado/.test(a.texto)));
  });

  test('um ano sem versão diz-se em «A tratar antes de entregar», à cabeça, em âmbar e sem botão', () => {
    app.db.transactions.forEach((t) => { t.date = '2027' + t.date.slice(4); });
    app.fiscoAno = '2027';
    const r = app.resumoFiscal(2027, '');
    assert.deepEqual(JSON.parse(JSON.stringify(r.avisos[0])), {
      texto: 'Ainda não há versão das regras de 2027. Usam-se as de 2026, a mais recente, com as datas passadas para 2027 — as taxas e os quadros podem ter mudado.',
      abrir: '', toca: '', nivel: 'aviso' });
    const html = app.vFisco();
    assert.match(html, /<span class="badge amber fis-num">1<\/span><p>Ainda não há versão das regras de 2027\./);
    assert.match(app.fiscoTexto(), /A TRATAR\n {2}· Ainda não há versão das regras de 2027\./, 'e vai no resumo partilhado');
  });
});

/* o HTML do cartão de um quadro, do título ao fim da secção
   Recebe: html — a página; q — '4.1' ou '4.2'.
   Devolve: o HTML do cartão. */
function quadroDe(html, q) {
  const i = html.indexOf('<h2 class="ana-tit">Quadro ' + q + ' · ');
  assert.ok(i > -1, 'há o cartão do quadro ' + q);
  return html.slice(i, html.indexOf('</section>', i));
}

// o ticket de QA 5cbde185: «Fala sobre o quadro 4.1 e 4.2 no mesmo cartão e fico sem perceber onde preencher»
describe('um cartão por quadro', () => {
  test('sem o resumo misto: cada quadro diz onde se preenche e resume só os seus contratos', () => {
    const html = app.vFisco(), r = app.resumoFiscal(ANO, '');
    assert.doesNotMatch(html, /Quadros 4\.1 e 4\.2|<th>Quadro<\/th>/, 'nenhum cartão fala dos dois quadros');
    const q1 = quadroDe(html, '4.1'), q2 = quadroDe(html, '4.2');
    // a Ana é a única proprietária, e tudo é dela: o subtítulo é só o ano (sem «por inteiro» nem quota)
    assert.match(q1, /^<h2 class="ana-tit">Quadro 4\.1 · sem redução pela duração<\/h2><span class="small">2025<\/span>/);
    assert.match(q2, /^<h2 class="ana-tit">Quadro 4\.2 · com redução pela duração<\/h2>/);
    // D69 (a frase fixa: o Anexo F pede uma linha por prédio ou fração) e D77 (por esta ordem)
    assert.match(q1, /<p class="fis-onde">Preenche no <b>quadro 4\.1<\/b> do Anexo F, <b>por esta ordem<\/b>: uma linha por prédio ou fração de cada contrato, com a renda que lhe cabe\./);
    assert.match(q2, /<p class="fis-onde">Preenche no <b>quadro 4\.2<\/b> do Anexo F, <b>por esta ordem<\/b>: uma linha por prédio ou fração de cada contrato, com a renda que lhe cabe, e no 4\.2A as datas de cada um\./);
    assert.doesNotMatch(html, /uma linha por contrato/);
    // o resumo de cada quadro só tem os contratos dele, antes dos campos
    const res1 = q1.slice(0, q1.indexOf('Os campos, contrato a contrato')), res2 = q2.slice(0, q2.indexOf('Os campos, contrato a contrato'));
    assert.match(res1, /<div class="fis-qr-nome"><b>Arroios<\/b>/);
    assert.doesNotMatch(res1, /Benfica longo/, 'o contrato do 4.2 não aparece no resumo do 4.1');
    assert.match(res2, /<div class="fis-qr-nome"><b>Benfica longo<\/b>/);
    assert.doesNotMatch(res2, /<b>Arroios<\/b>/, 'nem o do 4.1 no do 4.2');
    // as rendas e o imposto de cada contrato, e o total do quadro
    const l1 = r.linhas.find((x) => x.contratoId === 'C1');
    assert.ok(res1.includes('<div class="fis-qr-num"><b>' + app.euro2(l1.rendas) + '</b><span class="small">imposto estimado ' + app.euro2(l1.imposto) + '</span></div>'));
    assert.doesNotMatch(res1, /Total do quadro 4\.1/, 'com uma linha só, sem o total que a repetia (D8, maqueta 6)');
    assert.match(res1, /T2 Arroios · art\. 4651 · fr\. A · n\.º 1234567 · 25 % taxa base/, 'o imóvel, o n.º na AT e a taxa');
    assert.match(res2, /<span class="fis-qr-falta"><span class="badge red">N\.º do contrato na AT<\/span> <span class="small">\+3<\/span><\/span>/, 'o que falta num selo');
    // tocar numa linha do resumo abre o contrato
    assert.match(res1, /<div class="fis-qr-linha tap" data-toca="camada" data-click="ctView\('C1'\)" aria-label="Arroios: abrir o contrato">/);
    assert.doesNotMatch(res1, /<table|tablewrap/, 'linhas, e não uma tabela a rolar de lado');
  });
});

describe('os quadros em cartões', () => {
  test('o 4.1: um cartão por contrato, campo → valor pela ordem do impresso, com os números do resumo', () => {
    const html = app.vFisco(), r = app.resumoFiscal(ANO, '');
    const l = r.linhas.find((x) => x.contratoId === 'C1');
    const q = quadroDe(html, '4.1');
    assert.doesNotMatch(q, /<table|tablewrap/, 'sem tabela larga a rolar de lado');
    const c = cartaoDe(html, 'Arroios');
    assert.match(c, /<span class="small">T2 Arroios · taxa 25 % · base<\/span>/, 'o imóvel e a taxa à cabeça');
    // D90: os gastos com os nomes do impresso, no grupo «Após início do arrendamento»
    const ordem = ['N.º do contrato', 'Data de início', 'Freguesia (código)', 'Tipo', 'Artigo', 'Fração ou secção', 'Titular',
      'Rendas (rendimento ilíquido)', 'Natureza', 'Retenções na fonte', 'NIF do inquilino',
      'Conservação e manutenção', 'Condomínio', 'Imposto municipal sobre imóveis', 'Imposto do selo', 'Taxas autárquicas', 'Outros'];
    const pos = ordem.map((k) => c.indexOf('<dt>' + k));
    pos.forEach((p, i) => assert.ok(p > -1, ordem[i] + ' está no cartão'));
    pos.slice(1).forEach((p, i) => assert.ok(p > pos[i], ordem[i + 1] + ' vem depois de ' + ordem[i]));
    assert.equal(valorDe(c, 'N.º do contrato'), '1234567');
    assert.equal(valorDe(c, 'Data de início'), '01/01/2024');
    assert.equal(valorDe(c, 'Freguesia (código)'), '110623');
    assert.equal(valorDe(c, 'Tipo'), 'U');
    assert.equal(valorDe(c, 'Artigo'), '4651');
    assert.equal(valorDe(c, 'Fração ou secção'), 'A');
    assert.equal(valorDe(c, 'Titular'), 'A');
    assert.equal(valorDe(c, 'Rendas (rendimento ilíquido)'), app.euro2(l.rendas));
    assert.equal(l.rendas, 12250, '12 × 1000 + 250 retidos na fonte');
    assert.equal(valorDe(c, 'Natureza'), '07');
    assert.match(c, /<dt>Natureza<span class="small">habitacional<\/span><\/dt>/);
    assert.equal(valorDe(c, 'Retenções na fonte'), app.euro2(250));
    assert.equal(valorDe(c, 'NIF do inquilino'), '<span class="u-ws-nowrap">' + app.fmtNIF('123456789') + '</span>');
    assert.equal(valorDe(c, 'Imposto municipal sobre imóveis'), app.euro2(l.gastos.imi));
    assert.match(c, /<p class="lbl fis-ctc-grupo">Após início do arrendamento<\/p>/, 'o grupo do impresso');
    assert.equal(valorDe(c, 'Condomínio'), app.euro2(l.gastos.condominio));
    assert.equal(valorDe(c, 'Imposto do selo'), '—', 'o que não há leva um traço, não um zero inventado');
    assert.match(c, /data-toca="camada" data-click="ctView\('C1'\)"/, 'tocar abre o contrato');
    assert.doesNotMatch(c, /fis-ctc-falta/, 'nada falta');
  });

  test('o total do quadro no fim, com as somas das linhas (com mais de uma linha)', () => {
    app.db.contracts.push(app.normContract({ id: 'C3', name: 'Arroios quarto', propertyId: 'v1', tenantIds: ['t1'], rent: 400, start: '2024-01-01', active: true,
      fisco: { estado: 'declarado', numero: '7654321', finalidade: 'hp' } }));
    for (let i = 1; i <= 12; i++) mov({ kind: 'income', category: 'Rendas', amount: 400, contractId: 'C3', recibo: true, date: ANO + '-' + String(i).padStart(2, '0') + '-07' });
    const html = app.vFisco(), r = app.resumoFiscal(ANO, '');
    const q0 = quadroDe(html, '4.1'), q = q0.slice(q0.indexOf('Os campos, contrato a contrato'));
    const t = q.slice(q.indexOf('<b>Total do quadro 4.1</b>'));
    assert.ok(q.indexOf('<b>Total do quadro 4.1</b>') > q.indexOf('Arroios</b>'), 'depois dos contratos');
    const ls = r.linhas.filter((l) => l.quadro === '4.1');
    const soma = (f) => Math.round(ls.reduce((n, l) => n + f(l), 0) * 100) / 100;
    assert.equal(valorDe(t, 'Rendas (rendimento ilíquido)'), app.euro2(soma((l) => l.rendas)));
    assert.equal(valorDe(t, 'Retenções na fonte'), app.euro2(soma((l) => l.retencoes)));
    assert.equal(valorDe(t, 'Imposto municipal sobre imóveis'), app.euro2(soma((l) => l.gastos.imi)));
    assert.equal(valorDe(t, 'Imposto do selo'), app.euro2(0), 'no total, o zero diz-se');
  });

  test('o 4.2: as faltas num selo vermelho, o país em vez do NIF, e o 4.2A no cartão', () => {
    const html = app.vFisco();
    const c = cartaoDe(html, 'Benfica longo');
    assert.match(c, /taxa \d+ % · pela duração/);
    assert.match(c, /<p class="fis-ctc-falta">Falta: n\.º do contrato na AT, código da freguesia, tipo de prédio, artigo matricial\.<\/p>/);
    assert.equal(valorDe(c, 'N.º do contrato'), '<span class="badge red">falta</span>');
    assert.equal(valorDe(c, 'Freguesia (código)'), '<span class="badge red">falta</span>');
    assert.equal(valorDe(c, 'Fração ou secção'), '—', 'a fração não é obrigatória');
    // D102: o 4.2 não tem a coluna da data de início — a data vai só no 4.2A
    const linhaDoQuadro = c.slice(0, c.indexOf('<p class="lbl fis-ctc-grupo">'));
    assert.doesNotMatch(linhaDoQuadro, /<dt>Data de início/, 'a linha do 4.2 sem «Data de início»');
    // D59: sem NIF português, o NIF fica vazio e conta o país, com o código da tabela X a escolher no Portal
    assert.equal(valorDe(c, 'NIF do inquilino'), '—');
    assert.equal(valorDe(c, 'País do inquilino'), 'Espanha <span class="badge amber">no Portal, o código do país (tabela X)</span>');
    assert.match(c, /<dt>País do inquilino<span class="small">Vera<\/span><\/dt>/);
    assert.match(c, /<p class="lbl fis-ctc-grupo">Quadro 4\.2A<\/p>/);
    // a comunicação é do período de 2024, com o prazo a 15/02/2025, já passado a 15/03/2026 (D01, D35, KAN-127)
    assert.equal(valorDe(c, 'Comunicação'), '<span class="badge amber">por comunicar · o prazo acabou a 15/02/2025 — no 4.2A é NÃO</span>');
    assert.match(c, /<dt>Comunicação<span class="small">do período desde 01\/03\/2024<\/span><\/dt>/);
    assert.equal(valorDe(c, 'Início'), '01/03/2024');
    assert.equal(valorDe(c, 'Termo'), '28/02/2034');
    assert.equal(valorDe(c, 'Última renovação'), '—');
    assert.doesNotMatch(html, /<b>Total do quadro 4\.2<\/b>/, 'uma linha só no 4.2: sem o total (D8, maqueta 6)');
  });

  test('um NIF que não bate certo vai como está, com o selo; o cartão abre o contrato', () => {
    app.db.tenants.find((t) => t.id === 't1').nif = '123456780';
    const c = cartaoDe(app.vFisco(), 'Arroios');
    assert.equal(valorDe(c, 'NIF do inquilino'), '<span class="u-ws-nowrap">' + app.fmtNIF('123456780') + '</span> <span class="badge red">não bate certo</span>');
    assert.match(c, /^<div class="fis-ctc tap" data-toca="camada" data-click="ctView\('C1'\)">/);
  });

  test('o 4.2B no cartão do contrato: a renda dele e o n.º e a renda do anterior', () => {
    app.db.contracts.push(app.normContract({ id: 'C0', name: 'Benfica antigo', propertyId: 'v2', tenantIds: ['t2'], rent: 700, start: '2020-01-01', end: '2024-02-28', active: false,
      fisco: { estado: 'declarado', numero: '999' } }));
    const L1 = app.db.contracts.find((c) => c.id === 'L1');
    L1.fisco = app.normFisco(Object.assign({}, L1.fisco, { celebracao: '2024-02-15', rendaAnterior: 700, rendaAcimaDoLimite: false }));
    const l = app.resumoFiscal(ANO, '').linhas.find((x) => x.contratoId === 'L1');
    assert.equal(l.bonus, true, 'controlo: a renda baixou mais de 5 %');
    const c = cartaoDe(app.vFisco(), 'Benfica longo');
    assert.match(c, /<p class="lbl fis-ctc-grupo">Quadro 4\.2B<\/p>/);
    assert.equal(valorDe(c, 'Renda deste contrato'), app.euro2(600));
    assert.equal(valorDe(c, 'N.º do contrato anterior'), '999');
    assert.equal(valorDe(c, 'Renda do contrato anterior'), app.euro2(700));
  });

  test('os campos são texto simples, na mesma ordem, para quem escreve o PDF', () => {
    const r = app.resumoFiscal(ANO, '');
    // o n.º do campo vem do resumo (l.campo); à cabeça, quando o há
    const l = Object.assign({}, r.linhas.find((x) => x.contratoId === 'C1'), { campo: '4001' });
    const cs = app.fiscoCamposDe(r, l);
    assert.deepEqual(JSON.parse(JSON.stringify(cs.slice(0, 4).map((c) => [c.grupo, c.campo, c.valor, c.falta]))),
      [['', 'Campo', '4001', false], ['', 'N.º do contrato', '1234567', false], ['', 'Data de início', '01/01/2024', false], ['', 'Freguesia (código)', '110623', false]]);
    assert.equal(app.fiscoCamposDe(r, Object.assign({}, l, { campo: '' }))[0].campo, 'N.º do contrato', 'sem campo no resumo, não se inventa');
    assert.ok(cs.every((c) => !/[<>]/.test(c.valor)), 'sem HTML nos valores');
    assert.deepEqual(JSON.parse(JSON.stringify([...new Set(cs.map((c) => c.grupo))])), ['', 'Após início do arrendamento'], 'o grupo do impresso (D90)');
  });
});
