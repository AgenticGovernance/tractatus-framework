/**
 * Admin Routes
 * Moderation queue and system management
 */

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { validateRequired, validateObjectId } = require('../middleware/validation.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * All admin routes require authentication
 */
router.use(authenticateToken);

/**
 * Moderation Queue
 */

// GET /api/admin/moderation - List moderation queue items
router.get('/moderation',
  requireRole('admin', 'moderator'),
  asyncHandler(adminController.getModerationQueue)
);

// GET /api/admin/moderation/:id - Get single moderation item
router.get('/moderation/:id',
  requireRole('admin', 'moderator'),
  validateObjectId('id'),
  asyncHandler(adminController.getModerationItem)
);

// POST /api/admin/moderation/:id/review - Review item (approve/reject/escalate)
router.post('/moderation/:id/review',
  requireRole('admin', 'moderator'),
  validateObjectId('id'),
  validateRequired(['action']),
  asyncHandler(adminController.reviewModerationItem)
);

/**
 * System Statistics
 */

// GET /api/admin/stats - Get system statistics
router.get('/stats',
  requireRole('admin', 'moderator'),
  asyncHandler(adminController.getSystemStats)
);

/**
 * Activity Log
 */

// GET /api/admin/activity - Get recent activity log
router.get('/activity',
  requireRole('admin'),
  asyncHandler(adminController.getActivityLog)
);

module.exports = router;
