// ルーンはじき: 駄菓子屋の「十円ゲーム」をファンタジーに。上から入れたルーンコインがジグザグのレールを転がり落ちる。
// レールの穴に落ちないよう、左右のレバーではね上げて飛び越え、いちばん下の魔法砲まで届けるとボスを撃つ。魔物は同じ道を城へ下りてくる
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { unlockAudio, sfx, bgm, haptic, audioPref, setAudioPref } from './audio.js';

const $ = (s) => document.querySelector(s);
const ICON = (k) => `../assets/icons/${k}.png`;
const img = (k, c = '') => `<img class="ic ${c}" src="${ICON(k)}" alt="" draggable="false">`;
const HW = 6.2, TOP = 20, CR = 0.45, NR = 5;                  // 盤の半幅・高さ・コインの半径・レールの段数
const GRAV = 15, HOP = 7.2, GOAL_W = 1.0;                    // 重力・はね上げの強さ・下の砲台の口の半幅
const HAND_MAX = 5, REGEN = 2.6, MANA_MAX = 10, MAX_ON = 3;  // 手持ち・補充の間隔・マナ・同時に転がせる数
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ── レール: 上から順に左→右、右→左と折り返す。低い端は壁との間があいていて、そこから下の段へ落ちる
const RAILS = Array.from({ length: NR }, (_, i) => {
  const d = i % 2 ? -1 : 1, yH = 17.6 - i * 3.6, yL = yH - 1.0, xh = -d * HW, xl = d * (HW - 1.15);
  return { i, d, xh, yH, xl, yL };
});
const railY = (r, x) => r.yH + (r.yL - r.yH) * (x - r.xh) / (r.xl - r.xh);
const FLOOR = [{ ax: -HW, ay: 1.5, bx: -GOAL_W, by: 0.45 }, { ax: HW, ay: 1.5, bx: GOAL_W, by: 0.45 }];

// ── ステージ(穴は [段, 高い端からの位置0〜1, 幅, 動く幅, 速さ])
export const STAGES = [
  { id: 'forest', name: 'スライム王の森', sub: 'STAGE 1', boss: { name: 'スライム王', kind: 'slime', hp: 30 }, bgm: 'forest',
    sky: ['#7ec8f0', '#e6f6ff'], paint: ['#bfe6ff', '#8fd18a', '#4f9a52'], frame: 0x8a5a32, rune: '#ffd36e',
    gaps: [[0, 0.55, 1.0], [1, 0.35, 1.0], [2, 0.62, 1.05], [3, 0.4, 1.05], [4, 0.5, 1.0]],
    mons: ['slime', 'slime', 'slime', 'bat'], spawn: 8, skills: ['pit', 'wind', 'summon'], every: 12,
    lines: { intro: 'ぷるぷる…ここは通さないぞ!', half: 'ぬぬ…家来たち、かかれ!', win: 'ぷしゅう…', pit: '穴よ開け〜!', wind: 'ぷうううっ!', summon: 'みんな出ておいで!' } },
  { id: 'crypt', name: '黒騎士の墓所', sub: 'STAGE 2', boss: { name: '黒騎士ヴァルグ', kind: 'knight', hp: 45 }, bgm: 'crypt',
    sky: ['#3b2f5e', '#e8907a'], paint: ['#8a7ab8', '#5a5a7a', '#3a3a52'], frame: 0x3e3a4c, rune: '#a98bff',
    gaps: [[0, 0.4, 1.05], [0, 0.78, 1.0], [1, 0.3, 1.05], [1, 0.7, 1.05], [2, 0.5, 1.1], [3, 0.3, 1.05], [3, 0.72, 1.05], [4, 0.45, 1.1]],
    mons: ['slime', 'bat', 'bat', 'slime', 'golem'], spawn: 7, skills: ['pit', 'wind', 'quake', 'shield', 'summon'], every: 10,
    lines: { intro: '我が剣の前にひれ伏せ', half: 'なかなかやるな…本気を出そう', win: '見事だ…', pit: '大地よ、裂けよ', wind: '黒き風よ', quake: '大地よ、揺れよ!', shield: '闇の結界!', summon: '亡者どもよ、来い' } },
  { id: 'maou', name: '魔王城', sub: 'STAGE 3', boss: { name: '魔王ゴルザーク', kind: 'maou', hp: 60 }, bgm: 'maou',
    sky: ['#1a0a1e', '#a4243b'], paint: ['#5a1a2a', '#3a1420', '#22101a'], frame: 0x2a1a22, rune: '#ff5b6e',
    gaps: [[0, 0.5, 1.05, 0.25, 0.8], [1, 0.32, 1.0], [1, 0.72, 1.05, 0.12, 1.3], [2, 0.5, 1.1, 0.3, 0.6], [3, 0.35, 1.05], [3, 0.75, 1.0, 0.1, 1.1], [4, 0.5, 1.1, 0.28, 0.9]],
    mons: ['slime', 'bat', 'golem', 'bat', 'slime'], spawn: 6, skills: ['pit', 'wind', 'quake', 'shield', 'summon', 'gravity'], every: 8.6,
    lines: { intro: 'よくぞ来た。だがここが墓場だ', half: 'ふはは、遊びは終わりだ!', win: 'ば、ばかな…', pit: '奈落へ落ちよ!', wind: '魔風よ吹き荒れろ', quake: '城よ、震えよ!', shield: '貴様の攻撃など届かぬ', summon: 'しもべども、行け!', gravity: '重力の呪いを受けよ!' } },
];
const BOSS_SKILL = {
  pit: { name: '奈落の口', icon: 'o_ruin', text: 'レールに新しい穴が開く' },
  wind: { name: '魔風', icon: 'o_wave', text: 'コインが横に押される' },
  quake: { name: '地揺れ', icon: 'o_rock', text: 'コインがはねて穴に落ちやすくなる' },
  shield: { name: '闇の結界', icon: 'o_crystal', text: '砲台がふさがる(3回当てて破る)' },
  summon: { name: '魔物召喚', icon: 'o_rogue', text: '魔物がまとめて下りてくる' },
  gravity: { name: '重力の呪い', icon: 'o_magnet', text: 'はね上げが低くなる' },
};
const SKILLS = {
  bridge: { name: '光の橋', icon: 'o_star', cost: 4, text: '7秒間 穴に橋がかかる' },
  fire: { name: '炎のコイン', icon: 'o_fire', cost: 3, text: '次の3枚が炎に。魔物をつらぬき、ダメージ2倍' },
  split: { name: '分身', icon: 'o_gem', cost: 5, text: '転がっているコインが3つに分かれる' },
  time: { name: '時の砂', icon: 'o_hourglass', cost: 4, text: '6秒間 魔物とボスが止まる' },
  guard: { name: '守りの壁', icon: 'o_knight', cost: 3, text: '10秒間 城に来た魔物を消す' },
};
const MON = {
  slime: { hp: 3, sp: 1.1, r: 0.5, dmg: 1, fly: 0 },
  bat: { hp: 2, sp: 1.6, r: 0.42, dmg: 1, fly: 1.25 },
  golem: { hp: 8, sp: 0.65, r: 0.7, dmg: 2, fly: 0 },
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
const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
const hemi = new THREE.HemisphereLight(0xffffff, 0x4a5a6a, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dd, 2.2); sun.position.set(-9, 30, 22); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 16, bottom: -16, near: 1, far: 80 }); sun.target.position.set(0, 11, 0); scene.add(sun, sun.target);
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const loader = new GLTFLoader(); const glb = {};
const loadGLB = (url) => glb[url] || (glb[url] = new Promise((res) => loader.load(url, (g) => res(g), undefined, () => res(null))));
function fitH(o, h) { const b = new THREE.Box3().setFromObject(o); const s = h / Math.max(0.001, b.max.y - b.min.y); o.scale.multiplyScalar(s); return o; }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function makeEnv(top, bot) {
  const es = new THREE.Scene(); const tex = canvasTex(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
  const l = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 3), new THREE.MeshBasicMaterial({ color: 0xffffff })); l.position.y = 8; es.add(l);
  const pm = new THREE.PMREMGenerator(R); const rt = pm.fromScene(es, 0.03); pm.dispose(); return rt.texture;
}
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
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.36, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pts.frustumCulled = false; scene.add(this.pts);
  }
  burst(p, color, n = 20, sp = 5, opt = {}) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.i = (this.i + 1) % this.n, a = Math.random() * Math.PI * 2, s = sp * (0.35 + Math.random() * 0.65);
      this.pos[i * 3] = p.x + (opt.spread || 0) * (Math.random() - 0.5); this.pos[i * 3 + 1] = p.y + (opt.spread || 0) * (Math.random() - 0.5); this.pos[i * 3 + 2] = p.z + 0.3;
      this.v[i * 3] = Math.cos(a) * s + (opt.vx || 0); this.v[i * 3 + 1] = Math.sin(a) * s + (opt.vy || 0); this.v[i * 3 + 2] = (Math.random() * 0.6 + 0.2) * s * (opt.vz ?? 0.4);
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

