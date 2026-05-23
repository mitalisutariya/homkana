export const getAwbNumber = (order) => {
  const info = order?.deliveryInfo;
  if (!info) return '';
  return info.awbNumber || info.trackingId || '';
};

export const getTrackingUrl = (order) => {
  const info = order?.deliveryInfo;
  const awb = getAwbNumber(order);
  if (!awb) return null;
  if (info?.trackingUrl) return info.trackingUrl;

  const courier = (info?.courierName || '').toLowerCase();
  if (courier.includes('delhivery')) {
    return `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`;
  }
  if (courier.includes('blue dart') || courier.includes('bluedart')) {
    return `https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo=${encodeURIComponent(awb)}`;
  }
  if (courier.includes('dtdc')) {
    return `https://www.dtdc.in/tracking.asp?strCnno=${encodeURIComponent(awb)}`;
  }
  if (courier.includes('ekart') || courier.includes('flipkart')) {
    return `https://www.ekartlogistics.com/track/${encodeURIComponent(awb)}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${awb} courier tracking`)}`;
};

export const TRACKING_STEPS = [
  'Pending',
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

export const getTrackingTimeline = (order) => {
  if (order?.trackingTimeline?.length) return order.trackingTimeline;

  const currentStatus = order?.orderStatus;
  const history = order?.statusHistory || [];
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

  const currentIndex = TRACKING_STEPS.indexOf(currentStatus);

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
