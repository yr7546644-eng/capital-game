// 効果音(その場で合成。素材ファイルなし)
let ctx = null;
export function unlockAudio() { try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { } }
function tone(f, t0, dur, type = 'sine', vol = 0.12, f2 = null) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, ctx.currentTime + t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + t0 + dur);
  g.gain.setValueAtTime(0, ctx.currentTime + t0); g.gain.linearRampToValueAtTime(vol, ctx.currentTime + t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + t0 + dur);
  o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.02);
}
export function sfx(k) {
  if (!ctx) return;
  try {
    if (k === 'tap') tone(880, 0, 0.06, 'triangle', 0.06);
    if (k === 'open') { tone(520, 0, 0.08, 'sine', 0.06); tone(780, 0.05, 0.1, 'sine', 0.05); }
    if (k === 'coin') { tone(1320, 0, 0.08, 'square', 0.04); tone(1760, 0.07, 0.22, 'square', 0.04); }
    if (k === 'card') { tone(420, 0, 0.12, 'triangle', 0.08, 840); }
    if (k === 'build') { tone(220, 0, 0.08, 'square', 0.05); tone(330, 0.09, 0.08, 'square', 0.05); tone(440, 0.18, 0.14, 'square', 0.05); }
    if (k === 'whoosh') tone(300, 0, 0.35, 'sawtooth', 0.03, 1200);
    if (k === 'rankup') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle', 0.08));
  } catch (e) { }
}
