// O que a app FAZ antes de o servidor falar — não já o que ela diz.
//
// O guarda da espera calou as afirmações. Falta o resto: o push que apagava
// por diferença, a arrumação dos anexos que chegava ao servidor, os lembretes
// agendados com o que estava no aparelho, e dois ecrãs que continuavam a
// afirmar — um deles com um botão de Confirmar que criava a renda em
// duplicado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { carregarApp } from './arnes.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const le = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');

/* ------------------------------------------------------- a camada da app */

const app = carregarApp();

function aEsperar() {
  app.CW = { user: { id: 'EU' } };   // sessão iniciada, sem _esperaFim: à espera
  app.window.CW = app.CW;
  app.db.properties = []; app.db.contracts = []; app.db.tenants = [];
  app.db.owners = []; app.db.transactions = []; app.db.visits = [];
}

describe('os ecrãs que ainda afirmavam', () => {
  test('os prazos calam-se à espera: um aviso silenciado noutro aparelho reaparecia aqui', () => {
    aEsperar();
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
    app.db.contracts = [app.normContract({
      id: 'C1', propertyId: 'P1', rent: 500,
      start: '2024-01-01', end: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    })];
    assert.ok(app.prazosAtivos().length, 'há mesmo um prazo na janela');
    assert.equal(app.prazosCard(), '', 'mas nada se afirma antes de saber');

    app.CW._esperaFim = 1;
    assert.match(app.prazosCard(), /Prazos/, 'acabada a espera, aparece');
  });
});

