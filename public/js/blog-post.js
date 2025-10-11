/**
 * Blog Post Page - Client-Side Logic
 * Handles fetching and displaying individual blog posts with metadata, sharing, and related posts
 */

let currentPost = null;

/**
 * Initialize the blog post page
 */
async function init() {
  try {
    // Get slug from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (!slug) {
      showError('No blog post specified');
      return;
    }

    await loadPost(slug);
  } catch (error) {
    console.error('Error initializing blog post:', error);
    showError('Failed to load blog post');
  }
}

/**
 * Load blog post by slug
 */
async function loadPost(slug) {
  try {
    const response = await fetch(`/api/blog/${slug}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Post not found');
    }

    currentPost = data.post;

    // Render post
    renderPost();

    // Load related posts
    loadRelatedPosts();

    // Attach event listeners
    attachEventListeners();
  } catch (error) {
    console.error('Error loading post:', error);
    showError(error.message || 'Post not found');
  }
}

/**
 * Render the blog post
 */
function renderPost() {
  // Hide loading state
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('error-state').classList.add('hidden');

  // Show post content
  const postContentEl = document.getElementById('post-content');
  postContentEl.classList.remove('hidden');

  // Update page title and meta description
  document.getElementById('page-title').textContent = `${currentPost.title} | Tractatus Blog`;
  document.getElementById('page-description').setAttribute('content', currentPost.excerpt || currentPost.title);

  // Update social media meta tags
  updateSocialMetaTags(currentPost);

  // Update breadcrumb
  document.getElementById('breadcrumb-title').textContent = truncate(currentPost.title, 50);

  // Render post header
  if (currentPost.category) {
    document.getElementById('post-category').textContent = currentPost.category;
  } else {
    document.getElementById('post-category').style.display = 'none';
  }

  document.getElementById('post-title').textContent = currentPost.title;

  // Author
  const authorName = currentPost.author_name || 'Tractatus Team';
  document.getElementById('post-author').textContent = authorName;

  // Date
  const publishedDate = new Date(currentPost.published_at);
  const formattedDate = publishedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  document.getElementById('post-date').textContent = formattedDate;
  document.getElementById('post-date').setAttribute('datetime', currentPost.published_at);

  // Read time
  const wordCount = currentPost.content ? currentPost.content.split(/\s+/).length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  document.getElementById('post-read-time').textContent = `${readTime} min read`;

  // Tags
  if (currentPost.tags && currentPost.tags.length > 0) {
    const tagsHTML = currentPost.tags.map(tag => `
      <span class="inline-block bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">
        ${escapeHtml(tag)}
      </span>
    `).join('');
    document.getElementById('post-tags').innerHTML = tagsHTML;
    document.getElementById('post-tags-container').classList.remove('hidden');
  }

  // AI disclosure (if AI-assisted)
  if (currentPost.ai_assisted || currentPost.metadata?.ai_assisted) {
    document.getElementById('ai-disclosure').classList.remove('hidden');
  }

  // Post body
  const bodyHTML = currentPost.content_html || convertMarkdownToHTML(currentPost.content);
  document.getElementById('post-body').innerHTML = bodyHTML;
}

/**
 * Load related posts (same category or similar tags)
 */
async function loadRelatedPosts() {
  try {
    // Fetch all published posts
    const response = await fetch('/api/blog');
    const data = await response.json();

    if (!data.success) return;

    let allPosts = data.posts || [];

    // Filter out current post
    allPosts = allPosts.filter(post => post._id !== currentPost._id);

    // Find related posts (same category, or matching tags)
    let relatedPosts = [];

    // Priority 1: Same category
    if (currentPost.category) {
      relatedPosts = allPosts.filter(post => post.category === currentPost.category);
    }

    // Priority 2: Matching tags (if not enough from same category)
    if (relatedPosts.length < 3 && currentPost.tags && currentPost.tags.length > 0) {
      const tagMatches = allPosts.filter(post => {
        if (!post.tags || post.tags.length === 0) return false;
        return post.tags.some(tag => currentPost.tags.includes(tag));
      });
      relatedPosts = [...new Set([...relatedPosts, ...tagMatches])];
    }

    // Priority 3: Most recent posts (if still not enough)
    if (relatedPosts.length < 3) {
      const recentPosts = allPosts
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
        .slice(0, 3);
      relatedPosts = [...new Set([...relatedPosts, ...recentPosts])];
    }

    // Limit to 2-3 related posts
    relatedPosts = relatedPosts.slice(0, 2);

    if (relatedPosts.length > 0) {
      renderRelatedPosts(relatedPosts);
    }
  } catch (error) {
    console.error('Error loading related posts:', error);
    // Silently fail - related posts are not critical
  }
}

/**
 * Render related posts section
 */
function renderRelatedPosts(posts) {
  const relatedPostsHTML = posts.map(post => {
    const publishedDate = new Date(post.published_at);
    const formattedDate = publishedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <article class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
        <a href="/blog-post.html?slug=${escapeHtml(post.slug)}" class="block">
          ${post.featured_image ? `
            <div class="aspect-w-16 aspect-h-9 bg-gray-200">
              <img src="${escapeHtml(post.featured_image)}" alt="${escapeHtml(post.title)}" class="object-cover w-full h-32">
            </div>
          ` : `
            <div class="h-32 bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
              <svg class="h-12 w-12 text-white opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
          `}
          <div class="p-4">
            ${post.category ? `
              <span class="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-0.5 rounded mb-2">
                ${escapeHtml(post.category)}
              </span>
            ` : ''}
            <h3 class="text-lg font-bold text-gray-900 mb-2 line-clamp-2 hover:text-indigo-600">
              ${escapeHtml(post.title)}
            </h3>
            <div class="text-sm text-gray-500">
              <time datetime="${post.published_at}">${formattedDate}</time>
            </div>
          </div>
        </a>
      </article>
    `;
  }).join('');

  document.getElementById('related-posts').innerHTML = relatedPostsHTML;
  document.getElementById('related-posts-section').classList.remove('hidden');
}

