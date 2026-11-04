<script setup lang="ts">
// 氣候圖（規格 §5）：橫軸 1–12 月；左軸氣溫°C 紅色折線＋圓點；右軸降水 mm 藍色長條。
// 直線連接月均溫，不做平滑；尺度由外部傳入，四圖題共用同一尺度。
import { computed, ref } from 'vue';
import type { ChartScale } from '../domain/types';
import { fmt0, fmt1 } from '../domain/stats';

const props = withDefaults(
  defineProps<{
    temperatureC: number[];
    precipitationMm: number[];
    scale: ChartScale;
    label: string;
    compact?: boolean;
    highlights?: { temperature: number[]; precipitation: number[] } | null;
    showTable?: boolean;
  }>(),
  { compact: false, highlights: null, showTable: true },
);

const W = 360;
const H = 250;
const M = { left: 40, right: 42, top: 26, bottom: 26 };
const pw = W - M.left - M.right;
const ph = H - M.top - M.bottom;
const bw = pw / 12;

const steps = computed(() => Math.round((props.scale.tempMax - props.scale.tempMin) / 10));
const tempTicks = computed(() => Array.from({ length: steps.value + 1 }, (_, i) => props.scale.tempMin + i * 10));
const precipStep = computed(() => props.scale.precipMax / steps.value);
const tickEvery = computed(() => (props.compact || steps.value > 10 ? 2 : 1));

const xOf = (i: number) => M.left + bw * (i + 0.5);
const yT = (t: number) => M.top + ph * (1 - (t - props.scale.tempMin) / (props.scale.tempMax - props.scale.tempMin));
const yP = (p: number) => M.top + ph * (1 - p / props.scale.precipMax);

const linePoints = computed(() => props.temperatureC.map((t, i) => `${xOf(i).toFixed(1)},${yT(t).toFixed(1)}`).join(' '));

const active = ref<number | null>(null);
const readout = computed(() => {
  if (active.value === null) return props.compact ? '' : '點選圖上的月份，或用鍵盤左右鍵查看每月數值';
  const i = active.value;
  return props.compact
    ? `${i + 1}月 ${fmt1(props.temperatureC[i])}°C／${fmt0(props.precipitationMm[i])} mm`
    : `${i + 1} 月：氣溫 ${fmt1(props.temperatureC[i])}°C，降水 ${fmt0(props.precipitationMm[i])} mm`;
});

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const d = e.key === 'ArrowRight' ? 1 : -1;
    active.value = active.value === null ? (d > 0 ? 0 : 11) : (active.value + d + 12) % 12;
  } else if (e.key === 'Home') {
    active.value = 0;
  } else if (e.key === 'End') {
    active.value = 11;
  } else if (e.key === 'Escape') {
    active.value = null;
  }
}

const hiTemp = computed(() => new Set(props.highlights?.temperature ?? []));
const hiRain = computed(() => new Set(props.highlights?.precipitation ?? []));
const maxMonth = computed(() => props.temperatureC.indexOf(Math.max(...props.temperatureC)) + 1);
</script>

