/**
 * CLAUDE.md Migration Wizard
 * Handles multi-step migration of CLAUDE.md rules to database
 */

let analysisResult = null;
let selectedCandidates = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  checkAuth();
});

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  // Step 1: Upload
  document.getElementById('file-upload').addEventListener('change', handleFileUpload);
  document.getElementById('analyze-btn').addEventListener('click', analyzeClaudeMd);

  // Step 2: Review
  document.getElementById('back-to-upload-btn').addEventListener('click', () => goToStep(1));
  document.getElementById('create-rules-btn').addEventListener('click', createSelectedRules);

  // Step 3: Results
  document.getElementById('migrate-another-btn').addEventListener('click', () => goToStep(1));

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);
}

/**
 * Check authentication
 */
async function checkAuth() {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    window.location.href = '/admin/login.html';
  }
}

/**
 * Handle file upload
 */
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('claude-md-content').value = e.target.result;
    showToast('File loaded successfully', 'success');
  };
  reader.onerror = () => {
    showToast('Failed to read file', 'error');
  };
  reader.readAsText(file);
}

/**
 * Analyze CLAUDE.md content
 */
async function analyzeClaudeMd() {
  const content = document.getElementById('claude-md-content').value.trim();

  if (!content) {
    showToast('Please upload or paste CLAUDE.md content', 'error');
    return;
  }

  const analyzeBtn = document.getElementById('analyze-btn');
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';

  try {
    const response = await apiRequest('/api/admin/rules/analyze-claude-md', {
      method: 'POST',
      body: JSON.stringify({ content })
    });

    if (!response.success) {
      throw new Error(response.message || 'Analysis failed');
    }

    analysisResult = response.analysis;
    displayAnalysisResults(analysisResult);
    goToStep(2);

  } catch (error) {
    console.error('Analysis error:', error);
    showToast(error.message || 'Failed to analyze CLAUDE.md', 'error');
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze CLAUDE.md';
  }
}

/**
 * Display analysis results
 */
