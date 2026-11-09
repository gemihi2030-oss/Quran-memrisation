// الإعدادات: المراجعة، العرض، العمل دون إنترنت، النسخ الاحتياطي
import { $, delegate, toast, downloadFile } from "../util.js";
import { settings, saveSettings, pages, loadPages, normalizeRecord, savePages, reviewLog, DEFAULTS } from "../state.js";
import { DB, Store } from "../db.js";
import { cachedTextCount, downloadWholeQuran, TOTAL_PAGES } from "../quran.js";
import { todayStr } from "../srs.js";
import { show } from "../router.js";

const root = () => $("#view-settings");

export async function renderSettings() {
  const lastExport = Store.get("lastExport", null);
  root().innerHTML = `
    <div class="card">
      <h2>💾 النسخ الاحتياطي</h2>
      <p class="muted">كل بياناتك محفوظة في هذا المتصفح على هذا الجهاز فقط (بلا حساب ولا خادم). صدّرها بانتظام، ويمكنك استيرادها على جهاز آخر. يقبل أيضاً ملفات النسخة الأولى من التطبيق.</p>
      <div class="row wrap gap-s">
        <button class="btn primary" data-action="export">⬇️ تصدير نسخة (JSON)</button>
        <label class="btn">⬆️ استيراد نسخة<input type="file" id="importInput" accept="application/json,.json" hidden></label>
      </div>
      <p class="muted small">${lastExport ? `آخر تصدير: ${lastExport}` : "لم تصدّر أي نسخة بعد."}</p>
    </div>

    <div class="card">
      <h2>🔁 المراجعة</h2>
      <label class="field">أقصى عدد صفحات في الجلسة
        <input type="number" id="setMaxReviews" min="1" max="300" value="${settings.maxReviews}">
      </label>
      <label class="field">أقصى مدة بين مراجعتين لنفس الصفحة (بالأيام)
        <input type="number" id="setMaxInterval" min="7" max="365" value="${settings.maxInterval}">
        <small class="muted">ننصح بـ 60 – 120 يوماً حتى لا تغيب أي صفحة طويلاً.</small>
      </label>
      <label class="field">ترتيب الصفحات في الجلسة
        <select id="setOrder">
          <option value="mushaf" ${settings.order === "mushaf" ? "selected" : ""}>حسب ترتيب المصحف (يقوّي ربط الصفحات)</option>
          <option value="priority" ${settings.order === "priority" ? "selected" : ""}>الأحوج للمراجعة أولاً</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" id="setAutoCue" ${settings.autoCue ? "checked" : ""}> إظهار بداية الصفحة تلقائياً عند المراجعة <small class="muted">(أطفئه لتحدٍّ أصعب: تذكّر البداية من رقم الصفحة فقط)</small></label>
    </div>

    <div class="card">
      <h2>🎨 العرض</h2>
      <label class="field">حجم خط الآيات
        <input type="range" id="setQuranSize" min="1.1" max="2.4" step="0.1" value="${settings.quranSize}">
      </label>
      <p class="quran preview-text" style="margin-top:0">ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ <span class="marker">﴿٢﴾</span></p>
      <label class="field">المظهر
        <select id="setTheme">
          <option value="auto" ${settings.theme === "auto" ? "selected" : ""}>تلقائي (حسب الجهاز)</option>
          <option value="light" ${settings.theme === "light" ? "selected" : ""}>فاتح</option>
          <option value="dark" ${settings.theme === "dark" ? "selected" : ""}>داكن</option>
        </select>
      </label>
    </div>

    <div class="card">
      <h2>📶 العمل دون إنترنت</h2>
      <p class="muted">تُجلب آيات كل صفحة من <a href="https://alquran.cloud" target="_blank" rel="noopener">alquran.cloud</a> (الرسم العثماني) وتُحفظ على جهازك. يمكنك تنزيل المصحف كاملاً مرة واحدة ليعمل التطبيق دون إنترنت.</p>
      <p id="offlineStatus" class="status">…</p>
      <button class="btn" data-action="download">⬇️ تنزيل المصحف كاملاً</button>
    </div>

    <div class="card danger-zone">
      <h2>⚠️ منطقة الخطر</h2>
      <button class="btn danger" data-action="wipe">حذف كل البيانات</button>
    </div>

    <p class="muted small center">QURAN MEMORISATION · الإصدار 2.0</p>`;
  updateOffline();
}

