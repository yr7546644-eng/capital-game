// 効果音とBGM(すべてその場で合成。素材ファイルなし)
let meter = null, ctx = null, master = null, sfxBus = null, bgmBus = null, verb = null;
const PREF = 'capital-audio', BGM_VOL = 2.2;
const pref = (() => { try { return JSON.parse(localStorage.getItem(PREF) || '{}'); } catch (e) { return {}; } })();
export const audioPref = () => ({ bgm: pref.bgm !== false, sfx: pref.sfx !== false, haptic: pref.haptic !== false });
export function setAudioPref(k, v) { pref[k] = v; try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) { } if (k === 'bgm') { if (v) bgm.start(); else bgm.stop(); } }

function impulse(sec = 2.4) { const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); } return b; }
export function unlockAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createDynamicsCompressor(); master.threshold.value = -12; master.ratio.value = 3; master.connect(ctx.destination); meter = ctx.createAnalyser(); meter.fftSize = 2048; master.connect(meter);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 2.4; sfxBus.connect(master);
      bgmBus = ctx.createGain(); bgmBus.gain.value = 0.0001; bgmBus.connect(master);
      verb = ctx.createConvolver(); verb.buffer = impulse(); const vg = ctx.createGain(); vg.gain.value = 0.3; verb.connect(vg).connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (audioPref().bgm && !bgm.on) bgm.start();
  } catch (e) { }
}
// 画面が裏に回ったら止める(電池と迷惑の対策)
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
export function haptic(ms = 8) { try { if (audioPref().haptic && navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }

// ── 音の部品
const now = () => ctx.currentTime;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function send(g, wet) { if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(verb); } }
function tone(f, t, dur, type, vol, bus, f2, wet = 0.2, att = 0.006) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0005, t + att + dur);
  o.connect(g); g.connect(bus); send(g, wet); o.start(t); o.stop(t + att + dur + 0.05);
}
let noiseBuf = null;
function noise(t, dur, vol, freq, q, bus, type = 'bandpass', wet = 0) {
  if (!noiseBuf) { const n = ctx.sampleRate, b = ctx.createBuffer(1, n, n), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseBuf = b; }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  s.connect(f).connect(g).connect(bus); send(g, wet); s.start(t, Math.random() * 0.5, dur + 0.05);
}
// 弦をはじいた音(カープラス・ストロング法)。音の高さごとに作って使い回す
const pluckCache = new Map();
function pluckBuf(m, bright = 0.5) {
  const key = m + ':' + bright; if (pluckCache.has(key)) return pluckCache.get(key);
  const sr = ctx.sampleRate, f = mtof(m), N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * 1.6), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  let lp = 0; for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; lp = lp + (r - lp) * (0.3 + bright * 0.6); d[i] = lp; }
  let mx = 0; for (let i = 0; i < N; i++) mx = Math.max(mx, Math.abs(d[i])); for (let i = 0; i < N; i++) d[i] /= mx || 1;
  const decay = 0.996 - Math.max(0, m - 60) * 0.0003;
  for (let i = N; i < len; i++) d[i] = (d[i - N] + d[i - N + 1 < i ? i - N + 1 : i - N]) * 0.5 * decay;
  pluckCache.set(key, b); return b;
}
function pluck(m, t, vol, bus, wet = 0.25, bright = 0.5, dur = 1.4) {
  const s = ctx.createBufferSource(); s.buffer = pluckBuf(m, bright); const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.25);
  s.connect(g).connect(bus); send(g, wet); s.start(t); s.stop(t + dur + 0.3);
}
const jit = () => 1 + (Math.random() - 0.5) * 0.07;   // 毎回すこし音程を揺らして単調にしない

