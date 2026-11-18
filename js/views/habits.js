// 📿 عاداتي — خطة ملء الصحيفة (75 يوماً قبل رمضان)
// اليوم: بنود يومية بمربعات (ومربعات صغيرة للصلوات) · ورد القرآن مع قارئ داخل التطبيق
// الأسبوع: جدول مثل صفحات الخطة + موضوع الأسبوع وأدعيته وملاحظاته · خريطة الأيام الـ75 · إحصائيات · حصاد الخطة
import { $, esc, delegate, toast } from "../util.js";
import { habits, saveHabits, newId } from "../state.js";
import { Store } from "../db.js";
import { todayStr, parseDate } from "../srs.js";
import {
  HABITS, PART_NAMES, PLAN_DAYS, PLAN_WEEKS, quranRange, juzLabel, planDay, dateOfDay, weekOfDay, daysOfWeek,
  habitValue, customValue, dayScore, currentStreak, bestStreak, khatmaPages, habitRates,
} from "../habits.js";
import { getPageAyahs, renderAyahs, surahLabel, TOTAL_PAGES } from "../quran.js";
import { updateChrome } from "../router.js";

const root = () => $("#view-habits");
const reader = () => $("#readerDialog");
let viewDay = null; // يوم الخطة المعروض (null = اليوم)
let viewWeek = null;
let saveTimer = 0;
let minimal = Store.get("habitsMinimal", false);

const fmtDate = (date, opts = { weekday: "long", day: "numeric", month: "long" }) => parseDate(date).toLocaleDateString("ar-DZ", opts);
const weekdayShort = date => parseDate(date).toLocaleDateString("ar-DZ", { weekday: "short" });
const isFastDay = date => [1, 4].includes(parseDate(date).getDay()); // الاثنين والخميس

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

// ---------- الواجهة الرئيسية ----------
export function renderHabits() {
  if (!habits.plan) return renderIntro();
  const t = todayStr();
  const today = planDay(habits.plan.start, t);
  if (today < 1) return renderNotStarted(today);
  const maxDay = Math.min(today, PLAN_DAYS);
  if (viewDay === null || viewDay > maxDay) viewDay = maxDay;
  if (viewWeek === null) viewWeek = weekOfDay(viewDay);

  root().innerHTML = `
    ${headHTML(today, maxDay)}
    ${today > PLAN_DAYS ? finishedHTML() : ""}
    ${checklistHTML()}
    ${weekHTML(maxDay)}
    ${daysMapHTML(maxDay)}
    ${statsHTML(maxDay)}
    ${referenceHTML()}
    ${harvestHTML(today > PLAN_DAYS, maxDay)}
    ${planSettingsHTML()}`;
}

function renderIntro() {
  root().innerHTML = `
    <div class="card hero hb-intro">
      <p class="basmala">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
      <h2>📿 خطة ملء الصحيفة</h2>
      <p class="hb-ayah">﴿وَسَارِعُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ وَجَنَّةٍ عَرْضُهَا السَّمَاوَاتُ وَالْأَرْضُ أُعِدَّتْ لِلْمُتَّقِينَ﴾ <small>آل عمران: 133</small></p>
      <div class="stats">
        <div class="stat"><b>75</b><span>يوماً</span></div>
        <div class="stat"><b>11</b><span>أسبوعاً</span></div>
        <div class="stat"><b>8</b><span>صفحات يومياً</span></div>
        <div class="stat"><b>1</b><span>ختمة كاملة</span></div>
      </div>
      <p class="muted">رحلة 75 يوماً تملأ فيها صحيفتك بالطاعات: ورد قرآن ثابت، أذكار، صلوات ونوافل، دعاء وصدقة… حتى تصل إلى رمضان وقد اعتادت نفسك على الطاعة وأتممت ختمة كاملة.</p>
      <label class="field">📅 تاريخ البدء <input type="date" id="hbStart" value="${todayStr()}"></label>
      <label class="field">الاسم <small class="muted">(اختياري)</small> <input type="text" id="hbName" placeholder="اسمك"></label>
      <button class="btn primary big" data-action="start-plan">🚀 ابدأ الخطة</button>
    </div>
    ${howItWorksHTML(true)}`;
}

