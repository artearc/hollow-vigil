import { icon } from './icons.js';
import { fmtTime, fmtNum } from '../core/util.js';
import { RELICS, ARCANA, ELEM } from '../game/data.js';

// In-run HUD. Built once; updated with cached writes so the DOM is touched only on change.
export class HUD {
  constructor(G, root) {
    this.G = G;
    const el = document.createElement('div'); el.id = 'hud'; el.hidden = true;
    el.innerHTML = `
      <div class="xp"><div class="fill"></div></div>
      <div class="lvl"><b data-k="lv">1</b><span>Level</span></div>
      <div class="clock"><div class="t" data-k="time">0:00</div><div class="phase" data-k="phase"></div></div>
      <div class="tally"><div>${icon('kill', '#a59c8b')}<span data-k="kills">0</span></div><div class="g">${icon('gold', '#d9a84e')}<span data-k="gold">0</span></div></div>
      <div class="boss" hidden><div class="name"></div><div class="epi"></div><div class="bar"><u></u><i></i></div></div>
      <div class="vitals">
        <div class="hp"><u></u><i></i><em data-k="hp">100 / 100</em></div>
        <div class="abil"><span class="key">Space</span><div class="pip dash">${icon('dash', '#ece2cc')}<div class="cd"></div></div>
          <span class="key" style="margin-left:8px">E</span><div class="pip ult">${icon('ult', '#d9a84e')}<div class="cd"></div></div><span class="key ultname"></span></div>
      </div>
      <div class="loadout"><div class="slots w"></div><div class="slots r"></div></div>
      <div class="toasts"></div>
      <div class="flashv"></div>
      <div class="touchpad"><div class="stick" hidden><i></i></div></div>`;
    root.appendChild(el); this.el = el;
    this.q = (s) => el.querySelector(s);
    this.k = {}; el.querySelectorAll('[data-k]').forEach((n) => { this.k[n.dataset.k] = n; });
    this.cache = {};
    this.xpFill = this.q('.xp .fill'); this.hpI = this.q('.hp i'); this.hpU = this.q('.hp u'); this.hpBox = this.q('.hp');
    this.dashCd = this.q('.pip.dash .cd'); this.ultPip = this.q('.pip.ult'); this.ultCd = this.q('.pip.ult .cd');
    this.bossEl = this.q('.boss'); this.bossI = this.q('.boss .bar i'); this.bossU = this.q('.boss .bar u');
    this.toasts = this.q('.toasts'); this.slotsW = this.q('.slots.w'); this.slotsR = this.q('.slots.r');
    this.stick = this.q('.stick');
    G.input.stickEl = this.stick;
    G.bus.on('toast', (a, b) => this.toast(a, b));
    G.bus.on('synergy', (name) => this.toast(`Synergy · ${name}`, null, 'syn'));
    G.bus.on('bossSpawn', (b) => { this.toast(b.name, b.epithet); this.showBoss(b); });
    G.bus.on('eliteSpawn', () => { if (G.time > 5) this.toast('An Elite Approaches', 'It carries a reliquary.', 'syn'); });
    G.bus.on('shrineNear', (s) => this.toast(s.name, s.desc, 'syn'));
    this.loadoutSig = '';
  }
  set(key, v) { if (this.cache[key] !== v) { this.cache[key] = v; this.k[key].textContent = v; } }
  toast(title, sub, cls = '') {
    if (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    const d = document.createElement('div'); d.className = 'toast ' + cls;
    d.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    this.toasts.appendChild(d); setTimeout(() => d.remove(), 3300);
  }
  showBoss(b) {
    this.boss = b; this.bossEl.hidden = false;
    this.q('.boss .name').textContent = b.name; this.q('.boss .epi').textContent = b.epithet;
    this.q('.boss .bar').querySelectorAll('.ph').forEach((n) => n.remove());
    for (const p of b.phases) { const m = document.createElement('div'); m.className = 'ph'; m.style.left = `${p * 100}%`; this.q('.boss .bar').appendChild(m); }
  }
  flash(color = 'rgba(255,230,180,.5)') {
    const f = this.q('.flashv'); f.style.background = `radial-gradient(ellipse at center, transparent 30%, ${color})`;
    f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' });
  }
  update() {
    const G = this.G, P = G.player, R = G.run;
    this.set('lv', String(P.level));
    this.set('time', fmtTime(G.time));
    this.set('phase', G.director.phase);
    this.set('kills', fmtNum(R.kills));
    this.set('gold', fmtNum(R.gold));
    this.set('hp', `${Math.ceil(P.hp)} / ${P.maxHp}`);
    const xpw = `${(P.xp / P.need) * 100}%`; if (this.cache.xpw !== xpw) { this.cache.xpw = xpw; this.xpFill.style.width = xpw; }
    const hpw = `${(P.hp / P.maxHp) * 100}%`; if (this.cache.hpw !== hpw) { this.cache.hpw = hpw; this.hpI.style.width = hpw; this.hpU.style.width = hpw; }
    const low = P.hp / P.maxHp < 0.3; if (this.cache.low !== low) { this.cache.low = low; this.hpBox.classList.toggle('low', low); }
    this.dashCd.style.transform = `scaleY(${P.dashCd / P.dashMax})`;
    const uk = Math.min(1, P.ult / P.ultMax); this.ultCd.style.transform = `scaleY(${1 - uk})`;
    const ready = uk >= 1; if (this.cache.ult !== ready) { this.cache.ult = ready; this.ultPip.classList.toggle('ready', ready); }
    // boss bar
    const b = G.enemies.bossList[0];
    if (b && !b.dying) { if (this.boss !== b.boss) this.showBoss(b.boss); const w = `${Math.max(0, b.hp / b.maxHp) * 100}%`; this.bossI.style.width = w; this.bossU.style.width = w; }
    else if (!this.bossEl.hidden && (!b || b.dying)) { this.bossEl.hidden = true; this.boss = null; }
    // loadout (rebuild only when composition changes)
    const sig = G.weapons.owned.map((w) => w.id + w.level + w.evo).join() + '|' + [...P.relics].map(([k, v]) => k + v).join() + [...P.arcana].join();
    if (sig !== this.loadoutSig) { this.loadoutSig = sig; this.buildLoadout(); }
    let i = 0;
    for (const w of G.weapons.owned) { const m = this.cdMasks[i++]; if (m) m.style.height = `${Math.max(0, Math.min(1, w.cd / (w.cdMax || 1))) * 100}%`; }
  }
  buildLoadout() {
    const G = this.G, P = G.player;
    const ws = G.weapons.owned.map((w) => `<div class="slot ${w.evo ? 'evo' : ''}" title="${w.evo ? w.def.evo.name : w.def.name}"><div class="cdm"></div>${icon(w.def.icon, ELEM[w.def.elem].ui)}<span class="lv">${w.evo ? '✦' : w.level}</span></div>`);
    while (ws.length < 6) ws.push('<div class="slot empty"></div>');
    this.slotsW.innerHTML = ws.join('');
    const rs = [...P.relics].map(([id, lv]) => `<div class="slot small" title="${RELICS[id].name}">${icon(RELICS[id].icon, '#d9a84e')}<span class="lv">${lv}</span></div>`);
    for (const a of P.arcana) rs.push(`<div class="slot small evo" title="${ARCANA[a].name}">${icon(ARCANA[a].icon, '#ffd27a')}</div>`);
    while (rs.length < 6) rs.push('<div class="slot small empty"></div>');
    this.slotsR.innerHTML = rs.join('');
    this.cdMasks = [...this.slotsW.querySelectorAll('.cdm')];
    this.q('.ultname').textContent = P.char.ult.name;
  }
  show(on) { this.el.hidden = !on; }
}
