// جلسة المراجعة: الاسترجاع النشط + التقييم + الجدولة
//  1) الاسترجاع: يُعرض رقم الصفحة وبدايتها فقط، وتسمّع من ذاكرتك، مع تلميحات تدريجية من مفاتيحك
//  2) آية بآية: يظهر مفتاح كل آية (كلمة الربط / الصورة) فتسمّعها ثم تكشفها وتحكم: أصبت أم أخطأت
//  3) الفراغات: الصفحة مع كلمات مخفية تكشفها بالضغط
//  4) الإجابة: النص كاملاً، تضغط على الآيات التي تعثرت فيها، ثم تقيّم نفسك فيُحدَّد موعد المراجعة القادمة
import { $, esc, delegate, toast, seededRandom } from "../util.js";
import { pages, settings, savePage, buildQueue, logReview, dueList } from "../state.js";
import { renderAyahs, getPageAyahs, surahLabel, juzOfPage, firstWords, lastWords, arDigits } from "../quran.js";
import { applyGrade, nextState, durationLabel, todayStr, GRADE_LABELS, AGAIN, HARD, GOOD, EASY } from "../srs.js";
import { show, current, updateChrome } from "../router.js";
import { openEditor } from "./editor.js";
import { openGallery } from "./lightbox.js";

const root = () => $("#view-review");
let session = null;

export function startSession({ pages: list, extra = false } = {}) {
  const queue = list ?? buildQueue({ extra });
  session = queue.length
    ? { queue: [...queue], done: 0, extra, again: new Set(), results: [], cur: null, finished: false, loading: false }
    : null;
  if (current() === "review") renderReview();
  else show("review");
}

export function renderReview() {
  if (!session) return renderStart();
  if (session.finished) return renderDone();
  if (!session.cur) return loadCard();
  renderCard();
}

// ---------- شاشة البداية ----------
function renderStart() {
  const due = dueList();
  if (due.length) {
    const n = Math.min(due.length, settings.maxReviews);
    const list = due.map(p => p.page).sort((a, b) => a - b);
    root().innerHTML = `
      <div class="card center start">
        <h2>مراجعة اليوم</h2>
        <p class="big-num">${due.length}</p>
        <p class="muted">صفحة مستحقة للمراجعة${due.length > n ? ` — ستُراجَع ${n} في هذه الجلسة` : ""}</p>
        <div class="chips">${list.slice(0, 40).map(p => `<span class="chip">${p}</span>`).join("")}${list.length > 40 ? "<span class='chip'>…</span>" : ""}</div>
        <button class="btn primary big" data-action="start">🎙️ ابدأ</button>
        <p class="muted small">نصيحة: سمّع بصوت مسموع ومن ذاكرتك قبل كشف أي شيء — الجهد في التذكر هو ما يثبّت الحفظ.</p>
      </div>`;
  } else {
    root().innerHTML = `
      <div class="card center start">
        <div class="big-emoji">✅</div>
        <h2>لا توجد مراجعات مستحقة الآن</h2>
        <p class="muted">بارك الله فيك. ${pages.size ? "يمكنك حفظ صفحة جديدة، أو التدرّب على أضعف صفحاتك (دون تغيير جدولها إلا إن نسيت)." : "سجّل أول صفحة حفظتها لتبدأ."}</p>
        ${pages.size ? `<button class="btn big" data-action="extra">💪 تدرّب على أضعف الصفحات</button>` : ""}
        <button class="btn ghost" data-action="add">＋ حفظت صفحة جديدة</button>
      </div>`;
  }
}

