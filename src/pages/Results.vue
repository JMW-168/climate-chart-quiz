<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ClimateChart from '../components/ClimateChart.vue';
import ExplanationPanel from '../components/ExplanationPanel.vue';
import { summarizeSession } from '../domain/scoring';
import type { Attempt, Session } from '../domain/types';
import { getRepo } from '../stores/app';

const route = useRoute();
const session = ref<Session | null>(null);
const attempts = ref<Attempt[]>([]);
const loaded = ref(false);

watch(
  () => route.params.sessionId,
  async (id) => {
    const repo = await getRepo();
    session.value = (await repo.getSession(String(id))) ?? null;
    attempts.value = session.value ? await repo.listAttempts(session.value.id) : [];
    loaded.value = true;
  },
  { immediate: true },
);

const result = computed(() => (session.value ? summarizeSession(session.value, attempts.value) : null));
const rows = computed(() =>
  (session.value?.questions ?? []).map((q, i) => ({ q, i, a: attempts.value.find((x) => x.questionId === q.id) })),
);
const open = ref<string | null>(null);
</script>

<template>
  <div v-if="!loaded" class="sheet empty" aria-busy="true">載入中…</div>
  <div v-else-if="!session || !result" class="sheet empty">
    <h2>找不到這個回合的結果</h2>
    <RouterLink class="btn primary" to="/practice/setup">開始新練習</RouterLink>
  </div>
  <template v-else>
    <h1>{{ session.mode === 'review' ? '錯題複習結果' : '練習結果' }}</h1>

    <section class="sheet">
      <template v-if="result.complete">
        <p class="score"><strong>{{ result.correct }}</strong> / {{ result.total }} 題答對（第一次作答）</p>
        <dl class="stat-row">
          <div><dt>正確率</dt><dd>{{ result.accuracy }}%</dd></div>
          <div><dt>沒用提示就答對</dt><dd>{{ result.correctWithoutHint }} 題</dd></div>
          <div><dt>有使用提示</dt><dd>{{ result.hintedQuestions }} 題</dd></div>
        </dl>
        <p v-if="result.hintedQuestions" class="small muted" style="margin: 10px 0 0">使用提示後答對仍會計分，但「沒用提示就答對」的題數才是自己獨立判讀的成果。</p>
      </template>
      <template v-else>
        <p class="score">已答 <strong>{{ result.answered }}</strong> / {{ result.total }} 題</p>
        <p class="muted small" style="margin: 0">這一回合提前結束，不計算完整成績。已答題目中答對 {{ result.correct }} 題。</p>
      </template>
    </section>

    <section class="sheet">
      <h2>各氣候類型表現</h2>
      <table class="data">
        <thead><tr><th scope="col">氣候類型</th><th scope="col">答對／題數</th></tr></thead>
        <tbody>
          <tr v-for="t in result.byType" :key="t.typeId">
            <th scope="row">{{ t.label }}</th>
            <td>{{ t.correct }}／{{ t.total }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="sheet">
      <h2>逐題回顧</h2>
      <ol class="review-list">
        <li v-for="r in rows" :key="r.q.id">
          <button class="row-btn" type="button" :aria-expanded="open === r.q.id" @click="open = open === r.q.id ? null : r.q.id">
            <span class="badge" :class="r.a ? (r.a.correct ? 'ok' : 'bad') : 'none'">{{ r.a ? (r.a.correct ? '✓ 對' : '✗ 錯') : '未答' }}</span>
            <span class="grow">{{ r.q.kind === 'chart-to-type' ? '看圖選氣候' : '看氣候選圖' }}：{{ r.q.targetLabel }}</span>
            <span v-if="r.a?.hintCount" class="small muted">提示 {{ r.a.hintCount }}</span>
          </button>
          <div v-if="open === r.q.id && r.a" class="row-detail">
            <ClimateChart
              v-if="r.q.kind === 'chart-to-type'"
              :temperature-c="r.q.chart.temperatureC"
              :precipitation-mm="r.q.chart.precipitationMm"
              :scale="r.q.scale"
              :label="`第 ${r.i + 1} 題`"
              :highlights="r.q.explanation.highlightMonths"
            />
            <template v-else>
              <ClimateChart
                v-for="o in r.q.options.filter((x) => x.id === r.q.correctOptionId)"
                :key="o.id"
                :temperature-c="o.chart.temperatureC"
                :precipitation-mm="o.chart.precipitationMm"
                :scale="r.q.scale"
                :label="`第 ${r.i + 1} 題正確的圖`"
                :highlights="r.q.explanation.highlightMonths"
              />
            </template>
            <ExplanationPanel :question="r.q" :selected-option-id="r.a.selectedOptionId" :correct="r.a.correct" />
          </div>
        </li>
      </ol>
    </section>

    <div class="btn-row">
      <RouterLink class="btn primary" to="/practice/setup">再練一回</RouterLink>
      <RouterLink class="btn" to="/mistakes">看錯題</RouterLink>
      <RouterLink class="btn quiet" to="/">回首頁</RouterLink>
    </div>
  </template>
</template>

<style scoped>
.score { font-size: 1.2rem; margin-bottom: 6px; }
.score strong { font-size: 2.2rem; color: var(--navy); }
.review-list { list-style: none; padding: 0; margin: 0; }
.review-list li { border-bottom: 1px solid var(--grid); }
.row-btn {
  width: 100%; display: flex; gap: 10px; align-items: center; min-height: 48px;
  background: none; border: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; padding: 4px 2px;
}
.grow { flex: 1; }
.badge { flex: none; font-weight: 700; font-size: 0.85rem; padding: 2px 8px; border-radius: 4px; }
.badge.ok { background: var(--ok-bg); color: var(--ok); }
.badge.bad { background: var(--bad-bg); color: var(--bad); }
.badge.none { background: var(--grid); color: var(--ink-soft); }
.row-detail { padding: 6px 0 14px; }
.row-detail :deep(.sheet) { border: 0; padding: 12px 0 0; margin: 0; }
</style>
