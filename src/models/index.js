/**
 * Models Index
 * Export all models
 */

const Document = require('./Document.model');
const BlogPost = require('./BlogPost.model');
const MediaInquiry = require('./MediaInquiry.model');
const CaseSubmission = require('./CaseSubmission.model');
const Resource = require('./Resource.model');
const ModerationQueue = require('./ModerationQueue.model');
const User = require('./User.model');
const GovernanceLog = require('./GovernanceLog.model');

module.exports = {
  Document,
  BlogPost,
  MediaInquiry,
  CaseSubmission,
  Resource,
  ModerationQueue,
  User,
  GovernanceLog
};
