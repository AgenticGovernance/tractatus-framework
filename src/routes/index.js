/**
 * Routes Index
 * Central routing configuration
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const documentsRoutes = require('./documents.routes');
const blogRoutes = require('./blog.routes');
const mediaRoutes = require('./media.routes');
const casesRoutes = require('./cases.routes');
const adminRoutes = require('./admin.routes');
const rulesRoutes = require('./rules.routes');
const projectsRoutes = require('./projects.routes');
const auditRoutes = require('./audit.routes');
const governanceRoutes = require('./governance.routes');
const kohaRoutes = require('./koha.routes');
const demoRoutes = require('./demo.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/documents', documentsRoutes);
router.use('/blog', blogRoutes);
router.use('/media', mediaRoutes);
router.use('/cases', casesRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/rules', rulesRoutes);
router.use('/admin/projects', projectsRoutes);
router.use('/admin', auditRoutes);
router.use('/governance', governanceRoutes);
router.use('/koha', kohaRoutes);
router.use('/demo', demoRoutes);

// API root endpoint - redirect browsers to documentation
router.get('/', (req, res) => {
  // Check if request is from a browser (Accept: text/html)
  const acceptsHtml = req.accepts('html');
  const acceptsJson = req.accepts('json');

  // If browser request, redirect to API documentation page
  if (acceptsHtml && !acceptsJson) {
    return res.redirect(302, '/api-reference.html');
  }

  res.json({
    name: 'Tractatus AI Safety Framework API',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
        logout: 'POST /api/auth/logout'
      },
      documents: {
        list: 'GET /api/documents',
        get: 'GET /api/documents/:identifier',
        search: 'GET /api/documents/search?q=query',
        create: 'POST /api/documents (admin)',
        update: 'PUT /api/documents/:id (admin)',
        delete: 'DELETE /api/documents/:id (admin)'
      },
      blog: {
        list: 'GET /api/blog',
        get: 'GET /api/blog/:slug',
        create: 'POST /api/blog (admin)',
        update: 'PUT /api/blog/:id (admin)',
        publish: 'POST /api/blog/:id/publish (admin)',
        delete: 'DELETE /api/blog/:id (admin)',
        admin_list: 'GET /api/blog/admin/posts?status=draft (admin)',
        admin_get: 'GET /api/blog/admin/:id (admin)',
        suggest_topics: 'POST /api/blog/suggest-topics (admin)'
      },
      media: {
        submit: 'POST /api/media/inquiries',
        list: 'GET /api/media/inquiries (admin)',
        urgent: 'GET /api/media/inquiries/urgent (admin)',
        get: 'GET /api/media/inquiries/:id (admin)',
        assign: 'POST /api/media/inquiries/:id/assign (admin)',
        respond: 'POST /api/media/inquiries/:id/respond (admin)',
        delete: 'DELETE /api/media/inquiries/:id (admin)'
      },
      cases: {
        submit: 'POST /api/cases/submit',
        list: 'GET /api/cases/submissions (admin)',
        high_relevance: 'GET /api/cases/submissions/high-relevance (admin)',
        get: 'GET /api/cases/submissions/:id (admin)',
        approve: 'POST /api/cases/submissions/:id/approve (admin)',
        reject: 'POST /api/cases/submissions/:id/reject (admin)',
        request_info: 'POST /api/cases/submissions/:id/request-info (admin)',
        delete: 'DELETE /api/cases/submissions/:id (admin)'
      },
      admin: {
        moderation_queue: 'GET /api/admin/moderation',
        moderation_item: 'GET /api/admin/moderation/:id',
        review: 'POST /api/admin/moderation/:id/review',
        stats: 'GET /api/admin/stats',
        activity: 'GET /api/admin/activity'
      },
      governance: {
        status: 'GET /api/governance',
        classify: 'POST /api/governance/classify (admin)',
        validate: 'POST /api/governance/validate (admin)',
        enforce: 'POST /api/governance/enforce (admin)',
        pressure: 'POST /api/governance/pressure (admin)',
        verify: 'POST /api/governance/verify (admin)'
      },
      koha: {
        checkout: 'POST /api/koha/checkout',
        webhook: 'POST /api/koha/webhook',
        transparency: 'GET /api/koha/transparency',
        cancel: 'POST /api/koha/cancel',
        verify: 'GET /api/koha/verify/:sessionId',
        statistics: 'GET /api/koha/statistics (admin)'
      }
    },
    framework: 'Tractatus-Based LLM Safety Architecture',
    documentation: '/api/docs',
    health: '/health'
  });
});

module.exports = router;
