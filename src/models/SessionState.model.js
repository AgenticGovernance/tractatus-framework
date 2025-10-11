/**
 * SessionState Model
 *
 * Stores context pressure monitoring state for Tractatus sessions
 * Used by ContextPressureMonitor to persist pressure analysis history
 *
 * Benefits over in-memory storage:
 * - Survives application restarts
 * - Historical pressure analysis across sessions
 * - Identify problematic time periods
 * - Session recovery and continuation
 * - Analytics on pressure trends
 */

const mongoose = require('mongoose');

const sessionStateSchema = new mongoose.Schema({
  // Session identification
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    description: 'Unique session identifier'
  },

  // Current pressure state
  currentPressure: {
    overallScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
      description: 'Overall weighted pressure score (0-1)'
    },
    pressureLevel: {
      type: String,
      enum: ['NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL', 'DANGEROUS'],
      default: 'NORMAL',
      description: 'Current pressure level'
    },
    pressureLevelNumeric: {
      type: Number,
      default: 0,
      min: 0,
      max: 4,
      description: 'Numeric pressure level (0=NORMAL, 4=DANGEROUS)'
    }
  },

  // Metric snapshots
  metrics: {
    tokenUsage: {
      score: { type: Number, default: 0 },
      raw: { type: Number, default: 0 },
      budget: { type: Number, default: 200000 }
    },
    conversationLength: {
      score: { type: Number, default: 0 },
      raw: { type: Number, default: 0 },
      threshold: { type: Number, default: 100 }
    },
    taskComplexity: {
      score: { type: Number, default: 0 },
      raw: { type: Number, default: 0 },
      factors: [String]
    },
    errorFrequency: {
      score: { type: Number, default: 0 },
      raw: { type: Number, default: 0 },
      recentErrors: { type: Number, default: 0 }
    },
    instructionDensity: {
      score: { type: Number, default: 0 },
      raw: { type: Number, default: 0 }
    }
  },

  // Pressure history (last 50 analyses)
  pressureHistory: [{
    timestamp: { type: Date, required: true },
    overallScore: { type: Number, required: true },
    pressureLevel: { type: String, required: true },
    trend: {
      type: String,
      enum: ['escalating', 'stable', 'improving', 'unknown'],
      default: 'unknown'
    },
    topMetric: String,
    warnings: [String]
  }],

  // Error history (last 20 errors)
  errorHistory: [{
    timestamp: { type: Date, required: true },
    error: { type: String, required: true },
    type: {
      type: String,
      default: 'unknown',
      description: 'Error type/category'
    }
  }],

  // Session metadata
  startedAt: {
    type: Date,
    default: Date.now,
    description: 'When this session started'
  },

  lastAnalysisAt: {
    type: Date,
    default: Date.now,
    description: 'Last pressure analysis timestamp'
  },

  totalAnalyses: {
    type: Number,
    default: 0,
    description: 'Total number of pressure analyses in this session'
  },

  totalErrors: {
    type: Number,
    default: 0,
    description: 'Total errors recorded in this session'
  },

  // Pressure level statistics
  levelStats: {
    NORMAL: { type: Number, default: 0 },
    ELEVATED: { type: Number, default: 0 },
    HIGH: { type: Number, default: 0 },
    CRITICAL: { type: Number, default: 0 },
    DANGEROUS: { type: Number, default: 0 }
  },

  // Peak pressure tracking
  peakPressure: {
    score: { type: Number, default: 0 },
    level: { type: String, default: 'NORMAL' },
    timestamp: { type: Date, default: null }
  },

  // Status
  active: {
    type: Boolean,
    default: true,
    description: 'Whether this session is currently active'
  },

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    description: 'Additional session context'
  }

}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'sessionStates'
});

// Indexes
sessionStateSchema.index({ sessionId: 1, active: 1 });
sessionStateSchema.index({ lastAnalysisAt: -1 });
sessionStateSchema.index({ 'currentPressure.pressureLevel': 1 });
sessionStateSchema.index({ active: 1, startedAt: -1 });

// TTL index - auto-delete inactive sessions after 30 days
sessionStateSchema.index(
  { lastAnalysisAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { active: false } }
);

