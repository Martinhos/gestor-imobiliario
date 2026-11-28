// O formulário e a ficha do imóvel com os campos da ronda 2 do IRS: o código
// da freguesia com as letras da AT (0302FE, 0308FA), o aviso das uniões de
// freguesias desagregadas em outubro de 2025 com as freguesias repostas e o
// «Confirmei na caderneta», a dica da caderneta atual, o país de um imóvel
// fora de Portugal (o Anexo J), o imóvel reabilitado do quadro 6A e a Loja
// com História do 6B — com o que o motor do IRS lê deles.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, elementos } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';
import { conferir } from './lib/formularios.js';

const app = carregarApp({ hoje: '2026-11-18' });
const el = elementos(app);
afterEach(() => repor(app));

/* Uma base com um dono e as janelas numa pilha observável; os avisos ficam
   numa lista.
   Devolve: {abertas, avisos}. */
function base() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Eu' })];
  const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
  const avisos = [];
  app.toast = (m) => { avisos.push(m); };
  return { abertas, avisos };
}

/* Escreve nos campos do formulário (o DOM do arnês lembra-se de cada
   elemento pelo id): texto no value, booleanos no checked.
   Recebe: v — {id: valor}. */
function escrever(v) {
  for (const [id, x] of Object.entries(v)) { if (typeof x === 'boolean') el[id].checked = x; else el[id].value = x; }
}

/* Abre o formulário de um imóvel novo (ou de um que existe), escreve os
   campos e carrega no Guardar.
   Recebe: v — os campos; id (opcional) — o imóvel a editar.
   Devolve: o imóvel gravado por último na base, ou null. */
function guardar(v, id) {
  app.propModal(id);
  escrever(Object.assign({ p_name: 'Casa' }, v));
  app.onSave();
  return app.db.properties.length ? app.db.properties[app.db.properties.length - 1] : null;
}

describe('D136 · o código da freguesia com as letras da AT', () => {
  test('o campo deixa escrever letras, em maiúsculas, e continua com seis caracteres', () => {
    base();
    app.pForm = app.normProp({ id: 'P1', name: 'T2' });
    const html = app.propBody();
    const campo = /<input id="p_freguesiaCodigo"[^>]*>/.exec(html)[0];
    assert.match(campo, /inputmode="text"/, 'o teclado tem letras');
    assert.match(campo, /autocapitalize="characters"/, 'e escreve em maiúsculas');
    assert.match(campo, /maxlength="6"/);
    assert.doesNotMatch(campo, /inputmode="numeric"/);
  });

  test('0302FI, de Barcelos, grava-se com as letras; em minúsculas fica em maiúsculas', () => {
    const { avisos } = base();
    const p = guardar({ p_freguesiaCodigo: '0302fi' });
    assert.ok(p, 'gravou');
    assert.equal(p.freguesiaCodigo, '0302FI');
    assert.equal(avisos[avisos.length - 1], 'Imóvel adicionado.');
    const g = guardar({ p_name: 'Sande', p_freguesiaCodigo: ' 0308 FA ' });
    assert.equal(g.freguesiaCodigo, '0308FA', 'sem espaços');
  });

  test('o que não tem o formato da AT é recusado com a frase nova, e nada se grava', () => {
    const { avisos } = base();
    for (const c of ['1106', '0302-F', 'AB0302', '03O2FE']) {
      avisos.length = 0;
      guardar({ p_freguesiaCodigo: c });
      assert.deepEqual(avisos, ['O código da freguesia tem 6 caracteres (distrito, concelho e freguesia), como na caderneta.'], c);
      app.modalStack.length = 0;
    }
    assert.equal(app.db.properties.length, 0);
  });

  test('o 0302FE (Silveiros e Rio Covo, união desde 2013 e extinta em 2025) é aceite e fica guardado', () => {
    const { abertas } = base();
    guardar({ p_freguesiaCodigo: '0302FE', p_matrix: '88' });
    assert.equal(abertas[abertas.length - 1].t, 'Este código de freguesia mudou', 'avisa que mudou');
    app.imvFreguesiaGuardar(0);
    assert.equal(app.db.properties.length, 1);
    assert.equal(app.db.properties[0].freguesiaCodigo, '0302FE', 'não volta cortado a 0302');
    assert.equal(app.normProp(JSON.parse(JSON.stringify(app.db.properties[0]))).freguesiaCodigo, '0302FE', 'e a cópia normalizada também não');
  });
});

