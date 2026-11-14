// キャピタル商会戦争: カードで戦う投資バトル。
// 毎月、ニュースを読んで手札の投資カードを3枚まで出す。値動きがめくられ、役(的中・分散・一点集中・パーフェクト)で倍率。
// ライバルも同じ月に投資し、稼いだ差がダメージになる。月の合間はお店で顧問とカードを買って強くなる
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
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ── 資産(資源と会社)
const AS = [
  { k: 'wheat', name: '小麦', icon: 'wheat', color: '#ffd36e', vol: 0.07, p0: 10 },
  { k: 'iron', name: '鉄', icon: 'iron', color: '#9fc3ff', vol: 0.09, p0: 24 },
  { k: 'herb', name: '薬草', icon: 'herb', color: '#6ee07a', vol: 0.1, p0: 16 },
  { k: 'fabric', name: '布', icon: 'fabric', color: '#ff9ac0', vol: 0.08, p0: 20 },
  { k: 'star', name: '星銀', icon: 'starsilver', color: '#c79bff', vol: 0.16, p0: 80 },
  { k: 'bank', name: '王都銀行', icon: 'o_cash', color: '#ffe08a', vol: 0.06, p0: 40, co: 1 },
  { k: 'ship', name: '海運商会', icon: 'o_boat', color: '#5ad1ff', vol: 0.11, p0: 30, co: 1 },
  { k: 'arcane', name: '魔導工房', icon: 'o_crystal', color: '#d0a8ff', vol: 0.13, p0: 60, co: 1 },
];
const NEWS = {
  wheat: [[1, '北の畑で日照り。小麦が不作'], [1, '王都でパン祭り'], [-1, '小麦が大豊作'], [-1, '隣国から安い小麦']],
  iron: [[1, '王国軍が武具を大量注文'], [1, '鉱山で落盤'], [-1, '新しい鉱山が見つかった'], [-1, '戦争が終わり武具が余る']],
  herb: [[1, '町で風邪が流行'], [1, '薬草の森が山火事'], [-1, '薬草の森で大収穫'], [-1, '新しい薬が発明された']],
  fabric: [[1, '王都で舞踏会'], [1, '羊の病気で羊毛不足'], [-1, '東の国から安い布'], [-1, '流行が終わった']],
  star: [[1, '魔導師ギルドが買い集め'], [1, '流れ星の夜が終わる'], [-1, '偽物が出回っている'], [-1, '大鉱脈が見つかった']],
  bank: [[1, '王家の金庫番に選ばれた'], [-1, '大口の貸し倒れ']],
  ship: [[1, '新しい航路が開かれた'], [-1, '嵐で船が沈んだ']],
  arcane: [[1, '新しい魔導具を発明'], [-1, '実験で大爆発']],
};
const TIERS = [{ name: '確実', rel: 0.88, cls: 'sure' }, { name: '有力', rel: 0.72, cls: 'likely' }, { name: 'うわさ', rel: 0.55, cls: 'rumor' }];

// ── ライバル(ステージのボス)
const RIVALS = [
  { name: 'ロウ', icon: 'o_rogue', color: '#9be87a', hp: 260, style: 'contra', rule: '逆張りのロウ: ニュースの逆に賭けてくる', say: { start: 'みんなが信じる話ほど、外れるもんさ', hit: '逆張りは裏切らない', hurt: 'ちっ、今回は素直な相場だったか', lose: 'まいった、あんたの勝ちだ' } },
  { name: 'ミーナ', icon: 'o_mage', color: '#5aa8ff', hp: 280, style: 'news', rule: '情報戦のミーナ: 毎月ニュースを1つ隠す', hide: 1, say: { start: '情報を制する者が相場を制するのよ', hit: '計算どおりね', hurt: 'そんな情報、どこで…', lose: '…あなたの読み、本物ね' } },
  { name: 'ガルド', icon: 'o_barb', color: '#ff6b5a', hp: 400, style: 'bull', rule: '大商人ガルド: 大相場(値動き1.6倍)。強いカードで攻めてくる', big: 1.6, boss: 1, say: { start: '相場はおれが動かす! かかってこい!', hit: 'がはは、これが資本の力だ!', hurt: 'なにぃ!?', lose: 'お、おれの商会が…!' } },
];

