import express from 'express';
import {
  getProductReviews,
  canUserReview,
  createOrUpdateReview,
  getUserReviewForProduct,
  getMyReviews,
  updateReview,
  deleteReview,
  getAllReviewsAdmin
} from '../controllers/reviewController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/product/:productId', getProductReviews);
router.get('/can-review/:productId', protect, canUserReview);
router.get('/user/my-reviews', protect, getMyReviews);
router.get('/user/product/:productId', protect, getUserReviewForProduct);

// Private routes (create/update/delete)
router.post('/product/:productId', protect, createOrUpdateReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

// Admin routes
router.get('/admin/all', protect, admin, getAllReviewsAdmin);

export default router;
