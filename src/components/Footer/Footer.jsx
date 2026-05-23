import { Link } from 'react-router-dom'
import { FiFacebook, FiTwitter, FiInstagram, FiYoutube } from 'react-icons/fi'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="container footer-grid">
          <div className="footer-brand">
            <div className="footer-logo">
              <div className="logo-icon-sm">HK</div>
              <span className="footer-logo-text">Home<span>Kana</span></span>
            </div>
            <p>India's premier online marketplace for electronics, fashion, home decor and more. Shop smart, live better.</p>
            <div className="footer-social">
              <a href="#" aria-label="Facebook"><FiFacebook /></a>
              <a href="#" aria-label="Twitter"><FiTwitter /></a>
              <a href="#" aria-label="Instagram"><FiInstagram /></a>
              <a href="#" aria-label="YouTube"><FiYoutube /></a>
            </div>
          </div>

          <div className="footer-col">
            <h4>Quick Links</h4>
            <Link to="/">Home</Link>
            <Link to="/products">All Products</Link>
            <Link to="/products?category=electronics">Electronics</Link>
            <Link to="/products?category=fashion">Fashion</Link>
            <Link to="/products?category=home-decor">Home Decor</Link>
          </div>

          <div className="footer-col">
            <h4>Customer Service</h4>
            <a href="#">Help Center</a>
            <a href="#">Track Order</a>
            <a href="#">Returns & Refunds</a>
            <a href="#">Shipping Policy</a>
            <a href="#">Contact Us</a>
          </div>

          <div className="footer-col">
            <h4>My Account</h4>
            <Link to="/auth">Login / Sign Up</Link>
            <Link to="/orders">My Orders</Link>
            <Link to="/profile">My Wishlist</Link>
            <Link to="/cart">My Cart</Link>
            <a href="#">Seller Portal</a>
          </div>
        </div>
      </div>

      <div className="footer-payments">
        <div className="container">
          <span className="payment-label">Secure Payments:</span>
          <div className="payment-icons">
            {['UPI', 'Visa', 'MasterCard', 'Paytm', 'PhonePe', 'NetBanking', 'COD'].map(p => (
              <span key={p} className="payment-chip">{p}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p>© 2025 HomeKana. All rights reserved.</p>
          <div className="footer-legal">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Use</a>
            <a href="#">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
