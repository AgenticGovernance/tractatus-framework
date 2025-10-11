/**
 * Projects Controller
 *
 * Handles CRUD operations for projects in the multi-project governance system.
 * Projects represent different codebases that share governance rules with
 * project-specific variable values.
 *
 * Endpoints:
 * - GET    /api/admin/projects          - List all projects
 * - GET    /api/admin/projects/:id      - Get single project with variables
 * - POST   /api/admin/projects          - Create new project
 * - PUT    /api/admin/projects/:id      - Update project
 * - DELETE /api/admin/projects/:id      - Soft delete project
 */

const Project = require('../models/Project.model');
const VariableValue = require('../models/VariableValue.model');

/**
 * Get all projects
 * @route GET /api/admin/projects
 * @query {boolean} active - Filter by active status (optional)
 * @query {string} database - Filter by database technology (optional)
 * @query {number} limit - Maximum number of results (optional)
 */
async function getAllProjects(req, res) {
  try {
    const { active, database, limit } = req.query;

    let query = {};

    // Filter by active status if specified
    if (active !== undefined) {
      query.active = active === 'true';
    }

    // Filter by database technology if specified
    if (database) {
      query['techStack.database'] = new RegExp(database, 'i');
    }

    const projects = await Project.find(query)
      .sort({ name: 1 })
      .limit(limit ? parseInt(limit) : 0);

    // Get variable counts for each project
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const variableCount = await VariableValue.countDocuments({
          projectId: project.id,
          active: true
        });

        return {
          ...project.toObject(),
          variableCount
        };
      })
    );

    res.json({
      success: true,
      projects: projectsWithCounts,
      total: projectsWithCounts.length
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects',
      message: error.message
    });
  }
}

/**
 * Get single project by ID with all variable values
 * @route GET /api/admin/projects/:id
 * @param {string} id - Project identifier
 */
async function getProjectById(req, res) {
  try {
    const { id } = req.params;

    const project = await Project.findByProjectId(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        message: `No project found with ID: ${id}`
      });
    }

    // Fetch all variable values for this project
    const variables = await VariableValue.findByProject(id);

    res.json({
      success: true,
      project: project.toObject(),
      variables,
      variableCount: variables.length
    });

  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project',
      message: error.message
    });
  }
}

/**
 * Create new project
 * @route POST /api/admin/projects
 * @body {Object} project - Project data
 * @body {string} project.id - Unique project identifier (slug)
 * @body {string} project.name - Project name
 * @body {string} project.description - Project description (optional)
 * @body {Object} project.techStack - Technology stack info (optional)
 * @body {string} project.repositoryUrl - Git repository URL (optional)
 * @body {Object} project.metadata - Additional metadata (optional)
 */
async function createProject(req, res) {
  try {
    const projectData = req.body;

    // Check if project with this ID already exists
    const existingProject = await Project.findOne({ id: projectData.id });

    if (existingProject) {
      return res.status(400).json({
        success: false,
        error: 'Project already exists',
        message: `A project with ID "${projectData.id}" already exists. Please choose a different ID.`
      });
    }

    // Set audit fields
    projectData.createdBy = req.user?.email || 'system';
    projectData.updatedBy = req.user?.email || 'system';

    // Create project
    const project = new Project(projectData);
    await project.save();

    res.status(201).json({
      success: true,
      project: project.toObject(),
      message: `Project "${project.name}" created successfully`
    });

  } catch (error) {
    console.error('Error creating project:', error);

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
      error: 'Failed to create project',
      message: error.message
    });
  }
}

/**
 * Update existing project
 * @route PUT /api/admin/projects/:id
 * @param {string} id - Project identifier
 * @body {Object} updates - Fields to update
 */
async function updateProject(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find existing project
    const project = await Project.findByProjectId(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        message: `No project found with ID: ${id}`
      });
    }

    // Don't allow changing the ID
    if (updates.id && updates.id !== id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change project ID',
        message: 'Project ID cannot be modified. Create a new project instead.'
      });
    }

    // Update audit fields
    updates.updatedBy = req.user?.email || 'system';

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'createdBy') {
        if (key === 'techStack' || key === 'metadata') {
          // Merge nested objects
          project[key] = { ...project[key].toObject(), ...updates[key] };
        } else {
          project[key] = updates[key];
        }
      }
    });

    await project.save();

    res.json({
      success: true,
      project: project.toObject(),
      message: `Project "${project.name}" updated successfully`
    });

  } catch (error) {
    console.error('Error updating project:', error);

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
      error: 'Failed to update project',
      message: error.message
    });
  }
}

/**
 * Delete project (soft delete)
 * @route DELETE /api/admin/projects/:id
 * @param {string} id - Project identifier
 * @query {boolean} hard - If true, perform hard delete (permanently remove)
 */
async function deleteProject(req, res) {
  try {
    const { id } = req.params;
    const { hard } = req.query;

    const project = await Project.findByProjectId(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        message: `No project found with ID: ${id}`
      });
    }

    if (hard === 'true') {
      // Hard delete - permanently remove
      await Project.deleteOne({ id });

      // Also delete all associated variable values
      await VariableValue.deleteMany({ projectId: id });

      res.json({
        success: true,
        message: `Project "${project.name}" and all associated data permanently deleted`
      });
    } else {
      // Soft delete - set active to false
      await project.deactivate();

      // Also deactivate all associated variable values
      await VariableValue.updateMany(
        { projectId: id },
        { $set: { active: false, updatedBy: req.user?.email || 'system' } }
      );

      res.json({
        success: true,
        message: `Project "${project.name}" deactivated. Use ?hard=true to permanently delete.`
      });
    }

  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete project',
      message: error.message
    });
  }
}

/**
 * Get project statistics
 * @route GET /api/admin/projects/stats
 */
async function getProjectStatistics(req, res) {
  try {
    const stats = await Project.getStatistics();

    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    console.error('Error fetching project statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
}

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectStatistics
};
