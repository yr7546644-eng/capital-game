// CAPITAL 商会バトル — ゲームの計算(画面に依存しない・同じ種と同じ決断なら必ず同じ結果)
export const MONTHS = 60;
export const COLORS = ['blue', 'red', 'yellow', 'green'];
export const COLOR_HEX = { blue: '#4f8cff', red: '#ff5d6c', yellow: '#ffc53d', green: '#3ccf8e' };
export const COLOR_JP = { blue: '青', red: '赤', yellow: '黄', green: '緑' };

export const GOODS = {
  bread: { name: 'パン屋', item: 'パン', icon: '🥖', res: 'wheat', ref: 2.0, capPer: 80, elastic: 1.35, open: 1.0 },
  potion: { name: '薬屋', item: '薬', icon: '🧪', res: 'herb', ref: 6.0, capPer: 30, elastic: 1.0, open: 1.15 },
  tool: { name: '鍛冶屋', item: '道具', icon: '⚒️', res: 'iron', ref: 9.0, capPer: 20, elastic: 0.8, open: 1.3 },
  cloth: { name: '仕立て屋', item: '服', icon: '🧵', res: 'wool', ref: 5.0, capPer: 36, elastic: 1.3, open: 1.1 },
};
// 原料(decay = 毎月傷んで減る割合)
export const RES = {
  wheat: { name: '小麦', icon: '🌾', base: 0.7, vol: 0.05, impact: 0.0005, decay: 0.03, proc: 'flour' },
  herb: { name: '薬草', icon: '🌿', base: 2.2, vol: 0.06, impact: 0.002, decay: 0.05, proc: 'tincture' },
  iron: { name: '鉄', icon: '⛓️', base: 3.4, vol: 0.05, impact: 0.003, decay: 0, proc: 'steel' },
  wool: { name: '羊毛', icon: '🐑', base: 1.8, vol: 0.05, impact: 0.0018, decay: 0.01, proc: 'fabric' },
};
// 加工品(工房で原料から作る。rate = 職人1人が1か月に作れる数)
export const PROC = {
  flour: { name: '小麦粉', icon: '🥣', from: 'wheat', base: 1.9, vol: 0.04, impact: 0.0003, decay: 0.01, rate: 80 },
  tincture: { name: '秘薬の素', icon: '⚗️', from: 'herb', base: 5.6, vol: 0.05, impact: 0.0008, decay: 0, rate: 30 },
  steel: { name: '鋼', icon: '🔩', from: 'iron', base: 8.6, vol: 0.05, impact: 0.0012, decay: 0, rate: 20 },
  fabric: { name: '毛織物', icon: '🧶', from: 'wool', base: 4.6, vol: 0.05, impact: 0.0007, decay: 0, rate: 36 },
};
// レア素材(少ししか出回らない。目玉商品にすると客寄せと特別売上。use = 目玉にできる業種)
export const RARES = {
  starsilver: { name: '星銀鉱', icon: '✨', base: 48, decay: 0, use: 'tool', rare: 1, where: '雪解けのころ鉱山で出る。騎士の大会で高級装備の注文が増えて値上がり。目玉にすると職人の手(加工枠)を使う' },
  dragonscale: { name: '竜のうろこ', icon: '🐉', base: 60, decay: 0, use: 'tool', rare: 1, where: '冒険者が竜を討つと出回る。鍛冶屋で竜鱗の盾に。冒険者ブームや騎士の大会で欲しがる人が増える' },
  moonherb: { name: '月光草', icon: '🌙', base: 32, decay: 0.15, use: 'potion', rare: 1, where: '満月の夜に森でとれる。すぐ傷む。薬師ギルドと宿屋(月見酒)が別々の値段で買いに来る' },
  seapearl: { name: '海の真珠', icon: '🦪', base: 70, decay: 0, use: 'cloth', rare: 1, where: '嵐のあとの浜で見つかる。王都の祭りで礼服に。町に仕立て屋が少ないと、よその町の商人が高く買う' },
  goldwheat: { name: '黄金麦', icon: '🌟', base: 22, decay: 0.3, use: 'bread', rare: 1, where: '豊作の秋にだけ少し実る。パン屋の限定商品に。毎月3割傷むので持ち越しにくい' },
};
export const isRare = (k) => !!RARES[k];
// 市場のしくみ: 町の倉の在庫で値段が決まる。在庫は 生産(季節・天気・出来事) − 町の消費(値段が高いと控える) − 店の仕入れ ± プレイヤーの売買 で動く
// flow = ふだんの1か月の生産量。N = ふだんの在庫(原料は4か月分・加工品は2か月分)。値段 = ふだんの値段 × (ふだんの在庫 ÷ いまの在庫)^0.7
const SEAS = {
  wheat: [0.7, 0.65, 0.65, 0.7, 0.75, 0.8, 0.85, 1.9, 2.1, 1.7, 0.85, 0.7],   // 8〜10月が収穫
  herb: [0.6, 0.6, 0.9, 1.25, 1.35, 1.35, 1.3, 1.2, 1.0, 0.9, 0.75, 0.6],
  wool: [0.8, 0.8, 0.95, 1.8, 1.9, 1.0, 0.9, 0.9, 0.9, 0.85, 0.8, 0.8],   // 春の毛刈り
};
export const FLOW = { wheat: 3000, herb: 900, iron: 500, wool: 900, flour: 800, tincture: 250, steel: 180, fabric: 350, starsilver: 0, dragonscale: 0, moonherb: 0, seapearl: 0, goldwheat: 0 };
const RARE_PULSE = 14, RARE_NEED = 6, RARE_N = 30;
const seasK = (k, mo) => { const a = SEAS[k]; if (!a) return 1; const avg = a.reduce((x, y) => x + y, 0) / 12; return a[mo] / avg; };
export const normalStock = (k) => (RARES[k] ? RARE_N : FLOW[k] * (RES[k] ? 4 : 2));
export function priceAt(k, stock) { const N = normalStock(k); return ITEMS[k].base * Math.min(3.5, Math.max(0.35, Math.pow(N / Math.max(1, stock), 0.7))); }
function setPrice(S, k) { S.market[k].price = priceAt(k, S.mk[k].stock); }
// 町の倉から qty 取り出す(買う・店が使う)。値段は在庫が減るほど上がる
function takeCost(S, k, qty, spread) { let st = S.mk[k].stock, c = 0; const step = Math.max(1, qty / 40); for (let left = qty; left > 0; left -= step) { const u = Math.min(step, left); c += u * priceAt(k, st - u / 2) * (1 + spread); st -= u; } return { c, st }; }
function giveGot(S, k, qty, spread) { let st = S.mk[k].stock, g = 0; const step = Math.max(1, qty / 40); for (let left = qty; left > 0; left -= step) { const u = Math.min(step, left); g += u * priceAt(k, st + u / 2) * (1 - spread); st += u; } return { g, st }; }
export const ITEMS = { ...RES, ...PROC, ...RARES };
export const isProc = (k) => !!PROC[k];
export const SPREAD = 0.03;   // 買うときは相場より3%高く、売るときは3%安く
export const MERCHANTS = ['ヴェネト商会', '北の毛皮商', '王都の兵站係', '旅の薬師', '港の仲買人', '修道院の会計係', '鉱山組合', '流れの行商人'];
// 地区の性格: 港=季節で大きく波打つ / 広場=祭りと市の日に強い / 住宅街=安定・常連が大事
const ROSE_D = {
  plaza: { kind: 'plaza', ground: 0xd9c9a8, name: '中央広場', short: '広場', rent: 70, open: 520, demand: { bread: 200, potion: 70, tool: 40, cloth: 95 }, desc: '人通りが一番多い。家賃も高い', trait: '🎪 祭りと3か月ごとの「市の日」に客がどっと増える', color: '#ffb84d' },
  port: { kind: 'port', ground: 0xeedfb5, name: '港通り', short: '港', rent: 50, open: 380, demand: { bread: 135, potion: 95, tool: 64, cloth: 55 }, desc: '旅人と船乗りの町', trait: '🌊 夏は客が1.5倍、冬は半分近くまで減る。商船の月は大にぎわい', color: '#4fb6ff' },
  hill: { kind: 'hill', ground: null, name: '丘の住宅街', short: '住宅街', rent: 32, open: 280, demand: { bread: 225, potion: 52, tool: 34, cloth: 85 }, desc: '住民の毎日の買い物', trait: '🏡 季節や事件の影響が半分。評判の高い店に常連がつく', color: '#7fd67f' },
};
// ついで買い: その地区で先月ほかの業種に来た客のうち、何割がついでに寄るか
export const SPILL = {
  bread: { tool: 0.15, cloth: 0.07, potion: 0.06 },
  potion: { tool: 0.14, bread: 0.02 },
  tool: { bread: 0.04, potion: 0.07 },
  cloth: { bread: 0.03, potion: 0.03 },
};
export const SPILL_TEXT = { bread: 'パンを買いに来た客', potion: '薬を買いに来た客', tool: '道具を買いに来た冒険者', cloth: '服を買いに来た客' };
export function spillOf(S, d, g) {
  const ls = (S.served && S.served[d]) || {}; let add = 0; const from = [];
  for (const g2 in ls) { const k = SPILL[g] && SPILL[g][g2]; if (k && ls[g2] > 0) { add += ls[g2] * k; from.push([g2, ls[g2] * k]); } }
  return { add, from };
}
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
export const DISTRICTS = {};
export const WAGE = 30;
// ── 店員(名前と性格つき)。cap=さばける量の倍率, wage=お給料, att=客寄せ, cost=材料費, grow=毎月育つ, rep=評判の上がりやすさ
export const TRAITS = {
  plain: { name: 'ふつう', icon: '🙂', cap: 1, wage: 30, text: '可もなく不可もなく' },
  fast: { name: '手が早い', icon: '⚡', cap: 1.25, wage: 34, text: 'さばける数 +25%' },
  charm: { name: '接客上手', icon: '😊', cap: 1, wage: 34, att: 1.05, rep: 1.3, text: '客寄せ +5%・評判が上がりやすい' },
  eye: { name: '目利き', icon: '🔍', cap: 0.95, wage: 33, cost: 0.94, text: '材料費 −6%' },
  rookie: { name: '新人', icon: '🌱', cap: 0.75, wage: 22, grow: 0.04, text: 'お給料は安いが最初は遅い。毎月育つ(最大 +25%)' },
  veteran: { name: 'ベテラン', icon: '🎖️', cap: 1.35, wage: 42, text: 'お給料は高いが手が早い(+35%)' },
  lazy: { name: 'サボりがち', icon: '💤', cap: 0.75, wage: 25, text: 'お給料は安いが遅い(−25%)' },
  idol: { name: '看板娘', icon: '🌟', cap: 1, wage: 37, att: 1.07, text: '客寄せ +7%' },
  artisan: { name: '職人気質', icon: '🔨', cap: 0.9, wage: 36, att: 1.08, text: '品質が上がって客寄せ +8%。少し遅い' },
  moody: { name: '気まぐれ', icon: '🎲', cap: 1, wage: 30, moody: 1, text: '月によって働きぶりが ±30%' },
};
const STAFF_NAMES = ['ハンナ', 'トマス', 'リコ', 'ミーナ', 'ガルド', 'ソフィア', 'ベン', 'ユーリ', 'ネル', 'オットー', 'カミラ', 'ルカ', 'エマ', 'ジン', 'ポポ', 'セラ', 'ダリオ', 'フィン', 'マルタ', 'ロロ', 'イリス', 'カイ', 'ノーラ', 'ヴィム'];
const FACES = ['👩', '👨', '🧑', '👧', '👦', '👩‍🦰', '👨‍🦱', '🧔', '👱‍♀️', '👵', '🧓', '👩‍🦳'];
const TINTS = [0xffffff, 0xff9a9a, 0x9ac2ff, 0xa6e6a0, 0xffd77a, 0xc9a6ff, 0xffb27a, 0x8fe0e0];
const FEMALE = new Set(['ハンナ', 'ミーナ', 'ソフィア', 'ネル', 'カミラ', 'エマ', 'セラ', 'マルタ', 'イリス', 'ノーラ', 'ポポ', 'ロロ']);
// 見た目: b=体(服) h=頭 hat=帽子(−1はなし) tint=服の色 cape=マント。同じ骨組みの部品を組み合わせる
function newLook(S, name) {
  const fem = FEMALE.has(name.replace(/\d+$/, ''));
  const heads = fem ? [1, 3, 3, 4] : [0, 2, 0, 4];
  const h = heads[Math.floor(rnd(S) * heads.length)];
  const hats = fem ? [-1, -1, -1, 1] : [-1, -1, 0, 2, 1];
  return { b: Math.floor(rnd(S) * 4), h, hat: h === 4 ? -1 : hats[Math.floor(rnd(S) * hats.length)], tint: TINTS[Math.floor(rnd(S) * TINTS.length)], cape: rnd(S) < 0.25 ? 1 : 0 };
}
function usedNames(S) { const u = new Set(); for (const sh of S.shops || []) for (const c of sh.crew || []) u.add(c.name); for (const p of S.players || []) for (const c of p.cands || []) u.add(c.name); return u; }
function newStaff(S, trait) { const tr = trait || 'plain'; const id = (S.nextStaff = (S.nextStaff || 1) + 1); const used = usedNames(S); const free = STAFF_NAMES.filter(n => !used.has(n)); const name = free.length ? free[Math.floor(rnd(S) * free.length)] : STAFF_NAMES[id % STAFF_NAMES.length] + (2 + Math.floor(id / STAFF_NAMES.length)); return { id, name, look: newLook(S, name), face: FACES[Math.floor(rnd(S) * FACES.length)], trait: tr, wage: TRAITS[tr].wage, skill: 1, months: 0 }; }
function crewOf(S, s) { if (!s.crew) { s.crew = []; for (let i = 0; i < s.staff; i++) s.crew.push(newStaff(S, 'plain')); } return s.crew; }
export const crewCapK = (s) => (s.crew ? s.crew.reduce((a, c) => a + TRAITS[c.trait].cap * (c.skill || 1) * (c.moodK || 1), 0) : s.staff);
let WAGE_ADD = 0;
export const crewWage = (s) => (s.crew ? s.crew.reduce((a, c) => a + c.wage + WAGE_ADD, 0) : s.staff * (WAGE + WAGE_ADD));
export const crewAtt = (s) => (s.crew ? s.crew.reduce((a, c) => a * (TRAITS[c.trait].att || 1), 1) : 1);
export const crewCost = (s) => (s.crew ? s.crew.reduce((a, c) => a * (TRAITS[c.trait].cost || 1), 1) : 1);
export const crewRep = (s) => (s.crew ? Math.max(1, ...s.crew.map(c => TRAITS[c.trait].rep || 1)) : 1);
// 店員の数を合わせる(足すときは ふつうの人、減らすときは いちばん割に合わない人から)
function setCrewSize(S, s, n) { const c = crewOf(S, s); while (c.length < n) c.push(newStaff(S, 'plain')); while (c.length > n) { let wi = 0, wv = 1e9; c.forEach((x, i) => { const v = TRAITS[x.trait].cap * (x.skill || 1) * 30 / x.wage + ((TRAITS[x.trait].att || 1) - 1) * 10; if (v < wv) { wv = v; wi = i; } }); c.splice(wi, 1); } s.staff = c.length; }
export const LOAN_RATE = 0.015;
export let MAX_SHOPS = 5;
export const CROWN_BONUS = 400;
export const MISSION_BONUS = 500;

