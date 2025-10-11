/**
 * Blog Controller
 * AI-curated blog with human oversight
 */

const BlogPost = require('../models/BlogPost.model');
const ModerationQueue = require('../models/ModerationQueue.model');
const GovernanceLog = require('../models/GovernanceLog.model');
const { markdownToHtml } = require('../utils/markdown.util');
const logger = require('../utils/logger.util');
const claudeAPI = require('../services/ClaudeAPI.service');
const BoundaryEnforcer = require('../services/BoundaryEnforcer.service');
const BlogCuration = require('../services/BlogCuration.service');

/**
 * List published blog posts (public)
 * GET /api/blog
 */
async function listPublishedPosts(req, res) {
  try {
    const { limit = 10, skip = 0 } = req.query;

    const posts = await BlogPost.findPublished({
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    const total = await BlogPost.countByStatus('published');

    res.json({
      success: true,
      posts,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + posts.length < total
      }
    });

  } catch (error) {
    logger.error('List published posts error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Get single blog post by slug (public, published only)
 * GET /api/blog/:slug
 */
async function getPublishedPost(req, res) {
  try {
    const { slug } = req.params;

    const post = await BlogPost.findBySlug(slug);

    if (!post || post.status !== 'published') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Blog post not found'
      });
    }

    // Increment view count
    await BlogPost.incrementViews(post._id);

    res.json({
      success: true,
      post
    });

  } catch (error) {
    logger.error('Get published post error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * List posts by status (admin only)
 * GET /api/blog/admin/posts?status=draft
 */
async function listPostsByStatus(req, res) {
  try {
    const { status = 'draft', limit = 20, skip = 0 } = req.query;

    const posts = await BlogPost.findByStatus(status, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    const total = await BlogPost.countByStatus(status);

    res.json({
      success: true,
      status,
      posts,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });

  } catch (error) {
    logger.error('List posts by status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Get any post by ID (admin only)
 * GET /api/blog/admin/:id
 */
async function getPostById(req, res) {
  try {
    const { id } = req.params;

    const post = await BlogPost.findById(id);

    if (!post) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Blog post not found'
      });
    }

    res.json({
      success: true,
      post
    });

  } catch (error) {
    logger.error('Get post by ID error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Create blog post (admin only)
 * POST /api/blog
 */
async function createPost(req, res) {
  try {
    const { title, slug, content, excerpt, tags, author, tractatus_classification } = req.body;

    // Convert markdown content to HTML if needed
    const content_html = content.includes('# ') ? markdownToHtml(content) : content;

    const post = await BlogPost.create({
      title,
      slug,
      content: content_html,
      excerpt,
      tags,
      author: {
        ...author,
        name: author?.name || req.user.name || req.user.email
      },
      tractatus_classification,
      status: 'draft'
    });

    logger.info(`Blog post created: ${slug} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      post
    });

  } catch (error) {
    logger.error('Create post error:', error);

    // Handle duplicate slug
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A post with this slug already exists'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Update blog post (admin only)
 * PUT /api/blog/:id
 */
async function updatePost(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // If content is updated and looks like markdown, convert to HTML
    if (updates.content && updates.content.includes('# ')) {
      updates.content = markdownToHtml(updates.content);
    }

    const success = await BlogPost.update(id, updates);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Blog post not found'
      });
    }

    const post = await BlogPost.findById(id);

    logger.info(`Blog post updated: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      post
    });

  } catch (error) {
    logger.error('Update post error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Publish blog post (admin only)
 * POST /api/blog/:id/publish
 */
async function publishPost(req, res) {
  try {
    const { id } = req.params;
    const { review_notes } = req.body;

    const post = await BlogPost.findById(id);

    if (!post) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Blog post not found'
      });
    }

    if (post.status === 'published') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Post is already published'
      });
    }

    // Update with review notes if provided
    if (review_notes) {
      await BlogPost.update(id, {
        'moderation.review_notes': review_notes
      });
    }

    // Publish the post
    await BlogPost.publish(id, req.userId);

    const updatedPost = await BlogPost.findById(id);

    logger.info(`Blog post published: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      post: updatedPost,
      message: 'Post published successfully'
    });

  } catch (error) {
    logger.error('Publish post error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Delete blog post (admin only)
 * DELETE /api/blog/:id
 */
async function deletePost(req, res) {
  try {
    const { id } = req.params;

    const success = await BlogPost.delete(id);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Blog post not found'
      });
    }

    logger.info(`Blog post deleted: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    logger.error('Delete post error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Suggest blog topics using AI (admin only)
 * POST /api/blog/suggest-topics
 *
 * TRA-OPS-0002: AI suggests topics, human writes and approves posts
 */
async function suggestTopics(req, res) {
  try {
    const { audience, theme } = req.body;

    // Validate audience
    const validAudiences = ['researcher', 'implementer', 'advocate', 'general'];
    if (!audience || !validAudiences.includes(audience)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Audience must be one of: ${validAudiences.join(', ')}`
      });
    }

    logger.info(`Blog topic suggestion requested: audience=${audience}, theme=${theme || 'none'}`);

    // 1. Boundary check (TRA-OPS-0002: Editorial decisions require human oversight)
    const boundaryCheck = BoundaryEnforcer.enforce({
      description: 'Suggest blog topics for editorial calendar',
      text: 'AI provides suggestions, human makes final editorial decisions',
      classification: { quadrant: 'OPERATIONAL' },
      type: 'content_suggestion'
    });

    // Log boundary check
    await GovernanceLog.create({
      action: 'BLOG_TOPIC_SUGGESTION',
      user_id: req.user._id,
      user_email: req.user.email,
      timestamp: new Date(),
      boundary_check: boundaryCheck,
      outcome: boundaryCheck.allowed ? 'QUEUED_FOR_APPROVAL' : 'BLOCKED',
      details: {
        audience,
        theme
      }
    });

    if (!boundaryCheck.allowed) {
      logger.warn(`Blog topic suggestion blocked by BoundaryEnforcer: ${boundaryCheck.section}`);
      return res.status(403).json({
        error: 'Boundary Violation',
        message: boundaryCheck.reasoning,
        section: boundaryCheck.section,
        details: 'This action requires human judgment in values territory'
      });
    }

    // 2. Claude API call for topic suggestions
    const suggestions = await claudeAPI.generateBlogTopics(audience, theme);

    logger.info(`Claude API returned ${suggestions.length} topic suggestions`);

    // 3. Create moderation queue entry (human approval required)
    const queueEntry = await ModerationQueue.create({
      type: 'BLOG_TOPIC_SUGGESTION',
      reference_collection: 'blog_posts',
      data: {
        audience,
        theme,
        suggestions,
        requested_by: req.user.email
      },
      status: 'PENDING_APPROVAL',
      ai_generated: true,
      requires_human_approval: true,
      created_by: req.user._id,
      created_at: new Date(),
      metadata: {
        boundary_check: boundaryCheck,
        governance_policy: 'TRA-OPS-0002'
      }
    });

    logger.info(`Created moderation queue entry: ${queueEntry._id}`);

    // 4. Return response (suggestions queued for human review)
    res.json({
      success: true,
      message: 'Blog topic suggestions generated. Awaiting human review and approval.',
      queue_id: queueEntry._id,
      suggestions,
      governance: {
        policy: 'TRA-OPS-0002',
        boundary_check: boundaryCheck,
        requires_approval: true,
        note: 'Topics are suggestions only. Human must write all blog posts.'
      }
    });

  } catch (error) {
    logger.error('Suggest topics error:', error);

    // Handle Claude API errors specifically
    if (error.message.includes('Claude API')) {
      return res.status(502).json({
        error: 'AI Service Error',
        message: 'Failed to generate topic suggestions. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Draft a full blog post using AI (admin only)
 * POST /api/blog/draft-post
 *
 * TRA-OPS-0002: AI drafts content, human reviews and approves before publication
 * Enforces inst_016, inst_017, inst_018 via BlogCuration service
 */
async function draftBlogPost(req, res) {
  try {
    const { topic, audience, length = 'medium', focus } = req.body;

    // Validate required fields
    if (!topic || !audience) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'topic and audience are required'
      });
    }

    const validAudiences = ['researcher', 'implementer', 'advocate', 'general'];
    if (!validAudiences.includes(audience)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `audience must be one of: ${validAudiences.join(', ')}`
      });
    }

    const validLengths = ['short', 'medium', 'long'];
    if (!validLengths.includes(length)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `length must be one of: ${validLengths.join(', ')}`
      });
    }

    logger.info(`Blog post draft requested: topic="${topic}", audience=${audience}, length=${length}`);

    // Generate draft using BlogCuration service (includes boundary checks and validation)
    const result = await BlogCuration.draftBlogPost({
      topic,
      audience,
      length,
      focus
    });

    const { draft, validation, boundary_check, metadata } = result;

    // Log governance action
    await GovernanceLog.create({
      action: 'BLOG_POST_DRAFT',
      user_id: req.user._id,
      user_email: req.user.email,
      timestamp: new Date(),
      boundary_check,
      outcome: 'QUEUED_FOR_APPROVAL',
      details: {
        topic,
        audience,
        length,
        validation_result: validation.recommendation,
        violations: validation.violations.length,
        warnings: validation.warnings.length
      }
    });

    // Create moderation queue entry (human approval required)
    const queueEntry = await ModerationQueue.create({
      type: 'BLOG_POST_DRAFT',
      reference_collection: 'blog_posts',
      data: {
        topic,
        audience,
        length,
        focus,
        draft,
        validation,
        requested_by: req.user.email
      },
      status: 'PENDING_APPROVAL',
      ai_generated: true,
      requires_human_approval: true,
      created_by: req.user._id,
      created_at: new Date(),
      priority: validation.violations.length > 0 ? 'high' : 'medium',
      metadata: {
        boundary_check,
        governance_policy: 'TRA-OPS-0002',
        tractatus_instructions: ['inst_016', 'inst_017', 'inst_018'],
        model_info: metadata
      }
    });

    logger.info(`Created blog draft queue entry: ${queueEntry._id}, validation: ${validation.recommendation}`);

    // Return response
    res.json({
      success: true,
      message: 'Blog post draft generated. Awaiting human review and approval.',
      queue_id: queueEntry._id,
      draft,
      validation,
      governance: {
        policy: 'TRA-OPS-0002',
        boundary_check,
        requires_approval: true,
        tractatus_enforcement: {
          inst_016: 'No fabricated statistics or unverifiable claims',
          inst_017: 'No absolute assurance terms (guarantee, 100%, etc.)',
          inst_018: 'No unverified production-ready claims'
        }
      }
    });

  } catch (error) {
    logger.error('Draft blog post error:', error);

    // Handle boundary violations
    if (error.message.includes('Boundary violation')) {
      return res.status(403).json({
        error: 'Boundary Violation',
        message: error.message
      });
    }

    // Handle Claude API errors
    if (error.message.includes('Claude API') || error.message.includes('Blog draft generation failed')) {
      return res.status(502).json({
        error: 'AI Service Error',
        message: 'Failed to generate blog draft. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Analyze blog content for Tractatus compliance (admin only)
 * POST /api/blog/analyze-content
 *
 * Validates content against inst_016, inst_017, inst_018
 */
async function analyzeContent(req, res) {
  try {
    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'title and body are required'
      });
    }

    logger.info(`Content compliance analysis requested: "${title}"`);

    const analysis = await BlogCuration.analyzeContentCompliance({
      title,
      body
    });

    logger.info(`Compliance analysis complete: ${analysis.recommendation}, score: ${analysis.overall_score}`);

    res.json({
      success: true,
      analysis,
      tractatus_enforcement: {
        inst_016: 'No fabricated statistics',
        inst_017: 'No absolute guarantees',
        inst_018: 'No unverified production claims'
      }
    });

  } catch (error) {
    logger.error('Analyze content error:', error);

    if (error.message.includes('Claude API') || error.message.includes('Compliance analysis failed')) {
      return res.status(502).json({
        error: 'AI Service Error',
        message: 'Failed to analyze content. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Get editorial guidelines (admin only)
 * GET /api/blog/editorial-guidelines
 */
async function getEditorialGuidelines(req, res) {
  try {
    const guidelines = BlogCuration.getEditorialGuidelines();

    res.json({
      success: true,
      guidelines
    });

  } catch (error) {
    logger.error('Get editorial guidelines error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Generate RSS feed for published blog posts (public)
 * GET /api/blog/rss
 */
async function generateRSSFeed(req, res) {
  try {
    // Fetch recent published posts (limit to 50 most recent)
    const posts = await BlogPost.findPublished({
      limit: 50,
      skip: 0
    });

    // RSS 2.0 feed structure
    const baseUrl = process.env.FRONTEND_URL || 'https://agenticgovernance.digital';
    const buildDate = new Date().toUTCString();

    // Start RSS XML
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tractatus AI Safety Framework Blog</title>
    <link>${baseUrl}/blog.html</link>
    <description>Insights, updates, and analysis on AI governance, safety frameworks, and the Tractatus boundary enforcement approach.</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${baseUrl}/api/blog/rss" rel="self" type="application/rss+xml" />
    <image>
      <url>${baseUrl}/images/tractatus-icon.svg</url>
      <title>Tractatus AI Safety Framework</title>
      <link>${baseUrl}/blog.html</link>
    </image>
`;

    // Add items for each post
    for (const post of posts) {
      const postUrl = `${baseUrl}/blog-post.html?slug=${post.slug}`;
      const pubDate = new Date(post.published_at || post.created_at).toUTCString();
      const author = post.author_name || post.author?.name || 'Tractatus Team';

      // Strip HTML tags from excerpt for RSS description
      const description = (post.excerpt || post.content)
        .replace(/<[^>]*>/g, '')
        .substring(0, 500);

      // Tags as categories
      const categories = (post.tags || []).map(tag =>
        `      <category>${escapeXml(tag)}</category>`
      ).join('\n');

      rss += `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description>${escapeXml(description)}</description>
      <author>${escapeXml(author)}</author>
      <pubDate>${pubDate}</pubDate>
${categories ? categories + '\n' : ''}    </item>
`;
    }

    // Close RSS XML
    rss += `  </channel>
</rss>`;

    // Set RSS content-type and send
    res.set('Content-Type', 'application/rss+xml; charset=UTF-8');
    res.send(rss);

    logger.info(`RSS feed generated: ${posts.length} posts`);

  } catch (error) {
    logger.error('Generate RSS feed error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate RSS feed'
    });
  }
}

/**
 * Helper: Escape XML special characters
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  listPublishedPosts,
  getPublishedPost,
  listPostsByStatus,
  getPostById,
  createPost,
  updatePost,
  publishPost,
  deletePost,
  suggestTopics,
  draftBlogPost,
  analyzeContent,
  getEditorialGuidelines,
  generateRSSFeed
};
