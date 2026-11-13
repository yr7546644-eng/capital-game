// 画面の操作(一人で AI の商会と戦う)
import * as E from './engine.js';
import { Board, hexPos } from './board.js';
import { sfx, unlockAudio } from './sfx.js';

const $ = (s) => document.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString('ja-JP');
const sign = (n) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ym = (t) => `${Math.floor(t / 12) + 1}年目 ${t % 12 + 1}月`;
const cls = (n) => (n >= 0 ? 'up' : 'down');
const ME = 0;

let S = null, board = null;
const F = { acts: [], sheet: null, args: null, busy: false, cardSel: null };
const SAVE = 'capital-battle-v1';
const save = () => { try { localStorage.setItem(SAVE, JSON.stringify({ S, acts: F.acts })); } catch (e) { } };
const loadSave = () => { try { const j = JSON.parse(localStorage.getItem(SAVE) || 'null'); return j && j.S && j.S.v === 1 ? j : null; } catch (e) { return null; } };

// ── 決断(月末にまとめて実行される)
const me = () => S.players[ME];
function pendCost() {
  let c = 0;
  for (const a of F.acts) {
    if (a.type === 'open') c += E.openCost(E.LOTS[a.lot].d, a.g);
    if (a.type === 'buy') c += E.quote(S, a.res, a.qty);
    if (a.type === 'card') c += E.CARDS[a.card].cost;
    if (a.type === 'repay') c += a.amt;
  }
  return c;
}
const freeCash = () => me().cash - pendCost();
const pendOpen = (lot) => F.acts.find(a => a.type === 'open' && a.lot === lot);
const pendSet = (id) => F.acts.find(a => a.type === 'set' && a.shop === id);
const pendCard = () => F.acts.find(a => a.type === 'card');
function shopView(s) { const p = pendSet(s.id); return { ...s, priceLv: p && p.priceLv != null ? p.priceLv : s.priceLv, staff: p && p.staff != null ? p.staff : s.staff, ads: p && p.ads != null ? p.ads : s.ads }; }
function setPending(shopId, patch) {
  let a = pendSet(shopId); if (!a) { a = { type: 'set', shop: shopId }; F.acts.push(a); }
  Object.assign(a, patch);
  const s = S.shops.find(x => x.id === shopId);
  if (a.priceLv === s.priceLv && a.staff === s.staff && a.ads === s.ads) F.acts = F.acts.filter(x => x !== a);
  save();
}

// ── 上の情報
function hud() {
  const p = me(), rk = E.ranking(S), pos = rk.findIndex(x => x.p.id === ME) + 1;
  const prog = S.t / S.months, C = 2 * Math.PI * 12;
  const pc = pendCost();
  $('#hud').innerHTML = `
    <button class="pill month" data-a="menu"><svg class="ring" viewBox="0 0 30 30"><circle cx="15" cy="15" r="12" fill="none" stroke="#e3e8f5" stroke-width="4"/><circle cx="15" cy="15" r="12" fill="none" stroke="#3a7bd5" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C * prog} ${C}" transform="rotate(-90 15 15)"/></svg><span><div class="m1">${Math.floor(S.t / 12) + 1}年目 · のこり${S.months - S.t}か月</div><div class="m2">${S.t % 12 + 1}月</div></span></button>
    <div class="pill cash"><span class="coin">G</span><span class="num" id="cashv">${fmt(p.cash)}</span>${pc ? `<span class="pend">(予定 −${fmt(pc)})</span>` : ''}</div>
    <button class="pill rank" data-a="ranking"><b class="num">${pos}</b>位</button>`;
}
// ── 下のドック
function dock() {
  const ev = S.evNext && E.evDef(S.evNext.id), p = me(), used = pendCard();
  const n = F.acts.length;
  $('#dock').innerHTML = `
    ${ev ? `<button class="evchip" data-a="event"><span class="ei">${ev.icon}</span><span><span class="et">来月の予報</span><br>${esc(ev.name)}</span></button>` : ''}
    <div class="hand">${p.hand.map((c, i) => { const cd = E.CARDS[c]; const isUsed = used && used.card === c && used.idx === i; return `<button class="card ${isUsed ? 'sel' : used ? 'used' : ''}" data-a="card" data-i="${i}">${isUsed ? '<span class="tag">使う</span>' : ''}<div class="ci">${cd.icon}</div><div class="cn">${cd.name}</div><div class="cc">${cd.cost ? fmt(cd.cost) + 'G' : '無料'}</div></button>`; }).join('')}</div>
    <div class="actions">
      <button class="abtn" data-a="market"><span class="ai">🛒</span>市場</button>
      <button class="abtn" data-a="books"><span class="ai">📒</span>帳簿</button>
      <button class="abtn go" data-a="next">次の月へ${n ? `<small>決めたこと ${n}</small>` : ''}</button>
    </div>`;
}
function render() { hud(); dock(); if (F.sheet) renderSheet(); }

