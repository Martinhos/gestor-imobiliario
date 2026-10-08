// Gera os ícones da PWA, iguais aos do APK, sem dependências.
//
//   node scripts/make-icons.js
//
// O desenho é o mesmo que o Android usa em res/drawable/ic_launcher_*.xml:
// um gradiente diagonal verde e a casa a traço branco, a mesma do menu
// lateral. Antes a PWA tinha uma casa cheia sobre verde liso — parecia outra
// app no ecrã inicial de quem tinha as duas.
//
// E a variante de DEV (icon-*-dev.png): fundo âmbar, a casa mais pequena e
// as letras «DEV» a traço por baixo — a mesma geometria do
// android/app/src/dev/res/drawable/ic_launcher_foreground.xml, para a app de
// dev ter a mesma cara no ecrã inicial, venha da PWA ou do APK. É o que
// deixa ter as duas apps instaladas ao lado uma da outra sem as confundir.
//
// Se algum dia mexeres no ícone do Android, mexe aqui também: são dois
// desenhos separados que têm de dizer a mesma coisa.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ----------------------------------------------------------- PNG à mão */

// CRC-32 de um chunk do PNG, com a tabela calculada uma vez e guardada na própria função.
// Recebe: buf — o Buffer sobre o qual calcular (tipo + dados do chunk).
// Devolve: número — o CRC-32, como inteiro sem sinal.
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Um chunk PNG completo: comprimento, tipo, dados e CRC — o formato exige os quatro.
// Recebe: type — o tipo do chunk, quatro letras ASCII ('IHDR', 'IDAT', …); data — Buffer com os dados.
// Devolve: Buffer com o chunk pronto (comprimento + tipo + dados + CRC).
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Embrulha os pixels RGBA num PNG válido (assinatura, IHDR, IDAT comprimido, IEND)
// e devolve o Buffer pronto a escrever em disco.
// Recebe: width — a largura em pixels; height — a altura em pixels; rgba —
// Buffer com os pixels RGBA, 4 bytes por pixel, linha a linha.
// Devolve: Buffer com o ficheiro PNG completo.
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtro None
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------ o desenho */

// Cores e traços copiados de ic_launcher_background.xml e _foreground.xml.
const VERDE_CLARO = [0x2f, 0x7d, 0x5b];
const VERDE_ESCURO = [0x16, 0x38, 0x2b];
// As de dev: âmbar, do src/dev/res/values/colors.xml (#B45309) até um castanho.
const AMBAR_CLARO = [0xd9, 0x77, 0x06];
const AMBAR_ESCURO = [0x7c, 0x2d, 0x12];
const TRACO = 1.9;          // na escala de 24 do vetor original
const DESLOCA = 12;         // o <group> do Android desloca a casa (48 = 2 × 24)
const LADO = 48;            // viewport do vetor

// As três linhas da casa, tal como no vetor: telhado, corpo, porta.
const CASA = [
  [[3, 10.5], [12, 3], [21, 10.5]],
  [[5, 9.5], [5, 21], [19, 21], [19, 9.5]],
  [[9.5, 21], [9.5, 16], [14.5, 16], [14.5, 21]],
];
const LINHAS = CASA.map((l) => l.map(([x, y]) => [x + DESLOCA, y + DESLOCA]));

/* O desenho de dev, nas coordenadas do viewport de 48, igual ao vetor do
   flavor dev: a casa a 0,75 deslocada de (15, 10) — o <group> do Android
   escala primeiro e desloca depois, p*0,75 + (15, 10) — e as letras «DEV»
   em segmentos retos, por baixo, com o traço de 1,6. Tudo dentro do círculo
   seguro do ícone adaptativo (raio 14,7 em torno de (24, 24)). */
const ESCALA_DEV = 0.75;
const DESLOCA_DEV = [15, 10];
const CASA_DEV = CASA.map((l) => l.map(([x, y]) => [x * ESCALA_DEV + DESLOCA_DEV[0], y * ESCALA_DEV + DESLOCA_DEV[1]]));
const TRACO_LETRAS = 1.6;
const LETRAS_DEV = [
  // D
  [[16, 29], [16, 35]],
  [[16, 29], [18.5, 29], [20, 30.5], [20, 33.5], [18.5, 35], [16, 35]],
  // E
  [[22, 29], [22, 35]],
  [[22, 29], [26, 29]],
  [[22, 32], [25, 32]],
  [[22, 35], [26, 35]],
  // V
  [[28, 29], [30, 35], [32, 29]],
];

// Distância de um ponto a um segmento — é o que dá o traço com pontas
// redondas sem ter de desenhar círculos nas juntas.
// Recebe: px, py — o ponto; ax, ay — uma ponta do segmento; bx, by — a outra
// ponta (tudo nas mesmas coordenadas).
// Devolve: número — a distância do ponto ao lugar mais próximo do segmento.
function distSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const qx = ax + t * dx, qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

