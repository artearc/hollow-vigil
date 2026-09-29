// Minimal event bus. Every gameplay event of note goes through here, which is
// what makes audio, UI and achievement hooks trivial to attach.
export class Bus {
  constructor() { this.h = new Map(); }
  on(evt, fn) {
    if (!this.h.has(evt)) this.h.set(evt, []);
    this.h.get(evt).push(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) {
    const l = this.h.get(evt); if (!l) return;
    const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
  }
  emit(evt, a, b) {
    const l = this.h.get(evt); if (!l) return;
    for (let i = 0; i < l.length; i++) l[i](a, b);
  }
}
