// Offline support for Trips: keeps the app, its fonts, the map library and Firebase code on the device.
// Bump VERSION when you upload new files so phones pick up the change.
const VERSION = "trips-v27";
const TILES = "wayfinder-tiles";   // saved maps; kept across app updates
const SHELL = ["./", "index.html", "app.js", "style.css", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "logo.png", "countries.json", "config.js", "airports.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("trips-") && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  const own = url.origin === location.origin;
  const lib = ["www.gstatic.com", "fonts.gstatic.com", "fonts.googleapis.com", "cdnjs.cloudflare.com", "unpkg.com"].includes(url.hostname);
  // the free map: styles change now and then (network first); tiles, fonts and icons are kept (cache first) so saved maps work offline
  if (url.hostname === "tiles.openfreemap.org") {
    const fresh = url.pathname.startsWith("/styles/") || /^\/planet\/?$/.test(url.pathname);
    e.respondWith(caches.open(TILES).then(c => fresh
      ? fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => c.match(req).then(r => r || Response.error()))
      : c.match(req).then(r => r || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  if (!own && !lib) return;   // live data, search, photos and other map tiles go straight to the network
  if (own) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })));
  }
});
// lock-screen alerts sent by the Wayfinder server (every push must show a notification)
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Wayfinder", { body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag || undefined, data: { url: d.url || "./" } }));
});
// tapping an alert opens the app (on the right page when there is one)
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => { const c = cs.find(x => "focus" in x); if (c) { c.navigate?.(url).catch(() => {}); return c.focus(); } return self.clients.openWindow(url); }));
});
