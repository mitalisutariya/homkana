import { useToast } from '../../context/ToastContext'
import { FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo } from 'react-icons/fi'
import './Toast.css'

const icons = { success: <FiCheckCircle />, error: <FiAlertCircle />, warning: <FiAlertTriangle />, info: <FiInfo /> }

export default function Toast() {
  const { toasts } = useToast()
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">{icons[t.type]}</span>
          {t.message}
        </div>
      ))}
    </div>
  )
}
