import { useCompare } from '../../context/CompareContext'
import { Link } from 'react-router-dom'
import { FiX } from 'react-icons/fi'
import './CompareBar.css'

export default function CompareBar() {
  const { compareList, removeFromCompare, clearCompare } = useCompare()
  if (compareList.length === 0) return null

  return (
    <div className="compare-bar animate-fadeIn">
      <div className="container compare-bar-inner">
        <span className="compare-title">Compare ({compareList.length}/4)</span>
        <div className="compare-items">
          {compareList.map(p => (
            <div key={p.id} className="compare-item">
              <img src={p.images[0]} alt={p.name} />
              <span>{p.name.substring(0, 20)}...</span>
              <button onClick={() => removeFromCompare(p.id)}><FiX size={14} /></button>
            </div>
          ))}
        </div>
        <div className="compare-actions">
          {compareList.length >= 2 && (
            <Link to={`/products?compare=${compareList.map(p=>p.id).join(',')}`} className="btn btn-primary btn-sm">
              Compare Now
            </Link>
          )}
          <button onClick={clearCompare} className="btn btn-ghost btn-sm">Clear All</button>
        </div>
      </div>
    </div>
  )
}
