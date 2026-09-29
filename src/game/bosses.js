import * as THREE from 'three';
import { GeoBuilder, P, makeMaterial } from '../render/materials.js';
import { DECAL } from '../render/textures.js';
import { rand, TAU, clamp, angleLerp, pick } from '../core/util.js';

// ——— Sculpts ———
function collectorModel() {
  const b = new GeoBuilder(); const F = 0x6a5446, R = 0x2a2226, G = 0xd9a84e;
  for (const s of [-1, 1]) b.add(P.cyl(0.5, 0.6, 1.8, 7), F, { p: [s * 0.9, 0.9, 0] });
  b.add(P.sph(1.9, 9, 7), R, { p: [0, 3.2, -0.2], s: [1.2, 1.05, 1], shade: [0.5, 1.05, 1.5, 5] });
  b.add(P.cone(1.3, 2.2, 8), R, { p: [0, 5.0, 0.4], r: [0.7, 0, 0] });
  b.add(P.sph(0.6, 7, 5), 0x08060a, { p: [0, 4.3, 1.5] });
  b.add(P.box(1.0, 0.12, 0.1), G, { p: [0, 4.35, 2.0], glow: 1.2 }); // coin-slot mouth
  for (let i = 0; i < 5; i++) b.add(P.cyl(0.15, 0.15, 0.04, 8), G, { p: [-0.9 + i * 0.45, 2.4 + (i % 2) * 0.3, 1.8], r: [1.2, 0, 0], glow: 0.6 });
  for (const s of [-1, 1]) { b.add(P.cyl(0.45, 0.55, 2.8, 7), F, { p: [s * 2.2, 2.6, 0.8], r: [0.6, 0, s * 0.3] }); b.add(P.sph(0.7, 6, 5), F, { p: [s * 2.6, 1.3, 1.9] }); }
  // great censer on its back
  b.add(P.oct(1.1), 0x2b2a2e, { p: [0, 3.6, -2.4] }); b.add(P.sph(0.6, 6, 5), 0xff7a38, { p: [0, 3.6, -2.4], glow: 2.5 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; b.add(P.cone(0.08, 0.6, 3), 0xe8dcc0, { p: [Math.cos(a) * 1.4, 5.3 + Math.sin(i) * 0.2, -1.2 + Math.sin(a) * 0.6] }); b.add(P.cone(0.06, 0.18, 3), 0xffa04a, { p: [Math.cos(a) * 1.4, 5.7 + Math.sin(i) * 0.2, -1.2 + Math.sin(a) * 0.6], glow: 2.5 }); }
  return b.build();
}
function bellModel() {
  const b = new GeoBuilder(); const B = 0x2a2124, V = 0xb070ff;
  b.add(P.cyl(1.4, 3.6, 4.4, 14, true), 0x4a3a2c, { p: [0, 2.2, 0], shade: [0.35, 0.8, 0, 4.4] });
  b.add(P.cyl(1.35, 3.5, 4.3, 14, true), 0x0b0709, { p: [0, 2.15, 0], s: [-1, 1, 1] }); // dark interior
  for (let i = 0; i < 5; i++) b.add(P.box(0.06, 2.2 - i * 0.2, 0.05), V, { p: [Math.cos(i * 1.3) * 2.7, 1.6, Math.sin(i * 1.3) * 2.7], r: [0, -i * 1.3, 0.3 + i * 0.1], glow: 1.4 }); // cracks
  b.add(P.tor(3.55, 0.2, 4, 24), 0x5a4a44, { p: [0, 0.05, 0], r: [Math.PI / 2, 0, 0] });
  b.add(P.sph(1.4, 10, 5), 0x3b2d24, { p: [0, 4.3, 0], s: [1, 0.5, 1] });
  b.add(P.tor(0.6, 0.18, 4, 12), 0x2b2a2e, { p: [0, 5.0, 0] });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; b.add(P.box(0.05, 1.2, 0.02), V, { p: [Math.cos(a) * 2.55, 2.2, Math.sin(a) * 2.55], r: [0, -a, 0.35], glow: 0.9 }); }
  b.add(P.cyl(0.08, 0.08, 3.2, 4), 0x2b2a2e, { p: [0, 2.4, 0] });
  b.add(P.sph(0.65, 8, 6), V, { p: [0, 0.6, 0], glow: 2.6 }); // clapper — the heart
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; b.add(P.cone(0.45, 2.6 + (i % 3) * 0.8, 3), 0x151018, { p: [Math.cos(a) * 3.3, -1.1 - (i % 3) * 0.4, Math.sin(a) * 3.3], r: [Math.PI, 0, 0] }); }
  return b.build();
}
function matronModel() {
  const b = new GeoBuilder();
  b.add(P.sph(2.6, 10, 8), 0x5e5c38, { p: [0, 2.4, -0.4], s: [1.1, 0.9, 1.3], shade: [0.6, 1.05, 0, 4] });
  for (let i = 0; i < 16; i++) { const a = i * 2.39, y = 1.2 + (i % 4) * 0.8; b.add(P.sph(0.35 + (i % 3) * 0.12, 6, 5), 0xc4ff5a, { p: [Math.cos(a) * 2.5, y, Math.sin(a) * 2.8 - 0.4], glow: 1.1 }); }
  b.add(P.sph(1.2, 8, 6), 0x7a6a52, { p: [0, 3.2, 2.2] });
  b.add(P.cyl(0.8, 0.6, 0.2, 10), 0xff3030, { p: [0, 3.2, 3.3], r: [1.4, 0, 0], glow: 1.6 });
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; b.add(P.cone(0.1, 0.5, 3), 0xd6cbb0, { p: [Math.cos(a) * 0.75, 3.2 + Math.sin(a) * 0.75, 3.3], r: [1.4, 0, -a] }); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; const g = P.cyl(0.12, 0.35, 3.4, 5); g.translate(0, 1.7, 0); b.add(g, 0x8a7a64, { p: [Math.cos(a) * 2.2, 0.8, Math.sin(a) * 2.2], r: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1] }); }
  return b.build();
}
function saintModel() {
  const b = new GeoBuilder(); const S = 0x6b635a, SD = 0x3e3934, G = 0xd9a84e, MASK = 0xcfc3a6;
  // robe: layered, weathered, with a torn hem that flares at the ground
  b.add(P.cone(3.3, 7.6, 12), SD, { p: [0, 3.8, 0], shade: [0.35, 1.0, 0, 8], jitter: 0.12 });
  b.add(P.cone(2.7, 6.2, 12), S, { p: [0, 4.4, 0.25], shade: [0.45, 1.05, 1, 8], jitter: 0.1 });
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; b.add(P.cone(0.35, 1.6 + (i % 3) * 0.5, 3), SD, { p: [Math.cos(a) * 3.1, 0.5, Math.sin(a) * 3.1], r: [Math.sin(a) * 2.6, 0, -Math.cos(a) * 2.6] }); }
  b.add(P.sph(2.0, 10, 7), S, { p: [0, 7.4, 0], s: [1.15, 0.8, 1] });
  b.add(P.cone(1.55, 3.4, 10), SD, { p: [0, 9.35, 0.25], r: [0.18, 0, 0] });
  // cracked porcelain mask with a hollow where the face was
  b.add(P.sph(0.9, 8, 6), MASK, { p: [0, 8.75, 1.05], s: [0.9, 1.1, 0.55] });
  b.add(P.sph(0.55, 7, 5), 0x020103, { p: [0, 8.7, 1.4], s: [0.8, 1.2, 0.5] });
  b.add(P.sph(0.12, 5, 4), 0xfff0c0, { p: [0, 8.72, 1.62], glow: 3.5 }); // a single pinprick of light
  for (let i = 0; i < 4; i++) b.add(P.box(0.03, 0.5, 0.03), 0xff3552, { p: [-0.25 + i * 0.17, 8.25 - (i % 2) * 0.1, 1.5], glow: 0.9 }); // weeping
  // arms raised in benediction, hands trailing chains
  for (const s of [-1, 1]) {
    b.add(P.cyl(0.5, 0.7, 4, 8), S, { p: [s * 2.3, 6.4, 1.1], r: [0.8, 0, s * -0.75] });
    b.add(P.box(0.8, 0.3, 1.2), MASK, { p: [s * 3.4, 4.9, 2.6], r: [0.2, 0, s * 0.4] });
    for (let k = 0; k < 6; k++) b.add(P.tor(0.18, 0.05, 3, 6), 0x3a3634, { p: [s * 3.5, 4.4 - k * 0.42, 2.7], r: [k % 2 ? Math.PI / 2 : 0, 0, 0] });
  }
  // the halo itself: a heavy gilt ring behind the head, studded with the sockets the blades came from
  b.add(P.tor(3.0, 0.16, 5, 36), G, { p: [0, 9.2, -1.2], glow: 0.55 });
  b.add(P.tor(2.6, 0.06, 3, 36), G, { p: [0, 9.2, -1.2], glow: 0.9 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; b.add(P.oct(0.2), G, { p: [Math.cos(a) * 3.0, 9.2 + Math.sin(a) * 3.0, -1.1], glow: 0.7 }); }
  for (let i = 0; i < 5; i++) b.add(P.box(0.08, 3.5, 0.02), G, { p: [-1 + i * 0.5, 3.8, 2.8 - i * 0.02], r: [-0.4, 0, 0], glow: 0.35 });
  return b.build();
}

