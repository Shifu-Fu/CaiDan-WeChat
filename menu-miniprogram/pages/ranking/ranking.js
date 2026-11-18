const cloudUtil = require('../../utils/cloud.js')
const dishesUtil = require('../../utils/dishes.js')
const app = getApp()

Page({
  data: {
    loading: true,
    groupList: [],      // [{category, list:[...]}]
    currentCat: '',
    currentGroup: null,
  },

  onLoad() { this.loadRanking() },

  onPullDownRefresh() {
    this.loadRanking().then(() => wx.stopPullDownRefresh())
  },

  async loadRanking() {
    if (!cloudUtil.isReady()) {
      this.setData({ loading: false, groupList: [] })
      return
    }
    this.setData({ loading: true })
    try {
      const cloud = cloudUtil.getCloud()
      const { data, error } = await cloud.database.rpc('public_dish_ranking')
      if (error) throw new Error(error.message)

      // 菜名 -> 菜品信息（取分类和图片）
      const menu = app.globalData.allDishes || dishesUtil.localDishes
      const nameMap = {}
      menu.forEach((d) => { if (!nameMap[d.name]) nameMap[d.name] = d })

      // 按分类分组
      const byCat = {}
      ;(data || []).forEach((row) => {
        const info = nameMap[row.dish_name]
        const cat = info ? info.category : '其他'
        if (!byCat[cat]) byCat[cat] = []
        byCat[cat].push({
          dishName: row.dish_name,
          qty: Number(row.total_qty) || 0,
          image: info ? info.image : '',
          dishId: info ? info.id : null,
        })
      })

      // 每组算百分比，排序
      const groupList = Object.keys(byCat).map((cat) => {
        const list = byCat[cat].sort((a, b) => b.qty - a.qty)
        const max = list.length ? list[0].qty : 1
        list.forEach((x) => { x.percent = Math.round(x.qty / max * 100) })
        return { category: cat, list }
      })
      // 按组内总数排分类顺序
      groupList.sort((a, b) => {
        const sa = a.list.reduce((s, x) => s + x.qty, 0)
        const sb = b.list.reduce((s, x) => s + x.qty, 0)
        return sb - sa
      })

      const currentCat = groupList.length ? groupList[0].category : ''
      const currentGroup = groupList.find((g) => g.category === currentCat) || null
      this.setData({ groupList, currentCat, currentGroup, loading: false })
    } catch (e) {
      this.setData({ groupList: [], loading: false })
    }
  },

  onCat(e) {
    const cat = e.currentTarget.dataset.cat
    const g = this.data.groupList.find((x) => x.category === cat)
    this.setData({ currentCat: cat, currentGroup: g })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },
})
