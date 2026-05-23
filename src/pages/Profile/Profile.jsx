import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { FiUser, FiPackage, FiHeart, FiMapPin, FiSettings, FiLogOut, FiChevronRight } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { useWishlist } from '../../context/WishlistContext'
import ProductCard from '../../components/ProductCard/ProductCard'
import { useToast } from '../../context/ToastContext'
import api from '../../api'
import { useEffect } from 'react'
import './Profile.css'
import io from 'socket.io-client'

const socket = io('http://localhost:5500')


export default function Profile() {
  const { user, isLoggedIn, logout, refreshUser } = useAuth()
  const { showToast } = useToast()
  const { items: wishlistItems } = useWishlist()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const fetchOrders = () => {
    setLoading(true)
    api.get('/orders/myorders')
      .then(res => setOrders(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isLoggedIn) {
      if (activeTab === 'orders') {
        fetchOrders()
      } else if (activeTab === 'addresses') {
        refreshUser()
      }
    }
  }, [isLoggedIn, activeTab])

  useEffect(() => {
    const onActivity = (act) => {
      if (act.type === 'ORDER_STATUS_UPDATE' || act.type === 'ORDER_PLACED') {
        if (activeTab === 'orders') fetchOrders()
      }
    }

    const onOrderStatus = (payload) => {
      if (activeTab !== 'orders') return
      if (payload.userId && user?._id && payload.userId !== user._id) return
      fetchOrders()
    }

    socket.on('admin_activity', onActivity)
    socket.on('order_status_update', onOrderStatus)

    return () => {
      socket.off('admin_activity', onActivity)
      socket.off('order_status_update', onOrderStatus)
    }
  }, [activeTab, user])

  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)
  const [addressForm, setAddressForm] = useState({ name: '', phone: '', pincode: '', city: '', state: '', address: '' })

  const handleSetDefault = async (id) => {
    try {
      await api.put(`/auth/address/${id}/default`)
      refreshUser()
      showToast('Default address updated', 'success')
    } catch (err) {
      showToast('Failed to update default address', 'error')
    }
  }

  const handleDeleteAddress = async (id) => {
    if (!window.confirm('Delete this address?')) return
    try {
      await api.delete(`/auth/address/${id}`)
      refreshUser()
      showToast('Address deleted', 'info')
    } catch (err) {
      showToast('Failed to delete address', 'error')
    }
  }

  const handleOpenAddressModal = (addr = null) => {
    if (addr) {
      setEditingAddress(addr._id)
      setAddressForm({ ...addr })
    } else {
      setEditingAddress(null)
      setAddressForm({ name: '', phone: '', pincode: '', city: '', state: '', address: '' })
    }
    setShowAddressModal(true)
  }

  const handleSaveAddress = async (e) => {
    e.preventDefault()
    try {
      await api.put('/auth/address', { ...addressForm, addressId: editingAddress })
      refreshUser()
      setShowAddressModal(false)
      showToast(editingAddress ? 'Address updated' : 'Address added', 'success')
    } catch (err) {
      showToast('Failed to save address', 'error')
    }
  }

  const [profileForm, setProfileForm] = useState({ name: user?.name || '', password: '', confirmPassword: '' })

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (profileForm.password !== profileForm.confirmPassword) {
      return showToast('Passwords do not match', 'error')
    }
    try {
      const { data } = await api.put('/auth/profile', { name: profileForm.name, password: profileForm.password })
      await refreshUser()
      showToast('Profile updated successfully', 'success')
      setProfileForm(prev => ({ ...prev, password: '', confirmPassword: '' }))
    } catch (err) {
      console.error('Profile update error:', err)
      showToast(err.response?.data?.message || 'Failed to update profile', 'error')
    }
  }

  useEffect(() => {
    if (user) {
      setProfileForm(prev => ({ ...prev, name: user.name }))
    }
  }, [user])

  if (!isLoggedIn) {
    return (
      <div className="profile-auth-req">
        <span style={{ fontSize: '64px' }}>🔒</span>
        <h2>Please Login</h2>
        <p>You need to be logged in to view your profile.</p>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/auth', { state: { from: '/profile' } })}>Login Now</button>
      </div>
    )
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="profile-page">
      <div className="container profile-layout">

        {/* Sidebar */}
        <aside className="profile-sidebar card">
          <div className="profile-user-info">
            <div className="profile-avatar">
              {user.profilePic ? (
                <img src={user.profilePic} alt={user.name} className="profile-avatar-img" />
              ) : (
                user.name[0].toUpperCase()
              )}
            </div>
            <div className="profile-user-details">
              <h3>{user.name}</h3>
              <p>{user.email}</p>
            </div>
          </div>

          <div className="profile-nav">
            <button className={`profile-nav-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
              <FiPackage size={18} /> My Orders <FiChevronRight className="chevron" />
            </button>
            <button className={`profile-nav-btn ${activeTab === 'wishlist' ? 'active' : ''}`} onClick={() => setActiveTab('wishlist')}>
              <FiHeart size={18} /> Wishlist ({wishlistItems.length}) <FiChevronRight className="chevron" />
            </button>
            <button className={`profile-nav-btn ${activeTab === 'addresses' ? 'active' : ''}`} onClick={() => setActiveTab('addresses')}>
              <FiMapPin size={18} /> Saved Addresses <FiChevronRight className="chevron" />
            </button>
            <button className={`profile-nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <FiSettings size={18} /> Account Settings <FiChevronRight className="chevron" />
            </button>
            <div className="profile-nav-divider" />
            <button className="profile-nav-btn logout" onClick={handleLogout}>
              <FiLogOut size={18} /> Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="profile-content card">

          {activeTab === 'orders' && (
            <div className="tab-pane animate-fadeIn">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '12px' }}>
                <h2 className="tab-title" style={{ margin: 0 }}>My Orders</h2>
                <Link to="/orders" className="btn btn-outline btn-sm">View all orders</Link>
              </div>
              {loading ? (
                <div className="empty-state"><p>Loading orders...</p></div>
              ) : orders.length === 0 ? (
                <div className="empty-state">
                  <FiPackage size={48} color="var(--text-muted)" />
                  <p>You have no orders yet.</p>
                  <Link to="/products" className="btn btn-primary">Start Shopping</Link>
                </div>
              ) : (
                <div className="orders-list">
                  {orders.map(order => (
                    <div key={order._id} className="order-card">
                      <div className="order-header">
                        <div>
                          <span className="order-id">Order {order._id.substring(0, 8)}...</span>
                          <span className="order-date">Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <span className={`order-status status-${order.orderStatus.toLowerCase().replace(/\s/g, '-')}`}>{order.orderStatus}</span>
                      </div>
                      <div className="order-body">
                        <img src={order.orderItems[0]?.image} alt="Order item" className="order-img" />
                        <div className="order-details">
                          <p className="order-items-count">{order.orderItems.length} Item{order.orderItems.length > 1 ? 's' : ''}</p>
                          <p className="order-total">Total: ₹{order.totalPrice.toLocaleString('en-IN')}</p>
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/orders/${order._id}`)}>
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {activeTab === 'wishlist' && (
            <div className="tab-pane animate-fadeIn">
              <h2 className="tab-title">My Wishlist</h2>
              {wishlistItems.length === 0 ? (
                <div className="empty-state">
                  <FiHeart size={48} color="var(--text-muted)" />
                  <p>Your wishlist is empty.</p>
                  <Link to="/products" className="btn btn-primary">Explore Products</Link>
                </div>
              ) : (
                <div className="wishlist-grid">
                  {wishlistItems.map(p => <ProductCard key={p._id || p.id} product={p} />)}
                </div>
              )}
            </div>
          )}

          {activeTab === 'addresses' && (
            <div className="tab-pane animate-fadeIn">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <h2 className="tab-title" style={{ marginBottom: 0 }}>Saved Addresses</h2>
                <button className="btn btn-primary btn-sm" onClick={() => handleOpenAddressModal()}>+ Add New</button>
              </div>
              <div className="addresses-list">
                {(user.addresses || []).length === 0 ? (
                  <div className="empty-state">
                    <FiMapPin size={48} color="var(--text-muted)" />
                    <p>No addresses saved yet.</p>
                  </div>
                ) : (
                  user.addresses.map(addr => (
                    <div key={addr._id} className={`address-card ${addr.isDefault ? 'default' : ''}`}>
                      {addr.isDefault && <div className="address-badge">Default</div>}
                      <h4>{addr.name}</h4>
                      <p>{addr.address}</p>
                      <p>{addr.city}, {addr.state} - {addr.pincode}</p>
                      <p>Phone: {addr.phone}</p>
                      <div className="address-actions">
                        {!addr.isDefault && <button className="btn btn-link btn-sm" onClick={() => handleSetDefault(addr._id)}>Set as Default</button>}
                        <button className="btn btn-ghost btn-sm" onClick={() => handleOpenAddressModal(addr)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDeleteAddress(addr._id)}>Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Address Modal */}
              {showAddressModal && (
                <div className="modal-overlay">
                  <div className="modal-content card animate-slideUp">
                    <h3>{editingAddress ? 'Edit Address' : 'Add New Address'}</h3>
                    <form onSubmit={handleSaveAddress} className="address-form">
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Full Name</label>
                          <input className="input" value={addressForm.name} onChange={e => setAddressForm({ ...addressForm, name: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label>Mobile Number</label>
                          <input className="input" value={addressForm.phone} onChange={e => setAddressForm({ ...addressForm, phone: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label>PIN Code</label>
                          <input className="input" value={addressForm.pincode} onChange={e => setAddressForm({ ...addressForm, pincode: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label>City</label>
                          <input className="input" value={addressForm.city} onChange={e => setAddressForm({ ...addressForm, city: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label>State</label>
                          <input className="input" value={addressForm.state} onChange={e => setAddressForm({ ...addressForm, state: e.target.value })} required />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Full Address</label>
                        <textarea className="input" rows={3} value={addressForm.address} onChange={e => setAddressForm({ ...addressForm, address: e.target.value })} required />
                      </div>
                      <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => setShowAddressModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save Address</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="tab-pane animate-fadeIn">
              <h2 className="tab-title">Account Settings</h2>
              <form className="settings-form" onSubmit={handleUpdateProfile}>
                <div className="form-group">
                  <label className="input-label">Full Name</label>
                  <input className="input" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="input-label">Email Address</label>
                  <input className="input" defaultValue={user.email} disabled />
                </div>

                <div className="divider" style={{ margin: 'var(--space-8) 0' }} />

                <h3 style={{ fontSize: '16px', marginBottom: 'var(--space-4)' }}>Change Password</h3>
                <div className="form-group">
                  <label className="input-label">New Password</label>
                  <input className="input" type="password" value={profileForm.password} onChange={e => setProfileForm({ ...profileForm, password: e.target.value })} placeholder="Leave blank to keep current" />
                </div>
                <div className="form-group">
                  <label className="input-label">Confirm New Password</label>
                  <input className="input" type="password" value={profileForm.confirmPassword} onChange={e => setProfileForm({ ...profileForm, confirmPassword: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: 'var(--space-2)' }}>Save Changes</button>
              </form>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