function renderNotStarted(today) {
  const left = 1 - today;
  root().innerHTML = `
    <div class="card center">
      <h2>📿 خطة ملء الصحيفة</h2>
      <p class="big-num">${left}</p>
      <p class="muted">${left === 1 ? "يوم" : left === 2 ? "يومان" : left <= 10 ? "أيام" : "يوماً"} حتى بداية خطتك (${fmtDate(habits.plan.start)})</p>
      <p>📖 ورد اليوم الأول: ص 1–8 · الجزء 1</p>
    </div>
    ${howItWorksHTML(true)}
    ${planSettingsHTML(true)}`;
}

// ---------- رأس الصفحة: اليوم، النسبة، الاستمرارية، الختمة ----------
function ringHTML(pct) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return `<svg class="hb-ring" viewBox="0 0 80 80" aria-label="${pct}٪">
    <circle cx="40" cy="40" r="${r}" class="track"/>
    <circle cx="40" cy="40" r="${r}" class="value" stroke-dasharray="${((c * pct) / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 40 40)"/>
    <text x="40" y="45" text-anchor="middle">${pct}٪</text>
  </svg>`;
}

function headHTML(today, maxDay) {
  const { start } = habits.plan;
  const date = dateOfDay(start, viewDay);
  const entry = habits.days[date];
  const sc = dayScore(entry, habits.custom);
  const isToday = viewDay === Math.min(today, PLAN_DAYS) && today <= PLAN_DAYS;
  const pagesRead = khatmaPages(habits.days, start);
  const streak = currentStreak(habits.days, start, todayStr());
  return `
    <div class="card hb-head">
      <div class="row between">
        <h2>📿 خطة ملء الصحيفة${habits.plan.name ? ` <small class="muted">· ${esc(habits.plan.name)}</small>` : ""}</h2>
      </div>
      <div class="hb-daynav">
        <button class="btn small" data-action="day-prev" ${viewDay <= 1 ? "disabled" : ""} aria-label="اليوم السابق">→</button>
        <div class="hb-daytitle">
          <b>اليوم ${viewDay} <small>من ${PLAN_DAYS}</small></b>
          <span>${fmtDate(date)}${isToday ? " · <em>اليوم</em>" : ""}</span>
          <small class="muted">الأسبوع ${weekOfDay(viewDay)} من ${PLAN_WEEKS}</small>
        </div>
        <button class="btn small" data-action="day-next" ${viewDay >= maxDay ? "disabled" : ""} aria-label="اليوم التالي">←</button>
      </div>
      <div class="hb-summary">
        ${ringHTML(sc.pct)}
        <div class="hb-kpis">
          <div><b>🔥 ${streak}</b><span>أيام متتالية بالحد الأدنى</span></div>
          <div><b>📖 ${pagesRead}</b><span>من ${TOTAL_PAGES} صفحة (${Math.round((pagesRead / TOTAL_PAGES) * 100)}٪)</span></div>
        </div>
      </div>
      <div class="progress thin"><div class="bar" style="width:${(pagesRead / TOTAL_PAGES) * 100}%"></div></div>
      ${sc.minimum ? `<p class="hb-badge ok">✓ حققت الحد الأدنى في هذا اليوم — «أحب الأعمال إلى الله أدومها وإن قلّ»</p>` : ""}
      ${!isToday && today <= PLAN_DAYS ? `<p class="hb-badge">📝 تعدّل يوماً سابقاً — عوّض ما فاتك ثم أكمل. <button class="link-btn" data-action="day-today">العودة إلى اليوم</button></p>` : ""}
    </div>`;
}

