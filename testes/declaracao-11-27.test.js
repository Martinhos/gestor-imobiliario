// A página do IRS (a Declaração) depois dos comentários do Martinho de
// 2026-11-27, testada no Samsung:
// - KAN-127-17: «A tua situação fiscal» é o primeiro cartão, com uma frase de
//   uma ou duas linhas e o botão; as explicações vão para um «?»
//   (fisco.js:fiscoSituacaoCard, fisco.js:fisAjudaTexto).
// - KAN-170: os números do topo abrem o porquê numa janela, como os da Visão
//   geral, e o cartão não cresce (vistas.js:kpi com janela, vistas.js:kpiJanela).
// - KAN-129-5: o valor das linhas dos cartões não encolhe até ficar cortado
//   (estilos.css, o bloco da declaracao).
// - KAN-153-2: copiar um valor dá «1250,00», sem espaços nem «€», e o NIF sem
//   espaços (formato.js:copiaLimpa, fisco.js:fisCopiaLimpa).
// - KAN-129-2: um imóvel lá fora com um contrato sem rendas no ano diz o que
//   falta no cartão do Anexo J (fisco.js:fiscoContratosAindaSemRendas).
// - KAN-154-4 e KAN-128-6: o aviso dos donos («É só meu») vem com a primeira
//   renda; sem rendas, a página diz o que falta e o que vai aparecer.
// - KAN-129-6: em conjunta, o aviso dos imóveis do cônjuge é informativo.
// - KAN-126-8: a exportação é uma folha de cálculo .xlsx (fisco-exportar.js:fiscoXlsx).
// - KAN-152-1: uma parte da casa por quarto (fisco-resumo.js:fiscoPartesDosQuartos).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-27' });
afterEach(() => repor(app));

const css = fs.readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const json = (x) => JSON.parse(JSON.stringify(x));
/* o texto de um bocado de HTML, sem as etiquetas e com os espaços juntos */
const texto = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const renda = (c, p, d, v) => app.db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: v, propertyId: p, contractId: c, recibo: true, date: d }));

beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
  app.CW = { user: { id: 'ana' }, _esperaFim: true };
  app.fiscoAno = '2026';
  app.fiscoSitAberta = null;
  app.render = () => {};
  app.toast = () => {};
});

/* o T2 Lumiar, só da Ana e sem donos de fora, com um contrato declarado e rendas de 2026 */
const lumiar = () => {
  app.db.properties.push(app.normProp({ id: 'v1', name: 'T2 Lumiar', ownerIds: ['ana'], freguesiaCodigo: '110621', tipoPredio: 'U', matrix: '7000', fraction: 'C', comproprietariosFora: [] }));
  app.db.contracts.push(app.normContract({ id: 'C1', name: 'Lumiar', propertyId: 'v1', tenantIds: ['t1'], rent: 1037.5, active: true, start: '2024-01-01', fisco: { estado: 'declarado', numero: '1010101', finalidade: 'hp' } }));
  for (let m = 1; m <= 11; m++) renda('C1', 'v1', '2026-' + String(m).padStart(2, '0') + '-05', 1037.5);
};

