<script setup lang="ts">
// 答後解析（規格 §7）：內容全部來自題目快照中的審核文字，不即時推論。
import { computed } from 'vue';
import type { QuestionSnapshot } from '../domain/types';

const props = defineProps<{ question: QuestionSnapshot; selectedOptionId: string; correct: boolean }>();

const labelOf = (id: string) => {
  const q = props.question;
  if (q.kind === 'chart-to-type') return q.options.find((o) => o.id === id)?.label ?? '';
  const o = q.options.find((x) => x.id === id);
  return o ? `圖 ${o.letter}` : '';
};
const correctName = computed(() =>
  props.question.kind === 'chart-to-type'
    ? props.question.explanation.correctLabel
    : `${labelOf(props.question.correctOptionId)}（${props.question.explanation.correctLabel}）`,
);
const others = computed(() =>
  props.question.options
    .filter((o) => o.id !== props.question.correctOptionId && o.id !== props.selectedOptionId)
    .map((o) => ({ id: o.id, label: labelOf(o.id), reason: props.question.explanation.optionReasons[o.id] })),
);
</script>

<template>
  <section class="sheet explanation" aria-labelledby="exp-title">
    <div class="result-banner" :class="correct ? 'ok' : 'bad'" role="status" aria-live="assertive">
      <span aria-hidden="true">{{ correct ? '✓' : '✗' }}</span>
      <span>{{ correct ? '答對了' : '答錯了' }}：正確答案是 {{ correctName }}</span>
    </div>
    <h2 id="exp-title" class="visually-hidden">答案解析</h2>
    <dl class="evidence">
      <div class="t"><dt>氣溫證據</dt><dd>{{ question.explanation.temperatureEvidence }}</dd></div>
      <div class="p"><dt>降水證據</dt><dd>{{ question.explanation.precipitationEvidence }}</dd></div>
      <div class="c"><dt>綜合判斷</dt><dd>{{ question.explanation.conclusion }}</dd></div>
    </dl>
    <div v-if="!correct" class="why-wrong">
      <h3>你選的{{ labelOf(selectedOptionId) }}為什麼不對</h3>
      <p>{{ question.explanation.optionReasons[selectedOptionId] }}</p>
    </div>
    <details v-if="others.length">
      <summary>看其他選項為什麼不對</summary>
      <ul class="others">
        <li v-for="o in others" :key="o.id"><strong>{{ o.label }}</strong>：{{ o.reason }}</li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.why-wrong { background: var(--bad-bg); border-radius: var(--radius-s); padding: 10px 12px; margin-bottom: 8px; }
.why-wrong h3 { font-size: 0.98rem; color: var(--bad); margin-bottom: 4px; }
.why-wrong p { margin: 0; }
.others { padding-left: 1.2em; margin: 0; }
.others li { margin-bottom: 8px; }
</style>
