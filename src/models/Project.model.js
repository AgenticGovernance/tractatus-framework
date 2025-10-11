/**
 * Project Model
 *
 * Stores metadata for projects using the Tractatus governance system.
 * Each project can have its own variable values for context-aware rule rendering.
 *
 * Benefits:
 * - Multi-project governance support
 * - Context-aware variable substitution
 * - Centralized project metadata
 * - Tech stack tracking for rule applicability
 */

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  // Project identification
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Slug format: lowercase letters, numbers, hyphens
        return /^[a-z0-9-]+$/.test(v);
      },
      message: 'Project ID must be lowercase alphanumeric with hyphens only (e.g., "tractatus", "family-history")'
    },
    description: 'Unique project identifier (slug format, e.g., "tractatus", "family-history")'
  },

  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100,
    description: 'Human-readable project name (e.g., "Tractatus Framework")'
  },

  description: {
    type: String,
    default: '',
    maxlength: 500,
    description: 'Brief description of the project and its purpose'
  },

  // Technology stack information
  techStack: {
    type: {
      language: {
        type: String,
        default: '',
        description: 'Primary programming language (e.g., "JavaScript", "Python")'
      },
      framework: {
        type: String,
        default: '',
        description: 'Main framework (e.g., "Node.js/Express", "Django", "React")'
      },
      database: {
        type: String,
        default: '',
        description: 'Database system (e.g., "MongoDB", "PostgreSQL", "MySQL")'
      },
      frontend: {
        type: String,
        default: '',
        description: 'Frontend technology (e.g., "Vanilla JS", "React", "Vue")'
      },
      other: {
        type: [String],
        default: [],
        description: 'Other notable technologies or tools'
      }
    },
    default: () => ({
      language: '',
      framework: '',
      database: '',
      frontend: '',
      other: []
    }),
    description: 'Technology stack used by this project'
  },

  // Repository information
  repositoryUrl: {
    type: String,
    default: '',
    validate: {
      validator: function(v) {
        if (!v) return true; // Empty is valid
        // Basic URL validation
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Repository URL must be a valid URL'
    },
    description: 'Git repository URL (e.g., "https://github.com/user/repo")'
  },

  // Metadata
  metadata: {
    type: {
      defaultBranch: {
        type: String,
        default: 'main',
        description: 'Default git branch (e.g., "main", "master", "develop")'
      },
      environment: {
        type: String,
        enum: ['development', 'staging', 'production', 'test'],
        default: 'development',
        description: 'Primary environment context for this project instance'
      },
      lastSynced: {
        type: Date,
        default: null,
        description: 'Last time project data was synced (if applicable)'
      },
      tags: {
        type: [String],
        default: [],
        description: 'Freeform tags for categorization'
      }
    },
    default: () => ({
      defaultBranch: 'main',
      environment: 'development',
      lastSynced: null,
      tags: []
    }),
    description: 'Additional metadata about the project'
  },

  // Status
  active: {
    type: Boolean,
    default: true,
    index: true,
    description: 'Whether this project is currently active'
  },

  // Audit fields
  createdBy: {
    type: String,
    default: 'system',
    description: 'Who created this project'
  },

  updatedBy: {
    type: String,
    default: 'system',
    description: 'Who last updated this project'
  }

}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'projects'
});

// Indexes for common queries
projectSchema.index({ active: 1, name: 1 });
projectSchema.index({ 'metadata.environment': 1 });
projectSchema.index({ 'techStack.database': 1 });

// Virtual for checking if project has repository
projectSchema.virtual('hasRepository').get(function() {
  return !!this.repositoryUrl;
});

// Static methods

/**
 * Find all active projects
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
projectSchema.statics.findActive = function(options = {}) {
  const query = { active: true };

  return this.find(query)
    .sort({ name: 1 })
    .limit(options.limit || 0);
};

/**
 * Find project by ID (case-insensitive)
 * @param {string} projectId - Project ID
 * @returns {Promise<Object|null>}
 */
projectSchema.statics.findByProjectId = function(projectId) {
  return this.findOne({
    id: projectId.toLowerCase(),
    active: true
  });
};

/**
 * Find projects by technology
 * @param {string} techType - Type of tech (language/framework/database/frontend)
 * @param {string} techValue - Technology value
 * @returns {Promise<Array>}
 */
projectSchema.statics.findByTechnology = function(techType, techValue) {
  const query = {
    active: true,
    [`techStack.${techType}`]: new RegExp(techValue, 'i')
  };

  return this.find(query).sort({ name: 1 });
};

/**
 * Get project statistics
 * @returns {Promise<Object>}
 */
projectSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalProjects: { $sum: 1 },
        activeProjects: {
          $sum: { $cond: ['$active', 1, 0] }
        },
        inactiveProjects: {
          $sum: { $cond: ['$active', 0, 1] }
        },
        databases: { $addToSet: '$techStack.database' },
        languages: { $addToSet: '$techStack.language' }
      }
    }
  ]);

  return stats[0] || {
    totalProjects: 0,
    activeProjects: 0,
    inactiveProjects: 0,
    databases: [],
    languages: []
  };
};

// Instance methods

/**
 * Deactivate project (soft delete)
 * @returns {Promise<Object>}
 */
projectSchema.methods.deactivate = async function() {
  this.active = false;
  this.updatedBy = 'system';
  return this.save();
};

/**
 * Activate project
 * @returns {Promise<Object>}
 */
projectSchema.methods.activate = async function() {
  this.active = true;
  this.updatedBy = 'system';
  return this.save();
};

/**
 * Update last synced timestamp
 * @returns {Promise<Object>}
 */
projectSchema.methods.updateSyncTimestamp = async function() {
  this.metadata.lastSynced = new Date();
  return this.save();
};

// Pre-save hook to ensure ID is lowercase
projectSchema.pre('save', function(next) {
  if (this.id) {
    this.id = this.id.toLowerCase();
  }
  next();
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
