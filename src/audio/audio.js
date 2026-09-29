// audio.js — fully procedural Web Audio engine (no external files).
// Occult cathedral palette: bells, breathy choir, ash & fire, glass ice, bone knocks.
//
// Usage:
//   const audio = createAudio();
//   window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
//   audio.play('enemy_hit', { vol: 1, pitch: 1, pan: 0 });
//
// Every API call is a safe no-op before unlock() or when Web Audio is unavailable.

const HAS_WIN = typeof window !== 'undefined';
const AC = HAS_WIN ? (window.AudioContext || window.webkitAudioContext) : null;
const OAC = HAS_WIN ? (window.OfflineAudioContext || window.webkitOfflineAudioContext) : null;

// id: [minGapSec, maxConcurrent, mixVol, pitchJitter]
const RATE = {
  fire_cast: [0.06, 3, 0.6, 0.04], fire_explode: [0.06, 4, 0.75, 0.05],
  ice_cast: [0.06, 3, 0.6, 0.03], ice_shatter: [0.05, 4, 0.6, 0.05], freeze: [0.15, 2, 0.7, 0.03],
  lightning: [0.05, 4, 0.6, 0.05], arcane_hit: [0.04, 4, 0.55, 0.05], scythe_swing: [0.08, 3, 0.7, 0.05],
  blood_spike: [0.05, 4, 0.7, 0.05], holy_pulse: [0.2, 2, 0.8, 0.01], hex_cast: [0.1, 3, 0.7, 0.03],
  necro_raise: [0.15, 3, 0.75, 0.03], summon_attack: [0.05, 4, 0.5, 0.06],
  enemy_hit: [0.035, 6, 0.45, 0.06], enemy_hit_crit: [0.05, 4, 0.6, 0.05],
  enemy_death: [0.03, 6, 0.55, 0.07], enemy_death_big: [0.1, 3, 0.8, 0.04],
  elite_spawn: [0.3, 2, 0.9, 0.01], enemy_shoot: [0.05, 4, 0.45, 0.06], worm_emerge: [0.2, 3, 0.8, 0.04],
  slam_warn: [0.15, 3, 0.8, 0.02], slam: [0.1, 3, 0.85, 0.04],
  xp_pickup: [0.025, 6, 0.5, 0.015], gold_pickup: [0.04, 4, 0.55, 0.04], chest_open: [0.3, 1, 0.9, 0.01],
  heal: [0.25, 2, 0.8, 0.01],
  level_up: [0.5, 1, 1, 0], upgrade_hover: [0.04, 2, 0.7, 0.03], upgrade_select: [0.1, 2, 0.9, 0.01],
  evolution: [1, 1, 1, 0], reroll: [0.1, 2, 0.8, 0.03],
  player_hurt: [0.12, 2, 0.9, 0.04], player_dash: [0.1, 2, 0.7, 0.05], ultimate: [0.5, 1, 1, 0],
  boss_spawn: [1, 1, 1, 0], boss_phase: [0.8, 1, 1, 0], boss_attack_warn: [0.3, 2, 0.9, 0.01],
  boss_death: [2, 1, 1, 0], bell_toll: [0.3, 3, 0.9, 0.005], shrine_activate: [0.5, 1, 0.9, 0],
  ui_click: [0.03, 3, 0.7, 0.03], ui_hover: [0.03, 2, 0.6, 0.03], victory: [2, 1, 1, 0], defeat: [2, 1, 1, 0],
};
const LOW_PRIO = new Set(['enemy_hit', 'xp_pickup', 'enemy_death', 'summon_attack', 'enemy_shoot',
  'gold_pickup', 'arcane_hit', 'ui_hover', 'upgrade_hover', 'fire_cast', 'ice_cast']);
const MAX_VOICES = 56;
// Pre-rendered (OfflineAudioContext) high-frequency sounds: id -> [variants, lengthSec]
const PRE = {
  enemy_hit: [4, 0.18], enemy_hit_crit: [2, 0.3], enemy_death: [3, 0.34], xp_pickup: [1, 0.2],
  gold_pickup: [2, 0.3], summon_attack: [2, 0.16], enemy_shoot: [2, 0.14],
  ui_hover: [1, 0.06], upgrade_hover: [1, 0.08], ui_click: [1, 0.1],
};

const MAPS = {
  nave: {
    kind: 'nave', bpm: 54, root: 73.42, padRoot: 146.83, motifRoot: 587.33, vowel: 0,
    scale: [0, 3, 5, 7, 10, 12, 15],
    prog: [[0, 7, 12, 15], [-4, 3, 8, 12], [-7, 0, 5, 8], [-5, 2, 7, 10]],
    drone: [['sawtooth', 1, -5, 0.16], ['sawtooth', 1, 6, 0.16], ['sawtooth', 1.5, 3, 0.09], ['sine', 0.5, 0, 0.35], ['square', 2, 0, 0.025]],
    motifs: [[[0, 4], [1.5, 3], [2, 2], [4, 1], [6, 0]], [[0, 2], [1, 3], [2, 4], [3, 5], [5, 3], [6.5, 2]],
      [[0, 6], [2, 4], [3, 3], [4, 4], [6, 0]], [[0, 0], [0.5, 2], [1, 4], [4, 3], [5, 1]]],
  },
  thornwood: {
    kind: 'thornwood', bpm: 62, root: 82.41, padRoot: 164.81, motifRoot: 659.26, vowel: 1,
    scale: [0, 1, 3, 7, 8, 12, 13],
    prog: [[0, 7, 12, 15], [1, 8, 13, 17], [-2, 2, 5, 10], [0, 7, 12, 15]],
    drone: [['sawtooth', 1, -4, 0.18], ['sawtooth', 1.498, 5, 0.09], ['triangle', 0.5, 0, 0.4], ['sawtooth', 2, 9, 0.035]],
    motifs: [[[0, 3], [1, 1], [1.5, 0], [4, 2], [5, 1]], [[0, 5], [0.5, 4], [1, 3], [3, 1], [6, 0]],
      [[0, 0], [1, 1], [2, 3], [2.5, 4], [4, 6], [6, 5]], [[0, 4], [2, 3], [2.5, 2], [3, 1]]],
  },
};

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const semi = (f, s) => f * Math.pow(2, s / 12);

