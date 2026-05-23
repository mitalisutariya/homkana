import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheck, FiMapPin, FiCreditCard, FiShoppingBag, FiTruck, FiAlertCircle, FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { processPayment } from '../../utils/payment'
import api from '../../api'
import './Checkout.css'
import { FaLess } from 'react-icons/fa'

const STEPS = ['Address', 'Payment', 'Review & Place Order']

// Non-deliverable pincodes (demo list)
const NON_DELIVERABLE = ['999999', '000000', '111111']

export default function Checkout() {
  const [step, setStep] = useState(0)
  const [placed, setPlaced] = useState(false)
  const [address, setAddress] = useState({ name: '', phone: '', pincode: '', city: '', state: '', address: '' })
  const [errors, setErrors] = useState({})
  // const [validatingPincode, setValidatingPincode] = useState(false)
  const [pincodeStatus, setPincodeStatus] = useState(null) // 'available' | 'unavailable' | null
  const [deliveryEta, setDeliveryEta] = useState('')
  const [payMethod, setPayMethod] = useState('cod')
  const [selectedSavedAddr, setSelectedSavedAddr] = useState(null)
  const [saveAddress, setSaveAddress] = useState(true)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [lastOrder, setLastOrder] = useState(null)
  const {
    items, totalMRP, totalDiscount, productDiscount,
    shippingPrice, grandTotal, clearCart, refreshCartInventory,
  } = useCart()
  const { isLoggedIn, user, refreshUser } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (!isLoggedIn) {
      showToast('Please login to access checkout', 'info')
      navigate('/auth', { state: { from: '/checkout' } })
    }
  }, [isLoggedIn, navigate, showToast])

  useEffect(() => {
    if (isLoggedIn && !hasLoadedRef.current) {
      refreshUser()
      hasLoadedRef.current = true
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (user?.addresses?.length > 0 && !selectedSavedAddr) {
      const defaultAddr = user.addresses.find(a => a.isDefault) || user.addresses[0]
      selectSavedAddress(defaultAddr)
    }
  }, [user])

  const delivery = shippingPrice
  const finalTotal = grandTotal

  const selectSavedAddress = (addr) => {
    setSelectedSavedAddr(addr._id)
    setAddress({
      name: addr.name || '',
      phone: addr.phone || '',
      pincode: addr.pincode || '',
      city: addr.city || '',
      state: addr.state || '',
      address: addr.address || ''
    })
    setErrors({})
    if (addr.pincode && addr.pincode.length === 6) {
      checkDelivery(addr.pincode)
    }
  }

  const checkDelivery = (pincode) => {
    if (NON_DELIVERABLE.includes(pincode)) {
      setPincodeStatus('unavailable')
      setDeliveryEta('')
    } else {
      setPincodeStatus('available')
      const days = Math.floor(Math.random() * 4) + 2
      const eta = new Date()
      eta.setDate(eta.getDate() + days)
      setDeliveryEta(eta.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }))
    }
  }

  const handlePlaceOrder = async () => {
    if (placingOrder) return // Prevent multiple clicks
    if (!isLoggedIn) {
      showToast('Please login to place an order', 'error')
      navigate('/auth')
      return
    }
    if (pincodeStatus === 'unavailable') {
      showToast('Delivery not available at this pincode', 'error')
      return
    }

    setPlacingOrder(true)
    try {
      const stockCheck = await refreshCartInventory(items)
      if (stockCheck.removed?.length) {
        showToast(`Removed unavailable items: ${stockCheck.removed.map((r) => r.name).join(', ')}`, 'info')
        return
      }
      if (!stockCheck.items?.length) {
        showToast('Your cart is empty', 'info')
        return
      }
      const invalid = stockCheck.items.filter((i) => !i.isValid || (i.stockCount ?? 0) < (i.qty || 1))
      if (invalid.length > 0) {
        showToast(invalid[0]?.stockMessage || 'Some items are out of stock', 'error')
        return
      }

      const orderData = {
        orderItems: items.map((i) => ({
          name: i.name,
          qty: i.qty,
          image: (i.images && i.images[0]) || i.image || '',
          price: i.price,
          product: (typeof i.product === 'object' ? i.product?._id : i.product) || i._id || i.id,
          variantKey: i.variantKey,
        })),
        shippingAddress: address,
        paymentMethod: payMethod === 'cod' ? 'cod' : 'razorpay',
      }

      const { data: createdOrder } = await api.post('/orders', orderData)
      setLastOrder(createdOrder)

      if (saveAddress && !selectedSavedAddr) {
        try {
          await api.put('/auth/address', address)
        } catch (e) { console.error('Address save failed', e) }
      }

      if (payMethod === 'cod') {
        await api.put(`/orders/${createdOrder._id}/pay`, { id: 'COD', status: 'Success' })
        clearCart()
        setPlaced(true)
        showToast('🎉 Order placed successfully!', 'success')
      } else {
        try {
          await processPayment({
            amount: finalTotal,
            name: address.name,
            email: user?.email,
            contact: address.phone,
            orderId: createdOrder._id,
          })
          clearCart()
          setPlaced(true)
          showToast('🎉 Payment successful! Order confirmed.', 'success')
        } catch (payErr) {
          try {
            await api.put(`/orders/${createdOrder._id}/release`)
          } catch (releaseErr) {
            console.error('Release order failed', releaseErr)
          }
          throw payErr
        }
      }
    } catch (error) {
      if (error.status === 'cancelled') {
        showToast('Payment cancelled. Your order was not charged.', 'info')
      } else {
        showToast(error.message || error.response?.data?.message || 'Error placing order', 'error')
      }
    } finally {
      setPlacingOrder(false)
    }
  }

  const validateField = (name, value) => {
    let error = ''
    if (name === 'name') {
      if (!value) error = 'Full name is required'
      else if (value.length < 3) error = 'Name must be at least 3 characters'
    } else if (name === 'phone') {
      const clean = value.replace(/\D/g, '')
      if (!clean) error = 'Mobile number is required'
      else if (!/^[6-9]\d{9}$/.test(clean)) error = 'Enter valid 10-digit mobile number (starting with 6-9)'
    } else if (name === 'pincode') {
      if (!value) error = 'PIN code is required'
      else if (!/^\d{6}$/.test(value)) error = 'Enter valid 6-digit PIN code'
    } else if (name === 'city') {
      if (!value) error = 'City is required'
    } else if (name === 'state') {
      if (!value) error = 'State is required'
    } else if (name === 'address') {
      if (!value) error = 'Address is required'
      else if (value.length < 10) error = 'Please provide full address (house no, street, area)'
    }
    setErrors(prev => ({ ...prev, [name]: error }))
    return !error
  }

  const handleAddressChange = (e) => {
    const { name, value } = e.target

    setAddress(prev => ({
      ...prev,
      [name]: value
    }))

    setSelectedSavedAddr(null)

    // Validate fields
    if (name !== 'landmark') {
      validateField(name, value)
    }

    // PINCODE CHECK
    if (name === 'pincode') {
      if (/^\d{6}$/.test(value)) {
        checkDelivery(value)
      } else {
        setPincodeStatus(null)
        setDeliveryEta('')
      }
    }
  }



  const validateAddress = () => {
    const fields = ['name', 'phone', 'pincode', 'city', 'state', 'address']
    let isValid = true
    fields.forEach(f => { if (!validateField(f, address[f])) isValid = false })
    if (pincodeStatus === 'unavailable') {
      showToast('Delivery is not available at this pincode', 'error')
      isValid = false
    }
    if (!pincodeStatus && address.pincode.length === 6) {
      showToast('Please wait for pincode verification', 'info')
      isValid = false
    }
    return isValid
  }

  const handleNextStep = () => {
    if (step === 0 && !validateAddress()) return
    setStep(step + 1)
  }

  const handleDeleteSavedAddr = async (addrId) => {
    try {
      await api.delete(`/auth/address/${addrId}`)
      refreshUser()
      showToast('Address deleted', 'info')
      if (selectedSavedAddr === addrId) {
        setSelectedSavedAddr(null)
        setAddress({ name: '', phone: '', pincode: '', city: '', state: '', address: '' })
      }
    } catch (e) { showToast('Failed to delete address', 'error') }
  }

  if (placed) return (
    <div className="checkout-success">
      <div className="success-card">
        <div className="success-icon-wrap"><div className="success-check-circle"><FiCheck size={40} /></div></div>
        <h2>Order Placed Successfully!</h2>
        <p>Your order has been confirmed and will be delivered by <strong>{deliveryEta || '3-5 business days'}</strong>.</p>
        <div className="order-id-box">Order ID: <strong>#{lastOrder?._id?.toString().toUpperCase()}</strong></div>
        <div className="order-delivery-info">
          <FiTruck size={16} /> Delivering to: <strong>{address.name}</strong>, {address.city} – {address.pincode}
        </div>
        <div className="success-actions">
          <button className="btn btn-primary btn-lg" onClick={() => navigate(lastOrder?._id ? `/orders/${lastOrder._id}` : '/orders')}>Track My Order</button>
          <button className="btn btn-outline btn-lg" onClick={() => navigate('/')}>Continue Shopping</button>
        </div>
      </div>
    </div>
  )

  if (items.length === 0) return (
    <div className="checkout-empty">
      <span style={{ fontSize: '64px' }}>🛒</span>
      <h3>Your cart is empty</h3>
      <p>Add products to your cart before checking out.</p>
      <button className="btn btn-primary btn-lg" onClick={() => navigate('/products')}>Shop Now</button>
    </div>
  )

  return (
    <div className="checkout-page">
      <div className="container">
        <h1 className="checkout-heading">Checkout</h1>

        {/* Step Indicator */}
        <div className="step-indicator">
          {STEPS.map((s, i) => (
            <div key={s} className="step-wrapper">
              <div className={`step-circle ${i < step ? 'done' : i === step ? 'active' : ''}`} onClick={() => i < step && setStep(i)}>
                {i < step ? <FiCheck size={16} /> : i + 1}
              </div>
              <span className={`step-label ${i === step ? 'active' : ''}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`step-line ${i < step ? 'done' : ''}`} />}
            </div>
          ))}
        </div>

        <div className="checkout-layout">
          <div className="checkout-form-area">

            {/* STEP 0: Address */}
            {step === 0 && (
              <div className="checkout-card animate-fadeIn">
                <div className="checkout-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiMapPin size={18} /> Delivery Address</div>
                </div>

                {/* Saved Addresses */}
                {user?.addresses?.length > 0 && (
                  <div className="saved-addresses-section">
                    <h4 className="saved-addr-title">📍 Saved Addresses</h4>
                    <div className="saved-addr-list">
                      {user.addresses.map(a => (
                        <div key={a._id} className={`saved-addr-card ${selectedSavedAddr === a._id ? 'selected' : ''}`} onClick={() => selectSavedAddress(a)}>
                          <div className="saved-addr-radio">
                            <div className={`radio-dot ${selectedSavedAddr === a._id ? 'active' : ''}`} />
                          </div>
                          <div className="saved-addr-details">
                            <div className="saved-addr-name">{a.name} {a.isDefault && <span className="default-badge">Default</span>}</div>
                            <div className="saved-addr-text">{a.address}</div>
                            <div className="saved-addr-meta">{a.city}, {a.state} – {a.pincode}</div>
                            <div className="saved-addr-phone">📞 {a.phone}</div>
                          </div>
                          <button className="saved-addr-delete" onClick={(e) => { e.stopPropagation(); handleDeleteSavedAddr(a._id) }} title="Delete address">
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="addr-divider"><span>or enter a new address</span></div>
                  </div>
                )}

                {/* Address Form */}
                <div className="checkout-form-grid">
                  <div className={`form-group ${errors.name ? 'has-error' : ''}`}>
                    <label className="input-label">Full Name <span className="required">*</span></label>
                    <input name="name" className={`input ${errors.name ? 'error' : ''}`} placeholder="Enter your full name" value={address.name} onChange={handleAddressChange} />
                    {errors.name && <span className="error-text"><FiAlertCircle size={11} /> {errors.name}</span>}
                  </div>

                  <div className={`form-group ${errors.phone ? 'has-error' : ''}`}>
                    <label className="input-label">Mobile Number <span className="required">*</span></label>
                    <div className="phone-input-wrap">
                      <span className="phone-prefix">+91</span>
                      <input name="phone" className={`input phone-input ${errors.phone ? 'error' : ''}`} placeholder="9876543210" maxLength={10} value={address.phone} onChange={handleAddressChange} />
                    </div>
                    {errors.phone && <span className="error-text"><FiAlertCircle size={11} /> {errors.phone}</span>}
                  </div>

                  <div className={`form-group ${errors.pincode ? 'has-error' : ''}`}>
                    <label className="input-label">
                      PIN Code <span className="required">*</span>
                    </label>

                    <input
                      name="pincode"
                      className={`input ${errors.pincode ? 'error' : ''}`}
                      placeholder="Enter 6-digit PIN code"
                      maxLength={6}
                      value={address.pincode}
                      onChange={handleAddressChange}
                    />

                    {errors.pincode && (
                      <span className="error-text">
                        <FiAlertCircle size={11} /> {errors.pincode}
                      </span>
                    )}

                    {pincodeStatus === 'available' && (
                      <div className="delivery-status available">
                        <FiCheck size={13} />
                        Delivery available — Est. by <strong>{deliveryEta}</strong>
                      </div>
                    )}

                    {pincodeStatus === 'unavailable' && (
                      <div className="delivery-status unavailable">
                        <FiAlertCircle size={13} />
                        Sorry, delivery not available at this pincode
                      </div>
                    )}
                  </div>

                  <div className={`form-group ${errors.state ? 'has-error' : ''}`}>
                    <label className="input-label">
                      State <span className="required">*</span>
                    </label>

                    <input
                      name="state"
                      className={`input ${errors.state ? 'error' : ''}`}
                      placeholder="Enter state"
                      value={address.state}
                      onChange={handleAddressChange}
                    />

                    {errors.state && (
                      <span className="error-text">
                        <FiAlertCircle size={11} /> {errors.state}
                      </span>
                    )}
                  </div>

                  <div className={`form-group ${errors.city ? 'has-error' : ''}`}>
                    <label className="input-label">
                      City <span className="required">*</span>
                    </label>

                    <input
                      name="city"
                      className={`input ${errors.city ? 'error' : ''}`}
                      placeholder="Enter city"
                      value={address.city}
                      onChange={handleAddressChange}
                    />

                    {errors.city && (
                      <span className="error-text">
                        <FiAlertCircle size={11} /> {errors.city}
                      </span>
                    )}
                  </div>



                  <div className={`form-group full-width ${errors.address ? 'has-error' : ''}`}>
                    <label className="input-label">Full Address <span className="required">*</span></label>
                    <textarea
                      name="address"
                      className={`input ${errors.address ? 'error' : ''}`}
                      rows={3}
                      placeholder="House No., Building Name, Street, Area, Landmark"
                      value={address.address}
                      onChange={handleAddressChange}
                    />                    {errors.address && <span className="error-text"><FiAlertCircle size={11} /> {errors.address}</span>}
                  </div>

                </div>

                {!selectedSavedAddr && (
                  <label className="save-addr-check">
                    <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                    <span>Save this address for future orders</span>
                  </label>
                )}

                <button className="btn btn-primary btn-lg w-full" onClick={handleNextStep} disabled={pincodeStatus === 'unavailable'}>
                  {pincodeStatus === 'unavailable' ? 'Delivery Not Available' : 'Confirm Address & Continue →'}
                </button>
              </div>
            )}

            {/* STEP 1: Payment */}
            {step === 1 && (
              <div className="checkout-card animate-fadeIn">
                <div className="checkout-card-header"><FiCreditCard size={18} /> Payment Method</div>
                <div className="confirmed-addr-strip">
                  <FiMapPin size={14} />
                  <span>Delivering to <strong>{address.name}</strong>, {address.city} – {address.pincode}</span>
                  <button className="btn-link" onClick={() => setStep(0)}><FiEdit2 size={12} /> Change</button>
                </div>
                <div className="payment-options">
                  {[
                    { id: 'cod', label: 'Cash on Delivery', icon: '💰', desc: 'Pay when order arrives' },
                  ].map(opt => (
                    <label key={opt.id} className={`payment-option ${payMethod === opt.id ? 'selected' : ''}`}>
                      <input type="radio" name="payment" value={opt.id} checked={payMethod === opt.id} onChange={() => setPayMethod(opt.id)} />
                      <span className="pay-icon">{opt.icon}</span>
                      <div>
                        <span className="pay-label">{opt.label}</span>
                        <span className="pay-desc">{opt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="checkout-nav">
                  <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
                  <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>Review Order →</button>
                </div>
              </div>
            )}

            {/* STEP 2: Review */}
            {step === 2 && (
              <div className="checkout-card animate-fadeIn">
                <div className="checkout-card-header"><FiShoppingBag size={18} /> Review Your Order</div>
                <div className="review-items">
                  {items.map(item => (
                    <div key={item._id || item.id} className="review-item">
                      <img src={item.images[0]} alt={item.name} className="review-item-img" />
                      <div className="review-item-info">
                        <span className="review-item-name">{item.name}</span>
                        <span className="review-item-qty">Qty: {item.qty}</span>
                      </div>
                      <span className="review-item-price">₹{(item.price * item.qty).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
                <div className="review-address-box">
                  <div className="review-box-header"><FiMapPin size={14} /> <strong>Delivering to</strong> <button className="btn-link" onClick={() => setStep(0)}><FiEdit2 size={12} /> Change</button></div>
                  <div className="review-box-body">
                    <strong>{address.name}</strong> &middot; {address.phone}<br />
                    {address.address}<br />
                    {address.city}, {address.state} – {address.pincode}
                  </div>
                  {deliveryEta && <div className="review-eta"><FiTruck size={13} /> Estimated delivery by <strong>{deliveryEta}</strong></div>}
                </div>
                <div className="review-payment-box">
                  <strong>💳 Payment:</strong> <span>Cash on Delivery</span>
                </div>
                <div className="checkout-nav">
                  <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                  <button className="btn btn-accent btn-lg" onClick={handlePlaceOrder} disabled={placingOrder}>
                    {placingOrder ? 'Placing Order...' : `🎉 Place Order — ₹${finalTotal.toLocaleString('en-IN')}`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="checkout-summary card">
            <h3 className="summary-title">Order Summary</h3>
            <div className="summary-rows">
              <div className="summary-row"><span>MRP Total</span><span>₹{totalMRP.toLocaleString('en-IN')}</span></div>
              {productDiscount > 0 && (
                <div className="summary-row discount"><span>Product Discount</span><span>−₹{productDiscount.toLocaleString('en-IN')}</span></div>
              )}
              <div className="summary-row"><span>Delivery</span><span className={delivery === 0 ? 'free' : ''}>{delivery === 0 ? 'FREE' : `₹${delivery}`}</span></div>
              <div className="summary-divider" />
              <div className="summary-row total"><span>Grand Total</span><span>₹{finalTotal.toLocaleString('en-IN')}</span></div>
            </div>
            <div className="summary-items-count">{items.length} item{items.length > 1 ? 's' : ''} in this order</div>
            <div className="summary-secure">🔒 100% Secure Payments</div>
          </div>
        </div>
      </div>
    </div>
  )
}
