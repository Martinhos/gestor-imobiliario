// As apresentações do Dinheiro e da Agenda (cloud/apresentacao-dinheiro.js):
// os Movimentos, os Planeados, os Créditos e o Calendário registados com 2 a
// 4 imagens; as maquetes sem nada que a CSP recuse; os textos com as regras
// da casa e os caminhos e os botões que a app tem mesmo; o que muda para quem
// só colabora e com um serviço desligado; os números que fecham com o
// portefólio inventado (e a conta da hipoteca, que é a da própria app); e as
// datas contadas a partir de hoje. A app inteira, nuvem incluída
// (carregarTudo), com a sessão simulada em CW.user.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { carregarTudo, limpar, repor, igual } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));
// os serviços desligados vivem no aparelho: cada teste volta a ligá-los todos
afterEach(() => { app.definirServicosDesligados([]); app.CW.cargos = {}; });

const IDS = ['transactions', 'recurring', 'credits', 'calendar'];
const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/* A app limpa, com sessão, já depois do primeiro estado, com todos os
   serviços ligados e sem cargos (sou dono de tudo).
   Devolve: nada. */
function montar() {
  limpar(app);
  app.definirServicosDesligados([]);
  app.CW.user = { id: 'EU', name: 'Maria Costa', email: 'eu@exemplo.pt' };
  app.CW._pulled = 1;
  app.CW.cargos = {};
}

/* Só colaboro num imóvel de outra conta, com estas permissões.
   Recebe: perms — as permissões do cargo.
   Devolve: nada. */
function soColaboro(perms) {
  montar();
  app.db.properties.push(app.normProp({ id: 'P1', name: 'T2 Arroios', ownerIds: ['OUTRO'], _sharedFrom: 'Rita Lopes' }));
  app.CW.cargos = { P1: { dono: false, perms: perms, nome: 'Contabilista' } };
  assert.ok(app.souSoColaborador());
}

/* O texto que se lê numa imagem: o título, o texto sem as marcas e o texto das peças da maquete.
   Recebe: im — uma imagem de aprImagensDe.
   Devolve: o texto. */
const lido = (im) => im.titulo + ' ' + im.texto.replace(/<[^>]*>/g, '') + ' ' + im.html.replace(/<[^>]*>/g, ' ');

/* Todo o código da app fora das apresentações: é lá que um botão ou um caminho tem de existir.
   Devolve: o texto. */
function codigoDaApp() {
  const de = (pasta) => readdirSync(new URL('../web/' + pasta + '/', import.meta.url)).filter((f) => f.endsWith('.js') && !f.startsWith('apresentacao'))
    .map((f) => ler('web/' + pasta + '/' + f)).join('\n');
  return de('app') + de('cloud') + ler('web/index.html');
}

describe('o registo', () => {
  test('as quatro estão registadas, com o nome do separador e entre 2 e 4 imagens', () => {
    montar();
    const tabs = Object.fromEntries(app.TABS.map((t) => [t.id, t.label]));
    for (const id of IDS) {
      const def = app.APRESENTACOES[id];
      assert.ok(def, id + ' registada');
      assert.equal(def.nome, tabs[id], id + ': o nome é o do separador');
      const n = app.aprImagensDe(id).length;
      assert.ok(n >= 2 && n <= 4, id + ' tem ' + n + ' imagens');
    }
    igual(IDS.map((id) => app.aprImagensDe(id).length), [4, 4, 4, 3]);
  });

  test('a Ajuda lista-as pela ordem da navegação: Dinheiro (Movimentos, Planeados, Créditos) e depois a Agenda', () => {
    montar();
    const ordem = app.aprDaConta().filter((id) => IDS.includes(id));
    igual(ordem, IDS);
  });
});

