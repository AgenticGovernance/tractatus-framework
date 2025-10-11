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
 * Boundary Enforcer Service
 * Ensures AI never makes values decisions without human approval
 *
 * Core Tractatus Service: Implements Tractatus 12.1-12.7 boundaries
 * where AI architecturally acknowledges domains requiring human judgment.
 *
 * Tractatus Boundaries:
 * 12.1 Values cannot be automated, only verified.
 * 12.2 Innovation cannot be proceduralized, only facilitated.
 * 12.3 Wisdom cannot be encoded, only supported.
 * 12.4 Purpose cannot be generated, only preserved.
 * 12.5 Meaning cannot be computed, only recognized.
 * 12.6 Agency cannot be simulated, only respected.
 * 12.7 Whereof one cannot systematize, thereof one must trust human judgment.
 */

const classifier = require('./InstructionPersistenceClassifier.service');
const logger = require('../utils/logger.util');
const { getMemoryProxy } = require('./MemoryProxy.service');

/**
 * Tractatus decision boundaries
 * These domains ALWAYS require human judgment
 */
const TRACTATUS_BOUNDARIES = {
  VALUES: {
    section: '12.1',
    principle: 'Values cannot be automated, only verified',
    humanRequired: true,
    keywords: ['value', 'principle', 'ethic', 'moral', 'should', 'ought', 'right', 'wrong',
               'privacy', 'policy', 'trade-off', 'tradeoff', 'prioritize', 'priority',
               'belief', 'virtue', 'integrity', 'fairness', 'justice'],
    examples: [
      'Decide whether to prioritize privacy over convenience',
      'Determine our core values',
      'Choose what principles matter most'
    ]
  },
  INNOVATION: {
    section: '12.2',
    principle: 'Innovation cannot be proceduralized, only facilitated',
    humanRequired: true,
    keywords: ['innovate', 'create', 'invent', 'breakthrough', 'novel', 'creative',
               'architectural', 'architecture', 'design', 'fundamental', 'revolutionary', 'transform'],
    examples: [
      'Create entirely new approach',
      'Invent solution to fundamental problem',
      'Generate breakthrough innovation'
    ]
  },
  WISDOM: {
    section: '12.3',
    principle: 'Wisdom cannot be encoded, only supported',
    humanRequired: true,
    keywords: ['wisdom', 'judgment', 'discernment', 'prudence', 'insight',
               'strategic', 'direction', 'guidance', 'wise', 'counsel', 'experience'],
    examples: [
      'Exercise judgment in unprecedented situation',
      'Apply wisdom to complex tradeoff',
      'Discern what truly matters'
    ]
  },
  PURPOSE: {
    section: '12.4',
    principle: 'Purpose cannot be generated, only preserved',
    humanRequired: true,
    keywords: ['purpose', 'mission', 'why', 'meaning', 'goal', 'objective',
               'vision', 'intent', 'aim', 'reason for', 'raison', 'fundamental goal'],
    examples: [
      'Define our organizational purpose',
      'Determine why we exist',
      'Set our fundamental mission'
    ]
  },
  MEANING: {
    section: '12.5',
    principle: 'Meaning cannot be computed, only recognized',
    humanRequired: true,
    keywords: ['meaning', 'significance', 'importance', 'matter', 'meaningful',
               'significant', 'important', 'matters', 'valuable', 'worthwhile'],
    examples: [
      'Decide what is truly significant',
      'Determine what matters most',
      'Recognize deeper meaning'
    ]
  },
  AGENCY: {
    section: '12.6',
    principle: 'Agency cannot be simulated, only respected',
    humanRequired: true,
    keywords: ['agency', 'autonomy', 'choice', 'freedom', 'sovereignty', 'self-determination',
               'decide for', 'on behalf', 'override', 'substitute', 'replace human'],
    examples: [
      'Make autonomous decision for humans',
      'Override human choice',
      'Substitute AI judgment for human agency'
    ]
  }
};

/**
 * Decision types that require human approval
 */
