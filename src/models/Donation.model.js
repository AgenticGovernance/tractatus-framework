/**
 * Donation Model
 * Koha (donation) system for Tractatus Framework support
 *
 * Privacy-first design:
 * - Anonymous donations by default
 * - Opt-in public acknowledgement
 * - Email stored securely for receipts only
 * - Public transparency metrics
 */

const { ObjectId } = require('mongodb');
const { getCollection } = require('../utils/db.util');

class Donation {
  /**
   * Create a new donation record
   */
  static async create(data) {
    const collection = await getCollection('koha_donations');

    const donation = {
      // Donation details
      amount: data.amount, // In cents (in the specified currency)
      currency: data.currency || 'nzd',
      amount_nzd: data.amount_nzd || data.amount, // Amount in NZD for transparency calculations
      exchange_rate_to_nzd: data.exchange_rate_to_nzd || 1.0, // Exchange rate at donation time
      frequency: data.frequency, // 'monthly' or 'one_time'
      tier: data.tier, // '5', '15', '50', or 'custom'

      // Donor information (private)
      donor: {
        name: data.donor?.name || 'Anonymous',
        email: data.donor?.email, // Required for receipt, kept private
        country: data.donor?.country,
        // Do NOT store full address unless required for tax purposes
      },

      // Public acknowledgement (opt-in)
      public_acknowledgement: data.public_acknowledgement || false,
      public_name: data.public_name || null, // Name to show publicly if opted in

      // Stripe integration
      stripe: {
        customer_id: data.stripe?.customer_id,
        subscription_id: data.stripe?.subscription_id, // For monthly donations
        payment_intent_id: data.stripe?.payment_intent_id,
        charge_id: data.stripe?.charge_id,
        invoice_id: data.stripe?.invoice_id
      },

      // Status tracking
      status: data.status || 'pending', // pending, completed, failed, cancelled, refunded
      payment_date: data.payment_date || new Date(),

      // Receipt tracking
      receipt: {
        sent: false,
        sent_date: null,
        receipt_number: null
      },

      // Metadata
      metadata: {
        source: data.metadata?.source || 'website', // website, api, manual
        campaign: data.metadata?.campaign,
        referrer: data.metadata?.referrer,
        user_agent: data.metadata?.user_agent,
        ip_country: data.metadata?.ip_country
      },

      // Timestamps
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await collection.insertOne(donation);
    return { ...donation, _id: result.insertedId };
  }

  /**
   * Find donation by ID
   */
  static async findById(id) {
    const collection = await getCollection('koha_donations');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Find donation by Stripe subscription ID
   */
  static async findBySubscriptionId(subscriptionId) {
    const collection = await getCollection('koha_donations');
    return await collection.findOne({ 'stripe.subscription_id': subscriptionId });
  }

  /**
   * Find donation by Stripe payment intent ID
   */
  static async findByPaymentIntentId(paymentIntentId) {
    const collection = await getCollection('koha_donations');
    return await collection.findOne({ 'stripe.payment_intent_id': paymentIntentId });
  }

  /**
   * Find all donations by donor email (for admin/receipt purposes)
   */
  static async findByDonorEmail(email) {
    const collection = await getCollection('koha_donations');
    return await collection.find({ 'donor.email': email }).sort({ created_at: -1 }).toArray();
  }

  /**
   * Update donation status
   */
  static async updateStatus(id, status, additionalData = {}) {
    const collection = await getCollection('koha_donations');

    const updateData = {
      status,
      updated_at: new Date(),
      ...additionalData
    };

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Mark receipt as sent
   */
  static async markReceiptSent(id, receiptNumber) {
    const collection = await getCollection('koha_donations');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          'receipt.sent': true,
          'receipt.sent_date': new Date(),
          'receipt.receipt_number': receiptNumber,
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Cancel recurring donation (subscription)
   */
  static async cancelSubscription(subscriptionId) {
    const collection = await getCollection('koha_donations');

    const result = await collection.updateOne(
      { 'stripe.subscription_id': subscriptionId },
      {
        $set: {
          status: 'cancelled',
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Get transparency metrics (PUBLIC DATA)
   * Returns aggregated data for public transparency dashboard
   */
  static async getTransparencyMetrics() {
    const collection = await getCollection('koha_donations');

    // Get all completed donations
    const completedDonations = await collection.find({
      status: 'completed'
    }).toArray();

    // Calculate totals (convert all to NZD for consistent totals)
    const totalReceived = completedDonations.reduce((sum, d) => {
      // Use amount_nzd if available, otherwise use amount (backwards compatibility)
      const nzdAmount = d.amount_nzd || d.amount;
      return sum + nzdAmount;
    }, 0) / 100; // Convert cents to dollars

    // Count monthly supporters (active subscriptions)
    const monthlyDonations = completedDonations.filter(d => d.frequency === 'monthly');
    const activeSubscriptions = monthlyDonations.filter(d => d.status === 'completed');
    const monthlySupporters = new Set(activeSubscriptions.map(d => d.stripe.customer_id)).size;

    // Count one-time donations
    const oneTimeDonations = completedDonations.filter(d => d.frequency === 'one_time').length;

    // Get public acknowledgements (donors who opted in)
    const publicDonors = completedDonations
      .filter(d => d.public_acknowledgement && d.public_name)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 20) // Latest 20 donors
      .map(d => ({
        name: d.public_name,
        amount: d.amount / 100,
        currency: d.currency || 'nzd',
        amount_nzd: (d.amount_nzd || d.amount) / 100,
        date: d.created_at,
        frequency: d.frequency
      }));

    // Calculate monthly recurring revenue (in NZD)
    const monthlyRevenue = activeSubscriptions.reduce((sum, d) => {
      const nzdAmount = d.amount_nzd || d.amount;
      return sum + nzdAmount;
    }, 0) / 100;

    // Allocation breakdown (as per specification)
    const allocation = {
      hosting: 0.30,
      development: 0.40,
      research: 0.20,
      community: 0.10
    };

    return {
      total_received: totalReceived,
      monthly_supporters: monthlySupporters,
      one_time_donations: oneTimeDonations,
      monthly_recurring_revenue: monthlyRevenue,
      allocation: allocation,
      recent_donors: publicDonors,
      last_updated: new Date()
    };
  }

  /**
   * Get donation statistics (ADMIN ONLY)
   */
  static async getStatistics(startDate = null, endDate = null) {
    const collection = await getCollection('koha_donations');

    const query = { status: 'completed' };
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }

    const donations = await collection.find(query).toArray();

    return {
      total_count: donations.length,
      total_amount: donations.reduce((sum, d) => sum + d.amount, 0) / 100,
      by_frequency: {
        monthly: donations.filter(d => d.frequency === 'monthly').length,
        one_time: donations.filter(d => d.frequency === 'one_time').length
      },
      by_tier: {
        tier_5: donations.filter(d => d.tier === '5').length,
        tier_15: donations.filter(d => d.tier === '15').length,
        tier_50: donations.filter(d => d.tier === '50').length,
        custom: donations.filter(d => d.tier === 'custom').length
      },
      average_donation: donations.length > 0
        ? (donations.reduce((sum, d) => sum + d.amount, 0) / donations.length) / 100
        : 0,
      public_acknowledgements: donations.filter(d => d.public_acknowledgement).length
    };
  }

  /**
   * Get all donations (ADMIN ONLY - paginated)
   */
  static async findAll(options = {}) {
    const collection = await getCollection('koha_donations');

    const {
      page = 1,
      limit = 20,
      status = null,
      frequency = null,
      sortBy = 'created_at',
      sortOrder = -1
    } = options;

    const query = {};
    if (status) query.status = status;
    if (frequency) query.frequency = frequency;

    const skip = (page - 1) * limit;

    const donations = await collection
      .find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await collection.countDocuments(query);

    return {
      donations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Create database indexes for performance
   */
  static async createIndexes() {
    const collection = await getCollection('koha_donations');

    await collection.createIndex({ status: 1 });
    await collection.createIndex({ frequency: 1 });
    await collection.createIndex({ 'stripe.subscription_id': 1 });
    await collection.createIndex({ 'stripe.payment_intent_id': 1 });
    await collection.createIndex({ 'donor.email': 1 });
    await collection.createIndex({ created_at: -1 });
    await collection.createIndex({ public_acknowledgement: 1 });

    return true;
  }
}

module.exports = Donation;
