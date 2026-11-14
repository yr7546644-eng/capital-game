// オフラインでも一人用が遊べるように、読み込んだファイルを保存しておく
const C = 'capital-v2';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('supabase.co')) return;
  // 新しい版を先に取りにいき、だめなら保存した版を使う
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(C).then(ca => ca.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
});
