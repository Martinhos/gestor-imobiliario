// Gera os ícones da PWA, iguais aos do APK, sem dependências.
//
//   node scripts/make-icons.js
//
// O desenho é o mesmo que o Android usa em res/drawable/ic_launcher_*.xml:
// um gradiente diagonal verde e a casa a traço branco, a mesma do menu
// lateral. Antes a PWA tinha uma casa cheia sobre verde liso — parecia outra
// app no ecrã inicial de quem tinha as duas.
//
// Se algum dia mexeres no ícone do Android, mexe aqui também: são dois
// desenhos separados que têm de dizer a mesma coisa.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ----------------------------------------------------------- PNG à mão */

// CRC-32 de um chunk do PNG, com a tabela calculada uma vez e guardada na própria função.
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
const TRACO = 1.9;          // na escala de 24 do vetor original
const DESLOCA = 12;         // o <group> do Android desloca a casa (48 = 2 × 24)
const LADO = 48;            // viewport do vetor

// As três linhas da casa, tal como no vetor: telhado, corpo, porta.
const LINHAS = [
  [[3, 10.5], [12, 3], [21, 10.5]],
  [[5, 9.5], [5, 21], [19, 21], [19, 9.5]],
  [[9.5, 21], [9.5, 16], [14.5, 16], [14.5, 21]],
].map((l) => l.map(([x, y]) => [x + DESLOCA, y + DESLOCA]));

// Distância de um ponto a um segmento — é o que dá o traço com pontas
// redondas sem ter de desenhar círculos nas juntas.
function distSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const qx = ax + t * dx, qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

// A distância de um ponto ao traço mais próximo da casa, nas coordenadas do vetor de 48.
function distCasa(x, y) {
  let d = Infinity;
  for (const linha of LINHAS) {
    for (let i = 0; i + 1 < linha.length; i++) {
      d = Math.min(d, distSegmento(x, y, linha[i][0], linha[i][1], linha[i + 1][0], linha[i + 1][1]));
    }
  }
  return d;
}

/* Desenha o ícone pixel a pixel: o gradiente diagonal de fundo e a casa a traço
   branco, com 3×3 amostras por pixel para o contorno não sair serrado.
   Devolve o PNG como Buffer, no tamanho pedido. */
function makeIcon(size) {
  const img = Buffer.alloc(size * size * 4);
  const meio = TRACO / 2;
  const AMOSTRAS = 3;   // 3×3 por pixel: chega para o traço não ficar serrado

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // fundo: gradiente na diagonal, como o do Android
      const t = Math.min(1, (px + py) / (2 * (size - 1)));
      const fundo = [0, 1, 2].map((i) => Math.round(VERDE_CLARO[i] + (VERDE_ESCURO[i] - VERDE_CLARO[i]) * t));

      // figura: quanto do pixel cai dentro do traço
      let dentro = 0;
      for (let sy = 0; sy < AMOSTRAS; sy++) {
        for (let sx = 0; sx < AMOSTRAS; sx++) {
          const u = ((px + (sx + 0.5) / AMOSTRAS) / size) * LADO;
          const v = ((py + (sy + 0.5) / AMOSTRAS) / size) * LADO;
          if (distCasa(u, v) <= meio) dentro++;
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

const out = path.join(__dirname, '..', 'web');
for (const s of [192, 512]) {
  fs.writeFileSync(path.join(out, `icon-${s}.png`), makeIcon(s));
  console.log(`icon-${s}.png`);
}
// o iOS procura especificamente um apple-touch-icon de 180×180
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), makeIcon(180));
console.log('apple-touch-icon.png');
