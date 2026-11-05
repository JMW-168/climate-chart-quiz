<script setup lang="ts">
import ClimateReview from '../components/ClimateReview.vue';
</script>

<template>
  <ClimateReview standalone />
  <div class="btn-row">
    <RouterLink class="btn primary" to="/practice/setup">複習完，開始練習</RouterLink>
    <RouterLink class="btn" to="/map">看世界氣候分布圖</RouterLink>
  </div>
</template>