function displayAnalysisResults(analysis) {
  // Update statistics
  document.getElementById('stat-total').textContent = analysis.totalStatements;
  document.getElementById('stat-high-quality').textContent = analysis.quality.highQuality;
  document.getElementById('stat-needs-clarification').textContent = analysis.quality.needsClarification;
  document.getElementById('stat-too-nebulous').textContent = analysis.quality.tooNebulous;

  // Reset selected candidates
  selectedCandidates = [];

  // Display high-quality candidates (auto-selected)
  const highQualityList = document.getElementById('high-quality-list');
  const highQualityCandidates = analysis.candidates.filter(c => c.quality === 'HIGH');

  if (highQualityCandidates.length > 0) {
    highQualityList.innerHTML = highQualityCandidates.map((candidate, index) => `
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex items-start">
          <input
            type="checkbox"
            id="candidate-high-${index}"
            class="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            checked
            onchange="toggleCandidate(${JSON.stringify(candidate).replace(/"/g, '&quot;')}, this.checked)"
          >
          <div class="ml-3 flex-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-green-900">${escapeHtml(candidate.sectionTitle)}</span>
              <div class="flex items-center space-x-2">
                <span class="px-2 py-1 text-xs rounded-full ${getQuadrantColor(candidate.quadrant)}">${candidate.quadrant}</span>
                <span class="px-2 py-1 text-xs rounded-full ${getPersistenceColor(candidate.persistence)}">${candidate.persistence}</span>
              </div>
            </div>
            <div class="mt-2 space-y-2">
              <div>
                <p class="text-xs text-gray-600">Original:</p>
                <p class="text-sm text-gray-800">${escapeHtml(candidate.originalText)}</p>
              </div>
              <div>
                <p class="text-xs text-gray-600">Suggested:</p>
                <p class="text-sm font-medium text-green-900">${escapeHtml(candidate.suggestedRule.text)}</p>
              </div>
              ${candidate.suggestedRule.variables && candidate.suggestedRule.variables.length > 0 ? `
                <div class="flex flex-wrap gap-1">
                  ${candidate.suggestedRule.variables.map(v => `
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      \${${v}}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
              <div class="flex items-center space-x-4 text-xs">
                <span class="text-gray-600">Clarity: <span class="font-medium">${candidate.suggestedRule.clarityScore}%</span></span>
                <span class="text-gray-600">Scope: <span class="font-medium">${candidate.suggestedRule.scope}</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    // Auto-select high-quality candidates
    highQualityCandidates.forEach(c => selectedCandidates.push(c));
  } else {
    highQualityList.innerHTML = '<p class="text-sm text-gray-500">No high-quality candidates found.</p>';
  }

  // Display needs clarification candidates
  const needsClarificationList = document.getElementById('needs-clarification-list');
  const needsClarificationCandidates = analysis.candidates.filter(c => c.quality === 'NEEDS_CLARIFICATION');

  if (needsClarificationCandidates.length > 0) {
    needsClarificationList.innerHTML = needsClarificationCandidates.map((candidate, index) => `
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div class="flex items-start">
          <input
            type="checkbox"
            id="candidate-needs-${index}"
            class="mt-1 h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
            onchange="toggleCandidate(${JSON.stringify(candidate).replace(/"/g, '&quot;')}, this.checked)"
          >
          <div class="ml-3 flex-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-yellow-900">${escapeHtml(candidate.sectionTitle)}</span>
              <div class="flex items-center space-x-2">
                <span class="px-2 py-1 text-xs rounded-full ${getQuadrantColor(candidate.quadrant)}">${candidate.quadrant}</span>
                <span class="px-2 py-1 text-xs rounded-full ${getPersistenceColor(candidate.persistence)}">${candidate.persistence}</span>
              </div>
            </div>
            <div class="mt-2 space-y-2">
              <div>
                <p class="text-xs text-gray-600">Original:</p>
                <p class="text-sm text-gray-800">${escapeHtml(candidate.originalText)}</p>
              </div>
              <div>
                <p class="text-xs text-gray-600">Suggested:</p>
                <p class="text-sm font-medium text-yellow-900">${escapeHtml(candidate.suggestedRule.text)}</p>
              </div>
              ${candidate.analysis.issues && candidate.analysis.issues.length > 0 ? `
                <div class="bg-yellow-100 rounded p-2">
                  <p class="text-xs font-medium text-yellow-900 mb-1">Issues:</p>
                  <ul class="list-disc list-inside text-xs text-yellow-800 space-y-1">
                    ${candidate.analysis.issues.map(issue => `<li>${escapeHtml(issue)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  } else {
    needsClarificationList.innerHTML = '<p class="text-sm text-gray-500">No candidates needing clarification.</p>';
  }

  // Display too nebulous candidates
  const tooNebulousList = document.getElementById('too-nebulous-list');
  const tooNebulousCandidates = analysis.candidates.filter(c => c.quality === 'TOO_NEBULOUS');

  if (tooNebulousCandidates.length > 0) {
    tooNebulousList.innerHTML = tooNebulousCandidates.map(candidate => `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-start">
          <svg class="h-5 w-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          <div class="ml-3 flex-1">
            <p class="text-xs font-medium text-red-900 mb-2">${escapeHtml(candidate.sectionTitle)}</p>
            <p class="text-sm text-red-800 mb-2">${escapeHtml(candidate.originalText)}</p>
            ${candidate.improvements && candidate.improvements.length > 0 ? `
              <div class="bg-red-100 rounded p-2">
                <p class="text-xs font-medium text-red-900 mb-1">Suggestions:</p>
                <ul class="list-disc list-inside text-xs text-red-800 space-y-1">
                  ${candidate.improvements.map(imp => `<li>${escapeHtml(imp)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } else {
    tooNebulousList.innerHTML = '<p class="text-sm text-gray-500">No too-nebulous statements.</p>';
  }

  // Display redundancies
  const redundanciesList = document.getElementById('redundancies-list');
  if (analysis.redundancies && analysis.redundancies.length > 0) {
    redundanciesList.innerHTML = analysis.redundancies.map((group, index) => `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p class="text-xs font-medium text-blue-900 mb-2">Redundancy Group ${index + 1}</p>
        <div class="space-y-2">
          ${group.rules.map(rule => `
            <p class="text-sm text-gray-800">• ${escapeHtml(rule)}</p>
          `).join('')}
        </div>
        <div class="mt-3 bg-blue-100 rounded p-2">
          <p class="text-xs font-medium text-blue-900 mb-1">Suggested Merge:</p>
          <p class="text-sm font-medium text-blue-800">${escapeHtml(group.mergeSuggestion)}</p>
        </div>
      </div>
    `).join('');
  } else {
    redundanciesList.innerHTML = '<p class="text-sm text-gray-500">No redundancies detected.</p>';
  }
}

/**
 * Toggle candidate selection
 */
function toggleCandidate(candidate, checked) {
  if (checked) {
    selectedCandidates.push(candidate);
  } else {
    selectedCandidates = selectedCandidates.filter(c => c.originalText !== candidate.originalText);
  }

  // Update button text
  document.getElementById('create-rules-btn').textContent =
    `Create Selected Rules (${selectedCandidates.length})`;
}

/**
 * Create selected rules
 */
async function createSelectedRules() {
  if (selectedCandidates.length === 0) {
    showToast('Please select at least one rule to create', 'error');
    return;
  }

  const createBtn = document.getElementById('create-rules-btn');
  createBtn.disabled = true;
  createBtn.textContent = 'Creating...';

  try {
    const response = await apiRequest('/api/admin/rules/migrate-from-claude-md', {
      method: 'POST',
      body: JSON.stringify({ selectedCandidates })
    });

    if (!response.success) {
      throw new Error(response.message || 'Migration failed');
    }

    displayMigrationResults(response.results);
    goToStep(3);

  } catch (error) {
    console.error('Migration error:', error);
    showToast(error.message || 'Failed to create rules', 'error');
    createBtn.disabled = false;
    createBtn.textContent = `Create Selected Rules (${selectedCandidates.length})`;
  }
}

/**
 * Display migration results
 */
function displayMigrationResults(results) {
  const summaryDiv = document.getElementById('results-summary');

  summaryDiv.innerHTML = `
    <div class="bg-white rounded-lg p-6 shadow-sm border border-gray-200 max-w-md mx-auto">
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <span class="text-gray-700">Total Requested:</span>
          <span class="font-semibold text-gray-900">${results.totalRequested}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-700">Successfully Created:</span>
          <span class="font-semibold text-green-600">${results.created.length}</span>
        </div>
        ${results.failed.length > 0 ? `
          <div class="flex justify-between items-center">
            <span class="text-gray-700">Failed:</span>
            <span class="font-semibold text-red-600">${results.failed.length}</span>
          </div>
        ` : ''}
      </div>

      ${results.created.length > 0 ? `
        <div class="mt-6">
          <p class="text-sm font-medium text-gray-700 mb-2">Created Rules:</p>
          <div class="space-y-2">
            ${results.created.map(rule => `
              <div class="bg-gray-50 rounded p-2 text-xs">
                <span class="font-mono font-medium text-indigo-600">${escapeHtml(rule.id)}</span>
                <p class="text-gray-700 mt-1">${escapeHtml(rule.text.substring(0, 80))}${rule.text.length > 80 ? '...' : ''}</p>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${results.failed.length > 0 ? `
        <div class="mt-6">
          <p class="text-sm font-medium text-red-700 mb-2">Failed Rules:</p>
          <div class="space-y-2">
            ${results.failed.map(fail => `
              <div class="bg-red-50 rounded p-2 text-xs">
                <p class="text-red-700">${escapeHtml(fail.candidate.substring(0, 60))}...</p>
                <p class="text-red-600 mt-1">Error: ${escapeHtml(fail.error)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active', 'border-indigo-600', 'text-indigo-600');
      btn.classList.remove('border-transparent', 'text-gray-500');
    } else {
      btn.classList.remove('active', 'border-indigo-600', 'text-indigo-600');
      btn.classList.add('border-transparent', 'text-gray-500');
    }
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });
  document.getElementById(`${tabName}-tab`).classList.remove('hidden');
}

/**
 * Navigate to a specific step
 */
function goToStep(stepNumber) {
  // Hide all steps
  [1, 2, 3].forEach(num => {
    document.getElementById(`step-${num}-content`).classList.add('hidden');
  });

  // Show target step
  document.getElementById(`step-${stepNumber}-content`).classList.remove('hidden');

  // Update step indicators
  [1, 2, 3].forEach(num => {
    const indicator = document.getElementById(`step-${num}-indicator`);
    const title = document.getElementById(`step-${num}-title`);

    if (num < stepNumber) {
      // Completed step
      indicator.className = 'flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-green-600 text-white font-semibold';
      indicator.innerHTML = '<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';
      title.classList.add('text-gray-900');
      title.classList.remove('text-gray-500');
    } else if (num === stepNumber) {
      // Current step
      indicator.className = 'flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white font-semibold';
      indicator.textContent = num;
      title.classList.add('text-gray-900');
      title.classList.remove('text-gray-500');
    } else {
      // Future step
      indicator.className = 'flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 font-semibold';
      indicator.textContent = num;
      title.classList.remove('text-gray-900');
      title.classList.add('text-gray-500');
    }
  });

  // Reset form if going back to step 1
  if (stepNumber === 1) {
    document.getElementById('claude-md-content').value = '';
    document.getElementById('file-upload').value = '';
    analysisResult = null;
    selectedCandidates = [];
  }
}

/**
 * Logout
 */
function logout() {
  localStorage.removeItem('auth_token');
  window.location.href = '/admin/login.html';
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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
