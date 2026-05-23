import Coupon from '../models/couponModel.js';
import { validateAndApplyCoupon } from '../utils/pricing.js';

export const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort('-createdAt');
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const body = req.body || {};
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });

    const exists = await Coupon.findOne({ code });
    if (exists) return res.status(400).json({ message: 'Coupon code already exists' });

    const coupon = await Coupon.create({
      code,
      description: body.description || '',
      type: body.type,
      value: Number(body.value) || 0,
      minOrderAmount: Number(body.minOrderAmount) || 0,
      maxDiscount: Number(body.maxDiscount) || 0,
      isActive: body.isActive !== false,
      expiresAt: body.expiresAt || undefined,
      usageLimit: Number(body.usageLimit) || 0,
      applicableCategories: body.applicableCategories || [],
      applicableProducts: body.applicableProducts || [],
    });

    res.status(201).json(coupon);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    const body = req.body || {};
    if (body.code) coupon.code = String(body.code).trim().toUpperCase();
    if (body.description !== undefined) coupon.description = body.description;
    if (body.type) coupon.type = body.type;
    if (body.value !== undefined) coupon.value = Number(body.value);
    if (body.minOrderAmount !== undefined) coupon.minOrderAmount = Number(body.minOrderAmount);
    if (body.maxDiscount !== undefined) coupon.maxDiscount = Number(body.maxDiscount);
    if (body.isActive !== undefined) coupon.isActive = body.isActive;
    if (body.expiresAt !== undefined) coupon.expiresAt = body.expiresAt || null;
    if (body.usageLimit !== undefined) coupon.usageLimit = Number(body.usageLimit);
    if (body.applicableCategories) coupon.applicableCategories = body.applicableCategories;
    if (body.applicableProducts) coupon.applicableProducts = body.applicableProducts;

    await coupon.save();
    res.json(coupon);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    await coupon.deleteOne();
    res.json({ message: 'Coupon removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const validateCoupon = async (req, res) => {
  try {
    const { code, itemsSubtotal, productIds = [], categories = [] } = req.body || {};
    const result = await validateAndApplyCoupon({
      code,
      userId: req.user._id,
      itemsSubtotal: Number(itemsSubtotal) || 0,
      productIds,
      categories,
    });

    res.json({
      valid: true,
      code: result.couponCode,
      discountAmount: result.discountAmount,
      type: result.coupon.type,
      value: result.coupon.value,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message, valid: false });
  }
};
