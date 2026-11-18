// 购物车：本地缓存，跨页面共享
const KEY = 'menu_cart_v1'

function getCart() {
  try {
    return wx.getStorageSync(KEY) || []
  } catch (e) {
    return []
  }
}

function saveCart(cart) {
  try {
    wx.setStorageSync(KEY, cart)
  } catch (e) {}
}

function add(dish, delta = 1) {
  const cart = getCart()
  const found = cart.find((x) => x.id === dish.id)
  if (found) {
    found.qty += delta
    if (found.qty <= 0) {
      return remove(dish.id)
    }
  } else if (delta > 0) {
    cart.push({
      id: dish.id,
      name: dish.name,
      image: dish.image,
      price: dish.price,
      qty: delta,
    })
  }
  saveCart(cart)
  return cart
}

function setQty(id, qty) {
  const cart = getCart()
  const found = cart.find((x) => x.id === id)
  if (!found) return cart
  if (qty <= 0) return remove(id)
  found.qty = qty
  saveCart(cart)
  return cart
}

function remove(id) {
  const cart = getCart().filter((x) => x.id !== id)
  saveCart(cart)
  return cart
}

function clear() {
  saveCart([])
}

function count() {
  return getCart().reduce((s, x) => s + x.qty, 0)
}

function total() {
  return getCart().reduce((s, x) => s + x.price * x.qty, 0)
}

module.exports = { getCart, saveCart, add, setQty, remove, clear, count, total }
