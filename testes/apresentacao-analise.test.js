// As apresentações da Visão geral, da Avaliação, das Projeções, do IRS · Anexo
// F e das Definições (cloud/apresentacao-analise.js): as cinco registadas, de
// 2 a 4 imagens para cada conta; a Visão geral com a cara de cada uma — a
// jornada sem movimentos, o vazio com os passos dispensados (com imóveis, ou
// o que pede o primeiro, sem eles), os números, e o «O que podes fazer» de
// quem só colabora sem finanças —; o IRS só fora de
// produção; as maquetes sem style= nem on…=; os textos com as regras da casa e
// com os nomes que a app escreve; e os números do exemplo a fecharem entre si e
// com as regras do IRS da app. A app inteira, nuvem incluída (carregarTudo),
// com a sessão simulada em CW.user.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { carregarTudo, limpar, repor, igual } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));
afterEach(() => { app.localStorage.removeItem('gi_passos_fora'); app.definirServicosDesligados([]); });

const IDS = ['dashboard', 'reports', 'projections', 'fisco', 'settings'];

/* Uma conta com sessão e o estado do servidor, sem nada registado, fora de
   produção (o IRS existe) e com os passos da jornada por dispensar.
   Recebe: opcoes (opcional) — {ambiente}.
   Devolve: nada. */
function montar(opcoes = {}) {
  limpar(app);
  app.CW.user = { id: 'EU', name: 'Maria Costa', email: 'eu@exemplo.pt' };
  app.CW._pulled = 1; app.CW._esperaFim = 1;
  app.CW.cargos = {};
  app.CW.ambiente = opcoes.ambiente || 'percurso';
  app.localStorage.removeItem('gi_passos_fora');
}

/* Um movimento qualquer deste ano, para a Visão geral passar aos números.
   Devolve: nada. */
function comMovimentos() {
  app.db.properties.push(app.normProp({ id: 'P9', name: 'T2 Paranhos' }));
  app.db.transactions.push({ id: 'M1', kind: 'income', amount: 950, date: app.today(), label: 'Renda', propertyId: 'P9', category: 'Rendas' });
}

/* Um imóvel meu, sem movimentos.
   Devolve: nada. */
function comImovel() {
  app.db.properties.push(app.normProp({ id: 'P9', name: 'T2 Paranhos' }));
}

/* Os passos da jornada dispensados neste aparelho (guia.js:CW.passosFora).
   Devolve: nada. */
function dispensar() { app.localStorage.setItem('gi_passos_fora', '1'); }

/* As cinco caras da Visão geral, cada uma a montar a conta de novo. */
const CARAS = {
  jornada: () => montar(),
  vazio: () => { montar(); comImovel(); dispensar(); },
  nada: () => { montar(); dispensar(); },
  numeros: () => { montar(); comMovimentos(); },
  podes: () => { montar(); soColabora(['visit.view', 'visit.add']); },
};

/* Quem só colabora num imóvel de outra conta, com estas permissões.
   Recebe: perms — as permissões do cargo.
   Devolve: nada. */
function soColabora(perms) {
  app.db.properties.push(app.normProp({ id: 'P1', name: 'T2 Arroios', ownerIds: ['OUTRO'], _sharedFrom: 'Rita Lopes' }));
  app.CW.cargos = { P1: { dono: false, perms, nome: 'Gestor' } };
}

// os títulos das imagens que esta conta vê agora
const titulos = (id) => app.aprImagensDe(id).map((x) => x.titulo);

describe('o registo', () => {
  test('as cinco registadas, com nome e resumo, e cada imagem com título, texto e uma maquete de topo desta folha', () => {
    for (const id of IDS) {
      const def = app.APRESENTACOES[id];
      assert.ok(def, id + ' registada');
      assert.ok(def.nome && def.resumo, id + ': o nome e o resumo do mosaico da Ajuda');
      assert.ok(def.resumo.length <= 48, id + ': o resumo cabe em duas linhas do mosaico');
      for (const im of def.imagens) {
        assert.equal(typeof im.titulo, 'string');
        assert.ok(typeof im.texto === 'string' || typeof im.texto === 'function');
        assert.ok(im.titulo.length <= 36, id + ': título de uma linha — ' + im.titulo);
        assert.ok(app.aprTexto(im.texto).length <= 215, id + ': texto de duas ou três frases — ' + im.titulo);
        assert.match(im.maquete.name, /^aprA[A-Z]/, id + ': a maquete é desta folha');
        assert.equal(typeof app[im.maquete.name], 'function', id + ': a maquete é uma função de topo');
      }
      assert.equal(app.aprFimDe(id).rotulo, 'Percebi', id + ': acaba no «Percebi»');
    }
  });

  test('as análises e as Definições têm quatro imagens para qualquer conta; o IRS só fora de produção', () => {
    montar();
    for (const id of ['reports', 'projections', 'fisco', 'settings']) assert.equal(app.aprImagensVisiveis(id).length, 4, id);
    comMovimentos();
    for (const id of ['reports', 'projections', 'fisco', 'settings']) assert.equal(app.aprImagensVisiveis(id).length, 4, id + ' com movimentos');
    montar({ ambiente: 'producao' });
    assert.equal(app.aprImagensVisiveis('fisco').length, 0, 'em produção o IRS não tem imagens, e não abre');
    assert.ok(app.aprDaConta().indexOf('fisco') < 0, 'nem aparece na Ajuda');
    assert.ok(app.aprDaConta().indexOf('reports') > -1 && app.aprDaConta().indexOf('settings') > -1);
  });
});

