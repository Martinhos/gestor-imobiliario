/* ============================ ESTILOS CALCULADOS ============================
   Sem 'unsafe-inline' em style-src, um estilo em linha deixa de valer.
   O que era fixo passa a classes
   utilitárias (u-…, no web/estilos.css) e o que era condicional a classes
   condicionais. Sobram os valores que vêm dos dados — a largura de uma barra,
   a cor de uma série, o atraso da onda de entrada de um gráfico — e esses
   passam a atributos data-*, que este ficheiro aplica pelo CSSOM (el.style,
   que a CSP deixa).

   Os atributos saíram dos casos reais (os style= com ${…} ou + do código):
     data-largura="37.5"  → width: 37.5%       (as barras horizontais, graficos.js)
     data-fundo="#2f7d5b" → background: …      (as cores das séries e das legendas)
     data-atraso="30"     → animation-delay: 30ms (a onda de entrada dos gráficos)
   Cada valor é validado antes de se aplicar: a largura é uma percentagem de 0
   a 100, a cor é #hex, rgb()/rgba()/hsl()/hsla() com números, ou var(--nome),
   e o atraso são milissegundos inteiros (com ou sem «ms»). Um valor que não
   passa não se aplica — e o que lá estava posto por este ficheiro sai.

   Quem aplica é um MutationObserver sobre o documento inteiro. As mudanças
   entregam-se numa microtarefa, antes de o ecrã voltar a pintar: o elemento
   nunca chega a aparecer sem o valor. Quem precisar de medir o elemento na
   mesma volta em que o escreveu chama aplicarEstilosCalculados(raiz) à mão. */

// atributo → a propriedade de CSS e a regra que valida e forma o valor
const ESTILO_CALCULADO = {
  'data-largura': { prop: 'width', valor: estiloLargura },
  'data-fundo': { prop: 'background', valor: estiloCor },
  'data-atraso': { prop: 'animation-delay', valor: estiloAtraso },
};
// o seletor que encontra os elementos com algum dos atributos
const ESTILO_SELETOR = Object.keys(ESTILO_CALCULADO).map((a) => '[' + a + ']').join(',');
// o que este ficheiro pôs em cada elemento: elemento → Set de propriedades
const ESTILO_POSTOS = new WeakMap();

/* A largura: uma percentagem de 0 a 100, com decimais.
   Recebe: v — o texto do atributo.
   Devolve: 'N%', ou null se não passar. */
function estiloLargura(v) {
  if (!/^\d{1,3}(?:\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 100 ? v + '%' : null;
}

/* A cor: #hex (3, 4, 6 ou 8 dígitos), rgb()/rgba()/hsl()/hsla() só com
   números, percentagens, vírgulas, barras e espaços, ou var(--nome).
   Recebe: v — o texto do atributo.
   Devolve: a cor, ou null se não passar. */
function estiloCor(v) {
  if (/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return v;
  if (/^(?:rgba?|hsla?)\(\s*[\d.]+(?:deg|%)?(?:\s*[,/ ]\s*[\d.]+%?){2,3}\s*\)$/.test(v)) return v;
  if (/^var\(--[A-Za-z0-9_-]+\)$/.test(v)) return v;
  return null;
}

/* O atraso: milissegundos inteiros, até dez segundos.
   Recebe: v — o texto do atributo ('30' ou '30ms').
   Devolve: 'Nms', ou null se não passar. */
function estiloAtraso(v) {
  const m = /^(\d{1,5})(?:ms)?$/.exec(v);
  return m && Number(m[1]) <= 10000 ? m[1] + 'ms' : null;
}

/* Aplica a um elemento os valores dos seus atributos: o que passa escreve-se
   no el.style; o que não passa, ou cujo atributo saiu, e tinha sido posto por
   aqui, tira-se. O que o JavaScript da app escreveu à mão no el.style, sem
   atributo, não se toca.
   Recebe: el — o elemento.
   Devolve: nada. */
function aplicarEstiloCalculado(el) {
  if (!el || typeof el.getAttribute !== 'function' || !el.style) return;
  let postos = ESTILO_POSTOS.get(el);
  for (const atributo of Object.keys(ESTILO_CALCULADO)) {
    const { prop, valor } = ESTILO_CALCULADO[atributo];
    const v = el.getAttribute(atributo);
    const certo = v == null ? null : valor(v.trim());
    if (certo != null) {
      el.style.setProperty(prop, certo);
      if (!postos) ESTILO_POSTOS.set(el, (postos = new Set()));
      postos.add(prop);
    } else if (postos && postos.has(prop)) {
      el.style.removeProperty(prop);
      postos.delete(prop);
    }
  }
}

/* Aplica os valores a um elemento e a tudo o que está dentro dele.
   Recebe: raiz — um elemento ou o documento.
   Devolve: nada. */
function aplicarEstilosCalculados(raiz) {
  if (!raiz) return;
  if (raiz.nodeType === 1) aplicarEstiloCalculado(raiz);
  if (typeof raiz.querySelectorAll === 'function') raiz.querySelectorAll(ESTILO_SELETOR).forEach(aplicarEstiloCalculado);
}

/* O que o observador faz a cada lote de mudanças: os elementos acabados de
   entrar, e os que mudaram um dos atributos.
   Recebe: registos — a lista de MutationRecord.
   Devolve: nada. */
function estilosAoMudar(registos) {
  for (const r of registos) {
    if (r.type === 'attributes') aplicarEstiloCalculado(r.target);
    else if (r.type === 'childList') r.addedNodes.forEach((n) => { if (n.nodeType === 1) aplicarEstilosCalculados(n); });
  }
}

/* Arranca o observador sobre o documento e aplica o que já lá está. Sem
   MutationObserver (o Node dos testes) não faz nada.
   Recebe: doc — o document.
   Devolve: o observador, ou null. */
function vigiarEstilosCalculados(doc) {
  if (typeof MutationObserver !== 'function' || !doc || !doc.documentElement) return null;
  const obs = new MutationObserver(estilosAoMudar);
  obs.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: Object.keys(ESTILO_CALCULADO) });
  aplicarEstilosCalculados(doc);
  return obs;
}

vigiarEstilosCalculados(document);
