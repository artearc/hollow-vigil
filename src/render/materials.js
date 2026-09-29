import * as THREE from 'three';

// ——— GeoBuilder: compose low-poly sculpted models from primitives, baking vertex colour,
// per-vertex glow (emissive strength) and a height-based shade into a single geometry.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3(), _c = new THREE.Color();

export class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.glow = []; this.idx = []; this.vc = 0; }
  // o: { p:[x,y,z], r:[x,y,z], s:[x,y,z]|number, glow, shade:[bottomMul, topMul, y0, y1], jitter }
  add(geo, color, o = {}) {
    const g = geo.index ? geo : geo;
    const s = o.s === undefined ? 1 : o.s;
    _s.set(...(typeof s === 'number' ? [s, s, s] : s));
    _p.set(...(o.p || [0, 0, 0]));
    _e.set(...(o.r || [0, 0, 0]));
    _q.setFromEuler(_e);
    _m.compose(_p, _q, _s);
    _nm.getNormalMatrix(_m);
    const P = g.attributes.position, N = g.attributes.normal;
    _c.set(color);
    const glow = o.glow || 0;
    const sh = o.shade;
    const jit = o.jitter || 0;
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m);
      if (jit) { const h = Math.sin(i * 12.9898 + _v.x * 78.233) * 43758.5453; _v.x += (h - Math.floor(h) - 0.5) * jit; _v.z += (((h * 7.1) % 1 + 1) % 1 - 0.5) * jit; }
      _n.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize();
      this.pos.push(_v.x, _v.y, _v.z); this.nor.push(_n.x, _n.y, _n.z);
      let k = 1;
      if (sh) { const t = Math.min(1, Math.max(0, (_v.y - sh[2]) / (sh[3] - sh[2]))); k = sh[0] + (sh[1] - sh[0]) * t; }
      this.col.push(_c.r * k, _c.g * k, _c.b * k);
      this.glow.push(glow);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(g.index.getX(i) + this.vc);
    else for (let i = 0; i < P.count; i++) this.idx.push(i + this.vc);
    this.vc += P.count;
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('glow', new THREE.Float32BufferAttribute(this.glow, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// Shorthand primitive factories (low poly on purpose — faceted sculpt look).
export const P = {
  box: (w = 1, h = 1, d = 1) => new THREE.BoxGeometry(w, h, d),
  sph: (r = 0.5, ws = 7, hs = 5) => new THREE.SphereGeometry(r, ws, hs),
  cyl: (rt = 0.5, rb = 0.5, h = 1, s = 7, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open),
  cone: (r = 0.5, h = 1, s = 6) => new THREE.ConeGeometry(r, h, s),
  ico: (r = 0.5, d = 0) => new THREE.IcosahedronGeometry(r, d),
  oct: (r = 0.5) => new THREE.OctahedronGeometry(r, 0),
  tor: (r = 0.5, t = 0.1, rs = 5, ts = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc),
  dod: (r = 0.5) => new THREE.DodecahedronGeometry(r, 0),
  cap: (r = 0.3, l = 0.6) => new THREE.CapsuleGeometry(r, l, 2, 6),
};

const NOISE_GLSL = /* glsl */`
float hv_(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vn_(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hv_(i),hv_(i+vec2(1,0)),f.x), mix(hv_(i+vec2(0,1)),hv_(i+vec2(1,1)),f.x), f.y); }
float vn3_(vec3 p){ return vn_(p.xz + p.y*1.37) * .6 + vn_(p.xz*2.1 - p.y*2.7 + 11.3) * .4; }
`;

// Standard lit material with our injections:
//  - per-vertex glow -> emissive (eyes, runes, embers baked into models)
//  - optional world-space grime/variation noise for props (breaks up flat vertex colour)
//  - optional per-instance FX: aFx (hit flash, burn, freeze, curse), aFx2 (elite, wet, dissolve)
//  - cold rim light so creatures separate from the ground
export function makeMaterial({ fx = false, noise = false, rough = 0.85, metal = 0.05, rim = 0.0, rimColor = 0x8fa6ff, glowMul = 3.2, flat = true, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, flatShading: flat, side });
  const uniforms = { uTime: { value: 0 }, uRim: { value: new THREE.Color(rimColor).multiplyScalar(rim) }, uGlowMul: { value: glowMul } };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float glow; varying float vGlow; varying vec3 vWPos; varying vec3 vOPos;
        ${fx ? 'attribute vec4 aFx; attribute vec4 aFx2; varying vec4 vFx; varying vec4 vFx2;' : ''}`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        vGlow = glow; vOPos = position;
        ${fx ? 'vFx = aFx; vFx2 = aFx2;' : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 wp_ = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp_ = instanceMatrix * wp_;
          #endif
          vWPos = (modelMatrix * wp_).xyz; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec3 uRim; uniform float uGlowMul;
        varying float vGlow; varying vec3 vWPos; varying vec3 vOPos;
        ${fx ? 'varying vec4 vFx; varying vec4 vFx2;' : ''}
        ${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${noise ? `{ float n_ = vn3_(vWPos*1.6) * .55 + vn3_(vWPos*6.3) * .45;
             diffuseColor.rgb *= .72 + .56*n_;
             float lichen_ = smoothstep(.62,.8, vn3_(vWPos*.9 + 7.0));
             diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(.55,.75,.6), lichen_*.6);
             diffuseColor.rgb *= mix(.45, 1., smoothstep(0., 1.2, vWPos.y)); }` : ''}
        ${fx ? `{ float dn_ = vn3_(vOPos*5.0);
             if (vFx2.z > 0.001 && dn_ < vFx2.z) discard;
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.55,.8,1.), vFx.z*.65);
             diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(.5,.6,.85), vFx2.y*.6); }` : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vColor.rgb * vGlow * uGlowMul;
        { float rim_ = pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 2.5);
          totalEmissiveRadiance += uRim * rim_;
          ${fx ? `float fl_ = 0.5 + 0.5*sin(uTime*23. + vWPos.x*3.);
          totalEmissiveRadiance += vFx.x * vFx.x * vec3(0.9,0.8,0.72) * (0.5 + rim_);
          totalEmissiveRadiance += vFx.y * vec3(1.1,.32,.05) * (0.55 + 0.6*fl_) * (0.4 + rim_);
          totalEmissiveRadiance += vFx.z * vec3(.15,.45,.8) * (.4 + rim_*1.5);
          totalEmissiveRadiance += vFx.w * vec3(.5,.08,.85) * (.25 + rim_*1.6);
          totalEmissiveRadiance += vFx2.x * vec3(1.2,.75,.2) * rim_ * 2.2;
          float de_ = vn3_(vOPos*5.0);
          if (vFx2.z > 0.001) totalEmissiveRadiance += smoothstep(vFx2.z + .12, vFx2.z, de_) * vec3(3.,1.1,.3);` : ''} }`);
  };
  m.customProgramCacheKey = () => `vc-${fx}-${noise}`;
  return m;
}
