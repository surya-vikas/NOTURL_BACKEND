const express = require('express');
const { body } = require('express-validator');
const {
  sendOtp,
  verifyOtp,
  login,
  googleLogin,
} = require('../controllers/authController');
const validateRequest = require('../middleware/validateRequest');
const { authRateLimiter, otpRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post(
  '/send-otp',
  otpRateLimiter,
  [body('email').isEmail().withMessage('Valid email is required')],
  validateRequest,
  sendOtp
);

router.post(
  '/verify-otp',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('otp')
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be 6 digits')
      .isNumeric()
      .withMessage('OTP must contain numbers only'),
    body('name')
      .trim()
      .isLength({ min: 2, max: 60 })
      .withMessage('Name must be between 2 and 60 characters'),
    body('phone')
      .trim()
      .matches(/^\+?[0-9]{7,15}$/)
      .withMessage('Valid phone number is required'),
  ],
  validateRequest,
  verifyOtp
);

router.post(
  '/login',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  login
);

router.post(
  '/google-login',
  authRateLimiter,
  [
    body().custom((_, { req }) => {
      if (!req.body?.idToken && !req.body?.token) {
        throw new Error('Google ID token is required');
      }
      return true;
    }),
  ],
  validateRequest,
  googleLogin
);

module.exports = router;
