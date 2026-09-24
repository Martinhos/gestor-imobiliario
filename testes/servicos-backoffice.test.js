// O back office e os serviços: a ficha de um utilizador (área do suporte)
// ganha o cartão «Serviços», e por baixo dele duas rotas — listar, e ligar
// ou desligar — que passam pela lib worker/src/lib/servicos.js, a mesma
// regra do cliente: desligar desliga os dependentes, ligar exige os
// requeridos ligados. Corre o SQL a sério contra o esquema a sério, como o
// backoffice.test.js: aqui um 403 a menos é um incidente.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { ambiente, novaConta, auditoria } from './lib/api.js';
import { chamar, corpoDe, MASTER, SUPORTE, DEV, ADMIN, COMERCIAL, MARKETING, SEM_CARGO } from './lib/equipa.js';
import { paginaEquipa } from '../worker/src/equipa-vista.js';
import { recursoDePagina } from '../worker/src/paginas-recursos.js';
import { SERVICOS, servicosDesligados } from '../worker/src/lib/servicos.js';

/* ------------------------------ armações ------------------------------- */
// as mesmas do backoffice.test.js: os cargos de equipa (o comercial e o
// marketing são cargos que o papeis.js não conhece — veem tanto como quem não
// tem cargo nenhum) e a chamada à API, de testes/lib/equipa.js; o ambiente, a
// conta e o rasto, de testes/lib/api.js

// as duas rotas, e o que se lê de uma lista devolvida
const rota = (id, servico) => '/api/equipa/pessoas/' + id + '/servicos' + (servico ? '/' + servico : '');
const listar = async (env, eu, id) => corpoDe(await chamar(env, eu, 'GET', rota(id)));
const mudar = (env, eu, id, servico, ligado) => chamar(env, eu, 'PUT', rota(id, servico), { ligado });
const desligados = (lista) => lista.filter((s) => !s.ligado).map((s) => s.id);

const SEM_IMOVEIS = ['properties', 'contracts', 'visits', 'colaboradores', 'credits'];

/* -------------------------------- rotas -------------------------------- */

