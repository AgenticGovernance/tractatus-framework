/**
 * Blog Listing Page - Client-Side Logic
 * Handles fetching, filtering, searching, sorting, and pagination of blog posts
 */

// State management
let allPosts = [];
let filteredPosts = [];
let currentPage = 1;
const postsPerPage = 9;

// Filter state
const activeFilters = {
  search: '',
  category: '',
  sort: 'date-desc'
};

/**
 * Initialize the blog page
 */
async function init() {
  try {
    await loadPosts();
    attachEventListeners();
  } catch (error) {
    console.error('Error initializing blog:', error);
    showError('Failed to load blog posts. Please refresh the page.');
  }
}

/**
 * Load all published blog posts from API
 */
async function loadPosts() {
  try {
    const response = await fetch('/api/blog');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load posts');
    }

    allPosts = data.posts || [];
    filteredPosts = [...allPosts];

    // Apply initial sorting
    sortPosts();

    // Render initial view
    renderPosts();
    updateResultsCount();
  } catch (error) {
    console.error('Error loading posts:', error);
    showError('Failed to load blog posts');
  }
}

/**
 * Render blog posts grid
 */
function renderPosts() {
  const gridEl = document.getElementById('blog-grid');
  const emptyStateEl = document.getElementById('empty-state');

  if (filteredPosts.length === 0) {
    gridEl.innerHTML = '';
    emptyStateEl.classList.remove('hidden');
    document.getElementById('pagination').classList.add('hidden');
    return;
  }

  emptyStateEl.classList.add('hidden');

  // Calculate pagination
  const startIndex = (currentPage - 1) * postsPerPage;
  const endIndex = startIndex + postsPerPage;
  const postsToShow = filteredPosts.slice(startIndex, endIndex);

  // Render posts
  const postsHTML = postsToShow.map(post => renderPostCard(post)).join('');
  gridEl.innerHTML = postsHTML;

  // Render pagination
  renderPagination();

  // Scroll to top when changing pages (except initial load)
  if (currentPage > 1) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * Render a single post card
 */
function renderPostCard(post) {
  const publishedDate = new Date(post.published_at);
  const formattedDate = publishedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Calculate read time (rough estimate: 200 words per minute)
  const wordCount = post.content ? post.content.split(/\s+/).length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  // Truncate excerpt to 150 characters
  const excerpt = post.excerpt ?
    (post.excerpt.length > 150 ? `${post.excerpt.substring(0, 150)  }...` : post.excerpt) :
    'Read more...';

  // Get category color
  const categoryColor = getCategoryColor(post.category);

  return `
    <article class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
      <a href="/blog-post.html?slug=${escapeHtml(post.slug)}" class="block">
        ${post.featured_image ? `
          <div class="aspect-w-16 aspect-h-9 bg-gray-200">
            <img src="${escapeHtml(post.featured_image)}" alt="${escapeHtml(post.title)}" class="object-cover w-full h-48">
          </div>
        ` : `
          <div class="h-48 bg-gradient-to-br ${categoryColor} flex items-center justify-center">
            <svg class="h-16 w-16 text-white opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
        `}

        <div class="p-6">
          <!-- Category Badge -->
          ${post.category ? `
            <span class="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded mb-3">
              ${escapeHtml(post.category)}
            </span>
          ` : ''}

          <!-- Title -->
          <h2 class="text-xl font-bold text-gray-900 mb-2 line-clamp-2 hover:text-indigo-600 transition">
            ${escapeHtml(post.title)}
          </h2>

          <!-- Excerpt -->
          <p class="text-gray-600 mb-4 line-clamp-3">
            ${escapeHtml(excerpt)}
          </p>

          <!-- Metadata -->
          <div class="flex items-center text-sm text-gray-500 space-x-4">
            <div class="flex items-center">
              <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              <time datetime="${post.published_at}">${formattedDate}</time>
            </div>
            <div class="flex items-center">
              <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>${readTime} min read</span>
            </div>
          </div>

          <!-- Tags -->
          ${post.tags && post.tags.length > 0 ? `
            <div class="mt-4 flex flex-wrap gap-1">
              ${post.tags.slice(0, 3).map(tag => `
                <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  ${escapeHtml(tag)}
                </span>
              `).join('')}
              ${post.tags.length > 3 ? `<span class="text-xs text-gray-500">+${post.tags.length - 3} more</span>` : ''}
            </div>
          ` : ''}
        </div>
      </a>
    </article>
  `;
}

/**
 * Get category color gradient
 */
function getCategoryColor(category) {
  const colorMap = {
    'Framework Updates': 'from-blue-400 to-blue-600',
    'Case Studies': 'from-purple-400 to-purple-600',
    'Research': 'from-green-400 to-green-600',
    'Implementation': 'from-yellow-400 to-yellow-600',
    'Community': 'from-pink-400 to-pink-600'
  };
  return colorMap[category] || 'from-gray-400 to-gray-600';
}

/**
 * Render pagination controls
 */
function renderPagination() {
  const paginationEl = document.getElementById('pagination');
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);

  if (totalPages <= 1) {
    paginationEl.classList.add('hidden');
    return;
  }

  paginationEl.classList.remove('hidden');

  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const pageNumbersEl = document.getElementById('page-numbers');

  // Update prev/next buttons
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;

  // Render page numbers
  let pageNumbersHTML = '';
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  // Adjust start if we're near the end
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  // First page + ellipsis
  if (startPage > 1) {
    pageNumbersHTML += `
      <button class="page-number px-3 py-1 border border-gray-300 rounded text-sm" data-page="1">1</button>
      ${startPage > 2 ? '<span class="px-2 text-gray-500">...</span>' : ''}
    `;
  }

  // Visible page numbers
  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === currentPage;
    pageNumbersHTML += `
      <button class="page-number px-3 py-1 border ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'} rounded text-sm" data-page="${i}">
        ${i}
      </button>
    `;
  }

  // Ellipsis + last page
  if (endPage < totalPages) {
    pageNumbersHTML += `
      ${endPage < totalPages - 1 ? '<span class="px-2 text-gray-500">...</span>' : ''}
      <button class="page-number px-3 py-1 border border-gray-300 rounded text-sm" data-page="${totalPages}">${totalPages}</button>
    `;
  }

  pageNumbersEl.innerHTML = pageNumbersHTML;
}

