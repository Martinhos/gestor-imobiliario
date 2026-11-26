// As referências do guia «IRS das rendas» (worker/src/guia-vista.js, KAN-164).
//
// O ticket do Martinho: cada referência a uma fonte é uma ligação no próprio
// texto; a legislação liga sempre ao Diário da República, e o que é da AT
// (ofícios-circulados, informações vinculativas, instruções, folhetos, o
// Portal) liga à AT. Este módulo diz o que conta como referência e onde cada
// ligação pode levar; usa-o o testes/guia-ligacoes.test.js, e a prova do
// scope kanban-11-26 (.unlazy/kanban-11-26/guia/prova.mjs). Não é um teste
// (não acaba em .test.js): o npm test não o corre sozinho.

export const DOMINIO_DR = 'diariodarepublica.pt';
export const DOMINIOS_AT = ['info.portaldasfinancas.gov.pt', 'irs.portaldasfinancas.gov.pt'];

/* O que, no texto, é uma referência a uma fonte: um artigo, um número ou uma
   alínea, um diploma, um código, o EBF, o NRAU, um ofício-circulado, um
   processo ou uma informação vinculativa, umas instruções, o folheto, a
   posição expressa da AT. */
export const PADROES = [
  /\bartigos?\s+\d/i,
  /\bn\.(?:º|os)\s*\d/,
  /\bal[ií]nea\s+[a-z]\)/,
  /\b(?:Decreto-Lei|Lei|Portaria|Decreto)\s+n\.º/,
  /\bof[ií]cio-circulado/i,
  /\bprocessos?\s+\d/,
  /\binforma[çc](?:ão|ões)\s+vinculativas?/i,
  /\binstru[çc]ões/i,
  /C[óo]digo do (?:IRS|IMI|IVA|Imposto)/,
  /Estatuto dos Benef[íi]cios Fiscais/,
  /Regime do Arrendamento Urbano/,
  /\bfolheto\b/i,
  /posi[çc]ão expressa da AT/,
];

/* As menções que não são referências a uma fonte, cada uma com a razão. São
   tiradas do texto, à letra, antes de se procurar o que ficou sem ligação. */
export const EXCECOES = [
  ['«Sem retenção, nos termos do n.º 1 do artigo 101.º-B do Código do IRS.»', 'o texto que se escreve no recibo, à letra'],
  ['e as informações vinculativas da AT', 'a doutrina da AT em geral, na introdução da parte 4'],
  ['Pelas informações vinculativas mais recentes da AT (', 'os dois processos vêm logo a seguir, cada um em ligação'],
  ['(informações vinculativas, ', 'os dois processos vêm logo a seguir, cada um em ligação'],
  ['ou uma informação vinculativa', 'pedir uma à AT, não citar uma'],
  ['As informações vinculativas que a AT publica', 'a nota de segurança, em geral'],
  ['uma informação vinculativa pedida por ti', 'a nota de segurança, em geral'],
  ['antes do Regime do Arrendamento Urbano (o RAU, do ', 'o decreto-lei do RAU vem logo a seguir, em ligação'],
  ['nas instruções do modelo do teu ano','o modelo de um ano que ainda não saiu'],
  ['nas instruções dele', 'o modelo de um ano que ainda não saiu'],
];

// o texto de uma ligação que diz que é da AT (é o primeiro a decidir) e o que diz que é legislação; a
// segunda de duas ligações seguidas pode ser só o número («processos 1115/2017 e 4074/2017», «artigos
// 22.º, n.º 3, e 72.º»): um número de processo sozinho é da AT, um número de artigo sozinho é lei
const DA_AT = /[Ii]nstru[çc]|[Oo]f[ií]cio|[Ii]nforma[çc]|processo|folheto|posição expressa|\bAT\b|Portal das Finanças|\bAnexo [A-Z]\b|^\d+\/\d{4}$/;
const DA_LEI = /artigo|Decreto-Lei|\bLei\b|Portaria|Código|Estatuto|Regime|^\d+\.º/;

/* O conteúdo da página, o <main>.
   Recebe: html — a página. Devolve: o HTML de dentro do <main>. */
function principal(html) {
  const i = html.indexOf('<main'), j = html.indexOf('</main>');
  return i >= 0 && j > i ? html.slice(i, j) : html;
}

/* Recebe: h — HTML. Devolve: o texto visível, com os espaços juntos. */
const textoDe = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');

/* As ligações para fora do <main>, com o texto e os atributos.
   Recebe: html — a página. Devolve: [{href, texto, classe, target, rel}]. */
export function ligacoesParaFora(html) {
  return [...principal(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => {
    const at = (n) => (new RegExp('\\s' + n + '="([^"]*)"').exec(m[1]) || [])[1];
    return { href: at('href') || '', texto: textoDe(m[2]).trim(), classe: at('class') || '', target: at('target'),
      rel: at('rel') };
  }).filter((l) => /^https?:/.test(l.href) && !/^https:\/\/(?:app\.)?rendorium\.com\b/.test(l.href));
}

/* As referências que ficaram sem ligação: o texto do <main> sem as
   ligações e sem as exceções, e o que nele ainda parece uma referência.
   Recebe: html — a página. Devolve: [{padrao, contexto}]. */
export function referenciasSemLigacao(html) {
  let t = textoDe(principal(html).replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, ' [ligação] '));
  for (const [e] of EXCECOES) t = t.split(e).join(' [exceção] ');
  const achadas = [];
  for (const re of PADROES) {
    for (const m of t.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      achadas.push({ padrao: re.source, contexto: t.slice(Math.max(0, m.index - 60), m.index + 60).trim() });
    }
  }
  return achadas;
}

/* O sítio a que uma ligação tem de levar, pelo texto dela.
   Recebe: texto — o texto da ligação. Devolve: 'at', 'dr' ou null (não se sabe). */
export function tipoDaLigacao(texto) {
  if (DA_AT.test(texto)) return 'at';
  if (DA_LEI.test(texto)) return 'dr';
  return null;
}

/* Tudo o que está errado nas ligações para fora: um domínio que não é o DR
   nem a AT, a legislação fora do DR, o da AT fora da AT, uma ligação sem
   tipo, e o padrão das ligações para fora (outra aba, noopener noreferrer).
   Recebe: html — a página. Devolve: [texto de cada problema]. */
export function problemasDasLigacoes(html) {
  const p = [];
  for (const l of ligacoesParaFora(html)) {
    let host = '';
    try { host = new URL(l.href).host; } catch { p.push('endereço inválido: ' + l.href); continue; }
    const dr = host === DOMINIO_DR, at = DOMINIOS_AT.includes(host);
    if (!dr && !at) p.push('fora do DR e da AT: «' + l.texto + '» → ' + l.href);
    const tipo = tipoDaLigacao(l.texto);
    if (tipo === 'dr' && !dr) p.push('legislação fora do Diário da República: «' + l.texto + '» → ' + l.href);
    if (tipo === 'at' && !at) p.push('da AT fora da AT: «' + l.texto + '» → ' + l.href);
    if (!tipo) p.push('ligação sem tipo (nem lei nem AT): «' + l.texto + '» → ' + l.href);
    if (l.target !== '_blank' || l.rel !== 'noopener noreferrer') p.push('sem o padrão das ligações para fora: «' + l.texto + '»');
  }
  return p;
}
