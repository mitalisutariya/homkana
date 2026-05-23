import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import { useToast } from '../../context/ToastContext'
import axios from 'axios'
import './Auth.css'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { token } = useParams()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const handleReset = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      showToast('Passwords do not match', 'error')
      return
    }
    if (password.length < 6) {
      showToast('Password must be 6+ characters', 'error')
      return
    }

    setLoading(true)
    try {
      await axios.put(`http://localhost:5500/api/auth/resetpassword/${token}`, { password })
      showToast('Password reset successful! 🎉', 'success')
      navigate('/auth')
    } catch (err) {
      showToast(err.response?.data?.message || 'Invalid or expired token', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">HK</div>
          <span className="auth-logo-text">Home<span>Kana</span></span>
        </div>

        <form className="auth-form animate-fadeIn" onSubmit={handleReset}>
          <h2 className="auth-title">Reset Password 🔐</h2>
          <p className="auth-subtitle">Create a new password for your account.</p>
          
          <div className="form-group">
            <label className="input-label">New Password</label>
            <div className="pass-wrap">
              <input 
                className="input" 
                type={showPass ? 'text' : 'password'} 
                placeholder="Enter new password"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              <button type="button" className="pass-toggle" onClick={() => setShowPass(!showPass)}>
                {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="input-label">Confirm New Password</label>
            <input 
              className="input" 
              type="password" 
              placeholder="Re-enter new password"
              value={confirm} 
              onChange={e => setConfirm(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary w-full auth-submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
