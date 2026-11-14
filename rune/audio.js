// ルーンはじき: 効果音とBGM(すべてその場で合成。素材ファイルなし)
let ctx = null, master = null, sfxBus = null, bgmBus = null, verb = null;
const PREF = 'rune-audio';
const pref = (() => { try { return JSON.parse(localStorage.getItem(PREF) || '{}'); } catch (e) { return {}; } })();
export const audioPref = () => ({ bgm: pref.bgm !== false, sfx: pref.sfx !== false });
export function setAudioPref(k, v) { pref[k] = v; try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) { } if (k === 'bgm') { if (v) bgm.start(); else bgm.stop(); } }

function impulse(sec = 2.2) { const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); } return b; }
export function unlockAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createDynamicsCompressor(); master.threshold.value = -10; master.ratio.value = 3; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 2.2; sfxBus.connect(master);
      bgmBus = ctx.createGain(); bgmBus.gain.value = 0.0001; bgmBus.connect(master);
      verb = ctx.createConvolver(); verb.buffer = impulse(); const vg = ctx.createGain(); vg.gain.value = 0.32; verb.connect(vg).connect(master);
    }
    if (ctx.state !== 'running') ctx.resume();
    iosPlayback();
    if (audioPref().bgm && !bgm.on) bgm.start();
  } catch (e) { }
}
// iPhoneのマナーモードでも鳴るように: 無音の<audio>を流して「再生」扱いにする
let silentEl = null;
function iosPlayback() {
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { }
  if (silentEl) { if (silentEl.paused) silentEl.play().catch(() => { }); return; }
  const sr = 8000, n = sr / 2, buf = new ArrayBuffer(44 + n), v = new DataView(buf); const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  silentEl = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.volume = 0.01; silentEl.play().catch(() => { });
}
if (typeof document !== 'undefined') {
  ['touchend', 'pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (ctx && (ctx.state !== 'running' || (audioPref().bgm && !bgm.on))) unlockAudio(); }, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else { ctx.resume(); if (silentEl && silentEl.paused) silentEl.play().catch(() => { }); } });
}
export function haptic(ms = 8) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }

// ── 音の部品
const now = () => ctx.currentTime;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function send(g, wet) { if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(verb); } }
function tone(f, t, dur, type, vol, bus, f2, wet = 0.2, att = 0.005) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0005, t + att + dur);
  o.connect(g); g.connect(bus); send(g, wet); o.start(t); o.stop(t + att + dur + 0.05);
}
let noiseBuf = null;
function noise(t, dur, vol, freq, q, bus, type = 'bandpass', wet = 0, f2) {
  if (!noiseBuf) { const n = ctx.sampleRate, b = ctx.createBuffer(1, n, n), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseBuf = b; }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); f.Q.value = q; const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  s.connect(f).connect(g).connect(bus); send(g, wet); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const pluckCache = new Map();
function pluckBuf(m, bright = 0.5) {
  const key = m + ':' + bright; if (pluckCache.has(key)) return pluckCache.get(key);
  const sr = ctx.sampleRate, f = mtof(m), N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * 1.4), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  let lp = 0; for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; lp = lp + (r - lp) * (0.3 + bright * 0.6); d[i] = lp; }
  let mx = 0; for (let i = 0; i < N; i++) mx = Math.max(mx, Math.abs(d[i])); for (let i = 0; i < N; i++) d[i] /= mx || 1;
  const decay = 0.996 - Math.max(0, m - 60) * 0.0003;
  for (let i = N; i < len; i++) d[i] = (d[i - N] + d[i - N + 1]) * 0.5 * decay;
  pluckCache.set(key, b); return b;
}
function pluck(m, t, vol, bus, wet = 0.25, bright = 0.5, dur = 1.2) {
  const s = ctx.createBufferSource(); s.buffer = pluckBuf(m, bright); const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.25);
  s.connect(g).connect(bus); send(g, wet); s.start(t); s.stop(t + dur + 0.3);
}
const jit = () => 1 + (Math.random() - 0.5) * 0.08;
// 金属の「チン」: 硬貨らしい倍音
function tink(t, vol, base) { const j = jit(); [1, 2.76, 5.4, 8.93].forEach((h, i) => tone(base * h * j, t, 0.08 + 0.25 / (i + 1), 'sine', vol / (i + 1.3), sfxBus, null, 0.25, 0.001)); }

