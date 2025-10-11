/**
 * MemoryProxy Service v3 - Hybrid Architecture
 *
 * Production-grade memory management with optional Anthropic Memory Tool API integration
 *
 * Architecture:
 * - STORAGE LAYER: MongoDB (governanceRules, auditLogs collections - persistent, queryable)
 * - OPTIONAL ENHANCEMENT: Anthropic Memory Tool (context editing, 29-39% token reduction)
 * - CACHING: In-memory cache with TTL for performance
 *
 * Why Hybrid:
 * - MongoDB provides persistence, querying, analytics, backup (REQUIRED)
 * - Anthropic API provides context optimization, memory tool operations, token reduction (OPTIONAL)
 * - System functions fully without Anthropic API key
 *
 * Benefits over filesystem-only:
 * - Fast indexed queries (MongoDB)
 * - Atomic operations (MongoDB)
 * - Context optimization (Anthropic)
 * - Built-in replication/backup (MongoDB)
 * - Scalable architecture
 */

const logger = require('../utils/logger.util');
const GovernanceRule = require('../models/GovernanceRule.model');
const AuditLog = require('../models/AuditLog.model');
const { getAnthropicMemoryClient } = require('./AnthropicMemoryClient.service');

class MemoryProxyService {
  constructor(options = {}) {
    this.cacheEnabled = options.cacheEnabled !== false;
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes default
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // Anthropic API integration (OPTIONAL ENHANCEMENT)
    this.anthropicEnabled = options.anthropicEnabled !== false; // Enabled by default if API key available
    this.anthropicClient = null;

    logger.info('MemoryProxyService v3 initialized (Hybrid: MongoDB + optional Anthropic API)', {
      cacheEnabled: this.cacheEnabled,
      cacheTTL: this.cacheTTL,
      anthropicEnabled: this.anthropicEnabled
    });
  }

