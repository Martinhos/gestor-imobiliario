// A lista de tarefas de um imóvel ou de um contrato (web/app/tarefas.js):
// vive dentro do registo, arruma-se em secções, cada tarefa está cumprida ou
// por cumprir, e a janela pesquisa pelo nome da tarefa e da secção e filtra
// pela secção e pelo estado. A janela muda um rascunho, que só o Guardar dela
// leva ao registo; quem não pode alterar o registo não altera a lista. O
// rascunho com alterações fica no aparelho (por conta e por registo) até ao
// Guardar, e volta fundido com o que o registo tem agora (KAN-105).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { carregarApp, limpar, repor, elementos, igual } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';
import { conferir, EX } from './lib/formularios.js';

const HOJE = '2026-10-14';
const app = carregarApp({ hoje: HOJE });
afterEach(() => repor(app));
// a fusão a três do cliente (o bloco <fusao> do cloud/nucleo.js), que no
// browser já está carregada quando a janela das tarefas abre
const NUCLEO = fs.readFileSync(new URL('../web/cloud/nucleo.js', import.meta.url), 'utf8');
vm.runInContext(NUCLEO.slice(NUCLEO.indexOf('// <fusao>'), NUCLEO.indexOf('// </fusao>')), app.__ctx);

/* Uma base com um imóvel de arrendamento e um contrato nele; as janelas numa
   pilha observável e os toasts guardados.
   Devolve: {abertas, toasts}. */