describe('a Visão geral, cara a cara', () => {
  test('sem movimentos é a jornada: os primeiros passos, os números que vêm aí e a dica de dispensar', () => {
    montar();
    assert.equal(app.aprACaraDoPainel(), 'jornada');
    igual(titulos('dashboard'), ['Primeiros passos, um de cada vez', 'Os números saem dos movimentos', 'Os tutoriais ficam na Ajuda']);
  });

  test('com os passos dispensados e ainda sem movimentos é o vazio: os números que vêm aí e o «Pede atenção», com o vazio por baixo', () => {
    CARAS.vazio();
    assert.equal(app.aprACaraDoPainel(), 'vazio');
    igual(titulos('dashboard'), ['Os números saem dos movimentos', 'No cimo, o que pede atenção']);
    const atencao = app.aprImagensDe('dashboard')[1].html;
    assert.match(atencao, /Ainda não há dados para mostrar/, 'o vazio da vista, e não os indicadores');
    assert.doesNotMatch(atencao, /Prestações/);
  });

  test('sem imóveis nem movimentos e com os passos dispensados, pede o primeiro imóvel — ou diz quem liga os Imóveis', () => {
    CARAS.nada();
    assert.equal(app.aprACaraDoPainel(), 'nada');
    igual(titulos('dashboard'), ['Primeiro, um imóvel', 'Os números saem dos movimentos']);
    const im = app.aprImagensDe('dashboard')[0];
    assert.match(im.html, /Ainda não há nada registado.*Adicionar imóvel/);
    assert.match(im.texto, /<b>Adicionar imóvel<\/b>/);
    app.definirServicosDesligados(['properties']);
    const sem = app.aprImagensDe('dashboard')[0];
    assert.doesNotMatch(sem.html, /Adicionar imóvel/, 'sem os Imóveis, não há o botão');
    assert.match(sem.texto, /O serviço Imóveis está desligado nesta conta\. O suporte pode ligá-lo quando quiseres\./);
  });

  test('com movimentos são os números: os indicadores, o «Pede atenção», os gráficos e o «Personalizar painel»', () => {
    montar();
    comMovimentos();
    assert.equal(app.aprACaraDoPainel(), 'numeros');
    igual(titulos('dashboard'), ['O teu ano num relance', 'No cimo, o que pede atenção', 'Um gráfico lê-se com o dedo', 'O painel arruma-se à tua maneira']);
    assert.match(app.aprImagensDe('dashboard')[1].html, /Prestações/, 'por baixo do «Pede atenção», os indicadores');
  });

  test('quem só colabora: sem finanças, o que o cargo deixa e as contas que ficam com o dono; com elas, os números sem o «Personalizar» se não regista movimentos', () => {
    montar();
    soColabora(['visit.view', 'visit.add']);
    assert.equal(app.aprACaraDoPainel(), 'podes');
    igual(titulos('dashboard'), ['O que o teu cargo deixa fazer', 'As contas ficam com o dono']);
    const podes = app.aprImagensDe('dashboard')[0].html;
    assert.match(podes, /Rita Lopes deu-te acesso a 1 imóvel, com o cargo Gestor/, 'quem deu acesso e o cargo, da conta');
    assert.match(podes, /Marcar visita/, 'os botões que o cargo dá (acessos.js:acoesDoColaborador)');
    assert.doesNotMatch(podes, /Adicionar inquilino/, 'e só esses');

    montar();
    soColabora(['tx.view']);
    assert.equal(app.aprACaraDoPainel(), 'numeros');
    igual(titulos('dashboard'), ['O teu ano num relance', 'No cimo, o que pede atenção', 'Um gráfico lê-se com o dedo'],
      'sem tx.add não há «Personalizar painel» (painel-geral.js:dashDepois)');
    montar();
    soColabora(['tx.view', 'tx.add']);
    assert.equal(titulos('dashboard').length, 4);
  });

  test('a imagem da jornada é a da conta: o olá pelo primeiro nome e o passo de agora com o botão dele', () => {
    montar();
    const e = app.estadoDosPassos(), atual = e.ps[e.atual];
    const html = app.aprImagensDe('dashboard')[0].html;
    assert.match(html, /Olá, Maria\. Vamos adicionar as tuas casas à app\./);
    assert.ok(html.includes(app.esc(atual.titulo)) && html.includes(app.esc(atual.botao)), 'o passo de agora: ' + atual.titulo);
    assert.match(html, new RegExp(e.nFeitos + ' de ' + e.ps.length + ' feitos'));
    app.db.properties.push(app.normProp({ id: 'P9', name: 'T2 Paranhos', use: 'proprio' }));
    const depois = app.estadoDosPassos();
    assert.ok(app.aprImagensDe('dashboard')[0].html.includes(app.esc(depois.ps[depois.atual].titulo)), 'e muda com ela');
  });
});

