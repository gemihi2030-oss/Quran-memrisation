// الشاشة الرئيسية: الإحصائيات، المراجعات القادمة، الأجزاء، الصفحات الضعيفة
import { $, esc, delegate } from "../util.js";
import { pages, dueList, streak, retention, todayCount, weakPages, motivations } from "../state.js";
import { currentMotivation, motivationItemHTML, openNoteEditor, openMotivationList, viewMotivation, toggleDisplay } from "./notes.js";
import { Store } from "../db.js";
import { TOTAL_PAGES, juzRange, surahLabel, firstSurahOfPage } from "../quran.js";
import { todayStr, addDays, daysBetween, parseDate, relativeDay } from "../srs.js";
import { show } from "../router.js";
import { openEditor } from "./editor.js";
import { openRange } from "./range.js";
import { startSession } from "./review.js";
import { scrollToJuz, showPagesList } from "./mushaf.js";
import { openDetail } from "./detail.js";
import { pageCardHTML, lastTouched, surahProgress } from "./cards.js";

const root = () => $("#view-home");

export function renderHome() {
  const t = todayStr();
  const total = pages.size;
  if (!total) return renderWelcome();

  const due = dueList(t).length;
  const pct = (total / TOTAL_PAGES) * 100;
  const ret = retention();

  root().innerHTML = `
    <div class="card hero">
      <p class="basmala">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
      <div class="stats">
        <div class="stat accent"><b>${due}</b><span>للمراجعة اليوم</span></div>
        <div class="stat"><b>${total}</b><span>صفحة محفوظة</span></div>
        <div class="stat"><b>${streak()}</b><span>أيام متتالية 🔥</span></div>
        <div class="stat"><b>${ret === null ? "—" : ret + "٪"}</b><span>نسبة التذكر</span></div>
      </div>
      <div class="progress" title="${pct.toFixed(1)}٪"><div class="bar" style="width:${pct.toFixed(2)}%"></div></div>
      <p class="muted center small">${total} / ${TOTAL_PAGES} صفحة (${pct.toFixed(1)}٪) · ما يعادل ${(total / 20).toFixed(1)} جزء · ${todayCount()} مراجعة اليوم</p>
      ${due
        ? `<button class="btn primary big" data-action="review">🔁 ابدأ مراجعة اليوم (${due})</button>`
        : `<p class="all-done">✓ لا مراجعات مستحقة اليوم — موعدك القادم: <b>${nextDueLabel(t)}</b></p>
           <button class="btn primary big" data-action="practice">💪 تدرّب الآن على صفحاتي</button>`}
      <button class="btn ghost" data-action="add">＋ حفظت صفحة جديدة</button>
    </div>
    ${motivationHTML()}
    ${currentSurahHTML()}
    ${recentHTML(t)}
    ${backupReminder(total)}
    <div class="card">
      <h2>المراجعات القادمة</h2>
      ${forecastHTML(t)}
    </div>
    <div class="card">
      <div class="row between"><h2>الأجزاء</h2><small class="muted">اضغط على جزء لفتحه</small></div>
      ${juzStripHTML()}
    </div>
    ${weakHTML()}
    ${tipsHTML()}
  `;
}

function renderWelcome() {
  root().innerHTML = `
    <div class="card hero welcome">
      <p class="basmala">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
      <h2>أهلاً بك في QURAN MEMORISATION</h2>
      <p class="muted">سجّل كل صفحة تحفظها مع الآيات وكلمات الربط والصور التي ساعدتك، وسيذكّرك التطبيق بمراجعتها في الوقت المناسب حتى تبقى راسخة على المدى البعيد بإذن الله.</p>
      <button class="btn primary big" data-action="add">＋ سجّل أول صفحة حفظتها</button>
      <button class="btn ghost" data-action="range">📚 أحفظ صفحات من قبل؟ سجّلها دفعة واحدة (مثلاً جزء عمّ)</button>
    </div>
    ${motivationHTML()}
    ${tipsHTML(true)}
  `;
}

function nextDueLabel(t) {
  const next = [...pages.values()].map(p => p.srs.due).filter(d => d > t).sort()[0];
  return next ? relativeDay(next, t) : "—";
}

