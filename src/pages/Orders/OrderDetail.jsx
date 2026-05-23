import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  FiArrowLeft,
  FiDownload,
  FiShoppingCart,
  FiStar,
  FiRotateCcw,
  FiX,
} from 'react-icons/fi'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import OrderTrackingTimeline from '../../components/OrderTrackingTimeline/OrderTrackingTimeline'
import { processPayment } from '../../utils/payment'
import io from 'socket.io-client'
import './Orders.css'

const socket = io('http://localhost:5500')

const CANCELLABLE = ['Pending', 'Confirmed', 'Packed']

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToCart } = useCart()
  const { showToast } = useToast()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [returnReason, setReturnReason] = useState('')
  const [showReturnForm, setShowReturnForm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const fetchOrder = async () => {
    try {
      const { data } = await api.get(`/orders/${id}`)
      setOrder(data)
    } catch (err) {
      showToast(err.response?.data?.message || 'Order not found', 'error')
      navigate('/orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()
    const onStatus = (payload) => {
      if (String(payload.orderId) === String(id)) {
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                orderStatus: payload.orderStatus,
                statusHistory: payload.statusHistory,
                deliveryInfo: payload.deliveryInfo,
                isPaid: payload.isPaid,
                isDelivered: payload.isDelivered,
                trackingTimeline: payload.timeline,
              }
            : prev
        )
      }
    }
    socket.on('order_status_update', onStatus)
    return () => socket.off('order_status_update', onStatus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order?')) return
    try {
      const { data } = await api.put(`/orders/${id}/cancel`, { note: cancelReason || 'Cancelled by customer' })
      setOrder(data)
      showToast('Order cancelled', 'success')
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not cancel order', 'error')
    }
  }

  const handleReturn = async () => {
    if (!returnReason.trim()) {
      showToast('Please enter a return reason', 'error')
      return
    }
    try {
      const { data } = await api.put(`/orders/${id}/return`, { reason: returnReason })
      setOrder(data)
      setShowReturnForm(false)
      showToast('Return request submitted', 'success')
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not request return', 'error')
    }
  }

  const handleBuyAgain = async (item) => {
    try {
      const { data: product } = await api.get(`/products/${item.product}`)
      const result = addToCart(product, item.qty, { variantKey: item.variantKey })
      if (result?.ok === false) {
        showToast(result.message || 'Could not add to cart', 'error')
        return
      }
      showToast(`${item.name} added to cart`, 'success')
      navigate('/cart')
    } catch {
      showToast('Product unavailable', 'error')
    }
  }

  const handlePayNow = async () => {
    try {
      await processPayment({
        amount: order.totalPrice,
        name: order.shippingAddress.name,
        email: user?.email,
        contact: order.shippingAddress.phone,
        orderId: order._id,
      })
      showToast('Payment successful!', 'success')
      fetchOrder()
    } catch {
      showToast('Payment failed or cancelled', 'error')
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: '48px 0', textAlign: 'center' }}>
        Loading order details...
      </div>
    )
  }

  if (!order) return null

  const invoiceNo = order.invoiceNumber || `HK-${order._id.slice(-8).toUpperCase()}`
  const paymentId = order.paymentResult?.id || (order.isPaid ? '—' : 'Pending')
  const canCancel = CANCELLABLE.includes(order.orderStatus)
  const isDelivered = order.orderStatus === 'Delivered'
  const isCancelled = order.orderStatus === 'Cancelled'
  const isReturned = ['Returned', 'Refunded'].includes(order.orderStatus)
  const productDiscount = Math.max(
    0,
    (order.orderItems || []).reduce((s, i) => s + (i.mrp || i.price) * i.qty, 0) - (order.itemsPrice || 0)
  )

  return (
    <div className="orders-page order-detail-page">
      <div className="container">
        <Link to="/orders" className="order-back-link">
          <FiArrowLeft size={16} /> Back to My Orders
        </Link>

        <div className="order-detail-header card">
          <div>
            <h1>Order #{order._id.slice(-8).toUpperCase()}</h1>
            <p className="order-detail-sub">
              Placed on{' '}
              {new Date(order.createdAt).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <span className={`order-status-pill status-${order.orderStatus.toLowerCase().replace(/\s/g, '-')}`}>
            {order.orderStatus}
          </span>
        </div>

        <OrderTrackingTimeline order={order} />

        <div className="order-detail-grid">
          <section className="card order-detail-section">
            <h3>Order Summary</h3>
            <ul className="order-summary-list">
              <li><span>Order ID</span><strong>{order._id}</strong></li>
              <li><span>Invoice</span><strong>{invoiceNo}</strong></li>
              <li><span>Payment Method</span><strong>{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay'}</strong></li>
              <li><span>Payment ID</span><strong>{paymentId}</strong></li>
              <li><span>Payment Status</span><strong>{order.isPaid ? 'Paid' : 'Pending'}</strong></li>
            </ul>
          </section>

          <section className="card order-detail-section">
            <h3>Delivery Address</h3>
            <address className="order-address">
              <strong>{order.shippingAddress.name}</strong>
              <span>{order.shippingAddress.phone}</span>
              <span>{order.shippingAddress.address}</span>
              <span>
                {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}
              </span>
            </address>
          </section>
        </div>

        <section className="card order-detail-section">
          <h3>Ordered Products</h3>
          <div className="order-items-detail">
            {order.orderItems.map((item) => (
              <div key={item._id || item.product} className="order-item-row">
                <img src={item.image || '/placeholder.png'} alt={item.name} />
                <div className="order-item-meta">
                  <strong>{item.name}</strong>
                  {item.variantLabel && <span>Color: {item.variantLabel}</span>}
                  <span>Qty: {item.qty} × ₹{item.price.toLocaleString('en-IN')}</span>
                </div>
                <div className="order-item-right">
                  <span className="order-item-total">₹{(item.qty * item.price).toLocaleString('en-IN')}</span>
                  <div className="order-item-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => handleBuyAgain(item)}>
                      <FiShoppingCart size={13} /> Buy Again
                    </button>
                    {isDelivered && (
                      <>
                        <Link to={`/product/${item.product}`} className="btn btn-outline btn-sm">
                          <FiStar size={13} /> Write Review
                        </Link>
                        {/* <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setShowReturnForm(true)}
                        >
                          <FiRotateCcw size={13} /> Return
                        </button> */}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card order-detail-section">
          <h3>Payment Details</h3>
          <div className="order-payment-rows">
            <div className="order-payment-row"><span>Subtotal</span><span>₹{(order.itemsPrice || 0).toLocaleString('en-IN')}</span></div>
            {productDiscount > 0 && (
              <div className="order-payment-row discount"><span>Product Discount</span><span>−₹{productDiscount.toLocaleString('en-IN')}</span></div>
            )}
            {(order.couponDiscount || 0) > 0 && (
              <div className="order-payment-row discount"><span>Coupon ({order.couponCode})</span><span>−₹{order.couponDiscount.toLocaleString('en-IN')}</span></div>
            )}
            <div className="order-payment-row"><span>Shipping</span><span>{order.shippingPrice === 0 ? 'FREE' : `₹${order.shippingPrice}`}</span></div>
            <div className="order-payment-row total"><span>Grand Total</span><span>₹{order.totalPrice.toLocaleString('en-IN')}</span></div>
          </div>
        </section>

        {isCancelled && (
          <section className="card order-detail-section order-alert cancelled">
            <h3>Order Cancelled</h3>
            <p>{order.statusHistory?.find((h) => h.status === 'Cancelled')?.note || 'This order was cancelled.'}</p>
            {order.refundStatus && order.refundStatus !== 'None' && (
              <p><strong>Refund status:</strong> {order.refundStatus}</p>
            )}
          </section>
        )}

        {isReturned && (
          <section className="card order-detail-section order-alert returned">
            <h3>{order.orderStatus}</h3>
            <p>{order.statusHistory?.find((h) => h.status === order.orderStatus)?.note || 'Return processed.'}</p>
          </section>
        )}

        {showReturnForm && (
          <section className="card order-detail-section">
            <h3>Request Return</h3>
            <textarea
              className="input"
              rows={3}
              placeholder="Reason for return..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
            <div className="order-action-bar">
              <button type="button" className="btn btn-ghost" onClick={() => setShowReturnForm(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleReturn}>Submit Return</button>
            </div>
          </section>
        )}

        <div className="order-action-bar card">
          {!order.isPaid && order.paymentMethod === 'razorpay' && order.orderStatus === 'Pending' && (
            <button type="button" className="btn btn-primary" onClick={handlePayNow}>Pay Now</button>
          )}
          {canCancel && (
            <>
              <input
                className="input order-cancel-input"
                placeholder="Cancellation reason (optional)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <button type="button" className="btn btn-danger" onClick={handleCancel}>
                <FiX size={14} /> Cancel Order
              </button>
            </>
          )}
          {/* {isDelivered && (
            <button type="button" className="btn btn-outline" onClick={() => window.print()}>
              <FiDownload size={14} /> Download Invoice
            </button>
          )} */}
        </div>
      </div>
    </div>
  )
}