describe('KAN-127-17 · a situação fiscal à cabeça, curta, com as explicações no «?»', () => {
  test('é o primeiro cartão da página, antes dos números, de «A tratar» e dos quadros', () => {
    lumiar();
    const h = app.vFisco(), sit = h.indexOf('<section class="card ana-cartao fis-sit');
    assert.ok(sit > h.indexOf('<div class="ana-barra">'), 'depois da barra das ações');
    assert.equal(h.indexOf('<section'), sit, 'o primeiro cartão');
    assert.ok(sit < h.indexOf('fis-kpis') && sit < h.indexOf('A tratar antes de entregar') && sit < h.indexOf('fiscoPilha'));
    assert.equal(h.split('A tua situação fiscal em 2026').length, 2, 'uma vez só');
  });

  test('fechado: o título com o «?», uma frase com o que está escolhido e o botão — nada mais à vista', () => {
    lumiar();
    const h = app.fiscoSituacaoCard(app.resumoFiscal(2026));
    const fora = h.slice(0, h.indexOf('<div class="fis-sit-corpo"'));
    assert.equal(texto(fora), 'A tua situação fiscal em 2026 Declaração em separado, és o titular A · passas recibos eletrónicos Mudar a situação fiscal');
    assert.match(fora, /<span class="ana-extra"><button type="button" class="ct-ajuda fis-ajuda" id="fis_aj_situacao" data-toca="camada" data-click="fisExplicar\('situacao',2026\)" aria-label="Explicar: A tua situação fiscal" aria-haspopup="dialog">/);
    assert.match(h, /<div class="fis-sit-corpo" id="fiscoSitCorpo" hidden>/);
    assert.match(app.fisAjudaTexto('situacao', 2026)[0], /^Daqui depende o Anexo F de 2026\./, 'o porquê no «?»');
  });

  test('aberto: cada escolha tem o seu «?», fora do <label>, e as notas longas saíram da vista', () => {
    lumiar();
    app.db.owners.push(app.normPerson({ id: 'rui', name: 'Rui' }));
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: true, conjugeId: 'rui', dispensaRecibos: true } } });
    const h = app.fiscoSituacaoCard(app.resumoFiscal(2026), true), t = texto(h);
    for (const k of ['situacao', 'conjunta', 'conjuge', 'letra', 'dispensa']) assert.match(h, new RegExp(`id="fis_aj_${k}"[^>]*data-click="fisExplicar\\('${k}',2026\\)"`), 'o «?» de ' + k);
    assert.doesNotMatch(h, /<label[^>]*>(?:(?!<\/label>)[\s\S])*fis-ajuda/, 'nenhum «?» dentro de um <label>');
    assert.doesNotMatch(t, /sujeito passivo A|D1, AF1 ou DG1|tinha 65 anos|Cada ano tem a sua situação|Em conjunta há uma só declaração/, 'as explicações estão nos «?»');
    assert.match(t, /Entregas o Modelo 44 das rendas de 2026 até ao fim de fevereiro de 2027\./, 'o caso de agora, curto, fica');
    assert.match(app.fisAjudaTexto('letra', 2026)[0], /sujeito passivo A e sujeito passivo B/);
    assert.match(app.fisAjudaTexto('dispensa', 2026).join(' '), /tinha 65 anos ou mais/);
  });

  test('o «?» abre a explicação numa janela só de leitura, com «Fechar»', () => {
    let aberta = null;
    app.openModal = (titulo, corpo, pe) => { aberta = { titulo, corpo, pe }; return {}; };
    app.fisExplicar('dispensa', 2026);
    assert.equal(aberta.titulo, 'Dispensa dos recibos eletrónicos');
    assert.equal((aberta.corpo.match(/<p class="ct-explica">/g) || []).length, 3, 'um parágrafo por nota');
    assert.match(aberta.pe, />Fechar<\/button>$/);
    assert.doesNotMatch(aberta.corpo, /<input|<button/, 'só de leitura');
  });
});

describe('KAN-170 · os números do topo abrem uma janela', () => {
  test('os cinco cartões abrem o porquê numa janela (kpiModal), e não por baixo', () => {
    lumiar();
    const h = app.fiscoKpis(app.resumoFiscal(2026));
    const cartoes = [...h.matchAll(/<div class="card kpi why janela" id="(k\d+)" data-toca="camada" data-click="kpiModal\('\1'\)" aria-haspopup="dialog">/g)];
    assert.equal(cartoes.length, 5);
    assert.doesNotMatch(h, /kpiPorque/, 'nenhum abre no sítio');
    cartoes.forEach((m) => assert.equal(app.KPI_REG[m[1]].janela, true, 'registado, para o embrulho da nuvem o deixar abrir'));
    assert.match(css, /\n\.kpi\.janela \.expl\{display:none\}/, 'o porquê nunca se abre no cartão');
  });

  test('a janela: o rótulo no título, o valor, as linhas do cartão e o porquê', () => {
    let aberta = null;
    app.openModal = (titulo, corpo) => { aberta = { titulo, corpo }; return {}; };
    const el = (html) => ({ textContent: html.replace(/<[^>]+>/g, ''), innerHTML: html, className: '' });
    const cartao = {
      querySelector: (s) => ({ '.label': el('Imposto estimado'), '.value': Object.assign(el('1 245 €'), { className: 'value' }), '.expl': el('O rendimento líquido de cada linha…') })[s] || null,
      querySelectorAll: (s) => (s === '.foot' ? [el('já retido 0 € · falta 1 245 €'), el('taxas do continente')] : []),
    };
    app.kpiJanela(cartao);
    assert.equal(aberta.titulo, 'Imposto estimado');
    assert.match(aberta.corpo, /<div class="value kpi-janela-valor">1 245 €<\/div>/);
    assert.match(aberta.corpo, /<ul class="kpi-janela-linhas"><li>já retido 0 € · falta 1 245 €<\/li><li>taxas do continente<\/li><\/ul>/);
    assert.match(aberta.corpo, /<p class="kpi-janela-porque">O rendimento líquido de cada linha…<\/p>/);
  });
});