// ---------- بنود اليوم ----------
function checklistHTML() {
  const date = dateOfDay(habits.plan.start, viewDay);
  const entry = habits.days[date] || {};
  const range = quranRange(viewDay);
  const rows = HABITS.filter(h => !minimal || h.core)
    .map(h => {
      const v = habitValue(h, entry);
      const state = v === 1 ? "done" : v > 0 ? "part" : "";
      let hint = h.hint || "";
      if (h.id === "quran") hint = `ص ${range.from}–${range.to} · ${juzLabel(range)}${viewDay === PLAN_DAYS ? " · وبه تتم الختمة" : ""}`;
      if (h.id === "fast" && isFastDay(date)) hint = `اليوم ${parseDate(date).getDay() === 1 ? "الاثنين" : "الخميس"} 🌙 · اختياري`;
      const parts = h.parts
        ? `<div class="hb-parts">${h.parts
            .map((p, i) => `<button type="button" class="hb-part${entry[h.id]?.[i] ? " on" : ""}" data-action="part" data-h="${h.id}" data-i="${i}" aria-pressed="${!!entry[h.id]?.[i]}" title="${PART_NAMES[p]}">${p}</button>`)
            .join("")}</div>`
        : "";
      return `<div class="hb-row ${state}${h.optional ? " optional" : ""}" data-action="toggle" data-h="${h.id}">
        <span class="hb-check" aria-hidden="true">${v === 1 ? "✓" : ""}</span>
        <div class="hb-body">
          <div class="hb-name">${h.icon} ${h.name}${h.core ? ` <span class="core" title="من الحد الأدنى">⭐</span>` : ""}</div>
          ${hint ? `<div class="hb-hint">${hint}</div>` : ""}
          ${parts}
          ${h.id === "quran" ? `<button type="button" class="btn small hb-read" data-action="read">📖 اقرأ الورد</button>` : ""}
        </div>
      </div>`;
    })
    .join("");
  const custom = minimal
    ? ""
    : habits.custom
        .map(c => {
          const v = customValue(c, entry);
          return `<div class="hb-row custom ${v ? "done" : ""}" data-action="toggle-custom" data-id="${c.id}">
            <span class="hb-check" aria-hidden="true">${v ? "✓" : ""}</span>
            <div class="hb-body"><div class="hb-name">${esc(c.icon || "⭐")} ${esc(c.name)} <span class="tag">خاصة</span></div></div>
            <button type="button" class="icon-btn small" data-action="del-custom" data-id="${c.id}" aria-label="حذف">✕</button>
          </div>`;
        })
        .join("");
  return `
    <div class="card hb-list">
      <div class="row between wrap">
        <h3>✅ بنود اليوم</h3>
        <label class="check small-check"><input type="checkbox" id="hbMinimal" ${minimal ? "checked" : ""}> 🌱 يوم مزدحم: الحد الأدنى فقط</label>
      </div>
      <p class="muted small">اضغط على البند عند إتمامه. المربعات الصغيرة: ف فجر · ظ ظهر · ع عصر · م مغرب · ش عشاء.</p>
      ${rows}${custom}
      ${minimal ? "" : `<details class="hb-add">
        <summary>＋ إضافة عادة خاصة</summary>
        <div class="row gap-s">
          <input type="text" id="hbCustomIcon" value="⭐" maxlength="4" class="hb-icon-input" aria-label="رمز">
          <input type="text" id="hbCustomName" placeholder="مثلاً: حفظ صفحة جديدة" class="grow">
          <button type="button" class="btn small primary" data-action="add-custom">إضافة</button>
        </div>
      </details>`}
    </div>`;
}

// ---------- الأسبوع ----------
function cellHTML(v, future) {
  if (future) return `<td class="future"></td>`;
  return `<td class="${v === 1 ? "full" : v > 0 ? "part" : "none"}">${v === 1 ? "●" : v > 0 ? "◐" : ""}</td>`;
}