function base() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Eu' })];
  app.db.tenants = [app.normPerson({ id: 'I1', name: 'Ana' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'] })];
  app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', rent: 600, tenantIds: ['I1'], start: '2026-01-01' })];
  const abertas = janelasFalsas(app, 'render', 'buildNav', 'save', 'paintThumbs', 'setModal');
  const toasts = [];
  app.toast = (m, op) => { toasts.push({ m, op }); };
  return { abertas, toasts };
}

/* Uma lista já arrumada: duas secções e três tarefas, uma delas solta.
   Devolve: as tarefas em bruto. */
const LISTA = () => ({
  seccoes: [{ id: 'S1', nome: 'Obras' }, { id: 'S2', nome: 'Documentos' }],
  itens: [
    { id: 'K1', nome: 'Pintar a sala', seccao: 'S1', feita: false },
    { id: 'K2', nome: 'Trocar o esquentador', seccao: 'S1', feita: true, feitaEm: '2026-10-01' },
    { id: 'K3', nome: 'Pedir o certificado energético', seccao: 'S2', feita: false },
    { id: 'K4', nome: 'Ligar à Ana', seccao: '', feita: false },
  ],
});

/* Os nomes das tarefas que a lista da janela mostra, pela ordem.
   Devolve: array de nomes. */
const nomesNaLista = () => [...app.tfLista().matchAll(/<span class="tf-nome"><span>([^<]*)<\/span>|class="tf-nome"[^>]*><span>([^<]*)<\/span>/g)]
  .map((m) => m[1] || m[2]);

describe('os dados', () => {
  test('o normTarefas arruma o que vier: secção desconhecida fica solta, o dia só numa cumprida, lixo vira lista vazia', () => {
    const t = app.normTarefas({
      seccoes: [{ id: 'S1', nome: ' Obras ' }, null],
      itens: [{ id: 'K1', nome: 'A', seccao: 'S9', feita: false, feitaEm: '2026-01-01' },
        { id: 'K2', nome: 'B', seccao: 'S1', feita: true, feitaEm: '2026-02-03' }, 'lixo'],
    });
    igual(t, {
      seccoes: [{ id: 'S1', nome: 'Obras', pai: '' }],
      itens: [{ id: 'K1', nome: 'A', seccao: '', feita: false, feitaEm: '', notas: '' },
        { id: 'K2', nome: 'B', seccao: 'S1', feita: true, feitaEm: '2026-02-03', notas: '' }],
    });
    igual(app.normTarefas('x'), { seccoes: [], itens: [] });
    igual(app.normTarefas([1, 2]), { seccoes: [], itens: [] });
  });

  test('o imóvel e o contrato guardam as tarefas, e um registo antigo nasce com a lista vazia', () => {
    const p = app.normProp({ id: 'P1', name: 'X', tarefas: LISTA() });
    assert.equal(p.tarefas.itens.length, 4);
    assert.equal(app.normContract({ id: 'C1', tarefas: LISTA() }).tarefas.seccoes.length, 2);
    igual(app.normProp({ id: 'P2', name: 'Y' }).tarefas, { seccoes: [], itens: [] });
    igual(app.normProp(JSON.parse(JSON.stringify(p))).tarefas, JSON.parse(JSON.stringify(p.tarefas)), 'ida e volta sem perdas');
  });
});

describe('a ficha', () => {
  test('sem tarefas, a ficha oferece adicioná-las; com tarefas, diz quantas faltam e abre a lista', () => {
    base();
    const vazia = app.propFicha('P1');
    assert.match(vazia, /<h3>Tarefas<\/h3><span class="small num">Ainda não há tarefas\.<\/span>/);
    assert.match(vazia, /data-click="tfAbrir\('imovel','P1'\);tfNovaTarefa\(''\)"[^>]*>.*Adicionar tarefa/);
    assert.doesNotMatch(vazia, /Ver tarefas|Ver todas/, 'sem tarefas não há lista para ver');
    app.db.contracts[0].tarefas = app.normTarefas(LISTA());
    assert.match(app.ctFicha('C1'), /3 por cumprir · 1 cumprida[\s\S]*tfAbrir\('contrato','C1'\)[\s\S]*Ver tarefas/);
  });

  test('a ficha do imóvel mostra as primeiras por cumprir e, se couberem, as cumpridas mais recentes, e cada linha abre a lista', () => {
    base();
    const t = LISTA();
    t.itens.push({ id: 'K5', nome: 'Pintar o quarto', seccao: '', feita: false }, { id: 'K6', nome: 'Rever o contador', seccao: '', feita: false });
    app.db.properties[0].tarefas = app.normTarefas(t);
    const f = app.propFicha('P1');
    assert.match(f, /<h3>Tarefas<\/h3><span class="small num">5 por cumprir · 1 cumprida<\/span>/);
    const nomes = [...f.matchAll(/<span class="tf-fl-nome"><span class="imv-so-leitor">([^<]*)<\/span>([^<]*)<\/span>/g)].map((m) => m[1] + m[2]);
    igual(nomes, ['Por cumprir: Pintar a sala', 'Por cumprir: Pedir o certificado energético', 'Por cumprir: Ligar à Ana', 'Por cumprir: Pintar o quarto'],
      'quatro por cumprir, pela ordem da lista; a cumprida não cabe');
    assert.match(f, /<span class="badge grey">Obras<\/span>/, 'a secção de cada uma');
    assert.match(f, /Ver todas/, 'há mais do que as que se veem');
    assert.equal((f.match(/class="imv-linha tap tf-fl[^"]*" data-toca="camada" data-click="tfAbrir\('imovel','P1'\)"/g) || []).length, 4, 'cada linha abre a lista');
    // com poucas por cumprir, entram as cumpridas mais recentes, riscadas
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    const g = app.propFicha('P1');
    assert.match(g, /tf-fl tf-feita[\s\S]*?Cumprida: <\/span>Trocar o esquentador<\/span>\s*<span class="small num">01\/10<\/span>/);
    assert.match(g, /Ver tarefas/);
  });

  test('a ficha não tem campos: a lista abre-se numa janela à parte', () => {
    base();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    assert.doesNotMatch(app.propFicha('P1'), /<input/);
  });
});

describe('a janela da lista', () => {
  test('abre com o nome do registo, as tarefas soltas primeiro e as secções pela ordem', () => {
    const { abertas } = base();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    assert.equal(abertas[0].t, 'Tarefas · T2 Lisboa');
    igual(nomesNaLista(), ['Ligar à Ana', 'Pintar a sala', 'Trocar o esquentador', 'Pedir o certificado energético']);
    assert.match(abertas[0].b, /type="search"/);
    // o rodapé é o dos formulários (Fechar e Guardar); o «Adicionar tarefa»
    // vive no topo do corpo, preso enquanto a lista rola
    assert.match(abertas[0].f, /^<button type="button" class="btn" id="tf_fechar" data-toca="camada" data-click="tfFechar\(\)">Fechar<\/button><button type="button" class="btn primary" data-toca="dados" data-click="tfGuardar\(\)">Guardar<\/button>$/);
    assert.doesNotMatch(abertas[0].f, /Nova tarefa|tfNovaTarefa/);
    assert.match(abertas[0].b, /^<div class="tf-barra"><button type="button" class="btn ghost tf-nova" id="tf_nova" data-toca="camada" data-click="tfNovaTarefa\(''\)">(?:<svg[\s\S]*?<\/svg>)? Adicionar tarefa<\/button><\/div>/);
    assert.match(abertas[0].m, /Adicionar secção/);
    // o limpar da pesquisa é um ícone de traço, e não o carácter «✕»
    const limparQ = /<button type="button" class="qclear[^"]*"[^>]*aria-label="Limpar a pesquisa">([\s\S]*?)<\/button>/.exec(abertas[0].b);
    assert.ok(limparQ, 'há o botão de limpar a pesquisa');
    assert.match(limparQ[1], /^<svg/);
    assert.doesNotMatch(limparQ[1], /✕/);
  });

  test('pesquisa pelo nome da tarefa, sem olhar a acentos nem maiúsculas', () => {
    base();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    app.tfPesquisar('ENERGETICO');
    igual(nomesNaLista(), ['Pedir o certificado energético']);
  });

  test('pesquisa pelo nome da secção: aparecem as tarefas dela', () => {
    base();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    app.tfPesquisar('obras');
    igual(nomesNaLista(), ['Pintar a sala', 'Trocar o esquentador']);
  });

  test('filtra pela secção, pelas soltas e pelo estado, e os filtros somam-se à pesquisa', () => {
    base();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    const el = elementos(app);
    el.tf_fsec.value = 'S1'; el.tf_fest.value = '';
    app.tfFiltrar();
    igual(nomesNaLista(), ['Pintar a sala', 'Trocar o esquentador']);
    el.tf_fest.value = 'feitas';
    app.tfFiltrar();
    igual(nomesNaLista(), ['Trocar o esquentador']);
    el.tf_fsec.value = ''; el.tf_fest.value = 'por';
    app.tfFiltrar();
    igual(nomesNaLista(), ['Ligar à Ana', 'Pintar a sala', 'Pedir o certificado energético']);
    el.tf_fsec.value = '__sem__';
    app.tfFiltrar();
    igual(nomesNaLista(), ['Ligar à Ana']);
    el.tf_fsec.value = ''; el.tf_fest.value = 'por';
    app.tfFiltrar();
    app.tfPesquisar('sala');
    igual(nomesNaLista(), ['Pintar a sala']);
    app.tfPesquisar('esquentador');
    assert.match(app.tfLista(), /Nenhuma tarefa corresponde/, 'cumprida e filtrada por «Por cumprir»');
  });

  test('o filtro das secções só oferece «Sem secção» quando há tarefas soltas e secções', () => {
    base();
    const opcoes = (t) => JSON.parse(JSON.stringify(app.tfOpcoesDeSeccao(app.normTarefas(t)))).map((o) => o.label);
    assert.deepEqual(opcoes(LISTA()), ['Todas as secções', 'Obras', 'Documentos', 'Sem secção']);
    const semSoltas = LISTA(); semSoltas.itens = semSoltas.itens.filter((x) => x.seccao);
    assert.deepEqual(opcoes(semSoltas), ['Todas as secções', 'Obras', 'Documentos']);
  });
});

describe('o rascunho e o Guardar', () => {
  test('marcar uma tarefa muda o rascunho, com o dia; desmarcar tira o dia; o Guardar leva-o ao registo', () => {
    base();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    const k1 = () => app.tfRascunho.itens.find((x) => x.id === 'K1');
    const gravada = () => app.db.properties[0].tarefas.itens.find((x) => x.id === 'K1');
    app.tfMarcar('K1', true);
    assert.equal(k1().feita, true);
    assert.equal(k1().feitaEm, HOJE);
    assert.equal(gravada().feita, false, 'o registo ainda não mudou');
    app.tfMarcar('K1', false);
    assert.equal(k1().feita, false);
    assert.equal(k1().feitaEm, '');
    app.tfMarcar('K1', true);
    app.tfGuardar();
    assert.equal(gravada().feita, true);
    assert.equal(gravada().feitaEm, HOJE);
  });

  test('o formulário de uma tarefa nova segue a regra dos formulários, e «Adicionar» põe-na no rascunho, na secção escolhida', () => {
    const { abertas, toasts } = base();
    app.db.contracts[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('contrato', 'C1');
    app.tfNovaTarefa('S2');
    const form = abertas[1];
    assert.equal(form.t, 'Nova tarefa');
    conferir('tarefa', form.b, { obrigatorios: ['tf_nome'], exemplos: { tf_nome: EX + 'Trocar o esquentador' } });
    assert.match(form.b, /Tarefa <span class="req">\*<\/span>/);
    // o botão diz o que faz: leva a tarefa à lista da janela, e não grava
    assert.match(form.f, /<button type="button" class="btn primary" data-toca="rascunho" data-click="onSave&&onSave\(\)">Adicionar<\/button>$/);
    const el = elementos(app);
    el.tf_nome.value = '   ';
    app.tfGuardarTarefa();
    assert.equal(app.tfRascunho.itens.length, 4, 'sem nome não entra');
    assert.equal(toasts.pop().m, 'Escreve a tarefa.');
    el.tf_nome.value = ' Entregar a caderneta ';
    el.tf_sec.value = 'S2';
    app.tfGuardarTarefa();
    const nova = app.tfRascunho.itens[4];
    assert.equal(nova.nome, 'Entregar a caderneta');
    assert.equal(nova.seccao, 'S2');
    assert.equal(nova.feita, false);
    assert.equal(app.db.contracts[0].tarefas.itens.length, 4, 'o contrato ainda não mudou');
    assert.equal(toasts.length, 0, 'sem aviso: a linha nova aparece na lista, à vista');
    app.tfGuardar();
    assert.equal(app.db.contracts[0].tarefas.itens[4].nome, 'Entregar a caderneta');
    assert.equal(toasts.pop().m, 'Tarefas guardadas.');
  });

  test('editar muda o nome, a secção e o estado; remover tem Anular, que repõe no rascunho', () => {
    const { abertas, toasts } = base();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    app.tfEditarTarefa('K4');
    assert.match(abertas[abertas.length - 1].f, />Aplicar<\/button>$/, 'numa que existe, «Aplicar»');
    const el = elementos(app);
    el.tf_nome.value = 'Ligar à Ana às 18h';
    el.tf_sec.value = 'S2';
    el.tf_feita.checked = true;
    app.tfGuardarTarefa();
    const k4 = () => app.tfRascunho.itens.find((x) => x.id === 'K4');
    assert.equal(k4().nome, 'Ligar à Ana às 18h');
    assert.equal(k4().seccao, 'S2');
    assert.equal(k4().feitaEm, HOJE);
    app.tfEditarTarefa('K4');
    app.tfRemoverTarefa('K4');
    assert.equal(k4(), undefined);
    const t = toasts.pop();
    assert.equal(t.m, 'Tarefa removida.');
    assert.equal(t.op.rotulo, 'Anular');
    t.op.fn();
    assert.equal(k4().nome, 'Ligar à Ana às 18h', 'o Anular repõe-na');
    igual(app.tfRascunho.itens.map((x) => x.id), ['K1', 'K2', 'K3', 'K4'], 'no lugar onde estava');
    assert.equal(app.db.properties[0].tarefas.itens.find((x) => x.id === 'K4').nome, 'Ligar à Ana', 'o registo não mudou');
  });

  test('uma secção nova, um nome novo, e remover a secção leva as tarefas dela (com Anular), tudo no rascunho', () => {
    const { abertas, toasts } = base();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    app.tfNovaSeccao();
    elementos(app).pm_v.value = 'Mudança';
    app._pm();
    const t = () => app.tfRascunho;
    assert.deepEqual(t().seccoes.map((s) => s.nome), ['Obras', 'Documentos', 'Mudança']);
    app.tfMudarNomeSeccao('S1');
    assert.equal(abertas[abertas.length - 1].t, 'Mudar o nome da secção');
    elementos(app).pm_v.value = 'Obras na cozinha';
    app._pm();
    assert.equal(t().seccoes[0].nome, 'Obras na cozinha');
    app.tfRemoverSeccao('S1');
    assert.deepEqual(t().seccoes.map((s) => s.id).includes('S1'), false);
    assert.deepEqual(t().itens.map((x) => x.id), ['K3', 'K4']);
    const aviso = toasts.pop();
    assert.equal(aviso.m, 'Secção removida, com 2 tarefas.');
    aviso.op.fn();
    assert.deepEqual(t().itens.map((x) => x.id), ['K1', 'K2', 'K3', 'K4']);
    assert.equal(t().itens[0].seccao, 'S1', 'as tarefas voltam para a secção');
    assert.equal(t().seccoes[0].nome, 'Obras na cozinha', 'e a secção volta ao lugar, com o nome novo');
    assert.deepEqual(app.db.properties[0].tarefas.seccoes.map((s) => s.nome), ['Obras', 'Documentos'], 'nada gravado');
  });
});

describe('as notas de uma tarefa', () => {
  test('o normTarefas guarda as notas, aparadas nas pontas, e só texto; sem elas fica ""', () => {
    const t = app.normTarefas({ itens: [
      { id: 'K1', nome: 'A', notas: '  Pedir três orçamentos.\nO do Sr. Rui é o mais barato.  ' },
      { id: 'K2', nome: 'B' },
      { id: 'K3', nome: 'C', notas: { lixo: 1 } },
    ] });
    igual(t.itens.map((x) => x.notas), ['Pedir três orçamentos.\nO do Sr. Rui é o mais barato.', '', '']);
    const p = app.normProp({ id: 'P1', name: 'X', tarefas: t });
    igual(app.normProp(JSON.parse(JSON.stringify(p))).tarefas.itens[0].notas, 'Pedir três orçamentos.\nO do Sr. Rui é o mais barato.', 'ida e volta sem perdas');
  });

  test('o formulário tem o campo «Notas» (opcional, por baixo da secção) e leva-as ao rascunho, numa nova e numa editada', () => {
    const { abertas } = base();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    app.tfNovaTarefa('S1');
    const form = abertas[1];
    conferir('tarefa', form.b, { obrigatorios: ['tf_nome'], exemplos: { tf_nome: EX + 'Trocar o esquentador' } });
    assert.match(form.b, /<label>Secção[\s\S]*<\/label>\s*<label>Notas<textarea id="tf_notas" placeholder="Opcional"><\/textarea><\/label>/, 'por baixo da secção, vazio numa nova');
    assert.doesNotMatch(form.b, /id="tf_notas"[^>]*data-keydown/, 'no textarea o Enter muda de linha');
    const el = elementos(app);
    el.tf_nome.value = 'Trocar a torneira';
    el.tf_sec.value = 'S1';
    el.tf_notas.value = '  Comprar a do Leroy.\nFechar a água antes.  ';
    app.tfGuardarTarefa();
    const nova = app.tfRascunho.itens[4];
    assert.equal(nova.notas, 'Comprar a do Leroy.\nFechar a água antes.');
    // editada: o formulário abre com as notas (escapadas) e o Aplicar leva as novas
    app.tfEditarTarefa(nova.id);
    assert.match(abertas[abertas.length - 1].b, /<textarea id="tf_notas" placeholder="Opcional">Comprar a do Leroy\.\nFechar a água antes\.<\/textarea>/);
    el.tf_nome.value = 'Trocar a torneira';
    el.tf_sec.value = 'S1';
    el.tf_notas.value = '';
    app.tfGuardarTarefa();
    assert.equal(app.tfRascunho.itens.find((x) => x.id === nova.id).notas, '', 'apagar as notas também se aplica');
    app.tfEditarTarefa('K1');
    el.tf_nome.value = 'Pintar a sala';
    el.tf_sec.value = 'S1';
    el.tf_notas.value = 'Branco <mate> & sem cheiro';
    app.tfGuardarTarefa();
    assert.equal(app.tfRascunho.itens.find((x) => x.id === 'K1').notas, 'Branco <mate> & sem cheiro');
  });

  test('a linha mostra as notas por baixo do nome, escapadas; sem notas não há nada a mais', () => {
    base();
    const t = LISTA();
    t.itens[0].notas = 'Branco <mate> & "sem cheiro"';
    app.db.properties[0].tarefas = app.normTarefas(t);
    app.tfAbrir('imovel', 'P1');
    const html = app.tfLista();
    assert.match(html, /<div class="tf-item tf-com-notas" data-id="K1">[\s\S]*?<button type="button" class="tf-nome"[^>]*><span>Pintar a sala<\/span><small class="tf-notas">Branco &lt;mate&gt; &amp; &quot;sem cheiro&quot;<\/small><\/button><\/div>/);
    assert.doesNotMatch(html, /<mate>/, 'nada de HTML vindo das notas');
    assert.match(html, /<div class="tf-item tf-feita" data-id="K2">/, 'a cumprida sem notas não leva a classe');
    assert.equal((html.match(/class="tf-notas"/g) || []).length, 1, 'só a tarefa com notas');
    igual(nomesNaLista(), ['Ligar à Ana', 'Pintar a sala', 'Trocar o esquentador', 'Pedir o certificado energético'], 'o nome continua o mesmo');
    // quem só lê também as vê (o CW volta a ser o de antes: o arnês não o repõe)
    const cw = app.window.CW;
    try {
      app.db.contracts[0].tarefas = app.normTarefas(t);
      app.db.contracts[0]._createdBy = 'outro';
      app.window.CW = { user: { id: 'eu' }, cargos: { P1: { dono: false, nome: 'Gestor', perms: ['contract.view', 'contract.add'] } }, pessoas: {} };
      app.tfAbrir('contrato', 'C1');
      assert.match(app.tfLista(), /<span class="tf-nome"><span>Pintar a sala<\/span><small class="tf-notas">Branco &lt;mate&gt;/);
    } finally {
      app.window.CW = cw;
    }
  });

  test('a pesquisa encontra pelas notas, sem olhar a acentos nem maiúsculas', () => {
    base();
    const t = LISTA();
    t.itens[2].notas = 'Ligar ao técnico da ADENE';
    app.db.properties[0].tarefas = app.normTarefas(t);
    app.tfAbrir('imovel', 'P1');
    app.tfPesquisar('tecnico');
    igual(nomesNaLista(), ['Pedir o certificado energético']);
    assert.match(app.tfCorpo(), /aria-label="Pesquisar por tarefa, notas ou secção"/);
  });

  test('mudar só as notas é uma alteração por guardar, e o Guardar leva-as ao registo', () => {
    const { toasts } = base();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    assert.equal(app.tfMudou(), false);
    app.tfEditarTarefa('K3');
    const el = elementos(app);
    el.tf_nome.value = 'Pedir o certificado energético';
    el.tf_sec.value = 'S2';
    el.tf_notas.value = 'A ADENE pede a caderneta.';
    app.tfGuardarTarefa();
    assert.equal(app.tfMudou(), true, 'só as notas mudaram, e há alterações');
    assert.match(app.tfLista(), /Alterações por guardar/);
    assert.equal(app.db.properties[0].tarefas.itens.find((x) => x.id === 'K3').notas, '', 'o registo ainda não mudou');
    app.tfGuardar();
    assert.equal(app.db.properties[0].tarefas.itens.find((x) => x.id === 'K3').notas, 'A ADENE pede a caderneta.');
    assert.equal(toasts.pop().m, 'Tarefas guardadas.');
  });
});

describe('quem pode', () => {
  test('quem colabora sem «Editar a ficha» não vê a linha das tarefas do imóvel nem marca nada', () => {
    const { toasts } = base();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    app.window.CW = { user: { id: 'eu' }, cargos: { P1: { dono: false, nome: 'Ver', perms: ['contract.view'] } }, pessoas: {} };
    assert.equal(app.tfPodeAlterar('imovel', 'P1'), false);
    app.tfMarcar('K1', true);
    assert.equal(app.tfRascunho.itens[0].feita, false, 'recusado, nem no rascunho');
    assert.equal(app.db.properties[0].tarefas.itens[0].feita, false);
    assert.match(toasts.pop().m, /Não tens permissão/);
    app.db.properties[0].tarefas = app.normTarefas(null);   // o servidor nem as manda
    assert.equal(app.tfLinhaDaFicha('imovel', 'P1'), null);
  });

  test('num contrato que outro adicionou, a lista lê-se mas não se altera: sem botões nem caixas ativas', () => {
    base();
    app.db.contracts[0].tarefas = app.normTarefas(LISTA());
    app.db.contracts[0]._createdBy = 'outro';
    app.window.CW = { user: { id: 'eu' }, cargos: { P1: { dono: false, nome: 'Gestor', perms: ['contract.view', 'contract.add'] } }, pessoas: {} };
    assert.equal(app.tfPodeAlterar('contrato', 'C1'), false);
    app.tfAbrir('contrato', 'C1');
    assert.match(app.ctFicha('C1'), /Ver tarefas/, 'quem vê o contrato vê a lista');
    const html = app.tfLista();
    assert.match(html, /disabled/);
    assert.doesNotMatch(html, /tfEditarTarefa/);
  });
});

/* ------------------------------------------------- o rascunho no aparelho */

/* Uma base como a do base(), com a sessão de uma conta (dona de tudo), o
   aparelho limpo e os save() contados (só o Guardar envia).
   Recebe: id (opcional) — a conta.
   Devolve: {abertas, toasts, envios} — envios() diz quantos save() houve. */
function comConta(id = 'U1') {
  const r = base();
  app.localStorage.clear();
  app.window.CW = { user: { id }, cargos: {}, pessoas: {} };
  let n = 0;
  app.save = () => { n++; };
  return Object.assign(r, { envios: () => n });
}
// o que o aparelho guarda para uma conta (null sem nada)
const noAparelho = (id = 'U1') => JSON.parse(app.localStorage.getItem('gi_tf_rascunhos:' + id) || 'null');
// a janela das tarefas de cima (a última aberta)
const janelaDe = (abertas) => abertas.filter((L) => /^Tarefas/.test(L.t)).pop();
/* Fecha a janela das tarefas como o closeModal: sai da pilha e corre o
   aoFechar com a origem ('' sem ela). */
function fechar(abertas, origem = '') {
  const L = janelaDe(abertas);
  const i = app.modalStack.indexOf(L);
  if (i > -1) app.modalStack.splice(i, 1);
  L.aoFechar(origem);
}
/* Recarregar a página (ou ela morrer): sem aoFechar, a memória vai-se e o
   aparelho fica. */
function recarregar() {
  app.modalStack.length = 0;
  app.tfAlvo = null; app.tfRascunho = null; app.tfOriginal = ''; app.tfCamada = null; app.tfRascT = 0;
}
/* Adiciona uma tarefa pelo formulário, sem Guardar.
   Recebe: nome; sec (opcional) — a secção. */
function adicionar(nome, sec = '') {
  app.tfNovaTarefa(sec);
  const el = elementos(app);
  el.tf_nome.value = nome; el.tf_sec.value = sec; el.tf_notas.value = '';
  app.tfGuardarTarefa();
}
const LINHA = /<div class="tf-rascunho"><p class="tf-rascunho-txt">Alterações guardadas neste aparelho hoje às \d\d:\d\d: ainda não foram para o servidor\.<\/p><button type="button" class="btn ghost" id="tf_descartar" data-toca="rascunho" data-click="tfDescartar\(\)">Descartar<\/button><\/div>/;
// os ids das tarefas que a lista da janela marca com o selo
const comSelo = () => [...app.tfLista().matchAll(/data-id="([^"]+)">(?:(?!<div class="tf-item)[\s\S])*?<span class="tf-selo">/g)].map((m) => m[1]);

