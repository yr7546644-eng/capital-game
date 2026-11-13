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
  starsilver: { name: '星銀鉱', icon: '✨', base: 48, vol: 0.12, impact: 0.035, decay: 0, use: 'tool', rare: 1, where: '雪解けのころ鉱山で出る。騎士の大会で値上がり' },
  dragonscale: { name: '竜のうろこ', icon: '🐉', base: 60, vol: 0.12, impact: 0.04, decay: 0, use: 'cloth', rare: 1, where: '冒険者が竜を討伐すると出回る' },
  moonherb: { name: '月光草', icon: '🌙', base: 32, vol: 0.14, impact: 0.035, decay: 0.15, use: 'potion', rare: 1, where: '満月の夜に森でとれる。すぐ傷む。はやり風邪で値上がり' },
  seapearl: { name: '海の真珠', icon: '🦪', base: 70, vol: 0.12, impact: 0.04, decay: 0, use: 'cloth', rare: 1, where: '嵐のあとの浜で見つかる。貴族街で特に高く売れる' },
  goldwheat: { name: '黄金麦', icon: '🌟', base: 22, vol: 0.12, impact: 0.03, decay: 0.05, use: 'bread', rare: 1, where: '豊作の秋にだけ少しとれる' },
};
export const isRare = (k) => !!RARES[k];
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
  { id: 'harvest_bad', name: '小麦の不作', icon: '🌧️', text: '北の畑が長雨にやられた。小麦が高くなりそう', res: { wheat: 1.55 }, len: 3 },
  { id: 'harvest_good', name: '小麦の大豊作', icon: '🌾', text: '今年は豊作。小麦が安くなりそう', res: { wheat: 0.7 }, len: 3 },
  { id: 'plague', name: 'はやり風邪', icon: '🤧', text: '町で風邪がはやりはじめた。薬が売れ、月光草が値上がり', dem: { potion: 1.8 }, res: { moonherb: 1.6 }, len: 2 },
  { id: 'festival', name: '収穫祭', icon: '🎪', text: '中央広場で収穫祭。広場に人がどっと来る(1.8倍)', dist: { plaza: 1.8 }, len: 1, w: 2 },
  { id: 'adventurer', name: '冒険者ブーム', icon: '🗡️', text: '迷宮が見つかり、冒険者が集まってきた。道具が売れそう', dem: { tool: 1.6, potion: 1.25 }, len: 3 },
  { id: 'mine', name: '鉱山の落盤', icon: '⛏️', text: '鉄の鉱山で落盤。鉄が高くなりそう', res: { iron: 1.6 }, len: 3 },
  { id: 'ship', name: '商船の到着', icon: '⛵', text: '大きな商船が港に入る。港が大にぎわい(1.6倍)、羊毛が安くなる', dist: { port: 1.6 }, res: { wool: 0.75 }, len: 1, w: 1.5 },
  { id: 'cold', name: '寒波', icon: '❄️', text: '寒い冬が来る。服がよく売れそう', dem: { cloth: 1.6 }, len: 2 },
  { id: 'herb_bad', name: '薬草の不作', icon: '🥀', text: '森の薬草が枯れた。薬草が高くなりそう', res: { herb: 1.6 }, len: 2 },
  { id: 'tax', name: '臨時の税', icon: '📜', text: '領主が臨時の税をかける。現金を多く持つ人ほど払う', tax: 0.04, len: 1 },
  { id: 'vein', name: '新しい鉱脈', icon: '💎', text: '鉱山で新しい鉱脈が見つかった。鉱夫が押し寄せ、鉱山口の客が1.7倍', dist: { mine: 1.7 }, res: { iron: 0.8 }, len: 3, only: 'snow' },
  { id: 'cavein', name: '坑道の崩落', icon: '🪨', text: '坑道が崩れて鉱夫が減る。鉱山口の客が半分に', dist: { mine: 0.5 }, len: 2, only: 'snow' },
  { id: 'storm', name: '嵐の季節', icon: '⛈️', text: '海が荒れて船が来ない。港の客が減る', dist: { port: 0.6 }, len: 2 },
  { id: 'order', name: '王都の大口注文', icon: '⚔️', text: '王都の軍が鋼を大量に注文。鋼の相場が上がる', res: { steel: 1.5, iron: 1.15 }, len: 3 },
  { id: 'fashion', name: '毛織物の流行', icon: '🧣', text: '貴族の間で毛織物がはやる。毛織物の相場が上がる', res: { fabric: 1.45 }, dem: { cloth: 1.2 }, len: 3 },
  { id: 'millfire', name: '粉ひき小屋の火事', icon: '🔥', text: '町の粉ひき小屋が焼けた。小麦粉が足りなくなる', res: { flour: 1.5 }, len: 2 },
  { id: 'snowmelt', name: '早い雪解け', icon: '🏔️', text: '雪解けで山肌が出た。星銀鉱が出回る(安く買える)', res: { starsilver: 0.55 }, supply: 'starsilver', len: 2 },
  { id: 'tourney', name: '騎士の大会', icon: '🏆', text: '王都で騎士の大会。星銀鉱が値上がりし、道具がよく売れる', res: { starsilver: 1.8 }, dem: { tool: 1.25 }, len: 2 },
  { id: 'dragonhunt', name: '竜の討伐', icon: '🐉', text: '冒険者が竜を討った。竜のうろこが出回る', res: { dragonscale: 0.55 }, supply: 'dragonscale', len: 2 },
  { id: 'fullmoon', name: '満月の夜', icon: '🌕', text: '満月で森に月光草が咲く。すぐ傷むので早めに使うか売る', res: { moonherb: 0.5 }, supply: 'moonherb', len: 1 },
  { id: 'pearlbeach', name: '嵐のあとの浜', icon: '🦪', text: '浜に真珠貝が打ち上げられた。海の真珠が出回る', res: { seapearl: 0.55 }, supply: 'seapearl', len: 1 },
  { id: 'goldharvest', name: '黄金の実り', icon: '🌟', text: '黄金麦がわずかに実った。パンの目玉にできる', res: { goldwheat: 0.6 }, supply: 'goldwheat', len: 2 },
  { id: 'substitute', name: '代わりの素材の入荷', icon: '🚢', text: '商船が南の国の代わりの素材を運んできた。レア素材がまとめて値下がり', res: { starsilver: 0.65, dragonscale: 0.65, seapearl: 0.65 }, len: 2 },
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
    water: 'marina', theme: 'green', res: { wool: 1.4, herb: 2.6 }, ev: { ship: 4, storm: 2.5, festival: 0.6, pearlbeach: 2.5, snowmelt: 0.3 },
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
    water: 'snow', theme: 'snow', winter: 1, res: { iron: 2.4, wheat: 1.0, wool: 2.0 }, ev: { vein: 3, cavein: 2, cold: 3, plague: 2, festival: 0.5, ship: 0, storm: 0, snowmelt: 2.5, pearlbeach: 0.2, tourney: 1.2 },
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
    water: 'capital', theme: 'green', maxShops: 6, cash: 1200, ev: { tax: 2, tourney: 2.5, dragonhunt: 1.5 }, aiHard: 1,
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
const AI_NAMES = [['ベルナ', 'red', 'cheap'], ['グスタフ', 'yellow', 'luxury'], ['ミレイユ', 'green', 'hoarder']];

