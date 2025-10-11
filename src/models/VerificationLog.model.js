/**
 * VerificationLog Model
 *
 * Stores metacognitive verification results for Tractatus actions
 * Used by MetacognitiveVerifier to persist verification history
 *
 * Benefits over in-memory storage:
 * - Historical verification analysis
 * - Identify patterns of low-confidence decisions
 * - Track which dimensions fail most often
 * - Analytics on verification trends
 * - Session recovery and audit trail
 */

const mongoose = require('mongoose');

const verificationLogSchema = new mongoose.Schema({
  // Session identification
  sessionId: {
    type: String,
    required: true,
    index: true,
    description: 'Session identifier for related verifications'
  },

  // Action being verified
  action: {
    description: String,
    type: String,
    command: String,
    parameters: mongoose.Schema.Types.Mixed,
    required: false
  },

  // Verification results
  decision: {
    type: String,
    enum: ['PROCEED', 'PROCEED_WITH_CAUTION', 'REQUEST_CONFIRMATION', 'REQUEST_CLARIFICATION', 'REQUIRE_REVIEW', 'BLOCK'],
    required: true,
    index: true,
    description: 'Verification decision'
  },

  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    description: 'Final adjusted confidence score (0-1)'
  },

  originalConfidence: {
    type: Number,
    default: null,
    min: 0,
    max: 1,
    description: 'Original confidence before pressure adjustment'
  },

  level: {
    type: String,
    enum: ['HIGH', 'PROCEED', 'PROCEED_WITH_CAUTION', 'REQUEST_CONFIRMATION', 'REQUIRE_REVIEW', 'VERY_LOW'],
    default: 'PROCEED',
    description: 'Confidence level'
  },

  // Verification checks
  checks: {
    alignment: {
      passed: { type: Boolean, required: true },
      score: { type: Number, required: true, min: 0, max: 1 },
      issues: [String]
    },
    coherence: {
      passed: { type: Boolean, required: true },
      score: { type: Number, required: true, min: 0, max: 1 },
      issues: [String]
    },
    completeness: {
      passed: { type: Boolean, required: true },
      score: { type: Number, required: true, min: 0, max: 1 },
      missing: [String]
    },
    safety: {
      passed: { type: Boolean, required: true },
      score: { type: Number, required: true, min: 0, max: 1 },
      riskLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'],
        default: 'UNKNOWN'
      },
      concerns: [String]
    },
    alternatives: {
      passed: { type: Boolean, required: true },
      score: { type: Number, required: true, min: 0, max: 1 },
      issues: [String]
    }
  },

  // Critical failures
  criticalFailures: [{
    dimension: {
      type: String,
      required: true,
      description: 'Which dimension failed (Alignment, Coherence, etc.)'
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    threshold: {
      type: Number,
      required: true
    },
    severity: {
      type: String,
      enum: ['WARNING', 'HIGH', 'CRITICAL'],
      required: true
    }
  }],

  // Context
  pressureLevel: {
    type: String,
    enum: ['NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL', 'DANGEROUS', 'UNKNOWN'],
    default: 'UNKNOWN',
    index: true,
    description: 'Context pressure level at time of verification'
  },

  pressureAdjustment: {
    type: Number,
    default: 0,
    description: 'How much confidence was adjusted due to pressure'
  },

  // Recommendations
  recommendations: [{
    type: {
      type: String,
      description: 'Recommendation type'
    },
    dimension: String,
    severity: String,
    message: String,
    action: String
  }],

  // Reasoning quality (if provided)
  reasoning: {
    quality: { type: Number, min: 0, max: 1 },
    hasSteps: Boolean,
    hasEvidence: Boolean,
    hasAlternatives: Boolean
  },

  // Outcome tracking
  wasExecuted: {
    type: Boolean,
    default: false,
    description: 'Whether the action was ultimately executed'
  },

  executionOutcome: {
    type: String,
    enum: ['success', 'failure', 'cancelled', 'pending', 'unknown'],
    default: 'unknown',
    description: 'Outcome if action was executed'
  },

  executionNotes: {
    type: String,
    default: '',
    description: 'Notes about execution outcome'
  },

  // User override tracking
  userOverride: {
    type: Boolean,
    default: false,
    description: 'Whether user overrode the verification decision'
  },

  userOverrideReason: {
    type: String,
    default: null,
    description: 'Why user overrode (if applicable)'
  },

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    description: 'Additional verification context'
  },

  // Timestamp
  verifiedAt: {
    type: Date,
    default: Date.now,
    index: true,
    description: 'When verification was performed'
  }

}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'verificationLogs'
});

