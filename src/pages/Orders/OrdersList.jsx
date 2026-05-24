import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiPackage, FiChevronRight } from 'react-icons/fi'
import api from '../../api'
import io from 'socket.io-client'
import './Orders.css'

const socket = io('https://homkana.onrender.com')

const statusClass = (status) =>
  `order-status-pill status-${(status || '').toLowerCase().replace(/\s/g, '-')}`

export default function OrdersList() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchOrders = () => {
    setLoading(true)
    api
      .get('/orders/myorders')
      .then((res) => setOrders(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchOrders()
    const onUpdate = () => fetchOrders()
    socket.on('order_status_update', onUpdate)
    socket.on('admin_activity', onUpdate)
    return () => {
      socket.off('order_status_update', onUpdate)
      socket.off('admin_activity', onUpdate)
    }
  }, [])

  return (
    <div className="orders-page">
      <div className="container">
        <div className="orders-page-header">
          <h1>My Orders</h1>
          <Link to="/products" className="btn btn-outline btn-sm">Continue Shopping</Link>
        </div>

        {loading ? (
          <p className="orders-empty">Loading orders...</p>
        ) : orders.length === 0 ? (
          <div className="orders-empty card">
            <FiPackage size={48} />
            <p>You have no orders yet.</p>
            <Link to="/products" className="btn btn-primary">Start Shopping</Link>
          </div>
        ) : (
          <div className="orders-list-page">
            {orders.map((order) => {
              const item = order.orderItems?.[0]
              const paymentLabel =
                order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online (Razorpay)'
              return (
                <div key={order._id} className="order-list-card card">
                  <div className="order-list-card-top">
                    <div>
                      <span className="order-list-id">Order #{order._id.slice(-8).toUpperCase()}</span>
                      <span className="order-list-date">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <span className={statusClass(order.orderStatus)}>{order.orderStatus}</span>
                  </div>
                  <div className="order-list-card-body">
                    <img
                      src={item?.image || '/placeholder.png'}
                      alt={item?.name || 'Product'}
                      className="order-list-img"
                    />
                    <div className="order-list-info">
                      <p className="order-list-name">
                        {item?.name || 'Order items'}
                        {order.orderItems.length > 1 && ` +${order.orderItems.length - 1} more`}
                      </p>
                      <p className="order-list-meta">Payment: {paymentLabel}</p>
                      <p className="order-list-total">₹{order.totalPrice.toLocaleString('en-IN')}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/orders/${order._id}`)}
                    >
                      View Details <FiChevronRight />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
