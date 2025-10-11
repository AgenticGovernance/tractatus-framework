#!/usr/bin/env node

/**
 * Import Technical Documentation Script
 * Imports technical documentation (for developers/implementers) into the database
 */

// Load environment variables
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { getDb, close } = require('../src/utils/db.util');
const Document = require('../src/models/Document.model');
const { markdownToHtml, extractTOC } = require('../src/utils/markdown.util');
const { validateDocumentSecurity } = require('./validate-document-security');

// Technical documents to import (audience: technical)
// NOTE: Only documents with visibility: 'public' will be imported by default
// Documents marked 'internal' or 'confidential' require --allow-internal flag
const TECHNICAL_DOCS = [
  {
    file: 'docs/claude-code-framework-enforcement.md',
    title: 'Tractatus Framework Enforcement for Claude Code',
    slug: 'tractatus-framework-enforcement-for-claude-code',
    quadrant: 'SYSTEM',
    persistence: 'HIGH',
    audience: 'technical',
    visibility: 'public', // Safe to publish - implementation guide
    metadata: {
      author: 'John Stroh',
      version: '1.0',
      tags: ['claude-code', 'framework', 'implementation', 'governance'],
      document_code: 'TECH-001'
    }
  }
  // REMOVED: Security Audit, Koha Stripe Setup, Koha Deployment
  // These documents contain sensitive information and should NOT be public
];

async function importTechnicalDocs() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  Technical Documentation Import                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // Connect to database
    const db = await getDb();
    console.log('✓ Connected to database\n');

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const docConfig of TECHNICAL_DOCS) {
      const filePath = path.join(__dirname, '..', docConfig.file);

      try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.log(`⚠ File not found: ${docConfig.file}`);
          skipped++;
          continue;
        }

        // Check if document already exists
        const existing = await Document.findBySlug(docConfig.slug);
        if (existing) {
          console.log(`⚠ Already exists: ${docConfig.title}`);
          skipped++;
          continue;
        }

        // Read markdown file
        const content_markdown = fs.readFileSync(filePath, 'utf-8');

        // Security validation
        console.log(`  🔒 Running security validation...`);
        const securityCheck = validateDocumentSecurity(docConfig, content_markdown);

        if (!securityCheck.valid) {
          console.log(`  ❌ SECURITY VALIDATION FAILED:`);
          securityCheck.issues.forEach(issue => console.log(`     ${issue}`));
          console.log(`  ⚠️  Document blocked from import\n`);
          errors++;
          continue;
        }

        if (securityCheck.warnings.length > 0) {
          securityCheck.warnings.forEach(warning => console.log(`  ${warning}`));
        }

        // Convert to HTML
        const content_html = markdownToHtml(content_markdown);

        // Extract TOC
        const toc = extractTOC(content_markdown);

        // Create search index
        const search_index = `${docConfig.title} ${content_markdown}`.toLowerCase();

        // Create document
        const document = await Document.create({
          title: docConfig.title,
          slug: docConfig.slug,
          quadrant: docConfig.quadrant,
          persistence: docConfig.persistence,
          audience: docConfig.audience,
          visibility: docConfig.visibility || 'public',
          security_classification: securityCheck.classification,
          content_html,
          content_markdown,
          toc,
          metadata: {
            ...docConfig.metadata,
            date_created: new Date(),
            date_updated: new Date()
          },
          search_index,
          public: docConfig.visibility === 'public'
        });

        console.log(`✓ Imported: ${docConfig.title}`);
        console.log(`  Slug: ${docConfig.slug}`);
        console.log(`  Audience: ${docConfig.audience}`);
        console.log(`  Quadrant: ${docConfig.quadrant}\n`);
        imported++;

      } catch (error) {
        console.error(`✗ Error importing ${docConfig.file}:`, error.message);
        errors++;
      }
    }

    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`Summary:`);
    console.log(`  Imported: ${imported}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`  Errors:   ${errors}`);
    console.log('─────────────────────────────────────────────────────────────────\n');

    if (errors === 0) {
      console.log('✓ Technical documentation import completed successfully\n');
    } else {
      console.log('⚠ Import completed with errors\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('✗ Import failed:', error);
    process.exit(1);
  } finally {
    await close();
  }
}

// Run import
if (require.main === module) {
  importTechnicalDocs();
}

module.exports = { importTechnicalDocs };
