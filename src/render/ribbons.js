import * as THREE from 'three';

// Camera-facing quad strips: sparks (velocity streaks), lightning, slashes, beams, trails.
// Everything is rebuilt into a single dynamic buffer each frame — one draw call.
const VERT = /* glsl */`
attribute vec4 aCol; varying vec4 vCol; varying vec2 vUv;
void main(){ vCol = aCol; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
const FRAG = /* glsl */`
varying vec4 vCol; varying vec2 vUv;
void main(){
  float v = abs(vUv.y*2.-1.);
  float core = smoothstep(.35,.0,v);
  float soft = pow(1.-v, 1.6);
  float a = (soft*.75 + core*.9) * vCol.a;
  vec3 c = vCol.rgb * a * (1. + core*core*.5);
  gl_FragColor = vec4(c, a);
}`;

export class Ribbons {
  constructor(scene, cap = 6000) {
    this.cap = cap; this.q = 0;
    this.pos = new Float32Array(cap * 4 * 3); this.col = new Float32Array(cap * 4 * 4); this.uv = new Float32Array(cap * 4 * 2);
    const idx = new Uint32Array(cap * 6);
    for (let i = 0; i < cap; i++) { const v = i * 4, k = i * 6; idx[k] = v; idx[k + 1] = v + 1; idx[k + 2] = v + 2; idx[k + 3] = v + 2; idx[k + 4] = v + 1; idx[k + 5] = v + 3; }
    for (let i = 0; i < cap; i++) { const u = i * 8; this.uv.set([0, 0, 0, 1, 1, 0, 1, 1], u); }
    this.geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.aPos); this.geo.setAttribute('aCol', this.aCol);
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 12;
    scene.add(this.mesh);
    this.view = new THREE.Vector3(0, -1, 0);
    // simulated sparks
    this.sp = []; this.spFree = [];
    // persistent segments that fade: {ax..bz, w0,w1,r,g,b,a,life,max, jitter}
    this.seg = []; this.segFree = [];
  }
  setView(camera) { camera.getWorldDirection(this.view); }

  quad(ax, ay, az, bx, by, bz, wa, wb, r, g, b, a) {
    if (this.q >= this.cap) return;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    // side = normalize(cross(dir, view))
    const vx = this.view.x, vy = this.view.y, vz = this.view.z;
    let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx;
    const l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
    const o = this.q * 12, P = this.pos;
    const ha = wa * 0.5, hb = wb * 0.5;
    P[o] = ax - sx * ha; P[o + 1] = ay - sy * ha; P[o + 2] = az - sz * ha;
    P[o + 3] = ax + sx * ha; P[o + 4] = ay + sy * ha; P[o + 5] = az + sz * ha;
    P[o + 6] = bx - sx * hb; P[o + 7] = by - sy * hb; P[o + 8] = bz - sz * hb;
    P[o + 9] = bx + sx * hb; P[o + 10] = by + sy * hb; P[o + 11] = bz + sz * hb;
    const c = this.q * 16, C = this.col;
    for (let k = 0; k < 4; k++) { C[c + k * 4] = r; C[c + k * 4 + 1] = g; C[c + k * 4 + 2] = b; C[c + k * 4 + 3] = a; }
    this.q++;
  }

  spark(x, y, z, vx, vy, vz, life, w, len, r, g, b, grav = 9, drag = 0.1) {
    const s = this.spFree.pop() || {};
    s.x = x; s.y = y; s.z = z; s.vx = vx; s.vy = vy; s.vz = vz; s.life = life; s.max = life; s.w = w; s.len = len; s.r = r; s.g = g; s.b = b; s.grav = grav; s.drag = drag;
    this.sp.push(s);
  }
  seg1(ax, ay, az, bx, by, bz, w0, w1, r, g, b, a, life) {
    const s = this.segFree.pop() || {};
    s.ax = ax; s.ay = ay; s.az = az; s.bx = bx; s.by = by; s.bz = bz; s.w0 = w0; s.w1 = w1; s.r = r; s.g = g; s.b = b; s.a = a; s.life = life; s.max = life;
    this.seg.push(s);
  }
  // Jagged lightning between two points, with forks.
  bolt(ax, ay, az, bx, by, bz, w, r, g, b, life = 0.18, jag = 0.6, forks = 1) {
    const dx = bx - ax, dz = bz - az, dy = by - ay;
    const L = Math.hypot(dx, dz, dy); const n = Math.max(3, Math.min(14, (L / 0.9) | 0));
    const px = -dz / (L || 1), pz = dx / (L || 1);
    let lx = ax, ly = ay, lz = az;
    for (let i = 1; i <= n; i++) {
      const t = i / n; const off = i === n ? 0 : (Math.random() - 0.5) * jag * 2 * Math.sin(t * Math.PI);
      const x = ax + dx * t + px * off, y = ay + dy * t + (i === n ? 0 : (Math.random() - 0.5) * jag * 0.5), z = az + dz * t + pz * off;
      this.seg1(lx, ly, lz, x, y, z, w, w * 0.8, r, g, b, 1, life);
      if (forks && Math.random() < 0.18 && i < n) {
        const fl = L * 0.18; const fa = Math.atan2(dz, dx) + (Math.random() - 0.5) * 2.2;
        this.seg1(x, y, z, x + Math.cos(fa) * fl, y, z + Math.sin(fa) * fl, w * 0.6, 0.02, r, g, b, 0.8, life * 0.8);
      }
      lx = x; ly = y; lz = z;
    }
  }
  // Crescent slash arc (flat on ground plane at height y), thick in the middle.
  arc(cx, y, cz, rad, a0, a1, w, r, g, b, life = 0.22, steps = 14) {
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const aa = a0 + (a1 - a0) * t0, ab = a0 + (a1 - a0) * t1;
      const wa = w * Math.sin(t0 * Math.PI) + 0.02, wb = w * Math.sin(t1 * Math.PI) + 0.02;
      this.seg1(cx + Math.cos(aa) * rad, y, cz + Math.sin(aa) * rad, cx + Math.cos(ab) * rad, y, cz + Math.sin(ab) * rad, wa, wb, r, g, b, 1, life);
    }
  }
  // Immediate quads added earlier this frame are kept; the buffer resets after flush().
  update(dt) {
    for (let i = this.sp.length - 1; i >= 0; i--) {
      const s = this.sp[i];
      s.life -= dt;
      if (s.life <= 0) { this.spFree.push(s); this.sp[i] = this.sp[this.sp.length - 1]; this.sp.pop(); continue; }
      const dr = Math.pow(s.drag, dt);
      s.vx *= dr; s.vz *= dr; s.vy = s.vy * dr - s.grav * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.y < 0.03) { s.y = 0.03; s.vy = Math.abs(s.vy) * 0.35; s.vx *= 0.6; s.vz *= 0.6; }
      const t = s.life / s.max;
      this.quad(s.x, s.y, s.z, s.x - s.vx * s.len, s.y - s.vy * s.len, s.z - s.vz * s.len, s.w * t, 0, s.r, s.g, s.b, Math.min(1, t * 1.6));
    }
    for (let i = this.seg.length - 1; i >= 0; i--) {
      const s = this.seg[i];
      s.life -= dt;
      if (s.life <= 0) { this.segFree.push(s); this.seg[i] = this.seg[this.seg.length - 1]; this.seg.pop(); continue; }
      const t = s.life / s.max;
      this.quad(s.ax, s.ay, s.az, s.bx, s.by, s.bz, s.w0 * (0.4 + 0.6 * t), s.w1 * (0.4 + 0.6 * t), s.r, s.g, s.b, s.a * t * t);
    }
  }
  // Call once per frame after all immediate quads were added.
  flush() {
    this.geo.setDrawRange(0, this.q * 6);
    this.aPos.needsUpdate = this.aCol.needsUpdate = true;
    this.aPos.clearUpdateRanges(); this.aPos.addUpdateRange(0, this.q * 12);
    this.aCol.clearUpdateRanges(); this.aCol.addUpdateRange(0, this.q * 16);
    this.q = 0; // the draw range above is already captured for this frame's render
  }
  clear() { this.sp.length = 0; this.seg.length = 0; this.q = 0; }
}
