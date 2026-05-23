import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { useNavigate } from 'react-router-dom'

const WishlistContext = createContext()
export const useWishlist = () => useContext(WishlistContext)

export function WishlistProvider({ children }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('wishlistItems')
    return saved ? JSON.parse(saved) : []
  })

  // Sync to localStorage and Backend
  useEffect(() => {
    localStorage.setItem('wishlistItems', JSON.stringify(items))
    
    const userInfo = localStorage.getItem('userInfo')
    if (userInfo) {
      const { token } = JSON.parse(userInfo)
      api.put('/auth/wishlist', { wishlist: items.map(i => i._id || i.id) }, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(err => console.error('Wishlist sync failed:', err))
    }
  }, [items])

  // Sync from Auth User on login
  useEffect(() => {
    if (user && user.wishlist) {
      setItems(user.wishlist)
    }
  }, [user])

  // Clear on logout
  useEffect(() => {
    if (!user) {
      setItems([])
      localStorage.removeItem('wishlistItems')
    }
  }, [user])

  const addToWishlist = (product) => {
    const pid = product._id || product.id
    setItems(prev => prev.find(i => (i._id || i.id) === pid) ? prev : [...prev, product])
  }

  const removeFromWishlist = (id) => setItems(prev => prev.filter(i => (i._id || i.id) !== id))

  const isWishlisted = (id) => items.some(i => (i._id || i.id) === id)

  const toggleWishlist = (product) => {
    if (!user) {
      showToast('Please login to use wishlist', 'info')
      navigate('/auth')
      return
    }
    const pid = product._id || product.id
    const adding = !isWishlisted(pid)
    adding ? addToWishlist(product) : removeFromWishlist(pid)
    showToast(adding ? '❤️ Added to wishlist!' : 'Removed from wishlist', 'info')
  }

  return (
    <WishlistContext.Provider value={{ items, addToWishlist, removeFromWishlist, isWishlisted, toggleWishlist }}>
      {children}
    </WishlistContext.Provider>
  )
}