// ── 顧問(ずっと効く)
const PERKS = {
  starfan: { name: '星銀マニア', icon: 'starsilver', cost: 160, text: '星銀と魔導工房のカードの利益 ×2' },
  spread: { name: '分散の達人', icon: 'o_scales', cost: 180, text: '「分散」の倍率が ×1.3 → ×2' },
  bear: { name: '逆張り師', icon: 'o_chartdn', cost: 150, text: '下がる(▼)カードの利益 +60%' },
  bull: { name: '強気の旦那', icon: 'o_chartup', cost: 150, text: '上がる(▲)カードの利益 +40%' },
  spy: { name: '情報屋', icon: 'o_magnifier', cost: 200, text: '毎月ニュースの1つが「本当の向き」で分かる' },
  insure: { name: '保険屋', icon: 'o_contract', cost: 170, text: '外れたカードの損が半分' },
  hand: { name: '大きな鞄', icon: 'o_bag', cost: 140, text: '手札 +1 枚' },
  redraw: { name: '引き直し上手', icon: 'o_dice', cost: 120, text: '引き直し +1 回' },
  owner: { name: '株主', icon: 'o_crown', cost: 160, text: '会社(銀行・海運・魔導)のカードの利益 +50%' },
  focus: { name: '一点張り', icon: 'o_target', cost: 170, text: '「一点集中」の倍率が ×1.5 → ×2.5' },
  interest: { name: '複利の魔術', icon: 'o_cash', cost: 190, text: '毎月 持ち金の 8% が増える' },
};
const MAX_PERKS = 4;

// ── 状態
let S = null;
const newCard = (a, dir, pow, extra = {}) => ({ id: Math.random().toString(36).slice(2), a, dir, pow, ...extra });
function starterDeck() {
  const d = [];
  for (let a = 0; a < 5; a++) { d.push(newCard(a, 1, 1)); d.push(newCard(a, -1, 1)); }
  d.push(newCard(1, 1, 2), newCard(4, -1, 2), newCard(5, 1, 1), newCard(6, -1, 1), newCard(7, 1, 1));
  return d;
}
function newRun() {
  S = { stage: 0, month: 0, hp: 500, hpMax: 500, cash: 300, deck: starterDeck(), perks: [], prices: AS.map(a => a.p0 * rand(0.9, 1.1)), hist: AS.map(() => []), sel: [], hand: [], pile: [], redraws: 0, phase: 'plan', news: [] };
  startStage();
}
const R = () => RIVALS[S.stage];
const has = (k) => S.perks.includes(k);
const handSize = () => 5 + (has('hand') ? 1 : 0);
function startStage() {
  const r = R(); S.rhp = r.hp; S.rhpMax = r.hp;
  bgm.play(r.boss ? 'ouji' : S.stage === 1 ? 'yuki' : 'kenso');
  startMonth();
  setTimeout(() => cutIn(r, r.say.start, r.rule, true), 300);
}
function startMonth() {
  S.month++; S.phase = 'plan'; S.sel = [];
  if (has('interest') && S.month > 1) { const g = Math.round(S.cash * 0.08); S.cash += g; setTimeout(() => toast(`複利の魔術 +${g}G`), 600); }
  // ニュース(3つ。ミーナはひとつ隠す)と、本当の値動き
  const picks = shuffle(AS.map((a, i) => i)).slice(0, 3), r = R();
  S.news = picks.map((i, n) => { const [s, text] = pick(NEWS[AS[i].k]), t = TIERS[n]; return { i, s, text, tier: t, truth: Math.random() < t.rel ? s : -s, hidden: false }; });
  if (r.hide) S.news[Math.floor(Math.random() * 3)].hidden = true;
  if (has('spy')) { const n = S.news.find(x => !x.hidden) || S.news[0]; n.reveal = true; }
  const big = r.big || 1;
  S.moves = AS.map((a, i) => { const n = S.news.find(x => x.i === i); return clamp((n ? n.truth * rand(0.08, 0.17) : 0) + gauss() * a.vol * 0.6 - 0.1 * Math.log(S.prices[i] / a.p0), -0.4, 0.4) * big; });
  S.moves[7] = clamp(S.moves[7] + 0.7 * S.moves[4], -0.5, 0.5);   // 魔導工房は星銀につられる
  // 手札
  S.redraws = 2 + (has('redraw') ? 1 : 0);
  S.pile = shuffle(S.deck.slice());
  S.hand = S.pile.splice(0, handSize());
  S.rhand = rivalHand();
  render();
}
function rivalHand() {
  const lvl = S.stage, hand = [];
  for (let k = 0; k < 4; k++) hand.push(newCard(Math.floor(Math.random() * AS.length), Math.random() < 0.5 ? 1 : -1, 1 + (Math.random() < 0.15 + lvl * 0.1 ? 1 : 0)));
  for (const n of S.news) {
    const want = R().style === 'contra' ? -n.s : n.s;
    if (Math.random() < 0.45 + lvl * 0.1) hand.push(newCard(n.i, want, 1 + (lvl >= 2 && Math.random() < 0.5 ? 1 : 0)));
  }
  return hand;
}
function rivalPlay() {
  const r = R(), scored = S.rhand.map(c => {
    const n = S.news.find(x => x.i === c.a);
    let v = c.pow * 0.2;
    if (n) v += (r.style === 'contra' ? -n.s : n.s) === c.dir ? n.tier.rel : -0.4;
    if (r.style === 'bull' && c.dir > 0) v += 0.3;
    return { c, v: v + Math.random() * 0.3 };
  }).sort((a, b) => b.v - a.v);
  return scored.slice(0, 3).map(x => x.c);
}

