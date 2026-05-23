import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  product: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
  order: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Order' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, maxlength: 1000 },
  images: [{ type: String }],
  helpful: { type: Number, default: 0 },
  verifiedPurchase: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure one review per user per product (user can only review a product once)
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Auto-update product's average rating and reviewCount when review is saved/updated/removed
reviewSchema.post('save', async function() {
  try {
    const product = await mongoose.model('Product').findById(this.product);
    if (product) {
      const reviews = await this.model('Review').find({ product: this.product, isActive: true });
      const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      product.rating = reviews.length ? Math.round((totalRating / reviews.length) * 10) / 10 : 0;
      product.reviewCount = reviews.length;
      await product.save();
    }
  } catch (err) {
    console.error('Error updating product rating:', err);
  }
});

reviewSchema.post('findOneAndUpdate', async function(result) {
  try {
    if (result) {
      const product = await mongoose.model('Product').findById(result.product);
      if (product) {
        const reviews = await mongoose.model('Review').find({ product: result.product, isActive: true });
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        product.rating = reviews.length ? Math.round((totalRating / reviews.length) * 10) / 10 : 0;
        product.reviewCount = reviews.length;
        await product.save();
      }
    }
  } catch (err) {
    console.error('Error updating product rating:', err);
  }
});

reviewSchema.post('findOneAndDelete', async function(result) {
  try {
    if (result) {
      const product = await mongoose.model('Product').findById(result.product);
      if (product) {
        const reviews = await mongoose.model('Review').find({ product: result.product, isActive: true });
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        product.rating = reviews.length ? Math.round((totalRating / reviews.length) * 10) / 10 : 0;
        product.reviewCount = reviews.length;
        await product.save();
      }
    }
  } catch (err) {
    console.error('Error updating product rating:', err);
  }
});

const Review = mongoose.model('Review', reviewSchema);
export default Review;
