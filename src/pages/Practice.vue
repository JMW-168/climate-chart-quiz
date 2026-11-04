<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import ChartChoiceGrid from '../components/ChartChoiceGrid.vue';
import ClimateChart from '../components/ClimateChart.vue';
import ClimateSummary from '../components/ClimateSummary.vue';
import ExplanationPanel from '../components/ExplanationPanel.vue';
import QuestionOptions from '../components/QuestionOptions.vue';
import { useSessionStore } from '../stores/session';

const route = useRoute();
const router = useRouter();
const store = useSessionStore();
const loading = ref(true);
const missing = ref(false);
const endDialog = ref<HTMLDialogElement | null>(null);
const heading = ref<HTMLElement | null>(null);

async function load() {
  loading.value = true;
  const id = String(route.params.sessionId);
  missing.value = !(await store.load(id));
  loading.value = false;
  const s = store.session;
  if (s && (s.status === 'completed' || s.status === 'ended')) await router.replace(`/results/${s.id}`);
}
watch(() => route.params.sessionId, load, { immediate: true });

const s = computed(() => store.session);
const q = computed(() => store.current);
const p = computed(() => store.progress);
const attempt = computed(() => store.currentAttempt);
const submitted = computed(() => !!p.value?.submitted);
const isLast = computed(() => !!s.value && s.value.currentIndex === s.value.questions.length - 1);
const answeredCount = computed(() => (s.value ? Object.values(s.value.progress).filter((x) => x.submitted).length : 0));

async function onSubmit() {
  await store.submit();
  await nextTick();
  document.getElementById('exp-title')?.closest('section')?.scrollIntoView({ block: 'nearest' });
}

async function onNext() {
  const ok = await store.next();
  if (!ok || !store.session) return;
  if (store.session.status === 'completed') await router.push(`/results/${store.session.id}`);
  else {
    window.scrollTo({ top: 0 });
    await nextTick();
    heading.value?.focus();
  }
}

async function onEnd() {
  endDialog.value?.close();
  const ok = await store.end();
  if (ok && store.session) await router.push(`/results/${store.session.id}`);
}

// 返回不清除資料：回合留在「進行中」，首頁可繼續
onBeforeRouteLeave(() => {
  endDialog.value?.close();
});

const highlights = computed(() => (submitted.value && q.value ? q.value.explanation.highlightMonths : null));
</script>

<template>
  <div v-if="loading" class="sheet empty" aria-busy="true">正在載入練習…</div>
  <div v-else-if="missing || !s" class="sheet empty">
    <h2>找不到這個練習回合</h2>
    <p class="muted">紀錄可能已被清除，或是在另一個瀏覽器建立的。</p>
    <RouterLink class="btn primary" to="/practice/setup">開始新練習</RouterLink>
  </div>
  <div v-else-if="s.status === 'abandoned'" class="sheet empty">
    <h2>這個回合已經放棄</h2>
    <RouterLink class="btn primary" to="/practice/setup">開始新練習</RouterLink>
  </div>

  <template v-else-if="q && p">
    <div class="q-head">
      <span class="small muted">
        {{ s.mode === 'review' ? '錯題複習' : '練習' }}｜第 {{ s.currentIndex + 1 }} 題，共 {{ s.questions.length }} 題
      </span>
      <button class="btn quiet small" type="button" @click="endDialog?.showModal()">結束練習</button>
    </div>
    <div
      class="progress-bar"
      role="progressbar"
      :aria-valuenow="answeredCount"
      aria-valuemin="0"
      :aria-valuemax="s.questions.length"
      :aria-label="`已答 ${answeredCount} 題`"
    >
      <span :style="{ width: `${(answeredCount / s.questions.length) * 100}%` }"></span>
    </div>

    <section class="sheet">
      <h1 ref="heading" tabindex="-1" class="q-title">
        <template v-if="q.kind === 'chart-to-type'">這張氣候圖是哪一種氣候？</template>
        <template v-else>哪一張是「{{ q.targetLabel }}」的氣候圖？</template>
      </h1>

      <template v-if="q.kind === 'chart-to-type'">
        <ClimateChart
          :key="q.id"
          :temperature-c="q.chart.temperatureC"
          :precipitation-mm="q.chart.precipitationMm"
          :scale="q.scale"
          :label="`第 ${s.currentIndex + 1} 題`"
          :highlights="highlights"
        />
        <ClimateSummary v-if="q.showSummary" :temperature-c="q.chart.temperatureC" :precipitation-mm="q.chart.precipitationMm" />
        <div style="margin-top: 16px">
          <QuestionOptions
            :name="`q-${q.id}`"
            :options="q.options"
            :selected="p.selectedOptionId"
            :submitted="submitted"
            :correct-option-id="q.correctOptionId"
            @select="store.select"
          />
        </div>
      </template>
      <template v-else>
        <ChartChoiceGrid
          :key="q.id"
          :question="q"
          :selected="p.selectedOptionId"
          :submitted="submitted"
          :show-highlights="submitted"
          @select="store.select"
        />
      </template>

      <!-- 提示 -->
      <div v-if="!submitted || p.hintsShown" class="hints">
        <ol v-if="p.hintsShown" class="hint-list" aria-live="polite">
          <li v-for="h in q.explanation.hints.slice(0, p.hintsShown)" :key="h">{{ h }}</li>
        </ol>
        <p v-if="p.hintsShown" class="small muted">已使用 {{ p.hintsShown }} 層提示（照常計分，結果會另外標示）</p>
      </div>

      <p v-if="store.error" class="status-strip error" role="alert">{{ store.error }}</p>

      <div class="btn-row actions">
        <template v-if="!submitted">
          <button class="btn primary" type="button" :disabled="!p.selectedOptionId || store.busy" @click="onSubmit">
            {{ store.busy ? '儲存中…' : '提交答案' }}
          </button>
          <button class="btn" type="button" :disabled="p.hintsShown >= 3" @click="store.hint()">
            {{ p.hintsShown >= 3 ? '提示已用完' : p.hintsShown ? `下一層提示（剩 ${3 - p.hintsShown}）` : '看提示' }}
          </button>
          <span v-if="!p.selectedOptionId" class="small muted">先選一個答案再提交</span>
        </template>
        <button v-else class="btn primary" type="button" @click="onNext">
          {{ isLast ? '完成並查看結果' : '下一題' }}
        </button>
      </div>
    </section>

    <ExplanationPanel v-if="submitted && attempt" :question="q" :selected-option-id="attempt.selectedOptionId" :correct="attempt.correct" />
    <div v-if="submitted" class="btn-row">
      <button class="btn primary" type="button" @click="onNext">{{ isLast ? '完成並查看結果' : '下一題' }}</button>
    </div>

    <dialog ref="endDialog" aria-labelledby="end-title">
      <h2 id="end-title">現在結束這一回合？</h2>
      <p>已答 {{ answeredCount }}／{{ s.questions.length }} 題。提前結束只會顯示已答題數，不會產生完整成績。</p>
      <p class="small muted">如果只是要暫停，直接離開即可，之後可從首頁繼續。</p>
      <div class="btn-row">
        <button class="btn danger" type="button" @click="onEnd">結束並查看已答題目</button>
        <button class="btn" type="button" @click="endDialog?.close()">繼續作答</button>
      </div>
    </dialog>
  </template>
</template>

<style scoped>
.q-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.q-title { font-size: 1.25rem; outline: none; }
.hints { margin-top: 12px; }
.actions { margin-top: 16px; }
</style>
