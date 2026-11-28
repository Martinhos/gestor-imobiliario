// As ligações do guia «IRS das rendas» à lei abrem o documento no artigo (KAN-164, reaberto).
//
// O comentário do Martinho ao ticket de QA #457D3B07 (27/11/2026): «O link
// deve ser para o documento no Diário da República, e não para o artigo em
// si. O link para o artigo só diz se o artigo está em vigor. Devo poder ler
// o artigo (no documento).» No telemóvel, a página de um artigo no DR
// (…/legislacao-consolidada/<tipo>/<ano>-<id>-<versão>) abre nos
// «Relacionados» e no «Em vigor»; o documento consolidado tem o texto
// inteiro, mas não tem âncoras (os ids dos artigos mudam a cada carga e o
// índice leva à página do artigo). Por isso cada artigo liga ao documento com
// um fragmento de texto, #:~:text=<título>-,<epígrafe>, que o browser
// procura e põe à vista, realçado, quando o acha a tempo (o DR desenha o
// texto tarde; senão abre no topo do documento). O que aqui se guarda: nenhuma ligação à
// página de um artigo, cada fonte que é um artigo leva ao documento com o
// fragmento, e o fragmento diz o título e a epígrafe, bem codificados.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paginaGuia, FONTES } from '../worker/src/guia-vista.js';
import { ligacoesParaFora } from './guia-referencias.js';

