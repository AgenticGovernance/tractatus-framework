#!/usr/bin/env node

/**
 * Performance Audit Script
 *
 * Tests page load times and identifies optimization opportunities
 *
 * Copyright 2025 Tractatus Project
 * Licensed under Apache License 2.0
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`  ✓ ${message}`, 'green');
}

function warning(message) {
  log(`  ⚠ ${message}`, 'yellow');
}

function error(message) {
  log(`  ✗ ${message}`, 'red');
}

// Pages to test
const pages = [
  { name: 'Homepage', url: 'http://localhost:9000/' },
  { name: 'Researcher', url: 'http://localhost:9000/researcher.html' },
  { name: 'Implementer', url: 'http://localhost:9000/implementer.html' },
  { name: 'Advocate', url: 'http://localhost:9000/advocate.html' },
  { name: 'About', url: 'http://localhost:9000/about.html' },
  { name: 'Values', url: 'http://localhost:9000/about/values.html' },
  { name: 'Docs', url: 'http://localhost:9000/docs.html' },
  { name: 'Media Inquiry', url: 'http://localhost:9000/media-inquiry.html' },
  { name: 'Case Submission', url: 'http://localhost:9000/case-submission.html' }
];

/**
 * Fetch a page and measure load time
 */
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    http.get(url, (res) => {
      let data = '';
      let firstByteTime = null;

      res.on('data', (chunk) => {
        if (!firstByteTime) {
          firstByteTime = Date.now() - startTime;
        }
        data += chunk;
      });

      res.on('end', () => {
        const totalTime = Date.now() - startTime;
        const size = Buffer.byteLength(data, 'utf8');

        resolve({
          statusCode: res.statusCode,
          firstByteTime,
          totalTime,
          size,
          data
        });
      });

    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Analyze HTML for optimization opportunities
 */
function analyzeHTML(html) {
  const issues = [];

  // Check for inline scripts
  const inlineScriptMatches = html.match(/<script(?![^>]*src=)[^>]*>/g) || [];
  if (inlineScriptMatches.length > 3) {
    issues.push(`Many inline scripts (${inlineScriptMatches.length}) - consider bundling`);
  }

  // Check for large inline styles
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || [];
  const totalStyleLength = styleMatches.reduce((sum, style) => sum + style.length, 0);
  if (totalStyleLength > 5000) {
    issues.push(`Large inline styles (${(totalStyleLength / 1024).toFixed(1)}KB) - consider external CSS`);
  }

  // Check for unoptimized images
  const imgMatches = html.match(/<img[^>]*>/g) || [];
  const imgsWithoutAlt = imgMatches.filter(img => !img.includes('alt=')).length;
  if (imgsWithoutAlt > 0) {
    issues.push(`${imgsWithoutAlt} images without alt attributes`);
  }

  // Check for external resources
  const externalCSS = (html.match(/<link[^>]*rel="stylesheet"[^>]*>/g) || []).length;
  const externalJS = (html.match(/<script[^>]*src=[^>]*>/g) || []).length;

  return {
    inlineScripts: inlineScriptMatches.length,
    totalStyleLength,
    images: imgMatches.length,
    externalCSS,
    externalJS,
    issues
  };
}

/**
 * Main audit
 */
async function main() {
  log('═'.repeat(70), 'cyan');
  log('  Performance Audit', 'bright');
  log('═'.repeat(70), 'cyan');
  console.log('');

  const results = [];
  let totalTime = 0;
  let totalSize = 0;

  for (const page of pages) {
    try {
      const result = await fetchPage(page.url);
      const analysis = analyzeHTML(result.data);

      results.push({
        name: page.name,
        url: page.url,
        ...result,
        ...analysis
      });

      totalTime += result.totalTime;
      totalSize += result.size;

      // Display result
      const sizeKB = (result.size / 1024).toFixed(1);
      const timeStatus = result.totalTime < 100 ? 'green' : result.totalTime < 500 ? 'yellow' : 'red';

      log(`${page.name.padEnd(20)} ${result.totalTime}ms  ${sizeKB}KB`, timeStatus);

      if (analysis.issues.length > 0) {
        analysis.issues.forEach(issue => {
          log(`    • ${issue}`, 'yellow');
        });
      }

    } catch (err) {
      error(`${page.name.padEnd(20)} FAILED: ${err.message}`);
    }
  }

  // Summary
  console.log('');
  log('═'.repeat(70), 'cyan');
  log('  Summary', 'bright');
  log('═'.repeat(70), 'cyan');
  console.log('');

  const avgTime = (totalTime / results.length).toFixed(0);
  const avgSize = (totalSize / results.length / 1024).toFixed(1);

  log(`  Pages Tested: ${results.length}`, 'bright');
  log(`  Average Load Time: ${avgTime}ms`, avgTime < 200 ? 'green' : avgTime < 500 ? 'yellow' : 'red');
  log(`  Average Page Size: ${avgSize}KB`, avgSize < 50 ? 'green' : avgSize < 100 ? 'yellow' : 'red');
  log(`  Total Size: ${(totalSize / 1024).toFixed(1)}KB`, 'cyan');
  console.log('');

  // Performance grades
  const fast = results.filter(r => r.totalTime < 200).length;
  const medium = results.filter(r => r.totalTime >= 200 && r.totalTime < 500).length;
  const slow = results.filter(r => r.totalTime >= 500).length;

  success(`Fast (<200ms): ${fast} pages`);
  if (medium > 0) warning(`Medium (200-500ms): ${medium} pages`);
  if (slow > 0) error(`Slow (>500ms): ${slow} pages`);
  console.log('');

  // Recommendations
  log('  Recommendations:', 'bright');
  const allIssues = results.flatMap(r => r.issues);

  if (allIssues.length === 0) {
    success('No major performance issues detected!');
  } else {
    // Group similar issues
    const issueGroups = {};
    allIssues.forEach(issue => {
      const key = issue.split('(')[0].trim();
      issueGroups[key] = (issueGroups[key] || 0) + 1;
    });

    Object.entries(issueGroups).forEach(([issue, count]) => {
      log(`    • ${issue} (${count} pages)`, 'yellow');
    });
  }
  console.log('');

  // Save detailed report
  const reportPath = path.join(__dirname, '../audit-reports/performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      pagesТested: results.length,
      averageLoadTime: parseInt(avgTime),
      averageSize: parseFloat(avgSize),
      fast, medium, slow
    },
    results
  }, null, 2));

  success(`Detailed report saved: ${reportPath}`);
  console.log('');

  process.exit(0);
}

main().catch(err => {
  console.error('');
  error(`Performance audit failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
