import { Link } from 'react-router-dom'
import { FiHeart, FiShoppingCart, FiBarChart2 } from 'react-icons/fi'
import StarRating from '../StarRating/StarRating'
import { useCart } from '../../context/CartContext'
import { useWishlist } from '../../context/WishlistContext'
import { useCompare } from '../../context/CompareContext'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { isInStock } from '../../utils/pricing'
import './ProductCard.css'

export default function ProductCard({ product }) {
  const { addToCart } = useCart()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const { addToCompare, isInCompare } = useCompare()
  const { showToast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const pid = product._id || product.id

  const inStock = isInStock(product)

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!inStock) {
      showToast('This product is out of stock', 'error')
      return
    }
    const result = addToCart(product)
    if (result?.ok === false) {
      showToast(result.message || 'Could not add to cart', 'error')
      return
    }
    showToast(
      user
        ? `"${product.name || 'Product'}" added to cart! 🛒`
        : `"${product.name || 'Product'}" added to cart. Login at checkout.`,
      'success'
    )
  }

  const handleWishlist = (e) => {
    e.preventDefault()
    toggleWishlist(product)
  }

  const handleCompare = (e) => {
    e.preventDefault()
    addToCompare(product)
    showToast('Added to compare list', 'info')
  }

  const getImageSrc = () => {
    if (!product.images || product.images.length === 0) return '/placeholder.png'
    const src = product.images[0]
    // If src is a relative local path, prefix with import to let Vite handle it as asset
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      // It's a local file path; Vite will try to resolve it as a module
      // This can cause build errors if the file doesn't exist
      return '/placeholder.png'
    }
    return src
  }

  return (
    <Link to={`/product/${pid}`} className="product-card card">
      <div className="product-img-wrap">
        <img src={getImageSrc()} alt={product.name || 'Product'} className="product-img" loading="lazy" />
        {product.discount > 0 && <span className="discount-badge">-{product.discount}%</span>}
        {!inStock && <span className="discount-badge" style={{ background: 'var(--error)', left: 'auto', right: '8px' }}>Out of Stock</span>}
        {product.tags && product.tags.includes('bestseller') && <span className="tag-badge bestseller">Bestseller</span>}
        {product.tags && product.tags.includes('new') && <span className="tag-badge new-tag">New</span>}
        {!isAdmin && (
          <div className="product-actions">
            <button className={`action-btn ${isWishlisted(pid) ? 'wishlisted' : ''}`} onClick={handleWishlist} title="Wishlist">
              <FiHeart size={16} />
            </button>
            <button className={`action-btn ${isInCompare(pid) ? 'compared' : ''}`} onClick={handleCompare} title="Compare">
              <FiBarChart2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="product-info">
        <p className="product-brand">{product.brand || 'Unknown Brand'}</p>
        <h3 className="product-name">{product.name || 'Unnamed Product'}</h3>
        <StarRating rating={product.rating || 0} reviewCount={product.reviewCount || 0} />
        <div className="price-box" style={{ marginTop: '8px' }}>
          <span className="price-current">₹{(product.price || 0).toLocaleString('en-IN')}</span>
          <span className="price-mrp">₹{(product.mrp || 0).toLocaleString('en-IN')}</span>
          {product.discount > 0 && <span className="price-discount">{product.discount}% off</span>}
        </div>
        {product.deliveryDays && product.deliveryDays <= 2 && (
          <p className="delivery-tag">⚡ {product.deliveryDays === 1 ? 'Tomorrow' : '2-Day'} Delivery</p>
        )}
        {!isAdmin ? (
          <button className="btn btn-primary w-full add-cart-btn" onClick={handleAddToCart} disabled={!inStock}>
            <FiShoppingCart size={15} /> {inStock ? 'Add to Cart' : 'Out of Stock'}
          </button>
        ) : (
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--primary)', fontWeight: 'bold', textAlign: 'center' }}>
            Admin View
          </div>
        )}
      </div>
    </Link>
  )
}
