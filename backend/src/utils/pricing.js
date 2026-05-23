import Coupon from '../models/couponModel.js';
import { getSellMrp, getSellPrice } from './inventory.js';

export const SHIPPING_FEE = 49;
export const FREE_SHIPPING_THRESHOLD = 499;

export const calcShipping = (itemsSubtotal) =>
  itemsSubtotal > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

export const calcProductDiscountPercent = (price, mrp) => {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
};

export const buildOrderLineFromProduct = (product, item, qty) => {
  const variantKey = item.variantKey || null;
  const price = getSellPrice(product, variantKey);
  const mrp = getSellMrp(product, variantKey);
  const variant = variantKey
    ? product.variants?.find((v) => v._id?.toString() === variantKey || v.sku === variantKey)
    : null;

  return {
    name: product.name,
    qty,
    image: variant?.image || product.images?.[0] || '',
    price,
    mrp,
    product: product._id,
    variantKey: variant?._id?.toString() || variantKey || undefined,
    variantLabel: variant?.color || variant?.name || undefined,
    brand: product.brand,
    category: product.category,
  };
};

export const validateAndApplyCoupon = async ({ code, userId, itemsSubtotal, productIds = [], categories = [] }) => {
  if (!code) {
    return { coupon: null, discountAmount: 0, couponCode: '' };
  }

  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase(), isActive: true });
  if (!coupon) {
    const err = new Error('Invalid or expired coupon code');
    err.statusCode = 400;
    throw err;
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    const err = new Error('This coupon has expired');
    err.statusCode = 400;
    throw err;
  }

  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    const err = new Error('Coupon usage limit reached');
    err.statusCode = 400;
    throw err;
  }

  if (coupon.minOrderAmount > 0 && itemsSubtotal < coupon.minOrderAmount) {
    const err = new Error(`Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`);
    err.statusCode = 400;
    throw err;
  }

  if (coupon.applicableProducts?.length) {
    const allowed = coupon.applicableProducts.map((id) => id.toString());
    const hasMatch = productIds.some((id) => allowed.includes(id.toString()));
    if (!hasMatch) {
      const err = new Error('Coupon is not applicable to items in your cart');
      err.statusCode = 400;
      throw err;
    }
  }

  if (coupon.applicableCategories?.length) {
    const allowedCats = coupon.applicableCategories.map((c) => c.toLowerCase());
    const hasMatch = categories.some((c) => allowedCats.includes(String(c).toLowerCase()));
    if (!hasMatch) {
      const err = new Error('Coupon is not applicable to items in your cart');
      err.statusCode = 400;
      throw err;
    }
  }

  let discountAmount = 0;
  if (coupon.type === 'percentage') {
    discountAmount = Math.round((itemsSubtotal * coupon.value) / 100);
    if (coupon.maxDiscount > 0) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscount);
    }
  } else {
    discountAmount = coupon.value;
  }

  discountAmount = Math.min(discountAmount, itemsSubtotal);

  return {
    coupon,
    discountAmount,
    couponCode: coupon.code,
  };
};

export const incrementCouponUsage = async (coupon) => {
  if (!coupon) return;
  coupon.usedCount = (coupon.usedCount || 0) + 1;
  await coupon.save();
};