describe('arrumar a despensa não apaga na nuvem', () => {
  test('o idbDelLocal é outra função, e é essa que o cleanFiles usa', () => {
    assert.equal(typeof app.idbDelLocal, 'function', 'existe');
    assert.notEqual(app.idbDelLocal, app.idbDel, 'não é o mesmo que apagar o anexo');
    const s = le('web/app/anexos.js');
    assert.match(s, /\(r\.result\|\|\[\]\)\.forEach\(k=>\{if\(!keep\[k\]\)idbDelLocal\(k\)\}\)/,
      'a limpeza usa a via local');
    assert.match(s, /if\(!sabemosOEstado\(\)\)return void setTimeout\(cleanFiles/,
      'e espera por saber o que é órfão');
  });

  test('só o idbDel leva DELETE ao servidor — o embrulho da nuvem não toca no local', () => {
    const s = le('web/cloud/anexos.js');
    assert.match(s, /idbDel = function/, 'a nuvem embrulha o idbDel');
    assert.ok(!/idbDelLocal = function/.test(s), 'e deixa o idbDelLocal em paz');
    assert.ok(s.includes("'/api/files/'"), 'é o idbDel que manda o DELETE');
  });
});

describe('as derivações do arranque esperam por saber', () => {
  /* O syncAllContractRecs e o syncAllLoanRecs não são leituras: escrevem em
     db.recurring, e APAGAM as recorrências automáticas cujo contrato ou
     hipoteca já não aparecem no db. No arranque, «já não aparece» quer muitas
     vezes dizer «ainda não sei que existe». */
  test('o arranque não deriva nem grava antes do primeiro estado', () => {
    const s = le('web/app/arranque.js');
    assert.match(s, /function derivarDoArranque\(\)\{\s*if\(!sabemosOEstado\(\)\)return void setTimeout\(derivarDoArranque/,
      'a derivação espera, e volta a tentar');
    const i = s.indexOf('function derivarDoArranque()');
    const corpo = s.slice(i, s.indexOf('}', s.indexOf('save();', i)));
    for (const f of ['syncAllContractRecs()', 'syncAllLoanRecs()', 'save()']) {
      assert.ok(corpo.includes(f), f + ' vive dentro do guarda');
    }
    /* e nenhuma delas fica solta na linha do arranque: uma chamada de topo
       corria antes de a nuvem sequer carregar */
    const fora = s.replace(corpo, '');
    for (const f of ['syncAllContractRecs()', 'syncAllLoanRecs()']) {
      assert.ok(!new RegExp('^' + f.replace(/[()]/g, '\$&'), 'm').test(fora),
        f + ' não corre à solta no arranque');
    }
  });

  test('as duas derivações apagam mesmo — é por isso que esperam', () => {
    const s = le('web/app/planeados.js');
    assert.match(s, /function syncAllContractRecs\(\)\{[\s\S]{0,400}?db\.recurring=db\.recurring\.filter/,
      'o sync dos contratos deita fora recorrências');
    assert.match(s, /function syncAllLoanRecs\(\)\{[\s\S]{0,400}?db\.recurring=db\.recurring\.filter/,
      'o das hipotecas também');
  });
});

describe('o cartão do contrato não deixa confirmar um fantasma', () => {
  test('o decoratePending espera, como o sino', () => {
    const s = le('web/cloud/painel.js');
    const i = s.indexOf('function decoratePending()');
    assert.ok(i > -1);
    const corpo = s.slice(i, i + 700);
    assert.match(corpo, /if \(!sabemosOEstado\(\)\) return;/, 'o guarda está lá');
    assert.ok(corpo.indexOf('sabemosOEstado') < corpo.indexOf('recActive()'),
      'e antes de contar o que quer que seja');
  });
});

/* ------------------------------------------------------ a camada da nuvem */

// A app com o nucleo por cima, e os espiões — como em colaboradores-cloud.
function montarNuvem() {
  const a = carregarApp();
  a.document.documentElement.style.removeProperty = () => {};
  vm.runInContext(le('web/cloud/nucleo.js'), a.__ctx, { filename: 'cloud/nucleo.js' });
  const enviado = [];
  a.api = (method, p, body) => {
    enviado.push({ method, path: p, body });
    return Promise.resolve({ results: ((body || {}).ops || []).map(() => ({ ok: true })) });
  };
  a.render = () => {};
  a.buildNav = () => {};
  a.setSyncBadge = () => {};
  a.subirPendentes = () => {};
  a.toast = () => {};
  a.CW.user = { id: 'EU', name: 'Eu', token: 't' };
  return { a, enviado };
}

const opsDe = (enviado) => enviado.filter((x) => x.path === '/api/sync')
  .flatMap((x) => (x.body || {}).ops || []);

describe('o push não apaga antes de saber', () => {
  /* O retrato é por utilizador e não se apaga ao sair; o db é apagado no
     finishLogin quando entra outra conta. Base vazia mais retrato cheio dava
     um «del» para tudo o que a conta tem no servidor. */
  test('com a base em branco e o retrato cheio, nenhum del sai', async () => {
    const { a, enviado } = montarNuvem();
    a.db.properties = []; a.db.transactions = []; a.db.contracts = [];
    a.snap = {
      'h:H1': '{"id":"H1"}',
      'r:H1:tx:T1': '{"id":"T1"}',
      'r:H1:tx:T2': '{"id":"T2"}',
    };
    delete a.CW._pulled;                       // ainda não falámos com o servidor
    await a.pushNow();
    const ops = opsDe(enviado);
    assert.equal(ops.filter((o) => o.op === 'del').length, 0,
      'nada se apaga a partir de uma base que ainda não se sabe se está certa');
  });

  test('depois do primeiro estado, as remoções voltam a funcionar', async () => {
    const { a, enviado } = montarNuvem();
    a.db.properties = []; a.db.transactions = []; a.db.contracts = [];
    a.snap = {
      'h:H1': '{"id":"H1"}',
      'r:H1:tx:T1': '{"id":"T1"}',
    };
    a.CW._pulled = 1;                          // o servidor já falou
    await a.pushNow();
    const dels = opsDe(enviado).filter((o) => o.op === 'del');
    assert.ok(dels.length >= 2, 'o que desapareceu a sério continua a ser apagado');
  });
});

describe('os lembretes refazem-se com o estado do servidor', () => {
  test('o applyState reagenda: gravar com rawSet não passa pelo save()', () => {
    const s = le('web/cloud/nucleo.js');
    const i = s.indexOf('function applyState(st)');
    assert.ok(i > -1);
    const corpo = s.slice(i, s.indexOf('function pullNow', i));
    assert.match(corpo, /scheduleReminders\(\)/, 'reagenda');
    assert.ok(corpo.indexOf('rawSet(KEY') < corpo.indexOf('scheduleReminders()'),
      'depois de o db novo estar gravado');
  });

  test('entrar noutra conta larga também o retrato dessa conta', () => {
    const s = le('web/cloud/entrada.js');
    const i = s.indexOf('dados locais de outra conta');
    assert.ok(i > -1);
    const corpo = s.slice(i, i + 600);
    assert.match(corpo, /snap = \{\}/, 'esvazia o retrato');
    assert.match(corpo, /removeItem\(snapKey\(\)\)/, 'e apaga-o do aparelho');
  });
});
