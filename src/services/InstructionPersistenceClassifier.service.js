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
 * Instruction Persistence Classifier Service
 * Classifies actions and instructions by quadrant and persistence level
 *
 * Core Tractatus Service: Implements time-persistence metadata tagging
 * to ensure AI actions are verified according to instruction permanence.
 *
 * Prevents the "27027 failure mode" where explicit instructions are
 * overridden by cached patterns.
 */

const logger = require('../utils/logger.util');
const { getMemoryProxy } = require('./MemoryProxy.service');

/**
 * Quadrant definitions from Tractatus framework
 */
const QUADRANTS = {
  STRATEGIC: {
    name: 'Strategic',
    timeHorizon: 'years',
    persistence: 'HIGH',
    description: 'Values, mission, long-term direction',
    keywords: ['always', 'never', 'core', 'values', 'mission', 'principle', 'philosophy'],
    verificationLevel: 'MANDATORY',
    humanOversight: 'VALUES_STEWARDSHIP',
    examples: ['Always prioritize privacy', 'Never compromise user sovereignty']
  },
  OPERATIONAL: {
    name: 'Operational',
    timeHorizon: 'months',
    persistence: 'MEDIUM-HIGH',
    description: 'Processes, policies, project-level decisions',
    keywords: ['project', 'process', 'policy', 'workflow', 'standard', 'convention'],
    verificationLevel: 'REQUIRED',
    humanOversight: 'PROCESS_STEWARDSHIP',
    examples: ['For this project, use React', 'All blog posts must cite sources']
  },
  TACTICAL: {
    name: 'Tactical',
    timeHorizon: 'weeks',
    persistence: 'VARIABLE',
    description: 'Implementation decisions, immediate actions',
    keywords: ['now', 'today', 'this', 'current', 'immediate', 'check', 'verify'],
    verificationLevel: 'CONTEXT_DEPENDENT',
    humanOversight: 'IMPLEMENTATION_EXPERTISE',
    examples: ['Check port 27027', 'Use this API key for testing']
  },
  SYSTEM: {
    name: 'System',
    timeHorizon: 'continuous',
    persistence: 'HIGH',
    description: 'Technical infrastructure, architecture',
    keywords: ['code', 'technical', 'architecture', 'infrastructure', 'database', 'api',
               'fix', 'bug', 'error', 'authentication', 'security', 'system', 'implementation',
               'function', 'method', 'class', 'module', 'component', 'service'],
    verificationLevel: 'TECHNICAL_REVIEW',
    humanOversight: 'TECHNICAL_EXPERTISE',
    examples: ['MongoDB port is 27017', 'Use JWT for authentication']
  },
  STOCHASTIC: {
    name: 'Stochastic',
    timeHorizon: 'variable',
    persistence: 'CONTEXT_DEPENDENT',
    description: 'Innovation, exploration, experimentation',
    keywords: ['explore', 'experiment', 'innovate', 'brainstorm', 'creative', 'try',
               'alternative', 'alternatives', 'consider', 'possibility', 'investigate',
               'research', 'discover', 'prototype', 'test', 'suggest', 'idea'],
    verificationLevel: 'OPTIONAL',
    humanOversight: 'INSIGHT_GENERATION',
    examples: ['Explore alternative approaches', 'Suggest creative solutions']
  }
};

/**
 * Persistence levels
 */
const PERSISTENCE_LEVELS = {
  HIGH: {
    score: 0.9,
    verificationRequired: true,
    description: 'Must be followed exactly',
    conflictSeverity: 'CRITICAL'
  },
  MEDIUM: {
    score: 0.6,
    verificationRequired: true,
    description: 'Should be followed with flexibility',
    conflictSeverity: 'WARNING'
  },
  LOW: {
    score: 0.3,
    verificationRequired: false,
    description: 'Guidance only, context-dependent',
    conflictSeverity: 'MINOR'
  },
  VARIABLE: {
    score: 0.5,
    verificationRequired: true, // Context-dependent
    description: 'Depends on explicitness and recency',
    conflictSeverity: 'CONTEXT_DEPENDENT'
  }
};

