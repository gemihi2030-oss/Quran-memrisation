// عارض الصور بحجم الشاشة، مع التنقل بين الصور (أزرار، سحب بالإصبع، أسهم لوحة المفاتيح)
import { $, esc } from "../util.js";

const dlg = () => $("#imageDialog");
let items = [];
let idx = 0;
let onOpenPage = null;
let touchX = null;

// list: [{ src, caption, page }]
export function openGallery(list, start = 0, opts = {}) {
  if (!list.length) return;
  items = list;
  idx = Math.max(0, Math.min(start, list.length - 1));
  onOpenPage = opts.onOpenPage || null;
  render();
  if (!dlg().open) dlg().showModal();
}

function render() {
  const it = items[idx];
  const many = items.length > 1;
  dlg().innerHTML = `
    <button type="button" class="icon-btn lb-close" data-lb="close" aria-label="إغلاق">✕</button>
    <img src="${it.src}" alt="${esc(it.caption || "")}">
    <div class="lb-bar">
      ${many ? `<button type="button" class="lb-btn" data-lb="prev" ${idx === 0 ? "disabled" : ""}>→ السابقة</button>` : ""}
      <span class="lb-cap">${esc(it.caption || "")}${many ? ` <small>(${idx + 1} / ${items.length})</small>` : ""}</span>
      ${many ? `<button type="button" class="lb-btn" data-lb="next" ${idx === items.length - 1 ? "disabled" : ""}>التالية ←</button>` : ""}
    </div>
    ${onOpenPage && it.page ? `<button type="button" class="btn small lb-open" data-lb="open">📖 فتح الصفحة ${it.page}</button>` : ""}`;
}

function go(step) {
  const n = idx + step;
  if (n < 0 || n >= items.length) return;
  idx = n;
  render();
}

const d = dlg();
d.addEventListener("click", e => {
  const b = e.target.closest("[data-lb]");
  if (!b) {
    if (e.target.tagName !== "IMG") d.close(); // الضغط خارج الصورة يغلق العارض
    return;
  }
  const act = b.dataset.lb;
  if (act === "close") d.close();
  else if (act === "next") go(1);
  else if (act === "prev") go(-1);
  else if (act === "open") {
    const page = items[idx].page;
    d.close();
    onOpenPage?.(page);
  }
});
// في الاتجاه العربي: السحب نحو اليمين = الصورة التالية
d.addEventListener("touchstart", e => (touchX = e.touches[0].clientX), { passive: true });
d.addEventListener("touchend", e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) go(dx > 0 ? 1 : -1);
});
d.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") go(1);
  else if (e.key === "ArrowRight") go(-1);
});
