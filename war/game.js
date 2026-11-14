// キャピタル商会戦争: 資源の相場で勝負する。ニュースと予想を読んで、市場が開いている間に「上がる/下がる」に賭ける。
// ライバル3人も売り買いし、戦争カード(買い占め・悪いうわさ…)で相場を動かしてくる。12か月後の総資産で順位を決める
import { sfx, bgm, unlockAudio, haptic } from '../js/sfx.js';

const $ = (s) => document.querySelector(s);
const ICON = (k) => `../assets/icons/${k}.png`;
const img = (k, c = '') => `<img class="ic ${c}" src="${ICON(k)}" alt="" draggable="false">`;
const fmt = (n) => Math.round(n).toLocaleString('ja-JP');
const sgn = (n) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
const pct = (x) => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1) + '%';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const priceStr = (p) => p >= 100 ? p.toFixed(0) : p.toFixed(1);

// ── 資源・ライバル・カード・ニュース
const RES = [
  { k: 'wheat', name: '小麦', icon: 'wheat', p0: 10, vol: 0.06, depth: 27000, color: '#ffd36e', kind: 'res' },
  { k: 'iron', name: '鉄', icon: 'iron', p0: 24, vol: 0.08, depth: 24000, color: '#9fc3ff', kind: 'res' },
  { k: 'herb', name: '薬草', icon: 'herb', p0: 16, vol: 0.09, depth: 21000, color: '#6ee07a', kind: 'res' },
  { k: 'fabric', name: '布', icon: 'fabric', p0: 20, vol: 0.07, depth: 24000, color: '#ff9ac0', kind: 'res' },
  { k: 'star', name: '星銀', icon: 'starsilver', p0: 80, vol: 0.15, depth: 12000, color: '#c79bff', kind: 'res' },
  // 企業の株(1社 100株)。link の資源の値動きにつられて動く(sens: 資源が上がると株は…)
  { k: 'bank', name: '王都銀行', short: '銀行', icon: 'o_cash', p0: 40, vol: 0.05, depth: 14000, color: '#ffe08a', kind: 'co', ability: 'lever', abilityText: '賭けられる上限が総資産の3倍になる' },
  { k: 'ship', name: '港の海運商会', short: '海運', icon: 'o_boat', p0: 30, vol: 0.09, depth: 11000, color: '#5ad1ff', kind: 'co', ability: 'spread', abilityText: '売り買いの手数料が半分になる' },
  { k: 'forge', name: '鍛冶ギルド', short: '鍛冶', icon: 'o_pick', p0: 25, vol: 0.08, depth: 10000, color: '#ff8a5c', kind: 'co', link: 'iron', sens: -0.6, ability: 'profit', abilityText: '会社の利益がそのまま入る(鉄が安いと儲かる)' },
  { k: 'bakery', name: 'パン組合', short: 'パン', icon: 'b_bread', p0: 20, vol: 0.07, depth: 9000, color: '#f2c46d', kind: 'co', link: 'wheat', sens: -0.6, ability: 'profit', abilityText: '会社の利益がそのまま入る(小麦が安いと儲かる)' },
  { k: 'arcane', name: '星銀魔導工房', short: '魔導', icon: 'o_crystal', p0: 60, vol: 0.13, depth: 13000, color: '#c79bff', kind: 'co', link: 'star', sens: 0.7, ability: 'profit', abilityText: '会社の利益がそのまま入る(星銀が高いと儲かる)' },
];
const SHARES = 100;
const isCo = (i) => RES[i].kind === 'co';
const coIdx = () => RES.map((r, i) => i).filter(isCo);
const RIVALS = [
  { name: 'ガルド', icon: 'o_barb', color: '#ff6b5a', style: 'bull', say: { buy: '上がるに決まってる、全部買いだ!', win: 'がはは、儲かった!', card: '相場はおれが動かす!' } },
  { name: 'ミーナ', icon: 'o_mage', color: '#5aa8ff', style: 'news', say: { buy: '確かな情報だけを信じるわ', win: '計算どおりね', card: 'この情報、使わせてもらうわ' } },
  { name: 'ロウ', icon: 'o_rogue', color: '#9be87a', style: 'contra', say: { buy: 'みんなが買うなら、おれは売る', win: '逆張りは裏切らない', card: 'ちょっと噂を流しておいたよ' } },
];
const CARDS = {
  pump: { name: '買い占め', icon: 'o_magnet', text: '選んだ資源が、今月 大きく上がる', target: 'res', power: 0.13 },
  dump: { name: '悪いうわさ', icon: 'o_speech', text: '選んだ資源が、今月 大きく下がる', target: 'res', power: -0.13 },
  spy: { name: '情報屋', icon: 'o_magnifier', text: '今月の本当の値動きの向きが全部分かる', target: null },
  hedge: { name: '保険', icon: 'o_scales', text: '今月 損をしたら、その半分が戻ってくる', target: null },
  seize: { name: '差し押さえ', icon: 'o_contract', text: '選んだライバルの資源を、むりやり全部売らせる(株は守られる)', target: 'rival' },
};
const NEWS = [
  ['wheat', 1, '北の畑で日照り。小麦が不作になりそう'], ['wheat', 1, '王都でパン祭り。小麦の注文が殺到'], ['wheat', -1, '今年は小麦が大豊作。倉があふれそう'], ['wheat', -1, '隣国から安い小麦が入ってくる'],
  ['iron', 1, '王国軍が武具を大量に注文'], ['iron', 1, '鉱山で落盤。鉄が掘れない'], ['iron', -1, '新しい鉱山が見つかった'], ['iron', -1, '戦争が終わり、武具が余っている'],
  ['herb', 1, '町で風邪が流行。薬が足りない'], ['herb', 1, '薬草の森が山火事で焼けた'], ['herb', -1, '薬草の森で大収穫'], ['herb', -1, '新しい薬が発明され、薬草がいらなくなる'],
  ['fabric', 1, '王都で舞踏会。ドレスの注文が殺到'], ['fabric', 1, '羊の病気で羊毛が足りない'], ['fabric', -1, '東の国から安い布が大量に入荷'], ['fabric', -1, '流行が終わり、布が売れ残っている'],
  ['bank', 1, '王都銀行が王家の金庫番に選ばれた'], ['bank', -1, '王都銀行で大口の貸し倒れ'],
  ['ship', 1, '新しい航路が開かれ、船の注文が殺到'], ['ship', -1, '嵐で海運商会の船が沈んだ'], ['ship', 1, '港の税が下がる'],
  ['forge', 1, '鍛冶ギルドが王国軍の武具を一手に請け負った'], ['forge', -1, '鍛冶ギルドの親方たちが独立'],
  ['bakery', 1, 'パン組合の新しい菓子パンが大評判'], ['bakery', -1, 'パン組合で食中毒騒ぎ'],
  ['arcane', 1, '星銀魔導工房が新しい魔導具を発明'], ['arcane', -1, '魔導工房の実験で大爆発'],
  ['star', 1, '魔導師ギルドが星銀を買い集めている'], ['star', 1, '流れ星の夜が終わり、星銀が採れなくなる'], ['star', -1, '星銀の偽物が出回っている'], ['star', -1, '大きな星銀の鉱脈が見つかった'],
];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const START_CASH = 1000, SPREAD = 0.006, LEVER = 2, TICKS = 72, LIVE_SEC = 12;

// ── 状態
let G = null;
function newGame(months) {
  const players = [{ id: 0, name: 'あなた', icon: 'o_crown', color: '#ffd36e', me: true }, ...RIVALS.map((r, i) => ({ id: i + 1, ...r }))];
  G = {
    months, m: 0, phase: 'title', sel: 0, amount: 100,
    price: RES.map(r => r.p0 * rand(0.92, 1.08)),
    hist: RES.map(() => []), live: null,
    players: players.map(p => ({ ...p, cash: START_CASH, pos: RES.map(() => ({ u: 0, avg: 0 })), hand: [], used: null, prevAssets: START_CASH, startAssets: START_CASH, hedge: false })),
    news: [], effects: RES.map(() => 0), reveal: false, feed: [], trades: [], tab: 'res',
    ctrl: RES.map(() => null), tob: {}, boost: RES.map(() => 0), meetingQueue: [], fade: RES.map(() => 0),
  };
  // 過去6か月の値動き(チャートが寂しくないように)
  for (let k = 0; k < 6; k++) RES.forEach((r, i) => {
    const o = G.price[i], c = o * Math.exp(gauss() * r.vol * 0.7 - 0.2 * Math.log(o / r.p0));
    G.hist[i].push({ o, c, h: Math.max(o, c) * (1 + Math.random() * r.vol * 0.4), l: Math.min(o, c) * (1 - Math.random() * r.vol * 0.4), m: -6 + k });
    G.price[i] = c;
  });
  for (const p of G.players) p.hand = [drawCard(), drawCard()];
  // ライバルのねらい: ガルドは買収、ミーナは配当(銀行)、ロウは安い株
  G.players[1].target = RES.findIndex(r => r.k === pick(['forge', 'arcane', 'ship']));
  G.players[2].target = RES.findIndex(r => r.k === 'bank');
}
const me = () => G.players[0];
const drawCard = () => pick(['pump', 'dump', 'spy', 'hedge', 'seize', 'pump', 'dump']);
function assets(p, prices = curPrices()) { return p.cash + p.pos.reduce((a, q, i) => a + q.u * prices[i], 0); }
function exposure(p, prices = curPrices()) { return p.pos.reduce((a, q, i) => a + Math.abs(q.u * prices[i]), 0); }
function curPrices() { return G.live ? G.live.cur.slice() : G.price.slice(); }
const ranking = () => G.players.slice().sort((a, b) => assets(b) - assets(a));