// Virtual for session duration
sessionStateSchema.virtual('sessionDuration').get(function() {
  if (!this.startedAt) return 0;
  const endTime = this.active ? new Date() : (this.lastAnalysisAt || new Date());
  return endTime - this.startedAt;
});

// Virtual for average pressure
sessionStateSchema.virtual('averagePressure').get(function() {
  if (!this.pressureHistory || this.pressureHistory.length === 0) return 0;
  const sum = this.pressureHistory.reduce((acc, h) => acc + h.overallScore, 0);
  return sum / this.pressureHistory.length;
});

// Static methods

/**
 * Find or create session state
 */
sessionStateSchema.statics.findOrCreate = async function(sessionId, metadata = {}) {
  let session = await this.findOne({ sessionId, active: true });

  if (!session) {
    session = await this.create({
      sessionId,
      metadata,
      active: true
    });
  }

  return session;
};

/**
 * Find active session
 */
sessionStateSchema.statics.findActiveSession = function(sessionId) {
  return this.findOne({ sessionId, active: true });
};

/**
 * Find sessions by pressure level
 */
sessionStateSchema.statics.findByPressureLevel = function(pressureLevel, activeOnly = true) {
  const query = { 'currentPressure.pressureLevel': pressureLevel };
  if (activeOnly) {
    query.active = true;
  }
  return this.find(query).sort({ lastAnalysisAt: -1 });
};

/**
 * Get high-pressure sessions
 */
sessionStateSchema.statics.findHighPressureSessions = function() {
  return this.find({
    active: true,
    'currentPressure.pressureLevelNumeric': { $gte: 2 } // HIGH or worse
  }).sort({ 'currentPressure.pressureLevelNumeric': -1, lastAnalysisAt: -1 });
};

/**
 * Get session statistics
 */
sessionStateSchema.statics.getSessionStatistics = async function(startDate, endDate) {
  const matchStage = { active: true };

  if (startDate && endDate) {
    matchStage.lastAnalysisAt = { $gte: startDate, $lte: endDate };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalAnalyses: { $sum: '$totalAnalyses' },
        totalErrors: { $sum: '$totalErrors' },
        avgPressure: { $avg: '$currentPressure.overallScore' },
        maxPressure: { $max: '$currentPressure.overallScore' },
        levelCounts: {
          $push: {
            NORMAL: '$levelStats.NORMAL',
            ELEVATED: '$levelStats.ELEVATED',
            HIGH: '$levelStats.HIGH',
            CRITICAL: '$levelStats.CRITICAL',
            DANGEROUS: '$levelStats.DANGEROUS'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalSessions: 1,
        totalAnalyses: 1,
        totalErrors: 1,
        avgPressure: { $round: ['$avgPressure', 3] },
        maxPressure: { $round: ['$maxPressure', 3] },
        errorRate: {
          $cond: [
            { $gt: ['$totalAnalyses', 0] },
            { $divide: ['$totalErrors', '$totalAnalyses'] },
            0
          ]
        }
      }
    }
  ]);

  return stats[0] || null;
};

// Instance methods

/**
 * Update pressure state from analysis
 */
