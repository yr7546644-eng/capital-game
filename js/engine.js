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
// 地区の性格: 港=季節で大きく波打つ / 広場=祭りと市の日に強い / 住宅街=安定・常連が大事
export const DISTRICTS = {
  plaza: { name: '中央広場', short: '広場', rent: 70, open: 520, demand: { bread: 200, potion: 70, tool: 40, cloth: 95 }, desc: '人通りが一番多い。家賃も高い', trait: '🎪 祭りと3か月ごとの「市の日」に客がどっと増える', color: '#ffb84d' },
  port: { name: '港通り', short: '港', rent: 50, open: 380, demand: { bread: 135, potion: 95, tool: 64, cloth: 55 }, desc: '旅人と船乗りの町', trait: '🌊 夏は客が1.5倍、冬は半分近くまで減る。商船の月は大にぎわい', color: '#4fb6ff' },
  hill: { name: '丘の住宅街', short: '住宅街', rent: 32, open: 280, demand: { bread: 225, potion: 52, tool: 34, cloth: 85 }, desc: '住民の毎日の買い物', trait: '🏡 季節や事件の影響が半分。評判の高い店に常連がつく', color: '#7fd67f' },
};
export const PRICE_LV = [0.8, 0.9, 1.0, 1.12, 1.25];
export const PRICE_NAME = ['激安', '安め', 'ふつう', '高め', '高級'];
export const ADS = [{ name: 'なし', cost: 0, k: 1 }, { name: 'ビラ', cost: 25, k: 1.15 }, { name: '大宣伝', cost: 70, k: 1.32 }];
export const QUALITY = [{ name: 'ふつう', k: 1, cost: 1 }, { name: '上等', k: 1.22, cost: 1.18 }, { name: '極上', k: 1.45, cost: 1.38 }];
// 店の育て方(3か月たつと選べる。Lv2 でさらに強く)
export const ROUTES = {
  lux: { name: '高級路線', icon: '💎', cost: [160, 320], text: ['品質の魅力 ×1.4・値段に鈍いお客がつく・さばける数 −10%・材料費 +20%', '品質の魅力 ×1.75・値段にさらに鈍い・さばける数 −15%・材料費 +30%'], tip: '高い値段でも客が逃げにくい。少ない客から大きく取る' },
  mass: { name: '薄利多売', icon: '📦', cost: [140, 280], text: ['さばける数 ×1.3・材料費 −8%・安売りしても評判が落ちにくい', 'さばける数 ×1.55・材料費 −14%'], tip: '安くたくさん売る。人通りの多い地区向き' },
  local: { name: '地域密着', icon: '🤝', cost: [120, 240], text: ['評判が上がりやすい・常連がつく(ライバルに客を取られにくい)・家賃 −20%', '評判がさらに上がりやすい・常連が強い・家賃 −35%'], tip: '派手さはないが崩れにくい。住宅街と相性がいい' },
};
export const WAGE = 30;
export const LOAN_RATE = 0.015;
export const MAX_SHOPS = 4;
export const CROWN_BONUS = 400;
export const MISSION_BONUS = 500;

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
  { id: 'festival', name: '収穫祭', icon: '🎪', text: '中央広場で収穫祭。広場に人がどっと来る(1.8倍)', dist: { plaza: 1.8 }, len: 1, w: 2 },
  { id: 'adventurer', name: '冒険者ブーム', icon: '🗡️', text: '迷宮が見つかり、冒険者が集まってきた。道具が売れそう', dem: { tool: 1.6, potion: 1.25 }, len: 3 },
  { id: 'mine', name: '鉱山の落盤', icon: '⛏️', text: '鉄の鉱山で落盤。鉄が高くなりそう', res: { iron: 1.6 }, len: 3 },
  { id: 'ship', name: '商船の到着', icon: '⛵', text: '大きな商船が港に入る。港が大にぎわい(1.6倍)、羊毛が安くなる', dist: { port: 1.6 }, res: { wool: 0.75 }, len: 1, w: 1.5 },
  { id: 'cold', name: '寒波', icon: '❄️', text: '寒い冬が来る。服がよく売れそう', dem: { cloth: 1.6 }, len: 2 },
  { id: 'herb_bad', name: '薬草の不作', icon: '🥀', text: '森の薬草が枯れた。薬草が高くなりそう', res: { herb: 1.6 }, len: 2 },
  { id: 'tax', name: '臨時の税', icon: '📜', text: '領主が臨時の税をかける。現金を多く持つ人ほど払う', tax: 0.04, len: 1 },
  { id: 'storm', name: '嵐の季節', icon: '⛈️', text: '海が荒れて船が来ない。港の客が減る', dist: { port: 0.6 }, len: 2 },
  { id: 'calm', name: '平和な月', icon: '☀️', text: '特に何もない、おだやかな月', len: 1 },
];
export const GRAND = { name: '王都の大祭', icon: '🏰', text: '最後の年に王都の大祭が来る。最後の3か月は客 1.3倍、最終月は 1.6倍。最終月に各地区で一番多くお客を集めた商会に「地区の覇者」の褒美 400G' };

