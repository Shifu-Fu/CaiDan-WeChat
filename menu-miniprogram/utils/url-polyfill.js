// 微信小程序真机缺少全局 URL / URLSearchParams，云服务 SDK 依赖它们。
// 这里提供轻量 polyfill，覆盖 SDK 用到的：构造、origin/pathname/search/hash、searchParams、toString。

function UrlSearchParamsPolyfill(init) {
  this._map = []
  if (!init) return
  var s = String(init)
  if (s.charAt(0) === '?') s = s.slice(1)
  var pairs = s.split('&')
  for (var i = 0; i < pairs.length; i++) {
    if (!pairs[i]) continue
    var eq = pairs[i].indexOf('=')
    var k = eq >= 0 ? pairs[i].slice(0, eq) : pairs[i]
    var v = eq >= 0 ? pairs[i].slice(eq + 1) : ''
    this._map.push([decodeURIComponentSafe(k.replace(/\+/g, ' ')), decodeURIComponentSafe(v.replace(/\+/g, ' '))])
  }
}

function encodeParam(s) {
  return encodeURIComponent(String(s)).replace(/[!'()*]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
  })
}

function decodeURIComponentSafe(s) {
  try { return decodeURIComponent(s) } catch (e) { return s }
}

UrlSearchParamsPolyfill.prototype.append = function (k, v) {
  this._map.push([String(k), String(v)])
}
UrlSearchParamsPolyfill.prototype.set = function (k, v) {
  k = String(k)
  var hit = false
  for (var i = 0; i < this._map.length; i++) {
    if (this._map[i][0] === k) {
      if (!hit) { this._map[i][1] = String(v); hit = true }
      else this._map.splice(i, 1), i--
    }
  }
  if (!hit) this._map.push([k, String(v)])
}
UrlSearchParamsPolyfill.prototype.get = function (k) {
  for (var i = 0; i < this._map.length; i++) if (this._map[i][0] === String(k)) return this._map[i][1]
  return null
}
UrlSearchParamsPolyfill.prototype.has = function (k) {
  return this._map.some(function (p) { return p[0] === String(k) })
}
UrlSearchParamsPolyfill.prototype.delete = function (k) {
  this._map = this._map.filter(function (p) { return p[0] !== String(k) })
}
UrlSearchParamsPolyfill.prototype.forEach = function (cb) {
  this._map.forEach(function (p) { cb(p[1], p[0]) })
}
UrlSearchParamsPolyfill.prototype.toString = function () {
  return this._map.map(function (p) { return encodeParam(p[0]) + '=' + encodeParam(p[1]) }).join('&')
}

function URLPolyfill(input, base) {
  var str = String(input)
  if (base && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(str)) {
    // 简单相对路径拼接
    var baseStr = String(base)
    var cut = baseStr.indexOf('?') >= 0 ? baseStr.indexOf('?') : (baseStr.indexOf('#') >= 0 ? baseStr.indexOf('#') : baseStr.length)
    var basePath = baseStr.slice(0, cut)
    str = basePath.replace(/\/[^/]*$/, '/') + str
  }
  var match = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(str)
  if (!match) throw new Error('Invalid URL: ' + str)
  this.protocol = match[1].toLowerCase() + ':'
  this.host = match[2]
  this.hostname = match[2].split(':')[0]
  var portMatch = /:(\d+)$/.exec(match[2])
  this.port = portMatch ? portMatch[1] : ''
  this.pathname = match[3] || '/'
  this.search = match[4] || ''
  this.hash = match[5] || ''
  this.origin = this.protocol + '//' + this.host
  this.searchParams = new UrlSearchParamsPolyfill(this.search)
}
URLPolyfill.prototype.toString = function () {
  var q = this.searchParams.toString()
  return this.origin + this.pathname + (q ? '?' + q : '') + this.hash
}
URLPolyfill.prototype.toJSON = function () { return this.toString() }

// 仅在真机缺失时注入
if (typeof globalThis.URLSearchParams === 'undefined') {
  globalThis.URLSearchParams = UrlSearchParamsPolyfill
}
if (typeof globalThis.URL === 'undefined') {
  globalThis.URL = URLPolyfill
}

module.exports = { URL: globalThis.URL, URLSearchParams: globalThis.URLSearchParams }
