<script setup lang="ts">
// 小地圖：標出測站位置（#12），可選擇地點（#14），可疊加風帶、氣壓帶、洋流（#15）。
// 座標系統與世界氣候分布圖相同。
import { computed, useId } from 'vue';
import { LAND_PATH } from '../assets/map/land-outline';
import { MAP_GRID, toXY } from '../map/classes';
import { CURRENTS, PRESSURE_BELTS, WIND_ARROW_LONS, WIND_BELTS, splitDateline } from '../map/overlays';

export interface LocatorPoint {
  lat: number;
  lon: number;
  id?: string;
  label?: string;
  highlight?: boolean;
  state?: 'selected' | 'correct' | 'wrong';
}

const props = withDefaults(
  defineProps<{ points: LocatorPoint[]; title: string; interactive?: boolean; overlays?: string[] }>(),
  { interactive: false, overlays: () => [] },
);
const emit = defineEmits<{ select: [id: string] }>();

const uid = useId();
const W = MAP_GRID.width;
const H = MAP_GRID.height;
const eq = toXY(0, 0).y;

const belts = computed(() => PRESSURE_BELTS.filter((b) => props.overlays.includes(b.id)));
const winds = computed(() => WIND_BELTS.filter((w) => props.overlays.includes(w.id)));
const currents = computed(() => CURRENTS.filter((c) => props.overlays.includes(c.id)));

function pathD(path: [number, number][]): string {
  return splitDateline(path)
    .map((seg) => 'M' + seg.map(([la, lo]) => {
      const p = toXY(la, lo);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join('L'))
    .join(' ');
}
function arrows(heading: number, lat: number) {
  const rad = (heading * Math.PI) / 180;
  const dx = Math.cos(rad) * 22;
  const dy = -Math.sin(rad) * 22;
  return WIND_ARROW_LONS.map((lon) => {
    const c = toXY(lat, lon - 15);
    return { key: lon, x1: c.x - dx, y1: c.y - dy, x2: c.x + dx, y2: c.y + dy };
  });
}
function mid(path: [number, number][]) {
  const [la, lo] = path[Math.floor(path.length / 2)];
  return toXY(la, lo);
}
function pick(p: LocatorPoint) {
  if (props.interactive && p.id) emit('select', p.id);
}
</script>

<template>
  <svg class="locator" :class="{ interactive }" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="title">
    <defs>
      <marker :id="`${uid}-warm`" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="34" markerHeight="34" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#d62828" />
      </marker>
      <marker :id="`${uid}-cool`" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="34" markerHeight="34" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#1d5fbf" />
      </marker>
      <marker :id="`${uid}-wind`" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="26" markerHeight="26" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#1b2a38" />
      </marker>
    </defs>
    <rect :width="W" :height="H" class="sea" />
    <path :d="LAND_PATH" class="land" />
    <line :x1="0" :x2="W" :y1="eq" :y2="eq" class="eq" />

    <g v-for="b in belts" :key="b.id" :class="['belt', b.kind]">
      <rect x="0" :y="toXY(b.lat + 3, 0).y" :width="W" height="24" />
      <text :x="W - 12" :y="toXY(b.lat, 0).y + 12" text-anchor="end">{{ b.name }}</text>
    </g>
    <g v-for="w in winds" :key="w.id" class="wind">
      <line v-for="a in arrows(w.heading, w.lat)" :key="a.key" :x1="a.x1" :y1="a.y1" :x2="a.x2" :y2="a.y2" :marker-end="`url(#${uid}-wind)`" />
      <text :x="16" :y="toXY(w.lat, 0).y - 18">{{ w.name }}</text>
    </g>
    <g v-for="c in currents" :key="c.id" :class="['current', c.kind]">
      <path :d="pathD(c.path)" :marker-end="`url(#${uid}-${c.kind})`" />
      <text :x="mid(c.path).x + 18" :y="mid(c.path).y - 14">{{ c.name }}</text>
    </g>

    <g
      v-for="(p, i) in points"
      :key="p.id ?? i"
      :class="['pt', p.state, { hi: p.highlight }]"
      :transform="`translate(${toXY(p.lat, p.lon).x} ${toXY(p.lat, p.lon).y})`"
      @click="pick(p)"
    >
      <circle :r="interactive ? 70 : 44" class="hit" />
      <circle :r="interactive ? 34 : 22" class="halo" />
      <circle :r="interactive ? 18 : 11" class="dot" />
      <text v-if="p.label" x="0" :y="interactive ? -44 : -32" text-anchor="middle" :class="{ big: interactive }">{{ p.label }}</text>
    </g>
  </svg>
</template>

<style scoped>
.locator { display: block; width: 100%; height: auto; border-radius: 6px; }
.sea { fill: #e7f0f6; }
.land { fill: #f4efe2; stroke: #8a97a3; stroke-width: 1.2; }
.eq { stroke: #8a97a3; stroke-width: 1.5; stroke-dasharray: 10 8; }
.belt rect { fill-opacity: 0.18; }
.belt.low rect { fill: #2e6fb7; }
.belt.high rect { fill: #c8372d; }
.belt text, .wind text, .current text { font-size: 30px; font-weight: 700; paint-order: stroke; stroke: #fff; stroke-width: 7px; }
.belt.low text { fill: #1f4f87; }
.belt.high text { fill: #8f241c; }
.wind line { stroke: #1b2a38; stroke-width: 4; }
.wind text { fill: #1b2a38; }
.current path { fill: none; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
.current.warm path { stroke: #d62828; }
.current.cool path { stroke: #1d5fbf; stroke-dasharray: 16 10; }
.current.warm text { fill: #9b1c1c; }
.current.cool text { fill: #163f7a; }
.pt .hit { fill: transparent; }
.interactive .pt { cursor: pointer; }
.halo { fill: rgba(200, 55, 45, 0.18); }
.dot { fill: var(--temp); stroke: #fff; stroke-width: 4; }
.hi .halo, .correct .halo { fill: rgba(38, 115, 74, 0.25); }
.hi .dot, .correct .dot { fill: var(--ok); }
.selected .halo { fill: rgba(29, 53, 87, 0.3); }
.selected .dot { fill: var(--navy); }
.wrong .dot { fill: var(--bad); }
.interactive .pt:not(.selected):not(.correct):not(.wrong) .dot { fill: #fff; stroke: var(--navy); stroke-width: 6; }
.interactive .pt:not(.selected):not(.correct):not(.wrong) .halo { fill: rgba(29, 53, 87, 0.12); }
text.big { font-size: 64px; }
text { font-size: 40px; font-weight: 800; fill: #1b2a38; paint-order: stroke; stroke: #fff; stroke-width: 8px; }
</style>
