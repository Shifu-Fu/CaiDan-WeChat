# -*- coding: utf-8 -*-
"""修复真机 WebP 白图：192 张 WebP -> JPG(320px/q65)，并同步改写 dishes.js 路径。"""
import os, re, json, io
from PIL import Image

BASE = r"C:\Users\Administrator\WorkBuddy\2026-11-16-15-43-55\menu-miniprogram"
IMG_DIR = os.path.join(BASE, 'assets', 'images')
DISHES_JS = os.path.join(BASE, 'data', 'dishes.js')

W, Q = 320, 65
converted = 0
total_bytes = 0

# 1. 逐张 WebP -> JPG
for f in sorted(os.listdir(IMG_DIR)):
    if not f.lower().endswith('.webp'):
        continue
    src = os.path.join(IMG_DIR, f)
    im = Image.open(src).convert('RGB')
    if im.width > W:
        im = im.resize((W, int(im.height * W / im.width)), Image.LANCZOS)
    jpg_name = os.path.splitext(f)[0] + '.jpg'
    out = os.path.join(IMG_DIR, jpg_name)
    im.save(out, 'JPEG', quality=Q, optimize=True, progressive=True)
    total_bytes += os.path.getsize(out)
    converted += 1
    os.remove(src)  # 删除 webp，避免包体积翻倍

# 2. 改写 dishes.js 里的 .webp -> .jpg
raw = open(DISHES_JS, encoding='utf-8').read()
new_raw = raw.replace('.webp', '.jpg')
open(DISHES_JS, 'w', encoding='utf-8').write(new_raw)

# 3. 校验：所有 image 路径文件都存在
data = json.loads(new_raw.split('module.exports = ', 1)[1])
missing = [d['image'] for d in data if not os.path.exists(os.path.join(BASE, d['image'].lstrip('/')))]

print('转换图片: %d 张' % converted)
print('JPG 总大小: %.2f MB' % (total_bytes / 1024 / 1024))
print('菜品数据路径已全部改写 .webp -> .jpg')
print('路径校验缺失: %d 个' % len(missing))
if missing:
    print('前几个缺失:', missing[:5])
