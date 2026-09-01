/* As regras que o interface tem de cumprir, sempre.
   ------------------------------------------------
   Correm dentro da página, sobre o estado real, e são o que sobrou de uma
   varredura feita à mão: cada uma nasceu de um defeito que existiu mesmo.

   Vive num ficheiro à parte porque é injetado no browser — não pode importar
   nada nem tocar em Node. */

// Devolve o texto da função, para o Playwright a injetar na página.
module.exports.fonte = function () {
  return `(${dentroDaPagina.toString()})()`;
};

function dentroDaPagina() {
  const N = (x) => Math.round(x);

  /* O que corta um elemento. Um `position:fixed` só é preso por um
     antepassado com transform/filter — o overflow dos outros não lhe toca.
     Ignorar isto dava-me dez falsos positivos numa varredura anterior. */
  function limite(el) {
    const fixo = getComputedStyle(el).position === 'fixed';
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const prende = cs.transform !== 'none' || cs.filter !== 'none';
      const corta = /hidden|auto|scroll/.test(cs.overflow + cs.overflowX + cs.overflowY);
      if (fixo ? prende : (corta || prende)) {
        const r = a.getBoundingClientRect();
        return {
          top: Math.max(0, r.top), bottom: Math.min(innerHeight, r.bottom),
          left: Math.max(0, r.left), right: Math.min(innerWidth, r.right),
          quem: (a.className || a.tagName).toString().split(' ')[0],
        };
      }
    }
    return { top: 0, bottom: innerHeight, left: 0, right: innerWidth, quem: 'ecrã' };
  }

  function foraDe(el) {
    const r = el.getBoundingClientRect(), L = limite(el);
    return {
      px: Math.max(0, N(r.bottom - L.bottom)) + Math.max(0, N(L.top - r.top)) +
          Math.max(0, N(r.right - L.right)) + Math.max(0, N(L.left - r.left)),
      preso: L.quem,
    };
  }

  const falhas = [], medidas = {};
  const falhar = (regra, detalhe) => falhas.push({ regra, detalhe });

  /* 1. Nada transborda o ecrã na horizontal. Uma barra de scroll lateral num
        telemóvel é sempre um defeito, nunca uma escolha. */
  const doc = document.documentElement;
  medidas.larguraPagina = doc.scrollWidth;
  medidas.larguraEcra = doc.clientWidth;
  if (doc.scrollWidth > doc.clientWidth + 1) {
    const culpados = [...document.querySelectorAll('body *')]
      .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 2 || b.left < -2); })
      .slice(0, 3).map((e) => e.tagName + '.' + String(e.className).split(' ')[0]);
    falhar('sem scroll horizontal', 'a página tem ' + doc.scrollWidth + 'px em ' + doc.clientWidth + ': ' + culpados.join(', '));
  }

  /* 2. Menus e dropdowns abertos cabem no espaço que têm. */
  const pops = [...document.querySelectorAll('.selpop.on, .menupop.on')];
  medidas.menusAbertos = pops.length;
  pops.forEach((p) => {
    const f = foraDe(p);
    if (f.px > 2) {
      const b = p.parentNode.querySelector('.selbtn, .iconbtn');
      falhar('menu inteiro à vista', (b ? '"' + b.textContent.trim().slice(0, 24) + '"' : 'menu') +
        ' com ' + f.px + 'px fora, cortado por ' + f.preso);
    }
  });

  /* 3. Um modal aberto tem de cobrir o que está por trás e tirar-lhe o toque. */
  const modais = [...document.querySelectorAll('.modal.open')];
  medidas.modaisAbertos = modais.length;
  if (modais.length) {
    if (!doc.classList.contains('noscroll')) {
      falhar('modal tranca o scroll', 'a página por trás continua a rolar');
    }
    modais.forEach((m, i) => {
      const bg = m.querySelector('.bg'), sheet = m.querySelector('.sheet');
      if (!bg) return falhar('modal tem fundo', 'modal ' + i + ' sem .bg');
      const br = bg.getBoundingClientRect();
      if (br.width < innerWidth - 1 || br.height < innerHeight - 1) {
        falhar('fundo cobre o ecrã', 'modal ' + i + ': ' + N(br.width) + 'x' + N(br.height) + ' em ' + innerWidth + 'x' + innerHeight);
      }
      if (sheet) {
        const sr = sheet.getBoundingClientRect();
        if (sr.top < -1 || sr.bottom > innerHeight + 1 || sr.left < -1 || sr.right > innerWidth + 1) {
          falhar('modal dentro do ecrã', 'modal ' + i + ' em ' + N(sr.top) + '..' + N(sr.bottom));
        }
      }
    });
    // com modais empilhados, só o de cima recebe o toque
    if (modais.length > 1) {
      const baixo = modais[0].querySelector('.sheet'), cima = modais[modais.length - 1].querySelector('.sheet');
      if (baixo && getComputedStyle(baixo).pointerEvents !== 'none') {
        falhar('só o modal de cima recebe', 'o de baixo continua a aceitar toques');
      }
      if (cima && getComputedStyle(cima).pointerEvents === 'none') {
        falhar('só o modal de cima recebe', 'o de cima está inerte');
      }
    }
    // e nada de fora tapa o modal
    const zModal = Math.max(...modais.map((m) => Number(getComputedStyle(m).zIndex) || 0));
    [...document.querySelectorAll('body > *')].forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.position !== 'fixed') return;
      const z = Number(cs.zIndex) || 0;
      const r = el.getBoundingClientRect();
      /* Avisos e guias podem ficar por cima de propósito: um toast, uma dica,
         um ecrã de aviso, o cartão de um tutorial. Mas quem passa por cima
         tem de deixar os botões do modal alcançáveis — senão está a tapar
         precisamente aquilo que se pede à pessoa para carregar. */
      const avisa = /toast|tip/.test(el.className) || el.id === 'cwDoc' ||
        /^cw(Legal|Terms|Upd|Auth|Guia)/.test(el.id || '');
      if (z > zModal && r.width > 0 && r.height > 0) {
        if (!avisa) {
          falhar('nada tapa um modal', (el.id || el.className || el.tagName) + ' está em z-index ' + z + ', acima de ' + zModal);
        } else {
          const pes = document.querySelector('.modal.open .foot');
          const pr = pes && pes.getBoundingClientRect();
          if (pr && pr.height && !(r.bottom < pr.top || r.top > pr.bottom || r.right < pr.left || r.left > pr.right)) {
            falhar('o que passa por cima não tapa os botões',
              (el.id || el.className) + ' cobre o rodapé do modal');
          }
        }
      }
    });
  }

  /* 4. Alvos de toque com pelo menos 40px. Abaixo disso falha-se o botão. */
  const pequenos = [...document.querySelectorAll('button, a[onclick], .tap, [role=button]')]
    .filter((e) => e.offsetParent)
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter((x) => x.r.width > 0 && (x.r.height < 40 || x.r.width < 40))
    .map((x) => (x.e.textContent || '').trim().slice(0, 20) + ' (' + N(x.r.width) + 'x' + N(x.r.height) + ')');
  medidas.alvosPequenos = pequenos.length;
  if (pequenos.length) medidas.exemplosPequenos = pequenos.slice(0, 6);

  /* 5. Texto que sai da sua caixa — normalmente uma coluna estreita demais. */
  const rebentam = [...document.querySelectorAll('#view *')]
    .filter((e) => e.children.length === 0 && e.textContent.trim())
    .filter((e) => e.scrollWidth > e.clientWidth + 4 && getComputedStyle(e).overflow === 'visible')
    .slice(0, 5).map((e) => e.textContent.trim().slice(0, 30));
  if (rebentam.length) falhar('texto dentro da sua caixa', rebentam.join(' | '));

  return { falhas, medidas };
}
