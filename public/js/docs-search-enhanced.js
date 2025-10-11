/**
 * Docs Search Enhancement Module
 * Provides faceted search, filters, history, and keyboard navigation
 * CSP Compliant - No inline scripts or event handlers
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    DEBOUNCE_DELAY: 300,
    MAX_SEARCH_HISTORY: 10,
    SEARCH_HISTORY_KEY: 'tractatus_search_history',
    MIN_QUERY_LENGTH: 2
  };

  // State
  let searchTimeout = null;
  let currentFilters = {
    query: '',
    quadrant: '',
    persistence: '',
    audience: ''
  };
  let searchHistory = [];
  let selectedResultIndex = -1;
  let searchResults = [];

  // DOM Elements
  const elements = {
    searchInput: null,
    quadrantFilter: null,
    persistenceFilter: null,
    audienceFilter: null,
    clearFiltersBtn: null,
    searchTipsBtn: null,
    searchTipsModal: null,
    searchTipsCloseBtn: null,
    searchResultsPanel: null,
    searchResultsList: null,
    closeSearchResults: null,
    searchResultsSummary: null,
    searchResultsCount: null,
    searchHistoryContainer: null,
    searchHistory: null
  };

  /**
   * Initialize the search enhancement module
   */
  function init() {
    // Get DOM elements
    elements.searchInput = document.getElementById('docs-search-input');
    elements.quadrantFilter = document.getElementById('filter-quadrant');
    elements.persistenceFilter = document.getElementById('filter-persistence');
    elements.audienceFilter = document.getElementById('filter-audience');
    elements.clearFiltersBtn = document.getElementById('clear-filters-btn');
    elements.searchTipsBtn = document.getElementById('search-tips-btn');
    elements.searchTipsModal = document.getElementById('search-tips-modal');
    elements.searchTipsCloseBtn = document.getElementById('search-tips-close-btn');
    elements.searchResultsPanel = document.getElementById('search-results-panel');
    elements.searchResultsList = document.getElementById('search-results-list');
    elements.closeSearchResults = document.getElementById('close-search-results');
    elements.searchResultsSummary = document.getElementById('search-results-summary');
    elements.searchResultsCount = document.getElementById('search-results-count');
    elements.searchHistoryContainer = document.getElementById('search-history-container');
    elements.searchHistory = document.getElementById('search-history');

    // Check if elements exist
    if (!elements.searchInput) {
      console.warn('Search input not found - search enhancement disabled');
      return;
    }

    // Load search history from localStorage
    loadSearchHistory();

    // Attach event listeners
    attachEventListeners();

    // Display search history if available
    renderSearchHistory();
  }

  /**
   * Attach event listeners (CSP compliant - no inline handlers)
   */
  function attachEventListeners() {
    // Search input - debounced
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', handleSearchInput);
      elements.searchInput.addEventListener('keydown', handleSearchKeydown);
    }

    // Filter dropdowns
    if (elements.quadrantFilter) {
      elements.quadrantFilter.addEventListener('change', handleFilterChange);
    }
    if (elements.persistenceFilter) {
      elements.persistenceFilter.addEventListener('change', handleFilterChange);
    }
    if (elements.audienceFilter) {
      elements.audienceFilter.addEventListener('change', handleFilterChange);
    }

    // Clear filters button
    if (elements.clearFiltersBtn) {
      elements.clearFiltersBtn.addEventListener('click', clearFilters);
    }

    // Search tips button
    if (elements.searchTipsBtn) {
      elements.searchTipsBtn.addEventListener('click', openSearchTipsModal);
    }
    if (elements.searchTipsCloseBtn) {
      elements.searchTipsCloseBtn.addEventListener('click', closeSearchTipsModal);
    }
    if (elements.searchTipsModal) {
      elements.searchTipsModal.addEventListener('click', function(e) {
        if (e.target === elements.searchTipsModal) {
          closeSearchTipsModal();
        }
      });
    }

    // Close search results
    if (elements.closeSearchResults) {
      elements.closeSearchResults.addEventListener('click', closeSearchResultsPanel);
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);

    // Escape key to close modal
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeSearchTipsModal();
      }
    });
  }

  /**
   * Handle search input with debounce
   */
  function handleSearchInput(e) {
    const query = e.target.value.trim();

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
      currentFilters.query = query;
      performSearch();
    }, CONFIG.DEBOUNCE_DELAY);
  }

  /**
   * Handle keyboard navigation in search input
   */
  function handleSearchKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = e.target.value.trim();
      if (query) {
        currentFilters.query = query;
        performSearch();
      }
    } else if (e.key === 'Escape') {
      closeSearchResultsPanel();
      e.target.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateResults('down');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateResults('up');
    }
  }

  /**
   * Handle filter changes
   */
  function handleFilterChange() {
    currentFilters.quadrant = elements.quadrantFilter ? elements.quadrantFilter.value : '';
    currentFilters.persistence = elements.persistenceFilter ? elements.persistenceFilter.value : '';
    currentFilters.audience = elements.audienceFilter ? elements.audienceFilter.value : '';

    performSearch();
  }

  /**
   * Clear all filters
   */
  function clearFilters() {
    if (elements.searchInput) elements.searchInput.value = '';
    if (elements.quadrantFilter) elements.quadrantFilter.value = '';
    if (elements.persistenceFilter) elements.persistenceFilter.value = '';
    if (elements.audienceFilter) elements.audienceFilter.value = '';

    currentFilters = {
      query: '',
      quadrant: '',
      persistence: '',
      audience: ''
    };

    closeSearchResultsPanel();
  }

  /**
   * Perform search with current filters
   */
  async function performSearch() {
    const { query, quadrant, persistence, audience } = currentFilters;

    // If no query and no filters, don't search
    if (!query && !quadrant && !persistence && !audience) {
      closeSearchResultsPanel();
      return;
    }

    // Build query params
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (quadrant) params.append('quadrant', quadrant);
    if (persistence) params.append('persistence', persistence);
    if (audience) params.append('audience', audience);

    try {
      const startTime = performance.now();
      const response = await fetch(`/api/documents/search?${params.toString()}`);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const data = await response.json();

      if (data.success) {
        searchResults = data.documents || [];
        renderSearchResults(data, duration);

        // Save to search history if query exists
        if (query) {
          addToSearchHistory(query);
        }
      } else {
        showError('Search failed. Please try again.');
      }
    } catch (error) {
      console.error('Search error:', error);
      showError('Search failed. Please check your connection.');
    }
  }

  /**
   * Render search results
   */
  function renderSearchResults(data, duration) {
    if (!elements.searchResultsList || !elements.searchResultsPanel) return;

    const { documents, count, total, filters } = data;

    // Show results panel
    elements.searchResultsPanel.classList.remove('hidden');

    // Update summary
    if (elements.searchResultsSummary && elements.searchResultsCount) {
      elements.searchResultsSummary.classList.remove('hidden');

      let summaryText = `Found ${total} document${total !== 1 ? 's' : ''}`;
      if (duration) {
        summaryText += ` (${duration}ms)`;
      }

      const activeFilters = [];
      if (filters.quadrant) activeFilters.push(`Quadrant: ${filters.quadrant}`);
      if (filters.persistence) activeFilters.push(`Persistence: ${filters.persistence}`);
      if (filters.audience) activeFilters.push(`Audience: ${filters.audience}`);

      if (activeFilters.length > 0) {
        summaryText += ` • Filters: ${activeFilters.join(', ')}`;
      }

      elements.searchResultsCount.textContent = summaryText;
    }

    // Render results
    if (documents.length === 0) {
      elements.searchResultsList.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <p class="text-lg font-medium">No documents found</p>
          <p class="text-sm mt-2">Try adjusting your search terms or filters</p>
        </div>
      `;
      return;
    }

    const resultsHTML = documents.map((doc, index) => {
      const badges = [];
      if (doc.quadrant) badges.push(`<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">${doc.quadrant}</span>`);
      if (doc.persistence) badges.push(`<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">${doc.persistence}</span>`);
      if (doc.audience) badges.push(`<span class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">${doc.audience}</span>`);

      // Highlight query terms in title (simple highlighting)
      let highlightedTitle = doc.title;
      if (currentFilters.query) {
        const regex = new RegExp(`(${escapeRegex(currentFilters.query)})`, 'gi');
        highlightedTitle = doc.title.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
      }

      return `
        <div class="search-result-item p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition cursor-pointer ${index === selectedResultIndex ? 'border-blue-500 bg-blue-50' : ''}"
             data-slug="${doc.slug}"
             data-index="${index}">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">${highlightedTitle}</h3>
              <div class="flex flex-wrap gap-2 mb-3">
                ${badges.join('')}
              </div>
              <p class="text-sm text-gray-600 line-clamp-2">${doc.metadata?.description || 'Framework documentation'}</p>
            </div>
            <a href="/downloads/${doc.slug}.pdf"
               class="flex-shrink-0 p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition"
               title="Download PDF"
               aria-label="Download PDF">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </a>
          </div>
        </div>
      `;
    }).join('');

    elements.searchResultsList.innerHTML = resultsHTML;

    // Attach click handlers to results
    document.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', function(e) {
        // Don't navigate if clicking download link
        if (e.target.closest('a[href*="/downloads/"]')) {
          return;
        }

        const slug = this.dataset.slug;
        if (slug && typeof loadDocument === 'function') {
          loadDocument(slug);
          closeSearchResultsPanel();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

    // Reset selected index
    selectedResultIndex = -1;
  }

  /**
   * Navigate search results with keyboard
   */
  function navigateResults(direction) {
    if (searchResults.length === 0) return;

    if (direction === 'down') {
      selectedResultIndex = Math.min(selectedResultIndex + 1, searchResults.length - 1);
    } else if (direction === 'up') {
      selectedResultIndex = Math.max(selectedResultIndex - 1, -1);
    }

    // Re-render to show selection
    if (searchResults.length > 0) {
      const items = document.querySelectorAll('.search-result-item');
      items.forEach((item, index) => {
        if (index === selectedResultIndex) {
          item.classList.add('border-blue-500', 'bg-blue-50');
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          item.classList.remove('border-blue-500', 'bg-blue-50');
        }
      });

      // If Enter key pressed on selected result
      if (selectedResultIndex >= 0) {
        const selectedSlug = searchResults[selectedResultIndex].slug;
        // Store for Enter key handler
        document.addEventListener('keydown', function enterHandler(e) {
          if (e.key === 'Enter' && selectedResultIndex >= 0) {
            if (typeof loadDocument === 'function') {
              loadDocument(selectedSlug);
              closeSearchResultsPanel();
            }
            document.removeEventListener('keydown', enterHandler);
          }
        }, { once: true });
      }
    }
  }

  /**
   * Close search results panel
   */
  function closeSearchResultsPanel() {
    if (elements.searchResultsPanel) {
      elements.searchResultsPanel.classList.add('hidden');
    }
    if (elements.searchResultsSummary) {
      elements.searchResultsSummary.classList.add('hidden');
    }
    selectedResultIndex = -1;
    searchResults = [];
  }

  /**
   * Show error message
   */
  function showError(message) {
    if (elements.searchResultsList) {
      elements.searchResultsList.innerHTML = `
        <div class="text-center py-8 text-red-500">
          <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-lg font-medium">${message}</p>
        </div>
      `;
    }
  }

  /**
   * Open search tips modal
   */
  function openSearchTipsModal() {
    if (elements.searchTipsModal) {
      elements.searchTipsModal.classList.remove('hidden');
      elements.searchTipsModal.classList.add('flex');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Close search tips modal
   */
  function closeSearchTipsModal() {
    if (elements.searchTipsModal) {
      elements.searchTipsModal.classList.add('hidden');
      elements.searchTipsModal.classList.remove('flex');
      document.body.style.overflow = '';
    }
  }

  /**
   * Handle global keyboard shortcuts
   */
  function handleGlobalKeydown(e) {
    // Ctrl+K or Cmd+K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (elements.searchInput) {
        elements.searchInput.focus();
        elements.searchInput.select();
      }
    }
  }

  /**
   * Load search history from localStorage
   */
  function loadSearchHistory() {
    try {
      const stored = localStorage.getItem(CONFIG.SEARCH_HISTORY_KEY);
      if (stored) {
        searchHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
      searchHistory = [];
    }
  }

  /**
   * Save search history to localStorage
   */
  function saveSearchHistory() {
    try {
      localStorage.setItem(CONFIG.SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }

  /**
   * Add query to search history
   */
  function addToSearchHistory(query) {
    if (!query || query.length < CONFIG.MIN_QUERY_LENGTH) return;

    // Remove duplicates
    searchHistory = searchHistory.filter(item => item !== query);

    // Add to beginning
    searchHistory.unshift(query);

    // Limit size
    if (searchHistory.length > CONFIG.MAX_SEARCH_HISTORY) {
      searchHistory = searchHistory.slice(0, CONFIG.MAX_SEARCH_HISTORY);
    }

    saveSearchHistory();
    renderSearchHistory();
  }

  /**
   * Render search history
   */
  function renderSearchHistory() {
    if (!elements.searchHistory || !elements.searchHistoryContainer) return;

    if (searchHistory.length === 0) {
      elements.searchHistoryContainer.classList.add('hidden');
      return;
    }

    elements.searchHistoryContainer.classList.remove('hidden');

    const historyHTML = searchHistory.slice(0, 5).map(query => {
      return `
        <button class="search-history-item px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-full hover:bg-gray-50 hover:border-gray-400 transition"
                data-query="${escapeHtml(query)}">
          ${escapeHtml(query)}
        </button>
      `;
    }).join('');

    elements.searchHistory.innerHTML = historyHTML;

    // Attach click handlers
    document.querySelectorAll('.search-history-item').forEach(item => {
      item.addEventListener('click', function() {
        const query = this.dataset.query;
        if (elements.searchInput) {
          elements.searchInput.value = query;
          currentFilters.query = query;
          performSearch();
        }
      });
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape regex special characters
   */
  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
