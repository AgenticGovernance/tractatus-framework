/**
 * Resource Model
 * Curated directory of aligned resources
 */

const { ObjectId } = require('mongodb');
const { getCollection } = require('../utils/db.util');

class Resource {
  /**
   * Create a new resource
   */
  static async create(data) {
    const collection = await getCollection('resources');

    const resource = {
      url: data.url,
      title: data.title,
      description: data.description,
      category: data.category, // framework/tool/research/organization/educational
      subcategory: data.subcategory,
      alignment_score: data.alignment_score, // 0-1 alignment with Tractatus values
      ai_analysis: {
        summary: data.ai_analysis?.summary,
        relevance: data.ai_analysis?.relevance,
        quality_indicators: data.ai_analysis?.quality_indicators || [],
        concerns: data.ai_analysis?.concerns || [],
        claude_reasoning: data.ai_analysis?.claude_reasoning
      },
      status: data.status || 'pending', // pending/approved/rejected
      reviewed_by: data.reviewed_by,
      reviewed_at: data.reviewed_at,
      tags: data.tags || [],
      featured: data.featured || false,
      added_at: new Date(),
      last_checked: new Date()
    };

    const result = await collection.insertOne(resource);
    return { ...resource, _id: result.insertedId };
  }

  /**
   * Find resource by ID
   */
  static async findById(id) {
    const collection = await getCollection('resources');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Find resource by URL
   */
  static async findByUrl(url) {
    const collection = await getCollection('resources');
    return await collection.findOne({ url });
  }

  /**
   * Find approved resources
   */
  static async findApproved(options = {}) {
    const collection = await getCollection('resources');
    const { limit = 50, skip = 0, category } = options;

    const filter = { status: 'approved' };
    if (category) filter.category = category;

    return await collection
      .find(filter)
      .sort({ alignment_score: -1, added_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find featured resources
   */
  static async findFeatured(options = {}) {
    const collection = await getCollection('resources');
    const { limit = 10 } = options;

    return await collection
      .find({ status: 'approved', featured: true })
      .sort({ alignment_score: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Find by category
   */
  static async findByCategory(category, options = {}) {
    const collection = await getCollection('resources');
    const { limit = 30, skip = 0 } = options;

    return await collection
      .find({ category, status: 'approved' })
      .sort({ alignment_score: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find high-alignment pending resources
   */
  static async findHighAlignment(options = {}) {
    const collection = await getCollection('resources');
    const { limit = 10 } = options;

    return await collection
      .find({
        status: 'pending',
        alignment_score: { $gte: 0.8 }
      })
      .sort({ alignment_score: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Update resource
   */
  static async update(id, updates) {
    const collection = await getCollection('resources');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Approve resource
   */
  static async approve(id, reviewerId) {
    const collection = await getCollection('resources');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Reject resource
   */
  static async reject(id, reviewerId) {
    const collection = await getCollection('resources');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Mark as featured
   */
  static async setFeatured(id, featured = true) {
    const collection = await getCollection('resources');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { featured } }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Update last checked timestamp
   */
  static async updateLastChecked(id) {
    const collection = await getCollection('resources');

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { last_checked: new Date() } }
    );
  }

  /**
   * Count by status
   */
  static async countByStatus(status) {
    const collection = await getCollection('resources');
    return await collection.countDocuments({ status });
  }

  /**
   * Delete resource
   */
  static async delete(id) {
    const collection = await getCollection('resources');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }
}

module.exports = Resource;
