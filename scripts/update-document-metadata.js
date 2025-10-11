/**
 * Update Document Metadata and Ordering
 * Sets proper order, category, and audience for public documents
 */

const { MongoClient } = require('mongodb');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';
const DB_NAME = process.env.MONGODB_DB || 'tractatus_dev';

// Document metadata updates
const DOCUMENT_UPDATES = [
  // GETTING STARTED (order: 1-3)
  {
    slug: 'architectural-overview-and-research-status',
    order: 1,
    category: 'reference',
    audience: 'general',
    visibility: 'public'
  },
  {
    slug: 'core-concepts-of-the-tractatus-framework',
    order: 2,
    category: 'conceptual',
    audience: 'general',
    visibility: 'public'
  },
  {
    slug: 'implementation-guide',
    order: 3,
    category: 'practical',
    audience: 'technical',
    visibility: 'public'
  },
  // FRAMEWORK DETAILS (order: 4-6)
  {
    slug: 'tractatus-ai-safety-framework-core-values-and-principles',
    order: 4,
    category: 'conceptual',
    audience: 'general',
    visibility: 'public'
  },
  {
    slug: 'case-studies-real-world-llm-failure-modes',
    order: 5,
    category: 'practical',
    audience: 'general',
    visibility: 'public'
  },
  {
    slug: 'ai-governance-business-case-template-tractatus-framework',
    order: 6,
    category: 'practical',
    audience: 'business',
    visibility: 'public'
  },
  // REFERENCE (order: 7)
  {
    slug: 'tractatus-agentic-governance-system-glossary-of-terms',
    order: 7,
    category: 'reference',
    audience: 'general',
    visibility: 'public'
  }
];

async function main() {
  console.log('=== Updating Document Metadata ===\n');

  let client;

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const collection = db.collection('documents');
    console.log('✓ Connected\n');

    let updated = 0;
    let notFound = 0;

    // Update each document
    for (const doc of DOCUMENT_UPDATES) {
      console.log(`Updating: ${doc.slug}`);
      console.log(`  Order: ${doc.order} | Category: ${doc.category} | Audience: ${doc.audience}`);

      const result = await collection.updateOne(
        { slug: doc.slug },
        {
          $set: {
            order: doc.order,
            category: doc.category,
            audience: doc.audience,
            visibility: doc.visibility
          }
        }
      );

      if (result.matchedCount > 0) {
        console.log(`  ✓ Updated\n`);
        updated++;
      } else {
        console.log(`  ⚠ Not found in database\n`);
        notFound++;
      }
    }

    // Summary
    console.log('=== Summary ===\n');
    console.log(`✓ Updated: ${updated} documents`);
    if (notFound > 0) {
      console.log(`⚠ Not found: ${notFound} documents`);
    }
    console.log(`\nTotal processed: ${DOCUMENT_UPDATES.length}`);

    // Verify organization
    console.log('\n=== Verification ===\n');
    const publicDocs = await collection.find({ visibility: 'public' })
      .sort({ order: 1 })
      .project({ title: 1, order: 1, category: 1, audience: 1 })
      .toArray();

    console.log('Public documents (sorted by order):');
    publicDocs.forEach(doc => {
      console.log(`  ${doc.order}. ${doc.title}`);
      console.log(`     Category: ${doc.category} | Audience: ${doc.audience}\n`);
    });

    const archivedCount = await collection.countDocuments({ visibility: 'archived' });
    console.log(`\n📦 Archived: ${archivedCount} documents`);
    console.log(`📖 Public: ${publicDocs.length} documents`);

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
