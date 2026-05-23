/** Resolve order owner id whether user is populated or an ObjectId */
export const getOrderUserId = (order) => {
  const user = order?.user;
  if (!user) return null;
  if (typeof user === 'string') return user;
  if (user._id) return user._id.toString();
  return user.toString();
};

export const authorizeOrderAccess = (order, req) => {
  const isAdmin = req.user?.role === 'admin';
  const ownerId = getOrderUserId(order);
  const isOwner = ownerId && req.user?._id && ownerId === req.user._id.toString();
  return { isAdmin, isOwner, allowed: isAdmin || isOwner };
};
