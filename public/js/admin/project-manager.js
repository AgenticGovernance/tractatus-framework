/**
 * Project Manager - Multi-Project Governance Dashboard
 * Handles CRUD operations, filtering, and variable management for projects
 */

// Auth check
const token = localStorage.getItem('admin_token');
const user = JSON.parse(localStorage.getItem('admin_user') || '{}');

if (!token) {
  window.location.href = '/admin/login.html';
}

// Display admin name
document.getElementById('admin-name').textContent = user.email || 'Admin';

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  window.location.href = '/admin/login.html';
});

/**
 * API request helper with automatic auth header injection
 */
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (response.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.href = '/admin/login.html';
    return;
  }

  return response.json();
}

// State management
let projects = [];
let filters = {
  status: 'true',
  database: '',
  sortBy: 'name'
};

/**
 * Load and display dashboard statistics
 */
async function loadStatistics() {
  try {
    const response = await apiRequest('/api/admin/projects');

    if (!response.success) {
      console.error('Invalid stats response:', response);
      return;
    }

    const allProjects = response.projects || [];
    const activeProjects = allProjects.filter(p => p.active);

    // Count total variables
    const totalVariables = allProjects.reduce((sum, p) => sum + (p.variableCount || 0), 0);

    // Count unique databases
    const databases = new Set();
    allProjects.forEach(p => {
      if (p.techStack?.database) {
        databases.add(p.techStack.database);
      }
    });

    document.getElementById('stat-total').textContent = allProjects.length;
    document.getElementById('stat-active').textContent = activeProjects.length;
    document.getElementById('stat-variables').textContent = totalVariables;
    document.getElementById('stat-databases').textContent = databases.size;

  } catch (error) {
    console.error('Failed to load statistics:', error);
    showToast('Failed to load statistics', 'error');
  }
}

/**
 * Load and render projects based on current filters
 */
