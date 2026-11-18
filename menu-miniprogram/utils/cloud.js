// 云服务客户端：安全初始化。任何初始化失败都不能拖垮引用它的页面。
let cloud = null
let initError = null

// 必须在 require SDK 之前补齐真机缺失的 URL / URLSearchParams
try { require('./url-polyfill.js') } catch (e) {}

try {
  const { createMiniProgramWorkBuddyCloud } = require('../vendor/cloud-sdk/miniprogram.js')
  const publicConfig = require('../config.js')

  // 诊断包装是可选的：失败就用原始 wx，绝不能让它拖垮云功能
  let finalWx = wx
  try {
    const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics')
    finalWx = createDiagnosticWx(wx) || wx
  } catch (diagErr) {}

  cloud = createMiniProgramWorkBuddyCloud({
    endpoint: publicConfig.endpoint,
    publishableKey: publicConfig.publishableKey,
    wx: finalWx,
  })
} catch (e) {
  initError = e
  // 只打印摘要，不打印完整错误对象
  console.error('[cloud] init failed:', e && e.message ? e.message : e)
}

// 微信登录：换取 WorkBuddy 会话
function signIn() {
  return new Promise((resolve, reject) => {
    if (!cloud) {
      reject(new Error('云服务未初始化：' + (initError && initError.message ? initError.message : '未知原因')))
      return
    }
    wx.login({
      success: async ({ code }) => {
        try {
          const appid = wx.getAccountInfoSync().miniProgram.appId
          const { data: session, error } = await cloud.auth.signInWithWechat(code, appid)
          if (error) {
            reject(new Error(error.message || '微信登录失败'))
            return
          }
          resolve(session)
        } catch (e) {
          reject(e)
        }
      },
      fail: (e) => reject(new Error(e.errMsg || 'wx.login 失败')),
    })
  })
}

// 确保已登录
async function ensureSignedIn() {
  if (!cloud) throw new Error('云服务未初始化')
  const { data: session } = await cloud.auth.getSession()
  if (session) return session
  return signIn()
}

// 供需要云功能的页面按需取用；未就绪时抛出可读错误
function getCloud() {
  if (!cloud) throw new Error('云服务未初始化：' + (initError && initError.message ? initError.message : '请重新发布后再试'))
  return cloud
}

function errorDetail() {
  return initError && initError.message ? initError.message : ''
}

module.exports = { cloud, signIn, ensureSignedIn, getCloud, errorDetail, isReady: function () { return !!cloud } }
