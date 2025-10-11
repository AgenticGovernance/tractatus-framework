/**
 * BlogPost Model
 * AI-curated blog with human oversight
 */

const { ObjectId } = require('mongodb');
const { getCollection } = require('../utils/db.util');

class BlogPost {
  /**
   * Create a new blog post
   */
  static async create(data) {
    const collection = await getCollection('blog_posts');

    const post = {
      title: data.title,
      slug: data.slug,
      author: {
        type: data.author?.type || 'human', // 'human' or 'ai_curated'
        name: data.author?.name || 'John Stroh',
        claude_version: data.author?.claude_version
      },
      content: data.content,
      excerpt: data.excerpt,
      featured_image: data.featured_image,
      status: data.status || 'draft', // draft/pending/published/archived
      moderation: {
        ai_analysis: data.moderation?.ai_analysis,
        human_reviewer: data.moderation?.human_reviewer,
        review_notes: data.moderation?.review_notes,
        approved_at: data.moderation?.approved_at
      },
      tractatus_classification: {
        quadrant: data.tractatus_classification?.quadrant || 'OPERATIONAL',
        values_sensitive: data.tractatus_classification?.values_sensitive || false,
        requires_strategic_review: data.tractatus_classification?.requires_strategic_review || false
      },
      published_at: data.published_at,
      tags: data.tags || [],
      view_count: 0,
      engagement: {
        shares: 0,
        comments: 0
      }
    };

    const result = await collection.insertOne(post);
    return { ...post, _id: result.insertedId };
  }

  /**
   * Find post by ID
   */
  static async findById(id) {
    const collection = await getCollection('blog_posts');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Find post by slug
   */
  static async findBySlug(slug) {
    const collection = await getCollection('blog_posts');
    return await collection.findOne({ slug });
  }

  /**
   * Find published posts
   */
  static async findPublished(options = {}) {
    const collection = await getCollection('blog_posts');
    const { limit = 10, skip = 0, sort = { published_at: -1 } } = options;

    return await collection
      .find({ status: 'published' })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find posts by status
   */
  static async findByStatus(status, options = {}) {
    const collection = await getCollection('blog_posts');
    const { limit = 20, skip = 0 } = options;

    return await collection
      .find({ status })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Update post
   */
  static async update(id, updates) {
    const collection = await getCollection('blog_posts');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Publish post (change status + set published_at)
   */
  static async publish(id, reviewerId) {
    const collection = await getCollection('blog_posts');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'published',
          published_at: new Date(),
          'moderation.human_reviewer': reviewerId,
          'moderation.approved_at': new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Increment view count
   */
  static async incrementViews(id) {
    const collection = await getCollection('blog_posts');

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { view_count: 1 } }
    );
  }

  /**
   * Delete post
   */
  static async delete(id) {
    const collection = await getCollection('blog_posts');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  /**
   * Count posts by status
   */
  static async countByStatus(status) {
    const collection = await getCollection('blog_posts');
    return await collection.countDocuments({ status });
  }
}

module.exports = BlogPost;
