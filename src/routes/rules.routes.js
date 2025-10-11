/**
 * Rules Routes
 * Multi-Project Governance Manager - Rule Management API
 */

const express = require('express');
const router = express.Router();

const rulesController = require('../controllers/rules.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { validateRequired } = require('../middleware/validation.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * All rule routes require authentication and admin/moderator role
 */
router.use(authenticateToken);
router.use(requireRole('admin', 'moderator'));

/**
 * Rules CRUD Operations
 */

// GET /api/admin/rules - List all rules (with filtering, sorting, pagination)
router.get('/',
  asyncHandler(rulesController.listRules)
);

// GET /api/admin/rules/stats - Get dashboard statistics
router.get('/stats',
  asyncHandler(rulesController.getRuleStats)
);

// POST /api/admin/rules/analyze-claude-md - Analyze CLAUDE.md content
router.post('/analyze-claude-md',
  validateRequired(['content']),
  asyncHandler(rulesController.analyzeClaudeMd)
);

// POST /api/admin/rules/migrate-from-claude-md - Create rules from CLAUDE.md analysis
router.post('/migrate-from-claude-md',
  validateRequired(['selectedCandidates']),
  asyncHandler(rulesController.migrateFromClaudeMd)
);

// GET /api/admin/rules/:id - Get single rule
router.get('/:id',
  asyncHandler(rulesController.getRule)
);

// POST /api/admin/rules/:id/optimize - Optimize a rule with AI
router.post('/:id/optimize',
  asyncHandler(rulesController.optimizeRule)
);

// POST /api/admin/rules - Create new rule
router.post('/',
  validateRequired(['id', 'text', 'quadrant', 'persistence']),
  asyncHandler(rulesController.createRule)
);

// PUT /api/admin/rules/:id - Update rule
router.put('/:id',
  asyncHandler(rulesController.updateRule)
);

// DELETE /api/admin/rules/:id - Delete rule (soft delete by default)
router.delete('/:id',
  requireRole('admin'), // Only admins can delete rules
  asyncHandler(rulesController.deleteRule)
);

module.exports = router;
