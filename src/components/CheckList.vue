<script setup lang="ts">
// 逐項判斷（#2）：氣溫條件、降水條件各自標示符合／不符，文字＋圖示，不只靠顏色。
import { computed } from 'vue';
import type { DistractorCheck } from '../domain/types';

const props = defineProps<{ check: DistractorCheck; targetLabel: string }>();

function split(text: string) {
  const i = text.indexOf('；此圖');
  if (i < 0) return { need: text.replace(/^需要/, ''), seen: '' };
  return { need: text.slice(0, i).replace(/^需要/, ''), seen: text.slice(i + 1) };
}
const rows = computed(() => [
  { key: 'temperature', name: '氣溫', ...props.check.temperature, ...split(props.check.temperature.text) },
  { key: 'precipitation', name: '降水', ...props.check.precipitation, ...split(props.check.precipitation.text) },
]);
const failed = computed(() => rows.value.filter((r) => !r.pass).map((r) => r.name));
</script>

<template>
  <ul class="checks">
    <li v-for="r in rows" :key="r.key" :class="[r.key, r.pass ? 'pass' : 'fail']">
      <span class="badge" :aria-label="r.pass ? '符合' : '不符'">{{ r.pass ? '✓ 符合' : '✗ 不符' }}</span>
      <div>
        <strong>{{ r.name }}條件</strong>：「{{ targetLabel }}」需要{{ r.need }}
        <div v-if="r.seen" class="seen">{{ r.seen }}</div>
      </div>
    </li>
  </ul>
  <p class="verdict-line">所以是<strong>{{ failed.join('和') }}</strong>不符合「{{ targetLabel }}」。</p>
</template>

<style scoped>
.checks { list-style: none; margin: 6px 0 4px; padding: 0; display: grid; gap: 8px; }
.checks li { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; background: var(--sheet); border-radius: var(--radius-s); padding: 8px 10px; border-left: 4px solid var(--rule); }
.checks li.temperature { border-left-color: var(--temp); }
.checks li.precipitation { border-left-color: var(--rain); }
.badge { font-weight: 700; font-size: 0.85rem; padding: 1px 8px; border-radius: 4px; white-space: nowrap; }
.pass .badge { background: var(--ok-bg); color: var(--ok); }
.fail .badge { background: var(--bad); color: #fff; }
.seen { color: var(--ink-soft); font-size: 0.92rem; }
.verdict-line { margin: 4px 0 0; }
</style>