// ── シート
const SHEETS = {};
function openSheet(kind, args = {}) { F.sheet = kind; F.args = args; renderSheet(); $('#sheet').scrollTop = 0; $('#sheetwrap').classList.add('on'); sfx('open'); }
function closeSheet() { F.sheet = null; $('#sheetwrap').classList.remove('on'); board && board.highlightLot(-1); }
function renderSheet() { const f = SHEETS[F.sheet]; if (!f) return; $('#sheet').innerHTML = '<div class="grab"></div>' + f(F.args); }
const head = (icon, title, sub) => `<div class="sh"><div class="si">${icon}</div><h3>${title}${sub ? `<small>${sub}</small>` : ''}</h3><button class="x" data-a="close">✕</button></div>`;
const stars = (rep) => { const n = Math.round(rep * 5); return '<span class="stars">' + '★'.repeat(n) + '<span style="opacity:.25">' + '★'.repeat(5 - n) + '</span></span>'; };
const pname = (p) => `<span class="dot" style="background:${E.COLOR_HEX[p.color]}"></span>${esc(p.name)}`;

// 空き地 → 開業
SHEETS.lot = ({ lot }) => {
  const L = E.LOTS[lot], D = E.DISTRICTS[L.d], sel = F.args.g || null;
  const pend = pendOpen(lot);
  const goods = Object.entries(E.GOODS).map(([g, G]) => {
    const comp = S.shops.filter(s => s.d === L.d && s.g === g).length + F.acts.filter(a => a.type === 'open' && E.LOTS[a.lot].d === L.d && a.g === g && a.lot !== lot).length;
    const dem = D.demand[g] * G.ref; const lv = dem > 600 ? 3 : dem > 380 ? 2 : 1;
    const cost = E.openCost(L.d, g);
    return `<button class="good ${sel === g ? 'on' : ''}" data-a="pickgood" data-v="${g}"><div class="gi">${G.icon}</div><div class="gn">${G.name}</div><div class="gs">開業 ${fmt(cost)}G<br>需要 ${'●'.repeat(lv)}${'○'.repeat(3 - lv)} · ライバル ${comp}店</div></button>`;
  }).join('');
  const mine = E.shopsOf(S, ME).length + F.acts.filter(a => a.type === 'open').length - (pend ? 1 : 0);
  let foot = '';
  if (pend) foot = `<div class="t2" style="margin:8px 0">ここに<b>${E.GOODS[pend.g].name}</b>を開く予定。月末に建つ。</div><button class="btn wide" data-a="cancelopen" data-v="${lot}">開業の予定をやめる</button>`;
  else if (mine >= E.MAX_SHOPS) foot = `<div class="t2">お店は${E.MAX_SHOPS}つまで。</div>`;
  else if (sel) { const c = E.openCost(L.d, sel), ok = freeCash() >= c; foot = `<div class="est"><span class="ev">💡</span><div class="t2" style="margin:0">家賃 毎月 <b>${D.rent}G</b> + 店員 2人 <b>${E.WAGE * 2}G</b>。<br>パンは安くて数が出る・道具は高くて数が少ない。</div></div><button class="btn warm wide" style="margin-top:10px" data-a="doopen" data-v="${lot}" ${ok ? '' : 'disabled'}>${ok ? `${fmt(c)}G で開業する` : 'お金が足りない'}</button>`; }
  else foot = '<div class="t3" style="text-align:center;margin-top:6px">何の店を開く?</div>';
  return head('🏗️', D.name, `${D.desc} · 家賃 ${D.rent}G/月`) + `<div class="goods">${goods}</div><div style="margin-top:10px">${foot}</div>`;
};
// 自分の店
SHEETS.shop = ({ id }) => {
  const s0 = S.shops.find(x => x.id === id); if (!s0) return head('❔', 'もうない店', '');
  const s = shopView(s0), G = E.GOODS[s.g], D = E.DISTRICTS[s.d], l = s0.last;
  if (s0.owner !== ME) return rivalSheet(s0);
  let pl = '<div class="t3">来月から数字が出る</div>';
  if (l) {
    const r = Math.max(1, l.revenue), parts = [['原価', l.cogs, '#ffb36b'], ['人件費', l.labor, '#ff8fa8'], ['家賃', l.rent, '#c79bff'], ['広告', l.ads, '#7fc8ff']];
    const tot = Math.max(r, parts.reduce((a, x) => a + x[1], 0));
    pl = `<div class="row"><div class="grow"><div class="lbl">先月の利益</div><div class="big num ${cls(l.profit)}">${sign(l.profit)}G</div></div><div style="text-align:right"><div class="lbl" style="justify-content:flex-end">お客</div><div class="num" style="font-size:18px">${fmt(l.units)}<span class="t3">/${fmt(l.want)}人</span></div></div></div>
      <div class="plbar">${parts.map(x => `<i style="width:${x[1] / tot * 100}%;background:${x[2]}"></i>`).join('')}${l.profit > 0 ? `<i style="width:${l.profit / tot * 100}%;background:#34d399"></i>` : ''}</div>
      <div class="legend">${parts.map(x => `<span><i style="background:${x[2]}"></i>${x[0]} ${fmt(x[1])}</span>`).join('')}<span><i style="background:#34d399"></i>売上 ${fmt(l.revenue)}</span></div>
      ${l.want > l.cap * 1.05 ? `<div class="t3" style="margin-top:6px;color:var(--bad)">⚠️ 来たかったお客 ${fmt(l.want)}人に対して、さばけるのは ${fmt(l.cap)}人まで。人が足りない</div>` : l.cap > l.want * 1.5 ? `<div class="t3" style="margin-top:6px">💤 さばける数 ${fmt(l.cap)}人に対して、お客は ${fmt(l.want)}人。人が余っている</div>` : ''}`;
  }
  const est = E.estimateShop(S, s0, { priceLv: s.priceLv, staff: s.staff, ads: s.ads });
  const base = l ? l.profit : null;
  return head(G.icon, `${G.name}`, `${D.name} · 評判 ${stars(s0.rep)}`) +
    `<div class="box">${pl}</div>
    <div class="box"><div class="lbl">値段 <span class="grow"></span><span class="num">${(G.ref * E.PRICE_LV[s.priceLv]).toFixed(1)}G / 1つ</span></div>
      <div class="seg">${E.PRICE_NAME.map((n, i) => `<button class="${s.priceLv === i ? 'on' : ''}" data-a="setp" data-id="${id}" data-v="${i}">${n}</button>`).join('')}</div>
      <div class="lbl" style="margin-top:12px">店員 <span class="grow"></span><span class="t3">1人 ${E.WAGE}G/月 · 1人で月 ${G.capPer}人さばける</span></div>
      <div class="stepper"><button data-a="sets" data-id="${id}" data-v="-1">−</button><div class="v num">${s.staff}人</div><button data-a="sets" data-id="${id}" data-v="1">＋</button><div class="t3 grow" style="text-align:right">さばける ${fmt(s.staff * G.capPer)}人</div></div>
      <div class="lbl" style="margin-top:12px">広告</div>
      <div class="seg">${E.ADS.map((a, i) => `<button class="${s.ads === i ? 'on' : ''}" data-a="seta" data-id="${id}" data-v="${i}">${a.name}<small>${a.cost ? a.cost + 'G' : '0G'}</small></button>`).join('')}</div>
      ${est ? `<div class="est"><span class="ev">🔮</span><div class="grow"><div class="t3" style="margin:0">この設定だと来月は(ざっくり)</div><div style="font-size:17px">お客 ${fmt(est.units)}人 · 利益 <span class="${cls(est.profit)}">${sign(est.profit)}G</span>${base != null ? ` <span class="t3">(先月 ${sign(base)})</span>` : ''}</div></div></div>` : ''}
    </div>
    <div class="box"><div class="kv"><span class="k">品質</span><span>${E.QUALITY[s0.qual].name}</span></div><div class="kv"><span class="k">開業</span><span>${ym(s0.openedT)}</span></div><div class="kv"><span class="k">今売ると</span><span class="num">${fmt(E.shopValue(S, s0) * 0.8)}G</span></div></div>
    <button class="btn wide" data-a="closeshop" data-id="${id}">店をたたむ(売る)</button>`;
};
function rivalSheet(s) {
  const p = S.players[s.owner], G = E.GOODS[s.g], l = s.last, sc = me().scout === S.t;
  return head(G.icon, `${G.name}`, `${E.DISTRICTS[s.d].name}`) + `<div class="box"><div class="kv"><span class="k">持ち主</span><span>${pname(p)}<span class="ai-chip">${E.AI_KIND[p.ai] ? E.AI_KIND[p.ai].name : '人'}</span></span></div>
    <div class="kv"><span class="k">評判</span><span>${stars(s.rep)}</span></div>
    <div class="kv"><span class="k">値段</span><span>${E.PRICE_NAME[s.priceLv]}</span></div>
    <div class="kv"><span class="k">先月のお客</span><span class="num">${l ? '約 ' + fmt(Math.round(l.units / 10) * 10) + '人' : '−'}</span></div>
    ${sc && l ? `<div class="kv"><span class="k">🕵️ 先月の利益</span><span class="num ${cls(l.profit)}">${sign(l.profit)}G</span></div><div class="kv"><span class="k">🕵️ 店員</span><span>${s.staff}人</span></div>` : ''}</div>
    <div class="t3">同じ地区・同じ業種の店どうしでお客を取り合う。値段・評判・広告で差をつけよう。${sc ? '' : '「情報屋」カードを使うと、もっと詳しく分かる。'}</div>`;
}
// 市場
SHEETS.market = () => {
  const p = me();
  const rows = Object.entries(E.RES).map(([k, r]) => {
    const m = S.market[k], h = m.hist.slice(-12), mn = Math.min(...h), mx = Math.max(...h);
    const pts = h.map((v, i) => `${(i / Math.max(1, h.length - 1) * 70).toFixed(1)},${(26 - (v - mn) / Math.max(0.001, mx - mn) * 22).toFixed(1)}`).join(' ');
    const ch = h.length > 1 ? m.price / h[h.length - 2] - 1 : 0, vsb = m.price / r.base - 1;
    const pend = F.acts.filter(a => (a.type === 'buy' || a.type === 'sell') && a.res === k).reduce((a, x) => a + (x.type === 'buy' ? x.qty : -x.qty), 0);
    return `<div class="res"><span class="ri">${r.icon}</span><div class="grow"><div>${r.name} <span class="num">${m.price.toFixed(2)}G</span> <small class="${ch >= 0 ? 'down' : 'up'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch * 100).toFixed(0)}%</small></div><div class="t3">ふだん ${r.base}G · ${vsb > 0.1 ? '<span class="down">高い</span>' : vsb < -0.1 ? '<span class="up">安い</span>' : 'ふつう'} · 在庫 ${fmt(p.inv[k])}${pend ? ` <b>(${pend > 0 ? '+' : ''}${pend})</b>` : ''}</div></div>
      <svg width="72" height="28"><polyline points="${pts}" fill="none" stroke="${vsb > 0 ? '#ff4f64' : '#20b26b'}" stroke-width="2"/></svg>
      <div style="display:flex;flex-direction:column;gap:4px"><button class="btn sm pri" data-a="buy" data-v="${k}">買う 50</button><button class="btn sm" data-a="sell" data-v="${k}" ${p.inv[k] - Math.max(0, -pend) >= 50 || p.inv[k] > 0 ? '' : 'disabled'}>売る</button></div></div>`;
  }).join('');
  return head('🛒', '資源の市場', 'みんなで同じ市場を使う。たくさん買うと値段が上がる') + `<div class="box">${rows}</div>
    <div class="t3">店は毎月、材料を使う。在庫があればそれを先に使い、なければその月の値段で買う。安いときに買っておけば、高くなっても困らない。在庫には少し保管料がかかる。</div>`;
};
// 帳簿(自分の店の一覧・借金)
SHEETS.books = () => {
  const p = me(), mine = E.shopsOf(S, ME), sum = mine.reduce((a, s) => a + (s.last ? s.last.profit : 0), 0);
  return head('📒', '帳簿', `${ym(S.t)} · 純資産 ${fmt(E.netWorth(S, p))}G`) +
    `<div class="box"><div class="lbl">先月の利益(合計)</div><div class="big num ${cls(sum)}">${sign(sum)}G</div></div>
    <div class="box">${mine.length ? mine.map(s => { const G = E.GOODS[s.g]; return `<button class="shoprow" style="width:100%;text-align:left" data-a="shop" data-id="${s.id}"><span class="ic">${G.icon}</span><div class="grow"><div>${G.name} <span class="t3">${E.DISTRICTS[s.d].short}</span></div><div class="t3">お客 ${s.last ? fmt(s.last.units) : '−'}人 · ${E.PRICE_NAME[s.priceLv]} · 店員${s.staff}人</div></div><div class="num ${cls(s.last ? s.last.profit : 0)}">${s.last ? sign(s.last.profit) : '−'}</div></button>`; }).join('') : '<div class="t2">まだ店がない。町の「+」をタップして開業しよう。</div>'}</div>
    <div class="box"><div class="kv"><span class="k">現金</span><span class="num">${fmt(p.cash)}G</span></div><div class="kv"><span class="k">資源の在庫</span><span class="num">${fmt(E.resValue(S, p))}G</span></div><div class="kv"><span class="k">店の価値</span><span class="num">${fmt(mine.reduce((a, s) => a + E.shopValue(S, s), 0))}G</span></div><div class="kv"><span class="k">借金</span><span class="num ${p.debt > 0 ? 'down' : ''}">${fmt(p.debt)}G</span></div></div>
    ${p.debt > 0 ? `<button class="btn wide" data-a="repay" ${freeCash() >= Math.min(p.debt, 100) ? '' : 'disabled'}>借金を返す(${fmt(Math.min(p.debt, Math.max(0, Math.floor(freeCash() / 100) * 100)))}G)</button>` : ''}`;
};
// カード
SHEETS.card = ({ i }) => {
  const c = me().hand[i], cd = E.CARDS[c], used = pendCard();
  const mine = E.shopsOf(S, ME);
  let pick = '';
  if (cd.need === 'shop') pick = mine.length ? `<div class="lbl">どの店に?</div>${mine.map(s => `<button class="shoprow" style="width:100%;text-align:left" data-a="cardgo" data-i="${i}" data-shop="${s.id}"><span class="ic">${E.GOODS[s.g].icon}</span><div class="grow">${E.GOODS[s.g].name} <span class="t3">${E.DISTRICTS[s.d].short}</span></div><span class="btn sm pri">使う</span></button>`).join('')}` : '<div class="t2">店がないと使えない。</div>';
  else if (cd.need === 'res') pick = `<div class="lbl">どの資源を?</div>${Object.entries(E.RES).map(([k, r]) => `<button class="shoprow" style="width:100%;text-align:left" data-a="cardgo" data-i="${i}" data-res="${k}"><span class="ic">${r.icon}</span><div class="grow">${r.name} <span class="t3">今 ${S.market[k].price.toFixed(2)}G</span></div><span class="btn sm pri">予約</span></button>`).join('')}`;
  else pick = `<button class="btn pri wide" data-a="cardgo" data-i="${i}">使う</button>`;
  return head(cd.icon, cd.name, cd.cost ? `${fmt(cd.cost)}G` : '無料') + `<div class="box"><div class="t2">${esc(cd.text)}</div></div>
    ${used ? `<div class="box"><div class="t2">今月は「${E.CARDS[used.card].name}」を使う予定。カードは月に1枚まで。</div><button class="btn wide" data-a="cardcancel">予定を取り消す</button></div>` : `<div class="box">${pick}</div>`}
    <div class="t3">カードは毎月3枚配られ、1枚だけ使える。使わなかったカードは翌月入れかわる。</div>`;
};
// 予報
SHEETS.event = () => {
  const ev = E.evDef(S.evNext.id), act = S.evActive.map(a => E.evDef(a.id)).filter(e => e && e.id !== 'calm');
  return head(ev.icon, '来月の予報', ev.name) + `<div class="box"><div class="t2">${esc(ev.text)}</div>${ev.len > 1 ? `<div class="t3" style="margin-top:6px">${ev.len}か月つづく</div>` : ''}</div>
    ${act.length ? `<div class="box"><div class="lbl">いま起きていること</div>${act.map(e => `<div class="news">${e.icon} ${esc(e.name)}</div>`).join('')}</div>` : ''}
    <div class="t3">予報を見て、先に動いた人が勝つ。たとえば不作の前に材料を買っておく、祭りの前に店員を増やす。</div>`;
};
// 順位
SHEETS.ranking = () => {
  const rk = E.ranking(S);
  const W = 320, H = 140, all = S.players.flatMap(p => p.nw), mx = Math.max(...all, 1), mn = Math.min(0, ...all);
  const lines = S.players.map(p => { const n = p.nw.length; return `<polyline fill="none" stroke="${E.COLOR_HEX[p.color]}" stroke-width="${p.id === ME ? 3 : 2}" points="${p.nw.map((v, i) => `${(i / Math.max(1, S.months) * W).toFixed(1)},${(H - (v - mn) / (mx - mn) * (H - 10) - 5).toFixed(1)}`).join(' ')}"/>`; }).join('');
  return head('🏆', '順位', `純資産(現金+店+在庫−借金)で競う · のこり${S.months - S.t}か月`) +
    `<div class="box">${rk.map((x, i) => `<div class="rk"><span class="pos" style="background:${E.COLOR_HEX[x.p.color]}">${i + 1}</span><div class="nm">${esc(x.p.name)}${x.p.id === ME ? ' <span class="ai-chip">あなた</span>' : `<span class="ai-chip">${E.AI_KIND[x.p.ai] ? E.AI_KIND[x.p.ai].name : ''}</span>`}<small>店 ${E.shopsOf(S, x.p.id).length} · 現金 ${fmt(x.p.cash)}G</small></div><div class="num" style="font-size:17px">${fmt(x.nw)}G</div></div>`).join('')}</div>
    <div class="box"><div class="lbl">純資産の動き</div><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${lines}</svg></div>`;
};
// 月の結果
SHEETS.result = ({ r }) => {
  const mine = r.mine, sum = mine.reduce((a, x) => a + x.profit, 0);
  return `<div class="mhead"><div class="mt">${ym(S.t - 1)}の結果</div><div class="mv num ${cls(sum)}" id="cntup">${sign(0)}G</div><div class="t3">店の利益の合計 · 現金 ${fmt(me().cash)}G</div></div>
    ${mine.length ? `<div class="box">${mine.map(x => `<div class="shoprow"><span class="ic">${x.icon}</span><div class="grow"><div>${x.name} <span class="t3">${x.dist}</span></div><div class="t3">お客 ${fmt(x.units)}人${x.lost > 3 ? ` · <span class="down">${fmt(x.lost)}人を逃した</span>` : ''}</div></div><div class="num ${cls(x.profit)}">${sign(x.profit)}</div></div>`).join('')}</div>` : ''}
    <div class="box"><div class="lbl">順位</div>${r.rank.map((x, i) => `<div class="rk"><span class="pos" style="background:${E.COLOR_HEX[x.color]}">${i + 1}</span><div class="nm">${esc(x.name)}${x.move ? `<span class="rankmove ${x.move > 0 ? 'up' : 'down'}">${x.move > 0 ? '▲' : '▼'}${Math.abs(x.move)}</span>` : ''}</div><div class="num">${fmt(x.nw)}G</div></div>`).join('')}</div>
    ${r.news.length ? `<div class="box"><div class="lbl">町のうわさ</div>${r.news.map(n => `<div class="news">${n}</div>`).join('')}</div>` : ''}
    ${r.tip ? `<div class="box" style="background:linear-gradient(135deg,#fffaf0,#fff)"><div class="lbl">💡 ひとこと</div><div class="t2">${r.tip}</div></div>` : ''}
    <button class="btn warm wide" data-a="close">${S.over ? '最終結果へ' : '次の月の作戦を立てる'}</button>`;
};
SHEETS.final = () => {
  const rk = E.ranking(S), pos = rk.findIndex(x => x.p.id === ME) + 1;
  return `<div class="hero box"><div style="font-size:54px">${pos === 1 ? '👑' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '🌱'}</div><div class="t3">${S.months / 12}年の商売が終わった</div><div class="big">${pos}位</div><div class="t2">${pos === 1 ? '町いちばんの商会になった!' : pos === 2 ? 'あと一歩!' : 'くやしい…次こそ'}</div></div>
    <div class="box">${rk.map((x, i) => `<div class="rk"><span class="pos" style="background:${E.COLOR_HEX[x.p.color]}">${i + 1}</span><div class="nm">${esc(x.p.name)}<small>店 ${E.shopsOf(S, x.p.id).length}</small></div><div class="num" style="font-size:17px">${fmt(x.nw)}G</div></div>`).join('')}</div>
    <button class="btn warm wide" data-a="newgame">もう一度あそぶ</button>`;
};
SHEETS.menu = () => head('⚙️', 'メニュー', '') + `<div class="box"><button class="btn wide" data-a="howto" style="margin-bottom:8px">遊び方</button><button class="btn wide" data-a="credits" style="margin-bottom:8px">クレジット</button><button class="btn wide" data-a="restart">最初からやり直す</button></div>`;
SHEETS.howto = () => head('📖', '遊び方', '5年で町いちばんの商会に') + `<div class="box t2">
  ① 町の<b>「+」</b>をタップして店を開く(4つまで)。同じ地区・同じ業種の店どうしでお客を取り合う。<br>
  ② 店をタップして<b>値段・店員・広告</b>を決める。🔮で来月の利益の見積もりが出る。<br>
  ③ <b>カード</b>は毎月3枚配られ、1枚使える。<br>
  ④ <b>市場</b>で材料を安いときに買っておくと、値上がりしても困らない。ライバルが買い占めると値段が上がる。<br>
  ⑤ <b>予報</b>を見て先回りする。<br>
  ⑥「次の月へ」で、決めたことが全部いっしょに実行される。60か月後の純資産で勝負!</div>`;
