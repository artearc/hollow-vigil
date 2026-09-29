import { rand, TAU, chance } from '../core/util.js';
import { DECAL } from '../render/textures.js';

// The damage pipeline. Every hit in the game flows through damage(), which is where
// elements, statuses and arcana interact: this is the synergy engine.
export class Combat {
  constructor(G) { this.G = G; this.hazards = []; this.synCd = {}; }
  get S() { return this.G.player.S; }
  arc(id) { return this.G.player.arcana.has(id); }
  synergy(name) {
    const t = this.G.time;
    if ((this.synCd[name] || 0) > t) return;
    this.synCd[name] = t + 12;
    this.G.bus.emit('synergy', name);
  }

  damage(e, amt, elem = 'physical', o = {}) {
    if (!e.alive || e.dying || e.hidden || (e.boss && e.boss.invuln)) return 0;
    const G = this.G, S = this.S, P = G.player, fx = G.fx;
    let d = amt * S.might;
    if (this.arc('hemomancy') && P.hp < P.maxHp * 0.5) d *= 1.45;
    if (elem === 'blood') d *= 1 + (1 - P.hp / P.maxHp) * 1.2; // blood magic grows as you bleed
    if (e.curseT > 0) d *= 1.25;
    let tag = null;
    // ——— element / status interactions ———
    if (e.freezeT > 0 && o.kinetic) {
      const sh = this.arc('shatter');
      d *= sh ? 3.5 : 1.8; e.freezeT = 0; tag = 'SHATTER';
      fx.shards(e.x, e.z, sh ? 22 : 10); G.audio.play('ice_shatter');
      if (sh) { this.synergy('Shatterpoint'); this.area(e.x, e.z, 2.8, amt * 0.9, 'ice', { chill: 2, exclude: e, src: o.src }); fx.decals.add(e.x, e.z, 3, DECAL.FROST, 0.2, 0.35, 0.5, 0.6, 5); }
    }
    if (elem === 'fire' && e.freezeT > 0 && this.arc('thermal')) {
      e.freezeT = 0; d *= 2.2; tag = 'THERMAL SHOCK';
      fx.explosion(e.x, e.z, 3, 'ice'); fx.smokePuff(e.x, e.z, 14, 2.4, 0.5, 1.6, 2);
      this.area(e.x, e.z, 3.2, amt * 1.6, 'fire', { wet: 5, exclude: e, src: o.src }); this.synergy('Thermal Heresy');
    }
    if (elem === 'holy' && e.curseT > 0 && this.arc('consecrate')) {
      d *= 2; e.curseT = 0; tag = 'PURGED';
      fx.pillar(e.x, e.z, 'holy', 5, 0.8, 0.35); this.area(e.x, e.z, 2.4, amt, 'holy', { exclude: e, src: o.src, noChain: true }); this.synergy('Consecration');
    }
    if (elem === 'lightning' && e.burnT > 0 && this.arc('cinder') && !o.noChain) {
      e.burnT = 0; d *= 1.5; fx.explosion(e.x, e.z, 2.2, 'fire'); this.area(e.x, e.z, 2.6, amt * 0.8, 'fire', { burn: amt * 0.3, exclude: e, src: o.src, noChain: true }); this.synergy('Cinder Chain');
    }
    // bulwark shield blocks frontal projectiles
    if (e.def && e.def.role === 'shield' && o.dirx !== undefined && !e.freezeT) {
      const fx_ = Math.sin(e.shieldA), fz_ = Math.cos(e.shieldA);
      if (-(o.dirx * fx_ + o.dirz * fz_) > 0.45) { d *= 0.15; tag = (e.blockT || 0) < G.time ? 'BLOCKED' : null; e.blockT = G.time + 1.5; fx.sparks(e.x + fx_ * 0.7, 1.2, e.z + fz_ * 0.7, 'holy', 6, 9, fx_, fz_, 1.4); G.audio.play('enemy_hit', { pitch: 2.2, vol: 0.6 }); }
    }
    const crit = Math.random() < S.crit + (o.critBonus || 0);
    if (crit) d *= S.critMul;
    if (e.boss && e.boss.armor) d *= e.boss.armor;
    // flash strength by importance: area/quiet hits barely register, crits snap bright
    e.hp -= d; e.hitT = Math.max(e.hitT, crit ? 1 : o.quiet ? 0.25 : 0.6);
    const R = G.run; R.damage += d; if (o.src) R.dmgBy[o.src] = (R.dmgBy[o.src] || 0) + d;
    // knockback
    if (o.knock) {
      const kr = 1 - (e.def?.knockRes || 0) * (e.boss ? 1 : 1);
      const kx = o.kx !== undefined ? o.kx : e.x - P.x, kz = o.kz !== undefined ? o.kz : e.z - P.z; const l = Math.hypot(kx, kz) || 1;
      e.kx += (kx / l) * o.knock * kr; e.kz += (kz / l) * o.knock * kr;
      e.sq = Math.max(e.sq, 0.2);
    }
    // statuses
    const st = S.status;
    if (o.burn) { e.burnT = Math.max(e.burnT, 3 * st); e.burnDps = Math.max(e.burnDps, o.burn * S.might * st); }
    if (o.chill && !(e.boss && e.boss.noFreeze)) { e.chill += o.chill; e.chillT = 3; if (e.chill >= 5) { e.chill = 0; e.freezeT = (e.boss ? 0.4 : 1.8) * st; fx.glow.add(e.x, e.z, 2.2 * e.scale, DECAL.FROST, 0.3, 0.7, 1.2, 0.8, e.freezeT); G.audio.play('freeze', { vol: 0.6 }); } }
    if (o.freeze && !(e.boss && e.boss.noFreeze)) { e.freezeT = Math.max(e.freezeT, o.freeze * st); }
    if (o.curse) e.curseT = Math.max(e.curseT, o.curse * st);
    if (o.wet) e.wetT = Math.max(e.wetT, o.wet);
    if (o.bleed) e.bleedT = Math.max(e.bleedT, o.bleed);
    // feedback
    if (!o.quiet) {
      fx.hit(e.x, e.z, elem, o.dirx || 0, o.dirz || 0, crit);
      G.audio.play(crit ? 'enemy_hit_crit' : 'enemy_hit', { vol: crit ? 0.8 : 0.45, pitch: rand(0.9, 1.15) });
    }
    if (!o.quiet || crit || tag) G.floaters.add(e.x, (e.def?.height || 3) * e.scale + 0.3, e.z, d, crit, elem, tag);
    if (e.boss) e.boss.onHit && e.boss.onHit(d);
    if (e.hp <= 0) this.kill(e, elem, o.src);
    return d;
  }
  dot(e, amt, elem) { return this.damage(e, amt, elem, { quiet: true, src: elem === 'fire' ? 'burn' : undefined }); }
  area(x, z, r, amt, elem, o = {}) {
    const hits = [];
    this.G.enemies.inRadius(x, z, r, (e) => { if (e !== o.exclude && !e.dying) hits.push(e); });
    for (const e of hits) this.damage(e, amt, elem, { ...o, quiet: hits.length > 6 && Math.random() < 0.6, kx: e.x - x, kz: e.z - z });
    return hits.length;
  }

