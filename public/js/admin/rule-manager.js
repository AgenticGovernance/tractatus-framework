/**
 * Rule Manager - Multi-Project Governance Dashboard
 * Handles filtering, sorting, pagination, and CRUD operations for rules
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
 * API request helper with automatic auth header injection and token refresh
 *
 * @param {string} endpoint - API endpoint path (e.g., '/api/admin/rules')
 * @param {Object} [options={}] - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Object>} JSON response from API
 *
 * @description
 * - Automatically adds Authorization header with Bearer token
 * - Redirects to login on 401 (unauthorized)
 * - Handles JSON response parsing
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
let currentPage = 1;
const pageSize = 20;
let totalRules = 0;
let selectedProjectId = null; // Track selected project for variable substitution
let filters = {
  scope: '',
  quadrant: '',
  persistence: '',
  validation: '',
  active: 'true',
  search: '',
  sort: 'priority',
  order: 'desc'
};

/**
 * Load and display dashboard statistics
 * Fetches rule counts, validation status, and average clarity scores
 *
 * @async
 * @description
 * Updates the following stat cards:
 * - Total rules
 * - Universal rules count
 * - Validated rules count
 * - Average clarity score
 */
async function loadStatistics() {
  try {
    const response = await apiRequest('/api/admin/rules/stats');

    if (!response.success || !response.stats) {
      console.error('Invalid stats response:', response);
      return;
    }

    const stats = response.stats;

    document.getElementById('stat-total').textContent = stats.total || 0;
    document.getElementById('stat-universal').textContent = stats.byScope?.UNIVERSAL || 0;
    document.getElementById('stat-validated').textContent = stats.byValidationStatus?.PASSED || 0;

    const avgClarity = stats.averageScores?.clarity;
    document.getElementById('stat-clarity').textContent = avgClarity ? avgClarity.toFixed(0) + '%' : 'N/A';
  } catch (error) {
    console.error('Failed to load statistics:', error);
    showToast('Failed to load statistics', 'error');
  }
}

/**
 * Load and render rules based on current filters, sorting, and pagination
 *
 * @async
 * @description
 * - Builds query parameters from current filter state
 * - Fetches rules from API
 * - Renders rule cards in grid layout
 * - Updates pagination UI
 * - Shows loading/empty/error states
 *
 * @fires loadRules - Called on filter change, sort change, or page change
 */
async function loadRules() {
  const container = document.getElementById('rules-grid');

  try {
    // Show loading state
    container.innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
        <p>Loading rules...</p>
      </div>
    `;

    // Build query parameters
    const params = new URLSearchParams({
      page: currentPage,
      limit: pageSize,
      sort: filters.sort,
      order: filters.order
    });

    if (filters.scope) params.append('scope', filters.scope);
    if (filters.quadrant) params.append('quadrant', filters.quadrant);
    if (filters.persistence) params.append('persistence', filters.persistence);
    if (filters.validation) params.append('validationStatus', filters.validation);
    if (filters.active) params.append('active', filters.active);
    if (filters.search) params.append('search', filters.search);

    // Include project ID for variable substitution
    if (selectedProjectId) params.append('projectId', selectedProjectId);

    const response = await apiRequest(`/api/admin/rules?${params.toString()}`);

    if (!response.success) {
      throw new Error('Failed to load rules');
    }

    const rules = response.rules || [];
    totalRules = response.pagination?.total || 0;

    // Update results count
    document.getElementById('filter-results').textContent =
      `Showing ${rules.length} of ${totalRules} rules`;

    // Render rules
    if (rules.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-gray-500">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No rules found</h3>
          <p class="mt-1 text-sm text-gray-500">Try adjusting your filters or create a new rule.</p>
        </div>
      `;
      document.getElementById('pagination').classList.add('hidden');
      return;
    }

    // Render rule cards
    container.innerHTML = `
      <div class="grid grid-cols-1 gap-4">
        ${rules.map(rule => renderRuleCard(rule)).join('')}
      </div>
    `;

    // Update pagination
    updatePagination(response.pagination);

  } catch (error) {
    console.error('Failed to load rules:', error);
    container.innerHTML = `
      <div class="text-center py-12 text-red-500">
        <p>Failed to load rules. Please try again.</p>
      </div>
    `;
    showToast('Failed to load rules', 'error');
  }
}

