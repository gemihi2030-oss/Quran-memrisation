// 💡 تدبر الآيات (لكل صفحة) و 💚 التحفيز و 💎 الحكم والأقوال (لكل التطبيق)
// نافذة واحدة للإضافة/التعديل: نص + صورة (لقطة شاشة لمنشور مثلاً) + المصدر (رابط أو اسم كتاب) + الوقت في الفيديو
import { $, esc, toast, delegate, compressImage, viewToggleHTML } from "../util.js";
import { pages, savePage, motivations, saveMotivations, hikam, saveHikam, newId } from "../state.js";
import { Store } from "../db.js";
import { firstWords, arDigits, SURAH_NAMES } from "../quran.js";
import { safeUrl, parseTime, formatTime, sourceLink } from "../media.js";
import { todayStr, parseDate } from "../srs.js";
import { refresh } from "../router.js";
import { sourceButtonHTML } from "./cards.js";
import { openGallery } from "./lightbox.js";

const dlg = () => $("#noteDialog");
const listDlg = () => $("#motivationDialog");
let ctx = null; // { kind: "tadabbur" | "motivation" | "hikma", page, isNew, draft, onSaved }

// القوائم العامة: نفس النافذة ونفس طريقة العرض، ولكلٍّ قائمته ومفتاح حفظه
export const COLLECTIONS = {
  motivation: {
    list: motivations, save: saveMotivations, icon: "💚", title: "التحفيز", today: "تحفيز اليوم", one: "تحفيز",
    add: "＋ إضافة تحفيز", empty: "لا يوجد شيء بعد. أضف أول ما يحفّزك 💚",
    intro: "احفظ هنا ما يحفّزك على الحفظ والمراجعة: قصة، حديث، مقولة، صورة… سيظهر لك واحد كل يوم.",
  },
  hikma: {
    list: hikam, save: saveHikam, icon: "💎", title: "حكم وأقوال", today: "حكمة اليوم", one: "حكمة",
    add: "＋ إضافة حكمة", empty: "لا توجد حكم بعد. أضف أول حكمة أو قول أعجبك 💎",
    intro: "اجمع هنا الحكم والأقوال التي تعجبك: قول لصحابي أو عالم، أثر، بيت شعر… مكتوبة أو بصورتها. تظهر لك حكمة كل يوم.",
  },
};
const col = kind => COLLECTIONS[kind] || COLLECTIONS.motivation;

// ---------- عرض مشترك ----------
// المصدر: رابط ← زر يفتحه (يوتيوب على الوقت المحدد) · نص ← اسم كتاب
export function noteSourceHTML(item) {
  const src = (item.source || "").trim();
  if (!src && !item.time) return "";
  if (safeUrl(src) && sourceLink(src, item.time)) return sourceButtonHTML({ url: src, time: item.time });
  return `<span class="book-src">📚 ${esc(src)}${item.time ? ` · ⏱️ ${esc(item.time)}` : ""}</span>`;
}

const ayahLabel = t => (t.a ? `${t.s && t.s !== 0 ? `${SURAH_NAMES[t.s - 1]} · ` : ""}الآية ${arDigits(t.a)}` : "الصفحة كاملة");

export function sortedTadabbur(rec) {
  return [...(rec.tadabbur || [])].sort((x, y) => (x.s || 0) - (y.s || 0) || (x.a || 0) - (y.a || 0) || String(x.createdAt).localeCompare(String(y.createdAt)));
}

// طريقة العرض: display = "image" ← الصورة فقط (النص يبقى محفوظاً للبحث)، وإلا الصورة مع النص
export const showText = item => !!item.text && !(item.img && item.display === "image");

// زر سريع للتبديل بين «الصورة فقط» و«الصورة مع النص»
function displayToggleHTML(item, kind, page = "") {
  if (!item.img || !item.text) return "";
  const imageOnly = item.display === "image";
  return `<button type="button" class="chip-btn display-toggle" data-action="toggle-display" data-kind="${kind}" data-id="${item.id}" data-page="${page}">${imageOnly ? "📝 إظهار النص" : "🖼️ الصورة فقط"}</button>`;
}

export async function toggleDisplay(kind, id, page) {
  if (kind === "tadabbur") {
    const rec = pages.get(+page);
    const t = rec?.tadabbur.find(x => x.id === id);
    if (!t) return;
    if (t.display === "image") delete t.display;
    else t.display = "image";
    await savePage(rec);
  } else {
    const c = col(kind);
    const m = c.list.find(x => x.id === id);
    if (!m) return;
    if (m.display === "image") delete m.display;
    else m.display = "image";
    await c.save();
  }
}