describe('KAN-129-5 · o valor de uma linha cabe sempre inteiro', () => {
  test('o valor não encolhe e o texto ao lado parte em linhas', () => {
    assert.match(css, /\n\.fis \.row-between>b:last-child,\.fis \.stat>b:last-child\{flex:0 0 auto;min-width:max-content;white-space:nowrap;text-align:right\}/);
    assert.match(css, /\n\.fis \.row-between>\.u-minw-0\{flex:1 1 auto;overflow-wrap:anywhere\}/);
    // o .row-between dá min-width:0 a todos os filhos: era isso que deixava o valor encolher
    assert.match(css, /\n\.row-between>\*\{min-width:0\}/);
  });
});

describe('KAN-153-2 · copiar um valor para o Portal, limpo', () => {
  test('copiaLimpa: os euros sem os espaços dos milhares nem o «€», e o NIF seguido', () => {
    const N = ' ';
    assert.equal(app.copiaLimpa('12' + N + '450,00' + N + '€'), '12450,00');
    assert.equal(app.copiaLimpa('1 250,00'), '1250,00', 'com o espaço normal (como colou o Martinho)');
    assert.equal(app.copiaLimpa('1 250,00 €'), '1250,00');
    assert.equal(app.copiaLimpa('1250,00'), '1250,00');
    assert.equal(app.copiaLimpa('−50,00' + N + '€'), '-50,00', 'o sinal tipográfico vira o hífen-menos');
    assert.equal(app.copiaLimpa('1' + N + '251' + N + '€'), '1251');
    assert.equal(app.copiaLimpa(' 123 456 789 '), '123456789');
    assert.equal(app.copiaLimpa('T2 Lumiar'), null);
    assert.equal(app.copiaLimpa('4.1'), null);
  });

  test('fisCopiaLimpa: dentro da Declaração escreve o valor limpo; fora dela ou com texto, deixa', () => {
    const evento = () => { const e = { dados: null, parado: false, clipboardData: { setData: (t, v) => { e.dados = [t, v]; } }, preventDefault: () => { e.parado = true; } }; return e; };
    const sel = (txt, naFis) => ({ isCollapsed: false, rangeCount: 1, toString: () => txt,
      getRangeAt: () => ({ commonAncestorContainer: { nodeType: 1, closest: (s) => (s === '.fis' && naFis ? {} : null) } }) });
    const antes = app.getSelection;
    try {
      app.getSelection = () => sel('12 450,00 €', true);
      let e = evento(); app.fisCopiaLimpa(e);
      assert.deepEqual(json(e.dados), ['text/plain', '12450,00']); assert.ok(e.parado);
      app.getSelection = () => sel('12 450,00 €', false);
      e = evento(); app.fisCopiaLimpa(e);
      assert.equal(e.dados, null, 'fora da Declaração, como sempre');
      app.getSelection = () => sel('Quadro 4.1 · sem redução', true);
      e = evento(); app.fisCopiaLimpa(e);
      assert.equal(e.dados, null, 'um texto que não é um valor copia como está');
    } finally { app.getSelection = antes; }
  });

  test('os valores selecionam-se com o dedo também dentro de um cartão que se toca', () => {
    assert.match(css, /\n\.fis \.fis-campo dd,\.fis \.cp-eur,\.fis \.row-between>b:last-child,\.fis \.stat>b:last-child\{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default\}/);
  });
});

