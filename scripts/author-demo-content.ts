// 產生「開發示範」內容包原始檔 content/*.json。
// 這些是合成教學資料，非真實測站，尚未教材審核；狀態一律為 draft。
// 解析中的數字由同一份月資料計算，文字依類型判讀重點組成，皆寫入 JSON 供人工審核，
// 執行期不由程式即時推論（規格 §7）。
//
// 用法：npx tsx scripts/author-demo-content.ts

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fmt0, fmt1, summarize } from '../src/domain/stats';
import { evaluateType, type TypeCriteria } from '../src/domain/criteria';
import type {
  ClimateDataset,
  ClimateType,
  CurriculumMapping,
  Difficulty,
  Explanation,
  Hemisphere,
  Taxonomy,
} from '../src/domain/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAMEWORK = 'demo-tw-jh-v1';

interface TypeSpec {
  id: string;
  /** 可接受的柯本代碼（交叉檢查用） */
  koppen: string[];
  label: string;
  groupId: string;
  graphIdentifiable: boolean;
  notIdentifiableReason?: string;
  confusable: string[];
  overlap?: string[];
  keyFeature: string;
  tempFeature: string;
  precipFeature: string;
  conclusion: string;
  compareHint: string;
}

const TYPES: TypeSpec[] = [
  {
    id: 'tropical-rainforest', koppen: ['Af'], label: '熱帶雨林氣候', groupId: 'tropical', graphIdentifiable: true,
    confusable: ['tropical-monsoon', 'tropical-savanna', 'subtropical-monsoon'],
    keyFeature: '全年高溫（各月約 25°C 以上）、年溫差很小，而且每個月都多雨、沒有乾季',
    tempFeature: '每個月都在 25°C 以上，折線幾乎是一條平線，全年高溫。',
    precipFeature: '每個月的長條都很高，沒有明顯的乾季，全年多雨。',
    conclusion: '全年高溫、年溫差極小，又全年多雨沒有乾季，判斷為熱帶雨林氣候。',
    compareHint: '綜合比較：全年高溫、年溫差很小時，再確認有沒有乾季——找不到乾季，代表終年濕熱。',
  },
  {
    id: 'tropical-monsoon', koppen: ['Am'], label: '熱帶季風氣候', groupId: 'tropical', graphIdentifiable: true,
    confusable: ['tropical-savanna', 'tropical-rainforest', 'subtropical-monsoon'],
    keyFeature: '全年高溫，雨季降水非常集中且量很大（單月可達數百毫米），另有明顯乾季，年降水量多',
    tempFeature: '全年高溫，最熱月常出現在雨季來臨之前，年溫差不大。',
    precipFeature: '雨季的長條非常高、單月達數百毫米，乾季則雨量很少，乾濕季對比強烈。',
    conclusion: '全年高溫，乾濕季分明且雨季降水量非常大，判斷為熱帶季風氣候。',
    compareHint: '綜合比較：全年高溫且乾濕季分明時，看雨季最多的月份是否達到數百毫米、全年雨量是否很多。',
  },
  {
    id: 'tropical-savanna', koppen: ['Aw', 'As'], label: '熱帶莽原氣候', groupId: 'tropical', graphIdentifiable: true,
    confusable: ['tropical-monsoon', 'tropical-rainforest', 'steppe'],
    keyFeature: '全年高溫，有明顯乾季與雨季，但雨季降水量不如熱帶季風多，年降水量約 1000 mm 上下',
    tempFeature: '全年高溫，各月大致在 20°C 以上，年溫差不大。',
    precipFeature: '一年中有好幾個月幾乎不下雨，雨季集中在高溫季節，但單月雨量多在 250 mm 以下。',
    conclusion: '全年高溫，乾季與雨季分明，雨量中等，判斷為熱帶莽原氣候。',
    compareHint: '綜合比較：全年高溫且乾濕季分明時，看雨季單月雨量與全年總雨量是否只是中等。',
  },
  {
    id: 'desert', koppen: ['BW'], label: '沙漠氣候', groupId: 'dry', graphIdentifiable: true,
    confusable: ['steppe', 'tropical-savanna', 'mediterranean'],
    keyFeature: '全年降水極少（年降水量多在 250 mm 以下），幾乎每個月都接近 0 mm，且夏季氣溫高',
    tempFeature: '夏季氣溫高，年溫差依位置而有差異。',
    precipFeature: '每個月的長條都非常矮，接近 0 mm，全年極度乾燥。',
    conclusion: '全年幾乎不下雨、年降水量極少，夏季炎熱，判斷為沙漠氣候。',
    compareHint: '綜合比較：先判斷是否為乾燥氣候，再看降水是否少到幾乎每個月都接近 0 mm。',
  },
  {
    id: 'steppe', koppen: ['BS'], label: '草原氣候', groupId: 'dry', graphIdentifiable: true,
    confusable: ['desert', 'tropical-savanna', 'continental'],
    keyFeature: '降水偏少（年降水量約 250～500 mm），比沙漠多一些但仍屬乾燥，且夏季溫暖到炎熱（最熱月在 15°C 以上）',
    tempFeature: '夏季溫暖到炎熱。',
    precipFeature: '雨量偏少，多數月份只有數十毫米或更少，但不像沙漠那樣幾乎為零。',
    conclusion: '全年雨量偏少但比沙漠稍多，屬於半乾燥的草原氣候。',
    compareHint: '綜合比較：雨量明顯偏少，但又不是每個月都接近 0 mm——它比最乾的類型稍濕一些。',
  },
  {
    id: 'subtropical-monsoon', koppen: ['Cfa', 'Cwa'], label: '副熱帶季風氣候', groupId: 'warm-temperate', graphIdentifiable: true,
    confusable: ['temperate-monsoon', 'tropical-monsoon', 'mediterranean'],
    overlap: ['humid-subtropical'],
    keyFeature: '夏季高溫多雨、冬季溫和（最冷月仍在 0°C 以上），全年都有降水而以夏季較多',
    tempFeature: '夏季高溫，冬季溫和、最冷月仍在 0°C 以上，有明顯的季節變化。',
    precipFeature: '全年都有降水，夏季雨量明顯較多。',
    conclusion: '夏季高溫多雨、冬季溫和不結冰，判斷為副熱帶季風氣候。',
    compareHint: '綜合比較：冬季沒有低於 0°C、夏季又熱又多雨，而且全年都有雨。',
  },
  {
    id: 'humid-subtropical', koppen: ['Cfa', 'Cwa'], label: '夏雨型暖溫帶氣候', groupId: 'warm-temperate', graphIdentifiable: true,
    confusable: ['mediterranean', 'marine-west-coast', 'temperate-monsoon'],
    overlap: ['subtropical-monsoon'],
    keyFeature: '夏季炎熱、冬季溫和（最冷月在 0°C 以上），全年有雨且夏季雨量較多',
    tempFeature: '夏季炎熱，冬季溫和、最冷月在 0°C 以上。',
    precipFeature: '全年都有降水，夏半年的雨量較多。',
    conclusion: '夏熱冬溫、全年有雨且夏季較多，判斷為夏雨型暖溫帶氣候。',
    compareHint: '綜合比較：冬季溫和、夏季炎熱，再看雨量較多的季節是夏季還是冬季。',
  },
  {
    id: 'temperate-monsoon', koppen: ['Dw'], label: '溫帶季風氣候', groupId: 'warm-temperate', graphIdentifiable: true,
    confusable: ['continental', 'subtropical-monsoon', 'humid-subtropical'],
    keyFeature: '夏季高溫多雨、冬季寒冷（最冷月低於 0°C）且乾燥，降水集中在夏季',
    tempFeature: '夏季高溫、冬季寒冷，最冷月低於 0°C，年溫差大。',
    precipFeature: '降水集中在夏季，冬季的長條很矮，冬季乾燥。',
    conclusion: '冬季寒冷乾燥、夏季高溫多雨，判斷為溫帶季風氣候。',
    compareHint: '綜合比較：冬季低於 0°C，再看降水是否明顯集中在夏季、冬季幾乎不下雨。',
  },
  {
    id: 'mediterranean', koppen: ['Cs'], label: '地中海型氣候', groupId: 'temperate', graphIdentifiable: true,
    confusable: ['humid-subtropical', 'marine-west-coast', 'steppe'],
    keyFeature: '夏季乾燥少雨、冬季溫和多雨，雨季出現在冬半年',
    tempFeature: '夏季溫暖到炎熱，冬季溫和，最冷月仍在 0°C 以上。',
    precipFeature: '高溫的月份雨量很少，低溫的月份雨量較多，雨季出現在冬半年。',
    conclusion: '夏乾冬雨、冬季溫和，判斷為地中海型氣候。',
    compareHint: '綜合比較：把氣溫最高的月份和雨量最多的月份對照，它們是同一季，還是剛好相反？',
  },
  {
    id: 'marine-west-coast', koppen: ['Cfb', 'Cfc'], label: '溫帶海洋性氣候', groupId: 'temperate', graphIdentifiable: true,
    confusable: ['continental', 'mediterranean', 'humid-subtropical'],
    keyFeature: '冬季溫和、夏季涼爽（最熱月多在 22°C 以下），年溫差小，全年都有雨且分布平均',
    tempFeature: '冬季溫和不嚴寒，夏季涼爽，最熱月在 22°C 以下，年溫差小。',
    precipFeature: '每個月都有降水，各月雨量差異不大，分布平均。',
    conclusion: '冬暖夏涼、年溫差小，全年有雨且平均，判斷為溫帶海洋性氣候。',
    compareHint: '綜合比較：冬天不冷、夏天不熱，雨量每個月都差不多。',
  },
  {
    id: 'continental', koppen: ['Df'], label: '溫帶大陸性氣候', groupId: 'temperate', graphIdentifiable: true,
    confusable: ['temperate-monsoon', 'marine-west-coast', 'tundra'],
    keyFeature: '冬季寒冷（最冷月遠低於 0°C）、夏季溫暖、年溫差大，年降水量約 500～700 mm，各月都有降水、夏季稍多',
    tempFeature: '冬季寒冷、最冷月遠低於 0°C，夏季溫暖，年溫差大。',
    precipFeature: '降水量中等，每個月都有雨，夏季稍多但不像季風氣候那樣集中。',
    conclusion: '冬冷夏暖、年溫差大，降水中等且各月都有，判斷為溫帶大陸性氣候。',
    compareHint: '綜合比較：冬季嚴寒、年溫差大，但雨量並沒有集中在夏季，冬季仍有雨雪。',
  },
  {
    id: 'tundra', koppen: ['ET'], label: '苔原氣候', groupId: 'cold', graphIdentifiable: true,
    confusable: ['ice-cap', 'continental'],
    keyFeature: '全年低溫，最熱月只有 0～10°C，其餘多數月份在 0°C 以下',
    tempFeature: '只有夏季少數月份略高於 0°C，最熱月也不到 10°C，其餘月份都在 0°C 以下。',
    precipFeature: '降水量少，多集中在較暖的月份。',
    conclusion: '全年低溫、最熱月介於 0～10°C，判斷為苔原氣候。',
    compareHint: '綜合比較：數一數有幾個月高於 0°C，最熱月有沒有超過 10°C。',
  },
  {
    id: 'ice-cap', koppen: ['EF'], label: '冰原氣候', groupId: 'cold', graphIdentifiable: true,
    confusable: ['tundra', 'continental'],
    keyFeature: '每個月的月均溫都在 0°C 以下，終年嚴寒',
    tempFeature: '十二個月的月均溫全部低於 0°C，終年嚴寒。',
    precipFeature: '降水量很少。',
    conclusion: '每個月都低於 0°C、終年嚴寒，判斷為冰原氣候。',
    compareHint: '綜合比較：是不是十二個月都低於 0°C？',
  },
  {
    id: 'highland', koppen: [], label: '高地氣候', groupId: 'highland', graphIdentifiable: false,
    notIdentifiableReason: '高地氣候隨海拔與所在緯度變化，單張氣候圖常與其他類型相似，須搭配地形與位置判斷；v1 列為教學比較，不單獨命題。',
    confusable: [],
    keyFeature: '氣溫隨海拔升高而降低，圖形依所在緯度而不同',
    tempFeature: '', precipFeature: '', conclusion: '', compareHint: '',
  },
];


