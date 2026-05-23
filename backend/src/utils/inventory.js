import Product from '../models/productModel.js';

const syncProductStockFlags = (product) => {
  const variantStock = (product.variants || []).reduce((sum, v) => sum + (v.stockCount || 0), 0);
  const totalVariantStock = product.variants?.length ? variantStock : product.stockCount;
  product.stockCount = product.variants?.length ? totalVariantStock : product.stockCount;
  product.inStock = totalVariantStock > 0;
  return product;
};

export const getVariantByKey = (product, variantKey) => {
  if (!variantKey || !product.variants?.length) return null;
  return product.variants.find(
    (v) => v._id?.toString() === variantKey || v.sku === variantKey
  );
};

export const getAvailableStock = (product, variantKey) => {
  const variant = getVariantByKey(product, variantKey);
  if (variant) return variant.stockCount || 0;
  return product.stockCount || 0;
};

export const getSellPrice = (product, variantKey) => {
  const variant = getVariantByKey(product, variantKey);
  if (variant?.price != null) return variant.price;
  return product.price;
};

export const getSellMrp = (product, variantKey) => {
  const variant = getVariantByKey(product, variantKey);
  if (variant?.mrp != null) return variant.mrp;
  return product.mrp;
};

export const validateLineStock = (product, variantKey, qty) => {
  const available = getAvailableStock(product, variantKey);
  if (available < qty) {
    const label = getVariantByKey(product, variantKey)?.color || product.name;
    const err = new Error(`Insufficient stock for ${label}. Available: ${available}`);
    err.statusCode = 400;
    throw err;
  }
};

export const adjustStock = async (productId, variantKey, qty, direction = 'decrease') => {
  const product = await Product.findById(productId);
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  const delta = direction === 'decrease' ? -Math.abs(qty) : Math.abs(qty);
  const variant = getVariantByKey(product, variantKey);

  if (variant) {
    variant.stockCount = Math.max(0, (variant.stockCount || 0) + delta);
  } else {
    product.stockCount = Math.max(0, (product.stockCount || 0) + delta);
  }

  syncProductStockFlags(product);
  await product.save();

  return {
    productId: product._id,
    stockCount: product.stockCount,
    inStock: product.inStock,
    variantKey: variant?._id?.toString() || null,
    variantStock: variant?.stockCount ?? null,
  };
};

export const restoreOrderStock = async (orderItems) => {
  const updates = [];
  for (const item of orderItems) {
    if (!item.product) continue;
    const update = await adjustStock(item.product, item.variantKey, item.qty, 'increase');
    updates.push(update);
  }
  return updates;
};

export const deductOrderStock = async (orderItems) => {
  const updates = [];
  for (const item of orderItems) {
    const product = await Product.findById(item.product);
    if (!product) continue;
    validateLineStock(product, item.variantKey, item.qty);
    const update = await adjustStock(item.product, item.variantKey, item.qty, 'decrease');
    updates.push(update);
  }
  return updates;
};
