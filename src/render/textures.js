import * as THREE from 'three';
import { mulberry32, fbm } from '../core/util.js';

const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Flagstone ground: albedo + normal map derived from a painted height field.
export function makeGroundTextures(seed = 7, style = 'nave') {
  const N = 512, rnd = mulberry32(seed);
  const hC = canvas(N), h = hC.getContext('2d');
  const aC = canvas(N), a = aC.getContext('2d');
  h.fillStyle = '#000'; h.fillRect(0, 0, N, N);
  const base = style === 'nave' ? [66, 62, 72] : [56, 62, 54];
  a.fillStyle = `rgb(${base})`; a.fillRect(0, 0, N, N);
  // stones: rows with staggered widths
  const rows = 6; const rh = N / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 60;
    while (x < N) {
      const w = 60 + rnd() * 90; const y = r * rh;
      const pad = 3 + rnd() * 2;
      const shade = 0.75 + rnd() * 0.45;
      const tint = rnd();
      const draw = (ox) => {
        h.fillStyle = `rgb(${150 + rnd() * 70 | 0},0,0)`;
        roundRect(h, x + pad + ox, y + pad, w - pad * 2, rh - pad * 2, 7);
        const cr = base[0] * shade * (tint > 0.8 ? 1.12 : 1), cg = base[1] * shade, cb = base[2] * shade * (tint < 0.2 ? 1.15 : 1);
        a.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`;
        roundRect(a, x + pad + ox, y + pad, w - pad * 2, rh - pad * 2, 7);
      };
      draw(0); if (x + w > N) draw(-N);
      x += w;
    }
  }
  // grain + wear
  const hd = h.getImageData(0, 0, N, N), ad = a.getImageData(0, 0, N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    const n = fbm(x / 22, y / 22, 4), g = fbm(x / 3.1, y / 3.1, 2);
    const hv = hd.data[i] * (0.8 + 0.3 * n) + (g - 0.5) * 30;
    hd.data[i] = Math.max(0, Math.min(255, hv));
    const k = 0.72 + 0.5 * n + (g - 0.5) * 0.18;
    ad.data[i] = ad.data[i] * k; ad.data[i + 1] = ad.data[i + 1] * k; ad.data[i + 2] = ad.data[i + 2] * k;
    if (hd.data[i] < 40) { ad.data[i] *= 0.35; ad.data[i + 1] *= 0.4; ad.data[i + 2] *= 0.38; } // dark joints
  }
  // cracks
  h.putImageData(hd, 0, 0); a.putImageData(ad, 0, 0);
  for (let c = 0; c < 22; c++) {
    let x = rnd() * N, y = rnd() * N, ang = rnd() * Math.PI * 2;
    h.strokeStyle = 'rgba(0,0,0,.9)'; a.strokeStyle = 'rgba(10,8,12,.8)';
    h.lineWidth = a.lineWidth = 1 + rnd() * 1.4;
    h.beginPath(); a.beginPath(); h.moveTo(x, y); a.moveTo(x, y);
    const len = 6 + rnd() * 14;
    for (let s = 0; s < len; s++) { ang += (rnd() - 0.5) * 1.1; x += Math.cos(ang) * 5; y += Math.sin(ang) * 5; h.lineTo(x, y); a.lineTo(x, y); }
    h.stroke(); a.stroke();
  }
  // normal from height (sobel)
  const H = h.getImageData(0, 0, N, N).data;
  const nC = canvas(N), nx = nC.getContext('2d'); const nd = nx.createImageData(N, N);
  const hh = (x, y) => H[(((y + N) % N) * N + ((x + N) % N)) * 4] / 255;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (hh(x + 1, y) - hh(x - 1, y)) * 3.2, dy = (hh(x, y + 1) - hh(x, y - 1)) * 3.2;
    const l = Math.hypot(dx, dy, 1); const i = (y * N + x) * 4;
    nd.data[i] = (-dx / l * 0.5 + 0.5) * 255; nd.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; nd.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[i + 3] = 255;
  }
  nx.putImageData(nd, 0, 0);
  const map = new THREE.CanvasTexture(aC); map.colorSpace = THREE.SRGBColorSpace;
  const nrm = new THREE.CanvasTexture(nC);
  for (const t of [map, nrm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return { map, nrm };
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill();
}

// Decal atlas (4x4 cells, white-on-transparent masks; colour comes from the instance).
export const DECAL = { SPLAT: 0, SCORCH: 1, CRACK: 2, GLYPH: 3, FROST: 4, SOFT: 5, SIGIL: 6, RING: 7, SPATTER: 8, POOL: 9, RUNES: 10, CLAW: 11, SHADOW: 12, STAR: 13 };
export function makeDecalAtlas() {
  const C = 256, N = C * 4; const cv = canvas(N), c = cv.getContext('2d');
  const rnd = mulberry32(99);
  const cell = (i, fn) => { c.save(); c.translate((i % 4) * C + C / 2, ((i / 4) | 0) * C + C / 2); c.scale(C / 128, C / 128); c.beginPath(); c.rect(-64, -64, 128, 128); c.clip(); fn(); c.restore(); };
  c.fillStyle = '#fff'; c.strokeStyle = '#fff';
  const blob = (r, spikes, jag) => {
    c.beginPath();
    for (let k = 0; k <= spikes; k++) { const a = (k / spikes) * Math.PI * 2; const rr = r * (1 - jag + rnd() * jag * 2); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath(); c.fill();
  };
  cell(DECAL.SPLAT, () => {
    c.filter = 'blur(1.5px)'; blob(34, 22, 0.35);
    for (let k = 0; k < 16; k++) { const a = rnd() * 6.28, d = 36 + rnd() * 22, r = 2 + rnd() * 6; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, 7); c.fill(); }
    c.filter = 'none';
  });
  cell(DECAL.SCORCH, () => {
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 60); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; blob(60, 30, 0.22); c.fillStyle = '#fff';
  });
  cell(DECAL.CRACK, () => {
    c.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      let x = 0, y = 0, a = (k / 7) * 6.28 + rnd() * 0.5; c.lineWidth = 4;
      c.beginPath(); c.moveTo(0, 0);
      for (let s = 0; s < 9; s++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 7; y += Math.sin(a) * 7; c.lineTo(x, y); c.lineWidth *= 0.85; }
      c.stroke();
    }
  });
  // The Hollow Eye: the vigil's own seal. Concentric bands, a ring of runes, twelve hour-marks
  // and a vesica "eye" with an empty pupil — no borrowed pentagrams.
  cell(DECAL.GLYPH, () => {
    c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 61, 0, 7); c.stroke();
    c.lineWidth = 2.4; c.beginPath(); c.arc(0, 0, 58, 0, 7); c.stroke();
    c.lineWidth = 0.8; c.beginPath(); c.arc(0, 0, 47, 0, 7); c.stroke();
    c.font = '9px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let k = 0; k < 24; k++) { const a = (k / 24) * 6.28; c.save(); c.rotate(a); c.fillText(runes[k], 0, -52.5); c.restore(); }
    c.lineWidth = 1.6;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.28; const r0 = k % 3 ? 40 : 34; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); c.stroke(); }
    c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.stroke();
    // vesica eye
    c.lineWidth = 2; c.beginPath(); c.arc(0, 17, 26, Math.PI * 1.18, Math.PI * 1.82); c.stroke(); c.beginPath(); c.arc(0, -17, 26, Math.PI * 0.18, Math.PI * 0.82); c.stroke();
    c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 7.5, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, 2.2, 0, 7); c.fill();
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 22, 0); c.lineTo(s * 30, 0); c.stroke(); }
    c.lineWidth = 0.8; for (let k = 0; k < 7; k++) { const x = -9 + k * 3; c.beginPath(); c.moveTo(x, 10); c.lineTo(x * 1.25, 19); c.stroke(); } // tears
  });
  cell(DECAL.FROST, () => {
    c.lineCap = 'round';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 6.28; const L = 30 + rnd() * 30; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * L, Math.sin(a) * L); c.stroke();
      c.lineWidth = 1.5;
      for (let b = 1; b < 3; b++) { const bx = Math.cos(a) * L * b / 3, by = Math.sin(a) * L * b / 3; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + s * 0.7) * 10, by + Math.sin(a + s * 0.7) * 10); c.stroke(); } }
    }
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 40); g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-64, -64, 128, 128);
  });
  cell(DECAL.SOFT, () => { const g = c.createRadialGradient(0, 0, 0, 0, 0, 62); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-64, -64, 128, 128); });
  // Thorned circle: a ring with inward thorns and a hollow centre.
  cell(DECAL.SIGIL, () => {
    c.lineWidth = 2.2; c.beginPath(); c.arc(0, 0, 54, 0, 7); c.stroke();
    c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 60, 0, 7); c.stroke();
    for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.28; c.beginPath(); c.moveTo(Math.cos(a - 0.1) * 54, Math.sin(a - 0.1) * 54); c.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); c.lineTo(Math.cos(a + 0.1) * 54, Math.sin(a + 0.1) * 54); c.fill(); }
    c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 18, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(0, -26); c.lineTo(0, 26); c.moveTo(-26, 0); c.lineTo(26, 0); c.lineWidth = 0.8; c.stroke();
  });
  cell(DECAL.RING, () => { c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 62, 0, 7); c.stroke(); c.lineWidth = 0.7; c.beginPath(); c.arc(0, 0, 59.5, 0, 7); c.stroke(); for (let k = 0; k < 64; k++) { const a = (k / 64) * 6.28; c.beginPath(); c.moveTo(Math.cos(a) * 59.5, Math.sin(a) * 59.5); c.lineTo(Math.cos(a) * 57.5, Math.sin(a) * 57.5); c.stroke(); } });
  cell(DECAL.SPATTER, () => {
    c.filter = 'blur(1px)';
    for (let k = 0; k < 40; k++) { const a = rnd() * 0.9 - 0.45, d = rnd() * 56, r = 1 + rnd() * 5 * (1 - d / 60); c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * 1.8, r, a, 0, 7); c.fill(); }
    c.filter = 'none';
  });
  cell(DECAL.POOL, () => { c.filter = 'blur(3px)'; blob(46, 16, 0.18); c.filter = 'none'; });
  cell(DECAL.RUNES, () => {
    c.font = '22px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const runes = 'ᛟᛞᛚᛗᛒᛏᛋᛉ';
    for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.28; c.save(); c.rotate(a); c.fillText(runes[k], 0, -44); c.restore(); }
    c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 58, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, 31, 0, 7); c.stroke();
  });
  cell(DECAL.CLAW, () => { c.lineCap = 'round'; for (let k = -1; k <= 1; k++) { c.lineWidth = 6; c.beginPath(); c.moveTo(-40, k * 16 - 10); c.quadraticCurveTo(0, k * 16 + 8, 42, k * 18 - 4); c.stroke(); } });
  cell(DECAL.SHADOW, () => { const g = c.createRadialGradient(0, 0, 0, 0, 0, 62); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.55, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-64, -64, 128, 128); });
  cell(DECAL.STAR, () => {
    c.beginPath(); for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.28; const r = k % 2 ? 14 : 60; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath();
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 60); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,.1)'); c.fillStyle = g; c.fill();
  });
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
  return t;
}

// Gradient textures for light shafts / soft billboards.
export function makeShaftTexture() {
  const cv = canvas(64, 256), c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 256);
  const h = c.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  c.globalCompositeOperation = 'destination-out'; c.fillStyle = h; c.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(cv); return t;
}
