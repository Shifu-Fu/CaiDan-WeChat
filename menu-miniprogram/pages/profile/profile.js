const cloudUtil = require('../../utils/cloud.js')
const profileSvc = require('../../utils/profile.js')
const app = getApp()

const STATUS_TEXT = { pending: '待处理', confirmed: '已确认', paid: '已支付', done: '已完成', cancelled: '已取消' }

Page({
  data: {
    signedIn: false,
    loginState: 'pending',
    orders: [],
    loading: true,
    nickName: '',
    avatarUrl: '',
    avatarData: '',
  },

  onShow() {
    this.setData({
      signedIn: app.globalData.signedIn,
      loginState: app.globalData.loginState || 'pending',
    })
    // 先显示本地缓存，再从云端刷新
    const cached = profileSvc.getCached()
    this.setData({ nickName: cached.nickName || '', avatarUrl: cached.avatarUrl || '', avatarData: cached.avatarData || '' })
    this.refreshProfile()
    this.loadOrders()
  },

  async refreshProfile() {
    if (!app.globalData.signedIn || !cloudUtil.isReady()) return
    try {
      const p = await profileSvc.loadFromCloud(cloudUtil.getCloud())
      if (p) this.setData({ nickName: p.nickName, avatarUrl: p.avatarUrl, avatarData: p.avatarData })
    } catch (e) {}
  },

  // 选择微信头像（open-type=chooseAvatar 回调）
  async onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl
    if (!tempPath) return
    this.setData({ avatarUrl: tempPath })
    if (!app.globalData.signedIn || !cloudUtil.isReady()) {
      wx.showToast({ title: '正在登录，头像稍后自动保存', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存头像…', mask: true })
    try {
      const cloud = cloudUtil.getCloud()
      const dataUrl = await profileSvc.imageToDataUrl(tempPath, 200, 60)
      await profileSvc.saveToCloud(cloud, this.data.nickName || '', dataUrl)
      profileSvc.cache({ nickName: this.data.nickName || '', avatarData: dataUrl, avatarUrl: dataUrl })
      this.setData({ avatarData: dataUrl, avatarUrl: dataUrl })
      wx.hideLoading()
      wx.showToast({ title: '头像已保存', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '头像保存失败', icon: 'none' })
    }
  },

  onNicknameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  async onNicknameBlur() {
    const name = (this.data.nickName || '').trim()
    if (!name) return
    if (!app.globalData.signedIn || !cloudUtil.isReady()) return
    try {
      const cloud = cloudUtil.getCloud()
      await profileSvc.saveToCloud(cloud, name, this.data.avatarData || '')
      profileSvc.cache({ nickName: name, avatarData: this.data.avatarData || '', avatarUrl: this.data.avatarUrl || '' })
    } catch (e) {}
  },

  async onUserTap() {
    if (app.globalData.loginState !== 'failed') return
    wx.showLoading({ title: '重试登录…', mask: true })
    await app.retryLogin()
    wx.hideLoading()
    this.setData({
      signedIn: app.globalData.signedIn,
      loginState: app.globalData.loginState,
    })
    if (app.globalData.signedIn) {
      wx.showToast({ title: '登录成功', icon: 'success' })
      this.loadOrders()
    } else {
      wx.showToast({ title: app.globalData.loginError || '仍失败', icon: 'none' })
    }
  },

  async loadOrders() {
    if (!app.globalData.signedIn) {
      this.setData({ loading: false, orders: [] })
      return
    }
    this.setData({ loading: true })
    try {
      const cloud = cloudUtil.getCloud()
      const { data, error } = await cloud.database
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw new Error(error.message)
      const orders = (data || []).map((o) => {
        let summary = ''
        try {
          const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items
          summary = items.map((x) => x.name + '×' + x.qty).join('、')
        } catch (e) { summary = '订单详情' }
        const d = new Date(o.created_at)
        return Object.assign({}, o, {
          statusText: STATUS_TEXT[o.status] || o.status,
          summary,
          timeText: isNaN(d.getTime()) ? '' : (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
          total: Number(o.total).toFixed(0),
        })
      })
      this.setData({ orders, loading: false })
    } catch (e) {
      this.setData({ orders: [], loading: false })
    }
  },

  goRecognize() {
    wx.navigateTo({ url: '/pages/recognize/recognize' })
  },
  goIngredients() {
    wx.switchTab({ url: '/pages/ingredients/ingredients' })
  },
  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },
})
