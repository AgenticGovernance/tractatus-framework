/**
 * Documents Routes
 * Framework documentation endpoints
 */

const express = require('express');
const router = express.Router();

const documentsController = require('../controllers/documents.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { validateRequired, validateObjectId, validateSlug } = require('../middleware/validation.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * Public routes (read-only)
 */

// GET /api/documents/search?q=query
router.get('/search',
  asyncHandler(documentsController.searchDocuments)
);

// GET /api/documents/archived
router.get('/archived',
  asyncHandler(documentsController.listArchivedDocuments)
);

// GET /api/documents
router.get('/', (req, res, next) => {
  // Redirect browser requests to API documentation
  const acceptsHtml = req.accepts('html');
  const acceptsJson = req.accepts('json');

  if (acceptsHtml && !acceptsJson) {
    return res.redirect(302, '/api-reference.html#documents');
  }

  next();
}, asyncHandler(documentsController.listDocuments));

// GET /api/documents/:identifier (ID or slug)
router.get('/:identifier',
  asyncHandler(documentsController.getDocument)
);

/**
 * Admin routes (protected)
 */

// POST /api/documents
router.post('/',
  authenticateToken,
  requireRole('admin'),
  validateRequired(['title', 'slug', 'quadrant', 'content_markdown']),
  validateSlug,
  asyncHandler(documentsController.createDocument)
);

// PUT /api/documents/:id
router.put('/:id',
  authenticateToken,
  requireRole('admin'),
  validateObjectId('id'),
  asyncHandler(documentsController.updateDocument)
);

// DELETE /api/documents/:id
router.delete('/:id',
  authenticateToken,
  requireRole('admin'),
  validateObjectId('id'),
  asyncHandler(documentsController.deleteDocument)
);

module.exports = router;