/**
 * Apply filters and search
 */
function applyFilters() {
  // Reset to first page when filters change
  currentPage = 1;

  // Start with all posts
  filteredPosts = [...allPosts];

  // Apply search
  if (activeFilters.search) {
    const searchLower = activeFilters.search.toLowerCase();
    filteredPosts = filteredPosts.filter(post => {
      return (
        post.title.toLowerCase().includes(searchLower) ||
        (post.content && post.content.toLowerCase().includes(searchLower)) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(searchLower)) ||
        (post.tags && post.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    });
  }

  // Apply category filter
  if (activeFilters.category) {
    filteredPosts = filteredPosts.filter(post => post.category === activeFilters.category);
  }

  // Sort
  sortPosts();

  // Update UI
  renderPosts();
  updateResultsCount();
  updateActiveFiltersDisplay();
}

/**
 * Sort posts based on active sort option
 */
function sortPosts() {
  switch (activeFilters.sort) {
    case 'date-desc':
      filteredPosts.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
      break;
    case 'date-asc':
      filteredPosts.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
      break;
    case 'title-asc':
      filteredPosts.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'title-desc':
      filteredPosts.sort((a, b) => b.title.localeCompare(a.title));
      break;
  }
}

/**
 * Update results count display
 */
function updateResultsCount() {
  const countEl = document.getElementById('post-count');
  if (countEl) {
    countEl.textContent = filteredPosts.length;
  }
}

/**
 * Update active filters display
 */
function updateActiveFiltersDisplay() {
  const activeFiltersEl = document.getElementById('active-filters');
  const filterTagsEl = document.getElementById('filter-tags');

  const hasActiveFilters = activeFilters.search || activeFilters.category;

  if (!hasActiveFilters) {
    activeFiltersEl.classList.add('hidden');
    return;
  }

  activeFiltersEl.classList.remove('hidden');

  let tagsHTML = '';

  if (activeFilters.search) {
    tagsHTML += `
      <span class="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
        Search: "${escapeHtml(activeFilters.search)}"
        <button class="ml-1 hover:text-indigo-900" data-remove-filter="search">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </span>
    `;
  }

  if (activeFilters.category) {
    tagsHTML += `
      <span class="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
        Category: ${escapeHtml(activeFilters.category)}
        <button class="ml-1 hover:text-indigo-900" data-remove-filter="category">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </span>
    `;
  }

  filterTagsEl.innerHTML = tagsHTML;
}

/**
 * Clear all filters
 */
function clearFilters() {
  activeFilters.search = '';
  activeFilters.category = '';

  // Reset UI elements
  document.getElementById('search-input').value = '';
  document.getElementById('category-filter').value = '';

  // Reapply filters
  applyFilters();
}

/**
 * Remove specific filter
 */
function removeFilter(filterType) {
  if (filterType === 'search') {
    activeFilters.search = '';
    document.getElementById('search-input').value = '';
  } else if (filterType === 'category') {
    activeFilters.category = '';
    document.getElementById('category-filter').value = '';
  }

  applyFilters();
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  // Search input (debounced)
  const searchInput = document.getElementById('search-input');
  let searchTimeout;
  searchInput.addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      activeFilters.search = e.target.value.trim();
      applyFilters();
    }, 300);
  });

  // Category filter
  const categoryFilter = document.getElementById('category-filter');
  categoryFilter.addEventListener('change', e => {
    activeFilters.category = e.target.value;
    applyFilters();
  });

  // Sort select
  const sortSelect = document.getElementById('sort-select');
  sortSelect.addEventListener('change', e => {
    activeFilters.sort = e.target.value;
    applyFilters();
  });

  // Clear filters button
  const clearFiltersBtn = document.getElementById('clear-filters');
  clearFiltersBtn.addEventListener('click', clearFilters);

  // Pagination - prev/next buttons
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPosts();
    }
  });

  nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderPosts();
    }
  });

  // Pagination - page numbers (event delegation)
  const pageNumbersEl = document.getElementById('page-numbers');
  pageNumbersEl.addEventListener('click', e => {
    const pageBtn = e.target.closest('.page-number');
    if (pageBtn) {
      currentPage = parseInt(pageBtn.dataset.page, 10);
      renderPosts();
    }
  });

  // Remove filter tags (event delegation)
  const filterTagsEl = document.getElementById('filter-tags');
  filterTagsEl.addEventListener('click', e => {
    const removeBtn = e.target.closest('[data-remove-filter]');
    if (removeBtn) {
      const filterType = removeBtn.dataset.removeFilter;
      removeFilter(filterType);
    }
  });
}

/**
 * Show error message
 */
function showError(message) {
  const gridEl = document.getElementById('blog-grid');
  gridEl.innerHTML = `
    <div class="col-span-full bg-red-50 border border-red-200 rounded-lg p-6">
      <div class="flex items-start">
        <svg class="h-6 w-6 text-red-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div>
          <h3 class="text-lg font-semibold text-red-900 mb-2">Error</h3>
          <p class="text-red-700">${escapeHtml(message)}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
