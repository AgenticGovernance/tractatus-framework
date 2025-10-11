let documents = [];
let currentDocument = null;
let documentCards = null;

// Initialize card-based viewer
if (typeof DocumentCards !== 'undefined') {
  documentCards = new DocumentCards('document-content');
}

// Document categorization - Organized by audience and expertise level
const CATEGORIES = {
  'introduction': {
    label: '📘 Introduction',
    icon: '📘',
    description: 'Start here - core concepts for all audiences',
    order: 1,
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-l-4 border-blue-500',
    textColor: 'text-blue-700',
    collapsed: false
  },
  'implementation': {
    label: '⚙️ Implementation',
    icon: '⚙️',
    description: 'Practical guides for developers and implementers',
    order: 2,
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-l-4 border-green-500',
    textColor: 'text-green-700',
    collapsed: false
  },
  'case-studies': {
    label: '📊 Case Studies',
    icon: '📊',
    description: 'Real-world examples and failure analysis',
    order: 3,
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-l-4 border-purple-500',
    textColor: 'text-purple-700',
    collapsed: false
  },
  'business': {
    label: '💼 Business Strategy',
    icon: '💼',
    description: 'ROI, business case, and strategic planning',
    order: 4,
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-l-4 border-indigo-500',
    textColor: 'text-indigo-700',
    collapsed: false
  },
  'advanced': {
    label: '🔬 Advanced Topics',
    icon: '🔬',
    description: 'Deep technical details and research',
    order: 5,
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-l-4 border-red-500',
    textColor: 'text-red-700',
    collapsed: true  // Collapsed by default
  }
};

// Documents to hide (internal/confidential)
const HIDDEN_DOCS = [
  'security-audit-report',
  'koha-production-deployment',
  'koha-stripe-payment',
  'appendix-e-contact',
  'cover-letter'
];

// Categorize a document based on order field
// Order ranges map to categories for audience/expertise-based organization
function categorizeDocument(doc) {
  const slug = doc.slug.toLowerCase();

  // Skip hidden documents
  if (HIDDEN_DOCS.some(hidden => slug.includes(hidden))) {
    return null;
  }

  const order = doc.order || 999;

  // Introduction: 1-5 (beginner level, all audiences)
  if (order >= 1 && order <= 5) {
    return 'introduction';
  }

  // Implementation: 10-19 (practical/technical for implementers)
  if (order >= 10 && order <= 19) {
    return 'implementation';
  }

  // Case Studies: 20-29 (real-world examples)
  if (order >= 20 && order <= 29) {
    return 'case-studies';
  }

  // Business Strategy: 30-35 (for leaders/decision makers)
  if (order >= 30 && order <= 35) {
    return 'business';
  }

  // Advanced Topics: 40-49 (deep technical/research)
  if (order >= 40 && order <= 49) {
    return 'advanced';
  }

  // Fallback to introduction for uncategorized (order 999)
  return 'introduction';
}

// Group documents by category
function groupDocuments(docs) {
  const grouped = {};

  // Initialize all categories
  Object.keys(CATEGORIES).forEach(key => {
    grouped[key] = [];
  });

  // Categorize each document (already sorted by order from API)
  docs.forEach(doc => {
    const category = categorizeDocument(doc);
    if (category && grouped[category]) {
      grouped[category].push(doc);
    }
  });

  return grouped;
}

// Render document link with download button
function renderDocLink(doc, isHighlighted = false) {
  const highlightClass = isHighlighted ? 'text-blue-700 bg-blue-50 border border-blue-200' : '';

  return `
    <div class="relative mb-1">
      <button class="doc-link w-full text-left px-3 py-2 pr-10 rounded text-sm hover:bg-blue-50 transition ${highlightClass}"
              data-slug="${doc.slug}">
        <div class="font-medium text-gray-900">${doc.title}</div>
      </button>
      <a href="/downloads/${doc.slug}.pdf"
         target="_blank"
         rel="noopener noreferrer"
         class="doc-download-link"
         title="Download PDF (opens in new tab)">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      </a>
    </div>
  `;
}

