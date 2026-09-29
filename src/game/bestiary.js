import { GeoBuilder, P } from '../render/materials.js';

// Creature sculpts. Each archetype has one unmistakable silhouette feature
// (hunch, spine ridge, wings, candle-back, hood+halo, maw, tower shield, mitre, boils).
// Values are kept a clear step brighter than the ground so crowds never dissolve into it.
const FLESH = 0xb8a88e, ROBE = 0x6a5a50, EMBER = 0xff6a2a, BONE = 0xe6dcc2, IRON = 0x5a5d66, VIOLET = 0xb070ff, SICK = 0xc4ff5a;

export const MODELS = {
  husk() {
    const b = new GeoBuilder();
    b.add(P.cone(0.5, 1.3, 7), ROBE, { p: [0, 0.65, 0], shade: [0.5, 1, 0, 1.3], jitter: 0.06 });
    b.add(P.sph(0.36, 7, 5), ROBE, { p: [0, 1.22, 0.08], s: [1.1, 0.9, 1] });
    b.add(P.cone(0.3, 0.5, 6), 0x2a2320, { p: [0, 1.52, 0.22], r: [0.6, 0, 0] });
    b.add(P.sph(0.2, 6, 5), FLESH, { p: [0, 1.38, 0.38] });
    for (const s of [-1, 1]) {
      b.add(P.sph(0.045, 4, 3), EMBER, { p: [s * 0.08, 1.41, 0.55], glow: 2 });
      b.add(P.cyl(0.05, 0.08, 0.85, 5), FLESH, { p: [s * 0.3, 1.05, 0.45], r: [1.25, 0, s * 0.15] });
      b.add(P.cone(0.07, 0.25, 4), FLESH, { p: [s * 0.32, 0.9, 0.87], r: [1.6, 0, 0] });
    }
    return b.build();
  },
  gnawer() {
    const b = new GeoBuilder();
    const C = 0x8a4c46;
    b.add(P.sph(0.42, 8, 6), C, { p: [0, 0.6, 0], s: [0.85, 0.75, 1.7], shade: [0.6, 1.1, 0.2, 1] });
    for (let i = 0; i < 6; i++) b.add(P.cone(0.07, 0.42 - i * 0.03, 4), BONE, { p: [0, 0.95 - i * 0.02, 0.45 - i * 0.2], r: [-0.5, 0, 0] });
    b.add(P.cone(0.24, 0.7, 6), C, { p: [0, 0.6, 0.95], r: [Math.PI / 2, 0, 0] });
    b.add(P.box(0.3, 0.07, 0.45), BONE, { p: [0, 0.43, 0.95] });
    for (const s of [-1, 1]) {
      b.add(P.sph(0.05, 4, 3), 0xff2a2a, { p: [s * 0.13, 0.72, 0.9], glow: 2.2 });
      b.add(P.cyl(0.05, 0.03, 0.6, 4), C, { p: [s * 0.3, 0.3, 0.45], r: [0.3, 0, s * 0.25] });
      b.add(P.cyl(0.05, 0.03, 0.6, 4), C, { p: [s * 0.3, 0.3, -0.45], r: [-0.3, 0, s * 0.25] });
    }
    b.add(P.cone(0.08, 0.8, 4), C, { p: [0, 0.6, -0.95], r: [-1.3, 0, 0] });
    return b.build();
  },
  moth() {
    const b = new GeoBuilder();
    const W = 0xa99f8e;
    b.add(P.cap(0.14, 0.5), 0x3a302c, { p: [0, 0, 0], r: [Math.PI / 2, 0, 0] });
    for (const s of [-1, 1]) {
      b.add(P.box(1.2, 0.03, 0.8), W, { p: [s * 0.68, 0.02, 0.1], r: [0, s * 0.25, s * 0.12] });
      b.add(P.box(0.8, 0.03, 0.55), W, { p: [s * 0.5, 0.0, -0.45], r: [0, -s * 0.35, s * 0.1] });
      b.add(P.cyl(0.13, 0.13, 0.04, 8), VIOLET, { p: [s * 0.78, 0.05, 0.15], glow: 1.3 });
      b.add(P.cyl(0.05, 0.05, 0.05, 6), 0x1a1016, { p: [s * 0.78, 0.07, 0.15] });
      b.add(P.cyl(0.01, 0.01, 0.45, 3), 0x3a302c, { p: [s * 0.1, 0.1, 0.5], r: [1.1, 0, s * 0.4] });
    }
    return b.build();
  },
  brute() {
    const b = new GeoBuilder();
    const F = 0x9a7c6c;
    for (const s of [-1, 1]) b.add(P.cyl(0.28, 0.34, 1.0, 6), F, { p: [s * 0.45, 0.5, 0] });
    b.add(P.sph(1.0, 8, 6), F, { p: [0, 1.75, 0.15], s: [1.15, 1.0, 0.95], shade: [0.6, 1.05, 1, 2.6] });
    b.add(P.box(0.5, 0.5, 0.45), IRON, { p: [0, 2.35, 0.95] });
    b.add(P.box(0.3, 0.05, 0.05), EMBER, { p: [0, 2.38, 1.18], glow: 2 });
    for (const s of [-1, 1]) {
      b.add(P.cyl(0.28, 0.36, 1.5, 6), F, { p: [s * 1.2, 1.35, 0.4], r: [0.5, 0, s * 0.2] });
      b.add(P.sph(0.46, 6, 5), F, { p: [s * 1.35, 0.55, 0.85] });
      b.add(P.tor(0.34, 0.08, 4, 10), IRON, { p: [s * 1.3, 0.9, 0.7], r: [1.1, 0, 0] });
    }
    // penitent candles fused into its back
    for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.36; b.add(P.cyl(0.06, 0.07, 0.5, 4), 0xe8dcc0, { p: [Math.sin(a) * 0.7, 2.5 + (i % 2) * 0.15, -0.55 + Math.cos(a) * 0.1] }); b.add(P.cone(0.05, 0.16, 4), 0xffa04a, { p: [Math.sin(a) * 0.7, 2.83 + (i % 2) * 0.15, -0.55 + Math.cos(a) * 0.1], glow: 2 }); }
    return b.build();
  },
  hexcaster() {
    const b = new GeoBuilder();
    const R = 0x45345a;
    b.add(P.cone(0.45, 1.9, 7), R, { p: [0, 1.25, 0], shade: [0.4, 1, 0.3, 2.2] });
    b.add(P.cone(0.32, 0.8, 6), R, { p: [0, 2.35, -0.05], r: [-0.15, 0, 0] });
    b.add(P.sph(0.2, 6, 5), 0x07050a, { p: [0, 2.08, 0.15] });
    for (const x of [-0.07, 0, 0.07]) b.add(P.sph(0.035, 4, 3), VIOLET, { p: [x, 2.12 + (x ? 0 : 0.06), 0.33], glow: 2.5 });
    b.add(P.tor(0.42, 0.03, 3, 18), VIOLET, { p: [0, 2.3, -0.3], glow: 1.2 });
    for (const s of [-1, 1]) b.add(P.sph(0.09, 5, 4), VIOLET, { p: [s * 0.3, 1.35, 0.4], glow: 1.8 });
    b.add(P.oct(0.16), VIOLET, { p: [0, 1.5, 0.65], glow: 2.5 });
    return b.build();
  },
  worm() {
    const b = new GeoBuilder();
    const S = 0x9a8a76;
    const segs = [[0, 0.3, -0.2, 0.62], [0, 0.95, -0.05, 0.56], [0, 1.55, 0.18, 0.5], [0, 2.05, 0.5, 0.45], [0, 2.4, 0.92, 0.42]];
    segs.forEach(([x, y, z, r], i) => { b.add(P.sph(r, 8, 6), S, { p: [x, y, z], shade: [0.6, 1.1, 0, 2.6] }); b.add(P.tor(r * 0.95, 0.06, 3, 10), 0x5a4a3e, { p: [x, y - r * 0.3, z], r: [Math.PI / 2 - i * 0.15, 0, 0] }); });
    b.add(P.cyl(0.36, 0.3, 0.1, 10), 0xff3030, { p: [0, 2.5, 1.3], r: [1.2, 0, 0], glow: 1.8 });
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; b.add(P.cone(0.06, 0.3, 3), BONE, { p: [Math.cos(a) * 0.36, 2.5 + Math.sin(a) * 0.32 * 0.4, 1.28 + Math.sin(a) * 0.12], r: [1.2 + Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.9] }); }
    return b.build();
  },
  bulwark() {
    const b = new GeoBuilder();
    for (const s of [-1, 1]) b.add(P.box(0.3, 0.9, 0.35), IRON, { p: [s * 0.25, 0.45, 0] });
    b.add(P.box(0.9, 0.95, 0.6), IRON, { p: [0, 1.35, 0], shade: [0.7, 1.1, 0.9, 1.8] });
    b.add(P.cyl(0.26, 0.3, 0.55, 8), 0x2a2c31, { p: [0, 2.1, 0] });
    b.add(P.box(0.32, 0.04, 0.05), EMBER, { p: [0, 2.12, 0.28], glow: 2.4 });
    b.add(P.cone(0.1, 0.5, 4), 0x6a1520, { p: [0, 2.55, -0.05] }); // plume
    // tower shield
    b.add(P.box(1.35, 1.75, 0.14), 0x3b322c, { p: [0.05, 1.15, 0.62], shade: [0.7, 1.1, 0.2, 2] });
    b.add(P.box(1.45, 0.1, 0.18), IRON, { p: [0.05, 2.0, 0.62] }); b.add(P.box(1.45, 0.1, 0.18), IRON, { p: [0.05, 0.3, 0.62] });
    b.add(P.tor(0.28, 0.035, 3, 16), 0xd9a84e, { p: [0.05, 1.25, 0.71], glow: 1.1 });
    b.add(P.box(0.05, 0.5, 0.03), 0xd9a84e, { p: [0.05, 1.25, 0.72], glow: 1.1 });
    return b.build();
  },
  bishop() {
    const b = new GeoBuilder();
    b.add(P.cone(0.75, 2.2, 8), 0xcfc3a6, { p: [0, 1.1, 0], shade: [0.5, 1, 0, 2.2] });
    b.add(P.box(0.22, 1.6, 0.05), 0x8a1020, { p: [0, 1.1, 0.4], r: [-0.2, 0, 0] });
    b.add(P.sph(0.24, 6, 5), BONE, { p: [0, 2.35, 0.08] });
    b.add(P.cone(0.22, 0.75, 4), 0xcfc3a6, { p: [0, 2.85, 0.02], s: [1, 1, 0.6] });
    b.add(P.box(0.04, 0.6, 0.02), 0xd9a84e, { p: [0, 2.85, 0.16], glow: 0.9 });
    for (const s of [-1, 1]) b.add(P.sph(0.05, 4, 3), 0x7dffb0, { p: [s * 0.08, 2.38, 0.28], glow: 2.5 });
    b.add(P.cyl(0.04, 0.04, 3.2, 5), 0x2b2320, { p: [0.62, 1.6, 0.2] });
    b.add(P.sph(0.2, 6, 5), BONE, { p: [0.62, 3.25, 0.2] });
    b.add(P.oct(0.12), 0x7dffb0, { p: [0.62, 3.25, 0.2], glow: 3 });
    return b.build();
  },
  pustulant() {
    const b = new GeoBuilder();
    b.add(P.sph(0.78, 9, 7), 0x94904f, { p: [0, 0.95, 0], s: [1, 0.9, 1], shade: [0.6, 1.05, 0.2, 1.7] });
    for (let i = 0; i < 9; i++) { const a = i * 2.4, y = 0.6 + (i % 3) * 0.35; b.add(P.sph(0.14 + (i % 3) * 0.05, 5, 4), SICK, { p: [Math.cos(a) * 0.72, y, Math.sin(a) * 0.72], glow: 1.1 }); }
    b.add(P.box(0.4, 0.12, 0.1), 0x100808, { p: [0, 1.0, 0.75] });
    for (const s of [-1, 1]) b.add(P.cyl(0.07, 0.05, 0.5, 4), 0x5a5a38, { p: [s * 0.35, 0.22, 0.1] });
    return b.build();
  },
  thrall() {
    const b = new GeoBuilder();
    b.add(P.cyl(0.05, 0.06, 0.9, 4), BONE, { p: [0, 1.0, 0] });
    for (let i = 0; i < 3; i++) b.add(P.tor(0.22 - i * 0.03, 0.03, 3, 8, Math.PI * 1.4), BONE, { p: [0, 1.25 - i * 0.14, 0.02], r: [Math.PI / 2, 0, Math.PI * 0.8] });
    b.add(P.sph(0.19, 6, 5), BONE, { p: [0, 1.62, 0.04] });
    for (const s of [-1, 1]) { b.add(P.sph(0.04, 4, 3), 0x7dffb0, { p: [s * 0.07, 1.64, 0.2], glow: 3 }); b.add(P.cyl(0.03, 0.03, 0.8, 4), BONE, { p: [s * 0.25, 1.05, 0.1], r: [0.4, 0, s * 0.2] }); b.add(P.cyl(0.035, 0.035, 0.85, 4), BONE, { p: [s * 0.12, 0.42, 0] }); }
    b.add(P.box(0.08, 0.9, 0.02), 0x9fb3b0, { p: [0.3, 0.9, 0.55], r: [1.0, 0, 0] });
    b.add(P.box(0.05, 0.8, 0.01), 0x7dffb0, { p: [0.3, 0.92, 0.56], r: [1.0, 0, 0], glow: 0.6 });
    return b.build();
  },
};

