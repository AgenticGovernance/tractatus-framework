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

// Navigation
const navLinks = document.querySelectorAll('.nav-link');
const sections = {
  'overview': document.getElementById('overview-section'),
  'moderation': document.getElementById('moderation-section'),
  'users': document.getElementById('users-section'),
  'documents': document.getElementById('documents-section')
};

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');

    // Only handle hash-based navigation (internal sections)
    // Let full URLs navigate normally
    if (!href || !href.startsWith('#')) {
      return; // Allow default navigation
    }

    e.preventDefault();
    const section = href.substring(1);

    // Update active link
    navLinks.forEach(l => l.classList.remove('active', 'bg-blue-100', 'text-blue-700'));
    link.classList.add('active', 'bg-blue-100', 'text-blue-700');

    // Show section
    Object.values(sections).forEach(s => s.classList.add('hidden'));
    if (sections[section]) {
      sections[section].classList.remove('hidden');
      loadSection(section);
    }
  });
});

// API helper
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

// Load statistics
async function loadStatistics() {
  try {
    const response = await apiRequest('/api/admin/stats');

    if (!response.success || !response.stats) {
      console.error('Invalid stats response:', response);
      return;
    }

    const stats = response.stats;

    document.getElementById('stat-documents').textContent = stats.documents?.total || 0;
    document.getElementById('stat-pending').textContent = stats.moderation?.total_pending || 0;
    document.getElementById('stat-approved').textContent = stats.blog?.published || 0;
    document.getElementById('stat-users').textContent = stats.users?.total || 0;
  } catch (error) {
    console.error('Failed to load statistics:', error);
  }
}