export function newGame({ seed = 1, players = null, months = MONTHS, stage = 'rose' } = {}) {
  const st = useStage(stage);
  const S = { v: 5, stage: STAGE, seed, rs: (seed * 2654435761) >>> 0 || 7, t: 0, months, players: [], shops: [], nextShop: 1, market: {}, ev: null, evNext: null, evActive: [], crowns: null, over: false };
  const ps = players || [{ name: 'あなた', human: true }, ...AI_NAMES.map(([n, c, k]) => ({ name: n, ai: k }))];
  const mk = Object.keys(MISSIONS).sort(() => 0);
  const deck = mk.slice(); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd(S) * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  ps.forEach((p, i) => S.players.push({ id: i, name: p.name, color: p.color || COLORS[i], human: !!p.human, ai: p.human ? null : (p.ai || 'balanced'), cash: st.cash || 1000, debt: 0, inv: Object.fromEntries(Object.keys(ITEMS).map(k => [k, 0])), invCost: Object.fromEntries(Object.keys(ITEMS).map(k => [k, 0])), offers: [], deals: 0, contracts: [], hand: [], scout: -1, nw: [st.cash || 1000], rankHist: [], mission: deck[i % deck.length], flags: { bigm: 0, bailed: 0, route2: 0, crown: 0, made: 0 } }));
  for (const k in ITEMS) S.market[k] = { price: ITEMS[k].base, hist: [ITEMS[k].base], k: 1 };
  // AI の好みはゲームごとにちがう(毎回同じ手を打たないように)
  const gs = Object.keys(GOODS), ds = Object.keys(DISTRICTS);
  for (const p of S.players) if (p.ai) { p.fav = gs[Math.floor(rnd(S) * gs.length)]; p.favD = ds[Math.floor(rnd(S) * ds.length)]; p.boldness = 0.6 + rnd(S) * 0.8; }
  S.evNext = pickEvent(S);
  dealHands(S);
  S.nextOffer = 1; makeOffers(S);
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
  if (a.type === 'deal') { const o = p.offers.find(x => x.id === a.id); if (!o) return 'その取引はもう終わった'; if (o.kind === 'buy' && (p.inv[o.item] || 0) < o.qty) return `${ITEMS[o.item].name}が足りない`; if (o.kind === 'sell' && p.cash < o.qty * o.price) return 'お金が足りない'; return null; }
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
  return '不明な決断';
}
// 資源をまとめて買うときの見積もり(買うほど値上がり)
export function quote(S, res, qty) { const m = S.market[res], r = ITEMS[res]; let c = 0, pr = m.price * (1 + SPREAD); for (let i = 0; i < qty; i++) { c += pr; pr *= 1 + r.impact; } return c; }
export function sellQuote(S, res, qty) { let got = 0, pr = S.market[res].price * (1 - SPREAD); for (let i = 0; i < qty; i++) { got += pr; pr /= 1 + ITEMS[res].impact; } return got; }
function applyAction(S, pid, a, fx, late) {
  const err = validate(S, pid, a); if (err) return err;
  const p = S.players[pid];
  if (a.type === 'open') {
    const lot = LOTS[a.lot], cost = openCost(lot.d, a.g);
    p.cash -= cost;
    const s = { id: S.nextShop++, owner: pid, lot: a.lot, d: lot.d, g: a.g, res: a.g === 'work' ? a.res : null, autoSell: a.g === 'work' ? 1 : 0, useProc: 1, home: 0, feat: null, featQty: 0, priceLv: a.priceLv ?? 2, staff: a.staff ?? 2, ads: 0, qual: 0, rep: 0.5, months: 0, hist: [], boost: 1, helper: 0, saleNow: 0, under: 0, last: null, openedT: S.t, route: null };
    S.shops.push(s); fx.push({ kind: 'open', pid, shop: s.id });
  }
  if (a.type === 'set') {
    const s = S.shops.find(x => x.id === a.shop);
    if (a.priceLv != null) s.priceLv = clamp(a.priceLv | 0, 0, 4);
    if (a.staff != null) s.staff = clamp(a.staff | 0, 1, 5);
    if (a.ads != null) s.ads = clamp(a.ads | 0, 0, 2);
    if (a.autoSell != null) s.autoSell = clamp(+a.autoSell, 0, 1);
    if (a.useProc != null) s.useProc = a.useProc ? 1 : 0;
    if (a.feat !== undefined) { s.feat = a.feat && RARES[a.feat] && RARES[a.feat].use === s.g ? a.feat : null; s.featQty = clamp(a.featQty | 0, 0, 20); }
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
    S.market[a.res].price *= Math.pow(1 + ITEMS[a.res].impact, a.qty);
    fx.push({ kind: 'buy', pid, res: a.res, qty: a.qty });
  }
  if (a.type === 'sell') {
    const got = sellQuote(S, a.res, a.qty), pr = S.market[a.res].price / Math.pow(1 + ITEMS[a.res].impact, a.qty);
    const avg = p.inv[a.res] ? p.invCost[a.res] / p.inv[a.res] : 0;
    p.invCost[a.res] -= avg * a.qty; p.inv[a.res] -= a.qty; p.cash += got; S.market[a.res].price = pr;
    fx.push({ kind: 'sell', pid, res: a.res, qty: a.qty, got });
  }
  if (a.type === 'repay') { const amt = Math.min(a.amt, p.debt); p.cash -= amt; p.debt -= amt; }
  if (a.type === 'deal') {
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
    if (a.card === 'dump') { late.push(() => { S.market[a.res].price *= 0.7; }); }
    fx.push({ kind: 'card', pid, card: a.card, shop: a.shop, res: a.res, target: s ? s.owner : null });
  }
  return null;
}
function monthlyUse(S, pid, res) { return storesOf(S, pid).filter(s => GOODS[s.g].res === res).reduce((a, s) => a + (s.last ? s.last.units : s.staff * GOODS[s.g].capPer * 0.6), 0); }

