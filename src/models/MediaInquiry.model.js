/**
 * MediaInquiry Model
 * Press/media inquiries with AI triage
 */

const { ObjectId } = require('mongodb');
const { getCollection } = require('../utils/db.util');

class MediaInquiry {
  /**
   * Create a new media inquiry
   */
  static async create(data) {
    const collection = await getCollection('media_inquiries');

    const inquiry = {
      contact: {
        name: data.contact.name,
        email: data.contact.email,
        outlet: data.contact.outlet,
        phone: data.contact.phone
      },
      inquiry: {
        subject: data.inquiry.subject,
        message: data.inquiry.message,
        deadline: data.inquiry.deadline ? new Date(data.inquiry.deadline) : null,
        topic_areas: data.inquiry.topic_areas || []
      },
      ai_triage: {
        urgency: data.ai_triage?.urgency, // high/medium/low
        topic_sensitivity: data.ai_triage?.topic_sensitivity,
        suggested_response_time: data.ai_triage?.suggested_response_time,
        involves_values: data.ai_triage?.involves_values || false,
        claude_summary: data.ai_triage?.claude_summary,
        suggested_talking_points: data.ai_triage?.suggested_talking_points || []
      },
      status: data.status || 'new', // new/triaged/responded/closed
      assigned_to: data.assigned_to,
      response: {
        sent_at: data.response?.sent_at,
        content: data.response?.content,
        responder: data.response?.responder
      },
      created_at: new Date()
    };

    const result = await collection.insertOne(inquiry);
    return { ...inquiry, _id: result.insertedId };
  }

  /**
   * Find inquiry by ID
   */
  static async findById(id) {
    const collection = await getCollection('media_inquiries');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Find inquiries by status
   */
  static async findByStatus(status, options = {}) {
    const collection = await getCollection('media_inquiries');
    const { limit = 20, skip = 0 } = options;

    return await collection
      .find({ status })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Find high urgency inquiries
   */
  static async findUrgent(options = {}) {
    const collection = await getCollection('media_inquiries');
    const { limit = 10 } = options;

    return await collection
      .find({
        'ai_triage.urgency': 'high',
        status: { $in: ['new', 'triaged'] }
      })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Update inquiry
   */
  static async update(id, updates) {
    const collection = await getCollection('media_inquiries');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Assign inquiry to user
   */
  static async assign(id, userId) {
    const collection = await getCollection('media_inquiries');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          assigned_to: new ObjectId(userId),
          status: 'triaged'
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Mark as responded
   */
  static async respond(id, responseData) {
    const collection = await getCollection('media_inquiries');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'responded',
          'response.sent_at': new Date(),
          'response.content': responseData.content,
          'response.responder': responseData.responder
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Count by status
   */
  static async countByStatus(status) {
    const collection = await getCollection('media_inquiries');
    return await collection.countDocuments({ status });
  }

  /**
   * Delete inquiry
   */
  static async delete(id) {
    const collection = await getCollection('media_inquiries');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }
}

module.exports = MediaInquiry;