// قائمة التدبرات في بطاقة الصفحة أو المراجعة
export function tadabburListHTML(rec, { editable = false } = {}) {
  return sortedTadabbur(rec)
    .map(t => {
      const ayah = t.a ? rec.ayahs.find(x => x.a === t.a && (!t.s || !x.s || x.s === t.s)) : null;
      return `<article class="tad">
        <div class="tad-head">
          <span class="chip sm">💡 ${ayahLabel(t)}</span>
          ${editable ? `<button type="button" class="icon-btn small" data-action="edit-tadabbur" data-id="${t.id}" aria-label="تعديل">✏️</button>` : ""}
        </div>
        ${ayah ? `<p class="quran-inline tad-ayah">${esc(firstWords(ayah.text, 8))}…</p>` : ""}
        ${showText(t) ? `<p class="tad-text clamp" data-action="expand">${esc(t.text)}</p>` : ""}
        ${t.img ? `<button type="button" class="tad-img" data-action="view-note-img" data-page="${rec.page}" data-id="${t.id}"><img src="${t.img}" alt="" loading="lazy"></button>` : ""}
        <div class="row between wrap">${noteSourceHTML(t)}${editable ? displayToggleHTML(t, "tadabbur", rec.page) : ""}</div>
      </article>`;
    })
    .join("");
}

// عنصر تحفيز أو حكمة · toggle: زر «الصورة فقط / إظهار النص» · editable: زر التعديل
// الحكمة: النص بشكل اقتباس + القائل
export function noteItemHTML(kind, m, { editable = false, toggle = false } = {}) {
  const quote = kind === "hikma";
  const text = showText(m)
    ? quote
      ? `<blockquote class="hikma-text clamp" data-action="expand">${esc(m.text)}</blockquote>`
      : `<p class="motiv-text clamp" data-action="expand">${esc(m.text)}</p>`
    : "";
  return `<article class="motiv-item${quote ? " hikma-item" : ""}">
    ${m.img ? `<button type="button" class="motiv-img" data-action="view-${kind}" data-id="${m.id}"><img src="${m.img}" alt="" loading="lazy"></button>` : ""}
    <div class="note-main">
      ${text}
      ${showText(m) ? "" : `<p class="note-snippet">${m.text ? esc(m.text) : "🖼️ صورة"}</p>`}
      ${quote && m.author ? `<p class="hikma-author">— ${esc(m.author)}</p>` : ""}
      <div class="row between wrap note-foot"><span class="note-src">${noteSourceHTML(m)}</span><span class="row gap-s">${toggle || editable ? displayToggleHTML(m, kind) : ""}${editable ? `<button type="button" class="icon-btn small" data-action="edit-${kind}" data-id="${m.id}" aria-label="تعديل">✏️</button>` : ""}</span></div>
    </div>
  </article>`;
}
export const motivationItemHTML = (m, opts) => noteItemHTML("motivation", m, opts);

// عنصر اليوم: يبدأ كل يوم بعنصر مختلف، والأزرار تتنقل بينها
const cursors = {};
export function currentItem(kind, step = 0) {
  const list = col(kind).list;
  const n = list.length;
  if (!n) return null;
  if (cursors[kind] == null) cursors[kind] = Math.floor(parseDate(todayStr()) / 86400000) % n;
  cursors[kind] = (((cursors[kind] + step) % n) + n) % n;
  return { item: list[cursors[kind]], index: cursors[kind], total: n };
}
export const currentMotivation = (step = 0) => currentItem("motivation", step);
export const randomMotivation = () => (motivations.length ? motivations[Math.floor(Math.random() * motivations.length)] : null);

// ---------- نافذة الإضافة / التعديل ----------
export function openNoteEditor({ kind, page = null, id = null, onSaved = null }) {
  let item = null;
  if (kind === "tadabbur") item = id ? pages.get(page)?.tadabbur.find(t => t.id === id) : null;
  else item = id ? col(kind).list.find(m => m.id === id) : null;
  ctx = {
    kind,
    page,
    onSaved,
    isNew: !item,
    draft: item ? structuredClone(item) : { id: newId(), text: "", author: "", img: null, source: "", time: "", s: null, a: null, createdAt: new Date().toISOString() },
  };
  render();
  dlg().showModal();
}

