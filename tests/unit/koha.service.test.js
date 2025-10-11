/**
 * Unit Tests - Koha Service
 * Tests donation processing with mocked Stripe and Donation model
 */

// Mock Stripe before requiring the service
jest.mock('stripe', () => {
  const mockStripe = {
    customers: {
      list: jest.fn(),
      create: jest.fn()
    },
    checkout: {
      sessions: {
        create: jest.fn()
      }
    },
    subscriptions: {
      retrieve: jest.fn(),
      cancel: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    }
  };
  return jest.fn(() => mockStripe);
});

// Mock Donation model
jest.mock('../../src/models/Donation.model', () => ({
  create: jest.fn(),
  findByPaymentIntentId: jest.fn(),
  findBySubscriptionId: jest.fn(),
  updateStatus: jest.fn(),
  cancelSubscription: jest.fn(),
  markReceiptSent: jest.fn(),
  getTransparencyMetrics: jest.fn(),
  getStatistics: jest.fn()
}));

// Mock currency utilities
jest.mock('../../src/config/currencies.config', () => ({
  isSupportedCurrency: jest.fn((curr) => ['NZD', 'USD', 'AUD', 'EUR', 'GBP'].includes(curr.toUpperCase())),
  convertToNZD: jest.fn((amount, curr) => {
    const rates = { NZD: 1, USD: 1.65, AUD: 1.07, EUR: 1.82, GBP: 2.05 };
    return Math.round(amount * (rates[curr.toUpperCase()] || 1));
  }),
  getExchangeRate: jest.fn((curr) => {
    const rates = { NZD: 1, USD: 1.65, AUD: 1.07, EUR: 1.82, GBP: 2.05 };
    return rates[curr.toUpperCase()] || 1;
  })
}));

const kohaService = require('../../src/services/koha.service');
const Donation = require('../../src/models/Donation.model');
const stripe = require('stripe')();

