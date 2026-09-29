import { rand, TAU, angleLerp, chance } from '../core/util.js';
import { DECAL } from '../render/textures.js';

// Skeletal thralls raised by the Grave Choir, Gravebound and Mass Exhumation.
export class Allies {
  constructor(G) {
    this.G = G; this.list = [];
    G.bus.on('kill', (e, src) => {
      const w = G.weapons.get('choir'); if (!w) return;
      const s = G.weapons.st(w);
      if (this.count() < this.cap() && chance(s.raise)) this.raise(e.x, e.z, 'choir');
    });
  }
  count() { return this.list.length; }
  cap() {
    const w = this.G.weapons.get('choir');
    const base = w ? this.G.weapons.st(w).max : 0;
    return base + Math.ceil(this.G.player.relicLevel('bonecrown') / 2) + (this.G.player.arcana.has('gravebound') ? 4 : 0);
  }
  raise(x, z, src) {
    const G = this.G;
    if (src !== 'ult' && this.list.length >= Math.max(1, this.cap())) return;
    if (this.list.length > 40) return;
    const o = { x, z, t: 0, life: src === 'ult' ? 14 : 22, atk: rand(0.2, 0.6), face: rand(0, TAU), hitT: 0, rise: 0, lean: 0, sq: 0 };
    G.world.resolve(o, 0.4);
    this.list.push(o);
    G.fx.pillar(o.x, o.z, 'necro', 3.5, 0.8, 0.45); G.fx.burst(o.x, 0.3, o.z, 'necro', 12, 3, 0.5, 0.3, 5, 4);
    G.fx.glow.add(o.x, o.z, 2.6, DECAL.RUNES, 0.08, 0.45, 0.22, 0.8, 1.2, 0, 0.1);
    G.audio.play('necro_raise', { vol: 0.5 });
  }
  update(dt) {
    const G = this.G, P = G.player, E = G.enemies, fx = G.fx;
    const w = G.weapons.get('choir');
    const s = w ? G.weapons.st(w) : { dmg: 12 };
    const dmg = s.dmg * (1 + P.S.summon);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      a.t += dt; a.life -= dt; a.rise = Math.min(1, a.rise + dt * 2.5); a.hitT = Math.max(0, a.hitT - dt * 6); a.sq *= Math.exp(-dt * 10);
      if (a.life <= 0) {
        fx.burst(a.x, 1, a.z, 'necro', 14, 4, 0.5, 0.3, 4, 12);
        if (w && w.evo) { fx.explosion(a.x, a.z, 2.4, 'necro'); G.combat.area(a.x, a.z, 2.6, dmg * 1.6, 'necro', { knock: 5, src: 'choir' }); }
        this.list[i] = this.list[this.list.length - 1]; this.list.pop(); continue;
      }
      const t = E.nearest(a.x, a.z, 11);
      let tx, tz, spd = 6.2;
      const pd = Math.hypot(P.x - a.x, P.z - a.z);
      if (t && pd < 16) { tx = t.x - a.x; tz = t.z - a.z; }
      else { tx = P.x - a.x; tz = P.z - a.z; if (pd < 3) spd = 0; }
      const d = Math.hypot(tx, tz) || 1;
      if (t && d < t.r + 0.9) {
        spd = 0; a.atk -= dt;
        if (a.atk <= 0) {
          a.atk = 0.5; a.sq = 0.25;
          const ang = Math.atan2(tz, tx);
          fx.rib.arc(a.x, 1, a.z, 1.3, ang - 1, ang + 1, 0.5, 0.3, 1.6, 0.9, 0.18, 6);
          // a cleaving sweep: the target and anything packed beside it
          G.enemies.inRadius(a.x + Math.cos(ang) * 1.1, a.z + Math.sin(ang) * 1.1, 1.3, (o) => {
            if (!o.dying) G.combat.damage(o, o === t ? dmg : dmg * 0.6, 'necro', { kinetic: true, knock: 3, src: 'choir', dirx: tx, dirz: tz, quiet: Math.random() < 0.5 });
          });
          G.audio.play('summon_attack', { vol: 0.35 });
        }
      }
      if (a.rise < 1) spd = 0;
      a.x += (tx / d) * spd * dt; a.z += (tz / d) * spd * dt;
      G.world.resolve(a, 0.4);
      if (spd > 0) a.face = angleLerp(a.face, Math.atan2(tx, tz), Math.min(1, dt * 10));
      a.lean = spd > 0 ? 0.2 : 0;
    }
  }
  render(CR) {
    for (const a of this.list) {
      const y = -1.6 * (1 - a.rise) + Math.abs(Math.sin(a.t * 9)) * 0.06;
      const fade = a.life < 1 ? 1 - a.life : 0;
      CR.push('thrall', a.x, y, a.z, a.face, a.lean, 1 + a.sq, 1 - a.sq, 1 + a.sq, a.hitT, 0, 0, 0, 0, 0, Math.max(fade, a.rise < 1 ? (1 - a.rise) * 0.6 : 0));
    }
  }
  clear() { this.list.length = 0; }
}
