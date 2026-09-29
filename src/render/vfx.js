import * as THREE from 'three';
import { ParticleSystem } from './particles.js';
import { Ribbons } from './ribbons.js';
import { Decals, Telegraphs } from './ground.js';
import { DECAL } from './textures.js';
import { ELEM } from '../game/data.js';
import { rand, TAU } from '../core/util.js';

// One vocabulary of effects shared by every weapon, enemy and boss so the whole game
// speaks the same visual language: hot cores, shaped embers, ground memory (decals).
export class VFX {
  constructor(scene, rr) {
    this.rr = rr;
    this.add = new ParticleSystem(scene, 14000, true, 11);
    this.smoke = new ParticleSystem(scene, 5000, false, 9);
    this.rib = new Ribbons(scene, 7000);
    this.decals = new Decals(scene, 700, false);
    this.glow = new Decals(scene, 420, true);
    this.tele = new Telegraphs(scene, 96);
    this.lights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 12, 1.6); l.position.set(0, -50, 0); scene.add(l);
      this.lights.push({ l, t: 0, max: 1, i0: 0 });
    }
    // Fixed light budget: lights are never added/removed at runtime (that would recompile every material).
    this.bossLight = new THREE.PointLight(0xffffff, 0, 16, 1.6); this.bossLight.position.set(0, -50, 0); scene.add(this.bossLight);
    this.budget = 1; // scales particle counts down under heavy load
  }
  n(k) { return Math.max(1, Math.round(k * this.budget)); }
  col(elem) { return (ELEM[elem] || ELEM.physical).c; }

  light(x, z, color, intensity, dur = 0.18, dist = 12) {
    let best = this.lights[0];
    for (const L of this.lights) if (L.t <= 0) { best = L; break; } else if (L.t < best.t) best = L;
    // above head height so flashes light the crowd rather than scorching the nearest creature white
    best.l.color.set(color); best.l.position.set(x, 4.5, z); best.l.distance = dist + 3; best.t = dur; best.max = dur; best.i0 = intensity * 2;
  }
  // Light energy budget: additive effects stack toward white, so beyond a few big
  // effects per frame (and per recent window) we switch to lean variants.
  heavy() { this.heat += 1; return this.heat > 7; }
  update(dt, time, pxScale) {
    this.heat = Math.max(0, (this.heat || 0) - dt * 30);
    this.add.update(dt, time, pxScale); this.smoke.update(dt, time, pxScale);
    this.rib.update(dt); this.decals.update(dt); this.glow.update(dt); this.tele.update(dt, time);
    for (const L of this.lights) {
      if (L.t > 0) { L.t -= dt; const k = Math.max(0, L.t / L.max); L.l.intensity = L.i0 * k * k; }
      else L.l.intensity = 0;
    }
  }
  clear() { this.add.clear(); this.smoke.clear(); this.rib.clear(); this.decals.clear(); this.glow.clear(); this.tele.clear(); }

  // ——— primitives ———
  burst(x, y, z, elem, count, speed, life, size, shape = 0, grav = 0, drag = 0.08, k = 1) {
    const c = this.col(elem); count = this.n(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.7), up = rand(0.2, 1) * speed * 0.6;
      this.add.spawn(x, y, z, Math.cos(a) * s, up, Math.sin(a) * s, life * rand(0.6, 1.2), size * rand(0.7, 1.3), size * 0.1, c[0] * k, c[1] * k, c[2] * k, 1, drag, grav, shape);
    }
  }
  sparks(x, y, z, elem, count, speed, dirx = 0, dirz = 0, spread = TAU, w = 0.07, len = 0.035) {
    const c = this.col(elem); count = this.n(count);
    const base = Math.atan2(dirz, dirx);
    for (let i = 0; i < count; i++) {
      const a = (dirx || dirz) ? base + (Math.random() - 0.5) * spread : Math.random() * TAU;
      const s = speed * rand(0.4, 1.1);
      this.rib.spark(x, y, z, Math.cos(a) * s, rand(1, 5), Math.sin(a) * s, rand(0.18, 0.42), w, len, c[0], c[1], c[2], 14, 0.05);
    }
  }
  ring(x, z, r, elem, life = 0.35, y = 0.3, a = 1) {
    const c = this.col(elem);
    this.add.spawn(x, y, z, 0, 0, 0, life, r * 0.3, r * 2.1, c[0] * 0.6, c[1] * 0.6, c[2] * 0.6, a, 1, 0, 3);
  }
  smokePuff(x, z, count, size, dark = 0.05, life = 1.2, rise = 1) {
    count = this.n(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, s = rand(0.3, 1.6);
      this.smoke.spawn(x + Math.cos(a) * 0.3, rand(0.2, 0.9), z + Math.sin(a) * 0.3, Math.cos(a) * s, rand(0.3, 1.2) * rise, Math.sin(a) * s,
        life * rand(0.7, 1.3), size * rand(0.6, 1), size * rand(1.6, 2.4), dark, dark * 0.9, dark * 1.1, 0.55, 0.3, 0, 2);
    }
  }

  // ——— composites ———
  hit(x, z, elem, dx, dz, crit) {
    const c = this.col(elem);
    this.heat += 0.06;
    if (this.heat > 7 && !crit) { if (Math.random() < 0.3) this.sparks(x, 0.9, z, elem, 1, 10, dx, dz, 1.6, 0.06); return; }
    this.add.spawn(x, 0.9, z, 0, 0, 0, 0.08, crit ? 1.6 : 0.9, crit ? 0.6 : 0.3, c[0] * 0.55, c[1] * 0.55, c[2] * 0.55, 1, 1, 0, 1);
    this.sparks(x, 0.9, z, elem, crit ? 9 : 4, crit ? 16 : 11, dx, dz, 1.6, crit ? 0.1 : 0.07);
  }
  explosion(x, z, r, elem, big = false) {
    const c = this.col(elem);
    if (!big && this.heavy()) { // saturated: a readable ring and a few embers, nothing more
      this.ring(x, z, r, elem, 0.28, 0.25, 0.45);
      this.burst(x, 0.6, z, elem, 4, r * 4, 0.4, 0.28, 5, 3, 0.05, 0.4);
      this.decals.add(x, z, r * 2.2, DECAL.SCORCH, 0.02, 0.015, 0.02, 0.5, 6);
      return;
    }
    this.add.spawn(x, 0.6, z, 0, 0, 0, 0.12, r * 1.5, r * 2.6, c[0] * 0.55, c[1] * 0.55, c[2] * 0.55, 1, 1, 0, 1);
    this.add.spawn(x, 0.6, z, 0, 0, 0, 0.06, r * 0.4, r * 0.7, 1.1, 0.95, 0.8, 1, 1, 0, 1);
    this.ring(x, z, r, elem, 0.32, 0.25, 0.7);
    this.burst(x, 0.6, z, elem, 10 + r * 4, r * 5.5, 0.5, 0.32, elem === 'ice' ? 4 : 5, 3, 0.05, 0.55);
    this.sparks(x, 0.5, z, elem, 10 + r * 3, r * 9);
    this.smokePuff(x, z, 4 + r * 2, r * 0.9, elem === 'holy' ? 0.3 : 0.04, 1.1);
    const cell = elem === 'ice' ? DECAL.FROST : elem === 'holy' ? DECAL.STAR : DECAL.SCORCH;
    if (elem === 'ice') this.glow.add(x, z, r * 2.2, cell, 0.3, 0.8, 1.4, 0.5, 2.5);
    else this.decals.add(x, z, r * 2.4, DECAL.SCORCH, 0.02, 0.015, 0.02, 0.65, 9);
    this.glow.add(x, z, r * 2.2, DECAL.SOFT, c[0] * 0.12, c[1] * 0.12, c[2] * 0.12, 1, 0.6);
    this.light(x, z, new THREE.Color(c[0] / 3, c[1] / 3, c[2] / 3), big ? 70 : 22, big ? 0.35 : 0.18, r * 5);
    if (big) { this.rr.shock(x, z, 1); this.rr.addTrauma(0.35); }
  }
  death(x, z, elem, size, bloodCol, big) {
    // Soul/ichor release: element-tinted wisps + generic gore cues.
    const c = this.col(elem);
    this.heat += 0.25; const hot = this.heat > 7;
    if (!hot) this.add.spawn(x, 0.8, z, 0, 0, 0, 0.1, size * 1.8, size * 0.4, c[0] * 0.6, c[1] * 0.6, c[2] * 0.6, 1, 1, 0, 1);
    for (let i = 0; i < this.n(big ? 22 : hot ? 3 : 8); i++) {
      const a = Math.random() * TAU, s = rand(1, 4.5) * (big ? 1.6 : 1);
      this.add.spawn(x, rand(0.4, 1.2) * size, z, Math.cos(a) * s, rand(1, 4), Math.sin(a) * s, rand(0.3, 0.7), rand(0.15, 0.32) * size, 0.02, c[0], c[1], c[2], 1, 0.1, 5, 5);
    }
    // gore chunks (dark, alpha system)
    for (let i = 0; i < this.n(big ? 14 : 5); i++) {
      const a = Math.random() * TAU, s = rand(2, 6);
      this.smoke.spawn(x, 0.8 * size, z, Math.cos(a) * s, rand(2, 6), Math.sin(a) * s, rand(0.5, 0.9), 0.28 * size, 0.18 * size, bloodCol[0], bloodCol[1], bloodCol[2], 1, 0.3, 18, 4);
    }
    this.decals.add(x, z, size * rand(1.6, 2.6), Math.random() < 0.5 ? DECAL.SPLAT : DECAL.SPATTER, bloodCol[0] * 0.45, bloodCol[1] * 0.45, bloodCol[2] * 0.45, 0.8, 22);
    // soul mote rising
    this.add.spawn(x, 1, z, 0, 2.2, 0, 0.9, 0.5 * size, 0.1, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 1, 0.5, -0.5, 0);
    if (big) { this.explosion(x, z, 1.6 * size, elem, true); }
  }
  trail(x, y, z, elem, size = 0.3, spread = 0.1) {
    const c = this.col(elem);
    this.add.spawn(x + rand(-spread, spread), y, z + rand(-spread, spread), rand(-0.4, 0.4), rand(0, 0.8), rand(-0.4, 0.4), rand(0.18, 0.35), size, size * 0.1, c[0], c[1], c[2], 0.9, 0.2, -1, 0);
  }
  flame(x, y, z, s = 1, col = null) {
    const c = col || ELEM.fire.c;
    this.add.spawn(x + rand(-0.1, 0.1) * s, y, z + rand(-0.1, 0.1) * s, rand(-0.2, 0.2), rand(1.2, 2.4) * s, rand(-0.2, 0.2), rand(0.25, 0.5), 0.5 * s, 0.05, c[0], c[1] * rand(0.8, 1.2), c[2], 0.85, 0.5, -1.2, 0);
    if (Math.random() < 0.2) this.add.spawn(x, y + 0.3, z, rand(-0.6, 0.6), rand(1.5, 3), rand(-0.6, 0.6), rand(0.6, 1.2), 0.09, 0.02, c[0], c[1], c[2], 1, 0.6, -0.4, 5);
  }
  shards(x, z, count, elem = 'ice', speed = 9) {
    const c = this.col(elem);
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * TAU, s = speed * rand(0.4, 1);
      this.add.spawn(x, 0.8, z, Math.cos(a) * s, rand(2, 7), Math.sin(a) * s, rand(0.4, 0.8), rand(0.25, 0.5), 0.1, c[0], c[1], c[2], 1, 0.4, 16, 4);
    }
    this.sparks(x, 0.8, z, elem, 8, 12);
  }
  pillar(x, z, elem, h = 8, w = 1.2, life = 0.5) {
    const c = this.col(elem);
    const k = this.heat > 7 ? 0.35 : 0.7;
    this.rib.seg1(x, 0, z, x, h, z, w, w * 0.2, c[0] * k, c[1] * k, c[2] * k, 1, life);
    this.rib.seg1(x, 0, z, x, h * 0.7, z, w * 2, 0.1, c[0] * 0.12, c[1] * 0.12, c[2] * 0.12, 1, life * 1.3);
  }
  skyBolt(x, z, elem = 'lightning') {
    const c = this.col(elem);
    this.rib.bolt(x + rand(-2, 2), 16, z - 6, x, 0.2, z, 0.35, c[0], c[1], c[2], 0.25, 1.2, 1);
    this.rib.bolt(x + rand(-2, 2), 16, z - 6, x, 0.2, z, 0.15, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, 0.2, 0.8, 0);
    this.explosion(x, z, 1.6, elem);
    this.decals.add(x, z, 2.5, DECAL.CRACK, 0.02, 0.02, 0.03, 0.8, 8);
  }
  groundCrack(x, z, s, col = [0.02, 0.015, 0.02]) { this.decals.add(x, z, s, DECAL.CRACK, col[0], col[1], col[2], 0.9, 10); }
  levelUp(x, z) {
    // a gilded column of rising sparks and the Hollow Eye opening under your feet — gold, never white
    const c = [1.5, 0.95, 0.35];
    this.rib.seg1(x, 0, z, x, 14, z, 1.6, 0.2, c[0] * 0.55, c[1] * 0.55, c[2] * 0.55, 1, 0.8);
    this.rib.seg1(x, 0, z, x, 9, z, 4, 0.1, c[0] * 0.1, c[1] * 0.1, c[2] * 0.1, 1, 1.0);
    this.add.spawn(x, 0.3, z, 0, 0, 0, 0.6, 1, 11, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0.9, 1, 0, 3);
    this.ring(x, z, 3, 'arcane', 0.5, 0.5, 0.6);
    this.glow.add(x, z, 7, DECAL.GLYPH, 0.7, 0.45, 0.15, 1, 1.6, 0, 2);
    for (let i = 0; i < this.n(56); i++) {
      const a = Math.random() * TAU, r = rand(0.5, 3);
      this.add.spawn(x + Math.cos(a) * r, rand(0, 1), z + Math.sin(a) * r, 0, rand(3, 9), 0, rand(0.6, 1.3), rand(0.1, 0.22), 0.02, c[0], c[1], c[2], 1, 0.5, 0, 4);
    }
    this.light(x, z, 0xffc070, 55, 0.8, 16);
  }
  pickup(x, y, z, col) {
    this.add.spawn(x, y, z, 0, 1.5, 0, 0.25, 0.9, 0.1, col[0], col[1], col[2], 1, 1, 0, 1);
  }
}
