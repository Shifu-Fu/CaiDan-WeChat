const cloudUtil = require('../../utils/cloud.js')
const profileSvc = require('../../utils/profile.js')
const matting = require('../../utils/matting.js')
const app = getApp()

Page({
  data: {
    imagePath: '',      // 抠图后用于识别/保存的图
    originalPath: '',   // 原始图
    previewPath: '',    // 展示用
    bgRemoved: false,
    mattingBusy: false,
    loading: false,
    result: null,
    errorMsg: '',
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const p = res.tempFiles[0].tempFilePath
        this.setData({
          originalPath: p,
          imagePath: p,
          previewPath: p,
          bgRemoved: false,
          result: null,
          errorMsg: '',
        })
      },
    })
  },

  // 去背景 / 还原
  async toggleMatting() {
    if (this.data.mattingBusy) return
    if (this.data.bgRemoved) {
      // 还原原图
      this.setData({
        imagePath: this.data.originalPath,
        previewPath: this.data.originalPath,
        bgRemoved: false,
      })
      return
    }
    this.setData({ mattingBusy: true })
    wx.showLoading({ title: '正在去掉背景…', mask: true })
    try {
      const out = await matting.removeBackground(this.data.originalPath)
      this.setData({
        imagePath: out,
        previewPath: out,
        bgRemoved: true,
      })
      wx.hideLoading()
      wx.showToast({ title: '已去背景', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '去背景失败，用原图继续', icon: 'none' })
    } finally {
      this.setData({ mattingBusy: false })
    }
  },

  // 读取图片为 base64
  readImageBase64(path) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager()
      fs.readFile({
        filePath: path,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: reject,
      })
    })
  },

  async recognize() {
    if (!this.data.imagePath) return
    if (!app.globalData.signedIn) {
      if (app.globalData.loginState === 'failed') {
        wx.showToast({ title: '登录失败，请到「我的」页点顶部重试', icon: 'none' })
        return
      }
      wx.showLoading({ title: '正在登录…', mask: true })
      await app.retryLogin()
      wx.hideLoading()
      if (!app.globalData.signedIn) {
        wx.showToast({ title: '登录失败，请到「我的」页重试', icon: 'none' })
        return
      }
    }
    this.setData({ loading: true, errorMsg: '', result: null })

    try {
      if (!cloudUtil.isReady()) {
        throw new Error('云服务未就绪，请重新发布后再试')
      }
      const cloud = cloudUtil.getCloud()
      const base64 = await this.readImageBase64(this.data.imagePath)
      const imageUrl = 'data:image/jpeg;base64,' + base64

      const models = await cloud.llm.models.list()
      const model = models.find((m) => m.id === 'hy4flash-free' && m.disabled !== true && m.supportsImages !== false)
        || models.find((m) => m.supportsImages === true && m.disabled !== true)
      if (!model) throw new Error('暂无支持图片识别的模型')

      const systemPrompt = '你是菜品识别助手。识别图片中的菜品。只输出JSON：{"name":"菜名","ingredients":"主要食材，用顿号分隔","category":"分类（热菜/主食/凉菜/汤羹/水果/饮品/点心）","confidence":"高/中/低"}。不要输出JSON以外的内容。'

      let answer = ''
      for await (const chunk of cloud.llm.chat.completions.create({
        model: model.id,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: '识别这道菜' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        stream: true,
        response_format: { type: 'json_object' },
      })) {
        const delta = chunk.choices[0] && chunk.choices[0].delta
        if (delta && delta.content) answer += delta.content
      }

      const parsed = this.parseAnswer(answer)
      this.setData({
        loading: false,
        result: {
          name: parsed.name || '',
          ingredients: parsed.ingredients || '',
          category: parsed.category || '热菜',
          price: '',
          confidenceText: parsed.confidence ? '置信度：' + parsed.confidence : '',
        },
      })
    } catch (e) {
      this.setData({
        loading: false,
        errorMsg: '识别失败，请重试或换一张更清晰的图片。' + (e && e.message ? '（' + e.message + '）' : ''),
      })
    }
  },

  parseAnswer(text) {
    try {
      const cleaned = String(text).replace(/```json/g, '').replace(/```/g, '').trim()
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    } catch (e) {}
    return {}
  },

  onNameInput(e) { this.updateResult('name', e.detail.value) },
  onIngInput(e) { this.updateResult('ingredients', e.detail.value) },
  onCatInput(e) { this.updateResult('category', e.detail.value) },
  onPriceInput(e) { this.updateResult('price', e.detail.value) },
  updateResult(key, value) {
    const r = this.data.result
    if (!r) return
    const next = Object.assign({}, r)
    next[key] = value
    this.setData({ result: next })
  },

  async saveDish() {
    const r = this.data.result
    if (!r || !r.name.trim()) {
      wx.showToast({ title: '请先填写菜名', icon: 'none' })
      return
    }
    if (!cloudUtil.isReady()) {
      wx.showToast({ title: '云服务未就绪，请重新发布后再试', icon: 'none' })
      return
    }
    wx.showLoading({ title: '发布中…', mask: true })
    try {
      const cloud = cloudUtil.getCloud()

      // 图片压缩为 base64 直接存数据库（小程序SDK不支持二进制上传，云存储通道不可用）
      let imageData = ''
      try {
        imageData = await profileSvc.imageToDataUrl(this.data.imagePath, 500, 60)
      } catch (e) {}

      const { error } = await cloud.database.from('custom_dishes').insert({
        name: r.name.trim(),
        ingredients: r.ingredients.trim(),
        category: r.category.trim() || '热菜',
        image_path: '',
        image_data: imageData,
        price: Number(r.price) || 0,
      })
      if (error) throw new Error(error.message)

      wx.hideLoading()
      wx.showToast({ title: '已发布到菜单', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 900)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '发布失败：' + (e.message || '请重试'), icon: 'none' })
    }
  },
})
