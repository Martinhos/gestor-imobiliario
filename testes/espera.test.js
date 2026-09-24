// A espera pelo primeiro estado do servidor, e o que a app pode dizer
// enquanto ela dura. «Não tens nada» e «ainda não sabemos» são coisas
// diferentes: a base local vive numa chave só, e quem entra numa conta
// diferente da que usou o aparelho recebe-a apagada de propósito — dizer-lhe
// «Ainda não há nada registado» é mentira que parece perda de dados.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));

// uma sessão iniciada, ainda sem o primeiro estado do servidor
function aEsperar() {
  app.CW = { user: { id: 'EU' }, ambiente: 'producao' };
  app.window.CW = app.CW;
  app.db.properties = []; app.db.transactions = []; app.db.contracts = [];
  app.db.tenants = []; app.db.owners = []; app.db.visits = [];
  app.db.recurring = []; app.db.templates = [];
}

describe('à espera do servidor', () => {
  test('com sessão e nada em casa, diz que está à espera — e não que não há nada', () => {
    aEsperar();
    assert.match(app.esperaDoServidor(), /À espera do servidor/);
    assert.doesNotMatch(app.esperaDoServidor(), /não há nada registado/);
  });

  test('acabada a espera, cala-se e deixa falar o vazio verdadeiro', () => {
    aEsperar();
    app.CW._esperaFim = 1;
    assert.equal(app.esperaDoServidor(), '', 'já se sabe: o vazio é real');
  });

  test('quem tem seja o que for em casa nunca vê a espera', () => {
    aEsperar();
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
    assert.equal(app.esperaDoServidor(), '', 'há dados locais: mostram-se');
  });

  test('sem sessão iniciada não há espera nenhuma', () => {
    aEsperar();
    app.CW = undefined; app.window.CW = undefined;
    assert.equal(app.esperaDoServidor(), '', 'app local: o que está cá é tudo');
  });

  /* Os nove ecrãs que afirmavam o vazio. O da visão geral é o pior: além da
     frase, tinha um botão de carregar dados de exemplo — e o seed substitui a
     base e agenda um envio para o servidor. */
  test('os nove ecrãs esperam, em vez de afirmarem o vazio', () => {
    aEsperar();
    const vistas = {
      'visão geral': () => app.vDashboard(),
      imóveis: () => app.vProperties(),
      contratos: () => app.vContracts(),
      inquilinos: () => app.vTenants(),
      proprietários: () => app.vOwners(),
      movimentos: () => app.vTransactions(),
      visitas: () => app.vVisits(),
      créditos: () => app.vCredits(),
      avaliação: () => app.vReports(),
    };
    Object.keys(vistas).forEach((nome) => {
      const html = vistas[nome]();
      assert.match(html, /À espera do servidor/, nome + ': devia esperar');
      assert.doesNotMatch(html, /seed\(\)/, nome + ': nada de dados de exemplo à espera');
    });

    // e depois de o estado chegar, cada um diz o seu vazio verdadeiro
    app.CW._esperaFim = 1;
    assert.match(vistas['visão geral'](), /não há nada registado/);
    assert.match(vistas.contratos(), /Cria primeiro um imóvel/);
    assert.match(vistas.inquilinos(), /Sem inquilinos/);
    assert.match(vistas.movimentos(), /Sem movimentos/);
  });
});

/* A pintura que interessa é a PRIMEIRA, e nela a nuvem ainda não carregou: o
   app/arranque.js corre antes do cloud/nucleo.js. Um guarda que perguntasse
   «há window.CW?» respondia «não há nuvem, diz tudo» exatamente aí — e o sino,
   o cartão dos por confirmar e os nove vazios ficavam sem guarda nenhum. */
describe('a primeira pintura, antes de a nuvem carregar', () => {
  test('sem window.CW mas com sessão no aparelho, espera-se na mesma', () => {
    aEsperar();
    app.rawSet(app.LS_SESSAO, JSON.stringify({ id: 'EU', name: 'Eu' }));
    app.CW = undefined; app.window.CW = undefined;   // o cloud/nucleo.js ainda não correu
    assert.equal(app.haSessao(), true, 'a sessão lê-se do aparelho');
    assert.equal(app.sabemosOEstado(), false, 'e por isso ainda não se afirma nada');
    assert.match(app.vDashboard(), /À espera do servidor/);
    assert.equal(app.pendingCard(), '', 'nem o cartão dos por confirmar');
    app.rawSet(app.LS_SESSAO, '');
  });

  test('sem sessão nenhuma, a app local fala à vontade', () => {
    aEsperar();
    app.rawSet(app.LS_SESSAO, '');
    app.CW = undefined; app.window.CW = undefined;
    assert.equal(app.haSessao(), false);
    assert.equal(app.sabemosOEstado(), true);
    assert.match(app.vDashboard(), /não há nada registado/);
  });
});

describe('os dados de exemplo', () => {
  test('em produção, o botão nem chega a ser escrito', () => {
    aEsperar();
    app.CW._esperaFim = 1;
    app.CW.ambiente = 'producao';
    assert.equal(app.podeExemplo(), false);
    assert.doesNotMatch(app.vDashboard(), /seed\(\)/, 'a visão geral não o oferece');
    assert.doesNotMatch(app.vProperties(), /seed\(\)/, 'os imóveis também não');
    assert.doesNotMatch(app.vDashboard(), /dados de exemplo/, 'nem a frase que o anuncia');
  });

  test('em dev, está lá', () => {
    aEsperar();
    app.CW._esperaFim = 1;
    app.CW.ambiente = 'dev';
    assert.equal(app.podeExemplo(), true);
    assert.match(app.vDashboard(), /seed\(\)/);
    assert.match(app.vProperties(), /seed\(\)/);
  });

  /* Escrever o botão só onde ele deve estar, em vez de o apagar do DOM depois
     de cada render: a pesquisa das listas repinta pela via parcial, que não
     passa pelo render, e por lá um botão apagado à posteriori voltava. */
  test('sem ambiente conhecido, vale produção — o lado seguro', () => {
    aEsperar();
    app.CW._esperaFim = 1;
    delete app.CW.ambiente;
    assert.equal(app.podeExemplo(), false, 'na dúvida, não se oferece');
  });
});