describe('D135 · as freguesias repostas em outubro de 2025', () => {
  test('ao guardar o código de uma união extinta, a pergunta diz as freguesias repostas e não troca o código', () => {
    const { abertas } = base();
    guardar({ p_freguesiaCodigo: '010123', p_matrix: '1234' });
    const q = abertas[abertas.length - 1];
    assert.equal(q.t, 'Este código de freguesia mudou');
    assert.match(q.b, /O código 010123 é o de uma união de freguesias desagregada em outubro de 2025 \(Lei 25-A\/2025\)/);
    assert.match(q.b, /uma destas: 010128 Agadão, 010132 Belazaima do Chão ou 010134 Castanheira do Vouga, e o artigo pode ter mudado/);
    assert.doesNotMatch(q.b, /UNIÃO DAS FREGUESIAS/, 'o nome da tabela, em maiúsculas, não se mostra');
    assert.match(q.f, /data-click="imvFreguesiaCorrigir\(\)"[^>]*>Corrigir o código</);
    assert.match(q.f, /data-click="imvFreguesiaGuardar\(0\)">Guardar assim</);
    assert.doesNotMatch(q.f + q.b, /Confirmei na caderneta/, 'um código de união não se confirma (N087)');
    assert.equal(app.db.properties.length, 0, 'ainda não gravou');
    app.imvFreguesiaGuardar(1);
    const p = app.db.properties[0];
    assert.equal(p.freguesiaCodigo, '010123', 'a app não escolhe a freguesia reposta');
    assert.equal(p.matrizConfirmada, '', 'o 1 de uma janela antiga grava como «Guardar assim»');
    // o próximo Guardar pergunta outra vez, também com a marca da caderneta
    const n = abertas.length;
    guardar({ p_freguesiaCodigo: '010123', p_matrix: '1234' }, p.id);
    assert.equal(abertas.length, n + 2, 'o formulário e a pergunta');
    app.imvFreguesiaGuardar(0);
    assert.equal(app.modalStack.length, 0, 'gravou e fechou as duas');
  });

  test('«Guardar assim» grava sem a data; «Corrigir o código» volta ao formulário sem gravar', () => {
    const { abertas } = base();
    guardar({ p_freguesiaCodigo: '130812' });
    app.imvFreguesiaCorrigir();
    assert.equal(app.db.properties.length, 0, 'não gravou');
    assert.equal(app.modalStack.length, 1, 'o formulário continua aberto');
    assert.equal(app.modalStack[0], abertas[0]);
    app.onSave();
    app.imvFreguesiaGuardar(0);
    assert.equal(app.db.properties.length, 1);
    assert.equal(app.db.properties[0].freguesiaCodigo, '130812');
    assert.equal(app.db.properties[0].matrizConfirmada, '');
  });

  test('uma freguesia reposta, um código que nunca foi de uma união e um imóvel fora de Portugal não perguntam', () => {
    const { abertas } = base();
    for (const v of [{ p_freguesiaCodigo: '010128' }, { p_freguesiaCodigo: '110623' }, { p_freguesiaCodigo: '010123', p_pais: 'Espanha' }]) {
      const n = abertas.length;
      guardar(v);
      assert.equal(abertas.length, n + 1, JSON.stringify(v));
    }
    assert.equal(app.db.properties.length, 3);
  });

  test('no formulário: o aviso por baixo do código e do artigo, sem a caixa num código de união; a caixa num código novo', () => {
    base();
    app.pForm = app.normProp({ id: 'P1', name: 'T2', freguesiaCodigo: '010123', matrix: '1234', matrizConfirmada: '2026-11-01' });
    const html = app.propBody();
    assert.match(html, /<div id="imv_matriz">\s*<div class="imv-nota imv-nota-aviso small">O código 010123 é o de uma união/);
    assert.doesNotMatch(html, /id="p_matrizConfirmada"/, 'um código de união não se confirma (N087)');
    assert.match(html, /id="p_freguesiaCodigo"[^>]*data-input="imvMatrizEscrito\(\)"/);
    assert.match(html, /id="p_matrix"[^>]*data-input="imvMatrizEscrito\(\)"/);
    // escreve um código novo: a confirmação era do antigo
    escrever({ p_freguesiaCodigo: '010128', p_matrix: '1234' });
    app.imvMatrizEscrito();
    assert.equal(app.pForm.freguesiaCodigo, '010128');
    assert.equal(app.pForm.matrizConfirmada, '');
    assert.doesNotMatch(el.imv_matriz.innerHTML, /união/, 'o código novo já não é de uma união');
    assert.match(el.imv_matriz.innerHTML, /id="p_matrizConfirmada"> Confirmei/, 'a caixa desmarcada');
    // marcar a caixa grava o dia de hoje
    escrever({ p_matrizConfirmada: true });
    app.collectProp();
    assert.equal(app.pForm.matrizConfirmada, '2026-11-18');
  });

  test('sem código nem artigo, ou fora de Portugal, não há caixa nem aviso', () => {
    base();
    app.pForm = app.normProp({ id: 'P1', name: 'T2' });
    assert.doesNotMatch(app.propBody(), /p_matrizConfirmada/);
    app.pForm = app.normProp({ id: 'P1', name: 'T2', freguesiaCodigo: '010123', pais: 'França' });
    assert.doesNotMatch(app.propBody(), /p_matrizConfirmada|união de freguesias desagregada/);
  });

  test('na ficha, o cartão dos dados registais avisa só com «Corrigir», também com a marca da caderneta (N087)', () => {
    base();
    app.db.properties.push(app.normProp({ id: 'P1', name: 'Casa Agadão', ownerIds: ['O1'], freguesiaCodigo: '010123', matrix: '1234', tipoPredio: 'U' }));
    let html = app.propFicha('P1');
    assert.match(html, /<div class="imv-nota imv-nota-aviso small">O código 010123 é o de uma união de freguesias desagregada em outubro de 2025/);
    assert.match(html, /data-click="imvMatrizCorrigir\('P1'\)">Corrigir</);
    assert.doesNotMatch(html, /Confirmei na caderneta/);
    app.prop('P1').matrizConfirmada = '2026-11-01';
    html = app.propFicha('P1');
    assert.match(html, /imv-nota-aviso/, 'a marca não cala um código que já não existe');
  });

  test('na ficha, quem não edita o imóvel vê o aviso sem os botões; e uma freguesia reposta não tem aviso', () => {
    base();
    app.db.properties.push(app.normProp({ id: 'P1', name: 'A', ownerIds: ['O1'], freguesiaCodigo: '010123' }));
    app.db.properties.push(app.normProp({ id: 'P2', name: 'B', ownerIds: ['O1'], freguesiaCodigo: '010128' }));
    app.pode = (id, acao) => acao !== 'house.edit';
    const html = app.imvRegistais(app.prop('P1'), true);
    assert.match(html, /imv-nota-aviso/);
    assert.doesNotMatch(html, /imvMatrizConfirmar|imvMatrizCorrigir/);
    assert.doesNotMatch(app.imvRegistais(app.prop('P2'), true), /imv-nota-aviso/);
  });
});