function weekHTML(maxDay) {
  const { start } = habits.plan;
  const w = viewWeek;
  const days = daysOfWeek(w);
  const wk = habits.weeks[w] || {};
  const lastDay = days[days.length - 1];
  const until = quranRange(lastDay).to;
  const head = days
    .map(d => {
      const date = dateOfDay(start, d);
      return `<th class="${d === viewDay ? "cur" : ""}${d > maxDay ? " future" : ""}" data-action="${d <= maxDay ? "go-day" : ""}" data-d="${d}">${d}<small>${weekdayShort(date)}</small></th>`;
    })
    .join("");
  const rows = HABITS.map(h => `<tr><th title="${h.name}">${h.icon}</th>${days.map(d => cellHTML(habitValue(h, habits.days[dateOfDay(start, d)]), d > maxDay)).join("")}</tr>`).join("");
  const customRows = habits.custom
    .map(c => `<tr><th title="${esc(c.name)}">${esc(c.icon || "⭐")}</th>${days.map(d => cellHTML(customValue(c, habits.days[dateOfDay(start, d)]), d > maxDay)).join("")}</tr>`)
    .join("");
  const totals = days.map(d => (d > maxDay ? `<td class="future"></td>` : `<td class="pct">${dayScore(habits.days[dateOfDay(start, d)], habits.custom).pct}</td>`)).join("");
  return `
    <div class="card hb-week">
      <div class="row between">
        <button class="btn small" data-action="week-prev" ${w <= 1 ? "disabled" : ""} aria-label="الأسبوع السابق">→</button>
        <div class="center"><h3>📅 الأسبوع ${w} <small class="muted">من ${PLAN_WEEKS}</small></h3>
          <small class="muted">${fmtDate(dateOfDay(start, days[0]), { day: "numeric", month: "long" })} – ${fmtDate(dateOfDay(start, lastDay), { day: "numeric", month: "long" })}</small></div>
        <button class="btn small" data-action="week-next" ${w >= PLAN_WEEKS ? "disabled" : ""} aria-label="الأسبوع التالي">←</button>
      </div>
      <div class="hb-table-wrap"><table class="hb-table">
        <thead><tr><th></th>${head}</tr></thead>
        <tbody>
          <tr class="pages"><th>ص</th>${days.map(d => `<td>${quranRange(d).from}<br>${quranRange(d).to}</td>`).join("")}</tr>
          ${rows}${customRows}
          <tr class="total"><th>٪</th>${totals}</tr>
        </tbody>
      </table></div>
      <p class="muted small center">تقدم الختمة حسب الخطة: حتى صفحة ${until} من ${TOTAL_PAGES} (${Math.round((until / TOTAL_PAGES) * 100)}٪)</p>
      <label class="field">🎯 موضوع الأسبوع
        <input type="text" data-week-field="topic" value="${esc(wk.topic)}" placeholder="مثلاً: الصبر، بر الوالدين، الإخلاص…">
      </label>
      <label class="field">🤲 أدعية الأسبوع <small class="muted">— ندعو بها طوال الأسبوع</small>
        <textarea rows="3" data-week-field="duas" placeholder="اكتب أدعية هذا الأسبوع…">${esc(wk.duas)}</textarea>
      </label>
      <label class="field">📝 ملاحظات هذا الأسبوع
        <textarea rows="2" data-week-field="notes">${esc(wk.notes)}</textarea>
      </label>
    </div>`;
}

// ---------- خريطة الأيام الـ75 ----------
function daysMapHTML(maxDay) {
  const { start } = habits.plan;
  let cells = "";
  for (let d = 1; d <= PLAN_DAYS; d++) {
    const date = dateOfDay(start, d);
    if (d > maxDay) {
      cells += `<span class="hb-day future" title="اليوم ${d}">${d}</span>`;
      continue;
    }
    const sc = dayScore(habits.days[date], habits.custom);
    const lvl = sc.pct >= 100 ? "l4" : sc.pct >= 70 ? "l3" : sc.pct >= 40 ? "l2" : sc.pct > 0 ? "l1" : "l0";
    cells += `<button type="button" class="hb-day ${lvl}${d === viewDay ? " cur" : ""}${sc.minimum ? " min" : ""}" data-action="go-day" data-d="${d}" title="اليوم ${d} · ${sc.pct}٪">${d}</button>`;
  }
  return `
    <div class="card">
      <h3>🗓️ أيام الخطة</h3>
      <div class="hb-map">${cells}</div>
      <div class="legend hb-legend">
        <span><i class="hb-day l0"></i>0٪</span><span><i class="hb-day l1"></i>قليل</span><span><i class="hb-day l2"></i>40٪+</span>
        <span><i class="hb-day l3"></i>70٪+</span><span><i class="hb-day l4"></i>كامل</span><span><i class="hb-day min"></i>حد أدنى ✓</span>
      </div>
    </div>`;
}

