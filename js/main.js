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
const gd = (s) => s.g === 'work' ? { icon: '🏭', name: `工房(${E.PROC[E.RES[s.res].proc].name})`, short: '工房' } : E.GOODS[s.g];
const wx = (k) => E.WEATHER[k] || E.WEATHER.cloudy;

let S = null, board = null;
const F = { acts: [], sheet: null, args: null, busy: false, cardSel: null };
const SAVE = 'capital-battle-v3';
const REC = 'capital-records';
const records = () => { try { return JSON.parse(localStorage.getItem(REC) || '{}'); } catch (e) { return {}; } };
const setRecord = (stage, pos, nw) => { try { const r = records(); const o = r[stage] || {}; const best = !o.pos || pos < o.pos || (pos === o.pos && nw > (o.nw || 0)); r[stage] = { pos: best ? pos : o.pos, nw: best ? nw : o.nw, plays: (o.plays || 0) + 1 }; localStorage.setItem(REC, JSON.stringify(r)); } catch (e) { } };
const save = () => { try { localStorage.setItem(SAVE, JSON.stringify({ S, acts: F.acts })); } catch (e) { } };
const loadSave = () => { try { const j = JSON.parse(localStorage.getItem(SAVE) || 'null'); return j && j.S && j.S.v === 6 ? j : null; } catch (e) { return null; } };

