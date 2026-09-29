import * as THREE from 'three';
import { makeMaterial } from '../render/materials.js';
import { Decals } from '../render/ground.js';
import { makeGroundTextures, makeShaftTexture, DECAL } from '../render/textures.js';
import * as PR from './props.js';
import { mulberry32, rand, TAU, fbm } from '../core/util.js';
import { MAPS } from '../game/data.js';

export const WORLD_R = 94;

// Builds an authored arena: composed landmarks first, then scatter that respects them.
export class World {
  constructor(G, mapId) {
    this.G = G; this.mapId = mapId; this.map = MAPS[mapId];
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.colliders = []; this.cgrid = new Map(); this.torches = []; this.shrineSpots = [];
    this.instGroups = new Map();
    this.rnd = mulberry32(mapId === 'nave' ? 1337 : 4242);
    this.propMat = makeMaterial({ noise: true, rough: 0.92, rim: 0.0 });
    this.propMatMetal = makeMaterial({ noise: true, rough: 0.5, metal: 0.4 });
    this.buildLights();
    this.buildGround();
    if (mapId === 'nave') this.composeNave(); else this.composeThornwood();
    this.scatter();
    this.boundary();
    this.flushInstances();
    this.atmoT = 0;
  }
  // ——— lights / sky ———
  buildLights() {
    const m = this.map, s = this.G.scene;
    s.background = new THREE.Color(m.fog);
    s.fog = new THREE.FogExp2(m.fog, m.fogDensity);
    this.hemi = new THREE.HemisphereLight(m.sky, m.groundCol, m.hemiI); s.add(this.hemi);
    this.moon = new THREE.DirectionalLight(m.moon, m.moonI);
    this.moon.position.set(-18, 40, -10); this.moon.castShadow = true;
    const sc = this.moon.shadow.camera; sc.left = sc.bottom = -34; sc.right = sc.top = 34; sc.near = 5; sc.far = 110;
    this.moon.shadow.mapSize.set(2048, 2048); this.moon.shadow.bias = -0.0006; this.moon.shadow.normalBias = 0.04;
    s.add(this.moon); s.add(this.moon.target);
    this.torchLights = [];
    for (let i = 0; i < 5; i++) { const l = new THREE.PointLight(m.torch, 0, 16, 1.7); s.add(l); this.torchLights.push(l); }
  }
  buildGround() {
    const { map, nrm } = makeGroundTextures(this.mapId === 'nave' ? 7 : 21, this.mapId);
    const rep = 240 / 7;
    map.repeat.set(rep, rep); nrm.repeat.set(rep, rep);
    const mat = new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.88, metalness: 0.0 });
    const nave = this.mapId === 'nave' ? 1 : 0;
    const U = { uDirt: { value: new THREE.Color(nave ? 0x241a17 : 0x1a1d15) }, uMoss: { value: new THREE.Color(nave ? 0x223026 : 0x2b3a22) }, uNave: { value: nave }, uR: { value: WORLD_R },
      uSeal: { value: Decals.atlas }, uSealP: { value: new THREE.Vector4(0, 0, nave ? 24 : 20, 1) }, uBrass: { value: new THREE.Color(nave ? 0x8a6a3a : 0x5a7a5a) }, uSealGlow: { value: new THREE.Color(nave ? 0x3c1405 : 0x0e3a20) }, uTime: { value: 0 } };
    this.groundU = U;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvW = (modelMatrix * vec4(transformed,1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vW; uniform vec3 uDirt, uMoss, uBrass, uSealGlow; uniform float uNave, uR, uTime; uniform sampler2D uSeal; uniform vec4 uSealP; float sealA;
        float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float gn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(gh(i),gh(i+vec2(1,0)),f.x), mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x), f.y); }
        float gf(vec2 p){ return gn(p)*.5 + gn(p*2.1)*.3 + gn(p*4.3)*.2; }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        { vec2 p = vW.xz; float n = gf(p*.08);
          float sd;
          if (uNave > .5) {
            float nave = max(abs(p.x) - 13., max(p.y - (-6.), -86. - p.y));
            float plaza = length(p) - 19.;
            float road = max(abs(p.x + sin(p.y*.05)*4.) - 4.5, -p.y);
            float crypt = length(p - vec2(42., 8.)) - 13.;
            sd = min(min(nave, plaza), min(road, crypt));
          } else {
            float glade = length(p) - 11.;
            float path = abs(p.x*.7 + sin(p.y*.07)*9.) - 3.;
            sd = min(glade, path);
          }
          float stone = 1. - smoothstep(-2., 3., sd + (n - .5) * 9.);
          stone = max(stone, smoothstep(.72, .8, gf(p*.13 + 3.)) * .7);
          vec3 dirt = uDirt * (.6 + .8*gf(p*.6)) ;
          dirt = mix(dirt, uMoss * (.7+.5*gn(p*1.3)), smoothstep(.55,.75, gf(p*.11+9.)) * .8);
          diffuseColor.rgb = mix(dirt, diffuseColor.rgb, stone);
          float wet = smoothstep(.66, .72, gf(p*.05 + 20.));
          diffuseColor.rgb *= 1. - wet*.35;
          float edge = smoothstep(uR - 8., uR + 6., length(p));
          diffuseColor.rgb *= 1. - edge*.92;
          // lit brass inlay of the Hollow Eye seal
          sealA = 0.;
          vec2 su = (p - uSealP.xy) / uSealP.z + .5;
          if (uSealP.w > .5 && su.x > 0. && su.x < 1. && su.y > 0. && su.y < 1.) {
            vec2 au = (su + vec2(3., 0.)) * .25; au.y = 1. - au.y;
            sealA = texture2D(uSeal, au).a;
            diffuseColor.rgb = mix(diffuseColor.rgb, uBrass * (.75 + .5*gn(p*3.)), sealA * .9);
          }
        }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          { float wet2 = smoothstep(.66, .72, gf(vW.xz*.05 + 20.)); roughnessFactor = mix(roughnessFactor, .25, wet2); roughnessFactor = mix(roughnessFactor, .5, sealA); }`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          metalnessFactor = mix(metalnessFactor, .35, sealA);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += uSealGlow * sealA * (.55 + .45 * sin(uTime * .8 + length(vW.xz) * .35));`);
    };
    const g = new THREE.PlaneGeometry(240, 240, 1, 1); g.rotateX(-Math.PI / 2);
    this.ground = new THREE.Mesh(g, mat); this.ground.receiveShadow = true; this.root.add(this.ground);
  }
  // ——— instancing helpers ———
  place(key, geoFn, x, z, { rot = this.rnd() * TAU, s = 1, col = 0, mat = this.propMat, shadow = true, y = 0 } = {}) {
    let grp = this.instGroups.get(key);
    if (!grp) { grp = { geo: geoFn(), mat, shadow, list: [] }; this.instGroups.set(key, grp); }
    grp.list.push({ x, y, z, rot, s });
    if (col) this.addCollider(x, z, col * s);
  }
  flushInstances() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const [, g] of this.instGroups) {
      const im = new THREE.InstancedMesh(g.geo, g.mat, g.list.length);
      g.list.forEach((it, i) => { q.setFromAxisAngle(up, it.rot); p.set(it.x, it.y, it.z); sc.setScalar(it.s); m.compose(p, q, sc); im.setMatrixAt(i, m); });
      im.castShadow = g.shadow; im.receiveShadow = true; im.computeBoundingSphere();
      this.root.add(im);
    }
  }
  addCollider(x, z, r) {
    const c = { x, z, r }; this.colliders.push(c);
    const cs = 8, x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs), z0 = Math.floor((z - r) / cs), z1 = Math.floor((z + r) / cs);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 1000 + j; if (!this.cgrid.has(k)) this.cgrid.set(k, []); this.cgrid.get(k).push(c); }
  }
  // Push a circle out of static colliders + keep inside world. Mutates o.x/o.z. Returns true if pushed.
  resolve(o, r) {
    const cs = 8; const k = Math.floor(o.x / cs) * 1000 + Math.floor(o.z / cs);
    const l = this.cgrid.get(k); let hit = false;
    if (l) for (let i = 0; i < l.length; i++) {
      const c = l[i], dx = o.x - c.x, dz = o.z - c.z, rr = c.r + r, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) { const d = Math.sqrt(d2) || 0.001; o.x = c.x + (dx / d) * rr; o.z = c.z + (dz / d) * rr; hit = true; }
    }
    const d = Math.hypot(o.x, o.z);
    if (d > WORLD_R) { o.x *= WORLD_R / d; o.z *= WORLD_R / d; hit = true; }
    return hit;
  }
  blocked(x, z, r = 1) {
    const k = Math.floor(x / 8) * 1000 + Math.floor(z / 8); const l = this.cgrid.get(k);
    if (l) for (const c of l) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return true;
    return Math.hypot(x, z) > WORLD_R - 2;
  }
  torch(x, z, kind = 'brazier') {
    if (kind === 'brazier') this.place('brazier', PR.brazier, x, z, { col: 0.5 });
    this.torches.push({ x, y: kind === 'brazier' ? 1.6 : 0.6, z, phase: this.rnd() * 10 });
  }
  // ——— compositions ———
  composeNave() {
    const r = this.rnd, D = this.G.fx;
    // central sigil plaza
    // the Hollow Eye seal is inlaid in the ground shader (lit brass)
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.26; this.place('obelisk', PR.obelisk, Math.cos(a) * 14, Math.sin(a) * 14, { col: 0.8, rot: -a }); this.torches.push({ x: Math.cos(a) * 14, y: 0.6, z: Math.sin(a) * 14, phase: i, small: true }); }
    // nave colonnade
    for (let z = -16; z >= -76; z -= 7.5) {
      for (const s of [-1, 1]) {
        const x = s * 10.5, roll = r();
        const kind = roll < 0.55 ? 'full' : roll < 0.85 ? 'broken' : 'stump';
        this.place('pillar_' + kind, () => PR.pillar(kind), x, z, { col: 1.05, rot: r() * 0.2 });
        if (kind === 'stump' && r() < 0.8) this.place('fallen', PR.fallenColumn, x - s * 3.5, z + rand(-1, 1), { rot: s > 0 ? Math.PI + rand(-0.4, 0.4) : rand(-0.4, 0.4), col: 0 });
      }
      if (z < -20 && z > -70) for (const s of [-1, 1]) if (r() < 0.75) this.place('pew', PR.pew, s * 5 + rand(-0.5, 0.5), z + 3.5, { rot: rand(-0.35, 0.35) + (r() < 0.15 ? 1.2 : 0), shadow: true });
      if (r() < 0.6) this.torch(r() < 0.5 ? -7 : 7, z + 3.7);
    }
    // light shafts through the broken roof
    this.shafts([[-4, -30], [3, -45], [-2, -60], [5, -24], [0, -72]], 0x9aa8ff);
    // apse and colossus
    const col = new THREE.Mesh(PR.colossus(false), this.propMat); col.position.set(0, 0, -92); col.castShadow = col.receiveShadow = true; this.root.add(col);
    this.addCollider(0, -92, 6.5);
    for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; this.place('pillar_full', () => PR.pillar('full'), Math.cos(a) * 15, -84 + Math.sin(a) * 10, { col: 1.05 }); }
    this.torches.push({ x: 0, y: 1, z: -86, phase: 0, big: true });
    D.glow.add(0, -84, 14, DECAL.RUNES, 0.5, 0.25, 0.06, 0.5, 1e9, 0);
    // graveyard (west)
    for (let i = 0; i < 70; i++) {
      const gx = -30 - (i % 10) * 4.2 + rand(-0.8, 0.8), gz = -30 + ((i / 10) | 0) * 7 + rand(-1, 1);
      if (r() < 0.2) continue;
      this.place('tomb' + (i % 3), () => PR.tombstone(i % 3), gx, gz, { rot: rand(-0.25, 0.25) + (r() < 0.1 ? 0.6 : 0), col: 0.45 });
    }
    this.place('mausoleum', PR.mausoleum, -52, 22, { rot: 0.1, col: 3.2 });
    this.place('mausoleum', PR.mausoleum, -68, -34, { rot: 2.9, col: 3.2 });
    for (let i = 0; i < 12; i++) this.place('tree' + (i % 3), () => PR.deadTree(3 + (i % 3) * 11, 1.2), -30 - r() * 50, -40 + r() * 80, { col: 0.6, s: rand(0.9, 1.5) });
    // drowned crypt (east): pools, arches, crystals
    this.water([[42, 8, 9], [58, -10, 6], [34, 24, 5], [66, 18, 7]]);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; this.place('arch', PR.arch, 42 + Math.cos(a) * 14, 8 + Math.sin(a) * 14, { rot: -a + Math.PI / 2, col: 0 }); const ax = 42 + Math.cos(a) * 14, az = 8 + Math.sin(a) * 14; this.addCollider(ax + Math.sin(a) * 3, az - Math.cos(a) * 3, 1); this.addCollider(ax - Math.sin(a) * 3, az + Math.cos(a) * 3, 1); }
    for (let i = 0; i < 14; i++) this.place('crystal', () => PR.crystals(0xa877ff), 30 + r() * 45, -30 + r() * 60, { s: rand(0.8, 1.8), col: 0.4 });
    for (let i = 0; i < 18; i++) this.place('mush', () => PR.mushrooms(0x6fffe0), 28 + r() * 50, -35 + r() * 70, { s: rand(0.8, 1.6) });
    // pilgrim road (south): walls, braziers, cages
    for (let z = 14; z < 80; z += 9) { this.torch(-7 + Math.sin(z * 0.05) * -4, z); this.torch(7 + Math.sin(z * 0.05) * -4, z + 4); }
    for (let i = 0; i < 10; i++) { const x = (r() < 0.5 ? -1 : 1) * rand(12, 30), z = rand(20, 85); this.place('wall', () => PR.brokenWall(6), x, z, { rot: r() * TAU, col: 0 }); this.addCollider(x, z, 2.2); }
    for (let i = 0; i < 6; i++) this.place('cage', PR.cage, rand(-20, 20), rand(25, 80), { col: 0.7 });
    // statues flanking plaza exits
    for (const [x, z, a] of [[-8, -12, 0.3], [8, -12, -0.3], [-18, 6, 1.4], [18, 6, -1.4], [-6, 18, 3], [6, 18, 3.3]]) this.place('statue', PR.hoodedStatue, x, z, { rot: a, col: 1 });
    this.shrineSpots = [[-44, -6, 'blood'], [46, -26, 'bell'], [0, 52, 'grace'], [-24, -70, 'bell'], [62, 40, 'blood'], [-60, 50, 'grace']];
  }
  composeThornwood() {
    const r = this.rnd, D = this.G.fx;
    // the Mother Root at the north
    const col = new THREE.Mesh(PR.colossus(true), this.propMat); col.position.set(0, 0, -80); col.castShadow = col.receiveShadow = true; this.root.add(col); this.addCollider(0, -80, 6.5);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; this.place('pyr', PR.skullPyramid, Math.cos(a) * 13, Math.sin(a) * 13, { col: 1.1 }); this.torches.push({ x: Math.cos(a) * 13, y: 1.4, z: Math.sin(a) * 13, phase: i, small: true }); }
    // dense forest with clearings
    for (let i = 0; i < 190; i++) {
      const a = r() * TAU, d = 16 + Math.sqrt(r()) * 74; const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.abs(x * 0.7 + Math.sin(z * 0.07) * 9) < 5) continue; // keep the path open
      if (fbm(x * 0.04, z * 0.04, 2) < 0.42) continue; // clearings
      this.place('stree' + (i % 4), () => PR.deadTree(5 + (i % 4) * 7, 1.5, true), x, z, { col: 0.7, s: rand(0.9, 1.7) });
    }
    for (let i = 0; i < 60; i++) this.place('thorn', PR.thornRoot, rand(-85, 85), rand(-85, 85), { s: rand(0.8, 1.6), shadow: false });
    for (let i = 0; i < 40; i++) this.place('bones', PR.bonePile, rand(-80, 80), rand(-80, 80), { s: rand(0.9, 1.5), shadow: false });
    for (let i = 0; i < 40; i++) this.place('mushg', () => PR.mushrooms(0x9dff6a), rand(-85, 85), rand(-85, 85), { s: rand(1, 2) });
    for (let i = 0; i < 16; i++) this.place('cage', PR.cage, rand(-70, 70), rand(-70, 70), { col: 0.7 });
    for (let i = 0; i < 26; i++) { const a = r() * TAU, d = rand(18, 80); this.torch(Math.cos(a) * d, Math.sin(a) * d); }
    this.water([[30, 30, 8], [-40, 20, 10], [20, -50, 7]]);
    this.shafts([[-10, -20], [14, 10], [-30, 40], [36, -20]], 0xa8ffd8);
    this.shrineSpots = [[-38, -30, 'blood'], [40, -40, 'bell'], [4, 46, 'grace'], [-60, 30, 'bell'], [58, 20, 'blood'], [-10, -60, 'grace']];
  }
  scatter() {
    const r = this.rnd, D = this.G.fx, nave = this.mapId === 'nave';
    for (let i = 0; i < 150; i++) {
      const x = rand(-88, 88), z = rand(-88, 88); if (Math.hypot(x, z) < 12 || Math.hypot(x, z) > 90) continue;
      const roll = r();
      if (roll < 0.35) this.place('rock' + (i % 2), () => PR.rock(i % 2), x, z, { s: rand(0.6, 1.6), col: 0.9 });
      else if (roll < 0.55) this.place('bones', PR.bonePile, x, z, { s: rand(0.8, 1.4), shadow: false });
      else if (roll < 0.72) this.place('candles', PR.candleCluster, x, z, { shadow: false });
      else if (roll < 0.86 && nave) this.place('thorn', PR.thornRoot, x, z, { s: rand(0.8, 1.4), shadow: false });
      else this.place('rock0', () => PR.rock(0), x, z, { s: rand(0.3, 0.6) });
    }
    // ground memory: old blood, cracks, stray glyphs
    for (let i = 0; i < 140; i++) {
      const x = rand(-88, 88), z = rand(-88, 88), k = r();
      if (k < 0.45) D.decals.add(x, z, rand(1.5, 4), DECAL.CRACK, 0.015, 0.012, 0.015, 0.75, 1e9);
      else if (k < 0.7) D.decals.add(x, z, rand(1.5, 3.5), DECAL.POOL, 0.045, 0.004, 0.007, 0.65, 1e9);
      else if (k < 0.85) D.decals.add(x, z, rand(3, 6), DECAL.SCORCH, 0.01, 0.008, 0.01, 0.5, 1e9);
      else D.glow.add(x, z, rand(2, 4), r() < 0.5 ? DECAL.RUNES : DECAL.SIGIL, nave ? 0.16 : 0.05, nave ? 0.05 : 0.18, nave ? 0.02 : 0.1, 0.3, 1e9);
    }
  }
  boundary() {
    // ring of monoliths and rubble at the edge of the world, sinking into fog
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * TAU + rand(-0.02, 0.02), d = WORLD_R + rand(3, 9);
      this.place('edge' + (i % 2), () => PR.rock(1), Math.cos(a) * d, Math.sin(a) * d, { s: rand(2.2, 4.2), shadow: false });
      if (i % 3 === 0) this.place('pillar_broken', () => PR.pillar('broken'), Math.cos(a) * (d + 2), Math.sin(a) * (d + 2), { s: rand(1, 1.6), shadow: false });
    }
  }
  water(list) {
    const mat = new THREE.MeshStandardMaterial({ color: this.mapId === 'nave' ? 0x0a0c14 : 0x08100c, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.88 });
    for (const [x, z, rad] of list) {
      const g = new THREE.CircleGeometry(rad, 24); g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position; for (let i = 1; i < pos.count; i++) { const k = 0.8 + fbm(pos.getX(i) * 0.3 + x, pos.getZ(i) * 0.3, 2) * 0.45; pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
      const m = new THREE.Mesh(g, mat); m.position.set(x, 0.04, z); m.receiveShadow = true; this.root.add(m);
      (this.pools || (this.pools = [])).push({ x, z, r: rad * 0.85 });
    }
  }
  // Moonlight falling through the broken roof. From a top-down camera a vertical shaft reads as a
  // thin line, so the light is told on the floor instead: a cold pool with dust turning inside it.
  shafts(list, color) {
    const c = new THREE.Color(color);
    this.moonPools = list.map(([x, z]) => ({ x, z, c }));
    for (const [x, z] of list) {
      this.G.fx.glow.add(x, z, 7, DECAL.SOFT, c.r * 0.16, c.g * 0.16, c.b * 0.2, 0.9, 1e9, 0);
      this.G.fx.glow.add(x + 0.6, z - 0.4, 3.5, DECAL.SOFT, c.r * 0.12, c.g * 0.12, c.b * 0.14, 0.9, 1e9, 0);
    }
  }
  inWater(x, z) { if (!this.pools) return false; for (const p of this.pools) if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r) return true; return false; }

  update(dt, time, cx, cz) {
    const fx = this.G.fx, m = this.map;
    // shadow camera follows the player
    this.moon.position.set(cx - 18, 40, cz - 10); this.moon.target.position.set(cx, 0, cz);
    // assign pooled point lights to nearest torches
    if (!this._near || this._near.length !== this.torches.length) this._near = this.torches.map((t) => ({ t, d: 0 }));
    const near = this._near;
    for (const n of near) n.d = (n.t.x - cx) ** 2 + (n.t.z - cz) ** 2;
    near.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.torchLights.length; i++) {
      const L = this.torchLights[i], n = near[i];
      if (!n || n.d > 30 * 30) { L.intensity = 0; continue; }
      const t = n.t; const f = 0.8 + 0.2 * Math.sin(time * 11 + t.phase) * Math.sin(time * 7.3 + t.phase * 2);
      L.position.set(t.x, t.y + 1.2, t.z); L.intensity = (t.big ? 90 : t.small ? 14 : 30) * f;
    }
    // flames for visible torches
    for (const { t, d } of near) {
      if (d > 34 * 34) break;
      if (t.shrine) continue;
      if (Math.random() < (t.small ? 0.35 : 0.9)) fx.flame(t.x, t.y, t.z, t.small ? 0.5 : t.big ? 1.6 : 1, this.mapId === 'nave' ? null : [0.8, 2.6, 1.3]);
    }
    // atmosphere: ash, drifting mist, spirit motes
    this.atmoT += dt;
    const nave = this.mapId === 'nave';
    while (this.atmoT > 0.03) {
      this.atmoT -= 0.03;
      const x = cx + rand(-26, 26), z = cz + rand(-20, 16);
      if (Math.random() < 0.6) fx.add.spawn(x, rand(1.5, 7), z, rand(-0.3, 0.6), rand(-0.6, -0.2), rand(-0.2, 0.3), rand(4, 7), rand(0.08, 0.14), 0.04, nave ? 1.1 : 0.35, nave ? 0.38 : 1.0, nave ? 0.12 : 0.45, 0.7, 1, 0, 0);
      if (Math.random() < 0.28) fx.smoke.spawn(x, rand(0.2, 1.2), z, rand(0.2, 0.7), 0.02, rand(-0.2, 0.2), rand(5, 8), rand(5, 8), rand(9, 13), nave ? 0.07 : 0.06, nave ? 0.065 : 0.085, nave ? 0.1 : 0.075, 0.2, 1, 0, 2);
    }
    this.groundU.uTime.value = time;
    if (this.moonPools) for (const p of this.moonPools) {
      if ((p.x - cx) ** 2 + (p.z - cz) ** 2 > 40 * 40 || Math.random() > 0.35) continue;
      const a = rand(0, TAU), r = rand(0, 3);
      fx.add.spawn(p.x + Math.cos(a) * r, rand(0.3, 4), p.z + Math.sin(a) * r, rand(-0.15, 0.15), rand(-0.05, 0.12), rand(-0.15, 0.15), rand(2.5, 4), rand(0.05, 0.09), 0.03, p.c.r * 0.9, p.c.g * 0.9, p.c.b, 0.8, 1, 0, 0);
    }
  }
  dispose() {
    this.G.scene.remove(this.root);
    for (const l of [this.hemi, this.moon, this.moon.target, ...this.torchLights]) this.G.scene.remove(l);
    this.moon.shadow.map?.dispose();
    // free GPU memory: every run builds a fresh world
    const seen = new Set();
    this.root.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) { if (seen.has(m)) continue; seen.add(m); for (const k of ['map', 'normalMap']) if (m[k] && m[k] !== Decals.atlas) m[k].dispose(); m.dispose(); }
    });
  }
}