// Load document list
async function loadDocuments() {
  try {
    // Fetch public documents
    const response = await fetch('/api/documents');
    const data = await response.json();
    documents = data.documents || [];

    // Fetch archived documents
    const archivedResponse = await fetch('/api/documents/archived');
    const archivedData = await archivedResponse.json();
    const archivedDocuments = archivedData.documents || [];

    const listEl = document.getElementById('document-list');
    if (documents.length === 0 && archivedDocuments.length === 0) {
      listEl.innerHTML = '<div class="text-sm text-gray-500">No documents available</div>';
      return;
    }

    // Group documents by category
    const grouped = groupDocuments(documents);

    let html = '';

    // Render categories in order
    const sortedCategories = Object.entries(CATEGORIES)
      .sort((a, b) => a[1].order - b[1].order);

    sortedCategories.forEach(([categoryId, category]) => {
      const docs = grouped[categoryId] || [];
      if (docs.length === 0) return;

      const isCollapsed = category.collapsed || false;

      // Category header
      html += `
        <div class="category-section mb-4" data-category="${categoryId}">
          <button class="category-toggle w-full flex items-center justify-between px-3 py-3 text-sm font-bold ${category.textColor} ${category.bgColor} ${category.borderColor} rounded-r hover:shadow-md transition-all"
                  data-category="${categoryId}">
            <span class="flex items-center gap-2">
              <span class="category-icon">${category.icon}</span>
              <span>${category.label.replace(category.icon, '').trim()}</span>
            </span>
            <svg class="category-arrow w-5 h-5 transition-transform ${isCollapsed ? 'rotate-[-90deg]' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div class="category-docs mt-2 pl-2" data-category="${categoryId}" ${isCollapsed ? 'style="display:none"' : ''}>
      `;

      // Render documents in category
      docs.forEach(doc => {
        // Highlight the first document in Introduction category
        const isHighlighted = categoryId === 'introduction' && doc.order === 1;
        html += renderDocLink(doc, isHighlighted);
      });

      html += `
          </div>
        </div>
      `;
    });

    // Add Archives section if there are archived documents
    if (archivedDocuments.length > 0) {
      html += `
        <div class="category-section mb-4 mt-8" data-category="archives">
          <button class="category-toggle w-full flex items-center justify-between px-3 py-3 text-sm font-bold text-gray-600 bg-gray-50 border-l-4 border-gray-400 rounded-r hover:shadow-md transition-all"
                  data-category="archives">
            <span class="flex items-center gap-2">
              <span class="category-icon">📦</span>
              <span>Archives</span>
              <span class="text-xs font-normal text-gray-500">(${archivedDocuments.length} documents)</span>
            </span>
            <svg class="category-arrow w-5 h-5 transition-transform rotate-[-90deg]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div class="category-docs mt-2 pl-2" data-category="archives" style="display:none">
      `;

      // Render archived documents
      archivedDocuments.forEach(doc => {
        html += renderDocLink(doc, false);
        // Add archive note if available
        if (doc.archiveNote) {
          html += `<div class="text-xs text-gray-500 italic pl-6 mb-2">${doc.archiveNote}</div>`;
        }
      });

      html += `
          </div>
        </div>
      `;
    }

    listEl.innerHTML = html;

    // Add event delegation for document links
    listEl.addEventListener('click', function(e) {
      // Check for download link first (prevent document load when clicking download)
      const downloadLink = e.target.closest('.doc-download-link');
      if (downloadLink) {
        e.stopPropagation();
        return;
      }

      const button = e.target.closest('.doc-link');
      if (button && button.dataset.slug) {
        e.preventDefault();
        loadDocument(button.dataset.slug);
        return;
      }

      // Category toggle
      const toggle = e.target.closest('.category-toggle');
      if (toggle) {
        const categoryId = toggle.dataset.category;
        const docsEl = listEl.querySelector(`.category-docs[data-category="${categoryId}"]`);
        const arrowEl = toggle.querySelector('.category-arrow');

        if (docsEl.style.display === 'none') {
          docsEl.style.display = 'block';
          arrowEl.style.transform = 'rotate(0deg)';
        } else {
          docsEl.style.display = 'none';
          arrowEl.style.transform = 'rotate(-90deg)';
        }
      }
    });

    // Auto-load first document in "Introduction" category (order: 1)
    const introductionDocs = grouped['introduction'] || [];
    if (introductionDocs.length > 0) {
      // Load the first document (order: 1) if available
      const firstDoc = introductionDocs.find(d => d.order === 1);
      if (firstDoc) {
        loadDocument(firstDoc.slug);
      } else {
        loadDocument(introductionDocs[0].slug);
      }
    } else if (documents.length > 0) {
      // Fallback to first available document in any category
      const firstCategory = sortedCategories.find(([catId]) => grouped[catId] && grouped[catId].length > 0);
      if (firstCategory) {
        loadDocument(grouped[firstCategory[0]][0].slug);
      }
    }
  } catch (error) {
    console.error('Error loading documents:', error);
    document.getElementById('document-list').innerHTML =
      '<div class="text-sm text-red-600">Error loading documents</div>';
  }
}

