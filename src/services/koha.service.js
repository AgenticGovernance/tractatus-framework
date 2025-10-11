/**
 * Koha Service
 * Donation processing service for Tractatus Framework
 *
 * Based on passport-consolidated's StripeService pattern
 * Handles multi-currency donations via Stripe (reusing existing account)
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Donation = require('../models/Donation.model');
const {
  isSupportedCurrency,
  convertToNZD,
  getExchangeRate
} = require('../config/currencies.config');

// Simple logger (uses console)
const logger = {
  info: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args)
};

class KohaService {
  constructor() {
    this.stripe = stripe;
    this.priceIds = {
      // NZD monthly tiers
      monthly_5: process.env.STRIPE_KOHA_5_PRICE_ID,
      monthly_15: process.env.STRIPE_KOHA_15_PRICE_ID,
      monthly_50: process.env.STRIPE_KOHA_50_PRICE_ID,
      // One-time donation (custom amount)
      one_time: process.env.STRIPE_KOHA_ONETIME_PRICE_ID
    };
  }

  /**
   * Create a Stripe Checkout session for donation
   * @param {Object} donationData - Donation details
   * @returns {Object} Checkout session data
   */
  async createCheckoutSession(donationData) {
    try {
      const { amount, currency, frequency, tier, donor, public_acknowledgement, public_name } = donationData;

      // Validate currency
      const donationCurrency = (currency || 'nzd').toUpperCase();
      if (!isSupportedCurrency(donationCurrency)) {
        throw new Error(`Unsupported currency: ${donationCurrency}`);
      }

      // Validate inputs
      if (!amount || amount < 100) {
        throw new Error('Minimum donation amount is $1.00');
      }

      if (!frequency || !['monthly', 'one_time'].includes(frequency)) {
        throw new Error('Invalid frequency. Must be "monthly" or "one_time"');
      }

      if (!donor?.email) {
        throw new Error('Donor email is required for receipt');
      }

      // Calculate NZD equivalent for transparency metrics
      const amountNZD = donationCurrency === 'NZD' ? amount : convertToNZD(amount, donationCurrency);
      const exchangeRate = getExchangeRate(donationCurrency);

      logger.info(`[KOHA] Creating checkout session: ${frequency} donation of ${donationCurrency} $${amount / 100} (NZD $${amountNZD / 100})`);

      // Create or retrieve Stripe customer
      let stripeCustomer;
      try {
        // Search for existing customer by email
        const customers = await this.stripe.customers.list({
          email: donor.email,
          limit: 1
        });

        if (customers.data.length > 0) {
          stripeCustomer = customers.data[0];
          logger.info(`[KOHA] Using existing customer ${stripeCustomer.id}`);
        } else {
          stripeCustomer = await this.stripe.customers.create({
            email: donor.email,
            name: donor.name || 'Anonymous Donor',
            metadata: {
              source: 'tractatus_koha',
              public_acknowledgement: public_acknowledgement ? 'yes' : 'no'
            }
          });
          logger.info(`[KOHA] Created new customer ${stripeCustomer.id}`);
        }
      } catch (error) {
        logger.error('[KOHA] Failed to create/retrieve customer:', error);
        throw new Error('Failed to process donor information');
      }

      // Prepare checkout session parameters
      const sessionParams = {
        payment_method_types: ['card'],
        customer: stripeCustomer.id,
        mode: frequency === 'monthly' ? 'subscription' : 'payment',
        success_url: `${process.env.FRONTEND_URL || 'https://agenticgovernance.digital'}/koha/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'https://agenticgovernance.digital'}/koha`,
        metadata: {
          frequency: frequency,
          tier: tier,
          currency: donationCurrency,
          amount_nzd: String(amountNZD),
          exchange_rate: String(exchangeRate),
          donor_name: donor.name || 'Anonymous',
          public_acknowledgement: public_acknowledgement ? 'yes' : 'no',
          public_name: public_name || '',
          source: 'tractatus_website'
        },
        allow_promotion_codes: true, // Allow coupon codes
        billing_address_collection: 'auto'
      };

      // Add line items based on frequency
      if (frequency === 'monthly') {
        // Subscription mode - use price ID for recurring donations
        const priceId = this.priceIds[`monthly_${tier}`];
        if (!priceId) {
          throw new Error(`Invalid monthly tier: ${tier}`);
        }

        sessionParams.line_items = [{
          price: priceId,
          quantity: 1
        }];

        sessionParams.subscription_data = {
          metadata: {
            tier: tier,
            public_acknowledgement: public_acknowledgement ? 'yes' : 'no'
          }
        };
      } else {
        // One-time payment mode - use custom amount
        sessionParams.line_items = [{
          price_data: {
            currency: donationCurrency.toLowerCase(),
            product_data: {
              name: 'Tractatus Framework Support',
              description: 'One-time donation to support the Tractatus Framework for AI safety',
              images: ['https://agenticgovernance.digital/images/tractatus-icon.svg']
            },
            unit_amount: amount // Amount in cents
          },
          quantity: 1
        }];

        sessionParams.payment_intent_data = {
          metadata: {
            tier: tier || 'custom',
            public_acknowledgement: public_acknowledgement ? 'yes' : 'no'
          }
        };
      }

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create(sessionParams);

      logger.info(`[KOHA] Checkout session created: ${session.id}`);

      // Create pending donation record in database
      await Donation.create({
        amount: amount,
        currency: donationCurrency.toLowerCase(),
        amount_nzd: amountNZD,
        exchange_rate_to_nzd: exchangeRate,
        frequency: frequency,
        tier: tier,
        donor: {
          name: donor.name || 'Anonymous',
          email: donor.email,
          country: donor.country
        },
        public_acknowledgement: public_acknowledgement || false,
        public_name: public_name || null,
        stripe: {
          customer_id: stripeCustomer.id
        },
        status: 'pending',
        metadata: {
          source: 'website',
          session_id: session.id
        }
      });

      return {
        sessionId: session.id,
        checkoutUrl: session.url,
        frequency: frequency,
        amount: amount / 100
      };

    } catch (error) {
      logger.error('[KOHA] Checkout session creation failed:', error);
      throw error;
    }
  }

  /**
   * Handle webhook events from Stripe
   * @param {Object} event - Stripe webhook event
   */
  async handleWebhook(event) {
    try {
      logger.info(`[KOHA] Processing webhook event: ${event.type}`);

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutComplete(event.data.object);
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;

        case 'invoice.paid':
          // Recurring subscription payment succeeded
          await this.handleInvoicePaid(event.data.object);
          break;

        case 'invoice.payment_failed':
          // Recurring subscription payment failed
          await this.handleInvoicePaymentFailed(event.data.object);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionCancellation(event.data.object);
          break;

        default:
          logger.info(`[KOHA] Unhandled webhook event type: ${event.type}`);
      }

    } catch (error) {
      logger.error('[KOHA] Webhook processing error:', error);
      throw error;
    }
  }

  /**
   * Handle successful checkout completion
   */
  async handleCheckoutComplete(session) {
    try {
      const frequency = session.metadata.frequency;
      const tier = session.metadata.tier;
      const currency = session.metadata.currency || session.currency?.toUpperCase() || 'NZD';
      const amountNZD = session.metadata.amount_nzd ? parseInt(session.metadata.amount_nzd) : session.amount_total;
      const exchangeRate = session.metadata.exchange_rate ? parseFloat(session.metadata.exchange_rate) : 1.0;

      logger.info(`[KOHA] Checkout completed: ${frequency} donation, tier: ${tier}, currency: ${currency}`);

      // Find pending donation or create new one
      let donation = await Donation.findByPaymentIntentId(session.payment_intent);

      if (!donation) {
        // Create donation record from session data
        donation = await Donation.create({
          amount: session.amount_total,
          currency: currency.toLowerCase(),
          amount_nzd: amountNZD,
          exchange_rate_to_nzd: exchangeRate,
          frequency: frequency,
          tier: tier,
          donor: {
            name: session.metadata.donor_name || 'Anonymous',
            email: session.customer_email
          },
          public_acknowledgement: session.metadata.public_acknowledgement === 'yes',
          public_name: session.metadata.public_name || null,
          stripe: {
            customer_id: session.customer,
            subscription_id: session.subscription || null,
            payment_intent_id: session.payment_intent
          },
          status: 'completed',
          payment_date: new Date()
        });
      } else {
        // Update existing donation
        await Donation.updateStatus(donation._id, 'completed', {
          'stripe.subscription_id': session.subscription || null,
          'stripe.payment_intent_id': session.payment_intent,
          payment_date: new Date()
        });
      }

      // Send receipt email (async, don't wait)
      this.sendReceiptEmail(donation).catch(err =>
        logger.error('[KOHA] Failed to send receipt email:', err)
      );

      logger.info(`[KOHA] Donation recorded: ${currency} $${session.amount_total / 100} (NZD $${amountNZD / 100})`);

    } catch (error) {
      logger.error('[KOHA] Error handling checkout completion:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(paymentIntent) {
    try {
      logger.info(`[KOHA] Payment succeeded: ${paymentIntent.id}`);

      const donation = await Donation.findByPaymentIntentId(paymentIntent.id);
      if (donation && donation.status === 'pending') {
        await Donation.updateStatus(donation._id, 'completed', {
          payment_date: new Date()
        });
      }

    } catch (error) {
      logger.error('[KOHA] Error handling payment success:', error);
    }
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailure(paymentIntent) {
    try {
      logger.warn(`[KOHA] Payment failed: ${paymentIntent.id}`);

      const donation = await Donation.findByPaymentIntentId(paymentIntent.id);
      if (donation) {
        await Donation.updateStatus(donation._id, 'failed', {
          'metadata.failure_reason': paymentIntent.last_payment_error?.message
        });
      }

    } catch (error) {
      logger.error('[KOHA] Error handling payment failure:', error);
    }
  }

  /**
   * Handle paid invoice (recurring subscription payment)
   */
  async handleInvoicePaid(invoice) {
    try {
      logger.info(`[KOHA] Invoice paid: ${invoice.id} for subscription ${invoice.subscription}`);

      // Create new donation record for this recurring payment
      const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription);

      // Get currency from invoice or metadata
      const currency = (invoice.currency || subscription.metadata.currency || 'NZD').toUpperCase();
      const amount = invoice.amount_paid;

      // Calculate NZD equivalent
      const amountNZD = currency === 'NZD' ? amount : convertToNZD(amount, currency);
      const exchangeRate = getExchangeRate(currency);

      await Donation.create({
        amount: amount,
        currency: currency.toLowerCase(),
        amount_nzd: amountNZD,
        exchange_rate_to_nzd: exchangeRate,
        frequency: 'monthly',
        tier: subscription.metadata.tier,
        donor: {
          email: invoice.customer_email
        },
        public_acknowledgement: subscription.metadata.public_acknowledgement === 'yes',
        stripe: {
          customer_id: invoice.customer,
          subscription_id: invoice.subscription,
          invoice_id: invoice.id,
          charge_id: invoice.charge
        },
        status: 'completed',
        payment_date: new Date(invoice.created * 1000)
      });

      logger.info(`[KOHA] Recurring donation recorded: ${currency} $${amount / 100} (NZD $${amountNZD / 100})`);

    } catch (error) {
      logger.error('[KOHA] Error handling invoice paid:', error);
    }
  }

  /**
   * Handle failed invoice payment
   */
  async handleInvoicePaymentFailed(invoice) {
    try {
      logger.warn(`[KOHA] Invoice payment failed: ${invoice.id}`);
      // Could send notification email to donor here

    } catch (error) {
      logger.error('[KOHA] Error handling invoice payment failed:', error);
    }
  }

  /**
   * Handle subscription updates
   */
  async handleSubscriptionUpdate(subscription) {
    logger.info(`[KOHA] Subscription updated: ${subscription.id}, status: ${subscription.status}`);
  }

  /**
   * Handle subscription cancellation
   */
  async handleSubscriptionCancellation(subscription) {
    try {
      logger.info(`[KOHA] Subscription cancelled: ${subscription.id}`);

      await Donation.cancelSubscription(subscription.id);

    } catch (error) {
      logger.error('[KOHA] Error handling subscription cancellation:', error);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_KOHA_WEBHOOK_SECRET
      );
    } catch (error) {
      logger.error('[KOHA] Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Get transparency metrics for public dashboard
   */
  async getTransparencyMetrics() {
    try {
      return await Donation.getTransparencyMetrics();
    } catch (error) {
      logger.error('[KOHA] Error getting transparency metrics:', error);
      throw error;
    }
  }

  /**
   * Send receipt email (placeholder)
   */
  async sendReceiptEmail(donation) {
    // TODO: Implement email service integration
    logger.info(`[KOHA] Receipt email would be sent to ${donation.donor.email}`);

    // Generate receipt number
    const receiptNumber = `KOHA-${new Date().getFullYear()}-${String(donation._id).slice(-8).toUpperCase()}`;

    await Donation.markReceiptSent(donation._id, receiptNumber);

    return true;
  }

  /**
   * Cancel a recurring donation (admin or donor-initiated)
   */
  async cancelRecurringDonation(subscriptionId) {
    try {
      logger.info(`[KOHA] Cancelling subscription: ${subscriptionId}`);

      // Cancel in Stripe
      await this.stripe.subscriptions.cancel(subscriptionId);

      // Update database
      await Donation.cancelSubscription(subscriptionId);

      return { success: true, message: 'Subscription cancelled successfully' };

    } catch (error) {
      logger.error('[KOHA] Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Get donation statistics (admin only)
   */
  async getStatistics(startDate = null, endDate = null) {
    try {
      return await Donation.getStatistics(startDate, endDate);
    } catch (error) {
      logger.error('[KOHA] Error getting statistics:', error);
      throw error;
    }
  }
}

// Create singleton instance
const kohaService = new KohaService();

module.exports = kohaService;
