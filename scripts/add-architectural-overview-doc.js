/**
 * Add Architectural Overview Document to MongoDB
 * Processes the architectural overview markdown and adds it to the documents collection
 */

const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');
const { generatePdf, generatePdfHtml } = require('./generate-pdfs.js');
const puppeteer = require('puppeteer');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';
const DB_NAME = process.env.MONGODB_DB || 'tractatus_dev';

// File paths
const MARKDOWN_FILE = path.join(__dirname, '../docs/research/architectural-overview.md');
const PDF_OUTPUT = path.join(__dirname, '../public/downloads/architectural-overview-and-research-status.pdf');

/**
 * Parse markdown content into sections
 */
function parseMarkdownSections(content) {
  // Remove copyright header
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // Split by h2 headers (##)
  const sections = [];
  const lines = content.split('\n');

  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    // Check for h2 header
    if (line.startsWith('## ')) {
      // Save previous section
      if (currentSection) {
        sections.push({
          title: currentSection,
          content: currentContent.join('\n').trim()
        });
      }

      // Start new section
      currentSection = line.substring(3).trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections.push({
      title: currentSection,
      content: currentContent.join('\n').trim()
    });
  }

  return sections;
}

/**
 * Generate slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Estimate reading time
 */
function estimateReadingTime(content) {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

/**
 * Extract excerpt from content
 */
function extractExcerpt(content, maxLength = 200) {
  // Remove markdown formatting
  let text = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/[*_~]/g, '') // Remove formatting
    .trim();

  // Get first paragraph or sentence
  const sentences = text.split(/[.!?]\s+/);
  let excerpt = sentences[0];

  if (excerpt.length > maxLength) {
    excerpt = excerpt.substring(0, maxLength).trim() + '...';
  }

  return excerpt;
}

/**
 * Create document sections from parsed markdown
 */
function createDocumentSections(parsedSections) {
  const documentSections = [];

  for (const [index, section] of parsedSections.entries()) {
    const contentHtml = marked.parse(section.content);

    documentSections.push({
      number: index + 1,
      title: section.title,
      slug: generateSlug(section.title),
      content_html: contentHtml,
      excerpt: extractExcerpt(section.content),
      readingTime: estimateReadingTime(section.content),
      technicalLevel: 'intermediate', // Default for architectural docs
      category: index <= 4 ? 'conceptual' : index <= 9 ? 'technical' : 'reference'
    });
  }

  return documentSections;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Adding Architectural Overview Document ===\n');

  let client;
  let browser;

  try {
    // Read markdown file
    console.log('Reading markdown file...');
    const markdown = await fs.readFile(MARKDOWN_FILE, 'utf8');
    console.log('✓ Markdown loaded\n');

    // Parse markdown
    console.log('Parsing markdown into sections...');
    const parsedSections = parseMarkdownSections(markdown);
    const sections = createDocumentSections(parsedSections);
    console.log(`✓ Parsed ${sections.length} sections\n`);

    // Convert full markdown to HTML for PDF
    const fullHtml = marked.parse(markdown.replace(/<!--[\s\S]*?-->/g, ''));

    // Create document object
    const document = {
      title: 'Tractatus Agentic Governance Framework',
      subtitle: 'Architectural Overview & Research Status',
      slug: 'architectural-overview-and-research-status',
      category: 'reference',
      excerpt: 'Comprehensive, anonymized architectural overview from inception through production-ready status. Includes system architecture, research phases, technology stack, API Memory observations, and future research directions.',
      content_html: fullHtml,
      sections: sections,
      toc: sections.map(s => ({
        title: s.title,
        slug: s.slug,
        level: 1
      })),
      metadata: {
        version: '1.0.0',
        date_updated: new Date('2025-10-11'),
        date_created: new Date('2025-10-11'),
        inception_date: '2024-Q3',
        classification: 'Research Documentation',
        status: 'Production-Ready Research System',
        phase: 'Phase 5 Complete'
      },
      tags: ['architecture', 'research', 'mongodb', 'api-memory', 'production-ready'],
      order: 1, // Show first in documentation
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    console.log('✓ Connected\n');

    // Insert or update document
    console.log('Saving document to MongoDB...');
    const result = await db.collection('documents').updateOne(
      { slug: document.slug },
      { $set: document },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      console.log('✓ Document inserted\n');
    } else {
      console.log('✓ Document updated\n');
    }

    // Generate PDF
    console.log('Generating PDF...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const html = generatePdfHtml(document);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: PDF_OUTPUT,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '2cm',
        right: '2cm',
        bottom: '2cm',
        left: '2cm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width: 100%; font-size: 9pt; text-align: center; color: #6b7280; padding: 0 2cm;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `
    });

    console.log(`✓ PDF generated: ${path.basename(PDF_OUTPUT)}\n`);

    // Summary
    console.log('=== Complete ===\n');
    console.log(`Document: ${document.title}`);
    console.log(`Sections: ${sections.length}`);
    console.log(`Slug: ${document.slug}`);
    console.log(`Version: ${document.metadata.version}`);
    console.log(`\nPDF: public/downloads/${path.basename(PDF_OUTPUT)}`);
    console.log(`MongoDB: documents collection (${result.upsertedCount > 0 ? 'inserted' : 'updated'})`);

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    if (client) await client.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
