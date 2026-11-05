// 產生題庫原始檔 content/*.json。
// - 分類與用詞：依翰林公開教學資源（翰林雲端學院、八上「全球氣候概述與氣候變遷」公開教案），尚未對照課本頁碼。
// - 月資料：WMO 1991–2020 氣候標準平均值（NOAA NCEI 彙整），原始數值見 content/sources/wmo-normals-1991-2020.json。
// - 解析中的數字由同一份月資料計算；文字依類型判讀條件組成，全部寫入 JSON 供人工審核，
//   執行期不由程式即時推論（規格 §7）。判讀門檻為本專案暫定值，非官方標準。
//
// 用法：npm run content:author

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
const FRAMEWORK = 'hanlin-public-v1';

interface TypeSpec {
  id: string;
  label: string;
  aliases?: string[];
  groupId: string;
  koppen: string[];
  keyFeature: string;
  tempFeature: string;
  precipFeature: string;
  conclusion: string;
  compareHint: string;
  criteria: TypeCriteria;
  compare: Record<string, string>;
}

const TYPES: TypeSpec[] = [
  {
    id: 'tropical-rainforest', label: '熱帶雨林氣候', groupId: 'tropical', koppen: ['Af'],
    keyFeature: '全年高溫多雨，沒有乾季',
    tempFeature: '每個月都在 25°C 以上，折線幾乎是平的，全年高溫、年溫差很小。',
    precipFeature: '每個月的雨量都在 60 mm 以上，沒有乾季，全年多雨。',
    conclusion: '全年高溫、年溫差很小，又全年多雨沒有乾季，判斷為熱帶雨林氣候。',
    compareHint: '綜合比較：全年高溫時，看看有沒有雨量很少的乾季——完全沒有乾季，代表終年濕熱。',
    criteria: {
      temperature: { text: '全年高溫，最冷月 18°C 以上', rules: [{ kind: 'tMin', gte: 18 }] },
      precipitation: { text: '全年多雨沒有乾季（每月 60 mm 以上）', rules: [{ kind: 'pMonthMin', gte: 60 }] },
    },
    compare: {
      'tropical-monsoon': '熱帶季風有 1～3 個月較乾；熱帶雨林每個月都多雨。',
      'tropical-savanna': '熱帶莽原有好幾個月幾乎不下雨；熱帶雨林沒有乾季。',
    },
  },
  {
    id: 'tropical-savanna', label: '熱帶莽原氣候', groupId: 'tropical', koppen: ['Aw', 'As'],
    keyFeature: '全年高溫，乾季與雨季分明',
    tempFeature: '全年高溫，最冷月仍在 18°C 以上。',
    precipFeature: '有好幾個月雨量很少（乾季長），雨季集中在其他月份。',
    conclusion: '全年高溫，乾季長、乾濕季分明，判斷為熱帶莽原氣候。',
    compareHint: '綜合比較：全年高溫且有乾季時，數數看雨量少於 60 mm 的月份有幾個——乾季很長還是很短？',
    criteria: {
      temperature: { text: '全年高溫，最冷月 18°C 以上', rules: [{ kind: 'tMin', gte: 18 }] },
      precipitation: {
        text: '乾季長（至少 4 個月少於 60 mm），年雨量 500 mm 以上',
        rules: [{ kind: 'dryMonths', below: 60, gte: 4 }, { kind: 'pTotal', gte: 500 }],
      },
    },
    compare: {
      'tropical-monsoon': '熱帶季風乾季短（1～3 個月）、年雨量多；熱帶莽原乾季長。',
      'tropical-desert': '熱帶沙漠全年幾乎不下雨；熱帶莽原雨季有明顯降雨。',
    },
  },
  {
    id: 'tropical-monsoon', label: '熱帶季風氣候', groupId: 'tropical', koppen: ['Am'],
    keyFeature: '全年高溫，雨季雨量很大、乾季較短',
    tempFeature: '全年高溫（各月約 25°C 以上），年溫差小。',
    precipFeature: '雨季的長條很高、雨量非常多，只有 1～3 個月比較乾。',
    conclusion: '全年高溫，雨季雨量大、乾季短，判斷為熱帶季風氣候。',
    compareHint: '綜合比較：全年高溫時，看乾季有幾個月，以及全年雨量是否很多。',
    criteria: {
      temperature: { text: '全年高溫，最冷月 18°C 以上', rules: [{ kind: 'tMin', gte: 18 }] },
      precipitation: {
        text: '乾季短（1～3 個月少於 60 mm），年雨量 1500 mm 以上',
        rules: [{ kind: 'dryMonths', below: 60, gte: 1, lte: 3 }, { kind: 'pTotal', gte: 1500 }],
      },
    },
    compare: {
      'tropical-savanna': '熱帶莽原乾季較長（4 個月以上）；熱帶季風乾季短、雨量多。',
      'tropical-rainforest': '熱帶雨林沒有乾季；熱帶季風有 1～3 個月較乾。',
    },
  },
  {
    id: 'tropical-desert', label: '熱帶沙漠氣候', groupId: 'tropical', koppen: ['BWh'],
    keyFeature: '全年炎熱乾燥少雨',
    tempFeature: '全年炎熱，年均溫在 18°C 以上，夏季可達 30°C 以上。',
    precipFeature: '每個月的長條都非常矮，全年幾乎不下雨。',
    conclusion: '全年炎熱、幾乎不下雨，判斷為熱帶沙漠氣候。',
    compareHint: '綜合比較：全年乾燥時，再看冬季冷不冷——年均溫是否在 18°C 以上？',
    criteria: {
      temperature: { text: '全年炎熱，年均溫 18°C 以上', rules: [{ kind: 'tMean', gte: 18 }] },
      precipitation: { text: '全年乾燥少雨，年雨量少於 250 mm', rules: [{ kind: 'pTotal', lt: 250 }] },
    },
    compare: {
      'temperate-desert': '溫帶沙漠冬季寒冷、年均溫低於 18°C；熱帶沙漠全年炎熱。',
      'tropical-savanna': '熱帶莽原雨季有明顯降雨；熱帶沙漠全年幾乎不下雨。',
    },
  },
  {
    id: 'marine-west-coast', label: '溫帶海洋性氣候', aliases: ['溫帶海洋氣候'], groupId: 'temperate', koppen: ['Cfb', 'Cfc'],
    keyFeature: '冬暖夏涼，全年有雨且分布平均',
    tempFeature: '冬季溫和（最冷月 0°C 以上）、夏季涼爽（最熱月低於 22°C）。',
    precipFeature: '每個月都有雨，各月雨量差不多，分布平均。',
    conclusion: '冬暖夏涼、全年有雨且平均，判斷為溫帶海洋性氣候。',
    compareHint: '綜合比較：冬天不冷、夏天不熱時，看看雨量是全年平均，還是集中在某個季節。',
    criteria: {
      temperature: {
        text: '冬暖夏涼：最冷月 0°C 以上、最熱月低於 22°C，年溫差 6°C 以上',
        rules: [{ kind: 'tMin', gte: 0 }, { kind: 'tMax', lt: 22 }, { kind: 'tRange', gte: 6 }],
      },
      precipitation: {
        text: '全年有雨且平均：每月 30 mm 以上，最多雨月不到最少雨月的 3 倍',
        rules: [{ kind: 'pMonthMin', gte: 30 }, { kind: 'maxMinRatio', lt: 3 }],
      },
    },
    compare: {
      continental: '溫帶大陸性冬季低於 0°C、年溫差大；溫帶海洋性冬季溫和。',
      mediterranean: '地中海型夏季幾乎不下雨；溫帶海洋性全年有雨。',
    },
  },
  {
    id: 'continental', label: '溫帶大陸性氣候', aliases: ['溫帶大陸氣候'], groupId: 'temperate', koppen: ['Dfa', 'Dfb'],
    keyFeature: '冬冷夏暖、年溫差大，降水量中等且各月都有',
    tempFeature: '冬季寒冷（最冷月低於 0°C）、夏季溫暖，年溫差大。',
    precipFeature: '每個月都有降水，夏季稍多但沒有集中在夏季。',
    conclusion: '冬冷夏暖、年溫差大，各月都有降水，判斷為溫帶大陸性氣候。',
    compareHint: '綜合比較：冬季低於 0°C 時，看冬季是不是幾乎不下雨，以及夏季有多熱。',
    criteria: {
      temperature: {
        text: '冬季寒冷（最冷月低於 0°C）、夏季溫暖（最熱月 18°C 以上）',
        rules: [{ kind: 'tMin', lt: 0 }, { kind: 'tMax', gte: 18 }],
      },
      precipitation: {
        text: '每月都有降水（10 mm 以上），雨量沒有集中在夏季（夏半年少於 75%）',
        rules: [{ kind: 'pMonthMin', gte: 10 }, { kind: 'summerShare', lt: 0.75 }],
      },
    },
    compare: {
      'temperate-monsoon': '溫帶季風冬季幾乎不下雨、雨量集中在夏季；溫帶大陸性各月都有降水。',
      subarctic: '副極地冬季更冷（低於 −10°C）、夏季短而涼；溫帶大陸性夏季較溫暖。',
      'marine-west-coast': '溫帶海洋性冬季溫和、不低於 0°C。',
    },
  },
  {
    id: 'mediterranean', label: '地中海型氣候', aliases: ['溫帶地中海型氣候'], groupId: 'temperate', koppen: ['Cs'],
    keyFeature: '夏乾冬雨，冬季溫和',
    tempFeature: '冬季溫和（最冷月 0°C 以上），夏季溫暖到炎熱。',
    precipFeature: '夏季的長條非常矮、幾乎不下雨，雨季在冬季。',
    conclusion: '夏乾冬雨、冬季溫和，判斷為地中海型氣候。',
    compareHint: '綜合比較：把氣溫最高的月份和雨量最多的月份對照——它們是同一季，還是剛好相反？',
    criteria: {
      temperature: { text: '冬季溫和，最冷月 0°C 以上', rules: [{ kind: 'tMin', gte: 0 }] },
      precipitation: {
        text: '冬雨夏乾：冬半年雨量占 60% 以上，夏季最乾月少於 30 mm，年雨量 300 mm 以上',
        rules: [{ kind: 'winterShare', gte: 0.6 }, { kind: 'summerDriest', lt: 30 }, { kind: 'pTotal', gte: 300 }],
      },
    },
    compare: {
      'marine-west-coast': '溫帶海洋性夏季也有雨；地中海型夏季幾乎不下雨。',
      'temperate-monsoon': '溫帶季風夏雨冬乾，和地中海型的冬雨夏乾剛好相反。',
      'humid-subtropical': '夏雨型暖溫帶夏季雨多；地中海型夏季幾乎不下雨。',
    },
  },
  {
    id: 'humid-subtropical', label: '夏雨型暖溫帶氣候', groupId: 'temperate', koppen: ['Cfa', 'Cwa'],
    keyFeature: '夏季炎熱多雨、冬季溫和，全年有雨',
    tempFeature: '夏季炎熱（最熱月 22°C 以上），冬季溫和、最冷月仍在 0°C 以上。',
    precipFeature: '全年都有降水，夏半年的雨量較多。',
    conclusion: '夏季炎熱多雨、冬季溫和，全年有雨，判斷為夏雨型暖溫帶氣候。',
    compareHint: '綜合比較：冬季不冷、夏季炎熱時，看雨量較多的季節是夏季還是冬季。',
    criteria: {
      temperature: {
        text: '冬季溫和（最冷月 0～18°C）、夏季炎熱（最熱月 22°C 以上）',
        rules: [{ kind: 'tMin', gte: 0, lt: 18 }, { kind: 'tMax', gte: 22 }],
      },
      precipitation: {
        text: '全年有雨且夏季較多：年雨量 800 mm 以上，夏半年雨量占 55% 以上',
        rules: [{ kind: 'pTotal', gte: 800 }, { kind: 'summerShare', gte: 0.55 }],
      },
    },
    compare: {
      mediterranean: '地中海型冬雨夏乾；夏雨型暖溫帶夏季雨量較多。',
      'temperate-monsoon': '溫帶季風冬季低於 0°C、冬季很乾；夏雨型暖溫帶冬季溫和、全年有雨。',
      'marine-west-coast': '溫帶海洋性夏季涼爽（最熱月低於 22°C）、雨量平均。',
    },
  },
  {
    id: 'temperate-monsoon', label: '溫帶季風氣候', groupId: 'temperate', koppen: ['Dwa', 'Dwb'],
    keyFeature: '夏季高溫多雨、冬季寒冷乾燥（夏雨冬乾）',
    tempFeature: '夏季炎熱、冬季寒冷（最冷月低於 0°C），年溫差大。',
    precipFeature: '雨量集中在夏季，冬季的長條很矮，冬季乾燥。',
    conclusion: '夏季高溫多雨、冬季寒冷乾燥，判斷為溫帶季風氣候。',
    compareHint: '綜合比較：冬季低於 0°C 時，看雨量是否明顯集中在夏季、冬季幾乎不下雨。',
    criteria: {
      temperature: {
        text: '冬季寒冷（最冷月低於 0°C）、夏季炎熱（最熱月 22°C 以上）',
        rules: [{ kind: 'tMin', lt: 0 }, { kind: 'tMax', gte: 22 }],
      },
      precipitation: {
        text: '夏雨冬乾：夏半年雨量占 75% 以上，年雨量 400 mm 以上',
        rules: [{ kind: 'summerShare', gte: 0.75 }, { kind: 'pTotal', gte: 400 }],
      },
    },
    compare: {
      continental: '溫帶大陸性各月都有降水；溫帶季風冬季幾乎不下雨。',
      'temperate-desert': '溫帶沙漠全年乾燥，年雨量不到 250 mm；溫帶季風夏季多雨。',
    },
  },
  {
    id: 'temperate-desert', label: '溫帶沙漠氣候', groupId: 'temperate', koppen: ['BWk'],
    keyFeature: '全年乾燥少雨，冬冷夏熱、年溫差大',
    tempFeature: '冬季寒冷（最冷月低於 0°C）、夏季炎熱，年溫差很大，年均溫低於 18°C。',
    precipFeature: '每個月的長條都很矮，全年乾燥少雨。',
    conclusion: '全年乾燥少雨、冬冷夏熱，判斷為溫帶沙漠氣候。',
    compareHint: '綜合比較：全年乾燥時，看冬季冷不冷——年均溫是否低於 18°C？',
    criteria: {
      temperature: {
        text: '冬冷夏熱：年均溫低於 18°C，最熱月 20°C 以上',
        rules: [{ kind: 'tMean', lt: 18 }, { kind: 'tMax', gte: 20 }],
      },
      precipitation: { text: '全年乾燥少雨，年雨量少於 250 mm', rules: [{ kind: 'pTotal', lt: 250 }] },
    },
    compare: {
      'tropical-desert': '熱帶沙漠全年炎熱、年均溫 18°C 以上；溫帶沙漠冬季寒冷。',
      'temperate-monsoon': '溫帶季風夏季多雨，年雨量明顯較多。',
    },
  },
  {
    id: 'subarctic', label: '副極地氣候', groupId: 'cold', koppen: ['Dfc', 'Dfd', 'Dwc', 'Dwd'],
    keyFeature: '冬季嚴寒漫長，夏季短而涼',
    tempFeature: '冬季非常寒冷（最冷月低於 −10°C），夏季短，最熱月只有 10～18°C。',
    precipFeature: '降水量不多，夏季稍多。',
    conclusion: '冬季嚴寒漫長、夏季短而涼，判斷為副極地氣候。',
    compareHint: '綜合比較：冬季很冷時，看最熱月有多暖——超過 10°C 嗎？有沒有到 18°C？',
    criteria: {
      temperature: {
        text: '冬季嚴寒（最冷月低於 −10°C），夏季短而涼（最熱月 10～18°C）',
        rules: [{ kind: 'tMin', lt: -10 }, { kind: 'tMax', gte: 10, lt: 18 }],
      },
      precipitation: { text: '降水量不多，不是主要判斷依據', rules: [{ kind: 'any' }] },
    },
    compare: {
      polar: '極地氣候最熱月也不到 10°C；副極地夏季會超過 10°C。',
      continental: '溫帶大陸性夏季較暖（18°C 以上），冬季沒有那麼冷。',
    },
  },
  {
    id: 'polar', label: '極地氣候', groupId: 'cold', koppen: ['ET', 'EF'],
    keyFeature: '全年低溫，最熱月也不到 10°C',
    tempFeature: '全年低溫，就算是最熱月也不到 10°C，冬季非常寒冷。',
    precipFeature: '全年雨量很少。',
    conclusion: '全年低溫、最熱月不到 10°C，判斷為極地氣候。',
    compareHint: '綜合比較：看最熱月有沒有超過 10°C。',
    criteria: {
      temperature: { text: '全年低溫，最熱月低於 10°C', rules: [{ kind: 'tMax', lt: 10 }] },
      precipitation: { text: '雨量很少，不是主要判斷依據', rules: [{ kind: 'any' }] },
    },
    compare: {
      subarctic: '副極地夏季最熱月會超過 10°C；極地氣候全年都不到 10°C。',
    },
  },
  {
    id: 'highland', label: '高地氣候', groupId: 'highland', koppen: ['Cwb', 'Cfb', 'Cwc', 'Cfc'],
    keyFeature: '全年涼爽、年溫差很小',
    tempFeature: '全年涼爽，最熱月也不到 20°C，而且各月溫差很小（年溫差 6°C 以內）。',
    precipFeature: '雨量依所在地區而不同；判斷高地氣候主要看氣溫。',
    conclusion: '全年涼爽而且各月溫差很小，判斷為高地氣候。',
    compareHint: '綜合比較：全年溫差很小時，看氣溫是全年炎熱還是全年涼爽。',
    criteria: {
      temperature: {
        text: '全年涼爽、溫差很小：最熱月低於 20°C，年溫差 6°C 以內',
        rules: [{ kind: 'tMax', lt: 20 }, { kind: 'tRange', lt: 6 }],
      },
      precipitation: { text: '雨量依所在地區不同，不是主要判斷依據', rules: [{ kind: 'any' }] },
    },
    compare: {
      'tropical-rainforest': '熱帶雨林也是溫差小，但全年高溫（25°C 以上）；高地氣候全年涼爽。',
      'marine-west-coast': '溫帶海洋性同樣冬暖夏涼，但年溫差較大（6°C 以上）。',
    },
  },
];

