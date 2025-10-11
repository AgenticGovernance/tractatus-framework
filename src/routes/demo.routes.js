/**
 * Demo Routes
 * Public API endpoints for interactive demos
 * Rate-limited to prevent abuse
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/error.middleware');

// Import services
const {
  classifier,
  validator,
  enforcer,
  monitor
} = require('../services');

// Simple in-memory rate limiting for demos
const rateLimiter = new Map();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimiter.get(ip) || [];

  // Remove expired requests
  const validRequests = userRequests.filter(time => now - time < RATE_WINDOW);

  if (validRequests.length >= RATE_LIMIT) {
    return false;
  }

  validRequests.push(now);
  rateLimiter.set(ip, validRequests);
  return true;
}

// Rate limiting middleware
const demoRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again in a minute.',
      retryAfter: 60
    });
  }

  next();
};

/**
 * POST /api/demo/classify
 * Public instruction classification for demo
 */
router.post('/classify',
  demoRateLimit,
  asyncHandler(async (req, res) => {
    const { instruction } = req.body;

    if (!instruction || typeof instruction !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'instruction field is required and must be a string'
      });
    }

    if (instruction.length > 500) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'instruction must be 500 characters or less'
      });
    }

    const classification = classifier.classify({
      text: instruction,
      context: {},
      timestamp: new Date(),
      source: 'demo'
    });

    res.json({
      success: true,
      classification: {
        quadrant: classification.quadrant,
        persistence: classification.persistence,
        temporal_scope: classification.temporal_scope || 'session',
        verification_required: classification.verification_required || 'MANDATORY',
        explicitness: classification.explicitness || 0.7,
        human_oversight: classification.human_oversight || 'RECOMMENDED',
        reasoning: classification.reasoning || generateReasoning(classification)
      }
    });
  })
);

/**
 * POST /api/demo/boundary-check
 * Public boundary enforcement check for demo
 */
router.post('/boundary-check',
  demoRateLimit,
  asyncHandler(async (req, res) => {
    const { decision, description } = req.body;

    if (!decision || typeof decision !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'decision field is required'
      });
    }

    const action = {
      type: 'decision',
      decision: decision,
      description: description || '',
      timestamp: new Date()
    };

    const enforcement = enforcer.enforce(action, { source: 'demo' });

    res.json({
      success: true,
      enforcement: {
        allowed: enforcement.allowed,
        boundary_violated: enforcement.boundary_violated || null,
        reasoning: enforcement.reasoning || generateBoundaryReasoning(enforcement, decision),
        alternatives: enforcement.alternatives || [],
        human_approval_required: !enforcement.allowed
      }
    });
  })
);

/**
 * POST /api/demo/pressure-check
 * Public pressure analysis for demo
 */
router.post('/pressure-check',
  demoRateLimit,
  asyncHandler(async (req, res) => {
    const { tokens, messages, errors } = req.body;

    if (typeof tokens !== 'number' || typeof messages !== 'number') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tokens and messages must be numbers'
      });
    }

    const context = {
      tokenUsage: tokens,
      tokenBudget: 200000,
      messageCount: messages,
      errorCount: errors || 0,
      source: 'demo'
    };

    const pressure = monitor.analyzePressure(context);

    res.json({
      success: true,
      pressure: {
        level: pressure.level,
        score: pressure.score,
        percentage: Math.round(pressure.score * 100),
        recommendations: pressure.recommendations || generatePressureRecommendations(pressure),
        factors: pressure.factors || {}
      }
    });
  })
);

/**
 * Helper: Generate reasoning for classification
 */
function generateReasoning(classification) {
  const { quadrant, persistence } = classification;

  const quadrantReasons = {
    'STRATEGIC': 'This appears to involve long-term values, mission, or organizational direction.',
    'OPERATIONAL': 'This relates to processes, policies, or project-level decisions.',
    'TACTICAL': 'This is an immediate implementation or action-level instruction.',
    'SYSTEM': 'This involves technical infrastructure or architectural decisions.',
    'STOCHASTIC': 'This relates to exploration, innovation, or experimentation.'
  };

  const persistenceReasons = {
    'HIGH': 'Should remain active for the duration of the project or longer.',
    'MEDIUM': 'Should remain active for this phase or session.',
    'LOW': 'Single-use or temporary instruction.',
    'VARIABLE': 'Applies conditionally based on context.'
  };

  return `${quadrantReasons[quadrant] || 'Classification based on instruction content.'} ${persistenceReasons[persistence] || ''}`;
}

/**
 * Helper: Generate boundary enforcement reasoning
 */
function generateBoundaryReasoning(enforcement, decision) {
  if (enforcement.allowed) {
    return 'This is a technical decision that can be automated with appropriate verification.';
  }

  const boundaryReasons = {
    'VALUES': 'Values decisions cannot be automated - they require human judgment.',
    'USER_AGENCY': 'Decisions affecting user agency require explicit consent.',
    'IRREVERSIBLE': 'Irreversible actions require human approval before execution.',
    'STRATEGIC': 'Strategic direction decisions must be made by humans.',
    'ETHICAL': 'Ethical considerations require human moral judgment.'
  };

  return boundaryReasons[enforcement.boundary_violated] ||
    'This decision crosses into territory requiring human judgment.';
}

/**
 * Helper: Generate pressure recommendations
 */
function generatePressureRecommendations(pressure) {
  const { level, score } = pressure;

  if (level === 'NORMAL') {
    return 'Operating normally. All systems green.';
  } else if (level === 'ELEVATED') {
    return 'Elevated pressure detected. Increased verification recommended.';
  } else if (level === 'HIGH') {
    return 'High pressure. Mandatory verification required for all actions.';
  } else if (level === 'CRITICAL') {
    return 'Critical pressure! Recommend context refresh or session restart.';
  } else if (level === 'DANGEROUS') {
    return 'DANGEROUS CONDITIONS. Human intervention required. Action execution blocked.';
  }

  return 'Pressure analysis complete.';
}

module.exports = router;
