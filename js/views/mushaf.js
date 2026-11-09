// تبويب «صفحاتي»:
//  📋 صفحاتي          بطاقات الصفحات المسجلة، مجمّعة حسب السورة مع تقدم حفظ كل سورة
//  🗺️ الخرائط الذهنية  كل صور الخريطة الذهنية للوجه في مكان واحد، حسب السورة
//  🔢 المصحف          خريطة الصفحات الـ 604 ملوّنة حسب قوة الحفظ
import { $, esc, delegate } from "../util.js";
import { pages, dueList } from "../state.js";
import { Store } from "../db.js";
import { TOTAL_PAGES, juzRange, surahLabel, normalizeArabic, firstSurahOfPage, SURAH_NAMES } from "../quran.js";
import { level, todayStr, isDue } from "../srs.js";
import { show } from "../router.js";
import { openEditor } from "./editor.js";
import { openRange } from "./range.js";
import { openDetail } from "./detail.js";
import { openGallery } from "./lightbox.js";
import { pageCardHTML, allImages, mapImages, linkImages, allLinks, lastTouched, surahProgress } from "./cards.js";

const root = () => $("#view-pages");
let mode = Store.get("pagesMode", "list"); // list | maps | grid
if (mode === "map") mode = "grid"; // اسم قديم
let gridFilter = "all";
let listFilter = "all";
let sort = Store.get("pagesSort", "surah"); // surah | recent | mushaf
let surahFilter = 0; // 0 = كل السور
let query = "";

export function renderMushaf() {
  if (mode === "grid") renderGrid();
  else if (mode === "maps") renderMaps();
  else renderList();
}

function headerHTML() {
  const nMaps = [...pages.values()].reduce((s, r) => s + mapImages(r).length, 0);
  const tab = (m, label) => `<button class="${mode === m ? "on" : ""}" data-action="mode" data-m="${m}" role="tab">${label}</button>`;
  return `
    <div class="seg three" role="tablist">
      ${tab("list", `📋 صفحاتي (${pages.size})`)}
      ${tab("maps", `🗺️ الخرائط (${nMaps})`)}
      ${tab("grid", "🔢 المصحف")}
    </div>
    <div class="add-row">
      <button class="btn primary" data-action="add">＋ تسجيل صفحة</button>
      <button class="btn" data-action="range">＋ عدة صفحات</button>
    </div>`;
}

// السور التي سجّلت منها صفحات (مرتبة حسب المصحف)
function surahsWithPages(pred = () => true) {
  const set = new Set();
  for (const r of pages.values()) if (pred(r)) set.add(firstSurahOfPage(r.page));
  return [...set].sort((a, b) => a - b);
}

function surahSelectHTML(id, list) {
  return `<select id="${id}" class="mini-select" aria-label="السورة">
    <option value="0">📖 كل السور</option>
    ${list.map(s => `<option value="${s}" ${surahFilter === s ? "selected" : ""}>سورة ${SURAH_NAMES[s - 1]}</option>`).join("")}
  </select>`;
}

function surahHeadHTML(s, extra = "") {
  const pr = surahProgress(s);
  return `<div class="surah-group">
    <div class="row between"><b>📖 سورة ${pr.name}</b><span class="muted small">${pr.n} / ${pr.total} صفحة${extra}</span></div>
    <div class="progress thin"><div class="bar" style="width:${pr.pct}%"></div></div>
  </div>`;
}

// ---------- القائمة ----------
const LIST_FILTERS = [
  ["all", "الكل", () => true],
  ["maps", "🗺️ فيها خريطة ذهنية", r => mapImages(r).length > 0],
  ["images", "🖼️ فيها صور تربيط", r => linkImages(r).length > 0],
  ["links", "🔗 كلمات ربط", r => allLinks(r).length > 0],
  ["due", "⏰ المستحقة", r => isDue(r.srs)],
];

function matchQuery(r, q) {
  if (!q) return true;
  if (/^\d+$/.test(q)) return r.page === +q;
  const hay = normalizeArabic([surahLabel(r.page), ...allLinks(r), r.notes, ...r.ayahs.map(x => x.note || "")].join(" "));
  return hay.includes(normalizeArabic(q));
}

function filteredList() {
  const f = LIST_FILTERS.find(x => x[0] === listFilter)[2];
  const list = [...pages.values()].filter(
    r => f(r) && matchQuery(r, query.trim()) && (!surahFilter || firstSurahOfPage(r.page) === surahFilter)
  );
  if (sort === "recent") list.sort((a, b) => lastTouched(b).localeCompare(lastTouched(a)) || a.page - b.page);
  else list.sort((a, b) => a.page - b.page);
  return list;
}

