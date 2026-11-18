// خطة ملء الصحيفة: 75 يوماً · 11 أسبوعاً · 8 صفحات يومياً · ختمة كاملة
// منطق الخطة فقط (بلا واجهة) — قابل للاختبار
import { addDays, daysBetween } from "./srs.js";
import { juzOfPage, TOTAL_PAGES, SURAH_NAMES, surahsOnPage } from "./quran.js";

export const PLAN_DAYS = 75;
export const PLAN_WEEKS = 11;
export const PAGES_PER_DAY = 8;

// البنود اليومية (من الخطة). core = من «الحد الأدنى لضيق الوقت»، optional = لا يدخل في النسبة
// parts = مربعات صغيرة: ف فجر · ظ ظهر · ع عصر · م مغرب · ش عشاء
// group = «القرآن»: بنود فرعية (ورد الختمة، قراءة سور، حفظ سورة) — انظر بنود القرآن في الأسفل
export const HABITS = [
  { id: "quran", icon: "📖", name: "القرآن", core: true, group: true },
  { id: "morning", icon: "🌅", name: "أذكار الصباح", hint: "بعد الفجر", core: true },
  { id: "evening", icon: "🌇", name: "أذكار المساء", hint: "بعد العصر", core: true },
  { id: "prayers", icon: "📿", name: "أذكار بعد الصلوات", hint: "بعد كل صلاة", parts: ["ف", "ظ", "ع", "م", "ش"] },
  { id: "sleep", icon: "🌙", name: "أذكار النوم", hint: "قبل النوم" },
  { id: "qiyam", icon: "🌌", name: "قيام الليل والوتر", hint: "ولو ركعتين · ركعة وتر على الأقل", core: true },
  { id: "sunan", icon: "🕌", name: "السنن الرواتب", hint: "12 ركعة (العصر ليس له راتبة)", parts: ["ف", "ظ", "م", "ش"], core: true },
  { id: "duha", icon: "☀️", name: "صلاة الضحى", hint: "ركعتان فأكثر" },
  { id: "dua", icon: "🤲", name: "الدعاء", hint: "من أدعيتي وأدعية الأسبوع" },
  { id: "sadaqa", icon: "💝", name: "الصدقة", hint: "ولو بالقليل", core: true },
  { id: "fast", icon: "🌾", name: "صيام تطوع", hint: "اختياري · الاثنين والخميس", optional: true },
];

export const PART_NAMES = { ف: "الفجر", ظ: "الظهر", ع: "العصر", م: "المغرب", ش: "العشاء" };

// ---------- بنود القرآن ----------
// ward = ورد الختمة (8 صفحات يومياً، يُحفظ في entry.quran كما في النسخ السابقة)
// read = قراءة سورة · hifz = حفظ سورة — يُحفظ إنجازها في entry.q = { "read-36": 1, … }
export const WARD = { id: "ward", kind: "ward" };
export const DEFAULT_QURAN_ITEMS = [
  WARD,
  { id: "read-2", kind: "read", surah: 2 },
  { id: "read-36", kind: "read", surah: 36 },
  { id: "read-67", kind: "read", surah: 67 },
  { id: "hifz-2", kind: "hifz", surah: 2 },
];
export const QURAN_ICONS = { ward: "📖", read: "📗", hifz: "🧠" };

export const quranItemId = (kind, surah) => (kind === "ward" ? "ward" : `${kind}-${surah}`);

// قائمة صالحة دائماً: الورد أولاً، ثم بنود بلا تكرار (القيمة الافتراضية لمن لم يخصّص بعد)
export function normalizeQuranItems(list) {
  if (!Array.isArray(list)) return DEFAULT_QURAN_ITEMS.map(x => ({ ...x }));
  const out = [{ ...WARD }];
  for (const x of list) {
    const s = +x?.surah;
    if (!["read", "hifz"].includes(x?.kind) || !(s >= 1 && s <= 114)) continue;
    const id = quranItemId(x.kind, s);
    if (!out.some(y => y.id === id)) out.push({ id, kind: x.kind, surah: s });
  }
  return out;
}

let quranItems = normalizeQuranItems();
export const getQuranItems = () => quranItems;
export function setQuranItems(list) {
  quranItems = Array.isArray(list) && list.length ? list : normalizeQuranItems();
}

export function quranItemLabel(item) {
  if (item.kind === "ward") return "ورد الختمة";
  return `${item.kind === "hifz" ? "حفظ" : "قراءة"} سورة ${SURAH_NAMES[item.surah - 1]}`;
}

