// A tabela das freguesias repostas em outubro de 2025 (irs-freguesias-2025.js,
// vaga 3 do IRS, folha 2.3.10, KAN-128, D135): as 135 uniões extintas pela
// Lei 25-A/2025 e as freguesias repostas de cada uma, da tabela de
// correspondência da AT, e o freguesiaReposta que diz se um código é de uma
// união extinta. As contagens medem-se contra a própria tabela.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, repor } from './arnes.js';

const app = carregarApp({ hoje: '2027-05-10' });
afterEach(() => repor(app));

// o que vem do contexto da app não partilha protótipos com o do teste
const json = (x) => JSON.parse(JSON.stringify(x));
const TABELA = json(app.IRS_FREGUESIAS_2025);
const linhas = TABELA.reduce((n, l) => n + l[2].length, 0);
const codigosNovos = new Set(TABELA.flatMap((l) => l[2].map((r) => r[0])));

describe('a tabela da AT', () => {
  test('tem as 135 uniões, 303 linhas e 302 códigos novos, em 70 concelhos', () => {
    assert.equal(TABELA.length, 135, 'uniões extintas');
    assert.equal(linhas, 303, 'freguesias repostas, uma linha cada');
    assert.equal(codigosNovos.size, 302, 'códigos novos distintos');
    assert.equal(new Set(TABELA.map((l) => l[0].slice(0, 4))).size, 70, 'concelhos (distrito e concelho do código)');
    assert.equal(new Set(TABELA.map((l) => l[0])).size, 135, 'nenhuma união repetida');
  });

  test('a freguesia de Bicos (Odemira) repõe-se a partir de duas uniões, e é por isso que são 303 linhas e 302 códigos', () => {
    const comBicos = TABELA.filter((l) => l[2].some((r) => r[0] === '021123'));
    assert.deepEqual(comBicos.map((l) => l[0]), ['021118', '021122']);
    assert.equal(linhas - codigosNovos.size, 1);
  });

  test('cada código tem 6 caracteres, e nenhum código novo é o de uma união nem o de outra freguesia', () => {
    const unioes = new Set(TABELA.map((l) => l[0]));
    for (const [u, nome, repostas] of TABELA) {
      assert.match(u, /^[0-9A-Z]{6}$/, 'a união ' + u);
      assert.ok(nome && nome === nome.trim(), 'o nome da união ' + u);
      assert.ok(repostas.length >= 1, 'a união ' + u + ' tem freguesias repostas');
      for (const [c, n] of repostas) {
        assert.match(c, /^[0-9A-Z]{6}$/, 'a reposta ' + c);
        assert.ok(n && n === n.trim(), 'o nome da reposta ' + c);
        assert.ok(!unioes.has(c), 'a reposta ' + c + ' repete o código de uma união');
        assert.equal(c.slice(0, 4), u.slice(0, 4), 'a reposta ' + c + ' fica no concelho da união ' + u);
      }
    }
  });
});

describe('freguesiaReposta', () => {
  test('uma união extinta dá-se com as freguesias repostas (os exemplos da AT)', () => {
    assert.deepEqual(json(app.freguesiaReposta('010123')), {
      uniao: { codigo: '010123', nome: 'UNIÃO DAS FREGUESIAS DE BELAZAIMA DO CHÃO, CASTANHEIRA DO VOUGA E AGADÃO' },
      repostas: [
        { codigo: '010128', nome: 'Agadão' },
        { codigo: '010132', nome: 'Belazaima do Chão' },
        { codigo: '010134', nome: 'Castanheira do Vouga' },
      ],
    });
    const codigos = (c) => json(app.freguesiaReposta(c)).repostas.map((r) => r.codigo);
    assert.deepEqual(codigos('130812'), ['130818', '130820'], 'Matosinhos e Leça da Palmeira');
    assert.deepEqual(codigos('131727'), ['131736', '131747'], 'Mafamude e Vilar do Paraíso');
    assert.equal(json(app.freguesiaReposta('130812')).repostas[1].nome, 'Matosinhos');
  });

  test('um código que não é o de uma união dá null: o de uma freguesia reposta, o inventado, e o que nem é um código', () => {
    assert.equal(app.freguesiaReposta('010128'), null, 'uma freguesia reposta não é uma união');
    assert.equal(app.freguesiaReposta('999999'), null);
    assert.equal(app.freguesiaReposta('01012'), null, 'curto');
    assert.equal(app.freguesiaReposta('0101234'), null, 'longo');
    for (const mau of ['', '   ', null, undefined, {}, [], [' 010123'], true, NaN, () => 1, 10123]) {
      assert.equal(app.freguesiaReposta(mau), null, 'não lança com ' + String(mau));
    }
  });

  test('o código aceita-se em minúsculas e com espaços, como se escreve no telemóvel', () => {
    assert.equal(json(app.freguesiaReposta('0302fe')).uniao.codigo, '0302FE');
    assert.deepEqual(json(app.freguesiaReposta(' 0302 fe ')).repostas.map((r) => r.codigo), ['0302FJ', '0302FK']);
    assert.equal(json(app.freguesiaReposta('  010123\n')).uniao.codigo, '010123');
    assert.equal(json(app.freguesiaReposta(130812)).uniao.codigo, '130812', 'um número com os 6 dígitos');
  });

  test('cada união da tabela responde com as suas linhas, e o resultado é uma cópia', () => {
    for (const [u, nome, repostas] of TABELA) {
      assert.deepEqual(json(app.freguesiaReposta(u)), {
        uniao: { codigo: u, nome },
        repostas: repostas.map(([codigo, n]) => ({ codigo, nome: n })),
      });
    }
    const a = app.freguesiaReposta('010123');
    a.repostas.pop();
    a.uniao.nome = 'outro';
    const b = json(app.freguesiaReposta('010123'));
    assert.equal(b.repostas.length, 3, 'mexer no resultado não estraga a tabela');
    assert.match(b.uniao.nome, /^UNIÃO DAS FREGUESIAS DE BELAZAIMA/);
    assert.equal(linhas, 303);
  });
});
