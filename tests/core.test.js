// اختبارات المنطق الأساسي — التشغيل: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { newCard, nextState, applyGrade, addDays, daysBetween, level, durationLabel, relativeDay, AGAIN, HARD, GOOD, EASY } from "../js/srs.js";
import {
  SURAH_NAMES, juzOfPage, hizbOfPage, juzRange, surahsOnPage, surahLabel, pageRange, ayahCountOnPage,
  stripBasmala, parseManualText, normalizeArabic, surahPages, firstSurahOfPage,
} from "../js/quran.js";
import { AYAH_COUNT, PAGE_START } from "../js/quran-meta.js";

const T = "2026-11-09";

test("dates", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-11-09", "2026-11-19"), 10);
});

test("new page: first review tomorrow, or today if asked", () => {
  assert.equal(newCard(T).due, "2026-11-10");
  assert.equal(newCard(T, 0).due, T);
});

test("learning ladder: good → 1, 3, then × ease", () => {
  let s = newCard(T);
  let day = "2026-11-10";
  s = nextState(s, GOOD, { today: day });
  assert.equal(s.interval, 1);
  day = s.due;
  s = nextState(s, GOOD, { today: day });
  assert.equal(s.interval, 3);
  day = s.due;
  s = nextState(s, GOOD, { today: day });
  assert.equal(s.interval, 8); // 3 × 2.5 = 7.5 → 8
});

test("grade ordering: again < hard < good < easy", () => {
  const s = { reps: 3, ease: 2.5, interval: 10, lapses: 0, due: T, last: addDays(T, -10), history: [] };
  const iv = g => nextState(s, g, { today: T }).interval;
  assert.equal(iv(AGAIN), 1);
  assert.ok(iv(HARD) < iv(GOOD), "hard < good");
  assert.ok(iv(GOOD) < iv(EASY), "good < easy");
});

test("forgetting resets and lowers ease", () => {
  const s = { reps: 4, ease: 2.5, interval: 20, lapses: 0, due: T, last: addDays(T, -20), history: [] };
  const n = nextState(s, AGAIN, { today: T });
  assert.equal(n.reps, 0);
  assert.equal(n.lapses, 1);
  assert.equal(n.interval, 1);
  assert.ok(Math.abs(n.ease - 2.3) < 1e-9);
});

test("ease never drops below 1.3, interval capped by maxInterval", () => {
  let s = { reps: 3, ease: 1.35, interval: 10, lapses: 0, due: T, last: addDays(T, -10), history: [] };
  s = nextState(s, HARD, { today: T });
  assert.equal(s.ease, 1.3);
  const big = { reps: 5, ease: 3, interval: 100, lapses: 0, due: T, last: addDays(T, -100), history: [] };
  assert.equal(nextState(big, EASY, { today: T, maxInterval: 120 }).interval, 120);
});

test("late but remembered gives a longer interval", () => {
  const onTime = { reps: 3, ease: 2.5, interval: 10, lapses: 0, due: T, last: addDays(T, -10), history: [] };
  const late = { ...onTime, last: addDays(T, -30) };
  assert.ok(nextState(late, GOOD, { today: T }).interval > nextState(onTime, GOOD, { today: T }).interval);
});

test("fuzz stays within ±5% and history is recorded", () => {
  const s = { reps: 3, ease: 2.5, interval: 40, lapses: 0, due: T, last: addDays(T, -40), history: [] };
  const base = nextState(s, GOOD, { today: T }).interval;
  for (const r of [0, 0.5, 0.999]) {
    const v = nextState(s, GOOD, { today: T, fuzz: true, rand: () => r }).interval;
    assert.ok(Math.abs(v - base) <= Math.ceil(base * 0.05), `${v} vs ${base}`);
  }
  const a = applyGrade(s, GOOD, { today: T });
  assert.deepEqual(a.history.at(-1), { d: T, g: GOOD });
  assert.equal(s.history.length, 0, "original untouched");
});

test("level colors", () => {
  assert.equal(level(newCard(T), T), "new");
  assert.equal(level({ ...newCard(T), due: T }, T), "due");
  assert.equal(level({ interval: 3, due: "2026-11-12", last: T }, T), "weak");
  assert.equal(level({ interval: 10, due: "2026-11-19", last: T }, T), "mid");
  assert.equal(level({ interval: 45, due: "2026-12-24", last: T }, T), "strong");
});

test("arabic durations", () => {
  assert.equal(durationLabel(1), "يوم");
  assert.equal(durationLabel(2), "يومان");
  assert.equal(durationLabel(5), "5 أيام");
  assert.equal(durationLabel(15), "15 يوماً");
  assert.equal(durationLabel(60, { genitive: true }), "شهرين");
  assert.equal(relativeDay("2026-11-10", T), "غداً");
  assert.equal(relativeDay("2026-11-16", T), "بعد 7 أيام");
  assert.equal(relativeDay("2026-11-07", T), "متأخرة منذ يومين");
});

