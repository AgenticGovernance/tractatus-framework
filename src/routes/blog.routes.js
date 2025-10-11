/**
 * Blog Routes
 * AI-curated blog endpoints
 */

const express = require('express');
const router = express.Router();

const blogController = require('../controllers/blog.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { validateRequired, validateObjectId, validateSlug } = require('../middleware/validation.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * Public routes
 */

// GET /api/blog/rss - RSS feed (must be before /:slug to avoid conflict)
router.get('/rss',
  asyncHandler(blogController.generateRSSFeed)
);

// GET /api/blog - List published posts
router.get('/',
  asyncHandler(blogController.listPublishedPosts)
);

// GET /api/blog/:slug - Get published post by slug
router.get('/:slug',
  asyncHandler(blogController.getPublishedPost)
);

/**
 * Admin routes
 */

// POST /api/blog/suggest-topics - AI-powered topic suggestions (TRA-OPS-0002)
router.post('/suggest-topics',
  authenticateToken,
  requireRole('admin'),
  validateRequired(['audience']),
  asyncHandler(blogController.suggestTopics)
);

// POST /api/blog/draft-post - AI-powered blog post drafting (TRA-OPS-0002)
// Enforces inst_016, inst_017, inst_018
router.post('/draft-post',
  authenticateToken,
  requireRole('admin'),
  validateRequired(['topic', 'audience']),
  asyncHandler(blogController.draftBlogPost)
);

// POST /api/blog/analyze-content - Analyze content for Tractatus compliance
router.post('/analyze-content',
  authenticateToken,
  requireRole('admin'),
  validateRequired(['title', 'body']),
  asyncHandler(blogController.analyzeContent)
);

// GET /api/blog/editorial-guidelines - Get editorial guidelines
router.get('/editorial-guidelines',
  authenticateToken,
  requireRole('admin', 'moderator'),
  asyncHandler(blogController.getEditorialGuidelines)
);

// GET /api/blog/admin/posts?status=draft
router.get('/admin/posts',
  authenticateToken,
  requireRole('admin', 'moderator'),
  asyncHandler(blogController.listPostsByStatus)
);

// GET /api/blog/admin/:id - Get any post by ID
router.get('/admin/:id',
  authenticateToken,
  requireRole('admin', 'moderator'),
  validateObjectId('id'),
  asyncHandler(blogController.getPostById)
);

// POST /api/blog - Create new post
router.post('/',
  authenticateToken,
  requireRole('admin'),
  validateRequired(['title', 'slug', 'content']),
  validateSlug,
  asyncHandler(blogController.createPost)
);

// PUT /api/blog/:id - Update post
router.put('/:id',
  authenticateToken,
  requireRole('admin'),
  validateObjectId('id'),
  asyncHandler(blogController.updatePost)
);

// POST /api/blog/:id/publish - Publish post
router.post('/:id/publish',
  authenticateToken,
  requireRole('admin'),
  validateObjectId('id'),
  asyncHandler(blogController.publishPost)
);

// DELETE /api/blog/:id - Delete post
router.delete('/:id',
  authenticateToken,
  requireRole('admin'),
  validateObjectId('id'),
  asyncHandler(blogController.deletePost)
);

module.exports = router;
