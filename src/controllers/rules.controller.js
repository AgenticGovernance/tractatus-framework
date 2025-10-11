/**
 * Rules Controller
 * Multi-Project Governance Manager - Rule Management API
 *
 * Provides CRUD operations and advanced querying for governance rules
 */

const GovernanceRule = require('../models/GovernanceRule.model');
const VariableSubstitutionService = require('../services/VariableSubstitution.service');
const logger = require('../utils/logger.util');

/**
 * GET /api/admin/rules
 * List all rules with filtering, sorting, and pagination
 *
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.scope] - Filter by scope (UNIVERSAL | PROJECT_SPECIFIC)
 * @param {string} [req.query.quadrant] - Filter by quadrant (STRATEGIC | OPERATIONAL | TACTICAL | SYSTEM | STORAGE)
 * @param {string} [req.query.persistence] - Filter by persistence (HIGH | MEDIUM | LOW)
 * @param {string} [req.query.category] - Filter by category
 * @param {boolean} [req.query.active] - Filter by active status
 * @param {string} [req.query.validationStatus] - Filter by validation status
 * @param {string} [req.query.projectId] - Filter by applicable project
 * @param {string} [req.query.search] - Full-text search in rule text
 * @param {string} [req.query.sort='priority'] - Sort field (priority | clarity | id | updatedAt)
 * @param {string} [req.query.order='desc'] - Sort order (asc | desc)
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=20] - Items per page
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with rules array and pagination metadata
 *
 * @example
 * // Get all active SYSTEM rules, sorted by priority
 * GET /api/admin/rules?quadrant=SYSTEM&active=true&sort=priority&order=desc
 */
async function listRules(req, res) {
  try {
    const {
      // Filtering
      scope,           // UNIVERSAL | PROJECT_SPECIFIC
      quadrant,        // STRATEGIC | OPERATIONAL | TACTICAL | SYSTEM | STORAGE
      persistence,     // HIGH | MEDIUM | LOW
      category,        // content | security | privacy | technical | process | values | other
      active,          // true | false
      validationStatus, // PASSED | FAILED | NEEDS_REVIEW | NOT_VALIDATED
      projectId,       // Filter by applicable project
      search,          // Text search in rule text

      // Sorting
      sort = 'priority', // priority | clarity | id | updatedAt
      order = 'desc',    // asc | desc

      // Pagination
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {};

    if (scope) query.scope = scope;
    if (quadrant) query.quadrant = quadrant;
    if (persistence) query.persistence = persistence;
    if (category) query.category = category;
    if (active !== undefined) query.active = active === 'true';
    if (validationStatus) query.validationStatus = validationStatus;

    // Project-specific filtering
    if (projectId) {
      query.$or = [
        { scope: 'UNIVERSAL' },
        { applicableProjects: projectId },
        { applicableProjects: '*' }
      ];
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort
    const sortField = sort === 'clarity' ? 'clarityScore' : sort;
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortQuery = { [sortField]: sortOrder };

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let [rules, total] = await Promise.all([
      GovernanceRule.find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      GovernanceRule.countDocuments(query)
    ]);

    // If projectId provided, substitute variables to show context-aware text
    if (projectId) {
      rules = await VariableSubstitutionService.substituteRules(rules, projectId);
    }

    res.json({
      success: true,
      rules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('List rules error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve rules'
    });
  }
}

/**
 * GET /api/admin/rules/stats
 * Get dashboard statistics including counts by scope, quadrant, persistence,
 * validation status, and average quality scores
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with comprehensive statistics
 *
 * @example
 * // Response format:
 * {
 *   success: true,
 *   stats: {
 *     total: 18,
 *     byScope: { UNIVERSAL: 0, PROJECT_SPECIFIC: 18 },
 *     byQuadrant: [{ quadrant: 'SYSTEM', count: 7 }, ...],
 *     byPersistence: [{ persistence: 'HIGH', count: 17 }, ...],
 *     byValidationStatus: { NOT_VALIDATED: 18 },
 *     averageScores: { clarity: 85.5, specificity: null, actionability: null },
 *     totalChecks: 0,
 *     totalViolations: 0
 *   }
 * }
 */
async function getRuleStats(req, res) {
  try {
    const stats = await GovernanceRule.getStatistics();

    // Count rules by scope
    const scopeCounts = await GovernanceRule.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id: '$scope',
          count: { $sum: 1 }
        }
      }
    ]);

    // Count rules by validation status
    const validationCounts = await GovernanceRule.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id: '$validationStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format response
    const response = {
      success: true,
      stats: {
        total: stats?.totalRules || 0,
        byScope: scopeCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byQuadrant: stats?.byQuadrant || [],
        byPersistence: stats?.byPersistence || [],
        byValidationStatus: validationCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        averageScores: {
          clarity: stats?.avgClarityScore || null,
          specificity: stats?.avgSpecificityScore || null,
          actionability: stats?.avgActionabilityScore || null
        },
        totalChecks: stats?.totalChecks || 0,
        totalViolations: stats?.totalViolations || 0
      }
    };

    res.json(response);

  } catch (error) {
    logger.error('Get rule stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve statistics'
    });
  }
}

