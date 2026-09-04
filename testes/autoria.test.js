// A autoria dos registos, de ponta a ponta em texto: os testes do sino
// estampam _author/_atServidor à mão, por isso não apanham desalinhamentos
// entre o que o servidor devolve e o que o cliente lê (foi exatamente assim
// que o sino nasceu morto). Aqui prova-se o contrato dos dois lados — os
// campos da resposta do /api/state e as leituras do rebuildDb — e a limpeza
// que impede um cliente adulterado de forjar autoria.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanData } from '../worker/src/lib/http.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const le = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');

describe('o contrato servidor → cliente', () => {
  test('o /api/state devolve author e updatedAt nos records', () => {
    const s = le('worker/src/rotas/estado.js');
    const mapa = s.match(/records: records\.map\(\(r\) => \(\{[\s\S]*?\}\)\)/);
    assert.ok(mapa, 'o mapeamento dos records existe');
    assert.match(mapa[0], /author:/, 'o autor entra na resposta');
    assert.match(mapa[0], /updatedAt:/, 'o carimbo entra na resposta');
  });

  test('o rebuildDb lê os campos com os nomes da resposta (camelCase)', () => {
    const s = le('web/cloud/nucleo.js');
    const marca = s.match(/var marca = function[\s\S]*?\};/);
    assert.ok(marca, 'a função marca existe');
    assert.match(marca[0], /r\.author/, 'lê o autor');
    assert.match(marca[0], /r\.updatedAt/, 'lê o carimbo como a resposta o traz');
    assert.doesNotMatch(marca[0], /r\.updated_at/, 'nada de snake_case: a resposta não o tem');
  });

  test('todos os tipos com fonte no sino passam pela marca — inquilinos incluídos', () => {
    const s = le('web/cloud/nucleo.js');
    const ramo = s.match(/\(st\.records \|\| \[\]\)\.forEach[\s\S]*?houseOwner\[r\.houseId\][\s\S]*?catch/);
    assert.ok(ramo, 'o ramo dos records existe');
    for (const kind of ['normContract', 'normTx', 'normRec', 'normVisit', 'normPerson'])
      assert.match(ramo[0], new RegExp('marca\\(' + kind), kind + ' leva a marca de autoria');
  });
});

describe('a limpeza no push', () => {
  test('cleanData recusa metadados de trabalho: chaves _ não entram no servidor', () => {
    const d = cleanData({ label: 'Renda', _author: 'FORJADO', _atServidor: 9e15 }, 'X1');
    assert.equal(d.label, 'Renda');
    assert.ok(!('_author' in d), 'a autoria forjada cai');
    assert.ok(!('_atServidor' in d), 'o carimbo forjado cai');
  });

  test('cleanData continua a impor o id da linha e a recusar não-objetos', () => {
    assert.equal(cleanData({ id: 'OUTRO' }, 'X1').id, 'X1');
    assert.equal(cleanData([1, 2]), null);
    assert.equal(cleanData('texto'), null);
  });
});
