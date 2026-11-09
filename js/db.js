// التخزين على الجهاز: IndexedDB للصفحات والنصوص (تتسع للصور) + localStorage للإعدادات
// نفس اسم قاعدة النسخة الأولى، مع ترقية للنسخة 2 دون فقدان البيانات
const NAME = "quran-memorisation";
const VERSION = 2;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("pages")) db.createObjectStore("pages", { keyPath: "page" });
        if (!db.objectStoreNames.contains("texts")) db.createObjectStore("texts", { keyPath: "page" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("blocked: close other tabs of the app"));
    });
  }
  return dbPromise;
}

async function run(storeName, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const req = fn(t.objectStore(storeName));
    t.oncomplete = () => resolve(req && "result" in req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("transaction aborted"));
  });
}

function store(name) {
  return {
    all: () => run(name, "readonly", s => s.getAll()),
    keys: () => run(name, "readonly", s => s.getAllKeys()),
    get: key => run(name, "readonly", s => s.get(key)),
    put: value => run(name, "readwrite", s => s.put(value)),
    putMany: values => run(name, "readwrite", s => { for (const v of values) s.put(v); }),
    remove: key => run(name, "readwrite", s => s.delete(key)),
    clear: () => run(name, "readwrite", s => s.clear()),
  };
}

export const DB = { pages: store("pages"), texts: store("texts") };

export const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};
