import './StarRating.css'

export default function StarRating({ rating, reviewCount, size = 'sm' }) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < Math.floor(rating)) return 'full'
    if (i < rating) return 'half'
    return 'empty'
  })
  return (
    <div className={`star-rating star-${size}`}>
      <div className="stars">
        {stars.map((type, i) => (
          <span key={i} className={`star star-${type}`}>
            {type === 'full' ? '★' : type === 'half' ? '⯨' : '☆'}
          </span>
        ))}
      </div>
      <span className="rating-value">{rating}</span>
      {reviewCount && <span className="review-count">({reviewCount.toLocaleString('en-IN')})</span>}
    </div>
  )
}
