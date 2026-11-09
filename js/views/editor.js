// نافذة تسجيل / تعديل صفحة: الآيات + مفاتيح الحفظ (كلمات الربط، الصور الذهنية، الصور)
import { $, esc, lines, toast, delegate, compressImage } from "../util.js";
import { pages, savePage, removePage, suggestNextPage } from "../state.js";
import {
  TOTAL_PAGES, getPageAyahs, surahLabel, juzOfPage, hizbOfPage, rangeLabel, ayahCountOnPage,
  firstWords, arDigits, parseManualText, ayahsToText, SURAH_NAMES,
} from "../quran.js";
import { newCard, todayStr } from "../srs.js";
import { parseTime, formatTime, safeUrl, sourceLink } from "../media.js";
import { refresh, current } from "../router.js";
import { openDetail } from "./detail.js";

const dlg = () => $("#editorDialog");
let draft = null;
let isNew = false;
let fetchToken = 0;
let autoCue = ""; // آخر بداية صفحة وُلّدت تلقائياً (نستبدلها فقط إن لم يعدّلها المستخدم)
let pageTimer = 0;

export function openEditor(pageNo) {
  const rec = pageNo ? pages.get(+pageNo) : null;
  isNew = !rec;
  draft = rec
    ? structuredClone(rec)
    : { page: pageNo ? +pageNo : suggestNextPage(), ayahs: [], cue: "", links: [], notes: "", images: [], maps: [] };
  if (!Array.isArray(draft.maps)) draft.maps = [];
  autoCue = draft.ayahs[0] ? firstWords(draft.ayahs[0].text, 5) : "";
  render();
  if (!dlg().open) dlg().showModal();
  const p = +draft.page;
  if (p && !draft.ayahs.length) loadText(p);
  if (isNew && !p) $("#edPage").focus();
}

// ---------- القوالب ----------
function render() {
  const p = +draft.page;
  dlg().innerHTML = `
  <form id="editorForm" novalidate>
    <header class="sheet-head">
      <h2>${isNew ? "تسجيل صفحة محفوظة" : `تعديل الصفحة ${p}`}</h2>
      <button type="button" class="icon-btn" data-action="close" aria-label="إغلاق">✕</button>
    </header>
    <div class="sheet-body">
      <div class="row top">
        <label class="field page-field">رقم الصفحة
          <input type="number" id="edPage" min="1" max="${TOTAL_PAGES}" inputmode="numeric" value="${esc(draft.page)}" ${isNew ? "" : "readonly"}>
        </label>
        <div class="page-meta" id="edMeta">${metaHTML(p)}</div>
      </div>
      <p class="status" id="edStatus"></p>

      <section class="ed-sec">
        <h3>🔑 ما ساعدك على حفظ هذه الصفحة</h3>
        <div class="field img-field map-field">
          <div class="img-head"><b>🗺️ الخريطة الذهنية للوجه</b><small class="muted">صورة تلخّص الصفحة كاملة</small></div>
          <div class="photos" id="edMaps">${imagesHTML("maps")}</div>
          <label class="btn add-img">📷 إضافة خريطة ذهنية<input type="file" accept="image/*" multiple hidden id="edMapInput"></label>
        </div>
        <div class="field img-field">
          <div class="img-head"><b>🖼️ صور التربيط</b><small class="muted">صور تربط بها الآيات ببعضها</small></div>
          <div class="photos" id="edImages">${imagesHTML("images")}</div>
          <label class="btn add-img">📷 إضافة صورة تربيط<input type="file" accept="image/*" multiple hidden id="edImageInput"></label>
        </div>
        <label class="field">🔗 كلمات الربط <small class="muted">(كلمة أو عبارة في كل سطر — مثلاً تسلسل مواضيع الصفحة)</small>
          <textarea id="edLinks" rows="3">${esc(draft.links.join("\n"))}</textarea>
        </label>
        <label class="field">🧠 الصورة الذهنية / القصة / المتشابهات
          <textarea id="edNotes" rows="3" placeholder="كيف تخيلت الآيات؟ ما القصة التي ربطتها بها؟ متشابهات تنتبه لها؟">${esc(draft.notes)}</textarea>
        </label>
        <label class="field">بداية الصفحة <small class="muted">(تظهر كمفتاح عند المراجعة — تُملأ تلقائياً)</small>
          <input type="text" id="edCue" class="quran-input one" value="${esc(draft.cue)}">
        </label>
      </section>

      <details class="ed-sec ayah-sec" ${draft.ayahs.some(hasKeys) ? "open" : ""}>
        <summary><h3>📖 آيات الصفحة — مفتاح لكل آية <small class="muted">(اختياري)</small></h3></summary>
        <div class="row gap-s wrap ayah-tools">
          <button type="button" class="btn small" data-action="fetch">🌐 جلب الآيات</button>
          <button type="button" class="btn small" data-action="manual">✏️ كتابة يدوية</button>
        </div>
        <div id="edManual" hidden>
          <textarea id="edManualText" rows="6" class="quran-input" placeholder="اكتب أو الصق الآيات: آية في كل سطر، ويمكن إضافة رقمها في آخرها هكذا ﴿5﴾"></textarea>
          <button type="button" class="btn small" data-action="apply-manual">تطبيق النص</button>
        </div>
        <p class="hint">اضغط <b>«＋ مفتاح»</b> بجانب أي آية لتضيف لها <b>كلمة ربط</b> أو <b>صورة ذهنية</b> أو <b>صورة</b>. تظهر لك عند التسميع «آية بآية».</p>
        <ol class="ayah-list" id="edAyahs">${ayahListHTML()}</ol>
      </details>

      ${isNew ? `<label class="field">⏰ أول مراجعة
        <select id="edFirst">
          <option value="1" selected>غداً إن شاء الله (موصى به)</option>
          <option value="0">اليوم (بعد بضع ساعات)</option>
        </select>
      </label>` : ""}
    </div>
    <footer class="sheet-foot">
      ${isNew ? "" : `<button type="button" class="btn danger" data-action="delete">🗑️ حذف</button>`}
      <span class="grow"></span>
      <button type="button" class="btn" data-action="close">إلغاء</button>
      <button type="submit" class="btn primary">💾 حفظ</button>
    </footer>
  </form>`;
}

