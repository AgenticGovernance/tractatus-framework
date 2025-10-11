/**
 * Document Viewer Component
 * Displays framework documentation with TOC and navigation
 */

class DocumentViewer {
  constructor(containerId = 'document-viewer') {
    this.container = document.getElementById(containerId);
    this.currentDocument = null;
  }

  /**
   * Render document
   */
  async render(documentSlug) {
    if (!this.container) {
      console.error('Document viewer container not found');
      return;
    }

    try {
      // Show loading state
      this.showLoading();

      // Fetch document
      const response = await API.Documents.get(documentSlug);

      if (!response.success) {
        throw new Error('Document not found');
      }

      this.currentDocument = response.document;
      this.showDocument();

    } catch (error) {
      this.showError(error.message);
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.container.innerHTML = `
      <div class="flex items-center justify-center py-20">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-600">Loading document...</p>
        </div>
      </div>
    `;
  }

  /**
   * Show document content
   */
  showDocument() {
    const doc = this.currentDocument;

    this.container.innerHTML = `
      <div class="max-w-4xl mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-8">
          ${doc.quadrant ? `
            <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mb-2">
              ${doc.quadrant}
            </span>
          ` : ''}
          <h1 class="text-4xl font-bold text-gray-900 mb-2">${this.escapeHtml(doc.title)}</h1>
          ${doc.metadata?.version ? `
            <p class="text-sm text-gray-500">Version ${doc.metadata.version}</p>
          ` : ''}
        </div>

        <!-- Table of Contents -->
        ${doc.toc && doc.toc.length > 0 ? this.renderTOC(doc.toc) : ''}

        <!-- Content -->
        <div class="prose prose-lg max-w-none">
          ${doc.content_html}
        </div>

        <!-- Metadata -->
        <div class="mt-12 pt-8 border-t border-gray-200">
          <div class="text-sm text-gray-500">
            ${doc.created_at ? `<p>Created: ${new Date(doc.created_at).toLocaleDateString()}</p>` : ''}
            ${doc.updated_at ? `<p>Updated: ${new Date(doc.updated_at).toLocaleDateString()}</p>` : ''}
          </div>
        </div>
      </div>
    `;

    // Add smooth scroll to TOC links
    this.initializeTOCLinks();
  }

  /**
   * Render table of contents
   */
  renderTOC(toc) {
    return `
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Table of Contents</h2>
        <nav>
          <ul class="space-y-2">
            ${toc.map(item => `
              <li style="margin-left: ${(item.level - 1) * 16}px">
                <a href="#${item.id}"
                   class="text-blue-600 hover:text-blue-700 hover:underline">
                  ${this.escapeHtml(item.text)}
                </a>
              </li>
            `).join('')}
          </ul>
        </nav>
      </div>
    `;
  }

  /**
   * Initialize TOC links for smooth scrolling
   */
  initializeTOCLinks() {
    this.container.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = link.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /**
   * Show error state
   */
  showError(message) {
    this.container.innerHTML = `
      <div class="max-w-2xl mx-auto px-4 py-20 text-center">
        <div class="text-red-600 mb-4">
          <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Document Not Found</h2>
        <p class="text-gray-600 mb-6">${this.escapeHtml(message)}</p>
        <a href="/docs" class="text-blue-600 hover:text-blue-700 font-semibold">
          ← Browse all documents
        </a>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export as global
window.DocumentViewer = DocumentViewer;
