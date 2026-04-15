const express = require('express');
const { body } = require('express-validator');
const {
  getProfile,
  sendProfileUpdateOtp,
  updateProfile,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const { otpRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/profile', protect, getProfile);
router.post('/profile/send-otp', protect, otpRateLimiter, sendProfileUpdateOtp);
router.put(
  '/profile',
  protect,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 60 })
      .withMessage('Name must be between 2 and 60 characters'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('phone')
      .optional({ nullable: true })
      .custom((value) => {
        const normalized = String(value || '').trim();
        if (!normalized) {
          return true;
        }

        return /^\+?[0-9]{7,15}$/.test(normalized);
      })
      .withMessage('Valid phone number is required'),
    body('otp')
      .optional()
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be 6 digits')
      .isNumeric()
      .withMessage('OTP must contain numbers only'),
    body().custom((_, { req }) => {
      const hasUpdatableField =
        req.body?.name !== undefined ||
        req.body?.email !== undefined ||
        req.body?.phone !== undefined;

      if (!hasUpdatableField) {
        throw new Error('At least one profile field is required');
      }

      return true;
    }),
  ],
  validateRequest,
  updateProfile
);

module.exports = router;
