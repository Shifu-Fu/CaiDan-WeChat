// 菜品数据层：本地 192 道 + 云端自定义菜 + 编辑覆盖，合并为统一菜单
const localDishes = require('../data/dishes.js')

function splitIngredients(str) {
  if (!str) return []
  if (Array.isArray(str)) return str
  return String(str).split(/[、,，;；\s]+/).filter(Boolean)
}

async function resolveCloudImage(cloud, imagePath) {
  if (!imagePath) return ''
  // 已经是完整URL（历史 image_url 数据）直接用
  if (/^https?:\/\//.test(imagePath)) return imagePath
  try {
    const signed = await cloud.storage.createSignedUrl(imagePath, 7200)
    if (!signed.error) return signed.data
  } catch (e) {}
  return ''
}

// 评论用的唯一标识：本地菜 L<id>，云端菜 C<cloudId>
function dishKeyOf(d) {
  return d.source === 'cloud' ? ('C' + d.cloudId) : ('L' + d.id)
}

// 读取编辑覆盖（全店共享）
async function loadOverrides(cloud) {
  try {
    const { data, error } = await cloud.database.rpc('public_list_overrides')
    if (error || !data) return {}
    const map = {}
    data.forEach((o) => { map[o.base_dish_id] = o })
    return map
  } catch (e) {
    return {}
  }
}

// 获取完整菜单
async function getAllDishes(cloud) {
  const overrides = cloud ? await loadOverrides(cloud) : {}

  // 本地菜，应用覆盖
  let list = localDishes.map((d) => {
    let item = Object.assign({}, d, { source: 'local' })
    const ov = overrides[d.id]
    if (ov) {
      item = Object.assign({}, item, {
        name: ov.name != null ? ov.name : item.name,
        ingredients: ov.ingredients ? splitIngredients(ov.ingredients) : item.ingredients,
        category: ov.category || item.category,
        price: ov.price != null ? Number(ov.price) : item.price,
        edited: true,
        imagePath: ov.image_path || '',
        imageData: ov.image_data || '',
        baseImage: item.image,
      })
      if (item.imageData) item.image = item.imageData
    }
    item.ingredientsDisplay = (item.ingredients || []).join('、')
    item.dishKey = dishKeyOf(item)
    return item
  })

  // 本地菜若有新图片，现场换签名URL
  if (cloud) {
    list = await Promise.all(list.map(async (d) => {
      if (d.imagePath && !d.imageData) {
        const url = await resolveCloudImage(cloud, d.imagePath)
        if (url) d.image = url
      }
      return d
    }))
  }

  if (cloud) {
    try {
      const { data, error } = await cloud.database
        .from('custom_dishes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (!error && data && data.length > 0) {
        const cloudDishes = await Promise.all(data.map(async (c, idx) => {
          const imgPath = c.image_path || c.image_url || ''
          // 优先用直接存库的 base64；否则尝试旧 path 换签名URL（大概率为空）
          let imageUrl = c.image_data || ''
          if (!imageUrl && imgPath) imageUrl = await resolveCloudImage(cloud, imgPath)
          const d = {
            id: 100000 + idx,
            name: c.name,
            image: imageUrl || '/assets/images/placeholder.jpg',
            category: c.category || '热菜',
            price: Number(c.price) || 0,
            ingredients: splitIngredients(c.ingredients),
            ingredientsDisplay: c.ingredients || '',
            source: 'cloud',
            cloudId: c.id,
            imagePath: imgPath,
            imageData: c.image_data || '',
          }
          d.dishKey = dishKeyOf(d)
          return d
        }))
        list = cloudDishes.concat(list)
      }
    } catch (e) {}
  }

  return list
}

module.exports = { getAllDishes, splitIngredients, resolveCloudImage, dishKeyOf, localDishes }
