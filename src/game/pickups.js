import * as THREE from 'three';
import { GeoBuilder, P, makeMaterial } from '../render/materials.js';
import { rand, TAU } from '../core/util.js';
import { DECAL } from '../render/textures.js';

// XP shards (4 tiers), tithe coins, sacraments, reliquary chests and rare relics.
const GEM_TIERS = [
  { max: 2, col: [0.22, 0.7, 1.05], s: 0.17, fx: [0.6, 1.4, 2.2] },
  { max: 9, col: [0.75, 0.3, 1.5], s: 0.24, fx: [1.4, 0.7, 2.8] },
  { max: 39, col: [1.5, 0.12, 0.22], s: 0.32, fx: [2.8, 0.3, 0.4] },
  { max: 1e9, col: [1.7, 1.1, 0.3], s: 0.45, fx: [3, 2, 0.7] },
];
const CAP = 900;

export class Pickups {
  constructor(G) {
    this.G = G; this.list = []; this.pool = []; this.combo = 0; this.comboT = 0; this.pullAll = 0;
    const gg = new THREE.OctahedronGeometry(1, 0); gg.scale(0.6, 1, 0.6);
    this.gemMeshes = GEM_TIERS.map((t) => {
      const m = new THREE.InstancedMesh(gg, new THREE.MeshBasicMaterial({ color: new THREE.Color(...t.col) }), CAP);
      m.frustumCulled = false; m.count = 0; G.scene.add(m); return m;
    });
    const cg = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 10); cg.rotateX(Math.PI / 2);
    this.coinMesh = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: 0xd9a84e, metalness: 1, roughness: 0.3, emissive: 0x6b4a10 }), 300);
    this.coinMesh.count = 0; this.coinMesh.frustumCulled = false; G.scene.add(this.coinMesh);
    // chest / sacrament / relic meshes (few, individual)
    const b = new GeoBuilder();
    b.add(P.box(1.2, 0.7, 0.8), 0x3b2418, { p: [0, 0.35, 0] }); b.add(P.box(1.26, 0.3, 0.86), 0x2a1a12, { p: [0, 0.82, 0] });
    b.add(P.box(1.3, 0.08, 0.9), 0xd9a84e, { p: [0, 0.68, 0], glow: 0.5 }); b.add(P.box(0.2, 0.28, 0.06), 0xd9a84e, { p: [0, 0.5, 0.42], glow: 1.3 });
    for (const s of [-1, 1]) b.add(P.box(0.08, 0.95, 0.9), 0xd9a84e, { p: [s * 0.55, 0.47, 0], glow: 0.3 });
    this.chestGeo = b.build(); this.chestMat = makeMaterial({ rough: 0.5, metal: 0.3, rim: 0.6, rimColor: 0xffc070 });
    const hb = new GeoBuilder(); hb.add(P.cyl(0.32, 0.32, 0.08, 12), 0xf0e6cc, { p: [0, 0, 0], r: [Math.PI / 2, 0, 0], glow: 0.4 }); hb.add(P.box(0.08, 0.36, 0.1), 0xff3552, { glow: 2 }); hb.add(P.box(0.24, 0.08, 0.1), 0xff3552, { p: [0, 0.06, 0], glow: 2 });
    this.healGeo = hb.build();
    const sb = new GeoBuilder(); sb.add(P.oct(0.35), 0x9fe6ff, { glow: 2 }); sb.add(P.tor(0.5, 0.04, 3, 16), 0xd9a84e, { glow: 1, r: [Math.PI / 2, 0, 0] });
    this.magnetGeo = sb.build();
    const cb = new GeoBuilder(); cb.add(P.oct(0.3), 0x2b2320, {}); cb.add(P.sph(0.18, 5, 4), 0xff7a38, { glow: 3 }); cb.add(P.cyl(0.02, 0.02, 0.8, 3), 0x8a7a6a, { p: [0, 0.5, 0] });
    this.censerGeo = cb.build();
    this.singles = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  _new(kind, x, z, v) {
    const p = this.pool.pop() || {};
    p.kind = kind; p.x = x; p.z = z; p.v = v; p.y = 0.5; p.t = rand(0, 5); p.state = 0; p.vx = rand(-2, 2); p.vz = rand(-2, 2); p.vy = rand(3, 6); p.spd = 0; p.mesh = null; p.glow = undefined;
    this.list.push(p); return p;
  }
  gem(x, z, v) {
    if (this.list.length > 850) this.consolidate();
    const p = this._new('gem', x, z, v); p.tier = GEM_TIERS.findIndex((t) => v <= t.max);
  }
  gold(x, z, v) { this._new('gold', x, z, v); }
  heal(x, z) { const p = this._new('heal', x, z, 30); this._single(p, this.healGeo); }
  chest(x, z) {
    const p = this._new('chest', x, z, 0); this._single(p, this.chestGeo); p.vy = 8;
    this.G.fx.pillar(x, z, 'holy', 12, 1.4, 1.2); this.G.bus.emit('chestDrop', p);
  }
  special(x, z, kind) { const p = this._new(kind, x, z, 0); this._single(p, kind === 'magnet' ? this.magnetGeo : this.censerGeo); }
  _single(p, geo) {
    // No per-pickup lights: changing the light count recompiles every material. A ground glow does the job.
    const m = new THREE.Mesh(geo, this.chestMat); m.castShadow = true; this.G.scene.add(m); p.mesh = m;
    const c = p.kind === 'chest' ? [0.5, 0.33, 0.1] : p.kind === 'heal' ? [0.45, 0.05, 0.1] : [0.12, 0.3, 0.45];
    p.glow = this.G.fx.glow.add(p.x, p.z, p.kind === 'chest' ? 4 : 2.4, DECAL.SOFT, c[0], c[1], c[2], 1, 1e9, 0, 0, 0.03, 0.3);
  }
  consolidate() {
    const P = this.G.player; let sum = 0, host = null;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.kind !== 'gem' || p.state) continue;
      if ((p.x - P.x) ** 2 + (p.z - P.z) ** 2 < 900) continue;
      if (!host) { host = p; continue; }
      sum += p.v; this.list[i] = this.list[this.list.length - 1]; this.list.pop(); this.pool.push(p);
      if (sum > 400) break;
    }
    if (host) { host.v += sum; host.tier = GEM_TIERS.findIndex((t) => host.v <= t.max); }
  }
  pullAllGems() { this.pullAll = 2.5; }
  update(dt, time) {
    const G = this.G, Pl = G.player, fx = G.fx;
    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    if (this.pullAll > 0) this.pullAll -= dt;
    const mR = Pl.magnetR;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]; p.t += dt;
      // pop-out arc on spawn
      if (p.vy !== 0 || p.y > 0.5) { p.vy -= 22 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.vx *= 0.9; p.vz *= 0.9; if (p.y <= 0.5) { p.y = 0.5; p.vy = 0; } }
      const dx = Pl.x - p.x, dz = Pl.z - p.z, d = Math.hypot(dx, dz);
      const grabbable = p.kind === 'gem' || p.kind === 'gold' || (d < 1.6);
      if (!p.state && grabbable && (d < mR || (this.pullAll > 0 && p.kind === 'gem'))) { p.state = 1; p.spd = -4; }
      if (p.state) {
        // brief recoil away, then an accelerating snap into the player
        p.spd += 58 * dt;
        const nx = dx / (d || 1), nz = dz / (d || 1), step = p.spd * dt;
        p.x += nx * step; p.z += nz * step;
        if (d < 0.8 || (step > d && p.spd > 0)) { this.collect(p); this.list[i] = this.list[this.list.length - 1]; this.list.pop(); this.pool.push(p); continue; }
      }
      if (p.mesh) {
        p.mesh.position.set(p.x, (p.kind === 'chest' ? 0 : p.y + 0.4) + Math.sin(p.t * 2.5) * 0.12, p.z);
        p.mesh.rotation.y = p.t * (p.kind === 'chest' ? 0.4 : 1.5);
        if (p.kind === 'chest' && Math.random() < 0.3) fx.add.spawn(p.x + rand(-0.8, 0.8), 0.2, p.z + rand(-0.6, 0.6), 0, rand(1, 3), 0, 0.9, 0.18, 0.02, 3, 2.1, 0.6, 1, 0.6, 0, 5);
      }
    }
  }
  collect(p) {
    const G = this.G, Pl = G.player, fx = G.fx;
    switch (p.kind) {
      case 'gem': {
        Pl.gainXp(p.v); this.combo++; this.comboT = 0.6;
        const t = GEM_TIERS[p.tier]; fx.pickup(Pl.x, 1.2, Pl.z, t.fx);
        G.audio.play('xp_pickup', { vol: 0.35, pitch: 1 + Math.min(this.combo, 30) * 0.035 });
        break;
      }
      case 'gold': G.run.gold += Math.round(p.v * Pl.S.greed * G.run.goldMul); fx.pickup(Pl.x, 1.2, Pl.z, [3, 2.2, 0.6]); G.audio.play('gold_pickup', { vol: 0.5 }); break;
      case 'heal': Pl.heal(p.v); break;
      case 'chest': G.bus.emit('chestOpen'); break;
      case 'magnet': this.pullAllGems(); fx.ring(Pl.x, Pl.z, 30, 'ice', 0.8); G.audio.play('shrine_activate'); G.bus.emit('toast', 'Lodestar', 'Every shard answers the call.'); break;
      case 'censer': {
        G.audio.play('ultimate'); G.rr.flash = 0.6; G.rr.addTrauma(0.5); G.rr.shock(Pl.x, Pl.z, 1.5);
        G.enemies.inRadius(Pl.x, Pl.z, 30, (e) => { if (!e.boss) G.combat.damage(e, e.maxHp * 2, 'holy', { quiet: true, src: 'censer' }); });
        G.bus.emit('toast', 'Censer of Wrath', 'The air itself is sanctified.');
        break;
      }
    }
    if (p.mesh) { this.G.scene.remove(p.mesh); p.mesh = null; }
    if (p.glow !== undefined) { this.G.fx.glow.kill(p.glow); p.glow = undefined; }
  }
  render(time) {
    const counts = [0, 0, 0, 0]; let coins = 0;
    const m = this._m, q = this._q, e = this._e, pos = this._p, s = this._s;
    for (const p of this.list) {
      if (p.kind === 'gem') {
        const tier = p.tier, mesh = this.gemMeshes[tier]; if (counts[tier] >= CAP) continue;
        e.set(0, time * 2 + p.t, 0); q.setFromEuler(e); pos.set(p.x, p.y + 0.15 * Math.sin(p.t * 3), p.z); s.setScalar(GEM_TIERS[tier].s * (tier === 3 ? 1 + Math.min(1, p.v / 400) : 1));
        m.compose(pos, q, s); mesh.setMatrixAt(counts[tier]++, m);
      } else if (p.kind === 'gold' && coins < 300) {
        e.set(0, time * 4 + p.t, 0); q.setFromEuler(e); pos.set(p.x, p.y + 0.2, p.z); s.setScalar(1);
        m.compose(pos, q, s); this.coinMesh.setMatrixAt(coins++, m);
      }
    }
    this.gemMeshes.forEach((mesh, i) => { mesh.count = counts[i]; mesh.instanceMatrix.needsUpdate = true; });
    this.coinMesh.count = coins; this.coinMesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (const p of this.list) { if (p.mesh) this.G.scene.remove(p.mesh); p.mesh = null; p.glow = undefined; } this.list.length = 0; }
}
