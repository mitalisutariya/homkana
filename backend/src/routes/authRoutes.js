import express from 'express';
import { authUser, registerUser, googleLogin, getUserProfile, getUsers, updateCart, updateWishlist, forgotPassword, resetPassword, addAddress, deleteAddress, setDefaultAddress, updateProfile } from '../controllers/authController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authUser);
router.post('/google', googleLogin);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.route('/me').get(protect, getUserProfile);
router.route('/users').get(protect, admin, getUsers);
router.route('/cart').put(protect, updateCart);
router.route('/wishlist').put(protect, updateWishlist);
router.route('/profile').put(protect, updateProfile);
router.route('/address').put(protect, addAddress);
router.route('/address/:id').delete(protect, deleteAddress);
router.route('/address/:id/default').put(protect, setDefaultAddress);

export default router;
