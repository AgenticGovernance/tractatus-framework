/**
 * GovernanceLog Model
 * Audit trail for Tractatus governance actions
 */

const { ObjectId } = require('mongodb');
const { getCollection } = require('../utils/db.util');

class GovernanceLog {
  /**
   * Create governance log entry
   */
  static async create(data) {
    const collection = await getCollection('governance_logs');

    const log = {
      action: data.action, // BLOG_TOPIC_SUGGESTION, MEDIA_TRIAGE, etc.
      user_id: data.user_id ? new ObjectId(data.user_id) : null,
      user_email: data.user_email,
      timestamp: data.timestamp || new Date(),

      // Tractatus governance data
      quadrant: data.quadrant || null, // STR/OPS/TAC/SYS/STO
      boundary_check: data.boundary_check || null, // BoundaryEnforcer result
      cross_reference: data.cross_reference || null, // CrossReferenceValidator result
      pressure_level: data.pressure_level || null, // ContextPressureMonitor result

      outcome: data.outcome, // ALLOWED/BLOCKED/QUEUED_FOR_APPROVAL

      // Action details
      details: data.details || {},

      // If action was blocked
      blocked_reason: data.blocked_reason || null,
      blocked_section: data.blocked_section || null,

      // Metadata
      service: data.service || 'unknown',
      environment: process.env.NODE_ENV || 'production',
      ip_address: data.ip_address || null,

      created_at: new Date()
    };

    const result = await collection.insertOne(log);
    return { ...log, _id: result.insertedId };
  }

  /**
   * Find logs by action type
   */
  static async findByAction(action, options = {}) {
    const collection = await getCollection('governance_logs');
    const { limit = 50, skip = 0, startDate, endDate } = options;

    const filter = { action };

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    return await collection
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find logs by user
   */
  static async findByUser(userId, options = {}) {
    const collection = await getCollection('governance_logs');
    const { limit = 50, skip = 0 } = options;

    return await collection
      .find({ user_id: new ObjectId(userId) })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find blocked actions
   */
  static async findBlocked(options = {}) {
    const collection = await getCollection('governance_logs');
    const { limit = 50, skip = 0 } = options;

    return await collection
      .find({ outcome: 'BLOCKED' })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find by outcome
   */
  static async findByOutcome(outcome, options = {}) {
    const collection = await getCollection('governance_logs');
    const { limit = 50, skip = 0 } = options;

    return await collection
      .find({ outcome })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find by quadrant
   */
  static async findByQuadrant(quadrant, options = {}) {
    const collection = await getCollection('governance_logs');
    const { limit = 50, skip = 0 } = options;

    return await collection
      .find({ quadrant })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Get statistics
   */
  static async getStatistics(startDate, endDate) {
    const collection = await getCollection('governance_logs');

    const filter = {};
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const [totalLogs] = await collection.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          allowed: {
            $sum: { $cond: [{ $eq: ['$outcome', 'ALLOWED'] }, 1, 0] }
          },
          blocked: {
            $sum: { $cond: [{ $eq: ['$outcome', 'BLOCKED'] }, 1, 0] }
          },
          queued: {
            $sum: { $cond: [{ $eq: ['$outcome', 'QUEUED_FOR_APPROVAL'] }, 1, 0] }
          }
        }
      }
    ]).toArray();

    const byQuadrant = await collection.aggregate([
      { $match: { ...filter, quadrant: { $ne: null } } },
      {
        $group: {
          _id: '$quadrant',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const byAction = await collection.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    return {
      summary: totalLogs[0] || {
        total: 0,
        allowed: 0,
        blocked: 0,
        queued: 0
      },
      by_quadrant: byQuadrant,
      top_actions: byAction
    };
  }

  /**
   * Delete old logs (retention policy)
   * @param {number} days - Keep logs newer than this many days
   */
  static async deleteOldLogs(days = 90) {
    const collection = await getCollection('governance_logs');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await collection.deleteMany({
      created_at: { $lt: cutoffDate }
    });

    return result.deletedCount;
  }
}

module.exports = GovernanceLog;
