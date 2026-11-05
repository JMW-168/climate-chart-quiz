<script setup lang="ts">
// 成因學習頁：風帶季移（#17）。副熱帶高壓帶與盛行西風隨季節南北移動，
// 造成地中海型「夏乾冬雨」；同緯度大陸東岸受季風影響「夏雨冬乾」。
import { computed, onBeforeUnmount, ref } from 'vue';
import BeltShiftMap from '../components/BeltShiftMap.vue';
import ClimateChart from '../components/ClimateChart.vue';
import { computeScale } from '../domain/stats';
import sources from '../../content/sources/explainer-stations.json';
import { useAppStore } from '../stores/app';

const app = useAppStore();
type Season = 'jan' | 'jul';
const season = ref<Season>('jul');
const playing = ref(false);
let timer: number | undefined;
function setSeason(s: Season) {
  stop();
  season.value = s;
}
function play() {
  if (playing.value) return stop();
  playing.value = true;
  season.value = season.value === 'jan' ? 'jul' : 'jan';
  timer = window.setInterval(() => (season.value = season.value === 'jan' ? 'jul' : 'jan'), 2600);
}
function stop() {
  playing.value = false;
  if (timer) window.clearInterval(timer);
  timer = undefined;
}
onBeforeUnmount(stop);

const month = computed(() => (season.value === 'jan' ? 1 : 7));
const marks = computed(() => ({ temperature: [month.value], precipitation: [month.value] }));
const markLabels = computed(() => ({ [month.value]: `${month.value} 月` }));

const cadiz = computed(() => app.pkg?.datasets.find((d) => d.id === 'wmo-mediterranean-cadiz-obs') ?? null);
const hk = sources.stations.find((s) => s.id === 'hong-kong')!;
const sh = sources.stations.find((s) => s.id === 'shanghai')!;
const hkScale = computeScale([{ temperatureC: hk.t, precipitationMm: hk.p }]);
const pairScale = computed(() =>
  computeScale([
    { temperatureC: sh.t, precipitationMm: sh.p },
    ...(cadiz.value ? [cadiz.value] : []),
  ]),
);

// 小測驗（不計分）
interface Quiz {
  q: string;
  options: { text: string; ok: boolean; why: string }[];
}
const QUIZ: Quiz[] = [
  {
    q: '7 月時副熱帶高壓帶北移，籠罩在加的斯上空。加的斯的天氣比較可能是？',
    options: [
      { text: '晴朗乾燥、很少下雨', ok: true, why: '高壓帶的空氣下沉，不容易形成雲雨。' },
      { text: '午後常有對流雨', ok: false, why: '對流雨是赤道低壓帶空氣上升造成的，不是高壓帶。' },
      { text: '寒冷、經常下雪', ok: false, why: '7 月是北半球夏季，加的斯的月均溫約 25°C。' },
      { text: '吹潮濕的夏季風、大雨不斷', ok: false, why: '那是大陸東岸（例如上海、香港）的情況。' },
    ],
  },
  {
    q: '1 月時，加的斯為什麼會下雨？',
    options: [
      { text: '副熱帶高壓帶南移，盛行西風從大西洋帶來水氣', ok: true, why: '冬季高壓帶離開，西風帶著海洋水氣上岸。' },
      { text: '赤道低壓帶北移到加的斯', ok: false, why: '1 月赤道低壓帶在赤道附近，反而偏南。' },
      { text: '吹來自內陸的乾冷季風', ok: false, why: '來自內陸的季風是乾的，不會帶來雨。' },
      { text: '副熱帶高壓帶的下沉氣流增強', ok: false, why: '下沉氣流會讓天氣乾燥，不會下雨。' },
    ],
  },
  {
    q: '上海和加的斯緯度差不多，為什麼上海夏季反而雨比較多？',
    options: [
      { text: '夏季吹來自海洋的季風，把水氣送到大陸東岸', ok: true, why: '大陸東岸夏季吹海洋來的季風，位在海洋高壓的西側，氣流潮濕。' },
      { text: '夏季上海被副熱帶高壓帶的下沉氣流籠罩', ok: false, why: '下沉氣流會讓天氣乾燥；這是大陸西岸夏季的情況。' },
      { text: '夏季盛行西風從亞洲內陸吹來', ok: false, why: '從內陸吹來的風是乾的，而且夏季東亞吹的是海洋來的季風。' },
      { text: '外海有涼流經過', ok: false, why: '涼流會讓沿岸乾燥少雨，上海外海也不是涼流。' },
    ],
  },
];
const answers = ref<(number | null)[]>(QUIZ.map(() => null));
</script>

