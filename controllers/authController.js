const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const OTP = require('../models/OTP');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const generateToken = require('../utils/generateToken');
const { sendOtpEmail } = require('../utils/emailService');
const { generateOtpCode, hashOtp, verifyOtpHash } = require('../utils/otp');
const { sendSuccess } = require('../utils/response');
const { serializeUser } = require('../utils/serializers');
const { getRoleForEmail, normalizeEmail, syncUserRoleByEmail } = require('../utils/adminRole');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const OTP_PURPOSES = {
  SIGNUP: 'signup',
};

const sendOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  console.log('OTP request received:', email);
  const existingUser = await User.findOne({ email }).select('+password');

  if (existingUser && existingUser.googleId) {
    throw new ApiError(
      'Account already exists with Google login. Please continue with Google.',
      409
    );
  }

  if (existingUser?.isSuspended) {
    throw new ApiError('User suspended', 403);
  }

  if (existingUser && existingUser.password) {
    throw new ApiError('This email is already registered. Please log in.', 409);
  }

  const otpCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OTP.findOneAndUpdate(
    { email, purpose: OTP_PURPOSES.SIGNUP },
    {
      email,
      purpose: OTP_PURPOSES.SIGNUP,
      otp: hashOtp(otpCode),
      expiresAt,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  await sendOtpEmail(email, otpCode);

  sendSuccess(res, {
    statusCode: 200,
    message: 'OTP sent successfully. It expires in 5 minutes.',
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otpCode = req.body.otp.trim();

  const otpRecord = await OTP.findOne({
    email,
    purpose: OTP_PURPOSES.SIGNUP,
  });
  if (!otpRecord) {
    throw new ApiError('Invalid OTP or OTP not requested', 400);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser?.isSuspended) {
    await otpRecord.deleteOne();
    throw new ApiError('User suspended', 403);
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    await otpRecord.deleteOne();
    throw new ApiError('OTP has expired. Please request a new one.', 400);
  }

  const isOtpValid = verifyOtpHash(otpCode, otpRecord.otp);
  if (!isOtpValid) {
    throw new ApiError('Invalid OTP', 400);
  }

  await User.findOneAndUpdate(
    { email },
    {
      email,
      isVerified: true,
      role: getRoleForEmail(email),
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  await otpRecord.deleteOne();

  sendSuccess(res, {
    statusCode: 200,
    message: 'Email verified successfully. You can now sign up.',
  });
});

const signup = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { name, phone, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (user && user.googleId) {
    throw new ApiError(
      'Account already exists with Google login. Please continue with Google.',
      409
    );
  }

  if (!user || !user.isVerified) {
    throw new ApiError('Please verify your email with OTP before signing up.', 403);
  }

  if (user.isSuspended) {
    throw new ApiError('User suspended', 403);
  }

  if (user.password) {
    throw new ApiError('Account already exists. Please log in.', 409);
  }

  user.name = String(name || '').trim();
  user.phone = String(phone || '').trim();
  user.password = await bcrypt.hash(password, 12);
  syncUserRoleByEmail(user, email);
  await user.save();

  const safeUser = await User.findById(user._id);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Signup successful.',
    token: generateToken(safeUser._id),
    user: serializeUser(safeUser),
  });
});

const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (!user || !user.password) {
    throw new ApiError('Invalid email or password', 401);
  }

  if (user.isSuspended) {
    throw new ApiError('User suspended', 403);
  }

  if (!user.isVerified && !user.googleId) {
    throw new ApiError('Please verify your account before logging in.', 403);
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);
  if (!isPasswordMatched) {
    throw new ApiError('Invalid email or password', 401);
  }

  const nextRole = getRoleForEmail(email);
  if (user.role !== nextRole) {
    user.role = nextRole;
    await user.save();
  }

  const safeUser = await User.findById(user._id);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Login successful.',
    token: generateToken(safeUser._id),
    user: serializeUser(safeUser),
  });
});

const googleLogin = asyncHandler(async (req, res) => {
  const idToken = req.body.idToken || req.body.token;

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    throw new ApiError('Invalid Google ID token', 401);
  }

  if (!payload || !payload.email || !payload.sub) {
    throw new ApiError('Google account data is incomplete', 401);
  }

  if (payload.email_verified === false) {
    throw new ApiError('Google email is not verified', 401);
  }

  const email = normalizeEmail(payload.email);
  const googleId = payload.sub;
  const name = payload.name ? String(payload.name).trim() : null;

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name,
      email,
      googleId,
      isVerified: true,
      role: getRoleForEmail(email),
    });
  } else {
    if (user.isSuspended) {
      throw new ApiError('User suspended', 403);
    }

    if (!user.name && name) {
      user.name = name;
    }
    user.googleId = googleId;
    user.isVerified = true;
    syncUserRoleByEmail(user, email);
    await user.save();
  }

  sendSuccess(res, {
    statusCode: 200,
    message: 'Google login successful.',
    token: generateToken(user._id),
    user: serializeUser(user),
  });
});

module.exports = {
  sendOtp,
  verifyOtp,
  signup,
  login,
  googleLogin,
};
