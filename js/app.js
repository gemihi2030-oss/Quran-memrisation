// ===== التطبيق الرئيسي =====
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const settings = Object.assign({ maxReviews: 30, maxInterval: 180 }, Store.get("settings", {}));
let pages = new Map();          // page -> record
let session = null;             // جلسة المراجعة الحالية
let editingImages = [];         // صور النافذة المفتوحة

// ---------- أدوات ----------
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function lines(s) { return String(s || "").split("\n").map(x => x.trim()).filter(Boolean); }
function firstWords(text, n = 5) { return (lines(text)[0] || "").split(/\s+/).slice(0, n).join(" "); }

async function loadPages() {
  const all = await DB.all();
  pages = new Map(all.map(r => [r.page, r]));
}

// ---------- سجل المراجعات والأيام المتتالية ----------
function logReview() {
  const log = Store.get("reviewLog", {});
  const t = SRS.todayStr();
  log[t] = (log[t] || 0) + 1;
  Store.set("reviewLog", log);
}
function streak() {
  const log = Store.get("reviewLog", {});
  let d = SRS.todayStr(), n = 0;
  if (!log[d]) d = SRS.addDays(d, -1); // اليوم لم يُراجَع بعد: لا ينقطع العدّ
  while (log[d]) { n++; d = SRS.addDays(d, -1); }
  return n;
}

// ---------- التنقل ----------
function show(view) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
  $$(".tabbar button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "home") renderHome();
  if (view === "pages") renderGrid();
  if (view === "review" && !session) startReview();
  if (view === "settings") {
    $("#setMaxReviews").value = settings.maxReviews;
    $("#setMaxInterval").value = settings.maxInterval;
  }
  window.scrollTo(0, 0);
}

function dueList() {
  const t = SRS.todayStr();
  return [...pages.values()]
    .filter(p => SRS.isDue(p.srs, t))
    // الأقدم استحقاقاً ثم الأضعف أولاً
    .sort((a, b) => a.srs.due.localeCompare(b.srs.due) || a.srs.ease - b.srs.ease);
}

// ---------- الرئيسية ----------
function renderHome() {
  const due = dueList().length;
  const total = pages.size;
  const log = Store.get("reviewLog", {});
  $("#statDue").textContent = due;
  $("#statPages").textContent = total;
  $("#statStreak").textContent = streak();
  $("#statToday").textContent = log[SRS.todayStr()] || 0;
  const pct = (total / 604) * 100;
  $("#progressBar").style.width = pct.toFixed(1) + "%";
  $("#progressLabel").textContent = `${total} / 604 صفحة (${pct.toFixed(1)}٪) — تقريباً ${(total / 20).toFixed(1)} جزء`;
  $("#startReviewBtn").textContent = due ? `ابدأ المراجعة (${due})` : "لا مراجعات مستحقة ✓";

  const badge = $("#navBadge");
  badge.hidden = !due;
  badge.textContent = due;

  // المراجعات القادمة مجمعة حسب اليوم
  const t = SRS.todayStr();
  const groups = {};
  for (const p of pages.values()) {
    const d = p.srs.due <= t ? t : p.srs.due;
    (groups[d] = groups[d] || []).push(p.page);
  }
  const days = Object.keys(groups).sort().slice(0, 7);
  $("#upcomingList").innerHTML = days.length
    ? days.map(d => {
        const diff = SRS.daysBetween(t, d);
        const label = diff === 0 ? "اليوم" : diff === 1 ? "غداً" : `بعد ${SRS.intervalLabel(diff)}`;
        const ps = groups[d].sort((a, b) => a - b);
        return `<li><span>${label}</span><span class="muted">${ps.length} صفحة: ${ps.slice(0, 12).join("، ")}${ps.length > 12 ? "…" : ""}</span></li>`;
      }).join("")
    : `<li class="muted">لم تسجل أي صفحة بعد. ابدأ بإضافة أول صفحة حفظتها.</li>`;
}

// ---------- شبكة المصحف ----------
function renderGrid() {
  const t = SRS.todayStr();
  let html = "";
  let lastJuz = 0;
  for (let i = 1; i <= 604; i++) {
    const j = juzOfPage(i);
    if (j !== lastJuz) { html += `<div class="juz">الجزء ${j}</div>`; lastJuz = j; }
    const p = pages.get(i);
    const cls = p ? SRS.level(p.srs, t) : "none";
    html += `<button class="cell ${cls}" data-page="${i}" title="صفحة ${i}">${i}</button>`;
  }
  $("#mushafGrid").innerHTML = html;
}