describe('D137 · a dica diz a caderneta atual e a reposição de 2025', () => {
  test('a caderneta atual ou a nota do IMI mais recente, e as freguesias repostas em outubro de 2025', () => {
    base();
    app.pForm = app.normProp({ id: 'P1', name: 'T2' });
    const html = app.propBody();
    assert.match(html, /O código da freguesia \(6 caracteres\), o tipo de prédio e o artigo vêm da caderneta predial atual \(no Portal das Finanças\) ou da nota de cobrança do IMI mais recente/);
    assert.match(html, /Em outubro de 2025 foram repostas cerca de 300 freguesias que estavam em uniões \(Lei 25-A\/2025\): se o prédio era de uma união, o código e o artigo podem ter mudado — usa a caderneta de agora, não a da compra\./);
    assert.doesNotMatch(html, /6 dígitos/);
    assert.doesNotMatch(html, /\b30[23] freguesias/, 'o número exato não: a tabela tem 303 linhas e 302 códigos');
  });
});

describe('D133 · o país do imóvel', () => {
  test('o país só com «O imóvel fica fora de Portugal», junto da morada: com ele, o país (obrigatório), o código da tabela X e o Anexo J', () => {
    const { abertas } = base();
    app.propModal();
    const html = abertas[0].b;
    assert.match(html, /<input type="checkbox" role="switch" id="p_foraPT" data-change="imvForaPTMudou\(\)"> O imóvel fica fora de Portugal<\/label>/);
    assert.doesNotMatch(html, /id="p_pais"/, 'desligado, sem o país');
    assert.doesNotMatch(html, /p_paisCodigo/);
    escrever({ p_foraPT: true });
    app.imvForaPTMudou();
    const b = app.modalBodyEl().innerHTML;
    assert.match(b, /<label>País <span class="req">\*<\/span><input id="p_pais" value="" placeholder="Ex: Espanha"/);
    assert.match(b, /<label>Código do país na tabela X \(opcional\)<input id="p_paisCodigo"[^>]*placeholder="Ex: 724"/);
    assert.match(b, /não vai ao Anexo F: as rendas, os gastos e o imposto pago lá declaram-se no Anexo J \(quadro 7A\)/);
    escrever({ p_pais: 'Espanha' });
    app.imvPaisEscrito();
    assert.equal(app.pForm.pais, 'Espanha');
    app.pForm.pais = 'Espanha';
    conferir('imóvel no estrangeiro', app.propBody(), { obrigatorios: ['p_name', 'p_pais'], exemplos: { p_paisCodigo: true, p_floor: true,
      p_registry: true, p_postalCode: true, p_licence: true, p_energyCert: true, p_energyClass: true }, deixados: ['p_share_', 'p_room_', 'fn_'] });
  });

  test('guarda o país e o código; o código com outro formato é recusado; «Portugal» é Portugal', () => {
    const { avisos } = base();
    const p = guardar({ p_pais: ' Espanha ', p_paisCodigo: '724' });
    assert.equal(p.pais, 'Espanha');
    assert.equal(p.paisCodigo, '724');
    avisos.length = 0;
    guardar({ p_name: 'Paris', p_pais: 'França', p_paisCodigo: 'FR' });
    assert.deepEqual(avisos, ['O código do país são 1 a 3 algarismos, como na tabela X das instruções do Anexo J (o Brasil é 76).']);
    assert.equal(app.db.properties.length, 1);
    app.modalStack.length = 0;
    const q = guardar({ p_name: 'Lisboa', p_pais: 'portugal', p_paisCodigo: '620' });
    assert.equal(q.pais, '');
    assert.equal(q.paisCodigo, '', 'sem país, sem código');
    const html = app.propFicha(p.id);
    assert.match(html, /país: Espanha \(código 724\)/);
  });
});

