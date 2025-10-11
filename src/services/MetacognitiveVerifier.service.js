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
 * Metacognitive Verifier Service
 * Implements AI self-verification before proposing actions
 *
 * Core Tractatus Service: Provides structured "pause and verify" mechanism
 * where AI checks its own reasoning before execution.
 *
 * Verification Checks:
 * 1. Alignment: Does action align with stated user goals?
 * 2. Coherence: Is reasoning internally consistent?
 * 3. Completeness: Are all requirements addressed?
 * 4. Safety: Could this action cause harm or confusion?
 * 5. Alternatives: Have better approaches been considered?
 */

const classifier = require('./InstructionPersistenceClassifier.service');
const validator = require('./CrossReferenceValidator.service');
const enforcer = require('./BoundaryEnforcer.service');
const monitor = require('./ContextPressureMonitor.service');
const { getMemoryProxy } = require('./MemoryProxy.service');
const VerificationLog = require('../models/VerificationLog.model');
const logger = require('../utils/logger.util');

/**
 * Verification dimensions
 */
const VERIFICATION_DIMENSIONS = {
  ALIGNMENT: {
    name: 'Alignment',
    description: 'Action aligns with user goals and explicit instructions',
    weight: 0.3,
    criticalThreshold: 0.7
  },
  COHERENCE: {
    name: 'Coherence',
    description: 'Reasoning is internally consistent and logical',
    weight: 0.2,
    criticalThreshold: 0.7
  },
  COMPLETENESS: {
    name: 'Completeness',
    description: 'All requirements and constraints addressed',
    weight: 0.2,
    criticalThreshold: 0.8
  },
  SAFETY: {
    name: 'Safety',
    description: 'Action will not cause harm, confusion, or data loss',
    weight: 0.2,
    criticalThreshold: 0.9
  },
  ALTERNATIVES: {
    name: 'Alternatives',
    description: 'Better alternative approaches have been considered',
    weight: 0.1,
    criticalThreshold: 0.6
  }
};

/**
 * Confidence levels
 */
const CONFIDENCE_LEVELS = {
  HIGH: { min: 0.8, action: 'PROCEED', description: 'High confidence, proceed' },
  MEDIUM: { min: 0.6, action: 'PROCEED_WITH_CAUTION', description: 'Medium confidence, proceed with notification' },
  LOW: { min: 0.4, action: 'REQUEST_CONFIRMATION', description: 'Low confidence, request user confirmation' },
  VERY_LOW: { min: 0.0, action: 'REQUIRE_REVIEW', description: 'Very low confidence, require human review' }
};

class MetacognitiveVerifier {
  constructor() {
    this.dimensions = VERIFICATION_DIMENSIONS;
    this.confidenceLevels = CONFIDENCE_LEVELS;
    this.classifier = classifier;
    this.validator = validator;
    this.enforcer = enforcer;
    this.monitor = monitor;

    // Initialize MemoryProxy for governance rules and audit logging
    this.memoryProxy = getMemoryProxy();
    this.governanceRules = []; // Loaded from memory for verification reference
    this.memoryProxyInitialized = false;

    // Statistics tracking
    this.stats = {
      total_verifications: 0,
      by_decision: {
        PROCEED: 0,
        REQUEST_CONFIRMATION: 0,
        REQUEST_CLARIFICATION: 0,
        BLOCK: 0
      },
      average_confidence: 0,
      total_confidence_sum: 0
    };

    logger.info('MetacognitiveVerifier initialized');
  }

