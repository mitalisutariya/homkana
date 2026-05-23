import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/razorpay', protect, (req, res) => {
  res.send(process.env.RAZORPAY_KEY_ID);
});

export default router;
