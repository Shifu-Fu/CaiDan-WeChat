const cart = require('../../utils/cart.js')
const profileSvc = require('../../utils/profile.js')
const app = getApp()

Page({
  data: {
    items: [],
    subtotal: '0',
    count: 0,
    tableNo: '',
    submitting: false,
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const items = cart.getCart()
    this.setData({
      items,
      subtotal: cart.total().toFixed(0),
      count: cart.count(),
    })
  },

  onTableInput(e) {
    this.setData({ tableNo: e.detail.value })
  },

  onPlus(e) {
    const item = this.data.items.find((x) => x.id === e.currentTarget.dataset.id)
    cart.add(item, 1)
    this.refresh()
  },

  onMinus(e) {
    const item = this.data.items.find((x) => x.id === e.currentTarget.dataset.id)
    cart.add(item, -1)
    this.refresh()
  },

  clearAll() {
    wx.showModal({
      title: '清空购物车',
      content: '确定要清空所有已选菜品吗？',
      success: (res) => {
        if (res.confirm) {
          cart.clear()
          this.refresh()
        }
      },
    })
  },

  async submitOrder() {
    if (this.data.submitting) return
    // 云依赖用时才加载，避免拖垮购物车页面本身
    let cloudUtil, cloud
    try {
      cloudUtil = require('../../utils/cloud.js')
      if (!cloudUtil.isReady()) {
        const detail = cloudUtil.errorDetail ? cloudUtil.errorDetail() : ''
        wx.showModal({
          title: '云服务未就绪',
          content: detail ? ('初始化失败：' + detail + '\n请把这段提示发给开发者。') : '请重新发布体验版后再试。',
          showCancel: false,
        })
        return
      }
      cloud = cloudUtil.getCloud()
    } catch (e) {
      wx.showToast({ title: '云服务加载失败，请重新发布后再试', icon: 'none' })
      return
    }
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
      cloud = cloudUtil.getCloud()
    }
    const items = this.data.items
    if (items.length === 0) return

    this.setData({ submitting: true })
    try {
      const total = items.reduce((s, x) => s + x.price * x.qty, 0)
      // 带上点菜人信息（优先云端，退回本地缓存）
      let customer = { nickName: '', avatarData: '' }
      try {
        const cloudProfile = await profileSvc.loadFromCloud(cloud)
        if (cloudProfile) customer = { nickName: cloudProfile.nickName, avatarData: cloudProfile.avatarData || '' }
        else {
          const c = profileSvc.getCached()
          customer = { nickName: c.nickName || '', avatarData: c.avatarData || '' }
        }
      } catch (e) {}
      const { error } = await cloud.database.from('orders').insert({
        table_no: this.data.tableNo || '',
        items: items.map((x) => ({ id: x.id, name: x.name, price: x.price, qty: x.qty })),
        total: total,
        status: 'paid',
        remark: '',
        customer_name: customer.nickName || '匿名顾客',
        customer_avatar: customer.avatarData || '',   // base64 data URL，兼容旧字段
        customer_avatar_data: customer.avatarData || '',
      })
      if (error) throw new Error(error.message)

      cart.clear()
      this.refresh()
      wx.showToast({ title: '下单成功，已记账', icon: 'success' })
      setTimeout(() => wx.switchTab({ url: '/pages/profile/profile' }), 800)
    } catch (e) {
      wx.showToast({ title: '下单失败：' + (e.message || '请重试'), icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  goMenu() {
    wx.switchTab({ url: '/pages/menu/menu' })
  },
})
