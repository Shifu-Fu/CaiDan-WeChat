// 用户资料：昵称 + 头像。图片以 base64 data URL 存数据库（小程序SDK不支持二进制body上传）
const CACHE_KEY = 'user_profile_cache_v1'

function getCached() {
  try {
    return wx.getStorageSync(CACHE_KEY) || { nickName: '', avatarUrl: '', avatarData: '' }
  } catch (e) {
    return { nickName: '', avatarUrl: '', avatarData: '' }
  }
}

function cache(profile) {
  try { wx.setStorageSync(CACHE_KEY, profile) } catch (e) {}
}

// 通用：压缩本地图片为 base64 data URL（小程序SDK只能传字符串，故图片存数据库）
function imageToDataUrl(tempFilePath, maxW, quality) {
  maxW = maxW || 600
  quality = quality || 60
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: tempFilePath,
      quality,
      success: (res) => {
        wx.getFileSystemManager().readFile({
          filePath: res.tempFilePath,
          encoding: 'base64',
          success: (r) => resolve('data:image/jpeg;base64,' + r.data),
          fail: reject,
        })
      },
      fail: reject,
    })
  })
}

// 从云端读取我的资料（头像直接是 data URL）
async function loadFromCloud(cloud) {
  try {
    const { data, error } = await cloud.database
      .from('user_profiles')
      .select('nick_name, avatar_data')
      .limit(1)
    if (error || !data || data.length === 0) return null
    const row = data[0]
    const profile = {
      nickName: row.nick_name || '',
      avatarData: row.avatar_data || '',
      avatarUrl: row.avatar_data || '',
    }
    cache(profile)
    return profile
  } catch (e) {
    return null
  }
}

// 保存资料到云端（含头像 data）
async function saveToCloud(cloud, nickName, avatarData) {
  const { data: existing, error: e1 } = await cloud.database
    .from('user_profiles')
    .select('id')
    .limit(1)

  if (e1) throw new Error(e1.message)
  const payload = { nick_name: nickName, avatar_data: avatarData || '', updated_at: new Date().toISOString() }

  if (existing && existing.length > 0) {
    const { error } = await cloud.database
      .from('user_profiles')
      .update(payload)
      .eq('id', existing[0].id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await cloud.database
      .from('user_profiles')
      .insert(payload)
    if (error) throw new Error(error.message)
  }
}

module.exports = { getCached, cache, imageToDataUrl, loadFromCloud, saveToCloud }
