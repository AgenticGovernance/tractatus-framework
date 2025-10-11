/**
 * Archive All Internal Documents
 * Mass archive of project tracking, internal, and confidential documents
 */

const { MongoClient } = require('mongodb');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';
const DB_NAME = process.env.MONGODB_DB || 'tractatus_dev';

// Documents to mark as confidential (not archived, just hidden)
const CONFIDENTIAL_DOCS = [
  'security-audit-report',
  'koha-stripe-payment-setup-guide',
  'koha-production-deployment-guide',
  'appendix-e-contact-information',
  'cover-letter-for-anthropic-submission'
];

// Documents to archive (project tracking, internal planning)
const ARCHIVE_PATTERNS = [
  'phase-2-', // All Phase 2 planning docs
  'session-handoff', // All session handoffs
  'appendix-b-', // Duplicate case studies
  'implementation-roadmap', // Outdated planning
  'implementation-guide-python', // Outdated code examples
  'research-foundations-scholarly', // Academic, not practical
  'tractatus-blog-post-outlines', // Internal planning
  'tractatus-project-implementation-progress-report', // Project tracking
  'tractatus-production-comprehensive-testing-checklist', // Internal testing
  'tractatus-production-testing-results', // Test results
  'tractatus-governance-framework-test-suite', // Internal testing
  'ai-features-implementation-session' // Session tracking
];

async function main() {
  console.log('=== Archiving All Internal Documents ===\n');

  let client;

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const collection = db.collection('documents');
    console.log('✓ Connected\n');

    // 1. Mark confidential documents
    console.log('=== Marking Confidential Documents ===\n');
    let confidentialCount = 0;

    for (const slug of CONFIDENTIAL_DOCS) {
      const result = await collection.updateOne(
        { slug },
        {
          $set: {
            visibility: 'confidential',
            category: 'internal',
            order: 999
          }
        }
      );

      if (result.matchedCount > 0) {
        console.log(`✓ Marked confidential: ${slug}`);
        confidentialCount++;
      }
    }
    console.log(`\n✓ Total confidential: ${confidentialCount}\n`);

    // 2. Archive documents matching patterns
    console.log('=== Archiving Project Tracking Documents ===\n');
    let archivedCount = 0;

    const allDocs = await collection.find({ visibility: { $ne: 'confidential' } }).toArray();

    for (const doc of allDocs) {
      const shouldArchive = ARCHIVE_PATTERNS.some(pattern =>
        doc.slug.includes(pattern)
      );

      if (shouldArchive && doc.visibility !== 'archived') {
        const result = await collection.updateOne(
          { _id: doc._id },
          {
            $set: {
              visibility: 'archived',
              category: 'project-tracking',
              order: 999,
              archiveNote: 'Internal project tracking document. Not relevant for public documentation.'
            }
          }
        );

        if (result.matchedCount > 0) {
          console.log(`✓ Archived: ${doc.slug}`);
          archivedCount++;
        }
      }
    }
    console.log(`\n✓ Total archived: ${archivedCount}\n`);

    // 3. Handle recent case studies (keep but categorize)
    console.log('=== Categorizing Case Studies ===\n');
    const caseStudySlugs = [
      'our-framework-in-action-detecting-and-correcting-ai-fabrications',
      'framework-governance-in-action-pre-publication-security-audit',
      'real-world-ai-governance-a-case-study-in-framework-failure-and-recovery',
      'when-frameworks-fail-and-why-thats-ok'
    ];

    let caseStudyCount = 0;
    for (const [index, slug] of caseStudySlugs.entries()) {
      const result = await collection.updateOne(
        { slug },
        {
          $set: {
            visibility: 'public',
            category: 'practical',
            audience: 'general',
            order: 8 + index // Orders 8-11
          }
        }
      );

      if (result.matchedCount > 0) {
        console.log(`✓ Categorized: ${slug} (order: ${8 + index})`);
        caseStudyCount++;
      }
    }
    console.log(`\n✓ Total case studies: ${caseStudyCount}\n`);

    // Summary
    console.log('=== Final Summary ===\n');
    const publicCount = await collection.countDocuments({ visibility: 'public' });
    const archivedTotal = await collection.countDocuments({ visibility: 'archived' });
    const confidentialTotal = await collection.countDocuments({ visibility: 'confidential' });

    console.log(`📖 Public documents: ${publicCount}`);
    console.log(`📦 Archived documents: ${archivedTotal}`);
    console.log(`🔒 Confidential documents: ${confidentialTotal}`);
    console.log(`\nTotal: ${publicCount + archivedTotal + confidentialTotal} documents\n`);

    // Show public documents
    console.log('=== Public Documents (Final List) ===\n');
    const publicDocs = await collection.find({ visibility: 'public' })
      .sort({ order: 1 })
      .project({ title: 1, order: 1, category: 1 })
      .toArray();

    publicDocs.forEach(doc => {
      console.log(`  ${doc.order}. ${doc.title} [${doc.category}]`);
    });

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
