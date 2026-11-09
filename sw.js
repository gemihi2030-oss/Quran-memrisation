// عامل الخدمة: يجعل التطبيق يعمل دون إنترنت
const CACHE = "quran-mem-v2.0.0";
const ASSETS = [
  "./", "index.html", "css/style.css", "manifest.webmanifest",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
  "js/main.js", "js/util.js", "js/db.js", "js/srs.js", "js/state.js", "js/router.js",
  "js/quran.js", "js/quran-meta.js",
  "js/views/home.js", "js/views/review.js", "js/views/mushaf.js", "js/views/editor.js",
  "js/views/detail.js", "js/views/range.js", "js/views/settings.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// الشبكة أولاً (للحصول على آخر نسخة)، ثم النسخة المخزنة عند انقطاع الإنترنت
// نصوص الآيات لا تمر من هنا: تُخزَّن في IndexedDB
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.hostname === "api.alquran.cloud") return;
  const cacheable = url.origin === location.origin || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com");
  if (!cacheable) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
