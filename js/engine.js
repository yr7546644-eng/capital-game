// CAPITAL 商会バトル — ゲームの計算(画面に依存しない・同じ種と同じ決断なら必ず同じ結果)
export const MONTHS = 60;
export const COLORS = ['blue', 'red', 'yellow', 'green'];
export const COLOR_HEX = { blue: '#4f8cff', red: '#ff5d6c', yellow: '#ffc53d', green: '#3ccf8e' };
export const COLOR_JP = { blue: '青', red: '赤', yellow: '黄', green: '緑' };

export const GOODS = {
  bread: { name: 'パン屋', item: 'パン', icon: '🥖', res: 'wheat', ref: 2.0, capPer: 80, elastic: 1.7, open: 1.0 },
  potion: { name: '薬屋', item: '薬', icon: '🧪', res: 'herb', ref: 6.0, capPer: 30, elastic: 1.0, open: 1.15 },
  tool: { name: '鍛冶屋', item: '道具', icon: '⚒️', res: 'iron', ref: 9.0, capPer: 20, elastic: 0.8, open: 1.3 },
  cloth: { name: '仕立て屋', item: '服', icon: '🧵', res: 'wool', ref: 5.0, capPer: 36, elastic: 1.3, open: 1.1 },
};
export const RES = {
  wheat: { name: '小麦', icon: '🌾', base: 0.7, vol: 0.05, impact: 0.0016 },
  herb: { name: '薬草', icon: '🌿', base: 2.2, vol: 0.06, impact: 0.0035 },
  iron: { name: '鉄', icon: '⛓️', base: 3.4, vol: 0.05, impact: 0.0045 },
  wool: { name: '羊毛', icon: '🐑', base: 1.8, vol: 0.05, impact: 0.003 },
};
export const DISTRICTS = {
  plaza: { name: '中央広場', short: '広場', rent: 70, open: 520, demand: { bread: 210, potion: 70, tool: 40, cloth: 95 }, desc: '人通りが一番多い。家賃も高い' },
  port: { name: '港通り', short: '港', rent: 50, open: 380, demand: { bread: 140, potion: 95, tool: 62, cloth: 55 }, desc: '旅人と船乗り。夏ににぎわう' },
  hill: { name: '丘の住宅街', short: '住宅街', rent: 32, open: 280, demand: { bread: 230, potion: 50, tool: 34, cloth: 85 }, desc: '住民の毎日の買い物。安定' },
};
export const PRICE_LV = [0.8, 0.9, 1.0, 1.12, 1.25];
export const PRICE_NAME = ['激安', '安め', 'ふつう', '高め', '高級'];
export const ADS = [{ name: 'なし', cost: 0, k: 1 }, { name: 'ビラ', cost: 25, k: 1.15 }, { name: '大宣伝', cost: 70, k: 1.32 }];
export const QUALITY = [{ name: 'ふつう', k: 1, cost: 1 }, { name: '上等', k: 1.22, cost: 1.18 }, { name: '極上', k: 1.45, cost: 1.38 }];
export const WAGE = 30;
export const LOAN_RATE = 0.015;
export const MAX_SHOPS = 4;

