<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/app';

const app = useAppStore();
const pkg = computed(() => app.pkg!);
const typeLabel = (id: string) => pkg.value.taxonomy.types.find((t) => t.id === id)?.label ?? id;
const framework = computed(() => pkg.value.taxonomy.frameworks.find((f) => f.id === pkg.value.frameworkId));
const coverageLabel: Record<string, string> = { 'question-ready': '可命題', 'teaching-only': '僅教學比較', pending: '待核對' };
const statusLabel: Record<string, string> = { draft: '草稿', reviewed: '已審核', published: '已發布', retired: '已停用' };
const counts = computed(() => {
  const m = new Map<string, number>();
  for (const d of pkg.value.datasets) m.set(d.typeId, (m.get(d.typeId) ?? 0) + 1);
  return m;
});
</script>

<template>
  <h1>題庫資料說明</h1>
  <p class="small">資料出處、授權與非營利聲明請見<RouterLink to="/sources">資料來源與授權</RouterLink>。</p>
  <section class="sheet">
    <dl class="stat-row">
      <div><dt>題庫版本</dt><dd>{{ pkg.contentVersion }}</dd></div>
      <div><dt>模式</dt><dd>{{ pkg.mode === 'demo' ? '開發示範' : '正式' }}</dd></div>
      <div><dt>資料組數</dt><dd>{{ pkg.datasets.length }}</dd></div>
    </dl>
    <p class="small" style="margin-top: 12px">{{ framework?.label }}：{{ framework?.description }}</p>
    <p class="small muted">{{ pkg.curriculum.note }}</p>
  </section>

  <section class="sheet">
    <h2>教材對照矩陣</h2>
    <div style="overflow-x: auto">
      <table class="data">
        <thead><tr><th scope="col">氣候類型</th><th scope="col">資料</th><th scope="col">狀態</th></tr></thead>
        <tbody>
          <tr v-for="e in pkg.curriculum.entries" :key="e.typeId">
            <th scope="row">{{ typeLabel(e.typeId) }}<div class="small muted reason">{{ e.reason }}</div></th>
            <td>{{ counts.get(e.typeId) ?? 0 }} 組</td>
            <td>{{ coverageLabel[e.coverage] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="sheet">
    <h2>資料來源</h2>
    <p class="small muted">為避免從城市或測站名稱猜答案，題目畫面不顯示來源；以下供查核。</p>
    <details>
      <summary>展開全部 {{ pkg.datasets.length }} 組</summary>
      <div style="overflow-x: auto">
        <table class="data">
          <thead><tr><th scope="col">資料ID</th><th scope="col">類型</th><th scope="col">來源／授權</th><th scope="col">審核</th></tr></thead>
          <tbody>
            <tr v-for="d in pkg.datasets" :key="d.id">
              <th scope="row" class="small">{{ d.id }}</th>
              <td class="small">{{ typeLabel(d.typeId) }}</td>
              <td class="small">{{ d.source.title }}／{{ d.source.license }}</td>
              <td class="small">{{ statusLabel[d.status] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </section>
</template>

<style scoped>
.reason { font-weight: 400; max-width: 34em; }
table.data th[scope='row'] { text-align: left; }
</style>
