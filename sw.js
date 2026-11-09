// عامل الخدمة: يجعل التطبيق يعمل بدون إنترنت
const CACHE = "quran-mem-v1";
const ASSETS = [
  "./", "index.html", "css/style.css",
  "js/surahs.js", "js/db.js", "js/srs.js", "js/app.js",
  "manifest.webmanifest", "icons/icon.svg",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.hostname === "api.alquran.cloud") return;
  // الشبكة أولاً (للحصول على التحديثات)، ثم النسخة المخزنة عند انقطاع الإنترنت
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && (url.origin === location.origin || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com"))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
