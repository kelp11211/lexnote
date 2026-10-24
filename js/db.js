import { validateEntry } from "./schema.js";
let database;
export function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("academic_vocabulary_db", 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      const s = db.createObjectStore("entries", { keyPath: "id" });
      for (const k of ["wordNormalized", "type", "favorite", "createdAt"])
        s.createIndex(k, k);
      s.createIndex("uniqueWord", ["type", "wordNormalized"], { unique: true });
      for (const k of ["settings", "metadata"])
        db.createObjectStore(k, { keyPath: "key" });
    };
    r.onerror = () =>
      reject(new Error("無法開啟資料庫，請檢查瀏覽器權限；請勿清除網站資料。"));
    r.onblocked = () =>
      reject(new Error("資料庫升級遭封鎖，請關閉其他 Lexnote 分頁後重試。"));
    r.onsuccess = () => {
      database = r.result;
      database.onversionchange = () => {
        database.close();
        location.reload();
      };
      resolve(database);
    };
  });
}
export function transaction(store, mode, fn) {
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = database.transaction(store, mode);
      const result = fn(tx.objectStore(store));
      tx.oncomplete = () =>
        resolve(typeof result === "function" ? result() : result?.result);
      tx.onabort = tx.onerror = () =>
        reject(tx.error || new Error("資料寫入失敗"));
    } catch (e) {
      tx?.abort();
      reject(e);
    }
  });
}
export const allEntries = () =>
  transaction("entries", "readonly", (s) => s.getAll());
export const getValue = (store, key) =>
  transaction(store, "readonly", (s) => s.get(key)).then((x) => x?.value);
export const setValue = (store, key, value) =>
  transaction(store, "readwrite", (s) => s.put({ key, value }));
export async function saveEntry(input) {
  const entry = validateEntry(input);
  await transaction("entries", "readwrite", (s) => s.put(entry));
  return entry;
}
export const deleteEntry = (id) =>
  transaction("entries", "readwrite", (s) => s.delete(id));
// Read, classify, clear and write in one transaction; concurrent tabs cannot interleave.
export function importEntries(incoming, replace = false) {
  return transaction("entries", "readwrite", (s) => {
    let result;
    const r = s.getAll();
    r.onsuccess = () => {
      const local = r.result;
      const ids = new Set(local.map((e) => e.id)),
        keys = new Set(local.map((e) => `${e.type}:${e.wordNormalized}`));
      let added = 0,
        skipped = 0;
      if (replace) s.clear();
      for (const e of incoming) {
        if (
          !replace &&
          (ids.has(e.id) || keys.has(`${e.type}:${e.wordNormalized}`))
        ) {
          skipped++;
          continue;
        }
        s.put(e);
        added++;
      }
      result = { added, skipped };
    };
    return () => result;
  });
}