// اسم قصير لجدول الأسبوع
export function quranItemShort(item) {
  if (item.kind === "ward") return "الورد";
  return `${item.kind === "hifz" ? "🧠" : ""}${SURAH_NAMES[item.surah - 1]}`;
}

export function quranItemDone(item, entry) {
  if (!entry) return false;
  return item.kind === "ward" ? !!entry.quran : !!entry.q?.[item.id];
}

export function setQuranItemDone(item, entry, on) {
  if (item.kind === "ward") entry.quran = on ? 1 : 0;
  else entry.q = { ...(entry.q || {}), [item.id]: on ? 1 : 0 };
}

// عند تسجيل صفحة جديدة في التطبيق: نعلّم «حفظ السورة» في يوم التسجيل (إن كان من أيام الخطة)
export function autoMarkHifz(h, page, date) {
  if (!h?.plan) return null;
  const d = planDay(h.plan.start, date);
  if (d < 1 || d > PLAN_DAYS) return null;
  const onPage = surahsOnPage(page);
  const item = quranItems.find(i => i.kind === "hifz" && onPage.includes(i.surah));
  if (!item) return null;
  const entry = h.days[date] || (h.days[date] = {});
  if (quranItemDone(item, entry)) return null;
  setQuranItemDone(item, entry, true);
  return item;
}

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
  if (h.group) return quranItems.filter(i => quranItemDone(i, entry)).length / quranItems.length;
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

// «الحد الأدنى»: ورد الختمة، أذكار الصباح والمساء، السنن الرواتب كاملة، الوتر، صدقة
// (من بنود القرآن يكفي ورد الختمة؛ قراءة السور والحفظ زيادة خير)
export function minimumMet(entry) {
  return HABITS.filter(h => h.core).every(h => (h.group ? quranItemDone(WARD, entry) : habitValue(h, entry) === 1));
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
    if (h.group) {
      for (const it of quranItems) {
        let k = 0;
        for (let d = 1; d <= n; d++) if (quranItemDone(it, days[dateOfDay(start, d)])) k++;
        rates.push({ id: `q:${it.id}`, icon: QURAN_ICONS[it.kind], name: quranItemLabel(it), sub: true, rate: Math.round((k / n) * 100) });
      }
    }
  }
  for (const c of custom) {
    let s = 0;
    for (let d = 1; d <= n; d++) s += customValue(c, days[dateOfDay(start, d)]);
    rates.push({ id: c.id, icon: c.icon || "⭐", name: c.name, custom: true, rate: Math.round((s / n) * 100) });
  }
  return rates;
}

// ---------- 🤲 أدعيتي ----------
// قائمة أدعية شخصية [{ id, text, cat }] تُعرض مجمّعة حسب الموضوع بهذا الترتيب
export const DUA_CATS = [
  { id: "rizq", icon: "💼", name: "العمل والرزق" },
  { id: "deen", icon: "📖", name: "القرآن والعبادة" },
  { id: "family", icon: "👨‍👩‍👦", name: "أهلي" },
  { id: "akhira", icon: "🤍", name: "المغفرة والآخرة" },
  { id: "other", icon: "🤲", name: "أدعية أخرى" },
];

export function normalizeDuas(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const d of list) {
    if (!d || !d.id || typeof d.text !== "string" || !d.text.trim() || seen.has(String(d.id))) continue;
    seen.add(String(d.id));
    out.push({ id: String(d.id), text: d.text.trim(), cat: DUA_CATS.some(c => c.id === d.cat) ? d.cat : "other" });
  }
  return out;
}

// نص ملصوق ← أدعية: كل سطر دعاء (بلا ترقيم ولا أسطر فارغة)
export function splitDuas(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(l => l.replace(/^\s*(?:[-–•*·]|[0-9٠-٩]+\s*[.)\-–:])\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// مجمّعة حسب الموضوع بترتيب DUA_CATS، مع ترقيم متصل (n)
export function groupDuas(duas) {
  let n = 0;
  return DUA_CATS.map(c => ({ ...c, items: duas.filter(d => d.cat === c.id) }))
    .filter(g => g.items.length)
    .map(g => ({ ...g, items: g.items.map(d => ({ ...d, n: ++n })) }));
}

// تقديم/تأخير دعاء داخل موضوعه (dir = -1 أو 1)
export function moveDua(duas, id, dir) {
  const i = duas.findIndex(d => d.id === id);
  if (i < 0) return duas;
  let j = i + dir;
  while (j >= 0 && j < duas.length && duas[j].cat !== duas[i].cat) j += dir;
  if (j < 0 || j >= duas.length) return duas;
  const out = [...duas];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
