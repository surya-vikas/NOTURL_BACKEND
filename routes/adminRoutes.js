const express = require('express');
const { getAdminUsersLinks, updateUserSuspension } = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.get('/users-links', protect, requireAdmin, getAdminUsersLinks);
router.patch('/users/:id/suspension', protect, requireAdmin, updateUserSuspension);

module.exports = router;
