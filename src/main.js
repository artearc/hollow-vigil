import { Renderer } from './render/renderer.js';
import { VFX } from './render/vfx.js';
import { Bus } from './core/bus.js';
import { Input } from './core/input.js';
import { loadSave, writeSave } from './core/save.js';
import { rand, clamp, damp } from './core/util.js';
import { createAudio } from './audio/audio.js';
import { World } from './world/world.js';
import { Player } from './game/player.js';
import { Enemies, CreatureRenderer } from './game/enemies.js';
import { Weapons } from './game/weapons.js';
import { Allies } from './game/allies.js';
import { Pickups } from './game/pickups.js';
import { Combat } from './game/combat.js';
import { Director } from './game/director.js';
import { Shrines } from './game/shrines.js';
import { rollOffers, applyOffer, evolvable } from './game/upgrades.js';
import { CHARACTERS, MAPS, VOWS, RUN_LENGTH } from './game/data.js';
import { Floaters } from './ui/floaters.js';
import { HUD } from './ui/hud.js';
import { Screens } from './ui/screens.js';

// The Game object (G) is the shared context every system receives.
class Game {
  constructor() {
    const app = document.getElementById('app');
    this.bus = new Bus();
    this.save = loadSave();
    this.rr = new Renderer(app);
    this.scene = this.rr.scene;
    this.fx = new VFX(this.scene, this.rr);
    this.input = new Input(app);
    this.audio = createAudio();
    this.floaters = new Floaters(this, app);
    this.CR = new CreatureRenderer(this.scene);
    this.screens = new Screens(this, document.getElementById('screens'));
    this.state = 'title'; this.time = 0; this.real = 0; this.timeScale = 1; this.hitstopT = 0; this.slowT = 0; this.slowScale = 1;
    this.levelQueue = []; this.arena = null; this.frameAvg = 16;
    const unlock = () => { this.audio.unlock(); this.applySettings(); };
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
    this.wireAudio();
    this.applySettings();
    this.enterTitle();
    document.getElementById('boot')?.remove();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }
  applySettings() {
    const s = this.save.settings;
    this.audio.setMasterVolume(s.volume); this.audio.setMusicVolume(s.music);
    this.rr.shakeScale = s.shake; this.floaters.enabled = s.numbers;
  }
  wireAudio() {
    const b = this.bus, A = this.audio;
    b.on('bossSpawn', (boss) => { A.play('boss_spawn'); A.setBossMode(true); this.hud.flash('rgba(120,20,40,.55)'); });
    b.on('bossPhase', () => A.play('boss_phase'));
    b.on('bossDeath', (boss) => {
      A.setBossMode(false);
      this.save.stats.bossKills[boss.id] = (this.save.stats.bossKills[boss.id] || 0) + 1;
      this.run.bosses.push(boss.id);
      if (boss.id === 'saint') this.winAt = this.real + 3.5; // resolved in step() once no menu is open
    });
    b.on('eliteSpawn', () => A.play('elite_spawn', { vol: 0.6 }));
    b.on('chestDrop', () => A.play('elite_spawn', { vol: 0.4, pitch: 1.5 }));
    b.on('arcana', () => A.play('evolution', { vol: 0.6 }));
    b.on('synergy', () => A.play('shrine_activate', { vol: 0.35, pitch: 1.3 }));
    b.on('chestOpen', () => this.openChest());
    b.on('playerDeath', () => this.onDeath());
  }

  // ——— title / attract ———
  enterTitle() {
    this.teardown();
    this.state = 'title';
    const map = this.save.last.map && this.save.unlocked.maps.includes(this.save.last.map) ? this.save.last.map : 'nave';
    this.mapId = map; this.world = new World(this, map);
    this.rr.U.uTint.value.setRGB(...MAPS[map].grade);
    this.rr.distTarget = 40; this.rr.dist = 40;
    this.hud?.show(false);
    this.screens.title();
    this.audio.startMusic(map); this.audio.setMusicIntensity(0); this.audio.setPaused(false);
  }
  teardown() {
    this.fx.clear(); this.floaters.clear();
    if (this.world) this.world.dispose();
    if (this.player) this.player.dispose();
    this.enemies?.clear(); this.pickups?.clear(); this.weapons?.clear(); this.allies?.clear(); this.combat?.clear();
    this.world = null; this.player = null; this.arena = null;
    this.scene.fog && (this.scene.fog.density = 0.017);
  }

