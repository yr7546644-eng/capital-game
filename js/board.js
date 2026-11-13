// 3D の盤面(KayKit の六角マスの町)。画面の表示だけを受け持つ
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { LOTS, DISTRICTS, GOODS } from './engine.js';

const HEX = 'assets/kaykit/hex/', CH = 'assets/kaykit/chars/';
const BUILDING = { bread: 'windmill', potion: 'church', tool: 'blacksmith', cloth: 'market' };
const CHAR_OF = ['Knight', 'Mage', 'Barbarian', 'Rogue'];
const loader = new GLTFLoader();
const cache = new Map();
function load(url) { if (!cache.has(url)) cache.set(url, new Promise((res) => loader.load(url, (g) => res(g), undefined, () => res(null)))); return cache.get(url); }
const tinted = new Map();
async function model(name) {
  const g = await load(HEX + name + '.gltf'); if (!g) return new THREE.Group();
  const o = g.scene.clone(true);
  const tint = name === 'hex_grass' ? 0xcdeec0 : null;   // 草を少し緑に
  o.traverse(m => { if (m.isMesh) { m.castShadow = name !== 'hex_grass' && name !== 'hex_water'; m.receiveShadow = true; if (tint) { if (!tinted.has(m.material)) { const c = m.material.clone(); c.color.setHex(tint); tinted.set(m.material, c); } m.material = tinted.get(m.material); } } });
  return o;
}
async function charModel(name) { const g = await load(CH + name + '.glb'); if (!g) return null; const o = SkeletonUtils.clone(g.scene); o.traverse(m => { if (m.isMesh) { m.castShadow = true; } }); return { o, clips: g.animations }; }

export const hexPos = (q, r) => new THREE.Vector3(Math.sqrt(3) * (q + r / 2), 0, 1.5 * r);
const hdist = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;

