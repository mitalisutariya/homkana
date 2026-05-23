import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import api from '../api'
import { useAuth } from './AuthContext'
import { calcShipping, getCartLineKey, getEffectiveStock } from '../utils/pricing'
import { buildCartLine, toCartSyncPayload } from '../utils/cartItem'

const CartContext = createContext()
export const useCart = () => useContext(CartContext)

const socket = io('http://localhost:5500')

export function CartProvider({ children }) {
  const { user, refreshUser, updateUserCart } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const isInitialMount = useRef(true)
  const syncInFlight = useRef(false)

  useEffect(() => {
    if (user) {
      setItems(Array.isArray(user.cart) ? user.cart : [])
    } else {
      const saved = localStorage.getItem('cartItems')
      setItems(saved ? JSON.parse(saved) : [])
    }
    setLoading(false)
  }, [user?._id, user?.cart])

  useEffect(() => {
    if (!user) {
      localStorage.setItem('cartItems', JSON.stringify(items))
    }
  }, [items, user])

  const syncToDB = async (updatedItems) => {
    let token = user?.token
    if (!token) {
      try {
        const saved = localStorage.getItem('userInfo')
        token = saved ? JSON.parse(saved).token : null
      } catch {
        token = null
      }
    }
    if (!token) return { ok: false }

    if (syncInFlight.current) {
      await new Promise((r) => setTimeout(r, 80))
    }

    syncInFlight.current = true
    try {
      const payload = updatedItems
        .map((item) => toCartSyncPayload(item))
        .filter(Boolean)

      const { data } = await api.put('/auth/cart', { cart: payload })
      const serverCart = Array.isArray(data?.cart) ? data.cart : []
      setItems(serverCart)
      updateUserCart(serverCart)
      return { ok: true, cart: serverCart }
    } catch (err) {
      console.error('Cart sync failed:', err)
      return { ok: false, error: err }
    } finally {
      syncInFlight.current = false
    }
  }

  const refreshCartInventory = async (cartItems = items) => {
    if (!cartItems?.length) return { valid: true, items: [], removed: [] }

    try {
      const { data } = await api.post('/products/validate-cart', {
        items: cartItems.map((i) => ({
          product: i._id || i.id || i.product,
          variantKey: i.variantKey,
          qty: i.qty,
          name: i.name,
        })),
      })

      const merged = []

      cartItems.forEach((item, index) => {
        const live = data.items[index]
        if (!live || !live.product || live.message === 'Product not found') {
          return
        }

        merged.push({
          ...item,
          _id: live.product,
          id: live.product,
          product: live.product,
          name: live.name || item.name,
          stockCount: live.availableStock,
          inStock: live.inStock,
          isValid: live.isValid,
          stockMessage: live.message === 'OK' ? undefined : live.message,
          price: live.price ?? item.price,
          mrp: live.mrp ?? item.mrp,
          discount: live.discount ?? item.discount,
          brand: live.brand ?? item.brand,
          category: live.category ?? item.category,
          images: live.images || item.images,
        })
      })

      setItems(merged)
      if (user) await syncToDB(merged)

      if (data.removed?.length) {
        return {
          valid: false,
          items: merged,
          removed: data.removed,
          removedNames: data.removed.map((r) => r.name).join(', '),
        }
      }

      return {
        valid: data.valid && merged.length === cartItems.length,
        items: merged,
        removed: data.removed || [],
      }
    } catch (err) {
      console.error('Cart inventory refresh failed:', err)
      return { valid: false, items: cartItems, removed: [], error: err.message }
    }
  }

  useEffect(() => {
    const onStockUpdate = () => {
      if (items.length) refreshCartInventory(items)
    }
    socket.on('stock_update', onStockUpdate)
    return () => socket.off('stock_update', onStockUpdate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  useEffect(() => {
    const mergeCarts = async () => {
      if (user && !isInitialMount.current) {
        const savedGuestCart = localStorage.getItem('cartItems')
        const guestItems = savedGuestCart ? JSON.parse(savedGuestCart) : []

        if (guestItems.length > 0) {
          const merged = [...(user.cart || [])]
          guestItems.forEach((gItem) => {
            const pid = gItem._id || gItem.id
            const lineKey = getCartLineKey(pid, gItem.variantKey)
            const existing = merged.find(
              (u) => getCartLineKey(u._id || u.id, u.variantKey) === lineKey
            )
            if (existing) {
              existing.qty += gItem.qty
            } else {
              merged.push(gItem)
            }
          })

          try {
            const result = await syncToDB(merged)
            if (result.ok) {
              localStorage.removeItem('cartItems')
              await refreshUser()
            }
          } catch (err) {
            console.error('Failed to merge cart:', err)
          }
        }
      }
      isInitialMount.current = false
    }

    mergeCarts()
  }, [user])

  const addToCart = (product, qty = 1, options = {}) => {
    const variantKey = options.variantKey || null
    const variant = variantKey
      ? product.variants?.find((v) => String(v._id) === String(variantKey) || v.sku === variantKey)
      : null

    const available = getEffectiveStock(product, variantKey)
    if (available <= 0) {
      return { ok: false, message: 'This item is out of stock' }
    }

    const userInfoStr = localStorage.getItem('userInfo')
    const userName = userInfoStr ? JSON.parse(userInfoStr).name : 'Guest'

    socket.emit('cart_addition', {
      user: userName,
      productName: product.name,
      productId: product._id || product.id,
    })

    const pid = product._id || product.id
    const lineKey = getCartLineKey(pid, variantKey)

    let result = { ok: true }
    setItems((prev) => {
      const existing = prev.find(
        (i) => getCartLineKey(i._id || i.id, i.variantKey) === lineKey
      )
      const nextQty = (existing?.qty || 0) + qty
      if (nextQty > available) {
        result = { ok: false, message: `Only ${available} units available` }
        return prev
      }

      const newLine = buildCartLine(product, existing ? nextQty : qty, variantKey, variant)
      if (!newLine) {
        result = { ok: false, message: 'Invalid product' }
        return prev
      }

      let updated
      if (existing) {
        updated = prev.map((i) =>
          getCartLineKey(i._id || i.id, i.variantKey) === lineKey ? newLine : i
        )
      } else {
        updated = [...prev, newLine]
      }

      if (user) {
        syncToDB(updated).then((syncResult) => {
          if (!syncResult.ok) result = { ok: false, message: 'Could not save cart' }
        })
      }

      return updated
    })
    return result
  }

  const removeFromCart = async (id, variantKey) => {
    const lineKey = getCartLineKey(id, variantKey)
    const updated = items.filter(
      (i) => getCartLineKey(i._id || i.id, i.variantKey) !== lineKey
    )
    setItems(updated)

    if (!user) return { ok: true }

    const result = await syncToDB(updated)
    return result.ok ? { ok: true } : { ok: false, message: 'Could not remove item. Try again.' }
  }

  const updateQty = async (id, qty, variantKey) => {
    const lineKey = getCartLineKey(id, variantKey)
    if (qty < 1) return removeFromCart(id, variantKey)

    const item = items.find(
      (i) => getCartLineKey(i._id || i.id, i.variantKey) === lineKey
    )
    const available = getEffectiveStock(item, item?.variantKey)
    if (qty > available) return { ok: false, message: `Only ${available} units available` }

    const updated = items.map((i) =>
      getCartLineKey(i._id || i.id, i.variantKey) === lineKey
        ? buildCartLine(i, qty, i.variantKey) || { ...i, qty }
        : i
    )
    setItems(updated)

    if (!user) return { ok: true }
    const result = await syncToDB(updated)
    return result.ok ? { ok: true } : { ok: false, message: 'Could not update quantity' }
  }

  const clearCart = async () => {
    setItems([])
    if (user) {
      await syncToDB([])
    } else {
      localStorage.removeItem('cartItems')
    }
  }

  const totalItems = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0)
  const totalPrice = items.reduce(
    (sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0),
    0
  )
  const totalMRP = items.reduce(
    (sum, i) => sum + (Number(i.mrp) || Number(i.price) || 0) * (Number(i.qty) || 0),
    0
  )
  const productDiscount = Math.max(0, totalMRP - totalPrice)
  const shippingPrice = calcShipping(totalPrice)
  const grandTotal = Math.max(0, totalPrice + shippingPrice)
  const totalDiscount = productDiscount

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        totalItems,
        totalPrice,
        totalMRP,
        totalDiscount,
        productDiscount,
        shippingPrice,
        grandTotal,
        loading,
        refreshCartInventory,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}