// ── 効果音
export function sfx(k, a = 1) {
  if (!ctx || !audioPref().sfx) return;
  try {
    const t = now(), j = jit();
    switch (k) {
      case 'tap': noise(t, 0.025, 0.18, 2600 * j, 3, sfxBus); tone(1200 * j, t, 0.05, 'sine', 0.06, sfxBus, 1500 * j, 0.05); break;
      case 'aim': tone(300 + a * 900, t, 0.04, 'sine', 0.025, sfxBus, null, 0); break;
      case 'flick': noise(t, 0.22, 0.25, 900, 0.7, sfxBus, 'bandpass', 0.1, 4000); tink(t, 0.07, 1500); tone(180, t, 0.08, 'sine', 0.2, sfxBus, 70, 0); break;
      case 'wall': tink(t, Math.min(0.09, 0.03 + a * 0.004), 1800 + Math.random() * 500); break;
      case 'coin2': tink(t, 0.05, 2300); break;
      case 'bump': [76, 83].forEach((m, i) => pluck(m + Math.floor(a % 5) * 2, t + i * 0.03, 0.22, sfxBus, 0.35, 0.9, 0.9)); tone(mtof(88 + (a % 5) * 2), t, 0.4, 'sine', 0.04, sfxBus, null, 0.4); break;
      case 'kick': tone(140, t, 0.12, 'sine', 0.3, sfxBus, 60, 0); noise(t, 0.12, 0.2, 1200, 1, sfxBus, 'bandpass', 0.1, 3500); tone(600, t + 0.02, 0.15, 'triangle', 0.05, sfxBus, 1300, 0.1); break;
      case 'kickair': noise(t, 0.08, 0.08, 900, 1, sfxBus); tone(120, t, 0.08, 'sine', 0.12, sfxBus, 60, 0); break;
      case 'fall': tone(900, t, 0.7, 'triangle', 0.08, sfxBus, 90, 0.5); noise(t, 0.6, 0.06, 1500, 2, sfxBus, 'bandpass', 0.5, 200); break;
      case 'return': tone(900 * j, t, 0.06, 'sine', 0.05, sfxBus, 1300, 0.1); tone(1350 * j, t + 0.06, 0.1, 'sine', 0.04, sfxBus, null, 0.15); break;
      case 'goal': { tone(90, t, 0.5, 'sine', 0.4, sfxBus, 40, 0); noise(t, 0.6, 0.35, 700, 0.6, sfxBus, 'lowpass', 0.3, 120);
        [72, 76, 79, 84].forEach((m, i) => { pluck(m, t + 0.05 + i * 0.06, 0.25, sfxBus, 0.4, 0.85, 1); tone(mtof(m + 12), t + 0.05 + i * 0.06, 0.4, 'square', 0.02, sfxBus, null, 0.3); }); break; }
      case 'hit': noise(t, 0.08, 0.25, 500 * j, 1, sfxBus); tone(260 * j, t, 0.1, 'square', 0.05, sfxBus, 120, 0); break;
      case 'kill': tone(500 * j, t, 0.12, 'sine', 0.12, sfxBus, 1500 * j, 0.1); [84, 88, 91].forEach((m, i) => pluck(m, t + 0.05 + i * 0.04, 0.12, sfxBus, 0.3, 0.9, 0.6)); noise(t, 0.15, 0.15, 3000, 1, sfxBus, 'highpass'); break;
      case 'hurt': tone(110, t, 0.4, 'sawtooth', 0.12, sfxBus, 55, 0.1); noise(t, 0.4, 0.3, 300, 0.8, sfxBus, 'lowpass', 0.2); break;
      case 'skill': for (let i = 0; i < 6; i++) tone(mtof(79 + [0, 4, 7, 12, 16, 19][i]), t + i * 0.035, 0.35, 'sine', 0.05, sfxBus, null, 0.5); noise(t, 0.5, 0.08, 6000, 1, sfxBus, 'highpass', 0.5); break;
      case 'boss': tone(55, t, 1.1, 'sawtooth', 0.14, sfxBus, 41, 0.3, 0.05); tone(82, t, 1.1, 'sawtooth', 0.08, sfxBus, 61, 0.3, 0.05); noise(t, 1, 0.15, 200, 1, sfxBus, 'lowpass', 0.4); [63, 62].forEach((m, i) => tone(mtof(m), t + 0.2 + i * 0.3, 0.3, 'square', 0.03, sfxBus, null, 0.4)); break;
      case 'wind': noise(t, 1.6, 0.18, 500, 0.4, sfxBus, 'bandpass', 0.3, 1800); break;
      case 'quake': for (let i = 0; i < 3; i++) { tone(60, t + i * 0.25, 0.3, 'sine', 0.35, sfxBus, 30, 0); noise(t + i * 0.25, 0.3, 0.25, 150, 1, sfxBus, 'lowpass'); } break;
      case 'pit': tone(200, t, 0.9, 'sawtooth', 0.06, sfxBus, 50, 0.5); noise(t, 0.9, 0.12, 400, 2, sfxBus, 'bandpass', 0.5, 80); break;
      case 'shield': [60, 63, 67, 70].forEach((m, i) => tone(mtof(m), t + i * 0.05, 0.6, 'triangle', 0.04, sfxBus, null, 0.5)); break;
      case 'crack': noise(t, 0.2, 0.35, 2500, 1, sfxBus, 'highpass'); tink(t, 0.06, 1200); break;
      case 'mana': tone(mtof(84 + (a % 4) * 3), t, 0.15, 'sine', 0.04, sfxBus, null, 0.3); break;
      case 'win': [[72, 0], [76, 0.12], [79, 0.24], [84, 0.4], [79, 0.55], [84, 0.7]].forEach(([m, d]) => { pluck(m, t + d, 0.3, sfxBus, 0.4, 0.8, 1.4); tone(mtof(m), t + d, 0.3, 'square', 0.025, sfxBus, null, 0.3); }); break;
      case 'lose': [[67, 0], [63, 0.2], [60, 0.4], [55, 0.65]].forEach(([m, d]) => pluck(m, t + d, 0.28, sfxBus, 0.4, 0.4, 1.4)); break;
    }
  } catch (e) { }
}

