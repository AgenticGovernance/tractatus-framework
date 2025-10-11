/**
 * Case Study Routes
 * Community case study submission endpoints
 */

const express = require('express');
const router = express.Router();

const casesController = require('../controllers/cases.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { validateRequired, validateEmail, validateObjectId } = require('../middleware/validation.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * Public routes
 */

// POST /api/cases/submit - Submit case study (public)
router.post('/submit',
  validateRequired([
    'submitter.name',
    'submitter.email',
    'case_study.title',
    'case_study.description',
    'case_study.failure_mode'
  ]),
  validateEmail('submitter.email'),
  asyncHandler(casesController.submitCase)
);

/**
 * Admin routes
 */

// GET /api/cases/submissions - List all submissions (admin)
router.get('/submissions',
  authenticateToken,
  requireRole('admin', 'moderator'),
  asyncHandler(casesController.listSubmissions)
);

// GET /api/cases/submissions/high-relevance - List high-relevance pending (admin)
router.get('/submissions/high-relevance',
  authenticateToken,
  requireRole('admin', 'moderator'),
  asyncHandler(casesController.listHighRelevance)
);

// GET /api/cases/submissions/:id - Get submission by ID (admin)
router.get('/submissions/:id',
  authenticateToken,
  requireRole('admin', 'moderator'),
  validateObjectId('id'),
  asyncHandler(casesController.getSubmission)
);

// POST /api/cases/submissions/:id/approve - Approve submission (admin)
router.post('/submissions/:id/approve',
  authenticateToken,
  requireRole('admin'),
  validateObjectId('id'),
  asyncHandler(casesController.approveSubmission)
);

// POST /api/cases/submissions/:id/reject - Reject submission (admin)
router.post('/submissions/:id/reject',
  authenticateToken,
  requireRole('admin'),
  validateObjectId('id'),
  validateRequired(['reason']),
  asyncHandler(casesController.rejectSubmission)
);

// POST /api/cases/submissions/:id/request-info - Request more information (admin)
router.post('/submissions/:id/request-info',
  authenticateToken,
  requireRole('admin', 'moderator'),
  validateObjectId('id'),
  validateRequired(['requested_info']),
  asyncHandler(casesController.requestMoreInfo)
);

// DELETE /api/cases/submissions/:id - Delete submission (admin)
router.delete('/submissions/:id',
  authenticateToken,
  requireRole('admin'),
  validateObjectId('id'),
  asyncHandler(casesController.deleteSubmission)
);

module.exports = router;