// ——— Base boss ———
class Boss {
  constructor(G, cfg) {
    this.G = G; this.cfg = cfg; this.name = cfg.name; this.epithet = cfg.epithet; this.id = cfg.id;
    const P = G.player; const a = rand(0, TAU);
    // scale with the build the player actually brought, so a boss is always a real fight
    const lvl = Math.min(2.2, 0.75 + 0.03 * G.player.level + 0.08 * G.player.arcana.size);
    const hp = cfg.hp * lvl * (G.run.vows.iron ? 1.5 : 1) * (G.player.arcana.has('avarice') ? 1.3 : 1);
    this.e = { boss: this, alive: true, dying: 0, hidden: false, x: P.x + Math.cos(a) * 12, z: P.z + Math.sin(a) * 12, r: cfg.r, hp, maxHp: hp, scale: 1, def: { height: cfg.height, soul: cfg.soul, knockRes: 1, role: 'boss', blood: [0.1, 0.01, 0.02], mass: 50 },
      burnT: 0, burnDps: 0, burnAcc: 0, chill: 0, chillT: 0, freezeT: 0, curseT: 0, wetT: 0, bleedT: 0, kx: 0, kz: 0, hitT: 0, sq: 0, id: -Math.random(), elite: false, shieldA: 0, t: 0 };
    G.world.resolve(this.e, cfg.r);
    this.mat = makeMaterial({ rough: 0.7, metal: cfg.metal || 0.1, rim: 0.28, rimColor: cfg.rim || 0xb0a0ff, glowMul: 3.2 });
    this.mesh = new THREE.Mesh(cfg.model(), this.mat); this.mesh.castShadow = true; G.scene.add(this.mesh);
    this.light = G.fx.bossLight; this.light.color.set(cfg.light || 0xb070ff); this.light.intensity = 28;
    this.intro = 2.4; this.invuln = true; this.phase = 0; this.t = 0; this.face = 0; this.atk = null; this.atkCd = 2.5; this.noFreeze = true; this.armor = 1;
    this.phases = cfg.phases || [];
    // arena seal
    G.arena = { x: P.x, z: P.z, r: cfg.arena || 24 };
    this.seals = [G.fx.glow.add(P.x, P.z, G.arena.r * 2.06, DECAL.RING, 0.9, 0.22, 0.08, 0.8, 1e9, 0, 0, 0.03, 1.2)];
    G.enemies.addBoss(this.e);
    G.bus.emit('bossSpawn', this);
    G.fx.pillar(this.e.x, this.e.z, cfg.soul, 20, 4, 1.6);
    G.rr.addTrauma(0.6); G.rr.distTarget = 42;
  }
  get x() { return this.e.x; } get z() { return this.e.z; }
  pdist() { const P = this.G.player; return Math.hypot(P.x - this.e.x, P.z - this.e.z); }
  pdir() { const P = this.G.player; const dx = P.x - this.e.x, dz = P.z - this.e.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l, l]; }
  update(dt, time) {
    const G = this.G, e = this.e, P = G.player;
    this.t += dt; e.t += dt; e.hitT = Math.max(0, e.hitT - dt * 6);
    // statuses (bosses resist freeze but burn, curse and drench normally)
    if (e.burnT > 0) { e.burnT -= dt; e.burnAcc += dt; if (e.burnAcc >= 0.5) { e.burnAcc -= 0.5; G.combat.dot(e, e.burnDps * 0.5, 'fire'); } if (Math.random() < 0.5) G.fx.flame(e.x + rand(-2, 2), rand(1, 4), e.z + rand(-2, 2), 1); }
    if (e.curseT > 0) e.curseT -= dt; if (e.wetT > 0) e.wetT -= dt; if (e.freezeT > 0) e.freezeT -= dt; if (e.chillT > 0) { e.chillT -= dt; if (e.chillT <= 0) e.chill = 0; }
    if (e.dying) { this.deathTick(dt); return; }
    if (this.intro > 0) {
      this.intro -= dt; const k = 1 - Math.max(0, this.intro / 2.4);
      this.hover = -4 * (1 - k); if (Math.random() < 0.8) G.fx.smokePuff(e.x + rand(-3, 3), e.z + rand(-3, 3), 1, 2.5, 0.05, 1.5);
      if (this.intro <= 0) { this.invuln = false; G.audio.play('bell_toll'); G.rr.addTrauma(0.4); G.fx.explosion(e.x, e.z, 5, this.cfg.soul, true); }
    } else {
      // phase transitions
      const frac = e.hp / e.maxHp;
      while (this.phase < this.phases.length && frac <= this.phases[this.phase]) {
        this.phase++; this.onPhase(this.phase);
        G.bus.emit('bossPhase', this); G.hitstop(0.2); G.rr.addTrauma(0.6); G.rr.shock(e.x, e.z, 1.6); G.rr.flash = 0.3;
        G.fx.explosion(e.x, e.z, 6, this.cfg.soul, true);
      }
      this.think(dt, time);
    }
    const chillSlow = 1 - Math.min(0.4, e.chill * 0.06);
    e.x += (this.vx || 0) * dt * chillSlow + e.kx * dt; e.z += (this.vz || 0) * dt * chillSlow + e.kz * dt; e.kx *= 0.9; e.kz *= 0.9;
    if (!this.cfg.flying) G.world.resolve(e, e.r * 0.7);
    const A = G.arena; if (A) { const dx = e.x - A.x, dz = e.z - A.z, d = Math.hypot(dx, dz); if (d > A.r - 2) { e.x = A.x + dx / d * (A.r - 2); e.z = A.z + dz / d * (A.r - 2); } }
    // contact
    if (!this.invuln && this.pdist() < e.r + P.r) P.hurt(this.cfg.contact, e);
    this.render(dt, time);
  }
  render(dt, time) {
    const e = this.e;
    const hov = (this.hover || 0) + (this.cfg.flying ? 2.2 + Math.sin(time * 1.3) * 0.4 : 0);
    this.mesh.position.set(e.x, hov + (this.lift || 0), e.z);
    const [dx, dz] = this.pdir();
    if (!this.lockFace) this.face = angleLerp(this.face, Math.atan2(dx, dz), Math.min(1, dt * (this.turn || 2.5)));
    this.mesh.rotation.y = this.face + (this.spin || 0);
    // bosses are hit constantly, so the flash is a short, dim pulse rather than a sustained glow
    const f = Math.min(1, e.hitT) * 0.07;
    this.mat.emissive.setRGB(f + (e.burnT > 0 ? 0.05 : 0) + (e.curseT > 0 ? 0.04 : 0), f * 0.8 + (e.burnT > 0 ? 0.015 : 0), f * 0.7 + (e.curseT > 0 ? 0.09 : 0));
    const sq = this.squash || 0; this.mesh.scale.set(1 + sq, 1 - sq, 1 + sq); this.squash = sq * Math.exp(-dt * 8);
    this.light.position.set(e.x, 1.2, e.z + this.e.r + 1.5);
    // arena wall flames
    const A = this.G.arena;
    if (A) for (let i = 0; i < 3; i++) { const a = rand(0, TAU); this.G.fx.flame(A.x + Math.cos(a) * A.r, 0.1, A.z + Math.sin(a) * A.r, 1.1, this.cfg.wall || [3, 0.8, 0.2]); }
  }
  onPhase() {}
  // Removes everything this boss put into the world (used on death and when a run is torn down mid-fight).
  dispose() {
    const G = this.G;
    G.scene.remove(this.mesh); this.light.intensity = 0; this.light.position.set(0, -50, 0);
    this.mesh.geometry.dispose(); this.mat.dispose();
    if (this.atk && this.atk.tele) G.fx.tele.release(this.atk.tele);
    for (const w of this.waves || []) G.fx.tele.release(w.h);
    this.waves = []; this.atk = null;
    for (const i of this.seals) G.fx.glow.kill(i);
    if (G.arena) G.arena = null;
  }
  think() {}
  die() {
    const G = this.G; this.invuln = true; this.e.dying = 0.001; this.deathT = 0;
    G.audio.play('boss_death'); G.slowmo(0.25, 1.8); G.rr.distTarget = 30; this.waves = []; this.atk = null; G.fx.tele.clear();
    G.bus.emit('bossDying', this);
  }
  deathTick(dt) {
    const G = this.G, e = this.e;
    this.deathT += dt / Math.max(0.2, G.timeScale);
    this.squash = Math.sin(this.deathT * 30) * 0.03;
    if (Math.random() < 0.35) { G.fx.explosion(e.x + rand(-3, 3), e.z + rand(-3, 3), rand(1.5, 3), this.cfg.soul); G.rr.addTrauma(0.2); }
    this.lift = (this.lift || 0) + dt * 0.5;
    this.render(dt, G.time);
    if (this.deathT > 2.2 && !this.finished) {
      this.finished = true;
      G.fx.explosion(e.x, e.z, 9, this.cfg.soul, true); G.fx.pillar(e.x, e.z, 'holy', 30, 6, 2); G.rr.flash = 1; G.rr.addTrauma(1);
      G.fx.shards(e.x, e.z, 80, this.cfg.soul, 16);
      G.fx.decals.add(e.x, e.z, 14, DECAL.SCORCH, 0.02, 0.01, 0.02, 0.9, 1e9);
      this.dispose(); G.rr.distTarget = 34;
      for (let i = 0; i < this.cfg.chests; i++) G.pickups.chest(e.x + rand(-2, 2), e.z + rand(-2, 2));
      for (let i = 0; i < 24; i++) G.pickups.gold(e.x + rand(-4, 4), e.z + rand(-4, 4), 5);
      G.pickups.gem(e.x, e.z, this.cfg.xp);
      if (!G.run.vows.famine) for (let i = 0; i < 2; i++) G.pickups.heal(e.x + rand(-3, 3), e.z + rand(-3, 3));
      e.dying = 100;
      G.bus.emit('bossDeath', this);
    }
  }
  // helpers
  ringWave(speed, gaps, gapW, thick = 0.9, maxR = 30, dmg) {
    const G = this.G, x = this.e.x, z = this.e.z;
    const gapA = [], base = rand(0, TAU);
    for (let i = 0; i < gaps; i++) gapA.push(base + (i / gaps) * TAU);
    const h = G.fx.tele.ring(x, z, maxR, 0xb070ff);
    const w = { x, z, r: 0.5, speed, gapA, gapW, thick, maxR, dmg, h, hit: false };
    (this.waves || (this.waves = [])).push(w);
    G.audio.play('bell_toll', { vol: 0.8 });
  }
  updateWaves(dt) {
    if (!this.waves) return;
    const G = this.G, P = G.player;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]; w.r += w.speed * dt;
      if (w.h) { const u = w.h.mesh.material.uniforms; u.uP.value.set(w.r / w.maxR, w.thick / w.maxR, w.gapA[0], w.gapW); if (w.gapA.length > 1) u.uP.value.z = w.gapA[0]; }
      const d = Math.hypot(P.x - w.x, P.z - w.z);
      if (!w.hit && Math.abs(d - w.r) < w.thick * 0.6 + P.r) {
        const a = Math.atan2(P.z - w.z, P.x - w.x);
        const inGap = w.gapA.some((g) => Math.abs(((a - g + Math.PI * 3) % TAU) - Math.PI) < w.gapW);
        if (!inGap) { w.hit = true; P.hurt(w.dmg, null); }
      }
      if (Math.random() < 0.9) { const a = rand(0, TAU); const inGap = w.gapA.some((g) => Math.abs(((a - g + Math.PI * 3) % TAU) - Math.PI) < w.gapW); if (!inGap) G.fx.add.spawn(w.x + Math.cos(a) * w.r, 0.4, w.z + Math.sin(a) * w.r, Math.cos(a) * 2, 1, Math.sin(a) * 2, 0.4, 0.8, 0.1, 1.5, 0.35, 2.8, 1, 0.5, 0, 0); }
      if (w.r > w.maxR) { G.fx.tele.release(w.h); this.waves.splice(i, 1); }
    }
  }
  radial(n, speed, dmg, off = 0, col) { const G = this.G; for (let i = 0; i < n; i++) { const a = off + (i / n) * TAU; G.enemies.shoot(this.e.x + Math.cos(a) * 2, this.e.z + Math.sin(a) * 2, Math.cos(a) * speed, Math.sin(a) * speed, dmg, { col, size: 1.3, r: 0.5, life: 7 }); } }
}

