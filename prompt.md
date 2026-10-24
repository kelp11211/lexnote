# Academic Vocabulary Notebook｜Codex 開發規格與執行提示詞

> 版本：v1.0.0  
> 目標環境：Windows 11、Chrome / Edge、localhost  
> 語言：介面與說明使用繁體中文（台灣用語），英文專有名詞保留英文  
> 專案定位：供博士班研究生閱讀英文論文、累積學術單字／片語／句型，以及日後撰寫英文論文時查找用法的**輕量化本機工具**。

## 0. 給 Codex 的工作指令

你是一位擅長前端 UI/UX、原生 JavaScript、IndexedDB 與本機工具開發的資深工程師。請依照本文件**直接建立可執行專案**，不要只交付範例片段、設計稿或抽象建議。

1. 請先檢查目前工作目錄，若已有程式碼應先確認現有架構，不要任意覆寫使用者資料。
2. 以**純靜態網站**為基礎：HTML5、Tailwind CSS（建置時編譯）、原生 JavaScript ES Modules；不使用 React、Vue、Next.js，也不建立一般用途的後端 API、會員或登入系統。
3. 資料以 **IndexedDB 為唯一日常寫入來源**；JSON 是匯入、匯出與備份格式，不假設網頁可以直接修改專案內的 JSON 檔案。
4. 第一版 AI 走**半自動工作流程**：產生提示詞、複製到 ChatGPT、貼回 JSON、檢查／預覽／確認後儲存。**不要**在前端嵌入 API Key，也不要假裝有直接連接 ChatGPT 的功能。
5. 完成 UI、資料存取、輸入驗證、匯入匯出、基本測試、README 與 Windows 一鍵啟動指令。程式須可實際操作，不能只有靜態 UI。
6. 遇到未規定細節時，以**簡單、可維護、安全、使用者操作步驟少**為優先，並於 README 記錄決策。不要為了「未來可能會用到」而過度設計。
7. 禁止靜默清除原始單字資料。資料覆蓋、清空與衝突處理必須有使用者可理解的確認流程。
8. 完成後列出專案檔案樹、啟動步驟、實作項目、測試結果及已知限制。

---

## 1. 使用情境與目標

### 1.1 典型情境

- 使用者在 Windows 上閱讀英文論文，遇到 `mitigate`、`heterogeneous` 等詞，想快速記錄、理解中文意思與基本用法。
- 使用者遇到 `in contrast to` 或 `the experimental results demonstrate that` 等實用寫作表達，想留待日後論文撰寫使用。
- 使用者希望能依英文、中文、研究領域、標籤、論文章節搜尋筆記，查看原始論文情境、學術例句及常見搭配詞。
- 使用者主要在自己的 Windows 電腦操作，不需要多裝置同步或雲端帳號；仍需要 JSON 備份與可攜性。

### 1.2 第一版核心目標（MVP）

- 快速新增、查看、編輯、刪除單字／片語／學術句型。
- 持久化本機資料；重新整理、關閉並再開啟瀏覽器後仍保留內容。
- 中文、英文、例句與標籤搜尋；收藏、分類與論文章節篩選。
- 半自動 AI 提示詞與結果匯入。
- JSON 完整備份、驗證、合併匯入及確認後取代還原。
- 好看的桌面雙欄版型，兼顧窄螢幕，支援淺色／深色模式。

### 1.3 非目標（第一版不實作）

- 不實作登入、會員、雲端同步、多人協作、遠端資料庫。
- 不實作 AI API 自動連線、付費計費或 API Key 管理。
- 不實作正式的間隔重複（Spaced Repetition）演算法、複雜測驗或統計報表。
- 不要求 Windows 原生安裝程式或 Electron 封裝。
- 不要求讀取 PDF 自動擷取字詞；原始句子由使用者手動貼入。

---

## 2. 技術架構與限制

