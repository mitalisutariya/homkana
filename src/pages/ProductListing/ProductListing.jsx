import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { FiFilter, FiX, FiChevronDown, FiChevronUp, FiSearch } from 'react-icons/fi'
import api from '../../api'
import ProductCard from '../../components/ProductCard/ProductCard'
import { categories } from '../../data/categories'
import './ProductListing.css'

const ITEMS_PER_PAGE = 12

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest First' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating',     label: 'Top Rated' },
  { value: 'popular',    label: 'Most Popular' },
]

const RATINGS = [4, 3, 2, 1]

export default function ProductListing() {
  const { categoryId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Data state
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false)
  const [openSections, setOpenSections] = useState({ price: true, rating: true, availability: true })
  const [maxPrice, setMaxPrice] = useState(50000)
  const [priceRange, setPriceRange] = useState(50000)
  const [minRating, setMinRating] = useState(0)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sortBy, setSortBy] = useState('newest')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [page, setPage] = useState(1)

  // Derived
  const currentCategory = categories.find(c => c.id === categoryId)

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (categoryId) params.category = categoryId
      const { data } = await api.get('/products', { params })
      setProducts(data.products || data)

      // Set max price from actual data
      const prices = (data.products || data).map(p => p.price)
      if (prices.length > 0) {
        const top = Math.ceil(Math.max(...prices) / 1000) * 1000
        setMaxPrice(top)
        setPriceRange(top)
      }
    } catch (err) {
      console.error('Failed to load products:', err)
      setError('Failed to load products. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    fetchProducts()
    setPage(1)
    setMinRating(0)
    setInStockOnly(false)
    setSortBy('newest')
    setSearchQuery(searchParams.get('q') || '')
  }, [categoryId])

  // Apply filters + sort
  const filtered = products
    .filter(p => {
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !p.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (p.price > priceRange) return false
      if (minRating > 0 && (p.rating || 0) < minRating) return false
      if (inStockOnly && !p.inStock) return false
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':  return a.price - b.price
        case 'price_desc': return b.price - a.price
        case 'rating':     return (b.rating || 0) - (a.rating || 0)
        case 'popular':    return (b.numReviews || 0) - (a.numReviews || 0)
        default:           return new Date(b.createdAt) - new Date(a.createdAt)
      }
    })

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const resetFilters = () => {
    setPriceRange(maxPrice)
    setMinRating(0)
    setInStockOnly(false)
    setSortBy('newest')
    setSearchQuery('')
    setPage(1)
  }

  const activeFilterCount = [
    priceRange < maxPrice,
    minRating > 0,
    inStockOnly,
    searchQuery.length > 0,
  ].filter(Boolean).length

  const toggleSection = (key) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  const handlePageChange = (p) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Active filter chips
  const activeChips = [
    ...(priceRange < maxPrice ? [{ label: `Under ₹${priceRange.toLocaleString('en-IN')}`, onRemove: () => setPriceRange(maxPrice) }] : []),
    ...(minRating > 0 ? [{ label: `${minRating}★ & above`, onRemove: () => setMinRating(0) }] : []),
    ...(inStockOnly ? [{ label: 'In Stock', onRemove: () => setInStockOnly(false) }] : []),
    ...(searchQuery ? [{ label: `"${searchQuery}"`, onRemove: () => setSearchQuery('') }] : []),
  ]

  return (
    <div className="listing-page">
      <div className="container">
        {/* Category Banner */}
        {currentCategory && (
          <div className="category-banner" style={{ background: `linear-gradient(135deg, ${currentCategory.color}22, ${currentCategory.color}11)`, borderLeft: `4px solid ${currentCategory.color}` }}>
            <span className="category-banner-icon">{currentCategory.icon}</span>
            <div>
              <h1 className="category-banner-title" style={{ color: currentCategory.color }}>{currentCategory.name}</h1>
              <p className="category-banner-sub">Browse our curated collection of {currentCategory.name.toLowerCase()} products</p>
            </div>
          </div>
        )}

        <div className="listing-layout">
          {/* Filter Panel */}
          <aside className={`filter-panel ${filterOpen ? 'open' : ''}`}>
            <div className="filter-header">
              <span className="filter-title">
                Filters {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {activeFilterCount > 0 && (
                  <button className="clear-all-btn" onClick={resetFilters}>Clear All</button>
                )}
                <button className="filter-close-btn" onClick={() => setFilterOpen(false)}><FiX /></button>
              </div>
            </div>

            {/* Price */}
            <div className="filter-section">
              <button className="filter-section-btn" onClick={() => toggleSection('price')}>
                Price Range {openSections.price ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </button>
              {openSections.price && (
                <div className="filter-body">
                  <div className="price-display">Up to ₹{priceRange.toLocaleString('en-IN')}</div>
                  <input
                    type="range" className="price-slider"
                    min={0} max={maxPrice} step={100}
                    value={priceRange}
                    onChange={e => { setPriceRange(Number(e.target.value)); setPage(1) }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>₹0</span><span>₹{maxPrice.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Rating */}
            <div className="filter-section">
              <button className="filter-section-btn" onClick={() => toggleSection('rating')}>
                Rating {openSections.rating ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </button>
              {openSections.rating && (
                <div className="filter-body">
                  {RATINGS.map(r => (
                    <label key={r} className="filter-check">
                      <input
                        type="radio" name="rating"
                        checked={minRating === r}
                        onChange={() => { setMinRating(minRating === r ? 0 : r); setPage(1) }}
                      />
                      {'★'.repeat(r)}{'☆'.repeat(4 - r)} & above
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Availability */}
            <div className="filter-section">
              <button className="filter-section-btn" onClick={() => toggleSection('availability')}>
                Availability {openSections.availability ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </button>
              {openSections.availability && (
                <div className="filter-body">
                  <label className="filter-check">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={e => { setInStockOnly(e.target.checked); setPage(1) }}
                    />
                    In Stock Only
                  </label>
                </div>
              )}
            </div>
          </aside>

          {/* Overlay for mobile */}
          {filterOpen && <div className="filter-overlay" onClick={() => setFilterOpen(false)} />}

          {/* Main */}
          <main className="listing-main">
            {/* Top bar */}
            <div className="listing-topbar">
              <div>
                {!currentCategory ? (
                  <h1 className="listing-heading">
                    <span>All Products</span>
                  </h1>
                ) : (
                  <div className="listing-heading">
                    <span className="category-icon">{currentCategory.icon}</span>
                    <span>{currentCategory.name}</span>
                  </div>
                )}
                <div className="listing-count">
                  {loading ? 'Loading...' : `${filtered.length} product${filtered.length !== 1 ? 's' : ''} found`}
                </div>
              </div>
              <div className="listing-controls">
                <button className="filter-toggle-btn btn btn-outline btn-sm" onClick={() => setFilterOpen(true)}>
                  <FiFilter /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                </button>
                <div className="search-box">
                  <FiSearch className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
                  />
                  {searchQuery && (
                    <button className="search-clear" onClick={() => setSearchQuery('')}><FiX size={14} /></button>
                  )}
                </div>
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={e => { setSortBy(e.target.value); setPage(1) }}
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active filter chips */}
            {activeChips.length > 0 && (
              <div className="active-filters">
                <span className="active-filter-label">Active:</span>
                {activeChips.map((chip, i) => (
                  <div key={i} className="active-filter-chip">
                    {chip.label}
                    <button onClick={chip.onRemove}><FiX size={11} /></button>
                  </div>
                ))}
                <button className="clear-all-btn" onClick={resetFilters}>Clear All</button>
              </div>
            )}

            {/* Products grid */}
            {loading ? (
              <div className="listing-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="product-skeleton" />
                ))}
              </div>
            ) : error ? (
              <div className="no-results">
                <span style={{ fontSize: '48px' }}>⚠️</span>
                <h3>Something went wrong</h3>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={fetchProducts}>Retry</button>
              </div>
            ) : paginated.length === 0 ? (
              <div className="no-results">
                <span style={{ fontSize: '48px' }}>🔍</span>
                <h3>No Products Found</h3>
                <p>Try adjusting your filters or search query.</p>
                <button className="btn btn-primary" onClick={resetFilters}>Reset Filters</button>
              </div>
            ) : (
              <div className="listing-grid">
                {paginated.map(product => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="pagination">
                <button
                  className="page-btn"
                  disabled={page === 1}
                  onClick={() => handlePageChange(page - 1)}
                >‹ Prev</button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === '...'
                      ? <span key={`ellipsis-${i}`} className="page-ellipsis">…</span>
                      : <button
                          key={p}
                          className={`page-btn ${page === p ? 'active' : ''}`}
                          onClick={() => handlePageChange(p)}
                        >{p}</button>
                  )}

                <button
                  className="page-btn"
                  disabled={page === totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >Next ›</button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}