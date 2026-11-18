const cloudUtil = require('../../utils/cloud.js')

const STATUS_TEXT = { pending: '待处理', confirmed: '已确认', paid: '已支付', done: '已完成', cancelled: '已取消' }
const CODE_KEY = 'admin_code_cache_v1'

Page({
  data: {
    code: '',
    verified: false,
    orders: [],
    todayTotal: '0',
    loading: false,
    errMsg: '',
    lastCount: -1,
  },

  onLoad() {
    // 已验证过则恢复（本次会话内）
    if (getApp().globalData.adminVerified) {
      this.setData({ verified: true })
      this.loadOrders()
    }
  },

  onShow() {
    if (this.data.verified) this.loadOrders()
  },

  onPullDownRefresh() {
    if (this.data.verified) {
      this.loadOrders().then(() => wx.stopPullDownRefresh())
    } else {
      wx.stopPullDownRefresh()
    }
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value, errMsg: '' })
  },

  async verify() {
    if (!this.data.code.trim()) {
      this.setData({ errMsg: '请输入管理码' })
      return
    }
    if (!cloudUtil.isReady()) {
      this.setData({ errMsg: '云服务未就绪，请重新发布后再试' })
      return
    }
    this.setData({ loading: true, errMsg: '' })
    const ok = await this.loadOrders(this.data.code.trim())
    this.setData({ loading: false })
    if (ok) {
      getApp().globalData.adminVerified = true
      this.setData({ verified: true, code: '' })
    } else {
      this.setData({ errMsg: '管理码错误或云服务异常，请重试' })
    }
  },

  logout() {
    getApp().globalData.adminVerified = false
    this.setData({ verified: false, orders: [], lastCount: -1 })
  },

  // 拉取全部订单；返回是否成功
  async loadOrders(codeOverride) {
    try {
      const cloud = cloudUtil.getCloud()
      const code = codeOverride || wx.getStorageSync(CODE_KEY) || '123456'
      const { data, error } = await cloud.database.rpc('admin_list_orders', { input_code: code })
      if (error) throw new Error(error.message)

      const now = new Date()
      let todayTotal = 0
      const orders = (data || []).map((o) => {
        let items = []
        try {
          items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items
          items = (items || []).map((d) => Object.assign({}, d, { sub: (Number(d.price) || 0) * (Number(d.qty) || 0) }))
        } catch (e) { items = [] }

        const d = new Date(o.created_at)
        const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
        if (isToday && o.status !== 'cancelled') todayTotal += Number(o.total) || 0

        return Object.assign({}, o, {
          items,
          customerName: o.customer_name || '匿名顾客',
          customerAvatar: o.customer_avatar_data || o.customer_avatar || '',  // base64 data URL 或旧路径
          avatarPath: o.customer_avatar && !o.customer_avatar_data && !/^data:/.test(o.customer_avatar) ? o.customer_avatar : '',
          tableText: o.table_no ? ('桌号 ' + o.table_no) : '未填桌号',
          statusText: STATUS_TEXT[o.status] || o.status,
          timeText: isNaN(d.getTime()) ? '' : ((d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')),
          total: Number(o.total).toFixed(0),
        })
      })

      // 头像换签名URL（逐个，避免依赖批量返回格式）
      try {
        for (const o of orders) {
          if (!o.avatarPath) continue
          const signed = await cloud.storage.createSignedUrl(o.avatarPath, 7200)
          if (!signed.error && signed.data) o.customerAvatar = signed.data
        }
      } catch (e) {}

      // 新订单提醒
      if (this.data.lastCount >= 0 && orders.length > this.data.lastCount) {
        wx.vibrateShort({ type: 'heavy' })
        wx.showToast({ title: '有新订单', icon: 'none' })
      }
      this.setData({
        orders,
        todayTotal: todayTotal.toFixed(0),
        lastCount: orders.length,
        loading: false,
      })
      return true
    } catch (e) {
      this.setData({ loading: false })
      if (!codeOverride) {
        wx.showToast({ title: '加载失败：' + (e.message || '请重试'), icon: 'none' })
      }
      return false
    }
  },
})
