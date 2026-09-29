import * as THREE from 'three';
import { GeoBuilder, P } from '../render/materials.js';

// Prop sculpts. Palette is deliberately narrow: bruised stone, soot, bone, iron,
// with emissive accents only where fire or magic lives.
const STONE = 0x6d6671, STONE_D = 0x4a4550, STONE_W = 0x7d7466, SOOT = 0x241f26, BONE = 0xcfc3a6, IRON = 0x2b2a2e, WAX = 0xe8dcc0, FLAME = 0xffa04a, WOOD = 0x3a2b24, MOSS = 0x3f5a44;

export function pillar(kind = 'full') {
  const b = new GeoBuilder();
  const h = kind === 'full' ? 9 : kind === 'broken' ? 5.2 : 1.8;
  b.add(P.box(2.2, 0.7, 2.2), STONE_D, { p: [0, 0.35, 0] });
  b.add(P.box(1.8, 0.35, 1.8), STONE, { p: [0, 0.85, 0] });
  b.add(P.cyl(0.72, 0.8, h - 1, 10), STONE, { p: [0, 0.5 + h / 2, 0], shade: [0.6, 1.1, 0, h] });
  // fluting suggestion: four thin darker strips
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; b.add(P.box(0.12, h - 1.4, 0.12), STONE_D, { p: [Math.cos(a) * 0.74, 0.5 + h / 2, Math.sin(a) * 0.74] }); }
  if (kind === 'full') {
    b.add(P.box(2.0, 0.5, 2.0), STONE, { p: [0, h + 0.3, 0] });
    b.add(P.cyl(1.2, 0.8, 0.6, 8), STONE_W, { p: [0, h - 0.1, 0] });
  } else {
    b.add(P.cone(0.8, 1.1, 7), STONE, { p: [0.1, 0.5 + h + 0.2, 0], r: [0.25, 0, 0.3], jitter: 0.25 });
  }
  return b.build();
}
export function fallenColumn() {
  const b = new GeoBuilder();
  b.add(P.cyl(0.75, 0.75, 3.6, 10), STONE, { p: [0, 0.7, 0], r: [0, 0, Math.PI / 2] });
  b.add(P.cyl(0.75, 0.75, 2.6, 10), STONE_D, { p: [3.4, 0.7, 0.5], r: [0, 0.3, Math.PI / 2] });
  b.add(P.dod(0.5), STONE, { p: [-2.2, 0.3, 0.8] }); b.add(P.dod(0.35), STONE_D, { p: [1.8, 0.2, -1] });
  return b.build();
}
export function hoodedStatue() {
  const b = new GeoBuilder();
  b.add(P.box(1.8, 1.0, 1.8), STONE_D, { p: [0, 0.5, 0] });
  b.add(P.cyl(0.35, 0.9, 2.4, 8), STONE_W, { p: [0, 2.2, 0], shade: [0.6, 1.1, 1, 3.4] });
  b.add(P.cone(0.62, 1.3, 8), STONE_W, { p: [0, 3.9, 0.05] });
  b.add(P.sph(0.3, 6, 4), SOOT, { p: [0, 3.7, 0.33] }); // hollow face
  b.add(P.box(0.25, 0.9, 0.25), STONE_W, { p: [0.28, 2.6, 0.45], r: [0.9, 0, -0.4] });
  b.add(P.box(0.25, 0.9, 0.25), STONE_W, { p: [-0.28, 2.6, 0.45], r: [0.9, 0, 0.4] });
  b.add(P.sph(0.1, 5, 4), 0xff5a3a, { p: [0, 2.95, 0.72], glow: 0.45 }); // votive ember held in hands
  return b.build();
}
export function obelisk() {
  const b = new GeoBuilder();
  b.add(P.box(1.6, 0.6, 1.6), STONE_D, { p: [0, 0.3, 0] });
  b.add(P.cyl(0.35, 0.6, 4.2, 4), SOOT, { p: [0, 2.7, 0], r: [0, Math.PI / 4, 0] });
  b.add(P.cone(0.35, 0.8, 4), SOOT, { p: [0, 5.2, 0], r: [0, Math.PI / 4, 0] });
  for (let i = 0; i < 3; i++) b.add(P.box(0.5, 0.06, 0.02), 0xff6a30, { p: [0, 2 + i * 0.8, 0.44], glow: 0.8 }); // runes
  candles(b, 0, 0, 5, 0.9);
  return b.build();
}
function candles(b, cx, cz, n, rad) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + i, r = rad * (0.6 + (i % 3) * 0.2), h = 0.25 + ((i * 37) % 10) / 20;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    b.add(P.cyl(0.07, 0.08, h, 5), WAX, { p: [x, h / 2, z] });
    b.add(P.cone(0.05, 0.16, 4), FLAME, { p: [x, h + 0.09, z], glow: 0.9 });
  }
}
export function candleCluster() { const b = new GeoBuilder(); candles(b, 0, 0, 9, 0.7); b.add(P.cyl(0.6, 0.7, 0.04, 8), WAX, { p: [0, 0.02, 0] }); return b.build(); }
export function tombstone(v = 0) {
  const b = new GeoBuilder();
  if (v === 0) { b.add(P.box(0.9, 1.3, 0.25), STONE, { p: [0, 0.65, 0], shade: [0.5, 1, 0, 1.3] }); b.add(P.cyl(0.45, 0.45, 0.25, 8, false), STONE, { p: [0, 1.3, 0], r: [Math.PI / 2, 0, 0] }); }
  else if (v === 1) { b.add(P.box(0.25, 1.9, 0.25), STONE_D, { p: [0, 0.95, 0] }); b.add(P.box(1.1, 0.22, 0.25), STONE_D, { p: [0, 1.75, 0] }); b.add(P.box(0.7, 0.14, 0.26), STONE_D, { p: [0, 1.25, 0] }); }
  else { b.add(P.cyl(0.18, 0.32, 1.7, 4), STONE, { p: [0, 0.85, 0], r: [0, 0.78, 0] }); b.add(P.oct(0.28), STONE, { p: [0, 1.8, 0] }); }
  b.add(P.box(1.1, 0.12, 1.8), 0x2a2522, { p: [0, 0.06, 0.9] }); // grave slab
  return b.build();
}
export function deadTree(seed = 1, scale = 1, sick = false) {
  const b = new GeoBuilder();
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return (s % 1000) / 1000; };
  const bark = sick ? 0x2c3029 : 0x2a2220;
  const branch = (x, y, z, ang, tilt, len, rad, depth) => {
    const dx = Math.sin(tilt) * Math.cos(ang), dy = Math.cos(tilt), dz = Math.sin(tilt) * Math.sin(ang);
    const ex = x + dx * len, ey = y + dy * len, ez = z + dz * len;
    const g = P.cyl(rad * 0.55, rad, len, 5); g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz));
    const e = new THREE.Euler().setFromQuaternion(q);
    b.add(g, bark, { p: [x, y, z], r: [e.x, e.y, e.z], shade: [0.6, 1.1, 0, 7] });
    if (depth > 0) {
      const n = depth === 3 ? 3 : 2;
      for (let i = 0; i < n; i++) branch(ex, ey, ez, ang + (r() - 0.5) * 2.6 + i * 2.1, tilt + 0.35 + r() * 0.5, len * (0.55 + r() * 0.2), rad * 0.55, depth - 1);
    }
  };
  branch(0, 0, 0, r() * 6, 0.12, 3.6 * scale, 0.42 * scale, 3);
  for (let i = 0; i < 4; i++) { const a = i * 1.7; b.add(P.cone(0.18 * scale, 1.6 * scale, 4), bark, { p: [Math.cos(a) * 0.5 * scale, 0.15, Math.sin(a) * 0.5 * scale], r: [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3] }); }
  if (sick) for (let i = 0; i < 5; i++) { const a = i * 1.3; b.add(P.sph(0.1, 4, 3), 0x7dffb0, { p: [Math.cos(a) * 0.45, 0.6 + i * 0.35, Math.sin(a) * 0.45], glow: 1.2 }); }
  return b.build();
}
export function rock(v = 0) {
  const b = new GeoBuilder();
  b.add(P.dod(0.9), STONE_D, { p: [0, 0.35, 0], s: [1.3, 0.8, 1], jitter: 0.25 });
  if (v) { b.add(P.dod(0.5), STONE, { p: [0.9, 0.2, 0.3], jitter: 0.15 }); b.add(P.box(0.9, 0.35, 0.6), STONE, { p: [-0.8, 0.15, 0.6], r: [0.1, 0.5, 0.15] }); }
  return b.build();
}
export function bonePile() {
  const b = new GeoBuilder();
  for (let i = 0; i < 9; i++) { const a = i * 2.39, r = 0.25 + (i % 3) * 0.2; b.add(P.cap(0.05, 0.6), BONE, { p: [Math.cos(a) * r, 0.08 + (i % 2) * 0.08, Math.sin(a) * r], r: [Math.PI / 2, a, 0] }); }
  for (let i = 0; i < 3; i++) { const a = i * 2.1; b.add(P.sph(0.17, 6, 5), BONE, { p: [Math.cos(a) * 0.3, 0.2 + i * 0.1, Math.sin(a) * 0.3] }); b.add(P.sph(0.04, 4, 3), SOOT, { p: [Math.cos(a) * 0.3 + 0.05, 0.22 + i * 0.1, Math.sin(a) * 0.3 + 0.14] }); }
  return b.build();
}
export function skullPyramid() {
  const b = new GeoBuilder();
  let k = 0;
  for (let lvl = 0; lvl < 4; lvl++) { const n = 8 - lvl * 2, r = 1.1 - lvl * 0.28; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + lvl; b.add(P.sph(0.22, 6, 5), BONE, { p: [Math.cos(a) * r, 0.22 + lvl * 0.34, Math.sin(a) * r] }); b.add(P.sph(0.06, 4, 3), 0x7dffb0, { p: [Math.cos(a) * (r + 0.18), 0.25 + lvl * 0.34, Math.sin(a) * (r + 0.18)], glow: (k++ % 3 === 0) ? 1.2 : 0 }); } }
  b.add(P.sph(0.28, 6, 5), BONE, { p: [0, 1.6, 0] });
  return b.build();
}
export function brazier() {
  const b = new GeoBuilder();
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; b.add(P.box(0.08, 1.3, 0.08), IRON, { p: [Math.cos(a) * 0.35, 0.6, Math.sin(a) * 0.35], r: [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25] }); }
  b.add(P.cyl(0.6, 0.3, 0.4, 8, true), IRON, { p: [0, 1.35, 0] });
  b.add(P.cyl(0.52, 0.52, 0.08, 8), 0xff6a2a, { p: [0, 1.45, 0], glow: 0.55 });
  return b.build();
}
export function arch() {
  const b = new GeoBuilder();
  for (const s of [-1, 1]) { b.add(P.box(1.2, 6, 1.4), STONE, { p: [s * 3, 3, 0], shade: [0.55, 1.05, 0, 6] }); b.add(P.box(1.5, 0.6, 1.7), STONE_D, { p: [s * 3, 0.3, 0] }); }
  const t = P.tor(3, 0.6, 5, 12, Math.PI); b.add(t, STONE, { p: [0, 6, 0] });
  b.add(P.box(0.7, 1.1, 0.5), SOOT, { p: [0, 9.3, 0.4] }); // keystone mask
  b.add(P.sph(0.1, 4, 3), 0xff6a30, { p: [-0.15, 9.4, 0.7], glow: 1.5 }); b.add(P.sph(0.1, 4, 3), 0xff6a30, { p: [0.15, 9.4, 0.7], glow: 1.5 });
  return b.build();
}
export function brokenWall(len = 6) {
  const b = new GeoBuilder();
  for (let i = 0; i < len; i++) { const h = 1 + ((i * 7919) % 5) * 0.6; b.add(P.box(1.05, h, 0.9), i % 2 ? STONE : STONE_D, { p: [i - len / 2 + 0.5, h / 2, 0], shade: [0.55, 1, 0, 4] }); }
  b.add(P.dod(0.5), STONE, { p: [len / 2 + 0.6, 0.25, 0.8] });
  return b.build();
}
export function pew() {
  const b = new GeoBuilder();
  b.add(P.box(3.2, 0.12, 0.7), WOOD, { p: [0, 0.55, 0] });
  b.add(P.box(3.2, 0.8, 0.1), WOOD, { p: [0, 0.95, -0.33] });
  for (const s of [-1.5, 1.5]) b.add(P.box(0.12, 0.55, 0.7), WOOD, { p: [s, 0.28, 0] });
  return b.build();
}
export function mushrooms(col = 0x6fffe0) {
  const b = new GeoBuilder();
  for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 0.15 + (i % 3) * 0.2, h = 0.2 + (i % 4) * 0.12; b.add(P.cyl(0.04, 0.06, h, 4), 0xcfd3c0, { p: [Math.cos(a) * r, h / 2, Math.sin(a) * r] }); b.add(P.sph(0.1 + (i % 2) * 0.06, 6, 3), col, { p: [Math.cos(a) * r, h, Math.sin(a) * r], s: [1, 0.5, 1], glow: 0.9 }); }
  return b.build();
}
export function crystals(col = 0xa877ff) {
  const b = new GeoBuilder();
  for (let i = 0; i < 6; i++) { const a = i * 1.1, h = 0.6 + (i % 3) * 0.5; b.add(P.cyl(0, 0.2, h, 5), col, { p: [Math.cos(a) * 0.3, h / 2, Math.sin(a) * 0.3], r: [Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4], glow: 0.55 }); }
  b.add(P.dod(0.35), STONE_D, { p: [0, 0.1, 0] });
  return b.build();
}
export function thornRoot() {
  const b = new GeoBuilder();
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + (i % 2) * 0.4, L = 1.8 + (i % 3); const g = P.cyl(0.02, 0.2, L, 4); g.translate(0, L / 2, 0); b.add(g, 0x1f1a1c, { p: [0, 0.05, 0], r: [Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35] }); for (let k = 1; k < 4; k++) b.add(P.cone(0.04, 0.25, 3), 0x3a1a20, { p: [Math.sin(a) * L * k / 4 * 0.97, 0.1 + 0.15, -Math.cos(a) * L * k / 4 * 0.2], r: [0, a, 0.8] }); }
  return b.build();
}
export function mausoleum() {
  const b = new GeoBuilder();
  b.add(P.box(5, 0.5, 6), STONE_D, { p: [0, 0.25, 0] });
  b.add(P.box(4, 3.4, 5), STONE, { p: [0, 2.2, 0], shade: [0.5, 1, 0, 4] });
  b.add(P.cone(3.6, 1.8, 4), SOOT, { p: [0, 4.8, 0], r: [0, Math.PI / 4, 0], s: [1, 1, 1.2] });
  for (const s of [-1, 1]) b.add(P.cyl(0.25, 0.3, 3.4, 6), STONE_W, { p: [s * 1.3, 2.2, 2.7] });
  b.add(P.box(1.4, 2.2, 0.2), 0x0a0808, { p: [0, 1.6, 2.52] });
  b.add(P.box(1.0, 0.08, 0.05), 0x7dffb0, { p: [0, 3.1, 2.62], glow: 1 });
  return b.build();
}
export function cage() {
  const b = new GeoBuilder();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.add(P.box(0.05, 2, 0.05), IRON, { p: [Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6] }); }
  b.add(P.tor(0.6, 0.05, 3, 10), IRON, { p: [0, 2, 0], r: [Math.PI / 2, 0, 0] }); b.add(P.tor(0.6, 0.05, 3, 10), IRON, { p: [0, 0.05, 0], r: [Math.PI / 2, 0, 0] });
  b.add(P.cap(0.18, 0.7), BONE, { p: [0.1, 0.5, 0], r: [0, 0, 1.2] }); b.add(P.sph(0.2, 6, 5), BONE, { p: [-0.25, 0.3, 0.1] });
  return b.build();
}
// The great kneeling colossus in the apse — the Hollow Saint before she wakes.
export function colossus(sick = false) {
  const b = new GeoBuilder();
  const S = sick ? 0x3b4a40 : STONE_W;
  b.add(P.box(10, 1.4, 8), STONE_D, { p: [0, 0.7, 0] });
  b.add(P.box(8.5, 1, 6.5), STONE, { p: [0, 1.9, 0] });
  b.add(P.cyl(2.4, 4.2, 7, 9), S, { p: [0, 5.8, 0], shade: [0.55, 1.05, 2, 10] }); // robed body kneeling
  b.add(P.sph(2.2, 9, 6), S, { p: [0, 9.6, 0.3], s: [1, 1.1, 1] }); // shoulders
  b.add(P.cone(1.7, 3.6, 9), S, { p: [0, 12, 0.6], r: [0.25, 0, 0] }); // hood bowed
  b.add(P.sph(1.05, 7, 5), 0x07060a, { p: [0, 11.4, 1.6] }); // empty face
  for (const s of [-1, 1]) {
    b.add(P.cyl(0.55, 0.75, 4.2, 7), S, { p: [s * 1.6, 8.3, 2], r: [1.1, 0, s * -0.35] });
    b.add(P.box(1.0, 0.5, 1.4), S, { p: [s * 0.55, 7.2, 3.6], r: [0.3, 0, s * 0.4] }); // clasped hands
  }
  // halo of blades, broken
  for (let i = 0; i < 14; i++) {
    if (i === 3 || i === 9) continue;
    const a = (i / 14) * Math.PI * 2; const R = 4.2;
    b.add(P.cone(0.25, 1.6, 4), 0xd9a84e, { p: [Math.cos(a) * R, 12.6 + Math.sin(a) * R, -1.2], r: [0, 0, a - Math.PI / 2], glow: 0.35 });
  }
  b.add(P.tor(4.2, 0.12, 4, 30), 0xd9a84e, { p: [0, 12.6, -1.2], glow: 0.45 });
  candles(b, 0, 5, 16, 3.2);
  return b.build();
}
export function shrineMesh(kind) {
  const b = new GeoBuilder();
  const glow = kind === 'blood' ? 0xff2440 : kind === 'bell' ? 0xa877ff : 0xffe2a0;
  b.add(P.cyl(1.9, 2.2, 0.35, 8), STONE_D, { p: [0, 0.17, 0] });
  b.add(P.cyl(1.5, 1.6, 0.2, 8), STONE, { p: [0, 0.45, 0] });
  if (kind === 'blood') {
    b.add(P.box(1.6, 1, 0.9), STONE, { p: [0, 1.05, 0] });
    b.add(P.box(1.3, 0.08, 0.7), 0x6a0010, { p: [0, 1.58, 0], glow: 0.9 });
    for (const s of [-1, 1]) b.add(P.cone(0.12, 1.4, 4), 0xcfc3a6, { p: [s * 0.9, 2, 0], r: [0, 0, s * 0.35] });
  } else if (kind === 'bell') {
    for (const s of [-1, 1]) b.add(P.box(0.3, 3.4, 0.3), WOOD, { p: [s * 1.1, 2.1, 0] });
    b.add(P.box(2.6, 0.3, 0.4), WOOD, { p: [0, 3.8, 0] });
    b.add(P.cyl(0.35, 0.8, 1.2, 9, true), 0x3b3230, { p: [0, 3.0, 0], side: THREE.DoubleSide });
    b.add(P.sph(0.14, 5, 4), glow, { p: [0, 2.4, 0], glow: 1.4 });
  } else {
    b.add(P.cyl(0.9, 0.5, 0.9, 8), STONE, { p: [0, 1.0, 0] });
    b.add(P.cyl(0.8, 0.8, 0.06, 8), 0xffe2a0, { p: [0, 1.46, 0], glow: 1 });
    b.add(P.cone(0.2, 2.2, 4), 0xcfc3a6, { p: [0, 2.3, -0.5] });
  }
  return b.build();
}
