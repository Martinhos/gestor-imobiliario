/* A imagem de partilha da montra.
   ------------------------------
   A imagem que as redes sociais, o WhatsApp e o Discord mostram quando se
   partilha a ligação de rendorium.com (og:image). Desde 2026-11-12 (KAN-6) é
   o topo da própria montra (worker/src/landing.js): é o que a pessoa vê ao
   abrir a ligação, desenha a app em maquetes que seguem os tokens, e não
   depende dos dados de exemplo — a de antes era a Visão geral da app com eles,
   e envelheceu com a navegação antiga, o prazo do Modelo 2 e um cashflow
   negativo. A montra só promete o que a produção tem (a skill
   rendorium-montra, A2), por isso a imagem também.

   Corre contra um servidor local, no /montra (fora do domínio raiz é aí que a
   montra se serve), sem sessão nenhuma. A pílula QA e a faixa do rasto saem
   da imagem se lá estiverem.

   A janela é 1440×756 e a escala 1200/1440: o topo fica com a composição do
   computador (o texto e o telemóvel inteiros) e a imagem sai a 1200×630, a
   medida que o WhatsApp, o Discord e as redes recortam sem cortar nada.

   Sai só clara: quem a mostra não conhece o tema de ninguém. O WebP é feito no
   próprio browser (canvas.toDataURL), para isto não precisar de mais uma
   dependência só para converter uma imagem.

   Correr: URL_APP=http://127.0.0.1:8788 node scripts/capturas.js
   (com um servidor local de pé; o de omissão é o 127.0.0.1:8787) */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL_APP = process.env.URL_APP || 'http://127.0.0.1:8787';
const DESTINO = path.join(__dirname, '..', 'web', 'img', 'landing');

/* O que se fotografa: o caminho, a janela e a escala. A imagem sai com
   largura × escala por altura × escala pixéis. */
const CAPTURAS = [
  { nome: 'partilha', caminho: '/montra', largura: 1440, altura: 756, escala: 1200 / 1440, soClara: true },
];

/* Põe a montra num estado apresentável: sem a pílula QA nem a faixa do rasto,
   no topo, e com os números do telemóvel já no valor final.
   Recebe: page — a página do Playwright.
   Devolve: promessa que resolve quando o ecrã estiver pronto. */
async function prepararMontra(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.qa-pilula, .qa-camada, aside.escolha').forEach((e) => e.remove());
    window.scrollTo(0, 0);
  });
  // a entrada (--entrada, .65s) e os números a contar (até 1,2 s); deixa-os acabar
  await page.waitForTimeout(1600);
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

/* Tira todas as capturas, nos temas de cada uma, e escreve-as em web/img/landing.
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
      await page.goto(URL_APP + c.caminho, { waitUntil: 'networkidle' });
      await prepararMontra(page);
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
