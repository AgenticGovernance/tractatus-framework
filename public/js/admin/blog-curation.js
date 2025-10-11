/**
 * Blog Curation Admin UI
 * Tractatus Framework - AI-assisted content generation with human oversight
 */

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

// API call helper
async function apiCall(endpoint, options = {}) {
  const token = getAuthToken();
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  const response = await fetch(endpoint, { ...defaultOptions, ...options });

  if (response.status === 401) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/admin/login.html';
    throw new Error('Unauthorized');
  }

  return response;
}

// Navigation
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = {
    'draft': document.getElementById('draft-section'),
    'queue': document.getElementById('queue-section'),
    'guidelines': document.getElementById('guidelines-section')
  };

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('href').substring(1);

      // Update active link
      navLinks.forEach(l => l.classList.remove('active', 'bg-gray-100', 'text-blue-600'));
      link.classList.add('active', 'bg-gray-100', 'text-blue-600');

      // Show target section
      Object.values(sections).forEach(section => section.classList.add('hidden'));
      if (sections[target]) {
        sections[target].classList.remove('hidden');

        // Load data for specific sections
        if (target === 'queue') {
          loadDraftQueue();
        } else if (target === 'guidelines') {
          loadEditorialGuidelines();
        }
      }
    });
  });

  // Set first link as active
  navLinks[0].classList.add('active', 'bg-gray-100', 'text-blue-600');
}

// Load statistics
async function loadStatistics() {
  // Load pending drafts
  try {
    const queueResponse = await apiCall('/api/admin/moderation?type=BLOG_POST_DRAFT');
    if (queueResponse.ok) {
      const queueData = await queueResponse.json();
      document.getElementById('stat-pending-drafts').textContent = queueData.items?.length || 0;
    }
  } catch (error) {
    console.error('Failed to load pending drafts stat:', error);
    document.getElementById('stat-pending-drafts').textContent = '-';
  }

  // Load published posts
  try {
    const postsResponse = await apiCall('/api/blog/admin/posts?status=published&limit=1000');
    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      document.getElementById('stat-published-posts').textContent = postsData.pagination?.total || 0;
    }
  } catch (error) {
    console.error('Failed to load published posts stat:', error);
    document.getElementById('stat-published-posts').textContent = '-';
  }
}

// Draft form submission
function initDraftForm() {
  const form = document.getElementById('draft-form');
  const btn = document.getElementById('draft-btn');
  const status = document.getElementById('draft-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = {
      topic: formData.get('topic'),
      audience: formData.get('audience'),
      length: formData.get('length') || 'medium',
      focus: formData.get('focus') || undefined
    };

    // UI feedback
    btn.disabled = true;
    btn.textContent = 'Generating...';
    status.textContent = 'Calling Claude API...';
    status.className = 'text-sm text-blue-600';

    try {
      const response = await apiCall('/api/blog/draft-post', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        // Success - show draft in modal
        status.textContent = '✓ Draft generated! Opening preview...';
        status.className = 'text-sm text-green-600';

        setTimeout(() => {
          showDraftModal(result);
          form.reset();
          status.textContent = '';
        }, 1000);
      } else {
        // Error
        status.textContent = `✗ Error: ${result.message}`;
        status.className = 'text-sm text-red-600';
      }
    } catch (error) {
      status.textContent = `✗ Error: ${error.message}`;
      status.className = 'text-sm text-red-600';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Draft';
    }
  });
}

