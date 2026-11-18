const dishesData = require('../../data/dishes.js')
const dishesUtil = require('../../utils/dishes.js')
const cart = require('../../utils/cart.js')
const cloudUtil = require('../../utils/cloud.js')
const profileSvc = require('../../utils/profile.js')
const app = getApp()

const CATEGORIES = ['热菜', '主食', '凉菜', '汤羹', '水果', '饮品', '点心']

Page({
  data: {
    dish: null, qty: 0, cartCount: 0,
    categories: CATEGORIES,
    // 评论
    comments: [],
    commentText: '',
    authorName: '',
    // 编辑
    showEdit: false,
    edit: { name: '', ingredients: '', price: '', catIndex: 0, image: '', code: '' },
    newImageData: '',   // 编辑时新选的图片 data URL
  },

  onLoad(options) {
    this.dishId = Number(options.id)
    const cache = app && app.globalData ? app.globalData.allDishes : null
    const dish = (cache || dishesData).find((d) => d.id === this.dishId)
    if (!dish) {
      wx.showToast({ title: '菜品不存在', icon: 'none' })
      return
    }
    this.dish = dish
    const cachedProfile = profileSvc.getCached()
    this.setData({
      dish,
      cartCount: cart.count(),
      authorName: cachedProfile.nickName || '',
    })
    this.loadComments()
  },

  onShow() {
    if (!this.dish) return
    const qty = cart.getCart().find((x) => x.id === this.dish.id)
    this.setData({ qty: qty ? qty.qty : 0, cartCount: cart.count() })
  },

  // ---------- 购物车 ----------
  onPlus() {
    cart.add(this.dish, 1)
    this.setData({ qty: this.data.qty + 1, cartCount: cart.count() })
    wx.vibrateShort({ type: 'light' })
  },
  onMinus() {
    cart.add(this.dish, -1)
    this.setData({ qty: Math.max(0, this.data.qty - 1), cartCount: cart.count() })
  },
  addAndCart() {
    cart.add(this.dish, 1)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
    setTimeout(() => wx.switchTab({ url: '/pages/cart/cart' }), 600)
  },
  goCart() { wx.switchTab({ url: '/pages/cart/cart' }) },

  // ---------- 评论 ----------
  async loadComments() {
    if (!cloudUtil.isReady()) return
    try {
      const cloud = cloudUtil.getCloud()
      const key = dishesUtil.dishKeyOf(this.dish)
      const { data, error } = await cloud.database.rpc('public_list_comments', { p_dish_key: key })
      if (error) return
      const comments = (data || []).map((c) => ({
        id: c.id,
        author: c.author || '匿名食客',
        authorAvatar: (c.author || '匿')[0],
        content: c.content,
        timeText: this.formatTime(c.created_at),
      }))
      this.setData({ comments })
    } catch (e) {}
  },

  onAuthorInput(e) { this.setData({ authorName: e.detail.value }) },
  onCommentInput(e) { this.setData({ commentText: e.detail.value }) },

  async submitComment() {
    const content = (this.data.commentText || '').trim()
    if (!content) {
      wx.showToast({ title: '先写点内容', icon: 'none' })
      return
    }
    if (!cloudUtil.isReady()) {
      wx.showToast({ title: '云服务未就绪，请重新发布', icon: 'none' })
      return
    }
    wx.showLoading({ title: '发送中…', mask: true })
    try {
      const cloud = cloudUtil.getCloud()
      const key = dishesUtil.dishKeyOf(this.dish)
      const author = (this.data.authorName || '').trim() || '匿名食客'
      await cloud.database.rpc('public_add_comment', {
        p_dish_key: key,
        p_author: author,
        p_content: content,
      })
      wx.hideLoading()
      this.setData({ commentText: '' })
      profileSvc.cache(Object.assign(profileSvc.getCached(), { nickName: author }))
      this.loadComments()
      wx.showToast({ title: '评论成功', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '评论失败', icon: 'none' })
    }
  },

  async deleteComment(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除评论',
      content: '确定删除这条评论吗？',
      success: async (res) => {
        if (!res.confirm) return
        if (!cloudUtil.isReady()) return
        try {
          const cloud = cloudUtil.getCloud()
          await cloud.database.rpc('public_delete_comment', { p_id: id })
          this.loadComments()
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      },
    })
  },

  formatTime(ts) {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ''
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  },

  // ---------- 编辑 ----------
  openEdit() {
    const d = this.dish
    const catIndex = Math.max(0, CATEGORIES.indexOf(d.category))
    this.setData({
      showEdit: true,
      newImageData: '',
      edit: {
        name: d.name,
        ingredients: (d.ingredients || []).join('、'),
        price: String(d.price),
        catIndex,
        image: d.image,
        code: '',
      },
    })
  },
  closeEdit() { this.setData({ showEdit: false }) },
  noop() {},
  onEditInput(e) {
    const key = e.currentTarget.dataset.key
    const edit = Object.assign({}, this.data.edit)
    edit[key] = e.detail.value
    this.setData({ edit })
  },
  onCatChange(e) {
    const edit = Object.assign({}, this.data.edit)
    edit.catIndex = Number(e.detail.value)
    this.setData({ edit })
  },

  // 更换照片：选图 -> 压缩为 base64 -> 预览（随保存入库）
  async changePhoto() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'],
      success: async (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '处理照片…', mask: true })
        try {
          const dataUrl = await profileSvc.imageToDataUrl(tempPath, 500, 60)
          this.setData({ newImageData: dataUrl })
          const edit = Object.assign({}, this.data.edit)
          edit.image = dataUrl
          this.setData({ edit })
          wx.hideLoading()
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '照片处理失败', icon: 'none' })
        }
      },
    })
  },

  async saveEdit() {
    const e = this.data.edit
    const code = (e.code || '').trim() || '123456'
    if (!e.name.trim()) {
      wx.showToast({ title: '菜名不能为空', icon: 'none' })
      return
    }
    if (!cloudUtil.isReady()) {
      wx.showToast({ title: '云服务未就绪，请重新发布', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中…', mask: true })
    try {
      const cloud = cloudUtil.getCloud()
      const ingredients = e.ingredients.trim()
      const category = CATEGORIES[e.catIndex]
      const price = Number(e.price) || 0
      const imageData = this.data.newImageData || ''
      let ok = false

      if (this.dish.source === 'cloud') {
        // 云端菜：更新 custom_dishes
        const { data } = await cloud.database.rpc('admin_update_cloud_dish', {
          p_code: code, p_id: this.dish.cloudId, p_name: e.name.trim(),
          p_ingredients: ingredients, p_category: category, p_price: price, p_image_path: '', p_image_data: imageData,
        })
        ok = data === true
      } else {
        // 本地菜：存覆盖表
        const { data } = await cloud.database.rpc('admin_save_override', {
          p_code: code, p_base_id: this.dish.id, p_name: e.name.trim(),
          p_ingredients: ingredients, p_category: category, p_price: price, p_image_path: '', p_image_data: imageData,
        })
        ok = data === true
      }

      wx.hideLoading()
      if (!ok) {
        wx.showToast({ title: '管理码错误', icon: 'none' })
        return
      }
      // 更新本地展示 + 全局缓存
      const updated = Object.assign({}, this.dish, {
        name: e.name.trim(),
        ingredients: ingredients ? ingredients.split(/[、,，;；\s]+/).filter(Boolean) : [],
        category, price,
        image: this.data.edit.image,
        edited: true,
      })
      updated.ingredientsDisplay = (updated.ingredients || []).join('、')
      this.dish = updated
      const cache = app.globalData.allDishes
      if (cache) {
        const idx = cache.findIndex((d) => d.id === updated.id)
        if (idx >= 0) cache[idx] = updated
      }
      this.setData({ dish: updated, showEdit: false })
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败：' + (err.message || '请重试'), icon: 'none' })
    }
  },
})