// お客の取り合い(1つの地区・1つの業種の中で)
function demandOf(S, d, g, noise) { return DISTRICTS[d].demand[g] * 1.25 * weatherMult(S, d, g) * season(S, g, d) * activeMult(S, 'dem', g, d) * activeMult(S, 'dist', d, d) * noise; }
function attraction(S, s, pm) {
  const G = GOODS[s.g], R = routeFx(s);
  const kd = kindOf(s.d), repExp = kd === 'hill' ? 1.7 : 1.2, nob = kd === 'noble' ? 0.55 : 1;
  return Math.pow(0.35 + s.rep, repExp) * QUALITY[s.qual].k * R.qual * Math.pow(1 / pm, G.elastic * 1.6 * R.elastic * nob) * ADS[s.ads].k * s.boost * streetBonus(S, s) * (1 + 0.15 * (s.home || 0)) * (LOTS[s.lot] && LOTS[s.lot].road ? ROAD_BONUS : 1) * featK(S, s);
}
// 目玉商品(レア素材)を並べた店は客寄せが上がる(1個 +8%、最大 +60%)
function featUnits(S, s) { if (!s.feat || !s.featQty) return 0; const p = S.players[s.owner]; return Math.min(s.featQty, Math.floor(p.inv[s.feat] || 0)); }
export function featK(S, s) { const u = featUnits(S, s); return u ? Math.min(1.6, 1 + 0.08 * u) : 1; }
export const featPremium = (S, s, k) => S.market[k].price * (kindOf(s.d) === 'noble' && k === 'seapearl' ? 2.3 : 1.7);
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
  S.w = S.wNext || 'cloudy'; S.wHist = (S.wHist || []).concat(S.w).slice(-6);
  // 資源の値段
  for (const k in ITEMS) {
    const m = S.market[k], r = ITEMS[k];
    // 加工品の相場は原料の相場にも引っぱられる
    const follow = r.from ? 0.6 + 0.4 * S.market[r.from].price / RES[r.from].base : 1;
    const target = r.base * activeMult(S, 'res', k) * follow * weatherRes(S, k);
    m.price = Math.max(r.base * 0.3, m.price + (target - m.price) * (r.from ? 0.55 : 0.4) + m.price * r.vol * gauss(S));
  }
  for (const f of late) f();
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
    const cap = shops.map(capOf);
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
    let need = units * QUALITY[s.qual].cost * R.cost, cogs = 0;
    // 自分の工房の加工品があれば先に使う(自家製: 次の月の客寄せ +15%)
    const pk = RES[G.res].proc; let homeU = 0;
    if (s.useProc && p.inv[pk] > 0 && need > 0) { const u = Math.min(need, p.inv[pk]); const avg = p.invCost[pk] / p.inv[pk]; cogs += u * avg * 0.5; p.inv[pk] -= u; p.invCost[pk] -= u * avg; need -= u; homeU = u; }
    s.home = units > 0 ? homeU / Math.max(1, units * QUALITY[s.qual].cost * R.cost) : 0;
    for (const ct of p.contracts) if (need > 0 && ct.res === G.res && ct.stock > 0) { const u = Math.min(need, ct.stock); cogs += u * ct.price; ct.stock -= u; need -= u; }
    if (need > 0 && p.inv[G.res] > 0) { const u = Math.min(need, p.inv[G.res]); const avg = p.invCost[G.res] / p.inv[G.res]; cogs += u * avg; p.inv[G.res] -= u; p.invCost[G.res] -= u * avg; need -= u; }
    if (need > 0) { const m = S.market[G.res]; cogs += need * m.price; m.price *= Math.pow(1 + RES[G.res].impact * 0.04, need); }
    // 目玉商品: 並べた分は特別な品として高く売れる(素材の相場の1.7倍。真珠は貴族街で2.3倍)
    let featRev = 0, featUsed = 0;
    const fu = featUnits(S, s);
    if (fu > 0 && units > 0) { featUsed = fu; const k = s.feat, avg = p.invCost[k] / p.inv[k]; featRev = fu * featPremium(S, s, k); cogs += fu * avg; p.inv[k] -= fu; p.invCost[k] -= fu * avg; }
    const labor = s.staff * WAGE, rent = DISTRICTS[s.d].rent * R.rent, ads = ADS[s.ads].cost;
    const profit = revenue + featRev - cogs - labor - rent - ads;
    p.cash += profit;
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
    s.rep = clamp(s.rep + (target - s.rep) * 0.25 * (target > s.rep ? R.repGain : 1), 0.02, 1);
    s.months++; s.boost = 1; s.saleNow = 0; s.promo = 0; s.promoK = 1; s.promoName = null; if (s.helper > 0) s.helper--; if (s.under > 0) s.under--;
    fx.push({ kind: 'sales', pid: s.owner, shop: s.id, units, profit });
  }
  for (const p of S.players) {
    for (const c of p.contracts) { if (c.left > 0) { c.stock += c.qty; p.cash -= c.qty * c.price; c.left--; } }
    p.contracts = p.contracts.filter(c => c.left > 0 || c.stock > 0.5);
    if (p.debt > 0) p.cash -= p.debt * LOAN_RATE;
    if (p.cash < 0) { const need = Math.ceil(-p.cash / 100) * 100; p.debt += need * 1.1; p.cash += need; p.flags.bailed = 1; fx.push({ kind: 'bailout', pid: p.id, amt: need }); }
    for (const k in p.inv) if (p.inv[k] > 0) {
      p.cash -= p.inv[k] * ITEMS[k].base * 0.012;   // 保管料
      const dc = ITEMS[k].decay; if (dc) { p.inv[k] *= 1 - dc; p.invCost[k] *= 1 - dc; }   // 傷んで減る
      if (p.inv[k] < 0.5) { p.inv[k] = 0; p.invCost[k] = 0; }
    }
  }
  for (const a of S.evActive) a.left--; S.evActive = S.evActive.filter(a => a.left > 0);
  for (const k in ITEMS) { S.market[k].hist.push(S.market[k].price); if (S.market[k].hist.length > 60) S.market[k].hist.shift(); }
  for (const p of S.players) p.offers = [];
  makeOffers(S);
  forecastWeather(S);
  S.served = {}; for (const sh of S.shops) if (sh.g !== 'work' && sh.last) { (S.served[sh.d] = S.served[sh.d] || {})[sh.g] = (S.served[sh.d][sh.g] || 0) + sh.last.units; }
  S.ledger = fx.filter(f => f.kind === 'buy' || f.kind === 'sell' || f.kind === 'deal' || (f.kind === 'card' && f.card === 'dump') || f.kind === 'open' || f.kind === 'close').map(f => ({ ...f, t: S.t }));
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
// 工房: 原料を加工品にする。作った分の一部を自動で市場に売れる
export function workCap(s) { return s.staff * PROC[RES[s.res].proc].rate * (s.helper > 0 ? 1.3 : 1) * (s.under > 0 ? 0.7 : 1); }
function workMonth(S, s, fx) {
  const p = S.players[s.owner], raw = s.res, pk = RES[raw].proc, P = PROC[pk];
  const cap = workCap(s), units = Math.min(cap, p.inv[raw]);
  const labor = s.staff * WAGE, rent = DISTRICTS[s.d].rent;
  let rawCost = 0;
  if (units > 0) { const avg = p.invCost[raw] / p.inv[raw]; rawCost = units * avg; p.inv[raw] -= units; p.invCost[raw] -= rawCost; p.inv[pk] += units; p.invCost[pk] += rawCost + labor + rent; p.flags.made += units; }
  p.cash -= labor + rent;
  let sold = 0, got = 0;
  if (s.autoSell > 0 && p.inv[pk] > 0) { sold = Math.floor(p.inv[pk] * s.autoSell); if (sold > 0) { got = sellQuote(S, pk, sold); const avg = p.invCost[pk] / p.inv[pk]; p.inv[pk] -= sold; p.invCost[pk] -= avg * sold; p.cash += got; S.market[pk].price /= Math.pow(1 + P.impact, sold); } }
  const value = units * S.market[pk].price * (1 - SPREAD) - rawCost - labor - rent;
  s.last = { units, want: units, cap, D: 0, revenue: got, cogs: rawCost, labor, rent, ads: 0, profit: value, made: units, sold, got, short: Math.max(0, cap - units) };
  s.hist.push(value); if (s.hist.length > 24) s.hist.shift();
  s.months++; s.boost = 1; if (s.helper > 0) s.helper--; if (s.under > 0) s.under--;
  fx.push({ kind: 'made', pid: s.owner, shop: s.id, units, profit: value, item: pk });
}
// 旅の商人からの申し出(プレイヤーごとに別々。今月中に受けるかどうか決める)
function makeOffers(S) {
  const supply = S.evActive.map(a => evDef(a.id)).filter(e => e && e.supply).map(e => e.supply);
  for (const p of S.players) {
    // 出回っているレア素材を売りに来る商人
    for (const k of supply) if (rnd(S) < 0.7) p.offers.push({ id: S.nextOffer++, kind: 'sell', item: k, qty: 3 + Math.floor(rnd(S) * 8), price: Math.round(S.market[k].price * (0.7 + rnd(S) * 0.15) * 100) / 100, k: 0.75, who: MERCHANTS[Math.floor(rnd(S) * MERCHANTS.length)], rareHint: 1 });
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
export function aiDecide(S, pid) {
  const p = S.players[pid], K = AI_KIND[p.ai] || AI_KIND.balanced, acts = [];
  const mine = shopsOf(S, pid);
  let cash = p.cash;
  if (mine.length < MAX_SHOPS && S.t < S.months - 8) {
    let best = null;
    for (const lot of LOTS) {
      if (!lotFree(S, lot.id)) continue;
      for (const g in GOODS) {
        const cost = openCost(lot.d, g); if (cash < cost + ((STAGES[S.stage] || {}).aiHard ? 150 : 250) + 300 * (1 - K.risk)) continue;
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
    if (best && best.score > 0.02) { acts.push({ type: 'open', lot: best.lot, g: best.g, priceLv: K.price, staff: 2 }); cash -= best.cost; }
  }
  for (const s of mine) {
    const l = s.last; if (!l) continue;
    if (s.g === 'work') { if (p.inv[s.res] < workCap(s) * 0.5 && cash > 300) { const q = Math.round(workCap(s)); acts.push({ type: 'buy', res: s.res, qty: q }); cash -= q * S.market[s.res].price; } continue; }
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
      const k = s.route ? s.route.k : (kindOf(s.d) === 'hill' ? 'local' : kindOf(s.d) === 'noble' ? 'lux' : K.route), lv = s.route ? s.route.lv + 1 : 1;
      if (lv <= 2 && cash > ROUTES[k].cost[lv - 1] + 300 && (lv === 1 || s.months >= 12)) { acts.push({ type: 'route', shop: s.id, k }); cash -= ROUTES[k].cost[lv - 1]; }
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
  const cap = st1 * G.capPer * R.cap * (s.helper > 0 ? 1.3 : 1) * (s.under > 0 ? 0.7 : 1);
  const units = Math.min(want, cap);
  const unitCost = l.units > 0 ? l.cogs / l.units : RES[G.res].base;
  const revenue = units * G.ref * pm1, cogs = units * unitCost, labor = st1 * WAGE, rent = DISTRICTS[s.d].rent * R.rent, ads = ADS[ad1].cost;
  return { units, want, cap, revenue, cogs, labor, rent, ads, profit: revenue - cogs - labor - rent - ads };
}