  // ——— run lifecycle ———
  startRun(charId, mapId, vows) {
    this.teardown();
    this.screens.hide();
    this.mapId = mapId; this.time = 0; this.levelQueue = []; this.timeScale = 1; this.hitstopT = 0; this.slowT = 0; this.winAt = 0; this.deathAt = 0;
    const vowSet = {}; for (const v of vows) vowSet[v] = true;
    this.world = new World(this, mapId);
    if (vowSet.eclipse) this.scene.fog.density *= 1.6;
    this.rr.U.uTint.value.setRGB(...MAPS[mapId].grade);
    this.player = new Player(this, charId, this.save);
    const S = this.player.S;
    this.run = { kills: 0, gold: 0, damage: 0, damageTaken: 0, dmgBy: {}, vows: vowSet, goldMul: 1, rerolls: S.rerolls, banish: S.banish, banished: new Set(), enemyHpMul: 1, enemyDmgMul: 1, enemySpeedMul: 1, shrines: 0, bosses: [] };
    this.enemies = new Enemies(this);
    this.weapons = new Weapons(this);
    this.allies = this.allies || new Allies(this);
    this.pickups = this.pickups || new Pickups(this);
    this.combat = new Combat(this);
    this.director = new Director(this);
    this.shrines = new Shrines(this);
    if (!this.hud) this.hud = new HUD(this, document.getElementById('app'));
    this.hud.show(true); this.hud.loadoutSig = ''; this.hud.bossEl.hidden = true;
    this.weapons.add(this.player.char.weapon);
    this.player.recompute();
    this.rr.dist = 26; this.rr.distTarget = 34; this.rr.follow(this.player.x, this.player.z, 0, 0, 0.016, 0, true);
    this.state = 'run';
    this.audio.startMusic(mapId); this.audio.setBossMode(false); this.audio.setPaused(false);
    this.save.stats.runs++; writeSave();
    this.fx.levelUp(this.player.x, this.player.z);
    this.bus.emit('toast', MAPS[mapId].name, MAPS[mapId].desc);
  }
  hitstop(d) { this.hitstopT = Math.max(this.hitstopT, d); }
  slowmo(scale, dur) { this.slowScale = scale; this.slowT = dur; }
  queueLevelUp(opts) { this.levelQueue.push(opts); }

  openLevelUp(opts = {}) {
    this.state = 'levelup'; this.audio.setPaused(true);
    if (!opts.special) { this.audio.play('level_up'); this.fx.levelUp(this.player.x, this.player.z); this.hud.flash('rgba(255,220,150,.45)'); this.rr.flash = 0.25; }
    const offers = rollOffers(this, 3 + (Math.random() < this.player.S.luck ? 1 : 0), opts);
    this.screens.levelUp(offers, opts, (res) => {
      if (res.reroll) { this.openLevelUp({ ...opts, special: true }); return; }
      if (!res.skip) applyOffer(this, res);
      this.screens.hide(); this.state = 'run'; this.audio.setPaused(false);
      // brief grace so the player can re-read the field
      this.player.iframes = Math.max(this.player.iframes, 0.6);
    });
  }
  openChest() {
    this.state = 'chest'; this.audio.setPaused(true); this.audio.play('chest_open');
    const gold = Math.round(rand(30, 60) * this.player.S.greed); this.run.gold += gold;
    const evo = evolvable(this)[0];
    let result;
    if (evo) {
      evo.evo = true; this.save.stats.evolutions++; this.audio.play('evolution');
      this.fx.levelUp(this.player.x, this.player.z); this.rr.flash = 0.6; this.rr.shock(this.player.x, this.player.z, 1.5);
      result = { evo, gold };
    } else {
      const n = Math.random() < 0.15 + this.player.S.luck ? 3 : 1;
      const gifts = [];
      for (let i = 0; i < n; i++) { const o = rollOffers(this, 1, { noArcana: true })[0]; if (o) { applyOffer(this, o); gifts.push(o); } }
      result = { gifts, gold };
    }
    this.screens.chest(result, () => { this.state = 'run'; this.audio.setPaused(false); this.player.iframes = Math.max(this.player.iframes, 0.6); });
  }
  togglePause() {
    if (this.state === 'run') {
      this.state = 'paused'; this.audio.setPaused(true);
      this.screens.pause(() => { this.screens.hide(); this.state = 'run'; this.audio.setPaused(false); this.input.pressed.clear(); }, () => this.finishRun(false, true));
    }
  }
  onDeath() {
    this.slowmo(0.2, 2.2); this.audio.play('defeat'); this.rr.distTarget = 22; this.hud.flash('rgba(160,10,30,.6)');
    this.fx.explosion(this.player.x, this.player.z, 4, 'blood', true);
    this.player.mesh.visible = false;
    this.deathAt = this.real + 2.6; // resolved in step(); cleared when a new run starts
  }
  finishRun(win, abandoned = false) {
    if (this.state === 'end') return;
    this.state = 'end'; this.audio.setPaused(true);
    if (win) this.audio.play('victory');
    const save = this.save, R = this.run, st = save.stats;
    let vowGold = 0; for (const v in R.vows) vowGold += VOWS[v].gold;
    const gold = Math.round((R.gold + R.kills * 0.06 + this.time / 8 + R.bosses.length * 60) * (1 + vowGold) * (abandoned ? 0.5 : 1));
    const before = { chars: [...save.unlocked.chars], maps: [...save.unlocked.maps] };
    save.gold += gold; st.kills += R.kills; st.bestTime = Math.max(st.bestTime, this.time); st.maxLevel = Math.max(st.maxLevel, this.player.level); if (win) st.wins++;
    const unlocks = [];
    for (const [id, c] of Object.entries(CHARACTERS)) if (c.unlock && !before.chars.includes(id) && c.unlock.test(save)) { save.unlocked.chars.push(id); unlocks.push(`${c.name} will keep the next vigil`); }
    for (const [id, m] of Object.entries(MAPS)) if (m.unlock && !before.maps.includes(id) && m.unlock.test(save)) { save.unlocked.maps.push(id); unlocks.push(`${m.name} is open to you`); }
    writeSave();
    this.hud.show(false);
    this.screens.end({ win, gold, unlocks }, () => this.startRun(save.last.char, save.last.map, save.last.vows), () => this.screens.sanctum(() => this.enterTitle()), () => this.enterTitle());
  }

