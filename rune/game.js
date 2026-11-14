// ルーンはじき: ルーンコインをはじいて、穴に落とさずに魔王の門へ。左右の壁で跳ねるほど強い一撃になる
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { unlockAudio, sfx, bgm, haptic, audioPref, setAudioPref } from './audio.js';

const $ = (s) => document.querySelector(s);
const ICON = (k) => `../assets/icons/${k}.png`;
const img = (k, c = '') => `<img class="ic ${c}" src="${ICON(k)}" alt="" draggable="false">`;
const HW = 5, H = 34, CR = 0.42, GATE = 2.0, LY = 1.8;           // 盤の半幅・長さ・コインの半径・門の半幅・発射台の位置
const PADS = [[5.5, 9], [14, 17.5], [22.5, 26]];                // 左右の壁の「はじき板」
const GRAV = 3.2, DAMP = 0.12, VMIN = 6, VMAX = 24, SKIP = 11.5;  // 重力・減速・発射の速さ・穴を飛び越える速さ
const HAND_MAX = 5, REGEN = 3.2, MANA_MAX = 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ── ステージ
const FUNNEL = [[-HW, 27.2, -(GATE + 0.2), H], [HW, 27.2, GATE + 0.2, H]];
export const STAGES = [
  { id: 'forest', name: 'スライム王の森', sub: 'STAGE 1', boss: { name: 'スライム王', kind: 'slime', hp: 30 }, bgm: 'forest',
    sky: ['#7ec8f0', '#dff3ff'], fog: 0xcfe8f4, ground: 0x6aae4c, board: ['#5b4a3a', '#6d5944'], rune: '#ffd36e',
    holes: [[-2.6, 10, 1.05], [2.6, 12.5, 1.05], [0, 19.5, 1.2], [-3, 25, 0.95], [3, 26.5, 0.95]],
    bumpers: [[-2.3, 14.8], [2.3, 14.8], [-2.6, 22.6], [2.6, 22.6]], rails: [],
    mons: ['slime', 'slime', 'slime', 'bat'], spawn: 7.5, skills: ['pit', 'wind', 'summon'], every: 12,
    lines: { intro: 'ぷるぷる…ここは通さないぞ!', half: 'ぬぬ…家来たち、かかれ!', win: 'ぷしゅう…', pit: '穴よ開け〜!', wind: 'ぷうううっ!', summon: 'みんな出ておいで!' } },
  { id: 'crypt', name: '黒騎士の墓所', sub: 'STAGE 2', boss: { name: '黒騎士ヴァルグ', kind: 'knight', hp: 45 }, bgm: 'crypt',
    sky: ['#3b2f5e', '#e8907a'], fog: 0x6b5878, ground: 0x4c5a48, board: ['#3d3a48', '#4c4858'], rune: '#a98bff',
    holes: [[-2.9, 9, 1], [2.9, 9, 1], [0, 12.2, 1.05], [-3.1, 19.5, 1.1], [1.4, 22, 1.05], [3.3, 27, 0.9], [-1.6, 27.6, 0.95]],
    bumpers: [[-1.7, 15.2], [1.7, 15.2], [0, 24.6]], rails: [[-0.9, 18.6, 0.9, 18.6]],
    mons: ['slime', 'bat', 'bat', 'slime', 'golem'], spawn: 6.6, skills: ['pit', 'wind', 'quake', 'shield', 'summon'], every: 10,
    lines: { intro: '我が剣の前にひれ伏せ', half: 'なかなかやるな…本気を出そう', win: '見事だ…', pit: '大地よ、裂けよ', wind: '黒き風よ', quake: '大地よ、揺れよ!', shield: '闇の結界!', summon: '亡者どもよ、来い' } },
  { id: 'maou', name: '魔王城', sub: 'STAGE 3', boss: { name: '魔王ゴルザーク', kind: 'maou', hp: 60 }, bgm: 'maou',
    sky: ['#1a0a1e', '#a4243b'], fog: 0x3a1420, ground: 0x3b2c2c, board: ['#2a1f2e', '#3a2a38'], rune: '#ff5b6e',
    holes: [[-2.4, 9.5, 1.05, 1.6, 0.7], [2.2, 13.2, 1, 1.8, 0.9], [0, 18, 1.2, 2.4, 0.55], [-2.8, 23.2, 0.95], [2.8, 23.2, 0.95], [0, 28.2, 1, 2.3, 0.85]],
    bumpers: [[-3, 16.2], [3, 16.2], [0, 21.2], [-1.6, 31]], rails: [[-HW, 11.6, -3.4, 13.4], [HW, 11.6, 3.4, 13.4]],
    mons: ['slime', 'bat', 'golem', 'bat', 'slime'], spawn: 5.6, skills: ['pit', 'wind', 'quake', 'shield', 'summon', 'gravity'], every: 8.6,
    lines: { intro: 'よくぞ来た。だがここが墓場だ', half: 'ふはは、遊びは終わりだ!', win: 'ば、ばかな…', pit: '奈落へ落ちよ!', wind: '魔風よ吹き荒れろ', quake: '城よ、震えよ!', shield: '貴様の攻撃など届かぬ', summon: 'しもべども、行け!', gravity: '重力の呪いを受けよ!' } },
];
const BOSS_SKILL = {
  pit: { name: '奈落の口', icon: 'o_ruin', text: '新しい穴が開く' },
  wind: { name: '魔風', icon: 'o_wave', text: 'コインが横に流される' },
  quake: { name: '地揺れ', icon: 'o_rock', text: 'コインが揺さぶられる' },
  shield: { name: '闇の結界', icon: 'o_crystal', text: '門がふさがる(3回当てて破る)' },
  summon: { name: '魔物召喚', icon: 'o_rogue', text: '魔物がまとめて出てくる' },
  gravity: { name: '重力の呪い', icon: 'o_magnet', text: 'コインが重くなる' },
};
const SKILLS = {
  bridge: { name: '光の橋', icon: 'o_star', cost: 4, text: '7秒間 穴をふさぐ' },
  fire: { name: '炎のコイン', icon: 'o_fire', cost: 3, text: '次の3枚が炎に。魔物をつらぬき、門で2倍' },
  split: { name: '分身', icon: 'o_gem', cost: 5, text: '飛んでいるコインが3つに分かれる' },
  time: { name: '時の砂', icon: 'o_hourglass', cost: 4, text: '6秒間 魔物とボスが止まる' },
  guard: { name: '守りの壁', icon: 'o_knight', cost: 3, text: '10秒間 城に来た魔物を消す' },
};
const MON = {
  slime: { hp: 3, sp: 1.25, r: 0.55, dmg: 1 },
  bat: { hp: 2, sp: 1.9, r: 0.45, dmg: 1 },
  golem: { hp: 9, sp: 0.72, r: 0.75, dmg: 2 },
};
const SAVE = 'rune-save';
const save = (() => { try { return JSON.parse(localStorage.getItem(SAVE) || '{}'); } catch (e) { return {}; } })();
save.stars = save.stars || {};
const storeSave = () => { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) { } };

// ── 3D の準備
const R = new THREE.WebGLRenderer({ antialias: true });
R.setPixelRatio(Math.min(2, devicePixelRatio)); R.outputColorSpace = THREE.SRGBColorSpace; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
$('#stage').appendChild(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
const hemi = new THREE.HemisphereLight(0xffffff, 0x4a5a6a, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dd, 2.2); sun.position.set(8, 26, 10); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 24, bottom: -24, near: 1, far: 80 }); sun.target.position.set(0, 0, -16); scene.add(sun, sun.target);
const W3 = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
const loader = new GLTFLoader(); const glb = {};
const loadGLB = (url) => glb[url] || (glb[url] = new Promise((res) => loader.load(url, (g) => res(g), undefined, () => res(null))));
function fitH(o, h) { const b = new THREE.Box3().setFromObject(o); const s = h / Math.max(0.001, b.max.y - b.min.y); o.scale.multiplyScalar(s); return o; }
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
// 金属が映りこむ空(環境マップ)
function makeEnv(top, bot) {
  const es = new THREE.Scene(); const tex = canvasTex(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
  const l = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 3), new THREE.MeshBasicMaterial({ color: 0xffffff })); l.position.y = 8; es.add(l);
  const pm = new THREE.PMREMGenerator(R); const rt = pm.fromScene(es, 0.03); pm.dispose(); return rt.texture;
}
// ルーンの模様(コイン・発射台)
function runeTex(col, bg) {
  return canvasTex(256, 256, (g, w) => {
    const c = w / 2; if (bg) { const gr = g.createRadialGradient(c, c, 10, c, c, c); gr.addColorStop(0, '#fff3c4'); gr.addColorStop(0.55, '#f2b632'); gr.addColorStop(1, '#a8650c'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }
    g.strokeStyle = col; g.lineWidth = 9; g.beginPath(); g.arc(c, c, c - 14, 0, Math.PI * 2); g.stroke(); g.lineWidth = 4; g.beginPath(); g.arc(c, c, c - 34, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 8; g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5, r = c - 50; const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
    g.fillStyle = col; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.fillRect(c + Math.cos(a) * (c - 24) - 4, c + Math.sin(a) * (c - 24) - 4, 8, 8); }
  });
}
const dotTex = canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });

