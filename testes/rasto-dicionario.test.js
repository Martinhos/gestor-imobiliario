// O dicionário do rasto (worker/src/equipa-guiao.js, «o rasto em palavras»):
// o back office lê o rasto das pessoas com os textos da app, e não com os
// descritores que o cliente manda (decisão do Martinho, 2026-10-29, tickets
// de QA 1895e0a9 e 03f1d309). Para não ficar para trás:
// - cada ação de um data-click escrito em web/app/*.js e web/cloud/*.js tem
//   rótulo — uma ação nova sem rótulo faz este teste falhar, com o nome e o
//   ficheiro; a regra é acrescentá-la a ACOES_RASTO com o texto que o botão
//   mostra (ou, quando o botão é só um ícone, o que o aria-label diz);
// - as ações que chegam ao data-click por variáveis (act:, abrir:…) e que a
//   app mais usa (PRINCIPAIS) também;
// - cada separador (navegacao.js:TABS), com o mesmo nome; cada subpágina das
//   Definições; cada secção da montra; e cada tipo de registo do evento
//   «dados» (lib/rasto.js:KINDS_DOS_DADOS), com singular e plural;
// - e os rótulos são textos da casa: sem «(s)», sem ponto de exclamação,
//   com maiúscula.
// O cliente e a montra tiram os argumentos da mesma maneira (um
// «event.stopPropagation();» à frente não conta), e é por esse nome que o
// dicionário procura.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { paginaEquipa } from '../worker/src/equipa-vista.js';
import { recursoDePagina } from '../worker/src/paginas-recursos.js';
import { KINDS_DOS_DADOS } from '../worker/src/lib/rasto.js';
import { GUIAO_RASTO_MONTRA } from '../worker/src/landing.js';
import { carregarTudo } from './arnes.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

/* As ações que a app passa ao data-click por variáveis (o act de um menu, o
   abrir de um aviso, o fn de um seletor): não se apanham lendo o atributo,
   e estas são as que mais se tocam. */
const PRINCIPAIS = [
  'ctModal', 'txModal', 'personModal', 'visitModal', 'propModal', 'newTxPick', 'newRec', 'editRec', 'newTpl', 'editTpl',
  'newFromTemplate', 'abrirFicha', 'lpMenu', 'aplicarFiltroComum', 'pagarCredor', 'ctEscolheQuarto', 'ctComecaNoFim',
  'anaChipFocar', 'delTx', 'delProp', 'delPerson', 'delContract', 'delRec', 'delTpl', 'reactivateContract', 'endContract',
  'imvTransferir', 'verMovimentosDoImovel', 'pagamentoNoImovel', 'despesaNoImovel', 'novoGrupoEscolher', 'editarMovimento',
  'CW.selEditar', 'CW.selApagar', 'CW.apagarCargo', 'CW.rejectRec', 'CW.grupoRenomear', 'CW.grupoApagar',
];

/* O guião do back office num browser de faz-de-conta, para ler os
   dicionários e chamar as funções que traduzem.
   Devolve: promessa do contexto do vm. */
async function guiao() {
  const eu = { nome: 'Mestre', discordId: 'm1', papel: 'master', papeis: ['master'] };
  const html = await new Response(paginaEquipa(eu).body).text();
  const js = await (await recursoDePagina('/equipa/guiao.js', 'GET', async () => true)).text();
  const dados = /<script type="application\/json" id="dados-equipa">([\s\S]*?)<\/script>/.exec(html)[1];
  const els = { 'dados-equipa': { id: 'dados-equipa', textContent: dados } };
  const ctx = vm.createContext({
    document: {
      title: '',
      getElementById: (id) => els[id] || (els[id] = { id, innerHTML: '', value: '', showModal() {}, close() {}, querySelector: () => null }),
      addEventListener() {},
    },
    location: { reload() {} },
    fetch: async () => new Response('{}'),
    setTimeout, console,
  });
  vm.runInContext(js, ctx);
  return ctx;
}

