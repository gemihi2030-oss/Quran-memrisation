// تسجيل مجموعة صفحات محفوظة مسبقاً دفعة واحدة، مع توزيع مراجعاتها الأولى على عدة أيام
import { $, delegate, toast } from "../util.js";
import { pages, settings, savePages } from "../state.js";
import { TOTAL_PAGES, juzRange, getPageAyahs, firstWords } from "../quran.js";
import { newCard, todayStr, addDays } from "../srs.js";
import { refresh } from "../router.js";

const dlg = () => $("#rangeDialog");

export function openRange() {
  const [a, b] = juzRange(30);
  let juzOptions = `<option value="">— اختر جزءاً —</option>`;
  for (let j = 1; j <= 30; j++) juzOptions += `<option value="${j}">الجزء ${j}${j === 30 ? " (عمّ)" : j === 29 ? " (تبارك)" : ""}</option>`;

  dlg().innerHTML = `
  <form novalidate>
    <header class="sheet-head">
      <h2>تسجيل صفحات محفوظة مسبقاً</h2>
      <button type="button" class="icon-btn" data-action="close" aria-label="إغلاق">✕</button>
    </header>
    <div class="sheet-body">
      <p class="muted small">مفيد إن كنت تحفظ أجزاءً من قبل: تُسجَّل الصفحات وتوزَّع مراجعاتها الأولى على عدة أيام حتى لا تتراكم. يمكنك إضافة كلمات الربط والصور لكل صفحة لاحقاً.</p>
      <label class="field">اختيار سريع
        <select id="rgJuz">${juzOptions}</select>
      </label>
      <div class="row">
        <label class="field grow">من الصفحة <input type="number" id="rgFrom" min="1" max="${TOTAL_PAGES}" value="${a}" inputmode="numeric"></label>
        <label class="field grow">إلى الصفحة <input type="number" id="rgTo" min="1" max="${TOTAL_PAGES}" value="${b}" inputmode="numeric"></label>
      </div>
      <fieldset class="field radios">
        <legend>حالة حفظك لهذه الصفحات</legend>
        <label><input type="radio" name="rgStrength" value="strong" checked> 💪 متين (حفظ قديم أراجعه باستمرار)</label>
        <label><input type="radio" name="rgStrength" value="fresh"> 🌱 حديث أو يحتاج تثبيتاً</label>
      </fieldset>
      <label class="field">توزيع المراجعات الأولى على (يوم)
        <input type="number" id="rgSpread" min="1" max="120" inputmode="numeric">
      </label>
      <p class="status" id="rgPreview"></p>
    </div>
    <footer class="sheet-foot">
      <span class="grow"></span>
      <button type="button" class="btn" data-action="close">إلغاء</button>
      <button type="submit" class="btn primary">💾 تسجيل</button>
    </footer>
  </form>`;
  $("#rgSpread").value = autoSpread(readRange().list.length);
  preview();
  dlg().showModal();
}

function readRange() {
  let from = +$("#rgFrom").value;
  let to = +$("#rgTo").value;
  if (from > to) [from, to] = [to, from];
  const list = [];
  let skipped = 0;
  if (from >= 1 && to <= TOTAL_PAGES) {
    for (let p = from; p <= to; p++) (pages.has(p) ? skipped++ : list.push(p));
  }
  return { from, to, list, skipped };
}

const autoSpread = n => Math.max(1, Math.ceil(n / Math.max(5, Math.floor(settings.maxReviews / 2))));

function preview() {
  const { list, skipped } = readRange();
  const spread = Math.max(1, +$("#rgSpread").value || 1);
  $("#rgPreview").innerHTML = list.length
    ? `سيتم تسجيل <b>${list.length}</b> صفحة${skipped ? ` (و${skipped} مسجلة مسبقاً لن تتغير)` : ""}، بمعدل <b>${Math.ceil(list.length / spread)}</b> صفحة في اليوم ابتداءً من اليوم.`
    : `<span class="warn">لا توجد صفحات جديدة في هذا النطاق.</span>`;
}

async function save() {
  const { list } = readRange();
  if (!list.length) return;
  const strong = dlg().querySelector('input[name="rgStrength"]:checked').value === "strong";
  const spread = Math.max(1, +$("#rgSpread").value || 1);
  const perDay = Math.ceil(list.length / spread);
  const t = todayStr();
  const now = new Date().toISOString();
  const recs = list.map((p, i) => {
    const due = addDays(t, Math.floor(i / perDay));
    const srs = strong ? { ...newCard(t), reps: 2, interval: 7, last: t, due } : { ...newCard(t), due };
    return { page: p, ayahs: [], cue: "", links: [], notes: "", images: [], createdAt: now, bulk: true, srs };
  });
  await savePages(recs);
  dlg().close();
  toast(`تم تسجيل ${recs.length} صفحة ✓`);
  refresh();
  prefetchTexts(list);
}

// جلب نصوص الصفحات في الخلفية (إن توفر الإنترنت) لتكون جاهزة عند المراجعة
async function prefetchTexts(list) {
  const queue = [...list];
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      try {
        const ayahs = await getPageAyahs(p);
        const rec = pages.get(p);
        if (rec && !rec.ayahs.length && ayahs) {
          rec.ayahs = ayahs.map(a => ({ ...a }));
          rec.cue = rec.cue || firstWords(ayahs[0]?.text, 5);
          await savePages([rec]);
        }
      } catch {
        return; // لا إنترنت: ستُجلب عند المراجعة
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

const d = dlg();
delegate(d, { close: () => d.close() });
d.addEventListener("submit", e => {
  e.preventDefault();
  save();
});
d.addEventListener("input", e => {
  if (e.target.id === "rgJuz" && e.target.value) {
    const [a, b] = juzRange(+e.target.value);
    $("#rgFrom").value = a;
    $("#rgTo").value = b;
    $("#rgSpread").value = autoSpread(readRange().list.length);
  } else if (e.target.id === "rgFrom" || e.target.id === "rgTo") {
    $("#rgSpread").value = autoSpread(readRange().list.length);
  }
  preview();
});
