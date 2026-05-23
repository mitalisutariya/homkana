import mongoose from 'mongoose';

export const toObjectIdString = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    return mongoose.Types.ObjectId.isValid(value) ? value : null;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'object' && value._id != null && value._id !== value) {
    return toObjectIdString(value._id);
  }

  if (typeof value.toString === 'function') {
    const str = value.toString();
    if (mongoose.Types.ObjectId.isValid(str) && String(str).length === 24) {
      return str;
    }
  }

  return null;
};

const cleanImages = (item) => {
  const fromArray = Array.isArray(item.images)
    ? item.images.filter((img) => typeof img === 'string' && img.trim())
    : [];
  if (fromArray.length) return fromArray.slice(0, 10);
  if (typeof item.image === 'string' && item.image.trim()) return [item.image.trim()];
  return [];
};

export const normalizeCartLine = (item = {}) => {
  const productId = toObjectIdString(item.product ?? item._id ?? item.id);
  if (!productId) return null;

  const qty = Math.max(1, Math.min(99, Number(item.qty) || 1));
  const price = Number(item.price);
  const mrp = Number(item.mrp);

  const line = {
    product: new mongoose.Types.ObjectId(productId),
    qty,
    name: String(item.name || 'Product').slice(0, 200),
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    images: cleanImages(item),
    brand: String(item.brand || '').slice(0, 100),
    category: String(item.category || '').slice(0, 100),
    mrp: Number.isFinite(mrp) && mrp >= 0 ? mrp : (Number.isFinite(price) && price >= 0 ? price : 0),
    discount: Math.max(0, Math.min(100, Number(item.discount) || 0)),
    stockCount: Math.max(0, Number(item.stockCount) || 0),
    inStock: item.inStock !== false,
  };

  const variantKey = item.variantKey != null && String(item.variantKey).trim()
    ? String(item.variantKey).trim().slice(0, 80)
    : null;
  if (variantKey) line.variantKey = variantKey;

  const variantLabel = item.variantLabel != null && String(item.variantLabel).trim()
    ? String(item.variantLabel).trim().slice(0, 80)
    : null;
  if (variantLabel) line.variantLabel = variantLabel;

  return line;
};

export const dedupeCartLines = (lines = []) => {
  const map = new Map();
  for (const line of lines) {
    if (!line?.product) continue;
    const key = `${line.product.toString()}::${line.variantKey || ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty = Math.min(99, existing.qty + line.qty);
    } else {
      map.set(key, { ...line });
    }
  }
  return Array.from(map.values());
};

export const formatCartForClient = (cart = []) =>
  cart
    .map((item) => {
      const productId = toObjectIdString(item.product);
      if (!productId) return null;
      const obj = item.toObject ? item.toObject() : { ...item };
      return {
        name: obj.name,
        qty: obj.qty,
        price: obj.price,
        mrp: obj.mrp,
        discount: obj.discount,
        images: obj.images || [],
        brand: obj.brand,
        category: obj.category,
        stockCount: obj.stockCount,
        inStock: obj.inStock,
        variantKey: obj.variantKey,
        variantLabel: obj.variantLabel,
        _id: productId,
        id: productId,
        product: productId,
      };
    })
    .filter(Boolean);