// ---------- نافذة الإضافة / التعديل ----------
function openPageDialog(pageNo) {
  const rec = pageNo ? pages.get(pageNo) : null;
  $("#dialogTitle").textContent = rec ? `تعديل الصفحة ${rec.page}` : "إضافة صفحة محفوظة";
  $("#fPage").value = rec ? rec.page : pageNo || suggestNextPage() || "";
  $("#fPage").readOnly = !!rec;
  $("#fSurah").value = rec ? rec.surah || "" : $("#fPage").value ? surahsOnPage(+$("#fPage").value) : "";
  $("#fText").value = rec ? rec.text || "" : "";
  $("#fCue").value = rec ? rec.cue || "" : "";
  $("#fLinks").value = rec ? (rec.links || []).join("\n") : "";
  $("#fNotes").value = rec ? rec.notes || "" : "";
  $("#fetchStatus").textContent = "";
  editingImages = rec ? [...(rec.images || [])] : [];
  renderEditImages();
  $("#deletePageBtn").hidden = !rec;
  $("#pageDialog").showModal();
}

function suggestNextPage() {
  if (!pages.size) return "";
  const max = Math.max(...pages.keys());
  return max < 604 ? max + 1 : "";
}

function renderEditImages() {
  $("#fImages").innerHTML = editingImages.map((src, i) =>
    `<div class="img-wrap"><img src="${src}" alt=""><button type="button" class="rm" data-i="${i}" aria-label="حذف">✕</button></div>`
  ).join("");
}

