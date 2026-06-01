// Generate build/icon.png — a naval-themed icon for WoWS Translator
// Standalone script; node scripts/generate-icon.js

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 256;
const BG   = [0x14, 0x16, 0x28, 0xFF];  // dark navy
const CYAN = [0x50, 0x90, 0xFF, 0xFF];  // ship / accent
const WAVE = [0x30, 0x60, 0xA0, 0xFF];  // waves
const WHITE= [0xD0, 0xD8, 0xE8, 0xFF];  // highlights

const pixels = Buffer.alloc(SIZE * SIZE * 4);

function setPixel(x, y, color) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const off = (y * SIZE + x) * 4;
  pixels[off] = color[0];
  pixels[off + 1] = color[1];
  pixels[off + 2] = color[2];
  pixels[off + 3] = color[3];
}

function fillRGBA(color) {
  for (let i = 0; i < SIZE * SIZE * 4; i += 4) {
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = color[3];
  }
}

function fillCircle(cx, cy, r, color) {
  const rr = r * r;
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(SIZE - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    const dx = Math.sqrt(rr - dy * dy);
    const x0 = Math.max(0, Math.floor(cx - dx));
    const x1 = Math.min(SIZE - 1, Math.ceil(cx + dx));
    for (let x = x0; x <= x1; x++) {
      setPixel(x, y, color);
    }
  }
}

function fillRect(x0, y0, w, h, color) {
  const x1 = Math.min(SIZE, x0 + w);
  const y1 = Math.min(SIZE, y0 + h);
  for (let y = Math.max(0, y0); y < y1; y++) {
    for (let x = Math.max(0, x0); x < x1; x++) {
      setPixel(x, y, color);
    }
  }
}

// Antialiased line (Xiaolin Wu — simplified: just thick aliased line)
function thickLine(x0, y0, x1, y1, thickness, color) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const half = thickness / 2;
  while (true) {
    fillCircle(x0, y0, half, color);
    if (Math.abs(x0 - x1) < 1 && Math.abs(y0 - y1) < 1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx)  { err += dx; y0 += sy; }
  }
}

// ---------- draw icon ----------

fillRGBA(BG);

// --- waves (bottom) ---
const waveBaseY = 190;
for (let w = 0; w < 3; w++) {
  const wy = waveBaseY + w * 22;
  const color = w === 0 ? WAVE : [WAVE[0], WAVE[1], WAVE[2], 0x60 + w * 40];
  // sine wave by drawing many small circles
  for (let x = 0; x < SIZE; x += 2) {
    const y = wy + Math.sin(x * 0.04 + w * 1.5) * 8;
    setPixel(x, Math.floor(y), color);
    setPixel(x, Math.floor(y) + 1, color);
    setPixel(x + 1, Math.floor(y), color);
    setPixel(x + 1, Math.floor(y) + 1, color);
  }
}

// --- ship silhouette ---
// Hull: elongated trapezoid
const hullTop = 90;
const hullBot = 155;
const hullLeftTop = 55;
const hullRightTop = 201;
const hullLeftBot = 30;
const hullRightBot = 226;

function fillTrapezoid(xtl, xtr, xbl, xbr, yTop, yBot, color) {
  for (let y = yTop; y <= yBot; y++) {
    const t = (y - yTop) / (yBot - yTop);
    const xL = Math.floor(xtl + (xbl - xtl) * t);
    const xR = Math.floor(xtr + (xbr - xtr) * t);
    for (let x = xL; x <= xR; x++) {
      setPixel(x, y, color);
    }
  }
}

// Main hull (dark accent)
fillTrapezoid(hullLeftTop, hullRightTop, hullLeftBot, hullRightBot, hullTop, hullBot, CYAN);

// Bow (pointed front — left side extension)
const bowPoints = [
  [hullLeftTop, hullTop],
  [hullLeftTop + 20, hullTop + 18],
  [hullLeftTop, hullTop + 36],
];
// Simple triangle fill
for (let y = bowPoints[0][1]; y <= bowPoints[2][1]; y++) {
  const t = (y - bowPoints[0][1]) / (bowPoints[2][1] - bowPoints[0][1]);
  const xL = bowPoints[0][0] + (bowPoints[2][0] - bowPoints[0][0]) * t;
  const xR = bowPoints[1][0];
  for (let x = Math.floor(xL); x <= xR; x++) {
    setPixel(x, y, CYAN);
  }
}

// Stern (right side slight extension)
fillRect(hullRightTop - 15, hullTop + 5, 20, hullBot - hullTop - 10, CYAN);

// Superstructure
const superX = 100, superW = 56, superY = 58, superH = 35;
fillRect(superX, superY, superW, superH, WHITE);
// Bridge windows (dark slits)
for (let wy = superY + 6; wy < superY + superH - 6; wy += 10) {
  fillRect(superX + 8, wy, superW - 16, 4, BG);
}

// Funnel / smokestack
fillRect(superX + 14, superY - 14, 16, 16, [0x60, 0x70, 0x80, 0xFF]);

// --- anchor circle (subtle, center-right) ---
fillCircle(180, 115, 24, [0x40, 0x70, 0xC0, 0x80]);
fillCircle(180, 115, 20, BG);
// anchor cross
fillRect(176, 95, 8, 40, [0x40, 0x70, 0xC0, 0xC0]);
fillRect(165, 110, 30, 7, [0x40, 0x70, 0xC0, 0xC0]);

// --- border glow (rounded-rect approximation) ---
const borderColor = [0x50, 0x70, 0xA0, 0x30];
const borderWidth = 4;
const cornerRadius = 32;

// Top edge
fillRect(cornerRadius, 0, SIZE - 2 * cornerRadius, borderWidth, borderColor);
// Bottom edge
fillRect(cornerRadius, SIZE - borderWidth, SIZE - 2 * cornerRadius, borderWidth, borderColor);
// Left edge
fillRect(0, cornerRadius, borderWidth, SIZE - 2 * cornerRadius, borderColor);
// Right edge
fillRect(SIZE - borderWidth, cornerRadius, borderWidth, SIZE - 2 * cornerRadius, borderColor);

// ---------- PNG encoding ----------

// CRC32
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData), 0);
  return Buffer.concat([len, typeData, crc]);
}

// Build raw scanlines (filter byte 0 + RGBA)
const rawScanlines = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  const off = y * (1 + SIZE * 4);
  rawScanlines[off] = 0; // filter: none
  pixels.copy(rawScanlines, off + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const compressed = zlib.deflateSync(rawScanlines, { level: 9 });

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);   // width
ihdr.writeUInt32BE(SIZE, 4);   // height
ihdr[8] = 8;                    // bit depth
ihdr[9] = 6;                    // color type: RGBA
ihdr[10] = 0;                   // compression
ihdr[11] = 0;                   // filter
ihdr[12] = 0;                   // interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // signature
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, '..', 'build', 'icon.png');
fs.writeFileSync(outPath, png);
console.log('Icon written to ' + outPath + ' (' + png.length + ' bytes)');
