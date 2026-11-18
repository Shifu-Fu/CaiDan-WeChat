// 轻量抠图：把纯色/接近纯色的连通背景变透明，并自动裁掉空白边。
// 纯前端 canvas 实现，零成本、无需密钥。适合白底/纯色底的菜品图；复杂实景背景效果有限。

const TOLERANCE = 42       // 颜色接近阈值（越大去得越狠，越大越容易误伤浅色菜）
const EDGE_SOFT = 26       // 边缘柔和过渡区间

// 取图片像素 -> 背景去除 -> 自动裁剪 -> 返回临时文件路径
function removeBackground(imagePath, options) {
  const opt = options || {}
  const tolerance = opt.tolerance != null ? opt.tolerance : TOLERANCE
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: imagePath,
      success(info) {
        const W = info.width
        const H = info.height
        // 限制最大边，避免大图 OOM
        const MAX = 800
        const scale = Math.min(1, MAX / Math.max(W, H))
        const w = Math.round(W * scale)
        const h = Math.round(H * scale)

        const canvas = wx.createCanvas()
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        const img = canvas.createImage()
        img.onload = () => {
          try {
            ctx.drawImage(img, 0, 0, w, h)
            const imageData = ctx.getImageData(0, 0, w, h)
            const data = imageData.data

            // 1. 估算背景色：取四角各 8x8 区域均值
            const bg = estimateBackground(data, w, h)
            // 2. 洪泛填充从四边连通的、接近背景色的像素 -> 透明
            floodFillBackground(data, w, h, bg, tolerance, EDGE_SOFT)
            // 3. 自动裁掉全透明边（留一点 padding）
            const box = nonTransparentBox(data, w, h)
            const pad = Math.round(Math.min(w, h) * 0.03)
            const x0 = Math.max(0, box.x0 - pad)
            const y0 = Math.max(0, box.y0 - pad)
            const x1 = Math.min(w, box.x1 + pad)
            const y1 = Math.min(h, box.y1 + pad)
            const cw = Math.max(1, x1 - x0)
            const ch = Math.max(1, y1 - y0)

            // 4. 裁剪后画到新 canvas，白底换成透明
            const out = wx.createCanvas()
            out.width = cw
            out.height = ch
            const octx = out.getContext('2d')
            const cropped = ctx.getImageData(x0, y0, cw, ch)
            octx.putImageData(cropped, 0, 0)

            wx.canvasToTempFilePath({
              canvas: out,
              fileType: 'png',
              success(res) { resolve(res.tempFilePath) },
              fail(err) { reject(err) },
            })
          } catch (e) {
            reject(e)
          }
        }
        img.onerror = (e) => reject(e)
        img.src = imagePath
      },
      fail: reject,
    })
  })
}

// 四角取样估算背景色
function estimateBackground(data, w, h) {
  let r = 0, g = 0, b = 0, n = 0
  const s = 8
  const corners = [[0, 0], [w - s, 0], [0, h - s], [w - s, h - s]]
  corners.forEach(([cx, cy]) => {
    for (let y = cy; y < cy + s; y++) {
      for (let x = cx; x < cx + s; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue
        const i = (y * w + x) * 4
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
      }
    }
  })
  return n ? [r / n, g / n, b / n] : [255, 255, 255]
}

// 从四边开始洪泛：连通且接近背景色的像素透明化，边缘做柔和过渡
function floodFillBackground(data, w, h, bg, tol, soft) {
  const total = w * h
  const visited = new Uint8Array(total)
  const stack = []
  // 种子：四边所有像素
  for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1) }

  const colorDist = (i) => {
    const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2]
    return Math.sqrt(dr * dr + dg * dg + db * db)
  }

  while (stack.length) {
    const p = stack.pop()
    if (p < 0 || p >= total || visited[p]) continue
    visited[p] = 1
    const i = p * 4
    const dist = colorDist(i)
    if (dist <= tol) {
      // 完全背景 -> 透明；边缘带柔和
      const alpha = dist > tol - soft ? Math.round(((tol - dist) / soft) * 255) : 255
      data[i + 3] = Math.min(data[i + 3], alpha)
      // 继续向外扩
      const x = p % w, y = (p / w) | 0
      if (x > 0) stack.push(p - 1)
      if (x < w - 1) stack.push(p + 1)
      if (y > 0) stack.push(p - w)
      if (y < h - 1) stack.push(p + w)
    }
  }
}

// 找非透明像素包围盒
function nonTransparentBox(data, w, h) {
  let x0 = w, y0 = h, x1 = 0, y1 = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3]
      if (a > 16) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < x0) return { x0: 0, y0: 0, x1: w, y1: h }
  return { x0, y0, x1, y1 }
}

module.exports = { removeBackground }
