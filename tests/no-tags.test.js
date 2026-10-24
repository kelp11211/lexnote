import test from "node:test";
import assert from "node:assert/strict";
import { validateEntry, AI_FIELDS } from "../js/schema.js";
import { makePrompt, parseAI } from "../js/ai.js";
import { parseBackup } from "../js/backup.js";
import { search } from "../js/search.js";

test("new vocabulary and AI prompts no longer include tags", () => {
  const entry = validateEntry({ word: "mitigate", type: "word" });
  assert.equal(Object.hasOwn(entry, "tags"), false);
  assert.equal(AI_FIELDS.includes("tags"), false);
  assert.doesNotMatch(makePrompt(entry), /tags|標籤/);
  const suggestions = parseAI(
    JSON.stringify({
      word: entry.word,
      type: entry.type,
      tags: ["Ignored"],
      usage: "用法",
    }),
    entry,
  );
  assert.deepEqual(suggestions, { usage: "用法" });
});

test("legacy backup tags survive edits and backup validation as hidden metadata", () => {
  const old = validateEntry({
    word: "mitigate",
    type: "word",
    tags: ["LegacyOnly"],
  });
  const edited = validateEntry({ ...old, translations: ["減輕"] });
  const result = parseBackup(
    JSON.stringify({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      entries: [edited],
    }),
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.entries[0].tags, ["LegacyOnly"]);
  assert.deepEqual(result.entries[0].translations, ["減輕"]);
  const suggestions = parseAI(
    JSON.stringify({
      word: old.word,
      type: old.type,
      tags: ["ReplaceAttempt"],
      definition: "Definition",
    }),
    old,
  );
  assert.deepEqual(validateEntry({ ...old, ...suggestions }).tags, [
    "LegacyOnly",
  ]);
});

test("search ignores legacy tags while type, sections and favorites still work", () => {
  const old = validateEntry({
    word: "mitigate",
    type: "word",
    tags: ["LegacyOnly"],
    sections: ["Discussion"],
    favorite: true,
  });
  assert.equal(search([old], { q: "LegacyOnly" }).length, 0);
  assert.equal(
    search([old], {
      q: "mitigate",
      type: "word",
      section: "Discussion",
      favorite: true,
    }).length,
    1,
  );
  assert.equal(search([old], { section: "Results" }).length, 0);
  assert.equal(search([old], { type: "phrase" }).length, 0);
});
