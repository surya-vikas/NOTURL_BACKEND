const User = require('../models/User');
const UrlModel = require('../models/URL');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/response');
const { getRoleForEmail } = require('../utils/adminRole');

const getAdminUsersLinks = asyncHandler(async (req, res) => {
  const [users, urls] = await Promise.all([
    User.find({}).sort({ createdAt: -1 }).lean(),
    UrlModel.find({})
      .populate('user', 'name email phone role')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const rows = urls.map((url) => {
    const linkedUser = url.user || null;
    const email = linkedUser?.email || null;

    return {
      id: String(url._id),
      shortId: url.shortId,
      shortUrl: url.shortUrl,
      originalUrl: url.originalUrl,
      clicks: Number(url.clicks || 0),
      isActive: url.isActive !== false,
      createdAt: url.createdAt,
      userId: linkedUser?._id ? String(linkedUser._id) : null,
      name: linkedUser?.name || null,
      email,
      phone: linkedUser?.phone || null,
      role: linkedUser?.role || (email ? getRoleForEmail(email) : 'user'),
    };
  });

  const linksByUserId = rows.reduce((accumulator, row) => {
    if (!row.userId) {
      return accumulator;
    }

    accumulator[row.userId] = (accumulator[row.userId] || 0) + 1;
    return accumulator;
  }, {});

  const serializedUsers = users.map((user) => {
    const userId = String(user._id);
    return {
      id: userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role || getRoleForEmail(user.email),
      isSuspended: Boolean(user.isSuspended),
      createdAt: user.createdAt,
      linkCount: linksByUserId[userId] || 0,
    };
  });

  sendSuccess(res, {
    statusCode: 200,
    message: 'Admin dashboard data fetched successfully.',
    users: serializedUsers,
    rows,
  });
});

const updateUserSuspension = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isSuspended } = req.body;

  if (typeof isSuspended !== 'boolean') {
    throw new ApiError('isSuspended must be true or false', 400);
  }

  if (String(req.user._id) === String(id)) {
    throw new ApiError('You cannot suspend your own account', 400);
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError('User not found', 404);
  }

  const effectiveRole = user.role || getRoleForEmail(user.email);
  if (effectiveRole === 'admin') {
    throw new ApiError('Admin accounts cannot be suspended here', 400);
  }

  user.isSuspended = isSuspended;
  await user.save();

  sendSuccess(res, {
    statusCode: 200,
    message: isSuspended ? 'User suspended successfully.' : 'User unsuspended successfully.',
    user: {
      id: String(user._id),
      isSuspended: Boolean(user.isSuspended),
    },
  });
});

module.exports = {
  getAdminUsersLinks,
  updateUserSuspension,
};
