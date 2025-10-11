/**
 * VariableValue Model
 *
 * Stores project-specific values for variables used in governance rules.
 * Enables context-aware rule rendering through variable substitution.
 *
 * Example:
 * - Rule template: "Use database ${DB_NAME} on port ${DB_PORT}"
 * - Project "tractatus": DB_NAME="tractatus_dev", DB_PORT="27017"
 * - Rendered: "Use database tractatus_dev on port 27017"
 */

const mongoose = require('mongoose');

const variableValueSchema = new mongoose.Schema({
  // Foreign key to Project
  projectId: {
    type: String,
    required: true,
    index: true,
    lowercase: true,
    trim: true,
    description: 'Project identifier (FK to projects.id)'
  },

  // Variable identification
  variableName: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Variable names must be UPPER_SNAKE_CASE
        return /^[A-Z][A-Z0-9_]*$/.test(v);
      },
      message: 'Variable name must be UPPER_SNAKE_CASE (e.g., "DB_NAME", "API_KEY")'
    },
    description: 'Variable name in UPPER_SNAKE_CASE format'
  },

  // Variable value
  value: {
    type: String,
    required: true,
    description: 'Actual value for this variable in this project context'
  },

  // Metadata
  description: {
    type: String,
    default: '',
    maxlength: 200,
    description: 'Human-readable description of what this variable represents'
  },

  category: {
    type: String,
    enum: ['database', 'security', 'config', 'path', 'url', 'port', 'credential', 'feature_flag', 'other'],
    default: 'other',
    index: true,
    description: 'Category for organizing variables'
  },

  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'path', 'url', 'email', 'json'],
    default: 'string',
    description: 'Expected data type of the value'
  },

  // Validation rules (optional)
  validationRules: {
    type: {
      required: {
        type: Boolean,
        default: true,
        description: 'Whether this variable is required for the project'
      },
      pattern: {
        type: String,
        default: '',
        description: 'Regex pattern the value must match (optional)'
      },
      minLength: {
        type: Number,
        default: null,
        description: 'Minimum length for string values'
      },
      maxLength: {
        type: Number,
        default: null,
        description: 'Maximum length for string values'
      },
      enum: {
        type: [String],
        default: [],
        description: 'List of allowed values (optional)'
      }
    },
    default: () => ({
      required: true,
      pattern: '',
      minLength: null,
      maxLength: null,
      enum: []
    }),
    description: 'Validation rules for this variable value'
  },

  // Usage tracking
  usageCount: {
    type: Number,
    default: 0,
    description: 'Number of rules that use this variable'
  },

  lastUsed: {
    type: Date,
    default: null,
    description: 'Last time this variable was used in rule substitution'
  },

  // Status
  active: {
    type: Boolean,
    default: true,
    index: true,
    description: 'Whether this variable value is currently active'
  },

  // Audit fields
  createdBy: {
    type: String,
    default: 'system',
    description: 'Who created this variable value'
  },

  updatedBy: {
    type: String,
    default: 'system',
    description: 'Who last updated this variable value'
  }

}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'variableValues'
});

// Compound unique index: One value per variable per project
variableValueSchema.index({ projectId: 1, variableName: 1 }, { unique: true });

// Additional indexes for common queries
variableValueSchema.index({ projectId: 1, active: 1 });
variableValueSchema.index({ variableName: 1, active: 1 });
variableValueSchema.index({ category: 1 });

// Static methods

/**
 * Find all variables for a project
 * @param {string} projectId - Project identifier
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
variableValueSchema.statics.findByProject = function(projectId, options = {}) {
  const query = {
    projectId: projectId.toLowerCase(),
    active: true
  };

  if (options.category) {
    query.category = options.category;
  }

  return this.find(query)
    .sort({ variableName: 1 })
    .limit(options.limit || 0);
};

/**
 * Find value for specific variable in project
 * @param {string} projectId - Project identifier
 * @param {string} variableName - Variable name
 * @returns {Promise<Object|null>}
 */
