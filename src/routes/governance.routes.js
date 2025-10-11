/**
 * Tractatus Governance Routes
 * API endpoints for framework status and testing
 */

const express = require('express');
const router = express.Router();

const { governanceStatus } = require('../middleware/tractatus/governance.middleware');
const { authenticateToken, requireAdmin } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

// Import services for testing endpoints
const {
  classifier,
  validator,
  enforcer,
  monitor,
  verifier,
  getFrameworkStatus
} = require('../services');

/**
 * GET /api/governance
 * Get framework status (admin only - contains sensitive runtime data)
 */
router.get('/',
  authenticateToken,
  requireAdmin,
  (req, res, next) => {
    // Redirect browser requests to API documentation
    const acceptsHtml = req.accepts('html');
    const acceptsJson = req.accepts('json');

    if (acceptsHtml && !acceptsJson) {
      return res.redirect(302, '/api-reference.html#governance');
    }

    next();
  },
  governanceStatus
);

/**
 * GET /api/governance/status
 * Detailed governance status (admin only)
 */
router.get('/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const status = getFrameworkStatus();

    res.json({
      success: true,
      ...status,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV
    });
  })
);

/**
 * POST /api/governance/classify
 * Test instruction classification (admin only)
 */
router.post('/classify',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text field is required'
      });
    }

    const classification = classifier.classify({
      text,
      context: context || {},
      timestamp: new Date(),
      source: 'test'
    });

    res.json({
      success: true,
      classification
    });
  })
);

/**
 * POST /api/governance/validate
 * Test action validation (admin only)
 */
router.post('/validate',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { action, context } = req.body;

    if (!action) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'action object is required'
      });
    }

    const validation = validator.validate(action, context || {
      messages: []
    });

    res.json({
      success: true,
      validation
    });
  })
);

/**
 * POST /api/governance/enforce
 * Test boundary enforcement (admin only)
 */
router.post('/enforce',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { action, context } = req.body;

    if (!action) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'action object is required'
      });
    }

    const enforcement = enforcer.enforce(action, context || {});

    res.json({
      success: true,
      enforcement
    });
  })
);

/**
 * POST /api/governance/pressure
 * Test pressure analysis (admin only)
 */
router.post('/pressure',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { context } = req.body;

    const pressure = monitor.analyzePressure(context || {
      tokenUsage: 50000,
      tokenBudget: 200000,
      messageCount: 20
    });

    res.json({
      success: true,
      pressure
    });
  })
);

/**
 * POST /api/governance/verify
 * Test metacognitive verification (admin only)
 */
router.post('/verify',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { action, reasoning, context } = req.body;

    if (!action) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'action object is required'
      });
    }

    const verification = verifier.verify(
      action,
      reasoning || {},
      context || {}
    );

    res.json({
      success: true,
      verification
    });
  })
);

module.exports = router;
