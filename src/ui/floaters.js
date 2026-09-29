import * as THREE from 'three';
import { ELEM } from '../game/data.js';

// Damage numbers, elite health bars and off-screen markers on a 2D overlay canvas.
// Numbers are deliberately sparse: small hits are aggregated/skipped under load so crits read.
const _v = new THREE.Vector3();
export class Floaters {
  constructor(G, container) {
    this.G = G; this.list = []; this.pool = []; this.enabled = true;
    this.cv = document.createElement('canvas'); this.cv.id = 'fx2d'; container.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() { const d = Math.min(devicePixelRatio || 1, 2); this.dpr = d; this.cv.width = innerWidth * d; this.cv.height = innerHeight * d; }
  add(x, y, z, val, crit, elem, tag) {
    if (!this.enabled && elem !== 'player' && elem !== 'heal') return;
    const n = this.list.length;
    if (!crit && !tag && elem !== 'player' && elem !== 'heal' && (n > 55 || (n > 25 && Math.random() < 0.6))) return;
    if (val < 1 && !tag) return;
    const f = this.pool.pop() || {};
    f.x = x + (Math.random() - 0.5) * 0.6; f.y = y; f.z = z; f.val = Math.round(val); f.crit = crit; f.elem = elem; f.tag = tag; f.t = 0; f.life = crit || tag ? 1.0 : 0.65; f.dx = (Math.random() - 0.5) * 30;
    this.list.push(f);
  }
  project(x, y, z) {
    _v.set(x, y, z).project(this.G.rr.camera);
    return [(_v.x * 0.5 + 0.5) * innerWidth, (-_v.y * 0.5 + 0.5) * innerHeight, _v.z < 1];
  }
  update(dt) {
    const c = this.ctx, d = this.dpr;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, innerWidth, innerHeight);
    if (this.G.state !== 'run') return; // menus own the screen
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i]; f.t += dt;
      if (f.t >= f.life) { this.list[i] = this.list[this.list.length - 1]; this.list.pop(); this.pool.push(f); continue; }
      const k = f.t / f.life;
      const [sx, sy, ok] = this.project(f.x, f.y, f.z); if (!ok) continue;
      const pop = f.t < 0.08 ? 1 + (1 - f.t / 0.08) * (f.crit ? 0.9 : 0.4) : 1;
      const rise = (f.crit ? 46 : 30) * Math.sqrt(k);
      const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      let size = f.crit ? 24 : 13, col = '#d9d0bd', stroke = 'rgba(10,6,8,.9)';
      if (f.elem === 'player') { size = 22; col = '#ff4d5f'; }
      else if (f.elem === 'heal') { size = 18; col = '#79e0a8'; }
      else if (f.crit) col = '#ffd27a';
      else if (ELEM[f.elem] && f.elem !== 'physical') col = mix(ELEM[f.elem].ui);
      c.globalAlpha = a * (f.crit || f.tag || f.elem === 'player' || f.elem === 'heal' ? 1 : 0.8);
      c.font = `${f.crit ? 800 : 700} ${Math.round(size * pop)}px "Barlow Semi Condensed", "Arial Narrow", sans-serif`;
      const txt = f.elem === 'heal' ? '+' + f.val : String(f.val);
      const px = sx + f.dx * k, py = sy - rise;
      c.lineWidth = f.crit ? 5 : 3.5; c.strokeStyle = stroke; c.strokeText(txt, px, py);
      c.fillStyle = col; c.fillText(txt, px, py);
      if (f.tag) {
        c.font = `700 ${Math.round(12 * pop)}px "Barlow Semi Condensed", sans-serif`;
        c.lineWidth = 3; c.strokeText(f.tag, px, py - size * 0.9); c.fillStyle = f.tag === 'BLOCKED' ? '#a59c8b' : '#9fe6ff'; c.fillText(f.tag, px, py - size * 0.9);
      }
    }
    c.globalAlpha = 1;
    this.overlays(c);
  }
  overlays(c) {
    const G = this.G; if (!G.enemies || G.state === 'title') return;
    // elite health bars
    for (const e of G.enemies.list) {
      if (!e.elite || e.dying) continue;
      const [sx, sy, ok] = this.project(e.x, e.def.height * e.scale + 0.6, e.z); if (!ok) continue;
      const w = 46, k = Math.max(0, e.hp / e.maxHp);
      c.fillStyle = 'rgba(8,6,8,.85)'; c.fillRect(sx - w / 2 - 1, sy - 1, w + 2, 6);
      c.fillStyle = '#d9a84e'; c.fillRect(sx - w / 2, sy, w * k, 4);
    }
    // off-screen markers: chests, shrines, bosses
    const marks = [];
    for (const p of G.pickups.list) if (p.kind === 'chest') marks.push([p.x, p.z, '#ffd27a']);
    for (const s of G.shrines ? G.shrines.list : []) if (!s.used) marks.push([s.x, s.z, s.kind === 'blood' ? '#ff3552' : s.kind === 'bell' ? '#a877ff' : '#ffe9a8', true]);
    for (const b of G.enemies.bossList) marks.push([b.x, b.z, '#ff4a5e']);
    const W = innerWidth, H = innerHeight, m = 26;
    for (const [x, z, col, faint] of marks) {
      const [sx, sy, ok] = this.project(x, 1, z);
      if (ok && sx > 0 && sx < W && sy > 0 && sy < H) continue;
      const P = G.player; const d = Math.hypot(x - P.x, z - P.z); if (faint && d > 60) continue;
      const cx = W / 2, cy = H / 2; let dx = sx - cx, dy = sy - cy; if (!ok) { dx = -dx; dy = -dy; }
      const s = Math.min((W / 2 - m) / Math.abs(dx || 1e-3), (H / 2 - m) / Math.abs(dy || 1e-3));
      const px = cx + dx * s, py = cy + dy * s, ang = Math.atan2(dy, dx);
      c.save(); c.translate(px, py); c.rotate(ang); c.globalAlpha = faint ? 0.55 : 0.95;
      c.fillStyle = col; c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -7); c.lineTo(-3, 0); c.lineTo(-6, 7); c.closePath(); c.fill();
      c.restore();
    }
    c.globalAlpha = 1;
  }
  clear() { this.list.length = 0; }
}
function mix(hex) { return hex; }
