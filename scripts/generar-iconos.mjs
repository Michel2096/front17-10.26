// Genera los íconos PNG de la PWA (192, 512 y maskable) sin dependencias externas.
// Rasteriza la misma geometría que public/logo.svg con supermuestreo 4x4 y codifica PNG con zlib.
// Uso: node scripts/generar-iconos.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const FONDO = hex('#23262f');

// Formas en el espacio del lápiz (antes de rotar 45° alrededor de 32,32), igual que el SVG.
const rect = (x, y, w, h, c) => ({ c: hex(c), dentro: (px, py) => px >= x && px <= x + w && py >= y && py <= y + h });
const tri = (ax, ay, bx, by, cx, cy, c) => ({
  c: hex(c),
  dentro: (px, py) => {
    const s = (x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    const d1 = s(ax, ay, bx, by), d2 = s(bx, by, cx, cy), d3 = s(cx, cy, ax, ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  },
});
const FORMAS = [
  rect(26, 6, 12, 7, '#f28b9b'),
  rect(26, 12, 12, 5, '#c9cdd6'),
  rect(26, 17, 12, 26, '#f5b700'),
  rect(30, 17, 4, 26, '#ffcd3c'),
  tri(26, 43, 38, 43, 32, 56, '#e9c894'),
  tri(30.2, 52.2, 33.8, 52.2, 32, 56, '#23262f'),
];

function dentroRedondeado(x, y, r) {
  const cx = Math.min(Math.max(x, r), 64 - r);
  const cy = Math.min(Math.max(y, r), 64 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function muestra(x, y, maskable) {
  // Maskable: fondo a sangre completa y lápiz reducido para caber en la zona segura (80%).
  if (!maskable && !dentroRedondeado(x, y, 14)) return null;
  const escala = maskable ? 0.72 : 1;
  let u = (x - 32) / escala, v = (y - 32) / escala;
  const k = Math.SQRT1_2; // rotación inversa de 45°
  const px = u * k + v * k + 32;
  const py = -u * k + v * k + 32;
  let color = FONDO;
  for (const f of FORMAS) if (f.dentro(px, py)) color = f.c;
  return color;
}

function png(tam, maskable) {
  const SS = 4;
  const filas = Buffer.alloc(tam * (tam * 4 + 1));
  for (let j = 0; j < tam; j++) {
    filas[j * (tam * 4 + 1)] = 0;
    for (let i = 0; i < tam; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = muestra(((i + (sx + 0.5) / SS) / tam) * 64, ((j + (sy + 0.5) / SS) / tam) * 64, maskable);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
        }
      const o = j * (tam * 4 + 1) + 1 + i * 4;
      if (a) { filas[o] = r / a; filas[o + 1] = g / a; filas[o + 2] = b / a; }
      filas[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  const crcTabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTabla[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo, datos) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo), datos]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([len, cuerpo, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0); ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(dir + 'icon-192.png', png(192, false));
writeFileSync(dir + 'icon-512.png', png(512, false));
writeFileSync(dir + 'icon-maskable-512.png', png(512, true));
console.log('Íconos generados en', dir);
