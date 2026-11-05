// 風帶、氣壓帶與洋流示意圖層（#13）。
// 依公開地理常識自行描繪的簡化示意路線（年平均位置），不是精確觀測資料；名稱待依課本核對。

export type CurrentKind = 'warm' | 'cool';

export interface OceanCurrent {
  id: string;
  name: string;
  kind: CurrentKind;
  /** 依流動方向排列的 [緯度, 經度] */
  path: [number, number][];
  note: string;
}

export const CURRENTS: OceanCurrent[] = [
  // ── 暖流 ──
  { id: 'gulf-stream', name: '墨西哥灣流', kind: 'warm', path: [[25, -80], [30, -79.5], [35, -75], [38, -69], [40, -60], [41, -50]],
    note: '由低緯度流向高緯度的暖流，沿北美東岸北上，再接北大西洋暖流。' },
  { id: 'north-atlantic-drift', name: '北大西洋暖流', kind: 'warm', path: [[43, -45], [47, -35], [51, -25], [55, -15], [60, -5], [65, 5], [70, 15]],
    note: '把溫暖的海水帶到西歐與北歐外海，配合盛行西風，使西歐冬季比同緯度地區溫和。' },
  { id: 'kuroshio', name: '黑潮', kind: 'warm', path: [[18, 123], [23, 123], [27, 127], [31, 132], [34, 138], [36, 144]],
    note: '流經臺灣東部與日本南方的暖流，帶來溫暖的海水。' },
  { id: 'north-pacific', name: '北太平洋暖流', kind: 'warm', path: [[37, 146], [40, 160], [42, 175], [43, -170], [45, -155], [46, -140]],
    note: '黑潮向東延伸，橫越北太平洋。' },
  { id: 'alaska', name: '阿拉斯加暖流', kind: 'warm', path: [[48, -134], [53, -136], [57, -140], [59, -147], [58, -155]],
    note: '沿北美西北岸北上，使沿岸冬季較溫和、多雨。' },
  { id: 'brazil', name: '巴西暖流', kind: 'warm', path: [[-6, -34], [-12, -36.5], [-20, -39], [-27, -45], [-34, -51], [-40, -54]],
    note: '沿南美東岸南下的暖流。' },
  { id: 'mozambique', name: '莫三比克暖流', kind: 'warm', path: [[-11, 43], [-17, 40.5], [-23, 37], [-29, 33], [-34, 28]],
    note: '沿非洲東南岸南下的暖流。' },
  { id: 'east-australian', name: '東澳暖流', kind: 'warm', path: [[-14, 156], [-20, 155], [-26, 154.5], [-32, 153.5], [-38, 151.5]],
    note: '沿澳洲東岸南下的暖流。' },
  // ── 涼流（含寒流）──
  { id: 'labrador', name: '拉布拉多寒流', kind: 'cool', path: [[64, -60], [59, -58], [54, -54], [49, -51], [44, -50]],
    note: '由北極海南下的寒流，與墨西哥灣流交會處形成大漁場。' },
  { id: 'oyashio', name: '親潮（千島寒流）', kind: 'cool', path: [[56, 162], [51, 157], [46, 151], [42, 146]],
    note: '由北方南下的寒流，與黑潮交會於日本東北外海。' },
  { id: 'canary', name: '加那利涼流', kind: 'cool', path: [[43, -13], [37, -13], [31, -13.5], [25, -17], [19, -19], [14, -19]],
    note: '沿非洲西北岸南下，使沿岸空氣下冷上暖、不易降雨，與撒哈拉沙漠西岸的乾燥有關。' },
  { id: 'california', name: '加利福尼亞涼流', kind: 'cool', path: [[47, -127], [41, -127], [36, -124.5], [30, -119], [24, -115]],
    note: '沿北美西岸南下的涼流，沿岸夏季涼爽、少雨。' },
  { id: 'peru', name: '秘魯涼流', kind: 'cool', path: [[-46, -78], [-38, -76.5], [-30, -74], [-22, -73], [-14, -78], [-6, -83]],
    note: '沿南美西岸北上的涼流，沿岸不易降雨，形成濱海沙漠。' },
  { id: 'benguela', name: '本格拉涼流', kind: 'cool', path: [[-35, 17], [-30, 15], [-24, 13], [-18, 11], [-12, 11]],
    note: '沿非洲西南岸北上的涼流，與沿岸沙漠的形成有關。' },
  { id: 'west-australian', name: '西澳涼流', kind: 'cool', path: [[-36, 113], [-30, 112], [-24, 112], [-18, 113]],
    note: '沿澳洲西岸北上的涼流。' },
  { id: 'west-wind-drift', name: '西風漂流', kind: 'cool', path: [[-48, -60], [-50, -30], [-49, 0], [-47, 30], [-47, 60], [-48, 90], [-49, 120], [-51, 150], [-53, 180], [-53, -150], [-52, -110], [-52, -80]],
    note: '在南半球盛行西風吹送下，環繞南極洲向東流動的涼流。' },
];