// ── 点数の計算(役と倍率)
const STAKE = 100;
function scoreHand(cards, mine) {
  const rows = cards.map(c => {
    const mv = S.moves[c.a];
    const gain = c.straddle ? Math.abs(mv) * c.pow * STAKE * 0.7 : mv * c.dir * c.pow * STAKE;
    let mult = 1; const tags = [];
    const n = S.news.find(x => x.i === c.a);
    if (!c.straddle && n && c.dir === n.s && Math.sign(mv) === c.dir) { mult *= 1.5; tags.push('的中 ×1.5'); }
    if (mine) {
      if (has('starfan') && (c.a === 4 || c.a === 7) && gain > 0) { mult *= 2; tags.push('星銀マニア ×2'); }
      if (has('bear') && c.dir < 0 && !c.straddle && gain > 0) { mult *= 1.6; tags.push('逆張り師 +60%'); }
      if (has('bull') && c.dir > 0 && !c.straddle && gain > 0) { mult *= 1.4; tags.push('強気 +40%'); }
      if (has('owner') && AS[c.a].co && gain > 0) { mult *= 1.5; tags.push('株主 +50%'); }
      if (has('insure') && gain < 0) { mult *= 0.5; tags.push('保険 損半分'); }
    }
    return { c, mv, gain, mult, tags, total: gain * mult };
  });
  const counts = {}; cards.forEach(c => counts[c.a] = (counts[c.a] || 0) + 1);
  const combos = [];
  for (const r of rows) if (counts[r.c.a] >= 2 && r.total > 0) { const m = mine && has('focus') ? 2.5 : 1.5; r.total *= m; r.tags.push(`一点集中 ×${m}`); }
  const sum = rows.reduce((a, r) => a + r.total, 0); let mult = 1;
  if (cards.length === 3 && Object.keys(counts).length === 3 && sum > 0) { const m = mine && has('spread') ? 2 : 1.3; mult *= m; combos.push(`分散 ×${m}`); }
  if (cards.length === 3 && rows.every(r => r.total > 0)) { mult *= 2; combos.push('パーフェクト ×2'); }
  return { rows, sum, mult, combos, total: Math.round(sum * mult) };
}