// ── 月のはじめ: ニュース・予想・ライバルのカード
function planMonth() {
  G.phase = 'plan'; G.effects = RES.map(() => 0); G.reveal = false; G.trades = []; G.boost = G.boost.map(b => b * 0.5);
  for (const p of G.players) { p.used = null; p.hedge = false; p.startAssets = assets(p, G.price); if (p.hand.length < 3) p.hand.push(drawCard()); }
  // ニュースは2つ: 確かな筋(85%)と、うわさ(55%)
  const pool = NEWS.slice().sort(() => Math.random() - 0.5), a = pool[0], b = pool.find(n => n[0] !== a[0]);
  G.news = [[a, 0.85, rand(0.09, 0.16)], [b, 0.55, rand(0.07, 0.13)]].map(([n, rel, mag]) => {
    const r = RES.findIndex(x => x.k === n[0]), truth = Math.random() < rel ? n[1] : (Math.random() < 0.5 ? -n[1] : 0);
    return { r, s: n[1], text: n[2], rel, mag, truth };
  });
  // ライバルのカード
  for (const p of G.players.slice(1)) rivalCard(p);
  render();
  bgm.play('asa');
}
function forecast(i) {
  // 上がる見込み(%)。ニュースとカードから
  let up = 50;
  for (const n of G.news) if (n.r === i) up += (n.rel - 0.5) * 100 * n.s * 0.9 + (n.rel > 0.7 ? 0 : 0);
  up += G.effects[i] * 220;
  const r = RES[i]; if (r.link) { const j = RES.findIndex(x => x.k === r.link); for (const n of G.news) if (n.r === j) up += (n.rel - 0.5) * 100 * n.s * 0.9 * r.sens; up += G.effects[j] * 220 * r.sens; }
  up += (G.boost[i] || 0) * 200;
  const truth = G.news.filter(n => n.r === i).reduce((a, n) => a + n.truth * n.mag, 0) + G.effects[i];
  if (G.reveal) return { up: truth > 0.01 ? 100 : truth < -0.01 ? 0 : 50, sure: true };
  return { up: clamp(Math.round(up), 5, 95), sure: false };
}
function rivalCard(p) {
  if (!p.hand.length || Math.random() < 0.45) return;
  const k = p.hand[Math.floor(Math.random() * p.hand.length)];
  if (k === 'spy' || k === 'hedge') { p.hand.splice(p.hand.indexOf(k), 1); p.used = { k }; if (k === 'hedge') p.hedge = true; return; }
  let target = null;
  if (k === 'pump') { const held = p.pos.map((q, i) => q.u * G.price[i]); const i = held.indexOf(Math.max(...held)); target = held[i] > 0 ? i : G.news[0].r; }
  if (k === 'dump') { const held = p.pos.map((q, i) => q.u * G.price[i]); const i = held.indexOf(Math.min(...held)); target = held[i] < 0 ? i : Math.floor(Math.random() * RES.length); }
  if (k === 'seize') { const top = ranking().find(x => x !== p); if (!top || top.pos.reduce((a, q, i) => a + (isCo(i) ? 0 : Math.abs(q.u * G.price[i])), 0) < 50) return; target = top.id; }
  p.hand.splice(p.hand.indexOf(k), 1); p.used = { k, target };
  applyCard(p, k, target, true);
}
function applyCard(p, k, target, announce) {
  const C = CARDS[k];
  if (k === 'pump' || k === 'dump') G.effects[target] += C.power;
  if (k === 'spy') { if (p.me) G.reveal = true; }
  if (k === 'hedge') p.hedge = true;
  if (k === 'seize') { const t = G.players[target]; t.pos.forEach((q, i) => { if (q.u && !isCo(i)) { t.cash += q.u * G.price[i] * (1 - SPREAD * Math.sign(q.u)); q.u = 0; q.avg = 0; } }); }
  if (k === 'seize') coIdx().forEach(i => checkControl(i, G.players[target]));
  if (announce) G.cardLog = (G.cardLog || []).concat({ p, k, target });
}

// ── 市場をひらく: 12秒のあいだ値段が動く
function openMarket() {
  G.phase = 'live';
  const months = G.m;
  const path = RES.map((r, i) => {
    const o = G.price[i], newsMove = G.news.filter(n => n.r === i).reduce((a, n) => a + n.truth * n.mag, 0);
    let L = newsMove + G.effects[i] + gauss() * r.vol * 0.55 - 0.12 * Math.log(o / r.p0) + (G.boost[i] || 0) - 0.6 * (G.fade[i] || 0);
    if (r.link) { const j = RES.findIndex(x => x.k === r.link); L += r.sens * (G.news.filter(n => n.r === j).reduce((a, n) => a + n.truth * n.mag, 0) + G.effects[j]); }
    const shock = Math.floor(rand(22, 46));
    // ブラウンブリッジのゆらぎ
    const bn = [0]; for (let t = 1; t <= TICKS; t++) bn.push(bn[t - 1] + gauss() * r.vol * 0.07);
    const pts = [];
    for (let t = 0; t <= TICKS; t++) {
      const f = t < shock ? 0.22 * t / shock : 0.22 + 0.78 * Math.pow((t - shock) / (TICKS - shock), 0.45);
      pts.push(L * f + bn[t] - bn[TICKS] * t / TICKS);
    }
    return { o, L, shock, pts };
  });
  G.live = { t0: performance.now(), tick: 0, path, impact: RES.map(() => 0), impHist: RES.map(() => [{ t: 0, v: 0 }]), cur: G.price.slice(), open: G.price.slice(), hi: G.price.slice(), lo: G.price.slice(), shockShown: RES.map(() => false), months };
  hideSheet(); render(); bgm.play('kenso'); sfx('horn'); flashBanner(`<b>${MONTHS[(G.m) % 12]}の市場 開場!</b><small>${LIVE_SEC}秒のあいだ、上がる・下がるに賭けよう</small>`, 'open');
  G.trades = [];
}
function liveStep(now) {
  const L = G.live; if (!L) return;
  const tf = Math.min(TICKS, (now - L.t0) / 1000 / LIVE_SEC * TICKS), t = Math.floor(tf), frac = tf - t;
  for (let i = 0; i < RES.length; i++) {
    const p = L.path[i], a = p.pts[t], b = p.pts[Math.min(TICKS, t + 1)], x = a + (b - a) * frac;
    L.cur[i] = p.o * Math.exp(x + L.impact[i]);
    L.hi[i] = Math.max(L.hi[i], L.cur[i]); L.lo[i] = Math.min(L.lo[i], L.cur[i]);
    if (!L.shockShown[i] && t >= p.shock && G.news.some(n => n.r === i)) { L.shockShown[i] = true; newsShock(i); }
  }
  if (t > L.tick) { L.tick = t; onTick(t); }
  if (tf >= TICKS) closeMarket();
}
function onTick(t) {
  // ライバルの売り買い
  if (t % 4 === 2) for (const p of G.players.slice(1)) rivalTrade(p, t);
  // 強制決済(追い証)
  for (const p of G.players) {
    const A = assets(p), E = exposure(p);
    if (E > 0 && A < E * 0.12) { closeAll(p, true); coIdx().forEach(i => checkControl(i, p)); if (p.me) { flashBanner('<b>強制決済!</b><small>損が大きくなりすぎたので、全部売り戻された</small>', 'bad'); sfx('bad'); shake(); } else feed(`${p.name}が強制決済された!`, p.color); }
  }
  if (t % 3 === 0) sfx('press');
  renderLiveNumbers();
}
function newsShock(i) {
  const n = G.news.find(x => x.r === i), up = n.truth > 0, none = n.truth === 0;
  sfx(none ? 'notify' : up ? 'kaching' : 'bad'); haptic(20);
  feed(`ニュース:${RES[i].name} ${none ? 'うわさは外れ' : up ? '急上昇!' : '急落!'}`, none ? '#ccc' : up ? '#3ccf8e' : '#ff5a6a');
  if (i === G.sel) { chartFlash(up ? '#3ccf8e' : '#ff5a6a'); if (!none) shake(0.5); }
}