// ── 乱数(種から決まる)
export function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function rnd(S) { const r = rngOf(S.rs); const v = r(); S.rs = (S.rs * 1103515245 + 12345 + Math.floor(v * 1e9)) >>> 0; return v; }
function gauss(S) { const u = Math.max(1e-9, rnd(S)), v = rnd(S); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ── 出来事(1か月前に予告が出る)
export const EVENTS = [
  { id: 'harvest_bad', name: '小麦の不作', icon: '🌧️', text: '北の畑が長雨にやられた。小麦が高くなりそう', res: { wheat: 1.55 }, len: 3 },
  { id: 'harvest_good', name: '小麦の大豊作', icon: '🌾', text: '今年は豊作。小麦が安くなりそう', res: { wheat: 0.7 }, len: 3 },
  { id: 'plague', name: 'はやり風邪', icon: '🤧', text: '町で風邪がはやりはじめた。薬が売れそう', dem: { potion: 1.8 }, len: 2 },
  { id: 'festival', name: '収穫祭', icon: '🎪', text: '中央広場で収穫祭。人がどっと来る', dist: { plaza: 1.55 }, len: 1 },
  { id: 'adventurer', name: '冒険者ブーム', icon: '🗡️', text: '迷宮が見つかり、冒険者が集まってきた。道具が売れそう', dem: { tool: 1.6, potion: 1.25 }, len: 3 },
  { id: 'mine', name: '鉱山の落盤', icon: '⛏️', text: '鉄の鉱山で落盤。鉄が高くなりそう', res: { iron: 1.6 }, len: 3 },
  { id: 'ship', name: '商船の到着', icon: '⛵', text: '大きな商船が港に入る。港がにぎわい、羊毛が安くなる', dist: { port: 1.4 }, res: { wool: 0.75 }, len: 1 },
  { id: 'cold', name: '寒波', icon: '❄️', text: '寒い冬が来る。服がよく売れそう', dem: { cloth: 1.6 }, len: 2 },
  { id: 'herb_bad', name: '薬草の不作', icon: '🥀', text: '森の薬草が枯れた。薬草が高くなりそう', res: { herb: 1.6 }, len: 2 },
  { id: 'tax', name: '臨時の税', icon: '📜', text: '領主が臨時の税をかける。お金を多く持つ人ほど払う', tax: 0.04, len: 1 },
  { id: 'calm', name: '平和な月', icon: '☀️', text: '特に何もない、おだやかな月', len: 1 },
];

// ── カード(毎月3枚配られ、1枚使える)
export const CARDS = {
  shout: { name: '呼び込み', icon: '📣', cost: 30, need: 'shop', text: '選んだ店の客寄せ 1.5倍(今月)' },
  sale: { name: '大安売り', icon: '🏷️', cost: 0, need: 'shop', text: '選んだ店を今月だけ 2割引き。評判も上がる' },
  craft: { name: '腕利き職人', icon: '🧑‍🍳', cost: 140, need: 'shop', text: '選んだ店の品質を一段上げる(ずっと)' },
  helper: { name: '看板娘', icon: '💁', cost: 60, need: 'shop', text: '選んだ店のさばける数 +40%(3か月)' },
  remodel: { name: '店の改装', icon: '🔨', cost: 90, need: 'shop', text: '選んだ店の評判を大きく上げる' },
  scout: { name: '情報屋', icon: '🕵️', cost: 20, need: null, text: 'ライバルの値段と来月の出来事をのぞく' },
  contract: { name: '先物の約束', icon: '📝', cost: 0, need: 'res', text: '選んだ資源を今の値段で3か月分まとめて予約' },
  loan: { name: '銀行の融資', icon: '🏦', cost: 0, need: null, text: '500G を借りる(月1.5%の利息)' },
};
const CARD_POOL = ['shout', 'shout', 'sale', 'sale', 'craft', 'helper', 'remodel', 'scout', 'contract', 'loan'];

// ── 盤面(六角マス)の空き地
export const LOTS = [
  // 中央広場
  { id: 0, d: 'plaza', q: 0, r: -1 }, { id: 1, d: 'plaza', q: 1, r: -1 }, { id: 2, d: 'plaza', q: -1, r: 0 }, { id: 3, d: 'plaza', q: 1, r: 0 }, { id: 4, d: 'plaza', q: -1, r: 1 }, { id: 5, d: 'plaza', q: 0, r: 1 },
  // 港通り(東)
  { id: 6, d: 'port', q: 3, r: -2 }, { id: 7, d: 'port', q: 3, r: -1 }, { id: 8, d: 'port', q: 3, r: 0 }, { id: 9, d: 'port', q: 2, r: 1 }, { id: 10, d: 'port', q: 4, r: -2 }, { id: 11, d: 'port', q: 2, r: 2 },
  // 丘の住宅街(西)
  { id: 12, d: 'hill', q: -3, r: 1 }, { id: 13, d: 'hill', q: -3, r: 2 }, { id: 14, d: 'hill', q: -2, r: 2 }, { id: 15, d: 'hill', q: -3, r: 0 }, { id: 16, d: 'hill', q: -2, r: -1 }, { id: 17, d: 'hill', q: -4, r: 2 },
];

export const AI_KIND = {
  balanced: { name: 'しっかり者', price: 2, risk: 0.5 },
  cheap: { name: '安売り屋', price: 1, risk: 0.6 },
  luxury: { name: '高級志向', price: 3, risk: 0.4 },
  hoarder: { name: '買い占め屋', price: 2, risk: 0.7 },
};
const AI_NAMES = [['ベルナ', 'red', 'cheap'], ['グスタフ', 'yellow', 'luxury'], ['ミレイユ', 'green', 'hoarder']];

export function newGame({ seed = 1, players = null, months = MONTHS } = {}) {
  const S = { v: 1, seed, rs: (seed * 2654435761) >>> 0 || 7, t: 0, months, players: [], shops: [], nextShop: 1, market: {}, ev: null, evNext: null, evActive: [], log: [], hist: [], over: false };
  const ps = players || [{ name: 'あなた', human: true }, ...AI_NAMES.map(([n, c, k]) => ({ name: n, ai: k }))];
  ps.forEach((p, i) => S.players.push({ id: i, name: p.name, color: p.color || COLORS[i], human: !!p.human, ai: p.human ? null : (p.ai || 'balanced'), cash: 1000, debt: 0, inv: { wheat: 0, herb: 0, iron: 0, wool: 0 }, invCost: { wheat: 0, herb: 0, iron: 0, wool: 0 }, contracts: [], hand: [], scout: 0, nw: [1000], rankHist: [] }));
  for (const k in RES) S.market[k] = { price: RES[k].base, hist: [RES[k].base], k: 1 };
  S.evNext = pickEvent(S);
  dealHands(S);
  return S;
}
function pickEvent(S) {
  const r = rnd(S);
  if (r < 0.32) return { id: 'calm', left: 1 };
  const pool = EVENTS.filter(e => e.id !== 'calm');
  const e = pool[Math.floor(rnd(S) * pool.length)];
  return { id: e.id, left: e.len };
}
export const evDef = (id) => EVENTS.find(e => e.id === id);
function dealHands(S) { for (const p of S.players) { p.hand = []; for (let i = 0; i < 3; i++) p.hand.push(CARD_POOL[Math.floor(rnd(S) * CARD_POOL.length)]); } }

export const shopsOf = (S, pid) => S.shops.filter(s => s.owner === pid);
export const lotFree = (S, lot) => !S.shops.some(s => s.lot === lot);
export function openCost(d, g) { return Math.round(DISTRICTS[d].open * GOODS[g].open); }
export function resValue(S, p) { let v = 0; for (const k in p.inv) v += p.inv[k] * S.market[k].price; return v; }
export function shopValue(S, s) { const base = openCost(s.d, s.g) * 0.55; const avg = s.hist.length ? s.hist.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, s.hist.length) : 0; return Math.round(base + Math.max(0, avg) * 6); }
export function netWorth(S, p) { return Math.round(p.cash + resValue(S, p) + shopsOf(S, p.id).reduce((a, s) => a + shopValue(S, s), 0) - p.debt); }
export function ranking(S) { return S.players.map(p => ({ p, nw: netWorth(S, p) })).sort((a, b) => b.nw - a.nw); }

