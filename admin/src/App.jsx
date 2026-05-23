import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom'
import { FiHome, FiBox, FiShoppingCart, FiUsers, FiLogOut, FiPlus, FiEdit, FiTrash2, FiBell, FiGrid, FiRefreshCw } from 'react-icons/fi'
import axios from 'axios'
import { io } from 'socket.io-client'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend 
} from 'recharts';

const API = 'http://localhost:5500/api'
const socket = io('http://localhost:5500')

// -- Auth State Management --
const useAdminAuth = () => {
  const [token, setToken] = useState(localStorage.getItem('adminToken'))
  const login = (token) => {
    localStorage.setItem('adminToken', token)
    setToken(token)
  }
  const logout = () => {
    localStorage.removeItem('adminToken')
    setToken(null)
  }
  return { token, login, logout, isAuthenticated: !!token }
}

// -- Components --

function Login({ login }) {
  const [email, setEmail] = useState('admin@gmail.com')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password })
      if (res.data.role !== 'admin') throw new Error('Not an admin account')
      login(res.data.token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed')
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <h2>HomeKana Admin</h2>
        <p>Sign in to access the control panel</p>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
        <div className="form-group">
          <label>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>Login</button>
      </form>
    </div>
  )
}

function Sidebar({ logout }) {
  const loc = useLocation()
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        HK <span>Admin</span>
      </div>
      <nav className="sidebar-nav">
        <Link to="/" className={`nav-link ${loc.pathname === '/' ? 'active' : ''}`}><FiHome /> Dashboard</Link>
        <Link to="/products" className={`nav-link ${loc.pathname === '/products' ? 'active' : ''}`}><FiBox /> Products</Link>
        <Link to="/categories" className={`nav-link ${loc.pathname === '/categories' ? 'active' : ''}`}><FiGrid /> Categories</Link>
        <Link to="/orders" className={`nav-link ${loc.pathname === '/orders' ? 'active' : ''}`}><FiShoppingCart /> Orders</Link>
        <Link to="/users" className={`nav-link ${loc.pathname === '/users' ? 'active' : ''}`}><FiUsers /> Users</Link>
        <div style={{ flex: 1 }}></div>
        <button className="nav-link logout-btn" onClick={logout}><FiLogOut /> Logout</button>
      </nav>
    </aside>
  )
}

