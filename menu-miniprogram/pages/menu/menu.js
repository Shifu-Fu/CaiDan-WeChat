const dishesUtil = require('../../utils/dishes.js')
const cloudUtil = require('../../utils/cloud.js')
const cart = require('../../utils/cart.js')

Page({
  data: {
    keyword: '',
    categories: ['全部', '热菜', '主食', '凉菜', '汤羹', '水果', '饮品', '点心'],
    currentCategory: '全部',
    filtered: [],
    cartCount: 0,
    cartTotal: 0,
  },

  async onLoad() {
    // 先显示本地菜，保证首屏秒开
    this.allDishes = dishesUtil.localDishes.map((d) => Object.assign({}, d, {
      ingredientsDisplay: d.ingredients.join('、'),
      qty: 0,
      source: 'local',
    }))
    this.applyFilter()

    // 再异步合并云端自定义菜
    await this.loadCloudDishes()
  },

  async loadCloudDishes() {
    if (!cloudUtil.isReady()) return
    try {
      const cloud = cloudUtil.getCloud()
      const all = await dishesUtil.getAllDishes(cloud)
      this.allDishes = all.map((d) => Object.assign({}, d, {
        ingredientsDisplay: d.ingredientsDisplay || d.ingredients.join('、'),
        qty: 0,
      }))
      // 写入全局缓存，供详情页/其他页按 id 查找
      const app = getApp()
      if (app && app.globalData) app.globalData.allDishes = this.allDishes
      this.applyFilter()
    } catch (e) {}
  },

  onPullDownRefresh() {
    this.loadCloudDishes().then(() => wx.stopPullDownRefresh())
  },

  onShow() {
    this.refreshCartQty()
  },

  // 同步购物车数量到菜品卡片
  refreshCartQty() {
    const cartItems = cart.getCart()
    const qtyMap = {}
    cartItems.forEach((x) => { qtyMap[x.id] = x.qty })
    const filtered = this.data.filtered.map((d) => Object.assign({}, d, { qty: qtyMap[d.id] || 0 }))
    this.setData({
      filtered,
      cartCount: cart.count(),
      cartTotal: cart.total().toFixed(0),
    })
  },

  applyFilter() {
    const kw = this.data.keyword.trim().toLowerCase()
    const cat = this.data.currentCategory
    const qtyMap = {}
    cart.getCart().forEach((x) => { qtyMap[x.id] = x.qty })
    const filtered = this.allDishes
      .filter((d) => cat === '全部' || d.category === cat)
      .filter((d) => !kw || d.name.toLowerCase().indexOf(kw) >= 0 || d.ingredientsDisplay.indexOf(kw) >= 0)
      .map((d) => Object.assign({}, d, { qty: qtyMap[d.id] || 0 }))
    this.setData({ filtered, cartCount: cart.count(), cartTotal: cart.total().toFixed(0) })
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.applyFilter())
  },
  clearSearch() {
    this.setData({ keyword: '' }, () => this.applyFilter())
  },
  onCategory(e) {
    this.setData({ currentCategory: e.currentTarget.dataset.cat }, () => this.applyFilter())
  },

  onPlus(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.allDishes.find((d) => d.id === id)
    cart.add(dish, 1)
    this.refreshCartQty()
    wx.vibrateShort({ type: 'light' })
  },
  onMinus(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.allDishes.find((d) => d.id === id)
    cart.add(dish, -1)
    this.refreshCartQty()
  },

  onDishTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  goCart() {
    wx.switchTab({ url: '/pages/cart/cart' })
  },

  goRanking() {
    wx.navigateTo({ url: '/pages/ranking/ranking' })
  },

  noop() {},
})
