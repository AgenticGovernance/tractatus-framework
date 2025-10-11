/**
 * Variables Controller
 *
 * Handles CRUD operations for project-specific variable values.
 * Variables enable context-aware rendering of governance rules.
 *
 * Endpoints:
 * - GET    /api/admin/projects/:projectId/variables       - List variables for project
 * - GET    /api/admin/variables/global                     - Get all unique variable names
 * - POST   /api/admin/projects/:projectId/variables       - Create/update variable
 * - PUT    /api/admin/projects/:projectId/variables/:name - Update variable value
 * - DELETE /api/admin/projects/:projectId/variables/:name - Delete variable
 */

const VariableValue = require('../models/VariableValue.model');
const Project = require('../models/Project.model');
const VariableSubstitutionService = require('../services/VariableSubstitution.service');

/**
 * Get all variables for a project
 * @route GET /api/admin/projects/:projectId/variables
 * @param {string} projectId - Project identifier
 * @query {string} category - Filter by category (optional)
 */
async function getProjectVariables(req, res) {
  try {
    const { projectId } = req.params;
    const { category } = req.query;

    // Verify project exists
    const project = await Project.findByProjectId(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        message: `No project found with ID: ${projectId}`
      });
    }

    // Fetch variables
    const variables = await VariableValue.findByProject(projectId, { category });

    res.json({
      success: true,
      projectId,
      projectName: project.name,
      variables,
      total: variables.length
    });

  } catch (error) {
    console.error('Error fetching project variables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch variables',
      message: error.message
    });
  }
}

/**
 * Get all unique variable names across all rules
 * @route GET /api/admin/variables/global
 */
async function getGlobalVariables(req, res) {
  try {
    // Get all unique variables from rules
    const ruleVariables = await VariableSubstitutionService.getAllVariables();

    // Get all unique variables currently defined
    const definedVariables = await VariableValue.getAllVariableNames();

    // Merge and add metadata
    const variableMap = new Map();

    // Add variables from rules
    ruleVariables.forEach(v => {
      variableMap.set(v.name, {
        name: v.name,
        usageCount: v.usageCount,
        rules: v.rules,
        isDefined: definedVariables.includes(v.name)
      });
    });

    // Add variables that are defined but not used in any rules
    definedVariables.forEach(name => {
      if (!variableMap.has(name)) {
        variableMap.set(name, {
          name,
          usageCount: 0,
          rules: [],
          isDefined: true
        });
      }
    });

    const allVariables = Array.from(variableMap.values())
      .sort((a, b) => b.usageCount - a.usageCount);

    res.json({
      success: true,
      variables: allVariables,
      total: allVariables.length,
      statistics: {
        totalVariables: allVariables.length,
        usedInRules: ruleVariables.length,
        definedButUnused: allVariables.filter(v => v.usageCount === 0).length
      }
    });

  } catch (error) {
    console.error('Error fetching global variables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch global variables',
      message: error.message
    });
  }
}

/**
 * Create or update variable value for project (upsert)
 * @route POST /api/admin/projects/:projectId/variables
 * @param {string} projectId - Project identifier
 * @body {string} variableName - Variable name (UPPER_SNAKE_CASE)
 * @body {string} value - Variable value
 * @body {string} description - Description (optional)
 * @body {string} category - Category (optional)
 * @body {string} dataType - Data type (optional)
 */
async function createOrUpdateVariable(req, res) {
  try {
    const { projectId } = req.params;
    const { variableName, value, description, category, dataType, validationRules } = req.body;

    // Verify project exists
    const project = await Project.findByProjectId(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        message: `No project found with ID: ${projectId}`
      });
    }

    // Validate variable name format
    if (!/^[A-Z][A-Z0-9_]*$/.test(variableName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid variable name',
        message: 'Variable name must be UPPER_SNAKE_CASE (e.g., DB_NAME, API_KEY_2)'
      });
    }

    // Upsert variable
    const variable = await VariableValue.upsertValue(projectId, variableName, {
      value,
      description,
      category,
      dataType,
      validationRules,
      updatedBy: req.user?.email || 'system'
    });

    // Validate the value against rules
    const validation = variable.validateValue();

    res.json({
      success: true,
      variable: variable.toObject(),
      validation,
      message: `Variable "${variableName}" ${variable.isNew ? 'created' : 'updated'} successfully for project "${project.name}"`
    });

  } catch (error) {
    console.error('Error creating/updating variable:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: errors.join(', '),
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create/update variable',
      message: error.message
    });
  }
}