/* As ações dos data-click escritos nos ficheiros da app, como o cliente as
   nomeia (web/cloud/rasto.js:rstNomeDaAcao): o nome antes dos argumentos,
   sem um «event.…();» à frente. Os que começam por ${…} (a ação vem de uma
   variável) ficam para os PRINCIPAIS.
   Devolve: Map nome → [ficheiros]. */
function acoesDaApp() {
  const out = new Map();
  for (const pasta of ['web/app', 'web/cloud']) {
    for (const f of fs.readdirSync(path.join(RAIZ, pasta)).filter((x) => x.endsWith('.js'))) {
      const s = ler(pasta + '/' + f);
      const re = /data-click=\\?["'`]\s*[!(]*\s*(?:event\.[A-Za-z]+\(\)\s*;?\s*)*([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)/g;
      let m;
      while ((m = re.exec(s))) {
        const l = out.get(m[1]) || [];
        if (l.indexOf(f) < 0) l.push(f);
        out.set(m[1], l);
      }
    }
  }
  return out;
}

describe('o dicionário do rasto não fica para trás', () => {
  test('cada ação de um data-click da app tem rótulo', async () => {
    const g = await guiao();
    const acoes = acoesDaApp();
    assert.ok(acoes.size > 250, 'controlo: a leitura apanhou as ações da app (' + acoes.size + ')');
    for (const n of ['closeModal', 'onSave', 'propView', 'CW.readDoc', 'lpMenu']) assert.ok(acoes.has(n) || PRINCIPAIS.includes(n), 'controlo: ' + n);
    assert.ok(!acoes.has('event.stopPropagation') && !acoes.has('event.preventDefault'), 'o event.…(); à frente não conta');
    const sem = [...acoes.keys()].filter((n) => !Object.prototype.hasOwnProperty.call(g.ACOES_RASTO, n));
    assert.deepEqual(sem.map((n) => n + ' (' + acoes.get(n).join(', ') + ')'), [],
      'acrescenta estas ações a ACOES_RASTO, em worker/src/equipa-guiao.js, com o texto que o botão mostra');
  });

  test('as ações que chegam por variáveis, as mais usadas, também', async () => {
    const g = await guiao();
    const sem = PRINCIPAIS.filter((n) => !Object.prototype.hasOwnProperty.call(g.ACOES_RASTO, n));
    assert.deepEqual(sem, []);
  });

  test('os rótulos são textos da casa', async () => {
    const g = await guiao();
    for (const [n, r] of Object.entries(g.ACOES_RASTO)) {
      assert.equal(typeof r, 'string', n);
      assert.ok(r.length > 1 && r.length <= 60, n + ': «' + r + '»');
      assert.match(r, /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/, n + ': começa por maiúscula');
      assert.doesNotMatch(r, /\(s\)|!|[\u{1F300}-\u{1FAFF}]/u, n + ': sem «(s)», sem exclamação, sem emojis');
      assert.doesNotMatch(r, /\bpôr\b|\btirar\b/i, n + ': adicionar e remover, nunca pôr e tirar');
    }
  });

  test('cada separador da app tem o nome dela, e cada subpágina das Definições também', async () => {
    const g = await guiao();
    const nav = ler('web/app/navegacao.js');
    const tabs = [...nav.matchAll(/\{id:'([a-z]+)',icon:'[^']*',label:'([^']+)'/g)].map((m) => [m[1], m[2]]);
    assert.ok(tabs.length >= 15, 'controlo: os TABS (' + tabs.length + ')');
    for (const [id, label] of tabs) assert.equal(g.ECRAS_RASTO[id], label, 'o separador ' + id);
    const sub = /const SUBPAGE=\{([\s\S]*?)\};/.exec(nav)[1];
    const paginas = new Set([...sub.matchAll(/(\w+):\{label:/g)].map((m) => m[1]));
    for (const f of ['web/app/definicoes.js', ...fs.readdirSync(path.join(RAIZ, 'web/cloud')).map((x) => 'web/cloud/' + x)]) {
      if (!f.endsWith('.js')) continue;
      for (const m of ler(f).matchAll(/\bpage: ?'([a-z]+)'/g)) paginas.add(m[1]);
      for (const m of ler(f).matchAll(/setPage ?=== ?'([a-z]+)'/g)) paginas.add(m[1]);
    }
    assert.ok(paginas.size >= 12, 'controlo: as subpáginas (' + paginas.size + ')');
    for (const p of paginas) assert.ok(g.SUBPAGINAS_RASTO[p], 'a subpágina ' + p);
    assert.deepEqual({ ...g.ecraRasto('settings/tema') }, { txt: 'Definições › Tema', cru: 'settings/tema' });
    assert.deepEqual({ ...g.ecraRasto('contracts') }, { txt: 'Contratos', cru: 'contracts' });
  });

  test('cada secção da montra tem nome, e as ligações dela dizem para onde vão', async () => {
    const g = await guiao();
    const landing = ler('worker/src/landing.js');
    const ids = [...landing.matchAll(/<section[^>]*\sid="([a-z-]+)"/g)].map((m) => m[1])
      .concat([...landing.matchAll(/\{ id: '([a-z]+)', chapeu:/g)].map((m) => m[1]));
    assert.ok(ids.length >= 8, 'controlo: as secções (' + ids.length + ')');
    for (const id of ids) assert.ok(g.SECCOES_RASTO[id], 'a secção ' + id);
    const rot = (d) => g.alvoRasto(d).rotulo;
    assert.equal(rot('a:app.rendorium.com/'), 'Entrar na app');
    assert.equal(rot('a:app.rendorium.com/?criar'), 'Criar conta');
    assert.equal(rot('a:/privacidade'), 'Política de Privacidade');
    assert.equal(rot('a:/termos'), 'Termos e Condições');
    assert.equal(rot('a:mailto:'), 'Enviar um email');
    assert.equal(rot('button.escolha-botao'), 'Aceitar ou Recusar o rasto');
    assert.equal(rot('a:outro.site/coisa'), '', 'um sítio de fora fica sem nome');
  });

  test('cada tipo de registo dos dados tem singular e plural, pela mesma ordem do servidor', async () => {
    const g = await guiao();
    assert.deepEqual(Array.from(g.DADOS_RASTO, (k) => k[0]), KINDS_DOS_DADOS);
    for (const k of g.DADOS_RASTO) assert.ok(k.length === 3 || /^(o|a|os|as) /.test(k[1]), k[0] + ': singular e plural, ou um nome com artigo');
    assert.equal(g.fraseDadosRasto(g.contagensRasto('dados:house+1,house+1,tx-1')), 'Adicionou 2 imóveis; removeu 1 movimento');
  });
});

describe('o nome da ação, igual na app e na montra', () => {
  test('sem os argumentos, e um event.…(); à frente não conta', () => {
    // a app inteira, só para este teste, para chamar o rstNomeDaAcao do web/cloud/rasto.js
    const app = carregarTudo();
    const montra = /function nomeDaAcao\(acao\) \{[\s\S]*?\n {2}\}/.exec(GUIAO_RASTO_MONTRA)[0];
    const nomeDaMontra = new Function(montra + '\nreturn nomeDaAcao;')();
    const casos = [
      ["openProp('p_8f3k2')", 'openProp'], ['onSave&&onSave()', 'onSave'], ["menuOpen(event,'qa');qaMenuAbriu(event)", 'menuOpen'],
      ["event.stopPropagation();lpMenu('t_9x')", 'lpMenu'], ["event.stopPropagation(); CW.grupoAceitarPedido('g1','u2')", 'CW.grupoAceitarPedido'],
      ['event.preventDefault();goSet(\'ajuda\')', 'goSet'], ["!(abrirCasa)('Ana Ribeiro')", 'abrirCasa'], ['', ''],
    ];
    for (const [d, n] of casos) {
      assert.equal(app.rstNomeDaAcao(d), n, 'a app: ' + d);
      assert.equal(nomeDaMontra(d), n, 'a montra: ' + d);
    }
  });
});