// A distância de um ponto ao traço mais próximo de um conjunto de linhas, nas coordenadas do vetor de 48.
// Recebe: linhas — array de polilinhas ([[x, y], …]); x, y — o ponto, nas coordenadas do vetor de 48.
// Devolve: número — a distância à linha mais próxima.
function distLinhas(linhas, x, y) {
  let d = Infinity;
  for (const linha of linhas) {
    for (let i = 0; i + 1 < linha.length; i++) {
      d = Math.min(d, distSegmento(x, y, linha[i][0], linha[i][1], linha[i + 1][0], linha[i + 1][1]));
    }
  }
  return d;
}

/* Um ponto cai dentro de algum traço? Cada figura tem a sua espessura: a casa
   de dev é mais fina (o traço escala com ela) e as letras têm a delas.
   Recebe: figuras — array de {linhas, traco}; x, y — o ponto, no vetor de 48.
   Devolve: true se o ponto está a menos de meio traço de alguma linha. */
function dentroDeAlguma(figuras, x, y) {
  return figuras.some((f) => distLinhas(f.linhas, x, y) <= f.traco / 2);
}

// A casa de produção e a de dev com as letras, prontas para o makeIcon.
const FIGURAS_PROD = [{ linhas: LINHAS, traco: TRACO }];
const FIGURAS_DEV = [{ linhas: CASA_DEV, traco: TRACO * ESCALA_DEV }, { linhas: LETRAS_DEV, traco: TRACO_LETRAS }];

/* Desenha o ícone pixel a pixel: o gradiente diagonal de fundo e a figura a traço
   branco, com 3×3 amostras por pixel para o contorno não sair serrado.
   Devolve o PNG como Buffer, no tamanho pedido.
   Recebe: size — o lado do ícone, em pixels; dev (opcional) — true para a
   variante de dev (fundo âmbar, casa pequena e «DEV» por baixo).
   Devolve: Buffer com o PNG quadrado de size×size. */
function makeIcon(size, dev) {
  const img = Buffer.alloc(size * size * 4);
  const AMOSTRAS = 3;   // 3×3 por pixel: chega para o traço não ficar serrado
  const claro = dev ? AMBAR_CLARO : VERDE_CLARO;
  const escuro = dev ? AMBAR_ESCURO : VERDE_ESCURO;
  const figuras = dev ? FIGURAS_DEV : FIGURAS_PROD;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // fundo: gradiente na diagonal, como o do Android
      const t = Math.min(1, (px + py) / (2 * (size - 1)));
      const fundo = [0, 1, 2].map((i) => Math.round(claro[i] + (escuro[i] - claro[i]) * t));

      // figura: quanto do pixel cai dentro do traço
      let dentro = 0;
      for (let sy = 0; sy < AMOSTRAS; sy++) {
        for (let sx = 0; sx < AMOSTRAS; sx++) {
          const u = ((px + (sx + 0.5) / AMOSTRAS) / size) * LADO;
          const v = ((py + (sy + 0.5) / AMOSTRAS) / size) * LADO;
          if (dentroDeAlguma(figuras, u, v)) dentro++;
        }
      }
      const a = dentro / (AMOSTRAS * AMOSTRAS);

      const i = (py * size + px) * 4;
      img[i] = Math.round(fundo[0] + (255 - fundo[0]) * a);
      img[i + 1] = Math.round(fundo[1] + (255 - fundo[1]) * a);
      img[i + 2] = Math.round(fundo[2] + (255 - fundo[2]) * a);
      img[i + 3] = 255;
    }
  }
  return png(size, size, img);
}

/* Os ficheiros que este script escreve em web/, com o tamanho e a variante
   de cada um: os dois tamanhos do manifesto e o apple-touch-icon de 180×180
   que o iOS procura, em produção e em dev. Os testes leem esta lista para
   conferir que o que está em disco é o que o desenho dá. */
const ICONES = [
  { nome: 'icon-192.png', size: 192, dev: false },
  { nome: 'icon-512.png', size: 512, dev: false },
  { nome: 'apple-touch-icon.png', size: 180, dev: false },
  { nome: 'icon-192-dev.png', size: 192, dev: true },
  { nome: 'icon-512-dev.png', size: 512, dev: true },
  { nome: 'apple-touch-icon-dev.png', size: 180, dev: true },
];

module.exports = { makeIcon, ICONES };

if (require.main === module) {
  const out = path.join(__dirname, '..', 'web');
  for (const i of ICONES) {
    fs.writeFileSync(path.join(out, i.nome), makeIcon(i.size, i.dev));
    console.log(i.nome);
  }
}
