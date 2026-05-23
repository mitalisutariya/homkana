import api from '../api';

/**
 * Loads the Razorpay Checkout script dynamically
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Handles the complete Razorpay payment flow
 * @param {Object} options - Order details and user info
 * @returns {Promise} - Resolves with payment details or rejects with error
 */
export const processPayment = async ({ amount, name, email, contact, orderId }) => {
  try {
    // 1. Load Script
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      throw new Error('Razorpay SDK failed to load. Are you online?');
    }

    // 2. Get Key from Backend
    const { data: key } = await api.get('/config/razorpay');

    // 3. Create Order on Backend
    const { data: order } = await api.post('/orders/razorpay/create', { amount });

    // 4. Initialize Razorpay
    return new Promise((resolve, reject) => {
      const options = {
        key,
        amount: order.amount,
        currency: order.currency,
        name: 'HomeKana',
        description: 'India\'s Premier Marketplace',
        order_id: order.id,
        prefill: { name, email, contact },
        theme: { color: '#4F3CC9' },
        handler: async (response) => {
          try {
            // 5. Verify Payment on Backend
            const { data: verification } = await api.post('/orders/razorpay/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId
            });
            resolve({ status: 'success', ...verification, response });
          } catch (err) {
            reject({ status: 'error', message: 'Payment verification failed', error: err });
          }
        },
        modal: {
          onhighlight: function() {},
          ondismiss: function() {
            reject({ status: 'cancelled', message: 'Payment window closed' });
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  } catch (error) {
    throw error;
  }
};