// ── 売り買い
function trade(p, i, gold, side) {
  // side: +1 買う(上がるに賭ける) / -1 売る(下がるに賭ける)。gold は金額
  const L = G.live; if (!L || gold <= 0) return false;
  const spread = SPREAD * (owns(p, 'ship') ? 0.5 : 1), lever = owns(p, 'bank') ? 3 : LEVER;
  const price = L.cur[i] * (1 + spread * side), q = p.pos[i];
  const A = assets(p), E = exposure(p), room = Math.max(0, A * lever - E);
  if (isCo(i)) {
    if (side < 0) gold = Math.min(gold, Math.max(0, q.u) * L.cur[i]);                   // 株は持っている分だけ売れる
    else { const free = SHARES - G.players.reduce((a, x) => a + Math.max(0, x.pos[i].u), 0); gold = Math.min(gold, free * price); }
    if (gold < 1) { if (p.me) { toast(side < 0 ? 'その株は持っていない' : '売りに出ている株がもうない'); sfx('bad'); } return false; }
  }
  // 持っている向きと反対なら、まず手じまい(限度なし)。それ以上は限度まで
  const closing = q.u * side < 0 ? Math.abs(q.u) * L.cur[i] : 0;
  gold = Math.min(gold, closing + room);
  if (gold < 1) { if (p.me) { toast(`これ以上は賭けられない(総資産の${lever}倍まで)`); sfx('bad'); } return false; }
  const du = side * gold / price;
  const nu = q.u + du;
  if (q.u === 0 || Math.sign(q.u) === Math.sign(du)) q.avg = (q.avg * Math.abs(q.u) + price * Math.abs(du)) / Math.abs(nu);
  else if (Math.sign(nu) !== Math.sign(q.u) && nu !== 0) q.avg = price;
  q.u = Math.abs(nu) < 1e-6 ? 0 : nu; if (!q.u) q.avg = 0;
  p.cash -= du * price;
  const tf = Math.min(TICKS, (performance.now() - L.t0) / 1000 / LIVE_SEC * TICKS);
  G.trades.push({ i, t: tf, price: L.cur[i], side, who: p.id });
  // 大きく売り買いすると、その分だけ値段が動く(それより前の線は変えない)
  L.impact[i] += side * gold / RES[i].depth;
  L.impHist[i].push({ t: tf, v: L.impact[i] });
  if (isCo(i)) checkControl(i, p);
  return true;
}
const owns = (p, k) => { const i = RES.findIndex(r => r.k === k); return i >= 0 && G.ctrl[i] === p.id; };
const share = (p, i) => Math.max(0, p.pos[i].u) / SHARES;
// 買収: 30% で名乗りをあげ(株価が跳ねる)、50% を超えたら支配
function checkControl(i, by) {
  const r = RES[i], s = share(by, i), key = by.id + ':' + i;
  if (s >= 0.3 && !G.tob[key] && G.ctrl[i] !== by.id) {
    G.tob[key] = 1;
    if (G.live) { G.live.impact[i] += 0.08; G.live.impHist[i].push({ t: Math.min(TICKS, (performance.now() - G.live.t0) / 1000 / LIVE_SEC * TICKS), v: G.live.impact[i] }); }
    flashBanner(`<b>${by.me ? 'あなた' : by.name}が${r.name}の買収に乗り出した!</b><small>株が買い集められ、株価が跳ね上がる</small>`, by.me ? 'gold' : 'bad');
    sfx('horn'); haptic(30); if (!by.me) speech(by, `${r.short}はいただくぞ`);
  }
  const holder = G.players.find(x => share(x, i) > 0.5) || null, prev = G.ctrl[i];
  G.ctrl[i] = holder ? holder.id : (prev != null && share(G.players[prev], i) > 0.5 ? prev : null);
  if (G.ctrl[i] !== prev) {
    if (G.ctrl[i] != null) {
      const w = G.players[G.ctrl[i]];
      flashBanner(`<b>買収成立!</b><small>${w.me ? 'あなた' : w.name}が${r.name}を支配した。${r.abilityText}</small>`, w.me ? 'gold' : 'bad');
      sfx(w.me ? 'rankup' : 'bad'); if (w.me) confetti(); else speech(w, '買収完了だ!'); shake(0.5);
    } else if (prev != null) {
      flashBanner(`<b>${G.players[prev].me ? 'あなた' : G.players[prev].name}が${r.name}の支配を失った</b>`, 'bad'); sfx('bad');
    }
    renderRivals(); renderChips();
  }
}
function closeAll(p, forced) { const L = G.live; p.pos.forEach((q, i) => { if (!q.u || (forced === 'res' && isCo(i))) return; const price = (L ? L.cur[i] : G.price[i]) * (1 - SPREAD * Math.sign(q.u)); p.cash += q.u * price; q.u = 0; q.avg = 0; }); }
function myTrade(side) {
  if (!G.live) return;
  const i = G.sel, p = me(), A = assets(p);
  const gold = G.amount === 'all' ? A * LEVER : G.amount;
  if (trade(p, i, gold, side)) {
    sfx(side > 0 ? 'coin' : 'kaching'); haptic(15);
    floatAt($(side > 0 ? '#bup' : '#bdn'), `${side > 0 ? '買い' : '売り'} ${fmt(Math.min(gold, A * LEVER))}G`, side > 0 ? 'up' : 'dn');
    burst($(side > 0 ? '#bup' : '#bdn'), side > 0 ? '#3ccf8e' : '#ff5a6a');
    feed(`あなたが${RES[i].name}を${side > 0 ? '買った' : '売った'}`, '#ffd36e');
    renderPos(); renderCtrl(); renderChips(); renderLiveNumbers();
  }
}
function myClose() {
  const L = G.live; if (!L) return; const p = me(), i = G.sel, q = p.pos[i]; if (!q.u) return;
  const side = -Math.sign(q.u), price = L.cur[i] * (1 + SPREAD * (owns(p, 'ship') ? 0.5 : 1) * side), gain = q.u * (price - q.avg), gold = Math.abs(q.u) * L.cur[i];
  p.cash += q.u * price;
  const tf = Math.min(TICKS, (performance.now() - L.t0) / 1000 / LIVE_SEC * TICKS);
  G.trades.push({ i, t: tf, price: L.cur[i], side, who: 0 });
  L.impact[i] += side * gold / RES[i].depth; L.impHist[i].push({ t: tf, v: L.impact[i] });
  p.pos[i] = { u: 0, avg: 0 };
  if (isCo(i)) checkControl(i, p);
  sfx(gain >= 0 ? 'coins' : 'bad', 5); haptic(25);
  floatAt($('#bclose'), `決済 ${sgn(gain)}G`, gain >= 0 ? 'up' : 'dn');
  if (gain > 0) burst($('#bclose'), '#ffd36e', 30);
  renderPos(); renderLiveNumbers();
}
// ライバルの考え方
function rivalTrade(p, t) {
  const L = G.live, A = assets(p);
  rivalStocks(p, t, A);
  for (let i = 0; i < RES.length; i++) {
    if (isCo(i)) continue;
    const f = forecast(i).up, move = L.cur[i] / L.open[i] - 1, q = p.pos[i], held = q.u * L.cur[i];
    let side = 0, size = 0;
    if (p.style === 'bull') {
      if (t < 20 && f >= 62 && held < A * 0.5) { side = 1; size = A * 0.25; }
      else if (move > 0.03 && held < A * 0.8 && Math.random() < 0.4) { side = 1; size = A * 0.15; }
      else if (f <= 38 && held > 0) { side = -1; size = held; }
    } else if (p.style === 'news') {
      const sure = G.news.find(n => n.r === i && n.rel > 0.7);
      if (sure && t < 16 && Math.abs(held) < A * 0.3) { side = sure.s; size = A * 0.3; }
      if (t > 60 && held !== 0 && Math.random() < 0.5) { side = -Math.sign(held); size = Math.abs(held); }
    } else {
      if (Math.abs(move) > 0.04 && Math.abs(held) < A * 0.4 && Math.random() < 0.5) { side = -Math.sign(move); size = A * 0.2; }
      else if (Math.abs(move) < 0.01 && held !== 0 && Math.random() < 0.3) { side = -Math.sign(held); size = Math.abs(held); }
    }
    if (side && size > 5 && trade(p, i, size, side)) {
      feed(`${p.name}が${RES[i].name}を${fmt(size)}G ${side > 0 ? '買った' : '売った'}`, p.color);
      if (size > A * 0.2 && Math.random() < 0.3) speech(p, p.say.buy);
    }
  }
}