// ——— The Tithe-Collector (mini-boss) ———
class Collector extends Boss {
  constructor(G) {
    super(G, { id: 'collector', name: 'The Tithe-Collector', epithet: 'Who Counts the Coins of the Dead', model: collectorModel, hp: 2000, r: 2.4, height: 6, soul: 'fire', contact: 11, light: 0xff8a3a, chests: 1, xp: 120, phases: [0.5], arena: 24, rim: 0xffb070, wall: [3, 1, 0.2] });
    this.turn = 2;
  }
  think(dt) {
    const G = this.G, e = this.e, [nx, nz, d] = this.pdir();
    this.atkCd -= dt;
    if (!this.atk) {
      this.vx = nx * 2.6; this.vz = nz * 2.6;
      if (this.atkCd <= 0) {
        const r = Math.random();
        if (d > 7 && r < 0.6) this.atk = { k: 'charge', t: 0, dx: nx, dz: nz, tele: G.fx.tele.rect(e.x, e.z, Math.atan2(nz, nx), 20, 3.6, 1.0, 0xff5a2a) };
        else if (this.phase >= 1 && r < 0.5) this.atk = { k: 'coins', t: 0, n: 0 };
        else this.atk = { k: 'swing', t: 0, tele: G.fx.tele.circle(e.x, e.z, 6, 1.15, 0xff5a2a) };
        G.audio.play('boss_attack_warn');
      }
    } else {
      const a = this.atk; a.t += dt; this.vx = 0; this.vz = 0;
      if (a.k === 'charge') {
        this.lockFace = true; this.face = Math.atan2(a.dx, a.dz);
        if (a.t < 1.0) { this.squash = -0.06; if (a.tele) { a.tele.mesh.position.set(e.x, 0.05, e.z); } }
        else if (a.t < 1.9) { this.vx = a.dx * 24; this.vz = a.dz * 24; G.fx.smokePuff(e.x, e.z, 2, 1.5, 0.1, 0.8); if (Math.random() < 0.5) G.fx.flame(e.x, 1, e.z, 2); }
        else { this.lockFace = false; this.atk = null; this.atkCd = rand(1.8, 2.6); G.fx.explosion(e.x, e.z, 3, 'fire'); G.fx.groundCrack(e.x, e.z, 7); G.rr.addTrauma(0.3); G.audio.play('slam'); G.combat.delayedBlast(e.x, e.z, 3.5, 0.5, 11, 'fire', { decal: false }); }
      } else if (a.k === 'swing') {
        if (a.t >= 1.15 && !a.done) {
          a.done = true; this.spin = 0; this.squash = 0.2;
          if (this.pdist() < 6 + this.G.player.r) this.G.player.hurt(16, e);
          G.fx.explosion(e.x, e.z, 6, 'fire', true); G.fx.rib.arc(e.x, 1.5, e.z, 5, 0, TAU, 1.6, 1.8, 0.55, 0.12, 0.35, 28);
          if (this.phase >= 1) for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU; G.combat.delayedBlast(e.x + Math.cos(ang) * 8, e.z + Math.sin(ang) * 8, 2.4, 0.8 + i * 0.1, 10, 'fire'); }
          G.audio.play('slam');
        }
        if (a.t > 1.6) { this.atk = null; this.atkCd = rand(1.8, 2.8); }
      } else if (a.k === 'coins') {
        if (a.t > 0.45 * a.n && a.n < 2) { a.n++; this.radial(12, 6, 8, a.n * 0.26, [1.8, 1.25, 0.3]); G.audio.play('gold_pickup', { pitch: 0.5 }); }
        if (a.t > 1.4) { this.atk = null; this.atkCd = rand(1.8, 2.8); }
      }
    }
  }
}

