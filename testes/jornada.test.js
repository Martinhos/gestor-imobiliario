// A jornada na vista geral: enquanto não há movimentos, a vista é o cartão
// dos primeiros passos — as boas-vindas e a lista dos passos, com o atual em
// destaque e os seus botões (o canvas M-PrimeirosPassos) — mais o portefólio
// quando há imóveis, em vez de quatro indicadores a 0 € e dois gráficos
// vazios (cloud/guia.js:jornadaInicial, painel-geral.js:vDashboard). Com o
// primeiro movimento os indicadores voltam e o cartão fica no topo, uma vez
// só, sem as boas-vindas. A app inteira, nuvem incluída (carregarTudo), com
// a sessão simulada em CW.user, como no revisao-cliente.test.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { carregarTudo, limpar, elementos, igual } from './arnes.js';

/* A app inteira, limpa, com sessão e já depois do primeiro estado (o que
   estiver vazio está mesmo vazio).
   Recebe: opcoes (opcional) — {semSessao: true} deixa CW.user a null.
   Devolve: o proxy da app. */
function montar(opcoes = {}) {
  const app = carregarTudo();
  limpar(app);
  app.CW.user = opcoes.semSessao ? null : { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt', token: 't' };
  app.CW._pulled = 1; app.CW._esperaFim = 1;
  return app;
}

/* O meu registo de proprietário com NIF (o passo do perfil fica feito) e,
   se pedido, um imóvel de arrendamento sem contrato.
   Recebe: app — o proxy; comImovel — true para semear o imóvel.
   Devolve: nada — escreve na db. */
function semear(app, comImovel) {
  app.db.owners.push(app.normPerson({ id: 'EU', name: 'Eu', nif: '123456789' }));
  if (comImovel) app.db.properties.push(app.normProp({ id: 'P1', name: 'T2 Arroios', use: 'investimento', value: 200000, purchase: 150000, ownerIds: ['EU'] }));
}

// os <li> da lista dos passos, pela ordem: {classe, atual, circulo, img, rotulo (o título), resto (o que vem depois do título)}
const fita = (html) => [...html.matchAll(/<li class="jornada-passo([^"]*)"( aria-current="step")?><span class="jornada-n"([^>]*)>([\s\S]*?)<\/span><span class="jornada-txt"><b class="jornada-l">([^<]*)<\/b>([\s\S]*?)<\/span><\/li>/g)]
  .map((m) => ({ classe: m[1].trim(), atual: !!m[2], circulo: m[4], rotulo: m[5], img: m[3], resto: m[6] }));
const vezes = (html, s) => html.split(s).length - 1;
const PERFIL = 'Preenche o teu perfil', IMOVEIS = 'Adiciona os teus imóveis', CONTRATOS = 'Regista os contratos', MOVS = 'Confirma os primeiros movimentos';

describe('a jornada no lugar da vista geral', () => {
  test('com um imóvel e nenhum movimento: nem indicadores nem gráficos — a jornada, com os imóveis feitos e os contratos como passo atual, e o portefólio', () => {
    const app = montar();
    semear(app, true);
    const html = app.vDashboard();
    assert.match(html, /<!--jornada-->/, 'a marca da jornada');
    assert.doesNotMatch(html, /class="grid"|Receita|Cashflow|Entradas e saídas|chartbox|donutCard/, 'sem a fila dos indicadores nem os gráficos');
    assert.doesNotMatch(html, /Ainda não há nada registado/);
    const passos = fita(html);
    igual(passos.map((p) => [p.rotulo, p.classe]), [[PERFIL, 'feito'], [IMOVEIS, 'feito'], [CONTRATOS, 'atual'], [MOVS, '']]);
    assert.ok(passos[2].atual, 'o passo atual leva aria-current="step"');
    assert.equal(passos.filter((p) => p.atual).length, 1, 'e só ele');
    // o portefólio reduzido ao que tem números: com o número de imóveis e sem as linhas que seriam zeros
    assert.match(html, /<div class="title">Portefólio<\/div>/);
    assert.match(html, /<span>Imóveis<\/span><b>1<\/b>/);
    assert.match(html, /<span>Valor de mercado<\/span><b>200/);
    assert.match(html, /<span>Património líquido<\/span>/);
    assert.doesNotMatch(html, /Contratos ativos|Renda contratada|mais-valias/);
    assert.equal(vezes(html, 'Primeiros passos'), 1, 'o cartão dos passos uma vez só');
  });

  test('sem imóveis nem movimentos: a jornada substitui o vazio, e o passo atual é o dos imóveis com «Adicionar imóvel» a abrir o formulário do imóvel', () => {
    const app = montar();
    semear(app, false);
    const html = app.vDashboard();
    assert.match(html, /<!--jornada-->/);
    assert.doesNotMatch(html, /Ainda não há nada registado|class="empty"/, 'o vazio antigo saiu');
    const passos = fita(html);
    igual(passos.map((p) => [p.rotulo, p.classe]), [[PERFIL, 'feito'], [IMOVEIS, 'atual'], [MOVS, '']]);
    assert.match(html, /<button type="button" class="btn primary" data-toca="camada" data-click="propModal\(\)"><svg[^>]*>[\s\S]*?<\/svg>Adicionar imóvel<\/button>/);
    assert.match(html, /<span class="small num">1 de 3 feitos<\/span>/, 'a conta do que está feito');
    assert.match(html, /role="progressbar" aria-labelledby="ppTitulo" aria-valuemin="0" aria-valuemax="3" aria-valuenow="1"/, 'e a barra diz o mesmo');
    assert.match(html, /<span data-largura="33\.3"><\/span>/, 'com a largura da parte feita');
    assert.doesNotMatch(html, /Portefólio/, 'sem imóveis não há portefólio');
  });

  test('só o passo atual tem os botões, com o verbo da ação e o tutorial dele («Como se faz · N passos»)', () => {
    const app = montar();
    semear(app, true);
    let html = app.vDashboard();
    assert.equal(vezes(html, 'class="jornada-acoes"'), 1, 'um só passo com botões');
    const passos = fita(html);
    assert.equal(passos[2].rotulo, CONTRATOS, 'o título do passo atual');
    assert.match(passos[2].resto, /<span class="jornada-porque">1 imóvel para arrendar ainda sem contrato\.<\/span>/, 'e o porquê');
    assert.match(passos[2].resto, /data-toca="camada" data-click="ctModal\(\)"><svg[\s\S]*?<\/svg>Adicionar contrato<\/button>/);
    assert.match(passos[2].resto, /data-toca="ecra" data-click="CW\.guiaAbrir\('contratos'\)">Como se faz · 3 passos</);
    assert.doesNotMatch(html, /guiaAbrir\('(?:perfil|imoveis|movimentos)'\)/, 'os outros passos não têm botões');
    // os feitos dizem o que já se fez, riscados pelo CSS; os que faltam, o porquê
    assert.equal(passos[0].resto, '<span class="small">Nome e NIF preenchidos.</span>');
    assert.equal(passos[1].resto, '<span class="small">1 imóvel adicionado.</span>');
    assert.equal(passos[3].resto, '<span class="small">É daqui que saem os números da Visão geral.</span>');
    // visto até ao fim, o botão passa a «Rever o tutorial»
    app.localStorage.setItem('gi_guia_feitos', JSON.stringify({ contratos: 1 }));
    html = app.vDashboard();
    assert.match(html, /data-click="CW\.guiaAbrir\('contratos'\)">Rever o tutorial</);
  });

  test('a lista: o título em cada passo, o visto nos feitos (anunciado «Feito») e o número nos outros, e «Dispensar os primeiros passos» por baixo', () => {
    const app = montar();
    semear(app, true);
    const html = app.vDashboard();
    assert.match(html, /<ol class="jornada" role="list">/, 'é uma lista');
    const passos = fita(html);
    assert.equal(passos.length, 4);
    const visto = app.ic('check', 16);
    assert.equal(passos[0].circulo, visto, 'o perfil, feito, leva o visto');
    assert.equal(passos[0].img, ' role="img" aria-label="Feito"');
    assert.equal(passos[1].circulo, visto);
    assert.equal(passos[2].circulo, '3', 'o atual leva o número');
    assert.equal(passos[2].img, '');
    assert.equal(passos[3].circulo, '4');
    assert.match(html, /<h2 id="ppTitulo">Primeiros passos<\/h2><span class="small num">2 de 4 feitos<\/span>/, 'o título diz quantos estão feitos');
    assert.match(html, /<\/section><button type="button" class="btn ghost pp-fora" data-toca="vista" data-click="CW\.passosFora\(\)">Dispensar os primeiros passos<\/button><\/div>/, 'o dispensar fica, por baixo do cartão');
  });

  /* O canvas (M-PrimeirosPassos) pinta o círculo do passo atual cheio de
     cobalto. Na fita de antes ele era transparente, e o traço que ligava os
     passos passava-lhe por cima: a lista não tem traço, e o círculo do atual
     tem fundo. */
  test('o círculo do passo atual é cheio, e já não há traço que lhe passe por cima', () => {
    const css = fs.readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(css, /\.jornada-passo\.atual \.jornada-n\{background:var\(--accent\);border-color:var\(--accent\);color:var\(--accent-ink\)\}/);
    assert.match(css, /\.jornada-passo\.feito \.jornada-n\{background:var\(--in-soft\)/, 'o feito, verde suave');
    assert.doesNotMatch(css, /\.jornada-passo::before/, 'sem o traço da fita');
  });

  test('com um movimento os indicadores voltam e o cartão dos passos fica por cima, uma vez só e sem as boas-vindas', () => {
    const app = montar();
    semear(app, true);
    app.db.transactions.push(app.normTx({ id: 'X1', kind: 'income', category: 'Rendas', amount: 800, propertyId: 'P1', date: app.YEAR + '-01-05' }));
    const html = app.vDashboard();
    assert.doesNotMatch(html, /<!--jornada-->/);
    assert.match(html, /class="grid"/, 'a fila dos indicadores');
    assert.match(html, /Receita/);
    assert.equal(vezes(html, 'Primeiros passos'), 1, 'uma vez só');
    assert.ok(html.indexOf('Primeiros passos') < html.indexOf('class="grid"'), 'e por cima');
    assert.doesNotMatch(html, /pp-boas|Vamos adicionar/, 'as boas-vindas são só da jornada');
    const passos = fita(html);
    igual(passos.map((p) => [p.rotulo, p.classe]), [[PERFIL, 'feito'], [IMOVEIS, 'feito'], [CONTRATOS, 'atual'], [MOVS, 'feito']]);
    assert.equal(passos[3].resto, '<span class="small">1 movimento registado.</span>');
    assert.equal(app.jornadaInicial(), '', 'com movimentos a jornada não substitui a vista');
  });

  test('a jornada abre com as boas-vindas: o olá pelo primeiro nome e por onde se começa — ou se continua', () => {
    const app = montar();
    app.CW.user.name = 'Maria Costa';
    semear(app, false);
    app.db.owners[0].nif = '';   // nada feito: o perfil é o primeiro
    let html = app.vDashboard();
    assert.match(html, /<section class="pp-boas" aria-label="Boas-vindas"><div class="pp-boas-mosaico imv-mosaico imv-t0" aria-hidden="true"><\/div>/);
    assert.match(html, /<h2>Olá, Maria\. Vamos adicionar as tuas casas à app\.<\/h2>/);
    assert.match(html, /<p>Os números da Visão geral saem dos movimentos\. Começa pelo teu perfil; o resto vem a seguir\.<\/p>/);
    app.db.owners[0].nif = '123456789';
    html = app.vDashboard();
    assert.match(html, /Continua pelos imóveis; o resto vem a seguir\./);
    // sem nome, só o olá
    app.CW.user.name = '';
    assert.match(app.vDashboard(), /<h2>Olá\. Vamos adicionar/);
  });

  test('dispensado (gi_passos_fora) e sem movimentos: nem indicadores a 0 nem gráficos — o vazio que leva aos Movimentos, e o portefólio', () => {
    const app = montar();
    semear(app, true);
    app.localStorage.setItem('gi_passos_fora', '1');
    const html = app.vDashboard();
    assert.doesNotMatch(html, /<!--jornada-->|Primeiros passos|jornada-passo/);
    assert.doesNotMatch(html, /class="grid"|Receita|Entradas e saídas|chartbox/, 'sem a fila dos indicadores nem os gráficos');
    assert.match(html, /<!--sem-movimentos-->/);
    assert.match(html, /<div class="empty[^"]*"><b>Ainda não há dados para mostrar<\/b>/);
    assert.match(html, /<button type="button" class="btn primary" data-toca="ecra" data-click="go\('transactions'\)">Ir para os movimentos<\/button>/);
    assert.match(html, /<span>Imóveis<\/span><b>1<\/b>/, 'o portefólio fica');
    assert.equal(app.jornadaInicial(), '');
    assert.equal(app.cartaoPassos(), '');
    // com os Movimentos desligados nesta conta, o botão não se escreve e a frase diz quem os liga
    app.definirServicosDesligados(['transactions']);
    const sem = app.vDashboard();
    assert.match(sem, /Ainda não há dados para mostrar/);
    assert.doesNotMatch(sem, /go\('transactions'\)/);
    assert.match(sem, /O serviço Movimentos está desligado nesta conta\./);
    // com o primeiro movimento os indicadores voltam
    app.definirServicosDesligados([]);
    app.db.transactions.push(app.normTx({ id: 'X1', kind: 'income', category: 'Rendas', amount: 800, propertyId: 'P1', date: app.YEAR + '-01-05' }));
    const com = app.vDashboard();
    assert.match(com, /class="grid"/);
    assert.doesNotMatch(com, /Ainda não há dados para mostrar|<!--sem-movimentos-->/);
  });

  test('o vazio sem movimentos não escreve o «Personalizar painel», mas escreve o FAB do movimento', () => {
    const app = montar();
    semear(app, true);
    app.localStorage.setItem('gi_passos_fora', '1');
    const fixos = elementos(app);
    fixos.view.innerHTML = app.vDashboard();
    app.dashDepois();
    assert.doesNotMatch(fixos.view.innerHTML, /Personalizar painel/);
    assert.match(fixos.view.innerHTML, /newTxPick\(\)/);
  });

  test('quem só colabora não vê a jornada no lugar da vista: «O que podes fazer» primeiro, os passos a seguir', () => {
    const app = montar();
    app.db.properties = ['P1', 'P2'].map((id, i) =>
      Object.assign(app.normProp({ id, name: 'T' + (i + 1) + ' Rui', ownerIds: ['rui'] }), { _sharedFrom: 'Rui', _ownerUserId: 'rui', _cargo: 'Cargo ' + id }));
    app.db.owners = [app.normPerson({ id: 'EU', name: 'Eu' }), Object.assign(app.normPerson({ id: 'rui', name: 'Rui' }), { _userId: 'rui' })];
    const cs = {};
    ['P1', 'P2'].forEach((id) => { cs[id] = { dono: false, nome: 'Cargo ' + id, perms: ['visit.view', 'visit.add'] }; });
    Object.assign(app.CW, { cargos: cs, pessoas: {} });
    assert.ok(app.souSoColaborador(), 'controlo: só colabora');
    assert.equal(app.jornadaInicial(), '');
    const html = app.vDashboard();
    assert.doesNotMatch(html, /<!--jornada-->/);
    assert.ok(html.indexOf('O que podes fazer') > -1 && html.indexOf('Primeiros passos') > html.indexOf('O que podes fazer'), 'os passos vêm a seguir ao «O que podes fazer»');
    igual(fita(html).map((p) => [p.rotulo, p.classe]), [['Marca a primeira visita', 'atual']]);
    assert.doesNotMatch(html, /pp-boas/, 'sem as boas-vindas de dono');
  });

  test('sem CW.user a jornada aparece na mesma, sem o passo do perfil, e nada rebenta', () => {
    const app = montar({ semSessao: true });
    app.db.properties.push(app.normProp({ id: 'P1', name: 'T2 Arroios', use: 'investimento', value: 100000, purchase: 90000, ownerIds: [] }));
    assert.equal(app.CW.user, null, 'controlo');
    const ids = JSON.parse(JSON.stringify(app.passos().map((p) => p.id)));
    assert.deepEqual(ids, ['imoveis', 'contratos', 'movimentos']);
    const html = app.vDashboard();
    assert.match(html, /<!--jornada-->/);
    assert.doesNotMatch(html, /Perfil|editProfile/);
    igual(fita(html).map((p) => [p.rotulo, p.classe]), [[IMOVEIS, 'feito'], [CONTRATOS, 'atual'], [MOVS, '']]);
    assert.match(html, /1 de 3 feitos/);
    assert.match(html, /<h2>Olá\. Vamos adicionar as tuas casas à app\.<\/h2>/, 'sem sessão não há nome');
    assert.match(html, /<span>Imóveis<\/span><b>1<\/b>/);
  });

  test('um pedido por responder fica por cima da jornada', () => {
    const app = montar();
    semear(app, true);
    Object.assign(app.CW.state, { shareRequests: { incoming: [{ id: 'R1', fromName: 'Ana', houseName: 'T2 Lisboa', createdAt: 1 }], outgoing: [] }, connections: [] });
    assert.notEqual(app.pedidosDashCard(), '', 'controlo: há um pedido');
    const html = app.vDashboard();
    assert.match(html, /<!--jornada-->/);
    assert.ok(html.indexOf('Pedidos por responder') > -1, 'o cartão dos pedidos está');
    assert.ok(html.indexOf('Pedidos por responder') < html.indexOf('Primeiros passos'), 'e por cima da jornada');
    assert.equal(vezes(html, 'Primeiros passos'), 1, 'sem inserção dupla');
  });

  test('a espera do servidor continua a ganhar: antes do primeiro estado, nem jornada nem vazio', () => {
    const app = montar();
    app.CW._esperaFim = 0;
    const html = app.vDashboard();
    assert.match(html, /À espera do servidor/);
    assert.doesNotMatch(html, /<!--jornada-->|Primeiros passos|Ainda não há nada registado/);
  });

  test('nenhum estilo nem evento em linha no HTML da jornada; cada botão tem a sua ação e família', () => {
    const app = montar();
    semear(app, true);
    const html = app.vDashboard();
    assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/);
    const botoes = html.match(/<button[^>]*>/g) || [];
    assert.ok(botoes.length >= 3, 'a ação do passo, o «Como se faz» e o «Dispensar»: ' + botoes.length);
    for (const b of botoes) {
      assert.match(b, /data-click="[^"]+"/, b);
      assert.match(b, /data-toca="(?:vista|camada|ecra)"/, b);
    }
  });

  test('o «depois» da vista geral não escreve o «Personalizar painel» na jornada (não há blocos para arrumar), mas escreve o FAB do movimento', () => {
    const app = montar();
    semear(app, true);
    const fixos = elementos(app);
    fixos.view.innerHTML = app.vDashboard();
    app.dashDepois();
    assert.doesNotMatch(fixos.view.innerHTML, /Personalizar painel/);
    assert.match(fixos.view.innerHTML, /newTxPick\(\)/, 'o FAB fica: o movimento é o passo seguinte');
    // e com movimentos, o botão volta
    app.db.transactions.push(app.normTx({ id: 'X1', kind: 'income', category: 'Rendas', amount: 800, propertyId: 'P1', date: app.YEAR + '-01-05' }));
    fixos.view.innerHTML = app.vDashboard();
    app.dashDepois();
    assert.match(fixos.view.innerHTML, /Personalizar painel/);
  });

  test('jornadaInicial devolve o cartão dos passos com as boas-vindas, e vazio quando não há passos por fazer', () => {
    const app = montar();
    semear(app, true);
    assert.equal(app.jornadaInicial(), app.cartaoPassos(true));
    assert.ok(app.jornadaInicial().startsWith('<div class="pp-jornada pp-com-boas"><section class="pp-boas"'), 'abre com as boas-vindas');
    assert.ok(!app.cartaoPassos().includes('pp-boas'), 'o cartão sozinho (o que vai por cima dos indicadores) não as tem');
    assert.notEqual(app.jornadaInicial(), '');
    // tudo feito (um contrato e um movimento): nem o cartão nem a jornada
    app.db.tenants.push(app.normPerson({ id: 'T1', name: 'Tiago' }));
    app.db.contracts.push(app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'P1', tenantIds: ['T1'], rent: 800, start: (app.YEAR - 1) + '-01-01', active: true }));
    app.db.transactions.push(app.normTx({ id: 'X1', kind: 'income', category: 'Rendas', amount: 800, propertyId: 'P1', contractId: 'C1', date: app.YEAR + '-01-05' }));
    assert.equal(app.cartaoPassos(), '');
    assert.equal(app.jornadaInicial(), '');
    assert.doesNotMatch(app.vDashboard(), /Primeiros passos|<!--jornada-->/);
  });
});

