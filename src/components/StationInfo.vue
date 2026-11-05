<script setup lang="ts">
// 作答後顯示氣候圖的測站名稱與位置（#12）。
import { formatLatLon } from '../map/classes';
import type { StationLocation } from '../domain/types';

defineProps<{ location: StationLocation; prefix?: string }>();
</script>

<template>
  <span class="station-info">
    <strong>{{ prefix }}{{ location.nameZh }}</strong>
    <span class="muted">（{{ formatLatLon(location.lat, location.lon) }}，海拔 {{ Math.round(location.elev) }} m）</span>
  </span>
</template>