describe('KAN-129-2 · o Anexo J de um imóvel lá fora', () => {
  const paris = (comRendas) => {
    app.db.properties.push(app.normProp({ id: 'fr', name: 'Apartamento Paris', ownerIds: ['ana'], pais: 'França', paisCodigo: '250', comproprietariosFora: [] }));
    app.db.contracts.push(app.normContract({ id: 'CF', name: 'Paris', propertyId: 'fr', tenantIds: ['t1'], rent: 1200, active: true, start: '2026-01-01', fisco: { estado: 'declarado' } }));
    if (comRendas) for (let m = 1; m <= 10; m++) renda('CF', 'fr', '2026-' + String(m).padStart(2, '0') + '-05', 1200);
  };

  test('com rendas no ano, o cartão do quadro 7A', () => {
    lumiar(); paris(true);
    const h = app.vFisco();
    assert.match(h, /<h2 class="ana-tit">Anexo J · quadro 7A<\/h2>/);
    assert.match(texto(h), /250 · França/);
  });

  test('sem rendas no ano, o cartão diz o que falta (antes não aparecia nada)', () => {
    lumiar(); paris(false);
    const r = app.resumoFiscal(2026);
    assert.equal(r.anexoJ.length, 0, 'controlo: sem rendas, o resumo não tem entrada');
    assert.deepEqual(json(app.fiscoContratosAindaSemRendas(r).anexoJ), [{ contratoId: 'CF', nome: 'Paris', imovel: 'Apartamento Paris', pais: 'França' }]);
    const j = app.fiscoAnexoJCard(r);
    assert.match(j, /<h2 class="ana-tit">Anexo J · quadro 7A<\/h2><span class="small">Sem rendas em 2026<\/span>/);
    assert.match(texto(j), /O contrato Paris \(Apartamento Paris, França\) não tem nenhuma renda registada em 2026: o quadro 7A enche-se quando registares a primeira, ligada ao contrato\./);
  });

  test('sem nenhuma renda no ano, o vazio da página nomeia-o e diz onde vai', () => {
    paris(false);
    const t = texto(app.vFisco());
    assert.match(t, /Sem rendas em 2026/);
    assert.match(t, /O contrato Paris, de um imóvel em França, não tem nenhuma renda registada em 2026: com a primeira, aparece o cartão do Anexo J \(quadro 7A\)/);
  });
});

describe('KAN-154-4 e KAN-128-6 · o aviso dos donos de um imóvel novo', () => {
  const novo = (inicio, comRendas) => {
    app.db.properties.push(app.normProp({ id: 'vn', name: 'T1 Novo', ownerIds: ['ana'] }));
    app.db.contracts.push(app.normContract({ id: 'CN', name: 'Novo', propertyId: 'vn', tenantIds: ['t1'], rent: 800, active: true, start: inicio }));
    if (comRendas) ['2026-10-05', '2026-11-05'].forEach((d) => renda('CN', 'vn', d, 800));
  };

  test('com rendas no ano: «há mais donos além de ti?», com «É só meu» e «Há outros donos»', () => {
    novo('2026-10-01', true);
    const a = app.resumoFiscal(2026).avisos.find((x) => /^Imóvel T1 Novo: há mais donos além de ti\?/.test(x.texto));
    assert.ok(a, 'o aviso dos donos');
    assert.equal(a.acaoTexto, 'É só meu');
    assert.equal(a.abrirTexto, 'Há outros donos');
    assert.equal(a.acao, "imvSoMeu('vn')");
  });

  test('«Não, mais ninguém» na ficha tira o aviso', () => {
    novo('2026-10-01', true);
    app.prop('vn').comproprietariosFora = [];
    assert.ok(!app.resumoFiscal(2026).avisos.some((x) => /há mais donos além de ti/.test(x.texto)));
  });

  test('sem rendas: o vazio diz o que falta e o que aparece com a primeira renda', () => {
    novo('2026-10-01', false);
    const t = texto(app.vFisco());
    assert.match(t, /O contrato Novo, em vigor em 2026, não tem nenhuma renda registada neste ano\./);
    assert.match(t, /com a primeira, aparecem a linha do quadro e o que houver a tratar, como os dados do imóvel e do contrato ou se há mais donos além de ti\./);
  });

  test('um contrato que começa mais à frente no ano diz quando (antes era só o texto padrão)', () => {
    novo('2026-12-01', false);
    assert.equal(app.fiscoContratosSemRendas(app.resumoFiscal(2026)).length, 0, 'controlo: ainda não está em vigor');
    assert.match(texto(app.vFisco()), /O contrato Novo começa a 01\/12\/2026: as rendas dele entram aqui quando as registares\./);
  });
});