// ── 画面の文字
function screenOf(v) { const p = v.clone().project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }
function floatText(v, html, cls = '') {
  const s = screenOf(v), el = document.createElement('div'); el.className = 'ft ' + cls; el.innerHTML = html; el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
  $('#fx').appendChild(el); setTimeout(() => el.remove(), 1300);
}
function banner(html, cls = '', ms = 1300) { const el = document.createElement('div'); el.className = 'banner ' + cls; el.innerHTML = html; $('#fx').appendChild(el); setTimeout(() => el.remove(), ms); }
function flash(color, ms = 260) { const el = document.createElement('div'); el.className = 'flash'; el.style.background = color; $('#fx').appendChild(el); setTimeout(() => el.remove(), ms); }

// ── 世界
let world = null, G = null, mixers = [], mage = null, bossObj = null;
const mats = {};
const stdMat = (o) => new THREE.MeshStandardMaterial(o);
function box(w, h, d, m) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = o.receiveShadow = true; return o; }
const TILE = 0.3;

async function buildWorld(st) {
  if (world) { scene.remove(world); world.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  world = new THREE.Group(); scene.add(world); mixers = []; bossObj = null; mage = null;
  scene.background = canvasTex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, st.sky[0]); gr.addColorStop(1, st.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.fog = null; scene.environment = makeEnv(st.sky[0], st.sky[1]);
  const dark = st.id !== 'forest'; hemi.intensity = dark ? 0.8 : 1.1; sun.intensity = dark ? 1.7 : 2.3;
  // 盤面の絵(ステージの景色)
  const art = canvasTex(512, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, st.paint[0]); gr.addColorStop(1, st.paint[2]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const hill = (y, col, amp, n) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / w * Math.PI * n + y) * amp + Math.sin(x / 37) * amp * 0.25); g.lineTo(w, h); g.fill(); };
    g.globalAlpha = 0.55; for (let k = 0; k < 5; k++) hill(150 + k * 190, k % 2 ? st.paint[1] : st.paint[2], 30 + k * 4, 2 + k);
    g.globalAlpha = 0.18; g.fillStyle = '#fff'; for (let k = 0; k < 14; k++) { const x = Math.random() * w, y = Math.random() * h * 0.9; g.beginPath(); g.ellipse(x, y, 40 + Math.random() * 30, 14, 0, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 0.16; g.strokeStyle = st.rune; g.lineWidth = 3; for (let k = 0; k < 10; k++) { const x = 60 + (k % 3) * 190, y = 60 + k * 98; g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.moveTo(x - 22, y); g.lineTo(x + 22, y); g.moveTo(x, y - 22); g.lineTo(x, y + 22); g.stroke(); }
    g.globalAlpha = 1;
  });
  const dk = stdMat({ color: 0x333333 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 0.4, TOP + 1.6, 0.5), [dk, dk, dk, dk, stdMat({ map: art, roughness: 0.8 }), dk]);
  back.position.set(0, TOP / 2 - 0.3, -0.25); back.receiveShadow = true; world.add(back);
  // わく(木または石)と金のふち
  const fm = stdMat({ color: st.frame, roughness: 0.7 }), gold = mats.gold = stdMat({ color: 0xffc94d, metalness: 0.85, roughness: 0.3, emissive: 0x5a3800, emissiveIntensity: 0.4 });
  for (const s of [-1, 1]) { const f = box(1.5, TOP + 4.2, 1.1, fm); f.position.set(s * (HW + 0.95), TOP / 2 - 0.6, 0.3); world.add(f); const t = box(0.12, TOP + 4.2, 0.14, gold); t.position.set(s * (HW + 0.24), TOP / 2 - 0.6, 0.86); world.add(t); }
  const ft = box(HW * 2 + 3.4, 1.0, 1.1, fm); ft.position.set(0, TOP + 1.0, 0.3); world.add(ft);
  const fb = box(HW * 2 + 3.4, 1.6, 1.1, fm); fb.position.set(0, -1.15, 0.3); world.add(fb);
  // 上の看板と、左上のコイン投入口
  const signTex = canvasTex(512, 110, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff1b8'); gr.addColorStop(1, '#e8a830'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a4b00'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.font = '900 64px "M PLUS Rounded 1c", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#6a2a00'; g.fillText('ルーンはじき', w / 2, h / 2 + 4); });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(5, 1.05, 0.2), [gold, gold, gold, gold, stdMat({ map: signTex, roughness: 0.5, metalness: 0.2 }), gold]); sign.position.set(0.9, TOP + 1.0, 0.95); world.add(sign);
  const slot = box(1.4, 0.7, 0.4, stdMat({ color: 0x222222, metalness: 0.6, roughness: 0.4 })); slot.position.set(-HW + 0.9, TOP + 1.0, 0.9); world.add(slot);
  const slotGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.16), new THREE.MeshBasicMaterial({ color: 0xffd36e })); slotGlow.position.set(-HW + 0.9, TOP + 1.0, 1.11); world.add(slotGlow); G.slotGlow = slotGlow;
  // レール(小さな板を並べて、穴の部分だけ消す) と 飾りのくぎ
  const railMat = stdMat({ color: 0xeef3fb, metalness: 0.55, roughness: 0.3 });
  const tiles = []; for (const r of RAILS) { const L = Math.abs(r.xl - r.xh); for (let x = 0; x < L; x += TILE) tiles.push({ r, x: r.xh + r.d * (x + TILE / 2) }); }
  const rim = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE + 0.02, 0.16, 0.55), railMat, tiles.length); rim.castShadow = true; rim.receiveShadow = true; world.add(rim);
  G.tiles = tiles; G.railMesh = rim;
  const pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6).rotateX(Math.PI / 2), stdMat({ color: 0xc9d2e0, metalness: 0.7, roughness: 0.3 }), RAILS.length * 12); let pk = 0; const mm = new THREE.Matrix4();
  for (const r of RAILS) for (let k = 0; k < 12; k++) { const x = r.xh + (r.xl - r.xh) * (k + 0.5) / 12; mm.makeTranslation(x, railY(r, x) - 0.32, 0.25); pins.setMatrixAt(pk++, mm); } world.add(pins);
  // 下: 漏斗と、城の魔法砲(ゴール)
  for (const f of FLOOR) { const L = Math.hypot(f.bx - f.ax, f.by - f.ay), o = box(L, 0.18, 0.55, railMat); o.position.set((f.ax + f.bx) / 2, (f.ay + f.by) / 2, 0.28); o.rotation.z = Math.atan2(f.by - f.ay, f.bx - f.ax); world.add(o); }
  const cannon = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), new THREE.MeshBasicMaterial({ map: runeTex('#ffe9a8', false), color: 0xffd36e, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  cannon.position.set(0, 0.1, 0.05); world.add(cannon); G.cannon = cannon;
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W * 2 + 0.6, 1.6), new THREE.MeshBasicMaterial({ color: 0xb04dff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); shield.position.set(0, 0.6, 0.6); world.add(shield); G.shieldMesh = shield;
  const gw = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W * 2 + 3, 2.2), new THREE.MeshBasicMaterial({ color: 0x7cc7ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); gw.position.set(0, 0.9, 0.7); world.add(gw); G.guardMesh = gw;
  // 穴(奈落): 描いた穴と、光の橋
  const pitTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, '#000'); gr.addColorStop(0.68, '#06000c'); gr.addColorStop(0.82, 'rgba(40,0,60,.85)'); gr.addColorStop(1, 'rgba(40,0,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const swirlTex = canvasTex(128, 128, (g) => { g.translate(64, 64); for (let k = 0; k < 3; k++) { g.rotate(Math.PI * 2 / 3); g.beginPath(); for (let a = 0; a < 5; a += 0.1) { const r = 6 + a * 11; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.strokeStyle = 'rgba(190,120,255,.8)'; g.lineWidth = 5; g.stroke(); } });
  mats.pit = new THREE.MeshBasicMaterial({ map: pitTex, transparent: true, depthWrite: false });
  mats.swirl = new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  mats.bridge = new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  G.gaps = st.gaps.map(([ri, t, w, mv, sp]) => makeGap(ri, t, w, { mv, sp }));
  // レバー(左右の枠)
  G.levers = RAILS.map(r => {
    const side = -r.d, y = (r.yH + r.yL) / 2 + 0.2, g = new THREE.Group(); g.position.set(side * (HW + 0.95), y, 0.9);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.2, 18).rotateX(Math.PI / 2), stdMat({ color: 0x8a6a3a, metalness: 0.8, roughness: 0.35 })); base.castShadow = true; g.add(base);
    const arm = new THREE.Group(); g.add(arm); const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.0, 10), stdMat({ color: 0xd9dde6, metalness: 0.9, roughness: 0.2 })); hd.position.y = 0.5; arm.add(hd);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), stdMat({ color: 0xff4d5e, roughness: 0.3, emissive: 0x400010 })); knob.position.y = 1.0; arm.add(knob); arm.position.z = 0.15; arm.rotation.z = side * 0.5;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd36e })); lamp.position.set(0, -0.62, 0.1); g.add(lamp);
    const hammer = box(0.32, 0.5, 0.4, gold); hammer.position.set(side * (HW - 0.12), r.yH - 0.2, 0.3); world.add(hammer);
    world.add(g); return { r, side, g, arm, knob, lamp, hammer, hit: 0, cd: 0, id: 0 };
  });
  decorate(st);
  await Promise.all([placeMage(), placeBoss(st)]);
  updateRailTiles(); fitCam();
}
function makeGap(ri, t, w, o = {}) {
  const g = new THREE.Group();
  const pit = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32), mats.pit); pit.position.z = 0.02; g.add(pit);
  const sw = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), mats.swirl); sw.position.z = 0.03; g.add(sw);
  const rm = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 30), new THREE.MeshBasicMaterial({ color: o.temp ? 0xff3b5c : 0xb9c4d6 })); rm.position.z = 0.05; g.add(rm);
  const br = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.14, 0.5), mats.bridge); g.add(br);
  world.add(g);
  const gp = { ri, t0: t, t, w, mv: o.mv || 0, sp: o.sp || 0, ph: Math.random() * 6, g, sw, br, temp: o.temp || 0, grow: o.temp ? 0 : 1 };
  placeGap(gp); return gp;
}
function placeGap(gp) {
  const r = RAILS[gp.ri]; gp.cx = r.xh + (r.xl - r.xh) * gp.t; const w = gp.w * gp.grow; gp.x0 = gp.cx - w / 2; gp.x1 = gp.cx + w / 2;
  const y = railY(r, gp.cx); gp.g.position.set(gp.cx, y - 0.62, 0); gp.g.scale.setScalar(Math.max(0.01, gp.grow)); gp.br.position.set(0, 0.62, 0.28); gp.br.rotation.z = Math.atan2(r.yL - r.yH, r.xl - r.xh);
}
function inGap(ri, x, pad = 0) { for (const g of G.gaps) if (g.ri === ri && x > g.x0 - pad && x < g.x1 + pad && g.grow > 0.5) return g; return null; }
function updateRailTiles() {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1);
  G.tiles.forEach((t, i) => { const r = t.r, hole = !(G.ef.bridge > 0) && inGap(r.i, t.x, -0.05); p.set(t.x, railY(r, t.x), 0.28); q.setFromAxisAngle(z, Math.atan2(r.yL - r.yH, r.xl - r.xh)); s.setScalar(hole ? 0.0001 : 1); m.compose(p, q, s); G.railMesh.setMatrixAt(i, m); });
  G.railMesh.instanceMatrix.needsUpdate = true;
}
async function model(name, h) { const g = await loadGLB('../assets/kaykit/hex/' + name + '.gltf'); if (!g) return null; const o = g.scene.clone(true); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); if (h) fitH(o, h); return o; }
function tintObj(o, k) { o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.multiplyScalar(k); } }); }
function decorate(st) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), stdMat({ color: st.id === 'forest' ? 0x6aae4c : st.id === 'crypt' ? 0x4c5a48 : 0x3b2c2c, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -2.0; ground.receiveShadow = true; world.add(ground);
  const kinds = st.id === 'forest' ? ['trees_A_medium', 'trees_B_medium', 'tree_single_A'] : st.id === 'crypt' ? ['rock_single_A', 'tree_single_A', 'building_destroyed'] : ['rock_single_C', 'building_destroyed', 'rock_single_A'];
  for (let i = 0; i < 14; i++) { const s = i % 2 ? 1 : -1; model(kinds[i % kinds.length]).then(o => { if (!o) return; o.scale.setScalar(rand(2, 3)); o.position.set(s * rand(8.5, 16), -2, rand(-14, -2)); o.rotation.y = rand(0, 6); if (st.id !== 'forest') tintObj(o, st.id === 'maou' ? 0.55 : 0.75); world.add(o); }); }
  for (const s of [-1, 1]) model('building_tower_A_yellow').then(o => { if (!o) return; fitH(o, 9); o.position.set(s * 8.2, -2, -3); if (st.id !== 'forest') tintObj(o, 0.6); world.add(o); });
  G.clouds = [];
  for (let i = 0; i < 5; i++) model('cloud_big').then(o => { if (!o) return; o.scale.setScalar(2.6); o.position.set(-30 + i * 14, 18 + (i % 2) * 6, -22 - (i % 3) * 5); o.userData.cloud = 0.3 + i * 0.07; world.add(o); G.clouds.push(o); });
  // 手前: 城の石垣と旗
  const wm = stdMat({ color: st.id === 'forest' ? 0xa79f94 : 0x6f6878, roughness: 0.9 }), wall = box(HW * 2 + 6, 1.4, 1.6, wm); wall.position.set(0, -2.6, 0.6); world.add(wall);
  for (let k = -4; k <= 4; k++) { const c = box(0.9, 0.6, 1.6, wm); c.position.set(k * 1.75, -1.6, 0.6); world.add(c); }
  for (const s of [-1, 1]) model(s < 0 ? 'flag_blue' : 'flag_yellow').then(o => { if (!o) return; fitH(o, 2.4); o.position.set(s * 7.6, -1.9, 0.8); world.add(o); });
}
function hideProps(o, names) { o.traverse(m => { if (names.includes(m.name)) m.visible = false; }); }
async function placeMage() {
  const g = await loadGLB('../assets/kaykit/chars/Mage.glb'); if (!g) return;
  const o = SkeletonUtils.clone(g.scene); hideProps(o, ['Spellbook', 'Spellbook_open', '1H_Wand']); fitH(o, 2.3); o.position.set(-(HW - 2.2), -1.3, 1.8); o.rotation.y = 0.35; o.traverse(m => { if (m.isMesh) m.castShadow = true; });
  world.add(o); const mx = new THREE.AnimationMixer(o); mixers.push(mx);
  const act = (n) => { const c = g.animations.find(a => a.name === n); return c ? mx.clipAction(c) : null; };
  const idle = act('Idle'); if (idle) idle.play();
  mage = { o, play(n) { const a = act(n); if (!a || !idle) return; a.reset(); a.setLoop(THREE.LoopOnce, 1); a.play(); idle.crossFadeTo(a, 0.1, false); setTimeout(() => { idle.reset().play(); a.crossFadeTo(idle, 0.25, false); }, n === 'Cheer' ? 1400 : 700); } };
}
async function placeBoss(st) {
  const k = st.boss.kind, g = new THREE.Group(); g.position.set(0, TOP + 1.5, -1.2); world.add(g);
  let body = null, anim = null; const mats2 = [];
  if (k === 'slime') {
    body = new THREE.Group(); const sm = stdMat({ color: 0x5ee06a, roughness: 0.15, transparent: true, opacity: 0.94, emissive: 0x0c4a12, emissiveIntensity: 0.4 }); mats2.push(sm);
    const b = new THREE.Mesh(new THREE.SphereGeometry(2.1, 32, 24), sm); b.scale.set(1, 0.78, 1); b.position.y = 1.6; b.castShadow = true; body.add(b);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), stdMat({ color: 0xffffff, roughness: 0.2 })); e.position.set(s * 0.68, 2.05, 1.72); body.add(e); const pu = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), stdMat({ color: 0x111111 })); pu.position.set(s * 0.66, 2.0, 2.05); body.add(pu); }
    const gm = stdMat({ color: 0xffc94d, metalness: 0.9, roughness: 0.25 }); const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 0.55, 10, 1, true), gm); cr.position.y = 3.25; body.add(cr);
    for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 6), gm); const a = i / 5 * Math.PI * 2; sp.position.set(Math.cos(a) * 0.88, 3.75, Math.sin(a) * 0.88); body.add(sp); }
    g.add(body); anim = (t) => body.scale.set(1 + Math.sin(t * 3) * 0.05, 1 - Math.sin(t * 3) * 0.05, 1 + Math.sin(t * 3) * 0.05);
  } else {
    const gl = await loadGLB('../assets/kaykit/chars/' + (k === 'knight' ? 'Knight' : 'Barbarian') + '.glb');
    if (gl) {
      body = SkeletonUtils.clone(gl.scene); hideProps(body, k === 'knight' ? ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', '2H_Sword'] : ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', 'Mug']);
      fitH(body, k === 'knight' ? 4.6 : 5.4);
      const tint = new THREE.Color(k === 'knight' ? 0x4a4462 : 0x7a2a3a);
      body.traverse(m => { if (m.isMesh) { m.castShadow = true; m.material = m.material.clone(); m.material.color.multiply(tint); m.material.emissive = new THREE.Color(k === 'knight' ? 0x2a1450 : 0x400010); m.material.emissiveIntensity = 0.6; mats2.push(m.material); } });
      g.add(body); const mx = new THREE.AnimationMixer(body); mixers.push(mx);
      const act = (n) => { const c = gl.animations.find(a => a.name === n); return c ? mx.clipAction(c) : null; }, idle = act('Idle'); if (idle) idle.play();
      body.userData.play = (n, ms = 800) => { const a = act(n); if (!a || !idle) return; a.reset(); a.setLoop(THREE.LoopOnce, 1); a.play(); idle.crossFadeTo(a, 0.08, false); setTimeout(() => { idle.reset().play(); a.crossFadeTo(idle, 0.25, false); }, ms); };
    }
  }
  const aura = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshBasicMaterial({ map: runeTex(st.rune, false), color: st.rune, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); aura.rotation.x = -Math.PI / 2; aura.position.y = 0.05; g.add(aura);
  bossObj = { g, body, anim, mats: mats2, aura, flash: 0 };
}