// ── 結構化判讀條件（#2）：示範用門檻，待依康軒教材審核 ──
const CRITERIA: Record<string, TypeCriteria> = {
  'tropical-rainforest': {
    temperature: { text: '全年高溫，最冷月 18°C 以上', rules: [{ kind: 'tMin', gte: 18 }] },
    precipitation: { text: '每個月都多雨（每月 60 mm 以上，沒有乾季）', rules: [{ kind: 'pMonthMin', gte: 60 }] },
  },
  'tropical-monsoon': {
    temperature: { text: '全年高溫，最冷月 18°C 以上', rules: [{ kind: 'tMin', gte: 18 }] },
    precipitation: {
      text: '有乾季（有月份少於 60 mm），但雨季雨量很大、年雨量 1500 mm 以上',
      rules: [{ kind: 'dryMonths', below: 60, gte: 1 }, { kind: 'pTotal', gte: 1500 }],
    },
  },
  'tropical-savanna': {
    temperature: { text: '全年高溫，最冷月 18°C 以上', rules: [{ kind: 'tMin', gte: 18 }] },
    precipitation: {
      text: '乾季明顯（至少 3 個月少於 60 mm），雨季有一定雨量，年雨量約 500～1500 mm',
      rules: [{ kind: 'dryMonths', below: 60, gte: 3 }, { kind: 'pTotal', gte: 500, lt: 1500 }],
    },
  },
  desert: {
    temperature: { text: '夏季炎熱，最熱月 20°C 以上', rules: [{ kind: 'tMax', gte: 20 }] },
    precipitation: { text: '全年極乾，年雨量少於 250 mm', rules: [{ kind: 'pTotal', lt: 250 }] },
  },
  steppe: {
    temperature: { text: '夏季溫暖，最熱月 15°C 以上', rules: [{ kind: 'tMax', gte: 15 }] },
    precipitation: { text: '偏乾，年雨量約 250～500 mm', rules: [{ kind: 'pTotal', gte: 250, lt: 500 }] },
  },
  'subtropical-monsoon': {
    temperature: {
      text: '冬季溫和（最冷月 0～18°C）、夏季炎熱（最熱月 22°C 以上）',
      rules: [{ kind: 'tMin', gte: 0, lt: 18 }, { kind: 'tMax', gte: 22 }],
    },
    precipitation: {
      text: '雨量多（年雨量 1000 mm 以上），夏半年雨量較多（占 55% 以上）',
      rules: [{ kind: 'pTotal', gte: 1000 }, { kind: 'summerShare', gte: 0.55 }],
    },
  },
  'humid-subtropical': {
    temperature: {
      text: '冬季溫和（最冷月 0～18°C）、夏季炎熱（最熱月 22°C 以上）',
      rules: [{ kind: 'tMin', gte: 0, lt: 18 }, { kind: 'tMax', gte: 22 }],
    },
    precipitation: {
      text: '全年有雨（年雨量 800 mm 以上），夏半年雨量較多（占 55% 以上）',
      rules: [{ kind: 'pTotal', gte: 800 }, { kind: 'summerShare', gte: 0.55 }],
    },
  },
  'temperate-monsoon': {
    temperature: {
      text: '冬季寒冷（最冷月低於 0°C）、夏季炎熱（最熱月 22°C 以上）',
      rules: [{ kind: 'tMin', lt: 0 }, { kind: 'tMax', gte: 22 }],
    },
    precipitation: { text: '雨量集中在夏季（夏半年占 75% 以上），冬季乾燥', rules: [{ kind: 'summerShare', gte: 0.75 }] },
  },
  mediterranean: {
    temperature: { text: '冬季溫和，最冷月 0°C 以上', rules: [{ kind: 'tMin', gte: 0 }] },
    precipitation: {
      text: '冬雨夏乾：冬半年雨量占 60% 以上，夏季最乾月少於 30 mm，年雨量 300 mm 以上',
      rules: [{ kind: 'winterShare', gte: 0.6 }, { kind: 'summerDriest', lt: 30 }, { kind: 'pTotal', gte: 300 }],
    },
  },
  'marine-west-coast': {
    temperature: {
      text: '冬暖夏涼：最冷月 0°C 以上、最熱月低於 22°C',
      rules: [{ kind: 'tMin', gte: 0 }, { kind: 'tMax', lt: 22 }],
    },
    precipitation: {
      text: '全年有雨且平均：每月 30 mm 以上，最多雨月不到最少雨月的 3 倍',
      rules: [{ kind: 'pMonthMin', gte: 30 }, { kind: 'maxMinRatio', lt: 3 }],
    },
  },
  continental: {
    temperature: {
      text: '冬季寒冷（最冷月低於 0°C）、夏季溫暖（最熱月 10°C 以上）',
      rules: [{ kind: 'tMin', lt: 0 }, { kind: 'tMax', gte: 10 }],
    },
    precipitation: {
      text: '每月都有降水（10 mm 以上），雨量不會集中在夏季（夏半年少於 75%）',
      rules: [{ kind: 'pMonthMin', gte: 10 }, { kind: 'summerShare', lt: 0.75 }],
    },
  },
  tundra: {
    temperature: { text: '全年低溫，最熱月只有 0～10°C', rules: [{ kind: 'tMax', gte: 0, lt: 10 }] },
    precipitation: { text: '降水量少，不是主要判斷依據', rules: [{ kind: 'any' }] },
  },
  'ice-cap': {
    temperature: { text: '每個月都低於 0°C（最熱月低於 0°C）', rules: [{ kind: 'tMax', lt: 0 }] },
    precipitation: { text: '降水量極少，不是主要判斷依據', rules: [{ kind: 'any' }] },
  },
};

