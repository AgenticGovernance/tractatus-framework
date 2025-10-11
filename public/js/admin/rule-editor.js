/**
 * Rule Editor Modal
 * Handles creation, editing, and viewing of governance rules with real-time validation
 *
 * @class RuleEditor
 *
 * @description
 * Modal component for rule CRUD operations with these features:
 * - Three modes: create, edit, view (read-only)
 * - Real-time variable detection (${VAR_NAME} pattern)
 * - Live clarity score calculation using heuristics
 * - Dynamic example fields (add/remove)
 * - Form validation before submission
 * - Integration with rule-manager for list refresh
 *
 * @example
 * // Create global instance
 * const ruleEditor = new RuleEditor();
 *
 * // Open in create mode
 * ruleEditor.openCreate();
 *
 * // Open in edit mode
 * ruleEditor.openEdit('68e8c3a6499d095048311f03');
 *
 * // Open in view mode (read-only)
 * ruleEditor.openView('68e8c3a6499d095048311f03');
 *
 * @property {string} mode - Current mode (create | edit | view)
 * @property {string} ruleId - MongoDB ObjectId of rule being edited
 * @property {Object} originalRule - Original rule data (for edit mode)
 * @property {Array<string>} detectedVariables - Variables detected in rule text
 */

class RuleEditor {
  constructor() {
    this.mode = 'create'; // 'create' or 'edit'
    this.ruleId = null;
    this.originalRule = null;
    this.detectedVariables = [];
  }

  /**
   * Open editor in create mode
   */
  openCreate() {
    this.mode = 'create';
    this.ruleId = null;
    this.originalRule = null;
    this.detectedVariables = [];
    this.render();
    this.attachEventListeners();
  }

  /**
   * Open editor in edit mode
   */
  async openEdit(ruleId) {
    this.mode = 'edit';
    this.ruleId = ruleId;

    try {
      const response = await apiRequest(`/api/admin/rules/${ruleId}`);

      if (!response.success || !response.rule) {
        throw new Error('Failed to load rule');
      }

      this.originalRule = response.rule;
      this.detectedVariables = response.rule.variables || [];
      this.render();
      this.populateForm(response.rule);
      this.attachEventListeners();
    } catch (error) {
      console.error('Failed to load rule:', error);
      showToast('Failed to load rule for editing', 'error');
    }
  }

  /**
   * Open editor in view mode (read-only)
   */
  async openView(ruleId) {
    this.mode = 'view';
    this.ruleId = ruleId;

    try {
      const response = await apiRequest(`/api/admin/rules/${ruleId}`);

      if (!response.success || !response.rule) {
        throw new Error('Failed to load rule');
      }

      this.originalRule = response.rule;
      this.detectedVariables = response.rule.variables || [];
      this.renderViewMode(response.rule);
    } catch (error) {
      console.error('Failed to load rule:', error);
      showToast('Failed to load rule', 'error');
    }
  }

