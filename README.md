# 國中地理氣候圖練習（climate-chart-quiz）

讓國中生看十二個月的氣溫折線與降水長條，辨認氣候類型，並說出圖上的判讀依據。網站是 PWA，可在手機、平板、桌面使用，下載過一次題庫後可以離線練習。

線上版本：<https://jmw-168.github.io/climate-chart-quiz/>

> **目前是示範題庫**：題目使用合成教學資料（非真實測站），尚未經教材審核，不代表 108 課綱完整範圍。網站畫面也會明確標示。

## 功能（v1）

- **兩種題型**：看圖選氣候（一張圖＋四個名稱）、看氣候選圖（四張共同刻度的圖選一張）
- **三種難度**：入門／一般顯示年均溫與年降水量；進階隱藏，並加入南半球資料
- **提示與解析**：三層提示（先看氣溫 → 再看雨量 → 綜合比較）；答後顯示氣溫證據、降水證據、綜合判斷，並逐項說明你選的錯誤選項是「氣溫條件」還是「降水條件」不符
- **讀圖總複習**：讀圖說明頁列出所有氣候類型的代表圖、氣溫／降水特徵與容易混淆類型的分辨方法
- **成績**：只計第一次提交；分開呈現「沒用提示就答對」與全部答對題數，並列出各類型表現與逐題回顧
- **錯題複習**：答錯自動收錄；複習答對一次移出，再錯重新加入；可「練習同類新圖」避免只記住原圖
- **本機保存**：IndexedDB 保存回合、作答、錯題與設定；重新整理或關閉後可續作；支援匯出／匯入（整份取代）
- **PWA**：可安裝、離線練習、新版本等待到練習結束後再更新

不含：會員、後端 API、教師後台、排行榜、AI 即時出題、地區與成因教學（留待後續版本）。

## 開發

需求：Node.js 20 以上。

```bash
npm ci                 # 安裝依 lockfile 鎖定的套件
npm run dev            # 開發伺服器
npm test               # 單元測試（Vitest）
npm run build          # 驗證題庫 → 型別檢查 → 建置到 dist/
npm run preview        # 預覽建置結果
npm run e2e            # E2E 煙霧測試（需先 build，且本機有 Playwright 與 Chromium）
```

### 技術架構

Vue 3＋TypeScript＋Vite、Vue Router、Pinia、IndexedDB（idb）、SVG 自繪氣候圖、vite-plugin-pwa（Workbox）。沒有任何第三方 CDN，字型使用系統字體。

```text
src/
  domain/         出題、判分、錯題、統計、內容驗證（不依賴 Vue，可注入亂數種子）
  repositories/   content.ts 題庫下載與校驗；progress.ts IndexedDB 學習紀錄
  stores/         app（題庫、設定、離線狀態）與 session（目前回合）
  components/     ClimateChart、QuestionOptions、ChartChoiceGrid、ExplanationPanel…
  pages/          首頁、讀圖說明、練習設定、練習、結果、錯題、設定、資料說明
  pwa/update.ts   Service Worker 註冊與更新提示
content/          題庫原始檔（taxonomy、datasets、explanations、curriculum-mapping、manifest）
scripts/          內容產生、驗證、打包、圖示
tests/unit, tests/e2e
```

## 題庫內容流程

1. 編輯 `content/` 內的 JSON（或修改 `scripts/author-demo-content.ts` 後執行 `npm run content:author` 重新產生示範資料）。
2. `npm run content:validate` 檢查月資料、引用、重疊名稱、錯誤選項解析，並試組每種難度與題型。另有兩道自動把關：
   - **柯本交叉檢查**：每組資料依柯本（Köppen–Geiger）分類計算代碼，與類型的 `koppenCodes` 不一致時驗證失敗；確有理由保留時須在資料寫明 `koppenException`。柯本只是檢查工具，不等於教材分類。
   - **逐項判讀條件**：每個類型有 `criteria.temperature`、`criteria.precipitation`。每組資料必須符合自己類型的兩項條件；任何錯誤選項若兩項都符合，代表題目可能兩解，驗證失敗。
3. 正式題庫：把 `content/manifest.json` 的 `mode` 改為 `production`、更新 `contentVersion`，並通過 `npm run content:validate -- --production`。production 模式只用 `published` 資料出題，且要求每筆資料有審核紀錄、來源、授權，以及教材對照（冊別、頁碼、審核人）。
4. `npm run build` 會把題庫輸出到不可變版本路徑 `content/v<版本>/`，並在 `content/manifest.json` 記錄大小與 SHA-256。網站下載後校驗通過才整包替換；舊回合使用題目快照，不受題庫更新影響。

資料規則重點：

- 每組資料恰 12 個月，氣溫可低於 0、降水不得為負；同一組的氣溫與降水須來自相同站點與統計期間。
- `aliases` 只放語義確實相同的名稱；有重疊關係的類型用 `overlapTypeIds` 標示，兩者不會同時出現在同一題選項中。
- 無法單憑氣候圖辨認的類型（目前：高地氣候）設 `graphIdentifiable: false`，只列教學比較，不出題。
- 沒有授權的課本截圖不得放進題庫。

## 部署

推送到 `main` 後，GitHub Actions 會執行內容驗證、單元測試、型別檢查與建置，並部署到 GitHub Pages。其他靜態主機可用 `BASE_PATH=/ npm run build` 建置到根路徑，並設定 SPA fallback（GitHub Pages 以 `404.html` 達成）。

## 已知限制

- 示範題庫：13 個可命題類型各 3 組合成資料，尚未對照課綱原文與三版教材；正式發布前須完成教材對照矩陣與內容審核。
- 題數受資料量限制：例如入門難度每類只有 1 組，入門 20 題時會提示實際可用題數，不會重複湊題。
- 第一次開啟必須連網；之後可離線。紀錄只存在單一瀏覽器，清除網站資料會遺失，請用匯出備份。
- 各瀏覽器的安裝方式不同（iOS 需從 Safari「加入主畫面」）。

## 版本紀錄

- 0.1.0：v1 首版——兩種題型、三種難度、提示與解析、錯題複習、本機保存與匯出匯入、PWA 離線與更新、示範題庫。