const DECISION_DOMAINS = {
  STRATEGIC: {
    requiresHuman: true,
    reason: 'Strategic decisions affect long-term direction and values'
  },
  VALUES_SENSITIVE: {
    requiresHuman: true,
    reason: 'Values-sensitive decisions must preserve human agency'
  },
  RESOURCE_ALLOCATION: {
    requiresHuman: true,
    reason: 'Resource decisions reflect priorities and values'
  },
  POLICY_CREATION: {
    requiresHuman: true,
    reason: 'Policy creation is operational stewardship domain'
  },
  USER_COMMUNICATION: {
    requiresHuman: false,
    requiresReview: true,
    reason: 'Communications should be reviewed but not blocked'
  },
  TECHNICAL_IMPLEMENTATION: {
    requiresHuman: false,
    requiresReview: false,
    reason: 'Technical implementations can proceed with validation'
  }
};

class BoundaryEnforcer {
  constructor() {
    this.boundaries = TRACTATUS_BOUNDARIES;
    this.decisionDomains = DECISION_DOMAINS;
    this.classifier = classifier;

    // Initialize MemoryProxy for governance rule persistence
    this.memoryProxy = getMemoryProxy();
    this.enforcementRules = {}; // Will load inst_016, inst_017, inst_018
    this.memoryProxyInitialized = false;

    // Compile boundary patterns
    this.boundaryPatterns = this._compileBoundaryPatterns();

    // Statistics tracking
    this.stats = {
      total_enforcements: 0,
      boundaries_violated: 0,
      human_required_count: 0,
      allowed_count: 0,
      by_boundary: {
        VALUES: 0,
        INNOVATION: 0,
        WISDOM: 0,
        PURPOSE: 0,
        MEANING: 0,
        AGENCY: 0
      }
    };

    logger.info('BoundaryEnforcer initialized with Tractatus constraints');
  }

  /**
   * Initialize MemoryProxy and load enforcement rules
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      await this.memoryProxy.initialize();

      // Load critical enforcement rules from memory
      const criticalRuleIds = ['inst_016', 'inst_017', 'inst_018'];
      let rulesLoaded = 0;

      for (const ruleId of criticalRuleIds) {
        const rule = await this.memoryProxy.getRule(ruleId);
        if (rule) {
          this.enforcementRules[ruleId] = rule;
          rulesLoaded++;
        } else {
          logger.warn(`Enforcement rule ${ruleId} not found in memory`);
        }
      }

      this.memoryProxyInitialized = true;

      logger.info('BoundaryEnforcer MemoryProxy initialized', {
        rulesLoaded,
        totalCriticalRules: criticalRuleIds.length
      });

      return {
        success: true,
        rulesLoaded,
        enforcementRules: Object.keys(this.enforcementRules)
      };

    } catch (error) {
      logger.error('Failed to initialize BoundaryEnforcer MemoryProxy', {
        error: error.message
      });
      // Continue with existing enforcement logic even if memory fails
      return {
        success: false,
        error: error.message,
        rulesLoaded: 0
      };
    }
  }

  /**
   * Enforce boundaries on a proposed action
   * @param {Object} action - The proposed action
   * @param {Object} context - Decision context
   * @returns {Object} Enforcement result
   */
  enforce(action, context = {}) {
    try {
      // Handle null/undefined gracefully
      if (!action) {
        return {
          allowed: false,
          humanRequired: true,
          human_required: true,
          requirementType: 'MANDATORY',
          reason: 'Null or undefined decision cannot be evaluated',
          message: 'Invalid decision provided',
          action: 'REQUIRE_HUMAN_DECISION',
          timestamp: new Date()
        };
      }

      // Check for pre-approved operations
      if (action.pre_approved && this._isVerificationOperation(action)) {
        return this._allowAction(action, 'VERIFICATION', context);
      }

      // Check if domain explicitly indicates allowed operations
      if (this._isAllowedDomain(action.domain)) {
        const domainName = Array.isArray(action.domain) ? action.domain[0] : action.domain;
        return this._allowAction(action, domainName.toUpperCase(), context);
      }

      // Map decision.domain to Tractatus boundary (handles both string and array)
      const explicitBoundaries = this._mapDomainToBoundary(action.domain);

      // Check for decision flags that indicate boundary crossings
      const flaggedBoundaries = this._checkDecisionFlags(action);

      // Check for inst_016-018 content violations (honesty, transparency VALUES violations)
      const contentViolations = this._checkContentViolations(action);
      if (contentViolations.length > 0) {
        return this._requireHumanJudgment(contentViolations, action, context);
      }

      // Check if decision.classification indicates STRATEGIC
      if (action.classification?.quadrant === 'STRATEGIC') {
        const boundaryViolations = [{
          boundary: 'WISDOM',
          section: '12.3',
          principle: 'Wisdom cannot be encoded, only supported',
          matchCount: 1
        }];
        return this._requireHumanJudgment(boundaryViolations, action, context);
      }

      // Check if action crosses Tractatus boundaries
      const boundaryViolations = this._checkTractatusBoundaries(action, explicitBoundaries, flaggedBoundaries);

      if (boundaryViolations.length > 0) {
        return this._requireHumanJudgment(boundaryViolations, action, context);
      }

      // Check decision domain
      const domain = this._identifyDecisionDomain(action, context);
      const domainConfig = this.decisionDomains[domain];

      if (domainConfig.requiresHuman) {
        return this._requireHumanApproval(domain, domainConfig.reason, action, context);
      }

      if (domainConfig.requiresReview) {
        return this._requireHumanReview(domain, domainConfig.reason, action, context);
      }

      // Action can proceed without human intervention
      return this._allowAction(action, domain, context);

    } catch (error) {
      logger.error('Boundary enforcement error:', error);
      // Fail-safe: require human review on error
      return this._requireHumanJudgment(
        [{ boundary: 'ERROR', reason: 'Enforcement error, defaulting to human review' }],
        action,
        context
      );
    }
  }