// Indexes
verificationLogSchema.index({ sessionId: 1, verifiedAt: -1 });
verificationLogSchema.index({ decision: 1, verifiedAt: -1 });
verificationLogSchema.index({ confidence: 1 });
verificationLogSchema.index({ 'checks.safety.riskLevel': 1 });
verificationLogSchema.index({ pressureLevel: 1, decision: 1 });
verificationLogSchema.index({ 'criticalFailures.dimension': 1 }, { sparse: true });

// TTL index - auto-delete logs older than 90 days
verificationLogSchema.index({ verifiedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Virtuals

/**
 * Check if verification failed (confidence below thresholds)
 */
verificationLogSchema.virtual('failed').get(function() {
  return this.decision === 'BLOCK' || this.decision === 'REQUIRE_REVIEW';
});

/**
 * Get failed check names
 */
verificationLogSchema.virtual('failedChecks').get(function() {
  const failed = [];
  if (this.checks) {
    if (!this.checks.alignment.passed) failed.push('alignment');
    if (!this.checks.coherence.passed) failed.push('coherence');
    if (!this.checks.completeness.passed) failed.push('completeness');
    if (!this.checks.safety.passed) failed.push('safety');
    if (!this.checks.alternatives.passed) failed.push('alternatives');
  }
  return failed;
});

/**
 * Get confidence quality label
 */
verificationLogSchema.virtual('confidenceQuality').get(function() {
  if (this.confidence >= 0.8) return 'excellent';
  if (this.confidence >= 0.6) return 'good';
  if (this.confidence >= 0.4) return 'fair';
  return 'poor';
});

// Static methods

/**
 * Find verifications by session
 */
verificationLogSchema.statics.findBySession = function(sessionId, options = {}) {
  const query = { sessionId };

  return this.find(query)
    .sort({ verifiedAt: options.ascending ? 1 : -1 })
    .limit(options.limit || 0);
};

/**
 * Find verifications by decision type
 */
verificationLogSchema.statics.findByDecision = function(decision, options = {}) {
  const query = { decision };

  if (options.startDate && options.endDate) {
    query.verifiedAt = {
      $gte: options.startDate,
      $lte: options.endDate
    };
  }

  return this.find(query)
    .sort({ verifiedAt: -1 })
    .limit(options.limit || 0);
};

/**
 * Find low-confidence verifications
 */
verificationLogSchema.statics.findLowConfidence = function(threshold = 0.6, options = {}) {
  const query = { confidence: { $lt: threshold } };

  if (options.startDate && options.endDate) {
    query.verifiedAt = {
      $gte: options.startDate,
      $lte: options.endDate
    };
  }

  return this.find(query)
    .sort({ confidence: 1, verifiedAt: -1 })
    .limit(options.limit || 0);
};

/**
 * Find verifications with critical failures
 */
verificationLogSchema.statics.findCriticalFailures = function(options = {}) {
  const query = {
    'criticalFailures.severity': 'CRITICAL'
  };

  if (options.dimension) {
    query['criticalFailures.dimension'] = options.dimension;
  }

  if (options.startDate && options.endDate) {
    query.verifiedAt = {
      $gte: options.startDate,
      $lte: options.endDate
    };
  }

  return this.find(query)
    .sort({ verifiedAt: -1 })
    .limit(options.limit || 0);
};

/**
 * Find high-risk verifications
 */
verificationLogSchema.statics.findHighRisk = function(options = {}) {
  const query = {
    'checks.safety.riskLevel': { $in: ['HIGH', 'CRITICAL'] }
  };

  if (options.startDate && options.endDate) {
    query.verifiedAt = {
      $gte: options.startDate,
      $lte: options.endDate
    };
  }

  return this.find(query)
    .sort({ verifiedAt: -1 })
    .limit(options.limit || 0);
};

/**
 * Get verification statistics
 */
verificationLogSchema.statics.getStatistics = async function(startDate, endDate) {
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.verifiedAt = { $gte: startDate, $lte: endDate };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalVerifications: { $sum: 1 },
        avgConfidence: { $avg: '$confidence' },
        minConfidence: { $min: '$confidence' },
        maxConfidence: { $max: '$confidence' },
        byDecision: {
          $push: {
            decision: '$decision',
            confidence: '$confidence'
          }
        },
        byPressure: {
          $push: {
            pressureLevel: '$pressureLevel',
            confidence: '$confidence'
          }
        },
        criticalFailureCount: {
          $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$criticalFailures', []] } }, 0] }, 1, 0] }
        },
        lowConfidenceCount: {
          $sum: { $cond: [{ $lt: ['$confidence', 0.6] }, 1, 0] }
        },
        blockedCount: {
          $sum: { $cond: [{ $eq: ['$decision', 'BLOCK'] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalVerifications: 1,
        avgConfidence: { $round: ['$avgConfidence', 3] },
        minConfidence: { $round: ['$minConfidence', 3] },
        maxConfidence: { $round: ['$maxConfidence', 3] },
        criticalFailureCount: 1,
        lowConfidenceCount: 1,
        blockedCount: 1,
        lowConfidenceRate: {
          $cond: [
            { $gt: ['$totalVerifications', 0] },
            { $multiply: [{ $divide: ['$lowConfidenceCount', '$totalVerifications'] }, 100] },
            0
          ]
        },
        blockRate: {
          $cond: [
            { $gt: ['$totalVerifications', 0] },
            { $multiply: [{ $divide: ['$blockedCount', '$totalVerifications'] }, 100] },
            0
          ]
        }
      }
    }
  ]);

  return stats[0] || null;
};

/**
 * Get dimension failure breakdown
 */
verificationLogSchema.statics.getDimensionBreakdown = async function(startDate, endDate) {
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.verifiedAt = { $gte: startDate, $lte: endDate };
  }

  const breakdown = await this.aggregate([
    { $match: matchStage },
    {
      $project: {
        alignment: { $cond: ['$checks.alignment.passed', 0, 1] },
        coherence: { $cond: ['$checks.coherence.passed', 0, 1] },
        completeness: { $cond: ['$checks.completeness.passed', 0, 1] },
        safety: { $cond: ['$checks.safety.passed', 0, 1] },
        alternatives: { $cond: ['$checks.alternatives.passed', 0, 1] },
        alignmentScore: '$checks.alignment.score',
        coherenceScore: '$checks.coherence.score',
        completenessScore: '$checks.completeness.score',
        safetyScore: '$checks.safety.score',
        alternativesScore: '$checks.alternatives.score'
      }
    },
    {
      $group: {
        _id: null,
        alignmentFailures: { $sum: '$alignment' },
        coherenceFailures: { $sum: '$coherence' },
        completenessFailures: { $sum: '$completeness' },
        safetyFailures: { $sum: '$safety' },
        alternativesFailures: { $sum: '$alternatives' },
        avgAlignmentScore: { $avg: '$alignmentScore' },
        avgCoherenceScore: { $avg: '$coherenceScore' },
        avgCompletenessScore: { $avg: '$completenessScore' },
        avgSafetyScore: { $avg: '$safetyScore' },
        avgAlternativesScore: { $avg: '$alternativesScore' }
      }
    },
    {
      $project: {
        _id: 0,
        alignmentFailures: 1,
        coherenceFailures: 1,
        completenessFailures: 1,
        safetyFailures: 1,
        alternativesFailures: 1,
        avgAlignmentScore: { $round: ['$avgAlignmentScore', 3] },
        avgCoherenceScore: { $round: ['$avgCoherenceScore', 3] },
        avgCompletenessScore: { $round: ['$avgCompletenessScore', 3] },
        avgSafetyScore: { $round: ['$avgSafetyScore', 3] },
        avgAlternativesScore: { $round: ['$avgAlternativesScore', 3] }
      }
    }
  ]);

  return breakdown[0] || null;
};

// Instance methods

/**
 * Mark action as executed
 */
verificationLogSchema.methods.markExecuted = async function(outcome, notes = '') {
  this.wasExecuted = true;
  this.executionOutcome = outcome;
  this.executionNotes = notes;
  return this.save();
};

/**
 * Record user override
 */
verificationLogSchema.methods.recordOverride = async function(reason) {
  this.userOverride = true;
  this.userOverrideReason = reason;
  return this.save();
};

/**
 * Get verification summary
 */
verificationLogSchema.methods.getSummary = function() {
  return {
    sessionId: this.sessionId,
    decision: this.decision,
    confidence: this.confidence,
    confidenceQuality: this.confidenceQuality,
    failedChecks: this.failedChecks,
    criticalFailures: this.criticalFailures.length,
    pressureLevel: this.pressureLevel,
    wasExecuted: this.wasExecuted,
    executionOutcome: this.executionOutcome,
    verifiedAt: this.verifiedAt
  };
};

const VerificationLog = mongoose.model('VerificationLog', verificationLogSchema);

module.exports = VerificationLog;