/**
 * Attach event listeners for sharing and interactions
 */
function attachEventListeners() {
  // Share on Twitter
  const shareTwitterBtn = document.getElementById('share-twitter');
  if (shareTwitterBtn) {
    shareTwitterBtn.addEventListener('click', () => {
      const url = encodeURIComponent(window.location.href);
      const text = encodeURIComponent(currentPost.title);
      window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=550,height=420');
    });
  }

  // Share on LinkedIn
  const shareLinkedInBtn = document.getElementById('share-linkedin');
  if (shareLinkedInBtn) {
    shareLinkedInBtn.addEventListener('click', () => {
      const url = encodeURIComponent(window.location.href);
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'width=550,height=420');
    });
  }

  // Copy link
  const copyLinkBtn = document.getElementById('copy-link');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        // Show temporary success message
        const originalHTML = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = `
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Copied!
        `;
        copyLinkBtn.classList.add('bg-green-600');
        copyLinkBtn.classList.remove('bg-gray-600');

        setTimeout(() => {
          copyLinkBtn.innerHTML = originalHTML;
          copyLinkBtn.classList.remove('bg-green-600');
          copyLinkBtn.classList.add('bg-gray-600');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy link:', err);
        // Show error in button
        const originalHTML = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = `
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
          Failed
        `;
        copyLinkBtn.classList.add('bg-red-600');
        copyLinkBtn.classList.remove('bg-gray-600');

        setTimeout(() => {
          copyLinkBtn.innerHTML = originalHTML;
          copyLinkBtn.classList.remove('bg-red-600');
          copyLinkBtn.classList.add('bg-gray-600');
        }, 2000);
      }
    });
  }
}

/**
 * Show error state
 */
function showError(message) {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('post-content').classList.add('hidden');

  const errorStateEl = document.getElementById('error-state');
  errorStateEl.classList.remove('hidden');

  const errorMessageEl = document.getElementById('error-message');
  if (errorMessageEl) {
    errorMessageEl.textContent = message;
  }
}

/**
 * Convert markdown to HTML (basic implementation - can be enhanced with a library)
 */
function convertMarkdownToHTML(markdown) {
  if (!markdown) return '';

  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${  html  }</p>`;

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

/**
 * Update social media meta tags for sharing
 */
function updateSocialMetaTags(post) {
  const currentUrl = window.location.href;
  const excerpt = post.excerpt || post.title;
  const imageUrl = post.featured_image || 'https://agenticgovernance.digital/images/tractatus-icon.svg';
  const authorName = post.author_name || post.author?.name || 'Tractatus Team';

  // Open Graph tags
  document.getElementById('og-title').setAttribute('content', post.title);
  document.getElementById('og-description').setAttribute('content', excerpt);
  document.getElementById('og-url').setAttribute('content', currentUrl);
  document.getElementById('og-image').setAttribute('content', imageUrl);

  if (post.published_at) {
    document.getElementById('article-published-time').setAttribute('content', post.published_at);
  }
  document.getElementById('article-author').setAttribute('content', authorName);

  // Twitter Card tags
  document.getElementById('twitter-title').setAttribute('content', post.title);
  document.getElementById('twitter-description').setAttribute('content', excerpt);
  document.getElementById('twitter-image').setAttribute('content', imageUrl);
  document.getElementById('twitter-image-alt').setAttribute('content', `${post.title} - Tractatus AI Safety Framework`);
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

/**
 * Truncate text to specified length
 */
function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)  }...`;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
