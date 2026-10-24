export function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
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
