const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
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
const MAX_OTP_ATTEMPTS = 5;

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
      attempts: 0,
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
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();

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
    otpRecord.attempts = Number(otpRecord.attempts || 0) + 1;

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await otpRecord.deleteOne();
      throw new ApiError('Maximum OTP attempts exceeded. Please request a new OTP.', 400);
    }

    await otpRecord.save();
    throw new ApiError(
      `Invalid OTP. ${MAX_OTP_ATTEMPTS - otpRecord.attempts} attempts remaining.`,
      400
    );
  }

  if (!name || name.length < 2 || name.length > 60) {
    throw new ApiError('Name must be between 2 and 60 characters.', 400);
  }

  if (!/^\+?[0-9]{7,15}$/.test(phone)) {
    throw new ApiError('Valid phone number is required.', 400);
  }

  let user = await User.findOne({ email }).select('+password');

  if (user?.googleId) {
    await otpRecord.deleteOne();
    throw new ApiError(
      'Account already exists with Google login. Please continue with Google.',
      409
    );
  }

  if (user?.password) {
    await otpRecord.deleteOne();
    throw new ApiError('This email is already registered. Please log in.', 409);
  }

  if (!user) {
    user = await User.create({
      name,
      email,
      phone,
      isVerified: true,
      role: getRoleForEmail(email),
    });
  } else {
    user.name = name;
    user.phone = phone;
    user.isVerified = true;
    syncUserRoleByEmail(user, email);
    await user.save();
  }

  await otpRecord.deleteOne();

  const safeUser = await User.findById(user._id);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Account created successfully.',
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
  login,
  googleLogin,
};