// ——— The Bellwraith ———
class Bellwraith extends Boss {
  constructor(G) {
    super(G, { id: 'bellwraith', name: 'The Bellwraith', epithet: 'Last Toll of the Drowned Nave', model: bellModel, hp: 6500, r: 3.3, height: 6, soul: 'shadow', contact: 14, light: 0xb070ff, chests: 2, xp: 400, phases: [0.5], arena: 26, flying: true, rim: 0xc0a0ff, wall: [1.6, 0.4, 3] });
    this.turn = 0.8; this.summonT = 8;
  }
  onPhase() { this.G.bus.emit('toast', 'The bell cracks', 'Darkness pours out of it.'); this.G.scene.fog.density *= 1.35; }
  think(dt, time) {
    const G = this.G, e = this.e, [nx, nz, d] = this.pdir(); const p2 = this.phase >= 1;
    this.updateWaves(dt);
    this.spin = Math.sin(time * 0.7) * 0.2;
    this.summonT -= dt;
    if (this.summonT <= 0) { this.summonT = p2 ? 9 : 13; for (let i = 0; i < (p2 ? 8 : 6); i++) { const a = rand(0, TAU); G.enemies.spawn('moth', e.x + Math.cos(a) * 5, e.z + Math.sin(a) * 5, { noXp: false }); } }
    this.atkCd -= dt;
    if (!this.atk) {
      this.vx = nx * (d > 6 ? 2.2 : -1); this.vz = nz * (d > 6 ? 2.2 : -1);
      if (this.atkCd <= 0) {
        const opts = ['toll', 'spiral', p2 ? 'blink' : 'toll'];
        const k = pick(opts);
        this.atk = { k, t: 0, n: 0 };
        if (k === 'toll') { G.audio.play('boss_attack_warn'); }
        if (k === 'blink') { this.atk.tx = G.player.x + rand(-2, 2); this.atk.tz = G.player.z + rand(-2, 2); this.atk.tele = G.fx.tele.circle(this.atk.tx, this.atk.tz, 4.5, 1.2, 0xb070ff); }
      }
    } else {
      const a = this.atk; a.t += dt; this.vx = this.vz = 0;
      if (a.k === 'toll') {
        this.lift = Math.min(2.5, a.t * 3) * (a.t < 0.9 ? 1 : 0);
        const waves = p2 ? 3 : 2;
        if (a.t > 0.9 + a.n * (p2 ? 0.8 : 1.1) && a.n < waves) { a.n++; this.lift = 0; this.squash = 0.25; G.rr.addTrauma(0.35); G.rr.shock(e.x, e.z, 1.2); this.ringWave(p2 ? 10.5 : 8.5, 1, p2 ? 0.55 : 0.72, 0.9, 30, 14); G.fx.explosion(e.x, e.z, 4, 'shadow'); }
        if (a.n >= waves && a.t > 3.6) { this.atk = null; this.atkCd = rand(1.4, 2.4); }
      } else if (a.k === 'spiral') {
        const arms = p2 ? 5 : 3;
        if (a.t > a.n * 0.16 && a.t < 3) { a.n++; for (let i = 0; i < arms; i++) { const ang = a.n * 0.27 + (i / arms) * TAU; G.enemies.shoot(e.x + Math.cos(ang) * 3, e.z + Math.sin(ang) * 3, Math.cos(ang) * 6, Math.sin(ang) * 6, 8, { col: [1.2, 0.28, 2.4], size: 1.1, r: 0.42, life: 6 }); } }
        if (a.t > 3.4) { this.atk = null; this.atkCd = rand(1.5, 2.5); }
      } else if (a.k === 'blink') {
        const k = Math.min(1, a.t / 1.2); this.mesh.visible = !(k > 0.2 && k < 0.95);
        if (k > 0.5 && !a.moved) { a.moved = true; e.x = a.tx; e.z = a.tz; }
        if (a.t >= 1.2 && !a.done) { a.done = true; this.mesh.visible = true; this.squash = 0.35; if (Math.hypot(G.player.x - a.tx, G.player.z - a.tz) < 4.5) G.player.hurt(18, e); G.fx.explosion(a.tx, a.tz, 4.5, 'shadow', true); G.fx.groundCrack(a.tx, a.tz, 9); G.audio.play('bell_toll'); this.ringWave(9.5, 1, 0.65, 0.8, 22, 12); }
        if (a.t > 2.2) { this.atk = null; this.atkCd = rand(1.5, 2.2); }
      }
    }
  }
}