// 季節: 0=1月
function season(S, g, d) {
  const mo = S.t % 12;
  let k = 1;
  if (g === 'potion') k *= 1 + 0.25 * Math.cos((mo - 0) / 12 * 2 * Math.PI);
  if (g === 'cloth') k *= 1 + 0.22 * Math.cos((mo - 0.5) / 12 * 2 * Math.PI);
  if (d === 'port') k *= 1 + 0.2 * Math.cos((mo - 6.5) / 12 * 2 * Math.PI);
  return k;
}
function activeMult(S, kind, key) { let k = 1; for (const a of S.evActive) { const e = evDef(a.id); if (e && e[kind] && e[kind][key]) k *= e[kind][key]; } return k; }

// ── 決断を検証して適用(各プレイヤー分)。actions: [{type,...}]
export function validate(S, pid, a) {
  const p = S.players[pid];
  if (a.type === 'open') {
    const lot = LOTS[a.lot]; if (!lot || !lotFree(S, a.lot)) return 'その土地は使えない';
    if (shopsOf(S, pid).length >= MAX_SHOPS) return `お店は${MAX_SHOPS}つまで`;
    if (!GOODS[a.g]) return '業種がちがう';
    if (p.cash < openCost(lot.d, a.g)) return 'お金が足りない';
    return null;
  }
  if (a.type === 'set') { const s = S.shops.find(x => x.id === a.shop && x.owner === pid); return s ? null : '自分の店ではない'; }
  if (a.type === 'close') { const s = S.shops.find(x => x.id === a.shop && x.owner === pid); return s ? null : '自分の店ではない'; }
  if (a.type === 'buy') { const r = RES[a.res]; if (!r || !(a.qty > 0)) return '数がちがう'; if (p.cash < quote(S, a.res, a.qty)) return 'お金が足りない'; return null; }
  if (a.type === 'sell') { if (!(a.qty > 0) || (p.inv[a.res] || 0) < a.qty) return '在庫が足りない'; return null; }
  if (a.type === 'card') { if (!p.hand.includes(a.card)) return 'そのカードはない'; const c = CARDS[a.card]; if (p.cash < c.cost) return 'お金が足りない'; if (c.need === 'shop' && !S.shops.find(x => x.id === a.shop && x.owner === pid)) return '店を選んで'; if (c.need === 'res' && !RES[a.res]) return '資源を選んで'; return null; }
  if (a.type === 'repay') { if (!(a.amt > 0) || p.cash < a.amt || p.debt <= 0) return '返せない'; return null; }
  return '不明な決断';
}
// 資源をまとめて買うときの見積もり(買うほど値上がり)
export function quote(S, res, qty) { const m = S.market[res], r = RES[res]; let c = 0, pr = m.price; for (let i = 0; i < qty; i++) { c += pr; pr *= 1 + r.impact; } return c; }
function applyAction(S, pid, a, fx) {
  const err = validate(S, pid, a); if (err) return err;
  const p = S.players[pid];
  if (a.type === 'open') {
    const lot = LOTS[a.lot], cost = openCost(lot.d, a.g);
    p.cash -= cost;
    const s = { id: S.nextShop++, owner: pid, lot: a.lot, d: lot.d, g: a.g, priceLv: a.priceLv ?? 2, staff: a.staff ?? 2, ads: 0, qual: 0, rep: 0.5, months: 0, hist: [], boost: 0, helper: 0, saleNow: 0, last: null, openedT: S.t };
    S.shops.push(s); fx.push({ kind: 'open', pid, shop: s.id });
  }
  if (a.type === 'set') {
    const s = S.shops.find(x => x.id === a.shop);
    if (a.priceLv != null) s.priceLv = clamp(a.priceLv | 0, 0, 4);
    if (a.staff != null) s.staff = clamp(a.staff | 0, 1, 5);
    if (a.ads != null) s.ads = clamp(a.ads | 0, 0, 2);
  }
  if (a.type === 'close') {
    const s = S.shops.find(x => x.id === a.shop); p.cash += Math.round(shopValue(S, s) * 0.8); S.shops = S.shops.filter(x => x !== s); fx.push({ kind: 'close', pid, shop: s.id });
  }
  if (a.type === 'buy') {
    const c = quote(S, a.res, a.qty); p.cash -= c; p.inv[a.res] += a.qty; p.invCost[a.res] += c;
    S.market[a.res].price *= Math.pow(1 + RES[a.res].impact, a.qty);
    fx.push({ kind: 'buy', pid, res: a.res, qty: a.qty });
  }
  if (a.type === 'sell') {
    let got = 0, pr = S.market[a.res].price; for (let i = 0; i < a.qty; i++) { got += pr * 0.97; pr /= 1 + RES[a.res].impact; }
    const avg = p.inv[a.res] ? p.invCost[a.res] / p.inv[a.res] : 0;
    p.invCost[a.res] -= avg * a.qty; p.inv[a.res] -= a.qty; p.cash += got; S.market[a.res].price = pr;
    fx.push({ kind: 'sell', pid, res: a.res, qty: a.qty, got });
  }
  if (a.type === 'repay') { const amt = Math.min(a.amt, p.debt); p.cash -= amt; p.debt -= amt; }
  if (a.type === 'card') {
    const c = CARDS[a.card]; p.cash -= c.cost; p.hand.splice(p.hand.indexOf(a.card), 1); p.played = a.card;
    const s = a.shop != null ? S.shops.find(x => x.id === a.shop) : null;
    if (a.card === 'shout') s.boost = 1.5;
    if (a.card === 'sale') s.saleNow = 1;
    if (a.card === 'craft') s.qual = Math.min(2, s.qual + 1);
    if (a.card === 'helper') s.helper = 3;
    if (a.card === 'remodel') s.rep = Math.min(1, s.rep + 0.2);
    if (a.card === 'scout') p.scout = S.t + 1;
    if (a.card === 'loan') { p.cash += 500; p.debt += 500; }
    if (a.card === 'contract') { const need = monthlyUse(S, pid, a.res) * 3 || 60; p.contracts.push({ res: a.res, price: S.market[a.res].price, left: 3, qty: Math.ceil(need / 3) }); }
    fx.push({ kind: 'card', pid, card: a.card, shop: a.shop, res: a.res });
  }
  return null;
}
function monthlyUse(S, pid, res) { return shopsOf(S, pid).filter(s => GOODS[s.g].res === res).reduce((a, s) => a + (s.last ? s.last.served : s.staff * GOODS[s.g].capPer * 0.6), 0); }

