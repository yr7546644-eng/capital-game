// 友だちとオンライン対戦(Supabase Realtime の Broadcast と Presence を使う。データベースには何も保存しない)
// 進め方: 部屋を作った人(ホスト)が月を進める計算をして、毎月の結果(町の状態まるごと)を全員に配る。
// ほかの人は自分の決断をホストに送るだけ。だから機種の違いで結果がずれることがない。
const SB_URL = 'https://mylsdtsxvgksnkzzseox.supabase.co';
const SB_KEY = 'sb_publishable_HN5RBbxtaR6Q8aTmUOpP5g_URqZm3xC';   // 公開してよい鍵(書き込み権限なし)
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const cidKey = 'capital-cid';
const myCid = (() => { try { let v = localStorage.getItem(cidKey); if (!v) { v = Math.random().toString(36).slice(2, 10); localStorage.setItem(cidKey, v); } return v; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();

export const NET = {
  on: false, host: false, code: null, cid: myCid, name: '', ch: null, members: [], seats: null, mySeat: 0, status: 'off',
  ready: {}, handlers: {},
  emit(ev, data) { const h = this.handlers[ev]; if (h) try { h(data); } catch (e) { console.error(e); } },
  on_(ev, f) { this.handlers[ev] = f; },
};
let sb = null;
async function client() { if (sb) return sb; const m = await import(LIB); sb = m.createClient(SB_URL, SB_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } }); return sb; }
export const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };

export async function joinRoom(code, name, asHost) {
  await leaveRoom();
  const c = await client();
  NET.code = code.toUpperCase(); NET.name = name; NET.host = !!asHost; NET.on = true; NET.status = 'connecting'; NET.ready = {}; NET.seats = null;
  const ch = c.channel('capital-' + NET.code, { config: { broadcast: { self: false, ack: false }, presence: { key: myCid } } });
  NET.ch = ch;
  ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload));
  ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState();
    NET.members = Object.values(st).map(a => a[0]).filter(Boolean).sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0) || a.at - b.at);
    NET.emit('members', NET.members);
  });
  return new Promise((res) => {
    let done = false;
    const to = setTimeout(() => { if (!done) { done = true; NET.status = 'error'; NET.emit('status', 'error'); res(false); } }, 12000);
    ch.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') { NET.status = 'live'; await ch.track({ cid: myCid, name, host: NET.host, at: Date.now() }); if (!NET.host) send({ k: 'hello', cid: myCid, name }); if (!done) { done = true; clearTimeout(to); res(true); } NET.emit('status', 'live'); }
      if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') { NET.status = s === 'CLOSED' ? 'off' : 'error'; NET.emit('status', NET.status); if (!done) { done = true; clearTimeout(to); res(false); } }
    });
  });
}
export async function leaveRoom() { if (NET.ch) { try { await NET.ch.unsubscribe(); } catch (e) { } NET.ch = null; } NET.on = false; NET.status = 'off'; NET.seats = null; }
export function send(payload) { if (NET.ch) return NET.ch.send({ type: 'broadcast', event: 'm', payload }); }

function onMsg(m) {
  if (!m || !m.k) return;
  // ホストだけが受け取るもの
  if (NET.host) {
    if (m.k === 'hello') NET.emit('hello', m);
    if (m.k === 'acts') { NET.ready[m.seat] = m; NET.emit('acts', m); }
    if (m.k === 'sync') NET.emit('syncReq', m);
    return;
  }
  // 参加者が受け取るもの
  if (m.k === 'start' || m.k === 'state') { if (m.to && m.to !== myCid) return; NET.seats = m.seats; NET.mySeat = m.seats.findIndex(x => x.cid === myCid); NET.emit(m.k, m); }
  if (m.k === 'ready') { NET.ready = m.ready; NET.emit('ready', m.ready); }
  if (m.k === 'bye') NET.emit('bye', m);
}