| 項目 | 規格 |
|---|---|
| UI | HTML5 + Tailwind CSS + 少量自訂 CSS |
| 邏輯 | 原生 JavaScript ES Modules，模組分工清楚 |
| 圖示 | 可選用 Lucide 的本地靜態圖示資源，不依賴運行時 CDN |
| 資料 | IndexedDB，Object Stores：`entries`、`settings`、`metadata` |
| 備份 | UTF-8 JSON，含 `schemaVersion` 與 `exportedAt` |
| 執行 | `http://localhost:8765`，由 Python 內建 HTTP Server 提供靜態內容 |
| 安全 | 不將單字、AI 或匯入文字直接塞入 `innerHTML`；使用 `textContent` 或安全 DOM API |
| 網路 | 建置可用 npm 安裝開發依賴；完成建置後一般使用須可離線運作 |

### 2.1 儲存原則

- **單一事實來源**：新增、編輯、刪除均直接提交 IndexedDB transaction。
- JSON 只做備份、還原與資料交換；不需要每次編輯時將資料寫回 `data/vocabulary.json`。
- 匯出備份時由 IndexedDB 讀出完整紀錄，序列化為 JSON 並透過瀏覽器下載。
- 瀏覽器 IndexedDB 受 origin 隔離：固定使用 `http://localhost:8765`，避免換埠造成「資料不見」的錯覺。
- 啟動頁面若開啟資料庫失敗，顯示明確錯誤，不可誤顯示空白單字庫而讓使用者誤以為資料已被刪除。
- 操作成功須等待 transaction 完成後才顯示「已儲存」。
- JSON 匯出需提醒使用者定期備份；可用 metadata 紀錄最後一次成功匯出的時間，每隔 7 天給非阻擋式提醒（不主張在背景自動產生備份檔）。

### 2.2 本機啟動

根目錄建立 `start.bat`，使用下列概念（若開發時找到更可靠的 Python 命令偵測方式，可改善）：

```bat
@echo off
cd /d "%~dp0"
start "" "http://localhost:8765"
python -m http.server 8765 --bind 127.0.0.1
pause
```

- README 說明如何安裝 Python 並驗證 `python --version`；可支援 Windows 的 `py -3` 作為替代。
- `start.bat` 應偵測 Python 是否可用；若通訊埠被占用，說明如何處理，**不要悄悄切換通訊埠**。
- 正式瀏覽器使用不需要 Node.js；Node.js 僅供建置 Tailwind 或執行開發測試。
- 請產生可在 localhost 下直接載入的最終 `css/style.css`（已編譯 CSS）。

---

## 3. 專案目錄建議

```text
AcademicVocabulary/
├── index.html
├── start.bat
├── package.json                 # Tailwind 建置與測試指令（如有需要）
├── README.md
├── css/
│   ├── input.css                # Tailwind 原始樣式
│   └── style.css                # 編譯後供靜態網頁使用
├── js/
│   ├── app.js                   # 啟動、狀態協調、UI 事件
│   ├── db.js                    # IndexedDB 初始化、transaction、migration
│   ├── entries.js               # 單字 CRUD、正規化、重複檢查
│   ├── search.js                # 搜尋、篩選、排序
│   ├── ai.js                    # Prompt 組合、AI JSON 解析／驗證
│   ├── backup.js                # 匯入、匯出、合併／取代
│   ├── schema.js                # 資料 schema、驗證及預設值
│   └── ui.js                    # DOM 渲染、對話視窗、提示訊息
├── data/
│   └── sample.json              # 測試／示範資料，首次啟動不可強制匯入
├── assets/
│   └── icons/                   # 視需要放本地圖示
└── tests/                       # 使用適合的輕量測試工具
```

可按實際需要合併小型模組，但請保留「資料層、邏輯層、介面層」分離原則。

---

## 4. 介面與視覺規格

### 4.1 設計風格

- 名稱：**Academic Vocabulary Notebook**；中文副標「我的學術英文單字庫」。
- 視覺：簡約、清楚、有書寫／研究工具的專業感；避免遊戲化、過多動畫或花俏圖表。
- 色系建議：淺色背景 `#F6F8FC`、白色卡片 `#FFFFFF`、主文字 `#1E293B`、次文字 `#64748B`、主要互動藍 `#2563EB`。深色背景 `#0F172A`、卡片 `#1E293B`、文字 `#F8FAFC`。
- 支援淺色／深色模式，使用者設定寫入 `settings`；首次使用預設跟隨系統，之後以使用者設定為優先。
- 文字與背景對比、鍵盤焦點、按鈕標籤、觸控區域均應兼顧可讀性與可及性。

