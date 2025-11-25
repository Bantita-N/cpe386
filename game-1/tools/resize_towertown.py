#!/usr/bin/env python3
"""
Resize img/TowerTown.png and save as img/TowerTown_small.png.
Usage:
  python tools/resize_towertown.py [scale]
  scale can be a float (0.5) or percentage (50%)
Examples:
  python tools/resize_towertown.py 0.5
  python tools/resize_towertown.py 25%
If no scale provided, defaults to 0.5 (50%).
"""
import sys
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(__file__))
INPUT = os.path.join(ROOT, 'img', 'TowerTown.png')
OUTPUT = os.path.join(ROOT, 'img', 'TowerTown_small.png')

def parse_scale(arg):
    try:
        if isinstance(arg, str) and arg.endswith('%'):
            pct = float(arg[:-1])
            return max(0.01, pct / 100.0)
        return float(arg)
    except Exception:
        return None


def main():
    if not os.path.exists(INPUT):
        print('Input image not found:', INPUT)
        return 1

    scale = 0.5
    method = 'lanczos'
    if len(sys.argv) > 1:
        s = parse_scale(sys.argv[1])
        if s:
            scale = s
    if len(sys.argv) > 2:
        m = sys.argv[2].lower()
        if m in ('nearest', 'nearestneighbor', 'nearest-neighbor'):
            method = 'nearest'
        elif m in ('lanczos', 'lanc'):
            method = 'lanczos'
        elif m in ('bilinear', 'bil'):
            method = 'bilinear'

    resample_map = {
        'lanczos': Image.LANCZOS,
        'nearest': Image.NEAREST,
        'bilinear': Image.BILINEAR
    }
    resample = resample_map.get(method, Image.LANCZOS)
    with Image.open(INPUT) as im:
        w, h = im.size
        new_w = max(1, int(w * scale))
        new_h = max(1, int(h * scale))
        resized = im.resize((new_w, new_h), resample)
        # save as PNG
        resized.save(OUTPUT, optimize=True)
        print(f'Saved resized image: {OUTPUT} ({w}x{h} -> {new_w}x{new_h}, scale={scale}, method={method})')
    return 0

if __name__ == '__main__':
    sys.exit(main())
