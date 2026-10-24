import { validateEntry } from "./schema.js";
export const MAX_BYTES = 10 * 1024 * 1024;
export const key = (e) => `${e.type}:${e.wordNormalized}`;
export function parseBackup(text) {
  if (new TextEncoder().encode(text).length > MAX_BYTES)
    throw new Error("備份超過 10 MB");
  let v;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error("JSON 格式錯誤，請檢查括號與引號");
  }
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("備份頂層必須是 JSON 物件");
  if (v.schemaVersion !== 1)
    throw new Error("不支援此 schemaVersion，僅接受版本 1");
  if (!Array.isArray(v.entries) || v.entries.length > 10000)
    throw new Error("entries 必須為陣列，最多 10,000 筆");
  if (
    typeof v.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(v.exportedAt))
  )
    throw new Error("缺少有效 exportedAt");
  const errors = [],
    ids = new Set(),
    keys = new Set(),
    entries = [];
  v.entries.forEach((e, i) => {
    try {
      const n = validateEntry(e, { external: true });
      if (ids.has(n.id) || keys.has(key(n)))
        throw new Error("檔案內含重複 ID 或詞彙");
      ids.add(n.id);
      keys.add(key(n));
      entries.push(n);
    } catch (err) {
      errors.push(`第 ${i + 1} 筆：${err.message}`);
    }
  });
  return { entries, errors, total: v.entries.length };
}
export function previewImport(incoming, local) {
  const ids = new Set(local.map((x) => x.id)),
    keys = new Set(local.map(key));
  let added = 0,
    duplicate = 0,
    conflict = 0;
  for (const e of incoming) {
    if (ids.has(e.id)) duplicate++;
    else if (keys.has(key(e))) conflict++;
    else added++;
  }
  return { total: incoming.length, added, duplicate, conflict };
}
