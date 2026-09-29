import { icon } from './icons.js';
import { CHARACTERS, MAPS, VOWS, META, RELICS, ARCANA, ELEM, WEAPON_UNLOCKS } from '../game/data.js';
import { WEAPONS } from '../game/weapons.js';
import { RARITY } from '../game/upgrades.js';
import { fmtTime, fmtNum } from '../core/util.js';
import { writeSave, resetSave } from '../core/save.js';

// All full-screen menus. Each screen is a <section>; only one is shown at a time.
export class Screens {
  constructor(G, root) {
    this.G = G; this.root = root; this.cur = null; this.keyHandler = null;
    addEventListener('keydown', (e) => { if (this.keyHandler) this.keyHandler(e); });
  }
  show(html, cls = 'veil', onKey = null) {
    this.hide();
    const s = document.createElement('section'); s.className = cls; s.innerHTML = html;
    this.root.appendChild(s); this.cur = s; this.keyHandler = onKey;
    s.querySelectorAll('button').forEach((b) => b.addEventListener('mouseenter', () => this.G.audio.play('ui_hover', { vol: 0.3 })));
    return s;
  }
  hide() { if (this.cur) { this.cur.remove(); this.cur = null; } this.keyHandler = null; }
  click(s, sel, fn) { s.querySelectorAll(sel).forEach((b) => b.addEventListener('click', (e) => { this.G.audio.play('ui_click', { vol: 0.5 }); fn(b, e); })); }
  gold() { return `<div class="purse">${icon('gold', '#d9a84e')}${fmtNum(this.G.save.gold)} <span class="hint" style="margin-left:6px">tithe</span></div>`; }

  title() {
    const s = this.show(`
      <div class="stack title">
        <div class="eyebrow">A vigil of ash and bells</div>
        <h1>Hollow Vigil</h1>
        <p class="sub">The cathedral drowned nine hundred years ago. Its candles never went out. Something kneels at the altar, and tonight it is waiting for you.</p>
        <div class="menu">
          <button class="mbtn" data-a="play" autofocus>Begin the Vigil</button>
          <button class="mbtn" data-a="sanctum">The Sanctum</button>
          <button class="mbtn" data-a="settings">Settings</button>
        </div>
      </div>
      <div class="foot">WASD / arrows to move · Space to dash · E for your rite · Esc to pause</div>`, 'veil-title');
    s.style.background = 'radial-gradient(ellipse at 50% 45%, rgba(6,5,9,.15), rgba(4,3,6,.85) 80%)';
    this.click(s, '[data-a=play]', () => this.select());
    this.click(s, '[data-a=sanctum]', () => this.sanctum(() => this.title()));
    this.click(s, '[data-a=settings]', () => this.settings(() => this.title()));
    s.querySelector('[data-a=play]').focus();
  }