SHEETS.credits = () => head('🎨', 'クレジット', '') + `<div class="box t2">3D モデル: KayKit — Kay Lousberg(CC0)<br>Quaternius(CC0)<br>3D 表示: three.js(MIT)<br>フォント: M PLUS Rounded 1c(SIL OFL)</div>`;

// ── 操作
const H = {
  close: () => { const was = F.sheet; closeSheet(); if (was === 'result' && S.over) setTimeout(() => openSheet('final'), 350); if (was === 'result') afterResult(); },
  menu: () => openSheet('menu'), howto: () => openSheet('howto'), credits: () => openSheet('credits'),
  ranking: () => openSheet('ranking'), market: () => openSheet('market'), books: () => openSheet('books'), event: () => openSheet('event'),
  card: (d) => openSheet('card', { i: +d.i }),
  cardgo: (d) => {
    const i = +d.i, c = me().hand[i], cd = E.CARDS[c];
    if (freeCash() < cd.cost) return toast('お金が足りない');
    F.acts = F.acts.filter(a => a.type !== 'card');
    F.acts.push({ type: 'card', card: c, idx: i, shop: d.shop ? +d.shop : undefined, res: d.res || undefined });
    sfx('card'); closeSheet(); toast(`「${cd.name}」を月末に使う`); save(); render();
  },
  cardcancel: () => { F.acts = F.acts.filter(a => a.type !== 'card'); save(); render(); closeSheet(); },
  shop: (d) => { const s = S.shops.find(x => x.id === +d.id); if (s) { board.focus(s.lot); openSheet('shop', { id: s.id }); } },
  pickgood: (d) => { F.args.g = d.v; sfx('tap'); renderSheet(); },
  doopen: (d) => { const lot = +d.v; F.acts = F.acts.filter(a => !(a.type === 'open' && a.lot === lot)); F.acts.push({ type: 'open', lot, g: F.args.g, priceLv: 2, staff: 2 }); sfx('build'); save(); closeSheet(); render(); board.preview(lot, F.args.g, S.players[ME].color); toast('月末に建つ!'); },
  cancelopen: (d) => { const lot = +d.v; F.acts = F.acts.filter(a => !(a.type === 'open' && a.lot === lot)); board.preview(lot, null); save(); closeSheet(); render(); },
  setp: (d) => { const s = S.shops.find(x => x.id === +d.id); setPending(s.id, { priceLv: +d.v, staff: shopView(s).staff, ads: shopView(s).ads }); sfx('tap'); render(); },
  sets: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s); setPending(s.id, { priceLv: v.priceLv, staff: Math.max(1, Math.min(5, v.staff + +d.v)), ads: v.ads }); sfx('tap'); render(); },
  seta: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s); setPending(s.id, { priceLv: v.priceLv, staff: v.staff, ads: +d.v }); sfx('tap'); render(); },
  closeshop: (d) => { if (!confirm('この店をたたむ?(月末に売れる)')) return; F.acts = F.acts.filter(a => !(a.type === 'set' && a.shop === +d.id)); F.acts.push({ type: 'close', shop: +d.id }); save(); closeSheet(); render(); toast('月末に店をたたむ'); },
  buy: (d) => { const q = 50, c = E.quote(S, d.v, q); if (freeCash() < c) return toast('お金が足りない'); F.acts.push({ type: 'buy', res: d.v, qty: q }); sfx('coin'); save(); render(); },
  sell: (d) => { const have = me().inv[d.v] - F.acts.filter(a => a.type === 'sell' && a.res === d.v).reduce((a, x) => a + x.qty, 0); const q = Math.min(50, have); if (q <= 0) return toast('在庫がない'); F.acts.push({ type: 'sell', res: d.v, qty: q }); sfx('coin'); save(); render(); },
  repay: () => { const amt = Math.min(me().debt, Math.floor(freeCash() / 100) * 100); if (amt <= 0) return; F.acts.push({ type: 'repay', amt }); save(); render(); toast(`月末に ${fmt(amt)}G 返す`); },
  next: () => nextMonth(),
  newgame: () => { closeSheet(); startNew(); },
  restart: () => { if (confirm('最初からやり直す?')) { closeSheet(); startNew(); } },
  start: () => { $('.title') && $('.title').remove(); unlockAudio(); sfx('open'); if (!S.t && !F.acts.length) setTimeout(() => openSheet('howto'), 400); },
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-a]'); if (!t) return;
  const f = H[t.dataset.a]; if (f) { unlockAudio(); f(t.dataset); }
});

