import test from "node:test";
import assert from "node:assert/strict";
import { usageBlocks } from "../js/text.js";

test("escaped numbered usage separates headings, explanations and examples", () => {
  const source = String.raw`1\. an incentive to + 動詞原形：表示促使某人執行特定行動的誘因。例如：The reward provides an incentive to participate.（獎勵提供參與誘因）。
2\. an incentive for + 名詞：表示針對某項行為的誘因。
   原文補充保留在同一項。
12\. 學術寫作注意事項：incentive 不一定是已發放的獎勵。`;
  const blocks = usageBlocks(source);
  assert.equal(blocks.length, 3);
  assert.deepEqual(
    blocks.map((x) => x.number),
    [1, 2, 12],
  );
  assert.equal(blocks[0].title, "an incentive to + 動詞原形");
  assert.equal(blocks[0].body, "表示促使某人執行特定行動的誘因。");
  assert.equal(
    blocks[0].example,
    "The reward provides an incentive to participate.（獎勵提供參與誘因）。",
  );
  assert.match(blocks[1].body, /原文補充保留在同一項/);
  assert.equal(source.includes("1\\."), true, "source text is not rewritten");
});

test("plain paragraphs, decimals, URLs, bullets and unsafe-looking text remain text", () => {
  const plain = "使用 2.5 作為比例。\n\n來源 https://example.com/a:b。";
  assert.equal(usageBlocks(plain)[0].text, plain);
  assert.equal(usageBlocks(plain)[0].title, "");
  const blocks = usageBlocks(
    "- 常見用法\n- <script>alert('x')</script>：僅為文字",
  );
  assert.deepEqual(
    blocks.map((x) => x.number),
    [null, null],
  );
  assert.equal(blocks[1].title, "<script>alert('x')</script>");
  assert.equal(blocks[1].body, "僅為文字");
  assert.equal(usageBlocks("").length, 0);
});

test("all twelve inline numbered items are retained, including double digit numbers", () => {
  const text = Array.from(
    { length: 12 },
    (_, i) => `${i + 1}\\. 用法 ${i + 1}：完整說明 ${i + 1}。`,
  ).join(" ");
  const blocks = usageBlocks(text);
  assert.equal(blocks.length, 12);
  assert.deepEqual(
    blocks.map((x) => x.number),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
  assert.equal(blocks[11].title, "用法 12");
  assert.equal(blocks[11].body, "完整說明 12。");
});
