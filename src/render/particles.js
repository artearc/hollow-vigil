import * as THREE from 'three';

// CPU-simulated, GPU-drawn point particles. Struct-of-arrays, swap-remove compaction,
// one draw call per blend mode. Shapes: 0 soft glow, 1 hot core, 2 smoke, 3 ring, 4 shard/diamond, 5 ash flake
const VERT = /* glsl */`
attribute vec4 aCol; attribute vec2 aSize; varying vec4 vCol; varying float vShape; varying float vRot;
uniform float uScale;
void main(){
  vCol = aCol; vShape = aSize.y; vRot = position.x*3.1 + position.z*1.7;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  float dz = -mv.z;
  gl_PointSize = dz > 1.0 ? min(aSize.x * uScale / dz, 320.0) : 0.0; // never degenerate near/behind the eye
  gl_Position = projectionMatrix * mv;
  if (aCol.a <= 0.001) gl_Position = vec4(2., 2., 2., 1.);
}`;
const FRAG = /* glsl */`
varying vec4 vCol; varying float vShape; varying float vRot; uniform float uTime;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec2 uv = gl_PointCoord*2.-1.; float d = length(uv); float a = 0.;
  if (vShape < .5) { a = pow(max(0.,1.-d), 1.8); }
  else if (vShape < 1.5) { a = pow(max(0.,1.-d), 3.) * 1.4 + smoothstep(.35,.0,d); }
  else if (vShape < 2.5) { float nn = n(uv*2.3 + vRot + uTime*.25); a = smoothstep(1.,.2,d) * (.55+.6*nn); }
  else if (vShape < 3.5) { a = smoothstep(.12,.0,abs(d-.78)) + .15*smoothstep(1.,.0,d); }
  else if (vShape < 4.5) { float c=cos(vRot),s=sin(vRot); vec2 r=vec2(c*uv.x-s*uv.y, s*uv.x+c*uv.y); float dd = abs(r.x)*1.9+abs(r.y)*.7; a = smoothstep(1.,.75,dd); }
  else { float c=cos(vRot),s=sin(vRot); vec2 r=vec2(c*uv.x-s*uv.y, s*uv.x+c*uv.y); a = smoothstep(1.,.6,abs(r.x)*2.6+abs(r.y)); }
  a *= vCol.a;
  if (a < .004) discard;
  gl_FragColor = vec4(vCol.rgb * a, a);
}`;

export class ParticleSystem {
  constructor(scene, cap, additive, renderOrder = 10) {
    this.cap = cap; this.n = 0;
    const f = (k) => new Float32Array(cap * k);
    this.p = f(3); this.v = f(3); this.life = f(1); this.max = f(1); this.s0 = f(1); this.s1 = f(1);
    this.c = f(4); this.drag = f(1); this.grav = f(1); this.shape = f(1); this.a0 = f(1);
    this.geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(f(3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(f(4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(f(2), 2).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.aPos); this.geo.setAttribute('aCol', this.aCol); this.geo.setAttribute('aSize', this.aSize);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uScale: { value: 400 }, uTime: { value: 0 } },
    });
    if (additive) { this.mat.blending = THREE.CustomBlending; this.mat.blendSrc = THREE.OneFactor; this.mat.blendDst = THREE.OneFactor; }
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = renderOrder;
    scene.add(this.points);
  }
  // Positional args, no allocation. col: r,g,b may exceed 1 for HDR bloom.
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, drag = 1, grav = 0, shape = 0) {
    let i = this.n;
    if (i >= this.cap) i = (Math.random() * this.cap) | 0; else this.n++;
    const i3 = i * 3, i4 = i * 4;
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z;
    this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.c[i4] = r; this.c[i4 + 1] = g; this.c[i4 + 2] = b; this.c[i4 + 3] = a; this.a0[i] = a;
    this.drag[i] = drag; this.grav[i] = grav; this.shape[i] = shape;
  }
  // pxScale = drawing-buffer height / (2*tan(fov/2)) so sizes are in world units.
  update(dt, time, pxScale) {
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uScale.value = pxScale;
    const P = this.aPos.array, C = this.aCol.array, S = this.aSize.array;
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this._kill(i); continue; }
      const i3 = i * 3, i4 = i * 4;
      const dr = Math.pow(this.drag[i], dt);
      this.v[i3] *= dr; this.v[i3 + 1] = this.v[i3 + 1] * dr - this.grav[i] * dt; this.v[i3 + 2] *= dr;
      this.p[i3] += this.v[i3] * dt; this.p[i3 + 1] += this.v[i3 + 1] * dt; this.p[i3 + 2] += this.v[i3 + 2] * dt;
      if (this.p[i3 + 1] < 0.02 && this.grav[i] > 0) { this.p[i3 + 1] = 0.02; this.v[i3 + 1] *= -0.3; this.v[i3] *= 0.6; this.v[i3 + 2] *= 0.6; }
      const t = 1 - this.life[i] / this.max[i];
      P[i3] = this.p[i3]; P[i3 + 1] = this.p[i3 + 1]; P[i3 + 2] = this.p[i3 + 2];
      const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      C[i4] = this.c[i4]; C[i4 + 1] = this.c[i4 + 1]; C[i4 + 2] = this.c[i4 + 2]; C[i4 + 3] = this.a0[i] * (t < 0.1 ? Math.max(fade, 0.6) : fade * fade * (3 - 2 * fade));
      S[i * 2] = this.s0[i] + (this.s1[i] - this.s0[i]) * t; S[i * 2 + 1] = this.shape[i];
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
    this.aPos.clearUpdateRanges(); this.aPos.addUpdateRange(0, this.n * 3);
    this.aCol.clearUpdateRanges(); this.aCol.addUpdateRange(0, this.n * 4);
    this.aSize.clearUpdateRanges(); this.aSize.addUpdateRange(0, this.n * 2);
  }
  _kill(i) {
    const j = --this.n;
    if (i === j) return;
    const cp = (arr, k) => { for (let q = 0; q < k; q++) arr[i * k + q] = arr[j * k + q]; };
    cp(this.p, 3); cp(this.v, 3); cp(this.c, 4);
    this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j];
    this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j]; this.shape[i] = this.shape[j]; this.a0[i] = this.a0[j];
  }
  clear() { this.n = 0; }
}
