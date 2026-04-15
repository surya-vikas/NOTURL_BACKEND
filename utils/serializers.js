const serializeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role || 'user',
  isAdmin: user.role === 'admin',
  isSuspended: Boolean(user.isSuspended),
  isVerified: user.isVerified,
  googleId: user.googleId,
  createdAt: user.createdAt,
});

const serializeUrl = (url) => ({
  id: String(url._id),
  originalUrl: url.originalUrl,
  shortId: url.shortId,
  shortUrl: url.shortUrl,
  clicks: url.clicks,
  isActive: url.isActive,
  user: url.user ? String(url.user) : null,
  createdAt: url.createdAt,
});

module.exports = {
  serializeUser,
  serializeUrl,
};
