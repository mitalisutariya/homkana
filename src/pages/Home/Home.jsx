import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiArrowRight, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import ProductCard from '../../components/ProductCard/ProductCard'
import FlashSaleTimer from '../../components/FlashSaleTimer/FlashSaleTimer'
import { banners } from '../../data/categories'
import api from '../../api'
import './Home.css'

export default function Home() {
  const [activeBanner, setActiveBanner] = useState(0)
  const [email, setEmail] = useState('')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const bannerRef = useRef(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const pRes = await api.get('/products')
        setProducts(pRes.data.products || pRes.data) // fallback if API wasn't updated yet in some environment
        const cRes = await api.get('/categories')
        setCategories(cRes.data)
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const flashSaleProducts = products.filter(p => p.flashSale)
  const bestSellers = products.filter(p => p.tags && p.tags.includes('bestseller'))
  const dealOfTheDay = products.length > 0 ? products[4] || products[0] : null

  // Auto-rotate banners
  useEffect(() => {
    const t = setInterval(() => setActiveBanner(p => (p + 1) % banners.length), 4000)
    return () => clearInterval(t)
  }, [])

  const prevBanner = () => setActiveBanner(p => (p - 1 + banners.length) % banners.length)
  const nextBanner = () => setActiveBanner(p => (p + 1) % banners.length)

  return (
    <div className="home">
      {/* Hero Banner */}
      <section className="hero-section">
        <div className="hero-carousel" ref={bannerRef}>
          {banners.map((banner, i) => (
            <div
              key={banner.id}
              className={`hero-slide ${i === activeBanner ? 'active' : ''}`}
              style={{ background: banner.bg }}
            >
              <div className="container hero-content">
                <div className="hero-text animate-slideInLeft">
                  <span className="hero-tag">{banner.tag}</span>
                  <h1 className="hero-title">{banner.title}</h1>
                  <p className="hero-subtitle">{banner.subtitle}</p>
                  <Link to={`/products?category=${banner.category}`} className="btn btn-accent btn-lg hero-cta">
                    {banner.cta} <FiArrowRight />
                  </Link>
                </div>
                <div className="hero-image-wrap">
                  <img src={banner.image} alt={banner.title} className="hero-img" />
                </div>
              </div>
            </div>
          ))}

          <button className="banner-nav prev" onClick={prevBanner}><FiChevronLeft size={22} /></button>
          <button className="banner-nav next" onClick={nextBanner}><FiChevronRight size={22} /></button>

          <div className="banner-dots">
            {banners.map((_, i) => (
              <button key={i} className={`dot ${i === activeBanner ? 'active' : ''}`} onClick={() => setActiveBanner(i)} />
            ))}
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="section categories-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">Shop by <span>Category</span></h2>
              <p className="section-subtitle">Explore our wide range of product categories</p>
            </div>
            <Link to="/products" className="btn btn-outline btn-sm">View All</Link>
          </div>
          <div className="categories-grid">
            {categories.map(cat => (
              <Link key={cat._id} to={`/products?category=${cat.slug}`} className="category-card" style={{ '--cat-color': '#4F3CC9' }}>
                <div className="cat-icon-wrap">
                  <span className="cat-icon">{cat.icon}</span>
                </div>
                <span className="cat-name">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Flash Sale */}
      <section className="flash-sale-section">
        <div className="container">
          <div className="flash-sale-header">
            <div className="flash-title-group">
              <h2 className="section-title" style={{ color: 'white' }}>⚡ Flash <span style={{ color: '#FFD700' }}>Sale</span></h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>Grab the best deals before they expire!</p>
            </div>
            <FlashSaleTimer />
            <Link to="/products" className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)' }}>
              View All Deals
            </Link>
          </div>
          <div className="flash-products">
            {flashSaleProducts.map(product => (
              <div key={product.id} className="flash-product-card">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deal of the Day */}
      {dealOfTheDay && (
        <section className="section">
          <div className="container">
            <div className="deal-banner">
              <div className="deal-info">
                <span className="deal-tag">🔥 Deal of the Day</span>
                <h2 className="deal-title">{dealOfTheDay.name}</h2>
                <p className="deal-desc">{dealOfTheDay.description}</p>
                <div className="price-box deal-price">
                  <span className="price-current" style={{ fontSize: '28px' }}>₹{dealOfTheDay.price.toLocaleString('en-IN')}</span>
                  <span className="price-mrp" style={{ fontSize: '16px' }}>₹{dealOfTheDay.mrp.toLocaleString('en-IN')}</span>
                  <span className="price-discount" style={{ fontSize: '16px' }}>{dealOfTheDay.discount}% off</span>
                </div>
                <Link to={`/product/${dealOfTheDay._id}`} className="btn btn-primary btn-lg">Shop Now <FiArrowRight /></Link>
              </div>
              <div className="deal-image">
                <img src={dealOfTheDay.images[0]} alt={dealOfTheDay.name} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Best Sellers */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">🏆 Best <span>Sellers</span></h2>
              <p className="section-subtitle">Most loved by our customers</p>
            </div>
            <Link to="/products" className="btn btn-outline btn-sm">See All</Link>
          </div>
          <div className="products-grid">
            {bestSellers.slice(0, 8).map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        </div>
      </section>

      {/* Banner Strips */}
      <section className="section">
        <div className="container promo-strips">
          <div className="promo-strip strip-1" onClick={() => navigate('/products?category=fashion')}>
            <div>
              <span className="strip-tag">Fashion Week</span>
              <h3>Up to 60% off on top brands</h3>
              <button className="btn btn-sm strip-btn">Shop Fashion</button>
            </div>
            <span className="strip-emoji">👗</span>
          </div>
          <div className="promo-strip strip-2" onClick={() => navigate('/products?category=electronics')}>
            <div>
              <span className="strip-tag">Tech Deals</span>
              <h3>Latest gadgets at lowest prices</h3>
              <button className="btn btn-sm strip-btn">Shop Electronics</button>
            </div>
            <span className="strip-emoji">📱</span>
          </div>
        </div>
      </section>

      {/* All Products */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">✨ You May <span>Like</span></h2>
              <p className="section-subtitle">Curated picks just for you</p>
            </div>
            <Link to="/products" className="btn btn-outline btn-sm">Browse All</Link>
          </div>
          <div className="products-grid">
            {products.slice(0, 8).map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="newsletter-section">
        <div className="container newsletter-inner">
          <div className="newsletter-text">
            <h2>Get the Best Deals First! 🎉</h2>
            <p>Subscribe to our newsletter for exclusive offers, new arrivals, and flash sale alerts.</p>
          </div>
          <form className="newsletter-form" onSubmit={e => { e.preventDefault(); alert('Subscribed! 🎉') }}>
            <input
              type="email"
              placeholder="Enter your email address..."
              className="newsletter-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-accent">Subscribe</button>
          </form>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="trust-section">
        <div className="container trust-grid">
          {[
            { icon: '🚚', title: 'Free Delivery', desc: 'On orders above ₹499' },
            { icon: '🔄', title: 'Easy Returns', desc: '7-day return policy' },
            { icon: '🔒', title: 'Secure Payment', desc: '100% safe & encrypted' },
            { icon: '🎧', title: '24/7 Support', desc: 'Always here to help' },
          ].map(t => (
            <div key={t.title} className="trust-item">
              <span className="trust-icon">{t.icon}</span>
              <div>
                <h4>{t.title}</h4>
                <p>{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
