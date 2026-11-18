# -*- coding: utf-8 -*-
"""压缩图片到主包可容纳尺寸，并从菜名生成食材标签、分类、示例价格，产出 dishes.js。"""
import os, re, json
from PIL import Image

SRC = r"C:\Users\Administrator\WorkBuddy\2026-11-16-15-43-55\assets-source"
OUT = r"C:\Users\Administrator\WorkBuddy\2026-11-16-15-43-55\menu-miniprogram\assets\images"
os.makedirs(OUT, exist_ok=True)

MAX_W = 360
QUALITY = 62

# 食材词库：菜名中出现即打标签（长的优先，避免"鸡蛋"抢在"西红柿鸡蛋"前）
INGREDIENTS = [
    "西红柿","圣女果","鸡蛋","土豆","鸡肉","鸡翅","鸡腿","牛肉","肥牛","猪肉","五花肉","排骨","猪耳朵","猪头肉",
    "虾","大虾","河虾","龙虾","生蚝","黄蚬子","鲈鱼","三文鱼","龙利鱼","鳗鱼","面条鱼","蟹","螃蟹",
    "豆腐","干豆腐","豆芽","豆角","豇豆","荷兰豆","茄子","青椒","尖椒","白菜","圆白菜","大头菜","菠菜","生菜","油麦菜","空心菜","油菜","西兰花","菜花","黄瓜","洋葱","韭菜","蒜薹","蒜苗","芹菜","蘑菇","杏鲍菇","木耳","海裙菜","萝卜","南瓜","冬瓜","莲藕","莴笋","竹笋","冬笋","玉米","山药",
    "米饭","大米","小米","紫米","薏米","面条","拉面","方便面","馒头","花卷","包子","饺子","馄饨","馅饼","手抓饼","煎饼","面包","贝果","三明治","披萨","汉堡","寿司","粽子","汤圆","粥",
    "西瓜","苹果","香蕉","橘子","橙子","草莓","蓝莓","葡萄","阳光玫瑰","荔枝","桂圆","龙眼","梨","秋月梨","桃子","香瓜","芭乐","菠萝蜜","火龙果","车厘子","樱桃","大枣","柿子","山楂",
    "花生","腰果","瓜子","蛋","奶","酸奶","芝士","奶酪",
]

# 分类规则
def classify(name):
    if any(k in name for k in ["粥","米饭","饭","面","馒头","包子","饺子","馄饨","饼","面包","贝果","三明治","披萨","汉堡","寿司","粽子","汤圆","拉面","方便面"]):
        return "主食"
    if any(k in name for k in ["汤","羹"]):
        return "汤羹"
    if any(k in name for k in ["西瓜","苹果","橘子","草莓","蓝莓","葡萄","荔枝","桂圆","梨","香瓜","芭乐","菠萝蜜","火龙果","车厘子","樱桃","大枣","柿子","拼盘","水果"]):
        return "水果"
    if any(k in name for k in ["可乐","酸奶","奶","饮"]):
        return "饮品"
    if any(k in name for k in ["拌","凉","黄瓜","蜇皮","猪耳朵","鸡架","拉皮"]):
        return "凉菜"
    if any(k in name for k in ["蛋糕","小蛋糕","糕","点心"]):
        return "点心"
    return "热菜"

def price_of(name, cat):
    if cat == "主食": return 12
    if cat == "汤羹": return 18
    if cat == "水果": return 12
    if cat == "饮品": return 8
    if cat == "凉菜": return 18
    if cat == "点心": return 10
    if any(k in name for k in ["龙虾","蟹","海鲜","生蚝","三文鱼","鳗鱼","鲈鱼","牛排","肥牛","烤鸭"]): return 48
    if any(k in name for k in ["排骨","牛肉","鸡肉","鸡翅","鸡腿","虾","鱼","肉"]): return 32
    return 20

def ingredients_of(name):
    tags = []
    for ing in INGREDIENTS:
        if ing in name and ing not in tags:
            # 避免重复子串，如"鸡蛋"和"蛋"
            tags.append(ing)
    # 去掉被更长标签包含的短标签
    result = []
    for t in tags:
        if not any(t != o and t in o for o in tags):
            result.append(t)
    return result[:6]

files = sorted([f for f in os.listdir(SRC) if f.lower().endswith('.png')])
seen = {}
dishes = []
before = after = 0
for f in files:
    name = os.path.splitext(f)[0]
    name = re.sub(r'\s*\(\d+\)\s*$', '', name).strip()
    if name in seen:
        continue
    seen[name] = True
    src = os.path.join(SRC, f)
    before += os.path.getsize(src)
    img_name = name + '.webp'
    im = Image.open(src).convert('RGB')
    if im.width > MAX_W:
        im = im.resize((MAX_W, int(im.height * MAX_W / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, img_name), 'WEBP', quality=QUALITY, method=6)
    after += os.path.getsize(os.path.join(OUT, img_name))
    cat = classify(name)
    dishes.append({
        'id': len(dishes) + 1,
        'name': name,
        'image': '/assets/images/' + img_name,
        'category': cat,
        'price': price_of(name, cat),
        'ingredients': ingredients_of(name),
    })

with open(r"C:\Users\Administrator\WorkBuddy\2026-11-16-15-43-55\menu-miniprogram\data\dishes.js", 'w', encoding='utf-8') as fp:
    fp.write('// 由素材自动生成：菜品数据（示例分类/价格，可在后台或代码中调整）\n')
    fp.write('module.exports = ')
    fp.write(json.dumps(dishes, ensure_ascii=False, indent=2))
    fp.write('\n')

# 汇总所有食材标签 -> ingredients.js
all_ing = sorted({i for d in dishes for i in d['ingredients']})
with open(r"C:\Users\Administrator\WorkBuddy\2026-11-16-15-43-55\menu-miniprogram\data\ingredients.js", 'w', encoding='utf-8') as fp:
    fp.write('// 全部食材标签（从菜名提取）\n')
    fp.write('module.exports = ')
    fp.write(json.dumps(all_ing, ensure_ascii=False, indent=2))
    fp.write('\n')

print('菜品: %d 道' % len(dishes))
print('食材标签: %d 种' % len(all_ing))
print('图片压缩前: %.1f MB' % (before/1024/1024))
print('图片压缩后: %.2f MB' % (after/1024/1024))
print('分类分布:')
from collections import Counter
for k,v in Counter(d['category'] for d in dishes).most_common():
    print('  %s: %d' % (k,v))
print('有食材标签的菜:', sum(1 for d in dishes if d['ingredients']))