/**
 * GET /api/admin/rules/:id
 * Get a single rule with full details including validation results,
 * usage statistics, and optimization history
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Rule ID (inst_xxx) or MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with complete rule document
 *
 * @example
 * GET /api/admin/rules/inst_001
 * GET /api/admin/rules/68e8c3a6499d095048311f03
 */
async function getRule(req, res) {
  try {
    const { id } = req.params;

    const rule = await GovernanceRule.findOne({
      $or: [
        { id },
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }
      ]
    });

    if (!rule) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Rule not found'
      });
    }

    res.json({
      success: true,
      rule
    });

  } catch (error) {
    logger.error('Get rule error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve rule'
    });
  }
}

/**
 * POST /api/admin/rules
 * Create a new governance rule with automatic variable detection and clarity scoring
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Rule data
 * @param {string} req.body.id - Unique rule ID (e.g., 'inst_019')
 * @param {string} req.body.text - Rule text (may contain ${VARIABLE} placeholders)
 * @param {string} [req.body.scope='PROJECT_SPECIFIC'] - UNIVERSAL | PROJECT_SPECIFIC
 * @param {Array<string>} [req.body.applicableProjects=['*']] - Project IDs or ['*'] for all
 * @param {string} req.body.quadrant - STRATEGIC | OPERATIONAL | TACTICAL | SYSTEM | STORAGE
 * @param {string} req.body.persistence - HIGH | MEDIUM | LOW
 * @param {string} [req.body.category='other'] - Rule category
 * @param {number} [req.body.priority=50] - Priority (0-100)
 * @param {string} [req.body.temporalScope='PERMANENT'] - IMMEDIATE | SESSION | PROJECT | PERMANENT
 * @param {boolean} [req.body.active=true] - Whether rule is active
 * @param {Array<string>} [req.body.examples=[]] - Example scenarios
 * @param {Array<string>} [req.body.relatedRules=[]] - IDs of related rules
 * @param {string} [req.body.notes=''] - Additional notes
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with created rule
 *
 * @example
 * POST /api/admin/rules
 * {
 *   "id": "inst_019",
 *   "text": "Database MUST use ${DB_TYPE} on port ${DB_PORT}",
 *   "scope": "UNIVERSAL",
 *   "quadrant": "SYSTEM",
 *   "persistence": "HIGH",
 *   "priority": 90
 * }
 */
