const dishesUtil = require('../../utils/dishes.js')
const ingredients = require('../../data/ingredients.js')
const cart = require('../../utils/cart.js')

const COLLAPSE_COUNT = 12  // 折叠时显示前3排（每行约4个）

Page({
  data: {
    keyword: '',
    selected: [],
    displayIngredients: [],
    matched: [],
    matchMode: 'any',
    expanded: false,
    canExpand: false,
    totalCount: 0,
  },

  onLoad() {
    this.allDishes = dishesUtil.localDishes
    this.refreshIngredients()
  },

  // 计算要显示的食材（折叠/展开/搜索）
  refreshIngredients() {
    const kw = this.data.keyword.trim()
    const list = ingredients
      .filter((x) => !kw || x.indexOf(kw) >= 0)
      .map((name) => ({ name, selected: this.data.selected.indexOf(name) >= 0 }))

    // 搜索时强制展开，否则按展开状态
    const forceExpand = !!kw
    const expanded = forceExpand || this.data.expanded
    const canExpand = !forceExpand && list.length > COLLAPSE_COUNT

    let display
    if (expanded || forceExpand) {
      display = list
    } else {
      // 折叠：前 N 个 + 已选但未落在前 N 的食材
      const head = list.slice(0, COLLAPSE_COUNT)
      const headNames = head.map((x) => x.name)
      const selectedExtra = list.filter((x) => x.selected && headNames.indexOf(x.name) < 0)
      display = head.concat(selectedExtra)
    }

    this.setData({
      displayIngredients: display,
      canExpand,
      totalCount: list.length,
    })
  },

  toggleExpand() {
    this.setData({ expanded: !this.data.expanded }, () => this.refreshIngredients())
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value.trim() }, () => this.refreshIngredients())
  },

  toggle(e) {
    const name = e.currentTarget.dataset.name
    const sel = this.data.selected.slice()
    const idx = sel.indexOf(name)
    if (idx >= 0) sel.splice(idx, 1)
    else sel.push(name)
    this.setData({ selected: sel }, () => {
      this.refreshIngredients()
      this.computeMatch()
    })
  },

  unselect(e) {
    const name = e.currentTarget.dataset.name
    const sel = this.data.selected.filter((x) => x !== name)
    this.setData({ selected: sel }, () => {
      this.refreshIngredients()
      this.computeMatch()
    })
  },

  setMode(e) {
    this.setData({ matchMode: e.currentTarget.dataset.mode }, () => this.computeMatch())
  },

  computeMatch() {
    const sel = this.data.selected
    if (sel.length === 0) {
      this.setData({ matched: [] })
      return
    }
    const mode = this.data.matchMode
    const matched = []
    this.allDishes.forEach((d) => {
      const ings = d.ingredients || []
      const hits = ings.filter((i) => sel.indexOf(i) >= 0)
      const ok = mode === 'all' ? hits.length === sel.length : hits.length > 0
      if (ok) {
        matched.push(Object.assign({}, d, { matchedIng: hits.join('、') }))
      }
    })
    matched.sort((a, b) => {
      const ah = (a.ingredients || []).filter((i) => sel.indexOf(i) >= 0).length
      const bh = (b.ingredients || []).filter((i) => sel.indexOf(i) >= 0).length
      return bh - ah
    })
    this.setData({ matched: matched.slice(0, 60) })
  },

  quickAdd(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.allDishes.find((d) => d.id === id)
    if (dish) cart.add(dish, 1)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  },
})