  /**
   * Check if an action requires human approval based on Tractatus framework
   */
  requiresHumanApproval(action) {
    const result = this.enforce(action);
    return result.humanRequired === true;
  }

  /**
   * Get appropriate human oversight level for action
   */
  getOversightLevel(action, context = {}) {
    const classification = this.classifier.classify({
      text: action.description || action.text || '',
      context,
      timestamp: action.timestamp || new Date(),
      source: 'ai_proposed'
    });

    const oversightLevels = {
      STRATEGIC: 'VALUES_STEWARDSHIP',
      OPERATIONAL: 'PROCESS_STEWARDSHIP',
      TACTICAL: 'IMPLEMENTATION_EXPERTISE',
      SYSTEM: 'TECHNICAL_EXPERTISE',
      STOCHASTIC: 'INSIGHT_GENERATION'
    };

    return oversightLevels[classification.quadrant] || 'GENERAL_OVERSIGHT';
  }

  /**
   * Private methods
   */

  _compileBoundaryPatterns() {
    const patterns = {};
    for (const [boundary, config] of Object.entries(this.boundaries)) {
      patterns[boundary] = config.keywords.map(kw => new RegExp(`\\b${kw}\\b`, 'i'));
    }
    return patterns;
  }

  /**
   * Check if domain indicates an allowed operation (not a boundary violation)
   */
  _isAllowedDomain(domain) {
    if (!domain) return false;

    const allowedDomains = ['verification', 'support', 'preservation', 'recognition', 'system', 'technical'];

    if (Array.isArray(domain)) {
      // If it's an array, all domains must be allowed
      return domain.every(d => allowedDomains.includes(d.toLowerCase()));
    }

    return allowedDomains.includes(domain.toLowerCase());
  }

