"""產生世界氣候分布網格（#11）。

來源：Rubel, F., Brugger, K., Haslinger, K., & Auer, I. (2017). The climate of the European Alps:
Shift of very high resolution Köppen-Geiger climate zones 1800–2100. Meteorologische Zeitschrift, 26(2),
115–125. doi:10.1127/metz/2016/0816 —— 全球 1986–2010 柯本－蓋格分類，100 弧秒網格，
取自 kgcpy 套件（BSD-3-Clause）內附的 kmz_int_reshape.png。

用法：
  pip download --no-deps kgcpy==1.1.8 -d /tmp/kg && unzip 出 kgcpy/kmz_int_reshape.png
  python3 scripts/map/build_climate_grid.py <kmz_int_reshape.png>

輸出 src/assets/map/climate-grid.png：0.25° 灰階索引圖（1440×576，北緯 84° 到南緯 60°），
像素值為題庫分類代碼（0＝海洋），對照見 src/map/classes.ts。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

KOPPEN = ['', 'Af', 'Am', 'As', 'Aw', 'BSh', 'BSk', 'BWh', 'BWk', 'Cfa', 'Cfb', 'Cfc', 'Csa', 'Csb', 'Csc',
          'Cwa', 'Cwb', 'Cwc', 'Dfa', 'Dfb', 'Dfc', 'Dfd', 'Dsa', 'Dsb', 'Dsc', 'Dsd', 'Dwa', 'Dwb', 'Dwc',
          'Dwd', 'EF', 'ET', 'Ocean']

# 題庫分類代碼（需與 src/map/classes.ts 一致）
C = {
    'tropical-rainforest': 1, 'tropical-savanna': 2, 'tropical-monsoon': 3, 'tropical-desert': 4,
    'marine-west-coast': 5, 'continental': 6, 'mediterranean': 7, 'humid-subtropical': 8,
    'temperate-monsoon': 9, 'temperate-desert': 10, 'subarctic': 11, 'polar': 12, 'highland': 13, 'steppe': 14,
}

FACTOR = 9  # 100 弧秒 × 9 = 0.25°
LAT_TOP, LAT_BOTTOM = 84, -60


def to_class(code: str, lat: float) -> int:
    if code == 'Ocean' or not code:
        return 0
    if code == 'Af':
        return C['tropical-rainforest']
    if code == 'Am':
        return C['tropical-monsoon']
    if code in ('Aw', 'As'):
        return C['tropical-savanna']
    if code == 'BWh':
        return C['tropical-desert']
    if code == 'BWk':
        return C['temperate-desert']
    if code in ('BSh', 'BSk'):
        return C['steppe']
    if code in ('EF', 'ET'):
        # 中低緯度的寒冷氣候是高山（青藏高原、安地斯山、阿爾卑斯山）
        return C['highland'] if abs(lat) < 60 else C['polar']
    if code in ('Cwb', 'Cwc'):
        return C['highland']
    if code in ('Cfb', 'Cfc'):
        return C['highland'] if abs(lat) < 23.5 else C['marine-west-coast']
    if code.startswith('Cs'):
        return C['mediterranean']
    if code in ('Cfa', 'Cwa'):
        return C['humid-subtropical']
    if code in ('Dwa', 'Dwb'):
        return C['temperate-monsoon']
    if code in ('Dfa', 'Dfb', 'Dsa', 'Dsb'):
        return C['continental']
    if code in ('Dfc', 'Dfd', 'Dwc', 'Dwd', 'Dsc', 'Dsd'):
        return C['subarctic']
    raise ValueError(code)


def main(src: str) -> None:
    img = np.asarray(Image.open(src), dtype=np.uint8)  # (6480, 12960)
    h, w = img.shape
    oh, ow = h // FACTOR, w // FACTOR
    blocks = img[: oh * FACTOR, : ow * FACTOR].reshape(oh, FACTOR, ow, FACTOR).transpose(0, 2, 1, 3).reshape(oh, ow, -1)
    # 每格取眾數（海洋過半則為海洋）
    counts = np.zeros((oh, ow, 33), dtype=np.uint16)
    for k in range(1, 33):
        counts[:, :, k] = (blocks == k).sum(axis=2)
    mode = counts.argmax(axis=2)

    lat_centers = 90 - (np.arange(oh) + 0.5) * 180 / oh
    out = np.zeros((oh, ow), dtype=np.uint8)
    table = {}
    for y in range(oh):
        lat = float(lat_centers[y])
        for code_idx in np.unique(mode[y]):
            key = (int(code_idx), lat >= 60 or lat <= -60, abs(lat) < 23.5)
            if key not in table:
                table[key] = to_class(KOPPEN[int(code_idx)], lat)
            out[y][mode[y] == code_idx] = table[key]

    top = int((90 - LAT_TOP) * 4)
    bottom = int((90 - LAT_BOTTOM) * 4)
    crop = out[top:bottom]
    dest = Path(__file__).resolve().parents[2] / 'src' / 'assets' / 'map' / 'climate-grid.png'
    Image.fromarray(crop, mode='L').save(dest, optimize=True)
    print('saved', dest, crop.shape, {k: int((crop == v).sum()) for k, v in C.items()})


if __name__ == '__main__':
    main(sys.argv[1])
