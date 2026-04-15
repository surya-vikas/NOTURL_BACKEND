const User = require('../models/User');
const OTP = require('../models/OTP');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/response');
const { serializeUser } = require('../utils/serializers');
const { sendOtpEmail } = require('../utils/emailService');
const { generateOtpCode, hashOtp, verifyOtpHash } = require('../utils/otp');
const { normalizeEmail, syncUserRoleByEmail } = require('../utils/adminRole');

const OTP_PURPOSES = {
  PROFILE_UPDATE: 'profile_update',
};

const normalizeOptionalField = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || '';
};

const getProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    statusCode: 200,
    message: 'Profile fetched successfully.',
    user: serializeUser(req.user),
  });
});

const sendProfileUpdateOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.user.email);
  console.log('OTP request received:', email);
  if (!email) {
    throw new ApiError('Email is required to verify profile updates', 400);
  }

  const otpCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OTP.findOneAndUpdate(
    { email, purpose: OTP_PURPOSES.PROFILE_UPDATE },
    {
      email,
      purpose: OTP_PURPOSES.PROFILE_UPDATE,
      otp: hashOtp(otpCode),
      expiresAt,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  await sendOtpEmail(email, otpCode, OTP_PURPOSES.PROFILE_UPDATE);

  sendSuccess(res, {
    statusCode: 200,
    message: 'OTP sent successfully. It expires in 5 minutes.',
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const currentEmail = normalizeEmail(user.email);
  const currentPhone = String(user.phone || '').trim();
  const currentName = String(user.name || '').trim();

  const nextName = normalizeOptionalField(req.body.name);
  const nextEmail = normalizeOptionalField(req.body.email);
  const nextPhone = normalizeOptionalField(req.body.phone);
  const otpCode = normalizeOptionalField(req.body.otp);

  const targetName = nextName === undefined ? currentName : nextName;
  const targetEmail = nextEmail === undefined ? currentEmail : normalizeEmail(nextEmail);
  const targetPhone = nextPhone === undefined ? currentPhone : nextPhone;

  const emailChanged = targetEmail !== currentEmail;
  const phoneChanged = targetPhone !== currentPhone;

  if (emailChanged || phoneChanged) {
    if (!otpCode || otpCode.length !== 6) {
      throw new ApiError('OTP is required to update email or phone number', 400);
    }

    const otpRecord = await OTP.findOne({
      email: currentEmail,
      purpose: OTP_PURPOSES.PROFILE_UPDATE,
    });

    if (!otpRecord) {
      throw new ApiError('Invalid OTP or OTP not requested', 400);
    }

    if (otpRecord.expiresAt.getTime() < Date.now()) {
      await otpRecord.deleteOne();
      throw new ApiError('OTP has expired. Please request a new one.', 400);
    }

    const isOtpValid = verifyOtpHash(otpCode, otpRecord.otp);
    if (!isOtpValid) {
      throw new ApiError('Invalid OTP', 400);
    }

    await otpRecord.deleteOne();
  }

  if (emailChanged) {
    const existingUser = await User.findOne({
      email: targetEmail,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      throw new ApiError('This email is already in use.', 409);
    }
  }

  user.name = targetName || null;
  user.email = targetEmail;
  user.phone = targetPhone || null;
  syncUserRoleByEmail(user, targetEmail);
  await user.save();

  sendSuccess(res, {
    statusCode: 200,
    message: 'Profile updated successfully.',
    user: serializeUser(user),
  });
});

module.exports = {
  getProfile,
  sendProfileUpdateOtp,
  updateProfile,
};
