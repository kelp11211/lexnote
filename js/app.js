import { SECTIONS, AI_FIELDS, validateEntry, safeURL } from "./schema.js";
import {
  openDB,
  allEntries,
  saveEntry,
  deleteEntry,
  getValue,
  setValue,
  importEntries,
} from "./db.js";
import { search } from "./search.js";
import { parseBackup, previewImport, MAX_BYTES } from "./backup.js";
import { makePrompt, parseAI } from "./ai.js";
import { el, button, toast, copy } from "./ui.js";
import { formatUsage } from "./text.js";
const $ = (s) => document.querySelector(s),
  form = $("#entry-form"),
  editor = $("#editor"),
  aux = $("#aux");
const types = { word: "單字", phrase: "片語", pattern: "句型" };
const aiLabels = {
  phonetic: "音標（IPA）",
  partOfSpeech: "詞性",
  translations: "中文翻譯",
  definition: "英文定義",
  usage: "基本用法",
  collocations: "搭配詞",
  academicExamples: "學術例句",
  synonyms: "同義詞比較",
  sections: "適用章節",
};
let entries = [],
  selected = null,
  editing = null,
  baseline = "",
  busy = false,
  ready = false,
  theme,
  themePreference;
const fields = [
  "phonetic",
  "word",
  "type",
  "translations",
  "originalContext",
  "partOfSpeech",
  "definition",
  "usage",
  "sourceTitle",
  "sourceDoi",
  "sourceUrl",
  "familiarity",
  "favorite",
];
const field = (k) => form.elements.namedItem(k);
function ask(message) {
  return new Promise((resolve) => {
    const dialog = el("dialog");
    const title = el("h2", "確認操作");
    title.id = "confirm-title";
    dialog.setAttribute("aria-labelledby", title.id);
    const body = el("div", undefined, "dialog-body");
    body.append(title, el("p", message, "muted"));
    const actions = el("div", undefined, "dialog-foot");
    const finish = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    actions.append(
      button("取消", () => finish(false)),
      button("確認繼續", () => finish(true), "primary"),
    );
    dialog.append(body, actions);
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish(false);
    });
    document.body.append(dialog);
    dialog.showModal();
    actions.querySelector("button").focus();
  });
}
function error(e) {
  toast(e.message || String(e));
}
function guard(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      error(e);
    }
  };
}
function auxOpen(title) {
  $("#aux-title").textContent = title;
  $("#aux-body").replaceChildren();
  if (!aux.open) aux.showModal();
  return $("#aux-body");
}
$("#aux-close").onclick = () => aux.close();
function repeat(kind, value = {}) {
  const config = {
    collocations: [["text", "搭配詞"]],
    examples: [
      ["en", "英文例句"],
      ["zh", "中文翻譯"],
    ],
    synonyms: [
      ["word", "同義詞"],
      ["difference", "用法差異"],
    ],
  }[kind];
  const row = el("div", undefined, "repeat-row"),
    inputs = el("div", undefined, "repeat-inputs");
  for (const [key, label] of config) {
    const l = el("label", label),
      input = el(kind === "collocations" ? "input" : "textarea");
    input.dataset.key = key;
    input.value = typeof value === "string" ? value : value[key] || "";
    l.append(input);
    inputs.append(l);
  }
  row.append(
    inputs,
    button("移除", () => row.remove()),
  );
  $(`#${kind}-fields`).append(row);
}
for (const kind of ["collocations", "examples", "synonyms"])
  $(
    `#add-${{ collocations: "collocation", examples: "example", synonyms: "synonym" }[kind]}`,
  ).onclick = () => repeat(kind);
for (const section of SECTIONS) {
  const l = el("label", section),
    i = el("input");
  i.type = "checkbox";
  i.value = section;
  i.name = "sections";
  l.prepend(i);
  $("#section-checks").append(l);
  $("#section").append(new Option(section, section));
}
const lines = (s) =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
  comma = (s) =>
    s
      .split(/[,，]/)
      .map((x) => x.trim())
      .filter(Boolean);
