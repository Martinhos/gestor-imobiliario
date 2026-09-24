// As armações dos testes do cliente para o que o DOM do arnês não tem: as
// janelas (uma pilha observável em vez do modal) e o toque longo (os rótulos
// em vez da folha). Estavam copiadas em cinco ficheiros, cada cópia com uma
// camada um pouco diferente. O que a app escreve no #view lê-se pelo arnês
// (testes/arnes.js:elementos), que se lembra de cada elemento pelo id.

/* Uma camada de janela falsa, como a app a encontra em cima do modalStack:
   o corpo e o rodapé observáveis (os campos do corpo, que o modo só de
   leitura desativa; o aviso que a app acrescenta ao corpo fica em body.hint),
   e qualquer outro seletor dá um elemento — o render repinta as fichas
   abertas pelo fillModal, que pede o título, o menu e o rodapé. O corpo só dá
   os campos a quem pede campos (input, select, textarea), como o browser: a
   um '[data-click]' (vistas.js:tornarFocavel) um campo de texto não responde.
   Devolve: {el, body, foot, campos, onSave}. */
export function camadaFalsa() {
  const campos = [{ tagName: 'INPUT', disabled: false, type: 'text', value: 'a' }, { tagName: 'INPUT', disabled: false, type: 'text', value: 'b' }];
  const body = {
    innerHTML: '', textContent: '', hint: '',
    querySelectorAll: (s) => (/\b(input|select|textarea)\b/.test(String(s)) ? campos : []),
    insertAdjacentHTML: (onde, h) => { body.hint += h; },
  };
  const foot = { innerHTML: '', textContent: '' };
  const outros = {};
  const el = {
    querySelector: (s) => (s === '.body' ? body : s === '.foot' ? foot : (outros[s] = outros[s] || { innerHTML: '', textContent: '' })),
    querySelectorAll: () => [],
  };
  return { el, body, foot, campos, onSave: null };
}

/* As janelas abrem numa pilha observável: cada openModal empilha uma
   camadaFalsa no modalStack (onde o onSave da app a procura) com o título, o
   corpo, o rodapé e o menu que recebeu (t, b, f, m), e guarda-a em
   `abertas`; o closeModal e o closeAllModals desempilham. As funções
   nomeadas em `calados` passam a não fazer nada (o render, o save, o toast —
   cada ficheiro diz quais); o resto fica como está. O repor do arnês devolve
   tudo no fim do teste.
   Recebe: app — o proxy do arnês; calados — nomes de funções da app a calar.
   Devolve: o array das camadas abertas, pela ordem. */
export function janelasFalsas(app, ...calados) {
  const abertas = [];
  app.openModal = (t, b, f, m) => {
    const L = camadaFalsa();
    L.t = t; L.b = b; L.f = f; L.m = m || '';
    app.modalStack.push(L); abertas.push(L);
    return L;
  };
  app.closeModal = () => { app.modalStack.pop(); };
  app.closeAllModals = () => { app.modalStack.length = 0; };
  for (const n of calados) app[n] = () => {};
  return abertas;
}

/* O toque longo devolve os rótulos das opções em vez de abrir a folha, e o
   lpShow fica como estava.
   Recebe: app — o proxy do arnês; f — a função do menu, ou o nome dela
   (lpMenu, lpContrato…); a — o que ela recebe ('ct:C1', ou ['ct', 'C1']).
   Devolve: os rótulos (um array deste lado da vm), ou null se não abriu nada. */
export function menuDe(app, f, a) {
  const real = app.lpShow;
  let opts = null;
  app.lpShow = (t, o) => { opts = o; };
  try {
    (typeof f === 'string' ? app[f] : f)(a);
  } finally {
    app.lpShow = real;
  }
  return opts ? JSON.parse(JSON.stringify(opts.map((o) => o.label))) : null;
}
