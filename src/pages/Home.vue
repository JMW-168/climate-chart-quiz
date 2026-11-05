<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ClimateChart from '../components/ClimateChart.vue';
import { DEFAULT_SCALE } from '../domain/stats';
import type { MistakeRecord, Session } from '../domain/types';
import { getRepo, useAppStore } from '../stores/app';

const app = useAppStore();
const router = useRouter();
const active = ref<Session | null>(null);
const mistakes = ref<MistakeRecord[]>([]);
const completed = ref(0);

onMounted(async () => {
  const repo = await getRepo();
  active.value = (await repo.getActiveSession()) ?? null;
  mistakes.value = await repo.listMistakes();
  completed.value = (await repo.listSessions()).filter((s) => s.status === 'completed').length;
});

const pending = computed(() => mistakes.value.filter((m) => m.pending).length);
const answered = computed(() => (active.value ? Object.values(active.value.progress).filter((p) => p.submitted).length : 0));

// 首頁示意圖：與讀圖說明相同（奈及利亞阿布加，WMO 1991–2020 平均值）
const sample = {
  t: [26.9, 29.3, 30.7, 30, 28.1, 26.6, 25.7, 25.2, 25.7, 26.5, 26.9, 26.3],
  p: [0.8, 5.9, 22.4, 72.8, 156.7, 194.4, 249.8, 308.3, 229.4, 169.5, 9.7, 1.3],
};
</script>

<template>
  <section class="hero sheet">
    <div class="hero-text">
      <h1>看一張氣候圖，說出它是哪種氣候</h1>
      <p class="muted">紅線是每月均溫，藍色長條是每月降水量。從年溫差、最冷月和雨季出現的月份，就能找出答案和理由。</p>
      <div class="btn-row">
        <button v-if="active" class="btn primary" type="button" @click="router.push(`/practice/${active.id}`)">
          繼續未完成的練習（{{ answered }}／{{ active.questions.length }}）
        </button>
        <RouterLink :class="['btn', active ? '' : 'primary']" to="/practice/setup">開始新練習</RouterLink>
      </div>
    </div>
    <div class="hero-chart">
      <ClimateChart :temperature-c="sample.t" :precipitation-mm="sample.p" :scale="DEFAULT_SCALE" label="示意氣候圖" :show-table="false" />
    </div>
  </section>

  <section class="tiles">
    <RouterLink class="tile sheet" to="/learn">
      <h2>讀圖說明</h2>
      <p class="muted small">月份、左右兩條軸、單位，以及怎麼看年溫差和雨季。</p>
    </RouterLink>
    <RouterLink class="tile sheet" to="/mistakes">
      <h2>錯題複習</h2>
      <p class="muted small">
        {{ pending ? `有 ${pending} 題待複習。` : '目前沒有待複習的題目。' }}
      </p>
    </RouterLink>
  </section>

  <section class="sheet small">
    <dl class="stat-row">
      <div><dt>已完成回合</dt><dd>{{ completed }}</dd></div>
      <div><dt>題庫版本</dt><dd>{{ app.content?.contentVersion }}</dd></div>
      <div>
        <dt>離線練習</dt>
        <dd>{{ app.offlineReady ? '✓ 已可離線練習' : app.content ? '準備中（題庫已下載）' : '尚未就緒' }}</dd>
      </div>
    </dl>
    <p class="muted small" style="margin: 10px 0 0">紀錄只保存在這個瀏覽器，不需要登入。</p>
  </section>
</template>

<style scoped>
.hero { display: grid; gap: 18px; grid-template-columns: 1fr; }
.hero h1 { font-size: 1.75rem; }
.hero-chart { min-width: 0; }
@media (min-width: 680px) {
  .hero { grid-template-columns: 1fr 1.05fr; align-items: center; }
}
.tiles { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; }
.tile { text-decoration: none; color: inherit; margin: 0; display: block; }
.tile:hover { border-color: var(--navy); }
.tile h2 { font-size: 1.1rem; color: var(--navy); }
.tile p { margin: 0; }
.tiles { margin-bottom: 16px; }
@media (max-width: 420px) {
  .tiles { grid-template-columns: 1fr; }
}
</style>
