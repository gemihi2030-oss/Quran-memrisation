// حالة التطبيق: الإعدادات، الصفحات المحفوظة، الإحصائيات
import { DB, Store } from "./db.js";
import { todayStr, addDays, daysBetween, isDue, newCard } from "./srs.js";
import { parseManualText, TOTAL_PAGES } from "./quran.js";
import { toPhoto } from "./media.js";

export const DEFAULTS = {
  maxReviews: 30,      // أقصى عدد صفحات في جلسة المراجعة
  maxInterval: 120,    // أقصى مدة بين مراجعتين (أيام)
  order: "mushaf",     // ترتيب الجلسة: mushaf = حسب ترتيب المصحف، priority = الأحوج أولاً
  autoCue: true,       // إظهار بداية الصفحة تلقائياً عند المراجعة
  quranSize: 1.5,      // حجم خط الآيات (rem)
  theme: "auto",       // auto | light | dark
  motivView: "both",   // عرض التحفيز: both = الصورة مع النص، img = الصورة فقط
};
export const settings = { ...DEFAULTS, ...Store.get("settings", {}) };

export function saveSettings() {
  Store.set("settings", settings);
  applyTheme();
}

export function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === "light" || settings.theme === "dark") root.dataset.theme = settings.theme;
  else delete root.dataset.theme;
  root.style.setProperty("--quran-size", settings.quranSize + "rem");
}

// ---------- الصفحات ----------
export const pages = new Map(); // رقم الصفحة -> السجل

// يحوّل سجلات النسخة الأولى (نص كامل) إلى الشكل الجديد (آيات مع مفاتيح لكل آية)
export function normalizeRecord(r) {
  // images = صور التربيط · maps = صور الخريطة الذهنية للوجه
  const rec = { cue: "", links: [], notes: "", images: [], maps: [], ...r };
  rec.page = +rec.page;
  if (!Array.isArray(rec.ayahs)) rec.ayahs = rec.text ? parseManualText(rec.text) : [];
  delete rec.text;
  if (!Array.isArray(rec.links)) rec.links = [];
  // كل صورة: { src, url?, time? } — النسخ السابقة كانت نصاً فقط
  rec.images = (Array.isArray(rec.images) ? rec.images : []).map(toPhoto).filter(Boolean);
  rec.maps = (Array.isArray(rec.maps) ? rec.maps : []).map(toPhoto).filter(Boolean);
  // تدبر الآيات: [{ id, s?, a?, text, img?, source?, time?, createdAt }] (a فارغ = الصفحة كاملة)
  rec.tadabbur = Array.isArray(rec.tadabbur) ? rec.tadabbur.filter(t => t && t.id) : [];
  rec.srs = { ...newCard(), ...(r.srs || {}) };
  if (!Array.isArray(rec.srs.history)) rec.srs.history = [];
  return rec;
}

// ---------- التحفيز ----------
// قائمة واحدة لكل التطبيق: [{ id, text, img?, source?, time?, createdAt }]
// تُحفظ في نفس مخزن الصفحات بمفتاح خاص، حتى لا نحتاج ترقية قاعدة البيانات
// (الترقية قد تتعطل إن بقيت نسخة قديمة من التطبيق مفتوحة في تبويب آخر)
export const MOTIVATION_KEY = "__motivation";
export const motivations = [];

export async function saveMotivations() {
  await DB.pages.put({ page: MOTIVATION_KEY, items: motivations });
}

export async function loadPages() {
  const all = await DB.pages.all();
  pages.clear();
  motivations.length = 0;
  for (const r of all) {
    if (r.page === MOTIVATION_KEY) {
      if (Array.isArray(r.items)) motivations.push(...r.items.filter(m => m && m.id));
      continue;
    }
    const rec = normalizeRecord(r);
    if (rec.page >= 1 && rec.page <= TOTAL_PAGES) pages.set(rec.page, rec);
  }
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export async function savePage(rec) {
  rec.updatedAt = new Date().toISOString();
  await DB.pages.put(rec);
  pages.set(rec.page, rec);
}

export async function savePages(recs) {
  const now = new Date().toISOString();
  for (const r of recs) r.updatedAt = now;
  await DB.pages.putMany(recs);
  for (const r of recs) pages.set(r.page, r);
}

export async function removePage(n) {
  await DB.pages.remove(n);
  pages.delete(n);
}

// ---------- المراجعة ----------
export function dueList(t = todayStr()) {
  return [...pages.values()].filter(p => isDue(p.srs, t));
}

const missCount = p => p.ayahs.reduce((s, x) => s + (x.miss || 0), 0);

// كلما زادت القيمة كانت الصفحة أضعف
export function weakness(p) {
  return (2.5 - p.srs.ease) * 2 + p.srs.lapses * 0.5 + missCount(p) * 0.15 - Math.min(p.srs.interval, 60) / 60;
}

// أولوية المستحقة: الأكثر تأخراً نسبةً لفاصلها، ثم الأضعف
function priority(p, t) {
  return daysBetween(p.srs.due, t) / Math.max(1, p.srs.interval) + weakness(p) * 0.3;
}

export function buildQueue({ extra = false } = {}) {
  const t = todayStr();
  let list = extra
    ? [...pages.values()].filter(p => !isDue(p.srs, t)).sort((a, b) => weakness(b) - weakness(a))
    : dueList(t).sort((a, b) => priority(b, t) - priority(a, t));
  list = list.slice(0, settings.maxReviews);
  if (settings.order === "mushaf") list.sort((a, b) => a.page - b.page);
  return list.map(p => p.page);
}

export function weakPages(n = 5) {
  return [...pages.values()]
    .filter(p => p.srs.lapses || missCount(p) || p.srs.ease < 2.5)
    .sort((a, b) => weakness(b) - weakness(a))
    .slice(0, n);
}

// الصفحة المقترحة للحفظ الجديد: التي تلي آخر صفحة سجّلتها
// (الصفحات المسجلة دفعة واحدة لا تُحتسب، فهي حفظ قديم وليست مسار الحفظ الجديد)
export function suggestNextPage() {
  const own = [...pages.values()].filter(p => !p.bulk);
  if (!own.length) return "";
  const latest = own.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
  for (let p = latest.page + 1; p <= TOTAL_PAGES; p++) if (!pages.has(p)) return p;
  return "";
}

// ---------- السجل اليومي والإحصائيات ----------
export function logReview() {
  const log = Store.get("reviewLog", {});
  const t = todayStr();
  log[t] = (log[t] || 0) + 1;
  Store.set("reviewLog", log);
}

export const reviewLog = () => Store.get("reviewLog", {});
export const todayCount = () => reviewLog()[todayStr()] || 0;

export function streak() {
  const log = reviewLog();
  let d = todayStr();
  let n = 0;
  if (!log[d]) d = addDays(d, -1); // لم تراجع اليوم بعد: لا ينقطع العدّ
  while (log[d]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// نسبة التذكر خلال آخر 30 يوماً (كل تقييم غير "نسيت" يُعد تذكراً)
export function retention(days = 30) {
  const since = addDays(todayStr(), -days);
  let n = 0, ok = 0;
  for (const p of pages.values()) {
    for (const h of p.srs.history) {
      if (h.d >= since) {
        n++;
        if (h.g > 0) ok++;
      }
    }
  }
  return n ? Math.round((ok * 100) / n) : null;
}