  /**
   * Initialize MemoryProxy and load governance rules
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      await this.memoryProxy.initialize();

      // Load all governance rules for verification reference
      this.governanceRules = await this.memoryProxy.loadGovernanceRules();

      this.memoryProxyInitialized = true;

      logger.info('[MetacognitiveVerifier] MemoryProxy initialized', {
        governanceRulesLoaded: this.governanceRules.length
      });

      return {
        success: true,
        governanceRulesLoaded: this.governanceRules.length
      };

    } catch (error) {
      logger.error('[MetacognitiveVerifier] Failed to initialize MemoryProxy', {
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
   * Verify a proposed action before execution
   * @param {Object} action - The proposed action
   * @param {Object} reasoning - The reasoning behind the action
   * @param {Object} context - Conversation/session context
   * @returns {Object} Verification result
   */
  verify(action, reasoning, context) {
    try {
      // Run all verification checks
      const alignmentScore = this._checkAlignment(action, reasoning, context);
      const coherenceScore = this._checkCoherence(action, reasoning, context);
      const completenessScore = this._checkCompleteness(action, reasoning, context);
      const safetyScore = this._checkSafety(action, reasoning, context);
      const alternativesScore = this._checkAlternatives(action, reasoning, context);

      // Calculate weighted confidence score
      const scores = {
        alignment: alignmentScore,
        coherence: coherenceScore,
        completeness: completenessScore,
        safety: safetyScore,
        alternatives: alternativesScore
      };

      const confidence = this._calculateConfidence(scores);

      // Determine confidence level
      const confidenceLevel = this._determineConfidenceLevel(confidence);

      // Check for critical failures
      const criticalFailures = this._checkCriticalFailures(scores);

      // Get pressure analysis
      const pressureAnalysis = this.monitor.analyzePressure(context);

      // Adjust confidence based on pressure
      const adjustedConfidence = this._adjustForPressure(
        confidence,
        pressureAnalysis
      );

      // Generate verification result
      const decision = this._makeVerificationDecision(
        adjustedConfidence,
        criticalFailures,
        pressureAnalysis,
        context
      );

      const verification = {
        confidence: adjustedConfidence,
        originalConfidence: confidence,
        level: confidenceLevel.action,
        description: confidenceLevel.description,
        checks: {
          alignment: { passed: alignmentScore.score >= 0.7, score: alignmentScore.score, issues: alignmentScore.issues || [] },
          coherence: { passed: coherenceScore.score >= 0.7, score: coherenceScore.score, issues: coherenceScore.issues || [] },
          completeness: { passed: completenessScore.score >= 0.8, score: completenessScore.score, missing_considerations: completenessScore.missing || [] },
          safety: { passed: safetyScore.score >= 0.9, score: safetyScore.score, risk_level: safetyScore.riskLevel || 'UNKNOWN', concerns: safetyScore.concerns || [] },
          alternatives: { passed: alternativesScore.score >= 0.6, score: alternativesScore.score, issues: alternativesScore.issues || [] }
        },
        scores,
        criticalFailures,
        pressureLevel: pressureAnalysis.pressureName,
        pressure_adjustment: adjustedConfidence - confidence,
        confidence_adjustment: adjustedConfidence - confidence,
        pressureAdjustment: adjustedConfidence - confidence,
        threshold_adjusted: pressureAnalysis.pressureName !== 'NORMAL' || context.pressure_level !== 'NORMAL' && context.pressure_level !== undefined,
        required_confidence: (pressureAnalysis.pressureName === 'CRITICAL' || context.pressure_level === 'CRITICAL') ? 0.8 : 0.6,
        requires_confirmation: decision === 'REQUEST_CONFIRMATION',
        recommendations: this._generateRecommendations(
          scores,
          criticalFailures,
          pressureAnalysis
        ),
        decision,
        reason: decision === 'BLOCK' && (pressureAnalysis.pressureLevel >= 4 || context.pressure_level === 'DANGEROUS')
          ? 'Operation blocked: pressure too high for safe execution'
          : (decision !== 'PROCEED' ? this._getDecisionReason(decision, scores, criticalFailures) : undefined),
        analysis: {
          failed_checks: criticalFailures.map(cf => cf.dimension),
          recommendations: this._generateRecommendations(scores, criticalFailures, pressureAnalysis)
        },
        suggestions: decision !== 'PROCEED' ? this._generateSuggestions(scores, criticalFailures) : undefined,
        timestamp: new Date()
      };

      // Track statistics
      this.stats.total_verifications++;
      this.stats.total_confidence_sum += adjustedConfidence;
      this.stats.average_confidence = this.stats.total_confidence_sum / this.stats.total_verifications;
      if (this.stats.by_decision[decision] !== undefined) {
        this.stats.by_decision[decision]++;
      }

      // Log verification
      if (verification.decision !== 'PROCEED') {
        logger.warn('Action verification flagged', {
          action: action.description?.substring(0, 50),
          decision: verification.decision,
          confidence: adjustedConfidence
        });
      }

      // Audit verification decision
      this._auditVerification(verification, action, context);

      // Persist verification to MongoDB
      this._persistVerification(verification, action, reasoning, context).catch(error => {
        logger.error('[MetacognitiveVerifier] Failed to persist verification log', {
          error: error.message
        });
      });

      return verification;

    } catch (error) {
      logger.error('Verification error:', error);
      return this._failSafeVerification(action);
    }
  }

  /**
   * Quick verification for low-risk actions
   */
  quickVerify(action, context) {
    // Simplified verification for routine actions
    const boundaryCheck = this.enforcer.enforce(action, context);
    const pressureCheck = this.monitor.shouldProceed(action, context);

    if (!boundaryCheck.allowed || !pressureCheck.proceed) {
      return {
        confidence: 0.3,
        level: 'REQUIRE_REVIEW',
        decision: 'BLOCK',
        reason: 'Failed boundary or pressure check',
        timestamp: new Date()
      };
    }

    return {
      confidence: 0.7,
      level: 'PROCEED',
      decision: 'PROCEED',
      quickCheck: true,
      timestamp: new Date()
    };
  }

  /**
   * Private verification methods
   */

