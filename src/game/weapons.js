import * as THREE from 'three';
import { rand, TAU, clamp, pick, chance } from '../core/util.js';
import { DECAL } from '../render/textures.js';
import { ELEM } from './data.js';

const L = (arr, l) => arr[Math.min(arr.length - 1, l - 1)];

// ——— Weapon catalogue ———
// Each weapon is a gameplay verb with its own rhythm; levels change numbers AND shape.
export const WEAPONS = {
  ember: {
    name: 'Ember Litany', elem: 'fire', icon: 'flame', max: 7,
    desc: 'Lobs psalm-fire at the nearest foes. Bursts on landing and sets them <b>burning</b>.',
    lore: 'Each flame is one line of a hymn nobody remembers.',
    ups: ['+1 bolt', '+Damage, +area', '+1 bolt', '+Burn, faster', '+1 bolt', '+Damage, +area'],
    evo: { relic: 'tallow', name: 'Pyre Psalm', desc: 'Two more bolts; each leaves a <b>burning pyre</b> on the ground.' },
    stats: (l, e) => ({ n: L([1, 2, 2, 3, 3, 4, 4], l) + (e ? 2 : 0), dmg: 10 + 3 * l + (e ? 8 : 0), r: 1.5 + 0.12 * l + (e ? 0.4 : 0), cd: 1.4 - 0.05 * l, burn: 3 + 1.2 * l }),
  },
  rime: {
    name: 'Rime Lance', elem: 'ice', icon: 'shard', max: 7,
    desc: 'Hurls piercing lances at the nearest foe. Hits <b>chill</b>; five chills <b>freeze</b>.',
    lore: 'Ysolde\'s grief, sharpened.',
    ups: ['+1 lance', '+Pierce, +damage', '+1 lance', 'Chills twice', '+1 lance', '+Damage, faster'],
    evo: { relic: 'reliquary', name: 'Glacial Requiem', desc: 'Lances fly faster and <b>detonate frozen foes</b> into seeking shards.' },
    stats: (l, e) => ({ n: L([1, 2, 2, 3, 3, 4, 4], l), dmg: 13 + 4 * l + (e ? 10 : 0), pierce: 2 + l + (e ? 99 : 0), spd: e ? 34 : 24, cd: 1.35 - 0.05 * l, chill: l >= 4 ? 2 : 1 }),
  },
  tempest: {
    name: 'Tempest Rosary', elem: 'lightning', icon: 'bolt', max: 7,
    desc: 'Lightning leaps from you to a foe, then <b>chains</b>. Drenched and cursed foes conduct further.',
    lore: 'Pray on the beads. Something above will answer.',
    ups: ['+1 chain', '+Damage', '+1 strike', '+1 chain, faster', '+Damage', '+1 strike, +1 chain'],
    evo: { relic: 'stormbead', name: 'Heaven\'s Sentence', desc: 'Also calls <b>sky-bolts</b> that drench everything they strike.' },
    stats: (l, e) => ({ chains: L([2, 3, 3, 3, 4, 4, 5], l), strikes: L([1, 1, 1, 2, 2, 2, 3], l), dmg: 13 + 4 * l + (e ? 8 : 0), range: 5.8, cd: 1.9 - 0.08 * l, sky: e ? 3 : 0 }),
  },
  orrery: {
    name: 'Orrery of Knives', elem: 'arcane', icon: 'orbit', max: 7, kinetic: true,
    desc: 'Arcane blades wheel around you, cutting anything that comes close.',
    lore: 'A model of the heavens, if the heavens were knives.',
    ups: ['+1 blade', '+Radius', '+1 blade', '+Damage, faster', '+1 blade', '+1 blade, +damage'],
    evo: { relic: 'astrolabe', name: 'Celestial Orrery', desc: 'Eight blades breathe in and out, <b>firing darts</b> at nearby foes.' },
    stats: (l, e) => ({ n: e ? 8 : L([2, 3, 3, 4, 4, 5, 6], l), dmg: 6 + 2.2 * l + (e ? 6 : 0), rad: 2.7 + 0.15 * l, spin: 3 + 0.2 * l, hitCd: 0.42 }),
  },
  choir: {
    name: 'Grave Choir', elem: 'necro', icon: 'skull', max: 7,
    desc: 'Sings the dead up to fight for you. Slain foes may <b>rise as thralls</b>.',
    lore: 'Every graveyard is an audience.',
    ups: ['+1 thrall', '+Damage', '+1 thrall', 'Raise more often', '+1 thrall, +damage', '+1 thrall'],
    evo: { relic: 'bonecrown', name: 'Legion Eternal', desc: 'Double the choir. Thralls <b>burst in grave-fire</b> when they fall.' },
    stats: (l, e) => ({ max: L([4, 4, 5, 5, 6, 7, 8], l) * (e ? 2 : 1), dmg: 13 + 3.5 * l + (e ? 8 : 0), cd: Math.max(0.9, 2.2 - 0.18 * l), raise: 0.1 + 0.025 * l, life: 22 }),
  },
  scythe: {
    name: 'Hollow Scythe', elem: 'shadow', icon: 'scythe', max: 7, kinetic: true,
    desc: 'Reaps in a wide crescent where you face. Hits <b>curse</b> (+25% damage taken).',
    lore: 'It cuts the thread between a body and its name.',
    ups: ['+Arc, +damage', '+Radius', 'Reaps back and forth', '+Damage, faster', '+Arc, +radius', '+Damage'],
    evo: { relic: 'mirror', name: 'Eclipse Reaper', desc: 'A full circle of night. Kills tear <b>rifts</b> that drag foes in.' },
    stats: (l, e) => ({ dmg: 17 + 5 * l + (e ? 12 : 0), rad: 3.3 + 0.2 * l + (e ? 1 : 0), arc: e ? TAU : (2.2 + 0.12 * l), cd: 1.5 - 0.06 * l, twice: l >= 4 && !e, curse: 3 }),
  },
  thorns: {
    name: 'Sanguine Thorns', elem: 'blood', icon: 'thorn', max: 7, kinetic: true,
    desc: 'Blood spikes erupt beneath foes. <b>Stronger the more you bleed</b>; kills may heal.',
    lore: 'Sister Vael gives freely. The ground gives back.',
    ups: ['+1 spike', '+Damage', '+1 spike', '+Radius, faster', '+1 spike', '+2 spikes'],
    evo: { relic: 'heart', name: 'Martyr\'s Crown', desc: 'A <b>crown of thorns</b> erupts around you with every cast.' },
    stats: (l, e) => ({ n: L([2, 3, 3, 4, 4, 5, 7], l), dmg: 15 + 5 * l + (e ? 10 : 0), r: 1.3 + (l >= 4 ? 0.3 : 0), cd: 1.6 - 0.07 * l, range: 9, ring: e }),
  },
  halo: {
    name: 'Sanctus Halo', elem: 'holy', icon: 'halo', max: 7,
    desc: 'A pulsing ring of light that <b>repels</b> foes and <b>burns away</b> hostile spells.',
    lore: 'It does not protect you. It simply cannot stand them.',
    ups: ['+Radius', '+Damage', 'Pulses faster', '+Radius, +damage', 'Pulses faster', '+Radius'],
    evo: { relic: 'tithe', name: 'Seraph\'s Tithe', desc: 'A vast halo that <b>sets foes alight</b> and mends you in a crowd.' },
    stats: (l, e) => ({ rad: 2.4 + 0.25 * l + (e ? 1.6 : 0), dmg: 5 + 2 * l + (e ? 6 : 0), cd: 1.0 - 0.05 * l, knock: 7 }),
  },
  hex: {
    name: 'Witchmark', elem: 'shadow', icon: 'eye', max: 7,
    desc: 'Brands the thickest crowd with a sigil that detonates and <b>curses</b> all within.',
    lore: 'It finds where they are most afraid, and stands there.',
    ups: ['+Radius', '+1 mark', '+Damage', 'Faster', '+1 mark, +radius', '+Damage'],
    evo: { relic: 'witcheye', name: 'Black Sabbath', desc: 'Marks leave a <b>lingering hex</b> that keeps cursing and gnawing.' },
    stats: (l, e) => ({ n: L([1, 1, 2, 2, 2, 3, 3], l) + (e ? 1 : 0), dmg: 15 + 5 * l + (e ? 8 : 0), r: 2.7 + 0.2 * l, cd: 2.5 - 0.1 * l, curse: 6, linger: e }),
  },
};