// ── 1か月進める。decisions: {pid: [actions]}(人間とAIの決断)。順番はたねで公平にまぜる
export function step(S, decisions = {}) {
  if (S.over) return { fx: [] };
  const fx = [], errors = [];
  // AI の決断
  for (const p of S.players) if (p.ai && !decisions[p.id]) decisions[p.id] = aiDecide(S, p.id);
  // 適用(プレイヤーの順番を毎月入れかえる)
  const order = S.players.map(p => p.id).sort((a, b) => ((a * 7919 + S.t * 104729 + S.seed) % 97) - ((b * 7919 + S.t * 104729 + S.seed) % 97));
  for (const pid of order) for (const a of (decisions[pid] || [])) { const e = applyAction(S, pid, a, fx); if (e) errors.push({ pid, a, e }); }
  // 出来事: 予告されていたものが始まる
  if (S.evNext) { S.ev = S.evNext; const e = evDef(S.ev.id); S.evActive.push({ id: S.ev.id, left: e.len }); if (e.tax) for (const p of S.players) { const tx = Math.round(Math.max(0, p.cash) * e.tax); p.cash -= tx; fx.push({ kind: 'tax', pid: p.id, amt: tx }); } }
  S.evNext = pickEvent(S);
  // 資源の値段: 平均に戻る力 + ゆらぎ + 出来事
  for (const k in RES) {
    const m = S.market[k], r = RES[k];
    const target = r.base * activeMult(S, 'res', k);
    m.price = Math.max(r.base * 0.3, m.price + (target - m.price) * 0.4 + m.price * r.vol * gauss(S));
  }
  // 客の取り合い
  const res = {};
  for (const d in DISTRICTS) for (const g in GOODS) {
    const shops = S.shops.filter(s => s.d === d && s.g === g); if (!shops.length) continue;
    const D = DISTRICTS[d].demand[g] * season(S, g, d) * activeMult(S, 'dem', g) * activeMult(S, 'dist', d) * (0.96 + 0.08 * rnd(S));
    const G = GOODS[g];
    const att = shops.map(s => {
      const pm = PRICE_LV[s.priceLv] * (s.saleNow ? 0.8 : 1);
      return Math.pow(0.35 + s.rep, 1.2) * QUALITY[s.qual].k * Math.pow(1 / pm, G.elastic * 1.6) * ADS[s.ads].k * (s.boost || 1);
    });
    const A0 = 0.55, sum = att.reduce((a, b) => a + b, 0);
    const want = att.map(a => D * a / (A0 + sum) * Math.min(1.25, 0.75 + 0.25 * shops.length));
    const cap = shops.map(s => s.staff * G.capPer * (s.helper > 0 ? 1.4 : 1));
    const served = want.map((w, i) => Math.min(w, cap[i]));
    // あふれた客の一部は、空きのある同業の店へ流れる
    let spill = want.reduce((a, w, i) => a + Math.max(0, w - cap[i]), 0) * 0.6;
    for (let it = 0; it < 2 && spill > 0.5; it++) {
      const room = shops.map((s, i) => Math.max(0, cap[i] - served[i])); const rs = room.reduce((a, b) => a + b, 0); if (rs <= 0) break;
      const give = Math.min(spill, rs); shops.forEach((s, i) => { const add = give * room[i] / rs; served[i] += add; }); spill -= give;
    }
    shops.forEach((s, i) => { res[s.id] = { D, want: want[i], cap: cap[i], served: served[i] }; });
  }
  // 損益
  for (const s of S.shops) {
    const p = S.players[s.owner], G = GOODS[s.g], r = res[s.id] || { want: 0, cap: 0, served: 0 };
    const pm = PRICE_LV[s.priceLv] * (s.saleNow ? 0.8 : 1);
    const units = r.served;
    const revenue = units * G.ref * pm;
    // 原価: 在庫と約束を先に使い、足りない分は市場で買う(買うと値上がり)
    let need = units * QUALITY[s.qual].cost, cogs = 0;
    const ct = p.contracts.find(c => c.res === G.res && c.left > 0 && c.stock > 0);
    if (ct) { const u = Math.min(need, ct.stock); cogs += u * ct.price; ct.stock -= u; need -= u; }
    if (need > 0 && p.inv[G.res] > 0) { const u = Math.min(need, p.inv[G.res]); const avg = p.invCost[G.res] / p.inv[G.res]; cogs += u * avg; p.inv[G.res] -= u; p.invCost[G.res] -= u * avg; need -= u; }
    if (need > 0) { const m = S.market[G.res]; cogs += need * m.price; m.price *= Math.pow(1 + RES[G.res].impact * 0.04, need); }
    const labor = s.staff * WAGE, rent = DISTRICTS[s.d].rent, ads = ADS[s.ads].cost;
    const profit = revenue - cogs - labor - rent - ads;
    p.cash += profit;
    s.last = { units, want: r.want, cap: r.cap, D: r.D, revenue, cogs, labor, rent, ads, profit, price: G.ref * pm };
    s.hist.push(profit); if (s.hist.length > 24) s.hist.shift();
    // 評判: 品質・値段・さばけたか
    const ok = r.want > 0 ? units / r.want : 1;
    const target = clamp(0.5 + 0.22 * s.qual - 0.9 * (pm - 1) - 0.45 * Math.max(0, 1 - ok) + (s.saleNow ? 0.08 : 0), 0.05, 0.98);
    s.rep = clamp(s.rep + (target - s.rep) * 0.25, 0.02, 1);
    s.months++; s.boost = 0; s.saleNow = 0; if (s.helper > 0) s.helper--;
    fx.push({ kind: 'sales', pid: s.owner, shop: s.id, units, profit });
  }
  // 先物の約束: 毎月その月の分が届く
  for (const p of S.players) {
    for (const c of p.contracts) { if (c.left > 0) { c.stock = (c.stock || 0) + c.qty; p.cash -= c.qty * c.price; c.left--; } }
    p.contracts = p.contracts.filter(c => c.left > 0 || c.stock > 0.5);
    // 利息
    if (p.debt > 0) p.cash -= p.debt * LOAN_RATE;
    // お金が尽きたら銀行が自動で貸す(利息が高い)
    if (p.cash < 0) { const need = Math.ceil(-p.cash / 100) * 100; p.debt += need * 1.1; p.cash += need; fx.push({ kind: 'bailout', pid: p.id, amt: need }); }
    // 在庫の保管料
    for (const k in p.inv) if (p.inv[k] > 0) p.cash -= p.inv[k] * RES[k].base * 0.02;
  }
  // 出来事の残り月数
  for (const a of S.evActive) a.left--; S.evActive = S.evActive.filter(a => a.left > 0);
  for (const k in RES) { S.market[k].hist.push(S.market[k].price); if (S.market[k].hist.length > 60) S.market[k].hist.shift(); }
  S.t++;
  const rk = ranking(S);
  for (const p of S.players) { p.nw.push(netWorth(S, p)); p.rankHist.push(rk.findIndex(x => x.p === p) + 1); p.played = null; }
  if (S.t >= S.months) S.over = true;
  dealHands(S);
  return { fx, errors };
}