// ---------- الإحصائيات ----------
function statsHTML(maxDay) {
  const { start } = habits.plan;
  let minDays = 0;
  let sum = 0;
  for (let d = 1; d <= maxDay; d++) {
    const sc = dayScore(habits.days[dateOfDay(start, d)], habits.custom);
    sum += sc.pct;
    if (sc.minimum) minDays++;
  }
  const rates = habitRates(habits.days, start, maxDay, habits.custom).filter(r => !r.optional);
  return `
    <div class="card">
      <h3>📊 إحصائياتي</h3>
      <div class="stats">
        <div class="stat"><b>${Math.round(sum / Math.max(1, maxDay))}٪</b><span>متوسط الإنجاز</span></div>
        <div class="stat"><b>${minDays}/${maxDay}</b><span>أيام بالحد الأدنى</span></div>
        <div class="stat"><b>${bestStreak(habits.days, start, maxDay)}</b><span>أطول استمرار</span></div>
        <div class="stat"><b>${Math.round((khatmaPages(habits.days, start) / TOTAL_PAGES) * 100)}٪</b><span>من الختمة</span></div>
      </div>
      <div class="hb-rates">${rates
        .sort((a, b) => b.rate - a.rate)
        .map(r => `<div class="hb-rate"><span>${esc(r.icon)} ${esc(r.name)}</span><div class="bar-bg"><i style="width:${r.rate}%"></i></div><b>${r.rate}٪</b></div>`)
        .join("")}</div>
    </div>`;
}

// ---------- كيف تسير الخطة + مرجع الأذكار ----------
function howItWorksHTML(open = false) {
  return `<details class="card tips" ${open ? "open" : ""}>
    <summary><h2>كيف تسير الخطة؟</h2></summary>
    <ul class="hb-how">
      <li><b>📖 ورد القرآن:</b> ختمة في 75 يوماً (مصحف المدينة، 604 صفحة): 8 صفحات يومياً من اليوم 1 إلى 74، ثم 12 صفحة في اليوم الأخير (593–604).</li>
      <li><b>طريقة التقسيم:</b> صفحة بعد كل فرض (5 صفحات) + 3 صفحات في وقت فراغ، أو 4 صفحات بعد الفجر + 4 بعد العصر أو قبل النوم.</li>
      <li><b>✅ التتبع:</b> علّم كل بند عند إتمامه. في أذكار الصلوات والسنن مربعات صغيرة لكل صلاة (السنن: ف ظ م ش، لأن العصر ليس له راتبة).</li>
      <li><b>🔁 إن فاتك يوم أو بند</b> فلا تترك الخطة: ارجع لذلك اليوم وعوّضه، ثم أكمل من اليوم التالي — فأحب الأعمال إلى الله أدومها وإن قلّ.</li>
      <li><b>🌱 الحد الأدنى لضيق الوقت (⭐):</b> ورد القرآن، أذكار الصباح والمساء، السنن الرواتب، ركعة وتر، وصدقة صغيرة — ثم زد من الباقي بقدر ما تستطيع.</li>
    </ul>
  </details>`;
}