  /**
   * Map decision.domain field to Tractatus boundary (handles string or array)
   */
  _mapDomainToBoundary(domain) {
    if (!domain) return [];

    const domainMap = {
      'values': 'VALUES',
      'innovation': 'INNOVATION',
      'wisdom': 'WISDOM',
      'purpose': 'PURPOSE',
      'meaning': 'MEANING',
      'agency': 'AGENCY',
      'verification': null,  // Verification is allowed
      'support': null,       // Support operations are allowed
      'preservation': null,  // Preservation is allowed
      'recognition': null,   // Recognition is allowed
      'system': null,        // System operations are allowed
      'technical': null      // Technical operations are allowed
    };

    // Handle array of domains
    if (Array.isArray(domain)) {
      return domain
        .map(d => domainMap[d.toLowerCase()])
        .filter(b => b !== null);
    }

    // Handle single domain
    const boundary = domainMap[domain.toLowerCase()];
    return boundary ? [boundary] : [];
  }

  /**
   * Check decision flags that indicate boundary crossings
   */
  _checkDecisionFlags(action) {
    const flaggedBoundaries = [];

    if (action.involves_values === true) {
      flaggedBoundaries.push('VALUES');
    }

    if (action.affects_human_choice === true || action.affects_agency === true) {
      flaggedBoundaries.push('AGENCY');
    }

    if (action.novelty === 'high') {
      flaggedBoundaries.push('INNOVATION');
    }

    return flaggedBoundaries;
  }

  /**
   * Check if operation is verification (allowed) vs modification (requires human)
   */
  _isVerificationOperation(action) {
    const actionText = (action.description || action.text || '').toLowerCase();
    const verificationKeywords = ['verify', 'check', 'validate', 'confirm', 'review', 'analyze', 'assess'];
    const modificationKeywords = ['change', 'modify', 'update', 'redefine', 'set', 'create', 'define', 'decide'];

    const hasVerification = verificationKeywords.some(kw => actionText.includes(kw));
    const hasModification = modificationKeywords.some(kw => actionText.includes(kw));

    // If has modification keywords, it's not just verification
    if (hasModification) return false;

    // If has verification keywords, it's likely verification
    return hasVerification;
  }

  _checkTractatusBoundaries(action, explicitBoundaries = [], flaggedBoundaries = []) {
    const violations = [];
    const actionText = (action.description || action.text || '').toLowerCase();

    // Add explicit boundaries from domain field
    for (const boundary of explicitBoundaries) {
      if (this.boundaries[boundary]) {
        violations.push({
          boundary,
          section: this.boundaries[boundary].section,
          principle: this.boundaries[boundary].principle,
          matchCount: 1
        });
      }
    }

    // Add flagged boundaries from decision flags
    for (const boundary of flaggedBoundaries) {
      // Don't duplicate if already added
      if (!violations.some(v => v.boundary === boundary) && this.boundaries[boundary]) {
        violations.push({
          boundary,
          section: this.boundaries[boundary].section,
          principle: this.boundaries[boundary].principle,
          matchCount: 1
        });
      }
    }

    // If we already found violations from explicit sources, return them
    if (violations.length > 0) {
      return violations;
    }

    // Otherwise check for keyword matches in description
    for (const [boundary, patterns] of Object.entries(this.boundaryPatterns)) {
      let matchCount = 0;
      for (const pattern of patterns) {
        if (pattern.test(actionText)) {
          matchCount++;
        }
      }

      // Lower threshold to 1 for better detection
      // Use 2+ for high confidence, 1 for potential match
      if (matchCount >= 1) {
        violations.push({
          boundary,
          section: this.boundaries[boundary].section,
          principle: this.boundaries[boundary].principle,
          matchCount
        });
      }
    }

    return violations;
  }