  _checkAlignment(action, reasoning, context) {
    let score = 0.5; // Base score
    const issues = [];

    // Check if action parameters conflict with reasoning
    if (action.parameters && reasoning.explanation) {
      const paramConflict = this._checkParameterConflicts(action.parameters, reasoning);
      if (paramConflict) {
        score -= 0.4;
        issues.push('action parameters conflict with reasoning');
      }
    }

    // Check explicit instructions in context (27027 prevention)
    if (context.explicit_instructions && action.parameters) {
      for (const instruction of context.explicit_instructions) {
        const instructionText = instruction.text.toLowerCase();

        // Check if any parameter conflicts with explicit instruction
        for (const [key, value] of Object.entries(action.parameters)) {
          const valueStr = String(value);

          // Try to extract value from instruction: "use port 27027"
          const patterns = [
            new RegExp(`${key}\\s+(\\d+)`, 'i'),           // "port 27027"
            new RegExp(`${key}[:\\s=]+(\\d+)`, 'i')        // "port: 27027" or "port=27027"
          ];

          for (const pattern of patterns) {
            const match = instructionText.match(pattern);
            if (match) {
              if (match[1] !== valueStr) {
                score -= 0.6;  // Major penalty for violating explicit instruction
                issues.push(`Action conflicts with explicit instruction: ${instruction.text}`);
              } else {
                score += 0.5;  // Bonus for following explicit instruction correctly
              }
              break;
            }
          }
        }
      }
    }

    // Check cross-reference validation
    const validation = this.validator.validate(action, context);
    if (validation.status === 'APPROVED') {
      score += 0.3;
    } else if (validation.status === 'WARNING') {
      score += 0.1;
      issues.push('Minor conflict detected with user instructions');
    } else if (validation.status === 'REJECTED') {
      score -= 0.3;
      issues.push('Action conflicts with explicit user instructions');
    }

    // Check if action addresses stated user goal
    if (reasoning.userGoal && reasoning.addresses) {
      score += 0.2;
    }

    // Check consistency with recent user statements
    if (context.recentUserStatements) {
      const consistencyScore = this._checkConsistencyWithStatements(
        action,
        context.recentUserStatements
      );
      score += consistencyScore * 0.2;
      if (consistencyScore < 0.5) {
        issues.push('Action may not be consistent with recent user statements');
      }
    }

    return {
      score: Math.min(1.0, Math.max(0.0, score)),
      issues
    };
  }

  _checkCoherence(action, reasoning, context) {
    let score = 0.7; // Default to reasonable coherence
    const issues = [];

    // Check if reasoning steps are provided
    if (!reasoning.steps || reasoning.steps.length === 0) {
      score -= 0.2;
      issues.push('No reasoning steps provided');
    }

    // Check if evidence is explicitly empty (vs. not provided)
    if (reasoning.evidence !== undefined && reasoning.evidence.length === 0) {
      score -= 0.5;
      issues.push('No evidence provided to support reasoning');
    }

    // Check for uncertain or weak language
    const uncertainPatterns = /\b(maybe|perhaps|might|possibly|not sure|uncertain)\b/i;
    const explanationText = (reasoning.explanation || '') + ' ' + (reasoning.steps || []).join(' ');
    if (uncertainPatterns.test(explanationText)) {
      score -= 0.2;
      issues.push('Reasoning contains uncertain language');
    }

    // Check for logical consistency
    if (reasoning.assumptions && reasoning.conclusions) {
      const logicallySound = this._checkLogicalFlow(
        reasoning.assumptions,
        reasoning.conclusions
      );
      if (logicallySound) {
        score += 0.2;
      } else {
        score -= 0.3;
        issues.push('Logical inconsistency detected between assumptions and conclusions');
      }
    }

    // Check for internal contradictions
    if (this._hasContradictions(reasoning)) {
      score -= 0.4;
      issues.push('reasoning contains contradictions');
    }

    return {
      score: Math.min(1.0, Math.max(0.0, score)),
      issues
    };
  }