// ── カード(毎月3枚配られ、1枚使える)
export const CARDS = {
  shout: { name: '呼び込み', icon: '📣', cost: 30, need: 'shop', text: '選んだ店の客寄せ 1.5倍(今月)' },
  sale: { name: '大安売り', icon: '🏷️', cost: 0, need: 'shop', text: '選んだ店を今月だけ 2割引き。評判も上がる' },
  craft: { name: '腕利き職人', icon: '🧑‍🍳', cost: 140, need: 'shop', text: '選んだ店の品質を一段上げる(ずっと)' },
  helper: { name: '看板娘', icon: '💁', cost: 60, need: 'shop', text: '選んだ店のさばける数 +40%(3か月)' },
  remodel: { name: '店の改装', icon: '🔨', cost: 90, need: 'shop', text: '選んだ店の評判を大きく上げる' },
  scout: { name: '情報屋', icon: '🕵️', cost: 20, need: null, text: 'ライバルの店の利益・人数と、秘密の目標の手がかりをのぞく' },
  contract: { name: '先物の約束', icon: '📝', cost: 0, need: 'res', text: '選んだ資源を今の値段で3か月分まとめて予約' },
  loan: { name: '銀行の融資', icon: '🏦', cost: 0, need: null, text: '500G を借りる(月1.5%の利息)' },
  // ライバルへの攻撃
  poach: { name: '客引き合戦', icon: '🥊', cost: 50, need: 'rival', text: 'ライバルの店を1つ選ぶ。今月その店の客寄せ ×0.7、同じ地区・業種のあなたの店は ×1.4' },
  headhunt: { name: '引き抜き', icon: '🤝', cost: 90, need: 'rival', text: 'ライバルの店から店員を引き抜く。相手はさばける数 −30%(2か月)、あなたの一番の店は +30%(2か月)' },
  dump: { name: '市場に放出', icon: '📉', cost: 40, need: 'res', text: '遠くの倉から資源を流して値段を3割下げる。買い占めた相手の在庫の価値が下がる' },
};
const CARD_POOL = ['shout', 'shout', 'sale', 'sale', 'craft', 'helper', 'remodel', 'scout', 'contract', 'loan', 'poach', 'poach', 'headhunt', 'dump'];

// ── 秘密の目標(最後に達成していたら +500G)
export const MISSIONS = {
  port2: { name: '港の顔', text: '最終月に港通りの店を2つ以上持つ' },
  allg: { name: 'なんでも屋', text: '最終月に4業種のうち3つ以上の店を持つ' },
  bigm: { name: '大当たり', text: '1つの店で月の利益 250G 以上を一度でも出す' },
  hoard: { name: '倉の主', text: '最終月に資源の在庫を合計 300 以上持つ' },
  clean: { name: '借金知らず', text: '一度も銀行に救済されず、借金 0 で終える' },
  route2: { name: '職人気質', text: 'どれかの店の育て方を Lv2 にする' },
  crown: { name: '覇者', text: '大祭で「地区の覇者」を1つ以上取る' },
  street: { name: '商店街', text: '最終月に、自分の店どうしが隣り合う組を2組以上作る' },
};

// ── 盤面(六角マス)の空き地
export const LOTS = [
  // 中央広場
  { id: 0, d: 'plaza', q: 0, r: -1 }, { id: 1, d: 'plaza', q: 1, r: -1 }, { id: 2, d: 'plaza', q: -1, r: 0 }, { id: 3, d: 'plaza', q: 1, r: 0 }, { id: 4, d: 'plaza', q: -1, r: 1 }, { id: 5, d: 'plaza', q: 0, r: 1 },
  // 港通り(東)
  { id: 6, d: 'port', q: 3, r: -2 }, { id: 7, d: 'port', q: 3, r: -1 }, { id: 8, d: 'port', q: 3, r: 0 }, { id: 9, d: 'port', q: 2, r: 1 }, { id: 10, d: 'port', q: 4, r: -2 }, { id: 11, d: 'port', q: 2, r: 2 },
  // 丘の住宅街(西)
  { id: 12, d: 'hill', q: -3, r: 1 }, { id: 13, d: 'hill', q: -3, r: 2 }, { id: 14, d: 'hill', q: -2, r: 2 }, { id: 15, d: 'hill', q: -3, r: 0 }, { id: 16, d: 'hill', q: -2, r: -1 }, { id: 17, d: 'hill', q: -4, r: 2 },
];
const hd = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
export const NEIGHBORS = LOTS.map(a => LOTS.filter(b => b !== a && hd(a, b) === 1).map(b => b.id));

export const AI_KIND = {
  balanced: { name: 'しっかり者', price: 2, risk: 0.5, route: 'local' },
  cheap: { name: '安売り屋', price: 1, risk: 0.6, route: 'mass' },
  luxury: { name: '高級志向', price: 3, risk: 0.4, route: 'lux' },
  hoarder: { name: '買い占め屋', price: 2, risk: 0.7, route: 'mass' },
};
const AI_NAMES = [['ベルナ', 'red', 'cheap'], ['グスタフ', 'yellow', 'luxury'], ['ミレイユ', 'green', 'hoarder']];

