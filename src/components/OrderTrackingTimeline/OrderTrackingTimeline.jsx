import { FiCheck, FiExternalLink, FiTruck } from 'react-icons/fi'
import { getTrackingTimeline, getAwbNumber, getTrackingUrl } from '../../utils/orderTracking'
import './OrderTrackingTimeline.css'

export default function OrderTrackingTimeline({ order }) {
  const steps = getTrackingTimeline(order)
  const awb = getAwbNumber(order)
  const trackUrl = getTrackingUrl(order)
  const shippedOrLater = ['Shipped', 'Out for Delivery', 'Delivered'].includes(order?.orderStatus)

  return (
    <div className="order-tracking-timeline">
      <h4 className="order-tracking-title">Order Tracking</h4>

      {order.deliveryInfo?.estimatedDeliveryDate && (
        <p className="order-edd">
          Expected delivery:{' '}
          <strong>
            {new Date(order.deliveryInfo.estimatedDeliveryDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </strong>
        </p>
      )}

      {awb && shippedOrLater && (
        <div className="order-awb-card">
          <div className="order-awb-header">
            <FiTruck size={20} />
            <div>
              <span className="order-awb-label">AWB / Shipment Number</span>
              <strong className="order-awb-value">{awb}</strong>
            </div>
          </div>
          {order.deliveryInfo?.courierName && (
            <p className="order-awb-courier">Courier: {order.deliveryInfo.courierName}</p>
          )}
          {trackUrl && (
            <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm order-track-btn">
              Track Shipment <FiExternalLink size={14} />
            </a>
          )}
        </div>
      )}

      <div className="order-tracking-steps">
        {steps.map((step, idx) => (
          <div
            key={`${step.status}-${idx}`}
            className={`order-tracking-step ${step.completed ? 'completed' : ''} ${step.current ? 'current' : ''}`}
          >
            <div className="order-tracking-marker-col">
              <div className="order-tracking-marker">
                {step.completed ? <FiCheck size={14} /> : idx + 1}
              </div>
              {idx < steps.length - 1 && <div className="order-tracking-line" />}
            </div>
            <div className="order-tracking-content">
              <strong>{step.label}{step.current ? ' (Current)' : ''}</strong>
              {step.timestamp && (
                <span className="order-tracking-time">
                  {new Date(step.timestamp).toLocaleString('en-IN')}
                </span>
              )}
              {step.note && <p className="order-tracking-note">{step.note}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
