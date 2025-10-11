#!/usr/bin/env node
/**
 * Document Migration Script
 * Migrates markdown documents into the MongoDB database
 *
 * Usage:
 *   npm run migrate:docs                    # Interactive mode
 *   node scripts/migrate-documents.js --source /path/to/docs --dry-run
 *   node scripts/migrate-documents.js --source /path/to/docs --force
 */

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const { connect, close } = require('../src/utils/db.util');
const Document = require('../src/models/Document.model');
const { markdownToHtml, extractTOC, generateSlug } = require('../src/utils/markdown.util');
const logger = require('../src/utils/logger.util');

// Parse command line arguments
const args = process.argv.slice(2);
const sourceArg = args.indexOf('--source');
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

// Default source paths
const DEFAULT_SOURCES = [
  '/home/theflow/projects/tractatus/docs/markdown',
  '/home/theflow/projects/sydigital/stochastic/innovation-exploration/anthropic-submission'
];

/**
 * Extract front matter from markdown
 */
function extractFrontMatter(content) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);

  if (!match) {
    return { frontMatter: {}, content };
  }

  const frontMatterText = match[1];
  const remainingContent = match[2];

  // Parse YAML-like front matter
  const frontMatter = {};
  frontMatterText.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      frontMatter[key.trim()] = value.replace(/^["']|["']$/g, ''); // Remove quotes
    }
  });

  return { frontMatter, content: remainingContent };
}

/**
 * Extract metadata from filename and content
 */
function extractMetadata(filename, content, frontMatter) {
  // Try to extract document identifier from filename
  // Patterns: TRA-VAL-0001, STO-INN-0010, etc.
  const identifierMatch = filename.match(/([A-Z]{3}-[A-Z]{3}-\d{4})/);
  const identifier = identifierMatch ? identifierMatch[1] : null;

  // Extract quadrant from identifier
  let quadrant = null;
  if (identifier) {
    const [quad] = identifier.split('-');
    const quadrantMap = {
      'STR': 'strategic',
      'OPS': 'operational',
      'TAC': 'tactical',
      'SYS': 'system',
      'STO': 'stochastic'
    };
    quadrant = quadrantMap[quad] || null;
  }

  // Extract title from first H1 or front matter
  let title = frontMatter.title || null;
  if (!title) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    title = h1Match ? h1Match[1] : path.basename(filename, '.md');
  }

  // Extract version from identifier or front matter
  let version = frontMatter.version || '1.0';
  if (identifier && identifier.match(/v(\d+-\d+)/)) {
    version = identifier.match(/v(\d+-\d+)/)[1].replace('-', '.');
  }

  // Determine document type
  let type = frontMatter.type || 'governance';
  if (filename.includes('technical-proposal')) type = 'technical';
  else if (filename.includes('appendix')) type = 'technical';
  else if (filename.includes('framework')) type = 'framework';
  else if (filename.includes('whitepaper')) type = 'research';
  else if (filename.includes('case-stud')) type = 'case-study';

  // Extract author
  const author = frontMatter.author || 'System';

  // Extract tags
  const tags = frontMatter.tags
    ? frontMatter.tags.split(',').map(t => t.trim())
    : [];

  return {
    identifier,
    title,
    type,
    quadrant,
    version,
    author,
    tags,
    status: 'published'
  };
}

/**
 * Process a single markdown file
 */
async function processMarkdownFile(filePath, sourcePath) {
  const filename = path.basename(filePath);
  const rawContent = await fs.readFile(filePath, 'utf-8');

  // Extract front matter
  const { frontMatter, content } = extractFrontMatter(rawContent);

  // Extract metadata
  const metadata = extractMetadata(filename, content, frontMatter);

  // Convert to HTML
  const htmlContent = markdownToHtml(content);

  // Extract table of contents
  const tableOfContents = extractTOC(content);

  // Generate slug from title
  const slug = generateSlug(metadata.title);

  // Determine if document should be public
  // Internal document patterns (should NOT be public)
  const internalPatterns = [
    'session-handoff',
    'phase-2',
    'phase-3',
    'testing',
    'progress-report',
    'blog-post-outlines',
    'cost-estimates',
    'deployment-guide',
    'kickoff-checklist',
    'preparation-advisory',
    'soft-launch',
    'implementation-session',
    'test-suite'
  ];

  // Check if filename or slug matches internal patterns
  const isInternal = internalPatterns.some(pattern =>
    filename.toLowerCase().includes(pattern) ||
    slug.toLowerCase().includes(pattern)
  );

  // Check front matter for explicit public field
  const isPublic = frontMatter.public !== undefined
    ? frontMatter.public === true || frontMatter.public === 'true'
    : !isInternal; // Default to public unless it matches internal patterns

  // Build document object matching Document model schema
  const doc = {
    title: metadata.title,
    slug: slug,
    quadrant: metadata.quadrant,
    persistence: 'HIGH', // Default for technical documents
    content_html: htmlContent,
    content_markdown: content,
    toc: tableOfContents,
    public: isPublic,
    metadata: {
      author: metadata.author,
      version: metadata.version,
      document_code: metadata.identifier,
      tags: metadata.tags,
      original_filename: filename,
      source_path: path.relative(sourcePath, filePath),
      migrated_at: new Date()
    },
    search_index: content.toLowerCase(),
    translations: {},
    download_formats: {}
  };

  return doc;
}