// ── 画面
function render() {
  if (!S) return;
  renderVS(); renderNews(); renderBoard(); renderPerks(); renderHand(); renderAct();
}
function bar(v, max, cls) { return `<div class="hp ${cls}"><i style="width:${clamp(v / max, 0, 1) * 100}%"></i><b>${fmt(Math.max(0, v))}</b></div>`; }
function renderVS() {
  const r = R();
  $('#vs').innerHTML = `<div class="side me">${img('o_crown', 'face')}<div class="info"><small>あなた ・ ${img('coin', 'mini')}${fmt(S.cash)}G</small>${bar(S.hp, S.hpMax, 'me')}</div></div>
    <div class="mid"><b>VS</b><small>${S.stage + 1}/3人目 ・ ${S.month}か月目</small></div>
    <div class="side rv" style="--c:${r.color}"><div class="info"><small>${r.boss ? 'ボス ' : ''}${r.name}</small>${bar(S.rhp, S.rhpMax, 'rv')}</div>${img(r.icon, 'face')}</div>`;
}
function renderNews() {
  $('#news').innerHTML = S.news.map(n => {
    const a = AS[n.i];
    if (n.hidden) return `<div class="nw hidden">${img('o_think')}<div><b>??? ミーナが隠した</b><small>どこかの相場が動く</small></div></div>`;
    const dir = n.reveal ? n.truth : n.s;
    return `<div class="nw ${n.reveal ? 'sure' : n.tier.cls}">${img(a.icon)}<div><span class="tag">${n.reveal ? '本当の向き' : n.tier.name}</span><b>${n.text}</b><small>${a.name}が<em class="${dir > 0 ? 'up' : 'dn'}">${dir > 0 ? '上がる' : '下がる'}</em>${n.reveal ? '(情報屋の裏取り済み)' : `かも 約${Math.round(n.tier.rel * 100)}%`}</small></div></div>`;
  }).join('');
}
function spark(i) {
  const h = S.hist[i].slice(-6); if (!h.length) return '<svg class="spk"></svg>';
  let p = S.prices[i]; const arr = [p]; for (let k = h.length - 1; k >= 0; k--) { p = p / (1 + h[k]); arr.unshift(p); }
  const lo = Math.min(...arr), hi = Math.max(...arr), W = 56, H = 16;
  const d = arr.map((v, k) => `${k ? 'L' : 'M'}${(k / (arr.length - 1) * W).toFixed(1)},${(H - 1 - (v - lo) / ((hi - lo) || 1) * (H - 2)).toFixed(1)}`).join('');
  return `<svg class="spk" viewBox="0 0 ${W} ${H}"><path d="${d}" fill="none" stroke="${arr[arr.length - 1] >= arr[0] ? '#3ccf8e' : '#ff5a6a'}" stroke-width="1.8"/></svg>`;
}
function renderBoard() {
  $('#board').innerHTML = AS.map((a, i) => {
    const last = S.hist[i][S.hist[i].length - 1], n = S.news.find(x => x.i === i && !x.hidden);
    return `<div class="tile" style="--c:${a.color}">${img(a.icon)}<b>${a.name}</b>${spark(i)}${last != null ? `<span class="lm ${last >= 0 ? 'up' : 'dn'}">先月 ${pct(last)}</span>` : '<span class="lm">先月 —</span>'}${n ? `<i class="nb ${(n.reveal ? n.truth : n.s) > 0 ? 'up' : 'dn'}">${(n.reveal ? n.truth : n.s) > 0 ? '▲' : '▼'}</i>` : ''}</div>`;
  }).join('');
}
function renderPerks() {
  $('#perks').innerHTML = `<span class="pl">顧問</span>` + (S.perks.length ? S.perks.map(k => `<button class="perk" data-a="perkinfo" data-k="${k}">${img(PERKS[k].icon)}<b>${PERKS[k].name}</b></button>`).join('') : '<small>まだいない(月の合間のお店で雇える)</small>');
}
function cardHtml(c, opt = {}) {
  const a = AS[c.a];
  return `<button class="card ${opt.sel ? 'sel' : ''} ${c.straddle ? 'strad' : c.dir > 0 ? 'cu' : 'cd'}" ${opt.act ? `data-a="${opt.act}" data-id="${c.id}"` : ''} style="--c:${a.color}">
    <span class="pw">${'<i></i>'.repeat(c.pow)}</span>${img(a.icon, 'ci')}<b>${a.name}</b>
    <span class="dir">${c.straddle ? '両張り' : c.dir > 0 ? '▲上がる' : '▼下がる'}</span><small>${c.straddle ? `どちらでも ×${c.pow}` : `${STAKE * c.pow}G`}</small></button>`;
}
function renderHand() {
  $('#hand').innerHTML = S.hand.map(c => cardHtml(c, { sel: S.sel.includes(c.id), act: S.phase === 'plan' ? 'card' : null })).join('');
}
function renderAct() {
  if (S.phase !== 'plan') { $('#act').innerHTML = ''; return; }
  const n = S.sel.length;
  $('#act').innerHTML = `<button class="btn redraw" data-a="redraw" ${n && S.redraws ? '' : 'disabled'}>${img('o_dice')}<span>捨てて引く<small>のこり${S.redraws}回</small></span></button>
    <button class="btn go" data-a="invest" ${n ? '' : 'disabled'}>${n ? `${n}枚で投資する!` : 'カードを選ぶ(3枚まで)'}</button>`;
}

