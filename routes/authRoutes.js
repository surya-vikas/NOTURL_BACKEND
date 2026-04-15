const express = require('express');
const { body } = require('express-validator');
const {
  sendOtp,
  verifyOtp,
  signup,
  login,
  googleLogin,
} = require('../controllers/authController');
const validateRequest = require('../middleware/validateRequest');
const { authRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(authRateLimiter);

router.post(
  '/send-otp',
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
  ],
  validateRequest,
  verifyOtp
);

router.post(
  '/signup',
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 60 })
      .withMessage('Name must be between 2 and 60 characters'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone')
      .trim()
      .matches(/^\+?[0-9]{7,15}$/)
      .withMessage('Valid phone number is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .isLength({ max: 20 })
      .withMessage('Password must be at most 20 characters long')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one capital letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .not()
      .matches(/\s/)
      .withMessage('Password cannot contain spaces'),
    body('acceptedTerms')
      .custom((value) => value === true)
      .withMessage('You must accept terms and conditions'),
  ],
  validateRequest,
  signup
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  login
);

router.post(
  '/google-login',
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
