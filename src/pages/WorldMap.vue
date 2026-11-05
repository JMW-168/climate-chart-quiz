<script setup lang="ts">
// 世界氣候分布互動地圖（#11）：勾選要顯示的氣候、點地圖查看該處氣候、顯示題庫測站與其氣候圖。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import gridUrl from '../assets/map/climate-grid.png';
import { LAND_PATH } from '../assets/map/land-outline';
import ClimateChart from '../components/ClimateChart.vue';
import { computeScale } from '../domain/stats';
import type { ClimateDataset } from '../domain/types';
import { MAP_CLASSES, MAP_GRID, MAP_GROUPS, formatLatLon, toLatLon, toXY, type MapClass } from '../map/classes';
import {
  CURRENTS,
  PRESSURE_BELTS,
  WIND_ARROW_LONS,
  WIND_BELTS,
  splitDateline,
  type OceanCurrent,
  type PressureBelt,
  type WindBelt,
} from '../map/overlays';
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

// ── 風帶、氣壓帶與洋流圖層（#13） ──
const LAYER_KEY = 'ccq-map-layers';
interface Layers {
  winds: boolean;
  warm: boolean;
  cool: boolean;
  labels: boolean;
}
function loadLayers(): Layers {
  const d: Layers = { winds: false, warm: false, cool: false, labels: true };
  try {
    return { ...d, ...(JSON.parse(localStorage.getItem(LAYER_KEY) ?? '{}') as Partial<Layers>) };
  } catch {
    return d;
  }
}
const layers = ref<Layers>(loadLayers());
watch(
  layers,
  (v) => {
    try {
      localStorage.setItem(LAYER_KEY, JSON.stringify(v));
    } catch {
      /* 忽略 */
    }
  },
  { deep: true },
);

type OverlayPick =
  | { kind: 'current'; id: string; item: OceanCurrent }
  | { kind: 'belt'; id: string; item: PressureBelt }
  | { kind: 'wind'; id: string; item: WindBelt };
const overlay = ref<OverlayPick | null>(null);

const shownCurrents = computed(() => CURRENTS.filter((c) => (c.kind === 'warm' ? layers.value.warm : layers.value.cool)));

