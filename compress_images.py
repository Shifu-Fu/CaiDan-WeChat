# -*- coding: utf-8 -*-
"""批量压缩菜品图片：PNG -> WebP，宽度限制 640px，质量 80。
同时生成菜品清单 JSON（菜名去除重复的 (n) 后缀）。"""
import os
import re
import json
from PIL import Image

SRC = r"C:\Users\Administrator\WorkBuddy\2026-11-16-15-43-55\assets-source"
DST = r"C:\Users\Administrator\WorkBuddy\2026-11-16-15-43-55\assets-mini"
os.makedirs(DST, exist_ok=True)

MAX_W = 640
QUALITY = 80

files = sorted([f for f in os.listdir(SRC) if f.lower().endswith('.png')])
dishes = []
total_before = 0
total_after = 0

for f in files:
    src_path = os.path.join(SRC, f)
    total_before += os.path.getsize(src_path)
    # 菜名：去掉 .png 和结尾的 (数字)
    name = os.path.splitext(f)[0]
    name = re.sub(r'\s*\(\d+\)\s*$', '', name).strip()
    out_name = name + '.webp'
    out_path = os.path.join(DST, out_name)

    im = Image.open(src_path).convert('RGB')
    if im.width > MAX_W:
        h = int(im.height * MAX_W / im.width)
        im = im.resize((MAX_W, h), Image.LANCZOS)
    im.save(out_path, 'WEBP', quality=QUALITY, method=6)
    total_after += os.path.getsize(out_path)
    dishes.append({'name': name, 'image': out_name})

# 去重同名（不同 (n) 版本压缩后同名，保留一个）
seen = {}
unique = []
for d in dishes:
    if d['name'] not in seen:
        seen[d['name']] = True
        unique.append(d)

with open(os.path.join(DST, 'dishes.json'), 'w', encoding='utf-8') as fp:
    json.dump(unique, fp, ensure_ascii=False, indent=2)

print('处理图片: %d 张' % len(files))
print('去重后菜品: %d 道' % len(unique))
print('压缩前: %.1f MB' % (total_before / 1024 / 1024))
print('压缩后: %.1f MB' % (total_after / 1024 / 1024))
print('压缩率: %.1f%%' % ((1 - total_after / total_before) * 100))