// 和容易混淆類型的分辨方法（#3 總複習用）
const COMPARE: Record<string, Record<string, string>> = {
  'tropical-rainforest': {
    'tropical-monsoon': '熱帶雨林每個月都多雨；熱帶季風有明顯乾季。',
    'tropical-savanna': '熱帶莽原有好幾個月幾乎不下雨，雨林沒有乾季。',
  },
  'tropical-monsoon': {
    'tropical-savanna': '兩者都有乾濕季；熱帶季風雨季雨量大得多，年雨量通常超過 1500 mm。',
    'tropical-rainforest': '熱帶雨林沒有乾季；熱帶季風乾季月份雨量很少。',
  },
  'tropical-savanna': {
    'tropical-monsoon': '莽原雨季雨量中等、年雨量較少；熱帶季風雨季雨量非常大。',
    steppe: '草原年雨量更少，而且不一定全年高溫。',
  },
  desert: {
    steppe: '沙漠年雨量少於 250 mm；草原稍多，約 250～500 mm。',
    'ice-cap': '冰原雨量也很少，但每個月都低於 0°C；沙漠夏季炎熱。',
  },
  steppe: {
    desert: '草原比沙漠稍濕，年雨量約 250～500 mm。',
    continental: '溫帶大陸性雨量較多（約 500 mm 以上），每月都有降水。',
  },
  'subtropical-monsoon': {
    'temperate-monsoon': '副熱帶季風冬季溫和、不低於 0°C；溫帶季風冬季寒冷。',
    mediterranean: '副熱帶季風夏季多雨；地中海型夏季乾燥、冬季下雨。',
  },
  'humid-subtropical': {
    mediterranean: '夏雨型暖溫帶夏季雨多；地中海型夏乾冬雨。',
    'marine-west-coast': '溫帶海洋性夏季涼爽（最熱月低於 22°C），雨量平均。',
  },
  'temperate-monsoon': {
    continental: '溫帶季風降水集中在夏季、冬季很乾；溫帶大陸性各月都有降水。',
    'subtropical-monsoon': '溫帶季風冬季低於 0°C；副熱帶季風冬季溫和。',
  },
  mediterranean: {
    'humid-subtropical': '把最熱月和最多雨月對照：地中海型剛好相反（夏乾冬雨）。',
    'marine-west-coast': '溫帶海洋性夏季也有雨，地中海型夏季幾乎不下雨。',
  },
  'marine-west-coast': {
    continental: '溫帶海洋性冬季不低於 0°C、年溫差小；溫帶大陸性冬季嚴寒。',
    mediterranean: '溫帶海洋性全年有雨；地中海型夏季乾燥。',
  },
  continental: {
    'temperate-monsoon': '溫帶大陸性各月都有降水；溫帶季風冬季幾乎不下雨。',
    'marine-west-coast': '溫帶大陸性冬季遠低於 0°C，年溫差大。',
  },
  tundra: {
    'ice-cap': '苔原夏季有幾個月高於 0°C；冰原每個月都低於 0°C。',
    continental: '溫帶大陸性最熱月在 10°C 以上；苔原最熱月不到 10°C。',
  },
  'ice-cap': {
    tundra: '冰原十二個月都低於 0°C；苔原夏季會略高於 0°C。',
  },
};