/**
 * Render a single rule as an HTML card
 *
 * @param {Object} rule - Rule object from API
 * @param {string} rule._id - MongoDB ObjectId
 * @param {string} rule.id - Rule ID (inst_xxx)
 * @param {string} rule.text - Rule text
 * @param {string} rule.scope - UNIVERSAL | PROJECT_SPECIFIC
 * @param {string} rule.quadrant - STRATEGIC | OPERATIONAL | TACTICAL | SYSTEM | STORAGE
 * @param {string} rule.persistence - HIGH | MEDIUM | LOW
 * @param {number} rule.priority - Priority (0-100)
 * @param {number} [rule.clarityScore] - Clarity score (0-100)
 * @param {Array<string>} [rule.variables] - Detected variables
 * @param {Object} [rule.usageStats] - Usage statistics
 *
 * @returns {string} HTML string for rule card
 *
 * @description
 * Generates a card with:
 * - Scope, quadrant, persistence, validation status badges
 * - Rule text (truncated to 2 lines)
 * - Priority, variable count, enforcement count
 * - Clarity score progress bar
 * - View/Edit/Delete action buttons
 */
function renderRuleCard(rule) {
  const scopeBadgeColor = rule.scope === 'UNIVERSAL' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  const quadrantBadgeColor = getQuadrantColor(rule.quadrant);
  const persistenceBadgeColor = getPersistenceColor(rule.persistence);
  const validationBadgeColor = getValidationColor(rule.validationStatus);
  const clarityScore = rule.clarityScore || 0;
  const clarityColor = clarityScore >= 80 ? 'bg-green-500' : clarityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return `
    <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div class="flex justify-between items-start mb-3">
        <div class="flex items-center space-x-2">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${scopeBadgeColor}">
            ${rule.scope}
          </span>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${quadrantBadgeColor}">
            ${rule.quadrant}
          </span>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${persistenceBadgeColor}">
            ${rule.persistence}
          </span>
          ${rule.validationStatus !== 'NOT_VALIDATED' ? `
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${validationBadgeColor}">
              ${rule.validationStatus}
            </span>
          ` : ''}
        </div>
        <span class="text-xs font-mono text-gray-500">${rule.id}</span>
      </div>

      ${rule.renderedText ? `
        <!-- Template Text -->
        <div class="mb-3">
          <div class="flex items-center mb-1">
            <svg class="h-4 w-4 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            <span class="text-xs font-medium text-gray-500 uppercase">Template</span>
          </div>
          <p class="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded line-clamp-2">${escapeHtml(rule.text)}</p>
        </div>

        <!-- Rendered Text (with substituted variables) -->
        <div class="mb-3">
          <div class="flex items-center mb-1">
            <svg class="h-4 w-4 text-indigo-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="text-xs font-medium text-indigo-600 uppercase">Rendered (${rule.projectContext || 'Unknown'})</span>
          </div>
          <p class="text-sm text-gray-900 bg-indigo-50 px-2 py-1 rounded line-clamp-2">${escapeHtml(rule.renderedText)}</p>
        </div>
      ` : `
        <!-- Template Text Only (no project selected) -->
        <p class="text-sm text-gray-900 mb-3 line-clamp-2">${escapeHtml(rule.text)}</p>
      `}

      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-4 text-xs text-gray-500">
          <div class="flex items-center">
            <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            Priority: ${rule.priority}
          </div>
          ${rule.variables && rule.variables.length > 0 ? `
            <div class="flex items-center">
              <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
              </svg>
              ${rule.variables.length} var${rule.variables.length !== 1 ? 's' : ''}
            </div>
          ` : ''}
          ${rule.usageStats?.timesEnforced > 0 ? `
            <div class="flex items-center">
              <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              ${rule.usageStats.timesEnforced} enforcements
            </div>
          ` : ''}
        </div>

        ${rule.clarityScore !== null ? `
          <div class="flex items-center">
            <span class="text-xs text-gray-500 mr-2">Clarity:</span>
            <div class="w-16 bg-gray-200 rounded-full h-2">
              <div class="${clarityColor} h-2 rounded-full" style="width: ${clarityScore}%"></div>
            </div>
            <span class="text-xs text-gray-600 ml-2">${clarityScore}%</span>
          </div>
        ` : ''}
      </div>

      <div class="flex space-x-2 pt-3 border-t border-gray-200">
        <button onclick="viewRule('${rule._id}')" class="flex-1 text-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
          View
        </button>
        <button onclick="editRule('${rule._id}')" class="flex-1 text-center px-3 py-2 border border-indigo-300 rounded-md text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
          Edit
        </button>
        <button onclick="deleteRule('${rule._id}', '${escapeHtml(rule.id)}')" class="px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100">
          Delete
        </button>
      </div>
    </div>
  `;
}

