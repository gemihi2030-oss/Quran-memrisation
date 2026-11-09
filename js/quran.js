// بيانات المصحف + جلب نص الصفحات وتخزينه للعمل دون إنترنت
import { PAGE_START, JUZ_PAGE, HIZB_PAGE, AYAH_COUNT } from "./quran-meta.js";
import { DB } from "./db.js";

export const TOTAL_PAGES = 604;
const API = "https://api.alquran.cloud/v1";

export const SURAH_NAMES = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
  "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
  "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
  "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
  "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
  "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
  "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
  "المسد", "الإخلاص", "الفلق", "الناس",
];

export const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

// ---------- معلومات الصفحة ----------
const lastIndexAtMost = (arr, p) => {
  let k = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] <= p) k = i;
  return k;
};
export const juzOfPage = p => lastIndexAtMost(JUZ_PAGE, p) + 1;
export const hizbOfPage = p => lastIndexAtMost(HIZB_PAGE, p) + 1;
export function juzRange(j) {
  return [JUZ_PAGE[j - 1], j < 30 ? JUZ_PAGE[j] - 1 : TOTAL_PAGES];
}

// أول وآخر آية في الصفحة: [سورة، آية]
export function pageRange(p) {
  const from = PAGE_START[p - 1];
  let to;
  if (p === TOTAL_PAGES) to = [114, AYAH_COUNT[113]];
  else {
    const [ns, na] = PAGE_START[p];
    to = na === 1 ? [ns - 1, AYAH_COUNT[ns - 2]] : [ns, na - 1];
  }
  return { from, to };
}

export function surahsOnPage(p) {
  const { from, to } = pageRange(p);
  const list = [];
  for (let s = from[0]; s <= to[0]; s++) list.push(s);
  return list;
}
export const surahLabel = p => surahsOnPage(p).map(s => SURAH_NAMES[s - 1]).join(" · ");

// السورة التي تبدأ بها الصفحة (لتجميع الصفحات حسب السورة)
export const firstSurahOfPage = p => PAGE_START[p - 1][0];

// أول وآخر صفحة تحتوي آيات السورة: [من، إلى]
let surahPageCache = null;
export function surahPages(s) {
  if (!surahPageCache) {
    surahPageCache = [];
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      for (const x of surahsOnPage(p)) {
        if (!surahPageCache[x]) surahPageCache[x] = [p, p];
        else surahPageCache[x][1] = p;
      }
    }
  }
  return surahPageCache[s];
}

export function ayahCountOnPage(p) {
  const { from, to } = pageRange(p);
  if (from[0] === to[0]) return to[1] - from[1] + 1;
  let n = AYAH_COUNT[from[0] - 1] - from[1] + 1;
  for (let s = from[0] + 1; s < to[0]; s++) n += AYAH_COUNT[s - 1];
  return n + to[1];
}

export function rangeLabel(p) {
  const { from, to } = pageRange(p);
  const name = s => SURAH_NAMES[s - 1];
  return from[0] === to[0]
    ? `${name(from[0])} ${from[1]}–${to[1]}`
    : `${name(from[0])} ${from[1]} ← ${name(to[0])} ${to[1]}`;
}

// ---------- أدوات النص ----------
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
export function normalizeArabic(s) {
  return String(s || "")
    .replace(DIACRITICS, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripBasmala(text, surah, ayah) {
  if (ayah !== 1 || surah === 1 || surah === 9) return { text, basmala: false };
  const words = text.split(" ");
  if (words.length > 4 && normalizeArabic(words.slice(0, 4).join(" ")) === "بسم الله الرحمن الرحيم") {
    return { text: words.slice(4).join(" "), basmala: true };
  }
  return { text, basmala: false };
}

export const firstWords = (text, n = 5) => String(text || "").split(/\s+/).filter(Boolean).slice(0, n).join(" ");
export const lastWords = (text, n = 5) => String(text || "").split(/\s+/).filter(Boolean).slice(-n).join(" ");
export const arDigits = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);

const fromArDigits = s => String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

// نص مكتوب يدوياً (آية في كل سطر، مع رقم اختياري ﴿12﴾ أو (12) في آخرها)
export function parseManualText(text) {
  return String(text || "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/^(.*?)\s*[﴿(]\s*([0-9٠-٩]+)\s*[﴾)]\s*$/);
      return m ? { s: null, a: +fromArDigits(m[2]), text: m[1].trim() } : { s: null, a: null, text: line };
    });
}

