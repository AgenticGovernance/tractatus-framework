/**
 * Markdown Utility
 * Convert markdown to HTML with syntax highlighting
 */

const { marked } = require('marked');
const hljs = require('highlight.js');
const sanitizeHtml = require('sanitize-html');

// Custom renderer to add IDs to headings
const renderer = new marked.Renderer();
const originalHeadingRenderer = renderer.heading.bind(renderer);

renderer.heading = function(text, level, raw) {
  // Generate slug from heading text
  const slug = raw
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  return `<h${level} id="${slug}">${text}</h${level}>`;
};

// Configure marked
marked.setOptions({
  renderer: renderer,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.error('Highlight error:', err);
      }
    }
    return hljs.highlightAuto(code).value;
  },
  gfm: true,
  breaks: false,
  pedantic: false,
  smartLists: true,
  smartypants: true
});

/**
 * Convert markdown to HTML
 */
function markdownToHtml(markdown) {
  if (!markdown) return '';

  const html = marked(markdown);

  // Sanitize HTML to prevent XSS
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'em', 'u', 'code', 'pre',
      'a', 'img',
      'ul', 'ol', 'li',
      'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
      'sup', 'sub',
      'del', 'ins'
    ],
    allowedAttributes: {
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'h1': ['id'],
      'h2': ['id'],
      'h3': ['id'],
      'h4': ['id'],
      'h5': ['id'],
      'h6': ['id'],
      'code': ['class'],
      'pre': ['class'],
      'div': ['class'],
      'span': ['class'],
      'table': ['class'],
      'th': ['scope', 'class'],
      'td': ['class']
    },
    allowedClasses: {
      'code': ['language-*', 'hljs', 'hljs-*'],
      'pre': ['hljs'],
      'div': ['highlight'],
      'span': ['hljs-*']
    }
  });
}

/**
 * Extract table of contents from markdown
 */
function extractTOC(markdown) {
  if (!markdown) return [];

  const headings = [];
  const lines = markdown.split('\n');

  lines.forEach(line => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].replace(/[#*_`]/g, '').trim();
      const slug = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      headings.push({
        level,
        title,
        slug
      });
    }
  });

  return headings;
}

/**
 * Extract front matter from markdown
 */
function extractFrontMatter(markdown) {
  if (!markdown) return { metadata: {}, content: markdown };

  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = markdown.match(frontMatterRegex);

  if (!match) {
    return { metadata: {}, content: markdown };
  }

  const frontMatter = match[1];
  const content = match[2];
  const metadata = {};

  frontMatter.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      metadata[key.trim()] = valueParts.join(':').trim();
    }
  });

  return { metadata, content };
}

/**
 * Generate slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

module.exports = {
  markdownToHtml,
  extractTOC,
  extractFrontMatter,
  generateSlug
};