### 4.2 桌面版主要配置

```text
┌────────────────────────────────────────────────────────────────────────┐
│  📖 Academic Vocabulary Notebook            [淺/深模式] [資料管理]  [+新增] │
├────────────────────────────────────────────────────────────────────────┤
│  [搜尋英文、中文、例句、標籤.........................................] │
│  [全部/單字/片語/句型] [分類] [論文章節] [☆收藏] [排序]                │
├────────────────────────────┬───────────────────────────────────────────┤
│ 單字清單                    │ 詞彙詳情                                   │
│                            │                                           │
│ ☆ mitigate  減輕、緩解      │ mitigate · verb                            │
│   empirical 實證的          │ 中文翻譯／英文定義                         │
│   heterogeneous 異質的      │ 基本用法                                   │
│   in contrast to 相較於     │ Collocations                              │
│   ...                      │ Academic Examples + 中文翻譯              │
│                            │ Synonyms + 差異                            │
│                            │ Original Context + Source                 │
│                            │ Tags / Sections   [編輯] [複製例句]       │
├────────────────────────────┴───────────────────────────────────────────┤
│ 本機儲存狀態／最近備份提醒                                            │
└────────────────────────────────────────────────────────────────────────┘
```

- 寬螢幕使用左側列表（約 35%）與右側詳情（約 65%），可各自捲動或用符合使用習慣的布局。
- 中小螢幕使用上下排列；窄螢幕選中單字後切換顯示詳情並提供返回清單按鈕。
- 首次沒有資料：顯示歡迎空狀態與明顯的「新增第一筆詞彙」操作，不要顯示假資料。
- UI 上的示範筆數不得被當成真實資料總數。

### 4.3 新增與編輯視窗

以簡化的表單為主，區分：

**快速新增**：英文詞彙（必填）、類型（必填）、中文意思（選填）、標籤（選填）、原文情境（選填）。只輸入詞彙與類型也能儲存。

**完整編輯**：翻譯、詞性、定義、基本用法、Collocations、Academic Examples（英文＋中文）、Synonyms、來源論文、分類、適用章節、收藏、熟悉程度。

- 使用明確的儲存、取消按鈕；未儲存更動時離開，須提醒。
- 長文字欄位使用 textarea；多筆例句與搭配詞能新增／刪除項目。
- 必要欄位錯誤顯示於欄位旁，避免只顯示籠統 alert。

### 4.4 快捷鍵

| 快捷鍵 | 行為 |
|---|---|
| `Ctrl + K` | 聚焦搜尋欄 |
| `Ctrl + Shift + N` | 新增詞彙 |
| `Ctrl + S` | 僅編輯視窗開啟時攔截，儲存目前編輯內容 |
| `Esc` | 關閉非關鍵對話視窗；有未儲存更動先確認 |
| `Ctrl + Shift + E` | 匯出 JSON（若與瀏覽器衝突，可調整並寫入 README） |

不要在一般輸入狀態任意攔截瀏覽器慣用快捷鍵。

---

## 5. 資料模型與 JSON schema