  select() {
    const G = this.G, save = G.save;
    const L = save.last;
    const chars = Object.entries(CHARACTERS).map(([id, c]) => {
      const un = save.unlocked.chars.includes(id);
      if (!un && c.unlock && c.unlock.test(save)) { save.unlocked.chars.push(id); writeSave(); }
      const ok = save.unlocked.chars.includes(id);
      const w = WEAPONS[c.weapon];
      return `<button class="char ${L.char === id ? 'on' : ''} ${ok ? '' : 'locked'}" data-c="${id}">
        <div class="sig" style="color:${c.accent}">${icon(w.icon, c.accent)}</div>
        <div class="cls" style="color:${c.accent}">${c.cls}</div><h4>${c.name}</h4>
        <div class="cstats"><span>${c.hp} vigor</span><span>${c.speed.toFixed(1)} pace</span></div>
        <p>${ok ? c.desc : `${icon('lock')} ${c.unlock.text}.`}</p>
        <p style="color:var(--gold)">${ok ? `Rite: ${c.ult.name}` : `Or pay ${c.unlock.cost} tithe`}</p></button>`;
    }).join('');
    const maps = Object.entries(MAPS).map(([id, m]) => {
      const ok = save.unlocked.maps.includes(id) || (m.unlock && m.unlock.test(save) && (save.unlocked.maps.push(id), writeSave(), true));
      return `<button class="chip ${L.map === id ? 'on' : ''} ${ok ? '' : 'locked'}" data-m="${id}" title="${ok ? m.desc : m.unlock.text}">${ok ? '' : icon('lock')} ${m.name}</button>`;
    }).join('');
    const vows = Object.entries(VOWS).map(([id, v]) => `<button class="chip ${L.vows.includes(id) ? 'on' : ''}" data-v="${id}" title="${v.desc}">${v.name} <i>+${Math.round(v.gold * 100)}%</i></button>`).join('');
    const s = this.show(`
      <div class="stack">
        <h2 class="hdr">Choose Your Penitent<small>Who keeps the vigil tonight?</small></h2>
        <div class="chars">${chars}</div>
        <div class="opts">
          <div class="opt"><h5>Place of Vigil</h5>${maps}</div>
          <div class="opt"><h5>Vows · more tithe, more pain</h5>${vows}</div>
        </div>
        <div class="rowbtns"><button class="sbtn" data-a="back">Back</button><button class="sbtn prim" data-a="go">Light the Candle</button></div>
        ${this.gold()}
      </div>`);
    this.click(s, '[data-c]', (b) => {
      const id = b.dataset.c, c = CHARACTERS[id];
      if (!save.unlocked.chars.includes(id)) {
        if (save.gold >= c.unlock.cost) { save.gold -= c.unlock.cost; save.unlocked.chars.push(id); writeSave(); G.audio.play('chest_open'); }
        else return;
      }
      L.char = id; writeSave(); this.select();
    });
    this.click(s, '[data-m]', (b) => {
      const id = b.dataset.m, m = MAPS[id];
      if (!save.unlocked.maps.includes(id)) { if (m.unlock && save.gold >= m.unlock.cost) { save.gold -= m.unlock.cost; save.unlocked.maps.push(id); writeSave(); } else return; }
      L.map = id; writeSave(); this.select();
    });
    this.click(s, '[data-v]', (b) => { const id = b.dataset.v; L.vows = L.vows.includes(id) ? L.vows.filter((v) => v !== id) : [...L.vows, id]; writeSave(); b.classList.toggle('on'); });
    this.click(s, '[data-a=back]', () => this.title());
    this.click(s, '[data-a=go]', () => G.startRun(L.char, L.map, L.vows));
  }