async function createRule(req, res) {
  try {
    const {
      id,
      text,
      scope = 'PROJECT_SPECIFIC',
      applicableProjects = ['*'],
      quadrant,
      persistence,
      category = 'other',
      priority = 50,
      temporalScope = 'PERMANENT',
      active = true,
      examples = [],
      relatedRules = [],
      notes = ''
    } = req.body;

    // Validation
    if (!id || !text || !quadrant || !persistence) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: id, text, quadrant, persistence'
      });
    }

    // Check if rule ID already exists
    const existing = await GovernanceRule.findOne({ id });
    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: `Rule with ID ${id} already exists`
      });
    }

    // Auto-detect variables in text
    const variables = [];
    const varPattern = /\$\{([A-Z_]+)\}/g;
    let match;
    while ((match = varPattern.exec(text)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    // Calculate basic clarity score (heuristic - will be improved by AI optimizer)
    let clarityScore = 100;
    const weakWords = ['try', 'maybe', 'consider', 'might', 'probably', 'possibly'];
    weakWords.forEach(word => {
      if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
        clarityScore -= 10;
      }
    });
    const strongWords = ['MUST', 'SHALL', 'REQUIRED', 'PROHIBITED'];
    const hasStrong = strongWords.some(word => new RegExp(`\\b${word}\\b`).test(text));
    if (!hasStrong) clarityScore -= 10;
    clarityScore = Math.max(0, Math.min(100, clarityScore));

    // Create rule
    const rule = new GovernanceRule({
      id,
      text,
      scope,
      applicableProjects,
      variables,
      quadrant,
      persistence,
      category,
      priority,
      temporalScope,
      active,
      examples,
      relatedRules,
      notes,
      source: 'user_instruction',
      createdBy: req.user?.email || 'admin',
      clarityScore,
      validationStatus: 'NOT_VALIDATED',
      usageStats: {
        referencedInProjects: [],
        timesEnforced: 0,
        conflictsDetected: 0,
        lastEnforced: null
      }
    });

    await rule.save();

    logger.info(`Rule created: ${id} by ${req.user?.email}`);

    res.status(201).json({
      success: true,
      rule,
      message: 'Rule created successfully'
    });

  } catch (error) {
    logger.error('Create rule error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create rule'
    });
  }
}

/**
 * PUT /api/admin/rules/:id
 * Update an existing rule with automatic variable re-detection, clarity re-scoring,
 * and optimization history tracking
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Rule ID (inst_xxx) or MongoDB ObjectId
 * @param {Object} req.body - Fields to update (partial update supported)
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response with updated rule
 *
 * @description
 * - Automatically re-detects variables if text changes
 * - Recalculates clarity score if text changes
 * - Adds entry to optimization history if text changes
 * - Resets validation status to NOT_VALIDATED if text changes
 *
 * @example
 * PUT /api/admin/rules/inst_001
 * {
 *   "text": "MongoDB MUST run on port 27017 for ${PROJECT_NAME} database",
 *   "priority": 95
 * }
 */
async function updateRule(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find rule
    const rule = await GovernanceRule.findOne({
      $or: [
        { id },
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }
      ]
    });

    if (!rule) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Rule not found'
      });
    }

    // Track changes for optimization history
    const before = rule.text;

    // Update fields (whitelist approach for security)
    const allowedFields = [
      'text', 'scope', 'applicableProjects', 'variables',
      'quadrant', 'persistence', 'category', 'priority',
      'temporalScope', 'active', 'examples', 'relatedRules', 'notes'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        rule[field] = updates[field];
      }
    });

    // If text changed, re-detect variables and update clarity score
    if (updates.text && updates.text !== before) {
      const variables = [];
      const varPattern = /\$\{([A-Z_]+)\}/g;
      let match;
      while ((match = varPattern.exec(updates.text)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }
      rule.variables = variables;

      // Recalculate basic clarity score
      let clarityScore = 100;
      const weakWords = ['try', 'maybe', 'consider', 'might', 'probably', 'possibly'];
      weakWords.forEach(word => {
        if (new RegExp(`\\b${word}\\b`, 'i').test(updates.text)) {
          clarityScore -= 10;
        }
      });
      const strongWords = ['MUST', 'SHALL', 'REQUIRED', 'PROHIBITED'];
      const hasStrong = strongWords.some(word => new RegExp(`\\b${word}\\b`).test(updates.text));
      if (!hasStrong) clarityScore -= 10;
      rule.clarityScore = Math.max(0, Math.min(100, clarityScore));

      // Add to optimization history if text changed significantly
      if (rule.optimizationHistory && before !== updates.text) {
        rule.optimizationHistory.push({
          timestamp: new Date(),
          before,
          after: updates.text,
          reason: 'Manual edit by user',
          scores: {
            clarity: rule.clarityScore,
            specificity: rule.specificityScore,
            actionability: rule.actionabilityScore
          }
        });
      }

      // Reset validation status (needs re-validation after change)
      rule.validationStatus = 'NOT_VALIDATED';
      rule.lastValidated = null;
    }

    await rule.save();

    logger.info(`Rule updated: ${rule.id} by ${req.user?.email}`);

    res.json({
      success: true,
      rule,
      message: 'Rule updated successfully'
    });

  } catch (error) {
    logger.error('Update rule error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update rule'
    });
  }
}

