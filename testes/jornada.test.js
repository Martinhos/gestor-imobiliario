// A jornada na vista geral: enquanto não há movimentos, a vista é o cartão
// dos primeiros passos — a fita com o atual em destaque e o seu botão — mais
// o portefólio quando há imóveis, em vez de quatro indicadores a 0 € e dois
// gráficos vazios (cloud/guia.js:jornadaInicial, painel-geral.js:vDashboard).
// Com o primeiro movimento os indicadores voltam e o cartão fica no topo,
// uma vez só. A app inteira, nuvem incluída (carregarTudo), com a sessão
// simulada em CW.user, como no revisao-cliente.test.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
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

// os <li> da fita, pela ordem: {classe, atual, circulo, rotulo}
const fita = (html) => [...html.matchAll(/<li class="jornada-passo([^"]*)"( aria-current="step")?><span class="jornada-n"([^>]*)>([\s\S]*?)<\/span><span class="jornada-l">([^<]*)<\/span><\/li>/g)]
  .map((m) => ({ classe: m[1].trim(), atual: !!m[2], circulo: m[4], rotulo: m[5], img: m[3] }));
const vezes = (html, s) => html.split(s).length - 1;

describe('a jornada no lugar da vista geral', () => {
  test('com um imóvel e nenhum movimento: nem indicadores nem gráficos — a jornada, com os imóveis feitos e os contratos como passo atual, e o portefólio', () => {
    const app = montar();
    semear(app, true);
    const html = app.vDashboard();
    assert.match(html, /<!--jornada-->/, 'a marca da jornada');
    assert.doesNotMatch(html, /class="grid"|Receita|Cashflow|Entradas e saídas|chartbox|donutCard/, 'sem a fila dos indicadores nem os gráficos');
    assert.doesNotMatch(html, /Ainda não há nada registado/);
    const passos = fita(html);
    igual(passos.map((p) => [p.rotulo, p.classe]), [['Perfil', 'feito'], ['Imóveis', 'feito'], ['Contratos', 'atual'], ['Movimentos', '']]);
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

  test('sem imóveis nem movimentos: a jornada substitui o vazio, e o passo atual é o dos imóveis com «Fazer agora» a abrir o formulário do imóvel', () => {
    const app = montar();
    semear(app, false);
    const html = app.vDashboard();
    assert.match(html, /<!--jornada-->/);
    assert.doesNotMatch(html, /Ainda não há nada registado|class="empty"/, 'o vazio antigo saiu');
    const passos = fita(html);
    igual(passos.map((p) => [p.rotulo, p.classe]), [['Perfil', 'feito'], ['Imóveis', 'atual'], ['Movimentos', '']]);
    assert.match(html, /<button class="btn sm primary" data-toca="camada" data-click="propModal\(\)">Fazer agora<\/button>/);
    assert.match(html, /Passo 2 de 3 · sugestões, não obrigações/);
    assert.doesNotMatch(html, /Portefólio/, 'sem imóveis não há portefólio');
  });

  test('só o passo atual tem os botões, e o «Como se faz» abre o tutorial dele', () => {
    const app = montar();
    semear(app, true);
    let html = app.vDashboard();
    assert.equal(vezes(html, 'Fazer agora'), 1, 'um só «Fazer agora»');
    assert.match(html, /<b>Regista os contratos<\/b>/, 'o título do passo atual');
    assert.match(html, /1 imóvel para arrendar ainda sem contrato\./, 'e o porquê');
    assert.match(html, /data-toca="camada" data-click="ctModal\(\)">Fazer agora/);
    assert.match(html, /data-toca="ecra" data-click="CW\.guiaAbrir\('contratos'\)">Como se faz</);
    assert.doesNotMatch(html, /guiaAbrir\('(?:perfil|imoveis|movimentos)'\)/, 'os outros passos não têm botões');
    // visto até ao fim, o botão passa a «Rever o tutorial»
    app.localStorage.setItem('gi_guia_feitos', JSON.stringify({ contratos: 1 }));
    html = app.vDashboard();
    assert.match(html, /data-click="CW\.guiaAbrir\('contratos'\)">Rever o tutorial</);
  });

  test('a fita: o rótulo curto em cada passo, o visto nos feitos (anunciado «Feito») e o número nos outros', () => {
    const app = montar();
    semear(app, true);
    const html = app.vDashboard();
    assert.match(html, /<ol class="jornada" role="list">/, 'é uma lista');
    const passos = fita(html);
    assert.equal(passos.length, 4);
    const visto = app.ic('check', 13);
    assert.equal(passos[0].circulo, visto, 'o perfil, feito, leva o visto');
    assert.equal(passos[0].img, ' role="img" aria-label="Feito"');
    assert.equal(passos[1].circulo, visto);
    assert.equal(passos[2].circulo, '3', 'o atual leva o número');
    assert.equal(passos[2].img, '');
    assert.equal(passos[3].circulo, '4');
    assert.match(html, /Passo 3 de 4 · sugestões, não obrigações/, 'o subtítulo diz o passo atual');
    assert.match(html, /aria-label="Dispensar" data-toca="vista" data-click="CW\.passosFora\(\)"/, 'o ✕ de dispensar fica');
  });

  test('com um movimento os indicadores voltam e o cartão dos passos fica por cima, uma vez só', () => {
    const app = montar();
    semear(app, true);
    app.db.transactions.push(app.normTx({ id: 'X1', kind: 'income', category: 'Rendas', amount: 800, propertyId: 'P1', date: app.YEAR + '-01-05' }));
    const html = app.vDashboard();
    assert.doesNotMatch(html, /<!--jornada-->/);
    assert.match(html, /class="grid"/, 'a fila dos indicadores');
    assert.match(html, /Receita/);
    assert.equal(vezes(html, 'Primeiros passos'), 1, 'uma vez só');
    assert.ok(html.indexOf('Primeiros passos') < html.indexOf('class="grid"'), 'e por cima');
    const passos = fita(html);
    igual(passos.map((p) => [p.rotulo, p.classe]), [['Perfil', 'feito'], ['Imóveis', 'feito'], ['Contratos', 'atual'], ['Movimentos', 'feito']]);
    assert.equal(app.jornadaInicial(), '', 'com movimentos a jornada não substitui a vista');
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
    igual(fita(html).map((p) => [p.rotulo, p.classe]), [['Visita', 'atual']]);
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
    igual(fita(html).map((p) => [p.rotulo, p.classe]), [['Imóveis', 'feito'], ['Contratos', 'atual'], ['Movimentos', '']]);
    assert.match(html, /Passo 2 de 3/);
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
    assert.ok(botoes.length >= 3, 'o ✕, o «Fazer agora» e o «Como se faz»: ' + botoes.length);
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

  test('jornadaInicial devolve o mesmo cartão que cartaoPassos, e vazio quando não há passos por fazer', () => {
    const app = montar();
    semear(app, true);
    assert.equal(app.jornadaInicial(), app.cartaoPassos());
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
