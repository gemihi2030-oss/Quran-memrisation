// نقطة البداية
import { $, $$, fmtGregorian, fmtHijri, toast } from "./util.js";
import { loadPages, applyTheme, dueList, pages } from "./state.js";
import { register, show, refresh, onAfterRender } from "./router.js";
import { todayStr } from "./srs.js";
import { renderHome } from "./views/home.js";
import { renderReview } from "./views/review.js";
import { renderMushaf } from "./views/mushaf.js";
import { renderSettings } from "./views/settings.js";

register("home", renderHome);
register("review", renderReview);
register("pages", renderMushaf);
register("settings", renderSettings);

onAfterRender(() => {
  const n = dueList().length;
  const badge = $("#navBadge");
  badge.hidden = !n;
  badge.textContent = n;
});

function updateDates() {
  $("#todayLabel").textContent = fmtGregorian();
  $("#hijriLabel").textContent = fmtHijri();
}

async function init() {
  applyTheme();
  updateDates();
  $$(".tabbar button").forEach(b => b.addEventListener("click", () => show(b.dataset.view)));
  try {
    await loadPages();
  } catch (e) {
    console.error(e);
    toast("تعذر فتح قاعدة البيانات — أغلق النوافذ الأخرى للتطبيق وأعد التحميل", 6000);
  }
  show(location.hash.slice(1) || "home", { push: false });

  // اطلب من المتصفح عدم حذف البيانات تلقائياً عند امتلاء المساحة
  if (pages.size && navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  // يوم جديد أثناء فتح التطبيق: نحدّث المستحقات
  let day = todayStr();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && todayStr() !== day) {
      day = todayStr();
      updateDates();
      refresh();
    }
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init().then(() => {
  try {
    sessionStorage.removeItem("qm-repaired"); // نجح التحميل: نسمح بإصلاح ذاتي جديد مستقبلاً
  } catch {}
});
