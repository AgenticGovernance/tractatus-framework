/**
 * Research PDF Generation Script
 * Generates PDFs from standalone markdown research documents
 */

const puppeteer = require('puppeteer');
const marked = require('marked');
const fs = require('fs').promises;
const path = require('path');

const RESEARCH_DIR = path.join(__dirname, '../docs/research');
const OUTPUT_DIR = path.join(__dirname, '../public/downloads');

/**
 * HTML template for research PDFs
 */
function generatePdfHtml(title, content, metadata = {}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
      max-width: 90%;
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
    <h1>${title}</h1>
    <div class="metadata">
      ${metadata.version ? `<p><strong>Version:</strong> ${metadata.version}</p>` : ''}
      ${metadata.date ? `<p><strong>Date:</strong> ${metadata.date}</p>` : ''}
      ${metadata.type ? `<p><strong>Document Type:</strong> ${metadata.type}</p>` : ''}
      <p style="margin-top: 2rem; font-style: italic;">Tractatus AI Safety Framework</p>
      <p style="font-size: 0.875rem;">https://agenticgovernance.digital</p>
    </div>
  </div>

  <div class="content">
    ${content}
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
 * Extract metadata from markdown frontmatter or header
 */
function extractMetadata(markdown) {
  const lines = markdown.split('\n');
  const metadata = {};

  // Look for title in first H1
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) {
    metadata.title = h1Match[1];
  }

  // Look for version
  const versionMatch = markdown.match(/\*\*Version:\*\*\s+(.+)/);
  if (versionMatch) {
    metadata.version = versionMatch[1];
  }

  // Look for date
  const dateMatch = markdown.match(/\*\*Date:\*\*\s+(.+)/);
  if (dateMatch) {
    metadata.date = dateMatch[1];
  }

  return metadata;
}

/**
 * Generate PDF from markdown file
 */
async function generatePdfFromMarkdown(inputFile, outputFilename, browser) {
  try {
    console.log(`\nProcessing: ${path.basename(inputFile)}`);

    // Read markdown
    const markdown = await fs.readFile(inputFile, 'utf-8');

    // Extract metadata
    const metadata = extractMetadata(markdown);
    const title = metadata.title || path.basename(inputFile, '.md');

    console.log(`  Title: ${title}`);

    // Convert markdown to HTML
    const contentHtml = marked.parse(markdown);

    // Generate full HTML
    const html = generatePdfHtml(title, contentHtml, {
      version: metadata.version,
      date: metadata.date,
      type: 'Research Paper'
    });

    // Create page
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    await page.pdf({
      path: outputPath,
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

    console.log(`  ✓ Generated: ${outputFilename}`);
    return { success: true, filename: outputFilename };

  } catch (error) {
    console.error(`  ✗ Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Research PDF Generation ===');

  let browser;

  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Output directory: ${OUTPUT_DIR}`);

    // Launch browser
    console.log('\nLaunching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✓ Browser ready');

    // Generate PDFs
    const results = [];

    // Full research paper
    results.push(await generatePdfFromMarkdown(
      path.join(RESEARCH_DIR, 'tractatus-inflection-point-2025.md'),
      'structural-governance-for-agentic-ai-tractatus-inflection-point.pdf',
      browser
    ));

    // Executive summary
    results.push(await generatePdfFromMarkdown(
      path.join(RESEARCH_DIR, 'executive-summary-tractatus-inflection-point.md'),
      'executive-summary-tractatus-inflection-point.pdf',
      browser
    ));

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
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generatePdfFromMarkdown, generatePdfHtml };
