import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiSearch, FiShoppingCart, FiHeart, FiUser, FiMapPin, FiChevronDown, FiMenu, FiX, FiLogOut, FiPackage } from 'react-icons/fi'
import { useCart } from '../../context/CartContext'
import { useWishlist } from '../../context/WishlistContext'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'
import './Header.css'

export default function Header() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { totalItems } = useCart()
  const { items: wishlistItems } = useWishlist()
  const { user, isLoggedIn, logout } = useAuth()
  const navigate = useNavigate()
  const searchRef = useRef(null)

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])

  useEffect(() => {
    // Fetch products once for search autocomplete
    api.get('/products').then(res => setProducts(res.data.products || res.data)).catch(err => console.error(err))
    // Fetch dynamic categories
    api.get('/categories').then(res => setCategories(res.data)).catch(err => console.error(err))
  }, [])

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    const q = query.toLowerCase()
    const matched = products.filter(p =>
      p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    ).slice(0, 6)
    setSuggestions(matched)
    setShowSuggestions(true)
  }, [query, products])

  useEffect(() => {
    const handleClick = (e) => { if (!searchRef.current?.contains(e.target)) setShowSuggestions(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) { navigate(`/products?q=${encodeURIComponent(query.trim())}`); setShowSuggestions(false) }
  }

  const handleSuggestionClick = (product) => {
    setQuery(product.name); setShowSuggestions(false)
    navigate(`/product/${product._id}`)
  }

  return (
    <header className="header">
      <div className="header-topbar">
        <div className="container">
          <span>🚀 Free Delivery on orders above ₹499</span>
          <span>📞 1800-HomeKana | Use code <strong>FIRST10</strong> for 10% off</span>
        </div>
      </div>

      <div className="header-main">
        <div className="container header-inner">
          {/* Logo */}
          <Link to="/" className="header-logo">
            <div className="logo-icon">HK</div>
            <span className="logo-text">Home<span>Kana</span></span>
          </Link>

          {/* Location */}
          <div className="header-location">
            <FiMapPin size={14} />
            <div>
              <span className="location-label">Deliver to</span>
              <span className="location-value">India 🇮🇳</span>
            </div>
          </div>

          {/* Search */}
          <div className="header-search" ref={searchRef}>
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="Search for products, brands and more..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                className="search-input"
              />
              <button type="submit" className="search-btn"><FiSearch size={18} /></button>
            </form>
             {showSuggestions && suggestions.length > 0 && (
               <div className="search-suggestions animate-fadeIn">
                 {suggestions.map(product => (
                   <div key={product._id} className="suggestion-item" onClick={() => handleSuggestionClick(product)}>
                     <img src={(product.images && product.images[0]) || '/placeholder.png'} alt={product.name} className="suggestion-img" />
                     <div>
                       <div className="suggestion-name">{product.name}</div>
                       <div className="suggestion-brand">{product.brand} • {product.category}</div>
                     </div>
                     <div className="suggestion-price">₹{(product.price || 0).toLocaleString('en-IN')}</div>
                   </div>
                 ))}
               </div>
             )}
          </div>

          {/* Nav Icons */}
          <nav className="header-nav">
            {/* Account */}
            <div className="nav-item" onClick={() => setUserMenuOpen(!userMenuOpen)}>
              {isLoggedIn && user?.profilePic ? (
                <img src={user.profilePic} alt="" className="nav-avatar" />
              ) : (
                <FiUser size={20} />
              )}
               <div className="nav-label">
                 <span>{isLoggedIn && user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'Account'}</span>
                 <span className="nav-sub">Profile <FiChevronDown size={11} /></span>
               </div>
              {userMenuOpen && (
                <div className="user-dropdown animate-fadeIn">
                  {isLoggedIn ? (
                    <>
                      <div className="dropdown-user-header">
                        {user.profilePic ? (
                          <img src={user.profilePic} alt="" className="dropdown-avatar" />
                        ) : (
                          <div className="dropdown-avatar-fallback">{user.name?.[0]?.toUpperCase()}</div>
                        )}
                        <div>
                          <div className="dropdown-user-name">{user.name}</div>
                          <div className="dropdown-user-email">{user.email}</div>
                        </div>
                      </div>
                      <div className="dropdown-divider" />
                      <Link to="/profile" onClick={() => setUserMenuOpen(false)} className="dropdown-item"><FiUser size={14} /> My Profile</Link>
                      <Link to="/orders" onClick={() => setUserMenuOpen(false)} className="dropdown-item"><FiPackage size={14} /> My Orders</Link>
                      {user.role === 'admin' && (
                        <a href="http://localhost:5175" className="dropdown-item" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                          <FiUser size={14} /> Admin Dashboard
                        </a>
                      )}
                      <div className="dropdown-divider" />
                      <button onClick={() => { logout(); setUserMenuOpen(false) }} className="dropdown-item danger"><FiLogOut size={14} /> Logout</button>
                    </>
                  ) : (
                    <>
                      <Link to="/auth" onClick={() => setUserMenuOpen(false)} className="dropdown-btn">Login / Sign Up</Link>
                      <Link to="/orders" onClick={() => setUserMenuOpen(false)} className="dropdown-item"><FiPackage size={14} /> My Orders</Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {user?.role !== 'admin' && (
              <>
                {/* Wishlist */}
                <Link to="/profile" className="nav-item icon-btn">
                  <div className="icon-wrapper">
                    <FiHeart size={20} />
                    {wishlistItems.length > 0 && <span className="badge-count">{wishlistItems.length}</span>}
                  </div>
                  <span className="nav-label-single">Wishlist</span>
                </Link>

                {/* Cart */}
                <Link to="/cart" className="nav-item icon-btn cart-btn">
                  <div className="icon-wrapper">
                    <FiShoppingCart size={20} />
                    {totalItems > 0 && <span className="badge-count">{totalItems}</span>}
                  </div>
                  <span className="nav-label-single">Cart</span>
                </Link>
              </>
            )}

            <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>
          </nav>
        </div>
      </div>

      {/* Category Nav */}
      <div className="header-categories">
        <div className="container">
          <div className="cat-nav">
            {categories.slice(0, 9).map(cat => (
              <Link key={cat._id} to={`/products?category=${cat.slug}`} className="cat-nav-item">
                <span>{cat.icon}</span> {cat.name}
              </Link>
            ))}
            <Link to="/products" className="cat-nav-item cat-more">More ▾</Link>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu animate-fadeIn">
          <div className="mobile-search">
            <form onSubmit={handleSearch}>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products..." className="input" />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>
          </div>
          <div className="mobile-links">
            {isLoggedIn ? (
              <button onClick={() => { logout(); setMobileMenuOpen(false) }} className="mobile-link">Logout</button>
            ) : (
              <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="mobile-link">Login / Sign Up</Link>
            )}
            <Link to="/cart" onClick={() => setMobileMenuOpen(false)} className="mobile-link">Cart ({totalItems})</Link>
            <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="mobile-link">Wishlist & Orders</Link>
          </div>
        </div>
      )}
    </header>
  )
}
