const cloudUtil = require('../../utils/cloud.js')
const dishesData = require('../../data/dishes.js')
const cart = require('../../utils/cart.js')
const app = getApp()

Page({
  data: {
    question: '',
    presets: [
      { emoji: '🥗', label: '清淡健康', prompt: '推荐几道清淡、少油的菜' },
      { emoji: '🍖', label: '下饭硬菜', prompt: '推荐几道下饭的荤菜' },
      { emoji: '🌶️', label: '香辣过瘾', prompt: '推荐几道香辣口味的菜' },
      { emoji: '👨‍👩‍👧', label: '家庭聚餐', prompt: '推荐适合家庭聚餐、荤素搭配的几个菜' },
      { emoji: '⚡', label: '快手简单', prompt: '推荐做法简单快速的家常菜' },
      { emoji: '🍲', label: '暖心汤羹', prompt: '推荐几道汤和羹' },
    ],
    loading: false,
    resultText: '',
    recommended: [],
    errorMsg: '',
  },

  onInput(e) {
    this.setData({ question: e.detail.value })
  },

  usePreset(e) {
    this.setData({ question: e.currentTarget.dataset.prompt }, () => this.askLLM())
  },

  // 从菜单数据中构建候选清单给模型
  buildCandidateList() {
    return dishesData.map((d) => `${d.id}:${d.name}(${d.category}${d.ingredients.length ? '/' + d.ingredients.join('、') : ''})`).join('\n')
  },

  async askLLM() {
    const q = this.data.question.trim()
    if (!q) {
      wx.showToast({ title: '先说说你想吃什么', icon: 'none' })
      return
    }
    // 等待登录完成（首次进入可能还在登录中）
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
    this.setData({ loading: true, resultText: '', recommended: [], errorMsg: '' })

    const systemPrompt = '你是点菜小程序的推荐助手。从用户菜单中推荐菜品。只输出JSON：{"comment":"一句推荐理由","ids":[菜品id数组]}。ids必须是下面菜单中出现过的数字id，最多推荐5个。不要输出JSON以外的内容。\n菜单：' + this.buildCandidateList()

    try {
      const cloud = cloudUtil.getCloud()
      const models = await cloud.llm.models.list()
      const model = models.find((m) => m.id === 'hy4flash-free' && m.disabled !== true)
        || models.find((m) => m.supportsImages === false && m.disabled !== true)
        || models.find((m) => m.disabled !== true)
      if (!model) throw new Error('暂无可用模型')

      let answer = ''
      for await (const chunk of cloud.llm.chat.completions.create({
        model: model.id,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: q },
        ],
        stream: true,
        response_format: { type: 'json_object' },
      })) {
        const delta = chunk.choices[0] && chunk.choices[0].delta
        if (delta && delta.content) answer += delta.content
      }

      const parsed = this.parseAnswer(answer)
      const ids = parsed.ids || []
      const recommended = ids
        .map((id) => dishesData.find((d) => d.id === Number(id)))
        .filter(Boolean)
        .slice(0, 5)

      this.setData({
        loading: false,
        resultText: parsed.comment || '为你挑了几道菜，看看喜不喜欢：',
        recommended,
      })
    } catch (e) {
      this.setData({
        loading: false,
        errorMsg: '推荐失败，请检查网络后重试。' + (e && e.message ? '（' + e.message + '）' : ''),
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
    return { comment: '', ids: [] }
  },

  quickAdd(e) {
    const id = e.currentTarget.dataset.id
    const dish = dishesData.find((d) => d.id === id)
    cart.add(dish, 1)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  },
})