interface Station {
  typeId: string;
  station: string;
  /** 中文顯示名稱（作答後與地圖顯示） */
  nameZh: string;
  wigosId: string;
  lat: number;
  lon: number;
  elev: number;
  t: number[];
  p: number[];
  koppenException?: string;
  /** 指定難度（例如只分布在南半球的類型，仍需要入門題） */
  difficulty?: Difficulty[];
}
interface SourceFile {
  dataset: string;
  publisher: string;
  accession: string;
  url: string;
  stations: Station[];
}

const src = JSON.parse(readFileSync(join(root, 'content', 'sources', 'wmo-normals-1991-2020.json'), 'utf8')) as SourceFile;

function hemisphereOf(lat: number): Hemisphere {
  if (Math.abs(lat) < 5) return 'equatorial';
  return lat < 0 ? 'south' : 'north';
}

function slug(s: string): string {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function rainyMonths(p: number[]): number[] {
  const mean = p.reduce((a, b) => a + b, 0) / 12;
  if (Math.max(...p) < mean * 1.4) return []; // 全年分布平均，不標雨季
  return p.map((v, i) => [v, i + 1] as const).filter(([v]) => v >= mean * 1.3 && v >= 30).map(([, m]) => m);
}

/** 第 1 站為入門＋一般；第 2 站一般＋進階；第 3 站進階。南半球資料只出現在進階。 */
function difficultyOf(index: number, hemi: Hemisphere): Difficulty[] {
  if (hemi === 'south') return ['advanced'];
  return index === 0 ? ['beginner', 'standard'] : index === 1 ? ['standard', 'advanced'] : ['standard', 'advanced'];
}

const groups = [
  { id: 'tropical', label: '熱帶' },
  { id: 'temperate', label: '溫帶' },
  { id: 'cold', label: '寒帶' },
  { id: 'highland', label: '高地' },
];

const taxonomy: Taxonomy = {
  frameworks: [{
    id: FRAMEWORK,
    label: '依翰林公開教學資源的分類（暫定）',
    description: '名稱與分組參考翰林雲端學院「世界氣候」等公開頁面及八上「全球氣候概述與氣候變遷」公開教案；尚未對照課本頁碼。',
  }],
  groups,
  types: TYPES.map((s): ClimateType => ({
    id: s.id,
    label: s.label,
    aliases: s.aliases ?? [],
    frameworkId: FRAMEWORK,
    groupId: s.groupId,
    status: 'draft',
    graphIdentifiable: true,
    confusableTypeIds: Object.keys(s.compare),
    overlapTypeIds: [],
    keyFeature: s.keyFeature,
    koppenCodes: s.koppen,
    criteria: s.criteria,
    compareNotes: s.compare,
    curriculumRefs: [],
  })),
};

const datasets: ClimateDataset[] = [];
const explanations: Explanation[] = [];
const index = new Map<string, number>();

for (const st of src.stations) {
  const spec = TYPES.find((t) => t.id === st.typeId);
  if (!spec) throw new Error(`未知類型 ${st.typeId}`);
  const i = index.get(spec.id) ?? 0;
  index.set(spec.id, i + 1);
  const hemi = hemisphereOf(st.lat);
  const id = `wmo-${spec.id}-${slug(st.station.split('/').pop() ?? st.station)}`;
  const temps = st.t;
  const precip = st.p;
  const s = summarize(temps, precip);
  const southNote = hemi === 'south' ? '最熱月出現在 12～2 月前後，表示這是南半球的資料，季節與北半球相反。' : '';

  const reasons: Record<string, string> = {};
  const checks: NonNullable<Explanation['distractorChecks']> = {};
  for (const other of TYPES) {
    if (other.id === spec.id) continue;
    const c = evaluateType(other.criteria, { temperatureC: temps, precipitationMm: precip, hemisphere: hemi });
    if (c.temperature.pass && c.precipitation.pass) continue; // 驗證會再把關
    checks[other.id] = c;
    const failed = [!c.temperature.pass ? '氣溫' : null, !c.precipitation.pass ? '降水' : null].filter(Boolean).join('和');
    reasons[other.id] = `「${other.label}」的${failed}條件不符。`;
  }

  const explId = `${id}-explanation`;
  datasets.push({
    id,
    revision: 1,
    typeId: spec.id,
    temperatureC: temps,
    precipitationMm: precip,
    difficulty: st.difficulty ?? difficultyOf(i, hemi),
    hemisphere: hemi,
    status: 'draft',
    origin: 'observed-normal',
    source: {
      title: `${src.dataset}：${st.station}（${st.wigosId || '無 WIGOS ID'}；緯度 ${st.lat}、經度 ${st.lon}、海拔 ${st.elev} m）`,
      url: src.url,
      period: '1991–2020',
      license: 'NOAA NCEI 公開發布（' + src.accession + '）；原始數值由各國氣象機構提供；本網站非營利教育使用並註明出處',
    },
    review: null,
    location: { name: st.station, nameZh: st.nameZh, lat: st.lat, lon: st.lon, elev: st.elev, ...(st.wigosId ? { wigosId: st.wigosId } : {}) },
    explanationId: explId,
    ...(st.koppenException ? { koppenException: st.koppenException } : {}),
  });
  explanations.push({
    id: explId,
    temperatureEvidence:
      `最熱月是 ${s.maxTempMonth} 月（${fmt1(temps[s.maxTempMonth - 1])}°C），最冷月是 ${s.minTempMonth} 月（${fmt1(temps[s.minTempMonth - 1])}°C），年溫差 ${fmt1(s.range)}°C。${spec.tempFeature}`,
    precipitationEvidence:
      `年降水量約 ${fmt0(s.totalPrecip)} mm；最多是 ${s.maxPrecipMonth} 月（${fmt0(precip[s.maxPrecipMonth - 1])} mm），最少是 ${s.minPrecipMonth} 月（${fmt0(precip[s.minPrecipMonth - 1])} mm）。${spec.precipFeature}`,
    conclusion: `${southNote}${spec.conclusion}`,
    hints: [
      '先看氣溫：找出最熱月和最冷月，最冷月有沒有低於 0°C？兩者相差多少度？',
      '再看雨量：哪幾個月的長條最高、哪幾個月最矮？全年雨量是多、普通還是很少？',
      spec.compareHint,
    ],
    distractorReasons: reasons,
    distractorChecks: checks,
    highlightMonths: { temperature: [s.maxTempMonth, s.minTempMonth], precipitation: rainyMonths(precip) },
  });
}

const curriculum: CurriculumMapping = {
  status: 'draft',
  note: '分類用詞依翰林公開教學資源暫定，尚未對照翰林或其他版本課本的冊別與頁碼；判讀門檻為本專案整理的暫定值。',
  entries: TYPES.map((t) => ({
    typeId: t.id,
    references: [],
    coverage: 'pending',
    reason: '依翰林公開資源列出；教材冊別、頁碼與用語待核對。',
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
