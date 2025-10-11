/**
 * Audit Analytics Dashboard
 * Displays governance decision analytics from MemoryProxy audit trail
 */

let auditData = [];

// Get auth token from localStorage
function getAuthToken() {
  return localStorage.getItem('admin_token');
}

// Check authentication
function checkAuth() {
  const token = getAuthToken();
  if (!token) {
    window.location.href = '/admin/login.html';
    return false;
  }
  return true;
}

// Load audit data from API
async function loadAuditData() {
  try {
    const token = getAuthToken();
    const response = await fetch('/api/admin/audit-logs', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/admin/login.html';
      return;
    }

    const data = await response.json();

    if (data.success) {
      auditData = data.decisions || [];
      renderDashboard();
    } else {
      showError('Failed to load audit data: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error loading audit data:', error);
    showError('Error loading audit data. Please check console for details.');
  }
}

// Render dashboard
function renderDashboard() {
  updateSummaryCards();
  renderActionChart();
  renderTimelineChart();
  renderAuditTable();
}

// Update summary cards
function updateSummaryCards() {
  const totalDecisions = auditData.length;
  const allowedCount = auditData.filter(d => d.allowed).length;
  const violationsCount = auditData.filter(d => d.violations && d.violations.length > 0).length;
  const servicesSet = new Set(auditData.map(d => d.action));

  document.getElementById('total-decisions').textContent = totalDecisions;
  document.getElementById('allowed-rate').textContent = totalDecisions > 0
    ? `${((allowedCount / totalDecisions) * 100).toFixed(1)}%`
    : '0%';
  document.getElementById('violations-count').textContent = violationsCount;
  document.getElementById('services-count').textContent = servicesSet.size;
}

// Render action type chart
function renderActionChart() {
  const actionCounts = {};

  auditData.forEach(decision => {
    const action = decision.action || 'unknown';
    actionCounts[action] = (actionCounts[action] || 0) + 1;
  });

  const chartEl = document.getElementById('action-chart');

  if (Object.keys(actionCounts).length === 0) {
    chartEl.innerHTML = '<p class="text-gray-500 text-center py-12">No data available</p>';
    return;
  }

  const sorted = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const maxCount = Math.max(...sorted.map(([, count]) => count));

  const html = sorted.map(([action, count]) => {
    const percentage = (count / maxCount) * 100;
    const label = action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return `
      <div class="mb-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm font-medium text-gray-700">${label}</span>
          <span class="text-sm text-gray-600">${count}</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }).join('');

  chartEl.innerHTML = html;
}

// Render timeline chart
function renderTimelineChart() {
  const chartEl = document.getElementById('timeline-chart');

  if (auditData.length === 0) {
    chartEl.innerHTML = '<p class="text-gray-500 text-center py-12">No data available</p>';
    return;
  }

  // Group by hour
  const hourCounts = {};

  auditData.forEach(decision => {
    const date = new Date(decision.timestamp);
    const hour = `${date.getHours()}:00`;
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const sorted = Object.entries(hourCounts).sort((a, b) => {
    const hourA = parseInt(a[0]);
    const hourB = parseInt(b[0]);
    return hourA - hourB;
  });

  const maxCount = Math.max(...sorted.map(([, count]) => count));

  const html = sorted.map(([hour, count]) => {
    const percentage = (count / maxCount) * 100;
    const barHeight = Math.max(percentage, 5);

    return `
      <div class="flex flex-col items-center flex-1">
        <div class="w-full flex items-end justify-center h-48">
          <div class="w-8 bg-purple-600 rounded-t transition-all duration-300 hover:bg-purple-700"
               style="height: ${barHeight}%"
               title="${hour}: ${count} decisions"></div>
        </div>
        <span class="text-xs text-gray-600 mt-2">${hour}</span>
      </div>
    `;
  }).join('');

  chartEl.innerHTML = `<div class="flex items-end gap-2 h-full">${html}</div>`;
}

// Render audit table
function renderAuditTable() {
  const tbody = document.getElementById('audit-log-tbody');

  if (auditData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No audit data available</td></tr>';
    return;
  }

  const recent = auditData.slice(0, 50);

  const html = recent.map(decision => {
    const timestamp = new Date(decision.timestamp).toLocaleString();
    const action = decision.action || 'Unknown';
    const sessionId = decision.sessionId || 'N/A';
    const allowed = decision.allowed;
    const violations = decision.violations || [];

    const statusClass = allowed ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
    const statusText = allowed ? 'Allowed' : 'Blocked';

    const violationsText = violations.length > 0
      ? violations.join(', ')
      : 'None';

    return `
      <tr class="log-entry cursor-pointer" onclick="showDecisionDetails('${decision.timestamp}')">
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${timestamp}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${action}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${sessionId.substring(0, 20)}...</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${statusText}</span>
        </td>
        <td class="px-6 py-4 text-sm text-gray-600">${violationsText.substring(0, 40)}${violationsText.length > 40 ? '...' : ''}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
          <button class="text-blue-600 hover:text-blue-800 font-medium">View</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
}

// Show decision details
function showDecisionDetails(timestamp) {
  const decision = auditData.find(d => d.timestamp === timestamp);
  if (!decision) return;

  alert(`Decision Details:\n\n${JSON.stringify(decision, null, 2)}`);
}

// Show error
function showError(message) {
  const tbody = document.getElementById('audit-log-tbody');
  tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-600">${message}</td></tr>`;
}

// Initialize
function init() {
  if (!checkAuth()) return;

  // Setup refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadAuditData();
    });
  }

  // Load initial data
  loadAuditData();
}

// Run initialization
init();
