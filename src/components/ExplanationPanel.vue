<script setup lang="ts">
// 答後解析（規格 §7）：內容全部來自題目快照中的審核文字，不即時推論。
import { computed } from 'vue';
import type { QuestionSnapshot } from '../domain/types';
import CheckList from './CheckList.vue';
import LocatorMap from './LocatorMap.vue';
import StationInfo from './StationInfo.vue';

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
/** 作答後顯示的測站位置；舊回合快照沒有位置時為空 */
const places = computed(() => {
  const q = props.question;
  if (q.kind === 'chart-to-type') {
    return q.chart.location ? [{ key: 'chart', prefix: '', loc: q.chart.location, letter: '', correct: true }] : [];
  }
  return q.options
    .filter((o) => o.chart.location)
    .map((o) => ({ key: o.id, prefix: `圖 ${o.letter}：`, loc: o.chart.location!, letter: o.letter, correct: o.id === q.correctOptionId }));
});
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
    <div v-if="places.length" class="where">
      <h3>這{{ isQ1 ? '張' : '幾張' }}圖在哪裡</h3>
      <ul>
        <li v-for="p in places" :key="p.key" :class="{ correct: p.correct && !isQ1 }">
          <StationInfo :location="p.loc" :prefix="p.prefix" />
          <span v-if="!isQ1 && p.correct" class="tag">正確答案</span>
        </li>
      </ul>
      <LocatorMap
        :title="`測站位置：${places.map((p) => p.loc.nameZh).join('、')}`"
        :points="places.map((p) => ({ lat: p.loc.lat, lon: p.loc.lon, label: p.letter || undefined, highlight: !isQ1 && p.correct }))"
      />
    </div>
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
.where { margin: 0 0 14px; }
.where h3 { font-size: 0.98rem; margin-bottom: 4px; }
.where ul { list-style: none; margin: 0 0 8px; padding: 0; display: grid; gap: 4px; }
.where li { font-size: 0.95rem; }
.where li.correct strong { color: var(--ok); }
.where .tag { margin-left: 6px; font-size: 0.8rem; font-weight: 700; color: var(--ok); }
.other h4 { margin: 0 0 2px; font-size: 0.98rem; }
</style>
