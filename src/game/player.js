import * as THREE from 'three';
import { GeoBuilder, P as PR, makeMaterial } from '../render/materials.js';
import { Decals } from '../render/ground.js';
import { CHARACTERS, RELICS, META } from './data.js';
import { damp, rand, TAU, clamp, angleLerp } from '../core/util.js';

function buildModel(char) {
  const col = char.color;
  const b = new GeoBuilder();
  const CLOAK = 0x1d1822, ROBE = 0x2c2530, TRIM = 0xb99a62;
  b.add(PR.cone(0.62, 1.55, 9), CLOAK, { p: [0, 0.78, -0.02], shade: [0.55, 1.1, 0, 1.6] });
  b.add(PR.cyl(0.26, 0.4, 1.0, 8), ROBE, { p: [0, 0.95, 0.06] });
  b.add(PR.sph(0.42, 8, 6), 0x2a2330, { p: [0, 1.55, 0], s: [1.15, 0.7, 1] }); // mantle
  b.add(PR.tor(0.4, 0.035, 3, 16), TRIM, { p: [0, 1.52, 0.02], r: [Math.PI / 2, 0, 0] });
  b.add(PR.cone(0.34, 0.75, 8), CLOAK, { p: [0, 2.02, -0.05], r: [-0.18, 0, 0] }); // hood
  b.add(PR.sph(0.24, 7, 5), 0x050407, { p: [0, 1.84, 0.12] });
  for (const s of [-1, 1]) b.add(PR.sph(0.045, 4, 3), col, { p: [s * 0.08, 1.86, 0.33], glow: 2.6 });
  b.add(PR.box(0.1, 0.9, 0.04), TRIM, { p: [0, 1.0, 0.43], r: [-0.12, 0, 0] }); // stole
  b.add(PR.box(0.07, 0.5, 0.045), col, { p: [0, 1.02, 0.45], r: [-0.12, 0, 0], glow: 0.5 });
  // tome at the hip
  b.add(PR.box(0.3, 0.38, 0.12), 0x3a1d18, { p: [-0.42, 0.95, 0.1], r: [0, 0.3, 0.1] });
  b.add(PR.box(0.2, 0.05, 0.13), col, { p: [-0.42, 1.0, 0.11], r: [0, 0.3, 0.1], glow: 0.9 });
  return b.build();
}
function buildCenser(char) {
  const b = new GeoBuilder();
  b.add(PR.cyl(0.012, 0.012, 0.8, 3), 0x5a5048, { p: [0, -0.4, 0] });
  b.add(PR.oct(0.16), 0x3b3230, { p: [0, -0.85, 0] });
  b.add(PR.sph(0.09, 5, 4), char.color, { p: [0, -0.85, 0], glow: 3 });
  return b.build();
}