function metaHTML(p) {
  if (!(p >= 1 && p <= TOTAL_PAGES)) return `<span class="muted">أدخل رقم الصفحة في مصحف المدينة (1 – ${TOTAL_PAGES})</span>`;
  const exists = isNew && pages.has(p);
  return `<b>${surahLabel(p)}</b>
    <span>الجزء ${juzOfPage(p)} · الحزب ${hizbOfPage(p)} · ${ayahCountOnPage(p)} ${ayahCountOnPage(p) <= 10 && ayahCountOnPage(p) >= 3 ? "آيات" : "آية"}</span>
    <span class="muted small">${rangeLabel(p)}</span>
    ${exists ? `<span class="warn">⚠️ هذه الصفحة مسجلة مسبقاً <button type="button" class="link-btn" data-action="open-existing">فتحها للتعديل</button></span>` : ""}`;
}

const hasKeys = x => !!(x.hook || x.note || x.img);

function ayahListHTML() {
  if (!draft.ayahs.length) return `<li class="empty muted">لا توجد آيات بعد — اضغط «جلب الآيات» أو اكتبها يدوياً.</li>`;
  let html = "";
  let lastSurah = null;
  draft.ayahs.forEach((x, i) => {
    if (x.s && x.a === 1 && x.s !== lastSurah) html += `<li class="surah-sep">سورة ${SURAH_NAMES[x.s - 1]}</li>`;
    lastSurah = x.s;
    const has = hasKeys(x);
    html += `<li class="ayah-row ${has ? "open" : ""}" data-i="${i}">
      <div class="ayah-line">
        <span class="quran-inline">${esc(x.text)} ${x.a ? `<span class="marker">﴿${arDigits(x.a)}﴾</span>` : ""}</span>
        <button type="button" class="key-toggle ${has ? "has" : ""}" data-action="toggle-row">${has ? "🔑" : "＋ مفتاح"}</button>
      </div>
      <div class="ayah-keys">
        <input type="text" data-field="hook" data-i="${i}" placeholder="🔗 كلمة الربط لهذه الآية" value="${esc(x.hook)}">
        <input type="text" data-field="note" data-i="${i}" placeholder="🧠 صورة ذهنية / ملاحظة" value="${esc(x.note)}">
        <div class="row gap-s">${
          x.img
            ? `<img class="thumb" src="${x.img}" alt=""><button type="button" class="btn small danger" data-action="rm-ayah-img" data-i="${i}">حذف الصورة</button>`
            : `<label class="btn small">🖼️ صورة للآية<input type="file" accept="image/*" hidden data-field="ayah-image" data-i="${i}"></label>`
        }</div>
      </div>
    </li>`;
  });
  return html;
}

