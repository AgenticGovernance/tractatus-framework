/**
 * Projects Routes
 *
 * Routes for managing projects in the multi-project governance system.
 * All routes require admin authentication.
 */

const express = require('express');
const router = express.Router();
const projectsController = require('../controllers/projects.controller');
const variablesController = require('../controllers/variables.controller');
const { asyncHandler } = require('../middleware/error.middleware');
const { validateRequired } = require('../middleware/validation.middleware');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

/**
 * All routes require admin authentication
 */
router.use(authenticateToken);
router.use(requireRole('admin'));

// Global variables endpoint (before /:id to avoid route conflict)
router.get(
  '/variables/global',
  asyncHandler(variablesController.getGlobalVariables)
);

// Statistics endpoint (before /:id to avoid route conflict)
router.get(
  '/stats',
  asyncHandler(projectsController.getProjectStatistics)
);

// Get all projects
router.get(
  '/',
  asyncHandler(projectsController.getAllProjects)
);

// Get single project by ID
router.get(
  '/:id',
  asyncHandler(projectsController.getProjectById)
);

// Create new project
router.post(
  '/',
  validateRequired(['id', 'name']),
  asyncHandler(projectsController.createProject)
);

// Update existing project
router.put(
  '/:id',
  asyncHandler(projectsController.updateProject)
);

// Delete project (soft delete by default, ?hard=true for permanent)
router.delete(
  '/:id',
  asyncHandler(projectsController.deleteProject)
);

// ========== Project-specific Variable Routes ==========

// Validate project variables (check for missing)
router.get(
  '/:projectId/variables/validate',
  asyncHandler(variablesController.validateProjectVariables)
);

// Get all variables for a project
router.get(
  '/:projectId/variables',
  asyncHandler(variablesController.getProjectVariables)
);

// Batch create/update variables
router.post(
  '/:projectId/variables/batch',
  validateRequired(['variables']),
  asyncHandler(variablesController.batchUpsertVariables)
);

// Create or update variable (upsert)
router.post(
  '/:projectId/variables',
  validateRequired(['variableName', 'value']),
  asyncHandler(variablesController.createOrUpdateVariable)
);

// Update existing variable
router.put(
  '/:projectId/variables/:variableName',
  asyncHandler(variablesController.updateVariable)
);

// Delete variable
router.delete(
  '/:projectId/variables/:variableName',
  asyncHandler(variablesController.deleteVariable)
);

module.exports = router;