function render() {
  const { kind, page, isNew, draft } = ctx;
  const tad = kind === "tadabbur";
  const hik = kind === "hikma";
  const rec = tad ? pages.get(page) : null;
  const title = tad
    ? isNew ? `💡 تدبر جديد · الصفحة ${page}` : `💡 تعديل التدبر · الصفحة ${page}`
    : hik ? (isNew ? "💎 إضافة حكمة أو قول" : "💎 تعديل الحكمة")
    : isNew ? "💚 إضافة تحفيز" : "💚 تعديل التحفيز";
  const ayahOptions = rec?.ayahs?.length
    ? rec.ayahs
        .filter(x => x.a)
        .map(x => {
          const v = `${x.s || 0}:${x.a}`;
          const sel = draft.a === x.a && (!draft.s || draft.s === x.s) ? "selected" : "";
          return `<option value="${v}" ${sel}>الآية ${x.a} — ${esc(firstWords(x.text, 4))}…</option>`;
        })
        .join("")
    : "";

  dlg().innerHTML = `
  <form id="noteForm" novalidate>
    <header class="sheet-head">
      <h2>${title}</h2>
      <button type="button" class="icon-btn" data-action="close" aria-label="إغلاق">✕</button>
    </header>
    <div class="sheet-body">
      ${tad ? `<label class="field">الآية
        <select id="ntAyah">
          <option value="">📖 الصفحة كاملة</option>
          ${ayahOptions}
        </select>
        ${rec?.ayahs?.length ? "" : `<small class="muted">(سجّل آيات الصفحة لتختار آية بعينها)</small>`}
      </label>` : hik
        ? `<p class="muted small">قول لصحابي أو عالم، أثر، بيت شعر، حكمة… اكتبها، أو أضف صورتها، أو الاثنين معاً.</p>`
        : `<p class="muted small">قصة، حديث، مقولة، صورة… أي شيء يحفّزك على الحفظ والمراجعة. سيظهر لك في الرئيسية وبعد كل مراجعة.</p>`}
      <label class="field">${tad ? "التدبر" : hik ? "الحكمة / القول" : "النص"}
        <textarea id="ntText" rows="${hik ? 5 : 7}" placeholder="${tad ? "اكتب التدبر أو الصقه هنا (من منشور، كتاب، درس…)" : hik ? "اكتب الحكمة أو القول…" : "اكتب أو الصق الكلمات التي تحفّزك…"}">${esc(draft.text)}</textarea>
      </label>
      ${hik ? `<label class="field">✍️ القائل <small class="muted">(اختياري)</small>
        <input type="text" id="ntAuthor" value="${esc(draft.author)}" placeholder="مثلاً: ابن القيم، الحسن البصري، الشافعي…">
      </label>` : ""}
      <div class="field">🖼️ صورة <small class="muted">(اختياري — ${hik ? "صورة الحكمة أو تصميم لها" : "لقطة شاشة للمنشور مثلاً"})</small>
        <div id="ntImg">${imgHTML()}</div>
      </div>
      <label class="field">📚 المصدر <small class="muted">(رابط أو اسم كتاب / شيخ)</small>
        <input type="text" id="ntSource" value="${esc(draft.source)}" placeholder="رابط المنشور، أو: تفسير السعدي…">
      </label>
      <label class="field">⏱️ الوقت في الفيديو <small class="muted">(اختياري)</small>
        <input type="text" id="ntTime" value="${esc(draft.time)}" placeholder="12:35">
      </label>
      <p class="status" id="ntStatus">${hint()}</p>
    </div>
    <footer class="sheet-foot">
      ${isNew ? "" : `<button type="button" class="btn danger" data-action="delete">🗑️ حذف</button>`}
      <span class="grow"></span>
      <button type="button" class="btn" data-action="close">إلغاء</button>
      <button type="submit" class="btn primary">💾 حفظ</button>
    </footer>
  </form>`;
}

function imgHTML() {
  const { draft } = ctx;
  if (!draft.img) return `<label class="btn add-img">📷 إضافة صورة<input type="file" accept="image/*" hidden id="ntImgInput"></label>`;
  const imageOnly = draft.display === "image";
  return `<div class="img-wrap note-img"><img src="${draft.img}" alt=""><button type="button" class="rm" data-action="rm-note-img" aria-label="حذف">✕</button></div>
    <fieldset class="radios display-choice">
      <legend>طريقة العرض</legend>
      <label><input type="radio" name="ntDisplay" value="both" ${imageOnly ? "" : "checked"}> 🖼️+📝 الصورة مع النص</label>
      <label><input type="radio" name="ntDisplay" value="image" ${imageOnly ? "checked" : ""}> 🖼️ الصورة فقط <small class="muted">(النص يبقى محفوظاً للبحث)</small></label>
    </fieldset>`;
}

