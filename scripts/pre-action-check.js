#!/usr/bin/env node

/**
 * Pre-Action Check - Blocking Validator for Major Operations
 *
 * This script MUST be called before any major action in a Claude Code session.
 * It validates that appropriate Tractatus framework components have been used.
 *
 * CRITICAL: This is a Claude Code-specific enforcement mechanism.
 *
 * Major actions include:
 * - File modifications (Edit, Write)
 * - Database schema changes
 * - Architecture decisions
 * - Configuration changes
 * - Security implementations
 *
 * Exit Codes:
 * 0 - PASS: All checks passed, action may proceed
 * 1 - FAIL: Required checks missing, action blocked
 * 2 - ERROR: System error, cannot validate
 *
 * Copyright 2025 Tractatus Project
 * Licensed under Apache License 2.0
 */

const fs = require('fs');
const path = require('path');

const SESSION_STATE_PATH = path.join(__dirname, '../.claude/session-state.json');
const TOKEN_CHECKPOINTS_PATH = path.join(__dirname, '../.claude/token-checkpoints.json');
const INSTRUCTION_HISTORY_PATH = path.join(__dirname, '../.claude/instruction-history.json');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Parse command-line arguments
const args = process.argv.slice(2);
const actionType = args[0] || 'general';
let filePath = null;
let actionDescription = 'unspecified action';

// Check if second argument is a file path
if (args.length > 1) {
  const potentialPath = args[1];
  if (potentialPath.includes('/') || potentialPath.includes('\\') || potentialPath.endsWith('.html') || potentialPath.endsWith('.js')) {
    filePath = potentialPath;
    actionDescription = args.slice(2).join(' ') || `action on ${filePath}`;
  } else {
    actionDescription = args.slice(1).join(' ');
  }
}

function log(level, message) {
  const prefix = {
    INFO: `${colors.cyan}[PRE-ACTION CHECK]${colors.reset}`,
    PASS: `${colors.green}${colors.bold}[✓ PASS]${colors.reset}`,
    FAIL: `${colors.red}${colors.bold}[✗ FAIL]${colors.reset}`,
    WARN: `${colors.yellow}[⚠ WARN]${colors.reset}`,
    ERROR: `${colors.red}[ERROR]${colors.reset}`
  }[level] || '[CHECK]';

  console.log(`${prefix} ${message}`);
}

function loadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    log('ERROR', `Failed to load ${filePath}: ${error.message}`);
    return null;
  }
}

function checkPressureRecent(state, maxTokensAgo = 25000) {
  const activity = state.last_framework_activity.ContextPressureMonitor;
  const tokensSince = state.token_estimate - activity.tokens;

  if (tokensSince > maxTokensAgo) {
    log('FAIL', `Pressure check stale: ${tokensSince} tokens ago (max: ${maxTokensAgo})`);
    log('INFO', 'Required: Run node scripts/check-session-pressure.js');
    return false;
  }

  log('PASS', `Pressure check recent: ${tokensSince} tokens ago`);
  return true;
}

function checkInstructionsLoaded() {
  const instructions = loadJSON(INSTRUCTION_HISTORY_PATH);

  if (!instructions) {
    log('FAIL', 'Instruction history not loaded');
    log('INFO', 'Required: Ensure .claude/instruction-history.json exists and is loaded');
    return false;
  }

  const activeCount = instructions.instructions.filter(i => i.active).length;
  log('PASS', `Instruction database loaded: ${activeCount} active instructions`);
  return true;
}

function checkComponentForActionType(state, actionType) {
  const requirements = {
    'file-edit': ['CrossReferenceValidator'],
    'database': ['CrossReferenceValidator', 'BoundaryEnforcer'],
    'architecture': ['BoundaryEnforcer', 'MetacognitiveVerifier'],
    'config': ['CrossReferenceValidator'],
    'security': ['BoundaryEnforcer', 'MetacognitiveVerifier'],
    'values': ['BoundaryEnforcer'],
    'complex': ['MetacognitiveVerifier'],
    'document-deployment': ['BoundaryEnforcer', 'CrossReferenceValidator'], // NEW: Security check for doc deployment
    'general': []
  };

  const required = requirements[actionType] || requirements['general'];
  const missing = [];

  required.forEach(component => {
    const activity = state.last_framework_activity[component];
    const messagesSince = state.message_count - activity.message;

    if (messagesSince > 10) {
      missing.push({ component, messagesSince });
    }
  });

  if (missing.length > 0) {
    log('FAIL', `Required components not recently used for action type '${actionType}':`);
    missing.forEach(m => {
      log('FAIL', `  - ${m.component}: ${m.messagesSince} messages ago`);
    });
    return false;
  }

  if (required.length > 0) {
    log('PASS', `Required components recently used: ${required.join(', ')}`);
  }

  return true;
}

function checkTokenCheckpoints() {
  const checkpoints = loadJSON(TOKEN_CHECKPOINTS_PATH);

  if (!checkpoints) {
    log('WARN', 'Token checkpoints file not found');
    return true; // Non-blocking warning
  }

  if (checkpoints.overdue) {
    log('FAIL', `Token checkpoint OVERDUE: ${checkpoints.next_checkpoint}`);
    log('INFO', 'Required: Run pressure check immediately');
    return false;
  }

  log('PASS', `Token checkpoints OK: next at ${checkpoints.next_checkpoint}`);
  return true;
}

