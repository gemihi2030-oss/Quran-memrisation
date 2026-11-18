// 🤲 أدعيتي: قائمة أدعية شخصية سهلة القراءة — مجمّعة حسب الموضوع، مرقّمة، بخط كبير قابل للتكبير
// القراءة: تضغط على الدعاء بعد أن تدعو به فيُعلَّم (يُنسى في اليوم التالي) · التعديل: نص، موضوع، ترتيب، حذف، إضافة
import { $, esc, delegate, toast } from "../util.js";
import { habits, saveHabits, newId } from "../state.js";
import { Store } from "../db.js";
import { todayStr } from "../srs.js";
import { DUA_CATS, groupDuas, splitDuas, moveDua, normalizeDuas, planDay, PLAN_DAYS } from "../habits.js";
import { updateChrome } from "../router.js";

const dlg = () => $("#duaDialog");
const SIZE_MIN = 1;
const SIZE_MAX = 2.25;
let size = Store.get("duaSize", 1.3);
let editing = false;
let date = todayStr(); // اليوم الذي يُسجَّل فيه «الدعاء» في عاداتي
let onChange = null; // لإعادة رسم الشاشة التي فُتحت منها القائمة
let lastCat = "other";
let saveTimer = 0;

export function openDuas(opts = {}) {
  date = opts.date || todayStr();
  onChange = opts.onChange || null;
  editing = !habits.duas.length;
  render();
  if (!dlg().open) dlg().showModal();
  body().scrollTop = 0;
}

// إضافة أدعية دفعة واحدة [{ text, cat }] — تتجاهل المكرر
export async function addDuas(list) {
  const have = new Set(habits.duas.map(d => d.text));
  const add = [];
  for (const d of list) {
    const text = String(d?.text || "").trim();
    if (!text || have.has(text)) continue;
    have.add(text);
    add.push({ id: newId() + add.length, text, cat: d.cat });
  }
  habits.duas = normalizeDuas([...habits.duas, ...add]);
  await saveHabits();
  if (dlg().open) rerender();
  return add.length;
}

const body = () => dlg().querySelector(".sheet-body");

// ---------- ما دعوت به اليوم ----------
function ticks() {
  return new Set(Store.get("duaTicks", {})[date] || []);
}
function setTicks(set) {
  const all = Store.get("duaTicks", {});
  const keep = { [date]: [...set] };
  const t = todayStr();
  if (t !== date && all[t]) keep[t] = all[t];
  Store.set("duaTicks", keep);
}

const planActive = () => {
  if (!habits.plan) return false;
  const d = planDay(habits.plan.start, date);
  return d >= 1 && d <= PLAN_DAYS;
};
const habitDone = () => !!habits.days[date]?.dua;

async function markHabit() {
  if (!planActive()) return;
  (habits.days[date] || (habits.days[date] = {})).dua = 1;
  await saveHabits();
  onChange?.();
  updateChrome();
}

// ---------- العرض ----------
function render() {
  if (!habits.duas.length) editing = true;
  const groups = groupDuas(habits.duas);
  const total = habits.duas.length;
  const t = ticks();
  const k = habits.duas.filter(d => t.has(d.id)).length;
  dlg().style.setProperty("--dua-size", size + "rem");
  dlg().innerHTML = `
    <header class="sheet-head">
      <h2>🤲 أدعيتي${total ? ` <small class="muted">(${total})</small>` : ""}</h2>
      <div class="dua-tools">
        ${editing ? "" : `<button type="button" class="icon-btn dua-size" data-action="dua-size" data-d="-1" aria-label="تصغير الخط" ${size <= SIZE_MIN ? "disabled" : ""}>أ<small>−</small></button>
        <button type="button" class="icon-btn dua-size" data-action="dua-size" data-d="1" aria-label="تكبير الخط" ${size >= SIZE_MAX ? "disabled" : ""}>أ<small>+</small></button>`}
        ${total ? `<button type="button" class="btn small${editing ? " primary" : ""}" data-action="dua-edit">${editing ? "✓ تم" : "✏️ تعديل"}</button>` : ""}
        <button type="button" class="icon-btn" data-action="close" aria-label="إغلاق">✕</button>
      </div>
    </header>
    <div class="sheet-body">${editing ? editHTML(groups) : readHTML(groups, t)}</div>
    ${editing ? "" : footHTML(k, total)}`;
}

function rerender() {
  const y = body()?.scrollTop || 0;
  render();
  body().scrollTop = y;
}

function readHTML(groups, t) {
  return `<p class="dua-tip">💡 ابدأ بحمد الله والصلاة على النبي ﷺ، وادعُ وأنت موقن بالإجابة. اضغط على الدعاء بعد أن تدعو به.</p>
    ${groups
      .map(g => `<section class="dua-group">
        <h3>${g.icon} ${g.name} <small class="muted">(${g.items.length})</small></h3>
        <ol class="dua-list">${g.items
          .map(d => {
            const on = t.has(d.id);
            return `<li class="dua-item${on ? " done" : ""}" data-action="dua-tick" data-id="${d.id}" role="checkbox" aria-checked="${on}" tabindex="0">
              <span class="dua-n" aria-hidden="true">${on ? "✓" : d.n}</span><p>${esc(d.text)}</p>
            </li>`;
          })
          .join("")}</ol>
      </section>`)
      .join("")}
    <p class="dua center">اللهم صلِّ وسلّم على نبينا محمد</p>`;
}