// ── 月を進める
async function nextMonth() {
  if (F.busy || S.over) return;
  F.busy = true; closeSheet();
  const before = E.ranking(S).map(x => x.p.id);
  const acts = F.acts.map(({ idx, ...a }) => a);
  const pre = new Set(S.shops.map(s => s.id));
  const { fx, errors } = E.step(S, { [ME]: acts });
  F.acts = []; save();
  for (const er of errors.filter(x => x.pid === ME)) toast(er.e);
  sfx('whoosh');
  board.clearPreview();
  await board.sync(S, ME);
  render();
  // 客の動きと数字のポップ
  const sales = fx.filter(f => f.kind === 'sales');
  board.home();
  await wait(500);
  board.playMonth(S, sales);
  await wait(1500);
  for (const f of sales) { const pos = board.screenOf(f.shop); if (pos) popAt(pos, f.profit, S.players[f.pid].color); }
  if (sales.some(f => f.pid === ME && f.profit > 0)) sfx('coin');
  await wait(1300);
  // 結果
  const after = E.ranking(S);
  const r = {
    mine: E.shopsOf(S, ME).filter(s => s.last).map(s => ({ icon: E.GOODS[s.g].icon, name: E.GOODS[s.g].name, dist: E.DISTRICTS[s.d].short, units: s.last.units, lost: Math.max(0, s.last.want - s.last.units), profit: s.last.profit })),
    rank: after.map((x, i) => ({ name: x.p.name, color: x.p.color, nw: x.nw, move: before.indexOf(x.p.id) - i })),
    news: newsOf(fx, pre), tip: tipOf(),
  };
  openSheet('result', { r });
  countUp($('#cntup'), r.mine.reduce((a, x) => a + x.profit, 0));
  const pos = after.findIndex(x => x.p.id === ME);
  if (pos < before.indexOf(ME)) { sfx('rankup'); confetti(); }
  F.busy = false;
}
function afterResult() { render(); }
function newsOf(fx, pre) {
  const out = [];
  for (const f of fx) {
    const p = S.players[f.pid]; if (f.pid === ME) continue;
    if (f.kind === 'open') { const s = S.shops.find(x => x.id === f.shop); if (s) out.push(`${pname(p)} が ${E.DISTRICTS[s.d].short}に<b>${E.GOODS[s.g].name}</b>を開いた`); }
    if (f.kind === 'close') out.push(`${pname(p)} が店をひとつたたんだ`);
    if (f.kind === 'buy' && f.qty >= 60) out.push(`${pname(p)} が<b>${E.RES[f.res].name}</b>を ${f.qty} 買い込んだ(値上がりに注意)`);
    if (f.kind === 'card' && ['craft', 'remodel', 'shout'].includes(f.card)) out.push(`${pname(p)} が「${E.CARDS[f.card].name}」を使った`);
    if (f.kind === 'bailout') out.push(`${pname(p)} はお金が尽きて銀行から借りた`);
  }
  for (const f of fx) if (f.kind === 'bailout' && f.pid === ME) out.unshift(`<span class="down">⚠️ お金が尽きたので銀行が ${fmt(f.amt)}G を貸した(1割の手数料つき)</span>`);
  for (const f of fx) if (f.kind === 'tax' && f.pid === ME && f.amt > 0) out.unshift(`📜 臨時の税で ${fmt(f.amt)}G 払った`);
  const ev = S.ev && E.evDef(S.ev.id); if (ev && ev.id !== 'calm') out.unshift(`${ev.icon} ${esc(ev.name)}が始まった`);
  return out.slice(0, 6);
}
function tipOf() {
  const mine = E.shopsOf(S, ME).filter(s => s.last);
  if (!mine.length) return S.t <= 2 ? '町の「+」をタップして、最初の店を開こう。住宅街は家賃が安く、パン屋は数が出る。' : '店がないと稼げない。まずは1店!';
  const busy = mine.find(s => s.last.want > s.last.cap * 1.1); if (busy) return `${E.GOODS[busy.g].name}(${E.DISTRICTS[busy.d].short})はお客を ${fmt(busy.last.want - busy.last.cap)}人 逃している。店員を増やすか、値上げしてもよさそう。`;
  const idle = mine.find(s => s.last.cap > s.last.want * 1.6 && s.staff > 1); if (idle) return `${E.GOODS[idle.g].name}(${E.DISTRICTS[idle.d].short})は店員が余っている。1人減らすと人件費 ${E.WAGE}G 浮く。`;
  const loss = mine.find(s => s.last.profit < 0); if (loss) return `${E.GOODS[loss.g].name}(${E.DISTRICTS[loss.d].short})が赤字。店をタップして🔮の見積もりを見ながら値段・人数を調整しよう。`;
  const ev = S.evNext && E.evDef(S.evNext.id); if (ev && ev.res) { const k = Object.keys(ev.res)[0]; return ev.res[k] > 1 ? `来月は${E.RES[k].name}が値上がりしそう。今のうちに市場で買っておくと得かも。` : `来月は${E.RES[k].name}が値下がりしそう。買うのは来月まで待とう。`; }
  if (me().cash > 700 && mine.length < E.MAX_SHOPS) return 'お金に余裕がある。2店目・3店目を出すと稼ぎが増える。';
  return '';
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function popAt(pos, v, color) { const d = document.createElement('div'); d.className = 'pop ' + (v >= 0 ? 'g' : 'r'); d.style.left = pos.x + 'px'; d.style.top = pos.y + 'px'; d.textContent = sign(v) + 'G'; if (color) d.style.outline = `3px solid ${E.COLOR_HEX[color]}`; $('#pops').appendChild(d); setTimeout(() => d.remove(), 2300); }
function countUp(el, v) { if (!el) return; const t0 = performance.now(); const tick = (t) => { const k = Math.min(1, (t - t0) / 900); el.textContent = sign(v * (1 - Math.pow(1 - k, 3))) + 'G'; if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
function confetti() { const c = ['#4f8cff', '#ff5d6c', '#ffc53d', '#3ccf8e', '#c79bff']; for (let i = 0; i < 40; i++) { const d = document.createElement('div'); d.className = 'confetti'; d.style.left = Math.random() * 100 + 'vw'; d.style.background = c[i % 5]; d.style.animationDuration = 1.8 + Math.random() * 1.4 + 's'; d.style.animationDelay = Math.random() * 0.4 + 's'; document.body.appendChild(d); setTimeout(() => d.remove(), 3800); } }
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

// ── 地区の名前と自分の店の印(毎フレーム位置を合わせる)
function labels() {
  const wrap = $('#labels');
  const centers = { plaza: [0, 0], port: [3, -0.5], hill: [-3, 1] };
  wrap.innerHTML = Object.entries(centers).map(([k]) => `<div class="dlabel" data-d="${k}">${E.DISTRICTS[k].name}<small>家賃${E.DISTRICTS[k].rent}</small></div>`).join('');
  board.onFrame = () => {
    for (const el of wrap.children) {
      const [q, r] = centers[el.dataset.d]; const v = hexPos(q, r); v.y = 0.1;
      const p = v.project(board.cam); const rc = board.R.domElement.getBoundingClientRect();
      el.style.left = (rc.left + (p.x + 1) / 2 * rc.width) + 'px'; el.style.top = (rc.top + (1 - p.y) / 2 * rc.height) + 'px';
    }
  };
}

// ── 始める
async function startNew() {
  const seed = Math.floor(Math.random() * 1e9);
  S = E.newGame({ seed }); F.acts = []; save();
  if (board) { await board.reset(); await board.sync(S, ME); }
  render();
  setTimeout(() => openSheet('howto'), 300);
}
async function boot() {
  const bar = $('.ld-bar i');
  bar.style.width = '20%';
  board = new Board($('#stage'));
  board.onTap = ({ shop, lot }) => {
    if (F.busy) return;
    if (shop != null) { const s = S.shops.find(x => x.id === shop); if (s) { board.focus(s.lot); openSheet('shop', { id: shop }); sfx('tap'); } return; }
    if (lot != null && !S.over) { board.highlightLot(lot); const p = pendOpen(lot); openSheet('lot', { lot, g: p ? p.g : null }); sfx('tap'); }
  };
  await board.build(); bar.style.width = '80%';
  const sv = loadSave();
  if (sv) { S = sv.S; F.acts = sv.acts || []; } else { S = E.newGame({ seed: Math.floor(Math.random() * 1e9) }); }
  await board.sync(S, ME);
  for (const a of F.acts) if (a.type === 'open') board.preview(a.lot, a.g, me().color);
  labels(); render(); bar.style.width = '100%';
  setTimeout(() => { $('#loading').classList.add('off'); }, 250);
  const tl = document.createElement('div'); tl.className = 'title';
  tl.innerHTML = `<div class="tl">CAPITAL</div><div class="ts">商会バトル</div><div class="tb"><button class="btn warm" data-a="start">${sv && S.t ? `つづきから(${ym(S.t)})` : 'はじめる'}</button>${sv && S.t ? '<button class="btn ghost" data-a="newgame">新しく始める</button>' : ''}</div>`;
  document.body.appendChild(tl);
  if (S.over) setTimeout(() => openSheet('final'), 600);
  window.__game = { get S() { return S; }, F, E, board, H };
}
boot();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
