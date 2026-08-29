// Gera icon-192.png e icon-512.png (casa branca sobre verde) sem dependências.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

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

function makeIcon(size) {
  const img = Buffer.alloc(size * size * 4);
  const bg = [0x1a, 0x3a, 0x2c], fg = [0xdf, 0xec, 0xe6];
  const put = (x, y, c) => {
    const i = (y * size + x) * 4;
    img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, bg);

  // casa: telhado triangular + corpo com porta, em coordenadas normalizadas
  const inHouse = (u, v) => {
    // telhado: triângulo de (0.5,0.20) a (0.16,0.50)-(0.84,0.50)
    if (v >= 0.2 && v <= 0.5) {
      const half = ((v - 0.2) / 0.3) * 0.34;
      if (u >= 0.5 - half && u <= 0.5 + half) return true;
    }
    // corpo
    if (v > 0.5 && v <= 0.8 && u >= 0.24 && u <= 0.76) {
      // porta (recorte)
      if (v > 0.62 && u >= 0.44 && u <= 0.56) return false;
      return true;
    }
    return false;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inHouse((x + 0.5) / size, (y + 0.5) / size)) put(x, y, fg);
    }
  }
  return png(size, size, img);
}

const out = path.join(__dirname, '..', 'web');
for (const s of [192, 512]) {
  fs.writeFileSync(path.join(out, `icon-${s}.png`), makeIcon(s));
  console.log(`icon-${s}.png`);
}