// ── 乱数(種から決まる)
export function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function rnd(S) { const r = rngOf(S.rs); const v = r(); S.rs = (S.rs * 1103515245 + 12345 + Math.floor(v * 1e9)) >>> 0; return v; }
function gauss(S) { const u = Math.max(1e-9, rnd(S)), v = rnd(S); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ── 出来事(1か月前に予告が出る)
export const EVENTS = [
  { id: 'harvest_bad', name: '小麦の不作', icon: '🌧️', text: '北の畑が長雨にやられた。小麦の生産が半分近くに減る(在庫が細ると値上がり)', prod: { wheat: 0.5 }, len: 3 },
  { id: 'harvest_good', name: '小麦の大豊作', icon: '🌾', text: '今年は豊作。小麦の生産が1.6倍(在庫がだぶつくと値下がり)', prod: { wheat: 1.6 }, len: 3 },
  { id: 'plague', name: 'はやり風邪', icon: '🤧', text: '町で風邪がはやりはじめた。薬が売れ、薬草・秘薬の素・月光草を欲しがる人が増える', dem: { potion: 1.8 }, need: { herb: 1.3, tincture: 1.6, moonherb: 2.5 }, len: 2 },
  { id: 'festival', name: '収穫祭', icon: '🎪', text: '中央広場で収穫祭。広場に人がどっと来る(1.8倍)', dist: { plaza: 1.8 }, len: 1, w: 2 },
  { id: 'adventurer', name: '冒険者ブーム', icon: '🗡️', text: '迷宮が見つかり、冒険者が集まってきた。道具と薬が売れ、竜のうろこを欲しがる人も', dem: { tool: 1.6, potion: 1.25 }, need: { dragonscale: 1.8, steel: 1.2 }, len: 3 },
  { id: 'mine', name: '鉱山の落盤', icon: '⛏️', text: '鉄の鉱山で落盤。鉄の生産が4割に減る', prod: { iron: 0.4 }, len: 3 },
  { id: 'ship', name: '商船の到着', icon: '⛵', text: '大きな商船が港に入る。港が大にぎわい(1.6倍)、羊毛がたくさん入荷', dist: { port: 1.6 }, prod: { wool: 2.2, iron: 1.3 }, len: 1, w: 1.5 },
  { id: 'cold', name: '寒波', icon: '❄️', text: '寒い冬が来る。服がよく売れ、羊毛と毛織物を欲しがる人が増える', dem: { cloth: 1.6 }, need: { wool: 1.3, fabric: 1.3 }, len: 2 },
  { id: 'herb_bad', name: '薬草の不作', icon: '🥀', text: '森の薬草が枯れた。薬草の生産が4割に減る', prod: { herb: 0.4 }, len: 2 },
  { id: 'tax', name: '臨時の税', icon: '📜', text: '領主が臨時の税をかける。現金を多く持つ人ほど払う', tax: 0.04, len: 1 },
  { id: 'storm', name: '嵐の季節', icon: '⛈️', text: '海が荒れて船が来ない。港の客が減り、輸入にたよる羊毛と鉄の入荷が減る', dist: { port: 0.6 }, prod: { wool: 0.6, iron: 0.8 }, len: 2 },
  { id: 'vein', name: '新しい鉱脈', icon: '💎', text: '鉱山で新しい鉱脈が見つかった。鉱夫が押し寄せ、鉱山口の客が1.7倍。鉄の生産も増える', dist: { mine: 1.7 }, prod: { iron: 1.6 }, len: 3, only: 'snow' },
  { id: 'cavein', name: '坑道の崩落', icon: '🪨', text: '坑道が崩れて鉱夫が減る。鉱山口の客が半分に', dist: { mine: 0.5 }, prod: { iron: 0.6 }, len: 2, only: 'snow' },
  { id: 'order', name: '王都の大口注文', icon: '⚔️', text: '王都の軍が鋼を大量に注文。鋼と鉄を欲しがる人が増える', need: { steel: 2.2, iron: 1.2 }, len: 3 },
  { id: 'fashion', name: '毛織物の流行', icon: '🧣', text: '貴族の間で毛織物がはやる。毛織物を欲しがる人が増える', need: { fabric: 2 }, dem: { cloth: 1.2 }, len: 3 },
  { id: 'millfire', name: '粉ひき小屋の火事', icon: '🔥', text: '町の粉ひき小屋が焼けた。小麦粉の生産が3割に減る', prod: { flour: 0.3 }, len: 2 },
  { id: 'snowmelt', name: '早い雪解け', icon: '🏔️', text: '雪解けで山肌が出た。星銀鉱が掘り出される', prod: { starsilver: 1 }, len: 2 },
  { id: 'tourney', name: '騎士の大会', icon: '🏆', text: '王都で騎士の大会。高級装備の注文が増え、星銀鉱・竜のうろこ・鋼を欲しがる人が増える。道具もよく売れる', need: { starsilver: 3, dragonscale: 2, steel: 1.4 }, dem: { tool: 1.25 }, len: 2 },
  { id: 'dragonhunt', name: '竜の討伐', icon: '🐉', text: '冒険者が竜を討った。竜のうろこが出回る', prod: { dragonscale: 1 }, len: 2 },
  { id: 'fullmoon', name: '満月の夜', icon: '🌕', text: '満月で森に月光草が咲く。すぐ傷むので早めに使うか売る', prod: { moonherb: 1 }, len: 1 },
  { id: 'pearlbeach', name: '嵐のあとの浜', icon: '🦪', text: '浜に真珠貝が打ち上げられた。海の真珠が出回る', prod: { seapearl: 1 }, len: 1 },
  { id: 'royalfest', name: '王都の祭り', icon: '🎊', text: '王都で祭り。礼服がよく売れ、海の真珠を欲しがる人が増える', need: { seapearl: 3, fabric: 1.3 }, dem: { cloth: 1.3 }, len: 2 },
  { id: 'goldharvest', name: '黄金の実り', icon: '🌟', text: '秋の畑に黄金麦がわずかに実った', prod: { goldwheat: 1 }, len: 2, autumn: 1 },
  { id: 'substitute', name: '代わりの素材の入荷', icon: '🚢', text: '商船が南の国の代わりの素材を運んできた。星銀鉱・竜のうろこ・海の真珠の在庫が増える', prod: { starsilver: 0.6, dragonscale: 0.6, seapearl: 0.6 }, len: 2 },
  { id: 'calm', name: '平和な月', icon: '☀️', text: '特に何もない、おだやかな月', len: 1 },
];
// ── 天気(毎月かわる。予報は75%の確率で当たる)
export const WEATHER = {
  sun: { name: '晴れ', icon: '☀️', text: '人出が多い。広場と港 +10%', dist: { plaza: 1.1, port: 1.1, noble: 1.05 } },
  cloudy: { name: 'くもり', icon: '☁️', text: 'ふだんどおり' },
  rain: { name: '雨', icon: '🌧️', text: '外を歩く人が減る(広場・港 −15%)。薬と服は少し売れる', dist: { plaza: 0.85, port: 0.85, mine: 0.95 }, dem: { potion: 1.1, cloth: 1.05 } },
  storm: { name: '嵐', icon: '⛈️', text: 'みんな家にこもる(全体 −15%、港 −40%)。原料の荷が届きにくく少し値上がり', all: 0.85, dist: { port: 0.6 }, res: 1.05 },
  heat: { name: '猛暑', icon: '🥵', text: 'パンが売れにくく(−10%)、薬が売れる(+15%)。続くと小麦が不作に', dem: { bread: 0.9, potion: 1.15 }, dist: { port: 1.1 } },
  snow: { name: '雪', icon: '❄️', text: '人出が減る(全体 −18%)。服 +30%・薬 +20%', all: 0.82, dem: { cloth: 1.3, potion: 1.2 } },
};
function weatherTable(S, mo) {
  const st = STAGES[S.stage] || {};
  if (mo === 11 || mo <= 1) return st.theme === 'snow' ? { snow: 5.5, cloudy: 2, sun: 2, storm: 0.5 } : { snow: 3, cloudy: 2.5, sun: 2.5, rain: 1, storm: 0.5 };
  if (mo <= 4) return { sun: 4, rain: 3, cloudy: 2.5, storm: 0.5 };
  if (mo === 5) return { rain: 4.5, cloudy: 2, sun: 2.5, heat: 1 };   // 梅雨
  if (mo <= 7) return { sun: 4, heat: 2.5, rain: 1.5, storm: st.water === 'marina' ? 2 : 1, cloudy: 1 };
  return { sun: 4, rain: 2, storm: st.water === 'marina' ? 2.5 : 1.5, cloudy: 2.5 };   // 秋は台風
}
function rollWeather(S, mo) { const t = weatherTable(S, mo), tot = Object.values(t).reduce((a, b) => a + b, 0); let x = rnd(S) * tot; for (const k in t) { x -= t[k]; if (x <= 0) return k; } return 'cloudy'; }
function forecastWeather(S) {
  const mo = S.t % 12;
  S.wNext = rollWeather(S, mo);
  S.wFore = rnd(S) < 0.75 ? S.wNext : rollWeather(S, mo);
}
// 天気が資源の相場に効く: 夏の猛暑が続くと小麦が不作、春の雨は豊作、嵐は荷が遅れる
function weatherRes(S, k) {
  const h = S.wHist || [], last3 = h.slice(-3);
  let m = 1;
  if (k === 'wheat' || k === 'flour') { m *= 1 + 0.12 * last3.filter(x => x === 'heat').length; const mo = S.t % 12; if (mo >= 3 && mo <= 6) m *= 1 - 0.05 * last3.filter(x => x === 'rain').length; }
  if (k === 'herb' || k === 'tincture') m *= 1 + 0.06 * last3.filter(x => x === 'heat').length;
  if (S.w === 'storm' && RES[k]) m *= WEATHER.storm.res;
  return m;
}
function weatherMult(S, d, g) {
  const w = WEATHER[S.w]; if (!w) return 1;
  const kd = kindOf(d);
  let k = (w.all || 1) * ((w.dist && w.dist[kd]) || 1) * ((w.dem && w.dem[g]) || 1);
  if (kd === 'hill') k = 1 + (k - 1) * 0.5;
  return k;
}
// 来月の見込み(予報された出来事と天気が、この地区の各業種にどう効くか)
export function outlook(S, d, wFore) {
  const out = {}, kd = kindOf(d), e = S.evNext && evDef(S.evNext.id), w = WEATHER[wFore];
  for (const g in GOODS) {
    let k = 1;
    if (e) { if (e.dem && e.dem[g]) k *= kd === 'hill' ? 1 + (e.dem[g] - 1) * 0.5 : e.dem[g]; if (e.dist && e.dist[kd]) k *= e.dist[kd]; }
    if (w) { let wk = (w.all || 1) * ((w.dist && w.dist[kd]) || 1) * ((w.dem && w.dem[g]) || 1); if (kd === 'hill') wk = 1 + (wk - 1) * 0.5; k *= wk; }
    const mo = (S.t) % 12; if (kd === 'plaza' && mo % 3 === 2) k *= 1.3;
    out[g] = k;
  }
  return out;
}
export const RANKS = [[0, '露店', '🧺'], [2000, '小さな商会', '🏠'], [5000, '町の商会', '🏡'], [10000, '大商会', '🏛️'], [18000, '豪商', '💰'], [30000, '王都御用達', '👑']];
export const rankOf = (nw) => { let r = 0; for (let i = 0; i < RANKS.length; i++) if (nw >= RANKS[i][0]) r = i; return r; };
// ── 年末の決算: 1年の店の利益に税(15%)。その年の設備投資(出店・育て方)の半分は利益から差し引ける
export const TAX_RATE = 0.15;
// ── 町の依頼: 期限までに品物を納めると、相場より高い報酬
export const QUESTS = [
  { item: 'steel', qty: 120, months: 4, k: 1.6, who: '王城の兵站係', text: '騎士団の武具を作るため、鋼を納めてほしい' },
  { item: 'flour', qty: 400, months: 3, k: 1.5, who: '修道院', text: '冬の炊き出しのため、小麦粉を納めてほしい' },
  { item: 'tincture', qty: 80, months: 3, k: 1.6, who: '治療院', text: 'はやり風邪に備えて、秘薬の素を納めてほしい' },
  { item: 'fabric', qty: 150, months: 4, k: 1.5, who: '仕立て屋組合', text: '祭りの衣装のため、毛織物を納めてほしい' },
  { item: 'wheat', qty: 900, months: 3, k: 1.35, who: '隣の村', text: '不作で困っている。小麦を分けてほしい' },
  { item: 'iron', qty: 250, months: 3, k: 1.4, who: '橋の普請方', text: '新しい橋をかけるため、鉄を納めてほしい' },
  { item: 'herb', qty: 300, months: 3, k: 1.4, who: '薬師ギルド', text: '薬草が足りない。まとめて納めてほしい' },
];
export const QUEST_PENALTY = 0.25;   // 期限に間に合わないと、報酬の25%を違約金として払う
// ── 商人ギルドの投票: 年に1回、町のルールを決める(1年間有効)
export const BILLS = {
  plazaRent: { name: '広場の家賃を上げる', text: '広場タイプの地区の家賃 +25%(広場の地主が喜ぶ)', icon: '🏛️' },
  tariff: { name: '港に関税をかける', text: '輸入にたよる羊毛と鉄の生産(入荷) −15%。地元の工房が有利に', icon: '⚓' },
  fair: { name: '毎月の市を開く', text: '広場タイプの地区の客 +15%。そのぶん家賃 +10%', icon: '🎪' },
  wage: { name: '最低賃金を上げる', text: '全員の店員のお給料 +4G。住民の財布がうるおい、全地区の客 +5%', icon: '💰' },
  road: { name: '街道を整える', text: '大通り沿いの区画の客寄せ +8%(合計 +20%)', icon: '🛣️' },
  guildTax: { name: 'ギルド税を下げる', text: '年末の税率 15% → 10%', icon: '📉' },
};
const lawOn = (S, k) => !!(S.laws && S.laws[k] && S.laws[k] > S.t);
export const lawsActive = (S) => Object.keys(BILLS).filter(k => lawOn(S, k));
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
  dump: { name: '市場に放出', icon: '📉', cost: 40, need: 'res', text: '遠くの倉から資源を取り寄せ、町の在庫を3割ほど増やす(値下がりする)。買い占めた相手の在庫の価値が下がる' },
};
const CARD_POOL = ['shout', 'shout', 'sale', 'sale', 'craft', 'helper', 'remodel', 'scout', 'contract', 'loan', 'poach', 'poach', 'headhunt', 'dump'];

// ── 秘密の目標(最後に達成していたら +500G)
export const MISSIONS = {
  port2: { name: '旅人の顔', text: '最終月に🌊港・城門タイプの地区に店を2つ以上持つ' },
  allg: { name: 'なんでも屋', text: '最終月に4業種のうち3つ以上の店を持つ' },
  bigm: { name: '大当たり', text: '1つの店で月の利益 250G 以上を一度でも出す' },
  hoard: { name: '倉の主', text: '最終月に資源の在庫を合計 300 以上持つ' },
  clean: { name: '借金知らず', text: '一度も銀行に救済されず、借金 0 で終える' },
  route2: { name: '職人気質', text: 'どれかの店の育て方を Lv2 にする' },
  crown: { name: '覇者', text: '大祭で「地区の覇者」を1つ以上取る' },
  street: { name: '商店街', text: '最終月に、自分の店どうしが隣り合う組を2組以上作る' },
  maker: { name: '職人の町', text: '工房で加工品を合計 400 個以上作る' },
  trader: { name: '目利き', text: '商人との取引を5回以上まとめる' },
  rare: { name: '珍品の主', text: 'レア素材を目玉商品にして、特別売上を合計 600G 以上あげる' },
};

// ── 盤面(六角マス)の空き地
const ROSE_LOTS = [
  // 中央広場
  { id: 0, d: 'plaza', q: 0, r: -1 }, { id: 1, d: 'plaza', q: 1, r: -1 }, { id: 2, d: 'plaza', q: -1, r: 0 }, { id: 3, d: 'plaza', q: 1, r: 0 }, { id: 4, d: 'plaza', q: -1, r: 1 }, { id: 5, d: 'plaza', q: 0, r: 1 },
  // 港通り(東)
  { id: 6, d: 'port', q: 3, r: -2 }, { id: 7, d: 'port', q: 3, r: -1 }, { id: 8, d: 'port', q: 3, r: 0 }, { id: 9, d: 'port', q: 2, r: 1 }, { id: 10, d: 'port', q: 4, r: -2 }, { id: 11, d: 'port', q: 2, r: 2 },
  // 丘の住宅街(西)
  { id: 12, d: 'hill', q: -3, r: 1 }, { id: 13, d: 'hill', q: -3, r: 2 }, { id: 14, d: 'hill', q: -2, r: 2 }, { id: 15, d: 'hill', q: -3, r: 0 }, { id: 16, d: 'hill', q: -2, r: -1 }, { id: 17, d: 'hill', q: -4, r: 2 },
];
export const LOTS = [];
const hd = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
export const NEIGHBORS = [];