export function createAudio() {
  let ctx = null;
  let N = null;            // noise buffers
  const nd = {};           // bus nodes
  const pre = {};          // pre-rendered buffers
  const active = {};       // id -> [endTimes]
  const lastT = {};
  let globalEnds = [];
  let music = null;
  let heart = null;
  const st = { master: 0.8, music: 0.6, sfx: 0.8, muted: false, paused: false, lowHealth: false,
    boss: false, intensity: 0, pendingMap: null };

  // ---------------------------------------------------------------- DSP helpers
  function env(g, t, a, peak, d) {
    peak = Math.max(peak, 0.0002);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.max(a, 0.001));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, 0.001) + d);
  }

  function tone(c, out, o) {
    const t = o.t, a = o.a ?? 0.002, d = o.d ?? 0.2;
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.glide ?? a + d));
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    env(g, t, a, o.v ?? 0.3, d);
    let src = osc;
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass'; f.Q.value = o.q ?? 0.8;
      f.frequency.setValueAtTime(o.lp, t);
      if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + a + d);
      osc.connect(f); src = f;
    }
    src.connect(g); g.connect(out);
    if (o.rv) g.connect(o.rv);
    osc.start(t); osc.stop(t + a + d + 0.05);
    return osc;
  }

  function noise(c, out, o) {
    const t = o.t, a = o.a ?? 0.002, d = o.d ?? 0.1, buf = o.buf || N.white;
    const s = c.createBufferSource();
    s.buffer = buf; s.loop = true;
    if (o.rate) s.playbackRate.value = o.rate;
    const fl = c.createBiquadFilter();
    fl.type = o.type || 'bandpass'; fl.Q.value = o.q ?? 1;
    fl.frequency.setValueAtTime(Math.min(o.f ?? 1000, 18000), t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(Math.min(o.f2, 18000), t + (o.glide ?? a + d));
    const g = c.createGain();
    env(g, t, a, o.v ?? 0.3, d);
    s.connect(fl); fl.connect(g); g.connect(out);
    if (o.rv) g.connect(o.rv);
    s.start(t, Math.random() * (buf.duration - 0.6));
    s.stop(t + a + d + 0.05);
    return g;
  }

  // Church bell: hum, prime, minor tierce, quint, nominal + upper inharmonics.
  const BELL_P = [[0.5, 1.0, 1.0], [1, 0.75, 0.75], [1.19, 0.5, 0.45], [1.5, 0.32, 0.38], [2, 0.55, 0.4],
    [2.51, 0.22, 0.22], [2.99, 0.2, 0.18], [4.07, 0.12, 0.1], [5.3, 0.06, 0.06]];
  function bell(c, out, t, f, v, dur, rv, lite) {
    const bus = c.createGain();
    bus.gain.value = v * 0.26;
    bus.connect(out);
    if (rv) bus.connect(rv);
    const parts = lite ? BELL_P.slice(0, 5) : BELL_P;
    for (const [r, amp, dm] of parts) {
      const fr = f * r * (1 + rnd(-0.002, 0.002));
      if (fr > 15000 || fr < 20) continue;
      tone(c, bus, { f: fr, t, a: r < 1 ? 0.012 : 0.002, d: dur * dm, v: amp });
    }
    if (!lite) {
      tone(c, bus, { f: f * 0.5 + 0.8, t, a: 0.015, d: dur * 0.9, v: 0.45 }); // warble/beating
      noise(c, bus, { t, d: 0.035, v: 0.35, type: 'bandpass', f: Math.min(f * 6, 9000), q: 1.4 });
    }
    return bus;
  }

  // Breathy choir pad: detuned saws into vowel formant bank + breath noise.
  function choir(c, out, t, freqs, a, hold, r, v, rv, vowel) {
    const F = vowel ? [[420, 1], [800, 0.35], [2600, 0.1]] : [[730, 1], [1090, 0.5], [2440, 0.16]];
    const end = t + a + hold + r;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + a + hold);
    g.gain.linearRampToValueAtTime(0, end);
    g.connect(out);
    if (rv) g.connect(rv);
    const mix = c.createGain();
    mix.gain.value = 1 / Math.sqrt(freqs.length * 2);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    mix.connect(lp);
    for (const [ff, amp] of F) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 5;
      const bg = c.createGain(); bg.gain.value = amp * 2.2;
      lp.connect(bp); bp.connect(bg); bg.connect(g);
    }
    const lfo = c.createOscillator();
    lfo.frequency.value = rnd(4.4, 5.3);
    const lg = c.createGain(); lg.gain.value = 7;
    lfo.connect(lg);
    lfo.start(t); lfo.stop(end + 0.05);
    for (const f of freqs) {
      for (const dt of [-8, 7]) {
        const o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt + rnd(-3, 3);
        lg.connect(o.detune); o.connect(mix);
        o.start(t); o.stop(end + 0.05);
      }
    }
    const b = c.createBufferSource();
    b.buffer = N.pink; b.loop = true;
    const bf = c.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1400; bf.Q.value = 0.8;
    const bgn = c.createGain(); bgn.gain.value = 0.22;
    b.connect(bf); bf.connect(bgn); bgn.connect(g);
    b.start(t, Math.random()); b.stop(end + 0.05);
    return end - t;
  }

  // Hollow wood / bone knock.
  function knock(c, out, t, f, v, rv) {
    tone(c, out, { type: 'triangle', f, f2: f * 0.78, t, a: 0.001, d: 0.07, v, rv });
    tone(c, out, { f: f * 2.3, t, a: 0.001, d: 0.03, v: v * 0.3 });
    noise(c, out, { t, d: 0.022, v: v * 0.6, type: 'bandpass', f: Math.min(f * 3.2, 8000), q: 4 });
  }

  function shimmer(c, out, t, a, d, v, rv) {
    noise(c, out, { t, a, d, v, type: 'highpass', f: 6500, q: 0.5, rv });
  }

  // ---------------------------------------------------------------- recipes
  // (c, out, rv, t, p) -> approx duration (sec). rv may be null (offline pre-render).
  const R = {
    fire_cast(c, o, rv, t, p) {
      noise(c, o, { buf: N.brown, t, a: 0.03, d: 0.28, v: 0.55, f: 300 * p, f2: 1400 * p, q: 0.9, glide: 0.2 });
      noise(c, o, { buf: N.crackle, t, a: 0.01, d: 0.3, v: 0.4, type: 'highpass', f: 1800, q: 0.5 });
      tone(c, o, { type: 'triangle', f: 180 * p, f2: 90 * p, t, a: 0.01, d: 0.18, v: 0.1 });
      return 0.4;
    },
    fire_explode(c, o, rv, t, p) {
      tone(c, o, { f: 110 * p, f2: 34 * p, t, a: 0.003, d: 0.35, v: 0.55, glide: 0.25 });
      noise(c, o, { buf: N.brown, t, a: 0.004, d: 0.55, v: 0.7, type: 'lowpass', f: 2200 * p, f2: 180, q: 0.7, glide: 0.5, rv });
      noise(c, o, { buf: N.crackle, t: t + 0.02, a: 0.01, d: 0.6, v: 0.4, type: 'highpass', f: 1500, q: 0.5 });
      return 0.75;
    },
    ice_cast(c, o, rv, t, p) {
      noise(c, o, { t, a: 0.02, d: 0.2, v: 0.16, type: 'highpass', f: 5000 * p, f2: 9000, q: 0.7 });
      const base = rnd(1500, 1800) * p;
      [1, 1.51, 2.23, 2.97].forEach((r, i) =>
        tone(c, o, { f: base * r, t: t + i * 0.018, a: 0.002, d: 0.35 - i * 0.05, v: 0.09 / (1 + i * 0.4), rv }));
      return 0.45;
    },
    ice_shatter(c, o, rv, t, p) {
      for (let i = 0; i < 7; i++) {
        tone(c, o, { f: rnd(2200, 6200) * p, t: t + rnd(0, 0.12), a: 0.001, d: rnd(0.05, 0.2), v: 0.06, rv: i < 3 ? rv : null });
      }
      noise(c, o, { t, d: 0.12, v: 0.35, f: 4500 * p, q: 1.2 });
      noise(c, o, { t, d: 0.25, v: 0.1, type: 'highpass', f: 7000 });
      tone(c, o, { type: 'triangle', f: 900 * p, f2: 600 * p, t, d: 0.05, v: 0.08 });
      return 0.4;
    },
    freeze(c, o, rv, t, p) {
      noise(c, o, { t, a: 0.05, d: 0.6, v: 0.2, f: 2500 * p, f2: 7000, q: 3, rv });
      tone(c, o, { f: 2637 * p, f2: 2093 * p, t, a: 0.01, d: 0.7, v: 0.05, rv });
      tone(c, o, { f: 3951 * p, f2: 3136 * p, t: t + 0.04, a: 0.01, d: 0.5, v: 0.03, rv });
      noise(c, o, { buf: N.crackle, t, a: 0.02, d: 0.4, v: 0.15, type: 'highpass', f: 4000 });
      return 0.8;
    },
    lightning(c, o, rv, t, p) {
      noise(c, o, { t, a: 0.001, d: 0.05, v: 0.55, type: 'highpass', f: 2500 });
      const buzz = tone(c, o, { type: 'square', f: 90 * p, t, a: 0.001, d: 0.15, v: 0.1, lp: 3000 });
      for (let k = 1; k < 10; k++) buzz.frequency.setValueAtTime(rnd(40, 170) * p, t + k * 0.012);
      noise(c, o, { t, d: 0.18, v: 0.28, f: 1800 * p, q: 0.7 });
      noise(c, o, { buf: N.brown, t: t + 0.03, a: 0.02, d: 0.9, v: 0.35, type: 'lowpass', f: 260, rv });
      return 1.0;
    },
    arcane_hit(c, o, rv, t, p) {
      const f = rnd(520, 600) * p;
      const car = c.createOscillator(); car.frequency.value = f;
      const mod = c.createOscillator(); mod.frequency.value = f * 1.41;
      const mg = c.createGain();
      mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.15);
      mod.connect(mg); mg.connect(car.frequency);
      const g = c.createGain(); env(g, t, 0.002, 0.16, 0.22);
      car.connect(g); g.connect(o); if (rv) g.connect(rv);
      car.start(t); mod.start(t); car.stop(t + 0.3); mod.stop(t + 0.3);
      noise(c, o, { t, d: 0.05, v: 0.1, f: 3000 * p, q: 4 });
      return 0.3;
    },
    scythe_swing(c, o, rv, t, p) {
      noise(c, o, { t, a: 0.08, d: 0.16, v: 0.35, f: 450 * p, f2: 2400 * p, q: 1.6, glide: 0.18 });
      noise(c, o, { buf: N.pink, t, a: 0.05, d: 0.14, v: 0.2, type: 'lowpass', f: 600 });
      return 0.3;
    },
    blood_spike(c, o, rv, t, p) {
      tone(c, o, { f: 240 * p, f2: 55 * p, t, a: 0.002, d: 0.18, v: 0.35, glide: 0.12 });
      noise(c, o, { buf: N.pink, t, a: 0.002, d: 0.16, v: 0.5, type: 'lowpass', f: 3000 * p, f2: 300, q: 3 });
      noise(c, o, { t: t + 0.01, d: 0.08, v: 0.18, f: 900 * p, f2: 2500 * p, q: 8 });
      return 0.26;
    },
    holy_pulse(c, o, rv, t, p) {
      bell(c, o, t, 523.25 * p, 0.5, 1.2, rv, true);
      choir(c, o, t, [261.63, 329.63, 392].map(f => f * p), 0.08, 0.1, 0.8, 0.12, rv, 1);
      shimmer(c, o, t, 0.05, 0.5, 0.05, rv);
      return 1.1;
    },
    hex_cast(c, o, rv, t, p) {
      tone(c, o, { type: 'sawtooth', f: 110 * p, t, a: 0.05, d: 0.45, v: 0.12, lp: 300, lp2: 1400, q: 3 });
      tone(c, o, { type: 'sawtooth', f: 155.56 * p, t, a: 0.05, d: 0.45, v: 0.1, lp: 300, lp2: 1400, q: 3 });
      noise(c, o, { buf: N.pink, t, a: 0.1, d: 0.35, v: 0.12, f: 2200, q: 3, rv });
      return 0.6;
    },
    necro_raise(c, o, rv, t, p) {
      noise(c, o, { buf: N.brown, t, a: 0.35, d: 0.4, v: 0.45, type: 'lowpass', f: 120, f2: 500, rv });
      tone(c, o, { type: 'sawtooth', f: 55 * p, f2: 82 * p, t, a: 0.3, d: 0.5, v: 0.12, lp: 200, lp2: 700, rv });
      for (let i = 0; i < 3; i++) knock(c, o, t + 0.25 + i * 0.09 + rnd(0, 0.03), rnd(300, 480) * p, 0.18);
      choir(c, o, t, [73.42, 87.31, 110].map(f => f * p), 0.3, 0.1, 0.6, 0.08, rv, 1);
      return 1.1;
    },
    summon_attack(c, o, rv, t, p) {
      knock(c, o, t, rnd(260, 340) * p, 0.25);
      noise(c, o, { buf: N.pink, t, d: 0.06, v: 0.1, f: 1500 * p });
      return 0.12;
    },
    enemy_hit(c, o, rv, t, p) {
      tone(c, o, { f: rnd(150, 190) * p, f2: 60 * p, t, a: 0.001, d: 0.09, v: 0.5, glide: 0.08 });
      noise(c, o, { buf: N.pink, t, a: 0.001, d: 0.05, v: 0.45, f: rnd(900, 1400) * p, q: 1.2 });
      noise(c, o, { buf: N.brown, t, a: 0.001, d: 0.06, v: 0.3, type: 'lowpass', f: 600 });
      return 0.14;
    },
    enemy_hit_crit(c, o, rv, t, p) {
      tone(c, o, { f: rnd(140, 170) * p, f2: 50 * p, t, a: 0.001, d: 0.12, v: 0.6, glide: 0.1 });
      noise(c, o, { buf: N.pink, t, a: 0.001, d: 0.07, v: 0.5, f: 1200 * p, q: 1 });
      noise(c, o, { t, d: 0.03, v: 0.3, type: 'highpass', f: 4000 });
      [1850, 2790, 4100].forEach((f, i) => tone(c, o, { f: f * p * rnd(0.98, 1.02), t, d: 0.18 - i * 0.03, v: 0.06 / (i + 1) }));
      return 0.25;
    },
    enemy_death(c, o, rv, t, p) {
      noise(c, o, { buf: N.pink, t, a: 0.002, d: 0.2, v: 0.5, type: 'lowpass', f: 2600 * p, f2: 220, q: 4 });
      tone(c, o, { f: 130 * p, f2: 40 * p, t, a: 0.002, d: 0.16, v: 0.35 });
      knock(c, o, t + 0.03, rnd(380, 480) * p, 0.12);
      return 0.28;
    },
    enemy_death_big(c, o, rv, t, p) {
      tone(c, o, { f: 80 * p, f2: 28 * p, t, a: 0.003, d: 0.5, v: 0.6 });
      noise(c, o, { buf: N.brown, t, a: 0.003, d: 0.7, v: 0.7, type: 'lowpass', f: 1400 * p, f2: 120, rv });
      noise(c, o, { buf: N.pink, t, a: 0.002, d: 0.3, v: 0.45, type: 'lowpass', f: 3000 * p, f2: 200, q: 5 });
      knock(c, o, t + 0.04, 300 * p, 0.15); knock(c, o, t + 0.11, 420 * p, 0.1);
      noise(c, o, { buf: N.crackle, t, a: 0.01, d: 0.5, v: 0.2, type: 'bandpass', f: 1200 });
      return 0.8;
    },
    elite_spawn(c, o, rv, t, p) {
      noise(c, o, { buf: N.pink, t, a: 0.45, d: 0.12, v: 0.22, f: 400, f2: 1600, q: 1, glide: 0.45, rv });
      bell(c, o, t + 0.45, 146.83 * p, 0.5, 2.2, rv);
      bell(c, o, t + 0.45, 155.56 * p, 0.28, 1.8, null, true);
      return 2.8;
    },
    enemy_shoot(c, o, rv, t, p) {
      noise(c, o, { buf: N.pink, t, a: 0.002, d: 0.07, v: 0.22, f: 900 * p, q: 2 });
      tone(c, o, { type: 'triangle', f: 420 * p, f2: 260 * p, t, d: 0.08, v: 0.07 });
      return 0.1;
    },
    worm_emerge(c, o, rv, t, p) {
      noise(c, o, { buf: N.brown, t, a: 0.15, d: 0.6, v: 0.6, type: 'lowpass', f: 90, f2: 400 });
      noise(c, o, { buf: N.crackle, t, a: 0.1, d: 0.5, v: 0.3, f: 800, q: 0.8 });
      tone(c, o, { type: 'sawtooth', f: 45 * p, f2: 70 * p, t, a: 0.1, d: 0.6, v: 0.1, lp: 200 });
      return 0.8;
    },
    slam_warn(c, o, rv, t, p) {
      tone(c, o, { type: 'sawtooth', f: 60 * p, f2: 120 * p, t, a: 0.5, d: 0.15, v: 0.12, lp: 200, lp2: 900, glide: 0.6 });
      noise(c, o, { buf: N.pink, t, a: 0.55, d: 0.1, v: 0.2, f: 300, f2: 1200, glide: 0.6 });
      bell(c, o, t, 98 * p, 0.25, 1.0, rv, true);
      return 1.0;
    },
    slam(c, o, rv, t, p) {
      tone(c, o, { f: 75 * p, f2: 26 * p, t, a: 0.002, d: 0.6, v: 0.75, glide: 0.3 });
      noise(c, o, { buf: N.brown, t, a: 0.002, d: 0.8, v: 0.8, type: 'lowpass', f: 900, f2: 100, rv });
      noise(c, o, { t, d: 0.04, v: 0.3, f: 2000, q: 1 });
      noise(c, o, { buf: N.crackle, t, a: 0.01, d: 0.5, v: 0.3, type: 'lowpass', f: 2000 });
      return 1.0;
    },
    xp_pickup(c, o, rv, t, p) {
      tone(c, o, { f: 1318.5 * p, t, a: 0.002, d: 0.11, v: 0.22 });
      tone(c, o, { f: 2637 * 1.003 * p, t, a: 0.002, d: 0.06, v: 0.07 });
      tone(c, o, { type: 'triangle', f: 1975.5 * p, t: t + 0.015, a: 0.002, d: 0.08, v: 0.05 });
      return 0.15;
    },
    gold_pickup(c, o, rv, t, p) {
      const k = rnd(0.97, 1.03) * p;
      [[2093, 0.1, 0.15], [3140, 0.06, 0.1], [4870, 0.03, 0.07]].forEach(([f, v, d]) => tone(c, o, { f: f * k, t, d, v }));
      [[2350, 0.07, 0.12], [3520, 0.04, 0.08]].forEach(([f, v, d]) => tone(c, o, { f: f * k, t: t + 0.05, d, v }));
      return 0.25;
    },
    chest_open(c, o, rv, t, p) {
      const cr = tone(c, o, { type: 'sawtooth', f: 70, t, a: 0.05, d: 0.35, v: 0.1, lp: 900, q: 6 });
      for (let k = 1; k < 8; k++) cr.frequency.setValueAtTime(rnd(55, 95), t + k * 0.045);
      knock(c, o, t + 0.35, 180, 0.3);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(c, o, t + 0.4 + i * 0.07, f * p, 0.22, 1.2, rv, true));
      shimmer(c, o, t + 0.4, 0.2, 0.8, 0.06, rv);
      return 1.8;
    },
    heal(c, o, rv, t, p) {
      choir(c, o, t, [261.63, 329.63, 392, 523.25].map(f => f * p), 0.15, 0.15, 0.6, 0.11, rv, 1);
      tone(c, o, { f: 523.25 * p, f2: 1046.5 * p, t, a: 0.1, d: 0.5, v: 0.05, rv, glide: 0.4 });
      shimmer(c, o, t, 0.1, 0.6, 0.04, rv);
      return 1.0;
    },
    level_up(c, o, rv, t, p) {
      const root = 261.63 * p;
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => {
        const f = semi(root, s), ti = t + i * 0.065;
        tone(c, o, { type: 'triangle', f, t: ti, a: 0.004, d: 0.9, v: 0.09, rv });
        tone(c, o, { f: f * 2, t: ti, a: 0.004, d: 0.5, v: 0.035, rv });
      });
      choir(c, o, t, [-12, -5, 0, 4, 7].map(s => semi(root, s)), 0.25, 0.5, 1.4, 0.15, rv, 0);
      bell(c, o, t + 0.42, root * 4, 0.42, 2.5, rv);
      shimmer(c, o, t + 0.1, 0.4, 1.2, 0.06, rv);
      tone(c, o, { f: root / 4, t, a: 0.3, d: 1.2, v: 0.14 });
      return 2.9;
    },
    upgrade_hover(c, o, rv, t, p) {
      tone(c, o, { f: 1760 * p, t, a: 0.002, d: 0.035, v: 0.05 });
      noise(c, o, { t, d: 0.01, v: 0.04, type: 'highpass', f: 5000 });
      return 0.06;
    },
    upgrade_select(c, o, rv, t, p) {
      bell(c, o, t, 783.99 * p, 0.4, 1.2, rv, true);
      knock(c, o, t, 200 * p, 0.25);
      tone(c, o, { f: 1568 * p, t, a: 0.002, d: 0.3, v: 0.06, rv });
      return 1.2;
    },
    evolution(c, o, rv, t, p) {
      tone(c, o, { f: 40 * p, f2: 55 * p, t, a: 0.8, d: 1.5, v: 0.3 });
      noise(c, o, { buf: N.pink, t, a: 1.0, d: 0.2, v: 0.2, f: 300, f2: 5000, glide: 1.0, rv });
      const T = t + 1.0;
      tone(c, o, { f: 90 * p, f2: 30 * p, t: T, a: 0.003, d: 0.8, v: 0.5 });
      noise(c, o, { buf: N.brown, t: T, a: 0.003, d: 0.8, v: 0.4, type: 'lowpass', f: 600, rv });
      bell(c, o, T, 130.81 * p, 0.6, 4, rv);
      bell(c, o, T + 0.05, 523.25 * p, 0.35, 3, rv, true);
      bell(c, o, T + 0.1, 1046.5 * p, 0.22, 2.5, rv, true);
      choir(c, o, t + 0.9, [65.41, 130.81, 196, 261.63, 329.63, 392, 523.25].map(f => f * p), 0.2, 1.0, 2.2, 0.19, rv, 0);
      [0, 2, 4, 7, 9, 12, 14, 16].forEach((s, i) =>
        tone(c, o, { type: 'triangle', f: semi(523.25 * p, s), t: T + i * 0.05, a: 0.003, d: 0.8, v: 0.055, rv }));
      shimmer(c, o, T, 0.3, 2.0, 0.06, rv);
      return 5.0;
    },
    reroll(c, o, rv, t, p) {
      for (let i = 0; i < 5; i++) knock(c, o, t + rnd(0, 0.18), rnd(300, 650) * p, 0.13);
      knock(c, o, t + 0.22, 360 * p, 0.2);
      noise(c, o, { t, d: 0.05, v: 0.08, f: 3000, q: 1 });
      return 0.35;
    },
    player_hurt(c, o, rv, t, p) {
      tone(c, o, { f: 120 * p, f2: 45 * p, t, a: 0.002, d: 0.22, v: 0.6 });
      tone(c, o, { type: 'sawtooth', f: 180 * p, f2: 90 * p, t, a: 0.003, d: 0.18, v: 0.14, lp: 900 });
      noise(c, o, { buf: N.pink, t, d: 0.12, v: 0.45, f: 700, q: 1 });
      noise(c, o, { t, d: 0.04, v: 0.18, type: 'highpass', f: 3000 });
      return 0.3;
    },
    player_dash(c, o, rv, t, p) {
      noise(c, o, { t, a: 0.02, d: 0.14, v: 0.28, f: 800 * p, f2: 3500 * p, q: 1.2 });
      noise(c, o, { buf: N.pink, t, a: 0.01, d: 0.12, v: 0.15, type: 'lowpass', f: 400 });
      return 0.2;
    },
    ultimate(c, o, rv, t, p) {
      noise(c, o, { buf: N.pink, t, a: 0.35, d: 0.1, v: 0.25, f: 200, f2: 3000, glide: 0.35, rv });
      const T = t + 0.35;
      tone(c, o, { f: 70 * p, f2: 25 * p, t: T, a: 0.003, d: 1.2, v: 0.7 });
      noise(c, o, { buf: N.brown, t: T, a: 0.003, d: 1.4, v: 0.7, type: 'lowpass', f: 1200, f2: 80, rv });
      bell(c, o, T, 73.42 * p, 0.6, 3.5, rv);
      choir(c, o, T, [73.42, 110, 146.83, 174.61, 220].map(f => f * p), 0.1, 0.4, 1.8, 0.17, rv, 0);
      return 3.8;
    },
    boss_spawn(c, o, rv, t, p) {
      bell(c, o, t, 65.41 * p, 0.95, 6, rv);
      bell(c, o, t + 0.02, 92.5 * p, 0.3, 4, rv, true);
      tone(c, o, { f: 70 * p, f2: 24 * p, t, a: 0.01, d: 3, v: 0.6, glide: 2.5 });
      noise(c, o, { buf: N.brown, t, a: 0.05, d: 3, v: 0.5, type: 'lowpass', f: 300, f2: 60, rv });
      choir(c, o, t, [65.41, 77.78, 98].map(f => f * p), 1.0, 0.8, 2.5, 0.12, rv, 1);
      return 6;
    },
    boss_phase(c, o, rv, t, p) {
      bell(c, o, t, 98 * p, 0.6, 3.5, rv);
      bell(c, o, t + 0.01, 103.83 * p, 0.4, 3, rv, true);
      choir(c, o, t, [98, 116.54, 138.59].map(f => f * p), 0.3, 0.5, 1.5, 0.14, rv, 1);
      tone(c, o, { f: 50 * p, f2: 30 * p, t, a: 0.01, d: 1.5, v: 0.4 });
      return 3.5;
    },
    boss_attack_warn(c, o, rv, t, p) {
      bell(c, o, t, 110 * p, 0.45, 1.5, rv, true);
      noise(c, o, { buf: N.pink, t, a: 0.45, d: 0.1, v: 0.2, f: 200, f2: 1500, glide: 0.5 });
      return 1.5;
    },
    boss_death(c, o, rv, t, p) {
      noise(c, o, { buf: N.brown, t, a: 0.02, d: 4, v: 0.8, type: 'lowpass', f: 600, f2: 40, rv });
      tone(c, o, { f: 80 * p, f2: 20 * p, t, a: 0.005, d: 3.5, v: 0.6, glide: 3 });
      noise(c, o, { buf: N.crackle, t, a: 0.02, d: 2, v: 0.4, type: 'highpass', f: 1200 });
      [392, 349.23, 311.13, 261.63, 233.08, 196, 174.61, 130.81].forEach((f, i) =>
        bell(c, o, t + 0.3 + i * 0.28, f * p, 0.3, 2.5, rv, true));
      bell(c, o, t + 2.6, 65.41 * p, 0.8, 6, rv);
      choir(c, o, t + 0.5, [65.41, 98, 130.81, 155.56, 196].map(f => f * p), 1.2, 1, 3, 0.14, rv, 0);
      return 8.6;
    },
    bell_toll(c, o, rv, t, p) {
      bell(c, o, t, 98 * p, 0.6, 4, rv);
      return 4;
    },
    shrine_activate(c, o, rv, t, p) {
      choir(c, o, t, [196, 293.66, 392, 493.88, 587.33].map(f => f * p), 0.6, 0.6, 1.8, 0.13, rv, 1);
      bell(c, o, t + 0.3, 783.99 * p, 0.3, 2, rv, true);
      shimmer(c, o, t, 0.6, 1.2, 0.05, rv);
      return 3.1;
    },
    ui_click(c, o, rv, t, p) {
      knock(c, o, t, 520 * p, 0.18);
      noise(c, o, { t, d: 0.01, v: 0.08, type: 'highpass', f: 4000 });
      return 0.08;
    },
    ui_hover(c, o, rv, t, p) {
      tone(c, o, { f: 1200 * p, t, a: 0.002, d: 0.025, v: 0.03 });
      return 0.04;
    },
    victory(c, o, rv, t, p) {
      choir(c, o, t, [130.81, 196, 261.63, 329.63, 392, 587.33].map(f => f * p), 0.8, 2, 2.5, 0.19, rv, 0);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(c, o, t + i * 0.35, f * p, 0.35, 3, rv, true));
      bell(c, o, t + 1.4, 130.81 * p, 0.5, 5, rv);
      tone(c, o, { f: 65.41 * p, t, a: 1, d: 3, v: 0.15 });
      return 6.5;
    },
    defeat(c, o, rv, t, p) {
      [440, 349.23, 293.66, 220].forEach((f, i) => bell(c, o, t + i * 0.6, f * p, 0.45, 3, rv));
      choir(c, o, t + 0.6, [110, 130.81, 164.81].map(f => f * p), 1, 1, 3, 0.12, rv, 1);
      tone(c, o, { f: 60 * p, f2: 30 * p, t, a: 0.2, d: 3, v: 0.3, glide: 3 });
      return 6;
    },
  };

  // ---------------------------------------------------------------- buffers
  function makeNoise(c) {
    const sr = c.sampleRate, len = Math.floor(sr * 2);
    const mk = () => c.createBuffer(1, len, sr);
    const white = mk(), pink = mk(), brown = mk(), crackle = mk();
    const w = white.getChannelData(0), pk = pink.getChannelData(0), br = brown.getChannelData(0), cr = crackle.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1;
      w[i] = x;
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759;
      b2 = 0.969 * b2 + x * 0.153852; b3 = 0.8665 * b3 + x * 0.3104856;
      b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
      pk[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
      b6 = x * 0.115926;
      last = (last + 0.02 * x) / 1.02;
      br[i] = last * 3.5;
      cr[i] = x * 0.015;
    }
    // sparse decaying pops for fire / dirt crackle
    const pops = Math.floor(2 * 260);
    for (let k = 0; k < pops; k++) {
      const at = Math.floor(Math.random() * len), plen = Math.floor(rnd(20, 220)), amp = rnd(0.2, 1) * (Math.random() < 0.5 ? -1 : 1);
      for (let j = 0; j < plen && at + j < len; j++) cr[at + j] += amp * Math.exp(-6 * j / plen) * (Math.random() * 2 - 1);
    }
    return { white, pink, brown, crackle };
  }

  function makeIR(c, sec) {
    const sr = c.sampleRate, len = Math.floor(sr * sec), pd = Math.floor(sr * 0.022);
    const buf = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = pd; i < len; i++) {
        const k = (i - pd) / (len - pd);
        const a = 0.55 - 0.47 * k; // darker tail over time (stone absorbs highs)
        lp += a * ((Math.random() * 2 - 1) - lp);
        const tt = (i - pd) / sr;
        d[i] = lp * Math.exp(-6.9 * tt / 2.5) * (i > len - 2400 ? (len - i) / 2400 : 1);
      }
      for (let e = 0; e < 8; e++) {
        const idx = pd + Math.floor(sr * rnd(0.005, 0.09));
        if (idx < len) d[idx] += rnd(-0.5, 0.5) * (1 - e / 10);
      }
    }
    return buf;
  }

  async function prerender() {
    if (!OAC || !ctx) return;
    const sr = ctx.sampleRate;
    for (const id of Object.keys(PRE)) {
      const [n, len] = PRE[id];
      const out = [];
      for (let i = 0; i < n; i++) {
        try {
          const oc = new OAC(1, Math.ceil(sr * len), sr);
          const g = oc.createGain();
          g.connect(oc.destination);
          R[id](oc, g, null, 0, 1);
          const buf = await oc.startRendering();
          if (buf) out.push(buf);
        } catch (e) { /* fall back to live synthesis */ }
      }
      if (out.length) pre[id] = out;
    }
  }

  // ---------------------------------------------------------------- graph
  function buildGraph() {
    const c = ctx;
    N = makeNoise(c);
    nd.masterGain = c.createGain();
    nd.limiter = c.createDynamicsCompressor();
    nd.limiter.threshold.value = -2; nd.limiter.knee.value = 0; nd.limiter.ratio.value = 20;
    nd.limiter.attack.value = 0.002; nd.limiter.release.value = 0.08;
    nd.comp = c.createDynamicsCompressor();
    nd.comp.threshold.value = -20; nd.comp.knee.value = 10; nd.comp.ratio.value = 3.5;
    nd.comp.attack.value = 0.006; nd.comp.release.value = 0.25;
    nd.lh = c.createBiquadFilter(); nd.lh.type = 'lowpass'; nd.lh.frequency.value = 20000; nd.lh.Q.value = 0.5;
    nd.pre = c.createGain();
    nd.pre.connect(nd.lh); nd.lh.connect(nd.comp); nd.comp.connect(nd.limiter);
    nd.limiter.connect(nd.masterGain); nd.masterGain.connect(c.destination);

    nd.conv = c.createConvolver();
    nd.conv.buffer = makeIR(c, 2.6);
    nd.revRet = c.createGain(); nd.revRet.gain.value = 0.35;
    nd.conv.connect(nd.revRet); nd.revRet.connect(nd.pre);

    nd.sfx = c.createGain(); nd.sfx.connect(nd.pre);
    nd.sfxRev = c.createGain(); nd.sfxRev.connect(nd.conv);
    nd.heart = c.createGain(); nd.heart.gain.value = 0.5; nd.heart.connect(nd.sfx);

    nd.musicIn = c.createGain();
    nd.musicLP = c.createBiquadFilter(); nd.musicLP.type = 'lowpass'; nd.musicLP.frequency.value = 20000; nd.musicLP.Q.value = 0.6;
    nd.musicDuck = c.createGain();
    nd.musicVol = c.createGain();
    nd.musicIn.connect(nd.musicLP); nd.musicLP.connect(nd.musicDuck); nd.musicDuck.connect(nd.musicVol); nd.musicVol.connect(nd.pre);
    nd.musicRevIn = c.createGain(); nd.musicRevVol = c.createGain();
    nd.musicRevIn.connect(nd.musicRevVol); nd.musicRevVol.connect(nd.conv);
    applyVolumes(true); applyPause(true); applyLowHealth(true);
  }

  function setP(param, v, tc, instant) {
    const now = ctx.currentTime;
    if (instant) { param.cancelScheduledValues(now); param.setValueAtTime(v, now); } else param.setTargetAtTime(v, now, tc);
  }
  function applyVolumes(instant) {
    if (!ctx) return;
    setP(nd.masterGain.gain, st.muted ? 0 : st.master * 0.9, 0.03, instant);
    setP(nd.sfx.gain, st.sfx * 0.6, 0.03, instant);
    setP(nd.sfxRev.gain, st.sfx * 0.6, 0.03, instant);
    setP(nd.musicVol.gain, st.music * 0.55, 0.05, instant);
    setP(nd.musicRevVol.gain, st.music * 0.55 * (st.paused ? 0.35 : 1), 0.05, instant);
  }
  function applyPause(instant) {
    if (!ctx) return;
    setP(nd.musicDuck.gain, st.paused ? 0.35 : 1, 0.25, instant);
    setP(nd.musicLP.frequency, st.paused ? 700 : 20000, 0.25, instant);
    setP(nd.musicRevVol.gain, st.music * 0.55 * (st.paused ? 0.35 : 1), 0.25, instant);
  }
  function applyLowHealth(instant) {
    if (!ctx) return;
    setP(nd.lh.frequency, st.lowHealth ? 3200 : 20000, 0.3, instant);
    if (st.lowHealth) heartStart(); else heartStop();
  }

  // ---------------------------------------------------------------- heartbeat
  function heartStart() {
    if (heart || !ctx) return;
    heart = { next: ctx.currentTime + 0.1, timer: setInterval(heartTick, 100) };
  }
  function heartStop() {
    if (!heart) return;
    clearInterval(heart.timer);
    heart = null;
  }
  function lub(T, v) {
    tone(ctx, nd.heart, { f: 62, f2: 40, t: T, a: 0.008, d: 0.16, v: 0.7 * v, glide: 0.12 });
    tone(ctx, nd.heart, { type: 'triangle', f: 124, f2: 80, t: T, a: 0.005, d: 0.07, v: 0.08 * v });
  }
  function heartTick() {
    if (!heart || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (heart.next < now - 0.05) heart.next = now + 0.05;
    while (heart.next < now + 0.3) {
      if (!st.muted) { lub(heart.next, 1); lub(heart.next + 0.24, 0.7); }
      heart.next += 0.92;
    }
  }

  // ---------------------------------------------------------------- music
  function startMusicNow(mapId) {
    const M = MAPS[mapId] || MAPS.nave;
    if (music) stopMusicNow(1.0);
    const c = ctx, now = c.currentTime;
    const s = { M, persist: [], beat: 0, next: now + 0.2, timer: null, motif: null, lv: {} };
    s.out = c.createGain();
    s.out.gain.setValueAtTime(0, now); s.out.gain.linearRampToValueAtTime(1, now + 3);
    s.out.connect(nd.musicIn);
    s.rev = c.createGain();
    s.rev.gain.setValueAtTime(0, now); s.rev.gain.linearRampToValueAtTime(1, now + 3);
    s.rev.connect(nd.musicRevIn);
    const mk = (send) => {
      const g = c.createGain(); g.gain.value = 0; g.connect(s.out);
      if (send) { const sg = c.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(s.rev); }
      return g;
    };
    s.drone = mk(0.25); s.pad = mk(0.7); s.bell = mk(0.8); s.perc = mk(0.2);
    s.hat = mk(0.1); s.boss = mk(0.6); s.wind = mk(0.4);

    // Drone (persistent)
    const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 300; dlp.Q.value = 1.2;
    dlp.connect(s.drone); s.droneLP = dlp;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.043;
    const lg = c.createGain(); lg.gain.value = 110;
    lfo.connect(lg); lg.connect(dlp.frequency); lfo.start(now); s.persist.push(lfo);
    for (const [type, mult, det, v] of M.drone) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = M.root * mult; o.detune.value = det;
      const g = c.createGain(); g.gain.value = v;
      o.connect(g); g.connect(dlp); o.start(now); s.persist.push(o);
    }
    // Wind (thornwood)
    if (M.kind === 'thornwood') {
      const w = c.createBufferSource(); w.buffer = N.pink; w.loop = true;
      const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 650; wf.Q.value = 0.7;
      const wl = c.createOscillator(); wl.frequency.value = 0.061;
      const wlg = c.createGain(); wlg.gain.value = 350;
      wl.connect(wlg); wlg.connect(wf.frequency);
      const wg = c.createGain(); wg.gain.value = 0.35;
      w.connect(wf); wf.connect(wg); wg.connect(s.wind);
      w.start(now); wl.start(now); s.persist.push(w, wl);
    }
    // Boss drone (tritone, persistent; gated by boss layer gain)
    const blp = c.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 220;
    const bg = c.createGain(); bg.gain.value = 0.2;
    blp.connect(bg); bg.connect(s.boss);
    for (const m of [0.5, 0.7071]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = M.root * m * 2;
      o.connect(blp); o.start(now); s.persist.push(o);
    }
    music = s;
    applyMusicLayers(true);
    s.timer = setInterval(() => schedTick(s), 100);
    schedTick(s);
  }

  function stopMusicNow(fade) {
    const s = music;
    if (!s || !ctx) return;
    music = null;
    clearInterval(s.timer);
    const now = ctx.currentTime, f = Math.max(0.02, fade);
    for (const g of [s.out.gain, s.rev.gain]) {
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + f);
    }
    setTimeout(() => {
      for (const o of s.persist) { try { o.stop(); } catch (e) { /* already stopped */ } }
      try { s.out.disconnect(); s.rev.disconnect(); } catch (e) { /* ignore */ }
    }, (f + 0.3) * 1000);
  }

  function applyMusicLayers(instant) {
    const s = music;
    if (!s || !ctx) return;
    const b = st.boss, eff = b ? Math.max(st.intensity, 0.75) : st.intensity;
    const lv = s.lv;
    lv.drone = 0.5 + 0.3 * eff;
    lv.pad = (0.9 - 0.35 * eff) * (b ? 0.6 : 1);
    lv.bell = (0.85 - 0.45 * eff) * (b ? 0.4 : 1);
    lv.perc = smooth(0.08, 0.5, eff);
    lv.hat = smooth(0.45, 0.9, eff) * 0.8;
    lv.boss = b ? 1 : 0;
    lv.wind = s.M.kind === 'thornwood' ? 0.5 - 0.3 * eff : 0;
    const tc = instant ? 0.05 : 0.9;
    for (const k of ['drone', 'pad', 'bell', 'perc', 'hat', 'boss', 'wind']) s[k].gain.setTargetAtTime(lv[k], ctx.currentTime, tc);
    s.droneLP.frequency.setTargetAtTime(260 + 600 * eff, ctx.currentTime, tc);
  }

  function schedTick(s) {
    if (music !== s || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime, B = 60 / s.M.bpm;
    if (s.next < now - 0.05) s.next = now + 0.05; // resync after throttling; never burst-schedule
    while (s.next < now + 0.3) {
      schedBeat(s, s.beat, s.next, B);
      s.beat++; s.next += B;
    }
  }

  function motifNote(s, T, f) {
    if (s.M.kind === 'nave') bell(ctx, s.bell, T, f, 0.28, 3, null, true);
    else {
      tone(ctx, s.bell, { type: 'triangle', f, t: T, a: 0.003, d: 1.4, v: 0.12 });
      tone(ctx, s.bell, { f: f * 2.76, t: T, a: 0.002, d: 0.35, v: 0.03 });
      tone(ctx, s.bell, { f: f * 4, t: T, a: 0.002, d: 0.15, v: 0.015 });
    }
  }

  function drum(s, T, v) {
    const c = ctx;
    if (s.M.kind === 'nave') {
      tone(c, s.perc, { f: 88, f2: 44, t: T, a: 0.003, d: 0.55, v: 0.55 * v, glide: 0.25 });
      noise(c, s.perc, { buf: N.brown, t: T, a: 0.002, d: 0.25, v: 0.4 * v, type: 'lowpass', f: 300 });
    } else {
      tone(c, s.perc, { f: 110, f2: 62, t: T, a: 0.003, d: 0.35, v: 0.5 * v, glide: 0.15 });
      noise(c, s.perc, { buf: N.pink, t: T, a: 0.002, d: 0.2, v: 0.35 * v, f: 180, q: 1 });
    }
  }

  function schedBeat(s, b, T, B) {
    const c = ctx, M = s.M, pb = b % 8, bb = b % 4, I = st.intensity, lv = s.lv;
    if (pb === 0) {
      const ch = M.prog[Math.floor(b / 8) % M.prog.length];
      if (lv.pad > 0.02) choir(c, s.pad, T, ch.map(x => semi(M.padRoot, x)), B * 2.5, B * 3.5, B * 4, 0.1, null, M.vowel);
      s.motif = Math.random() < (0.6 - 0.25 * I) ? M.motifs[Math.floor(Math.random() * M.motifs.length)] : null;
    }
    if (s.motif && lv.bell > 0.03) {
      for (const [off, deg] of s.motif) if (Math.floor(off) === pb) motifNote(s, T + (off - pb) * B, semi(M.motifRoot, M.scale[deg]));
    }
    if (lv.perc > 0.02) {
      if (bb === 0 || bb === 2) drum(s, T, bb === 0 ? 1 : 0.7);
      if (bb === 3 && I > 0.4) drum(s, T + B * 0.75, 0.4);
      if (bb === 3 && I > 0.65) drum(s, T + B * 0.5, 0.5);
      if (bb === 1 || bb === 3) {
        if (M.kind === 'nave') {
          tone(c, s.perc, { f: 2900, t: T, a: 0.002, d: 0.05, v: 0.04 });
          noise(c, s.perc, { t: T, d: 0.03, v: 0.07, type: 'highpass', f: 6000 });
        } else {
          knock(c, s.perc, T, 330, 0.16);
          if (I > 0.3) knock(c, s.perc, T + B * 0.5, 440, 0.09);
        }
      }
    }
    if (lv.hat > 0.02) {
      for (const [off, v] of [[0, 1], [0.54, 0.6]]) {
        if (M.kind === 'nave') noise(c, s.hat, { t: T + off * B, d: 0.03, v: 0.07 * v, type: 'highpass', f: 7500 });
        else noise(c, s.hat, { t: T + off * B, a: 0.012, d: 0.05, v: 0.09 * v, f: 5500, q: 1.5 });
      }
    }
    if (st.boss) {
      if (bb === 0) bell(c, s.boss, T, M.root, 0.5, 5, null, false);
      tone(c, s.boss, { f: 55, f2: 42, t: T, a: 0.005, d: 0.35, v: 0.45 });
      tone(c, s.boss, { type: 'triangle', f: 110, t: T, a: 0.005, d: 0.12, v: 0.05 });
      if (bb === 3) tone(c, s.boss, { f: 55, f2: 42, t: T + B * 0.5, a: 0.005, d: 0.25, v: 0.25 });
    }
  }

  // ---------------------------------------------------------------- play
  function play(id, opts) {
    if (!ctx || st.muted || ctx.state !== 'running') return;
    const rec = R[id];
    if (!rec) return;
    const cfg = RATE[id] || [0.04, 3, 1, 0.03];
    const now = ctx.currentTime;
    if (lastT[id] !== undefined && now - lastT[id] < cfg[0]) return;
    let arr = active[id] || (active[id] = []);
    if (arr.length) { arr = active[id] = arr.filter(e => e > now); }
    if (arr.length >= cfg[1]) return;
    if (globalEnds.length > 24) globalEnds = globalEnds.filter(e => e > now);
    if (globalEnds.length >= MAX_VOICES && LOW_PRIO.has(id)) return;
    if (globalEnds.length >= MAX_VOICES + 16) return;
    lastT[id] = now;

    opts = opts || {};
    const jit = cfg[3];
    const p = clamp((opts.pitch ?? 1) * (1 + rnd(-jit, jit)), 0.25, 4);
    const vol = clamp(opts.vol ?? 1, 0, 2) * cfg[2] * rnd(0.88, 1.03) / (1 + 0.15 * arr.length);
    if (vol <= 0.001) return;
    const pan = clamp(opts.pan ?? 0, -1, 1);
    const t = now + 0.003;

    const g = ctx.createGain();
    g.gain.value = vol;
    let tail = g;
    if (pan && ctx.createStereoPanner) {
      const pn = ctx.createStereoPanner(); pn.pan.value = pan;
      g.connect(pn); tail = pn;
    }
    tail.connect(nd.sfx);
    let rv = null, dur;
    const bufs = pre[id];
    if (bufs) {
      const s = ctx.createBufferSource();
      const buf = bufs[(Math.random() * bufs.length) | 0];
      s.buffer = buf; s.playbackRate.value = p;
      s.connect(g); s.start(t);
      dur = buf.duration / p;
    } else {
      // Reverb send: recipe components opt in by connecting to rv; scaled by the play volume.
      rv = ctx.createGain(); rv.gain.value = 0.6;
      const rvOut = ctx.createGain(); rvOut.gain.value = vol;
      rv.connect(rvOut); rvOut.connect(nd.sfxRev);
      try { dur = rec(ctx, g, rv, t, p); } catch (e) { dur = 1; }
      rv._out = rvOut;
    }
    const end = t + dur;
    arr.push(end); globalEnds.push(end);
    setTimeout(() => {
      try { g.disconnect(); if (tail !== g) tail.disconnect(); if (rv) { rv.disconnect(); rv._out.disconnect(); } } catch (e) { /* ignore */ }
    }, (dur + 0.6) * 1000);
  }

  // ---------------------------------------------------------------- API
  const api = {
    unlock() {
      if (!AC) return;
      if (!ctx) {
        try {
          ctx = new AC({ latencyHint: 'interactive' });
        } catch (e) {
          try { ctx = new AC(); } catch (e2) { ctx = null; return; }
        }
        try {
          buildGraph();
        } catch (e) { try { ctx.close(); } catch (e2) { /* ignore */ } ctx = null; return; }
        prerender();
        if (st.pendingMap) { const m = st.pendingMap; st.pendingMap = null; startMusicNow(m); }
      }
      if (ctx.state !== 'running' && ctx.resume) { try { return ctx.resume(); } catch (e) { /* ignore */ } }
    },
    play(id, opts = {}) { try { play(id, opts); } catch (e) { /* never throw into game loop */ } },
    startMusic(mapId) {
      if (!ctx) { st.pendingMap = mapId || 'nave'; return; }
      try { startMusicNow(mapId); } catch (e) { /* ignore */ }
    },
    stopMusic(fadeSec = 1.5) {
      st.pendingMap = null;
      if (ctx) stopMusicNow(fadeSec);
    },
    setMusicIntensity(x) {
      const v = clamp(+x || 0, 0, 1);
      if (Math.abs(v - st.intensity) < 0.005) return;
      st.intensity = v; applyMusicLayers(false);
    },
    setBossMode(on) { on = !!on; if (on === st.boss) return; st.boss = on; applyMusicLayers(false); },
    setLowHealth(on) { on = !!on; if (on === st.lowHealth) return; st.lowHealth = on; applyLowHealth(false); },
    setPaused(on) { on = !!on; if (on === st.paused) return; st.paused = on; applyPause(false); },
    setMasterVolume(v) { st.master = clamp(+v || 0, 0, 1); applyVolumes(false); },
    setMusicVolume(v) { st.music = clamp(+v || 0, 0, 1); applyVolumes(false); },
    setSfxVolume(v) { st.sfx = clamp(+v || 0, 0, 1); applyVolumes(false); },
    setMuted(on) { st.muted = !!on; applyVolumes(false); },
  };
  return api;
}