  card(o, i) {
    const rar = RARITY[o.rarity] || RARITY.common;
    return `<button class="card r-${o.rarity}" data-i="${i}">
      <div class="rar">${rar.label}${o.levels > 1 ? ` · +${o.levels} levels` : ''}</div>
      <div class="ic">${icon(o.icon, o.color)}</div>
      <h3>${o.title}</h3><div class="tag">${o.tag}</div>
      <p>${o.desc}</p>${o.sub ? `<p style="font-size:14px;color:var(--bone-dim)">${o.sub}</p>` : ''}
      ${o.lore ? `<p class="lore">${o.lore}</p>` : ''}</button>`;
  }
  levelUp(offers, opts, onPick) {
    const G = this.G, R = G.run;
    let banishMode = false;
    const s = this.show(`
      <div class="stack">
        <div class="eyebrow">${opts.eyebrow || `Level ${G.player.level}`}</div>
        <h2 class="hdr">${opts.title || 'Ascension'}<small>${opts.sub || 'The candles lean toward you. Choose a gift.'}</small></h2>
        <div class="cards">${offers.map((o, i) => this.card(o, i)).join('')}</div>
        <div class="rowbtns">
          <button class="sbtn" data-a="reroll" ${R.rerolls ? '' : 'disabled'}>Recant · ${R.rerolls}</button>
          <button class="sbtn" data-a="banish" ${R.banish ? '' : 'disabled'}>Anathema · ${R.banish}</button>
          <button class="sbtn" data-a="skip">Refuse · +25 tithe</button>
        </div>
        <div class="hint">Keys 1–${offers.length} to choose</div>
      </div>`, 'veil-soft', (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= offers.length) pick(n - 1); });
    const pick = (i) => {
      if (banishMode) { R.banished.add(offers[i].id); R.banish--; G.audio.play('reroll'); onPick({ reroll: true }); return; }
      G.audio.play('upgrade_select'); onPick(offers[i]);
    };
    this.click(s, '.card', (b) => pick(+b.dataset.i));
    s.querySelectorAll('.card').forEach((b) => b.addEventListener('mouseenter', () => G.audio.play('upgrade_hover', { vol: 0.4 })));
    this.click(s, '[data-a=reroll]', () => { if (R.rerolls > 0) { R.rerolls--; G.audio.play('reroll'); onPick({ reroll: true }); } });
    this.click(s, '[data-a=banish]', (b) => { if (R.banish > 0) { banishMode = !banishMode; b.classList.toggle('prim', banishMode); s.querySelector('.hint').textContent = banishMode ? 'Choose an offering to banish from this vigil' : 'Keys to choose'; } });
    this.click(s, '[data-a=skip]', () => { R.gold += 25; onPick({ skip: true }); });
  }
  chest(result, onDone) {
    const G = this.G;
    let body;
    if (result.evo) {
      const w = result.evo, def = w.def;
      body = `<div class="eyebrow" style="color:var(--ember)">Evolution</div>
        <h2 class="hdr">${def.evo.name}<small>${def.name} is reborn.</small></h2>
        <div class="cards">${this.card({ rarity: 'evo', levels: 1, title: def.evo.name, tag: `${ELEM[def.elem].name} · Evolved`, desc: def.evo.desc, lore: def.lore, icon: def.icon, color: ELEM[def.elem].ui }, 0)}</div>`;
    } else {
      body = `<div class="eyebrow">Reliquary</div><h2 class="hdr">The Reliquary Opens<small>Old bones, older gifts.</small></h2>
        <div class="cards">${result.gifts.map((o, i) => this.card(o, i)).join('')}</div>`;
    }
    const s = this.show(`<div class="stack">${body}<p class="unl">+${result.gold} tithe</p><div class="rowbtns"><button class="sbtn prim" data-a="ok">Take Them</button></div></div>`, 'veil-soft', (e) => { if (e.key === 'Enter' || e.key === ' ') done(); });
    const done = () => { this.hide(); onDone(); };
    this.click(s, '[data-a=ok]', done); this.click(s, '.card', done);
    setTimeout(() => s.querySelector('[data-a=ok]')?.focus(), 50);
  }
  buildBlock() {
    const G = this.G, P = G.player;
    const ws = G.weapons.owned.map((w) => `<div class="slot ${w.evo ? 'evo' : ''}" title="${w.def.name}">${icon(w.def.icon, ELEM[w.def.elem].ui)}<span class="lv">${w.evo ? '✦' : w.level}</span></div>`).join('');
    const rs = [...P.relics].map(([id, lv]) => `<div class="slot small" title="${RELICS[id].name}">${icon(RELICS[id].icon, '#d9a84e')}<span class="lv">${lv}</span></div>`).join('');
    const syn = [...P.arcana].map((a) => `<li><b>${ARCANA[a].name}.</b> ${ARCANA[a].desc}</li>`).join('') || '<li>No arcana yet. They appear when your gifts can speak to each other.</li>';
    const S = P.S;
    const stats = [['Might', `${Math.round(S.might * 100)}%`], ['Area', `${Math.round(S.area * 100)}%`], ['Cooldown', `−${Math.round(S.haste * 100)}%`], ['Critical', `${Math.round(S.crit * 100)}%`], ['Armor', S.armor], ['Regen', `${S.regen.toFixed(1)}/s`], ['Speed', P.speed.toFixed(1)], ['Magnet', P.magnetR.toFixed(1)], ['Growth', `${Math.round(S.growth * 100)}%`], ['Luck', `${Math.round(S.luck * 100)}%`]]
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    return `<div class="grid2">
      <div class="panel"><h5 class="hint" style="margin:0 0 8px">Arsenal & Relics</h5><div class="build">${ws}</div><div class="build" style="margin-top:6px">${rs}</div><ul class="syn">${syn}</ul></div>
      <div class="panel"><h5 class="hint" style="margin:0 0 8px">Attributes</h5><dl class="statlist">${stats}</dl></div></div>`;
  }
  pause(onResume, onQuit) {
    const G = this.G;
    const s = this.show(`<div class="stack"><div class="eyebrow">${fmtTime(G.time)} · ${G.director.phase}</div><h2 class="hdr">The Vigil Holds<small>Time waits, briefly.</small></h2>
      ${this.buildBlock()}
      <div class="rowbtns"><button class="sbtn prim" data-a="resume">Resume</button><button class="sbtn" data-a="settings">Settings</button><button class="sbtn" data-a="quit">Abandon the Vigil</button></div></div>`, 'veil-soft',
      (e) => { if (e.key === 'Escape' || e.key === 'p') { e.preventDefault(); onResume(); } });
    this.click(s, '[data-a=resume]', onResume);
    this.click(s, '[data-a=settings]', () => this.settings(() => this.pause(onResume, onQuit)));
    this.click(s, '[data-a=quit]', onQuit);
  }
  settings(back) {
    const G = this.G, st = G.save.settings;
    const s = this.show(`<div class="stack"><h2 class="hdr">Settings</h2>
      <div class="panel" style="min-width:min(420px,90vw)"><dl class="statlist" style="gap:12px 18px;font-size:15px">
        <dt><label for="s-vol">Volume</label></dt><dd><input id="s-vol" type="range" min="0" max="1" step="0.05" value="${st.volume}"></dd>
        <dt><label for="s-mus">Music</label></dt><dd><input id="s-mus" type="range" min="0" max="1" step="0.05" value="${st.music}"></dd>
        <dt><label for="s-shake">Screen shake</label></dt><dd><input id="s-shake" type="range" min="0" max="1.5" step="0.1" value="${st.shake}"></dd>
        <dt><label for="s-num">Damage numbers</label></dt><dd><input id="s-num" type="checkbox" ${st.numbers ? 'checked' : ''}></dd>
      </dl></div>
      <div class="rowbtns"><button class="sbtn prim" data-a="back">Done</button></div></div>`, 'veil-soft', (e) => { if (e.key === 'Escape') back(); });
    const upd = () => { st.volume = +s.querySelector('#s-vol').value; st.music = +s.querySelector('#s-mus').value; st.shake = +s.querySelector('#s-shake').value; st.numbers = s.querySelector('#s-num').checked; G.applySettings(); writeSave(); };
    s.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd));
    this.click(s, '[data-a=back]', back);
  }
  end(res, onAgain, onSanctum, onTitle) {
    const G = this.G, R = G.run;
    const src = Object.entries(R.dmgBy).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const top = src.length ? src[0][1] : 1;
    const name = (k) => (WEAPONS[k] ? (G.weapons.get(k)?.evo ? WEAPONS[k].evo.name : WEAPONS[k].name) : { burn: 'Burning', ult: 'Rite', censer: 'Censer of Wrath' }[k] || k);
    const elemOf = (k) => (WEAPONS[k] ? WEAPONS[k].elem : k === 'burn' ? 'fire' : 'holy');
    const rows = src.map(([k, v]) => `<div class="dmgrow">${icon(WEAPONS[k]?.icon || 'ult', ELEM[elemOf(k)].ui)}<div>${name(k)}<div class="dmgbar"><i style="width:${(v / top) * 100}%;background:${ELEM[elemOf(k)].ui}"></i></div></div><span>${fmtNum(v)}</span></div>`).join('');
    const unl = res.unlocks.map((u) => `<div class="unl">✦ ${u}</div>`).join('');
    const s = this.show(`<div class="stack">
      <div class="eyebrow" style="color:${res.win ? 'var(--gold)' : 'var(--blood-hot)'}">${res.win ? 'Victory' : 'Death'}</div>
      <h2 class="hdr">${res.win ? 'The Saint Is Silent' : 'The Candle Gutters'}<small>${res.win ? 'For the first time in nine hundred years, nothing kneels at the altar.' : `${G.player.char.name} fell during ${G.director.phase.toLowerCase()}.`}</small></h2>
      <div class="grid2">
        <div class="panel"><dl class="statlist" style="font-size:16px">
          <dt>Survived</dt><dd>${fmtTime(G.time)}</dd><dt>Level</dt><dd>${G.player.level}</dd><dt>Slain</dt><dd>${fmtNum(R.kills)}</dd>
          <dt>Damage dealt</dt><dd>${fmtNum(R.damage)}</dd><dt>Damage taken</dt><dd>${fmtNum(R.damageTaken)}</dd>
          <dt>Tithe gathered</dt><dd style="color:var(--gold)">+${fmtNum(res.gold)}</dd></dl>${unl}</div>
        <div class="panel"><h5 class="hint" style="margin:0 0 8px">Damage by source</h5>${rows || '<p class="hint">Nothing was harmed.</p>'}</div>
      </div>
      <div class="rowbtns"><button class="sbtn prim" data-a="again">Keep Another Vigil</button><button class="sbtn" data-a="sanctum">The Sanctum</button><button class="sbtn" data-a="title">Leave</button></div></div>`);
    this.click(s, '[data-a=again]', onAgain); this.click(s, '[data-a=sanctum]', onSanctum); this.click(s, '[data-a=title]', onTitle);
  }
  sanctum(back) {
    const G = this.G, save = G.save;
    const cost = (m, r) => Math.round(m.cost * Math.pow(1.6, r));
    const ups = META.map((m) => {
      const r = save.meta[m.id] || 0, max = r >= m.max, c = cost(m, r);
      return `<button class="up ${max ? 'max' : ''}" data-u="${m.id}"><h4>${m.name}<span>${r}/${m.max}</span></h4><p>${m.desc}</p>
        <div class="ranks">${Array.from({ length: m.max }, (_, i) => `<i class="${i < r ? 'f' : ''}"></i>`).join('')}</div>
        <div class="cost ${save.gold >= c ? '' : 'no'}">${max ? 'Complete' : `${c} tithe`}</div></button>`;
    }).join('');
    const wl = Object.entries(WEAPON_UNLOCKS).map(([id, u]) => {
      const has = save.unlocked.weapons.includes(id) || u.test(save);
      if (has && !save.unlocked.weapons.includes(id)) { save.unlocked.weapons.push(id); writeSave(); }
      return `<button class="up ${has ? 'max' : ''}" data-w="${id}"><h4>${WEAPONS[id].name}<span>${has ? 'Unlocked' : 'Sealed'}</span></h4><p>${has ? WEAPONS[id].desc : u.text + '.'}</p><div class="cost ${save.gold >= u.cost ? '' : 'no'}">${has ? 'In the offering pool' : `${u.cost} tithe`}</div></button>`;
    }).join('');
    const s = this.show(`<div class="stack"><h2 class="hdr">The Sanctum<small>What the dead leave behind, the living may spend.</small></h2>${this.gold()}
      <div class="shop">${ups}${wl}</div>
      <div class="rowbtns"><button class="sbtn prim" data-a="back">Return</button><button class="sbtn" data-a="reset">Forget Everything</button></div></div>`, 'veil', (e) => { if (e.key === 'Escape') back(); });
    this.click(s, '[data-u]', (b) => {
      const m = META.find((x) => x.id === b.dataset.u), r = save.meta[m.id] || 0, c = cost(m, r);
      if (r < m.max && save.gold >= c) { save.gold -= c; save.meta[m.id] = r + 1; writeSave(); G.audio.play('upgrade_select'); this.sanctum(back); }
    });
    this.click(s, '[data-w]', (b) => {
      const id = b.dataset.w, u = WEAPON_UNLOCKS[id];
      if (!save.unlocked.weapons.includes(id) && save.gold >= u.cost) { save.gold -= u.cost; save.unlocked.weapons.push(id); writeSave(); G.audio.play('chest_open'); this.sanctum(back); }
    });
    let armed = false;
    this.click(s, '[data-a=reset]', (b) => { if (!armed) { armed = true; b.textContent = 'Click again to erase all progress'; return; } G.save = resetSave(); this.sanctum(back); });
    this.click(s, '[data-a=back]', back);
  }
}