function footHTML(k, total) {
  const active = planActive();
  const done = active && habitDone();
  return `<footer class="sheet-foot">
    <span class="grow small muted">🤲 دعوت بـ ${k} من ${total}${k ? ` · <button type="button" class="link-btn small" data-action="dua-reset">↺ من جديد</button>` : ""}</span>
    ${active
      ? `<button type="button" class="btn primary" data-action="dua-done" ${done ? "disabled" : ""}>${done ? "✓ سُجّل في عاداتي" : "✓ دعوت اليوم"}</button>`
      : `<button type="button" class="btn" data-action="close">إغلاق</button>`}
  </footer>`;
}

const catOpts = sel => DUA_CATS.map(c => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${c.icon} ${c.name}</option>`).join("");

function editHTML(groups) {
  const list = groups
    .map(g => `<section class="dua-group">
      <h3>${g.icon} ${g.name}</h3>
      ${g.items
        .map((d, i) => `<div class="dua-edit">
          <div class="row gap-s dua-edit-top"><span class="dua-n">${d.n}</span>
            <textarea rows="2" data-dua-text="${d.id}" aria-label="نص الدعاء ${d.n}">${esc(d.text)}</textarea></div>
          <div class="row gap-s">
            <select data-dua-cat="${d.id}" aria-label="الموضوع">${catOpts(d.cat)}</select>
            <span class="grow"></span>
            <button type="button" class="icon-btn small" data-action="dua-move" data-id="${d.id}" data-d="-1" ${i === 0 ? "disabled" : ""} aria-label="تقديم">↑</button>
            <button type="button" class="icon-btn small" data-action="dua-move" data-id="${d.id}" data-d="1" ${i === g.items.length - 1 ? "disabled" : ""} aria-label="تأخير">↓</button>
            <button type="button" class="icon-btn small" data-action="dua-del" data-id="${d.id}" aria-label="حذف">🗑️</button>
          </div>
        </div>`)
        .join("")}
    </section>`)
    .join("");
  return `${habits.duas.length ? "" : `<p class="dua-tip">اكتب أدعيتك هنا لتجدها مرتبة حسب الموضوع كلما أردت أن تدعو.</p>`}
    <div class="dua-add">
      <label class="field">＋ إضافة دعاء <small class="muted">— أو الصق عدة أدعية، كل دعاء في سطر</small>
        <textarea id="duaNew" rows="3" placeholder="اللهم…"></textarea>
      </label>
      <div class="row gap-s">
        <select id="duaNewCat" aria-label="الموضوع">${catOpts(lastCat)}</select>
        <span class="grow"></span>
        <button type="button" class="btn small primary" data-action="dua-add">إضافة</button>
      </div>
    </div>
    ${list}`;
}

// ---------- الحفظ ----------
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveHabits().catch(() => toast("تعذر الحفظ")), 500);
}

async function saveNow() {
  clearTimeout(saveTimer);
  try {
    await saveHabits();
  } catch {
    toast("تعذر الحفظ");
  }
}

// ---------- الأحداث ----------
delegate(dlg(), {
  close: () => dlg().close(),
  "dua-edit": async () => {
    editing = !editing;
    habits.duas = normalizeDuas(habits.duas); // حذف ما أُفرغ نصه
    await saveNow();
    render();
  },
  "dua-size": el => {
    size = Math.min(SIZE_MAX, Math.max(SIZE_MIN, +(size + +el.dataset.d * 0.125).toFixed(3)));
    Store.set("duaSize", size);
    rerender();
  },
  "dua-tick": async el => {
    const t = ticks();
    const id = el.dataset.id;
    if (t.has(id)) t.delete(id);
    else t.add(id);
    setTicks(t);
    const all = habits.duas.length && habits.duas.every(d => t.has(d.id));
    if (all && planActive() && !habitDone()) {
      await markHabit();
      toast("تقبّل الله دعاءك 🤲 · سُجّل «الدعاء» في عاداتي");
    }
    rerender();
  },
  "dua-reset": () => {
    setTicks(new Set());
    rerender();
  },
  "dua-done": async () => {
    await markHabit();
    dlg().close();
    toast("تقبّل الله دعاءك 🤲 ✓");
  },
  "dua-add": async () => {
    const lines = splitDuas($("#duaNew").value);
    if (!lines.length) return $("#duaNew").focus();
    lastCat = $("#duaNewCat").value;
    const n = await addDuas(lines.map(text => ({ text, cat: lastCat })));
    const msg = !n ? "هذا الدعاء موجود مسبقاً" : n === 1 ? "أضيف الدعاء ✓" : n === 2 ? "أضيف دعاءان ✓" : n <= 10 ? `أضيفت ${n} أدعية ✓` : `أضيف ${n} دعاءً ✓`;
    toast(msg);
  },
  "dua-del": async el => {
    const d = habits.duas.find(x => x.id === el.dataset.id);
    if (!d || !confirm(`حذف هذا الدعاء؟\n\n${d.text}`)) return;
    habits.duas = habits.duas.filter(x => x.id !== d.id);
    await saveNow();
    rerender();
  },
  "dua-move": async el => {
    habits.duas = moveDua(habits.duas, el.dataset.id, +el.dataset.d);
    await saveNow();
    rerender();
  },
});

// تعديل النص: حفظ تلقائي بلا إعادة رسم
dlg().addEventListener("input", e => {
  const id = e.target.dataset.duaText;
  if (!id) return;
  const d = habits.duas.find(x => x.id === id);
  if (d) d.text = e.target.value;
  saveSoon();
});

dlg().addEventListener("change", async e => {
  const id = e.target.dataset.duaCat;
  if (!id) return;
  const d = habits.duas.find(x => x.id === id);
  if (d) d.cat = e.target.value;
  await saveNow();
  rerender();
});

dlg().addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.('[data-action="dua-tick"]')) {
    e.preventDefault();
    e.target.click();
  }
});

dlg().addEventListener("close", () => {
  if (editing) habits.duas = normalizeDuas(habits.duas);
  saveNow();
  onChange?.();
});