function readRows(kind) {
  return [...$(`#${kind}-fields`).children].map((row) =>
    Object.fromEntries(
      [...row.querySelectorAll("[data-key]")].map((i) => [
        i.dataset.key,
        i.value,
      ]),
    ),
  );
}
function readForm() {
  const v = { ...editing };
  for (const k of [
    "word",
    "type",
    "phonetic",
    "definition",
    "usage",
    "originalContext",
  ])
    v[k] = field(k).value;
  v.translations = lines(field("translations").value);
  v.partOfSpeech = comma(field("partOfSpeech").value);
  v.sections = [...form.querySelectorAll("[name=sections]:checked")].map(
    (x) => x.value,
  );
  v.source = {
    title: field("sourceTitle").value,
    doi: field("sourceDoi").value,
    url: field("sourceUrl").value,
  };
  v.favorite = field("favorite").checked;
  v.familiarity = Number(field("familiarity").value);
  v.collocations = readRows("collocations").map((x) => x.text);
  v.academicExamples = readRows("examples");
  v.synonyms = readRows("synonyms");
  return v;
}
function fill(v) {
  for (const k of fields) {
    if (k === "favorite") field(k).checked = v.favorite;
    else if (k.startsWith("source"))
      field(k).value =
        v.source[
          { sourceTitle: "title", sourceDoi: "doi", sourceUrl: "url" }[k]
        ];
    else
      field(k).value = Array.isArray(v[k])
        ? v[k].join(k === "translations" ? "\n" : ", ")
        : (v[k] ?? "");
  }
  form
    .querySelectorAll("[name=sections]")
    .forEach((x) => (x.checked = v.sections.includes(x.value)));
  for (const kind of ["collocations", "examples", "synonyms"]) {
    $(`#${kind}-fields`).replaceChildren();
    for (const x of v[{ examples: "academicExamples" }[kind] || kind])
      repeat(kind, x);
  }
}
function openEditor(entry) {
  if (!ready) return;
  editing = entry
    ? structuredClone(entry)
    : validateEntry({ type: "word", word: "新詞彙" });
  if (!entry) editing.word = "";
  fill(editing);
  $("#editor-title").textContent = entry ? "編輯詞彙" : "新增詞彙";
  $("#word-error").textContent = "";
  $("#form-error").textContent = "";
  $("#domain").value = "";
  $("#full-edit").open = Boolean(entry);
  baseline = JSON.stringify(readForm());
  editor.showModal();
  field("word").focus();
}
function dirty() {
  return editor.open && JSON.stringify(readForm()) !== baseline;
}
async function closeEditor() {
  if (busy) return;
  if (!dirty() || (await ask("尚有未儲存的更動，確定放棄？"))) editor.close();
}
$("#cancel").onclick = closeEditor;
editor.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeEditor();
});
window.addEventListener("beforeunload", (e) => {
  if (dirty()) {
    e.preventDefault();
    e.returnValue = "";
  }
});
$("#new").onclick = () => openEditor();
async function refresh() {
  entries = await allEntries();
  render();
  await backupStatus();
}
function filters() {
  return {
    q: $("#search").value,
    type: $("#type").value,
    section: $("#section").value,
    favorite: $("#favorite").checked,
    sort: $("#sort").value,
  };
}
function render() {
  if (!selected)
    document.querySelector(".workspace").classList.remove("show-detail");
  const result = search(entries, filters());
  $("#count").textContent = `${result.length} / ${entries.length} 筆`;
  const list = $("#list");
  list.replaceChildren();
  for (const e of result) {
    const b = button(
      "",
      () => {
        selected = e.id;
        render();
        $(".workspace").classList.add("show-detail");
      },
      `entry-row${selected === e.id ? " active" : ""}`,
    );
    b.setAttribute("aria-pressed", String(selected === e.id));
    const content = el("span");
    content.append(
      el("span", e.word, "entry-word"),
      el("small", e.translations.join("、") || "尚未補上中文意思"),
      el("small", types[e.type]),
    );
    b.append(el("span", e.favorite ? "★" : "☆", "star"), content);
    list.append(b);
  }
  if (!result.length) {
    const n = el("div", undefined, "empty");
    n.append(
      el("h2", entries.length ? "沒有符合的詞彙" : "從第一個詞彙開始"),
      el(
        "p",
        entries.length
          ? "換個關鍵字，或清除篩選條件。"
          : "把閱讀中遇見的表達，留下來。",
      ),
      button(entries.length ? "清除篩選" : "＋ 新增第一筆詞彙", () =>
        entries.length ? resetFilters() : openEditor(),
      ),
    );
    list.append(n);
  }
  renderDetail(entries.find((e) => e.id === selected));
}
function renderDetail(e) {
  const d = $("#detail");
  d.replaceChildren();
  if (!e) {
    const n = el("div", undefined, "empty");
    n.append(
      el("div", "Aa", "empty-symbol"),
      el(
        "h2",
        entries.length ? "選一個詞彙，深入理解" : "你的學術表達，從這裡累積",
      ),
      el(
        "p",
        "保留原文情境，整理用法與例句。\n每個詞彙，都是下一篇論文的素材。",
      ),
      button("＋ 新增詞彙", () => openEditor(), "primary"),
    );
    d.append(n);
    return;
  }
  d.append(
    button(
      "← 返回清單",
      () => $(".workspace").classList.remove("show-detail"),
      "mobile-back",
    ),
  );
  const top = el("div", undefined, "detail-top"),
    name = el("div");
  name.append(
    el("span", types[e.type], "pill"),
    el("h2", e.word, "detail-title"),
    el("p", e.partOfSpeech.join(" · "), "muted"),
  );
  const actions = el("div", undefined, "toolbar");
  actions.append(
    button(
      e.favorite ? "★ 已收藏" : "☆ 收藏",
      guard(async () => {
        await saveEntry({
          ...e,
          favorite: !e.favorite,
          updatedAt: new Date().toISOString(),
        });
        await refresh();
      }),
    ),
    button("編輯", () => openEditor(e)),
  );
  top.append(name, actions);
  d.append(top);
  if (e.translations.length)
    d.append(el("p", e.translations.join("、"), "translation"));
  if (e.definition) d.append(el("p", e.definition, "muted"));
  if (e.phonetic) name.append(el("p", e.phonetic, "phonetic"));
  function section(title) {
    const n = el("section", undefined, "detail-section");
    n.append(el("h3", title));
    d.append(n);
    return n;
  }
  function copyLine(n, text, zh) {
    const row = el("div", undefined, "copy-line"),
      content = el("div");
    content.append(el("p", text));
    if (zh) content.append(el("p", zh, "muted"));
    row.append(
      content,
      button("複製", () => copy(text)),
    );
    n.append(row);
  }
  if (e.usage)
    section("基本用法 · USAGE").append(
      el("p", formatUsage(e.usage), "usage-text"),
    );
  if (e.collocations.length) {
    const n = section("常見搭配 · COLLOCATIONS");
    e.collocations.forEach((x) => copyLine(n, x));
  }
  if (e.academicExamples.length) {
    const n = section("學術例句 · ACADEMIC EXAMPLES");
    e.academicExamples.forEach((x) => copyLine(n, x.en, x.zh));
  }
  if (e.synonyms.length) {
    const n = section("同義詞比較 · SYNONYMS");
    e.synonyms.forEach((x) => {
      n.append(el("p", x.word), el("p", x.difference, "muted"));
    });
  }
  if (e.originalContext)
    section("原文情境 · ORIGINAL CONTEXT").append(el("p", e.originalContext));
  if (Object.values(e.source).some(Boolean)) {
    const n = section("來源 · SOURCE");
    n.append(el("p", e.source.title), el("p", e.source.doi, "muted"));
    const url = safeURL(e.source.url);
    if (url) {
      const a = el("a", "開啟來源 ↗");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      n.append(a);
    }
  }
  const meta = section("論文章節與學習");
  e.sections.forEach((x) => meta.append(el("span", x, "pill")));
  meta.append(
    el(
      "p",
      `熟悉程度 ${e.familiarity} / 3 · 更新於 ${new Date(e.updatedAt).toLocaleString()}`,
      "muted",
    ),
    button(
      "刪除此詞彙",
      guard(async () => {
        if (!(await ask(`確定刪除「${e.word}」？此操作無法復原。`))) return;
        await deleteEntry(e.id);
        selected = null;
        await refresh();
        toast("已刪除詞彙");
      }),
      "danger",
    ),
  );
}
async function save() {
  if (busy) return;
  $("#form-error").textContent = "";
  $("#word-error").textContent = "";
  if (!form.reportValidity()) return;
  try {
    const v = validateEntry({
      ...readForm(),
      updatedAt: new Date().toISOString(),
    });
    const duplicate = entries.find(
      (e) =>
        e.id !== v.id &&
        e.type === v.type &&
        e.wordNormalized === v.wordNormalized,
    );
    if (duplicate) {
      $("#word-error").textContent = "已有相同類型的詞彙。";
      if (
        await ask(
          `「${duplicate.word}」已存在。要放棄目前表單並開啟既有紀錄嗎？`,
        )
      ) {
        editor.close();
        openEditor(duplicate);
      }
      return;
    }
    busy = true;
    $("#save").disabled = true;
    $("#save").textContent = "儲存中…";
    await saveEntry(v);
    selected = v.id;
    baseline = JSON.stringify(readForm());
    editor.close();
    await refresh();
    $(".workspace").classList.add("show-detail");
    toast("已儲存");
  } catch (e) {
    $("#form-error").textContent =
      e.name === "ConstraintError"
        ? "其他分頁已新增相同詞彙，請取消後重新載入。"
        : e.message;
  } finally {
    busy = false;
    $("#save").disabled = false;
    $("#save").textContent = "儲存詞彙";
  }
}
form.addEventListener("submit", (e) => {
  e.preventDefault();
  save();
});
let searchTimer;
$("#search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 180);
});
for (const k of ["type", "section", "favorite", "sort"])
  $(`#${k}`).onchange = render;
