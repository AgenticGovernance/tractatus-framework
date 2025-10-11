/**
 * AuditLog Model
 *
 * Stores governance enforcement decisions and boundary checks
 * Replaces filesystem-based .memory/audit/decisions-YYYY-MM-DD.jsonl
 *
 * Benefits over JSONL files:
 * - Fast time-range queries (indexed by timestamp)
 * - Aggregation for analytics dashboard
 * - Filter by sessionId, action, allowed status
 * - Join with GovernanceRule for violation analysis
 * - Automatic expiration with TTL index
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Core identification
  sessionId: {
    type: String,
    required: true,
    index: true,
    description: 'Session identifier for tracing related decisions'
  },

  action: {
    type: String,
    required: true,
    index: true,
    description: 'Type of action being audited (e.g., boundary_enforcement, content_generation)'
  },

  // Decision outcome
  allowed: {
    type: Boolean,
    required: true,
    index: true,
    description: 'Whether the action was allowed or blocked'
  },

  // Governance context
  rulesChecked: {
    type: [String],
    default: [],
    description: 'IDs of rules that were evaluated (e.g., [inst_016, inst_017])'
  },

  violations: {
    type: [{
      ruleId: String,
      rulText: String,
      severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM'
      },
      details: String
    }],
    default: [],
    description: 'Rules that were violated (if any)'
  },

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    description: 'Additional context (boundary, domain, tractatus_section, etc.)'
  },

  // Classification
  domain: {
    type: String,
    enum: ['STRATEGIC', 'OPERATIONAL', 'TACTICAL', 'SYSTEM', 'UNKNOWN'],
    default: 'UNKNOWN',
    index: true,
    description: 'Domain of the decision'
  },

  boundary: {
    type: String,
    default: null,
    description: 'Boundary that was checked (if applicable)'
  },

  tractatus_section: {
    type: String,
    default: null,
    index: true,
    description: 'Tractatus framework section that governed this decision'
  },

  // Performance tracking
  durationMs: {
    type: Number,
    default: null,
    description: 'How long the enforcement check took (milliseconds)'
  },

  // Service tracking
  service: {
    type: String,
    default: 'BoundaryEnforcer',
    index: true,
    description: 'Which service performed the audit (BoundaryEnforcer, BlogCuration, etc.)'
  },

  // User context (if applicable)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    description: 'User who triggered the action (if applicable)'
  },

  // IP and request context
  ipAddress: {
    type: String,
    default: null,
    description: 'IP address of request (if applicable)'
  },

  userAgent: {
    type: String,
    default: null,
    description: 'User agent string (if applicable)'
  },

  // Timestamp (auto-created by timestamps: true, but explicit for clarity)
  // Note: Index is defined separately with TTL (line 149), not here
  timestamp: {
    type: Date,
    default: Date.now,
    description: 'When this decision was made'
  }

}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'auditLogs'
});

// Indexes for common queries
auditLogSchema.index({ timestamp: -1 }); // Most recent first
auditLogSchema.index({ sessionId: 1, timestamp: -1 }); // Session timeline
auditLogSchema.index({ allowed: 1, timestamp: -1 }); // Violations timeline
auditLogSchema.index({ service: 1, timestamp: -1 }); // Service-specific logs
auditLogSchema.index({ 'violations.ruleId': 1 }, { sparse: true }); // Violation analysis

// TTL index - automatically delete logs older than 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Virtual for violation count
auditLogSchema.virtual('violationCount').get(function() {
  return this.violations ? this.violations.length : 0;
});

// Static methods

/**
 * Find recent decisions
 */
auditLogSchema.statics.findRecent = function(limit = 100) {
  return this.find()
    .sort({ timestamp: -1 })
    .limit(limit);
};

/**
 * Find decisions by session
 */
auditLogSchema.statics.findBySession = function(sessionId, options = {}) {
  const query = { sessionId };

  return this.find(query)
    .sort({ timestamp: options.ascending ? 1 : -1 })
    .limit(options.limit || 0);
};

/**
 * Find decisions by date range
 */
auditLogSchema.statics.findByDateRange = function(startDate, endDate, options = {}) {
  const query = {
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  };

  if (options.allowed !== undefined) {
    query.allowed = options.allowed;
  }

  if (options.service) {
    query.service = options.service;
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 0);
};

