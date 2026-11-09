// تبويب «صفحاتي»: قائمة الصفحات المسجلة كبطاقات (بصورها وكلمات ربطها) + خريطة المصحف (604 صفحة)
import { $, esc, delegate } from "../util.js";
import { pages, dueList } from "../state.js";
import { Store } from "../db.js";
import { TOTAL_PAGES, juzRange, surahLabel, normalizeArabic } from "../quran.js";
import { level, todayStr, isDue } from "../srs.js";
import { show } from "../router.js";
import { openEditor } from "./editor.js";
import { openRange } from "./range.js";
import { openDetail } from "./detail.js";
import { pageCardHTML, allImages, allLinks, lastTouched } from "./cards.js";

const root = () => $("#view-pages");
let mode = Store.get("pagesMode", "list"); // list | map
let mapFilter = "all";
let listFilter = "all";
let sort = "recent";
let query = "";

export function renderMushaf() {
  if (mode === "map") renderMap();
  else renderList();
}

function headerHTML() {
  return `
    <div class="seg" role="tablist">
      <button class="${mode === "list" ? "on" : ""}" data-action="mode" data-m="list" role="tab">📋 صفحاتي (${pages.size})</button>
      <button class="${mode === "map" ? "on" : ""}" data-action="mode" data-m="map" role="tab">🗺️ الخريطة</button>
    </div>
    <div class="add-row">
      <button class="btn primary" data-action="add">＋ تسجيل صفحة</button>
      <button class="btn" data-action="range">＋ عدة صفحات</button>
    </div>`;
}

// ---------- القائمة ----------
const LIST_FILTERS = [
  ["all", "الكل", () => true],
  ["images", "🖼️ فيها صور", r => allImages(r).length > 0],
  ["links", "🔗 فيها كلمات ربط", r => allLinks(r).length > 0],
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
  const list = [...pages.values()].filter(r => f(r) && matchQuery(r, query.trim()));
  if (sort === "mushaf") list.sort((a, b) => a.page - b.page);
  else list.sort((a, b) => lastTouched(b).localeCompare(lastTouched(a)) || a.page - b.page);
  return list;
}

function listBodyHTML() {
  if (!pages.size) {
    return `<div class="empty-state">
      <div class="big-emoji">📖</div>
      <p>لم تسجّل أي صفحة بعد.</p>
      <p class="muted small">اضغط «＋ تسجيل صفحة»، اكتب رقمها، وأضف صورها وكلمات الربط. ستظهر هنا دائماً.</p>
    </div>`;
  }
  const list = filteredList();
  if (!list.length) return `<p class="muted center">لا توجد صفحات تطابق البحث.</p>`;
  const t = todayStr();
  return list.map(r => pageCardHTML(r, t)).join("");
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
      <div class="row between wrap toolbar">
        <div class="filters">${filters}</div>
        <select id="pageSort" class="mini-select" aria-label="الترتيب">
          <option value="recent" ${sort === "recent" ? "selected" : ""}>الأحدث أولاً</option>
          <option value="mushaf" ${sort === "mushaf" ? "selected" : ""}>ترتيب المصحف</option>
        </select>
      </div>` : ""}
    </div>
    <div class="plist" id="plist">${listBodyHTML()}</div>`;
}

// ---------- الخريطة ----------
const LEGEND = [
  ["none", "غير محفوظة"],
  ["new", "جديدة"],
  ["due", "مستحقة"],
  ["weak", "قيد التثبيت"],
  ["mid", "متوسطة"],
  ["strong", "راسخة"],
];

const matchesMap = (lvl, f) =>
  f === "all" || (f === "due" && lvl === "due") || (f === "saved" && lvl !== "none") || (f === "none" && lvl === "none");

function renderMap() {
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
      cells += `<button class="cell lv-${lvl}${mark}${matchesMap(lvl, mapFilter) ? "" : " dim"}" data-action="cell" data-page="${p}" title="صفحة ${p} — ${surahLabel(p)}">${p}</button>`;
    }
    grid += `<div class="juz-head" id="juz-${j}"><b>الجزء ${j}</b><span class="muted small">${n} / ${b - a + 1}</span></div>${cells}`;
  }

  root().innerHTML = `
    <div class="card">
      ${headerHTML()}
      <div class="row gap-s wrap toolbar">
        <input type="number" id="gotoPage" class="goto" min="1" max="${TOTAL_PAGES}" inputmode="numeric" placeholder="🔎 رقم صفحة">
        <div class="filters">${filters
          .map(([k, label]) => `<button class="chip-btn ${mapFilter === k ? "on" : ""}" data-action="filter" data-f="${k}">${label}</button>`)
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

export function scrollToJuz(j) {
  mode = "map";
  Store.set("pagesMode", mode);
  show("pages");
  requestAnimationFrame(() => $("#juz-" + j)?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

export function showPagesList() {
  mode = "list";
  Store.set("pagesMode", mode);
  show("pages");
}

delegate(root(), {
  mode: el => {
    mode = el.dataset.m;
    Store.set("pagesMode", mode);
    renderMushaf();
  },
  add: () => openEditor(),
  range: () => openRange(),
  filter: el => {
    mapFilter = el.dataset.f;
    renderMap();
  },
  "list-filter": el => {
    listFilter = el.dataset.f;
    renderList();
  },
  cell: el => openPage(+el.dataset.page),
  "open-page": el => openDetail(+el.dataset.page),
});

root().addEventListener("input", e => {
  if (e.target.id === "pageSearch") {
    query = e.target.value;
    $("#plist").innerHTML = listBodyHTML();
  }
});

root().addEventListener("change", e => {
  if (e.target.id === "pageSort") {
    sort = e.target.value;
    $("#plist").innerHTML = listBodyHTML();
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