// ——— The Brood-Matron (mini-boss) ———
class Matron extends Boss {
  constructor(G) {
    super(G, { id: 'matron', name: 'The Brood-Matron', epithet: 'Mother of Everything Beneath', model: matronModel, hp: 5200, r: 3, height: 5, soul: 'necro', contact: 16, light: 0x9dff6a, chests: 1, xp: 300, phases: [0.5], arena: 24, rim: 0xc4ff5a, wall: [0.8, 2.6, 0.5] });
    this.turn = 1.2; this.broodT = 4;
  }
  think(dt) {
    const G = this.G, e = this.e, [nx, nz, d] = this.pdir(); const p2 = this.phase >= 1;
    this.vx = nx * 1.6; this.vz = nz * 1.6;
    this.broodT -= dt;
    if (this.broodT <= 0) { this.broodT = p2 ? 6 : 8; for (let i = 0; i < (p2 ? 3 : 2); i++) { const a = rand(0, TAU); G.enemies.spawn(i % 2 ? 'pustulant' : 'worm', e.x + Math.cos(a) * 4, e.z + Math.sin(a) * 4); } G.audio.play('worm_emerge'); this.squash = 0.2; }
    this.atkCd -= dt;
    if (this.atkCd <= 0) {
      this.atkCd = p2 ? 1.8 : 2.6; this.squash = -0.15; G.audio.play('boss_attack_warn', { vol: 0.5 });
      const P = G.player, n = p2 ? 5 : 3;
      for (let i = 0; i < n; i++) { const lead = i * 0.5; G.combat.delayedBlast(P.x + P.vx * lead + rand(-2, 2), P.z + P.vz * lead + rand(-2, 2), 2.6, 0.9 + i * 0.18, 16, 'necro', { col: 0x9dff6a, sfx: 'slam' }); }
      if (p2) this.radial(10, 5.5, 10, rand(0, 1), [0.8, 2.6, 0.5]);
    }
  }
}