variableValueSchema.statics.findValue = function(projectId, variableName) {
  return this.findOne({
    projectId: projectId.toLowerCase(),
    variableName: variableName.toUpperCase(),
    active: true
  });
};

/**
 * Find values for multiple variables in project
 * @param {string} projectId - Project identifier
 * @param {Array<string>} variableNames - Array of variable names
 * @returns {Promise<Array>}
 */
variableValueSchema.statics.findValues = function(projectId, variableNames) {
  return this.find({
    projectId: projectId.toLowerCase(),
    variableName: { $in: variableNames.map(v => v.toUpperCase()) },
    active: true
  });
};

/**
 * Get all unique variable names across all projects
 * @returns {Promise<Array<string>>}
 */
variableValueSchema.statics.getAllVariableNames = async function() {
  const result = await this.distinct('variableName', { active: true });
  return result.sort();
};

/**
 * Get variable usage statistics
 * @returns {Promise<Array>}
 */
variableValueSchema.statics.getUsageStatistics = async function() {
  return this.aggregate([
    { $match: { active: true } },
    {
      $group: {
        _id: '$variableName',
        projectCount: { $sum: 1 },
        totalUsage: { $sum: '$usageCount' },
        categories: { $addToSet: '$category' }
      }
    },
    { $sort: { totalUsage: -1 } }
  ]);
};

/**
 * Upsert (update or insert) variable value
 * @param {string} projectId - Project identifier
 * @param {string} variableName - Variable name
 * @param {Object} valueData - Variable value data
 * @returns {Promise<Object>}
 */
variableValueSchema.statics.upsertValue = async function(projectId, variableName, valueData) {
  const { value, description, category, dataType, validationRules } = valueData;

  return this.findOneAndUpdate(
    {
      projectId: projectId.toLowerCase(),
      variableName: variableName.toUpperCase()
    },
    {
      $set: {
        value,
        description: description || '',
        category: category || 'other',
        dataType: dataType || 'string',
        validationRules: validationRules || {},
        updatedBy: valueData.updatedBy || 'system',
        active: true
      },
      $setOnInsert: {
        createdBy: valueData.createdBy || 'system',
        usageCount: 0,
        lastUsed: null
      }
    },
    {
      upsert: true,
      new: true,
      runValidators: true
    }
  );
};

// Instance methods

/**
 * Validate value against validation rules
 * @returns {Object} {valid: boolean, errors: Array<string>}
 */
variableValueSchema.methods.validateValue = function() {
  const errors = [];
  const { value } = this;
  const rules = this.validationRules;

  // Check required
  if (rules.required && (!value || value.trim() === '')) {
    errors.push('Value is required');
  }

  // Check pattern
  if (rules.pattern && value) {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(value)) {
      errors.push(`Value does not match pattern: ${rules.pattern}`);
    }
  }

  // Check length
  if (rules.minLength && value.length < rules.minLength) {
    errors.push(`Value must be at least ${rules.minLength} characters`);
  }

  if (rules.maxLength && value.length > rules.maxLength) {
    errors.push(`Value must be at most ${rules.maxLength} characters`);
  }

  // Check enum
  if (rules.enum && rules.enum.length > 0 && !rules.enum.includes(value)) {
    errors.push(`Value must be one of: ${rules.enum.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Increment usage counter
 * @returns {Promise<Object>}
 */
variableValueSchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

/**
 * Deactivate variable value (soft delete)
 * @returns {Promise<Object>}
 */
variableValueSchema.methods.deactivate = async function() {
  this.active = false;
  this.updatedBy = 'system';
  return this.save();
};

// Pre-save hook to ensure consistent casing
variableValueSchema.pre('save', function(next) {
  if (this.projectId) {
    this.projectId = this.projectId.toLowerCase();
  }
  if (this.variableName) {
    this.variableName = this.variableName.toUpperCase();
  }
  next();
});

const VariableValue = mongoose.model('VariableValue', variableValueSchema);

module.exports = VariableValue;