// ── カメラ: 正面から。わくと左右のレバーが画面の幅に、ボスから城までが上下の表示のあいだに入るように
const camBase = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
function fitCam() {
  const w = innerWidth, h = innerHeight; R.setSize(w, h); cam.aspect = w / h; cam.clearViewOffset(); cam.updateProjectionMatrix();
  const topY = 92, botY = h - 178, look = V(0, 11, 0), dir = V(0, 0.16, 1).normalize();
  const pts = [V(0, -2.4, 1), V(0, TOP + 5.5, -1), V(-(HW + 2.3), 10, 1), V(HW + 2.3, 10, 1)];
  const scr = (v) => { const p = v.clone().project(cam); return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h }; };
  let lo = 10, hi = 200;
  for (let i = 0; i < 26; i++) { const d = (lo + hi) / 2; cam.position.copy(look).addScaledVector(dir, d); cam.lookAt(look); cam.updateMatrixWorld();
    const a = scr(pts[0]), b = scr(pts[1]), l = scr(pts[2]), r = scr(pts[3]); if (a.y - b.y > botY - topY || r.x - l.x > w - 6) lo = d; else hi = d; }
  cam.position.copy(look).addScaledVector(dir, hi); cam.lookAt(look); cam.updateMatrixWorld();
  const dy = scr(pts[0]).y - botY; camBase.pos.copy(cam.position); camBase.look.copy(look);
  cam.setViewOffset(w, h, 0, dy, w, h); cam.updateProjectionMatrix();
  placeLeverButtons();
}
addEventListener('resize', () => fitCam());