// Show draft modal
function showDraftModal(result) {
  const { draft, validation, governance, queue_id } = result;

  const violationsHtml = validation.violations.length > 0
    ? `<div class="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
        <h4 class="font-medium text-red-900 mb-2">⚠️ Tractatus Violations Detected</h4>
        ${validation.violations.map(v => `
          <div class="text-sm text-red-800 mb-2">
            <strong>${v.type}:</strong> ${v.message}
            <div class="text-xs mt-1">Instruction: ${v.instruction}</div>
          </div>
        `).join('')}
      </div>`
    : '';

  const warningsHtml = validation.warnings.length > 0
    ? `<div class="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
        <h4 class="font-medium text-yellow-900 mb-2">⚠ Warnings</h4>
        ${validation.warnings.map(w => `
          <div class="text-sm text-yellow-800 mb-1">${w.message}</div>
        `).join('')}
      </div>`
    : '';

  const modal = `
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 class="text-lg font-medium text-gray-900">Blog Draft Preview</h3>
          <button class="close-modal text-gray-400 hover:text-gray-600">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          ${violationsHtml}
          ${warningsHtml}

          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-500">Title</h4>
            <p class="text-xl font-bold text-gray-900">${draft.title || 'Untitled'}</p>
          </div>

          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-500">Subtitle</h4>
            <p class="text-gray-700">${draft.subtitle || 'No subtitle'}</p>
          </div>

          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-500">Excerpt</h4>
            <p class="text-sm text-gray-600">${draft.excerpt || 'No excerpt'}</p>
          </div>

          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-500 mb-2">Content Preview</h4>
            <div class="prose prose-sm max-w-none bg-gray-50 p-4 rounded-md">
              ${draft.content ? marked(draft.content.substring(0, 1000)) + '...' : 'No content'}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h4 class="text-sm font-medium text-gray-500">Tags</h4>
              <div class="flex flex-wrap gap-2 mt-1">
                ${(draft.tags || []).map(tag => `
                  <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">${tag}</span>
                `).join('')}
              </div>
            </div>
            <div>
              <h4 class="text-sm font-medium text-gray-500">Word Count</h4>
              <p class="text-gray-900">${draft.word_count || 'Unknown'}</p>
            </div>
          </div>

          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-500">Tractatus Angle</h4>
            <p class="text-sm text-gray-700">${draft.tractatus_angle || 'Not specified'}</p>
          </div>

          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-500">Sources</h4>
            <ul class="text-sm text-gray-700 list-disc list-inside">
              ${(draft.sources || ['No sources provided']).map(source => `<li>${source}</li>`).join('')}
            </ul>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 class="text-sm font-medium text-blue-900 mb-2">🤖 Governance Notice</h4>
            <p class="text-xs text-blue-800">
              <strong>Policy:</strong> ${governance.policy}<br>
              <strong>Validation:</strong> ${validation.recommendation}<br>
              <strong>Queue ID:</strong> ${queue_id}<br>
              This draft has been queued for human review and approval before publication.
            </p>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button class="close-modal px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
            Close
          </button>
          <button class="view-queue px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            View in Queue →
          </button>
        </div>
      </div>
    </div>
  `;

  const container = document.getElementById('modal-container');
  container.innerHTML = modal;

  // Close modal handlers
  container.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      container.innerHTML = '';
    });
  });

  // View queue handler
  container.querySelector('.view-queue').addEventListener('click', () => {
    container.innerHTML = '';
    document.querySelector('a[href="#queue"]').click();
  });
}

// Load draft queue
async function loadDraftQueue() {
  const queueDiv = document.getElementById('draft-queue');
  queueDiv.innerHTML = '<div class="px-6 py-8 text-center text-gray-500">Loading queue...</div>';

  try {
    const response = await apiCall('/api/admin/moderation?type=BLOG_POST_DRAFT');

    if (response.ok) {
      const data = await response.json();
      const queue = data.items || [];

      if (queue.length === 0) {
        queueDiv.innerHTML = '<div class="px-6 py-8 text-center text-gray-500">No pending drafts</div>';
        return;
      }

      queueDiv.innerHTML = queue.map(item => `
        <div class="px-6 py-4 hover:bg-gray-50">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <h4 class="font-medium text-gray-900">${item.data.draft?.title || item.data.topic}</h4>
              <p class="text-sm text-gray-600 mt-1">${item.data.draft?.subtitle || ''}</p>
              <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span>Audience: ${item.data.audience}</span>
                <span>Length: ${item.data.length}</span>
                <span>Created: ${new Date(item.created_at).toLocaleDateString()}</span>
              </div>
              ${item.data.validation?.violations.length > 0 ? `
                <div class="mt-2">
                  <span class="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                    ${item.data.validation.violations.length} violation(s)
                  </span>
                </div>
              ` : ''}
            </div>
            <div class="ml-4 flex items-center gap-2">
              <span class="px-3 py-1 text-xs rounded ${item.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                ${item.priority}
              </span>
              <button class="review-draft px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                      data-queue-id="${item._id}">
                Review
              </button>
            </div>
          </div>
        </div>
      `).join('');

      // Add review handlers
      queueDiv.querySelectorAll('.review-draft').forEach(btn => {
        btn.addEventListener('click', () => {
          const queueId = btn.dataset.queueId;
          const item = queue.find(q => q._id === queueId);
          if (item) {
            showReviewModal(item);
          }
        });
      });
    } else {
      queueDiv.innerHTML = '<div class="px-6 py-8 text-center text-red-500">Failed to load queue</div>';
    }
  } catch (error) {
    console.error('Failed to load draft queue:', error);
    queueDiv.innerHTML = '<div class="px-6 py-8 text-center text-red-500">Error loading queue</div>';
  }
}

