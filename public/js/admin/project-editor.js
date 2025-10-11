/**
 * Project Editor Modal
 * Handles creation, editing, viewing, and variable management for projects
 *
 * @class ProjectEditor
 */

class ProjectEditor {
  constructor() {
    this.mode = 'create'; // 'create', 'edit', 'view', 'variables'
    this.projectId = null;
    this.originalProject = null;
    this.variables = [];
  }

  /**
   * Open editor in create mode
   */
  openCreate() {
    this.mode = 'create';
    this.projectId = null;
    this.originalProject = null;
    this.render();
    this.attachEventListeners();
  }

  /**
   * Open editor in edit mode
   */
  async openEdit(projectId) {
    this.mode = 'edit';
    this.projectId = projectId;

    try {
      const response = await apiRequest(`/api/admin/projects/${projectId}`);

      if (!response.success || !response.project) {
        throw new Error('Failed to load project');
      }

      this.originalProject = response.project;
      this.variables = response.variables || [];
      this.render();
      this.populateForm(response.project);
      this.attachEventListeners();
    } catch (error) {
      console.error('Failed to load project:', error);
      showToast('Failed to load project for editing', 'error');
    }
  }

  /**
   * Open editor in view mode (read-only)
   */
  async openView(projectId) {
    this.mode = 'view';
    this.projectId = projectId;

    try {
      const response = await apiRequest(`/api/admin/projects/${projectId}`);

      if (!response.success || !response.project) {
        throw new Error('Failed to load project');
      }

      this.originalProject = response.project;
      this.variables = response.variables || [];
      this.renderViewMode(response.project);
    } catch (error) {
      console.error('Failed to load project:', error);
      showToast('Failed to load project', 'error');
    }
  }

  /**
   * Open variables management mode
   */
  async openVariables(projectId) {
    this.mode = 'variables';
    this.projectId = projectId;

    try {
      const [projectResponse, variablesResponse] = await Promise.all([
        apiRequest(`/api/admin/projects/${projectId}`),
        apiRequest(`/api/admin/projects/${projectId}/variables`)
      ]);

      if (!projectResponse.success || !projectResponse.project) {
        throw new Error('Failed to load project');
      }

      this.originalProject = projectResponse.project;
      this.variables = variablesResponse.variables || [];
      this.renderVariablesMode();
    } catch (error) {
      console.error('Failed to load project variables:', error);
      showToast('Failed to load variables', 'error');
    }
  }