// ── 月の結果: めくって、役で倍率、ライバルと比べてダメージ
async function invest() {
  const mine = S.hand.filter(c => S.sel.includes(c.id));
  if (!mine.length || S.phase !== 'plan') return;
  S.phase = 'reveal'; renderHand(); renderAct();
  const rc = rivalPlay(), A = scoreHand(mine, true), B = scoreHand(rc, false), r = R();
  sfx('card'); haptic(15);
  $('#screen').innerHTML = `<div class="reveal"><div class="rvh">${S.month}か月目の決算</div>
    <div class="col me"><div class="who">${img('o_crown')}あなた</div><div class="rows" id="rowsA"></div><div class="combo" id="comboA"></div><div class="tot" id="totA">±0G</div></div>
    <div class="col rv" style="--c:${r.color}"><div class="who">${img(r.icon)}${r.name}</div><div class="rows" id="rowsB"></div><div class="combo" id="comboB"></div><div class="tot" id="totB">±0G</div></div>
    <div class="clash" id="clash"></div><div class="nextbox" id="nextbox"></div></div>`;
  await wait(450);
  const n = Math.max(A.rows.length, B.rows.length);
  for (let k = 0; k < n; k++) {
    if (A.rows[k]) await flip('#rowsA', A.rows[k]);
    if (B.rows[k]) await flip('#rowsB', B.rows[k]);
  }
  await showCombo('#comboA', '#totA', A, true);
  await showCombo('#comboB', '#totB', B, false);
  await wait(350);
  const d = A.total - B.total, cl = $('#clash');
  if (d >= 0) { const dmg = Math.max(d, 10); S.rhp -= dmg; cl.innerHTML = `<b class="win">${sgn(d)}G 差で勝ち!</b><small>${r.name}の信用に ${fmt(dmg)} ダメージ</small>`; sfx('kaching'); confetti(); shakeEl('.col.rv'); setTimeout(() => speech(r, r.say.hurt), 300); }
  else { S.hp += d; cl.innerHTML = `<b class="lose">${sgn(d)}G 差で負け…</b><small>あなたの信用に ${fmt(-d)} ダメージ</small>`; sfx('bad'); shake(); shakeEl('.col.me'); setTimeout(() => speech(r, r.say.hit), 300); }
  cl.classList.add('on');
  S.cash = Math.max(0, S.cash + A.total);
  AS.forEach((a, i) => { S.prices[i] *= 1 + S.moves[i]; S.hist[i].push(S.moves[i]); });
  renderVS();
  await wait(1100);
  $('#nextbox').innerHTML = `<button class="btn go" data-a="after">${S.rhp <= 0 ? '勝負あり!' : S.hp <= 0 ? '……' : '月の合間のお店へ'}</button>`;
}
async function flip(sel, row) {
  const el = document.createElement('div'); el.className = 'row';
  const c = row.c, a = AS[c.a], up = row.mv >= 0, good = row.total >= 0;
  const W = 110, H = 30, pts = [0]; for (let k = 1; k <= 12; k++) pts.push(pts[k - 1] + row.mv / 12 + gauss() * Math.max(0.01, Math.abs(row.mv)) * 0.15);
  pts[12] = row.mv; const lo = Math.min(...pts, 0), hi = Math.max(...pts, 0);
  const path = pts.map((v, k) => `${k ? 'L' : 'M'}${(k / 12 * W).toFixed(1)},${(H - 2 - (v - lo) / ((hi - lo) || 1) * (H - 4)).toFixed(1)}`).join('');
  el.innerHTML = `${img(a.icon)}<div class="rl"><b>${a.name}<em class="${c.straddle ? '' : c.dir > 0 ? 'up' : 'dn'}">${c.straddle ? '両張り' : c.dir > 0 ? '▲' : '▼'}×${c.pow}</em></b>
    <svg viewBox="0 0 ${W} ${H}"><path d="${path}" class="${up ? 'pu' : 'pd'}" pathLength="1"/></svg></div><div class="rr"><span class="mv ${up ? 'up' : 'dn'}">${pct(row.mv)}</span><b class="${good ? 'up' : 'dn'}">±0</b></div>${row.tags.length ? `<div class="tags">${row.tags.map(t => `<span>${t}</span>`).join('')}</div>` : ''}`;
  $(sel).appendChild(el);
  sfx('swipe'); await wait(600);
  countUp(el.querySelector('.rr b'), row.total, (v) => sgn(v));
  sfx(good ? 'coin' : 'bad'); if (row.tags.length && good) sfx('kaching');
  haptic(good ? 12 : 30);
  await wait(420);
}
async function showCombo(cs, ts, X, mine) {
  $(cs).innerHTML = X.combos.map(t => `<span>${t}</span>`).join('');
  if (X.combos.length) { sfx('rankup'); haptic(20); if (mine && X.combos.some(t => t.startsWith('パーフェクト'))) { banner('<b>パーフェクト!</b><small>3枚とも当たり。合計 ×2</small>', 'gold'); confetti(); } }
  countUp($(ts), X.total, (v) => `${sgn(v)}G`);
  $(ts).className = 'tot ' + (X.total >= 0 ? 'up' : 'dn');
  await wait(650);
}
function after() {
  $('#screen').innerHTML = '';
  if (S.hp <= 0) return gameOver();
  if (S.rhp <= 0) return stageWin();
  shop();
}
function stageWin() {
  const r = R(); sfx('rankup'); confetti(); confetti();
  const last = S.stage === RIVALS.length - 1;
  $('#screen').innerHTML = `<div class="over win"><div class="ocard">${img(r.icon, 'big')}<div class="ot">${r.name}に勝った!</div><div class="os">「${r.say.lose}」</div>
    ${last ? `<div class="os gold">商会戦争 制覇! 持ち金 ${fmt(S.cash)}G ・ ${S.month}か月</div>` : `<div class="os">信用が回復(+180)。次の相手は ${RIVALS[S.stage + 1].name}</div>`}
    <button class="btn go" data-a="${last ? 'title' : 'nextstage'}">${last ? 'タイトルへ' : '次の相手へ'}</button></div></div>`;
  if (last) { try { const b = +localStorage.getItem('war2-best') || 0; if (S.cash > b) localStorage.setItem('war2-best', String(Math.round(S.cash))); } catch (e) { } bgm.play('matsuri'); }
}
function gameOver() {
  sfx('bad'); const r = R();
  $('#screen').innerHTML = `<div class="over"><div class="ocard">${img(r.icon, 'big')}<div class="ot lose">信用が尽きた…</div><div class="os">${r.name}「${r.say.hit}」</div><div class="os">${S.stage + 1}人目・${S.month}か月目で敗退</div>
    <button class="btn go" data-a="start">もう一度</button><button class="btn" data-a="title">タイトルへ</button></div></div>`;
}

