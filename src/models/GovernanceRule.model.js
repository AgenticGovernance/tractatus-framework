/**
 * GovernanceRule Model
 *
 * Stores Tractatus governance instructions (inst_001, inst_016, etc.)
 * Replaces filesystem-based .claude/instruction-history.json
 *
 * Benefits over filesystem:
 * - Fast indexed queries by ID, quadrant, persistence
 * - Atomic updates (no race conditions)
 * - Aggregation for analytics
 * - Built-in replication/backup
 * - Transaction support
 */

const mongoose = require('mongoose');

const governanceRuleSchema = new mongoose.Schema({
  // Rule identification
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    description: 'Unique rule identifier (e.g., inst_016, inst_017)'
  },

  // Rule content
  text: {
    type: String,
    required: true,
    description: 'The governance instruction text'
  },

  // Multi-project governance fields
  scope: {
    type: String,
    enum: ['UNIVERSAL', 'PROJECT_SPECIFIC'],
    default: 'PROJECT_SPECIFIC',
    index: true,
    description: 'Whether this rule applies universally or to specific projects'
  },

  applicableProjects: {
    type: [String],
    default: ['*'],
    description: 'Project IDs this rule applies to (* = all projects)'
  },

  variables: {
    type: [String],
    default: [],
    description: 'Variable names used in rule text (e.g., ["DB_TYPE", "DB_PORT"])'
  },

  // Classification
  quadrant: {
    type: String,
    required: true,
    enum: ['STRATEGIC', 'OPERATIONAL', 'TACTICAL', 'SYSTEM', 'STORAGE'],
    index: true,
    description: 'Tractatus quadrant classification'
  },

  persistence: {
    type: String,
    required: true,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    index: true,
    description: 'Persistence level - how long this rule remains active'
  },

  // Metadata
  category: {
    type: String,
    enum: ['content', 'security', 'privacy', 'technical', 'process', 'values', 'other'],
    default: 'other',
    index: true,
    description: 'Category for filtering and organization'
  },

  priority: {
    type: Number,
    default: 50,
    min: 0,
    max: 100,
    description: 'Priority level (100 = highest, 0 = lowest)'
  },

  // Temporal scope
  temporalScope: {
    type: String,
    enum: ['IMMEDIATE', 'SESSION', 'PROJECT', 'PERMANENT'],
    default: 'PERMANENT',
    description: 'How long this rule applies (IMMEDIATE = one-time, SESSION = this conversation, PROJECT = this project, PERMANENT = always)'
  },

  expiresAt: {
    type: Date,
    default: null,
    description: 'When this rule expires (null = never)'
  },

  // AI Optimization Scores
  clarityScore: {
    type: Number,
    default: null,
    min: 0,
    max: 100,
    description: 'AI-calculated clarity score (0-100)'
  },

  specificityScore: {
    type: Number,
    default: null,
    min: 0,
    max: 100,
    description: 'AI-calculated specificity score (0-100)'
  },

  actionabilityScore: {
    type: Number,
    default: null,
    min: 0,
    max: 100,
    description: 'AI-calculated actionability score (0-100)'
  },

  lastOptimized: {
    type: Date,
    default: null,
    description: 'When this rule was last optimized'
  },

  optimizationHistory: {
    type: [{
      timestamp: Date,
      before: String,
      after: String,
      reason: String,
      scores: {
        clarity: Number,
        specificity: Number,
        actionability: Number
      }
    }],
    default: [],
    description: 'History of AI-driven optimizations'
  },

  // Validation Results
  validationStatus: {
    type: String,
    enum: ['PASSED', 'FAILED', 'NEEDS_REVIEW', 'NOT_VALIDATED'],
    default: 'NOT_VALIDATED',
    description: 'Result of last validation against framework'
  },

  lastValidated: {
    type: Date,
    default: null,
    description: 'When this rule was last validated'
  },

  validationResults: {
    type: {
      classification: {
        passed: Boolean,
        expected: Object,
        actual: Object
      },
      parameterExtraction: {
        passed: Boolean,
        params: Object
      },
      conflictDetection: {
        passed: Boolean,
        conflicts: [String]
      },
      boundaryCheck: {
        passed: Boolean,
        allowed: Boolean
      },
      overallScore: Number
    },
    default: null,
    description: 'Detailed validation test results'
  },

  // Usage Statistics
  usageStats: {
    type: {
      referencedInProjects: {
        type: [String],
        default: []
      },
      timesEnforced: {
        type: Number,
        default: 0
      },
      conflictsDetected: {
        type: Number,
        default: 0
      },
      lastEnforced: {
        type: Date,
        default: null
      }
    },
    default: () => ({
      referencedInProjects: [],
      timesEnforced: 0,
      conflictsDetected: 0,
      lastEnforced: null
    }),
    description: 'Statistics about rule usage across projects'
  },

  // Status
  active: {
    type: Boolean,
    default: true,
    index: true,
    description: 'Whether this rule is currently enforced'
  },

  // Source tracking
  source: {
    type: String,
    enum: ['user_instruction', 'framework_default', 'automated', 'migration', 'claude_md_migration', 'test'],
    default: 'framework_default',
    description: 'How this rule was created'
  },

  createdBy: {
    type: String,
    default: 'system',
    description: 'Who created this rule'
  },

  // Enforcement statistics
  stats: {
    timesChecked: {
      type: Number,
      default: 0,
      description: 'How many times this rule has been evaluated'
    },
    timesViolated: {
      type: Number,
      default: 0,
      description: 'How many times this rule was violated'
    },
    lastChecked: {
      type: Date,
      default: null,
      description: 'When this rule was last evaluated'
    },
    lastViolated: {
      type: Date,
      default: null,
      description: 'When this rule was last violated'
    }
  },

  // Additional context
  examples: {
    type: [String],
    default: [],
    description: 'Example scenarios where this rule applies'
  },

  relatedRules: {
    type: [String],
    default: [],
    description: 'IDs of related rules (e.g., inst_016 relates to inst_017)'
  },

  notes: {
    type: String,
    default: '',
    description: 'Additional notes or clarifications'
  }

}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'governanceRules'
});