function referenceHTML() {
  return `<details class="card tips hb-ref">
    <summary><h2>📚 مرجع الأذكار المختصر</h2></summary>
    <h4>🌅 أذكار الصباح والمساء</h4>
    <ul>
      <li>آية الكرسي مرة · الإخلاص والمعوذتان 3 مرات.</li>
      <li>سيد الاستغفار مرة.</li>
      <li>بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم — 3 مرات.</li>
      <li>رضيت بالله رباً وبالإسلام ديناً وبمحمد ﷺ نبياً — 3 مرات.</li>
      <li>اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور (وفي المساء: وإليك المصير).</li>
      <li>أعوذ بكلمات الله التامات من شر ما خلق — 3 مرات.</li>
      <li>سبحان الله وبحمده 100 مرة · لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير — 10 مرات · الصلاة على النبي ﷺ 10 مرات.</li>
    </ul>
    <h4>📿 أذكار بعد الصلوات</h4>
    <ul>
      <li>أستغفر الله 3 مرات · اللهم أنت السلام ومنك السلام تباركت يا ذا الجلال والإكرام.</li>
      <li>سبحان الله 33 · الحمد لله 33 · الله أكبر 33 · وتمام المائة: لا إله إلا الله وحده لا شريك له…</li>
      <li>آية الكرسي · الإخلاص والمعوذتان (3 مرات بعد الفجر والمغرب، ومرة بعد بقية الصلوات).</li>
    </ul>
    <h4>🌙 أذكار النوم</h4>
    <ul>
      <li>الوضوء والنوم على الشق الأيمن · آية الكرسي وآخر آيتين من البقرة.</li>
      <li>الإخلاص والمعوذتان: يقرؤها ثلاثاً وينفث في كفيه ويمسح بهما ما استطاع من جسده.</li>
      <li>باسمك اللهم أموت وأحيا · سبحان الله 33 · الحمد لله 33 · الله أكبر 34.</li>
    </ul>
    <h4>🌌 القيام والوتر</h4>
    <ul><li>يبدأ بركعتين خفيفتين، ثم ما تيسّر مثنى مثنى، ثم الوتر (ركعة أو ثلاث أو خمس) · الإكثار من الاستغفار في السحر.</li></ul>
    <h4>🕌 السنن الرواتب والضحى</h4>
    <ul>
      <li>12 ركعة: ركعتان قبل الفجر، أربع قبل الظهر وركعتان بعده، ركعتان بعد المغرب، ركعتان بعد العشاء — «من حافظ عليها بُني له بيت في الجنة».</li>
      <li>الضحى: ركعتان فأكثر، من ارتفاع الشمس إلى قُبيل الظهر.</li>
    </ul>
    <h4>🤲 الدعاء والصدقة</h4>
    <ul>
      <li>مواطن الإجابة: السجود، بين الأذان والإقامة، آخر الليل، آخر ساعة من يوم الجمعة.</li>
      <li>الصدقة: خصّص مبلغاً يومياً ولو صغيراً «فاتقوا النار ولو بشق تمرة» — مال، إطعام، إصلاح بين اثنين، صدقة جارية.</li>
    </ul>
  </details>`;
}

// ---------- حصاد الخطة ----------
function harvestHTML(finished, maxDay) {
  const { start } = habits.plan;
  const rates = habitRates(habits.days, start, maxDay, habits.custom).filter(r => !r.optional);
  const best = [...rates].sort((a, b) => b.rate - a.rate)[0];
  const hardest = [...rates].sort((a, b) => a.rate - b.rate)[0];
  const pages = khatmaPages(habits.days, start);
  const hv = habits.harvest || {};
  const field = (key, label, ph) => `<label class="field">${label}<textarea rows="2" data-harvest-field="${key}" placeholder="${ph}">${esc(hv[key])}</textarea></label>`;
  return `<details class="card tips hb-harvest" ${finished ? "open" : ""}>
    <summary><h2>🌾 حصاد الخطة</h2></summary>
    <p class="muted small">الحمد لله الذي بلّغنا. راجع رحلتك ثم أكمل مع رمضان بنفس العزيمة: اللهم بلّغنا رمضان، وأعنّا على صيامه وقيامه، وتقبّله منا.</p>
    <h4>أنجزتُ بفضل الله</h4>
    <ul class="hb-harvest-auto">
      <li>📖 الختمة: ${pages >= TOTAL_PAGES ? "ختمة كاملة ✓" : `${pages} من ${TOTAL_PAGES} صفحة`}</li>
      <li>💪 أكثر عادة ثبتُّ عليها: ${best ? `${esc(best.icon)} ${esc(best.name)} (${best.rate}٪)` : "—"}</li>
      <li>🧗 أكثر بند كان صعباً عليّ: ${hardest ? `${esc(hardest.icon)} ${esc(hardest.name)} (${hardest.rate}٪)` : "—"}</li>
    </ul>
    <h4>خطتي لرمضان</h4>
    ${field("wird", "📖 وردي اليومي", "مثلاً: جزء يومياً…")}
    ${field("keep", "✅ عاداتي التي سأستمر عليها", "")}
    ${field("add", "➕ ما أريد أن أضيفه", "")}
    ${field("duas", "🤲 أدعية أخصّ بها نفسي ومن أحب", "")}
    <p class="dua">تقبّل الله منا ومنكم صالح الأعمال</p>
  </details>`;
}

