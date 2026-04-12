#!/usr/bin/env python3
"""Download all product images from Squarespace CDN to public/products/"""

import urllib.request
import os

DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'products')
os.makedirs(DEST, exist_ok=True)

BASE = 'https://images.squarespace-cdn.com/content/v1/6977c149e6a06b672ff85de5/'

IMAGES = [
    ('bac-water.jpg',           BASE + 'ed4765d6-a381-485b-94bf-b5e819fd24b6/Bacteriostatic-Water-30ml.webp'),
    ('wolverine-blend.jpg',     BASE + 'ba8fa534-9427-46b7-8ae5-97ea9cff55ba/Forge_Wolverinejpg.jpg'),
    ('glow-blend.jpg',          BASE + 'e9c39d64-50ed-4b57-ac86-60704af70c56/IMG_0048.png'),
    ('cjc1295.jpg',             BASE + '9a261a56-6b82-445e-94b5-4cfc6f642278/Forge_CJC-1295.jpg'),
    ('mots-c.jpg',              BASE + '7a9cafd3-af0c-49a4-9b4a-7d66c338b049/Forge_Mots-C.jpg'),
    ('ghk-cu.jpg',              BASE + 'a127baba-e74f-4be1-85f6-5afbd7c8f73b/IMG_0050.JPG'),
    ('slu-pp-332.jpg',          BASE + 'd3786f62-260c-4009-adf3-886fd049b356/IMG_0057.JPG'),
    ('5-amino-1mq.jpg',         BASE + '7848e6e0-dc32-430a-bf5d-85f70bcf20ec/IMG_0045.JPG'),
    ('tesamorelin.jpg',         BASE + '69e25ff0-7c56-4285-8491-4c5040f405cd/Forge_Tesamorelin.jpg'),
    ('ipamorelin.jpg',          BASE + 'f0bb4c6e-d470-42b5-9550-8dc59474593c/Forge_Ipamorelin.jpg'),
    ('klow-blend.jpg',          BASE + '60c8c21c-8cf8-4aaa-9f70-caaf794f186f/IMG_0055.jpg'),
    ('thymosin-alpha-1.jpg',    BASE + '13d01662-cf1f-4563-a896-08376f4ba351/IMG_0058.JPG'),
    ('bpc-157.jpg',             BASE + '7733d0d7-5cad-46b1-ac7d-7f32ec1542da/IMG_0031.JPG'),
    ('tb-500.jpg',              BASE + 'e18a6709-8ce2-48c2-b17c-af85f3dc5dc7/IMG_0032.JPG'),
    ('epithalon.jpg',           BASE + 'b230a45d-8924-48c7-bb74-5ed173e3e725/IMG_0039.JPG'),
    ('pinealon.jpg',            BASE + 'c72b2a22-e705-4f16-9aea-4d4439c7a0db/IMG_0038.JPG'),
    ('5-amino-1mq-capsules.jpg',BASE + '4d8b8189-58cb-475e-a08d-49a3349a73c4/IMG_0060.jpeg'),
    ('bpc-157-tablets.jpg',     BASE + '07e82a3b-e5e0-422a-93ca-a4443571b07d/7cd31ad7-5b58-442f-b860-982ca4c92e5e.jpg'),
    ('hgh-191aa.jpg',           BASE + '40925528-44f5-48d8-ae5b-3af5b9ea4589/IMG_0054.JPG'),
]

headers = {
    'Referer': 'https://www.forgeamino.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

for filename, url in IMAGES:
    dest_path = os.path.join(DEST, filename)
    if os.path.exists(dest_path):
        print(f'Skipping {filename} (already exists)')
        continue
    print(f'Downloading {filename}...', end=' ', flush=True)
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp, open(dest_path, 'wb') as f:
            f.write(resp.read())
        size = os.path.getsize(dest_path)
        print(f'OK ({size:,} bytes)')
    except Exception as e:
        print(f'FAILED: {e}')

total = len([f for f in os.listdir(DEST) if not f.startswith('.')])
print(f'\nDone. {total}/19 images in {DEST}')