  /**
   * Render the editor modal
   */
  render() {
    const container = document.getElementById('modal-container');
    const title = this.mode === 'create' ? 'Create New Project' : 'Edit Project';

    container.innerHTML = `
      <div id="project-editor-modal" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 class="text-lg font-medium text-gray-900">${title}</h3>
            <button id="close-modal" class="text-gray-400 hover:text-gray-500">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-6">
            <form id="project-form">
              <div class="space-y-6">
                <!-- Project ID -->
                <div>
                  <label for="project-id" class="block text-sm font-medium text-gray-700 mb-1">
                    Project ID <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="project-id"
                    name="id"
                    placeholder="e.g., my-project, family-history"
                    class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    ${this.mode === 'edit' ? 'disabled' : 'required'}
                  >
                  <p class="mt-1 text-xs text-gray-500">Lowercase slug format (letters, numbers, hyphens only)</p>
                </div>

                <!-- Project Name -->
                <div>
                  <label for="project-name" class="block text-sm font-medium text-gray-700 mb-1">
                    Project Name <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="project-name"
                    name="name"
                    placeholder="e.g., Family History Archive"
                    class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                </div>

                <!-- Description -->
                <div>
                  <label for="project-description" class="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="project-description"
                    name="description"
                    rows="3"
                    placeholder="Brief description of the project..."
                    class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  ></textarea>
                </div>

                <!-- Tech Stack -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label for="tech-framework" class="block text-sm font-medium text-gray-700 mb-1">
                      Framework
                    </label>
                    <input
                      type="text"
                      id="tech-framework"
                      placeholder="e.g., Express.js"
                      class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                  </div>
                  <div>
                    <label for="tech-database" class="block text-sm font-medium text-gray-700 mb-1">
                      Database
                    </label>
                    <input
                      type="text"
                      id="tech-database"
                      placeholder="e.g., MongoDB"
                      class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                  </div>
                  <div>
                    <label for="tech-frontend" class="block text-sm font-medium text-gray-700 mb-1">
                      Frontend
                    </label>
                    <input
                      type="text"
                      id="tech-frontend"
                      placeholder="e.g., React"
                      class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                  </div>
                </div>

                <!-- Repository URL -->
                <div>
                  <label for="repo-url" class="block text-sm font-medium text-gray-700 mb-1">
                    Repository URL
                  </label>
                  <input
                    type="url"
                    id="repo-url"
                    name="repositoryUrl"
                    placeholder="https://github.com/user/repo"
                    class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                </div>

                <!-- Active Status -->
                <div class="flex items-center">
                  <input
                    type="checkbox"
                    id="project-active"
                    name="active"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked
                  >
                  <label for="project-active" class="ml-2 block text-sm text-gray-900">
                    Active
                  </label>
                  <p class="ml-2 text-xs text-gray-500">(Inactive projects are hidden from rule rendering)</p>
                </div>
              </div>
            </form>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <button id="cancel-btn" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              Cancel
            </button>
            <button id="save-btn" class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
              ${this.mode === 'create' ? 'Create Project' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render view mode (read-only)
   */
  renderViewMode(project) {
    const container = document.getElementById('modal-container');

    const techStack = project.techStack || {};
    const metadata = project.metadata || {};

    container.innerHTML = `
      <div id="project-editor-modal" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 class="text-lg font-medium text-gray-900">${escapeHtml(project.name)}</h3>
              <p class="text-sm text-gray-500 font-mono mt-1">${escapeHtml(project.id)}</p>
            </div>
            <button id="close-modal" class="text-gray-400 hover:text-gray-500">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-6">
            <div class="space-y-6">
              <!-- Status Badge -->
              <div>
                ${project.active
                  ? '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">Active</span>'
                  : '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">Inactive</span>'
                }
              </div>

              <!-- Description -->
              ${project.description ? `
                <div>
                  <h4 class="text-sm font-medium text-gray-700 mb-2">Description</h4>
                  <p class="text-sm text-gray-900">${escapeHtml(project.description)}</p>
                </div>
              ` : ''}

              <!-- Tech Stack -->
              ${Object.keys(techStack).length > 0 ? `
                <div>
                  <h4 class="text-sm font-medium text-gray-700 mb-2">Tech Stack</h4>
                  <div class="grid grid-cols-2 gap-4">
                    ${techStack.framework ? `<div class="text-sm"><span class="font-medium">Framework:</span> ${escapeHtml(techStack.framework)}</div>` : ''}
                    ${techStack.database ? `<div class="text-sm"><span class="font-medium">Database:</span> ${escapeHtml(techStack.database)}</div>` : ''}
                    ${techStack.frontend ? `<div class="text-sm"><span class="font-medium">Frontend:</span> ${escapeHtml(techStack.frontend)}</div>` : ''}
                    ${techStack.css ? `<div class="text-sm"><span class="font-medium">CSS:</span> ${escapeHtml(techStack.css)}</div>` : ''}
                  </div>
                </div>
              ` : ''}

              <!-- Repository -->
              ${project.repositoryUrl ? `
                <div>
                  <h4 class="text-sm font-medium text-gray-700 mb-2">Repository</h4>
                  <a href="${escapeHtml(project.repositoryUrl)}" target="_blank" class="text-sm text-indigo-600 hover:text-indigo-700">
                    ${escapeHtml(project.repositoryUrl)}
                  </a>
                </div>
              ` : ''}

              <!-- Variables -->
              <div>
                <div class="flex justify-between items-center mb-3">
                  <h4 class="text-sm font-medium text-gray-700">Variables (${this.variables.length})</h4>
                  <button onclick="window.projectEditor.openVariables('${project.id}')" class="text-sm text-indigo-600 hover:text-indigo-700">
                    Manage Variables →
                  </button>
                </div>
                ${this.variables.length > 0 ? `
                  <div class="border border-gray-200 rounded-md overflow-hidden">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        ${this.variables.slice(0, 5).map(v => `
                          <tr>
                            <td class="px-4 py-2 text-sm font-mono text-gray-900">${escapeHtml(v.variableName)}</td>
                            <td class="px-4 py-2 text-sm text-gray-600">${escapeHtml(v.value)}</td>
                            <td class="px-4 py-2 text-sm text-gray-500">${escapeHtml(v.category || 'other')}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                    ${this.variables.length > 5 ? `
                      <div class="px-4 py-2 bg-gray-50 text-xs text-gray-500 text-center">
                        Showing 5 of ${this.variables.length} variables
                      </div>
                    ` : ''}
                  </div>
                ` : '<p class="text-sm text-gray-500 italic">No variables defined</p>'}
              </div>

              <!-- Metadata -->
              <div class="text-xs text-gray-500 space-y-1">
                <p>Created: ${new Date(project.createdAt).toLocaleString()}</p>
                <p>Updated: ${new Date(project.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 flex justify-between">
            <button onclick="window.projectEditor.openEdit('${project.id}')" class="px-4 py-2 border border-indigo-300 rounded-md text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
              Edit Project
            </button>
            <button id="close-modal" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    // Attach close handlers
    document.getElementById('close-modal').addEventListener('click', () => this.close());
  }

  /**
   * Render variables management mode
   */
  renderVariablesMode() {
    const container = document.getElementById('modal-container');

    container.innerHTML = `
      <div id="project-editor-modal" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 class="text-lg font-medium text-gray-900">Manage Variables</h3>
              <p class="text-sm text-gray-500 mt-1">${escapeHtml(this.originalProject.name)} (${escapeHtml(this.originalProject.id)})</p>
            </div>
            <button id="close-modal" class="text-gray-400 hover:text-gray-500">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-6">
            <div class="mb-4 flex justify-between items-center">
              <p class="text-sm text-gray-600">${this.variables.length} variable${this.variables.length !== 1 ? 's' : ''} defined</p>
              <button id="add-variable-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">
                + Add Variable
              </button>
            </div>

            <div id="variables-list" class="space-y-3">
              ${this.variables.length > 0 ? this.variables.map(v => this.renderVariableCard(v)).join('') : `
                <div class="text-center py-12 text-gray-500">
                  <p class="text-sm">No variables defined for this project.</p>
                  <p class="text-xs mt-2">Click "Add Variable" to create one.</p>
                </div>
              `}
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button id="close-modal" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              Done
            </button>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    document.getElementById('close-modal').addEventListener('click', () => {
      this.close();
      // Refresh project list
      if (window.loadProjects) window.loadProjects();
      if (window.loadStatistics) window.loadStatistics();
    });

    document.getElementById('add-variable-btn').addEventListener('click', () => {
      this.showVariableForm();
    });
  }

  /**
   * Render a single variable card
   */
  renderVariableCard(variable) {
    return `
      <div class="border border-gray-200 rounded-md p-4 hover:border-indigo-300 transition-colors">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h5 class="text-sm font-medium font-mono text-gray-900">${escapeHtml(variable.variableName)}</h5>
            <p class="text-sm text-gray-600 mt-1">${escapeHtml(variable.value)}</p>
            ${variable.description ? `<p class="text-xs text-gray-500 mt-1">${escapeHtml(variable.description)}</p>` : ''}
            <div class="flex items-center space-x-3 mt-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                ${escapeHtml(variable.category || 'other')}
              </span>
              <span class="text-xs text-gray-500">${escapeHtml(variable.dataType || 'string')}</span>
            </div>
          </div>
          <div class="flex space-x-2 ml-4">
            <button onclick="window.projectEditor.editVariable('${escapeHtml(variable.variableName)}')" class="text-sm text-indigo-600 hover:text-indigo-700">
              Edit
            </button>
            <button onclick="window.projectEditor.deleteVariable('${escapeHtml(variable.variableName)}')" class="text-sm text-red-600 hover:text-red-700">
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Show variable form (add/edit)
   */
  showVariableForm(variableName = null) {
    const existingVariable = variableName ? this.variables.find(v => v.variableName === variableName) : null;
    const isEdit = !!existingVariable;

    const formHtml = `
      <div class="border-t border-gray-200 mt-4 pt-4 bg-gray-50 rounded-md p-4">
        <h4 class="text-sm font-medium text-gray-900 mb-4">${isEdit ? 'Edit' : 'Add'} Variable</h4>
        <form id="variable-form" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Variable Name <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="var-name"
                placeholder="e.g., DB_NAME"
                class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                ${isEdit ? 'readonly' : 'required'}
                value="${isEdit ? escapeHtml(existingVariable.variableName) : ''}"
              >
              <p class="text-xs text-gray-500 mt-1">UPPER_SNAKE_CASE format</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Value <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="var-value"
                placeholder="e.g., my_database"
                class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                required
                value="${isEdit ? escapeHtml(existingVariable.value) : ''}"
              >
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              id="var-description"
              placeholder="What this variable represents..."
              class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              value="${isEdit && existingVariable.description ? escapeHtml(existingVariable.description) : ''}"
            >
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select id="var-category" class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                <option value="other" ${isEdit && existingVariable.category === 'other' ? 'selected' : ''}>Other</option>
                <option value="database" ${isEdit && existingVariable.category === 'database' ? 'selected' : ''}>Database</option>
                <option value="security" ${isEdit && existingVariable.category === 'security' ? 'selected' : ''}>Security</option>
                <option value="config" ${isEdit && existingVariable.category === 'config' ? 'selected' : ''}>Config</option>
                <option value="path" ${isEdit && existingVariable.category === 'path' ? 'selected' : ''}>Path</option>
                <option value="url" ${isEdit && existingVariable.category === 'url' ? 'selected' : ''}>URL</option>
                <option value="port" ${isEdit && existingVariable.category === 'port' ? 'selected' : ''}>Port</option>
                <option value="feature_flag" ${isEdit && existingVariable.category === 'feature_flag' ? 'selected' : ''}>Feature Flag</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Data Type</label>
              <select id="var-datatype" class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                <option value="string" ${isEdit && existingVariable.dataType === 'string' ? 'selected' : ''}>String</option>
                <option value="number" ${isEdit && existingVariable.dataType === 'number' ? 'selected' : ''}>Number</option>
                <option value="boolean" ${isEdit && existingVariable.dataType === 'boolean' ? 'selected' : ''}>Boolean</option>
                <option value="path" ${isEdit && existingVariable.dataType === 'path' ? 'selected' : ''}>Path</option>
                <option value="url" ${isEdit && existingVariable.dataType === 'url' ? 'selected' : ''}>URL</option>
                <option value="email" ${isEdit && existingVariable.dataType === 'email' ? 'selected' : ''}>Email</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end space-x-2">
            <button type="button" id="cancel-var-btn" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">
              ${isEdit ? 'Update' : 'Add'} Variable
            </button>
          </div>
        </form>
      </div>
    `;

    // Insert form
    const container = document.querySelector('#variables-list');
    const formContainer = document.createElement('div');
    formContainer.id = 'variable-form-container';
    formContainer.innerHTML = formHtml;
    container.insertBefore(formContainer, container.firstChild);

    // Attach event listeners
    document.getElementById('variable-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveVariable(isEdit);
    });

    document.getElementById('cancel-var-btn').addEventListener('click', () => {
      document.getElementById('variable-form-container').remove();
    });
  }

  /**
   * Save variable (create or update)
   */
  async saveVariable(isEdit = false) {
    const variableName = document.getElementById('var-name').value.trim();
    const value = document.getElementById('var-value').value.trim();
    const description = document.getElementById('var-description').value.trim();
    const category = document.getElementById('var-category').value;
    const dataType = document.getElementById('var-datatype').value;

    if (!variableName || !value) {
      showToast('Variable name and value are required', 'error');
      return;
    }

    // Validate UPPER_SNAKE_CASE
    if (!/^[A-Z][A-Z0-9_]*$/.test(variableName)) {
      showToast('Variable name must be UPPER_SNAKE_CASE (e.g., DB_NAME)', 'error');
      return;
    }

    try {
      const response = await apiRequest(`/api/admin/projects/${this.projectId}/variables`, {
        method: 'POST',
        body: JSON.stringify({
          variableName,
          value,
          description,
          category,
          dataType
        })
      });

      if (response.success) {
        showToast(`Variable ${isEdit ? 'updated' : 'created'} successfully`, 'success');
        // Reload variables
        const variablesResponse = await apiRequest(`/api/admin/projects/${this.projectId}/variables`);
        this.variables = variablesResponse.variables || [];
        // Re-render
        this.renderVariablesMode();
      } else {
        showToast(response.message || 'Failed to save variable', 'error');
      }
    } catch (error) {
      console.error('Failed to save variable:', error);
      showToast('Failed to save variable', 'error');
    }
  }

  /**
   * Edit variable
   */
  editVariable(variableName) {
    // Remove any existing form first
    const existingForm = document.getElementById('variable-form-container');
    if (existingForm) existingForm.remove();

    this.showVariableForm(variableName);
  }

  /**
   * Delete variable
   */
  async deleteVariable(variableName) {
    if (!confirm(`Delete variable "${variableName}"?`)) {
      return;
    }

    try {
      const response = await apiRequest(`/api/admin/projects/${this.projectId}/variables/${variableName}`, {
        method: 'DELETE'
      });

      if (response.success) {
        showToast('Variable deleted successfully', 'success');
        // Reload variables
        const variablesResponse = await apiRequest(`/api/admin/projects/${this.projectId}/variables`);
        this.variables = variablesResponse.variables || [];
        // Re-render
        this.renderVariablesMode();
      } else {
        showToast(response.message || 'Failed to delete variable', 'error');
      }
    } catch (error) {
      console.error('Failed to delete variable:', error);
      showToast('Failed to delete variable', 'error');
    }
  }

  /**
   * Populate form with project data (edit mode)
   */
  populateForm(project) {
    document.getElementById('project-id').value = project.id || '';
    document.getElementById('project-name').value = project.name || '';
    document.getElementById('project-description').value = project.description || '';
    document.getElementById('project-active').checked = project.active !== false;
    document.getElementById('repo-url').value = project.repositoryUrl || '';

    if (project.techStack) {
      document.getElementById('tech-framework').value = project.techStack.framework || '';
      document.getElementById('tech-database').value = project.techStack.database || '';
      document.getElementById('tech-frontend').value = project.techStack.frontend || '';
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    document.getElementById('close-modal').addEventListener('click', () => this.close());
    document.getElementById('cancel-btn').addEventListener('click', () => this.close());
    document.getElementById('save-btn').addEventListener('click', () => this.submit());
  }

  /**
   * Submit form
   */
  async submit() {
    const form = document.getElementById('project-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const projectData = {
      id: document.getElementById('project-id').value.trim(),
      name: document.getElementById('project-name').value.trim(),
      description: document.getElementById('project-description').value.trim(),
      active: document.getElementById('project-active').checked,
      repositoryUrl: document.getElementById('repo-url').value.trim() || null,
      techStack: {
        framework: document.getElementById('tech-framework').value.trim() || undefined,
        database: document.getElementById('tech-database').value.trim() || undefined,
        frontend: document.getElementById('tech-frontend').value.trim() || undefined
      }
    };

    try {
      let response;

      if (this.mode === 'create') {
        response = await apiRequest('/api/admin/projects', {
          method: 'POST',
          body: JSON.stringify(projectData)
        });
      } else {
        response = await apiRequest(`/api/admin/projects/${this.projectId}`, {
          method: 'PUT',
          body: JSON.stringify(projectData)
        });
      }

      if (response.success) {
        showToast(`Project ${this.mode === 'create' ? 'created' : 'updated'} successfully`, 'success');
        this.close();
        // Refresh project list
        if (window.loadProjects) window.loadProjects();
        if (window.loadStatistics) window.loadStatistics();
      } else {
        showToast(response.message || 'Failed to save project', 'error');
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      showToast('Failed to save project', 'error');
    }
  }

  /**
   * Close modal
   */
  close() {
    const container = document.getElementById('modal-container');
    container.innerHTML = '';
  }
}

// Utility function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Create global instance
window.projectEditor = new ProjectEditor();