describe('KAN-129-6 · em conjunta, o aviso dos imóveis do cônjuge é informativo (cinzento)', () => {
  test('com o cônjuge escolhido, nível info, e o botão de nenhum sítio', () => {
    lumiar();
    app.db.owners.push(app.normPerson({ id: 'rita', name: 'Rita' }));
    app.db.properties.push(app.normProp({ id: 'vc', name: 'T3 da Rita', ownerIds: ['ana', 'rita'], freguesiaCodigo: '110622', tipoPredio: 'U', matrix: '8000', comproprietariosFora: [] }));
    app.db.contracts.push(app.normContract({ id: 'CC', name: 'Casa da Rita', propertyId: 'vc', tenantIds: ['t1'], rent: 900, active: true, start: '2024-01-01', fisco: { estado: 'declarado', numero: '3030303', finalidade: 'hp' } }));
    renda('CC', 'vc', '2026-03-05', 900);
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: true, conjugeId: 'rita' } } });
    const a = app.resumoFiscal(2026).avisos.find((x) => /^Tributação conjunta com Rita: entram só os imóveis do cônjuge/.test(x.texto));
    assert.ok(a);
    assert.equal(a.nivel, 'info');
    assert.match(texto(app.fiscoObrigacoesCard(app.resumoFiscal(2026), false)), /Tributação conjunta com Rita/);
    assert.match(app.fiscoObrigacoesCard(app.resumoFiscal(2026), false), /<span class="badge grey fis-num">\d+<\/span><p>Tributação conjunta com Rita/);
  });
});