// ---------- تحضير البطاقة ----------
async function loadCard() {
  if (!session.queue.length) {
    session.finished = true;
    return renderDone();
  }
  const page = session.queue[0];
  const rec = pages.get(page);
  if (!rec) {
    session.queue.shift();
    return loadCard();
  }
  if (session.loading) return;
  session.loading = true;
  try {
    // صفحة بلا نص (مسجلة ضمن مجموعة): نجلب آياتها
    if (!rec.ayahs.length) {
      root().innerHTML = `<div class="card center muted">⏳ جارٍ تحضير الصفحة ${page}…</div>`;
      try {
        const ayahs = await getPageAyahs(page);
        if (ayahs && !rec.ayahs.length) {
          rec.ayahs = ayahs.map(a => ({ ...a }));
          rec.cue = rec.cue || firstWords(ayahs[0]?.text, 5);
          await savePage(rec);
        }
      } catch {}
    }
    // نهاية الصفحة السابقة: لربط الصفحات ببعضها
    let prevEnd = "";
    try {
      const prevRec = pages.get(page - 1);
      const prev = prevRec?.ayahs?.length ? prevRec.ayahs : await getPageAyahs(page - 1, { network: false });
      if (prev?.length) prevEnd = lastWords(prev[prev.length - 1].text, 7);
    } catch {}

    session.cur = {
      rec,
      stage: "recall",
      prevEnd,
      showCue: settings.autoCue,
      showPrev: false,
      linksShown: 0,
      showImages: false,
      showNotes: false,
      hints: 0,
      marks: new Set(),
      guided: null,
      cloze: null,
      isRetry: session.again.has(page),
    };
  } finally {
    session.loading = false;
  }
  if (current() === "review") renderCard();
}

// ---------- عرض البطاقة ----------
function renderCard() {
  const cur = session.cur;
  const fresh = pages.get(cur.rec.page); // إن عُدّلت الصفحة أثناء الجلسة
  if (fresh && fresh !== cur.rec) cur.rec = fresh;
  const { rec } = cur;
  const pos = session.done + 1;
  const total = session.done + session.queue.length;
  const meta = cur.isRetry
    ? "🔁 إعادة"
    : session.extra
      ? "💪 تدريب إضافي"
      : !rec.srs.last
        ? "🌱 أول مراجعة"
        : `آخر فاصل: ${durationLabel(rec.srs.interval)}`;
  const body = { recall: recallHTML, guided: guidedHTML, cloze: clozeHTML, answer: answerHTML }[cur.stage]();

  root().innerHTML = `
    <div class="review-head">
      <span class="pill">${pos} / ${total}</span>
      <span class="pill soft">${meta}</span>
      <button class="link-btn" data-action="end">إنهاء الجلسة</button>
    </div>
    <div class="progress thin"><div class="bar" style="width:${(session.done / Math.max(1, total)) * 100}%"></div></div>
    <div class="card review stage-${cur.stage}">
      <div class="page-badge">
        <small>الصفحة</small><b>${rec.page}</b>
        <span>${esc(surahLabel(rec.page))} · الجزء ${juzOfPage(rec.page)}</span>
      </div>
      ${body}
    </div>`;

  if (cur.stage === "guided") {
    const box = $(".guided-text", root());
    if (box) box.scrollTop = box.scrollHeight;
  }
}

