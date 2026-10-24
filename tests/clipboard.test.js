import test from "node:test";
import assert from "node:assert/strict";
import { parseAI, parseClipboardJSON, makePrompt } from "../js/ai.js";
import { validateEntry } from "../js/schema.js";
import { parseBackup } from "../js/backup.js";
import { formatUsage } from "../js/text.js";

const current = () =>
  validateEntry({ word: "mitigate", type: "word", phonetic: "既有音標" });
const suggestion = {
  word: "mitigate",
  type: "word",
  phonetic: "美式 /test/",
  usage: "- 第一點\n- 第二點",
};

test("ChatGPT copied HTML spaces and Markdown hard breaks parse without changing IPA", () => {
  const borrow = validateEntry({ word: "borrow", type: "word" });
  const phonetic = "美式 IPA：/ˈbɑːroʊ/；英式 IPA：/ˈbɒrəʊ/";
  const json = JSON.stringify(
    { word: "borrow", type: "word", phonetic, partOfSpeech: ["verb（動詞）"] },
    null,
    2,
  );
  for (const entity of ["&#x20;", "&#X20;", "&#32;", "&nbsp;"]) {
    const copied = json
      .split("\n")
      .map((line) => line.replace(/^ /, entity))
      .join("\\\n");
    assert.deepEqual(parseAI(copied, borrow), {
      phonetic,
      partOfSpeech: ["verb（動詞）"],
    });
    assert.deepEqual(parseAI("```json\n" + copied + "\n```", borrow), {
      phonetic,
      partOfSpeech: ["verb（動詞）"],
    });
    assert.deepEqual(parseAI(encodeURIComponent(copied), borrow), {
      phonetic,
      partOfSpeech: ["verb（動詞）"],
    });
    assert.deepEqual(parseAI(copied.replace(/\\\n/g, "\\  \r\n"), borrow), {
      phonetic,
      partOfSpeech: ["verb（動詞）"],
    });
  }
});

test("clipboard repair is text-only and preserves literal entities and JSON escapes", () => {
  const data = {
    word: "mitigate",
    type: "word",
    definition:
      "literal &#x20; &nbsp; <script> &quot; &amp; https://example.com/a%20b",
    usage: "a line\nnext line",
    phonetic: "/test/",
    collocations: ["C:\\research", 'say "hello"'],
  };
  const json = JSON.stringify(data, null, 2);
  for (const copied of [
    json,
    json
      .split("\n")
      .map((line) => line.replace(/^ /, "&#x20;"))
      .join("\\\n"),
  ]) {
    const changes = parseAI(copied, current());
    assert.equal(changes.definition, data.definition);
    assert.equal(changes.usage, data.usage);
    assert.equal(changes.phonetic, data.phonetic);
    assert.deepEqual(changes.collocations, data.collocations);
  }
  assert.equal(
    parseAI(
      '{"word":"mitigate","type":"word","usage":"line one\\\nline two"}',
      current(),
    ).usage,
    "line one\nline two",
  );
});