class InstructionPersistenceClassifier {
  constructor() {
    this.quadrants = QUADRANTS;
    this.persistenceLevels = PERSISTENCE_LEVELS;

    // Initialize MemoryProxy for reference rules and audit logging
    this.memoryProxy = getMemoryProxy();
    this.referenceRules = []; // Loaded from memory for pattern matching
    this.memoryProxyInitialized = false;

    // Compile keyword patterns for efficient matching
    this.keywordPatterns = this._compileKeywordPatterns();

    // Statistics tracking
    this.stats = {
      total_classifications: 0,
      by_quadrant: {
        STRATEGIC: 0,
        OPERATIONAL: 0,
        TACTICAL: 0,
        SYSTEM: 0,
        STOCHASTIC: 0
      },
      by_persistence: {
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        VARIABLE: 0
      },
      by_verification: {
        MANDATORY: 0,
        REQUIRED: 0,
        RECOMMENDED: 0,
        OPTIONAL: 0
      }
    };

    logger.info('InstructionPersistenceClassifier initialized');
  }

  /**
   * Initialize MemoryProxy and load reference rules
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      await this.memoryProxy.initialize();

      // Load all rules as reference for pattern matching
      this.referenceRules = await this.memoryProxy.loadGovernanceRules();

      this.memoryProxyInitialized = true;

      logger.info('[InstructionPersistenceClassifier] MemoryProxy initialized', {
        referenceRulesLoaded: this.referenceRules.length
      });

      return {
        success: true,
        referenceRulesLoaded: this.referenceRules.length
      };

    } catch (error) {
      logger.error('[InstructionPersistenceClassifier] Failed to initialize MemoryProxy', {
        error: error.message
      });
      // Continue with existing classification logic even if memory fails
      return {
        success: false,
        error: error.message,
        referenceRulesLoaded: 0
      };
    }
  }

  /**
   * Classify an instruction or action
   * @param {Object} params
   * @param {string} params.text - The instruction text
   * @param {Object} params.context - Conversation context
   * @param {Date} params.timestamp - When instruction was given
   * @param {string} params.source - Source of instruction (user/system/inferred)
   * @returns {Object} Classification metadata
   */
  classify({ text, context = {}, timestamp = new Date(), source = 'user' }) {
    try {
      // Normalize text
      const normalizedText = text.toLowerCase().trim();

      // Extract temporal indicators
      const temporalScope = this._extractTemporalScope(normalizedText);

      // Determine quadrant
      const quadrant = this._determineQuadrant(normalizedText, context, temporalScope);

      // Measure explicitness
      const explicitness = this._measureExplicitness(normalizedText, source);

      // Calculate persistence level
      const persistence = this._calculatePersistence({
        quadrant,
        temporalScope,
        explicitness,
        source,
        text: normalizedText
      });

      // Determine verification requirements
      const verification = this._determineVerification({
        quadrant,
        persistence,
        explicitness,
        source,
        context
      });

      // Extract parameters
      const parameters = this._extractParameters(normalizedText);

      // Calculate recency weight (decays over time)
      const recencyWeight = this._calculateRecencyWeight(timestamp);

      const classification = {
        text,
        quadrant,
        quadrantInfo: this.quadrants[quadrant],
        persistence,
        persistenceScore: this.persistenceLevels[persistence].score,
        explicitness,
        verification,
        verification_required: verification, // Alias for test compatibility
        parameters,
        timestamp,
        source,
        recencyWeight,
        metadata: {
          temporal_scope: temporalScope, // snake_case for test compatibility
          temporalScope, // camelCase for consistency
          extracted_parameters: parameters, // snake_case alias
          extractedParameters: parameters, // camelCase alias
          context_snapshot: context, // snake_case alias
          contextSnapshot: context, // camelCase alias
          humanOversight: this.quadrants[quadrant].humanOversight,
          conflictSeverity: this.persistenceLevels[persistence].conflictSeverity
        }
      };

      // Track statistics
      this.stats.total_classifications++;
      this.stats.by_quadrant[quadrant]++;
      this.stats.by_persistence[persistence]++;
      this.stats.by_verification[verification]++;

      logger.debug('Instruction classified', {
        text: text.substring(0, 50),
        quadrant,
        persistence,
        verification
      });

      // Audit classification decision
      this._auditClassification(classification, context);

      return classification;

    } catch (error) {
      logger.error('Classification error:', error);
      // Return safe default classification
      return this._defaultClassification(text, timestamp);
    }
  }

