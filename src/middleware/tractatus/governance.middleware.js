/**
 * Tractatus Governance Middleware
 * Integrates Tractatus services with Express routes
 *
 * Provides middleware functions for:
 * - AI-powered content moderation (blog posts, case studies)
 * - Human approval workflows
 * - Safety constraint enforcement
 */

const {
  classifier,
  validator,
  enforcer,
  monitor,
  verifier
} = require('../../services');
const logger = require('../../utils/logger.util');

/**
 * Classify incoming content by quadrant and persistence
 * Adds classification metadata to req.tractatus
 */
function classifyContent(req, res, next) {
  try {
    const content = req.body.content || req.body.description || req.body.text || '';

    const classification = classifier.classify({
      text: content,
      context: {
        domain: req.body.domain || 'general',
        type: req.body.type || 'content'
      },
      timestamp: new Date(),
      source: 'user'
    });

    // Attach to request
    req.tractatus = req.tractatus || {};
    req.tractatus.classification = classification;

    logger.debug('Content classified', {
      quadrant: classification.quadrant,
      persistence: classification.persistence,
      verification: classification.verification
    });

    next();

  } catch (error) {
    logger.error('Classification middleware error:', error);
    // Continue without classification (safer than blocking)
    next();
  }
}

/**
 * Enforce Tractatus boundaries
 * Blocks actions that cross values/wisdom/agency boundaries
 */
function enforceBoundaries(req, res, next) {
  try {
    const action = {
      description: req.body.content || req.body.description || '',
      type: req.body.type || req.route.path,
      method: req.method
    };

    const enforcement = enforcer.enforce(action, {
      user: req.user,
      route: req.route.path
    });

    if (!enforcement.allowed) {
      logger.warn('Action blocked by boundary enforcement', {
        reason: enforcement.reason,
        action: action.description?.substring(0, 50)
      });

      return res.status(403).json({
        error: 'Boundary Violation',
        message: enforcement.message,
        requiresHuman: true,
        reason: enforcement.reason,
        userPrompt: enforcement.userPrompt
      });
    }

    // Attach enforcement result
    req.tractatus = req.tractatus || {};
    req.tractatus.enforcement = enforcement;

    next();

  } catch (error) {
    logger.error('Boundary enforcement middleware error:', error);
    next(error);
  }
}

/**
 * Check context pressure before AI operations
 * Recommends human intervention if pressure is too high
 */
function checkPressure(req, res, next) {
  try {
    const context = {
      tokenUsage: req.headers['x-token-usage'] || 0,
      tokenBudget: 200000,
      messageCount: req.session?.messageCount || 0,
      activeTasks: req.session?.activeTasks || []
    };

    const pressure = monitor.analyzePressure(context);

    // Attach pressure analysis
    req.tractatus = req.tractatus || {};
    req.tractatus.pressure = pressure;

    // Warn if pressure is high
    if (pressure.pressureLevel >= 3) { // CRITICAL or DANGEROUS
      logger.warn('High context pressure detected', {
        level: pressure.pressureName,
        overall: pressure.overallPressure
      });

      // Add warning to response headers
      res.setHeader('X-Tractatus-Pressure', pressure.pressureName);
      res.setHeader('X-Tractatus-Recommendations', JSON.stringify(pressure.recommendations.slice(0, 2)));
    }

    next();

  } catch (error) {
    logger.error('Pressure monitoring middleware error:', error);
    next();
  }
}

/**
 * Require human approval for AI-generated content
 * Used for blog posts, media responses, case studies
 */
function requireHumanApproval(req, res, next) {
  try {
    // Check if content is AI-generated and not yet approved
    if (req.body.aiGenerated && !req.body.humanApproved) {
      const classification = req.tractatus?.classification;

      // Determine if approval is required
      const requiresApproval =
        classification?.verification === 'MANDATORY' ||
        classification?.persistence === 'HIGH' ||
        classification?.quadrant === 'STRATEGIC' ||
        classification?.quadrant === 'OPERATIONAL';

      if (requiresApproval) {
        logger.info('Human approval required for AI-generated content', {
          quadrant: classification?.quadrant,
          persistence: classification?.persistence
        });

        return res.status(403).json({
          error: 'Approval Required',
          message: 'This AI-generated content requires human approval before publishing',
          reason: 'TRACTATUS_GOVERNANCE',
          classification: {
            quadrant: classification?.quadrant,
            persistence: classification?.persistence,
            verification: classification?.verification
          },
          action: 'Submit for moderation queue'
        });
      }
    }

    next();

  } catch (error) {
    logger.error('Human approval middleware error:', error);
    next(error);
  }
}

/**
 * Add Tractatus metadata to AI-generated responses
 * Provides transparency about governance checks
 */
function addTractatusMetadata(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // Add Tractatus metadata if governance checks were performed
    if (req.tractatus) {
      data.tractatus = {
        governed: true,
        classification: req.tractatus.classification ? {
          quadrant: req.tractatus.classification.quadrant,
          persistence: req.tractatus.classification.persistence,
          verification: req.tractatus.classification.verification
        } : undefined,
        pressure: req.tractatus.pressure ? {
          level: req.tractatus.pressure.pressureName,
          score: req.tractatus.pressure.overallPressure
        } : undefined,
        enforcement: req.tractatus.enforcement ? {
          allowed: req.tractatus.enforcement.allowed,
          requiresHuman: req.tractatus.enforcement.humanRequired
        } : undefined,
        timestamp: new Date()
      };
    }

    return originalJson(data);
  };

  next();
}

/**
 * Governance status endpoint middleware
 * Provides framework status information
 */
function governanceStatus(req, res) {
  const {
    getFrameworkStatus
  } = require('../../services');

  const status = getFrameworkStatus();

  // Add runtime metrics
  const runtimeMetrics = {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    environment: process.env.NODE_ENV
  };

  res.json({
    ...status,
    runtime: runtimeMetrics,
    operational: true
  });
}

module.exports = {
  classifyContent,
  enforceBoundaries,
  checkPressure,
  requireHumanApproval,
  addTractatusMetadata,
  governanceStatus
};
