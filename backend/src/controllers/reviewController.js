import Review from '../models/reviewModel.js';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';

// @desc    Get all reviews for a product
// @route   GET /api/reviews/product/:productId
// @access  Public
const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ product: productId, isActive: true })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Review.countDocuments({ product: productId, isActive: true });

  return res.status(200).json(
    new ApiResponse(200, {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Reviews fetched successfully')
  );
});

// @desc    Check if user can review a product (delivered order exists)
// @route   GET /api/reviews/can-review/:productId
// @access  Private
const canUserReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  // Check if user already reviewed this product
  const existingReview = await Review.findOne({ user: userId, product: productId, isActive: true });
  if (existingReview) {
    return res.status(200).json(
      new ApiResponse(200, {
        canReview: true,
        alreadyReviewed: true,
        review: existingReview
      }, 'User has already reviewed this product')
    );
  }

  // Check if user has a delivered order with this product
  const deliveredOrder = await Order.findOne({
    user: userId,
    orderItems: { $elemMatch: { product: productId } },
    orderStatus: 'Delivered'
  });

  if (!deliveredOrder) {
    return res.status(200).json(
      new ApiResponse(200, {
        canReview: false,
        alreadyReviewed: false,
        reason: 'No delivered order found for this product'
      }, 'Cannot review: order not delivered')
    );
  }

  return res.status(200).json(
    new ApiResponse(200, {
      canReview: true,
      alreadyReviewed: false,
      orderId: deliveredOrder._id
    }, 'User can review this product')
  );
});

// @desc    Create or update review for a product
// @route   POST /api/reviews/product/:productId
// @access  Private
const createOrUpdateReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;
  const { rating, comment, images = [] } = req.body;

  // Validate rating
  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be between 1 and 5');
  }

  // Validate comment
  if (!comment || comment.trim().length === 0) {
    throw new ApiError(400, 'Comment is required');
  }

  // Verify user has a delivered order for this product
  const deliveredOrder = await Order.findOne({
    user: userId,
    orderItems: { $elemMatch: { product: productId } },
    orderStatus: 'Delivered'
  });

  if (!deliveredOrder) {
    throw new ApiError(403, 'You can only review products that have been delivered');
  }

  // Check if user already reviewed this product
  const existingReview = await Review.findOne({ user: userId, product: productId, isActive: true });

  if (existingReview) {
    // Update existing review
    existingReview.rating = rating;
    existingReview.comment = comment;
    existingReview.images = images;
    existingReview.helpful = existingReview.helpful; // preserve helpful count
    await existingReview.save();

    const populatedReview = await Review.findById(existingReview._id)
      .populate('user', 'name');

    return res.status(200).json(
      new ApiResponse(200, { review: populatedReview }, 'Review updated successfully')
    );
  }

  // Create new review
  const review = await Review.create({
    user: userId,
    product: productId,
    order: deliveredOrder._id,
    rating,
    comment: comment.trim(),
    images,
    verifiedPurchase: true
  });

  const populatedReview = await review
    .populate('user', 'name')
    .populate('product', 'name brand images');

  return res.status(201).json(
    new ApiResponse(201, { review: populatedReview }, 'Review added successfully')
  );
});

// @desc    Get user's review for a specific product
// @route   GET /api/reviews/user/product/:productId
// @access  Private
const getUserReviewForProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  const review = await Review.findOne({ user: userId, product: productId, isActive: true })
    .populate('user', 'name')
    .populate('product', 'name brand images');

  if (!review) {
    return res.status(404).json(
      new ApiError(404, 'Review not found')
    );
  }

  return res.status(200).json(
    new ApiResponse(200, { review }, 'User review fetched successfully')
  );
});

// @desc    Get all reviews by current user
// @route   GET /api/reviews/user/my-reviews
// @access  Private
const getMyReviews = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ user: userId, isActive: true })
    .populate('product', 'name brand images price')
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Review.countDocuments({ user: userId, isActive: true });

  return res.status(200).json(
    new ApiResponse(200, {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'User reviews fetched successfully')
  );
});

// @desc    Update review by ID (user can update their own, admin can update any)
// @route   PUT /api/reviews/:id
// @access  Private
const updateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const { rating, comment, images } = req.body;

  const review = await Review.findById(id);

  if (!review || !review.isActive) {
    throw new ApiError(404, 'Review not found');
  }

  // Check ownership (user can only update their own reviews)
  if (review.user.toString() !== userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to update this review');
  }

  // Validate rating if provided
  if (rating !== undefined && (rating < 1 || rating > 5)) {
    throw new ApiError(400, 'Rating must be between 1 and 5');
  }

  // Update fields
  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment.trim();
  if (images !== undefined) review.images = images;

  await review.save();

  const populatedReview = await review
    .populate('user', 'name')
    .populate('product', 'name brand images');

  return res.status(200).json(
    new ApiResponse(200, { review: populatedReview }, 'Review updated successfully')
  );
});

// @desc    Delete review (soft delete - set isActive false)
// @route   DELETE /api/reviews/:id
// @access  Private
const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const review = await Review.findById(id);

  if (!review || !review.isActive) {
    throw new ApiError(404, 'Review not found');
  }

  // Check ownership (user can only delete their own reviews)
  if (review.user.toString() !== userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to delete this review');
  }

  // Soft delete
  review.isActive = false;
  await review.save();

  return res.status(200).json(
    new ApiResponse(200, {}, 'Review deleted successfully')
  );
});

// @desc    Admin: Get all reviews (with filters)
// @route   GET /api/reviews/admin/all
// @access  Admin
const getAllReviewsAdmin = asyncHandler(async (req, res) => {
  const { product, user, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = { isActive: true };
  if (product) filter.product = product;
  if (user) filter.user = user;

  const reviews = await Review.find(filter)
    .populate('user', 'name email')
    .populate('product', 'name brand')
    .populate('order')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Review.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(200, {
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }, 'All reviews fetched successfully')
  );
});

export {
  getProductReviews,
  canUserReview,
  createOrUpdateReview,
  getUserReviewForProduct,
  getMyReviews,
  updateReview,
  deleteReview,
  getAllReviewsAdmin
};