export class Board {
  constructor(el) {
    this.el = el;
    const R = this.R = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.NoToneMapping;
    el.appendChild(R.domElement);
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x8fd3f4); sc.fog = new THREE.Fog(0x8fd3f4, 26, 60);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x6a7f90, 1.25));
    const sun = this.sun = new THREE.DirectionalLight(0xfff4e2, 1.7); sun.position.set(8, 16, 9); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 }); sun.shadow.bias = -0.0008; sc.add(sun);
    this.cam = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.view = { yaw: Math.PI / 2 + 0.12, pitch: 1.02, dist: 24, tx: 2.6, tz: 0 }; this.homeV = { ...this.view };
    this.lotObjs = new Map(); this.shopObjs = new Map(); this.mixers = []; this.walkers = []; this.labels = [];
    this.clock = new THREE.Clock();
    this.fit(); window.addEventListener('resize', () => this.fit());
    this.bindInput();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  fit() { const w = this.el.clientWidth, h = this.el.clientHeight; this.R.setSize(w, h); this.cam.aspect = w / h; this.cam.fov = w / h < 0.7 ? 46 : 36; this.cam.updateProjectionMatrix(); }
  async build() {
    const lotSet = new Set(LOTS.map(l => l.q + ',' + l.r));
    const jobs = [];
    const deco = ['trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium', 'tree_single_A', 'tree_single_B', 'rock_single_A', 'hill_single_A'];
    let k = 0;
    for (let q = -7; q <= 7; q++) for (let r = -7; r <= 7; r++) {
      const d = hdist(q, r); if (d > 7) continue;
      const p = hexPos(q, r);
      const water = d >= 6 || (q >= 4 && r >= 0 && d >= 4) || (q + r >= 4 && q >= 3);
      jobs.push(model(water ? 'hex_water' : 'hex_grass').then(o => { o.position.copy(p); this.scene.add(o); }));
      if (water || lotSet.has(q + ',' + r)) continue;
      // 町の中心近くはあけて、外側に木や丘を置く
      const h = (q * 73856093 ^ r * 19349663) >>> 0;
      if (d >= 2 && (h % 7 < 3 || d >= 5)) {
        const name = d >= 5 && h % 3 === 0 ? (h % 2 ? 'hills_A_trees' : 'mountain_A_grass_trees') : deco[h % deco.length];
        jobs.push(model(name).then(o => { o.position.copy(p); o.rotation.y = (h % 6) * Math.PI / 3; this.scene.add(o); }));
      } else if (h % 9 === 0) {
        jobs.push(model(['barrel', 'crate_A_big', 'sack', 'wheelbarrow'][h % 4]).then(o => { o.position.copy(p).add(new THREE.Vector3(0.3, 0, 0.2)); o.rotation.y = h % 5; this.scene.add(o); }));
      }
    }
    // 空き地(区画)
    for (const l of LOTS) {
      const p = hexPos(l.q, l.r);
      jobs.push(model('hex_grass').then(o => { o.position.copy(p); this.scene.add(o); this.lotObjs.set(l.id, o); o.traverse(m => { m.userData.lot = l.id; }); }));
      const ring = new THREE.Mesh(this.ringGeo || (this.ringGeo = new THREE.RingGeometry(0.78, 0.9, 6, 1)), this.ringMat || (this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })));
      ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 6; ring.position.copy(p).add(new THREE.Vector3(0, 0.03, 0)); ring.userData.lot = l.id; this.scene.add(ring); (this.rings = this.rings || new Map()).set(l.id, ring);
    }
    // 雲
    for (let i = 0; i < 5; i++) jobs.push(model(i % 2 ? 'cloud_big' : 'cloud_small').then(o => { o.position.set(-14 + i * 7, 10 + (i % 3), (i % 2 ? -14 : 12)); o.scale.setScalar(1.3); o.userData.cloud = 0.2 + i * 0.05; this.scene.add(o); this.clouds = (this.clouds || []).concat(o); }));
    // 空き地の「+」印
    const plusTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.arc(64, 64, 56, 0, 7); x.fill(); x.fillStyle = '#3a7bd5'; x.font = 'bold 92px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('+', 64, 70); return new THREE.CanvasTexture(c); })();
    this.plusMat = new THREE.SpriteMaterial({ map: plusTex, depthTest: false, transparent: true });
    this.plus = new Map();
    for (const l of LOTS) { const s = new THREE.Sprite(this.plusMat); s.scale.set(0.55, 0.55, 1); s.position.copy(hexPos(l.q, l.r)).add(new THREE.Vector3(0, 0.9, 0)); s.userData.lot = l.id; s.renderOrder = 10; this.scene.add(s); this.plus.set(l.id, s); }
    await Promise.all(jobs);
    // 客(4 人の見た目を使い回す)
    this.charProto = await Promise.all(CHAR_OF.map(n => load(CH + n + '.glb')));
  }
  // 状態に合わせて建物を置く
  async sync(S, myId) {
    const want = new Map(S.shops.map(s => [s.id, s]));
    for (const [id, o] of this.shopObjs) if (!want.has(id)) { this.scene.remove(o); this.shopObjs.delete(id); }
    const jobs = [];
    for (const s of S.shops) {
      if (this.shopObjs.has(s.id)) continue;
      const color = S.players[s.owner].color, l = LOTS[s.lot];
      this.shopObjs.set(s.id, null);
      jobs.push(model(`building_${BUILDING[s.g]}_${color}`).then(o => {
        o.position.copy(hexPos(l.q, l.r)); o.rotation.y = (s.lot % 6) * Math.PI / 3 + Math.PI / 6;
        o.traverse(m => { m.userData.shop = s.id; m.userData.lot = s.lot; });
        o.scale.setScalar(0.01); o.userData.pop = 0; this.scene.add(o); this.shopObjs.set(s.id, o);
      }));
    }
    await Promise.all(jobs);
    for (const l of LOTS) { const used = S.shops.some(s => s.lot === l.id); this.plus.get(l.id).visible = !used && S.players[myId] && !S.over; if (this.rings) this.rings.get(l.id).visible = !used; }
  }
  // 開業予定の土地に足場を出す
  async preview(lot, g, color) {
    this.previews = this.previews || new Map();
    const old = this.previews.get(lot); if (old) { this.scene.remove(old); this.previews.delete(lot); }
    if (!g) { this.plus.get(lot).visible = true; return; }
    const o = await model('building_scaffolding'); const l = LOTS[lot];
    o.position.copy(hexPos(l.q, l.r)); o.userData.pop = 0; o.scale.setScalar(0.01);
    o.traverse(m => { m.userData.lot = lot; });
    const f = await model('flag_' + color); f.position.set(0.55, 0, 0.3); o.add(f);
    this.scene.add(o); this.previews.set(lot, o); this.plus.get(lot).visible = false;
    this.popIn = (this.popIn || []).concat(o);
  }
  clearPreview() { if (!this.previews) return; for (const [, o] of this.previews) this.scene.remove(o); this.previews.clear(); }
  async reset() { this.clearPreview(); for (const [, o] of this.shopObjs) if (o) this.scene.remove(o); this.shopObjs.clear(); }
  highlightLot(id) { for (const [k, s] of this.plus) s.scale.setScalar(k === id ? 0.8 : 0.55); }
  // シートが下半分をおおうので、店が画面の上半分に来るようにずらす
  focus(lotId) { const l = LOTS[lotId]; const p = hexPos(l.q, l.r); this.tween = { tx: p.x + 3.2 * Math.sin(this.view.yaw), tz: p.z + 3.2 * Math.cos(this.view.yaw), dist: 13, t: 0 }; }
  home() { this.tween = { tx: this.homeV.tx, tz: this.homeV.tz, dist: this.homeV.dist, t: 0 }; }
  // 月末の客の動き: shops: [{shop, units, profit, color}]
  async playMonth(S, list) {
    if (!this.charProto) return;
    const spawn = [];
    for (const it of list) {
      const s = S.shops.find(x => x.id === it.shop); if (!s) continue;
      const l = LOTS[s.lot], dest = hexPos(l.q, l.r);
      const n = Math.max(1, Math.min(5, Math.round(it.units / (GOODS[s.g].capPer * 0.55))));
      for (let i = 0; i < n; i++) spawn.push({ dest, delay: i * 260 + Math.random() * 200, owner: s.owner });
    }
    for (const sp of spawn.slice(0, 28)) {
      const proto = this.charProto[Math.floor(Math.random() * 4)]; if (!proto) continue;
      const o = SkeletonUtils.clone(proto.scene); o.scale.setScalar(0.22);
      const a = Math.random() * Math.PI * 2, from = sp.dest.clone().add(new THREE.Vector3(Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6));
      o.position.copy(from); o.lookAt(sp.dest.x, 0, sp.dest.z); o.visible = false; this.scene.add(o);
      const mx = new THREE.AnimationMixer(o); const cl = proto.animations.find(c => c.name === 'Walking_A'); if (cl) mx.clipAction(cl).play();
      this.walkers.push({ o, mx, from, to: sp.dest.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4)), t: -sp.delay / 1000, dur: 1.6 + Math.random() * 0.5 });
    }
    // 建物がはねる
    for (const it of list) { const o = this.shopObjs.get(it.shop); if (o) o.userData.bounce = 0.0001; }
  }
  // 建物の上の画面座標(数字のポップ用)
  screenOf(shopId) {
    const o = this.shopObjs.get(shopId); if (!o) return null;
    const v = o.position.clone().add(new THREE.Vector3(0, 1.6, 0)).project(this.cam);
    const r = this.R.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }
  screenOfLot(lotId) { const l = LOTS[lotId]; const v = hexPos(l.q, l.r).add(new THREE.Vector3(0, 1.4, 0)).project(this.cam); const r = this.R.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, vis: v.z < 1 }; }
  bindInput() {
    const el = this.R.domElement; const ptrs = new Map(); let down = null, pinch0 = null;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: this.view.yaw, pitch: this.view.pitch, moved: false }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.view.dist }; } });
    el.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2 && pinch0) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); this.view.dist = Math.max(8, Math.min(26, pinch0.dist * pinch0.d / d)); if (down) down.moved = true; return; }
      if (down) { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 8) down.moved = true; if (down.moved) { this.view.yaw = down.yaw - dx * 0.006; this.view.pitch = Math.max(0.55, Math.min(1.25, down.pitch + dy * 0.004)); this.tween = null; } }
    });
    const up = (e) => {
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null;
      if (down && ptrs.size === 0) { if (!down.moved && performance.now() - down.t < 450) this.tap(e.clientX, e.clientY); down = null; }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { this.view.dist = Math.max(8, Math.min(26, this.view.dist + e.deltaY * 0.01)); }, { passive: true });
  }
  tap(x, y) {
    const r = this.R.domElement.getBoundingClientRect();
    const m = new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, this.cam);
    const objs = [...this.shopObjs.values()].filter(Boolean).concat([...(this.previews || new Map()).values()]).concat([...this.lotObjs.values()]).concat([...this.plus.values()].filter(s => s.visible));
    const hit = ray.intersectObjects(objs, true)[0];
    if (!hit) return;
    let o = hit.object; while (o && o.userData.shop == null && o.userData.lot == null) o = o.parent;
    if (!o) return;
    if (this.onTap) this.onTap({ shop: o.userData.shop ?? null, lot: o.userData.lot });
  }
  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    const v = this.view;
    if (this.tween) { const w = this.tween; const k = 0.08; v.tx += (w.tx - v.tx) * k; v.tz += (w.tz - v.tz) * k; v.dist += (w.dist - v.dist) * k; if (Math.abs(w.tx - v.tx) + Math.abs(w.dist - v.dist) < 0.01) this.tween = null; }
    this.cam.position.set(v.tx + Math.sin(v.yaw) * Math.cos(v.pitch) * v.dist, Math.sin(v.pitch) * v.dist, v.tz + Math.cos(v.yaw) * Math.cos(v.pitch) * v.dist);
    this.cam.lookAt(v.tx, 0, v.tz);
    for (const [, o] of this.shopObjs) {
      if (!o) continue;
      if (o.userData.pop < 1) { o.userData.pop = Math.min(1, o.userData.pop + dt * 2.2); const p = o.userData.pop; const s = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.25 * (1 - p) : 1; o.scale.setScalar(Math.max(0.01, (1 - Math.pow(1 - p, 3)) * s)); }
      if (o.userData.bounce) { o.userData.bounce += dt * 3; const b = o.userData.bounce; o.scale.set(1 + Math.sin(b * 6) * 0.06 * Math.max(0, 1 - b), 1 - Math.sin(b * 6) * 0.06 * Math.max(0, 1 - b), 1 + Math.sin(b * 6) * 0.06 * Math.max(0, 1 - b)); if (b > 1) { o.userData.bounce = 0; o.scale.setScalar(1); } }
    }
    if (this.popIn) for (const o of this.popIn) { if (o.userData.pop < 1) { o.userData.pop = Math.min(1, o.userData.pop + dt * 2.5); o.scale.setScalar(Math.max(0.01, 1 - Math.pow(1 - o.userData.pop, 3))); } }
    for (const [, s] of this.plus) if (s.visible) s.position.y = 0.95 + Math.sin(t * 2.4 + s.userData.lot) * 0.08;
    if (this.clouds) for (const c of this.clouds) { c.position.x += c.userData.cloud * dt; if (c.position.x > 18) c.position.x = -18; }
    for (const w of this.walkers) {
      w.t += dt; if (w.t < 0) continue; w.o.visible = true; w.mx.update(dt);
      const k = Math.min(1, w.t / w.dur); w.o.position.lerpVectors(w.from, w.to, k);
      if (k >= 1) { w.done = (w.done || 0) + dt; const s = 0.22 * Math.max(0, 1 - w.done * 3); w.o.scale.setScalar(Math.max(0.001, s)); }
    }
    this.walkers = this.walkers.filter(w => { if (w.done > 0.4) { this.scene.remove(w.o); return false; } return true; });
    this.R.render(this.scene, this.cam);
    if (this.onFrame) this.onFrame();
  }
}
