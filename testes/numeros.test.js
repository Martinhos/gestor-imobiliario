// Formatação e leitura de números, e os números por extenso dos contratos.
// Um contrato em PDF com o valor escrito por extenso errado é um problema real.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp } from './arnes.js';

const app = carregarApp();
const ESPACO = ' ';   // espaço fino, o separador de milhares da app

describe('mostrar dinheiro', () => {
  test('usa vírgula decimal e euro no fim', () => {
    assert.equal(app.euro2(1234.5), '1' + ESPACO + '234,50' + ESPACO + '€');
    assert.equal(app.euro(1234), '1' + ESPACO + '234' + ESPACO + '€');
  });

  test('arredonda sem casas decimais quando não são pedidas', () => {
    assert.equal(app.euro(1234.6), '1' + ESPACO + '235' + ESPACO + '€');
  });

  test('negativos levam o sinal de menos tipográfico', () => {
    assert.ok(app.euro2(-50).startsWith('−'), 'menos a sério, não um hífen');
  });

  test('zero e valores inválidos não rebentam', () => {
    assert.equal(app.euro(0), '0' + ESPACO + '€');
    assert.equal(app.euro(null), '0' + ESPACO + '€');
    assert.equal(app.euro(undefined), '0' + ESPACO + '€');
    assert.equal(app.euro(NaN), '0' + ESPACO + '€');
  });

  test('milhões ficam legíveis', () => {
    assert.equal(app.euro(1234567), '1' + ESPACO + '234' + ESPACO + '567' + ESPACO + '€');
  });
});

describe('ler números escritos por pessoas', () => {
  test('aceita a forma portuguesa', () => {
    assert.equal(app.num('1.234,56'), 1234.56);
    assert.equal(app.num('1234,56'), 1234.56);
  });

  test('aceita a forma inglesa', () => {
    assert.equal(app.num('1,234.56'), 1234.56);
    assert.equal(app.num('1234.56'), 1234.56);
  });

  test('ignora o que não é número', () => {
    assert.equal(app.num('1 250 €'), 1250);
    assert.equal(app.num('  850,00  '), 850);
  });

  test('negativos e vazios', () => {
    assert.equal(app.num('-99,5'), -99.5);
    assert.equal(app.num(''), 0);
    assert.equal(app.num(null), 0);
    assert.equal(app.num('abc'), 0);
  });

  test('um número já é um número', () => {
    assert.equal(app.num(42.5), 42.5);
  });

  test('pontos a separar milhares não viram decimais', () => {
    // era um bug: 250.000 dava 250, e o valor de um imóvel perdia tres casas
    assert.equal(app.num('1.234'), 1234);
    assert.equal(app.num('250.000'), 250000);
    assert.equal(app.num('12.345.678'), 12345678);
  });

  test('um ponto com poucas casas continua a ser decimal', () => {
    assert.equal(app.num('1.5'), 1.5);
    assert.equal(app.num('1.23'), 1.23);
  });
});

describe('percentagens', () => {
  test('mostra a fração como percentagem', () => {
    assert.equal(app.pct(0.055), '5,5%');
    assert.equal(app.pct(0.5, 0), '50%');
  });

  test('valores impossíveis aparecem como travessão', () => {
    assert.equal(app.pct(NaN), '—');
    assert.equal(app.pct(Infinity), '—');
  });
});

describe('números por extenso', () => {
  test('unidades, dezenas e centenas', () => {
    assert.equal(app.extenso(1), 'um');
    assert.equal(app.extenso(15), 'quinze');
    assert.equal(app.extenso(21), 'vinte e um');
    assert.equal(app.extenso(100), 'cem');
    assert.equal(app.extenso(101), 'cento e um');
    assert.equal(app.extenso(999), 'novecentos e noventa e nove');
  });

  test('milhares e milhões', () => {
    assert.equal(app.extenso(1000), 'mil');
    assert.equal(app.extenso(1500), 'mil e quinhentos');
    assert.equal(app.extenso(2000), 'dois mil');
    assert.ok(/milh/.test(app.extenso(1000000)), 'um milhão aparece como milhão');
  });

  test('valores em euros levam a moeda e os cêntimos', () => {
    assert.ok(/euros/.test(app.euroExtenso(1250)), '1250 -> euros');
    assert.ok(/cêntimos|centimos/i.test(app.euroExtenso(1250.5)), 'com cêntimos');
    assert.ok(/^um euro/.test(app.euroExtenso(1)), 'singular no um');
  });

  test('zero tem nome', () => {
    assert.equal(app.extenso(0), 'zero');
  });
});

describe('tamanhos de ficheiro', () => {
  test('kilobytes e megabytes', () => {
    assert.equal(app.kb(2048), '2 KB');
    assert.equal(app.kb(1572864), '1,5 MB');
  });

  test('ficheiros minúsculos mostram pelo menos 1 KB', () => {
    assert.equal(app.kb(10), '1 KB');
  });
});

describe('formatação de identificadores', () => {
  test('IBAN em grupos de quatro', () => {
    assert.equal(app.fmtIBAN('PT50000201231234567890154'), 'PT50 0002 0123 1234 5678 9015 4');
  });

  test('NIF em grupos de três', () => {
    assert.equal(app.fmtNIF('123456789'), '123 456 789');
  });

  test('telemóvel português leva o indicativo', () => {
    assert.equal(app.fmtPhone('912345678'), '+351 912 345 678');
  });
});
