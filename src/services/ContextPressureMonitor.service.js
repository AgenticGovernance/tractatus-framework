/*
 * Copyright 2025 John G Stroh
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Context Pressure Monitor Service
 * Detects conditions that increase AI error probability
 *
 * Core Tractatus Service: Monitors environmental factors that degrade
 * AI performance and triggers increased verification or human intervention.
 *
 * Monitored Conditions:
 * - Token budget pressure (approaching context limit)
 * - Conversation length (attention decay over long sessions)
 * - Task complexity (number of simultaneous objectives)
 * - Error frequency (recent failures indicate degraded state)
 * - Instruction density (too many competing directives)
 */

const { getMemoryProxy } = require('./MemoryProxy.service');
const SessionState = require('../models/SessionState.model');
const logger = require('../utils/logger.util');

/**
 * Pressure levels and thresholds
 */
const PRESSURE_LEVELS = {
  NORMAL: {
    level: 0,
    threshold: 0.0,  // 0-30%: Normal operations
    description: 'Normal operating conditions',
    action: 'PROCEED',
    verificationMultiplier: 1.0
  },
  ELEVATED: {
    level: 1,
    threshold: 0.3,  // 30-50%: Increased verification recommended
    description: 'Elevated pressure, increased verification recommended',
    action: 'INCREASE_VERIFICATION',
    verificationMultiplier: 1.3
  },
  HIGH: {
    level: 2,
    threshold: 0.5,  // 50-70%: Mandatory verification required
    description: 'High pressure, mandatory verification required',
    action: 'MANDATORY_VERIFICATION',
    verificationMultiplier: 1.6
  },
  CRITICAL: {
    level: 3,
    threshold: 0.7,  // 70-85%: Recommend context refresh
    description: 'Critical pressure, recommend context refresh',
    action: 'RECOMMEND_REFRESH',
    verificationMultiplier: 2.0
  },
  DANGEROUS: {
    level: 4,
    threshold: 0.85,  // 85-100%: Require human intervention
    description: 'Dangerous conditions, require human intervention',
    action: 'REQUIRE_HUMAN_INTERVENTION',
    verificationMultiplier: 3.0
  }
};

/**
 * Monitored metrics
 */
const METRICS = {
  TOKEN_USAGE: {
    weight: 0.35,
    criticalThreshold: 0.8, // 80% of token budget
    dangerThreshold: 0.95
  },
  CONVERSATION_LENGTH: {
    weight: 0.25,
    criticalThreshold: 100, // Number of messages
    dangerThreshold: 150
  },
  TASK_COMPLEXITY: {
    weight: 0.15,
    criticalThreshold: 5, // Simultaneous tasks
    dangerThreshold: 8
  },
  ERROR_FREQUENCY: {
    weight: 0.15,
    criticalThreshold: 3, // Errors in last 10 actions
    dangerThreshold: 5
  },
  INSTRUCTION_DENSITY: {
    weight: 0.10,
    criticalThreshold: 10, // Active instructions
    dangerThreshold: 15
  }
};

class ContextPressureMonitor {
  constructor() {
    this.pressureLevels = PRESSURE_LEVELS;
    this.metrics = METRICS;
    this.errorHistory = [];
    this.maxErrorHistory = 20;
    this.pressureHistory = [];
    this.maxPressureHistory = 50;

    // Initialize MemoryProxy for governance rules and audit logging
    this.memoryProxy = getMemoryProxy();
    this.governanceRules = []; // Loaded from memory for pressure analysis reference
    this.memoryProxyInitialized = false;

    // Session state persistence
    this.currentSessionId = null;
    this.sessionState = null; // SessionState model instance

    // Statistics tracking
    this.stats = {
      total_analyses: 0,
      total_errors: 0,
      by_level: {
        NORMAL: 0,
        ELEVATED: 0,
        HIGH: 0,
        CRITICAL: 0,
        DANGEROUS: 0
      },
      error_types: {}
    };

    logger.info('ContextPressureMonitor initialized');
  }