describe('as maquetes', () => {
  test('escrevem HTML sem style= nem on…=, e nenhuma fica vazia, em nenhuma cara', () => {
    let n = 0;
    for (const cara of Object.values(CARAS)) {
      cara();
      for (const id of IDS) {
        for (const im of app.aprImagensDe(id)) {
          assert.ok(im.html.length > 300 && /^<div class="apr-cena /.test(im.html), id + ': ' + im.titulo + ' desenhada');
          assert.doesNotMatch(im.html, /style=|\son[a-z]+=|<script/i, id + ': ' + im.titulo);
          n++;
        }
      }
    }
    assert.ok(n >= 75, 'leu as imagens das cinco caras');
    // e as de todas as caras, mesmo as que esta conta não vê (a Ajuda pode mostrá-las noutra)
    montar();
    for (const id of IDS) for (const im of app.APRESENTACOES[id].imagens) assert.doesNotMatch(im.maquete(), /style=|\son[a-z]+=/);
  });

  test('as alturas das colunas e as larguras das barras vão por classes e por data-largura, e o texto passa pelo esc', () => {
    assert.match(app.aprAColunas([{ rotulo: 'jan', cima: 10, baixo: [[5, 'loan'], [5, 'out']] }]), /apr-a-h20 apr-a-in.*apr-a-h10 apr-a-loan.*apr-a-h10 apr-a-out/);
    assert.match(app.aprAAltura(1, 0), /^apr-a-h0$/);
    assert.match(app.aprAHeroi(100, 4), /data-largura="100\.0".*data-largura="80\.0"/);
    assert.match(app.aprAKpi('<x>', '1 €'), /&lt;x&gt;/);
    assert.match(app.aprATabela(['a'], [['<b>1</b>']], { alvo: 0, cols: 'mau' }), /apr-a-tabela c4.*apr-a-tl apr-alvo/);
  });
});

describe('os textos', () => {
  /* Os textos e as maquetes (sem as etiquetas) de todas as imagens, de
     todas as caras.
     Devolve: o texto. */
  function tudo() {
    return Object.values(CARAS).map((c) => { c(); return IDS.map((id) => app.aprImagensDe(id).map((x) => x.titulo + ' ' + x.texto + ' ' + x.html.replace(/<[^>]*>/g, ' ')).join(' ')).join(' '); }).join(' ');
  }

  test('seguem a casa: sem «pôr»/«tirar», sem «(s)», sem «Bem-vindo», sem ponto de exclamação, sem emojis, sem nomes de fachada', () => {
    const t = tudo();
    assert.ok(t.length > 5000, 'leu os textos e as maquetes');
    assert.doesNotMatch(t, /(^|[^\p{L}])(pôr|põe|põem|puser|tirar|tira|tiras|tirou)([^\p{L}]|$)/iu);
    assert.doesNotMatch(t, /\(s\)/);
    assert.doesNotMatch(t, /Bem-vind/i);
    assert.doesNotMatch(t, /!/);
    assert.doesNotMatch(t, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    assert.doesNotMatch(t, /João Silva|Fulano|Lorem/);
    assert.doesNotMatch(t, /dispensad[oa]|colaborador(?!es)/i, 'nada que presuma o género de quem lê');
  });

  test('o que vai a negrito é o nome que a app escreve, e o caminho é o da navegação', () => {
    const fonte = ['app', 'cloud'].flatMap((d) => readdirSync(new URL('../web/' + d + '/', import.meta.url))
      .filter((f) => f.endsWith('.js') && !f.startsWith('apresentacao'))
      .map((f) => readFileSync(new URL('../web/' + d + '/' + f, import.meta.url), 'utf8'))).join('\n');
    montar();
    const negritos = new Set();
    for (const cara of Object.values(CARAS)) {
      cara();
      for (const id of IDS) for (const im of app.aprImagensDe(id)) for (const m of im.texto.matchAll(/<b>([^<]+)<\/b>/g)) negritos.add(m[1]);
    }
    assert.ok(negritos.size >= 20, 'leu os negritos');
    for (const b of negritos) for (const parte of b.split(' → ')) assert.ok(fonte.includes(parte), '«' + parte + '» está na app');
    const nav = app.NAV_GROUPS.map((g) => g.label);
    assert.ok(nav.includes('Análise'), 'a secção da gaveta chama-se Análise');
    const rotulo = (id) => app.TABS.find((x) => x.id === id).label;
    const texto = IDS.map((id) => app.APRESENTACOES[id].imagens.map((x) => app.aprTexto(x.texto)).join(' ')).join(' ');
    for (const id of ['reports', 'projections', 'fisco']) assert.ok(texto.includes('<b>Análise → ' + rotulo(id) + '</b>'), 'Análise → ' + rotulo(id));
    assert.ok(texto.includes('<b>Ajuda → Apresentações</b>') && /cabecaDaAjuda\('Apresentações'/.test(fonte), 'a secção da Ajuda');
    assert.ok(texto.includes('<b>Ajuda → Como se faz</b>') && /cabecaDaAjuda\('Como se faz'/.test(fonte));
  });
});

describe('os números do exemplo', () => {
  test('fecham: o ano soma os meses do APR_EXEMPLO, os imóveis somam o ano, as categorias somam as despesas', () => {
    montar();
    const a = app.aprAAno(), ex = app.APR_EXEMPLO;
    assert.equal(a.receita, ex.receitaMes.reduce((x, y) => x + y, 0));
    assert.equal(a.receita, 29910);
    assert.equal(a.despesas, 6312);
    assert.equal(a.cashflow, 12534);
    assert.equal(a.valor, 808000);
    assert.equal(a.rendaMes, 2425);
    const por = app.aprAPorImovel(), soma = (k) => Object.keys(por).reduce((x, id) => x + por[id][k], 0);
    assert.equal(soma('receita'), a.receita);
    assert.equal(soma('despesas'), a.despesas);
    assert.equal(Math.round(soma('cashflow') * 100) / 100, a.cashflow);
    assert.equal(por.paranhos.receita, ex.rendaDe('paranhos') * ex.receitaMes.length, 'o T2 rende a renda do contrato em cada mês');
    assert.equal(app.aprACategorias().reduce((x, c) => x + c.valor, 0), a.despesas);
  });

  test('a projeção corta o Quarto 3 no fim dele, a dívida desce, e o IRS é o das regras da app para cada ano', () => {
    montar();
    const pj = app.aprAProjecao(), ex = app.APR_EXEMPLO;
    assert.equal(pj.anos.length, 10, 'o horizonte por omissão');
    assert.equal(pj.fimQuarto3, app.aprDia(ex.contrato('c3').terminaEm));
    const ano = Number(pj.fimQuarto3.slice(0, 4)), depois = pj.anos.find((r) => r.ano === ano + 1);
    assert.equal(depois.porContrato.c3, 0, 'depois de acabar, o contrato não rende');
    assert.ok(pj.anos.every((r, i) => !i || r.divida < pj.anos[i - 1].divida), 'a dívida desce todos os anos');
    for (const r of pj.anos) {
      const esperado = ex.contratos.reduce((x, c) => x + r.porContrato[c.id] * app.irsRate({ rent: c.renda, start: app.aprAIso(c.desde), end: '', active: true }, r.ano) / 100, 0);
      assert.ok(Math.abs(r.irs - esperado) < 0.01, r.ano + ': o IRS à taxa da versão do ano');
      assert.ok(Math.abs(r.cashflow - (r.rendas - r.irs - r.despesas - r.prestacoes)) < 0.01);
    }
  });

  test('o resumo do IRS: o líquido são as rendas menos os gastos, o imposto à taxa do ano, e o englobamento pelos escalões da app', () => {
    montar();
    const ano = app.aprAFiscoAno(), f = app.aprAFisco(ano);
    assert.equal(f.rendas, app.aprAAno().receita);
    assert.equal(Math.round((f.rendas - f.gastos) * 100) / 100, f.liquido);
    assert.equal(f.taxa, app.irsRate({ rent: 950, start: '2025-03-01', end: '', active: true }, ano));
    assert.equal(f.imposto, Math.round(f.liquido * f.taxa) / 100);
    const eng = app.irsAno(ano).englobamento;
    if (eng && eng.escaloes && eng.escaloes.length) {
      const esperado = Math.round((app.fiscoColeta(f.outros + f.liquido, eng, false) - app.fiscoColeta(f.outros, eng, false)) * 100) / 100;
      assert.equal(f.englobando, esperado);
    } else assert.equal(f.englobando, null);
  });
});