// Show review modal
function showReviewModal(item) {
  const { draft, validation } = item.data;

  const modal = `
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 class="text-lg font-medium text-gray-900">Review Draft</h3>
          <button class="close-modal text-gray-400 hover:text-gray-600">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div class="prose prose-sm max-w-none">
            <h2>${draft.title}</h2>
            <p class="lead">${draft.subtitle}</p>
            ${marked(draft.content || '')}
          </div>
        </div>

        <div class="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button class="close-modal px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
            Close
          </button>
          <div class="flex gap-2">
            <button class="reject-draft px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    data-queue-id="${item._id}">
              Reject
            </button>
            <button class="approve-draft px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    data-queue-id="${item._id}">
              Approve & Create Post
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const container = document.getElementById('modal-container');
  container.innerHTML = modal;

  // Close modal handler
  container.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      container.innerHTML = '';
    });
  });

  // Approve handler
  container.querySelector('.approve-draft')?.addEventListener('click', async () => {
    const queueId = item._id;
    const approveBtn = container.querySelector('.approve-draft');
    const rejectBtn = container.querySelector('.reject-draft');

    if (!confirm('Approve this draft and publish the blog post?')) {
      return;
    }

    // Disable buttons
    approveBtn.disabled = true;
    rejectBtn.disabled = true;
    approveBtn.textContent = 'Publishing...';

    try {
      const response = await apiCall(`/api/admin/moderation/${queueId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'approve',
          notes: 'Approved via blog curation interface'
        })
      });

      const result = await response.json();

      if (response.ok) {
        // Success - show success message and reload queue
        alert(`✓ Blog post published successfully!\n\nTitle: ${result.blog_post?.title}\nSlug: ${result.blog_post?.slug}\n\nView at: ${result.blog_post?.url}`);

        // Close modal and reload queue
        container.innerHTML = '';
        loadDraftQueue();
        loadStatistics();
      } else {
        alert(`✗ Error: ${result.message || 'Failed to approve draft'}`);
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
        approveBtn.textContent = 'Approve & Create Post';
      }
    } catch (error) {
      console.error('Approve error:', error);
      alert(`✗ Error: ${error.message}`);
      approveBtn.disabled = false;
      rejectBtn.disabled = false;
      approveBtn.textContent = 'Approve & Create Post';
    }
  });

  // Reject handler
  container.querySelector('.reject-draft')?.addEventListener('click', async () => {
    const queueId = item._id;
    const approveBtn = container.querySelector('.approve-draft');
    const rejectBtn = container.querySelector('.reject-draft');

    const reason = prompt('Reason for rejection (optional):');
    if (reason === null) {
      // User cancelled
      return;
    }

    // Disable buttons
    approveBtn.disabled = true;
    rejectBtn.disabled = true;
    rejectBtn.textContent = 'Rejecting...';

    try {
      const response = await apiCall(`/api/admin/moderation/${queueId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'reject',
          notes: reason || 'Rejected via blog curation interface'
        })
      });

      const result = await response.json();

      if (response.ok) {
        alert('✓ Draft rejected successfully');

        // Close modal and reload queue
        container.innerHTML = '';
        loadDraftQueue();
        loadStatistics();
      } else {
        alert(`✗ Error: ${result.message || 'Failed to reject draft'}`);
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
        rejectBtn.textContent = 'Reject';
      }
    } catch (error) {
      console.error('Reject error:', error);
      alert(`✗ Error: ${error.message}`);
      approveBtn.disabled = false;
      rejectBtn.disabled = false;
      rejectBtn.textContent = 'Reject';
    }
  });
}

// Load editorial guidelines
async function loadEditorialGuidelines() {
  try {
    const response = await apiCall('/api/blog/editorial-guidelines');

    if (response.ok) {
      const data = await response.json();
      const guidelines = data.guidelines;

      // Standards
      const standardsDiv = document.getElementById('editorial-standards');
      standardsDiv.innerHTML = `
        <div><dt class="text-sm font-medium text-gray-500">Tone</dt><dd class="text-gray-900">${guidelines.tone}</dd></div>
        <div><dt class="text-sm font-medium text-gray-500">Voice</dt><dd class="text-gray-900">${guidelines.voice}</dd></div>
        <div><dt class="text-sm font-medium text-gray-500">Style</dt><dd class="text-gray-900">${guidelines.style}</dd></div>
      `;

      // Forbidden patterns
      const patternsDiv = document.getElementById('forbidden-patterns');
      patternsDiv.innerHTML = guidelines.forbiddenPatterns.map(p => `
        <li class="flex items-start">
          <span class="text-red-500 mr-2">✗</span>
          <span class="text-sm text-gray-700">${p}</span>
        </li>
      `).join('');

      // Principles
      const principlesDiv = document.getElementById('core-principles');
      principlesDiv.innerHTML = guidelines.principles.map(p => `
        <li class="flex items-start">
          <span class="text-green-500 mr-2">✓</span>
          <span class="text-sm text-gray-700">${p}</span>
        </li>
      `).join('');
    }
  } catch (error) {
    console.error('Failed to load guidelines:', error);
  }
}

// Logout
function initLogout() {
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/admin/login.html';
  });
}

// Refresh queue button
function initRefresh() {
  document.getElementById('refresh-queue-btn')?.addEventListener('click', () => {
    loadDraftQueue();
  });
}

// Suggest Topics button
function initSuggestTopics() {
  const btn = document.getElementById('suggest-topics-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    // Show modal with audience selector
    const modal = `
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-medium text-gray-900">Suggest Blog Topics</h3>
          </div>
          <div class="px-6 py-4">
            <p class="text-sm text-gray-600 mb-4">
              Topics will be generated based on existing documents and content on agenticgovernance.digital
            </p>
            <label class="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
            <select id="suggest-audience" class="w-full border-gray-300 rounded-md">
              <option value="researcher">Researchers (Academic, AI safety specialists)</option>
              <option value="implementer">Implementers (Engineers, architects)</option>
              <option value="advocate">Advocates (Policy makers, ethicists)</option>
              <option value="general">General (Mixed technical backgrounds)</option>
            </select>
            <div id="topic-suggestions-status" class="mt-4 text-sm"></div>
            <div id="topic-suggestions-list" class="mt-4"></div>
          </div>
          <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
            <button class="close-suggest-modal px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
              Close
            </button>
            <button id="generate-topics-btn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Generate Topics
            </button>
          </div>
        </div>
      </div>
    `;

    const container = document.getElementById('modal-container');
    container.innerHTML = modal;

    // Close handler
    container.querySelector('.close-suggest-modal').addEventListener('click', () => {
      container.innerHTML = '';
    });

    // Generate handler
    container.querySelector('#generate-topics-btn').addEventListener('click', async () => {
      const audience = document.getElementById('suggest-audience').value;
      const statusDiv = document.getElementById('topic-suggestions-status');
      const listDiv = document.getElementById('topic-suggestions-list');
      const generateBtn = document.getElementById('generate-topics-btn');

      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';
      statusDiv.textContent = 'Analyzing existing documents and generating topic suggestions...';
      statusDiv.className = 'mt-4 text-sm text-blue-600';

      try {
        const response = await apiCall(`/api/blog/suggest-topics`, {
          method: 'POST',
          body: JSON.stringify({ audience })
        });

        const result = await response.json();

        if (response.ok && result.suggestions) {
          statusDiv.textContent = `✓ Generated ${result.suggestions.length} topic suggestions`;
          statusDiv.className = 'mt-4 text-sm text-green-600';

          listDiv.innerHTML = `
            <div class="space-y-3">
              ${result.suggestions.map((topic, i) => `
                <div class="border border-gray-200 rounded-md p-4 hover:bg-gray-50">
                  <h4 class="font-medium text-gray-900">${topic.title || topic}</h4>
                  ${topic.rationale ? `<p class="text-sm text-gray-600 mt-1">${topic.rationale}</p>` : ''}
                </div>
              `).join('')}
            </div>
          `;
        } else {
          statusDiv.textContent = `✗ Error: ${result.message || 'Failed to generate topics'}`;
          statusDiv.className = 'mt-4 text-sm text-red-600';
        }
      } catch (error) {
        statusDiv.textContent = `✗ Error: ${error.message}`;
        statusDiv.className = 'mt-4 text-sm text-red-600';
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Topics';
      }
    });
  });
}

// Analyze Content button
function initAnalyzeContent() {
  const btn = document.getElementById('analyze-content-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const modal = `
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-medium text-gray-900">Analyze Content for Tractatus Compliance</h3>
          </div>
          <div class="flex-1 overflow-y-auto px-6 py-4">
            <p class="text-sm text-gray-600 mb-4">
              Check existing blog content for compliance with Tractatus principles (inst_016, inst_017, inst_018)
            </p>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Blog Post Title</label>
                <input type="text" id="analyze-title" class="w-full border-gray-300 rounded-md" placeholder="Enter blog post title">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Blog Post Content</label>
                <textarea id="analyze-body" rows="10" class="w-full border-gray-300 rounded-md" placeholder="Paste blog post content here..."></textarea>
              </div>
            </div>
            <div id="analyze-status" class="mt-4 text-sm"></div>
            <div id="analyze-results" class="mt-4"></div>
          </div>
          <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
            <button class="close-analyze-modal px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
              Close
            </button>
            <button id="run-analysis-btn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Analyze
            </button>
          </div>
        </div>
      </div>
    `;

    const container = document.getElementById('modal-container');
    container.innerHTML = modal;

    // Close handler
    container.querySelector('.close-analyze-modal').addEventListener('click', () => {
      container.innerHTML = '';
    });

    // Analyze handler
    container.querySelector('#run-analysis-btn').addEventListener('click', async () => {
      const title = document.getElementById('analyze-title').value.trim();
      const body = document.getElementById('analyze-body').value.trim();
      const statusDiv = document.getElementById('analyze-status');
      const resultsDiv = document.getElementById('analyze-results');
      const analyzeBtn = document.getElementById('run-analysis-btn');

      if (!title || !body) {
        statusDiv.textContent = '⚠ Please enter both title and content';
        statusDiv.className = 'mt-4 text-sm text-yellow-600';
        return;
      }

      analyzeBtn.disabled = true;
      analyzeBtn.textContent = 'Analyzing...';
      statusDiv.textContent = 'Analyzing content for Tractatus compliance...';
      statusDiv.className = 'mt-4 text-sm text-blue-600';
      resultsDiv.innerHTML = '';

      try {
        const response = await apiCall('/api/blog/analyze-content', {
          method: 'POST',
          body: JSON.stringify({ title, body })
        });

        const result = await response.json();

        if (response.ok && result.analysis) {
          const analysis = result.analysis;

          statusDiv.textContent = '✓ Analysis complete';
          statusDiv.className = 'mt-4 text-sm text-green-600';

          const recommendationClass = {
            'PUBLISH': 'bg-green-100 text-green-800',
            'EDIT_REQUIRED': 'bg-yellow-100 text-yellow-800',
            'REJECT': 'bg-red-100 text-red-800'
          }[analysis.recommendation] || 'bg-gray-100 text-gray-800';

          resultsDiv.innerHTML = `
            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-4">
                <h4 class="font-medium text-gray-900">Compliance Score: ${analysis.overall_score}/100</h4>
                <span class="px-3 py-1 text-sm font-medium rounded-full ${recommendationClass}">
                  ${analysis.recommendation}
                </span>
              </div>

              ${analysis.violations && analysis.violations.length > 0 ? `
                <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                  <h5 class="font-medium text-red-900 mb-2">❌ Violations (${analysis.violations.length})</h5>
                  ${analysis.violations.map(v => `
                    <div class="text-sm text-red-800 mb-3">
                      <div class="font-medium">${v.type} - ${v.severity}</div>
                      <div class="mt-1">"${v.excerpt}"</div>
                      <div class="text-xs mt-1">Reason: ${v.reasoning}</div>
                      ${v.suggested_fix ? `<div class="text-xs mt-1 text-green-700">Fix: ${v.suggested_fix}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              ${analysis.warnings && analysis.warnings.length > 0 ? `
                <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                  <h5 class="font-medium text-yellow-900 mb-2">⚠ Warnings (${analysis.warnings.length})</h5>
                  <ul class="text-sm text-yellow-800 list-disc list-inside">
                    ${analysis.warnings.map(w => `<li>${w}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}

              ${analysis.strengths && analysis.strengths.length > 0 ? `
                <div class="bg-green-50 border border-green-200 rounded-md p-4">
                  <h5 class="font-medium text-green-900 mb-2">✓ Strengths (${analysis.strengths.length})</h5>
                  <ul class="text-sm text-green-800 list-disc list-inside">
                    ${analysis.strengths.map(s => `<li>${s}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `;
        } else {
          statusDiv.textContent = `✗ Error: ${result.message || 'Analysis failed'}`;
          statusDiv.className = 'mt-4 text-sm text-red-600';
        }
      } catch (error) {
        statusDiv.textContent = `✗ Error: ${error.message}`;
        statusDiv.className = 'mt-4 text-sm text-red-600';
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze';
      }
    });
  });
}

// Marked.js simple implementation (fallback)
function marked(text) {
  // Simple markdown to HTML conversion
  return text
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/## (.*)/g, '<h2>$1</h2>')
    .replace(/# (.*)/g, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;

  initNavigation();
  initDraftForm();
  initLogout();
  initRefresh();
  initSuggestTopics();
  initAnalyzeContent();
  loadStatistics();
});
