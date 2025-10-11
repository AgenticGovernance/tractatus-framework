/**
 * Document Cards Component
 * Renders document sections as interactive cards
 */

class DocumentCards {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentDocument = null;
    this.modalViewer = new ModalViewer();
  }

  /**
   * Render document as card grid
   */
  render(document) {
    if (!document || !document.sections || document.sections.length === 0) {
      this.renderTraditionalView(document);
      return;
    }

    this.currentDocument = document;

    // Create document header
    const headerHtml = this.renderHeader(document);

    // Group sections by category
    const sectionsByCategory = this.groupByCategory(document.sections);

    // Render card grid
    const cardsHtml = this.renderCardGrid(sectionsByCategory);

    this.container.innerHTML = `
      ${headerHtml}
      ${cardsHtml}
    `;

    // Add event listeners after a brief delay to ensure DOM is ready
    setTimeout(() => {
      this.attachEventListeners();
    }, 0);
  }

  /**
   * Render document header
   */
  renderHeader(document) {
    const version = document.metadata?.version || '';
    const dateUpdated = document.metadata?.date_updated
      ? new Date(document.metadata.date_updated).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short'
        })
      : '';

    const versionText = version ? `v${version}` : '';
    const metaText = [versionText, dateUpdated ? `Updated ${dateUpdated}` : '']
      .filter(Boolean)
      .join(' | ');

    const hasToC = document.toc && document.toc.length > 0;

    return `
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">${document.title}</h1>
          ${metaText ? `<p class="text-sm text-gray-500">${metaText}</p>` : ''}
          ${document.sections ? `<p class="text-sm text-gray-600 mt-1">${document.sections.length} sections</p>` : ''}
        </div>
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
          <a href="/downloads/${document.slug}.pdf"
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
  }

  /**
   * Group sections by category
   */
  groupByCategory(sections) {
    const groups = {
      conceptual: [],
      practical: [],
      technical: [],
      reference: [],
      critical: []
    };

    sections.forEach(section => {
      const category = section.category || 'conceptual';
      if (groups[category]) {
        groups[category].push(section);
      } else {
        groups.conceptual.push(section);
      }
    });

    return groups;
  }

  /**
   * Render card grid
   */
  renderCardGrid(sectionsByCategory) {
    const categoryConfig = {
      conceptual: { icon: '📘', label: 'Conceptual', color: 'blue' },
      practical: { icon: '✨', label: 'Practical', color: 'green' },
      technical: { icon: '🔧', label: 'Technical', color: 'purple' },
      reference: { icon: '📋', label: 'Reference', color: 'gray' },
      critical: { icon: '⚠️', label: 'Critical', color: 'amber' }
    };

    let html = '<div class="card-grid-container">';

    // Render each category that has sections
    for (const [category, sections] of Object.entries(sectionsByCategory)) {
      if (sections.length === 0) continue;

      const config = categoryConfig[category];

      html += `
        <div class="category-section mb-8">
          <h2 class="category-header text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <span class="text-2xl mr-2">${config.icon}</span>
            ${config.label}
          </h2>
          <div class="card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${sections.map(section => this.renderCard(section, config.color)).join('')}
          </div>
        </div>
      `;
    }

    html += '</div>';

    return html;
  }

  /**
   * Render individual card
   */
  renderCard(section, color) {
    const levelIcons = {
      basic: '○',
      intermediate: '◐',
      advanced: '●'
    };

    const levelIcon = levelIcons[section.technicalLevel] || '○';
    const levelLabel = section.technicalLevel.charAt(0).toUpperCase() + section.technicalLevel.slice(1);

    const borderColor = {
      blue: 'border-blue-400',
      green: 'border-green-400',
      purple: 'border-purple-400',
      gray: 'border-gray-400',
      amber: 'border-amber-400'
    }[color] || 'border-blue-400';

    const hoverColor = {
      blue: 'hover:border-blue-600 hover:shadow-blue-100',
      green: 'hover:border-green-600 hover:shadow-green-100',
      purple: 'hover:border-purple-600 hover:shadow-purple-100',
      gray: 'hover:border-gray-600 hover:shadow-gray-100',
      amber: 'hover:border-amber-600 hover:shadow-amber-100'
    }[color] || 'hover:border-blue-600';

    const bgColor = {
      blue: 'bg-blue-50',
      green: 'bg-green-50',
      purple: 'bg-purple-50',
      gray: 'bg-gray-50',
      amber: 'bg-amber-50'
    }[color] || 'bg-blue-50';

    return `
      <div class="doc-card ${bgColor} border-2 ${borderColor} rounded-lg p-5 cursor-pointer transition-all duration-200 ${hoverColor} hover:shadow-lg"
           data-section-slug="${section.slug}">
        <h3 class="text-lg font-semibold text-gray-900 mb-3">${section.title}</h3>
        <p class="text-sm text-gray-700 mb-4 line-clamp-3">${section.excerpt}</p>
        <div class="flex items-center justify-between text-xs text-gray-600">
          <span>${section.readingTime} min read</span>
          <span title="${levelLabel}">${levelIcon} ${levelLabel}</span>
        </div>
      </div>
    `;
  }

  /**
   * Fallback: render traditional view for documents without sections
   */
  renderTraditionalView(document) {
    if (!document) return;

    this.container.innerHTML = `
      <div class="prose max-w-none">
        ${document.content_html}
      </div>
    `;
  }

  /**
   * Attach event listeners to cards
   */
  attachEventListeners() {
    const cards = this.container.querySelectorAll('.doc-card');

    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const sectionSlug = card.dataset.sectionSlug;
        const section = this.currentDocument.sections.find(s => s.slug === sectionSlug);

        if (section) {
          this.modalViewer.show(section, this.currentDocument.sections);
        }
      });
    });

    // Attach ToC button listener
    const tocButton = document.getElementById('toc-button');
    if (tocButton) {
      tocButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof openToCModal === 'function') {
          openToCModal();
        }
      });
    }
  }
}

/**
 * Modal Viewer Component
 * Displays section content in a modal
 */
class ModalViewer {
  constructor() {
    this.modal = null;
    this.currentSection = null;
    this.allSections = [];
    this.currentIndex = 0;
    this.createModal();
  }

  /**
   * Create modal structure
   */
  createModal() {
    const modalHtml = `
      <div id="section-modal">
        <div class="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 id="modal-title" class="text-2xl font-bold text-gray-900">Document</h2>
            <button id="modal-close" class="text-gray-400 hover:text-gray-600 text-3xl leading-none" aria-label="Close document">&times;</button>
          </div>

          <!-- Content -->
          <div id="modal-content" class="flex-1 overflow-y-auto p-6 prose max-w-none">
          </div>

          <!-- Footer Navigation -->
          <div class="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <button id="modal-prev" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
              ← Previous
            </button>
            <span id="modal-progress" class="text-sm text-gray-600"></span>
            <button id="modal-next" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              Next →
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    this.modal = document.getElementById('section-modal');
    this.attachModalListeners();
  }

  /**
   * Show modal with section content
   */
  show(section, allSections) {
    this.currentSection = section;
    this.allSections = allSections;
    this.currentIndex = allSections.findIndex(s => s.slug === section.slug);

    // Update content
    const titleEl = document.getElementById('modal-title');
    const contentEl = document.getElementById('modal-content');

    if (!titleEl || !contentEl) {
      return;
    }

    titleEl.textContent = section.title;

    // Remove duplicate title (H1 or H2) from content (it's already in modal header)
    let contentHtml = section.content_html;

    // Try removing h1 first, then h2
    const firstH1Match = contentHtml.match(/<h1[^>]*>.*?<\/h1>/);
    if (firstH1Match) {
      contentHtml = contentHtml.replace(firstH1Match[0], '');
    } else {
      const firstH2Match = contentHtml.match(/<h2[^>]*>.*?<\/h2>/);
      if (firstH2Match) {
        contentHtml = contentHtml.replace(firstH2Match[0], '');
      }
    }

    contentEl.innerHTML = contentHtml;

    // Update navigation
    this.updateNavigation();

    // Show modal
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Scroll to top of content
    contentEl.scrollTop = 0;
  }

  /**
   * Hide modal
   */
  hide() {
    this.modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  /**
   * Update navigation buttons
   */
  updateNavigation() {
    const prevBtn = document.getElementById('modal-prev');
    const nextBtn = document.getElementById('modal-next');
    const progress = document.getElementById('modal-progress');

    prevBtn.disabled = this.currentIndex === 0;
    nextBtn.disabled = this.currentIndex === this.allSections.length - 1;

    progress.textContent = `${this.currentIndex + 1} of ${this.allSections.length}`;
  }

  /**
   * Navigate to previous section
   */
  showPrevious() {
    if (this.currentIndex > 0) {
      this.show(this.allSections[this.currentIndex - 1], this.allSections);
    }
  }

  /**
   * Navigate to next section
   */
  showNext() {
    if (this.currentIndex < this.allSections.length - 1) {
      this.show(this.allSections[this.currentIndex + 1], this.allSections);
    }
  }

  /**
   * Attach modal event listeners
   */
  attachModalListeners() {
    // Close button
    document.getElementById('modal-close').addEventListener('click', () => this.hide());

    // Navigation buttons
    document.getElementById('modal-prev').addEventListener('click', () => this.showPrevious());
    document.getElementById('modal-next').addEventListener('click', () => this.showNext());

    // Close on background click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      // Check if modal is visible using display style instead of hidden class
      if (this.modal.style.display === 'flex') {
        if (e.key === 'Escape') {
          this.hide();
        } else if (e.key === 'ArrowLeft') {
          this.showPrevious();
        } else if (e.key === 'ArrowRight') {
          this.showNext();
        }
      }
    });
  }
}
