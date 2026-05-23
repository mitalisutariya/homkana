import { createContext, useContext, useState } from 'react'

const CompareContext = createContext()
export const useCompare = () => useContext(CompareContext)

export function CompareProvider({ children }) {
  const [compareList, setCompareList] = useState([])

  const addToCompare = (product) => {
    setCompareList(prev => {
      const pid = product._id || product.id
      if (prev.find(i => (i._id || i.id) === pid)) return prev
      if (prev.length >= 4) return prev
      return [...prev, product]
    })
  }

  const removeFromCompare = (id) => setCompareList(prev => prev.filter(i => (i._id || i.id) !== id))
  const clearCompare = () => setCompareList([])
  const isInCompare = (id) => compareList.some(i => (i._id || i.id) === id)

  return (
    <CompareContext.Provider value={{ compareList, addToCompare, removeFromCompare, clearCompare, isInCompare }}>
      {children}
    </CompareContext.Provider>
  )
}