  /**
   * Check for inst_016-018 content violations (VALUES violations: honesty, transparency)
   * These rules enforce the Tractatus principle that "Values cannot be automated"
   * @private
   */
  _checkContentViolations(action) {
    const violations = [];
    const actionText = (action.description || action.text || '').toLowerCase();

    // inst_017: Check for absolute assurance terms (highest priority - claims of 100% certainty)
    const absoluteTerms = [
      'guarantee', 'guaranteed', 'guarantees',
      'ensures 100%', 'eliminates all', 'completely prevents',
      'never fails', 'always works', '100% safe', '100% secure',
      'perfect protection', 'zero risk', 'entirely eliminates'
    ];

    for (const term of absoluteTerms) {
      if (actionText.includes(term)) {
        violations.push({
          boundary: 'VALUES',
          section: 'inst_017',
          principle: 'Values cannot be automated - honesty requires evidence-based language, not absolute guarantees',
          matchCount: 1,
          violationType: 'ABSOLUTE_ASSURANCE',
          violatedTerm: term
        });
        break; // One violation is enough
      }
    }

    // inst_016: Check for statistics/quantitative claims without sources
    // Patterns that indicate statistical claims
    const statsPattern = /\d+(\.\d+)?%|\$[\d,]+|\d+x\s*roi|payback\s*(period)?\s*of\s*\d+|\d+[\s-]*(month|year)s?\s*payback|\d+(\.\d+)?m\s*(saved|savings)/i;
    if (statsPattern.test(actionText)) {
      // Check if sources are provided in action metadata
      if (!action.sources || action.sources.length === 0) {
        violations.push({
          boundary: 'VALUES',
          section: 'inst_016',
          principle: 'Values cannot be automated - all statistics require verifiable sources or human approval',
          matchCount: 1,
          violationType: 'FABRICATED_STATISTIC'
        });
      }
    }

    // inst_018: Check for unverified production/validation claims
    const productionTerms = [
      'production-ready', 'battle-tested', 'production-proven',
      'validated', 'enterprise-proven', 'industry-standard',
      'existing customers', 'market leader', 'widely adopted',
      'proven track record', 'field-tested', 'extensively tested'
    ];

    for (const term of productionTerms) {
      if (actionText.includes(term)) {
        // Check if evidence is provided
        if (!action.testing_evidence && !action.validation_evidence) {
          violations.push({
            boundary: 'VALUES',
            section: 'inst_018',
            principle: 'Values cannot be automated - testing/validation status claims require documented evidence',
            matchCount: 1,
            violationType: 'UNVERIFIED_PRODUCTION_CLAIM',
            violatedTerm: term
          });
          break;
        }
      }
    }

    return violations;
  }

  _identifyDecisionDomain(action, context) {
    const actionText = (action.description || action.text || '').toLowerCase();

    // Strategic indicators
    if (this._hasStrategicIndicators(actionText, context)) {
      return 'STRATEGIC';
    }

    // Values-sensitive indicators
    if (this._hasValuesSensitiveIndicators(actionText)) {
      return 'VALUES_SENSITIVE';
    }

    // Resource allocation indicators
    if (this._hasResourceIndicators(actionText)) {
      return 'RESOURCE_ALLOCATION';
    }

    // Policy creation indicators
    if (this._hasPolicyIndicators(actionText)) {
      return 'POLICY_CREATION';
    }

    // User communication indicators
    if (this._hasCommunicationIndicators(actionText, action)) {
      return 'USER_COMMUNICATION';
    }

    // Default to technical implementation
    return 'TECHNICAL_IMPLEMENTATION';
  }

  _hasStrategicIndicators(text, context) {
    const strategic = [
      'always', 'never', 'mission', 'vision', 'strategy',
      'long-term', 'fundamental', 'core principle'
    ];
    return strategic.some(kw => text.includes(kw));
  }

  _hasValuesSensitiveIndicators(text) {
    const values = [
      'value', 'principle', 'ethic', 'moral', 'right', 'wrong',
      'should we', 'ought to', 'better to'
    ];
    return values.some(kw => text.includes(kw));
  }

  _hasResourceIndicators(text) {
    const resources = [
      'budget', 'allocate', 'spend', 'invest', 'cost',
      'hire', 'fire', 'purchase'
    ];
    return resources.some(kw => text.includes(kw));
  }

  _hasPolicyIndicators(text) {
    const policy = [
      'policy', 'rule', 'guideline', 'standard', 'procedure',
      'process', 'workflow', 'protocol'
    ];
    return policy.some(kw => text.includes(kw));
  }