// ── 粒子(火花・きらきら)
class Particles {
  constructor(n = 900) {
    this.n = n; this.i = 0; this.pos = new Float32Array(n * 3).fill(-999); this.col = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.base = new Float32Array(n * 3); this.gr = new Float32Array(n);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.42, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pts.frustumCulled = false; scene.add(this.pts);
  }
  burst(p, color, n = 20, sp = 5, opt = {}) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.i = (this.i + 1) % this.n, a = Math.random() * Math.PI * 2, u = opt.up ?? 0.6, s = sp * (0.35 + Math.random() * 0.65);
      this.pos[i * 3] = p.x + (opt.spread || 0) * (Math.random() - 0.5); this.pos[i * 3 + 1] = p.y + (opt.spreadY || 0) * Math.random(); this.pos[i * 3 + 2] = p.z + (opt.spread || 0) * (Math.random() - 0.5);
      this.v[i * 3] = Math.cos(a) * s * (1 - u * 0.5) + (opt.vx || 0); this.v[i * 3 + 1] = u * s * (0.5 + Math.random()) + (opt.vy || 0); this.v[i * 3 + 2] = Math.sin(a) * s * (1 - u * 0.5) + (opt.vz || 0);
      this.life[i] = this.max[i] = (opt.life || 0.7) * (0.6 + Math.random() * 0.6); this.gr[i] = opt.grav ?? 9;
      const j = 0.8 + Math.random() * 0.4; this.base[i * 3] = c.r * j; this.base[i * 3 + 1] = c.g * j; this.base[i * 3 + 2] = c.b * j;
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue; this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.v[i * 3 + 1] -= this.gr[i] * dt; for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] += this.v[i * 3 + k] * dt; this.v[i * 3 + k] *= 1 - 1.5 * dt; }
      const f = this.life[i] / this.max[i]; for (let k = 0; k < 3; k++) this.col[i * 3 + k] = this.base[i * 3 + k] * f;
    }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
  }
}
const P = new Particles();

// ── 画面の文字(ダメージ・コンボ)
function screenOf(v) { const p = v.clone().project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }
function floatText(v, html, cls = '') {
  const s = screenOf(v), el = document.createElement('div'); el.className = 'ft ' + cls; el.innerHTML = html; el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
  $('#fx').appendChild(el); setTimeout(() => el.remove(), 1300);
}
function banner(html, cls = '', ms = 1300) { const el = document.createElement('div'); el.className = 'banner ' + cls; el.innerHTML = html; $('#fx').appendChild(el); setTimeout(() => el.remove(), ms); }
function flash(color, ms = 260) { const el = document.createElement('div'); el.className = 'flash'; el.style.background = color; $('#fx').appendChild(el); setTimeout(() => el.remove(), ms); }

// ── 世界(ステージごとに作り直す)
let world = null, G = null, mixers = [], mage = null, bossObj = null;
const mats = {};
function stdMat(o) { return new THREE.MeshStandardMaterial(o); }
function box(w, h, d, m) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = o.receiveShadow = true; return o; }