// ── 効果音
export function sfx(k, arg) {
  if (!ctx || !audioPref().sfx) return;
  try {
    const t = now(), j = jit();
    if (k === 'press') { noise(t, 0.018, 0.12, 3800 * j, 2, sfxBus, 'bandpass'); }
    if (k === 'tap') { noise(t, 0.025, 0.2, 2400 * j, 3, sfxBus); tone(1250 * j, t, 0.05, 'sine', 0.07, sfxBus, 1500 * j, 0.05); }
    if (k === 'toggle') { tone(990 * j, t, 0.05, 'sine', 0.08, sfxBus, 1320 * j, 0.05); tone(1480 * j, t + 0.045, 0.06, 'sine', 0.05, sfxBus, null, 0.08); }
    if (k === 'open') { tone(620 * j, t, 0.12, 'sine', 0.06, sfxBus, 1040 * j, 0.15); noise(t, 0.14, 0.05, 2200, 0.8, sfxBus); }
    if (k === 'close') { tone(900 * j, t, 0.09, 'sine', 0.05, sfxBus, 560 * j, 0.1); noise(t, 0.1, 0.035, 1500, 0.8, sfxBus); }
    if (k === 'coin') { tone(1976 * j, t, 0.06, 'square', 0.03, sfxBus, null, 0.1); tone(2637 * j, t + 0.06, 0.35, 'square', 0.03, sfxBus, null, 0.25); tone(5274 * j, t + 0.06, 0.2, 'sine', 0.015, sfxBus, null, 0.2); }
    if (k === 'coins') { for (let i = 0; i < (arg || 5); i++) { const tt = t + i * 0.055 + Math.random() * 0.02, jj = jit(); tone(2093 * jj * (1 + (i % 3) * 0.12), tt, 0.12, 'square', 0.018, sfxBus, null, 0.2); noise(tt, 0.03, 0.06, 6000, 2, sfxBus); } }
    if (k === 'kaching') { noise(t, 0.05, 0.2, 3000, 3, sfxBus); tone(2637, t + 0.03, 0.4, 'triangle', 0.06, sfxBus, null, 0.3); tone(3520, t + 0.08, 0.5, 'triangle', 0.05, sfxBus, null, 0.3); }
    if (k === 'card') { noise(t, 0.09, 0.16, 3500 * j, 0.7, sfxBus, 'highpass'); tone(660 * j, t + 0.03, 0.2, 'triangle', 0.06, sfxBus, 1100 * j, 0.2); }
    if (k === 'build') { for (let i = 0; i < 3; i++) { noise(t + i * 0.1, 0.05, 0.28, 800 * j, 2.5, sfxBus); tone(150 * j, t + i * 0.1, 0.08, 'sine', 0.14, sfxBus, 80, 0.05); } [72, 76, 79].forEach((m, i) => pluck(m, t + 0.32 + i * 0.06, 0.25, sfxBus, 0.3, 0.7, 0.8)); }
    if (k === 'whoosh') { noise(t, 0.5, 0.12, 600, 0.5, sfxBus, 'bandpass', 0.2); noise(t + 0.05, 0.4, 0.07, 2400, 0.7, sfxBus); }
    if (k === 'rankup') [72, 76, 79, 84, 88].forEach((m, i) => { pluck(m, t + i * 0.07, 0.3, sfxBus, 0.35, 0.8, 1.2); tone(mtof(m + 12), t + i * 0.07, 0.3, 'sine', 0.025, sfxBus, null, 0.3); });
    if (k === 'bad') { tone(220, t, 0.3, 'triangle', 0.07, sfxBus, 150, 0.15); tone(208, t + 0.18, 0.45, 'triangle', 0.06, sfxBus, 130, 0.2); }
    if (k === 'pop') { tone(700 * j, t, 0.07, 'sine', 0.09, sfxBus, 1400 * j, 0.05); }
    if (k === 'notify') { pluck(84, t, 0.25, sfxBus, 0.3, 0.8, 0.8); pluck(88, t + 0.09, 0.25, sfxBus, 0.3, 0.8, 1); }
    if (k === 'swipe') { noise(t, 0.16, 0.06, 1200, 0.6, sfxBus); }
    if (k === 'stamp') { tone(110, t, 0.12, 'sine', 0.2, sfxBus, 55, 0.05); noise(t, 0.06, 0.3, 500, 1, sfxBus, 'lowpass'); }
  } catch (e) { }
}

