#!/usr/bin/env node
/**
 * Reorganize docs.html sidebar - Update document metadata for better UX
 *
 * New structure based on audience and expertise level:
 * - Introduction (1-5): Absolute beginners, all audiences
 * - Implementation (10-19): Practical/technical for implementers
 * - Case Studies (20-29): Real-world examples, all audiences
 * - Business Strategy (30-35): Leaders/decision makers
 * - Advanced Topics (40-49): Deep technical for experts
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';

// Document reorganization mapping
// Format: { slug: { order, category, audience, description } }
const DOCUMENT_MAPPING = {
  // INTRODUCTION (1-5) - Absolute beginners, all audiences
  'architectural-overview-and-research-status': {
    order: 1,
    category: 'introduction',
    audience: 'general',
    description: 'Start here - overview of the Tractatus Framework'
  },
  'core-concepts-of-the-tractatus-framework': {
    order: 2,
    category: 'introduction',
    audience: 'general',
    description: 'Core concepts and principles'
  },
  'tractatus-ai-safety-framework-core-values-and-principles': {
    order: 3,
    category: 'introduction',
    audience: 'general',
    description: 'Values and principles'
  },
  'technical-architecture': {
    order: 4,
    category: 'introduction',
    audience: 'technical',
    description: 'System architecture overview'
  },
  'tractatus-agentic-governance-system-glossary-of-terms': {
    order: 5,
    category: 'introduction',
    audience: 'general',
    description: 'Glossary and terminology'
  },

  // IMPLEMENTATION (10-19) - Practical/technical for implementers
  'implementation-guide': {
    order: 10,
    category: 'implementation',
    audience: 'implementer',
    description: 'Complete implementation guide'
  },
  'tractatus-framework-implementation-guide': {
    order: 11,
    category: 'implementation',
    audience: 'implementer',
    description: 'Implementation guide v1.1 (detailed)'
  },
  'comparison-matrix-claude-code-claudemd-and-tractatus-framework': {
    order: 12,
    category: 'implementation',
    audience: 'implementer',
    description: 'Comparing different governance approaches'
  },

  // CASE STUDIES (20-29) - Real-world examples, all audiences
  'the-27027-incident-a-case-study-in-pattern-recognition-bias': {
    order: 20,
    category: 'case-studies',
    audience: 'general',
    description: 'The famous 27027 incident - pattern recognition bias'
  },
  'our-framework-in-action-detecting-and-correcting-ai-fabrications': {
    order: 21,
    category: 'case-studies',
    audience: 'general',
    description: 'How Tractatus catches AI fabrications'
  },
  'when-frameworks-fail-and-why-thats-ok': {
    order: 22,
    category: 'case-studies',
    audience: 'general',
    description: 'Learning from framework failures'
  },
  'real-world-ai-governance-a-case-study-in-framework-failure-and-recovery': {
    order: 23,
    category: 'case-studies',
    audience: 'general',
    description: 'Failure analysis and recovery process'
  },
  'framework-governance-in-action-pre-publication-security-audit': {
    order: 24,
    category: 'case-studies',
    audience: 'technical',
    description: 'Security audit before publication'
  },
  'case-studies-real-world-llm-failure-modes': {
    order: 25,
    category: 'case-studies',
    audience: 'researcher',
    description: 'Collection of real-world LLM failures'
  },

  // BUSINESS STRATEGY (30-35) - Leaders/decision makers
  'ai-governance-business-case-template-tractatus-framework': {
    order: 30,
    category: 'business',
    audience: 'leader',
    description: 'Business case template for AI governance'
  }
};

async function reorganizeDocuments() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Reorganizing Documentation Sidebar Structure            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');

    const db = client.db();
    const documentsCollection = db.collection('documents');

    // Get all documents
    const allDocs = await documentsCollection.find({}).toArray();
    console.log(`Found ${allDocs.length} total documents\n`);

    let updated = 0;
    let skipped = 0;

    // Update each mapped document
    for (const [slug, metadata] of Object.entries(DOCUMENT_MAPPING)) {
      const doc = allDocs.find(d => d.slug === slug);

      if (!doc) {
        console.log(`⚠  Document not found: ${slug}`);
        skipped++;
        continue;
      }

      const updateFields = {
        order: metadata.order,
        category: metadata.category,
        audience: metadata.audience,
        updatedAt: new Date()
      };

      await documentsCollection.updateOne(
        { slug },
        { $set: updateFields }
      );

      console.log(`✓ Updated: ${doc.title}`);
      console.log(`  Order: ${metadata.order} | Category: ${metadata.category} | Audience: ${metadata.audience}\n`);
      updated++;
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log(`✓ Updated: ${updated} documents`);
    console.log(`⊘ Skipped: ${skipped} documents`);
    console.log(`\n═══════════════════════════════════════════════════════════\n`);

    // Show new category distribution
    console.log('New Category Distribution:\n');

    const categories = {
      introduction: { count: 0, orders: '1-5' },
      implementation: { count: 0, orders: '10-19' },
      'case-studies': { count: 0, orders: '20-29' },
      business: { count: 0, orders: '30-35' },
      advanced: { count: 0, orders: '40-49' }
    };

    Object.values(DOCUMENT_MAPPING).forEach(meta => {
      if (categories[meta.category]) {
        categories[meta.category].count++;
      }
    });

    console.log(`  📘 Introduction (${categories.introduction.count} docs) - Orders ${categories.introduction.orders}`);
    console.log(`  ⚙️  Implementation (${categories.implementation.count} docs) - Orders ${categories.implementation.orders}`);
    console.log(`  📊 Case Studies (${categories['case-studies'].count} docs) - Orders ${categories['case-studies'].orders}`);
    console.log(`  💼 Business Strategy (${categories.business.count} docs) - Orders ${categories.business.orders}`);
    console.log(`  🔬 Advanced Topics (${categories.advanced.count} docs) - Orders ${categories.advanced.orders}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✓ Database connection closed');
  }
}

// Run
reorganizeDocuments().catch(console.error);
