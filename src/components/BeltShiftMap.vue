<script setup lang="ts">
// 風帶季移示意圖（#17）：1 月與 7 月的氣壓帶、高壓中心與代表地點的風向。
// 位置為教學用示意，不是逐日觀測；名稱待依課本核對。
import { computed, useId } from 'vue';
import { LAND_PATH } from '../assets/map/land-outline';
import { toXY } from '../map/classes';

const props = defineProps<{ season: 'jan' | 'jul' }>();
const uid = useId();

// 顯示範圍：西經 62° 到東經 170°、赤道到北緯 68°
const LON0 = -62;
const LON1 = 170;
const LAT0 = 68;
const LAT1 = 0;
const x0 = toXY(0, LON0).x;
const y0 = toXY(LAT0, 0).y;
const vw = toXY(0, LON1).x - x0;
const vh = toXY(LAT1, 0).y - y0;

interface SeasonState {
  stHigh: number; // 副熱帶高壓帶緯度
  westerly: number; // 盛行西風帶緯度
  subpolar: number; // 副極地低壓帶緯度
  itcz: number; // 赤道低壓帶緯度
  cells: { id: string; name: string; kind: 'H' | 'L'; lat: number; lon: number; rx: number; ry: number; show: boolean }[];
  winds: { id: string; lat: number; lon: number; heading: number; label: string; wet: boolean }[];
}

const STATES: Record<'jan' | 'jul', SeasonState> = {
  jan: {
    stHigh: 27,
    westerly: 42,
    subpolar: 57,
    itcz: 2,
    cells: [
      { id: 'azores', name: '副熱帶高壓（大西洋）', kind: 'H', lat: 30, lon: -28, rx: 72, ry: 34, show: true },
      { id: 'wpsh', name: '副熱帶高壓（太平洋）', kind: 'H', lat: 20, lon: 155, rx: 52, ry: 26, show: true },
      { id: 'siberia', name: '西伯利亞高壓', kind: 'H', lat: 50, lon: 100, rx: 90, ry: 40, show: true },
      { id: 'asia-low', name: '亞洲大陸低壓', kind: 'L', lat: 32, lon: 82, rx: 70, ry: 34, show: false },
    ],
    winds: [
      { id: 'cadiz', lat: 36.5, lon: -6.3, heading: 0, label: '盛行西風帶來水氣', wet: true },
      { id: 'shanghai', lat: 31.4, lon: 121.5, heading: 315, label: '乾冷的冬季風', wet: false },
      { id: 'hk', lat: 22.3, lon: 114.2, heading: 225, label: '乾冷的冬季風', wet: false },
    ],
  },
  jul: {
    stHigh: 36,
    westerly: 50,
    subpolar: 63,
    itcz: 12,
    cells: [
      { id: 'azores', name: '副熱帶高壓（大西洋）', kind: 'H', lat: 37, lon: -35, rx: 80, ry: 38, show: true },
      { id: 'wpsh', name: '副熱帶高壓（太平洋）', kind: 'H', lat: 30, lon: 150, rx: 70, ry: 32, show: true },
      { id: 'siberia', name: '西伯利亞高壓', kind: 'H', lat: 50, lon: 100, rx: 90, ry: 40, show: false },
      { id: 'asia-low', name: '亞洲大陸低壓', kind: 'L', lat: 32, lon: 82, rx: 70, ry: 34, show: true },
    ],
    winds: [
      { id: 'cadiz', lat: 36.5, lon: -6.3, heading: 270, label: '高壓下沉、乾燥', wet: false },
      { id: 'shanghai', lat: 31.4, lon: 121.5, heading: 135, label: '潮濕的夏季風', wet: true },
      { id: 'hk', lat: 22.3, lon: 114.2, heading: 60, label: '潮濕的夏季風', wet: true },
    ],
  },
};

const st = computed(() => STATES[props.season]);
// 緯線：每 10 度一條，另畫北回歸線
const latLines = [0, 10, 20, 30, 40, 50, 60];
const latLabel = (lat: number) => (lat === 0 ? '0°（赤道）' : `北緯 ${lat}°`);
const tropic = 23.44;
const y = (lat: number) => toXY(lat, 0).y;
const cities = [
  { id: 'cadiz', name: '加的斯', lat: 36.5, lon: -6.3, dx: 12, anchor: 'start' },
  { id: 'shanghai', name: '上海', lat: 31.4, lon: 121.5, dx: 14, anchor: 'start' },
  { id: 'hk', name: '香港', lat: 22.3, lon: 114.2, dx: -12, anchor: 'end' },
];
function windLine(w: SeasonState['winds'][number]) {
  // 風吹向 heading 方向：箭頭從上風處指向城市
  const r = (w.heading * Math.PI) / 180;
  const c = toXY(w.lat, w.lon);
  const len = 46;
  return { x1: c.x - Math.cos(r) * len, y1: c.y + Math.sin(r) * len, x2: c.x - Math.cos(r) * 10, y2: c.y + Math.sin(r) * 10 };
}
</script>