### 5.1 備份頂層格式

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-10-24T12:00:00+08:00",
  "entries": []
}
```

- `schemaVersion` 為整數，第一版是 `1`；遇到未支援的較新版本，拒絕匯入並提示，不可冒險覆寫。
- `exportedAt` 使用 ISO 8601 日期時間；所有持久化時間以標準 ISO 格式儲存，UI 再依瀏覽器當地時間格式化。
- `entries` 是詞彙物件陣列。
- 第一版匯出範圍為所有詞彙資料；UI 偏好設定可不包含在詞彙備份中，但須在 README 說清楚。

### 5.2 單筆資料範例

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "word": "mitigate",
  "wordNormalized": "mitigate",
  "type": "word",
  "partOfSpeech": ["verb"],
  "translations": ["減輕", "緩解", "降低"],
  "definition": "To make something less severe.",
  "usage": "常用於表示減少風險、威脅或負面影響的嚴重程度。",
  "collocations": [
    "mitigate security risks",
    "mitigate potential threats"
  ],
  "academicExamples": [
    {
      "en": "The proposed framework mitigates potential security risks.",
      "zh": "所提出的架構降低了潛在的資安風險。"
    }
  ],
  "synonyms": [
    {
      "word": "alleviate",
      "difference": "通常偏向緩解痛苦、問題或不良情況；mitigate 常見於風險和影響。"
    }
  ],
  "originalContext": "",
  "source": {
    "title": "",
    "doi": "",
    "url": ""
  },
  "tags": ["Security", "Academic Writing"],
  "sections": ["Introduction", "Discussion"],
  "favorite": false,
  "familiarity": 0,
  "createdAt": "2026-10-24T11:40:00+08:00",
  "updatedAt": "2026-10-24T11:40:00+08:00"
}
```

### 5.3 欄位規則

| 欄位 | 型別 | 規則 |
|---|---|---|
| `id` | string | UUID，由應用建立；匯入資料須驗證；不得重複 |
| `word` | string | 必填、trim 後不得為空；容許英文字、片語與句型 |
| `wordNormalized` | string | 程式自動產生；前後去空白、內部連續空白縮成一格、轉小寫 |
| `type` | string | `word`、`phrase`、`pattern` 三選一 |
| `partOfSpeech` | string[] | 例如 `noun`、`verb`、`adjective`，可為空 |
| `translations` | string[] | 可為空；去掉空字串 |
| `definition` / `usage` | string | 可為空 |
| `collocations` | string[] | 可為空；刪除空項目 |
| `academicExamples` | object[] | 元素為 `{en, zh}`；一筆中至少有英文才保留 |
| `synonyms` | object[] | 元素為 `{word, difference}`，可為空 |
| `originalContext` | string | 原始論文中的句子，不自動虛構 |
| `source` | object | `{title, doi, url}`；選填 |
| `tags` / `sections` | string[] | 可為空；重複標籤合併 |
| `favorite` | boolean | 預設 `false` |
| `familiarity` | integer | 0 至 3，預設 0 |
| `createdAt` / `updatedAt` | string | ISO 8601；新增／更新時自動維護 |

**重複判斷**：以 `(type, wordNormalized)` 作為詞彙重複判斷鍵；新增時提示開啟既有紀錄或取消。不要以不同大小寫建立同類型重複紀錄。不同類型的同一文字可允許存在。

對 AI 與外部匯入資料可補齊缺少的非必要欄位；對類型不合法、必填詞彙空白、JSON 格式錯誤等情況應顯示具體訊息。不得在不提示的情況下丟棄有意義的資料。

### 5.4 IndexedDB schema

資料庫：`academic_vocabulary_db`，初始版本 `1`。

- `entries`：`keyPath: 'id'`；至少建立 `wordNormalized`、`type`、`favorite`、`createdAt` 索引。重複規則由業務邏輯檢查，也須妥善處理相近時間的重複提交。
- `settings`：`keyPath: 'key'`；儲存 theme、篩選偏好等設定。
- `metadata`：`keyPath: 'key'`；儲存最後備份時間、匯入狀態或必要 schema metadata。
- 資料庫開版升級時提供 migration 空間；資料庫遭封鎖或升級失敗時，顯示可理解的錯誤與恢復建議。

---

## 6. 功能詳細規格

### M01｜新增、編輯、刪除

1. 點選「新增單字」，輸入 `word` 和 `type` 即可儲存。
2. 新增與編輯均使用資料驗證；保存成功後清單與詳情即時更新。
3. 支援完整編輯、收藏切換、熟悉程度 0–3 調整。
4. 刪除單字時顯示詞彙名稱與二次確認；取消不可刪除。
5. 更新時保留原始 `createdAt`，更新 `updatedAt`。
6. 儲存失敗時顯示錯誤，編輯中的內容不可直接消失。