/**
 * CSP Compliance Checker
 * Validates HTML/JS files for Content Security Policy violations
 * (inst_008: "ALWAYS comply with CSP - no inline event handlers, no inline scripts")
 */
function checkCSPCompliance(filePath) {
  if (!filePath) {
    log('INFO', 'No file path provided - skipping CSP check');
    return true; // Non-blocking if no file specified
  }

  // Only check HTML/JS files
  const ext = path.extname(filePath).toLowerCase();
  if (!['.html', '.js'].includes(ext)) {
    log('INFO', `File type ${ext} - skipping CSP check (only validates .html/.js)`);
    return true;
  }

  // Resolve relative paths
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(__dirname, '../', filePath);

  if (!fs.existsSync(absolutePath)) {
    log('WARN', `File not found: ${absolutePath} - skipping CSP check`);
    return true; // Non-blocking warning
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const violations = [];

  // CSP Violation Patterns
  const patterns = [
    {
      name: 'Inline event handlers',
      regex: /\son\w+\s*=\s*["'][^"']*["']/gi,
      severity: 'CRITICAL',
      examples: ['onclick=', 'onload=', 'onerror=', 'onchange=']
    },
    {
      name: 'Inline styles',
      regex: /\sstyle\s*=\s*["'][^"']+["']/gi,
      severity: 'CRITICAL',
      examples: ['style="color: red"', 'style="line-height: 1"']
    },
    {
      name: 'Inline scripts (without src)',
      regex: /<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/gi,
      severity: 'WARNING',
      examples: ['<script>alert("test")</script>'],
      // Allow empty or whitespace-only scripts (often used for templates)
      filter: (match) => match.replace(/<script[^>]*>|<\/script>/gi, '').trim().length > 0
    },
    {
      name: 'javascript: URLs',
      regex: /href\s*=\s*["']javascript:[^"']*["']/gi,
      severity: 'CRITICAL',
      examples: ['href="javascript:void(0)"']
    }
  ];

  patterns.forEach(pattern => {
    const matches = content.match(pattern.regex);
    if (matches) {
      const filtered = pattern.filter
        ? matches.filter(pattern.filter)
        : matches;

      if (filtered.length > 0) {
        violations.push({
          name: pattern.name,
          severity: pattern.severity,
          count: filtered.length,
          samples: filtered.slice(0, 3), // Show first 3 examples
          examples: pattern.examples
        });
      }
    }
  });

  if (violations.length === 0) {
    log('PASS', `CSP compliance validated: ${path.basename(filePath)}`);
    return true;
  }

  // Report violations
  log('FAIL', `CSP violations detected in ${path.basename(filePath)}:`);
  violations.forEach(v => {
    log('FAIL', `  [${v.severity}] ${v.name} (${v.count} occurrences)`);
    v.samples.forEach((sample, idx) => {
      const truncated = sample.length > 80
        ? sample.substring(0, 77) + '...'
        : sample;
      log('FAIL', `    ${idx + 1}. ${truncated}`);
    });
  });

  log('INFO', '');
  log('INFO', 'CSP Violation Reference (inst_008):');
  log('INFO', '  - No inline event handlers (onclick=, onload=, etc.)');
  log('INFO', '  - No inline styles (style="" attribute)');
  log('INFO', '  - No inline scripts (<script> without src)');
  log('INFO', '  - No javascript: URLs');
  log('INFO', '');
  log('INFO', 'Fix: Move inline code to external .js/.css files');

  return false;
}

// Main validation
function runPreActionCheck() {
  log('INFO', '═══════════════════════════════════════════════════════════');
  log('INFO', `Validating action: ${actionType}`);
  log('INFO', `Description: ${actionDescription}`);
  log('INFO', '═══════════════════════════════════════════════════════════');

  const state = loadJSON(SESSION_STATE_PATH);

  if (!state) {
    log('ERROR', 'Session state not found. Framework may not be initialized.');
    log('ERROR', 'Run: node scripts/recover-framework.js');
    process.exit(2);
  }

  const checks = [
    { name: 'Pressure Check Recent', fn: () => checkPressureRecent(state) },
    { name: 'Instructions Loaded', fn: () => checkInstructionsLoaded() },
    { name: 'Token Checkpoints', fn: () => checkTokenCheckpoints() },
    { name: 'CSP Compliance', fn: () => checkCSPCompliance(filePath) },
    { name: 'Action-Specific Components', fn: () => checkComponentForActionType(state, actionType) }
  ];

  let allPassed = true;

  checks.forEach(check => {
    log('INFO', '');
    log('INFO', `Running check: ${check.name}`);
    const passed = check.fn();
    if (!passed) {
      allPassed = false;
    }
  });

  log('INFO', '');
  log('INFO', '═══════════════════════════════════════════════════════════');

  if (allPassed) {
    log('PASS', 'All checks passed. Action may proceed.');
    log('INFO', '═══════════════════════════════════════════════════════════');
    process.exit(0);
  } else {
    log('FAIL', 'One or more checks failed. Action BLOCKED.');
    log('INFO', 'Required: Address failures above before proceeding.');
    log('INFO', '═══════════════════════════════════════════════════════════');
    process.exit(1);
  }
}

// Run the check
runPreActionCheck();