function resetFilters() {
  for (const k of ["search", "type", "section"]) $(`#${k}`).value = "";
  $("#favorite").checked = false;
  $("#sort").value = "created";
  render();
}
$("#reset").onclick = resetFilters;
function applyTheme(value) {
  theme = value;
  document.documentElement.classList.toggle("dark", value === "dark");
  $("#theme").textContent = value === "dark" ? "切換淺色" : "切換深色";
}
$("#theme").onclick = guard(async () => {
  if (!ready) throw new Error("請先等候資料庫開啟");
  const value = theme === "dark" ? "light" : "dark";
  await setValue("settings", "theme", value);
  themePreference = value;
  applyTheme(value);
});
const media = matchMedia("(prefers-color-scheme: dark)");
applyTheme(media.matches ? "dark" : "light");
media.addEventListener("change", (e) => {
  if (!themePreference) applyTheme(e.matches ? "dark" : "light");
});
$("#prompt").onclick = guard(() => {
  const v = validateEntry(readForm()),
    text = makePrompt(v, $("#domain").value),
    body = auxOpen("複製 AI 提示詞"),
    area = el("textarea");
  area.value = text;
  area.readOnly = true;
  area.setAttribute("aria-label", "AI 提示詞");
  body.append(
    el("p", "複製後貼到 ChatGPT，再把回覆的 JSON 貼回本機。"),
    area,
    button("複製完整提示詞", () => copy(text), "primary"),
  );
});
$("#ai-import").onclick = guard(() => {
  const current = validateEntry(readForm()),
    body = auxOpen("匯入 AI 建議"),
    area = el("textarea");
  area.setAttribute("aria-label", "貼上 AI JSON");
  area.placeholder =
    "貼上完整 AI JSON（包含 { }）；支援 &#x20; 空白、行尾反斜線、程式碼區塊及 URL 編碼";
  const msg = el("p", "", "error"),
    preview = el("div");
  let changes;
  const apply = button(
    "套用所選建議到表單",
    () => {
      const v = readForm();
      preview
        .querySelectorAll("input:checked")
        .forEach((i) => (v[i.value] = changes[i.value]));
      fill(v);
      $("#full-edit").open = true;
      aux.close();
      toast("已套用到表單，檢查後按「儲存詞彙」");
    },
    "primary",
  );
  apply.disabled = true;
  area.oninput = () => {
    apply.disabled = true;
    preview.replaceChildren();
  };
  body.append(
    el(
      "p",
      "支援 &#x20; 等 HTML 空白編碼、行尾反斜線、程式碼區塊與 URL 編碼。請貼上完整 JSON，包含 { } 和完整陣列 [ ]。先預覽並勾選建議，再確認儲存；來源與原文不會被 AI 改寫。",
    ),
    area,
    button("驗證並預覽", () => {
      try {
        changes = parseAI(area.value, current);
        msg.textContent = "";
        preview.replaceChildren();
        for (const k of AI_FIELDS.filter((k) => Object.hasOwn(changes, k))) {
          const label = el("label", aiLabels[k], "check"),
            check = el("input");
          check.type = "checkbox";
          check.value = k;
          check.checked = !current[k] || current[k].length === 0;
          label.prepend(check);
          const row = el("div", undefined, "preview");
          for (const [title, value] of [
            ["目前紀錄", current[k]],
            ["AI 建議", changes[k]],
          ]) {
            const col = el("div");
            col.append(
              el("strong", title),
              el("pre", JSON.stringify(value, null, 2)),
            );
            row.append(col);
          }
          preview.append(label, row);
        }
        apply.disabled = false;
      } catch (e) {
        msg.textContent = e.message;
        apply.disabled = true;
      }
    }),
    msg,
    preview,
    apply,
  );
});
async function backupStatus() {
  const last = await getValue("metadata", "lastExport");
  $("#backup-status").textContent = last
    ? `上次啟動匯出：${new Date(last).toLocaleDateString()}${Date.now() - Date.parse(last) > 7 * 86400000 ? " · 已超過 7 天，建議備份" : ""}`
    : "尚未匯出備份 · 建議每週備份";
}
async function exportBackup() {
  if (!ready) throw new Error("資料庫尚未就緒");
  const data = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    entries: await allEntries(),
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
  );
  const a = el("a");
  a.href = url;
  a.download = `vocabulary_backup_${new Date().toLocaleDateString("en-CA")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await setValue("metadata", "lastExport", data.exportedAt);
  await backupStatus();
  toast("已啟動下載，請確認檔案已保留在磁碟");
}
$("#manage").onclick = guard(() => {
  if (!ready) throw new Error("資料庫尚未就緒");
  const body = auxOpen("資料管理與備份");
  body.append(
    el(
      "p",
      "資料僅保存在目前瀏覽器。清除網站資料、更換瀏覽器或網址會影響存取，請定期匯出 JSON。備份包含所有詞彙，不受搜尋篩選影響。",
    ),
    button("↓ 匯出全部 JSON", guard(exportBackup), "primary"),
    el(
      "p",
      "匯入備份（最多 10 MB）。合併會保留本機資料，跳過同 ID 與同詞彙衝突。全部取代會移除現有詞彙，請先匯出。",
    ),
  );
  const label = el("label", "選取 JSON 備份"),
    file = el("input");
  file.type = "file";
  file.accept = ".json,application/json";
  label.append(file);
  body.append(label);
  const status = el("div");
  body.append(status);
  file.onchange = guard(async () => {
    status.replaceChildren();
    const f = file.files[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      status.append(el("p", "檔案超過 10 MB", "error"));
      return;
    }
    try {
      const parsed = parseBackup(await f.text()),
        local = await allEntries(),
        stats = previewImport(parsed.entries, local);
      status.append(
        el(
          "p",
          `總筆數 ${parsed.total} · 新增 ${stats.added} · 重複 ID ${stats.duplicate} · 詞彙衝突 ${stats.conflict} · 錯誤 ${parsed.errors.length}`,
        ),
      );
      if (parsed.errors.length) {
        status.append(
          el("pre", parsed.errors.slice(0, 30).join("\n"), "error"),
        );
        status.append(el("p", "驗證失敗，整份檔案不會寫入。"));
        return;
      }
      const actions = el("div", undefined, "toolbar");
      const run = (replace) =>
        guard(async () => {
          if (
            !(await ask(
              replace
                ? `警告：將移除所有本機詞彙，取代為 ${parsed.entries.length} 筆。請確認已匯出備份，確定繼續？`
                : `確定合併 ${parsed.entries.length} 筆？相同 ID 與詞彙衝突將保留本機、跳過匯入。`,
            ))
          )
            return;
          actions
            .querySelectorAll("button")
            .forEach((b) => (b.disabled = true));
          try {
            const result = await importEntries(parsed.entries, replace);
            selected = null;
            await refresh();
            aux.close();
            toast(
              `匯入完成：寫入 ${result.added} 筆，跳過 ${result.skipped} 筆`,
            );
          } finally {
            actions
              .querySelectorAll("button")
              .forEach((b) => (b.disabled = false));
          }
        });
      actions.append(
        button("合併匯入", run(false), "primary"),
        button("全部取代還原", run(true), "danger"),
      );
      status.append(actions);
    } catch (e) {
      status.append(el("p", e.message, "error"));
    }
  });
});
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "s" && editor.open && !aux.open) {
    e.preventDefault();
    save();
  } else if (
    e.ctrlKey &&
    e.key.toLowerCase() === "k" &&
    !editor.open &&
    !aux.open
  ) {
    e.preventDefault();
    $("#search").focus();
  } else if (
    e.ctrlKey &&
    e.shiftKey &&
    e.key.toLowerCase() === "n" &&
    !editor.open &&
    !aux.open
  ) {
    e.preventDefault();
    openEditor();
  } else if (
    e.ctrlKey &&
    e.shiftKey &&
    e.key.toLowerCase() === "e" &&
    !editor.open &&
    !aux.open
  ) {
    e.preventDefault();
    guard(exportBackup)();
  }
});
// Refresh when returning from another tab so edits do not leave a stale list.
window.addEventListener("focus", () => {
  if (ready && !editor.open && !aux.open) guard(refresh)();
});
try {
  await openDB();
  entries = await allEntries();
  themePreference = await getValue("settings", "theme");
  if (themePreference) applyTheme(themePreference);
  ready = true;
  $("#new").disabled = false;
  $("#db-status").textContent = "● IndexedDB 已就緒 · 所有更動儲存於本機";
  render();
  await backupStatus();
} catch (e) {
  $("#db-status").textContent = e.message;
  $("#db-status").classList.add("error");
  $("#detail").replaceChildren(
    el("h2", "資料庫無法開啟"),
    el("p", e.message, "error"),
  );
  $("#count").textContent = "無法讀取";
  $("#list").replaceChildren(
    el("p", "請關閉其他分頁、確認瀏覽器允許網站儲存後重新整理。", "empty"),
  );
}
