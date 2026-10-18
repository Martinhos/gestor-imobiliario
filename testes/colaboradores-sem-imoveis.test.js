// O separador Colaboradores de quem ainda não tem imóveis: o cartão «Quem
// colabora» — cujo vazio manda convidar — não se escreve, porque sem imóveis
// não há convite que se possa criar. O «Convidar colaborador» (cuja janela
// diz para criar o primeiro imóvel) e os «Cargos» ficam. Como o partilha-pedidos.test.js: a nuvem por cima da app do arnês.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { carregarApp } from './arnes.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const le = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');

// A app com a nuvem por cima, com sessão e já depois do primeiro estado.
// Recebe: st — o estado do servidor (o de rebuildDb).
// Devolve: o proxy da app, com db e CW.state postos.
function comEstado(st) {
  const app = carregarApp();
  app.document.documentElement.style.removeProperty = () => {};
  const ctx = app.__ctx;
  for (const nome of ['nucleo', 'utilizadores', 'partilha', 'colaboradores', 'painel']) {
    vm.runInContext(le('web/cloud/' + nome + '.js'), ctx, { filename: 'cloud/' + nome + '.js' });
  }
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt', token: 't' };
  app.CW._pulled = 1; app.CW._esperaFim = 1;
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  return app;
}

const BASE = () => ({
  me: { id: 'EU' }, houses: [], records: [], userRecords: [],
  profiles: [{ userId: 'RUI', name: 'Rui', data: null }],
  connections: [], people: [], collaborators: [], invites: [], shareLink: null,
  roles: [{ id: 'R1', name: 'Gestor de visitas', perms: ['visit.view'], n: 0 }],
  shareRequests: { incoming: [], outgoing: [] },
});
const MINHA = { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1, data: { id: 'H1', name: 'Minha' } };
const DO_RUI = { id: 'H2', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU'], updatedAt: 1, data: { id: 'H2', name: 'Do Rui' } };

describe('o separador Colaboradores sem imóveis', () => {
  // Os títulos dos cartões da página (os <h3>), pela ordem.
  // Recebe: h — o HTML da página.
  // Devolve: array de textos.
  const titulos = (h) => [...h.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]);

  test('com um cargo e sem imóveis, ficam só o «Convidar colaborador» (que diz por onde se começa) e os «Cargos»', () => {
    const app = comEstado(BASE());
    const h = app.paginaDosColaboradores();
    assert.deepEqual(titulos(h), ['Cargos']);
    assert.match(h, /data-click="CW\.conviteModal\(\)">[\s\S]*? Convidar colaborador/);
    assert.doesNotMatch(h, /Convida alguém com uma ligação de uso único/, 'a frase do vazio de «Quem colabora» não aparece');
    assert.equal(app.quemColaboraCard(), '', 'o cartão em si é vazio');
  });

  test('controlo: com um imóvel meu o cartão volta, com o vazio dele', () => {
    const st = BASE(); st.houses = [MINHA];
    const app = comEstado(st);
    assert.deepEqual(titulos(app.paginaDosColaboradores()), ['Quem colabora', 'Cargos']);
    assert.match(app.quemColaboraCard(), /Ainda ninguém colabora contigo\. Convida alguém com uma ligação de uso único\./);
  });

  test('só com um imóvel que outro partilhou comigo, o cartão fica pela nota de quem gere colaboradores', () => {
    const st = BASE(); st.houses = [DO_RUI];
    const app = comEstado(st);
    assert.match(app.quemColaboraCard(), /só quem criou o imóvel gere colaboradores/);
    assert.deepEqual(titulos(app.paginaDosColaboradores()), ['Quem colabora', 'Cargos']);
  });
});
