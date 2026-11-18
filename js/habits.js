// خطة ملء الصحيفة: 75 يوماً · 11 أسبوعاً · 8 صفحات يومياً · ختمة كاملة
// منطق الخطة فقط (بلا واجهة) — قابل للاختبار
import { addDays, daysBetween } from "./srs.js";
import { juzOfPage, TOTAL_PAGES } from "./quran.js";

export const PLAN_DAYS = 75;
export const PLAN_WEEKS = 11;
export const PAGES_PER_DAY = 8;

// البنود اليومية (من الخطة). core = من «الحد الأدنى لضيق الوقت»، optional = لا يدخل في النسبة
// parts = مربعات صغيرة: ف فجر · ظ ظهر · ع عصر · م مغرب · ش عشاء
export const HABITS = [
  { id: "quran", icon: "📖", name: "ورد القرآن", core: true },
  { id: "morning", icon: "🌅", name: "أذكار الصباح", hint: "بعد الفجر", core: true },
  { id: "evening", icon: "🌇", name: "أذكار المساء", hint: "بعد العصر", core: true },
  { id: "prayers", icon: "📿", name: "أذكار بعد الصلوات", hint: "بعد كل صلاة", parts: ["ف", "ظ", "ع", "م", "ش"] },
  { id: "sleep", icon: "🌙", name: "أذكار النوم", hint: "قبل النوم" },
  { id: "qiyam", icon: "🌌", name: "قيام الليل والوتر", hint: "ولو ركعتين · ركعة وتر على الأقل", core: true },
  { id: "sunan", icon: "🕌", name: "السنن الرواتب", hint: "12 ركعة (العصر ليس له راتبة)", parts: ["ف", "ظ", "م", "ش"], core: true },
  { id: "duha", icon: "☀️", name: "صلاة الضحى", hint: "ركعتان فأكثر" },
  { id: "dua", icon: "🤲", name: "الدعاء", hint: "بأدعية الأسبوع" },
  { id: "sadaqa", icon: "💝", name: "الصدقة", hint: "ولو بالقليل", core: true },
  { id: "fast", icon: "🌾", name: "صيام تطوع", hint: "اختياري · الاثنين والخميس", optional: true },
];

export const PART_NAMES = { ف: "الفجر", ظ: "الظهر", ع: "العصر", م: "المغرب", ش: "العشاء" };

// ---------- الجدول ----------
// اليوم 1..74: 8 صفحات · اليوم 75: من 593 إلى 604 (12 صفحة) وبه تتم الختمة
export function quranRange(day) {
  if (day < 1 || day > PLAN_DAYS) return null;
  const from = (day - 1) * PAGES_PER_DAY + 1;
  const to = day === PLAN_DAYS ? TOTAL_PAGES : day * PAGES_PER_DAY;
  return { from, to, pages: to - from + 1 };
}

export function juzLabel({ from, to }) {
  const a = juzOfPage(from);
  const b = juzOfPage(to);
  return a === b ? `الجزء ${a}` : `الجزء ${a} و${b}`;
}

// رقم يوم الخطة لتاريخ معيّن (1 = يوم البدء؛ قد يكون خارج 1..75)
export const planDay = (start, date) => daysBetween(start, date) + 1;
export const dateOfDay = (start, day) => addDays(start, day - 1);
export const weekOfDay = day => Math.min(PLAN_WEEKS, Math.max(1, Math.ceil(day / 7)));
export const daysOfWeek = week => {
  const first = (week - 1) * 7 + 1;
  const last = Math.min(PLAN_DAYS, week * 7);
  const out = [];
  for (let d = first; d <= last; d++) out.push(d);
  return out;
};

// ---------- التقييم ----------
// قيمة بند في يوم: 0..1 (المربعات الصغيرة تُحتسب بنسبتها)
export function habitValue(h, entry) {
  if (!entry) return 0;
  const v = entry[h.id];
  if (h.parts) return Array.isArray(v) ? v.filter(Boolean).length / h.parts.length : 0;
  return v ? 1 : 0;
}

export const customValue = (c, entry) => (entry?.custom?.[c.id] ? 1 : 0);

// نسبة إنجاز اليوم: البنود الأساسية + العادات الخاصة (الصيام الاختياري إضافة لا يُنقص النسبة)
export function dayScore(entry, custom = []) {
  let done = 0;
  let total = 0;
  for (const h of HABITS) {
    const v = habitValue(h, entry);
    if (h.optional) done += v;
    else {
      done += v;
      total += 1;
    }
  }
  for (const c of custom) {
    done += customValue(c, entry);
    total += 1;
  }
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return { done, total, pct, minimum: minimumMet(entry) };
}

// «الحد الأدنى»: الورد، أذكار الصباح والمساء، السنن الرواتب كاملة، الوتر، صدقة
export function minimumMet(entry) {
  return HABITS.filter(h => h.core).every(h => habitValue(h, entry) === 1);
}

// ---------- الاستمرارية ----------
// أيام متتالية تحقق فيها الحد الأدنى حتى اليوم (إن لم يكتمل اليوم بعد، نعدّ حتى الأمس)
export function currentStreak(days, start, today) {
  const t = Math.min(planDay(start, today), PLAN_DAYS);
  let d = t;
  if (d >= 1 && !minimumMet(days[dateOfDay(start, d)])) d--;
  let n = 0;
  while (d >= 1 && minimumMet(days[dateOfDay(start, d)])) {
    n++;
    d--;
  }
  return n;
}

export function bestStreak(days, start, upToDay) {
  let best = 0;
  let run = 0;
  for (let d = 1; d <= Math.min(upToDay, PLAN_DAYS); d++) {
    if (minimumMet(days[dateOfDay(start, d)])) best = Math.max(best, ++run);
    else run = 0;
  }
  return best;
}

// صفحات الورد المقروءة (مجموع أيام الورد المُعلَّمة)
export function khatmaPages(days, start) {
  let n = 0;
  for (let d = 1; d <= PLAN_DAYS; d++) if (days[dateOfDay(start, d)]?.quran) n += quranRange(d).pages;
  return n;
}

// نسبة الثبات على كل بند حتى يوم معيّن (لحصاد الخطة)
export function habitRates(days, start, upToDay, custom = []) {
  const n = Math.max(1, Math.min(upToDay, PLAN_DAYS));
  const rates = [];
  for (const h of HABITS) {
    let s = 0;
    for (let d = 1; d <= n; d++) s += habitValue(h, days[dateOfDay(start, d)]);
    rates.push({ id: h.id, icon: h.icon, name: h.name, optional: !!h.optional, rate: Math.round((s / n) * 100) });
  }
  for (const c of custom) {
    let s = 0;
    for (let d = 1; d <= n; d++) s += customValue(c, days[dateOfDay(start, d)]);
    rates.push({ id: c.id, icon: c.icon || "⭐", name: c.name, custom: true, rate: Math.round((s / n) * 100) });
  }
  return rates;
}