describe('KAN-126-8 · a exportação é uma folha de cálculo .xlsx', () => {
  /* os ficheiros de um zip sem compressão (o método 0): {nome: texto} */
  const lerZip = (b) => {
    const u = Buffer.from(b), out = {};
    let p = 0;
    while (u.readUInt32LE(p) === 0x04034b50) {
      assert.equal(u.readUInt16LE(p + 8), 0, 'sem compressão (STORE)');
      const tam = u.readUInt32LE(p + 18), ln = u.readUInt16LE(p + 26), le = u.readUInt16LE(p + 28);
      const nome = u.slice(p + 30, p + 30 + ln).toString('utf8'), ini = p + 30 + ln + le;
      out[nome] = u.slice(ini, ini + tam).toString('utf8');
      p = ini + tam;
    }
    return out;
  };

  test('o botão e o nome antigo descarregam anexo-f-AAAA.xlsx, com o tipo da folha de cálculo', () => {
    lumiar();
    const vistos = [];
    app.download = (nome, mime, bytes) => vistos.push({ nome, mime, bytes });
    app.fiscoXlsx(); app.fiscoCsv();
    assert.deepEqual(json(vistos.map((v) => [v.nome, v.mime])), [['anexo-f-2026.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], ['anexo-f-2026.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']]);
    assert.ok(vistos[0].bytes instanceof app.Uint8Array || ArrayBuffer.isView(vistos[0].bytes), 'bytes, e não texto (sem a marca de ordem de bytes do CSV)');
  });

  test('um zip com as peças do SpreadsheetML e três folhas: «Anexo F», «A tratar» e «Estimativa e notas»', () => {
    lumiar();
    const z = lerZip(app.fiscoXlsxBytes(app.resumoFiscal(2026)));
    assert.deepEqual(Object.keys(z), ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
      'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml', 'xl/sharedStrings.xml']);
    assert.deepEqual([...z['xl/workbook.xml'].matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]), ['Anexo F', 'A tratar', 'Estimativa e notas']);
    assert.match(z['xl/styles.xml'], /<font><b\/>/, 'o negrito do cabeçalho');
    assert.match(z['xl/styles.xml'], /<xf numFmtId="4"/, 'o formato de duas casas dos euros');
    assert.ok(z['xl/sharedStrings.xml'].includes('<t xml:space="preserve">imóvel</t>'), 'os acentos em UTF-8');
  });

  test('os euros são números (somam-se), os códigos texto com os zeros, e o cabeçalho a negrito', () => {
    lumiar();
    const [anexo, tratar, notas] = app.fiscoXlsxFolhas(app.resumoFiscal(2026));
    const cab = anexo.linhas[0].map((c) => c.v), l = anexo.linhas[1];
    assert.deepEqual(json(l[cab.indexOf('rendas_iliquidas')]), { t: 'n', v: 11412.5 }, '11 × 1037,50');
    assert.deepEqual(json(l[cab.indexOf('freguesia')]), { t: 'c', v: '110621' });
    assert.deepEqual(json(l[cab.indexOf('natureza')]), { t: 'c', v: '07' });
    assert.equal(tratar.linhas[0].map((c) => c.v).join('|'), 'ano|nível|o que tratar antes de entregar');
    assert.equal(notas.linhas[0].slice(0, 3).map((c) => c.v).join('|'), 'ano|o quê|texto');
    assert.ok(notas.linhas.some((x) => x[1] && x[1].v === 'aviso' && x[2].v === app.IRS_AVISO), 'o aviso aprovado à letra');
    const x = app.fiscoXlsxFicheiros([anexo, tratar, notas]), s1 = x.find((f) => f.nome === 'xl/worksheets/sheet1.xml').texto;
    const ref = app.fiscoXlsxColuna(cab.indexOf('rendas_iliquidas')) + '2';
    assert.ok(s1.includes(`<c r="${ref}" s="2"><v>11412.5</v></c>`), 'a célula numérica, com o formato das duas casas');
    assert.match(s1, /<c r="A1" t="s" s="1">/, 'o cabeçalho a negrito');
    assert.match(s1, /<pane ySplit="1"/, 'o cabeçalho fixo no topo');
    assert.equal(app.fiscoXlsxColuna(0) + app.fiscoXlsxColuna(25) + app.fiscoXlsxColuna(26) + app.fiscoXlsxColuna(130), 'AZAAEA');
  });

  test('o CRC de cada ficheiro é o do zip (o mesmo do zlib)', async () => {
    const zlib = await import('node:zlib');
    const b = new TextEncoder().encode('Anexo F · imóvel € 12 450,00');
    assert.equal(app.fiscoCrc32(b), zlib.crc32(b));
  });
});

describe('KAN-152-1 · uma parte da casa por quarto', () => {
  test('a parte de cada quarto: a indicada; os sem parte dividem o resto; sem nenhuma, partes iguais', () => {
    const p = (rooms) => app.fiscoPartesDosQuartos({ rooms });
    assert.deepEqual(json(p([{ id: 'a', parte: 18 }, { id: 'b', parte: 22 }, { id: 'c', parte: 30 }]).partes), { a: 0.18, b: 0.22, c: 0.3 });
    const x = p([{ id: 'a', parte: 30 }, { id: 'b' }, { id: 'c' }]);
    assert.deepEqual(json(x.partes), { a: 0.3, b: 0.35, c: 0.35 });
    assert.deepEqual(json(x.semParte), ['b', 'c']);
    assert.equal(x.indicadas, true);
    const y = p([{ id: 'a' }, { id: 'b' }]);
    assert.deepEqual(json(y.partes), { a: 0.5, b: 0.5 });
    assert.equal(y.indicadas, false);
  });

  test('três quartos de 18, 22 e 30 %, dois arrendados: os gastos da casa contam 40 %', () => {
    app.db.properties.push(app.normProp({ id: 'q', name: 'Casa dos Quartos', ownerIds: ['ana'], use: 'investimento', rentalMode: 'quartos', comproprietariosFora: [],
      rooms: [{ id: 'r1', name: 'A', parte: 18 }, { id: 'r2', name: 'B', parte: 22 }, { id: 'r3', name: 'C', parte: 30 }] }));
    const p = app.prop('q');
    p.rooms = [{ id: 'r1', name: 'A', parte: 18 }, { id: 'r2', name: 'B', parte: 22 }, { id: 'r3', name: 'C', parte: 30 }];
    ['r1', 'r2'].forEach((q, i) => app.db.contracts.push(app.normContract({ id: 'K' + i, name: 'K' + i, propertyId: 'q', roomId: q, rent: 400, active: true, start: '2025-01-01' })));
    assert.deepEqual(json(app.fiscoParteArrendada(p, '2026-05-01', 2026)), { parte: 0.4, origem: 'partes' });
    const d = app.fiscoParteArrendadaDoAno(p, 2026);
    assert.ok(Math.abs(d.parte - 0.4) < 1e-9 && d.porOmissao === false && d.arrendados === 2);
  });
});
