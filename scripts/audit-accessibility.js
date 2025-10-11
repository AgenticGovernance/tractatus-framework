#!/usr/bin/env node

/**
 * Accessibility Audit Script
 *
 * Runs automated accessibility checks on all main pages
 * using pa11y (WCAG 2.1 AA standard)
 *
 * Copyright 2025 Tractatus Project
 * Licensed under Apache License 2.0
 */

const pa11y = require('pa11y');
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

function section(message) {
  console.log('');
  log(`▶ ${message}`, 'cyan');
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

// Pages to audit
const pages = [
  { name: 'Homepage', url: 'http://localhost:9000/' },
  { name: 'Researcher', url: 'http://localhost:9000/researcher.html' },
  { name: 'Implementer', url: 'http://localhost:9000/implementer.html' },
  { name: 'Leader', url: 'http://localhost:9000/leader.html' },
  { name: 'About', url: 'http://localhost:9000/about.html' },
  { name: 'Values', url: 'http://localhost:9000/about/values.html' },
  { name: 'Media Inquiry', url: 'http://localhost:9000/media-inquiry.html' },
  { name: 'Case Submission', url: 'http://localhost:9000/case-submission.html' },
  { name: 'Docs', url: 'http://localhost:9000/docs.html' }
];

// pa11y configuration
const pa11yConfig = {
  standard: 'WCAG2AA',
  timeout: 30000,
  wait: 1000,
  chromeLaunchConfig: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  // Common issues to ignore (if needed)
  ignore: []
};

async function auditPage(page) {
  try {
    const results = await pa11y(page.url, pa11yConfig);

    return {
      name: page.name,
      url: page.url,
      issues: results.issues,
      error: false
    };
  } catch (err) {
    return {
      name: page.name,
      url: page.url,
      error: true,
      errorMessage: err.message
    };
  }
}

function categorizeIssues(issues) {
  const categorized = {
    error: [],
    warning: [],
    notice: []
  };

  issues.forEach(issue => {
    categorized[issue.type].push(issue);
  });

  return categorized;
}

function printIssue(issue, index) {
  const typeColor = {
    error: 'red',
    warning: 'yellow',
    notice: 'cyan'
  };

  console.log('');
  log(`  ${index + 1}. [${issue.type.toUpperCase()}] ${issue.message}`, typeColor[issue.type]);
  log(`     Code: ${issue.code}`, 'reset');
  log(`     Element: ${issue.context.substring(0, 100)}${issue.context.length > 100 ? '...' : ''}`, 'reset');
  log(`     Selector: ${issue.selector}`, 'reset');
}

async function main() {
  log('═'.repeat(70), 'cyan');
  log('  Tractatus Accessibility Audit (WCAG 2.1 AA)', 'bright');
  log('═'.repeat(70), 'cyan');
  console.log('');

  const allResults = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalNotices = 0;

  for (const page of pages) {
    section(`Auditing: ${page.name}`);
    const result = await auditPage(page);
    allResults.push(result);

    if (result.error) {
      error(`Failed to audit: ${result.errorMessage}`);
      continue;
    }

    const categorized = categorizeIssues(result.issues);

    const errorCount = categorized.error.length;
    const warningCount = categorized.warning.length;
    const noticeCount = categorized.notice.length;

    totalErrors += errorCount;
    totalWarnings += warningCount;
    totalNotices += noticeCount;

    if (errorCount === 0 && warningCount === 0 && noticeCount === 0) {
      success(`No accessibility issues found!`);
    } else {
      if (errorCount > 0) error(`${errorCount} errors`);
      if (warningCount > 0) warning(`${warningCount} warnings`);
      if (noticeCount > 0) log(`  ℹ ${noticeCount} notices`, 'cyan');

      // Print first 3 errors/warnings
      const criticalIssues = [...categorized.error, ...categorized.warning].slice(0, 3);
      if (criticalIssues.length > 0) {
        log('  Top issues:', 'bright');
        criticalIssues.forEach((issue, idx) => {
          printIssue(issue, idx);
        });
      }
    }
  }

  // Summary
  console.log('');
  log('═'.repeat(70), 'cyan');
  log('  Summary', 'bright');
  log('═'.repeat(70), 'cyan');
  console.log('');

  log(`  Pages Audited: ${pages.length}`, 'bright');
  log(`  Total Errors: ${totalErrors}`, totalErrors > 0 ? 'red' : 'green');
  log(`  Total Warnings: ${totalWarnings}`, totalWarnings > 0 ? 'yellow' : 'green');
  log(`  Total Notices: ${totalNotices}`, 'cyan');
  console.log('');

  // Save detailed report
  const reportPath = path.join(__dirname, '../audit-reports/accessibility-report.json');
  const reportDir = path.dirname(reportPath);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    standard: 'WCAG 2.1 AA',
    summary: {
      pagesAudited: pages.length,
      totalErrors,
      totalWarnings,
      totalNotices
    },
    results: allResults
  }, null, 2));

  success(`Detailed report saved: ${reportPath}`);
  console.log('');

  // Exit code based on errors
  if (totalErrors > 0) {
    error('Accessibility audit FAILED - errors found');
    process.exit(1);
  } else if (totalWarnings > 0) {
    warning('Accessibility audit PASSED with warnings');
    process.exit(0);
  } else {
    success('Accessibility audit PASSED');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('');
  error(`Audit failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