// ── 決断(月末にまとめて実行される)
const me = () => S.players[ME];
function pendCost() {
  let c = 0;
  for (const a of F.acts) {
    if (a.type === 'open') c += E.openCost(E.LOTS[a.lot].d, a.g);
    if (a.type === 'buy') c += E.quote(S, a.res, a.qty);
    if (a.type === 'card') c += E.cardDef(a.card).cost;
    if (a.type === 'repay') c += a.amt;
    if (a.type === 'deal') { const o = (me().offers || []).find(x => x.id === a.id); if (o && o.kind === 'sell') c += o.qty * o.price; if (o && o.kind === 'buy') c -= o.qty * o.price; }
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
    <button class="pill month" data-a="menu"><svg class="ring" viewBox="0 0 30 30"><circle cx="15" cy="15" r="12" fill="none" stroke="#e3e8f5" stroke-width="4"/><circle cx="15" cy="15" r="12" fill="none" stroke="#3a7bd5" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C * prog} ${C}" transform="rotate(-90 15 15)"/></svg><span><div class="m1">${E.STAGES[S.stage].icon} ${S.over ? '終わり' : `${Math.floor(S.t / 12) + 1}年目 · のこり${S.months - S.t}か月`}</div><div class="m2">${S.over ? '最終結果' : `${S.t % 12 + 1}月 ${S.t ? wx(S.w).icon : ''}`}</div></span></button>
    <div class="pill cash"><span class="coin">G</span><span class="num" id="cashv">${fmt(p.cash)}</span>${pc ? `<span class="pend">(予定 −${fmt(pc)})</span>` : ''}</div>
    <button class="pill rank" data-a="ranking"><b class="num">${pos}</b>位 <span class="rt">${E.RANKS[E.rankOf(E.netWorth(S, p))][2]}</span></button>`;
}
// ── 下のドック
function dock() {
  const ev = S.evNext && E.evDef(S.evNext.id), p = me(), used = pendCard();
  const n = F.acts.length;
  $('#dock').innerHTML = `
    <div class="row" style="justify-content:center;gap:6px"><button class="evchip" data-a="weather"><span class="ei">${wx(me().scout === S.t ? S.wNext : S.wFore).icon}</span><span><span class="et">天気予報${me().scout === S.t ? '(確実)' : ''}</span><br>${wx(me().scout === S.t ? S.wNext : S.wFore).name}</span></button>${ev ? `<button class="evchip" data-a="event"><span class="ei">${ev.icon}</span><span><span class="et">来月の予報${E.marketDay({ t: S.t }) ? ' · 🛍️市の日' : ''}</span><br>${esc(ev.name)}</span></button>` : ''}${S.t >= S.months - 18 ? `<button class="evchip grand" data-a="grand"><span class="ei">🏰</span><span><span class="et">${E.finalYear(S) ? '大祭の年' : '大祭まで'}</span><br>${E.finalYear(S) ? `のこり${S.months - S.t}か月` : `あと${S.months - 12 - S.t}か月`}</span></button>` : ''}</div>
    ${F.alerts && F.alerts.length && !S.over ? `<button class="evchip alertchip" data-a="alerts">⚠️ 判断が必要 ${F.alerts.length}件</button>` : ''}
    <div class="hand">${p.hand.map((c, i) => { const cd = E.cardDef(c); const isUsed = used && used.card === c && used.idx === i; return `<button class="card ${isUsed ? 'sel' : used ? 'used' : ''}" data-a="card" data-i="${i}">${isUsed ? '<span class="tag">使う</span>' : ''}<div class="ci">${cd.spec ? '🧑‍🍳' : cd.icon}${cd.spec ? `<span class="cspec">${cd.icon}</span>` : ''}</div><div class="cn">${cd.name}</div><div class="cc">${cd.cost ? fmt(cd.cost) + 'G' : '無料'}</div></button>`; }).join('')}</div>
    <div class="actions">
      <button class="abtn" data-a="market"><span class="ai">🛒</span>市場${(p.offers || []).length ? `<span class="badge">${p.offers.length}</span>` : ''}</button>
      <button class="abtn" data-a="books"><span class="ai">📒</span>帳簿</button>
      <button class="abtn go" data-a="next">次の月へ${n ? `<small>決めたこと ${n}</small>` : ''}</button>
    </div>`;
}
function render() { hud(); dock(); updateLabels(); if (F.sheet) renderSheet(); }

// ── シート
const SHEETS = {};
function openSheet(kind, args = {}) { F.sheet = kind; F.args = args; renderSheet(); $('#sheet').scrollTop = 0; $('#sheet').classList.toggle('half', kind === 'stages'); $('#sheetwrap').classList.add('on'); sfx('open'); }
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
      <div class="stepper"><button data-a="sets" data-id="${id}" data-v="-1">−</button><div class="v num">${s.staff}人</div><button data-a="sets" data-id="${id}" data-v="1">＋</button><div class="t3 grow" style="text-align:right">さばける ${fmt(s.staff * G.capPer)}人</div></div>
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
function rivalSheet(s) {
  const p = S.players[s.owner], G = gd(s), l = s.last, sc = me().scout === S.t;
  return head(G.icon, `${G.name}`, `${E.DISTRICTS[s.d].name}`) + `<div class="box"><div class="kv"><span class="k">持ち主</span><span>${pname(p)}<span class="ai-chip">${E.AI_KIND[p.ai] ? E.AI_KIND[p.ai].name : '人'}</span></span></div>
    <div class="kv"><span class="k">評判</span><span>${stars(s.rep)}</span></div>
    <div class="kv"><span class="k">値段</span><span>${E.PRICE_NAME[s.priceLv]}</span></div>
    <div class="kv"><span class="k">育て方</span><span>${s.route ? E.ROUTES[s.route.k].icon + ' ' + E.ROUTES[s.route.k].name + ' Lv' + s.route.lv : 'まだ'}</span></div>
    <div class="kv"><span class="k">先月のお客</span><span class="num">${l ? '約 ' + fmt(Math.round(l.units / 10) * 10) + '人' : '−'}</span></div>
    ${sc ? `<div class="kv"><span class="k">🕵️ 秘密の目標の手がかり</span><span>${E.MISSIONS[p.mission].name}</span></div>` : ''}
    ${sc && l ? `<div class="kv"><span class="k">🕵️ 先月の利益</span><span class="num ${cls(l.profit)}">${sign(l.profit)}G</span></div><div class="kv"><span class="k">🕵️ 店員</span><span>${s.staff}人</span></div>` : ''}</div>
    <div class="t3">同じ地区・同じ業種の店どうしでお客を取り合う。真横に同じ業種の安い店を出すと、客を奪える。${sc ? '' : '「情報屋」カードを使うと、もっと詳しく分かる。'} 攻撃カード(🥊客引き合戦・🤝引き抜き)でこの店を狙える。</div>`;
}
// 市場
SHEETS.market = () => {
  const p = me(), tab = F.mtab || 'raw';
  const offers = p.offers || [];
  const tabs = `<div class="seg" style="margin-bottom:10px">${[['raw', '🌾 原料'], ['proc', '🏭 加工'], ['rare', '💎 レア'], ['ledger', '📜 帳'], ['deal', `🤝 申し出${offers.length ? ` <span class="badge">${offers.length}</span>` : ''}`]].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-a="mtab" data-v="${k}">${n}</button>`).join('')}</div>`;
  const pendQ = (k) => F.acts.filter(a => (a.type === 'buy' || a.type === 'sell') && a.res === k).reduce((a, x) => a + (x.type === 'buy' ? x.qty : -x.qty), 0);
  const row = (k) => {
    const r = E.ITEMS[k], m = S.market[k], h = m.hist.slice(-12), mn = Math.min(...h), mx = Math.max(...h);
    const pts = h.map((v, i) => `${(i / Math.max(1, h.length - 1) * 70).toFixed(1)},${(26 - (v - mn) / Math.max(0.001, mx - mn) * 22).toFixed(1)}`).join(' ');
    const ch = h.length > 1 ? m.price / h[h.length - 2] - 1 : 0, vsb = m.price / r.base - 1;
    const have = p.inv[k], avg = have > 0 ? p.invCost[k] / have : 0, pq = pendQ(k);
    const gain = have > 0 ? have * m.price * (1 - E.SPREAD) - p.invCost[k] : 0;
    return `<div class="res"><span class="ri">${r.icon}</span><div class="grow"><div>${r.name} <span class="num">${m.price.toFixed(2)}G</span> <small class="${ch >= 0 ? 'down' : 'up'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch * 100).toFixed(0)}%</small></div>
      <div class="t3">買 ${(m.price * (1 + E.SPREAD)).toFixed(2)} / 売 ${(m.price * (1 - E.SPREAD)).toFixed(2)} · ふだん ${r.base.toFixed(2)} · ${vsb > 0.12 ? '<span class="down">高い</span>' : vsb < -0.12 ? '<span class="up">安い</span>' : 'ふつう'}${r.decay ? ` · 毎月${Math.round(r.decay * 100)}%傷む` : ' · 傷まない'}</div>
      <div class="t3">あなたの在庫 <b>${fmt(have)}</b>${pq ? ` <b>(${pq > 0 ? '+' : ''}${pq})</b>` : ''}${have > 0 ? ` · 平均 ${avg.toFixed(2)}G · 含み<span class="${cls(gain)}">${sign(gain)}G</span>` : ''}</div>
      ${S.mk && S.mk[k] ? (() => { const mk = S.mk[k], N = E.normalStock(k), lv = mk.stock / N; return `<div class="stockbar"><i style="width:${Math.min(100, lv / 2 * 100)}%;background:${lv < 0.7 ? '#ff7a8a' : lv > 1.3 ? '#34d399' : '#7fc8ff'}"></i><b style="left:50%"></b></div><div class="t3">町の倉 ${fmt(mk.stock)}(ふだん ${fmt(N)}) · 先月 生産 ${fmt(mk.prod)} / 消費 ${fmt(mk.need + (mk.shop || 0))}${mk.shop >= 1 ? `(うち店 ${fmt(mk.shop)})` : ''}</div>`; })() : ''}</div>
      <svg width="72" height="28"><polyline points="${pts}" fill="none" stroke="${vsb > 0 ? '#ff4f64' : '#20b26b'}" stroke-width="2"/></svg>
      <div style="display:flex;flex-direction:column;gap:4px"><button class="btn sm pri" data-a="buy" data-v="${k}">買う ${E.isRare(k) ? 2 : E.isProc(k) ? 20 : 50}</button><button class="btn sm" data-a="sell" data-v="${k}" ${have + Math.min(0, pq) > 0 ? '' : 'disabled'}>売る</button></div></div>`;
  };
  let body = '';
  if (tab === 'raw') body = `<div class="box">${Object.keys(E.RES).map(row).join('')}</div><div class="t3">店は毎月、材料を使う。在庫があれば先に使い、なければその月の値段で買う。安いときに買っておけば値上がりしても困らない。小麦と薬草は傷むので抱えすぎ注意。保管料もかかる。</div>`;
  if (tab === 'proc') body = `<div class="box">${Object.keys(E.PROC).map(row).join('')}</div><div class="t3">加工品は工房で原料から作る(空き地の「+」→🏭工房)。原料より高く売れる。自分の店で使うと「自家製」になる。</div>`;
  if (tab === 'rare') body = `<div class="box">${Object.keys(E.RARES).map(k => row(k) + `<div class="t3" style="margin:-4px 0 8px 34px">${E.RARES[k].where} · ${E.GOODS[E.RARES[k].use].icon}${E.GOODS[E.RARES[k].use].name}の目玉にできる</div>`).join('')}</div><div class="t3">レア素材は量が少なく、買うと一気に値上がりする。使い道は4つ: すぐ売る / 自分の店の目玉商品にする(客寄せ+特別売上) / 前金つきで欲しがるライバルに納める / 値上がりまで持っておく。ただし代わりの素材が入ると値崩れする。</div>`;
  if (tab === 'ledger') {
    const lg = (S.ledger || []).filter(f => f.pid !== ME);
    const lines = lg.map(f => { const pp = S.players[f.pid]; if (f.kind === 'buy') return `${pname(pp)} が ${E.ITEMS[f.res].icon}${E.ITEMS[f.res].name}を <b>${fmt(f.qty)}</b> 買った`; if (f.kind === 'sell') return `${pname(pp)} が ${E.ITEMS[f.res].icon}${E.ITEMS[f.res].name}を <b>${fmt(f.qty)}</b> 売った`; if (f.kind === 'deal') return `${pname(pp)} が商人と ${E.ITEMS[f.offer.item].name} の取引をした`; if (f.kind === 'card') return `${pname(pp)} が ${E.ITEMS[f.res].name}を市場に放出した`; if (f.kind === 'open') { const sh = S.shops.find(x => x.id === f.shop); return sh ? `${pname(pp)} が ${E.DISTRICTS[sh.d].short}に ${gd(sh).name} を開いた` : ''; } if (f.kind === 'close') return `${pname(pp)} が店をたたんだ`; return ''; }).filter(Boolean);
    const stock = S.players.filter(pp => pp.id !== ME).map(pp => { const big = Object.entries(pp.inv).filter(([, v]) => v >= 40).sort((a, b) => b[1] - a[1]).slice(0, 3); return `<div class="kv"><span class="k">${pname(pp)}</span><span>${big.length ? big.map(([k, v]) => `${E.ITEMS[k].icon}${E.ITEMS[k].name} 約${fmt(Math.round(v / 10) * 10)}`).join(' ') : '<span class="t3">ほぼなし</span>'}</span></div>`; }).join('');
    body = `<div class="box"><div class="lbl">先月のライバルの売り買い</div>${lines.length ? lines.map(x => `<div class="news">${x}</div>`).join('') : '<div class="t3">目立った動きはない</div>'}</div><div class="box"><div class="lbl">ライバルの倉(うわさ)</div>${stock}</div><div class="t3">誰かが原料を買い込んでいたら、来月はその原料が値上がりしやすい。倉にたくさんある相手は、売りに出して値を崩すかも。</div>`;
  }
  if (tab === 'deal') body = offers.length ? `<div class="box">${offers.map(o => { const r = E.ITEMS[o.item], m = S.market[o.item].price, on = F.acts.some(a => a.type === 'deal' && a.id === o.id), k = o.price / m; const ok = o.kind === 'buy' ? p.inv[o.item] >= o.qty : freeCash() >= o.qty * o.price || on;
      return `<div class="res"><span class="ri">${r.icon}</span><div class="grow"><div style="font-size:14px">${esc(o.who)}${o.rival != null ? ' <span class="tagg r">前金つき</span>' : ''}${E.isRare(o.item) ? ' <span class="tagg y">レア</span>' : ''}</div>${o.rival != null ? `<div class="t3">納めると、${esc(S.players[o.rival].name)}の${E.GOODS[E.RARES[o.item].use].name}が目玉商品で強くなる</div>` : ''}<div class="t2" style="margin:0">${o.kind === 'buy' ? `あなたの<b>${r.name}</b>を <b>${fmt(o.qty)}</b>個、1個 <b>${o.price.toFixed(2)}G</b> で買いたい` : `<b>${r.name}</b>を <b>${fmt(o.qty)}</b>個、1個 <b>${o.price.toFixed(2)}G</b> で売りたい`}</div><div class="t3">相場 ${m.toFixed(2)}G の <b class="${(o.kind === 'buy') === (k > 1) ? 'up' : 'down'}">${Math.round(k * 100)}%</b> · 合計 ${fmt(o.qty * o.price)}G${o.kind === 'buy' && !ok ? ` · <span class="down">在庫 ${fmt(p.inv[o.item])} では足りない</span>` : ''}</div></div>
        <button class="btn sm ${on ? 'warm' : 'pri'}" data-a="deal" data-v="${o.id}" ${ok || on ? '' : 'disabled'}>${on ? '受ける ✓' : '受ける'}</button></div>`; }).join('')}</div><div class="t3">申し出は今月だけ。「次の月へ」で決まる。相場より高く買ってくれる相手には売り、安く売ってくれる相手からは買うのが基本。でも相場が動く前に…?</div>` : '<div class="box t2">今月は申し出がない。</div>';
  return head('🛒', '市場', '値段は町の倉の在庫で決まる。在庫が減ると値上がり、増えると値下がり') + tabs + body + `<div class="t3" style="margin-top:8px">📦 在庫は「生産(季節・天気・出来事)」で増え、「町の人の消費(高いと控える)」と「みんなの店の仕入れ」で減る。プレイヤーが買えば減り、売れば増える。</div>`;
};
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
SHEETS.ranking = () => {
  const rk = E.ranking(S);
  const W = 320, H = 140, all = S.players.flatMap(p => p.nw), mx = Math.max(...all, 1), mn = Math.min(0, ...all);
  const lines = S.players.map(p => { const n = p.nw.length; return `<polyline fill="none" stroke="${E.COLOR_HEX[p.color]}" stroke-width="${p.id === ME ? 3 : 2}" points="${p.nw.map((v, i) => `${(i / Math.max(1, S.months) * W).toFixed(1)},${(H - (v - mn) / (mx - mn) * (H - 10) - 5).toFixed(1)}`).join(' ')}"/>`; }).join('');
  return head('🏆', '順位', `純資産(現金+店+在庫−借金)で競う · のこり${S.months - S.t}か月`) +
    `<div class="box">${rk.map((x, i) => `<div class="rk"><span class="pos" style="background:${E.COLOR_HEX[x.p.color]}">${i + 1}</span><div class="nm">${esc(x.p.name)}${x.p.id === ME ? ' <span class="ai-chip">あなた</span>' : `<span class="ai-chip">${E.AI_KIND[x.p.ai] ? E.AI_KIND[x.p.ai].name : ''}</span>`}<small>店 ${E.shopsOf(S, x.p.id).length} · 現金 ${fmt(x.p.cash)}G</small></div><div class="num" style="font-size:17px">${fmt(x.nw)}G</div></div>`).join('')}</div>
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
SHEETS.result = ({ r }) => {
  const mine = r.mine, sum = mine.reduce((a, x) => a + x.profit, 0);
  const tierBox = r.tier1 !== r.tier0 ? `<div class="box tierbox ${r.tier1 > r.tier0 ? 'up' : 'down'}"><div style="font-size:34px">${E.RANKS[r.tier1][2]}</div><div><div class="lbl">${r.tier1 > r.tier0 ? '商会の格が上がった!' : '商会の格が下がった…'}</div><div style="font-size:18px">${E.RANKS[r.tier0][1]} → <b>${E.RANKS[r.tier1][1]}</b></div></div></div>` : '';
  return tierBox + `<div class="mhead"><div class="mt">${ym(S.t - 1)}の結果 · ${wx(S.w).icon} ${wx(S.w).name}</div><div class="mv num ${cls(sum)}" id="cntup">${sign(0)}G</div><div class="t3">店の利益の合計 · 現金 ${fmt(me().cash)}G</div></div>
    ${r.alerts && r.alerts.length ? `<div class="box alertbox"><div class="lbl">⚠️ 判断が必要なこと</div>${r.alerts.map(a => `<button class="news" style="width:100%;text-align:left" data-a="alert" data-k="${a.a || ''}" data-id="${a.id || ''}">${a.t}${a.a ? ' ›' : ''}</button>`).join('')}</div>` : '<div class="box" style="padding:10px 14px"><div class="t2" style="margin:0">✅ 今月は判断が必要なことはない。方針はそのまま引き継がれる</div></div>'}
    ${r.auto && r.auto.length ? `<div class="box"><div class="lbl">🤵 店長がしたこと</div>${r.auto.map(t => `<div class="news">${t}</div>`).join('')}</div>` : ''}
    ${mine.length ? `<div class="box">${mine.map(x => `<div class="shoprow"><span class="ic">${x.icon}</span><div class="grow"><div>${x.name} <span class="t3">${x.dist}</span></div><div class="t3">${x.work ? `${fmt(x.units)}個つくった${x.sold ? ` · ${fmt(x.sold)}個売った` : ''}` : `お客 ${fmt(x.units)}人${x.lost > 3 ? ` · <span class="down">${fmt(x.lost)}人を逃した</span>` : ''}`}</div></div><div class="num ${cls(x.profit)}">${sign(x.profit)}</div></div>${x.why ? `<div class="why">💬 ${x.why}${!x.work ? funnelBox(x.s, true) + sourcesBox(x.s, true) : ''}</div>` : ''}`).join('')}</div>` : ''}
    ${(() => { const ls = lessonOf(mine); return ls ? `<div class="box" style="background:linear-gradient(135deg,#eef6ff,#fff)"><div class="lbl">📘 今月の学び</div><div class="t2">${ls}</div></div>` : ''; })()}
    <div class="box"><div class="lbl">順位</div>${r.rank.map((x, i) => `<div class="rk"><span class="pos" style="background:${E.COLOR_HEX[x.color]}">${i + 1}</span><div class="nm">${esc(x.name)}${x.move ? `<span class="rankmove ${x.move > 0 ? 'up' : 'down'}">${x.move > 0 ? '▲' : '▼'}${Math.abs(x.move)}</span>` : ''}</div><div class="num">${fmt(x.nw)}G</div></div>`).join('')}</div>
    ${r.check && r.check.length ? `<div class="box"><div class="lbl">🎯 答え合わせ</div>${r.check.map(n => `<div class="news">${n}</div>`).join('')}</div>` : ''}
    ${r.news.length ? `<div class="box"><div class="lbl">町のうわさ</div>${r.news.map(n => `<div class="news">${n}</div>`).join('')}</div>` : ''}
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
SHEETS.menu = () => head('⚙️', 'メニュー', `${E.STAGES[S.stage].icon} ${E.STAGES[S.stage].name}`) + `<div class="box"><button class="btn wide" data-a="howto" style="margin-bottom:8px">遊び方</button><button class="btn wide" data-a="stagesel" style="margin-bottom:8px">🗺️ 別の町(ステージ)で遊ぶ</button><button class="btn wide" data-a="credits" style="margin-bottom:8px">クレジット</button><button class="btn wide" data-a="restart">最初からやり直す</button></div>`;
SHEETS.howto = () => head('📖', '遊び方', '5年で町いちばんの商会に') + `<div class="box t2">
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
  ⑩「次の月へ」で、決めたことが全部いっしょに実行される。60か月後の純資産で勝負!</div>`;
SHEETS.credits = () => head('🎨', 'クレジット', '') + `<div class="box t2">3D モデル: KayKit — Kay Lousberg(CC0)<br>Quaternius(CC0)<br>3D 表示: three.js(MIT)<br>フォント: M PLUS Rounded 1c(SIL OFL)</div>`;

// ── 操作
const H = {
  close: () => { const was = F.sheet; closeSheet(); if (was === 'stages') endPreview(); if (was === 'result' && S.over) setTimeout(() => openSheet('final'), 350); if (was === 'result') afterResult(); },
  menu: () => openSheet('menu'), howto: () => openSheet('howto'), credits: () => openSheet('credits'),
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
  setauto: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s); setPending(s.id, { priceLv: v.priceLv, staff: v.staff, ads: v.ads, autoSell: +d.v }); sfx('tap'); render(); },
  setproc: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s); setPending(s.id, { priceLv: v.priceLv, staff: v.staff, ads: v.ads, useProc: +d.v }); sfx('tap'); render(); },
  cancelopen: (d) => { const lot = +d.v; F.acts = F.acts.filter(a => !(a.type === 'open' && a.lot === lot)); board.preview(lot, null); save(); closeSheet(); render(); },
  setp: (d) => { const s = S.shops.find(x => x.id === +d.id); setPending(s.id, { priceLv: +d.v, staff: shopView(s).staff, ads: shopView(s).ads }); sfx('tap'); render(); },
  sets: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s); setPending(s.id, { priceLv: v.priceLv, staff: Math.max(1, Math.min(5, v.staff + +d.v)), ads: v.ads }); sfx('tap'); render(); },
  seta: (d) => { const s = S.shops.find(x => x.id === +d.id), v = shopView(s); setPending(s.id, { priceLv: v.priceLv, staff: v.staff, ads: +d.v }); sfx('tap'); render(); },
  closeshop: (d) => { if (!confirm('この店をたたむ?(月末に売れる)')) return; F.acts = F.acts.filter(a => !(a.type === 'set' && a.shop === +d.id)); F.acts.push({ type: 'close', shop: +d.id }); save(); closeSheet(); render(); toast('月末に店をたたむ'); },
  mtab: (d) => { F.mtab = d.v; renderSheet(); },
  deal: (d) => { const id = +d.v; if (F.acts.some(a => a.type === 'deal' && a.id === id)) F.acts = F.acts.filter(a => !(a.type === 'deal' && a.id === id)); else F.acts.push({ type: 'deal', id }); sfx('coin'); save(); render(); },
  buy: (d) => { const q = E.isRare(d.v) ? 2 : E.isProc(d.v) ? 20 : 50, c = E.quote(S, d.v, q); if (freeCash() < c) return toast('お金が足りない'); F.acts.push({ type: 'buy', res: d.v, qty: q }); sfx('coin'); save(); render(); },
  sell: (d) => { const have = me().inv[d.v] - F.acts.filter(a => a.type === 'sell' && a.res === d.v).reduce((a, x) => a + x.qty, 0); const q = Math.min(E.isRare(d.v) ? 2 : E.isProc(d.v) ? 20 : 50, Math.floor(have)); if (q <= 0) return toast('在庫がない'); F.acts.push({ type: 'sell', res: d.v, qty: q }); sfx('coin'); save(); render(); },
  repay: () => { const amt = Math.min(me().debt, Math.floor(freeCash() / 100) * 100); if (amt <= 0) return; F.acts.push({ type: 'repay', amt }); save(); render(); toast(`月末に ${fmt(amt)}G 返す`); },
  next: () => nextMonth(),
  grand: () => openSheet('grand'),
  weather: () => openSheet('weather'),
  manager: () => openSheet('manager'),
  alerts: () => openSheet('alerts'),
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
  restart: () => { if (confirm('最初からやり直す?(同じ町)')) { closeSheet(); startNew(S.stage); } },
  stagesel: () => { if (!S.t || S.over || confirm('今のゲームをやめて、別の町で始める?')) openSheet('stages'); },
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
  const tier0 = E.rankOf(E.netWorth(S, me()));
  const fc = { wFore: me().scout === S.t ? S.wNext : S.wFore, ev: S.evNext ? S.evNext.id : null, prices: Object.fromEntries(Object.keys(E.ITEMS).map(k => [k, S.market[k].price])) };
  const autoDone = autoManage();
  const acts = F.acts.map(({ idx, ...a }) => a);
  const pre = new Set(S.shops.map(s => s.id));
  const shopsBefore = S.shops.map(s => ({ id: s.id, d: s.d, g: s.g, owner: s.owner, lot: s.lot }));
  const { fx, errors } = E.step(S, { [ME]: acts });
  F.alerts = alertsOf(fx, shopsBefore, autoDone);
  F.acts = []; save();
  for (const er of errors.filter(x => x.pid === ME)) toast(er.e);
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
  board.playMonth(S, sales);
  await wait(1500);
  for (const f of sales) { const pos = board.screenOf(f.shop); if (pos) popAt(pos, f.profit, S.players[f.pid].color); }
  if (sales.some(f => f.pid === ME && f.profit > 0)) sfx('coin');
  await wait(1300);
  // 結果
  const after = E.ranking(S);
  const r = {
    mine: E.shopsOf(S, ME).filter(s => s.last).map(s => ({ s, why: whyText(s), prev: s.last.prevProfit, work: s.g === 'work', sold: s.last.sold, icon: gd(s).icon, name: gd(s).name, dist: E.DISTRICTS[s.d].short, units: s.last.units, lost: Math.max(0, s.last.want - s.last.units), profit: s.last.profit })),
    rank: after.map((x, i) => ({ name: x.p.name, color: x.p.color, nw: x.nw, move: before.indexOf(x.p.id) - i })),
    news: newsOf(fx, pre), tip: tipOf(), check: checkOf(fc), auto: autoDone, alerts: F.alerts,
  };
  r.tier0 = tier0; r.tier1 = E.rankOf(E.netWorth(S, me()));
  openSheet('result', { r });
  if (r.tier1 > r.tier0) { sfx('rankup'); confetti(); } else if (r.tier1 < r.tier0) sfx('whoosh');
  countUp($('#cntup'), r.mine.reduce((a, x) => a + x.profit, 0));
  const pos = after.findIndex(x => x.p.id === ME);
  if (pos < before.indexOf(ME)) { sfx('rankup'); confetti(); }
  F.busy = false;
}
function afterResult() { render(); }
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
    if (f.kind === 'route') out.push(`${pname(p)} が店を${E.ROUTES[f.k].icon}${E.ROUTES[f.k].name}${f.lv === 2 ? ' Lv2' : ''}に育てた`);
    if (f.kind === 'card' && (f.card === 'poach' || f.card === 'headhunt') && f.target === ME) { const s = S.shops.find(x => x.id === f.shop); out.unshift(`<span class="down">⚔️ ${pname(p)} があなたの${s ? gd(s).name : '店'}に「${E.CARDS[f.card].name}」を仕掛けてきた!</span>`); }
    if (f.kind === 'card' && f.card === 'dump') out.push(`${pname(p)} が${E.ITEMS[f.res].name}を市場に放出した(値下がり)`);
  }
  for (const f of fx) if (f.kind === 'bailout' && f.pid === ME) out.unshift(`<span class="down">⚠️ お金が尽きたので銀行が ${fmt(f.amt)}G を貸した(1割の手数料つき)</span>`);
  for (const f of fx) if (f.kind === 'tax' && f.pid === ME && f.amt > 0) out.unshift(`📜 臨時の税で ${fmt(f.amt)}G 払った`);
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
  setTimeout(() => openSheet('howto'), 500);
}
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
  board.onTap = ({ shop, lot }) => {
    if (F.busy) return;
    if (shop != null) { const s = S.shops.find(x => x.id === shop); if (s) { board.focus(s.lot); openSheet('shop', { id: shop }); sfx('tap'); } return; }
    if (lot != null && !S.over) { board.highlightLot(lot); const p = pendOpen(lot); openSheet('lot', { lot, g: p ? p.g : null, res: p ? p.res : null }); sfx('tap'); }
  };
  const sv = loadSave();
  if (sv) { S = sv.S; F.acts = sv.acts || []; E.useStage(S.stage); } else { S = E.newGame({ seed: Math.floor(Math.random() * 1e9), stage: 'rose' }); }
  await board.build(S.stage); bar.style.width = '80%';
  await board.sync(S, ME);
  for (const a of F.acts) if (a.type === 'open') board.preview(a.lot, a.g, me().color);
  labels(); render(); board.setWeather(S.t ? S.w : 'sun'); board.setProsperity(avgProsper()); bar.style.width = '100%';
  setTimeout(() => { $('#loading').classList.add('off'); }, 250);
  const tl = document.createElement('div'); tl.className = 'title';
  tl.innerHTML = `<div class="tl">CAPITAL</div><div class="ts">商会バトル</div><div class="tb">${sv && S.t && !S.over ? `<button class="btn warm" data-a="start">つづきから<br><small>${E.STAGES[S.stage].icon} ${E.STAGES[S.stage].name} · ${ym(S.t)}</small></button><button class="btn ghost" data-a="newgame">🗺️ 新しく始める(町を選ぶ)</button>` : `<button class="btn warm" data-a="newgame">はじめる(町を選ぶ)</button>`}</div>`;
  document.body.appendChild(tl);
  if (S.over) setTimeout(() => openSheet('final'), 600);
  window.__game = { get S() { return S; }, F, E, board, H };
}
boot();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
