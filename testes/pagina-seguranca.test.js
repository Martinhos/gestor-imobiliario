// A página da conta passou a «Segurança» e só tem a segurança (mudar a
// palavra-passe, terminar sessão nos outros aparelhos, terminar sessão e
// apagar a conta); o id com «Copiar» passou para as Pessoas › Proprietários,
// logo acima do campo onde se escreve o do outro; a linha das Definições
// diz «Segurança»; sem sessão fica o convite para entrar; sem o separador
// dos Proprietários a partilha entre contas fica na Segurança, numa secção à
// parte; e os textos que mandavam a «Conta e partilha» dizem onde está agora.
// Como o partilha-pedidos.test.js: nucleo, utilizadores, partilha,
// colaboradores e painel por cima da app do arnês, com api, pullNow, toast e
// as janelas trocados por espiões.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { carregarApp } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const le = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');
const espera = () => new Promise((r) => setTimeout(r, 5));

// A app com a nuvem por cima, com sessão, e os espiões dos toasts.
// Recebe: muda (opcional) — função que recebe o estado do servidor e o altera.
// Devolve: {app, esp} — esp.toasts são as mensagens, pela ordem.
function comEstado(muda) {
  const app = carregarApp();
  app.document.documentElement.style.removeProperty = () => {};
  const ctx = app.__ctx;
  for (const nome of ['nucleo', 'utilizadores', 'partilha', 'colaboradores', 'painel']) {
    vm.runInContext(le('web/cloud/' + nome + '.js'), ctx, { filename: 'cloud/' + nome + '.js' });
  }
  const esp = { toasts: [] };
  app.api = () => Promise.resolve({});
  app.toast = (m) => { esp.toasts.push(m); };
  janelasFalsas(app, 'render', 'setSyncBadge', 'subirPendentes');
  app.pullNow = () => Promise.resolve();
  app.CW.user = { id: 'A7KQ2MPX', name: 'Eu', email: 'eu@exemplo.pt', token: 't' };
  app.CW._pulled = 1;
  app.CW._esperaFim = 1;
  const st = {
    me: { id: 'A7KQ2MPX' },
    houses: [{ id: 'H1', ownerId: 'A7KQ2MPX', ownerName: 'Eu', mine: true, participants: ['A7KQ2MPX', 'RUI'], updatedAt: 1,
      data: { id: 'H1', name: 'Minha', address: 'Rua A' } }],
    records: [], userRecords: [],
    profiles: [{ userId: 'RUI', name: 'Rui', data: null }],
    connections: [
      { id: 'K1', status: 'active', incoming: false, peer: { id: 'RUI', name: 'Rui', email: 'rui@exemplo.pt' }, myShares: ['H1'], peerShares: [] },
      { id: 'K2', status: 'pending', incoming: true, peer: { id: 'ZE', name: 'Zé', email: 'ze@exemplo.pt' } },
    ],
    roles: [], collaborators: [], invites: [], people: [],
    shareLink: null,
    shareRequests: { incoming: [], outgoing: [] },
  };
  if (muda) muda(st);
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  return { app, esp };
}