async function buildWorld(st) {
  if (world) { scene.remove(world); world.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  world = new THREE.Group(); scene.add(world); mixers = []; bossObj = null; mage = null; G.clouds = [];
  scene.background = canvasTex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, st.sky[0]); gr.addColorStop(1, st.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(st.fog, 40, 95); fitCam();
  scene.environment = makeEnv(st.sky[0], st.sky[1]);
  const dark = st.id !== 'forest';
  hemi.intensity = dark ? 0.75 : 1.1; sun.intensity = dark ? 1.6 : 2.3; sun.color.set(st.id === 'maou' ? 0xffb0a0 : st.id === 'crypt' ? 0xffd4c0 : 0xfff1dd);
  // 地面
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), stdMat({ color: st.ground, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.9; ground.receiveShadow = true; world.add(ground);
  // 盤(木と石の台に、ルーンの彫りもの)
  const top = canvasTex(256, 870, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, st.board[0]); gr.addColorStop(0.5, st.board[1]); gr.addColorStop(1, st.board[0]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 58) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, y + 3, w, 2); }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 30, 1.5); }
    g.globalAlpha = 0.13; g.strokeStyle = st.rune; g.lineWidth = 3; for (let i = 0; i < 9; i++) { const x = 40 + (i % 2) * 176, y = 70 + i * 92; g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.moveTo(x - 16, y); g.lineTo(x + 16, y); g.moveTo(x, y - 16); g.lineTo(x, y + 16); g.stroke(); }
    g.globalAlpha = 1;
  });
  const side = stdMat({ color: 0x6f6a72, roughness: 0.9 });
  const plat = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 1.6, 0.9, H + 4), [side, side, stdMat({ map: top, roughness: 0.85 }), side, side, side]);
  plat.position.set(0, -0.45, -(H / 2 + 0.6)); plat.receiveShadow = true; world.add(plat);
  // 下の縁(手前): 自分の城の石垣
  const stone = mats.stone = stdMat({ color: dark ? 0x7d7686 : 0x9a938c, roughness: 0.85 });
  const gold = stdMat({ color: 0xffc94d, metalness: 0.8, roughness: 0.3, emissive: 0x6a4200, emissiveIntensity: 0.5 });
  for (const s of [-1, 1]) { const w = box(0.5, 0.8, H + 4, stone); w.position.set(s * (HW + 0.25), 0.4, -(H / 2 + 0.6)); world.add(w); const cap = box(0.56, 0.08, H + 4, gold); cap.position.set(s * (HW + 0.25), 0.82, -(H / 2 + 0.6)); world.add(cap); }
  // はじき板
  G.padMeshes = { '-1': [], '1': [] };
  for (const s of [-1, 1]) for (const [a, b] of PADS) {
    const m = stdMat({ color: 0xffd36e, metalness: 0.6, roughness: 0.3, emissive: 0xffa600, emissiveIntensity: 0.35 });
    const p = box(0.16, 0.55, b - a, m); p.position.set(s * (HW - 0.06), 0.32, -(a + b) / 2); world.add(p); G.padMeshes[s].push(p);
    for (let k = 0; k < 3; k++) { const ar = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), m); ar.rotation.z = s * Math.PI / 2; ar.position.set(s * (HW - 0.32), 0.05, -(a + (b - a) * (k + 0.5) / 3)); world.add(ar); }
  }
  // 上の壁と門
  for (const s of [-1, 1]) { const w = box(HW - GATE + 0.6, 0.9, 0.6, stone); w.position.set(s * (GATE + (HW - GATE) / 2 + 0.1), 0.45, -(H + 0.3)); world.add(w); }
  for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 3.2, 10), stone); pl.position.set(s * (GATE + 0.3), 1.6, -(H + 0.3)); pl.castShadow = true; world.add(pl); const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), stdMat({ color: 0xffffff, emissive: st.rune, emissiveIntensity: 2 })); orb.position.set(s * (GATE + 0.3), 3.4, -(H + 0.3)); world.add(orb); }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(GATE + 0.3, 0.26, 8, 20, Math.PI), stone); arch.position.set(0, 3.2, -(H + 0.3)); arch.castShadow = true; world.add(arch);
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(GATE * 2 + 0.3, 3.2), new THREE.MeshBasicMaterial({ color: st.rune, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); portal.position.set(0, 1.6, -(H + 0.35)); world.add(portal); G.portal = portal;
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(GATE * 2 + 0.4, 3.4), new THREE.MeshBasicMaterial({ color: 0xb04dff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); shield.position.set(0, 1.7, -(H - 0.1)); world.add(shield); G.shieldMesh = shield;
  // 斜めの壁(レール)
  G.rails = FUNNEL.concat(st.rails).map(([ax, ay, bx, by]) => ({ ax, ay, bx, by }));
  for (const r of G.rails) {
    const L = Math.hypot(r.bx - r.ax, r.by - r.ay), o = box(L + 0.3, 0.75, 0.32, stone); o.position.copy(W3((r.ax + r.bx) / 2, (r.ay + r.by) / 2, 0.37)); o.rotation.y = Math.atan2(r.by - r.ay, r.bx - r.ax); world.add(o);
    const c = box(L + 0.34, 0.07, 0.36, gold); c.position.copy(o.position); c.position.y = 0.78; c.rotation.y = o.rotation.y; world.add(c);
  }
  // クリスタル(はね返す)
  G.bumpers = st.bumpers.map(([x, y]) => {
    const g = new THREE.Group(); g.position.copy(W3(x, y));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.3, 12), stone); base.position.y = 0.15; base.castShadow = true; g.add(base);
    const cm = stdMat({ color: 0x3fc4ff, metalness: 0, roughness: 0.35, emissive: 0x1a8ee0, emissiveIntensity: 1.2, flatShading: true, transparent: true, opacity: 0.92 });
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), cm); cr.scale.set(1, 1.7, 1); cr.position.y = 1.05; cr.castShadow = true; g.add(cr);
    world.add(g); return { x, y, r: 0.6, g, cr, cm, hit: 0 };
  });
  // 穴(奈落)
  const pitTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, '#000'); gr.addColorStop(0.62, '#06000c'); gr.addColorStop(0.8, 'rgba(30,0,50,.85)'); gr.addColorStop(1, 'rgba(30,0,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const swirlTex = canvasTex(128, 128, (g, w) => { g.translate(64, 64); for (let k = 0; k < 3; k++) { g.rotate(Math.PI * 2 / 3); g.beginPath(); for (let a = 0; a < 5; a += 0.1) { const r = 6 + a * 11; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.strokeStyle = 'rgba(190,120,255,.8)'; g.lineWidth = 5; g.stroke(); } });
  mats.pit = new THREE.MeshBasicMaterial({ map: pitTex, transparent: true, depthWrite: false });
  mats.swirl = new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  mats.bridge = new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  G.holes = st.holes.map(([x, y, r, mx, sp]) => makeHole(x, y, r, { mx, sp }));
  // 発射台
  const lt = runeTex('#ffe9a8', false); const lm = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), new THREE.MeshBasicMaterial({ map: lt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd36e }));
  lm.rotation.x = -Math.PI / 2; lm.position.copy(W3(0, LY, 0.02)); world.add(lm); G.launchMesh = lm; G.readyCoin = null;
  // 守りの壁(スキル)
  const gw = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, 1.4), new THREE.MeshBasicMaterial({ color: 0x7cc7ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); gw.position.copy(W3(0, 0.7, 0.7)); world.add(gw); G.guardMesh = gw;
  // 狙いの点線
  G.aimDots = []; const dm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
  for (let i = 0; i < 22; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), dm); d.visible = false; world.add(d); G.aimDots.push(d); }
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 3), new THREE.MeshBasicMaterial({ color: 0xffd36e })); arrow.visible = false; world.add(arrow); G.arrow = arrow;
  // まわりの飾り(森・墓・城)
  decorate(st);
  // 自分(魔法使い)とボス
  await Promise.all([placeMage(), placeBoss(st)]);
}
function makeHole(x, y, r, o = {}) {
  const g = new THREE.Group(); g.position.copy(W3(x, y, 0.015));
  const pit = new THREE.Mesh(new THREE.CircleGeometry(r * 1.18, 32), mats.pit); pit.rotation.x = -Math.PI / 2; g.add(pit);
  const sw = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 32), mats.swirl); sw.rotation.x = -Math.PI / 2; sw.position.y = 0.01; g.add(sw);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.06, 6, 36), new THREE.MeshBasicMaterial({ color: o.temp ? 0xff3b5c : 0x9a5cff })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.03; g.add(rim);
  const br = new THREE.Mesh(new THREE.CircleGeometry(r * 1.1, 6), mats.bridge); br.rotation.x = -Math.PI / 2; br.position.y = 0.06; g.add(br);
  world.add(g);
  return { x, y, x0: x, r, mx: o.mx || 0, sp: o.sp || 0, ph: Math.random() * 6, g, sw, temp: o.temp || 0, grow: o.temp ? 0 : 1 };
}
async function model(name, h) { const g = await loadGLB('../assets/kaykit/hex/' + name + '.gltf'); if (!g) return null; const o = g.scene.clone(true); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); if (h) fitH(o, h); return o; }
function decorate(st) {
  const spots = [];
  for (let i = 0; i < 26; i++) { const s = i % 2 ? 1 : -1; spots.push([s * rand(7.5, 17), rand(-4, H + 8)]); }
  const kinds = st.id === 'forest' ? ['trees_A_medium', 'trees_B_medium', 'tree_single_A', 'trees_A_medium', 'rock_single_A'] : st.id === 'crypt' ? ['rock_single_A', 'rock_single_C', 'tree_single_A', 'building_destroyed', 'trees_B_medium'] : ['rock_single_C', 'building_destroyed', 'rock_single_A', 'rock_single_C'];
  spots.forEach(([x, y], i) => model(kinds[i % kinds.length]).then(o => { if (!o) return; o.scale.setScalar(rand(1.6, 2.4)); o.position.copy(W3(x, y, -0.85)); o.rotation.y = rand(0, 6); if (st.id !== 'forest') o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.multiplyScalar(st.id === 'maou' ? 0.55 : 0.75); } }); world.add(o); }));
  // 奥の城
  for (const s of [-1, 1]) model('building_tower_A_yellow').then(o => { if (!o) return; fitH(o, 7); o.position.copy(W3(s * 6.6, H + 1.5, -0.9)); if (st.id !== 'forest') o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.6); } }); world.add(o); });
  for (let i = 0; i < 5; i++) model('cloud_big').then(o => { if (!o) return; o.scale.setScalar(2.4); o.position.set(-24 + i * 12, 14 + (i % 2) * 3, -H - 14 - (i % 3) * 6); o.userData.cloud = 0.3 + i * 0.07; world.add(o); G.clouds.push(o); });
  // 手前: 自分の城の旗
  for (const s of [-1, 1]) model(s < 0 ? 'flag_blue' : 'flag_yellow').then(o => { if (!o) return; fitH(o, 2.2); o.position.copy(W3(s * 6.2, -0.6, -0.9)); world.add(o); });
}
// KayKitの人形は武器や小物をぜんぶ持っているので、使うものだけ残す
function hideProps(o, names) { o.traverse(m => { if (names.includes(m.name)) m.visible = false; }); }
async function placeMage() {
  const g = await loadGLB('../assets/kaykit/chars/Mage.glb'); if (!g) return;
  const o = SkeletonUtils.clone(g.scene); hideProps(o, ['Spellbook', 'Spellbook_open', '1H_Wand']); fitH(o, 2.1); o.position.copy(W3(-3.3, 0.5, 0)); o.rotation.y = Math.PI - 0.25; o.traverse(m => { if (m.isMesh) m.castShadow = true; });
  world.add(o); const mx = new THREE.AnimationMixer(o); mixers.push(mx);
  const act = (n) => { const c = g.animations.find(a => a.name === n); return c ? mx.clipAction(c) : null; };
  const idle = act('Idle'); if (idle) idle.play();
  mage = { o, mx, play(n) { const a = act(n); if (!a || !idle) return; a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.play(); idle.crossFadeTo(a, 0.1, false); setTimeout(() => { idle.reset().play(); a.crossFadeTo(idle, 0.25, false); }, n === 'Cheer' ? 1400 : 700); } };
}
async function placeBoss(st) {
  const k = st.boss.kind, g = new THREE.Group(); g.position.copy(W3(0, H + 5.5, 1.6)); world.add(g);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3, 3.4, 8), mats.stone); pedestal.position.y = -1.7; pedestal.receiveShadow = true; g.add(pedestal);
  let body = null, anim = null, mats2 = [];
  if (k === 'slime') {
    body = new THREE.Group(); const sm = stdMat({ color: 0x5ee06a, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.93, emissive: 0x0c4a12, emissiveIntensity: 0.4 }); mats2.push(sm);
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.9, 32, 24), sm); b.scale.set(1, 0.78, 1); b.position.y = 1.5; b.castShadow = true; body.add(b);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), stdMat({ color: 0xffffff, roughness: 0.2 })); e.position.set(s * 0.62, 1.95, 1.55); body.add(e); const pu = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), stdMat({ color: 0x111111 })); pu.position.set(s * 0.6, 1.95, 1.85); body.add(pu); }
    const gm = stdMat({ color: 0xffc94d, metalness: 0.9, roughness: 0.25 }); const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.75, 0.5, 10, 1, true), gm); cr.position.y = 3.05; body.add(cr);
    for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), gm); const a = i / 5 * Math.PI * 2; sp.position.set(Math.cos(a) * 0.82, 3.5, Math.sin(a) * 0.82); body.add(sp); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), stdMat({ color: 0xff3b5c, emissive: 0xff0030, emissiveIntensity: 0.6 })); gem.position.set(Math.cos(a) * 0.9, 3.08, Math.sin(a) * 0.9); body.add(gem); }
    body.position.y = 0; body.scale.setScalar(1.15); g.add(body);
    anim = (t) => { body.scale.set(1.15 + Math.sin(t * 3) * 0.06, 1.15 - Math.sin(t * 3) * 0.06, 1.15 + Math.sin(t * 3) * 0.06); };
  } else {
    const gl = await loadGLB('../assets/kaykit/chars/' + (k === 'knight' ? 'Knight' : 'Barbarian') + '.glb');
    if (gl) {
      body = SkeletonUtils.clone(gl.scene); fitH(body, k === 'knight' ? 4.2 : 5); body.position.y = 0;
      const tint = new THREE.Color(k === 'knight' ? 0x4a4462 : 0x7a2a3a);
      body.traverse(m => { if (m.isMesh) { m.castShadow = true; m.material = m.material.clone(); m.material.color.multiply(tint); m.material.emissive = new THREE.Color(k === 'knight' ? 0x2a1450 : 0x400010); m.material.emissiveIntensity = 0.6; mats2.push(m.material); } });
      hideProps(body, k === 'knight' ? ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', '2H_Sword'] : ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', 'Mug']);
      g.add(body); const mx = new THREE.AnimationMixer(body); mixers.push(mx);
      const act = (n) => { const c = gl.animations.find(a => a.name === n); return c ? mx.clipAction(c) : null; }, idle = act('Idle'); if (idle) idle.play();
      body.userData.play = (n, ms = 800) => { const a = act(n); if (!a || !idle) return; a.reset(); a.setLoop(THREE.LoopOnce, 1); a.play(); idle.crossFadeTo(a, 0.08, false); setTimeout(() => { idle.reset().play(); a.crossFadeTo(idle, 0.25, false); }, ms); };
    }
  }
  // 足元のオーラ
  const aura = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshBasicMaterial({ map: runeTex(st.rune, false), color: st.rune, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); aura.rotation.x = -Math.PI / 2; aura.position.y = 0.03; g.add(aura);
  bossObj = { g, body, anim, mats: mats2, aura, flash: 0, base: g.position.clone() };
}

// ── カメラ(縦長の画面に盤がおさまるように)
const camBase = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
// 盤の手前(発射台)が下の操作パネルの上に、ボスが上の体力バーの下に来るように、距離と上下のずれを決める
function fitCam() {
  const w = innerWidth, h = innerHeight; R.setSize(w, h); cam.aspect = w / h; cam.fov = w / h < 0.8 ? 48 : 40; cam.clearViewOffset(); cam.updateProjectionMatrix();
  const topY = 150, botY = h - 205, look = new THREE.Vector3(0, 0, -14), dir = new THREE.Vector3(0, 15, 13).normalize();
  const bottom = W3(0, -0.6, 0), top = new THREE.Vector3(0, 3.5, -(H + 0.5)), sy = (v) => (1 - v.clone().project(cam).y) / 2 * h;
  let lo = 15, hi = 120;
  for (let i = 0; i < 24; i++) { const d = (lo + hi) / 2; cam.position.copy(look).addScaledVector(dir, d); cam.lookAt(look); cam.updateMatrixWorld(); const span = sy(bottom) - sy(top); if (span > botY - topY) lo = d; else hi = d; }
  cam.position.copy(look).addScaledVector(dir, hi); cam.lookAt(look); cam.updateMatrixWorld();
  const dy = sy(bottom) - botY; camBase.pos.copy(cam.position); camBase.look.copy(look);
  cam.setViewOffset(w, h, 0, dy, w, h); cam.updateProjectionMatrix();
  if (scene.fog) { scene.fog.near = hi * 1.4; scene.fog.far = hi * 3.2; }
}
addEventListener('resize', fitCam); fitCam();

