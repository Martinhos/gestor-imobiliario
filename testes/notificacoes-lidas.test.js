// Tocar num aviso das casas no «Pede atenção» (um de CW.state.departures,
// que abre a ficha do imóvel) lê esse aviso só: sai das novas e do crachá,
// os outros novos continuam novos, o «Marcar tudo como lido» continua a
// calar tudo, e a marca vive nas definições, que se fundem chave a chave
// entre aparelhos.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, repor } from './arnes.js';
import { fundirTres } from '../worker/src/lib/permissoes.js';

const app = carregarTudo();
afterEach(() => repor(app));

const copia = (x) => JSON.parse(JSON.stringify(x));
const aviso = (id, kind, at) => ({ id, kind, houseId: 'P1', houseName: 'T2 Benfica', actorId: 'BRUNO', actorName: 'Bruno', at });

/* A conta com três avisos novos (o do ticket: «Todos aceitaram: …») e a
   marca de leitura posta antes deles; a janela e a ficha não abrem a sério. */
function monta() {
  app.CW = { user: { id: 'EU' }, state: { departures: [
    aviso('e1', 'transf.aceite', 7000), aviso('e2', 'casa.sair', 6000), aviso('e3', 'casa.novo_dono', 5000)] } };
  app.window.CW = app.CW;
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Benfica' })];
  app.db.tenants = []; app.db.visits = []; app.db.recurring = []; app.db.transactions = [];
  app.db.settings.notifLidoAte = 1000;
  delete app.db.settings.notifLidos;
  app.closeModal = () => {}; app.render = () => {};
  const abertas = [];
  app.propView = (id) => { abertas.push(id); };
  return abertas;
}

/* O data-click da linha do sino com este título, tal como a janela a pinta.
   Recebe: titulo — o texto da linha.
   Devolve: a ação (texto), ou null. */
function toqueDaLinha(titulo) {
  let corpo = '';
  const openReal = app.openModal;
  app.openModal = (t, b) => { corpo = b; };
  try { app.notifModal(''); } finally { app.openModal = openReal; }
  const linhas = corpo.split('<button type="button" class="atencao-linha tap"').slice(1);
  const l = linhas.find((x) => x.includes(titulo));
  const m = l && l.match(/data-click="([^"]*)"/);
  return m ? m[1] : null;
}

const ids = () => copia(app.notifSaidas()).map((n) => n.id);

describe('tocar num aviso das casas lê esse aviso', () => {
  test('o do ticket: tocar abre a ficha e tira-o das novas e do crachá; os outros ficam novos', () => {
    const abertas = monta();
    assert.deepEqual(ids(), ['e1', 'e2', 'e3']);
    assert.equal(app.notifConta(), 3);
    const acao = toqueDaLinha('Todos aceitaram: Bruno passou a gerir T2 Benfica.');
    assert.ok(acao, 'a linha é um botão');
    app.correrAcao(acao, null, null);
    assert.deepEqual(abertas, ['P1'], 'abre a ficha do imóvel');
    assert.deepEqual(ids(), ['e2', 'e3'], 'o tocado sai; os mais velhos continuam novos');
    assert.equal(app.notifConta(), 2, 'o crachá deixa de o contar');
    assert.equal(app.db.settings.notifLidoAte, 1000, 'a marca temporal não mexe');
    assert.deepEqual(copia(app.db.settings.notifLidos), { e1: 1 });
  });

  test('tocar um do meio não cala o mais novo', () => {
    monta();
    app.correrAcao(toqueDaLinha('Bruno deixou de ser comproprietário de T2 Benfica.'), null, null);
    assert.deepEqual(ids(), ['e1', 'e3']);
  });

  test('um aviso que chega depois do tocado é novo', () => {
    monta();
    app.notifLerAviso('e1');
    app.CW.state.departures.unshift(aviso('e4', 'transf.recusada', 8000));
    assert.deepEqual(ids(), ['e4', 'e2', 'e3']);
  });

  test('«Marcar tudo como lido» continua a calar tudo', () => {
    monta();
    app.notifLerAviso('e1');
    app.notifLido();
    assert.deepEqual(ids(), []);
    assert.equal(app.notifConta(), 0);
  });

  test('a chave guarda só os ids que o servidor ainda manda; sem a lista, não poda', () => {
    monta();
    app.db.settings.notifLidos = { velho: 1, e2: 1 };
    app.notifLerAviso('e1');
    assert.deepEqual(copia(app.db.settings.notifLidos), { e1: 1, e2: 1 }, 'o de fora da janela sai');
    app.CW.state = {};
    app.notifLerAviso('e3');
    assert.deepEqual(copia(app.db.settings.notifLidos), { e1: 1, e2: 1, e3: 1 }, 'sem departures, junta e não poda');
    app.notifLerAviso(''); app.notifLerAviso(null);
    assert.deepEqual(Object.keys(app.db.settings.notifLidos).sort(), ['e1', 'e2', 'e3'], 'sem id não faz nada');
  });

  test('um valor estranho na chave (lista, texto) não rebenta e vale como vazio', () => {
    monta();
    app.db.settings.notifLidos = ['e1'];
    assert.deepEqual(ids(), ['e1', 'e2', 'e3']);
    app.db.settings.notifLidos = 'e1';
    assert.deepEqual(ids(), ['e1', 'e2', 'e3']);
  });

  test('a marca sobe com as definições e sobrevive a outro aparelho: a fusão a três junta as leituras dos dois', () => {
    monta();
    // o que este aparelho leu do servidor, e o que manda depois de tocar e1
    const base = copia(app.strip(app.db.settings));
    app.notifLerAviso('e1');
    const chega = copia(app.strip(app.db.settings));
    assert.deepEqual(chega.notifLidos, { e1: 1 }, 'a chave sobe (sem «_», o strip não a tira)');
    // entretanto o telemóvel tocou o e2 e já gravou
    const atual = Object.assign(copia(base), { notifLidos: { e2: 1 } });
    const fundido = fundirTres(base, chega, atual);
    assert.deepEqual(fundido.notifLidos, { e2: 1, e1: 1 }, 'no servidor ficam as duas');
    assert.deepEqual(copia(app.fundirTres(base, chega, atual).notifLidos), { e2: 1, e1: 1 }, 'e no cliente, a mesma letra');
    // o outro aparelho recebe as definições fundidas
    app.db.settings = Object.assign({}, app.blank.settings, copia(fundido));
    assert.deepEqual(ids(), ['e3']);
    assert.equal(app.notifConta(), 1);
  });
});
