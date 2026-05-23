import { Routes, Route } from 'react-router-dom'
import Header from './components/Header/Header'
import Footer from './components/Footer/Footer'
import Home from './pages/Home/Home'
import ProductListing from './pages/ProductListing/ProductListing'
import ProductDetail from './pages/ProductDetail/ProductDetail'
import Cart from './pages/Cart/Cart'
import Auth from './pages/Auth/Auth'
import ResetPassword from './pages/Auth/ResetPassword'
import Checkout from './pages/Checkout/Checkout'
import Profile from './pages/Profile/Profile'
import OrdersList from './pages/Orders/OrdersList'
import OrderDetail from './pages/Orders/OrderDetail'
import ProtectedRoute from './components/ProtectedRoute'
import CompareBar from './components/CompareBar/CompareBar'
import Toast from './components/Toast/Toast'
import ScrollToTop from './components/ScrollToTop'
import './App.css'

function App() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main className="page-wrapper">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<ProductListing />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/resetpassword/:token" element={<ResetPassword />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/orders" element={<ProtectedRoute><OrdersList /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
        </Routes>
      </main>
      <Footer />
      <CompareBar />
      <Toast />
    </>
  )
}

export default App