  // ——— main loop ———
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = (now - this.last) / 1000; this.last = now;
    this.step(clamp(dt, 0, 1 / 20), true);
  }
  // Test hooks (also handy for tuning from the console).
  debugBuild(ids, level = 7, evo = false) {
    for (const id of ids) { const w = this.weapons.get(id) || this.weapons.add(id); w.level = level; w.evo = evo; }
    this.player.recompute();
  }
  // Advance the simulation deterministically (used for automated checks).
  sim(seconds, dt = 1 / 60) { const n = Math.round(seconds / dt); for (let i = 0; i < n; i++) this.step(dt, i === n - 1); }
  step(dt, draw) {
    this.real += dt;
    this.frameAvg = this.frameAvg * 0.95 + dt * 1000 * 0.05;
    this.fx.budget = clamp(this.fx.budget + (this.frameAvg > 22 ? -0.02 : this.frameAvg < 15 ? 0.01 : 0), 0.35, 1);
    const inp = this.input; inp.update();
    if (this.state === 'run' && inp.hit('escape', 'p')) this.togglePause();

    if (this.state === 'title') {
      const t = this.real * 0.06;
      const cx = Math.sin(t) * 14, cz = -34 + Math.cos(t * 0.7) * 30;
      this.rr.follow(cx, cz, 0, 0, dt, this.real);
      this.world.update(dt, this.real, cx, cz);
      this.fx.update(dt, this.real, this.rr.pxScale);
    } else if (this.player) {
      // time scale: hit-stop beats slow-mo beats normal
      if (this.slowT > 0) this.slowT -= dt;
      if (this.hitstopT > 0) this.hitstopT -= dt;
      this.timeScale = this.hitstopT > 0 ? 0.06 : this.slowT > 0 ? this.slowScale : 1;
      const active = this.state === 'run';
      const gdt = active ? dt * this.timeScale : 0;
      const P = this.player;
      if (active) {
        this.time += gdt;
        P.update(gdt, inp, this.real);
        if (this.arena) { const A = this.arena, dx = P.x - A.x, dz = P.z - A.z, d = Math.hypot(dx, dz); if (d > A.r - 0.6) { P.x = A.x + (dx / d) * (A.r - 0.6); P.z = A.z + (dz / d) * (A.r - 0.6); } }
        if (!P.dead) this.director.update(gdt);
        this.enemies.update(gdt, this.real);
        this.weapons.update(gdt, this.time);
        this.allies.update(gdt);
        this.combat.update(gdt);
        this.pickups.update(gdt, this.real);
        this.shrines.update(gdt, this.real);
        if (!P.dead && this.slowT <= 0 && this.state === 'run') {
          if (P.pending > 0) { P.pending--; this.openLevelUp(); }
          else if (this.levelQueue.length) this.openLevelUp({ ...this.levelQueue.shift(), special: true });
        }
        if (this.state === 'run' && this.winAt && this.real >= this.winAt) { this.winAt = 0; this.finishRun(true); }
      }
      if (this.deathAt && this.real >= this.deathAt && this.state !== 'end') { this.deathAt = 0; this.finishRun(false); }
      if (active) {
        if (!P.dead && this.time >= RUN_LENGTH && !this.overtimeWarned) { this.overtimeWarned = true; }
        const n = this.enemies.list.length;
        this.audio.setMusicIntensity(this.enemies.bossList.length ? 1 : clamp(n / 260, 0.1, 0.8));
      }
      this.world.update(gdt || dt * 0.2, this.real, P.x, P.z);
      this.rr.follow(P.x, P.z, P.vx, P.vz, dt, this.real);
      this.fx.rib.setView(this.rr.camera);
      this.fx.update(gdt, this.real, this.rr.pxScale);
      this.CR.begin(); this.enemies.render(this.CR, this.real); this.allies.render(this.CR); this.CR.end(this.real);
      this.pickups.render(this.real);
      this.hud.update();
      this.rr.U.uLow.value = damp(this.rr.U.uLow.value, P.hp / P.maxHp < 0.3 && !P.dead ? 1 : 0, 3, dt);
    }
    this.fx.rib.flush();
    this.world?.propMat.userData.uniforms && (this.world.propMat.userData.uniforms.uTime.value = this.real);
    if (draw) { this.floaters.update(this.state === 'run' ? dt * this.timeScale : 0); this.rr.render(); }
    inp.endFrame();
  }
}

window.__vigil = new Game();
