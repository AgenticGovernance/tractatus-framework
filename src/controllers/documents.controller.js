/**
 * Documents Controller
 * Handles framework documentation CRUD operations
 */

const Document = require('../models/Document.model');
const { markdownToHtml, extractTOC } = require('../utils/markdown.util');
const logger = require('../utils/logger.util');

/**
 * List all documents
 * GET /api/documents
 */
async function listDocuments(req, res) {
  try {
    const { limit = 50, skip = 0, quadrant, audience } = req.query;

    let documents;
    let total;

    // Build filter - only show public documents (not internal/confidential)
    const filter = {
      $or: [
        { visibility: 'public' },
        { public: true, visibility: { $exists: false } } // Legacy support
      ]
    };
    if (quadrant) {
      filter.quadrant = quadrant;
    }
    if (audience) {
      filter.audience = audience;
    }

    if (quadrant && !audience) {
      documents = await Document.findByQuadrant(quadrant, {
        limit: parseInt(limit),
        skip: parseInt(skip),
        publicOnly: true
      });
      total = await Document.count(filter);
    } else if (audience && !quadrant) {
      documents = await Document.findByAudience(audience, {
        limit: parseInt(limit),
        skip: parseInt(skip),
        publicOnly: true
      });
      total = await Document.count(filter);
    } else {
      documents = await Document.list({
        limit: parseInt(limit),
        skip: parseInt(skip),
        filter
      });
      total = await Document.count(filter);
    }

    res.json({
      success: true,
      documents,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + documents.length < total
      }
    });

  } catch (error) {
    logger.error('List documents error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Get document by ID or slug
 * GET /api/documents/:identifier
 */
async function getDocument(req, res) {
  try {
    const { identifier } = req.params;

    // Try to find by ID first, then by slug
    let document;
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      document = await Document.findById(identifier);
    } else {
      document = await Document.findBySlug(identifier);
    }

    if (!document) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Document not found'
      });
    }

    res.json({
      success: true,
      document
    });

  } catch (error) {
    logger.error('Get document error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Search documents with faceted filtering
 * GET /api/documents/search?q=...&quadrant=...&persistence=...&audience=...
 */
async function searchDocuments(req, res) {
  try {
    const { q, quadrant, persistence, audience, limit = 20, skip = 0 } = req.query;

    // Build filter for faceted search
    const filter = {
      $or: [
        { visibility: 'public' },
        { public: true, visibility: { $exists: false } } // Legacy support
      ]
    };

    // Add facet filters
    if (quadrant) {
      filter.quadrant = quadrant.toUpperCase();
    }
    if (persistence) {
      filter.persistence = persistence.toUpperCase();
    }
    if (audience) {
      filter.audience = audience.toLowerCase();
    }

    let documents;

    // If text query provided, use full-text search with filters
    if (q && q.trim()) {
      const { getCollection } = require('../utils/db.util');
      const collection = await getCollection('documents');

      // Add text search to filter
      filter.$text = { $search: q };

      documents = await collection
        .find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .toArray();
    } else {
      // No text query - just filter by facets
      documents = await Document.list({
        filter,
        limit: parseInt(limit),
        skip: parseInt(skip),
        sort: { order: 1, 'metadata.date_created': -1 }
      });
    }

    // Count total matching documents
    const { getCollection } = require('../utils/db.util');
    const collection = await getCollection('documents');
    const total = await collection.countDocuments(filter);

    res.json({
      success: true,
      query: q || null,
      filters: {
        quadrant: quadrant || null,
        persistence: persistence || null,
        audience: audience || null
      },
      documents,
      count: documents.length,
      total,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + documents.length < total
      }
    });

  } catch (error) {
    logger.error('Search documents error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Create document (admin only)
 * POST /api/documents
 */
async function createDocument(req, res) {
  try {
    const { title, slug, quadrant, persistence, audience, content_markdown, metadata } = req.body;

    // Convert markdown to HTML
    const content_html = markdownToHtml(content_markdown);

    // Extract table of contents
    const toc = extractTOC(content_markdown);

    // Create search index from content
    const search_index = `${title} ${content_markdown}`.toLowerCase();

    const document = await Document.create({
      title,
      slug,
      quadrant,
      persistence,
      audience: audience || 'general',
      content_html,
      content_markdown,
      toc,
      metadata,
      search_index
    });

    logger.info(`Document created: ${slug} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      document
    });

  } catch (error) {
    logger.error('Create document error:', error);

    // Handle duplicate slug
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A document with this slug already exists'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Update document (admin only)
 * PUT /api/documents/:id
 */
async function updateDocument(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // If content_markdown is updated, regenerate HTML and TOC
    if (updates.content_markdown) {
      updates.content_html = markdownToHtml(updates.content_markdown);
      updates.toc = extractTOC(updates.content_markdown);
      updates.search_index = `${updates.title || ''} ${updates.content_markdown}`.toLowerCase();
    }

    const success = await Document.update(id, updates);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Document not found'
      });
    }

    const document = await Document.findById(id);

    logger.info(`Document updated: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      document
    });

  } catch (error) {
    logger.error('Update document error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Delete document (admin only)
 * DELETE /api/documents/:id
 */
async function deleteDocument(req, res) {
  try {
    const { id } = req.params;

    const success = await Document.delete(id);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Document not found'
      });
    }

    logger.info(`Document deleted: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    logger.error('Delete document error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * List archived documents
 * GET /api/documents/archived
 */
async function listArchivedDocuments(req, res) {
  try {
    const { limit = 50, skip = 0 } = req.query;

    const documents = await Document.listArchived({
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    const total = await Document.count({ visibility: 'archived' });

    res.json({
      success: true,
      documents,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + documents.length < total
      }
    });

  } catch (error) {
    logger.error('List archived documents error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

module.exports = {
  listDocuments,
  getDocument,
  searchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  listArchivedDocuments
};