// Load specific document
let isLoading = false;

async function loadDocument(slug) {
  // Prevent multiple simultaneous loads
  if (isLoading) return;

  try {
    isLoading = true;

    // Show loading state
    const contentEl = document.getElementById('document-content');
    contentEl.innerHTML = `
      <div class="text-center py-12">
        <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-600">Loading document...</p>
      </div>
    `;

    const response = await fetch(`/api/documents/${slug}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load document');
    }

    currentDocument = data.document;

    // Update active state
    document.querySelectorAll('.doc-link').forEach(el => {
      if (el.dataset.slug === slug) {
        el.classList.add('bg-blue-100', 'text-blue-900');
      } else {
        el.classList.remove('bg-blue-100', 'text-blue-900');
      }
    });

    // Render with card-based viewer if available and document has sections
    if (documentCards && currentDocument.sections && currentDocument.sections.length > 0) {
      documentCards.render(currentDocument);
    } else {
      // Fallback to traditional view with header
      const hasToC = currentDocument.toc && currentDocument.toc.length > 0;

      let headerHTML = `
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <h1 class="text-3xl font-bold text-gray-900">${currentDocument.title}</h1>
          <div class="flex items-center gap-2">
            ${hasToC ? `
              <button id="toc-button"
                      class="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                      title="Table of Contents"
                      aria-label="Show table of contents">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/>
                </svg>
              </button>
            ` : ''}
            <a href="/downloads/${currentDocument.slug}.pdf"
               target="_blank"
               rel="noopener noreferrer"
               class="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
               title="Download PDF"
               aria-label="Download PDF">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </a>
          </div>
        </div>
      `;

      // Remove duplicate title H1 from content (it's already in header)
      let contentHtml = currentDocument.content_html;
      const firstH1Match = contentHtml.match(/<h1[^>]*>.*?<\/h1>/);
      if (firstH1Match) {
        contentHtml = contentHtml.replace(firstH1Match[0], '');
      }

      contentEl.innerHTML = headerHTML + `
        <div class="prose max-w-none">
          ${contentHtml}
        </div>
      `;
    }

    // Add ToC button event listener (works for both card and traditional views)
    setTimeout(() => {
      const tocButton = document.getElementById('toc-button');
      if (tocButton) {
        tocButton.addEventListener('click', () => openToCModal());
      }
    }, 100);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (error) {
    console.error('Error loading document:', error);
    document.getElementById('document-content').innerHTML = `
      <div class="text-center py-12">
        <svg class="h-12 w-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">Error loading document</h3>
        <p class="text-sm text-gray-600">${error.message}</p>
      </div>
    `;
  } finally {
    isLoading = false;
  }
}

// Open ToC modal
function openToCModal() {
  if (!currentDocument || !currentDocument.toc || currentDocument.toc.length === 0) {
    return;
  }

  const modal = document.getElementById('toc-modal');
  if (!modal) return;

  // Render ToC content
  const tocContent = document.getElementById('toc-modal-content');

  const tocHTML = currentDocument.toc
    .filter(item => item.level <= 3) // Only show H1, H2, H3
    .map(item => {
      return `
        <a href="#${item.slug}"
           class="block py-2 px-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded transition toc-link toc-indent-${item.level}"
           data-slug="${item.slug}">
          ${item.title}
        </a>
      `;
    }).join('');

  tocContent.innerHTML = tocHTML;

  // Show modal
  modal.classList.add('show');

  // Prevent body scroll and reset modal content scroll
  document.body.style.overflow = 'hidden';
  tocContent.scrollTop = 0;

  // Add event listeners to ToC links
  tocContent.querySelectorAll('.toc-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        closeToCModal();
        setTimeout(() => {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      }
    });
  });
}

// Close ToC modal
function closeToCModal() {
  const modal = document.getElementById('toc-modal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// Initialize
loadDocuments();

// Add ESC key listener for closing modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeToCModal();
  }
});

// Add close button listener for ToC modal (script loads after DOM, so elements exist)
const closeButton = document.getElementById('toc-close-button');
if (closeButton) {
  closeButton.addEventListener('click', closeToCModal);
}

// Click outside modal to close
const modal = document.getElementById('toc-modal');
if (modal) {
  modal.addEventListener('click', function(e) {
    if (e.target === this) {
      closeToCModal();
    }
  });
}