// ── ゲームの状態
function newGame(si) {
  const st = STAGES[si];
  G = { si, st, t: 0, coins: [], hand: HAND_MAX, regen: 0, mana: 2, castle: 10, castleMax: 10, boss: st.boss.hp, bossMax: st.boss.hp, mons: [], holes: [], ef: {}, fire: 0,
    bossT: 7, spawnT: 3, kl: { act: 0, cd: 0, id: 0 }, kr: { act: 0, cd: 0, id: 0 }, goals: 0, maxCombo: 0, fell: 0, kills: 0, cut: null, slow: 0, shake: 0, over: null, half: false, shieldHp: 0, flyers: [], mid: 0, cid: 0 };
  return G;
}
const totalCoinsOut = () => G.coins.filter(c => !c.dead).length;
function coinMesh(fire) {
  if (!mats.coinTop) { mats.coinTop = stdMat({ map: runeTex('#8a4b00', true), metalness: 0.85, roughness: 0.28 }); mats.coinSide = stdMat({ color: 0xe0a228, metalness: 0.9, roughness: 0.25 }); mats.fireTop = stdMat({ map: runeTex('#8a1000', true), color: 0xff8a5c, metalness: 0.6, roughness: 0.3, emissive: 0xff3000, emissiveIntensity: 0.9 }); }
  const m = new THREE.Mesh(new THREE.CylinderGeometry(CR, CR, 0.14, 28), [fire ? mats.fireTop : mats.coinSide, fire ? mats.fireTop : mats.coinTop, mats.coinSide]); m.castShadow = true; world.add(m); return m;
}
function spawnCoin(x, y, vx, vy, fire) { const c = { id: ++G.cid, x, y, vx, vy, r: CR, combo: 0, fire: !!fire, mesh: coinMesh(fire), dead: false, fall: 0, slowT: 0, kickId: { '-1': -1, '1': -1 }, trail: 0, spin: 0 }; G.coins.push(c); return c; }
function removeCoin(c) { c.dead = true; if (c.mesh) { world.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; } }

// ── 狙って、はなす(引っぱった反対へ飛ぶ)
const aim = { on: false, sx: 0, sy: 0, x: 0, y: 0, pw: 0, dir: null };
function aimVec() {
  const dx = aim.x - aim.sx, dy = aim.y - aim.sy, L = Math.hypot(dx, dy), pw = clamp(L / (innerHeight * 0.26), 0, 1);
  let vx = -dx, vy = dy; const n = Math.hypot(vx, vy) || 1; vx /= n; vy /= n;
  if (vy < 0.25) { vy = 0.25; vx = Math.sign(vx || 1) * Math.sqrt(1 - vy * vy); }
  return { vx, vy, pw, L };
}
function previewPath(vx, vy) {
  let x = 0, y = LY, h = 1 / 60; const out = [];
  for (let i = 0; i < 70 && out.length < G.aimDots.length; i++) {
    vy -= GRAV * h; vx *= 1 - DAMP * h; vy *= 1 - DAMP * h; x += vx * h; y += vy * h;
    if (x < -HW + CR) { x = -HW + CR; vx = Math.abs(vx) * 0.78; } if (x > HW - CR) { x = HW - CR; vx = -Math.abs(vx) * 0.78; }
    if (i % 3 === 2) out.push([x, y]); if (y > H) break;
  }
  return out;
}
R.domElement.addEventListener('pointerdown', (e) => {
  if (!G || G.over || G.cut || G.paused || G.hand <= 0) { if (G && !G.over && G.hand <= 0) { floatText(W3(0, LY + 1, 1), 'コインを集めています…', 'small'); } return; }
  unlockAudio(); aim.on = true; aim.sx = aim.x = e.clientX; aim.sy = aim.y = e.clientY; aim.id = e.pointerId; R.domElement.setPointerCapture(e.pointerId);
});
R.domElement.addEventListener('pointermove', (e) => { if (!aim.on || e.pointerId !== aim.id) return; aim.x = e.clientX; aim.y = e.clientY; const v = aimVec(); if (Math.abs(v.pw - aim.pw) > 0.08) { sfx('aim', v.pw); aim.pw = v.pw; } });
const endAim = (e) => {
  if (!aim.on || e.pointerId !== aim.id) return; aim.on = false; G.aimDots.forEach(d => d.visible = false); G.arrow.visible = false;
  const v = aimVec(); if (v.L < 18 || !G || G.over || G.hand <= 0) return;
  const sp = VMIN + (VMAX - VMIN) * v.pw; launch(v.vx * sp, v.vy * sp, v.pw);
};
R.domElement.addEventListener('pointerup', endAim); R.domElement.addEventListener('pointercancel', (e) => { aim.on = false; if (G) { G.aimDots.forEach(d => d.visible = false); G.arrow.visible = false; } });
function launch(vx, vy, pw) {
  G.hand--; const fire = G.fire > 0; if (fire) G.fire--;
  const c = spawnCoin(0, LY, vx, vy, fire);
  if (G.splitNext) { G.splitNext = 0; splitCoin(c); }
  sfx('flick'); haptic(14); if (mage) mage.play('Interact');
  P.burst(W3(0, LY, 0.2), fire ? 0xff7a3c : 0xffd36e, 18, 4 + pw * 4, { up: 0.3 });
  G.shake = Math.max(G.shake, 0.08 + pw * 0.12);
}
function splitCoin(c) { for (const a of [-0.38, 0.38]) { const cs = Math.cos(a), sn = Math.sin(a); const n = spawnCoin(c.x, c.y, c.vx * cs - c.vy * sn, c.vx * sn + c.vy * cs, c.fire); n.combo = c.combo; } P.burst(W3(c.x, c.y, 0.4), 0xc79bff, 26, 6); }

// ── はじき板
function kick(side) {
  if (!G || G.over || G.cut) return; const k = side < 0 ? G.kl : G.kr; if (k.cd > 0) return;
  k.act = 0.22; k.cd = 0.42; k.id++; sfx('kickair'); haptic(8);
  for (const m of G.padMeshes[side]) { m.material.emissiveIntensity = 3; }
  const b = $(side < 0 ? '#kl' : '#kr'); if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
}

// ── スキル
function useSkill(k) {
  const S = SKILLS[k]; if (!G || G.over || G.cut || G.mana < S.cost) return;
  G.mana -= S.cost; sfx('skill'); haptic(20); flash('rgba(255,230,140,.35)');
  banner(`${img(S.icon, 'bi')}<b>${S.name}!</b><small>${S.text}</small>`, 'me');
  if (k === 'bridge') { G.ef.bridge = 7; for (const h of G.holes) P.burst(h.g.position.clone().setY(0.3), 0xffe28a, 16, 3, { up: 0.8 }); }
  if (k === 'fire') { G.fire += 3; for (const c of G.coins) if (!c.dead && !c.fire) { c.fire = true; world.remove(c.mesh); c.mesh = coinMesh(true); } }
  if (k === 'split') { const live = G.coins.filter(c => !c.dead && !c.fall); if (live.length) live.forEach(splitCoin); else { G.splitNext = 1; floatText(W3(0, LY + 1.5, 1), '次のコインが分身する', 'small'); } }
  if (k === 'time') { G.ef.time = 6; }
  if (k === 'guard') { G.ef.guard = 10; }
  renderCtrl();
}

