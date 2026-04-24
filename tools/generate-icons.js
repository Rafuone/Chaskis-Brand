const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function mkchunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
}

function makePNG(size, r, g, b, cornerRadius) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size, 0);

  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const i = y * stride + 1 + x * 4;
      // Rounded corner alpha
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      let alpha = 255;
      if (cx < cornerRadius && cy < cornerRadius) {
        const dist = Math.sqrt((cornerRadius - cx - 1) ** 2 + (cornerRadius - cy - 1) ** 2);
        alpha = dist > cornerRadius ? 0 : 255;
      }
      raw[i] = r; raw[i+1] = g; raw[i+2] = b; raw[i+3] = alpha;

      // Draw a simplified "C" letterform in white
      const nx = x / size; const ny = y / size;
      const cx2 = nx - 0.5; const cy2 = ny - 0.5;
      const dist = Math.sqrt(cx2*cx2 + cy2*cy2);
      const angle = Math.atan2(cy2, cx2) * 180 / Math.PI;
      const stroke = 0.09;
      const inner = 0.19; const outer = 0.28;
      if (dist >= inner && dist <= outer && !(angle > -35 && angle < 35)) {
        const t = Math.min(1, Math.min(dist - inner, outer - dist) / stroke * 2);
        raw[i] = 255; raw[i+1] = 255; raw[i+2] = 255; raw[i+3] = Math.round(alpha * t);
      }
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, mkchunk('IHDR', ihdr), mkchunk('IDAT', idat), mkchunk('IEND', Buffer.alloc(0))]);
}

// Lire les SVG et les convertir en PNG via data URI embedded dans un canvas HTML
// Approche: écrire un HTML temporaire qui génère les PNG via canvas
const htmlGen = `<!DOCTYPE html><html><body>
<canvas id="c192" width="192" height="192"></canvas>
<canvas id="c512" width="512" height="512"></canvas>
<script>
function drawIcon(canvas, size, radius) {
  const ctx = canvas.getContext('2d');
  const r = 58/255, g = 175/255, b = 169/255;
  // Background with rounded corners
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size-radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size-radius);
  ctx.quadraticCurveTo(size, size, size-radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size-radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = '#3AAFA9';
  ctx.fill();
}
drawIcon(document.getElementById('c192'), 192, 38);
drawIcon(document.getElementById('c512'), 512, 100);
</script></html>`;

// Teal #3AAFA9 = rgb(58, 175, 169)
fs.writeFileSync(path.join(__dirname, '../assets/icons/icon-192.png'), makePNG(192, 58, 175, 169, 38));
fs.writeFileSync(path.join(__dirname, '../assets/icons/icon-512.png'), makePNG(512, 58, 175, 169, 100));
console.log('✅ icon-192.png et icon-512.png générés (fond teal, logo via SVG)');
console.log('ℹ️  Chrome 113+ utilise les SVG (icon-192.svg) avec le vrai logo automatiquement.');
