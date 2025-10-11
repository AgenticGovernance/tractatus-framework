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
 * Cross-Reference Validator Service
 * Validates proposed AI actions against explicit user instructions
 *
 * Core Tractatus Service: Prevents the "27027 failure mode" where
 * AI actions use cached patterns instead of explicit user instructions.
 *
 * Example failure prevented:
 * - User says: "check port 27027"
 * - AI action: mongosh --port 27017 (using MongoDB default instead of explicit instruction)
 * - Validator: REJECTS action, requires using port 27027
 */

const classifier = require('./InstructionPersistenceClassifier.service');
const { getMemoryProxy } = require('./MemoryProxy.service');
const logger = require('../utils/logger.util');

/**
 * Validation result statuses
 */
const VALIDATION_STATUS = {
  APPROVED: 'APPROVED',         // No conflicts, proceed
  WARNING: 'WARNING',           // Minor conflicts, notify user
  REJECTED: 'REJECTED',         // Critical conflicts, block action
  ESCALATE: 'ESCALATE'          // Requires human judgment
};

/**
 * Conflict severity levels
 */
const CONFLICT_SEVERITY = {
  CRITICAL: 'CRITICAL',         // Explicit instruction violation
  WARNING: 'WARNING',           // Potential misalignment
  MINOR: 'MINOR',              // Acceptable deviation
  INFO: 'INFO'                 // Informational only
};

class CrossReferenceValidator {
  constructor() {
    this.classifier = classifier;
    this.lookbackWindow = 100; // How many recent messages to check
    this.relevanceThreshold = 0.3; // Minimum relevance to consider (lowered for better detection)
    this.instructionCache = new Map(); // Cache classified instructions
    this.instructionHistory = []; // Recent instruction history

    // Initialize MemoryProxy for governance rules and audit logging
    this.memoryProxy = getMemoryProxy();
    this.governanceRules = []; // Loaded from memory
    this.memoryProxyInitialized = false;

    // Statistics tracking
    this.stats = {
      total_validations: 0,
      conflicts_detected: 0,
      rejections: 0,
      approvals: 0,
      warnings: 0,
      by_severity: {
        CRITICAL: 0,
        WARNING: 0,
        MINOR: 0,
        INFO: 0
      }
    };

    logger.info('CrossReferenceValidator initialized');
  }

  /**
   * Initialize MemoryProxy and load governance rules
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      await this.memoryProxy.initialize();

      // Load all governance rules for validation reference
      this.governanceRules = await this.memoryProxy.loadGovernanceRules();

      this.memoryProxyInitialized = true;

      logger.info('[CrossReferenceValidator] MemoryProxy initialized', {
        governanceRulesLoaded: this.governanceRules.length
      });

      return {
        success: true,
        governanceRulesLoaded: this.governanceRules.length
      };

    } catch (error) {
      logger.error('[CrossReferenceValidator] Failed to initialize MemoryProxy', {
        error: error.message
      });
      // Continue with existing validation logic even if memory fails
      return {
        success: false,
        error: error.message,
        governanceRulesLoaded: 0
      };
    }
  }

  /**
   * Validate a proposed action against conversation context
   * @param {Object} action - The proposed action
   * @param {Object} context - Conversation context with instructions
   * @returns {Object} Validation result
   */
  validate(action, context) {
    try {
      // Extract action parameters
      const actionParams = this._extractActionParameters(action);

      // Find relevant instructions from context
      const relevantInstructions = this._findRelevantInstructions(
        action,
        context,
        this.lookbackWindow
      );

      if (relevantInstructions.length === 0) {
        return this._approvedResult('No relevant instructions to validate against');
      }

      // Check for conflicts with each relevant instruction
      const conflicts = [];
      for (const instruction of relevantInstructions) {
        const instructionConflicts = this._checkConflict(actionParams, instruction);
        if (instructionConflicts && instructionConflicts.length > 0) {
          conflicts.push(...instructionConflicts);
        }
      }

      // Make validation decision based on conflicts
      const decision = this._makeValidationDecision(conflicts, action);

      // Audit validation decision
      this._auditValidation(decision, action, relevantInstructions, context);

      return decision;

    } catch (error) {
      logger.error('Validation error:', error);
      // Fail-safe: escalate on error
      return this._escalateResult('Validation error occurred, requiring human review');
    }
  }

  /**
   * Batch validate multiple actions
   */
  validateBatch(actions, context) {
    return actions.map(action => this.validate(action, context));
  }