// ── ボスの技
function bossCast() {
  const st = G.st; let k = pick(st.skills); if (k === G.lastSkill) k = pick(st.skills); G.lastSkill = k;
  if (k === 'shield' && G.ef.shield > 0) k = 'summon';
  G.cut = { t: 1.5, t0: 1.5, k, line: st.lines[k] || '', boss: true }; showCut();
  sfx('boss'); haptic(30);
  if (bossObj.body && bossObj.body.userData.play) bossObj.body.userData.play('Interact', 900);
}
function applyBossSkill(k) {
  const st = G.st;
  if (k === 'pit') { for (let n = 0; n < 2; n++) { let x, y, ok = false; for (let tries = 0; tries < 30 && !ok; tries++) { x = rand(-3.4, 3.4); y = rand(7, 29); ok = G.holes.every(h => Math.hypot(h.x - x, h.y - y) > h.r + 2.2) && G.st.bumpers.every(([bx, by]) => Math.hypot(bx - x, by - y) > 2); } if (ok) { const h = makeHole(x, y, 0.95, { temp: 1 }); h.life = 9; G.holes.push(h); P.burst(W3(x, y, 0.3), 0xff3b5c, 30, 5, { up: 0.9 }); } } sfx('pit'); }
  if (k === 'wind') { G.ef.wind = 4.5; G.windDir = Math.random() < 0.5 ? -1 : 1; sfx('wind'); banner(`魔風: コインが${G.windDir < 0 ? '左' : '右'}へ流される!`, 'bad', 1600); }
  if (k === 'quake') { G.ef.quake = 2; G.quakeT = 0; sfx('quake'); }
  if (k === 'shield') { G.ef.shield = 14; G.shieldHp = 3; sfx('shield'); }
  if (k === 'summon') { for (let i = 0; i < (st.id === 'forest' ? 3 : 4); i++) setTimeout(() => spawnMon(pick(st.mons)), i * 260); }
  if (k === 'gravity') { G.ef.gravity = 5; sfx('boss'); }
}
function spawnMon(type) {
  if (!G || G.over) return; const T = MON[type], x = rand(-1.3, 1.3), y = H - 1.2;
  const g = new THREE.Group(); g.position.copy(W3(x, y)); let parts = {};
  const col = G.st.id === 'maou' ? 0xb04dff : G.st.id === 'crypt' ? 0x58c4b8 : 0x6ee07a;
  if (type === 'slime') { const m = stdMat({ color: col, roughness: 0.2, transparent: true, opacity: 0.92 }); const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), m); b.scale.set(1, 0.72, 1); b.position.y = 0.4; b.castShadow = true; g.add(b); parts.body = b;
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), stdMat({ color: 0xffffff })); e.position.set(s * 0.2, 0.55, 0.42); g.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), stdMat({ color: 0x111111 })); p.position.set(s * 0.2, 0.55, 0.53); g.add(p); } }
  if (type === 'bat') { const m = stdMat({ color: 0x3a2a4a, roughness: 0.5 }); const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), m); b.position.y = 1.0; b.castShadow = true; g.add(b); parts.body = b;
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.75, 0.15, -0.15, 0.65, -0.12, 0.2], 3)); wg.computeVertexNormals();
    parts.wings = [-1, 1].map(s => { const w = new THREE.Mesh(wg, stdMat({ color: 0x4b3560, side: THREE.DoubleSide })); w.position.set(s * 0.18, 1.02, 0); w.scale.x = s; g.add(w); return w; });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3040 })); e.position.set(s * 0.11, 1.07, 0.26); g.add(e); } }
  if (type === 'golem') { const m = stdMat({ color: 0x8a8590, roughness: 0.9, flatShading: true }); const b = box(0.95, 0.8, 0.7, m); b.position.y = 0.75; g.add(b); const hd = box(0.55, 0.45, 0.5, m); hd.position.y = 1.4; g.add(hd); parts.body = b;
    for (const s of [-1, 1]) { const a = box(0.3, 0.7, 0.3, m); a.position.set(s * 0.65, 0.65, 0); g.add(a); const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5cf0ff })); e.position.set(s * 0.13, 1.45, 0.26); g.add(e); } }
  const bar = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.12), new THREE.MeshBasicMaterial({ color: 0x220010, depthTest: false, transparent: true })); const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.08), new THREE.MeshBasicMaterial({ color: 0xff4d5e, depthTest: false, transparent: true })); fg.position.z = 0.001; bar.add(bg, fg); bar.position.y = type === 'bat' ? 1.55 : type === 'golem' ? 1.95 : 1.05; bar.renderOrder = 5; g.add(bar);
  world.add(g); G.mons.push({ id: ++G.mid, type, x, x0: x, y, hp: T.hp, max: T.hp, sp: T.sp * (G.half ? 1.15 : 1), r: T.r, dmg: T.dmg, g, parts, bar, fg, ph: Math.random() * 6, hitCd: 0 });
  P.burst(W3(x, y, 0.5), 0x9a5cff, 14, 3);
}
function hurtMon(m, dmg, c) {
  m.hp -= dmg; m.hitCd = 0.15; m.flash = 0.15; sfx('hit'); floatText(W3(m.x, m.y, 1.4), `${dmg}`, 'dmg');
  P.burst(W3(m.x, m.y, 0.6), 0xffffff, 8, 4);
  if (m.hp <= 0) killMon(m, true);
}
function killMon(m, byCoin) {
  m.dead = true; world.remove(m.g); if (byCoin) { G.kills++; addMana(1); sfx('kill'); P.burst(W3(m.x, m.y, 0.6), m.type === 'golem' ? 0xaab0c0 : m.type === 'bat' ? 0xb07cff : 0x7cf08a, 30, 6, { up: 0.9 }); floatText(W3(m.x, m.y, 1.6), '撃破!', 'kill'); }
}
function addMana(n) { const b = Math.floor(G.mana); G.mana = Math.min(MANA_MAX, G.mana + n); if (Math.floor(G.mana) > b) sfx('mana', Math.floor(G.mana)); }

// ── 物理(1/240秒きざみ)
function physics(h) {
  const ef = G.ef, g = GRAV * (ef.gravity > 0 ? 1.75 : 1);
  for (const c of G.coins) {
    if (c.dead) continue;
    if (c.fall) { c.fall += h * 2.2; if (c.fall >= 1) { removeCoin(c); } continue; }
    c.vy -= g * h; if (ef.wind > 0) c.vx += G.windDir * 8.5 * h;
    c.vx *= 1 - DAMP * h; c.vy *= 1 - DAMP * h; c.x += c.vx * h; c.y += c.vy * h;
    const sp = Math.hypot(c.vx, c.vy);
    // 左右の壁
    for (const s of [-1, 1]) {
      if (s * c.x > HW - CR) { c.x = s * (HW - CR); const vn = s * c.vx; if (vn > 0) { c.vx = -s * vn * 0.8; if (vn > 2.5) bounce(c, vn, W3(c.x + s * CR, c.y, 0.4)); } }
      const k = s < 0 ? G.kl : G.kr;
      if (k.act > 0 && s * c.x > HW - CR - 0.55 && c.kickId[s] !== k.id && PADS.some(([a, b]) => c.y > a - 0.5 && c.y < b + 0.5)) {
        c.kickId[s] = k.id; c.vx = -s * rand(7.5, 9.5); c.vy = 16.5; c.combo++; G.maxCombo = Math.max(G.maxCombo, c.combo);
        sfx('kick'); haptic(18); P.burst(W3(c.x, c.y, 0.4), 0xffd36e, 22, 7, { vx: -s * 4 }); floatText(W3(c.x, c.y, 1), `はじき! ${c.combo}`, 'combo'); G.shake = Math.max(G.shake, 0.15);
      }
    }
    // 上: 門か壁
    if (c.y > H - CR) {
      if (Math.abs(c.x) < GATE - CR * 0.25) {
        if (ef.shield > 0) { c.y = H - CR; c.vy = -Math.abs(c.vy) * 0.7; G.shieldHp--; sfx('crack'); P.burst(W3(c.x, H, 1), 0xb04dff, 24, 6); G.shake = 0.2; floatText(W3(c.x, H, 2), G.shieldHp > 0 ? `結界 のこり${G.shieldHp}` : '結界をやぶった!', 'combo'); if (G.shieldHp <= 0) { ef.shield = 0; flash('rgba(200,120,255,.35)'); } }
        else { goal(c); continue; }
      } else { c.y = H - CR; if (c.vy > 0) { if (c.vy > 2.5) bounce(c, c.vy, W3(c.x, H, 0.4)); c.vy = -c.vy * 0.6; } }
    }
    // 門の柱
    for (const s of [-1, 1]) collideCircle(c, s * GATE, H, 0.12, 0.6, false);
    // 斜めの壁
    for (const r of G.rails) { const vn = collideSeg(c, r.ax, r.ay, r.bx, r.by, 0.16, 0.75); if (vn > 2.5) bounce(c, vn, W3(c.x, c.y, 0.4)); }
    // クリスタル
    for (const b of G.bumpers) { const vn = collideCircle(c, b.x, b.y, b.r, 1.0, true); if (vn !== false && vn > 1) { c.combo++; G.maxCombo = Math.max(G.maxCombo, c.combo); b.hit = 1; sfx('bump', c.combo); addMana(0.25); P.burst(W3(b.x, b.y, 1.1), 0x9be8ff, 18, 6); floatText(W3(b.x, b.y, 2.2), `${c.combo} COMBO`, 'combo'); G.shake = Math.max(G.shake, 0.08); } }
    // 魔物
    for (const m of G.mons) {
      if (m.dead) continue; const dx = c.x - m.x, dy = c.y - m.y, d = Math.hypot(dx, dy), rr = c.r + m.r;
      if (d < rr && d > 0) {
        const nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny;
        if (c.fire) { if (m.hitCd <= 0) hurtMon(m, 4, c); continue; }
        c.x = m.x + nx * rr; c.y = m.y + ny * rr;
        if (vn < 0) { c.vx -= 1.8 * vn * nx; c.vy -= 1.8 * vn * ny; if (m.hitCd <= 0) hurtMon(m, -vn > 12 ? 3 : -vn > 6 ? 2 : 1, c); }
      }
    }
    // 穴: ふちで吸いこまれ、遅いと落ちる
    if (!(ef.bridge > 0)) for (const ho of G.holes) {
      if (ho.grow < 0.6) continue; const dx = ho.x - c.x, dy = ho.y - c.y, d = Math.hypot(dx, dy), r = ho.r * ho.grow;
      if (d < r + CR * 0.6 && d > 0.01) { const pull = 4 * (1 - d / (r + CR)); c.vx += dx / d * pull * h * 6; c.vy += dy / d * pull * h * 6; }
      if (d < r - CR * 0.5 && sp < SKIP) { c.fall = 0.001; c.fx = ho.x; c.fy = ho.y; coinFell(c, ho); break; }
    }
    if (c.fall) continue;
    // 手前に戻ってきた
    if (c.y < -0.2) { removeCoin(c); G.hand = Math.min(HAND_MAX, G.hand + 1); sfx('return'); P.burst(W3(0, LY, 0.3), 0xffd36e, 10, 3); continue; }
    if (sp < 0.5) { c.slowT += h; if (c.slowT > 1.6) { removeCoin(c); G.hand = Math.min(HAND_MAX, G.hand + 1); P.burst(W3(c.x, c.y, 0.4), 0xffffff, 14, 3); sfx('return'); } } else c.slowT = 0;
  }
  // コインどうし
  const L = G.coins.filter(c => !c.dead && !c.fall);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= CR * 2 || d === 0) continue;
    const nx = dx / d, ny = dy / d, ov = CR * 2 - d; a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { const imp = -rv * 0.95; a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny; if (imp > 2) sfx('coin2'); }
  }
}
function bounce(c, vn, at) { c.combo++; G.maxCombo = Math.max(G.maxCombo, c.combo); addMana(0.1); sfx('wall', c.combo); P.burst(at, 0xfff0b0, 8, 3 + vn * 0.2); if (c.combo >= 2) floatText(at.clone().setY(1.2), `${c.combo}`, 'cnum'); }
function collideSeg(c, ax, ay, bx, by, th, e) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; let t = ((c.x - ax) * dx + (c.y - ay) * dy) / L2; t = clamp(t, 0, 1);
  const px = ax + dx * t, py = ay + dy * t; let nx = c.x - px, ny = c.y - py; const d = Math.hypot(nx, ny), rr = c.r + th;
  if (d >= rr || d === 0) return 0; nx /= d; ny /= d; c.x = px + nx * rr; c.y = py + ny * rr;
  const vn = c.vx * nx + c.vy * ny; if (vn < 0) { c.vx -= (1 + e) * vn * nx; c.vy -= (1 + e) * vn * ny; return -vn; } return 0;
}
function collideCircle(c, x, y, r, e, kickOut) {
  const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy), rr = c.r + r; if (d >= rr || d === 0) return false;
  const nx = dx / d, ny = dy / d; c.x = x + nx * rr; c.y = y + ny * rr; const vn = c.vx * nx + c.vy * ny;
  if (vn < 0) { c.vx -= (1 + e) * vn * nx; c.vy -= (1 + e) * vn * ny; if (kickOut) { c.vx += nx * 3.5; c.vy += ny * 3.5; } return -vn; } return false;
}
function coinFell(c, ho) {
  G.fell++; sfx('fall'); haptic(30); const heal = 1; G.boss = Math.min(G.bossMax, G.boss + heal);
  P.burst(W3(ho.x, ho.y, 0.2), 0x9a5cff, 24, 3, { up: 1, grav: -2 }); floatText(W3(ho.x, ho.y, 1.2), `奈落へ… ボス回復 +${heal}`, 'bad');
  if (bossObj) bossObj.heal = 0.6;
}
function goal(c) {
  const fire = c.fire, dmg = (3 + c.combo) * (fire ? 2 : 1); removeCoin(c);
  G.goals++; G.hand = Math.min(HAND_MAX, G.hand + 1); addMana(1.5);
  G.flyers.push({ x: c.x, t: 0, dmg, fire, combo: c.combo });
  sfx('flick'); P.burst(W3(c.x, H, 1), 0xffe28a, 30, 7, { up: 0.9 }); G.slow = 0.35;
}
function bossHit(f) {
  G.boss = Math.max(0, G.boss - f.dmg); sfx('goal'); haptic(40); G.shake = Math.max(G.shake, 0.4 + Math.min(0.5, f.dmg * 0.02)); flash(f.fire ? 'rgba(255,120,60,.4)' : 'rgba(255,240,180,.45)');
  const bp = bossObj.g.position.clone(); bp.y += 2.5;
  P.burst(bp, f.fire ? 0xff6a2c : 0xffd36e, 60, 11, { up: 0.7, spread: 1.5 }); P.burst(bp, 0xffffff, 26, 7);
  floatText(bp, `${f.dmg}`, 'big' + (f.combo >= 5 ? ' crit' : ''));
  if (f.combo >= 3) banner(`<b>${f.combo} COMBO!</b><small>壁で跳ねるほど強くなる</small>`, 'combo', 1000);
  bossObj.flash = 0.3; if (bossObj.body && bossObj.body.userData.play) bossObj.body.userData.play('Hit_A', 600);
  if (mage) mage.play('Cheer');
  if (!G.half && G.boss <= G.bossMax / 2 && G.boss > 0) { G.half = true; bgm.intense = 1; setTimeout(() => { if (!G.over) { G.cut = { t: 1.5, t0: 1.5, k: 'half', line: G.st.lines.half, boss: true }; showCut(); sfx('boss'); } }, 700); }
  if (G.boss <= 0) win();
}

