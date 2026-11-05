<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { randomSeed } from '../domain/rng';
import type { Difficulty, KindSetting, PracticeSettings, Session } from '../domain/types';
import { useAppStore } from '../stores/app';
import { useSessionStore } from '../stores/session';

const app = useAppStore();
const store = useSessionStore();
const router = useRouter();
const route = useRoute();

const LAST_KEY = 'ccq-last-setup';
function loadLast(): Partial<PracticeSettings> {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}');
  } catch {
    return {};
  }
}

const last = loadLast();
const form = reactive({
  kind: (last.kind ?? 'mixed') as KindSetting,
  typeIds: [] as string[],
  difficulty: (last.difficulty ?? 'beginner') as Difficulty,
  count: last.count ?? 10,
});
const exclude = ref<string[]>([]);

const qType = route.query.type;
if (typeof qType === 'string') form.typeIds = [qType];
const qEx = route.query.exclude;
if (typeof qEx === 'string') exclude.value = [qEx];

const groups = computed(() => {
  const idx = app.index;
  if (!idx) return [];
  return app.pkg!.taxonomy.groups
    .map((g) => ({ ...g, types: idx.types.filter((t) => t.groupId === g.id) }))
    .filter((g) => g.types.length);
});

const settings = computed<PracticeSettings>(() => ({
  kind: form.kind,
  typeIds: form.typeIds,
  difficulty: form.difficulty,
  count: form.count,
  ...(exclude.value.length ? { excludeDatasetIds: exclude.value } : {}),
}));

const seed = ref(randomSeed());
const preview = computed(() => store.preview(settings.value, seed.value));
watch(settings, () => (seed.value = randomSeed()), { deep: true });

const active = ref<Session | null>(null);
const confirmDialog = ref<HTMLDialogElement | null>(null);
const error = ref<string | null>(null);
onMounted(async () => {
  active.value = (await store.activeSession()) ?? null;
});

function toggleType(id: string) {
  const i = form.typeIds.indexOf(id);
  if (i >= 0) form.typeIds.splice(i, 1);
  else form.typeIds.push(id);
}

async function begin(confirmed = false) {
  error.value = null;
  if (active.value && !confirmed) {
    confirmDialog.value?.showModal();
    return;
  }
  confirmDialog.value?.close();
  const p = preview.value;
  if (!p.questions.length) return;
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ kind: form.kind, difficulty: form.difficulty, count: form.count }));
  } catch {
    /* 偏好記憶失敗不影響練習 */
  }
  try {
    if (active.value) await store.abandonActive();
    const id = await store.start({ ...settings.value, count: p.questions.length }, p.seed, p.questions);
    await router.push(`/practice/${id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '儲存失敗，請重試';
  }
}

const kindOptions: { value: KindSetting; label: string }[] = [
  { value: 'mixed', label: '全部混合' },
  { value: 'chart-to-type', label: '看圖選氣候' },
  { value: 'type-to-chart', label: '看氣候選圖' },
  { value: 'chart-to-location', label: '看圖找地點' },
  { value: 'cause', label: '成因題（延伸）' },
];
const diffOptions: { value: Difficulty; label: string; note: string }[] = [
  { value: 'beginner', label: '入門', note: '典型圖、顯示年均溫與年降水量，選項差異較大' },
  { value: 'standard', label: '一般', note: '加入變化圖，選項較相似' },
  { value: 'advanced', label: '進階', note: '隱藏年度摘要，加入南半球與相似類型比較' },
];
</script>

<template>
  <h1>練習設定</h1>
  <form class="sheet" @submit.prevent="begin()">
    <fieldset>
      <legend>題型</legend>
      <div class="choice-row">
        <label v-for="o in kindOptions" :key="o.value" class="chip">
          <input v-model="form.kind" type="radio" name="kind" :value="o.value" />{{ o.label }}
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>難度</legend>
      <div class="choice-row">
        <label v-for="o in diffOptions" :key="o.value" class="chip">
          <input v-model="form.difficulty" type="radio" name="difficulty" :value="o.value" />{{ o.label }}
        </label>
      </div>
      <p class="small muted" style="margin: 6px 0 0">{{ diffOptions.find((d) => d.value === form.difficulty)?.note }}</p>
    </fieldset>

    <fieldset>
      <legend>題數</legend>
      <div class="choice-row">
        <label v-for="n in [5, 10, 20]" :key="n" class="chip">
          <input v-model.number="form.count" type="radio" name="count" :value="n" />{{ n }} 題
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>要練習的氣候（不選＝全部）</legend>
      <p class="small muted" style="margin-top: -4px">這裡只限定「正確答案」的範圍；錯誤選項仍會從其他氣候類型抽出。</p>
      <div v-for="g in groups" :key="g.id" class="group">
        <div class="group-label small muted">{{ g.label }}</div>
        <div class="choice-row">
          <label v-for="t in g.types" :key="t.id" class="chip">
            <input type="checkbox" :checked="form.typeIds.includes(t.id)" @change="toggleType(t.id)" />
            <span class="tick" aria-hidden="true">{{ form.typeIds.includes(t.id) ? '✓' : '' }}</span>{{ t.label }}
          </label>
        </div>
      </div>
      <div class="btn-row" style="margin-top: 8px">
        <button v-if="form.typeIds.length" type="button" class="btn quiet" @click="form.typeIds = []">清除選擇（改為全部）</button>
      </div>
      <p v-if="exclude.length" class="small muted">已排除你錯過的那張圖，只出同類的其他圖。<button type="button" class="btn quiet" @click="exclude = []">取消排除</button></p>
    </fieldset>

    <div class="summary" aria-live="polite">
      <template v-if="preview.available === 0">
        <p class="status-strip error">目前設定沒有可用的題目。請改選其他氣候、難度或題型。</p>
      </template>
      <template v-else-if="preview.available < form.count">
        <p class="status-strip info">
          目前設定只有 {{ preview.available }} 題可用（你選了 {{ form.count }} 題），不會重複湊題。
          可以用 {{ preview.available }} 題開始，或調整上面的設定。
        </p>
      </template>
      <p v-for="n in preview.notices.filter((x) => !x.startsWith('目前設定只能'))" :key="n" class="small muted">{{ n }}</p>
    </div>
    <p v-if="error" class="status-strip error" role="alert">{{ error }}</p>

    <button class="btn primary block" type="submit" :disabled="preview.available === 0">
      {{ preview.available < form.count && preview.available > 0 ? `用 ${preview.available} 題開始` : `開始 ${form.count} 題練習` }}
    </button>
  </form>

  <dialog ref="confirmDialog" aria-labelledby="confirm-title">
    <h2 id="confirm-title">放棄目前的練習？</h2>
    <p>你還有一回合沒做完（已答 {{ active ? Object.values(active.progress).filter((p) => p.submitted).length : 0 }}／{{ active?.questions.length }} 題）。開始新練習後，舊回合不會再列入成績。</p>
    <div class="btn-row">
      <button class="btn danger" type="button" @click="begin(true)">放棄並開始新練習</button>
      <button class="btn" type="button" @click="router.push(`/practice/${active?.id}`)">回到未完成的練習</button>
      <button class="btn quiet" type="button" @click="confirmDialog?.close()">取消</button>
    </div>
  </dialog>
</template>

<style scoped>
.group { margin-bottom: 10px; }
.group-label { margin-bottom: 4px; }
.summary { margin-bottom: 12px; }
</style>
