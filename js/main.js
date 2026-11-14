// 画面の操作(一人で AI の商会と戦う)
import * as E from './engine.js';
import { Board, hexPos } from './board.js';
import { sfx, unlockAudio, bgm, haptic, audioPref, setAudioPref } from './sfx.js';
import { NET, joinRoom, leaveRoom, send as netSend, newCode } from './net.js';
import { ICON3D, ICONGI, GI_COL } from './icons.js';

const $ = (s) => document.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString('ja-JP');
const sign = (n) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ym = (t) => `${Math.floor(t / 12) + 1}年目 ${t % 12 + 1}月`;
const cls = (n) => (n >= 0 ? 'up' : 'down');
let ME = 0;
// 絵文字の代わりに、ゲームの3Dモデルから作った絵を使う
// ── 絵文字は使わない: 画面に出る文字の中の絵文字を、3Dの絵かアイコンのバッジに置きかえる(知らない絵文字は消す)
const norm = (e) => e.replace(/️/g, '');
const IMAP = {}; for (const [e, k] of Object.entries(ICON3D)) IMAP[norm(e)] = { k3: k }; for (const [e, [n, c]] of Object.entries(ICONGI)) if (!IMAP[norm(e)]) IMAP[norm(e)] = { gi: n, c };
const EMO_RE = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?|[\u{1F3FB}-\u{1F3FF}])*/gu;
const EMO_T = /\p{Extended_Pictographic}/u;
const KEEP = new Set(['✔', '↩', '↗', '↘', '™', '©', '®']);
const hasRealEmoji = (t) => { EMO_RE.lastIndex = 0; let m; while ((m = EMO_RE.exec(t))) if (!KEEP.has(norm(m[0]))) { EMO_RE.lastIndex = 0; return true; } EMO_RE.lastIndex = 0; return false; };
const ico = (k, cls = '') => `<img class="em3 ${cls}" src="assets/icons/${k}.png" alt="" draggable="false">`;
function iconEl(e) {
  const m = IMAP[norm(e)];
  if (!m) return null;
  if (m.k3) { const i = document.createElement('img'); i.className = 'em3'; i.src = `assets/icons/${m.k3}.png`; i.alt = ''; i.draggable = false; return i; }
  const b = document.createElement('span'), c = GI_COL[m.c] || GI_COL.blue; b.className = 'gib'; b.style.setProperty('--g1', c[0]); b.style.setProperty('--g2', c[1]);
  const i = document.createElement('img'); i.src = `assets/gi/${m.gi}.svg`; i.alt = ''; i.draggable = false; b.appendChild(i); return b;
}
function deEmoji(root) {
  if (!root || root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.nodeValue && EMO_T.test(n.nodeValue) && hasRealEmoji(n.nodeValue) && !(n.parentElement && n.parentElement.closest('.stb,.stamp,.keepemo,script,style,textarea,input')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) {
    const t = n.nodeValue, f = document.createDocumentFragment(); let last = 0; EMO_RE.lastIndex = 0; let m;
    while ((m = EMO_RE.exec(t))) { if (KEEP.has(norm(m[0]))) continue; f.appendChild(document.createTextNode(t.slice(last, m.index))); const el = iconEl(m[0]); if (el) f.appendChild(el); last = m.index + m[0].length; }
    f.appendChild(document.createTextNode(t.slice(last))); n.parentNode.replaceChild(f, n);
  }
}
new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') { const p = m.target.parentElement; if (p) deEmoji(p); } else for (const n of m.addedNodes) { if (n.nodeType === 3) { if (n.parentElement) deEmoji(n.parentElement); } else deEmoji(n); } } }).observe(document.body, { childList: true, subtree: true, characterData: true });
const pix = (html) => html;
const itemIco = (k) => ico(k);
const CARD_TYPE = { poach: ['atk', '攻撃'], headhunt: ['atk', '攻撃'], dump: ['atk', '攻撃'], shout: ['shop', 'お店'], sale: ['shop', 'お店'], craft: ['shop', 'お店'], helper: ['shop', 'お店'], remodel: ['shop', 'お店'], scout: ['money', '情報'], contract: ['money', 'お金'], loan: ['money', 'お金'] };
const gd = (s) => s.g === 'work' ? { icon: '🏭', name: `工房(${E.PROC[E.RES[s.res].proc].name})`, short: '工房' } : E.GOODS[s.g];
const wx = (k) => E.WEATHER[k] || E.WEATHER.cloudy;

let S = null, board = null;
const F = { acts: [], sheet: null, args: null, busy: false, cardSel: null };
const SAVE = 'capital-battle-v3';
const REC = 'capital-records';
const records = () => { try { return JSON.parse(localStorage.getItem(REC) || '{}'); } catch (e) { return {}; } };
const setRecord = (stage, pos, nw) => { try { const r = records(); const o = r[stage] || {}; const best = !o.pos || pos < o.pos || (pos === o.pos && nw > (o.nw || 0)); r[stage] = { pos: best ? pos : o.pos, nw: best ? nw : o.nw, plays: (o.plays || 0) + 1 }; localStorage.setItem(REC, JSON.stringify(r)); } catch (e) { } };
const save = () => { if (F.mp) return; try { localStorage.setItem(SAVE, JSON.stringify({ S, acts: F.acts })); } catch (e) { } };
const loadSave = () => { try { const j = JSON.parse(localStorage.getItem(SAVE) || 'null'); return j && j.S && j.S.v === 10 ? j : null; } catch (e) { return null; } };

// ── 決断(月末にまとめて実行される)
const me = () => S.players[ME];
function pendCost() {
  let c = 0;
  for (const a of F.acts) {
    if (a.type === 'open') c += E.openCost(E.LOTS[a.lot].d, a.g);
    if (a.type === 'buy') c += E.quote(S, a.res, a.qty);
    if (a.type === 'card') c += E.cardDef(a.card).cost;
    if (a.type === 'repay') c += a.amt;
    if (a.type === 'buyshop') c += a.price;
    if (a.type === 'bridge') c -= a.amt;
    if (a.type === 'factor') { const r = (S.recv || []).find(x => x.id === a.id); if (r) c -= Math.round(r.amt * (1 - E.FACTOR_FEE)); }
    if (a.type === 'deal') { const o = (me().offers || []).find(x => x.id === a.id); if (o && o.kind === 'sell') c += o.qty * o.price; if (o && o.kind === 'buy') c -= o.qty * o.price; if (o && o.kind === 'shopbid') c -= o.price; }
    if (a.type === 'route') { const s = S.shops.find(x => x.id === a.shop); const lv = s && s.route ? s.route.lv + 1 : 1; c += E.ROUTES[a.k].cost[lv - 1]; }
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
  if (a.priceLv === s.priceLv && a.staff === s.staff && a.ads === s.ads && (a.autoSell == null || a.autoSell === s.autoSell) && (a.useProc == null || a.useProc === s.useProc) && (a.feat === undefined || (a.feat === s.feat && a.featQty === s.featQty))) F.acts = F.acts.filter(x => x !== a);
  save();
}

// ── 上の情報
function hud() {
  const p = me(), rk = E.ranking(S), pos = rk.findIndex(x => x.p.id === ME) + 1;
  const prog = S.t / S.months, C = 2 * Math.PI * 12;
  const pc = pendCost();
  $('#hud').innerHTML = `
    <button class="pill month" data-a="menu"><svg class="ring" viewBox="0 0 30 30"><circle cx="15" cy="15" r="12" fill="none" stroke="#e3e8f5" stroke-width="4"/><circle cx="15" cy="15" r="12" fill="none" stroke="#3a7bd5" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C * prog} ${C}" transform="rotate(-90 15 15)"/></svg><span><div class="m1">${S.over ? '終わり' : `${Math.floor(S.t / 12) + 1}年目 ${S.t % 12 + 1}月`}</div><div class="m2">${S.over ? '最終結果' : `ターン <b>${S.t + 1}</b><small>/${S.months}</small>`}</div></span></button>
    <div class="pill cash">${ico('coin', 'coin3')}<span class="num" id="cashv">${fmt(freeCash())}</span>${pc ? `<span class="pend">${pc > 0 ? '使う予定' : '入る予定'} ${fmt(Math.abs(pc))}</span>` : ''}</div>
    <button class="pill rank" data-a="ranking"><b class="num">${pos}</b>位 <span class="rt">${E.RANKS[E.rankOf(E.netWorth(S, p))][2]}</span></button>`;
}
// ── 下のドック
function dock() {
  if (S.over) { $('#dock').innerHTML = `<div class="actions"><button class="abtn" data-a="books"><span class="ai">📒</span>帳簿</button><button class="abtn" data-a="ranking"><span class="ai">👑</span>順位</button><button class="abtn go" data-a="showfinal">🏆 最終結果</button></div>`; return; }
  if (F.build) { $('#dock').innerHTML = buildTray(); return; }
  const ev = S.evNext && E.evDef(S.evNext.id), p = me(), used = pendCard();
  const n = F.acts.length;
  $('#dock').innerHTML = `
    <div class="row" style="justify-content:center;gap:6px"><button class="evchip" data-a="weather"><span class="ei">${wx(me().scout === S.t ? S.wNext : S.wFore).icon}</span><span><span class="et">天気予報${me().scout === S.t ? '(確実)' : ''}</span><br>${wx(me().scout === S.t ? S.wNext : S.wFore).name}</span></button>${ev ? `<button class="evchip" data-a="event"><span class="ei">${ev.icon}</span><span><span class="et">来月の予報${E.marketDay({ t: S.t }) ? ' · 🛍️市の日' : ''}</span><br>${esc(ev.name)}</span></button>` : ''}${S.t >= S.months - 18 ? `<button class="evchip grand" data-a="grand"><span class="ei">🏰</span><span><span class="et">${E.finalYear(S) ? '大祭の年' : '大祭まで'}</span><br>${E.finalYear(S) ? `のこり${S.months - S.t}か月` : `あと${S.months - 12 - S.t}か月`}</span></button>` : ''}</div>
    ${F.mp ? `<div class="row" style="justify-content:center;gap:6px"><button class="evchip" data-a="stamps">💬 スタンプ</button><button class="evchip" data-a="online">🌐 ${humansOf().filter(x => x.cid === NET.cid || NET.online(x.cid)).length}/${humansOf().length}人</button></div>${F.stampOpen ? `<div class="stray">${STAMPS.map(x => `<button class="stb" data-a="stamp" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}` : ''}
    ${!S.over && freeCash() < nextFixed() ? `<button class="evchip cashwarn" data-a="books">⚠️ 来月の支払い 約${fmt(Math.round(nextFixed()))}G に現金が足りない</button>` : ''}
    ${F.alerts && F.alerts.length && !S.over ? `<button class="evchip alertchip" data-a="alerts">⚠️ 判断が必要 ${F.alerts.length}件</button>` : ''}
    <div class="hand">${p.hand.map((c, i) => { const cd = E.cardDef(c); const isUsed = used && used.card === c && used.idx === i; const ct = CARD_TYPE[cd.base] || ['shop', 'お店'];
      return `<button class="card ct-${ct[0]} ${F.handT !== S.t ? 'fresh' : ''} ${isUsed ? 'sel' : used ? 'used' : ''}" data-a="card" data-i="${i}"><span class="ctag">${ct[1]}</span>${isUsed ? '<span class="tag">使う</span>' : ''}<div class="ci">${cd.spec ? '🧑‍🍳' : cd.icon}${cd.spec ? `<span class="cspec">${cd.icon}</span>` : ''}</div><div class="cn">${cd.name}</div><div class="cc">${cd.cost ? fmt(cd.cost) + 'G' : '無料'}</div></button>`; }).join('')}</div>
    <div class="actions">
      <button class="abtn build" data-a="build"><span class="ai">🔨</span>建てる</button>
      <button class="abtn" data-a="market"><span class="ai">🛒</span>市場${(p.offers || []).length ? `<span class="badge">${p.offers.length}</span>` : ''}</button>
      <button class="abtn" data-a="books"><span class="ai">📒</span>帳簿</button>
      <button class="abtn" data-a="townhall"><span class="ai">🏛️</span>町${(S.vote && S.vote.t === S.t && S.vote.ballots[ME] == null) || (S.quests || []).some(q => q.taker == null && !q.done) ? '<span class="badge">!</span>' : ''}</button>
      <button class="abtn go" data-a="next">次の月へ${n ? `<small>決めたこと ${n}</small>` : ''}</button>
    </div>`;
}
// 次に押すべきボタン(はじめの「やること」→ その後は状況から)
function hintTarget() {
  if (!S || S.over || F.build || F.busy || F.sheet) return null;
  const st = qState(), cur = !st.all && QUESTS.find(q => !st[q.id]);
  if (cur) return { open: 'build', next: 'next', card: 'card', market: 'market', rank: 'rivals', two: 'build', set: 'myshop' }[cur.id] || null;
  if (F.alerts && F.alerts.length && !F.alertsSeen) return 'alerts';
  const slots = E.MAX_SHOPS - E.shopsOf(S, ME).length - F.acts.filter(a => a.type === 'open').length;
  if (slots > 0 && freeCash() > 700 && !F.acts.some(a => a.type === 'open')) return 'build';
  return 'next';
}
function applyHint() {
  document.querySelectorAll('.hint').forEach(e => e.classList.remove('hint'));
  const h = hintTarget(); if (!h) return;
  const el = h === 'build' ? $('#dock [data-a=build]') : h === 'next' ? $('#dock [data-a=next]') : h === 'market' ? $('#dock [data-a=market]') : h === 'card' ? $('#dock .hand') : h === 'alerts' ? $('#dock [data-a=alerts]') : h === 'rivals' ? $('#rivals') : null;
  if (el) el.classList.add('hint');
}
function render() { hud(); $('#hud').innerHTML = pix($('#hud').innerHTML); cashRoll(); dock(); $('#dock').innerHTML = pix($('#dock').innerHTML); rivalsBar(); applyHint(); if (F.mp) netBadge(); board.setPeddler(!!(S.peddler && S.peddler.left > 0)); F.handT = S.t; updateLabels(); if (F.sheet) renderSheet(); pickBgm(); }
// 場面に合わせて曲を選ぶ: 大祭の年・雨・町ごとの曲を数か月ごとに入れ替え
const STAGE_BGM = { rose: ['asa', 'kenso'], marina: ['minato', 'asa'], snow: ['yuki', 'kenso'], capital: ['kenso', 'asa'] };
function pickBgm() {
  if (!S || F.bgmLock) return;
  let k;
  if (S.over) k = 'matsuri';
  else if (S.t && E.finalYear(S)) k = S.months - S.t <= 3 ? 'matsuri' : 'ouji';
  else if (S.t && (S.w === 'rain' || S.w === 'storm')) k = 'ame';
  else { const L = STAGE_BGM[S.stage] || STAGE_BGM.rose; k = L[Math.floor(S.t / 3) % L.length]; }
  bgm.play(k);
}

// ── シート
const SHEETS = {};
function openSheet(kind, args = {}) { const tu = document.getElementById('tut'); if (tu) tu.remove(); F.sheet = kind; F.args = args; renderSheet(); $('#sheet').scrollTop = 0; $('#sheet').classList.toggle('half', kind === 'stages'); $('#sheet').className = $('#sheet').className.replace(/\b(k-\S+|anim)\b/g, '').trim() + ' anim k-' + kind; clearTimeout(F.animT); F.animT = setTimeout(() => $('#sheet').classList.remove('anim'), 1000); $('#sheetwrap').classList.add('on'); sfx('open'); }
function closeSheet() { F.sheet = null; $('#sheetwrap').classList.remove('on'); board && board.highlightLot(-1); }
function renderSheet() { const f = SHEETS[F.sheet]; if (!f) return; $('#sheet').innerHTML = '<div class="grab"></div>' + pix(f(F.args)); foldTips($('#sheet')); }
// 長い説明は「？ くわしく」にたたむ(画面は大事なことだけ)
function foldTips(root) {
  for (const el of root.querySelectorAll('.t3, .tip-long')) {
    if (el.closest('details, .keep, .mfacts, .bfacts, .nwp, button')) continue;
    if ((el.textContent || '').trim().length < 48) continue;
    const d = document.createElement('details'); d.className = 'tipd'; const sm = document.createElement('summary'); sm.textContent = '？ くわしく'; d.appendChild(sm);
    el.parentNode.insertBefore(d, el); d.appendChild(el);
  }
}
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
  }).join('') + `<button class="good ${sel === 'work' ? 'on' : ''}" data-a="pickgood" data-v="work"><div class="gi">🏭</div><div class="gn">工房</div><div class="gs">開業 ${fmt(E.openCost(L.d, 'work'))}G<br>原料を加工品にして売る</div></button>`;
  const mine = E.shopsOf(S, ME).length + F.acts.filter(a => a.type === 'open').length - (pend ? 1 : 0);
  let foot = '';
  if (pend) foot = `<div class="t2" style="margin:8px 0">ここに<b>${E.GOODS[pend.g].name}</b>を開く予定。月末に建つ。</div><button class="btn wide" data-a="cancelopen" data-v="${lot}">開業の予定をやめる</button>`;
  else if (mine >= E.MAX_SHOPS) foot = `<div class="t2">お店は${E.MAX_SHOPS}つまで。</div>`;
  else if (sel === 'work') {
    const c = E.openCost(L.d, 'work'), ok = freeCash() >= c, rs = F.args.res || null;
    foot = `<div class="lbl">何を加工する?</div><div class="goods">${Object.entries(E.RES).map(([k, R]) => { const P = E.PROC[R.proc], m = S.market[P.from ? R.proc : k]; const mg = S.market[R.proc].price * (1 - E.SPREAD) - S.market[k].price * (1 + E.SPREAD); return `<button class="good ${rs === k ? 'on' : ''}" data-a="pickres" data-v="${k}"><div class="gi" style="font-size:22px">${R.icon}→${P.icon}</div><div class="gn" style="font-size:13.5px">${P.name}</div><div class="gs">1個 <b class="${cls(mg)}">${mg >= 0 ? '+' : ''}${mg.toFixed(2)}G</b> · 1人 月${P.rate}個</div></button>`; }).join('')}</div>
      <div class="est"><span class="ev">💡</span><div class="t2" style="margin:0">工房は客を相手にしない。原料を市場で買い、加工品を市場で売る(または自分の店で使う)。家賃 ${D.rent}G・職人 2人 ${E.WAGE * 2}G。</div></div>
      <button class="btn warm wide" style="margin-top:10px" data-a="doopen" data-v="${lot}" ${ok && rs ? '' : 'disabled'}>${!rs ? '加工するものを選んで' : ok ? `${fmt(c)}G で工房を建てる` : 'お金が足りない'}</button>`;
  }
  else if (sel) { const c = E.openCost(L.d, sel), ok = freeCash() >= c; foot = `<div class="est"><span class="ev">💡</span><div class="t2" style="margin:0">家賃 毎月 <b>${D.rent}G</b> + 店員 2人 <b>${E.WAGE * 2}G</b>。<br>パンは安くて数が出る・道具は高くて数が少ない。</div></div><button class="btn warm wide" style="margin-top:10px" data-a="doopen" data-v="${lot}" ${ok ? '' : 'disabled'}>${ok ? `${fmt(c)}G で開業する` : 'お金が足りない'}</button>`; }
  else foot = '<div class="t3" style="text-align:center;margin-top:6px">何の店を開く?</div>';
  const nb = E.NEIGHBORS[lot].map(l => E.shopAt(S, l)).filter(Boolean);
  const adj = nb.length ? `<div class="box"><div class="lbl">お隣さん</div>${nb.map(o => { const op = S.players[o.owner]; return `<div class="news">${pname(op)} の${gd(o).icon}${gd(o).name}${o.owner === ME ? (sel && sel !== o.g ? ' <span class="up">→ 別業種なので商店街ボーナス(客寄せ +8%)</span>' : '') : (sel === o.g ? ' <span class="down">→ 真横で同じ業種。安いほうに客が流れる</span>' : '')}</div>`; }).join('')}</div>` : '';
  return head('🏗️', D.name, `${D.desc}${L.road ? ' · 🛣️大通り沿い(客 +12%)' : ''}`) + districtInsight(L.d) + `<div class="lbl" style="margin:4px 2px 8px">何の店を開く?</div><div class="goods">${goods}</div>${adj ? '<div style="height:10px"></div>' + adj : ''}<div style="margin-top:10px">${foot}</div>`;
};
const SRC = { walk: ['🚶', '通りがかり・住民'], road: ['🛣️', '大通りの旅人'], spill: ['🤝', 'ついでに寄った客'], promo: ['📣', '広告・呼び込みで来た客'], repeat: ['🔁', '常連'] };
function sourcesBox(s, compact) {
  const l = s.last; if (!l || !l.sources || !l.sources.length) return '';
  const rows = l.sources.slice().sort((a, b) => b.gross - a.gross);
  if (compact) { const sp = rows.find(x => x.k === 'spill'); return sp ? `<div class="funmini">🤝 ついでに寄った客 ${fmt(sp.visitors)}人 → ${fmt(sp.buyers)}人が購入 → 粗利 ${fmt(sp.gross)}G</div>` : ''; }
  return `<div class="box"><div class="lbl">🧭 どこから来た客が、いくら買ったか(先月)</div><table class="src"><tr><th></th><th>入店</th><th>購入</th><th>買った割合</th><th>粗利</th></tr>${rows.map(x => `<tr><td>${SRC[x.k][0]} ${SRC[x.k][1]}</td><td class="num">${fmt(x.visitors)}</td><td class="num">${fmt(x.buyers)}</td><td class="num">${Math.round(x.buyers / Math.max(1, x.visitors) * 100)}%</td><td class="num">${fmt(x.gross)}G</td></tr>`).join('')}</table><div class="t3" style="margin-top:6px">ついでに寄った客は買う割合が低め、常連は高め。人を呼べる場所を選んだら、次は品揃えや値段で「入った客」を「買う客」に変えよう。</div></div>`;
}
// 集客の4段階と、いちばん弱いところに効く手
function funnelBox(s, compact) {
  const l = s.last; if (!l || !l.funnel) return '';
  const f = l.funnel, br = f.visitors > 0 ? f.buyers / f.visitors : 0, rr = f.buyers > 0 ? f.repeat / f.buyers : 0;
  const peers = S.shops.filter(x => x.d === s.d && x.last && x.last.funnel && x.g !== 'work').map(x => x.last.funnel.passers).sort((a, b) => a - b);
  const med = peers[Math.floor(peers.length / 2)] || f.passers;
  const steps = [['🚶 通行', f.passers], ['🚪 入店', f.visitors], ['🛍️ 購入', f.buyers], ['🔁 また来た', f.repeat]];
  const mx = Math.max(1, f.passers);
  let diag;
  if (f.passers < med * 0.7 && !E.LOTS[s.lot].road) diag = ['店の前を通る人が少ない', '人の集まる地区や🛣️大通り沿いに出す・広場の🛍️市の日を狙う'];
  else if (f.entry < 0.09) diag = ['人は通るけど、店に入らない', '広告(ビラ)や📣呼び込みで知ってもらう'];
  else if (br < 0.22) diag = l.want > l.cap * 1.03 ? ['入ったのに品切れ・行列で買えない', '店員を増やす・💁看板娘'] : ['入店するけど、買わない', '値段を見直す・品質を上げる(🧑‍🍳腕利き職人)・🏷️大安売りで試してもらう'];
  else if (rr < 0.3) diag = ['一度買うけど、また来ない', '評判を上げる(🔨改装)・品切れを減らす・🤝地域密着で常連をつくる'];
  else diag = ['流れはいい', 'この調子。客が増えたら店員も増やそう'];
  const bars = steps.map(([n, v], i) => `<div class="fun"><span class="fn">${n}</span><span class="fb"><i style="width:${Math.max(2, v / mx * 100)}%;opacity:${1 - i * 0.15}"></i></span><span class="fv num">${fmt(v)}人${i ? `<small>${Math.round(v / Math.max(1, steps[i - 1][1]) * 100)}%</small>` : ''}</span></div>`).join('');
  const roi = l.roi ? `<div class="roi ${l.roi.net >= 0 ? 'g' : 'r'}">📣 集客の成績: ${l.roi.names.map(n => n === 'ADS' ? '広告' : n).join('・')}で購入が <b>+${fmt(l.roi.extra)}件</b>。1件の粗利 ${l.roi.unitGross.toFixed(1)}G → +${fmt(l.roi.gain)}G。かけたお金 ${fmt(l.roi.cost)}G${l.roi.saleLoss ? `+値引き ${fmt(l.roi.saleLoss)}G` : ''} → <b>${sign(l.roi.gain - l.roi.cost - (l.roi.saleLoss || 0))}G</b></div>` : '';
  if (compact) return `<div class="funmini">🚶${fmt(f.passers)} → 🚪${fmt(f.visitors)} → 🛍️${fmt(f.buyers)} → 🔁${fmt(f.repeat)}</div>${roi}`;
  return `<div class="box"><div class="lbl">🧲 集客の流れ(先月)</div>${bars}<div class="hint" style="margin-top:8px">🔍 <b>${diag[0]}</b><br>👉 ${diag[1]}</div>${roi}</div>`;
}
// なぜ儲かった/損した?(店ごとの理由を文章で)
function whyText(s) {
  const l = s.last; if (!l || s.g === 'work' || !l.why) return '';
  const w = l.why, G = E.GOODS[s.g], R = E.RES[G.res], good = [], bad = [];
  const pc = (k) => `${k >= 1 ? '+' : '−'}${Math.round(Math.abs(k - 1) * 100)}%`;
  const ev = S.evActive.map(a => E.evDef(a.id)).concat(S.ev ? [E.evDef(S.ev.id)] : []).find(e => e && ((e.dem && e.dem[s.g]) || (e.dist && e.dist[E.DISTRICTS[s.d].kind])));
  if (Math.abs(w.ek - 1) > 0.05) (w.ek > 1 ? good : bad).push(`${ev ? ev.icon + ev.name : '出来事'}で客 ${pc(w.ek)}`);
  if (Math.abs(w.wk - 1) > 0.04) (w.wk > 1 ? good : bad).push(`${wx(S.w).icon}${wx(S.w).name}で客 ${pc(w.wk)}`);
  const kd = E.DISTRICTS[s.d].kind, mo = (S.t - 1) % 12;
  if (w.sk > 1.12) good.push(kd === 'plaza' && mo % 3 === 2 ? '🛍️市の日でにぎわった' : kd === 'port' ? '☀️夏で旅人が多かった' : `季節がよく客 ${pc(w.sk)}`);
  if (w.sk < 0.88) bad.push(kd === 'port' ? '❄️冬で旅人が少なかった' : `季節がら客 ${pc(w.sk)}`);
  if (w.spill > 3) { const top = (w.spillFrom || []).sort((a, b) => b[1] - a[1])[0]; good.unshift(`🤝${top ? E.GOODS[top[0]].name : '近くの店'}の客がついでに寄った(+${fmt(w.spill)}人)`); }
  if (w.boost < 0.95) bad.push('🥊ライバルの客引き合戦で客を取られた');
  if (w.boost > 1.25) good.push('📣呼び込みが効いた');
  if (l.sale) good.push('🏷️大安売りで客が増えた(1個あたりの利益は減った)');
  if (w.n >= 3) bad.push(`同じ業種${w.n}店で客を取り合った`);
  if (l.want > l.cap * 1.03) bad.push(`人手が足りず ${fmt(l.want - l.cap)}人を逃した(完売)`);
  else if (l.cap > l.want * 1.5 && s.staff > 1) bad.push(`店員が余った(人件費 ${fmt(l.labor)}G)`);
  if (l.resK > 1.15) bad.push(`${R.icon}${R.name}が高く(相場 ${pc(l.resK)})、利益が薄かった`);
  else if (l.resK < 0.87) good.push(`${R.icon}${R.name}が安く仕入れられた`);
  if (l.home > 0.3) good.push('🏠自家製の材料で材料費が浮いた');
  if (l.featUsed) { const R = E.RARES[l.featKey]; good.unshift(`${R.icon}${R.name}の目玉商品で客寄せ +${Math.min(60, l.featUsed * 8)}%・特別売上 ${fmt(l.featRev)}G`); }
  if (E.LOTS[s.lot].road && !good.length && !bad.length) good.push('🛣️大通り沿いで客が入った');
  const g2 = good.slice(0, 2), b2 = bad.slice(0, 2);
  if (!g2.length && !b2.length) return 'いつもどおりの月';
  return g2.join('。') + (g2.length && b2.length ? '。でも ' : '') + b2.join('。');
}
function lessonOf(mine) {
  const ss = mine.map(x => x.s).filter(s => s.last && s.g !== 'work' && s.last.why);
  const badRoi = ss.find(s => s.last.roi && s.last.roi.gain - s.last.roi.cost - (s.last.roi.saleLoss || 0) < -5);
  if (badRoi) { const r = badRoi.last.roi; return `集客にかけたお金が元を取れていない(増えた粗利 ${fmt(r.gain)}G に対して ${fmt(r.cost + (r.saleLoss || 0))}G)。客が増えても、施策ごとに見ると赤字のことがある。お店が満員なら広告より店員、入店が少ないなら広告、と効く場所を選ぼう。`; }
  const hiCost = ss.find(s => s.last.resK > 1.15 && s.last.profit < s.last.prevProfit);
  if (hiCost) { const R = E.RES[E.GOODS[hiCost.g].res]; return `材料が高い月は利益が削られる。${R.name}が安いうちに市場で買いだめしておけば守れる。`; }
  const sold = ss.find(s => s.last.want > s.last.cap * 1.08);
  if (sold) return `お客は来ているのにさばけていない。店員を増やす前に、材料が足りているか市場も見ておこう。`;
  const crowd = ss.find(s => s.last.why.n >= 3 && s.last.profit < 0);
  if (crowd) return `同じ業種が集まると客の取り合いになる。すいている業種・地区に出すか、育て方で差をつけよう。`;
  return '';
}
// 地区の様子: 客の多さ・家賃・業種ごとの売れやすさとライバル・狙い目
function districtInsight(d) {
  const D = E.DISTRICTS[d], all = Object.values(E.DISTRICTS);
  const tot = (x) => Object.entries(x.demand).reduce((a, [g, v]) => a + v * E.GOODS[g].ref, 0);
  const mx = Math.max(...all.map(tot)), mn = Math.min(...all.map(tot)), myT = tot(D);
  const crowd = mx === mn ? 3 : 1 + Math.round((myT - mn) / (mx - mn) * 4);
  const rents = all.map(x => x.rent), rentLv = D.rent >= Math.max(...rents) ? '高い' : D.rent <= Math.min(...rents) ? '安い' : 'ふつう';
  const plan = (g) => F.acts.filter(a => a.type === 'open' && E.LOTS[a.lot].d === d && a.g === g).length;
  const maxDem = Math.max(...Object.entries(D.demand).map(([g, v]) => v * E.GOODS[g].ref));
  let best = null;
  const rows = Object.entries(E.GOODS).map(([g, G]) => {
    const shops = S.shops.filter(s => s.d === d && s.g === g), n = shops.length + plan(g);
    const dem = D.demand[g] * G.ref, bar = Math.round(dem / maxDem * 100);
    const score = dem / (1 + n * 1.2); if (!best || score > best.score) best = { g, score, n, dem };
    const dots = shops.map(s => `<span class="dot" style="background:${E.COLOR_HEX[S.players[s.owner].color]}" title="${esc(S.players[s.owner].name)}"></span>`).join('') + (plan(g) ? '<span class="dot" style="background:#fff;border:2px dashed var(--blue)"></span>' : '');
    const tag = n === 0 ? '<span class="tagg g">店なし</span>' : n === 1 ? '<span class="tagg y">1店</span>' : `<span class="tagg r">${n}店</span>`;
    const sp = E.spillOf(S, d, g);
    return `<div class="irow"><span class="ii">${G.icon}</span><span class="in">${G.item}</span><span class="ib"><i style="width:${bar}%"></i></span><span class="id">${dots}</span>${tag}</div>${sp.add >= 3 ? `<div class="spl">🤝 ついで買い 約+${fmt(sp.add)}人(${sp.from.map(([g2]) => E.SPILL_TEXT[g2]).join('・')})</div>` : ''}`;
  }).join('');
  // ヒントは「おすすめ」ではなく、判断材料の数字だけ(同じ数字から違う手を選べるように)
  const facts = Object.entries(E.GOODS).map(([g, G]) => {
    const n = S.shops.filter(s => s.d === d && s.g === g).length, miss = S.missed && S.missed[d] && S.missed[d][g], R = E.RES[G.res], h = S.market[G.res].hist, ch = h.length > 1 ? S.market[G.res].price / h[h.length - 2] - 1 : 0;
    return { g, G, n, miss: miss || 0, R, ch };
  }).sort((a, b) => b.miss - a.miss).slice(0, 2);
  const hint = S.t === 0 ? '📊 まだ誰も店を出していない。家賃・客の多さ・材料の相場から考えよう' : '📊 先月: ' + facts.map(f => `${f.G.name}${f.n}軒・${f.G.item}の買い逃し 約${fmt(Math.round(f.miss / 5) * 5)}件・${f.R.name} 前月比${f.ch >= 0 ? '+' : '−'}${Math.round(Math.abs(f.ch) * 100)}%`).join('<br>📊 ');
  const crowded = [];
  return `<div class="box insight"><div class="row" style="gap:14px;margin-bottom:8px"><div><div class="lbl">客の多さ</div><div class="stars" style="font-size:16px">${'★'.repeat(crowd)}<span style="opacity:.25">${'★'.repeat(5 - crowd)}</span></div></div><div><div class="lbl">家賃</div><div style="font-size:16px">${D.rent}G<small class="t3"> /月 · ${rentLv}</small></div></div><div class="grow"></div></div>
    ${(() => { const h = (S.prospHist && S.prospHist[d]) || [], k = E.prosperK(S, d), tr = h.length > 3 ? k - h[h.length - 4] : 0; return `<div class="t3" style="margin-bottom:6px">🏘️ 景気 <b class="${k >= 1 ? 'up' : 'down'}">${k >= 1.06 ? 'にぎわっている' : k >= 1 ? 'ふつう' : k >= 0.95 ? 'やや冷えている' : 'さびれている'}</b>(客 ${k >= 1 ? '+' : '−'}${Math.round(Math.abs(k - 1) * 100)}%)${tr > 0.005 ? ' ↗ 上向き' : tr < -0.005 ? ' ↘ 下向き' : ''} · 店がお給料を払うほど住民の財布がうるおう</div>`; })()}
    <div class="t3" style="margin-bottom:8px">${D.trait}</div>
    <div class="lbl">業種ごとの売れやすさ と ライバル</div>${rows}
    <div class="hint">${hint}${crowded.length ? `<br>⚠️ ${crowded.join('・')}は取り合いになっている` : ''}</div>
    ${outlookBox(d)}</div>`;
}
function outlookBox(d) {
  const o = E.outlook(S, d, me().scout === S.t ? S.wNext : S.wFore), ev = S.evNext && E.evDef(S.evNext.id), w = wx(me().scout === S.t ? S.wNext : S.wFore);
  const items = Object.entries(o).filter(([, k]) => Math.abs(k - 1) > 0.04).sort((a, b) => b[1] - a[1]);
  return `<div class="lbl" style="margin-top:10px">🔮 来月の見込み <span class="t3">${ev && ev.id !== 'calm' ? ev.icon + ev.name + ' · ' : ''}${w.icon}${w.name}予報</span></div>${items.length ? `<div class="outl">${items.map(([g, k]) => `<span class="${k > 1 ? 'up' : 'down'}">${E.GOODS[g].icon}${E.GOODS[g].item} ${k > 1 ? '+' : '−'}${Math.round(Math.abs(k - 1) * 100)}%</span>`).join('')}</div>` : '<div class="t3">来月はいつもどおりの見込み</div>'}`;
}
SHEETS.district = ({ d }) => {
  const D = E.DISTRICTS[d], shops = S.shops.filter(s => s.d === d);
  return head('📍', D.name, D.desc) + districtInsight(d) + `<div class="box"><div class="lbl">この地区の店</div>${shops.length ? shops.map(s => `<button class="shoprow" style="width:100%;text-align:left" data-a="shop" data-id="${s.id}"><span class="ic">${gd(s).icon}</span><div class="grow">${pname(S.players[s.owner])} の${gd(s).name}<div class="t3">${s.last && s.g !== 'work' ? `先月 約${fmt(Math.round(s.last.units / 10) * 10)}人 · ${E.PRICE_NAME[s.priceLv]}` : '開いたばかり'}${E.LOTS[s.lot].road ? ' · 🛣️大通り' : ''}</div></div></button>`).join('') : '<div class="t2">まだ店がない。早い者勝ち!</div>'}</div>`;
};
// 自分の店
SHEETS.shop = ({ id }) => {
  const s0 = S.shops.find(x => x.id === id); if (!s0) return head('❔', 'もうない店', '');
  const s = shopView(s0), G = gd(s), D = E.DISTRICTS[s.d], l = s0.last;
  if (s0.owner !== ME) return rivalSheet(s0);
  if (s0.g === 'work') return workSheet(s0);
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
    `<div class="box">${pl}</div>${funnelBox(s0)}${sourcesBox(s0)}
    <div class="box"><div class="lbl">値段 <span class="grow"></span><span class="num">${(G.ref * E.PRICE_LV[s.priceLv]).toFixed(1)}G / 1つ</span></div>
      <div class="seg">${E.PRICE_NAME.map((n, i) => `<button class="${s.priceLv === i ? 'on' : ''}" data-a="setp" data-id="${id}" data-v="${i}">${n}</button>`).join('')}</div>
      <div class="lbl" style="margin-top:12px">店員 <span class="grow"></span><span class="t3">1人 ${E.WAGE}G/月 · 1人で月 ${G.capPer}人さばける</span></div>
      <div class="stepper"><button data-a="sets" data-id="${id}" data-v="-1">−</button><div class="v num">${s.staff}人</div><button data-a="sets" data-id="${id}" data-v="1">＋</button><div class="t3 grow" style="text-align:right">＋は「ふつう」の人</div></div>
      ${crewList(s0)}
      <div class="lbl" style="margin-top:12px">広告</div>
      <div class="seg">${E.ADS.map((a, i) => `<button class="${s.ads === i ? 'on' : ''}" data-a="seta" data-id="${id}" data-v="${i}">${a.name}<small>${a.cost ? a.cost + 'G' : '0G'}</small></button>`).join('')}</div>
      ${est ? `<div class="est"><span class="ev">🔮</span><div class="grow"><div class="t3" style="margin:0">この設定だと来月は(ざっくり)</div><div style="font-size:17px">お客 ${fmt(est.units)}人 · 利益 <span class="${cls(est.profit)}">${sign(est.profit)}G</span>${base != null ? ` <span class="t3">(先月 ${sign(base)})</span>` : ''}</div></div></div>` : ''}
    </div>
    ${(() => { const pk = E.RES[G.res].proc, have = me().inv[pk], on = (pendSet(s0.id) && pendSet(s0.id).useProc != null) ? pendSet(s0.id).useProc : s0.useProc; return have > 0 || s0.home > 0 ? `<div class="box"><div class="lbl">🏠 自家製の材料(${E.PROC[pk].icon}${E.PROC[pk].name} 在庫 ${fmt(have)})</div><div class="seg"><button class="${on ? 'on' : ''}" data-a="setproc" data-id="${s0.id}" data-v="1">使う</button><button class="${!on ? 'on' : ''}" data-a="setproc" data-id="${s0.id}" data-v="0">使わない</button></div><div class="t3" style="margin-top:6px">使うと材料費が半分になり、次の月の客寄せが最大 +15%。${s0.home > 0 ? `先月は材料の ${Math.round(s0.home * 100)}% が自家製だった。` : ''}</div></div>` : ''; })()}
    ${featBox(s0)}
    ${routeBox(s0)}
    <div class="box"><div class="kv"><span class="k">品質</span><span>${E.QUALITY[s0.qual].name}</span></div><div class="kv"><span class="k">開業</span><span>${ym(s0.openedT)}</span></div><div class="kv"><span class="k">今売ると</span><span class="num">${fmt(E.shopValue(S, s0) * 0.8)}G</span></div></div>
    <button class="btn wide" data-a="closeshop" data-id="${id}">店をたたむ(売る)</button>`;
};
function workSheet(s0) {
  const s = shopView(s0), raw = s0.res, pk = E.RES[raw].proc, P = E.PROC[pk], R = E.RES[raw], l = s0.last, p = me();
  const pend = pendSet(s0.id), auto = pend && pend.autoSell != null ? pend.autoSell : s0.autoSell;
  const cap = s.staff * P.rate, mBuy = S.market[raw].price * (1 + E.SPREAD), mSell = S.market[pk].price * (1 - E.SPREAD), margin = mSell - mBuy;
  const est = cap * margin - s.staff * E.WAGE - E.DISTRICTS[s0.d].rent;
  return head('🏭', `工房 ${R.icon}→${P.icon}`, `${E.DISTRICTS[s0.d].name} · ${R.name}を${P.name}にする`) +
    `<div class="box">${l ? `<div class="row"><div class="grow"><div class="lbl">先月つくった</div><div class="big num">${fmt(l.made)}<span class="t3">/${fmt(l.cap)}個</span></div></div><div style="text-align:right"><div class="lbl" style="justify-content:flex-end">売った</div><div class="num" style="font-size:18px">${fmt(l.sold)}個 · ${fmt(l.got)}G</div></div></div>${l.short > 5 ? `<div class="t3" style="color:var(--bad);margin-top:6px">⚠️ ${R.name}が足りず ${fmt(l.short)}個ぶん作れなかった</div>` : ''}` : '<div class="t3">来月から動きはじめる</div>'}
      <div class="kv" style="margin-top:8px"><span class="k">${R.icon} ${R.name}の在庫</span><span class="num">${fmt(p.inv[raw])}</span></div><div class="kv"><span class="k">${P.icon} ${P.name}の在庫</span><span class="num">${fmt(p.inv[pk])}</span></div></div>
    <div class="box"><div class="lbl">職人 <span class="grow"></span><span class="t3">1人 ${E.WAGE}G/月 · 1人で月 ${P.rate}個</span></div>
      <div class="stepper"><button data-a="sets" data-id="${s0.id}" data-v="-1">−</button><div class="v num">${s.staff}人</div><button data-a="sets" data-id="${s0.id}" data-v="1">＋</button><div class="t3 grow" style="text-align:right">月 ${fmt(cap)}個</div></div>
      <div class="lbl" style="margin-top:12px">原料(${R.name})の仕入れ</div>
      <div class="seg">${[[1, '自動で仕入れる'], [0, '自分で買う']].map(([v, n]) => `<button class="${((F.acts.filter(a => a.type === 'set' && a.shop === s0.id && a.autoBuy != null).pop() || s0).autoBuy !== 0 ? 1 : 0) === v ? 'on' : ''}" data-a="setautobuy" data-id="${s0.id}" data-v="${v}">${n}</button>`).join('')}</div>
      <div class="t3" style="margin-top:4px">自動: 在庫が足りないぶんを、その月の相場で買って作る。安いときに市場でまとめ買いしておくと得</div>
      <div class="lbl" style="margin-top:12px">作ったものを市場で売る</div>
      <div class="seg">${[[0, '売らない'], [0.5, '半分'], [1, '全部']].map(([v, n]) => `<button class="${auto === v ? 'on' : ''}" data-a="setauto" data-id="${s0.id}" data-v="${v}">${n}</button>`).join('')}</div>
      <div class="t3" style="margin-top:6px">売らずに置いておくと、相場が上がったときに売ったり、自分の${Object.values(E.GOODS).find(g => g.res === raw).name}で「自家製」として使える(客寄せ +15%・材料費が半分)。</div>
      <div class="est"><span class="ev">🔮</span><div class="grow"><div class="t3" style="margin:0">いまの相場だと1個あたり</div><div style="font-size:15px">${P.name} ${mSell.toFixed(2)}G − ${R.name} ${mBuy.toFixed(2)}G = <b class="${cls(margin)}">${margin >= 0 ? '+' : ''}${margin.toFixed(2)}G</b></div><div class="t3">満杯まで作ると月 <b class="${cls(est)}">${sign(est)}G</b>(原料は市場で買っておく)</div></div></div>
    </div>
    <button class="btn pri wide" data-a="market" style="margin-bottom:8px">🛒 市場で原料を買う</button>
    <button class="btn wide" data-a="closeshop" data-id="${s0.id}">工房をたたむ(売る)</button>`;
}
function featBox(s) {
  const ks = Object.keys(E.RARES).filter(k => E.RARES[k].use === s.g); if (!ks.length) return '';
  const p = me(), pend = pendSet(s.id), cur = pend && pend.feat !== undefined ? pend.feat : s.feat, q = pend && pend.featQty != null ? pend.featQty : s.featQty;
  const have = ks.filter(k => p.inv[k] > 0);
  return `<div class="box"><div class="lbl">💎 目玉商品(レア素材)</div>${ks.map(k => { const R = E.RARES[k]; return `<div class="kv"><span class="k">${R.icon} ${R.name} <span class="t3">在庫 ${fmt(p.inv[k])} · 相場 ${S.market[k].price.toFixed(0)}G</span></span><span><button class="btn sm ${cur === k ? 'pri' : ''}" data-a="setfeat" data-id="${s.id}" data-v="${k}" ${p.inv[k] > 0 || cur === k ? '' : 'disabled'}>${cur === k ? '並べる ✓' : '並べる'}</button></span></div>`; }).join('')}
    ${cur ? `<div class="lbl" style="margin-top:8px">毎月いくつ並べる?</div><div class="seg">${[2, 4, 6, 10].map(n => `<button class="${q === n ? 'on' : ''}" data-a="setfeatq" data-id="${s.id}" data-v="${n}">${n}個</button>`).join('')}</div><div class="t3" style="margin-top:6px">1個ごとに客寄せ +8%(最大 +60%)。並べた分は特別な品として素材の相場の約1.7倍で売れる${s.d && E.DISTRICTS[s.d].kind === 'noble' && cur === 'moonsilk' ? '(貴族街の月絹は2.2倍)' : ''}。ただし1個ごとに職人の手を使うので、普段の客をさばける数が ${fmt(E.GOODS[s.g].capPer * 0.1)}人ずつ減る。店が混んでいるなら素材のまま売る手もある。在庫がなくなると外れる。</div><button class="btn sm" style="margin-top:6px" data-a="setfeat" data-id="${s.id}" data-v="">並べるのをやめる</button>` : `<div class="t3" style="margin-top:6px">${have.length ? 'レア素材を並べると、客寄せと特別売上が増える。' : `この店で使えるレア素材: ${ks.map(k => E.RARES[k].icon + E.RARES[k].name).join('・')}。市場の「💎レア」や商人の申し出で手に入る。`}</div>`}</div>`;
}
function routeBox(s) {
  const pend = F.acts.find(a => a.type === 'route' && a.shop === s.id);
  if (s.route && s.route.lv >= 2) { const R = E.ROUTES[s.route.k]; return `<div class="box"><div class="lbl">育て方</div><div style="font-size:16px">${R.icon} ${R.name} <b>Lv2</b></div><div class="t3">${R.text[1]}</div></div>`; }
  if (s.months < 3) return `<div class="box"><div class="lbl">育て方</div><div class="t3">開業から3か月たつと、店の育て方(高級路線・薄利多売・地域密着)を選べる。あと${3 - s.months}か月。</div></div>`;
  if (pend) return `<div class="box"><div class="lbl">育て方</div><div class="t2">${E.ROUTES[pend.k].icon} ${E.ROUTES[pend.k].name} を月末に${s.route ? 'Lv2 に' : '始める'}予定</div><button class="btn sm" data-a="routecancel" data-id="${s.id}">やめる</button></div>`;
  if (s.route) { const R = E.ROUTES[s.route.k]; const c = R.cost[1]; return `<div class="box"><div class="lbl">育て方</div><div style="font-size:16px">${R.icon} ${R.name} Lv1</div><div class="t3">${R.text[0]}</div><div class="t3" style="margin-top:6px">Lv2: ${R.text[1]}</div><button class="btn pri wide" style="margin-top:8px" data-a="route" data-id="${s.id}" data-k="${s.route.k}" ${freeCash() >= c ? '' : 'disabled'}>${c}G で Lv2 にする</button></div>`; }
  return `<div class="box"><div class="lbl">育て方を選ぶ(一度決めたら変えられない)</div>${Object.entries(E.ROUTES).map(([k, R]) => `<button class="shoprow" style="width:100%;text-align:left" data-a="route" data-id="${s.id}" data-k="${k}" ${freeCash() >= R.cost[0] ? '' : 'disabled'}><span class="ic">${R.icon}</span><div class="grow"><div>${R.name} <span class="t3">${R.cost[0]}G</span></div><div class="t3">${R.text[0]}<br>💡 ${R.tip}</div></div></button>`).join('')}</div>`;
}
const face = (c, sz = 38) => { const u = c.look && board ? board.portrait(c.look) : ''; return u ? `<img class="cface" src="${u}" width="${sz}" height="${sz}" alt="">` : `<span class="cf">${c.face || '🙂'}</span>`; };
function crewList(s0) {
  const crew = s0.crew || [], hires = F.acts.filter(a => a.type === 'hire' && a.shop === s0.id).map(a => (me().cands || []).find(c => c.id === a.cand)).filter(Boolean), fires = F.acts.filter(a => a.type === 'fire' && a.shop === s0.id).map(a => a.staffId);
  return `<div class="crew">${crew.map(c => { const T = E.TRAITS[c.trait]; return `<div class="cm ${fires.includes(c.id) ? 'gone' : ''}">${face(c)}<div class="grow"><div>${esc(c.name)} <span class="tagg ${c.trait === 'plain' ? '' : 'y'}">${T.icon}${T.name}</span></div><div class="t3">${T.text} · ${c.wage}G/月${T.grow ? ` · 育ち ${Math.round(((c.skill || 1) * T.cap - T.cap) / T.cap * 100)}%` : ''}${c.months ? ` · ${c.months}か月目` : ''}</div></div>${crew.length > 1 && !fires.includes(c.id) ? `<button class="btn sm" data-a="fire" data-id="${s0.id}" data-v="${c.id}">やめてもらう</button>` : fires.includes(c.id) ? '<span class="t3">月末にやめる</span>' : ''}</div>`; }).join('')}
    ${hires.map(c => `<div class="cm new">${face(c)}<div class="grow">${esc(c.name)} <span class="tagg g">${E.TRAITS[c.trait].icon}${E.TRAITS[c.trait].name}</span><div class="t3">月末に入る</div></div></div>`).join('')}
    <button class="btn sm pri" data-a="hirelist" data-id="${s0.id}" style="margin-top:6px">🧑‍💼 求人を見る(${(me().cands || []).length}人)</button></div>`;
}
SHEETS.hire = ({ shop }) => {
  const s0 = S.shops.find(x => x.id === shop), cands = me().cands || [];
  return head('🧑‍💼', '求人', `${gd(s0).name}(${E.DISTRICTS[s0.d].short})で働いてくれる人。毎月入れかわる`) + `<div class="box">${cands.length ? cands.map(c => { const T = E.TRAITS[c.trait], taken = F.acts.some(a => a.type === 'hire' && a.cand === c.id); return `<div class="cm">${face(c, 46)}<div class="grow"><div style="font-size:15px">${esc(c.name)} <span class="tagg y">${T.icon}${T.name}</span></div><div class="t3">${T.text}<br>お給料 ${c.wage}G/月(ふつうは ${E.WAGE}G)</div></div><button class="btn sm ${taken ? '' : 'warm'}" data-a="hire" data-id="${shop}" data-v="${c.id}" ${taken || (s0.crew || []).length >= 5 ? 'disabled' : ''}>${taken ? '予定' : '雇う'}</button></div>`; }).join('') : '<div class="t2">今月は求職者がいない</div>'}</div><div class="t3">ライバルも同じ町で人を探している。いい人は早い者勝ち…ではなく、毎月それぞれに別の人が来る。</div>`;
};
function rivalSheet(s) {
  const p = S.players[s.owner], G = gd(s), l = s.last, sc = me().scout === S.t;
  return head(G.icon, `${G.name}`, `${E.DISTRICTS[s.d].name}`) + `<div class="box"><div class="kv"><span class="k">持ち主</span><span>${pname(p)}<span class="ai-chip">${E.AI_KIND[p.ai] ? E.AI_KIND[p.ai].name : '人'}</span></span></div>
    <div class="kv"><span class="k">評判</span><span>${stars(s.rep)}</span></div>
    <div class="kv"><span class="k">値段</span><span>${E.PRICE_NAME[s.priceLv]}</span></div>
    <div class="kv"><span class="k">育て方</span><span>${s.route ? E.ROUTES[s.route.k].icon + ' ' + E.ROUTES[s.route.k].name + ' Lv' + s.route.lv : 'まだ'}</span></div>
    <div class="kv"><span class="k">先月のお客</span><span class="num">${l ? '約 ' + fmt(Math.round(l.units / 10) * 10) + '人' : '−'}</span></div>
    ${sc ? `<div class="kv"><span class="k">🕵️ 秘密の目標の手がかり</span><span>${E.MISSIONS[p.mission].name}</span></div>` : ''}
    ${sc && l ? `<div class="kv"><span class="k">🕵️ 先月の利益</span><span class="num ${cls(l.profit)}">${sign(l.profit)}G</span></div><div class="kv"><span class="k">🕵️ 店員</span><span>${s.staff}人</span></div>` : ''}</div>
    ${(() => { const v = E.shopValue(S, s), offers = [1.0, 1.3, 1.6].map(k => Math.round(v * k)), pend = F.acts.find(a => a.type === 'buyshop' && a.shop === s.id); return `<div class="box"><div class="lbl">🤝 この店を買い取る</div><div class="t3">店の値打ち 約${fmt(v)}G。相手がお金に困っている・赤字続きなら安くても売ってくれる。そうでなければ高めに出さないと断られる。</div><div class="row" style="gap:6px;margin-top:8px">${offers.map(o => `<button class="btn sm ${pend && pend.price === o ? 'warm' : ''}" data-a="buyshop" data-id="${s.id}" data-v="${o}" ${freeCash() >= o ? '' : 'disabled'}>${fmt(o)}Gで申し込む</button>`).join('')}</div>${pend ? '<div class="t3" style="margin-top:6px">月末に返事が来る</div>' : ''}</div>`; })()}
    <div class="t3">同じ地区・同じ業種の店どうしでお客を取り合う。真横に同じ業種の安い店を出すと、客を奪える。${sc ? '' : '「情報屋」カードを使うと、もっと詳しく分かる。'} 攻撃カード(🥊客引き合戦・🤝引き抜き)でこの店を狙える。</div>`;
}
// 市場
SHEETS.market = () => {
  const p = me(), tab = F.mtab || 'raw';
  const offers = p.offers || [];
  const tabs = `<div class="seg tabs6" style="margin-bottom:10px">${[['raw', '🌾 原料'], ['proc', '🏭 加工'], ['rare', '💎 レア'], ['ledger', '📜 帳'], ['pact', `📝 契約${(S.pacts || []).some(c => c.left > 0 && (c.seller === ME || c.buyer === ME)) ? ' <span class="badge g">●</span>' : ''}`], ['deal', `🤝 申し出${offers.length ? ` <span class="badge">${offers.length}</span>` : ''}`]].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-a="mtab" data-v="${k}">${n}</button>`).join('')}</div>`;
  const pendQ = (k) => F.acts.filter(a => (a.type === 'buy' || a.type === 'sell') && a.res === k).reduce((a, x) => a + (x.type === 'buy' ? x.qty : -x.qty), 0);
  // 1品ずつのカード。タップで開いて、数を決めて売り買いする
  const row = (k) => {
    const r = E.ITEMS[k], m = S.market[k], h = m.hist.slice(-12), mn = Math.min(...h), mx = Math.max(...h), open = F.mSel === k;
    const pts = h.map((v, i) => `${(i / Math.max(1, h.length - 1) * 64).toFixed(1)},${(24 - (v - mn) / Math.max(0.001, mx - mn) * 20).toFixed(1)}`).join(' ');
    const vsb = m.price / r.base - 1, tag = vsb > 0.12 ? ['高い', 'hi'] : vsb < -0.12 ? ['安い', 'lo'] : ['ふつう', 'mid'];
    const have = p.inv[k] || 0, pq = pendQ(k);
    let h0 = `<button class="mrow ${open ? 'open' : ''}" data-a="msel" data-v="${k}"><span class="mri">${r.icon}</span><span class="mrn"><b>${r.name}</b><small>在庫 ${fmt(have)}${pq ? ` <em class="${pq > 0 ? 'up' : 'down'}">${pq > 0 ? '+' : ''}${fmt(pq)}予定</em>` : ''}</small></span>
      <svg width="66" height="26"><polyline points="${pts}" fill="none" stroke="${vsb > 0 ? '#ff4f64' : '#20b26b'}" stroke-width="2.2" stroke-linecap="round"/></svg>
      <span class="mrp"><b>${m.price.toFixed(2)}G</b><i class="mtag ${tag[1]}">${tag[0]}</i></span><span class="mchev">${open ? '▲' : '▼'}</span></button>`;
    if (!open) return h0;
    // 開いたとき: 意味をことばで + 数を決める
    const mk = S.mk && S.mk[k], N = E.normalStock(k), lv = mk ? mk.stock / N : 1;
    const stockWord = lv < 0.7 ? ['少ない', '#e5484d'] : lv > 1.3 ? ['たっぷり', '#16a34a'] : ['ふつう', '#2f5fd0'];
    const trend = mk ? (mk.prod - mk.need - (mk.shop || 0)) : 0, trendW = !mk ? '' : trend < -N * 0.03 ? '📈 使われる量が多い → <b>値上がりしそう</b>' : trend > N * 0.03 ? '📉 作られる量が多い → <b>値下がりしそう</b>' : '➡️ 作る量と使う量がつり合っている';
    const use = Math.round(E.useOf ? E.useOf(S, ME, k) : 0), avg = have > 0 ? p.invCost[k] / have : 0, gain = have > 0 ? have * m.price * (1 - E.SPREAD) - p.invCost[k] : 0;
    const T = F.mT = F.mT || { mode: 'buy', q: E.isRare(k) ? 2 : E.isProc(k) ? 20 : 50 };
    const canSell = Math.max(0, Math.floor(have + Math.min(0, pq)));
    if (T.mode === 'sell') T.q = Math.min(T.q, canSell);
    const q = Math.max(0, T.q), cost = q ? (T.mode === 'buy' ? E.quote(S, k, q) : E.sellQuote(S, k, q)) : 0;
    const stockAfter = mk ? mk.stock - pq - (T.mode === 'buy' ? q : -q) : N, after = E.priceAt(k, stockAfter), dp = after / m.price - 1;
    const step = E.isRare(k) ? 1 : E.isProc(k) ? 5 : 10, presets = E.isRare(k) ? [1, 2, 5] : E.isProc(k) ? [10, 20, 50] : [10, 50, 100, 200];
    const pend = F.acts.filter(a => (a.type === 'buy' || a.type === 'sell') && a.res === k);
    h0 += `<div class="mpanel">
      <div class="mfacts">
        <div><span>💴 いまの相場</span><b>${m.price.toFixed(2)}G</b><small>ふだんは ${r.base.toFixed(2)}G → <i class="mtag ${tag[1]}">${tag[0]}</i></small></div>
        <div><span>🛒 買うと 1個</span><b>${(m.price * (1 + E.SPREAD)).toFixed(2)}G</b><small>💰 売ると 1個 ${(m.price * (1 - E.SPREAD)).toFixed(2)}G(差は手数料${Math.round(E.SPREAD * 100)}%)</small></div>
        <div><span>🏚️ 町の倉</span><b style="color:${stockWord[1]}">${stockWord[0]}</b><small><span class="stockbar"><i style="width:${Math.min(100, lv / 2 * 100)}%;background:${stockWord[1]}"></i><b style="left:50%"></b></span>倉が少ないほど値段が上がる</small></div>
        ${mk ? `<div class="wide"><small>${trendW}(先月 作られた ${fmt(mk.prod)} / 使われた ${fmt(mk.need + (mk.shop || 0))})</small></div>` : ''}
        <div><span>📦 あなたの在庫</span><b>${fmt(have)}個</b><small>${have > 0 ? `平均 ${avg.toFixed(2)}Gで仕入れ · いま売ると <span class="${cls(gain)}">${sign(gain)}G</span>` : 'なし'}</small></div>
        <div><span>🏪 あなたの店が使う</span><b>${use ? `月 ${fmt(use)}個` : '—'}</b><small>${r.decay ? `🥀 毎月 ${Math.round(r.decay * 100)}% 傷んで減る` : '🧊 傷まない'} · 保管料あり</small></div>
      </div>
      <div class="seg mmode"><button class="${T.mode === 'buy' ? 'on' : ''}" data-a="mmode" data-v="buy">🛒 買う</button><button class="${T.mode === 'sell' ? 'on' : ''}" data-a="mmode" data-v="sell" ${canSell ? '' : 'disabled'}>💰 売る</button></div>
      <div class="mqty"><button class="mqb" data-a="mq" data-v="${-step}">−</button><div class="mqv"><b>${fmt(q)}</b><small>個</small></div><button class="mqb" data-a="mq" data-v="${step}">+</button></div>
      <div class="chips mpre">${presets.map(v => `<button class="chip ${q === v ? 'on' : ''}" data-a="mqset" data-v="${v}">${v}</button>`).join('')}${T.mode === 'buy' && use ? `<button class="chip" data-a="mqset" data-v="${Math.max(step, Math.ceil(use / step) * step)}">1か月分</button>` : ''}${T.mode === 'sell' && canSell ? `<button class="chip" data-a="mqset" data-v="${canSell}">ぜんぶ</button>` : ''}</div>
      <div class="msum">${T.mode === 'buy' ? `合計 <b class="down">−${fmt(Math.round(cost))}G</b>` : `合計 <b class="up">+${fmt(Math.round(cost))}G</b>`}${q ? ` <small>(1個平均 ${(cost / q).toFixed(2)}G)</small>` : ''}<br><small>${T.mode === 'buy' ? '買うと倉が減って' : '売ると倉が増えて'} 相場 ${m.price.toFixed(2)} → <b class="${dp > 0 ? 'down' : 'up'}">${after.toFixed(2)}G</b>(${dp >= 0 ? '+' : ''}${Math.round(dp * 100)}%)</small></div>
      <button class="btn wide ${T.mode === 'buy' ? 'pri' : 'warm'} mgo" data-a="mgo" data-v="${k}" ${q > 0 && (T.mode === 'sell' || freeCash() >= cost) && (!E.isRare(k) || E.peddlerHas(S, k)) ? '' : 'disabled'}>${E.isRare(k) && !E.peddlerHas(S, k) ? '行商人が来たときだけ' : q <= 0 ? '数を選んで' : T.mode === 'buy' ? (freeCash() >= cost ? `🛒 ${fmt(q)}個 買う` : 'お金が足りない') : `💰 ${fmt(q)}個 売る`}</button>
      ${pend.length ? `<div class="mpend">${pend.map((a, i) => `<span>${a.type === 'buy' ? '🛒 買う' : '💰 売る'} ${fmt(a.qty)}個</span>`).join(' · ')} <small>(月末に実行)</small> <button class="btn sm" data-a="mcancel" data-v="${k}">取り消す</button></div>` : ''}
    </div>`;
    return h0;
  };
  let body = '';
  if (tab === 'raw') body = `<div class="box">${Object.keys(E.RES).map(row).join('')}</div><div class="t3">店は毎月、材料を使う。在庫があれば先に使い、なければその月の値段で買う。安いときに買っておけば値上がりしても困らない。小麦と薬草は傷むので抱えすぎ注意。保管料もかかる。</div>`;
  if (tab === 'proc') body = `<div class="box">${Object.keys(E.PROC).map(row).join('')}</div><div class="t3">加工品は工房で原料から作る(空き地の「+」→🏭工房)。原料より高く売れる。自分の店で使うと「自家製」になる。</div>`;
  if (tab === 'rare') body = (() => { const P = S.peddler || {}; const here = P.left > 0; return `<div class="peddler ${here ? 'on' : ''}"><img src="assets/icons/ui_crate.png" alt=""><div><b>${here ? '行商人が来ている!' : '行商人はいない'}</b><small>${here ? `今月だけ ${P.items.map(k => E.ITEMS[k].name).join('・')} を売り買いできる` : `次に来るのは ${P.next != null ? ym(P.next) : '—'} ごろ`}</small></div></div>`; })() + `<div class="box">${Object.keys(E.RARES).map(k => row(k) + `<div class="t3" style="margin:-4px 0 8px 34px">${E.RARES[k].where} · ${E.GOODS[E.RARES[k].use].icon}${E.GOODS[E.RARES[k].use].name}の目玉にできる</div>`).join('')}</div><div class="t3">レア素材は量が少なく、買うと一気に値上がりする。使い道は4つ: すぐ売る / 自分の店の目玉商品にする(客寄せ+特別売上) / 前金つきで欲しがるライバルに納める / 値上がりまで持っておく。ただし代わりの素材が入ると値崩れする。</div>`;
  if (tab === 'ledger') {
    const lg = (S.ledger || []).filter(f => f.pid !== ME);
    const lines = lg.map(f => { const pp = S.players[f.pid]; if (f.kind === 'buy') return `${pname(pp)} が ${E.ITEMS[f.res].icon}${E.ITEMS[f.res].name}を <b>${fmt(f.qty)}</b> 買った`; if (f.kind === 'sell') return `${pname(pp)} が ${E.ITEMS[f.res].icon}${E.ITEMS[f.res].name}を <b>${fmt(f.qty)}</b> 売った`; if (f.kind === 'deal') return `${pname(pp)} が商人と ${E.ITEMS[f.offer.item].name} の取引をした`; if (f.kind === 'card') return `${pname(pp)} が ${E.ITEMS[f.res].name}を市場に放出した`; if (f.kind === 'open') { const sh = S.shops.find(x => x.id === f.shop); return sh ? `${pname(pp)} が ${E.DISTRICTS[sh.d].short}に ${gd(sh).name} を開いた` : ''; } if (f.kind === 'close') return `${pname(pp)} が店をたたんだ`; return ''; }).filter(Boolean);
    const stock = S.players.filter(pp => pp.id !== ME).map(pp => { const big = Object.entries(pp.inv).filter(([, v]) => v >= 40).sort((a, b) => b[1] - a[1]).slice(0, 3); return `<div class="kv"><span class="k">${pname(pp)}</span><span>${big.length ? big.map(([k, v]) => `${E.ITEMS[k].icon}${E.ITEMS[k].name} 約${fmt(Math.round(v / 10) * 10)}`).join(' ') : '<span class="t3">ほぼなし</span>'}</span></div>`; }).join('');
    body = `<div class="box"><div class="lbl">先月のライバルの売り買い</div>${lines.length ? lines.map(x => `<div class="news">${x}</div>`).join('') : '<div class="t3">目立った動きはない</div>'}</div><div class="box"><div class="lbl">ライバルの倉(うわさ)</div>${stock}</div><div class="t3">誰かが原料を買い込んでいたら、来月はその原料が値上がりしやすい。倉にたくさんある相手は、売りに出して値を崩すかも。</div>`;
  }
  if (tab === 'pact') body = pactTab();
  if (tab === 'deal') body = offers.length ? `<div class="box">${offers.map(o => { if (o.kind === 'pact') return pactOfferRow(o); if (o.kind === 'shopbid') return shopBidRow(o); const r = E.ITEMS[o.item], m = S.market[o.item].price, on = F.acts.some(a => a.type === 'deal' && a.id === o.id), k = o.price / m; const ok = o.kind === 'buy' ? p.inv[o.item] >= o.qty : freeCash() >= o.qty * o.price || on;
      return `<div class="res"><span class="ri">${r.icon}</span><div class="grow"><div style="font-size:14px">${esc(o.who)}${o.rival != null ? ' <span class="tagg r">前金つき</span>' : ''}${E.isRare(o.item) ? ' <span class="tagg y">レア</span>' : ''}</div>${o.rival != null ? `<div class="t3">納めると、${esc(S.players[o.rival].name)}の${E.GOODS[E.RARES[o.item].use].name}が目玉商品で強くなる</div>` : ''}<div class="t2" style="margin:0">${o.kind === 'buy' ? `あなたの<b>${r.name}</b>を <b>${fmt(o.qty)}</b>個、1個 <b>${o.price.toFixed(2)}G</b> で買いたい` : `<b>${r.name}</b>を <b>${fmt(o.qty)}</b>個、1個 <b>${o.price.toFixed(2)}G</b> で売りたい`}</div><div class="t3">相場 ${m.toFixed(2)}G の <b class="${(o.kind === 'buy') === (k > 1) ? 'up' : 'down'}">${Math.round(k * 100)}%</b> · 合計 ${fmt(o.qty * o.price)}G${o.kind === 'buy' && !ok ? ` · <span class="down">在庫 ${fmt(p.inv[o.item])} では足りない</span>` : ''}</div></div>
        <button class="btn sm ${on ? 'warm' : 'pri'}" data-a="deal" data-v="${o.id}" ${ok || on ? '' : 'disabled'}>${on ? '受ける ✓' : '受ける'}</button></div>`; }).join('')}</div><div class="t3">申し出は今月だけ。「次の月へ」で決まる。相場より高く買ってくれる相手には売り、安く売ってくれる相手からは買うのが基本。でも相場が動く前に…?</div>` : '<div class="box t2">今月は申し出がない。</div>';
  return head('🛒', '市場', '値段は町の倉の在庫で決まる。在庫が減ると値上がり、増えると値下がり') + tabs + body + `<div class="t3" style="margin-top:8px">📦 在庫は「生産(季節・天気・出来事)」で増え、「町の人の消費(高いと控える)」と「みんなの店の仕入れ」で減る。プレイヤーが買えば減り、売れば増える。</div>`;
};
// ── オンライン対戦
const MPNAME = 'capital-mp-name', MPSAVE = 'capital-mp-v1';
const mpName = () => { try { return localStorage.getItem(MPNAME) || ''; } catch (e) { return ''; } };
const mpLoad = () => { try { const j = JSON.parse(localStorage.getItem(MPSAVE) || 'null'); return j && j.code ? j : null; } catch (e) { return null; } };
// ホストは町の状態ごと保存(アプリを閉じても再開できる)。参加者は部屋の番号だけ
function mpSave() { if (!F.mp) return; try { localStorage.setItem(MPSAVE, JSON.stringify(NET.host ? { role: 'host', code: NET.code, name: NET.name, seats: F.mpSeats, S, t: Date.now() } : { role: 'guest', code: NET.code, name: NET.name, stage: S.stage, mt: S.t, t: Date.now() })); } catch (e) { } }
const mpClear = () => { try { localStorage.removeItem(MPSAVE); } catch (e) { } };
const STAMPS = ['👍', '😂', '😱', '🔥', '💰', '🙏', 'よろしく!', 'うまい!', 'やられた…', 'まだまだ!', '次は負けない', '待ってね'];
const humansOf = () => (F.mpSeats || []).map((x, i) => ({ ...x, i })).filter(x => !x.ai);
SHEETS.online = () => {
  const head0 = head('🌐', '友だちと対戦', 'ひとりがホストになり、部屋の番号を友だちに送る');
  const sv = mpLoad();
  if (!NET.on || NET.status !== 'live') return head0 + (sv && !F.mp ? `<div class="box"><div class="t2" style="margin-bottom:6px">前の対戦(部屋 <b>${esc(sv.code)}</b>・${sv.role === 'host' ? 'ホスト' : '参加'})</div><button class="btn wide warm" data-a="mpresume">🔁 対戦に戻る</button></div>` : '') + `<div class="box"><div class="lbl">あなたの名前</div><input id="mpname" class="inp" maxlength="10" value="${esc(mpName() || '')}" placeholder="例: たろう商会"></div>
    <div class="box"><button class="btn wide warm" data-a="mpcreate">🏠 部屋を作る(ホスト)</button></div>
    <div class="box"><div class="lbl">部屋の番号</div><div class="row" style="gap:8px"><input id="mpcode" class="inp" maxlength="5" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase;letter-spacing:.2em;flex:1" value="${esc(F.joinCode || '')}" placeholder="ABCDE"><button class="btn pri" data-a="mpjoin">入る</button></div></div>
    ${NET.status === 'connecting' ? '<div class="t2">⏳ つないでいます…</div>' : NET.status === 'error' ? '<div class="alertbox">つながらなかった。電波を確認して、もう一度ためしてね</div>' : ''}
    <div class="t3">最大4人。空いた席はAIの商会が入り、始まったあとでもAIの席に途中参加できる。ホストのスマホが月を進める計算をする。ホストがアプリを閉じても、あとで「対戦に戻る」で続きから再開できる。</div>`;
  const mem = NET.members, seats = F.mpSeats || [];
  let h = head0 + `<div class="box" style="text-align:center"><div class="lbl">部屋の番号</div><div style="font-size:34px;font-weight:800;letter-spacing:.25em">${NET.code}</div><button class="btn sm" data-a="mpshare" style="margin-top:6px">📨 友だちに送る</button>${F.mp && seats.some(x => x.ai && x.open) ? '<div class="t3" style="margin-top:6px">対戦中でも、AIの席に途中参加できる</div>' : ''}</div>`;
  if (F.mp) {
    h += `<div class="box"><div class="lbl">席</div>${seats.map((x, i) => { const p = S.players[i], on = x.ai ? null : NET.online(x.cid); return `<div class="row" style="align-items:center;gap:8px;margin:6px 0"><div class="grow t2" style="margin:0">${pname(p)} ${i === ME ? '(あなた)' : ''}${x.ai ? ' <span class="tagg">AI</span>' : on ? ' <span class="tagg g">オンライン</span>' : ' <span class="tagg r">通信なし</span>'}${!x.ai && NET.ready && NET.ready[i] ? ' ✅' : ''}</div>${NET.host && !x.ai && i !== ME ? `<button class="btn sm" data-a="mpai" data-v="${i}">AIに任せる</button>` : ''}${NET.host && x.ai && x.left ? `<span class="t3">戻ったら返す</span>` : ''}</div>`; }).join('')}</div>`;
  } else {
    h += `<div class="box"><div class="lbl">いる人(${mem.length}/4)</div>${mem.map(m => `<div class="t2" style="margin:4px 0">${m.host ? '👑' : '🙂'} ${esc(m.name || '名なし')}${m.cid === NET.cid ? '(あなた)' : ''}</div>`).join('')}</div>`;
    if (NET.host) { const st = F.mpStage || 'rose', mo = F.months || 36, lv = F.level || 'hard';
      h += `<div class="box"><div class="lbl">町</div><div class="seg" style="margin-bottom:8px">${Object.entries(E.STAGES).map(([k, v]) => `<button class="${st === k ? 'on' : ''}" data-a="mpset" data-k="mpStage" data-v="${k}">${v.icon}<small>${v.name}</small></button>`).join('')}</div>
      <div class="lbl">長さ</div><div class="seg" style="margin-bottom:8px">${[12, 24, 36, 60].map(v => `<button class="${mo === v ? 'on' : ''}" data-a="mpset" data-k="months" data-v="${v}">${v / 12}年</button>`).join('')}</div>
      <div class="lbl">AIの強さ(空いた席)</div><div class="seg">${Object.entries(E.AI_LEVEL).map(([k, L]) => `<button class="${lv === k ? 'on' : ''}" data-a="mpset" data-k="level" data-v="${k}">${L.name}</button>`).join('')}</div></div>
      <button class="btn wide warm" data-a="mpstart">この顔ぶれで始める(${Math.min(4, mem.length)}人${mem.length < 4 ? ` + AI ${4 - mem.length}` : ''})</button>`; }
    else h += `<div class="box t2">⏳ ホストが始めるのを待っています…</div>`;
  }
  h += `<button class="btn wide" data-a="mpleave" style="margin-top:10px">部屋を出る</button>`;
  return h;
};
async function mpConnect(code, host) {
  const nm = (($('#mpname') && $('#mpname').value) || mpName() || 'ゲスト').trim().slice(0, 10) || 'ゲスト'; try { localStorage.setItem(MPNAME, nm); } catch (e) { }
  NET.status = 'connecting'; renderSheet();
  const ok = await joinRoom(code, nm, host);
  if (!ok) { NET.on = false; NET.status = 'error'; renderSheet(); return false; }
  sfx('notify'); renderSheet(); return true;
}
// 通信の状態を画面の上に小さく出す(ホストがいない・つなぎ直し中)
function netBadge() {
  let el = $('#mpnet'); let msg = '';
  if (F.mp) {
    if (NET.status !== 'live') msg = '📡 つなぎ直しています…';
    else if (!NET.host && !NET.hostOnline()) msg = '👑 ホストの通信が切れています。戻るのを待っています…';
  }
  if (!msg) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'mpnet'; document.body.appendChild(el); }
  el.textContent = msg;
}
NET.on_('members', (mem) => {
  if (F.sheet === 'online') renderSheet(); netBadge(); updateWait();
  if (F.mp) { const prev = F.mpSeen || new Set(), now = new Set(mem.map(m => m.cid)); for (const x of humansOf()) { if (x.cid === NET.cid) continue; if (prev.size && prev.has(x.cid) && !now.has(x.cid)) toast(`📡 ${x.name}の通信が切れた`); if (prev.size && !prev.has(x.cid) && now.has(x.cid)) toast(`🙌 ${x.name}がもどってきた`); } F.mpSeen = now; }
});
NET.on_('status', () => { if (F.sheet === 'online') renderSheet(); netBadge(); });
// つなぎ直したら、参加者は町の状態を確かめ直す。ホストは全員にいまの町を配り直す
NET.on_('live', ({ again }) => { netBadge(); if (NET.host) { if (F.mp && again) netSend({ k: 'state', S, seats: F.mpSeats, fx: [], errors: [], t: S.t, re: 1 }); return; } if (F.mp) netSend({ k: 'sync', cid: NET.cid, t: S.t }); else netSend({ k: 'hello', cid: NET.cid, name: NET.name }); });
// ホスト: 入ってきた人に席と町を渡す。前にいた人には同じ席、新しい人にはAIの空き席
NET.on_('hello', (m) => {
  if (!F.mp) return;
  let seat = F.mpSeats.findIndex(x => x.cid === m.cid);
  if (seat < 0) seat = F.mpSeats.findIndex(x => x.ai && x.left === m.cid);   // AIに任せていた席を返す
  if (seat < 0 && !S.over) seat = F.mpSeats.findIndex(x => x.ai && x.open && !x.left);
  if (seat >= 0 && F.mpSeats[seat].ai) { mpSeatHuman(seat, m.cid, m.name); toast(`🙌 ${m.name}が${S.players[seat].name}の席に入った`); netSend({ k: 'state', S, seats: F.mpSeats, fx: [], errors: [], t: S.t, re: 1 }); mpSave(); render(); return; }
  netSend({ k: 'state', to: m.cid, S, seats: F.mpSeats, fx: [], errors: [], t: S.t, re: 1 });
});
NET.on_('syncReq', (m) => { if (F.mp) netSend({ k: 'state', to: m.cid, S, seats: F.mpSeats, fx: [], errors: [], t: S.t, re: 1 }); });
NET.on_('bye', (m) => { if (!F.mp) return; const i = F.mpSeats.findIndex(x => x.cid === m.cid); if (i >= 0) { toast(`👋 ${F.mpSeats[i].name}が抜けた。AIが引き継ぐ`); mpSeatAI(i); netSend({ k: 'state', S, seats: F.mpSeats, fx: [], errors: [], t: S.t, re: 1 }); mpSave(); if (F.mpChk) F.mpChk(); render(); } });
// 席の持ち主を入れかえる
const AIP_LV = { hard: E.AIP_LEARNED, oni: E.AIP_DEEP, maou: E.AIP_MAOU };
function mpSeatAI(i) { const x = F.mpSeats[i], p = S.players[i]; F.mpSeats[i] = { ai: 'balanced', name: p.name, open: 1, left: x.cid }; p.ai = 'balanced'; p.human = false; p.smart = S.level !== 'normal'; p.aip = AIP_LV[S.level]; delete NET.ready[i]; }
function mpSeatHuman(i, cid, name) { const p = S.players[i]; F.mpSeats[i] = { cid, name }; p.ai = null; p.human = true; p.smart = false; p.aip = undefined; if (name) p.name = name; }
// 参加者: 始まり・入り直し
async function mpAdopt(m, quiet) {
  if (NET.mySeat < 0) { if (!F.mp) toast('この対戦は満席で、空いた席がない'); return; }
  const same = F.mp && S && S.stage === m.S.stage && F.mpBuilt;
  if (same && m.S.t !== S.t) F.acts = [];   // 月が進んでいたら、前の月の予定は捨てる
  F.mp = true; F.mpSeats = m.seats; ME = NET.mySeat; S = m.S; E.useStage(S.stage);
  if (!same) {
    F.acts = []; closeSheet(); $('.title') && $('.title').remove(); $('#loading').classList.remove('off');
    await board.build(S.stage); F.mpBuilt = true;
    setTimeout(() => $('#loading').classList.add('off'), 200);
  }
  await board.sync(S, ME); labels(); render(); if (!same) board.home(); board.setWeather(S.t ? S.w : 'sun'); board.setProsperity(avgProsper());
  mpSave(); netBadge();
  if (!quiet) { if (same) toast('🔄 町の状態をそろえた'); else if (S.t === 0) showVS(() => {}); else toast(`🌐 ${E.STAGES[S.stage].name}で対戦! あなたは ${S.players[ME].name}`); }
}
NET.on_('start', (m) => { mpAdopt(m); });
NET.on_('state', (m) => {
  if (F.mpWait) { F.mpWait(m); return; }
  if (!F.mp || m.t !== S.t || m.re) mpAdopt(m, F.mp && m.t === S.t);
});
NET.on_('ready', () => { updateWait(); if (F.sheet === 'online') renderSheet(); });
// ホストが「まだの人」をつつく
NET.on_('poke', (m) => { if (!F.mp || S.t !== m.t) return; if (F.mpWaiting && F.mpResend) { F.mpResend(); return; } if ((m.need || []).includes(ME) && F.pokedT !== S.t) { F.pokedT = S.t; sfx('notify'); haptic(30); toast(`⏳ みんながあなたの決断を待っている`); } });
NET.on_('closed', () => { if (!F.mp) return; toast('ホストが部屋を閉じた'); });
NET.on_('stamp', (m) => showStamp(m.name, m.s, m.color));
function showStamp(name, s, color) {
  const d = document.createElement('div'); d.className = 'stamp'; d.innerHTML = `<span class="sn" style="background:${color || '#3a7bd5'}">${esc(name)}</span><span class="ss">${esc(s)}</span>`;
  d.style.left = (12 + Math.random() * 40) + 'vw'; document.body.appendChild(d); setTimeout(() => d.remove(), 3200); sfx('pop');
}
function updateWait() {
  let w = $('#mpwait'); if (!F.mpWaiting) { if (w) w.remove(); return; }
  if (!w) { w = document.createElement('div'); w.id = 'mpwait'; document.body.appendChild(w); }
  const humans = humansOf(), r = NET.ready || {}, waitS = Math.floor((Date.now() - (F.mpWaitSince || Date.now())) / 1000);
  const offline = humans.filter(x => !r[x.i] && x.cid !== NET.cid && !NET.online(x.cid));
  w.innerHTML = `<div>⏳ みんなの決断を待っています(${humans.filter(x => r[x.i]).length}/${humans.length})</div><div class="t3">${humans.map(x => `${r[x.i] ? '✅' : NET.online(x.cid) || x.cid === NET.cid ? '💭' : '📡'} ${esc(x.name)}`).join(' · ')}</div>${NET.host && (offline.length || waitS > 45) ? `<div class="row" style="gap:6px;justify-content:center;margin-top:6px"><button class="btn sm" data-a="mpskip">待たずに進める</button>${offline.length ? `<button class="btn sm" data-a="mpaiall">通信なしの人をAIに</button>` : ''}</div>` : ''}<div class="row" style="gap:4px;justify-content:center;margin-top:6px">${STAMPS.slice(0, 6).map(s => `<button class="stb" data-a="stamp" data-v="${esc(s)}">${s}</button>`).join('')}</div>`;
}
// 1か月すすめる(オンライン)。ホストが計算して全員に配る
async function mpStep(acts) {
  if (NET.status !== 'live') { toast('通信がつながっていない。つなぎ直しています…'); return null; }
  F.mpWaiting = true; F.mpWaitSince = Date.now();
  const tick = setInterval(updateWait, 1000);
  try {
    if (NET.host) {
      NET.ready[ME] = { acts, policy: me().policy || null, t: S.t }; netSend({ k: 'ready', ready: readyMap() }); updateWait();
      let poke = 0;
      await new Promise((res) => {
        F.mpGo = res;
        const chk = () => { if (humansOf().every(x => NET.ready[x.i] && NET.ready[x.i].t === S.t)) res(); };
        F.mpChk = chk; chk();
        poke = setInterval(() => { const need = humansOf().filter(x => !(NET.ready[x.i] && NET.ready[x.i].t === S.t)).map(x => x.i); netSend({ k: 'poke', t: S.t, need }); }, 6000);
      });
      clearInterval(poke);
      const dec = {};
      for (const x of humansOf()) { const m = NET.ready[x.i]; dec[x.i] = m && m.t === S.t ? m.acts || [] : []; if (m && m.policy) S.players[x.i].policy = m.policy; }
      const think = await aiThink();
      const r = E.step(S, { ...think, ...dec });
      NET.ready = {};
      await netSend({ k: 'state', S, seats: F.mpSeats, fx: r.fx, errors: r.errors, t: S.t }); netSend({ k: 'ready', ready: {} });
      mpSave();
      return r;
    } else {
      const t0 = S.t, msg = { k: 'acts', seat: ME, cid: NET.cid, t: t0, acts, policy: me().policy || null };
      F.mpResend = () => netSend(msg);
      const m = await new Promise((res) => {
        F.mpWait = (m) => { if (m.t > t0) res(m); else if (m.t === t0) { F.mpSeats = m.seats; netSend(msg); } };   // ホストが入り直した → もう一度送る
        netSend(msg);
      });
      S = m.S; F.mpSeats = m.seats; mpSave(); return { fx: m.fx || [], errors: m.errors || [] };
    }
  } finally { clearInterval(tick); F.mpWaiting = false; F.mpWait = null; F.mpGo = null; F.mpChk = null; F.mpResend = null; updateWait(); }
}
const readyMap = () => Object.fromEntries(Object.entries(NET.ready).filter(([, m]) => m.t === S.t).map(([k]) => [k, 1]));
NET.on_('acts', (m) => {
  if (!F.mp || m.t !== S.t) return; const i = F.mpSeats.findIndex(x => x.cid === m.cid); if (i < 0) return;
  NET.ready[i] = m; netSend({ k: 'ready', ready: readyMap() }); updateWait(); if (F.mpChk) F.mpChk();
});
async function mpResume() {
  const sv = mpLoad(); if (!sv) return;
  try { localStorage.setItem(MPNAME, sv.name); } catch (e) { }
  if (sv.role === 'host') {
    if (!sv.S || sv.S.v !== 10) { mpClear(); return toast('前の対戦のデータが古い'); }
    $('.title') && $('.title').remove(); $('#loading').classList.remove('off');
    S = sv.S; F.mpSeats = sv.seats; F.mp = true; ME = 0; F.acts = []; E.useStage(S.stage);
    await board.build(S.stage); F.mpBuilt = true; await board.sync(S, ME); labels(); render(); board.home(); board.setWeather(S.t ? S.w : 'sun'); board.setProsperity(avgProsper());
    setTimeout(() => $('#loading').classList.add('off'), 200);
    NET.lastLive = 0;
    const ok = await joinRoom(sv.code, sv.name, true);
    if (!ok) { toast('つながらなかった。電波のいい所でもう一度'); netBadge(); return; }
    netSend({ k: 'state', S, seats: F.mpSeats, fx: [], errors: [], t: S.t, re: 1 });
    closeSheet(); toast(`🔁 部屋 ${sv.code} を再開した`);
  } else {
    openSheet('online'); const ok = await joinRoom(sv.code, sv.name, false);
    if (!ok) { NET.status = 'error'; renderSheet(); return; }
    renderSheet(); toast('ホストからの返事を待っています…');
  }
}
// 契約: いま結んでいる契約・売掛金と買掛金・来月の資金繰り・新しい契約の申し込み
const pactLine = (c) => { const r = E.ITEMS[c.item], sell = c.seller === ME, who = S.players[sell ? c.buyer : c.seller]; return `<b>${esc(who.name)}</b>${sell ? 'に' : 'から'} ${r.icon}${r.name} 毎月<b>${fmt(c.qty)}</b>個 · 1個 <b>${c.price.toFixed(2)}G</b> · ${c.pay ? '<span class="tagg y">翌月払い</span>' : '<span class="tagg">その月払い</span>'}`; };
function shopBidRow(o) {
  const t = S.shops.find(x => x.id === o.shop); if (!t) return ''; const on = F.acts.some(a => a.type === 'deal' && a.id === o.id), v = E.shopValue(S, t), avg = t.hist.slice(-3).reduce((a, b) => a + b, 0) / 3;
  return `<div class="res"><span class="ri">${gd(t).icon}</span><div class="grow"><div style="font-size:14px">${esc(o.who)} <span class="tagg r">店の買い取り</span></div><div class="t2" style="margin:0">あなたの<b>${gd(t).name}(${E.DISTRICTS[t.d].short})</b>を <b>${fmt(o.price)}G</b> で買いたい</div><div class="t3">帳簿の店の価値 ${fmt(v)}G · 最近の利益 月${sign(Math.round(avg))}G。売れば現金が入るが、その店の稼ぎは${esc(S.players[o.rival].name)}のものになる</div></div>
    <button class="btn sm ${on ? 'warm' : ''}" data-a="deal" data-v="${o.id}">${on ? '売る ✓' : '売る'}</button></div>`;
}
function pactOfferRow(o) {
  const c = o.pact, on = F.acts.some(a => a.type === 'deal' && a.id === o.id), m = S.market[c.item].price, k = c.price / m, sell = c.seller === ME;
  return `<div class="res"><span class="ri">📝</span><div class="grow"><div style="font-size:14px">${esc(o.who)} <span class="tagg b">契約の申し込み</span></div><div class="t2" style="margin:0">${sell ? 'あなたが売る' : 'あなたが買う'}: ${pactLine(c)} · ${c.months}か月</div><div class="t3">相場の${Math.round(k * 100)}%。${sell ? (c.pay ? '代金は翌月に入る(その間の資金繰りに注意)' : '代金はその月に入る') : (c.pay ? '支払いは翌月でいい(手元のお金に余裕ができる)' : 'その月に払う')}。足りない月は不足分の${Math.round(E.PACT_SHORT * 100)}%を違約金として払う</div></div>
    <button class="btn sm ${on ? 'warm' : 'pri'}" data-a="deal" data-v="${o.id}">${on ? '結ぶ ✓' : '結ぶ'}</button></div>`;
}
function pactTab() {
  const p = me(), mine = (S.pacts || []).filter(c => c.left > 0 && (c.seller === ME || c.buyer === ME));
  const recvIn = (S.recv || []).filter(r => r.to === ME), recvOut = (S.recv || []).filter(r => r.from === ME);
  const flow = mine.reduce((a, c) => a + (c.pay ? 0 : (c.seller === ME ? 1 : -1) * c.qty * c.price), 0) + recvIn.reduce((a, r) => a + r.amt, 0) - recvOut.reduce((a, r) => a + r.amt, 0);
  const fixed = E.fixedCosts ? E.fixedCosts(S, ME) : 0;
  let h = `<div class="box"><div class="t1" style="margin-bottom:4px">💰 来月の資金繰り</div><div class="kv"><span class="k">いまの現金(予定込み)</span><span class="num">${fmt(freeCash())}G</span></div><div class="kv"><span class="k">契約・売掛金の出入り</span><span class="num ${cls(flow)}">${sign(Math.round(flow))}G</span></div><div class="kv"><span class="k">家賃とお給料(目安)</span><span class="num down">-${fmt(Math.round(fixed))}G</span></div>${freeCash() + flow - fixed < 0 ? '<div class="alertbox">⚠️ このままだと来月お金が足りなくなる。足りない分は高い利息の救済融資になる</div>' : ''}</div>`;
  h += `<div class="box"><div class="t1" style="margin-bottom:4px">📝 結んでいる契約</div>${mine.length ? mine.map(c => `<div class="t2" style="margin:6px 0">${c.seller === ME ? '📤' : '📥'} ${pactLine(c)}<br><span class="t3">のこり${c.left}か月 · これまで${fmt(c.done)}個${c.short ? ` · 不足${fmt(c.short)}個` : ''}</span></div>`).join('') : '<div class="t3">まだない。下から申し込める</div>'}</div>`;
  if (recvIn.length || recvOut.length) h += `<div class="box"><div class="t1" style="margin-bottom:4px">🧾 売掛金と支払い</div>${recvIn.map(r => { const on = F.acts.some(a => a.type === 'factor' && a.id === r.id); return `<div class="row" style="align-items:center;gap:8px;margin:6px 0"><div class="grow t2" style="margin:0">📥 ${esc(S.players[r.from].name)}から来月 <b>${fmt(r.amt)}G</b></div><button class="btn sm ${on ? 'warm' : ''}" data-a="factor" data-v="${r.id}">${on ? '今すぐ受け取る ✓' : `今すぐ ${fmt(Math.round(r.amt * (1 - E.FACTOR_FEE)))}G`}</button></div>`; }).join('')}${recvOut.map(r => `<div class="t2" style="margin:6px 0">📤 来月 <b>${fmt(r.amt)}G</b> を払う(${r.bridge ? 'つなぎ融資' : r.to >= 0 ? esc(S.players[r.to].name) + 'へ' : 'ギルドへ'})</div>`).join('')}<div class="t3">売掛金はギルドに${Math.round(E.FACTOR_FEE * 100)}%引きで売れば、今月お金になる(ファクタリング)</div></div>`;
  const brOn = F.acts.find(a => a.type === 'bridge'), brOut = (S.recv || []).some(r => r.from === ME && r.bridge);
  h += `<div class="box"><div class="t1" style="margin-bottom:4px">🏦 つなぎ融資</div><div class="t3" style="margin-bottom:6px">1か月だけ借りて、翌月に${Math.round(E.BRIDGE_RATE * 100)}%の利息をつけて返す。仕入れや出店のお金が一時的に足りないときに</div><div class="seg">${[200, 500, E.BRIDGE_MAX].map(v => `<button class="${brOn && brOn.amt === v ? 'on' : ''}" data-a="bridge" data-v="${v}" ${brOut ? 'disabled' : ''}>${fmt(v)}G<small>来月 ${fmt(Math.round(v * (1 + E.BRIDGE_RATE)))}G</small></button>`).join('')}</div></div>`;
  // 申し込み
  const f = F.pf = F.pf || { to: S.players.find(x => x.id !== ME).id, role: 'sell', item: 'flour', qty: 20, pk: 1, months: 3, pay: 0 };
  const items = Object.keys(E.ITEMS).filter(k => !E.isRare(k)), to = S.players[f.to], m = S.market[f.item].price, price = Math.round(m * f.pk * 100) / 100;
  const use = f.role === 'sell' ? E.useOf(S, f.to, f.item) : (to.inv[f.item] || 0) / 3 + E.makeOf(S, f.to, f.item), lvl = use >= f.qty ? 'たくさん' : use >= f.qty * 0.5 ? 'すこし' : use > 0 ? 'わずか' : 'ほぼない';
  const pend = F.acts.filter(a => a.type === 'propose');
  h += `<div class="box"><div class="t1" style="margin-bottom:6px">✍️ 契約を持ちかける</div>
    <div class="lbl">相手</div><div class="seg" style="margin-bottom:8px">${S.players.filter(x => x.id !== ME).map(x => `<button class="${f.to === x.id ? 'on' : ''}" data-a="pf" data-k="to" data-v="${x.id}"><span style="color:${x.color}">●</span>${esc(x.name)}</button>`).join('')}</div>
    <div class="seg" style="margin-bottom:8px"><button class="${f.role === 'sell' ? 'on' : ''}" data-a="pf" data-k="role" data-v="sell">📤 売る</button><button class="${f.role === 'buy' ? 'on' : ''}" data-a="pf" data-k="role" data-v="buy">📥 買う</button></div>
    <div class="lbl">品物</div><div class="chips" style="margin-bottom:8px">${items.map(k => `<button class="chip ${f.item === k ? 'on' : ''}" data-a="pf" data-k="item" data-v="${k}">${E.ITEMS[k].icon}${E.ITEMS[k].name}</button>`).join('')}</div>
    <div class="row" style="gap:8px;align-items:center;margin-bottom:8px"><div class="lbl" style="flex:1">毎月の数</div><div class="stepper"><button data-a="pfq" data-v="-1">−</button><b style="min-width:44px;text-align:center">${fmt(f.qty)}</b><button data-a="pfq" data-v="1">+</button></div></div>
    <div class="lbl">値段(相場 ${m.toFixed(2)}G の)</div><div class="seg" style="margin-bottom:8px">${[0.9, 0.95, 1, 1.05, 1.1].map(k => `<button class="${f.pk === k ? 'on' : ''}" data-a="pf" data-k="pk" data-v="${k}">${Math.round(k * 100)}%<small>${(m * k).toFixed(2)}G</small></button>`).join('')}</div>
    <div class="seg" style="margin-bottom:8px">${[3, 6].map(v => `<button class="${f.months === v ? 'on' : ''}" data-a="pf" data-k="months" data-v="${v}">${v}か月</button>`).join('')}${[[0, 'その月払い'], [1, '翌月払い']].map(([v, n]) => `<button class="${f.pay === v ? 'on' : ''}" data-a="pf" data-k="pay" data-v="${v}">${n}</button>`).join('')}</div>
    <div class="insight">🔎 ${esc(to.name)}は${E.ITEMS[f.item].name}を ${f.role === 'sell' ? `使う量が<b>${lvl}</b>` : `売れる量が<b>${lvl}</b>`}(毎月${fmt(f.qty)}個に対して)。${f.role === 'sell' ? '使わない相手は買わない。翌月払いにすると相手は受けやすいが、あなたのお金が入るのは1か月あと' : '翌月払いだと相手は高めの値段を求める'}</div>
    <div class="t3" style="margin:6px 0">合計 毎月 ${fmt(f.qty * price)}G × ${f.months}か月。${f.role === 'sell' ? '在庫が足りない月は不足分の20%を違約金で払う' : ''}</div>
    <button class="btn wide pri" data-a="propose" ${pend.length >= 2 ? 'disabled' : ''}>月末に申し込む</button>
    ${pend.map(a => `<div class="t2" style="margin-top:6px">⏳ ${esc(S.players[a.to].name)}に ${E.ITEMS[a.item].name} ${fmt(a.qty)}個/月 を${a.role === 'sell' ? '売る' : '買う'}契約を申し込む予定 <button class="btn sm" data-a="unpropose" data-v="${a.to}:${a.item}">やめる</button></div>`).join('')}</div>`;
  return h;
}
// 帳簿(自分の店の一覧・借金)
SHEETS.books = () => {
  const p = me(), mine = E.shopsOf(S, ME), sum = mine.reduce((a, s) => a + (s.last ? s.last.profit : 0), 0);
  return head('📒', '帳簿', `${ym(S.t)} · 純資産 ${fmt(E.netWorth(S, p))}G`) +
    `<div class="box"><div class="lbl">先月の利益(合計)</div><div class="big num ${cls(sum)}">${sign(sum)}G</div></div>
    <div class="box">${mine.length ? mine.map(s => { const G = gd(s); return `<button class="shoprow" style="width:100%;text-align:left" data-a="shop" data-id="${s.id}"><span class="ic">${G.icon}</span><div class="grow"><div>${G.name} <span class="t3">${E.DISTRICTS[s.d].short}</span></div><div class="t3">お客 ${s.last ? fmt(s.last.units) : '−'}人 · ${E.PRICE_NAME[s.priceLv]} · 店員${s.staff}人</div></div><div class="num ${cls(s.last ? s.last.profit : 0)}">${s.last ? sign(s.last.profit) : '−'}</div></button>`; }).join('') : '<div class="t2">まだ店がない。町の「+」をタップして開業しよう。</div>'}</div>
    <div class="box"><div class="kv"><span class="k">現金</span><span class="num">${fmt(p.cash)}G</span></div><div class="kv"><span class="k">資源の在庫</span><span class="num">${fmt(E.resValue(S, p))}G</span></div><div class="kv"><span class="k">店の価値</span><span class="num">${fmt(mine.reduce((a, s) => a + E.shopValue(S, s), 0))}G</span></div><div class="kv"><span class="k">借金</span><span class="num ${p.debt > 0 ? 'down' : ''}">${fmt(p.debt)}G</span></div></div>
    <button class="btn wide" data-a="manager" style="margin-bottom:10px">🤵 店長と仕入れ係に任せる</button>
    ${missionBox()}
    ${p.debt > 0 ? `<button class="btn wide" data-a="repay" ${freeCash() >= Math.min(p.debt, 100) ? '' : 'disabled'}>借金を返す(${fmt(Math.min(p.debt, Math.max(0, Math.floor(freeCash() / 100) * 100)))}G)</button>` : ''}`;
};
// カード
SHEETS.card = ({ i }) => {
  const c = me().hand[i], cd = E.cardDef(c), used = pendCard();
  const mine = E.storesOf(S, ME);
  let pick = '';
  const mine2 = cd.spec ? mine.filter(s => s.g === cd.spec) : mine;
  if (cd.need === 'shop') pick = mine2.length ? `<div class="lbl">どの店に?</div>${mine2.map(s => `<button class="shoprow" style="width:100%;text-align:left" data-a="cardgo" data-i="${i}" data-shop="${s.id}"><span class="ic">${gd(s).icon}</span><div class="grow">${gd(s).name} <span class="t3">${E.DISTRICTS[s.d].short}</span></div><span class="btn sm pri">使う</span></button>`).join('')}` : `<div class="t2">${cd.spec ? `${E.GOODS[cd.spec].name}がないと使えない。` : '店がないと使えない。'}</div>`;
  else if (cd.need === 'rival') { const rv = S.shops.filter(x => x.owner !== ME && x.g !== 'work'); pick = rv.length ? `<div class="lbl">どのライバルの店を狙う?</div>${rv.map(s => { const op = S.players[s.owner]; const same = E.shopsOf(S, ME).some(m => m.d === s.d && m.g === s.g); return `<button class="shoprow" style="width:100%;text-align:left" data-a="cardgo" data-i="${i}" data-shop="${s.id}"><span class="ic">${gd(s).icon}</span><div class="grow">${pname(op)} の${gd(s).name} <span class="t3">${E.DISTRICTS[s.d].short} · 先月 ${s.last ? fmt(s.last.units) + '人' : '−'}${same && c === 'poach' ? ' · <b class="up">あなたも同業</b>' : ''}</span></div><span class="btn sm warm">狙う</span></button>`; }).join('')}` : '<div class="t2">ライバルの店がまだない。</div>'; }
  else if (cd.need === 'res') pick = `<div class="lbl">どの資源を?</div>${Object.entries(E.RES).map(([k, r]) => `<button class="shoprow" style="width:100%;text-align:left" data-a="cardgo" data-i="${i}" data-res="${k}"><span class="ic">${r.icon}</span><div class="grow">${r.name} <span class="t3">今 ${S.market[k].price.toFixed(2)}G</span></div><span class="btn sm pri">予約</span></button>`).join('')}`;
  else pick = `<button class="btn pri wide" data-a="cardgo" data-i="${i}">使う</button>`;
  return head(cd.icon, cd.name, cd.cost ? `${fmt(cd.cost)}G` : '無料') + `<div class="box"><div class="t2">${esc(cd.text)}</div></div>
    ${used ? `<div class="box"><div class="t2">今月は「${E.cardDef(used.card).name}」を使う予定。カードは月に1枚まで。</div><button class="btn wide" data-a="cardcancel">予定を取り消す</button></div>` : `<div class="box">${pick}</div>`}
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
// ── 画面のエフェクト(すべての行動に手ごたえを)
const FX = {
  layer() { let l = $('#fxl'); if (!l) { l = document.createElement('div'); l.id = 'fxl'; document.body.appendChild(l); } return l; },
  // 粒がはじける
  burst(x, y, colors = ['#ffd36e', '#ff9a3c', '#fff'], n = 14, emoji) {
    const L = this.layer();
    for (let i = 0; i < n; i++) {
      const d = document.createElement('i'); d.className = 'fxp'; const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 60, sz = emoji ? 16 + Math.random() * 8 : 5 + Math.random() * 6;
      if (emoji) { d.textContent = emoji; d.style.fontSize = sz + 'px'; d.style.background = 'none'; } else { d.style.width = d.style.height = sz + 'px'; d.style.background = colors[i % colors.length]; }
      L.appendChild(d);
      d.animate([{ transform: `translate(${x}px,${y}px) scale(1)`, opacity: 1 }, { transform: `translate(${x + Math.cos(a) * r}px,${y + Math.sin(a) * r - 20}px) scale(.2) rotate(${Math.random() * 360}deg)`, opacity: 0 }], { duration: 500 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      setTimeout(() => d.remove(), 850);
    }
  },
  // 輪が広がる
  ring(x, y, color = '#ffd36e') { const d = document.createElement('i'); d.className = 'fxr'; d.style.borderColor = color; d.style.left = x + 'px'; d.style.top = y + 'px'; this.layer().appendChild(d); setTimeout(() => d.remove(), 650); },
  // 文字が浮かぶ
  float(x, y, text, color = '#1f2a44') { const d = document.createElement('div'); d.className = 'fxf'; d.innerHTML = text; d.style.color = color; d.style.left = x + 'px'; d.style.top = y + 'px'; this.layer().appendChild(d); setTimeout(() => d.remove(), 1200); },
  // はんこ(大きな決定)
  stamp(text, color = '#e5484d') { const d = document.createElement('div'); d.className = 'fxs'; d.textContent = text; d.style.color = color; d.style.borderColor = color; this.layer().appendChild(d); sfx('stamp'); haptic(25); setTimeout(() => d.remove(), 1100); },
  // 画面のゆれ・光
  shake(n = 1) { document.body.classList.remove('shk'); void document.body.offsetWidth; document.body.classList.add('shk'); setTimeout(() => document.body.classList.remove('shk'), 450); },
  flash(color = 'rgba(255,255,255,.7)') { const d = document.createElement('div'); d.className = 'fxfl'; d.style.background = color; this.layer().appendChild(d); setTimeout(() => d.remove(), 450); },
  // 物が飛ぶ(カード・品物)
  fly(from, to, html, cls = '') { const d = document.createElement('div'); d.className = 'fxfly ' + cls; d.innerHTML = html; this.layer().appendChild(d); const a = d.animate([{ transform: `translate(${from.x}px,${from.y}px) scale(1) rotate(0)`, opacity: 1 }, { transform: `translate(${(from.x + to.x) / 2}px,${Math.min(from.y, to.y) - 80}px) scale(1.25) rotate(-8deg)`, opacity: 1, offset: 0.5 }, { transform: `translate(${to.x}px,${to.y}px) scale(.5) rotate(10deg)`, opacity: 0.2 }], { duration: 620, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }); setTimeout(() => d.remove(), 650); return new Promise(r => setTimeout(r, 600)); },
};
const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const shopScreen = (id) => { const s = S.shops.find(x => x.id === id); if (!s) return null; const p = board.screenOfLot(s.lot); return p && p.vis ? p : null; };
// 行動ごとのエフェクト(押したボタンの位置 r、前後の状態から決める)
const ATTACK = new Set(['poach', 'headhunt', 'shout']);
function actionFx(a, d, r, before) {
  const c = center(r), added = F.acts.length > before.n, removed = F.acts.length < before.n, sid = d.id ? +d.id : null, s = sid != null ? S.shops.find(x => x.id === sid) : null;
  const lot = s ? s.lot : null;
  switch (a) {
    case 'setp': { const lv = +d.v, up = s && lv > before.pl; FX.burst(c.x, c.y, up ? ['#ffb84d', '#ffd36e'] : ['#3ccf8e', '#9be7c4']); FX.float(c.x, c.y - 10, up ? '💴 値上げ!' : lv === before.pl ? '💴' : '🏷️ 値下げ!', up ? '#e07b1a' : '#16a34a'); if (lot != null) { board.bounceLot(lot); board.burst(lot, up ? 0xffc53d : 0x3ccf8e, 10); } break; }
    case 'sets': { const up = +d.v > 0; FX.burst(c.x, c.y, ['#7cc7ff', '#4f7cff', '#fff'], 10); FX.float(c.x, c.y - 10, up ? '👤 +1' : '👤 −1', up ? '#2f5fd0' : '#6b7280'); if (lot != null) { board.bounceLot(lot); if (up) board.burst(lot, 0x7cc7ff, 8); } break; }
    case 'seta': { FX.burst(c.x, c.y, ['#ff9a3c', '#ffd36e'], 12, +d.v > 0 ? '📣' : null); FX.float(c.x, c.y - 10, +d.v > 0 ? '📣 宣伝!' : '📣 なし', '#e07b1a'); if (lot != null) { board.bounceLot(lot); if (+d.v > 0) board.burst(lot, 0xff9a3c, 14); } break; }
    case 'setauto': case 'setproc': case 'polbuy': case 'polmax': case 'polstaff': FX.ring(c.x, c.y, '#3ccf8e'); FX.burst(c.x, c.y, ['#3ccf8e', '#fff'], 8); break;
    case 'setfeat': case 'setfeatq': FX.burst(c.x, c.y, ['#c79bff', '#fff', '#7c4dff'], 16, d.v ? '💎' : null); if (lot != null) board.burst(lot, 0xc79bff, 18); if (d.v) FX.float(c.x, c.y - 10, '💎 目玉商品!', '#7c4dff'); break;
    case 'hire': FX.stamp('ようこそ!', '#2fb77a'); FX.burst(c.x, c.y, ['#ffd36e', '#3ccf8e', '#7cc7ff', '#ff9aa8'], 22); if (lot != null) board.pillar(lot, 0x9be7c4); break;
    case 'fire': FX.float(c.x, c.y - 10, '👋 おつかれさま', '#6b7280'); FX.burst(c.x, c.y, ['#c9ced9'], 8); break;
    case 'route': if (added) { FX.stamp('育て方 決定!', '#7c4dff'); if (lot != null) board.pillar(lot, 0xc79bff); } break;
    case 'routecancel': case 'cancelopen': case 'unpropose': case 'cardcancel': FX.float(c.x, c.y - 10, '↩︎ 取り消し', '#6b7280'); FX.burst(c.x, c.y, ['#c9ced9', '#fff'], 8); break;
    case 'closeshop': FX.stamp('閉店…', '#6b7280'); if (lot != null) board.burst(lot, 0x9aa3b5, 16, 0.5); break;
    case 'mgo': if (added) { const la = F.acts[F.acts.length - 1]; if (la.type === 'buy') { coinFly(cashPos(), c, 8); FX.float(c.x, c.y - 16, `📦 +${fmt(la.qty)}個`, '#2f5fd0'); FX.burst(c.x, c.y, ['#7cc7ff', '#fff'], 14); } else { coinFly(c, cashPos(), 8); FX.float(c.x, c.y - 16, `💰 ${fmt(la.qty)}個 売り!`, '#e07b1a'); FX.burst(c.x, c.y, ['#ffd36e', '#fff'], 14); } } break;
    case 'mcancel': FX.float(c.x, c.y - 10, '↩︎ 取り消し', '#6b7280'); break;
    case 'buy': if (added) { coinFly(cashPos(), c, 6); FX.float(c.x, c.y - 14, `📦 +${fmt(F.acts[F.acts.length - 1].qty)}`, '#2f5fd0'); FX.burst(c.x, c.y, ['#7cc7ff', '#fff'], 10); } break;
    case 'sell': if (added) { coinFly(c, cashPos(), 6); FX.float(c.x, c.y - 14, `💰 売り!`, '#e07b1a'); FX.burst(c.x, c.y, ['#ffd36e', '#fff'], 10); } break;
    case 'deal': if (added) { FX.stamp('取引成立!', '#e07b1a'); coinFly(c, cashPos(), 6); } else FX.float(c.x, c.y - 10, '↩︎ やめた', '#6b7280'); break;
    case 'propose': FX.stamp('申し込み!', '#2f5fd0'); break;
    case 'factor': case 'bridge': if (added) { coinFly(c, cashPos(), 8); FX.float(c.x, c.y - 12, '💰 入金予定!', '#16a34a'); } break;
    case 'repay': if (added) { coinFly(cashPos(), c, 8); FX.stamp('返済!', '#16a34a'); } break;
    case 'vote': FX.stamp('投票!', '#2f5fd0'); FX.burst(c.x, c.y, ['#7cc7ff', '#fff'], 12, '🗳️'); break;
    case 'questtake': FX.stamp('受注!', '#e07b1a'); break;
    case 'questdeliver': coinFly(c, cashPos(), 8); FX.stamp('納品!', '#16a34a'); break;
    case 'buyshop': FX.stamp('買い取りを申し込む', '#e5484d'); break;
    case 'repayall': break;
    case 'next': FX.ring(c.x, c.y, '#ff7a59'); FX.burst(c.x, c.y, ['#ffb84d', '#ff7a59', '#fff'], 18); break;
    case 'card': FX.ring(c.x, c.y, '#7c4dff'); break;
    case 'cardgo': { const ca = F.acts.find(x => x.type === 'card'); if (!ca) break; const cd = E.cardDef(ca.card), hand = document.querySelectorAll('#dock .card')[ca.idx];
      const from = hand ? center(hand.getBoundingClientRect()) : c, tgt = ca.shop != null ? shopScreen(ca.shop) : null, to = tgt || { x: innerWidth / 2, y: innerHeight * 0.4 };
      FX.fly(from, to, `<span class="fxcard">${cd.spec ? '🧑‍🍳' : cd.icon}<small>${cd.name}</small></span>`).then(() => {
        const atk = ATTACK.has(cd.base) && ca.shop != null && S.shops.find(x => x.id === ca.shop && x.owner !== ME);
        if (atk) { FX.flash('rgba(255,77,94,.25)'); FX.shake(); board.shock(S.shops.find(x => x.id === ca.shop).lot); sfx('bad'); } else { FX.burst(to.x, to.y, ['#c79bff', '#ffd36e', '#fff'], 18); if (ca.shop != null) board.burst(S.shops.find(x => x.id === ca.shop).lot, 0xc79bff, 16); }
        FX.float(to.x, to.y - 20, `🃏 ${cd.name}${atk ? ' 予約!' : ''}`, atk ? '#e5484d' : '#7c4dff');
      }); break; }
    default: break;
  }
}
// 月末: 決まったことが動き出すときのエフェクト(地図の上)
function monthFx(fx) {
  let k = 0; const later = (f) => setTimeout(f, 250 + (k++) * 220);
  for (const f of fx) {
    const sh = f.shop != null ? S.shops.find(x => x.id === f.shop) : null;
    if (f.kind === 'open' && sh) later(() => { board.pillar(sh.lot, Number('0x' + E.COLOR_HEX[S.players[f.pid].color].slice(1))); if (f.pid === ME) sfx('build'); });
    if (f.kind === 'card' && sh && f.target === ME && ATTACK.has(f.card)) later(() => { board.shock(sh.lot); FX.flash('rgba(255,77,94,.3)'); FX.shake(); sfx('bad'); });
    else if (f.kind === 'card' && sh) later(() => board.burst(sh.lot, 0xc79bff, 14));
    if (f.kind === 'route' && sh) later(() => board.pillar(sh.lot, 0xc79bff));
    if (f.kind === 'buyshop' && sh) later(() => { board.pillar(sh.lot, 0xffd36e); if (f.pid === ME || f.from === ME) FX.stamp(f.pid === ME ? '買い取り成功!' : '店を買われた!', f.pid === ME ? '#16a34a' : '#e5484d'); });
    if (f.kind === 'hire' && f.pid === ME && sh) later(() => board.pillar(sh.lot, 0x9be7c4));
    if (f.kind === 'peddler') later(() => { board.setPeddler(true); if (board.peddlerObj) { const p = board.peddlerObj.position; board.view.tx = p.x * 0.5 + board.view.tx * 0.5; } FX.stamp('行商人が来た!', '#7c4dff'); sfx('notify'); });
  }
}
function salesFx(sales) {
  for (const f of sales) { const sh = S.shops.find(x => x.id === f.shop); if (!sh) continue; if (f.profit > 0) board.burst(sh.lot, f.pid === ME ? 0xffd36e : 0xfff1c0, f.pid === ME ? Math.min(26, 8 + Math.round(f.profit / 15)) : 6); else if (f.pid === ME) board.burst(sh.lot, 0x6b8cc7, 8, -0.3); }
}
// ── 建設モード: 建物を選ぶ → 地図に見込みが出る → 場所をタップ → 建てる!
const BUILD_INFO = { bread: '安くて毎日売れる。数で稼ぐ', potion: '冒険者と病気の季節に強い', tool: '高く売れるが、数は少ない', cloth: 'お祭りと貴族に人気', work: '原料を加工して市場に卸す' };
function buildCost(g) { const ds = [...new Set(E.LOTS.map(l => l.d))].map(d => E.openCost(d, g)); return [Math.min(...ds), Math.max(...ds)]; }
function lotEstimate(lot, g, res) {
  const L = E.LOTS[lot];
  if (g === 'work') { const R = E.RES[res || 'wheat'], P = E.PROC[R.proc], mg = S.market[R.proc].price * (1 - E.SPREAD) - S.market[res || 'wheat'].price * (1 + E.SPREAD); return { profit: Math.round(mg * P.rate * 2 - E.WAGE * 2 - E.DISTRICTS[L.d].rent), cost: E.openCost(L.d, 'work') }; }
  const v = E.lotValue(S, ME, lot, g); return { profit: Math.round(v.profit), cost: v.cost };
}
const RATES = [{ c: 0x1fae5b, m: '◎', n: 'よく儲かりそう' }, { c: 0xe0a100, m: '○', n: 'ふつう' }, { c: 0xe5484d, m: '△', n: '厳しい' }];
const rateOf = (lot, p) => F.build && F.build.rank && F.build.rank[lot] != null ? RATES[F.build.rank[lot]] : RATE(p);
const RATE = (p) => p >= 60 ? { c: 0x1fae5b, m: '◎', n: 'よく儲かりそう' } : p >= 15 ? { c: 0xe0a100, m: '○', n: 'ふつう' } : { c: 0xe5484d, m: '△', n: '厳しい' };
const freeLots = () => E.LOTS.filter(l => E.lotFree(S, l.id) && !F.acts.some(a => a.type === 'open' && a.lot === l.id));
function buildStart(lot) {
  if (S.over || F.busy) return;
  const mine = E.shopsOf(S, ME).length + F.acts.filter(a => a.type === 'open').length;
  if (mine >= E.MAX_SHOPS) return toast(`お店は${E.MAX_SHOPS}つまで`);
  closeSheet(); F.build = { step: 'type', lot: lot ?? null }; sfx('open'); haptic(8); render();
}
function buildPick(g, res) {
  F.build.g = g; F.build.res = res || null;
  if (g === 'work' && !res) { F.build.step = 'res'; render(); return; }
  if (F.build.lot != null) { F.build.step = 'confirm'; board.showRatings([ratingOf(F.build.lot)]); render(); return; }
  F.build.step = 'place';
  // 色は候補の中での順位(上位3分の1が◎)。数字は見込みの利益そのもの
  const es = freeLots().map(l => ({ lot: l.id, e: lotEstimate(l.id, F.build.g, F.build.res) })).sort((a, b) => b.e.profit - a.e.profit);
  F.build.rank = Object.fromEntries(es.map((x, i) => [x.lot, x.e.profit < 0 ? 2 : i < es.length / 3 ? 0 : i < es.length * 2 / 3 ? 1 : 2]));
  board.showRatings(es.map(x => ratingOf(x.lot)));
  document.body.classList.add('placing');
  board.home(); render(); sfx('card');
}
function ratingOf(lot) { const e = lotEstimate(lot, F.build.g, F.build.res), R = rateOf(lot, e.profit); return { lot, color: R.c, text: `${R.m} ${e.profit >= 0 ? '+' : ''}${e.profit}G` }; }
// 来月かかるお金(家賃・お給料・宣伝・借金の利息。予定の新しい店も含む)
function nextFixed() { const base = E.fixedCosts(S, ME); const opens = F.acts.filter(a => a.type === 'open').reduce((a, x) => a + E.DISTRICTS[E.LOTS[x.lot].d].rent + E.WAGE * (x.staff || 2), 0); return base + opens; }
function buildEnd() { document.body.classList.remove('placing'); F.build = null; board.clearRatings(); board.highlightLot(-1); render(); }
function buildTray() {
  const B = F.build, step = B.step;
  if (step === 'type' || step === 'res') {
    const cards = Object.entries(E.GOODS).map(([g, G]) => [g, G.icon, G.name]).concat([['work', '🏭', '工房']]);
    const one = B.lot != null ? E.DISTRICTS[E.LOTS[B.lot].d] : null;
    return `<div class="btray"><div class="bth"><b>🔨 ${one ? `${one.name}に何を建てる?` : '何を建てる?'}</b><button class="bx" data-a="buildcancel">✕</button></div>
      <div class="bcards">${cards.map(([g, ic, nm], i) => { const [lo, hi] = one ? [E.openCost(E.LOTS[B.lot].d, g), 0] : buildCost(g); const can = freeCash() >= lo; return `<button class="bcard ${B.g === g ? 'on' : ''} ${can ? '' : 'poor'}" data-a="buildpick" data-v="${g}" style="animation-delay:${i * 0.05}s"><span class="bi">${ic}</span><b>${nm}</b><small>${BUILD_INFO[g]}</small><em>${fmt(lo)}${hi && hi !== lo ? '〜' : ''}G</em></button>`; }).join('')}</div>
      ${step === 'res' ? `<div class="bres"><div class="t3">何を加工する?</div>${Object.entries(E.RES).map(([k, R]) => `<button class="chip" data-a="buildres" data-v="${k}">${R.icon}${R.name}→${E.ITEMS[R.proc].icon}</button>`).join('')}</div>` : ''}
      <div class="t3" style="text-align:center">💰 使えるお金 <b>${fmt(freeCash())}G</b></div></div>`;
  }
  if (step === 'place') {
    const G = B.g === 'work' ? { icon: '🏭', name: '工房' } : E.GOODS[B.g];
    return `<div class="btray"><div class="bth"><b>${G.icon} ${G.name}を建てる場所をタップ!</b><button class="bx" data-a="buildcancel">✕</button></div>
      <div class="blegend"><span style="--c:#1fae5b">◎ よく儲かりそう</span><span style="--c:#e0a100">○ ふつう</span><span style="--c:#e5484d">△ 厳しい</span></div>
      <div class="t3" style="text-align:center">数字は1か月の利益の見込み(お客の多さ・ライバル・家賃から計算)。◎は候補の中で上位3分の1</div>
      <button class="btn sm" data-a="buildback" style="margin:6px auto 0;display:block">◀ 建物を選び直す</button></div>`;
  }
  if (step === 'confirm') {
    const L = E.LOTS[B.lot], D = E.DISTRICTS[L.d], e = lotEstimate(B.lot, B.g, B.res), R = rateOf(B.lot, e.profit), G = B.g === 'work' ? { icon: '🏭', name: '工房' } : E.GOODS[B.g];
    const comp = B.g === 'work' ? 0 : S.shops.filter(s => s.d === L.d && s.g === B.g).length, ok = freeCash() >= e.cost;
    const left = freeCash() - e.cost, monthly = Math.round(nextFixed() + D.rent + E.WAGE * 2), risky = ok && left < monthly;
    const nb = E.NEIGHBORS[B.lot].map(l => E.shopAt(S, l)).filter(Boolean), street = nb.some(o => o.owner === ME && o.g !== B.g), steal = nb.some(o => o.owner !== ME && o.g === B.g);
    return `<div class="btray"><div class="bth"><b>${G.icon} ${G.name} @ ${D.name}</b><button class="bx" data-a="buildcancel">✕</button></div>
      <div class="bconf"><div class="bstat" style="--c:#${R.c.toString(16).padStart(6, '0')}"><span>${R.m}</span><b>${e.profit >= 0 ? '+' : ''}${fmt(e.profit)}G</b><small>月の利益の見込み</small></div>
      <div class="bfacts"><div>🏷️ 建てるお金 <b>${fmt(e.cost)}G</b></div><div>🏠 家賃 <b>${D.rent}G</b>/月</div>${B.g !== 'work' ? `<div>⚔️ 同じ業種のライバル <b>${comp}店</b></div>` : ''}${L.road ? '<div>🛣️ 大通り沿い 客+12%</div>' : ''}${street ? '<div class="up">🏘️ 商店街ボーナス</div>' : ''}${steal ? '<div class="up">🥊 隣のライバルから客を奪える(安くすれば)</div>' : ''}</div></div>
      <div class="bleft ${risky ? 'risk' : ''}"><span>建てたあとの現金</span><b>${fmt(left)}G</b><small>毎月の家賃とお給料(この店も入れて) 約 <b>${fmt(monthly)}G</b></small>${risky ? `<div>⚠️ 来月の支払いが足りず、<b>借金</b>になるかも(銀行が1割の手数料つきで貸す)</div>` : ''}</div>
      <button class="btn ${risky ? 'danger' : 'warm'} wide bgo" data-a="buildgo" ${ok ? '' : 'disabled'}>${!ok ? 'お金が足りない' : risky ? `⚠️ それでも建てる  −${fmt(e.cost)}G` : `🔨 ここに建てる!  −${fmt(e.cost)}G`}</button>
      <div class="row" style="gap:8px;margin-top:6px"><button class="btn sm" style="flex:1" data-a="buildother">📍 別の場所</button><button class="btn sm" style="flex:1" data-a="builddetail">🔎 くわしく</button></div></div>`;
  }
  return '';
}
// お金が飛んでいく(使う)・飛んでくる(稼ぐ)
function coinFly(from, to, n = 8) {
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div'); c.className = 'fcoin'; c.textContent = 'G'; document.body.appendChild(c);
    const dx = to.x - from.x, dy = to.y - from.y, mx = (Math.random() - 0.5) * 80, delay = i * 45;
    c.animate([{ transform: `translate(${from.x}px,${from.y}px) scale(.6)`, opacity: 0 }, { transform: `translate(${from.x + dx * 0.5 + mx}px,${from.y + dy * 0.5 - 70}px) scale(1.1)`, opacity: 1, offset: 0.5 }, { transform: `translate(${to.x}px,${to.y}px) scale(.7)`, opacity: 0.9 }], { duration: 650, delay, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    setTimeout(() => c.remove(), 700 + delay);
  }
}
const cashPos = () => { const el = $('#cashv'); if (!el) return { x: innerWidth / 2, y: 40 }; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - 10, y: r.top + r.height / 2 - 10 }; };
// ── 商会の顔ぶれ(ライバルが見えるように)
const LOOK_BY_NAME = { 'ベルナ': { b: 3, h: 3, hat: -1, tint: 0xff9a9a, cape: 0 }, 'グスタフ': { b: 1, h: 2, hat: 2, tint: 0xffd77a, cape: 1 }, 'ミレイユ': { b: 2, h: 1, hat: 1, tint: 0xa6e6a0, cape: 0 } };
const LOOK_HUMAN = [{ b: 0, h: 0, hat: -1, tint: 0x9ac2ff, cape: 1 }, { b: 3, h: 3, hat: 1, tint: 0xc9a6ff, cape: 0 }, { b: 1, h: 4, hat: -1, tint: 0xffb27a, cape: 1 }, { b: 2, h: 1, hat: -1, tint: 0x8fe0e0, cape: 0 }];
const LINES = { cheap: '安さこそ正義! 町じゅうのお客をいただくよ', luxury: '本物の品は、高くても売れるのだ', hoarder: '材料を押さえた者が、町を制するのよ', balanced: 'こつこつ堅実に、いちばんを取る' };
const playerLook = (p) => p.human ? LOOK_HUMAN[p.id % 4] : LOOK_BY_NAME[p.name] || LOOK_HUMAN[(p.id + 1) % 4];
const avatar = (p, sz = 40) => { const u = board && board.portrait ? board.portrait(playerLook(p)) : ''; return u ? `<img src="${u}" width="${sz}" height="${sz}" alt="">` : `<span style="font-size:${sz * 0.6}px">${p.human ? '🙂' : '🧑‍💼'}</span>`; };
// 画面上のライバルの列(順位つき)。考え中は💭、動いたら吹き出し
function rivalsBar() {
  let el = $('#rivals'); if (!S || $('.title')) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'rivals'; document.body.appendChild(el); }
  const rk = E.ranking(S);
  const html = rk.map((x, i) => { const p = x.p, n = E.shopsOf(S, p.id).length; return `<button class="rv ${p.id === ME ? 'me' : ''} ${F.thinking && p.ai ? 'think' : ''}" data-a="ranking" data-pid="${p.id}" style="--c:${E.COLOR_HEX[p.color]}"><span class="rvf">${avatar(p, 38)}</span><span class="rvr">${i + 1}</span><span class="rvn">${p.id === ME ? 'あなた' : esc(p.name)}</span><span class="rvs">🏠${n}</span></button>`; }).join('');
  if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
}
function rivalSay(pid, text, ms = 3200) {
  const b = document.querySelector(`#rivals .rv[data-pid="${pid}"]`); if (!b) return;
  const r = b.getBoundingClientRect(), d = document.createElement('div'); d.className = 'rsay';
  d.innerHTML = text; d.style.top = (r.top + 2) + 'px'; d.style.right = (innerWidth - r.left + 8) + 'px';
  document.body.appendChild(d); b.classList.add('talk'); setTimeout(() => { d.classList.add('out'); b.classList.remove('talk'); setTimeout(() => d.remove(), 300); }, ms);
}
// ライバルの今月の動きを、ひとことにする
function rivalLines(fx) {
  const out = {};
  const put = (pid, pr, t) => { if (pid === ME || !S.players[pid] || S.players[pid].human) return; if (!out[pid] || out[pid].pr < pr) out[pid] = { pr, t }; };
  for (const f of fx) {
    const sh = f.shop != null ? S.shops.find(x => x.id === f.shop) : null;
    if (f.kind === 'open' && sh) put(f.pid, 3, `${E.DISTRICTS[sh.d].short}に<b>${gd(sh).icon}${gd(sh).name}</b>を出したよ!`);
    if (f.kind === 'buyshop') put(f.pid, 5, `${f.from === ME ? 'あなたの' : ''}店を<b>${fmt(f.price)}G</b>で買い取った!`);
    if (f.kind === 'card' && f.target === ME) put(f.pid, 6, `あなたの店に<b>${E.CARDS[f.card] ? E.CARDS[f.card].name : '攻撃'}</b>を仕掛けた!`);
    else if (f.kind === 'card' && E.CARDS[f.card]) put(f.pid, 1, `「${E.CARDS[f.card].name}」を使った`);
    if (f.kind === 'route' && sh) put(f.pid, 2, `${gd(sh).name}を${E.ROUTES[f.k].icon}${E.ROUTES[f.k].name}で育てる`);
    if (f.kind === 'close') put(f.pid, 4, `店をひとつ、たたんだ…`);
    if (f.kind === 'pactYes' && (f.to === ME || f.pid === ME)) put(f.pid === ME ? f.to : f.pid, 4, `契約成立。よろしく頼むよ`);
  }
  // 何もしなかったライバルは、順位で一言
  const rk = E.ranking(S).map(x => x.p.id);
  for (const p of S.players) if (p.ai && !out[p.id] && Math.random() < 0.5) put(p.id, 0, rk[0] === p.id ? 'ふふ、この調子でいくわ' : rk.indexOf(p.id) > rk.indexOf(ME) ? '次は抜かしてみせる…!' : 'まだまだ、これから');
  return out;
}
// ── ライバルの動きを地図で見せる: カメラがその場所へ飛び、建物の上で吹き出しを出す(タップで早送り)
async function rivalTour(fx) {
  const ev = [];
  for (const f of fx) {
    const pid = f.pid; if (pid == null || pid === ME || !S.players[pid] || S.players[pid].human && !F.mp) continue;
    const sh = f.shop != null ? S.shops.find(x => x.id === f.shop) : null; if (!sh) continue;
    if (f.kind === 'open') ev.push({ pid, lot: sh.lot, pr: 3, t: `${E.DISTRICTS[sh.d].short}に <b>${gd(sh).name}</b> を建てた!`, fx: 'pillar' });
    if (f.kind === 'card' && f.target === ME && ATTACK.has(f.card)) ev.push({ pid, lot: sh.lot, pr: 6, t: `あなたの店に <b>${E.CARDS[f.card].name}</b>!`, fx: 'shock' });
    if (f.kind === 'buyshop') ev.push({ pid, lot: sh.lot, pr: 5, t: `店を <b>${fmt(f.price)}G</b> で買い取った!`, fx: 'pillar' });
    if (f.kind === 'route') ev.push({ pid, lot: sh.lot, pr: 2, t: `${gd(sh).name}を <b>${E.ROUTES[f.k].name}</b> で育てる`, fx: 'burst' });
  }
  if (!ev.length) return;
  ev.sort((a, b) => b.pr - a.pr); const list = ev.slice(0, 4);
  let skip = false; const sk = () => { skip = true; }; document.addEventListener('pointerdown', sk, { once: true });
  for (const e of list) {
    if (skip) break;
    board.focus(e.lot); await wait(650);
    const p = S.players[e.pid], col = E.COLOR_HEX[p.color];
    if (e.fx === 'pillar') board.pillar(e.lot, Number('0x' + col.slice(1))); if (e.fx === 'shock') { board.shock(e.lot); FX.flash('rgba(255,77,94,.3)'); FX.shake(); sfx('bad'); } if (e.fx === 'burst') board.burst(e.lot, 0xc79bff, 16);
    const pos = board.screenOfLot(e.lot), d = document.createElement('div'); d.className = 'mapsay'; d.style.setProperty('--c', col);
    d.innerHTML = `<span class="msf">${avatar(p, 44)}</span><div><b>${esc(p.name)}</b><span>${e.t}</span></div>`; d.style.left = Math.max(150, Math.min(innerWidth - 150, pos.x)) + 'px'; d.style.top = Math.max(200, pos.y - 30) + 'px';
    document.body.appendChild(d); sfx('pop'); haptic(10);
    await wait(skip ? 300 : 1500); d.classList.add('out'); setTimeout(() => d.remove(), 300);
  }
  document.removeEventListener('pointerdown', sk);
  board.home(); await wait(400);
}
// ── 始まりの演出: 顔ぶれの紹介(VS) → GAME START!
function showVS(onDone) {
  const st = E.STAGES[S.stage], L = E.AI_LEVEL[S.level] || {};
  const el = document.createElement('div'); el.id = 'vs';
  const me0 = S.players[ME], rivals = S.players.filter(p => p.id !== ME);
  el.innerHTML = `<div class="vsin"><div class="vst">${st.icon} ${st.name}</div><div class="vss">${S.months / 12}年の商売バトル · ライバル: <b>${L.name || ''}</b></div>
    <div class="vsme" style="--c:${E.COLOR_HEX[me0.color]}"><span class="vf">${avatar(me0, 84)}</span><div><b>${me0.human && ME === 0 && !F.mp ? 'あなた' : esc(me0.name)}</b><small>所持金 ${fmt(me0.cash)}G からスタート</small></div></div>
    <div class="vsx">VS</div>
    <div class="vsr">${rivals.map((p, i) => `<div class="vsc" style="--c:${E.COLOR_HEX[p.color]};animation-delay:${0.25 + i * 0.15}s"><span class="vf">${avatar(p, 64)}</span><b>${esc(p.name)}</b><small>${p.human ? '🙂 プレイヤー' : (E.AI_KIND[p.ai] || {}).name || ''}</small><q>${p.human ? 'よろしく!' : LINES[p.ai] || ''}</q></div>`).join('')}</div>
    <button class="btn warm vsgo" data-a="vsgo">⚔️ 勝負開始!</button></div>`;
  document.body.appendChild(el); sfx('whoosh'); F.vsDone = onDone;
}
function gameStart() {
  const el = $('#vs'); if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 350); }
  const b = document.createElement('div'); b.className = 'gstart'; b.innerHTML = `<div>GAME START!</div><small>${ym(S.t)} · 1位をめざせ</small>`; document.body.appendChild(b);
  sfx('rankup'); bgm.jingle(true); haptic(40); confetti(); setTimeout(() => b.remove(), 2000);
  board.view.dist = 44; board.home();
  rivalsBar();
  setTimeout(() => { const f = F.vsDone; F.vsDone = null; if (f) f(); }, 1300);
}
// 月の始まりの見出し
function monthBanner() {
  const b = document.createElement('div'); b.className = 'mbanner';
  const mo = S.t % 12, se = mo < 2 || mo === 11 ? '❄️ 冬' : mo < 5 ? '🌸 春' : mo < 8 ? '☀️ 夏' : '🍂 秋';
  b.innerHTML = `<small>${Math.floor(S.t / 12) + 1}年目 ${mo + 1}月 · ${se}</small><div>TURN ${S.t + 1}<i>/${S.months}</i></div><em>${S.months - S.t <= 3 ? `のこり ${S.months - S.t} ターン!` : '作戦タイム'}</em>`; sfx('whoosh');
  document.body.appendChild(b); setTimeout(() => b.remove(), 1700);
}
// ── やること(はじめの目標)。1つずつ出して、できたら「クリア!」
const QKEY = 'capital-quests-v1';
const QUESTS = [
  { id: 'open', t: '<b>🔨建てる</b>を押すか地図の<b>＋</b>をタップして、店を建てよう', ok: () => E.shopsOf(S, ME).length > 0 || F.acts.some(a => a.type === 'open') },
  { id: 'next', t: '準備ができたら<b>「次の月へ」</b>を押そう', ok: () => S.t >= 1 },
  { id: 'set', t: '自分の店をタップして、<b>値段か店員</b>を変えてみよう', ok: () => F.acts.some(a => a.type === 'set') || qDone('set') },
  { id: 'card', t: '下の<b>カード</b>を1枚使ってみよう', ok: () => F.acts.some(a => a.type === 'card') || qDone('card') },
  { id: 'market', t: '<b>🛒市場</b>で材料の値段を見てみよう', ok: () => F.sheet === 'market' || qDone('market') },
  { id: 'rank', t: '上の<b>ライバルの顔</b>をタップして順位を見よう', ok: () => F.sheet === 'ranking' || qDone('rank') },
  { id: 'two', t: '<b>2つ目の店</b>を開いて、稼ぎを増やそう', ok: () => E.shopsOf(S, ME).length + F.acts.filter(a => a.type === 'open').length >= 2 },
];
const qState = () => { try { return JSON.parse(localStorage.getItem(QKEY) || '{}'); } catch (e) { return {}; } };
const qDone = (id) => !!qState()[id];
function questTick() {
  if (!S || F.mp && false) return;
  let el = $('#quest'); const st = qState();
  if (st.all || S.over || $('.title') || $('#vs') || $('#tut')) { if (el) el.remove(); return; }
  for (const q of QUESTS) if (!st[q.id] && q.ok()) { st[q.id] = 1; try { localStorage.setItem(QKEY, JSON.stringify(st)); } catch (e) { } questClear(); }
  const cur = QUESTS.find(q => !st[q.id]);
  if (!cur) { st.all = 1; try { localStorage.setItem(QKEY, JSON.stringify(st)); } catch (e) { } toast('🎉 基本はバッチリ! あとは1位をめざそう'); if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'quest'; document.body.appendChild(el); }
  const n = QUESTS.filter(q => st[q.id]).length, html = `<div class="qh">🎯 やること <span>${n + 1}/${QUESTS.length}</span></div><div class="qt">${cur.t}</div>`;
  if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; el.classList.remove('qin'); void el.offsetWidth; el.classList.add('qin'); }
  el.style.display = F.sheet || F.busy || F.build ? 'none' : '';
}
function questClear() { const d = document.createElement('div'); d.className = 'qclear'; d.textContent = '✔ クリア!'; document.body.appendChild(d); sfx('kaching'); haptic(20); setTimeout(() => d.remove(), 1300); }
// ── チュートリアル(めくって読む、ゲーム風の遊び方)
const TUT = [
  { hero: '🏆', bg: ['#ffcf5c', '#ff8a5c'], tag: 'ゴール', title: '町いちばんの商会になれ!', body: '最後の月に<b>純資産</b>がいちばん多い人の勝ち。', vis: () => `<div class="tv-eq"><span>💰<small>現金</small></span><i>+</i><span>📦<small>在庫</small></span><i>+</i><span>🏠<small>店の価値</small></span><i>−</i><span>💸<small>借金</small></span></div><div class="tv-note">儲かり続けている店ほど、価値が高い</div>` },
  { hero: '🏠', bg: ['#7cc7ff', '#4f7cff'], tag: 'STEP 1', title: '＋をタップして店を開く', body: '地図の白い<b>＋</b>が空き地。業種を選ぶと、月末に店が建つ。', vis: () => `<div class="tv-row">${['🥖', '🧪', '⚒️', '🧵'].map((x, i) => `<span class="tv-ic" style="animation-delay:${i * 0.12}s">${x}</span>`).join('')}</div><div class="tv-note">パン屋・薬屋・鍛冶屋・仕立て屋</div>` },
  { hero: '🧑‍🍳', bg: ['#8be0b5', '#2fb77a'], tag: 'STEP 2', title: '値段・店員・広告を決める', body: '店をタップして調整。<b>🔮</b>で来月の利益が見積もれる。', vis: () => `<div class="tv-sl"><div><span>💴 値段</span><b style="--w:45%"></b></div><div><span>🧑 店員</span><b style="--w:65%"></b></div><div><span>📣 広告</span><b style="--w:30%"></b></div></div><div class="tv-note">安い → 客は増えるが、1個の儲けは減る</div>` },
  { hero: '⚔️', bg: ['#ff9aa8', '#e8436a'], tag: 'バトル', title: 'ライバルとお客を奪い合う', body: '同じ地区・同じ業種の店どうしで取り合い。', vis: () => `<div class="tv-row"><span class="tv-pill r">真横に安い店 → 客を奪う</span><span class="tv-pill g">別業種を並べる → 商店街ボーナス</span></div>` },
  { hero: '🃏', bg: ['#c9a2ff', '#7c4dff'], tag: 'カード', title: '毎月3枚、1枚だけ使える', body: '呼び込み・値引き・職人・攻撃…ここぞで使おう。', vis: () => `<div class="tv-cards">${[['📣', '呼び込み'], ['🥊', '客引き合戦'], ['🏦', '融資']].map(([i, n], k) => `<span style="--r:${(k - 1) * 9}deg">${i}<small>${n}</small></span>`).join('')}</div>` },
  { hero: '🛒', bg: ['#ffd36e', '#f2a51a'], tag: '市場', title: '材料は安いときに買いだめ', body: '値段は町の倉の在庫で決まる。みんなが買うと値上がり。', vis: () => `<div class="tv-bars">${[60, 45, 35, 50, 72, 90].map((h, i) => `<b style="--h:${h}%;animation-delay:${i * 0.08}s"></b>`).join('')}</div><div class="tv-note">収穫の後は安い・不作の年は高い</div>` },
  { hero: '🔮', bg: ['#7ad7e8', '#2a9bc4'], tag: '予報', title: '来月を読んで先回り', body: '天気と出来事の予報を見て、人手や仕入れを先に合わせる。', vis: () => `<div class="tv-row">${['☀️ 晴れ', '🌧️ 雨', '⛵ 商船', '🎪 祭り'].map(x => `<span class="tv-pill">${x}</span>`).join('')}</div>` },
  { hero: '🤝', bg: ['#a5e37a', '#5aa82e'], tag: 'もっと稼ぐ', title: '契約・町の依頼・店の買い取り', body: 'ライバルと毎月の取引を結んだり、町の依頼を受けたり、店を買い取ったり。', vis: () => `<div class="tv-row"><span class="tv-pill">📝 契約</span><span class="tv-pill">🏛️ 依頼・投票</span><span class="tv-pill">🏪 買い取り</span></div>` },
  { hero: '🏰', bg: ['#ffb3d9', '#e05aa8'], tag: '最後の年', title: '王都の大祭で一発逆転', body: '最後の月にボーナスが入る。', vis: () => `<div class="tv-bonus"><div>👑<b>地区の覇者</b><small>その地区で一番お客を集めた</small><em>+${E.CROWN_BONUS}G</em></div><div>🤫<b>秘密の目標</b><small>あなただけのお題を達成</small><em>+${E.MISSION_BONUS}G</em></div></div>` },
  { hero: '⏭️', bg: ['#ffb84d', '#ff7a59'], tag: 'さあ!', title: '決めたら「次の月へ」', body: 'みんなの決断が<b>同時に</b>動く。結果を見て、次の作戦を立てよう!', vis: () => `<div class="tv-go">次の月へ</div>` },
];
function showTut(start = 0) {
  closeSheet();
  let el = $('#tut'); if (el) el.remove();
  el = document.createElement('div'); el.id = 'tut'; document.body.appendChild(el);
  F.tutI = start; renderTut(0);
  // 左右スワイプでめくる
  let x0 = null, y0 = 0;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) H.tutgo({ v: dx < 0 ? 1 : -1 }); });
}
function renderTut(dir) {
  const el = $('#tut'); if (!el) return; const i = F.tutI, P = TUT[i], last = i === TUT.length - 1;
  el.innerHTML = `<div class="tcard ${dir > 0 ? 'fromR' : dir < 0 ? 'fromL' : 'pop'}">
    <div class="tprog">${TUT.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"></i>`).join('')}</div>
    <button class="tskip" data-a="tutclose">${last ? '' : 'スキップ'}</button>
    <div class="thero" style="background:linear-gradient(140deg,${P.bg[0]},${P.bg[1]})"><span class="ttag">${P.tag}</span><span class="tem">${P.hero}</span><span class="tsp s1">✦</span><span class="tsp s2">✦</span><span class="tsp s3">•</span></div>
    <div class="tbody"><h2>${P.title}</h2><p>${P.body}</p><div class="tvis">${P.vis()}</div></div>
    <div class="tnav"><button class="btn tback" data-a="tutgo" data-v="-1" ${i ? '' : 'style="visibility:hidden"'}>◀</button><div class="tcount">${i + 1} / ${TUT.length}</div><button class="btn ${last ? 'warm' : 'pri'} tnext" data-a="${last ? 'tutclose' : 'tutgo'}" data-v="1">${last ? 'はじめる!' : 'つぎへ ▶'}</button></div>
    ${last ? '<button class="tmore" data-a="rules">📜 ルールをくわしく読む</button>' : ''}
  </div>`;
}
// はじめての人への道案内: 地図の＋を指さす → 「次の月へ」を指さす
const COACH = 'capital-coach-done';
function coachTick() {
  let el = $('#coach');
  const done = (() => { try { return localStorage.getItem(COACH) === '1'; } catch (e) { return true; } })();
  let step = null;
  if (!done && S && !S.over && !F.mp && !F.sheet && !F.build && !$('#tut') && !$('#vs') && !$('.title') && !F.busy && S.t === 0) step = F.acts.some(a => a.type === 'open') ? 'next' : E.shopsOf(S, ME).length ? null : 'open';
  if (!done && S && S.t >= 1) { try { localStorage.setItem(COACH, '1'); } catch (e) { } }
  document.body.classList.toggle('coaching', step === 'open');
  if (!step) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'coach'; document.body.appendChild(el); }
  if (step === 'open') {
    if (F.coachLot == null || !E.lotFree(S, F.coachLot)) {
      // 家賃の安い地区の、地区名の札に重ならない(中心から少し離れた)空き地
      const d = Object.keys(E.DISTRICTS).sort((a, b) => E.DISTRICTS[a].rent - E.DISTRICTS[b].rent)[0], ls = E.LOTS.filter(l => l.d === d), cq = ls.reduce((a, l) => a + l.q, 0) / ls.length, cr = ls.reduce((a, l) => a + l.r, 0) / ls.length;
      const fr = ls.filter(l => E.lotFree(S, l.id)).map(l => ({ l, dc: Math.hypot(l.q - cq, l.r - cr), dm: Math.abs(l.q) + Math.abs(l.r) }));
      fr.sort((a, b) => (b.dc >= 1.8) - (a.dc >= 1.8) || a.dm - b.dm); F.coachLot = fr[0] ? fr[0].l.id : (E.LOTS.find(l => E.lotFree(S, l.id)) || {}).id;
    }
    const p = F.coachLot != null && board.screenOfLot(F.coachLot); if (!p || !p.vis) { el.style.display = 'none'; return; }
    el.style.display = ''; el.className = 'cmap'; el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.style.bottom = ''; el.style.right = '';
    if (el.dataset.s !== 'open') { el.dataset.s = 'open'; el.innerHTML = `<div class="cring"></div><div class="cfinger">👆</div><div class="cbub">ここをタップして<br><b>店を開こう!</b></div>`; }
  } else {
    const go = $('#dock .go'); if (!go) return; const r = go.getBoundingClientRect();
    el.style.display = ''; el.className = 'cgo'; el.style.left = 'auto'; el.style.top = 'auto'; el.style.right = (innerWidth - r.right + 6) + 'px'; el.style.bottom = (innerHeight - r.top - 6) + 'px'; el.style.setProperty('--fx', (r.width / 2 - 28) + 'px');
    if (el.dataset.s !== 'next') { el.dataset.s = 'next'; el.innerHTML = `<div class="cbub">準備OK!<br><b>「次の月へ」</b>で店が建つ</div><div class="cfinger down">👇</div>`; }
  }
}
// 勝ち方(遊び方と順位の画面に出す)
const winBox = () => `<div class="box winbox"><div class="t1">🏆 勝ち方</div><div class="t2" style="margin:4px 0 0">最後の月が終わったとき、<b>純資産</b>がいちばん多い商会が勝ち。<br><b>純資産</b> = 現金 + 在庫(いまの相場) + 店の価値 − 借金<br><span class="t3">店の価値 = 建てたお金の半分ほど + 育て方にかけたお金の半分 + <b>最近6か月の平均利益×6</b>。儲かっている店ほど高い。</span><br>最後に上乗せ: <b>👑 地区の覇者</b>(最終月に地区で一番お客を集めた) +${E.CROWN_BONUS}G ずつ · <b>🤫 秘密の目標</b>達成 +${E.MISSION_BONUS}G</div></div>`;
SHEETS.ranking = () => {
  const rk = E.ranking(S);
  const W = 320, H = 140, all = S.players.flatMap(p => p.nw), mx = Math.max(...all, 1), mn = Math.min(0, ...all);
  const lines = S.players.map(p => { const n = p.nw.length; return `<polyline fill="none" stroke="${E.COLOR_HEX[p.color]}" stroke-width="${p.id === ME ? 3 : 2}" points="${p.nw.map((v, i) => `${(i / Math.max(1, S.months) * W).toFixed(1)},${(H - (v - mn) / (mx - mn) * (H - 10) - 5).toFixed(1)}`).join(' ')}"/>`; }).join('');
  return head('🏆', '順位', `純資産(現金+店+在庫−借金)で競う · のこり${S.months - S.t}か月`) +
    winBox() + `<div class="box">${rk.map((x, i) => `<div class="rk"><span class="pos" style="background:${E.COLOR_HEX[x.p.color]}">${i + 1}</span><div class="nm">${esc(x.p.name)}${x.p.id === ME ? ' <span class="ai-chip">あなた</span>' : `<span class="ai-chip">${x.p.human ? '🙂 プレイヤー' : E.AI_KIND[x.p.ai] ? E.AI_KIND[x.p.ai].name : ''}</span>`}<small>店 ${E.shopsOf(S, x.p.id).length}つ</small>${nwParts(x.p)}</div><div class="num" style="font-size:17px">${fmt(x.nw)}G</div></div>`).join('')}</div>
    <div class="box"><div class="lbl">純資産の動き</div><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${lines}</svg></div>
    ${crownBox()}${missionBox()}`;
};
function crownBox() {
  const cr = S.crowns || E.crownsOf(S);
  return `<div class="box"><div class="lbl">👑 地区の覇者 <span class="grow"></span><span class="t3">${E.finalYear(S) ? '最終月の結果で決まる' : '大祭(最後の年)で決まる'}</span></div>${Object.entries(E.DISTRICTS).map(([d, D]) => { const c = cr[d]; return `<div class="kv"><span class="k">${D.name}</span><span>${c ? pname(S.players[c.pid]) + ` <span class="t3">${fmt(c.units)}人</span>` : '<span class="t3">まだいない</span>'}</span></div>`; }).join('')}<div class="t3" style="margin-top:6px">最終月にその地区で一番多くお客を集めた商会に ${E.CROWN_BONUS}G。</div></div>`;
}
function missionBox() {
  const p = me(), M = E.MISSIONS[p.mission], done = E.missionDone(S, p);
  return `<div class="box" style="background:linear-gradient(135deg,#f6f0ff,#fff)"><div class="lbl">🤫 あなたの秘密の目標(+${E.MISSION_BONUS}G)</div><div style="font-size:16px">${M.name} ${done ? '<span class="up">✔ 達成中</span>' : ''}</div><div class="t3">${M.text} · ${E.missionProgress(S, p)}</div><div class="t3" style="margin-top:4px">ライバルにもそれぞれ秘密の目標がある(最後に公開)。</div></div>`;
}
// 月の結果
// ── 決算の演出: 今月のお金の出入りを、1行ずつ画面に出していく(タップで早送り)
const FLOW_ORDER = ['建設', '育て方', 'カード', '市場で買った', '材料の仕入れ', '先物の約束(材料)', '店の売上', '加工品を売った', '市場で売った', '商人との取引', 'ライバルとの取引', '店を売った', '店の買い取り', '店をたたんだ(売った)', 'お給料', '家賃', '宣伝', '保管料', '借金の利息', '借金の返済', '契約・売掛金', 'つなぎ融資(借りた)', '売掛金を前倒し', '町の依頼', '臨時の税', '年末の税', '町の依頼など', '大祭のボーナス', '救済融資(借りた)'];
async function monthReplay() {
  const p = me(), fl = p.flow || {}, c0 = p.cash0 != null ? p.cash0 : p.cash;
  const rows = Object.entries(fl).filter(([, v]) => Math.abs(v) >= 0.5).sort((a, b) => { const ia = FLOW_ORDER.indexOf(a[0]), ib = FLOW_ORDER.indexOf(b[0]); return (ia < 0 ? 50 : ia) - (ib < 0 ? 50 : ib); });
  if (!rows.length) return;
  const el = document.createElement('div'); el.id = 'ledger'; el.innerHTML = `<div class="lgin"><div class="lgh">📜 ${ym(S.t - 1)}の決算 <small>タップで早送り</small></div><div class="lgrows"></div><div class="lgcash"><span>現金</span><b>${fmt(c0)}G</b></div></div>`;
  document.body.appendChild(el); sfx('whoosh');
  let fast = false; el.addEventListener('click', () => { fast = true; });
  const box = el.querySelector('.lgrows'), cashEl = el.querySelector('.lgcash b'); let cash = c0;
  for (const [k, v] of rows) {
    const d = document.createElement('div'); d.className = 'lgr ' + (v >= 0 ? 'in' : 'out') + (k === '救済融資(借りた)' ? ' sos' : '');
    d.innerHTML = `<span>${pix(FLOW_ICON[k] || '•')} ${k}</span><b>${v >= 0 ? '+' : '−'}${fmt(Math.abs(Math.round(v)))}G</b>`; box.appendChild(d);
    const from = cash; cash += v; const t0 = performance.now(), to = cash;
    const roll = (t) => { const kk = Math.min(1, (t - t0) / 300); cashEl.textContent = fmt(Math.round(from + (to - from) * kk)) + 'G'; cashEl.classList.toggle('neg', from + (to - from) * kk < 0); if (kk < 1) requestAnimationFrame(roll); }; requestAnimationFrame(roll);
    if (k === '救済融資(借りた)') { FX.flash('rgba(229,72,77,.3)'); FX.stamp('借金!', '#e5484d'); sfx('bad'); haptic(60); await wait(fast ? 200 : 1100); }
    else { sfx(v >= 0 ? 'coin' : 'tap'); if (v < 0) haptic(6); await wait(fast ? 60 : 420); }
  }
  await wait(fast ? 150 : 900);
  el.classList.add('out'); await wait(250); el.remove();
}
// お金の流れ: 先月の現金 → 項目ごとの出入り → 今の現金
const FLOW_ICON = { '建設': '🏗️', '育て方': '🌱', '店の売上': '🏪', '加工品を売った': '🏭', '材料の仕入れ': '📦', 'お給料': '👷', '家賃': '🏠', '宣伝': '📣', '市場で買った': '🛒', '市場で売った': '💰', 'カード': '🃏', '商人との取引': '🤝', 'ライバルとの取引': '🤝', '借金の返済': '💸', '借金の利息': '💸', 'つなぎ融資(借りた)': '🏦', '救済融資(借りた)': '🆘', '売掛金を前倒し': '🧾', '契約・売掛金': '📝', '先物の約束(材料)': '📝', '店の買い取り': '🏪', '店を売った': '🏪', '店をたたんだ(売った)': '🏚️', '保管料': '🗄️', '臨時の税': '📜', '年末の税': '📜', '町の依頼': '📋', '町の依頼など': '📋', '大祭のボーナス': '👑', 'その他': '•' };
function flowBox() {
  const p = me(), fl = p.flow || {}, c0 = p.cash0 != null ? p.cash0 : p.cash;
  const rows = Object.entries(fl).filter(([, v]) => Math.abs(v) >= 0.5).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '';
  const total = p.cash - c0;
  return `<div class="box flowbox"><div class="lbl">💰 お金の流れ(今月)</div>
    <div class="fl0"><span>先月末の現金</span><b>${fmt(c0)}G</b></div>
    ${rows.map(([k, v], i) => `<div class="flr ${v >= 0 ? 'in' : 'out'}" style="animation-delay:${0.1 + i * 0.06}s"><span>${FLOW_ICON[k] || '•'} ${k}</span><b>${v >= 0 ? '+' : '−'}${fmt(Math.abs(Math.round(v)))}G</b><i style="width:${Math.min(100, Math.abs(v) / Math.max(1, ...rows.map(x => Math.abs(x[1]))) * 100)}%"></i></div>`).join('')}
    <div class="fl1"><span>いまの現金</span><b>${fmt(p.cash)}G</b><small class="${cls(total)}">${sign(Math.round(total))}G</small></div>
    ${fl['建設'] ? `<div class="t3" style="margin-top:6px">🏗️ 建てたお金は消えたわけではなく「店の価値」として純資産に残る</div>` : ''}</div>`;
}
const nwParts = (p) => { const shops = E.shopsOf(S, p.id).reduce((a, s) => a + E.shopValue(S, s), 0), inv = E.resValue(S, p); return `<span class="nwp"><i class="c">現金 ${fmt(p.cash)}</i><i class="s">店 ${fmt(shops)}</i>${inv >= 1 ? `<i class="v">在庫 ${fmt(inv)}</i>` : ''}${p.debt > 0 ? `<i class="d">借金 −${fmt(p.debt)}</i>` : ''}</span>`; };
SHEETS.result = ({ r }) => {
  const mine = r.mine, sum = mine.reduce((a, x) => a + x.profit, 0);
  const tierBox = r.tier1 !== r.tier0 ? `<div class="box tierbox ${r.tier1 > r.tier0 ? 'up' : 'down'}"><div style="font-size:34px">${E.RANKS[r.tier1][2]}</div><div><div class="lbl">${r.tier1 > r.tier0 ? '商会の格が上がった!' : '商会の格が下がった…'}</div><div style="font-size:18px">${E.RANKS[r.tier0][1]} → <b>${E.RANKS[r.tier1][1]}</b></div></div></div>` : '';
  const p = me(), nw = E.netWorth(S, p), nw0 = p.nw.length > 1 ? p.nw[p.nw.length - 2] : nw, c0 = p.cash0 != null ? p.cash0 : p.cash;
  const sos = (p.flow || {})['救済融資(借りた)'];
  const sosBox = sos ? `<div class="box sosbox"><div class="t1">🆘 お金が足りなくなって、借金をした</div><div class="t2" style="margin:4px 0">今月の支払い(建設・材料・お給料・家賃など)のあと、現金が <b class="down">${fmt(Math.round(p.cash - sos))}G</b> になった。だから銀行が <b>${fmt(sos)}G</b> を貸した(返すのは1割増しの <b>${fmt(Math.round(sos * 1.1))}G</b>、毎月 利息 ${Math.round(E.LOAN_RATE * 1000) / 10}%)。</div><div class="t3">下の「お金の流れ」で何に使ったか見られる。返すのは📒帳簿から。次からは、建てる前に「建てたあとの現金」を確認しよう</div></div>` : '';
  return tierBox + sosBox + `<div class="mhead"><div class="mt">${ym(S.t - 1)}の結果 · ${wx(S.w).icon} ${wx(S.w).name}</div></div>
    <div class="stat3">
      <div class="st st-p"><span>店の利益</span><b class="${cls(sum)}" id="cntup">${sign(0)}G</b><small>売上−材料−給料−家賃−宣伝</small></div>
      <div class="st st-c">${ico('coin')}<span>現金</span><b>${fmt(p.cash)}G</b><small class="${cls(p.cash - c0)}">${sign(Math.round(p.cash - c0))}G</small></div>
      <div class="st st-n">${ico('ui_town')}<span>純資産</span><b>${fmt(nw)}G</b><small class="${cls(nw - nw0)}">${sign(Math.round(nw - nw0))}G</small></div>
    </div>
    ${flowBox()}
    ${r.alerts && r.alerts.length ? `<div class="box alertbox"><div class="lbl">⚠️ 判断が必要なこと</div>${r.alerts.map(a => `<button class="news" style="width:100%;text-align:left" data-a="alert" data-k="${a.a || ''}" data-id="${a.id || ''}">${a.t}${a.a ? ' ›' : ''}</button>`).join('')}</div>` : '<div class="box" style="padding:10px 14px"><div class="t2" style="margin:0">✅ 今月は判断が必要なことはない。方針はそのまま引き継がれる</div></div>'}
    ${r.auto && r.auto.length ? `<div class="box"><div class="lbl">🤵 店長がしたこと</div>${r.auto.map(t => `<div class="news">${t}</div>`).join('')}</div>` : ''}
    ${mine.length ? `<div class="box">${mine.map(x => `<div class="shoprow"><span class="ic">${x.icon}</span><div class="grow"><div>${x.name} <span class="t3">${x.dist}</span></div><div class="t3">${x.work ? (x.s.last && x.s.last.noRaw ? `<span class="down">原料が買えず、作れなかった(お金不足)</span>` : `${fmt(x.units)}個つくった${x.s.last && x.s.last.bought ? `(原料 ${fmt(x.s.last.bought)}個を自動で仕入れ)` : ''}${x.sold ? ` · ${fmt(x.sold)}個売った` : ''}`) : `お客 ${fmt(x.units)}人${x.lost > 3 ? ` · <span class="down">${fmt(x.lost)}人を逃した</span>` : ''}`}</div></div><div class="num ${cls(x.profit)}">${sign(x.profit)}</div></div>${x.why ? `<div class="why">💬 ${x.why}${!x.work ? funnelBox(x.s, true) + sourcesBox(x.s, true) : ''}</div>` : ''}`).join('')}</div>` : ''}
    ${(() => { const ls = lessonOf(mine); return ls ? `<div class="box" style="background:linear-gradient(135deg,#eef6ff,#fff)"><div class="lbl">📘 今月の学び</div><div class="t2">${ls}</div></div>` : ''; })()}
    <div class="box"><div class="lbl">順位</div>${r.rank.map((x, i) => `<div class="rk"><span class="pos" style="background:${E.COLOR_HEX[x.color]}">${i + 1}</span><div class="nm">${esc(x.name)}${x.move ? `<span class="rankmove ${x.move > 0 ? 'up' : 'down'}">${x.move > 0 ? '▲' : '▼'}${Math.abs(x.move)}</span>` : ''}${x.pid != null ? nwParts(S.players[x.pid]) : ''}</div><div class="num">${fmt(x.nw)}G</div></div>`).join('')}<div class="t3" style="margin-top:6px">順位は<b>純資産</b>(現金 + 店の価値 + 在庫 − 借金)で決まる。建てたお金は「店の価値」に変わるので、建てた月に順位が大きく下がることはない</div></div>
    ${r.check && r.check.length ? `<div class="box"><div class="lbl">🎯 答え合わせ</div>${r.check.map(n => `<div class="news">${n}</div>`).join('')}</div>` : ''}
    ${(S.rumors || []).length ? `<div class="box"><div class="lbl">🗣️ 口コミ</div>${S.rumors.slice(0, 3).map(x => `<div class="news">${x.pid === ME ? '⭐ ' : ''}${esc(x.t)}</div>`).join('')}</div>` : ''}
    ${r.news.length ? `<div class="box"><div class="lbl">町の出来事</div>${r.news.map(n => `<div class="news">${n}</div>`).join('')}</div>` : ''}
    ${r.tip ? `<div class="box" style="background:linear-gradient(135deg,#fffaf0,#fff)"><div class="lbl">💡 ひとこと</div><div class="t2">${r.tip}</div></div>` : ''}
    <div class="stickybar"><button class="btn warm wide" data-a="close">${S.over ? '最終結果へ' : '次の月の作戦を立てる'}</button></div>`;
};
SHEETS.final = () => {
  const rk = E.ranking(S), pos = rk.findIndex(x => x.p.id === ME) + 1;
  if (!S.recorded) { S.recorded = 1; setRecord(S.stage, pos, rk[pos - 1].nw); save(); }
  return `<div class="hero box"><div style="font-size:54px">${pos === 1 ? '👑' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '🌱'}</div><div class="t3">${S.months / 12}年の商売が終わった</div><div class="big">${pos}位</div><div class="t2">${pos === 1 ? '町いちばんの商会になった!' : pos === 2 ? 'あと一歩!' : 'くやしい…次こそ'}</div></div>
    <div class="box">${rk.map((x, i) => `<div class="rk"><span class="pos" style="background:${E.COLOR_HEX[x.p.color]}">${i + 1}</span><div class="nm">${esc(x.p.name)}<small>店 ${E.shopsOf(S, x.p.id).length}</small></div><div class="num" style="font-size:17px">${fmt(x.nw)}G</div></div>`).join('')}</div>
    <div class="box"><div class="lbl">👑 地区の覇者</div>${Object.entries(E.DISTRICTS).map(([d, D]) => { const c = S.crowns && S.crowns[d]; return `<div class="kv"><span class="k">${D.name}</span><span>${c ? pname(S.players[c.pid]) + ` +${E.CROWN_BONUS}G` : '−'}</span></div>`; }).join('')}</div>
    <div class="box"><div class="lbl">🤫 秘密の目標(公開)</div>${S.players.map(p => `<div class="kv"><span class="k">${pname(p)}</span><span>${E.MISSIONS[p.mission].name} ${p.missionDone ? '<span class="up">✔ +' + E.MISSION_BONUS + 'G</span>' : '<span class="t3">✘</span>'}</span></div>`).join('')}</div>
    <div class="row"><button class="btn wide" data-a="restart2">同じ町でもう一度</button><button class="btn warm wide" data-a="newgame">別の町へ</button></div>`;
};
SHEETS.weather = () => {
  const sure = me().scout === S.t, f = wx(sure ? S.wNext : S.wFore);
  return head(f.icon, '来月の天気予報', sure ? '🕵️ 情報屋の話では確実' : '当たるのは4回に3回くらい') + `<div class="box"><div style="font-size:18px">${f.icon} ${f.name}</div><div class="t2">${f.text}</div></div>
    ${S.t ? `<div class="box"><div class="lbl">今月の天気</div><div class="t2">${wx(S.w).icon} ${wx(S.w).name} — ${wx(S.w).text}</div><div class="t3" style="margin-top:6px">最近: ${(S.wHist || []).map(k => wx(k).icon).join(' ')}</div></div>` : ''}
    <div class="box"><div class="lbl">天気のきまり</div>${Object.values(E.WEATHER).map(w => `<div class="news">${w.icon} <b>${w.name}</b> — ${w.text}</div>`).join('')}<div class="t3" style="margin-top:6px">住宅街(🏡)は天気の影響が半分。夏の猛暑が続くと小麦が値上がり、春の雨は豊作。季節で出やすい天気がちがう(冬は雪、6月は梅雨、秋は台風)。</div></div>`;
};
SHEETS.grand = () => head('🏰', E.GRAND.name, E.finalYear(S) ? `のこり${S.months - S.t}か月` : `始まるまで あと${S.months - 12 - S.t}か月`) + `<div class="box"><div class="t2">${E.GRAND.text}</div></div>` + crownBox();
SHEETS.menu = () => head('⚙️', 'メニュー', `${E.STAGES[S.stage].icon} ${E.STAGES[S.stage].name}`) + (() => { const a = audioPref(), sw = (k, l) => `<button class="sw ${a[k] ? 'on' : ''}" data-a="aud" data-v="${k}"><span>${l}</span><i></i></button>`; return `<div class="box"><div class="t1" style="margin-bottom:6px">🎵 音と手ざわり</div>${sw('bgm', 'BGM')}${sw('sfx', '効果音')}${sw('haptic', 'タップで振動')}<div class="row" style="gap:8px;margin-top:8px;align-items:center"><div class="t2" style="flex:1">♪ ${esc(bgm.name || '—')}${F.bgmLock ? '' : '<small>(場面で自動)</small>'}</div><button class="btn sm" data-a="nexttrack">曲を変える</button>${F.bgmLock ? '<button class="btn sm" data-a="autobgm">自動に戻す</button>' : ''}</div></div>`; })() + `<div class="box">${F.mp ? `<div class="t2" style="margin-bottom:8px">🌐 オンライン対戦中 · 部屋 <b>${esc(NET.code || '')}</b>${NET.host ? '(ホスト)' : ''}</div><button class="btn wide" data-a="online" style="margin-bottom:8px">部屋のようす</button>` : `<button class="btn wide" data-a="online" style="margin-bottom:8px">🌐 友だちと対戦</button>`}<button class="btn wide" data-a="howto" style="margin-bottom:8px">🎮 遊び方(チュートリアル)</button><button class="btn wide" data-a="rules" style="margin-bottom:8px">📜 ルールくわしく</button><button class="btn wide" data-a="stagesel" style="margin-bottom:8px">🗺️ 別の町(ステージ)で遊ぶ</button><button class="btn wide" data-a="credits" style="margin-bottom:8px">クレジット</button><button class="btn wide" data-a="restart">最初からやり直す</button></div>`;
SHEETS.rules = () => head('📜', 'ルールくわしく', '最後の月に、町いちばんの商会に') + `<button class="btn wide pri" data-a="howto" style="margin-bottom:10px">🎮 チュートリアルをもう一度見る</button>` + winBox() + `<div class="box t2">
  ① 町の<b>「+」</b>をタップして店を開く(4つまで)。同じ地区・同じ業種の店どうしでお客を取り合う。<br>
  ② 店をタップして<b>値段・店員・広告</b>を決める。🔮で来月の利益の見積もりが出る。<br>
  ③ <b>カード</b>は毎月3枚配られ、1枚使える。<br>
  ④ <b>市場</b>で材料を安いときに買っておくと、値上がりしても困らない。ライバルが買い占めると値段が上がる。<br>
  ⑤ <b>予報</b>を見て先回りする。<br>
  ⑥ 開業から3か月で店の<b>育て方</b>(💎高級路線・📦薄利多売・🤝地域密着)を選べる。<br>
  ⑦ <b>攻撃カード</b>:🥊客引き合戦・🤝引き抜き・📉市場に放出。<b>真横に同じ業種の安い店</b>を出すと客を奪える。自分の別業種の店を隣どうしに並べると<b>商店街ボーナス</b>。<br>
  ⑦' <b>ついで買い</b>: パン屋の客は道具屋・仕立て屋に、道具屋の客は薬屋に寄る。ライバルの店が繁盛するほど、相性のいい店は儲かる。<br>
  ⑧ 地区ごとに性格がちがう(港=季節で大波・広場=祭りと市の日・住宅街=安定)。<br>
  ⑨ <b>🤫秘密の目標</b>を達成すると最後に +${E.MISSION_BONUS}G。最後の年は<b>🏰王都の大祭</b>。最終月に各地区で一番客を集めると +${E.CROWN_BONUS}G。<br>
  ⑩ <b>📝契約</b>(市場→契約): ライバルと「毎月◯個を◯Gで」の取引を結べる。翌月払いにすると相手は受けやすいが、お金が入るのは1か月あと。足りないときは<b>売掛金の前倒し</b>(5%引き)や<b>つなぎ融資</b>で資金繰りする。<br>
  ⑪ <b>🏛️町</b>: 依頼・ギルドの投票・年末の税。ライバルの店を<b>買い取る</b>こともできる。<br>
  ⑫ <b>🌐友だちと対戦</b>: メニュー→部屋を作って番号を送るだけ。空いた席にはAIが入る。<br>
  ⑬「次の月へ」で、決めたことが全部いっしょに実行される。最後の月の純資産で勝負! 地図は2本指で回転・拡大、シートは下にスワイプで閉じる。</div>`;
SHEETS.credits = () => head('🎨', 'クレジット', '') + `<div class="box t2">3D モデル: KayKit — Kay Lousberg(CC0)<br>Quaternius(CC0)<br>3D 表示: three.js(MIT)<br>フォント: M PLUS Rounded 1c(SIL OFL)<br>アイコン: game-icons.net — Lorc, Delapouite ほか(CC BY 3.0)<br>音楽・効果音: ゲーム内でその場で合成(オリジナル)<br>オンライン対戦: Supabase Realtime</div>`;

// ── 操作
const H = {
  close: () => { const was = F.sheet; closeSheet(); sfx('close'); if (was === 'result' && !S.over) setTimeout(monthBanner, 150); if (was === 'stages') endPreview(); if (was === 'result' && S.over) setTimeout(() => openSheet('final'), 350); if (was === 'result') afterResult(); },
  menu: () => openSheet('menu'),
  aud: (d) => { const k = d.v, v = !audioPref()[k]; setAudioPref(k, v); if (k === 'haptic' && v) haptic(20); sfx('toggle'); renderSheet(); },
  nexttrack: () => { const ks = ['asa', 'kenso', 'minato', 'yuki', 'ame', 'ouji', 'matsuri'], i = ks.indexOf(bgm.want); F.bgmLock = 1; bgm.play(ks[(i + 1) % ks.length]); if (!audioPref().bgm) setAudioPref('bgm', true); sfx('toggle'); setTimeout(renderSheet, 2600); toast('曲を替える…'); },
  autobgm: () => { F.bgmLock = 0; pickBgm(); sfx('toggle'); setTimeout(renderSheet, 2600); }, howto: () => showTut(0), rules: () => { $('#tut') && $('#tut').remove(); openSheet('rules'); },
  tutgo: (d) => { const n = F.tutI + +d.v; if (n < 0 || n >= TUT.length) return; F.tutI = n; sfx('card'); haptic(8); renderTut(+d.v); },
  vsgo: () => gameStart(),
  tutclose: () => { try { localStorage.setItem('capital-tut-seen', '1'); } catch (e) { } const el = $('#tut'); if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 260); } sfx('open'); }, credits: () => openSheet('credits'),
  ranking: () => openSheet('ranking'), market: () => openSheet('market'), books: () => openSheet('books'), event: () => openSheet('event'),
  card: (d) => openSheet('card', { i: +d.i }),
  cardgo: (d) => {
    const i = +d.i, c = me().hand[i], cd = E.cardDef(c);
    if (freeCash() < cd.cost) return toast('お金が足りない');
    F.acts = F.acts.filter(a => a.type !== 'card');
    F.acts.push({ type: 'card', card: c, idx: i, shop: d.shop ? +d.shop : undefined, res: d.res || undefined });
    sfx('card'); closeSheet(); toast(`「${cd.name}」を月末に使う`); save(); render();
  },
  cardcancel: () => { F.acts = F.acts.filter(a => a.type !== 'card'); save(); render(); closeSheet(); },
  shop: (d) => { const s = S.shops.find(x => x.id === +d.id); if (s) { board.focus(s.lot); openSheet('shop', { id: s.id }); } },
  pickgood: (d) => { F.args.g = d.v; sfx('tap'); renderSheet(); },
  pickres: (d) => { F.args.res = d.v; sfx('tap'); renderSheet(); },
  doopen: (d) => { const lot = +d.v; F.acts = F.acts.filter(a => !(a.type === 'open' && a.lot === lot)); F.acts.push({ type: 'open', lot, g: F.args.g, res: F.args.g === 'work' ? F.args.res : undefined, priceLv: 2, staff: 2 }); sfx('build'); save(); closeSheet(); render(); board.preview(lot, F.args.g, S.players[ME].color); toast('月末に建つ!'); },
  setfeat: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s); setPending(s.id, { priceLv: v.priceLv, staff: v.staff, ads: v.ads, feat: d.v || null, featQty: d.v ? (s.featQty || 4) : 0 }); sfx('tap'); render(); },
  setfeatq: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s), pd = pendSet(s.id); setPending(s.id, { priceLv: v.priceLv, staff: v.staff, ads: v.ads, feat: pd && pd.feat !== undefined ? pd.feat : s.feat, featQty: +d.v }); sfx('tap'); render(); },
  hirelist: (d) => openSheet('hire', { shop: +d.id }),
  hire: (d) => { F.acts.push({ type: 'hire', shop: +d.id, cand: +d.v }); sfx('build'); save(); toast('月末に入る'); openSheet('shop', { id: +d.id }); },
  fire: (d) => { F.acts.push({ type: 'fire', shop: +d.id, staffId: +d.v }); sfx('tap'); save(); render(); },
  setautobuy: (d) => { const sh = S.shops.find(x => x.id === +d.id); F.acts = F.acts.filter(a => !(a.type === 'set' && a.shop === sh.id && a.autoBuy != null && a.priceLv == null)); F.acts.push({ type: 'set', shop: sh.id, autoBuy: +d.v }); sfx('toggle'); save(); render(); },
  setauto: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s); setPending(s.id, { priceLv: v.priceLv, staff: v.staff, ads: v.ads, autoSell: +d.v }); sfx('tap'); render(); },
  setproc: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s); setPending(s.id, { priceLv: v.priceLv, staff: v.staff, ads: v.ads, useProc: +d.v }); sfx('tap'); render(); },
  build: () => buildStart(null),
  buildpick: (d) => { sfx('tap'); buildPick(d.v); },
  buildres: (d) => { sfx('tap'); buildPick('work', d.v); },
  buildcancel: () => { sfx('close'); buildEnd(); },
  buildback: () => { document.body.classList.remove('placing'); board.clearRatings(); F.build.step = 'type'; F.build.g = null; render(); },
  buildother: () => { F.build.lot = null; buildPick(F.build.g, F.build.res); },
  builddetail: () => { const B = F.build; buildEnd(); openSheet('lot', { lot: B.lot, g: B.g, res: B.res }); },
  buildgo: () => {
    const B = F.build, e = lotEstimate(B.lot, B.g, B.res); if (freeCash() < e.cost) return toast('お金が足りない');
    F.acts = F.acts.filter(a => !(a.type === 'open' && a.lot === B.lot));
    F.acts.push({ type: 'open', lot: B.lot, g: B.g, res: B.g === 'work' ? B.res : undefined, priceLv: 2, staff: 2 });
    const pos = board.screenOfLot(B.lot); coinFly(cashPos(), { x: pos.x - 10, y: pos.y - 10 }, 10);
    buildEnd(); board.preview(B.lot, B.g, me().color); setTimeout(() => board.dust(B.lot), 120);
    sfx('build'); haptic(30); save(); render(); toast('🔨 建設開始! 月末に完成する');
  },
  cancelopen: (d) => { const lot = +d.v; F.acts = F.acts.filter(a => !(a.type === 'open' && a.lot === lot)); board.preview(lot, null); save(); closeSheet(); render(); },
  setp: (d) => { const s = S.shops.find(x => x.id === +d.id); setPending(s.id, { priceLv: +d.v, staff: shopView(s).staff, ads: shopView(s).ads }); sfx('tap'); render(); },
  sets: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s); setPending(s.id, { priceLv: v.priceLv, staff: Math.max(1, Math.min(5, v.staff + +d.v)), ads: v.ads }); sfx('tap'); render(); },
  seta: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s); setPending(s.id, { priceLv: v.priceLv, staff: v.staff, ads: +d.v }); sfx('tap'); render(); },
  closeshop: (d) => { if (!confirm('この店をたたむ?(月末に売れる)')) return; F.acts = F.acts.filter(a => !(a.type === 'set' && a.shop === +d.id)); F.acts.push({ type: 'close', shop: +d.id }); save(); closeSheet(); render(); toast('月末に店をたたむ'); },
  mtab: (d) => { F.mtab = d.v; renderSheet(); },
  msel: (d) => { F.mSel = F.mSel === d.v ? null : d.v; F.mT = { mode: 'buy', q: E.isRare(d.v) ? 2 : E.isProc(d.v) ? 20 : 50 }; sfx('tap'); renderSheet(); },
  mmode: (d) => { F.mT.mode = d.v; if (d.v === 'sell') { const k = F.mSel, have = me().inv[k] || 0; F.mT.q = Math.min(F.mT.q, Math.floor(have)); } sfx('toggle'); renderSheet(); },
  mq: (d) => { F.mT.q = Math.max(0, Math.min(2000, F.mT.q + +d.v)); sfx('tap'); renderSheet(); },
  mqset: (d) => { F.mT.q = +d.v; sfx('tap'); renderSheet(); },
  mgo: (d) => { const k = d.v, T = F.mT, q = T.q; if (q <= 0) return;
    if (T.mode === 'buy') { const c = E.quote(S, k, q); if (freeCash() < c) return toast('お金が足りない'); F.acts.push({ type: 'buy', res: k, qty: q }); }
    else { const have = me().inv[k] - F.acts.filter(a => a.type === 'sell' && a.res === k).reduce((a, x) => a + x.qty, 0); const qq = Math.min(q, Math.floor(have)); if (qq <= 0) return toast('在庫がない'); F.acts.push({ type: 'sell', res: k, qty: qq }); }
    sfx('coin'); save(); render(); },
  mcancel: (d) => { F.acts = F.acts.filter(a => !((a.type === 'buy' || a.type === 'sell') && a.res === d.v)); sfx('close'); save(); render(); },
  showfinal: () => openSheet('final'),
  online: () => { $('.title') && $('.title').remove(); unlockAudio(); openSheet('online'); },
  mpcreate: () => mpConnect(newCode(), true),
  mpjoin: () => { const c = ($('#mpcode').value || '').trim().toUpperCase(); if (c.length < 4) return toast('部屋の番号を入れてね'); F.joinCode = c; mpConnect(c, false); },
  mpresume: () => { $('.title') && $('.title').remove(); unlockAudio(); mpResume(); },
  mpshare: async () => { const url = location.origin + location.pathname + '?room=' + NET.code, txt = `CAPITAL 商会バトルで勝負! 部屋の番号 ${NET.code}`; try { if (navigator.share) await navigator.share({ title: 'CAPITAL 商会バトル', text: txt, url }); else { await navigator.clipboard.writeText(txt + ' ' + url); toast('リンクをコピーした'); } } catch (e) { } },
  mpset: (d) => { F[d.k] = d.k === 'months' ? +d.v : d.v; sfx('tap'); renderSheet(); },
  mpstart: async () => {
    const mem = NET.members.slice(0, 4), lv = F.level || 'hard', seats = mem.map(m => ({ cid: m.cid, name: m.name || 'ゲスト' }));
    // ホストは必ず席0
    const hi = seats.findIndex(x => x.cid === NET.cid); if (hi > 0) { const [h0] = seats.splice(hi, 1); seats.unshift(h0); }
    for (let i = seats.length; i < 4; i++) { const [n, c, k] = E.AI_NAMES[i - 1] || E.AI_NAMES[0]; seats.push({ ai: k, name: n, open: 1 }); }
    const players = seats.map(x => x.ai ? { name: x.name, ai: x.ai } : { name: x.name, human: true });
    S = E.newGame({ seed: Math.floor(Math.random() * 1e9), stage: F.mpStage || 'rose', months: F.months || 36, level: lv, players });
    F.mp = true; F.mpSeats = seats; ME = 0; F.acts = []; NET.seats = seats; NET.mySeat = 0; NET.ready = {};
    netSend({ k: 'start', S, seats, t: 0 }); mpSave();
    closeSheet(); $('#loading').classList.remove('off'); await board.build(S.stage); F.mpBuilt = true; await board.sync(S, ME); labels(); render(); board.home(); board.setWeather('sun'); setTimeout(() => $('#loading').classList.add('off'), 200);
    showVS(() => {});
  },
  mpleave: async () => {
    if (F.mp && !confirm(NET.host ? '部屋を閉じる?(みんなの対戦も止まる。あとで「対戦に戻る」で再開もできる)' : '部屋を出る?(あなたの席はAIが引き継ぐ)')) return;
    if (F.mp) { if (NET.host) netSend({ k: 'closed' }); else { netSend({ k: 'bye', cid: NET.cid }); mpClear(); } }
    await leaveRoom(); const was = F.mp; F.mp = false; F.mpBuilt = false; ME = 0; closeSheet(); netBadge();
    if (was) { const sv = loadSave(); if (sv) { S = sv.S; F.acts = sv.acts || []; E.useStage(S.stage); } else S = E.newGame({ seed: 1, stage: 'rose' }); await board.build(S.stage); await board.sync(S, ME); labels(); render(); }
    toast(was ? '部屋を出た' : '部屋を出た');
  },
  mpskip: () => { if (F.mpGo) F.mpGo(); },
  mpai: (d) => { const i = +d.v; if (!confirm(`${S.players[i].name}の席をAIに任せる?(戻ってきたら返す)`)) return; mpSeatAI(i); netSend({ k: 'state', S, seats: F.mpSeats, fx: [], errors: [], t: S.t, re: 1 }); mpSave(); if (F.mpChk) F.mpChk(); renderSheet(); render(); },
  mpaiall: () => { for (const x of humansOf()) if (x.cid !== NET.cid && !NET.online(x.cid) && !(NET.ready[x.i] && NET.ready[x.i].t === S.t)) mpSeatAI(x.i); netSend({ k: 'state', S, seats: F.mpSeats, fx: [], errors: [], t: S.t, re: 1 }); mpSave(); if (F.mpChk) F.mpChk(); },
  stamps: () => { F.stampOpen = !F.stampOpen; render(); },
  stamp: (d) => { const p = me(); netSend({ k: 'stamp', s: d.v, name: p.name, color: E.COLOR_HEX[p.color] }); showStamp(p.name, d.v, E.COLOR_HEX[p.color]); F.stampOpen = false; haptic(12); render(); },
  pf: (d) => { const f = F.pf; f[d.k] = ['to', 'months', 'pay', 'pk'].includes(d.k) ? +d.v : d.v; if (d.k === 'item') f.qty = E.isProc(d.v) ? 20 : 60; sfx('tap'); renderSheet(); },
  pfq: (d) => { const f = F.pf, st = E.isProc(f.item) ? 5 : 20; f.qty = Math.max(5, Math.min(400, f.qty + st * +d.v)); sfx('tap'); renderSheet(); },
  propose: () => { const f = F.pf; F.acts.push({ type: 'propose', to: f.to, role: f.role, item: f.item, qty: f.qty, price: Math.round(S.market[f.item].price * f.pk * 100) / 100, months: f.months, pay: f.pay }); sfx('card'); save(); toast('月末に返事が来る'); render(); },
  unpropose: (d) => { const [to, item] = d.v.split(':'); F.acts = F.acts.filter(a => !(a.type === 'propose' && a.to === +to && a.item === item)); sfx('tap'); save(); render(); },
  factor: (d) => { const id = +d.v; if (F.acts.some(a => a.type === 'factor' && a.id === id)) F.acts = F.acts.filter(a => !(a.type === 'factor' && a.id === id)); else F.acts.push({ type: 'factor', id }); sfx('coin'); save(); render(); },
  bridge: (d) => { const v = +d.v, on = F.acts.find(a => a.type === 'bridge'); F.acts = F.acts.filter(a => a.type !== 'bridge'); if (!on || on.amt !== v) F.acts.push({ type: 'bridge', amt: v }); sfx('coin'); save(); render(); },
  deal: (d) => { const id = +d.v; if (F.acts.some(a => a.type === 'deal' && a.id === id)) F.acts = F.acts.filter(a => !(a.type === 'deal' && a.id === id)); else F.acts.push({ type: 'deal', id }); sfx('coin'); save(); render(); },
  buy: (d) => { const q = E.isRare(d.v) ? 2 : E.isProc(d.v) ? 20 : 50, c = E.quote(S, d.v, q); if (freeCash() < c) return toast('お金が足りない'); F.acts.push({ type: 'buy', res: d.v, qty: q }); sfx('coin'); save(); render(); },
  sell: (d) => { const have = me().inv[d.v] - F.acts.filter(a => a.type === 'sell' && a.res === d.v).reduce((a, x) => a + x.qty, 0); const q = Math.min(E.isRare(d.v) ? 2 : E.isProc(d.v) ? 20 : 50, Math.floor(have)); if (q <= 0) return toast('在庫がない'); F.acts.push({ type: 'sell', res: d.v, qty: q }); sfx('coin'); save(); render(); },
  repay: () => { const amt = Math.min(me().debt, Math.floor(freeCash() / 100) * 100); if (amt <= 0) return; F.acts.push({ type: 'repay', amt }); save(); render(); toast(`月末に ${fmt(amt)}G 返す`); },
  next: () => nextMonth(),
  grand: () => openSheet('grand'),
  weather: () => openSheet('weather'),
  townhall: () => openSheet('townhall'),
  vote: (d) => { F.acts = F.acts.filter(a => a.type !== 'vote'); F.acts.push({ type: 'vote', bill: d.v }); sfx('card'); save(); render(); },
  questtake: (d) => { F.acts = F.acts.filter(a => a.type !== 'quest'); F.acts.push({ type: 'quest', id: +d.v }); sfx('card'); save(); toast('月末に依頼を受ける'); render(); },
  questdeliver: (d) => { const q = S.quests.find(x => x.id === +d.v); const qty = Math.floor(Math.min(me().inv[q.item], q.qty - q.got)); if (qty <= 0) return; F.acts = F.acts.filter(a => !(a.type === 'deliver' && a.id === q.id)); F.acts.push({ type: 'deliver', id: q.id, qty }); sfx('coin'); save(); toast(`月末に ${fmt(qty)}個 納める`); render(); },
  buyshop: (d) => { F.acts = F.acts.filter(a => !(a.type === 'buyshop' && a.shop === +d.id)); F.acts.push({ type: 'buyshop', shop: +d.id, price: +d.v }); sfx('card'); save(); toast('月末に返事が来る'); render(); },
  manager: () => openSheet('manager'),
  alerts: () => { F.alertsSeen = 1; openSheet('alerts'); },
  polstaff: (d) => { const P = pol(); P.staff[d.id] = !P.staff[d.id]; save(); renderSheet(); },
  polbuy: (d) => { const P = pol(), R = E.RES[d.v]; P.buy[d.v] = { months: +d.m, max: (P.buy[d.v] && P.buy[d.v].max) || Math.round(R.base * 1.4 * 100) / 100 }; save(); renderSheet(); },
  polmax: (d) => { const P = pol(), R = E.RES[d.v]; const r = P.buy[d.v]; r.max = Math.max(R.base * 0.6, Math.round((r.max + (+d.d) * R.base * 0.1) * 100) / 100); save(); renderSheet(); },
  alert: (d) => { if (d.k === 'shop') H.shop({ id: d.id }); else if (d.k === 'market') openSheet('market'); },
  district: (d) => { if (F.pv) return; openSheet('district', { d: d.d }); },
  route: (d) => { const s = S.shops.find(x => x.id === +d.id); F.acts = F.acts.filter(a => !(a.type === 'route' && a.shop === s.id)); const lv = s.route ? s.route.lv + 1 : 1; if (freeCash() < E.ROUTES[d.k].cost[lv - 1]) return toast('お金が足りない'); F.acts.push({ type: 'route', shop: s.id, k: d.k }); sfx('build'); save(); render(); toast(`${E.ROUTES[d.k].name}${lv === 2 ? ' Lv2' : ''}を月末に始める`); },
  routecancel: (d) => { F.acts = F.acts.filter(a => !(a.type === 'route' && a.shop === +d.id)); save(); render(); },
  newgame: () => { $('.title') && $('.title').remove(); unlockAudio(); openSheet('stages'); },
  pickstage: (d) => { F.pv = null; $('.title') && $('.title').remove(); closeSheet(); startNew(d.v); },
  stagepv: (d) => previewStage(d.v),
  setmonths: (d) => { F.months = +d.v; renderSheet(); },
  setlevel: (d) => { F.level = d.v; renderSheet(); },
  restart2: () => { closeSheet(); startNew(S.stage); },
  restart: () => { if (F.mp) return toast('オンライン対戦中は、部屋を出てから'); if (confirm('最初からやり直す?(同じ町)')) { closeSheet(); startNew(S.stage); } },
  stagesel: () => { if (F.mp) return toast('オンライン対戦中は、部屋を出てから'); if (!S.t || S.over || confirm('今のゲームをやめて、別の町で始める?')) openSheet('stages'); },
  start: () => { $('.title') && $('.title').remove(); unlockAudio(); sfx('open'); if (!S.t && !F.acts.length && !E.shopsOf(S, ME).length) setTimeout(() => showVS(() => { if (!tutSeen()) showTut(0); }), 300); else { rivalsBar(); setTimeout(monthBanner, 300); } },
};
// ── 手ざわり: 押した瞬間に沈む・波紋・小さな振動と音
const PRESSABLE = 'button, [data-a]:not(#sheetbg), .card';
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest(PRESSABLE); if (!t || t.disabled) return;
  unlockAudio(); haptic(6); sfx('press');
  t.classList.remove('rel'); t.classList.add('prs');
  const r = t.getBoundingClientRect(); if (r.width > 24 && r.height > 18 && !t.classList.contains('nor')) {
    const d = Math.max(r.width, r.height) * 2.2, i = document.createElement('i'); i.className = 'rip'; i.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
    const w = document.createElement('span'); w.className = 'ripw'; i.style.left = (e.clientX - r.left - d / 2) + 'px'; w.appendChild(i); t.appendChild(w); setTimeout(() => w.remove(), 600);
  }
}, { passive: true });
const release = (e) => { for (const t of document.querySelectorAll('.prs')) { t.classList.remove('prs'); t.classList.add('rel'); setTimeout(() => t.classList.remove('rel'), 420); } };
document.addEventListener('pointerup', release, { passive: true }); document.addEventListener('pointercancel', release, { passive: true });
// シートを下にスワイプして閉じる
(() => {
  const sh = $('#sheet'); let y0 = null, dy = 0, t0 = 0, drag = false;
  sh.addEventListener('touchstart', (e) => { if (sh.scrollTop > 2 || e.touches.length > 1) { y0 = null; return; } y0 = e.touches[0].clientY; t0 = performance.now(); dy = 0; drag = false; }, { passive: true });
  sh.addEventListener('touchmove', (e) => {
    if (y0 == null) return; dy = e.touches[0].clientY - y0;
    if (!drag && dy > 10 && sh.scrollTop <= 0) { drag = true; sh.style.transition = 'none'; }
    if (drag) { sh.style.transform = `translateY(${Math.max(0, dy - 10) * 0.9}px)`; if (e.cancelable) e.preventDefault(); }
  }, { passive: false });
  sh.addEventListener('touchend', () => {
    if (!drag) { y0 = null; return; }
    const v = dy / Math.max(1, performance.now() - t0); sh.style.transition = ''; sh.style.transform = '';
    if ((dy > 110 || v > 0.6) && !F.busy) { haptic(10); sfx('swipe'); H.close(); }
    y0 = null; drag = false;
  });
})();
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-a]'); if (!t) return;
  const f = H[t.dataset.a]; if (!f) return;
  unlockAudio();
  const r = t.getBoundingClientRect(), d = { ...t.dataset }, sid = d.id ? +d.id : null, s0 = sid != null && S ? S.shops.find(x => x.id === sid) : null;
  const before = { n: F.acts.length, pl: s0 ? (pendSet(s0.id) && pendSet(s0.id).priceLv != null ? pendSet(s0.id).priceLv : s0.priceLv) : null };
  f(t.dataset);
  try { actionFx(t.dataset.a, d, r, before); } catch (err) { console.warn('fx', err); }
});

// ── 月を進める
async function nextMonth() {
  if (F.busy || S.over) return;
  F.busy = true; closeSheet();
  const before = E.ranking(S).map(x => x.p.id);
  const tier0 = E.rankOf(E.netWorth(S, me()));
  const fc = { wFore: me().scout === S.t ? S.wNext : S.wFore, ev: S.evNext ? S.evNext.id : null, prices: Object.fromEntries(Object.keys(E.ITEMS).map(k => [k, S.market[k].price])) };
  const autoDone = autoManage();
  const acts = F.acts.map(({ idx, ...a }) => a);
  const pre = new Set(S.shops.map(s => s.id));
  const shopsBefore = S.shops.map(s => ({ id: s.id, d: s.d, g: s.g, owner: s.owner, lot: s.lot }));
  let fx, errors;
  if (F.mp) { const r = await mpStep(acts); if (!r) { F.busy = false; render(); return; } ({ fx, errors } = r); }
  else { F.thinking = 1; rivalsBar(); const think = await aiThink(); F.thinking = 0; ({ fx, errors } = E.step(S, { ...think, [ME]: acts })); }
  F.alerts = alertsOf(fx, shopsBefore, autoDone); F.alertsSeen = 0;
  F.acts = []; save();
  for (const er of errors.filter(x => x.pid === ME)) toast(er.e);
  if (fx.some(f => f.kind === 'open' && f.pid === ME && f.moved != null)) setTimeout(() => toast('🏃 その土地は先に取られた! となりの空き地に建てた'), 900);
  sfx('whoosh');
  board.clearPreview();
  await board.sync(S, ME);
  board.setWeather(S.w);
  board.setProsperity(avgProsper());
  render();
  // 客の動きと数字のポップ
  const sales = fx.filter(f => f.kind === 'sales' || f.kind === 'made');
  board.home();
  await wait(500);
  board.playMonth(S, sales); monthFx(fx);
  await wait(1500);
  salesFx(sales);
  for (const f of sales) { const pos = board.screenOf(f.shop); if (pos) { popAt(pos, f.profit, S.players[f.pid].color); if (f.pid === ME && f.profit > 0) setTimeout(() => coinFly(pos, cashPos(), Math.min(8, 2 + Math.round(f.profit / 40))), 500); } }
  await wait(900);
  await rivalTour(fx);
  const myUp = sales.filter(f => f.pid === ME && f.profit > 0).length; if (myUp) sfx('coins', Math.min(8, 2 + myUp * 2));
  await wait(1100);
  await monthReplay();
  // 結果
  const after = E.ranking(S);
  const r = {
    mine: E.shopsOf(S, ME).filter(s => s.last).map(s => ({ s, why: whyText(s), prev: s.last.prevProfit, work: s.g === 'work', sold: s.last.sold, icon: gd(s).icon, name: gd(s).name, dist: E.DISTRICTS[s.d].short, units: s.last.units, lost: Math.max(0, s.last.want - s.last.units), profit: s.last.profit })),
    rank: after.map((x, i) => ({ pid: x.p.id, name: x.p.name, color: x.p.color, nw: x.nw, move: before.indexOf(x.p.id) - i })),
    news: newsOf(fx, pre), tip: tipOf(), check: checkOf(fc), auto: autoDone, alerts: F.alerts,
  };
  r.tier0 = tier0; r.tier1 = E.rankOf(E.netWorth(S, me()));
  document.querySelectorAll('.rsay').forEach(d => d.classList.add('out'));
  openSheet('result', { r }); bgm.jingle(r.mine.reduce((a, x) => a + x.profit, 0) >= 0);
  if (r.tier1 > r.tier0) { sfx('rankup'); confetti(); } else if (r.tier1 < r.tier0) sfx('whoosh');
  countUp($('#cntup'), r.mine.reduce((a, x) => a + x.profit, 0));
  const pos = after.findIndex(x => x.p.id === ME);
  if (pos < before.indexOf(ME)) { sfx('rankup'); confetti(); }
  F.busy = false;
}
function afterResult() { render(); }
// ライバルの思考は別スレッドで(使えない環境ではその場で)
let aiW = null, aiSeq = 0;
function aiThink() {
  if (!S.players.some(p => p.ai)) return Promise.resolve({});
  try { if (!aiW) aiW = new Worker('js/aiworker.js', { type: 'module' }); } catch (e) { aiW = false; }
  if (!aiW) return Promise.resolve({});
  const id = ++aiSeq, t0 = performance.now();
  const ind = setTimeout(() => toast('🤔 ライバルたちが考えている…'), 700);
  return new Promise((res) => {
    const done = (v) => { clearTimeout(ind); aiW.removeEventListener('message', on); res(v); };
    const on = ({ data }) => { if (data.id !== id) return; if (data.ok) { S.rs = data.rs; done(data.dec); } else { console.warn('ai worker', data.err); done({}); } };
    aiW.addEventListener('message', on);
    aiW.onerror = (e) => { console.warn('ai worker failed', e.message); aiW = false; done({}); };
    aiW.postMessage({ S: JSON.parse(JSON.stringify(S)), id });
  });
}
const avgProsper = () => { const ks = Object.keys(E.DISTRICTS); return ks.reduce((a, d) => a + E.prosperK(S, d), 0) / ks.length; };
// 店長と仕入れ係: 決めたルールで毎月の作業を任せる
const pol = () => { me().policy = me().policy || { staff: {}, buy: {} }; return me().policy; };
function autoManage() {
  const done = [], P = pol();
  // 店員の数(店長に任せた店だけ)
  for (const s of E.storesOf(S, ME)) {
    if (!P.staff[s.id] || !s.last || F.acts.some(a => a.type === 'set' && a.shop === s.id)) continue;
    let best = { st: s.staff, v: E.estimateShop(S, s).profit };
    for (const st of [s.staff - 1, s.staff + 1]) { if (st < 1 || st > 5) continue; const v = E.estimateShop(S, s, { staff: st }).profit; if (v > best.v + 3) best = { st, v }; }
    if (best.st !== s.staff) { F.acts.push({ type: 'set', shop: s.id, priceLv: s.priceLv, staff: best.st, ads: s.ads }); done.push(`${E.GOODS[s.g].icon}${E.GOODS[s.g].name}(${E.DISTRICTS[s.d].short})の店員 ${s.staff}→${best.st}人`); }
  }
  // 材料の補充(在庫を◯か月分たもつ。上限価格を超えたら止める)
  F.stopped = [];
  for (const k of Object.keys(E.RES)) {
    const rule = P.buy[k]; if (!rule || !rule.months) continue;
    const use = E.storesOf(S, ME).filter(s => E.GOODS[s.g].res === k).reduce((a, s) => a + (s.last ? s.last.units : s.staff * E.GOODS[s.g].capPer * 0.5), 0) + E.shopsOf(S, ME).filter(s => s.res === k).reduce((a, s) => a + E.workCap(s), 0);
    const target = Math.round(use * rule.months), have = me().inv[k] + F.acts.filter(a => a.type === 'buy' && a.res === k).reduce((a, x) => a + x.qty, 0);
    if (have >= target * 0.6 || target < 10) continue;
    const price = S.market[k].price;
    if (rule.max && price > rule.max) { F.stopped.push(k); continue; }
    const q = Math.round((target - have) / 10) * 10; if (q <= 0) continue;
    if (freeCash() < E.quote(S, k, q) + 100) { F.stopped.push(k + ':cash'); continue; }
    F.acts.push({ type: 'buy', res: k, qty: q }); done.push(`${E.RES[k].icon}${E.RES[k].name}を ${fmt(q)} 補充(${price.toFixed(2)}G)`);
  }
  return done;
}
// 判断が必要なこと(毎月 最大2件)
function alertsOf(fx, before, autoDone) {
  const out = [], mine = E.storesOf(S, ME);
  for (const k of F.stopped || []) { const [r, why] = k.split(':'); out.push({ p: 9, t: why === 'cash' ? `${E.RES[r].icon}${E.RES[r].name}の補充はお金が足りず止めた` : `${E.RES[r].icon}${E.RES[r].name}が上限(${pol().buy[r].max.toFixed(2)}G)を超えたので補充を止めた。今 ${S.market[r].price.toFixed(2)}G`, a: 'market' }); }
  for (const s of mine) {
    const e = E.estimateShop(S, s); if (e && e.profit < -5) out.push({ p: 8, t: `${E.GOODS[s.g].icon}${E.GOODS[s.g].name}(${E.DISTRICTS[s.d].short}): 今の値段・人数だと来月は赤字の見込み(${sign(e.profit)}G)`, a: 'shop', id: s.id });
    if (s.last && s.last.want > s.last.cap * 1.15) out.push({ p: 6, t: `${E.GOODS[s.g].icon}${E.GOODS[s.g].name}(${E.DISTRICTS[s.d].short}): ${fmt(s.last.want - s.last.cap)}人を逃した。人手が足りない`, a: 'shop', id: s.id });
  }
  for (const f of fx) {
    if (f.pid === ME) continue;
    if (f.kind === 'close') { const b = before.find(x => x.id === f.shop); if (b && mine.some(s => s.d === b.d && s.g === b.g)) out.push({ p: 7, t: `${E.DISTRICTS[b.d].short}の${E.GOODS[b.g].name}(${esc(S.players[b.owner].name)})が撤退。客が流れてきそう` }); }
    if (f.kind === 'open') { const n = S.shops.find(x => x.id === f.shop); if (n && n.g !== 'work' && mine.some(s => s.d === n.d && s.g === n.g)) out.push({ p: 7, t: `${E.DISTRICTS[n.d].short}に同業の${E.GOODS[n.g].name}(${esc(S.players[n.owner].name)})ができた。客の取り合いになる`, a: 'shop', id: mine.find(s => s.d === n.d && s.g === n.g).id }); }
  }
  for (const k of new Set(mine.map(s => E.GOODS[s.g].res))) { const h = S.market[k].hist, ch = h.length > 1 ? S.market[k].price / h[h.length - 2] - 1 : 0; if (ch > 0.2) out.push({ p: 5, t: `${E.RES[k].icon}${E.RES[k].name}が高騰(前月比 +${Math.round(ch * 100)}%)。値上げするか、利益を削るか`, a: 'market' }); }
  return out.sort((a, b) => b.p - a.p).slice(0, 2);
}
SHEETS.townhall = () => {
  const qs = (S.quests || []).filter(q => !q.done || q.taker === ME), mineQ = qs.find(q => q.taker === ME && !q.done);
  const voteBox = S.vote && S.vote.t === S.t ? `<div class="box"><div class="lbl">🗳️ 商人ギルドの投票(今月決まる・1年有効)</div>${S.vote.bills.map(b => { const B = E.BILLS[b], on = (F.acts.find(a => a.type === 'vote') || {}).bill === b || S.vote.ballots[ME] === b; return `<button class="shoprow" style="width:100%;text-align:left" data-a="vote" data-v="${b}"><span class="ic">${B.icon}</span><div class="grow"><div>${B.name}</div><div class="t3">${B.text}</div></div><span class="btn sm ${on ? 'pri' : ''}">${on ? '投票 ✓' : '投票'}</span></button>`; }).join('')}<div class="t3" style="margin-top:6px">1人1票 + 店2つごとに1票。ライバルは自分の店に得な議題に入れる。</div></div>` : '';
  const laws = E.lawsActive(S);
  return head('🏛️', '町役場', '依頼・ギルドの投票・決まり・うわさ') + voteBox +
    `<div class="box"><div class="lbl">📜 町の依頼</div>${qs.length ? qs.map(q => { const it = E.ITEMS[q.item], mine = q.taker === ME, left = mine ? q.took + q.months - S.t : null; return `<div class="quest"><div class="row"><span style="font-size:22px">${it.icon}</span><div class="grow"><div>${esc(q.who)}: ${it.name} ${fmt(q.qty)}個</div><div class="t3">${esc(q.text)} · 1個 ${q.price.toFixed(2)}G(相場の約${Math.round(q.price / S.market[q.item].price * 100)}%)+ 全部納めたら ${fmt(q.bonus)}G · 期限 ${q.months}か月</div></div></div>
      ${q.taker == null ? `<button class="btn sm warm" data-a="questtake" data-v="${q.id}" ${mineQ ? 'disabled' : ''}>受ける</button>` : mine ? `<div class="t2" style="margin:4px 0">納めた ${fmt(q.got)}/${fmt(q.qty)} · のこり${left}か月 · 在庫 ${fmt(me().inv[q.item])}</div><button class="btn sm pri" data-a="questdeliver" data-v="${q.id}" ${me().inv[q.item] >= 1 ? '' : 'disabled'}>在庫から納める</button><div class="t3">間に合わないと、残りの報酬の${Math.round(E.QUEST_PENALTY * 100)}%を違約金で払う</div>` : `<div class="t3">${pname(S.players[q.taker])} が受けた</div>`}</div>`; }).join('') : '<div class="t3">今は依頼がない。ときどき出る</div>'}</div>
    <div class="box"><div class="lbl">⚖️ いまの町の決まり</div>${laws.length ? laws.map(k => `<div class="news">${E.BILLS[k].icon} ${E.BILLS[k].name} <span class="t3">(${E.BILLS[k].text}・あと${S.laws[k] - S.t}か月)</span></div>`).join('') : '<div class="t3">特になし。毎年6月にギルドの議題が出る</div>'}</div>
    <div class="box"><div class="lbl">🗣️ 町のうわさ</div>${(S.rumors || []).length ? S.rumors.map(r => `<div class="news">${esc(r.t)}</div>`).join('') : '<div class="t3">まだうわさはない</div>'}</div>
    <div class="box"><div class="lbl">🧾 年末の決算</div><div class="t2">毎年12月の終わりに、その年の店の利益の${Math.round((E.lawsActive(S).includes('guildTax') ? 0.1 : E.TAX_RATE) * 100)}%を税として払う。その年に出店や育て方にかけたお金の半分は利益から差し引ける。</div><div class="kv"><span class="k">今年ここまでの利益</span><span class="num">${fmt(me().yProfit || 0)}G</span></div><div class="kv"><span class="k">今年の設備投資</span><span class="num">${fmt(me().yCapex || 0)}G</span></div></div>`;
};
SHEETS.alerts = () => head('⚠️', '判断が必要なこと', '方針を変えるならここ') + `<div class="box">${(F.alerts || []).map(a => `<button class="news" style="width:100%;text-align:left" data-a="alert" data-k="${a.a || ''}" data-id="${a.id || ''}">${a.t}${a.a ? ' ›' : ''}</button>`).join('') || '<div class="t2">いまはない</div>'}</div><button class="btn wide" data-a="manager">🤵 店長と仕入れ係</button>`;
SHEETS.manager = () => {
  const P = pol(), mine = E.storesOf(S, ME);
  return head('🤵', '店長と仕入れ係', 'ルールを決めておくと、毎月の作業を任せられる') +
    `<div class="box"><div class="lbl">店員の数を店長に任せる</div>${mine.length ? mine.map(s => `<div class="kv"><span class="k">${E.GOODS[s.g].icon}${E.GOODS[s.g].name} <span class="t3">${E.DISTRICTS[s.d].short}</span></span><span><button class="btn sm ${P.staff[s.id] ? 'pri' : ''}" data-a="polstaff" data-id="${s.id}">${P.staff[s.id] ? '任せる ✓' : '自分で決める'}</button></span></div>`).join('') : '<div class="t3">店ができたら設定できる</div>'}<div class="t3" style="margin-top:6px">先月の客の数を見て、店員を1人ずつ増減する。値段と広告はあなたが決める。</div></div>
    <div class="box"><div class="lbl">材料の補充(仕入れ係)</div>${Object.entries(E.RES).map(([k, R]) => { const r = P.buy[k] || {}; return `<div class="pr"><div class="row"><span>${R.icon} ${R.name}</span><span class="grow"></span><span class="t3">今 ${S.market[k].price.toFixed(2)}G</span></div><div class="seg" style="margin-top:6px">${[0, 1, 2].map(m => `<button class="${(r.months || 0) === m ? 'on' : ''}" data-a="polbuy" data-v="${k}" data-m="${m}">${m ? `${m}か月分たもつ` : 'しない'}</button>`).join('')}</div>${r.months ? `<div class="row" style="margin-top:6px;gap:6px"><span class="t3">上限</span><button class="btn sm" data-a="polmax" data-v="${k}" data-d="-1">−</button><b class="num">${(r.max || R.base * 1.4).toFixed(2)}G</b><button class="btn sm" data-a="polmax" data-v="${k}" data-d="1">＋</button><span class="t3 grow">これを超えたら止めて知らせる</span></div>` : ''}</div>`; }).join('')}</div>`;
};
// 答え合わせ: 予報と実際、相場の動き
function checkOf(pre) {
  const out = [];
  const wf = wx(pre.wFore), wa = wx(S.w);
  out.push(`${wf.icon}→${wa.icon} 天気予報は「${wf.name}」、実際は「${wa.name}」 ${pre.wFore === S.w ? '<span class="up">当たり</span>' : '<span class="down">はずれ</span>'}`);
  if (pre.ev && pre.ev !== 'calm') { const e = E.evDef(pre.ev); out.push(`${e.icon} ${e.name}が来た`); }
  const used = new Set(E.storesOf(S, ME).map(s => E.GOODS[s.g].res).concat(E.shopsOf(S, ME).filter(s => s.res).map(s => s.res)).concat(Object.keys(me().inv).filter(k => me().inv[k] > 0)));
  const moves = Object.keys(E.ITEMS).map(k => [k, S.market[k].price / pre.prices[k] - 1]).filter(([k, ch]) => used.has(k) || Math.abs(ch) > 0.12).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4);
  if (moves.length) out.push('相場: ' + moves.map(([k, ch]) => `${E.ITEMS[k].icon}${E.ITEMS[k].name} <span class="${ch > 0 ? 'down' : 'up'}">${ch >= 0 ? '+' : '−'}${Math.abs(Math.round(ch * 100))}%</span>`).join(' · '));
  const buyers = (S.ledger || []).filter(f => f.pid !== ME && f.kind === 'buy' && f.qty >= 40);
  if (buyers.length) out.push('買い込んだのは: ' + buyers.map(f => `${pname(S.players[f.pid])} ${E.ITEMS[f.res].name}${fmt(f.qty)}`).join('・'));
  return out;
}
function newsOf(fx, pre) {
  const out = [];
  for (const f of fx) {
    const p = S.players[f.pid]; if (f.pid === ME) continue;
    if (f.kind === 'open') { const s = S.shops.find(x => x.id === f.shop); if (s) out.push(`${pname(p)} が ${E.DISTRICTS[s.d].short}に<b>${gd(s).name}</b>を開いた`); }
    if (f.kind === 'close') out.push(`${pname(p)} が店をひとつたたんだ`);
    if (f.kind === 'buy' && f.qty >= 60) out.push(`${pname(p)} が<b>${E.ITEMS[f.res].name}</b>を ${f.qty} 買い込んだ(値上がりに注意)`);
    if (f.kind === 'card' && ['craft', 'remodel'].includes(f.card)) out.push(`${pname(p)} が「${E.CARDS[f.card].name}」を使った`);
    if (f.kind === 'bailout') out.push(`${pname(p)} はお金が尽きて銀行から借りた`);
    if (f.kind === 'deal' && f.offer.qty * f.offer.price > 300) out.push(`${pname(p)} が${esc(f.offer.who)}と大きな取引をまとめた`);
    if (f.kind === 'hire' && E.TRAITS[f.who.trait].wage >= 36) out.push(`${pname(p)} が${E.TRAITS[f.who.trait].icon}${E.TRAITS[f.who.trait].name}の${esc(f.who.name)}を雇った`);
    if (f.kind === 'questTake') out.push(`${pname(p)} が町の依頼を受けた`);
    if (f.kind === 'buyshop') { const sh = S.shops.find(x => x.id === f.shop); out.push(`${pname(p)} が ${pname(S.players[f.from])} の${sh ? gd(sh).name : '店'}を ${fmt(f.price)}G で買い取った`); }
    if (f.kind === 'route') out.push(`${pname(p)} が店を${E.ROUTES[f.k].icon}${E.ROUTES[f.k].name}${f.lv === 2 ? ' Lv2' : ''}に育てた`);
    if (f.kind === 'card' && (f.card === 'poach' || f.card === 'headhunt') && f.target === ME) { const s = S.shops.find(x => x.id === f.shop); out.unshift(`<span class="down">⚔️ ${pname(p)} があなたの${s ? gd(s).name : '店'}に「${E.CARDS[f.card].name}」を仕掛けてきた!</span>`); }
    if (f.kind === 'card' && f.card === 'dump') out.push(`${pname(p)} が${E.ITEMS[f.res].name}を市場に放出した(値下がり)`);
  }
  for (const f of fx) if (f.kind === 'bailout' && f.pid === ME) out.unshift(`<span class="down">⚠️ お金が尽きたので銀行が ${fmt(f.amt)}G を貸した(1割の手数料つき)</span>`);
  for (const f of fx) if (f.kind === 'tax' && f.pid === ME && f.amt > 0) out.unshift(`📜 臨時の税で ${fmt(f.amt)}G 払った`);
  for (const f of fx) {
    if (f.kind === 'law') out.unshift(`🗳️ ギルドの投票で「${E.BILLS[f.bill].name}」に決まった(${Object.entries(f.tally).map(([b, n]) => E.BILLS[b].icon + n + '票').join(' ')})`);
    if (f.kind === 'voteOpen') out.unshift('🗳️ 来月、商人ギルドの投票がある。🏛️町役場で議題を見よう');
    if (f.kind === 'questNew') out.push('📜 町に新しい依頼が出た(🏛️町役場)');
    if (f.pid !== ME) continue;
    if (f.kind === 'yearTax') out.unshift(`🧾 年末の決算: 利益 ${fmt(f.profit)}G − 設備投資の半分 ${fmt(f.capex / 2)}G に税 ${Math.round(f.rate * 100)}% → <b>${fmt(f.tax)}G</b> 払った`);
    if (f.kind === 'questDone') out.unshift(`📜 依頼をやりとげた! 褒美 ${fmt(f.bonus)}G`);
    if (f.kind === 'questFail') out.unshift(`<span class="down">📜 依頼の期限に間に合わず、違約金 ${fmt(f.fine)}G</span>`);
    if (f.kind === 'deliver') out.push(`📜 依頼の品を ${fmt(f.qty)}個 納めて ${fmt(f.got)}G`);
    if (f.kind === 'buyshop') out.unshift(`🤝 ${pname(S.players[f.from])} の店を ${fmt(f.price)}G で買い取った!`);
    if (f.kind === 'buyshopNo') out.unshift(`🤝 ${pname(S.players[f.from])} に店の買い取りを断られた(${fmt(f.price)}G では安すぎた)`);
  }
  for (const f of fx) {
    if ((f.kind === 'pactYes' || f.kind === 'pactNo') && (f.pid === ME || f.to === ME)) { const c = f.pact, other = S.players[f.pid === ME ? f.to : f.pid]; out.unshift(f.kind === 'pactYes' ? `📝 ${esc(other.name)}と契約: ${E.ITEMS[c.item].name} 毎月${fmt(c.qty)}個 · ${c.price.toFixed(2)}G · ${c.months}か月${c.pay ? '(翌月払い)' : ''}` : `📝 ${esc(other.name)}は契約を断った(${E.ITEMS[c.item].name} ${c.price.toFixed(2)}G${c.pay ? '・翌月払い' : ''})`); }
    if (f.kind === 'pactDeliver' && f.short > 0 && (f.seller === ME || f.buyer === ME)) out.push(f.seller === ME ? `⚠️ 契約の${E.ITEMS[f.item].name}が${fmt(f.short)}個足りず、違約金を払った` : `📦 ${esc(S.players[f.seller].name)}の納品が${fmt(f.short)}個足りず、違約金を受け取った`);
    if (f.kind === 'recvPaid' && f.bridge && f.from === ME) out.push(`🏦 つなぎ融資 ${fmt(f.amt)}G を返した`);
    if (f.kind === 'factor' && f.pid === ME) out.push(`🧾 売掛金 ${fmt(f.amt)}G を ${fmt(f.got)}G で前倒しで受け取った`);
  }
  for (const f of fx) if (f.kind === 'deal' && f.pid === ME) { const o = f.offer, r = E.ITEMS[o.item]; out.unshift(`🤝 ${esc(o.who)}に${r.name} ${fmt(o.qty)}個を${o.kind === 'buy' ? '売った' : '買った'}(${fmt(o.qty * o.price)}G)`); }
  if (S.w === 'storm' || S.w === 'snow' || S.w === 'heat') out.unshift(`${wx(S.w).icon} ${wx(S.w).name}の月だった — ${wx(S.w).text}`);
  const ev = S.ev && E.evDef(S.ev.id); if (ev && ev.id !== 'calm') out.unshift(`${ev.icon} ${esc(ev.name)}が始まった`);
  if (fx.some(f => f.kind === 'grand')) out.unshift(`<b>🏰 最後の年! 王都の大祭が近づいている。最終月に各地区で一番の商会に ${E.CROWN_BONUS}G</b>`);
  for (const f of fx) if (f.kind === 'card' && f.pid === ME && (f.card === 'poach' || f.card === 'headhunt')) { const s = S.shops.find(x => x.id === f.shop); if (s) out.unshift(`⚔️ ${pname(S.players[s.owner])} の${gd(s).name}に「${E.CARDS[f.card].name}」を仕掛けた`); }
  return out.slice(0, 6);
}
function tipOf() {
  if (E.finalYear(S) && S.crowns) { const lost = Object.entries(S.crowns).find(([d, c]) => c && c.pid !== ME && E.shopsOf(S, ME).some(s => s.d === d)); if (lost) return `大祭の年。${E.DISTRICTS[lost[0]].name}の覇者は今 ${esc(S.players[lost[1].pid].name)}(${fmt(lost[1].units)}人)。最終月に抜き返せば +${E.CROWN_BONUS}G。`; }
  const mine = E.storesOf(S, ME).filter(s => s.last);
  const wk = E.shopsOf(S, ME).find(s => s.g === 'work' && s.last && s.last.short > 5); if (wk) return `工房の原料(${E.RES[wk.res].name})が足りず、${fmt(wk.last.short)}個ぶん作れなかった。市場で原料を買っておこう。`;
  if (!mine.length) return S.t <= 2 ? '町の「+」をタップして、最初の店を開こう。住宅街は家賃が安く、パン屋は数が出る。' : '店がないと稼げない。まずは1店!';
  const busy = mine.find(s => s.last.want > s.last.cap * 1.1); if (busy) return `${gd(busy).name}(${E.DISTRICTS[busy.d].short})はお客を ${fmt(busy.last.want - busy.last.cap)}人 逃している。店員を増やすか、値上げしてもよさそう。`;
  const idle = mine.find(s => s.last.cap > s.last.want * 1.6 && s.staff > 1); if (idle) return `${gd(idle).name}(${E.DISTRICTS[idle.d].short})は店員が余っている。1人減らすと人件費 ${E.WAGE}G 浮く。`;
  const loss = mine.find(s => s.last.profit < 0); if (loss) return `${gd(loss).name}(${E.DISTRICTS[loss.d].short})が赤字。店をタップして🔮の見積もりを見ながら値段・人数を調整しよう。`;
  const ev = S.evNext && E.evDef(S.evNext.id);
  if (ev && (ev.prod || ev.need)) { const k = Object.keys(ev.prod || {}).concat(Object.keys(ev.need || {}))[0], up = (ev.need && ev.need[k] > 1) || (ev.prod && ev.prod[k] < 1); const it = E.ITEMS[k]; if (it) return up ? `来月は${it.name}の${ev.need && ev.need[k] > 1 ? '欲しがる人が増え' : '生産が減り'}、町の在庫が細りそう。値上がりする前に動くか、様子を見るか。` : `来月は${it.name}がたくさん出回りそう。在庫が増えると値下がりしやすい。`; }
  const wf = wx(S.wFore); if (S.wFore === 'storm' && mine.some(s => E.DISTRICTS[s.d].kind === 'port')) return `来月は${wf.icon}嵐の予報。港の客が大きく減りそう。店員を減らすか、ほかの地区で稼ごう。`; if (S.wFore === 'snow' && mine.some(s => s.g === 'cloth')) return `来月は${wf.icon}雪の予報。服がよく売れるので、仕立て屋の店員を増やしておくといいかも。`;
  if (me().cash > 700 && mine.length < E.MAX_SHOPS) return 'お金に余裕がある。2店目・3店目を出すと稼ぎが増える。';
  return '';
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function popAt(pos, v, color) { const d = document.createElement('div'); d.className = 'pop ' + (v >= 0 ? 'g' : 'r'); d.style.left = pos.x + 'px'; d.style.top = pos.y + 'px'; d.textContent = sign(v) + 'G'; if (color) d.style.outline = `3px solid ${E.COLOR_HEX[color]}`; $('#pops').appendChild(d); setTimeout(() => d.remove(), 2300); }
// 所持金が変わったら、数字が転がって弾む
function cashRoll() {
  const el = $('#cashv'); if (!el) return; const v = Math.round(freeCash()), old = F.cashShown;
  F.cashShown = v; if (old == null || old === v) return;
  el.textContent = fmt(old); const pill = el.closest('.pill'); if (pill) { pill.classList.remove('bump', 'dip'); void pill.offsetWidth; pill.classList.add(v > old ? 'bump' : 'dip'); }
  const t0 = performance.now(), tick = (t) => { const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3); if (!el.isConnected) return; el.textContent = fmt(Math.round(old + (v - old) * e)); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
}
function countUp(el, v) { if (!el) return; const t0 = performance.now(); const tick = (t) => { const k = Math.min(1, (t - t0) / 900); el.textContent = sign(v * (1 - Math.pow(1 - k, 3))) + 'G'; if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
function confetti() { const c = ['#4f8cff', '#ff5d6c', '#ffc53d', '#3ccf8e', '#c79bff']; for (let i = 0; i < 40; i++) { const d = document.createElement('div'); d.className = 'confetti'; d.style.left = Math.random() * 100 + 'vw'; d.style.background = c[i % 5]; d.style.animationDuration = 1.8 + Math.random() * 1.4 + 's'; d.style.animationDelay = Math.random() * 0.4 + 's'; document.body.appendChild(d); setTimeout(() => d.remove(), 3800); } }
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

function labelsFor() { labels(); }
function updateLabels() {
  for (const el of document.querySelectorAll('.dlabel')) {
    const k = el.dataset.d, D = E.DISTRICTS[k]; if (!D) continue; const c = S.crowns && S.crowns[k];
    const md = D.kind === 'plaza' && E.marketDay({ t: S.t }) ? ' 🛍️' : '';
    const pk = E.prosperK(S, k); el.innerHTML = `${pk >= 1.06 ? '✨' : pk < 0.96 ? '🍂' : ''}${D.name}${md}${E.finalYear(S) && c ? ` <span style="color:${E.COLOR_HEX[S.players[c.pid].color]}">👑</span>` : ''}<small>家賃${D.rent}</small>`;
  }
}
// ── 地区の名前と自分の店の印(毎フレーム位置を合わせる)
function labels() {
  const wrap = $('#labels');
  const centers = {};
  for (const d in E.DISTRICTS) { const ls = E.LOTS.filter(l => l.d === d); centers[d] = [ls.reduce((a, l) => a + l.q, 0) / ls.length, ls.reduce((a, l) => a + l.r, 0) / ls.length]; }
  wrap.innerHTML = Object.keys(centers).map((k) => `<button class="dlabel" data-a="district" data-d="${k}"></button>`).join('');
  updateLabels();
  board.onFrame = () => {
    if ((F.coachF = (F.coachF || 0) + 1) % 3 === 0) coachTick();
    if (F.coachF % 10 === 0) questTick();
    for (const el of wrap.children) {
      const [q, r] = centers[el.dataset.d]; const v = hexPos(q, r); v.y = 0.1;
      const p = v.project(board.cam); const rc = board.R.domElement.getBoundingClientRect();
      el.style.left = (rc.left + (p.x + 1) / 2 * rc.width) + 'px'; el.style.top = (rc.top + (1 - p.y) / 2 * rc.height) + 'px';
    }
  };
}

// ── 始める
async function startNew(stage) {
  stage = stage || (S && S.stage) || 'rose';
  const seed = Math.floor(Math.random() * 1e9);
  S = E.newGame({ seed, stage, months: F.months || 60, level: F.level || 'hard' }); F.acts = []; save();
  $('#loading').classList.remove('off');
  await board.build(stage); await board.sync(S, ME);
  labels(); render(); board.home(); board.setWeather('sun');
  setTimeout(() => $('#loading').classList.add('off'), 200);
  setTimeout(() => showVS(() => { if (!tutSeen()) showTut(0); }), 450);
}
const tutSeen = () => { try { return localStorage.getItem('capital-tut-seen') === '1'; } catch (e) { return true; } };
SHEETS.stages = () => {
  const rec = records(), pv = F.pv || null;
  const mo = F.months || 60;
  const lv = F.level || 'hard';
  return head('🗺️', 'ステージを選ぶ', '町ごとに地区・客・事件がちがう') + `<div class="lbl">ライバルの強さ</div><div class="seg" style="margin-bottom:6px">${Object.entries(E.AI_LEVEL).map(([k, L]) => `<button class="${lv === k ? 'on' : ''}" data-a="setlevel" data-v="${k}">${L.name}</button>`).join('')}</div><div class="t3" style="margin-bottom:10px">${E.AI_LEVEL[lv].desc}${lv !== 'normal' ? '。出店の前に、先の数か月を頭の中で試算してから動く' : ''}</div><div class="lbl">期間</div><div class="seg" style="margin-bottom:10px">${[[12, '1年(さくっと)'], [36, '3年'], [60, '5年(本番)']].map(([m, n]) => `<button class="${mo === m ? 'on' : ''}" data-a="setmonths" data-v="${m}">${n}</button>`).join('')}</div>` + Object.entries(E.STAGES).map(([k, st]) => { const r = rec[k]; return `<button class="good ${pv === k ? 'on' : ''}" style="width:100%;margin-bottom:10px;display:flex;gap:12px;align-items:center" data-a="stagepv" data-v="${k}"><div class="gi" style="font-size:38px">${st.icon}</div><div class="grow"><div class="gn">${st.name} <span class="stars">${'★'.repeat(st.diff)}<span style="opacity:.25">${'★'.repeat(3 - st.diff)}</span></span></div><div class="gs">${st.sub} · ${st.desc}</div><div class="gs">${Object.values(st.districts).map(d => d.name).join('・')} · 店は${st.maxShops || 5}つまで</div>${r && r.pos ? `<div class="gs" style="color:var(--pri)">🏆 最高 ${r.pos}位(${fmt(r.nw)}G)</div>` : ''}</div></button>${pv === k ? `<button class="btn warm wide" style="margin:-4px 0 12px" data-a="pickstage" data-v="${k}">${st.icon} この町で始める</button>` : ''}`; }).join('') + '<div class="t3" style="text-align:center">町をタップすると、うしろの地図がその町に変わる</div>';
};
async function previewStage(k) {
  if (F.pvBusy) return; F.pvBusy = 1; F.pv = k; renderSheet(); sfx('tap');
  E.useStage(k); await board.build(k); board.setWeather(k === 'snow' ? 'snow' : 'sun'); labelsFor(); 
  F.pvBusy = 0;
}
async function endPreview() { if (!F.pv) return; F.pv = null; E.useStage(S.stage); await board.build(S.stage); await board.sync(S, ME); for (const a of F.acts) if (a.type === 'open') board.preview(a.lot, a.g, me().color); board.setWeather(S.t ? S.w : 'sun'); labels(); }
async function boot() {
  const bar = $('.ld-bar i');
  bar.style.width = '20%';
  board = new Board($('#stage'));
  board.faceOf = (pid) => { const p = S.players[pid]; return { url: p ? board.portrait(playerLook(p)) : '', name: pid === ME ? 'あなた' : p ? p.name : '' }; };
  board.onTap = ({ shop, lot, peddler }) => {
    if (F.busy) return;
    if (peddler) { F.mtab = 'rare'; openSheet('market'); sfx('pop'); haptic(10); return; }
    if (shop != null) { const s = S.shops.find(x => x.id === shop); if (s) { board.focus(s.lot); openSheet('shop', { id: shop }); sfx('pop'); haptic(10); } return; }
    if (lot != null && !S.over) {
      const p = pendOpen(lot);
      if (p || !E.lotFree(S, lot)) { board.highlightLot(lot); openSheet('lot', { lot, g: p ? p.g : null, res: p ? p.res : null }); sfx('pop'); haptic(10); return; }
      if (F.build && F.build.step === 'place') { document.body.classList.remove('placing'); F.build.lot = lot; F.build.step = 'confirm'; board.showRatings([ratingOf(lot)]); board.focus(lot); sfx('pop'); haptic(12); render(); return; }
      board.highlightLot(lot); buildStart(lot); sfx('pop'); haptic(10);
    }
  };
  const sv = loadSave();
  if (sv) { S = sv.S; F.acts = sv.acts || []; E.useStage(S.stage); } else { S = E.newGame({ seed: Math.floor(Math.random() * 1e9), stage: 'rose' }); }
  await board.build(S.stage); bar.style.width = '80%';
  await board.sync(S, ME);
  for (const a of F.acts) if (a.type === 'open') board.preview(a.lot, a.g, me().color);
  labels(); render(); board.setWeather(S.t ? S.w : 'sun'); board.setProsperity(avgProsper()); bar.style.width = '100%';
  setTimeout(() => { $('#loading').classList.add('off'); }, 250);
  const tl = document.createElement('div'); tl.className = 'title';
  tl.innerHTML = `<div class="tl">CAPITAL</div><div class="ts">商会バトル</div><div class="tb">${sv && S.t && !S.over ? `<button class="btn warm" data-a="start">つづきから<br><small>${E.STAGES[S.stage].icon} ${E.STAGES[S.stage].name} · ${ym(S.t)}</small></button><button class="btn ghost" data-a="newgame">🗺️ 新しく始める(町を選ぶ)</button>` : `<button class="btn warm" data-a="newgame">はじめる(町を選ぶ)</button>`}${mpLoad() ? `<button class="btn ghost" data-a="mpresume">🔁 オンライン対戦に戻る<br><small>部屋 ${esc(mpLoad().code)}</small></button>` : ''}<button class="btn ghost" data-a="online">🌐 友だちと対戦</button></div>`;
  document.body.appendChild(tl);
  if (S.over) setTimeout(() => openSheet('final'), 600);
  window.__game = { get S() { return S; }, F, E, board, H, NET, get ME() { return ME; } };
  const q = new URLSearchParams(location.search).get('room'); if (q) { F.joinCode = q.toUpperCase(); setTimeout(() => { $('.title') && $('.title').remove(); unlockAudio(); openSheet('online'); }, 700); }
}
boot();
// 新しい版が出ていたら、自動で入れかえる(古い画面のまま遊ばないように)
const BUILD = '20261114024759';
(async () => {
  try {
    const v = (await (await fetch('version.txt', { cache: 'no-store' })).text()).trim();
    if (v && v !== BUILD && sessionStorage.getItem('capital-reloaded') !== v) {
      sessionStorage.setItem('capital-reloaded', v);
      if (navigator.serviceWorker) { const r = await navigator.serviceWorker.getRegistration(); if (r) await r.update(); }
      if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
      location.reload();
    }
  } catch (e) { }
})();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
