// 友だちとオンライン対戦(Supabase Realtime の Broadcast と Presence を使う。データベースには何も保存しない)
// 進め方: 部屋を作った人(ホスト)が月を進める計算をして、毎月の結果(町の状態まるごと)を全員に配る。
// ほかの人は自分の決断をホストに送るだけ。だから機種の違いで結果がずれることがない。
const SB_URL = 'https://mylsdtsxvgksnkzzseox.supabase.co';
const SB_KEY = 'sb_publishable_HN5RBbxtaR6Q8aTmUOpP5g_URqZm3xC';   // 公開してよい鍵(書き込み権限なし)
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const cidKey = 'capital-cid';
const myCid = (() => { try { let v = localStorage.getItem(cidKey); if (!v) { v = Math.random().toString(36).slice(2, 10); localStorage.setItem(cidKey, v); } return v; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();

export const NET = {
  on: false, host: false, code: null, cid: myCid, name: '', ch: null, members: [], seats: null, mySeat: 0, status: 'off', ready: {}, handlers: {}, lastLive: 0,
  emit(ev, data) { const h = this.handlers[ev]; if (h) try { h(data); } catch (e) { console.error(e); } },
  on_(ev, f) { this.handlers[ev] = f; },
  online(cid) { return this.members.some(m => m.cid === cid); },
  hostOnline() { return this.members.some(m => m.host); },
};
let sb = null, wantOn = false;
async function client() { if (sb) return sb; const m = await import(LIB); sb = m.createClient(SB_URL, SB_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 }, heartbeatIntervalMs: 15000 } }); return sb; }
export const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };

// ── 町の状態は大きいので圧縮して送る(gzip → base64)。使えない端末ではそのまま送る
const b64 = { enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }, dec(str) { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; } };
async function pack(obj) {
  const json = JSON.stringify(obj);
  if (typeof CompressionStream === 'undefined') return { j: json };
  const cs = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  return { z: b64.enc(new Uint8Array(await new Response(cs).arrayBuffer())) };
}
async function unpack(p) {
  if (p.j) return JSON.parse(p.j);
  const ds = new Blob([b64.dec(p.z)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(ds).text());
}

export async function joinRoom(code, name, asHost) {
  await leaveRoom(true);
  const c = await client();
  NET.code = code.toUpperCase(); NET.name = name; NET.host = !!asHost; NET.on = true; wantOn = true; NET.status = 'connecting'; NET.ready = {};
  const ch = c.channel('capital-' + NET.code, { config: { broadcast: { self: false, ack: false }, presence: { key: myCid } } });
  NET.ch = ch;
  ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload));
  ch.on('presence', { event: 'sync' }, () => {
    if (NET.ch !== ch) return;
    const st = ch.presenceState();
    NET.members = Object.values(st).map(a => a[0]).filter(Boolean).sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0) || a.at - b.at);
    NET.emit('members', NET.members);
  });
  return new Promise((res) => {
    let done = false;
    const to = setTimeout(() => { if (!done) { done = true; NET.status = 'error'; NET.emit('status', 'error'); res(false); } }, 15000);
    ch.subscribe(async (s) => {
      if (NET.ch !== ch) return;   // 古いつなぎ直し前のチャンネル
      if (s === 'SUBSCRIBED') {
        const again = NET.lastLive > 0; NET.status = 'live'; NET.lastLive = Date.now();
        await ch.track({ cid: myCid, name, host: NET.host, at: Date.now() });
        if (!done) { done = true; clearTimeout(to); res(true); }
        NET.emit('status', 'live'); NET.emit('live', { again });
      }
      if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        NET.status = s === 'CLOSED' && !wantOn ? 'off' : 'error'; NET.emit('status', NET.status);
        if (!done) { done = true; clearTimeout(to); res(false); }
      }
    });
  });
}
export async function leaveRoom(keep) { if (!keep) wantOn = false; if (NET.ch) { const ch = NET.ch; NET.ch = null; try { if (sb) await sb.removeChannel(ch); else await ch.unsubscribe(); } catch (e) { } } NET.on = false; NET.status = 'off'; NET.lastLive = 0; if (!keep) { NET.members = []; } }
// 切れたら入り直す(スマホがスリープから戻ったときなど)
let rejoining = false;
export async function ensureLive() {
  if (!wantOn || rejoining || NET.status === 'live' || !NET.code) return;
  rejoining = true; const { code, name, host } = NET;
  try { await joinRoom(code, name, host); } finally { rejoining = false; }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(ensureLive, 300); });
  window.addEventListener('online', () => setTimeout(ensureLive, 500));
  setInterval(() => { if (wantOn && NET.status === 'error') ensureLive(); }, 8000);
}

export async function send(payload) {
  if (!NET.ch) return false;
  try {
    let p = payload;
    if (payload.S) { const { S, ...rest } = payload; p = { ...rest, S: await pack(S) }; }
    const r = await NET.ch.send({ type: 'broadcast', event: 'm', payload: p });
    return r === 'ok';
  } catch (e) { console.warn('send', e); return false; }
}

async function onMsg(m) {
  if (!m || !m.k) return;
  if (m.S) { try { m.S = await unpack(m.S); } catch (e) { console.warn('unpack', e); return; } }
  if (m.to && m.to !== myCid) return;
  // みんなが受け取るもの
  if (m.k === 'stamp') { NET.emit('stamp', m); return; }
  // ホストだけが受け取るもの
  if (NET.host) {
    if (m.k === 'hello') NET.emit('hello', m);
    if (m.k === 'acts') NET.emit('acts', m);
    if (m.k === 'sync') NET.emit('syncReq', m);
    if (m.k === 'bye') NET.emit('bye', m);
    return;
  }
  // 参加者が受け取るもの
  if (m.k === 'start' || m.k === 'state') { NET.seats = m.seats; NET.mySeat = m.seats.findIndex(x => x.cid === myCid); NET.emit(m.k, m); }
  if (m.k === 'ready') { NET.ready = m.ready; NET.emit('ready', m.ready); }
  if (m.k === 'poke') NET.emit('poke', m);
  if (m.k === 'closed') NET.emit('closed', m);
}
