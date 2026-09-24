/* As regras que o interface tem de cumprir, sempre.
   ------------------------------------------------
   Correm dentro da página, sobre o estado real, e são o que sobrou de uma
   varredura feita à mão: cada uma nasceu de um defeito que existiu mesmo.

   Vive num ficheiro à parte porque é injetado no browser — não pode importar
   nada nem tocar em Node. */

// Devolve o texto da função, para quem só a pode correr a partir de texto (o
// testes/correcao-testes.test.js, num vm).
module.exports.fonte = function () {
  return `(${dentroDaPagina.toString()})()`;
};
/* A própria função, para o Playwright a passar à página SEM ser por texto: um
   predicado em texto é avaliado com eval dentro da página, e a CSP não tem
   'unsafe-eval'. */
module.exports.dentroDaPagina = dentroDaPagina;

function dentroDaPagina() {
  const N = (x) => Math.round(x);

  /* Quantos pontos de interacao ainda nao declaram a familia a que pertencem.
     E um tecto, nao uma meta: baixa-se quando se anota mais uma zona, e nunca
     sobe. E o que impede a taxonomia de ficar a validar meia duzia de pontos
     enquanto o resto da app segue sem ela. */
  /* Medido ecra a ecra e com janelas abertas: o que sobra sao os moldes que
     servem duas familias ao mesmo tempo (o «Fazer agora» do tutorial, que ora
     abre uma janela ora muda de ecra) e as opcoes de um sel(), cujo efeito
     depende do onchange que lhes registaram pelo nome. Sao 2 a 5 por estado.
     Os menus de escolha ja responderam — a fabrica recebe a familia de quem a
     chama, como o menu() —, e a cena que rebentava o tecto passou de 16 para
     ZERO em 57 pontos. O que sobra sao os moldes que servem duas familias ao
     mesmo tempo: o «Fazer agora» do tutorial, que ora abre uma janela ora muda
     de ecra conforme o passo, e as linhas do sino. A saida e a mesma de sempre:
     quem cria o botao diz o que ele faz. */
  const TETO_SEM_FAMILIA = 8;

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
      /* Uma coisa invisivel e que nao recebe toques nao tapa nada. O aviso
         esconde-se com opacidade zero e um empurrao de 80px para baixo — a
         posicao de onde desliza quando aparece —, e era essa caixa, que
         ninguem ve, que a regra media por cima do rodape. Oito cenas a
         falhar, todas pelo mesmo engano. O caso a serio — um aviso VISIVEL
         com uma janela aberta — tem cena propria (percorrer.js). */
      const seVe = cs.opacity !== '0' && cs.visibility !== 'hidden' && cs.pointerEvents !== 'none';
      if (z > zModal && r.width > 0 && r.height > 0 && seVe) {
        if (!avisa) {
          falhar('nada tapa um modal', (el.id || el.className || el.tagName) + ' está em z-index ' + z + ', acima de ' + zModal);
        } else {
          const pes = document.querySelector('.modal.open .foot');
          const pr = pes && pes.getBoundingClientRect();
          if (pr && pr.height && !(r.bottom < pr.top || r.top > pr.bottom || r.right < pr.left || r.left > pr.right)) {
            /* com os numeros: sem eles, a falha nao diz se quem tapa esta
               dois pixeis a mais ou cem, nem de que lado */
            const cx = (a) => Math.round(a.top) + '-' + Math.round(a.bottom) +
              ' x ' + Math.round(a.left) + '-' + Math.round(a.right);
            falhar('o que passa por cima não tapa os botões',
              (el.id || el.className) + ' em ' + cx(r) + ' cobre o rodapé em ' + cx(pr));
          }
        }
      }
    });
  }

  /* 4. Alvos de toque. Em ecrã de dedo, nada abaixo do mínimo, e só aí: no
        rato os tamanhos compactos continuam certos (docs/design.md, «Toque e
        acessibilidade»; index.html:@media(pointer:coarse)). Por isso a regra
        FALHA onde a página responde a (pointer:coarse) — os telemóveis do
        percurso nascem com toque — e no computador só mede. Dizia «falha-se o
        botão» e só contava; e contava num contexto sem toque, os tamanhos do
        rato, que para o rato são os certos.
        O mínimo é 40 (o .btn.sm). Abaixo dele só o que a folha declara mais
        pequeno de propósito, com o número dela: o × de uma etiqueta (28) e o
        limpar da pesquisa (36).
        O resto conta-se por TIPO (a tag e as classes), e não por elemento: em
        seleção há uma caixa de marcar por linha, e um teto sobre elementos
        dependia de quantos movimentos a conta tem. O teto é o das famílias:
        baixa-se quando se corrige mais um tipo, e nunca sobe. Medido com
        toque a 2026-09-15, o que ainda fica abaixo: o .btn.sm só de ícone (32
        de largura — o toque dá-lhe a altura, não a largura), o «Anular» do
        aviso (36 de altura, quando a folha lhe pede 44 e não chega lá), o
        «+ Adicionar» das etiquetas (28), as opções de um sel() (39), e em
        seleção as caixas de marcar (33 a 36 de largura) e a frase da barra.
        Os cinco juntam-se num estado só (em seleção, com o aviso à vista): é
        esse o teto de hoje. */
  const TETO_ALVOS_PEQUENOS = 5;
  const aoDedo = matchMedia('(pointer:coarse)').matches;
  const DE_PROPOSITO = ['.tag button', '.qclear'];
  // Recebe: e — um elemento. Devolve: o tipo dele — a tag e as classes, sem o «on» de escolhido.
  const tipoDe = (e) => e.tagName.toLowerCase() + String(e.getAttribute('class') || '').split(' ')
    .filter((c) => c && c !== 'on').map((c) => '.' + c).join('');
  const pequenos = [...document.querySelectorAll('button, a[data-click], .tap, [role=button]')]
    .filter((e) => e.offsetParent)
    .filter((e) => !DE_PROPOSITO.some((s) => e.matches(s)))
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter((x) => x.r.width > 0 && (x.r.height < 40 || x.r.width < 40));
  const tipos = [...new Set(pequenos.map((x) => tipoDe(x.e)))];
  medidas.alvosPequenos = pequenos.length;
  medidas.aoDedo = aoDedo;
  if (pequenos.length) {
    medidas.tiposPequenos = tipos;
    medidas.exemplosPequenos = pequenos.slice(0, 6).map((x) => tipoDe(x.e) + ' «' +
      (x.e.textContent || '').trim().slice(0, 20) + '» ' + N(x.r.width) + 'x' + N(x.r.height));
  }
  if (aoDedo && tipos.length > TETO_ALVOS_PEQUENOS) {
    falhar('alvos de toque com 40px no ecrã de dedo',
      tipos.length + ' tipos de alvo abaixo de 40px, e o teto é ' + TETO_ALVOS_PEQUENOS + ': ' + tipos.join(', '));
  }

  /* 5. As linhas dos movimentos nascem decoradas.

     A camada da nuvem (cloud/selecao.js) acrescenta a cada linha o data-tx e
     o data-mes — de onde saem os ids que o «marcar tudo» e o «marcar o mês»
     leem — e, conforme o modo, o kebab (a única porta para as opções de um
     movimento sozinho, sem toque longo) ou a caixa de marcar.

     Até aqui isto era colado por cima do HTML já gerado, e agora é gerado com
     ele (vistas.js:txLinhaExtra). De qualquer das formas, o que não pode
     acontecer é uma linha aparecer sem nada disto: não dá erro nenhum, e a
     seleção e as opções desaparecem em silêncio. Nada disto tinha teste — o
     arnês de Node não carrega web/cloud/*. */
  /* A lista dos movimentos tem motor proprio (vistas.js:pintarListaTx): as
     linhas sao comparadas por chave e so as que mudaram sao refeitas. Uma
     linha sem chave e uma linha que o motor nao reconhece — na pintura
     seguinte deita-a fora e faz outra, e ficamos com o custo de antes sem
     saber porque. */
  const meses = [...document.querySelectorAll('#view .txmes')];
  if (meses.length) {
    medidas.mesesDeMovimento = meses.length;
    const semChave = meses.filter((m) => !m.getAttribute('data-chave'));
    if (semChave.length) falhar('cada mes traz a sua chave', semChave.length + ' de ' + meses.length);
    /* o saldo do mes e escrito depois de reconciliar, e nao vem na assinatura
       do bloco — se viesse, mudar um filtro refazia o mes inteiro */
    const semTotal = meses.filter((m) => {
      const s = m.querySelector('.txnet');
      return !s || !s.textContent.trim() || !/pos|neg/.test(s.className);
    });
    if (semTotal.length) falhar('cada mes mostra o seu saldo', semTotal.length + ' sem .txnet preenchido');
  }

  const linhas = [...document.querySelectorAll('#view .txrow')];
  /* Sempre, mesmo a zero: só com o número escrito é que se vê no resumo que a
     regra não correu. Sem isto, uma lista vazia (ou um .txrow renomeado)
     desligava a rede toda em silêncio — que é o modo de falha que ela existe
     para apanhar. */
  medidas.linhasDeMovimento = linhas.length;
  if (linhas.length) {
    const semChave = linhas.filter((l) => !l.getAttribute('data-chave'));
    if (semChave.length) falhar('cada linha traz a chave do motor', semChave.length + ' de ' + linhas.length + ' sem data-chave');
    const semId = linhas.filter((l) => !l.getAttribute('data-tx'));
    const semMes = linhas.filter((l) => !l.getAttribute('data-mes'));
    if (semId.length) falhar('cada linha traz o seu id', semId.length + ' de ' + linhas.length + ' sem data-tx');
    if (semMes.length) falhar('cada linha sabe o seu mês', semMes.length + ' de ' + linhas.length + ' sem data-mes');
    const selecao = !!document.querySelector('.sel-bar');
    if (selecao) {
      const semCaixa = linhas.filter((l) => !l.querySelector('.selbox'));
      if (semCaixa.length) falhar('em seleção, cada linha tem caixa', semCaixa.length + ' de ' + linhas.length + ' sem .selbox');
      const abrem = linhas.filter((l) => !/selToggle/.test(l.getAttribute('data-click') || ''));
      if (abrem.length) falhar('em seleção, tocar marca em vez de abrir', abrem.length + ' linhas ainda abrem o movimento');

      /* As marcas sobrevivem a uma repintura. É o que o ponto de extensão tem
         de garantir e o que nenhuma contagem de caixas apanha: o DOM tem de
         concordar com o estado, linha a linha. */
      const marcados = typeof selIds === 'object' && selIds ? selIds : null;
      if (marcados) {
        const deviam = linhas.filter((l) => marcados[l.getAttribute('data-tx')]).length;
        const estao = linhas.filter((l) => l.classList.contains('sel-on')).length;
        if (deviam !== estao) falhar('as marcas concordam com o estado', deviam + ' marcados, ' + estao + ' com marca no ecrã');
      }

      /* O título do mês é o que permite marcar um mês inteiro, e é um ponto de
         extensão à parte do da linha: sem isto, neutralizá-lo deixava a suite
         verde. Parte-se dos meses que as LINHAS dizem ter — assim a regra não
         pode ficar vazia por a decoração ter desaparecido. */
      const mesesDasLinhas = [...new Set(linhas.map((l) => l.getAttribute('data-mes')).filter(Boolean))];
      const semTitulo = mesesDasLinhas.filter((m) => !document.querySelector('#view .section-title.sel-mes [data-mes-box="' + m + '"]'));
      if (semTitulo.length) falhar('em seleção, cada mês tem a sua caixa', semTitulo.join(', ') + ' sem [data-mes-box]');
      const chatos = [...document.querySelectorAll('#view .section-title.sel-mes')]
        .filter((m) => getComputedStyle(m).display !== 'flex');
      if (chatos.length) falhar('o título do mês continua em flex', chatos.length + ' títulos deixaram de o ser');
    } else {
      const semKebab = linhas.filter((l) => !l.querySelector('.txkebab'));
      if (semKebab.length) falhar('fora da seleção, cada linha tem o seu kebab', semKebab.length + ' de ' + linhas.length + ' sem .txkebab');
    }
  }

  /* 6. O «Hoje» do calendario aparece exatamente quando ha para onde voltar.

     O botao dependia de «o calMes esta posto», e nao de «o mes que estou a ver
     nao e o de hoje» — que sao coisas diferentes: voltar ao mes de hoje pela
     seta deixa o calMes posto, com o mes de hoje la dentro, e o botao ficava
     no ecra sem nada para fazer. Le-se o mes pelo TITULO, que e o que a pessoa
     ve, e nao pela variavel, que e o que estava errado. */
  const barraCal = document.querySelector('#view .calgrid') && document.querySelector('#view .toolbar b');
  if (barraCal) {
    const mes = barraCal.textContent.trim();
    const hoje = new Date();
    const nomes = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const noMesDeHoje = semAcento(mes) === nomes[hoje.getMonth()] + ' de ' + hoje.getFullYear();
    const temBotao = [...document.querySelectorAll('#view .toolbar .btn')]
      .some((b) => b.textContent.trim() === 'Hoje');
    medidas.calendarioMes = mes;
    if (noMesDeHoje && temBotao) falhar('o «Hoje» não fica no mês de hoje', mes + ' com botão');
    if (!noMesDeHoje && !temBotao) falhar('o «Hoje» aparece fora do mês de hoje', mes + ' sem botão');
  }

  /* 6b. O selo da sincronizacao nao se poe em cima do sino.

     Vivia no canto superior direito, que e onde o sino esta, e ninguem tinha
     dado por isso porque nenhuma cena o mostrava — ele so aparecia quando a
     ligacao caia. Agora ha uma cena por estado, e esta regra guarda o sitio. */
  const selo = document.getElementById('cwSync');
  if (selo && getComputedStyle(selo).opacity !== '0') {
    const rs = selo.getBoundingClientRect();
    ['hdrBell', 'hdrFilt'].forEach((id) => {
      const outro = document.getElementById(id);
      if (!outro) return;
      const ro = outro.getBoundingClientRect();
      if (!ro.height) return;
      const bate = !(rs.top >= ro.bottom || rs.bottom <= ro.top || rs.left >= ro.right || rs.right <= ro.left);
      if (bate) falhar('o selo da sincronizacao nao tapa o cabecalho', 'sobrepoe #' + id);
    });
  }

  /* 7. As familias dos pontos de interacao (docs/design.md).

     Dois eixos, e so um se declara. O «o que toca» vem num data-toca, porque
     nao ha como adivinha-lo de fora. O «como se alcanca» le-se aqui, do
     proprio DOM: um <button> ou <a> e nativo, um <div role=button> e um alvo
     promovido pelo tornarFocavel, o que esta dentro de um <svg> e uma forma.
     Um atributo a mais seria uma segunda verdade a dessincronizar-se da
     primeira — foi isso que aconteceu quando o data-lp passou a valer tambem
     como chave de animacao. */
  const FAMILIAS = ['nada', 'vista', 'camada', 'rascunho', 'dados', 'modo', 'ecra'];
  const pontos = [...document.querySelectorAll(
    '#view [data-click],#view button,#view a[href],#view [role=button],#view [data-toca],' +
    '.modal.open [data-click],.modal.open button,.modal.open [role=button],.modal.open [data-toca]')]
    .filter((e) => e.offsetParent || e.ownerSVGElement)
    /* um <span data-click="event.stopPropagation()"> nao e um ponto de
       interacao: e um guarda para o cartao por baixo nao abrir. Conta-lo
       obrigava a inventar-lhe uma familia. */
    .filter((e) => !/^event\.stopPropagation\(\);?$/.test((e.getAttribute('data-click') || '').trim()));
  const familia = (e) => e.getAttribute('data-toca') || '';
  const eForma = (e) => !!e.ownerSVGElement;
  const temNome = (e) => !!((e.textContent || '').trim() || e.getAttribute('aria-label') ||
    e.getAttribute('title') || e.querySelector('title'));

  const invalidas = pontos.filter((e) => familia(e) && FAMILIAS.indexOf(familia(e)) < 0);
  if (invalidas.length) {
    falhar('a familia declarada existe',
      [...new Set(invalidas.map((e) => familia(e)))].join(', ') + ' - as boas sao ' + FAMILIAS.join('/'));
  }

  /* Uma forma de grafico reage com o DESENHO, nunca com o afundar de um botao,
     e nunca escreve nem navega. Foi a familia que custou dois defeitos: as
     barras a saltarem ao toque e a fita de virar pagina posta no donut. */
  const formasQueEscrevem = pontos.filter((e) => eForma(e) &&
    ['dados', 'ecra', 'modo', 'rascunho'].indexOf(familia(e)) > -1);
  if (formasQueEscrevem.length) {
    falhar('uma forma de grafico nao escreve nem navega',
      formasQueEscrevem.length + ' formas com data-toca=' + familia(formasQueEscrevem[0]));
  }

  /* Quem escreve tem de ter nome. Um alvo mudo que grava nao ha maneira de o
     explicar a ninguem — nem a quem la chega pelo teclado, nem a quem usa um
     leitor de ecra, nem a quem escreve o texto do aviso. */
  const escrevemSemNome = pontos.filter((e) => familia(e) === 'dados' && !temNome(e));
  if (escrevemSemNome.length) {
    falhar('quem escreve tem nome', escrevemSemNome.length + ' pontos de dados sem texto nem aria-label');
  }

  /* Quem destroi declara-o. E o que faz com que o texto do aviso e a
     existencia de «Anular» deixem de ser escolhas de habito. */
  const riscoSemDados = pontos.filter((e) => e.getAttribute('data-risco') === 'destroi' && familia(e) !== 'dados');
  if (riscoSemDados.length) falhar('quem destroi toca nos dados', riscoSemDados.length + ' com data-risco e sem data-toca=dados');

  /* Tudo o que se alcanca por gesto alcanca-se tambem por um caminho visivel.
     O toque longo e uma porta que ninguem descobre sozinho, e o data-lp nao e
     neutro: bloqueia a selecao de texto, vibra e engole o toque seguinte. Cada
     linha que o tem precisa de um botao com foco de teclado la dentro — que e
     o que o kebab e. */
  /* Os data-lp que ficam na vista sao todos de linhas de registo (tx:, prop:,
     ct:, per:, rec:, tpl:, vis:, mort:). Havia um do painel, o «dash:», que
     a regra tinha de pôr de fora — era do modo de edicao, e a porta visivel
     dele era o «Personalizar painel», fora do bloco; saiu quando o painel
     deixou o toque longo (A.3-14), e o filtro saiu com ele. */
  /* Em modo de selecao a regra nao se aplica, e nao e uma excecao de
     conveniencia: o kebab sai de proposito para dar lugar a caixa de marcar, e
     o caminho visivel passa a ser a barra do fundo, com o Editar e o Eliminar.
     A regra dizia «um botao DENTRO da linha» quando queria dizer «um caminho
     visivel no ECRA» — e em selecao o ecra inteiro e outro. */
  const emSelecao = !!document.querySelector('.sel-bar,.sel-fundo');
  const comGesto = emSelecao ? [] : [...document.querySelectorAll('#view [data-lp]')]
    .filter((e) => e.offsetParent);
  const semPortaVisivel = comGesto.filter((e) => !e.querySelector('button,[role=button],a[href]'));
  medidas.linhasComGesto = comGesto.length;
  if (comGesto.length && semPortaVisivel.length) {
    falhar('o gesto tem sempre um caminho visivel ao lado',
      semPortaVisivel.length + ' de ' + comGesto.length + ' com toque longo e sem botao dentro - ex.: ' +
      (semPortaVisivel[0].getAttribute('data-lp') || ''));
  }

  /* A cobertura mede-se e so pode subir. Sem isto, a taxonomia era um
     documento: valida o que esta declarado e cala-se sobre o que nao esta. */
  const semFamilia = pontos.filter((e) => !familia(e));
  medidas.pontosDeInteracao = pontos.length;
  medidas.pontosSemFamilia = semFamilia.length;
  if (semFamilia.length > TETO_SEM_FAMILIA) {
    falhar('a cobertura das familias nao desce',
      semFamilia.length + ' sem familia, e o tecto e ' + TETO_SEM_FAMILIA + ' - ex.: ' +
      [...new Set(semFamilia.slice(0, 4).map((e) => e.tagName.toLowerCase() + '.' +
        (e.getAttribute('class') || '').split(' ')[0]))].join(', '));
  }

  /* A porta das opcoes de um registo e UMA, em toda a app. Eram tres moldes —
     lpMenu nas listas, CW.txOpcoes nos movimentos, menuOpen no menu de acoes —
     e davam tres desenhos, tres tamanhos e tres nomes: 44x44 «Opcoes» nos
     movimentos, 37x40 SEM NOME nas listas, 44x44 «Mais» nas visitas. O que
     nao tinha nome era o mais usado, e um leitor de ecra anunciava «botao» e
     mais nada; o que tinha 37px estava abaixo do minimo de alvo.

     A regra olha para o que a porta FAZ (chama um destes tres) e exige que
     seja sempre a mesma coisa. Sem isto, a proxima lista nasce com o quarto
     desenho e ninguem da por ela ate alguem tentar usar a app sem saber que o
     toque longo existe. */
  const abrePorta = /(^|[^\w.])(lpMenu|menuOpen)\(|CW\.txOpcoes\(/;
  const portas = pontos.filter((e) => abrePorta.test(e.getAttribute('data-click') || ''));
  const foraDoMolde = portas.filter((e) => {
    const r = e.getBoundingClientRect();
    return !e.classList.contains('opcoes') || e.getAttribute('aria-label') !== 'Op\u00e7\u00f5es' ||
      r.width < 40 || r.height < 40;
  });
  medidas.portasDeOpcoes = portas.length;
  if (foraDoMolde.length) {
    const e = foraDoMolde[0], r = e.getBoundingClientRect();
    falhar('a porta das opcoes e sempre a mesma',
      foraDoMolde.length + ' de ' + portas.length + ' fora do molde - ex.: .' +
      (e.getAttribute('class') || '(sem classe)').split(' ').join('.') + ' ' +
      Math.round(r.width) + 'x' + Math.round(r.height) + ' nome=' +
      (e.getAttribute('aria-label') || '(sem nome)'));
  }

  /* Uma janela ou se LE ou se EDITA, nunca as duas coisas.

     A ficha de leitura tem «Editar» no rodape. Se tiver campos, nao e uma
     ficha — e um formulario com um botao a prometer outro, que e exatamente
     o que havia antes: tocar num contrato abria quarenta campos editaveis.
     Sem esta regra, o caminho mais curto de acrescentar «mais um campo» a
     ficha e escrever la um input, e ao fim de uns meses esta tudo como
     estava. */
  const fichasAbertas = [...document.querySelectorAll('.modal.open')].filter((m) =>
    [...m.querySelectorAll('.foot button')].some((b) => /^Editar/.test((b.textContent || '').trim())));
  medidas.fichasAbertas = fichasAbertas.length;
  fichasAbertas.forEach((m) => {
    const campos = [...m.querySelectorAll('.body input,.body textarea,.body select')];
    if (campos.length) {
      falhar('uma ficha lê-se, não se edita',
        campos.length + ' campos numa janela com «Editar» no rodapé - ex.: ' +
        (campos[0].id || campos[0].tagName.toLowerCase()));
    }
  });

  /* Nenhuma data ISO no que se le.

     As datas que uma pessoa le escrevem-se como se escrevem em Portugal
     (formato.js:dPT): 15/03/2028. O ISO fica onde e DADO — na base, nos
     <input type=date>, nas comparacoes, nas chaves e no que sai para o
     servidor —, e por isso esta regra olha so para o TEXTO visivel, nunca
     para atributos nem para valores de campos.

     Sem ela a mudanca ficava a meio: uma data em ISO volta ao ecra na
     proxima funcao que alguem escrever, e ninguem da por isso, porque um
     2028-03-15 no meio de uma lista nao parece um defeito — parece uma data. */
  const ISO = /(^|[^\d])\d{4}-\d{2}-\d{2}([^\d]|$)/;
  const comIso = [...document.querySelectorAll('#view *,.modal.open *')]
    .filter((e) => e.children.length === 0 && (e.offsetParent || e.ownerSVGElement))
    /* o valor de um campo nao e texto lido: o browser mostra-o na forma local */
    .filter((e) => !/^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(e.tagName))
    .filter((e) => ISO.test(e.textContent || ''));
  medidas.datasIso = comIso.length;
  if (comIso.length) {
    const ex = comIso[0];
    falhar('as datas leem-se como em Portugal',
      comIso.length + ' com data ISO no ecra - ex.: ' +
      (ex.textContent || '').trim().slice(0, 60));
  }

  /* 7. Texto que sai da sua caixa — normalmente uma coluna estreita demais.
     Só HTML: um <text> de SVG não tem caixa de CSS (o sítio dele é o x e o
     text-anchor, e a escala é a do viewBox), e o scrollWidth que o browser
     lhe dá é um número sem sentido — as etiquetas do eixo de um gráfico
     («133k») davam aqui um falso alarme quando o percurso passou a visitar a
     Avaliação. */
  const rebentam = [...document.querySelectorAll('#view *')]
    .filter((e) => e.children.length === 0 && e.textContent.trim() && !e.closest('svg'))
    .filter((e) => e.scrollWidth > e.clientWidth + 4 && getComputedStyle(e).overflow === 'visible')
    .slice(0, 5).map((e) => e.textContent.trim().slice(0, 30));
  if (rebentam.length) falhar('texto dentro da sua caixa', rebentam.join(' | '));

  return { falhas, medidas };
}
