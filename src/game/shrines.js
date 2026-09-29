import * as THREE from 'three';
import { shrineMesh } from '../world/props.js';
import { DECAL } from '../render/textures.js';
import { rand, TAU } from '../core/util.js';

// Risk/reward shrines scattered through the world. Stand on one to invoke it.
const KINDS = {
  blood: { name: 'Altar of Blood', desc: 'Offer a quarter of your blood for a Blessed offering.', col: 0xff2440, rgb: [2.6, 0.1, 0.2] },
  bell: { name: 'Bell of Summoning', desc: 'Ring it. Elites will answer — and bring their reliquaries.', col: 0xa877ff, rgb: [1.6, 0.4, 3] },
  grace: { name: 'Font of Grace', desc: 'Heals half your health and grants a reroll.', col: 0xffe2a0, rgb: [3, 2.4, 1.2] },
};
export class Shrines {
  constructor(G) {
    this.G = G; this.list = [];
    this.mat = G.world.propMat;
    for (const [x, z, kind] of G.world.shrineSpots) {
      const m = new THREE.Mesh(shrineMesh(kind), this.mat); m.position.set(x, 0, z); m.castShadow = true; G.world.root.add(m);
      const k = KINDS[kind];
      // lit by the pooled torch lights (registered as a torch) + an emissive sigil; no dedicated light
      const light = { intensity: 0 };
      G.world.torches.push({ x, y: 1.4, z, phase: x, small: true, shrine: true });
      const glow = G.fx.glow.add(x, z, 6, DECAL.SIGIL, k.rgb[0] * 0.3, k.rgb[1] * 0.3, k.rgb[2] * 0.3, 0.8, 1e9, 0);
      G.world.addCollider(x, z, 0.1);
      this.list.push({ x, z, kind, used: false, prog: 0, light, glow, tele: null, m });
    }
  }
  update(dt, time) {
    const G = this.G, P = G.player;
    for (const s of this.list) {
      if (s.used) continue;
      s.light.intensity = 16 + Math.sin(time * 2 + s.x) * 5;
      const k = KINDS[s.kind];
      if (Math.random() < 0.25) G.fx.add.spawn(s.x + rand(-1, 1), rand(0.5, 2), s.z + rand(-1, 1), 0, rand(0.5, 1.5), 0, 1, 0.2, 0.02, k.rgb[0], k.rgb[1], k.rgb[2], 0.8, 0.6, 0, 5);
      const d = Math.hypot(P.x - s.x, P.z - s.z);
      if (d < 2.4) {
        if (!s.near) { s.near = true; s.tele = G.fx.tele.circle(s.x, s.z, 2.4, 0, k.col, 0.9); G.bus.emit('shrineNear', { name: k.name, desc: k.desc }); }
        s.prog += dt;
        if (s.tele) s.tele.mesh.material.uniforms.uProg.value = Math.min(1, s.prog / 1.3);
        if (s.prog >= 1.3) this.activate(s);
      } else if (s.near) { G.fx.tele.release(s.tele); s.tele = null; s.near = false; s.prog = 0; G.bus.emit('shrineFar'); }
    }
  }
  activate(s) {
    const G = this.G, P = G.player; const k = KINDS[s.kind];
    s.used = true; G.fx.tele.release(s.tele); s.tele = null; s.light.intensity = 0; G.fx.glow.kill(s.glow);
    G.bus.emit('shrineFar'); G.audio.play('shrine_activate'); G.fx.pillar(s.x, s.z, 'holy', 14, 2, 0.8); G.rr.addTrauma(0.2);
    G.run.shrines++;
    if (s.kind === 'blood') {
      const cost = Math.max(1, Math.floor(P.hp * 0.25)); P.hp = Math.max(1, P.hp - cost);
      G.fx.explosion(s.x, s.z, 3, 'blood'); G.floaters.add(P.x, 2.4, P.z, cost, false, 'player');
      G.queueLevelUp({ minRarity: 'rare', title: 'The Altar Accepts', sub: 'Choose what your blood has bought.' });
    } else if (s.kind === 'bell') {
      G.audio.play('bell_toll');
      for (let i = 0; i < 3; i++) { const a = rand(0, TAU); G.enemies.spawn(['brute', 'bulwark', 'hexcaster', 'gnawer'][(Math.random() * 4) | 0], s.x + Math.cos(a) * 12, s.z + Math.sin(a) * 12, { elite: true }); }
      for (let i = 0; i < 24; i++) { const a = rand(0, TAU); G.enemies.spawn('husk', s.x + Math.cos(a) * 14, s.z + Math.sin(a) * 14); }
      G.bus.emit('toast', 'The Bell Is Rung', 'They heard. They are coming.');
    } else {
      P.heal(P.maxHp * 0.5); P.burnT = 0; G.run.rerolls++;
      G.bus.emit('toast', 'Grace', 'For a moment, nothing hurts.');
    }
  }
}
