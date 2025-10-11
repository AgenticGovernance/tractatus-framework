/**
 * Media Triage Admin UI
 * AI-powered media inquiry triage with human oversight
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
let inquiries = [];
let currentInquiry = null;
let filters = {
  status: 'new',
  urgency: '',
  values: '',
  sortBy: 'received_at'
};

/**
 * Load and display dashboard statistics
 */
async function loadStatistics() {
  try {
    const response = await apiRequest('/api/media/inquiries');

    if (!response.success) {
      console.error('Invalid stats response:', response);
      return;
    }

    const allInquiries = response.inquiries || [];

    // Calculate statistics
    const newInquiries = allInquiries.filter(i => !i.ai_triage);
    const triaged = allInquiries.filter(i => i.ai_triage && i.status === 'pending');
    const responded = allInquiries.filter(i => i.status === 'responded');
    const valuesInvolved = allInquiries.filter(i => i.ai_triage?.involves_values);

    document.getElementById('stat-total').textContent = allInquiries.length;
    document.getElementById('stat-new').textContent = newInquiries.length;
    document.getElementById('stat-triaged').textContent = triaged.length;
    document.getElementById('stat-values').textContent = valuesInvolved.length;
    document.getElementById('stat-responded').textContent = responded.length;

  } catch (error) {
    console.error('Failed to load statistics:', error);
    showToast('Failed to load statistics', 'error');
  }
}

/**
 * Load and render inquiries based on current filters
 */