/**
 * Find all markdown files in directory
 */
async function findMarkdownFiles(dirPath) {
  const files = [];

  async function scan(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scan(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Skip README files
        if (!entry.name.toLowerCase().includes('readme')) {
          files.push(fullPath);
        }
      }
    }
  }

  await scan(dirPath);
  return files;
}

/**
 * Main migration function
 */
async function migrate() {
  try {
    console.log('\n=== Tractatus Document Migration ===\n');

    // Determine source path
    let sourcePath;
    if (sourceArg !== -1 && args[sourceArg + 1]) {
      sourcePath = args[sourceArg + 1];
    } else {
      // Check default sources
      for (const defaultPath of DEFAULT_SOURCES) {
        try {
          const stat = await fs.stat(defaultPath);
          if (stat.isDirectory()) {
            const files = await fs.readdir(defaultPath);
            if (files.length > 0) {
              sourcePath = defaultPath;
              break;
            }
          }
        } catch (err) {
          // Path doesn't exist, try next
        }
      }
    }

    if (!sourcePath) {
      console.error('❌ No source path specified and no documents found in default locations.');
      console.log('\nUsage: npm run migrate:docs -- --source /path/to/docs');
      console.log('\nDefault locations checked:');
      DEFAULT_SOURCES.forEach(p => console.log(`  - ${p}`));
      process.exit(1);
    }

    console.log(`📂 Source: ${sourcePath}`);
    console.log(`🔍 Mode: ${dryRun ? 'DRY RUN (no changes)' : 'MIGRATION (will write to database)'}`);
    console.log('');

    // Find markdown files
    const markdownFiles = await findMarkdownFiles(sourcePath);

    if (markdownFiles.length === 0) {
      console.log('⚠️  No markdown files found.');
      process.exit(0);
    }

    console.log(`Found ${markdownFiles.length} markdown file(s):\n`);
    markdownFiles.forEach((file, i) => {
      console.log(`  ${i + 1}. ${path.relative(sourcePath, file)}`);
    });
    console.log('');

    if (!dryRun) {
      // Connect to database
      await connect();
    }

    // Process each file
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorsCount = 0;

    for (const filePath of markdownFiles) {
      try {
        const doc = await processMarkdownFile(filePath, sourcePath);
        const filename = path.basename(filePath);

        if (dryRun) {
          console.log(`✓ [DRY RUN] ${filename}`);
          console.log(`  Title: ${doc.title}`);
          console.log(`  Slug: ${doc.slug}`);
          console.log(`  Quadrant: ${doc.quadrant || 'none'}`);
          console.log(`  Code: ${doc.metadata.document_code || 'none'}`);
          console.log('');
          createdCount++;
        } else {
          // Check if document already exists by slug
          const existing = await Document.findBySlug(doc.slug);

          if (existing && !force) {
            console.log(`⊘ SKIPPED ${filename} (already exists: ${existing.slug})`);
            skippedCount++;
          } else if (existing && force) {
            // Update existing document
            const updatedDoc = await Document.update(existing._id, doc);
            console.log(`↻ UPDATED ${filename} (${updatedDoc.slug})`);
            updatedCount++;
          } else {
            // Create new document
            const createdDoc = await Document.create(doc);
            console.log(`✓ CREATED ${filename} (${createdDoc.slug})`);
            createdCount++;
          }
        }

      } catch (error) {
        console.error(`✗ ERROR processing ${path.basename(filePath)}: ${error.message}`);
        logger.error(`Migration error for ${filePath}:`, error);
        errorsCount++;
      }
    }

    // Summary
    console.log('\n=== Migration Summary ===\n');
    console.log(`  Total files: ${markdownFiles.length}`);
    console.log(`  Created: ${createdCount}`);
    console.log(`  Updated: ${updatedCount}`);
    console.log(`  Skipped: ${skippedCount}`);
    console.log(`  Errors: ${errorsCount}`);
    console.log('');

    if (dryRun) {
      console.log('💡 This was a dry run. No changes were made.');
      console.log('   Run without --dry-run to perform actual migration.');
    }

    if (!dryRun) {
      logger.info(`Document migration completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${errorsCount} errors`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    logger.error('Migration error:', error);
    process.exit(1);
  } finally {
    if (!dryRun) {
      await close();
    }
  }
}

// Run if called directly
if (require.main === module) {
  migrate();
}

module.exports = migrate;
