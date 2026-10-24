import test from "node:test";
import assert from "node:assert/strict";
import { validateEntry, normalize, safeURL } from "../js/schema.js";
import { search } from "../js/search.js";
import { parseBackup, previewImport } from "../js/backup.js";
import { parseAI, makePrompt } from "../js/ai.js";
const entry = () =>
  validateEntry({
    word: "mitigate",
    type: "word",
    translations: ["減輕"],
    collocations: ["mitigate risks"],
    academicExamples: [
      { en: "We mitigate potential risks.", zh: "我們降低潛在風險。" },
    ],
  });
test("quick entry defaults, normalization, deduplicated sections", () => {
  const e = validateEntry({
    word: "  In   Contrast To ",
    type: "phrase",
    sections: ["Discussion", "Discussion", ""],
  });
  assert.equal(e.wordNormalized, "in contrast to");
  assert.equal(e.favorite, false);
  assert.deepEqual(e.sections, ["Discussion"]);
  assert.equal(Object.hasOwn(e, "tags"), false);
  assert.equal(normalize("MITIGATE"), "mitigate");
});
test("reject invalid types, blank words, oversized content, URLs, familiarity, dates, IDs", () => {
  for (const patch of [
    { word: " " },
    { type: "wrong" },
    { translations: "bad" },
    { definition: "x".repeat(20001) },
    { favorite: "true" },
    { familiarity: 4 },
    { createdAt: "bad" },
    { id: "bad" },
    { source: { url: "javascript:alert(1)" } },
    { academicExamples: [{ zh: "不應默默丟棄" }] },
    { sections: ["bad"] },
  ])
    assert.throws(() => validateEntry({ ...entry(), ...patch }));
  assert.equal(safeURL("data:text/html,x"), null);
  assert.equal(safeURL("https://example.com"), "https://example.com/");
});
test("search translations, examples, collocations; combined filters and sorting", () => {
  const e = entry();
  for (const q of ["減輕", "MITIGATE RISKS", "潛在風險"])
    assert.equal(search([e], { q }).length, 1);
  assert.equal(search([e], { favorite: true }).length, 0);
  assert.equal(search([e], { type: "phrase" }).length, 0);
  assert.equal(search([e], { section: "Discussion" }).length, 0);
  const a = validateEntry({ word: "alpha", type: "word" });
  assert.equal(search([e, a], { sort: "alpha" })[0].word, "alpha");
});
test("backup validates entire file and duplicate entries, rejects future schema", () => {
  const e = entry();
  const text = (entries) =>
    JSON.stringify({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      entries,
    });
  assert.equal(parseBackup(text([e])).errors.length, 0);
  assert.equal(parseBackup(text([e, e])).errors.length, 1);
  assert.equal(parseBackup(text([{ ...e, id: "wrong" }])).errors.length, 1);
  assert.throws(() => parseBackup("{"));
  assert.throws(() => parseBackup(JSON.stringify({ schemaVersion: 2 })));
  assert.throws(() => parseBackup("x".repeat(10 * 1024 * 1024 + 1)));
});
test("merge preview counts duplicate ID and normalized word conflicts", () => {
  const e = entry();
  const sameWord = validateEntry({
    ...e,
    id: crypto.randomUUID(),
    word: "MITIGATE",
  });
  const other = validateEntry({ word: "empirical", type: "word" });
  assert.deepEqual(previewImport([e, sameWord, other], [e]), {
    total: 3,
    added: 1,
    duplicate: 1,
    conflict: 1,
  });
});
test("AI suggestions cannot change protected data, accept fenced JSON, reject mismatch", () => {
  const e = entry();
  const v = {
    word: "MITIGATE",
    type: "word",
    translations: ["緩解"],
    id: "evil",
    favorite: true,
    originalContext: "evil",
    source: { url: "javascript:bad" },
  };
  const changes = parseAI("```json\n" + JSON.stringify(v) + "\n```", e);
  assert.deepEqual(changes, { translations: ["緩解"] });
  assert.throws(() => parseAI(JSON.stringify({ ...v, word: "mitgate" }), e));
  assert.throws(() => parseAI(JSON.stringify({ ...v, translations: "x" }), e));
  assert.throws(() => parseAI(JSON.stringify({ ...v, type: "phrase" }), e));
  assert.throws(() => parseAI("null", e));
  assert.match(makePrompt(e, "Security"), /不杜撰/);
});