  /**
   * Classify multiple instructions in batch
   */
  classifyBatch(instructions) {
    return instructions.map(inst => this.classify(inst));
  }

  /**
   * Calculate relevance of an instruction to an action
   * Used by CrossReferenceValidator
   */
  calculateRelevance(instruction, action) {
    try {
      // Semantic similarity (simple keyword overlap for now)
      const semantic = this._semanticSimilarity(instruction.text, action.description);

      // Temporal proximity
      const temporal = instruction.recencyWeight || 0.5;

      // Persistence weight
      const persistence = instruction.persistenceScore || 0.5;

      // Explicitness weight
      const explicitness = instruction.explicitness || 0.5;

      // Weighted combination
      const relevance = (
        semantic * 0.4 +
        temporal * 0.3 +
        persistence * 0.2 +
        explicitness * 0.1
      );

      return Math.min(1.0, Math.max(0.0, relevance));

    } catch (error) {
      logger.error('Relevance calculation error:', error);
      return 0.3; // Safe default
    }
  }

  /**
   * Private methods
   */

  _compileKeywordPatterns() {
    const patterns = {};
    for (const [quadrant, config] of Object.entries(this.quadrants)) {
      patterns[quadrant] = config.keywords.map(kw => new RegExp(`\\b${kw}\\b`, 'i'));
    }
    return patterns;
  }

  _extractTemporalScope(text) {
    // Check for multi-word phrases first (more specific)
    if (/\b(?:for|during|in)\s+(?:the\s+)?(?:rest\s+of\s+)?(?:this|current)\s+(?:session|conversation)\b/i.test(text)) {
      return 'SESSION';
    }

    const scopes = {
      PERMANENT: ['always', 'never', 'all', 'every', 'forever'],
      PROJECT: ['project', 'this phase', 'going forward', 'from now on'],
      SESSION: ['session', 'conversation', 'while'],
      IMMEDIATE: ['now', 'today', 'currently', 'right now', 'this']
    };

    for (const [scope, keywords] of Object.entries(scopes)) {
      if (keywords.some(kw => text.includes(kw))) {
        return scope;
      }
    }

    return 'IMMEDIATE'; // Default
  }

  _determineQuadrant(text, context, temporalScope) {
    // Handle empty text explicitly
    if (!text || text.trim().length === 0) {
      return 'STOCHASTIC';
    }

    // Score each quadrant
    const scores = {};

    for (const [quadrant, patterns] of Object.entries(this.keywordPatterns)) {
      let score = 0;

      // Keyword matching
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          score += 1;
        }
      }

      // Strong quadrant indicators
      // "For this project" strongly suggests OPERATIONAL over STRATEGIC
      if (/\b(?:for|in|during)\s+this\s+project\b/i.test(text) && quadrant === 'OPERATIONAL') {
        score += 3;
      }

      // Technical/code fix patterns strongly suggest SYSTEM
      if (/\b(?:fix|debug|resolve).*(?:bug|error|issue)\b/i.test(text) && quadrant === 'SYSTEM') {
        score += 2;
      }
      if (/\b(?:code|function|method|class|component)\b/i.test(text) && quadrant === 'SYSTEM') {
        score += 1;
      }

