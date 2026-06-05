import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { FiHeart, FiShoppingCart, FiShare2, FiTruck, FiRefreshCw, FiShield, FiStar, FiThumbsUp, FiEdit2, FiTrash2, FiX, FiCheck } from 'react-icons/fi'
import StarRating from '../../components/StarRating/StarRating'
import ProductCard from '../../components/ProductCard/ProductCard'
import { useCart } from '../../context/CartContext'
import { useWishlist } from '../../context/WishlistContext'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'
import { getEffectiveStock, getVariantMrp, getVariantPrice, isInStock } from '../../utils/pricing'
import './ProductDetail.css'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [related, setRelated] = useState([])
  const [featured, setFeatured] = useState([])
  const [reviews, setReviews] = useState([])
  const [canReview, setCanReview] = useState(false)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const [userReview, setUserReview] = useState(null)
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '', images: [] })
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [reviewsLoading, setReviewsLoading] = useState(true)

  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty] = useState(1)
  const [selectedVariantKey, setSelectedVariantKey] = useState(null)
  const [activeTab, setActiveTab] = useState('description')
  const { addToCart } = useCart()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const { showToast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // Fetch product details
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data } = await api.get(`/products/${id}`)
        setProduct(data)
        setRelated(data.relatedProducts || [])
        if (data.variants?.length) {
          const firstAvailable = data.variants.find((v) => (v.stockCount || 0) > 0) || data.variants[0]
          setSelectedVariantKey(String(firstAvailable._id))
        } else {
          setSelectedVariantKey(null)
        }
        setQty(1)
        setActiveImg(0)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [id])

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const { data } = await api.get('/products?sort=popular&limit=12')
        const list = (data.products || [])
          .filter((p) => String(p._id) !== String(id))
          .slice(0, 4)
        setFeatured(list)
      } catch (err) {
        console.error('Error fetching featured products:', err)
      }
    }
    if (id) fetchFeatured()
  }, [id])

  // Fetch reviews and review eligibility
  useEffect(() => {
    const fetchReviewsData = async () => {
      if (!id) return
      try {
        setReviewsLoading(true)
        // Fetch product reviews
        const [reviewsRes, eligibilityRes] = await Promise.all([
          api.get(`/reviews/product/${id}`),
          user ? api.get(`/reviews/can-review/${id}`) : { data: { canReview: false } }
        ])
        setReviews(reviewsRes.data.reviews || [])
        setCanReview(eligibilityRes.data.canReview || false)
        setAlreadyReviewed(eligibilityRes.data.alreadyReviewed || false)
        if (eligibilityRes.data.review) {
          setUserReview(eligibilityRes.data.review)
          setEditingReviewId(eligibilityRes.data.review._id)
        }
      } catch (err) {
        console.error('Error fetching reviews:', err)
      } finally {
        setReviewsLoading(false)
      }
    }
    fetchReviewsData()
  }, [id, user])

  const selectedVariant = product?.variants?.find(
    (v) => String(v._id) === String(selectedVariantKey) || v.sku === selectedVariantKey
  )
  const displayPrice = getVariantPrice(product, selectedVariantKey)
  const displayMrp = getVariantMrp(product, selectedVariantKey)
  const displayDiscount = displayMrp > displayPrice
    ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
    : product?.discount || 0
  const availableStock = getEffectiveStock(product, selectedVariantKey)
  const productInStock = isInStock(product, selectedVariantKey)

  const handleVariantSelect = (variant) => {
    setSelectedVariantKey(String(variant._id))
    setQty(1)
    if (variant.image) {
      const imgIdx = product.images?.indexOf(variant.image)
      if (imgIdx >= 0) setActiveImg(imgIdx)
    }
  }

  const handleAddToCart = () => {
    if (!productInStock) {
      showToast('This item is out of stock', 'error')
      return
    }
    const result = addToCart(product, qty, { variantKey: selectedVariantKey })
    if (result?.ok === false) {
      showToast(result.message || 'Could not add to cart', 'error')
      return
    }
    showToast(
      user
        ? `${product.name} added to cart! 🛒`
        : `${product.name} added to cart. Login when you're ready to checkout.`,
      'success'
    )
  }

  const handleBuyNow = () => {
    if (!productInStock) {
      showToast('This item is out of stock', 'error')
      return
    }
    if (!user) {
      showToast('Please login to buy now', 'info')
      navigate('/auth', { state: { from: '/checkout' } })
      return
    }
    const result = addToCart(product, qty, { variantKey: selectedVariantKey })
    if (result?.ok === false) {
      showToast(result.message || 'Could not add to cart', 'error')
      return
    }
    navigate('/checkout')
  }

  // Review submission
  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    if (reviewForm.rating === 0) {
      showToast('Please select a rating', 'error')
      return
    }
    if (!reviewForm.comment.trim()) {
      showToast('Please write a review', 'error')
      return
    }

    try {
      if (editingReviewId) {
        await api.put(`/reviews/${editingReviewId}`, reviewForm)
        showToast('Review updated successfully!', 'success')
      } else {
        await api.post(`/reviews/product/${id}`, reviewForm)
        showToast('Review submitted successfully!', 'success')
      }
      // Reset and refetch
      setShowReviewForm(false)
      setReviewForm({ rating: 0, comment: '', images: [] })
      setEditingReviewId(null)
      // Refetch reviews
      const [reviewsRes, eligibilityRes] = await Promise.all([
        api.get(`/reviews/product/${id}`),
        user ? api.get(`/reviews/can-review/${id}`) : { data: { canReview: false } }
      ])
      setReviews(reviewsRes.data.reviews || [])
      setCanReview(eligibilityRes.data.canReview || false)
      setAlreadyReviewed(eligibilityRes.data.alreadyReviewed || false)
      if (eligibilityRes.data.review) setUserReview(eligibilityRes.data.review)
      const { data: updatedProduct } = await api.get(`/products/${id}`)
      setProduct(updatedProduct)
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit review', 'error')
    }
  }

  const handleEditReview = (review) => {
    setReviewForm({
      rating: review.rating,
      comment: review.comment,
      images: review.images || []
    })
    setEditingReviewId(review._id)
    setShowReviewForm(true)
  }

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return
    try {
      await api.delete(`/reviews/${reviewId}`)
      showToast('Review deleted successfully!', 'success')
      // If we deleted the user's own review, clear state
      if (reviewId === userReview?._id) {
        setUserReview(null)
        setAlreadyReviewed(false)
      }
      setEditingReviewId(null)
      const [reviewsRes, eligibilityRes] = await Promise.all([
        api.get(`/reviews/product/${id}`),
        user ? api.get(`/reviews/can-review/${id}`) : { data: { canReview: false } }
      ])
      setReviews(reviewsRes.data.reviews || [])
      setCanReview(eligibilityRes.data.canReview || false)
      setAlreadyReviewed(eligibilityRes.data.alreadyReviewed || false)
      const { data: updatedProduct } = await api.get(`/products/${id}`)
      setProduct(updatedProduct)
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete review', 'error')
    }
  }

  if (loading) return <div className="container" style={{ padding: '40px 0', textAlign: 'center' }}>Loading product details...</div>

  if (!product) return (
    <div className="not-found">
      <h2>Product not found 😕</h2>
      <Link to="/products" className="btn btn-primary">Browse Products</Link>
    </div>
  )

  const reviewCount = product.reviewCount ?? reviews.length ?? 0
  const avgRating = product.rating ?? 0
  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }))
  const maxCount = Math.max(...ratingDist.map((r) => r.count), 1)

  return (
    <div className="detail-page">
      <div className="container">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link to="/">Home</Link> / <Link to="/products">Products</Link> /
          <Link to={`/products?category=${product.category}`}>{product.category}</Link> /
          <span>{product.name}</span>
        </div>

        {/* Main Section */}
        <div className="detail-main">
          {/* Gallery */}
          <div className="detail-gallery">
            <div className="main-img-container">
              <div className="main-img-wrap">
                <img src={(product.images && product.images[activeImg]) || (product.images && product.images[0]) || ''} alt={product.name} className="main-img" />
                {displayDiscount > 0 && <span className="detail-discount-badge">-{displayDiscount}% OFF</span>}
              </div>
              <p className="full-view-hint">Click to see full view</p>
            </div>

            {product.images && product.images.length > 1 && (
              <div className="img-thumbnails-wrap">
                {product.images.map((img, i) => (
                  <div
                    key={i}
                    className={`thumbnail-box ${i === activeImg ? 'active' : ''}`}
                    onMouseEnter={() => setActiveImg(i)}
                    onClick={() => setActiveImg(i)}
                  >
                    <img src={img} alt="" className="thumbnail-img" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="detail-info">
            <span className="detail-brand">{product.brand}</span>
            <h1 className="detail-title">{product.name}</h1>

            <div className="detail-rating-row">
              <StarRating rating={avgRating} reviewCount={reviewCount} size="md" />
              {product.tags && product.tags.includes('bestseller') && <span className="badge badge-warning">Bestseller</span>}
              {product.flashSale && <span className="badge badge-error">Flash Sale</span>}
            </div>

            <div className="detail-divider" />

            <div className="price-box detail-price">
              <span className="price-current" style={{ fontSize: '32px' }}>₹{displayPrice.toLocaleString('en-IN')}</span>
              <span className="price-mrp" style={{ fontSize: '18px' }}>₹{displayMrp.toLocaleString('en-IN')}</span>
              {displayDiscount > 0 && <span className="price-discount" style={{ fontSize: '18px' }}>{displayDiscount}% off</span>}
            </div>
            <p className="detail-savings">You save ₹{(displayMrp - displayPrice).toLocaleString('en-IN')} on this purchase!</p>

            <div className="detail-divider" />

            {product.variants?.length > 0 && (
              <div className="variant-section">
                <span className="variant-label">
                  Color: <strong>{selectedVariant?.color || selectedVariant?.name || 'Select'}</strong>
                </span>
                <div className="variant-swatches">
                  {product.variants.map((variant) => (
                    <button
                      key={variant._id}
                      type="button"
                      className={`color-swatch ${String(selectedVariantKey) === String(variant._id) ? 'active' : ''}`}
                      onClick={() => handleVariantSelect(variant)}
                      title={`${variant.color || variant.name}${(variant.stockCount || 0) <= 0 ? ' (Out of stock)' : ''}`}
                      disabled={(variant.stockCount || 0) <= 0}
                      style={{ opacity: (variant.stockCount || 0) <= 0 ? 0.45 : 1 }}
                    >
                      <span
                        className="color-swatch-inner"
                        style={{ background: variant.colorHex || '#ccc' }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className={`stock-status ${productInStock ? 'in-stock' : 'out-of-stock'}`}>
              {productInStock ? `${availableStock} in stock` : 'Out of Stock'}
            </p>

            {/* Qty */}
            <div className="qty-row">
              <span className="qty-label">Quantity:</span>
              <div className="qty-stepper">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={!productInStock}>−</button>
                <span>{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(availableStock, q + 1))}
                  disabled={!productInStock || qty >= availableStock}
                >
                  +
                </button>
              </div>
            </div>

            {/* CTA Buttons */}
            {!isAdmin ? (
              <div className="detail-cta">
                <button className="btn btn-primary btn-lg cta-btn" onClick={handleAddToCart} disabled={!productInStock}>
                  <FiShoppingCart size={18} /> {productInStock ? 'Add to Cart' : 'Out of Stock'}
                </button>
                <button className="btn btn-accent btn-lg cta-btn" onClick={handleBuyNow} disabled={!productInStock}>
                  ⚡ Buy Now
                </button>
              </div>
            ) : (
              <div style={{ background: 'rgba(79, 60, 201, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid var(--primary)', marginBottom: '24px' }}>
                <p style={{ margin: 0, color: 'var(--primary)', fontWeight: 'bold', textAlign: 'center' }}>
                  👑 Admin Mode — View Only
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '13px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Shopping functionality is disabled for admin accounts.
                </p>
              </div>
            )}

            {/* Action Row */}
            <div className="detail-actions">
              {!isAdmin && (
                <>
                  <button
                    className={`action-link ${isWishlisted(product._id) ? 'wishlisted' : ''}`}
                    onClick={() => toggleWishlist(product)}
                  >
                    <FiHeart size={16} /> {isWishlisted(product._id) ? 'Wishlisted' : 'Add to Wishlist'}
                  </button>
                </>
              )}
              <button className="action-link" onClick={() => { navigator.clipboard?.writeText(window.location.href); showToast('Link copied!', 'success') }}>
                <FiShare2 size={16} /> Share
              </button>
            </div>

            <div className="detail-divider" />

            {/* Delivery Info */}
            <div className="delivery-info">
              <div className="delivery-row">
                <FiTruck size={18} color="var(--teal)" />
                <div>
                  <strong>Free Delivery</strong>
                  <span> — {product.deliveryDays <= 1 ? 'Tomorrow' : `Arrives in ${product.deliveryDays} days`}</span>
                </div>
              </div>
              <div className="delivery-row">
                <FiRefreshCw size={18} color="var(--primary)" />
                <div><strong>7-Day</strong> <span>Easy Returns</span></div>
              </div>
              <div className="delivery-row">
                <FiShield size={18} color="var(--success)" />
                <div><strong>1 Year Warranty</strong> <span>Manufacturer warranty</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="detail-tabs-section">
          <div className="detail-tabs">
            {['description', 'reviews'].map(tab => (
              <button key={tab} className={`detail-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'reviews' && ` (${reviewCount})`}
              </button>
            ))}
          </div>

          <div className="tab-content">
            {activeTab === 'description' && (
              <div className="tab-description animate-fadeIn">
                <p>{product.description}</p>
                {product.specs && Object.keys(product.specs).length > 0 && (
                  <div className="product-specs">
                    <h4>Specifications</h4>
                    <table className="specs-table">
                      <tbody>
                        {Object.entries(
                          product.specs instanceof Map
                            ? Object.fromEntries(product.specs)
                            : product.specs
                        ).map(([key, value]) => (
                          <tr key={key}>
                            <th>{key}</th>
                            <td>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <ul className="desc-bullets">
                  <li>Sold & dispatched by HomeKana</li>
                  <li>GST invoice included</li>
                  <li>Fast & reliable delivery</li>
                </ul>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="tab-reviews animate-fadeIn">
                <div className="reviews-summary">
                  <div className="rating-big">
                    <span className="rating-num">{avgRating.toFixed(1)}</span>
                    <div><StarRating rating={avgRating} size="md" /></div>
                    <span className="rating-total">{reviewCount.toLocaleString('en-IN')} ratings</span>
                  </div>
                  <div className="rating-bars">
                    {ratingDist.map(r => (
                      <div key={r.star} className="rating-bar-row">
                        <span className="rb-label">{r.star}★</span>
                        <div className="rb-track"><div className="rb-fill" style={{ width: `${(r.count / maxCount) * 100}%` }} /></div>
                        <span className="rb-count">{r.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Write Review Button - Only shown if user is logged in and can review */}
                {user && !isAdmin && (
                  <div className="write-review-section">
                        {alreadyReviewed ? (
                          <div className="your-review-actions">
                            <p><strong>You've already reviewed this product</strong></p>
                            <button className="btn btn-outline btn-sm" onClick={() => handleEditReview(userReview || reviews.find((r) => r.user?._id === user?._id))}>
                              <FiEdit2 size={14} /> Edit Your Review
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={() => handleDeleteReview((userReview || reviews.find((r) => r.user?._id === user?._id))?._id)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                              <FiTrash2 size={14} /> Delete Review
                            </button>
                          </div>
                        ) : canReview ? (
                      <button className="btn btn-primary write-review-btn" onClick={() => setShowReviewForm(true)}>
                        Write a Review
                      </button>
                    ) : (
                      <p className="review-eligible-msg">
                        You can review this product only after it's delivered. Check "My Orders" for delivery status.
                      </p>
                    )}
                  </div>
                )}

                {/* Review Form Modal */}
                {showReviewForm && (
                  <div className="review-form-overlay" onClick={() => { setShowReviewForm(false); setReviewForm({ rating: 0, comment: '', images: [] }); setEditingReviewId(null) }}>
                    <div className="review-form-modal" onClick={e => e.stopPropagation()}>
                      <div className="review-form-header">
                        <h3>{editingReviewId ? 'Edit Your Review' : 'Write a Review'}</h3>
                        <button className="close-btn" onClick={() => { setShowReviewForm(false); setReviewForm({ rating: 0, comment: '', images: [] }); setEditingReviewId(null) }}>
                          <FiX size={20} />
                        </button>
                      </div>
                      <form onSubmit={handleReviewSubmit}>
                        <div className="form-group">
                          <label>Rating *</label>
                          <div className="star-input" onClick={() => setReviewForm({ ...reviewForm, rating: 0 })}>
                            {[1, 2, 3, 4, 5].map(star => (
                              <FiStar
                                key={star}
                                size={32}
                                className={`star-star ${star <= reviewForm.rating ? 'filled' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setReviewForm({ ...reviewForm, rating: star }) }}
                                style={{ color: star <= reviewForm.rating ? 'var(--warning)' : '#ddd', cursor: 'pointer' }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Your Review *</label>
                          <textarea
                            value={reviewForm.comment}
                            onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                            placeholder="Share your experience with this product..."
                            rows="5"
                            maxLength="1000"
                          />
                          <small>{reviewForm.comment.length}/1000 characters</small>
                        </div>

                        <div className="form-actions">
                          <button type="button" className="btn btn-outline" onClick={() => { setShowReviewForm(false); setReviewForm({ rating: 0, comment: '', images: [] }); setEditingReviewId(null) }}>
                            Cancel
                          </button>
                          <button type="submit" className="btn btn-primary">
                            <FiCheck size={16} /> {editingReviewId ? 'Update Review' : 'Submit Review'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {reviewsLoading ? (
                  <p style={{ textAlign: 'center', padding: '40px' }}>Loading reviews...</p>
                ) : reviews.length === 0 ? (
                  <div className="no-reviews">
                    <FiStar size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                    <p>No reviews yet. Be the first to review this product!</p>
                  </div>
                ) : (
                  <div className="reviews-list">
                    {reviews.map(review => (
                      <div key={review._id} className="review-card">
                        <div className="review-header">
                          <div className="reviewer-avatar">{review.user?.name?.[0] || 'U'}</div>
                          <div>
                            <div className="reviewer-name">{review.user?.name || 'Anonymous'}</div>
                            <StarRating rating={review.rating} size="sm" />
                          </div>
                          {review.verifiedPurchase && <span className="verified-badge">✓ Verified Purchase</span>}
                          {user && (review.user?._id === user._id || user.role === 'admin') && (
                            <div className="review-actions">
                              <button onClick={() => handleEditReview(review)} title="Edit"><FiEdit2 size={14} /></button>
                              <button onClick={() => handleDeleteReview(review._id)} title="Delete"><FiTrash2 size={14} /></button>
                            </div>
                          )}
                        </div>
                        <h4 className="review-title">{review.comment.substring(0, 50)}</h4>
                        <p className="review-body">{review.comment}</p>
                        {review.images && review.images.length > 0 && (
                          <div className="review-images">
                            {review.images.map((img, idx) => (
                              <img key={idx} src={img} alt="Review" className="review-img-thumb" />
                            ))}
                          </div>
                        )}
                        <div className="review-footer">
                          <span className="review-date">{new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <button className="helpful-btn"><FiThumbsUp size={13} /> Helpful ({review.helpful || 0})</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {featured.length > 0 && (
          <div className="related-section">
            <div className="section-header">
              <h2 className="section-title">Featured <span>Products</span></h2>
              <Link to="/products" className="btn btn-outline btn-sm">View All</Link>
            </div>
            <div className="related-grid">
              {featured.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="related-section">
            <div className="section-header">
              <h2 className="section-title">Related <span>Products</span></h2>
              <Link to={`/products?category=${product.category}`} className="btn btn-outline btn-sm">View All</Link>
            </div>
            <div className="related-grid">
              {related.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
