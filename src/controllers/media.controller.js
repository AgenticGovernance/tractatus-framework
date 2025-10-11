/**
 * Media Inquiry Controller
 * Press/media inquiry submission and AI triage
 */

const MediaInquiry = require('../models/MediaInquiry.model');
const ModerationQueue = require('../models/ModerationQueue.model');
const GovernanceLog = require('../models/GovernanceLog.model');
const BoundaryEnforcer = require('../services/BoundaryEnforcer.service');
const MediaTriageService = require('../services/MediaTriage.service');
const logger = require('../utils/logger.util');

/**
 * Submit media inquiry (public)
 * POST /api/media/inquiries
 *
 * Phase 1: Manual triage (no AI)
 * Phase 2: Add AI triage with claudeAPI.triageMediaInquiry()
 */
async function submitInquiry(req, res) {
  try {
    const { contact, inquiry } = req.body;

    // Validate required fields
    if (!contact?.name || !contact?.email || !contact?.outlet) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required contact information'
      });
    }

    if (!inquiry?.subject || !inquiry?.message) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required inquiry information'
      });
    }

    logger.info(`Media inquiry submitted: ${contact.outlet} - ${inquiry.subject}`);

    // Create inquiry (Phase 1: no AI triage yet)
    const mediaInquiry = await MediaInquiry.create({
      contact,
      inquiry,
      status: 'new',
      ai_triage: {
        urgency: 'medium', // Default, will be AI-assessed in Phase 2
        topic_sensitivity: 'standard',
        involves_values: false
      }
    });

    // Add to moderation queue for human review
    await ModerationQueue.create({
      type: 'MEDIA_INQUIRY',
      reference_collection: 'media_inquiries',
      reference_id: mediaInquiry._id,
      quadrant: 'OPERATIONAL',
      data: {
        contact,
        inquiry
      },
      priority: 'medium',
      status: 'PENDING_APPROVAL',
      requires_human_approval: true,
      human_required_reason: 'All media inquiries require human review and response'
    });

    logger.info(`Media inquiry created: ${mediaInquiry._id}`);

    res.status(201).json({
      success: true,
      message: 'Thank you for your inquiry. We will review and respond shortly.',
      inquiry_id: mediaInquiry._id,
      governance: {
        human_review: true,
        note: 'All media inquiries are reviewed by humans before response'
      }
    });

  } catch (error) {
    logger.error('Submit inquiry error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while submitting your inquiry'
    });
  }
}

/**
 * List all media inquiries (admin)
 * GET /api/media/inquiries?status=new
 */