  _hasCommunicationIndicators(text, action) {
    if (action.type === 'email' || action.type === 'message') return true;
    const communication = ['send', 'email', 'message', 'notify', 'inform', 'communicate'];
    return communication.some(kw => text.includes(kw));
  }

  _requireHumanJudgment(violations, action, context = {}) {
    this.stats.total_enforcements++;
    this.stats.boundaries_violated++;
    this.stats.human_required_count++;

    const primaryViolation = violations[0];
    if (primaryViolation.boundary && this.stats.by_boundary[primaryViolation.boundary] !== undefined) {
      this.stats.by_boundary[primaryViolation.boundary]++;
    }

    // Check for critical pressure requiring escalation
    const requiresEscalation = context.pressure_level === 'CRITICAL';

    const result = {
      allowed: false,
      humanRequired: true,
      human_required: true, // Alias for test compatibility
      requirementType: 'MANDATORY',
      reason: primaryViolation.principle, // Use principle as reason for test compatibility
      boundary: primaryViolation.boundary,
      domain: primaryViolation.boundary, // Also include as domain for test compatibility
      tractatus_section: primaryViolation.section,
      principle: primaryViolation.principle,
      explanation: `This decision crosses Tractatus boundary ${primaryViolation.section}: "${primaryViolation.principle}". ` +
                   `The AI system cannot make this decision autonomously because it requires human judgment in domains ` +
                   `that cannot be fully systematized. Please review and make the decision yourself.`,
      message: `This decision crosses Tractatus boundary ${primaryViolation.section}: ` +
               `"${primaryViolation.principle}"`,
      violations,
      violated_boundaries: violations.map(v => v.boundary),
      action: 'REQUIRE_HUMAN_DECISION',
      recommendation: 'Present options to human for decision',
      alternatives: this._generateAlternatives(primaryViolation.boundary, action), // Use 'alternatives' not 'suggested_alternatives'
      suggested_alternatives: this._generateAlternatives(primaryViolation.boundary, action), // Keep alias for backwards compatibility
      suggested_action: action.classification?.quadrant === 'STRATEGIC' ?
        'defer to human for strategic decision' :
        'Present options to human for decision',
      escalation_path: 'Requires human approval before proceeding',
      escalation_required: requiresEscalation,
      userPrompt: this._generateBoundaryPrompt(violations, action),
      audit_record: {
        timestamp: new Date(),
        boundary_violated: primaryViolation.boundary,
        action_attempted: action.type || action.description,
        enforcement_decision: 'BLOCKED'
      },
      context: Object.keys(context).length > 0 ? context : undefined,
      timestamp: new Date()
    };

    // Audit this enforcement decision
    this._auditEnforcementDecision(result, action, context);

    return result;
  }

  _requireHumanApproval(domain, reason, action, context = {}) {
    return {
      allowed: false,
      humanRequired: true,
      human_required: true, // Alias for test compatibility
      requirementType: 'APPROVAL_REQUIRED',
      domain,
      reason,
      message: `${domain} decisions require human approval: ${reason}`,
      action: 'REQUEST_APPROVAL',
      recommendation: 'Present proposal to human for approval',
      escalation_path: 'Requires human approval before proceeding',
      userPrompt: this._generateApprovalPrompt(domain, reason, action),
      context: Object.keys(context).length > 0 ? context : undefined,
      timestamp: new Date()
    };
  }

  _requireHumanReview(domain, reason, action, context = {}) {
    return {
      allowed: true,
      humanRequired: false,
      human_required: false, // Alias for test compatibility
      requirementType: 'REVIEW_RECOMMENDED',
      domain,
      reason,
      message: `${domain}: ${reason}`,
      action: 'PROCEED_WITH_NOTIFICATION',
      recommendation: 'Execute action but notify human',
      notification: `Action executed in ${domain}: ${action.description || action.text}`,
      context: Object.keys(context).length > 0 ? context : undefined,
      timestamp: new Date()
    };
  }

