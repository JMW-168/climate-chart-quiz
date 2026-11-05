<script setup lang="ts">
// 世界氣候分布互動地圖（#11）：勾選要顯示的氣候、點地圖查看該處氣候、顯示題庫測站與其氣候圖。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import gridUrl from '../assets/map/climate-grid.png';
import { LAND_PATH } from '../assets/map/land-outline';
import ClimateChart from '../components/ClimateChart.vue';
import { computeScale } from '../domain/stats';
import type { ClimateDataset } from '../domain/types';
import { MAP_CLASSES, MAP_GRID, MAP_GROUPS, formatLatLon, toLatLon, toXY, type MapClass } from '../map/classes';
import { useAppStore } from '../stores/app';

const app = useAppStore();
const W = MAP_GRID.width;
const H = MAP_GRID.height;

const STORE_KEY = 'ccq-map-visible';
function loadVisible(): Set<number> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch {
    /* 偏好讀取失敗時顯示全部 */
  }
  return new Set(MAP_CLASSES.map((c) => c.code));
}
const visible = ref<Set<number>>(loadVisible());
watch(visible, (v) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...v]));
  } catch {
    /* 忽略 */
  }
});

const focusCode = ref<number | null>(null);
const showStations = ref(true);
const zoom = ref(1);

const canvas = ref<HTMLCanvasElement | null>(null);
let codes: Uint8Array | null = null;
const loaded = ref(false);
const loadError = ref(false);

const byCode = new Map(MAP_CLASSES.map((c) => [c.code, c]));
const rgb = new Map(MAP_CLASSES.map((c) => [c.code, [1, 3, 5].map((i) => parseInt(c.color.slice(i, i + 2), 16))]));
const HIDDEN_LAND = [236, 238, 240];

function draw() {
  const cv = canvas.value;
  if (!cv || !codes) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const vis = visible.value;
  const focus = focusCode.value;
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0) continue; // 海洋：透明
    const o = i * 4;
    let col = HIDDEN_LAND;
    let a = 255;
    if (vis.has(c)) {
      col = rgb.get(c) ?? HIDDEN_LAND;
      if (focus !== null && c !== focus) a = 70;
    }
    d[o] = col[0];
    d[o + 1] = col[1];
    d[o + 2] = col[2];
    d[o + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
}

onMounted(() => {
  const img = new Image();
  img.onload = () => {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;
    codes = new Uint8Array(W * H);
    for (let i = 0; i < codes.length; i++) codes[i] = data[i * 4];
    loaded.value = true;
    draw();
  };
  img.onerror = () => (loadError.value = true);
  img.src = gridUrl;
});
watch([visible, focusCode], draw, { deep: true });

// ── 點選與滑過 ──
interface Spot {
  x: number;
  y: number;
  lat: number;
  lon: number;
  cls: MapClass | null;
}
const pinned = ref<Spot | null>(null);
const hover = ref<Spot | null>(null);
const station = ref<ClimateDataset | null>(null);

function spotAt(ev: PointerEvent | MouseEvent): Spot | null {
  const el = ev.currentTarget as SVGSVGElement;
  const r = el.getBoundingClientRect();
  const x = ((ev.clientX - r.left) / r.width) * W;
  const y = ((ev.clientY - r.top) / r.height) * H;
  if (x < 0 || y < 0 || x >= W || y >= H) return null;
  const code = codes ? codes[Math.floor(y) * W + Math.floor(x)] : 0;
  const { lat, lon } = toLatLon(x, y);
  return { x, y, lat, lon, cls: code ? byCode.get(code) ?? null : null };
}
function onMove(ev: PointerEvent) {
  if (ev.pointerType === 'mouse') hover.value = spotAt(ev);
}
function onClick(ev: MouseEvent) {
  station.value = null;
  pinned.value = spotAt(ev);
}
const info = computed(() => pinned.value ?? hover.value);