function pathD(path: [number, number][]): string {
  return splitDateline(path)
    .map((seg) => 'M' + seg.map(([la, lo]) => {
      const p = toXY(la, lo);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join('L'))
    .join(' ');
}
function labelAt(path: [number, number][]) {
  const [la, lo] = path[Math.floor(path.length / 2)];
  return toXY(la, lo);
}
function windArrows(w: WindBelt) {
  const rad = (w.heading * Math.PI) / 180;
  const dx = Math.cos(rad) * 18;
  const dy = -Math.sin(rad) * 18;
  return WIND_ARROW_LONS.map((lon) => {
    const c = toXY(w.lat, lon - 15);
    return { key: lon, x1: c.x - dx, y1: c.y - dy, x2: c.x + dx, y2: c.y + dy };
  });
}
function pickOverlay(o: OverlayPick) {
  overlay.value = o;
  station.value = null;
  pinned.value = null;
}
const overlayKind = computed(() => {
  const o = overlay.value;
  if (!o) return '';
  if (o.kind === 'current') return o.item.kind === 'warm' ? '暖流' : '涼流（含寒流）';
  if (o.kind === 'belt') return o.item.kind === 'low' ? '低壓帶' : '高壓帶';
  return '風帶';
});

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
  overlay.value = null;
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
  overlay.value = null;
  pinned.value = null;
}
function pickFromList(d: ClimateDataset) {
  pickStation(d);
  document.querySelector('.map-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const typeLabel = (id: string) => app.pkg?.taxonomy.types.find((t) => t.id === id)?.label ?? id;

// ── 圖例突顯：只在滑鼠移入或鍵盤聚焦時使用；觸控點選不突顯（手機沒有「移出」可以取消） ──
function onLegendEnter(ev: PointerEvent, code: number) {
  if (ev.pointerType === 'mouse') focusCode.value = code;
}
function onLegendFocus(ev: FocusEvent, code: number) {
  const el = ev.target as HTMLElement;
  if (el.matches(':focus-visible')) focusCode.value = code;
}

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
    overlay.value = null;
  }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <h1>世界氣候分布</h1>
  <p class="small muted">點地圖上任一處，可以看那裡是什麼氣候；用下方的勾選決定要顯示哪些氣候，也可以疊上風帶與洋流。</p>

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
          <defs>
            <marker id="arrow-warm" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="16" markerHeight="16" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" class="m-warm" />
            </marker>
            <marker id="arrow-cool" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="16" markerHeight="16" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" class="m-cool" />
            </marker>
            <marker id="arrow-wind" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" class="m-wind" />
            </marker>
          </defs>
          <g v-if="layers.winds" class="winds">
            <g
              v-for="b in PRESSURE_BELTS"
              :key="b.id"
              :class="['belt', b.kind, { active: overlay?.id === b.id }]"
              @click.stop="pickOverlay({ kind: 'belt', id: b.id, item: b })"
            >
              <rect x="0" :y="toXY(b.lat + 2, 0).y" :width="W" height="16" />
              <text v-if="layers.labels" :x="W - 8" :y="toXY(b.lat, 0).y + 5" text-anchor="end">{{ b.name }}</text>
            </g>
            <g
              v-for="w in WIND_BELTS"
              :key="w.id"
              :class="['wind', { active: overlay?.id === w.id }]"
              @click.stop="pickOverlay({ kind: 'wind', id: w.id, item: w })"
            >
              <line v-for="a in windArrows(w)" :key="a.key" :x1="a.x1" :y1="a.y1" :x2="a.x2" :y2="a.y2" marker-end="url(#arrow-wind)" />
              <rect x="0" :y="toXY(w.lat + 4, 0).y" :width="W" height="32" class="hit" />
              <text v-if="layers.labels" :x="toXY(0, -178).x" :y="toXY(w.lat, 0).y - 12">{{ w.name }}</text>
            </g>
          </g>
          <g class="currents">
            <g
              v-for="c in shownCurrents"
              :key="c.id"
              :class="['current', c.kind, { active: overlay?.id === c.id }]"
              @click.stop="pickOverlay({ kind: 'current', id: c.id, item: c })"
            >
              <path class="hit" :d="pathD(c.path)" />
              <path class="flow" :d="pathD(c.path)" :marker-end="`url(#arrow-${c.kind})`" />
              <text v-if="layers.labels" :x="labelAt(c.path).x + 10" :y="labelAt(c.path).y - 8">{{ c.name }}</text>
            </g>
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
      <template v-else-if="overlay">
        <div class="info-head">
          <span :class="['layer-key', overlay.kind === 'current' ? overlay.item.kind : overlay.kind]" aria-hidden="true"></span>
          <strong>{{ overlay.item.name }}</strong>
          <span class="small muted">｜{{ overlayKind }}</span>
        </div>
        <p class="small" style="margin: 0 0 6px">{{ overlay.item.note }}</p>
        <p class="small muted note">示意位置（年平均），名稱待依課本核對。</p>
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
      <p v-else class="small muted">點一下地圖上任何地方，看那裡是什麼氣候。</p>
    </div>
  </section>

  <section class="sheet legend" aria-labelledby="legend-title">
    <div class="legend-head">
      <h2 id="legend-title">要顯示的內容</h2>
      <div class="btn-row">
        <button class="btn quiet small" type="button" @click="setAll(true)">全選</button>
        <button class="btn quiet small" type="button" @click="setAll(false)">全不選</button>
      </div>
    </div>
    <fieldset class="layer-group">
      <legend>風帶與洋流</legend>
      <div class="layer-row">
        <label class="legend-item">
          <input v-model="layers.winds" type="checkbox" />
          <span class="layer-key wind" aria-hidden="true"></span>
          <span>風帶與氣壓帶</span>
        </label>
        <label class="legend-item">
          <input v-model="layers.warm" type="checkbox" />
          <span class="layer-key warm" aria-hidden="true"></span>
          <span>暖流</span>
        </label>
        <label class="legend-item">
          <input v-model="layers.cool" type="checkbox" />
          <span class="layer-key cool" aria-hidden="true"></span>
          <span>涼流（含寒流）</span>
        </label>
        <label class="legend-item">
          <input v-model="layers.labels" type="checkbox" />
          <span>顯示名稱</span>
        </label>
      </div>
      <p class="small muted" style="margin: 2px 0 0">點地圖上的洋流或風帶，可以看名稱和說明。</p>
    </fieldset>
    <div v-for="g in grouped" :key="g.id" class="legend-group">
      <div class="group-row">
        <h3>{{ g.label }}</h3>
        <button class="btn quiet small" type="button" @click="onlyGroup(g.id)">只看{{ g.label }}</button>
      </div>
      <ul>
        <li
          v-for="c in g.items"
          :key="c.code"
          @pointerenter="onLegendEnter($event, c.code)"
          @pointerleave="focusCode = null"
        >
          <label class="legend-item" :class="{ off: !visible.has(c.code) }">
            <input
              type="checkbox"
              :checked="visible.has(c.code)"
              @change="toggle(c.code)"
              @focus="onLegendFocus($event, c.code)"
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
.winds .belt rect { fill-opacity: 0.16; cursor: pointer; }
.winds .belt.low rect { fill: #2e6fb7; }
.winds .belt.high rect { fill: #c8372d; }
.winds .belt.active rect { fill-opacity: 0.35; }
.winds .belt text, .winds .wind text, .currents text {
  font-size: 15px; font-weight: 700; paint-order: stroke; stroke: rgba(255, 255, 255, 0.9); stroke-width: 4px; pointer-events: none;
}
.winds .belt.low text { fill: #1f4f87; }
.winds .belt.high text { fill: #8f241c; }
.winds .wind line { stroke: #1b2a38; stroke-width: 2.2; vector-effect: non-scaling-stroke; }
.winds .wind text { fill: #1b2a38; }
.winds .wind .hit { fill: transparent; cursor: pointer; }
.winds .wind.active line { stroke: var(--focus); }
.currents .current { cursor: pointer; }
.currents .hit { fill: none; stroke: transparent; stroke-width: 18; }
.currents .flow { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.currents .warm .flow { stroke: #d62828; }
.currents .cool .flow { stroke: #1d5fbf; stroke-dasharray: 8 5; }
.currents .active .flow { stroke-width: 5; }
.currents .warm text { fill: #9b1c1c; }
.currents .cool text { fill: #163f7a; }
.m-warm { fill: #d62828; }
.m-cool { fill: #1d5fbf; }
.m-wind { fill: #1b2a38; }
.layer-group { margin: 10px 0 4px; padding: 0; border: 0; }
.layer-group legend { font-size: 0.98rem; font-weight: 700; color: var(--ink-soft); margin-bottom: 2px; }
.layer-row { display: grid; grid-template-columns: 1fr; gap: 2px; }
@media (min-width: 560px) {
  .layer-row { grid-template-columns: 1fr 1fr; }
}
.layer-key { display: inline-block; width: 22px; height: 0; border-top: 3px solid; flex: none; }
.layer-key.warm { border-color: #d62828; }
.layer-key.cool { border-color: #1d5fbf; border-top-style: dashed; }
.layer-key.wind { border-color: #1b2a38; }
.layer-key.low { border-color: #2e6fb7; border-top-width: 8px; opacity: 0.5; }
.layer-key.high { border-color: #c8372d; border-top-width: 8px; opacity: 0.5; }
.station-list { list-style: none; padding: 0; margin: 6px 0 0; display: grid; gap: 2px; }
.station-list .btn { justify-content: flex-start; text-align: left; width: 100%; font-weight: 500; }
</style>
