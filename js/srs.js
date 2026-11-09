// خوارزمية التكرار المتباعد (مستوحاة من SM-2 / Anki)
// التقييم: 0 = نسيت · 1 = صعب · 2 = جيد · 3 = سهل
export const AGAIN = 0, HARD = 1, GOOD = 2, EASY = 3;
export const GRADE_LABELS = ["نسيت", "صعب", "جيد", "سهل"];
const MIN_EASE = 1.3;

// ---------- التواريخ (بالتوقيت المحلي، بصيغة YYYY-MM-DD) ----------
const pad = n => String(n).padStart(2, "0");
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}
export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

// صفحة جديدة: أول مراجعة غداً افتراضياً (مراجعة اليوم التالي أهم خطوة لتثبيت الحفظ)
export function newCard(today = todayStr(), delay = 1) {
  return { reps: 0, ease: 2.5, interval: 0, lapses: 0, due: addDays(today, delay), last: null, history: [] };
}

// الحالة التالية دون تعديل الأصل
export function nextState(srs, grade, { today = todayStr(), maxInterval = 120, fuzz = false, rand = Math.random } = {}) {
  const s = { ...srs };
  const cur = Math.max(0, s.interval || 0);
  // إن تأخرت المراجعة وتذكرتَ رغم ذلك، فالحفظ أقوى مما ظُن: نحتسب جزءاً من التأخير
  const elapsed = s.last ? Math.max(0, daysBetween(s.last, today)) : cur;
  const late = Math.max(0, elapsed - cur);
  let ivl;

  if (grade === AGAIN) {
    s.lapses = (s.lapses || 0) + 1;
    s.reps = 0;
    s.ease = Math.max(MIN_EASE, s.ease - 0.2);
    ivl = 1;
  } else {
    if (grade === HARD) {
      s.ease = Math.max(MIN_EASE, s.ease - 0.15);
      ivl = s.reps === 0 ? 1 : Math.max(cur + 1, Math.round((cur + late / 4) * 1.2));
    } else if (grade === GOOD) {
      ivl = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.max(cur + 1, Math.round((cur + late / 2) * s.ease));
    } else {
      s.ease += 0.15;
      ivl = s.reps === 0 ? 3 : s.reps === 1 ? 6 : Math.max(cur + 2, Math.round((cur + late) * s.ease * 1.3));
    }
    s.reps += 1;
  }

  // تذبذب بسيط (±5٪) حتى لا تتكدس الصفحات المحفوظة في نفس اليوم على نفس الموعد
  if (fuzz && ivl >= 4) {
    const f = Math.max(1, Math.round(ivl * 0.05));
    ivl += Math.round((rand() * 2 - 1) * f);
  }
  s.interval = Math.min(maxInterval, Math.max(1, ivl));
  s.due = addDays(today, s.interval);
  s.last = today;
  return s;
}

export function applyGrade(srs, grade, opts = {}) {
  const s = nextState(srs, grade, { fuzz: true, ...opts });
  s.history = [...(srs.history || []), { d: s.last, g: grade }].slice(-60);
  return s;
}

export const isDue = (srs, today = todayStr()) => srs.due <= today;

// قوة الحفظ (لتلوين الخريطة)
export function level(srs, today = todayStr()) {
  if (isDue(srs, today)) return "due";
  if (!srs.last) return "new";
  if (srs.interval >= 30) return "strong";
  if (srs.interval >= 7) return "mid";
  return "weak";
}

// ---------- صياغة المدد بالعربية ----------
export function durationLabel(days, { genitive = false } = {}) {
  if (days < 30) {
    if (days <= 1) return "يوم";
    if (days === 2) return genitive ? "يومين" : "يومان";
    if (days <= 10) return `${days} أيام`;
    return `${days} يوماً`;
  }
  if (days >= 365) {
    const y = Math.round(days / 365);
    return y === 1 ? "سنة" : y === 2 ? (genitive ? "سنتين" : "سنتان") : `${y} سنوات`;
  }
  const m = Math.round(days / 30);
  if (m === 1) return "شهر";
  if (m === 2) return genitive ? "شهرين" : "شهران";
  return m <= 10 ? `${m} أشهر` : `${m} شهراً`;
}

export function relativeDay(dateStr, today = todayStr()) {
  const d = daysBetween(today, dateStr);
  if (d < 0) return `متأخرة منذ ${durationLabel(-d, { genitive: true })}`;
  if (d === 0) return "اليوم";
  if (d === 1) return "غداً";
  if (d === 2) return "بعد غد";
  return `بعد ${durationLabel(d, { genitive: true })}`;
}