type Raw = [string, Hemisphere, Difficulty[], number[], number[]];

// 合成教學資料：形狀依各類型典型特徵設計，數值非真實測站。
const DATA: Record<string, Raw[]> = {
  'tropical-rainforest': [
    ['a', 'equatorial', ['beginner', 'standard'], [26.5, 26.8, 27.2, 27.5, 27.6, 27.3, 27.0, 27.1, 27.2, 27.1, 26.9, 26.6], [240, 190, 220, 260, 230, 180, 170, 190, 200, 230, 250, 270]],
    ['b', 'equatorial', ['standard', 'advanced'], [27.0, 27.4, 27.6, 27.8, 27.5, 27.0, 26.8, 26.9, 27.0, 27.2, 27.1, 26.9], [180, 150, 200, 280, 300, 210, 190, 170, 180, 230, 260, 220]],
    ['c', 'equatorial', ['advanced'], [25.8, 26.0, 26.3, 26.5, 26.4, 26.0, 25.7, 25.9, 26.1, 26.3, 26.2, 25.9], [310, 280, 330, 290, 220, 160, 150, 170, 190, 240, 280, 330]],
  ],
  'tropical-monsoon': [
    ['a', 'north', ['beginner', 'standard'], [25.0, 26.5, 28.5, 30.0, 29.5, 27.5, 27.0, 27.0, 27.3, 27.5, 26.5, 25.0], [5, 5, 15, 60, 300, 520, 580, 560, 380, 200, 40, 8]],
    ['b', 'north', ['standard', 'advanced'], [24.0, 25.5, 28.0, 30.5, 30.0, 28.0, 27.5, 27.4, 27.6, 27.0, 25.8, 24.2], [8, 12, 25, 80, 260, 480, 520, 500, 340, 160, 30, 6]],
    // #1 修正：原資料乾季過長、年雨量不足，柯本為 Aw（莽原）；改為雨季更長更多雨
    ['c', 'south', ['advanced'], [28.5, 28.3, 28.2, 27.8, 26.5, 25.0, 24.8, 25.6, 27.5, 29.0, 29.5, 29.0], [520, 480, 420, 180, 60, 25, 20, 30, 60, 120, 220, 380]],
  ],
  'tropical-savanna': [
    ['a', 'north', ['beginner', 'standard'], [24, 25, 27, 29, 30, 29, 27, 27, 27, 27, 26, 24], [2, 3, 10, 35, 90, 160, 220, 240, 170, 60, 10, 3]],
    ['b', 'north', ['standard', 'advanced'], [26, 27, 28, 29, 28, 26, 25, 25, 26, 27, 27, 26], [5, 10, 30, 70, 130, 170, 200, 210, 160, 80, 20, 5]],
    ['c', 'south', ['advanced'], [27, 27, 26.5, 26, 24.5, 23, 22.5, 24, 26, 27.5, 28, 27.5], [220, 200, 170, 60, 10, 2, 1, 3, 15, 60, 130, 200]],
  ],
  desert: [
    ['a', 'north', ['beginner', 'standard'], [14, 16, 20, 25, 29, 32, 33, 33, 30, 25, 19, 15], [3, 2, 2, 1, 0, 0, 0, 0, 0, 1, 2, 4]],
    ['b', 'north', ['standard', 'advanced'], [20, 22, 25, 29, 32, 34, 34, 34, 32, 29, 25, 21], [5, 4, 3, 1, 0, 0, 0, 0, 0, 1, 3, 6]],
    ['c', 'south', ['advanced'], [27, 26, 24, 20, 16, 13, 12, 14, 17, 21, 24, 26], [8, 10, 6, 4, 3, 2, 2, 2, 2, 3, 4, 6]],
  ],
  steppe: [
    ['a', 'north', ['beginner', 'standard'], [-18, -14, -5, 4, 12, 17, 19, 17, 11, 2, -8, -16], [3, 3, 5, 12, 22, 48, 75, 65, 28, 10, 5, 4]],
    // #1 修正：原資料高溫蒸發大，335 mm 在柯本屬沙漠（BWh）；改為較溫和的半乾燥草原
    ['b', 'north', ['standard', 'advanced'], [14, 16, 20, 24, 27, 29, 29, 28, 26, 23, 18, 15], [2, 3, 5, 10, 25, 60, 120, 120, 55, 15, 3, 2]],
    ['c', 'south', ['advanced'], [24, 24, 22, 18, 14, 11, 10, 12, 15, 18, 21, 23], [40, 45, 40, 30, 25, 20, 18, 20, 22, 30, 35, 40]],
  ],
  'subtropical-monsoon': [
    ['a', 'north', ['beginner', 'standard'], [16, 16.5, 18.5, 22, 25, 27.5, 29.5, 29, 27.5, 24.5, 21.5, 17.5], [85, 170, 180, 180, 235, 320, 240, 320, 360, 150, 85, 80]],
    ['b', 'north', ['standard', 'advanced'], [8, 10, 14, 19, 24, 27, 30, 29.5, 26, 21, 15, 10], [70, 85, 130, 140, 170, 240, 150, 160, 120, 70, 55, 40]],
    ['c', 'north', ['standard', 'advanced'], [13, 14, 17, 21, 25, 27.5, 29, 28.5, 27, 23.5, 19, 15], [40, 60, 90, 170, 280, 350, 250, 330, 200, 60, 40, 30]],
  ],
  'humid-subtropical': [
    ['a', 'north', ['beginner', 'standard'], [7, 9, 13, 18, 22, 26, 28, 27.5, 24.5, 19, 13, 8.5], [80, 85, 100, 95, 110, 140, 160, 150, 120, 80, 75, 80]],
    ['b', 'south', ['advanced'], [27, 26.5, 25, 21.5, 18, 15, 14.5, 16, 18.5, 21.5, 24, 26], [180, 170, 150, 100, 75, 65, 60, 55, 50, 90, 115, 150]],
    ['c', 'south', ['advanced'], [26, 25.5, 24, 21, 17.5, 14.5, 13.5, 15, 17.5, 20.5, 23, 25], [140, 135, 120, 85, 70, 55, 50, 50, 55, 85, 105, 130]],
  ],
  'temperate-monsoon': [
    ['a', 'north', ['beginner', 'standard'], [-4, -1.5, 5, 13.5, 20, 24.5, 26.5, 25.5, 20.5, 13, 4.5, -2], [3, 5, 10, 25, 35, 80, 180, 160, 50, 25, 10, 3]],
    ['b', 'north', ['standard', 'advanced'], [-12, -8, 0, 9, 16, 21, 24, 22, 16, 8, -2, -10], [5, 6, 15, 30, 55, 95, 160, 140, 65, 30, 15, 8]],
    ['c', 'north', ['standard', 'advanced'], [-2.5, 0, 5, 12, 17.5, 22, 25.5, 26.5, 22, 15.5, 8, 1], [20, 25, 45, 75, 95, 135, 370, 270, 140, 50, 35, 20]],
  ],
  mediterranean: [
    ['a', 'north', ['beginner', 'standard'], [10, 11, 13, 15.5, 19, 23, 26, 26, 23.5, 19.5, 15, 11.5], [90, 85, 60, 40, 20, 8, 2, 5, 25, 70, 100, 110]],
    ['b', 'north', ['standard', 'advanced'], [11, 12, 13.5, 15, 17, 19, 21, 21.5, 20.5, 18, 14, 11.5], [105, 95, 80, 40, 15, 3, 0, 1, 7, 30, 70, 100]],
    ['c', 'south', ['advanced'], [22, 22.5, 21, 18, 15, 13, 12, 13, 14.5, 17, 19, 21], [12, 15, 18, 45, 90, 110, 95, 80, 50, 35, 20, 15]],
  ],
  'marine-west-coast': [
    ['a', 'north', ['beginner', 'standard'], [5, 5.5, 7.5, 9.5, 13, 16, 18, 17.5, 15, 11.5, 8, 5.5], [80, 60, 65, 55, 60, 55, 50, 60, 65, 80, 85, 85]],
    ['b', 'north', ['standard', 'advanced'], [3, 4, 6.5, 9.5, 13, 16, 17.5, 17, 14.5, 10.5, 6.5, 3.5], [65, 50, 60, 55, 60, 65, 75, 70, 65, 75, 80, 75]],
    ['c', 'south', ['advanced'], [16, 16, 14.5, 12, 9.5, 7, 6.5, 7.5, 9, 11, 13, 15], [70, 65, 80, 95, 110, 115, 120, 110, 95, 90, 80, 80]],
  ],
  continental: [
    ['a', 'north', ['beginner', 'standard'], [-10, -9, -4, 5, 13, 17, 19, 17, 11, 5, -2, -7], [35, 30, 30, 35, 50, 70, 85, 75, 55, 50, 45, 40]],
    ['b', 'north', ['standard', 'advanced'], [-16, -14, -6, 4, 12, 18, 20, 18, 11, 3, -7, -14], [30, 25, 28, 35, 50, 68, 80, 70, 50, 42, 36, 32]],
    ['c', 'north', ['standard', 'advanced'], [-6, -4, 1, 9, 15, 19, 21, 20, 15, 9, 2, -3], [40, 35, 35, 40, 55, 65, 70, 65, 50, 45, 45, 45]],
  ],
  tundra: [
    ['a', 'north', ['beginner', 'standard'], [-28, -28, -25, -17, -6, 2, 6, 5, 0, -9, -19, -25], [8, 7, 8, 8, 10, 15, 25, 28, 18, 15, 10, 8]],
    ['b', 'north', ['standard', 'advanced'], [-20, -21, -18, -11, -3, 3, 7, 6.5, 2, -5, -12, -17], [15, 13, 14, 13, 14, 22, 35, 40, 30, 25, 18, 16]],
    ['c', 'north', ['standard', 'advanced'], [-15, -16, -14, -9, -2, 3, 6, 5.5, 2, -4, -9, -13], [30, 28, 25, 22, 20, 25, 35, 40, 40, 40, 35, 32]],
  ],
  'ice-cap': [
    ['a', 'north', ['beginner', 'standard'], [-35, -37, -36, -30, -20, -12, -9, -11, -19, -28, -33, -34], [5, 5, 5, 5, 5, 5, 6, 7, 8, 8, 6, 5]],
    ['b', 'south', ['advanced'], [-1, -5, -10, -14, -16, -17, -18, -19, -18, -14, -7, -2], [10, 12, 15, 15, 15, 15, 15, 15, 15, 12, 10, 8]],
    ['c', 'south', ['advanced'], [-28, -34, -38, -39, -39, -39, -39, -39, -38, -35, -30, -27], [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]],
  ],
};