function listBodyHTML() {
  if (!pages.size) {
    return `<div class="empty-state">
      <div class="big-emoji">📖</div>
      <p>لم تسجّل أي صفحة بعد.</p>
      <p class="muted small">اضغط «＋ تسجيل صفحة»، اكتب رقمها، وأضف خريطتها الذهنية وصور التربيط وكلمات الربط. ستظهر هنا دائماً.</p>
    </div>`;
  }
  const list = filteredList();
  if (!list.length) return `<p class="muted center">لا توجد صفحات تطابق البحث.</p>`;
  const t = todayStr();
  if (sort !== "surah") return list.map(r => pageCardHTML(r, t)).join("");
  // مجمّعة حسب السورة
  let html = "";
  let cur = 0;
  for (const r of list) {
    const s = firstSurahOfPage(r.page);
    if (s !== cur) {
      html += surahHeadHTML(s);
      cur = s;
    }
    html += pageCardHTML(r, t);
  }
  return html;
}

function renderList() {
  const all = [...pages.values()];
  const filters = LIST_FILTERS.map(([k, label, f]) => {
    const n = all.filter(f).length;
    return `<button class="chip-btn ${listFilter === k ? "on" : ""}" data-action="list-filter" data-f="${k}">${label} (${n})</button>`;
  }).join("");
  root().innerHTML = `
    <div class="card">
      ${headerHTML()}
      ${pages.size ? `
      <input type="search" id="pageSearch" class="search" placeholder="🔎 ابحث برقم الصفحة، أو سورة، أو كلمة ربط…" value="${esc(query)}">
      <div class="filters toolbar">${filters}</div>
      <div class="row gap-s wrap">
        ${surahSelectHTML("surahFilter", surahsWithPages())}
        <select id="pageSort" class="mini-select" aria-label="الترتيب">
          <option value="surah" ${sort === "surah" ? "selected" : ""}>حسب السورة</option>
          <option value="recent" ${sort === "recent" ? "selected" : ""}>الأحدث أولاً</option>
          <option value="mushaf" ${sort === "mushaf" ? "selected" : ""}>ترتيب المصحف</option>
        </select>
      </div>` : ""}
    </div>
    <div class="plist" id="plist">${listBodyHTML()}</div>`;
}

// ---------- الخرائط الذهنية في مكان واحد ----------
function mapItems() {
  const items = [];
  const recs = [...pages.values()]
    .filter(r => mapImages(r).length && (!surahFilter || firstSurahOfPage(r.page) === surahFilter))
    .sort((a, b) => a.page - b.page);
  for (const r of recs) {
    for (const im of mapImages(r)) {
      items.push({ src: im.src, page: r.page, surah: firstSurahOfPage(r.page), caption: `الصفحة ${r.page} · ${surahLabel(r.page)}` });
    }
  }
  return items;
}

function renderMaps() {
  const items = mapItems();
  const withMaps = surahsWithPages(r => mapImages(r).length > 0);
  let body = "";
  if (!items.length) {
    body = `<div class="empty-state">
      <div class="big-emoji">🗺️</div>
      <p>${surahFilter ? "لا توجد خرائط ذهنية في هذه السورة بعد." : "لم تضف أي خريطة ذهنية بعد."}</p>
      <p class="muted small">افتح صفحة ← «✏️ تعديل» ← «📷 إضافة خريطة ذهنية». ستُجمع كل خرائطك هنا مرتبة حسب السورة.</p>
    </div>`;
  } else {
    let cur = 0;
    let open = false;
    items.forEach((it, i) => {
      if (it.surah !== cur) {
        if (open) body += `</div>`;
        body += surahHeadHTML(it.surah) + `<div class="maps-grid">`;
        cur = it.surah;
        open = true;
      }
      body += `<button type="button" class="map-tile" data-action="view-map" data-i="${i}">
        <img src="${it.src}" alt="" loading="lazy"><span>ص ${it.page}</span></button>`;
    });
    if (open) body += `</div>`;
  }
  root().innerHTML = `
    <div class="card">
      ${headerHTML()}
      ${withMaps.length > 1 || surahFilter ? `<div class="row gap-s toolbar">${surahSelectHTML("mapSurahFilter", withMaps)}</div>` : ""}
      ${items.length ? `<p class="muted small">اضغط على أي خريطة لعرضها بحجم الشاشة، ثم اسحب يميناً ويساراً للتنقل بينها.</p>` : ""}
    </div>
    <div class="card maps-card">${body}</div>`;
}

// ---------- خريطة المصحف (604) ----------
const LEGEND = [
  ["none", "غير محفوظة"],
  ["new", "جديدة"],
  ["due", "مستحقة"],
  ["weak", "قيد التثبيت"],
  ["mid", "متوسطة"],
  ["strong", "راسخة"],
];

