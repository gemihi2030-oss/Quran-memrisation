// أدوات عامة للواجهة
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const lines = s => String(s || "").split("\n").map(x => x.trim()).filter(Boolean);

// الإشعار يظهر فوق النوافذ المفتوحة أيضاً (popover في الطبقة العليا)
export function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg;
  if (t.showPopover) {
    try {
      if (t.matches(":popover-open")) t.hidePopover(); // لإعادته فوق آخر نافذة فُتحت
      t.showPopover();
    } catch {}
  }
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => {
      if (!t.classList.contains("show") && t.hidePopover) {
        try {
          t.hidePopover();
        } catch {}
      }
    }, 300);
  }, ms);
}

// معالجة النقرات بعناصر data-action داخل حاوية
export function delegate(el, handlers, type = "click") {
  el.addEventListener(type, e => {
    const t = e.target.closest("[data-action]");
    if (!t || !el.contains(t)) return;
    const fn = handlers[t.dataset.action];
    if (fn) fn(t, e);
  });
}

// تصغير الصورة قبل تخزينها (تبقى صغيرة الحجم على الجهاز)
export function compressImage(file, max = 1000, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

// مولد أرقام عشوائية ثابت البذرة (نفس الفراغات لنفس الصفحة في نفس اليوم)
export function seededRandom(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function downloadFile(name, text, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const fmtGregorian = (d = new Date()) =>
  d.toLocaleDateString("ar-DZ", { weekday: "long", day: "numeric", month: "long" });

export function fmtHijri(d = new Date()) {
  try {
    return d.toLocaleDateString("ar-DZ-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

// زر التبديل بين العرض المفصّل والمصغّر (كما في تطبيقات القوائم): data-mode = detail | compact
const ICON_DETAIL = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="13" width="7" height="7" rx="1.5"/><path d="M14 6h7M14 9.5h4.5M14 15h7M14 18.5h4.5"/></svg>`;
const ICON_COMPACT = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;
export function viewToggleHTML(action, current) {
  const b = (mode, icon, label) =>
    `<button type="button" class="${current === mode ? "on" : ""}" data-action="${action}" data-mode="${mode}" aria-pressed="${current === mode}" aria-label="${label}" title="${label}">${icon}</button>`;
  return `<div class="view-toggle" role="group" aria-label="طريقة العرض">${b("detail", ICON_DETAIL, "عرض مفصّل")}${b("compact", ICON_COMPACT, "عرض مصغّر")}</div>`;
}