// ── 毎フレーム
let last = performance.now(), clock = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
  for (const m of mixers) m.update(dt);
  P.update(dt);
  if (G && world) step(dt);
  // カメラ
  const pos = camBase.pos.clone(), look = camBase.look.clone();
  if (G && G.cut && G.cut.boss && bossObj) { const k = clamp(Math.min((G.cut.t0 - G.cut.t) * 4, G.cut.t * 4), 0, 1); const bp = bossObj.g.position; pos.lerp(new THREE.Vector3(bp.x + 2, bp.y + 6, bp.z + 14), k); look.lerp(new THREE.Vector3(bp.x, bp.y + 2.2, bp.z), k); }
  if (G && G.shake > 0) { pos.x += (Math.random() - 0.5) * G.shake; pos.y += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt * 1.6); }
  cam.position.copy(pos); cam.lookAt(look);
  if (G && G.clouds) for (const o of G.clouds) { o.position.x += o.userData.cloud * dt; if (o.position.x > 40) o.position.x = -40; }
  R.render(scene, cam);
}
function step(dt) {
  const ef = G.ef;
  // 演出の一時停止(ボスの技の前ぶれ)
  if (G.cut) { G.cut.t -= dt; if (G.cut.t <= 0) { const k = G.cut.k; G.cut = null; hideCut(); if (BOSS_SKILL[k]) applyBossSkill(k); if (k === 'half') { for (let i = 0; i < 4; i++) setTimeout(() => spawnMon(pick(G.st.mons)), i * 300); } } animWorld(dt); return; }
  if (G.over || G.paused) { animWorld(dt); return; }
  const ts = G.slow > 0 ? 0.35 : 1; G.slow -= dt; const d = dt * ts; G.t += d;
  for (const k in ef) if (ef[k] > 0) ef[k] -= d;
  for (const k of [G.kl, G.kr]) { k.act -= d; k.cd -= d; }
  // コインの補充
  if (G.hand < HAND_MAX) { G.regen += d; if (G.regen >= REGEN) { G.regen = 0; G.hand++; sfx('return'); } } else G.regen = 0;
  // 穴の動き(魔王城)・一時的な穴
  for (const h of G.holes) { if (h.mx) { h.x = h.x0 + Math.sin(G.t * h.sp + h.ph) * h.mx; } if (h.grow < 1) h.grow = Math.min(1, h.grow + d * 1.6); if (h.temp) { h.life -= d; if (h.life <= 0) { world.remove(h.g); h.dead = true; } } }
  G.holes = G.holes.filter(h => !h.dead);
  // 地揺れ
  if (ef.quake > 0) { G.quakeT -= d; if (G.quakeT <= 0) { G.quakeT = 0.45; G.shake = 0.5; for (const c of G.coins) if (!c.dead && !c.fall) { c.vx += rand(-6, 6); c.vy += rand(-3, 4); } } }
  // 物理
  const n = Math.ceil(d / (1 / 240)), h = d / n; for (let i = 0; i < n; i++) physics(h);
  G.coins = G.coins.filter(c => !c.dead);
  // 門へ飛びこんだコインがボスへ
  for (const f of G.flyers) { f.t += dt * 2.6; if (f.t >= 1 && !f.done) { f.done = true; if (f.mesh) world.remove(f.mesh); if (bossObj) bossHit(f); } }
  G.flyers = G.flyers.filter(f => !f.done);
  // 魔物
  const frozen = ef.time > 0;
  for (const m of G.mons) {
    if (m.dead) continue; m.hitCd -= d; m.flash = (m.flash || 0) - d;
    if (!frozen) { m.y -= m.sp * d; if (m.type === 'bat') m.x = clamp(m.x0 + Math.sin(G.t * 2.2 + m.ph) * 1.6, -HW + 0.6, HW - 0.6); }
    if (m.y < 0.9) {
      if (ef.guard > 0) { killMon(m, false); P.burst(W3(m.x, 0.8, 0.6), 0x7cc7ff, 24, 5); sfx('crack'); continue; }
      killMon(m, false); G.castle = Math.max(0, G.castle - m.dmg); sfx('hurt'); haptic(60); G.shake = 0.6; flash('rgba(255,40,60,.4)', 360);
      floatText(W3(m.x, 1, 1), `城に −${m.dmg}`, 'bad'); P.burst(W3(m.x, 0.6, 0.6), 0xff4d5e, 30, 6); if (mage) mage.play('Hit_A');
      if (G.castle <= 0) lose();
    }
  }
  G.mons = G.mons.filter(m => !m.dead);
  // 魔物が来る・ボスの技
  if (!frozen) {
    G.spawnT -= d; if (G.spawnT <= 0) { G.spawnT = G.st.spawn * (G.half ? 0.78 : 1) * rand(0.8, 1.2); spawnMon(pick(G.st.mons)); }
    G.bossT -= d; if (G.bossT <= 0) { G.bossT = G.st.every * (G.half ? 0.75 : 1) * rand(0.85, 1.15); bossCast(); }
  }
  animWorld(dt); renderHud();
}
function animWorld(dt) {
  const ef = G.ef;
  for (const c of G.coins) {
    if (!c.mesh) continue;
    if (c.fall) { const k = c.fall; c.mesh.position.set(c.x + (c.fx - c.x) * k, 0.08 - k * 1.2, -(c.y + (c.fy - c.y) * k)); c.mesh.scale.setScalar(1 - k * 0.7); c.mesh.rotation.x += dt * 12; continue; }
    c.mesh.position.set(c.x, 0.1, -c.y); c.spin += Math.hypot(c.vx, c.vy) * dt * 1.4; c.mesh.rotation.set(0, c.spin, 0);
    c.trail -= dt; if (c.trail <= 0) { c.trail = 0.03; P.burst(W3(c.x, c.y, 0.15), c.fire ? 0xff6a2c : c.combo >= 3 ? 0xffb0ff : 0xffd36e, c.fire ? 3 : 1, 0.6, { up: 0.5, life: 0.4, grav: 0 }); }
  }
  if (bossObj) for (const f of G.flyers) { if (!f.mesh) { f.mesh = coinMesh(f.fire); } const k = Math.min(1, f.t), bp = bossObj.g.position; f.mesh.position.set(f.x + (bp.x - f.x) * k, 0.2 + Math.sin(k * Math.PI) * 3.5 + k * (bp.y + 2.4), -H + (bp.z + H) * k); f.mesh.rotation.x += dt * 20; f.mesh.scale.setScalar(1 + k * 0.6); P.burst(f.mesh.position, 0xffe28a, 2, 1, { life: 0.3, grav: 0 }); }
  for (const b of G.bumpers) { b.hit = Math.max(0, b.hit - dt * 4); b.cr.rotation.y += dt * (1 + b.hit * 10); b.cr.scale.set(1 + b.hit * 0.3, 1.7 + b.hit * 0.5, 1 + b.hit * 0.3); b.cm.emissiveIntensity = 0.7 + b.hit * 3; }
  for (const h of G.holes) { h.g.position.set(h.x, 0.015, -h.y); h.g.scale.setScalar(h.grow); h.sw.rotation.z -= dt * 2.5; }
  mats.bridge && (mats.bridge.opacity = ef.bridge > 0 ? 0.55 + Math.sin(clock * 8) * 0.15 : 0);
  for (const s of ['-1', '1']) for (const m of G.padMeshes[s]) m.material.emissiveIntensity = Math.max(0.35 + Math.sin(clock * 3) * 0.1, m.material.emissiveIntensity - dt * 9);
  G.launchMesh.rotation.z += dt * 0.8; G.launchMesh.material.opacity = G.hand > 0 ? 0.9 : 0.3;
  if (!G.readyCoin && G.coins !== undefined) { G.readyCoin = coinMesh(false); }
  if (G.readyCoin) { const rc = G.readyCoin, fire = G.fire > 0; if (rc.userData.fire !== fire) { world.remove(rc); G.readyCoin = coinMesh(fire); G.readyCoin.userData.fire = fire; }
    const r = G.readyCoin; r.visible = G.hand > 0 && !G.over; const pull = aim.on ? aimVec() : null; r.position.copy(W3(pull ? -pull.vx * pull.pw * 0.5 : 0, LY - (pull ? pull.vy * pull.pw * 0.5 : 0), 0.12 + Math.sin(clock * 3) * 0.05)); r.rotation.y += dt * 1.5; }
  G.shieldMesh.material.opacity = ef.shield > 0 ? 0.45 + Math.sin(clock * 6) * 0.15 : 0; G.portal.material.opacity = 0.16 + Math.sin(clock * 2) * 0.06;
  G.guardMesh.material.opacity = ef.guard > 0 ? 0.35 + Math.sin(clock * 7) * 0.1 : 0;
  if (ef.wind > 0 && Math.random() < 0.5) P.burst(W3(G.windDir < 0 ? HW : -HW, rand(2, H), 0.4), 0xddeeff, 1, 0, { vx: G.windDir * 14, life: 0.7, grav: 0, up: 0 });
  for (const m of G.mons) { if (m.dead) continue; m.g.position.set(m.x, 0, -m.y); const t = clock * 5 + m.ph;
    if (m.type === 'slime') { m.g.position.y = Math.abs(Math.sin(t)) * 0.25; m.parts.body.scale.set(1 + Math.sin(t * 2) * 0.08, 0.72 - Math.sin(t * 2) * 0.06, 1); }
    if (m.type === 'bat') { m.parts.wings.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * Math.sin(t * 3) * 0.7); m.g.position.y = Math.sin(t) * 0.15; }
    if (m.type === 'golem') m.g.rotation.z = Math.sin(t * 0.8) * 0.06;
    m.fg.scale.x = Math.max(0.001, m.hp / m.max); m.fg.position.x = -0.43 * (1 - m.hp / m.max); m.bar.quaternion.copy(cam.quaternion);
    m.g.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(m.flash > 0 ? 0xffffff : 0x000000); });
    if (ef.time > 0) m.g.rotation.y = 0; }
  if (bossObj) { const t = clock; if (bossObj.anim) bossObj.anim(t); bossObj.aura.rotation.z += dt * 0.6; bossObj.flash = Math.max(0, bossObj.flash - dt); bossObj.heal = Math.max(0, (bossObj.heal || 0) - dt);
    for (const m of bossObj.mats) { if (!m.userData.e0) m.userData.e0 = { c: m.emissive.getHex(), i: m.emissiveIntensity }; if (bossObj.flash > 0) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 1.2; } else if (bossObj.heal > 0) { m.emissive.setHex(0x9a5cff); m.emissiveIntensity = 1; } else { m.emissive.setHex(m.userData.e0.c); m.emissiveIntensity = m.userData.e0.i * (G.half ? 1.6 + Math.sin(t * 6) * 0.4 : 1); } } }
  // 狙い
  if (aim.on && G.aimDots) { const v = aimVec(), sp = VMIN + (VMAX - VMIN) * v.pw, pts = v.L > 18 ? previewPath(v.vx * sp, v.vy * sp) : [];
    G.aimDots.forEach((d, i) => { const p = pts[i]; d.visible = !!p && i < 6 + v.pw * 10; if (p) { d.position.copy(W3(p[0], p[1], 0.18)); d.scale.setScalar(1 - i * 0.03); } });
    G.arrow.visible = v.L > 18; G.arrow.position.copy(W3(v.vx * (1.4 + v.pw), LY + v.vy * (1.4 + v.pw), 0.25)); G.arrow.rotation.set(-Math.PI / 2, 0, Math.atan2(v.vy, v.vx) - Math.PI / 2); G.arrow.material.color.setHSL(0.13 - v.pw * 0.13, 1, 0.6); G.arrow.scale.setScalar(0.8 + v.pw * 0.6); }
}

