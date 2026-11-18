const cloudUtil = require('./utils/cloud.js')

App({
  globalData: {
    appName: '家常菜点单',
    signedIn: false,
    loginState: 'pending',   // pending | success | failed
    loginError: '',
    userInfo: null,
    allDishes: null,         // 合并后的完整菜单缓存（本地+云端）
  },

  onLaunch() {
    this.initSession()
  },

  async initSession() {
    this.globalData.loginState = 'pending'
    try {
      if (!cloudUtil.isReady()) {
        throw new Error(cloudUtil.errorDetail ? cloudUtil.errorDetail() : '云服务未就绪')
      }
      const session = await cloudUtil.ensureSignedIn()
      this.globalData.signedIn = true
      this.globalData.loginState = 'success'
      this.globalData.loginError = ''
      this.globalData.userInfo = session && session.user ? session.user : null
    } catch (e) {
      this.globalData.signedIn = false
      this.globalData.loginState = 'failed'
      this.globalData.loginError = e && e.message ? e.message : '登录失败'
    }
    this.globalData.sessionChecked = true
    if (this.sessionReadyCallback) this.sessionReadyCallback(this.globalData.signedIn)
  },

  // 供页面手动触发重试
  retryLogin() {
    return this.initSession()
  },

  onSessionReady(cb) {
    if (this.globalData.signedIn || this.globalData.sessionChecked) {
      cb(this.globalData.signedIn)
    } else {
      this.sessionReadyCallback = cb
    }
  },
})