<template>
  <h1>成因：風帶季移</h1>
  <p>
    太陽直射的位置一年中會在南、北回歸線之間移動，氣壓帶和風帶也跟著<strong>夏季北移、冬季南移</strong>（以北半球來說）。
    位在兩個氣壓帶交界附近的地方，一年中會輪流受到不同氣壓帶或風帶影響，所以有明顯的乾季和雨季。
  </p>

  <section class="sheet">
    <div class="season-row" role="group" aria-label="切換季節">
      <button class="btn" type="button" :aria-pressed="season === 'jan'" @click="setSeason('jan')">1 月（北半球冬季）</button>
      <button class="btn" type="button" :aria-pressed="season === 'jul'" @click="setSeason('jul')">7 月（北半球夏季）</button>
      <button class="btn quiet" type="button" :aria-pressed="playing" @click="play">{{ playing ? '停止' : '自動切換' }}</button>
    </div>
    <div class="map-scroll">
      <BeltShiftMap :season="season" />
    </div>
    <p class="small muted scroll-hint">手機可以左右滑動地圖。</p>
    <ul class="key small">
      <li><span class="sw high"></span>高壓（空氣下沉、乾燥）</li>
      <li><span class="sw low"></span>低壓（空氣上升、多雨）</li>
      <li><span class="ln wet"></span>潮濕的風</li>
      <li><span class="ln dry"></span>乾燥的風</li>
    </ul>
    <p class="now" aria-live="polite">
      <template v-if="season === 'jul'">
        <strong>7 月：</strong>副熱帶高壓帶北移，大西洋上的高壓籠罩伊比利半島南部，加的斯晴朗乾燥；亞洲大陸受熱形成低壓，東亞吹來自海洋的潮濕夏季風，上海、香港多雨。
      </template>
      <template v-else>
        <strong>1 月：</strong>副熱帶高壓帶南移，加的斯改受盛行西風影響，大西洋的水氣帶來雨水；亞洲大陸冷卻形成西伯利亞高壓，東亞吹乾冷的冬季風，上海、香港少雨。
      </template>
    </p>
    <p class="small muted">示意圖：氣壓帶與高壓中心的位置為季節平均的簡化示意，名稱與說法待依課本核對。</p>
  </section>

  <section class="sheet" aria-labelledby="med-title">
    <h2 id="med-title">大陸西岸：地中海型氣候（夏乾冬雨）</h2>
    <div class="case">
      <div>
        <ClimateChart
          v-if="cadiz"
          :temperature-c="cadiz.temperatureC"
          :precipitation-mm="cadiz.precipitationMm"
          :scale="computeScale([cadiz])"
          label="加的斯氣候圖"
          :highlights="marks"
          :mark-labels="markLabels"
          :show-table="false"
        />
        <p class="small muted">西班牙 加的斯（北緯 36.5°）｜WMO 1991–2020 平均</p>
      </div>
      <dl class="evidence">
        <div class="t" :class="{ on: season === 'jul' }">
          <dt>夏季（6～8 月）</dt>
          <dd>副熱帶高壓帶北移籠罩，空氣下沉、不易成雲，7 月雨量幾乎是 0 mm。</dd>
        </div>
        <div class="p" :class="{ on: season === 'jan' }">
          <dt>冬季（11～2 月）</dt>
          <dd>高壓帶南移，改受盛行西風影響，西風從大西洋帶來水氣，每月雨量 50～90 mm。</dd>
        </div>
      </dl>
    </div>
  </section>

  <section class="sheet" aria-labelledby="mon-title">
    <h2 id="mon-title">大陸東岸：副熱帶季風氣候（夏雨冬乾）</h2>
    <div class="case">
      <div>
        <ClimateChart
          :temperature-c="hk.t"
          :precipitation-mm="hk.p"
          :scale="hkScale"
          label="香港氣候圖"
          :highlights="marks"
          :mark-labels="markLabels"
          :show-table="false"
        />
        <p class="small muted">香港（北緯 22.3°）｜WMO 1991–2020 平均｜說明用，不在題庫</p>
      </div>
      <dl class="evidence">
        <div class="t" :class="{ on: season === 'jul' }">
          <dt>夏季</dt>
          <dd>亞洲大陸受熱形成低壓，海洋上的副熱帶高壓把潮濕空氣往大陸送，吹來自海洋的夏季風，雨量最多的 6 月超過 490 mm。</dd>
        </div>
        <div class="p" :class="{ on: season === 'jan' }">
          <dt>冬季</dt>
          <dd>亞洲大陸冷卻形成西伯利亞高壓，吹來自大陸的乾冷冬季風，12～1 月每月雨量只有約 30 mm。</dd>
        </div>
      </dl>
    </div>
  </section>

  <section class="sheet" aria-labelledby="cmp-title">
    <h2 id="cmp-title">同緯度，西岸和東岸為什麼相反？</h2>
    <div class="pair">
      <div>
        <ClimateChart
          v-if="cadiz"
          compact
          :temperature-c="cadiz.temperatureC"
          :precipitation-mm="cadiz.precipitationMm"
          :scale="pairScale"
          label="加的斯"
          :show-table="false"
        />
        <p class="small center">西岸：加的斯（36.5°N）</p>
      </div>
      <div>
        <ClimateChart compact :temperature-c="sh.t" :precipitation-mm="sh.p" :scale="pairScale" label="上海" :show-table="false" />
        <p class="small center">東岸：上海（31.4°N）</p>
      </div>
    </div>
    <div class="table-wrap">
      <table class="data cmp">
        <thead>
          <tr><th scope="col"></th><th scope="col">大陸西岸（地中海型）</th><th scope="col">大陸東岸（季風）</th></tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">夏季</th>
            <td>位在海洋高壓的東側，吹下沉的北風，<strong>乾燥</strong></td>
            <td>位在海洋高壓的西側，吹來自海洋的夏季風，<strong>多雨</strong></td>
          </tr>
          <tr>
            <th scope="row">冬季</th>
            <td>高壓帶南移，盛行西風帶來海洋水氣，<strong>多雨</strong></td>
            <td>吹來自大陸的乾冷冬季風，<strong>少雨</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="small muted">同樣受副熱帶高壓影響，但高壓中心多在海洋上：大陸西岸在它下沉、乾燥的一側，大陸東岸則在把海洋水氣往陸地送的一側，再加上季風，結果剛好相反。</p>
  </section>

  <section class="sheet" aria-labelledby="quiz-title">
    <h2 id="quiz-title">想一想（不計分）</h2>
    <ol class="quiz">
      <li v-for="(item, qi) in QUIZ" :key="qi">
        <p class="qq">{{ item.q }}</p>
        <div class="options" role="radiogroup" :aria-label="`第 ${qi + 1} 題`">
          <label
            v-for="(o, oi) in item.options"
            :key="oi"
            class="option"
            :class="{
              selected: answers[qi] === oi,
              'is-correct': answers[qi] !== null && o.ok,
              'is-wrong': answers[qi] === oi && !o.ok,
            }"
          >
            <input type="radio" :name="`belt-q${qi}`" :checked="answers[qi] === oi" @change="answers[qi] = oi" />
            <span class="mark" aria-hidden="true">{{ answers[qi] !== null && o.ok ? '✓' : answers[qi] === oi ? '✗' : 'ABCD'[oi] }}</span>
            <span>{{ o.text }}</span>
          </label>
        </div>
        <p v-if="answers[qi] !== null" class="feedback" :class="item.options[answers[qi]!].ok ? 'ok' : 'bad'" aria-live="polite">
          {{ item.options[answers[qi]!].ok ? '✓ 答對了：' : '✗ 再想想：' }}{{ item.options[answers[qi]!].why }}
        </p>
      </li>
    </ol>
  </section>

  <section class="sheet small">
    <h2>還有哪些氣候和季移有關？</h2>
    <p>
      熱帶莽原氣候也是季移的結果：夏季赤道低壓帶移來，帶來雨季；冬季副熱帶高壓帶移來，形成乾季。
      可以到<RouterLink to="/review#review-tropical-savanna">總複習</RouterLink>看代表圖，或在<RouterLink to="/map">世界氣候分布圖</RouterLink>打開「風帶與氣壓帶」圖層。
    </p>
    <p class="muted" style="margin: 0">本頁為延伸學習內容，用語與說法待依課本核對；氣候數據來源見<RouterLink to="/sources">資料來源</RouterLink>。</p>
  </section>