// 💚 تحفيز اليوم: يبدأ كل يوم بعنصر مختلف، والأزرار (أو السحب بالإصبع) تتنقل بين العناصر
function motivationHTML(step = 0) {
  const cur = currentMotivation(step);
  if (!cur) {
    return `<div class="card motiv-card empty">
      <h2>💚 تحفيز</h2>
      <p class="muted small">احفظ هنا ما يحفّزك على الحفظ والمراجعة: قصة، حديث، مقولة، صورة… سيظهر لك واحد كل يوم.</p>
      <button class="btn" data-action="add-motivation">＋ إضافة تحفيز</button>
    </div>`;
  }
  const { item, index, total } = cur;
  return `<div class="card motiv-card" id="motivCard">
    <div class="row between">
      <h2>💚 تحفيز اليوم</h2>
      <button class="icon-btn" data-action="add-motivation" aria-label="إضافة" title="إضافة">＋</button>
    </div>
    ${motivationItemHTML(item, { toggle: true })}
    ${total > 1 ? `<div class="motiv-nav">
      <button class="btn small" data-action="prev-motivation" aria-label="السابق">→ السابق</button>
      <span class="muted small">${index + 1} / ${total}</span>
      <button class="btn small" data-action="next-motivation" aria-label="التالي">التالي ←</button>
    </div>` : ""}
    <button class="link-btn" data-action="all-motivation">عرض الكل (${total}) ←</button>
  </div>`;
}

const swapMotivation = step => {
  const card = $("#motivCard");
  if (card) card.outerHTML = motivationHTML(step);
};

// السورة التي تحفظها الآن (سورة آخر صفحة سجّلتها بنفسك) وتقدمك فيها
function currentSurahHTML() {
  const own = [...pages.values()].filter(p => !p.bulk);
  const src = own.length ? own : [...pages.values()];
  if (!src.length) return "";
  const latest = src.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
  const s = firstSurahOfPage(latest.page);
  const pr = surahProgress(s);
  let next = null;
  for (let p = latest.page + 1; p <= pr.b && next === null; p++) if (!pages.has(p)) next = p;
  for (let p = pr.a; p <= pr.b && next === null; p++) if (!pages.has(p)) next = p;
  const nMaps = [...pages.values()].filter(r => firstSurahOfPage(r.page) === s).reduce((n, r) => n + (r.maps?.length || 0), 0);
  return `<div class="card surah-now">
    <div class="row between"><h2>📖 سورة ${pr.name}</h2><small class="muted">حفظك الحالي</small></div>
    <div class="progress"><div class="bar" style="width:${pr.pct}%"></div></div>
    <p class="muted small">${pr.n} / ${pr.total} صفحة (${pr.pct}٪) · من الصفحة ${pr.a} إلى ${pr.b}</p>
    ${next ? `<button class="btn primary big" data-action="add-page" data-page="${next}">＋ حفظت الصفحة ${next}</button>` : `<p class="all-done">🎉 ما شاء الله! سجّلت كل صفحات السورة.</p>`}
    <div class="add-row">
      <button class="btn" data-action="surah-pages" data-s="${s}">📋 صفحات السورة</button>
      <button class="btn" data-action="surah-maps" data-s="${s}">🗺️ خرائطها (${nMaps})</button>
    </div>
  </div>`;
}

// آخر الصفحات التي سجّلتها أو عدّلتها، بصورها وكلمات ربطها
function recentHTML(t) {
  const recent = [...pages.values()].sort((a, b) => lastTouched(b).localeCompare(lastTouched(a))).slice(0, 3);
  return `<div class="card">
    <div class="row between"><h2>📚 صفحاتي</h2><button class="link-btn" data-action="all-pages">عرض الكل (${pages.size}) ←</button></div>
    <div class="plist">${recent.map(r => pageCardHTML(r, t)).join("")}</div>
  </div>`;
}

function backupReminder(total) {
  if (total < 5) return "";
  const last = Store.get("lastExport", null);
  const days = last ? daysBetween(last, todayStr()) : null;
  if (days !== null && days < 14) return "";
  return `<div class="card notice">💾 ${days === null ? "لم تصدّر نسخة احتياطية بعد." : `آخر نسخة احتياطية قبل ${days} يوماً.`}
    بياناتك محفوظة على هذا الجهاز فقط. <button class="link-btn" data-action="backup">صدّر نسخة الآن</button></div>`;
}

function forecastHTML(t) {
  const days = [];
  for (let i = 0; i < 7; i++) days.push({ date: addDays(t, i), n: 0 });
  for (const p of pages.values()) {
    const d = Math.max(0, daysBetween(t, p.srs.due));
    if (d < 7) days[d].n++;
  }
  const max = Math.max(1, ...days.map(d => d.n));
  const label = (d, i) =>
    i === 0 ? "اليوم" : i === 1 ? "غداً" : parseDate(d.date).toLocaleDateString("ar-DZ", { weekday: "short" });
  return `<div class="forecast">${days
    .map(
      (d, i) => `<div class="fc ${i === 0 ? "today" : ""}">
        <b>${d.n || ""}</b>
        <div class="fc-bar"><i style="height:${Math.round((d.n / max) * 100)}%"></i></div>
        <span>${label(d, i)}</span>
      </div>`
    )
    .join("")}</div>`;
}

