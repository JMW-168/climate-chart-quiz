<script setup lang="ts">
import { computed } from 'vue';
import { annualMeanTemp, annualPrecip, fmt0, fmt1 } from '../domain/stats';

const props = defineProps<{ temperatureC: number[]; precipitationMm: number[]; compact?: boolean }>();
const mean = computed(() => fmt1(annualMeanTemp(props.temperatureC)));
const total = computed(() => fmt0(annualPrecip(props.precipitationMm)));
</script>

<template>
  <p v-if="compact" class="compact-summary">年均溫 {{ mean }}°C<br />年降水 {{ total }} mm</p>
  <dl v-else class="stat-row summary">
    <div><dt>年均溫</dt><dd>{{ mean }}°C</dd></div>
    <div><dt>年降水量</dt><dd>{{ total }} mm</dd></div>
  </dl>
</template>

<style scoped>
.summary { margin: 4px 0 0; }
.compact-summary { margin: 0; font-size: 0.85rem; font-weight: 600; line-height: 1.45; padding-left: 4px; }
</style>