  _checkCompleteness(action, reasoning, context) {
    let score = 0.5; // Base score
    const missing = [];

    // Penalty for destructive operations without thorough planning
    const actionText = (action.type || '') + ' ' + (action.description || '') + ' ' + (action.command || '');
    const isDestructive = /delete|remove|drop|truncate|destroy|force/i.test(actionText) ||
      (action.parameters && (action.parameters.destructive || action.parameters.force || action.parameters.delete));

    if (isDestructive && (!reasoning.steps || reasoning.steps.length < 4)) {
      score -= 0.2;
      missing.push('Insufficient planning for destructive operation');
    }

    // Bonus if following explicit instructions (less detail needed when user explicitly instructed)
    if (context.explicit_instructions && context.explicit_instructions.length > 0) {
      score += 0.2;
    }

    // Check if reasoning has steps
    if (reasoning.steps && reasoning.steps.length > 0) {
      score += 0.2;

      // Check for quality of steps (comprehensive coverage)
      const stepCount = reasoning.steps.length;
      if (stepCount >= 4) {
        score += 0.2; // Comprehensive steps
      } else if (stepCount < 2) {
        score -= 0.1; // Too few steps
        missing.push('insufficient steps provided');
      }

      // For deployment actions, check for critical steps
      if (action.type === 'deploy' || action.parameters?.environment === 'production') {
        const stepsText = reasoning.steps.join(' ').toLowerCase();
        if (!stepsText.includes('test')) {
          missing.push('testing');
          score -= 0.2;
        }
        if (!stepsText.includes('backup')) {
          missing.push('backup');
          score -= 0.1;
        }
      }
    } else {
      missing.push('No reasoning steps provided');
      score -= 0.2;
    }

    // Check if all stated requirements are addressed
    if (context.requirements) {
      const unaddressed = context.requirements.filter(req =>
        !this._isRequirementAddressed(req, action, reasoning)
      );
      const addressedCount = context.requirements.length - unaddressed.length;
      score += (addressedCount / context.requirements.length) * 0.2;
      unaddressed.forEach(req => missing.push(`Requirement not addressed: ${req}`));
    }

    // Check for edge cases consideration
    if (reasoning.edgeCases && reasoning.edgeCases.length > 0) {
      score += 0.1;
    }

    // Check for error handling
    if (reasoning.errorHandling || action.errorHandling) {
      score += 0.1;
    }

    return {
      score: Math.min(1.0, Math.max(0.0, score)),
      missing
    };
  }

  _checkSafety(action, reasoning, context) {
    let score = 0.9; // Start with safe assumption
    const concerns = [];
    let riskLevel = 'LOW';

    // Check boundary enforcement
    const boundaryCheck = this.enforcer.enforce(action, context);
    if (!boundaryCheck.allowed) {
      score -= 0.5; // Major safety concern
      concerns.push('Action violates Tractatus boundaries');
      riskLevel = 'CRITICAL';
    }

    // Check for destructive operations in action type or description
    const destructivePatterns = [
      /delete|remove|drop|truncate/i,
      /force|--force|-f\s/i,
      /rm\s+-rf/i,
      /modify_schema|alter.*table|migrate.*database/i
    ];

    const actionText = (action.type || '') + ' ' + (action.description || '') + ' ' + (action.command || '');
    const isDestructive = destructivePatterns.some(pattern => pattern.test(actionText));

    // Check if parameters indicate destructive operation
    const hasDestructiveParams = action.parameters && (
      action.parameters.destructive === true ||
      action.parameters.force === true ||
      action.parameters.delete === true
    );

    if (isDestructive || hasDestructiveParams) {
      score -= 0.9;  // Heavy penalty for destructive operations
      concerns.push('destructive operation');
      riskLevel = 'HIGH';
    }

    // Check if data backup is mentioned for risky operations
    const stepsText = (reasoning.steps || []).join(' ').toLowerCase();
    const hasBackup = reasoning.backupMentioned || /backup/i.test(stepsText);
    if (score < 0.7 && !hasBackup) {
      score -= 0.1;
      concerns.push('No backup mentioned for risky operation');
    }

    // Check for validation before execution
    if (action.requiresValidation && !reasoning.validationPlanned) {
      score -= 0.1;
      concerns.push('No validation planned before execution');
    }

    return {
      score: Math.min(1.0, Math.max(0.0, score)),
      riskLevel,
      concerns
    };
  }

  _checkAlternatives(action, reasoning, context) {
    let score = 0.5; // Base score
    const issues = [];

    // Support both camelCase and snake_case for alternatives
    const alternatives = reasoning.alternativesConsidered || reasoning.alternatives_considered;
    const explored = reasoning.explored;

    // Check if alternatives were considered
    if (alternatives && alternatives.length > 0) {
      score += 0.3;
    } else {
      issues.push('no alternatives considered');
    }

    // Check if rationale for chosen approach is provided
    if (reasoning.chosenBecause || reasoning.chosen_because) {
      score += 0.2;
    } else {
      issues.push('no rationale provided for chosen approach');
    }

    // Lower score if action seems like first idea without exploration
    if (!alternatives && !explored) {
      score -= 0.2;
      issues.push('appears to be first idea without exploration');
    }

    return {
      score: Math.min(1.0, Math.max(0.0, score)),
      issues
    };
  }

