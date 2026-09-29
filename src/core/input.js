// Keyboard + gamepad + touch input, normalised into a move vector and edge-triggered actions.
export class Input {
  constructor(el) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mx = 0; this.mz = 0;
    this.touch = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.stickEl = null;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k); this.pressed.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('mousedown', (e) => { if (e.button === 2) this.pressed.add('ult'); });
    // Touch: left half = floating stick, taps on right half = dash.
    el.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.55 && this.touch.id === null) {
          Object.assign(this.touch, { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY });
          this.showStick(true);
        } else this.pressed.add(' ');
      }
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.touch.id) { this.touch.x = t.clientX; this.touch.y = t.clientY; }
    }, { passive: true });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === this.touch.id) { this.touch.id = null; this.showStick(false); } };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  }
  showStick(on) {
    if (!this.stickEl) return;
    this.stickEl.hidden = !on;
    this.stickEl.style.left = this.touch.ox + 'px'; this.stickEl.style.top = this.touch.oy + 'px';
  }
  down(...ks) { for (const k of ks) if (this.keys.has(k)) return true; return false; }
  hit(...ks) { for (const k of ks) if (this.pressed.has(k)) return true; return false; }
  update() {
    let x = 0, z = 0;
    if (this.down('a', 'arrowleft')) x -= 1;
    if (this.down('d', 'arrowright')) x += 1;
    if (this.down('w', 'arrowup')) z -= 1;
    if (this.down('s', 'arrowdown')) z += 1;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] || 0, az = p.axes[1] || 0;
      if (Math.hypot(ax, az) > 0.2) { x = ax; z = az; }
      const b = (i) => p.buttons[i] && p.buttons[i].pressed;
      const prev = this._padPrev || (this._padPrev = {});
      for (const [i, key] of [[0, ' '], [1, 'ult'], [9, 'escape'], [5, ' '], [4, 'ult']]) {
        if (b(i) && !prev[i]) this.pressed.add(key);
        prev[i] = b(i);
      }
    }
    if (this.touch.id !== null) {
      const dx = this.touch.x - this.touch.ox, dy = this.touch.y - this.touch.oy;
      const d = Math.hypot(dx, dy);
      if (d > 8) { const m = Math.min(1, d / 50); x = (dx / d) * m; z = (dy / d) * m; }
      if (this.stickEl) {
        const kn = this.stickEl.firstElementChild, c = Math.min(d, 50) / (d || 1);
        kn.style.transform = `translate(${dx * c}px,${dy * c}px)`;
      }
    }
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    this.mx = x; this.mz = z;
  }
  endFrame() { this.pressed.clear(); }
}