/**
 * Update pagination UI with page numbers and navigation buttons
 *
 * @param {Object} pagination - Pagination metadata from API
 * @param {number} pagination.page - Current page number
 * @param {number} pagination.limit - Items per page
 * @param {number} pagination.total - Total number of items
 * @param {number} pagination.pages - Total number of pages
 *
 * @description
 * - Shows/hides pagination based on total items
 * - Generates smart page number buttons (shows first, last, and pages around current)
 * - Adds ellipsis (...) for gaps in page numbers
 * - Enables/disables prev/next buttons based on current page
 */
function updatePagination(pagination) {
  const paginationDiv = document.getElementById('pagination');

  if (!pagination || pagination.total === 0) {
    paginationDiv.classList.add('hidden');
    return;
  }

  paginationDiv.classList.remove('hidden');

  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);

  document.getElementById('page-start').textContent = start;
  document.getElementById('page-end').textContent = end;
  document.getElementById('page-total').textContent = pagination.total;

  // Update page buttons
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');

  prevBtn.disabled = pagination.page <= 1;
  nextBtn.disabled = pagination.page >= pagination.pages;

  // Generate page numbers
  const pageNumbers = document.getElementById('page-numbers');
  const pages = [];
  const currentPage = pagination.page;
  const totalPages = pagination.pages;

  // Always show first page
  pages.push(1);

  // Show pages around current page
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    if (!pages.includes(i)) pages.push(i);
  }

  // Always show last page
  if (totalPages > 1 && !pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  pageNumbers.innerHTML = pages.map((page, index) => {
    const prev = pages[index - 1];
    const gap = prev && page - prev > 1 ? '<span class="px-2 text-gray-500">...</span>' : '';
    const active = page === currentPage ? 'bg-indigo-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50';

    return `
      ${gap}
      <button onclick="goToPage(${page})" class="px-3 py-1 rounded-md text-sm font-medium ${active}">
        ${page}
      </button>
    `;
  }).join('');
}

// Pagination handlers
function goToPage(page) {
  currentPage = page;
  loadRules();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('prev-page')?.addEventListener('click', () => {
  if (currentPage > 1) {
    goToPage(currentPage - 1);
  }
});

document.getElementById('next-page')?.addEventListener('click', () => {
  const maxPage = Math.ceil(totalRules / pageSize);
  if (currentPage < maxPage) {
    goToPage(currentPage + 1);
  }
});

// Filter handlers
function applyFilters() {
  currentPage = 1; // Reset to first page when filters change
  loadRules();
}

document.getElementById('filter-scope')?.addEventListener('change', (e) => {
  filters.scope = e.target.value;
  applyFilters();
});

document.getElementById('filter-quadrant')?.addEventListener('change', (e) => {
  filters.quadrant = e.target.value;
  applyFilters();
});

document.getElementById('filter-persistence')?.addEventListener('change', (e) => {
  filters.persistence = e.target.value;
  applyFilters();
});

document.getElementById('filter-validation')?.addEventListener('change', (e) => {
  filters.validation = e.target.value;
  applyFilters();
});

document.getElementById('filter-active')?.addEventListener('change', (e) => {
  filters.active = e.target.value;
  applyFilters();
});

document.getElementById('sort-by')?.addEventListener('change', (e) => {
  filters.sort = e.target.value;
  applyFilters();
});

document.getElementById('sort-order')?.addEventListener('change', (e) => {
  filters.order = e.target.value;
  applyFilters();
});

// Search with debouncing
let searchTimeout;
document.getElementById('search-box')?.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    filters.search = e.target.value;
    applyFilters();
  }, 500); // 500ms debounce
});