async function updateOffline() {
  const n = await cachedTextCount();
  const el = $("#offlineStatus");
  if (el) el.textContent = n >= TOTAL_PAGES ? "✓ المصحف كاملاً محفوظ على جهازك" : `محفوظ على الجهاز: ${n} / ${TOTAL_PAGES} صفحة`;
}

async function exportData() {
  const data = {
    app: "quran-memorisation",
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    reviewLog: reviewLog(),
    pages: [...pages.values()],
  };
  downloadFile(`quran-memorisation-${todayStr()}.json`, JSON.stringify(data));
  Store.set("lastExport", todayStr());
  toast("تم التصدير ✓ احفظ الملف في مكان آمن (Drive، بريدك…)");
  renderSettings();
}

async function importData(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
    if (!Array.isArray(data.pages)) throw new Error("bad");
  } catch {
    return toast("ملف غير صالح");
  }
  const valid = data.pages.filter(p => p && +p.page >= 1 && +p.page <= TOTAL_PAGES && p.srs);
  const clash = valid.filter(p => pages.has(+p.page)).length;
  if (!confirm(`استيراد ${valid.length} صفحة؟${clash ? `\n${clash} منها موجودة مسبقاً وسيتم استبدالها.` : ""}`)) return;
  await savePages(valid.map(normalizeRecord));
  if (data.reviewLog && typeof data.reviewLog === "object") {
    const merged = { ...data.reviewLog };
    for (const [d, n] of Object.entries(reviewLog())) merged[d] = Math.max(n, merged[d] || 0);
    Store.set("reviewLog", merged);
  }
  await loadPages();
  toast(`تم استيراد ${valid.length} صفحة ✓`);
  show("home");
}

function readForm() {
  settings.maxReviews = Math.min(300, Math.max(1, +$("#setMaxReviews").value || DEFAULTS.maxReviews));
  settings.maxInterval = Math.min(365, Math.max(7, +$("#setMaxInterval").value || DEFAULTS.maxInterval));
  settings.order = $("#setOrder").value;
  settings.autoCue = $("#setAutoCue").checked;
  settings.quranSize = +$("#setQuranSize").value;
  settings.theme = $("#setTheme").value;
  saveSettings();
}

delegate(root(), {
  export: exportData,
  download: async el => {
    el.disabled = true;
    try {
      const n = await downloadWholeQuran(msg => ($("#offlineStatus").textContent = msg));
      toast(`تم حفظ ${n} صفحة على جهازك ✓`);
    } catch {
      toast("تعذر التنزيل — تحقق من الاتصال بالإنترنت");
    }
    el.disabled = false;
    updateOffline();
  },
  wipe: async () => {
    if (!confirm("سيتم حذف كل الصفحات ومفاتيحها وسجل المراجعة نهائياً من هذا الجهاز. هل صدّرت نسخة احتياطية؟")) return;
    if (!confirm("تأكيد نهائي: حذف كل شيء؟")) return;
    await DB.pages.clear();
    Store.set("reviewLog", {});
    pages.clear();
    toast("تم حذف البيانات");
    show("home");
  },
});

root().addEventListener("change", e => {
  if (e.target.id === "importInput") {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = "";
    return;
  }
  readForm();
  toast("تم حفظ الإعدادات ✓", 1200);
});
root().addEventListener("input", e => {
  if (e.target.id === "setQuranSize") readForm();
});
