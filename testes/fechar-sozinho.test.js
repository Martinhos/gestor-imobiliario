// O «Fechar» sozinho no rodapé de uma janela é azul (primário), em todas; ao
// lado de outro botão é secundário (decisão do Martinho no KAN-22, depois da
// auditoria dos rodapés: era azul em três janelas e branco em cinco).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarTudo, repor } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));

const SO = /class="btn" data-toca="camada" data-click="closeModal\(\)">Fechar<\/button>[`'"]\)/;

describe('o Fechar sozinho', () => {
  test('na ficha: azul sem Editar, branco ao lado do Editar', () => {
    assert.match(app.fichaRodape({}), /^<button type="button" class="btn primary" data-toca="camada" data-click="closeModal\(\)">Fechar<\/button>$/);
    const com = app.fichaRodape({ editar: { act: 'x()', rotulo: 'Editar' } });
    assert.match(com, /^<button type="button" class="btn" data-toca="camada" data-click="closeModal\(\)">Fechar<\/button><button type="button" class="btn primary"/);
  });

  test('nenhuma janela abre com um Fechar branco sozinho no rodapé', () => {
    const ficheiros = ['web/app/contrato.js', 'web/app/creditos.js', 'web/app/imovel.js', 'web/app/saldos.js', 'web/app/tarefas.js', 'web/cloud/grupos.js'];
    for (const f of ficheiros) {
      const s = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
      assert.doesNotMatch(s, SO, f);
      assert.match(s, /class="btn primary" data-toca="camada" data-click="closeModal\(\)">Fechar<\/button>/, f + ': o azul');
    }
  });

  test('os rodapés condicionais: azul só quando ficam sozinhos', () => {
    const vistas = readFileSync(new URL('../web/app/vistas.js', import.meta.url), 'utf8');
    assert.match(vistas, /class="btn\$\{k\.acao\?'':' primary'\}" data-toca="camada" data-click="closeModal\(\)">Fechar/);
    const colab = readFileSync(new URL('../web/cloud/colaboradores.js', import.meta.url), 'utf8');
    assert.match(colab, /'<button class="btn' \+ \(ligado \? '' : ' primary'\) \+ '" data-toca="camada" data-click="closeModal\(\)">Fechar/);
    const notif = readFileSync(new URL('../web/app/notificacoes.js', import.meta.url), 'utf8');
    assert.match(notif, /\+aceitar:fechar\.replace\('class="btn"','class="btn primary"'\);/);
  });
});
