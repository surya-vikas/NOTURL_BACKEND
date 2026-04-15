const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { getRoleForEmail } = require('../utils/adminRole');

const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new ApiError('Unauthorized', 401);
  }

  const roleByEmail = getRoleForEmail(req.user.email);
  const isAdmin = req.user.role === 'admin' || roleByEmail === 'admin';

  if (!isAdmin) {
    throw new ApiError('Admin access required', 403);
  }

  if (req.user.role !== roleByEmail) {
    req.user.role = roleByEmail;
    await req.user.save();
  }

  next();
});

module.exports = {
  requireAdmin,
};