// ── お店: 顧問・カード・カードを捨てる
function shop() {
  S.phase = 'shop';
  const perkKeys = shuffle(Object.keys(PERKS).filter(k => !has(k))).slice(0, 2);
  const cards = [0, 1].map(() => { const a = Math.floor(Math.random() * AS.length); return Math.random() < 0.25 ? newCard(a, 1, 2, { straddle: 1 }) : newCard(a, Math.random() < 0.5 ? 1 : -1, Math.random() < 0.55 ? 2 : 3); });
  S.offer = { perks: perkKeys, cards: cards.map(c => ({ c, cost: c.straddle ? 130 : c.pow * 45 })) };
  renderShop();
  bgm.play('asa');
}
function renderShop() {
  const o = S.offer;
  $('#screen').innerHTML = `<div class="shop"><div class="sh">${img('ui_market')}<div><b>月の合間のお店</b><small>持ち金 ${img('coin', 'mini')}${fmt(S.cash)}G ・ 顧問 ${S.perks.length}/${MAX_PERKS}</small></div></div>
    <div class="sl">顧問を雇う(ずっと効く)</div>
    <div class="offers">${o.perks.map(k => { const P = PERKS[k]; return `<button class="offer" data-a="buyperk" data-k="${k}" ${S.cash < P.cost || S.perks.length >= MAX_PERKS ? 'disabled' : ''}>${img(P.icon)}<div><b>${P.name}</b><small>${P.text}</small></div><span class="cost">${P.cost}G</span></button>`; }).join('') || '<small class="none">売り切れ</small>'}</div>
    <div class="sl">カードを買う(山札に入る)</div>
    <div class="cardoffs">${o.cards.map((x, j) => `<div class="cardoff">${cardHtml(x.c)}<button class="btn buy" data-a="buycard" data-j="${j}" ${S.cash < x.cost ? 'disabled' : ''}>買う ${x.cost}G</button></div>`).join('') || '<small class="none">売り切れ</small>'}</div>
    <div class="sl">弱いカードを捨てる(40G・山札 ${S.deck.length}枚)</div>
    <div class="deck">${S.deck.map(c => `<button class="mini ${c.straddle ? 'strad' : c.dir > 0 ? 'cu' : 'cd'}" data-a="trash" data-id="${c.id}" ${S.cash < 40 || S.deck.length <= 8 ? 'disabled' : ''}>${img(AS[c.a].icon)}<span>${c.straddle ? '両' : c.dir > 0 ? '▲' : '▼'}${c.pow}</span></button>`).join('')}</div>
    <button class="btn go" data-a="nextmonth">次の月へ</button></div>`;
}