// تصغير الصورة قبل تخزينها
function compressImage(file, max = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// جلب نص الصفحة من واجهة alquran.cloud (رسم عثماني)
async function fetchPageText() {
  const n = +$("#fPage").value;
  if (!(n >= 1 && n <= 604)) return toast("أدخل رقم صفحة صحيح (1 - 604)");
  const status = $("#fetchStatus");
  status.textContent = "جارٍ الجلب…";
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/page/${n}/quran-uthmani`);
    if (!res.ok) throw new Error(res.status);
    const { data } = await res.json();
    const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
    const surahNames = [];
    const out = data.ayahs.map(a => {
      const name = a.surah.name.replace(/^سُورَةُ\s*/, "");
      if (!surahNames.includes(name)) surahNames.push(name);
      let text = a.text;
      if (a.numberInSurah === 1 && a.surah.number !== 1 && text.startsWith(BASMALA)) text = text.slice(BASMALA.length).trim();
      return `${text} ﴿${a.numberInSurah}﴾`;
    });
    $("#fText").value = out.join("\n");
    $("#fSurah").value = surahNames.join(" - ");
    if (!$("#fCue").value) $("#fCue").value = firstWords(out[0], 5);
    status.textContent = `✓ تم جلب ${out.length} آية`;
  } catch (e) {
    status.textContent = "تعذر الجلب (تحقق من الاتصال). يمكنك كتابة الآيات يدوياً.";
  }
}

async function savePage(e) {
  e.preventDefault();
  const n = +$("#fPage").value;
  if (!(n >= 1 && n <= 604)) return toast("رقم الصفحة يجب أن يكون بين 1 و 604");
  const existing = pages.get(n);
  if (existing && $("#fPage").readOnly === false) {
    if (!confirm(`الصفحة ${n} مسجلة مسبقاً. هل تريد استبدال بياناتها (مع الاحتفاظ بتقدم المراجعة)؟`)) return;
  }
  const text = $("#fText").value.trim();
  const rec = {
    page: n,
    surah: $("#fSurah").value.trim() || surahsOnPage(n),
    text,
    cue: $("#fCue").value.trim() || firstWords(text, 5),
    links: lines($("#fLinks").value),
    notes: $("#fNotes").value.trim(),
    images: editingImages,
    createdAt: existing?.createdAt || SRS.todayStr(),
    srs: existing?.srs || SRS.newCard(),
  };
  try {
    await DB.put(rec);
  } catch (err) {
    return toast("تعذر الحفظ: ربما المساحة ممتلئة");
  }
  pages.set(n, rec);
  $("#pageDialog").close();
  toast(existing ? "تم التحديث ✓" : `تم حفظ الصفحة ${n} — أول مراجعة غداً إن شاء الله`);
  renderHome();
  if ($("#view-pages").classList.contains("active")) renderGrid();
}

async function deletePage() {
  const n = +$("#fPage").value;
  if (!confirm(`حذف الصفحة ${n} وكل تقدم مراجعتها؟`)) return;
  await DB.remove(n);
  pages.delete(n);
  $("#pageDialog").close();
  toast("تم الحذف");
  renderHome();
  renderGrid();
}

// ---------- المراجعة (الاسترجاع النشط) ----------
function startReview(extra = false) {
  let queue = dueList();
  if (extra) {
    // مراجعة إضافية: أضعف الصفحات حسب سهولة التذكر والتعثرات
    queue = [...pages.values()].sort((a, b) => (a.srs.ease - a.srs.lapses * 0.1) - (b.srs.ease - b.srs.lapses * 0.1) || a.srs.interval - b.srs.interval);
  }
  queue = queue.slice(0, settings.maxReviews).map(p => p.page);
  session = { queue, done: 0, total: queue.length, extra, again: new Set() };
  nextCard();
}

function nextCard() {
  const has = session && session.queue.length;
  $("#reviewEmpty").hidden = !!has;
  $("#reviewCard").hidden = !has;
  if (!has) {
    if (session && session.total) toast(`أحسنت! أنهيت ${session.done} مراجعة 🌟`);
    session = null;
    renderHome();
    $("#extraReviewBtn").hidden = !pages.size;
    return;
  }
  const rec = pages.get(session.queue[0]);
  session.current = rec;
  session.hintIdx = 0;

  $("#reviewCounter").textContent = `${session.done + 1} / ${session.done + session.queue.length}`;
  $("#reviewMeta").textContent = session.again.has(rec.page) ? "إعادة" : rec.srs.reps === 0 ? "صفحة جديدة" : `آخر فاصل: ${SRS.intervalLabel(rec.srs.interval)}`;
  $("#rvPage").textContent = rec.page;
  $("#rvSurah").textContent = rec.surah || "";
  $("#rvCue").innerHTML = rec.cue ? `<span class="quran-inline">${esc(rec.cue)}</span> …` : `<span class="muted">(لا توجد بداية مسجلة — تذكّر الصفحة من رقمها)</span>`;
  $("#rvHints").innerHTML = "";
  $("#hintBtn").hidden = !(rec.links && rec.links.length);
  $("#hintBtn").disabled = false;
  $("#clozeBtn").hidden = !rec.text;
  $("#rvCloze").hidden = true;
  $("#stageRecall").hidden = false;
  $("#stageAnswer").hidden = true;

  // معاينة الفاصل القادم لكل تقييم
  $$(".grade").forEach(b => {
    const s = SRS.next(rec.srs, +b.dataset.grade, settings.maxInterval);
    b.querySelector("small").textContent = SRS.intervalLabel(s.interval);
  });
}

function showHint() {
  const rec = session.current;
  if (session.hintIdx >= rec.links.length) return;
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = rec.links[session.hintIdx++];
  $("#rvHints").appendChild(chip);
  if (session.hintIdx >= rec.links.length) $("#hintBtn").disabled = true;
}

// اختبار الفراغات: إخفاء بعض الكلمات والضغط عليها لكشفها
function showCloze() {
  const rec = session.current;
  const html = lines(rec.text).map((line, li) => {
    const words = line.split(/\s+/);
    return words.map((w, wi) => {
      const isMarker = /^﴿.*﴾$/.test(w);
      // نخفي كلمة من كل 3 كلمات تقريباً، مع إبقاء أول كلمة في الآية الأولى كمفتاح
      const hide = !isMarker && !(li === 0 && wi === 0) && (wi + li) % 3 !== 0;
      return hide ? `<span class="blank" data-w="${esc(w)}">${"•".repeat(Math.min(5, Math.max(2, Math.round(w.length / 3))))}</span>` : esc(w);
    }).join(" ");
  }).join("<br>");
  const box = $("#rvCloze");
  box.innerHTML = html;
  box.hidden = false;
}

function reveal() {
  const rec = session.current;
  $("#stageRecall").hidden = true;
  $("#stageAnswer").hidden = false;
  $("#rvText").innerHTML = rec.text ? lines(rec.text).map(esc).join("<br>") : `<span class="muted">لم يسجَّل نص الآيات لهذه الصفحة — افتح المصحف وتحقق من حفظك.</span>`;
  $("#rvLinksWrap").hidden = !(rec.links && rec.links.length);
  $("#rvLinks").innerHTML = (rec.links || []).map(l => `<span class="chip">${esc(l)}</span>`).join("");
  $("#rvNotesWrap").hidden = !rec.notes;
  $("#rvNotes").textContent = rec.notes || "";
  $("#rvImages").innerHTML = (rec.images || []).map(src => `<img src="${src}" alt="صورة مساعدة">`).join("");
  // ربط الصفحات: بداية الصفحة التالية إن كانت محفوظة
  const nxt = pages.get(rec.page + 1);
  $("#rvNextWrap").innerHTML = nxt && nxt.cue
    ? `🔗 <b>ربط الصفحات:</b> الصفحة ${nxt.page} تبدأ بـ <span class="quran-inline">${esc(nxt.cue)}</span>`
    : "";
}

async function grade(g) {
  const rec = session.current;
  const isRetry = session.again.has(rec.page);
  // - الصفحة المعادة في نفس الجلسة جُدولت مسبقاً (غداً) فلا نعيد جدولتها
  // - في المراجعة الإضافية لا نغيّر الجدولة إلا عند النسيان
  if (!isRetry && (!session.extra || g === 0)) {
    rec.srs = SRS.apply(rec.srs, g, settings.maxInterval);
    await DB.put(rec);
  }
  logReview();
  session.queue.shift();
  if (g === 0) {
    // نعيد الصفحة المنسية في آخر الجلسة لاسترجاعها مرة أخرى
    session.queue.push(rec.page);
    session.again.add(rec.page);
    toast("ستعود هذه الصفحة في آخر الجلسة — راجعها من المصحف الآن");
  } else {
    session.again.delete(rec.page);
    session.done++;
  }
  nextCard();
}

// ---------- النسخ الاحتياطي ----------
async function exportData() {
  const data = {
    app: "quran-memorisation", version: 1, exportedAt: new Date().toISOString(),
    settings, reviewLog: Store.get("reviewLog", {}), pages: await DB.all(),
  };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `quran-memorisation-${SRS.todayStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.pages)) throw new Error("bad file");
    if (!confirm(`استيراد ${data.pages.length} صفحة؟ الصفحات الموجودة بنفس الرقم سيتم استبدالها.`)) return;
    for (const p of data.pages) if (p && p.page && p.srs) await DB.put(p);
    if (data.reviewLog) Store.set("reviewLog", { ...Store.get("reviewLog", {}), ...data.reviewLog });
    await loadPages();
    renderHome();
    toast("تم الاستيراد ✓");
  } catch {
    toast("ملف غير صالح");
  }
}

