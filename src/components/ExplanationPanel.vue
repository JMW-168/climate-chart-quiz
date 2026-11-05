<script setup lang="ts">
// 答後解析（規格 §7）：內容全部來自題目快照中的審核文字，不即時推論。
import { computed } from 'vue';
import type { QuestionSnapshot, StationLocation } from '../domain/types';
import CheckList from './CheckList.vue';
import LocatorMap from './LocatorMap.vue';
import StationInfo from './StationInfo.vue';

const props = defineProps<{ question: QuestionSnapshot; selectedOptionId: string; correct: boolean }>();

const kind = computed(() => props.question.kind);
const target = computed(() => props.question.targetLabel);

function labelOf(id: string): string {
  const q = props.question;
  switch (q.kind) {
    case 'chart-to-type':
    case 'cause':
      return q.options.find((o) => o.id === id)?.label ?? '';
    case 'type-to-chart': {
      const o = q.options.find((x) => x.id === id);
      return o ? `圖 ${o.letter}` : '';
    }
    case 'chart-to-location': {
      const o = q.options.find((x) => x.id === id);
      return o ? `地點 ${o.letter}（${o.location.nameZh}）` : '';
    }
  }
}

const correctName = computed(() => {
  const q = props.question;
  if (q.kind === 'type-to-chart') return `${labelOf(q.correctOptionId)}（${q.explanation.correctLabel}）`;
  if (q.kind === 'chart-to-location') return `${q.explanation.correctLabel}，「${q.targetLabel}」`;
  return q.explanation.correctLabel;
});

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

/** 逐項判斷用哪個類型的條件來比較 */
function checkTarget(optionId: string): string {
  const c = props.question.explanation.optionChecks?.[optionId];
  if (kind.value === 'type-to-chart') return target.value;
  return c?.typeLabel ?? labelOf(optionId);
}
function otherTitle(o: { id: string; label: string; check?: { typeLabel: string } }): string {
  if (kind.value === 'type-to-chart') return `${o.label}（其實是「${o.check?.typeLabel ?? ''}」）`;
  if (kind.value === 'chart-to-location') return `${o.label}：那裡是「${o.check?.typeLabel ?? ''}」`;
  return `「${o.label}」`;
}
const selectedCheck = computed(() => props.question.explanation.optionChecks?.[props.selectedOptionId]);

/** 作答後顯示的測站位置；舊回合快照沒有位置時為空 */
const places = computed(() => {
  const q = props.question;
  if (q.kind === 'chart-to-type') {
    return q.chart.location ? [{ key: 'chart', prefix: '', loc: q.chart.location, letter: '', correct: true }] : [];
  }
  // 成因題的地點已在題目上；看圖找地點的四個地點已在選項與地圖上標出城市
  if (q.kind === 'cause' || q.kind === 'chart-to-location') return [];
  return q.options
    .filter((o) => o.chart.location)
    .map((o) => ({ key: o.id, prefix: `圖 ${o.letter}：`, loc: o.chart.location!, letter: o.letter, correct: o.id === q.correctOptionId }));
});
const single = computed(() => places.value.length <= 1);

/** 成因說明對應的地點（正確答案那張圖的位置） */
const causeLocation = computed<StationLocation | undefined>(() => {
  const q = props.question;
  if (q.kind === 'type-to-chart') return q.options.find((o) => o.id === q.correctOptionId)?.chart.location;
  return q.chart.location;
});
const cause = computed(() => props.question.explanation.cause);
/** 和風帶季移有關的成因，附上學習頁連結 */
const beltRelated = computed(() => /副熱帶高壓|季風|南移|北移|赤道低壓/.test(cause.value?.text ?? ''));
</script>

