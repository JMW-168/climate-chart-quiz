<script setup lang="ts">
// 氣候圖（規格 §5）：橫軸 1–12 月；左軸氣溫°C 紅色折線＋圓點；右軸降水 mm 藍色長條。
// 直線連接月均溫，不做平滑；尺度由外部傳入，四圖題共用同一尺度。
import { computed } from 'vue';
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
    /** 自訂氣溫標記文字（月份 → 文字），預設為最高／最低 */
    markLabels?: Record<number, string> | null;
  }>(),
  { compact: false, highlights: null, showTable: true, markLabels: null },
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

const hiTemp = computed(() => new Set(props.highlights?.temperature ?? []));
const hiRain = computed(() => new Set(props.highlights?.precipitation ?? []));
const maxMonth = computed(() => props.temperatureC.indexOf(Math.max(...props.temperatureC)) + 1);
</script>

<template>
  <figure class="climate-chart" :class="{ compact }">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="`${label}：氣候圖，左軸氣溫、右軸降水量${showTable ? '，下方可展開每月資料表' : ''}。`"
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
          :x="M.left + bw * i"
          :y="yP(p)"
          :width="bw"
          :height="Math.max(0, H - M.bottom - yP(p))"
          :class="{ hi: hiRain.has(i + 1) }"
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
          :r="hiTemp.has(i + 1) ? 5 : 3.2"
          :class="{ hi: hiTemp.has(i + 1) }"
        />
      </g>
      <g v-if="highlights" class="hi-labels">
        <template v-for="m in highlights.temperature" :key="`hl${m}`">
          <text :x="xOf(m - 1)" :y="yT(temperatureC[m - 1]) - 9" text-anchor="middle">{{ markLabels?.[m] ?? (m === maxMonth ? '最高' : '最低') }}</text>
        </template>
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

    <figcaption v-if="!compact">
      <span class="legend">
        <span class="key temp" aria-hidden="true"></span>氣溫（°C，左軸）
        <span class="key rain" aria-hidden="true"></span>降水量（mm，右軸）
      </span>
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
}
.grid line { stroke: var(--grid); stroke-width: 1; }
.grid line.v { stroke: #eef2f5; }
.grid line.zero { stroke: #9fb0be; stroke-dasharray: 4 3; }
.bars rect { fill: #6f9fd4; stroke: #1f4f87; stroke-width: 0.8; }
.bars rect.hi { fill: var(--rain); stroke: #173f6d; stroke-width: 1.4; }
.temp-line { fill: none; stroke: var(--temp); stroke-width: 2.2; stroke-linejoin: round; }
.dots circle { fill: var(--temp); stroke: #fff; stroke-width: 1.2; }
.dots circle.hi { stroke: #7a1c15; stroke-width: 2; }
.hi-labels text { font-size: 10px; font-weight: 700; fill: #7a1c15; paint-order: stroke; stroke: #fff; stroke-width: 3px; }
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
.legend { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.key { display: inline-block; width: 18px; height: 10px; margin-left: 4px; }
.key.temp { height: 3px; background: var(--temp); border-radius: 2px; }
.key.rain { background: var(--rain); opacity: 0.8; }
.table-wrap { overflow-x: auto; }
.table-toggle { margin-top: 4px; font-size: 0.92rem; }
.compact .table-toggle { display: none; }
</style>