function recallHTML() {
  const cur = session.cur;
  const { rec } = cur;
  const hasAyahs = rec.ayahs.length > 0;
  const hasHookAyahs = rec.ayahs.some(x => x.hook || x.img || x.note);
  const imgs = [...rec.images, ...rec.ayahs.filter(x => x.img).map(x => x.img)];
  const maps = rec.maps || [];

  let cueBlock;
  if (cur.showCue && rec.cue) cueBlock = `<div class="cue"><span class="quran-inline">${esc(rec.cue)}</span> …</div>`;
  else if (rec.cue) cueBlock = `<button class="btn small" data-action="show-cue">👁️ أظهر بداية الصفحة</button>`;
  else cueBlock = `<p class="muted small">(لا توجد بداية مسجلة — تذكّر الصفحة من رقمها وسورتها)</p>`;

  const hintBtns = [];
  if (cur.prevEnd && !cur.showPrev) hintBtns.push(`<button class="btn small" data-action="show-prev">↩️ نهاية الصفحة السابقة</button>`);
  if (rec.links.length && cur.linksShown < rec.links.length) hintBtns.push(`<button class="btn small" data-action="hint-link">💡 كلمة ربط (${cur.linksShown}/${rec.links.length})</button>`);
  if (maps.length && !cur.showMaps) hintBtns.push(`<button class="btn small" data-action="show-maps">🗺️ الخريطة الذهنية</button>`);
  if (imgs.length && !cur.showImages) hintBtns.push(`<button class="btn small" data-action="show-images">🖼️ صور التربيط (${imgs.length})</button>`);
  if (rec.notes && !cur.showNotes) hintBtns.push(`<button class="btn small" data-action="show-notes">🧠 الصورة الذهنية</button>`);

  return `
    <p class="instruction">🎙️ سمّع الصفحة من ذاكرتك بصوت مسموع، ثم اكشف النص. استعن بمفاتيحك عند التعثر فقط.</p>
    <div class="cue-box">
      ${cur.showPrev ? `<div class="prev-end"><small>آخر الصفحة السابقة:</small> <span class="quran-inline">… ${esc(cur.prevEnd)}</span></div>` : ""}
      <small class="muted">بداية الصفحة</small>
      ${cueBlock}
      ${cur.linksShown ? `<div class="chips">${rec.links.slice(0, cur.linksShown).map(l => `<span class="chip">${esc(l)}</span>`).join("")}</div>` : ""}
      ${cur.showNotes ? `<p class="notes">${esc(rec.notes)}</p>` : ""}
      ${cur.showMaps ? `<div class="images maps">${maps.map(src => `<img src="${src}" alt="الخريطة الذهنية" data-action="zoom">`).join("")}</div>` : ""}
      ${cur.showImages ? `<div class="images">${imgs.map(src => `<img src="${src}" alt="صورة تربيط" data-action="zoom">`).join("")}</div>` : ""}
    </div>
    ${hintBtns.length ? `<div class="row wrap center-row">${hintBtns.join("")}</div>` : ""}
    <button class="btn primary big" data-action="reveal">📖 سمّعت — أظهر الصفحة</button>
    ${hasAyahs ? `<div class="row two">
      <button class="btn" data-action="guided">🎯 آية بآية${hasHookAyahs ? " (مع مفاتيحي)" : ""}</button>
      <button class="btn" data-action="cloze">🧩 اختبار الفراغات</button>
    </div>` : ""}`;
}

function guidedHTML() {
  const cur = session.cur;
  const { rec, guided: g, marks } = cur;
  const ay = rec.ayahs;
  const x = ay[g.i];
  const dots = ay
    .map((_, i) => `<i class="dot ${i < g.i ? (marks.has(i) ? "bad" : "ok") : i === g.i ? "cur" : ""}"></i>`)
    .join("");
  const shown = g.i + (g.revealed ? 1 : 0);
  const keys = [
    x.hook ? `<span class="chip big">🔗 ${esc(x.hook)}</span>` : "",
    x.note ? `<p class="notes">🧠 ${esc(x.note)}</p>` : "",
    x.img ? `<img class="g-img" src="${x.img}" alt="صورة الآية">` : "",
  ].join("");

  return `
    <div class="dots">${dots}</div>
    ${shown ? `<div class="quran guided-text">${renderAyahs(ay, { marks, current: g.revealed ? g.i : -1, count: shown })}</div>` : ""}
    <div class="g-cue">
      <div class="g-num">الآية ${x.a ? `﴿${arDigits(x.a)}﴾` : ""} <small class="muted">(${g.i + 1} من ${ay.length})</small></div>
      ${keys || (g.i === 0 && rec.cue ? "" : `<small class="muted">لا مفتاح لهذه الآية — تذكّرها مما قبلها</small>`)}
      ${g.i === 0 && rec.cue && settings.autoCue ? `<div class="cue small-cue"><span class="quran-inline">${esc(rec.cue)}</span> …</div>` : ""}
      ${!g.revealed ? (g.firstShown
          ? `<div class="cue small-cue"><span class="quran-inline">${esc(firstWords(x.text, 1))}</span> …</div>`
          : `<button class="btn small" data-action="g-first">💡 أول كلمة</button>`)
        : ""}
    </div>
    ${g.revealed
      ? `<div class="row two">
          <button class="btn bad" data-action="g-bad">✗ أخطأت / تعثرت</button>
          <button class="btn ok" data-action="g-ok">✓ أصبت</button>
        </div>`
      : `<button class="btn primary big" data-action="g-reveal">سمّعتها — أظهر الآية</button>`}
    <button class="link-btn block" data-action="reveal">تخطَّ إلى الصفحة كاملة ←</button>`;
}