// O texto que se lê de um pedaço de HTML, sem as etiquetas e com os espaços juntos.
// Recebe: h — o HTML.
// Devolve: o texto.
const texto = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('a página Segurança', () => {
  test('só tem a segurança: as quatro linhas, pela ordem, e nada do que lá vivia', () => {
    const { app } = comEstado();
    const h = app.vCloud();
    const linhas = h.match(/<button type="button" class="pt-linha pt-abre[^"]*"[^>]*>[\s\S]*?<\/button>/g) || [];
    assert.deepEqual(linhas.map((l) => /<b class="u-d-block">([^<]+)<\/b>/.exec(l)[1]),
      ['Mudar a palavra-passe', 'Terminar sessão nos outros aparelhos', 'Terminar sessão', 'Apagar a conta']);
    assert.deepEqual(linhas.map((l) => /data-click="([^"]+)"/.exec(l)[1]),
      ['CW.passwordModal()', 'CW.revokeSessions()', 'CW.logout()', 'CW.deleteAccount()']);
    assert.match(linhas[3], /class="pt-linha pt-abre pt-perigo" data-toca="camada" data-risco="destroi"/, 'o apagar é a linha vermelha, que avisa antes');
    assert.ok(linhas.slice(0, 3).every((l) => !/data-risco/.test(l)), 'só o apagar leva o risco');
    assert.match(texto(linhas[2]), /Entraste como eu@exemplo\.pt\. Os dados ficam na conta/, 'sair diz de que conta se sai');
    for (const t of ['A minha conta', 'Comproprietários', 'Partilhar com outras contas', 'Grupos', 'O teu id', 'O meu id', 'A7KQ2MPX',
      'CW.copyId()', 'CW.editProfile()', "go('owners')", "go('groups')", 'cw_peer']) {
      assert.ok(!h.includes(t), 'a Segurança não tem: ' + t);
    }
    assert.equal((h.match(/<h2/g) || []).length, 0, 'sem título por dentro: o da página já diz «Segurança»');
    assert.match(h, /<section class="pt-seccao" aria-label="Segurança">/, 'a secção tem nome para o leitor de ecrã');
  });

  test('o título é «Segurança», com um subtítulo à altura, e a raiz das Definições abre-a por uma linha «Segurança»', () => {
    const { app } = comEstado();
    const sub = app.SUBPAGE.cloud;
    assert.equal(sub.label, 'Segurança');
    assert.equal(sub.sub, 'Palavra-passe, sessões e apagar a conta');
    const linha = app.linhasDaSeccao('conta').find((l) => l.page === 'cloud');
    assert.equal(linha.label, 'Segurança');
    assert.equal(linha.icon, 'lock');
    assert.equal(linha.sub(), 'Palavra-passe, sessões e apagar a conta', 'a linha já não diz o id');
    app.setPage = '';
    const raiz = app.vSettings();
    assert.match(raiz, /goSet\('cloud'\)/, 'a raiz tem a porta da página');
    assert.ok(texto(raiz).includes('Segurança Palavra-passe, sessões e apagar a conta'), 'com o nome e o sub: ' + texto(raiz).slice(0, 400));
    assert.ok(!raiz.includes('Conta e partilha') && !raiz.includes('· id A7KQ2MPX'), 'nada do nome antigo');
    app.setPage = 'cloud';
    assert.ok(app.vSettings().includes('CW.passwordModal()'), 'a subpágina é a Segurança');
  });

  test('o id, com «Copiar», está nos Proprietários logo acima do campo de ligar', () => {
    const { app } = comEstado();
    const donos = app.vOwners();
    const sec = donos.slice(donos.indexOf('pes-partilha'));
    assert.match(sec, /<div class="pt-linha pt-meu"><span class="pt-txt"><span class="small">O teu id<\/span><b class="u-d-block pt-meuid">A7KQ2MPX<\/b><\/span>/);
    assert.match(sec, /<button type="button" class="btn sm" data-toca="nada" aria-label="Copiar o teu id" data-click="CW\.copyId\(\)">Copiar<\/button>/);
    // logo acima do campo: a linha do id fecha e a seguir vem a do campo
    assert.match(sec, /Copiar<\/button><\/span><\/div><div class="pt-linha pt-ligar"><div class="pt-ligar-campo"><label class="u-fx-1 u-minw-0">O id do outro utilizador/);
    assert.ok(sec.indexOf('Zé quer ligar-se a ti') < sec.indexOf('O teu id'), 'o convite por responder fica por cima, como antes');
    assert.equal((donos.match(/CW\.copyId\(\)/g) || []).length, 1, 'uma vez só');
    assert.ok(donos.indexOf('Partilhar com outras contas') < donos.indexOf('O teu id'), 'dentro da secção «Partilhar com outras contas»');
  });

  test('o «Copiar» copia o id e diz para o dar ao outro; sem clipboard ou com a cópia recusada, diz o id em vez de mentir', async () => {
    const { app, esp } = comEstado();
    const copiado = [];
    app.navigator.clipboard = { writeText: (t) => { copiado.push(t); return Promise.resolve(); } };
    app.CW.copyId();
    await espera();
    assert.deepEqual(copiado, ['A7KQ2MPX']);
    assert.deepEqual(esp.toasts, ['Id copiado. Dá-o ao outro utilizador para ele te ligar.']);
    esp.toasts.length = 0;
    app.navigator.clipboard = { writeText: () => Promise.reject(new Error('NotAllowedError')) };
    app.CW.copyId();
    await espera();
    delete app.navigator.clipboard;
    app.CW.copyId();
    assert.deepEqual(esp.toasts, ['Não deu para copiar. O teu id é A7KQ2MPX: dá-o ao outro utilizador.',
      'Não deu para copiar. O teu id é A7KQ2MPX: dá-o ao outro utilizador.']);
  });

  test('sem sessão: a Segurança convida a entrar, a linha diz «Inicia sessão», e os Proprietários não têm id', () => {
    const { app } = comEstado();
    app.CW.user = null;
    const h = app.vCloud();
    assert.match(h, /data-toca="camada" data-click="CW\.showAuth\(\)">Iniciar sessão<\/button>/);
    assert.match(texto(h), /Segurança Sem sessão iniciada/);
    for (const t of ['CW.passwordModal()', 'CW.logout()', 'CW.deleteAccount()', 'O teu id']) assert.ok(!h.includes(t), 'sem sessão, sem ' + t);
    assert.equal(app.linhasDaSeccao('conta').find((l) => l.page === 'cloud').sub(), 'Inicia sessão');
    assert.equal(app.comproprietariosHtml(), '');
    assert.ok(!app.vOwners().includes('CW.copyId()'));
  });

  test('sem o separador dos Proprietários, a partilha fica na Segurança, numa secção à parte por baixo, com o id e as ligações todas', () => {
    const { app } = comEstado();
    app.definirServicosDesligados(['owners']);
    const h = app.vCloud();
    const iSeg = h.indexOf('Apagar a conta'), iPart = h.indexOf('<h2 id="ptPartilhaConta">Partilhar com outras contas</h2>');
    assert.ok(iSeg > -1 && iPart > iSeg, 'a segurança primeiro, a partilha por baixo: ' + [iSeg, iPart].join(', '));
    const part = h.slice(iPart);
    assert.match(part, /O teu id<\/span><b class="u-d-block pt-meuid">A7KQ2MPX<\/b>/);
    assert.ok(part.indexOf('O teu id') < part.indexOf('O id do outro utilizador'), 'o id acima do campo');
    assert.match(part, /CW\.sharesModal\('K1'\)">Casas partilhadas</, 'com a ligação ativa, que aqui não tem lista por cima');
    assert.ok(part.includes('Zé quer ligar-se a ti'), 'e o convite');
    assert.match(h, /<section class="pt-seccao" aria-labelledby="ptPartilhaConta">/);
    // e com os Colaboradores também desligados: a frase de quem liga o serviço, e nada da partilha
    app.definirServicosDesligados(['owners', 'colaboradores']);
    const sem = app.vCloud();
    assert.match(sem, /<p class="hint pt-nota">O serviço Colaboradores está desligado nesta conta\. A partilha entre contas fica disponível quando o suporte o ligar\.<\/p>/);
    assert.ok(!sem.includes('O teu id') && !sem.includes('cw_peer'));
    assert.ok(sem.includes('CW.deleteAccount()'), 'a segurança fica');
  });

  test('com os Colaboradores desligados, os Proprietários dizem porquê no lugar da partilha, e a Segurança não', () => {
    const { app } = comEstado();
    app.definirServicosDesligados(['colaboradores']);
    const h = app.comproprietariosHtml();
    assert.equal(h, '<div class="pt-pagina pes-partilha"><p class="hint pt-nota">O serviço Colaboradores está desligado nesta conta. ' +
      'A partilha entre contas fica disponível quando o suporte o ligar.</p></div>');
    assert.ok(!app.vCloud().includes('desligado nesta conta'));
  });

  test('os textos que mandavam à «Conta e partilha» dizem onde as coisas estão agora', () => {
    const { app } = comEstado();
    const faq = Object.fromEntries(app.PERGUNTAS_FREQUENTES.map((q) => [q.id, q.resposta]));
    assert.match(faq.partilha, /Em <b>Pessoas → Proprietários<\/b>, por baixo da lista, cada um tem o seu id de 8 caracteres, com «Copiar», e logo por baixo o campo para o id do outro/);
    assert.match(faq.conta, /Em <b>Definições → Segurança → Apagar a conta<\/b>\./);
    assert.match(le('web/app/copias.js'), /sai da conta primeiro \(Definições → Segurança → Terminar sessão\)[\s\S]*?usa Definições → Segurança → Apagar a conta\./);
    for (const f of ['web/cloud/partilha.js', 'web/app/copias.js', 'web/cloud/ajuda.js']) {
      assert.ok(!/conta e partilha/i.test(le(f)), f + ' já não diz «Conta e partilha»');
    }
  });
});
