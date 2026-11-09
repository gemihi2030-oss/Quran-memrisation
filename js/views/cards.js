// بطاقة الصفحة المشتركة (الرئيسية + صفحاتي) وأدوات مفاتيح الحفظ
import { esc } from "../util.js";
import { surahLabel, juzOfPage, surahPages, SURAH_NAMES } from "../quran.js";
import { level, relativeDay, todayStr } from "../srs.js";
import { pages } from "../state.js";
import { sourceLink } from "../media.js";

export const LEVEL_LABELS = { new: "جديدة", due: "مستحقة", weak: "قيد التثبيت", mid: "متوسطة", strong: "راسخة" };

// صور الخريطة الذهنية للوجه (الصفحة كاملة) — كل صورة { src, url?, time? }
export const mapImages = rec => (rec.maps || []).map(p => ({ ...p, kind: "map" }));

// صور التربيط: للصفحة + لكل آية (مع رقم الآية)
export const linkImages = rec => [
  ...(rec.images || []).map(p => ({ ...p, kind: "link" })),
  ...rec.ayahs.filter(x => x.img).map(x => ({ src: x.img, kind: "link", a: x.a })),
];

// زر فتح مصدر الصورة (يوتيوب يفتح على الوقت المحدد)
export function sourceButtonHTML(p, cls = "btn small src-btn") {
  const link = sourceLink(p.url, p.time);
  if (!link) return p.time ? `<span class="src-time">⏱️ ${esc(p.time)}</span>` : "";
  return `<a class="${cls}" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer" data-lb="src">▶️ ${esc(link.platform)}${link.time ? ` · ⏱️ ${link.time}` : ""}</a>`;
}

export const allImages = rec => [...mapImages(rec), ...linkImages(rec)];

// كل كلمات الربط: للصفحة + لكل آية
export const allLinks = rec => [...(rec.links || []), ...rec.ayahs.filter(x => x.hook).map(x => x.hook)];

export const lastTouched = rec => String(rec.updatedAt || rec.createdAt || "");

// تقدم حفظ السورة: عدد صفحاتها المسجلة من مجموع صفحاتها
export function surahProgress(s) {
  const [a, b] = surahPages(s);
  let n = 0;
  for (let p = a; p <= b; p++) if (pages.has(p)) n++;
  const total = b - a + 1;
  return { a, b, n, total, pct: Math.round((n / total) * 100), name: SURAH_NAMES[s - 1] };
}

export function pageCardHTML(rec, t = todayStr()) {
  const maps = mapImages(rec);
  const links = linkImages(rec);
  const imgs = [...maps, ...links];
  const words = allLinks(rec);
  const lvl = level(rec.srs, t);
  const thumb = imgs.length
    ? `<img src="${imgs[0].src}" alt="" loading="lazy">${imgs.length > 1 ? `<span class="more">+${imgs.length - 1}</span>` : ""}${maps.length ? `<span class="kind">🗺️</span>` : ""}`
    : `<span class="ph">${rec.page}</span>`;
  const empty = !imgs.length && !words.length && !rec.notes;
  const counts = [maps.length ? `🗺️ ${maps.length}` : "", links.length ? `🖼️ ${links.length}` : ""].filter(Boolean).join(" · ");
  return `<article class="pcard" data-action="open-page" data-page="${rec.page}" role="button" tabindex="0">
    <div class="pcard-thumb${imgs.length ? "" : " empty"}">${thumb}</div>
    <div class="pcard-body">
      <div class="pcard-title"><b>صفحة ${rec.page}</b><span class="tag lv-${lvl}">${LEVEL_LABELS[lvl]}</span></div>
      <div class="muted small">${esc(surahLabel(rec.page))} · الجزء ${juzOfPage(rec.page)}</div>
      ${words.length ? `<div class="chips start">${words.slice(0, 4).map(l => `<span class="chip sm">🔗 ${esc(l)}</span>`).join("")}${words.length > 4 ? `<span class="chip sm">+${words.length - 4}</span>` : ""}</div>` : ""}
      ${rec.notes ? `<p class="pcard-note">🧠 ${esc(rec.notes)}</p>` : ""}
      <div class="muted small">⏰ المراجعة: ${relativeDay(rec.srs.due, t)}${counts ? ` · ${counts}` : ""}${empty ? " · لم تضف مفاتيح بعد" : ""}</div>
    </div>
  </article>`;
}