function clozeHTML() {
  const { rec, cloze } = session.cur;
  const html = rec.ayahs
    .map((x, i) => {
      const words = x.text.split(" ");
      const body = words
        .map((w, j) =>
          cloze.hidden.has(`${i}:${j}`)
            ? `<span class="blank" data-action="blank" data-w="${esc(w)}">${"ـ".repeat(Math.min(6, Math.max(2, Math.round(w.length / 2))))}</span>`
            : esc(w)
        )
        .join(" ");
      return `<span class="ayah">${body} ${x.a ? `<span class="marker">﴿${arDigits(x.a)}﴾</span>` : ""}</span>`;
    })
    .join(" ");
  return `
    <p class="instruction">🧩 سمّع الصفحة واملأ الفراغات من ذاكرتك. اضغط على أي فراغ لكشفه.</p>
    <div class="quran cloze">${html}</div>
    <button class="btn primary big" data-action="reveal">📖 أظهر الصفحة وقيّم نفسك</button>`;
}

function answerHTML() {
  const cur = session.cur;
  const { rec, marks } = cur;
  const nxt = pages.get(rec.page + 1);
  const imgs = [...rec.images];
  const maps = rec.maps || [];
  const gradeBtns = [AGAIN, HARD, GOOD, EASY].map(g => `<button class="grade g${g}" data-action="grade" data-g="${g}">${GRADE_LABELS[g]}<small>${gradePreview(g)}</small></button>`).join("");

  return `
    ${rec.ayahs.length
      ? `<p class="instruction">👆 اضغط على كل آية أخطأت أو تعثرت فيها لتسجيلها <span class="tag bad">خطأ</span></p>
         <div class="quran answer-text">${renderAyahs(rec.ayahs, { marks, tappable: true, showMiss: true })}</div>
         <p class="muted small legend-line"><span class="was-missed-sample">آية</span> = تعثرت فيها في مراجعات سابقة</p>`
      : `<div class="notice">لا يوجد نص لهذه الصفحة (لا إنترنت؟) — افتح مصحفك وتحقق من حفظك.
           <button class="link-btn" data-action="edit">إضافة الآيات</button></div>`}
    ${rec.links.length ? `<h3>🔗 كلمات الربط</h3><div class="chips">${rec.links.map(l => `<span class="chip">${esc(l)}</span>`).join("")}</div>` : ""}
    ${rec.notes ? `<h3>🧠 الصورة الذهنية</h3><p class="notes">${esc(rec.notes)}</p>` : ""}
    ${maps.length ? `<h3>🗺️ الخريطة الذهنية</h3><div class="images maps">${maps.map(src => `<img src="${src}" alt="الخريطة الذهنية" data-action="zoom">`).join("")}</div>` : ""}
    ${imgs.length ? `<h3>🖼️ صور التربيط</h3><div class="images">${imgs.map(src => `<img src="${src}" alt="صورة تربيط" data-action="zoom">`).join("")}</div>` : ""}
    ${nxt?.cue ? `<p class="next-link">🔗 <b>اربطها بما بعدها:</b> الصفحة ${nxt.page} تبدأ بـ <span class="quran-inline">${esc(nxt.cue)}</span></p>` : ""}
    <h3 class="center">كيف كان استرجاعك؟</h3>
    <p class="suggest" id="suggestBox">${suggestText()}</p>
    <div class="grades" id="grades">${gradeBtns}</div>`;
}

// ---------- التقييم ----------
function suggestGrade() {
  const { rec, marks, hints } = session.cur;
  const n = rec.ayahs.length;
  if (!n) return null;
  if (marks.size === 0) return hints > 2 ? HARD : GOOD;
  return marks.size / n > 0.3 ? AGAIN : HARD;
}

