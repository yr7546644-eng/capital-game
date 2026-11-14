// 3D の盤面(KayKit の六角マスの町)。画面の表示だけを受け持つ
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { LOTS, DISTRICTS, GOODS, STAGES, RES, PROC, COLOR_HEX, ROADS, ROAD_CELLS, MARKS } from './engine.js';

const HEX = 'assets/kaykit/hex/', CH = 'assets/kaykit/chars/';
const BUILDING = { bread: 'windmill', potion: 'church', tool: 'blacksmith', cloth: 'market' };
const WORKB = { wheat: 'watermill', wool: 'watermill', iron: 'lumbermill', herb: 'lumbermill' };
// 看板(業種のアイコン + 持ち主の色)
const signCache = new Map();
// 店の上の札: 持ち主の顔(色の輪)+ 名前のリボン + 業種の絵。絵文字は使わない
const imgCache = new Map();
function getImg(src, cb) { let e = imgCache.get(src); if (!e) { e = { img: new Image(), ok: false, cbs: [] }; e.img.onload = () => { e.ok = true; e.cbs.splice(0).forEach(f => f()); }; e.img.src = src; imgCache.set(src, e); } if (!e.ok && cb) e.cbs.push(cb); return e.ok ? e.img : null; }
function signTex(o) {
  const key = JSON.stringify(o); if (signCache.has(key)) return signCache.get(key);
  const c = document.createElement('canvas'); c.width = 192; c.height = 232; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    x.clearRect(0, 0, 192, 232);
    const cx = 96, cy = 96, R = 70;
    if (o.me) { x.fillStyle = '#ffd36e'; x.beginPath(); x.arc(cx, cy, R + 14, 0, 7); x.fill(); }
    x.fillStyle = o.color; x.beginPath(); x.arc(cx, cy, R + 6, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, R - 4, 0, 7); x.fill();
    const face = o.face && getImg(o.face, () => { draw(); t.needsUpdate = true; });
    if (face) { x.save(); x.beginPath(); x.arc(cx, cy, R - 6, 0, 7); x.clip(); x.drawImage(face, cx - R - 6, cy - R + 2, (R + 6) * 2, (R + 6) * 2); x.restore(); if (o.dull) { x.fillStyle = 'rgba(80,90,110,.45)'; x.beginPath(); x.arc(cx, cy, R - 6, 0, 7); x.fill(); } }
    const ic = o.icon && getImg(o.icon, () => { draw(); t.needsUpdate = true; });
    if (ic) { x.fillStyle = '#fff'; x.beginPath(); x.arc(158, 40, 34, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = o.color; x.stroke(); x.drawImage(ic, 128, 10, 60, 60); }
    // 名前のリボン
    const w = Math.min(184, 40 + o.name.length * 30), y = 176;
    x.fillStyle = o.me ? '#e09a00' : o.color; x.beginPath(); x.roundRect(cx - w / 2, y, w, 46, 18); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.name, cx, y + 24);
    if (o.isNew) { x.fillStyle = '#ff3b5c'; x.beginPath(); x.roundRect(4, 6, 76, 34, 12); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 24px sans-serif'; x.fillText('NEW', 42, 24); }
    if (o.hot) { x.fillStyle = '#ff7a1a'; x.beginPath(); x.roundRect(6, 128, 64, 34, 14); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText('繁盛', 38, 146); }
    if (o.dull) { x.fillStyle = '#6b7280'; x.beginPath(); x.roundRect(6, 128, 64, 34, 14); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText('赤字', 38, 146); }
  };
  draw(); signCache.set(key, t); return t;
}
const CHAR_OF = ['Knight', 'Mage', 'Barbarian', 'Rogue', 'Rogue_Hooded'];
const loader = new GLTFLoader();
const cache = new Map();
function load(url) { if (!cache.has(url)) cache.set(url, new Promise((res) => loader.load(url, (g) => res(g), undefined, () => res(null)))); return cache.get(url); }
const tinted = new Map();
const THEME = { snow: false };
async function model(name) {
  const g = await load(HEX + name + '.gltf'); if (!g) return new THREE.Group();
  const o = g.scene.clone(true);
  const tint = name === 'hex_grass' ? (THEME.snow ? 0xf4f8ff : 0xcdeec0) : (THEME.snow && /tree|hill|mountain/.test(name) ? 0xe8f0ff : null);   // 草を少し緑に(雪の町は白く)
  o.traverse(m => { if (m.isMesh) { m.castShadow = name !== 'hex_grass' && name !== 'hex_water'; m.receiveShadow = true; if (tint) { const key = m.material.uuid + tint + (THEME.snow && name === 'hex_grass'); if (!tinted.has(key)) { const c = m.material.clone(); c.color.setHex(tint); if (THEME.snow && name === 'hex_grass') { c.map = null; c.color.setHex(0xf1f6fc); } tinted.set(key, c); } m.material = tinted.get(key); } } });
  return o;
}
async function charModel(name) { const g = await load(CH + name + '.glb'); if (!g) return null; const o = SkeletonUtils.clone(g.scene); o.traverse(m => { if (m.isMesh) { m.castShadow = true; } }); return { o, clips: g.animations }; }