describe('as rotas dos serviços', () => {
  test('rotas: GET lista os catorze serviços pela ordem do catálogo, com o nome, ligado e requer', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    const r = await listar(env, SUPORTE, id);
    assert.equal(r.status, 200);
    assert.equal(r.servicos.length, 14);
    assert.deepEqual(r.servicos.map((s) => s.id), SERVICOS.map((s) => s.id), 'pela ordem do catálogo');
    assert.deepEqual(r.servicos.map((s) => s.nome), SERVICOS.map((s) => s.nome), 'com o nome legível');
    assert.deepEqual(r.servicos.map((s) => s.requer), SERVICOS.map((s) => s.requer), 'e o que cada um requer');
    assert.ok(r.servicos.every((s) => s.ligado === true), 'sem linha na base está tudo ligado');
    assert.deepEqual(r.servicos.find((s) => s.id === 'contracts').requer, ['properties', 'tenants']);
    assert.equal(r.servicos.find((s) => s.id === 'properties').nome, 'Imóveis');
  });

  test('rotas: PUT desligar grava e devolve o fecho — sem Imóveis caem Contratos, Visitas, Colaboradores e Créditos', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    const r = await corpoDe(await mudar(env, SUPORTE, id, 'properties', false));
    assert.equal(r.status, 200);
    assert.equal(r.servicos.length, 14, 'a resposta é a lista inteira');
    assert.deepEqual(desligados(r.servicos), SEM_IMOVEIS);
    assert.deepEqual(await servicosDesligados(env, id), SEM_IMOVEIS, 'ficou na base');
    const linhas = (await env.DB.prepare(
      'SELECT service, enabled, updated_by FROM user_services WHERE user_id = ? ORDER BY service'
    ).bind(id).all()).results;
    assert.equal(linhas.length, 5, 'o fecho está escrito, linha a linha');
    for (const l of linhas) { assert.equal(l.enabled, 0); assert.equal(l.updated_by, 's1', 'quem mexeu fica na linha'); }
    const depois = await listar(env, SUPORTE, id);
    assert.deepEqual(desligados(depois.servicos), SEM_IMOVEIS, 'o GET concorda com o PUT');
    const outra = await listar(env, SUPORTE, await novaConta(env));
    assert.deepEqual(desligados(outra.servicos), [], 'outra conta não é tocada');
  });

  test('rotas: PUT ligar um serviço cujo requer está desligado dá 400 com a frase', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    await mudar(env, SUPORTE, id, 'properties', false);
    const r = await mudar(env, SUPORTE, id, 'contracts', true);
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /ligar primeiro Imóveis/, 'diz o que ligar primeiro');
    assert.deepEqual(await servicosDesligados(env, id), SEM_IMOVEIS, 'nada mudou');
  });

  test('rotas: PUT ligar de novo apaga a marca; os dependentes ligam-se um a um', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    await mudar(env, SUPORTE, id, 'properties', false);
    let r = await corpoDe(await mudar(env, MASTER, id, 'properties', true));
    assert.equal(r.status, 200);
    assert.ok(r.servicos.find((s) => s.id === 'properties').ligado);
    assert.deepEqual(desligados(r.servicos), ['contracts', 'visits', 'colaboradores', 'credits'],
      'os dependentes ficam desligados de propósito — o suporte liga-os um a um');
    for (const s of ['contracts', 'visits', 'colaboradores', 'credits']) {
      r = await corpoDe(await mudar(env, MASTER, id, s, true));
      assert.equal(r.status, 200, s);
    }
    assert.deepEqual(desligados(r.servicos), []);
    assert.deepEqual(await servicosDesligados(env, id), []);
    const p = await env.DB.prepare('SELECT enabled, updated_by FROM user_services WHERE user_id = ? AND service = ?')
      .bind(id, 'properties').first();
    assert.equal(p.enabled, 1);
    assert.equal(p.updated_by, 'm1');
  });

  test('rotas: cada PUT deixa uma linha na auditoria com quem, a conta e o serviço', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    await mudar(env, SUPORTE, id, 'transactions', false);
    await mudar(env, MASTER, id, 'transactions', true);
    await mudar(env, MASTER, id, 'recurring', true);
    const rasto = await auditoria(env);
    const des = rasto.find((x) => x.acao === 'conta.servico.desligar');
    assert.ok(des, 'o desligar ficou no rasto');
    assert.equal(des.quem, 's1');
    assert.equal(des.nome, 'Sofia');
    assert.equal(des.alvo, id);
    assert.match(des.detalhe, /transactions/);
    assert.match(des.detalhe, /Movimentos/, 'com o nome legível ao lado');
    const feito = rasto.find((x) => x.acao === 'conta.servico.desligar.feito');
    assert.ok(feito && feito.alvo === id);
    assert.match(feito.detalhe, /recurring/, 'o feito diz quem caiu junto');
    const lig = rasto.filter((x) => x.acao === 'conta.servico.ligar');
    assert.equal(lig.length, 2, 'um ligar por PUT');
    assert.equal(lig[0].quem, 'm1');
    assert.equal(lig[0].alvo, id);
    assert.match(lig[0].detalhe, /transactions/);
    assert.match(lig[1].detalhe, /recurring/);

    // um PUT recusado também fica: a intenção e o falhou
    await mudar(env, SUPORTE, id, 'transactions', false);
    const r = await mudar(env, SUPORTE, id, 'recurring', true);
    assert.equal(r.status, 400);
    const ultimo = (await auditoria(env)).pop();
    assert.equal(ultimo.acao, 'conta.servico.ligar.falhou');
    assert.equal(ultimo.alvo, id);
    assert.match(ultimo.detalhe, /recurring: .*Movimentos/);

    // e o GET não escreve nada — listar não é mexer
    const antes = (await auditoria(env)).length;
    await listar(env, SUPORTE, id);
    assert.equal((await auditoria(env)).length, antes);
  });

  test('rotas: sem {ligado} no corpo é 400, e numa conta apagada é 409 — sem rasto', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    assert.equal((await chamar(env, SUPORTE, 'PUT', rota(id, 'fisco'), { ligado: 'sim' })).status, 400);
    assert.equal((await chamar(env, SUPORTE, 'PUT', rota(id, 'fisco'))).status, 400);
    await env.DB.prepare('UPDATE users SET deleted_at = ? WHERE id = ?').bind(Date.now(), id).run();
    assert.equal((await mudar(env, SUPORTE, id, 'fisco', false)).status, 409);
    assert.deepEqual(await servicosDesligados(env, id), []);
    assert.equal((await auditoria(env)).length, 0, 'nada disto chegou a mexer, logo nada no rasto');
  });
});

/* ----------------------------- permissões ------------------------------ */

