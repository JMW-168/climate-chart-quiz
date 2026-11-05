<script setup lang="ts">
// 讀圖總複習（#3）：從題庫內容包讀取所有類型、代表圖、判讀條件與分辨方法。
import { computed, ref } from 'vue';
import ClimateChart from './ClimateChart.vue';
import { computeScale } from '../domain/stats';
import { isEligibleStatus } from '../domain/validation';
import { useAppStore } from '../stores/app';

const props = withDefaults(defineProps<{ standalone?: boolean }>(), { standalone: false });
const app = useAppStore();
const group = ref<string>('all');

const items = computed(() => {
  const pkg = app.pkg;
  if (!pkg) return [];
  const label = (id: string) => pkg.taxonomy.types.find((t) => t.id === id)?.label ?? id;
  return pkg.taxonomy.types
    .filter((t) => t.frameworkId === pkg.frameworkId && t.status !== 'retired')
    .map((t) => {
      const ds = pkg.datasets.filter((d) => d.typeId === t.id && isEligibleStatus(d.status, pkg.mode));
      const sample = ds.find((d) => d.difficulty.includes('beginner')) ?? ds[0];
      return {
        type: t,
        groupLabel: pkg.taxonomy.groups.find((g) => g.id === t.groupId)?.label ?? '',
        sample,
        scale: sample ? computeScale([sample]) : null,
        compare: Object.entries(t.compareNotes ?? {}).map(([id, note]) => ({ id, label: label(id), note })),
      };
    });
});

const groups = computed(() => {
  const pkg = app.pkg;
  if (!pkg) return [];
  return pkg.taxonomy.groups.filter((g) => items.value.some((i) => i.type.groupId === g.id));
});
const shown = computed(() => (group.value === 'all' ? items.value : items.value.filter((i) => i.type.groupId === group.value)));
</script>

<template>
  <section id="review" class="review" :class="{ standalone: props.standalone }" aria-labelledby="review-title">
    <h1 v-if="props.standalone" id="review-title">總複習：所有氣候類型</h1>
    <h2 v-else id="review-title">總複習：所有氣候類型</h2>
    <p class="small muted">每種氣候附一張代表圖，以及判讀時要看的氣溫條件和降水條件。</p>

    <div class="choice-row filter" role="radiogroup" aria-label="依分組篩選">
      <label class="chip">
        <input v-model="group" type="radio" name="review-group" value="all" />全部
      </label>
      <label v-for="g in groups" :key="g.id" class="chip">
        <input v-model="group" type="radio" name="review-group" :value="g.id" />{{ g.label }}
      </label>
    </div>

    <div class="review-grid">
      <article v-for="i in shown" :key="i.type.id" class="sheet review-card" :data-type="i.type.id">
        <header>
          <h3 :id="`review-${i.type.id}`">{{ i.type.label }}</h3>
          <span class="small muted">{{ i.groupLabel }}</span>
        </header>

        <template v-if="i.type.graphIdentifiable && i.sample && i.scale && i.type.criteria">
          <ClimateChart
            :temperature-c="i.sample.temperatureC"
            :precipitation-mm="i.sample.precipitationMm"
            :scale="i.scale"
            :label="`${i.type.label}代表圖`"
            :show-table="false"
          />
          <dl class="evidence">
            <div class="t"><dt>氣溫特徵</dt><dd>{{ i.type.criteria.temperature.text }}</dd></div>
            <div class="p"><dt>降水特徵</dt><dd>{{ i.type.criteria.precipitation.text }}</dd></div>
          </dl>
          <div v-if="i.compare.length" class="compare">
            <h4>容易混淆</h4>
            <ul>
              <li v-for="c in i.compare" :key="c.id"><strong>{{ c.label }}</strong>：{{ c.note }}</li>
            </ul>
          </div>
          <p v-if="i.sample.hemisphere === 'south'" class="small muted">代表圖是南半球資料，最熱月出現在 12～2 月前後。</p>
        </template>
        <template v-else>
          <p>{{ i.type.keyFeature }}。</p>
          <p class="status-strip info small">不單獨出題：{{ i.type.notIdentifiableReason }}</p>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.review { margin-top: 28px; scroll-margin-top: 64px; }
.review.standalone { margin-top: 0; }
.review h1 { margin-bottom: 0.3em; }
.review-card h3 { scroll-margin-top: 72px; }
.filter { margin: 10px 0 14px; }
.review-grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
@media (min-width: 720px) {
  .review-grid { grid-template-columns: 1fr 1fr; }
}
.review-card { margin: 0; min-width: 0; }
.review-card header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.review-card h3 { margin: 0; font-size: 1.1rem; color: var(--navy); }
.review-card .evidence { margin-top: 10px; }
.compare h4 { margin: 4px 0 2px; font-size: 0.95rem; }
.compare ul { margin: 0; padding-left: 1.2em; font-size: 0.92rem; }
.compare li { margin-bottom: 4px; }
</style>
