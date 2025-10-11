/**
 * Project Selector Component
 * Reusable dropdown for selecting active project context in admin pages
 *
 * Features:
 * - Loads active projects from API
 * - Persists selection to localStorage
 * - Emits change events
 * - Supports callback functions
 * - Responsive design with icons
 */

class ProjectSelector {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.projects = [];
    this.selectedProjectId = null;

    // Options
    this.options = {
      showAllOption: options.showAllOption !== undefined ? options.showAllOption : true,
      allOptionText: options.allOptionText || 'All Projects (Template View)',
      onChange: options.onChange || null,
      storageKey: options.storageKey || 'selected_project_id',
      placeholder: options.placeholder || 'Select a project...',
      label: options.label || 'Active Project Context',
      showLabel: options.showLabel !== undefined ? options.showLabel : true,
      compact: options.compact || false, // Compact mode for navbar
      autoLoad: options.autoLoad !== undefined ? options.autoLoad : true
    };

    // Auth token
    this.token = localStorage.getItem('admin_token');

    if (this.options.autoLoad) {
      this.init();
    }
  }

  /**
   * Initialize the component
   */
  async init() {
    try {
      // Load saved project from localStorage
      const savedProjectId = localStorage.getItem(this.options.storageKey);
      if (savedProjectId) {
        this.selectedProjectId = savedProjectId;
      }

      // Load projects from API
      await this.loadProjects();

      // Render the selector
      this.render();

      // Attach event listeners
      this.attachEventListeners();

      // Trigger initial change event if project was pre-selected
      if (this.selectedProjectId && this.options.onChange) {
        this.options.onChange(this.selectedProjectId, this.getSelectedProject());
      }

    } catch (error) {
      console.error('Failed to initialize project selector:', error);
      this.renderError();
    }
  }

  /**
   * Load projects from API
   */
  async loadProjects() {
    const response = await fetch('/api/admin/projects?active=true', {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login.html';
      return;
    }

    const data = await response.json();

    if (data.success) {
      this.projects = data.projects || [];

      // Sort by name
      this.projects.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      throw new Error(data.message || 'Failed to load projects');
    }
  }

  /**
   * Render the selector component
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container #${this.containerId} not found`);
      return;
    }

    // Determine selected project
    const selectedProject = this.getSelectedProject();

    // Build HTML based on compact or full mode
    if (this.options.compact) {
      container.innerHTML = this.renderCompact(selectedProject);
    } else {
      container.innerHTML = this.renderFull(selectedProject);
    }
  }

  /**
   * Render compact mode (for navbar)
   */
  renderCompact(selectedProject) {
    const displayText = selectedProject ? selectedProject.name : this.options.placeholder;
    const displayColor = selectedProject ? 'text-indigo-700' : 'text-gray-500';

    return `
      <div class="relative">
        <select
          id="${this.containerId}-select"
          class="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md ${displayColor}"
        >
          ${this.options.showAllOption ? `<option value="">${this.options.allOptionText}</option>` : ''}
          ${this.projects.map(project => `
            <option
              value="${escapeHtml(project.id)}"
              ${this.selectedProjectId === project.id ? 'selected' : ''}
            >
              ${escapeHtml(project.name)}
            </option>
          `).join('')}
        </select>
        <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg class="h-4 w-4 ${displayColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
        </div>
      </div>
    `;
  }

  /**
   * Render full mode (for content area)
   */
  renderFull(selectedProject) {
    return `
      <div class="mb-6">
        ${this.options.showLabel ? `
          <label for="${this.containerId}-select" class="block text-sm font-medium text-gray-700 mb-2">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
              </svg>
              ${this.options.label}
            </div>
          </label>
        ` : ''}

        <select
          id="${this.containerId}-select"
          class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          ${this.options.showAllOption ? `
            <option value="">
              ${this.options.allOptionText}
            </option>
          ` : ''}
          ${this.projects.map(project => {
            const variableCount = project.variableCount || 0;
            return `
              <option
                value="${escapeHtml(project.id)}"
                ${this.selectedProjectId === project.id ? 'selected' : ''}
              >
                ${escapeHtml(project.name)} ${variableCount > 0 ? `(${variableCount} vars)` : ''}
              </option>
            `;
          }).join('')}
        </select>

        ${selectedProject ? `
          <div class="mt-2 p-3 bg-indigo-50 rounded-md">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
              </div>
              <div class="ml-3 flex-1">
                <h4 class="text-sm font-medium text-indigo-800">
                  ${escapeHtml(selectedProject.name)}
                </h4>
                ${selectedProject.description ? `
                  <p class="mt-1 text-sm text-indigo-700">
                    ${escapeHtml(selectedProject.description)}
                  </p>
                ` : ''}
                <div class="mt-2 text-sm text-indigo-600">
                  <span class="font-medium">${selectedProject.variableCount || 0}</span> variable${(selectedProject.variableCount || 0) !== 1 ? 's' : ''} available for substitution
                </div>
              </div>
            </div>
          </div>
        ` : `
          <div class="mt-2 p-3 bg-gray-50 rounded-md">
            <p class="text-sm text-gray-600">
              <svg class="inline h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Viewing template text with variable placeholders. Select a project to see rendered values.
            </p>
          </div>
        `}
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderError() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="rounded-md bg-red-50 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">
              Failed to load projects
            </h3>
            <p class="mt-1 text-sm text-red-700">
              Please refresh the page to try again.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const selectElement = document.getElementById(`${this.containerId}-select`);
    if (!selectElement) return;

    selectElement.addEventListener('change', (e) => {
      const newProjectId = e.target.value || null;
      this.handleChange(newProjectId);
    });
  }

  /**
   * Handle project selection change
   */
  handleChange(projectId) {
    const previousProjectId = this.selectedProjectId;
    this.selectedProjectId = projectId;

    // Save to localStorage
    if (projectId) {
      localStorage.setItem(this.options.storageKey, projectId);
    } else {
      localStorage.removeItem(this.options.storageKey);
    }

    // Re-render to update info panel
    this.render();
    this.attachEventListeners(); // Re-attach after re-render

    // Trigger callback
    if (this.options.onChange) {
      const selectedProject = this.getSelectedProject();
      this.options.onChange(projectId, selectedProject, previousProjectId);
    }

    // Dispatch custom event for other listeners
    const event = new CustomEvent('projectChanged', {
      detail: {
        projectId,
        project: this.getSelectedProject(),
        previousProjectId
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Get currently selected project object
   */
  getSelectedProject() {
    if (!this.selectedProjectId) return null;
    return this.projects.find(p => p.id === this.selectedProjectId) || null;
  }

  /**
   * Get all loaded projects
   */
  getProjects() {
    return this.projects;
  }

  /**
   * Programmatically set the selected project
   */
  setSelectedProject(projectId) {
    this.handleChange(projectId);
  }

  /**
   * Reload projects from API
   */
  async reload() {
    try {
      await this.loadProjects();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Failed to reload projects:', error);
      this.renderError();
    }
  }

  /**
   * Get current selection
   */
  getSelection() {
    return {
      projectId: this.selectedProjectId,
      project: this.getSelectedProject()
    };
  }
}

/**
 * Utility: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export for use in other scripts
window.ProjectSelector = ProjectSelector;
