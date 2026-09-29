import { WEAPONS } from './weapons.js';
import { RELICS, ARCANA, ELEM } from './data.js';
import { weightedPick } from '../core/util.js';

// Level-up offers. Offers favour what you already own (build coherence) while keeping
// fresh options in view; arcana appear only when their synergy prerequisites are met.
export const RARITY = {
  common: { label: 'Common', levels: 1 },
  rare: { label: 'Blessed', levels: 2 },
  epic: { label: 'Hallowed', levels: 3 },
  arcana: { label: 'Arcana', levels: 1 },
  evo: { label: 'Evolution', levels: 1 },
};
const MAX_SLOTS = 6;

export function buildView(G) {
  const W = G.weapons, P = G.player;
  return { has: (id) => W.has(id), hasRelic: (id) => P.relics.has(id) };
}

export function rollOffers(G, n = 3, o = {}) {
  const W = G.weapons, P = G.player, R = G.run, save = G.save;
  const pool = [];
  const unlockedW = (id) => !['choir', 'thorns', 'hex'].includes(id) || save.unlocked.weapons.includes(id) || P.char.weapon === id;
  for (const id in WEAPONS) {
    if (R.banished.has(id)) continue;
    const w = W.get(id);
    if (w) { if (w.level < w.def.max) pool.push({ type: 'weapon', id, w: 1.3 }); }
    else if (W.owned.length < MAX_SLOTS && unlockedW(id)) pool.push({ type: 'weapon', id, w: 0.85 });
  }
  for (const id in RELICS) {
    if (R.banished.has(id)) continue;
    const lv = P.relicLevel(id);
    if (lv) { if (lv < RELICS[id].max) pool.push({ type: 'relic', id, w: 1 }); }
    else if (P.relics.size < MAX_SLOTS) pool.push({ type: 'relic', id, w: 0.75 * (RELICS[id].evolves && W.has(RELICS[id].evolves) ? 1.8 : 1) });
  }
  if (!o.noArcana) {
    const view = buildView(G);
    for (const id in ARCANA) if (!P.arcana.has(id) && !R.banished.has(id) && ARCANA[id].req(view)) pool.push({ type: 'arcana', id, w: ARCANA[id].risk ? 0.12 : 0.32 });
  }
  const out = [];
  let arcanaCount = 0;
  while (out.length < n && pool.length) {
    const it = weightedPick(pool, (p) => (p.type === 'arcana' && arcanaCount >= 1 ? 0 : p.w));
    if (!it || (it.type === 'arcana' && arcanaCount >= 1)) { pool.splice(pool.indexOf(it), 1); continue; }
    pool.splice(pool.indexOf(it), 1);
    if (it.type === 'arcana') arcanaCount++;
    out.push(describe(G, it, o.minRarity));
  }
  if (!out.length) {
    out.push({ type: 'gold', id: 'gold', rarity: 'common', title: 'A Tithe of Gold', tag: 'Offering', desc: 'Gain <b>60</b> tithe.', icon: 'gold', color: '#d9a84e' });
    out.push({ type: 'heal', id: 'heal', rarity: 'common', title: 'Sacrament', tag: 'Offering', desc: 'Restore <b>40</b> health.', icon: 'heart', color: '#ff3552' });
  }
  return out;
}

function rollRarity(G, minRarity) {
  const luck = G.player.S.luck; const r = Math.random();
  let rar = r < 0.035 + luck * 0.06 ? 'epic' : r < 0.16 + luck * 0.2 ? 'rare' : 'common';
  if (minRarity === 'rare' && rar === 'common') rar = 'rare';
  return rar;
}

export function describe(G, it, minRarity) {
  const W = G.weapons, P = G.player;
  if (it.type === 'weapon') {
    const def = WEAPONS[it.id], w = W.get(it.id), cur = w ? w.level : 0;
    let rar = rollRarity(G, minRarity); let lv = Math.min(RARITY[rar].levels, def.max - cur);
    if (lv < RARITY[rar].levels) rar = lv >= 3 ? 'epic' : lv === 2 ? 'rare' : 'common';
    const lines = [];
    // ups[i] describes Lv i+1 → i+2
    for (let k = 0; k < lv; k++) lines.push(`<b>Lv ${cur + k + 1}</b> — ${def.ups[cur + k - 1] || ''}`);
    const evoNote = def.evo ? `Evolves with <b>${RELICS[def.evo.relic].name}</b>.` : '';
    return { ...it, rarity: rar, levels: lv, title: def.name, tag: w ? `${ELEM[def.elem].name} · Level ${cur} → ${cur + lv}` : `New · ${ELEM[def.elem].name}`, desc: (w ? lines.join('<br>') : def.desc + (lv > 1 ? `<br><b>Starts at level ${lv}</b>` : '')), lore: def.lore, sub: evoNote, icon: def.icon, color: ELEM[def.elem].ui };
  }
  if (it.type === 'relic') {
    const def = RELICS[it.id], cur = P.relicLevel(it.id);
    let rar = rollRarity(G, minRarity); const lv = Math.min(RARITY[rar].levels, def.max - cur);
    if (lv < RARITY[rar].levels) rar = lv >= 3 ? 'epic' : lv === 2 ? 'rare' : 'common';
    const evoNote = def.evolves ? `Key to <b>${WEAPONS[def.evolves].evo.name}</b>.` : '';
    return { ...it, rarity: rar, levels: lv, title: def.name, tag: cur ? `Relic · Level ${cur} → ${cur + lv}` : 'New Relic', desc: def.desc(cur + lv), lore: def.lore, sub: evoNote, icon: def.icon, color: '#d9a84e' };
  }
  const def = ARCANA[it.id];
  return { ...it, rarity: 'arcana', levels: 1, title: def.name, tag: def.risk ? 'Covenant · Risk' : `Arcana · ${ELEM[def.elem].name}`, desc: def.desc, lore: def.lore, icon: def.icon, color: ELEM[def.elem].ui };
}

export function applyOffer(G, off) {
  const W = G.weapons, P = G.player;
  if (off.type === 'weapon') {
    let w = W.get(off.id);
    if (!w) { w = W.add(off.id); w.level = off.levels; }
    else w.level = Math.min(w.def.max, w.level + off.levels);
  } else if (off.type === 'relic') {
    P.relics.set(off.id, Math.min(RELICS[off.id].max, P.relicLevel(off.id) + off.levels));
  } else if (off.type === 'arcana') {
    P.arcana.add(off.id); G.bus.emit('arcana', off.id);
  } else if (off.type === 'gold') G.run.gold += 60;
  else if (off.type === 'heal') P.heal(40);
  P.recompute();
}

export function evolvable(G) {
  return G.weapons.owned.filter((w) => !w.evo && w.level >= w.def.max && w.def.evo && G.player.relics.has(w.def.evo.relic));
}