function Dashboard({ token }) {
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, users: 0 })
  const [topProducts, setTopProducts] = useState([])
  const [orderStatusData, setOrderStatusData] = useState([])
  const [loading, setLoading] = useState(true)

  const chartColors = ['#6D28D9', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'];

  const salesData = [
    { name: 'Jun 2025', sales: 4000 },
    { name: 'Jul 2025', sales: 3000 },
    { name: 'Aug 2025', sales: 2000 },
    { name: 'Sep 2025', sales: 2780 },
    { name: 'Oct 2025', sales: 1890 },
    { name: 'Nov 2025', sales: 2390 },
  ];

  const fetchDashboardData = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const [pRes, oRes, uRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/orders`, config),
        axios.get(`${API}/auth/users`, config)
      ])
      
      const products = pRes.data.products || pRes.data;
      const orders = oRes.data;
      const users = uRes.data;

      const revenue = orders.filter(o => o.isPaid).reduce((acc, curr) => acc + curr.totalPrice, 0)
      const pendingOrders = orders.filter(o => o.orderStatus === 'Pending').length
      const deliveredOrders = orders.filter(o => o.orderStatus === 'Delivered').length
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todaysOrders = orders.filter(o => new Date(o.createdAt) >= today).length
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthlyRevenue = orders.filter(o => o.isPaid && new Date(o.createdAt) >= startOfMonth).reduce((acc, curr) => acc + curr.totalPrice, 0)

      const lowStock = products.filter(p => (p.stockCount || 0) <= 5).length

      setStats({ 
        products: products.length, 
        orders: orders.length, 
        revenue: revenue,
        users: users.length,
        pendingOrders,
        deliveredOrders,
        todaysOrders,
        monthlyRevenue,
        lowStock,
      })

      const statuses = orders.reduce((acc, o) => {
        acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
        return acc;
      }, {})
      setOrderStatusData(Object.entries(statuses).map(([name, value]) => ({ name, value })))

      const sortedProducts = [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5)
      setTopProducts(sortedProducts.map((p, i) => ({
        ...p,
        totalSold: 10 - i,
      })))

      setLoading(false)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    socket.on('admin_activity', fetchDashboardData)
    return () => socket.off('admin_activity')
  }, [token])

  if (loading) return <div className="page-content">Loading Dashboard...</div>

  return (
    <div className="page-content">
      <header style={{ marginBottom: '32px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Check the sales and value.</p>
      </header>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-title">Total Orders</div>
          <div className="stat-value">{stats.orders}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Pending Orders</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.pendingOrders}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Delivered Orders</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.deliveredOrders}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Today's Orders</div>
          <div className="stat-value">{stats.todaysOrders}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Monthly Revenue</div>
          <div className="stat-value">₹{(stats.monthlyRevenue || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">All Time Revenue</div>
          <div className="stat-value">₹{stats.revenue.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="chart-card">
          <h3 className="chart-title">Monthly Sales</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">Order Status</h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie
                data={orderStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {orderStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="table-container" style={{ gridColumn: 'span 1' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Top Products</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Products having most sales</p>
          </div>
          <table className="top-products-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Title</th>
                <th>Category</th>
                <th>Total Sold</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map(p => (
                <tr key={p._id}>
                  <td><img src={p.images[0]} alt="" /></td>
                  <td style={{ fontWeight: 600 }}>{p.name.substring(0, 30)}...</td>
                  <td>{p.category}</td>
                  <td style={{ fontWeight: 600 }}>{p.totalSold}</td>
                  <td className="rating-stars">★ {p.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="summary-card">
          <h3 className="chart-title">Summary</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Summary of key metrics for the current month</p>
          
          <div className="summary-item">
            <div className="summary-icon"><FiShoppingCart /></div>
            <div className="summary-text">
              <h4>Total Orders Placed</h4>
              <p>Total orders placed: {stats.orders}</p>
            </div>
          </div>

          <div className="summary-item">
            <div className="summary-icon"><FiBox /></div>
            <div className="summary-text">
              <h4>Total Sales this Month</h4>
              <p>This month's sales: ₹{(stats.revenue * 0.8).toFixed(0).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="summary-item">
            <div className="summary-icon"><FiGrid /></div>
            <div className="summary-text">
              <h4>Top Selling Product</h4>
              <p>Best Seller: {topProducts[0]?.name.substring(0, 20)}...</p>
            </div>
          </div>

          <div className="summary-item">
            <div className="summary-icon" style={{ color: 'var(--danger)' }}><FiBell /></div>
            <div className="summary-text">
              <h4>Low Stock Alerts</h4>
          <p>{stats.lowStock || 0} products running low on stock</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Products({ token }) {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [newProduct, setNewProduct] = useState({
    name: '', price: '', mrp: '', category: '', images: [''], description: '', stock: 10, brand: '', discount: 0, variants: []
  })
  const emptyVariant = () => ({ color: '', colorHex: '#cccccc', price: '', mrp: '', stockCount: 0, image: '' })

  const getStockStatus = (p) => {
    const stock = p.stockCount ?? 0
    if (!p.inStock || stock <= 0) return { label: 'Out of Stock', cls: 'status-cancelled' }
    if (stock <= 5) return { label: `Low (${stock})`, cls: 'status-pending' }
    return { label: `In Stock (${stock})`, cls: 'status-delivered' }
  }

  const getColorsSummary = (p) => {
    if (!p.variants?.length) return '—'
    return p.variants.map((v) => `${v.color || v.name}: ${v.stockCount ?? 0}`).join(', ')
  }

  const sumVariantStock = (variants) =>
    (variants || []).reduce((s, v) => s + (Number(v.stockCount) || 0), 0)

  const renderVariantEditor = (variants, setVariants, basePrice, baseMrp) => (
    <div style={{ marginTop: '8px', padding: '14px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
      <label style={{ fontWeight: 600, display: 'block', marginBottom: '10px' }}>Colors & Stock (variant-wise)</label>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
        Example: Black 5, Red 5 → total stock 10
      </p>
      {(variants || []).map((v, idx) => (
        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 56px 1fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <input placeholder="Color name" value={v.color} onChange={(e) => {
            const next = [...variants]; next[idx] = { ...next[idx], color: e.target.value }; setVariants(next)
          }} />
          <input type="color" value={v.colorHex || '#cccccc'} onChange={(e) => {
            const next = [...variants]; next[idx] = { ...next[idx], colorHex: e.target.value }; setVariants(next)
          }} title="Color" />
          <input type="number" placeholder="Price" value={v.price} onChange={(e) => {
            const next = [...variants]; next[idx] = { ...next[idx], price: e.target.value }; setVariants(next)
          }} />
          <input type="number" placeholder="Stock" value={v.stockCount} onChange={(e) => {
            const next = [...variants]; next[idx] = { ...next[idx], stockCount: e.target.value }; setVariants(next)
          }} />
          <input type="number" placeholder="MRP" value={v.mrp} onChange={(e) => {
            const next = [...variants]; next[idx] = { ...next[idx], mrp: e.target.value }; setVariants(next)
          }} />
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setVariants(variants.filter((_, i) => i !== idx))}><FiTrash2 /></button>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setVariants([...(variants || []), emptyVariant()])}>+ Add Color</button>
      {(variants || []).length > 0 && (
        <p style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600 }}>Total variant stock: {sumVariantStock(variants)}</p>
      )}
    </div>
  )

  const fetchProducts = async () => {
    const res = await axios.get(`${API}/products`)
    setProducts(res.data.products || res.data)
    setLoading(false)
  }

  const fetchCategories = async () => {
    const res = await axios.get(`${API}/categories`)
    setCategories(res.data)
    if (res.data.length > 0 && !newProduct.category) {
      setNewProduct(prev => ({ ...prev, category: res.data[0].slug }))
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  const handleDelete = async (id) => {
    const productId = id?._id || id;
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await axios.delete(`${API}/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } })
        fetchProducts()
      } catch (err) {
        alert('Delete failed')
      }
    }
  }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    try {
      const filteredImages = newProduct.images.filter(img => img.trim() !== '')
      const variantsPayload = (newProduct.variants || []).filter(v => v.color).map(v => ({
        ...v,
        price: Number(v.price) || Number(newProduct.price),
        mrp: Number(v.mrp) || Number(newProduct.mrp),
        stockCount: Number(v.stockCount) || 0,
      }))
      const stockCount = variantsPayload.length
        ? sumVariantStock(variantsPayload)
        : parseInt(newProduct.stock, 10) || 0
      await axios.post(`${API}/products`, {
        ...newProduct,
        images: filteredImages,
        stockCount,
        discount: Number(newProduct.discount) || 0,
        variants: variantsPayload,
      }, { headers: { Authorization: `Bearer ${token}` } })
      setShowAddModal(false)
      setNewProduct({ name: '', price: '', mrp: '', category: categories[0]?.slug || '', images: [''], description: '', stock: 10, brand: '', discount: 0, variants: [] })
      fetchProducts()
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || 'Check connection'))
    }
  }

  const handleEditProduct = async (e) => {
    e.preventDefault()
    try {
      const filteredImages = editingProduct.images.filter(img => img.trim() !== '')
      const variantsPayload = (editingProduct.variants || []).filter(v => v.color).map(v => ({
        ...v,
        price: Number(v.price) || Number(editingProduct.price),
        mrp: Number(v.mrp) || Number(editingProduct.mrp),
        stockCount: Number(v.stockCount) || 0,
      }))
      const stockCount = variantsPayload.length
        ? sumVariantStock(variantsPayload)
        : parseInt(editingProduct.stockCount, 10) || 0
      await axios.put(`${API}/products/${editingProduct._id}`, {
        ...editingProduct,
        images: filteredImages,
        stockCount,
        discount: Number(editingProduct.discount) || 0,
        variants: variantsPayload,
      }, { headers: { Authorization: `Bearer ${token}` } })
      setEditingProduct(null)
      fetchProducts()
    } catch (err) {
      alert('Update failed: ' + (err.response?.data?.message || 'Server error'))
    }
  }

  const handleImageChange = (index, value, isEditing = false) => {
    if (isEditing) {
      const newImages = [...editingProduct.images]
      newImages[index] = value
      setEditingProduct({ ...editingProduct, images: newImages })
    } else {
      const newImages = [...newProduct.images]
      newImages[index] = value
      setNewProduct({ ...newProduct, images: newImages })
    }
  }

  const addImageField = (isEditing = false) => {
    if (isEditing) {
      setEditingProduct({ ...editingProduct, images: [...editingProduct.images, ''] })
    } else {
      setNewProduct({ ...newProduct, images: [...newProduct.images, ''] })
    }
  }

  const removeImageField = (index, isEditing = false) => {
    if (isEditing) {
      const newImages = editingProduct.images.filter((_, i) => i !== index)
      setEditingProduct({ ...editingProduct, images: newImages })
    } else {
      const newImages = newProduct.images.filter((_, i) => i !== index)
      setNewProduct({ ...newProduct, images: newImages })
    }
  }

  if (loading) return <div className="page-content">Loading...</div>

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Products</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={fetchProducts} title="Refresh List"><FiRefreshCw /></button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}><FiPlus /> Add New Product</button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Price</th>
              <th>Discount</th>
              <th>Colors</th>
              <th>Category</th>
              <th>Stock Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const stock = getStockStatus(p)
              return (
              <tr key={p._id}>
                <td style={{ position: 'relative' }}>
                  <img src={p.images[0]} alt="" style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                  {p.images.length > 1 && (
                    <span style={{ 
                      position: 'absolute', top: '10px', left: '35px', 
                      background: 'var(--primary)', color: 'white', 
                      fontSize: '10px', padding: '2px 4px', borderRadius: '4px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>+{p.images.length - 1}</span>
                  )}
                </td>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>₹{p.price}</td>
                <td>{p.discount > 0 ? `${p.discount}%` : '—'}</td>
                <td style={{ fontSize: '12px', maxWidth: '180px' }}>{getColorsSummary(p)}</td>
                <td><span className="status-badge" style={{ background: 'var(--bg-light)', color: 'var(--text-main)' }}>{p.category}</span></td>
                <td><span className={`status-badge ${stock.cls}`}>{stock.label}</span></td>
                <td style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setEditingProduct({ ...p, variants: p.variants || [] })}><FiEdit /></button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p._id)}><FiTrash2 /></button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>Add New Product</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddProduct} className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label>Product Name</label>
                    <input type="text" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label>Category</label>
                      <select value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}>
                        {categories.map(c => (
                          <option key={c._id} value={c.slug}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Brand</label>
                      <input type="text" value={newProduct.brand} onChange={e => setNewProduct({ ...newProduct, brand: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Price (₹)</label>
                      <input type="number" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>MRP (₹)</label>
                      <input type="number" value={newProduct.mrp} onChange={e => setNewProduct({ ...newProduct, mrp: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Discount %</label>
                      <input type="number" min="0" max="99" value={newProduct.discount} onChange={e => setNewProduct({ ...newProduct, discount: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>{newProduct.variants?.length ? 'Total Stock (auto)' : 'Stock Count'}</label>
                      <input
                        type="number"
                        value={newProduct.variants?.length ? sumVariantStock(newProduct.variants) : newProduct.stock}
                        onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })}
                        disabled={!!newProduct.variants?.length}
                        required={!newProduct.variants?.length}
                      />
                    </div>
                  </div>
                  {renderVariantEditor(
                    newProduct.variants,
                    (variants) => setNewProduct({ ...newProduct, variants }),
                    newProduct.price,
                    newProduct.mrp
                  )}
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      style={{ width: '100%', padding: '12px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', minHeight: '120px' }}
                      value={newProduct.description}
                      onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-light)', padding: '20px', borderRadius: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600 }}>Product Images</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                    {newProduct.images.map((img, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <input 
                            type="text" 
                            placeholder="Image URL" 
                            value={img} 
                            onChange={(e) => handleImageChange(idx, e.target.value)}
                            style={{ marginBottom: '4px' }}
                          />
                          {img && <img src={img} alt="" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />}
                        </div>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeImageField(idx)} style={{ padding: '8px' }}><FiTrash2 /></button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: '8px' }} onClick={() => addImageField()}>+ Add More Image</button>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '32px', padding: '16px' }}>Save Product</button>
            </form>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>Edit Product</h2>
              <button className="close-btn" onClick={() => setEditingProduct(null)}>&times;</button>
            </div>
            <form onSubmit={handleEditProduct} className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label>Product Name</label>
                    <input type="text" value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label>Category</label>
                      <select value={editingProduct.category} onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}>
                        {categories.map(c => (
                          <option key={c._id} value={c.slug}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Brand</label>
                      <input type="text" value={editingProduct.brand} onChange={e => setEditingProduct({ ...editingProduct, brand: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Price (₹)</label>
                      <input type="number" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>MRP (₹)</label>
                      <input type="number" value={editingProduct.mrp} onChange={e => setEditingProduct({ ...editingProduct, mrp: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Discount %</label>
                      <input type="number" min="0" max="99" value={editingProduct.discount || 0} onChange={e => setEditingProduct({ ...editingProduct, discount: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>{editingProduct.variants?.length ? 'Total Stock (auto)' : 'Stock Count'}</label>
                      <input
                        type="number"
                        value={editingProduct.variants?.length ? sumVariantStock(editingProduct.variants) : editingProduct.stockCount}
                        onChange={e => setEditingProduct({ ...editingProduct, stockCount: e.target.value })}
                        disabled={!!editingProduct.variants?.length}
                        required={!editingProduct.variants?.length}
                      />
                    </div>
                  </div>
                  {renderVariantEditor(
                    editingProduct.variants,
                    (variants) => setEditingProduct({ ...editingProduct, variants }),
                    editingProduct.price,
                    editingProduct.mrp
                  )}
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      style={{ width: '100%', padding: '12px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', minHeight: '120px' }}
                      value={editingProduct.description}
                      onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-light)', padding: '20px', borderRadius: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600 }}>Product Images</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                    {editingProduct.images.map((img, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <input 
                            type="text" 
                            placeholder="Image URL" 
                            value={img} 
                            onChange={(e) => handleImageChange(idx, e.target.value, true)}
                            style={{ marginBottom: '4px' }}
                          />
                          {img && <img src={img} alt="" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />}
                        </div>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeImageField(idx, true)} style={{ padding: '8px' }}><FiTrash2 /></button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: '8px' }} onClick={() => addImageField(true)}>+ Add More Image</button>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '32px', padding: '16px' }}>Update Product</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Orders({ token }) {
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')

  // Tracking info form
  const [trackingInfo, setTrackingInfo] = useState({ courierName: '', trackingId: '' })

  const fetchOrders = async () => {
    const res = await axios.get(`${API}/orders`, { headers: { Authorization: `Bearer ${token}` } })
    setOrders(res.data)
  }

  useEffect(() => {
    fetchOrders()

    socket.on('admin_activity', (act) => {
      if (act.type === 'ORDER_PLACED' || act.type === 'ORDER_STATUS_UPDATE') {
        fetchOrders()
      }
    })

    return () => {
      socket.off('admin_activity')
    }
  }, [token])

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o._id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (o.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.shippingAddress.phone.includes(searchTerm);
    const matchesStatus = filterStatus === 'All' || o.orderStatus === filterStatus;
    return matchesSearch && matchesStatus;
  })

  const updateStatus = async (id, status) => {
    const payload = { status }
    if (status === 'Shipped') {
      if (!trackingInfo.courierName || !trackingInfo.trackingId) {
        return alert('Please provide Courier Name and AWB/Tracking number for Shipped orders.');
      }
      payload.deliveryInfo = {
        ...trackingInfo,
        awbNumber: trackingInfo.trackingId,
      };
    }
    
    try {
      await axios.put(`${API}/orders/${id}/status`, payload, { headers: { Authorization: `Bearer ${token}` } })
      fetchOrders()
      if (selectedOrder?._id === id) {
        const updated = await axios.get(`${API}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
        setSelectedOrder(updated.data)
      }
      alert('Order updated successfully')
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed')
    }
  }

  const cancelOrder = async (id) => {
    try {
      await axios.put(`${API}/orders/${id}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } })
      fetchOrders()
      if (selectedOrder?._id === id) {
        const updated = await axios.get(`${API}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
        setSelectedOrder(updated.data)
      }
      alert('Order cancelled successfully')
    } catch (err) {
      alert(err.response?.data?.message || 'Cancel failed')
    }
  }

  const refundOrder = async (id) => {
    if (confirm('Are you sure you want to mark this order as refunded?')) {
      try {
        await axios.put(`${API}/orders/${id}/refund`, {}, { headers: { Authorization: `Bearer ${token}` } })
        fetchOrders()
        if (selectedOrder?._id === id) {
          const updated = await axios.get(`${API}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
          setSelectedOrder(updated.data)
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Refund failed')
      }
    }
  }

  const markAsPaid = async (id) => {
    if (confirm('Mark this order as paid?')) {
      try {
        await axios.put(`${API}/orders/${id}/pay`, {}, { headers: { Authorization: `Bearer ${token}` } })
        fetchOrders()
        if (selectedOrder?._id === id) {
          const updated = await axios.get(`${API}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
          setSelectedOrder(updated.data)
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Payment update failed')
      }
    }
  }

  const printInvoice = () => {
    window.print()
  }

  return (
    <div className="page-content invoice-container">
      <h1 className="page-title no-print">Orders</h1>
      
      <div className="filters no-print" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Search Order ID, Name, Phone..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)}
          style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', flex: 1, minWidth: 0, marginBottom: 0, width: 'auto' }}
        />
        <select 
          value={filterStatus} 
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: 0, width: 'auto' }}
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Packed">Packed</option>
          <option value="Shipped">Shipped</option>
          <option value="Out for Delivery">Out for Delivery</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Returned">Returned</option>
          <option value="Refunded">Refunded</option>
        </select>
      </div>

      <div className="table-container no-print">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(o => (
              <tr key={o._id}>
                <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{o._id.substring(0, 8)}...</td>
                <td>{o.user?.name || 'Guest'}</td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td style={{ fontWeight: 600 }}>₹{o.totalPrice}</td>
                <td>
                  {o.isPaid ? <span style={{ color: 'var(--success)' }}>Yes</span> : <span style={{ color: 'var(--danger)' }}>No</span>}
                </td>
                <td><span className={`status-badge status-${o.orderStatus.toLowerCase().replace(/\s/g, '-')}`}>{o.orderStatus}</span></td>
                <td>
                  <button className="btn btn-primary" style={{ padding: '6px 10px' }} onClick={() => setSelectedOrder(o)}>
                    View Details
                  </button>
                </td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No orders found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <div className="modal-overlay print-modal" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content print-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header no-print">
              <h2>Order Details - #{selectedOrder._id.substring(0,8)}</h2>
              <div>
                <button className="btn btn-outline" style={{ marginRight: '8px' }} onClick={printInvoice}>Print Invoice</button>
                <button className="close-btn" onClick={() => setSelectedOrder(null)}>&times;</button>
              </div>
            </div>
            
            <div className="print-only invoice-header" style={{ display: 'none' }}>
              <h1>HomeKana Invoice</h1>
              <p>Order ID: {selectedOrder._id}</p>
              <p>Date: {new Date(selectedOrder.createdAt).toLocaleString()}</p>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Customer & Shipping Info</h3>
                  <p><strong>Name:</strong> {selectedOrder.user?.name}</p>
                  <p><strong>Email:</strong> {selectedOrder.user?.email}</p>
                  <p><strong>Phone:</strong> {selectedOrder.shippingAddress.phone}</p>
                  <p><strong>Address:</strong> {selectedOrder.shippingAddress.address}</p>
                  <p><strong>Location:</strong> {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.pincode}</p>
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Order Status & Payment</h3>
                  <p><strong>Payment Method:</strong> {selectedOrder.paymentMethod.toUpperCase()}</p>
                  <p><strong>Paid:</strong> {selectedOrder.isPaid ? 'Yes' : 'No'} {selectedOrder.paidAt && `(${new Date(selectedOrder.paidAt).toLocaleDateString()})`}</p>
                  {selectedOrder.paymentResult?.id && <p><strong>Transaction ID:</strong> {selectedOrder.paymentResult.id}</p>}
                  <p><strong>Status:</strong> <span className={`status-badge status-${selectedOrder.orderStatus.toLowerCase().replace(/\s/g, '-')}`}>{selectedOrder.orderStatus}</span></p>
                  
                  {selectedOrder.deliveryInfo?.trackingId && (
                    <div style={{ marginTop: '12px', padding: '8px', background: 'var(--bg-light)', borderRadius: '8px' }}>
                      <p style={{ margin: 0 }}><strong>Courier:</strong> {selectedOrder.deliveryInfo.courierName}</p>
                      <p style={{ margin: 0 }}><strong>Tracking ID:</strong> {selectedOrder.deliveryInfo.trackingId}</p>
                    </div>
                  )}

                  <div className="no-print" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: 0, fontSize: '14px' }}>Update Delivery & Status</h4>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select 
                        className="input"
                        style={{ margin: 0, padding: '8px', flex: 1, border: '1px solid var(--border-color)', borderRadius: '4px' }}
                        value={selectedOrder.orderStatus} 
                        onChange={e => setSelectedOrder({ ...selectedOrder, orderStatus: e.target.value })}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Packed">Packed</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Returned">Returned</option>
                        <option value="Refunded">Refunded</option>
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" style={{ margin: 0, padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px', flex: 1 }} placeholder="Courier Name" value={trackingInfo.courierName} onChange={e => setTrackingInfo({...trackingInfo, courierName: e.target.value})} />
                      <input type="text" style={{ margin: 0, padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px', flex: 1 }} placeholder="AWB / Tracking Number" value={trackingInfo.trackingId} onChange={e => setTrackingInfo({...trackingInfo, trackingId: e.target.value, awbNumber: e.target.value})} />
                    </div>

                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%' }}
                      onClick={() => updateStatus(selectedOrder._id, selectedOrder.orderStatus)}
                    >
                      Save Order Updates
                    </button>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      {!selectedOrder.isPaid && (
                        <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => markAsPaid(selectedOrder._id)}>Mark as Paid</button>
                      )}
                      {['Pending', 'Confirmed', 'Packed'].includes(selectedOrder.orderStatus) && (
                        <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => cancelOrder(selectedOrder._id)}>Cancel Order</button>
                      )}
                      {(selectedOrder.orderStatus === 'Returned' || (selectedOrder.orderStatus === 'Cancelled' && selectedOrder.isPaid)) && (
                        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => refundOrder(selectedOrder._id)}>Process Refund</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {selectedOrder.statusHistory?.length > 0 && (
                <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-light)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 12px' }}>Status History</h4>
                  {selectedOrder.statusHistory.map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: i < selectedOrder.statusHistory.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                      <span><strong>{h.status}</strong> — {h.note}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{new Date(h.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              <h3 style={{ fontSize: '16px', margin: '24px 0 12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Order Items</h3>
              <div className="review-items">
                {selectedOrder.orderItems.map(item => (
                  <div key={item._id} className="review-item" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
                    <img src={item.image} alt={item.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                    <div style={{ flex: 1, marginLeft: '12px' }}>
                      <p style={{ margin: 0, fontWeight: 500 }}>{item.name}</p>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Qty: {item.qty} x ₹{item.price}</p>
                    </div>
                    <span style={{ fontWeight: 600 }}>₹{item.qty * item.price}</span>
                  </div>
                ))}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <div style={{ width: '300px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Subtotal</span>
                    <span>₹{selectedOrder.totalPrice}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Shipping</span>
                    <span>Free</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', borderTop: '2px solid var(--text-main)', paddingTop: '8px' }}>
                    <span>Total</span>
                    <span>₹{selectedOrder.totalPrice}</span>
                  </div>
                </div>
              </div>
              
              <div className="print-only invoice-footer" style={{ display: 'none', marginTop: '40px', textAlign: 'center', color: '#666' }}>
                <p>Thank you for shopping with HomeKana!</p>
                <p>If you have any questions, contact us at support@homekana.com</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Categories({ token }) {
  const [categories, setCategories] = useState([])
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📦')

  const fetchCats = async () => {
    const res = await axios.get(`${API}/categories`)
    setCategories(res.data)
  }

  useEffect(() => { fetchCats() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API}/categories`, { name: newName, icon: newIcon }, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      setNewName('')
      setNewIcon('📦')
      fetchCats()
    } catch (err) {
      console.error('Add category failed:', err)
      alert('Add failed: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await axios.delete(`${API}/categories/${id}`, { 
          headers: { Authorization: `Bearer ${token}` } 
        })
        fetchCats()
      } catch (err) {
        console.error('Delete category failed:', err)
        alert('Delete failed: ' + (err.response?.data?.message || err.message))
      }
    }
  }

  return (
    <div className="page-content">
      <h1 className="page-title">Categories</h1>

      <div className="card" style={{ background: 'var(--bg-white)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ marginBottom: '16px' }}>Add New Category</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px' }}>
          <input style={{ flex: 1, margin: 0 }} placeholder="Category Name" value={newName} onChange={e => setNewName(e.target.value)} required />
          <input style={{ width: '80px', margin: 0 }} placeholder="Icon" value={newIcon} onChange={e => setNewIcon(e.target.value)} required />
          <button type="submit" className="btn btn-primary">Add</button>
        </form>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Icon</th>
              <th>Name</th>
              <th>Slug</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(c => (
              <tr key={c._id}>
                <td style={{ fontSize: '24px' }}>{c.icon}</td>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.slug}</td>
                <td>
                  <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(c._id)}><FiTrash2 /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Users({ token }) {
  const [users, setUsers] = useState([])

  useEffect(() => {
    const fetchUsers = async () => {
      const res = await axios.get(`${API}/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      setUsers(res.data)
    }
    fetchUsers()

    socket.on('admin_activity', (act) => {
      if (act.type === 'USER_REGISTER') {
        fetchUsers()
      }
    })

    return () => {
      socket.off('admin_activity')
    }
  }, [token])

  return (
    <div className="page-content">
      <h1 className="page-title">Users</h1>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined Date</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}>
                <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{u._id.substring(0, 8)}...</td>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td>{u.email}</td>
                <td><span className={`status-badge ${u.role === 'admin' ? 'Delivered' : 'Pending'}`}>{u.role}</span></td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// -- Main App --
export default function App() {
  const { token, login, logout, isAuthenticated } = useAdminAuth()
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) return

    const handleActivity = (activity) => {
      // Only show toasts for USER_REGISTER and ORDER_PLACED
      if (['USER_REGISTER', 'ORDER_PLACED', 'CATEGORY_MANAGEMENT', 'PRODUCT_MANAGEMENT'].includes(activity.type)) {
        setToast(activity.description)
        setTimeout(() => setToast(null), 5000)
      }
    }

    socket.on('admin_activity', handleActivity)

    return () => {
      socket.off('admin_activity', handleActivity)
    }
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return <Login login={login} />
  }

  return (
    <div className="admin-layout">
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, background: 'var(--primary)', color: '#fff',
          padding: '16px 24px', borderRadius: '8px', zIndex: 9999, fontWeight: 600,
          boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: '12px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <FiBell size={20} />
          {toast}
        </div>
      )}
      <Sidebar logout={logout} />
      <main className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>A</div>
            <span>Admin User</span>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard token={token} />} />
          <Route path="/products" element={<Products token={token} />} />
          <Route path="/categories" element={<Categories token={token} />} />
          <Route path="/orders" element={<Orders token={token} />} />
          <Route path="/users" element={<Users token={token} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}
