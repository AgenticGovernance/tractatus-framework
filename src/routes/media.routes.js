/**
 * Media Inquiry Routes
 * Press/media inquiry submission and triage endpoints
 */

const express = require('express');
const router = express.Router();

const mediaController = require('../controllers/media.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { validateRequired, validateEmail, validateObjectId } = require('../middleware/validation.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * Public routes
 */

// POST /api/media/inquiries - Submit media inquiry (public)
router.post('/inquiries',
  validateRequired(['contact.name', 'contact.email', 'contact.outlet', 'inquiry.subject', 'inquiry.message']),
  validateEmail('contact.email'),
  asyncHandler(mediaController.submitInquiry)
);

// GET /api/media/triage-stats - Get triage statistics (public, transparency)
router.get('/triage-stats',
  asyncHandler(mediaController.getTriageStats)
);

/**
 * Admin routes
 */

// GET /api/media/inquiries - List all inquiries (admin)
router.get('/inquiries',
  authenticateToken,
  requireRole('admin', 'moderator'),
  asyncHandler(mediaController.listInquiries)
);

// GET /api/media/inquiries/urgent - List high urgency inquiries (admin)
router.get('/inquiries/urgent',
  authenticateToken,
  requireRole('admin', 'moderator'),
  asyncHandler(mediaController.listUrgentInquiries)
);

// GET /api/media/inquiries/:id - Get inquiry by ID (admin)
router.get('/inquiries/:id',
  authenticateToken,
  requireRole('admin', 'moderator'),
  validateObjectId('id'),
  asyncHandler(mediaController.getInquiry)
);

// POST /api/media/inquiries/:id/assign - Assign inquiry to user (admin)
router.post('/inquiries/:id/assign',
  authenticateToken,
  requireRole('admin'),
  validateObjectId('id'),
  asyncHandler(mediaController.assignInquiry)
);

// POST /api/media/inquiries/:id/triage - Run AI triage (admin)
router.post('/inquiries/:id/triage',
  authenticateToken,
  requireRole('admin', 'moderator'),
  validateObjectId('id'),
  asyncHandler(mediaController.triageInquiry)
);

// POST /api/media/inquiries/:id/respond - Mark as responded (admin)
router.post('/inquiries/:id/respond',
  authenticateToken,
  requireRole('admin', 'moderator'),
  validateObjectId('id'),
  validateRequired(['content']),
  asyncHandler(mediaController.respondToInquiry)
);

// DELETE /api/media/inquiries/:id - Delete inquiry (admin)
router.delete('/inquiries/:id',
  authenticateToken,
  requireRole('admin'),
  validateObjectId('id'),
  asyncHandler(mediaController.deleteInquiry)
);

module.exports = router;
