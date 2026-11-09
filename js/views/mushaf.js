// خريطة المصحف: 604 صفحة ملوّنة حسب قوة الحفظ
import { $, delegate } from "../util.js";
import { pages, dueList } from "../state.js";
import { TOTAL_PAGES, juzRange, surahLabel } from "../quran.js";
import { level, todayStr } from "../srs.js";
import { show } from "../router.js";
import { openEditor } from "./editor.js";
import { openRange } from "./range.js";
import { openDetail } from "./detail.js";

const root = () => $("#view-pages");
let filter = "all";

const LEGEND = [
  ["none", "غير محفوظة"],
  ["new", "جديدة"],
  ["due", "مستحقة"],
  ["weak", "قيد التثبيت"],
  ["mid", "متوسطة"],
  ["strong", "راسخة"],
];

const matches = (lvl, f) =>
  f === "all" || (f === "due" && lvl === "due") || (f === "saved" && lvl !== "none") || (f === "none" && lvl === "none");

export function renderMushaf() {
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
      cells += `<button class="cell lv-${lvl}${matches(lvl, filter) ? "" : " dim"}" data-action="cell" data-page="${p}" title="صفحة ${p} — ${surahLabel(p)}">${p}</button>`;
    }
    grid += `<div class="juz-head" id="juz-${j}"><b>الجزء ${j}</b><span class="muted small">${n} / ${b - a + 1}</span></div>${cells}`;
  }

  root().innerHTML = `
    <div class="card">
      <div class="row between wrap">
        <h2>المصحف <small class="muted">(${pages.size} / ${TOTAL_PAGES})</small></h2>
        <div class="row gap-s">
          <button class="btn small primary" data-action="add">＋ صفحة</button>
          <button class="btn small" data-action="range">＋ مجموعة صفحات</button>
        </div>
      </div>
      <div class="row gap-s wrap toolbar">
        <input type="number" id="gotoPage" class="goto" min="1" max="${TOTAL_PAGES}" inputmode="numeric" placeholder="🔎 رقم صفحة">
        <div class="filters">${filters
          .map(([k, label]) => `<button class="chip-btn ${filter === k ? "on" : ""}" data-action="filter" data-f="${k}">${label}</button>`)
          .join("")}</div>
      </div>
      <div class="legend">${LEGEND.map(([k, label]) => `<span><i class="lv-${k}"></i>${label}</span>`).join("")}</div>
      <div class="grid">${grid}</div>
    </div>`;
}

function openPage(p) {
  if (!(p >= 1 && p <= TOTAL_PAGES)) return;
  if (pages.has(p)) openDetail(p);
  else openEditor(p);
}

export function scrollToJuz(j) {
  show("pages");
  requestAnimationFrame(() => $("#juz-" + j)?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

delegate(root(), {
  add: () => openEditor(),
  range: () => openRange(),
  filter: el => {
    filter = el.dataset.f;
    renderMushaf();
  },
  cell: el => openPage(+el.dataset.page),
});

root().addEventListener("keydown", e => {
  if (e.target.id === "gotoPage" && e.key === "Enter") {
    e.preventDefault(); // حتى لا يُضغط زر الإغلاق في النافذة التي ستُفتح بنفس الضغطة
    const p = +e.target.value;
    const cell = root().querySelector(`.cell[data-page="${p}"]`);
    if (cell) {
      cell.scrollIntoView({ behavior: "smooth", block: "center" });
      cell.classList.add("flash");
      setTimeout(() => cell.classList.remove("flash"), 1500);
    }
    openPage(p);
  }
});
