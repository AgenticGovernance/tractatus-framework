/**
 * Add section-based cards to all existing documents
 * Parses documents and adds sections array for card-based UI
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { parseDocumentSections } = require('../src/utils/document-section-parser');
const { markdownToHtml } = require('../src/utils/markdown.util');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_prod';
const DOCS_DIR = process.env.DOCS_DIR || '/var/www/tractatus/docs/markdown';

async function main() {
  console.log('=== Adding Sections to Documents ===\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('documents');

    // Get all documents
    const documents = await collection.find({}).toArray();
    console.log(`Found ${documents.length} documents in database\n`);

    const markdownFiles = {
      'tractatus-agentic-governance-system-glossary-of-terms': 'GLOSSARY.md',
      'introduction-to-the-tractatus-framework': 'introduction.md',
      'core-concepts-of-the-tractatus-framework': 'core-concepts.md',
      'implementation-guide': 'implementation-guide.md',
      'case-studies-real-world-llm-failure-modes': 'case-studies.md'
    };

    for (const doc of documents) {
      console.log(`Processing: ${doc.title}`);

      const markdownFile = markdownFiles[doc.slug];
      if (!markdownFile) {
        console.log(`  ⚠ No markdown file found for ${doc.slug}`);
        continue;
      }

      const filePath = path.join(DOCS_DIR, markdownFile);
      if (!fs.existsSync(filePath)) {
        console.log(`  ⚠ File not found: ${filePath}`);
        continue;
      }

      // Read markdown content
      const markdown = fs.readFileSync(filePath, 'utf-8');

      // Parse sections
      const sections = parseDocumentSections(markdown, doc.content_html);

      // Add HTML content to each section
      const sectionsWithHtml = sections.map(section => ({
        ...section,
        content_html: markdownToHtml(section.content)
      }));

      console.log(`  ✓ Parsed ${sections.length} sections`);

      // Category breakdown
      const categoryCount = {};
      sectionsWithHtml.forEach(s => {
        categoryCount[s.category] = (categoryCount[s.category] || 0) + 1;
      });
      console.log(`    Categories:`, categoryCount);

      // Technical level breakdown
      const levelCount = {};
      sectionsWithHtml.forEach(s => {
        levelCount[s.technicalLevel] = (levelCount[s.technicalLevel] || 0) + 1;
      });
      console.log(`    Levels:`, levelCount);

      // Update document with sections
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            sections: sectionsWithHtml,
            'metadata.sections_count': sections.length,
            'metadata.last_section_update': new Date()
          }
        }
      );

      console.log(`  ✓ Updated document\n`);
    }

    console.log('=== Section Addition Complete ===');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
