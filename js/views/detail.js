// بطاقة الصفحة: صورها ومفاتيحها أولاً، ثم حالة المراجعة ونقاط الضعف
import { $, esc, delegate } from "../util.js";
import { pages } from "../state.js";
import { surahLabel, juzOfPage, hizbOfPage, rangeLabel, renderAyahs, arDigits, firstWords } from "../quran.js";
import { level, relativeDay, durationLabel, isDue, todayStr, GRADE_LABELS } from "../srs.js";
import { openEditor } from "./editor.js";
import { startSession } from "./review.js";
import { LEVEL_LABELS, allImages, sourceButtonHTML } from "./cards.js";
import { openGallery } from "./lightbox.js";
import { openNoteEditor, tadabburListHTML, viewTadabburImage, toggleDisplay } from "./notes.js";

const dlg = () => $("#detailDialog");
let pageNo = 0;

// بعد إضافة/تعديل تدبر: نعيد رسم البطاقة إن كانت مفتوحة (مع الحفاظ على موضع التمرير)
function reopen() {
  if (!dlg().open) return;
  const body = dlg().querySelector(".sheet-body");
  const y = body?.scrollTop || 0;
  openDetail(pageNo);
  const nb = dlg().querySelector(".sheet-body");
  if (nb) nb.scrollTop = y;
}

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
      <p class="muted">${esc(surahLabel(p))} · الجزء ${juzOfPage(p)} · الحزب ${hizbOfPage(p)}<br><small>${rangeLabel(p)}</small>
        · <button type="button" class="link-btn small" data-action="change-number">رقم الصفحة خاطئ؟ غيّره</button></p>
      <p class="next-review">⏰ المراجعة القادمة: <b>${relativeDay(s.due, t)}</b></p>

      ${galleryHTML(imgs, "map", "🗺️ الخريطة الذهنية للوجه", "gallery big")}
      ${galleryHTML(imgs, "link", "🖼️ صور التربيط", "gallery")}
      ${sourcesHTML(imgs)}
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

      <div class="row between tad-title">
        <h3>💡 تدبر الآيات${rec.tadabbur.length ? ` (${rec.tadabbur.length})` : ""}</h3>
        <button type="button" class="btn small" data-action="add-tadabbur">＋ إضافة تدبر</button>
      </div>
      ${rec.tadabbur.length
        ? `<div class="tad-list">${tadabburListHTML(rec, { editable: true })}</div>`
        : `<p class="muted small">وجدت منشوراً أو كتاباً أو درساً يتدبر آية من هذه الصفحة؟ أضفه هنا ليبقى مع الصفحة.</p>`}

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

// معرض نوع واحد من الصور (data-i = موضعها في قائمة كل الصور، ليتنقل العارض بينها كلها)
function galleryHTML(imgs, kind, title, cls) {
  const list = imgs.map((im, i) => ({ ...im, i })).filter(im => im.kind === kind);
  if (!list.length) return "";
  return `<h3>${title}${list.length > 1 ? ` (${list.length})` : ""}</h3>
    <div class="${cls}">${list
      .map(im => `<button type="button" class="gimg" data-action="view-img" data-i="${im.i}">
        <img src="${im.src}" alt="" loading="lazy">${im.a ? `<span>الآية ${arDigits(im.a)}</span>` : ""}${im.url || im.note ? `<i class="src-badge">${im.note ? "📝" : ""}${im.url ? "▶️" : ""}</i>` : ""}</button>`)
      .join("")}</div>`;
}

// ملاحظات كل صورة (طرق الحفظ التي تعلّمتها منها) + رابط مصدرها والوقت داخل الفيديو
function sourcesHTML(imgs) {
  const list = imgs.map((im, i) => ({ ...im, i })).filter(im => im.note || im.url || im.time);
  if (!list.length) return "";
  return `<h3>📝 ملاحظات الصور ومصادرها</h3><ul class="photo-notes">${list
    .map(im => `<li>
      <button type="button" class="pn-thumb" data-action="view-img" data-i="${im.i}"><img src="${im.src}" alt="" loading="lazy"></button>
      <div class="pn-body">
        <b class="small">${im.kind === "map" ? "🗺️ الخريطة الذهنية" : `🖼️ صورة تربيط${im.a ? ` · الآية ${arDigits(im.a)}` : ""}`}</b>
        ${im.note ? `<p class="notes">${esc(im.note)}</p>` : ""}
        ${sourceButtonHTML(im)}
      </div>
    </li>`)
    .join("")}</ul>`;
}

const captionOf = (im, p) =>
  `الصفحة ${p} · ${im.kind === "map" ? "الخريطة الذهنية" : im.a ? `صورة تربيط · الآية ${im.a}` : "صورة تربيط"}`;

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
  "change-number": () => {
    dlg().close();
    openEditor(pageNo, { changeNumber: true });
  },
  "add-tadabbur": () => openNoteEditor({ kind: "tadabbur", page: pageNo, onSaved: reopen }),
  "edit-tadabbur": el => openNoteEditor({ kind: "tadabbur", page: pageNo, id: el.dataset.id, onSaved: reopen }),
  "view-note-img": el => viewTadabburImage(pageNo, el.dataset.id),
  "toggle-display": async el => {
    await toggleDisplay("tadabbur", el.dataset.id, pageNo);
    reopen();
  },
  expand: el => el.classList.toggle("clamp"),
  "view-img": el => {
    const imgs = dlg()._imgs.map(im => ({ ...im, caption: captionOf(im, pageNo) }));
    openGallery(imgs, +el.dataset.i);
  },
});