// ── BGM: 作曲した曲を流す。曲は A-A-B-A の形でサビが耳に残るように作ってある
// 書き方: 数字=主音からの半音、'-'=のばす、'.'=休み。和音は「主音からの半音+M(長)/m(短)」
const TRACKS = {
  asa: { vol: 1, name: '商人の朝', bpm: 112, key: 60, steps: 8, lead: 'flute', arp: 'lute', drum: 1, form: 'AABA',
    A: { ch: '0M 7M 9m 5M 0M 7M 5M 7M', mel: '7 . 7 9 7 4 . 2 | 2 . 2 4 2 -1 . . | 0 . 0 2 4 . 7 . | 9 - 7 - 5 . 4 . | 7 . 7 9 7 4 . 2 | 2 . 2 4 7 . 5 4 | 5 . 4 2 0 . 2 . | 0 - - - . . . .' },
    B: { ch: '5M 7M 4m 9m 5M 7M 0M 0M', mel: '12 . 12 . 9 . 12 . | 14 - 12 - 11 . 7 . | 11 . 11 . 7 . 11 . | 12 - 9 - . . 7 9 | 12 . 12 14 12 9 7 5 | 7 . 4 . 7 . 11 . | 12 - - - 7 . 4 . | 2 - - - . . . .' } },
  kenso: { vol: 1.5, name: '市場の喧騒', bpm: 128, key: 62, steps: 8, lead: 'pluck', arp: 'lute', drum: 1.2, form: 'AABA', minor: 1,
    A: { ch: '0m 10M 8M 10M 0m 10M 8M 7M', mel: '0 . 3 5 . 7 5 3 | -2 . 0 3 . 5 3 0 | -4 . -2 0 . 3 2 0 | -2 - 0 - 2 - 3 - | 0 . 3 5 . 7 5 3 | 7 . 5 3 . 5 7 10 | 12 . 10 7 . 5 3 2 | -5 - - - -1 . 2 .' },
    B: { ch: '8M 10M 0m 0m 8M 10M 7M 7M', mel: '5 . 5 . 3 . 2 . | 3 . 3 . 2 . 0 . | 2 . 2 . 0 . -2 . | 0 - - - . . . . | 5 . 5 . 7 . 8 . | 7 . 7 . 10 . 12 . | 7 . 9 . 11 . 9 . | 7 - - - . . . .' } },
  ame: { vol: 0.5, name: '雨の帳簿', bpm: 76, key: 57, steps: 8, lead: 'flute', arp: 'harp', drum: 0, form: 'AABA', minor: 1, soft: 1,
    A: { ch: '0m 8M 3M 10M 0m 8M 10M 7M', mel: '12 - - - 10 - 7 - | 8 - 7 - 5 - - - | 7 - - - 3 - 5 7 | 5 - - - . . . . | 12 - - - 10 - 7 - | 8 - 7 - 5 - 3 - | 2 - 3 - 5 - 7 - | 11 - 7 - - - . .' },
    B: { ch: '8M 10M 3M 0m 8M 10M 7M 7M', mel: '0 - 3 - 5 - 8 - | 7 - 5 - 3 - 2 - | 3 - - - 7 - - - | 0 - - - . . . . | 12 - 10 - 8 - 7 - | 5 - 7 - 10 - - - | 11 - - - 7 - - - | 2 - - - . . . .' } },
  matsuri: { vol: 1.4, name: '祝祭の大市', bpm: 138, key: 67, steps: 8, lead: 'pluck', arp: 'lute', drum: 1.5, form: 'AABA', fest: 1,
    A: { ch: '0M 5M 7M 0M 9m 5M 7M 7M', mel: '0 . 4 . 7 . 4 . | 5 . 9 . 12 - 9 . | 7 . 9 11 14 - 11 . | 12 - 7 - 4 - . . | 9 . 12 . 16 . 12 . | 12 . 9 . 7 . 4 . | 2 . 4 . 7 . 9 . | 11 - - - 14 - - -' },
    B: { ch: '5M 0M 5M 7M 5M 0M 7M 0M', mel: '12 . 12 . 14 . 12 . | 11 . 7 . 4 . 7 . | 12 . 12 . 14 . 16 . | 14 - - - . . . . | 16 . 14 . 12 . 9 . | 11 . 9 . 7 . 4 . | 2 . 4 . 7 . 9 . | 7 - - - 0 - - -' } },
  yuki: { vol: 1.1, name: '雪の街の灯', bpm: 92, key: 65, steps: 8, lead: 'box', arp: 'harp', drum: 0.4, form: 'AABA', soft: 1,
    A: { ch: '0M 9m 5M 7M 0M 9m 5M 7M', mel: '12 . 9 . 7 . 9 . | 9 . 12 . 16 . 14 . | 5 . 9 . 12 - 9 . | 7 . 11 . 14 - 12 . | 12 . 9 . 7 . 9 . | 9 . 12 . 16 . 14 . | 12 . 9 . 5 . 7 . | 7 - - - 11 - - -' },
    B: { ch: '5M 7M 4m 9m 5M 7M 0M 0M', mel: '14 - 12 - 9 - 12 - | 11 - 7 - 4 - 7 - | 11 - 7 - 4 - 7 - | 9 - - - 12 - - - | 14 - 12 - 9 - 5 - | 7 - 11 - 14 - 12 - | 12 - - - 9 - 7 - | 0 - - - . . . .' } },
  minato: { vol: 0.9, name: '港の舟歌', bpm: 132, key: 62, steps: 6, lead: 'flute', arp: 'lute', drum: 0.9, form: 'AABA', minor: 1, shanty: 1,
    A: { ch: '0m 10M 0m 7M 0m 10M 0m 7M', mel: '0 - 0 2 3 5 | 7 - 5 3 - 2 | 3 - 2 0 - -2 | -5 - -1 2 - - | 0 - 0 2 3 5 | 7 - 5 3 - 2 | 3 - 2 -2 - -1 | 0 - - . . .' },
    B: { ch: '3M 10M 0m 7M 3M 10M 7M 7M', mel: '12 - 12 10 - 7 | 10 - 10 7 - 5 | 7 - 5 3 - 2 | -1 - - 2 - - | 12 - 12 14 - 12 | 10 - 9 7 - 5 | 7 - - 11 - - | 7 - - . . .' } },
  ouji: { vol: 1.4, name: '王都の決算', bpm: 120, key: 64, steps: 8, lead: 'pluck', arp: 'lute', drum: 1.3, form: 'AABA', minor: 1,
    A: { ch: '0m 8M 10M 0m 0m 8M 10M 7M', mel: '7 . 7 . 8 7 5 3 | 3 . 3 . 5 3 2 0 | 2 . 2 . 3 2 0 -2 | 0 - - - -5 . 0 . | 7 . 7 . 8 7 5 3 | 3 . 3 . 5 3 7 8 | 10 . 8 7 . 5 3 2 | 2 - - - 11 - - -' },
    B: { ch: '8M 10M 3M 7M 8M 10M 7M 7M', mel: '12 . 12 10 . 8 7 . | 10 . 10 8 . 7 5 . | 7 . 7 5 . 3 2 . | 2 - - - . . . . | 12 . 14 15 . 14 12 . | 10 . 12 14 . 12 10 . | 11 - - - 14 - - - | 11 - - - . . . .' } },
};
export const TRACK_NAMES = Object.fromEntries(Object.entries(TRACKS).map(([k, v]) => [k, v.name]));
const parsed = {};
function parse(k) {
  if (parsed[k]) return parsed[k];
  const T = TRACKS[k], sec = {};
  for (const s of ['A', 'B']) {
    const ch = T[s].ch.split(' ').map(c => { const r = parseInt(c), q = c.slice(-1); return [r, r + (q === 'M' ? 4 : 3), r + 7]; });
    const mel = T[s].mel.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
    sec[s] = { ch, mel };
  }
  const seq = []; for (const s of T.form) seq.push(sec[s]);
  return (parsed[k] = { T, seq, bars: seq.length * 8 });
}
// 楽器
function lead(kind, m, t, len, vol) {
  if (kind === 'pluck') { pluck(m, t, vol * 2.2, bgmBus, 0.25, 0.75, Math.max(0.5, len * 1.4)); return; }
  if (kind === 'box') { tone(mtof(m), t, len + 0.5, 'sine', vol * 1.2, bgmBus, null, 0.4, 0.003); tone(mtof(m + 24), t, 0.25, 'sine', vol * 0.35, bgmBus, null, 0.4, 0.002); return; }
  // 笛: ゆらぎと息の音
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = mtof(m); o2.frequency.value = mtof(m) * 2; const g2 = ctx.createGain(); g2.gain.value = 0.18;
  lfo.frequency.value = 5.4; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(mtof(m) * 0.008, t + Math.min(0.4, len)); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.035); g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.05, len - 0.05)); g.gain.exponentialRampToValueAtTime(0.0005, t + len + 0.18);
  o.connect(g); o2.connect(g2).connect(g); g.connect(bgmBus); send(g, 0.35);
  noise(t, 0.06, vol * 0.5, mtof(m) * 2, 2, bgmBus);
  for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + len + 0.25); }
}
function drums(T, step, t, spb, bar) {
  const d = T.drum; if (!d) return;
  if (T.shanty) {   // 6拍子: ドン・・タン・・
    if (step === 0) { tone(120, t, 0.12, 'sine', 0.22 * d, bgmBus, 50, 0); }
    if (step === 3) noise(t, 0.08, 0.1 * d, 1800, 0.8, bgmBus);
    noise(t, 0.03, 0.025 * d, 8000, 1, bgmBus, 'highpass'); return;
  }
  if (step === 0 || step === 4 || (T.fest && step === 6 && bar % 2)) tone(130, t, 0.12, 'sine', 0.24 * d, bgmBus, 48, 0);
  if (step === 2 || step === 6) { noise(t, 0.09, 0.09 * d, 1900, 0.7, bgmBus, 'bandpass', 0.15); }
  if (!T.soft) noise(t + (step % 2 ? spb * 0.08 : 0), 0.035, (step % 2 ? 0.035 : 0.022) * d, 9000, 1, bgmBus, 'highpass');
  if (T.fest && step % 2 === 1) noise(t, 0.05, 0.03 * d, 5000, 3, bgmBus);   // タンバリン
}
export const bgm = {
  on: false, track: null, want: 'yuki', next: 0, step: 0, bar: 0, timer: null, loops: 0,
  start() { if (!ctx) return; this.on = true; if (!this.track) this.track = this.want; bgmBus.gain.cancelScheduledValues(now()); bgmBus.gain.setTargetAtTime(BGM_VOL * (TRACKS[this.track].vol || 1), now(), 0.8); if (!this.timer) { this.next = now() + 0.15; this.timer = setInterval(() => this.tick(), 50); } },
  stop() { this.on = false; if (bgmBus) { bgmBus.gain.cancelScheduledValues(now()); bgmBus.gain.setTargetAtTime(0.0001, now(), 0.3); } setTimeout(() => { if (!this.on && this.timer) { clearInterval(this.timer); this.timer = null; } }, 1200); },
  // 曲を替える(4小節の切れ目でフェードして入れ替え)
  play(k) { if (!TRACKS[k]) return; this.want = k; if (!this.track) this.track = k; },
  get name() { return this.track ? TRACKS[this.track].name : ''; },
  tick() {
    if (!ctx || !this.on) return;
    if (this.next < now() - 1) this.next = now() + 0.05;   // 裏から戻ったとき追いつこうとしない
    while (this.next < now() + 0.3) {
      const P = parse(this.track), T = P.T, spb = 60 / T.bpm / 2;
      if (this.step === 0 && this.want !== this.track) {
        bgmBus.gain.setTargetAtTime(0.0001, Math.max(now(), this.next - 0.4), 0.12); this.track = this.want; this.bar = 0; this.loops = 0; this.next += 0.5;
        bgmBus.gain.setTargetAtTime(BGM_VOL * (TRACKS[this.track].vol || 1), this.next, 0.25); continue;
      }
      this.play1(P, this.next, spb);
      this.next += spb; this.step++;
      if (this.step >= T.steps) { this.step = 0; this.bar++; if (this.bar >= P.bars) { this.bar = 0; this.loops++; } }
    }
  },
  play1(P, t, spb) {
    const T = P.T, S = T.steps, sec = P.seq[Math.floor(this.bar / 8)], bi = this.bar % 8, ch = sec.ch[bi], root = T.key - 12, step = this.step;
    // ベース
    if (step === 0) tone(mtof(root + ch[0] - 12), t, spb * (S === 6 ? 2.6 : 3.4), 'triangle', 0.11, bgmBus, null, 0.02, 0.01);
    if (S === 8 && step === 4) tone(mtof(root + ch[0] - 12 + 7), t, spb * 2.6, 'triangle', 0.09, bgmBus, null, 0.02, 0.01);
    if (S === 6 && step === 3) tone(mtof(root + ch[2] - 12), t, spb * 2.4, 'triangle', 0.08, bgmBus, null, 0.02, 0.01);
    // 伴奏(分散和音)
    const pat = S === 6 ? [0, 1, 2, 0, 1, 2] : [0, 2, 1, 2, 0, 2, 1, 2], note = root + 12 + ch[pat[step]];
    if (T.arp === 'harp') { if (step % 2 === 0) pluck(note + (step === 4 ? 12 : 0), t, 0.16, bgmBus, 0.4, 0.4, 1.6); }
    else pluck(note, t, step % 2 ? 0.11 : 0.15, bgmBus, 0.2, 0.55, 0.9);
    // パッド(柔らかい曲だけ)
    if (T.soft && step === 0) for (const n of ch) { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(root + 12 + n); f.type = 'lowpass'; f.frequency.value = 700; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.01, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + spb * S); o.connect(f).connect(g).connect(bgmBus); send(g, 0.5); o.start(t); o.stop(t + spb * S + 0.05); }
    drums(T, step, t, spb, this.bar);
    // メロディ(2周目はBパートを1オクターブ上で)
    const i = bi * S + step, tok = sec.mel[i];
    if (tok == null || tok === '-' || tok === '.') return;
    let len = 1; while (sec.mel[i + len] === '-') len++;
    const m = T.key + 12 + (+tok) + (this.loops % 2 === 1 && Math.floor(this.bar / 8) === 2 ? 12 : 0);
    lead(T.lead, m, t, spb * len * 0.95, T.lead === 'flute' ? 0.05 : 0.055);
    if (this.loops >= 1 && T.lead !== 'box' && step % 2 === 0) tone(mtof(m - 12), t, spb * len * 0.9, 'sine', 0.018, bgmBus, null, 0.2);   // 2周目から下でハモる
  },
  // 結果のファンファーレ
  jingle(good) {
    if (!ctx || !audioPref().sfx) return; const t = now() + 0.02;
    if (good) { [[72, 0], [76, 0.09], [79, 0.18], [84, 0.3]].forEach(([m, dt]) => { pluck(m, t + dt, 0.3, sfxBus, 0.35, 0.8, 1.2); }); tone(mtof(84), t + 0.3, 0.6, 'sine', 0.04, sfxBus, null, 0.4); }
    else { [[67, 0], [63, 0.16], [60, 0.32]].forEach(([m, dt]) => pluck(m, t + dt, 0.25, sfxBus, 0.35, 0.4, 1.2)); }
  },
};

// 音量の確認用(テスト)
export function level() { if (!meter) return null; const a = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(a); let pk = 0, ss = 0; for (const x of a) { pk = Math.max(pk, Math.abs(x)); ss += x * x; } return { pk, rms: Math.sqrt(ss / a.length) }; }