// ——— The Hollow Saint (final) ———
class Saint extends Boss {
  constructor(G) {
    super(G, { id: 'saint', name: 'The Hollow Saint', epithet: 'She Who Knelt Nine Hundred Years', model: saintModel, hp: 20000, r: 3.4, height: 10, soul: 'holy', contact: 20, light: 0xffe0a0, chests: 3, xp: 1000, phases: [0.66, 0.33], arena: 28, rim: 0xffe0a0, wall: [3, 2.3, 1] });
    this.turn = 0.9; this.haloA = 0;
    this.blades = []; // orbiting halo blades (visual + hazard in phase 3)
  }
  onPhase(p) {
    const G = this.G;
    if (p === 1) G.bus.emit('toast', 'She rises', 'The halo turns to blades.');
    if (p === 2) { G.bus.emit('toast', 'She weeps', 'The sky bleeds for her.'); G.rr.U.uTint.value.setRGB(1.08, 0.9, 0.9); for (let i = 0; i < 3; i++) { const a = rand(0, TAU); G.enemies.spawn(pick(['brute', 'bulwark', 'bishop']), this.e.x + Math.cos(a) * 8, this.e.z + Math.sin(a) * 8, { elite: true }); } }
  }
  think(dt, time) {
    const G = this.G, e = this.e, P = G.player, [nx, nz, d] = this.pdir();
    this.updateWaves(dt);
    this.haloA += dt * (0.6 + this.phase * 0.4);
    // halo blades visual
    const nB = 12, R = 5 + (this.phase >= 2 ? 3 + Math.sin(time * 1.2) * 3 : 0);
    for (let i = 0; i < nB; i++) {
      const a = this.haloA + (i / nB) * TAU, bx = e.x + Math.cos(a) * R, bz = e.z + Math.sin(a) * R;
      G.fx.add.spawn(bx, 3.5, bz, 0, 0, 0, 0.04, 0.9, 0.9, 1.5, 1.0, 0.35, 1, 1, 0, 4);
      G.fx.add.spawn(bx, 3.5, bz, 0, 0, 0, 0.04, 0.3, 0.3, 1.6, 1.4, 1.0, 1, 1, 0, 1);
      if (this.phase >= 2 && (P.x - bx) ** 2 + (P.z - bz) ** 2 < 1.4) P.hurt(18, null);
    }
    if (this.phase >= 1 && Math.random() < (this.phase >= 2 ? 0.05 : 0.02)) { const A = G.arena; const a = rand(0, TAU), r = rand(0, A.r - 2); G.combat.delayedBlast(A.x + Math.cos(a) * r, A.z + Math.sin(a) * r, 1.8, 1.1, 12, 'blood', { col: 0xff2440 }); }
    this.atkCd -= dt;
    if (!this.atk) {
      this.vx = nx * (d > 9 ? 2 : 0); this.vz = nz * (d > 9 ? 2 : 0);
      if (this.atkCd <= 0) {
        const opts = ['blades', 'pillars'];
        if (this.phase >= 1) opts.push('beam', 'beam');
        if (this.phase >= 2) opts.push('toll');
        this.atk = { k: pick(opts), t: 0, n: 0 };
        G.audio.play('boss_attack_warn');
        if (this.atk.k === 'beam') { this.atk.ang = Math.atan2(nz, nx) - 1.2; this.atk.tele = G.fx.tele.rect(e.x, e.z, this.atk.ang, 30, 2.6, 0, 0xffd080); }
      }
    } else {
      const a = this.atk; a.t += dt; this.vx = this.vz = 0;
      if (a.k === 'blades') {
        const waves = 3 + this.phase;
        if (a.t > a.n * 0.55 && a.n < waves) { a.n++; this.radial(12 + this.phase * 4, 7 + this.phase, 14, this.haloA + a.n * 0.13, [3, 2.3, 1]); G.audio.play('holy_pulse', { pitch: 0.6 }); }
        if (a.t > waves * 0.55 + 0.6) { this.atk = null; this.atkCd = rand(1.2, 2); }
      } else if (a.k === 'pillars') {
        const n = 5 + this.phase * 2;
        if (a.t > a.n * 0.2 && a.n < n) { a.n++; const lead = 0.6; const x = P.x + P.vx * lead + rand(-1.5, 1.5), z = P.z + P.vz * lead + rand(-1.5, 1.5); G.combat.delayedBlast(x, z, 2.2, 1.0, 18, 'holy', { col: 0xffd080, sfx: 'lightning', onBlast: (h) => G.fx.pillar(h.x, h.z, 'holy', 16, 1.6, 0.5) }); }
        if (a.t > n * 0.2 + 1.2) { this.atk = null; this.atkCd = rand(1.2, 2); }
      } else if (a.k === 'beam') {
        const warm = 1.0, dur = 4.2; const spd = this.phase >= 2 ? 0.75 : 0.55;
        if (a.t > warm) a.ang += spd * dt;
        if (a.tele) { a.tele.mesh.position.set(e.x, 0.06, e.z); a.tele.mesh.rotation.y = -a.ang;
          const u = a.tele.mesh.material.uniforms; u.uProg.value = Math.min(1, a.t / warm); u.uAlpha.value = a.t > warm ? 1.6 : 0.8; }
        if (a.t > warm) {
          const ex = e.x + Math.cos(a.ang) * 30, ez = e.z + Math.sin(a.ang) * 30;
          G.fx.rib.quad(e.x, 4, e.z, ex, 0.5, ez, 2.2, 1.2, 3, 2.4, 1.1, 1); G.fx.rib.quad(e.x, 4, e.z, ex, 0.5, ez, 0.8, 0.5, 3, 3, 3, 1);
          if (Math.random() < 0.7) { const k = Math.random() * 30; G.fx.sparks(e.x + Math.cos(a.ang) * k, 0.3, e.z + Math.sin(a.ang) * k, 'holy', 2, 6); }
          // distance from player to beam segment
          const px = P.x - e.x, pz = P.z - e.z, ca = Math.cos(a.ang), sa = Math.sin(a.ang), along = px * ca + pz * sa, perp = Math.abs(-px * sa + pz * ca);
          if (along > 0 && along < 30 && perp < 1.3 + P.r * 0.5) P.hurt(24, null);
        }
        if (a.t > warm + dur) { G.fx.tele.release(a.tele); this.atk = null; this.atkCd = rand(1.2, 2); }
      } else if (a.k === 'toll') {
        if (a.t > a.n * 0.9 && a.n < 3) { a.n++; this.ringWave(12, 1, 0.5, 1, 32, 22); this.squash = 0.2; G.rr.addTrauma(0.3); }
        if (a.t > 3.2) { this.atk = null; this.atkCd = rand(1, 1.8); }
      }
    }
  }
}

export const BOSSES = { collector: Collector, bellwraith: Bellwraith, matron: Matron, saint: Saint };
export function spawnBoss(G, id) { return new BOSSES[id](G); }
