const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError('Authorization token missing', 401);
  }

  const token = authHeader.split(' ')[1];

  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new ApiError('Invalid or expired token', 401);
  }

  const user = await User.findById(decodedToken.id);
  if (!user) {
    throw new ApiError('User not found for this token', 401);
  }

  if (user.isSuspended) {
    throw new ApiError('User suspended', 403);
  }

  req.user = user;
  next();
});

module.exports = {
  protect,
};