  /**
   * Initialize memory system
   * - Verifies MongoDB connection (REQUIRED)
   * - Initializes Anthropic Memory Client if available (OPTIONAL)
   */
  async initialize() {
    try {
      // Verify MongoDB connection by counting documents
      const ruleCount = await GovernanceRule.countDocuments();
      const logCount = await AuditLog.countDocuments();

      logger.info('MongoDB initialized', {
        governanceRules: ruleCount,
        auditLogs: logCount
      });

      // Initialize Anthropic Memory Client (OPTIONAL ENHANCEMENT)
      if (this.anthropicEnabled) {
        try {
          this.anthropicClient = getAnthropicMemoryClient();
          logger.info('✅ Anthropic Memory Client initialized (optional enhancement)');
        } catch (error) {
          // If API key missing, this is acceptable - continue without it
          logger.warn('⚠️ Anthropic Memory Client not available (API key missing)', {
            error: error.message
          });
          logger.info('ℹ️ System will continue with MongoDB-only operation');
          this.anthropicEnabled = false;
        }
      }

      logger.info('✅ MemoryProxy fully initialized', {
        mongodb: true,
        anthropicAPI: this.anthropicEnabled,
        cache: this.cacheEnabled
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize MemoryProxy', { error: error.message });
      throw error;
    }
  }

  // ========================================
  // GOVERNANCE RULES MANAGEMENT
  // ========================================

  /**
   * Persist governance rules to MongoDB
   *
   * @param {Array} rules - Array of governance rule objects
   * @returns {Promise<Object>} - Result with success status and metadata
   */
  async persistGovernanceRules(rules) {
    const startTime = Date.now();

    try {
      logger.info('Persisting governance rules', { count: rules.length });

      // Validate input
      if (!Array.isArray(rules)) {
        throw new Error('Rules must be an array');
      }

      if (rules.length === 0) {
        throw new Error('Cannot persist empty rules array');
      }

      // Use bulkWrite for efficient upsert
      const operations = rules.map(rule => ({
        updateOne: {
          filter: { id: rule.id },
          update: {
            $set: {
              text: rule.text,
              quadrant: rule.quadrant,
              persistence: rule.persistence,
              category: rule.category || 'other',
              priority: rule.priority || 50,
              temporalScope: rule.temporalScope || 'PERMANENT',
              active: rule.active !== false,
              source: rule.source || 'framework_default',
              examples: rule.examples || [],
              relatedRules: rule.relatedRules || [],
              notes: rule.notes || ''
            },
            $setOnInsert: {
              id: rule.id,
              createdBy: rule.createdBy || 'system',
              stats: {
                timesChecked: 0,
                timesViolated: 0,
                lastChecked: null,
                lastViolated: null
              }
            }
          },
          upsert: true
        }
      }));

      const result = await GovernanceRule.bulkWrite(operations);

      // Clear cache
      if (this.cacheEnabled) {
        this.clearCache();
      }

      const duration = Date.now() - startTime;

      logger.info('Governance rules persisted successfully', {
        inserted: result.upsertedCount,
        modified: result.modifiedCount,
        total: rules.length,
        duration: `${duration}ms`
      });

      return {
        success: true,
        inserted: result.upsertedCount,
        modified: result.modifiedCount,
        total: rules.length,
        duration
      };

    } catch (error) {
      logger.error('Failed to persist governance rules', {
        error: error.message,
        count: rules.length
      });
      throw error;
    }
  }

  /**
   * Load governance rules from MongoDB
   *
   * @param {Object} options - Loading options
   * @returns {Promise<Array>} - Array of governance rule objects
   */
  async loadGovernanceRules(options = {}) {
    const startTime = Date.now();

    try {
      // Check cache first
      if (this.cacheEnabled && !options.skipCache) {
        const cached = this._getCachedRules();
        if (cached) {
          logger.debug('Governance rules loaded from cache');
          return cached;
        }
      }

      // Load from MongoDB
      const rules = await GovernanceRule.findActive(options);

      // Convert to plain objects
      const plainRules = rules.map(rule => ({
        id: rule.id,
        text: rule.text,
        quadrant: rule.quadrant,
        persistence: rule.persistence,
        category: rule.category,
        priority: rule.priority,
        temporalScope: rule.temporalScope,
        active: rule.active,
        source: rule.source,
        examples: rule.examples,
        relatedRules: rule.relatedRules,
        notes: rule.notes,
        stats: rule.stats
      }));

      // Update cache
      if (this.cacheEnabled) {
        this.cache.set('governance-rules', plainRules);
        this.cacheTimestamps.set('governance-rules', Date.now());
      }

      const duration = Date.now() - startTime;

      logger.info('Governance rules loaded successfully', {
        count: plainRules.length,
        duration: `${duration}ms`,
        fromCache: false
      });

      return plainRules;

    } catch (error) {
      logger.error('Failed to load governance rules', { error: error.message });
      throw error;
    }
  }

  /**
   * Get specific rule by ID
   *
   * @param {string} ruleId - Rule identifier (e.g., 'inst_016')
   * @returns {Promise<Object|null>} - Rule object or null if not found
   */
  async getRule(ruleId) {
    try {
      const rule = await GovernanceRule.findByRuleId(ruleId);

      if (rule) {
        logger.debug('Rule retrieved', { ruleId });
        return rule.toObject();
      } else {
        logger.warn('Rule not found', { ruleId });
        return null;
      }
    } catch (error) {
      logger.error('Failed to get rule', { ruleId, error: error.message });
      throw error;
    }
  }

  /**
   * Get rules by quadrant
   *
   * @param {string} quadrant - Quadrant name (STRATEGIC, OPERATIONAL, etc.)
   * @returns {Promise<Array>} - Array of rules in the specified quadrant
   */
  async getRulesByQuadrant(quadrant) {
    try {
      const rules = await GovernanceRule.findByQuadrant(quadrant, true);

      logger.debug('Rules filtered by quadrant', {
        quadrant,
        count: rules.length
      });

      return rules.map(r => r.toObject());
    } catch (error) {
      logger.error('Failed to get rules by quadrant', {
        quadrant,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get rules by persistence level
   *
   * @param {string} persistence - Persistence level (HIGH, MEDIUM, LOW)
   * @returns {Promise<Array>} - Array of rules with specified persistence
   */
  async getRulesByPersistence(persistence) {
    try {
      const rules = await GovernanceRule.findByPersistence(persistence, true);

      logger.debug('Rules filtered by persistence', {
        persistence,
        count: rules.length
      });

      return rules.map(r => r.toObject());
    } catch (error) {
      logger.error('Failed to get rules by persistence', {
        persistence,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Increment rule check counter
   *
   * @param {string} ruleId - Rule identifier
   */
  async incrementRuleCheck(ruleId) {
    try {
      const rule = await GovernanceRule.findByRuleId(ruleId);

      if (rule) {
        await rule.incrementChecked();
        logger.debug('Rule check counter incremented', { ruleId });
      }
    } catch (error) {
      logger.error('Failed to increment rule check', {
        ruleId,
        error: error.message
      });
      // Don't throw - stats update failure shouldn't block enforcement
    }
  }

  /**
   * Increment rule violation counter
   *
   * @param {string} ruleId - Rule identifier
   */
  async incrementRuleViolation(ruleId) {
    try {
      const rule = await GovernanceRule.findByRuleId(ruleId);

      if (rule) {
        await rule.incrementViolated();
        logger.debug('Rule violation counter incremented', { ruleId });
      }
    } catch (error) {
      logger.error('Failed to increment rule violation', {
        ruleId,
        error: error.message
      });
      // Don't throw - stats update failure shouldn't block enforcement
    }
  }

  // ========================================
  // AUDIT LOG MANAGEMENT
  // ========================================

  /**
   * Audit a decision/action
   *
   * @param {Object} decision - Decision object to audit
   * @returns {Promise<Object>} - Audit result
   */
  async auditDecision(decision) {
    const startTime = Date.now();

    try {
      // Validate decision object
      if (!decision.sessionId || !decision.action) {
        throw new Error('Decision must include sessionId and action');
      }

      // Create audit log entry
      const auditEntry = new AuditLog({
        sessionId: decision.sessionId,
        action: decision.action,
        allowed: decision.allowed !== false,
        rulesChecked: decision.rulesChecked || [],
        violations: decision.violations || [],
        metadata: decision.metadata || {},
        domain: decision.domain || 'UNKNOWN',
        boundary: decision.boundary || null,
        tractatus_section: decision.tractatus_section || null,
        service: decision.service || 'BoundaryEnforcer',
        userId: decision.userId || null,
        ipAddress: decision.ipAddress || null,
        userAgent: decision.userAgent || null,
        timestamp: new Date()
      });

      await auditEntry.save();

      const duration = Date.now() - startTime;

      // Update rule statistics asynchronously (don't block)
      if (decision.rulesChecked && decision.rulesChecked.length > 0) {
        this._updateRuleStats(decision.rulesChecked, decision.violations || [])
          .catch(err => logger.error('Failed to update rule stats', { error: err.message }));
      }

      logger.info('Decision audited', {
        sessionId: decision.sessionId,
        allowed: auditEntry.allowed,
        violations: auditEntry.violations.length,
        duration: `${duration}ms`
      });

      return {
        success: true,
        audited: true,
        auditId: auditEntry._id,
        duration
      };

    } catch (error) {
      logger.error('Failed to audit decision', {
        error: error.message,
        sessionId: decision.sessionId
      });
      throw error;
    }
  }

  /**
   * Get audit statistics for dashboard
   *
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @returns {Promise<Object>} - Statistics object
   */
  async getAuditStatistics(startDate, endDate) {
    try {
      const stats = await AuditLog.getStatistics(startDate, endDate);

      logger.debug('Audit statistics retrieved', {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get audit statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get recent audit logs
   *
   * @param {number} limit - Maximum number of logs to return
   * @returns {Promise<Array>} - Array of audit log objects
   */
  async getRecentAudits(limit = 100) {
    try {
      const logs = await AuditLog.findRecent(limit);

      logger.debug('Recent audits retrieved', { count: logs.length });

      return logs.map(log => log.toObject());
    } catch (error) {
      logger.error('Failed to get recent audits', { error: error.message });
      throw error;
    }
  }

  /**
   * Get violations breakdown
   *
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @returns {Promise<Array>} - Violation breakdown by rule
   */
  async getViolationsBreakdown(startDate, endDate) {
    try {
      const breakdown = await AuditLog.getViolationBreakdown(startDate, endDate);

      logger.debug('Violations breakdown retrieved', {
        count: breakdown.length,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      });

      return breakdown;
    } catch (error) {
      logger.error('Failed to get violations breakdown', { error: error.message });
      throw error;
    }
  }

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  /**
   * Clear cache (useful for testing or after rule updates)
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    logger.debug('Memory cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      enabled: this.cacheEnabled,
      ttl: this.cacheTTL,
      entries: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  _getCachedRules() {
    const cacheKey = 'governance-rules';

    if (!this.cache.has(cacheKey)) {
      return null;
    }

    const timestamp = this.cacheTimestamps.get(cacheKey);
    const age = Date.now() - timestamp;

    if (age > this.cacheTTL) {
      // Cache expired
      this.cache.delete(cacheKey);
      this.cacheTimestamps.delete(cacheKey);
      return null;
    }

    return this.cache.get(cacheKey);
  }

  async _updateRuleStats(rulesChecked, violations) {
    try {
      // Increment check counters for all checked rules
      for (const ruleId of rulesChecked) {
        await this.incrementRuleCheck(ruleId);
      }

      // Increment violation counters for violated rules
      for (const violation of violations) {
        if (violation.ruleId) {
          await this.incrementRuleViolation(violation.ruleId);
        }
      }
    } catch (error) {
      logger.error('Failed to update rule stats', { error: error.message });
      // Don't throw - stats update shouldn't block audit
    }
  }
}

// Export singleton instance
let instance = null;

function getMemoryProxy(options = {}) {
  if (!instance) {
    instance = new MemoryProxyService(options);
  }
  return instance;
}

module.exports = {
  MemoryProxyService,
  getMemoryProxy
};
