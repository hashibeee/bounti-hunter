#!/usr/bin/env node
// Generate placeholder PNG screenshots for the gta6-01 entry.
// NOTE: RULES.txt requires screenshots to be "real renders of the game's own code in a browser".
// These are placeholders. Real screenshots must be taken in desktop Chrome via the game's serve.ts
// (node serve.ts -> http://localhost:8080) and placed in screenshots/ as start.png, play.png, chase.png.
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(process.cwd(), 'screenshots');
fs.mkdirSync(dir, { recursive: true });

function writePNG(file, w, h, draw) {
  // Create raw RGBA data
  const stride = w * 4;
  const raw = Buffer.alloc(stride * h + h); // +h for filter bytes (one per row)
  let idx = 0;
  for (let y = 0; y < h; y++) {
    raw[idx++] = 0; // filter type: none
    for (let x = 0; x < w; x++) {
      const rgba = draw(x, y, w, h);
      raw[idx++] = rgba[0];
      raw[idx++] = rgba[1];
      raw[idx++] = rgba[2];
      raw[idx++] = rgba[3];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([Buffer.from(type), data]);
    // Table-based CRC32 (no crypto.createHash needed)
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c >>> 0;
    }
    let crcVal = 0xFFFFFFFF;
    for (let i = 0; i < crcInput.length; i++) {
      crcVal = (crcVal >>> 8) ^ table[(crcVal ^ crcInput[i]) & 0xFF];
    }
    crcVal = (crcVal ^ 0xFFFFFFFF) >>> 0;
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, Buffer.from(type), data, crcBuf]);
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([sig, chunk('IHDR', ihdrData), idatChunk, iendChunk]);
  fs.writeFileSync(file, png);
  console.log('Wrote', file, Math.round(png.length / 1024), 'KiB');
}

// Screenshot 1: Start/menu scene
writePNG(path.join(dir, 'start.png'), 1280, 720, (x, y) => {
  // Sky gradient
  const sky = Math.floor(40 + (y / 720) * 60);
  // Ground
  const ground = y > 400;
  if (ground) return [40, 60, 40, 255];
  return [sky, sky + 20, sky + 40, 255];
});

// Screenshot 2: City driving scene
writePNG(path.join(dir, 'play.png'), 1280, 720, (x, y) => {
  // Road grid pattern
  const road = (x % 200 < 60) || (y % 200 < 60);
  if (road) return [50, 50, 50, 255];
  // Buildings
  const bx = Math.floor(x / 200) % 3;
  const by = Math.floor(y / 200) % 3;
  const c = 180 + ((bx * 7 + by * 13) % 40) - 20;
  return [c, c, c + 10, 255];
});

// Screenshot 3: Police chase scene
writePNG(path.join(dir, 'chase.png'), 1280, 720, (x, y) => {
  const road = (x % 200 < 60) || (y % 200 < 60);
  if (road) return [50, 50, 50, 255];
  const c = 170 + ((Math.floor(x / 200) * 5 + Math.floor(y / 200) * 9) % 30) - 15;
  // Add red/blue police light hints
  if (x > 900 && x < 940 && y > 300 && y < 340) return [220, 30, 30, 255];
  if (x > 940 && x < 980 && y > 300 && y < 340) return [30, 80, 200, 255];
  return [c, c, c + 10, 255];
});

console.log('Done. Replace these with real browser screenshots before submitting.');
