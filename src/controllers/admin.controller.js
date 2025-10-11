/**
 * Admin Controller
 * Moderation queue and system statistics
 */

const ModerationQueue = require('../models/ModerationQueue.model');
const Document = require('../models/Document.model');
const BlogPost = require('../models/BlogPost.model');
const User = require('../models/User.model');
const logger = require('../utils/logger.util');

/**
 * Get moderation queue dashboard
 * GET /api/admin/moderation
 */
async function getModerationQueue(req, res) {
  try {
    const { limit = 20, skip = 0, priority, quadrant, item_type, type } = req.query;

    let items;
    let total;

    // Support both new 'type' and legacy 'item_type' fields
    // Treat 'all' as no filter (same as not providing a type)
    const filterType = (type && type !== 'all') ? type : (item_type && item_type !== 'all' ? item_type : null);

    if (quadrant) {
      items = await ModerationQueue.findByQuadrant(quadrant, {
        limit: parseInt(limit),
        skip: parseInt(skip)
      });
      total = await ModerationQueue.countPending({ quadrant });
    } else if (filterType) {
      // Filter by new 'type' field (preferred) or legacy 'item_type' field
      const collection = await require('../utils/db.util').getCollection('moderation_queue');
      items = await collection
        .find({
          status: 'pending',
          $or: [
            { type: filterType },
            { item_type: filterType }
          ]
        })
        .sort({ priority: -1, created_at: 1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .toArray();

      total = await collection.countDocuments({
        status: 'pending',
        $or: [
          { type: filterType },
          { item_type: filterType }
        ]
      });
    } else {
      items = await ModerationQueue.findPending({
        limit: parseInt(limit),
        skip: parseInt(skip),
        priority
      });
      total = await ModerationQueue.countPending(priority ? { priority } : {});
    }

    // Get stats by quadrant
    const stats = await ModerationQueue.getStatsByQuadrant();

    res.json({
      success: true,
      items,
      queue: items, // Alias for backward compatibility
      stats: stats.reduce((acc, stat) => {
        acc[stat._id] = {
          total: stat.count,
          high_priority: stat.high_priority
        };
        return acc;
      }, {}),
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });

  } catch (error) {
    logger.error('Get moderation queue error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Get single moderation item
 * GET /api/admin/moderation/:id
 */
async function getModerationItem(req, res) {
  try {
    const { id } = req.params;

    const item = await ModerationQueue.findById(id);

    if (!item) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Moderation item not found'
      });
    }

    res.json({
      success: true,
      item
    });

  } catch (error) {
    logger.error('Get moderation item error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Review moderation item (approve/reject/escalate)
 * POST /api/admin/moderation/:id/review
 */
async function reviewModerationItem(req, res) {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;

    const item = await ModerationQueue.findById(id);

    if (!item) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Moderation item not found'
      });
    }

    let success;
    let createdPost = null;

    switch (action) {
      case 'approve':
        success = await ModerationQueue.approve(id, req.userId, notes);

        // Blog-specific handling: Create BlogPost from approved draft
        if (success && item.type === 'BLOG_POST_DRAFT' && item.data?.draft) {
          try {
            const draft = item.data.draft;
            const slug = generateSlug(draft.title);

            // Create and publish blog post
            createdPost = await BlogPost.create({
              title: draft.title,
              slug,
              content: draft.content,
              excerpt: draft.excerpt,
              tags: draft.tags || [],
              author: {
                type: 'ai_curated',
                name: req.user.name || req.user.email,
                claude_version: item.metadata?.model_info?.model || 'claude-3-5-sonnet'
              },
              author_name: req.user.name || req.user.email, // Flattened for frontend
              ai_assisted: true, // Flag for AI disclosure
              tractatus_classification: {
                quadrant: item.quadrant || 'OPERATIONAL',
                values_sensitive: false,
                requires_strategic_review: false
              },
              moderation: {
                ai_analysis: item.data.validation,
                human_reviewer: req.userId,
                review_notes: notes,
                approved_at: new Date()
              },
              status: 'published',
              published_at: new Date()
            });

            // Log governance action
            const GovernanceLog = require('../models/GovernanceLog.model');
            await GovernanceLog.create({
              action: 'BLOG_POST_PUBLISHED',
              user_id: req.userId,
              user_email: req.user.email,
              timestamp: new Date(),
              outcome: 'APPROVED',
              details: {
                post_id: createdPost._id,
                slug,
                title: draft.title,
                queue_id: id,
                validation_result: item.data.validation?.recommendation
              }
            });

            logger.info(`Blog post created from approved draft: ${createdPost._id} (${slug}) by ${req.user.email}`);
          } catch (blogError) {
            logger.error('Failed to create blog post from approved draft:', blogError);
            // Don't fail the entire approval if blog creation fails
          }
        }
        break;
      case 'reject':
        success = await ModerationQueue.reject(id, req.userId, notes);
        break;
      case 'escalate':
        success = await ModerationQueue.escalate(id, req.userId, notes);
        break;
      default:
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid action. Must be: approve, reject, or escalate'
        });
    }

    if (!success) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update moderation item'
      });
    }

    const updatedItem = await ModerationQueue.findById(id);

    logger.info(`Moderation item ${action}: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      item: updatedItem,
      message: `Item ${action}d successfully`,
      blog_post: createdPost ? {
        id: createdPost._id,
        slug: createdPost.slug,
        title: createdPost.title,
        url: `/blog-post.html?slug=${createdPost.slug}`
      } : undefined
    });

  } catch (error) {
    logger.error('Review moderation item error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/**
 * Get system statistics
 * GET /api/admin/stats
 */
async function getSystemStats(req, res) {
  try {
    // Document stats
    const totalDocuments = await Document.count();
    const documentsByQuadrant = await Promise.all([
      Document.count({ quadrant: 'STRATEGIC' }),
      Document.count({ quadrant: 'OPERATIONAL' }),
      Document.count({ quadrant: 'TACTICAL' }),
      Document.count({ quadrant: 'SYSTEM' }),
      Document.count({ quadrant: 'STOCHASTIC' })
    ]);

    // Blog stats
    const blogStats = await Promise.all([
      BlogPost.countByStatus('published'),
      BlogPost.countByStatus('draft'),
      BlogPost.countByStatus('pending')
    ]);

    // Moderation queue stats
    const moderationStats = await ModerationQueue.getStatsByQuadrant();
    const totalPending = await ModerationQueue.countPending();

    // User stats
    const totalUsers = await User.count();
    const activeUsers = await User.count({ active: true });

    res.json({
      success: true,
      stats: {
        documents: {
          total: totalDocuments,
          by_quadrant: {
            STRATEGIC: documentsByQuadrant[0],
            OPERATIONAL: documentsByQuadrant[1],
            TACTICAL: documentsByQuadrant[2],
            SYSTEM: documentsByQuadrant[3],
            STOCHASTIC: documentsByQuadrant[4]
          }
        },
        blog: {
          published: blogStats[0],
          draft: blogStats[1],
          pending: blogStats[2],
          total: blogStats[0] + blogStats[1] + blogStats[2]
        },
        moderation: {
          total_pending: totalPending,
          by_quadrant: moderationStats.reduce((acc, stat) => {
            acc[stat._id] = {
              total: stat.count,
              high_priority: stat.high_priority
            };
            return acc;
          }, {})
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers
        }
      }
    });

  } catch (error) {
    logger.error('Get system stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Get recent activity log
 * GET /api/admin/activity
 */
async function getActivityLog(req, res) {
  try {
    // This would typically read from a dedicated activity log
    // For now, return recent moderation reviews as example
    const { limit = 50 } = req.query;

    const collection = await require('../utils/db.util').getCollection('moderation_queue');

    const recentActivity = await collection
      .find({ status: 'reviewed' })
      .sort({ reviewed_at: -1 })
      .limit(parseInt(limit))
      .toArray();

    res.json({
      success: true,
      activity: recentActivity.map(item => ({
        timestamp: item.reviewed_at,
        action: item.review_decision?.action,
        item_type: item.item_type,
        item_id: item.item_id,
        reviewer: item.review_decision?.reviewer,
        notes: item.review_decision?.notes
      }))
    });

  } catch (error) {
    logger.error('Get activity log error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

module.exports = {
  getModerationQueue,
  getModerationItem,
  reviewModerationItem,
  getSystemStats,
  getActivityLog
};
