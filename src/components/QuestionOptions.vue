<script setup lang="ts">
// Q1 四個氣候名稱選項：原生單選，可鍵盤操作；提交後鎖定並以文字＋圖示標示對錯。
defineProps<{
  options: { id: string; label: string }[];
  selected: string | null;
  submitted: boolean;
  correctOptionId: string;
  name: string;
}>();
defineEmits<{ select: [id: string] }>();
</script>

<template>
  <div class="options" role="radiogroup" aria-label="選擇氣候類型">
    <label
      v-for="(o, i) in options"
      :key="o.id"
      class="option"
      :class="{
        selected: selected === o.id,
        locked: submitted,
        'is-correct': submitted && o.id === correctOptionId,
        'is-wrong': submitted && selected === o.id && o.id !== correctOptionId,
      }"
    >
      <input
        type="radio"
        :name="name"
        :value="o.id"
        :checked="selected === o.id"
        :disabled="submitted"
        @change="$emit('select', o.id)"
      />
      <span class="mark" aria-hidden="true">{{
        submitted && o.id === correctOptionId ? '✓' : submitted && selected === o.id ? '✗' : 'ABCD'[i]
      }}</span>
      <span>{{ o.label }}</span>
      <span v-if="submitted && o.id === correctOptionId" class="verdict">正確答案</span>
      <span v-else-if="submitted && selected === o.id" class="verdict">你的選擇</span>
    </label>
  </div>
</template>
