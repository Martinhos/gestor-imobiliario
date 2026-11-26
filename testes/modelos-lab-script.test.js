// O scripts/modelos.mjs, a parte que não precisa do wrangler: os argumentos,
// o --para (um cartão, um subticket pelo pai, um ticket, a pessoa direto), a
// pessoa de um ticket ou de um cartão (o Discord do ticket, a pessoa da
// equipa, a conta, o relator; um cartão do Claude ou de um pedido recusa), o
// cenário que tem de estar no código, a guarda que recusa a produção, e o SQL
// do criar corrido contra a base de teste (com a migração 0035): no fim da
// ordem da pessoa, com a origem e o ticket, e sem duplicar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { baseDeTeste } from './lib/bd.js';
import {
  lerArgumentos, lerPara, confereCenario, confereAlvo, pessoaDaLinha, sqlCriar, sqlListar, sqlDaPessoa, listaLegivel,
  ALVOS, ErroModelos,
} from '../scripts/modelos.mjs';

describe('os argumentos e o --para', () => {
  test('o criar pede o cenário e o --para; o listar não leva o cenário', () => {
    assert.deepEqual(lerArgumentos(['criar', '--cenario', 'prejuizo', '--para', 'KAN-126', '--local']),
      { comando: 'criar', cenario: 'prejuizo', para: 'KAN-126', nome: null, local: true, json: false });
    assert.equal(lerArgumentos(['criar', '--cenario', 'a', '--para', 'x', '--nome', '  Dois  contratos ']).nome, 'Dois contratos');
    for (const mau of [[], ['apagar'], ['criar', '--para', 'KAN-1'], ['criar', '--cenario', 'A B', '--para', 'KAN-1'],
      ['criar', '--cenario', 'a'], ['criar', '--cenario', 'a', '--para'], ['listar', '--para', 'KAN-1', '--cenario', 'a'],
      ['criar', '--cenario', 'a', '--para', 'KAN-1', '--prod'], ['criar', '--cenario', 'a', '--para', 'KAN-1', '--nome', 'x'.repeat(81)]]) {
      assert.throws(() => lerArgumentos(mau), ErroModelos, JSON.stringify(mau));
    }
  });

  test('o --para: um cartão, um subticket pelo pai, a pessoa direto, ou um ticket', () => {
    assert.deepEqual(lerPara('KAN-126'), { tipo: 'cartao', numero: 126, chave: 'KAN-126', pedida: 'KAN-126' });
    assert.deepEqual(lerPara('kan-126-3'), { tipo: 'cartao', numero: 126, chave: 'KAN-126', pedida: 'KAN-126-3' });
    assert.deepEqual(lerPara('discord:1234'), { tipo: 'pessoa', dono: 'discord:1234' });
    assert.deepEqual(lerPara('DE9657BC-aa'), { tipo: 'ticket', id: 'DE9657BC-aa' });
    assert.throws(() => lerPara('discord:abc'), ErroModelos);
    assert.throws(() => lerPara('a b'), ErroModelos);
  });
});

describe('a pessoa de um ticket ou de um cartão', () => {
  const cartao = lerPara('KAN-9');
  test('o ticket de QA manda: o Discord, a pessoa da equipa, a conta', () => {
    assert.deepEqual(pessoaDaLinha(cartao, { q_user: 'U1', q_discord: '555', q_nome: 'Martinho', relator_id: 'claude' }), { dono: 'discord:555', nome: 'Martinho' });
    assert.deepEqual(pessoaDaLinha(cartao, { q_user: 'equipa:777', q_discord: null }), { dono: 'discord:777', nome: '' });
    assert.deepEqual(pessoaDaLinha(lerPara('T1'), { q_user: 'U9', q_discord: null }), { dono: 'conta:U9', nome: '' });
  });
  test('sem ticket, o relator do back office; o Claude e os pedidos não têm pessoa', () => {
    assert.deepEqual(pessoaDaLinha(cartao, { relator_id: '888', relator_nome: 'Ana' }), { dono: 'discord:888', nome: 'Ana' });
    assert.throws(() => pessoaDaLinha(cartao, { relator_id: 'claude' }), /discord:<id>/);
    assert.throws(() => pessoaDaLinha(cartao, { relator_id: '888', origem_tipo: 'pedido' }), ErroModelos);
    assert.throws(() => pessoaDaLinha(cartao, undefined), /Não encontro o cartão KAN-9/);
  });
  test('o SQL da pessoa lê o cartão com o ticket dele, ou o ticket', () => {
    assert.match(sqlDaPessoa(cartao), /FROM kanban_cartoes c LEFT JOIN qa_tickets q .* WHERE c\.numero = 9 AND c\.removed_at IS NULL$/);
    assert.match(sqlDaPessoa(lerPara("T'1".replace("'", ''))), /WHERE id = 'T1'$/);
  });
});

describe('o cenário e a guarda', () => {
  test('o cenário tem de estar no código', () => {
    const f = "var MODELOS_CENARIOS=[{id:'prejuizo',nome:'x'},{ id: \"renda-dezembro\" }];";
    confereCenario('prejuizo', f);
    confereCenario('renda-dezembro', f);
    assert.throws(() => confereCenario('prejuizo-2', f), ErroModelos);
    assert.throws(() => confereCenario('renda', f), ErroModelos);
  });
  test('só o dev e a base isolada; a produção recusa-se antes do wrangler', () => {
    confereAlvo(Object.assign({}, ALVOS.remoto));
    confereAlvo(Object.assign({}, ALVOS.local));
    assert.throws(() => confereAlvo({ nome: 'prod', local: false, base: 'gestor-imobiliario' }), /produção não se toca/);
    assert.throws(() => confereAlvo({ nome: 'dev', local: false, base: 'gestor-imobiliario' }), ErroModelos);
    assert.throws(() => confereAlvo(null), ErroModelos);
  });
});

describe('o SQL do criar, na base de teste', () => {
  test('entra no fim da ordem da pessoa, com a origem e o ticket, e repetir não duplica', () => {
    const b = baseDeTeste();
    b._db.exec("INSERT INTO qa_modelos (id, dono, ordem, tipo, cenario, origem, criado_em, atualizado_em) VALUES ('b1', 'discord:5', 0, 'cenario', 'exemplo', 'base', 1, 1), ('b2', 'discord:5', 4, 'cenario', 'vazio', 'base', 1, 1)");
    const corre = (o) => sqlCriar(Object.assign({ dono: 'discord:5', cenario: 'reducao', nome: null, ticket: 'KAN-127', agora: 9 }, o)).forEach((s) => b._db.exec(s));
    corre({ id: 'n1' });
    corre({ id: 'n2' });                     // repetido: nada
    corre({ id: 'n3', cenario: 'exemplo' }); // já é de base: nada
    corre({ id: 'n4', cenario: 'prejuizo', nome: "Prejuízo d'agora" });
    const linhas = b._db.prepare(sqlListar('discord:5')).all();
    assert.deepEqual(linhas.map((r) => [r.id, r.ordem, r.origem, r.ticket, r.nome]),
      [['b1', 0, 'base', null, null], ['b2', 4, 'base', null, null], ['n1', 5, 'ticket', 'KAN-127', null], ['n4', 6, 'ticket', 'KAN-127', "Prejuízo d'agora"]]);
    assert.match(listaLegivel('discord:5', linhas), /3\. reducao \[cenário reducao\] · do ticket KAN-127/);
    assert.match(listaLegivel('discord:5', []), /ainda não tem modelos/);
  });
});
