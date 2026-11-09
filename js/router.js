// تنقل بسيط بين الشاشات (مع دعم زر الرجوع في الهاتف عبر #)
const views = new Map();
let currentView = null;
let afterRender = () => {};

export function register(name, render) {
  views.set(name, render);
}

export function onAfterRender(fn) {
  afterRender = fn;
}

export function show(name, { push = true } = {}) {
  if (!views.has(name)) name = "home";
  const changed = currentView !== name;
  currentView = name;
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  if (push && location.hash !== "#" + name) history.pushState(null, "", "#" + name);
  views.get(name)();
  afterRender();
  if (changed) window.scrollTo(0, 0);
}

export function refresh() {
  if (currentView) views.get(currentView)();
  afterRender();
}

export const current = () => currentView;

// تحديث العناصر المشتركة (مثل عدد المستحقات على زر المراجعة) دون إعادة رسم الشاشة
export const updateChrome = () => afterRender();

window.addEventListener("popstate", () => {
  const name = location.hash.slice(1) || "home";
  if (name !== currentView) show(name, { push: false });
});
