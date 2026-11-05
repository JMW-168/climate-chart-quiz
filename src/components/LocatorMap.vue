<script setup lang="ts">
// 小地圖（#12）：標出氣候圖測站的位置。座標系統與世界氣候分布圖相同。
import { LAND_PATH } from '../assets/map/land-outline';
import { MAP_GRID, toXY } from '../map/classes';

defineProps<{ points: { lat: number; lon: number; label?: string; highlight?: boolean }[]; title: string }>();
const W = MAP_GRID.width;
const H = MAP_GRID.height;
const eq = toXY(0, 0).y;
</script>

<template>
  <svg class="locator" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="title">
    <rect :width="W" :height="H" class="sea" />
    <path :d="LAND_PATH" class="land" />
    <line :x1="0" :x2="W" :y1="eq" :y2="eq" class="eq" />
    <g v-for="(p, i) in points" :key="i" :transform="`translate(${toXY(p.lat, p.lon).x} ${toXY(p.lat, p.lon).y})`">
      <circle r="22" :class="['halo', { hi: p.highlight }]" />
      <circle r="11" :class="['dot', { hi: p.highlight }]" />
      <text v-if="p.label" x="0" y="-30" text-anchor="middle">{{ p.label }}</text>
    </g>
  </svg>
</template>

<style scoped>
.locator { display: block; width: 100%; height: auto; border-radius: 6px; }
.sea { fill: #e7f0f6; }
.land { fill: #f4efe2; stroke: #8a97a3; stroke-width: 1.2; }
.eq { stroke: #8a97a3; stroke-width: 1.5; stroke-dasharray: 10 8; }
.halo { fill: rgba(200, 55, 45, 0.18); }
.halo.hi { fill: rgba(38, 115, 74, 0.25); }
.dot { fill: var(--temp); stroke: #fff; stroke-width: 4; }
.dot.hi { fill: var(--ok); }
text { font-size: 40px; font-weight: 800; fill: #1b2a38; paint-order: stroke; stroke: #fff; stroke-width: 8px; }
</style>