// ── ステージ(町)
const NB6 = [[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
let _lid = 0;
const C = (d, cq, cr, extra = []) => [...NB6.map(([a, b]) => [cq + a, cr + b]), ...extra].map(([q, r]) => ({ id: _lid++, d, q, r }));
const layout = (...groups) => { _lid = 0; const out = []; for (const g of groups) out.push(...g()); return out; };
export const STAGES = {
  rose: {
    name: 'ローゼの町', sub: 'はじめての商い', diff: 1, icon: '🌷', desc: '広場・港・住宅街のバランスのいい町。まずはここで腕だめし',
    roads: [['plaza', 'port'], ['plaza', 'hill'], ['port', [9, -5]]], marks: [{ k: 'fountain', at: [1, 1] }, { k: 'pier', at: [8, -4] }, { k: 'boat', at: [9, -3] }, { k: 'well', at: [-4, 1] }],
    districts: ROSE_D, lots: layout(() => C('plaza', 0, 0, [[2, -1], [-1, 2]]), () => C('port', 5, -3, [[6, -2], [4, -1]]), () => C('hill', -5, 3, [[-6, 2], [-4, 4]])), water: 'rose', theme: 'green',
  },
  marina: {
    name: '港町マリーナ', sub: '海と嵐の町', diff: 2, icon: '⛵', desc: '店の半分が港。商船の月は大もうけ、嵐の月は閑古鳥。季節を読む町',
    districts: {
      harbor: { kind: 'port', ground: 0xeedfb5, name: '波止場', short: '波止場', rent: 55, open: 400, demand: { bread: 185, potion: 130, tool: 90, cloth: 75 }, desc: '船乗りと旅人でにぎわう', trait: '🌊 夏は客が1.5倍、冬は半分近く。商船の月は大にぎわい、嵐の月はがらがら', color: '#4fb6ff' },
      market: { kind: 'plaza', ground: 0xd9c9a8, name: '朝市通り', short: '朝市', rent: 65, open: 480, demand: { bread: 185, potion: 60, tool: 35, cloth: 115 }, desc: '町いちばんの市場', trait: '🎪 祭りと3か月ごとの「市の日」に客がどっと増える', color: '#ffb84d' },
      cliff: { kind: 'hill', ground: null, name: '崖の上の住宅地', short: '崖の上', rent: 28, open: 250, demand: { bread: 150, potion: 40, tool: 25, cloth: 70 }, desc: '静かな住宅地', trait: '🏡 季節や事件の影響が半分。評判の高い店に常連がつく', color: '#7fd67f' },
    },
    lots: layout(() => C('harbor', 2, 2, [[4, 1], [0, 4], [3, 3]]), () => C('market', -1, -3, [[1, -4]]), () => C('cliff', -6, 1, [[-7, 3]])),
    roads: [['market', 'harbor'], ['market', 'cliff']], marks: [{ k: 'pier', at: [4, 3] }, { k: 'boat', at: [5, 3] }, { k: 'pier', at: [1, 5] }, { k: 'boat', at: [2, 5] }, { k: 'fountain', at: [-3, -1] }],
    water: 'marina', theme: 'green', res: { wool: 1.4, herb: 2.6 }, ev: { ship: 4, storm: 2.5, festival: 0.6, pearlbeach: 2.5, snowmelt: 0.3, fullmoon: 1.2 },
  },
  snow: {
    name: '雪山の鉱山町ガルド', sub: '鉱脈と冬の町', diff: 2, icon: '⛏️', desc: '鉱脈が見つかれば鉱夫が押し寄せ、崩れれば消える。冬は服と薬が飛ぶように売れる',
    districts: {
      mine: { kind: 'mine', ground: 0x9a948c, name: '鉱山口', short: '鉱山', rent: 40, open: 330, demand: { bread: 130, potion: 55, tool: 85, cloth: 35 }, desc: '鉱夫たちの町', trait: '⛏️ 鉱脈しだいで客が倍にも半分にもなる。道具がよく売れる', color: '#b08cff' },
      inn: { kind: 'plaza', ground: 0xc9b392, name: '宿場町', short: '宿場', rent: 60, open: 450, demand: { bread: 150, potion: 65, tool: 35, cloth: 70 }, desc: '旅人の泊まる宿場', trait: '🎪 祭りと3か月ごとの「市の日」に客がどっと増える', color: '#ffb84d' },
      village: { kind: 'hill', ground: null, name: '麓の村', short: '村', rent: 28, open: 260, demand: { bread: 175, potion: 40, tool: 25, cloth: 75 }, desc: '昔からの住民', trait: '🏡 季節や事件の影響が半分。評判の高い店に常連がつく', color: '#7fd67f' },
    },
    lots: layout(() => C('mine', 1, -6, [[3, -6]]), () => C('inn', 0, 0, [[2, -1], [-2, 1]]), () => C('village', -5, 4, [[-3, 5]])),
    roads: [['inn', 'mine'], ['inn', 'village']], marks: [{ k: 'mine', at: [2, -8] }, { k: 'cart', at: [3, -7] }, { k: 'cart', at: [0, -8] }, { k: 'well', at: [1, 1] }],
    water: 'snow', theme: 'snow', winter: 1, res: { iron: 2.4, wheat: 1.0, wool: 2.0 }, ev: { vein: 3, cavein: 2, cold: 3, plague: 2, festival: 0.5, ship: 0, storm: 0, snowmelt: 2.5, tourney: 1.2, pearlbeach: 0.2, dragonhunt: 1.2 },
  },
  capital: {
    name: '王都ルミナス', sub: '上級者の都', diff: 3, icon: '👑', desc: '地区が4つ。家賃は高いが、貴族街では高級品が飛ぶように売れる。ライバルも手強い',
    districts: {
      noble: { kind: 'noble', ground: 0xe6e0f0, name: '貴族街', short: '貴族街', rent: 110, open: 650, demand: { bread: 95, potion: 85, tool: 50, cloth: 145 }, desc: 'お金持ちの屋敷が並ぶ', trait: '💎 お客は値段をあまり気にしない。高級路線が大当たり', color: '#ff8fd0' },
      plaza: { kind: 'plaza', ground: 0xcfc6b8, name: '大広場', short: '大広場', rent: 85, open: 560, demand: { bread: 235, potion: 80, tool: 45, cloth: 110 }, desc: '王都の中心', trait: '🎪 祭りと3か月ごとの「市の日」に客がどっと増える', color: '#ffb84d' },
      gate: { kind: 'port', ground: 0xe3d3a8, name: '城門通り', short: '城門', rent: 55, open: 400, demand: { bread: 150, potion: 110, tool: 95, cloth: 50 }, desc: '旅人と兵士の通り', trait: '🌊 夏は客が1.5倍、冬は半分近く(旅の季節しだい)', color: '#4fb6ff' },
      slum: { kind: 'hill', ground: 0xb79a7a, name: '下町', short: '下町', rent: 30, open: 260, demand: { bread: 240, potion: 55, tool: 30, cloth: 70 }, desc: '庶民の暮らす町', trait: '🏡 季節や事件の影響が半分。評判の高い店に常連がつく', color: '#7fd67f' },
    },
    lots: layout(() => C('noble', 0, -6, [[2, -7]]), () => C('plaza', 0, 0, [[2, -1]]), () => C('gate', 6, -2, [[7, -1]]), () => C('slum', -6, 3, [[-4, 4], [-7, 5]])),
    roads: [['gate', 'plaza'], ['plaza', 'noble'], ['plaza', 'slum'], ['gate', [10, -3]]], marks: [{ k: 'castle', at: [1, -9] }, { k: 'gate', at: [9, -3] }, { k: 'fountain', at: [1, 1] }],
    water: 'capital', theme: 'green', maxShops: 6, cash: 1200, ev: { tax: 2, tourney: 2.2, royalfest: 2.2, dragonhunt: 1.5 }, aiHard: 1,
  },
};
const RES_BASE = Object.fromEntries(Object.entries(RES).map(([k, r]) => [k, r.base]));
const PROC_BASE = Object.fromEntries(Object.entries(PROC).map(([k, r]) => [k, r.base]));
export let STAGE = 'rose';
export const ROADS = [], ROAD_CELLS = [], MARKS = [];
export const ROAD_BONUS = 1.12;
function hexLine(a, b) {
  const N = hd({ q: a[0], r: a[1] }, { q: b[0], r: b[1] }), out = [];
  for (let i = 0; i <= N; i++) {
    const t = N ? i / N : 0, q = a[0] + (b[0] - a[0]) * t + 1e-6, r = a[1] + (b[1] - a[1]) * t + 1e-6, s = -q - r;
    let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
    out.push([rq, rr]);
  }
  return out;
}
// 地区×業種ごとの「1店だけ出したときの儲け」が極端に偏らないように、客の数をならす
// (地区の性格の順番は残し、幅だけ縮める。季節や出来事の波はそのまま)
function standalone(d, g, dem) {
  const G = GOODS[g], R = RES[G.res], want = dem * 1.25 * 0.6; let best = -1e9;
  for (let k = 1; k <= 5; k++) { const u = Math.min(want, k * G.capPer); best = Math.max(best, u * (G.ref - R.base) - k * WAGE - DISTRICTS[d].rent); }
  return best;
}
function calibrate() {
  const rows = [];
  for (const d in DISTRICTS) { const D = DISTRICTS[d]; if (!D.demand0) D.demand0 = { ...D.demand }; for (const g in GOODS) rows.push({ d, g, p: standalone(d, g, D.demand0[g]) }); }
  const ps = rows.map(r => r.p), mn = Math.min(...ps), mx = Math.max(...ps);
  for (const r of rows) {
    const z = mx > mn ? (r.p - mn) / (mx - mn) - 0.5 : 0, target = 85 * (1 + 0.5 * z);
    let lo = 5, hi = 3000; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (standalone(r.d, r.g, m) < target) lo = m; else hi = m; }
    DISTRICTS[r.d].demand[r.g] = Math.round((lo + hi) / 2);
  }
}
export function useStage(id) {
  const st = STAGES[id] || STAGES.rose; STAGE = STAGES[id] ? id : 'rose';
  for (const k of Object.keys(DISTRICTS)) delete DISTRICTS[k]; Object.assign(DISTRICTS, st.districts);
  for (const k in RES) RES[k].base = (st.res && st.res[k]) || RES_BASE[k];
  calibrate();
  LOTS.length = 0; LOTS.push(...st.lots);
  NEIGHBORS.length = 0; NEIGHBORS.push(...LOTS.map(a => LOTS.filter(b => b !== a && hd(a, b) === 1).map(b => b.id)));
  // 道: 地区の中心どうしを六角マスの直線でつなぐ。区画以外のマスが道になる
  ROADS.length = 0; const lotKey = new Set(LOTS.map(l => l.q + ',' + l.r)), cellSet = new Set();
  const center = (d) => { const ls = LOTS.filter(l => l.d === d); return [Math.round(ls.reduce((a, l) => a + l.q, 0) / ls.length), Math.round(ls.reduce((a, l) => a + l.r, 0) / ls.length)]; };
  for (const [a, b] of (st.roads || [])) {
    const A = typeof a === 'string' ? center(a) : a, B = typeof b === 'string' ? center(b) : b, path = hexLine(A, B);
    ROADS.push({ from: a, to: b, path });
    for (const [q, r] of path) if (!lotKey.has(q + ',' + r)) cellSet.add(q + ',' + r);
  }
  ROAD_CELLS.length = 0; for (const k of cellSet) ROAD_CELLS.push(k.split(',').map(Number));
  for (const l of LOTS) l.road = ROAD_CELLS.some(([q, r]) => hd(l, { q, r }) === 1);
  MARKS.length = 0; MARKS.push(...(st.marks || []));
  for (const k in RES) RES[k].base = (st.res && st.res[k]) || RES_BASE[k];
  for (const k in PROC) PROC[k].base = PROC_BASE[k] * (0.55 + 0.45 * RES[PROC[k].from].base / RES_BASE[PROC[k].from]);
  MAX_SHOPS = st.maxShops || 5;
  return st;
}
useStage('rose');
export const kindOf = (d) => (DISTRICTS[d] ? DISTRICTS[d].kind : d);

export const AI_KIND = {
  balanced: { name: 'しっかり者', price: 2, risk: 0.5, route: 'local' },
  cheap: { name: '安売り屋', price: 1, risk: 0.6, route: 'mass' },
  luxury: { name: '高級志向', price: 3, risk: 0.4, route: 'lux' },
  hoarder: { name: '買い占め屋', price: 2, risk: 0.7, route: 'mass' },
};
export const AI_NAMES = [['ベルナ', 'red', 'cheap'], ['グスタフ', 'yellow', 'luxury'], ['ミレイユ', 'green', 'hoarder']];

export const AI_LEVEL = { normal: { name: 'ふつう', desc: 'のんびりした商人たち' }, hard: { name: 'つよい', desc: '12か月先まで試算して、出店の場所と業種を選ぶ' }, oni: { name: '鬼', desc: '毎月、値段・人手・カード・撤退まで一手ずつ未来を試算し、あなたとの差が一番開く手を選ぶ' }, maou: { name: '魔王', desc: '鬼より深く読み、開始資金も +30%。勝てたら本物' } };
export function newGame({ seed = 1, players = null, months = MONTHS, stage = 'rose', level = 'normal' } = {}) {
  const st = useStage(stage);
  const S = { v: 10, level, stage: STAGE, seed, rs: (seed * 2654435761) >>> 0 || 7, t: 0, months, players: [], shops: [], nextShop: 1, market: {}, ev: null, evNext: null, evActive: [], crowns: null, over: false };
  const ps = players || [{ name: 'あなた', human: true }, ...AI_NAMES.map(([n, c, k]) => ({ name: n, ai: k }))];
  const mk = Object.keys(MISSIONS).sort(() => 0);
  const deck = mk.slice(); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd(S) * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  ps.forEach((p, i) => S.players.push({ id: i, name: p.name, color: p.color || COLORS[i], human: !!p.human, ai: p.human ? null : (p.ai || 'balanced'), smart: !p.human && (p.smart || level !== 'normal'), aip: p.aip || (p.human ? undefined : AIP_OF_LEVEL[level]), cash: Math.round((st.cash || 1000) * (!p.human && level === 'maou' ? 1.3 : 1)), debt: 0, inv: Object.fromEntries(Object.keys(ITEMS).map(k => [k, 0])), invCost: Object.fromEntries(Object.keys(ITEMS).map(k => [k, 0])), offers: [], deals: 0, contracts: [], hand: [], scout: -1, nw: [st.cash || 1000], rankHist: [], mission: deck[i % deck.length], flags: { bigm: 0, bailed: 0, route2: 0, crown: 0, made: 0 } }));
  S.mk = {};
  for (const k in ITEMS) { S.mk[k] = { stock: normalStock(k) * (RARES[k] ? 0.6 : 1), prod: 0, need: 0, shop: 0, buy: 0, sell: 0 }; S.market[k] = { price: 0, hist: [], k: 1 }; setPrice(S, k); S.market[k].hist.push(S.market[k].price); }
  // AI の好みはゲームごとにちがう(毎回同じ手を打たないように)
  const gs = Object.keys(GOODS), ds = Object.keys(DISTRICTS);
  for (const p of S.players) if (p.ai) { p.fav = gs[Math.floor(rnd(S) * gs.length)]; p.favD = ds[Math.floor(rnd(S) * ds.length)]; p.boldness = 0.6 + rnd(S) * 0.8; }
  S.evNext = pickEvent(S);
  dealHands(S);
  S.nextOffer = 1; S.peddler = { left: 0, items: [], next: 3 + Math.floor(rnd(S) * 3) }; makeOffers(S);
  S.w = 'sun'; S.wHist = []; forecastWeather(S);
  return S;
}
function pickEvent(S) {
  if (rnd(S) < 0.3) return { id: 'calm' };
  const sw = (STAGES[S.stage] || {}).ev || {};
  const wOf = (e) => (sw[e.id] != null ? sw[e.id] : (e.w || 1));
  const pool = EVENTS.filter(e => e.id !== 'calm' && (!e.only || e.only === S.stage) && wOf(e) > 0), tot = pool.reduce((a, e) => a + wOf(e), 0);
  let x = rnd(S) * tot; for (const e of pool) { x -= wOf(e); if (x <= 0) return { id: e.id }; }
  return { id: pool[0].id };
}
export const evDef = (id) => EVENTS.find(e => e.id === id);
// 手札は毎月3枚。同じ種類は重ならない。腕利き職人は得意な業種つき
const CRAFT_SPEC = { bread: 'パン職人', potion: '薬師', tool: '鍛冶職人', cloth: '仕立て職人' };
export function cardDef(c) {
  const [base, spec] = String(c).split(':'); const d = CARDS[base]; if (!d) return null;
  if (base === 'craft' && spec) return { ...d, base, spec, name: `腕利きの${CRAFT_SPEC[spec]}`, icon: GOODS[spec].icon, text: `${GOODS[spec].name}の品質を一段上げ、評判も上がる(ずっと)。${GOODS[spec].name}にしか使えない` };
  return { ...d, base, spec: null };
}
function dealHands(S) {
  for (const p of S.players) {
    p.hand = []; const used = new Set();
    for (let tries = 0; p.hand.length < 3 && tries < 40; tries++) {
      const c = CARD_POOL[Math.floor(rnd(S) * CARD_POOL.length)]; if (used.has(c)) continue; used.add(c);
      if (c === 'craft') { const gs = Object.keys(GOODS); p.hand.push('craft:' + gs[Math.floor(rnd(S) * gs.length)]); } else p.hand.push(c);
    }
  }
}

export const shopsOf = (S, pid) => S.shops.filter(s => s.owner === pid);
export const storesOf = (S, pid) => S.shops.filter(s => s.owner === pid && s.g !== 'work');
export const WORK = { name: '工房', icon: '🏭', open: 0.85 };
export const lotFree = (S, lot) => !S.shops.some(s => s.lot === lot);
export const shopAt = (S, lot) => S.shops.find(s => s.lot === lot);
export function openCost(d, g) { return Math.round(DISTRICTS[d].open * (g === 'work' ? WORK.open : GOODS[g].open)); }
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
  const kd = kindOf(d), damp = kd === 'hill' ? 0.5 : 1, w = (STAGES[S.stage] || {}).winter ? 1.6 : 1;
  if (g === 'potion') k *= 1 + 0.25 * w * damp * Math.cos((mo - 0) / 12 * 2 * Math.PI);
  if (g === 'cloth') k *= Math.max(0.3, 1 + 0.22 * w * damp * Math.cos((mo - 0.5) / 12 * 2 * Math.PI));
  if (kd === 'port') k *= 1 + 0.42 * Math.cos((mo - 6.5) / 12 * 2 * Math.PI);
  if (kd === 'plaza' && mo % 3 === 2) k *= 1.3;   // 市の日
  // 王都の大祭(最後の年)
  if (S.t >= S.months - 1) k *= 1.6; else if (S.t >= S.months - 3) k *= 1.3;
  return k;
}
export const marketDay = (S) => S.t % 12 % 3 === 2;
function activeMult(S, kind, key, d) {
  let k = 1;
  if (kind === 'dist') key = kindOf(key);
  for (const a of S.evActive) { const e = evDef(a.id); if (e && e[kind] && e[kind][key]) k *= e[kind][key]; }
  if (d && kindOf(d) === 'hill' && kind === 'dem') k = 1 + (k - 1) * 0.5;
  return k;
}