export class Player {
  constructor(G, charId, meta) {
    this.G = G; this.charId = charId; this.char = CHARACTERS[charId];
    this.x = 0; this.z = 6; this.vx = 0; this.vz = 0; this.fx = 0; this.fz = -1; this.r = 0.5;
    this.relics = new Map(); this.arcana = new Set();
    this.level = 1; this.xp = 0; this.need = this.xpNeed(1); this.pending = 0;
    this.iframes = 0; this.dashT = 0; this.dashCd = 0; this.dashMax = 1.6; this.dashDir = [0, -1];
    this.ult = 0; this.ultMax = 120; this.dead = false; this.hurtFlash = 0; this.t = 0;
    this.meta = meta;
    this.recompute(); this.hp = this.maxHp;
    // visuals
    const mat = makeMaterial({ rough: 0.8, rim: 0.7, rimColor: 0xc9b8ff, glowMul: 3 });
    this.mat = mat;
    this.mesh = new THREE.Group();
    this.body = new THREE.Mesh(buildModel(this.char), mat); this.body.castShadow = true;
    this.censer = new THREE.Mesh(buildCenser(this.char), mat); this.censer.position.set(0.5, 1.35, 0.15); this.censer.castShadow = true;
    this.mesh.add(this.body); this.mesh.add(this.censer);
    G.scene.add(this.mesh);
    // held high so creatures crowding the player are lit, not blown out (inverse-square near the head)
    this.light = new THREE.PointLight(new THREE.Color(this.char.color).lerp(new THREE.Color(0xffd0a0), 0.65), 110, 24, 1.4);
    G.scene.add(this.light);
    // ground seal under the player
    const atlas = Decals.atlas;
    const tex = atlas.clone(); tex.repeat.set(0.25, 0.25); tex.offset.set(0.75, 0.75); tex.needsUpdate = true;
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    this.seal = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, alphaMap: null, color: new THREE.Color(this.char.color).multiplyScalar(0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
    this.seal.renderOrder = 4; this.seal.scale.setScalar(3.2); G.scene.add(this.seal);
    const ag = new THREE.ConeGeometry(0.16, 0.42, 3); ag.rotateX(Math.PI / 2);
    this.arrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: new THREE.Color(this.char.color).multiplyScalar(1.4), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    G.scene.add(this.arrow);
  }
  dispose() { for (const o of [this.mesh, this.light, this.seal, this.arrow]) this.G.scene.remove(o); }
  // gentle early (a level every few seconds), steep past 20 so late levels stay meaningful
  xpNeed(L) { return Math.floor(4 + (L - 1) * 3.6 + Math.pow(L, 1.55) * 0.6 + Math.pow(Math.max(0, L - 18), 2.1) * 0.9); }
  relicLevel(id) { return this.relics.get(id) || 0; }

  recompute() {
    const c = this.char;
    const S = { might: 1, area: 1, haste: 0, speedP: 1, duration: 1, summon: 0, crit: 0.05, critMul: 2, maxHp: c.hp, regen: 0, armor: 0, moveSpd: 0, magnet: 0, growth: 1, greed: 1, luck: 0, status: 1, revive: 0, rerolls: 1, banish: 0 };
    const addStat = (st, k = 1) => { for (const key in st) S[key] += st[key] * k; };
    addStat(c.bonus || {});
    for (const m of META) { const r = (this.meta.meta || {})[m.id] || 0; if (r) addStat(m.stat, r); }
    for (const [id, lv] of this.relics) addStat(RELICS[id].stat, lv);
    if (this.arcana.has('glass')) { S.might += 0.55; S.maxHp *= 0.6; }
    if (this.arcana.has('avarice')) { S.growth += 0.6; S.greed += 0.6; }
    S.maxHp = Math.round(S.maxHp);
    this.S = S;
    this.speed = c.speed * (1 + S.moveSpd);
    this.magnetR = 3.2 * (1 + S.magnet);
    const old = this.maxHp || S.maxHp;
    this.maxHp = S.maxHp;
    if (this.hp !== undefined) this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - old));
    this.dashMax = this.arcana.has('umbral') ? 1.1 : 1.6;
  }

  update(dt, input, time) {
    const G = this.G, S = this.S;
    this.t += dt;
    if (this.dead) return;
    this.iframes = Math.max(0, this.iframes - dt); this.dashCd = Math.max(0, this.dashCd - dt); this.hurtFlash = Math.max(0, this.hurtFlash - dt * 5);
    if (S.regen) this.hp = clamp(this.hp + S.regen * dt, 1, this.maxHp);
    const mx = input.mx, mz = input.mz;
    if (mx || mz) { const l = Math.hypot(mx, mz); this.fx = mx / l; this.fz = mz / l; }
    // dash
    if (input.hit(' ', 'shift') && this.dashCd <= 0) {
      this.dashT = 0.2; this.dashCd = this.dashMax; this.iframes = Math.max(this.iframes, 0.28);
      this.dashDir = [this.fx, this.fz];
      G.audio.play('player_dash'); G.fx.smokePuff(this.x, this.z, 5, 0.8, 0.1, 0.7);
      if (this.arcana.has('umbral')) { G.weapons.zones.push({ kind: 'rift', x: this.x, z: this.z, t: 2.4, r: 3, dmg: 6 * (1 + G.time / 200), acc: 0 }); G.fx.explosion(this.x, this.z, 1.8, 'shadow'); }
    }
    if (input.hit('e', 'q', 'ult') && this.ult >= this.ultMax) { this.ult = 0; G.weapons.ultimate(this.char.ult.id); G.bus.emit('ultimate'); }
    let tvx, tvz;
    if (this.dashT > 0) {
      this.dashT -= dt; tvx = this.dashDir[0] * 21; tvz = this.dashDir[1] * 21;
      this.vx = tvx; this.vz = tvz;
      const c = this.char.color, col = new THREE.Color(c);
      for (let i = 0; i < 3; i++) G.fx.add.spawn(this.x + rand(-0.3, 0.3), rand(0.3, 1.8), this.z + rand(-0.3, 0.3), 0, 0.2, 0, 0.35, 0.5, 0.1, col.r * 1.5, col.g * 1.5, col.b * 1.5, 0.7, 0.3, 0, 0);
    } else {
      tvx = mx * this.speed; tvz = mz * this.speed;
      // crisp: fast acceleration, slightly softer stop
      const k = (mx || mz) ? 22 : 16;
      this.vx = damp(this.vx, tvx, k, dt); this.vz = damp(this.vz, tvz, k, dt);
    }
    this.x += this.vx * dt; this.z += this.vz * dt;
    G.world.resolve(this, this.r);
    // visuals
    const sp = Math.hypot(this.vx, this.vz);
    const yaw = Math.atan2(this.fx, this.fz);
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.t * 9)) * 0.06 * Math.min(1, sp / 4), this.z);
    this.mesh.rotation.y = angleLerp(this.mesh.rotation.y, yaw, Math.min(1, dt * 16));
    this.body.rotation.x = damp(this.body.rotation.x, Math.min(0.25, sp * 0.03), 10, dt);
    this.censer.rotation.x = Math.sin(this.t * 3.2) * 0.35 - this.body.rotation.x * 1.5; this.censer.rotation.z = Math.sin(this.t * 2.1) * 0.25;
    const flash = this.hurtFlash;
    this.mat.emissive.setRGB(flash * 2, flash * 0.3, flash * 0.3);
    this.body.visible = this.censer.visible = !(this.iframes > 0 && this.dashT <= 0 && Math.floor(this.t * 20) % 2 === 0);
    this.light.position.set(this.x, 7, this.z + 1.5);
    this.seal.position.set(this.x, 0.06, this.z); this.seal.rotation.y = time * 0.25;
    this.arrow.position.set(this.x + this.fx * 1.5, 0.12, this.z + this.fz * 1.5); this.arrow.rotation.y = Math.atan2(this.fx, this.fz);
    if (Math.random() < 0.3) { const cc = new THREE.Color(this.char.color); G.fx.add.spawn(this.x + 0.5, 0.5, this.z + 0.15, rand(-0.2, 0.2), rand(0.4, 1), rand(-0.2, 0.2), 0.8, 0.25, 0.05, cc.r * 2, cc.g * 2, cc.b * 2, 0.6, 0.5, -0.3, 0); }
    G.audio.setLowHealth(this.hp / this.maxHp < 0.3);
  }
  hurt(dmg, src) {
    if (this.iframes > 0 || this.dead || this.G.godMode) return;
    const G = this.G;
    const d = Math.max(1, dmg - this.S.armor);
    this.hp -= d; this.iframes = 0.5; this.hurtFlash = 1;
    G.run.damageTaken += d;
    G.rr.hurt = Math.min(1, G.rr.hurt + 0.45 + d / this.maxHp); G.rr.addTrauma(0.22 + d / this.maxHp); G.hitstop(0.045);
    G.floaters.add(this.x, 2.4, this.z, d, false, 'player');
    G.audio.play('player_hurt', { vol: 0.9 });
    G.fx.burst(this.x, 1.2, this.z, 'blood', 14, 5, 0.4, 0.25, 4, 14);
    if (src) { const dx = this.x - src.x, dz = this.z - src.z, l = Math.hypot(dx, dz) || 1; this.vx += (dx / l) * 9; this.vz += (dz / l) * 9; }
    // shove nearby foes back so a hit is a breather, not a death spiral
    G.enemies.inRadius(this.x, this.z, 2.5, (e) => { if (!e.boss) { const dx = e.x - this.x, dz = e.z - this.z, l = Math.hypot(dx, dz) || 1; e.kx += (dx / l) * 8; e.kz += (dz / l) * 8; } });
    if (this.hp <= 0) {
      if (this.S.revive > 0 && !this.revived) {
        this.revived = true; this.hp = this.maxHp * 0.5; this.iframes = 2.5;
        G.fx.levelUp(this.x, this.z); G.combat.area(this.x, this.z, 8, 80, 'holy', { knock: 16, src: 'ult' });
        G.bus.emit('toast', 'The Second Vigil', 'You refuse to stay dead.');
      } else { this.hp = 0; this.dead = true; G.bus.emit('playerDeath'); }
    }
  }
  heal(n, quiet) {
    if (this.dead) return;
    const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + n);
    if (!quiet && this.hp > before) { this.G.floaters.add(this.x, 2.4, this.z, this.hp - before, false, 'heal'); this.G.audio.play('heal'); this.G.fx.burst(this.x, 1, this.z, 'necro', 10, 2, 0.6, 0.3, 0, -1); }
  }
  gainXp(v) {
    this.xp += v * this.S.growth;
    while (this.xp >= this.need) { this.xp -= this.need; this.level++; this.need = this.xpNeed(this.level); this.pending++; }
  }
}