async function loadInquiries() {
  const container = document.getElementById('inquiries-container');

  try {
    // Show loading state
    container.innerHTML = `
      <div class="bg-white rounded-lg shadow p-12 text-center text-gray-500">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
        <p>Loading media inquiries...</p>
      </div>
    `;

    const response = await apiRequest('/api/media/inquiries');

    if (!response.success) {
      throw new Error('Failed to load inquiries');
    }

    inquiries = response.inquiries || [];

    // Apply filters
    let filtered = inquiries.filter(inquiry => {
      // Status filter
      if (filters.status === 'new' && inquiry.ai_triage) return false;
      if (filters.status === 'triaged' && (!inquiry.ai_triage || inquiry.status === 'responded')) return false;
      if (filters.status === 'responded' && inquiry.status !== 'responded') return false;

      // Urgency filter
      if (filters.urgency && inquiry.ai_triage?.urgency !== filters.urgency) return false;

      // Values filter
      if (filters.values === 'true' && !inquiry.ai_triage?.involves_values) return false;
      if (filters.values === 'false' && inquiry.ai_triage?.involves_values) return false;

      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'received_at':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'urgency_score':
          const scoreA = a.ai_triage?.urgency_score || 0;
          const scoreB = b.ai_triage?.urgency_score || 0;
          return scoreB - scoreA;
        case 'deadline':
          if (!a.inquiry.deadline && !b.inquiry.deadline) return 0;
          if (!a.inquiry.deadline) return 1;
          if (!b.inquiry.deadline) return -1;
          return new Date(a.inquiry.deadline) - new Date(b.inquiry.deadline);
        default:
          return 0;
      }
    });

    // Update results count
    document.getElementById('filter-results').textContent =
      `Showing ${filtered.length} inquir${filtered.length !== 1 ? 'ies' : 'y'}`;

    // Render inquiries
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No inquiries found</h3>
          <p class="mt-1 text-sm text-gray-500">Try adjusting your filters.</p>
        </div>
      `;
      return;
    }

    // Render inquiry cards
    container.innerHTML = filtered.map(inquiry => renderInquiryCard(inquiry)).join('');

  } catch (error) {
    console.error('Failed to load inquiries:', error);
    container.innerHTML = `
      <div class="bg-white rounded-lg shadow p-12 text-center text-red-500">
        <p>Failed to load inquiries. Please try again.</p>
      </div>
    `;
    showToast('Failed to load inquiries', 'error');
  }
}

/**
 * Render a single inquiry as an HTML card
 */
function renderInquiryCard(inquiry) {
  const receivedDate = new Date(inquiry.created_at).toLocaleDateString();
  const receivedTime = new Date(inquiry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Status badge
  let statusBadge = '';
  if (!inquiry.ai_triage) {
    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">New</span>';
  } else if (inquiry.status === 'responded') {
    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Responded</span>';
  } else {
    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">Triaged</span>';
  }

  // Urgency badge
  let urgencyBadge = '';
  if (inquiry.ai_triage?.urgency) {
    const urgencyColors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    const urgencyColor = urgencyColors[inquiry.ai_triage.urgency] || 'bg-gray-100 text-gray-800';
    urgencyBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${urgencyColor}">
      Urgency: ${inquiry.ai_triage.urgency.toUpperCase()}
    </span>`;
  }

  // Values warning badge
  let valuesBadge = '';
  if (inquiry.ai_triage?.involves_values) {
    valuesBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      <svg class="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      Values-Sensitive
    </span>`;
  }

  // Border color for values-sensitive inquiries
  const borderClass = inquiry.ai_triage?.involves_values
    ? 'border-red-300 border-2'
    : 'border-gray-200';

  return `
    <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border ${borderClass} mb-4">
      <div class="p-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-3">
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-1">${escapeHtml(inquiry.inquiry.subject)}</h3>
            <p class="text-sm text-gray-600">
              From: <span class="font-medium">${escapeHtml(inquiry.contact.name)}</span>
              (${escapeHtml(inquiry.contact.outlet)})
            </p>
            <p class="text-xs text-gray-500 mt-1">
              Received: ${receivedDate} at ${receivedTime}
            </p>
          </div>
          <div class="flex flex-col items-end space-y-1">
            ${statusBadge}
            ${urgencyBadge}
            ${valuesBadge}
          </div>
        </div>

        <!-- Message Preview -->
        <div class="mb-4">
          <p class="text-sm text-gray-700 line-clamp-2">${escapeHtml(inquiry.inquiry.message)}</p>
        </div>

        <!-- AI Triage Summary (if available) -->
        ${inquiry.ai_triage ? `
          <div class="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p class="text-xs font-medium text-gray-700 mb-2">AI Triage Analysis</p>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-gray-500">Urgency Score:</span>
                <span class="font-medium ml-1">${inquiry.ai_triage.urgency_score}/100</span>
              </div>
              <div>
                <span class="text-gray-500">Sensitivity:</span>
                <span class="font-medium ml-1">${inquiry.ai_triage.topic_sensitivity}</span>
              </div>
              <div class="col-span-2">
                <span class="text-gray-500">Response Time:</span>
                <span class="font-medium ml-1">${inquiry.ai_triage.suggested_response_time} hours</span>
              </div>
            </div>
            ${inquiry.ai_triage.involves_values ? `
              <div class="mt-2 pt-2 border-t border-gray-300">
                <p class="text-xs text-red-700 font-medium">⚠️ BoundaryEnforcer: ${escapeHtml(inquiry.ai_triage.boundary_enforcement)}</p>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Action Buttons -->
        <div class="flex space-x-2">
          <button
            class="view-details-btn flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            data-inquiry-id="${inquiry._id}">
            View Full Details
          </button>
          ${!inquiry.ai_triage ? `
            <button
              class="run-triage-btn flex-1 px-4 py-2 border border-indigo-300 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              data-inquiry-id="${inquiry._id}">
              Run AI Triage
            </button>
          ` : inquiry.status !== 'responded' ? `
            <button
              class="respond-btn flex-1 px-4 py-2 border border-green-300 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              data-inquiry-id="${inquiry._id}">
              Respond to Inquiry
            </button>
          ` : `
            <button
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-500 bg-gray-100 cursor-not-allowed"
              disabled>
              Already Responded
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

/**
 * Show inquiry details modal
 */
async function showInquiryDetails(inquiryId) {
  try {
    const response = await apiRequest(`/api/media/inquiries/${inquiryId}`);

    if (!response.success) {
      throw new Error('Failed to load inquiry details');
    }

    currentInquiry = response.inquiry;
    const modal = document.getElementById('details-modal');
    const content = document.getElementById('details-modal-content');

    // Build detailed view
    let html = `
      <!-- Contact Information -->
      <div class="mb-6">
        <h4 class="text-sm font-semibold text-gray-900 mb-3">Contact Information</h4>
        <div class="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <div><span class="text-gray-600">Name:</span> <span class="font-medium">${escapeHtml(currentInquiry.contact.name)}</span></div>
          <div><span class="text-gray-600">Email:</span> <span class="font-medium">${escapeHtml(currentInquiry.contact.email)}</span></div>
          <div><span class="text-gray-600">Outlet:</span> <span class="font-medium">${escapeHtml(currentInquiry.contact.outlet)}</span></div>
          ${currentInquiry.contact.phone ? `<div><span class="text-gray-600">Phone:</span> <span class="font-medium">${escapeHtml(currentInquiry.contact.phone)}</span></div>` : ''}
        </div>
      </div>

      <!-- Inquiry Details -->
      <div class="mb-6">
        <h4 class="text-sm font-semibold text-gray-900 mb-3">Inquiry Details</h4>
        <div class="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
          <div>
            <span class="text-gray-600 font-medium">Subject:</span>
            <p class="mt-1">${escapeHtml(currentInquiry.inquiry.subject)}</p>
          </div>
          <div>
            <span class="text-gray-600 font-medium">Message:</span>
            <p class="mt-1 whitespace-pre-wrap">${escapeHtml(currentInquiry.inquiry.message)}</p>
          </div>
          ${currentInquiry.inquiry.deadline ? `
            <div>
              <span class="text-gray-600 font-medium">Deadline:</span>
              <p class="mt-1">${new Date(currentInquiry.inquiry.deadline).toLocaleString()}</p>
            </div>
          ` : ''}
          ${currentInquiry.inquiry.topic_areas?.length ? `
            <div>
              <span class="text-gray-600 font-medium">Topic Areas:</span>
              <p class="mt-1">${currentInquiry.inquiry.topic_areas.map(t => escapeHtml(t)).join(', ')}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // AI Triage Results (if available)
    if (currentInquiry.ai_triage) {
      html += `
        <!-- AI Triage Analysis -->
        <div class="mb-6">
          <h4 class="text-sm font-semibold text-gray-900 mb-3">AI Triage Analysis</h4>

          <!-- Urgency Analysis -->
          <div class="bg-blue-50 rounded-lg p-4 mb-3">
            <p class="text-sm font-medium text-blue-900 mb-2">
              Urgency: ${currentInquiry.ai_triage.urgency.toUpperCase()} (Score: ${currentInquiry.ai_triage.urgency_score}/100)
            </p>
            <p class="text-sm text-blue-800">${escapeHtml(currentInquiry.ai_triage.urgency_reasoning)}</p>
          </div>

          <!-- Sensitivity Analysis -->
          <div class="bg-purple-50 rounded-lg p-4 mb-3">
            <p class="text-sm font-medium text-purple-900 mb-2">
              Topic Sensitivity: ${currentInquiry.ai_triage.topic_sensitivity.toUpperCase()}
            </p>
            <p class="text-sm text-purple-800">${escapeHtml(currentInquiry.ai_triage.sensitivity_reasoning)}</p>
          </div>

          <!-- Values Check (BoundaryEnforcer) -->
          <div class="bg-${currentInquiry.ai_triage.involves_values ? 'red' : 'green'}-50 rounded-lg p-4 mb-3">
            <p class="text-sm font-medium text-${currentInquiry.ai_triage.involves_values ? 'red' : 'green'}-900 mb-2">
              ${currentInquiry.ai_triage.involves_values ? '⚠️ ' : '✓ '}Values Involvement: ${currentInquiry.ai_triage.involves_values ? 'YES' : 'NO'}
            </p>
            <p class="text-sm text-${currentInquiry.ai_triage.involves_values ? 'red' : 'green'}-800 mb-2">${escapeHtml(currentInquiry.ai_triage.values_reasoning)}</p>
            <p class="text-xs text-${currentInquiry.ai_triage.involves_values ? 'red' : 'green'}-700 font-medium">${escapeHtml(currentInquiry.ai_triage.boundary_enforcement)}</p>
          </div>

          <!-- Talking Points -->
          ${currentInquiry.ai_triage.suggested_talking_points?.length ? `
            <div class="bg-gray-50 rounded-lg p-4 mb-3">
              <p class="text-sm font-medium text-gray-900 mb-2">Suggested Talking Points:</p>
              <ul class="list-disc list-inside space-y-1 text-sm text-gray-700">
                ${currentInquiry.ai_triage.suggested_talking_points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- Draft Response -->
          ${currentInquiry.ai_triage.draft_response ? `
            <div class="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <p class="text-sm font-medium text-yellow-900 mb-2">AI-Generated Draft Response (Human Review Required):</p>
              <p class="text-sm text-yellow-800 whitespace-pre-wrap mb-2">${escapeHtml(currentInquiry.ai_triage.draft_response)}</p>
              <p class="text-xs text-yellow-700 italic">${escapeHtml(currentInquiry.ai_triage.draft_response_reasoning)}</p>
            </div>
          ` : ''}

          <!-- Framework Compliance -->
          <div class="mt-4 pt-4 border-t border-gray-200">
            <p class="text-xs text-gray-600">
              <strong>Framework Compliance:</strong>
              BoundaryEnforcer: ${currentInquiry.ai_triage.framework_compliance?.boundary_enforcer_checked ? '✓' : '✗'} |
              Human Approval Required: ${currentInquiry.ai_triage.framework_compliance?.human_approval_required ? '✓' : '✗'} |
              Reasoning Transparent: ${currentInquiry.ai_triage.framework_compliance?.reasoning_transparent ? '✓' : '✗'}
            </p>
            <p class="text-xs text-gray-500 mt-1">
              AI Model: ${currentInquiry.ai_triage.ai_model} |
              Triaged: ${new Date(currentInquiry.ai_triage.triaged_at).toLocaleString()}
            </p>
          </div>
        </div>
      `;
    }

    content.innerHTML = html;

    // Update modal buttons visibility
    const triageBtn = document.getElementById('details-modal-triage-btn');
    const respondBtn = document.getElementById('details-modal-respond-btn');

    if (!currentInquiry.ai_triage) {
      triageBtn.classList.remove('hidden');
      respondBtn.classList.add('hidden');
    } else if (currentInquiry.status !== 'responded') {
      triageBtn.classList.add('hidden');
      respondBtn.classList.remove('hidden');
    } else {
      triageBtn.classList.add('hidden');
      respondBtn.classList.add('hidden');
    }

    modal.classList.remove('hidden');

  } catch (error) {
    console.error('Failed to load inquiry details:', error);
    showToast('Failed to load inquiry details', 'error');
  }
}

/**
 * Run AI triage on inquiry
 */
async function runTriage(inquiryId) {
  try {
    showToast('Running AI triage analysis...', 'info');

    const response = await apiRequest(`/api/media/inquiries/${inquiryId}/triage`, {
      method: 'POST'
    });

    if (response.success) {
      showToast('AI triage completed successfully', 'success');
      await loadInquiries();
      await loadStatistics();

      // Refresh details modal if open
      if (currentInquiry && currentInquiry._id === inquiryId) {
        await showInquiryDetails(inquiryId);
      }
    } else {
      showToast(response.message || 'Failed to run triage', 'error');
    }
  } catch (error) {
    console.error('Triage error:', error);
    showToast('Failed to run AI triage', 'error');
  }
}

/**
 * Show response modal
 */
function showResponseModal(inquiryId) {
  if (!currentInquiry || currentInquiry._id !== inquiryId) {
    // Load inquiry first
    showInquiryDetails(inquiryId).then(() => {
      openResponseModal();
    });
  } else {
    openResponseModal();
  }
}

function openResponseModal() {
  const modal = document.getElementById('response-modal');
  const contactInfo = document.getElementById('response-contact-info');
  const aiDraftSection = document.getElementById('ai-draft-section');
  const aiDraftContent = document.getElementById('ai-draft-content');
  const valuesWarning = document.getElementById('values-warning');
  const valuesWarningText = document.getElementById('values-warning-text');
  const responseContent = document.getElementById('response-content');

  // Populate contact info
  contactInfo.innerHTML = `
    <p class="text-sm">
      <strong>To:</strong> ${escapeHtml(currentInquiry.contact.name)} (${escapeHtml(currentInquiry.contact.email)})<br>
      <strong>Outlet:</strong> ${escapeHtml(currentInquiry.contact.outlet)}<br>
      <strong>Subject:</strong> ${escapeHtml(currentInquiry.inquiry.subject)}
    </p>
  `;

  // Show AI draft if available
  if (currentInquiry.ai_triage?.draft_response) {
    aiDraftSection.classList.remove('hidden');
    aiDraftContent.textContent = currentInquiry.ai_triage.draft_response;
  } else {
    aiDraftSection.classList.add('hidden');
  }

  // Show values warning if applicable
  if (currentInquiry.ai_triage?.involves_values) {
    valuesWarning.classList.remove('hidden');
    valuesWarningText.textContent = currentInquiry.ai_triage.values_reasoning;
  } else {
    valuesWarning.classList.add('hidden');
  }

  // Clear response content
  responseContent.value = '';

  modal.classList.remove('hidden');

  // Close details modal if open
  document.getElementById('details-modal').classList.add('hidden');
}

/**
 * Send response to inquiry
 */
async function sendResponse() {
  const responseContent = document.getElementById('response-content').value.trim();

  if (!responseContent) {
    showToast('Please enter a response', 'warning');
    return;
  }

  if (!currentInquiry) {
    showToast('No inquiry selected', 'error');
    return;
  }

  try {
    showToast('Sending response...', 'info');

    const response = await apiRequest(`/api/media/inquiries/${currentInquiry._id}/respond`, {
      method: 'POST',
      body: JSON.stringify({
        content: responseContent
      })
    });

    if (response.success) {
      showToast('Response sent successfully', 'success');
      document.getElementById('response-modal').classList.add('hidden');
      await loadInquiries();
      await loadStatistics();
    } else {
      showToast(response.message || 'Failed to send response', 'error');
    }
  } catch (error) {
    console.error('Send response error:', error);
    showToast('Failed to send response', 'error');
  }
}

// Event listeners for modals
document.getElementById('close-details-modal').addEventListener('click', () => {
  document.getElementById('details-modal').classList.add('hidden');
});

document.getElementById('details-modal-close-btn').addEventListener('click', () => {
  document.getElementById('details-modal').classList.add('hidden');
});

document.getElementById('details-modal-triage-btn').addEventListener('click', () => {
  if (currentInquiry) {
    runTriage(currentInquiry._id);
  }
});

document.getElementById('details-modal-respond-btn').addEventListener('click', () => {
  if (currentInquiry) {
    openResponseModal();
  }
});

document.getElementById('close-response-modal').addEventListener('click', () => {
  document.getElementById('response-modal').classList.add('hidden');
});

document.getElementById('response-modal-cancel-btn').addEventListener('click', () => {
  document.getElementById('response-modal').classList.add('hidden');
});

document.getElementById('send-response-btn').addEventListener('click', () => {
  sendResponse();
});

document.getElementById('use-draft-btn').addEventListener('click', () => {
  const draft = document.getElementById('ai-draft-content').textContent;
  document.getElementById('response-content').value = draft;
  showToast('Draft copied to response editor', 'success');
});

// Filter handlers
document.getElementById('filter-status').addEventListener('change', (e) => {
  filters.status = e.target.value;
  loadInquiries();
});

document.getElementById('filter-urgency').addEventListener('change', (e) => {
  filters.urgency = e.target.value;
  loadInquiries();
});

document.getElementById('filter-values').addEventListener('change', (e) => {
  filters.values = e.target.value;
  loadInquiries();
});

document.getElementById('sort-by').addEventListener('change', (e) => {
  filters.sortBy = e.target.value;
  loadInquiries();
});

document.getElementById('clear-filters-btn').addEventListener('click', () => {
  filters = {
    status: 'new',
    urgency: '',
    values: '',
    sortBy: 'received_at'
  };

  document.getElementById('filter-status').value = 'new';
  document.getElementById('filter-urgency').value = '';
  document.getElementById('filter-values').value = '';
  document.getElementById('sort-by').value = 'received_at';

  loadInquiries();
});

// Delegate click events for dynamically created buttons
document.getElementById('inquiries-container').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const inquiryId = btn.dataset.inquiryId;
  if (!inquiryId) return;

  if (btn.classList.contains('view-details-btn')) {
    showInquiryDetails(inquiryId);
  } else if (btn.classList.contains('run-triage-btn')) {
    runTriage(inquiryId);
  } else if (btn.classList.contains('respond-btn')) {
    showResponseModal(inquiryId);
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

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.className = 'ml-4 text-white hover:text-gray-200';
  closeBtn.addEventListener('click', () => toast.remove());

  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;

  toast.appendChild(messageSpan);
  toast.appendChild(closeBtn);
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
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on page load
loadStatistics();
loadInquiries();
