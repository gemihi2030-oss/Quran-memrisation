// صور الصفحة ومصادرها: رابط (يوتيوب، إنستغرام، فيسبوك…) + الوقت داخل الفيديو

// الصورة تُخزَّن كـ { src, url?, time? } (النسخ السابقة كانت تخزّن النص src فقط)
export function toPhoto(x) {
  if (typeof x === "string") return { src: x };
  if (!x || typeof x.src !== "string") return null;
  const p = { src: x.src };
  if (x.url) p.url = String(x.url);
  if (x.time) p.time = String(x.time);
  return p;
}

const fromArDigits = s => String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

// "12:35" أو "1:02:03" أو "755" أو "12m35s" أو "1h2m" ← عدد الثواني (أو null)
export function parseTime(input) {
  const s = fromArDigits(String(input || "")).trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  if (/^\d+$/.test(s)) return +s;
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) return s.split(":").reduce((acc, n) => acc * 60 + +n, 0);
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  return null;
}

export function formatTime(sec) {
  if (sec === null || sec === undefined) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// رابط آمن فقط (http/https)، ويُكمل "youtu.be/…" إلى "https://youtu.be/…"
export function safeUrl(input) {
  let s = String(input || "").trim();
  if (!s) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (!u.hostname.includes(".")) return "";
    return u.href;
  } catch {
    return "";
  }
}

const isYouTube = host => /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(host);

export function platformOf(url) {
  const safe = safeUrl(url);
  if (!safe) return "";
  const host = new URL(safe).hostname.replace(/^www\.|^m\./, "");
  if (isYouTube(host)) return "يوتيوب";
  if (/(^|\.)instagram\.com$/.test(host)) return "إنستغرام";
  if (/(^|\.)facebook\.com$|(^|\.)fb\.watch$|(^|\.)fb\.com$/.test(host)) return "فيسبوك";
  if (/(^|\.)tiktok\.com$/.test(host)) return "تيك توك";
  return host;
}

// الرابط الذي يُفتح: في يوتيوب يُضاف الوقت ليبدأ الفيديو من اللحظة المطلوبة
export function sourceLink(url, time) {
  const href0 = safeUrl(url);
  if (!href0) return null;
  const sec = parseTime(time);
  const platform = platformOf(href0);
  let href = href0;
  const u = new URL(href0);
  if (sec !== null && isYouTube(u.hostname.replace(/^www\.|^m\./, ""))) {
    const shorts = u.pathname.match(/^\/shorts\/([\w-]+)/);
    if (shorts) {
      u.pathname = "/watch";
      u.search = "";
      u.searchParams.set("v", shorts[1]);
    }
    u.searchParams.set("t", sec + "s");
    href = u.href;
  }
  return { href, platform, time: sec === null ? "" : formatTime(sec), timeInLink: href !== href0 };
}
