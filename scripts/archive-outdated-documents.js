/**
 * Archive Outdated Documents
 * Sets visibility: 'archived' for 10 documents identified in audit
 */

const { MongoClient } = require('mongodb');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';
const DB_NAME = process.env.MONGODB_DB || 'tractatus_dev';

// Documents to archive with reasons
const DOCUMENTS_TO_ARCHIVE = [
  {
    slug: 'introduction-to-the-tractatus-framework',
    category: 'archived',
    archiveNote: 'Superseded by Architectural Overview & Research Status. References outdated filesystem-only architecture.',
    reason: 'Outdated architecture (pre-MongoDB)'
  },
  {
    slug: 'tractatus-based-llm-architecture-for-ai-safety',
    category: 'archived',
    archiveNote: 'Historical architecture proposal. See Architectural Overview for implemented architecture.',
    reason: 'Pre-Phase 5 architecture proposal'
  },
  {
    slug: 'executive-brief-tractatus-based-llm-architecture-for-ai-safety',
    category: 'archived',
    archiveNote: 'Historical brief based on pre-Phase 5 architecture. See Architectural Overview for current status.',
    reason: 'Pre-Phase 5 executive brief'
  },
  {
    slug: 'tractatus-framework-enforcement-for-claude-code',
    category: 'archived',
    archiveNote: 'Development tool documentation. See Implementation Guide for production deployment.',
    reason: 'Internal development tool'
  },
  {
    slug: 'organizational-theory-foundations-of-the-tractatus-framework',
    category: 'archived',
    archiveNote: 'Academic foundations. See Core Concepts for practical overview.',
    reason: 'Academic content, not practical'
  },
  {
    slug: 'phase-5-poc-session-1-summary',
    category: 'project-tracking',
    archiveNote: 'Project tracking - Phase 5 Session 1. See Architectural Overview for complete project history.',
    reason: 'Project tracking'
  },
  {
    slug: 'phase-5-poc-session-2-summary',
    category: 'project-tracking',
    archiveNote: 'Project tracking - Phase 5 Session 2. See Architectural Overview for complete project history.',
    reason: 'Project tracking'
  },
  {
    slug: 'research-scope-feasibility-of-llm-integrated-tractatus-framework',
    category: 'research-proposal',
    archiveNote: 'Research proposal (not completed work). See Architectural Overview for actual implementation status.',
    reason: 'Research proposal'
  },
  {
    slug: 'research-topic-concurrent-session-architecture-limitations-in-claude-code-governance',
    category: 'research-topic',
    archiveNote: 'Open research question. See Architectural Overview for current architecture limitations.',
    reason: 'Open research question'
  },
  {
    slug: 'research-topic-rule-proliferation-and-transactional-overhead-in-ai-governance',
    category: 'research-topic',
    archiveNote: 'Open research question. See Architectural Overview for current governance approach.',
    reason: 'Open research question'
  }
];

async function main() {
  console.log('=== Archiving Outdated Documents ===\n');

  let client;

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const collection = db.collection('documents');
    console.log('✓ Connected\n');

    let archived = 0;
    let notFound = 0;

    // Archive each document
    for (const doc of DOCUMENTS_TO_ARCHIVE) {
      console.log(`Archiving: ${doc.slug}`);
      console.log(`  Reason: ${doc.reason}`);

      const result = await collection.updateOne(
        { slug: doc.slug },
        {
          $set: {
            visibility: 'archived',
            category: doc.category,
            archiveNote: doc.archiveNote,
            order: 999
          }
        }
      );

      if (result.matchedCount > 0) {
        console.log(`  ✓ Archived\n`);
        archived++;
      } else {
        console.log(`  ⚠ Not found in database\n`);
        notFound++;
      }
    }

    // Summary
    console.log('=== Summary ===\n');
    console.log(`✓ Archived: ${archived} documents`);
    if (notFound > 0) {
      console.log(`⚠ Not found: ${notFound} documents`);
    }
    console.log(`\nTotal processed: ${DOCUMENTS_TO_ARCHIVE.length}`);

    // Verify archives
    console.log('\n=== Verification ===\n');
    const archivedCount = await collection.countDocuments({ visibility: 'archived' });
    const publicCount = await collection.countDocuments({ visibility: 'public' });
    console.log(`Archived documents: ${archivedCount}`);
    console.log(`Public documents: ${publicCount}`);

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