  /**
   * Add instruction to cache for validation
   */
  cacheInstruction(instruction) {
    const classified = this.classifier.classify(instruction);
    const key = `${instruction.timestamp.getTime()}_${instruction.text.substring(0, 50)}`;
    this.instructionCache.set(key, classified);

    // Cleanup old entries (keep last 200)
    if (this.instructionCache.size > 200) {
      const keys = Array.from(this.instructionCache.keys());
      keys.slice(0, this.instructionCache.size - 200).forEach(k => {
        this.instructionCache.delete(k);
      });
    }

    return classified;
  }

  /**
   * Private methods
   */

  _extractActionParameters(action) {
    const params = {};

    // Common parameter types to extract
    // Note: Using [:\s=] to match both structured (port: X) and free-form (port X) text
    // This prevents false matches on unrelated text while catching explicit port mentions
    const patterns = {
      port: /port[:\s=]\s*(\d{4,5})/i,
      host: /(?:host|server)[:=]\s*([\w.-]+)/i,
      database: /(?:database|db)[:=]\s*([\w-]+)/i,
      path: /(\/[\w./-]+)/,
      url: /(https?:\/\/[\w.-]+(?::\d+)?[\w./-]*)/,
      collection: /collection[:=]\s*([\w-]+)/i,
      model: /model[:=]\s*([\w-]+)/i,
      function: /function[:=]\s*([\w-]+)/i
    };

    const description = action.description || action.command || action.text || '';

    for (const [paramType, pattern] of Object.entries(patterns)) {
      const match = description.match(pattern);
      if (match) {
        params[paramType] = match[1];
      }
    }

    // Extract from structured action data
    if (action.parameters) {
      Object.assign(params, action.parameters);
    }

    return params;
  }

  _findRelevantInstructions(action, context, lookback) {
    const instructions = [];

    // Handle two context formats:
    // 1. recent_instructions: pre-classified instructions (for testing)
    // 2. messages: raw conversation messages (for production)

    if (context.recent_instructions && Array.isArray(context.recent_instructions)) {
      // Test format: use pre-classified instructions
      for (const instruction of context.recent_instructions) {
        // Calculate relevance to this action
        const relevance = this.classifier.calculateRelevance(instruction, action);

        if (relevance >= this.relevanceThreshold) {
          instructions.push({
            ...instruction,
            relevance
          });
        }
      }
    } else if (context.messages && Array.isArray(context.messages)) {
      // Production format: extract and classify messages
      const recentMessages = context.messages.slice(-lookback);

      for (const message of recentMessages) {
        if (message.role === 'user') {
          // Classify the instruction
          const classified = this.cacheInstruction({
            text: message.content,
            timestamp: message.timestamp || new Date(),
            source: 'user',
            context: context
          });

          // Calculate relevance to this action
          const relevance = this.classifier.calculateRelevance(classified, action);

          if (relevance >= this.relevanceThreshold) {
            instructions.push({
              ...classified,
              relevance,
              messageIndex: recentMessages.indexOf(message)
            });
          }
        }
      }
    }

    // Sort by relevance (highest first)
    instructions.sort((a, b) => b.relevance - a.relevance);

    logger.debug(`Found ${instructions.length} relevant instructions for action`, {
      action: action.description?.substring(0, 50),
      topRelevance: instructions[0]?.relevance
    });

    return instructions;
  }