/**
 * DELETE /api/admin/rules/:id
 * Soft delete (deactivate) or permanently delete a rule
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Rule ID (inst_xxx) or MongoDB ObjectId
 * @param {Object} req.query - Query parameters
 * @param {boolean} [req.query.permanent=false] - If 'true', hard delete; otherwise soft delete
 * @param {Object} res - Express response object
 *
 * @returns {Object} JSON response confirming deletion
 *
 * @description
 * - Default behavior: Soft delete (sets active=false, preserves data)
 * - Prevents deletion of UNIVERSAL rules that are in use by projects
 * - Use permanent=true query param for hard delete (use with caution)
 *
 * @example
 * // Soft delete (recommended)
 * DELETE /api/admin/rules/inst_001
 *
 * // Permanent delete (use with caution)
 * DELETE /api/admin/rules/inst_001?permanent=true
 */
async function deleteRule(req, res) {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    const rule = await GovernanceRule.findOne({
      $or: [
        { id },
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }
      ]
    });

    if (!rule) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Rule not found'
      });
    }

    // Check if rule is in use
    if (rule.scope === 'UNIVERSAL' && rule.usageStats?.referencedInProjects?.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: `Rule is used by ${rule.usageStats.referencedInProjects.length} projects. Cannot delete.`,
        projects: rule.usageStats.referencedInProjects
      });
    }

    if (permanent === 'true') {
      // Hard delete (use with caution)
      await rule.deleteOne();
      logger.warn(`Rule permanently deleted: ${rule.id} by ${req.user?.email}`);

      res.json({
        success: true,
        message: 'Rule permanently deleted'
      });
    } else {
      // Soft delete
      rule.active = false;
      await rule.save();
      logger.info(`Rule deactivated: ${rule.id} by ${req.user?.email}`);

      res.json({
        success: true,
        rule,
        message: 'Rule deactivated successfully'
      });
    }

  } catch (error) {
    logger.error('Delete rule error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete rule'
    });
  }
}

/**
 * POST /api/admin/rules/:id/optimize
 * Optimize a single rule using AI analysis
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Rule ID
 * @param {Object} req.body - Optimization options
 * @param {string} [req.body.mode='conservative'] - 'aggressive' or 'conservative'
 * @param {Object} res - Express response object
 *
 * @returns {Object} Optimization analysis and suggestions
 */
async function optimizeRule(req, res) {
  try {
    const { id } = req.params;
    const { mode = 'conservative' } = req.body;

    // Find rule
    const rule = await GovernanceRule.findOne({
      $or: [
        { id },
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }
      ]
    });

    if (!rule) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Rule not found'
      });
    }

    const RuleOptimizer = require('../services/RuleOptimizer.service');

    // Perform comprehensive analysis
    const analysis = RuleOptimizer.analyzeRule(rule.text);

    // Get auto-optimization result
    const optimized = RuleOptimizer.optimize(rule.text, { mode });

    res.json({
      success: true,
      rule: {
        id: rule.id,
        originalText: rule.text
      },
      analysis,
      optimization: {
        optimizedText: optimized.optimized,
        changes: optimized.changes,
        improvementScore: optimized.improvementScore,
        mode
      }
    });

  } catch (error) {
    logger.error('Optimize rule error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to optimize rule'
    });
  }
}