// ---------- الربط بالأحداث ----------
function bind() {
  $$(".tabbar button").forEach(b => b.addEventListener("click", () => show(b.dataset.view)));
  $("#startReviewBtn").addEventListener("click", () => { session = null; show("review"); });
  $("#quickAddBtn").addEventListener("click", () => openPageDialog());
  $("#addPageBtn").addEventListener("click", () => openPageDialog());
  $("#extraReviewBtn").addEventListener("click", () => startReview(true));

  $("#mushafGrid").addEventListener("click", e => {
    const c = e.target.closest(".cell");
    if (c) openPageDialog(+c.dataset.page);
  });

  $("#closeDialog").addEventListener("click", () => $("#pageDialog").close());
  $("#pageForm").addEventListener("submit", savePage);
  $("#deletePageBtn").addEventListener("click", deletePage);
  $("#fetchTextBtn").addEventListener("click", fetchPageText);
  $("#fPage").addEventListener("input", () => {
    const n = +$("#fPage").value;
    if (n >= 1 && n <= 604) $("#fSurah").value = surahsOnPage(n);
  });
  $("#fImageInput").addEventListener("change", async e => {
    for (const f of e.target.files) {
      try { editingImages.push(await compressImage(f)); } catch { toast("تعذر قراءة الصورة"); }
    }
    e.target.value = "";
    renderEditImages();
  });
  $("#fImages").addEventListener("click", e => {
    const rm = e.target.closest(".rm");
    if (rm) { editingImages.splice(+rm.dataset.i, 1); renderEditImages(); }
  });

  $("#hintBtn").addEventListener("click", showHint);
  $("#clozeBtn").addEventListener("click", showCloze);
  $("#rvCloze").addEventListener("click", e => {
    const b = e.target.closest(".blank");
    if (b) { b.textContent = b.dataset.w; b.classList.add("shown"); }
  });
  $("#revealBtn").addEventListener("click", reveal);
  $$(".grade").forEach(b => b.addEventListener("click", () => grade(+b.dataset.grade)));

  $("#exportBtn").addEventListener("click", exportData);
  $("#importInput").addEventListener("change", e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; });
  $("#saveSettingsBtn").addEventListener("click", () => {
    settings.maxReviews = Math.max(1, +$("#setMaxReviews").value || 30);
    settings.maxInterval = Math.min(365, Math.max(7, +$("#setMaxInterval").value || 180));
    Store.set("settings", settings);
    toast("تم حفظ الإعدادات");
  });
  $("#wipeBtn").addEventListener("click", async () => {
    if (!confirm("سيتم حذف كل الصفحات وسجل المراجعة نهائياً. هل صدّرت نسخة احتياطية؟")) return;
    if (!confirm("تأكيد نهائي: حذف كل شيء؟")) return;
    await DB.clear();
    Store.set("reviewLog", {});
    pages.clear();
    toast("تم حذف البيانات");
    show("home");
  });
}

// ---------- البدء ----------
(async function init() {
  $("#todayLabel").textContent = new Date().toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" });
  bind();
  await loadPages();
  renderHome();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
