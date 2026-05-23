import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  sku: { type: String },
  color: { type: String },
  name: { type: String },
  colorHex: { type: String, default: '#cccccc' },
  price: { type: Number },
  mrp: { type: Number },
  stockCount: { type: Number, default: 0 },
  image: { type: String },
  inStock: { type: Boolean, default: true },
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  brand: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  mrp: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  images: [{ type: String }],
  description: { type: String, required: true },
  specs: { type: Map, of: String },
  tags: [{ type: String }],
  inStock: { type: Boolean, default: true },
  stockCount: { type: Number, default: 0 },
  flashSale: { type: Boolean, default: false },
  deliveryDays: { type: Number, default: 3 },
  variants: [variantSchema],
  relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
}, { timestamps: true });

productSchema.pre('save', function syncStock(next) {
  if (this.variants?.length) {
    const total = this.variants.reduce((sum, v) => sum + (v.stockCount || 0), 0);
    this.stockCount = total;
    this.inStock = total > 0;
    this.variants.forEach((v) => {
      v.inStock = (v.stockCount || 0) > 0;
    });
  } else {
    this.inStock = (this.stockCount || 0) > 0;
  }
  if (this.mrp > 0 && this.price >= 0) {
    this.discount = Math.round(((this.mrp - this.price) / this.mrp) * 100);
  }
  next();
});

const Product = mongoose.model('Product', productSchema);
export default Product;