// ── 決断の検証
// 行商人: ときどき町に来て、その月だけレア素材を売り買いできる
export const peddlerHas = (S, k) => !!(S.peddler && S.peddler.left > 0 && S.peddler.items.includes(k));
function peddlerMonth(S, fx) {
  const P = S.peddler = S.peddler || { left: 0, items: [], next: S.t + 3 };
  if (P.left > 0) P.left--;
  if (P.left <= 0 && S.t + 1 >= P.next && S.t + 1 < S.months) {
    const ks = Object.keys(RARES).sort(() => rnd(S) - 0.5); P.items = ks.slice(0, 2 + (rnd(S) < 0.4 ? 1 : 0)); P.left = 1; P.next = S.t + 1 + 4 + Math.floor(rnd(S) * 4);
    fx.push({ kind: 'peddler', items: P.items });
  }
}
export function validate(S, pid, a) {
  const p = S.players[pid];
  const own = (id) => S.shops.find(x => x.id === id && x.owner === pid);
  if (a.type === 'open') {
    const lot = LOTS[a.lot]; if (!lot || !lotFree(S, a.lot)) return 'その土地はもう使われている';
    if (shopsOf(S, pid).length >= MAX_SHOPS) return `お店は${MAX_SHOPS}つまで`;
    if (!GOODS[a.g] && !(a.g === 'work' && RES[a.res])) return '業種がちがう';
    if (p.cash < openCost(lot.d, a.g)) return 'お金が足りない';
    return null;
  }
  if (a.type === 'set' || a.type === 'close') return own(a.shop) ? null : '自分の店ではない';
  if (a.type === 'route') {
    const s = own(a.shop); if (!s) return '自分の店ではない'; if (s.g === 'work') return '工房には育て方がない'; if (!ROUTES[a.k]) return '育て方がちがう';
    if (s.months < 3) return '開業から3か月たってから';
    if (s.route && s.route.k !== a.k) return '育て方は途中で変えられない';
    const lv = s.route ? s.route.lv + 1 : 1; if (lv > 2) return 'もう最大';
    if (p.cash < ROUTES[a.k].cost[lv - 1]) return 'お金が足りない';
    return null;
  }
  if (a.type === 'propose') {
    const to = S.players[a.to]; if (!to || a.to === pid) return '相手がちがう'; if (!ITEMS[a.item] || isRare(a.item)) return 'その品は契約できない';
    if (!(a.qty >= 5 && a.qty <= 400) || !(a.price > 0) || ![3, 6].includes(a.months) || ![0, 1].includes(a.pay) || !['sell', 'buy'].includes(a.role)) return '条件がちがう';
    if ((S.pacts || []).filter(x => x.left > 0 && (x.seller === pid || x.buyer === pid)).length >= 4) return '契約は同時に4つまで';
    return null;
  }
  if (a.type === 'factor') { const r = (S.recv || []).find(x => x.id === a.id && x.to === pid); return r ? null : 'その売掛金はもうない'; }
  if (a.type === 'bridge') { if (!(a.amt >= 100 && a.amt <= BRIDGE_MAX)) return '金額がちがう'; if ((S.recv || []).some(x => x.from === pid && x.bridge)) return 'つなぎ融資は返してから'; return null; }
  if (a.type === 'deal') { const o = p.offers.find(x => x.id === a.id); if (!o) return 'その取引はもう終わった'; if (o.kind === 'pact') return null; if (o.kind === 'shopbid') { const t = S.shops.find(x => x.id === o.shop && x.owner === pid), rv = S.players[o.rival]; if (!t) return 'その店はもうない'; if (rv.cash < o.price || shopsOf(S, rv.id).length >= MAX_SHOPS) return '相手の都合で取引が流れた'; return null; } if (o.kind === 'buy' && (p.inv[o.item] || 0) < o.qty) return `${ITEMS[o.item].name}が足りない`; if (o.kind === 'sell' && p.cash < o.qty * o.price) return 'お金が足りない'; return null; }
  if ((a.type === 'buy' || a.type === 'sell') && RARES[a.res] && !peddlerHas(S, a.res)) return 'レア素材は行商人が来ているときだけ売り買いできる';
  if (a.type === 'buy') { if (!ITEMS[a.res] || !(a.qty > 0)) return '数がちがう'; if (p.cash < quote(S, a.res, a.qty)) return 'お金が足りない'; return null; }
  if (a.type === 'sell') { if (!(a.qty > 0) || (p.inv[a.res] || 0) < a.qty) return '在庫が足りない'; return null; }
  if (a.type === 'card') {
    if (!p.hand.includes(a.card)) return 'そのカードはない';
    const c = cardDef(a.card); if (p.cash < c.cost) return 'お金が足りない';
    if (c.need === 'shop' && (!own(a.shop) || own(a.shop).g === 'work')) return '店を選んで';
    if (c.spec && own(a.shop).g !== c.spec) return `${GOODS[c.spec].name}にしか使えない`;
    if (c.need === 'rival') { const t = S.shops.find(x => x.id === a.shop); if (!t || t.owner === pid) return 'ライバルの店を選んで'; }
    if (c.need === 'res' && !RES[a.res]) return '資源を選んで';
    return null;
  }
  if (a.type === 'repay') { if (!(a.amt > 0) || p.cash < a.amt || p.debt <= 0) return '返せない'; return null; }
  if (a.type === 'quest') { const q = (S.quests || []).find(x => x.id === a.id); if (!q || q.taker != null) return 'その依頼はもう受けられない'; if ((S.quests || []).some(x => x.taker === pid && !x.done)) return '依頼は1つずつ'; return null; }
  if (a.type === 'deliver') { const q = (S.quests || []).find(x => x.id === a.id && x.taker === pid && !x.done); if (!q) return '受けた依頼がない'; if (!(a.qty > 0) || (p.inv[q.item] || 0) < a.qty) return '在庫が足りない'; return null; }
  if (a.type === 'buyshop') { const t = S.shops.find(x => x.id === a.shop); if (!t || t.owner === pid) return 'ライバルの店を選んで'; if (shopsOf(S, pid).length >= MAX_SHOPS) return `お店は${MAX_SHOPS}つまで`; if (p.cash < a.price) return 'お金が足りない'; return null; }
  if (a.type === 'vote') { if (!S.vote || S.vote.t !== S.t) return '今は投票の月ではない'; if (!S.vote.bills.includes(a.bill)) return 'その議題はない'; return null; }
  if (a.type === 'hire') { const sh = own(a.shop); if (!sh) return '自分の店ではない'; if (!(p.cands || []).some(c => c.id === a.cand)) return 'その人はもういない'; if (crewOf(S, sh).length >= 5) return '店員は5人まで'; return null; }
  if (a.type === 'fire') { const sh = own(a.shop); if (!sh) return '自分の店ではない'; const c = crewOf(S, sh); if (c.length <= 1) return '最後の1人はやめさせられない'; if (!c.some(x => x.id === a.staffId)) return 'その人はいない'; return null; }
  return '不明な決断';
}
// 資源をまとめて買うときの見積もり(買うほど値上がり)
export function quote(S, res, qty) { return takeCost(S, res, qty, SPREAD).c; }
export function sellQuote(S, res, qty) { return giveGot(S, res, qty, SPREAD).g; }
function applyAction(S, pid, a, fx, late) {
  // 同じ月にほかの商会が先にその土地に建てたら、同じ地区のいちばん近い空き地に建てる
  if (a.type === 'open' && LOTS[a.lot] && !lotFree(S, a.lot)) {
    const L0 = LOTS[a.lot], dist = (l) => (Math.abs(l.q - L0.q) + Math.abs(l.r - L0.r) + Math.abs(l.q + l.r - L0.q - L0.r)) / 2;
    const alt = LOTS.filter(l => l.d === L0.d && lotFree(S, l.id)).sort((x, y) => dist(x) - dist(y) || x.id - y.id)[0];
    if (alt) a = { ...a, lot: alt.id, moved: a.lot };
  }
  const err = validate(S, pid, a); if (err) return err;
  const p = S.players[pid];
  if (a.type === 'open') {
    const lot = LOTS[a.lot], cost = openCost(lot.d, a.g);
    p.cash -= cost; p.yCapex = (p.yCapex || 0) + cost;
    const s = { id: S.nextShop++, owner: pid, lot: a.lot, d: lot.d, g: a.g, res: a.g === 'work' ? a.res : null, autoSell: a.g === 'work' ? 1 : 0, useProc: 1, home: 0, feat: null, featQty: 0, priceLv: a.priceLv ?? 2, staff: a.staff ?? 2, ads: 0, qual: 0, rep: 0.5, months: 0, hist: [], boost: 1, helper: 0, saleNow: 0, under: 0, last: null, openedT: S.t, route: null };
    crewOf(S, s); S.shops.push(s); fx.push({ kind: 'open', pid, shop: s.id, moved: a.moved });
  }
  if (a.type === 'set') {
    const s = S.shops.find(x => x.id === a.shop);
    if (a.priceLv != null) s.priceLv = clamp(a.priceLv | 0, 0, 4);
    if (a.staff != null) setCrewSize(S, s, clamp(a.staff | 0, 1, 5));
    if (a.ads != null) s.ads = clamp(a.ads | 0, 0, 2);
    if (a.autoSell != null) s.autoSell = clamp(+a.autoSell, 0, 1);
    if (a.autoBuy != null) s.autoBuy = a.autoBuy ? 1 : 0;
    if (a.useProc != null) s.useProc = a.useProc ? 1 : 0;
    if (a.feat !== undefined) { s.feat = a.feat && RARES[a.feat] && RARES[a.feat].use === s.g ? a.feat : null; s.featQty = clamp(a.featQty | 0, 0, 20); }
  }
  if (a.type === 'route') {
    const s = S.shops.find(x => x.id === a.shop), lv = s.route ? s.route.lv + 1 : 1;
    p.cash -= ROUTES[a.k].cost[lv - 1]; p.yCapex = (p.yCapex || 0) + ROUTES[a.k].cost[lv - 1]; s.route = { k: a.k, lv }; if (lv === 2) p.flags.route2 = 1;
    fx.push({ kind: 'route', pid, shop: s.id, k: a.k, lv });
  }
  if (a.type === 'close') {
    const s = S.shops.find(x => x.id === a.shop); p.cash += Math.round(shopValue(S, s) * 0.8); S.shops = S.shops.filter(x => x !== s); fx.push({ kind: 'close', pid, shop: s.id, g: s.g, d: s.d });
  }
  if (a.type === 'buy') {
    const { c, st } = takeCost(S, a.res, a.qty, SPREAD); p.cash -= c; p.inv[a.res] += a.qty; p.invCost[a.res] += c;
    S.mk[a.res].stock = st; S.mk[a.res].buy += a.qty; setPrice(S, a.res);
    fx.push({ kind: 'buy', pid, res: a.res, qty: a.qty });
  }
  if (a.type === 'sell') {
    const { g: got, st } = giveGot(S, a.res, a.qty, SPREAD);
    const avg = p.inv[a.res] ? p.invCost[a.res] / p.inv[a.res] : 0;
    p.invCost[a.res] -= avg * a.qty; p.inv[a.res] -= a.qty; p.cash += got; S.mk[a.res].stock = st; S.mk[a.res].sell += a.qty; setPrice(S, a.res);
    fx.push({ kind: 'sell', pid, res: a.res, qty: a.qty, got });
  }
  if (a.type === 'repay') { const amt = Math.min(a.amt, p.debt); p.cash -= amt; p.debt -= amt; }
  if (a.type === 'quest') { const q = S.quests.find(x => x.id === a.id); q.taker = pid; q.took = S.t; fx.push({ kind: 'questTake', pid, q: q.id }); }
  if (a.type === 'deliver') { const q = S.quests.find(x => x.id === a.id); const u = Math.min(a.qty, q.qty - q.got); const avg = p.invCost[q.item] / p.inv[q.item]; p.inv[q.item] -= u; p.invCost[q.item] -= avg * u; q.got += u; p.cash += u * q.price; fx.push({ kind: 'deliver', pid, q: q.id, qty: u, got: u * q.price }); if (q.got >= q.qty) { q.done = 1; p.cash += q.bonus; fx.push({ kind: 'questDone', pid, q: q.id, bonus: q.bonus }); } }
  if (a.type === 'buyshop') {
    const t = S.shops.find(x => x.id === a.shop), seller = S.players[t.owner];
    // 持ち主が AI なら、損得で売るか決める(お金に困っている・赤字・高く買ってくれるなら売る)
    const v = shopValue(S, t), losing = t.hist.length >= 2 && t.hist.slice(-2).every(x => x < 0), poor = seller.cash < 150;
    const ok = !seller.ai ? !!a.agreed : (a.price >= v * (poor ? 1.0 : losing ? 1.1 : 1.6));
    if (ok) { p.cash -= a.price; seller.cash += a.price; const from = t.owner; t.owner = pid; t.feat = null; t.featQty = 0; fx.push({ kind: 'buyshop', pid, from, shop: t.id, price: a.price }); }
    else fx.push({ kind: 'buyshopNo', pid, from: t.owner, shop: t.id, price: a.price });
  }
  if (a.type === 'vote') { S.vote.ballots[pid] = a.bill; }
  if (a.type === 'hire') { const sh = S.shops.find(x => x.id === a.shop), c = p.cands.find(x => x.id === a.cand); crewOf(S, sh).push({ ...c }); sh.staff = sh.crew.length; p.cands = p.cands.filter(x => x !== c); fx.push({ kind: 'hire', pid, shop: sh.id, who: c }); }
  if (a.type === 'fire') { const sh = S.shops.find(x => x.id === a.shop); sh.crew = sh.crew.filter(x => x.id !== a.staffId); sh.staff = sh.crew.length; }
  if (a.type === 'propose') {
    const to = S.players[a.to], c = { seller: a.role === 'sell' ? pid : a.to, buyer: a.role === 'sell' ? a.to : pid, item: a.item, qty: Math.round(a.qty), price: Math.round(a.price * 100) / 100, months: a.months, pay: a.pay, from: pid };
    if (to.ai) { const ok = aiPactOk(S, a.to, c); if (ok) newPact(S, c); fx.push({ kind: ok ? 'pactYes' : 'pactNo', pid, to: a.to, pact: c }); }
    else (S.pactQ = S.pactQ || []).push(c);   // 人どうし: 相手の「申し出」に届く
  }
  if (a.type === 'factor') { const r = S.recv.find(x => x.id === a.id); const got = Math.round(r.amt * (1 - FACTOR_FEE)); p.cash += got; r.to = -1; fx.push({ kind: 'factor', pid, amt: r.amt, got }); }
  if (a.type === 'bridge') { p.cash += a.amt; (S.recv = S.recv || []).push({ id: S.nextOffer++, from: pid, to: -1, amt: Math.round(a.amt * (1 + BRIDGE_RATE)), due: S.t + 1, bridge: 1 }); fx.push({ kind: 'bridge', pid, amt: a.amt }); }
  if (a.type === 'deal' && p.offers.find(x => x.id === a.id).kind === 'shopbid') { const o = p.offers.find(x => x.id === a.id), t = S.shops.find(x => x.id === o.shop), rv = S.players[o.rival]; rv.cash -= o.price; p.cash += o.price; t.owner = rv.id; t.feat = null; t.featQty = 0; p.offers = p.offers.filter(x => x !== o); fx.push({ kind: 'buyshop', pid: rv.id, from: pid, shop: t.id, price: o.price }); }
  else if (a.type === 'deal' && p.offers.find(x => x.id === a.id).kind === 'pact') { const o = p.offers.find(x => x.id === a.id); newPact(S, o.pact); p.offers = p.offers.filter(x => x !== o); fx.push({ kind: 'pactYes', pid: o.pact.from, to: pid, pact: o.pact }); }
  else if (a.type === 'deal') {
    const o = p.offers.find(x => x.id === a.id);
    if (o.kind === 'buy') { const avg = p.invCost[o.item] / p.inv[o.item]; p.inv[o.item] -= o.qty; p.invCost[o.item] -= avg * o.qty; p.cash += o.qty * o.price;
      if (o.rival != null) { const rv = S.players[o.rival]; rv.inv[o.item] += o.qty; rv.invCost[o.item] += o.qty * o.price; rv.cash -= o.qty * o.price; const sh = shopsOf(S, rv.id).find(x => x.g === RARES[o.item].use); if (sh) { sh.feat = o.item; sh.featQty = Math.max(sh.featQty, Math.min(10, o.qty)); } } }
    else { p.cash -= o.qty * o.price; p.inv[o.item] += o.qty; p.invCost[o.item] += o.qty * o.price; }
    p.offers = p.offers.filter(x => x !== o); p.deals++;
    fx.push({ kind: 'deal', pid, offer: o });
  }
  if (a.type === 'card') {
    const c = cardDef(a.card); p.cash -= c.cost; p.hand.splice(p.hand.indexOf(a.card), 1); a = { ...a, card: c.base };
    const s = a.shop != null ? S.shops.find(x => x.id === a.shop) : null;
    if (a.card === 'shout') { s.boost *= 1.5; s.promo = (s.promo || 0) + c.cost; s.promoK = (s.promoK || 1) * 1.5; s.promoName = '呼び込み'; }
    if (a.card === 'sale') s.saleNow = 1;
    if (a.card === 'craft') { s.qual = Math.min(2, s.qual + 1); s.rep = Math.min(1, s.rep + 0.08); }
    if (a.card === 'helper') s.helper = 3;
    if (a.card === 'remodel') s.rep = Math.min(1, s.rep + 0.2);
    if (a.card === 'scout') p.scout = S.t + 1;
    if (a.card === 'loan') { p.cash += 500; p.debt += 500; }
    if (a.card === 'contract') { const need = monthlyUse(S, pid, a.res) * 3 || 60; p.contracts.push({ res: a.res, price: S.market[a.res].price, left: 3, qty: Math.ceil(need / 3), stock: 0 }); }
    if (a.card === 'poach') { s.boost *= 0.7; for (const m of S.shops) if (m.owner === pid && m.d === s.d && m.g === s.g) m.boost *= 1.4; }
    if (a.card === 'headhunt') { s.under = 2; const best = storesOf(S, pid).sort((x, y) => (y.last ? y.last.want : 0) - (x.last ? x.last.want : 0))[0]; if (best) best.helper = Math.max(best.helper, 2); }
    if (a.card === 'dump') { late.push(() => { S.mk[a.res].stock += normalStock(a.res) * 0.35; setPrice(S, a.res); }); }
    fx.push({ kind: 'card', pid, card: a.card, shop: a.shop, res: a.res, target: s ? s.owner : null });
  }
  return null;
}
// ── 商人どうしの契約: 毎月 決まった数を決まった値段で受け渡す。払いは「その月」か「翌月(売掛金)」
export const FACTOR_FEE = 0.05, BRIDGE_RATE = 0.04, BRIDGE_MAX = 800, PACT_SHORT = 0.2;
export function useOf(S, pid, item) {
  if (RES[item]) return monthlyUse(S, pid, item) + shopsOf(S, pid).filter(s => s.g === 'work' && s.res === item).reduce((a, s) => a + workCap(s), 0);
  if (PROC[item]) return storesOf(S, pid).filter(s => s.useProc && RES[GOODS[s.g].res].proc === item).reduce((a, s) => a + (s.last ? s.last.units : 0) * 0.6, 0);
  return 0;
}
export function makeOf(S, pid, item) { return PROC[item] ? shopsOf(S, pid).filter(s => s.g === 'work' && RES[s.res].proc === item).reduce((a, s) => a + workCap(s), 0) : 0; }
function newPact(S, c) { (S.pacts = S.pacts || []).push({ id: S.nextOffer++, ...c, left: c.months, done: 0, short: 0, t0: S.t }); }
// AI が契約を受けるか: 使う(作る)見込みがあり、市場の値段と比べて得なら受ける。翌月払いは、払う側に得・受け取る側に損
function aiPactOk(S, aid, c) {
  const m = S.market[c.item].price, q = S.players[aid];
  if (c.buyer === aid) { const use = useOf(S, aid, c.item); if (use < c.qty * 0.7) return false; return c.price <= m * (c.pay ? 1.04 : 0.99) && q.cash > c.qty * c.price * (c.pay ? 0.5 : 1.5); }
  const have = (q.inv[c.item] || 0) + makeOf(S, aid, c.item) * c.months; if (have < c.qty * c.months * 0.8) return false;
  return c.price >= m * (c.pay ? 1.07 : 1.02);
}
// ライバルからの契約の申し出(人の商会へ)
function pactOffers(S) {
  // ライバルが、あなたの儲かっている店を買いたいと言ってくる(お金に余裕があり、店を増やしたいとき)
  for (const p of S.players) {
    if (p.ai || S.t < 6 || S.t > S.months - 4 || rnd(S) > 0.2) continue;
    const rv = S.players.filter(o => o.ai && o.id !== p.id && shopsOf(S, o.id).length < MAX_SHOPS).sort((a, b) => b.cash - a.cash)[0];
    const t = shopsOf(S, p.id).filter(x => x.g !== 'work' && x.hist.length >= 3 && x.hist.slice(-3).reduce((a, b) => a + b, 0) > 45).sort((a, b) => shopValue(S, b) - shopValue(S, a))[0];
    if (!rv || !t) continue; const price = Math.round(shopValue(S, t) * (1.25 + rnd(S) * 0.35) / 10) * 10;
    if (rv.cash > price + 400) p.offers.push({ id: S.nextOffer++, kind: 'shopbid', shop: t.id, price, rival: rv.id, item: GOODS[t.g].res, qty: 1, who: rv.name + '(ライバル)' });
  }
  for (const p of S.players) {
    if (p.ai || rnd(S) > 0.45) continue;
    for (const rv of S.players.filter(o => o.ai && o.id !== p.id)) {
      // 自分が作るものを、それを使うあなたに売りたい
      for (const k of Object.keys(PROC)) { const mk = makeOf(S, rv.id, k), use = useOf(S, p.id, k) + useOf(S, p.id, Object.keys(RES).find(r => RES[r].proc === k)) * 0.3; if (mk >= 10 && use >= 8 && rnd(S) < 0.5) { const qty = Math.max(5, Math.round(Math.min(mk * 0.7, use) / 5) * 5), pay = rnd(S) < 0.5 ? 1 : 0; const c = { seller: rv.id, buyer: p.id, item: k, qty, price: Math.round(S.market[k].price * (pay ? 1.06 : 1.01 + rnd(S) * 0.04) * 100) / 100, months: rnd(S) < 0.5 ? 3 : 6, pay, from: rv.id }; p.offers.push({ id: S.nextOffer++, kind: 'pact', pact: c, item: k, qty, price: c.price, who: rv.name + '(ライバル)' }); return; } }
      // あなたが作る・抱えているものを、使いたい
      for (const k of Object.keys(ITEMS).filter(x => !isRare(x))) { const have = makeOf(S, p.id, k) + (p.inv[k] || 0) / 3, use = useOf(S, rv.id, k); if (have >= 10 && use >= 10 && rnd(S) < 0.5) { const qty = Math.max(5, Math.round(Math.min(have, use) * 0.6 / 5) * 5), pay = rnd(S) < 0.6 ? 1 : 0; const c = { seller: p.id, buyer: rv.id, item: k, qty, price: Math.round(S.market[k].price * (pay ? 1.02 + rnd(S) * 0.04 : 0.95 + rnd(S) * 0.05) * 100) / 100, months: rnd(S) < 0.5 ? 3 : 6, pay, from: rv.id }; p.offers.push({ id: S.nextOffer++, kind: 'pact', pact: c, item: k, qty, price: c.price, who: rv.name + '(ライバル)' }); return; } }
    }
  }
}
function settlePacts(S, fx) {
  S.recv = S.recv || []; S.pacts = S.pacts || [];
  // 期日の来た売掛金・つなぎ融資を払う(お金が足りなくても払う。足りない分は救済融資になる)
  for (const r of S.recv.filter(x => x.due <= S.t)) {
    if (r.from >= 0) S.players[r.from].cash -= r.amt; if (r.to >= 0) S.players[r.to].cash += r.amt;
    fx.push({ kind: 'recvPaid', from: r.from, to: r.to, amt: r.amt, bridge: r.bridge });
  }
  S.recv = S.recv.filter(x => x.due > S.t);
  for (const c of S.pacts) {
    if (c.left <= 0) continue;
    const se = S.players[c.seller], bu = S.players[c.buyer];
    const q = Math.max(0, Math.min(c.qty, Math.floor(se.inv[c.item] || 0)));
    if (q > 0) { const avg = se.invCost[c.item] / se.inv[c.item]; se.inv[c.item] -= q; se.invCost[c.item] -= avg * q; bu.inv[c.item] += q; bu.invCost[c.item] += q * c.price; }
    const amt = Math.round(q * c.price);
    if (c.pay) S.recv.push({ id: S.nextOffer++, from: c.buyer, to: c.seller, amt, due: S.t + 1, pact: c.id }); else { bu.cash -= amt; se.cash += amt; }
    const short = c.qty - q; if (short > 0) { const pen = Math.round(short * c.price * PACT_SHORT); se.cash -= pen; bu.cash += pen; c.short += short; }
    c.done += q; c.left--;
    fx.push({ kind: 'pactDeliver', pact: c.id, seller: c.seller, buyer: c.buyer, item: c.item, q, amt, pay: c.pay, short });
  }
  S.pacts = S.pacts.filter(c => c.left > 0 || c.t0 > S.t - 12).slice(-20);
}
function monthlyUse(S, pid, res) { return storesOf(S, pid).filter(s => GOODS[s.g].res === res).reduce((a, s) => a + (s.last ? s.last.units : s.staff * GOODS[s.g].capPer * 0.6), 0); }

// お客の取り合い(1つの地区・1つの業種の中で)
export const rentOf = (S, d) => DISTRICTS[d].rent * (kindOf(d) === 'plaza' ? (lawOn(S, 'plazaRent') ? 1.25 : 1) * (lawOn(S, 'fair') ? 1.1 : 1) : 1);
export const prosperK = (S, d) => (S.prosper && S.prosper[d]) || 1;
function demandOf(S, d, g, noise) { return DISTRICTS[d].demand[g] * 1.25 * prosperK(S, d) * (lawOn(S, 'fair') && kindOf(d) === 'plaza' ? 1.15 : 1) * (lawOn(S, 'wage') ? 1.05 : 1) * weatherMult(S, d, g) * season(S, g, d) * activeMult(S, 'dem', g, d) * activeMult(S, 'dist', d, d) * noise; }
function attraction(S, s, pm) {
  const G = GOODS[s.g], R = routeFx(s);
  const kd = kindOf(s.d), repExp = kd === 'hill' ? 1.7 : 1.2, nob = kd === 'noble' ? 0.55 : 1;
  return Math.pow(0.35 + s.rep, repExp) * QUALITY[s.qual].k * R.qual * Math.pow(1 / pm, G.elastic * 1.6 * R.elastic * nob) * ADS[s.ads].k * s.boost * streetBonus(S, s) * (1 + 0.15 * (s.home || 0)) * (LOTS[s.lot] && LOTS[s.lot].road ? ROAD_BONUS * (lawOn(S, 'road') ? 1.08 : 1) : 1) * featK(S, s) * crewAtt(s);
}
// 目玉商品(レア素材)を並べた店は客寄せが上がる(1個 +8%、最大 +60%)
function featUnits(S, s) { if (!s.feat || !s.featQty) return 0; const p = S.players[s.owner]; return Math.min(s.featQty, Math.floor(p.inv[s.feat] || 0)); }
export const capOf = (s) => capRaw(s);
export function featK(S, s) { const u = featUnits(S, s); return u ? Math.min(1.6, 1 + 0.08 * u) : 1; }
// 売値の基準は相場だが、ふだんの2倍までにする(自分で買い占めて相場をつり上げても売値は上がりすぎない)
export const featPremium = (S, s, k) => Math.min(S.market[k].price, RARES[k].base * 2) * (kindOf(s.d) === 'noble' && k === 'seapearl' ? 2.2 : 1.7);
const capRaw = (s) => crewCapK(s) * GOODS[s.g].capPer * routeFx(s).cap * (s.helper > 0 ? 1.3 : 1) * (s.under > 0 ? 0.7 : 1);

