// Os formulários do imóvel, da hipoteca, das pessoas e das visitas, no que o
// formularios.test.js não vê: os quartos e as quotas-partes do imóvel, a
// hipoteca dentro da ficha do imóvel e a nova (onde o capital em branco é
// recusado), a visita já com contacto e numa casa por quartos, e as pessoas
// com a ficha preenchida. A regra é a de testes/lib/formularios.js: o
// asterisco vermelho nos obrigatórios (os que o guardar recusa vazios), o
// «Opcional» nos outros, e cada exemplo com «Ex: » — nunca uma instrução.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';
import { conferir, EX } from './lib/formularios.js';

const app = carregarApp();
afterEach(() => repor(app));

// uma base com dois proprietários, um inquilino e um imóvel de arrendamento
function base() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Eu' }), app.normPerson({ id: 'O2', name: 'Rui Matos' })];
  app.db.tenants = [app.normPerson({ id: 'I1', name: 'Ana' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1', 'O2'] })];
  return janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
}

/* Os placeholders de um HTML, pela ordem.
   Recebe: html — o corpo de um formulário.
   Devolve: os textos dos placeholder="…". */
const placeholders = (html) => [...html.matchAll(/placeholder="([^"]*)"/g)].map((m) => m[1]);

/* O que o guardar faz a um campo quando o recusa: o elemento do arnês (o
   mesmo que a app recebe do getElementById) passa a anotar as classes, os
   atributos, o que se escreve depois dele e o foco.
   Recebe: id — o id do campo.
   Devolve: {cls, attrs, depois, foco} — as anotações, que crescem à medida. */
function marcasDe(id) {
  const e = app.document.getElementById(id);
  const m = { cls: [], attrs: {}, depois: [], foco: 0 };
  e.classList = { add: (c) => { m.cls.push(c); }, remove() {}, toggle() {}, contains: () => false };
  e.setAttribute = (k, v) => { m.attrs[k] = String(v); };
  e.insertAdjacentElement = (onde, p) => { m.depois.push([onde, p.id, p.className, p.textContent]); };
  e.focus = () => { m.foco++; };
  return m;
}

/* Confere que o erro ficou dito no campo: o contorno (.err), o aria-invalid,
   a frase por baixo (.erro-campo, apontada pelo aria-describedby) e o foco.
   Recebe: m — as anotações de marcasDe; id — o id do campo; msg — a frase.
   Devolve: nada — falha o teste se faltar alguma coisa. */
function erroNoCampo(m, id, msg) {
  assert.ok(m.cls.includes('err'), id + ': sem o contorno vermelho');
  assert.equal(m.attrs['aria-invalid'], 'true', id + ': sem o aria-invalid');
  assert.equal(m.attrs['aria-describedby'], id + '-erro', id + ': o aria-describedby não aponta a frase');
  assert.deepEqual(m.depois, [['afterend', id + '-erro', 'erro-campo', msg]], id + ': a frase por baixo do campo');
  assert.equal(m.foco, 1, id + ': o campo não recebeu o foco');
}

describe('os formulários do imóvel e das pessoas, para lá do básico', () => {
  test('quartos: cada nome tem um exemplo com «Ex: », o título diz que o nome é opcional, e nenhum leva asterisco', () => {
    const abertas = base();
    app.db.properties[0].rentalMode = 'quartos';
    app.db.properties[0].rooms = [{ id: 'R1', name: 'Quarto 1' }, { id: 'R2', name: '' }];
    app.propModal('P1');
    const html = abertas[0].b;
    const cs = conferir('imóvel por quartos', html, { obrigatorios: ['p_name'], exemplos: { p_freguesiaCodigo: true, p_fraction: true, p_floor: true,
      p_registry: true, p_postalCode: true, p_matrix: true, p_licence: true, p_energyCert: true, p_energyClass: true }, deixados: ['p_share_', 'p_room_', 'fn_'] });
    const quartos = cs.filter((c) => c.id.startsWith('p_room_'));
    assert.equal(quartos.length, 2, 'os dois quartos');
    for (const q of quartos) { assert.ok(q.placeholder.startsWith(EX), q.id + ': ' + q.placeholder); assert.ok(!q.obrig, q.id); }
    assert.match(html, /<div class="flabel">Quartos \(nome opcional\)<\/div>/);
    assert.match(html, /id="p_room_R1" value="Quarto 1"/, 'o nome escrito fica no campo');
  });

  test('quotas-partes: um grupo próprio; o exemplo é a parte igual com «Ex: », cada campo diz «(%, opcional)» e a dica diz o que vale em branco', () => {
    const abertas = base();
    app.propModal('P1');
    const html = abertas[0].b;
    assert.match(html, /<div class="sect imv-grupo">\s*<div class="imv-sec-cab"><h3>Proprietários e quota-parte<\/h3><\/div>/);
    assert.match(html, /id="p_share_O1"[^>]*aria-label="Quota de Eu \(%, opcional\)"/);
    assert.match(html, /aria-label="Remover Rui Matos"[^>]*data-click="delPropOwner\('O2'\)"/, 'o remover diz quem remove');
    assert.match(html, /id="p_share_O1"[^>]*placeholder="Ex: 50"/);
    assert.match(html, /id="p_share_O2"[^>]*placeholder="Ex: 50"/);
    assert.match(html, /Partes iguais \(50% cada\)/, 'em branco são partes iguais, e a dica diz quanto');
    // com uma quota escrita, o exemplo do outro é o restante
    app.db.properties[0].ownerShares = { O1: 70 };
    app.propModal('P1');
    assert.match(abertas[1].b, /id="p_share_O2"[^>]*placeholder="Ex: 30"/);
    assert.match(abertas[1].b, /Quem não tem percentagem fica com o restante/);
  });

  test('imóvel com hipotecas: o capital leva o asterisco; o resto da hipoteca diz «Opcional» e as datas não têm placeholder', () => {
    const abertas = base();
    app.db.properties[0].loans = [app.normLoan({ id: 'L1', name: 'Aquisição', type: 'mista', outstanding: 100000, rate: 0 })];
    app.propModal('P1');
    const html = abertas[0].b;
    const cs = conferir('imóvel com hipoteca', html, { obrigatorios: ['p_name', 'l_out_L1'], exemplos: { p_freguesiaCodigo: true, p_fraction: true, p_floor: true,
      p_registry: true, p_postalCode: true, p_matrix: true, p_licence: true, p_energyCert: true, p_energyClass: true }, deixados: ['p_share_', 'p_room_', 'fn_'] });
    for (const id of ['l_name_L1', 'l_bank_L1', 'l_years_L1', 'l_fy_L1', 'l_rate_L1', 'l_eur_L1', 'l_spr_L1', 'l_ffix_L1', 'l_fvar_L1']) {
      assert.equal(cs.find((c) => c.id === id).placeholder, 'Opcional', id);
    }
    assert.match(html, /Capital em dívida \(€\) <span class="req">\*<\/span><input id="l_out_L1"[^>]*placeholder="Ex: 150000"/);
    assert.doesNotMatch(html, /type="date"[^>]*placeholder=/, 'nenhuma data leva placeholder');
    assert.match(html, /Prazo em branco: 30 anos\./, 'o prazo em branco diz quanto vale');
    assert.match(html, /Anos com taxa fixa em branco: 5\./, 'e os anos da fase fixa também, na mista');
  });

  test('hipoteca nova: o capital tem o asterisco porque o guardar o recusa em branco', () => {
    const abertas = base();
    const avisos = [];
    app.toast = (m) => { avisos.push(m); };
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('P1'))));
    const l = app.normLoan({ name: 'Aquisição' });
    app.pForm.loans.push(l);
    app.mortOpen(l.id, true);
    assert.equal(abertas[0].t, 'Nova hipoteca');
    conferir('hipoteca nova', abertas[0].b, { obrigatorios: ['l_out_' + l.id], deixados: ['fn_'] });
    app.collectProp = () => {};
    app.onSave();
    assert.deepEqual(avisos, ['Indica o capital em dívida.'], 'em branco, não guarda');
    assert.equal(app.prop('P1').loans.length, 0, 'e o imóvel fica sem a hipoteca');
  });

  test('pessoas: as instruções saíram dos placeholders — o país diz no rótulo quando se usa, a morada e as notas têm a dica por baixo', () => {
    const abertas = base();
    app.db.tenants[0] = app.normPerson({ id: 'I1', name: 'Ana Rodrigues', phone: '912 345 678', nif: '123456789', pais: '', taxAddress: 'Rua A 1', notes: 'Fiador: o pai' });
    app.personModal('tenant', 'I1');
    const html = abertas[0].b;
    conferir('inquilino preenchido', html, { obrigatorios: ['pe_name'], exemplos: { pe_cc: true, pe_pais: true, pe_addr: true, pe_notes: true }, deixados: ['fn_'] });
    for (const ph of placeholders(html)) assert.ok(ph === 'Opcional' || ph.startsWith(EX), 'placeholder fora da regra: ' + ph);
    assert.match(html, /País \(opcional; só sem NIF português\)<input id="pe_pais"/);
    assert.match(html, /<div class="hint">A morada com rua, número, código postal e localidade\./);
    assert.match(html, /O fiador, as referências, outras observações\./);
    assert.match(html, /id="pe_name" value="Ana Rodrigues"/, 'os valores ficam nos campos');
  });

  test('pessoas: o nome leva o asterisco porque o guardar recusa uma ficha sem nome, e diz o erro no campo', () => {
    const abertas = base();
    const avisos = [];
    app.toast = (m) => { avisos.push(m); };
    app.personModal('owner');
    assert.match(abertas[0].b, /Nome completo <span class="req">\*<\/span>/);
    app.collectPerson = () => {};
    app.perForm.name = '  ';
    const antes = app.db.owners.length;
    const nome = marcasDe('pe_name');
    app.onSave();
    assert.deepEqual(avisos, ['Escreve o nome.']);
    assert.equal(app.db.owners.length, antes, 'não grava');
    erroNoCampo(nome, 'pe_name', 'Escreve o nome.');
  });

  test('visita com contacto preenchido, numa casa por quartos: o imóvel leva o asterisco, o quarto não; o contacto diz o que é no rótulo', () => {
    const abertas = base();
    const p = app.db.properties[0];
    p.rentalMode = 'quartos'; p.rooms = [{ id: 'R1', name: 'Quarto da varanda' }];
    app.db.visits = [app.normVisit({ id: 'V1', propertyId: 'P1', roomId: 'R1', nomes: 'Rui e Sara', contacto: 'rui@exemplo.pt', date: '2026-10-05', notas: 'Gostaram.' })];
    app.visitModal('V1');
    const html = abertas[0].b;
    conferir('visita preenchida', html, { obrigatorios: ['vi_nomes', 'vi_date'], exemplos: { vi_contacto: true, vi_notas: true } });
    assert.match(html, /Telemóvel ou email \(opcional\)<input id="vi_contacto" value="rui@exemplo.pt" placeholder="Ex: 912 345 678"/);
    assert.match(html, /<label>Imóvel <span class="req">\*<\/span><div class="sel" id="sel_vi_prop">/);
    assert.match(html, /<label>Quarto<div class="sel" id="sel_vi_room">/, 'o quarto não é obrigatório: «Casa inteira» é uma escolha');
    assert.match(html, /As primeiras impressões, as perguntas que fizeram, o que ficou combinado\./, 'a instrução passou para a dica');
    for (const ph of placeholders(html)) assert.ok(ph.startsWith(EX), 'placeholder fora da regra: ' + ph);
  });

  test('visita: o imóvel, quem vem e a data são os obrigatórios — o guardar recusa cada um em branco (e o fim antes do início), e diz o erro no campo', () => {
    const abertas = base();
    const avisos = [];
    app.toast = (m) => { avisos.push(m); };
    app.motivoRecusa = () => '';
    app.visitModal();
    assert.equal(abertas.length, 1);
    app.visColhe = () => {};
    const tenta = (o) => { Object.assign(app.visForm, { nomes: 'Rui', propertyId: 'P1', date: '2026-10-05' }, o); app.onSave(); };
    /* cada recusa diz-se no seu campo; o imóvel, no botão do menu da casa
       (o input escondido do sel() não se vê nem toma o foco) */
    const m = { vi_nomes: marcasDe('vi_nomes'), selb_vi_prop: marcasDe('selb_vi_prop'), vi_prop: marcasDe('vi_prop'), vi_date: marcasDe('vi_date'), vi_end: marcasDe('vi_end') };
    tenta({ nomes: '' }); tenta({ propertyId: '' }); tenta({ date: '' }); tenta({ start: '11:00', end: '10:30' });
    assert.deepEqual(avisos, ['Escreve quem vem à visita.', 'Escolhe o imóvel.', 'Escolhe a data.', 'A hora de fim é antes da de início.']);
    assert.equal((app.db.visits || []).length, 0, 'nenhuma ficou gravada');
    erroNoCampo(m.vi_nomes, 'vi_nomes', 'Escreve quem vem à visita.');
    erroNoCampo(m.selb_vi_prop, 'selb_vi_prop', 'Escolhe o imóvel.');
    assert.deepEqual(m.vi_prop.cls, [], 'o input escondido não leva o erro');
    erroNoCampo(m.vi_date, 'vi_date', 'Escolhe a data.');
    erroNoCampo(m.vi_end, 'vi_end', 'A hora de fim é antes da de início.');
  });
});
