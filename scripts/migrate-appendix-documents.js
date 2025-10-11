#!/usr/bin/env node

/**
 * Migrate Appendix Documents to Technical Documentation
 *
 * Updates document records with:
 * - New descriptive titles (remove "Appendix" prefix)
 * - Audience classification (technical/researcher)
 * - Updated PDF download paths
 *
 * Copyright 2025 Tractatus Project
 * Licensed under Apache License 2.0
 */

require('dotenv').config();

const { connect, close, getCollection } = require('../src/utils/db.util');

const MIGRATIONS = [
  {
    // Appendix A: Code Examples → Implementation Guide
    oldFile: 'appendix-a-code-examples-and-implementation-details.pdf',
    newFile: 'implementation-guide-python-code-examples.pdf',
    updates: {
      title: 'Implementation Guide: Python Code Examples',
      slug: 'implementation-guide-python-code-examples',
      audience: 'technical',
      'metadata.tags': ['implementation', 'code-examples', 'python', 'technical'],
      'download_formats.pdf': '/downloads/implementation-guide-python-code-examples.pdf'
    }
  },
  {
    // Appendix B: Case Studies (already properly named, just update audience)
    oldFile: 'case-studies-real-world-llm-failure-modes.pdf',
    newFile: 'case-studies-real-world-llm-failure-modes.pdf',
    updates: {
      audience: 'technical', // Dual audience: technical + researcher
      'metadata.tags': ['case-studies', 'failures', 'research', 'technical'],
    }
  },
  {
    // Appendix C: Implementation Roadmap
    oldFile: 'appendix-c-implementation-roadmap.pdf',
    newFile: 'implementation-roadmap-24-month-deployment-plan.pdf',
    updates: {
      title: 'Implementation Roadmap: 24-Month Deployment Plan',
      slug: 'implementation-roadmap-24-month-deployment-plan',
      audience: 'technical',
      'metadata.tags': ['roadmap', 'deployment', 'planning', 'technical'],
      'download_formats.pdf': '/downloads/implementation-roadmap-24-month-deployment-plan.pdf'
    }
  },
  {
    // Appendix D: Research Review
    oldFile: 'appendix-d-research-review-and-scholarly-context.pdf',
    newFile: 'research-foundations-scholarly-review-and-context.pdf',
    updates: {
      title: 'Research Foundations: Scholarly Review and Context',
      slug: 'research-foundations-scholarly-review-and-context',
      audience: 'researcher',
      'metadata.tags': ['research', 'scholarly', 'academic', 'foundations'],
      'download_formats.pdf': '/downloads/research-foundations-scholarly-review-and-context.pdf'
    }
  }
];

async function migrate() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Migrate Appendix Documents to Technical Documentation ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    await connect();
    console.log('✓ Connected to MongoDB\n');

    const collection = await getCollection('documents');

    for (const migration of MIGRATIONS) {
      console.log(`\n▶ Processing: ${migration.oldFile}`);

      // Find document by old filename
      const query = {
        $or: [
          { 'download_formats.pdf': { $regex: migration.oldFile } },
          { slug: migration.oldFile.replace('.pdf', '') }
        ]
      };

      const doc = await collection.findOne(query);

      if (!doc) {
        console.log(`  ⚠ Document not found in database - may need manual creation`);
        continue;
      }

      // Update document
      const result = await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            ...migration.updates,
            'metadata.date_updated': new Date()
          }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`  ✓ Updated: ${migration.updates.title || doc.title}`);
        console.log(`    - Audience: ${migration.updates.audience}`);
        console.log(`    - New file: ${migration.newFile}`);
      } else {
        console.log(`  ⚠ No changes made (already up to date)`);
      }
    }

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('Migration complete!');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await close();
  }
}

// Run migration
if (require.main === module) {
  migrate();
}

module.exports = migrate;
