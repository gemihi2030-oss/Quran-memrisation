// بطاقة الصفحة: صورها ومفاتيحها أولاً، ثم حالة المراجعة ونقاط الضعف
import { $, esc, delegate } from "../util.js";
import { pages } from "../state.js";
import { surahLabel, juzOfPage, hizbOfPage, rangeLabel, renderAyahs, arDigits, firstWords } from "../quran.js";
import { level, relativeDay, durationLabel, isDue, todayStr, GRADE_LABELS } from "../srs.js";
import { openEditor } from "./editor.js";
import { startSession } from "./review.js";
import { LEVEL_LABELS, allImages } from "./cards.js";

const dlg = () => $("#detailDialog");
const viewer = () => $("#imageDialog");
let pageNo = 0;

export function openDetail(p) {
  const rec = pages.get(p);
  if (!rec) return openEditor(p);
  pageNo = p;
  const s = rec.srs;
  const t = todayStr();
  const lvl = level(s, t);
  const imgs = allImages(rec);
  const ayahKeys = rec.ayahs.filter(x => x.hook || x.note || x.img);
  const hasAnyKey = imgs.length || rec.links.length || rec.notes || ayahKeys.length;
  const hist = s.history.slice(-30);
  const weak = rec.ayahs.filter(x => x.miss).sort((a, b) => b.miss - a.miss).slice(0, 6);

  dlg().innerHTML = `
    <header class="sheet-head">
      <h2>الصفحة ${p} <span class="tag lv-${lvl}">${LEVEL_LABELS[lvl]}</span></h2>
      <button type="button" class="icon-btn" data-action="close" aria-label="إغلاق">✕</button>
    </header>
    <div class="sheet-body">
      <p class="muted">${esc(surahLabel(p))} · الجزء ${juzOfPage(p)} · الحزب ${hizbOfPage(p)}<br><small>${rangeLabel(p)}</small></p>
      <p class="next-review">⏰ المراجعة القادمة: <b>${relativeDay(s.due, t)}</b></p>

      ${imgs.length ? `<h3>🖼️ صوري (${imgs.length})</h3>
        <div class="gallery">${imgs
          .map(im => `<button type="button" class="gimg" data-action="view-img" data-src-i="${imgs.indexOf(im)}">
            <img src="${im.src}" alt="" loading="lazy">${im.a ? `<span>الآية ${arDigits(im.a)}</span>` : ""}</button>`)
          .join("")}</div>` : ""}
      ${rec.links.length ? `<h3>🔗 كلمات الربط</h3><div class="chips start">${rec.links.map(l => `<span class="chip">${esc(l)}</span>`).join("")}</div>` : ""}
      ${rec.notes ? `<h3>🧠 الصورة الذهنية</h3><p class="notes">${esc(rec.notes)}</p>` : ""}
      ${ayahKeys.length ? `<h3>🔑 مفاتيح الآيات</h3><ul class="keys-list">${ayahKeys
        .map(x => `<li>
          <span class="quran-inline">${esc(firstWords(x.text, 6))}… ${x.a ? `<span class="marker">﴿${arDigits(x.a)}﴾</span>` : ""}</span>
          ${x.hook ? `<span class="chip sm">🔗 ${esc(x.hook)}</span>` : ""}
          ${x.note ? `<span class="muted small">🧠 ${esc(x.note)}</span>` : ""}
        </li>`)
        .join("")}</ul>` : ""}
      ${hasAnyKey ? "" : `<div class="notice">لم تضف لهذه الصفحة صوراً ولا كلمات ربط بعد. <button type="button" class="link-btn" data-action="edit">أضفها الآن</button></div>`}

      ${rec.ayahs.length ? `<details class="text-toggle"><summary>📖 عرض نص الصفحة</summary><div class="quran">${renderAyahs(rec.ayahs, { showMiss: true })}</div></details>` : ""}

      <details class="text-toggle"><summary>📊 تفاصيل المراجعة</summary>
        <div class="kv">
          <div><span>الفاصل الحالي</span><b>${s.interval ? durationLabel(s.interval) : "—"}</b></div>
          <div><span>عدد المراجعات</span><b>${s.history.length}</b></div>
          <div><span>مرات النسيان</span><b>${s.lapses}</b></div>
          <div><span>معامل السهولة</span><b>${Math.round(s.ease * 100)}٪</b></div>
        </div>
        ${hist.length ? `<div class="hist">${hist.map(h => `<i class="g${h.g}" title="${h.d} — ${GRADE_LABELS[h.g]}"></i>`).join("")}</div>` : ""}
        ${weak.length ? `<h3>⚠️ آيات تعثرت فيها</h3><ul class="list compact">${weak
          .map(x => `<li><span class="quran-inline">${esc(firstWords(x.text, 6))}… ${x.a ? `﴿${arDigits(x.a)}﴾` : ""}</span><span class="tag bad">${x.miss} ×</span></li>`)
          .join("")}</ul>` : ""}
      </details>
    </div>
    <footer class="sheet-foot">
      <button type="button" class="btn" data-action="edit">✏️ تعديل / إضافة صور</button>
      <span class="grow"></span>
      <button type="button" class="btn primary" data-action="review">🔁 ${isDue(s, t) ? "راجعها الآن" : "تدرّب عليها الآن"}</button>
    </footer>`;
  dlg()._imgs = imgs;
  if (!dlg().open) dlg().showModal();
  dlg().querySelector(".sheet-body").scrollTop = 0;
}

// عارض الصورة بحجم الشاشة
export function openImage(src, caption = "") {
  viewer().innerHTML = `<button type="button" class="icon-btn lb-close" aria-label="إغلاق">✕</button>
    <img src="${src}" alt="">${caption ? `<p>${esc(caption)}</p>` : ""}`;
  viewer().showModal();
}

delegate(dlg(), {
  close: () => dlg().close(),
  edit: () => {
    dlg().close();
    openEditor(pageNo);
  },
  review: () => {
    dlg().close();
    const rec = pages.get(pageNo);
    startSession({ pages: [pageNo], extra: !isDue(rec.srs) });
  },
  "view-img": el => {
    const im = dlg()._imgs[+el.dataset.srcI];
    if (im) openImage(im.src, im.a ? `الصفحة ${pageNo} · الآية ${im.a}` : `الصفحة ${pageNo}`);
  },
});

viewer().addEventListener("click", () => viewer().close());
