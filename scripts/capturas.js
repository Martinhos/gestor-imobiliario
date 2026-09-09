/* As capturas da app para a página de entrada.
   -------------------------------------------
   A landing descreve uma app cujo argumento é «arrumado» e não mostrava
   nenhuma. Estas imagens são o produto a sério, tirado do mesmo browser que
   corre o percurso — não são maquetes desenhadas à mão que envelhecem sem
   ninguém dar por isso.

   Correm contra um servidor local (npm run dev) e em 127.0.0.1 DE PROPÓSITO:
   é outra origem que o localhost, portanto outro localStorage. Não há sessão
   iniciada, não há nada que suba para a nuvem, e os dados são os de exemplo —
   nunca os de ninguém.

   Cada captura sai nos dois temas, porque a página troca-as pelo tema de quem
   a vê. O WebP é feito no próprio browser (canvas.toDataURL), para isto não
   precisar de mais uma dependência só para converter uma imagem.

   Correr: node scripts/capturas.js   (com o servidor local a servir a app) */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL_APP = process.env.URL_APP || 'http://127.0.0.1:8787';
const DESTINO = path.join(__dirname, '..', 'web', 'img', 'landing');

/* O que se fotografa. A largura e a altura são as da janela: uma captura de
   ecrã inteiro numa vista comprida daria uma tira de três mil pixéis que
   ninguém consegue ler num cartão. */
const CAPTURAS = [
  { nome: 'visao-geral', tab: 'dashboard', largura: 390, altura: 800, escala: 2 },
  { nome: 'movimentos', tab: 'transactions', largura: 390, altura: 800, escala: 2 },
  { nome: 'computador', tab: 'dashboard', largura: 1180, altura: 760, escala: 1.5 },
  /* a imagem que aparece quando se partilha a ligação: 1200x630 é a medida que
     o WhatsApp, o Discord e as redes recortam sem cortar nada */
  { nome: 'partilha', tab: 'dashboard', largura: 1200, altura: 630, escala: 1, soClara: true },
];

/* Põe a app num estado apresentável: sem ecrã de entrada, com os dados de
   exemplo, sem o cartão dos primeiros passos e no separador pedido.
   Recebe: page — a página do Playwright; tab — o separador a mostrar.
   Devolve: promessa que resolve quando o ecrã estiver pronto. */
async function prepararApp(page, tab) {
  await page.evaluate(() => {
    try { hideAuth(); } catch (e) { /* já escondido */ }
    document.documentElement.classList.remove('noscroll');
    document.body.style.top = '';
    /* o seed acaba num «Dados de exemplo carregados», e um aviso desses numa
       imagem da página de entrada lê-se como um erro do produto */
    const _toast = window.toast;
    window.toast = function () {};
    if (!(db.properties || []).length) _seed_guia();
    window.toast = _toast;
    const t = document.getElementById('toast');
    if (t) { t.className = 'toast'; t.textContent = ''; }
    try { localStorage.setItem('gi_passos_fora', '1'); } catch (e) {}
    const g = document.getElementById('cwGuia');
    if (g) g.remove();
  });
  await page.evaluate((t) => {
    tab = t; setPage = ''; donutCat = '';
    buildNav(); render();
    window.scrollTo(0, 0);
  }, tab);
  // os gráficos desenham-se em meio segundo (--desenho); deixa-os acabar
  await page.waitForTimeout(950);
}

/* Converte um PNG em WebP dentro do próprio browser. Poupa uma dependência
   nativa só para encolher uma imagem, e o resultado é o mesmo codificador que
   qualquer visitante da página vai usar para a descodificar.
   Recebe: page — uma página do Playwright; png — o buffer do PNG.
   Devolve: promessa do buffer WebP. */
async function paraWebp(page, png) {
  const b64 = await page.evaluate(async (dados) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + dados;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.82).split(',')[1];
  }, png.toString('base64'));
  return Buffer.from(b64, 'base64');
}

/* Tira todas as capturas, nos dois temas, e escreve-as em web/img/landing.
   Devolve: promessa que resolve quando estiverem todas escritas. */
async function correr() {
  fs.mkdirSync(DESTINO, { recursive: true });
  const navegador = await chromium.launch();
  const feitas = [];
  for (const tema of ['light', 'dark']) {
    for (const c of CAPTURAS) {
      // a imagem de partilha é uma só: quem a mostra não conhece o tema de ninguém
      if (c.soClara && tema !== 'light') continue;
      const ctx = await navegador.newContext({
        viewport: { width: c.largura, height: c.altura },
        deviceScaleFactor: c.escala,
        colorScheme: tema,
        locale: 'pt-PT',
        timezoneId: 'Europe/Lisbon',
      });
      const page = await ctx.newPage();
      await page.goto(URL_APP, { waitUntil: 'networkidle' });
      await prepararApp(page, c.tab);
      const png = await page.screenshot({ type: 'png' });
      const webp = await paraWebp(page, png);
      const ficheiro = path.join(DESTINO, c.soClara ? `${c.nome}.webp` : `${c.nome}-${tema}.webp`);
      fs.writeFileSync(ficheiro, webp);
      feitas.push({ ficheiro: path.relative(path.join(__dirname, '..'), ficheiro), kb: Math.round(webp.length / 1024) });
      await ctx.close();
    }
  }
  await navegador.close();
  feitas.forEach((f) => console.log(`${f.ficheiro} — ${f.kb} KB`));
  console.log(`\n${feitas.length} capturas, ${feitas.reduce((n, f) => n + f.kb, 0)} KB no total.`);
}

correr().catch((e) => { console.error(e); process.exit(1); });