// kind: "maps" (الخريطة الذهنية) أو "images" (صور التربيط) — كل صورة { src, url?, time? }
function imagesHTML(kind) {
  const toMap = kind === "images";
  return draft[kind]
    .map((p, i) => `<div class="photo-row">
      <div class="img-wrap"><img src="${p.src}" alt="">
        <button type="button" class="rm" data-action="rm-img" data-kind="${kind}" data-i="${i}" aria-label="حذف">✕</button>
      </div>
      <div class="photo-fields">
        <input type="url" inputmode="url" data-field="p-url" data-kind="${kind}" data-i="${i}" value="${esc(p.url)}"
          placeholder="🔗 رابط المصدر (يوتيوب، إنستغرام، فيسبوك…)">
        <input type="text" data-field="p-time" data-kind="${kind}" data-i="${i}" value="${esc(p.time)}"
          placeholder="⏱️ الوقت في الفيديو، مثل 12:35">
        <small class="src-hint" data-hint="${kind}-${i}">${sourceHint(p)}</small>
        <button type="button" class="link-btn mv-btn" data-action="mv-img" data-kind="${kind}" data-i="${i}">⇄ نقل ${toMap ? "إلى الخريطة الذهنية" : "إلى صور التربيط"}</button>
      </div>
    </div>`)
    .join("");
}

// ما الذي سيفتحه الرابط؟ (يظهر تحت الحقلين)
function sourceHint(p) {
  const url = (p.url || "").trim();
  const time = (p.time || "").trim();
  if (!url && !time) return "";
  if (time && parseTime(time) === null) return `<span class="warn">⚠️ اكتب الوقت هكذا: 12:35 أو 1:02:03</span>`;
  if (!url) return `⏱️ ${formatTime(parseTime(time))}`;
  const link = sourceLink(url, time);
  if (!link) return `<span class="warn">⚠️ الرابط غير صحيح — انسخه كاملاً من التطبيق (زر «مشاركة» ← «نسخ الرابط»)</span>`;
  if (link.time && link.timeInLink) return `✓ ${link.platform} — سيفتح الفيديو مباشرة عند ${link.time}`;
  if (link.time) return `✓ ${link.platform} — الوقت ${link.time} سيظهر بجانب الرابط`;
  return `✓ ${link.platform}`;
}

// تنظيف الحقول قبل الحفظ
function cleanPhoto(p) {
  const o = { src: p.src };
  const url = (p.url || "").trim();
  const time = (p.time || "").trim();
  if (url) o.url = safeUrl(url) || url;
  if (time) o.time = parseTime(time) === null ? time : formatTime(parseTime(time));
  return o;
}

function renderImages() {
  $("#edMaps").innerHTML = imagesHTML("maps");
  $("#edImages").innerHTML = imagesHTML("images");
}

function setStatus(msg, kind = "") {
  const el = $("#edStatus");
  if (!el) return;
  el.className = "status " + kind;
  el.innerHTML = msg;
}

