<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { MistakeRecord, Session } from '../domain/types';
import { getRepo } from '../stores/app';
import { useSessionStore } from '../stores/session';

const router = useRouter();
const store = useSessionStore();
const list = ref<MistakeRecord[]>([]);
const active = ref<Session | null>(null);
const error = ref<string | null>(null);
const dialog = ref<HTMLDialogElement | null>(null);

onMounted(async () => {
  const repo = await getRepo();
  list.value = await repo.listMistakes();
  active.value = (await repo.getActiveSession()) ?? null;
});

const pending = computed(() => list.value.filter((m) => m.pending));
const cleared = computed(() => list.value.filter((m) => !m.pending));
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });

async function startReview(confirmed = false) {
  if (active.value && !confirmed) {
    dialog.value?.showModal();
    return;
  }
  dialog.value?.close();
  try {
    if (active.value) await store.abandonActive();
    const id = await store.startReview(pending.value);
    await router.push(`/practice/${id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '儲存失敗，請重試';
  }
}
</script>

<template>
  <h1>錯題複習</h1>

  <section v-if="!pending.length" class="sheet empty">
    <h2>{{ list.length ? '錯題都複習完了' : '目前沒有錯題' }}</h2>
    <p class="muted">答錯的題目會自動收進這裡。先做一回一般練習吧。</p>
    <RouterLink class="btn primary" to="/practice/setup">開始練習</RouterLink>
  </section>

  <template v-else>
    <section class="sheet">
      <p>有 <strong>{{ pending.length }}</strong> 題待複習。複習時答對一次就會移出清單，再答錯會重新加入。</p>
      <p v-if="error" class="status-strip error" role="alert">{{ error }}</p>
      <button class="btn primary" type="button" @click="startReview()">開始複習 {{ pending.length }} 題</button>
    </section>

    <section class="sheet">
      <h2>待複習</h2>
      <ul class="m-list">
        <li v-for="m in pending" :key="m.key">
          <div class="grow">
            <strong>{{ m.targetLabel }}</strong>
            <span class="small muted">｜{{ m.kind === 'chart-to-type' ? '看圖選氣候' : '看氣候選圖' }}｜錯 {{ m.wrongCount }} 次｜最近 {{ fmtDate(m.lastWrongAt) }}</span>
          </div>
          <RouterLink class="btn quiet small" :to="{ path: '/practice/setup', query: { type: m.targetTypeId, exclude: m.datasetId } }">
            練習同類新圖
          </RouterLink>
        </li>
      </ul>
      <p class="small muted">「練習同類新圖」會排除你錯過的那張圖，只出同一類型的其他圖，避免只記住原圖。若沒有其他圖，設定頁會直接告訴你。</p>
    </section>
  </template>

  <section v-if="cleared.length" class="sheet">
    <details>
      <summary>已複習完成（{{ cleared.length }}）</summary>
      <ul class="m-list">
        <li v-for="m in cleared" :key="m.key">
          <div class="grow">
            {{ m.targetLabel }}
            <span class="small muted">｜曾錯 {{ m.wrongCount }} 次</span>
          </div>
        </li>
      </ul>
    </details>
  </section>

  <dialog ref="dialog" aria-labelledby="mr-title">
    <h2 id="mr-title">放棄目前的練習？</h2>
    <p>你還有一回合沒做完。開始錯題複習後，舊回合不會再列入成績。</p>
    <div class="btn-row">
      <button class="btn danger" type="button" @click="startReview(true)">放棄並開始複習</button>
      <button class="btn" type="button" @click="router.push(`/practice/${active?.id}`)">回到未完成的練習</button>
      <button class="btn quiet" type="button" @click="dialog?.close()">取消</button>
    </div>
  </dialog>
</template>

<style scoped>
.m-list { list-style: none; padding: 0; margin: 0 0 8px; }
.m-list li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 0; border-bottom: 1px solid var(--grid); }
.grow { flex: 1; min-width: 180px; }
</style>