export const ayahsToText = ayahs => ayahs.map(x => (x.a ? `${x.text} ﴿${x.a}﴾` : x.text)).join("\n");

// ---------- الجلب من alquran.cloud (رسم عثماني) ----------
function convertAyah(x) {
  const { text, basmala } = stripBasmala(x.text, x.surah.number, x.numberInSurah);
  const out = { s: x.surah.number, a: x.numberInSurah, text };
  if (basmala) out.basmala = true;
  if (x.sajda) out.sajda = true;
  return out;
}

// يعيد آيات الصفحة من الذاكرة المحلية، أو يجلبها من الإنترنت ويخزنها
export async function getPageAyahs(p, { network = true } = {}) {
  if (!(p >= 1 && p <= TOTAL_PAGES)) return null;
  const cached = await DB.texts.get(p).catch(() => null);
  if (cached) return cached.ayahs;
  if (!network) return null;
  const res = await fetch(`${API}/page/${p}/quran-uthmani`);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const { data } = await res.json();
  const ayahs = data.ayahs.map(convertAyah);
  await DB.texts.put({ page: p, ayahs }).catch(() => {});
  return ayahs;
}

export async function cachedTextCount() {
  return (await DB.texts.keys().catch(() => [])).length;
}

// تنزيل المصحف كاملاً مرة واحدة للعمل دون إنترنت
export async function downloadWholeQuran(onProgress = () => {}) {
  onProgress("⏳ جارٍ تنزيل المصحف (بضعة ميغابايت)…");
  const res = await fetch(`${API}/quran/quran-uthmani`);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const { data } = await res.json();
  onProgress("⏳ جارٍ الحفظ على الجهاز…");
  const byPage = new Map();
  for (const surah of data.surahs) {
    for (const a of surah.ayahs) {
      const ayah = convertAyah({ ...a, surah: { number: surah.number } });
      if (!byPage.has(a.page)) byPage.set(a.page, []);
      byPage.get(a.page).push(ayah);
    }
  }
  await DB.texts.putMany([...byPage].map(([page, ayahs]) => ({ page, ayahs })));
  return byPage.size;
}

// عرض الآيات بشكل متصل كالمصحف مع رؤوس السور والبسملة
// marks: مجموعة أرقام الآيات (الفهرس) المعلّمة كأخطاء
export function renderAyahs(ayahs, { marks = new Set(), tappable = false, current = -1, showMiss = false, count = ayahs.length } = {}) {
  let html = "";
  let lastSurah = null;
  for (let i = 0; i < count && i < ayahs.length; i++) {
    const x = ayahs[i];
    if (x.s && x.a === 1 && x.s !== lastSurah) {
      html += `<span class="surah-head">سورة ${SURAH_NAMES[x.s - 1]}</span>`;
      if (x.basmala) html += `<span class="basmala-line">${BASMALA}</span>`;
    }
    lastSurah = x.s;
    const cls = ["ayah"];
    if (marks.has(i)) cls.push("bad");
    if (i === current) cls.push("current");
    if (showMiss && x.miss) cls.push("was-missed");
    const attrs = tappable ? ` data-action="toggle-ayah" data-i="${i}" role="button" tabindex="0"` : ` data-i="${i}"`;
    const marker = x.a ? `<span class="marker">${x.sajda ? "۩" : ""}﴿${arDigits(x.a)}﴾</span>` : "";
    html += `<span class="${cls.join(" ")}"${attrs}>${escapeText(x.text)} ${marker}</span> `;
  }
  return html;
}

function escapeText(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