// ── ゲームの状態
function newGame(si) {
  const st = STAGES[si];
  G = { si, st, t: 0, coins: [], hand: HAND_MAX, regen: 0, mana: 2, castle: 10, castleMax: 10, boss: st.boss.hp, bossMax: st.boss.hp, mons: [], gaps: [], ef: {}, fire: 0,
    bossT: 8, spawnT: 4, goals: 0, maxCombo: 0, fell: 0, kills: 0, jumps: 0, cut: null, slow: 0, shake: 0, over: null, half: false, shieldHp: 0, beams: [], mid: 0, cid: 0, windDir: 1 };
  return G;
}
function coinMesh(fire) {
  if (!mats.coinTop) { mats.coinTop = stdMat({ map: runeTex('#8a4b00', true), metalness: 0.85, roughness: 0.28 }); mats.coinSide = stdMat({ color: 0xe0a228, metalness: 0.9, roughness: 0.25 }); mats.fireTop = stdMat({ map: runeTex('#8a1000', true), color: 0xff8a5c, metalness: 0.6, roughness: 0.3, emissive: 0xff3000, emissiveIntensity: 0.9 }); }
  const geo = new THREE.CylinderGeometry(CR, CR, 0.16, 28); geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, [fire ? mats.fireTop : mats.coinSide, fire ? mats.fireTop : mats.coinTop, fire ? mats.fireTop : mats.coinTop]); m.castShadow = true; world.add(m); return m;
}
function spawnCoin(x, y, vx, vy, fire) { const c = { id: ++G.cid, x, y, vx, vy, combo: 0, fire: !!fire, mesh: coinMesh(fire), dead: false, fall: 0, slowT: 0, ground: -1, gT: 9, rot: 0, trail: 0, over: null }; G.coins.push(c); return c; }
function removeCoin(c) { c.dead = true; if (c.mesh) { world.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; } }

// ── コインを入れる
function insertCoin() {
  if (!G || G.over || G.cut || G.paused) return;
  if (G.hand <= 0) { floatText(V(-HW + 1, TOP, 1.5), 'コインを集めています…', 'small'); return; }
  if (G.coins.filter(c => !c.dead).length >= MAX_ON) { floatText(V(-HW + 1.5, TOP, 1.5), `同時に${MAX_ON}枚まで`, 'small'); return; }
  G.hand--; const fire = G.fire > 0; if (fire) G.fire--;
  const c = spawnCoin(-HW + 0.6, TOP + 0.2, 1.6, -1, fire);
  if (G.splitNext) { G.splitNext = 0; splitCoin(c); }
  sfx('flick'); haptic(12); if (mage) mage.play('Interact');
  P.burst(V(-HW + 0.9, TOP + 0.9, 1), fire ? 0xff7a3c : 0xffd36e, 16, 4);
  renderCtrl();
}
function splitCoin(c) { for (const [dx, dv] of [[-0.5, -1.4], [0.5, 1.4]]) { const n = spawnCoin(c.x + dx * 0.3, c.y + 0.4, c.vx + dv, Math.max(c.vy, 0) + 3, c.fire); n.combo = c.combo; } P.burst(V(c.x, c.y, 0.5), 0xc79bff, 26, 6); }

// ── レバー: その段にいるコインをはね上げる
function lever(i) {
  if (!G || G.over || G.cut || G.paused) return; const L = G.levers[i]; if (!L || L.cd > 0) return;
  L.cd = 0.28; L.hit = 1; sfx('kickair'); haptic(10);
  const r = L.r; let any = false;
  for (const c of G.coins) {
    if (c.dead || c.fall) continue;
    const xa = Math.min(r.xh, r.xl), xb = Math.max(r.xh, r.xl), ly = railY(r, clamp(c.x, xa, xb));
    const onIt = c.x > xa - 0.6 && c.x < xb + 0.4 && c.y > ly - 0.45 && c.y < ly + CR + 0.12;
    if (!onIt) continue; any = true;
    c.vy = HOP * (G.ef.gravity > 0 ? 0.8 : 1); c.vx = r.d * Math.max(Math.abs(c.vx), 2.4) * (Math.sign(c.vx) === -r.d ? 0.6 : 1); c.ground = -1; c.gT = 9; c.hopX = c.x; c.hopR = r.i;
    P.burst(V(c.x, c.y - 0.3, 0.5), 0xffd36e, 16, 5, { vy: 2 }); sfx('kick');
  }
  if (any) G.shake = Math.max(G.shake, 0.12);
  const b = $(`#levers [data-i="${i}"]`); if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
}
function placeLeverButtons() {
  const el = $('#levers'); if (!el) return; if (!G || !G.levers || G.over) { el.innerHTML = ''; return; }
  if (el.children.length !== G.levers.length) el.innerHTML = G.levers.map((L, i) => `<button class="lv ${L.side < 0 ? 'l' : 'r'}" data-a="lever" data-i="${i}"><i></i></button>`).join('');
  G.levers.forEach((L, i) => { const s = screenOf(L.g.position.clone().add(V(0, 0.2, 0))), b = el.children[i]; if (b) { b.style.left = s.x + 'px'; b.style.top = s.y + 'px'; } });
}
// 画面のどこをさわっても、その高さの段のレバーが動く
R.domElement.addEventListener('pointerdown', (e) => {
  unlockAudio(); if (!G || G.over || G.cut || G.paused || !G.levers) return;
  let best = -1, bd = 1e9; G.levers.forEach((L, i) => { const r = L.r, s = screenOf(V((r.xh + r.xl) / 2, (r.yH + r.yL) / 2, 0)), d = Math.abs(s.y - e.clientY); if (d < bd) { bd = d; best = i; } });
  if (best >= 0) lever(best);
});

// ── スキル
function useSkill(k) {
  const S = SKILLS[k]; if (!G || G.over || G.cut || G.mana < S.cost) return;
  G.mana -= S.cost; sfx('skill'); haptic(20); flash('rgba(255,230,140,.35)');
  banner(`${img(S.icon, 'bi')}<b>${S.name}!</b><small>${S.text}</small>`, 'me');
  if (k === 'bridge') { G.ef.bridge = 7; for (const g of G.gaps) P.burst(V(g.cx, railY(RAILS[g.ri], g.cx), 0.5), 0xffe28a, 16, 3); updateRailTiles(); }
  if (k === 'fire') { G.fire += 3; for (const c of G.coins) if (!c.dead && !c.fire) { c.fire = true; world.remove(c.mesh); c.mesh = coinMesh(true); } }
  if (k === 'split') { const live = G.coins.filter(c => !c.dead && !c.fall); if (live.length) live.forEach(splitCoin); else { G.splitNext = 1; floatText(V(0, TOP - 2, 1), '次のコインが分身する', 'small'); } }
  if (k === 'time') G.ef.time = 6;
  if (k === 'guard') G.ef.guard = 10;
  renderCtrl();
}

