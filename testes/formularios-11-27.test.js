// Os formulários falam a mesma língua: uma escolha de sim/não numa janela é
// sempre o interruptor (KAN-172), e as caixas que ficam são as das listas de
// seleção, a marca das tarefas e os termos da entrada; o código da freguesia
// preenche o distrito, o concelho e a freguesia dos Dados registais, sem
// nunca trocar o que a pessoa escreveu (KAN-173); e a parte da casa de um
// imóvel por quartos é a de cada quarto, com a soma até 100 (KAN-152).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarTudo, limpar, repor, igual, elementos } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');

const app = carregarTudo({ hoje: '2026-11-27' });
const el = elementos(app);
afterEach(() => repor(app));

/* Sem nuvem: um dono, as janelas numa pilha observável e os avisos guardados.
   Devolve: {abertas, avisos}. */
function local() {
  limpar(app);
  app.CW.user = null;
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana' })];
  const abertas = janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save', 'syncPropRecs', 'syncAllLoanRecs');
  const avisos = [];
  app.toast = (m) => { avisos.push(m); };
  app.crescerEmAltura = (q, f) => f();
  return { abertas, avisos };
}

/* Um imóvel na base (da Ana, de arrendamento por omissão).
   Recebe: o — os campos a juntar.
   Devolve: o imóvel. */
function casa(o) {
  const p = app.normProp(Object.assign({ id: 'P1', name: 'T2 Arroios', ownerIds: ['O1'] }, o || {}));
  app.db.properties.push(p);
  return p;
}

/* Abre o formulário (de um imóvel novo, ou de um que existe), escreve nos
   campos e guarda.
   Recebe: v — {id do campo: valor}; id (opcional) — o imóvel a editar.
   Devolve: o imóvel gravado (o editado, ou o último da base). */
function guardar(v, id) {
  app.propModal(id);
  for (const [k, x] of Object.entries(Object.assign({ p_name: 'Casa' }, v))) { if (typeof x === 'boolean') el[k].checked = x; else el[k].value = x; }
  app.onSave();
  return id ? app.prop(id) : app.db.properties[app.db.properties.length - 1];
}

/* As caixas de marcar de um pedaço de HTML: a etiqueta de cada uma.
   Recebe: h — o HTML.
   Devolve: array de textos «<input type="checkbox" …>». */
const caixas = (h) => [...String(h).matchAll(/<input type="checkbox"[^>]*>/g)].map((m) => m[0]);

