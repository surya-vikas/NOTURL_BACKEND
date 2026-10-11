const express = require('express');
const { body, param } = require('express-validator');
const {
  createShortUrl,
  getUserUrls,
  deleteUrl,
  updateUrl,
  updateUrlStatus,
} = require('../controllers/urlController');
const { protect } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.use(protect);

router.post(
  '/',
  [
    body('originalUrl').notEmpty().withMessage('Original URL is required'),
    body('customAlias')
      .trim()
      .optional({ checkFalsy: true })
      .isLength({ min: 6, max: 32 })
      .withMessage('Custom alias must be at least 6 characters and no more than 32')
      .matches(/^[A-Za-z0-9_-]+$/)
      .withMessage('Custom alias can only include letters, numbers, "-" and "_"'),
  ],
  validateRequest,
  createShortUrl
);

router.get('/', getUserUrls);

router.patch(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid URL id'),
    body('originalUrl').notEmpty().withMessage('Original URL is required'),
  ],
  validateRequest,
  updateUrl
);

router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid URL id')],
  validateRequest,
  deleteUrl
);

router.patch(
  '/:id/status',
  [
    param('id').isMongoId().withMessage('Invalid URL id'),
    body('isActive').isBoolean().withMessage('isActive must be true or false'),
  ],
  validateRequest,
  updateUrlStatus
);

module.exports = router;
