// بطاقة الصفحة المشتركة (الرئيسية + صفحاتي) وأدوات مفاتيح الحفظ
import { esc } from "../util.js";
import { surahLabel, juzOfPage } from "../quran.js";
import { level, relativeDay, todayStr } from "../srs.js";

export const LEVEL_LABELS = { new: "جديدة", due: "مستحقة", weak: "قيد التثبيت", mid: "متوسطة", strong: "راسخة" };

// كل صور الصفحة: صور الصفحة نفسها + صور الآيات (مع رقم الآية)
export const allImages = rec => [
  ...(rec.images || []).map(src => ({ src })),
  ...rec.ayahs.filter(x => x.img).map(x => ({ src: x.img, a: x.a })),
];

// كل كلمات الربط: للصفحة + لكل آية
export const allLinks = rec => [...(rec.links || []), ...rec.ayahs.filter(x => x.hook).map(x => x.hook)];

export const lastTouched = rec => String(rec.updatedAt || rec.createdAt || "");

export function pageCardHTML(rec, t = todayStr()) {
  const imgs = allImages(rec);
  const links = allLinks(rec);
  const lvl = level(rec.srs, t);
  const thumb = imgs.length
    ? `<img src="${imgs[0].src}" alt="" loading="lazy">${imgs.length > 1 ? `<span class="more">+${imgs.length - 1}</span>` : ""}`
    : `<span class="ph">${rec.page}</span>`;
  const empty = !imgs.length && !links.length && !rec.notes;
  return `<article class="pcard" data-action="open-page" data-page="${rec.page}" role="button" tabindex="0">
    <div class="pcard-thumb${imgs.length ? "" : " empty"}">${thumb}</div>
    <div class="pcard-body">
      <div class="pcard-title"><b>صفحة ${rec.page}</b><span class="tag lv-${lvl}">${LEVEL_LABELS[lvl]}</span></div>
      <div class="muted small">${esc(surahLabel(rec.page))} · الجزء ${juzOfPage(rec.page)}</div>
      ${links.length ? `<div class="chips start">${links.slice(0, 4).map(l => `<span class="chip sm">🔗 ${esc(l)}</span>`).join("")}${links.length > 4 ? `<span class="chip sm">+${links.length - 4}</span>` : ""}</div>` : ""}
      ${rec.notes ? `<p class="pcard-note">🧠 ${esc(rec.notes)}</p>` : ""}
      <div class="muted small">⏰ المراجعة: ${relativeDay(rec.srs.due, t)}${imgs.length ? ` · 🖼️ ${imgs.length}` : ""}${empty ? " · لم تضف مفاتيح بعد" : ""}</div>
    </div>
  </article>`;
}