</template>

<style scoped>
.season-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.season-row .btn[aria-pressed='true'] { background: var(--navy); color: #fff; }
.key { list-style: none; padding: 0; margin: 8px 0; display: flex; flex-wrap: wrap; gap: 4px 14px; color: var(--ink-soft); }
.key li { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 18px; height: 12px; border-radius: 3px; display: inline-block; }
.sw.high { background: rgba(200, 55, 45, 0.3); border: 1px dashed #8f241c; }
.sw.low { background: rgba(46, 111, 183, 0.3); border: 1px dashed #1f4f87; }
.ln { width: 22px; height: 0; border-top: 4px solid; display: inline-block; }
.ln.wet { border-color: #1d5fbf; }
.ln.dry { border-color: #b5651d; }
.map-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 6px; }
.map-scroll :deep(.belt-map) { min-width: 640px; }
.scroll-hint { display: none; margin: 4px 0 0; }
@media (max-width: 680px) {
  .scroll-hint { display: block; }
}
.now { background: #eef3f8; border-radius: var(--radius-s); padding: 10px 12px; margin: 8px 0; }
.case { display: grid; gap: 14px; }
@media (min-width: 680px) {
  .case { grid-template-columns: 1.15fr 1fr; align-items: start; }
}
.case .evidence div { transition: background 0.4s; border-radius: 0 6px 6px 0; }
.case .evidence div.on { background: #fff7d6; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.center { text-align: center; margin: 4px 0 0; }
.table-wrap { overflow-x: auto; margin-top: 10px; }
.cmp td, .cmp th { text-align: left; vertical-align: top; }
.quiz { padding-left: 1.3em; margin: 0; }
.quiz > li { margin-bottom: 18px; }
.qq { font-weight: 700; margin-bottom: 8px; }
.feedback { margin: 8px 0 0; padding: 8px 10px; border-radius: var(--radius-s); }
.feedback.ok { background: var(--ok-bg); color: var(--ok); }
.feedback.bad { background: var(--bad-bg); color: var(--bad); }
</style>