// ── 1か月進める。decisions: {pid: [actions]}(人間とAIの決断)。順番は種で公平にまぜる
// お金の流れ(その月に現金がなぜ増えた・減ったか)を項目ごとに記録する
const flowAdd = (p, k, v) => { if (!p.flow) p.flow = {}; if (Math.abs(v) >= 0.005) p.flow[k] = (p.flow[k] || 0) + v; };
const snapCash = (S) => S.players.map(p => p.cash);
const bookCash = (S, before, label) => S.players.forEach((p, i) => flowAdd(p, typeof label === 'function' ? label(p) : label, p.cash - before[i]));
const ACT_LABEL = { open: '建設', route: '育て方', buy: '市場で買った', sell: '市場で売った', card: 'カード', deal: '商人との取引', repay: '借金の返済', bridge: 'つなぎ融資(借りた)', factor: '売掛金を前倒し', buyshop: '店の買い取り', close: '店をたたんだ(売った)', quest: '町の依頼', deliver: '町の依頼', propose: '契約' };
export function step(S, decisions = {}) {
  if (S.over) return { fx: [], errors: [] };
  const fx = [], errors = [], late = [];
  for (const p of S.players) if (p.ai && !decisions[p.id]) decisions[p.id] = aiDecide(S, p.id);
  const order = S.players.map(p => p.id).sort((a, b) => ((a * 7919 + S.t * 104729 + S.seed) % 97) - ((b * 7919 + S.t * 104729 + S.seed) % 97));
  for (const p of S.players) { p.flow = {}; p.cash0 = p.cash; }
  for (const pid of order) for (const a of (decisions[pid] || [])) { const b = snapCash(S); const e = applyAction(S, pid, a, fx, late); if (e) errors.push({ pid, a, e }); bookCash(S, b, (p) => p.id === pid ? (ACT_LABEL[a.type] || 'その他') : a.type === 'buyshop' ? '店を売った' : 'ライバルとの取引'); }
  // 予告されていた出来事が始まる
  const bEv = snapCash(S);
  if (S.evNext) { S.ev = S.evNext; const e = evDef(S.ev.id); S.evActive.push({ id: S.ev.id, left: e.len }); if (e.tax) for (const p of S.players) { const tx = Math.round(Math.max(0, p.cash) * e.tax); p.cash -= tx; fx.push({ kind: 'tax', pid: p.id, amt: tx }); } }
  S.evNext = pickEvent(S);
  S.w = S.wNext || 'cloudy'; S.wHist = (S.wHist || []).concat(S.w).slice(-6);
  for (const k in ITEMS) { S.mk[k].shop = 0; }
  bookCash(S, bEv, '臨時の税');
  { const b = snapCash(S); for (const f of late) f(); bookCash(S, b, 'その他'); }
  for (const k in ITEMS) { S.mk[k].buyM = S.mk[k].buy; S.mk[k].sellM = S.mk[k].sell; }
  // 客の取り合い
  const res = {}; S.missed = {};
  for (const d in DISTRICTS) { S.missed[d] = {}; for (const g in GOODS) if (!S.shops.some(s => s.d === d && s.g === g)) S.missed[d][g] = demandOf(S, d, g, 1) * 0.5 + spillOf(S, d, g).add * 0.4; }
  for (const d in DISTRICTS) for (const g in GOODS) {
    const shops = S.shops.filter(s => s.d === d && s.g === g); if (!shops.length) continue;
    const sp = spillOf(S, d, g), D = demandOf(S, d, g, 0.96 + 0.08 * rnd(S)) + sp.add * weatherMult(S, d, g), G = GOODS[g];
    const pm = shops.map(s => PRICE_LV[s.priceLv] * (s.saleNow ? 0.8 : 1));
    const att = shops.map((s, i) => attraction(S, s, pm[i]));
    const A0 = 0.55, sum = att.reduce((a, b) => a + b, 0);
    const want = att.map(a => D * a / (A0 + sum) * Math.min(1.25, 0.75 + 0.25 * shops.length));
    // 常連(地域密着): 先月のお客の一部は、ライバルに関係なく戻ってくる
    shops.forEach((s, i) => { const L = routeFx(s).loyal; if (L && s.last) want[i] = Math.max(want[i], s.last.units * L * (0.6 + s.rep * 0.5)); });
    // 真横の安い店: 隣り合う同業の店で、値段が一段以上安いほうに客が流れる
    shops.forEach((a, i) => shops.forEach((b, j) => { if (i !== j && NEIGHBORS[a.lot].includes(b.lot) && pm[i] < pm[j] - 0.05) { const mv = want[j] * 0.15 * (1 - routeFx(b).loyal); want[j] -= mv; want[i] += mv; } }));
    // 目玉商品は職人の手を使う: 1個あたり、普段の客 capPer×0.1 人分の枠を使う
    const cap = shops.map(s => Math.max(0, capOf(s) - featUnits(S, s) * GOODS[s.g].capPer * 0.1));
    const served = want.map((w, i) => Math.min(w, cap[i]));
    let spill = want.reduce((a, w, i) => a + Math.max(0, w - cap[i]), 0) * 0.6;
    for (let it = 0; it < 2 && spill > 0.5; it++) {
      const room = shops.map((s, i) => Math.max(0, cap[i] - served[i])); const rs = room.reduce((a, b) => a + b, 0); if (rs <= 0) break;
      const give = Math.min(spill, rs); shops.forEach((s, i) => { served[i] += give * room[i] / rs; }); spill -= give;
    }
    const why = { spill: sp.add, spillFrom: sp.from, wk: weatherMult(S, d, g), ek: activeMult(S, 'dem', g, d) * activeMult(S, 'dist', d, d), sk: season(S, g, d), n: shops.length };
    shops.forEach((s, i) => { res[s.id] = { D, want: want[i], cap: cap[i], served: served[i], why: { ...why, boost: s.boost, share: want[i] / Math.max(1, D) } }; });
    S.missed[d][g] = want.reduce((a, w, i) => a + Math.max(0, w - served[i]), 0);
  }
  // 損益
  for (const s of S.shops) {
    if (s.g === 'work') { workMonth(S, s, fx); continue; }
    const p = S.players[s.owner], G = GOODS[s.g], r = res[s.id] || { want: 0, cap: 0, served: 0 }, R = routeFx(s);
    const pm = PRICE_LV[s.priceLv] * (s.saleNow ? 0.8 : 1);
    const units = r.served, revenue = units * G.ref * pm;
    let need = units * QUALITY[s.qual].cost * R.cost * crewCost(s), cogs = 0;
    // 自分の工房の加工品があれば先に使う(自家製: 次の月の客寄せ +15%)
    const pk = RES[G.res].proc; let homeU = 0;
    if (s.useProc && p.inv[pk] > 0 && need > 0) { const u = Math.min(need, p.inv[pk]); const avg = p.invCost[pk] / p.inv[pk]; cogs += u * avg * 0.5; p.inv[pk] -= u; p.invCost[pk] -= u * avg; need -= u; homeU = u; }
    s.home = units > 0 ? homeU / Math.max(1, units * QUALITY[s.qual].cost * R.cost) : 0;
    for (const ct of p.contracts) if (need > 0 && ct.res === G.res && ct.stock > 0) { const u = Math.min(need, ct.stock); cogs += u * ct.price; ct.stock -= u; need -= u; }
    if (need > 0 && p.inv[G.res] > 0) { const u = Math.min(need, p.inv[G.res]); const avg = p.invCost[G.res] / p.inv[G.res]; cogs += u * avg; p.inv[G.res] -= u; p.invCost[G.res] -= u * avg; need -= u; }
    let cashCogs = 0;
    if (need > 0) { const { c, st } = takeCost(S, G.res, need, 0); cogs += c; cashCogs = c; S.mk[G.res].stock = st; S.mk[G.res].shop += need; setPrice(S, G.res); }
    // 目玉商品: 並べた分は特別な品として高く売れる(素材の相場の1.7倍。真珠は貴族街で2.3倍)
    let featRev = 0, featUsed = 0;
    const fu = featUnits(S, s);
    if (fu > 0 && units > 0) { featUsed = fu; const k = s.feat, avg = p.invCost[k] / p.inv[k]; featRev = fu * featPremium(S, s, k); cogs += fu * avg; p.inv[k] -= fu; p.invCost[k] -= fu * avg; }
    const labor = crewWage(s), rent = rentOf(S, s.d) * R.rent, ads = ADS[s.ads].cost;
    const profit = revenue + featRev - cogs - labor - rent - ads;
    p.cash += revenue + featRev - cashCogs - labor - rent - ads; p.yProfit = (p.yProfit || 0) + profit;
    flowAdd(p, '店の売上', revenue + featRev); flowAdd(p, '材料の仕入れ', -cashCogs); flowAdd(p, 'お給料', -labor); flowAdd(p, '家賃', -rent); flowAdd(p, '宣伝', -ads);
    if (profit >= 250) p.flags.bigm = 1;
    p.flags.rareRev = (p.flags.rareRev || 0) + featRev;
    const prev = s.last;
    // 集客の4段階(通行→入店→購入→また来た)。それぞれ何が効くかを分けて見せる
    const road = LOTS[s.lot] && LOTS[s.lot].road;
    const entry = clamp(0.1 * ADS[s.ads].k * (s.boost || 1) * (road ? ROAD_BONUS * 1.1 : 1) * (0.7 + s.rep * 0.6) * streetBonus(S, s), 0.03, 0.6);
    const buyR = clamp(0.32 * Math.pow(1 / pm, G.elastic * 0.9 * R.elastic) * QUALITY[s.qual].k * R.qual * (1 + 0.15 * (s.home || 0)), 0.05, 0.9);
    const buyers = units, visitors = Math.max(buyers, r.want / buyR), passers = Math.max(visitors, visitors / entry);
    const repeat = Math.min(buyers, buyers * clamp(0.15 + s.rep * 0.45 + R.loyal * 0.6 - (r.want > r.cap * 1.05 ? 0.12 : 0), 0, 0.85));
    // 集客にかけたお金の成績: 広告・呼び込み・大安売りで増えた購入 × 1件の粗利 − かけたお金
    const unitGross = units > 0 ? (revenue - cogs) / units : 0;
    const promoK = ADS[s.ads].k * (s.promoK || 1) * (s.saleNow ? Math.pow(1 / 0.8, G.elastic * 1.6) : 1);
    const promoCost = ADS[s.ads].cost + (s.promo || 0);
    let roi = null;
    if (promoK > 1.01) { const base = Math.min(r.want / promoK, r.cap); const extra = Math.max(0, units - base); const saleLoss = s.saleNow ? units * G.ref * PRICE_LV[s.priceLv] * 0.2 : 0; roi = { extra, unitGross, gain: extra * unitGross, cost: promoCost, saleLoss, net: extra * unitGross - promoCost - (s.saleNow ? 0 : 0), names: [s.ads ? 'ADS' : null, s.promoName || null, s.saleNow ? '大安売り' : null].filter(Boolean) }; }
    // 客の出どころ別: 入店・購入・粗利(ついで買いの客は買う割合が低い、常連は高い)
    const w0 = r.why || {}, Dtot = Math.max(1, r.D || 1);
    const shSpill = clamp((w0.spill || 0) / Dtot, 0, 0.9), shPromo = clamp(1 - 1 / promoK, 0, 0.9), shRoad = road ? 1 - 1 / ROAD_BONUS : 0, shRep = buyers > 0 ? repeat / buyers : 0;
    const raw = { repeat: shRep, spill: (1 - shRep) * shSpill, promo: (1 - shRep) * (1 - shSpill) * shPromo, road: (1 - shRep) * (1 - shSpill) * (1 - shPromo) * shRoad };
    raw.walk = Math.max(0, 1 - raw.repeat - raw.spill - raw.promo - raw.road);
    const rateK = { repeat: 1.8, spill: 0.4, promo: 0.85, road: 0.9, walk: 1 };
    const srcB = {}, srcV = {}; let vsum = 0;
    for (const k in raw) { srcB[k] = buyers * raw[k]; srcV[k] = srcB[k] / Math.max(0.03, buyR * rateK[k]); vsum += srcV[k]; }
    const vk = vsum > 0 ? visitors / vsum : 1;
    const sources = Object.keys(raw).filter(k => srcB[k] >= 0.5).map(k => ({ k, visitors: srcV[k] * vk, buyers: srcB[k], gross: srcB[k] * unitGross }));
    s.last = { featUsed, featRev, featKey: featUsed ? s.feat : null, units, want: r.want, cap: r.cap, D: r.D, revenue: revenue + featRev, cogs, labor, rent, ads, profit, price: G.ref * pm, why: r.why, funnel: { passers, visitors, buyers, repeat, entry, buyR }, roi, sources, unitCost: units > 0 ? cogs / units : 0, resK: S.market[G.res].price / RES[G.res].base, home: s.home, prevUnits: prev ? prev.units : null, prevProfit: prev ? prev.profit : null, sale: s.saleNow };
    s.hist.push(profit); if (s.hist.length > 24) s.hist.shift();
    const ok = r.want > 0 ? units / r.want : 1;
    const target = clamp(0.5 + 0.22 * s.qual + (R.qual - 1) * 0.6 - 0.9 * R.priceRep * (pm - 1) - 0.45 * Math.max(0, 1 - ok) + (s.saleNow ? 0.08 : 0), 0.05, 0.98);
    s.rep = clamp(s.rep + (target - s.rep) * 0.25 * (target > s.rep ? R.repGain * crewRep(s) : 1), 0.02, 1);
    s.months++; s.boost = 1; s.saleNow = 0; s.promo = 0; s.promoK = 1; s.promoName = null; if (s.helper > 0) s.helper--; if (s.under > 0) s.under--;
    fx.push({ kind: 'sales', pid: s.owner, shop: s.id, units, profit });
  }
  { const b = snapCash(S); settlePacts(S, fx); bookCash(S, b, '契約・売掛金'); }
  for (const p of S.players) {
    for (const c of p.contracts) { if (c.left > 0) { c.stock += c.qty; p.cash -= c.qty * c.price; flowAdd(p, '先物の約束(材料)', -c.qty * c.price); c.left--; } }
    p.contracts = p.contracts.filter(c => c.left > 0 || c.stock > 0.5);
    if (p.debt > 0) { p.cash -= p.debt * LOAN_RATE; flowAdd(p, '借金の利息', -p.debt * LOAN_RATE); }
    if (p.cash < 0) { const need = Math.ceil(-p.cash / 100) * 100; p.debt += need * 1.1; p.cash += need; flowAdd(p, '救済融資(借りた)', need); p.flags.bailed = 1; fx.push({ kind: 'bailout', pid: p.id, amt: need }); }
    for (const k in p.inv) if (p.inv[k] > 0) {
      p.cash -= p.inv[k] * ITEMS[k].base * 0.012; flowAdd(p, '保管料', -p.inv[k] * ITEMS[k].base * 0.012);   // 保管料
      const dc = ITEMS[k].decay; if (dc) { p.inv[k] *= 1 - dc; p.invCost[k] *= 1 - dc; }   // 傷んで減る
      if (p.inv[k] < 0.5) { p.inv[k] = 0; p.invCost[k] = 0; }
    }
  }
  const bTail = snapCash(S);
  for (const a of S.evActive) a.left--; S.evActive = S.evActive.filter(a => a.left > 0);
  // 月末: 生産と町の消費で在庫が動き、値段が決まる
  const mo = (S.t) % 12, ev = (kind, k) => { let m = 1; for (const a of S.evActive) { const e = evDef(a.id); if (e && e[kind] && e[kind][k] != null) m *= e[kind][k]; } return m; };
  const tariff = (k) => (lawOn(S, 'tariff') && (k === 'wool' || k === 'iron') ? 0.85 : 1);
  const wProd = (k) => tariff(k) * (() => { if (S.w === 'storm' && (k === 'wool' || k === 'iron')) return 0.8; if (S.w === 'heat' && (k === 'wheat' || k === 'herb')) return mo >= 5 && mo <= 7 ? 0.85 : 1; if (S.w === 'rain' && k === 'wheat' && mo >= 2 && mo <= 5) return 1.05; return 1; })();
  for (const k in ITEMS) {
    const m = S.mk[k], base = ITEMS[k].base, pk = S.market[k].price / base, N = normalStock(k);
    let prod, need;
    if (RARES[k]) {
      // ふだんも少しずつ入荷し、出回る出来事の月はどっと入る
      const pulse = S.evActive.some(a => { const e = evDef(a.id); return e && e.prod && e.prod[k] != null; });
      prod = RARE_NEED * (0.7 + 0.6 * rnd(S)) + (pulse ? RARE_PULSE * ev('prod', k) * (0.8 + 0.4 * rnd(S)) : 0);
      need = (RARE_NEED - 0.5 * (ITEMS[k].decay || 0) * RARE_N) * ev('need', k) * Math.pow(pk, -0.7);
    } else {
      const decay = ITEMS[k].decay || 0;
      prod = FLOW[k] * seasK(k, mo) * ev('prod', k) * wProd(k) * Math.pow(pk, 0.25) * (0.95 + 0.1 * rnd(S));
      need = Math.max(0, FLOW[k] - 0.5 * decay * N) * ev('need', k) * Math.pow(pk, -0.7);
    }
    const spoil = m.stock * (ITEMS[k].decay || 0) * 0.5;
    m.stock = Math.max(1, m.stock + prod - need - spoil);
    m.prod = prod; m.need = need; m.buy = 0; m.sell = 0;
    setPrice(S, k);
    S.market[k].hist.push(S.market[k].price); if (S.market[k].hist.length > 60) S.market[k].hist.shift();
  }
  for (const p of S.players) p.offers = [];
  makeOffers(S);
  for (const c of (S.pactQ || [])) S.players[c.from === c.seller ? c.buyer : c.seller].offers.push({ id: S.nextOffer++, kind: 'pact', pact: c, item: c.item, qty: c.qty, price: c.price, who: S.players[c.from].name });
  S.pactQ = [];
  pactOffers(S);
  // 店員: 新人は育ち、気まぐれは月ごとに調子が変わる。求職者が毎月入れかわる
  const trs = Object.keys(TRAITS).filter(k => k !== 'plain');
  for (const sh of S.shops) for (const c of crewOf(S, sh)) { c.months++; const T = TRAITS[c.trait]; if (T.grow) c.skill = Math.min(1.25 / T.cap, (c.skill || 1) + T.grow); c.moodK = T.moody ? 0.7 + rnd(S) * 0.6 : 1; }
  for (const p of S.players) { p.cands = []; for (let i = 0; i < 3; i++) p.cands.push(newStaff(S, trs[Math.floor(rnd(S) * trs.length)])); }
  forecastWeather(S);
  // 地区の景気: 店が払うお給料は住民の財布に回る。雇う人が増えると客が増え、閉店が続くと減る
  S.prosper = S.prosper || {}; S.prospHist = S.prospHist || {};
  for (const d in DISTRICTS) {
    const jobs = S.shops.filter(sh => sh.d === d).reduce((a, sh) => a + sh.staff, 0), lots = LOTS.filter(l => l.d === d).length;
    const target = clamp(0.92 + 0.22 * jobs / Math.max(1, lots * 2.2), 0.9, 1.15);
    const prev = S.prosper[d] || 1; S.prosper[d] = prev + (target - prev) * 0.15;
    (S.prospHist[d] = S.prospHist[d] || []).push(S.prosper[d]); if (S.prospHist[d].length > 12) S.prospHist[d].shift();
  }
  S.served = {}; for (const sh of S.shops) if (sh.g !== 'work' && sh.last) { (S.served[sh.d] = S.served[sh.d] || {})[sh.g] = (S.served[sh.d][sh.g] || 0) + sh.last.units; }
  S.ledger = fx.filter(f => f.kind === 'buy' || f.kind === 'sell' || f.kind === 'deal' || (f.kind === 'card' && f.card === 'dump') || f.kind === 'open' || f.kind === 'close').map(f => ({ ...f, t: S.t }));
  S.crowns = crownsOf(S);
  if (S.t === S.months - 12) fx.push({ kind: 'grand' });
  // 町の依頼: 期限切れは違約金。新しい依頼がときどき出る
  S.quests = (S.quests || []).filter(q => !q.done || q.doneT === undefined);
  for (const q of S.quests) if (!q.done && q.taker != null && S.t >= q.took + q.months - 1) { const p = S.players[q.taker]; const fine = Math.round(q.qty * q.price * QUEST_PENALTY * (1 - q.got / q.qty)); p.cash -= fine; q.done = 1; q.failed = 1; fx.push({ kind: 'questFail', pid: q.taker, q: q.id, fine }); }
  for (const q of S.quests) if (q.taker == null && !q.done && S.t >= q.posted + 3) { q.done = 1; q.expired = 1; }
  S.quests = S.quests.filter(q => !(q.done && q.endT != null && S.t > q.endT + 1)); for (const q of S.quests) if (q.done && q.endT == null) q.endT = S.t;
  if (!S.quests.some(q => q.taker == null && !q.done) && S.t % 3 === 1 && S.t < S.months - 4) {
    const Q = QUESTS[Math.floor(rnd(S) * QUESTS.length)];
    S.quests.push({ id: (S.nextQuest = (S.nextQuest || 0) + 1), ...Q, price: Math.round(S.market[Q.item].price * Q.k * 100) / 100, bonus: Math.round(S.market[Q.item].price * Q.qty * 0.15), got: 0, taker: null, posted: S.t });
    fx.push({ kind: 'questNew' });
  }
  // 商人ギルドの投票: 毎年6月に議題が出て、7月に決まる(1年有効)。1人1票 + 店2つごとに1票
  if (S.vote && S.vote.t === S.t) {
    for (const p of S.players) if (p.ai && S.vote.ballots[p.id] == null) S.vote.ballots[p.id] = aiVote(S, p.id);
    const tally = {}; for (const b of S.vote.bills) tally[b] = 0;
    for (const p of S.players) { const b = S.vote.ballots[p.id]; if (b) tally[b] += 1 + Math.floor(shopsOf(S, p.id).length / 2); }
    const win = S.vote.bills.slice().sort((a, b) => tally[b] - tally[a])[0];
    S.laws = S.laws || {}; S.laws[win] = S.t + 13;
    fx.push({ kind: 'law', bill: win, tally });
    S.vote = null;
  }
  if (S.t % 12 === 5 && S.t < S.months - 3) { const ks = Object.keys(BILLS).filter(k => !lawOn(S, k)); const bills = []; while (bills.length < 3 && ks.length) bills.push(ks.splice(Math.floor(rnd(S) * ks.length), 1)[0]); S.vote = { t: S.t + 1, bills, ballots: {} }; fx.push({ kind: 'voteOpen' }); }
  WAGE_ADD = lawOn(S, 'wage') ? 4 : 0;
  // 年末の決算: 店の利益の15%(ギルド税を下げたら10%)。その年の設備投資の半分は差し引ける
  if (S.t % 12 === 11) for (const p of S.players) {
    const taxable = Math.max(0, (p.yProfit || 0) - (p.yCapex || 0) * 0.5), rate = lawOn(S, 'guildTax') ? 0.1 : TAX_RATE, tax = Math.round(taxable * rate);
    p.cash -= tax; fx.push({ kind: 'yearTax', pid: p.id, tax, profit: Math.round(p.yProfit || 0), capex: Math.round(p.yCapex || 0), rate });
    p.yProfit = 0; p.yCapex = 0;
  }
  // 口コミ: 目立つ店のうわさ
  S.rumors = [];
  for (const sh of S.shops) {
    if (sh.g === 'work' || !sh.last) continue; const l = sh.last, nm = S.players[sh.owner].name, G = GOODS[sh.g];
    if (l.want > l.cap * 1.2) S.rumors.push({ pid: sh.owner, shop: sh.id, t: `「${nm}の${G.name}、行列で買えなかったよ」`, w: 3 });
    else if (sh.priceLv >= 3 && sh.rep > 0.6) S.rumors.push({ pid: sh.owner, shop: sh.id, t: `「${nm}の${G.name}は高いけど、品はいいね」`, w: 2 });
    else if (sh.priceLv >= 3 && sh.rep < 0.4) S.rumors.push({ pid: sh.owner, shop: sh.id, t: `「${nm}の${G.name}、高いわりに…」`, w: 2 });
    else if (sh.priceLv <= 1 && l.units > l.cap * 0.8) S.rumors.push({ pid: sh.owner, shop: sh.id, t: `「${nm}の${G.name}は安くて助かる」`, w: 2 });
    if (l.featUsed) S.rumors.push({ pid: sh.owner, shop: sh.id, t: `「${nm}の${G.name}に${RARES[l.featKey].name}の品が並んでたぞ!」`, w: 4 });
    if (sh.hist.length >= 3 && sh.hist.slice(-3).every(x => x < 0)) S.rumors.push({ pid: sh.owner, shop: sh.id, t: `「${nm}の${G.name}、最近お客が少ないね」`, w: 2 });
    if (sh.crew && sh.crew.some(c => c.trait === 'idol')) S.rumors.push({ pid: sh.owner, shop: sh.id, t: `「${nm}の${G.name}の看板娘、感じがいいんだ」`, w: 1 });
  }
  S.rumors = S.rumors.sort((a, b) => b.w - a.w + (rnd(S) - 0.5)).slice(0, 4);
  S.players.forEach((p, i) => { const tax = (fx.find(f => f.kind === 'yearTax' && f.pid === p.id) || {}).tax || 0; if (tax) flowAdd(p, '年末の税', -tax); flowAdd(p, '町の依頼など', p.cash - bTail[i] + tax); });
  peddlerMonth(S, fx);
  S.t++;
  if (S.t >= S.months) {
    // 大祭の褒美と秘密の目標
    for (const d in S.crowns) { const c = S.crowns[d]; if (c) { const p = S.players[c.pid]; p.cash += CROWN_BONUS; p.flags.crown = 1; fx.push({ kind: 'crown', pid: c.pid, d, amt: CROWN_BONUS }); } }
    for (const p of S.players) if (missionDone(S, p)) { p.cash += MISSION_BONUS; p.missionDone = 1; fx.push({ kind: 'mission', pid: p.id, m: p.mission }); }
    for (const p of S.players) { const bonus = fx.filter(f => (f.kind === 'crown' || f.kind === 'mission') && f.pid === p.id).reduce((a, f) => a + (f.kind === 'crown' ? f.amt : MISSION_BONUS), 0); if (bonus) flowAdd(p, '大祭のボーナス', bonus); }
    S.over = true;
  }
  const rk = ranking(S);
  for (const p of S.players) { p.nw.push(netWorth(S, p)); p.rankHist.push(rk.findIndex(x => x.p === p) + 1); }
  dealHands(S);
  return { fx, errors };
}
// 工房: 原料を加工品にする。作った分の一部を自動で市場に売れる
export function workCap(s) { return crewCapK(s) * PROC[RES[s.res].proc].rate * (s.helper > 0 ? 1.3 : 1) * (s.under > 0 ? 0.7 : 1); }
function workMonth(S, s, fx) {
  const p = S.players[s.owner], raw = s.res, pk = RES[raw].proc, P = PROC[pk];
  const cap = workCap(s), labor = crewWage(s), rent = rentOf(S, s.d);
  let bought = 0, buyCost = 0;
  if (s.autoBuy !== 0 && p.inv[raw] < cap) {
    let q = Math.floor(cap - p.inv[raw]); const budget = Math.max(0, p.cash - labor - rent);
    while (q > 0 && takeCost(S, raw, q, 0).c > budget) q = Math.floor(q * 0.7);
    if (q > 0) { const { c, st } = takeCost(S, raw, q, 0); p.cash -= c; p.inv[raw] += q; p.invCost[raw] += c; S.mk[raw].stock = st; S.mk[raw].shop += q; setPrice(S, raw); bought = q; buyCost = c; flowAdd(p, '材料の仕入れ', -c); }
  }
  const units = Math.min(cap, p.inv[raw]);
  let rawCost = 0;
  if (units > 0) { const avg = p.invCost[raw] / p.inv[raw]; rawCost = units * avg; p.inv[raw] -= units; p.invCost[raw] -= rawCost; p.inv[pk] += units; p.invCost[pk] += rawCost + labor + rent; p.flags.made += units; }
  p.cash -= labor + rent; flowAdd(p, 'お給料', -labor); flowAdd(p, '家賃', -rent);
  let sold = 0, got = 0;
  if (s.autoSell > 0 && p.inv[pk] > 0) { sold = Math.floor(p.inv[pk] * s.autoSell); if (sold > 0) { const r2 = giveGot(S, pk, sold, SPREAD); got = r2.g; const avg = p.invCost[pk] / p.inv[pk]; p.inv[pk] -= sold; p.invCost[pk] -= avg * sold; p.cash += got; S.mk[pk].stock = r2.st; S.mk[pk].sell += sold; setPrice(S, pk); } }
  const value = units * S.market[pk].price * (1 - SPREAD) - rawCost - labor - rent;
  if (got) flowAdd(p, '加工品を売った', got);
  s.last = { units, want: units, cap, D: 0, revenue: got, cogs: rawCost, labor, rent, ads: 0, profit: value, made: units, sold, got, bought, buyCost, short: Math.max(0, cap - units), noRaw: units === 0 };
  s.hist.push(value); if (s.hist.length > 24) s.hist.shift();
  s.months++; s.boost = 1; if (s.helper > 0) s.helper--; if (s.under > 0) s.under--;
  fx.push({ kind: 'made', pid: s.owner, shop: s.id, units, profit: value, item: pk });
}
// 旅の商人からの申し出(プレイヤーごとに別々。今月中に受けるかどうか決める)
function makeOffers(S) {
  const supply = S.evActive.map(a => evDef(a.id)).filter(e => e && e.prod).flatMap(e => Object.keys(e.prod).filter(k => RARES[k] && e.prod[k] >= 1));
  for (const p of S.players) {
    // 出回っているレア素材を売りに来る商人
    for (const k of supply) if (rnd(S) < 0.7) p.offers.push({ id: S.nextOffer++, kind: 'sell', item: k, qty: 3 + Math.floor(rnd(S) * 8), price: Math.round(S.market[k].price * (0.7 + rnd(S) * 0.15) * 100) / 100, k: 0.75, who: MERCHANTS[Math.floor(rnd(S) * MERCHANTS.length)], rareHint: 1 });
    // 海の真珠: 町に仕立て屋が少ないほど、よその町の商人が高く買う
    if ((p.inv.seapearl || 0) >= 2 && rnd(S) < 0.6) { const tailors = S.shops.filter(x => x.g === 'cloth').length; const kk = 1.05 + Math.max(0, 3 - tailors) * 0.12 + rnd(S) * 0.15; p.offers.push({ id: S.nextOffer++, kind: 'buy', item: 'seapearl', qty: Math.min(Math.floor(p.inv.seapearl), 2 + Math.floor(rnd(S) * 6)), price: Math.round(S.market.seapearl.price * kk * 100) / 100, k: kk, who: 'よその町の仕立て屋' }); }
    // 月光草: 薬師ギルドと宿屋(月見酒)が別々の値段で買いに来る(どちらが高いかは月による)
    if ((p.inv.moonherb || 0) >= 2) for (const who of ['薬師ギルド', '宿屋の主人(月見酒)']) { const kk = 0.95 + rnd(S) * 0.45; p.offers.push({ id: S.nextOffer++, kind: 'buy', item: 'moonherb', qty: Math.min(Math.floor(p.inv.moonherb), 3 + Math.floor(rnd(S) * 5)), price: Math.round(S.market.moonherb.price * kk * 100) / 100, k: kk, who }); }
    // レア素材を持っていると、それを目玉にできる店を持つライバルが前金つきで買いに来る
    for (const k of Object.keys(RARES)) {
      if ((p.inv[k] || 0) < 3) continue;
      const rv = S.players.find(o => o.id !== p.id && shopsOf(S, o.id).some(s => s.g === RARES[k].use) && rnd(S) < 0.45);
      if (rv) { const q = Math.min(Math.floor(p.inv[k]), 3 + Math.floor(rnd(S) * 6)); const kk = 1.15 + rnd(S) * 0.25; p.offers.push({ id: S.nextOffer++, kind: 'buy', item: k, qty: q, price: Math.round(S.market[k].price * kk * 100) / 100, k: kk, who: `${rv.name}(ライバル)`, rival: rv.id }); }
    }
    const n = rnd(S) < 0.55 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const held = Object.keys(ITEMS).filter(k => p.inv[k] >= 20);
      const buy = held.length && rnd(S) < 0.6;
      const keys = buy ? held.filter(k => !RARES[k]) : Object.keys(ITEMS).filter(k => !RARES[k]);
      if (!keys.length) continue;
      const item = keys[Math.floor(rnd(S) * keys.length)];
      const big = rnd(S) < 0.18;
      const k = buy ? (big ? 1.35 + rnd(S) * 0.25 : 1.08 + rnd(S) * 0.22) : (big ? 0.6 + rnd(S) * 0.1 : 0.72 + rnd(S) * 0.16);
      const unit = Math.max(0.01, S.market[item].price * k);
      const baseQ = isProc(item) ? 40 : 90;
      let qty = Math.round((baseQ * (0.5 + rnd(S) * 1.2)) / 10) * 10 * (item === 'wheat' || item === 'flour' ? 2 : 1);
      if (buy) qty = Math.max(10, Math.min(qty, Math.floor(p.inv[item] / 10) * 10 || 10));
      p.offers.push({ id: S.nextOffer++, kind: buy ? 'buy' : 'sell', item, qty, price: Math.round(unit * 100) / 100, k, who: MERCHANTS[Math.floor(rnd(S) * MERCHANTS.length)] });
    }
  }
}
// 各地区で今いちばん客を集めている商会(大祭の「地区の覇者」の目安)
export function crownsOf(S) {
  const out = {};
  for (const d in DISTRICTS) {
    const by = {}; for (const s of S.shops) if (s.d === d && s.last && s.g !== 'work') by[s.owner] = (by[s.owner] || 0) + s.last.units;
    const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
    out[d] = top ? { pid: +top[0], units: top[1] } : null;
  }
  return out;
}
export function missionDone(S, p) {
  const mine = shopsOf(S, p.id), inv = Object.values(p.inv).reduce((a, b) => a + b, 0);
  switch (p.mission) {
    case 'port2': return mine.filter(s => kindOf(s.d) === 'port').length >= 2;
    case 'allg': return new Set(mine.filter(s => s.g !== 'work').map(s => s.g)).size >= 3;
    case 'bigm': return !!p.flags.bigm;
    case 'hoard': return inv >= 300;
    case 'clean': return !p.flags.bailed && p.debt <= 0.5;
    case 'route2': return !!p.flags.route2;
    case 'crown': return !!p.flags.crown || (S.crowns && Object.values(S.crowns).some(c => c && c.pid === p.id) && !S.over);
    case 'street': return streetPairs(S, p.id) >= 2;
    case 'maker': return p.flags.made >= 400;
    case 'trader': return p.deals >= 5;
    case 'rare': return (p.flags.rareRev || 0) >= 600;
  }
  return false;
}
export function missionProgress(S, p) {
  const mine = shopsOf(S, p.id), inv = Object.values(p.inv).reduce((a, b) => a + b, 0);
  switch (p.mission) {
    case 'port2': return `いま ${mine.filter(s => kindOf(s.d) === 'port').length}/2 店`;
    case 'allg': return `いま ${new Set(mine.filter(s => s.g !== 'work').map(s => s.g)).size}/3 業種`;
    case 'bigm': return p.flags.bigm ? '達成!' : `最高 ${Math.round(Math.max(0, ...mine.map(s => Math.max(0, ...s.hist))))}G`;
    case 'hoard': return `いま ${Math.round(inv)}/300`;
    case 'clean': return p.flags.bailed ? '救済されたので失敗' : `借金 ${Math.round(p.debt)}G`;
    case 'route2': return p.flags.route2 ? '達成!' : 'まだ';
    case 'crown': return S.t < S.months - 12 ? '最後の年の大祭で' : 'いまの覇者の地区: ' + (Object.entries(S.crowns || {}).filter(([, c]) => c && c.pid === p.id).map(([d]) => DISTRICTS[d].short).join('・') || 'なし');
    case 'street': return `いま ${streetPairs(S, p.id)}/2 組`;
    case 'maker': return `いま ${Math.round(p.flags.made)}/400 個`;
    case 'trader': return `いま ${p.deals}/5 回`;
    case 'rare': return `いま ${Math.round(p.flags.rareRev || 0)}/600G`;
  }
  return '';
}