// ── 測站 ──
const stations = computed(() =>
  (app.pkg?.datasets ?? [])
    .filter((d) => d.location)
    .map((d) => ({ d, ...toXY(d.location!.lat, d.location!.lon), cls: MAP_CLASSES.find((c) => c.typeId === d.typeId) ?? null })),
);
function pickStation(d: ClimateDataset) {
  station.value = d;
  pinned.value = null;
}
function pickFromList(d: ClimateDataset) {
  pickStation(d);
  document.querySelector('.map-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const typeLabel = (id: string) => app.pkg?.taxonomy.types.find((t) => t.id === id)?.label ?? id;

// ── 勾選 ──
function toggle(code: number) {
  const next = new Set(visible.value);
  if (next.has(code)) next.delete(code);
  else next.add(code);
  visible.value = next;
}
function setAll(on: boolean) {
  visible.value = new Set(on ? MAP_CLASSES.map((c) => c.code) : []);
}
function onlyGroup(g: MapClass['group']) {
  visible.value = new Set(MAP_CLASSES.filter((c) => c.group === g).map((c) => c.code));
}
function only(code: number) {
  visible.value = new Set([code]);
}
const grouped = computed(() =>
  MAP_GROUPS.map((g) => ({ ...g, items: MAP_CLASSES.filter((c) => c.group === g.id) })).filter((g) => g.items.length),
);

// 參考緯線
const lines = [
  { lat: 66.56, label: '北極圈' },
  { lat: 23.44, label: '北回歸線' },
  { lat: 0, label: '赤道' },
  { lat: -23.44, label: '南回歸線' },
];

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    pinned.value = null;
    station.value = null;
  }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <h1>世界氣候分布</h1>
  <p class="small muted">點地圖上任一處，可以看那裡是什麼氣候；用下方的勾選決定要顯示哪些氣候。</p>

  <section class="sheet flush map-sheet">
    <div class="map-tools">
      <div class="zoom" role="group" aria-label="地圖縮放">
        <button v-for="z in [1, 2, 3]" :key="z" class="btn quiet small" type="button" :aria-pressed="zoom === z" @click="zoom = z">
          {{ z === 1 ? '全圖' : `放大 ${z} 倍` }}
        </button>
      </div>
      <label class="check small">
        <input v-model="showStations" type="checkbox" />
        顯示題庫測站
      </label>
    </div>

    <div class="map-scroll" :class="{ zoomed: zoom > 1 }">
      <div class="map-frame" :style="{ width: `${zoom * 100}%` }">
        <canvas ref="canvas" :width="W" :height="H" role="img" aria-label="世界氣候分布圖"></canvas>
        <svg
          class="overlay"
          :viewBox="`0 0 ${W} ${H}`"
          preserveAspectRatio="none"
          @pointermove="onMove"
          @pointerleave="hover = null"
          @click="onClick"
        >
          <path :d="LAND_PATH" class="land" />
          <g class="lines">
            <template v-for="l in lines" :key="l.lat">
              <line :x1="0" :x2="W" :y1="toXY(l.lat, 0).y" :y2="toXY(l.lat, 0).y" :class="{ eq: l.lat === 0 }" />
              <text :x="6" :y="toXY(l.lat, 0).y - 4">{{ l.label }}</text>
            </template>
          </g>
          <g v-if="showStations" class="stations">
            <circle
              v-for="s in stations"
              :key="s.d.id"
              :cx="s.x"
              :cy="s.y"
              r="7"
              :class="{ active: station?.id === s.d.id }"
              @click.stop="pickStation(s.d)"
            >
              <title>{{ s.d.location?.nameZh }}</title>
            </circle>
          </g>
          <g v-if="pinned" class="pin">
            <circle :cx="pinned.x" :cy="pinned.y" r="9" />
            <circle :cx="pinned.x" :cy="pinned.y" r="2.5" class="dot" />
          </g>
        </svg>
      </div>
      <p v-if="!loaded && !loadError" class="loading small muted">地圖載入中…</p>
      <p v-if="loadError" class="loading small">地圖資料載入失敗，請連線後重新整理。</p>
    </div>

    <div class="info" aria-live="polite">
      <template v-if="station">
        <div class="info-head">
          <span class="swatch" :style="{ background: MAP_CLASSES.find((c) => c.typeId === station!.typeId)?.color }"></span>
          <strong>{{ station.location?.nameZh }}</strong>
          <span class="small muted">｜{{ typeLabel(station.typeId) }}｜{{ formatLatLon(station.location!.lat, station.location!.lon) }}｜海拔 {{ Math.round(station.location!.elev) }} m</span>
        </div>
        <ClimateChart
          :temperature-c="station.temperatureC"
          :precipitation-mm="station.precipitationMm"
          :scale="computeScale([station])"
          :label="`${station.location?.nameZh} 氣候圖`"
          :show-table="false"
        />
        <div class="btn-row">
          <RouterLink class="btn small" :to="`/review#review-${station.typeId}`">看「{{ typeLabel(station.typeId) }}」的特徵</RouterLink>
          <button class="btn quiet small" type="button" @click="station = null">關閉</button>
        </div>
      </template>
      <template v-else-if="info">
        <div class="info-head">
          <span v-if="info.cls" class="swatch" :style="{ background: info.cls.color }"></span>
          <strong>{{ info.cls ? info.cls.label : '海洋' }}</strong>
          <span class="small muted">｜{{ formatLatLon(info.lat, info.lon) }}</span>
          <span v-if="info.cls && !visible.has(info.cls.code)" class="small muted">（目前未勾選顯示）</span>
        </div>
        <p v-if="info.cls?.note" class="small muted note">{{ info.cls.note }}</p>
        <div v-if="pinned && info.cls" class="btn-row">
          <RouterLink v-if="info.cls.typeId" class="btn small" :to="`/review#review-${info.cls.typeId}`">看這種氣候的特徵</RouterLink>
          <button class="btn quiet small" type="button" @click="only(info.cls.code)">地圖只顯示這種氣候</button>
        </div>
      </template>
      <p v-else class="small muted">把滑鼠移到地圖上，或點一下任何地方。</p>
    </div>
  </section>

  <section class="sheet legend" aria-labelledby="legend-title">
    <div class="legend-head">
      <h2 id="legend-title">要顯示的氣候</h2>
      <div class="btn-row">
        <button class="btn quiet small" type="button" @click="setAll(true)">全選</button>
        <button class="btn quiet small" type="button" @click="setAll(false)">全不選</button>
      </div>
    </div>
    <div v-for="g in grouped" :key="g.id" class="legend-group">
      <div class="group-row">
        <h3>{{ g.label }}</h3>
        <button class="btn quiet small" type="button" @click="onlyGroup(g.id)">只看{{ g.label }}</button>
      </div>
      <ul>
        <li
          v-for="c in g.items"
          :key="c.code"
          @mouseenter="focusCode = c.code"
          @mouseleave="focusCode = null"
        >
          <label class="legend-item" :class="{ off: !visible.has(c.code) }">
            <input
              type="checkbox"
              :checked="visible.has(c.code)"
              @change="toggle(c.code)"
              @focus="focusCode = c.code"
              @blur="focusCode = null"
            />
            <span class="swatch" :style="{ background: c.color }" aria-hidden="true"></span>
            <span>{{ c.label }}</span>
          </label>
          <RouterLink v-if="c.typeId" class="small feature-link" :to="`/review#review-${c.typeId}`" :aria-label="`${c.label}的特徵`">特徵</RouterLink>
        </li>
      </ul>
    </div>
    <p class="small muted" style="margin: 8px 0 0">
      分布依柯本氣候分類（1986–2010）對應到本網站的氣候名稱，邊界為簡化示意，詳細出處見<RouterLink to="/sources">資料來源</RouterLink>。
    </p>
  </section>

  <section v-if="stations.length" class="sheet small">
    <details>
      <summary>題庫測站清單（{{ stations.length }} 個）</summary>
      <ul class="station-list">
        <li v-for="s in stations" :key="s.d.id">
          <button class="btn quiet small" type="button" @click="pickFromList(s.d)">
            <span class="swatch" :style="{ background: s.cls?.color }" aria-hidden="true"></span>
            {{ s.d.location?.nameZh }}｜{{ typeLabel(s.d.typeId) }}
          </button>
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.map-sheet { padding: 0; }
.map-tools { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--grid); }
.zoom { display: flex; gap: 2px; flex-wrap: wrap; }
.zoom .btn[aria-pressed='true'] { background: var(--navy); color: #fff; }
.check { display: inline-flex; align-items: center; gap: 6px; min-height: var(--tap); }
.check input { width: 18px; height: 18px; }
.map-scroll { position: relative; overflow: hidden; background: #e7f0f6; }
.map-scroll.zoomed { overflow: auto; -webkit-overflow-scrolling: touch; }
.map-frame { position: relative; aspect-ratio: 1440 / 576; }
canvas, .overlay { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.overlay { cursor: crosshair; touch-action: pan-x pan-y; }
.land { fill: none; stroke: #33424f; stroke-width: 0.8; vector-effect: non-scaling-stroke; }
.lines line { stroke: #6b7c8c; stroke-width: 0.8; stroke-dasharray: 6 5; vector-effect: non-scaling-stroke; }
.lines line.eq { stroke: #33424f; stroke-dasharray: none; }
.lines text { font-size: 14px; fill: #33424f; paint-order: stroke; stroke: #e7f0f6; stroke-width: 3px; }
.stations circle { fill: #fff; stroke: #1b2a38; stroke-width: 2; cursor: pointer; vector-effect: non-scaling-stroke; }
.stations circle.active { fill: var(--focus); }
.pin circle { fill: none; stroke: #1b2a38; stroke-width: 3; vector-effect: non-scaling-stroke; }
.pin circle.dot { fill: #1b2a38; }
.loading { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; }
.info { padding: 12px 14px; border-top: 1px solid var(--grid); min-height: 64px; }
.info-head { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin-bottom: 6px; }
.note { margin: 0 0 8px; }
.swatch { display: inline-block; width: 16px; height: 16px; border-radius: 3px; border: 1px solid rgba(0, 0, 0, 0.25); flex: none; }
.legend-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; }
.legend-head h2 { margin: 0; }
.legend-group { margin-top: 10px; }
.group-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.group-row h3 { margin: 0; font-size: 0.98rem; color: var(--ink-soft); }
.legend-group ul { list-style: none; margin: 4px 0 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: 2px; }
@media (min-width: 560px) {
  .legend-group ul { grid-template-columns: 1fr 1fr; }
}
.legend-group li { display: flex; align-items: center; gap: 6px; }
.legend-item { display: flex; align-items: center; gap: 8px; min-height: var(--tap); flex: 1; cursor: pointer; padding: 0 6px; border-radius: var(--radius-s); }
.legend-item:hover { background: #eef3f8; }
.legend-item input { width: 18px; height: 18px; flex: none; }
.legend-item.off { color: var(--ink-faint); }
.legend-item.off .swatch { opacity: 0.35; }
.feature-link { padding: 0 6px; min-height: var(--tap); display: inline-flex; align-items: center; }
.station-list { list-style: none; padding: 0; margin: 6px 0 0; display: grid; gap: 2px; }
.station-list .btn { justify-content: flex-start; text-align: left; width: 100%; font-weight: 500; }
</style>