  /**
   * Render the editor modal
   */
  render() {
    const container = document.getElementById('modal-container');
    const title = this.mode === 'create' ? 'Create New Rule' : 'Edit Rule';

    container.innerHTML = `
      <div id="rule-editor-modal" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
            <form id="rule-form">
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Left Column: Main Fields -->
                <div class="lg:col-span-2 space-y-6">
                  <!-- Rule ID -->
                  <div>
                    <label for="rule-id" class="block text-sm font-medium text-gray-700 mb-1">
                      Rule ID <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="rule-id"
                      name="id"
                      placeholder="e.g., inst_019"
                      class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      ${this.mode === 'edit' ? 'disabled' : 'required'}
                    >
                    <p class="mt-1 text-xs text-gray-500">Unique identifier (e.g., inst_019, inst_020)</p>
                  </div>

                  <!-- Rule Text -->
                  <div>
                    <label for="rule-text" class="block text-sm font-medium text-gray-700 mb-1">
                      Rule Text <span class="text-red-500">*</span>
                    </label>
                    <textarea
                      id="rule-text"
                      name="text"
                      rows="4"
                      placeholder="Enter the governance rule text... Use \${VAR_NAME} for variables."
                      class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      required
                    ></textarea>
                    <p class="mt-1 text-xs text-gray-500">Use <code class="bg-gray-100 px-1 rounded">\${VARIABLE_NAME}</code> for dynamic values</p>
                  </div>

                  <!-- Detected Variables -->
                  <div id="variables-section" class="hidden">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Detected Variables
                    </label>
                    <div id="variables-list" class="flex flex-wrap gap-2">
                      <!-- Variables will be inserted here -->
                    </div>
                  </div>

                  <!-- Examples -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Examples (optional)
                    </label>
                    <div id="examples-list" class="space-y-2">
                      <!-- Examples will be inserted here -->
                    </div>
                    <button type="button" id="add-example" class="mt-2 text-sm text-indigo-600 hover:text-indigo-700">
                      + Add Example
                    </button>
                  </div>

                  <!-- Notes -->
                  <div>
                    <label for="rule-notes" class="block text-sm font-medium text-gray-700 mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      id="rule-notes"
                      name="notes"
                      rows="3"
                      placeholder="Additional notes or clarifications..."
                      class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    ></textarea>
                  </div>
                </div>

                <!-- Right Column: Classification & Settings -->
                <div class="space-y-6">
                  <!-- Scope -->
                  <div>
                    <label for="rule-scope" class="block text-sm font-medium text-gray-700 mb-1">
                      Scope <span class="text-red-500">*</span>
                    </label>
                    <select
                      id="rule-scope"
                      name="scope"
                      class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="PROJECT_SPECIFIC">Project-Specific</option>
                      <option value="UNIVERSAL">Universal</option>
                    </select>
                    <p class="mt-1 text-xs text-gray-500">Universal rules apply to all projects</p>
                  </div>

                  <!-- Quadrant -->
                  <div>
                    <label for="rule-quadrant" class="block text-sm font-medium text-gray-700 mb-1">
                      Quadrant <span class="text-red-500">*</span>
                    </label>
                    <select
                      id="rule-quadrant"
                      name="quadrant"
                      class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="">Select...</option>
                      <option value="STRATEGIC">Strategic</option>
                      <option value="OPERATIONAL">Operational</option>
                      <option value="TACTICAL">Tactical</option>
                      <option value="SYSTEM">System</option>
                      <option value="STORAGE">Storage</option>
                    </select>
                  </div>

                  <!-- Persistence -->
                  <div>
                    <label for="rule-persistence" class="block text-sm font-medium text-gray-700 mb-1">
                      Persistence <span class="text-red-500">*</span>
                    </label>
                    <select
                      id="rule-persistence"
                      name="persistence"
                      class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="">Select...</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>

                  <!-- Category -->
                  <div>
                    <label for="rule-category" class="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      id="rule-category"
                      name="category"
                      class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="technical">Technical</option>
                      <option value="content">Content</option>
                      <option value="security">Security</option>
                      <option value="privacy">Privacy</option>
                      <option value="process">Process</option>
                      <option value="values">Values</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <!-- Priority -->
                  <div>
                    <label for="rule-priority" class="block text-sm font-medium text-gray-700 mb-1">
                      Priority: <span id="priority-value" class="font-semibold">50</span>
                    </label>
                    <input
                      type="range"
                      id="rule-priority"
                      name="priority"
                      min="0"
                      max="100"
                      value="50"
                      class="w-full"
                    >
                    <div class="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Low (0)</span>
                      <span>High (100)</span>
                    </div>
                  </div>

                  <!-- Temporal Scope -->
                  <div>
                    <label for="rule-temporal" class="block text-sm font-medium text-gray-700 mb-1">
                      Temporal Scope
                    </label>
                    <select
                      id="rule-temporal"
                      name="temporalScope"
                      class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="PERMANENT">Permanent</option>
                      <option value="PROJECT">Project</option>
                      <option value="SESSION">Session</option>
                      <option value="IMMEDIATE">Immediate</option>
                    </select>
                  </div>

                  <!-- Active Status -->
                  <div class="flex items-center">
                    <input
                      type="checkbox"
                      id="rule-active"
                      name="active"
                      checked
                      class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    >
                    <label for="rule-active" class="ml-2 block text-sm text-gray-900">
                      Active
                    </label>
                  </div>

                  <!-- Clarity Score Preview -->
                  <div class="bg-gray-50 rounded-lg p-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Clarity Score Preview
                    </label>
                    <div class="flex items-center space-x-3">
                      <div class="flex-1 bg-gray-200 rounded-full h-2">
                        <div id="clarity-bar" class="bg-green-500 h-2 rounded-full transition-all" style="width: 100%"></div>
                      </div>
                      <span id="clarity-score" class="text-2xl font-semibold text-gray-900">100</span>
                    </div>
                    <p class="mt-2 text-xs text-gray-600">
                      Based on language strength and specificity
                    </p>
                  </div>

                  <!-- AI Optimization Panel -->
                  ${this.mode === 'edit' ? `
                  <div class="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                    <div class="flex items-center justify-between mb-3">
                      <label class="block text-sm font-medium text-indigo-900">
                        AI Assistant
                      </label>
                      <svg class="h-5 w-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 7H7v6h6V7z"/>
                        <path fill-rule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clip-rule="evenodd"/>
                      </svg>
                    </div>
                    <button
                      type="button"
                      id="optimize-rule-btn"
                      class="w-full px-4 py-2 border border-indigo-300 rounded-md text-sm font-medium text-indigo-700 bg-white hover:bg-indigo-50 transition-colors"
                    >
                      Analyze & Optimize
                    </button>
                    <p class="mt-2 text-xs text-indigo-700">
                      Get AI-powered suggestions to improve clarity, specificity, and actionability
                    </p>
                  </div>

                  <!-- Optimization Results (hidden by default) -->
                  <div id="optimization-results" class="hidden space-y-4">
                    <!-- Overall Scores -->
                    <div class="bg-white rounded-lg p-4 border border-gray-200">
                      <label class="block text-sm font-medium text-gray-700 mb-3">Quality Analysis</label>
                      <div class="space-y-3">
                        <div>
                          <div class="flex justify-between text-xs mb-1">
                            <span>Clarity</span>
                            <span id="ai-clarity-score" class="font-medium">-</span>
                          </div>
                          <div class="w-full bg-gray-200 rounded-full h-1.5">
                            <div id="ai-clarity-bar" class="bg-green-500 h-1.5 rounded-full transition-all" style="width: 0%"></div>
                          </div>
                        </div>
                        <div>
                          <div class="flex justify-between text-xs mb-1">
                            <span>Specificity</span>
                            <span id="ai-specificity-score" class="font-medium">-</span>
                          </div>
                          <div class="w-full bg-gray-200 rounded-full h-1.5">
                            <div id="ai-specificity-bar" class="bg-blue-500 h-1.5 rounded-full transition-all" style="width: 0%"></div>
                          </div>
                        </div>
                        <div>
                          <div class="flex justify-between text-xs mb-1">
                            <span>Actionability</span>
                            <span id="ai-actionability-score" class="font-medium">-</span>
                          </div>
                          <div class="w-full bg-gray-200 rounded-full h-1.5">
                            <div id="ai-actionability-bar" class="bg-purple-500 h-1.5 rounded-full transition-all" style="width: 0%"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Issues & Suggestions -->
                    <div id="optimization-suggestions" class="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <label class="block text-sm font-medium text-yellow-900 mb-2">Suggestions</label>
                      <div id="suggestions-list" class="space-y-2">
                        <!-- Suggestions will be inserted here -->
                      </div>
                    </div>

                    <!-- Auto-Optimize Button -->
                    <div id="auto-optimize-section" class="hidden">
                      <button
                        type="button"
                        id="apply-optimization-btn"
                        class="w-full px-4 py-2 border border-green-600 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
                      >
                        Apply Optimizations
                      </button>
                      <p class="mt-2 text-xs text-gray-600 text-center">
                        This will update the rule text with AI suggestions
                      </p>
                    </div>
                  </div>
                  ` : ''}
                </div>
              </div>
            </form>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50">
            <button
              type="button"
              id="cancel-btn"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-btn"
              class="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              ${this.mode === 'create' ? 'Create Rule' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render view-only mode
   */
  renderViewMode(rule) {
    const container = document.getElementById('modal-container');

    container.innerHTML = `
      <div id="rule-viewer-modal" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 class="text-lg font-medium text-gray-900">Rule Details</h3>
              <p class="text-sm text-gray-500 font-mono">${rule.id}</p>
            </div>
            <button id="close-modal" class="text-gray-400 hover:text-gray-500">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- Badges -->
            <div class="flex flex-wrap gap-2 mb-4">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${rule.scope === 'UNIVERSAL' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}">
                ${rule.scope}
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${this.getQuadrantColor(rule.quadrant)}">
                ${rule.quadrant}
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${this.getPersistenceColor(rule.persistence)}">
                ${rule.persistence}
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${this.getValidationColor(rule.validationStatus)}">
                ${rule.validationStatus}
              </span>
            </div>

            <!-- Rule Text -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Rule Text</label>
              <div class="bg-gray-50 rounded-lg p-4 font-mono text-sm">${this.escapeHtml(rule.text)}</div>
            </div>

            <!-- Variables -->
            ${rule.variables && rule.variables.length > 0 ? `
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Variables</label>
                <div class="flex flex-wrap gap-2">
                  ${rule.variables.map(v => `
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      \${${v}}
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Details Grid -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label class="block text-sm font-medium text-gray-700">Category</label>
                <p class="mt-1 text-sm text-gray-900 capitalize">${rule.category}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Priority</label>
                <p class="mt-1 text-sm text-gray-900">${rule.priority}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Temporal Scope</label>
                <p class="mt-1 text-sm text-gray-900">${rule.temporalScope}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Status</label>
                <p class="mt-1 text-sm text-gray-900">${rule.active ? 'Active' : 'Inactive'}</p>
              </div>
            </div>

            <!-- Scores -->
            ${rule.clarityScore !== null ? `
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Quality Scores</label>
                <div class="space-y-3">
                  <div>
                    <div class="flex justify-between text-sm mb-1">
                      <span>Clarity</span>
                      <span class="font-medium">${rule.clarityScore}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="bg-green-500 h-2 rounded-full" style="width: ${rule.clarityScore}%"></div>
                    </div>
                  </div>
                  ${rule.specificityScore !== null ? `
                    <div>
                      <div class="flex justify-between text-sm mb-1">
                        <span>Specificity</span>
                        <span class="font-medium">${rule.specificityScore}%</span>
                      </div>
                      <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-500 h-2 rounded-full" style="width: ${rule.specificityScore}%"></div>
                      </div>
                    </div>
                  ` : ''}
                  ${rule.actionabilityScore !== null ? `
                    <div>
                      <div class="flex justify-between text-sm mb-1">
                        <span>Actionability</span>
                        <span class="font-medium">${rule.actionabilityScore}%</span>
                      </div>
                      <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-yellow-500 h-2 rounded-full" style="width: ${rule.actionabilityScore}%"></div>
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Notes -->
            ${rule.notes ? `
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <div class="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">${this.escapeHtml(rule.notes)}</div>
              </div>
            ` : ''}

            <!-- Metadata -->
            <div class="border-t border-gray-200 pt-4">
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-gray-500">Created:</span>
                  <span class="ml-2 text-gray-900">${this.formatDate(rule.createdAt)}</span>
                </div>
                <div>
                  <span class="text-gray-500">Updated:</span>
                  <span class="ml-2 text-gray-900">${this.formatDate(rule.updatedAt)}</span>
                </div>
                <div>
                  <span class="text-gray-500">Created by:</span>
                  <span class="ml-2 text-gray-900">${rule.createdBy}</span>
                </div>
                <div>
                  <span class="text-gray-500">Source:</span>
                  <span class="ml-2 text-gray-900">${rule.source}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 flex justify-between bg-gray-50">
            <button
              type="button"
              onclick="editRule('${rule._id}')"
              class="px-4 py-2 border border-indigo-300 rounded-md text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
            >
              Edit Rule
            </button>
            <button
              type="button"
              id="close-modal"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    // Attach close handler
    document.querySelectorAll('#close-modal').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
  }

  /**
   * Populate form with existing rule data (edit mode)
   */
  populateForm(rule) {
    document.getElementById('rule-id').value = rule.id;
    document.getElementById('rule-text').value = rule.text;
    document.getElementById('rule-scope').value = rule.scope;
    document.getElementById('rule-quadrant').value = rule.quadrant;
    document.getElementById('rule-persistence').value = rule.persistence;
    document.getElementById('rule-category').value = rule.category || 'other';
    document.getElementById('rule-priority').value = rule.priority || 50;
    document.getElementById('priority-value').textContent = rule.priority || 50;
    document.getElementById('rule-temporal').value = rule.temporalScope || 'PERMANENT';
    document.getElementById('rule-active').checked = rule.active !== false;
    document.getElementById('rule-notes').value = rule.notes || '';

    // Populate examples if any
    if (rule.examples && rule.examples.length > 0) {
      rule.examples.forEach(example => {
        this.addExampleField(example);
      });
    }

    // Trigger variable detection
    this.detectVariables();
    this.calculateClarityScore();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close modal
    document.querySelectorAll('#close-modal, #cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // Variable detection on text change
    document.getElementById('rule-text').addEventListener('input', () => {
      this.detectVariables();
      this.calculateClarityScore();
    });

    // Priority slider
    document.getElementById('rule-priority').addEventListener('input', (e) => {
      document.getElementById('priority-value').textContent = e.target.value;
    });

    // Add example button
    document.getElementById('add-example').addEventListener('click', () => {
      this.addExampleField();
    });

    // AI Optimization (edit mode only)
    if (this.mode === 'edit') {
      const optimizeBtn = document.getElementById('optimize-rule-btn');
      if (optimizeBtn) {
        optimizeBtn.addEventListener('click', () => this.runOptimization());
      }

      const applyBtn = document.getElementById('apply-optimization-btn');
      if (applyBtn) {
        applyBtn.addEventListener('click', () => this.applyOptimization());
      }
    }

    // Form submission
    document.getElementById('save-btn').addEventListener('click', (e) => {
      e.preventDefault();
      this.saveRule();
    });
  }

  /**
   * Detect variables in rule text
   */
  detectVariables() {
    const text = document.getElementById('rule-text').value;
    const varPattern = /\$\{([A-Z_]+)\}/g;
    const variables = [];
    let match;

    while ((match = varPattern.exec(text)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    this.detectedVariables = variables;

    // Update UI
    const section = document.getElementById('variables-section');
    const list = document.getElementById('variables-list');

    if (variables.length > 0) {
      section.classList.remove('hidden');
      list.innerHTML = variables.map(v => `
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          \${${v}}
        </span>
      `).join('');
    } else {
      section.classList.add('hidden');
    }
  }

  /**
   * Calculate clarity score (heuristic)
   */
  calculateClarityScore() {
    const text = document.getElementById('rule-text').value;
    let score = 100;

    if (!text) {
      score = 0;
    } else {
      // Deduct for weak language
      const weakWords = ['try', 'maybe', 'consider', 'might', 'probably', 'possibly', 'perhaps'];
      weakWords.forEach(word => {
        if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
          score -= 10;
        }
      });

      // Bonus for strong imperatives
      const strongWords = ['MUST', 'SHALL', 'REQUIRED', 'PROHIBITED', 'NEVER'];
      const hasStrong = strongWords.some(word => new RegExp(`\\b${word}\\b`).test(text));
      if (!hasStrong) score -= 10;

      // Bonus for specificity (has numbers or variables)
      if (!/\d/.test(text) && !/\$\{[A-Z_]+\}/.test(text)) {
        score -= 5;
      }
    }

    score = Math.max(0, Math.min(100, score));

    // Update UI
    document.getElementById('clarity-score').textContent = score;
    const bar = document.getElementById('clarity-bar');
    bar.style.width = `${score}%`;
    bar.className = `h-2 rounded-full transition-all ${
      score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
    }`;
  }

  /**
   * Add example field
   */
  addExampleField(value = '') {
    const list = document.getElementById('examples-list');
    const index = list.children.length;

    const div = document.createElement('div');
    div.className = 'flex space-x-2';
    div.innerHTML = `
      <input
        type="text"
        name="example-${index}"
        value="${this.escapeHtml(value)}"
        placeholder="Example scenario..."
        class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
      >
      <button type="button" class="text-red-600 hover:text-red-700" onclick="this.parentElement.remove()">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    list.appendChild(div);
  }

  /**
   * Save rule (create or update)
   */
  async saveRule() {
    const form = document.getElementById('rule-form');

    // Get form data
    const formData = {
      id: document.getElementById('rule-id').value.trim(),
      text: document.getElementById('rule-text').value.trim(),
      scope: document.getElementById('rule-scope').value,
      quadrant: document.getElementById('rule-quadrant').value,
      persistence: document.getElementById('rule-persistence').value,
      category: document.getElementById('rule-category').value,
      priority: parseInt(document.getElementById('rule-priority').value),
      temporalScope: document.getElementById('rule-temporal').value,
      active: document.getElementById('rule-active').checked,
      notes: document.getElementById('rule-notes').value.trim()
    };

    // Collect examples
    const exampleInputs = document.querySelectorAll('[name^="example-"]');
    formData.examples = Array.from(exampleInputs)
      .map(input => input.value.trim())
      .filter(val => val.length > 0);

    // Validation
    if (!formData.id) {
      showToast('Rule ID is required', 'error');
      return;
    }
    if (!formData.text) {
      showToast('Rule text is required', 'error');
      return;
    }
    if (!formData.quadrant) {
      showToast('Quadrant is required', 'error');
      return;
    }
    if (!formData.persistence) {
      showToast('Persistence is required', 'error');
      return;
    }

    // Save
    try {
      const saveBtn = document.getElementById('save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      let response;
      if (this.mode === 'create') {
        response = await apiRequest('/api/admin/rules', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      } else {
        response = await apiRequest(`/api/admin/rules/${this.ruleId}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      }

      if (response.success) {
        showToast(
          this.mode === 'create' ? 'Rule created successfully' : 'Rule updated successfully',
          'success'
        );
        this.close();
        // Refresh the rules list
        if (typeof loadRules === 'function') loadRules();
        if (typeof loadStatistics === 'function') loadStatistics();
      } else {
        throw new Error(response.message || 'Failed to save rule');
      }
    } catch (error) {
      console.error('Save error:', error);
      showToast(error.message || 'Failed to save rule', 'error');

      const saveBtn = document.getElementById('save-btn');
      saveBtn.disabled = false;
      saveBtn.textContent = this.mode === 'create' ? 'Create Rule' : 'Save Changes';
    }
  }

  /**
   * Close the modal
   */
  close() {
    const container = document.getElementById('modal-container');
    container.innerHTML = '';
  }

  // Utility methods
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getQuadrantColor(quadrant) {
    const colors = {
      STRATEGIC: 'bg-purple-100 text-purple-800',
      OPERATIONAL: 'bg-green-100 text-green-800',
      TACTICAL: 'bg-yellow-100 text-yellow-800',
      SYSTEM: 'bg-blue-100 text-blue-800',
      STORAGE: 'bg-gray-100 text-gray-800'
    };
    return colors[quadrant] || 'bg-gray-100 text-gray-800';
  }

  getPersistenceColor(persistence) {
    const colors = {
      HIGH: 'bg-red-100 text-red-800',
      MEDIUM: 'bg-orange-100 text-orange-800',
      LOW: 'bg-yellow-100 text-yellow-800'
    };
    return colors[persistence] || 'bg-gray-100 text-gray-800';
  }

  getValidationColor(status) {
    const colors = {
      PASSED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      NEEDS_REVIEW: 'bg-yellow-100 text-yellow-800',
      NOT_VALIDATED: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  /**
   * Run AI optimization analysis
   */
  async runOptimization() {
    if (!this.ruleId) return;

    const optimizeBtn = document.getElementById('optimize-rule-btn');
    const resultsSection = document.getElementById('optimization-results');

    try {
      // Show loading state
      optimizeBtn.disabled = true;
      optimizeBtn.innerHTML = `
        <svg class="animate-spin h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      `;

      // Call optimization API
      const response = await apiRequest(`/api/admin/rules/${this.ruleId}/optimize`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'aggressive' })
      });

      if (!response.success) {
        throw new Error(response.message || 'Optimization failed');
      }

      // Store optimization result
      this.optimizationResult = response;

      // Display results
      this.displayOptimizationResults(response);

      // Show results section
      resultsSection.classList.remove('hidden');

      showToast('Analysis complete', 'success');

    } catch (error) {
      console.error('Optimization error:', error);
      showToast(error.message || 'Failed to run optimization', 'error');
    } finally {
      optimizeBtn.disabled = false;
      optimizeBtn.textContent = 'Analyze & Optimize';
    }
  }

  /**
   * Display optimization results in UI
   */
  displayOptimizationResults(result) {
    const { analysis, optimization } = result;

    // Update score bars
    this.updateScoreBar('ai-clarity', analysis.clarity.score, analysis.clarity.grade);
    this.updateScoreBar('ai-specificity', analysis.specificity.score, analysis.specificity.grade);
    this.updateScoreBar('ai-actionability', analysis.actionability.score, analysis.actionability.grade);

    // Display suggestions
    const suggestionsList = document.getElementById('suggestions-list');
    const allIssues = [
      ...analysis.clarity.issues,
      ...analysis.specificity.issues,
      ...analysis.actionability.issues
    ];

    if (allIssues.length > 0) {
      suggestionsList.innerHTML = allIssues.map((issue, index) => `
        <div class="flex items-start space-x-2 text-xs">
          <span class="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-200 flex items-center justify-center text-yellow-800 font-bold">
            ${index + 1}
          </span>
          <span class="text-yellow-900">${this.escapeHtml(issue)}</span>
        </div>
      `).join('');
    } else {
      suggestionsList.innerHTML = `
        <div class="text-xs text-green-700">
          ✓ No issues found - this rule is well-formed!
        </div>
      `;
    }

    // Show/hide apply button based on whether there are optimizations
    const applySection = document.getElementById('auto-optimize-section');
    if (optimization.optimizedText !== result.rule.originalText) {
      applySection.classList.remove('hidden');
    } else {
      applySection.classList.add('hidden');
    }
  }

  /**
   * Update score bar visualization
   */
  updateScoreBar(prefix, score, grade) {
    const scoreElement = document.getElementById(`${prefix}-score`);
    const barElement = document.getElementById(`${prefix}-bar`);

    scoreElement.textContent = `${score} (${grade})`;
    barElement.style.width = `${score}%`;

    // Update color based on score
    const colorClass = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
    barElement.className = `h-1.5 rounded-full transition-all ${colorClass}`;
  }

  /**
   * Apply AI optimizations to rule text
   */
  async applyOptimization() {
    if (!this.optimizationResult) return;

    const { optimization } = this.optimizationResult;
    const ruleTextArea = document.getElementById('rule-text');

    // Confirm with user
    if (!confirm('Apply AI optimizations to rule text? This will overwrite your current text.')) {
      return;
    }

    // Update text area
    ruleTextArea.value = optimization.optimizedText;

    // Trigger variable detection and clarity recalculation
    this.detectVariables();
    this.calculateClarityScore();

    // Hide results and reset
    document.getElementById('optimization-results').classList.add('hidden');
    this.optimizationResult = null;

    showToast(`Applied ${optimization.changes.length} optimization(s)`, 'success');
  }
}

// Create global instance
window.ruleEditor = new RuleEditor();
