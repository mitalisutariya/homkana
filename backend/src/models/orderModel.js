import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  orderItems: [{
    name: { type: String, required: true },
    qty: { type: Number, required: true },
    image: { type: String, required: false, default: '' },
    price: { type: Number, required: true },
    mrp: { type: Number },
    product: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
    variantKey: { type: String },
    variantLabel: { type: String },
    brand: { type: String },
    category: { type: String },
  }],
  shippingAddress: {
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: { type: String, required: true },
  },
  paymentMethod: { type: String, required: true, enum: ['razorpay', 'cod'] },
  paymentResult: {
    id: { type: String },
    status: { type: String },
    update_time: { type: String },
    email_address: { type: String },
  },
  itemsPrice: { type: Number, required: true, default: 0 },
  shippingPrice: { type: Number, default: 0 },
  couponCode: { type: String, default: '' },
  couponDiscount: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true, default: 0 },
  isPaid: { type: Boolean, required: true, default: false },
  paidAt: { type: Date },
  isDelivered: { type: Boolean, required: true, default: false },
  deliveredAt: { type: Date },
  stockAdjusted: { type: Boolean, default: false },
  deliveryInfo: {
    courierName: { type: String },
    trackingId: { type: String },
    awbNumber: { type: String },
    trackingUrl: { type: String },
    estimatedDeliveryDate: { type: Date },
  },
  orderStatus: {
    type: String,
    required: true,
    enum: ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded'],
    default: 'Pending',
  },
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String },
    updatedBy: { type: String, enum: ['system', 'admin', 'customer'], default: 'system' },
  }],
  invoiceNumber: { type: String },
  refundStatus: {
    type: String,
    enum: ['None', 'Pending', 'Processed'],
    default: 'None',
  },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
export default Order;
