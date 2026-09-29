import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { damp, clamp, vnoise } from '../core/util.js';

// Final grade: vignette, chromatic aberration on impact, grain, damage/low-hp tint,
// radial shockwave distortion, level-up bloom flash.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uAberr: { value: 0 }, uVig: { value: 1 },
    uHurt: { value: 0 }, uLow: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 0.9, 0.7) },
    uShock: { value: new THREE.Vector4(0.5, 0.5, -1, 0) }, uAspect: { value: 1 }, uDesat: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: /* glsl */`
  uniform sampler2D tDiffuse; uniform float uTime, uAberr, uVig, uHurt, uLow, uFlash, uAspect, uDesat; uniform vec3 uFlashCol, uTint; uniform vec4 uShock;
  varying vec2 vUv;
  // sine-free hash (sin of large arguments bands into visible streaks on many GPUs)
  float h(vec2 p){ p += fract(uTime * 7.13) * 91.7; vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void main(){
    vec2 uv = vUv;
    // shockwave ring distortion: uShock = (cx, cy, radius, strength)
    if (uShock.z >= 0.) {
      vec2 d = uv - uShock.xy; d.x *= uAspect; float r = length(d);
      float w = smoothstep(.09, 0., abs(r - uShock.z)) * uShock.w;
      uv -= normalize(d + 1e-5) * w * .035 * vec2(1./uAspect, 1.);
    }
    vec2 c = uv - .5; float r2 = dot(c,c);
    float ab = uAberr * .012 + r2 * .0012;
    vec3 col;
    col.r = texture2D(tDiffuse, uv + c*ab).r;
    col.g = texture2D(tDiffuse, uv).g;
    col.b = texture2D(tDiffuse, uv - c*ab).b;
    // grade: cool shadows, warm highlights
    float l = dot(col, vec3(.2126,.7152,.0722));
    col = mix(col, vec3(l), uDesat);
    col *= uTint;
    col += vec3(-.006, -.004, .012) * (1. - smoothstep(0., .25, l));
    // vignette
    float v = smoothstep(.95, .18, r2 * 1.9) ;
    col *= mix(1., v, .78 * uVig);
    // hurt / low hp edge
    float edge = smoothstep(.15, .7, r2*2.2);
    col = mix(col, vec3(.55, .02, .05) * (0.4 + l), edge * uHurt * .75);
    col = mix(col, col * vec3(1.1,.55,.6), edge * uLow * (.55 + .45*sin(uTime*6.)));
    col += uFlashCol * uFlash;
    col += (h(uv*vec2(1920.,1080.)) - .5) * .028;
    gl_FragColor = vec4(col, 1.);
  }`,
};

export class Renderer {
  constructor(container) {
    this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
    this.gl.setPixelRatio(this.pixelRatio);
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = 1.05;
    container.prepend(this.gl.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 260);
    this.composer = new EffectComposer(this.gl);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.7, 0.5, 0.88);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.U = this.grade.uniforms;
    // camera rig state
    this.target = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.dist = 34; this.distTarget = 34; this.pitch = 1.02; // ~58°
    this.trauma = 0; this.kick = new THREE.Vector2(); this.shakeScale = 1;
    this.lead = new THREE.Vector2();
    this.flash = 0; this.hurt = 0; this.aberr = 0; this.shockT = -1; this.shockStr = 0; this.shockPos = new THREE.Vector2();
    this.pxScale = 600;
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight);
    this.gl.setSize(w, h); this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // Keep horizontal coverage reasonable on portrait screens.
    this.camera.fov = w / h < 1 ? 52 : 38;
    this.camera.updateProjectionMatrix();
    this.U.uAspect.value = w / h;
    this.bloom.setSize(w * this.pixelRatio * 0.5, h * this.pixelRatio * 0.5);
    this.pxScale = (h * this.pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
  }
  addTrauma(t) { this.trauma = clamp(this.trauma + t * this.shakeScale, 0, 1); }
  punch(dx, dz, s) { this.kick.x += dx * s * this.shakeScale; this.kick.y += dz * s * this.shakeScale; }
  // world-space shockwave at (x,z)
  shock(x, z, strength = 1) {
    const v = new THREE.Vector3(x, 0.5, z).project(this.camera);
    this.shockPos.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5); this.shockT = 0; this.shockStr = strength;
  }
  follow(px, pz, vx, vz, dt, time, snap = false) {
    this.lead.x = damp(this.lead.x, vx * 0.35, 3, dt); this.lead.y = damp(this.lead.y, vz * 0.35, 3, dt);
    const tx = px + this.lead.x, tz = pz + this.lead.y;
    if (snap) this.target.set(tx, 0, tz);
    else { this.target.x = damp(this.target.x, tx, 7, dt); this.target.z = damp(this.target.z, tz, 7, dt); }
    this.dist = damp(this.dist, this.distTarget, 2.2, dt);
    this.kick.x = damp(this.kick.x, 0, 12, dt); this.kick.y = damp(this.kick.y, 0, 12, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma;
    const sx = (vnoise(time * 22, 1.3) - 0.5) * 2 * s * 1.3, sz = (vnoise(time * 22, 7.7) - 0.5) * 2 * s * 1.3, roll = (vnoise(time * 18, 4.1) - 0.5) * s * 0.05;
    const cx = this.target.x + this.kick.x + sx, cz = this.target.z + this.kick.y + sz;
    this.camera.position.set(cx, Math.sin(this.pitch) * this.dist, cz + Math.cos(this.pitch) * this.dist);
    this.look.set(cx, 0, cz - 1.2);
    this.camera.lookAt(this.look);
    this.camera.rotation.z += roll;
    // post uniforms
    this.flash = damp(this.flash, 0, 6, dt); this.hurt = damp(this.hurt, 0, 4, dt); this.aberr = damp(this.aberr, 0, 5, dt);
    this.U.uFlash.value = this.flash; this.U.uHurt.value = this.hurt; this.U.uAberr.value = this.aberr + s * 0.6;
    this.U.uTime.value = time;
    if (this.shockT >= 0) {
      this.shockT += dt;
      const r = this.shockT * 1.1; this.U.uShock.value.set(this.shockPos.x, this.shockPos.y, r, this.shockStr * Math.max(0, 1 - this.shockT / 0.6));
      if (this.shockT > 0.6) { this.shockT = -1; this.U.uShock.value.z = -1; }
    }
  }
  render() { this.composer.render(); }
}