// ── AI(ライバル商会)

// ギルドの投票: 自分の店に得な議題に入れる
export function billScore(S, pid, b) {
  const mine = shopsOf(S, pid), plaza = mine.filter(s => kindOf(s.d) === 'plaza').length, road = mine.filter(s => LOTS[s.lot].road).length, works = mine.filter(s => s.g === 'work' && (s.res === 'wool' || s.res === 'iron')).length;
  const stores = mine.filter(s => s.g !== 'work'), staff = mine.reduce((a, s) => a + s.staff, 0);
  switch (b) {
    case 'plazaRent': return -plaza * 18;
    case 'tariff': return -stores.filter(s => s.g === 'cloth' || s.g === 'tool').length * 8 + works * 15;
    case 'fair': return plaza * 25 - plaza * 7;
    case 'wage': return stores.length * 6 - staff * 4;
    case 'road': return road * 12;
    case 'guildTax': return Math.max(0, mine.reduce((a, s) => a + (s.last ? s.last.profit : 0), 0)) * 0.6;
  }
  return 0;
}
function aiVote(S, pid) { return S.vote.bills.slice().sort((a, b) => billScore(S, pid, b) - billScore(S, pid, a))[0]; }
// ── 強いAI(見えている情報だけで判断する。ズルはしない)
// 出店先の見積もり・予報への先回り・季節の買いだめ・工房・レア素材・攻撃・資金管理
export function fixedCosts(S, pid) { return shopsOf(S, pid).reduce((a, s) => a + crewWage(s) + DISTRICTS[s.d].rent + ADS[s.ads].cost, 0) + (S.players[pid].debt || 0) * LOAN_RATE; }
function seasonAvg(S, g, d) { let a = 0; const t0 = S.t; for (let i = 0; i < 12; i++) { S.t = t0 + i; a += season(S, g, d); } S.t = t0; return a / 12; }
// 新しい店を出したときの、ふだんの月の儲けの見積もり
export function lotValue(S, pid, lotId, g) {
  const lot = LOTS[lotId], d = lot.d, G = GOODS[g], kd = kindOf(d);
  const rivals = S.shops.filter(s => s.d === d && s.g === g && s.owner !== pid);
  const mine = S.shops.filter(s => s.d === d && s.g === g && s.owner === pid).length;
  const n = rivals.length + mine + 1;
  const months = Math.max(1, S.months - S.t - 1);
  const D = (DISTRICTS[d].demand[g] * 1.25 * seasonAvg(S, g, d) + spillOf(S, d, g).add) * (lot.road ? ROAD_BONUS : 1);
  // 相手が強い(評判が高い・安い)ほど取り分が減る
  const rivalAtt = rivals.reduce((a, s) => a + Math.pow(0.35 + s.rep, 1.2) * Math.pow(1 / PRICE_LV[s.priceLv], G.elastic * 1.6), 0);
  const myAtt = Math.pow(0.85, 1.2);
  const share = myAtt / (0.55 + myAtt + rivalAtt) * Math.min(1.25, 0.75 + 0.25 * n);
  const want = D * share;
  const input = S.market[G.res].price * (1 + SPREAD), margin = G.ref - input;
  let best = -1e9, staff = 1;
  for (let k = 1; k <= 5; k++) { const u = Math.min(want, k * G.capPer); const v = u * margin - k * WAGE - DISTRICTS[d].rent; if (v > best) { best = v; staff = k; } }
  const cost = openCost(d, g);
  // 残りの月で元が取れるか(店の価値は半分ほど戻る)
  const total = best * Math.min(months, 36) - cost * 0.45;
  return { profit: best, staff, cost, total, score: total / cost, d, g };
}
function wantCover(S, pid, k) {
  const p = S.players[pid], R = RES[k], m = S.market[k], mo = S.t % 12;
  // 買いだめは手数料(3%)と傷みのぶん損。値上がりが見込めるときだけ
  let cover = 0;
  const pk = m.price / R.base;
  if (pk < 0.8) cover = 3; else if (pk < 0.9) cover = 2;
  // 予報: 生産が減る・欲しがる人が増える → 先に買う。出回る → 待つ
  const e = S.evNext && evDef(S.evNext.id);
  if (e && ((e.prod && e.prod[k] < 1) || (e.need && e.need[k] > 1))) cover += 2;
  if (e && e.prod && e.prod[k] > 1) cover = Math.min(cover, 0.5);
  // 小麦は収穫(8〜10月)の前は高い。収穫の直後に多めに買う
  if (k === 'wheat' && mo >= 8 && mo <= 10 && pk < 1) cover = Math.max(cover, 3);
  if (k === 'wheat' && mo >= 5 && mo <= 7) cover = Math.min(cover, 0.5);
  if (R.decay >= 0.03) cover = Math.min(cover, 2);
  return cover;
}
export function aiSmart(S, pid) {
  const p = S.players[pid], acts = [], mine = shopsOf(S, pid), stores = mine.filter(s => s.g !== 'work');
  let cash = p.cash;
  const reserve = fixedCosts(S, pid) * 0.8 + 80;
  const late = S.t >= S.months - 8;
  const e = S.evNext && evDef(S.evNext.id);
  // 1) 出店: 全部の空き地×業種を見積もり、元が取れる最善の手
  if (mine.length < MAX_SHOPS && !late) {
    let best = null;
    for (const lot of LOTS) {
      if (!lotFree(S, lot.id)) continue;
      for (const g in GOODS) {
        const v = lotValue(S, pid, lot.id, g);
        if (cash - v.cost < reserve) continue;
        const street = NEIGHBORS[lot.id].some(l => { const o = shopAt(S, l); return o && o.owner === pid && o.g !== g; }) ? 0.03 : 0;
        const sc = v.score + street + rnd(S) * 0.02;
        if (v.profit > 25 && (!best || sc > best.sc)) best = { ...v, lot: lot.id, sc };
      }
    }
    // 工房: 原料と加工品の差が大きいなら卸に回る
    if (stores.length >= 2 && !mine.some(s => s.g === 'work')) {
      for (const k in RES) {
        const P = PROC[RES[k].proc], spread = S.market[RES[k].proc].price * (1 - SPREAD) - S.market[k].price * (1 + SPREAD);
        const prof = spread * P.rate * 2 - 2 * WAGE - 35, lot = LOTS.filter(l => lotFree(S, l.id)).sort((a, b) => DISTRICTS[a.d].rent - DISTRICTS[b.d].rent)[0];
        if (!lot) break; const cost = openCost(lot.d, 'work');
        const sc = (prof * Math.min(36, S.months - S.t) - cost * 0.45) / cost;
        if (prof > 60 && cash - cost - P.rate * 2 * S.market[k].price > reserve && (!best || sc > best.sc)) best = { lot: lot.id, g: 'work', res: k, staff: 2, cost, sc };
      }
    }
    if (best && best.sc > 0.4) { acts.push({ type: 'open', lot: best.lot, g: best.g, res: best.res, priceLv: 2, staff: best.staff || 2 }); cash -= best.cost; }
  }
  // 出店のチャンスがあるのにお金が足りないなら貯金を優先(カード・レア・買いだめを控える)
  let saving = false;
  if (mine.length + acts.filter(a => a.type === 'open').length < MAX_SHOPS && !late) {
    for (const lot of LOTS) { if (!lotFree(S, lot.id)) continue; for (const g in GOODS) { const v = lotValue(S, pid, lot.id, g); if (v.profit > 40 && v.score > 1 && cash - v.cost < reserve) { saving = true; break; } } if (saving) break; }
  }
  const comfy = (x) => !saving && cash - x > reserve + 250;
  // 2) 店の調整: 値段・人数・広告を見積もりで決め、予報で客が増えるなら人を足す
  for (const s of mine) {
    const l = s.last; if (!l) continue;
    if (s.g === 'work') { const need = workCap(s) * 1.5 - p.inv[s.res]; if (need > 10 && cash - quote(S, s.res, need) > reserve) { const q = Math.round(need); acts.push({ type: 'buy', res: s.res, qty: q }); cash -= quote(S, s.res, q); } continue; }
    const surge = e ? ((e.dem && e.dem[s.g]) || 1) * ((e.dist && e.dist[kindOf(s.d)]) || 1) : 1;
    let bestS = { pl: s.priceLv, st: s.staff, ad: s.ads, v: -1e9 };
    for (const dp of [-1, 0, 1]) for (const ds of [-1, 0, 1]) for (const da of [-1, 0, 1]) {
      const pl = s.priceLv + dp, st = s.staff + ds, ad = s.ads + da;
      if (pl < 0 || pl > 4 || st < 1 || st > 5 || ad < 0 || ad > 2) continue;
      const est = estimateShop(S, s, { priceLv: pl, staff: st, ads: ad });
      // 値上げは評判を下げ、先々の客を減らす(高級路線は影響が小さい)。品切れも評判を下げる
      // 評判が落ち着いたあとの客の数で考える(値上げ・品切れは評判を下げ、先々の客を減らす)
      const R = routeFx(s), pm = PRICE_LV[pl], ok = est.want > 0 ? Math.min(1, est.cap / est.want) : 1;
      const repT = clamp(0.5 + 0.22 * s.qual + (R.qual - 1) * 0.6 - 0.9 * R.priceRep * (pm - 1) - 0.45 * (1 - ok), 0.05, 0.98);
      const lrK = Math.pow((0.35 + repT) / (0.35 + s.rep), kindOf(s.d) === 'hill' ? 1.7 : 1.2);
      const unitG = est.units > 0 ? (est.revenue - est.cogs) / est.units : 0, fixed = est.labor + est.rent + est.ads;
      const lr = Math.min(est.want * lrK * surge, est.cap) * unitG - fixed;
      const v = 0.35 * est.profit + 0.65 * lr;
      if (v > bestS.v + (dp || ds || da ? 3 : 0)) bestS = { pl, st, ad, v };
    }
    if (bestS.pl !== s.priceLv || bestS.st !== s.staff || bestS.ad !== s.ads) acts.push({ type: 'set', shop: s.id, priceLv: bestS.pl, staff: bestS.st, ads: bestS.ad });
    // 育て方
    if (s.months >= 3 && l.profit > 20) {
      const k = s.route ? s.route.k : (kindOf(s.d) === 'hill' ? 'local' : kindOf(s.d) === 'noble' ? 'lux' : (GOODS[s.g].elastic > 1.2 ? 'mass' : 'lux')), lv = s.route ? s.route.lv + 1 : 1;
      if (lv <= 2 && comfy(ROUTES[k].cost[lv - 1]) && (lv === 1 || s.months >= 10) && S.months - S.t > 10) { acts.push({ type: 'route', shop: s.id, k }); cash -= ROUTES[k].cost[lv - 1]; }
    }
    if (s.hist.length >= 4 && s.hist.slice(-4).every(x => x < -5) && estimateShop(S, s).profit < 0) acts.push({ type: 'close', shop: s.id });
  }
  // 3) 原料: 季節と予報を読んで買いだめ・売り抜け
  for (const k in RES) {
    const use = stores.filter(s => GOODS[s.g].res === k).reduce((a, s) => a + (s.last ? s.last.units : s.staff * GOODS[s.g].capPer * 0.6), 0);
    const have = p.inv[k], m = S.market[k];
    if (use > 0) {
      const target = use * Math.min(saving ? 1 : 3, wantCover(S, pid, k));
      if (target > 0 && have < target * 0.7) { const q = Math.round((target - have) / 10) * 10; if (q > 0 && cash - quote(S, k, q) > reserve) { acts.push({ type: 'buy', res: k, qty: q }); cash -= quote(S, k, q); } }
      else if (have > use * 3 && m.price > RES[k].base * 1.25) acts.push({ type: 'sell', res: k, qty: Math.round((have - use * 1.5) / 10) * 10 });
    } else if (have > 0 && (m.price > RES[k].base * 1.15 || late)) acts.push({ type: 'sell', res: k, qty: Math.floor(have) });
  }
  for (const k in PROC) if (p.inv[k] > 0 && !stores.some(s => RES[GOODS[s.g].res].proc === k) && (S.market[k].price > PROC[k].base * 1.05 || late)) acts.push({ type: 'sell', res: k, qty: Math.floor(p.inv[k]) });
  // 4) レア素材: 出回る時期に買い、使える店に並べ、欲しがる人が増える前後に売る
  for (const k of Object.keys(RARES)) {
    const sh = stores.find(s => s.g === RARES[k].use && (!s.last || s.last.want < s.last.cap * 1.05));
    const pk = S.market[k].price / RARES[k].base, held = p.inv[k] || 0;
    const needUp = e && e.need && e.need[k] > 1;
    if (sh && pk < 0.9 && comfy(quote(S, k, 4)) && held < 8 && !late) { acts.push({ type: 'buy', res: k, qty: 4 }); cash -= quote(S, k, 4); }
    if (sh && held + (pk < 0.9 ? 4 : 0) >= 2) acts.push({ type: 'set', shop: sh.id, feat: k, featQty: Math.min(6, Math.floor(held + (pk < 0.9 ? 4 : 0))) });
    if (held > 0 && (!sh || needUp && pk > 1.3 || late)) acts.push({ type: 'sell', res: k, qty: Math.floor(held) });
  }
  // 5) カード
  const top = stores.slice().sort((a, b) => (b.last ? b.last.profit : 0) - (a.last ? a.last.profit : 0));
  for (const c0 of p.hand) {
    const cd = cardDef(c0), c = cd.base; if (cd.cost > 0 && !comfy(cd.cost)) continue;
    if ((c === 'poach' || c === 'headhunt') && !comfy(cd.cost + 150)) continue;
    if (c === 'loan' || c === 'scout' || c === 'contract') continue;
    if (cd.spec) { const t = stores.find(s => s.g === cd.spec && s.qual < 2 && S.months - S.t > 6); if (t) { acts.push({ type: 'card', card: c0, shop: t.id }); break; } continue; }
    if (c === 'poach') { const tgt = S.shops.filter(t => t.owner !== pid && t.g !== 'work' && t.last && stores.some(m => m.d === t.d && m.g === t.g)).sort((a, b) => b.last.units - a.last.units)[0]; if (tgt) { acts.push({ type: 'card', card: c0, shop: tgt.id }); break; } continue; }
    if (c === 'headhunt') { const tgt = S.shops.filter(t => t.owner !== pid && t.g !== 'work' && t.last && t.last.want > t.last.cap * 0.9).sort((a, b) => b.last.profit - a.last.profit)[0]; if (tgt) { acts.push({ type: 'card', card: c0, shop: tgt.id }); break; } continue; }
    if (c === 'dump') { const r = Object.keys(RES).find(k => S.market[k].price > RES[k].base * 1.3 && stores.some(s => GOODS[s.g].res === k)); if (r) { acts.push({ type: 'card', card: c0, res: r }); break; } continue; }
    if (c === 'helper') { const t = stores.find(s => s.last && s.last.want > s.last.cap * 1.1); if (t) { acts.push({ type: 'card', card: c0, shop: t.id }); break; } continue; }
    if (c === 'shout') { const t = stores.find(s => s.last && s.last.cap > s.last.want * 1.35 && (s.last.revenue - s.last.cogs) / Math.max(1, s.last.units) * s.last.want * 0.25 > cd.cost); if (t) { acts.push({ type: 'card', card: c0, shop: t.id }); break; } continue; }
    if (c === 'sale') { const t = stores.find(s => s.last && s.rep < 0.45 && s.last.cap > s.last.want * 1.4); if (t) { acts.push({ type: 'card', card: c0, shop: t.id }); break; } continue; }
    if (c === 'remodel') { const t = stores.find(s => s.rep < 0.55); if (t) { acts.push({ type: 'card', card: c0, shop: t.id }); break; } continue; }
  }
  // 6) 商人の申し出: 損得を計算して受ける
  for (const o of p.offers) {
    const m = S.market[o.item].price;
    if (o.kind === 'buy' && o.price > m * 1.08 && p.inv[o.item] >= o.qty && !(RARES[o.item] && stores.some(s => s.g === RARES[o.item].use) && o.rival != null)) acts.push({ type: 'deal', id: o.id });
    if (o.kind === 'sell' && o.price < m * 0.85 && cash - o.qty * o.price > reserve && (stores.some(s => GOODS[s.g].res === o.item || (RARES[o.item] && RARES[o.item].use === s.g)) || mine.some(s => s.res === o.item))) { acts.push({ type: 'deal', id: o.id }); cash -= o.qty * o.price; }
  }
  if (p.debt > 0 && cash - reserve > 100) acts.push({ type: 'repay', amt: Math.min(p.debt, cash - reserve) });
  return acts;
}

