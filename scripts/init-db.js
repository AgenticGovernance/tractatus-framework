#!/usr/bin/env node
/**
 * Database Initialization Script for Tractatus
 *
 * Creates all required collections and indexes for the Tractatus platform
 * Run with: node scripts/init-db.js
 */

const { MongoClient } = require('mongodb');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';
const DB_NAME = process.env.MONGODB_DB || 'tractatus_dev';

/**
 * Collection schemas and indexes
 */
const COLLECTIONS = {
  documents: {
    indexes: [
      { keys: { slug: 1 }, options: { unique: true } },
      { keys: { quadrant: 1 } },
      { keys: { 'metadata.document_code': 1 } },
      { keys: { search_index: 'text' } },
      { keys: { 'metadata.date_created': -1 } }
    ]
  },

  blog_posts: {
    indexes: [
      { keys: { slug: 1 }, options: { unique: true } },
      { keys: { status: 1 } },
      { keys: { published_at: -1 } },
      { keys: { 'author.type': 1 } },
      { keys: { tags: 1 } }
    ]
  },

  media_inquiries: {
    indexes: [
      { keys: { 'contact.email': 1 } },
      { keys: { status: 1 } },
      { keys: { created_at: -1 } },
      { keys: { 'ai_triage.urgency': 1 } }
    ]
  },

  case_submissions: {
    indexes: [
      { keys: { 'submitter.email': 1 } },
      { keys: { 'moderation.status': 1 } },
      { keys: { submitted_at: -1 } },
      { keys: { 'ai_review.relevance_score': -1 } }
    ]
  },

  resources: {
    indexes: [
      { keys: { url: 1 }, options: { unique: true } },
      { keys: { category: 1 } },
      { keys: { status: 1 } },
      { keys: { alignment_score: -1 } }
    ]
  },

  moderation_queue: {
    indexes: [
      { keys: { item_type: 1 } },
      { keys: { status: 1 } },
      { keys: { priority: 1 } },
      { keys: { created_at: -1 } },
      { keys: { quadrant: 1 } }
    ]
  },

  users: {
    indexes: [
      { keys: { email: 1 }, options: { unique: true } },
      { keys: { role: 1 } },
      { keys: { created_at: -1 } }
    ]
  },

  citations: {
    indexes: [
      { keys: { document_id: 1 } },
      { keys: { citation_type: 1 } },
      { keys: { cited_at: -1 } }
    ]
  },

  translations: {
    indexes: [
      { keys: { original_id: 1, language: 1 }, options: { unique: true } },
      { keys: { language: 1 } },
      { keys: { status: 1 } }
    ]
  },

  koha_donations: {
    indexes: [
      { keys: { stripe_payment_id: 1 }, options: { unique: true } },
      { keys: { 'donor.email': 1 } },
      { keys: { frequency: 1 } },
      { keys: { timestamp: -1 } },
      { keys: { status: 1 } }
    ]
  }
};

/**
 * Initialize database
 */
async function initializeDatabase() {
  console.log('🚀 Starting Tractatus database initialization...\n');
  console.log(`MongoDB URI: ${MONGODB_URI}`);
  console.log(`Database: ${DB_NAME}\n`);

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);

    // Get existing collections
    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map(c => c.name);

    // Create collections and indexes
    for (const [collectionName, config] of Object.entries(COLLECTIONS)) {
      console.log(`📦 Processing collection: ${collectionName}`);

      // Create collection if it doesn't exist
      if (!existingNames.includes(collectionName)) {
        await db.createCollection(collectionName);
        console.log(`   ✓ Created collection`);
      } else {
        console.log(`   ⊙ Collection already exists`);
      }

      // Create indexes
      const collection = db.collection(collectionName);
      for (const indexSpec of config.indexes) {
        try {
          const indexName = await collection.createIndex(
            indexSpec.keys,
            indexSpec.options || {}
          );
          console.log(`   ✓ Created index: ${indexName}`);
        } catch (error) {
          if (error.code === 85 || error.code === 86) {
            // Index already exists
            console.log(`   ⊙ Index already exists`);
          } else {
            throw error;
          }
        }
      }
      console.log('');
    }

    // Verify collections
    console.log('🔍 Verifying database setup...');
    const finalCollections = await db.listCollections().toArray();
    console.log(`   ✓ Total collections: ${finalCollections.length}`);

    // Display collection statistics
    console.log('\n📊 Collection Statistics:');
    for (const collectionName of Object.keys(COLLECTIONS)) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      const indexes = await collection.indexes();
      console.log(`   ${collectionName}:`);
      console.log(`     Documents: ${count}`);
      console.log(`     Indexes: ${indexes.length}`);
    }

    console.log('\n✨ Database initialization complete!\n');
    console.log('Next steps:');
    console.log('  1. Run document migration: npm run migrate:docs');
    console.log('  2. Create admin user: npm run seed:admin');
    console.log('  3. Start development server: npm run dev\n');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run initialization
if (require.main === module) {
  initializeDatabase().catch(console.error);
}

module.exports = { initializeDatabase, COLLECTIONS };
