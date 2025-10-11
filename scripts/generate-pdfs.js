/**
 * PDF Generation Script
 * Generates well-formatted PDFs from markdown documents
 */

const puppeteer = require('puppeteer');
const marked = require('marked');
const fs = require('fs').promises;
const path = require('path');
const { MongoClient } = require('mongodb');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';
const DB_NAME = process.env.MONGODB_DB || 'tractatus_dev';

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../public/downloads');

/**
 * HTML template for PDF generation
 */
function generatePdfHtml(document) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${document.title}</title>
  <style>
    @page {
      margin: 2cm;
      size: A4;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1f2937;
      max-width: 100%;
      margin: 0;
      padding: 0;
    }

    /* Cover page */
    .cover {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 2cm;
    }

    .cover h1 {
      font-size: 2.5rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 1rem;
      line-height: 1.2;
    }

    .cover .metadata {
      font-size: 1rem;
      color: #6b7280;
      margin-top: 2rem;
    }

    .cover .metadata p {
      margin: 0.5rem 0;
    }

    /* Content */
    .content {
      color: #374151;
    }

    h1 {
      font-size: 1.875rem;
      font-weight: 700;
      color: #111827;
      margin-top: 2rem;
      margin-bottom: 1rem;
      line-height: 1.2;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 0.5rem;
      page-break-after: avoid;
    }

    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #111827;
      margin-top: 1.75rem;
      margin-bottom: 0.875rem;
      line-height: 1.3;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 0.375rem;
      page-break-after: avoid;
    }

    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      line-height: 1.4;
      page-break-after: avoid;
    }

    h4 {
      font-size: 1.125rem;
      font-weight: 600;
      color: #374151;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
      line-height: 1.5;
      page-break-after: avoid;
    }

    p {
      margin-bottom: 1rem;
      line-height: 1.75;
      orphans: 3;
      widows: 3;
    }

    ul, ol {
      margin-bottom: 1rem;
      padding-left: 1.75rem;
      line-height: 1.75;
    }

    li {
      margin-bottom: 0.375rem;
    }

    ul ul,
    ol ul {
      list-style-type: circle;
      margin-top: 0.375rem;
      margin-bottom: 0.375rem;
    }

    ul ol,
    ol ol {
      list-style-type: lower-alpha;
      margin-top: 0.375rem;
      margin-bottom: 0.375rem;
    }

    code {
      background-color: #f3f4f6;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      font-family: "Courier New", Courier, monospace;
      color: #1f2937;
      border: 1px solid #e5e7eb;
    }

    pre {
      background-color: #f9fafb;
      color: #1f2937;
      padding: 1rem;
      border-radius: 0.375rem;
      margin-bottom: 1rem;
      overflow-x: auto;
      border: 1px solid #d1d5db;
      page-break-inside: avoid;
    }

    pre code {
      background-color: transparent;
      padding: 0;
      border: none;
      color: inherit;
      font-size: 0.8125rem;
      line-height: 1.5;
    }

    blockquote {
      border-left: 4px solid #3b82f6;
      padding-left: 1rem;
      font-style: italic;
      color: #6b7280;
      margin: 1.25rem 0;
      background-color: #f9fafb;
      padding: 0.875rem 0.875rem 0.875rem 1rem;
      border-radius: 0.25rem;
      page-break-inside: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.25rem;
      font-size: 0.875rem;
      page-break-inside: avoid;
    }

    th {
      background-color: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 0.625rem 0.875rem;
      text-align: left;
      font-weight: 600;
      color: #111827;
    }

    td {
      border: 1px solid #d1d5db;
      padding: 0.625rem 0.875rem;
      color: #374151;
    }

    tbody tr:nth-child(even) {
      background-color: #f9fafb;
    }

    a {
      color: #2563eb;
      text-decoration: underline;
    }

    strong, b {
      font-weight: 600;
      color: #111827;
    }

    em, i {
      font-style: italic;
    }

    hr {
      border: none;
      border-top: 1px solid #d1d5db;
      margin: 1.5rem 0;
    }

    /* Footer */
    .footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e5e7eb;
      font-size: 0.875rem;
      color: #6b7280;
      text-align: center;
    }

    /* Avoid breaking these elements */
    h1, h2, h3, h4, h5, h6 {
      page-break-inside: avoid;
    }

    pre, blockquote, table, figure {
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${document.title}</h1>
    <div class="metadata">
      ${document.metadata?.version ? `<p><strong>Version:</strong> ${document.metadata.version}</p>` : ''}
      ${document.metadata?.date_updated ? `<p><strong>Last Updated:</strong> ${new Date(document.metadata.date_updated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
      <p><strong>Document Type:</strong> ${document.category || 'Framework Documentation'}</p>
      <p style="margin-top: 2rem; font-style: italic;">Tractatus AI Safety Framework</p>
      <p style="font-size: 0.875rem;">https://agenticgovernance.digital</p>
    </div>
  </div>

  <div class="content">
    ${document.content_html}
  </div>

  <div class="footer">
    <p>© ${new Date().getFullYear()} Tractatus AI Safety Framework</p>
    <p>This document is part of the Tractatus Agentic Governance System</p>
    <p>https://agenticgovernance.digital</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate PDF for a single document
 */
async function generatePdf(document, browser) {
  try {
    const page = await browser.newPage();

    // Generate HTML content
    const html = generatePdfHtml(document);

    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    });

    // Generate filename
    const filename = `${document.slug}.pdf`;
    const filepath = path.join(OUTPUT_DIR, filename);

    // Generate PDF
    await page.pdf({
      path: filepath,
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

    await page.close();

    console.log(`  ✓ Generated: ${filename}`);
    return { success: true, filename };

  } catch (error) {
    console.error(`  ✗ Failed to generate PDF for ${document.slug}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=== PDF Generation ===\n');

  let client;
  let browser;

  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Output directory: ${OUTPUT_DIR}\n`);

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    console.log('✓ Connected\n');

    // Fetch all documents
    const documents = await db.collection('documents')
      .find({})
      .sort({ title: 1 })
      .toArray();

    console.log(`Found ${documents.length} published documents\n`);

    if (documents.length === 0) {
      console.log('No documents to process');
      return;
    }

    // Launch Puppeteer
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✓ Browser ready\n');

    // Generate PDFs
    const results = [];
    for (const doc of documents) {
      console.log(`Processing: ${doc.title}`);
      const result = await generatePdf(doc, browser);
      results.push(result);
    }

    // Summary
    console.log('\n=== Generation Complete ===\n');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`✓ Successful: ${successful}`);
    if (failed > 0) {
      console.log(`✗ Failed: ${failed}`);
    }
    console.log(`\nPDFs saved to: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('\n✗ Error:', error.message);
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

module.exports = { generatePdf, generatePdfHtml };