// Clear filters
document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
  filters = {
    scope: '',
    quadrant: '',
    persistence: '',
    validation: '',
    active: 'true',
    search: '',
    sort: 'priority',
    order: 'desc'
  };

  document.getElementById('filter-scope').value = '';
  document.getElementById('filter-quadrant').value = '';
  document.getElementById('filter-persistence').value = '';
  document.getElementById('filter-validation').value = '';
  document.getElementById('filter-active').value = 'true';
  document.getElementById('search-box').value = '';
  document.getElementById('sort-by').value = 'priority';
  document.getElementById('sort-order').value = 'desc';

  applyFilters();
});

// CRUD operations
async function viewRule(ruleId) {
  if (window.ruleEditor) {
    window.ruleEditor.openView(ruleId);
  } else {
    showToast('Rule editor not loaded', 'error');
  }
}

async function editRule(ruleId) {
  if (window.ruleEditor) {
    window.ruleEditor.openEdit(ruleId);
  } else {
    showToast('Rule editor not loaded', 'error');
  }
}

async function deleteRule(ruleId, ruleName) {
  if (!confirm(`Delete rule "${ruleName}"? This will deactivate the rule (soft delete).`)) {
    return;
  }

  try {
    const response = await apiRequest(`/api/admin/rules/${ruleId}`, {
      method: 'DELETE'
    });

    if (response.success) {
      showToast('Rule deleted successfully', 'success');
      loadRules();
      loadStatistics();
    } else {
      showToast(response.message || 'Failed to delete rule', 'error');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Failed to delete rule', 'error');
  }
}

// New rule button
document.getElementById('new-rule-btn')?.addEventListener('click', () => {
  if (window.ruleEditor) {
    window.ruleEditor.openCreate();
  } else {
    showToast('Rule editor not loaded', 'error');
  }
});

/**
 * Show a toast notification message
 *
 * @param {string} message - Message to display
 * @param {string} [type='info'] - Toast type (success | error | warning | info)
 *
 * @description
 * - Creates animated toast notification in top-right corner
 * - Auto-dismisses after 5 seconds
 * - Can be manually dismissed by clicking X button
 * - Color-coded by type (green=success, red=error, yellow=warning, blue=info)
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
function getQuadrantColor(quadrant) {
  const colors = {
    STRATEGIC: 'bg-purple-100 text-purple-800',
    OPERATIONAL: 'bg-green-100 text-green-800',
    TACTICAL: 'bg-yellow-100 text-yellow-800',
    SYSTEM: 'bg-blue-100 text-blue-800',
    STORAGE: 'bg-gray-100 text-gray-800'
  };
  return colors[quadrant] || 'bg-gray-100 text-gray-800';
}

function getPersistenceColor(persistence) {
  const colors = {
    HIGH: 'bg-red-100 text-red-800',
    MEDIUM: 'bg-orange-100 text-orange-800',
    LOW: 'bg-yellow-100 text-yellow-800'
  };
  return colors[persistence] || 'bg-gray-100 text-gray-800';
}

function getValidationColor(status) {
  const colors = {
    PASSED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    NEEDS_REVIEW: 'bg-yellow-100 text-yellow-800',
    NOT_VALIDATED: 'bg-gray-100 text-gray-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions global for onclick handlers
window.viewRule = viewRule;
window.editRule = editRule;
window.deleteRule = deleteRule;
window.goToPage = goToPage;

/**
 * Initialize project selector for variable substitution
 * When a project is selected, rules will show both template and rendered text
 */
const projectSelector = new ProjectSelector('project-selector-container', {
  showAllOption: true,
  allOptionText: 'All Projects (Template View)',
  label: 'Project Context for Variable Substitution',
  showLabel: true,
  compact: false,
  onChange: (projectId, project) => {
    // Update selected project state
    selectedProjectId = projectId;

    // Reload rules with new project context
    currentPage = 1; // Reset to first page
    loadRules();

    // Show toast notification
    if (projectId && project) {
      showToast(`Viewing rules with ${project.name} context`, 'info');
    } else {
      showToast('Viewing template rules (no variable substitution)', 'info');
    }
  }
});

// Initialize on page load
loadStatistics();
loadRules();