// ── ボスの技
function bossCast() {
  const st = G.st; let k = pick(st.skills); if (k === G.lastSkill) k = pick(st.skills); G.lastSkill = k;
  if (k === 'shield' && G.ef.shield > 0) k = 'summon';
  G.cut = { t: 1.5, t0: 1.5, k, line: st.lines[k] || '', boss: true }; showCut();
  sfx('boss'); haptic(30); if (bossObj && bossObj.body && bossObj.body.userData.play) bossObj.body.userData.play('Interact', 900);
}
function applyBossSkill(k) {
  const st = G.st;
  if (k === 'pit') { for (let n = 0; n < 2; n++) { let ri, t, ok = false; for (let tries = 0; tries < 30 && !ok; tries++) { ri = Math.floor(Math.random() * NR); t = rand(0.2, 0.85); const x = RAILS[ri].xh + (RAILS[ri].xl - RAILS[ri].xh) * t; ok = G.gaps.every(g => g.ri !== ri || Math.abs(g.cx - x) > 2.4); } if (ok) { const g = makeGap(ri, t, 1.05, { temp: 1 }); g.life = 9; G.gaps.push(g); P.burst(V(g.cx, railY(RAILS[ri], g.cx), 0.5), 0xff3b5c, 30, 5); } } sfx('pit'); }
  if (k === 'wind') { G.ef.wind = 4.5; G.windDir = Math.random() < 0.5 ? -1 : 1; sfx('wind'); banner(`魔風: コインが${G.windDir < 0 ? '左' : '右'}へ押される!`, 'bad', 1600); }
  if (k === 'quake') { G.ef.quake = 2; G.quakeT = 0; sfx('quake'); }
  if (k === 'shield') { G.ef.shield = 14; G.shieldHp = 3; sfx('shield'); }
  if (k === 'summon') { for (let i = 0; i < (st.id === 'forest' ? 3 : 4); i++) setTimeout(() => spawnMon(pick(st.mons)), i * 700); }
  if (k === 'gravity') { G.ef.gravity = 5; sfx('boss'); }
}

// ── 魔物: コインと同じ道を、城まで下りてくる
const PATH = (() => {
  const pts = []; RAILS.forEach((r, i) => { pts.push([r.xh + r.d * 0.5, railY(r, r.xh + r.d * 0.5)]); pts.push([r.xl + r.d * 0.35, r.yL - 0.04]); const nx = r.xl + r.d * 0.6, nr = RAILS[i + 1]; pts.push([nx, nr ? railY(nr, nx) : 1.5 - (HW - Math.abs(nx)) * 0.26]); });
  pts.push([0, 0.45]);
  const segs = []; let L = 0; for (let k = 0; k < pts.length - 1; k++) { const [ax, ay] = pts[k], [bx, by] = pts[k + 1], len = Math.hypot(bx - ax, by - ay), drop = Math.abs(bx - ax) < 0.5; segs.push({ ax, ay, bx, by, len, s0: L, drop }); L += len; }
  return { segs, L };
})();
function pathAt(s) { for (const g of PATH.segs) if (s <= g.s0 + g.len) { const k = (s - g.s0) / g.len; return { x: g.ax + (g.bx - g.ax) * k, y: g.ay + (g.by - g.ay) * k, drop: g.drop, dir: Math.sign(g.bx - g.ax) }; } const g = PATH.segs[PATH.segs.length - 1]; return { x: g.bx, y: g.by, drop: false, dir: 0 }; }
function spawnMon(type) {
  if (!G || G.over) return; const T = MON[type];
  const g = new THREE.Group(); const parts = {};
  const col = G.st.id === 'maou' ? 0xb04dff : G.st.id === 'crypt' ? 0x58c4b8 : 0x6ee07a;
  if (type === 'slime') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), stdMat({ color: col, roughness: 0.2, transparent: true, opacity: 0.93 })); b.scale.set(1, 0.75, 0.9); b.position.y = 0.36; b.castShadow = true; g.add(b); parts.body = b;
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), stdMat({ color: 0xffffff })); e.position.set(s * 0.18, 0.48, 0.4); g.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), stdMat({ color: 0x111111 })); p.position.set(s * 0.18, 0.48, 0.5); g.add(p); } }
  if (type === 'bat') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), stdMat({ color: 0x3a2a4a, roughness: 0.5 })); b.castShadow = true; g.add(b); parts.body = b;
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.75, 0.2, 0, 0.6, -0.2, 0.1], 3)); wg.computeVertexNormals();
    parts.wings = [-1, 1].map(s => { const w = new THREE.Mesh(wg, stdMat({ color: 0x4b3560, side: THREE.DoubleSide })); w.position.set(s * 0.15, 0.05, 0); w.scale.x = s; g.add(w); return w; });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3040 })); e.position.set(s * 0.11, 0.07, 0.27); g.add(e); } }
  if (type === 'golem') { const m = stdMat({ color: 0x8a8590, roughness: 0.9, flatShading: true }); const b = box(0.9, 0.75, 0.6, m); b.position.y = 0.6; g.add(b); const hd = box(0.5, 0.42, 0.45, m); hd.position.y = 1.2; g.add(hd); parts.body = b;
    for (const s of [-1, 1]) { const a = box(0.28, 0.65, 0.28, m); a.position.set(s * 0.6, 0.55, 0); g.add(a); const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5cf0ff })); e.position.set(s * 0.12, 1.25, 0.24); g.add(e); } }
  const bar = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.12), new THREE.MeshBasicMaterial({ color: 0x220010, depthTest: false, transparent: true })); const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.08), new THREE.MeshBasicMaterial({ color: 0xff4d5e, depthTest: false, transparent: true })); fg.position.z = 0.001; bar.add(bg, fg); bar.position.y = type === 'bat' ? 0.55 : type === 'golem' ? 1.75 : 0.95; bar.renderOrder = 5; g.add(bar);
  g.position.z = 0.35; world.add(g);
  const m = { id: ++G.mid, type, s: 0, x: 0, y: 0, hp: T.hp, max: T.hp, sp: T.sp * (G.half ? 1.15 : 1), r: T.r, dmg: T.dmg, fly: T.fly, g, parts, bar, fg, ph: Math.random() * 6, hitCd: 0 };
  G.mons.push(m); monPos(m); P.burst(V(m.x, m.y + 0.5, 0.5), 0x9a5cff, 14, 3);
}
function monPos(m) { const p = pathAt(m.s); m.x = p.x; m.y = p.y + (m.fly ? m.fly : 0); m.dir = p.dir; m.drop = p.drop; }
function hurtMon(m, dmg) {
  m.hp -= dmg; m.hitCd = 0.25; m.flash = 0.15; sfx('hit'); floatText(V(m.x, m.y + 1.2, 1), `${dmg}`, 'dmg'); P.burst(V(m.x, m.y + 0.4, 0.6), 0xffffff, 8, 4);
  if (m.hp <= 0) killMon(m, true);
}
function killMon(m, byCoin) {
  m.dead = true; world.remove(m.g);
  if (byCoin) { G.kills++; addMana(1); sfx('kill'); P.burst(V(m.x, m.y + 0.4, 0.6), m.type === 'golem' ? 0xaab0c0 : m.type === 'bat' ? 0xb07cff : 0x7cf08a, 30, 6); floatText(V(m.x, m.y + 1.4, 1), '撃破!', 'kill'); }
}
function addMana(n) { const b = Math.floor(G.mana); G.mana = Math.min(MANA_MAX, G.mana + n); if (Math.floor(G.mana) > b) sfx('mana', Math.floor(G.mana)); }