// ── 画面(HUD・操作)
let hudKey = '';
function renderHud() {
  const rg = $('#ctrl .regen i'); if (rg) rg.style.width = (G.hand >= HAND_MAX ? 100 : G.regen / REGEN * 100) + '%';
  const k = [Math.ceil(G.boss), G.castle, G.hand, Math.floor(G.mana * 4), G.fire, ...Object.values(G.ef).map(v => v > 0 ? Math.ceil(v) : 0), G.shieldHp, G.splitNext, G.half].join(',');
  if (k === hudKey) return; hudKey = k;
  const st = G.st, bp = G.boss / G.bossMax;
  $('#hud').innerHTML = `<div class="toprow"><div class="bossbar ${G.half ? 'rage' : ''}"><div class="bn"><small>${st.sub}</small>${st.boss.name}</div><div class="hp"><i style="width:${bp * 100}%"></i><b>${Math.ceil(G.boss)} / ${G.bossMax}</b></div></div>
    <button class="pause" data-a="pause"><i></i><i></i></button></div>
    <div class="efs">${Object.entries(G.ef).filter(([, v]) => v > 0).map(([k, v]) => { const m = { bridge: ['o_star', '光の橋', 'me'], time: ['o_hourglass', '時の砂', 'me'], guard: ['o_knight', '守りの壁', 'me'], wind: ['o_wave', '魔風', 'bad'], quake: ['o_rock', '地揺れ', 'bad'], shield: ['o_crystal', `結界 ${G.shieldHp}`, 'bad'], gravity: ['o_magnet', '重力', 'bad'] }[k]; return m ? `<span class="ef ${m[2]}">${img(m[0])}${m[1]} ${Math.ceil(v)}</span>` : ''; }).join('')}${G.fire ? `<span class="ef me">${img('o_fire')}炎 ×${G.fire}</span>` : ''}${G.splitNext ? `<span class="ef me">${img('o_gem')}次は分身</span>` : ''}</div>`;
  renderCtrl();
}
let ctrlKey = '';
function renderCtrl() {
  if (!G) { $('#ctrl').innerHTML = ''; ctrlKey = ''; return; }
  const k = [G.hand, Math.floor(G.mana * 4), G.over ? 1 : 0, G.castle].join(','); if (k === ctrlKey) return; ctrlKey = k;
  if (G.over) { $('#ctrl').innerHTML = ''; return; }
  $('#ctrl').innerHTML = `<div class="skills">${Object.entries(SKILLS).map(([k, S]) => `<button class="sk ${G.mana >= S.cost ? 'ok' : ''}" data-a="skill" data-k="${k}">${img(S.icon)}<b>${S.name}</b><small>${img('o_crystal', 'mc')}${S.cost}</small></button>`).join('')}</div>
    <div class="bot"><button id="kl" class="kick l" data-a="kick" data-s="-1"><svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><b>はじく</b></button>
    <div class="mid"><div class="hand">${Array.from({ length: HAND_MAX }, (_, i) => `<span class="${i < G.hand ? 'on' : ''}">${img('coin')}</span>`).join('')}</div>
      <div class="regen"><i style="width:${G.hand >= HAND_MAX ? 100 : G.regen / REGEN * 100}%"></i></div>
      <div class="castle">${img('o_house')}<div class="hearts">${Array.from({ length: G.castleMax }, (_, i) => `<i class="${i < G.castle ? 'on' : ''}"></i>`).join('')}</div></div>
      <div class="mana">${img('o_crystal')}<div class="mb">${Array.from({ length: MANA_MAX }, (_, i) => `<i class="${i < Math.floor(G.mana) ? 'on' : ''}"></i>`).join('')}</div></div></div>
    <button id="kr" class="kick r" data-a="kick" data-s="1"><b>はじく</b><svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;
}
function showCut() {
  const c = G.cut, st = G.st, S = BOSS_SKILL[c.k];
  $('#cut').innerHTML = `<div class="cutin ${c.boss ? 'boss' : ''}"><div class="band"></div><div class="ct"><small>${st.boss.name}</small><b>「${c.line}」</b>${S ? `<div class="csk">${img(S.icon)}<span>${S.name}</span><em>${S.text}</em></div>` : ''}</div></div>`;
}
function hideCut() { const el = $('#cut .cutin'); if (el) { el.classList.add('out'); setTimeout(() => { if (!G || !G.cut) $('#cut').innerHTML = ''; }, 260); } }

// ── 勝ち・負け
function win() {
  if (G.over) return; G.over = 'win'; G.paused = false;
  const stars = G.castle >= 8 ? 3 : G.castle >= 4 ? 2 : 1; save.stars[G.st.id] = Math.max(save.stars[G.st.id] || 0, stars); storeSave();
  const bp = bossObj.g.position.clone(); bp.y += 2.5;
  for (let i = 0; i < 6; i++) setTimeout(() => { P.burst(bp.clone().add(new THREE.Vector3(rand(-2, 2), rand(0, 3), rand(-1, 1))), pick([0xffd36e, 0xff6a2c, 0xffffff, 0xc79bff]), 50, 10, { up: 0.8 }); G.shake = 0.6; sfx('goal'); }, i * 220);
  setTimeout(() => { if (bossObj.body) bossObj.body.visible = false; P.burst(bp, 0xffffff, 120, 14, { up: 0.6, spread: 2 }); flash('rgba(255,255,255,.8)', 500); }, 1400);
  banner(`<b>「${G.st.lines.win}」</b>`, 'boss', 1500);
  setTimeout(() => { sfx('win'); showResult(true, stars); }, 2600);
  renderCtrl();
}
function lose() { if (G.over) return; G.over = 'lose'; sfx('lose'); flash('rgba(40,0,20,.6)', 800); renderCtrl(); setTimeout(() => showResult(false, 0), 1400); }
function showResult(won, stars) {
  bgm.intense = 0;
  const next = won && G.si + 1 < STAGES.length;
  $('#screen').innerHTML = `<div class="result ${won ? 'win' : 'lose'}"><div class="rcard">
    <div class="rt">${won ? 'VICTORY' : 'DEFEAT'}</div><div class="rs">${won ? `${G.st.boss.name}をたおした!` : '城が落とされた…'}</div>
    ${won ? `<div class="stars">${[0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.25}s"></i>`).join('')}</div><div class="rnote">星は城の守り: 残り${G.castle}/${G.castleMax}</div>` : ''}
    <div class="stats"><div><b>${G.goals}</b><small>門に入れた</small></div><div><b>${G.maxCombo}</b><small>最大コンボ</small></div><div><b>${G.kills}</b><small>魔物をたおした</small></div><div><b>${G.fell}</b><small>穴に落ちた</small></div></div>
    <div class="rbtns">${next ? `<button class="btn go" data-a="start" data-i="${G.si + 1}">次のステージへ</button>` : ''}<button class="btn ${next ? '' : 'go'}" data-a="start" data-i="${G.si}">もう一度</button><button class="btn" data-a="title">タイトルへ</button></div></div></div>`;
}

