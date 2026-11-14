// 🗺️ تبويب «الخرائط»: كل صور الخريطة الذهنية للوجوه في مكان واحد
// صورة كبيرة مع سهمين على اليمين واليسار (والسحب بالإصبع)، وشريط صور مصغرة للانتقال السريع
import { $, esc, delegate } from "../util.js";
import { pages } from "../state.js";
import { surahLabel, firstSurahOfPage, SURAH_NAMES } from "../quran.js";
import { show, current } from "../router.js";
import { openGallery } from "./lightbox.js";
import { openDetail } from "./detail.js";
import { mapImages, sourceButtonHTML } from "./cards.js";

const root = () => $("#view-maps");
let surahFilter = 0; // 0 = كل السور
let idx = 0;

// كل الخرائط مرتبة حسب ترتيب المصحف
function allMaps() {
  const list = [];
  const recs = [...pages.values()].filter(r => mapImages(r).length).sort((a, b) => a.page - b.page);
  for (const r of recs) for (const m of mapImages(r)) list.push({ ...m, page: r.page, surah: firstSurahOfPage(r.page) });
  return list;
}

const visibleMaps = () => allMaps().filter(m => !surahFilter || m.surah === surahFilter);

export function renderMaps() {
  const all = allMaps();
  const list = all.filter(m => !surahFilter || m.surah === surahFilter);
  if (!all.length) {
    root().innerHTML = `
      <div class="card center empty-state">
        <div class="big-emoji">🗺️</div>
        <h2>الخرائط الذهنية للوجوه</h2>
        <p class="muted">هنا تجد كل خرائطك الذهنية في مكان واحد، وتتنقل بينها بالسهمين.</p>
        <p class="muted small">لم تضف أي خريطة بعد: افتح صفحة من «صفحاتي» ← «✏️ تعديل» ← «📷 إضافة خريطة ذهنية».</p>
        <button class="btn primary" data-action="go-pages">📚 صفحاتي</button>
      </div>`;
    return;
  }
  if (idx >= list.length) idx = list.length - 1;
  if (idx < 0) idx = 0;
  const it = list[idx];
  const n = list.length;
  const surahs = [...new Set(all.map(m => m.surah))].sort((a, b) => a - b);

  root().innerHTML = `
    <div class="card maps-view">
      <div class="row between wrap">
        <h2>🗺️ الخرائط الذهنية <small class="muted">(${all.length})</small></h2>
        ${surahs.length > 1 || surahFilter ? `<select id="mvSurah" class="mini-select" aria-label="السورة">
          <option value="0">📖 كل السور</option>
          ${surahs.map(s => `<option value="${s}" ${surahFilter === s ? "selected" : ""}>سورة ${SURAH_NAMES[s - 1]}</option>`).join("")}
        </select>` : ""}
      </div>

      <div class="mv-stage" id="mvStage">
        <img src="${it.src}" alt="الخريطة الذهنية للصفحة ${it.page}" data-action="mv-full">
        ${n > 1 ? `
          <button type="button" class="mv-arrow mv-prev" data-action="mv-prev" aria-label="السابقة" ${idx === 0 ? "disabled" : ""}>›</button>
          <button type="button" class="mv-arrow mv-next" data-action="mv-next" aria-label="التالية" ${idx === n - 1 ? "disabled" : ""}>‹</button>` : ""}
        <span class="mv-count">${idx + 1} / ${n}</span>
      </div>

      <div class="mv-caption"><b>الصفحة ${it.page}</b> · ${esc(surahLabel(it.page))}</div>
      ${it.note ? `<p class="notes mv-note">📝 ${esc(it.note)}</p>` : ""}
      <div class="row gap-s wrap center-row">
        ${sourceButtonHTML(it)}
        <button type="button" class="btn small" data-action="mv-open">📖 فتح الصفحة ${it.page}</button>
        <button type="button" class="btn small" data-action="mv-full">⛶ ملء الشاشة</button>
      </div>

      ${n > 1 ? `<div class="mv-strip" id="mvStrip">${list
        .map((m, j) => `<button type="button" class="mv-thumb${j === idx ? " on" : ""}" data-action="mv-go" data-i="${j}" aria-label="الصفحة ${m.page}">
          <img src="${m.src}" alt="" loading="lazy"><span>${m.page}</span></button>`)
        .join("")}</div>` : ""}
    </div>`;

  $("#mvStrip .mv-thumb.on")?.scrollIntoView({ block: "nearest", inline: "center" });
}

function go(step) {
  const n = visibleMaps().length;
  const next = idx + step;
  if (next < 0 || next >= n) return;
  idx = next;
  renderMaps();
}

function openFull() {
  const list = visibleMaps();
  openGallery(
    list.map(m => ({ ...m, caption: `الصفحة ${m.page} · ${surahLabel(m.page)}` })),
    idx,
    { onOpenPage: p => openDetail(p) }
  );
}

// فتح التبويب، اختيارياً على سورة معيّنة
export function showMaps({ surah = 0 } = {}) {
  surahFilter = surah;
  idx = 0;
  show("maps");
}

delegate(root(), {
  "mv-prev": () => go(-1),
  "mv-next": () => go(1),
  "mv-go": el => {
    idx = +el.dataset.i;
    renderMaps();
  },
  "mv-open": () => {
    const it = visibleMaps()[idx];
    if (it) openDetail(it.page);
  },
  "mv-full": openFull,
  "go-pages": () => show("pages"),
});

root().addEventListener("change", e => {
  if (e.target.id === "mvSurah") {
    surahFilter = +e.target.value;
    idx = 0;
    renderMaps();
  }
});

// السحب بالإصبع على الصورة (في الاتجاه العربي: نحو اليمين = التالية)
let touchX = null;
root().addEventListener("touchstart", e => {
  touchX = e.target.closest("#mvStage") ? e.touches[0].clientX : null;
}, { passive: true });
root().addEventListener("touchend", e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) go(dx > 0 ? 1 : -1);
});

// أسهم لوحة المفاتيح على الحاسوب
document.addEventListener("keydown", e => {
  if (current() !== "maps" || document.querySelector("dialog[open]") || e.target.matches?.("input, textarea, select")) return;
  if (e.key === "ArrowLeft") go(1);
  else if (e.key === "ArrowRight") go(-1);
});