// ── 物理(1/240秒きざみ)
function physics(h) {
  const ef = G.ef, g = GRAV * (ef.gravity > 0 ? 1.6 : 1), bridge = ef.bridge > 0;
  for (const c of G.coins) {
    if (c.dead) continue;
    if (c.fall) { c.fall += h * 2; if (c.fall >= 1) removeCoin(c); continue; }
    c.vy -= g * h; if (ef.wind > 0) c.vx += G.windDir * 5 * h;
    c.x += c.vx * h; c.y += c.vy * h; c.gT += h;
    // 左右の壁
    for (const s of [-1, 1]) if (s * c.x > HW - CR) { c.x = s * (HW - CR); if (s * c.vx > 0) { const vn = s * c.vx; c.vx = -s * vn * 0.45; if (vn > 1.5) sfx('wall', 1); } }
    // レール(上からだけ乗れる)
    for (const r of RAILS) {
      const xa = Math.min(r.xh, r.xl), xb = Math.max(r.xh, r.xl); if (c.x < xa - CR * 0.6 || c.x > xb + CR * 0.6) continue;
      const tx = r.xl - r.xh, ty = r.yL - r.yH, L = Math.hypot(tx, ty), ux = tx / L, uy = ty / L, nx = -uy * Math.sign(ux), ny = Math.abs(ux);
      const sd = (c.x - r.xh) * nx + (c.y - r.yH) * ny;    // レールの線からの高さ
      if (sd > CR || sd < -0.6) continue;
      const sp0 = (c.x - c.vx * h - r.xh) * nx + (c.y - c.vy * h - r.yH) * ny; if (sp0 < -0.25) continue;   // 下から来たものは乗せない
      const gp = !bridge && inGap(r.i, c.x);
      if (gp) { if (sd < -0.2) { coinFell(c, gp); break; } c.over = gp; continue; }
      if ((c.x < xa || c.x > xb) && sd < CR * 0.4) continue;   // 端の角
      c.x += nx * (CR - sd); c.y += ny * (CR - sd);
      const vn = c.vx * nx + c.vy * ny; if (vn < 0) { c.vx -= 1.2 * vn * nx; c.vy -= 1.2 * vn * ny; if (vn < -3) { sfx('wall', 2); P.burst(V(c.x, c.y - CR, 0.4), 0xfff0b0, 5, 2); } }
      c.vx *= 1 - 0.25 * h; c.vy *= 1 - 0.25 * h;
      const hopped = c.hopR === r.i && c.ground !== r.i && G.gaps.some(g => g.ri === r.i && (g.cx - c.hopX) * (g.cx - c.x) < 0); if (c.ground !== r.i) c.hopR = null;
      if (c.over && c.over.ri === r.i || hopped) { c.combo++; G.jumps++; G.maxCombo = Math.max(G.maxCombo, c.combo); addMana(0.35); sfx('bump', c.combo); floatText(V(c.x, c.y + 0.9, 1), `とびこえ! ${c.combo}`, 'combo'); P.burst(V(c.x, c.y, 0.5), 0xffe28a, 16, 5); }
      c.over = null; c.ground = r.i; c.gT = 0;
    }
    if (c.fall || c.dead) continue;
    // 床(漏斗)と砲台
    for (const f of FLOOR) collideSeg(c, f.ax, f.ay, f.bx, f.by, 0.09, 0.2);
    if (c.y < 0.35 && Math.abs(c.x) < GOAL_W + 0.2) {
      if (ef.shield > 0) { c.y = 0.4; c.vy = 8; c.vx = rand(-2, 2); G.shieldHp--; sfx('crack'); P.burst(V(c.x, 0.5, 0.8), 0xb04dff, 24, 6); G.shake = 0.2; floatText(V(0, 2, 1), G.shieldHp > 0 ? `結界 のこり${G.shieldHp}` : '結界をやぶった!', 'combo'); if (G.shieldHp <= 0) { ef.shield = 0; flash('rgba(200,120,255,.35)'); } }
      else { goal(c); continue; }
    }
    // 魔物
    for (const m of G.mons) {
      if (m.dead) continue; const my = m.y + (m.fly ? 0 : m.r * 0.8), dx = c.x - m.x, dy = c.y - my, d = Math.hypot(dx, dy), rr = CR + m.r;
      if (d < rr && d > 0) {
        if (c.fire) { if (m.hitCd <= 0) { hurtMon(m, 4); c.combo++; } continue; }
        const nx = dx / d, ny = dy / d; c.x = m.x + nx * rr; c.y = my + ny * rr; const vn = c.vx * nx + c.vy * ny;
        if (vn < 0) { c.vx -= 1.6 * vn * nx; c.vy -= 1.6 * vn * ny; if (m.hitCd <= 0) { hurtMon(m, -vn > 5 ? 2 : 1); c.combo++; G.maxCombo = Math.max(G.maxCombo, c.combo); } }
      }
    }
    // 止まってしまったら、少し押す
    const sp = Math.hypot(c.vx, c.vy);
    if (sp < 0.35 && c.gT < 0.1) { c.slowT += h; if (c.slowT > 1.2) { c.slowT = 0; const r = RAILS[c.ground]; c.vx += (r ? r.d : 1) * 2.2; c.vy += 2; } } else c.slowT = 0;
    if (c.y < -3) removeCoin(c);
  }
  // コインどうし
  const L = G.coins.filter(c => !c.dead && !c.fall);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= CR * 2 || d === 0) continue;
    const nx = dx / d, ny = dy / d, ov = CR * 2 - d; a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { const imp = -rv * 0.9; a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny; if (imp > 1.5) sfx('coin2'); }
  }
}
function collideSeg(c, ax, ay, bx, by, th, e) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; let t = ((c.x - ax) * dx + (c.y - ay) * dy) / L2; t = clamp(t, 0, 1);
  const px = ax + dx * t, py = ay + dy * t; let nx = c.x - px, ny = c.y - py; const d = Math.hypot(nx, ny), rr = CR + th;
  if (d >= rr || d === 0) return 0; nx /= d; ny /= d; c.x = px + nx * rr; c.y = py + ny * rr;
  const vn = c.vx * nx + c.vy * ny; if (vn < 0) { c.vx -= (1 + e) * vn * nx; c.vy -= (1 + e) * vn * ny; return -vn; } return 0;
}
function coinFell(c, gp) {
  c.fall = 0.001; c.fx = gp.cx; c.fy = railY(RAILS[gp.ri], gp.cx) - 0.62; G.fell++; sfx('fall'); haptic(30);
  G.boss = Math.min(G.bossMax, G.boss + 1);
  P.burst(V(c.fx, c.fy, 0.3), 0x9a5cff, 24, 3, { grav: -2 }); floatText(V(c.fx, c.fy + 0.6, 1), 'はずれ… ボス回復 +1', 'bad');
  if (bossObj) bossObj.heal = 0.6;
}
function goal(c) {
  const fire = c.fire, dmg = (3 + c.combo) * (fire ? 2 : 1); removeCoin(c);
  G.goals++; G.hand = Math.min(HAND_MAX, G.hand + 1); addMana(1.5);
  sfx('flick'); P.burst(V(0, 0.4, 0.6), 0xffe28a, 40, 7, { vy: 4 }); G.slow = 0.3; flash('rgba(255,240,180,.25)');
  floatText(V(0, 1.6, 1), '当たり!', 'kill');
  G.beams.push({ t: 0, dmg, fire, combo: c.combo });
}
function bossHit(f) {
  G.boss = Math.max(0, G.boss - f.dmg); sfx('goal'); haptic(40); G.shake = Math.max(G.shake, 0.4 + Math.min(0.5, f.dmg * 0.02)); flash(f.fire ? 'rgba(255,120,60,.4)' : 'rgba(255,240,180,.45)');
  const bp = bossObj.g.position.clone(); bp.y += 2.5; bp.z += 1;
  P.burst(bp, f.fire ? 0xff6a2c : 0xffd36e, 60, 11, { spread: 1.5 }); P.burst(bp, 0xffffff, 26, 7);
  floatText(bp, `${f.dmg}`, 'big' + (f.combo >= 4 ? ' crit' : ''));
  if (f.combo >= 3) banner(`<b>${f.combo} COMBO!</b><small>穴を飛びこえ、魔物を倒すほど強くなる</small>`, 'combo', 1000);
  bossObj.flash = 0.3; if (bossObj.body && bossObj.body.userData.play) bossObj.body.userData.play('Hit_A', 600);
  if (mage) mage.play('Cheer');
  if (!G.half && G.boss <= G.bossMax / 2 && G.boss > 0) { G.half = true; bgm.intense = 1; setTimeout(() => { if (G && !G.over) { G.cut = { t: 1.5, t0: 1.5, k: 'half', line: G.st.lines.half, boss: true }; showCut(); sfx('boss'); } }, 700); }
  if (G.boss <= 0) win();
}

