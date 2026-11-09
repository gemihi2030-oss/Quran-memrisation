// بطاقة تفاصيل صفحة محفوظة: حالتها، سجل مراجعاتها، نقاط ضعفها
import { $, esc, delegate } from "../util.js";
import { pages } from "../state.js";
import { surahLabel, juzOfPage, hizbOfPage, rangeLabel, renderAyahs, arDigits, firstWords } from "../quran.js";
import { level, relativeDay, durationLabel, isDue, todayStr, GRADE_LABELS } from "../srs.js";
import { openEditor } from "./editor.js";
import { startSession } from "./review.js";

const dlg = () => $("#detailDialog");
let pageNo = 0;

const LEVEL_LABELS = { new: "جديدة", due: "مستحقة", weak: "قيد التثبيت", mid: "متوسطة", strong: "راسخة" };

export function openDetail(p) {
  const rec = pages.get(p);
  if (!rec) return openEditor(p);
  pageNo = p;
  const s = rec.srs;
  const t = todayStr();
  const lvl = level(s, t);
  const hist = s.history.slice(-30);
  const weak = rec.ayahs
    .map((x, i) => ({ x, i }))
    .filter(o => o.x.miss)
    .sort((a, b) => b.x.miss - a.x.miss)
    .slice(0, 6);
  const keys = rec.ayahs.filter(x => x.hook || x.note || x.img).length;

  dlg().innerHTML = `
    <header class="sheet-head">
      <h2>الصفحة ${p} <span class="tag lv-${lvl}">${LEVEL_LABELS[lvl]}</span></h2>
      <button type="button" class="icon-btn" data-action="close" aria-label="إغلاق">✕</button>
    </header>
    <div class="sheet-body">
      <p class="muted">${esc(surahLabel(p))} · الجزء ${juzOfPage(p)} · الحزب ${hizbOfPage(p)}<br><small>${rangeLabel(p)}</small></p>
      <div class="kv">
        <div><span>المراجعة القادمة</span><b>${relativeDay(s.due, t)}</b></div>
        <div><span>الفاصل الحالي</span><b>${s.interval ? durationLabel(s.interval) : "—"}</b></div>
        <div><span>عدد المراجعات</span><b>${s.history.length}</b></div>
        <div><span>مرات النسيان</span><b>${s.lapses}</b></div>
        <div><span>معامل السهولة</span><b>${Math.round(s.ease * 100)}٪</b></div>
        <div><span>مفاتيح الآيات</span><b>${keys} / ${rec.ayahs.length}</b></div>
      </div>
      ${hist.length ? `<h3>سجل المراجعات</h3><div class="hist">${hist
        .map(h => `<i class="g${h.g}" title="${h.d} — ${GRADE_LABELS[h.g]}"></i>`)
        .join("")}</div>` : ""}
      ${weak.length ? `<h3>⚠️ آيات تعثرت فيها</h3><ul class="list compact">${weak
        .map(({ x }) => `<li><span class="quran-inline">${esc(firstWords(x.text, 6))}… ${x.a ? `﴿${arDigits(x.a)}﴾` : ""}</span><span class="tag bad">${x.miss} ×</span></li>`)
        .join("")}</ul>` : ""}
      ${rec.links.length ? `<h3>🔗 كلمات الربط</h3><div class="chips">${rec.links.map(l => `<span class="chip">${esc(l)}</span>`).join("")}</div>` : ""}
      ${rec.notes ? `<h3>🧠 الصورة الذهنية</h3><p class="notes">${esc(rec.notes)}</p>` : ""}
      ${rec.ayahs.length ? `<details class="text-toggle"><summary>📖 عرض نص الصفحة</summary><div class="quran">${renderAyahs(rec.ayahs, { showMiss: true })}</div></details>` : ""}
    </div>
    <footer class="sheet-foot">
      <button type="button" class="btn" data-action="edit">✏️ تعديل المفاتيح</button>
      <span class="grow"></span>
      <button type="button" class="btn primary" data-action="review">🔁 ${isDue(s, t) ? "راجعها الآن" : "تدرّب عليها الآن"}</button>
    </footer>`;
  if (!dlg().open) dlg().showModal();
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
});