// 町の飾りの建物(プレイヤーの店と見分けやすいよう、少し小さく落ち着いた色にする)
const TOWN = {
  hill: [['building_home_A_yellow', 0.72], ['building_home_B_yellow', 0.72], ['building_home_B_red', 0.7], ['building_home_B_green', 0.7], ['building_home_B_blue', 0.7], ['building_home_A_yellow', 0.72], ['tree_single_A', 0.9]],
  plaza: [['tent', 0.9], ['building_stage_A', 0.75], ['building_well_yellow', 0.75], ['tent', 0.9], ['crate_open', 0.9], ['building_stage_B', 0.7], ['barrel', 1]],
  port: [['crate_long_A', 0.9], ['crate_long_B', 0.9], ['pallet', 0.9], ['barrel', 1], ['crate_A_big', 1], ['tent', 0.85], ['building_home_A_yellow', 0.68]],
  noble: [['building_tower_A_yellow', 0.62], ['building_home_B_blue', 0.72], ['building_tavern_yellow', 0.66], ['tree_single_B', 0.9], ['building_home_B_red', 0.72]],
  mine: [['resource_stone', 1], ['resource_lumber', 1], ['wheelbarrow', 1], ['building_mine_yellow', 0.66], ['sack', 1], ['ladder', 0.9]],
};
const townPiece = (kind, h) => { const L = TOWN[kind] || TOWN.hill; return L[h % L.length]; };
const muted = new Map();
function mute(o) { o.traverse(m => { if (!m.isMesh) return; const k = m.material.uuid; if (!muted.has(k)) { const c = m.material.clone(); c.color.lerp(new THREE.Color(0xe9dfcc), 0.38); muted.set(k, c); } m.material = muted.get(k); }); }
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
    sc.background = new THREE.Color(0x8fd3f4); sc.fog = new THREE.Fog(0x8fd3f4, 40, 85);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x6a7f90, 1.25));
    const sun = this.sun = new THREE.DirectionalLight(0xfff4e2, 1.7); sun.position.set(12, 24, 13); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0008; sc.add(sun);
    this.cam = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.view = { yaw: Math.PI / 2 + 0.12, pitch: 1.0, dist: 34, tx: 4, tz: 0 }; this.homeV = { ...this.view };
    this.lotObjs = new Map(); this.shopObjs = new Map(); this.mixers = []; this.walkers = []; this.labels = [];
    this.clock = new THREE.Clock();
    this.fit(); window.addEventListener('resize', () => this.fit());
    this.bindInput();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  fit() { const w = this.el.clientWidth, h = this.el.clientHeight; this.R.setSize(w, h); this.cam.aspect = w / h; this.cam.fov = w / h < 0.7 ? 46 : 36; this.cam.updateProjectionMatrix(); }
  async build(stageId = 'rose') {
    this.terr = new Map(); this.flags = new Map();
    this.peddlerObj = null;
    this.signs = new Map(); this.bunting = null; this.trafficPer = 2; this.folkN = 0; this.folk = []; this.traffic = []; this.crowd = new Map(); this.crowdMx = [];
    const st = STAGES[stageId] || STAGES.rose;
    THEME.snow = st.theme === 'snow';
    if (this.world) this.scene.remove(this.world);
    const W = this.world = new THREE.Group(); this.scene.add(W);
    this.lotObjs = new Map(); this.shopObjs = new Map(); this.clouds = []; this.previews = new Map(); this.rings = new Map(); this.plus = new Map();
    const bg = THEME.snow ? 0xcfe4f5 : 0x8fd3f4; this.scene.background.setHex(bg); this.scene.fog.color.setHex(bg);
    const lotSet = new Set(LOTS.map(l => l.q + ',' + l.r));
    const jobs = [];
    const nearLot = (q, r) => LOTS.some(l => hdist(l.q - q, l.r - r) <= 1);
    const isWater = (q, r, d) => {
      if (nearLot(q, r)) return false;
      if (st.water === 'marina') return d >= R || (r >= 4 && q >= -3) || (q >= 5 && r >= -1) || q + r >= 6;
      if (st.water === 'snow') return d >= R || (hdist(q - 5, r - 2) <= 1);
      if (st.water === 'capital') return d >= R || (hdist(q - 3, r + 4) <= 0);
      return d >= R || (q >= 8 && r >= -4) || (q + r >= 5 && q >= 3);
    };
    const grassAt = [], waterAt = [], tintAt = [];
    const roadSet = new Set(ROAD_CELLS.map(c => c.join(',')));
    const centers = Object.keys(DISTRICTS).map(d => { const ls = LOTS.filter(l => l.d === d); return { d, q: ls.reduce((a, l) => a + l.q, 0) / ls.length, r: ls.reduce((a, l) => a + l.r, 0) / ls.length }; });
    const h0 = (q, r) => (((q * 73856093) ^ (r * 19349663)) >>> 0) % 1000 / 1000;
    this.distHex = {};
    const nearLot2 = (q, r) => LOTS.some(l => hdist(l.q - q, l.r - r) <= 2);
    const districtAt = (q, r) => { let best = null; for (const c of centers) { const dd = hdist(q - c.q, r - c.r); if (dd <= 2.9 && (!best || dd < best.dd)) best = { dd, d: c.d }; } return best ? best.d : null; };
    const nearestD = (q, r) => { let best = null; for (const l of LOTS) { const dd = hdist(l.q - q, l.r - r); if (!best || dd < best.dd) best = { dd, d: l.d }; } return best.d; };
    const groundColor = (q, r) => {
      if (roadSet.has(q + ',' + r)) return THEME.snow ? 0xb9b1a6 : 0xd6bf8e;
      let best = null; for (const c of centers) { const dd = hdist(q - c.q, r - c.r); if (dd <= 2.2 && (!best || dd < best.dd)) best = { dd, d: c.d }; }
      return best && DISTRICTS[best.d].ground != null ? DISTRICTS[best.d].ground : null;
    };
    const deco = ['trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium', 'tree_single_A', 'tree_single_B', 'rock_single_A', 'hill_single_A'];
    let k = 0;
    const R = 10;
    for (let q = -R - 1; q <= R + 1; q++) for (let r = -R - 1; r <= R + 1; r++) {
      const d = hdist(q, r); if (d > R + 1) continue;
      const p = hexPos(q, r);
      const water = isWater(q, r, d);
      if (water) waterAt.push(p);
      else { const gc = groundColor(q, r); if (gc != null) tintAt.push([p, gc, h0(q, r)]); else grassAt.push(p); }
      if (water || lotSet.has(q + ',' + r)) continue;
      // 町の中心近くはあけて、外側に木や丘を置く
      const h = (q * 73856093 ^ r * 19349663) >>> 0;
      if (roadSet.has(q + ',' + r) || MARKS.some(m => m.at[0] === q && m.at[1] === r)) continue;
      // 地区の中は、地区らしい建物で埋める(住宅街=家、広場=屋台・舞台・井戸、港=荷物、鉱山=石と荷車)
      const dd = districtAt(q, r);
      if (dd || nearLot2(q, r)) {
        const d0 = dd || nearestD(q, r); (this.distHex[d0] = this.distHex[d0] || []).push(p.clone());
        if (h % 10 < 9) { const [name, sc0] = townPiece(DISTRICTS[d0].kind, h), sc = sc0 * 1.18; jobs.push(model(name).then(o => { mute(o); o.scale.setScalar(sc); o.position.copy(p).add(new THREE.Vector3(((h >> 3) % 5 - 2) * 0.06, 0, ((h >> 5) % 5 - 2) * 0.06)); o.rotation.y = (h % 6) * Math.PI / 3; W.add(o); })); }
        continue;
      }
      const mtn = THEME.snow && (r <= -8 || d >= 8);
      const edge = d >= R - 2;
      if (h % 7 < 3 || edge || mtn) {
        const name = mtn && h % 2 ? 'mountain_A_grass_trees' : edge && h % 3 === 0 ? (h % 2 ? 'hills_A_trees' : 'mountain_A_grass_trees') : deco[h % deco.length];
        jobs.push(model(name).then(o => { o.position.copy(p); o.rotation.y = (h % 6) * Math.PI / 3; W.add(o); }));
      } else if (h % 9 === 0) {
        jobs.push(model(['barrel', 'crate_A_big', 'sack', 'wheelbarrow'][h % 4]).then(o => { o.position.copy(p).add(new THREE.Vector3(0.3, 0, 0.2)); o.rotation.y = h % 5; W.add(o); }));
      }
    }
    // 地面はまとめて描く(スマホでも軽い)
    if (tintAt.length) jobs.push(model('hex_grass').then(o => {
      const meshes = []; o.updateMatrixWorld(true); o.traverse(m => { if (m.isMesh) meshes.push(m); });
      for (const m of meshes) {
        const mat = m.material.clone(); mat.map = null; mat.color.setHex(0xffffff);
        const im = new THREE.InstancedMesh(m.geometry, mat, tintAt.length); im.receiveShadow = true;
        const mm = new THREE.Matrix4(), t = new THREE.Matrix4(), col = new THREE.Color();
        tintAt.forEach(([p, c, h], i) => { t.makeTranslation(p.x, p.y, p.z); mm.multiplyMatrices(t, m.matrixWorld); im.setMatrixAt(i, mm); col.setHex(c).multiplyScalar(0.93 + h * 0.1); im.setColorAt(i, col); });
        W.add(im);
      }
    }));
    for (const [name, list] of [['hex_grass', grassAt], ['hex_water', waterAt]]) {
      if (!list.length) continue;
      jobs.push(model(name).then(o => {
        const meshes = []; o.updateMatrixWorld(true); o.traverse(m => { if (m.isMesh) meshes.push(m); });
        for (const m of meshes) {
          const im = new THREE.InstancedMesh(m.geometry, m.material, list.length); im.receiveShadow = true;
          const mm = new THREE.Matrix4(), t = new THREE.Matrix4();
          list.forEach((p, i) => { t.makeTranslation(p.x, p.y, p.z); mm.multiplyMatrices(t, m.matrixWorld); im.setMatrixAt(i, mm); });
          W.add(im);
        }
      }));
    }
    // 空き地(区画)
    for (const l of LOTS) {
      const p = hexPos(l.q, l.r);
      jobs.push(model('hex_grass').then(o => { o.position.copy(p); W.add(o); this.lotObjs.set(l.id, o); const gc = DISTRICTS[l.d].ground; o.traverse(m => { m.userData.lot = l.id; if (m.isMesh && gc != null) { const k = 'lot' + gc; if (!tinted.has(k)) { const c = m.material.clone(); c.map = null; c.color.setHex(gc); tinted.set(k, c); } m.material = tinted.get(k); } }); }));
      const ring = new THREE.Mesh(this.ringGeo || (this.ringGeo = new THREE.RingGeometry(0.78, 0.9, 6, 1)), this.ringMat || (this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })));
      ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 6; ring.position.copy(p).add(new THREE.Vector3(0, 0.03, 0)); ring.userData.lot = l.id; W.add(ring); (this.rings = this.rings || new Map()).set(l.id, ring);
    }
    // 雲
    for (let i = 0; i < 6; i++) jobs.push(model(i % 2 ? 'cloud_big' : 'cloud_small').then(o => { o.position.set(-20 + i * 9, 11 + (i % 3), (i % 2 ? -16 : 14)); o.scale.setScalar(1.5); o.userData.cloud = 0.2 + i * 0.05; W.add(o); this.clouds = (this.clouds || []).concat(o); }));
    // 空き地の「+」印
    const plusTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.arc(64, 64, 56, 0, 7); x.fill(); x.fillStyle = '#3a7bd5'; x.font = 'bold 92px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('+', 64, 70); return new THREE.CanvasTexture(c); })();
    this.plusMat = new THREE.SpriteMaterial({ map: plusTex, depthTest: false, transparent: true });
    for (const l of LOTS) { const s = new THREE.Sprite(this.plusMat); s.scale.set(0.55, 0.55, 1); s.position.copy(hexPos(l.q, l.r)).add(new THREE.Vector3(0, 0.9, 0)); s.userData.lot = l.id; s.renderOrder = 10; W.add(s); this.plus.set(l.id, s); }
    await Promise.all(jobs);
    await this.buildMarks(W);
    this.frame();
    if (!this.charProto) this.charProto = await Promise.all(CHAR_OF.map(n => load(CH + n + '.glb')));
    this.rings = this.rings || new Map();
    this.spawnTraffic();
  }
  // 町の目印(噴水・桟橋・船・井戸・鉱山・トロッコ・城・城門)
  async buildMarks(W) {
    this.anim = [];
    const M = (geo, c) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })); m.castShadow = true; m.receiveShadow = true; return m; };
    for (const mk of MARKS) {
      const [q, r] = mk.at, g = new THREE.Group();
      if (mk.k === 'fountain') {
        const b = M(new THREE.CylinderGeometry(0.85, 0.92, 0.28, 24), 0xd8d0c4); b.position.y = 0.14; g.add(b);
        const w = M(new THREE.CylinderGeometry(0.74, 0.74, 0.05, 24), 0x5fb3ea); w.position.y = 0.27; g.add(w);
        const c = M(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 12), 0xe6dfd2); c.position.y = 0.6; g.add(c);
        const bowl = M(new THREE.CylinderGeometry(0.38, 0.18, 0.14, 16), 0xe6dfd2); bowl.position.y = 0.98; g.add(bowl);
        const sp = M(new THREE.SphereGeometry(0.2, 12, 10), 0xa8dcff); sp.material.transparent = true; sp.material.opacity = 0.8; sp.position.y = 1.12; g.add(sp);
        this.anim.push((t) => { sp.scale.setScalar(1 + Math.sin(t * 6) * 0.15); });
      }
      if (mk.k === 'pier') {
        for (let i = 0; i < 4; i++) { const pl = M(new THREE.BoxGeometry(0.36, 0.08, 1.7), 0x9a6b3f); pl.position.set(-0.6 + i * 0.4, 0.22, 0); g.add(pl); }
        for (const x of [-0.75, 0.75]) for (const z of [-0.7, 0.7]) { const po = M(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8), 0x6b4a2f); po.position.set(x, -0.05, z); g.add(po); }
        g.rotation.y = 0.5;
      }
      if (mk.k === 'boat') {
        const hull = M(new THREE.BoxGeometry(0.6, 0.3, 1.5), 0x8a5a3a); hull.position.y = 0.1; g.add(hull);
        const mast = M(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), 0x6b4a2f); mast.position.y = 0.9; g.add(mast);
        const sail = M(new THREE.PlaneGeometry(0.9, 0.9), 0xfffaf0); sail.material.side = THREE.DoubleSide; sail.position.set(0, 1.0, 0.05); sail.rotation.y = Math.PI / 2; g.add(sail);
        const ph = Math.random() * 6; this.anim.push((t) => { g.position.y = Math.sin(t * 1.6 + ph) * 0.06; g.rotation.z = Math.sin(t * 1.3 + ph) * 0.05; });
      }
      if (mk.k === 'well') {
        const ring = M(new THREE.CylinderGeometry(0.42, 0.46, 0.45, 18), 0xa8a094); ring.position.y = 0.22; g.add(ring);
        const wt = M(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 18), 0x3a6a9a); wt.position.y = 0.42; g.add(wt);
        for (const x of [-0.36, 0.36]) { const p = M(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), 0x7a5a3a); p.position.set(x, 0.8, 0); g.add(p); }
        const roof = M(new THREE.ConeGeometry(0.6, 0.4, 4), 0xc0584a); roof.position.y = 1.35; roof.rotation.y = Math.PI / 4; g.add(roof);
      }
      if (mk.k === 'mine') {
        const rock = M(new THREE.DodecahedronGeometry(1.1, 0), 0x7d776f); rock.scale.set(1.2, 0.9, 1); rock.position.y = 0.6; g.add(rock);
        const hole = M(new THREE.BoxGeometry(0.7, 0.8, 0.3), 0x1d1a18); hole.position.set(0, 0.4, 0.95); g.add(hole);
        const beam = M(new THREE.BoxGeometry(0.95, 0.12, 0.14), 0x8a5a3a); beam.position.set(0, 0.86, 1.05); g.add(beam);
        for (const x of [-0.42, 0.42]) { const p = M(new THREE.BoxGeometry(0.12, 0.85, 0.14), 0x8a5a3a); p.position.set(x, 0.42, 1.05); g.add(p); }
        g.rotation.y = Math.PI;
      }
      if (mk.k === 'cart') {
        for (const x of [-0.25, 0.25]) { const rl = M(new THREE.BoxGeometry(0.05, 0.04, 1.8), 0x5a5a62); rl.position.set(x, 0.03, 0); g.add(rl); }
        const cart = new THREE.Group(); const box = M(new THREE.BoxGeometry(0.55, 0.32, 0.7), 0x7a5232); box.position.y = 0.32; cart.add(box);
        const ore = M(new THREE.DodecahedronGeometry(0.22, 0), 0x6b6f78); ore.position.y = 0.52; cart.add(ore);
        for (const x of [-0.3, 0.3]) for (const z of [-0.22, 0.22]) { const wh = M(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), 0x2f2f33); wh.rotation.z = Math.PI / 2; wh.position.set(x, 0.12, z); cart.add(wh); }
        g.add(cart); const ph = Math.random() * 6; this.anim.push((t) => { cart.position.z = Math.sin(t * 0.5 + ph) * 0.6; });
      }
      if (mk.k === 'castle') {
        const base = M(new THREE.BoxGeometry(1.4, 1.1, 1.4), 0xe8e4dc); base.position.y = 0.55; g.add(base);
        for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { const tw = M(new THREE.CylinderGeometry(0.28, 0.3, 1.7, 14), 0xf2efe8); tw.position.set(x, 0.85, z); g.add(tw); const rf = M(new THREE.ConeGeometry(0.36, 0.6, 14), 0x7a5cc8); rf.position.set(x, 2.0, z); g.add(rf); }
        const keep = M(new THREE.CylinderGeometry(0.4, 0.45, 2.4, 16), 0xf2efe8); keep.position.y = 1.2; g.add(keep); const kr = M(new THREE.ConeGeometry(0.52, 0.9, 16), 0x7a5cc8); kr.position.y = 2.85; g.add(kr);
        const fl = M(new THREE.PlaneGeometry(0.35, 0.22), 0xffd34d); fl.material.side = THREE.DoubleSide; fl.position.set(0.18, 3.4, 0); g.add(fl);
        this.anim.push((t) => { fl.rotation.y = Math.sin(t * 3) * 0.4; });
        g.scale.setScalar(1.25);
      }
      if (mk.k === 'gate') { const o = await model('wall_straight_gate'); o.rotation.y = Math.PI / 2 + 0.5; g.add(o); }
      g.position.copy(hexPos(q, r)); W.add(g);
    }
  }
  // 店の前のお客: 先月よく売れた店ほど人が集まる(最大4人・町全体で28人まで)
  updateCrowds(S) {
    if (!this.charProto || !this.charProto[0]) return;
    this.crowd = this.crowd || new Map(); this.crowdMx = this.crowdMx || [];
    let total = 0; const want = new Map();
    for (const s of S.shops) { if (s.g === 'work' || !s.last) continue; const n = Math.max(0, Math.min(4, Math.round(s.last.units / 45))); want.set(s.id, n); }
    for (const [id, arr] of this.crowd) if (!want.has(id) || want.get(id) !== arr.length) { for (const c of arr) { this.world.remove(c.o); this.crowdMx = this.crowdMx.filter(m => m !== c.mx); } this.crowd.delete(id); }
    for (const [, arr] of this.crowd) total += arr.length;
    for (const [id, n] of want) {
      if (this.crowd.has(id) || !n) continue; if (total + n > 28) continue; total += n;
      const s = S.shops.find(x => x.id === id), l = LOTS[s.lot], c0 = hexPos(l.q, l.r), arr = [];
      for (let i = 0; i < n; i++) {
        const proto = this.charProto[(id + i) % 4]; if (!proto) continue;
        const o = SkeletonUtils.clone(proto.scene); o.scale.setScalar(0.17);
        const a = (i / Math.max(1, n)) * Math.PI * 1.2 + 0.4 + id, r = 0.82;
        o.position.copy(c0).add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); o.lookAt(c0.x, 0, c0.z);
        const mx = new THREE.AnimationMixer(o), cl = proto.animations.find(c => c.name === (i % 2 ? 'Idle' : 'Cheer')) || proto.animations.find(c => c.name === 'Idle'); if (cl) { const ac = mx.clipAction(cl); ac.play(); ac.time = Math.random() * 2; }
        this.world.add(o); this.crowdMx.push(mx); arr.push({ o, mx });
      }
      this.crowd.set(id, arr);
    }
  }
  // 地区の中を歩きまわる町の人(景気がいいほど多い)
  spawnFolk(per = 3) {
    if (this.folk) for (const w of this.folk) this.world.remove(w.o);
    this.folk = [];
    if (!this.charProto || !this.distHex) return;
    let i = 0;
    for (const [d, hs] of Object.entries(this.distHex)) {
      if (hs.length < 3) continue;
      for (let n = 0; n < per + (DISTRICTS[d] && DISTRICTS[d].kind === 'plaza' ? 4 : 0); n++, i++) {
        const proto = this.charProto[i % 4]; if (!proto) continue;
        const pts = []; for (let k = 0; k < 4; k++) pts.push(hs[(i * 7 + k * 13) % hs.length].clone().add(new THREE.Vector3(((i + k) % 3 - 1) * 0.3, 0, ((i * k) % 3 - 1) * 0.3)));
        const o = SkeletonUtils.clone(proto.scene); o.scale.setScalar(0.17); this.world.add(o);
        const mx = new THREE.AnimationMixer(o); const cl = proto.animations.find(c => c.name === 'Walking_A'); if (cl) mx.clipAction(cl).play();
        this.folk.push({ o, mx, pts, u: (i % 4) * 0.7, dir: 1, off: 0 });
      }
    }
    this.traffic = (this.traffic || []).filter(w => !w.folk).concat(this.folk.map(w => Object.assign(w, { folk: 1 })));
  }
  // 道を行き来する人(商人や冒険者)
  spawnTraffic(per = 2) {
    if (this.traffic) for (const w of this.traffic.filter(w => !w.folk)) this.world.remove(w.o);
    this.traffic = (this.traffic || []).filter(w => w.folk);
    if (!this.charProto) return;
    for (const rd of ROADS) {
      const pts = rd.path.map(([q, r]) => hexPos(q, r)); if (pts.length < 2) continue;
      for (let i = 0; i < per; i++) {
        const proto = this.charProto[(i + pts.length) % 4]; if (!proto) continue;
        const o = SkeletonUtils.clone(proto.scene); o.scale.setScalar(0.2); this.world.add(o);
        o.traverse(m => { if (m.isMesh) m.castShadow = true; });
        const mx = new THREE.AnimationMixer(o); const cl = proto.animations.find(c => c.name === 'Walking_A'); if (cl) mx.clipAction(cl).play();
        this.traffic.push({ o, mx, pts, u: (i / per) * (pts.length - 1), dir: i % 2 ? -1 : 1, off: i % 2 ? 0.25 : -0.25 });
      }
    }
  }
  // 状態に合わせて建物を置く
  async sync(S, myId) {
    const want = new Map(S.shops.map(s => [s.id, s]));
    for (const [id, o] of this.shopObjs) if (!want.has(id)) { if (o) this.world.remove(o); this.shopObjs.delete(id); }
    const jobs = [];
    for (const s of S.shops) {
      const ex = this.shopObjs.get(s.id);
      if (ex && ex.userData.owner !== s.owner) { this.world.remove(ex); this.shopObjs.delete(s.id); const sg = this.signs && this.signs.get(s.id); if (sg) { this.world.remove(sg); this.signs.delete(s.id); } }
      else if (this.shopObjs.has(s.id)) continue;
      const color = S.players[s.owner].color, l = LOTS[s.lot];
      this.shopObjs.set(s.id, null);
      const bname = s.g === 'work' ? `building_${WORKB[s.res]}_${color}` : `building_${BUILDING[s.g]}_${color}`;
      jobs.push(model(bname).then(o => {
        o.position.copy(hexPos(l.q, l.r)); o.rotation.y = (s.lot % 6) * Math.PI / 3 + Math.PI / 6;
        o.traverse(m => { m.userData.shop = s.id; m.userData.lot = s.lot; }); o.userData.owner = s.owner;
        o.scale.setScalar(0.01); o.userData.pop = 0; this.world.add(o); this.shopObjs.set(s.id, o);
      }));
    }
    await Promise.all(jobs);
    // 看板: 業種と持ち主がひと目でわかる。開いたばかりの店には NEW
    this.signs = this.signs || new Map();
    for (const [id, sp] of this.signs) if (!want.has(id)) { this.world.remove(sp); this.signs.delete(id); }
    for (const s of S.shops) {
      const isNew = s.owner !== myId && S.t - s.openedT <= 1;
      const icon = 'assets/icons/' + (s.g === 'work' ? 'b_work' : 'b_' + s.g) + '.png', col = COLOR_HEX[S.players[s.owner].color];
      const who = this.faceOf ? this.faceOf(s.owner) : { url: '', name: S.players[s.owner].name };
      let sp = this.signs.get(s.id);
      if (!sp) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true })); sp.renderOrder = 9; this.world.add(sp); this.signs.set(s.id, sp); const l = LOTS[s.lot]; sp.position.copy(hexPos(l.q, l.r)).add(new THREE.Vector3(0, 2.0, 0)); sp.userData.shop = s.id; sp.userData.lot = s.lot; }
      // 繁盛している店は🔥、赤字続きの店は💤
      const l = s.last, h = s.hist || [];
      const mood = s.g !== 'work' && l && l.profit > 70 && l.want >= l.cap * 0.85 ? '🔥' : h.length >= 2 && h.slice(-2).every(x => x < 0) ? '💤' : '';
      const sk = [icon, col, isNew, mood, who.url ? who.url.length : 0, who.name].join('|');
      if (sp.userData.key !== sk) { sp.material.map = signTex({ icon, color: col, isNew, hot: mood === '🔥', dull: mood === '💤', face: who.url, name: who.name, me: s.owner === myId }); sp.material.needsUpdate = true; sp.userData.key = sk; sp.scale.set(0.95, 1.15, 1); sp.userData.isNew = isNew; }
      // 建物のようす: 赤字続きはくすみ、繁盛は金貨が立ちのぼる
      const o = this.shopObjs.get(s.id);
      if (o && o.userData.mood !== mood) { o.userData.mood = mood; o.traverse(m => { if (m.isMesh) { if (!m.userData.mat0) m.userData.mat0 = m.material; if (mood === '💤') { const c = m.userData.mat0.clone(); c.color.multiplyScalar(0.62); m.material = c; } else m.material = m.userData.mat0; } }); }
      if (o) o.userData.thrive = mood === '🔥';
    }
    for (const l of LOTS) { const used = S.shops.some(s => s.lot === l.id); this.plus.get(l.id).visible = !used && S.players[myId] && !S.over; if (this.rings) this.rings.get(l.id).visible = !used; }
    this.updateCrowds(S);
  }
  // 開業予定の土地に足場を出す
  async preview(lot, g, color) {
    this.previews = this.previews || new Map();
    const old = this.previews.get(lot); if (old) { this.world.remove(old); this.previews.delete(lot); }
    if (!g) { this.plus.get(lot).visible = true; return; }
    const o = await model('building_scaffolding'); const l = LOTS[lot];
    o.position.copy(hexPos(l.q, l.r)); o.userData.pop = 0; o.scale.setScalar(0.01);
    o.traverse(m => { m.userData.lot = lot; });
    const f = await model('flag_' + color); f.position.set(0.55, 0, 0.3); o.add(f);
    this.world.add(o); this.previews.set(lot, o); this.plus.get(lot).visible = false;
    this.popIn = (this.popIn || []).concat(o);
  }
  // 建設モード: 空き地ごとの見込みを色つきの六角形と札で出す
  showRatings(list) {
    this.clearRatings(); this.ratings = new Map();
    if (!this.hexFill) { this.hexFill = new THREE.CircleGeometry(0.86, 6); this.hexFill.rotateX(-Math.PI / 2); this.hexFill.rotateY(Math.PI / 6); }
    for (const it of list) {
      const l = LOTS[it.lot], g = new THREE.Group(); g.position.copy(hexPos(l.q, l.r));
      const m = new THREE.Mesh(this.hexFill, new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.55, depthWrite: false })); m.position.y = 0.06; m.userData.lot = it.lot; g.add(m);
      const c = document.createElement('canvas'); c.width = 256; c.height = 112; const x = c.getContext('2d');
      x.fillStyle = 'rgba(255,255,255,.95)'; const r = 40; x.beginPath(); x.moveTo(r, 8); x.arcTo(248, 8, 248, 104, r); x.arcTo(248, 104, 8, 104, r); x.arcTo(8, 104, 8, 8, r); x.arcTo(8, 8, 248, 8, r); x.fill();
      x.fillStyle = '#' + it.color.toString(16).padStart(6, '0'); x.font = 'bold 52px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(it.text, 128, 58);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); sp.scale.set(1.9, 0.83, 1); sp.position.y = 1.15; sp.renderOrder = 12; sp.userData.lot = it.lot; g.add(sp);
      g.userData.lot = it.lot; g.userData.ph = Math.random() * 6; this.world.add(g); this.ratings.set(it.lot, g);
      const pl = this.plus.get(it.lot); if (pl) pl.visible = false;
    }
  }
  clearRatings() { if (!this.ratings) return; for (const [lot, g] of this.ratings) { this.world.remove(g); const pl = this.plus.get(lot); if (pl && !(this.previews && this.previews.has(lot))) pl.visible = true; } this.ratings = null; }
  // 建てたときの土けむり
  dust(lot) {
    const l = LOTS[lot]; if (!l) return; const p0 = hexPos(l.q, l.r);
    if (!this.dustMat) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,250,235,.95)'); g.addColorStop(1, 'rgba(255,250,235,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); this.dustMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }); }
    for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(this.dustMat.clone()); const a = (i / 14) * Math.PI * 2; sp.position.copy(p0).add(new THREE.Vector3(Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3)); sp.scale.setScalar(0.4); sp.userData.v = new THREE.Vector3(Math.cos(a) * 1.6, 0.8 + Math.random() * 0.6, Math.sin(a) * 1.6); sp.userData.life = 0; this.world.add(sp); (this.dusts = this.dusts || []).push(sp); }
  }
  // ── 3Dのエフェクト: 粒の爆発・光の柱・衝撃の輪
  sparkTex() { if (this._spark) return this._spark; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (this._spark = new THREE.CanvasTexture(c)); }
  lotPos(lot) { const l = LOTS[lot]; return l ? hexPos(l.q, l.r) : null; }
  shopLot(id) { const s = this.shopObjs.get(id); return s ? s.userData.lot ?? null : null; }
  burst(lot, color = 0xffd36e, n = 18, up = 1) {
    const p0 = this.lotPos(lot); if (!p0) return;
    for (let i = 0; i < n; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sparkTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.6; sp.position.copy(p0).add(new THREE.Vector3(0, 0.8 + Math.random() * 0.6, 0)); sp.scale.setScalar(0.28 + Math.random() * 0.2); sp.userData = { v: new THREE.Vector3(Math.cos(a) * r, (1.5 + Math.random() * 2) * up, Math.sin(a) * r), life: 0, max: 0.7 + Math.random() * 0.5, g: 1 }; this.world.add(sp); (this.fxs = this.fxs || []).push(sp); }
  }
  pillar(lot, color = 0x9fd4ff) {
    const p0 = this.lotPos(lot); if (!p0) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 6, 18, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.copy(p0).add(new THREE.Vector3(0, 3, 0)); m.userData = { life: 0, max: 1.3, pillar: 1 }; this.world.add(m); (this.fxs = this.fxs || []).push(m); this.burst(lot, color, 14);
  }
  shock(lot, color = 0xff4d5e) {
    const p0 = this.lotPos(lot); if (!p0) return;
    const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2;
    m.position.copy(p0).add(new THREE.Vector3(0, 0.2, 0)); m.userData = { life: 0, max: 0.7, ring: 1 }; this.world.add(m); (this.fxs = this.fxs || []).push(m);
    this.burst(lot, color, 12, 0.6);
    for (const [, o] of this.shopObjs) if (o && o.userData.lot === lot) { o.userData.shake = 0.6; }
  }
  bounceLot(lot) { for (const [, o] of this.shopObjs) if (o && o.userData.lot === lot) o.userData.bounce = 0.0001; }
  fxTick(dt) {
    if (!this.fxs) return;
    this.fxs = this.fxs.filter(o => { const u = o.userData; u.life += dt; const k = u.life / u.max;
      if (u.v) { o.position.addScaledVector(u.v, dt); u.v.y -= 4 * dt; u.v.multiplyScalar(0.97); o.material.opacity = 1 - k; }
      if (u.pillar) { o.scale.set(1 + k * 0.4, 1, 1 + k * 0.4); o.material.opacity = 0.55 * (1 - k); }
      if (u.ring) { o.scale.setScalar(1 + k * 3); o.material.opacity = 0.9 * (1 - k); }
      if (k >= 1) { this.world.remove(o); o.material.dispose(); return false; } return true; });
  }
  // 行商人(来ている月だけ、町の真ん中に屋台を出す)
  setPeddler(on) {
    if (!on) { if (this.peddlerObj) { this.world.remove(this.peddlerObj); this.peddlerObj = null; } return; }
    if (this.peddlerObj || !this.charProto || !this.charProto[4]) return;
    const mk = MARKS.find(m => m.k === 'fountain') || MARKS.find(m => m.k === 'well') || MARKS[0];
    const base = mk ? hexPos(mk.at[0], mk.at[1]) : new THREE.Vector3(this.homeV.tx, 0, this.homeV.tz);
    const g = new THREE.Group(); g.position.copy(base).add(new THREE.Vector3(1.1, 0, 0.9)); g.userData.peddler = 1;
    const proto = this.charProto[4], o = SkeletonUtils.clone(proto.scene); o.scale.setScalar(0.26); o.rotation.y = -0.6; g.add(o);
    const mx = new THREE.AnimationMixer(o), cl = proto.animations.find(c => c.name === 'Idle') || proto.animations[0]; if (cl) mx.clipAction(cl).play(); let lt = null;
    model('tent').then(t => { if (!t) return; t.scale.setScalar(0.55); t.position.set(0.55, 0, -0.35); g.add(t); });
    model('wheelbarrow').then(t => { if (!t) return; t.scale.setScalar(0.7); t.position.set(-0.5, 0, 0.2); t.rotation.y = 0.8; g.add(t); });
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#7c4dff'; x.beginPath(); x.roundRect(6, 6, 244, 84, 40); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 46px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('行商人', 128, 50);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); sp.scale.set(1.3, 0.5, 1); sp.position.y = 1.35; sp.renderOrder = 13; g.add(sp);
    g.traverse(m => { m.userData.peddler = 1; });
    this.world.add(g); this.peddlerObj = g; this.anim.push((t) => { if (this.peddlerObj !== g) return; sp.position.y = 1.35 + Math.sin(t * 3) * 0.08; if (lt != null) mx.update(Math.min(0.05, t - lt)); lt = t; });
  }
  // 陣取りの見た目: 自分の色の六角形を店の下に、支配した地区には大きな旗
  setTerritory(S, colorOf) {
    this.terr = this.terr || new Map(); this.flags = this.flags || new Map();
    if (!this.terrGeo) { this.terrGeo = new THREE.RingGeometry(0.72, 0.95, 6, 1); this.terrGeo.rotateX(-Math.PI / 2); this.terrGeo.rotateY(Math.PI / 6); this.terrFill = new THREE.CircleGeometry(0.95, 6); this.terrFill.rotateX(-Math.PI / 2); this.terrFill.rotateY(Math.PI / 6); }
    const want = new Map(S.shops.map(s => [s.lot, s.owner]));
    for (const [lot, g] of this.terr) if (want.get(lot) !== g.userData.owner) { this.world.remove(g); this.terr.delete(lot); }
    for (const [lot, owner] of want) {
      if (this.terr.has(lot)) continue; const l = LOTS[lot], col = new THREE.Color(colorOf(owner));
      const g = new THREE.Group(); g.position.copy(hexPos(l.q, l.r)).add(new THREE.Vector3(0, 0.07, 0)); g.userData.owner = owner;
      g.add(new THREE.Mesh(this.terrFill, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, depthWrite: false })));
      g.add(new THREE.Mesh(this.terrGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthWrite: false })));
      this.world.add(g); this.terr.set(lot, g);
    }
    for (const d in DISTRICTS) {
      const c = S.control ? S.control[d] : null, ex = this.flags.get(d);
      if (ex && ex.userData.owner !== c) { this.world.remove(ex); this.flags.delete(d); }
      if (c == null || this.flags.has(d)) continue;
      const ls = LOTS.filter(l => l.d === d), ctr = ls.reduce((a, l) => a.add(hexPos(l.q, l.r)), new THREE.Vector3()).multiplyScalar(1 / ls.length);
      const g = new THREE.Group(); g.userData.owner = c; g.position.copy(ctr);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a35 })); pole.position.y = 1.6; g.add(pole);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.85, 8, 1), new THREE.MeshStandardMaterial({ color: colorOf(c), side: THREE.DoubleSide, roughness: 0.6 })); cloth.position.set(0.72, 2.75, 0); g.add(cloth);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffc53d, metalness: 0.5, roughness: 0.3 })); top.position.y = 3.25; g.add(top);
      this.anim.push((t) => { if (this.flags.get(d) !== g) return; const a = cloth.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i); a.setZ(i, Math.sin(t * 4 + x * 3) * 0.08 * (x + 0.7)); } a.needsUpdate = true; });
      this.world.add(g); this.flags.set(d, g);
    }
  }
  flagPos(d) { const g = this.flags && this.flags.get(d); return g ? g.position : null; }
  clearPreview() { if (!this.previews) return; for (const [, o] of this.previews) this.world.remove(o); this.previews.clear(); }
  async reset() { this.clearPreview(); for (const [, o] of this.shopObjs) if (o) this.world.remove(o); this.shopObjs.clear(); }
  // 天気の見た目(雨・雪の粒、空の色、光)
  setWeather(w) {
    this.weather = w;
    if (!this.precip) {
      const n = 1400, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 40; pos[i * 3 + 1] = Math.random() * 18; pos[i * 3 + 2] = (Math.random() - 0.5) * 40; }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.precip = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.8, depthWrite: false }));
      this.scene.add(this.precip);
    }
    const snowT = THEME.snow;
    const sky = { sun: snowT ? 0xcfe4f5 : 0x8fd3f4, cloudy: 0xb9c6d2, rain: 0x8e9eae, storm: 0x5d6b7d, heat: 0xffd9a8, snow: 0xdfe8f2 }[w] || 0x8fd3f4;
    this.scene.background.setHex(sky); this.scene.fog.color.setHex(sky);
    this.sun.intensity = { sun: 1.7, cloudy: 1.0, rain: 0.7, storm: 0.45, heat: 2.1, snow: 1.0 }[w] || 1.4;
    this.sun.color.setHex(w === 'heat' ? 0xffd2a0 : 0xfff4e2);
    const show = w === 'rain' || w === 'storm' || w === 'snow';
    this.precip.material.size = w === 'snow' ? 0.45 : 0.16; this.precip.material.opacity = w === 'snow' ? 0.95 : 0.75; this.precip.material.color.setHex(w === 'snow' ? 0xffffff : 0xcfe3ff);
    this.precip.visible = show;
    this.precip.material.size = w === 'snow' ? 0.2 : 0.13; this.precip.material.color.setHex(w === 'snow' ? 0xffffff : 0xb8d4ff);
    this.precipSpeed = w === 'snow' ? 1.6 : w === 'storm' ? 16 : 11;
    this.flash = 0;
  }
  // 店員の似顔絵: 町と同じ3Dキャラの部品を組み合わせる(体・頭・帽子・服の色)。同じ骨組みなので重ねて1人にできる
  portrait(look) {
    if (typeof look !== 'object' || !look) return '';
    const key = JSON.stringify(look); this.pcache = this.pcache || new Map(); if (this.pcache.has(key)) return this.pcache.get(key);
    if (!this.charProto || !this.charProto[0]) return '';
    if (!this.pR) { this.pR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); this.pR.setSize(128, 128); this.pR.outputColorSpace = THREE.SRGBColorSpace; this.pScene = new THREE.Scene(); this.pScene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.7)); const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(1, 2, 3); this.pScene.add(dl); this.pCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); }
    const g = this.composeChar(look);
    this.pScene.add(g); g.updateMatrixWorld(true);
    // 見えている頭を基準に写す(どのキャラも顔が同じ大きさになるように)
    const hb = new THREE.Box3(); g.children[1].traverse(m => { if ((m.isMesh || m.isSkinnedMesh) && m.visible) hb.expandByObject(m); });
    const c = hb.getCenter(new THREE.Vector3()), hh = Math.max(0.3, hb.max.y - hb.min.y);
    this.pCam.position.set(c.x, c.y - hh * 0.1, c.z + hh * 3.4); this.pCam.lookAt(c.x, c.y - hh * 0.28, c.z);
    this.pR.render(this.pScene, this.pCam); const url = this.pR.domElement.toDataURL('image/png');
    this.pScene.remove(g); this.pcache.set(key, url); return url;
  }
  composeChar(look) {
    const NAMES = ['Knight', 'Mage', 'Barbarian', 'Rogue', 'Rogue'];
    const g = new THREE.Group();
    const part = (mi, test, tint) => {
      const proto = this.charProto[mi]; if (!proto) return;
      const o = SkeletonUtils.clone(proto.scene);
      o.traverse(m => { if (!m.isMesh && !m.isSkinnedMesh) return; m.visible = !!test(m.name); if (m.visible && tint != null) { m.material = m.material.clone(); m.material.color.setHex(tint); } });
      const mx = new THREE.AnimationMixer(o); const cl = proto.animations.find(c => c.name === 'Idle'); if (cl) { mx.clipAction(cl).play(); mx.update(0.4); }
      g.add(o);
    };
    const B = NAMES[look.b], H = look.h === 4 ? 4 : look.h;
    part(look.b, n => /_(Body|ArmLeft|ArmRight|LegLeft|LegRight)$/.test(n) || (look.cape && /_Cape$/.test(n)), look.tint);
    part(H, n => look.h === 4 ? /Head_Hooded$/.test(n) : new RegExp('^' + NAMES[look.h] + '_Head$').test(n));
    if (look.hat >= 0 && look.h !== 4) part(look.hat, n => /_(Helmet|Hat)$/.test(n));
    return g;
  }
  // 町の景気: いいと人通りが増えて広場に旗飾り、悪いと人が減る
  setProsperity(k) {
    const tf = k > 1.05 ? 10 : k > 0.98 ? 8 : 6; if (tf !== this.folkN) { this.folkN = tf; this.spawnFolk(tf); }
    const per = k > 1.06 ? 6 : k > 1.0 ? 5 : k > 0.95 ? 4 : 3;
    if (per !== this.trafficPer) { this.trafficPer = per; this.spawnTraffic(per); }
    const want = k > 1.05;
    if (want && !this.bunting) {
      const g = new THREE.Group(), cols = [0xff5d6c, 0xffc53d, 0x4f8cff, 0x3ccf8e];
      const ls = LOTS.filter(l => DISTRICTS[l.d].kind === 'plaza'); const c = ls.reduce((a, l) => a.add(hexPos(l.q, l.r)), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, ls.length));
      for (let a = 0; a < 3; a++) for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), new THREE.MeshBasicMaterial({ color: cols[i % 4] })); const ang = a * 2.1 + i * 0.07; f.position.set(c.x + Math.cos(ang) * (1.2 + i * 0.12), 1.8 - Math.sin(i / 13 * Math.PI) * 0.35, c.z + Math.sin(ang) * (1.2 + i * 0.12)); f.rotation.x = Math.PI; g.add(f); }
      this.world.add(g); this.bunting = g;
    } else if (!want && this.bunting) { this.world.remove(this.bunting); this.bunting = null; }
  }
  highlightLot(id) { for (const [k, s] of this.plus) s.scale.setScalar(k === id ? 0.8 : 0.55); }
  // シートが下半分をおおうので、店が画面の上半分に来るようにずらす
  focus(lotId) { const l = LOTS[lotId]; const p = hexPos(l.q, l.r); this.tween = { tx: p.x + 4.5 * Math.sin(this.view.yaw), tz: p.z + 4.5 * Math.cos(this.view.yaw), dist: 17, t: 0 }; }
  home() { this.tween = { tx: this.homeV.tx, tz: this.homeV.tz, dist: this.homeV.dist, t: 0 }; }
  // 1か所に地区が寄っていない町でも全体が見えるよう、区画の真ん中を家にする
  frame() { const xs = LOTS.map(l => hexPos(l.q, l.r)); const cx = xs.reduce((a, p) => a + p.x, 0) / xs.length, cz = xs.reduce((a, p) => a + p.z, 0) / xs.length; const y = this.homeV.yaw; this.homeV.tx = cx + 4 * Math.sin(y); this.homeV.tz = cz + 4 * Math.cos(y); Object.assign(this.view, { tx: this.homeV.tx, tz: this.homeV.tz, dist: this.homeV.dist, yaw: y, pitch: this.homeV.pitch }); }
  // 月末の客の動き: shops: [{shop, units, profit, color}]
  async playMonth(S, list) {
    if (!this.charProto) return;
    const spawn = [];
    for (const it of list) {
      const s = S.shops.find(x => x.id === it.shop); if (!s || s.g === 'work') continue;
      const l = LOTS[s.lot], dest = hexPos(l.q, l.r);
      const n = Math.max(1, Math.min(6, Math.round(it.units / (GOODS[s.g].capPer * 0.5))));
      for (let i = 0; i < n; i++) spawn.push({ dest, delay: i * 260 + Math.random() * 200, owner: s.owner });
    }
    for (const sp of spawn.slice(0, 40)) {
      const proto = this.charProto[Math.floor(Math.random() * 4)]; if (!proto) continue;
      const o = SkeletonUtils.clone(proto.scene); o.scale.setScalar(0.22);
      const a = Math.random() * Math.PI * 2, from = sp.dest.clone().add(new THREE.Vector3(Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4));
      o.position.copy(from); o.lookAt(sp.dest.x, 0, sp.dest.z); o.visible = false; this.scene.add(o);
      const mx = new THREE.AnimationMixer(o); const cl = proto.animations.find(c => c.name === 'Walking_A'); if (cl) mx.clipAction(cl).play();
      this.walkers.push({ o, mx, from, to: sp.dest.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4)), t: -sp.delay / 1000, dur: 2.0 + Math.random() * 0.6 });
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
    const el = this.R.domElement; const ptrs = new Map(); let down = null, two = null;
    const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    el.addEventListener('pointerdown', (e) => {
      this.vel = null; el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), tx: this.view.tx, tz: this.view.tz, moved: false };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; two = { d: Math.hypot(a.x - b.x, a.y - b.y), a: ang(a, b), dist: this.view.dist, yaw: this.view.yaw }; if (down) down.moved = true; }
    });
    el.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2 && two) { const [a, b] = [...ptrs.values()]; this.view.dist = Math.max(10, Math.min(46, two.dist * two.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)))); this.view.yaw = two.yaw - (ang(a, b) - two.a); this.tween = null; return; }
      if (down && ptrs.size === 1) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 8) down.moved = true;
        if (down.moved) {
          // 指の動きに合わせて地図を動かす(画面の向きに合わせる)
          const k = this.view.dist / this.el.clientHeight * 1.1, y = this.view.yaw;
          const rx = Math.cos(y), rz = -Math.sin(y), fx = -Math.sin(y), fz = -Math.cos(y);
          let tx = down.tx - (dx * rx - dy * fx) * k * 1, tz = down.tz - (dx * rz - dy * fz) * k * 1;
          const rr = Math.hypot(tx, tz); if (rr > 11) { tx *= 11 / rr; tz *= 11 / rr; }
          const nt = performance.now(), dtm = Math.max(1, nt - (down.lt || nt - 16)); down.vx = ((tx - this.view.tx) / dtm) * 0.6 + (down.vx || 0) * 0.4; down.vz = ((tz - this.view.tz) / dtm) * 0.6 + (down.vz || 0) * 0.4; down.lt = nt;
          this.view.tx = tx; this.view.tz = tz; this.tween = null; this.vel = null;
        }
      }
    });
    const up = (e) => {
      ptrs.delete(e.pointerId); if (ptrs.size < 2) two = null;
      if (ptrs.size === 1) { const [p] = [...ptrs.values()]; down = { x: p.x, y: p.y, t: 0, tx: this.view.tx, tz: this.view.tz, moved: true }; }
      if (down && ptrs.size === 0) { if (!down.moved && performance.now() - down.t < 450) this.tap(e.clientX, e.clientY); else if (down.vx != null && performance.now() - down.lt < 80) this.vel = { x: down.vx * 1000, z: down.vz * 1000 }; down = null; }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { this.view.dist = Math.max(10, Math.min(46, this.view.dist + e.deltaY * 0.02)); }, { passive: true });
  }
  tap(x, y) {
    const r = this.R.domElement.getBoundingClientRect();
    const m = new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, this.cam);
    const objs = [...(this.peddlerObj ? [this.peddlerObj] : []), ...(this.ratings ? this.ratings.values() : [])].concat([...this.shopObjs.values()].filter(Boolean)).concat([...(this.signs || new Map()).values()]).concat([...(this.previews || new Map()).values()]).concat([...this.lotObjs.values()]).concat([...this.plus.values()].filter(s => s.visible));
    const hit = ray.intersectObjects(objs, true)[0];
    if (!hit) return;
    let o = hit.object; while (o && o.userData.shop == null && o.userData.lot == null && !o.userData.peddler) o = o.parent;
    if (o && o.userData.peddler) { if (this.onTap) this.onTap({ peddler: true }); return; }
    if (!o) return;
    const so = o.userData.shop != null && this.shopObjs.get(o.userData.shop); if (so) so.userData.bounce = 0.0001;
    this.ripple(o.userData.lot);
    if (this.onTap) this.onTap({ shop: o.userData.shop ?? null, lot: o.userData.lot });
  }
  ripple(lotId) {
    const l = LOTS[lotId]; if (!l) return;
    if (!this.ripGeo) { this.ripGeo = new THREE.RingGeometry(0.82, 1, 48); this.ripGeo.rotateX(-Math.PI / 2); }
    const m = new THREE.Mesh(this.ripGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(hexPos(l.q, l.r)).add(new THREE.Vector3(0, 0.32, 0)); m.userData.life = 0; this.world.add(m); (this.rips = this.rips || []).push(m);
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
    if (this.vel) { v.tx += this.vel.x * dt; v.tz += this.vel.z * dt; const rr = Math.hypot(v.tx, v.tz); if (rr > 11) { v.tx *= 11 / rr; v.tz *= 11 / rr; this.vel.x *= 0.5; this.vel.z *= 0.5; } const f = Math.pow(0.04, dt); this.vel.x *= f; this.vel.z *= f; if (Math.hypot(this.vel.x, this.vel.z) < 0.05) this.vel = null; }
    if (this.rips) this.rips = this.rips.filter(m => { m.userData.life += dt; const k = m.userData.life / 0.55; m.scale.setScalar(0.4 + k * 0.9); m.material.opacity = 0.9 * (1 - k); if (k >= 1) { this.world.remove(m); m.material.dispose(); return false; } return true; });
    if (this.ratings) for (const [, g] of this.ratings) { const k = 1 + Math.sin(t * 3 + g.userData.ph) * 0.06; g.children[1].scale.set(1.9 * k, 0.83 * k, 1); g.children[0].material.opacity = 0.45 + Math.sin(t * 3 + g.userData.ph) * 0.12; }
    if (this.dusts) this.dusts = this.dusts.filter(d => { d.userData.life += dt; const k = d.userData.life / 0.9; d.position.addScaledVector(d.userData.v, dt); d.userData.v.multiplyScalar(0.9); d.scale.setScalar(0.4 + k * 0.9); d.material.opacity = 1 - k; if (k >= 1) { this.world.remove(d); return false; } return true; });
    this.fxTick(dt);
    if (this.crowdMx) for (const mx of this.crowdMx) mx.update(dt);
    for (const [, o] of this.shopObjs) if (o && o.userData.shake > 0) { o.userData.shake -= dt; const k = Math.max(0, o.userData.shake); o.rotation.z = Math.sin(t * 60) * 0.08 * k; if (k <= 0) o.rotation.z = 0; }
    if (this.popIn) for (const o of this.popIn) { if (o.userData.pop < 1) { o.userData.pop = Math.min(1, o.userData.pop + dt * 2.5); o.scale.setScalar(Math.max(0.01, 1 - Math.pow(1 - o.userData.pop, 3))); } }
    if (this.signs) for (const [, sp] of this.signs) if (sp.userData.isNew) sp.position.y = 2.05 + Math.abs(Math.sin(t * 3)) * 0.18;
    for (const [, s] of this.plus) if (s.visible) s.position.y = 0.95 + Math.sin(t * 2.4 + s.userData.lot) * 0.08;
    if (this.clouds) for (const c of this.clouds) { c.position.x += c.userData.cloud * dt; if (c.position.x > 24) c.position.x = -24; }
    if (this.precip && this.precip.visible) {
      const a = this.precip.geometry.attributes.position, sp = this.precipSpeed * dt, sway = this.weather === 'snow' ? Math.sin(t) * 0.01 : 0;
      for (let i = 0; i < a.count; i++) { let y = a.getY(i) - sp; if (y < 0) y += 18; a.setY(i, y); if (sway) a.setX(i, a.getX(i) + sway); }
      a.needsUpdate = true; this.precip.position.set(v.tx, 0, v.tz);
      if (this.weather === 'storm') { if (Math.random() < 0.004) this.flash = 1; if (this.flash > 0) { this.flash -= dt * 4; this.scene.background.setHex(this.flash > 0.5 ? 0xdde6f5 : 0x5d6b7d); } }
    }
    if (this.anim) for (const f of this.anim) f(t);
    if (!this.coinMat) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(26, 24, 4, 32, 32, 28); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#ffc53d'); g.addColorStop(1, '#d97706'); x.fillStyle = g; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.fill(); this.coinMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }); this.coins = []; }
    for (const [, o] of this.shopObjs) if (o && o.userData.thrive && Math.random() < dt * 0.9) { const sp = new THREE.Sprite(this.coinMat); sp.scale.setScalar(0.22); sp.position.copy(o.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.0, (Math.random() - 0.5) * 0.6)); sp.userData.life = 0; this.world.add(sp); this.coins.push(sp); }
    if (this.coins) this.coins = this.coins.filter(c => { c.userData.life += dt; c.position.y += dt * 0.9; c.material.opacity = 1; c.scale.setScalar(0.22 * (1 - c.userData.life / 1.6)); if (c.userData.life > 1.6) { this.world.remove(c); return false; } return true; });
    if (this.traffic) for (const w of this.traffic) {
      const n = w.pts.length - 1; w.u += w.dir * dt * 0.45; if (w.u > n) { w.u = n; w.dir = -1; } if (w.u < 0) { w.u = 0; w.dir = 1; }
      const i = Math.min(n - 1, Math.floor(w.u)), f = w.u - i, a = w.pts[i], b = w.pts[i + 1];
      const dx = (b.x - a.x) * w.dir, dz = (b.z - a.z) * w.dir, L = Math.hypot(dx, dz) || 1;
      w.o.position.set(a.x + (b.x - a.x) * f + (-dz / L) * w.off, 0, a.z + (b.z - a.z) * f + (dx / L) * w.off); w.o.rotation.y = Math.atan2(dx, dz); w.mx.update(dt);
    }
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