describe('Koha Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console output in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with stripe instance', () => {
      expect(kohaService.stripe).toBeDefined();
    });

    test('should have price IDs configured', () => {
      expect(kohaService.priceIds).toBeDefined();
      expect(kohaService.priceIds).toHaveProperty('monthly_5');
      expect(kohaService.priceIds).toHaveProperty('monthly_15');
      expect(kohaService.priceIds).toHaveProperty('monthly_50');
      expect(kohaService.priceIds).toHaveProperty('one_time');
    });
  });

  describe('createCheckoutSession()', () => {
    const validDonation = {
      amount: 1000,
      currency: 'NZD',
      frequency: 'one_time',
      tier: 'custom',
      donor: {
        name: 'Test Donor',
        email: 'test@example.com',
        country: 'NZ'
      },
      public_acknowledgement: false
    };

    test('should create one-time donation checkout session', async () => {
      stripe.customers.list.mockResolvedValue({ data: [] });
      stripe.customers.create.mockResolvedValue({ id: 'cus_test123' });
      stripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/test'
      });
      Donation.create.mockResolvedValue({ _id: 'donation_id' });

      const result = await kohaService.createCheckoutSession(validDonation);

      expect(result).toHaveProperty('sessionId', 'cs_test123');
      expect(result).toHaveProperty('checkoutUrl');
      expect(stripe.customers.create).toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).toHaveBeenCalled();
      expect(Donation.create).toHaveBeenCalled();
    });

    test('should create monthly subscription checkout session', async () => {
      // Set price ID before test
      const originalPriceId = kohaService.priceIds.monthly_15;
      kohaService.priceIds.monthly_15 = 'price_15';

      const monthlyDonation = {
        ...validDonation,
        frequency: 'monthly',
        tier: '15'
      };

      stripe.customers.list.mockResolvedValue({ data: [] });
      stripe.customers.create.mockResolvedValue({ id: 'cus_test123' });
      stripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test456',
        url: 'https://checkout.stripe.com/test2'
      });
      Donation.create.mockResolvedValue({ _id: 'donation_id2' });

      const result = await kohaService.createCheckoutSession(monthlyDonation);

      expect(result.frequency).toBe('monthly');
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: expect.arrayContaining([
            expect.objectContaining({ price: 'price_15' })
          ])
        })
      );

      // Restore original
      kohaService.priceIds.monthly_15 = originalPriceId;
    });

    test('should reuse existing Stripe customer', async () => {
      const existingCustomer = { id: 'cus_existing', email: 'test@example.com' };
      stripe.customers.list.mockResolvedValue({ data: [existingCustomer] });
      stripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test789',
        url: 'https://checkout.stripe.com/test3'
      });
      Donation.create.mockResolvedValue({ _id: 'donation_id3' });

      await kohaService.createCheckoutSession(validDonation);

      expect(stripe.customers.create).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing'
        })
      );
    });

    test('should reject unsupported currency', async () => {
      const invalidCurrency = {
        ...validDonation,
        currency: 'JPY' // Not supported
      };

      await expect(
        kohaService.createCheckoutSession(invalidCurrency)
      ).rejects.toThrow('Unsupported currency');
    });

    test('should reject amount below minimum', async () => {
      const lowAmount = {
        ...validDonation,
        amount: 50 // Less than $1.00
      };

      await expect(
        kohaService.createCheckoutSession(lowAmount)
      ).rejects.toThrow('Minimum donation amount is $1.00');
    });

    test('should reject invalid frequency', async () => {
      const invalidFreq = {
        ...validDonation,
        frequency: 'weekly' // Not supported
      };

      await expect(
        kohaService.createCheckoutSession(invalidFreq)
      ).rejects.toThrow('Invalid frequency');
    });

    test('should require donor email', async () => {
      const noEmail = {
        ...validDonation,
        donor: { name: 'Test' } // No email
      };

      await expect(
        kohaService.createCheckoutSession(noEmail)
      ).rejects.toThrow('Donor email is required');
    });

    test('should reject invalid monthly tier', async () => {
      const invalidTier = {
        ...validDonation,
        frequency: 'monthly',
        tier: '100' // Not a valid tier
      };

      stripe.customers.list.mockResolvedValue({ data: [] });
      stripe.customers.create.mockResolvedValue({ id: 'cus_test' });

      await expect(
        kohaService.createCheckoutSession(invalidTier)
      ).rejects.toThrow('Invalid monthly tier');
    });

    test('should handle customer creation failure', async () => {
      stripe.customers.list.mockRejectedValue(new Error('Stripe API error'));

      await expect(
        kohaService.createCheckoutSession(validDonation)
      ).rejects.toThrow('Failed to process donor information');
    });
  });

  describe('handleWebhook()', () => {
    test('should handle checkout.session.completed', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test', metadata: {} } }
      };

      const handleCheckoutCompleteSpy = jest.spyOn(kohaService, 'handleCheckoutComplete').mockResolvedValue();

      await kohaService.handleWebhook(event);

      expect(handleCheckoutCompleteSpy).toHaveBeenCalled();
      handleCheckoutCompleteSpy.mockRestore();
    });

    test('should handle payment_intent.succeeded', async () => {
      const event = {
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } }
      };

      const handlePaymentSuccessSpy = jest.spyOn(kohaService, 'handlePaymentSuccess').mockResolvedValue();

      await kohaService.handleWebhook(event);

      expect(handlePaymentSuccessSpy).toHaveBeenCalled();
      handlePaymentSuccessSpy.mockRestore();
    });

    test('should handle payment_intent.payment_failed', async () => {
      const event = {
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_test' } }
      };

      const handlePaymentFailureSpy = jest.spyOn(kohaService, 'handlePaymentFailure').mockResolvedValue();

      await kohaService.handleWebhook(event);

      expect(handlePaymentFailureSpy).toHaveBeenCalled();
      handlePaymentFailureSpy.mockRestore();
    });

    test('should handle invoice.paid', async () => {
      const event = {
        type: 'invoice.paid',
        data: { object: { id: 'in_test' } }
      };

      const handleInvoicePaidSpy = jest.spyOn(kohaService, 'handleInvoicePaid').mockResolvedValue();

      await kohaService.handleWebhook(event);

      expect(handleInvoicePaidSpy).toHaveBeenCalled();
      handleInvoicePaidSpy.mockRestore();
    });

    test('should handle customer.subscription.deleted', async () => {
      const event = {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_test' } }
      };

      const handleSubscriptionCancellationSpy = jest.spyOn(kohaService, 'handleSubscriptionCancellation').mockResolvedValue();

      await kohaService.handleWebhook(event);

      expect(handleSubscriptionCancellationSpy).toHaveBeenCalled();
      handleSubscriptionCancellationSpy.mockRestore();
    });

    test('should log unhandled event types', async () => {
      const event = {
        type: 'unknown.event.type',
        data: { object: {} }
      };

      await kohaService.handleWebhook(event);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled webhook event type')
      );
    });

    test('should throw error if webhook processing fails', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test' } }
      };

      jest.spyOn(kohaService, 'handleCheckoutComplete').mockRejectedValue(new Error('Processing failed'));

      await expect(
        kohaService.handleWebhook(event)
      ).rejects.toThrow('Processing failed');
    });
  });

  describe('handleCheckoutComplete()', () => {
    test('should create new donation record', async () => {
      const session = {
        id: 'cs_test',
        amount_total: 1500,
        currency: 'nzd',
        customer_email: 'test@example.com',
        customer: 'cus_test',
        payment_intent: 'pi_test',
        subscription: null,
        metadata: {
          frequency: 'one_time',
          tier: 'custom',
          currency: 'NZD',
          amount_nzd: '1500',
          exchange_rate: '1.0',
          donor_name: 'Test Donor',
          public_acknowledgement: 'no'
        }
      };

      Donation.findByPaymentIntentId.mockResolvedValue(null);
      Donation.create.mockResolvedValue({ _id: 'donation_id', donor: { email: 'test@example.com' } });

      await kohaService.handleCheckoutComplete(session);

      expect(Donation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1500,
          frequency: 'one_time',
          status: 'completed'
        })
      );
    });

    test('should update existing donation record', async () => {
      const session = {
        id: 'cs_test',
        amount_total: 1500,
        payment_intent: 'pi_existing',
        subscription: 'sub_test',
        metadata: {
          frequency: 'monthly',
          tier: '15',
          currency: 'NZD',
          amount_nzd: '1500'
        }
      };

      const existingDonation = { _id: 'existing_id', status: 'pending' };
      Donation.findByPaymentIntentId.mockResolvedValue(existingDonation);
      Donation.updateStatus.mockResolvedValue(true);

      await kohaService.handleCheckoutComplete(session);

      expect(Donation.updateStatus).toHaveBeenCalledWith(
        'existing_id',
        'completed',
        expect.objectContaining({
          'stripe.subscription_id': 'sub_test'
        })
      );
    });
  });

  describe('handlePaymentSuccess()', () => {
    test('should update pending donation to completed', async () => {
      const paymentIntent = { id: 'pi_test' };
      const donation = { _id: 'donation_id', status: 'pending' };

      Donation.findByPaymentIntentId.mockResolvedValue(donation);
      Donation.updateStatus.mockResolvedValue(true);

      await kohaService.handlePaymentSuccess(paymentIntent);

      expect(Donation.updateStatus).toHaveBeenCalledWith(
        'donation_id',
        'completed',
        expect.any(Object)
      );
    });

    test('should not update non-pending donations', async () => {
      const paymentIntent = { id: 'pi_test' };
      const donation = { _id: 'donation_id', status: 'completed' };

      Donation.findByPaymentIntentId.mockResolvedValue(donation);

      await kohaService.handlePaymentSuccess(paymentIntent);

      expect(Donation.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('handlePaymentFailure()', () => {
    test('should mark donation as failed', async () => {
      const paymentIntent = {
        id: 'pi_test',
        last_payment_error: { message: 'Card declined' }
      };
      const donation = { _id: 'donation_id' };

      Donation.findByPaymentIntentId.mockResolvedValue(donation);
      Donation.updateStatus.mockResolvedValue(true);

      await kohaService.handlePaymentFailure(paymentIntent);

      expect(Donation.updateStatus).toHaveBeenCalledWith(
        'donation_id',
        'failed',
        expect.objectContaining({
          'metadata.failure_reason': 'Card declined'
        })
      );
    });
  });

  describe('handleInvoicePaid()', () => {
    test('should create donation for recurring payment', async () => {
      const invoice = {
        id: 'in_test',
        subscription: 'sub_test',
        customer_email: 'test@example.com',
        customer: 'cus_test',
        amount_paid: 1500,
        currency: 'nzd',
        charge: 'ch_test',
        created: Math.floor(Date.now() / 1000)
      };

      const subscription = {
        metadata: {
          tier: '15',
          public_acknowledgement: 'yes',
          currency: 'NZD'
        }
      };

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);
      Donation.create.mockResolvedValue({ _id: 'donation_id' });

      await kohaService.handleInvoicePaid(invoice);

      expect(Donation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: 'monthly',
          status: 'completed',
          amount: 1500
        })
      );
    });
  });

  describe('verifyWebhookSignature()', () => {
    test('should verify valid webhook signature', () => {
      const payload = 'webhook payload';
      const signature = 'sig_test';
      const event = { type: 'test', data: {} };

      stripe.webhooks.constructEvent.mockReturnValue(event);

      const result = kohaService.verifyWebhookSignature(payload, signature);

      expect(result).toEqual(event);
      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        process.env.STRIPE_KOHA_WEBHOOK_SECRET
      );
    });

    test('should throw error for invalid signature', () => {
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() => {
        kohaService.verifyWebhookSignature('payload', 'bad_sig');
      }).toThrow('Invalid webhook signature');
    });
  });

  describe('getTransparencyMetrics()', () => {
    test('should return transparency metrics', async () => {
      const mockMetrics = {
        total_received: 5000,
        monthly_supporters: 10,
        one_time_donations: 50
      };

      Donation.getTransparencyMetrics.mockResolvedValue(mockMetrics);

      const result = await kohaService.getTransparencyMetrics();

      expect(result).toEqual(mockMetrics);
      expect(Donation.getTransparencyMetrics).toHaveBeenCalled();
    });

    test('should throw error if metrics retrieval fails', async () => {
      Donation.getTransparencyMetrics.mockRejectedValue(new Error('Database error'));

      await expect(
        kohaService.getTransparencyMetrics()
      ).rejects.toThrow('Database error');
    });
  });

  describe('sendReceiptEmail()', () => {
    test('should generate receipt number and mark as sent', async () => {
      const donation = {
        _id: 'donation123',
        donor: { email: 'test@example.com' }
      };

      Donation.markReceiptSent.mockResolvedValue(true);

      const result = await kohaService.sendReceiptEmail(donation);

      expect(result).toBe(true);
      expect(Donation.markReceiptSent).toHaveBeenCalledWith(
        'donation123',
        expect.stringMatching(/^KOHA-\d{4}-[A-Z0-9]{8}$/)
      );
    });
  });

  describe('cancelRecurringDonation()', () => {
    test('should cancel subscription in Stripe and database', async () => {
      stripe.subscriptions.cancel.mockResolvedValue({ id: 'sub_test', status: 'canceled' });
      Donation.cancelSubscription.mockResolvedValue(true);

      const result = await kohaService.cancelRecurringDonation('sub_test');

      expect(result).toEqual({
        success: true,
        message: 'Subscription cancelled successfully'
      });
      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_test');
      expect(Donation.cancelSubscription).toHaveBeenCalledWith('sub_test');
    });

    test('should throw error if cancellation fails', async () => {
      stripe.subscriptions.cancel.mockRejectedValue(new Error('Subscription not found'));

      await expect(
        kohaService.cancelRecurringDonation('sub_nonexistent')
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('getStatistics()', () => {
    test('should return donation statistics', async () => {
      const mockStats = {
        total_count: 100,
        total_amount: 10000,
        by_frequency: { monthly: 20, one_time: 80 }
      };

      Donation.getStatistics.mockResolvedValue(mockStats);

      const result = await kohaService.getStatistics();

      expect(result).toEqual(mockStats);
      expect(Donation.getStatistics).toHaveBeenCalledWith(null, null);
    });

    test('should support date range filtering', async () => {
      const mockStats = { total_count: 10, total_amount: 1000 };

      Donation.getStatistics.mockResolvedValue(mockStats);

      await kohaService.getStatistics('2025-01-01', '2025-12-31');

      expect(Donation.getStatistics).toHaveBeenCalledWith('2025-01-01', '2025-12-31');
    });
  });

  describe('Service Singleton', () => {
    test('should export singleton instance', () => {
      const kohaService2 = require('../../src/services/koha.service');
      expect(kohaService).toBe(kohaService2);
    });
  });
});