// ---------- جلب الآيات ----------
async function loadText(p) {
  const token = ++fetchToken;
  setStatus("⏳ جارٍ جلب آيات الصفحة…");
  try {
    const ayahs = await getPageAyahs(p);
    if (token !== fetchToken || +draft.page !== p) return;
    // نحتفظ بالمفاتيح المكتوبة سابقاً لنفس الآيات
    const old = new Map(draft.ayahs.filter(x => x.s).map(x => [`${x.s}:${x.a}`, x]));
    draft.ayahs = ayahs.map(a => ({ ...(old.get(`${a.s}:${a.a}`) || {}), ...a }));
    const cue = firstWords(draft.ayahs[0]?.text, 5);
    if (!draft.cue || draft.cue === autoCue) {
      draft.cue = cue;
      const el = $("#edCue");
      if (el) el.value = cue;
    }
    autoCue = cue;
    $("#edAyahs").innerHTML = ayahListHTML();
    setStatus(`✓ تم جلب ${ayahs.length} آية`, "ok");
  } catch {
    if (token !== fetchToken) return;
    setStatus("⚠️ تعذر الجلب (تحقق من الاتصال بالإنترنت). يمكنك كتابة الآيات يدوياً.", "warn");
  }
}

// ---------- الحفظ والحذف ----------
function cleanAyah(x) {
  const o = { ...x };
  for (const k of ["hook", "note"]) {
    o[k] = (o[k] || "").trim();
    if (!o[k]) delete o[k];
  }
  if (!o.img) delete o.img;
  return o;
}

async function save() {
  const p = +draft.page;
  if (!(p >= 1 && p <= TOTAL_PAGES)) {
    setStatus(`⚠️ رقم الصفحة يجب أن يكون بين 1 و ${TOTAL_PAGES}`, "warn");
    $("#edPage").focus();
    return;
  }
  const existing = pages.get(p);
  if (isNew && existing && !confirm(`الصفحة ${p} مسجلة مسبقاً. استبدال آياتها ومفاتيحها بهذه (مع الاحتفاظ بتقدم المراجعة)؟`)) return;
  const firstReview = +($("#edFirst")?.value ?? 1);
  const rec = {
    ...(existing || {}),
    page: p,
    ayahs: draft.ayahs.map(cleanAyah),
    cue: (draft.cue || "").trim() || firstWords(draft.ayahs[0]?.text, 5),
    links: draft.links,
    notes: (draft.notes || "").trim(),
    images: draft.images.map(cleanPhoto),
    maps: draft.maps.map(cleanPhoto),
    createdAt: existing?.createdAt || new Date().toISOString(),
    srs: existing?.srs || newCard(todayStr(), firstReview),
  };
  try {
    await savePage(rec);
  } catch {
    toast("تعذر الحفظ — ربما مساحة التخزين ممتلئة");
    return;
  }
  dlg().close();
  refresh();
  // نعرض الصفحة المحفوظة مباشرة حتى ترى صورك ومفاتيحك
  if (current() !== "review") openDetail(p);
  toast(isNew ? `تم تسجيل الصفحة ${p} ✓ ${firstReview ? "أول مراجعة غداً" : "ستظهر في مراجعة اليوم"} إن شاء الله` : "تم الحفظ ✓");
}

async function remove() {
  const p = +draft.page;
  if (!confirm(`حذف الصفحة ${p} مع مفاتيحها وكل تقدم مراجعتها؟`)) return;
  await removePage(p);
  dlg().close();
  toast("تم الحذف");
  refresh();
}

async function addImages(files, onEach) {
  let ok = 0;
  let failed = 0;
  setStatus("⏳ جارٍ تجهيز الصورة…");
  for (const f of files) {
    try {
      onEach(await compressImage(f));
      ok++;
    } catch {
      failed++;
    }
  }
  if (failed) setStatus(`⚠️ تعذر قراءة ${failed} صورة (ربما صيغتها غير مدعومة). جرّب صورة JPG أو لقطة شاشة.`, "warn");
  else if (ok) setStatus(`✓ أضيفت ${ok === 1 ? "الصورة" : ok + " صور"} — لا تنسَ الضغط على «حفظ»`, "ok");
}

// ---------- الأحداث ----------
const d = dlg();

