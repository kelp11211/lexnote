export const SECTIONS = [
  "Abstract",
  "Introduction",
  "Related Work",
  "Methodology",
  "Evaluation",
  "Results",
  "Discussion",
  "Conclusion",
  "General",
];
export const normalize = (s) => s.trim().replace(/\s+/g, " ").toLowerCase();
export const AI_FIELDS = [
  "phonetic",
  "partOfSpeech",
  "translations",
  "definition",
  "usage",
  "collocations",
  "academicExamples",
  "synonyms",
  "sections",
];
const fail = (m) => {
  throw new Error(m);
};
function str(v, k, def = "") {
  if (v === undefined) return def;
  if (typeof v !== "string") fail(`${k} 必須是文字`);
  if (v.length > 20000) fail(`${k} 超過 20,000 字元`);
  return v.trim();
}
function arr(v, k, mapper = (x) => str(x, k)) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) fail(`${k} 必須是陣列`);
  if (v.length > 200) fail(`${k} 超過 200 項`);
  return v.map(mapper);
}
export function safeURL(s) {
  try {
    const u = new URL(s);
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export function validateEntry(v, { external = false } = {}) {
  if (!v || typeof v !== "object" || Array.isArray(v)) fail("詞彙必須是物件");
  const word = str(v.word, "word");
  if (!word) fail("請輸入英文詞彙");
  if (word.length > 500) fail("詞彙不可超過 500 字元");
  if (!["word", "phrase", "pattern"].includes(v.type))
    fail("type 必須為 word、phrase 或 pattern");
  const now = new Date().toISOString();
  const id = v.id ?? (external ? fail("缺少 id") : crypto.randomUUID());
  if (
    typeof id !== "string" ||
    !/^\w{8}-\w{4}-[1-8]\w{3}-[89ab]\w{3}-\w{12}$/i.test(id) ||
    !/^[\da-f-]+$/i.test(id)
  )
    fail("id 必須是有效 UUID");
  const out = { id, word, wordNormalized: normalize(word), type: v.type };
  for (const k of ["phonetic", "definition", "usage", "originalContext"])
    out[k] = str(v[k], k);
  for (const k of ["partOfSpeech", "translations", "collocations", "sections"])
    out[k] = [...new Set(arr(v[k], k).filter(Boolean))];
  // Legacy backup compatibility only: never create tags on new records.
  // Existing metadata survives editing/export without remaining an app feature.
  if (Object.hasOwn(v, "tags"))
    out.tags = [...new Set(arr(v.tags, "舊版 tags").filter(Boolean))];
  if (out.sections.some((x) => !SECTIONS.includes(x)))
    fail("sections 含不支援的論文章節");
  out.academicExamples = arr(v.academicExamples, "academicExamples", (x) => {
    if (!x || typeof x !== "object") fail("例句必須是物件");
    const en = str(x.en, "例句英文"),
      zh = str(x.zh, "例句中文");
    if (!en && zh) fail("例句有中文但缺少英文");
    return { en, zh };
  }).filter((x) => x.en);
  out.synonyms = arr(v.synonyms, "synonyms", (x) => {
    if (!x || typeof x !== "object") fail("同義詞必須是物件");
    const word = str(x.word, "同義詞"),
      difference = str(x.difference, "同義詞差異");
    if (!word && difference) fail("同義詞差異缺少詞彙");
    return { word, difference };
  }).filter((x) => x.word);
  if (
    v.source !== undefined &&
    (!v.source || typeof v.source !== "object" || Array.isArray(v.source))
  )
    fail("source 必須是物件");
  out.source = Object.fromEntries(
    ["title", "doi", "url"].map((k) => [k, str(v.source?.[k], `source.${k}`)]),
  );
  if (out.source.url && !safeURL(out.source.url))
    fail("來源網址須為完整 http 或 https 網址");
  if (v.favorite !== undefined && typeof v.favorite !== "boolean")
    fail("favorite 必須是布林值");
  out.favorite = v.favorite ?? false;
  out.familiarity = v.familiarity ?? 0;
  if (
    !Number.isInteger(out.familiarity) ||
    out.familiarity < 0 ||
    out.familiarity > 3
  )
    fail("熟悉程度必須為 0–3");
  for (const k of ["createdAt", "updatedAt"]) {
    out[k] = str(v[k], k, now);
    if (
      !/^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/.test(out[k]) ||
      !Number.isFinite(Date.parse(out[k]))
    )
      fail(`${k} 必須是 ISO 日期時間`);
  }
  return out;
}
