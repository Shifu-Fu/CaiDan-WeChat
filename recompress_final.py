# -*- coding: utf-8 -*-
"""从原始PNG重新压缩为 JPG 290px/q60，控制主包含 SDK 后仍 < 2MB。"""
import os, re, json
from PIL import Image

SRC = r"C:\Users\Administrator\WorkBuddy\2026-11-16-15-43-55\assets-source"
IMG_DIR = r"C:\Users\Administrator\WorkBuddy\2026-11-16-15-43-55\menu-miniprogram\assets\images"
DISHES_JS = r"C:\Users\Administrator\WorkBuddy\2026-11-16-15-43-55\menu-miniprogram\data\dishes.js"

W, Q = 280, 58

# 读出 dishes.js 里 name -> image 的映射（image 已是 .jpg 文件名）
raw = open(DISHES_JS, encoding='utf-8').read()
data = json.loads(raw.split('module.exports = ', 1)[1])

# 建立菜名 -> 原始PNG路径（去掉 (n) 后缀匹配）
png_map = {}
for f in os.listdir(SRC):
    if not f.lower().endswith('.png'):
        continue
    name = re.sub(r'\s*\(\d+\)\s*$', '', os.path.splitext(f)[0]).strip()
    png_map.setdefault(name, os.path.join(SRC, f))

total = 0
used = set()
for d in data:
    jpg_name = os.path.basename(d['image'])
    name = os.path.splitext(jpg_name)[0]
    if jpg_name in used:
        continue
    used.add(jpg_name)
    src = png_map.get(name)
    if not src:
        print('警告: 找不到原始PNG:', name)
        continue
    im = Image.open(src).convert('RGB')
    if im.width > W:
        im = im.resize((W, int(im.height * W / im.width)), Image.LANCZOS)
    out = os.path.join(IMG_DIR, jpg_name)
    im.save(out, 'JPEG', quality=Q, optimize=True, progressive=True)
    total += os.path.getsize(out)

print('重新压缩: %d 张' % len(used))
print('图片总大小: %.2f MB' % (total / 1024 / 1024))