  kill(e, elem, src) {
    const G = this.G, fx = G.fx, R = G.run, P = G.player;
    if (e.dying) return;
    e.dying = 0.001; e.hitT = 0.8;
    if (e.tele) { fx.tele.release(e.tele); e.tele = null; }
    if (e.boss) { e.boss.die(); return; }
    R.kills++;
    const big = e.elite || e.def.mass >= 4;
    fx.death(e.x, e.z, e.def.soul, e.scale * (e.def.height > 2 ? 1.3 : 0.9), e.def.blood, e.elite);
    G.audio.play(big ? 'enemy_death_big' : 'enemy_death', { vol: big ? 0.9 : 0.5, pitch: rand(0.85, 1.15) });
    if (big) G.rr.addTrauma(e.elite ? 0.3 : 0.08);
    if (e.elite) G.hitstop(0.07); // a beat of stillness sells the kill
    // drops
    if (!e.noXp) G.pickups.gem(e.x, e.z, e.def.xp * (e.elite ? 12 : 1));
    if (chance(0.025 * (1 + P.S.luck)) || e.elite) G.pickups.gold(e.x + rand(-0.5, 0.5), e.z + rand(-0.5, 0.5), e.elite ? 25 : 1 + (Math.random() * 3 | 0));
    if (!R.vows.famine && chance(e.elite ? 0.5 : 0.0055)) G.pickups.heal(e.x, e.z);
    if (chance(0.0009 * (1 + P.S.luck))) G.pickups.special(e.x, e.z, chance(0.5) ? 'magnet' : 'censer');
    if (e.elite) { G.pickups.chest(e.x, e.z); }
    P.ult = Math.min(P.ultMax, P.ult + (e.elite ? 12 : e.def.xp));
    // ——— death synergies ———
    if (e.burnT > 0 && this.arc('wildfire')) {
      let n = 0;
      G.enemies.inRadius(e.x, e.z, 3.2, (o) => { if (o !== e && !o.dying && n < 6) { n++; o.burnT = Math.max(o.burnT, 3); o.burnDps = Math.max(o.burnDps, e.burnDps); } });
      fx.explosion(e.x, e.z, 1.6, 'fire'); this.area(e.x, e.z, 2.2, e.burnDps * 1.2 / P.S.might, 'fire', { exclude: e, src: 'burn' });
      if (n) this.synergy('Wildfire Litany');
    }
    if (e.curseT > 0 && this.arc('contagion')) {
      fx.explosion(e.x, e.z, 2.4, 'shadow'); this.area(e.x, e.z, 2.8, 10 * (1 + G.time / 300), 'shadow', { curse: 5, exclude: e, src: 'hex' }); this.synergy('Hex Contagion');
    }
    if (e.curseT > 0 && this.arc('gravebound')) { G.allies.raise(e.x, e.z, 'gravebound'); this.synergy('Gravebound'); }
    if (this.arc('hemomancy')) P.heal(1, true);
    if (e.def.role === 'bloat') this.delayedBlast(e.x, e.z, 2.8 * e.scale, 0.6, e.dmg * 1.4, 'necro');
    G.bus.emit('kill', e, src);
  }

  // Ground hazards that hurt the player after a readable telegraph.
  delayedBlast(x, z, r, delay, dmg, elem = 'fire', o = {}) {
    const G = this.G;
    const h = { x, z, r, t: delay, dmg, elem, tele: G.fx.tele.circle(x, z, r, delay, o.col || 0xff3b2f), o };
    this.hazards.push(h); return h;
  }
  update(dt) {
    const G = this.G, P = G.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]; h.t -= dt;
      if (h.t <= 0) {
        if ((P.x - h.x) ** 2 + (P.z - h.z) ** 2 < (h.r + P.r * 0.5) ** 2) P.hurt(h.dmg, null);
        G.fx.explosion(h.x, h.z, h.r * 0.8, h.elem, h.o.big);
        if (h.o.decal !== false) G.fx.groundCrack(h.x, h.z, h.r * 2);
        if (h.o.onBlast) h.o.onBlast(h);
        G.audio.play(h.o.sfx || 'fire_explode', { vol: 0.6 });
        this.hazards[i] = this.hazards[this.hazards.length - 1]; this.hazards.pop();
      }
    }
  }
  clear() { this.hazards.length = 0; }
}
