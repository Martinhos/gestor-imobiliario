// O cartão do dia do Calendário cresce e encolhe com o painel (ticket e1dda4c0,
// KAN-4 passo 5: «a janela dos eventos do dia faz snap para o novo tamanho»).
//
// A caixa que o crescerEmAltura anima é o #calDiaPanel (.cal-dia), uma coluna
// flex transparente: o título, o cartão dos eventos e os botões. Medido no
// browser a 384×785 com toque, fotograma a fotograma: a ENCOLHER, o painel ia de 330.8 a
// 144.1px em 11 fotogramas, mas o cartão passava de 236.2 a 49.5px e os botões
// subiam 186.7px no primeiro — a sobra de altura ficava vazia por baixo dos
// botões, e o que se vê saltava; só o «Por confirmar» de baixo deslizava. A
// crescer já acompanhava (o overflow:hidden deixa o cartão encolher abaixo do
// conteúdo). A correção dá a sobra ao cartão durante a viagem
// (estilos.css:.cal-dia.a-crescer>.cal-dia-lista).
//
// O salto é de layout, e o arnês não tem layout: o que se prova aqui é que a
// regra existe, que vale para a caixa que o calSel e o calNav animam e para o
// cartão que lá está, e que só vale durante a viagem. A prova fotograma a
// fotograma é a do browser.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { carregarApp, repor, limpar } from './arnes.js';

const ler = (f) => fs.readFileSync(new URL('../web/' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CSS = ler('estilos.css');
const CSS_SEM_COMENTARIOS = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const CAL = ler('app/calendario.js');
const CONT = ler('app/continuidade.js');

const app = carregarApp({ hoje: '2026-11-09' });
afterEach(() => repor(app));

describe('o cartão do dia acompanha o painel a encolher', () => {
  test('durante a viagem o cartão fica com a sobra da coluna', () => {
    assert.match(CSS_SEM_COMENTARIOS, /\n\.cal-dia\.a-crescer>\.cal-dia-lista\{flex-grow:1\}/,
      'sem isto a sobra fica vazia por baixo dos botões e o cartão salta para o tamanho novo');
  });

  test('o painel é a coluna flex onde a sobra se reparte, e o cartão corta o que não cabe', () => {
    assert.match(CSS_SEM_COMENTARIOS, /\n\.cal-dia\{display:flex;flex-direction:column;/);
    // o overflow:hidden é o que deixa o cartão encolher abaixo do conteúdo, a crescer
    assert.match(CSS_SEM_COMENTARIOS, /\n\.cal-dia-lista\{[^}]*overflow:hidden/);
  });

  test('parado, o cartão tem a altura do que leva: a regra só existe com o .a-crescer', () => {
    const regras = CSS_SEM_COMENTARIOS.match(/[^{}]*\.cal-dia-lista[^{}]*\{[^}]*flex(-grow)?:[^}]*\}/g) || [];
    assert.equal(regras.length, 1, 'uma regra só: ' + regras.join(' | '));
    assert.match(regras[0], /\.a-crescer>/);
  });

  test('o cartão é filho direto do painel, em qualquer dia', () => {
    limpar(app);
    app.definirServicosDesligados([]);
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Arroios' })];
    app.db.recurring = [app.normRec({ id: 'R1', name: 'Renda Ana', next: '2026-11-12', every: 'month',
      tx: { kind: 'income', amount: 800, propertyId: 'P1', category: 'Rendas' } })];
    for (const dia of ['2026-11-12', '2026-11-13']) {
      const html = app.calDiaPanel(dia);
      assert.match(html, /^<div class="cal-dia" id="calDiaPanel">\s*<h2 class="cal-dia-tit">[^<]*<\/h2>\s*<div class="card cal-dia-lista">/,
        dia + ': o seletor .cal-dia.a-crescer>.cal-dia-lista tem de apanhar o cartão');
    }
  });

  test('a caixa que leva o .a-crescer é o #calDiaPanel, ao mudar de dia e ao mudar de mês', () => {
    assert.match(CAL, /function calSel\(iso\)\{[\s\S]*?crescerEmAltura\(\(\)=>document\.getElementById\('calDiaPanel'\),/);
    assert.match(CAL, /crescerEmAltura\(\s*\(\)=>document\.getElementById\('calDiaPanel'\),pintar,'--lento'\)/);
    assert.match(CONT, /function crescerEmAltura\(obter,pintar,token\)\{[\s\S]*?b\.classList\.add\('a-crescer'\);[\s\S]*?b\.classList\.remove\('a-crescer'\)/);
  });
});