test("the truncated user fragment still requires missing JSON structure and values", () => {
  const truncated =
    '&#x20; "word": "borrow",\\\n&#x20; "type": "word",\\\n&#x20; "partOfSpeech": [\\\n&#x20; "verb（動詞）"\\';
  assert.throws(
    () => parseAI(truncated, validateEntry({ word: "borrow", type: "word" })),
    /完整內容.*開頭 \{.*完整陣列/,
  );
  assert.throws(
    () => parseClipboardJSON('{\n&#x20; "word": "borrow",\\\n}'),
    /JSON 格式錯誤/,
  );
});

test("IPA is optional for old entries and survives AI, edits and backup validation", () => {
  assert.equal(validateEntry({ word: "old", type: "word" }).phonetic, "");
  const changes = parseAI(JSON.stringify(suggestion), current());
  assert.equal(changes.phonetic, suggestion.phonetic);
  const saved = validateEntry({ ...current(), ...changes });
  const backup = parseBackup(
    JSON.stringify({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      entries: [saved],
    }),
  );
  assert.equal(backup.entries[0].phonetic, suggestion.phonetic);
  assert.throws(
    () => parseAI(JSON.stringify({ ...suggestion, phonetic: [] }), current()),
    /phonetic/,
  );
  assert.equal(
    parseAI('{"word":"mitigate","type":"word","usage":"用法"}', current())
      .phonetic,
    undefined,
  );
  assert.match(makePrompt(current()), /phonetic/);
});

test("clipboard accepts whole encoded JSON, encoded fences, separators, and double serialization", () => {
  const json = JSON.stringify(suggestion, null, 2);
  const copies = [
    json,
    "```json\n" + json + "\n```",
    encodeURIComponent(json),
    encodeURIComponent("```json\n" + json + "\n```"),
    JSON.stringify(json),
    json.replace(/\n/g, "\\n"),
    json.replace(/\n/g, "/n"),
    json.replace(/\n  /g, "%0A%20%20"),
    "\uFEFF\u200B" + json,
  ];
  for (const copy of copies)
    assert.deepEqual(parseAI(copy, current()), {
      phonetic: suggestion.phonetic,
      usage: suggestion.usage,
    });
});

test("literal newlines in copied JSON string values are safely repaired", () => {
  const copied =
    '{"word":"mitigate","type":"word","usage":"- 第一點\n- 第二點"}';
  assert.equal(parseAI(copied, current()).usage, "- 第一點\n- 第二點");
});

test("valid JSON percentages, encoded URLs, IPA slashes, backslashes and quotes stay unchanged", () => {
  const raw = {
    word: "mitigate",
    type: "word",
    phonetic: "/test/",
    definition:
      '20% or %20 or %22; https://example.com/a%20b; "quote"; C:\\research',
  };
  assert.equal(
    parseAI(JSON.stringify(raw), current()).definition,
    raw.definition,
  );
  assert.equal(
    parseAI(encodeURIComponent(JSON.stringify(raw)), current()).definition,
    raw.definition,
  );
  assert.equal(parseAI(JSON.stringify(raw), current()).phonetic, raw.phonetic);
});

test("decoded JSON still enforces word matching, protected fields, sizes and valid syntax", () => {
  assert.throws(
    () =>
      parseAI(
        encodeURIComponent(JSON.stringify({ ...suggestion, word: "wrong" })),
        current(),
      ),
    /不相符/,
  );
  const changes = parseAI(
    encodeURIComponent(
      JSON.stringify({
        ...suggestion,
        id: "injected",
        source: { url: "https://example.com" },
      }),
    ),
    current(),
  );
  assert.equal(changes.id, undefined);
  assert.equal(changes.source, undefined);
  assert.throws(
    () => parseClipboardJSON('{"usage": "incomplete}'),
    /JSON 格式錯誤/,
  );
  assert.throws(() => parseClipboardJSON("x".repeat(100001)), /100,000/);
  assert.throws(
    () => parseClipboardJSON("%7B%22bad%22%3A%ZZ%7D"),
    /JSON 格式錯誤/,
  );
});

test("usage supports arrays, escaped newlines and inline lists without breaking decimals or prose", () => {
  assert.equal(
    parseAI(
      JSON.stringify({ ...suggestion, usage: ["第一點", "第二點"] }),
      current(),
    ).usage,
    "第一點\n第二點",
  );
  assert.throws(
    () =>
      parseAI(
        JSON.stringify({ ...suggestion, usage: [{ text: "bad" }] }),
        current(),
      ),
    /文字陣列/,
  );
  assert.equal(formatUsage("- 第一點\\n- 第二點"), "- 第一點\n- 第二點");
  assert.equal(formatUsage("- 第一點/n- 第二點"), "- 第一點\n- 第二點");
  assert.equal(formatUsage("1. 第一點 2. 第二點"), "1. 第一點\n2. 第二點");
  assert.equal(formatUsage("• 第一點 • 第二點"), "• 第一點\n• 第二點");
  assert.equal(formatUsage("- 第一點 - 第二點"), "- 第一點\n- 第二點");
  assert.equal(
    formatUsage("Use a 2.5 ratio and a well-known method."),
    "Use a 2.5 ratio and a well-known method.",
  );
});
