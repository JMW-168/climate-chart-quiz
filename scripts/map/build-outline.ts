// 產生世界海岸線 SVG 路徑（#11）。來源：Natural Earth 1:110m land（公有領域），經 world-atlas 套件（ISC）。
// 投影：等距圓柱，座標系統與 climate-grid.png 相同（每度 4 px，北緯 84° 到南緯 60°）。
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { root } from '../lib/load-content';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/land-110m.json'), 'utf8')) as Topology<{ land: GeometryCollection }>;
const land = feature(topo, topo.objects.land);

const PX = 4; // 每度像素
const LAT_TOP = 84;
const projection = geoEquirectangular()
  .scale((PX * 180) / Math.PI)
  .translate([180 * PX, LAT_TOP * PX])
  .precision(0.1);
const path = geoPath(projection).digits(1)(land) ?? '';

const out = join(root, 'src', 'assets', 'map', 'land-outline.ts');
writeFileSync(
  out,
  `// 自動產生：scripts/map/build-outline.ts。Natural Earth 1:110m land（公有領域）。\nexport const LAND_PATH = ${JSON.stringify(path)};\n`,
);
console.log('land path chars', path.length);
