import Order from '../models/orderModel.js';
import Activity from '../models/activityModel.js';
import Product from '../models/productModel.js';
import { razorpayInstance } from '../config/razorpay.js';
import crypto from 'crypto';
import {
  buildOrderLineFromProduct,
  calcShipping,
  validateAndApplyCoupon,
  incrementCouponUsage,
} from '../utils/pricing.js';
import { deductOrderStock, restoreOrderStock } from '../utils/inventory.js';
import {
  canTransitionStatus,
  buildTrackingTimeline,
} from '../utils/orderWorkflow.js';
import { authorizeOrderAccess, getOrderUserId } from '../utils/orderAuth.js';

const emitOrderUpdate = (req, order) => {
  const io = req.app.get('io');
  if (!io) return;
  io.emit('order_status_update', {
    orderId: order._id,
    userId: getOrderUserId(order),
    orderStatus: order.orderStatus,
    statusHistory: order.statusHistory,
    deliveryInfo: order.deliveryInfo,
    isPaid: order.isPaid,
    isDelivered: order.isDelivered,
    timeline: buildTrackingTimeline(order),
  });
};

const pushStatusHistory = (order, status, note, updatedBy = 'system') => {
  order.statusHistory.push({
    status,
    timestamp: new Date(),
    note,
    updatedBy,
  });
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const addOrderItems = async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod, couponCode } = req.body;

    if (!orderItems?.length) {
      return res.status(400).json({ message: 'No order items provided' });
    }

    if (!shippingAddress?.name || !shippingAddress?.phone || !shippingAddress?.pincode) {
      return res.status(400).json({ message: 'Complete shipping address is required' });
    }

    const validatedItems = [];
    let itemsPrice = 0;
    const productIds = [];
    const categories = [];

    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.name || item.product}` });
      }

      const qty = Math.max(1, Number(item.qty) || 1);
      const line = buildOrderLineFromProduct(product, item, qty);
      itemsPrice += line.price * qty;
      validatedItems.push(line);
      productIds.push(product._id);
      categories.push(product.category);
    }

    const shippingPrice = calcShipping(itemsPrice);
    const couponResult = await validateAndApplyCoupon({
      code: couponCode,
      userId: req.user._id,
      itemsSubtotal: itemsPrice,
      productIds,
      categories,
    });

    const totalPrice = Math.max(0, itemsPrice + shippingPrice - couponResult.discountAmount);
    const isCod = paymentMethod === 'cod';
    const initialStatus = isCod ? 'Confirmed' : 'Pending';

    const order = new Order({
      orderItems: validatedItems,
      user: req.user._id,
      shippingAddress,
      paymentMethod: isCod ? 'cod' : 'razorpay',
      itemsPrice,
      shippingPrice,
      couponCode: couponResult.couponCode,
      couponDiscount: couponResult.discountAmount,
      totalPrice,
      orderStatus: initialStatus,
      isPaid: false,
      stockAdjusted: false,
      statusHistory: [{
        status: initialStatus,
        note: isCod ? 'Order confirmed (COD)' : 'Order placed, awaiting payment',
        updatedBy: 'system',
      }],
    });

    const createdOrder = await order.save();
    if (!createdOrder.invoiceNumber) {
      createdOrder.invoiceNumber = `HK-${createdOrder._id.toString().slice(-8).toUpperCase()}`;
      await createdOrder.save();
    }

    if (isCod) {
      await deductOrderStock(validatedItems);
      createdOrder.stockAdjusted = true;
      createdOrder.isPaid = false;
      await createdOrder.save();
      if (couponResult.coupon) await incrementCouponUsage(couponResult.coupon);
    }

    const activity = await Activity.create({
      type: 'ORDER_PLACED',
      description: `Order #${createdOrder._id.toString().substring(0, 8)} placed for ₹${totalPrice.toLocaleString('en-IN')}`,
      user: req.user._id,
      metadata: { orderId: createdOrder._id, totalPrice },
    });

    const io = req.app.get('io');
    if (io) io.emit('admin_activity', activity);

    emitOrderUpdate(req, createdOrder);
    res.status(201).json(createdOrder);
  } catch (error) {
    console.error('Order creation error:', error.message);
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const { allowed } = authorizeOrderAccess(order, req);
    if (!allowed) return res.status(403).json({ message: 'Not authorized to view this order' });

    const payload = order.toObject();
    payload.trackingTimeline = buildTrackingTimeline(order);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching order' });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort('-createdAt');
    const payload = orders.map((order) => {
      const obj = order.toObject();
      obj.trackingTimeline = buildTrackingTimeline(order);
      return obj;
    });
    res.json(payload);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status && status !== 'All') query.orderStatus = status;

    let orders = await Order.find(query).populate('user', 'id name email').sort('-createdAt');

    if (search) {
      const term = search.toLowerCase();
      orders = orders.filter(
        (o) =>
          o._id.toString().toLowerCase().includes(term) ||
          (o.user?.name || '').toLowerCase().includes(term) ||
          (o.shippingAddress?.phone || '').includes(term)
      );
    }

    res.json(orders);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const body = req.body || {};
    order.isPaid = true;
    order.paidAt = Date.now();
    if (!order.invoiceNumber) {
      order.invoiceNumber = `HK-${order._id.toString().slice(-8).toUpperCase()}`;
    }
    order.paymentResult = {
      id: body.id || 'COD',
      status: body.status || 'Success',
      update_time: body.update_time || new Date().toISOString(),
      email_address: body.email_address || '',
    };

    if (order.paymentMethod === 'cod' && order.orderStatus === 'Pending') {
      order.orderStatus = 'Confirmed';
      pushStatusHistory(order, 'Confirmed', 'COD order confirmed', 'admin');
    }

    const updatedOrder = await order.save();
    emitOrderUpdate(req, updatedOrder);
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Server error updating payment status' });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const body = req.body || {};
    const newStatus = body.status;
    if (!newStatus) return res.status(400).json({ message: 'Status is required' });

    const oldStatus = order.orderStatus;
    if (newStatus !== oldStatus && !canTransitionStatus(oldStatus, newStatus)) {
      return res.status(400).json({
        message: `Cannot change status from ${oldStatus} to ${newStatus}`,
      });
    }

    if (newStatus === 'Shipped' && body.deliveryInfo) {
      const { courierName, trackingId, awbNumber } = body.deliveryInfo;
      const awb = awbNumber || trackingId;
      if (!courierName || !awb) {
        return res.status(400).json({ message: 'Courier name and AWB/tracking number are required for shipped orders' });
      }
    }

    order.orderStatus = newStatus;

    if (newStatus !== oldStatus) {
      pushStatusHistory(
        order,
        newStatus,
        body.note || `Status updated from ${oldStatus} to ${newStatus}`,
        'admin'
      );
    }

    if (body.deliveryInfo) {
      const prev = order.deliveryInfo?.toObject?.() || order.deliveryInfo || {};
      const next = { ...prev, ...body.deliveryInfo };
      if (next.trackingId && !next.awbNumber) next.awbNumber = next.trackingId;
      if (next.awbNumber && !next.trackingId) next.trackingId = next.awbNumber;
      order.deliveryInfo = next;
    }

    if (newStatus === 'Delivered' && !order.isDelivered) {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
      if (!order.isPaid && order.paymentMethod === 'cod') {
        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentResult = {
          id: 'COD_DELIVERED',
          status: 'Success',
          update_time: new Date().toISOString(),
        };
      }
    }

    if (['Cancelled', 'Returned', 'Refunded'].includes(newStatus) && order.stockAdjusted) {
      await restoreOrderStock(order.orderItems);
      order.stockAdjusted = false;
    }

    const updatedOrder = await order.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('admin_activity', {
        type: 'ORDER_STATUS_UPDATE',
        description: `Order #${order._id.toString().substring(0, 8)} updated to ${order.orderStatus}`,
      });
    }

    emitOrderUpdate(req, updatedOrder);
    res.json({ ...updatedOrder.toObject(), trackingTimeline: buildTrackingTimeline(updatedOrder) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error updating order status' });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const { isAdmin, isOwner } = authorizeOrderAccess(order, req);
    if (!isAdmin && !isOwner) {
      return res.status(401).json({ message: 'Not authorized to cancel this order' });
    }

    const cancellable = ['Pending', 'Confirmed', 'Packed'];
    if (!cancellable.includes(order.orderStatus)) {
      return res.status(400).json({
        message: `Order cannot be cancelled at this stage (${order.orderStatus})`,
      });
    }

    const body = req.body || {};
    order.orderStatus = 'Cancelled';
    pushStatusHistory(
      order,
      'Cancelled',
      body.note || (isAdmin ? 'Order cancelled by admin' : 'Order cancelled by customer'),
      isAdmin ? 'admin' : 'customer'
    );

    if (order.stockAdjusted) {
      await restoreOrderStock(order.orderItems);
      order.stockAdjusted = false;
    }
    if (order.isPaid && order.refundStatus === 'None') {
      order.refundStatus = 'Pending';
    }

    const updatedOrder = await order.save();
    emitOrderUpdate(req, updatedOrder);

    const io = req.app.get('io');
    if (io) {
      io.emit('admin_activity', {
        type: 'ORDER_STATUS_UPDATE',
        description: `Order #${order._id.toString().substring(0, 8)} cancelled`,
      });
    }

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const refundOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const body = req.body || {};
    order.orderStatus = 'Refunded';
    pushStatusHistory(order, 'Refunded', body.note || 'Refund processed', 'admin');

    if (order.paymentResult) order.paymentResult.status = 'refunded';

    if (order.stockAdjusted) {
      await restoreOrderStock(order.orderItems);
      order.stockAdjusted = false;
    }

    const updatedOrder = await order.save();
    emitOrderUpdate(req, updatedOrder);

    const io = req.app.get('io');
    if (io) io.emit('admin_activity', { type: 'ORDER_STATUS_UPDATE', description: 'Order refunded' });

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const returnOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (getOrderUserId(order) !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (order.orderStatus !== 'Delivered') {
      return res.status(400).json({ message: 'Only delivered orders can be returned' });
    }

    const body = req.body || {};
    order.orderStatus = 'Returned';
    pushStatusHistory(order, 'Returned', body.reason || 'Return requested by customer', 'customer');

    if (order.stockAdjusted) {
      await restoreOrderStock(order.orderItems);
      order.stockAdjusted = false;
    }

    const updatedOrder = await order.save();
    emitOrderUpdate(req, updatedOrder);
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.stockAdjusted) {
      await restoreOrderStock(order.orderItems);
    }

    await order.deleteOne();
    res.json({ message: 'Order removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateOrderToDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.orderStatus !== 'Delivered') {
      order.orderStatus = 'Delivered';
      pushStatusHistory(order, 'Delivered', 'Order marked as delivered', 'admin');
    }
    order.isDelivered = true;
    order.deliveredAt = Date.now();

    const updatedOrder = await order.save();
    emitOrderUpdate(req, updatedOrder);
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    const options = {
      amount: Math.round(Number(amount) * 100),
      currency: 'INR',
      receipt: `receipt_order_${Date.now()}`,
    };
    const razorpayOrder = await razorpayInstance.orders.create(options);
    res.json(razorpayOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (getOrderUserId(order) !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (!order.stockAdjusted) {
      await deductOrderStock(order.orderItems);
      order.stockAdjusted = true;

      if (order.couponCode) {
        const Coupon = (await import('../models/couponModel.js')).default;
        const coupon = await Coupon.findOne({ code: order.couponCode });
        if (coupon) await incrementCouponUsage(coupon);
      }
    }

    order.isPaid = true;
    order.paidAt = Date.now();
    order.orderStatus = 'Confirmed';
    order.paymentResult = {
      id: razorpay_payment_id,
      status: 'verified',
      update_time: new Date().toISOString(),
    };
    pushStatusHistory(order, 'Confirmed', 'Payment verified, order confirmed', 'system');

    await order.save();
    emitOrderUpdate(req, order);

    res.json({ message: 'Payment verified successfully', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Release stock for unpaid online orders (payment failed/cancelled)
// @route   PUT /api/orders/:id/release
// @access  Private
export const releaseUnpaidOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (getOrderUserId(order) !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (order.isPaid || order.paymentMethod !== 'razorpay') {
      return res.status(400).json({ message: 'Order cannot be released' });
    }

    if (order.orderStatus !== 'Pending') {
      return res.status(400).json({ message: 'Only pending orders can be released' });
    }

    if (order.stockAdjusted) {
      await restoreOrderStock(order.orderItems);
      order.stockAdjusted = false;
    }

    order.orderStatus = 'Cancelled';
    pushStatusHistory(order, 'Cancelled', 'Payment not completed', 'system');
    await order.save();

    emitOrderUpdate(req, order);
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