### M02｜搜尋與篩選

- 搜尋欄輸入時即時過濾（可 debounce 約 150–250ms）。
- 不區分英文大小寫；搜尋 `word`、`translations`、`definition`、`usage`、`collocations`、`academicExamples.en/zh`、`synonyms.word`、`tags`，也可搜尋 `originalContext`。
- 篩選類型（全部／Word／Phrase／Pattern）、標籤、論文章節、收藏狀態。
- 排序：最近新增（預設）、最近更新、英文字母 A–Z。
- 搜尋結果顯示筆數；沒有結果時顯示清楚空狀態與「清除篩選」操作。
- 第一版預期幾千筆以內，可載入至記憶體後進行本機篩選；若資料增加再評估全文索引。

### M03｜詞彙詳情

- 顯示主詞、類型、詞性、中譯、英文定義、用法、Collocations、學術例句、同義詞差異、原始句子、來源、標籤與論文章節。
- 每個例句或片語提供複製按鈕；使用 Clipboard API，失敗時給明確提示。
- 無內容的區塊可隱藏或顯示精簡提示，不必堆滿空欄位。
- 若 `source.url` 有值，經過協定與格式驗證後才能產生安全連結；不允許 `javascript:` 等危險協定。

### M04｜AI 半自動內容生成

**流程：**

1. 在新增／編輯畫面輸入英文、類型、領域（選填）與原始論文例句（選填）。
2. 點「產生 AI 提示詞」，複製可貼到 ChatGPT 的完整指令。
3. 使用者在 ChatGPT 取得 JSON，貼回「匯入 AI 結果」視窗。
4. 程式解析 JSON、比對單字、檢查欄位型別並將結果映射至資料模型。
5. 顯示預覽，清楚標明「目前紀錄」與「AI 建議」，避免無條件覆蓋使用者已編寫內容。
6. 使用者確認後才儲存至 IndexedDB。

**AI 提示詞要求：**

- 回覆只包含**有效 JSON 物件**，不要 Markdown fences 或額外說明。
- 使用繁體中文（台灣用語），適用於學術英文閱讀與寫作。
- 提供 `word`、`type`、`partOfSpeech`、`translations`、`definition`、`usage`、`collocations`、`academicExamples`、`synonyms`、`sections`、`tags`。
- 學術例句需為原創示例；不要杜撰文獻、DOI、實驗數字或研究結論。
- 如果原始句子的意思與常見詞義不同，須根據情境解釋；不確定時不要裝作確定。
- 若原始句子由使用者提供，原文應保留在本機現有紀錄的 `originalContext`，AI 不應修改使用者的來源資訊。

**JSON 匯入處理：**