const matchesGrid = (lvl, f) =>
  f === "all" || (f === "due" && lvl === "due") || (f === "saved" && lvl !== "none") || (f === "none" && lvl === "none");

function renderGrid() {
  const t = todayStr();
  const due = dueList(t).length;
  const filters = [
    ["all", `الكل`],
    ["due", `المستحقة (${due})`],
    ["saved", `المحفوظة (${pages.size})`],
    ["none", `غير المحفوظة (${TOTAL_PAGES - pages.size})`],
  ];

  let grid = "";
  for (let j = 1; j <= 30; j++) {
    const [a, b] = juzRange(j);
    let n = 0;
    let cells = "";
    for (let p = a; p <= b; p++) {
      const rec = pages.get(p);
      if (rec) n++;
      const lvl = rec ? level(rec.srs, t) : "none";
      const mark = rec && allImages(rec).length ? " has-img" : "";
      cells += `<button class="cell lv-${lvl}${mark}${matchesGrid(lvl, gridFilter) ? "" : " dim"}" data-action="cell" data-page="${p}" title="صفحة ${p} — ${surahLabel(p)}">${p}</button>`;
    }
    grid += `<div class="juz-head" id="juz-${j}"><b>الجزء ${j}</b><span class="muted small">${n} / ${b - a + 1}</span></div>${cells}`;
  }

  root().innerHTML = `
    <div class="card">
      ${headerHTML()}
      <div class="row gap-s wrap toolbar">
        <input type="number" id="gotoPage" class="goto" min="1" max="${TOTAL_PAGES}" inputmode="numeric" placeholder="🔎 رقم صفحة">
        <div class="filters">${filters
          .map(([k, label]) => `<button class="chip-btn ${gridFilter === k ? "on" : ""}" data-action="filter" data-f="${k}">${label}</button>`)
          .join("")}</div>
      </div>
      <div class="legend">${LEGEND.map(([k, label]) => `<span><i class="lv-${k}"></i>${label}</span>`).join("")}<span><i class="lv-mid has-img-sample"></i>فيها صور</span></div>
      <div class="grid">${grid}</div>
    </div>`;
}

function openPage(p) {
  if (!(p >= 1 && p <= TOTAL_PAGES)) return;
  if (pages.has(p)) openDetail(p);
  else openEditor(p);
}

function setMode(m) {
  mode = m;
  Store.set("pagesMode", mode);
}

export function scrollToJuz(j) {
  setMode("grid");
  show("pages");
  requestAnimationFrame(() => $("#juz-" + j)?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

// فتح «صفحاتي»، اختيارياً على سورة معيّنة
export function showPagesList({ surah = 0, view = "list" } = {}) {
  setMode(view);
  surahFilter = surah;
  query = "";
  listFilter = "all";
  show("pages");
}

delegate(root(), {
  mode: el => {
    setMode(el.dataset.m);
    renderMushaf();
  },
  add: () => openEditor(),
  range: () => openRange(),
  filter: el => {
    gridFilter = el.dataset.f;
    renderGrid();
  },
  "list-filter": el => {
    listFilter = el.dataset.f;
    renderList();
  },
  cell: el => openPage(+el.dataset.page),
  "open-page": el => openDetail(+el.dataset.page),
  "view-map": el => openGallery(mapItems(), +el.dataset.i, { onOpenPage: p => openDetail(p) }),
});

root().addEventListener("input", e => {
  if (e.target.id === "pageSearch") {
    query = e.target.value;
    $("#plist").innerHTML = listBodyHTML();
  }
});

root().addEventListener("change", e => {
  const t = e.target;
  if (t.id === "pageSort") {
    sort = t.value;
    Store.set("pagesSort", sort);
    $("#plist").innerHTML = listBodyHTML();
  } else if (t.id === "surahFilter") {
    surahFilter = +t.value;
    $("#plist").innerHTML = listBodyHTML();
  } else if (t.id === "mapSurahFilter") {
    surahFilter = +t.value;
    renderMaps();
  }
});

root().addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  if (e.target.id === "gotoPage") {
    e.preventDefault(); // حتى لا يُضغط زر الإغلاق في النافذة التي ستُفتح بنفس الضغطة
    const p = +e.target.value;
    const cell = root().querySelector(`.cell[data-page="${p}"]`);
    if (cell) {
      cell.scrollIntoView({ behavior: "smooth", block: "center" });
      cell.classList.add("flash");
      setTimeout(() => cell.classList.remove("flash"), 1500);
    }
    openPage(p);
  } else if (e.target.matches(".pcard")) {
    e.preventDefault();
    openDetail(+e.target.dataset.page);
  }
});