describe('KAN-172 · uma escolha de sim/não numa janela é o interruptor', () => {
  /* as caixas que não são escolhas de sim/não: escolher vários itens de uma
     lista, a marca de uma tarefa numa lista e os termos da entrada */
  const LISTAS = /colab-casa|id="(?:inv_all|invc_|key_all|keyc_|sw_nd_|tfc_|cwa_terms|cw_lig_h_|cwg_h_|cw_sh_)/;

  test('no código todo, cada input type=checkbox é um interruptor (role=switch) ou uma das caixas das listas', () => {
    const pastas = ['web/app', 'web/cloud'];
    const soltas = [];
    for (const d of pastas) {
      for (const f of fs.readdirSync(path.join(RAIZ, d)).filter((x) => x.endsWith('.js'))) {
        const src = ler(d + '/' + f);
        for (const m of src.matchAll(/type="checkbox"/g)) {
          const janela = src.slice(Math.max(0, m.index - 80), m.index + 160);
          if (/^type="checkbox" role="switch"/.test(src.slice(m.index))) continue;
          if (LISTAS.test(janela)) continue;
          soltas.push(d + '/' + f + ': ' + src.slice(m.index, m.index + 80).replace(/\s+/g, ' '));
        }
      }
    }
    assert.deepEqual(soltas, [], 'caixas de visto que deviam ser interruptores');
  });

  test('o formulário do imóvel com todas as escolhas à vista: só interruptores', () => {
    local();
    app._imvForaPT = null;
    app.pForm = app.normProp({ id: 'P9', name: 'Loja', ownerIds: ['O1'], freguesiaCodigo: '110659', matrix: '4651', afetacao: 'comercio',
      reabilitacao: { tipo: 'aru', inicio: '2020-01-01', conclusao: '2021-01-01' }, loans: [{ id: 'L1', name: 'Aquisição', outstanding: 1000 }] });
    app.imvForaIniciar('p', app.pForm.comproprietariosFora);
    const cs = caixas(app.propBody());
    const ids = cs.map((c) => (c.match(/id="([^"]+)"/) || [])[1]);
    for (const id of ['p_foraPT', 'p_sub_ativo', 'p_matrizConfirmada', 'p_reabCertificado', 'p_lojaHistoria', 'l_stamp_L1', 'l_autorec_L1']) assert.ok(ids.includes(id), id + ' no formulário');
    for (const c of cs) assert.match(c, /^<input type="checkbox" role="switch" /, c);
  });

  test('a tarefa («Cumprida») e o cargo (Ver, Adicionar, Editar) também', () => {
    const { abertas } = local();
    casa();
    app.tfAbrir('imovel', 'P1');
    app.tfRascunho.itens.push({ id: 'T1', nome: 'Trocar o esquentador', seccao: '', feita: false, notas: '' });
    app.tfEditarTarefa('T1');
    const tarefa = abertas.at(-1).b;
    assert.match(tarefa, /<label class="check"><input type="checkbox" role="switch" id="tf_feita" > Cumprida<\/label>/);
    app.CW.user = { id: 'U1' };
    app.CW.state = { roles: [] };
    app.CW.cargoModal();
    const cargo = caixas(abertas.at(-1).b);
    assert.ok(cargo.length >= 10, 'as permissões do cargo');
    for (const c of cargo) assert.match(c, /^<input type="checkbox" role="switch" data-perm="/, c);
  });

  test('a marca das tarefas na lista e as listas de seleção continuam caixas', () => {
    assert.match(ler('web/app/tarefas.js'), /<label class="tf-marca"><input type="checkbox" id="tfc_/);
    assert.match(ler('web/cloud/grupos.js'), /<input type="checkbox" id="cwg_h_/);
    assert.match(ler('web/cloud/entrada.js'), /'<input type="checkbox" id="cwa_terms">'/);
  });

  test('o CSS desenha o input como o .interruptor: 46×28, os mesmos fundos, o botão num gradiente, o contorno da cor do estado (a frente que o escuro forçado não apaga), a transição da casa, e a linha que se toca inteira', () => {
    const css = ler('web/estilos.css');
    const i = css.indexOf('/* === kanban-11-27 formularios:');
    const j = css.indexOf('/* === fim: kanban-11-27 formularios === */');
    assert.ok(i > -1 && j > i, 'o bloco da folha');
    const b = css.slice(i, j);
    const sw = b.match(/input\[type=checkbox\]\[role=switch\]:not\(\.ct-sw\)\{([^}]*)\}/);
    assert.ok(sw, 'a regra do interruptor');
    for (const d of ['appearance:none', '-webkit-appearance:none', 'width:46px', 'height:28px', 'border-radius:999px', 'var(--line2)', 'radial-gradient(', 'var(--card)',
      'border:2px solid var(--line2)', 'box-sizing:border-box', '22px no-repeat border-box,',
      'transition:background-color var(--rapido) var(--curva),background-position var(--rapido) var(--curva),border-color var(--rapido) var(--curva)']) assert.ok(sw[1].includes(d), d);
    assert.match(b, /input\[type=checkbox\]\[role=switch\]:not\(\.ct-sw\):checked\{background-color:var\(--accent\);border-color:var\(--accent\);background-position:21px 3px,21px 4px\}/);
    assert.match(b, /input\[type=checkbox\]\[role=switch\]:not\(\.ct-sw\):focus-visible\{outline:2px solid var\(--accent\)/);
    assert.match(b, /label\.check:has\(>input\[type=checkbox\]\[role=switch\]\)\{justify-content:space-between;gap:12px;min-height:44px/);
    assert.match(sw[1], /order:2/, 'o interruptor à direita do texto');
    // os valores do .interruptor da casa, que este copia
    assert.match(css, /\.interruptor\{position:relative;flex:0 0 46px;width:46px;height:28px;[^}]*background:var\(--line2\)/);
    assert.match(css, /\.interruptor\[aria-checked="true"\]\{background:var\(--accent\)\}/);
  });
});

describe('KAN-173 · o código da freguesia preenche os dados registais', () => {
  test('o lugar de um código: o distrito e o concelho pelo código, e a freguesia quando a app tem o nome', () => {
    igual(app.freguesiaLugar('110659'), { codigo: '110659', distrito: 'Lisboa', concelho: 'Lisboa', freguesia: '' });
    igual(app.freguesiaLugar(' 010612 '), { codigo: '010612', distrito: 'Aveiro', concelho: 'Castelo de Paiva', freguesia: 'Bairros' });
    igual(app.freguesiaLugar('0302fe'), { codigo: '0302FE', distrito: 'Braga', concelho: 'Barcelos', freguesia: app.freguesiaLugar('0302FE').freguesia });
    assert.equal(app.freguesiaLugar('131201').concelho, 'Porto');
    assert.equal(app.freguesiaLugar('131801').concelho, 'Trofa');
    assert.equal(app.freguesiaLugar('031401').concelho, 'Vizela');
    assert.equal(app.freguesiaLugar('111601').concelho, 'Odivelas');
    igual(app.freguesiaLugar('310301'), { codigo: '310301', distrito: 'Região Autónoma da Madeira', concelho: 'Funchal', freguesia: '' });
    igual(app.freguesiaLugar('420301'), { codigo: '420301', distrito: 'Região Autónoma dos Açores', concelho: 'Ponta Delgada', freguesia: '' });
    for (const lixo of ['', '11065', '1106599', '991201', '112001', 'AB1234', null, undefined, {}, true]) assert.equal(app.freguesiaLugar(lixo), null, JSON.stringify(lixo));
  });

  test('os 308 concelhos e os 20 distritos e regiões, e todos os códigos da tabela da AT de 2025 caem num concelho', () => {
    assert.equal(Object.keys(app.FREG_CONCELHOS).length, 308);
    assert.equal(new Set(Object.values(app.FREG_DISTRITOS)).size, 20);
    const sem = [];
    for (const [u, , reps] of app.IRS_FREGUESIAS_2025) for (const c of [u, ...reps.map((r) => r[0])]) if (!app.freguesiaLugar(c)) sem.push(c);
    assert.deepEqual(sem, []);
    // as freguesias repostas: o nome é o da tabela
    for (const [, , reps] of app.IRS_FREGUESIAS_2025) for (const [c, n] of reps) assert.equal(app.freguesiaLugar(c).freguesia, n, c);
    // uma união extinta não dá freguesia (a união já não existe)
    assert.equal(app.freguesiaLugar('010121').freguesia, '');
    assert.equal(app.freguesiaLugar('010121').concelho, 'Águeda');
  });

  test('escrever 110659 preenche o distrito e o concelho; uma reposta escreve a freguesia; o que a pessoa escreveu fica', () => {
    local();
    app.propModal();
    el.p_freguesiaCodigo.value = '110659';
    app.imvMatrizEscrito();
    assert.equal(el.p_distrito.value, 'Lisboa');
    assert.equal(el.p_concelho.value, 'Lisboa');
    assert.equal(el.p_freguesia.value, '');
    assert.match(el.imv_lugar.innerHTML, /Concelho Lisboa · distrito Lisboa\. Preenchido nos Dados registais\./);
    assert.match(el.imv_lugarNota.innerHTML, /Preenchido pelo código da freguesia\./);
    el.p_freguesiaCodigo.value = '010612';
    app.imvMatrizEscrito();
    assert.deepEqual([el.p_distrito.value, el.p_concelho.value, el.p_freguesia.value], ['Aveiro', 'Castelo de Paiva', 'Bairros'], 'o que era do código muda com ele');
    assert.match(el.imv_lugar.innerHTML, /Freguesia Bairros · concelho Castelo de Paiva · distrito Aveiro\./);
    el.p_concelho.value = 'O meu concelho';
    el.p_freguesiaCodigo.value = '110659';
    app.imvMatrizEscrito();
    assert.equal(el.p_concelho.value, 'O meu concelho', 'nunca por cima do que a pessoa escreveu');
    assert.equal(el.p_distrito.value, 'Lisboa');
    assert.equal(el.p_freguesia.value, '', 'a Bairros era do código e saiu com ele');
  });

  test('um código por acabar não mexe; um concelho que não existe diz para confirmar na caderneta; fora de Portugal, nada', () => {
    local();
    app.propModal();
    el.p_distrito.value = 'Coimbra';
    el.p_freguesiaCodigo.value = '1106';
    app.imvMatrizEscrito();
    assert.equal(el.p_distrito.value, 'Coimbra');
    el.p_freguesiaCodigo.value = '992201';
    app.imvMatrizEscrito();
    assert.equal(el.p_distrito.value, 'Coimbra');
    assert.match(el.imv_lugar.innerHTML, /não são de nenhum concelho: confirma o código na caderneta/);
    app.pForm.pais = 'Espanha';
    assert.equal(app.imvLugarHtml(Object.assign({}, app.pForm, { freguesiaCodigo: '110659' })), '');
  });

  test('o que o código guardado preencheu continua a ser dele ao editar; o código de uma união extinta continua com o aviso', () => {
    local();
    casa({ freguesiaCodigo: '010612', distrito: 'Aveiro', concelho: 'Castelo de Paiva', freguesia: 'Bairros' });
    app.propModal('P1');
    el.p_distrito.value = 'Aveiro'; el.p_concelho.value = 'Castelo de Paiva'; el.p_freguesia.value = 'Bairros';
    el.p_freguesiaCodigo.value = '010121';
    app.imvMatrizEscrito();
    assert.deepEqual([el.p_distrito.value, el.p_concelho.value, el.p_freguesia.value], ['Aveiro', 'Águeda', '']);
    assert.match(el.imv_matriz.innerHTML, /imv-nota-aviso/);
    assert.match(el.imv_matriz.innerHTML, /desagregada em outubro de 2025/);
  });

  test('o grupo do Anexo F e a dobra dos dados registais têm o lugar das duas linhas', () => {
    local();
    app._imvForaPT = null;
    app.pForm = app.normProp({ id: 'N1', name: 'Novo', freguesiaCodigo: '010612', distrito: 'Aveiro' });
    app.imvForaIniciar('p', app.pForm.comproprietariosFora);
    const h = app.propBody();
    assert.match(h, /<div id="imv_lugar" class="imv-lugar"><div class="hint imv-colado">Freguesia Bairros · concelho Castelo de Paiva · distrito Aveiro\. Preenchido nos Dados registais\.<\/div><\/div>/);
    assert.match(h, /<div id="imv_lugarNota" class="imv-lugar"><div class="hint imv-colado">Preenchido pelo código da freguesia\.<\/div><\/div>/);
    for (const id of ['p_freguesia', 'p_concelho', 'p_distrito']) assert.match(h, new RegExp('id="' + id + '"[^>]*data-input="imvLugarPintar\\(\\)"'), id);
  });

  test('a gravação leva o que o código preencheu', () => {
    local();
    app.propModal();
    el.p_freguesiaCodigo.value = '010612';
    app.imvMatrizEscrito();
    const p = guardar({ p_name: 'Casa de Bairros', p_freguesiaCodigo: '010612', p_distrito: el.p_distrito.value, p_concelho: el.p_concelho.value, p_freguesia: el.p_freguesia.value });
    assert.deepEqual([p.distrito, p.concelho, p.freguesia, p.freguesiaCodigo], ['Aveiro', 'Castelo de Paiva', 'Bairros', '010612']);
  });
});

describe('KAN-152 · a parte da casa é a de cada quarto', () => {
  test('cada quarto tem o seu campo, com o «?» e a soma por baixo', () => {
    local();
    app._imvForaPT = null;
    app.pForm = app.normProp({ id: 'Q1', name: 'T3', rentalMode: 'quartos', rooms: [{ id: 'r1', name: 'Quarto 1', parte: 18 }, { id: 'r2', name: 'Quarto 2' }] });
    app.imvForaIniciar('p', app.pForm.comproprietariosFora);
    const h = app.propBody();
    assert.match(h, /<span class="imv-pct"><input id="p_room_parte_r1" type="text" inputmode="decimal" value="18" placeholder="Opcional" aria-label="Parte da casa de Quarto 1 \(%, opcional\)" data-input="imvPartesEscritas\(\)" autocomplete="off"><span aria-hidden="true">%<\/span><\/span>/);
    assert.match(h, /id="p_room_parte_r2" type="text" inputmode="decimal" value=""/);
    assert.match(h, /<span class="imv-quartos-parte">Parte da casa<button type="button" class="imv-ajuda" data-toca="camada" data-click="imvExplicarParte\(\)" aria-label="Explicar: Parte da casa de cada quarto" aria-haspopup="dialog">/);
    assert.match(h, /<div id="imv_partesSoma" class="imv-lugar" aria-live="polite"><div class="hint">Os quartos somam 18 % da casa\.<\/div><\/div>/);
    assert.doesNotMatch(h, /p_parteArrendada/);
  });

  test('o «?» explica a regra da área e a omissão', () => {
    const { abertas } = local();
    app.imvExplicarParte();
    const j = abertas.at(-1);
    assert.equal(j.t, 'Parte da casa de cada quarto');
    assert.match(j.b, /a área dele com a sua parte das zonas comuns/);
    assert.match(j.b, /CIRS art\. 41\.º n\.º 4/);
    assert.match(j.b, /os quartos sem parte dividem em partes iguais o que sobra até 100 %/);
  });

  test('grava as partes; recusa uma fora de (0, 100] e a soma acima de 100, junto do campo; em branco fica null', () => {
    const { avisos } = local();
    casa({ rentalMode: 'quartos', rooms: [{ id: 'r1', name: 'Quarto 1' }, { id: 'r2', name: 'Quarto 2' }] });
    let p = guardar({ p_name: 'T2 Arroios', p_room_parte_r1: '30', p_room_parte_r2: '25,5' }, 'P1');
    igual(p.rooms.map((r) => r.parte), [30, 25.5]);
    assert.equal('parteArrendada' in p, false);
    app.modalStack.length = 0;
    guardar({ p_name: 'T2 Arroios', p_room_parte_r1: '60', p_room_parte_r2: '50' }, 'P1');
    assert.equal(avisos.at(-1), 'Os quartos somam 110 % da casa: a soma das partes não pode passar de 100 %.');
    igual(app.prop('P1').rooms.map((r) => r.parte), [30, 25.5], 'nada gravado');
    app.modalStack.length = 0;
    guardar({ p_name: 'T2 Arroios', p_room_parte_r1: '150', p_room_parte_r2: '' }, 'P1');
    assert.equal(avisos.at(-1), 'A parte de um quarto é uma percentagem acima de 0 e até 100.');
    app.modalStack.length = 0;
    p = guardar({ p_name: 'T2 Arroios', p_room_parte_r1: '', p_room_parte_r2: '100' }, 'P1');
    igual(p.rooms.map((r) => r.parte), [null, 100]);
  });

  test('o erro vai para o campo: o do quarto que falha, ou o último escrito na soma', () => {
    const q = (rooms) => app.imvPartesErro(app.normProp({ use: 'investimento', rentalMode: 'quartos', rooms }));
    assert.equal(q([{ id: 'a', parte: 40 }, { id: 'b', parte: 60 }]), null, '100 cabe');
    igual(q([{ id: 'a', parte: 70 }, { id: 'b' }, { id: 'c', parte: 31 }]).campo, 'p_room_parte_c');
    const pf = app.normProp({ use: 'investimento', rentalMode: 'quartos', rooms: [{ id: 'a' }] });
    pf.rooms[0].parte = 'abc';
    igual(app.imvPartesErro(pf).campo, 'p_room_parte_a');
    assert.equal(app.imvPartesErro(app.normProp({ rentalMode: 'inteiro', rooms: [{ id: 'a', parte: 99 }, { id: 'b', parte: 99 }] })), null, 'num imóvel inteiro não se pergunta');
  });

  test('a ficha diz a parte de cada quarto', () => {
    local();
    casa({ rentalMode: 'quartos', rooms: [{ id: 'r1', name: 'Quarto da varanda', parte: 18 }, { id: 'r2', name: 'Quarto 2' }] });
    const f = app.propFicha('P1');
    assert.match(f, /Quarto da varanda<\/b><span class="small">Sem contrato · 18 % da casa<\/span>/);
    assert.match(f, /Quarto 2<\/b><span class="small">Sem contrato<\/span>/);
  });

  test('os dados: a parte de cada quarto normaliza-se, e o campo único da casa não sobrevive', () => {
    const p = app.normProp({ parteArrendada: 40, rooms: [{ id: 'r1', name: 'A', parte: 18.004 }, { id: 'r2', name: 'B', parte: 0 }, 'C'] });
    assert.equal('parteArrendada' in p, false);
    igual(p.rooms.map((r) => r.parte), [18, null, null]);
  });
});
