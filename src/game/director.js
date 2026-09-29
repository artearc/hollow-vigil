import { rand, TAU, weightedPick, pick } from '../core/util.js';
import { spawnWeights } from './bestiary.js';
import { TIMELINE, RUN_LENGTH } from './data.js';
import { spawnBoss } from './bosses.js';

// Pacing: a continuous pressure curve, punctuated by elites, set-piece events and bosses.
export class Director {
  constructor(G) {
    this.G = G; this.acc = 0; this.eliteT = 70; this.idx = 0; this.phase = TIMELINE[0].phase; this.bossActive = null;
  }
  update(dt) {
    const G = this.G, R = G.run, t = G.time, P = G.player;
    const m = t / 60;
    R.enemyHpMul = (1 + m * 0.3 + m * m * 0.028) * (R.vows.iron ? 1.5 : 1) * (P.arcana.has('avarice') ? 1.3 : 1);
    R.enemyDmgMul = 1 + m * 0.09;
    R.enemySpeedMul = R.vows.haste ? 1.2 : 1;
    while (this.idx < TIMELINE.length && TIMELINE[this.idx].t <= t) {
      const ev = TIMELINE[this.idx];
      if (ev.boss && G.enemies.bossList.length) break; // one sealed arena at a time: the next boss waits its turn
      this.fire(ev); this.idx++;
    }
    const boss = G.enemies.bossList.length > 0;
    // gentle opening (learn the verbs), then a steep ramp toward extreme late-game density
    let rate = 1.2 + t * 0.022 + Math.pow(m, 1.8) * 0.45;
    if (R.vows.multitude) rate *= 1.6;
    if (boss) rate *= 0.3;
    if (t > RUN_LENGTH && !boss) rate *= 1.8; // overtime: the dark rushes in
    const maxAlive = Math.min(650, 40 + t * 1.05) * (R.vows.multitude ? 1.25 : 1);
    this.acc += dt * rate;
    const alive = G.enemies.list.length;
    while (this.acc >= 1) {
      this.acc -= 1;
      if (alive >= maxAlive) continue;
      const w = spawnWeights(t, G.mapId);
      const type = weightedPick(Object.keys(w), (k) => w[k]);
      const pos = this.spawnPos();
      if (!pos) continue;
      if ((type === 'husk' || type === 'gnawer' || type === 'moth') && Math.random() < 0.18) {
        const n = 4 + ((Math.random() * 5) | 0);
        for (let i = 0; i < n; i++) G.enemies.spawn(type, pos[0] + rand(-2, 2), pos[1] + rand(-2, 2));
        this.acc -= n * 0.5;
      } else G.enemies.spawn(type, pos[0], pos[1]);
    }
    this.eliteT -= dt;
    if (this.eliteT <= 0 && !boss) {
      this.eliteT = Math.max(28, 60 - t / 20);
      const w = spawnWeights(t, G.mapId); delete w.husk;
      const type = weightedPick(Object.keys(w), (k) => w[k] * (k === 'brute' || k === 'bulwark' ? 2 : 1));
      const pos = this.spawnPos(); if (pos) G.enemies.spawn(type, pos[0], pos[1], { elite: true });
    }
  }
  fire(ev) {
    const G = this.G;
    if (ev.phase && ev.phase !== this.phase) { this.phase = ev.phase; }
    if (ev.boss) { spawnBoss(G, ev.boss); }
    if (ev.event === 'ring') {
      const P = G.player, n = 56;
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const x = P.x + Math.cos(a) * 17, z = P.z + Math.sin(a) * 17; if (!G.world.blocked(x, z, 0.6)) G.enemies.spawn(i % 7 === 0 ? 'bulwark' : 'husk', x, z); }
      G.bus.emit('toast', 'The Procession', 'They have come to watch you kneel.');
    }
    if (ev.event === 'surge') {
      const P = G.player, a = rand(0, TAU);
      for (let i = 0; i < 60; i++) { const s = rand(-0.6, 0.6); const d = rand(22, 32); G.enemies.spawn(i % 5 ? 'gnawer' : 'moth', P.x + Math.cos(a + s) * d, P.z + Math.sin(a + s) * d); }
      G.bus.emit('toast', 'The Hunt', 'Something is driving them toward you.');
    }
  }
  spawnPos() {
    const G = this.G, P = G.player;
    for (let k = 0; k < 8; k++) {
      let a = rand(0, TAU);
      const sp = Math.hypot(P.vx, P.vz);
      if (sp > 1 && Math.random() < 0.45) a = Math.atan2(P.vz, P.vx) + rand(-0.9, 0.9);
      const x = P.x + Math.cos(a) * rand(25, 30), z = P.z + Math.sin(a) * rand(19, 24);
      if (G.arena && Math.hypot(x - G.arena.x, z - G.arena.z) < G.arena.r - 1) continue;
      if (!G.world.blocked(x, z, 1)) return [x, z];
    }
    return null;
  }
  relocate(e) { const p = this.spawnPos(); if (p) { e.x = p[0]; e.z = p[1]; e.spawnT = 0; } }
}