describe('D117 · o imóvel reabilitado (quadro 6A)', () => {
  test('a pergunta, e com ela o início, a conclusão, o certificado e a data de aquisição obrigatória', () => {
    base();
    app.pForm = app.normProp({ id: 'P1', name: 'T2' });
    let html = app.propBody();
    assert.match(html, /<label>Imóvel reabilitado \(quadro 6A\)<div class="sel" id="sel_p_reabTipo">/);
    assert.ok(app.__sel.p_reabTipo.options.some((o) => o.v === 'aru'), 'ARU');
    assert.ok(app.__sel.p_reabTipo.options.some((o) => o.v === 'nrau'), 'NRAU');
    assert.equal(app.__sel.p_reabTipo.onchange, 'imvReabMudou');
    assert.doesNotMatch(html, /p_reabInicio/, 'com «Não», sem as datas');
    assert.doesNotMatch(html, /Data de aquisição <span class="req">/);
    app.pForm.reabilitacao = { tipo: 'aru', inicio: '', conclusao: '', certificado: false };
    html = app.propBody();
    assert.match(html, /Início da reabilitação <span class="req">\*<\/span><input id="p_reabInicio" type="date"/);
    assert.match(html, /Conclusão <span class="req">\*<\/span><input id="p_reabConclusao" type="date"/);
    assert.match(html, /<input type="checkbox" role="switch" id="p_reabCertificado"> Tenho o certificado da câmara do início e da conclusão/);
    assert.match(html, /Data de aquisição <span class="req">\*<\/span><input id="p_purchaseDate"/);
    assert.match(html, /as rendas pagam 5 %/, 'o texto da versão do ano');
    assert.match(html, /diz se já eras dono a 6 de outubro de 2023/);
    conferir('imóvel reabilitado', html, { obrigatorios: ['p_name', 'p_reabInicio', 'p_reabConclusao', 'p_purchaseDate'], exemplos: { p_freguesiaCodigo: true, p_fraction: true, p_floor: true,
      p_registry: true, p_postalCode: true, p_matrix: true, p_licence: true, p_energyCert: true, p_energyClass: true }, deixados: ['p_share_', 'p_room_', 'fn_'] });
  });

  test('o guardar pede o início, a conclusão (não antes do início) e a data de aquisição', () => {
    const { avisos } = base();
    const tenta = (v) => { avisos.length = 0; app.modalStack.length = 0; guardar(Object.assign({ p_reabTipo: 'aru' }, v)); return avisos[0]; };
    assert.equal(tenta({}), 'Indica quando começou a reabilitação.');
    assert.equal(tenta({ p_reabInicio: '2018-02-01' }), 'Indica quando ficou concluída a reabilitação.');
    assert.equal(tenta({ p_reabInicio: '2018-02-01', p_reabConclusao: '2017-12-01' }), 'A conclusão é antes do início.');
    assert.equal(tenta({ p_reabInicio: '2018-02-01', p_reabConclusao: '2019-06-30' }), 'Indica a data de aquisição: o 6A só vale se já eras dono a 6 de outubro de 2023.');
    assert.equal(app.db.properties.length, 0, 'nada gravado');
  });

  test('grava o que o motor lê: com as condições, as rendas pagam 5 % e a linha fica no 4.1 com o 6A', () => {
    base();
    const p = guardar({ p_reabTipo: 'aru', p_reabInicio: '2018-02-01', p_reabConclusao: '2019-06-30', p_reabCertificado: true, p_purchaseDate: '2017-03-10' });
    assert.deepEqual(JSON.parse(JSON.stringify(p.reabilitacao)), { tipo: 'aru', inicio: '2018-02-01', conclusao: '2019-06-30', certificado: true });
    const c = app.normContract({ id: 'C1', propertyId: p.id, rent: 900, start: '2021-09-01', fisco: { estado: 'declarado', finalidade: 'hp' } });
    app.db.contracts.push(c);
    assert.deepEqual(JSON.parse(JSON.stringify(app.irsBeneficios(c, 2025).map((b) => b.id))), ['reab71']);
    const t = app.irsTaxa(c, 2025);
    assert.equal(t.motivo, 'reabilitacao');
    assert.equal(t.taxa, 5);
    assert.match(app.propFicha(p.id), /imóvel reabilitado \(ARU, com certificado\) · quadro 6A/);
  });

  test('voltar a «Não» tira a reabilitação inteira ao guardar', () => {
    base();
    app.db.properties.push(app.normProp({ id: 'P1', name: 'T2', ownerIds: ['O1'], purchaseDate: '2017-03-10', reabilitacao: { tipo: 'nrau', inicio: '2018-02-01', conclusao: '2019-06-30', certificado: true } }));
    guardar({ p_reabTipo: '', p_reabInicio: '2018-02-01', p_reabConclusao: '2019-06-30', p_reabCertificado: true, p_purchaseDate: '2017-03-10' }, 'P1');
    assert.deepEqual(JSON.parse(JSON.stringify(app.prop('P1').reabilitacao)), { tipo: '', inicio: '', conclusao: '', certificado: false });
  });
});

