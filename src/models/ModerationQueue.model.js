/**
 * ModerationQueue Model
 * Human oversight queue for AI actions
 */

const { ObjectId } = require('mongodb');
const { getCollection } = require('../utils/db.util');

class ModerationQueue {
  /**
   * Add item to moderation queue
   */
  static async create(data) {
    const collection = await getCollection('moderation_queue');

    const item = {
      // Type of moderation (NEW flexible field)
      type: data.type, // BLOG_TOPIC_SUGGESTION/MEDIA_INQUIRY/CASE_STUDY/etc.

      // Reference to specific item (optional - not needed for suggestions)
      reference_collection: data.reference_collection || null, // blog_posts/media_inquiries/etc.
      reference_id: data.reference_id ? new ObjectId(data.reference_id) : null,

      // Tractatus quadrant
      quadrant: data.quadrant || null, // STR/OPS/TAC/SYS/STO

      // AI action data (flexible object)
      data: data.data || {}, // Flexible data field for AI outputs

      // AI metadata
      ai_generated: data.ai_generated || false,
      ai_version: data.ai_version || 'claude-sonnet-4-5',

      // Human oversight
      requires_human_approval: data.requires_human_approval || true,
      human_required_reason: data.human_required_reason || 'AI-generated content requires human review',

      // Priority and assignment
      priority: data.priority || 'medium', // high/medium/low
      assigned_to: data.assigned_to || null,

      // Status tracking
      status: data.status || 'PENDING_APPROVAL', // PENDING_APPROVAL/APPROVED/REJECTED
      created_at: data.created_at || new Date(),
      created_by: data.created_by ? new ObjectId(data.created_by) : null,
      reviewed_at: null,

      // Review decision
      review_decision: {
        action: null, // approve/reject/modify/escalate
        notes: null,
        reviewer: null
      },

      // Metadata
      metadata: data.metadata || {},

      // Legacy fields for backwards compatibility
      item_type: data.item_type || null,
      item_id: data.item_id ? new ObjectId(data.item_id) : null
    };

    const result = await collection.insertOne(item);
    return { ...item, _id: result.insertedId };
  }

  /**
   * Find item by ID
   */
  static async findById(id) {
    const collection = await getCollection('moderation_queue');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Find pending items
   */
  static async findPending(options = {}) {
    const collection = await getCollection('moderation_queue');
    const { limit = 20, skip = 0, priority } = options;

    const filter = { status: 'pending' };
    if (priority) filter.priority = priority;

    return await collection
      .find(filter)
      .sort({
        priority: -1, // high first
        created_at: 1  // oldest first
      })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find by item type
   */
  static async findByType(itemType, options = {}) {
    const collection = await getCollection('moderation_queue');
    const { limit = 20, skip = 0 } = options;

    return await collection
      .find({ item_type: itemType, status: 'pending' })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find by quadrant
   */
  static async findByQuadrant(quadrant, options = {}) {
    const collection = await getCollection('moderation_queue');
    const { limit = 20, skip = 0 } = options;

    return await collection
      .find({ quadrant, status: 'pending' })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Review item (approve/reject/modify/escalate)
   */
  static async review(id, decision) {
    const collection = await getCollection('moderation_queue');

    // Map action to status
    const statusMap = {
      'approve': 'approved',
      'reject': 'rejected',
      'escalate': 'escalated'
    };
    const status = statusMap[decision.action] || 'reviewed';

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: status,
          reviewed_at: new Date(),
          'review_decision.action': decision.action,
          'review_decision.notes': decision.notes,
          'review_decision.reviewer': decision.reviewer
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Approve item
   */
  static async approve(id, reviewerId, notes = '') {
    return await this.review(id, {
      action: 'approve',
      notes,
      reviewer: reviewerId
    });
  }

  /**
   * Reject item
   */
  static async reject(id, reviewerId, notes) {
    return await this.review(id, {
      action: 'reject',
      notes,
      reviewer: reviewerId
    });
  }

  /**
   * Escalate to strategic review
   */
  static async escalate(id, reviewerId, reason) {
    const collection = await getCollection('moderation_queue');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          quadrant: 'STRATEGIC',
          priority: 'high',
          human_required_reason: `ESCALATED: ${reason}`,
          'review_decision.action': 'escalate',
          'review_decision.notes': reason,
          'review_decision.reviewer': reviewerId
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Count pending items
   */
  static async countPending(filter = {}) {
    const collection = await getCollection('moderation_queue');
    return await collection.countDocuments({
      ...filter,
      status: 'pending'
    });
  }

  /**
   * Get stats by quadrant
   */
  static async getStatsByQuadrant() {
    const collection = await getCollection('moderation_queue');

    return await collection.aggregate([
      { $match: { status: 'pending' } },
      {
        $group: {
          _id: '$quadrant',
          count: { $sum: 1 },
          high_priority: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          }
        }
      }
    ]).toArray();
  }

  /**
   * Delete item
   */
  static async delete(id) {
    const collection = await getCollection('moderation_queue');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }
}

module.exports = ModerationQueue;