export const SMART_ON = { surge: 1, stock: 0, rare: 0, attack: 0, work: 0, look: 1 };
// 先読み: 候補の手を打ったあと H か月、全員がふだんどおり動いたら自分の純資産がどうなるかを試算する
function rollout(S, pid, acts, H, runW = 0.5) {
  const T = JSON.parse(JSON.stringify(S)); T.look = 1;
  for (const q of T.players) q.smart = false;   // 試算の中ではみんな基本の判断で動く(計算を軽くする)
  const nw0 = netWorth(T, T.players[pid]);
  step(T, { [pid]: acts });
  for (let i = 1; i < H && !T.over; i++) step(T, {});
  // 店の価値は「この先も稼ぐ力」として、直近の利益から見積もる
  const p = T.players[pid], left = Math.max(0, S.months - T.t);
  const run = shopsOf(T, pid).reduce((a, s) => a + (s.hist.length ? s.hist.slice(-3).reduce((x, y) => x + y, 0) / Math.min(3, s.hist.length) : 0), 0);
  return netWorth(T, p) + Math.max(0, run) * Math.min(left, 12) * runW - nw0;
}
// 強いAI: 実績のある基本の判断に、読みの強化を重ねる
function aiStrong(S, pid) {
  const p = S.players[pid]; p.smart = false; let acts; try { acts = aiDecide(S, pid); } finally { p.smart = true; }
  const mine = shopsOf(S, pid), stores = mine.filter(s => s.g !== 'work'), e = S.evNext && evDef(S.evNext.id);
  let cash = p.cash - acts.reduce((a, x) => a + (x.type === 'open' ? openCost(LOTS[x.lot].d, x.g) : x.type === 'buy' ? quote(S, x.res, x.qty) : 0), 0);
  const reserve = fixedCosts(S, pid) + 150, late = S.t >= S.months - 8;
  // 0) 先読み: 出店するか・どこに何を出すかを、上位の候補ごとに試算して選ぶ
  if (SMART_ON.look && !S.look && mine.length < MAX_SHOPS && S.t < S.months - 6) {
    const base = acts.filter(a => a.type !== 'open');
    const cands = [{ acts: base, label: 'none' }];
    const opts = [];
    for (const lot of LOTS) { if (!lotFree(S, lot.id)) continue; for (const g in GOODS) { const v = lotValue(S, pid, lot.id, g); if (p.cash - v.cost > fixedCosts(S, pid) * 0.5 + 60) opts.push({ lot: lot.id, g, sc: v.score + rnd(S) * 0.01, staff: v.staff }); } }
    opts.sort((a, b) => b.sc - a.sc);
    const seen = new Set();
    const P = aipOf(p);
    for (const o of opts) { const key = LOTS[o.lot].d + o.g; if (seen.has(key)) continue; seen.add(key); cands.push({ acts: base.concat([{ type: 'open', lot: o.lot, g: o.g, priceLv: 2, staff: Math.max(1, Math.min(3, o.staff)) }]), label: key }); if (cands.length >= P.nc) break; }
    const old = acts.find(a => a.type === 'open'); if (old && !cands.some(c => c.acts.some(a => a.type === 'open' && a.lot === old.lot && a.g === old.g))) cands.push({ acts, label: 'old' });
    if (cands.length > 1) {
      let best = null; for (const c of cands) { const v = P.lookRel ? rollout2(S, pid, c.acts, P.H, P) : rollout(S, pid, c.acts, P.H, P.run); if (!best || v > best.v) best = { ...c, v }; }
      acts = best.acts;
    }
  }
  // 町の依頼: 自分の工房で作れる品なら受けて、納める
  for (const q of (S.quests || [])) {
    if (q.taker == null && !q.done && !(S.quests || []).some(x => x.taker === pid && !x.done) && mine.some(s => s.g === 'work' && RES[s.res].proc === q.item)) { acts.push({ type: 'quest', id: q.id }); break; }
    if (q.taker === pid && !q.done && p.inv[q.item] >= 1) acts.push({ type: 'deliver', id: q.id, qty: Math.floor(Math.min(p.inv[q.item], q.qty - q.got)) });
  }
  // ギルドの投票
  if (S.vote && S.vote.t === S.t && S.vote.ballots[pid] == null) acts.push({ type: 'vote', bill: aiVote(S, pid) });
  // 求職者: 割のいい人がいれば、人手の要る店に雇う
  for (const c of (p.cands || [])) { const T = TRAITS[c.trait]; const val = T.cap * 30 / c.wage + ((T.att || 1) - 1) * 8; if (val < 1.12) continue; const sh = stores.find(x => x.last && x.last.want > x.last.cap * 0.95 && x.staff < 5); if (sh && cash > reserve + c.wage * 3) { acts.push({ type: 'hire', shop: sh.id, cand: c.id }); break; } }
  // 1) 予報で客が増える・減る → 先に店員を合わせる
  if (SMART_ON.surge && e) for (const s of stores) {
    const k = ((e.dem && e.dem[s.g]) || 1) * ((e.dist && e.dist[kindOf(s.d)]) || 1); if (Math.abs(k - 1) < 0.15 || !s.last) continue;
    const cur = acts.find(a => a.type === 'set' && a.shop === s.id) || { type: 'set', shop: s.id, priceLv: s.priceLv, staff: s.staff, ads: s.ads };
    const need = Math.ceil(Math.min(s.last.want * k, s.last.want * 2) / (GOODS[s.g].capPer * routeFx(s).cap));
    const st = clamp(need, 1, 5); if (st !== cur.staff) { cur.staff = st; if (!acts.includes(cur)) acts.push(cur); }
  }
  // 2) 材料: 品薄の予報・収穫直後の安値で買いだめ(使う分だけ)
  if (SMART_ON.stock) for (const k in RES) {
    const use = stores.filter(s => GOODS[s.g].res === k).reduce((a, s) => a + (s.last ? s.last.units : 0), 0); if (use < 10) continue;
    const pk = S.market[k].price / RES[k].base, mo = S.t % 12;
    const short = e && ((e.prod && e.prod[k] < 1) || (e.need && e.need[k] > 1));
    const cover = short ? 2.5 : (k === 'wheat' && mo >= 8 && mo <= 10 && pk < 0.95) ? 3 : pk < 0.82 ? 2 : 0;
    const have = p.inv[k] + acts.filter(a => a.type === 'buy' && a.res === k).reduce((a, x) => a + x.qty, 0);
    const q = Math.round((use * cover - have) / 10) * 10;
    if (cover && q > 0 && cash - quote(S, k, q) > reserve) { acts.push({ type: 'buy', res: k, qty: q }); cash -= quote(S, k, q); }
  }
  // 3) レア素材: 出回る時期に安く買って並べ、欲しがる人が増える月に売る
  if (SMART_ON.rare) {
    for (let i = acts.length - 1; i >= 0; i--) { const a = acts[i]; if ((a.type === 'buy' || a.type === 'sell') && RARES[a.res]) acts.splice(i, 1); }
    for (const k of Object.keys(RARES)) {
      const sh = stores.find(s => s.g === RARES[k].use && s.last && s.last.want < s.last.cap), pk = S.market[k].price / RARES[k].base, held = p.inv[k] || 0;
      const up = e && e.need && e.need[k] > 1;
      if (sh && pk < 0.85 && held < 6 && !late && cash - quote(S, k, 4) > reserve + 200) { acts.push({ type: 'buy', res: k, qty: 4 }); cash -= quote(S, k, 4); }
      if (held > 0 && (up || pk > 1.4 || late || !sh)) acts.push({ type: 'sell', res: k, qty: Math.floor(held) });
    }
  }
  // 4) 攻撃カード: 同じ地区・同じ業種で一番客を取っている相手を狙う
  if (SMART_ON.attack) { const ci = acts.findIndex(a => a.type === 'card'); const poach = p.hand.find(c => cardDef(c).base === 'poach');
    if (poach && cash > reserve + 100) { const tgt = S.shops.filter(t => t.owner !== pid && t.g !== 'work' && t.last && stores.some(m => m.d === t.d && m.g === t.g)).sort((a, b) => b.last.units - a.last.units)[0]; if (tgt) { if (ci >= 0) acts.splice(ci, 1); acts.push({ type: 'card', card: poach, shop: tgt.id }); } } }
  // 5) 工房: 原料と加工品の差が大きく、店が3つ以上あるなら卸に回る
  if (SMART_ON.work && stores.length >= 3 && mine.length < MAX_SHOPS && !mine.some(s => s.g === 'work') && !acts.some(a => a.type === 'open') && !late) {
    const best = Object.keys(RES).map(k => ({ k, m: S.market[RES[k].proc].price * (1 - SPREAD) - S.market[k].price * (1 + SPREAD), r: PROC[RES[k].proc].rate })).map(x => ({ ...x, prof: x.m * x.r * 2 - 2 * WAGE - 35 })).sort((a, b) => b.prof - a.prof)[0];
    const lot = LOTS.filter(l => lotFree(S, l.id)).sort((a, b) => DISTRICTS[a.d].rent - DISTRICTS[b.d].rent)[0];
    if (best && best.prof > 70 && lot && cash - openCost(lot.d, 'work') - best.r * 2 * S.market[best.k].price > reserve) acts.push({ type: 'open', lot: lot.id, g: 'work', res: best.k, staff: 2 });
  }
  return acts;
}
// 試算の値: 自分の伸び −(rel × いちばん伸びたライバル)。seeds 回ぶん乱数を変えて平均し、偶然に左右されにくくする
function rollout2(S, pid, acts, H, P) {
  let sum = 0;
  for (let k = 0; k < (P.seeds || 1); k++) {
    const T = JSON.parse(JSON.stringify(S)); T.look = 1; if (k) T.rs = (T.rs * 1103515245 + 12345 * k) >>> 0 || 1;
    for (const q of T.players) q.smart = false;
    const nw0 = T.players.map(q => netWorth(T, q));
    step(T, { [pid]: acts });
    for (let i = 1; i < H && !T.over; i++) step(T, {});
    const left = Math.max(0, S.months - T.t);
    const val = (q) => netWorth(T, q) - nw0[q.id] + Math.max(0, shopsOf(T, q.id).reduce((a, s) => a + (s.hist.length ? s.hist.slice(-3).reduce((x, y) => x + y, 0) / Math.min(3, s.hist.length) : 0), 0)) * Math.min(left, 12) * (P.run ?? 0.5);
    const me = val(T.players[pid]), riv = Math.max(...T.players.filter(q => q.id !== pid).map(val));
    sum += me - (P.rel || 0) * riv;
  }
  return sum / (P.seeds || 1);
}
// 深読みAI: 強いAIの手を土台に、手を1つずつ変えた案を試算して、良くなるものだけ採用する
function aiDeep(S, pid) {
  const p = S.players[pid], P = aipOf(p);
  let acts = aiStrong(S, pid);
  if (S.look) return acts;
  const stores = shopsOf(S, pid).filter(s => s.g !== 'work' && s.last);
  const H = P.Hm || 6, nm = P.nm || 10;
  let bestV = rollout2(S, pid, acts, H, P);
  for (let pass = 0; pass < (P.iter || 1); pass++) {
    const muts = deepMuts(S, pid, p, P, acts, stores);
    let imp = null;
    for (const m of muts.slice(0, nm)) { const v = rollout2(S, pid, m, H, P); if (v > bestV + (P.margin ?? 5)) { bestV = v; imp = m; } }
    if (!imp) break; acts = imp;
  }
  return acts;
}
function deepMuts(S, pid, p, P, acts, stores) {
  const muts = [];
  const setOf = (A, s) => A.find(a => a.type === 'set' && a.shop === s.id);
  const withSet = (A, s, patch) => { const cur = setOf(A, s) || { type: 'set', shop: s.id, priceLv: s.priceLv, staff: s.staff, ads: s.ads }; const nx = { ...cur, ...patch }; return A.filter(a => a !== cur).concat([nx]); };
  // 稼ぎの大きい店から順に、値段・人手・宣伝を1段ずつ動かす案
  const top = stores.slice().sort((a, b) => b.last.revenue - a.last.revenue).slice(0, P.ns || 3);
  for (const s of top) {
    const cur = setOf(acts, s) || s;
    for (const d of [-1, 1]) {
      if (cur.priceLv + d >= 0 && cur.priceLv + d <= 4) muts.push(withSet(acts, s, { priceLv: cur.priceLv + d }));
      if (cur.staff + d >= 1 && cur.staff + d <= 5) muts.push(withSet(acts, s, { staff: cur.staff + d }));
    }
    if (cur.ads < 2) muts.push(withSet(acts, s, { ads: cur.ads + 1 })); else muts.push(withSet(acts, s, { ads: cur.ads - 1 }));
  }
  // 手を引く案: カード・育て方・出店・売買をやめる
  for (const t of ['card', 'route', 'open', 'buy', 'sell', 'hire']) if (acts.some(a => a.type === t)) muts.push(acts.filter(a => a.type !== t));
  // 別のカードを使う案
  const cAct = acts.find(a => a.type === 'card'), best = stores.slice().sort((a, b) => b.last.profit - a.last.profit)[0];
  for (const c0 of p.hand) {
    if (cAct && cAct.card === c0) continue; const cd = cardDef(c0); if (p.cash < cd.cost + 150) continue;
    let a = null;
    if (cd.spec) { const t = stores.find(s => s.g === cd.spec && s.qual < 2); if (t) a = { type: 'card', card: c0, shop: t.id }; }
    else if (cd.base === 'poach' || cd.base === 'headhunt') { const tgt = S.shops.filter(t => t.owner !== pid && t.last && t.g !== 'work').sort((x, y) => y.last.units - x.last.units)[0]; if (tgt) a = { type: 'card', card: c0, shop: tgt.id }; }
    else if (cd.base === 'contract' || cd.base === 'dump') { if (best) a = { type: 'card', card: c0, res: GOODS[best.g].res }; }
    else if (cd.base === 'scout') a = { type: 'card', card: c0 };
    else if (best) a = { type: 'card', card: c0, shop: best.id };
    if (a) muts.push(acts.filter(x => x.type !== 'card').concat([a]));
  }
  // 赤字続きの店をたたむ案
  const worst = stores.filter(s => s.hist.length >= 3 && s.hist.slice(-3).reduce((a, x) => a + x, 0) < 0).sort((a, b) => a.last.profit - b.last.profit)[0];
  if (worst && !acts.some(a => a.type === 'close' && a.shop === worst.id)) muts.push(acts.concat([{ type: 'close', shop: worst.id }]));
  if (P.mx) {
    const cash = p.cash - 150, mine = shopsOf(S, pid);
    // 育て方: まだ決めていない店に、3つの路線それぞれを試す
    if (!acts.some(a => a.type === 'route')) for (const s of stores.filter(x => x.months >= 3 && !x.route).slice(0, 2)) for (const k of Object.keys(ROUTES)) if (cash > ROUTES[k].cost[0] + 200) muts.push(acts.concat([{ type: 'route', shop: s.id, k }]));
    // レア素材: 安いときに仕入れて目玉に
    for (const k of Object.keys(RARES)) { const sh = stores.find(x => x.g === RARES[k].use); if (sh && S.market[k].price < RARES[k].base * 0.95 && !(p.inv[k] > 2) && cash > quote(S, k, 4) + 300) muts.push(acts.concat([{ type: 'buy', res: k, qty: 4 }, { type: 'set', shop: sh.id, feat: k, featQty: 4 }])); }
    // ライバル(AI)の店を買い取る: 相手が売ってくれる値段で
    if (mine.length < MAX_SHOPS && !acts.some(a => a.type === 'open')) {
      const tg = S.shops.filter(t => t.owner !== pid && S.players[t.owner].ai && t.g !== 'work' && t.hist.length >= 3).map(t => { const sel = S.players[t.owner], v = shopValue(S, t), losing = t.hist.slice(-2).every(x => x < 0), poor = sel.cash < 150; return { t, price: Math.ceil(v * (poor ? 1.0 : losing ? 1.1 : 1.6)) + 1, avg: t.hist.slice(-3).reduce((a, b) => a + b, 0) / 3 }; }).filter(x => x.price < cash - 200 && x.avg > 0).sort((a, b) => b.avg / b.price - a.avg / a.price).slice(0, 2);
      for (const x of tg) muts.push(acts.concat([{ type: 'buyshop', shop: x.t.id, price: x.price }]));
    }
  }
  return muts;
}
// AI の判断のくせ(自己対戦で学習して決める)。buf=出店時に残す現金, thr=出店の基準, pw=値付けのくせの強さ, ropen=育て方に残す現金, H=何か月先まで読むか, nc=試算する候補数, run=店の稼ぐ力の重み
export const AIP_BASE = { buf: 250, thr: 0.02, pw: 6, ropen: 300, H: 8, nc: 6, run: 0.5 };
export const AIP_LEARNED = { ...AIP_BASE, H: 12, nc: 9 };   // つよい: 12か月先まで、9通りの出店案を試算する
// 鬼: さらに毎月の手を一つずつ変えて試算し、ライバルとの差が一番開く手を選ぶ(自己対戦で「つよい」相手に平均順位1.9・勝率46%)
// さらに「育て方の選び方・レア素材の仕入れ・ライバルの店の買収」も試算に入れる(深読みAI同士で平均順位2.04・勝率42%)
export const AIP_DEEP = { ...AIP_LEARNED, deep: 1, rel: 1, mx: 1, nm: 16 };
export const AIP_MAOU = { ...AIP_DEEP, Hm: 4, nm: 24, ns: 5 };   // 魔王: 候補を広げて短く読む(鬼AI相手に平均順位2.19・勝率34%)
const AIP_OF_LEVEL = { hard: AIP_LEARNED, oni: AIP_DEEP, maou: AIP_MAOU };
const aipOf = (p) => p.aip || AIP_BASE;
export function aiDecide(S, pid) {
  if (S.players[pid].smart) return aipOf(S.players[pid]).deep && !S.look ? aiDeep(S, pid) : aiStrong(S, pid);
  const p = S.players[pid], K = AI_KIND[p.ai] || AI_KIND.balanced, acts = [], P = aipOf(p);
  const mine = shopsOf(S, pid);
  let cash = p.cash;
  if (mine.length < MAX_SHOPS && S.t < S.months - 8) {
    let best = null;
    for (const lot of LOTS) {
      if (!lotFree(S, lot.id)) continue;
      for (const g in GOODS) {
        const cost = openCost(lot.d, g); if (cash < cost + ((STAGES[S.stage] || {}).aiHard ? P.buf * 0.6 : P.buf) + 300 * (1 - K.risk)) continue;
        const comp = S.shops.filter(s => s.d === lot.d && s.g === g).length;
        const dem = (DISTRICTS[lot.d].demand[g] * 1.25 + spillOf(S, lot.d, g).add) * GOODS[g].ref * 0.36 / (1 + comp * 1.1);
        const fav = (p.fav === g ? 0.06 : 0) + (p.favD === lot.d ? 0.04 : 0);
        const street = NEIGHBORS[lot.id].some(l => { const o = shopAt(S, l); return o && o.owner === pid && o.g !== g; }) ? 0.04 : 0;
        // 材料が値上がりしていたら、その業種は見送りやすい
        const rk = S.market[GOODS[g].res].price / RES[GOODS[g].res].base;
        const score = (dem - DISTRICTS[lot.d].rent - 2 * WAGE) / cost * (p.boldness || 1) + fav + street - Math.max(0, rk - 1) * 0.12 + rnd(S) * 0.1;
        if (!best || score > best.score) best = { lot: lot.id, g, score, cost };
      }
    }
    if (best && best.score > P.thr) { acts.push({ type: 'open', lot: best.lot, g: best.g, priceLv: K.price, staff: 2 }); cash -= best.cost; }
  }
  for (const s of mine) {
    const l = s.last; if (!l) continue;
    if (s.g === 'work') { if (p.inv[s.res] < workCap(s) * 0.5 && cash > 300) { const q = Math.round(workCap(s)); acts.push({ type: 'buy', res: s.res, qty: q }); cash -= q * S.market[s.res].price; } continue; }
    let best = { pl: s.priceLv, st: s.staff, ad: s.ads, v: estimateShop(S, s).profit };
    for (const dp of [-1, 0, 1]) for (const ds of [-1, 0, 1]) for (const da of [-1, 0, 1]) {
      const pl = s.priceLv + dp, st = s.staff + ds, ad = s.ads + da;
      if (pl < 0 || pl > 4 || st < 1 || st > 5 || ad < 0 || ad > 2) continue;
      const e = estimateShop(S, s, { priceLv: pl, staff: st, ads: ad });
      const v = e.profit - Math.abs(pl - K.price) * P.pw - (pl > 3 && !(s.route && s.route.k === 'lux') ? 8 : 0);
      if (v > best.v + 4) best = { pl, st, ad, v };
    }
    if (best.pl !== s.priceLv || best.st !== s.staff || best.ad !== s.ads) acts.push({ type: 'set', shop: s.id, priceLv: best.pl, staff: best.st, ads: best.ad });
    if (s.hist.length >= 4 && s.hist.slice(-4).every(x => x < -5)) acts.push({ type: 'close', shop: s.id });
    // 育て方: 黒字の店から
    if (s.months >= 3 && l.profit > 30) {
      const k = s.route ? s.route.k : (kindOf(s.d) === 'hill' ? 'local' : kindOf(s.d) === 'noble' ? 'lux' : K.route), lv = s.route ? s.route.lv + 1 : 1;
      if (lv <= 2 && cash > ROUTES[k].cost[lv - 1] + P.ropen && (lv === 1 || s.months >= 12)) { acts.push({ type: 'route', shop: s.id, k }); cash -= ROUTES[k].cost[lv - 1]; }
    }
  }
  for (const k in RES) {
    const m = S.market[k], r = RES[k];
    const uses = mine.some(s => (GOODS[s.g] && GOODS[s.g].res === k) || s.res === k);
    if ((uses || p.ai === 'hoarder') && m.price < r.base * (p.ai === 'hoarder' ? 0.95 : 0.85) && cash > 400) {
      const q = Math.min(p.ai === 'hoarder' ? 120 : 50, Math.floor((cash - 300) / m.price / 2));
      if (q > 5) { acts.push({ type: 'buy', res: k, qty: q }); cash -= q * m.price; }
    }
    if (p.inv[k] > 0 && m.price > r.base * 1.3) acts.push({ type: 'sell', res: k, qty: Math.floor(p.inv[k] * 0.6) });
  }
  // カード(攻撃もする)
  const best = mine.filter(s => s.g !== 'work').sort((a, b) => (b.last ? b.last.profit : 0) - (a.last ? a.last.profit : 0))[0];
  for (const c0 of p.hand) {
    const cd = cardDef(c0), c = cd.base; if (cash < cd.cost + 150) continue;
    if (cd.need === 'shop' && !best) continue;
    if (cd.spec) { const t = mine.find(s => s.g === cd.spec && s.qual < 2); if (!t) continue; acts.push({ type: 'card', card: c0, shop: t.id }); break; }
    if (c === 'loan' && (p.debt > 0 || cash > 400 || !mine.some(x => x.last && x.last.profit > 40))) continue;
    if (c === 'scout') continue;
    if (c === 'contract') { const r = best ? GOODS[best.g].res : null; if (!r || S.market[r].price > RES[r].base * 0.95) continue; acts.push({ type: 'card', card: c0, res: r }); break; }
    if (c === 'dump') { const r = Object.keys(RES).find(k => S.market[k].price > RES[k].base * 1.25 && mine.some(s => GOODS[s.g] && GOODS[s.g].res === k)); if (!r) continue; acts.push({ type: 'card', card: c0, res: r }); break; }
    if (c === 'poach' || c === 'headhunt') {
      // 同じ地区・業種で一番お客を集めているライバルを狙う
      const tgt = S.shops.filter(t => t.owner !== pid && t.last && t.g !== 'work' && (c === 'headhunt' || mine.some(m => m.d === t.d && m.g === t.g))).sort((a, b) => b.last.units - a.last.units)[0];
      if (!tgt) continue; acts.push({ type: 'card', card: c0, shop: tgt.id }); break;
    }
    if (c === 'helper' && best && best.last && best.last.want < best.last.cap) continue;
    acts.push({ type: 'card', card: c0, shop: best ? best.id : null }); break;
  }
  // レア素材: 安いときに買って目玉商品にする
  for (const k of Object.keys(RARES)) {
    const sh = mine.find(s => s.g === RARES[k].use);
    if (sh && S.market[k].price < RARES[k].base * 0.85 && cash > 600 && (p.inv[k] || 0) < 6) { const q = 4; acts.push({ type: 'buy', res: k, qty: q }); cash -= q * S.market[k].price * 1.1; }
    if (sh && (p.inv[k] || 0) >= 2 && sh.feat !== k) acts.push({ type: 'set', shop: sh.id, feat: k, featQty: Math.min(6, Math.floor(p.inv[k])) });
    if ((p.inv[k] || 0) > 0 && !sh && S.market[k].price > RARES[k].base * 1.3) acts.push({ type: 'sell', res: k, qty: Math.floor(p.inv[k]) });
  }
  // 商人の申し出: 高く買ってくれるなら売る・安く売ってくれて自分が使うなら買う
  for (const o of p.offers) {
    if (o.kind === 'buy' && o.k > 1.15 && p.inv[o.item] >= o.qty) acts.push({ type: 'deal', id: o.id });
    if (o.kind === 'sell' && o.k < 0.8 && cash > o.qty * o.price + 300 && (mine.some(s => GOODS[s.g] && (GOODS[s.g].res === o.item || RES[GOODS[s.g].res].proc === o.item)) || p.ai === 'hoarder')) { acts.push({ type: 'deal', id: o.id }); cash -= o.qty * o.price; }
  }
  // 買い占め屋は、店が3つ以上になったら工房も持つ
  if (p.ai === 'hoarder' && mine.length >= 3 && mine.length < MAX_SHOPS && !mine.some(s => s.g === 'work') && cash > 900) {
    const lot = LOTS.find(l => lotFree(S, l.id) && kindOf(l.d) === 'hill') || LOTS.find(l => lotFree(S, l.id));
    const raw = Object.keys(RES).sort((a, b) => (S.market[RES[b].proc].price / S.market[b].price) - (S.market[RES[a].proc].price / S.market[a].price))[0];
    if (lot && !acts.some(a => a.type === 'open')) acts.push({ type: 'open', lot: lot.id, g: 'work', res: raw, staff: 2 });
  }
  if (p.debt > 0 && cash > 700) acts.push({ type: 'repay', amt: Math.min(p.debt, cash - 600) });
  return acts;
}
// 店の損益をざっくり見積もる(画面の「🔮」用)
export function estimateShop(S, s, patch = {}) {
  const l = s.last; if (!l) return null;
  if (s.g === 'work') { const st1 = patch.staff ?? s.staff; const cap = st1 * PROC[RES[s.res].proc].rate; const p = S.players[s.owner]; const units = Math.min(cap, p.inv[s.res] || 0); const pk = RES[s.res].proc; const raw = S.market[s.res].price; const labor = st1 * WAGE, rent = DISTRICTS[s.d].rent; return { units, want: units, cap, revenue: units * S.market[pk].price * (1 - SPREAD), cogs: units * raw, labor, rent, ads: 0, profit: units * (S.market[pk].price * (1 - SPREAD) - raw) - labor - rent, margin: S.market[pk].price * (1 - SPREAD) - raw }; }
  const G = GOODS[s.g], R = routeFx(s);
  const pm0 = PRICE_LV[s.priceLv], pm1 = PRICE_LV[patch.priceLv ?? s.priceLv];
  const st1 = patch.staff ?? s.staff, ad1 = patch.ads ?? s.ads;
  const want = l.want * Math.pow(pm0 / pm1, G.elastic * 1.6 * R.elastic * 0.7 * (kindOf(s.d) === 'noble' ? 0.55 : 1)) * ADS[ad1].k / ADS[s.ads].k;
  const per = s.crew && s.crew.length ? crewCapK(s) / s.crew.length : 1, wper = s.crew && s.crew.length ? crewWage(s) / s.crew.length : WAGE;
  const cap = (st1 === s.staff ? crewCapK(s) : st1 * (st1 > s.staff ? (per + (st1 - s.staff) * 0) : per)) * G.capPer * R.cap * (s.helper > 0 ? 1.3 : 1) * (s.under > 0 ? 0.7 : 1);
  const units = Math.min(want, cap);
  const unitCost = l.units > 0 ? l.cogs / l.units : RES[G.res].base;
  const revenue = units * G.ref * pm1, cogs = units * unitCost, labor = st1 === s.staff ? crewWage(s) : crewWage(s) + (st1 - s.staff) * (st1 > s.staff ? WAGE : wper), rent = DISTRICTS[s.d].rent * R.rent, ads = ADS[ad1].cost;
  return { units, want, cap, revenue, cogs, labor, rent, ads, profit: revenue - cogs - labor - rent - ads };
}