// Load recent activity
async function loadRecentActivity() {
  const container = document.getElementById('recent-activity');

  try {
    const response = await apiRequest('/api/admin/activity');

    if (!response.success || !response.activity || response.activity.length === 0) {
      container.innerHTML = '<div class="text-center py-8 text-gray-500">No recent activity</div>';
      return;
    }

    container.innerHTML = response.activity.map(item => {
      // Generate description from activity data
      const action = item.action || 'reviewed';
      const itemType = item.item_type || 'item';
      const description = `${action.charAt(0).toUpperCase() + action.slice(1)} ${itemType}`;

      return `
        <div class="py-4 flex items-start">
          <div class="flex-shrink-0">
            <div class="h-8 w-8 rounded-full ${getActivityColor(action)} flex items-center justify-center">
              <span class="text-xs font-medium text-white">${getActivityIcon(action)}</span>
            </div>
          </div>
          <div class="ml-4 flex-1">
            <p class="text-sm font-medium text-gray-900">${description}</p>
            <p class="text-sm text-gray-500">${formatDate(item.timestamp)}</p>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Failed to load activity:', error);
    container.innerHTML = '<div class="text-center py-8 text-red-500">Failed to load activity</div>';
  }
}

// Load moderation queue
async function loadModerationQueue(filter = 'all') {
  const container = document.getElementById('moderation-queue');

  try {
    const response = await apiRequest(`/api/admin/moderation?type=${filter}`);

    if (!response.success || !response.items || response.items.length === 0) {
      container.innerHTML = '<div class="px-6 py-8 text-center text-gray-500">No items pending review</div>';
      return;
    }

    container.innerHTML = response.items.map(item => `
      <div class="px-6 py-4" data-id="${item._id}">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                ${item.type}
              </span>
              <span class="ml-2 text-sm text-gray-500">${formatDate(item.submitted_at)}</span>
            </div>
            <h4 class="mt-2 text-sm font-medium text-gray-900">${item.title}</h4>
            <p class="mt-1 text-sm text-gray-600">${truncate(item.content || item.description, 150)}</p>
          </div>
          <div class="ml-4 flex-shrink-0 flex space-x-2">
            <button onclick="approveItem('${item._id}')" class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
              Approve
            </button>
            <button onclick="rejectItem('${item._id}')" class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
              Reject
            </button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load moderation queue:', error);
    container.innerHTML = '<div class="px-6 py-8 text-center text-red-500">Failed to load queue</div>';
  }
}

// Load users
async function loadUsers() {
  const container = document.getElementById('users-list');

  try {
    const response = await apiRequest('/api/admin/users');

    if (!response.success || !response.users || response.users.length === 0) {
      container.innerHTML = '<div class="px-6 py-8 text-center text-gray-500">No users found</div>';
      return;
    }

    container.innerHTML = response.users.map(user => `
      <div class="px-6 py-4 flex items-center justify-between">
        <div class="flex items-center">
          <div class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
            <span class="text-sm font-medium text-gray-600">${user.email.charAt(0).toUpperCase()}</span>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-900">${user.email}</p>
            <p class="text-sm text-gray-500">Role: ${user.role}</p>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}">
            ${user.role}
          </span>
          ${user._id !== user._id ? `
            <button onclick="deleteUser('${user._id}')" class="text-red-600 hover:text-red-900 text-sm">
              Delete
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load users:', error);
    container.innerHTML = '<div class="px-6 py-8 text-center text-red-500">Failed to load users</div>';
  }
}

// Load documents
async function loadDocuments() {
  const container = document.getElementById('documents-list');

  try {
    const response = await apiRequest('/api/documents');

    if (!response.success || !response.documents || response.documents.length === 0) {
      container.innerHTML = '<div class="px-6 py-8 text-center text-gray-500">No documents found</div>';
      return;
    }

    container.innerHTML = response.documents.map(doc => `
      <div class="px-6 py-4 flex items-center justify-between">
        <div class="flex-1">
          <h4 class="text-sm font-medium text-gray-900">${doc.title}</h4>
          <p class="text-sm text-gray-500">${doc.quadrant || 'No quadrant'} • ${formatDate(doc.created_at)}</p>
        </div>
        <div class="flex items-center space-x-2">
          <a href="/docs-viewer.html#${doc.slug}" target="_blank" class="text-blue-600 hover:text-blue-900 text-sm">
            View
          </a>
          <button onclick="deleteDocument('${doc._id}')" class="text-red-600 hover:text-red-900 text-sm">
            Delete
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load documents:', error);
    container.innerHTML = '<div class="px-6 py-8 text-center text-red-500">Failed to load documents</div>';
  }
}

// Load section data
function loadSection(section) {
  switch (section) {
    case 'overview':
      loadStatistics();
      loadRecentActivity();
      break;
    case 'moderation':
      loadModerationQueue();
      break;
    case 'users':
      loadUsers();
      break;
    case 'documents':
      loadDocuments();
      break;
  }
}

// Approve item
async function approveItem(itemId) {
  if (!confirm('Approve this item?')) return;

  try {
    const response = await apiRequest(`/api/admin/moderation/${itemId}/approve`, {
      method: 'POST'
    });

    if (response.success) {
      loadModerationQueue();
      loadStatistics();
    } else {
      alert('Failed to approve item');
    }
  } catch (error) {
    console.error('Approval error:', error);
    alert('Failed to approve item');
  }
}

// Reject item
async function rejectItem(itemId) {
  if (!confirm('Reject this item?')) return;

  try {
    const response = await apiRequest(`/api/admin/moderation/${itemId}/reject`, {
      method: 'POST'
    });

    if (response.success) {
      loadModerationQueue();
      loadStatistics();
    } else {
      alert('Failed to reject item');
    }
  } catch (error) {
    console.error('Rejection error:', error);
    alert('Failed to reject item');
  }
}

// Delete user
async function deleteUser(userId) {
  if (!confirm('Delete this user? This action cannot be undone.')) return;

  try {
    const response = await apiRequest(`/api/admin/users/${userId}`, {
      method: 'DELETE'
    });

    if (response.success) {
      loadUsers();
      loadStatistics();
    } else {
      alert(response.message || 'Failed to delete user');
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('Failed to delete user');
  }
}

// Delete document
async function deleteDocument(docId) {
  if (!confirm('Delete this document? This action cannot be undone.')) return;

  try {
    const response = await apiRequest(`/api/documents/${docId}`, {
      method: 'DELETE'
    });

    if (response.success) {
      loadDocuments();
      loadStatistics();
    } else {
      alert('Failed to delete document');
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('Failed to delete document');
  }
}

// Utility functions
function getActivityColor(type) {
  const colors = {
    'create': 'bg-green-500',
    'update': 'bg-blue-500',
    'delete': 'bg-red-500',
    'approve': 'bg-purple-500'
  };
  return colors[type] || 'bg-gray-500';
}

function getActivityIcon(type) {
  const icons = {
    'create': '+',
    'update': '↻',
    'delete': '×',
    'approve': '✓'
  };
  return icons[type] || '•';
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

// Queue filter
document.getElementById('queue-filter')?.addEventListener('change', (e) => {
  loadModerationQueue(e.target.value);
});

// Initialize
loadStatistics();
loadRecentActivity();

// Make functions global for onclick handlers
window.approveItem = approveItem;
window.rejectItem = rejectItem;
window.deleteUser = deleteUser;
window.deleteDocument = deleteDocument;
