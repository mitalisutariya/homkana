import express from 'express';
import { getActivities } from '../controllers/activityController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/').get(protect, admin, getActivities);

export default router;