- 接受 AI 結果的內容格式，但不要讓 AI 控制 `id`、`createdAt`、`updatedAt`、`favorite`、`originalContext` 或 `source` 等使用者／系統維護欄位。
- 明確處理 JSON parse error、遺漏字詞、欄位型別錯誤、錯字／詞彙不相符、過長內容與重複資料。
- AI 資料只是「建議」，所有欄位皆可修改，儲存前預覽。
- 可容忍外層以 Markdown ```json 包住的輸出，但必須安全剝除外層 fence，不能藉此執行程式碼。
- 不要使用 `eval()`；不要任意注入 HTML。

### M05｜標籤、收藏與寫作分類

- 提供可自由輸入的標籤（例如 `Security`、`Computer Science`、`Research Method`、`Academic Writing`）。
- `sections` 可選：`Abstract`、`Introduction`、`Related Work`、`Methodology`、`Evaluation`、`Results`、`Discussion`、`Conclusion`、`General`。
- 第一版可以把「適合用於論文寫作」以 `Academic Writing` 標籤呈現；保留未來引入 Learning / Writing 分類的擴充空間，不額外增加複雜狀態機。
- 常用標籤可依目前紀錄自動整理為篩選選項。

### M06｜JSON 備份、還原與資料保護

**匯出**

- 匯出**所有 entries**，不受目前搜尋／篩選影響。
- 命名例如 `vocabulary_backup_2026-10-24.json`。
- 格式需包含 `schemaVersion`、`exportedAt`、`entries`；以 UTF-8 JSON 下載。
- 匯出成功後可更新最後備份日期；如果瀏覽器不能確認使用者實際是否將檔案保留，UI 不得宣稱「已安全備份至指定磁碟」。

**匯入**

1. 使用者選取 JSON 檔案，先 parse 並驗證 schema 版本、筆數、欄位型別及是否有重複。
2. 顯示匯入預覽：總筆數、新增筆數、重複筆數、衝突筆數、錯誤筆數。
3. 提供「合併匯入」與「全部取代」兩種模式。
4. 合併時同 ID 的資料視為同一紀錄；相同 `(type, wordNormalized)` 但不同 ID 的資料視為待處理衝突，避免靜默建立重複資料。可採用「保留本機資料／跳過衝突」作為第一版預設；明確顯示結果。
5. 全部取代需要醒目的確認步驟，建議引導使用者先匯出目前資料。驗證全部成功後，以單一 IndexedDB transaction 進行清空與寫入，避免只完成一半。
6. 若匯入有嚴重格式錯誤，預設不寫入任何資料；提供錯誤摘要。
7. 明確告知使用者 IndexedDB 可能因清除網站資料、瀏覽器設定變更而消失；定期匯出 JSON 很重要。

---

## 7. 安全性、效能與使用體驗

- **XSS 防護**：所有使用者輸入、JSON、AI 輸出，都視為不可信文字；優先使用 `textContent` 和安全 DOM API，不直接拼接為 HTML。
- **匯入檢查**：限制合理的備份檔大小（建議預設 10 MB，可配置）、限制欄位大小及陣列項目數量，避免意外載入過大資料導致瀏覽器當掉；錯誤提示應具體。
- **連結安全**：外部來源僅允許 `https:`／`http:` 等安全協定，外開搭配 `rel="noopener noreferrer"`。
- **無網路可用**：只要 localhost 靜態服務正常，已建置的 CSS／JS 與 IndexedDB 功能不依賴外部 CDN。
- **存取性**：label 明確對應輸入欄位，對話視窗具基本鍵盤焦點管理，並提供可見 focus 狀態。
- **狀態回饋**：資料庫開啟中、儲存中、儲存成功、失敗、匯入進度及空結果，皆有清楚提示。
- **效能**：一般幾百到數千筆資料應維持流暢；避免每輸入一個字就完整重建所有不必要 DOM。
- **用語**：統一使用「儲存」而不是「存儲」；所有 UI 訊息使用繁體中文（台灣用語）。

---

## 8. 開發順序

請按照下列順序進行，確保每個階段都可運作：

### Phase 1：介面骨架

- 建立 `index.html`、Tailwind 編譯流程、淺色／深色模式。
- 完成頂部工具列、搜尋篩選列、左側單字清單、右側詳情面板、空狀態、對話視窗。
- 暫時用內部示範資料驗證畫面；正式資料不得由示範資料默默填入。

### Phase 2：資料與 CRUD

- 建立 IndexedDB 與 `entries`、`settings`、`metadata`。
- 新增、編輯、刪除、收藏、搜尋、排序、標籤及章節篩選。
- 實作資料驗證、重複判斷、失敗復原與 UI 狀態更新。

### Phase 3：AI 半自動流程

- 提示詞產生、複製按鈕、JSON 貼上與解析。
- 顯示 AI 內容預覽、欄位合併、使用者確認後儲存。

### Phase 4：備份、測試與交付

- JSON 匯出、合併匯入、全部取代、備份提醒。
- 完成 `start.bat`、README、測試、介面細節與基本錯誤處理。

---

## 9. 測試與驗收標準

請提供自動化測試（至少涵蓋純函式資料驗證、搜尋與匯入衝突邏輯）及可手動操作的驗收紀錄。

| 編號 | 測試情境 | 預期結果 |
|---|---|---|
| T01 | 新增 `mitigate`，關閉網頁後重開 | 資料仍存在且內容完整 |
| T02 | 已有 `mitigate`，再新增 `MITIGATE` | 提示重複，不新增第二筆同類型紀錄 |
| T03 | 搜尋「減輕」 | 可找到 `mitigate` |
| T04 | 搜尋英文搭配詞或例句片段 | 可找出對應紀錄 |
| T05 | 編輯翻譯與標籤後返回清單 | 內容更新，搜尋結果一致 |
| T06 | 刪除時按取消 | 原資料保留 |
| T07 | 匯入合法 AI JSON | 可預覽欄位，確認後正確儲存 |
| T08 | 匯入不合法 JSON | 有清楚錯誤，不寫入資料 |
| T09 | AI JSON 嘗試夾帶 `id` 或來源覆寫 | 不覆寫系統／使用者維護欄位 |
| T10 | 匯出全部 JSON，刪除內容後取代還原 | 能還原所有筆數與重要欄位 |
| T11 | 合併匯入含重複 ID 與重複單字 | 衝突正確呈現，不靜默覆蓋／重複 |
| T12 | 將一筆資料中插入 `<script>` 類似文字 | 文字安全顯示，不執行指令碼 |
| T13 | 切換深色模式並重新開啟 | 保留使用者的選擇 |
| T14 | 關閉外部網路但保留 localhost | 已有資料仍可查詢、新增與編輯 |
| T15 | 使用 `start.bat` 啟動 | 能在 `http://localhost:8765` 使用完整功能 |
| T16 | 故意造成資料庫寫入失敗 | 顯示失敗，不誤報成功、不丟掉未儲存的表單內容 |
| T17 | 在窄視窗使用 | 可查詢、開啟詳情、返回清單及新增單字 |

