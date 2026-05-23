import { getEffectiveStock } from './pricing';

/** Client-side cart line for UI state */
export const buildCartLine = (product, qty, variantKey, variant) => {
  const rawId = product?._id ?? product?.id ?? product?.product;
  const productId = rawId != null ? String(rawId) : '';
  if (!productId) return null;

  const price = variant?.price ?? product?.price ?? 0;
  const mrp = variant?.mrp ?? product?.mrp ?? price;
  const stock = getEffectiveStock(product, variantKey);

  const line = {
    _id: productId,
    id: productId,
    product: productId,
    name: product?.name || 'Product',
    qty: Math.max(1, Math.min(99, Number(qty) || 1)),
    price: Number(price) || 0,
    mrp: Number(mrp) || Number(price) || 0,
    discount: Number(product?.discount) || 0,
    brand: product?.brand ?? '',
    category: product?.category ?? '',
    images: variant?.image
      ? [variant.image, ...(product?.images || []).filter((img) => typeof img === 'string')]
      : (product?.images || []).filter((img) => typeof img === 'string') ||
        (typeof product?.image === 'string' ? [product.image] : []),
    deliveryDays: product?.deliveryDays ?? 3,
    stockCount: stock,
    inStock: stock > 0,
  };

  if (variantKey) {
    line.variantKey = String(variantKey);
    line.variantLabel = variant?.color || variant?.name || undefined;
  }

  return line;
};

/** Minimal payload for PUT /api/auth/cart */
export const toCartSyncPayload = (item, qtyOverride, variantKeyOverride, variantOverride) => {
  const product = item || {};
  const qty = qtyOverride ?? product.qty ?? 1;
  const variantKey = variantKeyOverride ?? product.variantKey ?? null;
  const variant =
    variantOverride ||
    (variantKey && product.variants?.find?.(
      (v) => String(v._id) === String(variantKey) || v.sku === variantKey
    ));

  const line = buildCartLine(product, qty, variantKey, variant);
  if (!line) return null;

  return {
    product: line.product,
    _id: line.product,
    id: line.product,
    name: line.name,
    qty: line.qty,
    price: line.price,
    mrp: line.mrp,
    discount: line.discount,
    brand: line.brand,
    category: line.category,
    images: line.images,
    stockCount: line.stockCount,
    inStock: line.inStock,
    ...(line.variantKey ? { variantKey: line.variantKey } : {}),
    ...(line.variantLabel ? { variantLabel: line.variantLabel } : {}),
  };
};