/**
 * Update existing variable value
 * @route PUT /api/admin/projects/:projectId/variables/:variableName
 * @param {string} projectId - Project identifier
 * @param {string} variableName - Variable name
 * @body {Object} updates - Fields to update
 */
async function updateVariable(req, res) {
  try {
    const { projectId, variableName } = req.params;
    const updates = req.body;

    // Find existing variable
    const variable = await VariableValue.findValue(projectId, variableName);

    if (!variable) {
      return res.status(404).json({
        success: false,
        error: 'Variable not found',
        message: `No variable "${variableName}" found for project "${projectId}"`
      });
    }

    // Apply updates
    const allowedFields = ['value', 'description', 'category', 'dataType', 'validationRules'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        variable[field] = updates[field];
      }
    });

    variable.updatedBy = req.user?.email || 'system';
    await variable.save();

    // Validate the new value
    const validation = variable.validateValue();

    res.json({
      success: true,
      variable: variable.toObject(),
      validation,
      message: `Variable "${variableName}" updated successfully`
    });

  } catch (error) {
    console.error('Error updating variable:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: errors.join(', '),
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update variable',
      message: error.message
    });
  }
}

/**
 * Delete variable
 * @route DELETE /api/admin/projects/:projectId/variables/:variableName
 * @param {string} projectId - Project identifier
 * @param {string} variableName - Variable name
 * @query {boolean} hard - If true, permanently delete; otherwise soft delete
 */
async function deleteVariable(req, res) {
  try {
    const { projectId, variableName } = req.params;
    const { hard } = req.query;

    const variable = await VariableValue.findValue(projectId, variableName);

    if (!variable) {
      return res.status(404).json({
        success: false,
        error: 'Variable not found',
        message: `No variable "${variableName}" found for project "${projectId}"`
      });
    }

    if (hard === 'true') {
      // Hard delete - permanently remove
      await VariableValue.deleteOne({ projectId, variableName: variableName.toUpperCase() });

      res.json({
        success: true,
        message: `Variable "${variableName}" permanently deleted`
      });
    } else {
      // Soft delete - set active to false
      await variable.deactivate();

      res.json({
        success: true,
        message: `Variable "${variableName}" deactivated. Use ?hard=true to permanently delete.`
      });
    }

  } catch (error) {
    console.error('Error deleting variable:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete variable',
      message: error.message
    });
  }
}

/**
 * Validate project variables (check for missing required variables)
 * @route GET /api/admin/projects/:projectId/variables/validate
 * @param {string} projectId - Project identifier
 */
async function validateProjectVariables(req, res) {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = await Project.findByProjectId(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        message: `No project found with ID: ${projectId}`
      });
    }

    // Validate variables
    const validation = await VariableSubstitutionService.validateProjectVariables(projectId);

    res.json({
      success: true,
      projectId,
      projectName: project.name,
      validation,
      message: validation.complete
        ? `All required variables are defined for project "${project.name}"`
        : `Missing ${validation.missing.length} required variable(s) for project "${project.name}"`
    });

  } catch (error) {
    console.error('Error validating project variables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate variables',
      message: error.message
    });
  }
}

/**
 * Batch create/update variables from array
 * @route POST /api/admin/projects/:projectId/variables/batch
 * @param {string} projectId - Project identifier
 * @body {Array} variables - Array of variable objects
 */
async function batchUpsertVariables(req, res) {
  try {
    const { projectId } = req.params;
    const { variables } = req.body;

    if (!Array.isArray(variables)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'variables must be an array'
      });
    }

    // Verify project exists
    const project = await Project.findByProjectId(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        message: `No project found with ID: ${projectId}`
      });
    }

    const results = {
      created: [],
      updated: [],
      failed: []
    };

    // Process each variable
    for (const varData of variables) {
      try {
        const variable = await VariableValue.upsertValue(projectId, varData.variableName, {
          ...varData,
          updatedBy: req.user?.email || 'system'
        });

        const action = variable.isNew ? 'created' : 'updated';
        results[action].push({
          variableName: varData.variableName,
          value: varData.value
        });

      } catch (error) {
        results.failed.push({
          variableName: varData.variableName,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results,
      message: `Batch operation complete: ${results.created.length} created, ${results.updated.length} updated, ${results.failed.length} failed`
    });

  } catch (error) {
    console.error('Error batch upserting variables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to batch upsert variables',
      message: error.message
    });
  }
}

module.exports = {
  getProjectVariables,
  getGlobalVariables,
  createOrUpdateVariable,
  updateVariable,
  deleteVariable,
  validateProjectVariables,
  batchUpsertVariables
};
