// 世界氣候分布圖的分類（#11）。code 與 scripts/map/build_climate_grid.py 一致。
// typeId 對應題庫類型；草原（BS）題庫未列，typeId 為 null。

export interface MapClass {
  code: number;
  typeId: string | null;
  label: string;
  color: string;
  group: 'tropical' | 'temperate' | 'cold' | 'highland' | 'other';
  note?: string;
}

export const MAP_CLASSES: MapClass[] = [
  { code: 1, typeId: 'tropical-rainforest', label: '熱帶雨林氣候', color: '#0b6e4f', group: 'tropical' },
  { code: 3, typeId: 'tropical-monsoon', label: '熱帶季風氣候', color: '#3fa34d', group: 'tropical' },
  { code: 2, typeId: 'tropical-savanna', label: '熱帶莽原氣候', color: '#a7c957', group: 'tropical' },
  { code: 4, typeId: 'tropical-desert', label: '熱帶沙漠氣候', color: '#e07a2f', group: 'tropical' },
  { code: 8, typeId: 'humid-subtropical', label: '夏雨型暖溫帶氣候', color: '#f28fb0', group: 'temperate',
    note: '依柯本 Cfa／Cwa 標示，包含東亞季風區；臺灣課本可能另稱「副熱帶季風氣候」，請以課本為準。' },
  { code: 7, typeId: 'mediterranean', label: '地中海型氣候', color: '#d64550', group: 'temperate' },
  { code: 5, typeId: 'marine-west-coast', label: '溫帶海洋性氣候', color: '#5aa9e6', group: 'temperate' },
  { code: 6, typeId: 'continental', label: '溫帶大陸性氣候', color: '#3a6ea5', group: 'temperate' },
  { code: 9, typeId: 'temperate-monsoon', label: '溫帶季風氣候', color: '#7b5ea7', group: 'temperate' },
  { code: 10, typeId: 'temperate-desert', label: '溫帶沙漠氣候', color: '#f4b860', group: 'temperate' },
  { code: 11, typeId: 'subarctic', label: '副極地氣候', color: '#6fc3c9', group: 'cold' },
  { code: 12, typeId: 'polar', label: '極地氣候', color: '#c9d3dc', group: 'cold' },
  { code: 13, typeId: 'highland', label: '高地氣候', color: '#8d6e63', group: 'highland',
    note: '以柯本分類近似：中低緯度的寒冷氣候與熱帶高山的溫和氣候。' },
  { code: 14, typeId: null, label: '半乾燥草原（題庫未列）', color: '#efe0a2', group: 'other',
    note: '翰林分類未單獨列出草原；這些地區介於沙漠與濕潤氣候之間，請以課本說明為準。' },
];

export const MAP_GROUPS: { id: MapClass['group']; label: string }[] = [
  { id: 'tropical', label: '熱帶' },
  { id: 'temperate', label: '溫帶' },
  { id: 'cold', label: '寒帶' },
  { id: 'highland', label: '高地' },
  { id: 'other', label: '其他' },
];

/** 網格與外框共用座標：每度 4 px，北緯 84° 到南緯 60° */
export const MAP_GRID = { width: 1440, height: 576, pxPerDeg: 4, latTop: 84, latBottom: -60 };

export function toXY(lat: number, lon: number): { x: number; y: number } {
  return { x: (lon + 180) * MAP_GRID.pxPerDeg, y: (MAP_GRID.latTop - lat) * MAP_GRID.pxPerDeg };
}

export function toLatLon(x: number, y: number): { lat: number; lon: number } {
  return { lon: x / MAP_GRID.pxPerDeg - 180, lat: MAP_GRID.latTop - y / MAP_GRID.pxPerDeg };
}

export function formatLatLon(lat: number, lon: number): string {
  const la = Math.abs(lat) < 0.5 ? '赤道附近' : `${lat > 0 ? '北緯' : '南緯'} ${Math.abs(lat).toFixed(0)}°`;
  const lo = `${lon >= 0 ? '東經' : '西經'} ${Math.abs(lon).toFixed(0)}°`;
  return `${la}、${lo}`;
}
