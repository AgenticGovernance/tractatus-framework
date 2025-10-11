/**
 * Document Model
 * Technical papers, framework documentation, specifications
 */

const { ObjectId } = require('mongodb');
const { getCollection } = require('../utils/db.util');

class Document {
  /**
   * Create a new document
   */
  static async create(data) {
    const collection = await getCollection('documents');

    const document = {
      title: data.title,
      slug: data.slug,
      quadrant: data.quadrant, // STR/OPS/TAC/SYS/STO
      persistence: data.persistence, // HIGH/MEDIUM/LOW/VARIABLE
      audience: data.audience || 'general', // technical, general, researcher, implementer, advocate, business, developer
      visibility: data.visibility || 'public', // public, internal, confidential, archived
      category: data.category || 'none', // conceptual, practical, reference, archived, project-tracking, research-proposal, research-topic
      order: data.order || 999, // Display order (1-999, lower = higher priority)
      archiveNote: data.archiveNote || null, // Explanation for why document was archived
      content_html: data.content_html,
      content_markdown: data.content_markdown,
      toc: data.toc || [],
      public: data.public !== undefined ? data.public : true, // Deprecated - use visibility instead
      security_classification: data.security_classification || {
        contains_credentials: false,
        contains_financial_info: false,
        contains_vulnerability_info: false,
        contains_infrastructure_details: false,
        requires_authentication: false
      },
      metadata: {
        author: data.metadata?.author || 'John Stroh',
        date_created: new Date(),
        date_updated: new Date(),
        version: data.metadata?.version || '1.0',
        document_code: data.metadata?.document_code,
        related_documents: data.metadata?.related_documents || [],
        tags: data.metadata?.tags || []
      },
      translations: data.translations || {},
      search_index: data.search_index || '',
      download_formats: data.download_formats || {}
    };

    const result = await collection.insertOne(document);
    return { ...document, _id: result.insertedId };
  }

  /**
   * Find document by ID
   */
  static async findById(id) {
    const collection = await getCollection('documents');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Find document by slug
   */
  static async findBySlug(slug) {
    const collection = await getCollection('documents');
    return await collection.findOne({ slug });
  }

  /**
   * Find documents by quadrant
   */
  static async findByQuadrant(quadrant, options = {}) {
    const collection = await getCollection('documents');
    const { limit = 50, skip = 0, sort = { 'metadata.date_created': -1 }, publicOnly = false } = options;

    const filter = { quadrant };
    if (publicOnly) {
      filter.public = true;
    }

    return await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find documents by audience
   */
  static async findByAudience(audience, options = {}) {
    const collection = await getCollection('documents');
    const { limit = 50, skip = 0, sort = { 'metadata.date_created': -1 }, publicOnly = false } = options;

    const filter = { audience };
    if (publicOnly) {
      filter.public = true;
    }

    return await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Search documents
   */
  static async search(query, options = {}) {
    const collection = await getCollection('documents');
    const { limit = 20, skip = 0, publicOnly = false } = options;

    const filter = { $text: { $search: query } };
    if (publicOnly) {
      filter.public = true;
    }

    return await collection
      .find(
        filter,
        { score: { $meta: 'textScore' } }
      )
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Update document
   */
  static async update(id, updates) {
    const collection = await getCollection('documents');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updates,
          'metadata.date_updated': new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Delete document
   */
  static async delete(id) {
    const collection = await getCollection('documents');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  /**
   * List all documents
   */
  static async list(options = {}) {
    const collection = await getCollection('documents');
    const { limit = 50, skip = 0, sort = { order: 1, 'metadata.date_created': -1 }, filter = {} } = options;

    return await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * List archived documents
   */
  static async listArchived(options = {}) {
    const collection = await getCollection('documents');
    const { limit = 50, skip = 0, sort = { 'metadata.date_created': -1 } } = options;

    return await collection
      .find({ visibility: 'archived' })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Count documents
   */
  static async count(filter = {}) {
    const collection = await getCollection('documents');
    return await collection.countDocuments(filter);
  }
}

module.exports = Document;
