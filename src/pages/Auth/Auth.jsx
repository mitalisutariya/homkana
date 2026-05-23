import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { FiEye, FiEyeOff, FiArrowLeft } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import axios from 'axios'
import './Auth.css'

export default function Auth() {
  const [tab, setTab] = useState('login')
  const [isForgot, setIsForgot] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [signupData, setSignupData] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [forgotEmail, setForgotEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const { login, registerUser, loginWithGoogle } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const searchParams = new URLSearchParams(location.search)
  const redirectPath = location.state?.from || searchParams.get('from') || '/'
  const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!forgotEmail.includes('@')) {
      showToast('Please enter a valid email', 'error')
      return
    }
    try {
      await axios.post('http://localhost:5500/api/auth/forgotpassword', { email: forgotEmail })
      showToast('Reset link sent to your email! 📧', 'success')
      setIsForgot(false)
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  const validateLogin = () => {
    const e = {}
    if (!loginData.email.includes('@')) e.email = 'Enter a valid email'
    if (loginData.password.length < 6) e.password = 'Password must be 6+ chars'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateSignup = () => {
    const e = {}
    if (signupData.name.length < 2) e.name = 'Name too short'
    if (!signupData.email.includes('@')) e.email = 'Enter valid email'
    if (!/^[6-9]\d{9}$/.test(signupData.phone)) e.phone = 'Enter valid 10-digit number'
    if (signupData.password.length < 6) e.password = 'Min 6 characters'
    if (signupData.password !== signupData.confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setApiError('')
    if (!validateLogin()) return
    try {
      await login(loginData.email, loginData.password)
      showToast('Welcome back! 🎉', 'success')
      navigate(redirectPath)
    } catch (err) {
      setApiError(err)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setApiError('')
    if (!validateSignup()) return
    try {
      await registerUser(signupData.name, signupData.email, signupData.password)
      showToast(`Welcome to HomeKana, ${signupData.name}! 🎉`, 'success')
      navigate(redirectPath)
    } catch (err) {
      setApiError(err)
    }
  }

  const handleGoogleSuccess = async (credentialResponse) => {
    setApiError('')
    const credential = credentialResponse?.credential
    if (!credential) {
      setApiError('Google sign-in did not return a credential')
      return
    }
    try {
      const data = await loginWithGoogle(credential)
      showToast(`Welcome, ${data.name}! 🎉`, 'success')
      navigate(redirectPath)
    } catch (err) {
      setApiError(typeof err === 'string' ? err : err.message || 'Google sign-in failed')
    }
  }

  const handleGoogleError = () => {
    setApiError('Google sign-in was cancelled or failed')
  }

  const googleButton = googleConfigured ? (
    <div className="google-login-wrap">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        text={tab === 'login' ? 'continue_with' : 'signup_with'}
        shape="rectangular"
        theme="outline"
        size="large"
        width={380}
      />
    </div>
  ) : (
    <p className="google-config-hint">Add VITE_GOOGLE_CLIENT_ID to enable Google Sign-In.</p>
  )

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">HK</div>
          <span className="auth-logo-text">Home<span>Kana</span></span>
        </div>

        {isForgot ? (
          <form className="auth-form animate-fadeIn" onSubmit={handleForgotPassword}>
            <button type="button" className="back-btn" onClick={() => setIsForgot(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, marginBottom: '16px' }}>
              <FiArrowLeft /> Back to Login
            </button>
            <h2 className="auth-title">Forgot Password? 🔑</h2>
            <p className="auth-subtitle">Enter your email and we'll send you a link to reset your password.</p>

            <div className="form-group">
              <label className="input-label">Email Address</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-full auth-submit">Send Reset Link</button>
          </form>
        ) : (
          <>
            <div className="auth-tabs">
              <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setErrors({}) }}>Login</button>
              <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setErrors({}) }}>Sign Up</button>
            </div>

            {tab === 'login' ? (
              <form className="auth-form animate-fadeIn" onSubmit={handleLogin}>
                <h2 className="auth-title">Welcome Back! 👋</h2>
                <p className="auth-subtitle">Login to access your account and orders</p>
                {apiError && <div className="error-msg" style={{ textAlign: 'center', marginBottom: '8px' }}>{apiError}</div>}

                <div className="form-group">
                  <label className="input-label">Email Address</label>
                  <input className={`input ${errors.email ? 'input-error' : ''}`} type="email" placeholder="you@example.com"
                    value={loginData.email} onChange={e => setLoginData(p => ({ ...p, email: e.target.value }))} />
                  {errors.email && <span className="error-msg">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label className="input-label">Password</label>
                  <div className="pass-wrap">
                    <input className={`input ${errors.password ? 'input-error' : ''}`} type={showPass ? 'text' : 'password'}
                      placeholder="Enter password" value={loginData.password}
                      onChange={e => setLoginData(p => ({ ...p, password: e.target.value }))} />
                    <button type="button" className="pass-toggle" onClick={() => setShowPass(!showPass)}>
                      {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                  {errors.password && <span className="error-msg">{errors.password}</span>}
                  <button type="button" className="forgot-link" onClick={() => setIsForgot(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '8px', color: 'var(--primary)', fontWeight: 500 }}>Forgot password?</button>
                </div>

                <button type="submit" className="btn btn-primary w-full auth-submit">Login to HomeKana</button>

                <div className="divider-text">or continue with</div>
                {googleButton}
              </form>
            ) : (
              <form className="auth-form animate-fadeIn" onSubmit={handleSignup}>
                <h2 className="auth-title">Create Account ✨</h2>
                <p className="auth-subtitle">Join millions of happy shoppers</p>
                {apiError && <div className="error-msg" style={{ textAlign: 'center', marginBottom: '8px' }}>{apiError}</div>}

                <div className="form-group">
                  <label className="input-label">Full Name</label>
                  <input className={`input ${errors.name ? 'input-error' : ''}`} type="text" placeholder="Your full name"
                    value={signupData.name} onChange={e => setSignupData(p => ({ ...p, name: e.target.value }))} />
                  {errors.name && <span className="error-msg">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label className="input-label">Email Address</label>
                  <input className={`input ${errors.email ? 'input-error' : ''}`} type="email" placeholder="you@example.com"
                    value={signupData.email} onChange={e => setSignupData(p => ({ ...p, email: e.target.value }))} />
                  {errors.email && <span className="error-msg">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label className="input-label">Phone Number</label>
                  <input className={`input ${errors.phone ? 'input-error' : ''}`} type="tel" placeholder="10-digit mobile number"
                    value={signupData.phone} onChange={e => setSignupData(p => ({ ...p, phone: e.target.value }))} />
                  {errors.phone && <span className="error-msg">{errors.phone}</span>}
                </div>

                <div className="form-group">
                  <label className="input-label">Password</label>
                  <div className="pass-wrap">
                    <input className={`input ${errors.password ? 'input-error' : ''}`} type={showPass ? 'text' : 'password'}
                      placeholder="Create a password" value={signupData.password}
                      onChange={e => setSignupData(p => ({ ...p, password: e.target.value }))} />
                    <button type="button" className="pass-toggle" onClick={() => setShowPass(!showPass)}>
                      {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                  {errors.password && <span className="error-msg">{errors.password}</span>}
                </div>

                <div className="form-group">
                  <label className="input-label">Confirm Password</label>
                  <input className={`input ${errors.confirm ? 'input-error' : ''}`} type="password" placeholder="Re-enter password"
                    value={signupData.confirm} onChange={e => setSignupData(p => ({ ...p, confirm: e.target.value }))} />
                  {errors.confirm && <span className="error-msg">{errors.confirm}</span>}
                </div>

                <button type="submit" className="btn btn-primary w-full auth-submit">Create My Account</button>

                <div className="divider-text">or sign up with</div>
                {googleButton}
              </form>
            )}
          </>
        )}

        <p className="auth-terms">By continuing, you agree to HomeKana's <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a></p>
      </div>
    </div>
  )
}