/**
 * Find all violations
 */
auditLogSchema.statics.findViolations = function(options = {}) {
  const query = {
    allowed: false,
    'violations.0': { $exists: true } // Has at least one violation
  };

  if (options.ruleId) {
    query['violations.ruleId'] = options.ruleId;
  }

  if (options.startDate && options.endDate) {
    query.timestamp = {
      $gte: options.startDate,
      $lte: options.endDate
    };
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 0);
};

/**
 * Get statistics for dashboard
 */
auditLogSchema.statics.getStatistics = async function(startDate, endDate) {
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.timestamp = { $gte: startDate, $lte: endDate };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalDecisions: { $sum: 1 },
        allowed: {
          $sum: { $cond: ['$allowed', 1, 0] }
        },
        blocked: {
          $sum: { $cond: ['$allowed', 0, 1] }
        },
        totalViolations: {
          $sum: { $size: { $ifNull: ['$violations', []] } }
        },
        avgDuration: {
          $avg: '$durationMs'
        },
        uniqueSessions: {
          $addToSet: '$sessionId'
        },
        serviceBreakdown: {
          $push: '$service'
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalDecisions: 1,
        allowed: 1,
        blocked: 1,
        totalViolations: 1,
        avgDuration: { $round: ['$avgDuration', 2] },
        uniqueSessionCount: { $size: '$uniqueSessions' },
        allowedRate: {
          $multiply: [
            { $divide: ['$allowed', '$totalDecisions'] },
            100
          ]
        },
        services: '$serviceBreakdown'  // Simplified - just return array for now
      }
    }
  ]);

  return stats[0] || null;
};

/**
 * Get violation breakdown by rule
 */
auditLogSchema.statics.getViolationBreakdown = async function(startDate, endDate) {
  const matchStage = {
    allowed: false,
    'violations.0': { $exists: true }
  };

  if (startDate && endDate) {
    matchStage.timestamp = { $gte: startDate, $lte: endDate };
  }

  const breakdown = await this.aggregate([
    { $match: matchStage },
    { $unwind: '$violations' },
    {
      $group: {
        _id: '$violations.ruleId',
        count: { $sum: 1 },
        severity: { $first: '$violations.severity' },
        examples: {
          $push: {
            sessionId: '$sessionId',
            timestamp: '$timestamp',
            details: '$violations.details'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        ruleId: '$_id',
        count: 1,
        severity: 1,
        recentExamples: { $slice: ['$examples', 5] } // Last 5 examples
      }
    },
    { $sort: { count: -1 } }
  ]);

  return breakdown;
};

/**
 * Get timeline data (for charts)
 */
auditLogSchema.statics.getTimeline = async function(startDate, endDate, intervalHours = 1) {
  const timeline = await this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: '$timestamp',
            unit: 'hour',
            binSize: intervalHours
          }
        },
        total: { $sum: 1 },
        allowed: { $sum: { $cond: ['$allowed', 1, 0] } },
        blocked: { $sum: { $cond: ['$allowed', 0, 1] } },
        violations: {
          $sum: { $size: { $ifNull: ['$violations', []] } }
        }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        timestamp: '$_id',
        total: 1,
        allowed: 1,
        blocked: 1,
        violations: 1,
        allowedRate: {
          $multiply: [
            { $divide: ['$allowed', '$total'] },
            100
          ]
        }
      }
    }
  ]);

  return timeline;
};

// Instance methods

/**
 * Add a violation to this log entry
 */
auditLogSchema.methods.addViolation = function(violation) {
  this.violations.push(violation);
  this.allowed = false; // Violations mean action blocked
  return this.save();
};

/**
 * Check if this decision was blocked
 */
auditLogSchema.methods.isBlocked = function() {
  return !this.allowed;
};

/**
 * Get human-readable summary
 */
auditLogSchema.methods.getSummary = function() {
  return {
    timestamp: this.timestamp.toISOString(),
    sessionId: this.sessionId,
    action: this.action,
    result: this.allowed ? 'ALLOWED' : 'BLOCKED',
    violationCount: this.violationCount,
    service: this.service,
    domain: this.domain
  };
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