function rivalStocks(p, t, A) {
  if (t % 8 !== 2) return;
  const L = G.live, buy = (i, g) => { if (trade(p, i, g, 1)) feed(`${p.name}が${RES[i].short}の株を${fmt(g)}G 買った`, p.color); };
  const sell = (i, g) => { if (trade(p, i, g, -1)) feed(`${p.name}が${RES[i].short}の株を売った`, p.color); };
  if (p.style === 'bull') {
    // ねらいの会社を買い集めて支配する
    const i = p.target; if (G.ctrl[i] !== p.id && Math.random() < 0.7) buy(i, A * rand(0.15, 0.3));
  } else if (p.style === 'news') {
    const i = p.target; if (share(p, i) < 0.35 && Math.random() < 0.5) buy(i, A * 0.15);
    // 買収されそうな会社の株は高く売り抜ける
    for (const j of coIdx()) if (j !== i && share(p, j) > 0 && L.cur[j] / L.open[j] > 1.08) sell(j, share(p, j) * SHARES * L.cur[j]);
  } else {
    for (const j of coIdx()) {
      const mv = L.cur[j] / L.open[j] - 1;
      if (mv < -0.04 && Math.random() < 0.4) buy(j, A * 0.12);
      else if ((mv > 0.06 || Object.keys(G.tob).some(k => k.endsWith(':' + j))) && share(p, j) > 0 && Math.random() < 0.5) sell(j, share(p, j) * SHARES * L.cur[j]);
    }
  }
}

// ── 月末: 結果
function closeMarket() {
  const L = G.live; G.live = null; G.phase = 'result'; G.fade = L.impact.slice();
  RES.forEach((r, i) => {
    G.hist[i].push({ o: L.open[i], c: L.cur[i], h: L.hi[i], l: L.lo[i], m: G.m });
    G.price[i] = L.cur[i];
  });
  for (const p of G.players) { p.div = 0; p.profit = 0; }
  for (const i of coIdx()) {
    const E = G.price[i] * SHARES * 0.02;   // 会社のひと月の利益(時価の2%)
    for (const p of G.players) { const s = share(p, i); if (s > 0) { const d = E * 0.3 * s; p.cash += d; p.div += d; } }
    if (G.ctrl[i] != null) { const w = G.players[G.ctrl[i]], x = E * 0.7; w.cash += x; w.profit += x; }
  }
  for (const p of G.players) {
    const A = assets(p, G.price), d = A - p.startAssets;
    if (p.hedge && d < 0) { p.cash += -d / 2; p.hedgeBack = -d / 2; } else p.hedgeBack = 0;
  }
  sfx('whoosh');
  showResult();
}

// ── 株主総会(3か月ごと): 筆頭株主が議案を出し、持ち株の数で投票する
const PROPOSALS = {
  div: { name: '特別配当', text: '株主に1株あたり 株価の6% を配る(株価は少し下がる)' },
  buyback: { name: '自社株買い', text: '会社が自分の株を買い戻す。株価 +8%' },
  expand: { name: '新事業に挑戦', text: 'これから数か月、株価が上がりやすいが、荒れる' },
  ceo: { name: '社長を交代', text: '筆頭株主が選んだ社長で、利益が上がる(株価 +5%、しばらく上がりやすい)' },
};
function meetingsDue() { return (G.m + 1) % 3 === 0 && G.m + 1 < G.months; }
function planMeetings() {
  G.meetingQueue = coIdx().filter(i => share(me(), i) > 0 && G.players.some(p => share(p, i) >= 0.1)).map(i => {
    const top = G.players.slice().sort((a, b) => share(b, i) - share(a, i))[0];
    return { i, top: top.id };
  });
}
function nextMeeting() {
  const m = G.meetingQueue.shift();
  if (!m) { $('#screen').innerHTML = ''; G.m++; setTimeout(planMonth, 250); return; }
  const i = m.i, r = RES[i], top = G.players[m.top];
  if (top.me) {
    $('#screen').innerHTML = `<div class="meet"><div class="mcard"><div class="mh">${img(r.icon)}<div><small>株主総会</small><b>${r.name}</b></div></div>
      <div class="mt">あなたが筆頭株主(${Math.round(share(top, i) * 100)}%)。議案を選ぼう</div>
      <div class="props">${Object.entries(PROPOSALS).map(([k, P]) => `<button class="prop" data-a="propose" data-v="${k}" data-i="${i}"><b>${P.name}</b><small>${P.text}</small></button>`).join('')}</div></div></div>`;
    sfx('notify');
    return;
  }
  const k = top.style === 'bull' ? pick(['expand', 'ceo', 'buyback']) : top.style === 'news' ? pick(['div', 'div', 'buyback']) : pick(['buyback', 'div']);
  showVote(i, k, top);
}
function showVote(i, k, proposer) {
  const r = RES[i], P = PROPOSALS[k], mine = share(me(), i);
  G.vote = { i, k, proposer: proposer.id };
  $('#screen').innerHTML = `<div class="meet"><div class="mcard"><div class="mh">${img(r.icon)}<div><small>株主総会</small><b>${r.name}</b></div></div>
    <div class="mt">${proposer.me ? 'あなた' : proposer.name}の議案:<b>「${P.name}」</b><small>${P.text}</small></div>
    <div class="votes">${G.players.filter(p => share(p, i) > 0).map(p => `<div class="vrow" style="--c:${p.color}">${img(p.icon)}<b>${p.me ? 'あなた' : p.name}</b><span>${Math.round(share(p, i) * 100)}票</span><em id="vv${p.id}"></em></div>`).join('')}</div>
    <div class="vbar"><i class="yes" id="vyes"></i><i class="no" id="vno"></i></div>
    ${mine > 0 ? `<div class="vbtns"><button class="btn yes" data-a="vote" data-v="1">賛成(${Math.round(mine * 100)}票)</button><button class="btn no" data-a="vote" data-v="0">反対</button></div>` : `<button class="btn go" data-a="vote" data-v="-1">結果を見る(あなたは株を持っていない)</button>`}</div></div>`;
  sfx('card');
}
function castVote(myVote) {
  const { i, k, proposer } = G.vote, r = RES[i];
  let yes = 0, no = 0;
  const said = {};
  for (const p of G.players) {
    const s = share(p, i); if (s <= 0) continue;
    let v;
    if (p.me) v = myVote; else if (p.id === proposer) v = 1;
    else if (p.style === 'bull') v = k === 'div' ? 0 : 1;
    else if (p.style === 'news') v = k === 'expand' ? 0 : 1;
    else v = G.players[proposer].style === 'contra' ? 1 : (k === 'buyback' ? 1 : 0);
    if (v === 1) yes += s; else if (v === 0) no += s;
    said[p.id] = v;
  }
  const pass = yes > no;
  for (const p of G.players) { const e = $('#vv' + p.id); if (e && said[p.id] != null) { e.textContent = said[p.id] === 1 ? '賛成' : '反対'; e.className = said[p.id] === 1 ? 'up' : 'dn'; } }
  const tot = Math.max(0.01, yes + no); $('#vyes').style.width = yes / tot * 100 + '%'; $('#vno').style.width = no / tot * 100 + '%';
  setTimeout(() => {
    if (pass) {
      if (k === 'div') for (const p of G.players) { const d = share(p, i) * SHARES * G.price[i] * 0.06; p.cash += d; }
      if (k === 'div') G.price[i] *= 0.97;
      if (k === 'buyback') G.price[i] *= 1.08;
      if (k === 'expand') G.boost[i] += 0.06;
      if (k === 'ceo') { G.price[i] *= 1.05; G.boost[i] += 0.04; }
    }
    flashBanner(`<b>${pass ? '可決!' : '否決'}</b><small>${r.name}「${PROPOSALS[k].name}」 賛成${Math.round(yes * 100)}票・反対${Math.round(no * 100)}票</small>`, pass ? 'gold' : 'bad');
    sfx(pass ? 'kaching' : 'bad'); renderTop(); renderRivals(); renderChips();
    setTimeout(nextMeeting, 1400);
  }, 900);
}
function showResult() {
  const p = me(), A = assets(p, G.price), d = A - p.startAssets, rk = ranking(), pos = rk.indexOf(p) + 1;
  const prevPos = G.lastPos || pos; G.lastPos = pos;
  const last = G.m + 1 >= G.months;
  const big = d / Math.max(1, p.startAssets);
  $('#sheet').innerHTML = `<div class="res ${d >= 0 ? 'win' : 'lose'}"><div class="rh">${MONTHS[G.m % 12]}の結果</div>
    <div class="rbig" id="rbig">${sgn(0)}G</div><div class="rsub">総資産 ${fmt(A)}G${p.hedgeBack ? ` <em>保険で ${fmt(p.hedgeBack)}G 戻った</em>` : ''}${p.div ? ` <em>配当 +${fmt(p.div)}G</em>` : ''}${p.profit ? ` <em>支配している会社の利益 +${fmt(p.profit)}G</em>` : ''}</div>
    <div class="rres">${RES.map((r, i) => i).filter(i => (RES[i].kind === 'co') === (G.tab === 'co')).map(i => RES[i]).map((r) => { const i = RES.indexOf(r); const c = G.hist[i][G.hist[i].length - 1], ch = c.c / c.o - 1; return `<div class="rr">${img(r.icon)}<b>${r.name}</b><span class="${ch >= 0 ? 'up' : 'dn'}">${ch >= 0 ? '▲' : '▼'} ${pct(ch)}</span></div>`; }).join('')}</div>
    <div class="rrank">${rk.map((x, k) => `<div class="rk ${x.me ? 'me' : ''}"><span class="n">${k + 1}</span>${img(x.icon)}<b>${x.name}</b><span>${fmt(assets(x, G.price))}G</span><small class="${assets(x, G.price) - x.startAssets >= 0 ? 'up' : 'dn'}">${sgn(assets(x, G.price) - x.startAssets)}</small></div>`).join('')}</div>
    <button class="btn go" data-a="${last ? 'final' : 'next'}">${last ? '最終結果へ' : meetingsDue() ? '株主総会へ' : `${MONTHS[(G.m + 1) % 12]}へ`}</button></div>`;
  showSheet();
  countUp($('#rbig'), d, (v) => `${sgn(v)}G`);
  if (big > 0.15) { confetti(); sfx('rankup'); flashBanner('<b>大当たり!</b>', 'gold'); }
  else if (big < -0.12) { shake(0.7); sfx('bad'); }
  if (pos < prevPos) setTimeout(() => { flashBanner(`<b>${pos}位に上がった!</b>`, 'gold'); sfx('rankup'); }, 900);
  const winner = rk[0]; if (!winner.me && Math.random() < 0.6) setTimeout(() => speech(winner, winner.say.win), 600);
  renderTop(); renderRivals();
}
function finalResult() {
  for (const p of G.players) closeAll(p);   // 株も時価で現金にして比べる
  const rk = ranking(), pos = rk.findIndex(p => p.me) + 1, best = (() => { try { return +localStorage.getItem('war-best') || 0; } catch (e) { return 0; } })(), mine = assets(me(), G.price);
  if (mine > best) try { localStorage.setItem('war-best', String(Math.round(mine))); } catch (e) { }
  G.phase = 'over'; bgm.play(pos === 1 ? 'matsuri' : 'ouji');
  $('#screen').innerHTML = `<div class="final ${pos === 1 ? 'win' : ''}"><div class="fcard"><div class="ft">${pos === 1 ? '商会戦争 優勝!' : `${pos}位`}</div>
    <div class="fs">総資産 ${fmt(mine)}G(はじめ ${fmt(START_CASH)}G)${mine > best ? '<em>自己ベスト!</em>' : ''}</div>
    <div class="rrank">${rk.map((x, k) => `<div class="rk ${x.me ? 'me' : ''}"><span class="n">${k + 1}</span>${img(x.icon)}<b>${x.name}</b><span>${fmt(assets(x, G.price))}G</span></div>`).join('')}</div>
    <div class="fbtns"><button class="btn go" data-a="start" data-v="${G.months}">もう一度</button><button class="btn" data-a="title">タイトルへ</button></div></div></div>`;
  hideSheet();
  if (pos === 1) { confetti(); confetti(); sfx('rankup'); } else sfx('bad');
}