function rainyMonths(p: number[]): number[] {
  const mean = p.reduce((a, b) => a + b, 0) / 12;
  if (Math.max(...p) < mean * 1.4) return []; // 全年分布平均，不標雨季
  return p.map((v, i) => [v, i + 1] as const).filter(([v]) => v >= mean * 1.3 && v >= 30).map(([, m]) => m);
}

const taxonomy: Taxonomy = {
  frameworks: [{
    id: FRAMEWORK,
    label: '示範分類框架（待三版教材核對）',
    description: '依規格 §3 候選清單建立的開發用分類，名稱與層級尚未對照課綱原文及出版社教材。',
  }],
  groups: [
    { id: 'tropical', label: '熱帶' },
    { id: 'dry', label: '乾燥' },
    { id: 'warm-temperate', label: '季風與暖溫帶' },
    { id: 'temperate', label: '其他溫帶' },
    { id: 'cold', label: '寒冷地區' },
    { id: 'highland', label: '高地' },
  ],
  types: TYPES.map((s): ClimateType => ({
    id: s.id,
    label: s.label,
    aliases: [],
    frameworkId: FRAMEWORK,
    groupId: s.groupId,
    status: 'draft',
    graphIdentifiable: s.graphIdentifiable,
    ...(s.notIdentifiableReason ? { notIdentifiableReason: s.notIdentifiableReason } : {}),
    confusableTypeIds: s.confusable,
    overlapTypeIds: s.overlap ?? [],
    keyFeature: s.keyFeature,
    koppenCodes: s.koppen,
    ...(CRITERIA[s.id] ? { criteria: CRITERIA[s.id] } : {}),
    ...(COMPARE[s.id] ? { compareNotes: COMPARE[s.id] } : {}),
    curriculumRefs: [],
  })),
};