  _checkConflict(actionParams, instruction) {
    // Extract parameters from instruction
    const instructionParams = instruction.parameters || {};
    const conflicts = [];

    // Check for parameter-level conflicts
    const commonParams = Object.keys(actionParams).filter(key =>
      instructionParams.hasOwnProperty(key)
    );

    for (const param of commonParams) {
      const actionValue = actionParams[param];
      const instructionValue = instructionParams[param];

      // Normalize for comparison
      const normalizedAction = String(actionValue).toLowerCase().trim();
      const normalizedInstruction = String(instructionValue).toLowerCase().trim();

      if (normalizedAction !== normalizedInstruction) {
        // Found a parameter conflict
        const severity = this._determineConflictSeverity(
          param,
          instruction.persistence,
          instruction.explicitness,
          instruction.recencyWeight
        );

        conflicts.push({
          parameter: param,
          actionValue,
          instructionValue,
          instruction: {
            text: instruction.text,
            timestamp: instruction.timestamp,
            quadrant: instruction.quadrant,
            persistence: instruction.persistence
          },
          severity,
          relevance: instruction.relevance,
          recencyWeight: instruction.recencyWeight
        });
      }
    }

    // Check for semantic conflicts (prohibitions in instruction text)
    // Only check if instruction has HIGH persistence (strong prohibitions)
    const instructionText = (instruction.text || '').toLowerCase();

    if (instruction.persistence === 'HIGH') {
      const prohibitionPatterns = [
        /\bnot\s+(\w+)/gi,
        /don't\s+use\s+(\w+)/gi,
        /\bavoid\s+(\w+)/gi,
        /\bnever\s+(\w+)/gi
      ];

      for (const [key, value] of Object.entries(actionParams)) {
        const valueStr = String(value).toLowerCase();

        // Check if instruction prohibits this value
        for (const pattern of prohibitionPatterns) {
          const matches = instructionText.matchAll(pattern);
          for (const match of matches) {
            const prohibitedItem = match[1].toLowerCase();
            if (valueStr.includes(prohibitedItem) || prohibitedItem.includes(valueStr)) {
              // Found a semantic conflict
              const severity = CONFLICT_SEVERITY.CRITICAL; // HIGH persistence prohibitions are always CRITICAL

              conflicts.push({
                parameter: key,
                actionValue: value,
                instructionValue: `prohibited: ${prohibitedItem}`,
                instruction: {
                  text: instruction.text,
                  timestamp: instruction.timestamp,
                  quadrant: instruction.quadrant,
                  persistence: instruction.persistence
                },
                severity,
                relevance: instruction.relevance || 0.9,
                recencyWeight: instruction.recencyWeight || 0.9,
                type: 'prohibition'
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  _determineConflictSeverity(param, persistence, explicitness, recencyWeight) {
    // Critical severity conditions
    if (persistence === 'HIGH' && explicitness > 0.8) {
      return CONFLICT_SEVERITY.CRITICAL;
    }

    // HIGH persistence alone should be WARNING at minimum
    if (persistence === 'HIGH') {
      return CONFLICT_SEVERITY.CRITICAL; // Changed from WARNING - HIGH persistence instructions should be enforced strictly
    }

    if (recencyWeight > 0.8 && explicitness > 0.7) {
      return CONFLICT_SEVERITY.CRITICAL;
    }

    // Important parameters that should be explicit
    const criticalParams = ['port', 'database', 'host', 'url', 'confirmed'];
    if (criticalParams.includes(param) && explicitness > 0.6) {
      return CONFLICT_SEVERITY.CRITICAL;
    }

    // Warning severity
    if (explicitness > 0.6) {
      return CONFLICT_SEVERITY.WARNING;
    }

    // Minor severity
    if (persistence === 'MEDIUM') {
      return CONFLICT_SEVERITY.WARNING;
    }

    return CONFLICT_SEVERITY.MINOR;
  }

  _makeValidationDecision(conflicts, action) {
    if (conflicts.length === 0) {
      return this._approvedResult('No conflicts detected');
    }

    // Check for critical conflicts
    const criticalConflicts = conflicts.filter(c => c.severity === CONFLICT_SEVERITY.CRITICAL);

    if (criticalConflicts.length > 0) {
      return this._rejectedResult(criticalConflicts, action);
    }

    // Check for warning-level conflicts
    const warningConflicts = conflicts.filter(c => c.severity === CONFLICT_SEVERITY.WARNING);

    if (warningConflicts.length > 0) {
      return this._warningResult(warningConflicts, action);
    }

    // Only minor conflicts
    return this._approvedResult(
      'Minor conflicts resolved in favor of user instruction',
      conflicts
    );
  }

  _approvedResult(message, conflicts = []) {
    this.stats.total_validations++;
    this.stats.approvals++;

    return {
      status: VALIDATION_STATUS.APPROVED,
      message,
      conflicts,
      action: 'PROCEED',
      timestamp: new Date()
    };
  }

  _warningResult(conflicts, action) {
    this.stats.total_validations++;
    this.stats.warnings++;
    this.stats.conflicts_detected += conflicts.length;
    conflicts.forEach(c => this.stats.by_severity[c.severity]++);

    const primaryConflict = conflicts[0];
    const timeAgo = this._formatTimeAgo(primaryConflict.instruction.timestamp);

    return {
      status: VALIDATION_STATUS.WARNING,
      message: `Potential conflict in parameter '${primaryConflict.parameter}': ` +
               `action uses '${primaryConflict.actionValue}' but user instruction ` +
               `specified '${primaryConflict.instructionValue}' (${timeAgo} ago)`,
      conflicts,
      action: 'NOTIFY_USER',
      recommendation: `Consider using '${primaryConflict.instructionValue}' instead`,
      timestamp: new Date()
    };
  }

  _rejectedResult(conflicts, action) {
    this.stats.total_validations++;
    this.stats.rejections++;
    this.stats.conflicts_detected += conflicts.length;
    conflicts.forEach(c => this.stats.by_severity[c.severity]++);

    const primaryConflict = conflicts[0];
    const timeAgo = this._formatTimeAgo(primaryConflict.instruction.timestamp);

    return {
      status: VALIDATION_STATUS.REJECTED,
      message: `CRITICAL CONFLICT: Action parameter '${primaryConflict.parameter}' ` +
               `uses '${primaryConflict.actionValue}' but user explicitly specified ` +
               `'${primaryConflict.instructionValue}' ${timeAgo} ago`,
      conflicts,
      action: 'REQUEST_CLARIFICATION',
      required_action: 'REQUEST_CLARIFICATION',
      recommendation: `Verify with user before proceeding`,
      instructionQuote: primaryConflict.instruction.text,
      requiredValue: primaryConflict.instructionValue,
      timestamp: new Date(),
      userPrompt: `I noticed a conflict:\n\n` +
                 `You instructed: "${primaryConflict.instruction.text}"\n` +
                 `But my proposed action would use ${primaryConflict.parameter}: ${primaryConflict.actionValue}\n\n` +
                 `Should I use ${primaryConflict.instructionValue} as you specified, or ${primaryConflict.actionValue}?`
    };
  }

  _escalateResult(message) {
    return {
      status: VALIDATION_STATUS.ESCALATE,
      message,
      action: 'REQUIRE_HUMAN_REVIEW',
      timestamp: new Date()
    };
  }

  _formatTimeAgo(timestamp) {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);

    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  }

  /**
   * Add instruction to history
   * @param {Object} instruction - Classified instruction
   */
  addInstruction(instruction) {
    // Add to beginning of array (most recent first)
    this.instructionHistory.unshift(instruction);

    // Keep only lookbackWindow instructions
    if (this.instructionHistory.length > this.lookbackWindow) {
      this.instructionHistory = this.instructionHistory.slice(0, this.lookbackWindow);
    }
  }

  /**
   * Get recent instructions
   * @param {number} limit - Optional limit on number of instructions
   * @returns {Array} Recent instructions
   */
  getRecentInstructions(limit = this.lookbackWindow) {
    return this.instructionHistory.slice(0, limit);
  }

  /**
   * Clear instruction history
   */
  clearInstructions() {
    this.instructionHistory = [];
    this.instructionCache.clear();
  }

  /**
   * Audit validation decision to memory (async, non-blocking)
   * @private
   */
  _auditValidation(decision, action, relevantInstructions, context = {}) {
    // Only audit if MemoryProxy is initialized
    if (!this.memoryProxyInitialized) {
      return;
    }

    // Extract violation information
    const violations = decision.conflicts
      ?.filter(c => c.severity === CONFLICT_SEVERITY.CRITICAL)
      .map(c => c.instruction?.text || c.parameter) || [];

    // Audit asynchronously (don't block validation)
    this.memoryProxy.auditDecision({
      sessionId: context.sessionId || 'validator-service',
      action: 'cross_reference_validation',
      rulesChecked: relevantInstructions.map(i => i.id || 'instruction'),
      violations,
      allowed: decision.status === VALIDATION_STATUS.APPROVED,
      metadata: {
        action_description: action.description?.substring(0, 100),
        validation_status: decision.status,
        conflicts_found: decision.conflicts?.length || 0,
        critical_conflicts: violations.length,
        relevant_instructions: relevantInstructions.length,
        validation_action: decision.action,
        conflict_details: decision.conflicts?.slice(0, 3).map(c => ({
          parameter: c.parameter,
          severity: c.severity,
          action_value: c.actionValue,
          instruction_value: c.instructionValue
        })) || []
      }
    }).catch(error => {
      logger.error('[CrossReferenceValidator] Failed to audit validation', {
        error: error.message,
        action: action.description?.substring(0, 50)
      });
    });
  }

  /**
   * Get validation statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      instruction_history_size: this.instructionHistory.length,
      cache_size: this.instructionCache.size,
      timestamp: new Date()
    };
  }
}

// Singleton instance
const validator = new CrossReferenceValidator();

module.exports = validator;