function hint() {
  const { source, time } = ctx.draft;
  const s = (source || "").trim();
  if (time && parseTime(time) === null) return `<span class="warn">⚠️ اكتب الوقت هكذا: 12:35</span>`;
  if (!s) return "";
  if (!safeUrl(s) || !/[./]/.test(s) || /\s/.test(s)) return `📚 ${esc(s)}`;
  const link = sourceLink(s, time);
  if (!link) return "";
  if (link.time && link.timeInLink) return `<span class="ok-text">✓ ${link.platform} — سيفتح عند ${link.time}</span>`;
  return `<span class="ok-text">✓ ${link.platform}</span>`;
}

async function save() {
  const { kind, page, draft, isNew } = ctx;
  const text = (draft.text || "").trim();
  if (!text && !draft.img) {
    $("#ntStatus").innerHTML = `<span class="warn">⚠️ اكتب نصاً أو أضف صورة</span>`;
    return;
  }
  const src = (draft.source || "").trim();
  const time = (draft.time || "").trim();
  const item = { id: draft.id, text, createdAt: draft.createdAt, updatedAt: new Date().toISOString() };
  if (draft.img) item.img = draft.img;
  if (draft.img && draft.display === "image") item.display = "image";
  if (kind === "hikma" && (draft.author || "").trim()) item.author = draft.author.trim();
  // رابط بلا مسافات ← نخزّنه كرابط كامل؛ غير ذلك ← اسم كتاب كما كُتب
  if (src) item.source = !/\s/.test(src) && /[./]/.test(src) && safeUrl(src) ? safeUrl(src) : src;
  if (time) item.time = parseTime(time) === null ? time : formatTime(parseTime(time));

  try {
    if (kind === "tadabbur") {
      const sel = $("#ntAyah")?.value || "";
      if (sel) {
        const [s, a] = sel.split(":").map(Number);
        item.a = a;
        if (s) item.s = s;
      }
      const rec = pages.get(page);
      const list = rec.tadabbur || (rec.tadabbur = []);
      const i = list.findIndex(t => t.id === item.id);
      if (i >= 0) list[i] = item;
      else list.push(item);
      await savePage(rec);
    } else {
      const c = col(kind);
      const i = c.list.findIndex(m => m.id === item.id);
      if (i >= 0) c.list[i] = item;
      else c.list.unshift(item);
      await c.save();
    }
  } catch {
    $("#ntStatus").innerHTML = `<span class="warn">⚠️ تعذر الحفظ — ربما المساحة ممتلئة</span>`;
    return;
  }
  dlg().close();
  toast(!isNew ? "تم الحفظ ✓" : kind === "tadabbur" ? "تمت إضافة التدبر ✓" : kind === "hikma" ? "تمت إضافة الحكمة 💎" : "تمت إضافة التحفيز 💚");
  refresh();
  ctx.onSaved?.();
}

async function remove() {
  const { kind, page, draft } = ctx;
  if (!confirm(kind === "tadabbur" ? "حذف هذا التدبر؟" : kind === "hikma" ? "حذف هذه الحكمة؟" : "حذف هذا التحفيز؟")) return;
  if (kind === "tadabbur") {
    const rec = pages.get(page);
    rec.tadabbur = (rec.tadabbur || []).filter(t => t.id !== draft.id);
    await savePage(rec);
  } else {
    const c = col(kind);
    const i = c.list.findIndex(m => m.id === draft.id);
    if (i >= 0) c.list.splice(i, 1);
    await c.save();
  }
  dlg().close();
  toast("تم الحذف");
  refresh();
  ctx.onSaved?.();
}