**完成定義**：以上核心情境可運作，README 足以讓一般 Windows 使用者依照步驟啟動，而且沒有假功能、空按鈕或僅供展示卻未標示的數據。

---

## 10. README 必須包含

1. 專案簡介與功能清單。
2. Windows 先決條件（Python；若需要重新建置樣式則需 Node.js）。
3. 首次開啟、使用 `start.bat` 啟動，以及服務關閉方式。
4. `http://localhost:8765` 為固定網址，不能任意更改 origin 的原因。
5. 如何快速新增單字、產生 ChatGPT 提示詞、貼回 AI JSON。
6. 如何匯出備份、合併匯入及還原全部資料。
7. IndexedDB 的限制、清除瀏覽器網站資料的風險及備份建議。
8. 開發時的建置／測試指令。
9. 已知限制、未來可能擴充方向。

---

## 11. 交付成果清單

請實際產出完整專案檔案：

- [ ] 可使用的 `index.html` 與編譯完成的 CSS。
- [ ] 完整原生 JavaScript 功能模組。
- [ ] IndexedDB schema、資料 CRUD、搜尋與資料驗證。
- [ ] AI 提示詞、結果解析／預覽／確認匯入。
- [ ] JSON 備份、還原、衝突處理。
- [ ] 深色模式、響應式版型、鍵盤操作。
- [ ] Windows `start.bat`。
- [ ] `README.md`。
- [ ] `data/sample.json` 示例（不自動覆蓋使用者資料）。
- [ ] 核心測試與測試執行說明。

完成後請**實際執行可行的測試與建置**，彙整通過／失敗項目，不要只宣稱完成。若環境限制導致部分項目無法驗證，須逐項指出。

---

## 12. 建議保留但不在 v1 實作的擴充方向

- 單字發音播放。
- Learning Vocabulary / Writing Vocabulary 明確分流。
- 間隔重複複習、熟悉度統計。
- 更進階的同義詞比較、論文寫作素材集。
- 本機 JSON 自動寫回（File System Access API；需額外考量瀏覽器權限及相容性）。
- 雲端同步或跨裝置資料共享。
- 安全的 AI API 整合（使用者日後主動決定是否引入必要的本機服務或 Serverless 後端）。

> **核心原則：** 第一版必須是「容易開啟、快速新增、好查詢、可靠儲存、可備份、能輔助學術寫作」的本機小工具，而不是功能膨脹的大型網站。