<template>
  <figure class="climate-chart" :class="{ compact }">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="group"
      :aria-label="`${label}：氣候圖，左軸氣溫、右軸降水量。使用左右鍵逐月查看數值。`"
      tabindex="0"
      @keydown="onKey"
      @blur="active = null"
    >
      <!-- 方格與刻度 -->
      <g class="grid">
        <line v-for="t in tempTicks" :key="`g${t}`" :x1="M.left" :x2="W - M.right" :y1="yT(t)" :y2="yT(t)" :class="{ zero: t === 0 }" />
        <line v-for="i in 13" :key="`v${i}`" :x1="M.left + bw * (i - 1)" :x2="M.left + bw * (i - 1)" :y1="M.top" :y2="H - M.bottom" class="v" />
      </g>

      <!-- 降水長條 -->
      <g class="bars">
        <rect
          v-for="(p, i) in precipitationMm"
          :key="`b${i}`"
          :x="xOf(i) - bw * 0.32"
          :y="yP(p)"
          :width="bw * 0.64"
          :height="Math.max(0, H - M.bottom - yP(p))"
          :class="{ hi: hiRain.has(i + 1), act: active === i }"
        />
      </g>

      <!-- 氣溫折線 -->
      <polyline class="temp-line" :points="linePoints" />
      <g class="dots">
        <circle
          v-for="(t, i) in temperatureC"
          :key="`d${i}`"
          :cx="xOf(i)"
          :cy="yT(t)"
          :r="hiTemp.has(i + 1) || active === i ? 5 : 3.2"
          :class="{ hi: hiTemp.has(i + 1) }"
        />
      </g>
      <g v-if="highlights" class="hi-labels">
        <template v-for="m in highlights.temperature" :key="`hl${m}`">
          <text :x="xOf(m - 1)" :y="yT(temperatureC[m - 1]) - 9" text-anchor="middle">{{ m === maxMonth ? '最高' : '最低' }}</text>
        </template>
      </g>

      <!-- 點選區 -->
      <g class="hit">
        <rect
          v-for="i in 12"
          :key="`h${i}`"
          :x="M.left + bw * (i - 1)"
          :y="M.top"
          :width="bw"
          :height="ph"
          :class="{ act: active === i - 1 }"
          @click="active = active === i - 1 ? null : i - 1"
        />
      </g>

      <!-- 軸 -->
      <g class="axis">
        <line :x1="M.left" :x2="M.left" :y1="M.top" :y2="H - M.bottom" class="temp-axis" />
        <line :x1="W - M.right" :x2="W - M.right" :y1="M.top" :y2="H - M.bottom" class="rain-axis" />
        <line :x1="M.left" :x2="W - M.right" :y1="H - M.bottom" :y2="H - M.bottom" />
        <template v-for="(t, k) in tempTicks" :key="`tl${t}`">
          <text v-if="k % tickEvery === 0" :x="M.left - 5" :y="yT(t) + 4" text-anchor="end" class="tl">{{ t }}</text>
          <text v-if="k % tickEvery === 0" :x="W - M.right + 5" :y="yT(t) + 4" text-anchor="start" class="pl">{{ Math.round(k * precipStep) }}</text>
        </template>
        <text v-for="i in 12" :key="`m${i}`" :x="xOf(i - 1)" :y="H - M.bottom + 16" text-anchor="middle" class="ml">{{ i }}</text>
        <text :x="M.left - 4" :y="14" text-anchor="middle" class="tl unit">°C</text>
        <text :x="W - M.right + 6" :y="14" text-anchor="middle" class="pl unit">mm</text>
        <text :x="W / 2" :y="14" text-anchor="middle" class="ml unit">月</text>
      </g>
    </svg>

    <figcaption>
      <span v-if="!compact" class="legend">
        <span class="key temp" aria-hidden="true"></span>氣溫（°C，左軸）
        <span class="key rain" aria-hidden="true"></span>降水量（mm，右軸）
      </span>
      <span class="readout" aria-live="polite">{{ readout }}</span>
    </figcaption>

    <details v-if="showTable" class="table-toggle">
      <summary>展開 12 個月資料表</summary>
      <div class="table-wrap">
        <table class="data">
          <caption class="visually-hidden">{{ label }} 每月氣溫與降水量</caption>
          <thead>
            <tr><th scope="col">月份</th><th scope="col">氣溫（°C）</th><th scope="col">降水量（mm）</th></tr>
          </thead>
          <tbody>
            <tr v-for="(t, i) in temperatureC" :key="i">
              <th scope="row">{{ i + 1 }} 月</th>
              <td>{{ fmt1(t) }}</td>
              <td>{{ fmt0(precipitationMm[i]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </figure>
</template>

<style scoped>
.climate-chart { margin: 0; }
svg {
  display: block;
  width: 100%;
  height: auto;
  background: #fbfcfd;
  border-radius: 6px;
  touch-action: manipulation;
}
svg:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.grid line { stroke: var(--grid); stroke-width: 1; }
.grid line.v { stroke: #eef2f5; }
.grid line.zero { stroke: #9fb0be; stroke-dasharray: 4 3; }
.bars rect { fill: var(--rain); opacity: 0.78; }
.bars rect.hi { opacity: 1; stroke: #173f6d; stroke-width: 1.5; }
.bars rect.act { opacity: 1; }
.temp-line { fill: none; stroke: var(--temp); stroke-width: 2.2; stroke-linejoin: round; }
.dots circle { fill: var(--temp); stroke: #fff; stroke-width: 1.2; }
.dots circle.hi { stroke: #7a1c15; stroke-width: 2; }
.hi-labels text { font-size: 10px; font-weight: 700; fill: #7a1c15; paint-order: stroke; stroke: #fff; stroke-width: 3px; }
.hit rect { fill: transparent; cursor: pointer; }
.hit rect.act { fill: rgba(29, 53, 87, 0.08); }
.axis line { stroke: #5d6f7f; stroke-width: 1; }
.axis line.temp-axis { stroke: var(--temp); stroke-width: 1.5; }
.axis line.rain-axis { stroke: var(--rain); stroke-width: 1.5; }
.axis text { font-size: 11px; font-family: var(--font); }
.compact .axis text { font-size: 13px; }
.axis .tl { fill: var(--temp); }
.axis .pl { fill: var(--rain); }
.axis .ml { fill: var(--ink-soft); }
.axis .unit { font-weight: 700; }
figcaption {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 2px 12px;
  font-size: 0.85rem;
  margin-top: 6px;
  color: var(--ink-soft);
}
.compact figcaption { font-size: 0.78rem; margin-top: 2px; }
.compact .readout { min-height: 1.3em; }
.legend { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.key { display: inline-block; width: 18px; height: 10px; margin-left: 4px; }
.key.temp { height: 3px; background: var(--temp); border-radius: 2px; }
.key.rain { background: var(--rain); opacity: 0.8; }
.readout { color: var(--ink); min-height: 1.4em; }
.table-wrap { overflow-x: auto; }
.table-toggle { margin-top: 4px; font-size: 0.92rem; }
.compact .table-toggle { display: none; }
</style>