function suggestText() {
  const { rec, marks, hints } = session.cur;
  const g = suggestGrade();
  if (g === null) return "قيّم نفسك بصدق — هذا ما يجعل الجدولة دقيقة.";
  const parts = [marks.size ? `أخطأت في ${marks.size} من ${countLabel(rec.ayahs.length, "آية", "آيات")}` : "لم تسجّل أي خطأ"];
  if (hints) parts.push(`استعملت ${countLabel(hints, "تلميحاً", "تلميحات", "تلميحاً واحداً", "تلميحين")}`);
  return `${parts.join(" · ")} — المقترح: <b>${GRADE_LABELS[g]}</b>`;
}

// صياغة العدد مع المعدود: 3-10 جمع، وما عداها مفرد
function countLabel(n, singular, plural, one = null, two = null) {
  if (n === 1 && one) return one;
  if (n === 2 && two) return two;
  return `${n} ${n >= 3 && n <= 10 ? plural : singular}`;
}

function updateSuggestion() {
  const box = $("#suggestBox");
  if (box) box.innerHTML = suggestText();
  const g = suggestGrade();
  root().querySelectorAll(".grade").forEach(b => b.classList.toggle("suggested", +b.dataset.g === g));
}

function gradePreview(g) {
  const { rec, isRetry } = session.cur;
  if (isRetry) return g === AGAIN ? "مرة أخرى" : "مجدولة غداً";
  if (session.extra && g !== AGAIN) return "بلا تغيير";
  const s = nextState(rec.srs, g, { maxInterval: settings.maxInterval });
  return s.interval === 1 ? "غداً" : durationLabel(s.interval);
}

async function grade(g) {
  const cur = session?.cur;
  if (!cur || cur.graded) return; // حماية من الضغط المزدوج
  cur.graded = true;
  const { rec, marks, isRetry } = cur;
  // - الصفحة المعادة في نفس الجلسة جُدولت مسبقاً فلا نعيد جدولتها
  // - في التدريب الإضافي لا نغيّر الجدولة إلا عند النسيان
  if (!isRetry && (!session.extra || g === AGAIN)) {
    rec.srs = applyGrade(rec.srs, g, { maxInterval: settings.maxInterval });
  }
  if (!isRetry) {
    rec.ayahs.forEach((x, i) => {
      x.seen = (x.seen || 0) + 1;
      if (marks.has(i)) x.miss = (x.miss || 0) + 1;
    });
  }
  try {
    await savePage(rec);
  } catch {
    toast("تعذر حفظ التقدم");
  }
  logReview();
  updateChrome();
  session.results.push({ page: rec.page, grade: g, errors: marks.size, retry: isRetry });
  session.queue.shift();
  if (g === AGAIN) {
    session.queue.push(rec.page);
    session.again.add(rec.page);
    toast("ستعود هذه الصفحة في آخر الجلسة — راجعها من المصحف الآن 📖", 3500);
  } else {
    session.again.delete(rec.page);
    session.done++;
  }
  session.cur = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadCard();
}

// ---------- نهاية الجلسة ----------
function renderDone() {
  const first = session.results.filter(r => !r.retry);
  const forgot = first.filter(r => r.grade === AGAIN).length;
  const errors = first.reduce((s, r) => s + r.errors, 0);
  const remaining = dueList().length;
  root().innerHTML = `
    <div class="card center done">
      <div class="big-emoji">${first.length ? "🌟" : "👋"}</div>
      <h2>${first.length ? "أحسنت، بارك الله فيك!" : "انتهت الجلسة"}</h2>
      ${first.length ? `<div class="stats three">
        <div class="stat"><b>${first.length}</b><span>صفحة روجعت</span></div>
        <div class="stat"><b>${forgot}</b><span>نسيتها</span></div>
        <div class="stat"><b>${errors}</b><span>آية تعثرت فيها</span></div>
      </div>
      <div class="chips">${first.map(r => `<span class="chip grade-chip g${r.grade}" title="${GRADE_LABELS[r.grade]}">${r.page}</span>`).join("")}</div>` : ""}
      ${remaining ? `<p class="muted">ما زالت ${remaining} صفحة مستحقة.</p><button class="btn primary big" data-action="start">متابعة المراجعة</button>` : ""}
      <p class="dua">«اللَّهُمَّ اجْعَلِ القُرْآنَ رَبِيعَ قُلُوبِنَا، وَنُورَ صُدُورِنَا»</p>
      <button class="btn big" data-action="home">🏠 الرئيسية</button>
    </div>`;
  session = null;
}