async function listInquiries(req, res) {
  try {
    const { status = 'new', limit = 20, skip = 0 } = req.query;

    const inquiries = await MediaInquiry.findByStatus(status, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    const total = await MediaInquiry.countByStatus(status);

    res.json({
      success: true,
      status,
      inquiries,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + inquiries.length < total
      }
    });

  } catch (error) {
    logger.error('List inquiries error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * List urgent media inquiries (admin)
 * GET /api/media/inquiries/urgent
 */
async function listUrgentInquiries(req, res) {
  try {
    const { limit = 10 } = req.query;

    const inquiries = await MediaInquiry.findUrgent({
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      count: inquiries.length,
      inquiries
    });

  } catch (error) {
    logger.error('List urgent inquiries error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Get media inquiry by ID (admin)
 * GET /api/media/inquiries/:id
 */
async function getInquiry(req, res) {
  try {
    const { id } = req.params;

    const inquiry = await MediaInquiry.findById(id);

    if (!inquiry) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Media inquiry not found'
      });
    }

    res.json({
      success: true,
      inquiry
    });

  } catch (error) {
    logger.error('Get inquiry error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Assign inquiry to user (admin)
 * POST /api/media/inquiries/:id/assign
 */
async function assignInquiry(req, res) {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    const userId = user_id || req.user._id;

    const success = await MediaInquiry.assign(id, userId);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Media inquiry not found'
      });
    }

    logger.info(`Media inquiry ${id} assigned to ${userId} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Inquiry assigned successfully'
    });

  } catch (error) {
    logger.error('Assign inquiry error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Respond to inquiry (admin)
 * POST /api/media/inquiries/:id/respond
 */
async function respondToInquiry(req, res) {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Response content is required'
      });
    }

    const inquiry = await MediaInquiry.findById(id);

    if (!inquiry) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Media inquiry not found'
      });
    }

    const success = await MediaInquiry.respond(id, {
      content,
      responder: req.user.email
    });

    if (!success) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update inquiry'
      });
    }

    logger.info(`Media inquiry ${id} responded to by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Response recorded successfully',
      note: 'Remember to send actual email to media contact separately'
    });

  } catch (error) {
    logger.error('Respond to inquiry error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Delete media inquiry (admin)
 * DELETE /api/media/inquiries/:id
 */
async function deleteInquiry(req, res) {
  try {
    const { id } = req.params;

    const success = await MediaInquiry.delete(id);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Media inquiry not found'
      });
    }

    logger.info(`Media inquiry deleted: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Inquiry deleted successfully'
    });

  } catch (error) {
    logger.error('Delete inquiry error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Run AI triage on inquiry (admin)
 * POST /api/media/inquiries/:id/triage
 *
 * Demonstrates Tractatus dogfooding: AI assists, human decides
 */
async function triageInquiry(req, res) {
  try {
    const { id } = req.params;

    const inquiry = await MediaInquiry.findById(id);

    if (!inquiry) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Media inquiry not found'
      });
    }

    logger.info(`Running AI triage on inquiry ${id}`);

    // Run AI triage (MediaTriage service handles all analysis)
    const triageResult = await MediaTriageService.triageInquiry(inquiry);

    // Update inquiry with triage results
    await MediaInquiry.update(id, {
      'ai_triage.urgency': triageResult.urgency,
      'ai_triage.urgency_score': triageResult.urgency_score,
      'ai_triage.urgency_reasoning': triageResult.urgency_reasoning,
      'ai_triage.topic_sensitivity': triageResult.topic_sensitivity,
      'ai_triage.sensitivity_reasoning': triageResult.sensitivity_reasoning,
      'ai_triage.involves_values': triageResult.involves_values,
      'ai_triage.values_reasoning': triageResult.values_reasoning,
      'ai_triage.boundary_enforcement': triageResult.boundary_enforcement,
      'ai_triage.suggested_response_time': triageResult.suggested_response_time,
      'ai_triage.suggested_talking_points': triageResult.suggested_talking_points,
      'ai_triage.draft_response': triageResult.draft_response,
      'ai_triage.draft_response_reasoning': triageResult.draft_response_reasoning,
      'ai_triage.triaged_at': triageResult.triaged_at,
      'ai_triage.ai_model': triageResult.ai_model,
      status: 'triaged'
    });

    // Log governance action
    await GovernanceLog.create({
      action: 'AI_TRIAGE',
      entity_type: 'media_inquiry',
      entity_id: id,
      actor: req.user.email,
      quadrant: triageResult.involves_values ? 'STRATEGIC' : 'OPERATIONAL',
      tractatus_component: 'BoundaryEnforcer',
      reasoning: triageResult.values_reasoning,
      outcome: 'success',
      metadata: {
        urgency: triageResult.urgency,
        urgency_score: triageResult.urgency_score,
        involves_values: triageResult.involves_values,
        boundary_enforced: triageResult.involves_values,
        human_approval_required: true
      }
    });

    logger.info(`AI triage complete for inquiry ${id}: urgency=${triageResult.urgency}, values=${triageResult.involves_values}`);

    res.json({
      success: true,
      message: 'AI triage completed',
      triage: triageResult,
      governance: {
        human_approval_required: true,
        boundary_enforcer_active: triageResult.involves_values,
        transparency_note: 'All AI reasoning is visible for human review'
      }
    });

  } catch (error) {
    logger.error('Triage inquiry error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'AI triage failed',
      details: error.message
    });
  }
}

/**
 * Get triage statistics for public transparency
 * GET /api/media/triage-stats
 */
async function getTriageStats(req, res) {
  try {
    // Get all triaged inquiries (public stats, no sensitive data)
    const { getCollection } = require('../utils/db.util');
    const collection = await getCollection('media_inquiries');

    const inquiries = await collection.find({
      'ai_triage.triaged_at': { $exists: true }
    }).toArray();

    const stats = await MediaTriageService.getTriageStats(inquiries);

    // Add transparency metrics
    const transparencyMetrics = {
      ...stats,
      human_review_rate: '100%', // All inquiries require human review
      ai_auto_response_rate: '0%', // No auto-responses allowed
      boundary_enforcement_active: stats.boundary_enforcements > 0,
      framework_compliance: {
        human_approval_required: true,
        ai_reasoning_transparent: true,
        values_decisions_escalated: true
      }
    };

    res.json({
      success: true,
      period: 'all_time',
      statistics: transparencyMetrics,
      note: 'All media inquiries require human review before response. AI assists with triage only.'
    });

  } catch (error) {
    logger.error('Get triage stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve statistics'
    });
  }
}

module.exports = {
  submitInquiry,
  listInquiries,
  listUrgentInquiries,
  getInquiry,
  assignInquiry,
  respondToInquiry,
  deleteInquiry,
  triageInquiry,
  getTriageStats
};