const d = dlg();
delegate(d, {
  close: () => d.close(),
  delete: remove,
  "rm-note-img": () => {
    ctx.draft.img = null;
    $("#ntImg").innerHTML = imgHTML();
  },
});
d.addEventListener("submit", e => {
  e.preventDefault();
  save();
});
d.addEventListener("input", e => {
  const t = e.target;
  if (t.id === "ntText") ctx.draft.text = t.value;
  else if (t.id === "ntAuthor") ctx.draft.author = t.value;
  else if (t.id === "ntSource" || t.id === "ntTime") {
    ctx.draft[t.id === "ntSource" ? "source" : "time"] = t.value;
    $("#ntStatus").innerHTML = hint();
  }
});
d.addEventListener("change", async e => {
  if (e.target.name === "ntDisplay") {
    ctx.draft.display = e.target.value;
    return;
  }
  if (e.target.id !== "ntImgInput" || !e.target.files[0]) return;
  $("#ntStatus").textContent = "⏳ جارٍ تجهيز الصورة…";
  try {
    ctx.draft.img = await compressImage(e.target.files[0], 1400, 0.8);
    $("#ntImg").innerHTML = imgHTML();
    $("#ntStatus").innerHTML = `<span class="ok-text">✓ أضيفت الصورة — لا تنسَ «حفظ»</span>`;
  } catch {
    $("#ntStatus").innerHTML = `<span class="warn">⚠️ تعذر قراءة الصورة. جرّب صورة JPG أو لقطة شاشة.</span>`;
  }
});

// ---------- قائمة كل العناصر (تحفيز أو حكم) ----------
let listKind = "motivation";
let listView = Store.get("notesView", "detail"); // detail = الصور كاملة · compact = صورة مصغّرة وسطران
export function openNoteList(kind = "motivation") {
  listKind = kind;
  renderList();
  if (!listDlg().open) listDlg().showModal();
  listDlg().querySelector(".sheet-body").scrollTop = 0;
}
export const openMotivationList = () => openNoteList("motivation");

function renderList() {
  const c = col(listKind);
  const y = listDlg().querySelector(".sheet-body")?.scrollTop || 0;
  listDlg().innerHTML = `
    <header class="sheet-head">
      <h2>${c.icon} ${c.title} (${c.list.length})</h2>
      <div class="row gap-s">
        ${c.list.length ? viewToggleHTML("note-view", listView) : ""}
        <button type="button" class="icon-btn" data-action="close" aria-label="إغلاق">✕</button>
      </div>
    </header>
    <div class="sheet-body note-list${listView === "compact" ? " compact" : ""}">
      ${c.list.length ? c.list.map(m => noteItemHTML(listKind, m, { editable: true })).join("") : `<p class="muted center">${c.empty}</p>`}
    </div>
    <footer class="sheet-foot">
      <span class="grow"></span>
      <button type="button" class="btn primary" data-action="add-note">${c.add}</button>
    </footer>`;
  listDlg().querySelector(".sheet-body").scrollTop = y;
}

const ld = listDlg();
const reList = () => ld.open && renderList();
delegate(ld, {
  close: () => ld.close(),
  "add-note": () => openNoteEditor({ kind: listKind, onSaved: reList }),
  "edit-motivation": el => openNoteEditor({ kind: "motivation", id: el.dataset.id, onSaved: reList }),
  "edit-hikma": el => openNoteEditor({ kind: "hikma", id: el.dataset.id, onSaved: reList }),
  "view-motivation": el => viewNote("motivation", el.dataset.id),
  "view-hikma": el => viewNote("hikma", el.dataset.id),
  "note-view": el => {
    listView = el.dataset.mode;
    Store.set("notesView", listView);
    renderList();
  },
  "toggle-display": async el => {
    await toggleDisplay(el.dataset.kind, el.dataset.id);
    renderList();
    refresh();
  },
  expand: el => el.classList.toggle("clamp"),
});

// ---------- عرض الصور بحجم الشاشة ----------
// كل صور القائمة في العارض، يبدأ من الصورة المضغوطة، وتتنقل بينها يميناً ويساراً
export function viewNote(kind, id) {
  const c = col(kind);
  const withImg = c.list.filter(m => m.img);
  const start = withImg.findIndex(m => m.id === id);
  if (start < 0) return;
  openGallery(
    withImg.map(m => ({
      src: m.img,
      caption: `${c.icon} ${c.one}${m.author ? ` · ${m.author}` : ""}`,
      note: showText(m) ? m.text : "",
      url: safeUrl(m.source) ? m.source : "",
      time: m.time,
    })),
    start
  );
}
export const viewMotivation = id => viewNote("motivation", id);

export function viewTadabburImage(page, id) {
  const t = pages.get(page)?.tadabbur.find(x => x.id === id);
  if (t?.img) openGallery([{ src: t.img, caption: `💡 تدبر · ${ayahLabel(t)} · الصفحة ${page}`, note: showText(t) ? t.text : "", url: safeUrl(t.source) ? t.source : "", time: t.time }]);
}
