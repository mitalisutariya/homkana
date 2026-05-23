export const SHIPPING_FEE = 49;
export const FREE_SHIPPING_THRESHOLD = 499;

export const calcShipping = (itemsSubtotal) =>
  itemsSubtotal > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

export const getCartLineKey = (productId, variantKey) =>
  `${productId}${variantKey ? `::${variantKey}` : ''}`;

export const findVariant = (product, variantKey) => {
  if (!product?.variants?.length || !variantKey) return null;
  return product.variants.find(
    (v) => String(v._id) === String(variantKey) || v.sku === variantKey
  );
};

export const getEffectiveStock = (product, variantKey) => {
  if (!product) return 0;

  const variant = findVariant(product, variantKey);
  if (variant) {
    return Number(variant.stockCount ?? variant.stock ?? 0);
  }

  if (product.variants?.length) {
    return Number(
      product.stockCount ??
        product.variants.reduce((sum, v) => sum + Number(v.stockCount ?? v.stock ?? 0), 0)
    );
  }

  if (product.availableStock != null) return Number(product.availableStock);

  return Number(product.stockCount ?? 0);
};

export const isInStock = (product, variantKey) => {
  if (product?.inStock === false && !product?.variants?.length) return false;
  return getEffectiveStock(product, variantKey) > 0;
};

export const getVariantPrice = (product, variantKey) => {
  const variant = findVariant(product, variantKey);
  if (variant?.price != null) return variant.price;
  return product?.price ?? 0;
};

export const getVariantMrp = (product, variantKey) => {
  const variant = findVariant(product, variantKey);
  if (variant?.mrp != null) return variant.mrp;
  return product?.mrp ?? product?.price ?? 0;
};
