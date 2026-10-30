/* Zonefall · Rift Lobby service worker
   · code & pages: network-first (always fresh), cache used only when offline
   · scans / sprites / fonts: cache-first (they never change)
   · an offline lobby never stands in for the game or its assets */
const APP = 'zonefall-lobby';
const SHELL = ['./', './index.html', './css/lobby.css', './data.js', './app.js', './battle.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable.png',
  './game/index.html'];

const isAsset = p => /\/(img|assets)\//.test(p);
const isLobbyPage = p => p === '/' || p === '/index.html' || p === '/game/index.html';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== APP).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // never intercept the engine folder — it ships its own service worker
  if (u.pathname.startsWith('/game/')) return;
  if (isAsset(u.pathname)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(APP).then(c => c.put(e.request, cp)); }
      return r;
    })));
    return;
  }
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(APP).then(c => c.put(e.request, cp)); }
    return r;
  }).catch(async () => {
    const hit = await caches.match(e.request);
    if (hit) return hit;
    if (e.request.mode === 'navigate' && u.pathname !== '/game/index.html') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    return Response.error();
  }));
});