export function newGame({ seed = 1, players = null, months = MONTHS } = {}) {
  const S = { v: 2, seed, rs: (seed * 2654435761) >>> 0 || 7, t: 0, months, players: [], shops: [], nextShop: 1, market: {}, ev: null, evNext: null, evActive: [], crowns: null, over: false };
  const ps = players || [{ name: 'あなた', human: true }, ...AI_NAMES.map(([n, c, k]) => ({ name: n, ai: k }))];
  const mk = Object.keys(MISSIONS).sort(() => 0);
  const deck = mk.slice(); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd(S) * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  ps.forEach((p, i) => S.players.push({ id: i, name: p.name, color: p.color || COLORS[i], human: !!p.human, ai: p.human ? null : (p.ai || 'balanced'), cash: 1000, debt: 0, inv: { wheat: 0, herb: 0, iron: 0, wool: 0 }, invCost: { wheat: 0, herb: 0, iron: 0, wool: 0 }, contracts: [], hand: [], scout: -1, nw: [1000], rankHist: [], mission: deck[i % deck.length], flags: { bigm: 0, bailed: 0, route2: 0, crown: 0 } }));
  for (const k in RES) S.market[k] = { price: RES[k].base, hist: [RES[k].base], k: 1 };
  S.evNext = pickEvent(S);
  dealHands(S);
  return S;
}
function pickEvent(S) {
  if (rnd(S) < 0.3) return { id: 'calm' };
  const pool = EVENTS.filter(e => e.id !== 'calm'), tot = pool.reduce((a, e) => a + (e.w || 1), 0);
  let x = rnd(S) * tot; for (const e of pool) { x -= e.w || 1; if (x <= 0) return { id: e.id }; }
  return { id: pool[0].id };
}
export const evDef = (id) => EVENTS.find(e => e.id === id);
function dealHands(S) { for (const p of S.players) { p.hand = []; for (let i = 0; i < 3; i++) p.hand.push(CARD_POOL[Math.floor(rnd(S) * CARD_POOL.length)]); } }

export const shopsOf = (S, pid) => S.shops.filter(s => s.owner === pid);
export const lotFree = (S, lot) => !S.shops.some(s => s.lot === lot);
export const shopAt = (S, lot) => S.shops.find(s => s.lot === lot);
export function openCost(d, g) { return Math.round(DISTRICTS[d].open * GOODS[g].open); }
export function resValue(S, p) { let v = 0; for (const k in p.inv) v += p.inv[k] * S.market[k].price; return v; }
export function shopValue(S, s) { const base = openCost(s.d, s.g) * 0.55 + (s.route ? ROUTES[s.route.k].cost.slice(0, s.route.lv).reduce((a, b) => a + b, 0) * 0.5 : 0); const avg = s.hist.length ? s.hist.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, s.hist.length) : 0; return Math.round(base + Math.max(0, avg) * 6); }
export function netWorth(S, p) { return Math.round(p.cash + resValue(S, p) + shopsOf(S, p.id).reduce((a, s) => a + shopValue(S, s), 0) - p.debt); }
export function ranking(S) { return S.players.map(p => ({ p, nw: netWorth(S, p) })).sort((a, b) => b.nw - a.nw); }
export const finalYear = (S) => S.t >= S.months - 12;
// 店の育て方の効き目
export function routeFx(s) {
  const r = s.route, lv = r ? r.lv : 0;
  const f = { qual: 1, elastic: 1, cap: 1, cost: 1, priceRep: 1, repGain: 1, loyal: 0, rent: 1 };
  if (!r) return f;
  if (r.k === 'lux') Object.assign(f, { qual: lv === 2 ? 1.75 : 1.38, elastic: lv === 2 ? 0.4 : 0.6, cap: lv === 2 ? 0.85 : 0.9, cost: lv === 2 ? 1.3 : 1.2, priceRep: 0.4 });
  if (r.k === 'mass') Object.assign(f, { cap: lv === 2 ? 1.55 : 1.3, cost: lv === 2 ? 0.86 : 0.92, priceRep: 0.5, qual: 0.92 });
  if (r.k === 'local') Object.assign(f, { repGain: lv === 2 ? 2 : 1.6, loyal: lv === 2 ? 0.5 : 0.3, rent: lv === 2 ? 0.65 : 0.8 });
  return f;
}
// 自分の店どうしが隣り合う組(商店街)
export function streetPairs(S, pid) { const mine = shopsOf(S, pid); let n = 0; for (const a of mine) for (const b of mine) if (a.id < b.id && NEIGHBORS[a.lot].includes(b.lot)) n++; return n; }
function streetBonus(S, s) { let n = 0; for (const l of NEIGHBORS[s.lot]) { const o = shopAt(S, l); if (o && o.owner === s.owner && o.g !== s.g) n++; } return 1 + 0.08 * Math.min(2, n); }

