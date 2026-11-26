// As referências do guia «IRS das rendas» são ligações no próprio texto (KAN-164).
//
// O ticket do Martinho (QA, #457D3B07): «todas as referências devem estar
// inline», com uma ligação para a fonte; a legislação sempre no Diário da
// República. O que aqui se guarda: nenhuma referência fica só em texto, a
// lei liga ao DR, o que é da AT liga à AT, as ligações para fora abrem
// noutra aba sem dar acesso a esta página, e cada uma é das fontes da lista.
// O que conta como referência, e as menções que não o são, estão em
// testes/guia-referencias.js; os endereços abriram-se um a um a 2026-11-26,
// e a lista com o resultado de cada um ficou no registo do KAN-164.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paginaGuia, CSS_GUIA } from '../worker/src/guia-vista.js';
import { referenciasSemLigacao, problemasDasLigacoes, ligacoesParaFora, tipoDaLigacao, DOMINIO_DR } from './guia-referencias.js';

const html = await paginaGuia({ raiz: true }).text();
const noTexto = ligacoesParaFora(html).filter((l) => l.classe === 'ref');

describe('as referências do guia, cada uma com a ligação à fonte', () => {
  test('nenhuma referência fica só em texto', () => {
    assert.deepEqual(referenciasSemLigacao(html), []);
    assert.ok(noTexto.length >= 120, 'as referências do texto são ligações: ' + noTexto.length);
  });

  test('a lei liga ao Diário da República, o da AT à AT, e todas abrem noutra aba', () => {
    assert.deepEqual(problemasDasLigacoes(html), []);
    for (const l of noTexto) assert.ok(tipoDaLigacao(l.texto), 'a ligação diz o que é: «' + l.texto + '»');
    // os artigos dos códigos levam ao artigo na versão consolidada do DR, e não à AT
    for (const t of ['artigo 8.º, n.º 1, do Código do IRS', 'artigo 45.º-C do Estatuto dos Benefícios Fiscais',
      'artigo 113.º, n.º 1, do Código do IMI', 'artigo 53.º do Código do IVA', 'artigo 60.º, n.os 1 e 4, do Código do Imposto do Selo']) {
      const l = noTexto.find((x) => x.texto === t);
      assert.ok(l, 'em ligação: ' + t);
      assert.match(l.href, /^https:\/\/diariodarepublica\.pt\/dr\/legislacao-consolidada\/[a-z-]+\/\d{4}-\d+-\d+$/, t);
    }
    // os ofícios-circulados e as informações vinculativas na AT
    for (const t of ['Ofício-Circulado n.º 20256, de 7 de junho de 2023, ponto 4', 'informação vinculativa, processo 615/2016']) {
      assert.match(noTexto.find((x) => x.texto === t).href, /^https:\/\/info\.portaldasfinancas\.gov\.pt\//, t);
    }
  });

  test('o texto de cada ligação é a referência, nunca «aqui»', () => {
    for (const l of noTexto) assert.doesNotMatch(l.texto, /^(?:aqui|ver|link|ligação)$/i, l.texto);
    assert.ok(noTexto.filter((l) => new URL(l.href).host === DOMINIO_DR).length > noTexto.length / 2, 'a maior parte é lei');
  });

  test('cada ligação do texto é uma das fontes da lista do fim', () => {
    const lista = new Set([.../<ul class="fontes">([\s\S]*?)<\/ul>/.exec(html)[1].matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
    for (const l of noTexto) assert.ok(lista.has(l.href), 'fora da lista de fontes: ' + l.href);
    // e a lista não tem nenhuma que o texto não use, salvo a página de apoio e o fundo de reserva (só da parte 4)
    const usados = new Set(ligacoesParaFora(html).filter((l) => l.classe !== '').map((l) => l.href));
    const soNaLista = [...lista].filter((u) => !usados.has(u));
    assert.deepEqual(soNaLista.map((u) => u.replace(/^.*\//, '')), ['default.aspx', 'PIV_27168.pdf']);
  });

  test('as ligações do texto têm o seu estilo, e o hover só com rato', () => {
    assert.match(CSS_GUIA, /\.ref\{text-decoration-thickness:1px;text-underline-offset:2px\}/);
    assert.match(CSS_GUIA, /@media\(hover:hover\) and \(pointer:fine\)\{[^@]*a\.ref:hover\{text-decoration-thickness:2px\}/);
  });

  /* O teste tem de falhar sem as ligações: tirada uma, o detetor apanha-a;
     uma lei a ligar à AT, ou uma ligação sem a nova aba, também. */
  test('o detetor apanha uma referência sem ligação, uma lei fora do DR e uma ligação sem o padrão', () => {
    const a = /<a class="ref" href="[^"]*diariodarepublica[^"]*"[^>]*>([^<]*)<\/a>/.exec(html);
    const semLigacao = referenciasSemLigacao(html.replace(a[0], a[1]));
    assert.equal(semLigacao.length >= 1, true, 'sem a ligação, a referência aparece');
    assert.match(semLigacao[0].contexto, new RegExp(a[1].replace(/[.()]/g, '\\$&').slice(0, 20)));
    const naAT = a[0].replace(/href="[^"]*"/, 'href="https://info.portaldasfinancas.gov.pt/x.aspx"');
    assert.match(problemasDasLigacoes(html.replace(a[0], naAT)).join('\n'), /legislação fora do Diário da República/);
    assert.match(problemasDasLigacoes(html.replace(a[0], a[0].replace(' target="_blank"', ''))).join('\n'), /sem o padrão/);
    // e sem nenhuma ligação no texto, falha por todo o lado
    const nua = html.replace(/<a class="ref"[^>]*>([^<]*)<\/a>/g, '$1');
    assert.ok(referenciasSemLigacao(nua).length >= 100, 'sem as ligações, mais de cem referências soltas');
  });
});
