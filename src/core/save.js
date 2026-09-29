// Meta-progression persistence. Browser storage may be unavailable; the game then keeps
// progress in memory for the session.
const KEY = 'hollow-vigil-save-v1';
const fresh = () => ({
  gold: 0,
  meta: {},                 // sanctum upgrade id -> rank
  unlocked: { chars: ['penitent'], weapons: [], maps: ['nave'] },
  stats: { runs: 0, kills: 0, bestTime: 0, bossKills: {}, wins: 0, maxLevel: 0, evolutions: 0 },
  achieved: [],
  settings: { shake: 1, numbers: true, volume: 0.8, music: 0.6 },
  last: { char: 'penitent', map: 'nave', vows: [] },
});
let mem = null;
export function loadSave() {
  if (mem) return mem;
  let s = null;
  try { const raw = localStorage.getItem(KEY); if (raw) s = JSON.parse(raw); } catch (e) { s = null; }
  const base = fresh();
  if (s && typeof s === 'object') {
    mem = { ...base, ...s, unlocked: { ...base.unlocked, ...(s.unlocked || {}) }, stats: { ...base.stats, ...(s.stats || {}) }, settings: { ...base.settings, ...(s.settings || {}) }, last: { ...base.last, ...(s.last || {}) } };
  } else mem = base;
  return mem;
}
export function writeSave() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* storage blocked: keep in memory */ }
}
export function resetSave() { mem = fresh(); writeSave(); return mem; }
