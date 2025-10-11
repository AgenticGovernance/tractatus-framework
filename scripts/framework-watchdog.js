#!/usr/bin/env node

/**
 * Framework Watchdog - Continuous Monitoring for Tractatus Governance
 *
 * This script runs in the background and monitors the active use of all five
 * Tractatus framework components throughout a Claude Code session.
 *
 * CRITICAL: This is a Claude Code-specific enforcement mechanism.
 *
 * Monitored Components:
 * 1. ContextPressureMonitor
 * 2. InstructionPersistenceClassifier
 * 3. CrossReferenceValidator
 * 4. BoundaryEnforcer
 * 5. MetacognitiveVerifier
 *
 * Copyright 2025 Tractatus Project
 * Licensed under Apache License 2.0
 */

const fs = require('fs');
const path = require('path');

const SESSION_STATE_PATH = path.join(__dirname, '../.claude/session-state.json');
const TOKEN_CHECKPOINTS_PATH = path.join(__dirname, '../.claude/token-checkpoints.json');
const CHECK_INTERVAL = 30000; // 30 seconds

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = {
    INFO: `${colors.cyan}[WATCHDOG INFO]${colors.reset}`,
    WARN: `${colors.yellow}${colors.bold}[WATCHDOG WARNING]${colors.reset}`,
    ERROR: `${colors.red}${colors.bold}[WATCHDOG ERROR]${colors.reset}`,
    SUCCESS: `${colors.green}[WATCHDOG OK]${colors.reset}`
  }[level] || '[WATCHDOG]';

  console.log(`${prefix} ${timestamp} - ${message}`);
}

function checkSessionState() {
  try {
    if (!fs.existsSync(SESSION_STATE_PATH)) {
      log('WARN', 'session-state.json not found. Framework may not be initialized.');
      return;
    }

    const state = JSON.parse(fs.readFileSync(SESSION_STATE_PATH, 'utf8'));
    const alerts = [];

    // Check each component for staleness
    const components = [
      'ContextPressureMonitor',
      'InstructionPersistenceClassifier',
      'CrossReferenceValidator',
      'BoundaryEnforcer',
      'MetacognitiveVerifier'
    ];

    const currentMessage = state.message_count;
    const currentTokens = state.token_estimate;

    components.forEach(component => {
      const activity = state.last_framework_activity[component];
      const messagesSince = currentMessage - activity.message;
      const tokensSince = currentTokens - activity.tokens;

      // Check staleness
      if (messagesSince > state.staleness_thresholds.messages) {
        alerts.push({
          severity: 'HIGH',
          component,
          message: `${component} not used in ${messagesSince} messages (threshold: ${state.staleness_thresholds.messages})`
        });
      }

      if (tokensSince > state.staleness_thresholds.tokens) {
        alerts.push({
          severity: 'HIGH',
          component,
          message: `${component} not used in ~${tokensSince} tokens (threshold: ${state.staleness_thresholds.tokens})`
        });
      }
    });

    // Check token checkpoints
    if (fs.existsSync(TOKEN_CHECKPOINTS_PATH)) {
      const checkpoints = JSON.parse(fs.readFileSync(TOKEN_CHECKPOINTS_PATH, 'utf8'));

      if (checkpoints.overdue) {
        alerts.push({
          severity: 'CRITICAL',
          component: 'ContextPressureMonitor',
          message: `Token checkpoint OVERDUE! Next checkpoint: ${checkpoints.next_checkpoint}, Current: ${currentTokens}`
        });
      } else if (currentTokens >= checkpoints.next_checkpoint) {
        alerts.push({
          severity: 'HIGH',
          component: 'ContextPressureMonitor',
          message: `Token checkpoint reached: ${checkpoints.next_checkpoint}. Pressure check required NOW.`
        });

        // Mark as overdue
        checkpoints.overdue = true;
        fs.writeFileSync(TOKEN_CHECKPOINTS_PATH, JSON.stringify(checkpoints, null, 2));
      }
    }

    // Report alerts
    if (alerts.length > 0) {
      log('ERROR', '═══════════════════════════════════════════════════════════');
      log('ERROR', `FRAMEWORK FADE DETECTED - ${alerts.length} issues found`);
      log('ERROR', '═══════════════════════════════════════════════════════════');

      alerts.forEach(alert => {
        log('ERROR', `[${alert.severity}] ${alert.message}`);
      });

      log('ERROR', '');
      log('ERROR', 'REQUIRED ACTION: Run recovery protocol immediately');
      log('ERROR', 'Command: node scripts/recover-framework.js');
      log('ERROR', '═══════════════════════════════════════════════════════════');

      // Update session state with alerts
      state.alerts = alerts;
      state.last_updated = new Date().toISOString();
      fs.writeFileSync(SESSION_STATE_PATH, JSON.stringify(state, null, 2));
    } else {
      // Periodic status report (every 5 minutes)
      const now = Date.now();
      const lastUpdate = new Date(state.last_updated).getTime();
      if (now - lastUpdate > 300000) {
        log('SUCCESS', `All components active. Messages: ${currentMessage}, Tokens: ~${currentTokens}`);
      }
    }

  } catch (error) {
    log('ERROR', `Watchdog check failed: ${error.message}`);
  }
}

// Main watchdog loop
log('INFO', '═══════════════════════════════════════════════════════════');
log('INFO', 'Tractatus Framework Watchdog STARTED');
log('INFO', 'Monitoring session for framework component usage');
log('INFO', `Check interval: ${CHECK_INTERVAL / 1000}s`);
log('INFO', '═══════════════════════════════════════════════════════════');

// Run immediate check
checkSessionState();

// Set up periodic monitoring
const intervalId = setInterval(checkSessionState, CHECK_INTERVAL);

// Graceful shutdown
process.on('SIGINT', () => {
  log('INFO', 'Watchdog shutting down gracefully...');
  clearInterval(intervalId);
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('INFO', 'Watchdog shutting down gracefully...');
  clearInterval(intervalId);
  process.exit(0);
});