describe('as maquetes', () => {
  test('cada imagem tem a sua maquete, feita com o kit, sem style=, sem on…= e sem <script>', () => {
    montar();
    for (const id of IDS) {
      for (const im of app.aprImagensDe(id)) {
        assert.match(im.html, /^<div class="apr-cena /, id + ' «' + im.titulo + '»: começa na aprCena');
        assert.doesNotMatch(im.html, /style=|\son[a-z]+=|<script/i, id + ' «' + im.titulo + '»');
        assert.ok(im.html.replace(/<[^>]*>/g, '').trim().length > 20, id + ' «' + im.titulo + '» tem texto nas peças');
      }
    }
  });

  test('as classes próprias levam o prefixo .apr-d- e estão todas na secção da folha 1.4 do estilos.css', () => {
    montar();
    const css = ler('web/estilos.css');
    const ini = css.indexOf('/* === apresentação: o Dinheiro e a Agenda (folha 1.4) === */');
    const fim = css.indexOf('/* === fim: apresentação: o Dinheiro e a Agenda (folha 1.4) === */');
    assert.ok(ini > -1 && fim > ini, 'a secção existe');
    const secao = css.slice(ini, fim), fora = css.slice(0, ini) + css.slice(fim);
    const usadas = new Set();
    for (const id of IDS) for (const im of app.aprImagensDe(id)) for (const m of im.html.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).forEach((c) => usadas.add(c));
    const minhas = [...usadas].filter((c) => /^apr-d-/.test(c));
    assert.ok(minhas.length > 20, 'usa as peças próprias (' + minhas.length + ')');
    for (const c of minhas) assert.ok(secao.includes('.' + c), '.' + c + ' tem regra na secção da folha');
    assert.doesNotMatch(fora, /\.apr-d-/, 'nenhuma regra .apr-d- fora da secção');
    assert.doesNotMatch(secao, /#[0-9a-f]{3,8}\b|rgba?\(/i, 'só tokens, nada de cores à mão');
  });
});

describe('os textos', () => {
  test('seguem a casa: sem «pôr»/«tirar», sem «(s)», sem «Bem-vindo», sem ponto de exclamação, sem emojis; títulos curtos e texto só com <b> e <i>', () => {
    montar();
    const todas = IDS.flatMap((id) => app.aprImagensDe(id));
    const textos = todas.map(lido).join(' ');
    assert.ok(textos.length > 3000, 'leu os textos e as maquetes');
    assert.doesNotMatch(textos, /(^|[^\p{L}])(pôr|põe|põem|puser|tirar|tira|tiras)([^\p{L}]|$)/iu);
    assert.doesNotMatch(textos, /\(s\)/);
    assert.doesNotMatch(textos, /Bem-vind/i);
    assert.doesNotMatch(textos, /!/);
    assert.doesNotMatch(textos, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    for (const im of todas) {
      assert.ok(im.titulo.length <= 34, '«' + im.titulo + '» cabe numa linha');
      assert.doesNotMatch(im.titulo, /[<>]/, 'o título é texto simples');
      assert.doesNotMatch(im.texto.replace(/<\/?[bi]>/g, ''), /[<>]/, '«' + im.titulo + '»: só <b> e <i>');
      assert.ok(im.texto.replace(/<[^>]*>/g, '').length <= 230, '«' + im.titulo + '»: duas ou três frases curtas');
    }
  });

  test('os caminhos são os da navegação: Dinheiro → Movimentos, → Planeados, → Créditos e Agenda → Calendário', () => {
    montar();
    assert.equal(app.AREAS.dinheiro.label, 'Dinheiro');
    igual(app.AREAS.dinheiro.ids, ['transactions', 'recurring', 'credits']);
    assert.ok(app.NAV_GROUPS.some((g) => g.label === 'Agenda' && g.ids.includes('calendar')), 'o Calendário vive na Agenda');
    const primeiro = (id) => app.aprImagensDe(id)[0].texto;
    assert.match(primeiro('transactions'), /<b>Dinheiro → Movimentos<\/b>/);
    assert.match(primeiro('credits'), /<b>Dinheiro → Créditos<\/b>/);
    assert.match(primeiro('calendar'), /<b>Agenda → Calendário<\/b>/);
    assert.ok(app.aprImagensDe('recurring').some((im) => /<b>Criar → Movimento recorrente<\/b>/.test(im.texto)));
  });

  test('cada nome a negrito nos textos existe mesmo na app (um botão, um cartão, um caminho)', () => {
    montar();
    const codigo = codigoDaApp();
    const nomes = new Set();
    for (const id of IDS) for (const im of app.aprImagensDe(id)) for (const m of im.texto.matchAll(/<b>([^<]+)<\/b>/g)) m[1].split(' → ').forEach((x) => nomes.add(x.trim()));
    assert.ok(nomes.size > 15, 'leu ' + nomes.size + ' nomes');
    for (const n of nomes) {
      if (n === '+') continue;
      assert.ok(codigo.includes(n), '«' + n + '» existe no código da app');
    }
    // e os que as maquetes desenham como botões
    for (const b of ['Confirmar', 'Rever', 'Agora não', 'Registar os ', 'Usar modelo', 'Novo modelo', 'Pagamento', 'Plano', 'Nova hipoteca',
      'Marcar visita', 'Recorrente', 'Hipoteca de que imóvel?', 'A partir de um modelo', 'Transferência entre proprietários', 'Nada marcado para este dia.']) {
      assert.ok(codigo.includes(b), '«' + b + '» existe no código da app');
    }
  });
});

describe('quem só colabora e os serviços desligados', () => {
  test('um cargo que só vê movimentos não lê como se registam: sem o Criar, e a ficha sem o Editar nem o segurar', () => {
    soColaboro(['tx.view']);
    const im = app.aprImagensDe('transactions');
    igual(im.map((x) => x.titulo), ['Cada euro no mês dele', 'A pesquisa e os filtros', 'Tocar abre, segurar seleciona']);
    assert.doesNotMatch(im[2].texto, /Editar|Segura/);
    assert.doesNotMatch(im[2].html, /selecionados|Editar/, 'a maquete é só a ficha');
  });

  test('nos Planeados, quem só vê fica com a lista e os modelos, sem confirmar, sem o segurar e sem o Criar', () => {
    soColaboro(['rec.view']);
    const im = app.aprImagensDe('recurring');
    igual(im.map((x) => x.titulo), ['Cada linha diz de onde vem', 'Os modelos, no fim da página']);
    assert.doesNotMatch(im[0].texto, /segura/i);
    assert.doesNotMatch(im[1].texto, /Criar/);
    assert.doesNotMatch(im[1].html, /Novo modelo/);
    soColaboro(['tx.view', 'tx.add', 'rec.view', 'rec.add']);
    assert.equal(app.aprImagensDe('recurring').length, 4, 'quem confirma vê as quatro');
  });

  test('nos Créditos, sem editar a ficha do imóvel não há hipoteca nova nem Pagamento', () => {
    soColaboro(['tx.view', 'tx.add', 'loan.view']);
    const im = app.aprImagensDe('credits');
    assert.ok(!im.some((x) => x.titulo === 'Cada hipoteca vive num imóvel'));
    assert.doesNotMatch(im[1].texto, /Pagamento/);
    assert.doesNotMatch(im[1].html, />Pagamento</);
    soColaboro(['tx.view', 'tx.add', 'loan.view', 'house.edit']);
    assert.match(app.aprImagensDe('credits')[1].texto, /<b>Pagamento<\/b>/);
  });

  test('as Visitas desligadas saem do Calendário: sem pontos azuis, sem visitas no dia, sem o Marcar visita', () => {
    montar();
    app.definirServicosDesligados(['visits']);
    const im = app.aprImagensDe('calendar');
    const tudo = im.map(lido).join(' ');
    assert.doesNotMatch(tudo, /visita/i);
    assert.doesNotMatch(im.map((x) => x.html).join(''), /apr-d-pt vis/);
    assert.match(im[0].texto, /um ponto laranja nos dias com planeados/);
  });

  test('os Planeados desligados: o Calendário sem o «Por confirmar», os Movimentos sem os modelos, os Créditos pelos Movimentos', () => {
    montar();
    app.definirServicosDesligados(['recurring']);
    igual(app.aprImagensDe('calendar').map((x) => x.titulo), ['O mês de relance', 'O que tem cada dia']);
    assert.doesNotMatch(app.aprImagensDe('calendar').map(lido).join(' '), /planead|Recorrente/i);
    const mov = app.aprImagensDe('transactions')[3];
    assert.doesNotMatch(mov.texto + mov.html, /modelo/i);
    const cap = app.aprImagensDe('credits').find((x) => x.titulo === 'O capital desce a cada pagamento');
    assert.match(cap.texto, /nos <b>Movimentos<\/b>/);
    assert.doesNotMatch(app.aprImagensDe('credits').map((x) => x.texto).join(' '), /Planeados/);
  });
});

describe('os números e as datas', () => {
  test('a hipoteca fecha: a prestação é juros, selo e capital ao cêntimo, o capital desce o que ela abate, e o plano é o da app', () => {
    montar();
    const ex = app.APR_EXEMPLO, h = ex.creditos[0], p = app.aprDPrestacao(), plano = app.aprDPlano();
    assert.equal(Math.round((p.juros + p.selo + p.capital) * 100), Math.round(h.prestacao * 100));
    assert.equal(Math.round(p.depois * 100), Math.round((h.divida - p.capital) * 100));
    assert.equal(plano.anos[0], Number(app.today().slice(0, 4)), 'as barras começam no ano de hoje');
    assert.ok(plano.somas.every((v, i) => i === 0 || v <= plano.somas[i - 1]), 'a dívida só desce');
    assert.ok(plano.somas[plano.somas.length - 1] < 15000, 'e acaba quase a zero no último ano');
    assert.equal(app.rateLabel(app.aprDHipoteca()), 'Euribor 12m 2,25% + 0,85% = 3,1%');
    const html = app.aprImagensDe('credits').map((x) => x.html).join('');
    for (const v of [app.aprDinheiro(h.prestacao), app.money(h.divida), app.money(plano.juros), app.money(p.depois)]) assert.ok(html.includes(v), v + ' na maquete');
  });

  test('o mês dos Movimentos é o último fechado: as cinco rendas somam 2 425 €, da linha mais recente para a mais antiga', () => {
    montar();
    const ms = app.aprDMovimentosDoMes(-1);
    assert.equal(ms.filter((m) => m.tipo === 'income').reduce((a, m) => a + m.valor, 0), 2425);
    assert.ok(ms.every((m, i) => i === 0 || m.data <= ms[i - 1].data), 'pela data, a descer');
    assert.ok(ms.every((m) => m.data.slice(0, 7) === app.aprDNoMes(-1, 1).slice(0, 7)), 'todas no mês passado');
    const lote = ms.find((m) => m.lote);
    assert.equal(lote.lote, app.APR_EXEMPLO.imoveis.length, 'o de todos os imóveis parte-se pelos quatro');
    assert.match(app.aprImagensDe('transactions')[0].html, new RegExp(app.aprDMesCurto(-1)));
  });

  test('os Planeados: as quatro origens na lista, e por confirmar a renda em atraso do contrato e a limpeza à mão', () => {
    montar();
    const lista = app.aprImagensDe('recurring').find((x) => x.titulo === 'Cada linha diz de onde vem').html;
    for (const o of ['do contrato', 'da hipoteca', 'do imóvel', 'à mão']) assert.ok(lista.includes(o), o);
    igual(app.aprDPendentes().map((r) => r.nome).sort(), ['Limpeza das escadas', 'Renda Tomás Matos · Quarto 2']);
    const hoje = app.today();
    for (const r of app.aprDPlaneados()) {
      const d = app.aprDProxima(r);
      assert.ok(r.pendente ? d <= hoje : d > hoje, r.nome + ': por confirmar até hoje, o resto depois de hoje');
    }
  });

  test('as datas contam-se a partir de hoje: o dia do painel vem depois de hoje, e o mês do Calendário é o de hoje ou o seguinte', () => {
    montar();
    const hoje = app.today();
    assert.ok(app.aprDDiaDoPainel() > hoje);
    assert.ok([0, 1].includes(app.aprDMesDoCalendario()));
    assert.match(app.aprImagensDe('calendar')[0].html, new RegExp(app.aprDMesLongo(app.aprDMesDoCalendario())));
    // a conta dos meses atravessa os anos
    const a = app.aprDMes(0), b = app.aprDMes(12), c = app.aprDMes(-13);
    igual([b.y - a.y, b.m - a.m], [1, 0]);
    igual([c.m, c.y], [(a.m + 11) % 12, a.y - 1 - (a.m === 0 ? 1 : 0)]);
    assert.match(app.aprDTituloDia(hoje), /^Hoje, /);
    assert.match(app.aprDTituloDia(app.addDays(hoje, 1)), /^Amanhã, /);
  });
});