// ── BGM: 4小節の和音進行 + 覚えやすい短いメロディを回す
const TRACKS = {
  title: { bpm: 104, key: 60, ch: '0M 9m 5M 7M', mel: '7 . 9 7 4 . 2 4 | 5 . 4 2 0 . . . | 4 . 5 7 9 . 7 . | 7 9 11 12 11 . 7 .', drum: 0.5, lead: 'flute' },
  forest: { bpm: 132, key: 57, ch: '0m 8M 3M 10M', mel: '12 . 10 12 15 . 12 . | 10 . 8 7 8 . . . | 7 . 8 10 12 . 10 8 | 7 . 3 5 7 . . .', drum: 1, lead: 'pluck' },
  crypt: { bpm: 124, key: 50, ch: '0m 0m 10M 8M', mel: '12 . 13 . 12 10 8 7 | 8 . . 7 5 . . . | 7 . 8 . 10 . 12 . | 13 . 12 10 12 . . .', drum: 0.9, lead: 'bell' },
  maou: { bpm: 150, key: 52, ch: '0m 1M 0m 10M', mel: '12 12 . 13 12 . 10 . | 12 . 7 . 8 . 10 . | 12 12 . 13 15 . 13 12 | 13 . 12 . 10 . 7 .', drum: 1.2, lead: 'saw' },
};
const parsed = {};
function parse(k) {
  if (parsed[k]) return parsed[k]; const T = TRACKS[k];
  const ch = T.ch.split(' ').map(c => { const r = parseInt(c), q = c.slice(-1); return [r, r + (q === 'M' ? 4 : 3), r + 7]; });
  const mel = T.mel.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  return (parsed[k] = { T, ch, mel });
}
function lead(kind, m, t, len, vol) {
  if (kind === 'pluck') { pluck(m, t, vol * 2.4, bgmBus, 0.3, 0.75, Math.max(0.4, len * 1.3)); return; }
  if (kind === 'bell') { [1, 2.01, 3.98].forEach((h, i) => tone(mtof(m) * h, t, len + 0.6, 'sine', vol * [1.1, 0.4, 0.15][i], bgmBus, null, 0.5, 0.002)); return; }
  if (kind === 'saw') { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(900, t + len); f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 0.9, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + len + 0.08); o.connect(f).connect(g).connect(bgmBus); send(g, 0.3); o.start(t); o.stop(t + len + 0.1); return; }
  const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'sine'; o.frequency.value = mtof(m);
  lfo.frequency.value = 5.2; lg.gain.value = mtof(m) * 0.007; lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0005, t + len + 0.2); o.connect(g).connect(bgmBus); send(g, 0.4);
  for (const x of [o, lfo]) { x.start(t); x.stop(t + len + 0.25); }
}
export const bgm = {
  on: false, track: 'title', want: 'title', next: 0, step: 0, bar: 0, timer: null, loops: 0, intense: 0,
  start() { if (!ctx) return; this.on = true; bgmBus.gain.cancelScheduledValues(now()); bgmBus.gain.setTargetAtTime(1.9, now(), 0.6); if (!this.timer) { this.next = now() + 0.1; this.timer = setInterval(() => this.tick(), 50); } },
  stop() { this.on = false; if (bgmBus) { bgmBus.gain.cancelScheduledValues(now()); bgmBus.gain.setTargetAtTime(0.0001, now(), 0.3); } },
  play(k) { if (TRACKS[k]) this.want = k; },
  tick() { if (!ctx || !this.on || ctx.state !== 'running') return; try { this._tick(); } catch (e) { this.next = now() + 0.2; } },
  _tick() {
    if (this.next < now() - 1) this.next = now() + 0.05;
    while (this.next < now() + 0.3) {
      if (this.step === 0 && this.bar % 2 === 0 && this.want !== this.track) { bgmBus.gain.setTargetAtTime(0.0001, Math.max(now(), this.next - 0.3), 0.1); this.track = this.want; this.bar = 0; this.loops = 0; this.next += 0.4; bgmBus.gain.setTargetAtTime(1.9, this.next, 0.2); continue; }
      const P = parse(this.track), spb = 60 / P.T.bpm / 2 / (this.intense ? 0.92 : 1);
      this.play1(P, this.next, spb);
      this.next += spb; this.step++;
      if (this.step >= 8) { this.step = 0; this.bar++; if (this.bar >= 8) { this.bar = 0; this.loops++; } }
    }
  },
  play1(P, t, spb) {
    const T = P.T, step = this.step, ch = P.ch[this.bar % 4], root = T.key - 12, d = T.drum;
    // ベース: 8分で刻む(戦闘曲は休みなし)
    if (step % 2 === 0 || T.bpm > 140) tone(mtof(root + ch[0] - 12 + (step === 6 ? 7 : 0)), t, spb * 0.9, 'triangle', 0.12, bgmBus, null, 0.02, 0.008);
    // 分散和音
    const pat = [0, 1, 2, 1, 0, 2, 1, 2], n = root + 12 + ch[pat[step]] + (step >= 4 && this.bar % 2 ? 12 : 0);
    pluck(n, t, step % 2 ? 0.09 : 0.12, bgmBus, 0.25, 0.6, 0.7);
    // 太鼓
    if (d) {
      if (step === 0 || step === 4 || (this.intense && step === 7)) tone(120, t, 0.12, 'sine', 0.26 * d, bgmBus, 45, 0);
      if (step === 2 || step === 6) noise(t, 0.1, 0.1 * d, 1800, 0.7, bgmBus, 'bandpass', 0.15);
      noise(t, 0.03, (step % 2 ? 0.035 : 0.02) * d, 9000, 1, bgmBus, 'highpass');
      if (this.bar % 8 === 7 && step >= 4) noise(t, 0.08, 0.08 * d, 900 + step * 300, 1, bgmBus);
    }
    // メロディ(2周目からオクターブ下でハモる)
    const i = (this.bar % 4) * 8 + step, tok = P.mel[i];
    if (tok == null || tok === '.' || this.bar % 8 >= 4 && this.loops % 2 === 0 && step % 2) return;
    let len = 1; while (P.mel[i + len] === '.' && len < 4) len++;
    const m = T.key + (+tok) + (this.bar % 8 >= 4 ? 12 : 0);
    lead(T.lead, m, t, spb * len * 0.92, T.lead === 'saw' ? 0.045 : 0.05);
    if (this.loops >= 1) tone(mtof(m - 12), t, spb * len * 0.85, 'sine', 0.016, bgmBus, null, 0.2);
  },
};