delegate(d, {
  close: () => d.close(),
  fetch: () => {
    const p = +draft.page;
    if (p >= 1 && p <= TOTAL_PAGES) loadText(p);
    else setStatus("⚠️ أدخل رقم صفحة صحيح أولاً", "warn");
  },
  manual: () => {
    const box = $("#edManual");
    box.hidden = !box.hidden;
    if (!box.hidden) {
      $("#edManualText").value = ayahsToText(draft.ayahs);
      $("#edManualText").focus();
    }
  },
  "apply-manual": () => {
    const parsed = parseManualText($("#edManualText").value);
    draft.ayahs = parsed.map((x, i) => {
      const o = draft.ayahs[i];
      return o ? { ...o, ...x, s: o.a === x.a ? o.s : null } : x;
    });
    if (!draft.cue || draft.cue === autoCue) {
      draft.cue = autoCue = firstWords(draft.ayahs[0]?.text, 5);
      $("#edCue").value = draft.cue;
    }
    $("#edAyahs").innerHTML = ayahListHTML();
    $("#edManual").hidden = true;
    setStatus(`✓ ${draft.ayahs.length} آية`, "ok");
  },
  "toggle-row": el => el.closest(".ayah-row").classList.toggle("open"),
  "rm-ayah-img": el => {
    delete draft.ayahs[+el.dataset.i].img;
    $("#edAyahs").innerHTML = ayahListHTML();
  },
  "rm-img": el => {
    draft[el.dataset.kind].splice(+el.dataset.i, 1);
    renderImages();
  },
  "mv-img": el => {
    const from = el.dataset.kind;
    const to = from === "maps" ? "images" : "maps";
    const [src] = draft[from].splice(+el.dataset.i, 1);
    draft[to].push(src);
    renderImages();
    setStatus(`✓ نُقلت الصورة إلى ${to === "maps" ? "الخريطة الذهنية" : "صور التربيط"} — اضغط «حفظ»`, "ok");
  },
  "open-existing": () => openEditor(+draft.page),
  delete: remove,
});

d.addEventListener("submit", e => {
  e.preventDefault();
  save();
});

d.addEventListener("input", e => {
  const t = e.target;
  if (t.id === "edPage") {
    clearTimeout(pageTimer);
    pageTimer = setTimeout(() => {
      const p = +t.value;
      draft.page = t.value ? p : "";
      $("#edMeta").innerHTML = metaHTML(p);
      setStatus("");
      if (p >= 1 && p <= TOTAL_PAGES) {
        draft.ayahs = [];
        $("#edAyahs").innerHTML = ayahListHTML();
        loadText(p);
      }
    }, 450);
  } else if (t.id === "edCue") draft.cue = t.value;
  else if (t.id === "edLinks") draft.links = lines(t.value);
  else if (t.id === "edNotes") draft.notes = t.value;
  else if (t.dataset.field === "p-url" || t.dataset.field === "p-time") {
    const p = draft[t.dataset.kind][+t.dataset.i];
    p[t.dataset.field === "p-url" ? "url" : "time"] = t.value;
    const hint = dlg().querySelector(`[data-hint="${t.dataset.kind}-${t.dataset.i}"]`);
    if (hint) hint.innerHTML = sourceHint(p);
  } else if (t.dataset.field === "hook" || t.dataset.field === "note") {
    draft.ayahs[+t.dataset.i][t.dataset.field] = t.value;
    const row = t.closest(".ayah-row");
    const btn = row.querySelector(".key-toggle");
    const has = hasKeys(draft.ayahs[+t.dataset.i]);
    btn.classList.toggle("has", has);
    btn.textContent = has ? "🔑" : "＋ مفتاح";
  }
});

d.addEventListener("change", async e => {
  const t = e.target;
  if (t.id === "edImageInput" || t.id === "edMapInput") {
    const kind = t.id === "edMapInput" ? "maps" : "images";
    await addImages(t.files, src => draft[kind].push({ src }));
    t.value = "";
    renderImages();
  } else if (t.dataset.field === "ayah-image" && t.files[0]) {
    const i = +t.dataset.i;
    await addImages([t.files[0]], src => (draft.ayahs[i].img = src));
    $("#edAyahs").innerHTML = ayahListHTML();
  }
});