describe('o rascunho no aparelho', () => {
  test('cada mudança leva-o ao aparelho, por conta e por registo, com a base e a hora; desfazer tudo tira-o', () => {
    const { envios } = comConta();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    assert.equal(noAparelho(), null, 'abrir não guarda nada');
    app.tfMarcar('K1', true);
    const g = noAparelho()['imovel:P1'];
    assert.equal(g.r.itens.find((x) => x.id === 'K1').feita, true, 'o rascunho');
    assert.equal(g.b.itens.find((x) => x.id === 'K1').feita, false, 'a base de onde partiu');
    assert.equal(typeof g.t, 'number');
    igual(Object.keys(noAparelho()), ['imovel:P1'], 'só este registo');
    adicionar('Trocar a fechadura');
    assert.equal(noAparelho()['imovel:P1'].r.itens.length, 5, 'a tarefa nova também');
    igual(comSelo().length, 2, 'na janela, a marcada e a nova levam o «Por enviar»');
    assert.ok(comSelo().includes('K1'));
    app.tfMarcar('K1', false);
    app.tfRemoverTarefa(app.tfRascunho.itens[4].id);
    assert.equal(app.tfMudou(), false);
    assert.equal(noAparelho(), null, 'sem alterações, a chave sai do aparelho');
    assert.equal(envios(), 0, 'nada foi enviado');
  });

  test('o Guardar grava e tira-o do aparelho; recusado (sem permissão), fica lá', () => {
    const { envios } = comConta();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    adicionar('Trocar a fechadura');
    assert.ok(noAparelho());
    app.tfGuardar();
    assert.equal(noAparelho(), null);
    assert.equal(app.db.properties[0].tarefas.itens[4].nome, 'Trocar a fechadura');
    assert.equal(envios(), 1, 'um envio, o do Guardar');
    // recusado: a permissão perdeu-se a meio
    app.tfAbrir('imovel', 'P1');
    app.tfMarcar('K1', true);
    app.window.CW.cargos = { P1: { dono: false, nome: 'Ver', perms: ['contract.view'] } };
    assert.equal(app.tfGuardar(), false);
    assert.equal(noAparelho()['imovel:P1'].r.itens[0].feita, true, 'o rascunho fica no aparelho');
  });

  test('«Sair sem guardar» tira-o; fechar por outro caminho (mudar de separador) deixa-o', () => {
    const { abertas } = comConta();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    app.tfMarcar('K1', true);
    fechar(abertas, '');
    assert.equal(app.tfRascunho, null, 'a memória da janela vai-se');
    assert.ok(noAparelho(), 'o closeAllModals de mudar de separador não o tira');
    app.tfAbrir('imovel', 'P1');
    assert.equal(app.tfRascunho.itens[0].feita, true, 'reabrir traz o rascunho');
    app._forcaFecho = true;   // a resposta «Sair sem guardar» (componentes.js:_sairSemGuardar)
    fechar(abertas, '');
    app._forcaFecho = false;
    assert.equal(noAparelho(), null, 'a pessoa escolheu deitar fora');
    // sob automação a pergunta não se faz: o X vale como a resposta
    app.tfAbrir('imovel', 'P1');
    app.tfMarcar('K2', false);
    app.navigator.webdriver = true;
    try { fechar(abertas, 'x'); } finally { delete app.navigator.webdriver; }
    assert.equal(noAparelho(), null);
  });

  test('recarregar não o perde: a janela volta com ele, a linha diz de quando é, o selo marca as novas e o rodapé diz Cancelar', () => {
    const { abertas, envios } = comConta();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    adicionar('Trocar a fechadura', 'S1');
    const nova = app.tfRascunho.itens.find((x) => x.nome === 'Trocar a fechadura').id;
    assert.doesNotMatch(app.tfCorpo(), /tf-rascunho/, 'sem recarregar, não há linha: diz «Alterações por guardar»');
    assert.match(app.tfLista(), /Alterações por guardar/);
    recarregar();
    assert.equal(app.db.properties[0].tarefas.itens.length, 4, 'o registo não mudou');
    app.tfAbrir('imovel', 'P1');
    const L = janelaDe(abertas);
    assert.equal(app.tfRascunho.itens.length, 5);
    assert.equal(app.tfMudou(), true);
    assert.match(L.b, LINHA, 'a linha no cimo da lista');
    assert.doesNotMatch(L.b, /Alterações por guardar/, 'a linha já o diz');
    igual(comSelo(), [nova], 'só a nova leva o selo');
    assert.match(app.tfLista(), /<span class="tf-selo"><svg[\s\S]*?<\/svg>Por enviar<\/span>/);
    assert.match(L.f, /id="tf_fechar"[^>]*>Cancelar</, 'com alterações, Cancelar');
    assert.equal(L.tocado, true, 'fechar pergunta «Sair sem guardar?»');
    assert.equal(envios(), 0, 'abrir com o rascunho não grava sozinho');
    // mais uma mudança: a linha repinta-se com a lista, e o aparelho acompanha
    app.tfMarcar('K1', true);
    assert.match(elementos(app).tf_rasc.innerHTML, LINHA);
    assert.equal(noAparelho()['imovel:P1'].r.itens[0].feita, true);
    app.tfMarcar('K1', false);
    assert.equal(app.tfMudou(), true, 'a nova continua por guardar');
    app.tfGuardar();
    assert.equal(app.db.properties[0].tarefas.itens.find((x) => x.id === nova).seccao, 'S1');
    assert.equal(envios(), 1);
  });

  test('a fusão a três: o que o registo mudou entretanto fica, o que se mudou aqui também, e o que se removeu aqui sai', () => {
    const { abertas } = comConta();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    app.tfMarcar('K1', true);
    app.tfRemoverTarefa('K4');
    adicionar('Trocar a fechadura');
    recarregar();
    // entretanto, outra pessoa: uma tarefa nova, outro nome na K3, a K2 por cumprir
    const s = app.db.properties[0].tarefas;
    s.itens.push({ id: 'K9', nome: 'Do outro aparelho', seccao: 'S2', feita: false, feitaEm: '', notas: '' });
    s.itens.find((x) => x.id === 'K3').nome = 'Pedir o certificado (já pedido)';
    Object.assign(s.itens.find((x) => x.id === 'K2'), { feita: false, feitaEm: '' });
    app.tfAbrir('imovel', 'P1');
    const t = app.tfRascunho, por = (id) => t.itens.find((x) => x.id === id);
    assert.equal(por('K9').nome, 'Do outro aparelho', 'a do outro fica');
    assert.equal(por('K3').nome, 'Pedir o certificado (já pedido)', 'o nome que o outro mudou fica');
    assert.equal(por('K2').feita, false, 'a K2 como o outro a deixou');
    assert.equal(por('K1').feita, true, 'a minha marca fica');
    assert.equal(por('K4'), undefined, 'a que removi sai');
    assert.ok(t.itens.some((x) => x.nome === 'Trocar a fechadura'), 'a minha nova fica');
    igual(comSelo().sort(), ['K1', t.itens.find((x) => x.nome === 'Trocar a fechadura').id].sort(), 'o selo só nas minhas');
    // o aparelho passa a partir do registo de agora
    assert.equal(noAparelho()['imovel:P1'].b.itens.find((x) => x.id === 'K3').nome, 'Pedir o certificado (já pedido)');
    // e o Guardar leva a lista fundida
    app.tfGuardar();
    igual(app.db.properties[0].tarefas.itens.map((x) => x.id).filter((id) => /^K/.test(id)).sort(), ['K1', 'K2', 'K3', 'K9']);
    fechar(abertas, '');
  });

  test('um rascunho que, fundido, já é igual ao registo não conta e sai', () => {
    comConta();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    app.tfMarcar('K1', true);
    recarregar();
    // outro aparelho desta conta guardou o mesmo
    Object.assign(app.db.properties[0].tarefas.itens[0], { feita: true, feitaEm: HOJE });
    assert.doesNotMatch(app.propFicha('P1'), /tf-selo|por enviar/, 'a ficha não mostra nada por enviar');
    app.tfAbrir('imovel', 'P1');
    assert.equal(app.tfMudou(), false);
    assert.equal(noAparelho(), null, 'sai do aparelho');
    assert.doesNotMatch(app.tfCorpo(), /tf-rascunho|tf-selo/);
  });

  test('caduca aos 30 dias sem mexer; antes disso volta, com o dia e a hora', () => {
    comConta();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    const reg = app.normTarefas(LISTA()), r = app.normTarefas(LISTA());
    r.itens.push({ id: 'N1', nome: 'Esquecida', seccao: '', feita: false });
    const dia = 864e5, agora = app.Date.now();
    const pousar = (t) => app.localStorage.setItem('gi_tf_rascunhos:U1', JSON.stringify({ 'imovel:P1': { b: reg, r, t }, 'contrato:C1': 'lixo' }));
    pousar(agora - 31 * dia);
    app.tfAbrir('imovel', 'P1');
    assert.equal(app.tfRascunho.itens.length, 4, 'caducado, não volta');
    assert.equal(noAparelho(), null, 'e sai do aparelho, com o lixo');
    recarregar();
    pousar(agora - 29 * dia);
    app.tfAbrir('imovel', 'P1');
    assert.equal(app.tfRascunho.itens.length, 5, 'com 29 dias, volta');
    assert.match(app.tfCorpo(), /Alterações guardadas neste aparelho a \d{1,2}\/\d{1,2} às \d\d:\d\d: ainda não foram para o servidor\./);
    igual(Object.keys(noAparelho()), ['imovel:P1'], 'o lixo sai');
    assert.equal(app.tfQuando(agora - dia), 'ontem às ' + /às (\d\d:\d\d)$/.exec(app.tfQuando(agora - dia))[1]);
  });

  test('sem armazenamento (ou sem sessão), a janela trabalha como antes, só em memória', () => {
    const { toasts } = comConta();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    const recusa = () => { throw new Error('armazenamento fechado'); };
    app.localStorage = { getItem: recusa, setItem: recusa, removeItem: recusa, clear: recusa };
    app.tfAbrir('imovel', 'P1');
    adicionar('Trocar a fechadura');
    assert.equal(app.tfRascunho.itens.length, 5);
    assert.match(app.propFicha('P1'), /Ainda não há tarefas|por cumprir/);
    assert.equal(app.tfGuardar(), true);
    assert.equal(app.db.properties[0].tarefas.itens.length, 5, 'o Guardar grava');
    assert.equal(toasts.pop().m, 'Tarefas guardadas.');
    repor(app);   // o armazenamento de volta
    comConta();
    app.window.CW = { cargos: {}, pessoas: {} };   // sem sessão
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    app.tfMarcar('K1', true);
    assert.equal(app.localStorage.getItem('gi_tf_rascunhos:'), null);
    assert.equal(app.tfRascChave(), '');
  });

  test('o rascunho de uma conta nunca aparece a outra no mesmo aparelho', () => {
    comConta('U1');
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    adicionar('Só da U1');
    recarregar();
    app.window.CW = { user: { id: 'U2' }, cargos: {}, pessoas: {} };
    assert.doesNotMatch(app.propFicha('P1'), /Só da U1|tf-selo/);
    app.tfAbrir('imovel', 'P1');
    assert.equal(app.tfRascunho.itens.length, 4);
    assert.equal(app.tfMudou(), false);
    recarregar();
    app.window.CW = { user: { id: 'U1' }, cargos: {}, pessoas: {} };
    assert.match(app.propFicha('P1'), /Só da U1/);
    assert.ok(noAparelho('U1'));
    assert.equal(noAparelho('U2'), null);
  });

  test('«Descartar» tira-o da janela e do aparelho, com Anular que o devolve (junto com o que se fez entretanto)', () => {
    const { abertas, toasts } = comConta();
    app.db.properties[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    adicionar('Trocar a fechadura');
    recarregar();
    app.tfAbrir('imovel', 'P1');
    assert.match(janelaDe(abertas).b, LINHA);
    app.tfDescartar();
    assert.equal(app.tfRascunho.itens.length, 4, 'a janela fica com o registo');
    assert.equal(app.tfMudou(), false);
    assert.equal(noAparelho(), null);
    assert.doesNotMatch(app.tfCorpo(), /tf-rascunho|tf-selo/);
    const aviso = toasts.pop();
    assert.equal(aviso.m, 'Alterações descartadas.');
    assert.equal(aviso.op.rotulo, 'Anular');
    app.tfMarcar('K1', true);   // entretanto
    aviso.op.fn();
    assert.ok(app.tfRascunho.itens.some((x) => x.nome === 'Trocar a fechadura'), 'o Anular devolve-a');
    assert.equal(app.tfRascunho.itens[0].feita, true, 'e o que se fez entretanto fica');
    assert.match(app.tfCorpo(), LINHA, 'com a linha');
    assert.ok(noAparelho()['imovel:P1'].r.itens.some((x) => x.nome === 'Trocar a fechadura'), 'e no aparelho');
    // fechada a janela, o Anular já não repõe nada
    app.tfDescartar();
    const outro = toasts.pop();
    fechar(abertas, '');
    outro.op.fn();
    assert.equal(noAparelho(), null);
  });

  test('a ficha mostra as tarefas por enviar primeiro, com o selo, e o resumo diz quantas; tocar abre a janela com o rascunho', () => {
    comConta();
    const t = LISTA();
    t.itens.push({ id: 'K5', nome: 'Pintar o quarto', seccao: '', feita: false }, { id: 'K6', nome: 'Rever o contador', seccao: '', feita: false });
    app.db.properties[0].tarefas = app.normTarefas(t);
    app.db.contracts[0].tarefas = app.normTarefas(LISTA());
    app.tfAbrir('imovel', 'P1');
    adicionar('Trocar a fechadura');
    recarregar();
    const f = app.propFicha('P1');
    assert.match(f, /<h3>Tarefas<\/h3><span class="small num">6 por cumprir · 1 cumprida · <b class="tf-por-guardar">1 por enviar<\/b><\/span>/);
    const nomes = [...f.matchAll(/<span class="tf-fl-nome"><span class="imv-so-leitor">[^<]*<\/span>([^<]*)<\/span>\s*(<span class="tf-selo">)?/g)].map((m) => m[1] + (m[2] ? ' [Por enviar]' : ''));
    igual(nomes, ['Trocar a fechadura [Por enviar]', 'Pintar a sala', 'Pedir o certificado energético', 'Ligar à Ana'], 'a por enviar à cabeça, mesmo com mais de quatro por cumprir');
    assert.match(f, /class="imv-linha tap tf-fl" data-toca="camada" data-click="tfAbrir\('imovel','P1'\)">[\s\S]*?Trocar a fechadura/, 'tocar abre a janela');
    // o contrato: a linha da ficha
    app.tfAbrir('contrato', 'C1');
    app.tfMarcar('K3', true);
    recarregar();
    const c = app.ctFicha('C1');
    assert.match(c, /2 por cumprir · 2 cumpridas · <b class="tf-por-guardar">1 por enviar<\/b>/);
    assert.match(c, /<div class="tf-env"><div class="tf-env-linha"><span class="tf-fl-nome">Pedir o certificado energético<\/span><span class="tf-selo">/);
    // só se removeu: «alterações por enviar»
    app.tfAbrir('contrato', 'C1');
    app.tfDescartar();
    app.tfRemoverTarefa('K4');
    recarregar();
    assert.match(app.ctFicha('C1'), /2 por cumprir · 1 cumprida · <b class="tf-por-guardar">alterações por enviar<\/b>/);
    assert.doesNotMatch(app.ctFicha('C1'), /tf-env/);
    // quem não pode alterar não vê o rascunho (nem o pode guardar)
    app.window.CW.cargos = { P1: { dono: false, nome: 'Ver', perms: ['contract.view', 'house.edit'] } };
    assert.doesNotMatch(app.ctFicha('C1'), /por enviar/);
  });
});
