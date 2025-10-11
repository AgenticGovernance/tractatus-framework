#!/usr/bin/env node

/**
 * Color Contrast Checker
 *
 * Verifies color contrast ratios meet WCAG 2.1 AA standards (4.5:1 normal text, 3:1 large text)
 *
 * Copyright 2025 Tractatus Project
 * Licensed under Apache License 2.0
 */

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

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calculate relative luminance (WCAG formula)
 */
function getLuminance(rgb) {
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 */
function getContrastRatio(color1, color2) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA standards
 */
function meetsWCAG_AA(ratio, largeText = false) {
  const threshold = largeText ? 3.0 : 4.5;
  return ratio >= threshold;
}

/**
 * Tailwind color palette (common colors used in Tractatus site)
 */
const tailwindColors = {
  'white': '#ffffff',
  'gray-50': '#f9fafb',
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db',
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',
  'blue-50': '#eff6ff',
  'blue-100': '#dbeafe',
  'blue-400': '#60a5fa',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'blue-700': '#1d4ed8',
  'blue-800': '#1e40af',
  'blue-900': '#1e3a8a',
  'purple-500': '#a855f7',
  'purple-600': '#9333ea',
  'purple-700': '#7e22ce',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'green-700': '#15803d',
  'yellow-600': '#ca8a04',
  'amber-500': '#f59e0b',
  'amber-800': '#92400e',
  'amber-900': '#78350f',
  'red-600': '#dc2626'
};

/**
 * Color combinations used on site
 */
const colorCombinations = [
  // Body text on backgrounds
  { name: 'Body text (gray-900 on white)', fg: 'gray-900', bg: 'white', largeText: false },
  { name: 'Body text (gray-700 on white)', fg: 'gray-700', bg: 'white', largeText: false },
  { name: 'Body text (gray-600 on white)', fg: 'gray-600', bg: 'white', largeText: false },
  { name: 'Muted text (gray-500 on white)', fg: 'gray-500', bg: 'white', largeText: false },

  // Links
  { name: 'Link (blue-600 on white)', fg: 'blue-600', bg: 'white', largeText: false },
  { name: 'Link hover (blue-700 on white)', fg: 'blue-700', bg: 'white', largeText: false },

  // Buttons
  { name: 'Button text (white on blue-600)', fg: 'white', bg: 'blue-600', largeText: false },
  { name: 'Button hover (white on blue-700)', fg: 'white', bg: 'blue-700', largeText: false },
  { name: 'Purple button (white on purple-600)', fg: 'white', bg: 'purple-600', largeText: false },
  { name: 'Green button (white on green-700)', fg: 'white', bg: 'green-700', largeText: false },

  // Hero section
  { name: 'Hero subtitle (blue-100 on blue-700)', fg: 'blue-100', bg: 'blue-700', largeText: true },

  // Footer
  { name: 'Footer text (gray-400 on gray-900)', fg: 'gray-400', bg: 'gray-900', largeText: false },
  { name: 'Footer links (blue-400 on gray-900)', fg: 'blue-400', bg: 'gray-900', largeText: false },

  // Alerts/Messages
  { name: 'Success message (green-900 on green-50)', fg: '#065f46', bg: '#d1fae5', largeText: false },
  { name: 'Error message (red-900 on red-50)', fg: '#991b1b', bg: '#fee2e2', largeText: false },
  { name: 'Warning message (amber-900 on amber-50)', fg: 'amber-900', bg: '#fef3c7', largeText: false },

  // Cards/Sections
  { name: 'Card text (gray-700 on white)', fg: 'gray-700', bg: 'white', largeText: false },
  { name: 'Card header (gray-900 on white)', fg: 'gray-900', bg: 'white', largeText: true },
];

/**
 * Main check
 */
function main() {
  log('═'.repeat(70), 'cyan');
  log('  Color Contrast Checker (WCAG 2.1 AA)', 'bright');
  log('═'.repeat(70), 'cyan');
  console.log('');

  let passCount = 0;
  let failCount = 0;
  let warnings = 0;

  colorCombinations.forEach(combo => {
    const fgColor = tailwindColors[combo.fg] || combo.fg;
    const bgColor = tailwindColors[combo.bg] || combo.bg;

    const ratio = getContrastRatio(fgColor, bgColor);
    const passes = meetsWCAG_AA(ratio, combo.largeText);
    const threshold = combo.largeText ? '3:1' : '4.5:1';

    const ratioStr = ratio.toFixed(2) + ':1';

    if (passes) {
      success(`${combo.name.padEnd(45)} ${ratioStr.padStart(8)} (>= ${threshold}) ✓`);
      passCount++;
    } else {
      // Check if it's close (within 0.3 of threshold)
      const minRatio = combo.largeText ? 3.0 : 4.5;
      if (ratio >= minRatio - 0.3) {
        warning(`${combo.name.padEnd(45)} ${ratioStr.padStart(8)} (< ${threshold}) ⚠`);
        warnings++;
      } else {
        error(`${combo.name.padEnd(45)} ${ratioStr.padStart(8)} (< ${threshold}) ✗`);
        failCount++;
      }
    }
  });

  console.log('');
  log('═'.repeat(70), 'cyan');
  log('  Summary', 'bright');
  log('═'.repeat(70), 'cyan');
  console.log('');
  log(`  Combinations Checked: ${colorCombinations.length}`, 'bright');
  log(`  Passed: ${passCount}`, 'green');
  if (warnings > 0) log(`  Warnings: ${warnings}`, 'yellow');
  if (failCount > 0) log(`  Failed: ${failCount}`, 'red');
  console.log('');

  if (failCount > 0) {
    error('Some color combinations fail WCAG AA standards');
    console.log('');
    process.exit(1);
  } else if (warnings > 0) {
    warning('All combinations pass, but some are borderline');
    console.log('');
    process.exit(0);
  } else {
    success('All color combinations meet WCAG AA standards');
    console.log('');
    process.exit(0);
  }
}

main();
