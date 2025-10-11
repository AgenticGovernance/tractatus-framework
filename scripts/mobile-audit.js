#!/usr/bin/env node

/**
 * Mobile Responsiveness Audit
 *
 * Checks viewport configuration and touch target sizes (WCAG 2.5.5)
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
 * Fetch page HTML
 */
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Check viewport meta tag
 */
function checkViewport(html) {
  const viewportMatch = html.match(/<meta[^>]*name="viewport"[^>]*>/i);

  if (!viewportMatch) {
    return { exists: false, content: null, valid: false };
  }

  const contentMatch = viewportMatch[0].match(/content="([^"]*)"/i);
  const content = contentMatch ? contentMatch[1] : null;

  // Check for proper responsive viewport
  const hasWidth = content?.includes('width=device-width');
  const hasInitialScale = content?.includes('initial-scale=1');

  return {
    exists: true,
    content,
    valid: hasWidth && hasInitialScale
  };
}

/**
 * Analyze interactive elements for touch targets
 */
function analyzeTouchTargets(html) {
  const issues = [];

  // Check for small buttons (buttons should have min height/width via Tailwind)
  const buttons = html.match(/<button[^>]*>/g) || [];
  const buttonClasses = buttons.map(btn => {
    const classMatch = btn.match(/class="([^"]*)"/);
    return classMatch ? classMatch[1] : '';
  });

  // Check for links that might be too small
  const links = html.match(/<a[^>]*>(?![\s]*<)/g) || [];

  // Check for small padding on interactive elements
  const smallPadding = buttonClasses.filter(classes =>
    !classes.includes('p-') && !classes.includes('py-') && !classes.includes('px-')
  ).length;

  if (smallPadding > 0) {
    issues.push(`${smallPadding} buttons without explicit padding (may be too small)`);
  }

  // Check for form inputs
  const inputs = html.match(/<input[^>]*>/g) || [];
  const inputsWithSmallPadding = inputs.filter(input => {
    const classMatch = input.match(/class="([^"]*)"/);
    const classes = classMatch ? classMatch[1] : '';
    return !classes.includes('p-') && !classes.includes('py-');
  }).length;

  if (inputsWithSmallPadding > 0) {
    issues.push(`${inputsWithSmallPadding} form inputs may have insufficient padding`);
  }

  return {
    totalButtons: buttons.length,
    totalLinks: links.length,
    totalInputs: inputs.length,
    issues
  };
}

/**
 * Check for responsive design patterns
 */
function checkResponsivePatterns(html) {
  const patterns = {
    tailwindResponsive: (html.match(/\b(sm:|md:|lg:|xl:|2xl:)/g) || []).length,
    gridResponsive: (html.match(/grid-cols-1\s+(md:|lg:|xl:)grid-cols-/g) || []).length,
    flexResponsive: (html.match(/flex-col\s+(sm:|md:|lg:)flex-row/g) || []).length,
    hideOnMobile: (html.match(/\bhidden\s+(sm:|md:|lg:)block/g) || []).length
  };

  const totalResponsiveClasses = Object.values(patterns).reduce((a, b) => a + b, 0);

  return {
    ...patterns,
    totalResponsiveClasses,
    usesResponsiveDesign: totalResponsiveClasses > 10
  };
}

/**
 * Main audit
 */
async function main() {
  log('═'.repeat(70), 'cyan');
  log('  Mobile Responsiveness Audit', 'bright');
  log('═'.repeat(70), 'cyan');
  console.log('');

  const results = [];
  let passCount = 0;
  let failCount = 0;

  for (const page of pages) {
    try {
      const html = await fetchPage(page.url);

      const viewport = checkViewport(html);
      const touchTargets = analyzeTouchTargets(html);
      const responsive = checkResponsivePatterns(html);

      const pageResult = {
        name: page.name,
        viewport,
        touchTargets,
        responsive
      };

      results.push(pageResult);

      // Display results
      if (viewport.valid && responsive.usesResponsiveDesign && touchTargets.issues.length === 0) {
        success(`${page.name.padEnd(20)} Mobile-ready`);
        passCount++;
      } else {
        const issues = [];
        if (!viewport.valid) issues.push('viewport');
        if (!responsive.usesResponsiveDesign) issues.push('responsive design');
        if (touchTargets.issues.length > 0) issues.push('touch targets');

        warning(`${page.name.padEnd(20)} Issues: ${issues.join(', ')}`);
        touchTargets.issues.forEach(issue => {
          log(`    • ${issue}`, 'yellow');
        });
        failCount++;
      }

    } catch (err) {
      error(`${page.name.padEnd(20)} FAILED: ${err.message}`);
      failCount++;
    }
  }

  // Summary
  console.log('');
  log('═'.repeat(70), 'cyan');
  log('  Summary', 'bright');
  log('═'.repeat(70), 'cyan');
  console.log('');

  log(`  Pages Tested: ${results.length}`, 'bright');
  success(`Mobile-Ready: ${passCount} pages`);
  if (failCount > 0) warning(`Needs Improvement: ${failCount} pages`);
  console.log('');

  // Viewport analysis
  const withViewport = results.filter(r => r.viewport.exists).length;
  const validViewport = results.filter(r => r.viewport.valid).length;

  log('  Viewport Meta Tags:', 'bright');
  success(`${withViewport}/${results.length} pages have viewport meta tag`);
  if (validViewport < results.length) {
    warning(`${validViewport}/${results.length} have valid responsive viewport`);
  } else {
    success(`${validViewport}/${results.length} have valid responsive viewport`);
  }
  console.log('');

  // Responsive design patterns
  const responsive = results.filter(r => r.responsive.usesResponsiveDesign).length;
  log('  Responsive Design:', 'bright');
  if (responsive === results.length) {
    success(`All pages use responsive design patterns (Tailwind breakpoints)`);
  } else {
    warning(`${responsive}/${results.length} pages use sufficient responsive patterns`);
  }
  console.log('');

  // Touch target recommendations
  log('  Recommendations:', 'bright');
  log('    • All interactive elements should have min 44x44px touch targets (WCAG 2.5.5)', 'cyan');
  log('    • Buttons: Use px-6 py-3 (Tailwind) for comfortable touch targets', 'cyan');
  log('    • Links in text: Ensure sufficient line-height and padding', 'cyan');
  log('    • Form inputs: Use p-3 or py-3 px-4 for easy touch', 'cyan');
  console.log('');

  // Save report
  const reportPath = path.join(__dirname, '../audit-reports/mobile-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      pagesТested: results.length,
      mobileReady: passCount,
      needsImprovement: failCount,
      viewportValid: validViewport,
      responsiveDesign: responsive
    },
    results
  }, null, 2));

  success(`Detailed report saved: ${reportPath}`);
  console.log('');

  if (failCount === 0) {
    success('All pages are mobile-ready!');
    console.log('');
    process.exit(0);
  } else {
    warning('Some pages need mobile optimization improvements');
    console.log('');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('');
  error(`Mobile audit failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