<template>
  <svg
    class="belt-map"
    :viewBox="`${x0} ${y0} ${vw} ${vh}`"
    role="img"
    :aria-label="season === 'jan' ? '1 月：副熱帶高壓帶南移，加的斯受盛行西風影響；東亞吹乾冷的冬季風' : '7 月：副熱帶高壓帶北移籠罩加的斯；東亞吹潮濕的夏季風'"
  >
    <defs>
      <marker :id="`${uid}-wet`" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="18" markerHeight="18" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#1d5fbf" />
      </marker>
      <marker :id="`${uid}-dry`" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="18" markerHeight="18" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#b5651d" />
      </marker>
    </defs>
    <rect :x="x0" :y="y0" :width="vw" :height="vh" class="sea" />
    <path :d="LAND_PATH" class="land" />

    <!-- 緯線與緯度標示 -->
    <g class="grid">
      <line v-for="lat in latLines" :key="lat" :x1="x0" :x2="x0 + vw" :y1="y(lat)" :y2="y(lat)" :class="{ eq: lat === 0 }" />
      <line :x1="x0" :x2="x0 + vw" :y1="y(tropic)" :y2="y(tropic)" class="tropic" />
    </g>

    <!-- 氣壓帶：隨季節南北移動 -->
    <g class="band low" :style="{ transform: `translateY(${y(st.subpolar)}px)` }">
      <rect :x="x0" y="-12" :width="vw" height="24" />
      <text :x="x0 + vw - 6" y="5" text-anchor="end">副極地低壓帶</text>
    </g>
    <g class="band west" :style="{ transform: `translateY(${y(st.westerly)}px)` }">
      <text :x="x0 + 74" y="5">盛行西風帶 →</text>
    </g>
    <g class="band high" :style="{ transform: `translateY(${y(st.stHigh)}px)` }">
      <rect :x="x0" y="-14" :width="vw" height="28" />
      <text :x="x0 + vw - 6" y="5" text-anchor="end">副熱帶高壓帶</text>
    </g>
    <g class="band low" :style="{ transform: `translateY(${y(st.itcz)}px)` }">
      <rect :x="x0" y="-12" :width="vw" height="24" />
      <text :x="x0 + vw - 6" y="5" text-anchor="end">赤道低壓帶</text>
    </g>

    <!-- 高壓與低壓中心 -->
    <g
      v-for="c in st.cells"
      :key="c.id"
      :class="['cell', c.kind === 'H' ? 'high' : 'low', { hidden: !c.show }]"
      :style="{ transform: `translate(${toXY(c.lat, c.lon).x}px, ${toXY(c.lat, c.lon).y}px)` }"
    >
      <ellipse :rx="c.rx" :ry="c.ry" />
      <text y="9" text-anchor="middle" class="big">{{ c.kind === 'H' ? '高' : '低' }}</text>
      <text :y="c.ry + 14" text-anchor="middle" class="name">{{ c.name }}</text>
    </g>

    <!-- 緯度文字放在最上層，避免被氣壓帶蓋住 -->
    <g class="lat-labels">
      <text v-for="lat in latLines" :key="lat" :x="x0 + 4" :y="lat === 0 ? y(lat) - 4 : y(lat) - 3">{{ latLabel(lat) }}</text>
      <text :x="x0 + vw * 0.42" :y="y(tropic) - 3" class="tropic-label">北回歸線（23.5°）</text>
    </g>

    <!-- 代表地點的風 -->
    <g v-for="w in st.winds" :key="w.id" :class="['wind', w.wet ? 'wet' : 'dry']">
      <line v-bind="windLine(w)" :marker-end="`url(#${uid}-${w.wet ? 'wet' : 'dry'})`" />
    </g>
    <g v-for="c in cities" :key="c.id" class="city">
      <circle :cx="toXY(c.lat, c.lon).x" :cy="toXY(c.lat, c.lon).y" r="6" />
      <text :x="toXY(c.lat, c.lon).x + c.dx" :y="toXY(c.lat, c.lon).y + 4" :text-anchor="c.anchor">{{ c.name }}</text>
    </g>
  </svg>
</template>

<style scoped>
.belt-map { display: block; width: 100%; height: auto; background: #e7f0f6; border-radius: 6px; }
.sea { fill: #e7f0f6; }
.land { fill: #f4efe2; stroke: #8a97a3; stroke-width: 1; }
.grid line { stroke: #7d8c99; stroke-width: 0.8; stroke-dasharray: 3 4; }
.grid line.eq { stroke: #33424f; stroke-width: 1.2; stroke-dasharray: none; }
.grid line.tropic { stroke: #33424f; stroke-width: 1; stroke-dasharray: 8 5; }
.lat-labels text { font-size: 11px; font-weight: 700; fill: #33424f; paint-order: stroke; stroke: #fff; stroke-width: 3px; }
.lat-labels .tropic-label { font-weight: 600; fill: #4b5d6d; }
.band, .cell { transition: transform 1.2s ease-in-out, opacity 0.8s; }
.band rect { fill-opacity: 0.2; }
.band.high rect { fill: #c8372d; }
.band.low rect { fill: #2e6fb7; }
.band text { font-size: 13px; font-weight: 700; paint-order: stroke; stroke: #fff; stroke-width: 3px; }
.band.high text { fill: #8f241c; }
.band.low text { fill: #1f4f87; }
.band.west text { fill: #1b2a38; }
.cell ellipse { fill-opacity: 0.18; stroke-width: 2; stroke-dasharray: 5 4; }
.cell.high ellipse { fill: #c8372d; stroke: #8f241c; }
.cell.low ellipse { fill: #2e6fb7; stroke: #1f4f87; }
.cell.hidden { opacity: 0; }
.cell text { paint-order: stroke; stroke: #fff; stroke-width: 3px; font-weight: 800; }
.cell .big { font-size: 26px; }
.cell.high .big { fill: #8f241c; }
.cell.low .big { fill: #1f4f87; }
.cell .name { font-size: 12px; fill: #33424f; }
.wind line { stroke-width: 4; stroke-linecap: round; }
.wind.wet line { stroke: #1d5fbf; }
.wind.dry line { stroke: #b5651d; }
.city circle { fill: #1b2a38; stroke: #fff; stroke-width: 2; }
.city text { font-size: 14px; font-weight: 800; fill: #1b2a38; paint-order: stroke; stroke: #fff; stroke-width: 4px; }
</style>