      // Exploration patterns strongly suggest STOCHASTIC
      if (/\b(?:explore|investigate|research|discover)\b/i.test(text) && quadrant === 'STOCHASTIC') {
        score += 2;
      }
      if (/\balternative(?:s)?\b/i.test(text) && quadrant === 'STOCHASTIC') {
        score += 2;
      }

      // Temporal scope alignment (weaker than strong indicators)
      if (temporalScope === 'PERMANENT' && quadrant === 'STRATEGIC') score += 1;
      if (temporalScope === 'PROJECT' && quadrant === 'OPERATIONAL') score += 1;
      if (temporalScope === 'IMMEDIATE' && quadrant === 'TACTICAL') score += 1;

      // Context clues
      if (context.domain === 'technical' && quadrant === 'SYSTEM') score += 1;
      if (context.domain === 'innovation' && quadrant === 'STOCHASTIC') score += 1;

      scores[quadrant] = score;
    }

    // Return highest scoring quadrant
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    // If no clear winner, default based on temporal scope
    if (sorted[0][1] === 0) {
      if (temporalScope === 'PERMANENT') return 'STRATEGIC';
      if (temporalScope === 'PROJECT') return 'OPERATIONAL';
      return 'TACTICAL';
    }

    return sorted[0][0];
  }

  _measureExplicitness(text, source) {
    let score = 0.3; // Base score (lower baseline)

    // Implicit/hedging language reduces explicitness
    const implicitMarkers = [
      'could', 'would', 'might', 'maybe', 'perhaps', 'consider',
      'possibly', 'potentially', 'suggestion', 'recommend'
    ];

    const implicitCount = implicitMarkers.filter(marker =>
      text.includes(marker)
    ).length;

    if (implicitCount > 0) {
      score -= implicitCount * 0.15; // Reduce for hedge words
    }

    // Source factor (applied after implicit check)
    if (source === 'user') score += 0.15;
    if (source === 'inferred') score -= 0.2;

    // Explicit markers
    const explicitMarkers = [
      'specifically', 'exactly', 'must', 'should', 'explicitly',
      'clearly', 'definitely', 'always', 'never', 'require'
    ];

    const markerCount = explicitMarkers.filter(marker =>
      text.includes(marker)
    ).length;

    score += markerCount * 0.15;

    // Parameter specification (numbers, specific values)
    if (/\d{4,}/.test(text)) score += 0.25; // Port numbers, dates, etc.
    if (/["'][\w-]+["']/.test(text)) score += 0.1; // Quoted strings

    return Math.min(1.0, Math.max(0.0, score));
  }

  _calculatePersistence({ quadrant, temporalScope, explicitness, source, text }) {
    // Special case: Explicit prohibitions are HIGH persistence
    // "not X", "never X", "don't use X", "avoid X" indicate strong requirements
    if (/\b(?:not|never|don't\s+use|avoid)\s+\w+/i.test(text)) {
      return 'HIGH';
    }

    // Special case: Explicit port/configuration specifications are HIGH persistence
    if (/\bport\s+\d{4,5}\b/i.test(text) && explicitness > 0.6) {
      return 'HIGH';
    }

    // Special case: Exploratory STOCHASTIC with exploration keywords should be MEDIUM
    if (quadrant === 'STOCHASTIC' && /\b(?:explore|investigate|research|discover)\b/i.test(text)) {
      return 'MEDIUM';
    }

    // Special case: Preference language ("prefer", "try to", "aim to") should be MEDIUM
    // Captures "prefer using", "prefer to", "try to", "aim to"
    if (/\b(?:try|aim|strive)\s+to\b/i.test(text) || /\bprefer(?:s|red)?\s+(?:to|using)\b/i.test(text)) {
      return 'MEDIUM';
    }

    // Base persistence from quadrant
    let baseScore = {
      STRATEGIC: 0.9,
      OPERATIONAL: 0.7,
      TACTICAL: 0.5,
      SYSTEM: 0.7, // Increased from 0.6 for better SYSTEM persistence
      STOCHASTIC: 0.4
    }[quadrant];

    // Adjust for temporal scope
    if (temporalScope === 'PERMANENT') baseScore += 0.15;
    if (temporalScope === 'PROJECT') baseScore += 0.05;
    if (temporalScope === 'SESSION') baseScore -= 0.2;
    if (temporalScope === 'IMMEDIATE') baseScore -= 0.25; // One-time actions

    // Adjust for explicitness
    if (explicitness > 0.8) baseScore += 0.15;
    else if (explicitness > 0.6) baseScore += 0.05;

    // Adjust for source
    if (source === 'user') baseScore += 0.05;
    if (source === 'inferred') baseScore -= 0.15;

    // Normalize
    const score = Math.min(1.0, Math.max(0.0, baseScore));

    // Map to categorical levels
    if (score >= 0.75) return 'HIGH';
    if (score >= 0.45) return 'MEDIUM';
    if (quadrant === 'TACTICAL' && explicitness > 0.7 && score >= 0.4) return 'VARIABLE'; // Explicit tactical
    return 'LOW';
  }

  _determineVerification({ quadrant, persistence, explicitness, source, context = {} }) {
    // Check context pressure - high pressure increases verification requirements
    const highPressure = context.token_usage > 0.7 ||
                        context.errors_recent > 3 ||
                        context.conversation_length > 80;

    // MANDATORY verification conditions
    if (persistence === 'HIGH') return 'MANDATORY';
    if (quadrant === 'STRATEGIC') return 'MANDATORY';
    if (explicitness > 0.8 && source === 'user') return 'MANDATORY';
    if (highPressure && quadrant === 'SYSTEM') return 'MANDATORY'; // High pressure + system changes

    // REQUIRED verification conditions
    if (persistence === 'MEDIUM') return 'REQUIRED';
    if (quadrant === 'OPERATIONAL') return 'REQUIRED';
    if (highPressure && persistence === 'VARIABLE') return 'REQUIRED'; // Upgrade from RECOMMENDED

    // RECOMMENDED verification conditions
    if (persistence === 'VARIABLE') return 'RECOMMENDED';
    if (quadrant === 'TACTICAL' && explicitness > 0.5) return 'RECOMMENDED';
    if (highPressure) return 'RECOMMENDED'; // High pressure requires at least RECOMMENDED

    // OPTIONAL for low-persistence stochastic
    return 'OPTIONAL';
  }

  _extractParameters(text) {
    const params = {};

    // Port numbers - prefer positive contexts over prohibitions
    // Handle "port 27017" and "port is 27017"
    // Prioritize ports with "always", "use", "should be" over "never", "not", "don't use"
    const portMatches = text.matchAll(/\bport\s+(?:is\s+)?(\d{4,5})/gi);
    let bestPort = null;
    let bestScore = -100;

    for (const match of Array.from(portMatches)) {
      const portNum = match[1];
      // Check context before the port mention (30 chars)
      const beforeContext = text.substring(Math.max(0, match.index - 30), match.index);
      let score = 0;

      // Negative context: penalize heavily
      if (/\b(?:never|not|don't|avoid|no)\s+(?:use\s+)?$/i.test(beforeContext)) {
        score = -10;
      }
      // Positive context: reward
      else if (/\b(?:always|use|should|must|require)\s+$/i.test(beforeContext)) {
        score = 10;
      }
      // Default: if no context markers, still consider it
      else {
        score = 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestPort = portNum;
      }
    }

    if (bestPort) params.port = bestPort;

    // URLs
    const urlMatch = text.match(/https?:\/\/[\w.-]+(?::\d+)?/);
    if (urlMatch) params.url = urlMatch[0];

    // Protocols (http, https, ftp, etc.)
    // Prefer protocols in positive contexts (use, always, prefer) over negative (never, not, avoid)
    const protocolMatches = text.matchAll(/\b(https?|ftp|ssh|ws|wss)\b/gi);
    const protocols = Array.from(protocolMatches);
    if (protocols.length > 0) {
      // Score each protocol based on context
      let bestProtocol = null;
      let bestScore = -1;

      for (const match of protocols) {
        // Check immediate context (15 chars before) for modifiers
        const immediateContext = text.substring(Math.max(0, match.index - 15), match.index);
        let score = 0;

        // Negative context in immediate vicinity: skip
        if (/\b(never|not|don't|avoid|no)\s+use\b/i.test(immediateContext)) {
          score = -10;
        }
        // Positive context: reward
        else if (/\b(always|prefer|require|must|should)\s+use\b/i.test(immediateContext)) {
          score = 10;
        }
        // Just "use" without modifiers: slight reward
        else if (/\buse\b/i.test(immediateContext)) {
          score = 5;
        }
        // Default: if no context, still consider it
        else {
          score = 1;
        }

        if (score > bestScore) {
          bestScore = score;
          bestProtocol = match[1].toLowerCase();
        }
      }

      if (bestProtocol) {
        params.protocol = bestProtocol;
      }
    }

    // Host/hostname
    const hostMatch = text.match(/(?:host|server|hostname)[:\s]+([\w.-]+)/i);
    if (hostMatch) params.host = hostMatch[1];

    // File paths
    const pathMatch = text.match(/(?:\/[\w.-]+)+/);
    if (pathMatch) params.path = pathMatch[0];

    // API keys (redacted)
    if (/api[_-]?key/i.test(text)) params.hasApiKey = true;

    // Database names
    const dbMatch = text.match(/\b(?:database|db)[:\s]+([\w-]+)/i);
    if (dbMatch) params.database = dbMatch[1];

    // Collection names
    const collectionMatch = text.match(/\bcollection[:\s]+([\w-]+)/i);
    if (collectionMatch) params.collection = collectionMatch[1];

    // Frameworks (react, vue, angular, etc.)
    const frameworks = ['react', 'vue', 'angular', 'svelte', 'ember', 'backbone'];
    for (const framework of frameworks) {
      if (new RegExp(`\\b${framework}\\b`, 'i').test(text)) {
        params.framework = framework.toLowerCase();
        break;
      }
    }

    // Module systems
    if (/\b(?:esm|es6|es modules?)\b/i.test(text)) params.module_type = 'esm';
    if (/\b(?:commonjs|cjs|require)\b/i.test(text)) params.module_type = 'commonjs';

    // Package/library names (generic)
    const packageMatch = text.match(/(?:package|library|module)[:\s]+([\w-]+)/i);
    if (packageMatch) params.package = packageMatch[1];

    // Confirmation/approval flags
    // Handle negations: "never X without confirmation" means confirmation IS required
    if (/\b(?:never|don't|do not).*without\s+confirmation\b/i.test(text)) {
      params.confirmed = true; // Double negative = positive requirement
    }
    else if (/\b(?:with confirmation|require confirmation|must confirm|need confirmation)\b/i.test(text)) {
      params.confirmed = true;
    }
    else if (/\b(?:without confirmation|no confirmation|skip confirmation)\b/i.test(text)) {
      params.confirmed = false;
    }

    // Patterns (callback, promise, async/await)
    if (/\b(?:callback|callbacks)\b/i.test(text)) params.pattern = 'callback';
    if (/\b(?:promise|promises)\b/i.test(text)) params.pattern = 'promise';
    if (/\b(?:async\/await|async-await)\b/i.test(text)) params.pattern = 'async/await';

    return params;
  }

  _calculateRecencyWeight(timestamp) {
    const now = new Date();
    const age = (now - new Date(timestamp)) / 1000; // seconds

    // Exponential decay: weight = e^(-age/halfLife)
    const halfLife = 3600; // 1 hour
    const weight = Math.exp(-age / halfLife);

    return Math.min(1.0, Math.max(0.0, weight));
  }

  _semanticSimilarity(text1, text2) {
    // Handle null/undefined inputs
    if (!text1 || !text2) return 0;

    // Simple keyword overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  _defaultClassification(text, timestamp) {
    return {
      text,
      quadrant: 'TACTICAL',
      quadrantInfo: this.quadrants.TACTICAL,
      persistence: 'MEDIUM',
      persistenceScore: 0.5,
      explicitness: 0.5,
      verification: 'RECOMMENDED',
      verification_required: 'RECOMMENDED', // Alias for test compatibility
      parameters: {},
      timestamp,
      source: 'unknown',
      recencyWeight: 0.5,
      metadata: {
        temporalScope: 'IMMEDIATE',
        humanOversight: 'IMPLEMENTATION_EXPERTISE',
        conflictSeverity: 'WARNING',
        error: 'Failed to classify, using safe defaults'
      }
    };
  }

  /**
   * Audit classification decision to memory (async, non-blocking)
   * @private
   */
  _auditClassification(classification, context = {}) {
    // Only audit if MemoryProxy is initialized
    if (!this.memoryProxyInitialized) {
      return;
    }

    // Audit asynchronously (don't block classification)
    this.memoryProxy.auditDecision({
      sessionId: context.sessionId || 'classifier-service',
      action: 'instruction_classification',
      rulesChecked: this.referenceRules.map(r => r.id),
      violations: [], // Classification doesn't detect violations
      allowed: true, // Classification is always allowed
      metadata: {
        instruction_text: classification.text.substring(0, 100),
        quadrant: classification.quadrant,
        persistence: classification.persistence,
        persistence_score: classification.persistenceScore,
        explicitness: classification.explicitness,
        verification: classification.verification,
        temporal_scope: classification.metadata.temporalScope,
        source: classification.source,
        recency_weight: classification.recencyWeight,
        parameters: classification.parameters
      }
    }).catch(error => {
      logger.error('[InstructionPersistenceClassifier] Failed to audit classification', {
        error: error.message,
        text: classification.text.substring(0, 50)
      });
    });
  }

  /**
   * Persist classified instruction to MongoDB as GovernanceRule
   * @param {Object} classification - Classification from classify()
   * @param {Object} options - Options (createdBy, notes, etc.)
   * @returns {Promise<Object>} - Persistence result
   */
  async persist(classification, options = {}) {
    try {
      if (!this.memoryProxyInitialized) {
        throw new Error('MemoryProxy not initialized - call initialize() first');
      }

      const GovernanceRule = require('../models/GovernanceRule.model');

      // Check if rule already exists
      const existing = await GovernanceRule.findOne({ id: options.id });
      if (existing) {
        logger.warn('Rule already exists', { id: options.id });
        return { success: false, error: 'Rule already exists', existed: true };
      }

      // Create GovernanceRule from classification
      const rule = await GovernanceRule.create({
        id: options.id || `inst_${Date.now()}`,
        text: classification.text,
        quadrant: classification.quadrant,
        persistence: classification.persistence,
        category: options.category || 'other',
        priority: Math.round(classification.persistenceScore * 100),
        temporalScope: classification.metadata.temporalScope.toUpperCase(),
        active: true,
        source: classification.source === 'user' ? 'user_instruction' : 'automated',
        createdBy: options.createdBy || 'system',
        examples: options.examples || [],
        relatedRules: options.relatedRules || [],
        notes: options.notes || ''
      });

      logger.info('Instruction persisted to MongoDB', {
        id: rule.id,
        quadrant: rule.quadrant,
        persistence: rule.persistence
      });

      return {
        success: true,
        ruleId: rule.id,
        rule: rule.toObject()
      };

    } catch (error) {
      logger.error('Failed to persist instruction', {
        error: error.message,
        text: classification.text.substring(0, 50)
      });
      throw error;
    }
  }

  /**
   * Get classification statistics
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
const classifier = new InstructionPersistenceClassifier();

module.exports = classifier;
