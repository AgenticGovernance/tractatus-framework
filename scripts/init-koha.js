/**
 * Initialize Koha Donation System
 * Creates database indexes and verifies setup
 */

require('dotenv').config();
const { connect, close, getCollection } = require('../src/utils/db.util');
const Donation = require('../src/models/Donation.model');

async function initializeKoha() {
  console.log('\n🎁 Koha Donation System Initialization\n');

  try {
    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await connect();
    console.log('✅ Connected to database:', process.env.MONGODB_DB);

    // Create indexes
    console.log('\n📊 Creating database indexes...');
    await Donation.createIndexes();
    console.log('✅ Indexes created successfully');

    // Verify collection exists
    const collection = await getCollection('koha_donations');
    const indexes = await collection.indexes();
    console.log(`\n✅ Collection 'koha_donations' ready with ${indexes.length} indexes:`);
    indexes.forEach((index, i) => {
      const keys = Object.keys(index.key).join(', ');
      console.log(`   ${i + 1}. ${index.name} (${keys})`);
    });

    // Check for existing donations
    const count = await collection.countDocuments();
    console.log(`\n📈 Current donations in database: ${count}`);

    // Test transparency metrics calculation
    console.log('\n🔍 Testing transparency metrics...');
    const metrics = await Donation.getTransparencyMetrics();
    console.log('✅ Transparency metrics calculated:');
    console.log(`   - Total received: $${metrics.total_received.toFixed(2)} NZD`);
    console.log(`   - Monthly supporters: ${metrics.monthly_supporters}`);
    console.log(`   - One-time donations: ${metrics.one_time_donations}`);
    console.log(`   - Monthly recurring revenue: $${metrics.monthly_recurring_revenue.toFixed(2)} NZD`);
    console.log(`   - Public donors: ${metrics.recent_donors.length}`);

    // Verify Stripe configuration
    console.log('\n🔑 Verifying Stripe configuration...');
    const stripeConfig = {
      secretKey: process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ? '✅ Set' : '❌ Missing',
      webhookSecret: process.env.STRIPE_KOHA_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing',
      price5: process.env.STRIPE_KOHA_5_PRICE_ID ? '✅ Set' : '⚠️  Missing (needs Stripe Dashboard setup)',
      price15: process.env.STRIPE_KOHA_15_PRICE_ID ? '✅ Set' : '⚠️  Missing (needs Stripe Dashboard setup)',
      price50: process.env.STRIPE_KOHA_50_PRICE_ID ? '✅ Set' : '⚠️  Missing (needs Stripe Dashboard setup)'
    };

    console.log(`   - Secret Key: ${stripeConfig.secretKey}`);
    console.log(`   - Publishable Key: ${stripeConfig.publishableKey}`);
    console.log(`   - Webhook Secret: ${stripeConfig.webhookSecret}`);
    console.log(`   - $5 NZD Price ID: ${stripeConfig.price5}`);
    console.log(`   - $15 NZD Price ID: ${stripeConfig.price15}`);
    console.log(`   - $50 NZD Price ID: ${stripeConfig.price50}`);

    // Warning if price IDs not set
    if (stripeConfig.price5.includes('Missing') ||
        stripeConfig.price15.includes('Missing') ||
        stripeConfig.price50.includes('Missing')) {
      console.log('\n⚠️  WARNING: Stripe Price IDs not configured!');
      console.log('   Follow the guide: docs/KOHA_STRIPE_SETUP.md');
      console.log('   Create products in Stripe Dashboard and update .env');
    }

    // Summary
    console.log('\n✅ Koha system initialized successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Create Stripe products (if not done): docs/KOHA_STRIPE_SETUP.md');
    console.log('   2. Start server: npm run dev');
    console.log('   3. Test donation form: http://localhost:9000/koha.html');
    console.log('   4. View transparency dashboard: http://localhost:9000/koha/transparency.html');
    console.log('   5. Test API endpoint: POST /api/koha/checkout\n');

  } catch (error) {
    console.error('\n❌ Initialization failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await close();
  }
}

// Run if called directly
if (require.main === module) {
  initializeKoha();
}

module.exports = initializeKoha;