const tmpHit = [];

export class Weapons {
  constructor(G) {
    this.G = G; this.owned = []; this.bolts = []; this.boltPool = []; this.zones = []; this.orbit = null; this.halo = null;
  }
  has(id) { return this.owned.some((w) => w.id === id); }
  get(id) { return this.owned.find((w) => w.id === id); }
  add(id) {
    const w = { id, def: WEAPONS[id], level: 1, evo: false, cd: 0.4, t: 0, data: {} };
    this.owned.push(w); this.G.bus.emit('weaponAdded', w); return w;
  }
  st(w) { return w.def.stats(w.level, w.evo); }
  clear() {
    this.owned.length = 0; this.bolts.length = 0; this.zones.length = 0;
    if (this.haloMesh) { this.G.scene.remove(this.haloMesh); this.haloMesh.geometry.dispose(); this.haloMesh.material.dispose(); this.haloMesh = null; }
  }
  cdMul() { return Math.max(0.35, 1 - this.G.player.S.haste); }
  get area() { return this.G.player.S.area; }

  update(dt, time) {
    const G = this.G, P = G.player;
    if (P.dead) return;
    for (const w of this.owned) {
      const s = this.st(w);
      this.persistent(w, s, dt, time);
      if (s.cd === undefined) continue;
      w.cd -= dt;
      if (w.cd <= 0) {
        const fired = this.fire(w, s);
        w.cd = fired === false ? 0.2 : s.cd * this.cdMul();
        w.cdMax = s.cd * this.cdMul();
      }
    }
    this.updateBolts(dt);
    this.updateZones(dt, time);
  }

