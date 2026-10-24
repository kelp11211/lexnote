import { usageBlocks } from "./text.js";

export function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
export function renderUsage(text) {
  const container = el("div", undefined, "usage-content");
  let list = null;
  for (const block of usageBlocks(text)) {
    if (!block.listed) {
      list = null;
      container.append(el("p", block.text, "usage-intro"));
      continue;
    }
    const kind = block.number === null ? "ul" : "ol";
    if (!list || list.tagName.toLowerCase() !== kind) {
      list = el(kind, undefined, "usage-list");
      list.setAttribute("role", "list");
      container.append(list);
    }
    const item = el("li", undefined, "usage-item");
    if (block.number !== null) item.value = block.number;
    const badge = el(
      "span",
      block.number === null ? "•" : String(block.number),
      "usage-number",
    );
    badge.setAttribute("aria-hidden", "true");
    const content = el("div", undefined, "usage-item-content");
    if (block.title) content.append(el("h4", block.title, "usage-heading"));
    if (block.body) content.append(el("p", block.body, "usage-description"));
    if (block.example) {
      const example = el("blockquote", undefined, "usage-example");
      example.append(
        el("span", "例句", "usage-example-label"),
        el("p", block.example),
      );
      content.append(example);
    }
    item.append(badge, content);
    list.append(item);
  }
  return container;
}
export function button(text, action, cls) {
  const n = el("button", text, cls);
  n.type = "button";
  n.addEventListener("click", action);
  return n;
}
let timer;
export function toast(message) {
  const n = document.querySelector("#toast");
  n.textContent = message;
  n.style.display = "block";
  clearTimeout(timer);
  timer = setTimeout(() => (n.style.display = "none"), 4500);
}
export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("已複製到剪貼簿");
  } catch {
    toast("無法使用剪貼簿，請選取文字後手動複製");
  }
}
