/**
 * Case Study Controller
 * Community case study submissions with AI review
 */

const CaseSubmission = require('../models/CaseSubmission.model');
const ModerationQueue = require('../models/ModerationQueue.model');
const GovernanceLog = require('../models/GovernanceLog.model');
const BoundaryEnforcer = require('../services/BoundaryEnforcer.service');
const logger = require('../utils/logger.util');

/**
 * Submit case study (public)
 * POST /api/cases/submit
 *
 * Phase 1: Manual review (no AI)
 * Phase 2: Add AI categorization with claudeAPI.reviewCaseStudy()
 */
async function submitCase(req, res) {
  try {
    const { submitter, case_study } = req.body;

    // Validate required fields
    if (!submitter?.name || !submitter?.email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required submitter information'
      });
    }

    if (!case_study?.title || !case_study?.description || !case_study?.failure_mode) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required case study information'
      });
    }

    logger.info(`Case study submitted: ${case_study.title} by ${submitter.name}`);

    // Create submission (Phase 1: no AI review yet)
    const submission = await CaseSubmission.create({
      submitter,
      case_study,
      ai_review: {
        relevance_score: 0.5, // Default, will be AI-assessed in Phase 2
        completeness_score: 0.5,
        recommended_category: 'uncategorized'
      },
      moderation: {
        status: 'pending'
      }
    });

    // Add to moderation queue for human review
    await ModerationQueue.create({
      type: 'CASE_SUBMISSION',
      reference_collection: 'case_submissions',
      reference_id: submission._id,
      quadrant: 'OPERATIONAL',
      data: {
        submitter,
        case_study
      },
      priority: 'medium',
      status: 'PENDING_APPROVAL',
      requires_human_approval: true,
      human_required_reason: 'All case submissions require human review and approval'
    });

    logger.info(`Case submission created: ${submission._id}`);

    res.status(201).json({
      success: true,
      message: 'Thank you for your submission. We will review it shortly.',
      submission_id: submission._id,
      governance: {
        human_review: true,
        note: 'All case studies are reviewed by humans before publication'
      }
    });

  } catch (error) {
    logger.error('Submit case error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while submitting your case study'
    });
  }
}

/**
 * List all case submissions (admin)
 * GET /api/cases/submissions?status=pending
 */
async function listSubmissions(req, res) {
  try {
    const { status = 'pending', limit = 20, skip = 0 } = req.query;

    const submissions = await CaseSubmission.findByStatus(status, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    const total = await CaseSubmission.countByStatus(status);

    res.json({
      success: true,
      status,
      submissions,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + submissions.length < total
      }
    });

  } catch (error) {
    logger.error('List submissions error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * List high-relevance pending submissions (admin)
 * GET /api/cases/submissions/high-relevance
 */
async function listHighRelevance(req, res) {
  try {
    const { limit = 10 } = req.query;

    const submissions = await CaseSubmission.findHighRelevance({
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      count: submissions.length,
      submissions
    });

  } catch (error) {
    logger.error('List high relevance error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Get case submission by ID (admin)
 * GET /api/cases/submissions/:id
 */
async function getSubmission(req, res) {
  try {
    const { id } = req.params;

    const submission = await CaseSubmission.findById(id);

    if (!submission) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Case submission not found'
      });
    }

    res.json({
      success: true,
      submission
    });

  } catch (error) {
    logger.error('Get submission error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Approve case submission (admin)
 * POST /api/cases/submissions/:id/approve
 */
async function approveSubmission(req, res) {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const submission = await CaseSubmission.findById(id);

    if (!submission) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Case submission not found'
      });
    }

    if (submission.moderation.status === 'approved') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Submission is already approved'
      });
    }

    const success = await CaseSubmission.approve(id, req.user._id, notes || '');

    if (!success) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to approve submission'
      });
    }

    logger.info(`Case submission approved: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Case submission approved successfully',
      note: 'You can now publish this as a case study document'
    });

  } catch (error) {
    logger.error('Approve submission error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Reject case submission (admin)
 * POST /api/cases/submissions/:id/reject
 */
async function rejectSubmission(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Rejection reason is required'
      });
    }

    const submission = await CaseSubmission.findById(id);

    if (!submission) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Case submission not found'
      });
    }

    const success = await CaseSubmission.reject(id, req.user._id, reason);

    if (!success) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to reject submission'
      });
    }

    logger.info(`Case submission rejected: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Case submission rejected',
      note: 'Consider notifying the submitter with feedback'
    });

  } catch (error) {
    logger.error('Reject submission error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Request more information (admin)
 * POST /api/cases/submissions/:id/request-info
 */
async function requestMoreInfo(req, res) {
  try {
    const { id } = req.params;
    const { requested_info } = req.body;

    if (!requested_info) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Requested information must be specified'
      });
    }

    const submission = await CaseSubmission.findById(id);

    if (!submission) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Case submission not found'
      });
    }

    const success = await CaseSubmission.requestInfo(id, req.user._id, requested_info);

    if (!success) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update submission'
      });
    }

    logger.info(`More info requested for case ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Information request recorded',
      note: 'Remember to contact submitter separately to request additional information'
    });

  } catch (error) {
    logger.error('Request info error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Delete case submission (admin)
 * DELETE /api/cases/submissions/:id
 */
async function deleteSubmission(req, res) {
  try {
    const { id } = req.params;

    const success = await CaseSubmission.delete(id);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Case submission not found'
      });
    }

    logger.info(`Case submission deleted: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Case submission deleted successfully'
    });

  } catch (error) {
    logger.error('Delete submission error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

module.exports = {
  submitCase,
  listSubmissions,
  listHighRelevance,
  getSubmission,
  approveSubmission,
  rejectSubmission,
  requestMoreInfo,
  deleteSubmission
};