function finishedHTML() {
  return `<div class="card center notice">
    <div class="big-emoji">🎉</div>
    <h2>اكتملت الخطة بفضل الله!</h2>
    <p class="muted">راجع «حصاد الخطة» في الأسفل، واكتب خطتك لرمضان.</p>
  </div>`;
}

function planSettingsHTML(open = false) {
  return `<details class="card tips" ${open ? "open" : ""}>
    <summary><h2>⚙️ إعدادات الخطة</h2></summary>
    <label class="field">📅 تاريخ البدء <input type="date" id="hbStartEdit" value="${habits.plan.start}"></label>
    <label class="field">الاسم <input type="text" id="hbNameEdit" value="${esc(habits.plan.name)}"></label>
    <div class="row gap-s wrap">
      <button class="btn small" data-action="save-plan">💾 حفظ</button>
      <button class="btn small danger" data-action="reset-plan">↺ بدء خطة جديدة</button>
    </div>
    <p class="muted small">تغيير تاريخ البدء يغيّر أرقام الأيام (ما سجّلته محفوظ حسب التاريخ).</p>
  </details>`;
}

// ---------- قارئ ورد اليوم ----------
async function openReader(day) {
  const range = quranRange(day);
  const date = dateOfDay(habits.plan.start, day);
  const done = !!habits.days[date]?.quran;
  reader().innerHTML = `
    <header class="sheet-head">
      <h2>📖 ورد اليوم ${day} <small class="muted">ص ${range.from}–${range.to} · ${juzLabel(range)}</small></h2>
      <button type="button" class="icon-btn" data-action="close" aria-label="إغلاق">✕</button>
    </header>
    <div class="sheet-body" id="rdBody"><p class="muted center">⏳ جارٍ تحميل الصفحات…</p></div>
    <footer class="sheet-foot">
      <span class="grow muted small">صفحة بعد كل فرض + 3 في وقت فراغ</span>
      <button type="button" class="btn primary" data-action="read-done">${done ? "✓ تم" : "✓ قرأت الورد"}</button>
    </footer>`;
  reader().dataset.day = day;
  reader().showModal();
  const pagesNums = [];
  for (let p = range.from; p <= range.to; p++) pagesNums.push(p);
  const results = await Promise.all(pagesNums.map(p => getPageAyahs(p).catch(() => null)));
  if (+reader().dataset.day !== day || !reader().open) return;
  $("#rdBody").innerHTML = pagesNums
    .map((p, i) => `<section class="rd-page">
      <div class="rd-head"><b>صفحة ${p}</b><span>${surahLabel(p)}</span></div>
      ${results[i] ? `<div class="quran">${renderAyahs(results[i])}</div>` : `<p class="warn">تعذر تحميل الصفحة (تحقق من الإنترنت، أو نزّل المصحف كاملاً من الإعدادات).</p>`}
    </section>`)
    .join("");
}

const rd = reader();
delegate(rd, {
  close: () => rd.close(),
  "read-done": async () => {
    const day = +rd.dataset.day;
    const date = dateOfDay(habits.plan.start, day);
    const entry = habits.days[date] || (habits.days[date] = {});
    entry.quran = 1;
    await saveNow();
    rd.close();
    toast("بارك الله فيك ✓ تم تسجيل الورد");
    renderHabits();
    updateChrome();
  },
});

// ---------- الأحداث ----------
function entryOf(day) {
  const date = dateOfDay(habits.plan.start, day);
  return habits.days[date] || (habits.days[date] = {});
}

async function changed() {
  renderHabits();
  updateChrome();
  await saveNow();
}

