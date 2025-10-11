/**
 * Koha Routes
 * Donation system API endpoints
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const kohaController = require('../controllers/koha.controller');
const { authenticateToken, requireAdmin } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * Rate limiting for donation endpoints
 * More restrictive than general API limit to prevent abuse
 */
const donationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour per IP
  message: 'Too many donation attempts from this IP. Please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for webhook endpoint (Stripe needs reliable access)
  skip: (req) => req.path === '/webhook'
});

/**
 * Public routes
 */

// Create checkout session for donation
// POST /api/koha/checkout
// Body: { amount, frequency, tier, donor: { name, email, country }, public_acknowledgement, public_name }
router.post('/checkout', donationLimiter, kohaController.createCheckout);

// Stripe webhook endpoint
// POST /api/koha/webhook
// Note: Requires raw body, configured in app.js
router.post('/webhook', kohaController.handleWebhook);

// Get public transparency metrics
// GET /api/koha/transparency
router.get('/transparency', kohaController.getTransparency);

// Cancel recurring donation
// POST /api/koha/cancel
// Body: { subscriptionId, email }
// Rate limited to prevent abuse/guessing of subscription IDs
router.post('/cancel', donationLimiter, kohaController.cancelDonation);

// Verify donation session (after Stripe redirect)
// GET /api/koha/verify/:sessionId
router.get('/verify/:sessionId', kohaController.verifySession);

/**
 * Admin-only routes
 * Requires JWT authentication with admin role
 */

// Get donation statistics
// GET /api/koha/statistics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/statistics',
  authenticateToken,
  requireAdmin,
  asyncHandler(kohaController.getStatistics)
);

module.exports = router;