  /**
   * Initialize MemoryProxy and load governance rules
   * @param {string} sessionId - Optional session ID for state persistence
   * @returns {Promise<Object>} Initialization result
   */
  async initialize(sessionId = null) {
    try {
      await this.memoryProxy.initialize();

      // Load all governance rules for pressure analysis reference
      this.governanceRules = await this.memoryProxy.loadGovernanceRules();

      this.memoryProxyInitialized = true;

      // Initialize session state if sessionId provided
      if (sessionId) {
        this.currentSessionId = sessionId;
        this.sessionState = await SessionState.findOrCreate(sessionId);

        logger.info('[ContextPressureMonitor] Session state loaded', {
          sessionId,
          totalAnalyses: this.sessionState.totalAnalyses,
          currentPressure: this.sessionState.currentPressure.pressureLevel
        });
      }

      logger.info('[ContextPressureMonitor] MemoryProxy initialized', {
        governanceRulesLoaded: this.governanceRules.length,
        sessionPersistence: !!sessionId
      });

      return {
        success: true,
        governanceRulesLoaded: this.governanceRules.length,
        sessionId: this.currentSessionId,
        sessionPersistence: !!this.sessionState
      };

    } catch (error) {
      logger.error('[ContextPressureMonitor] Failed to initialize MemoryProxy', {
        error: error.message
      });
      return {
        success: false,
        error: error.message,
        governanceRulesLoaded: 0
      };
    }
  }

  /**
   * Calculate current pressure level
   * @param {Object} context - Current conversation/session context
   * @returns {Object} Pressure analysis
   */
  analyzePressure(context) {
    try {
      // Calculate individual metric scores
      const metricScores = {
        tokenUsage: this._calculateTokenPressure(context),
        conversationLength: this._calculateConversationPressure(context),
        taskComplexity: this._calculateComplexityPressure(context),
        errorFrequency: this._calculateErrorPressure(context),
        instructionDensity: this._calculateInstructionPressure(context)
      };

      // Calculate weighted overall pressure score
      const overallPressure = this._calculateOverallPressure(metricScores);

      // Determine pressure level (returns string like 'NORMAL')
      const pressureName = this._determinePressureLevel(overallPressure);
      const pressureLevel = this.pressureLevels[pressureName];

      // Generate recommendations
      const recommendations = this._generateRecommendations(
        pressureLevel,
        metricScores,
        context
      );

      // Create simple recommendation strings for test compatibility
      const recommendationStrings = recommendations.map(r => r.action || r.type);

      const analysis = {
        overallPressure,
        overall_score: overallPressure,
        pressureLevel: pressureLevel.level,
        level: pressureName,
        pressureName,
        description: pressureLevel.description,
        action: pressureLevel.action,
        verificationMultiplier: pressureLevel.verificationMultiplier,
        metrics: metricScores,
        recommendations: recommendationStrings, // Simple array for test compatibility
        detailed_recommendations: recommendations, // Full objects for actual use
        warnings: recommendations
          .filter(r => r.severity === 'HIGH' || r.severity === 'CRITICAL')
          .map(r => r.message),
        risks: recommendations
          .filter(r => r.type === 'RISK')
          .map(r => r.message),
        timestamp: new Date()
      };

      // Track statistics
      this.stats.total_analyses++;
      this.stats.by_level[pressureName]++;

      // Add to pressure history
      this.pressureHistory.unshift(analysis);
      if (this.pressureHistory.length > this.maxPressureHistory) {
        this.pressureHistory = this.pressureHistory.slice(0, this.maxPressureHistory);
      }

      // Detect trends
      if (this.pressureHistory.length >= 3) {
        const recent = this.pressureHistory.slice(0, 3);
        const scores = recent.map(p => p.overallPressure);
        if (scores[0] > scores[1] && scores[1] > scores[2]) {
          analysis.trend = 'escalating';
          analysis.warnings.push('Pressure is escalating rapidly');
        } else if (scores[0] < scores[1] && scores[1] < scores[2]) {
          analysis.trend = 'improving';
        } else {
          analysis.trend = 'stable';
        }
      }

      // Log if pressure is elevated
      if (pressureLevel.level >= PRESSURE_LEVELS.ELEVATED.level) {
        logger.warn('Elevated context pressure detected', {
          level: pressureLevel.level,
          pressure: overallPressure,
          topMetric: this._getTopMetric(metricScores)
        });
      }

      // Audit pressure analysis
      this._auditPressureAnalysis(analysis, context);

      // Persist to MongoDB if session state active
      if (this.sessionState) {
        this._persistPressureState(analysis).catch(error => {
          logger.error('[ContextPressureMonitor] Failed to persist pressure state', {
            error: error.message
          });
        });
      }

      return analysis;

    } catch (error) {
      logger.error('Pressure analysis error:', error);
      return this._defaultPressureAnalysis();
    }
  }

