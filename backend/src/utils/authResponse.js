import { formatCartForClient } from './cartHelpers.js';

export const formatAuthUser = (user, token, wishlist = []) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  profilePic: user.profilePic || '',
  googleId: user.googleId || '',
  authProvider: user.authProvider || 'local',
  cart: formatCartForClient(user.cart || []),
  wishlist: wishlist || [],
  token,
});