// 季節: 0=1月
function season(S, g, d) {
  const mo = S.t % 12;
  let k = 1;
  const damp = d === 'hill' ? 0.5 : 1;
  if (g === 'potion') k *= 1 + 0.25 * damp * Math.cos((mo - 0) / 12 * 2 * Math.PI);
  if (g === 'cloth') k *= 1 + 0.22 * damp * Math.cos((mo - 0.5) / 12 * 2 * Math.PI);
  if (d === 'port') k *= 1 + 0.42 * Math.cos((mo - 6.5) / 12 * 2 * Math.PI);
  if (d === 'plaza' && mo % 3 === 2) k *= 1.3;   // 市の日
  // 王都の大祭(最後の年)
  if (S.t >= S.months - 1) k *= 1.6; else if (S.t >= S.months - 3) k *= 1.3;
  return k;
}
export const marketDay = (S) => S.t % 12 % 3 === 2;
function activeMult(S, kind, key, d) {
  let k = 1;
  for (const a of S.evActive) { const e = evDef(a.id); if (e && e[kind] && e[kind][key]) k *= e[kind][key]; }
  if (d === 'hill' && kind === 'dem') k = 1 + (k - 1) * 0.5;
  return k;
}

// ── 決断の検証
export function validate(S, pid, a) {
  const p = S.players[pid];
  const own = (id) => S.shops.find(x => x.id === id && x.owner === pid);
  if (a.type === 'open') {
    const lot = LOTS[a.lot]; if (!lot || !lotFree(S, a.lot)) return 'その土地はもう使われている';
    if (shopsOf(S, pid).length >= MAX_SHOPS) return `お店は${MAX_SHOPS}つまで`;
    if (!GOODS[a.g]) return '業種がちがう';
    if (p.cash < openCost(lot.d, a.g)) return 'お金が足りない';
    return null;
  }
  if (a.type === 'set' || a.type === 'close') return own(a.shop) ? null : '自分の店ではない';
  if (a.type === 'route') {
    const s = own(a.shop); if (!s) return '自分の店ではない'; if (!ROUTES[a.k]) return '育て方がちがう';
    if (s.months < 3) return '開業から3か月たってから';
    if (s.route && s.route.k !== a.k) return '育て方は途中で変えられない';
    const lv = s.route ? s.route.lv + 1 : 1; if (lv > 2) return 'もう最大';
    if (p.cash < ROUTES[a.k].cost[lv - 1]) return 'お金が足りない';
    return null;
  }
  if (a.type === 'buy') { if (!RES[a.res] || !(a.qty > 0)) return '数がちがう'; if (p.cash < quote(S, a.res, a.qty)) return 'お金が足りない'; return null; }
  if (a.type === 'sell') { if (!(a.qty > 0) || (p.inv[a.res] || 0) < a.qty) return '在庫が足りない'; return null; }
  if (a.type === 'card') {
    if (!p.hand.includes(a.card)) return 'そのカードはない';
    const c = CARDS[a.card]; if (p.cash < c.cost) return 'お金が足りない';
    if (c.need === 'shop' && !own(a.shop)) return '店を選んで';
    if (c.need === 'rival') { const t = S.shops.find(x => x.id === a.shop); if (!t || t.owner === pid) return 'ライバルの店を選んで'; }
    if (c.need === 'res' && !RES[a.res]) return '資源を選んで';
    return null;
  }
  if (a.type === 'repay') { if (!(a.amt > 0) || p.cash < a.amt || p.debt <= 0) return '返せない'; return null; }
  return '不明な決断';
}
// 資源をまとめて買うときの見積もり(買うほど値上がり)
export function quote(S, res, qty) { const m = S.market[res], r = RES[res]; let c = 0, pr = m.price; for (let i = 0; i < qty; i++) { c += pr; pr *= 1 + r.impact; } return c; }
function applyAction(S, pid, a, fx, late) {
  const err = validate(S, pid, a); if (err) return err;
  const p = S.players[pid];
  if (a.type === 'open') {
    const lot = LOTS[a.lot], cost = openCost(lot.d, a.g);
    p.cash -= cost;
    const s = { id: S.nextShop++, owner: pid, lot: a.lot, d: lot.d, g: a.g, priceLv: a.priceLv ?? 2, staff: a.staff ?? 2, ads: 0, qual: 0, rep: 0.5, months: 0, hist: [], boost: 1, helper: 0, saleNow: 0, under: 0, last: null, openedT: S.t, route: null };
    S.shops.push(s); fx.push({ kind: 'open', pid, shop: s.id });
  }
  if (a.type === 'set') {
    const s = S.shops.find(x => x.id === a.shop);
    if (a.priceLv != null) s.priceLv = clamp(a.priceLv | 0, 0, 4);
    if (a.staff != null) s.staff = clamp(a.staff | 0, 1, 5);
    if (a.ads != null) s.ads = clamp(a.ads | 0, 0, 2);
  }
  if (a.type === 'route') {
    const s = S.shops.find(x => x.id === a.shop), lv = s.route ? s.route.lv + 1 : 1;
    p.cash -= ROUTES[a.k].cost[lv - 1]; s.route = { k: a.k, lv }; if (lv === 2) p.flags.route2 = 1;
    fx.push({ kind: 'route', pid, shop: s.id, k: a.k, lv });
  }
  if (a.type === 'close') {
    const s = S.shops.find(x => x.id === a.shop); p.cash += Math.round(shopValue(S, s) * 0.8); S.shops = S.shops.filter(x => x !== s); fx.push({ kind: 'close', pid, shop: s.id, g: s.g, d: s.d });
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
    const c = CARDS[a.card]; p.cash -= c.cost; p.hand.splice(p.hand.indexOf(a.card), 1);
    const s = a.shop != null ? S.shops.find(x => x.id === a.shop) : null;
    if (a.card === 'shout') s.boost *= 1.5;
    if (a.card === 'sale') s.saleNow = 1;
    if (a.card === 'craft') s.qual = Math.min(2, s.qual + 1);
    if (a.card === 'helper') s.helper = 3;
    if (a.card === 'remodel') s.rep = Math.min(1, s.rep + 0.2);
    if (a.card === 'scout') p.scout = S.t + 1;
    if (a.card === 'loan') { p.cash += 500; p.debt += 500; }
    if (a.card === 'contract') { const need = monthlyUse(S, pid, a.res) * 3 || 60; p.contracts.push({ res: a.res, price: S.market[a.res].price, left: 3, qty: Math.ceil(need / 3), stock: 0 }); }
    if (a.card === 'poach') { s.boost *= 0.7; for (const m of S.shops) if (m.owner === pid && m.d === s.d && m.g === s.g) m.boost *= 1.4; }
    if (a.card === 'headhunt') { s.under = 2; const best = shopsOf(S, pid).sort((x, y) => (y.last ? y.last.want : 0) - (x.last ? x.last.want : 0))[0]; if (best) best.helper = Math.max(best.helper, 2); }
    if (a.card === 'dump') { late.push(() => { S.market[a.res].price *= 0.7; }); }
    fx.push({ kind: 'card', pid, card: a.card, shop: a.shop, res: a.res, target: s ? s.owner : null });
  }
  return null;
}
function monthlyUse(S, pid, res) { return shopsOf(S, pid).filter(s => GOODS[s.g].res === res).reduce((a, s) => a + (s.last ? s.last.units : s.staff * GOODS[s.g].capPer * 0.6), 0); }

