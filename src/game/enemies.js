import * as THREE from 'three';
import { makeMaterial } from '../render/materials.js';
import { SpatialGrid } from '../core/spatial.js';
import { MODELS, ENEMIES } from './bestiary.js';
import { DECAL } from '../render/textures.js';
import { rand, TAU, clamp, angleLerp } from '../core/util.js';

const BURN_COL = [1.5, 0.45, 0.1]; // dimmer than weapon fire: crowds of burning foes must not bloom to white
const CAPS = { husk: 700, gnawer: 420, moth: 420, brute: 90, hexcaster: 140, worm: 60, bulwark: 140, bishop: 40, pustulant: 140, thrall: 80 };

// Instanced creature renderer shared by enemies and allied thralls.
export class CreatureRenderer {
  constructor(scene) {
    // glowMul is kept modest: eyes and boils must read as points of light, not bloom en masse
    this.mat = makeMaterial({ fx: true, rough: 0.72, rim: 0.34, rimColor: 0xd6ccff, glowMul: 1.7 });
    this.matMetal = makeMaterial({ fx: true, rough: 0.38, metal: 0.65, rim: 0.2, rimColor: 0xb8a8ff, glowMul: 1.7 });
    this.m = {};
    for (const k in MODELS) {
      const cap = CAPS[k] || 100;
      const geo = MODELS[k]();
      const fx = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
      const fx2 = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aFx', fx); geo.setAttribute('aFx2', fx2);
      const im = new THREE.InstancedMesh(geo, k === 'bulwark' ? this.matMetal : this.mat, cap);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true; im.receiveShadow = false; im.frustumCulled = false; im.count = 0;
      scene.add(im);
      this.m[k] = { im, fx, fx2, cap, n: 0 };
    }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  begin() { for (const k in this.m) this.m[k].n = 0; }
  push(model, x, y, z, yaw, lean, sx, sy, sz, f0, f1, f2, f3, g0, g1, g2) {
    const r = this.m[model]; if (!r || r.n >= r.cap) return;
    const i = r.n++;
    this._e.set(lean, yaw, 0); this._q.setFromEuler(this._e); this._p.set(x, y, z); this._s.set(sx, sy, sz);
    this._m.compose(this._p, this._q, this._s); r.im.setMatrixAt(i, this._m);
    r.fx.setXYZW(i, f0, f1, f2, f3); r.fx2.setXYZW(i, g0, g1, g2, 0);
  }
  end(time) {
    this.mat.userData.uniforms.uTime.value = time; this.matMetal.userData.uniforms.uTime.value = time;
    for (const k in this.m) {
      const r = this.m[k]; r.im.count = r.n;
      if (r.n) { r.im.instanceMatrix.needsUpdate = true; r.fx.needsUpdate = true; r.fx2.needsUpdate = true;
        r.im.instanceMatrix.clearUpdateRanges(); r.im.instanceMatrix.addUpdateRange(0, r.n * 16);
        r.fx.clearUpdateRanges(); r.fx.addUpdateRange(0, r.n * 4); r.fx2.clearUpdateRanges(); r.fx2.addUpdateRange(0, r.n * 4); }
    }
  }
}

export class Enemies {
  constructor(G) {
    this.G = G; this.list = []; this.pool = []; this.nextId = 1;
    this.grid = new SpatialGrid(128, 1.6, 4096); // small cells: crowd separation touches few non-neighbours
    this.shots = []; this.shotPool = [];
    this.bossList = [];
    // separation visitor, allocated once (hot path: runs for every walker every frame)
    this._sepFn = (o) => {
      const e = this._sepE;
      if (o === e || o.def.flying) return;
      const ox = e.x - o.x, oz = e.z - o.z, d2 = ox * ox + oz * oz, min = e.r + o.r;
      if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2), f = (min - d) / min; this._sx += (ox / d) * f; this._sz += (oz / d) * f; if (++this._sepN >= 7) return true; }
    };
  }
  spawn(type, x, z, o = {}) {
    const def = ENEMIES[type]; const R = this.G.run;
    const e = this.pool.pop() || {};
    const elite = !!o.elite;
    const hp = def.hp * R.enemyHpMul * (elite ? 9 : 1) * (o.hpMul || 1);
    Object.assign(e, {
      id: this.nextId++, def, type, x, z, vx: 0, vz: 0, kx: 0, kz: 0, hp, maxHp: hp,
      dmg: def.dmg * R.enemyDmgMul * (elite ? 1.5 : 1), speed: def.speed * (elite ? 0.9 : 1) * rand(0.92, 1.08),
      r: def.r * (elite ? 1.45 : 1), scale: elite ? 1.45 : 1, elite, face: rand(0, TAU), t: rand(0, 10), hitT: 0,
      state: 0, st: 0, cd: rand(1, 3), spawnT: 0, dying: 0, burnT: 0, burnDps: 0, burnAcc: 0, chill: 0, chillT: 0, freezeT: 0,
      curseT: 0, wetT: 0, bleedT: 0, hidden: false, alive: true, boss: null, sepX: 0, sepZ: 0, lean: 0, sq: 0, shieldA: 0, tele: null, lastElem: 'physical', ox: 0, oz: 0, noXp: !!o.noXp, flutter: rand(0, TAU),
    });
    if (def.role === 'burrow') { e.hidden = true; e.state = 0; e.st = rand(1, 2); }
    this.list.push(e);
    if (elite) this.G.bus.emit('eliteSpawn', e);
    return e;
  }
  // Bosses provide their own update/render; they live in the same list so every weapon and status applies.
  addBoss(b) { this.list.push(b); this.bossList.push(b); }
  remove(i) {
    const e = this.list[i]; e.alive = false;
    if (e.tele) { this.G.fx.tele.release(e.tele); e.tele = null; }
    this.list[i] = this.list[this.list.length - 1]; this.list.pop();
    if (e.boss) { const k = this.bossList.indexOf(e); if (k >= 0) this.bossList.splice(k, 1); }
    else this.pool.push(e);
  }
  clear() {
    for (const b of this.bossList) b.boss.dispose();
    for (let i = this.list.length - 1; i >= 0; i--) this.remove(i);
    this.shots.length = 0;
  }

  // ——— hostile projectiles ———
  shoot(x, z, vx, vz, dmg, o = {}) {
    const s = this.shotPool.pop() || {};
    Object.assign(s, { x, z, vx, vz, dmg, r: o.r || 0.4, life: o.life || 6, col: o.col || [1.8, 0.4, 3.2], y: o.y || 1.2, size: o.size || 1.1, curve: o.curve || 0, accel: o.accel || 0 });
    this.shots.push(s); this.G.audio.play('enemy_shoot', { vol: 0.5 });
    return s;
  }
  updateShots(dt) {
    const G = this.G, P = G.player, fx = G.fx;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      if (s.curve) { const c = Math.cos(s.curve * dt), si = Math.sin(s.curve * dt); const vx = s.vx * c - s.vz * si; s.vz = s.vx * si + s.vz * c; s.vx = vx; }
      if (s.accel) { s.vx *= 1 + s.accel * dt; s.vz *= 1 + s.accel * dt; }
      s.x += s.vx * dt; s.z += s.vz * dt;
      const dx = s.x - P.x, dz = s.z - P.z;
      let dead = s.life <= 0 || G.world.blocked(s.x, s.z, 0.1);
      if (!dead && dx * dx + dz * dz < (s.r + P.r) ** 2) { P.hurt(s.dmg, null); dead = true; }
      if (!dead && G.weapons.shieldCheck && G.weapons.shieldCheck(s)) dead = true;
      if (dead) { fx.burst(s.x, s.y, s.z, 'shadow', 6, 3, 0.3, 0.3); this.shots[i] = this.shots[this.shots.length - 1]; this.shots.pop(); this.shotPool.push(s); continue; }
      fx.add.spawn(s.x, s.y, s.z, 0, 0, 0, 0.05, s.size, s.size, s.col[0], s.col[1], s.col[2], 1, 1, 0, 1);
      fx.add.spawn(s.x, s.y, s.z, 0, 0, 0, 0.05, s.size * 0.45, s.size * 0.45, 2, 2, 2, 1, 1, 0, 1);
      if (Math.random() < 0.5) fx.add.spawn(s.x, s.y, s.z, rand(-0.5, 0.5), rand(-0.2, 0.4), rand(-0.5, 0.5), 0.35, s.size * 0.5, 0.05, s.col[0] * 0.6, s.col[1] * 0.6, s.col[2] * 0.6, 0.8, 0.4, 0, 0);
    }
  }

  // Inlined grid walk (no closures): the single hottest loop in the game at high density.
  separate(e) {
    const g = this.grid, n = g.n, cs = g.cell, h = g.half, r = e.r * 2, head = g.head, next = g.next, items = g.items;
    let x0 = ((e.x - r + h) / cs) | 0, x1 = ((e.x + r + h) / cs) | 0, z0 = ((e.z - r + h) / cs) | 0, z1 = ((e.z + r + h) / cs) | 0;
    if (x0 < 0) x0 = 0; if (z0 < 0) z0 = 0; if (x1 >= n) x1 = n - 1; if (z1 >= n) z1 = n - 1;
    let sx = 0, sz = 0, cnt = 0;
    outer: for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      let i = head[cz * n + cx];
      while (i !== -1) {
        const o = items[i]; i = next[i];
        if (o === e || o.def.flying) continue;
        const ox = e.x - o.x, oz = e.z - o.z, d2 = ox * ox + oz * oz, min = e.r + o.r;
        if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2), f = (min - d) / (min * d); sx += ox * f; sz += oz * f; if (++cnt >= 7) break outer; }
      }
    }
    const m = 6 / (e.def.mass || 1) ** 0.3;
    e.sepX = sx * m; e.sepZ = sz * m;
  }
  // Query helpers for weapons.
  nearest(x, z, maxR = 30, filter = null) {
    let best = null, bd = maxR * maxR;
    // expanding search for efficiency
    for (const rr of [6, 14, maxR]) {
      this.grid.query(x, z, rr, (e) => {
        const d = (e.x - x) ** 2 + (e.z - z) ** 2;
        if (d < bd && (!filter || filter(e))) { bd = d; best = e; }
      });
      if (best) return best;
      if (rr >= maxR) break;
    }
    return best;
  }
  inRadius(x, z, r, fn) {
    const r2 = r * r;
    this.grid.query(x, z, r + 1.5, (e) => { const d = (e.x - x) ** 2 + (e.z - z) ** 2; if (d < (r + e.r) * (r + e.r) || d < r2) fn(e, d); });
  }

  update(dt, time) {
    const G = this.G, P = G.player, fx = G.fx, W = G.world, R = G.run;
    this.grid.clear();
    for (const e of this.list) if (!e.dying && !e.hidden) this.grid.insert(e);
    const spdMulG = R.enemySpeedMul;
    this.frame = (this.frame | 0) + 1;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      // bosses run their own death sequence and flag dying = 100 when it is finished
      if (e.boss) { if (e.dying >= 100) this.remove(i); else e.boss.update(dt, time); continue; }
      if (e.dying) {
        e.dying += dt;
        if (e.dying > 0.4) this.remove(i);
        continue;
      }
      const def = e.def;
      e.t += dt; e.hitT = Math.max(0, e.hitT - dt * 12);
      if (e.spawnT < 0.6) e.spawnT += dt;
      // statuses
      if (e.burnT > 0) {
        e.burnT -= dt; e.burnAcc += dt;
        if (e.burnAcc >= 0.5) { e.burnAcc -= 0.5; G.combat.dot(e, e.burnDps * 0.5, 'fire'); if (!e.alive || e.dying) continue; }
        if (Math.random() < 0.22) fx.flame(e.x + rand(-0.3, 0.3), rand(0.3, def.height * e.scale * 0.8), e.z + rand(-0.3, 0.3), 0.6, BURN_COL);
      }
      if (e.bleedT > 0) { e.bleedT -= dt; if (Math.random() < 0.2) fx.smoke.spawn(e.x, 0.8, e.z, rand(-1, 1), 1, rand(-1, 1), 0.5, 0.2, 0.15, 0.25, 0.01, 0.02, 1, 0.4, 14, 4); }
      if (e.chillT > 0) { e.chillT -= dt; if (e.chillT <= 0) e.chill = 0; }
      if (e.freezeT > 0) e.freezeT -= dt;
      if (e.curseT > 0) { e.curseT -= dt; if (Math.random() < 0.08) fx.add.spawn(e.x + rand(-0.3, 0.3), def.height * e.scale, e.z, 0, rand(0.5, 1.2), 0, 0.8, 0.35, 0.05, 0.7, 0.15, 1.5, 0.9, 0.5, 0, 0); }
      if (e.wetT > 0) e.wetT -= dt;
      // environment: the drowned pools soak whoever wades through them (conducts lightning, douses fire)
      if (!def.flying && ((e.id + (this.frame | 0)) & 7) === 0 && W.inWater(e.x, e.z)) {
        e.wetT = 4; if (e.burnT > 0) { e.burnT = 0; fx.smokePuff(e.x, e.z, 3, 0.6, 0.35, 0.8); }
        if (Math.random() < 0.5) fx.add.spawn(e.x, 0.1, e.z, 0, 0, 0, 0.5, 0.2, 1.6, 0.3, 0.45, 0.7, 0.6, 1, 0, 3);
      }
      const frozen = e.freezeT > 0;
      const spd = e.speed * spdMulG * (frozen ? 0 : 1 - Math.min(0.6, e.chill * 0.12)) * (e.spawnT < 0.35 ? 0.2 : 1);
      const dx = P.x - e.x, dz = P.z - e.z, dist = Math.sqrt(dx * dx + dz * dz) || 0.001, nx = dx / dist, nz = dz / dist;
      let tx = nx, tz = nz, moveSpd = spd; // desired direction and speed
      // ——— behaviours ———
      if (!frozen) switch (def.role) {
        case 'lunge':
          e.cd -= dt;
          if (e.state === 0 && e.cd <= 0 && dist < 6.5) { e.state = 1; e.st = 0.42; e.ox = nx; e.oz = nz; }
          if (e.state === 1) { moveSpd = 0; e.st -= dt; e.sq = 0.18; tx = e.ox; tz = e.oz; if (e.st <= 0) { e.state = 2; e.st = 0.28; G.audio.play('scythe_swing', { vol: 0.25, pitch: 1.6 }); } }
          else if (e.state === 2) { moveSpd = 15; tx = e.ox; tz = e.oz; e.st -= dt; if (Math.random() < 0.6) fx.smoke.spawn(e.x, 0.2, e.z, 0, 0.5, 0, 0.5, 0.6, 1.2, 0.08, 0.06, 0.06, 0.4, 0.5, 0, 2); if (e.st <= 0) { e.state = 0; e.cd = rand(2.2, 3.4); } }
          break;
        case 'flutter': {
          const perp = Math.sin(e.t * 2.3 + e.flutter) * 0.9;
          tx = nx - nz * perp; tz = nz + nx * perp;
          break;
        }
        case 'slam':
          e.cd -= dt;
          if (e.state === 0 && e.cd <= 0 && dist < 4.2) { e.state = 1; e.st = 0.95; e.tele = fx.tele.circle(e.x + nx * 1.2, e.z + nz * 1.2, 3.2 * e.scale, 0.95, 0xff5a2a); G.audio.play('slam_warn'); e.ox = e.x + nx * 1.2; e.oz = e.z + nz * 1.2; }
          if (e.state === 1) {
            moveSpd = 0; e.st -= dt; e.sq = -0.12 * (1 - e.st);
            if (e.st <= 0) {
              e.state = 0; e.cd = rand(3.5, 5); e.tele = null; e.sq = 0.35;
              const R2 = 3.2 * e.scale; if ((P.x - e.ox) ** 2 + (P.z - e.oz) ** 2 < R2 * R2) P.hurt(e.dmg * 1.6, e);
              fx.explosion(e.ox, e.oz, 2.6 * e.scale, 'physical'); fx.groundCrack(e.ox, e.oz, 6 * e.scale); G.rr.addTrauma(0.25); G.audio.play('slam');
            }
          }
          break;
        case 'caster':
          e.cd -= dt;
          if (dist < 8) { tx = -nx; tz = -nz; } else if (dist < 12) { tx = -nz * 0.8; tz = nx * 0.8; moveSpd *= 0.6; }
          if (e.state === 0 && e.cd <= 0 && dist < 18) { e.state = 1; e.st = 0.5; }
          if (e.state === 1) { moveSpd = 0; e.st -= dt; e.hitT = Math.max(e.hitT, 0.25); if (e.st <= 0) { e.state = 0; e.cd = rand(2.6, 3.6); const sp = 6.2; this.shoot(e.x + nx, e.z + nz, nx * sp, nz * sp, e.dmg, { col: [1.6, 0.35, 3.2] }); if (e.elite) { for (const a of [-0.3, 0.3]) { const c = Math.cos(a), s = Math.sin(a); this.shoot(e.x, e.z, (nx * c - nz * s) * sp, (nx * s + nz * c) * sp, e.dmg, { col: [1.6, 0.35, 3.2] }); } } } }
          break;
        case 'burrow':
          e.st -= dt;
          if (e.state === 0) { // underground: fast, invisible, leaves a churned trail
            moveSpd = spd * 1.5; if (Math.random() < 0.7) { fx.smoke.spawn(e.x, 0.1, e.z, rand(-1, 1), rand(1, 2), rand(-1, 1), 0.8, 0.5, 1.4, 0.09, 0.07, 0.06, 0.6, 0.4, 3, 2); }
            if (Math.random() < 0.08) fx.decals.add(e.x, e.z, rand(0.8, 1.4), DECAL.CRACK, 0.02, 0.015, 0.015, 0.8, 4);
            if (dist < 2.6 && e.st <= 0) { e.state = 1; e.st = 0.85; e.tele = fx.tele.circle(e.x, e.z, 2.2, 0.85, 0xff4a2a); G.audio.play('worm_emerge', { vol: 0.7 }); }
          } else if (e.state === 1) { moveSpd = 0; e.st -= dt; if (Math.random() < 0.9) fx.smoke.spawn(e.x + rand(-1, 1), 0.1, e.z + rand(-1, 1), 0, rand(1, 3), 0, 0.6, 0.6, 1.2, 0.1, 0.08, 0.07, 0.7, 0.4, 2, 2);
            if (e.st <= 0) { e.state = 2; e.st = 3; e.hidden = false; e.spawnT = 0.3; e.tele = null; if ((P.x - e.x) ** 2 + (P.z - e.z) ** 2 < 2.2 * 2.2) P.hurt(e.dmg * 1.4, e); fx.explosion(e.x, e.z, 1.8, 'blood'); fx.groundCrack(e.x, e.z, 4); G.rr.addTrauma(0.15); } }
          else { moveSpd = spd * 0.3; if (e.st <= 0) { e.state = 0; e.st = rand(2.5, 4); e.hidden = true; fx.smokePuff(e.x, e.z, 6, 1, 0.08); } }
          break;
        case 'shield':
          e.shieldA = Math.atan2(nx, nz);
          break;
        case 'summoner':
          e.cd -= dt;
          if (dist < 11) { tx = -nx; tz = -nz; } else if (dist < 15) { moveSpd = 0; }
          if (e.state === 0 && e.cd <= 0 && dist < 22) { e.state = 1; e.st = 1.2; fx.glow.add(e.x, e.z, 5, DECAL.SIGIL, 0.08, 0.5, 0.25, 1, 1.4, 0, 1.5); }
          if (e.state === 1) { moveSpd = 0; e.st -= dt; if (Math.random() < 0.6) fx.trail(e.x + 0.6, 3.2, e.z, 'necro', 0.4, 0.3);
            if (e.st <= 0) { e.state = 0; e.cd = rand(5.5, 7); G.audio.play('necro_raise', { vol: 0.5, pitch: 0.7 });
              for (let k = 0; k < (e.elite ? 5 : 3); k++) { const a = rand(0, TAU); const s = this.spawn('husk', e.x + Math.cos(a) * 2.5, e.z + Math.sin(a) * 2.5, { noXp: true }); s.spawnT = 0; fx.pillar(s.x, s.z, 'necro', 3, 0.6, 0.4); } } }
          break;
        case 'bloat': break;
      }
      // steering + separation
      let vx = tx * moveSpd, vz = tz * moveSpd;
      // separation: each walker resolves on alternate frames (cached push in between) and stops
      // after a handful of overlaps — crowds of 600+ stay cheap without visibly clumping
      if (!def.flying && moveSpd > 0) {
        if (((e.id + this.frame) & 1) === 0) this.separate(e);
        vx += e.sepX || 0; vz += e.sepZ || 0;
      }
      e.x += (vx + e.kx) * dt; e.z += (vz + e.kz) * dt;
      // the player is solid: foes press against you in a ring instead of piling into one point
      if (!def.flying) {
        const px = e.x - P.x, pz = e.z - P.z, pd2 = px * px + pz * pz, pmin = e.r + P.r * 0.85;
        if (pd2 < pmin * pmin && pd2 > 1e-6) { const pd = Math.sqrt(pd2); e.x = P.x + (px / pd) * pmin; e.z = P.z + (pz / pd) * pmin; }
      }
      const kd = Math.exp(-9 * dt); e.kx *= kd; e.kz *= kd;
      if (!def.flying) W.resolve(e, e.r * 0.8);
      else { const d = Math.hypot(e.x, e.z); if (d > 96) { e.x *= 96 / d; e.z *= 96 / d; } }
      // facing & anim
      const sp = Math.sqrt(vx * vx + vz * vz);
      if (sp > 0.2) e.face = angleLerp(e.face, Math.atan2(vx, vz), Math.min(1, dt * 10));
      e.lean += ((Math.min(1, sp / 4) * 0.22) - e.lean) * Math.min(1, dt * 8);
      e.sq *= Math.exp(-dt * 10);
      // contact damage
      if (!e.hidden && e.spawnT > 0.3 && dist < e.r + P.r) P.hurt(e.dmg, e);
      // leash: recycle stragglers to ahead of the player
      if (dist > 58 && !e.elite) G.director.relocate(e);
    }
    this.updateShots(dt);
  }
  render(CR, time) {
    for (const e of this.list) {
      if (e.boss || e.hidden) continue;
      const def = e.def, s = e.scale;
      const fl = e.hitT;
      let y = (def.flying ? 1.4 : 0) + (def.hover || 0) + Math.abs(Math.sin(e.t * def.bobF)) * def.bob * s;
      let dis = 0, sx = s, sy = s, sz = s;
      if (e.spawnT < 0.6) { const k = e.spawnT / 0.6; y -= (1 - k) * 1.2; dis = Math.max(0, 1 - k * 1.3); }
      if (e.dying) { const k = e.dying / 0.4; dis = k; sy *= 1 - k * 0.3; sx *= 1 + k * 0.25; sz = sx; }
      const q = e.sq; sx *= 1 + q; sz *= 1 + q; sy *= 1 - q * 1.2;
      if (def.flying) { const f = 0.35 + 0.65 * Math.abs(Math.sin(e.t * 16 + e.flutter)); sx *= f; }
      if (e.freezeT > 0) { sx = sx; }
      const burn = e.burnT > 0 ? 1 : 0, frz = e.freezeT > 0 ? 1 : Math.min(0.5, e.chill * 0.1), cur = e.curseT > 0 ? 1 : 0;
      CR.push(def.model, e.x, y, e.z, e.face, e.freezeT > 0 ? 0 : e.lean, sx, sy, sz, fl + (e.dying ? 0.25 : 0), burn, frz, cur, e.elite ? 1 : 0, e.wetT > 0 ? 1 : 0, dis);
      if (e.elite && Math.random() < 0.3) this.G.fx.add.spawn(e.x + rand(-0.8, 0.8), rand(0.1, 2.5), e.z + rand(-0.8, 0.8), 0, 1.4, 0, 0.7, 0.18, 0.02, 2.6, 1.6, 0.4, 1, 0.5, 0, 5);
    }
  }
}