  /**
   * Record an error for error frequency tracking
   */
  recordError(error) {
    const errorType = error.type || 'unknown';

    this.errorHistory.push({
      timestamp: new Date(),
      error: error.message || String(error),
      type: errorType
    });

    // Track error statistics
    this.stats.total_errors++;
    if (!this.stats.error_types[errorType]) {
      this.stats.error_types[errorType] = 0;
    }
    this.stats.error_types[errorType]++;

    // Maintain history limit
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift();
    }

    logger.debug('Error recorded in pressure monitor', {
      recentErrors: this.errorHistory.length,
      type: errorType
    });

    // Persist error to session state
    if (this.sessionState) {
      this.sessionState.addError(error).catch(err => {
        logger.error('[ContextPressureMonitor] Failed to persist error to session state', {
          error: err.message
        });
      });
    }

    // Check for error clustering
    const recentErrors = this.errorHistory.filter(e =>
      (new Date() - e.timestamp) < 60000 // Last minute
    );

    if (recentErrors.length >= 5) {
      logger.warn('Error clustering detected', {
        count: recentErrors.length,
        timeWindow: '1 minute'
      });
    }
  }

  /**
   * Check if action should proceed given current pressure
   */
  shouldProceed(action, context) {
    const analysis = this.analyzePressure(context);

    if (analysis.pressureLevel >= PRESSURE_LEVELS.DANGEROUS.level) {
      return {
        proceed: false,
        reason: 'Dangerous pressure level - human intervention required',
        analysis
      };
    }

    if (analysis.pressureLevel >= PRESSURE_LEVELS.CRITICAL.level) {
      return {
        proceed: true,
        requireVerification: true,
        reason: 'Critical pressure - mandatory verification required',
        analysis
      };
    }

    return {
      proceed: true,
      requireVerification: analysis.pressureLevel >= PRESSURE_LEVELS.HIGH.level,
      reason: 'Acceptable pressure level',
      analysis
    };
  }

  /**
   * Private methods
   */

  _calculateTokenPressure(context) {
    // Support both camelCase and snake_case
    let tokenUsage = context.tokenUsage || context.token_usage || 0;
    const tokenBudget = context.tokenBudget || context.token_limit || 200000;

    // Handle negative values
    if (tokenUsage < 0) {
      tokenUsage = 0;
    }

    // Determine if tokenUsage is a ratio or absolute count
    let ratio;
    if (tokenUsage <= 2.0) {
      // Values <= 2.0 are treated as ratios (allows for over-budget like 1.5 = 150%)
      ratio = tokenUsage;
    } else {
      // Values > 2.0 are treated as absolute token counts
      ratio = tokenUsage / tokenBudget;
    }

    // Use ratio directly as normalized score (don't divide by criticalThreshold)
    const normalized = Math.min(1.0, Math.max(0.0, ratio));

    return {
      value: ratio,
      score: normalized, // Alias for test compatibility
      normalized,
      raw: tokenUsage <= 2.0 ? tokenUsage * tokenBudget : tokenUsage,
      budget: tokenBudget,
      percentage: (ratio * 100).toFixed(1)
    };
  }

  _calculateConversationPressure(context) {
    // Support multiple field names for conversation length
    const messageCount = context.messageCount ||
                        context.messages?.length ||
                        context.conversation_length ||
                        context.messages_count ||
                        0;

    const ratio = messageCount / this.metrics.CONVERSATION_LENGTH.criticalThreshold;
    const normalized = Math.min(1.0, ratio);

    return {
      value: ratio,
      score: normalized, // Alias for test compatibility
      normalized,
      raw: messageCount,
      threshold: this.metrics.CONVERSATION_LENGTH.criticalThreshold
    };
  }

  _calculateComplexityPressure(context) {
    // Calculate complexity from multiple factors
    let complexityScore = 0;
    const factors = [];

    // Task depth (how many nested levels)
    const taskDepth = context.task_depth || 0;
    if (taskDepth >= 3) {
      complexityScore += taskDepth * 0.8;
      factors.push('high task depth');
    } else if (taskDepth >= 2) {
      complexityScore += taskDepth * 0.5;
    } else {
      complexityScore += taskDepth * 0.3;
    }

    // Dependencies
    const dependencies = context.dependencies || 0;
    if (dependencies >= 8) {
      complexityScore += dependencies * 0.3;
      factors.push('many dependencies');
    } else {
      complexityScore += dependencies * 0.2;
    }

    // File modifications
    const fileModifications = context.file_modifications || 0;
    if (fileModifications >= 10) {
      complexityScore += fileModifications * 0.15;
      factors.push('many file modifications');
    } else {
      complexityScore += fileModifications * 0.1;
    }

    // Concurrent operations
    const concurrentOps = context.concurrent_operations || 0;
    if (concurrentOps >= 5) {
      complexityScore += concurrentOps * 0.4;
      factors.push('high concurrency');
    } else {
      complexityScore += concurrentOps * 0.2;
    }

    // Subtasks pending
    const subtasks = context.subtasks_pending || 0;
    if (subtasks >= 10) {
      complexityScore += subtasks * 0.2;
      factors.push('many pending subtasks');
    } else {
      complexityScore += subtasks * 0.1;
    }

    // Fallback to simple task count if no factors
    if (complexityScore === 0) {
      const taskCount = context.activeTasks?.length || context.taskComplexity || 1;
      complexityScore = taskCount;
    }

    const ratio = complexityScore / this.metrics.TASK_COMPLEXITY.criticalThreshold;
    const normalized = Math.min(1.0, ratio);

    return {
      value: ratio,
      score: normalized, // Alias for test compatibility
      normalized,
      raw: complexityScore,
      threshold: this.metrics.TASK_COMPLEXITY.criticalThreshold,
      factors: factors.length > 0 ? factors : undefined
    };
  }

  _calculateErrorPressure(context) {
    // Check for explicit error count in context first
    let recentErrors = context.errors_recent || context.errors_last_hour || 0;

    // If not provided, count from error history (last 10 minutes)
    if (recentErrors === 0 && this.errorHistory.length > 0) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      recentErrors = this.errorHistory.filter(
        e => new Date(e.timestamp) > tenMinutesAgo
      ).length;
    }

    const ratio = recentErrors / this.metrics.ERROR_FREQUENCY.criticalThreshold;
    const normalized = Math.min(1.0, ratio);

    return {
      value: ratio,
      score: normalized, // Alias for test compatibility
      normalized,
      raw: recentErrors,
      recent_errors: recentErrors, // Alias for test compatibility
      threshold: this.metrics.ERROR_FREQUENCY.criticalThreshold,
      total: this.errorHistory.length
    };
  }

  _calculateInstructionPressure(context) {
    const instructionCount = context.activeInstructions?.length || 0;
    const ratio = instructionCount / this.metrics.INSTRUCTION_DENSITY.criticalThreshold;
    const normalized = Math.min(1.0, ratio);

    return {
      value: ratio,
      score: normalized, // Alias for test compatibility
      normalized,
      raw: instructionCount,
      threshold: this.metrics.INSTRUCTION_DENSITY.criticalThreshold
    };
  }

  _calculateOverallPressure(metricScores) {
    // Calculate weighted average based on configured weights
    // This properly prioritizes token usage (35%) over other metrics
    let weightedPressure = 0;
    weightedPressure += metricScores.tokenUsage.normalized * this.metrics.TOKEN_USAGE.weight;
    weightedPressure += metricScores.conversationLength.normalized * this.metrics.CONVERSATION_LENGTH.weight;
    weightedPressure += metricScores.taskComplexity.normalized * this.metrics.TASK_COMPLEXITY.weight;
    weightedPressure += metricScores.errorFrequency.normalized * this.metrics.ERROR_FREQUENCY.weight;
    weightedPressure += metricScores.instructionDensity.normalized * this.metrics.INSTRUCTION_DENSITY.weight;

    // Use weighted average as the pressure score
    // The configured weights already reflect relative importance of each metric
    return Math.min(1.0, Math.max(0.0, weightedPressure));
  }

  _generateRecommendations(pressureLevel, metricScores, context) {
    const recommendations = [];

    // Add baseline recommendation based on pressure level
    switch (pressureLevel.level) {
      case 0: // NORMAL
        recommendations.push({
          type: 'GENERAL',
          severity: 'NORMAL',
          message: 'Continue normal operations',
          action: 'CONTINUE_NORMAL'
        });
        break;
      case 1: // ELEVATED
        recommendations.push({
          type: 'GENERAL',
          severity: 'MEDIUM',
          message: 'Increase verification level',
          action: 'INCREASE_VERIFICATION'
        });
        break;
      case 2: // HIGH
        recommendations.push({
          type: 'GENERAL',
          severity: 'HIGH',
          message: 'Suggest context refresh',
          action: 'SUGGEST_CONTEXT_REFRESH'
        });
        break;
      case 3: // CRITICAL
        recommendations.push({
          type: 'GENERAL',
          severity: 'CRITICAL',
          message: 'Mandatory verification required',
          action: 'MANDATORY_VERIFICATION'
        });
        break;
      case 4: // DANGEROUS
        recommendations.push({
          type: 'GENERAL',
          severity: 'CRITICAL',
          message: 'Immediate halt required',
          action: 'IMMEDIATE_HALT'
        });
        break;
    }

    // Token usage recommendations
    if (metricScores.tokenUsage.normalized >= 0.95) {
      // IMMEDIATE_HALT already added above for DANGEROUS level
      if (pressureLevel.level < 4) {
        recommendations.push({
          type: 'TOKEN_MANAGEMENT',
          severity: 'CRITICAL',
          message: 'Token budget at dangerous levels - immediate halt required',
          action: 'IMMEDIATE_HALT'
        });
      }
    } else if (metricScores.tokenUsage.normalized > 0.8) {
      recommendations.push({
        type: 'TOKEN_MANAGEMENT',
        severity: 'HIGH',
        message: 'Token budget critically low - consider context refresh',
        action: 'Summarize conversation and start new context window'
      });
    } else if (metricScores.tokenUsage.normalized > 0.6) {
      recommendations.push({
        type: 'TOKEN_MANAGEMENT',
        severity: 'MEDIUM',
        message: 'Token usage elevated - monitor carefully',
        action: 'Be concise in responses, consider pruning context if needed'
      });
    }

    // Conversation length recommendations
    if (metricScores.conversationLength.normalized > 0.8) {
      recommendations.push({
        type: 'CONVERSATION_MANAGEMENT',
        severity: 'HIGH',
        message: 'Very long conversation - attention may degrade',
        action: 'Consider summarizing progress and starting fresh session'
      });
    }

    // Error frequency recommendations
    if (metricScores.errorFrequency.normalized > 0.6) {
      recommendations.push({
        type: 'ERROR_MANAGEMENT',
        severity: 'HIGH',
        message: 'High error frequency detected - operating conditions degraded',
        action: 'Increase verification, slow down, consider pausing for review'
      });
    }

    // Task complexity recommendations
    if (metricScores.taskComplexity.normalized > 0.7) {
      recommendations.push({
        type: 'COMPLEXITY_MANAGEMENT',
        severity: 'MEDIUM',
        message: 'High task complexity - risk of context confusion',
        action: 'Focus on one task at a time, explicitly track task switching'
      });
    }

    // Instruction density recommendations
    if (metricScores.instructionDensity.normalized > 0.7) {
      recommendations.push({
        type: 'INSTRUCTION_MANAGEMENT',
        severity: 'MEDIUM',
        message: 'Many active instructions - risk of conflicts',
        action: 'Review and consolidate instructions, resolve conflicts'
      });
    }

    // Overall pressure recommendations
    if (pressureLevel.level >= PRESSURE_LEVELS.CRITICAL.level) {
      recommendations.push({
        type: 'GENERAL',
        severity: 'CRITICAL',
        message: 'Critical pressure level - degraded performance likely',
        action: 'Strongly recommend context refresh or human intervention'
      });
    }

    return recommendations;
  }

  _getTopMetric(metricScores) {
    const scores = [
      { name: 'tokenUsage', score: metricScores.tokenUsage.normalized },
      { name: 'conversationLength', score: metricScores.conversationLength.normalized },
      { name: 'taskComplexity', score: metricScores.taskComplexity.normalized },
      { name: 'errorFrequency', score: metricScores.errorFrequency.normalized },
      { name: 'instructionDensity', score: metricScores.instructionDensity.normalized }
    ];

    scores.sort((a, b) => b.score - a.score);
    return scores[0].name;
  }

  _defaultPressureAnalysis() {
    return {
      overallPressure: 0.5,
      overall_score: 0.5,
      pressureLevel: 1,
      level: 'ELEVATED',
      pressureName: 'ELEVATED',
      description: 'Unable to analyze pressure, using safe defaults',
      action: 'INCREASE_VERIFICATION',
      verificationMultiplier: 1.5,
      metrics: {},
      recommendations: [{
        type: 'ERROR',
        severity: 'HIGH',
        message: 'Pressure analysis failed - proceeding with caution',
        action: 'Increase verification and monitoring'
      }],
      warnings: ['Pressure analysis failed - proceeding with caution'],
      risks: [],
      timestamp: new Date()
    };
  }

  /**
   * Determine pressure level from score (exposed for testing)
   * @param {number} score - Overall pressure score (0-1)
   * @returns {string} Pressure level name
   */
  _determinePressureLevel(score) {
    if (score >= PRESSURE_LEVELS.DANGEROUS.threshold) return 'DANGEROUS';
    if (score >= PRESSURE_LEVELS.CRITICAL.threshold) return 'CRITICAL';
    if (score >= PRESSURE_LEVELS.HIGH.threshold) return 'HIGH';
    if (score >= PRESSURE_LEVELS.ELEVATED.threshold) return 'ELEVATED';
    return 'NORMAL';
  }

  /**
   * Get pressure history
   * @param {boolean} fromDatabase - Load from database instead of memory
   * @returns {Promise<Array>|Array} Pressure analysis history
   */
  getPressureHistory(fromDatabase = false) {
    if (fromDatabase && this.sessionState) {
      return Promise.resolve(this.sessionState.pressureHistory);
    }
    return [...this.pressureHistory];
  }

  /**
   * Load session state from MongoDB
   * @param {string} sessionId - Session ID to load
   * @returns {Promise<Object>} Loaded session state
   */
  async loadSessionState(sessionId) {
    try {
      this.currentSessionId = sessionId;
      this.sessionState = await SessionState.findActiveSession(sessionId);

      if (!this.sessionState) {
        logger.warn('[ContextPressureMonitor] No active session found, creating new', {
          sessionId
        });
        this.sessionState = await SessionState.findOrCreate(sessionId);
      }

      // Restore in-memory state from database
      this.stats.total_analyses = this.sessionState.totalAnalyses;
      this.stats.total_errors = this.sessionState.totalErrors;
      this.stats.by_level = { ...this.sessionState.levelStats };

      // Restore error history
      this.errorHistory = this.sessionState.errorHistory.map(e => ({
        timestamp: e.timestamp,
        error: e.error,
        type: e.type
      }));

      // Restore pressure history
      this.pressureHistory = this.sessionState.pressureHistory.map(p => ({
        overallPressure: p.overallScore,
        level: p.pressureLevel,
        trend: p.trend,
        warnings: p.warnings,
        timestamp: p.timestamp
      }));

      logger.info('[ContextPressureMonitor] Session state loaded from MongoDB', {
        sessionId,
        totalAnalyses: this.stats.total_analyses,
        currentPressure: this.sessionState.currentPressure.pressureLevel
      });

      return this.sessionState.getSummary();

    } catch (error) {
      logger.error('[ContextPressureMonitor] Failed to load session state', {
        error: error.message,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Close current session
   * @returns {Promise<void>}
   */
  async closeSession() {
    if (this.sessionState) {
      await this.sessionState.close();
      logger.info('[ContextPressureMonitor] Session closed', {
        sessionId: this.currentSessionId
      });
      this.sessionState = null;
      this.currentSessionId = null;
    }
  }

  /**
   * Persist pressure state to MongoDB (async)
   * @private
   */
  async _persistPressureState(analysis) {
    if (!this.sessionState) {
      return;
    }

    try {
      await this.sessionState.updatePressure(analysis);
    } catch (error) {
      logger.error('[ContextPressureMonitor] Failed to update session state', {
        error: error.message,
        sessionId: this.currentSessionId
      });
      throw error;
    }
  }

  /**
   * Audit pressure analysis to MemoryProxy
   * @private
   */
  _auditPressureAnalysis(analysis, context = {}) {
    if (!this.memoryProxyInitialized) {
      return;
    }

    const violations = analysis.warnings || [];

    this.memoryProxy.auditDecision({
      sessionId: context.sessionId || 'pressure-monitor',
      action: 'context_pressure_analysis',
      rulesChecked: this.governanceRules.map(r => r.id),
      violations,
      allowed: analysis.pressureLevel < PRESSURE_LEVELS.DANGEROUS.level,
      metadata: {
        overall_pressure: analysis.overallPressure,
        pressure_level: analysis.pressureName,
        pressure_level_numeric: analysis.pressureLevel,
        action_required: analysis.action,
        verification_multiplier: analysis.verificationMultiplier,
        trend: analysis.trend,
        metrics: {
          token_usage: analysis.metrics.tokenUsage?.normalized,
          conversation_length: analysis.metrics.conversationLength?.normalized,
          task_complexity: analysis.metrics.taskComplexity?.normalized,
          error_frequency: analysis.metrics.errorFrequency?.normalized,
          instruction_density: analysis.metrics.instructionDensity?.normalized
        },
        top_metric: this._getTopMetric(analysis.metrics),
        warnings_count: violations.length,
        recommendations_count: analysis.recommendations?.length || 0
      }
    }).catch(error => {
      logger.error('[ContextPressureMonitor] Failed to audit pressure analysis', {
        error: error.message,
        pressure: analysis.pressureName
      });
    });
  }

  /**
   * Reset monitoring state
   */
  reset() {
    this.errorHistory = [];
    this.pressureHistory = [];
    this.stats = {
      total_analyses: 0,
      total_errors: 0,
      by_level: {
        NORMAL: 0,
        ELEVATED: 0,
        HIGH: 0,
        CRITICAL: 0,
        DANGEROUS: 0
      },
      error_types: {}
    };
    logger.info('ContextPressureMonitor state reset');
  }

  /**
   * Get monitoring statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const recentErrors = this.errorHistory.filter(e =>
      (new Date() - e.timestamp) < 3600000 // Last hour
    ).length;

    return {
      ...this.stats,
      error_history_size: this.errorHistory.length,
      pressure_history_size: this.pressureHistory.length,
      recent_errors_1h: recentErrors,
      current_pressure: this.pressureHistory.length > 0
        ? this.pressureHistory[0].level
        : 'UNKNOWN',
      timestamp: new Date()
    };
  }
}

// Singleton instance
const monitor = new ContextPressureMonitor();

module.exports = monitor;
