/**
 * CaseSubmission Model
 * Community case study submissions
 */

const { ObjectId } = require('mongodb');
const { getCollection } = require('../utils/db.util');

class CaseSubmission {
  /**
   * Create a new case submission
   */
  static async create(data) {
    const collection = await getCollection('case_submissions');

    const submission = {
      submitter: {
        name: data.submitter.name,
        email: data.submitter.email,
        organization: data.submitter.organization,
        public: data.submitter.public !== undefined ? data.submitter.public : false
      },
      case_study: {
        title: data.case_study.title,
        description: data.case_study.description,
        failure_mode: data.case_study.failure_mode,
        tractatus_applicability: data.case_study.tractatus_applicability,
        evidence: data.case_study.evidence || [],
        attachments: data.case_study.attachments || []
      },
      ai_review: {
        relevance_score: data.ai_review?.relevance_score, // 0-1
        completeness_score: data.ai_review?.completeness_score, // 0-1
        recommended_category: data.ai_review?.recommended_category,
        suggested_improvements: data.ai_review?.suggested_improvements || [],
        claude_analysis: data.ai_review?.claude_analysis
      },
      moderation: {
        status: data.moderation?.status || 'pending', // pending/approved/rejected/needs_info
        reviewer: data.moderation?.reviewer,
        review_notes: data.moderation?.review_notes,
        reviewed_at: data.moderation?.reviewed_at
      },
      published_case_id: data.published_case_id,
      submitted_at: new Date()
    };

    const result = await collection.insertOne(submission);
    return { ...submission, _id: result.insertedId };
  }

  /**
   * Find submission by ID
   */
  static async findById(id) {
    const collection = await getCollection('case_submissions');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Find by moderation status
   */
  static async findByStatus(status, options = {}) {
    const collection = await getCollection('case_submissions');
    const { limit = 20, skip = 0 } = options;

    return await collection
      .find({ 'moderation.status': status })
      .sort({ submitted_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find high-relevance submissions pending review
   */
  static async findHighRelevance(options = {}) {
    const collection = await getCollection('case_submissions');
    const { limit = 10 } = options;

    return await collection
      .find({
        'moderation.status': 'pending',
        'ai_review.relevance_score': { $gte: 0.7 }
      })
      .sort({ 'ai_review.relevance_score': -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Update submission
   */
  static async update(id, updates) {
    const collection = await getCollection('case_submissions');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Approve submission
   */
  static async approve(id, reviewerId, notes = '') {
    const collection = await getCollection('case_submissions');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          'moderation.status': 'approved',
          'moderation.reviewer': reviewerId,
          'moderation.review_notes': notes,
          'moderation.reviewed_at': new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Reject submission
   */
  static async reject(id, reviewerId, reason) {
    const collection = await getCollection('case_submissions');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          'moderation.status': 'rejected',
          'moderation.reviewer': reviewerId,
          'moderation.review_notes': reason,
          'moderation.reviewed_at': new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Request more information
   */
  static async requestInfo(id, reviewerId, requestedInfo) {
    const collection = await getCollection('case_submissions');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          'moderation.status': 'needs_info',
          'moderation.reviewer': reviewerId,
          'moderation.review_notes': requestedInfo,
          'moderation.reviewed_at': new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Link to published case study
   */
  static async linkPublished(id, publishedCaseId) {
    const collection = await getCollection('case_submissions');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          published_case_id: new ObjectId(publishedCaseId),
          'moderation.status': 'approved'
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Count by status
   */
  static async countByStatus(status) {
    const collection = await getCollection('case_submissions');
    return await collection.countDocuments({ 'moderation.status': status });
  }

  /**
   * Delete submission
   */
  static async delete(id) {
    const collection = await getCollection('case_submissions');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }
}

module.exports = CaseSubmission;