export interface PressureBelt {
  id: string;
  name: string;
  lat: number;
  kind: 'low' | 'high';
  note: string;
}

export const PRESSURE_BELTS: PressureBelt[] = [
  { id: 'subpolar-low-n', name: '副極地低壓帶', lat: 60, kind: 'low', note: '盛行西風與極地東風在此交會，氣流上升，多雲雨。' },
  { id: 'subtropical-high-n', name: '副熱帶高壓帶', lat: 30, kind: 'high', note: '氣流下沉，天氣晴朗乾燥，許多沙漠分布在附近。' },
  { id: 'equatorial-low', name: '赤道低壓帶', lat: 0, kind: 'low', note: '終年高溫、空氣受熱上升，多對流雨。' },
  { id: 'subtropical-high-s', name: '副熱帶高壓帶', lat: -30, kind: 'high', note: '氣流下沉，天氣晴朗乾燥，許多沙漠分布在附近。' },
  { id: 'subpolar-low-s', name: '副極地低壓帶', lat: -60, kind: 'low', note: '盛行西風與極地東風在此交會，氣流上升，多雲雨。' },
];

export interface WindBelt {
  id: string;
  name: string;
  /** 箭頭所在緯度 */
  lat: number;
  /** 風吹去的方向（角度，0＝向東、90＝向北） */
  heading: number;
  note: string;
}

export const WIND_BELTS: WindBelt[] = [
  { id: 'polar-easterlies-n', name: '極地東風', lat: 72, heading: 210, note: '由極地高壓吹向副極地低壓的冷風。' },
  { id: 'westerlies-n', name: '盛行西風', lat: 45, heading: 30, note: '北半球吹西南風，常把海洋的水氣帶到大陸西岸（例如西歐）。' },
  { id: 'ne-trades', name: '東北信風', lat: 15, heading: 210, note: '由副熱帶高壓吹向赤道低壓，風向穩定。' },
  { id: 'se-trades', name: '東南信風', lat: -15, heading: 150, note: '南半球由副熱帶高壓吹向赤道低壓的風，吹向大陸東岸時帶來水氣。' },
  { id: 'westerlies-s', name: '盛行西風', lat: -45, heading: -30, note: '南半球吹西北風，終年吹送，使南緯 40～60 度海域風浪大。' },
];

export const WIND_ARROW_LONS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180];

/** 經度跨越 ±180° 時切段，避免線條橫跨整張地圖 */
export function splitDateline(path: [number, number][]): [number, number][][] {
  const out: [number, number][][] = [[]];
  for (let i = 0; i < path.length; i++) {
    const cur = path[i];
    const prev = path[i - 1];
    if (prev && Math.abs(cur[1] - prev[1]) > 180) out.push([]);
    out[out.length - 1].push(cur);
  }
  return out.filter((s) => s.length > 1);
}