// ── 毎フレーム
let last = performance.now(), clock = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
  for (const m of mixers) m.update(dt);
  P.update(dt);
  if (G && world && G.levers) step(dt);
  const pos = camBase.pos.clone(), look = camBase.look.clone();
  if (G && G.cut && G.cut.boss && bossObj) { const k = clamp(Math.min((G.cut.t0 - G.cut.t) * 4, G.cut.t * 4), 0, 1), bp = bossObj.g.position; pos.lerp(V(bp.x + 1.5, bp.y + 3.2, bp.z + 13), k); look.lerp(V(bp.x, bp.y + 2.4, bp.z), k); }
  if (G && G.shake > 0) { pos.x += (Math.random() - 0.5) * G.shake; pos.y += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt * 1.6); }
  cam.position.copy(pos); cam.lookAt(look);
  if (G && G.clouds) for (const o of G.clouds) { o.position.x += o.userData.cloud * dt; if (o.position.x > 40) o.position.x = -40; }
  R.render(scene, cam);
}
function step(dt) {
  const ef = G.ef;
  if (G.cut) { G.cut.t -= dt; if (G.cut.t <= 0) { const k = G.cut.k; G.cut = null; hideCut(); if (BOSS_SKILL[k]) applyBossSkill(k); if (k === 'half') for (let i = 0; i < 4; i++) setTimeout(() => spawnMon(pick(G.st.mons)), i * 600); } animWorld(dt); return; }
  if (G.over || G.paused) { animWorld(dt); return; }
  const d = dt * (G.slow > 0 ? 0.4 : 1); G.slow -= dt; G.t += d;
  const hadBridge = ef.bridge > 0;
  for (const k in ef) if (ef[k] > 0) ef[k] -= d;
  for (const L of G.levers) { L.cd -= d; L.hit = Math.max(0, L.hit - dt * 5); }
  if (G.hand < HAND_MAX) { G.regen += d; if (G.regen >= REGEN) { G.regen = 0; G.hand++; sfx('return'); renderCtrl(); } } else G.regen = 0;
  // 穴の動き・一時的な穴
  let moved = hadBridge !== (ef.bridge > 0);
  for (const g of G.gaps) { if (g.mv) { g.t = g.t0 + Math.sin(G.t * g.sp + g.ph) * g.mv; moved = true; } if (g.grow < 1) { g.grow = Math.min(1, g.grow + d * 1.6); moved = true; } if (g.temp) { g.life -= d; if (g.life <= 0) { world.remove(g.g); g.dead = true; moved = true; } } if (!g.dead) placeGap(g); }
  if (moved) { G.gaps = G.gaps.filter(g => !g.dead); updateRailTiles(); }
  if (ef.quake > 0) { G.quakeT -= d; if (G.quakeT <= 0) { G.quakeT = 0.5; G.shake = 0.5; for (const c of G.coins) if (!c.dead && !c.fall) { c.vy += rand(3, 5.5); c.vx += rand(-1.5, 1.5); } } }
  const n = Math.ceil(d / (1 / 240)), h = d / n; for (let i = 0; i < n; i++) physics(h);
  G.coins = G.coins.filter(c => !c.dead);
  // 当たり → 光の柱がボスへ
  for (const b of G.beams) { b.t += dt * 2.2; if (b.t >= 1 && !b.done) { b.done = true; if (bossObj) bossHit(b); } }
  // 魔物
  const frozen = ef.time > 0;
  for (const m of G.mons) {
    if (m.dead) continue; m.hitCd -= d; m.flash = (m.flash || 0) - d;
    if (!frozen) { m.s += m.sp * d * (m.drop ? 3 : 1); monPos(m); }
    if (m.s >= PATH.L - 0.05) {
      if (ef.guard > 0) { killMon(m, false); P.burst(V(m.x, m.y + 0.5, 0.6), 0x7cc7ff, 24, 5); sfx('crack'); continue; }
      killMon(m, false); G.castle = Math.max(0, G.castle - m.dmg); sfx('hurt'); haptic(60); G.shake = 0.6; flash('rgba(255,40,60,.4)', 360);
      floatText(V(0, 0.6, 1), `城に −${m.dmg}`, 'bad'); P.burst(V(0, 0.3, 0.6), 0xff4d5e, 30, 6); if (mage) mage.play('Hit_A'); renderCtrl();
      if (G.castle <= 0) lose();
    }
  }
  G.mons = G.mons.filter(m => !m.dead);
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
    if (c.fall) { const k = c.fall; c.mesh.position.set(c.x + (c.fx - c.x) * k, c.y + (c.fy - c.y) * k, 0.3 - k * 0.6); c.mesh.scale.setScalar(1 - k * 0.8); c.mesh.rotation.z += dt * 14; continue; }
    c.mesh.position.set(c.x, c.y, 0.3); c.rot -= c.vx * dt / CR; c.mesh.rotation.z = c.rot;
    c.trail -= dt; if (c.trail <= 0) { c.trail = 0.04; P.burst(V(c.x, c.y, 0.1), c.fire ? 0xff6a2c : c.combo >= 3 ? 0xffb0ff : 0xffd36e, c.fire ? 3 : 1, 0.5, { life: 0.35, grav: 0 }); }
  }
  for (const b of G.beams) {
    if (!b.mesh) { b.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: b.fire ? 0xff7a3c : 0xffe28a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); world.add(b.mesh); }
    const top = bossObj ? bossObj.g.position.y + 2.4 : TOP + 3, k = Math.min(1, b.t), y1 = 0.4 + (top - 0.4) * k;
    b.mesh.position.set(0, (0.4 + y1) / 2, 1.2); b.mesh.scale.set(1 + Math.sin(clock * 40) * 0.2, Math.max(0.01, y1 - 0.4), 1); b.mesh.material.opacity = b.done ? Math.max(0, b.mesh.material.opacity - dt * 3) : 0.85;
    if (!b.done) P.burst(V(rand(-0.3, 0.3), y1, 1.2), b.fire ? 0xff7a3c : 0xffe28a, 3, 2, { life: 0.4, grav: 0 });
    if (b.done && b.mesh.material.opacity <= 0) { world.remove(b.mesh); b.gone = true; }
  }
  G.beams = G.beams.filter(b => !b.gone);
  for (const g of G.gaps) g.sw.rotation.z -= dt * 2.5;
  if (mats.bridge) mats.bridge.opacity = ef.bridge > 0 ? 0.6 + Math.sin(clock * 8) * 0.15 : 0;
  for (const L of G.levers) { L.arm.rotation.z = L.side * (0.5 - L.hit * 1.4); L.hammer.position.x = L.side * (HW - 0.12 - L.hit * 0.25); L.lamp.material.color.setHex(L.cd > 0 ? 0xff7a3c : 0xffd36e); }
  G.cannon.rotation.z += dt * 0.8; G.slotGlow.material.color.setHex(G.hand > 0 ? 0xffd36e : 0x553311);
  G.shieldMesh.material.opacity = ef.shield > 0 ? 0.5 + Math.sin(clock * 6) * 0.15 : 0;
  G.guardMesh.material.opacity = ef.guard > 0 ? 0.35 + Math.sin(clock * 7) * 0.1 : 0;
  if (ef.wind > 0 && Math.random() < 0.6) P.burst(V(G.windDir < 0 ? HW : -HW, rand(1, TOP), 0.6), 0xddeeff, 1, 0, { vx: G.windDir * 12, life: 0.8, grav: 0 });
  for (const m of G.mons) { if (m.dead) continue; m.g.position.set(m.x, m.y, 0.35); const t = clock * 5 + m.ph;
    if (m.type === 'slime') { m.g.position.y += Math.abs(Math.sin(t)) * 0.2; m.parts.body.scale.set(1 + Math.sin(t * 2) * 0.08, 0.75 - Math.sin(t * 2) * 0.06, 0.9); }
    if (m.type === 'bat') { m.parts.wings.forEach((w, i) => w.rotation.y = (i ? -1 : 1) * Math.sin(t * 3) * 0.8); m.g.position.y += Math.sin(t) * 0.12; }
    if (m.type === 'golem') m.g.rotation.z = Math.sin(t * 0.8) * 0.06;
    m.g.rotation.y = (m.dir || 0) * 0.6;
    m.fg.scale.x = Math.max(0.001, m.hp / m.max); m.fg.position.x = -0.43 * (1 - m.hp / m.max); m.bar.quaternion.copy(cam.quaternion);
    m.g.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(m.flash > 0 ? 0xffffff : 0x000000); }); }
  if (bossObj) { if (bossObj.anim) bossObj.anim(clock); bossObj.aura.rotation.z += dt * 0.6; bossObj.flash = Math.max(0, bossObj.flash - dt); bossObj.heal = Math.max(0, (bossObj.heal || 0) - dt);
    for (const m of bossObj.mats) { if (!m.userData.e0) m.userData.e0 = { c: m.emissive.getHex(), i: m.emissiveIntensity }; if (bossObj.flash > 0) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 1.2; } else if (bossObj.heal > 0) { m.emissive.setHex(0x9a5cff); m.emissiveIntensity = 1; } else { m.emissive.setHex(m.userData.e0.c); m.emissiveIntensity = m.userData.e0.i * (G.half ? 1.6 + Math.sin(clock * 6) * 0.4 : 1); } } }
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
  if (!G || G.over) { $('#ctrl').innerHTML = ''; ctrlKey = ''; placeLeverButtons(); return; }
  const k = [G.hand, Math.floor(G.mana * 4), G.castle, G.fire > 0].join(','); if (k === ctrlKey) return; ctrlKey = k;
  $('#ctrl').innerHTML = `<div class="skills">${Object.entries(SKILLS).map(([k, S]) => `<button class="sk ${G.mana >= S.cost ? 'ok' : ''}" data-a="skill" data-k="${k}">${img(S.icon)}<b>${S.name}</b><small>${img('o_crystal', 'mc')}${S.cost}</small></button>`).join('')}</div>
    <div class="bot"><div class="mid"><div class="hand">${Array.from({ length: HAND_MAX }, (_, i) => `<span class="${i < G.hand ? 'on' : ''}">${img('coin')}</span>`).join('')}</div>
      <div class="regen"><i style="width:${G.hand >= HAND_MAX ? 100 : G.regen / REGEN * 100}%"></i></div>
      <div class="castle">${img('o_house')}<div class="hearts">${Array.from({ length: G.castleMax }, (_, i) => `<i class="${i < G.castle ? 'on' : ''}"></i>`).join('')}</div></div>
      <div class="mana">${img('o_crystal')}<div class="mb">${Array.from({ length: MANA_MAX }, (_, i) => `<i class="${i < Math.floor(G.mana) ? 'on' : ''}"></i>`).join('')}</div></div></div>
    <button class="insert ${G.hand > 0 ? '' : 'empty'} ${G.fire > 0 ? 'fire' : ''}" data-a="insert">${img('coin', 'ins')}<b>コインを入れる</b><small>のこり ${G.hand}</small></button></div>`;
}
function showCut() {
  const c = G.cut, st = G.st, S = BOSS_SKILL[c.k];
  $('#cut').innerHTML = `<div class="cutin ${c.boss ? 'boss' : ''}"><div class="band"></div><div class="ct"><small>${st.boss.name}</small><b>「${c.line}」</b>${S ? `<div class="csk">${img(S.icon)}<span>${S.name}</span><em>${S.text}</em></div>` : ''}</div></div>`;
}
function hideCut() { const el = $('#cut .cutin'); if (el) { el.classList.add('out'); setTimeout(() => { if (!G || !G.cut) $('#cut').innerHTML = ''; }, 260); } }