// ── 画面
function render() {
  if (!G) return;
  renderTop(); renderRivals(); renderChips(); renderPos(); renderCtrl(); drawChart();
  if (G.phase === 'plan') renderPlan();
}
function renderTop() {
  const p = me(), A = assets(p), rk = ranking().indexOf(p) + 1;
  $('#top').innerHTML = `<div class="month"><b>${MONTHS[G.m % 12]}</b><small>${G.m + 1} / ${G.months}か月</small></div>
    <div class="money"><span class="cash">${img('coin')}<b id="assetv">${fmt(A)}</b>G</span><small>総資産(現金 ${fmt(p.cash)}G)</small></div>
    <div class="rank"><b>${rk}</b>位</div>`;
}
function renderRivals() {
  const rk = ranking();
  $('#rivals').innerHTML = rk.map((p, k) => `<div class="rv ${p.me ? 'me' : ''}" style="--c:${p.color}" id="rv${p.id}"><span class="n">${k + 1}</span>${img(p.icon)}<div><b>${p.name}</b><small>${fmt(assets(p))}G</small></div></div>`).join('');
}
function renderChips() {
  $('#tabs').innerHTML = `<button class="${G.tab === 'res' ? 'on' : ''}" data-a="tab" data-v="res">${img('wheat')}資源</button><button class="${G.tab === 'co' ? 'on' : ''}" data-a="tab" data-v="co">${img('o_chartup')}株・企業</button>`;
  $('#chips').innerHTML = RES.map((r, i) => {
    if ((r.kind === 'co') !== (G.tab === 'co')) return '';
    const f = G.phase === 'plan' ? forecast(i) : null, cur = curPrices()[i], open = G.live ? G.live.open[i] : (G.hist[i].length ? G.hist[i][G.hist[i].length - 1].o : cur), ch = cur / open - 1;
    return `<button class="chip ${i === G.sel ? 'on' : ''}" data-a="sel" data-from="chip" data-v="${i}" style="--c:${r.color}">${img(r.icon)}<b>${r.short || r.name}</b><span class="pr" id="pr${i}">${priceStr(cur)}</span>
      ${r.kind === 'co' ? `<small class="own">${me().pos[i].u > 0 ? Math.round(share(me(), i) * 100) + '%' : ''}</small>` : ''}
      ${f ? `<span class="fc ${f.up >= 55 ? 'up' : f.up <= 45 ? 'dn' : ''}">${f.sure ? '確定 ' : ''}${f.up >= 50 ? '▲' : '▼'}${f.up >= 50 ? f.up : 100 - f.up}%</span>` : `<span class="ch ${ch >= 0 ? 'up' : 'dn'}" id="ch${i}">${pct(ch)}</span>`}
      ${me().pos[i].u ? `<i class="hold ${me().pos[i].u > 0 ? 'up' : 'dn'}"></i>` : ''}${r.kind === 'co' && G.ctrl[i] != null ? `<i class="crown" style="--c:${G.players[G.ctrl[i]].color}">${img(G.players[G.ctrl[i]].icon)}</i>` : ''}</button>`;
  }).join('');
}
function renderPos() {
  const p = me(), i = G.sel, q = p.pos[i], cur = curPrices()[i], r = RES[i];
  const pl = q.u ? q.u * (cur * (1 - SPREAD * Math.sign(q.u)) - q.avg) : 0;
  const ch = $('#bclose'); if (ch) ch.disabled = !(G.phase === 'live' && q.u);
  if (isCo(i)) {
    const s = share(p, i), c = G.ctrl[i], others = G.players.filter(x => !x.me && share(x, i) > 0).map(x => `${x.name}${Math.round(share(x, i) * 100)}%`).join('・');
    $('#pos').innerHTML = `<div class="pl co ${pl > 0 ? 'up' : pl < 0 ? 'dn' : ''}"><small>${r.name}: あなた ${Math.round(s * 100)}%${others ? `(${others})` : ''}${c != null ? ` ・支配: ${G.players[c].me ? 'あなた' : G.players[c].name}` : ''}</small>
      <b id="plv">${q.u ? sgn(pl) + 'G' : (G.phase === 'live' ? '株を買う?' : '—')}</b><small>${c === 0 ? `支配中: ${r.abilityText}` : s > 0.5 ? '' : `支配(50%超)まで あと${Math.max(0, Math.ceil(SHARES * 0.5 - s * SHARES + 0.01))}株・毎月 配当あり`}</small></div>`;
    return;
  }
  $('#pos').innerHTML = q.u ? `<div class="pl ${pl >= 0 ? 'up' : 'dn'}"><small>${r.name}に「${q.u > 0 ? '上がる' : '下がる'}」で ${fmt(Math.abs(q.u * q.avg))}G 賭け中</small><b id="plv">${sgn(pl)}G</b><small>平均 ${priceStr(q.avg)} → いま <span id="plcur">${priceStr(cur)}</span></small></div>`
    : `<div class="pl none"><small>${r.name}にはまだ賭けていない</small><b>${G.phase === 'live' ? '上がる?下がる?' : G.phase === 'plan' ? 'ニュースを読もう' : '—'}</b></div>`;
}
function renderLiveNumbers() {
  const pr = curPrices();
  RES.forEach((r, i) => { const e = $('#pr' + i); if (e) e.textContent = priceStr(pr[i]); const c = $('#ch' + i); if (c && G.live) { const ch = pr[i] / G.live.open[i] - 1; c.textContent = pct(ch); c.className = 'ch ' + (ch >= 0 ? 'up' : 'dn'); } });
  const a = $('#assetv'); if (a) a.textContent = fmt(assets(me()));
  const rk = $('#top .rank b'); if (rk) rk.textContent = ranking().indexOf(me()) + 1;
  const p = me(), q = p.pos[G.sel];
  if (q.u) { const pl = q.u * (pr[G.sel] * (1 - SPREAD * Math.sign(q.u)) - q.avg), e = $('#plv'); if (e) { e.textContent = sgn(pl) + 'G'; e.parentElement.className = 'pl ' + (isCo(G.sel) ? 'co ' : '') + (pl >= 0 ? 'up' : 'dn'); } const c = $('#plcur'); if (c) c.textContent = priceStr(pr[G.sel]); }
  if (G.live && G.live.tick % 6 === 0) renderRivals();
}
function renderCtrl() {
  const live = G.phase === 'live';
  const amts = [[100, '100G'], [300, '300G'], [1000, '1000G'], ['all', '全力']];
  $('#ctrl').innerHTML = `<div class="amts">${amts.map(([v, t]) => `<button class="amt ${G.amount === v ? 'on' : ''}" data-a="amt" data-v="${v}">${t}</button>`).join('')}</div>
    <div class="trade"><button class="tb up" id="bup" data-a="buy" ${live ? '' : 'disabled'}><b>${isCo(G.sel) ? '株を買う' : '上がる'}</b><small>${isCo(G.sel) ? '配当・買収' : '買う'}</small></button>
    <button class="tb close" id="bclose" data-a="closepos" ${live && me().pos[G.sel].u ? '' : 'disabled'}><b>決済</b><small>利益・損を確定</small></button>
    <button class="tb dn" id="bdn" data-a="sell" ${live ? '' : 'disabled'}><b>${isCo(G.sel) ? '株を売る' : '下がる'}</b><small>${isCo(G.sel) ? '持っている分だけ' : '売る'}</small></button></div>`;
}
function renderPlan() {
  const log = G.cardLog || []; G.cardLog = [];
  const p = me();
  $('#sheet').classList.remove('mini');
  $('#sheet').innerHTML = `<div class="plan"><div class="ph" data-a="mini">${MONTHS[G.m % 12]}のニュース<small>読んでから市場をひらこう。ニュースをタップするとチャートの予想が見える</small></div>
    ${G.news.map(n => `<div class="news ${n.rel > 0.7 ? 'sure' : 'rumor'}" data-a="sel" data-v="${n.r}">${img(RES[n.r].icon)}<div><span class="tag">${n.rel > 0.7 ? '確かな筋' : 'うわさ'}</span><b>${n.text}</b><small>${RES[n.r].name}が${n.s > 0 ? '上がる' : '下がる'}かも(当たる確率 約${Math.round(n.rel * 100)}%)</small></div></div>`).join('')}
    ${G.players.slice(1).filter(x => x.used && x.used.k !== 'spy' && x.used.k !== 'hedge').map(x => `<div class="enemy" style="--c:${x.color}">${img(x.icon)}<div><b>${x.name}が「${CARDS[x.used.k].name}」を使った!</b><small>${x.used.k === 'seize' ? `${G.players[x.used.target].name}の持ち物が売られた` : `${RES[x.used.target].name}が${x.used.k === 'pump' ? '上がり' : '下がり'}やすくなった`}</small></div></div>`).join('')}
    <div class="hand"><div class="hl">戦争カード(月に1枚)</div><div class="cards">${p.hand.map((k, j) => `<button class="card ${p.used ? 'dim' : ''}" data-a="card" data-v="${j}">${img(CARDS[k].icon)}<b>${CARDS[k].name}</b><small>${CARDS[k].text}</small></button>`).join('') || '<small class="none">カードがない</small>'}</div>
    ${p.used ? `<div class="usedc">使った:「${CARDS[p.used.k].name}」${p.used.target != null ? (CARDS[p.used.k].target === 'res' ? ` → ${RES[p.used.target].name}` : ` → ${G.players[p.used.target].name}`) : ''}</div>` : ''}</div>
    <button class="btn go big" data-a="open">市場をひらく(${LIVE_SEC}秒)</button></div>`;
  showSheet();
  log.forEach((l, k) => setTimeout(() => { speech(l.p, l.p.say.card); sfx('card'); }, 500 + k * 900));
}
function chooseTarget(k, j) {
  const C = CARDS[k];
  const opts = C.target === 'res' ? RES.map((r, i) => `<button class="opt" data-a="target" data-k="${k}" data-j="${j}" data-v="${i}">${img(r.icon)}<b>${r.name}</b></button>`)
    : G.players.slice(1).map(p => `<button class="opt" data-a="target" data-k="${k}" data-j="${j}" data-v="${p.id}">${img(p.icon)}<b>${p.name}</b><small>持ち物 ${fmt(exposure(p, G.price))}G</small></button>`);
  $('#screen').innerHTML = `<div class="pick"><div class="pcard"><div class="pt">「${C.name}」をどれに使う?</div><div class="opts">${opts.join('')}</div><button class="btn" data-a="cancelpick">やめる</button></div></div>`;
}