// お客の取り合い(1つの地区・1つの業種の中で)
function demandOf(S, d, g, noise) { return DISTRICTS[d].demand[g] * season(S, g, d) * activeMult(S, 'dem', g, d) * activeMult(S, 'dist', d, d) * noise; }
function attraction(S, s, pm) {
  const G = GOODS[s.g], R = routeFx(s);
  const repExp = s.d === 'hill' ? 1.7 : 1.2;
  return Math.pow(0.35 + s.rep, repExp) * QUALITY[s.qual].k * R.qual * Math.pow(1 / pm, G.elastic * 1.6 * R.elastic) * ADS[s.ads].k * s.boost * streetBonus(S, s);
}
const capOf = (s) => s.staff * GOODS[s.g].capPer * routeFx(s).cap * (s.helper > 0 ? 1.3 : 1) * (s.under > 0 ? 0.7 : 1);

// ── 1か月進める。decisions: {pid: [actions]}(人間とAIの決断)。順番は種で公平にまぜる
export function step(S, decisions = {}) {
  if (S.over) return { fx: [], errors: [] };
  const fx = [], errors = [], late = [];
  for (const p of S.players) if (p.ai && !decisions[p.id]) decisions[p.id] = aiDecide(S, p.id);
  const order = S.players.map(p => p.id).sort((a, b) => ((a * 7919 + S.t * 104729 + S.seed) % 97) - ((b * 7919 + S.t * 104729 + S.seed) % 97));
  for (const pid of order) for (const a of (decisions[pid] || [])) { const e = applyAction(S, pid, a, fx, late); if (e) errors.push({ pid, a, e }); }
  // 予告されていた出来事が始まる
  if (S.evNext) { S.ev = S.evNext; const e = evDef(S.ev.id); S.evActive.push({ id: S.ev.id, left: e.len }); if (e.tax) for (const p of S.players) { const tx = Math.round(Math.max(0, p.cash) * e.tax); p.cash -= tx; fx.push({ kind: 'tax', pid: p.id, amt: tx }); } }
  S.evNext = pickEvent(S);
  // 資源の値段
  for (const k in RES) {
    const m = S.market[k], r = RES[k];
    const target = r.base * activeMult(S, 'res', k);
    m.price = Math.max(r.base * 0.3, m.price + (target - m.price) * 0.4 + m.price * r.vol * gauss(S));
  }
  for (const f of late) f();
  // 客の取り合い
  const res = {};
  for (const d in DISTRICTS) for (const g in GOODS) {
    const shops = S.shops.filter(s => s.d === d && s.g === g); if (!shops.length) continue;
    const D = demandOf(S, d, g, 0.96 + 0.08 * rnd(S)), G = GOODS[g];
    const pm = shops.map(s => PRICE_LV[s.priceLv] * (s.saleNow ? 0.8 : 1));
    const att = shops.map((s, i) => attraction(S, s, pm[i]));
    const A0 = 0.55, sum = att.reduce((a, b) => a + b, 0);
    const want = att.map(a => D * a / (A0 + sum) * Math.min(1.25, 0.75 + 0.25 * shops.length));
    // 常連(地域密着): 先月のお客の一部は、ライバルに関係なく戻ってくる
    shops.forEach((s, i) => { const L = routeFx(s).loyal; if (L && s.last) want[i] = Math.max(want[i], s.last.units * L * (0.6 + s.rep * 0.5)); });
    // 真横の安い店: 隣り合う同業の店で、値段が一段以上安いほうに客が流れる
    shops.forEach((a, i) => shops.forEach((b, j) => { if (i !== j && NEIGHBORS[a.lot].includes(b.lot) && pm[i] < pm[j] - 0.05) { const mv = want[j] * 0.15 * (1 - routeFx(b).loyal); want[j] -= mv; want[i] += mv; } }));
    const cap = shops.map(capOf);
    const served = want.map((w, i) => Math.min(w, cap[i]));
    let spill = want.reduce((a, w, i) => a + Math.max(0, w - cap[i]), 0) * 0.6;
    for (let it = 0; it < 2 && spill > 0.5; it++) {
      const room = shops.map((s, i) => Math.max(0, cap[i] - served[i])); const rs = room.reduce((a, b) => a + b, 0); if (rs <= 0) break;
      const give = Math.min(spill, rs); shops.forEach((s, i) => { served[i] += give * room[i] / rs; }); spill -= give;
    }
    shops.forEach((s, i) => { res[s.id] = { D, want: want[i], cap: cap[i], served: served[i] }; });
  }
  // 損益
  for (const s of S.shops) {
    const p = S.players[s.owner], G = GOODS[s.g], r = res[s.id] || { want: 0, cap: 0, served: 0 }, R = routeFx(s);
    const pm = PRICE_LV[s.priceLv] * (s.saleNow ? 0.8 : 1);
    const units = r.served, revenue = units * G.ref * pm;
    let need = units * QUALITY[s.qual].cost * R.cost, cogs = 0;
    for (const ct of p.contracts) if (need > 0 && ct.res === G.res && ct.stock > 0) { const u = Math.min(need, ct.stock); cogs += u * ct.price; ct.stock -= u; need -= u; }
    if (need > 0 && p.inv[G.res] > 0) { const u = Math.min(need, p.inv[G.res]); const avg = p.invCost[G.res] / p.inv[G.res]; cogs += u * avg; p.inv[G.res] -= u; p.invCost[G.res] -= u * avg; need -= u; }
    if (need > 0) { const m = S.market[G.res]; cogs += need * m.price; m.price *= Math.pow(1 + RES[G.res].impact * 0.04, need); }
    const labor = s.staff * WAGE, rent = DISTRICTS[s.d].rent * R.rent, ads = ADS[s.ads].cost;
    const profit = revenue - cogs - labor - rent - ads;
    p.cash += profit;
    if (profit >= 250) p.flags.bigm = 1;
    s.last = { units, want: r.want, cap: r.cap, D: r.D, revenue, cogs, labor, rent, ads, profit, price: G.ref * pm };
    s.hist.push(profit); if (s.hist.length > 24) s.hist.shift();
    const ok = r.want > 0 ? units / r.want : 1;
    const target = clamp(0.5 + 0.22 * s.qual + (R.qual - 1) * 0.6 - 0.9 * R.priceRep * (pm - 1) - 0.45 * Math.max(0, 1 - ok) + (s.saleNow ? 0.08 : 0), 0.05, 0.98);
    s.rep = clamp(s.rep + (target - s.rep) * 0.25 * (target > s.rep ? R.repGain : 1), 0.02, 1);
    s.months++; s.boost = 1; s.saleNow = 0; if (s.helper > 0) s.helper--; if (s.under > 0) s.under--;
    fx.push({ kind: 'sales', pid: s.owner, shop: s.id, units, profit });
  }
  for (const p of S.players) {
    for (const c of p.contracts) { if (c.left > 0) { c.stock += c.qty; p.cash -= c.qty * c.price; c.left--; } }
    p.contracts = p.contracts.filter(c => c.left > 0 || c.stock > 0.5);
    if (p.debt > 0) p.cash -= p.debt * LOAN_RATE;
    if (p.cash < 0) { const need = Math.ceil(-p.cash / 100) * 100; p.debt += need * 1.1; p.cash += need; p.flags.bailed = 1; fx.push({ kind: 'bailout', pid: p.id, amt: need }); }
    for (const k in p.inv) if (p.inv[k] > 0) p.cash -= p.inv[k] * RES[k].base * 0.02;
  }
  for (const a of S.evActive) a.left--; S.evActive = S.evActive.filter(a => a.left > 0);
  for (const k in RES) { S.market[k].hist.push(S.market[k].price); if (S.market[k].hist.length > 60) S.market[k].hist.shift(); }
  S.crowns = crownsOf(S);
  if (S.t === S.months - 12) fx.push({ kind: 'grand' });
  S.t++;
  if (S.t >= S.months) {
    // 大祭の褒美と秘密の目標
    for (const d in S.crowns) { const c = S.crowns[d]; if (c) { const p = S.players[c.pid]; p.cash += CROWN_BONUS; p.flags.crown = 1; fx.push({ kind: 'crown', pid: c.pid, d, amt: CROWN_BONUS }); } }
    for (const p of S.players) if (missionDone(S, p)) { p.cash += MISSION_BONUS; p.missionDone = 1; fx.push({ kind: 'mission', pid: p.id, m: p.mission }); }
    S.over = true;
  }
  const rk = ranking(S);
  for (const p of S.players) { p.nw.push(netWorth(S, p)); p.rankHist.push(rk.findIndex(x => x.p === p) + 1); }
  dealHands(S);
  return { fx, errors };
}
// 各地区で今いちばん客を集めている商会(大祭の「地区の覇者」の目安)
export function crownsOf(S) {
  const out = {};
  for (const d in DISTRICTS) {
    const by = {}; for (const s of S.shops) if (s.d === d && s.last) by[s.owner] = (by[s.owner] || 0) + s.last.units;
    const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
    out[d] = top ? { pid: +top[0], units: top[1] } : null;
  }
  return out;
}
export function missionDone(S, p) {
  const mine = shopsOf(S, p.id), inv = Object.values(p.inv).reduce((a, b) => a + b, 0);
  switch (p.mission) {
    case 'port2': return mine.filter(s => s.d === 'port').length >= 2;
    case 'allg': return new Set(mine.map(s => s.g)).size >= 3;
    case 'bigm': return !!p.flags.bigm;
    case 'hoard': return inv >= 300;
    case 'clean': return !p.flags.bailed && p.debt <= 0.5;
    case 'route2': return !!p.flags.route2;
    case 'crown': return !!p.flags.crown || (S.crowns && Object.values(S.crowns).some(c => c && c.pid === p.id) && !S.over);
    case 'street': return streetPairs(S, p.id) >= 2;
  }
  return false;
}
export function missionProgress(S, p) {
  const mine = shopsOf(S, p.id), inv = Object.values(p.inv).reduce((a, b) => a + b, 0);
  switch (p.mission) {
    case 'port2': return `いま ${mine.filter(s => s.d === 'port').length}/2 店`;
    case 'allg': return `いま ${new Set(mine.map(s => s.g)).size}/3 業種`;
    case 'bigm': return p.flags.bigm ? '達成!' : `最高 ${Math.round(Math.max(0, ...mine.map(s => Math.max(0, ...s.hist))))}G`;
    case 'hoard': return `いま ${Math.round(inv)}/300`;
    case 'clean': return p.flags.bailed ? '救済されたので失敗' : `借金 ${Math.round(p.debt)}G`;
    case 'route2': return p.flags.route2 ? '達成!' : 'まだ';
    case 'crown': return S.t < S.months - 12 ? '最後の年の大祭で' : 'いまの覇者の地区: ' + (Object.entries(S.crowns || {}).filter(([, c]) => c && c.pid === p.id).map(([d]) => DISTRICTS[d].short).join('・') || 'なし');
    case 'street': return `いま ${streetPairs(S, p.id)}/2 組`;
  }
  return '';
}