describe('as permissões dos serviços', () => {
  test('permissões: suporte e master passam no GET e no PUT', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    for (const eu of [SUPORTE, MASTER]) {
      assert.equal((await listar(env, eu, id)).status, 200, eu.papel + ' lista');
      assert.equal((await mudar(env, eu, id, 'fisco', false)).status, 200, eu.papel + ' desliga');
      assert.equal((await mudar(env, eu, id, 'fisco', true)).status, 200, eu.papel + ' liga');
    }
  });

  test('permissões: comercial, marketing, dev, admin e uma sessão sem cargo recebem 403 no GET e no PUT', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    for (const eu of [COMERCIAL, MARKETING, DEV, ADMIN, SEM_CARGO, {}]) {
      const nome = eu.papel || 'sem cargo';
      assert.equal((await chamar(env, eu, 'GET', rota(id))).status, 403, nome + ' não lista');
      assert.equal((await mudar(env, eu, id, 'fisco', false)).status, 403, nome + ' não desliga');
      assert.equal((await mudar(env, eu, id, 'fisco', true)).status, 403, nome + ' não liga');
    }
    assert.deepEqual(await servicosDesligados(env, id), [], 'e nada mudou');
    assert.equal((await auditoria(env)).length, 0, 'nenhum chegou a mexer');
  });

  test('permissões: uma conta que não existe dá 404 no GET e no PUT', async () => {
    const env = ambiente();
    assert.equal((await chamar(env, SUPORTE, 'GET', rota('U9999999'))).status, 404);
    assert.equal((await mudar(env, MASTER, 'U9999999', 'fisco', false)).status, 404);
    assert.equal((await chamar(env, SUPORTE, 'GET', rota('id%20mau'))).status, 400, 'o que nem é um id é 400');
  });

  test('permissões: um serviço fora do catálogo dá 400 — as Definições incluídas, que são a base', async () => {
    const env = ambiente();
    const id = await novaConta(env);
    for (const s of ['xyz', 'settings', 'constructor', '__proto__']) {
      const r = await mudar(env, SUPORTE, id, s, false);
      assert.equal(r.status, 400, s);
      assert.match((await r.json()).error, /desconhecido/i, s);
    }
    assert.equal((await auditoria(env)).length, 0, 'um serviço que não existe não chega ao rasto');
  });
});

/* ------------------------------ o cartão ------------------------------- */

describe('o cartão «Serviços» na ficha', () => {
  // o JavaScript do browser vive no equipa-guiao.js desde que saiu do template literal da vista
  const vista = readFileSync(new URL('../worker/src/equipa-guiao.js', import.meta.url), 'utf8');

  test('a ficha do utilizador tem o cartão, um controlo por serviço com o nome legível, e chama as duas rotas', () => {
    assert.match(vista, /<b>Serviços<\/b>/);
    assert.match(vista, /verServicos\(q\.id\)/, 'a ficha pede o cartão');
    assert.match(vista, /'\/servicos'\)/, 'GET da lista');
    assert.match(vista, /'\/servicos\/' \+ encodeURIComponent\(servico\)[\s\S]{0,200}method: 'PUT'/, 'PUT por serviço');
    assert.match(vista, /esc\(s\.nome\)/, 'o nome legível vem da lista do servidor');
    assert.match(vista, /comAcao\('mudarServico', \[id, servico, ligar \? 'ligar' : 'desligar'\]\)/,
      'um botão por serviço, com a conta e o serviço em atributos data-* (cada um pelo esc)');
    assert.match(vista, /mudarServico: function \(d\) \{ mudarServico\(d\.arg, d\.arg2, d\.arg3 === 'ligar'\); \}/,
      'e a ação leva-os à função tal e qual');
    assert.match(vista, /Dependem dele: /, 'cada linha diz quem depende dele');
  });

  test('desligar pede confirmação e lista os dependentes que caem junto; ligar não pede', () => {
    const fn = vista.slice(vista.indexOf('function mudarServico('), vista.indexOf('/* ------------------------------- operação'));
    const ramo = fn.slice(fn.indexOf('if (!ligado) {'), fn.indexOf('pedir('));
    assert.match(ramo, /confirm\(aviso\)/, 'a confirmação está no ramo de desligar');
    assert.match(ramo, /dependentesDoServico\(servicosVistos, servico\)[\s\S]*s\.ligado/, 'os dependentes ainda ligados vão na confirmação');
    assert.match(ramo, /Desligam-se também/);
    assert.doesNotMatch(fn.slice(0, fn.indexOf('if (!ligado) {')), /confirm\(/, 'antes do ramo não há confirmação');
    assert.doesNotMatch(fn.slice(fn.indexOf('pedir(')), /confirm\(/, 'ligar segue direto para o servidor');
  });

  test('o texto explica o que desligar faz: o separador some, os dados deixam de sair, nada é apagado', () => {
    assert.match(vista, /tira esse separador da app/);
    assert.match(vista, /O separador some da app da pessoa/);
    assert.match(vista, /deixam de sair do servidor/);
    assert.match(vista, /nada é apagado/i);
    assert.match(vista, /ao ligar outra vez/, 'e diz que é reversível');
  });

  test('o guião servido ao suporte compila e traz o cartão', async () => {
    const html = await new Response(paginaEquipa(SUPORTE).body).text();
    assert.match(html, /<script src="\/equipa\/guiao\.js"><\/script>/, 'a página carrega o guião à parte');
    const guiao = await (await recursoDePagina('/equipa/guiao.js', 'GET', async () => true)).text();
    assert.doesNotThrow(() => new Function(guiao));
    for (const f of ['verServicos', 'dependentesDoServico', 'pintarServicos', 'mudarServico']) {
      assert.match(guiao, new RegExp('function ' + f + '\\('), f);
    }
    assert.match(guiao, /comAcao\('mudarServico', \[id, servico/, 'o guião chega ao browser tal como está escrito');
    assert.match(guiao, /a esta conta\?\\n\\n/, 'as quebras de linha da confirmação também');
  });
});