test("mushaf metadata", () => {
  assert.equal(SURAH_NAMES.length, 114);
  assert.equal(AYAH_COUNT.reduce((a, b) => a + b, 0), 6236);
  assert.equal(PAGE_START.length, 604);
  assert.equal(juzOfPage(1), 1);
  assert.equal(juzOfPage(21), 1);
  assert.equal(juzOfPage(22), 2);
  assert.equal(juzOfPage(121), 7);
  assert.equal(juzOfPage(604), 30);
  assert.deepEqual(juzRange(30), [582, 604]);
  assert.equal(hizbOfPage(1), 1);
  assert.equal(hizbOfPage(604), 60);
  assert.deepEqual(surahsOnPage(1), [1]);
  assert.equal(surahLabel(50), "آل عمران");
  assert.deepEqual(surahsOnPage(604), [112, 113, 114]);
  assert.deepEqual(pageRange(2), { from: [2, 1], to: [2, 5] });
  assert.equal(ayahCountOnPage(1), 7);
  // مجموع آيات كل الصفحات = عدد آيات القرآن
  let total = 0;
  for (let p = 1; p <= 604; p++) total += ayahCountOnPage(p);
  assert.equal(total, 6236);
});

test("surah page ranges", () => {
  assert.deepEqual(surahPages(1), [1, 1]);
  assert.deepEqual(surahPages(2), [2, 49]); // البقرة: 48 صفحة
  assert.deepEqual(surahPages(3), [50, 76]);
  assert.deepEqual(surahPages(18), [293, 304]); // الكهف
  assert.deepEqual(surahPages(114), [604, 604]);
  assert.equal(firstSurahOfPage(12), 2);
  assert.equal(firstSurahOfPage(604), 112);
  for (let s = 1; s <= 114; s++) assert.ok(surahPages(s), `surah ${s} has pages`);
});

test("basmala stripping (including the بِّسْمِ variant)", () => {
  const b = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
  assert.deepEqual(stripBasmala(b + " قُلْ هُوَ ٱللَّهُ أَحَدٌ", 112, 1), { text: "قُلْ هُوَ ٱللَّهُ أَحَدٌ", basmala: true });
  assert.deepEqual(stripBasmala("بِّسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ وَٱلتِّينِ وَٱلزَّيْتُونِ", 95, 1).text, "وَٱلتِّينِ وَٱلزَّيْتُونِ");
  assert.equal(stripBasmala(b, 1, 1).basmala, false, "الفاتحة: البسملة آية");
  assert.equal(stripBasmala("بَرَآءَةٌ مِّنَ ٱللَّهِ", 9, 1).basmala, false);
  assert.equal(normalizeArabic("ٱلرَّحْمَٰنِ"), "الرحمن");
});

test("v1 backup records are upgraded on import", async () => {
  const { normalizeRecord } = await import("../js/state.js");
  const v1 = {
    page: "12", surah: "البقرة", text: "أَوَلَا يَعْلَمُونَ ﴿77﴾\nوَمِنْهُمْ أُمِّيُّونَ ﴿78﴾", cue: "أَوَلَا يَعْلَمُونَ",
    links: ["الأميون"], notes: "قصة", images: [], createdAt: "2026-10-01",
    srs: { reps: 2, ease: 2.4, interval: 3, lapses: 1, due: "2026-11-09", last: "2026-11-06", history: [{ d: "2026-11-06", g: 2 }] },
  };
  const r = normalizeRecord(v1);
  assert.equal(r.page, 12);
  assert.equal(r.text, undefined);
  assert.deepEqual(r.ayahs.map(x => x.a), [77, 78]);
  assert.deepEqual(r.srs, v1.srs);
  assert.deepEqual(r.links, ["الأميون"]);
  assert.deepEqual(r.maps, [], "v1 records get an empty mind-map list");
  const bare = normalizeRecord({ page: 5, srs: { due: "2026-11-09" } });
  assert.deepEqual(bare.ayahs, []);
  assert.deepEqual(bare.maps, []);
  assert.equal(bare.srs.ease, 2.5);
  assert.deepEqual(bare.srs.history, []);
});

test("manual text parsing (v1 compatible)", () => {
  const out = parseManualText("الم ﴿1﴾\nذَٰلِكَ ٱلْكِتَٰبُ (٢)\n\nآية بلا رقم");
  assert.deepEqual(out, [
    { s: null, a: 1, text: "الم" },
    { s: null, a: 2, text: "ذَٰلِكَ ٱلْكِتَٰبُ" },
    { s: null, a: null, text: "آية بلا رقم" },
  ]);
});
