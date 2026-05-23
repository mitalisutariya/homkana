import User from '../models/userModel.js';
import mongoose from 'mongoose';
import { normalizeCartLine, formatCartForClient, dedupeCartLines } from '../utils/cartHelpers.js';
import Product from '../models/productModel.js';
import Activity from '../models/activityModel.js';
import generateToken from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js';
import { verifyGoogleCredential } from '../utils/googleAuth.js';
import { formatAuthUser } from '../utils/authResponse.js';
import crypto from 'crypto';

const sendAuthResponse = (res, user, wishlist, status = 200) => {
  const token = generateToken(user._id);
  const payload = formatAuthUser(user, token, wishlist);
  if (status === 201) return res.status(201).json(payload);
  return res.json(payload);
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const authUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate('wishlist');

    if (user && (await user.matchPassword(password))) {
      return sendAuthResponse(res, user, user.wishlist);
    }
    if (user?.googleId) {
      res.status(401);
      throw new Error('This account uses Google Sign-In. Please continue with Google.');
    }
    res.status(401);
    throw new Error('Invalid email or password');
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      // Log activity and emit
      const activity = await Activity.create({
        type: 'USER_REGISTER',
        description: `New user registered: ${user.name} (${user.email})`,
        user: user._id
      });
      const io = req.app.get('io');
      if (io) io.emit('admin_activity', activity);

      return sendAuthResponse(res, user, [], 201);
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Google Login
// @route   POST /api/auth/google
// @access  Public
export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      res.status(400);
      throw new Error('Google credential is required');
    }

    const googleUser = await verifyGoogleCredential(credential);
    let user = await User.findOne({
      $or: [{ email: googleUser.email }, { googleId: googleUser.googleId }],
    }).populate('wishlist');

    if (user) {
      if (user.isBlocked) {
        res.status(403);
        throw new Error('Your account has been blocked');
      }
      if (user.googleId && user.googleId !== googleUser.googleId) {
        res.status(400);
        throw new Error('This email is linked to a different Google account');
      }
      user.googleId = googleUser.googleId;
      user.name = googleUser.name;
      user.email = googleUser.email;
      user.profilePic = googleUser.profilePic;
      user.authProvider = 'google';
      await user.save();
      return sendAuthResponse(res, user, user.wishlist);
    }

    user = await User.create({
      name: googleUser.name,
      email: googleUser.email,
      password: crypto.randomBytes(32).toString('hex'),
      googleId: googleUser.googleId,
      profilePic: googleUser.profilePic,
      authProvider: 'google',
    });

    const activity = await Activity.create({
      type: 'USER_REGISTER',
      description: `New user registered via Google: ${user.name} (${user.email})`,
      user: user._id,
    });
    const io = req.app.get('io');
    if (io) io.emit('admin_activity', activity);

    return sendAuthResponse(res, user, [], 201);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist');

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePic: user.profilePic || '',
        googleId: user.googleId || '',
        authProvider: user.authProvider || 'local',
        addresses: user.addresses,
        cart: formatCartForClient(user.cart),
        wishlist: user.wishlist,
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private/Admin
export const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// @desc    Update cart
// @route   PUT /api/auth/cart
// @access  Private
export const updateCart = async (req, res) => {
  try {
    const incomingCart = Array.isArray(req.body.cart) ? req.body.cart : [];
    const normalized = dedupeCartLines(
      incomingCart.map((item) => normalizeCartLine(item)).filter(Boolean)
    );

    const validLines = [];
    for (const line of normalized) {
      const exists = await Product.exists({ _id: line.product });
      if (exists) validLines.push(line);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { cart: validLines } },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Cart updated', cart: formatCartForClient(user.cart) });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ message: error.message || 'Failed to update cart' });
  }
};

// @desc    Update wishlist
// @route   PUT /api/auth/wishlist
// @access  Private
export const updateWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      const incomingWishlist = Array.isArray(req.body.wishlist) ? req.body.wishlist : [];
      user.wishlist = incomingWishlist
        .map(item => (typeof item === 'string' ? item : item._id || item.id || item.product))
        .filter(Boolean);
      await user.save();
      res.json({ message: 'Wishlist updated', wishlist: user.wishlist });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Update wishlist error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({ message: 'There is no user with that email' });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Create reset url
    const resetUrl = `http://localhost:5173/resetpassword/${resetToken}`;

    const htmlContent = `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #f9f9f9; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #4F3CC9, #7C3AED); color: white; font-size: 24px; font-weight: bold; padding: 12px 20px; border-radius: 12px;">HK</div>
            <h2 style="margin: 16px 0 0; color: #1a1a2e; font-size: 22px;">Password Reset Request</h2>
          </div>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">Hi <strong>${user.name}</strong>,</p>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #4F3CC9, #7C3AED); color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset My Password</a>
          </div>
          <p style="color: #888; font-size: 13px; line-height: 1.6;">This link will expire in <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} HomeKana. All rights reserved.</p>
        </div>
      </div>
    `;

    const plainText = `Hi ${user.name},\n\nYou requested a password reset. Use this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`;

    console.log('--- PASSWORD RESET LINK ---');
    console.log(resetUrl);
    console.log('---------------------------');

    await sendEmail({
      email: user.email,
      subject: 'HomeKana — Reset Your Password',
      message: plainText,
      html: htmlContent,
    });

    return res.status(200).json({ success: true, message: 'Password reset email sent successfully!' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: error.message || 'Something went wrong. Please try again.' });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400);
      throw new Error('Invalid or expired token');
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ message: error.message });
  }
};

// @desc    Add or Update address
// @route   PUT /api/auth/address
// @access  Private
export const addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      const { addressId, ...addressData } = req.body;
      
      if (addressId) {
        // Update existing
        const addrIndex = user.addresses.findIndex(a => a._id.toString() === addressId);
        if (addrIndex !== -1) {
          user.addresses[addrIndex] = { ...user.addresses[addrIndex], ...addressData };
        }
      } else {
        // Add new
        const isFirst = user.addresses.length === 0;
        user.addresses.push({ ...addressData, isDefault: isFirst });
      }

      await user.save();
      res.json({ message: 'Address updated successfully', addresses: user.addresses });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete address
// @route   DELETE /api/auth/address/:id
// @access  Private
export const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.addresses = user.addresses.filter(a => a._id.toString() !== req.params.id);
      
      // If deleted was default, make another one default
      if (user.addresses.length > 0 && !user.addresses.some(a => a.isDefault)) {
        user.addresses[0].isDefault = true;
      }

      await user.save();
      res.json({ message: 'Address deleted successfully', addresses: user.addresses });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Set default address
// @route   PUT /api/auth/address/:id/default
// @access  Private
export const setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.addresses.forEach(a => {
        a.isDefault = a._id.toString() === req.params.id;
      });

      await user.save();
      res.json({ message: 'Default address updated', addresses: user.addresses });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.name = req.body.name || user.name;
      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profilePic: updatedUser.profilePic || '',
        googleId: updatedUser.googleId || '',
        authProvider: updatedUser.authProvider || 'local',
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