// ── チャート
const cv = $('#chart'), cx = cv.getContext('2d');
let chartFlashUntil = 0, chartFlashColor = '#fff';
function chartFlash(c) { chartFlashUntil = performance.now() + 350; chartFlashColor = c; }
function drawChart() {
  if (!G) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
  const i = G.sel, r = RES[i], hist = G.hist[i].slice(-7), L = G.live;
  const padR = 52, padT = 14, padB = 22, plotW = W - padR - 8, histW = plotW * 0.52, liveX0 = 8 + histW + 8, liveW = plotW - histW - 16;
  // 値の範囲
  let lo = Infinity, hi = -Infinity;
  for (const c of hist) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); }
  const cur = curPrices()[i];
  lo = Math.min(lo, cur); hi = Math.max(hi, cur);
  let fc = null;
  if (G.phase === 'plan') { fc = forecast(i); const sp = r.vol * 1.6 + 0.06; lo = Math.min(lo, cur * (1 - sp)); hi = Math.max(hi, cur * (1 + sp)); }
  if (L) { const pts = L.path[i]; for (let t = 0; t <= TICKS; t++) { /* 先の値は見せないが、目盛りは広めに */ } lo = Math.min(lo, L.lo[i], cur * 0.9); hi = Math.max(hi, L.hi[i], cur * 1.1); }
  const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
  const Y = (p) => padT + (1 - (p - lo) / (hi - lo)) * (H - padT - padB);
  // 背景の目盛り
  cx.font = '600 10px "M PLUS Rounded 1c", sans-serif'; cx.textAlign = 'left';
  for (let k = 0; k <= 4; k++) { const p = lo + (hi - lo) * k / 4, y = Y(p); cx.strokeStyle = 'rgba(255,255,255,.07)'; cx.beginPath(); cx.moveTo(8, y); cx.lineTo(W - padR, y); cx.stroke(); cx.fillStyle = 'rgba(255,255,255,.4)'; cx.fillText(priceStr(p), W - padR + 6, y + 3); }
  // ろうそく(月ごと)
  const cw = histW / Math.max(7, hist.length);
  hist.forEach((c, k) => {
    const x = 8 + cw * (k + 0.5), up = c.c >= c.o, col = up ? '#3ccf8e' : '#ff5a6a';
    cx.strokeStyle = col; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(x, Y(c.h)); cx.lineTo(x, Y(c.l)); cx.stroke();
    const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c));
    cx.fillStyle = col; cx.fillRect(x - cw * 0.3, y1, cw * 0.6, Math.max(2, y2 - y1));
    cx.fillStyle = 'rgba(255,255,255,.45)'; cx.textAlign = 'center'; cx.fillText(c.m < 0 ? '' : MONTHS[c.m % 12].replace('月', ''), x, H - 6);
  });
  // 今月(市場が開いている間): 線で
  const x0 = liveX0, sx = (t) => x0 + liveW * t / TICKS;
  cx.fillStyle = 'rgba(255,255,255,.04)'; cx.fillRect(x0 - 4, padT - 6, liveW + 8, H - padT - padB + 10);
  cx.fillStyle = 'rgba(255,255,255,.55)'; cx.textAlign = 'center'; cx.fillText(G.phase === 'plan' ? `${MONTHS[G.m % 12]}の予想` : MONTHS[G.m % 12], x0 + liveW / 2, H - 6);
  const open = L ? L.open[i] : (G.price[i]);
  cx.setLineDash([4, 4]); cx.strokeStyle = 'rgba(255,255,255,.25)'; cx.beginPath(); cx.moveTo(x0, Y(open)); cx.lineTo(x0 + liveW, Y(open)); cx.stroke(); cx.setLineDash([]);
  let lastX = x0, lastY = Y(cur);
  if (L) {
    const tf = Math.min(TICKS, (performance.now() - L.t0) / 1000 / LIVE_SEC * TICKS), p = L.path[i];
    const ih = L.impHist[i], impAt = (t) => { let v = 0; for (const e of ih) { if (e.t <= t) v = e.v; else break; } return v; };
    const P = (t) => p.o * Math.exp(p.pts[Math.floor(t)] + (p.pts[Math.min(TICKS, Math.floor(t) + 1)] - p.pts[Math.floor(t)]) * (t - Math.floor(t)) + impAt(t));
    const grad = cx.createLinearGradient(0, padT, 0, H - padB); grad.addColorStop(0, r.color + '55'); grad.addColorStop(1, r.color + '00');
    cx.beginPath(); cx.moveTo(sx(0), Y(P(0)));
    for (let t = 0.5; t < tf; t += 0.5) cx.lineTo(sx(t), Y(P(t)));
    cx.lineTo(sx(tf), Y(cur)); lastX = sx(tf); lastY = Y(cur);
    cx.save(); cx.lineTo(lastX, H - padB); cx.lineTo(sx(0), H - padB); cx.closePath(); cx.fillStyle = grad; cx.fill(); cx.restore();
    cx.beginPath(); cx.moveTo(sx(0), Y(P(0))); for (let t = 0.5; t < tf; t += 0.5) cx.lineTo(sx(t), Y(P(t))); cx.lineTo(lastX, lastY);
    cx.strokeStyle = r.color; cx.lineWidth = 2.5; cx.shadowColor = r.color; cx.shadowBlur = 10; cx.stroke(); cx.shadowBlur = 0;
    // ニュースの瞬間
    if (L.shockShown[i]) { const x = sx(p.shock); cx.strokeStyle = 'rgba(255,211,110,.6)'; cx.setLineDash([3, 3]); cx.beginPath(); cx.moveTo(x, padT); cx.lineTo(x, H - padB); cx.stroke(); cx.setLineDash([]); cx.fillStyle = '#ffd36e'; cx.fillText('ニュース', x, padT + 8); }
    // 売り買いの印
    for (const tr of G.trades) if (tr.i === i) {
      const x = sx(Math.min(tf, tr.t)), y = Y(tr.price), col = G.players[tr.who].color;
      cx.fillStyle = col; cx.beginPath();
      if (tr.side > 0) { cx.moveTo(x, y + 6); cx.lineTo(x - 6, y + 15); cx.lineTo(x + 6, y + 15); } else { cx.moveTo(x, y - 6); cx.lineTo(x - 6, y - 15); cx.lineTo(x + 6, y - 15); }
      cx.closePath(); cx.fill(); if (tr.who === 0) { cx.strokeStyle = '#fff'; cx.lineWidth = 1.5; cx.stroke(); }
    }
  }
  // 予想(月のはじめ): 向きと幅
  if (fc) {
    const exp = (fc.up - 50) / 50 * (r.vol * 1.3 + 0.04), sp = r.vol * (fc.sure ? 0.4 : 1.1);
    const xa = x0, xb = x0 + liveW, ya = Y(cur);
    cx.beginPath(); cx.moveTo(xa, ya); cx.lineTo(xb, Y(cur * Math.exp(exp + sp))); cx.lineTo(xb, Y(cur * Math.exp(exp - sp))); cx.closePath();
    const col = fc.up >= 55 ? '#3ccf8e' : fc.up <= 45 ? '#ff5a6a' : '#aab0c8';
    cx.fillStyle = col + '30'; cx.fill();
    cx.strokeStyle = col; cx.lineWidth = 2.5; cx.setLineDash([6, 4]); cx.beginPath(); cx.moveTo(xa, ya); cx.lineTo(xb - 6, Y(cur * Math.exp(exp))); cx.stroke(); cx.setLineDash([]);
    const ex = xb - 6, ey = Y(cur * Math.exp(exp)), ang = Math.atan2(ey - ya, ex - xa);
    cx.fillStyle = col; cx.beginPath(); cx.moveTo(ex + 8 * Math.cos(ang), ey + 8 * Math.sin(ang)); cx.lineTo(ex + 9 * Math.cos(ang + 2.4), ey + 9 * Math.sin(ang + 2.4)); cx.lineTo(ex + 9 * Math.cos(ang - 2.4), ey + 9 * Math.sin(ang - 2.4)); cx.fill();
    cx.font = '900 15px "M PLUS Rounded 1c", sans-serif'; cx.fillStyle = col; cx.textAlign = 'center';
    cx.fillText(`${fc.sure ? '確定 ' : ''}${fc.up >= 50 ? '上がる' : '下がる'} ${fc.up >= 50 ? fc.up : 100 - fc.up}%`, x0 + liveW / 2, padT + 14);
  }
  // 自分の平均の値段
  const q = me().pos[i];
  if (isCo(i)) {
    const c = G.ctrl[i]; cx.font = '800 11px "M PLUS Rounded 1c", sans-serif'; cx.textAlign = 'left'; cx.fillStyle = c != null ? G.players[c].color : 'rgba(255,255,255,.5)';
    cx.fillText(c != null ? `支配: ${G.players[c].me ? 'あなた' : G.players[c].name}` : '支配している人はいない', 10, H - padB - 6);
  }
  if (q.u) { const y = Y(q.avg); cx.strokeStyle = q.u > 0 ? '#3ccf8e' : '#ff5a6a'; cx.setLineDash([2, 3]); cx.beginPath(); cx.moveTo(8, y); cx.lineTo(W - padR, y); cx.stroke(); cx.setLineDash([]); cx.font = '800 10px "M PLUS Rounded 1c", sans-serif'; cx.textAlign = 'left'; cx.fillStyle = cx.strokeStyle; cx.fillText(`あなたの平均 ${priceStr(q.avg)}`, 10, y - 4); }
  // 今の値段の札
  cx.font = '900 12px "M PLUS Rounded 1c", sans-serif';
  const up = cur >= open, tag = up ? '#3ccf8e' : '#ff5a6a';
  cx.fillStyle = tag; cx.beginPath(); cx.arc(lastX, lastY, 4.5, 0, Math.PI * 2); cx.fill();
  if (L) { cx.globalAlpha = 0.35 + 0.35 * Math.sin(performance.now() / 120); cx.beginPath(); cx.arc(lastX, lastY, 10, 0, Math.PI * 2); cx.fill(); cx.globalAlpha = 1; }
  const tw = 48; cx.fillStyle = tag; roundRect(W - padR + 2, lastY - 10, tw, 20, 6); cx.fill(); cx.fillStyle = '#0b1020'; cx.textAlign = 'center'; cx.fillText(priceStr(cur), W - padR + 2 + tw / 2, lastY + 4);
  if (performance.now() < chartFlashUntil) { cx.fillStyle = chartFlashColor; cx.globalAlpha = (chartFlashUntil - performance.now()) / 350 * 0.25; cx.fillRect(0, 0, W, H); cx.globalAlpha = 1; }
}
function roundRect(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }

// ── 演出
function feed(text, color) { const el = document.createElement('div'); el.className = 'fd'; el.style.color = color; el.textContent = text; const f = $('#feed'); f.prepend(el); while (f.children.length > 3) f.lastChild.remove(); setTimeout(() => el.classList.add('old'), 2500); }
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; $('#fx').appendChild(el); setTimeout(() => el.remove(), 1800); }
function flashBanner(html, cls = '') { const el = document.createElement('div'); el.className = 'banner ' + cls; el.innerHTML = html; $('#fx').appendChild(el); setTimeout(() => el.remove(), 1500); }
function floatAt(target, text, cls) { if (!target) return; const r = target.getBoundingClientRect(), el = document.createElement('div'); el.className = 'flt ' + cls; el.textContent = text; el.style.left = r.left + r.width / 2 + 'px'; el.style.top = r.top + 'px'; $('#fx').appendChild(el); setTimeout(() => el.remove(), 1100); }
function burst(target, color, n = 16) { if (!target) return; const r = target.getBoundingClientRect(); for (let k = 0; k < n; k++) { const el = document.createElement('i'); el.className = 'spark'; const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60; el.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${color};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`; $('#fx').appendChild(el); setTimeout(() => el.remove(), 700); } }
function shake(s = 0.4) { document.body.style.setProperty('--sh', s * 10 + 'px'); document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); }
function confetti() { const cols = ['#ffd36e', '#3ccf8e', '#5aa8ff', '#ff9ac0', '#c79bff']; for (let k = 0; k < 60; k++) { const el = document.createElement('i'); el.className = 'conf'; el.style.cssText = `left:${Math.random() * 100}vw;background:${pick(cols)};animation-delay:${Math.random() * 0.4}s;--rot:${rand(-720, 720)}deg`; $('#fx').appendChild(el); setTimeout(() => el.remove(), 2200); } }
function speech(p, text) { const rv = $('#rv' + p.id); if (!rv) return; const r = rv.getBoundingClientRect(), el = document.createElement('div'); el.className = 'say'; el.style.setProperty('--c', p.color); el.innerHTML = `${img(p.icon)}<span>${text}</span>`; el.style.left = clamp(r.left, 8, innerWidth - 230) + 'px'; el.style.top = r.bottom + 6 + 'px'; $('#fx').appendChild(el); setTimeout(() => el.remove(), 2200); }
function countUp(el, to, f) { if (!el) return; const t0 = performance.now(); const step = (now) => { const k = Math.min(1, (now - t0) / 900), v = to * (1 - Math.pow(1 - k, 3)); el.textContent = f(v); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
function showSheet() { $('#sheet').classList.add('on'); }
function hideSheet() { $('#sheet').classList.remove('on'); }

// ── タイトル・あそびかた
const HOW = [
  { t: '相場で勝ち抜け', b: '資源は5つ(小麦・鉄・薬草・布・星銀)。<b>12か月後の総資産</b>がいちばん多い商会の勝ち。', ic: 'o_trophy' },
  { t: 'ニュースと予想を読む', b: '月のはじめにニュースが出る。<b>確かな筋</b>はよく当たり、<b>うわさ</b>は半分くらい。チャートに「上がる 85%」のような予想が出る。', ic: 'o_envelope' },
  { t: '市場は12秒だけ開く', b: '値段がリアルタイムに動く。<b>上がる(買う)</b>か<b>下がる(売る)</b>に賭けて、いいところで<b>決済</b>。ニュースの瞬間に値段が跳ねる。総資産の2倍まで賭けられる。', ic: 'o_chartup' },
  { t: '株を買って、買収する', b: '「株・企業」のタブで会社の株が買える。毎月<b>配当</b>が入る。<b>30%</b>集めると買収に名乗り、<b>50%を超える</b>と会社を支配して、利益と特典(銀行なら賭けの上限3倍など)が手に入る。3か月ごとに<b>株主総会</b>で投票。', ic: 'o_crown' },
  { t: '戦争カードで仕掛ける', b: '月に1枚。<b>買い占め</b>・<b>悪いうわさ</b>で相場を動かし、<b>差し押さえ</b>でライバルの持ち物を売らせる。ライバルも使ってくる。', ic: 'o_swords' },
];
function showTitle() {
  G = null; bgm.play('asa');
  let best = 0; try { best = +localStorage.getItem('war-best') || 0; } catch (e) { }
  $('#screen').innerHTML = `<div class="title"><div class="logo"><small>キャピタル</small><b>商会戦争</b><span>相場で勝ち抜け</span></div>
    <div class="tchart">${img('o_chartup', 'big')}${img('starsilver', 'mid')}${img('iron', 'mid2')}</div>
    <div class="tbtns"><button class="btn go big" data-a="start" data-v="12">はじめる(12か月)</button><button class="btn" data-a="start" data-v="6">さくっと(6か月)</button><button class="btn" data-a="how">あそびかた</button></div>
    ${best ? `<div class="best">自己ベスト ${fmt(best)}G</div>` : ''}<a class="back" href="../">商会バトルへ</a></div>`;
}
function showHow(i = 0, then) {
  const h = HOW[i]; showHow.then = then ?? showHow.then;
  document.querySelector('.how')?.remove();
  $('#screen').insertAdjacentHTML('beforeend', `<div class="how"><div class="hcard"><div class="hn">${i + 1} / ${HOW.length}</div>${img(h.ic, 'hic')}<b>${h.t}</b><p>${h.b}</p>
    <div class="hbtns">${i ? `<button class="btn" data-a="howgo" data-v="${i - 1}">もどる</button>` : ''}<button class="btn go" data-a="${i < HOW.length - 1 ? 'howgo' : 'howend'}" data-v="${i + 1}">${i < HOW.length - 1 ? 'つぎへ' : 'はじめる'}</button></div></div></div>`);
}
function start(months) {
  unlockAudio(); $('#screen').innerHTML = '';
  newGame(months); G.m = 0;
  planMonth();
}

// ── 操作
const ACT = {
  start: (d) => { let seen = false; try { seen = localStorage.getItem('war-how') === '1'; } catch (e) { } if (!seen) { showHow(0, +d.v); return; } start(+d.v); },
  how: () => showHow(0, null), howgo: (d) => showHow(+d.v),
  howend: () => { document.querySelector('.how')?.remove(); try { localStorage.setItem('war-how', '1'); } catch (e) { } if (showHow.then) { const m = showHow.then; showHow.then = null; start(m); } },
  title: () => showTitle(),
  sel: (d) => { G.sel = +d.v; G.tab = isCo(G.sel) ? 'co' : 'res'; sfx('tap'); renderChips(); renderPos(); renderCtrl(); drawChart(); if (G.phase === 'plan' && d.from !== 'chip') $('#sheet').classList.add('mini'); },
  mini: () => { $('#sheet').classList.toggle('mini'); },
  amt: (d) => { G.amount = d.v === 'all' ? 'all' : +d.v; sfx('toggle'); renderCtrl(); },
  buy: () => myTrade(1), sell: () => myTrade(-1), closepos: () => { myClose(); renderCtrl(); },
  open: () => openMarket(),
  card: (d) => { const p = me(); if (p.used) { toast('カードは月に1枚まで'); return; } const k = p.hand[+d.v]; if (CARDS[k].target) chooseTarget(k, +d.v); else useMyCard(k, +d.v, null); },
  target: (d) => { $('#screen').innerHTML = ''; useMyCard(d.k, +d.j, +d.v); },
  cancelpick: () => { $('#screen').innerHTML = ''; },
  next: () => { hideSheet(); if (meetingsDue()) { planMeetings(); if (G.meetingQueue.length) { flashBanner('<b>株主総会</b><small>3か月に1度。持ち株の数で投票する</small>', 'gold'); setTimeout(nextMeeting, 900); return; } } G.m++; setTimeout(planMonth, 250); },
  propose: (d) => showVote(+d.i, d.v, me()),
  vote: (d) => { document.querySelectorAll('.vbtns .btn, .meet .btn.go').forEach(b => b.disabled = true); castVote(+d.v); },
  tab: (d) => { G.tab = d.v; const list = RES.map((r, i) => i).filter(i => (RES[i].kind === 'co') === (G.tab === 'co')); if (!list.includes(G.sel)) G.sel = list[0]; sfx('toggle'); render(); },
  final: () => finalResult(),
};
function useMyCard(k, j, target) {
  const p = me(); p.hand.splice(j, 1); p.used = { k, target }; applyCard(p, k, target, false);
  sfx('card'); haptic(20); flashBanner(`<b>「${CARDS[k].name}」!</b><small>${k === 'pump' || k === 'dump' ? `${RES[target].name}が${k === 'pump' ? '上がり' : '下がり'}やすくなった` : k === 'seize' ? `${G.players[target].name}の持ち物を売らせた` : CARDS[k].text}</small>`, 'gold');
  if (k === 'seize') { const t = G.players[target]; setTimeout(() => speech(t, 'なっ、なにをする!'), 500); }
  if (target != null && CARDS[k].target === 'res') G.sel = target;
  render();
}
let pressing = null;
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  unlockAudio();
  const a = b.dataset.a;
  if (a === 'buy' || a === 'sell') { e.preventDefault(); ACT[a](b.dataset); b.classList.add('press'); pressing = b; return; }
});
document.addEventListener('pointerup', () => { if (pressing) { pressing.classList.remove('press'); pressing = null; } });
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
  if (a === 'buy' || a === 'sell') return;
  if (a !== 'sel' && a !== 'amt') sfx('tap');
  if (ACT[a]) ACT[a](b.dataset);
});
addEventListener('resize', () => drawChart());

// ── 毎フレーム
function frame(now) {
  requestAnimationFrame(frame);
  if (!G) return;
  if (G.live) {
    liveStep(now);
    const tm = $('#timer i'); if (tm && G.live) tm.style.width = Math.max(0, 100 - (now - G.live.t0) / 1000 / LIVE_SEC * 100) + '%';
    drawChart();
  } else if (now < chartFlashUntil) drawChart();
  document.body.classList.toggle('live', !!G.live);
}
requestAnimationFrame(frame);
showTitle();
window.__war = { get G() { return G; }, start, openMarket, myTrade, myClose, closeMarket };