// ── AI(ライバル商会)
export function aiDecide(S, pid) {
  const p = S.players[pid], K = AI_KIND[p.ai] || AI_KIND.balanced, acts = [];
  const mine = shopsOf(S, pid);
  let cash = p.cash;
  if (mine.length < MAX_SHOPS && S.t < S.months - 8) {
    let best = null;
    for (const lot of LOTS) {
      if (!lotFree(S, lot.id)) continue;
      for (const g in GOODS) {
        const cost = openCost(lot.d, g); if (cash < cost + 250 + 300 * (1 - K.risk)) continue;
        const comp = S.shops.filter(s => s.d === lot.d && s.g === g).length;
        const dem = DISTRICTS[lot.d].demand[g] * GOODS[g].ref * 0.45 / (1 + comp * 1.1);
        const fav = { cheap: 'bread', luxury: 'tool', hoarder: 'potion', balanced: 'cloth' }[p.ai] === g ? 0.08 : 0;
        const street = NEIGHBORS[lot.id].some(l => { const o = shopAt(S, l); return o && o.owner === pid && o.g !== g; }) ? 0.04 : 0;
        const score = (dem - DISTRICTS[lot.d].rent - 2 * WAGE) / cost + fav + street + rnd(S) * 0.08;
        if (!best || score > best.score) best = { lot: lot.id, g, score, cost };
      }
    }
    if (best && best.score > 0.02) { acts.push({ type: 'open', lot: best.lot, g: best.g, priceLv: K.price, staff: 2 }); cash -= best.cost; }
  }
  for (const s of mine) {
    const l = s.last; if (!l) continue;
    let best = { pl: s.priceLv, st: s.staff, ad: s.ads, v: estimateShop(S, s).profit };
    for (const dp of [-1, 0, 1]) for (const ds of [-1, 0, 1]) for (const da of [-1, 0, 1]) {
      const pl = s.priceLv + dp, st = s.staff + ds, ad = s.ads + da;
      if (pl < 0 || pl > 4 || st < 1 || st > 5 || ad < 0 || ad > 2) continue;
      const e = estimateShop(S, s, { priceLv: pl, staff: st, ads: ad });
      const v = e.profit - Math.abs(pl - K.price) * 6 - (pl > 3 && !(s.route && s.route.k === 'lux') ? 8 : 0);
      if (v > best.v + 4) best = { pl, st, ad, v };
    }
    if (best.pl !== s.priceLv || best.st !== s.staff || best.ad !== s.ads) acts.push({ type: 'set', shop: s.id, priceLv: best.pl, staff: best.st, ads: best.ad });
    if (s.hist.length >= 4 && s.hist.slice(-4).every(x => x < -5)) acts.push({ type: 'close', shop: s.id });
    // 育て方: 黒字の店から
    if (s.months >= 3 && l.profit > 30) {
      const k = s.route ? s.route.k : (s.d === 'hill' ? 'local' : K.route), lv = s.route ? s.route.lv + 1 : 1;
      if (lv <= 2 && cash > ROUTES[k].cost[lv - 1] + 300 && (lv === 1 || s.months >= 12)) { acts.push({ type: 'route', shop: s.id, k }); cash -= ROUTES[k].cost[lv - 1]; }
    }
  }
  for (const k in RES) {
    const m = S.market[k], r = RES[k];
    const uses = mine.some(s => GOODS[s.g].res === k);
    if ((uses || p.ai === 'hoarder') && m.price < r.base * (p.ai === 'hoarder' ? 0.95 : 0.85) && cash > 400) {
      const q = Math.min(p.ai === 'hoarder' ? 120 : 50, Math.floor((cash - 300) / m.price / 2));
      if (q > 5) { acts.push({ type: 'buy', res: k, qty: q }); cash -= q * m.price; }
    }
    if (p.inv[k] > 0 && m.price > r.base * 1.3) acts.push({ type: 'sell', res: k, qty: Math.floor(p.inv[k] * 0.6) });
  }
  // カード(攻撃もする)
  const best = mine.slice().sort((a, b) => (b.last ? b.last.profit : 0) - (a.last ? a.last.profit : 0))[0];
  for (const c of p.hand) {
    const cd = CARDS[c]; if (cash < cd.cost + 150) continue;
    if (cd.need === 'shop' && !best) continue;
    if (c === 'loan' && (p.debt > 0 || cash > 400 || !mine.some(x => x.last && x.last.profit > 40))) continue;
    if (c === 'scout') continue;
    if (c === 'contract') { const r = best ? GOODS[best.g].res : null; if (!r || S.market[r].price > RES[r].base * 0.95) continue; acts.push({ type: 'card', card: c, res: r }); break; }
    if (c === 'dump') { const r = Object.keys(RES).find(k => S.market[k].price > RES[k].base * 1.25 && mine.some(s => GOODS[s.g].res === k)); if (!r) continue; acts.push({ type: 'card', card: c, res: r }); break; }
    if (c === 'poach' || c === 'headhunt') {
      // 同じ地区・業種で一番お客を集めているライバルを狙う
      const tgt = S.shops.filter(t => t.owner !== pid && t.last && (c === 'headhunt' || mine.some(m => m.d === t.d && m.g === t.g))).sort((a, b) => b.last.units - a.last.units)[0];
      if (!tgt) continue; acts.push({ type: 'card', card: c, shop: tgt.id }); break;
    }
    if (c === 'helper' && best && best.last && best.last.want < best.last.cap) continue;
    acts.push({ type: 'card', card: c, shop: best ? best.id : null }); break;
  }
  if (p.debt > 0 && cash > 700) acts.push({ type: 'repay', amt: Math.min(p.debt, cash - 600) });
  return acts;
}
// 店の損益をざっくり見積もる(画面の「🔮」用)
export function estimateShop(S, s, patch = {}) {
  const l = s.last; if (!l) return null;
  const G = GOODS[s.g], R = routeFx(s);
  const pm0 = PRICE_LV[s.priceLv], pm1 = PRICE_LV[patch.priceLv ?? s.priceLv];
  const st1 = patch.staff ?? s.staff, ad1 = patch.ads ?? s.ads;
  const want = l.want * Math.pow(pm0 / pm1, G.elastic * 1.6 * R.elastic * 0.7) * ADS[ad1].k / ADS[s.ads].k;
  const cap = st1 * G.capPer * R.cap * (s.helper > 0 ? 1.3 : 1) * (s.under > 0 ? 0.7 : 1);
  const units = Math.min(want, cap);
  const unitCost = l.units > 0 ? l.cogs / l.units : RES[G.res].base;
  const revenue = units * G.ref * pm1, cogs = units * unitCost, labor = st1 * WAGE, rent = DISTRICTS[s.d].rent * R.rent, ads = ADS[ad1].cost;
  return { units, want, cap, revenue, cogs, labor, rent, ads, profit: revenue - cogs - labor - rent - ads };
}
