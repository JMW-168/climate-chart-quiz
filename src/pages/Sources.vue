<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/app';

const app = useAppStore();
const stations = computed(() => app.pkg?.datasets.filter((d) => d.origin === 'observed-normal').length ?? 0);
const exceptions = computed(() => app.pkg?.datasets.filter((d) => d.koppenException) ?? []);
const typeLabel = (id: string) => app.pkg?.taxonomy.types.find((t) => t.id === id)?.label ?? id;
const REPO = 'https://github.com/JMW-168/climate-chart-quiz';
</script>

<template>
  <h1>資料來源與授權</h1>

  <section class="sheet notice" aria-labelledby="np-title">
    <h2 id="np-title">非營利教育用途</h2>
    <p>
      本網站是個人製作的<strong>非營利教育專案</strong>，目的是協助國中生練習判讀氣候圖。
    </p>
    <ul>
      <li>完全免費，沒有付費功能、沒有廣告，也不販售任何資料或服務。</li>
      <li>不需要註冊，不蒐集個人資料；學習紀錄只存在你自己的瀏覽器，不會上傳。</li>
      <li>不是任何出版社、學校或政府機關的官方產品，也未經其授權或背書。</li>
      <li>所有引用資料都註明出處，僅用於教學與自學。</li>
    </ul>
  </section>

  <section class="sheet" aria-labelledby="data-title">
    <h2 id="data-title">氣候數據</h2>
    <dl class="facts">
      <div><dt>資料集</dt><dd>WMO Climatological Standard Normals 1991–2020（世界氣象組織 1991–2020 氣候標準平均值）</dd></div>
      <div>
        <dt>發布單位</dt>
        <dd>
          美國國家海洋暨大氣總署 國家環境資訊中心（NOAA NCEI）彙整發布，
          <a href="https://www.ncei.noaa.gov/archive/accession/0253808" target="_blank" rel="noopener">NCEI Accession 0253808</a>
        </dd>
      </div>
      <div><dt>原始提供者</dt><dd>各國國家氣象機構依世界氣象組織（WMO）規範計算並提交</dd></div>
      <div><dt>使用項目</dt><dd>月平均氣溫（TAVG）與月降水量（PRCP）；採「30 年中至少 24 年有資料」的合併檔</dd></div>
      <div><dt>使用方式</dt><dd>共 {{ stations }} 個測站，數值逐字轉錄、未經修改，並與原始檔逐筆核對；圖表上的年均溫、年降水量由這些數值計算</dd></div>
    </dl>
    <p class="small muted">題目畫面刻意不顯示測站名稱，避免用城市名稱猜答案；完整測站清單見<RouterLink to="/data">題庫資料說明</RouterLink>。</p>
  </section>

  <section class="sheet" aria-labelledby="term-title">
    <h2 id="term-title">氣候類型的名稱與分類</h2>
    <p>
      氣候類型的名稱與分組參考翰林出版公開的教學資源，例如
      <a href="https://www.ehanlin.com.tw/app/keyword/%E5%9C%8B%E4%B8%AD/%E5%9C%B0%E7%90%86/%E4%B8%96%E7%95%8C%E6%B0%A3%E5%80%99.html" target="_blank" rel="noopener">翰林雲端學院「世界氣候」</a>
      頁面，並參考學校公開的教學資料。
    </p>
    <ul>
      <li>本網站<strong>沒有使用任何課本、講義或參考書的內容與截圖</strong>，所有氣候圖都依上述公開數據自行繪製。</li>
      <li>名稱尚未逐一對照課本冊別與頁碼；若與你使用的課本用詞不同，請以課本與老師說明為準。</li>
      <li>「翰林」為其所屬公司的名稱，僅用於說明參考來源，不代表本網站與其有任何合作關係。</li>
    </ul>
  </section>

  <section class="sheet" aria-labelledby="rule-title">
    <h2 id="rule-title">判讀條件與解析</h2>
    <ul>
      <li>解析中的「氣溫條件」「降水條件」與數字門檻（例如 18°C、250 mm）是本網站為教學整理的暫定標準，不是官方定義。</li>
      <li>
        每筆資料都另外用柯本（Köppen–Geiger）氣候分類交叉檢查，依據
        <a href="https://doi.org/10.5194/hess-11-1633-2007" target="_blank" rel="noopener">Peel、Finlayson 與 McMahon（2007）</a>
        的門檻。柯本分類只作檢查工具，和課本分類不完全相同。
      </li>
      <li v-if="exceptions.length">
        有 {{ exceptions.length }} 筆資料的柯本結果和題庫分類不同，已個別寫明理由：
        <ul>
          <li v-for="d in exceptions" :key="d.id">{{ typeLabel(d.typeId) }}：{{ d.koppenException }}</li>
        </ul>
      </li>
    </ul>
  </section>

  <section class="sheet" aria-labelledby="code-title">
    <h2 id="code-title">程式與錯誤回報</h2>
    <p>
      網站原始碼公開於 <a :href="REPO" target="_blank" rel="noopener">GitHub</a>，使用 Vue、Vite 等開源套件製作。
      發現題目、解析或資料有誤，或權利人對內容有任何疑慮，歡迎到
      <a :href="`${REPO}/issues`" target="_blank" rel="noopener">GitHub Issues</a> 回報，我們會儘速確認與處理。
    </p>
  </section>
</template>

<style scoped>
.notice { border-left: 5px solid var(--navy); }
.notice ul, .sheet ul { padding-left: 1.3em; margin: 0 0 6px; }
.sheet li { margin-bottom: 6px; }
.facts { margin: 0 0 10px; display: grid; gap: 8px; }
.facts div { display: grid; grid-template-columns: 6.5em 1fr; gap: 10px; }
.facts dt { font-weight: 700; color: var(--ink-soft); }
.facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
@media (max-width: 420px) {
  .facts div { grid-template-columns: 1fr; gap: 0; }
}
</style>