describe('D121 · a Loja com História (quadro 6B)', () => {
  test('só num imóvel não habitacional (pela afetação da caderneta), ou já marcado', () => {
    base();
    app.pForm = app.normProp({ id: 'P1', name: 'Loja', afetacao: 'habitacao' });
    assert.doesNotMatch(app.propBody(), /p_lojaHistoria/);
    app.pForm.afetacao = '';
    assert.doesNotMatch(app.propBody(), /p_lojaHistoria/);
    assert.equal(app.__sel.p_afetacao.onchange, 'imvAfetacaoMudou', 'mudar a afetação mostra-a');
    app.pForm.afetacao = 'comercio';
    const html = app.propBody();
    assert.match(html, /<input type="checkbox" role="switch" id="p_lojaHistoria"> Reconhecido como Loja com História \(Lei 42\/2017\)/);
    assert.match(html, /as obras de conservação dos 24 meses antes do arrendamento contam 110 %\. Quadro 6B\./);
    app.pForm.afetacao = 'habitacao'; app.pForm.lojaComHistoria = true;
    assert.match(app.propBody(), /id="p_lojaHistoria" checked>/, 'marcada, fica à vista para se desmarcar');
  });

  test('grava a marca, que o motor lê num contrato não habitacional', () => {
    base();
    const p = guardar({ p_afetacao: 'comercio', p_lojaHistoria: true });
    assert.equal(p.lojaComHistoria, true);
    const c = app.normContract({ id: 'C1', propertyId: p.id, rent: 1200, start: '2024-01-01', fisco: { estado: 'declarado', finalidade: 'nh' } });
    app.db.contracts.push(c);
    assert.deepEqual(JSON.parse(JSON.stringify(app.irsBeneficios(c, 2025).map((b) => b.id))), ['lojaHistoria']);
    assert.match(app.propFicha(p.id), /Loja com História · quadro 6B/);
  });
});