// ── タイトル・あそびかた
const HOW = [
  { t: '引っぱって、はなす', b: '画面のどこでも、指を<b>下に引いて離す</b>と、ルーンコインが反対側へ飛ぶ。長く引くほど強い。', ic: 'coin' },
  { t: '門に入れてボスを攻撃', b: 'いちばん奥の<b>光る門</b>にコインが入ると、ボスにダメージ。左右の壁やクリスタルで<b>跳ねるたびにコンボ+1</b>、ダメージが上がる。', ic: 'o_star' },
  { t: '奈落の穴に気をつけて', b: '遅いコインは穴に吸いこまれる。落ちると<b>ボスが回復</b>。勢いがあれば小さい穴は飛び越えられる。', ic: 'o_ruin' },
  { t: '左右の「はじく」で打ち返す', b: '壁の<b>金の板</b>にコインが来たとき、下の<b>はじく</b>ボタンを押すと、上へ打ち返せる。タイミングが命。', ic: 'o_bolt' },
  { t: '城を守り、スキルで逆転', b: '魔物が下の城へ歩いてくる。コインを当てて倒そう。倒すと<b>マナ</b>がたまり、スキルが使える。ボスも技で邪魔してくる。', ic: 'o_crystal' },
];
function showTitle() {
  G = null; hudKey = ''; $('#hud').innerHTML = ''; renderCtrl(); $('#cut').innerHTML = ''; bgm.play('title'); bgm.intense = 0;
  const unlocked = (i) => i === 0 || (save.stars[STAGES[i - 1].id] || 0) > 0;
  $('#screen').innerHTML = `<div class="title"><div class="logo"><small>ファンタジー はじきゲーム</small><b>ルーンはじき</b><span>魔王城への道</span></div>
    <div class="stages">${STAGES.map((s, i) => `<button class="stg s-${s.id} ${unlocked(i) ? '' : 'lock'}" data-a="start" data-i="${i}" ${unlocked(i) ? '' : 'disabled'}><small>${s.sub}</small><b>${s.name}</b><span>ボス: ${s.boss.name}</span><div class="stars sm">${[0, 1, 2].map(k => `<i class="${k < (save.stars[s.id] || 0) ? 'on' : ''}"></i>`).join('')}</div>${unlocked(i) ? '' : '<em>前のステージをクリアで解放</em>'}</button>`).join('')}</div>
    <div class="tbtns"><button class="btn" data-a="how">あそびかた</button><button class="btn" data-a="snd">${audioPref().bgm ? '音楽 ON' : '音楽 OFF'}</button></div>
    <a class="back" href="../">商会バトルへ</a></div>`;
  titleBg();
}
async function titleBg() { const st = STAGES[0]; if (!world || G?.st?.id !== st.id) { G = newGame(0); await buildWorld(st); G.over = 'title'; } }
function showHow(i = 0, then) {
  const H2 = HOW[i];
  $('#screen').insertAdjacentHTML('beforeend', `<div class="how" id="how"><div class="hcard"><div class="hn">${i + 1} / ${HOW.length}</div>${img(H2.ic, 'hic')}<b>${H2.t}</b><p>${H2.b}</p>
    <div class="hbtns">${i ? `<button class="btn" data-a="howgo" data-i="${i - 1}">もどる</button>` : ''}<button class="btn go" data-a="${i < HOW.length - 1 ? 'howgo' : 'howend'}" data-i="${i + 1}">${i < HOW.length - 1 ? 'つぎへ' : 'はじめる'}</button></div></div></div>`);
  showHow.then = then || showHow.then;
}
async function start(i) {
  unlockAudio(); $('#screen').innerHTML = ''; const st = STAGES[i];
  $('#loading').classList.add('on');
  G = newGame(i); await buildWorld(st); $('#loading').classList.remove('on');
  bgm.play(st.bgm); hudKey = ''; ctrlKey = ''; renderHud();
  G.cut = { t: 2, t0: 2, k: 'intro', line: st.lines.intro, boss: true }; showCut(); sfx('boss');
  banner(`<small>${st.sub}</small><b>${st.name}</b>`, 'stage', 1800);
}

// ── ボタン
const ACT = {
  start: (d) => start(+d.i), title: () => showTitle(),
  how: () => showHow(0), howgo: (d) => { $('#how')?.remove(); showHow(+d.i); }, howend: () => { $('#how')?.remove(); try { localStorage.setItem('rune-how', '1'); } catch (e) { } if (showHow.pending != null) { const i = showHow.pending; showHow.pending = null; start(i); } },
  snd: () => { setAudioPref('bgm', !audioPref().bgm); unlockAudio(); showTitle(); },
  skill: (d) => useSkill(d.k), kick: (d) => kick(+d.s),
  pause: () => { if (!G || G.over) return; G.paused = true; $('#screen').innerHTML = `<div class="result"><div class="rcard"><div class="rt sm">一時停止</div><div class="rbtns"><button class="btn go" data-a="resume">つづける</button><button class="btn" data-a="how">あそびかた</button><button class="btn" data-a="start" data-i="${G.si}">やりなおす</button><button class="btn" data-a="title">タイトルへ</button></div></div></div>`; },
  resume: () => { $('#screen').innerHTML = ''; G.paused = false; last = performance.now(); },
};
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
  if (a === 'kick' || a === 'skill') { e.preventDefault(); unlockAudio(); ACT[a](b.dataset); return; }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a; if (a === 'kick' || a === 'skill') return;
  unlockAudio(); sfx('tap');
  if (a === 'start') { let seen = false; try { seen = localStorage.getItem('rune-how') === '1'; } catch (e) { } if (!seen) { showHow.pending = +b.dataset.i; showHow(0); return; } }
  if (ACT[a]) ACT[a](b.dataset);
});
// キーボード(パソコン): A/← と D/→ ではじく
addEventListener('keydown', (e) => { if (e.repeat) return; if (e.key === 'a' || e.key === 'ArrowLeft') kick(-1); if (e.key === 'd' || e.key === 'ArrowRight') kick(1); });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ── はじまり
(async () => {
  requestAnimationFrame(frame);
  await titleBg(); $('#loading').classList.remove('on');
  showTitle();
  window.__rune = { get G() { return G; }, start, kick, useSkill, launch, STAGES, spawnMon, bossCast, tick: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) step(dt); } };
})();