async function loadProjects() {
  const container = document.getElementById('projects-grid');

  try {
    // Show loading state
    container.innerHTML = `
      <div class="col-span-full text-center py-12 text-gray-500">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
        <p>Loading projects...</p>
      </div>
    `;

    // Build query parameters
    const params = new URLSearchParams();

    if (filters.status) params.append('active', filters.status);
    if (filters.database) params.append('database', filters.database);

    const response = await apiRequest(`/api/admin/projects?${params.toString()}`);

    if (!response.success) {
      throw new Error('Failed to load projects');
    }

    projects = response.projects || [];

    // Apply client-side sorting
    projects.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'id':
          return a.id.localeCompare(b.id);
        case 'variableCount':
          return (b.variableCount || 0) - (a.variableCount || 0);
        case 'updatedAt':
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        default:
          return 0;
      }
    });

    // Update results count
    document.getElementById('filter-results').textContent =
      `Showing ${projects.length} project${projects.length !== 1 ? 's' : ''}`;

    // Render projects
    if (projects.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-gray-500">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No projects found</h3>
          <p class="mt-1 text-sm text-gray-500">Try adjusting your filters or create a new project.</p>
        </div>
      `;
      return;
    }

    // Render project cards
    container.innerHTML = projects.map(project => renderProjectCard(project)).join('');

  } catch (error) {
    console.error('Failed to load projects:', error);
    container.innerHTML = `
      <div class="col-span-full text-center py-12 text-red-500">
        <p>Failed to load projects. Please try again.</p>
      </div>
    `;
    showToast('Failed to load projects', 'error');
  }
}

/**
 * Render a single project as an HTML card
 */
function renderProjectCard(project) {
  const statusBadge = project.active
    ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>'
    : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Inactive</span>';

  const techStackBadges = [];
  if (project.techStack?.framework) {
    techStackBadges.push(`<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">${escapeHtml(project.techStack.framework)}</span>`);
  }
  if (project.techStack?.database) {
    techStackBadges.push(`<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">${escapeHtml(project.techStack.database)}</span>`);
  }
  if (project.techStack?.frontend && techStackBadges.length < 3) {
    techStackBadges.push(`<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">${escapeHtml(project.techStack.frontend)}</span>`);
  }

  const variableCount = project.variableCount || 0;

  return `
    <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200">
      <div class="p-6">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-1">${escapeHtml(project.name)}</h3>
            <p class="text-sm font-mono text-gray-500">${escapeHtml(project.id)}</p>
          </div>
          ${statusBadge}
        </div>

        ${project.description ? `
          <p class="text-sm text-gray-600 mb-4 line-clamp-2">${escapeHtml(project.description)}</p>
        ` : ''}

        ${techStackBadges.length > 0 ? `
          <div class="flex flex-wrap gap-1 mb-4">
            ${techStackBadges.join('')}
          </div>
        ` : ''}

        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-4 text-sm text-gray-500">
            <div class="flex items-center">
              <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
              </svg>
              <span>${variableCount} var${variableCount !== 1 ? 's' : ''}</span>
            </div>
            ${project.repositoryUrl ? `
              <div class="flex items-center">
                <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                </svg>
                <span>Repo</span>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button onclick="viewProject('${project.id}')" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            View Details
          </button>
          <button onclick="manageVariables('${project.id}')" class="px-4 py-2 border border-indigo-300 rounded-md text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
            Variables (${variableCount})
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-2">
          <button onclick="editProject('${project.id}')" class="px-4 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100">
            Edit
          </button>
          <button onclick="deleteProject('${project.id}', '${escapeHtml(project.name)}')" class="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100">
            Delete
          </button>
        </div>
      </div>
    </div>
  `;
}

// Filter handlers
function applyFilters() {
  loadProjects();
}

document.getElementById('filter-status')?.addEventListener('change', (e) => {
  filters.status = e.target.value;
  applyFilters();
});

document.getElementById('filter-database')?.addEventListener('change', (e) => {
  filters.database = e.target.value;
  applyFilters();
});

document.getElementById('sort-by')?.addEventListener('change', (e) => {
  filters.sortBy = e.target.value;
  applyFilters();
});

// Clear filters
document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
  filters = {
    status: 'true',
    database: '',
    sortBy: 'name'
  };

  document.getElementById('filter-status').value = 'true';
  document.getElementById('filter-database').value = '';
  document.getElementById('sort-by').value = 'name';

  applyFilters();
});

// CRUD operations
async function viewProject(projectId) {
  if (window.projectEditor) {
    window.projectEditor.openView(projectId);
  } else {
    showToast('Project editor not loaded', 'error');
  }
}

async function editProject(projectId) {
  if (window.projectEditor) {
    window.projectEditor.openEdit(projectId);
  } else {
    showToast('Project editor not loaded', 'error');
  }
}

async function manageVariables(projectId) {
  if (window.projectEditor) {
    window.projectEditor.openVariables(projectId);
  } else {
    showToast('Project editor not loaded', 'error');
  }
}

async function deleteProject(projectId, projectName) {
  if (!confirm(`Delete project "${projectName}"?\n\nThis will:\n- Deactivate the project (soft delete)\n- Deactivate all associated variables\n\nTo permanently delete, use the API with ?hard=true`)) {
    return;
  }

  try {
    const response = await apiRequest(`/api/admin/projects/${projectId}`, {
      method: 'DELETE'
    });

    if (response.success) {
      showToast('Project deleted successfully', 'success');
      loadProjects();
      loadStatistics();
    } else {
      showToast(response.message || 'Failed to delete project', 'error');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Failed to delete project', 'error');
  }
}

// New project button
document.getElementById('new-project-btn')?.addEventListener('click', () => {
  if (window.projectEditor) {
    window.projectEditor.openCreate();
  } else {
    showToast('Project editor not loaded', 'error');
  }
});

/**
 * Show a toast notification message
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  const toast = document.createElement('div');
  toast.className = `${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 transition-all duration-300 ease-in-out`;
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(100px)';
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button onclick="this.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
      ×
    </button>
  `;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 10);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions global for onclick handlers
window.viewProject = viewProject;
window.editProject = editProject;
window.manageVariables = manageVariables;
window.deleteProject = deleteProject;

// Initialize on page load
loadStatistics();
loadProjects();
