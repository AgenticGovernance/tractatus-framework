/**
 * Koha Controller
 * Handles donation-related HTTP requests
 */

const kohaService = require('../services/koha.service');
const logger = require('../utils/logger.util');

/**
 * Create checkout session for donation
 * POST /api/koha/checkout
 */
exports.createCheckout = async (req, res) => {
  try {
    // Check if Stripe is configured (not placeholder)
    if (!process.env.STRIPE_SECRET_KEY ||
        process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER')) {
      return res.status(503).json({
        success: false,
        error: 'Donation system not yet active',
        message: 'The Koha donation system is currently being configured. Please check back soon.'
      });
    }

    const { amount, frequency, tier, donor, public_acknowledgement, public_name } = req.body;

    // Validate required fields
    if (!amount || !frequency || !donor?.email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, frequency, donor.email'
      });
    }

    // Validate amount
    if (amount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Minimum donation amount is NZD $1.00'
      });
    }

    // Validate frequency
    if (!['monthly', 'one_time'].includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid frequency. Must be "monthly" or "one_time"'
      });
    }

    // Validate tier for monthly donations
    if (frequency === 'monthly' && !['5', '15', '50'].includes(tier)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tier for monthly donations. Must be "5", "15", or "50"'
      });
    }

    // Create checkout session
    const session = await kohaService.createCheckoutSession({
      amount,
      frequency,
      tier,
      donor,
      public_acknowledgement: public_acknowledgement || false,
      public_name: public_name || null
    });

    logger.info(`[KOHA] Checkout session created: ${session.sessionId}`);

    res.status(200).json({
      success: true,
      data: session
    });

  } catch (error) {
    logger.error('[KOHA] Create checkout error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create checkout session'
    });
  }
};

/**
 * Handle Stripe webhook events
 * POST /api/koha/webhook
 */
exports.handleWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];

  try {
    // Verify webhook signature and construct event
    const event = kohaService.verifyWebhookSignature(req.rawBody, signature);

    // Process webhook event
    await kohaService.handleWebhook(event);

    res.status(200).json({ received: true });

  } catch (error) {
    logger.error('[KOHA] Webhook error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Webhook processing failed'
    });
  }
};

/**
 * Get public transparency metrics
 * GET /api/koha/transparency
 */
exports.getTransparency = async (req, res) => {
  try {
    const metrics = await kohaService.getTransparencyMetrics();

    res.status(200).json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('[KOHA] Get transparency error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transparency metrics'
    });
  }
};

/**
 * Cancel recurring donation
 * POST /api/koha/cancel
 * Requires email verification to prevent unauthorized cancellations
 */
exports.cancelDonation = async (req, res) => {
  try {
    const { subscriptionId, email } = req.body;

    if (!subscriptionId || !email) {
      return res.status(400).json({
        success: false,
        error: 'Subscription ID and email are required'
      });
    }

    // Verify donor owns this subscription by checking email
    const donation = await require('../models/Donation.model').findBySubscriptionId(subscriptionId);

    if (!donation) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Verify email matches the donor's email
    if (donation.donor.email.toLowerCase() !== email.toLowerCase()) {
      logger.warn(`[KOHA SECURITY] Failed cancellation attempt: subscription ${subscriptionId} with wrong email ${email}`);
      return res.status(403).json({
        success: false,
        error: 'Email does not match subscription owner'
      });
    }

    // Email verified, proceed with cancellation
    const result = await kohaService.cancelRecurringDonation(subscriptionId);

    logger.info(`[KOHA] Subscription cancelled: ${subscriptionId} by ${email}`);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('[KOHA] Cancel donation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel donation'
    });
  }
};

/**
 * Get donation statistics (ADMIN ONLY)
 * GET /api/koha/statistics
 * Authentication enforced in routes layer (requireAdmin middleware)
 */
exports.getStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const statistics = await kohaService.getStatistics(startDate, endDate);

    res.status(200).json({
      success: true,
      data: statistics
    });

  } catch (error) {
    logger.error('[KOHA] Get statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
};

/**
 * Verify donation session (after redirect from Stripe)
 * GET /api/koha/verify/:sessionId
 */
exports.verifySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    // Retrieve session from Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Check if payment was successful
    const isSuccessful = session.payment_status === 'paid';

    res.status(200).json({
      success: true,
      data: {
        status: session.payment_status,
        amount: session.amount_total / 100,
        currency: session.currency,
        frequency: session.metadata.frequency,
        isSuccessful: isSuccessful
      }
    });

  } catch (error) {
    logger.error('[KOHA] Verify session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify session'
    });
  }
};