// ---------- الأحداث ----------
function enterCloze() {
  const cur = session.cur;
  const rand = seededRandom(`${cur.rec.page}|${todayStr()}`);
  const hidden = new Set();
  cur.rec.ayahs.forEach((x, i) => {
    x.text.split(" ").forEach((w, j) => {
      if (j > 0 && w.length > 1 && rand() < 0.45) hidden.add(`${i}:${j}`);
    });
  });
  cur.cloze = { hidden };
  cur.stage = "cloze";
  renderCard();
}

delegate(root(), {
  start: () => startSession(),
  extra: () => startSession({ extra: true }),
  add: () => openEditor(),
  home: () => {
    session = null;
    show("home");
  },
  end: () => {
    if (!session.results.length || confirm("إنهاء الجلسة الآن؟ الصفحات المتبقية تبقى مستحقة.")) {
      session.finished = true;
      renderDone();
    }
  },
  edit: () => openEditor(session.cur.rec.page),
  "show-cue": () => {
    session.cur.showCue = true;
    renderCard();
  },
  "show-prev": () => {
    session.cur.showPrev = true;
    renderCard();
  },
  "hint-link": () => {
    session.cur.linksShown++;
    session.cur.hints++;
    renderCard();
  },
  "show-images": () => {
    session.cur.showImages = true;
    renderCard();
  },
  "show-maps": () => {
    session.cur.showMaps = true;
    renderCard();
  },
  zoom: el => {
    const all = [...root().querySelectorAll('img[data-action="zoom"]')];
    openGallery(all.map(im => ({ src: im.src, caption: `الصفحة ${session.cur.rec.page} · ${im.alt}` })), all.indexOf(el));
  },
  "show-notes": () => {
    session.cur.showNotes = true;
    renderCard();
  },
  reveal: () => {
    session.cur.stage = "answer";
    renderCard();
    updateSuggestion();
  },
  guided: () => {
    session.cur.guided = { i: 0, revealed: false, firstShown: false };
    session.cur.stage = "guided";
    renderCard();
  },
  cloze: enterCloze,
  blank: el => {
    el.textContent = el.dataset.w;
    el.classList.add("shown");
    el.removeAttribute("data-action");
  },
  "g-first": () => {
    session.cur.guided.firstShown = true;
    session.cur.hints++;
    renderCard();
  },
  "g-reveal": () => {
    session.cur.guided.revealed = true;
    renderCard();
  },
  "g-ok": () => guidedNext(true),
  "g-bad": () => guidedNext(false),
  "toggle-ayah": el => {
    const i = +el.dataset.i;
    const { marks } = session.cur;
    if (marks.has(i)) marks.delete(i);
    else marks.add(i);
    el.classList.toggle("bad", marks.has(i));
    updateSuggestion();
  },
  grade: el => grade(+el.dataset.g),
});

function guidedNext(ok) {
  const cur = session.cur;
  const g = cur.guided;
  if (!ok) cur.marks.add(g.i);
  g.i++;
  g.revealed = false;
  g.firstShown = false;
  if (g.i >= cur.rec.ayahs.length) {
    cur.stage = "answer";
    renderCard();
    updateSuggestion();
  } else renderCard();
}

// اختصارات لوحة المفاتيح على الحاسوب: مسافة = إظهار، 1-4 = التقييم
document.addEventListener("keydown", e => {
  if (current() !== "review" || !session?.cur || document.querySelector("dialog[open]")) return;
  if (e.target.matches("input, textarea, select, button, [role=button]")) return;
  const { stage } = session.cur;
  if (e.key === " " || e.key === "Enter") {
    const btn = root().querySelector('[data-action="g-reveal"]') || root().querySelector('[data-action="reveal"]');
    if (stage !== "answer" && btn) {
      e.preventDefault();
      btn.click();
    }
  } else if (stage === "answer" && ["1", "2", "3", "4"].includes(e.key)) {
    grade(+e.key - 1);
  }
});