// ── 演出
function banner(html, cls = '') { const el = document.createElement('div'); el.className = 'banner ' + cls; el.innerHTML = html; $('#fx').appendChild(el); setTimeout(() => el.remove(), 1600); }
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; $('#fx').appendChild(el); setTimeout(() => el.remove(), 1800); }
function shake() { document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); }
function shakeEl(s) { const e = $(s); if (!e) return; e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); }
function confetti() { const cols = ['#ffd36e', '#3ccf8e', '#5aa8ff', '#ff9ac0', '#c79bff']; for (let k = 0; k < 50; k++) { const el = document.createElement('i'); el.className = 'conf'; el.style.cssText = `left:${Math.random() * 100}vw;background:${pick(cols)};animation-delay:${Math.random() * 0.4}s;--rot:${rand(-720, 720)}deg`; $('#fx').appendChild(el); setTimeout(() => el.remove(), 2300); } }
function countUp(el, to, f) { if (!el) return; const t0 = performance.now(); const step = (now) => { const k = Math.min(1, (now - t0) / 700), v = to * (1 - Math.pow(1 - k, 3)); el.textContent = f(v); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
function speech(r, text) { const el = document.createElement('div'); el.className = 'say'; el.style.setProperty('--c', r.color); el.innerHTML = `${img(r.icon)}<span>${text}</span>`; $('#fx').appendChild(el); setTimeout(() => el.remove(), 2400); }
function cutIn(r, line, sub, big) {
  const el = document.createElement('div'); el.className = 'cutin'; el.style.setProperty('--c', r.color);
  el.innerHTML = `<div class="band"></div>${img(r.icon, 'cface')}<div class="ct"><small>${big ? (r.boss ? 'ボス登場' : '勝負の相手') : ''}</small><b>${r.name}「${line}」</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
  $('#fx').appendChild(el); sfx('horn'); haptic(25);
  el.addEventListener('pointerdown', () => el.remove()); setTimeout(() => el.remove(), 2800);
}

// ── タイトル・あそびかた
const HOW = [
  { t: 'カードで投資バトル', b: 'ライバルと同じ相場で稼ぎを競う。毎月、稼いだ<b>差</b>がそのまま相手の<b>信用ゲージ</b>へのダメージ。0にしたら勝ち。3人に勝てば制覇。', ic: 'o_swords' },
  { t: 'ニュースを読んでカードを選ぶ', b: '手札の投資カード(例: <b>鉄 ▲上がる ×2</b>)から<b>3枚まで</b>選ぶ。いらないカードは<b>捨てて引く</b>。時間制限はないので、じっくり考えよう。', ic: 'o_envelope' },
  { t: '役で倍率アップ', b: '<b>的中</b>(ニュースどおり)×1.5、<b>一点集中</b>(同じ資産に2枚)×1.5、<b>分散</b>(3枚とも別)×1.3、<b>パーフェクト</b>(3枚とも当たり)×2。', ic: 'o_star' },
  { t: 'お店で強くなる', b: '月の合間に、稼いだお金で<b>顧問</b>(星銀の利益2倍など、ずっと効く)や<b>強いカード</b>を買う。自分だけの勝ち方を作ろう。', ic: 'ui_market' },
];
function showTitle() {
  S = null; bgm.play('asa');
  let best = 0; try { best = +localStorage.getItem('war2-best') || 0; } catch (e) { }
  ['#vs', '#news', '#board', '#perks', '#hand', '#act'].forEach(s => $(s).innerHTML = '');
  $('#screen').innerHTML = `<div class="title"><div class="logo"><small>キャピタル</small><b>商会戦争</b><span>カード投資バトル</span></div>
    <div class="tfaces">${RIVALS.map(r => `<div style="--c:${r.color}">${img(r.icon)}<small>${r.name}</small></div>`).join('')}</div>
    <div class="tbtns"><button class="btn go big" data-a="start">はじめる</button><button class="btn" data-a="how">あそびかた</button></div>
    ${best ? `<div class="best">制覇した時の持ち金 最高 ${fmt(best)}G</div>` : ''}<a class="back" href="../">商会バトルへ</a></div>`;
}
function showHow(i = 0) {
  const h = HOW[i]; document.querySelector('.how')?.remove();
  $('#screen').insertAdjacentHTML('beforeend', `<div class="how"><div class="hcard"><div class="hn">${i + 1} / ${HOW.length}</div>${img(h.ic, 'hic')}<b>${h.t}</b><p>${h.b}</p>
    <div class="hbtns">${i ? `<button class="btn" data-a="howgo" data-v="${i - 1}">もどる</button>` : ''}<button class="btn go" data-a="${i < HOW.length - 1 ? 'howgo' : 'howend'}" data-v="${i + 1}">${i < HOW.length - 1 ? 'つぎへ' : 'はじめる'}</button></div></div></div>`);
}

// ── 操作
const ACT = {
  start: () => { let seen = false; try { seen = localStorage.getItem('war2-how') === '1'; } catch (e) { } if (!seen) { showHow(0); return; } $('#screen').innerHTML = ''; newRun(); },
  how: () => showHow(0), howgo: (d) => showHow(+d.v),
  howend: () => { try { localStorage.setItem('war2-how', '1'); } catch (e) { } $('#screen').innerHTML = ''; newRun(); },
  title: () => showTitle(),
  card: (d) => {
    const id = d.id, k = S.sel.indexOf(id);
    if (k >= 0) S.sel.splice(k, 1); else { if (S.sel.length >= 3) { toast('出せるのは3枚まで'); sfx('bad'); return; } S.sel.push(id); }
    sfx('tap'); haptic(6); renderHand(); renderAct();
  },
  redraw: () => {
    if (!S.redraws || !S.sel.length) return;
    S.redraws--; S.hand = S.hand.filter(c => !S.sel.includes(c.id));
    if (S.pile.length < handSize()) S.pile.push(...shuffle(S.deck.filter(c => !S.hand.some(h => h.id === c.id) && !S.pile.some(p => p.id === c.id))));
    S.hand.push(...S.pile.splice(0, handSize() - S.hand.length));
    S.sel = []; sfx('card'); renderHand(); renderAct();
  },
  invest: () => invest(),
  after: () => after(),
  nextmonth: () => { $('#screen').innerHTML = ''; startMonth(); },
  nextstage: () => { $('#screen').innerHTML = ''; S.stage++; S.hp = Math.min(S.hpMax, S.hp + 180); startStage(); },
  buyperk: (d) => { const P = PERKS[d.k]; if (S.cash < P.cost || S.perks.length >= MAX_PERKS) return; S.cash -= P.cost; S.perks.push(d.k); S.offer.perks = S.offer.perks.filter(k => k !== d.k); sfx('kaching'); banner(`<b>「${P.name}」を雇った!</b><small>${P.text}</small>`, 'gold'); renderShop(); renderPerks(); renderVS(); },
  buycard: (d) => { const x = S.offer.cards[+d.j]; if (!x || S.cash < x.cost) return; S.cash -= x.cost; S.deck.push(x.c); S.offer.cards.splice(+d.j, 1); sfx('coin'); toast('山札に入れた'); renderShop(); renderVS(); },
  trash: (d) => { if (S.cash < 40 || S.deck.length <= 8) return; S.cash -= 40; S.deck = S.deck.filter(c => c.id !== d.id); sfx('close'); renderShop(); renderVS(); },
  perkinfo: (d) => toast(`${PERKS[d.k].name}: ${PERKS[d.k].text}`),
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  unlockAudio(); const a = b.dataset.a;
  if (a !== 'card') sfx('tap');
  if (ACT[a]) ACT[a](b.dataset);
});
showTitle();
window.__war = { get S() { return S; }, newRun, invest, ACT, scoreHand, rivalPlay, startMonth, startStage };
