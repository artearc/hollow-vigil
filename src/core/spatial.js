// Uniform-grid spatial hash rebuilt every frame. Linked lists in typed arrays: zero allocation.
export class SpatialGrid {
  constructor(half = 128, cell = 3, cap = 4096) {
    this.half = half; this.cell = cell;
    this.n = Math.ceil((half * 2) / cell);
    this.head = new Int32Array(this.n * this.n).fill(-1);
    this.next = new Int32Array(cap);
    this.items = new Array(cap);
    this.count = 0;
    this.touched = new Int32Array(cap); this.nTouched = 0;
  }
  clear() {
    for (let i = 0; i < this.nTouched; i++) this.head[this.touched[i]] = -1;
    this.nTouched = 0; this.count = 0;
  }
  cellOf(x, z) {
    let cx = ((x + this.half) / this.cell) | 0, cz = ((z + this.half) / this.cell) | 0;
    if (cx < 0) cx = 0; else if (cx >= this.n) cx = this.n - 1;
    if (cz < 0) cz = 0; else if (cz >= this.n) cz = this.n - 1;
    return cz * this.n + cx;
  }
  insert(obj) {
    if (this.count >= this.items.length) return;
    const i = this.count++;
    const c = this.cellOf(obj.x, obj.z);
    if (this.head[c] === -1) this.touched[this.nTouched++] = c;
    this.items[i] = obj; this.next[i] = this.head[c]; this.head[c] = i;
  }
  // Calls fn(obj) for every item whose cell overlaps the query circle. fn returning true stops.
  query(x, z, r, fn) {
    const n = this.n, cs = this.cell, h = this.half;
    let x0 = ((x - r + h) / cs) | 0, x1 = ((x + r + h) / cs) | 0;
    let z0 = ((z - r + h) / cs) | 0, z1 = ((z + r + h) / cs) | 0;
    if (x0 < 0) x0 = 0; if (z0 < 0) z0 = 0; if (x1 >= n) x1 = n - 1; if (z1 >= n) z1 = n - 1;
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      let i = this.head[cz * n + cx];
      while (i !== -1) { if (fn(this.items[i])) return; i = this.next[i]; }
    }
  }
}