const html = await paginaGuia({ raiz: true }).text();
const daPagina = ligacoesParaFora(html).map((l) => ({ ...l, href: l.href.replace(/&amp;/g, '&') }));
const PAGINA_DO_ARTIGO = /\/legislacao-consolidada\/[a-z-]+\/\d{4}-\d+-\d+(?:[?#]|$)/;
const ehArtigoDoDR = (f) => f.url.startsWith('https://diariodarepublica.pt/dr/') && /\b(?:artigos?|anexo)\s+[\dIVXL]/i.test(f.nome);

/* O fragmento de texto de um endereço.  Recebe: u — o endereço.
   Devolve: {doc, titulo, epigrafe} ou null. */
function fragmento(u) {
  const m = /^([^#]+)#:~:text=([^&,]+)-,([^&,]+)$/.exec(u);
  return m ? { doc: m[1], titulo: decodeURIComponent(m[2]), epigrafe: decodeURIComponent(m[3]) } : null;
}

/* As ligações da página que levam à página de um artigo.  Recebe: h — o HTML.
   Devolve: [href]. */
const aPaginasDeArtigo = (h) => ligacoesParaFora(h).map((l) => l.href).filter((u) => PAGINA_DO_ARTIGO.test(u));

describe('as ligações à lei abrem o documento no artigo', () => {
  test('nenhuma ligação leva à página de um artigo', () => {
    assert.deepEqual(aPaginasDeArtigo(html), []);
    // e o detetor apanha uma: com o endereço de antes do artigo 8.º do Código do IRS, falha
    const cirs8 = FONTES.find((f) => f.id === 'cirs8');
    const antes = html.split(cirs8.url.replace(/&/g, '&amp;')).join('https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2014-70048167-131546759');
    assert.ok(aPaginasDeArtigo(antes).length >= 2, 'o endereço de antes aparece no texto e na lista');
  });

  test('cada fonte que é um artigo leva ao documento, com o título e a epígrafe no fragmento', () => {
    const artigos = FONTES.filter(ehArtigoDoDR);
    assert.ok(artigos.length >= 42, 'os artigos do DR: ' + artigos.length);
    for (const f of artigos) {
      const fr = fragmento(f.url);
      assert.ok(fr, 'com o fragmento de texto: ' + f.id + ' → ' + f.url);
      assert.match(fr.doc, /^https:\/\/diariodarepublica\.pt\/dr\/(?:legislacao-consolidada\/[a-z-]+\/\d{4}-\d+|detalhe\/[a-z-]+\/[\da-z-]+)$/, f.id);
      assert.match(fr.titulo, /^(?:Artigo \d+\.º(?:-[A-Z]+)?|Anexo [IVXL]+)$/, f.id);
      assert.ok(fr.epigrafe.length >= 5, 'com a epígrafe: ' + f.id);
      // o título do fragmento é o artigo que o nome da fonte diz
      const n = /\b(?:artigos?|anexo)\s+([\dIVXL]+\.?º?(?:-[A-Z]+)?)/i.exec(f.nome)[1];
      assert.ok(fr.titulo.endsWith(' ' + n), f.id + ': «' + fr.titulo + '» é o ' + n + ' do nome');
    }
  });

  test('as ligações do texto e da lista são as das fontes, com o mesmo fragmento', () => {
    const urls = new Set(FONTES.map((f) => f.url));
    for (const l of daPagina) assert.ok(urls.has(l.href), 'de uma fonte: ' + l.href);
    // os artigos que o texto cita levam ao documento no artigo, e o texto da ligação diz o artigo
    for (const [texto, titulo, epigrafe, doc] of [
      ['artigo 8.º, n.º 1, do Código do IRS', 'Artigo 8.º', 'Rendimentos da categoria F', 'lei/2014-70048167'],
      ['artigo 45.º-C do Estatuto dos Benefícios Fiscais', 'Artigo 45.º-C', 'Rendimentos prediais no âmbito do arrendamento para habitação', 'decreto-lei/1989-34554075'],
      ['artigo 113.º, n.º 1, do Código do IMI', 'Artigo 113.º', 'Competência e prazo da liquidação', 'decreto-lei/2003-34499575'],
      ['artigo 53.º do Código do IVA', 'Artigo 53.º', 'Âmbito de aplicação no território nacional', 'decreto-lei/2008-34500675'],
      ['artigo 60.º, n.os 1 e 4, do Código do Imposto do Selo', 'Artigo 60.º', 'Contratos de arrendamento', 'lei/1999-34540175'],
    ]) {
      const l = daPagina.find((x) => x.texto === texto);
      assert.ok(l, 'em ligação: ' + texto);
      assert.deepEqual(fragmento(l.href), { doc: 'https://diariodarepublica.pt/dr/legislacao-consolidada/' + doc, titulo, epigrafe }, texto);
    }
    // as duas portarias sem versão consolidada de que o texto cita um artigo abrem o diploma publicado nesse artigo
    for (const [texto, titulo] of [['Portaria n.º 454/2026/1, artigo 7.º, n.º 3', 'Artigo 7.º'], ['Portaria n.º 104/2026/1, artigos 2.º e 3.º', 'Artigo 2.º']]) {
      const l = daPagina.find((x) => x.texto === texto);
      assert.ok(l && fragmento(l.href), 'no artigo: ' + texto);
      assert.match(fragmento(l.href).doc, /\/dr\/detalhe\/portaria\//, texto);
      assert.equal(fragmento(l.href).titulo, titulo, texto);
    }
    // o diploma citado inteiro continua a abrir o documento, sem fragmento
    assert.equal(fragmento(daPagina.find((x) => x.texto === 'Portaria n.º 104/2026/1').href), null);
  });

  test('o fragmento codifica o hífen, a vírgula e o resto, e o HTML escapa o endereço', () => {
    const ebf45c = FONTES.find((f) => f.id === 'ebf45c').url;
    assert.match(ebf45c, /#:~:text=Artigo%2045\.%C2%BA%2DC-,/, 'o hífen do «45.º-C» não parte o fragmento');
    const cirs4 = FONTES.find((f) => f.id === 'cirs4').url;
    assert.ok(cirs4.includes('industriais%2C%20agr%C3%ADcolas'), 'a vírgula da epígrafe vai codificada');
    assert.equal(fragmento(cirs4).epigrafe, 'Atividades comerciais e industriais, agrícolas, silvícolas e pecuárias');
    // no HTML, o endereço é o mesmo (nada a escapar) e abre noutra aba, como as outras ligações para fora
    assert.ok(html.includes('href="' + ebf45c + '" target="_blank" rel="noopener noreferrer"'));
  });
});
