/* Os CSS e os JavaScript das páginas que o worker escreve.
   -------------------------------------------------------
   A landing, os documentos legais, os docs, o back office e a entrada de
   teste respondem com a CSP_ESTRITA (lib/http.js), que não deixa correr
   script nem aplicar estilos escritos dentro do HTML. O que lá estava em
   linha passou para ficheiros da mesma origem, e é este módulo que os serve.

   Nenhum destes caminhos existe em web/, por isso os assets não respondem e
   o pedido chega ao worker. O index.js pergunta aqui antes de tudo o resto —
   antes até do reencaminhamento do domínio raiz para a app, que é onde a
   landing e os documentos legais vivem.

   O acesso fica como estava: o que só ia dentro de páginas da equipa (o
   guião do back office, os docs) só se entrega a quem tem sessão de equipa;
   o resto é de quem abre as páginas públicas. Cada texto vive no módulo da
   sua página e só se carrega quando é pedido. */

const CSS = 'text/css; charset=utf-8';
const JS = 'text/javascript; charset=utf-8';

/* caminho → { tipo, sessao, texto }. `sessao` marca o que só a equipa
   recebe; `texto` vai buscar o conteúdo ao módulo da página. */
const RECURSOS = {
  '/paginas/landing.css': { tipo: CSS, texto: async () => (await import('./landing.js')).CSS_LANDING },
  '/paginas/legal.css': { tipo: CSS, texto: async () => (await import('./legal-vista.js')).CSS_LEGAL },
  '/paginas/documento.js': { tipo: JS, texto: async () => (await import('./legal-vista.js')).GUIAO_LEGAL },
  '/paginas/teste.css': { tipo: CSS, texto: async () => (await import('./teste.js')).CSS_TESTE },
  // o ecrã de entrada da equipa também o usa, e esse é de quem ainda não entrou
  '/equipa/estilos.css': { tipo: CSS, texto: async () => (await import('./equipa-vista.js')).CSS_EQUIPA },
  '/equipa/guiao.js': { tipo: JS, sessao: true, texto: async () => (await import('./equipa-guiao.js')).GUIAO },
  '/equipa/docs.css': { tipo: CSS, sessao: true, texto: async () => (await import('./docs-vista.js')).CSS_DOCS },
  '/equipa/docs.js': { tipo: JS, sessao: true, texto: async () => (await import('./docs-vista.js')).GUIAO_DOCS },
};

// Os caminhos que este módulo serve, para os testes os percorrerem.
export const CAMINHOS_DOS_RECURSOS = Object.keys(RECURSOS);

/* Serve um recurso de página, se o caminho for de um.
   Recebe: caminho — o pathname do pedido (texto); metodo — o método HTTP;
   temSessao — função sem argumentos que devolve a promessa de um booleano,
   verdadeiro quando o pedido traz sessão de equipa (só é chamada para os
   recursos da equipa).
   Devolve: promessa de uma Response — o ficheiro com o Content-Type certo,
   401 sem sessão de equipa onde ela é pedida, 405 para outro método que não
   GET ou HEAD —, ou de null quando o caminho não é de nenhum recurso. */
export async function recursoDePagina(caminho, metodo, temSessao) {
  const r = Object.prototype.hasOwnProperty.call(RECURSOS, caminho) ? RECURSOS[caminho] : null;
  if (!r) return null;
  if (metodo !== 'GET' && metodo !== 'HEAD') {
    return new Response('Método não permitido.', {
      status: 405,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD', 'Cache-Control': 'no-store' },
    });
  }
  if (r.sessao && !(await temSessao())) {
    return new Response('Sem sessão de equipa.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return new Response(await r.texto(), {
    headers: {
      'Content-Type': r.tipo,
      /* o da equipa não fica em cache nenhuma, como a página que o usa; o
         público revalida-se sempre — uma página nova com o CSS de ontem
         era uma página partida durante o tempo da cache */
      'Cache-Control': r.sessao ? 'no-store' : 'no-cache',
    },
  });
}
