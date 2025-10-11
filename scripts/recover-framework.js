#!/usr/bin/env node

/**
 * Framework Recovery Protocol - Fail-Safe Recovery
 *
 * This script is run when framework fade is detected (components not being used).
 * It performs diagnostics, reports findings, and helps re-establish baseline.
 *
 * CRITICAL: This is a Claude Code-specific enforcement mechanism.
 *
 * Recovery Steps:
 * 1. Diagnose current state
 * 2. Report all issues found
 * 3. Clear stale alerts
 * 4. Reset monitoring thresholds
 * 5. Recommend actions for Claude
 *
 * Copyright 2025 Tractatus Project
 * Licensed under Apache License 2.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

function log(level, message) {
  const prefix = {
    INFO: `${colors.cyan}[RECOVERY]${colors.reset}`,
    SUCCESS: `${colors.green}${colors.bold}[RECOVERY SUCCESS]${colors.reset}`,
    ERROR: `${colors.red}${colors.bold}[RECOVERY ERROR]${colors.reset}`,
    WARN: `${colors.yellow}[RECOVERY WARN]${colors.reset}`,
    ACTION: `${colors.magenta}${colors.bold}[ACTION REQUIRED]${colors.reset}`
  }[level] || '[RECOVERY]';

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

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    log('ERROR', `Failed to save ${filePath}: ${error.message}`);
    return false;
  }
}

function diagnoseFrameworkState() {
  log('INFO', '═══════════════════════════════════════════════════════════');
  log('INFO', 'TRACTATUS FRAMEWORK RECOVERY INITIATED');
  log('INFO', '═══════════════════════════════════════════════════════════');
  log('INFO', '');

  const issues = [];
  const recommendations = [];

  // Check session state
  log('INFO', 'Step 1: Checking session state...');
  const state = loadJSON(SESSION_STATE_PATH);

  if (!state) {
    issues.push({
      severity: 'CRITICAL',
      component: 'System',
      issue: 'Session state file not found or corrupted',
      action: 'Re-initialize session-state.json with baseline values'
    });
  } else {
    log('SUCCESS', `Session state loaded: ${state.message_count} messages, ~${state.token_estimate} tokens`);

    // Check each component
    const components = [
      'ContextPressureMonitor',
      'InstructionPersistenceClassifier',
      'CrossReferenceValidator',
      'BoundaryEnforcer',
      'MetacognitiveVerifier'
    ];

    components.forEach(component => {
      const activity = state.last_framework_activity[component];
      const messagesSince = state.message_count - activity.message;
      const tokensSince = state.token_estimate - activity.tokens;

      if (activity.message === 0) {
        issues.push({
          severity: 'HIGH',
          component,
          issue: 'Never used in this session',
          action: `Immediately invoke ${component}`
        });
      } else if (messagesSince > state.staleness_thresholds.messages) {
        issues.push({
          severity: 'MEDIUM',
          component,
          issue: `Stale: ${messagesSince} messages ago (threshold: ${state.staleness_thresholds.messages})`,
          action: `Re-invoke ${component} if appropriate for current task`
        });
      } else {
        log('SUCCESS', `${component}: Active (${messagesSince} messages ago)`);
      }
    });

    // Check for active alerts
    if (state.alerts && state.alerts.length > 0) {
      log('WARN', `${state.alerts.length} active alerts in session state`);
      state.alerts.forEach(alert => {
        issues.push({
          severity: alert.severity,
          component: alert.component,
          issue: alert.message,
          action: 'Address underlying issue'
        });
      });
    }
  }

  log('INFO', '');

  // Check token checkpoints
  log('INFO', 'Step 2: Checking token checkpoints...');
  const checkpoints = loadJSON(TOKEN_CHECKPOINTS_PATH);

  if (!checkpoints) {
    issues.push({
      severity: 'HIGH',
      component: 'ContextPressureMonitor',
      issue: 'Token checkpoints file not found',
      action: 'Re-initialize token-checkpoints.json'
    });
  } else {
    if (checkpoints.overdue) {
      issues.push({
        severity: 'CRITICAL',
        component: 'ContextPressureMonitor',
        issue: `Checkpoint OVERDUE: ${checkpoints.next_checkpoint} (current: ~${state?.token_estimate || 'unknown'})`,
        action: 'Run pressure check immediately: node scripts/check-session-pressure.js'
      });
    } else {
      log('SUCCESS', `Next checkpoint: ${checkpoints.next_checkpoint}`);
    }
  }

  log('INFO', '');

  // Check instruction history
  log('INFO', 'Step 3: Checking instruction database...');
  const instructions = loadJSON(INSTRUCTION_HISTORY_PATH);

  if (!instructions) {
    issues.push({
      severity: 'MEDIUM',
      component: 'InstructionPersistenceClassifier',
      issue: 'Instruction history not found',
      action: 'Ensure .claude/instruction-history.json exists'
    });
  } else {
    const activeCount = instructions.instructions.filter(i => i.active).length;
    log('SUCCESS', `Instruction database loaded: ${activeCount} active instructions`);
  }

  log('INFO', '');
  log('INFO', '═══════════════════════════════════════════════════════════');

  return { issues, state, checkpoints, instructions };
}

function reportIssues(issues) {
  if (issues.length === 0) {
    log('SUCCESS', 'No issues found. Framework is operational.');
    return;
  }

  log('ERROR', `FOUND ${issues.length} ISSUES:`);
  log('ERROR', '');

  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const high = issues.filter(i => i.severity === 'HIGH');
  const medium = issues.filter(i => i.severity === 'MEDIUM');

  if (critical.length > 0) {
    log('ERROR', `CRITICAL ISSUES (${critical.length}):`);
    critical.forEach((issue, idx) => {
      log('ERROR', `${idx + 1}. [${issue.component}] ${issue.issue}`);
      log('ACTION', `   → ${issue.action}`);
    });
    log('ERROR', '');
  }

  if (high.length > 0) {
    log('WARN', `HIGH PRIORITY ISSUES (${high.length}):`);
    high.forEach((issue, idx) => {
      log('WARN', `${idx + 1}. [${issue.component}] ${issue.issue}`);
      log('ACTION', `   → ${issue.action}`);
    });
    log('WARN', '');
  }

  if (medium.length > 0) {
    log('INFO', `MEDIUM PRIORITY ISSUES (${medium.length}):`);
    medium.forEach((issue, idx) => {
      log('INFO', `${idx + 1}. [${issue.component}] ${issue.issue}`);
      log('ACTION', `   → ${issue.action}`);
    });
    log('INFO', '');
  }
}

function performRecovery(state, checkpoints) {
  log('INFO', '═══════════════════════════════════════════════════════════');
  log('INFO', 'Step 4: Performing recovery actions...');
  log('INFO', '');

  let recovered = true;

  // Clear alerts from session state
  if (state && state.alerts && state.alerts.length > 0) {
    log('INFO', 'Clearing stale alerts from session state...');
    state.alerts = [];
    state.last_updated = new Date().toISOString();
    if (saveJSON(SESSION_STATE_PATH, state)) {
      log('SUCCESS', 'Session state alerts cleared');
    } else {
      recovered = false;
    }
  }

  // Reset checkpoint overdue flag if needed
  if (checkpoints && checkpoints.overdue) {
    log('WARN', 'Checkpoint overdue flag is set - will remain until pressure check runs');
  }

  log('INFO', '');
  log('INFO', '═══════════════════════════════════════════════════════════');

  return recovered;
}

function provideRecommendations(issues) {
  log('ACTION', 'IMMEDIATE ACTIONS FOR CLAUDE:');
  log('ACTION', '');

  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const hasStaleComponents = issues.some(i => i.component !== 'System' && i.component !== 'ContextPressureMonitor');

  if (critical.length > 0) {
    log('ACTION', '1. STOP all current work immediately');
    log('ACTION', '2. Address all CRITICAL issues listed above');
    log('ACTION', '3. Run pressure check if overdue');
  } else if (hasStaleComponents) {
    log('ACTION', '1. Review which components are stale');
    log('ACTION', '2. Consider if they should be invoked for recent actions');
    log('ACTION', '3. Increase monitoring frequency');
  } else {
    log('ACTION', '1. Resume work with normal monitoring');
    log('ACTION', '2. Be vigilant about using all five components');
  }

  log('ACTION', '');
  log('ACTION', 'ONGOING REQUIREMENTS:');
  log('ACTION', '- Use ContextPressureMonitor every 25% tokens (50k)');
  log('ACTION', '- Use InstructionPersistenceClassifier for explicit directives');
  log('ACTION', '- Use CrossReferenceValidator before major changes');
  log('ACTION', '- Use BoundaryEnforcer before values decisions');
  log('ACTION', '- Use MetacognitiveVerifier for complex operations (>3 files)');
  log('ACTION', '');
  log('ACTION', '═══════════════════════════════════════════════════════════');
}

// Main recovery process
function runRecovery() {
  const { issues, state, checkpoints, instructions } = diagnoseFrameworkState();

  reportIssues(issues);

  const recovered = performRecovery(state, checkpoints);

  provideRecommendations(issues);

  log('INFO', '');
  if (recovered && issues.length === 0) {
    log('SUCCESS', 'Framework recovery COMPLETE. All systems operational.');
    process.exit(0);
  } else if (recovered) {
    log('WARN', 'Framework recovery PARTIAL. Issues require attention.');
    process.exit(1);
  } else {
    log('ERROR', 'Framework recovery FAILED. Manual intervention required.');
    process.exit(2);
  }
}

// Run recovery
runRecovery();
