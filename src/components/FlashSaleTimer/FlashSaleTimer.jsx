import { useState, useEffect } from 'react'
import './FlashSaleTimer.css'

export default function FlashSaleTimer({ endHours = 5 }) {
  const getTime = () => {
    const end = new Date()
    end.setHours(end.getHours() + endHours)
    const diff = end - new Date()
    return {
      h: String(Math.floor((diff / 3600000) % 24)).padStart(2, '0'),
      m: String(Math.floor((diff / 60000) % 60)).padStart(2, '0'),
      s: String(Math.floor((diff / 1000) % 60)).padStart(2, '0'),
    }
  }
  const [time, setTime] = useState(getTime)
  useEffect(() => {
    const t = setInterval(() => setTime(getTime()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flash-timer">
      <span className="timer-label">⚡ Ends in:</span>
      {[time.h, time.m, time.s].map((v, i) => (
        <span key={i} className="timer-block">
          <span className="timer-digit">{v}</span>
          <span className="timer-unit">{['HRS', 'MIN', 'SEC'][i]}</span>
          {i < 2 && <span className="timer-sep">:</span>}
        </span>
      ))}
    </div>
  )
}