/* O cartão do tutorial flutua por cima da app (cloud/guia.js:guiaAjustar).
   Por cima de uma lista tapava o último registo, que nunca saía de trás dele;
   por cima de uma janela, encostado ao topo, tapava o título, o ✕ e o
   primeiro campo. Agora o body diz que ele está lá (com-guia; guia-sobre com
   uma janela aberta) e a altura medida do cartão (--guia-alto), e a folha de
   estilos guarda-lhe o espaço. */
describe('o tutorial guarda o seu espaço', () => {
  test('aberto, o body leva com-guia e a altura do cartão; com uma janela aberta, guia-sobre; fechado, sai tudo', () => {
    const app = montar();
    const cls = new Set(), vars = {};
    app.document.body.classList = {
      add: (c) => { cls.add(c); }, remove: (c) => { cls.delete(c); }, contains: (c) => cls.has(c),
      toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); },
    };
    app.document.body.style.setProperty = (k, v) => { vars[k] = v; };
    app.document.getElementById('cwGuia').offsetHeight = 281.4;
    let janela = false;
    app.document.querySelector = (s) => (s === '.modal.open' && janela ? {} : null);
    app.go = () => {};
    app.CW.guiaAbrir('imoveis');
    assert.ok(cls.has('com-guia') && !cls.has('guia-sobre'), [...cls].join(' '));
    assert.equal(vars['--guia-alto'], '282px', 'a altura do cartão, arredondada para cima');
    janela = true;
    app.guiaAjustar();
    assert.ok(cls.has('guia-sobre'), 'com uma janela aberta');
    janela = false;
    app.guiaAjustar();
    assert.ok(!cls.has('guia-sobre') && cls.has('com-guia'), 'a janela fechou, o tutorial continua');
    app.CW.guiaFechar();
    assert.equal(cls.size, 0, 'fechado o tutorial, a página e as janelas deixam de lhe guardar espaço');
  });

  test('a folha de estilos guarda o espaço no telemóvel e no tablet: o fim da página e a janela abaixo do cartão, com o par vh/dvh', () => {
    const css = fs.readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8');
    assert.match(css, /@media\(max-width:899px\)\{body\.com-guia #view\{padding-bottom:calc\(var\(--guia-alto,300px\) \+ 104px \+ var\(--inset-bottom\)\)\}\}/);
    assert.match(css, /@media\(max-width:520px\)\{body\.guia-sobre \.sheet\{max-height:calc\(100vh - var\(--guia-alto,300px\) - 24px - var\(--inset-top\)\);max-height:calc\(100dvh - var\(--guia-alto,300px\) - 24px - var\(--inset-top\)\)\}\}/);
    assert.match(css, /@media\(min-width:521px\) and \(max-width:899px\)\{body\.guia-sobre \.sheet\{top:calc\(50% \+ \(var\(--guia-alto,300px\) \+ 24px \+ var\(--inset-top\)\) \/ 2\)/);
  });
});