<template>
  <section class="sheet explanation" aria-labelledby="exp-title">
    <div class="result-banner" :class="correct ? 'ok' : 'bad'" role="status" aria-live="assertive">
      <span aria-hidden="true">{{ correct ? '✓' : '✗' }}</span>
      <span>{{ correct ? '答對了' : '答錯了' }}：正確答案是 {{ correctName }}</span>
    </div>
    <h2 id="exp-title" class="visually-hidden">答案解析</h2>

    <div v-if="kind === 'cause' && cause" class="cause main">
      <h3>主要原因</h3>
      <p>{{ cause.text }}</p>
      <p class="small muted">成因為延伸內容，待依課本核對。</p>
      <RouterLink v-if="beltRelated" class="btn small" to="/causes">看「風帶季移」說明</RouterLink>
    </div>

    <div v-if="places.length" class="where">
      <h3>{{ single ? '這張圖在哪裡' : '這幾張圖在哪裡' }}</h3>
      <ul>
        <li v-for="p in places" :key="p.key" :class="{ correct: p.correct && !single }">
          <StationInfo :location="p.loc" :prefix="p.prefix" />
          <span v-if="!single && p.correct" class="tag">正確答案</span>
        </li>
      </ul>
      <LocatorMap
        :title="`測站位置：${places.map((p) => p.loc.nameZh).join('、')}`"
        :points="places.map((p) => ({ lat: p.loc.lat, lon: p.loc.lon, label: p.letter || undefined, highlight: !single && p.correct }))"
      />
    </div>

    <dl class="evidence">
      <div class="t"><dt>氣溫證據</dt><dd>{{ question.explanation.temperatureEvidence }}</dd></div>
      <div class="p"><dt>降水證據</dt><dd>{{ question.explanation.precipitationEvidence }}</dd></div>
      <div class="c"><dt>綜合判斷</dt><dd>{{ question.explanation.conclusion }}</dd></div>
    </dl>

    <div v-if="!correct" class="why-wrong">
      <h3 v-if="kind === 'chart-to-type'">你選的「{{ labelOf(selectedOptionId) }}」哪裡不符</h3>
      <h3 v-else-if="kind === 'type-to-chart'">你選的{{ labelOf(selectedOptionId) }}為什麼不是「{{ target }}」</h3>
      <h3 v-else-if="kind === 'chart-to-location'">你選的{{ labelOf(selectedOptionId) }}為什麼不對</h3>
      <h3 v-else>你選的「{{ labelOf(selectedOptionId) }}」為什麼不是主因</h3>
      <p v-if="kind === 'type-to-chart' && selectedCheck" class="small muted">（這張其實是「{{ selectedCheck.typeLabel }}」的圖）</p>
      <p v-if="kind === 'chart-to-location' && selectedCheck" class="small muted">（那裡是「{{ selectedCheck.typeLabel }}」，這張圖不符合它的條件）</p>
      <CheckList v-if="selectedCheck" :check="selectedCheck" :target-label="checkTarget(selectedOptionId)" />
      <p v-else>{{ question.explanation.optionReasons[selectedOptionId] }}</p>
    </div>

    <details v-if="others.length">
      <summary>看其他選項為什麼不對</summary>
      <div v-for="o in others" :key="o.id" class="other">
        <h4>{{ otherTitle(o) }}</h4>
        <CheckList v-if="o.check" :check="o.check" :target-label="checkTarget(o.id)" />
        <p v-else>{{ o.reason }}</p>
      </div>
    </details>

    <div v-if="cause && kind !== 'cause'" class="cause">
      <h3>為什麼會這樣？<span class="small muted">（延伸，不計分）</span></h3>
      <p>{{ cause.text }}</p>
      <LocatorMap
        v-if="causeLocation"
        :points="[{ lat: causeLocation.lat, lon: causeLocation.lon }]"
        :overlays="cause.overlays"
        :title="`${causeLocation.nameZh}與相關的風帶、氣壓帶或洋流`"
      />
      <p class="small muted" style="margin-top: 6px">成因為延伸內容，待依課本核對。</p>
      <RouterLink v-if="beltRelated" class="btn small" to="/causes">看「風帶季移」說明</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.why-wrong { background: var(--bad-bg); border-radius: var(--radius-s); padding: 10px 12px; margin-bottom: 8px; }
.why-wrong h3 { font-size: 0.98rem; color: var(--bad); margin-bottom: 4px; }
.why-wrong p { margin: 0; }
.other { margin: 8px 0 14px; }
.where { margin: 0 0 14px; }
.where h3, .cause h3 { font-size: 0.98rem; margin-bottom: 4px; }
.where ul { list-style: none; margin: 0 0 8px; padding: 0; display: grid; gap: 4px; }
.where li { font-size: 0.95rem; }
.where li.correct strong { color: var(--ok); }
.where .tag { margin-left: 6px; font-size: 0.8rem; font-weight: 700; color: var(--ok); }
.other h4 { margin: 0 0 2px; font-size: 0.98rem; }
.cause { margin-top: 16px; border-top: 1px dashed var(--rule); padding-top: 12px; }
.cause.main { margin: 0 0 14px; border-top: 0; padding: 10px 12px; background: var(--ok-bg); border-radius: var(--radius-s); }
.cause p { margin: 0 0 8px; }
</style>