function juzStripHTML() {
  let html = `<div class="juz-strip">`;
  for (let j = 1; j <= 30; j++) {
    const [a, b] = juzRange(j);
    let n = 0;
    for (let p = a; p <= b; p++) if (pages.has(p)) n++;
    const pct = Math.round((n / (b - a + 1)) * 100);
    html += `<button class="juz-cell ${pct === 100 ? "full" : pct ? "part" : ""}" data-action="juz" data-j="${j}" title="الجزء ${j}: ${n} من ${b - a + 1} صفحة">
      <i style="height:${pct}%"></i><span>${j}</span></button>`;
  }
  return html + `</div>`;
}

function weakHTML() {
  const weak = weakPages(5);
  if (!weak.length) return "";
  return `<div class="card">
    <h2>صفحات تحتاج عناية</h2>
    <ul class="list">${weak
      .map(p => {
        const misses = p.ayahs.reduce((s, x) => s + (x.miss || 0), 0);
        return `<li>
          <div><b>صفحة ${p.page}</b> <span class="muted small">${esc(surahLabel(p.page))}</span><br>
          <small class="muted">مرات النسيان: ${p.srs.lapses} · أخطاء الآيات: ${misses}</small></div>
          <button class="btn small" data-action="drill" data-page="${p.page}">راجعها</button>
        </li>`;
      })
      .join("")}</ul>
  </div>`;
}

function tipsHTML(open = false) {
  return `<details class="card tips" ${open ? "open" : ""}>
    <summary><h2>كيف يعمل التطبيق؟</h2></summary>
    <ol>
      <li><b>سجّل الصفحة</b> التي حفظتها: يجلب التطبيق آياتها تلقائياً، وتضيف لكل آية <b>كلمة الربط</b> أو <b>الصورة الذهنية</b> أو <b>صورة</b> ساعدتك على حفظها.</li>
      <li><b>الاسترجاع النشط:</b> عند المراجعة لا يُعرض عليك النص، بل رقم الصفحة وبدايتها. تسمّع من ذاكرتك، ثم تستعين بمفاتيحك (كلمات الربط والصور) عند التعثر، أو تسمّع <b>آية بآية</b>.</li>
      <li><b>سجّل أخطاءك:</b> اضغط على الآية التي تعثرت فيها، فيتذكر التطبيق نقاط ضعفك.</li>
      <li><b>التكرار المتباعد:</b> حسب تقييمك (نسيت / صعب / جيد / سهل) يحدد التطبيق موعد المراجعة القادمة: غداً ← 3 أيام ← أسبوع ← أسابيع ← أشهر. الضعيف يتكرر أكثر، والراسخ يتباعد.</li>
    </ol>
    <p class="muted small">﴿وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ﴾</p>
  </details>`;
}

delegate(root(), {
  review: () => {
    if (dueList().length) startSession();
    else show("review");
  },
  add: () => openEditor(),
  range: () => openRange(),
  backup: () => show("settings"),
  juz: el => scrollToJuz(+el.dataset.j),
  drill: el => startSession({ pages: [+el.dataset.page], extra: true }),
  practice: () => startSession({ extra: true }),
  "all-pages": () => showPagesList(),
  "add-page": el => openEditor(+el.dataset.page),
  "add-motivation": () => openNoteEditor({ kind: "motivation" }),
  "next-motivation": () => swapMotivation(1),
  "prev-motivation": () => swapMotivation(-1),
  "toggle-display": async el => {
    await toggleDisplay("motivation", el.dataset.id);
    swapMotivation(0);
  },
  "all-motivation": () => openMotivationList(),
  "view-motivation": el => viewMotivation(el.dataset.id),
  expand: el => el.classList.toggle("clamp"),
  "surah-pages": el => showPagesList({ surah: +el.dataset.s }),
  "surah-maps": el => showPagesList({ surah: +el.dataset.s, view: "maps" }),
  "open-page": el => openDetail(+el.dataset.page),
});

// السحب بالإصبع على بطاقة التحفيز (في الاتجاه العربي: نحو اليمين = التالي)
let motivTouchX = null;
root().addEventListener("touchstart", e => {
  motivTouchX = e.target.closest("#motivCard") ? e.touches[0].clientX : null;
}, { passive: true });
root().addEventListener("touchend", e => {
  if (motivTouchX === null) return;
  const dx = e.changedTouches[0].clientX - motivTouchX;
  motivTouchX = null;
  if (Math.abs(dx) > 60 && motivations.length > 1) swapMotivation(dx > 0 ? 1 : -1);
});

root().addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.matches(".pcard")) {
    e.preventDefault();
    openDetail(+e.target.dataset.page);
  }
});