sessionStateSchema.methods.updatePressure = async function(analysis) {
  // Update current pressure
  this.currentPressure.overallScore = analysis.overallPressure || analysis.overall_score;
  this.currentPressure.pressureLevel = analysis.pressureName || analysis.level;
  this.currentPressure.pressureLevelNumeric = analysis.pressureLevel;

  // Update metrics
  if (analysis.metrics) {
    if (analysis.metrics.tokenUsage) {
      this.metrics.tokenUsage.score = analysis.metrics.tokenUsage.normalized || analysis.metrics.tokenUsage.score;
      this.metrics.tokenUsage.raw = analysis.metrics.tokenUsage.raw;
      this.metrics.tokenUsage.budget = analysis.metrics.tokenUsage.budget;
    }
    if (analysis.metrics.conversationLength) {
      this.metrics.conversationLength.score = analysis.metrics.conversationLength.normalized || analysis.metrics.conversationLength.score;
      this.metrics.conversationLength.raw = analysis.metrics.conversationLength.raw;
    }
    if (analysis.metrics.taskComplexity) {
      this.metrics.taskComplexity.score = analysis.metrics.taskComplexity.normalized || analysis.metrics.taskComplexity.score;
      this.metrics.taskComplexity.raw = analysis.metrics.taskComplexity.raw;
      if (analysis.metrics.taskComplexity.factors) {
        this.metrics.taskComplexity.factors = analysis.metrics.taskComplexity.factors;
      }
    }
    if (analysis.metrics.errorFrequency) {
      this.metrics.errorFrequency.score = analysis.metrics.errorFrequency.normalized || analysis.metrics.errorFrequency.score;
      this.metrics.errorFrequency.raw = analysis.metrics.errorFrequency.raw;
      this.metrics.errorFrequency.recentErrors = analysis.metrics.errorFrequency.recent_errors || analysis.metrics.errorFrequency.raw;
    }
    if (analysis.metrics.instructionDensity) {
      this.metrics.instructionDensity.score = analysis.metrics.instructionDensity.normalized || analysis.metrics.instructionDensity.score;
      this.metrics.instructionDensity.raw = analysis.metrics.instructionDensity.raw;
    }
  }

  // Add to pressure history (keep last 50)
  this.pressureHistory.unshift({
    timestamp: analysis.timestamp || new Date(),
    overallScore: this.currentPressure.overallScore,
    pressureLevel: this.currentPressure.pressureLevel,
    trend: analysis.trend || 'unknown',
    topMetric: this._getTopMetric(analysis.metrics),
    warnings: analysis.warnings || []
  });

  if (this.pressureHistory.length > 50) {
    this.pressureHistory = this.pressureHistory.slice(0, 50);
  }

  // Update statistics
  this.lastAnalysisAt = new Date();
  this.totalAnalyses++;
  this.levelStats[this.currentPressure.pressureLevel]++;

  // Update peak pressure if exceeded
  if (this.currentPressure.overallScore > this.peakPressure.score) {
    this.peakPressure.score = this.currentPressure.overallScore;
    this.peakPressure.level = this.currentPressure.pressureLevel;
    this.peakPressure.timestamp = new Date();
  }

  return this.save();
};

/**
 * Add error to history
 */
sessionStateSchema.methods.addError = async function(error) {
  this.errorHistory.unshift({
    timestamp: new Date(),
    error: error.message || String(error),
    type: error.type || 'unknown'
  });

  // Keep last 20 errors
  if (this.errorHistory.length > 20) {
    this.errorHistory = this.errorHistory.slice(0, 20);
  }

  this.totalErrors++;

  return this.save();
};

/**
 * Close session
 */
sessionStateSchema.methods.close = async function() {
  this.active = false;
  this.lastAnalysisAt = new Date();
  return this.save();
};

/**
 * Get session summary
 */
sessionStateSchema.methods.getSummary = function() {
  return {
    sessionId: this.sessionId,
    duration: this.sessionDuration,
    totalAnalyses: this.totalAnalyses,
    totalErrors: this.totalErrors,
    currentPressure: this.currentPressure.pressureLevel,
    averagePressure: this.averagePressure,
    peakPressure: this.peakPressure.level,
    active: this.active,
    startedAt: this.startedAt,
    lastAnalysisAt: this.lastAnalysisAt
  };
};

/**
 * Helper: Get top contributing metric
 * @private
 */
sessionStateSchema.methods._getTopMetric = function(metrics) {
  if (!metrics) return 'unknown';

  const scores = [
    { name: 'tokenUsage', score: metrics.tokenUsage?.normalized || metrics.tokenUsage?.score || 0 },
    { name: 'conversationLength', score: metrics.conversationLength?.normalized || metrics.conversationLength?.score || 0 },
    { name: 'taskComplexity', score: metrics.taskComplexity?.normalized || metrics.taskComplexity?.score || 0 },
    { name: 'errorFrequency', score: metrics.errorFrequency?.normalized || metrics.errorFrequency?.score || 0 },
    { name: 'instructionDensity', score: metrics.instructionDensity?.normalized || metrics.instructionDensity?.score || 0 }
  ];

  scores.sort((a, b) => b.score - a.score);
  return scores[0].name;
};

const SessionState = mongoose.model('SessionState', sessionStateSchema);

module.exports = SessionState;
