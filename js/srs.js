// خوارزمية التكرار المتباعد (مستوحاة من SM-2 / Anki)
// التقييم: 0 = نسيت، 1 = صعب، 2 = جيد، 3 = سهل
const SRS = (() => {
  const MIN_EASE = 1.3;

  function todayStr(d = new Date()) {
    const z = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return todayStr(new Date(y, m - 1, d + days));
  }
  function daysBetween(a, b) {
    const pa = a.split("-").map(Number), pb = b.split("-").map(Number);
    return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }

  // صفحة جديدة: أول مراجعة غداً (المراجعة في اليوم التالي مهمة جداً لتثبيت الحفظ)
  function newCard() {
    return { reps: 0, ease: 2.5, interval: 0, lapses: 0, due: addDays(todayStr(), 1), last: null, history: [] };
  }

  // حساب الحالة التالية دون تعديل الأصل
  function next(srs, grade, maxInterval = 180) {
    const s = { ...srs };
    let interval;
    if (grade === 0) {
      s.lapses += 1;
      s.reps = 0;
      s.ease = Math.max(MIN_EASE, s.ease - 0.2);
      interval = 1;
    } else {
      if (grade === 1) {
        s.ease = Math.max(MIN_EASE, s.ease - 0.15);
        interval = s.reps === 0 ? 1 : Math.max(s.interval + 1, Math.round(s.interval * 1.2));
      } else if (grade === 2) {
        interval = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.round(s.interval * s.ease);
      } else {
        s.ease += 0.15;
        interval = s.reps === 0 ? 3 : s.reps === 1 ? 6 : Math.round(s.interval * s.ease * 1.3);
      }
      s.reps += 1;
    }
    s.interval = Math.min(maxInterval, Math.max(1, interval));
    s.due = addDays(todayStr(), s.interval);
    s.last = todayStr();
    return s;
  }

  function apply(srs, grade, maxInterval) {
    const s = next(srs, grade, maxInterval);
    s.history = [...(srs.history || []), { d: s.last, g: grade }].slice(-50);
    return s;
  }

  function isDue(srs, today = todayStr()) { return srs.due <= today; }

  // قوة الحفظ لتلوين الشبكة
  function level(srs, today = todayStr()) {
    if (isDue(srs, today)) return "due";
    if (srs.interval >= 21) return "strong";
    if (srs.interval >= 5) return "mid";
    return "weak";
  }

  function intervalLabel(days) {
    if (days <= 1) return "غداً";
    if (days === 2) return "يومان";
    if (days < 11) return `${days} أيام`;
    if (days < 30) return `${days} يوماً`;
    const m = Math.round(days / 30);
    return m === 1 ? "شهر" : m === 2 ? "شهران" : `${m} أشهر`;
  }

  return { todayStr, addDays, daysBetween, newCard, next, apply, isDue, level, intervalLabel };
})();
