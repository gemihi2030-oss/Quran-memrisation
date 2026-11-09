// تخزين الصفحات في IndexedDB (يتسع للصور أكثر من localStorage)
const DB = (() => {
  const NAME = "quran-memorisation", VERSION = 1, STORE = "pages";
  let dbPromise;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(NAME, VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "page" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      const result = fn(store);
      t.oncomplete = () => resolve(result && "result" in result ? result.result : result);
      t.onerror = () => reject(t.error);
    });
  }

  return {
    all: () => tx("readonly", s => s.getAll()),
    get: page => tx("readonly", s => s.get(page)),
    put: rec => tx("readwrite", s => s.put(rec)),
    remove: page => tx("readwrite", s => s.delete(page)),
    clear: () => tx("readwrite", s => s.clear()),
  };
})();

// إعدادات وسجل المراجعات اليومية (خفيفة → localStorage)
const Store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};
