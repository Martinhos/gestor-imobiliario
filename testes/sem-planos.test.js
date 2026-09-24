// Não há planos.
//
// Havia três escalões (free, plus, pro), limites ao que cada um deixava criar,
// e um interruptor no back office que marcava a data em que passavam a valer.
// A intenção mudou: é um projeto pessoal, e a utilização é gratuita sem
// escalões nem limites.
//
// Isto guarda a decisão. Uma remoção destas espalha-se por quinze ficheiros e
// deixa pontas fáceis de não ver — um botão sem rota, uma rota sem botão, uma
// promessa nos termos sem nada que a cumpra.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const raiz = (p) => path.join(AQUI, '..', p);
const ler = (p) => fs.readFileSync(raiz(p), 'utf8');

describe('não há planos', () => {
  test('o módulo dos planos não existe, e ninguém o procura', () => {
    assert.ok(!fs.existsSync(raiz('worker/src/lib/planos.js')), 'o ficheiro saiu');
    const fontes = [
      'worker/src/lib/acesso.js', 'worker/src/rotas/casas.js', 'worker/src/rotas/sync.js',
      'worker/src/rotas/conta.js', 'worker/src/equipa-api.js', 'worker/src/auth.js',
      'worker/src/discord.js',
    ];
    fontes.forEach((f) => {
      assert.ok(!/planos\.js/.test(ler(f)), f + ' não importa os planos');
      assert.ok(!/\b(podeCriar|modoDemo|fimDemo|definirDemo|planoDosDonos)\b/.test(ler(f)),
        f + ' não usa nada dos planos');
    });
  });

  /* O 402 tinha exatamente três origens, todas de planos. Sem elas, um 402 que
     voltasse cairia no ramo genérico do cliente e punha o selo de sincronização
     a vermelho sem explicação — pior do que o que havia. */
  test('nenhuma rota devolve 402, e o cliente já não o trata', () => {
    ['worker/src/lib/acesso.js', 'worker/src/rotas/casas.js', 'worker/src/rotas/sync.js']
      .forEach((f) => assert.ok(!/\b402\b/.test(ler(f)), f + ' não emite 402'));
    const nucleo = ler('web/cloud/nucleo.js');
    assert.ok(!/_plano402|avisoPlano|_avisosPlano/.test(nucleo), 'o cliente não guarda recusas de plano');
    assert.ok(!/status === 402/.test(nucleo), 'nem classifica o 402');
  });

  /* O que NÃO saiu, e não pode sair por arrasto: o 403 vive na mesma cadeia de
     else-if e é o que diz a quem escreve num imóvel de colaboração sem
     permissão que o registo não subiu. */
  test('mas o caminho do 403 fica inteiro', () => {
    const nucleo = ler('web/cloud/nucleo.js');
    assert.match(nucleo, /function recusaRegisto/, 'a função fica');
    assert.match(nucleo, /r\.status === 403\) recusaRegisto/, 'e o ramo que lhe chama');
    assert.match(nucleo, /function descricaoDe/, 'e a descrição que ela usa');
    assert.match(nucleo, /_recusadas/, 'e o contador do else genérico');
  });

  test('o back office não tem interruptor nem ação de plano', () => {
    // o guião do browser do back office saiu da vista para equipa-guiao.js
    // (avaliação A.5-8); o que se procura pode estar num ou noutro
    const guiao = fs.existsSync(raiz('worker/src/equipa-guiao.js')) ? ler('worker/src/equipa-guiao.js') : '';
    const vista = ler('worker/src/equipa-vista.js') + '\n' + guiao;
    const api = ler('worker/src/equipa-api.js');
    assert.ok(!/mudarDemo|Modo de demonstração|Marcar o fim/.test(vista), 'o cartão saiu da vista');
    assert.ok(!/Mudar plano|acao === 'plano'/.test(vista), 'e o botão do plano também');
    assert.ok(!/operacao\/demo/.test(api), 'a rota do interruptor saiu');
    assert.ok(!/async plano\(/.test(api), 'a ação de conta saiu');
    /* o master fica: é ele que decide o botão «Criar endereço» no cartão dos
       endereços, e é fácil levá-lo à frente com os campos do demo */
    assert.match(api, /master: eMaster\(eu\)/, 'o campo master fica na resposta');
    assert.match(vista, /d\.master/, 'e a vista continua a lê-lo');
  });

  /* A coluna users.plan NÃO se apaga: a D1 não tem DROP COLUMN reversível, e o
     restaurar.js constrói o INSERT com as colunas do despejo — uma coluna a
     menos partia a reposição de qualquer cópia tirada antes disto. */
  test('nenhuma migração apaga a coluna users.plan', () => {
    const dir = raiz('migrations');
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).forEach((f) => {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      assert.ok(!/DROP\s+COLUMN\s+plan\b/i.test(sql), f + ' não apaga a coluna');
    });
  });

  test('os termos não prometem limites nem avisos de 30 dias', () => {
    const legal = ler('web/legal.js');
    assert.ok(!/limites de utilização|limites técnicos de utilização/.test(legal),
      'nenhum limite prometido');
    assert.ok(!/30 dias de antecedência/.test(legal), 'nenhum aviso prometido');
    assert.match(legal, /não há subscrições/, 'e continua a dizer que é gratuito');
    // e o ecrã da re-aceitação não manda ler o que já lá não está
    assert.ok(!/os planos e a fase/.test(ler('web/cloud/ajuda.js')), 'o portão dos termos não fala de planos');
  });

  test('nenhum ecrã da app nomeia um escalão', () => {
    ['web/cloud/partilha.js', 'web/cloud/entrada.js', 'web/cloud/ajuda.js'].forEach((f) => {
      assert.ok(!/plano <b>Plus<\/b>|plano Plus|avisoFimDemo|fimDemoVisto/.test(ler(f)),
        f + ' não fala de escalões');
    });
  });
});
