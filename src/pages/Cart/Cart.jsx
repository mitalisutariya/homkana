import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getEffectiveStock } from '../../utils/pricing'
import { FiTrash2, FiPlus, FiMinus, FiShoppingBag, FiArrowRight } from 'react-icons/fi'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import './Cart.css'


export default function Cart() {
  const {
    items, removeFromCart, updateQty, totalMRP, totalDiscount,
    productDiscount, shippingPrice, grandTotal,
    totalItems, refreshCartInventory,
  } = useCart()
  const [validating, setValidating] = useState(false)
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const delivery = shippingPrice

  useEffect(() => {
    if (user && items.length > 0) {
      refreshCartInventory(items).then((result) => {
        if (result.removed?.length) {
          showToast(
            `Removed unavailable items: ${result.removed.map((r) => r.name).join(', ')}`,
            'info'
          )
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRemove = async (item) => {
    const result = await removeFromCart(item._id || item.id, item.variantKey)
    if (result?.ok === false) {
      showToast(result.message || 'Could not remove item', 'error')
      return
    }
    showToast(`${item.name} removed from cart`, 'info')
  }

  const handleCheckout = async () => {
    if (!user) {
      showToast('Please login to proceed to checkout', 'info')
      navigate('/auth', { state: { from: '/checkout' } })
      return
    }
    setValidating(true)
    try {
      const result = await refreshCartInventory(items)
      if (result.removed?.length) {
        showToast(
          `Removed from cart: ${result.removed.map((r) => r.name).join(', ')}`,
          'info'
        )
      }
      const invalid = (result.items || []).filter(
        (i) => i.isValid === false || (i.stockCount ?? 0) < (i.qty || 1)
      )
      if (!result.items?.length) {
        showToast('Your cart is empty', 'info')
        return
      }
      if (invalid.length > 0) {
        showToast(
          invalid[0]?.stockMessage
            ? `${invalid[0].name}: ${invalid[0].stockMessage}`
            : 'Update cart quantities before checkout',
          'error'
        )
        return
      }
      navigate('/checkout')
    } finally {
      setValidating(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="cart-empty">
        <span style={{ fontSize: '80px' }}>🛒</span>
        <h2>Your cart is empty!</h2>
        <p>Looks like you haven't added anything to your cart yet.</p>
        <Link to="/products" className="btn btn-primary btn-lg">Start Shopping</Link>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <div className="container">
        <h1 className="cart-heading">My Cart <span className="cart-count">{totalItems} item{totalItems !== 1 ? 's' : ''}</span></h1>

        <div className="cart-layout">
          <div className="cart-items">
            {items.map((item) => {
              const lineStock = item.stockCount ?? getEffectiveStock(item, item.variantKey)
              const outOfStock = lineStock === 0 || item.isValid === false
              return (
                <div key={`${item._id || item.id}-${item.variantKey || 'base'}`} className="cart-item card">
                  <Link to={`/product/${item._id || item.id}`} className="cart-item-img-wrap">
                    <img src={(item.images && item.images[0]) || item.image || '/placeholder.png'} alt={item.name} className="cart-item-img" />
                  </Link>
                  <div className="cart-item-info">
                    <p className="cart-item-brand">{item.brand}</p>
                    <Link to={`/product/${item._id || item.id}`} className="cart-item-name">{item.name}</Link>
                    {item.variantLabel && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Color: {item.variantLabel}</p>}
                    {item.discount > 0 && <span className="cart-item-discount">-{item.discount}% off</span>}
                    <div className="price-box" style={{ marginTop: '4px' }}>
                      <span className="price-current">₹{(item.price || 0).toLocaleString('en-IN')}</span>
                      <span className="price-mrp">₹{(item.mrp || 0).toLocaleString('en-IN')}</span>
                    </div>
                    {!outOfStock && lineStock <= 5 && (
                      <p style={{ fontSize: '12px', color: 'var(--warning)', margin: '4px 0 0' }}>Only {lineStock} left</p>
                    )}
                    {outOfStock && (
                      <p style={{ fontSize: '12px', color: 'var(--error)', margin: '4px 0 0' }}>
                        {item.stockMessage || 'Out of stock'}
                      </p>
                    )}
                    <p className="cart-delivery">
                      {(item.deliveryDays || 3) <= 1 ? '⚡ Delivery Tomorrow' : `🚚 Delivery in ${item.deliveryDays || 3} days`}
                    </p>
                    <div className="cart-item-actions">
                      <div className="qty-stepper">
                        <button type="button" onClick={() => updateQty(item._id || item.id, item.qty - 1, item.variantKey)} disabled={outOfStock}><FiMinus size={14} /></button>
                        <span>{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item._id || item.id, item.qty + 1, item.variantKey)}
                          disabled={outOfStock || item.qty >= lineStock}
                        ><FiPlus size={14} /></button>
                      </div>
                      <button type="button" className="remove-btn" onClick={() => handleRemove(item)}>
                        <FiTrash2 size={15} /> Remove
                      </button>
                    </div>
                  </div>
                  <div className="cart-item-total">
                    <span className="item-total">₹{((item.price || 0) * (item.qty || 1)).toLocaleString('en-IN')}</span>
                    {(item.qty || 1) > 1 && <span className="item-unit">₹{(item.price || 0).toLocaleString('en-IN')} each</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="cart-summary card">
            <h3 className="summary-title">Price Details</h3>
            <div className="summary-rows">
              <div className="summary-row">
                <span>Price ({totalItems} item{totalItems !== 1 ? 's' : ''})</span>
                <span>₹{totalMRP.toLocaleString('en-IN')}</span>
              </div>
              {productDiscount > 0 && (
                <div className="summary-row discount">
                  <span>Discount</span>
                  <span>−₹{productDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Delivery Charges</span>
                <span className={delivery === 0 ? 'free' : ''}>{delivery === 0 ? 'FREE' : `₹${delivery}`}</span>
              </div>
              {delivery === 0 && <p className="free-delivery-note">🎉 You've qualified for free delivery!</p>}
              <div className="summary-divider" />
              <div className="summary-row total">
                <span>Total Amount</span>
                <span>₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
              <p className="summary-savings">You will save ₹{totalDiscount.toLocaleString('en-IN')} on this order</p>
            </div>

            <button type="button" className="btn btn-primary btn-lg w-full checkout-btn" onClick={handleCheckout} disabled={validating}>
              {validating ? 'Checking stock...' : 'Proceed to Checkout'} <FiArrowRight />
            </button>
            <button type="button" className="btn btn-ghost w-full" onClick={() => navigate('/products')}>
              <FiShoppingBag size={15} /> Continue Shopping
            </button>

            <div className="safe-badge">🔒 100% Secure Payments</div>
          </div>
        </div>
      </div>
    </div>
  )
}
