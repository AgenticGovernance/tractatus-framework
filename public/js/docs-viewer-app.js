// Initialize document viewer
const viewer = new DocumentViewer('document-viewer');

// Load navigation
async function loadNavigation() {
  try {
    const response = await API.Documents.list({ limit: 50 });
    const nav = document.getElementById('doc-navigation');

    if (response.success && response.documents) {
      nav.innerHTML = response.documents.map(doc => `
        <a href="/docs/${doc.slug}"
           data-route="/docs/${doc.slug}"
           class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
          ${doc.title}
        </a>
      `).join('');
    }
  } catch (error) {
    console.error('Failed to load navigation:', error);
  }
}

// Setup routing
router
  .on('/docs-viewer.html', async () => {
    // Show default document
    await viewer.render('introduction-to-the-tractatus-framework');
  })
  .on('/docs/:slug', async (params) => {
    await viewer.render(params.slug);
  });

// Initialize
loadNavigation();