// Stats are base values at 0:00; the director scales hp/damage with time.
// role drives AI; soul = element colour released on death.
export const ENEMIES = {
  husk:      { name: 'Husk', model: 'husk', hp: 13, speed: 2.35, dmg: 8, r: 0.5, xp: 1, mass: 1, soul: 'fire', blood: [0.07, 0.01, 0.015], role: 'chase', height: 1.7, bob: 0.06, bobF: 7 },
  gnawer:    { name: 'Gnawer', model: 'gnawer', hp: 9, speed: 4.2, dmg: 7, r: 0.5, xp: 1, mass: 0.7, soul: 'blood', blood: [0.12, 0.005, 0.01], role: 'lunge', height: 1, bob: 0.08, bobF: 14 },
  moth:      { name: 'Carrion Moth', model: 'moth', hp: 7, speed: 3.9, dmg: 5, r: 0.55, xp: 1, mass: 0.4, soul: 'arcane', blood: [0.05, 0.03, 0.06], role: 'flutter', flying: true, height: 1.6, bob: 0.25, bobF: 5 },
  brute:     { name: 'Penitent Brute', model: 'brute', hp: 130, speed: 1.65, dmg: 18, r: 1.15, xp: 8, mass: 7, knockRes: 0.85, soul: 'fire', blood: [0.1, 0.01, 0.01], role: 'slam', height: 2.9, bob: 0.05, bobF: 3.4 },
  hexcaster: { name: 'Hexcaster', model: 'hexcaster', hp: 24, speed: 2.4, dmg: 10, r: 0.55, xp: 3, mass: 1, soul: 'shadow', blood: [0.05, 0.01, 0.07], role: 'caster', height: 2.5, bob: 0.12, bobF: 2.2, hover: 0.25 },
  worm:      { name: 'Grave Worm', model: 'worm', hp: 55, speed: 5.2, dmg: 16, r: 0.9, xp: 5, mass: 5, knockRes: 1, soul: 'blood', blood: [0.09, 0.05, 0.02], role: 'burrow', height: 2.7, bob: 0.08, bobF: 3 },
  bulwark:   { name: 'Bulwark Knight', model: 'bulwark', hp: 70, speed: 2.0, dmg: 12, r: 0.85, xp: 4, mass: 4, knockRes: 0.7, soul: 'holy', blood: [0.04, 0.03, 0.03], role: 'shield', height: 2.6, bob: 0.04, bobF: 6, metal: true },
  bishop:    { name: 'Bone Bishop', model: 'bishop', hp: 85, speed: 1.7, dmg: 10, r: 0.8, xp: 8, mass: 3, knockRes: 0.5, soul: 'necro', blood: [0.05, 0.05, 0.04], role: 'summoner', height: 3.3, bob: 0.05, bobF: 2 },
  pustulant: { name: 'Pustulant', model: 'pustulant', hp: 30, speed: 1.95, dmg: 9, r: 0.8, xp: 3, mass: 2, soul: 'necro', blood: [0.08, 0.1, 0.02], role: 'bloat', height: 1.8, bob: 0.06, bobF: 4 },
};

// Spawn weights by time (seconds) — each archetype ramps in with its own curve.
export function spawnWeights(t, map) {
  const w = {
    husk: t < 480 ? 10 - t / 80 : 3,
    gnawer: t > 30 ? 4 + t / 120 : 0,
    moth: t > 75 ? (map === 'thornwood' ? 6 : 4) : 0,
    hexcaster: t > 105 ? 1.4 + t / 300 : 0,
    pustulant: t > 180 ? 1.6 : 0,
    bulwark: t > 210 ? 1.3 + t / 400 : 0,
    brute: t > 170 ? 0.5 + t / 500 : 0,
    worm: t > 330 ? (map === 'thornwood' ? 1.8 : 1.1) : 0,
    bishop: t > 360 ? 0.5 : 0,
  };
  return w;
}