  _calculateConfidence(scores) {
    let confidence = 0;

    for (const [dimension, dimensionConfig] of Object.entries(this.dimensions)) {
      const key = dimension.toLowerCase();
      const scoreData = scores[key];
      // Handle both object format {score: X} and legacy number format
      const score = typeof scoreData === 'object'
        ? (scoreData.score !== undefined ? scoreData.score : 0.5)
        : (scoreData !== undefined ? scoreData : 0.5);
      confidence += score * dimensionConfig.weight;
    }

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  _determineConfidenceLevel(confidence) {
    if (confidence >= CONFIDENCE_LEVELS.HIGH.min) {
      return CONFIDENCE_LEVELS.HIGH;
    }
    if (confidence >= CONFIDENCE_LEVELS.MEDIUM.min) {
      return CONFIDENCE_LEVELS.MEDIUM;
    }
    if (confidence >= CONFIDENCE_LEVELS.LOW.min) {
      return CONFIDENCE_LEVELS.LOW;
    }
    return CONFIDENCE_LEVELS.VERY_LOW;
  }

  _checkCriticalFailures(scores) {
    const failures = [];

    for (const [dimension, config] of Object.entries(this.dimensions)) {
      const key = dimension.toLowerCase();
      const scoreData = scores[key];
      // Handle both object format {score: X} and legacy number format
      const score = typeof scoreData === 'object' ? (scoreData.score || 0.5) : (scoreData || 0.5);

      if (score < config.criticalThreshold) {
        failures.push({
          dimension: config.name,
          score,
          threshold: config.criticalThreshold,
          severity: score < 0.3 ? 'CRITICAL' : 'WARNING'
        });
      }
    }

    return failures;
  }

  _adjustForPressure(confidence, pressureAnalysis) {
    // Reduce confidence based on pressure level
    const pressureReduction = {
      NORMAL: 0,
      ELEVATED: 0.05,
      HIGH: 0.10,
      CRITICAL: 0.15,
      DANGEROUS: 0.25
    };

    const reduction = pressureReduction[pressureAnalysis.pressureName] || 0;
    return Math.max(0.0, confidence - reduction);
  }

  _generateRecommendations(scores, criticalFailures, pressureAnalysis) {
    const recommendations = [];

    // Recommendations based on low scores
    for (const [key, score] of Object.entries(scores)) {
      if (score < 0.5) {
        const dimension = this.dimensions[key.toUpperCase()];
        recommendations.push({
          type: 'LOW_SCORE',
          dimension: dimension.name,
          score,
          message: `Low ${dimension.name.toLowerCase()} score - ${dimension.description}`,
          action: `Improve ${dimension.name.toLowerCase()} before proceeding`
        });
      }
    }

    // Recommendations based on critical failures
    for (const failure of criticalFailures) {
      recommendations.push({
        type: 'CRITICAL_FAILURE',
        dimension: failure.dimension,
        severity: failure.severity,
        message: `${failure.dimension} below critical threshold`,
        action: 'Address this issue before proceeding'
      });
    }

    // Include pressure recommendations
    if (pressureAnalysis.recommendations) {
      recommendations.push(...pressureAnalysis.recommendations);
    }

    return recommendations;
  }

  _makeVerificationDecision(confidence, criticalFailures, pressureAnalysis, context = {}) {
    // Block if critical failures
    if (criticalFailures.some(f => f.severity === 'CRITICAL')) {
      return 'BLOCK';
    }

    // Block if dangerous pressure (check both analyzed level and explicit context)
    if (pressureAnalysis.pressureLevel >= 4 || context.pressure_level === 'DANGEROUS') {
      return 'BLOCK';
    }

    // Require review if very low confidence
    if (confidence < 0.4) {
      return 'REQUIRE_REVIEW';
    }

    // Request confirmation if low confidence
    if (confidence < 0.6) {
      return 'REQUEST_CONFIRMATION';
    }

    // Proceed with caution if medium confidence
    if (confidence < 0.8) {
      return 'PROCEED_WITH_CAUTION';
    }

    // Proceed if high confidence
    return 'PROCEED';
  }

  /**
   * Helper methods
   */

  _checkConsistencyWithStatements(action, statements) {
    // Simplified consistency check
    return 0.5; // Default to neutral
  }

  _checkLogicalFlow(assumptions, conclusions) {
    // Simplified logical flow check
    return true; // Assume logical unless obviously not
  }

  _hasContradictions(reasoning) {
    // Check for contradictory statements in reasoning
    if (!reasoning.explanation && !reasoning.steps) {
      return false;
    }

    const text = (reasoning.explanation || '') + ' ' + (reasoning.steps || []).join(' ');
    const lower = text.toLowerCase();

    // Simple contradiction patterns
    const contradictionPatterns = [
      [/should use/i, /should not use/i],
      [/will use/i, /will not use/i],
      [/must.*true/i, /must.*false/i],
      [/enable/i, /disable/i]
    ];

    for (const [pattern1, pattern2] of contradictionPatterns) {
      if (pattern1.test(text) && pattern2.test(text)) {
        return true;
      }
    }

    // Check for conflicting technologies/frameworks
    const conflictingPairs = [
      ['react', 'vue'],
      ['angular', 'react'],
      ['angular', 'vue'],
      ['mysql', 'postgresql'],
      ['mongodb', 'sql']
    ];

    for (const [tech1, tech2] of conflictingPairs) {
      // If both conflicting technologies appear in the reasoning, that's a contradiction
      if (lower.includes(tech1) && lower.includes(tech2)) {
        return true;
      }
    }

    return false;
  }

  _checkParameterConflicts(parameters, reasoning) {
    // Check if parameter values in action conflict with reasoning
    const reasoningText = (reasoning.explanation || '') + ' ' + (reasoning.evidence || []).join(' ');

    for (const [key, value] of Object.entries(parameters)) {
      const valueStr = String(value);

      // Try explicit assignment pattern first: "key: value" or "key = value"
      const explicitPattern = new RegExp(`\\b${key}\\s*[:=]\\s*([\\w.-]+)`, 'i');
      const explicitMatch = reasoningText.match(explicitPattern);

      if (explicitMatch && explicitMatch[1] !== valueStr) {
        return true; // Conflict in explicit assignment
      }

      // For numeric values, also check natural language pattern: "key value"
      // This catches "port 27027" but avoids false positives like "file read"
      if (!explicitMatch && /^\d+$/.test(valueStr)) {
        const naturalPattern = new RegExp(`\\b${key}\\s+(\\d+)`, 'i');
        const naturalMatch = reasoningText.match(naturalPattern);

        if (naturalMatch && naturalMatch[1] !== valueStr) {
          return true; // Conflict in natural language (numeric values)
        }
      }
    }

    return false;
  }

  _isRequirementAddressed(requirement, action, reasoning) {
    // Simplified requirement matching
    const actionText = (action.description || '').toLowerCase();
    const requirementText = requirement.toLowerCase();
    return actionText.includes(requirementText);
  }

  _failSafeVerification(action) {
    return {
      confidence: 0.3,
      originalConfidence: 0.3,
      level: 'REQUIRE_REVIEW',
      description: 'Verification failed, requiring human review',
      decision: 'BLOCK',
      checks: {
        alignment: { passed: false, score: 0, issues: ['verification error'] },
        coherence: { passed: false, score: 0, issues: ['verification error'] },
        completeness: { passed: false, score: 0, missing_considerations: ['verification error'] },
        safety: { passed: false, score: 0, risk_level: 'HIGH', concerns: ['verification error'] },
        alternatives: { passed: false, score: 0, issues: ['verification error'] }
      },
      scores: {},
      criticalFailures: [{
        dimension: 'ERROR',
        score: 0,
        threshold: 1,
        severity: 'CRITICAL'
      }],
      pressureLevel: 'ELEVATED',
      pressureAdjustment: 0,
      recommendations: [{
        type: 'ERROR',
        severity: 'CRITICAL',
        message: 'Verification process encountered error',
        action: 'Require human review before proceeding'
      }],
      timestamp: new Date()
    };
  }

  /**
   * Get decision reason (exposed for tests)
   */
  _getDecisionReason(decision, scores, criticalFailures) {
    if (decision === 'BLOCK') {
      return 'Critical failures detected: ' + criticalFailures.map(cf => cf.dimension).join(', ');
    }
    if (decision === 'REQUEST_CLARIFICATION') {
      return 'Low confidence in alignment or completeness';
    }
    if (decision === 'REQUEST_CONFIRMATION') {
      return 'Moderate confidence, user confirmation recommended';
    }
    return 'Proceeding with high confidence';
  }

  /**
   * Generate suggestions for improvement (exposed for tests)
   */
  _generateSuggestions(scores, criticalFailures) {
    const suggestions = [];

    if (scores.alignment && scores.alignment.score < 0.7) {
      suggestions.push('Clarify how this action aligns with user goals');
    }
    if (scores.coherence && scores.coherence.score < 0.7) {
      suggestions.push('Review reasoning for logical consistency');
    }
    if (scores.completeness && scores.completeness.score < 0.8) {
      suggestions.push('Ensure all requirements are addressed');
    }
    if (scores.safety && scores.safety.score < 0.9) {
      suggestions.push('Verify safety implications of this action');
    }
    if (scores.alternatives && scores.alternatives.score < 0.6) {
      suggestions.push('Consider alternative approaches');
    }

    return suggestions;
  }

  /**
   * Assess evidence quality (exposed for tests)
   */
  _assessEvidenceQuality(reasoning) {
    if (!reasoning || !reasoning.evidence) return 0.0;

    const evidence = reasoning.evidence;
    if (!Array.isArray(evidence) || evidence.length === 0) return 0.0;

    let qualityScore = 0;

    // Check for explicit user instructions
    const hasExplicit = evidence.some(e =>
      typeof e === 'string' && /user\s+(explicitly|specifically|said|requested|instructed)/i.test(e)
    );
    if (hasExplicit) qualityScore += 0.4;

    // Check for documentation references
    const hasDocs = evidence.some(e =>
      typeof e === 'string' && /documentation|docs|spec|standard/i.test(e)
    );
    if (hasDocs) qualityScore += 0.3;

    // Check for testing/validation
    const hasValidation = evidence.some(e =>
      typeof e === 'string' && /test|validate|verify|confirm/i.test(e)
    );
    if (hasValidation) qualityScore += 0.3;

    // Penalize weak evidence
    const hasWeak = evidence.some(e =>
      typeof e === 'string' && /think|maybe|probably|assume/i.test(e)
    );
    if (hasWeak) qualityScore -= 0.3;

    return Math.max(0, Math.min(1, qualityScore));
  }

  /**
   * Assess reasoning quality (exposed for tests)
   */
  _assessReasoningQuality(reasoning) {
    if (!reasoning) return 0.0;

    let score = 0;

    // Check explanation quality
    if (reasoning.explanation) {
      const length = reasoning.explanation.length;
      if (length > 100) score += 0.3;
      else if (length > 50) score += 0.1;
    }

    // Check evidence
    const evidenceScore = this._assessEvidenceQuality(reasoning);
    score += evidenceScore * 0.4;

    // Check steps
    if (reasoning.steps && Array.isArray(reasoning.steps) && reasoning.steps.length > 0) {
      score += Math.min(0.3, reasoning.steps.length * 0.1);
    }

    // Check alternatives
    if (reasoning.alternatives_considered && reasoning.alternatives_considered.length > 0) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  /**
   * Make verification decision (exposed for tests)
   */
  _makeDecision(confidence, context) {
    const pressureLevel = context.pressure_level || 'NORMAL';

    // Block at dangerous pressure regardless of confidence
    if (pressureLevel === 'DANGEROUS') {
      return { decision: 'BLOCK', requires_confirmation: true };
    }

    // Adjust thresholds based on pressure
    const proceedThreshold = pressureLevel === 'CRITICAL' ? 0.8 : 0.7;
    const confirmThreshold = pressureLevel === 'HIGH' ? 0.6 : 0.5;

    if (confidence >= proceedThreshold) {
      return { decision: 'PROCEED', requires_confirmation: false };
    } else if (confidence >= confirmThreshold) {
      return { decision: 'REQUEST_CONFIRMATION', requires_confirmation: true };
    } else if (confidence >= 0.3) {
      return { decision: 'REQUEST_CLARIFICATION', requires_confirmation: true };
    } else {
      return { decision: 'BLOCK', requires_confirmation: true };
    }
  }

  /**
   * Audit verification decision to MemoryProxy
   * @private
   */
  _auditVerification(verification, action, context = {}) {
    if (!this.memoryProxyInitialized) {
      return;
    }

    const violations = verification.criticalFailures
      ?.filter(f => f.severity === 'CRITICAL')
      .map(f => f.dimension) || [];

    this.memoryProxy.auditDecision({
      sessionId: context.sessionId || 'verifier-service',
      action: 'metacognitive_verification',
      rulesChecked: this.governanceRules.map(r => r.id),
      violations,
      allowed: verification.decision === 'PROCEED' || verification.decision === 'PROCEED_WITH_CAUTION',
      metadata: {
        action_description: action.description?.substring(0, 100),
        confidence: verification.confidence,
        original_confidence: verification.originalConfidence,
        decision: verification.decision,
        level: verification.level,
        pressure_level: verification.pressureLevel,
        pressure_adjustment: verification.pressureAdjustment,
        checks: {
          alignment: verification.checks.alignment.passed,
          coherence: verification.checks.coherence.passed,
          completeness: verification.checks.completeness.passed,
          safety: verification.checks.safety.passed,
          alternatives: verification.checks.alternatives.passed
        },
        critical_failures: violations.length,
        failed_checks: verification.analysis?.failed_checks || [],
        recommendations_count: verification.recommendations?.length || 0
      }
    }).catch(error => {
      logger.error('[MetacognitiveVerifier] Failed to audit verification', {
        error: error.message,
        action: action.description?.substring(0, 50)
      });
    });
  }

  /**
   * Persist verification to MongoDB (async)
   * @private
   */
  async _persistVerification(verification, action, reasoning, context = {}) {
    try {
      // Build action object with only defined fields
      const actionData = {};
      if (action.description) actionData.description = action.description;
      if (action.type) actionData.type = action.type;
      if (action.command) actionData.command = action.command;
      if (action.parameters) actionData.parameters = action.parameters;

      const log = await VerificationLog.create({
        sessionId: context.sessionId || 'verifier-session',
        action: actionData,
        decision: verification.decision,
        confidence: verification.confidence,
        originalConfidence: verification.originalConfidence,
        level: verification.level,
        checks: {
          alignment: {
            passed: verification.checks.alignment.passed,
            score: verification.checks.alignment.score,
            issues: verification.checks.alignment.issues || []
          },
          coherence: {
            passed: verification.checks.coherence.passed,
            score: verification.checks.coherence.score,
            issues: verification.checks.coherence.issues || []
          },
          completeness: {
            passed: verification.checks.completeness.passed,
            score: verification.checks.completeness.score,
            missing: verification.checks.completeness.missing_considerations || []
          },
          safety: {
            passed: verification.checks.safety.passed,
            score: verification.checks.safety.score,
            riskLevel: verification.checks.safety.risk_level || 'UNKNOWN',
            concerns: verification.checks.safety.concerns || []
          },
          alternatives: {
            passed: verification.checks.alternatives.passed,
            score: verification.checks.alternatives.score,
            issues: verification.checks.alternatives.issues || []
          }
        },
        criticalFailures: verification.criticalFailures || [],
        pressureLevel: verification.pressureLevel,
        pressureAdjustment: verification.pressureAdjustment || 0,
        recommendations: verification.recommendations || [],
        reasoning: {
          quality: reasoning ? this._assessReasoningQuality(reasoning) : 0,
          hasSteps: !!(reasoning && reasoning.steps && reasoning.steps.length > 0),
          hasEvidence: !!(reasoning && reasoning.evidence && reasoning.evidence.length > 0),
          hasAlternatives: !!(reasoning && (reasoning.alternativesConsidered || reasoning.alternatives_considered))
        },
        metadata: {
          actionType: action.type,
          hasParameters: !!action.parameters,
          parametersCount: action.parameters ? Object.keys(action.parameters).length : 0,
          ...context.metadata
        },
        verifiedAt: new Date()
      });

      logger.debug('[MetacognitiveVerifier] Verification logged to MongoDB', {
        logId: log._id,
        decision: log.decision,
        confidence: log.confidence
      });

      return log;

    } catch (error) {
      logger.error('[MetacognitiveVerifier] Failed to create verification log', {
        error: error.message,
        stack: error.stack,
        sessionId: context.sessionId
      });
      throw error;
    }
  }

  /**
   * Load verification history from MongoDB
   * @param {string} sessionId - Session ID to load
   * @param {number} limit - Maximum number of entries to load
   * @returns {Promise<Array>} Verification history
   */
  async loadVerificationHistory(sessionId, limit = 100) {
    try {
      const logs = await VerificationLog.findBySession(sessionId, { limit });

      logger.info('[MetacognitiveVerifier] Loaded verification history from MongoDB', {
        sessionId,
        count: logs.length
      });

      return logs.map(log => log.getSummary());

    } catch (error) {
      logger.error('[MetacognitiveVerifier] Failed to load verification history', {
        error: error.message,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Get verification statistics from MongoDB
   * @param {Date} startDate - Start date for statistics
   * @param {Date} endDate - End date for statistics
   * @returns {Promise<Object>} Statistics
   */
  async getMongoDBStats(startDate = null, endDate = null) {
    try {
      const stats = await VerificationLog.getStatistics(startDate, endDate);
      const dimensionStats = await VerificationLog.getDimensionBreakdown(startDate, endDate);

      return {
        ...stats,
        dimensionBreakdown: dimensionStats,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('[MetacognitiveVerifier] Failed to get MongoDB statistics', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find low-confidence verifications
   * @param {number} threshold - Confidence threshold (default 0.6)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Low-confidence verifications
   */
  async findLowConfidence(threshold = 0.6, options = {}) {
    try {
      const logs = await VerificationLog.findLowConfidence(threshold, options);

      logger.info('[MetacognitiveVerifier] Found low-confidence verifications', {
        count: logs.length,
        threshold
      });

      return logs.map(log => log.getSummary());

    } catch (error) {
      logger.error('[MetacognitiveVerifier] Failed to find low-confidence verifications', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mark verification as executed
   * @param {string} logId - Verification log ID
   * @param {string} outcome - Execution outcome
   * @param {string} notes - Execution notes
   * @returns {Promise<Object>} Updated log
   */
  async markExecuted(logId, outcome, notes = '') {
    try {
      const log = await VerificationLog.findById(logId);
      if (!log) {
        throw new Error(`Verification log not found: ${logId}`);
      }

      await log.markExecuted(outcome, notes);

      logger.info('[MetacognitiveVerifier] Marked verification as executed', {
        logId,
        outcome
      });

      return log.getSummary();

    } catch (error) {
      logger.error('[MetacognitiveVerifier] Failed to mark verification as executed', {
        error: error.message,
        logId
      });
      throw error;
    }
  }

  /**
   * Get verification statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      timestamp: new Date()
    };
  }
}

// Singleton instance
const verifier = new MetacognitiveVerifier();

module.exports = verifier;