  _allowAction(action, domain, context = {}) {
    this.stats.total_enforcements++;
    this.stats.allowed_count++;

    const result = {
      allowed: true,
      humanRequired: false,
      human_required: false, // Alias for test compatibility
      requirementType: 'NONE',
      domain,
      boundary: null, // Explicitly null when no boundary violation
      message: `Action approved for ${domain}`,
      action: 'PROCEED',
      context: Object.keys(context).length > 0 ? context : undefined,
      timestamp: new Date()
    };

    // Audit this enforcement decision
    this._auditEnforcementDecision(result, action, context);

    return result;
  }

  _generateBoundaryPrompt(violations, action) {
    const primaryViolation = violations[0];

    return `I need your judgment on this decision:\n\n` +
           `Proposed action: ${action.description || action.text}\n\n` +
           `This crosses a Tractatus boundary (${primaryViolation.section}):\n` +
           `"${primaryViolation.principle}"\n\n` +
           `This means I cannot make this decision autonomously - it requires human judgment.\n\n` +
           `What would you like me to do?`;
  }

  _generateAlternatives(boundary, action) {
    // Provide boundary-specific alternative approaches
    const alternatives = {
      VALUES: [
        'Present multiple options with trade-offs for human decision',
        'Gather stakeholder input before deciding',
        'Document values implications and seek guidance'
      ],
      INNOVATION: [
        'Facilitate brainstorming session with human leadership',
        'Research existing solutions before proposing novel approaches',
        'Present proof-of-concept for human evaluation'
      ],
      WISDOM: [
        'Provide data analysis to inform human judgment',
        'Present historical context and lessons learned',
        'Offer decision framework while leaving judgment to human'
      ],
      PURPOSE: [
        'Implement within existing purpose and mission',
        'Seek clarification on organizational intent',
        'Present alignment analysis with current purpose'
      ],
      MEANING: [
        'Recognize patterns and present to human for interpretation',
        'Provide context without determining significance',
        'Defer to human assessment of importance'
      ],
      AGENCY: [
        'Notify human and await their decision',
        'Present options without making choice',
        'Respect human autonomy by seeking consent'
      ]
    };

    return alternatives[boundary] || ['Seek human guidance', 'Present options for human decision'];
  }

  _generateApprovalPrompt(domain, reason, action) {
    return `This action requires your approval:\n\n` +
           `Domain: ${domain}\n` +
           `Action: ${action.description || action.text}\n` +
           `Reason: ${reason}\n\n` +
           `Do you approve this action?`;
  }

  /**
   * Audit enforcement decision to memory (async, non-blocking)
   * @private
   */
  _auditEnforcementDecision(result, action, context = {}) {
    // Only audit if MemoryProxy is initialized
    if (!this.memoryProxyInitialized) {
      logger.debug('[BoundaryEnforcer] Audit skipped - MemoryProxy not initialized');
      return;
    }

    logger.debug('[BoundaryEnforcer] Auditing enforcement decision', {
      allowed: result.allowed,
      domain: result.domain,
      sessionId: context.sessionId || 'boundary-enforcer-session'
    });

    // Audit asynchronously (don't block enforcement)
    this.memoryProxy.auditDecision({
      sessionId: context.sessionId || 'boundary-enforcer-session',
      action: 'boundary_enforcement',
      rulesChecked: Object.keys(this.enforcementRules),
      violations: result.violated_boundaries || [],
      allowed: result.allowed,
      metadata: {
        boundary: result.boundary || 'none',
        domain: result.domain,
        requirementType: result.requirementType,
        actionType: action.type || action.description,
        tractatus_section: result.tractatus_section,
        enforcement_decision: result.allowed ? 'ALLOWED' : 'BLOCKED'
      }
    }).catch(error => {
      logger.error('Failed to audit enforcement decision', {
        error: error.message,
        action: action.type || action.description
      });
    });
  }

  /**
   * Get enforcement statistics
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
const enforcer = new BoundaryEnforcer();

// Export both singleton (default) and class (for testing)
module.exports = enforcer;
module.exports.BoundaryEnforcer = BoundaryEnforcer;