/**
 * POST /api/admin/rules/analyze-claude-md
 * Analyze CLAUDE.md content and extract candidate rules
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.content - CLAUDE.md file content
 * @param {Object} res - Express response object
 *
 * @returns {Object} Complete analysis with candidates, redundancies, and migration plan
 */
async function analyzeClaudeMd(req, res) {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'CLAUDE.md content is required'
      });
    }

    const ClaudeMdAnalyzer = require('../services/ClaudeMdAnalyzer.service');

    // Perform complete analysis
    const analysis = ClaudeMdAnalyzer.analyze(content);

    res.json({
      success: true,
      analysis: {
        totalStatements: analysis.candidates.length,
        quality: analysis.quality,
        candidates: analysis.candidates,
        redundancies: analysis.redundancies,
        migrationPlan: analysis.migrationPlan
      }
    });

  } catch (error) {
    logger.error('Analyze CLAUDE.md error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to analyze CLAUDE.md'
    });
  }
}

/**
 * POST /api/admin/rules/migrate-from-claude-md
 * Create rules from selected CLAUDE.md candidates
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {Array<Object>} req.body.selectedCandidates - Array of candidate rules to create
 * @param {Object} res - Express response object
 *
 * @returns {Object} Results of rule creation (created, failed)
 */
async function migrateFromClaudeMd(req, res) {
  try {
    const { selectedCandidates } = req.body;

    if (!Array.isArray(selectedCandidates) || selectedCandidates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'selectedCandidates array is required'
      });
    }

    const results = {
      created: [],
      failed: [],
      totalRequested: selectedCandidates.length
    };

    // Generate unique IDs for new rules
    const existingRules = await GovernanceRule.find({}, 'id').lean();
    const existingIds = existingRules.map(r => r.id);
    let nextId = 1;

    // Find next available ID
    while (existingIds.includes(`inst_${String(nextId).padStart(3, '0')}`)) {
      nextId++;
    }

    // Create rules from candidates
    for (const candidate of selectedCandidates) {
      try {
        const ruleId = `inst_${String(nextId).padStart(3, '0')}`;
        nextId++;

        const rule = new GovernanceRule({
          id: ruleId,
          text: candidate.suggestedRule.text,
          scope: candidate.suggestedRule.scope,
          applicableProjects: candidate.suggestedRule.scope === 'UNIVERSAL' ? ['*'] : [],
          variables: candidate.suggestedRule.variables || [],
          quadrant: candidate.quadrant,
          persistence: candidate.persistence,
          category: 'other',
          priority: candidate.persistence === 'HIGH' ? 90 : (candidate.persistence === 'MEDIUM' ? 70 : 50),
          temporalScope: 'PERMANENT',
          active: true,
          examples: [],
          relatedRules: [],
          notes: `Migrated from CLAUDE.md. Original: ${candidate.originalText}`,
          source: 'claude_md_migration',
          createdBy: req.user?.email || 'admin',
          clarityScore: candidate.suggestedRule.clarityScore,
          validationStatus: 'NOT_VALIDATED',
          usageStats: {
            referencedInProjects: [],
            timesEnforced: 0,
            conflictsDetected: 0,
            lastEnforced: null
          }
        });

        await rule.save();
        results.created.push({
          id: ruleId,
          text: rule.text,
          original: candidate.originalText
        });

        logger.info(`Rule migrated from CLAUDE.md: ${ruleId}`);

      } catch (error) {
        results.failed.push({
          candidate: candidate.originalText,
          error: error.message
        });
        logger.error(`Failed to migrate candidate:`, error);
      }
    }

    res.json({
      success: true,
      results,
      message: `Created ${results.created.length} of ${results.totalRequested} rules`
    });

  } catch (error) {
    logger.error('Migrate from CLAUDE.md error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to migrate rules from CLAUDE.md'
    });
  }
}

// Import mongoose for ObjectId validation
const mongoose = require('mongoose');

module.exports = {
  listRules,
  getRuleStats,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  optimizeRule,
  analyzeClaudeMd,
  migrateFromClaudeMd
};