const datasets: ClimateDataset[] = [];
const explanations: Explanation[] = [];
const identifiable = TYPES.filter((t) => t.graphIdentifiable);

for (const spec of identifiable) {
  for (const [suffix, hemi, diff, temps, precip] of DATA[spec.id]) {
    const id = `demo-${spec.id}-${suffix}`;
    const s = summarize(temps, precip);
    const southNote = hemi === 'south' ? '最熱月出現在 12～2 月前後，表示這是南半球的資料，季節與北半球相反。' : '';
    const explId = `${id}-explanation`;
    const reasons: Record<string, string> = {};
    const checks: NonNullable<Explanation['distractorChecks']> = {};
    for (const other of identifiable) {
      if (other.id === spec.id || (spec.overlap ?? []).includes(other.id)) continue;
      const c = evaluateType(CRITERIA[other.id], { temperatureC: temps, precipitationMm: precip, hemisphere: hemi });
      // 兩項都符合代表此圖也可能是該類型 → 不當作錯誤選項（驗證會再把關）
      if (c.temperature.pass && c.precipitation.pass) continue;
      checks[other.id] = c;
      const failed = [!c.temperature.pass ? '氣溫' : null, !c.precipitation.pass ? '降水' : null].filter(Boolean).join('和');
      reasons[other.id] = `「${other.label}」的${failed}條件不符。`;
    }
    datasets.push({
      id,
      revision: 1,
      typeId: spec.id,
      temperatureC: temps,
      precipitationMm: precip,
      difficulty: diff,
      hemisphere: hemi,
      status: 'draft',
      origin: 'teaching-synthetic',
      source: { title: '開發示例，非真實測站', license: '本專案自建教學數據' },
      review: null,
      explanationId: explId,
    });
    explanations.push({
      id: explId,
      temperatureEvidence:
        `最熱月是 ${s.maxTempMonth} 月（${fmt1(temps[s.maxTempMonth - 1])}°C），最冷月是 ${s.minTempMonth} 月（${fmt1(temps[s.minTempMonth - 1])}°C），年溫差 ${fmt1(s.range)}°C。${spec.tempFeature}`,
      precipitationEvidence:
        `年降水量約 ${fmt0(s.totalPrecip)} mm；最多是 ${s.maxPrecipMonth} 月（${fmt0(precip[s.maxPrecipMonth - 1])} mm），最少是 ${s.minPrecipMonth} 月（${fmt0(precip[s.minPrecipMonth - 1])} mm）。${spec.precipFeature}`,
      conclusion: `${southNote}${spec.conclusion}`,
      hints: [
        `先看氣溫：找出最熱月和最冷月，最冷月有沒有低於 0°C？兩者相差多少度？`,
        `再看雨量：哪幾個月的長條最高、哪幾個月最矮？全年雨量是多、普通還是很少？`,
        spec.compareHint,
      ],
      distractorReasons: reasons,
      distractorChecks: checks,
      highlightMonths: {
        temperature: [s.maxTempMonth, s.minTempMonth],
        precipitation: rainyMonths(precip),
      },
    });
  }
}

const curriculum: CurriculumMapping = {
  status: 'draft',
  note: '示範矩陣：尚未對照課綱原文與現行三版教材的冊別、頁碼；正式發布前須補齊（規格 §3、§17）。',
  entries: TYPES.map((t) => ({
    typeId: t.id,
    references: [],
    coverage: t.graphIdentifiable ? 'pending' : 'teaching-only',
    reason: t.graphIdentifiable
      ? '示範資料可出題；教材出處、名稱用語與分類層級待核對。'
      : t.notIdentifiableReason ?? '',
    reviewer: null,
    reviewedAt: null,
  })),
};

const outDir = join(root, 'content');
mkdirSync(outDir, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(join(outDir, name), JSON.stringify(data, null, 2) + '\n');
write('taxonomy.json', taxonomy);
write('datasets.json', datasets);
write('explanations.json', explanations);
write('curriculum-mapping.json', curriculum);
console.log(`已產生 ${taxonomy.types.length} 個類型、${datasets.length} 組資料、${explanations.length} 份解析`);
