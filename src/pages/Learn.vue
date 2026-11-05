<script setup lang="ts">
import { computed, ref } from 'vue';
import ClimateChart from '../components/ClimateChart.vue';
import { DEFAULT_SCALE, fmt0, fmt1, summarize } from '../domain/stats';

// 奈及利亞阿布加（WMO 1991–2020 平均值）
const t = [26.9, 29.3, 30.7, 30, 28.1, 26.6, 25.7, 25.2, 25.7, 26.5, 26.9, 26.3];
const p = [0.8, 5.9, 22.4, 72.8, 156.7, 194.4, 249.8, 308.3, 229.4, 169.5, 9.7, 1.3];
const s = summarize(t, p);
const show = ref<'none' | 'range' | 'rain'>('none');
const highlights = computed(() =>
  show.value === 'range'
    ? { temperature: [s.maxTempMonth, s.minTempMonth], precipitation: [] }
    : show.value === 'rain'
      ? { temperature: [], precipitation: [5, 6, 7, 8, 9, 10] }
      : null,
);
</script>

<template>
  <h1>怎麼讀氣候圖</h1>
  <p class="small"><RouterLink to="/review">總複習：所有氣候類型與特徵</RouterLink>｜<RouterLink to="/map">世界氣候分布圖</RouterLink>｜<RouterLink to="/causes">成因：風帶季移</RouterLink></p>

  <section class="sheet">
    <ClimateChart :temperature-c="t" :precipitation-mm="p" :scale="DEFAULT_SCALE" label="讀圖示範" :highlights="highlights" />
    <p class="small muted" style="margin: 6px 0 0">示範資料：奈及利亞阿布加，WMO 1991–2020 氣候平均值。</p>
    <div class="btn-row" style="margin-top: 12px" role="group" aria-label="在圖上標記">
      <button class="btn" type="button" :aria-pressed="show === 'range'" @click="show = show === 'range' ? 'none' : 'range'">標出最高與最低溫月</button>
      <button class="btn" type="button" :aria-pressed="show === 'rain'" @click="show = show === 'rain' ? 'none' : 'rain'">標出雨季</button>
    </div>
  </section>

  <section class="sheet">
    <h2>圖上有什麼</h2>
    <dl class="evidence">
      <div class="c"><dt>橫軸：月份</dt><dd>從左到右是 1 月到 12 月，每一格是一個月。</dd></div>
      <div class="t"><dt>紅色折線：月均溫，看左軸（°C）</dt><dd>每個點是那個月的平均氣溫。點越高越熱；低於 0°C 的虛線表示結冰的冷。</dd></div>
      <div class="p"><dt>藍色長條：月降水量，看右軸（mm）</dt><dd>長條越高，那個月下的雨（或雪）越多。左右兩條軸的刻度不同，讀數值時要看對邊。</dd></div>
    </dl>
    <p class="small muted">想知道某個月的確切數值，可以展開圖下方的「12 個月資料表」。</p>
  </section>

  <section class="sheet">
    <h2>三個觀察步驟</h2>
    <ol class="steps">
      <li>
        <h3>先看氣溫</h3>
        <p>
          找出最熱月和最冷月，相減就是<strong>年溫差</strong>。這張圖最熱 {{ fmt1(t[s.maxTempMonth - 1]) }}°C（{{ s.maxTempMonth }} 月）、
          最冷 {{ fmt1(t[s.minTempMonth - 1]) }}°C（{{ s.minTempMonth }} 月），年溫差 {{ fmt1(s.range) }}°C。
          全年都在 25°C 以上，代表終年高溫。
        </p>
      </li>
      <li>
        <h3>再看雨量</h3>
        <p>
          看長條高的月份集中在哪裡。這張圖 5～10 月雨量多（最多 {{ fmt0(p[s.maxPrecipMonth - 1]) }} mm），
          11～2 月幾乎沒有雨：一年中有明顯的<strong>雨季與乾季</strong>。全年合計約 {{ fmt0(s.totalPrecip) }} mm。
        </p>
      </li>
      <li>
        <h3>綜合比較</h3>
        <p>把氣溫和雨量放在一起想：雨季是在熱的季節還是冷的季節？最冷月有沒有低於 0°C？再和類似的氣候類型比較差異。</p>
      </li>
    </ol>
    <h3>年均溫與年降水量</h3>
    <p class="small">
      年均溫＝12 個月均溫的平均（取 1 位小數）；年降水量＝12 個月降水量的總和（取整數）。
      入門與一般難度會顯示這兩個數字，進階難度會隱藏，需要自己從圖上判斷。
    </p>
    <h3>南半球的圖</h3>
    <p class="small">月份一律照 1～12 月排列。南半球的夏季在 12～2 月，所以最熱月會出現在圖的兩端；不要以為年中就一定是夏季。</p>
  </section>

  <div class="btn-row">
    <RouterLink class="btn primary" to="/practice/setup">開始練習</RouterLink>
  </div>
</template>

<style scoped>
.steps { margin: 0; padding-left: 1.4em; }
.steps li { margin-bottom: 8px; }
.steps h3 { margin-bottom: 0.2em; }
button[aria-pressed='true'] { background: var(--navy); color: #fff; }
</style>