// ── AI(ライバル商会)。性格で値付けや買い占めがちがう
export function aiDecide(S, pid) {
  const p = S.players[pid], K = AI_KIND[p.ai] || AI_KIND.balanced, acts = [];
  const mine = shopsOf(S, pid);
  // 出店: お金に余裕があれば、ライバルが少なく需要が多いところへ
  if (mine.length < MAX_SHOPS && S.t < S.months - 8) {
    let best = null;
    for (const lot of LOTS) {
      if (!lotFree(S, lot.id)) continue;
      for (const g in GOODS) {
        const cost = openCost(lot.d, g); if (p.cash < cost + 250 + 300 * (1 - K.risk)) continue;
        const comp = S.shops.filter(s => s.d === lot.d && s.g === g).length;
        const dem = DISTRICTS[lot.d].demand[g] * GOODS[g].ref * 0.45 / (1 + comp * 1.1);
        const fav = { cheap: 'bread', luxury: 'tool', hoarder: 'potion', balanced: 'cloth' }[p.ai] === g ? 0.08 : 0;
        const score = (dem - DISTRICTS[lot.d].rent - 2 * WAGE) / cost + fav + rnd(S) * 0.08;
        if (!best || score > best.score) best = { lot: lot.id, g, score };
      }
    }
    if (best && best.score > 0.02) acts.push({ type: 'open', lot: best.lot, g: best.g, priceLv: K.price, staff: 2 });
  }
  // 店の調整: 値段・人数・広告を一段ずつ動かした「もしも」を比べて、一番もうかる形にする
  for (const s of mine) {
    const l = s.last; if (!l) continue;
    let best = { pl: s.priceLv, st: s.staff, ad: s.ads, v: estimateShop(S, s).profit };
    for (const dp of [-1, 0, 1]) for (const ds of [-1, 0, 1]) for (const da of [-1, 0, 1]) {
      const pl = s.priceLv + dp, st = s.staff + ds, ad = s.ads + da;
      if (pl < 0 || pl > 4 || st < 1 || st > 5 || ad < 0 || ad > 2) continue;
      const e = estimateShop(S, s, { priceLv: pl, staff: st, ads: ad });
      const bias = -Math.abs(pl - K.price) * 6 - (pl > 3 ? 8 : 0);   // 性格の好み + 高すぎは評判が落ちる
      const v = e.profit + bias;
      if (v > best.v + 4) best = { pl, st, ad, v };
    }
    if (best.pl !== s.priceLv || best.st !== s.staff || best.ad !== s.ads) acts.push({ type: 'set', shop: s.id, priceLv: best.pl, staff: best.st, ads: best.ad });
    if (s.hist.length >= 4 && s.hist.slice(-4).every(x => x < -5)) acts.push({ type: 'close', shop: s.id });
  }
  // 資源: 安いときに買う(買い占め屋はたくさん)
  for (const k in RES) {
    const m = S.market[k], r = RES[k];
    const uses = mine.some(s => GOODS[s.g].res === k);
    if ((uses || p.ai === 'hoarder') && m.price < r.base * (p.ai === 'hoarder' ? 0.95 : 0.85) && p.cash > 400) {
      const q = Math.min(p.ai === 'hoarder' ? 120 : 50, Math.floor((p.cash - 300) / m.price / 2));
      if (q > 5) acts.push({ type: 'buy', res: k, qty: q });
    }
    if (p.inv[k] > 0 && m.price > r.base * 1.3) acts.push({ type: 'sell', res: k, qty: Math.floor(p.inv[k] * 0.6) });
  }
  // カード
  const best = mine.slice().sort((a, b) => (b.last ? b.last.profit : 0) - (a.last ? a.last.profit : 0))[0];
  for (const c of p.hand) {
    const cd = CARDS[c]; if (p.cash < cd.cost + 150) continue;
    if (cd.need === 'shop' && !best) continue;
    if (c === 'loan' && (p.debt > 0 || p.cash > 400 || !mine.some(x => x.last && x.last.profit > 40))) continue;
    if (c === 'scout') continue;
    if (c === 'contract') { const r = best ? GOODS[best.g].res : null; if (!r || S.market[r].price > RES[r].base * 0.95) continue; acts.push({ type: 'card', card: c, res: r }); break; }
    if (c === 'helper' && best && best.last && best.last.want < best.last.cap) continue;
    acts.push({ type: 'card', card: c, shop: best ? best.id : null }); break;
  }
  if (p.debt > 0 && p.cash > 700) acts.push({ type: 'repay', amt: Math.min(p.debt, p.cash - 600) });
  return acts;
}
// 店の損益を前もってざっくり見積もる(画面の「もしも」用)
export function estimateShop(S, s, patch = {}) {
  const l = s.last; if (!l) return null;
  const G = GOODS[s.g];
  const pm0 = PRICE_LV[s.priceLv], pm1 = PRICE_LV[patch.priceLv ?? s.priceLv];
  const st1 = patch.staff ?? s.staff, ad1 = patch.ads ?? s.ads;
  let want = l.want * Math.pow(pm0 / pm1, G.elastic * 1.6 * 0.7) * ADS[ad1].k / ADS[s.ads].k;
  const cap = st1 * G.capPer * (s.helper > 0 ? 1.4 : 1);
  const units = Math.min(want, cap);
  const unitCost = l.units > 0 ? l.cogs / l.units : RES[G.res].base;
  const revenue = units * G.ref * pm1, cogs = units * unitCost, labor = st1 * WAGE, rent = DISTRICTS[s.d].rent, ads = ADS[ad1].cost;
  return { units, want, cap, revenue, cogs, labor, rent, ads, profit: revenue - cogs - labor - rent - ads };
}
