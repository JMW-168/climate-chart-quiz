<script setup lang="ts">
// Q2 四張圖選一張：2×2、共同尺度、A～D；單圖可放大，放大後仍可選擇或返回。
import { ref } from 'vue';
import ClimateChart from './ClimateChart.vue';
import ClimateSummary from './ClimateSummary.vue';
import type { TypeToChartQuestion } from '../domain/types';

const props = defineProps<{
  question: TypeToChartQuestion;
  selected: string | null;
  submitted: boolean;
  showHighlights: boolean;
}>();
const emit = defineEmits<{ select: [id: string] }>();

const zoomed = ref<TypeToChartQuestion['options'][number] | null>(null);
const dialog = ref<HTMLDialogElement | null>(null);
function zoom(o: TypeToChartQuestion['options'][number]) {
  zoomed.value = o;
  dialog.value?.showModal();
}
function pickZoomed() {
  if (zoomed.value && !props.submitted) emit('select', zoomed.value.id);
  dialog.value?.close();
}
const hl = (id: string) => (props.showHighlights && id === props.question.correctOptionId ? props.question.explanation.highlightMonths : null);
</script>

<template>
  <p class="shared-legend small">
    <span class="key temp" aria-hidden="true"></span>氣溫（°C，左軸）
    <span class="key rain" aria-hidden="true"></span>降水量（mm，右軸）
    <span class="muted">・四張圖刻度相同</span>
  </p>
  <div class="chart-grid" role="radiogroup" aria-label="選擇符合的氣候圖">
    <div
      v-for="o in question.options"
      :key="o.id"
      class="chart-card"
      :class="{
        selected: selected === o.id && !submitted,
        'is-correct': submitted && o.id === question.correctOptionId,
        'is-wrong': submitted && selected === o.id && o.id !== question.correctOptionId,
      }"
    >
      <div class="chart-card-head">
        <span class="chart-letter">圖 {{ o.letter }}</span>
        <button class="btn quiet" type="button" :aria-label="`放大圖 ${o.letter}`" @click="zoom(o)">放大</button>
      </div>
      <ClimateChart
        compact
        :temperature-c="o.chart.temperatureC"
        :precipitation-mm="o.chart.precipitationMm"
        :scale="question.scale"
        :label="`圖 ${o.letter}`"
        :highlights="hl(o.id)"
        :show-table="false"
      />
      <ClimateSummary v-if="question.showSummary" compact :temperature-c="o.chart.temperatureC" :precipitation-mm="o.chart.precipitationMm" />
      <label class="btn chart-pick" :class="{ primary: selected === o.id }">
        <input
          type="radio"
          :name="`pick-${question.id}`"
          :value="o.id"
          :checked="selected === o.id"
          :disabled="submitted"
          @change="emit('select', o.id)"
        />
        <template v-if="submitted && o.id === question.correctOptionId">✓ 正確答案</template>
        <template v-else-if="submitted && selected === o.id">✗ 你的選擇</template>
        <template v-else>{{ selected === o.id ? `已選圖 ${o.letter}` : `選圖 ${o.letter}` }}</template>
      </label>
    </div>
  </div>

  <dialog ref="dialog" :aria-label="zoomed ? `圖 ${zoomed.letter} 放大` : '放大圖'" @close="zoomed = null">
    <template v-if="zoomed">
      <h2>圖 {{ zoomed.letter }}</h2>
      <ClimateChart
        :temperature-c="zoomed.chart.temperatureC"
        :precipitation-mm="zoomed.chart.precipitationMm"
        :scale="question.scale"
        :label="`圖 ${zoomed.letter}`"
        :highlights="hl(zoomed.id)"
      />
      <ClimateSummary v-if="question.showSummary" :temperature-c="zoomed.chart.temperatureC" :precipitation-mm="zoomed.chart.precipitationMm" />
      <div class="btn-row" style="margin-top: 12px">
        <button v-if="!submitted" class="btn primary" type="button" @click="pickZoomed">選圖 {{ zoomed.letter }}</button>
        <button class="btn" type="button" @click="dialog?.close()">返回選項</button>
      </div>
    </template>
  </dialog>
</template>

<style scoped>
.shared-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin: 0 0 8px; color: var(--ink-soft); }
.key { display: inline-block; width: 18px; height: 10px; margin-left: 2px; }
.key.temp { height: 3px; background: var(--temp); border-radius: 2px; }
.key.rain { background: var(--rain); opacity: 0.8; }
.is-correct .chart-pick { border-color: var(--ok); color: var(--ok); background: var(--sheet); opacity: 1; }
.is-wrong .chart-pick { border-color: var(--bad); color: var(--bad); background: var(--sheet); opacity: 1; }
.chart-pick { width: 100%; margin-top: auto; }
.chart-pick:has(input:disabled) { opacity: 0.7; cursor: default; }
</style>
