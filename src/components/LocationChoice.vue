<script setup lang="ts">
// 看圖找地點（#14）：在小地圖上點 A～D，或用下方按鈕選擇；作答前不顯示城市名稱。
import { computed } from 'vue';
import LocatorMap, { type LocatorPoint } from './LocatorMap.vue';
import { formatLatLon } from '../map/classes';
import type { ChartToLocationQuestion } from '../domain/types';

const props = defineProps<{ question: ChartToLocationQuestion; selected: string | null; submitted: boolean }>();
const emit = defineEmits<{ select: [id: string] }>();

const points = computed<LocatorPoint[]>(() =>
  props.question.options.map((o) => ({
    id: o.id,
    lat: o.location.lat,
    lon: o.location.lon,
    label: o.letter,
    state: props.submitted
      ? o.id === props.question.correctOptionId
        ? 'correct'
        : o.id === props.selected
          ? 'wrong'
          : undefined
      : o.id === props.selected
        ? 'selected'
        : undefined,
  })),
);
function choose(id: string) {
  if (!props.submitted) emit('select', id);
}
</script>

<template>
  <div class="location-choice">
    <LocatorMap :points="points" :interactive="!submitted" title="四個候選地點 A 到 D 的地圖" @select="choose" />
    <div class="options" role="radiogroup" aria-label="選擇地點">
      <label
        v-for="o in question.options"
        :key="o.id"
        class="option"
        :class="{
          selected: selected === o.id,
          locked: submitted,
          'is-correct': submitted && o.id === question.correctOptionId,
          'is-wrong': submitted && selected === o.id && o.id !== question.correctOptionId,
        }"
      >
        <input type="radio" :name="`loc-${question.id}`" :value="o.id" :checked="selected === o.id" :disabled="submitted" @change="choose(o.id)" />
        <span class="mark" aria-hidden="true">{{
          submitted && o.id === question.correctOptionId ? '✓' : submitted && selected === o.id ? '✗' : o.letter
        }}</span>
        <span>
          地點 {{ o.letter }}
          <span class="small muted">｜{{ formatLatLon(o.location.lat, o.location.lon) }}</span>
          <span v-if="submitted" class="small">｜{{ o.location.nameZh }}</span>
        </span>
        <span v-if="submitted && o.id === question.correctOptionId" class="verdict">正確答案</span>
        <span v-else-if="submitted && selected === o.id" class="verdict">你的選擇</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.location-choice { display: grid; gap: 12px; margin-top: 14px; }
</style>