delegate(root(), {
  "start-plan": async () => {
    const start = $("#hbStart").value || todayStr();
    habits.plan = { start, name: ($("#hbName").value || "").trim() };
    viewDay = null;
    viewWeek = null;
    await saveNow();
    toast("بسم الله، انطلقت خطتك 🚀");
    renderHabits();
    updateChrome();
  },
  toggle: el => {
    const h = HABITS.find(x => x.id === el.dataset.h);
    const e = entryOf(viewDay);
    if (h.parts) {
      const all = habitValue(h, e) === 1;
      e[h.id] = h.parts.map(() => (all ? 0 : 1));
    } else e[h.id] = e[h.id] ? 0 : 1;
    changed();
  },
  part: el => {
    const h = HABITS.find(x => x.id === el.dataset.h);
    const e = entryOf(viewDay);
    const arr = Array.isArray(e[h.id]) ? [...e[h.id]] : h.parts.map(() => 0);
    arr[+el.dataset.i] = arr[+el.dataset.i] ? 0 : 1;
    e[h.id] = arr;
    changed();
  },
  "toggle-custom": el => {
    const e = entryOf(viewDay);
    e.custom = e.custom || {};
    e.custom[el.dataset.id] = e.custom[el.dataset.id] ? 0 : 1;
    changed();
  },
  "add-custom": () => {
    const name = ($("#hbCustomName").value || "").trim();
    if (!name) return $("#hbCustomName").focus();
    habits.custom.push({ id: newId(), name, icon: ($("#hbCustomIcon").value || "⭐").trim() || "⭐" });
    toast("أضيفت العادة ✓");
    changed();
  },
  "del-custom": (el, e) => {
    e.stopPropagation();
    const c = habits.custom.find(x => x.id === el.dataset.id);
    if (!c || !confirm(`حذف العادة «${c.name}»؟ (يبقى سجلها السابق محفوظاً)`)) return;
    habits.custom = habits.custom.filter(x => x.id !== c.id);
    changed();
  },
  read: () => openReader(viewDay),
  "day-prev": () => {
    viewDay = Math.max(1, viewDay - 1);
    viewWeek = weekOfDay(viewDay);
    renderHabits();
  },
  "day-next": () => {
    viewDay += 1;
    viewWeek = weekOfDay(viewDay);
    renderHabits();
  },
  "day-today": () => {
    viewDay = null;
    viewWeek = null;
    renderHabits();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
  "go-day": el => {
    if (!el.dataset.d) return;
    viewDay = +el.dataset.d;
    viewWeek = weekOfDay(viewDay);
    renderHabits();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
  "week-prev": () => {
    viewWeek = Math.max(1, viewWeek - 1);
    renderHabits();
  },
  "week-next": () => {
    viewWeek = Math.min(PLAN_WEEKS, viewWeek + 1);
    renderHabits();
  },
  "save-plan": async () => {
    const start = $("#hbStartEdit").value;
    if (!start) return;
    habits.plan = { start, name: ($("#hbNameEdit").value || "").trim() };
    viewDay = null;
    viewWeek = null;
    await saveNow();
    toast("تم حفظ إعدادات الخطة ✓");
    renderHabits();
    updateChrome();
  },
  "reset-plan": async () => {
    if (!confirm("بدء خطة جديدة؟ سيُحذف تتبّع الأيام وحقول الأسابيع والحصاد (العادات الخاصة تبقى).")) return;
    habits.plan = null;
    habits.days = {};
    habits.weeks = {};
    habits.harvest = {};
    viewDay = null;
    viewWeek = null;
    await saveNow();
    renderHabits();
    updateChrome();
  },
});

// حقول نصية: حفظ تلقائي بلا إعادة رسم
root().addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.weekField) {
    const w = viewWeek;
    habits.weeks[w] = { ...(habits.weeks[w] || {}), [t.dataset.weekField]: t.value };
    saveSoon();
  } else if (t.dataset.harvestField) {
    habits.harvest = { ...(habits.harvest || {}), [t.dataset.harvestField]: t.value };
    saveSoon();
  }
});

root().addEventListener("change", e => {
  if (e.target.id === "hbMinimal") {
    minimal = e.target.checked;
    Store.set("habitsMinimal", minimal);
    renderHabits();
  }
});

// ---------- لبطاقة الرئيسية ----------
export function habitsSummary() {
  if (!habits.plan) return null;
  const t = todayStr();
  const day = planDay(habits.plan.start, t);
  if (day < 1) return { notStarted: true, daysLeft: 1 - day };
  if (day > PLAN_DAYS) return { finished: true, pages: khatmaPages(habits.days, habits.plan.start) };
  const sc = dayScore(habits.days[t], habits.custom);
  return {
    day,
    pct: sc.pct,
    minimum: sc.minimum,
    range: quranRange(day),
    quranDone: !!habits.days[t]?.quran,
    streak: currentStreak(habits.days, habits.plan.start, t),
    week: weekOfDay(day),
  };
}