// ── 勝ち・負け
function win() {
  if (G.over) return; G.over = 'win';
  const stars = G.castle >= 8 ? 3 : G.castle >= 4 ? 2 : 1; save.stars[G.st.id] = Math.max(save.stars[G.st.id] || 0, stars); storeSave();
  const bp = bossObj.g.position.clone(); bp.y += 2.5; bp.z += 1;
  for (let i = 0; i < 6; i++) setTimeout(() => { P.burst(bp.clone().add(V(rand(-2, 2), rand(-1, 2), 0)), pick([0xffd36e, 0xff6a2c, 0xffffff, 0xc79bff]), 50, 10); G.shake = 0.6; sfx('goal'); }, i * 220);
  setTimeout(() => { if (bossObj.body) bossObj.body.visible = false; P.burst(bp, 0xffffff, 120, 14, { spread: 2 }); flash('rgba(255,255,255,.8)', 500); }, 1400);
  banner(`<b>「${G.st.lines.win}」</b>`, 'boss', 1500);
  setTimeout(() => { sfx('win'); showResult(true, stars); }, 2600);
  renderCtrl();
}
function lose() { if (G.over) return; G.over = 'lose'; sfx('lose'); flash('rgba(40,0,20,.6)', 800); renderCtrl(); setTimeout(() => showResult(false, 0), 1400); }
function showResult(won, stars) {
  bgm.intense = 0; const next = won && G.si + 1 < STAGES.length;
  $('#screen').innerHTML = `<div class="result ${won ? 'win' : 'lose'}"><div class="rcard">
    <div class="rt">${won ? 'VICTORY' : 'DEFEAT'}</div><div class="rs">${won ? `${G.st.boss.name}をたおした!` : '城が落とされた…'}</div>
    ${won ? `<div class="stars">${[0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.25}s"></i>`).join('')}</div><div class="rnote">星は城の守り: 残り${G.castle}/${G.castleMax}</div>` : ''}
    <div class="stats"><div><b>${G.goals}</b><small>当たり</small></div><div><b>${G.jumps}</b><small>穴をとびこえた</small></div><div><b>${G.kills}</b><small>魔物をたおした</small></div><div><b>${G.fell}</b><small>はずれ(穴に落ちた)</small></div></div>
    <div class="rbtns">${next ? `<button class="btn go" data-a="start" data-i="${G.si + 1}">次のステージへ</button>` : ''}<button class="btn ${next ? '' : 'go'}" data-a="start" data-i="${G.si}">もう一度</button><button class="btn" data-a="title">タイトルへ</button></div></div></div>`;
}

// ── タイトル・あそびかた
const HOW = [
  { t: 'コインを入れる', b: '下の<b>「コインを入れる」</b>を押すと、左上からルーンコインが入って、ジグザグのレールを転がり落ちていく。', ic: 'coin' },
  { t: 'レバーで穴を飛びこえる', b: 'レールの<b>穴</b>に落ちると「はずれ」でボスが回復。コインが穴に来る前に、<b>その段のレバー</b>を押してはね上げよう。画面のその高さをさわってもレバーが動く。', ic: 'o_ruin' },
  { t: '一番下に届けば「当たり」', b: '下の<b>魔法砲</b>まで届くと、光の柱がボスに命中。穴を飛びこえたり魔物を倒したりするほど<b>コンボ</b>で強くなる。', ic: 'o_star' },
  { t: '城を守り、スキルで逆転', b: '魔物が同じ道を<b>城へ下りてくる</b>。コインをぶつけて倒そう。倒すと<b>マナ</b>がたまってスキルが使える。ボスも技でじゃまをしてくる。', ic: 'o_crystal' },
];
function showTitle() {
  if (G) G.over = 'title'; hudKey = ''; $('#hud').innerHTML = ''; renderCtrl(); $('#cut').innerHTML = ''; bgm.play('title'); bgm.intense = 0;
  const unlocked = (i) => i === 0 || (save.stars[STAGES[i - 1].id] || 0) > 0;
  $('#screen').innerHTML = `<div class="title"><div class="logo"><small>ファンタジー 十円ゲーム</small><b>ルーンはじき</b><span>魔王城への道</span></div>
    <div class="stages">${STAGES.map((s, i) => `<button class="stg s-${s.id} ${unlocked(i) ? '' : 'lock'}" data-a="start" data-i="${i}" ${unlocked(i) ? '' : 'disabled'}><small>${s.sub}</small><b>${s.name}</b><span>ボス: ${s.boss.name}</span><div class="stars sm">${[0, 1, 2].map(k => `<i class="${k < (save.stars[s.id] || 0) ? 'on' : ''}"></i>`).join('')}</div>${unlocked(i) ? '' : '<em>前のステージをクリアで解放</em>'}</button>`).join('')}</div>
    <div class="tbtns"><button class="btn" data-a="how">あそびかた</button><button class="btn" data-a="snd">${audioPref().bgm ? '音楽 ON' : '音楽 OFF'}</button></div>
    <a class="back" href="../">商会バトルへ</a></div>`;
  titleBg();
}
async function titleBg() { if (!world || !G || G.st.id !== 'forest') { G = newGame(0); G.over = 'title'; await buildWorld(STAGES[0]); } G.over = 'title'; placeLeverButtons(); }
function showHow(i = 0) {
  const H2 = HOW[i];
  $('#screen').insertAdjacentHTML('beforeend', `<div class="how" id="how"><div class="hcard"><div class="hn">${i + 1} / ${HOW.length}</div>${img(H2.ic, 'hic')}<b>${H2.t}</b><p>${H2.b}</p>
    <div class="hbtns">${i ? `<button class="btn" data-a="howgo" data-i="${i - 1}">もどる</button>` : ''}<button class="btn go" data-a="${i < HOW.length - 1 ? 'howgo' : 'howend'}" data-i="${i + 1}">${i < HOW.length - 1 ? 'つぎへ' : 'はじめる'}</button></div></div></div>`);
}
async function start(i) {
  unlockAudio(); $('#screen').innerHTML = ''; const st = STAGES[i];
  $('#loading').classList.add('on'); $('#levers').innerHTML = '';
  G = newGame(i); await buildWorld(st); $('#loading').classList.remove('on');
  bgm.play(st.bgm); hudKey = ''; ctrlKey = ''; renderHud(); placeLeverButtons();
  G.cut = { t: 2, t0: 2, k: 'intro', line: st.lines.intro, boss: true }; showCut(); sfx('boss');
  banner(`<small>${st.sub}</small><b>${st.name}</b>`, 'stage', 1800);
}

// ── ボタン
const ACT = {
  start: (d) => start(+d.i), title: () => showTitle(),
  how: () => showHow(0), howgo: (d) => { $('#how')?.remove(); showHow(+d.i); },
  howend: () => { $('#how')?.remove(); try { localStorage.setItem('rune-how2', '1'); } catch (e) { } if (showHow.pending != null) { const i = showHow.pending; showHow.pending = null; start(i); } },
  snd: () => { setAudioPref('bgm', !audioPref().bgm); unlockAudio(); showTitle(); },
  skill: (d) => useSkill(d.k), lever: (d) => lever(+d.i), insert: () => insertCoin(),
  pause: () => { if (!G || G.over) return; G.paused = true; $('#screen').innerHTML = `<div class="result"><div class="rcard"><div class="rt sm">一時停止</div><div class="rbtns"><button class="btn go" data-a="resume">つづける</button><button class="btn" data-a="how">あそびかた</button><button class="btn" data-a="start" data-i="${G.si}">やりなおす</button><button class="btn" data-a="title">タイトルへ</button></div></div></div>`; },
  resume: () => { $('#screen').innerHTML = ''; G.paused = false; last = performance.now(); },
};
const FAST = new Set(['lever', 'skill', 'insert']);
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
  if (FAST.has(a)) { e.preventDefault(); unlockAudio(); ACT[a](b.dataset); }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a; if (FAST.has(a)) return;
  unlockAudio(); sfx('tap');
  if (a === 'start') { let seen = false; try { seen = localStorage.getItem('rune-how2') === '1'; } catch (e) { } if (!seen) { showHow.pending = +b.dataset.i; showHow(0); return; } }
  if (ACT[a]) ACT[a](b.dataset);
});
// パソコン: スペースでコイン、1〜5でレバー
addEventListener('keydown', (e) => { if (e.repeat) return; if (e.key === ' ') insertCoin(); const n = +e.key; if (n >= 1 && n <= NR) lever(n - 1); });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ── はじまり
(async () => {
  const lv = document.createElement('div'); lv.id = 'levers'; document.body.appendChild(lv);
  requestAnimationFrame(frame);
  await titleBg(); $('#loading').classList.remove('on');
  showTitle();
  window.__rune = { get G() { return G; }, start, lever, insertCoin, useSkill, STAGES, RAILS, spawnMon, bossCast, tick: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) step(dt); } };
})();