// Indexes for common queries
governanceRuleSchema.index({ quadrant: 1, persistence: 1 });
governanceRuleSchema.index({ active: 1, priority: -1 });
governanceRuleSchema.index({ category: 1, active: 1 });
governanceRuleSchema.index({ expiresAt: 1 }, { sparse: true }); // Sparse index for expiry queries

// Multi-project governance indexes
governanceRuleSchema.index({ scope: 1, active: 1 });
governanceRuleSchema.index({ validationStatus: 1, active: 1 });
governanceRuleSchema.index({ clarityScore: -1 }, { sparse: true }); // Descending, for sorting by quality
governanceRuleSchema.index({ 'applicableProjects': 1 }); // For project-specific filtering

// Virtual for checking if rule is expired
governanceRuleSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Static methods

/**
 * Find all active rules
 */
governanceRuleSchema.statics.findActive = function(options = {}) {
  const query = { active: true };

  // Filter out expired rules
  query.$or = [
    { expiresAt: null },
    { expiresAt: { $gt: new Date() } }
  ];

  return this.find(query)
    .sort({ priority: -1, id: 1 })
    .limit(options.limit || 0);
};

/**
 * Find rules by quadrant
 */
governanceRuleSchema.statics.findByQuadrant = function(quadrant, activeOnly = true) {
  const query = { quadrant };

  if (activeOnly) {
    query.active = true;
    query.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ];
  }

  return this.find(query).sort({ priority: -1, id: 1 });
};

/**
 * Find rules by persistence level
 */
governanceRuleSchema.statics.findByPersistence = function(persistence, activeOnly = true) {
  const query = { persistence };

  if (activeOnly) {
    query.active = true;
    query.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ];
  }

  return this.find(query).sort({ priority: -1, id: 1 });
};

/**
 * Find universal rules (apply to all projects)
 */
governanceRuleSchema.statics.findUniversal = function(activeOnly = true) {
  const query = { scope: 'UNIVERSAL' };

  if (activeOnly) {
    query.active = true;
    query.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ];
  }

  return this.find(query).sort({ priority: -1, id: 1 });
};

/**
 * Find rules by scope
 */
governanceRuleSchema.statics.findByScope = function(scope, activeOnly = true) {
  const query = { scope };

  if (activeOnly) {
    query.active = true;
    query.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ];
  }

  return this.find(query).sort({ priority: -1, id: 1 });
};

/**
 * Find rules applicable to a specific project
 */
governanceRuleSchema.statics.findByProject = function(projectId, activeOnly = true) {
  const query = {
    $or: [
      { scope: 'UNIVERSAL' },
      { applicableProjects: projectId },
      { applicableProjects: '*' }
    ]
  };

  if (activeOnly) {
    query.active = true;
    query.$and = [
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }
    ];
  }

  return this.find(query).sort({ priority: -1, id: 1 });
};

/**
 * Find rule by ID
 */
governanceRuleSchema.statics.findByRuleId = function(ruleId) {
  return this.findOne({ id: ruleId, active: true });
};

/**
 * Get rule statistics summary (enhanced for multi-project)
 */
governanceRuleSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    { $match: { active: true } },
    {
      $group: {
        _id: null,
        totalRules: { $sum: 1 },
        byQuadrant: {
          $push: {
            quadrant: '$quadrant',
            count: 1
          }
        },
        byPersistence: {
          $push: {
            persistence: '$persistence',
            count: 1
          }
        },
        byScope: {
          $push: {
            scope: '$scope',
            count: 1
          }
        },
        byValidationStatus: {
          $push: {
            status: '$validationStatus',
            count: 1
          }
        },
        avgClarityScore: { $avg: '$clarityScore' },
        avgSpecificityScore: { $avg: '$specificityScore' },
        avgActionabilityScore: { $avg: '$actionabilityScore' },
        totalChecks: { $sum: '$stats.timesChecked' },
        totalViolations: { $sum: '$stats.timesViolated' }
      }
    }
  ]);

  return stats[0] || null;
};

/**
 * Increment check counter
 */
governanceRuleSchema.methods.incrementChecked = async function() {
  this.stats.timesChecked += 1;
  this.stats.lastChecked = new Date();
  return this.save();
};

/**
 * Increment violation counter
 */
governanceRuleSchema.methods.incrementViolated = async function() {
  this.stats.timesViolated += 1;
  this.stats.lastViolated = new Date();
  return this.save();
};

/**
 * Deactivate rule (soft delete)
 */
governanceRuleSchema.methods.deactivate = async function() {
  this.active = false;
  return this.save();
};

/**
 * Activate rule
 */
governanceRuleSchema.methods.activate = async function() {
  this.active = true;
  return this.save();
};

// Pre-save hook to validate expiration
governanceRuleSchema.pre('save', function(next) {
  // If expiresAt is in the past, deactivate the rule
  if (this.expiresAt && this.expiresAt < new Date()) {
    this.active = false;
  }
  next();
});

const GovernanceRule = mongoose.model('GovernanceRule', governanceRuleSchema);

module.exports = GovernanceRule;
