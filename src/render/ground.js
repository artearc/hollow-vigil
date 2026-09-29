import * as THREE from 'three';
import { makeDecalAtlas } from './textures.js';

// ——— Decals: instanced ground quads sampling a mask atlas. Ring buffer, fades by life.
const DVERT = /* glsl */`
attribute vec4 aCol; attribute vec2 aCell; varying vec4 vCol; varying vec2 vUv;
void main(){ vCol = aCol; vUv = (uv + aCell) * .25; vUv.y = 1. - vUv.y;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.); }`;
const DFRAG = /* glsl */`
uniform sampler2D uAtlas; uniform float uAdd; varying vec4 vCol; varying vec2 vUv;
void main(){ float m = texture2D(uAtlas, vUv).a; float a = m * vCol.a; if (a < .01) discard;
  gl_FragColor = uAdd > .5 ? vec4(vCol.rgb * a, a) : vec4(vCol.rgb * a, a); }`;

export class Decals {
  constructor(scene, cap = 700, additive = false) {
    this.cap = cap; this.head = 0; this.live = [];
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aCell = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
    g.setAttribute('aCol', this.aCol); g.setAttribute('aCell', this.aCell);
    this.atlas = Decals.atlas || (Decals.atlas = makeDecalAtlas());
    const m = new THREE.ShaderMaterial({ vertexShader: DVERT, fragmentShader: DFRAG, transparent: true, depthWrite: false,
      uniforms: { uAtlas: { value: this.atlas }, uAdd: { value: additive ? 1 : 0 } },
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.InstancedMesh(g, m, cap);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2;
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, z);
    this.data = Array.from({ length: cap }, () => ({ life: 0, max: 1, a: 0, r: 0, g: 0, b: 0, grow: 0, s: 1, x: 0, z: 0, rot: 0, fadeIn: 0 }));
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._y = new THREE.Vector3(0, 1, 0);
    scene.add(this.mesh);
  }
  add(x, z, size, cell, r, g, b, a, life = 20, rot = Math.random() * 6.283, grow = 0, y = 0.03, fadeIn = 0) {
    // ring buffer that never overwrites permanent decals (world dressing, arena seals)
    let i = this.head, guard = 0;
    while (this.data[i].on && this.data[i].max > 1e6 && guard++ < this.cap) i = (i + 1) % this.cap;
    this.head = (i + 1) % this.cap;
    const d = this.data[i];
    Object.assign(d, { life, max: life, a, r, g, b, grow, s: size, x, z, rot, y, fadeIn });
    this.aCell.setXY(i, cell % 4, (cell / 4) | 0); this.aCell.needsUpdate = true;
    this._write(i, size);
    if (!d.on) { d.on = true; this.live.push(i); }
    return i;
  }
  _write(i, s) {
    const d = this.data[i];
    this._q.setFromAxisAngle(this._y, d.rot); this._p.set(d.x, d.y + (i % 13) * 0.0015, d.z); this._s.set(s, 1, s);
    this._m.compose(this._p, this._q, this._s); this.mesh.setMatrixAt(i, this._m);
  }
  kill(i) { const d = this.data[i]; if (d && d.on) { d.life = Math.min(d.life, 0.4); d.max = Math.min(d.max, 1); } }
  update(dt) {
    let any = false;
    for (let k = this.live.length - 1; k >= 0; k--) {
      const i = this.live[k], d = this.data[i];
      d.life -= dt;
      if (d.life <= 0) { d.on = false; this.aCol.setXYZW(i, 0, 0, 0, 0); this.live[k] = this.live[this.live.length - 1]; this.live.pop(); any = true; continue; }
      const age = d.max - d.life; const t = d.life / d.max;
      let a = d.a * Math.min(1, t * 4);
      if (d.fadeIn) a *= Math.min(1, age / d.fadeIn);
      this.aCol.setXYZW(i, d.r, d.g, d.b, a);
      if (d.grow) { d.s += d.grow * dt; this._write(i, d.s); this.mesh.instanceMatrix.needsUpdate = true; }
      any = true;
    }
    if (any) this.aCol.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (const i of this.live) { this.data[i].on = false; this.aCol.setXYZW(i, 0, 0, 0, 0); } this.live.length = 0; this.aCol.needsUpdate = true; }
}

// ——— Telegraphs: readable danger shapes that fill as the attack winds up.
const TVERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
const TFRAG = /* glsl */`
uniform int uType; uniform float uProg, uAlpha, uTime; uniform vec3 uCol; uniform vec4 uP; varying vec2 vUv;
void main(){
  float a = 0.;
  float hatch = step(.5, fract((vUv.x + vUv.y) * 14. - uTime * 1.6));
  if (uType == 0) {            // circle
    float d = length(vUv*2.-1.);
    if (d > 1.) discard;
    float edge = smoothstep(.06, .0, abs(d - .97));
    float fill = step(d, uProg) * (.28 + .12*hatch);
    float front = smoothstep(.05,.0,abs(d-uProg)) * .8;
    a = edge*.95 + fill + front + .06;
  } else if (uType == 1) {     // rectangle (x along, y across)
    float ex = min(vUv.x, 1.-vUv.x), ey = min(vUv.y, 1.-vUv.y);
    float edge = smoothstep(.04,.0, ey) + smoothstep(.015,.0, ex);
    float fill = step(vUv.x, uProg) * (.26 + .12*hatch);
    a = edge*.9 + fill + .07;
  } else if (uType == 2) {     // cone: uP.x = half angle
    vec2 p = vUv*2.-1.; float d = length(p); float ang = abs(atan(p.y, p.x));
    if (d > 1. || ang > uP.x) discard;
    float edge = smoothstep(.04,.0,abs(d-.97)) + smoothstep(.04,.0, (uP.x-ang)*d);
    a = edge*.9 + step(d,uProg)*(.26+.12*hatch) + .06;
  } else {                     // expanding ring wave with a safe gap. uP: x=radius(0..1), y=thickness, z=gap angle, w=gap half width
    vec2 p = vUv*2.-1.; float d = length(p); float ang = atan(p.y, p.x);
    float g = abs(mod(ang - uP.z + 3.14159, 6.28318) - 3.14159);
    float band = smoothstep(uP.y, 0., abs(d - uP.x));
    float gap = smoothstep(uP.w, uP.w + .05, g);
    a = band * gap * 1.2 + smoothstep(.02,.0,abs(d - uP.x - uP.y*1.5))*gap*.4;
  }
  a *= uAlpha;
  if (a < .005) discard;
  gl_FragColor = vec4(uCol * a, a);
}`;

export class Telegraphs {
  constructor(scene, cap = 48) {
    this.pool = []; this.active = [];
    const geoC = new THREE.PlaneGeometry(1, 1); geoC.rotateX(-Math.PI / 2);
    const geoR = new THREE.PlaneGeometry(1, 1); geoR.translate(0.5, 0, 0); geoR.rotateX(-Math.PI / 2);
    this.geoC = geoC; this.geoR = geoR;
    for (let i = 0; i < cap; i++) {
      const m = new THREE.ShaderMaterial({ vertexShader: TVERT, fragmentShader: TFRAG, transparent: true, depthWrite: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        uniforms: { uType: { value: 0 }, uProg: { value: 0 }, uAlpha: { value: 1 }, uTime: { value: 0 }, uCol: { value: new THREE.Color() }, uP: { value: new THREE.Vector4() } } });
      const mesh = new THREE.Mesh(geoC, m); mesh.visible = false; mesh.renderOrder = 4; mesh.frustumCulled = false;
      scene.add(mesh); this.pool.push(mesh);
    }
  }
  _get() { const m = this.pool.pop(); if (!m) return null; m.visible = true; this.active.push(m); return m; }
  // All return a handle {mesh, t, dur, ...}; handle.done when finished. Pass dur<=0 for manual control.
  circle(x, z, r, dur, col = 0xff3b2f, alpha = 1) { return this._mk(0, this.geoC, x, z, r * 2, r * 2, 0, dur, col, alpha); }
  rect(x, z, ang, len, width, dur, col = 0xff3b2f, alpha = 1) { return this._mk(1, this.geoR, x, z, len, width, ang, dur, col, alpha); }
  cone(x, z, ang, r, half, dur, col = 0xff3b2f, alpha = 1) { const h = this._mk(2, this.geoC, x, z, r * 2, r * 2, ang, dur, col, alpha); if (h) h.mesh.material.uniforms.uP.value.x = half; return h; }
  ring(x, z, rmax, col = 0xff3b2f) { const h = this._mk(3, this.geoC, x, z, rmax * 2, rmax * 2, 0, 0, col, 1); return h; }
  _mk(type, geo, x, z, sx, sz, ang, dur, col, alpha) {
    const mesh = this._get(); if (!mesh) return null;
    mesh.geometry = geo; mesh.position.set(x, 0.05, z); mesh.rotation.set(0, -ang, 0); mesh.scale.set(sx, 1, sz);
    const u = mesh.material.uniforms; u.uType.value = type; u.uProg.value = 0; u.uAlpha.value = alpha; u.uCol.value.set(col); u.uP.value.set(0, 0.04, 0, 0);
    const h = { mesh, t: 0, dur, done: false, alpha, fade: 0 };
    mesh.userData.h = h; return h;
  }
  release(h) { if (!h || h.done) return; h.done = true; h.fade = 0.15; }
  update(dt, time) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const m = this.active[i], h = m.userData.h, u = m.material.uniforms;
      u.uTime.value = time;
      if (!h.done) {
        h.t += dt;
        if (h.dur > 0) { u.uProg.value = Math.min(1, h.t / h.dur); if (h.t >= h.dur) { h.done = true; h.fade = 0.12; } }
        u.uAlpha.value = h.alpha * Math.min(1, h.t / 0.08);
      } else {
        h.fade -= dt; u.uAlpha.value = Math.max(0, h.fade / 0.15) * h.alpha * 1.4;
        if (h.fade <= 0) { m.visible = false; this.active[i] = this.active[this.active.length - 1]; this.active.pop(); this.pool.push(m); }
      }
    }
  }
  clear() { for (const m of this.active) { m.visible = false; this.pool.push(m); m.userData.h.done = true; } this.active.length = 0; }
}