  // ——— one-shot casts ———
  fire(w, s) {
    const G = this.G, P = G.player, E = G.enemies, fx = G.fx, A = this.area;
    switch (w.id) {
      case 'ember': {
        const targets = this.pickTargets(s.n, 15);
        if (!targets.length) return false;
        for (let i = 0; i < s.n; i++) {
          const t = targets[i % targets.length];
          const lead = 0.35; const tx = t.x + (t.vx || 0) * lead + rand(-0.6, 0.6) * (i >= targets.length ? 2 : 0), tz = t.z + rand(-0.6, 0.6) * (i >= targets.length ? 2 : 0);
          const b = this.bolt('lob', P.x, P.z, tx, tz, { dmg: s.dmg, elem: 'fire', r: s.r * A, burn: s.burn, src: 'ember', dur: 0.42 + i * 0.05, pyre: w.evo });
        }
        fx.burst(P.x, 1.6, P.z, 'fire', 8, 3, 0.3, 0.4);
        G.audio.play('fire_cast', { vol: 0.6 });
        return true;
      }
      case 'rime': {
        // aim at the nearest foe ahead-ish; fall back to facing when nothing is close
        let ax = P.fx, az = P.fz;
        const tgt = E.nearest(P.x, P.z, 13);
        if (tgt) { const dx = tgt.x - P.x, dz = tgt.z - P.z, l = Math.hypot(dx, dz) || 1; ax = dx / l; az = dz / l; }
        const n = s.n, spread = 0.16;
        for (let i = 0; i < n; i++) {
          const a = Math.atan2(az, ax) + (i - (n - 1) / 2) * spread;
          const vx = Math.cos(a) * s.spd * P.S.speedP, vz = Math.sin(a) * s.spd * P.S.speedP;
          this.bolt('lance', P.x + Math.cos(a) * 0.6, P.z + Math.sin(a) * 0.6, vx, vz, { dmg: s.dmg, elem: 'ice', r: 0.45 * Math.sqrt(A), pierce: s.pierce, chill: s.chill, src: 'rime', life: 0.9 * P.S.duration, kinetic: true, glacial: w.evo });
        }
        fx.sparks(P.x + ax, 1.2, P.z + az, 'ice', 6, 8, ax, az, 0.8);
        G.audio.play('ice_cast', { vol: 0.55 });
        return true;
      }
      case 'tempest': {
        const hit = new Set(); let any = false;
        for (let k = 0; k < s.strikes; k++) {
          const first = E.nearest(P.x, P.z, 11, (e) => !hit.has(e));
          if (!first) break;
          any = true;
          this.chain(P.x, 1.6, P.z, first, s, hit);
        }
        if (s.sky) for (let k = 0; k < s.sky; k++) {
          const t = this.randomEnemyNear(P.x, P.z, 14); if (!t) break;
          G.fx.skyBolt(t.x, t.z); G.combat.area(t.x, t.z, 1.8 * A, s.dmg * 1.2, 'lightning', { wet: 4, src: 'tempest', knock: 3 }); any = true;
          G.rr.addTrauma(0.08);
        }
        if (any) { G.audio.play('lightning', { vol: 0.7 }); G.rr.U && (G.rr.aberr += 0.15); }
        return any;
      }
      case 'choir': {
        if (G.allies.count() < G.allies.cap()) { G.allies.raise(P.x + rand(-3, 3), P.z + rand(-3, 3), 'choir'); }
        return true;
      }
      case 'scythe': {
        w.data.swing = { t: 0, dur: 0.16, a0: Math.atan2(P.fz, P.fx) - s.arc / 2, arc: s.arc, dir: 1, hit: new Set(), s, back: s.twice };
        G.audio.play('scythe_swing', { vol: 0.7 });
        return true;
      }
      case 'thorns': {
        const targets = this.pickTargets(s.n, s.range, true);
        const spots = targets.map((t) => [t.x, t.z]);
        while (spots.length < s.n && targets.length) spots.push([P.x + rand(-6, 6), P.z + rand(-6, 6)]);
        if (!spots.length) return false;
        if (s.ring) for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; spots.push([P.x + Math.cos(a) * 3.2, P.z + Math.sin(a) * 3.2]); }
        spots.forEach(([x, z], i) => {
          fx.glow.add(x, z, s.r * 2 * A, DECAL.SIGIL, 0.6, 0.02, 0.06, 0.9, 0.35, rand(0, 6));
          this.zones.push({ kind: 'spike', x, z, t: 0.16 + i * 0.03, r: s.r * A, dmg: s.dmg, once: true });
        });
        G.audio.play('blood_spike', { vol: 0.5 });
        return true;
      }
      case 'halo': {
        const r = s.rad * A;
        let n = 0;
        E.inRadius(P.x, P.z, r, (e) => {
          if (e.dying) return; n++;
          G.combat.damage(e, s.dmg, 'holy', { knock: s.knock, burn: w.evo ? s.dmg * 0.6 : 0, src: 'halo', quiet: n > 5 });
        });
        fx.ring(P.x, P.z, r, 'holy', 0.35, 0.2, 0.7);
        for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; fx.add.spawn(P.x + Math.cos(a) * r, 0.3, P.z + Math.sin(a) * r, Math.cos(a) * 1.5, 1.2, Math.sin(a) * 1.5, 0.4, 0.35, 0.05, 3, 2.4, 1.1, 0.8, 0.5, 0, 0); }
        if (w.evo && n >= 8) P.heal(1, true);
        G.audio.play('holy_pulse', { vol: n ? 0.45 : 0.18 });
        return true;
      }
      case 'hex': {
        const spots = this.densest(s.n, 14);
        if (!spots.length) return false;
        for (const [x, z] of spots) {
          fx.glow.add(x, z, s.r * 2.1 * A, DECAL.SIGIL, 0.42, 0.08, 0.85, 0.85, 0.75, rand(0, 6), 0, 0.03, 0.12);
          fx.glow.add(x, z, s.r * 2.1 * A, DECAL.RUNES, 0.2, 0.04, 0.4, 0.7, 0.75, rand(0, 6), -1.5, 0.03, 0.12);
          this.zones.push({ kind: 'hexmark', x, z, t: 0.6, r: s.r * A, dmg: s.dmg, curse: s.curse, linger: s.linger });
        }
        G.audio.play('hex_cast', { vol: 0.6 });
        return true;
      }
    }
    return false;
  }

  // ——— continuous effects: orbit blades, halo ring, scythe sweeps ———
  persistent(w, s, dt, time) {
    const G = this.G, P = G.player, fx = G.fx, E = G.enemies, A = this.area;
    if (w.id === 'orrery') {
      w.data.a = (w.data.a || 0) + s.spin * dt;
      const breathe = w.evo ? 1 + 0.9 * (0.5 + 0.5 * Math.sin(time * 1.6)) : 1;
      const rad = s.rad * Math.sqrt(A) * breathe;
      w.data.hits = w.data.hits || new Map();
      w.data.prev = w.data.prev || [];
      for (let i = 0; i < s.n; i++) {
        const a = w.data.a + (i / s.n) * TAU;
        const x = P.x + Math.cos(a) * rad, z = P.z + Math.sin(a) * rad, y = 1.1;
        const pv = w.data.prev[i];
        const c = ELEM.arcane.c;
        fx.add.spawn(x, y, z, 0, 0, 0, 0.03, 0.9, 0.9, c[0], c[1], c[2], 1, 1, 0, 4);
        fx.add.spawn(x, y, z, 0, 0, 0, 0.03, 0.35, 0.35, 2.5, 2.2, 3, 1, 1, 0, 1);
        if (pv) fx.rib.quad(x, y, z, pv[0], y, pv[1], 0.55, 0.05, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0.8);
        if (pv) fx.rib.seg1(x, y, z, pv[0], y, pv[1], 0.4, 0.1, c[0] * 0.35, c[1] * 0.35, c[2] * 0.35, 0.6, 0.12);
        w.data.prev[i] = [x, z];
        E.grid.query(x, z, 1.6, (e) => {
          if (e.dying || e.hidden) return;
          const d2 = (e.x - x) ** 2 + (e.z - z) ** 2; if (d2 > (e.r + 0.55) ** 2) return;
          const last = w.data.hits.get(e.id) || 0; if (time - last < s.hitCd) return;
          w.data.hits.set(e.id, time);
          G.combat.damage(e, s.dmg, 'arcane', { kinetic: true, knock: 3.5, src: 'orrery', dirx: -Math.sin(a), dirz: Math.cos(a) });
        });
        if (w.evo) {
          w.data.dart = w.data.dart || [];
          w.data.dart[i] = (w.data.dart[i] || rand(0, 1.2)) - dt;
          if (w.data.dart[i] <= 0) {
            w.data.dart[i] = 1.2;
            const t = E.nearest(x, z, 9);
            if (t) { const dx = t.x - x, dz = t.z - z, l = Math.hypot(dx, dz) || 1; this.bolt('dart', x, z, (dx / l) * 26, (dz / l) * 26, { dmg: s.dmg * 0.7, elem: 'arcane', r: 0.35, pierce: 1, src: 'orrery', life: 0.6, kinetic: true }); }
          }
        }
      }
      if (w.data.hits.size > 600) w.data.hits.clear();
      if (Math.random() < 0.02) G.audio.play('arcane_hit', { vol: 0.08, pitch: 2 });
    } else if (w.id === 'halo') {
      if (!this.haloMesh) {
        const g = new THREE.RingGeometry(0.93, 1, 64); g.rotateX(-Math.PI / 2);
        this.haloMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.haloMesh.renderOrder = 5; G.scene.add(this.haloMesh);
      }
      const r = s.rad * A; const m = this.haloMesh; m.visible = true;
      const k = 1 - clamp(w.cd / (w.cdMax || 1), 0, 1);
      m.position.set(P.x, 0.08, P.z); m.scale.setScalar(r * (0.96 + 0.04 * k));
      m.material.opacity = 0.18 + 0.4 * k * k;
      if (Math.random() < 0.5) { const a = rand(0, TAU); fx.add.spawn(P.x + Math.cos(a) * r, 0.2, P.z + Math.sin(a) * r, 0, rand(0.5, 1.4), 0, 0.6, 0.2, 0.02, 2.6, 2, 0.9, 0.8, 0.8, 0, 5); }
      this.haloR = r;
    } else if (w.id === 'scythe' && w.data.swing) {
      const sw = w.data.swing, s2 = sw.s;
      const prevT = sw.t; sw.t += dt;
      const k0 = Math.min(1, prevT / sw.dur), k1 = Math.min(1, sw.t / sw.dur);
      const rad = s2.rad * A;
      const aStart = sw.dir > 0 ? sw.a0 + sw.arc * k0 : sw.a0 + sw.arc * (1 - k0);
      const aEnd = sw.dir > 0 ? sw.a0 + sw.arc * k1 : sw.a0 + sw.arc * (1 - k1);
      const c = ELEM.shadow.c;
      fx.rib.arc(P.x, 1.0, P.z, rad * 0.82, aStart, aEnd, 1.5, c[0], c[1], c[2], 0.22, 4);
      fx.rib.arc(P.x, 1.02, P.z, rad * 0.9, aStart, aEnd, 0.45, 2.2, 1.8, 3, 0.16, 4);
      for (let q = 0; q < 3; q++) { const a = aStart + (aEnd - aStart) * Math.random(); fx.add.spawn(P.x + Math.cos(a) * rad * rand(0.5, 1), 1, P.z + Math.sin(a) * rad * rand(0.5, 1), Math.cos(a) * 3, rand(0, 1), Math.sin(a) * 3, 0.4, 0.3, 0.05, c[0], c[1], c[2], 0.9, 0.3, 0, 5); }
      const lo = Math.min(aStart, aEnd), hi = Math.max(aStart, aEnd);
      E.inRadius(P.x, P.z, rad, (e) => {
        if (sw.hit.has(e) || e.dying) return;
        let a = Math.atan2(e.z - P.z, e.x - P.x);
        const inArc = sw.arc >= TAU - 0.01 ? (a - lo + TAU * 4) % TAU <= hi - lo + 0.25 : [a, a + TAU, a - TAU].some((b) => b >= lo - 0.25 && b <= hi + 0.25);
        if (!inArc) return;
        sw.hit.add(e);
        G.combat.damage(e, s2.dmg, 'shadow', { kinetic: true, knock: 6, curse: s2.curse, src: 'scythe', dirx: Math.cos(a), dirz: Math.sin(a) });
        if (w.evo && e.dying && this.zones.filter((z) => z.kind === 'rift').length < 3) this.zones.push({ kind: 'rift', x: e.x, z: e.z, t: 2.2, r: 3.2, dmg: s2.dmg * 0.25, acc: 0 });
      });
      if (sw.t >= sw.dur) {
        if (sw.back) { w.data.swing = { ...sw, t: 0, dir: -sw.dir, back: false, hit: new Set() }; G.audio.play('scythe_swing', { vol: 0.5, pitch: 1.2 }); }
        else w.data.swing = null;
      }
    }
  }
  shieldCheck(shot) {
    if (!this.haloR || !this.has('halo')) return false;
    const P = this.G.player; return (shot.x - P.x) ** 2 + (shot.z - P.z) ** 2 < this.haloR * this.haloR;
  }

  chain(fx0, fy0, fz0, first, s, hit) {
    const G = this.G, E = G.enemies, fx = G.fx, cond = G.player.arcana.has('conductive');
    let from = { x: fx0, y: fy0, z: fz0 }, cur = first, dmg = s.dmg, jumps = s.chains + (cond ? 3 : 0);
    const c = ELEM.lightning.c;
    for (let j = 0; j <= jumps && cur; j++) {
      hit.add(cur);
      const y = (cur.def?.height || 2) * cur.scale * 0.6;
      fx.rib.bolt(from.x, from.y, from.z, cur.x, y, cur.z, 0.3, c[0] * 0.6, c[1] * 0.6, c[2] * 0.6, 0.2, 0.55, 1);
      fx.rib.bolt(from.x, from.y, from.z, cur.x, y, cur.z, 0.08, 1.8, 1.9, 2.4, 0.12, 0.4, 0);
      const conductive = cur.wetT > 0 || cur.curseT > 0;
      const mult = conductive ? (cond ? 1.6 : 1.2) : 1;
      if (conductive) fx.ring(cur.x, cur.z, 1.4, 'lightning', 0.25, 1);
      G.combat.damage(cur, dmg * mult, 'lightning', { src: 'tempest', knock: 1.5, dirx: cur.x - from.x, dirz: cur.z - from.z, burn: G.player.arcana.has('cinder') ? dmg * 0.2 : 0 });
      fx.light(cur.x, cur.z, 0x9fb0ff, 25, 0.12, 9);
      if (conductive && cond && j === 0) G.combat.synergy('Conductive Sin');
      dmg *= conductive && cond ? 1 : 0.88;
      from = { x: cur.x, y, z: cur.z };
      const range = s.range * (conductive ? 1.6 : 1);
      cur = E.nearest(cur.x, cur.z, range, (e) => !hit.has(e) && !e.dying);
    }
  }

  pickTargets(n, range, spread = false) {
    const E = this.G.enemies, P = this.G.player, out = [];
    tmpHit.length = 0;
    E.inRadius(P.x, P.z, range, (e) => { if (!e.dying && !e.hidden) tmpHit.push(e); });
    if (!tmpHit.length) return out;
    tmpHit.sort((a, b) => ((a.x - P.x) ** 2 + (a.z - P.z) ** 2) - ((b.x - P.x) ** 2 + (b.z - P.z) ** 2));
    if (spread) { for (let i = 0; i < n && tmpHit.length; i++) { const k = Math.min(tmpHit.length - 1, (Math.random() * Math.min(tmpHit.length, n * 3)) | 0); out.push(tmpHit.splice(k, 1)[0]); } return out; }
    for (let i = 0; i < Math.min(n, tmpHit.length); i++) out.push(tmpHit[i]);
    return out;
  }
  randomEnemyNear(x, z, r) {
    tmpHit.length = 0; this.G.enemies.inRadius(x, z, r, (e) => { if (!e.dying && !e.hidden) tmpHit.push(e); });
    return tmpHit.length ? pick(tmpHit) : null;
  }
  densest(n, range) {
    const E = this.G.enemies, P = this.G.player, cands = [];
    tmpHit.length = 0; E.inRadius(P.x, P.z, range, (e) => { if (!e.dying && !e.hidden) tmpHit.push(e); });
    if (!tmpHit.length) return [];
    for (let i = 0; i < Math.min(14, tmpHit.length); i++) {
      const e = tmpHit[(Math.random() * tmpHit.length) | 0]; let c = 0;
      E.grid.query(e.x, e.z, 3, () => { c++; });
      cands.push([e.x, e.z, c]);
    }
    cands.sort((a, b) => b[2] - a[2]);
    const out = [];
    for (const c of cands) { if (out.every((o) => (o[0] - c[0]) ** 2 + (o[1] - c[1]) ** 2 > 16)) out.push(c); if (out.length >= n) break; }
    return out;
  }

  // ——— projectiles ———
  bolt(kind, x, z, a, b, o) {
    const p = this.boltPool.pop() || {};
    p.kind = kind; p.x = x; p.z = z; p.y = 1.2; p.o = o; p.t = 0; p.pierce = o.pierce || 1; p.hit = p.hit || new Set(); p.hit.clear();
    if (kind === 'lob') { p.sx = x; p.sz = z; p.tx = a; p.tz = b; p.dur = o.dur; p.life = o.dur; }
    else { p.vx = a; p.vz = b; p.life = o.life || 1; }
    this.bolts.push(p); return p;
  }
  updateBolts(dt) {
    const G = this.G, fx = G.fx, E = G.enemies;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const p = this.bolts[i]; const o = p.o; p.t += dt; p.life -= dt;
      let dead = false;
      const c = ELEM[o.elem].c;
      if (p.kind === 'lob') {
        const k = Math.min(1, p.t / p.dur);
        const px = p.x, pz = p.z, py = p.y;
        p.x = p.sx + (p.tx - p.sx) * k; p.z = p.sz + (p.tz - p.sz) * k; p.y = 1.3 + Math.sin(k * Math.PI) * 3.2 - k * 1.1;
        fx.add.spawn(p.x, p.y, p.z, 0, 0, 0, 0.035, o.pyre ? 1.0 : 0.75, 0.7, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 1, 1, 0, 1);
        fx.add.spawn(p.x, p.y, p.z, 0, 0, 0, 0.035, 0.28, 0.25, 1.6, 1.2, 0.8, 1, 1, 0, 1);
        fx.rib.quad(p.x, p.y, p.z, px, py, pz, 0.4, 0.15, c[0] * 0.45, c[1] * 0.45, c[2] * 0.45, 1);
        fx.trail(p.x, p.y, p.z, 'fire', 0.45, 0.15);
        if (Math.random() < 0.5) fx.add.spawn(p.x, p.y, p.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.6, 0.08, 0.02, c[0], c[1], c[2], 1, 0.4, 3, 5);
        if (k >= 1) {
          dead = true;
          fx.explosion(p.x, p.z, o.r, 'fire'); G.audio.play('fire_explode', { vol: 0.45, pitch: rand(0.9, 1.2) });
          G.combat.area(p.x, p.z, o.r, o.dmg, 'fire', { burn: o.burn, knock: 3, src: o.src });
          if (o.pyre) this.zones.push({ kind: 'pyre', x: p.x, z: p.z, t: 2.6, r: o.r * 0.9, dmg: o.dmg * 0.22, acc: 0, burn: o.burn });
          G.rr.addTrauma(0.03);
        }
      } else {
        const px = p.x, pz = p.z;
        p.x += p.vx * dt; p.z += p.vz * dt;
        if (p.kind === 'lance') {
          fx.rib.quad(p.x, 1.1, p.z, p.x - p.vx * 0.05, 1.1, p.z - p.vz * 0.05, 0.4, 0.05, c[0], c[1], c[2], 1);
          fx.add.spawn(p.x, 1.1, p.z, 0, 0, 0, 0.03, 0.8, 0.8, c[0], c[1], c[2], 1, 1, 0, 1);
          if (Math.random() < 0.6) fx.add.spawn(p.x, 1.1, p.z, rand(-0.5, 0.5), rand(-0.5, 0.2), rand(-0.5, 0.5), 0.5, 0.18, 0.05, c[0], c[1], c[2], 0.8, 0.5, 1, 4);
        } else {
          fx.add.spawn(p.x, 1.1, p.z, 0, 0, 0, 0.03, 0.6, 0.6, c[0], c[1], c[2], 1, 1, 0, 1);
          fx.rib.quad(p.x, 1.1, p.z, px, 1.1, pz, 0.25, 0.05, c[0] * 0.6, c[1] * 0.6, c[2] * 0.6, 1);
        }
        if (G.world.blocked(p.x, p.z, 0.05)) { dead = true; fx.sparks(p.x, 1, p.z, o.elem, 5, 6); }
        else {
          const rr = o.r;
          E.grid.query(p.x, p.z, rr + 1.5, (e) => {
            if (dead || p.hit.has(e) || e.dying || e.hidden) return;
            if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 > (e.r + rr) ** 2) return;
            p.hit.add(e);
            const wasFrozen = e.freezeT > 0;
            G.combat.damage(e, o.dmg, o.elem, { kinetic: o.kinetic, chill: o.chill, knock: 2, src: o.src, dirx: p.vx, dirz: p.vz });
            if (o.glacial && wasFrozen) {
              for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + rand(0, 0.5); this.bolt('dart', e.x, e.z, Math.cos(a) * 18, Math.sin(a) * 18, { dmg: o.dmg * 0.4, elem: 'ice', r: 0.3, pierce: 2, src: o.src, life: 0.4, chill: 1 }); }
            }
            p.pierce--; if (p.pierce <= 0) dead = true;
          });
        }
      }
      if (p.life <= 0) dead = true;
      if (dead) { this.bolts[i] = this.bolts[this.bolts.length - 1]; this.bolts.pop(); this.boltPool.push(p); }
    }
  }

  // ——— ground zones ———
  updateZones(dt, time) {
    const G = this.G, fx = G.fx, E = G.enemies;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]; z.t -= dt;
      switch (z.kind) {
        case 'spike':
          if (z.t <= 0) {
            const c = ELEM.blood.c;
            for (let k = 0; k < 5; k++) { const a = rand(0, TAU), rr = rand(0, z.r * 0.6); const x = z.x + Math.cos(a) * rr, zz = z.z + Math.sin(a) * rr; fx.rib.seg1(x, 0, zz, x + rand(-0.3, 0.3), rand(1.4, 2.6), zz + rand(-0.3, 0.3), 0.55, 0.0, c[0] * 0.5, c[1], c[2], 1, 0.35); }
            fx.burst(z.x, 0.5, z.z, 'blood', 10, 5, 0.4, 0.25, 4, 12);
            fx.decals.add(z.x, z.z, z.r * 2.2, DECAL.SPLAT, 0.07, 0.004, 0.008, 0.6, 4);
            G.combat.area(z.x, z.z, z.r, z.dmg, 'blood', { kinetic: true, bleed: 3, knock: 2, src: 'thorns' });
          }
          break;
        case 'hexmark':
          if (Math.random() < 0.5) fx.add.spawn(z.x + rand(-z.r, z.r), 0.2, z.z + rand(-z.r, z.r), 0, rand(1, 3), 0, 0.4, 0.25, 0.05, 1, 0.25, 2.2, 1, 0.5, 0, 0);
          if (z.t <= 0) {
            fx.explosion(z.x, z.z, z.r, 'shadow'); fx.pillar(z.x, z.z, 'shadow', 6, 1.6, 0.4);
            G.combat.area(z.x, z.z, z.r, z.dmg, 'shadow', { curse: z.curse, knock: 2, src: 'hex' });
            G.audio.play('fire_explode', { vol: 0.4, pitch: 0.6 }); G.rr.addTrauma(0.05);
            if (z.linger) this.zones.push({ kind: 'hexfield', x: z.x, z: z.z, t: 3, r: z.r, dmg: z.dmg * 0.2, acc: 0 });
          }
          break;
        case 'pyre': case 'hexfield': case 'rift': {
          z.acc += dt;
          const elem = z.kind === 'pyre' ? 'fire' : 'shadow';
          if (Math.random() < 0.8) { const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * z.r; if (elem === 'fire') fx.flame(z.x + Math.cos(a) * rr, 0.1, z.z + Math.sin(a) * rr, 0.8); else fx.add.spawn(z.x + Math.cos(a) * rr, 0.2, z.z + Math.sin(a) * rr, -Math.cos(a) * 2, 0.5, -Math.sin(a) * 2, 0.6, 0.35, 0.05, 1, 0.2, 2, 0.9, 0.5, 0, 0); }
          if (z.kind === 'rift') {
            E.inRadius(z.x, z.z, z.r * 1.6, (e) => { if (e.boss || e.dying) return; const dx = z.x - e.x, dz = z.z - e.z, l = Math.hypot(dx, dz) || 1; e.kx += (dx / l) * 22 * dt; e.kz += (dz / l) * 22 * dt; });
            if (Math.random() < 0.3) fx.ring(z.x, z.z, z.r * 0.6, 'shadow', 0.3, 0.3, 0.6);
          }
          if (z.acc >= 0.5) { z.acc -= 0.5; G.combat.area(z.x, z.z, z.r, z.dmg, elem, { burn: z.burn || 0, curse: z.kind === 'hexfield' ? 3 : 0, quiet: true, src: z.kind === 'pyre' ? 'ember' : z.kind === 'rift' ? 'scythe' : 'hex' }); }
          break;
        }
      }
      if (z.t <= 0) { this.zones[i] = this.zones[this.zones.length - 1]; this.zones.pop(); }
    }
  }

  // ——— ultimates ———
  ultimate(id) {
    const G = this.G, P = G.player, fx = G.fx, E = G.enemies;
    G.audio.play('ultimate'); G.hitstop(0.12); G.rr.addTrauma(0.6); G.rr.shock(P.x, P.z, 1.4); G.rr.flash = 0.35;
    const sc = 1 + G.time / 240;
    if (id === 'immolation') {
      fx.explosion(P.x, P.z, 9, 'fire', true); fx.ring(P.x, P.z, 12, 'fire', 0.7, 0.4);
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; this.zones.push({ kind: 'pyre', x: P.x + Math.cos(a) * 6, z: P.z + Math.sin(a) * 6, t: 3, r: 2, dmg: 6 * sc, acc: 0, burn: 8 * sc }); }
      G.combat.area(P.x, P.z, 11, 60 * sc, 'fire', { burn: 12 * sc, knock: 14, src: 'ult' });
    } else if (id === 'zero') {
      fx.ring(P.x, P.z, 16, 'ice', 0.8, 0.4); fx.shards(P.x, P.z, 80, 'ice', 18);
      fx.glow.add(P.x, P.z, 30, DECAL.FROST, 0.4, 0.9, 1.6, 0.8, 3);
      E.inRadius(P.x, P.z, 22, (e) => { G.combat.damage(e, 30 * sc, 'ice', { freeze: 3.2, src: 'ult', quiet: true }); });
      G.rr.U.uTint.value.setRGB(0.85, 0.95, 1.15); setTimeout(() => G.rr.U.uTint.value.setRGB(...G.world.map.grade), 2500);
    } else if (id === 'exhume') {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; G.allies.raise(P.x + Math.cos(a) * 3, P.z + Math.sin(a) * 3, 'ult'); }
      fx.explosion(P.x, P.z, 7, 'necro', true);
      G.combat.area(P.x, P.z, 8, 40 * sc, 'necro', { knock: 10, curse: 6, src: 'ult' });
    } else if (id === 'exsanguinate') {
      let healed = 0;
      E.inRadius(P.x, P.z, 13, (e) => {
        const d = e.boss ? 60 * sc : Math.max(20 * sc, e.maxHp * 0.45);
        G.combat.damage(e, d, 'blood', { bleed: 5, src: 'ult', quiet: true }); healed++;
        fx.rib.seg1(e.x, 1, e.z, P.x, 1.2, P.z, 0.25, 0.05, 2.5, 0.1, 0.2, 1, 0.5);
      });
      P.heal(Math.min(60, healed * 1.5));
      fx.explosion(P.x, P.z, 5, 'blood', true);
    }
  }
}
