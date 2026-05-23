export const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Returned',
  'Refunded',
];

export const TRACKING_STEPS = [
  'Pending',
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

const STATUS_TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Packed', 'Cancelled'],
  Packed: ['Shipped', 'Cancelled'],
  Shipped: ['Out for Delivery', 'Cancelled'],
  'Out for Delivery': ['Delivered', 'Cancelled'],
  Delivered: ['Returned'],
  Cancelled: ['Refunded'],
  Returned: ['Refunded'],
  Refunded: [],
};

export const canTransitionStatus = (fromStatus, toStatus) => {
  if (fromStatus === toStatus) return true;
  const allowed = STATUS_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
};

export const getStepIndex = (status) => {
  if (['Cancelled', 'Returned', 'Refunded'].includes(status)) return -1;
  const idx = TRACKING_STEPS.indexOf(status);
  return idx >= 0 ? idx : 0;
};

export const buildTrackingTimeline = (order) => {
  const currentStatus = order.orderStatus;
  const history = order.statusHistory || [];
  const isTerminal = ['Cancelled', 'Returned', 'Refunded'].includes(currentStatus);

  if (isTerminal) {
    return history.map((entry) => ({
      status: entry.status,
      label: entry.status,
      completed: true,
      current: entry.status === currentStatus,
      timestamp: entry.timestamp,
      note: entry.note,
    }));
  }

  const currentIndex = getStepIndex(currentStatus);

  return TRACKING_STEPS.map((step, index) => {
    const historyEntry = [...history].reverse().find((h) => h.status === step);
    return {
      status: step,
      label: step,
      completed: index <= currentIndex,
      current: step === currentStatus,
      timestamp: historyEntry?.timestamp || null,
      note: historyEntry?.note || null,
    };
  });
};
