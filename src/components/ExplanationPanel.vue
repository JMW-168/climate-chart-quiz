<script setup lang="ts">
// 答後解析（規格 §7）：內容全部來自題目快照中的審核文字，不即時推論。
import { computed } from 'vue';
import type { QuestionSnapshot } from '../domain/types';
import CheckList from './CheckList.vue';

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
    .map((o) => ({
      id: o.id,
      label: labelOf(o.id),
      reason: props.question.explanation.optionReasons[o.id],
      check: props.question.explanation.optionChecks?.[o.id],
    })),
);
const isQ1 = computed(() => props.question.kind === 'chart-to-type');
const target = computed(() => props.question.targetLabel);
const selectedCheck = computed(() => props.question.explanation.optionChecks?.[props.selectedOptionId]);
/** Q1：錯誤選項的類型名稱；Q2：要找的類型名稱 */
const checkTarget = (optionId: string) =>
  isQ1.value ? props.question.explanation.optionChecks?.[optionId]?.typeLabel ?? labelOf(optionId) : target.value;
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
      <h3 v-if="isQ1">你選的「{{ labelOf(selectedOptionId) }}」哪裡不符</h3>
      <h3 v-else>你選的{{ labelOf(selectedOptionId) }}為什麼不是「{{ target }}」</h3>
      <p v-if="!isQ1 && selectedCheck" class="small muted">（這張其實是「{{ selectedCheck.typeLabel }}」的圖）</p>
      <CheckList v-if="selectedCheck" :check="selectedCheck" :target-label="checkTarget(selectedOptionId)" />
      <p v-else>{{ question.explanation.optionReasons[selectedOptionId] }}</p>
    </div>
    <details v-if="others.length">
      <summary>看其他選項為什麼不對</summary>
      <div v-for="o in others" :key="o.id" class="other">
        <h4>{{ isQ1 ? `「${o.label}」` : `${o.label}（其實是「${o.check?.typeLabel ?? ''}」）` }}</h4>
        <CheckList v-if="o.check" :check="o.check" :target-label="checkTarget(o.id)" />
        <p v-else>{{ o.reason }}</p>
      </div>
    </details>
  </section>
</template>

<style scoped>
.why-wrong { background: var(--bad-bg); border-radius: var(--radius-s); padding: 10px 12px; margin-bottom: 8px; }
.why-wrong h3 { font-size: 0.98rem; color: var(--bad); margin-bottom: 4px; }
.why-wrong p { margin: 0; }
.other { margin: 8px 0 14px; }
.other h4 { margin: 0 0 2px; font-size: 0.98rem; }
</style>
