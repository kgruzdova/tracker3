import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    crcTable = t;
  }
  const table = crcTable;
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const scale = size / 512;

  const c1 = [79, 110, 247];
  const c2 = [156, 106, 222];

  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };

  const insideRounded = (x, y) => {
    const rx = Math.min(x, size - 1 - x);
    const ry = Math.min(y, size - 1 - y);
    if (rx >= radius || ry >= radius) return true;
    const dx = radius - rx;
    const dy = radius - ry;
    return dx * dx + dy * dy <= radius * radius;
  };

  for (let y = 0; y < size; y += 1) {
    const t = y / (size - 1);
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    for (let x = 0; x < size; x += 1) {
      if (insideRounded(x, y)) set(x, y, r, g, b);
    }
  }

  const stroke = 54 * scale;
  const p1 = [140 * scale, 262 * scale];
  const p2 = [224 * scale, 340 * scale];
  const p3 = [374 * scale, 176 * scale];

  const drawSeg = (a, b) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.ceil(len);
    for (let i = 0; i <= steps; i += 1) {
      const x = a[0] + ((b[0] - a[0]) * i) / steps;
      const y = a[1] + ((b[1] - a[1]) * i) / steps;
      const r = stroke / 2;
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy += 1) {
        for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx += 1) {
          if (dx * dx + dy * dy <= r * r) set(Math.round(x + dx), Math.round(y + dy), 255, 255, 255);
        }
      }
    }
  };

  drawSeg(p1, p2);
  drawSeg(p2, p3);

  return encodePng(size, size, buf);
}

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), makeIcon(size));
}
console.log('icons written');
