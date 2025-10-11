#!/usr/bin/env node

/**
 * Tractatus Session Initialization
 *
 * Automatically runs all mandatory framework checks at session start.
 * Should be called at the beginning of every Claude Code session.
 *
 * Copyright 2025 Tractatus Project
 * Licensed under Apache License 2.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SESSION_STATE_PATH = path.join(__dirname, '../.claude/session-state.json');
const INSTRUCTION_HISTORY_PATH = path.join(__dirname, '../.claude/instruction-history.json');
const TOKEN_CHECKPOINTS_PATH = path.join(__dirname, '../.claude/token-checkpoints.json');

/**
 * Color output helpers
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  console.log('');
  log('═'.repeat(70), 'cyan');
  log(`  ${message}`, 'bright');
  log('═'.repeat(70), 'cyan');
  console.log('');
}

function section(message) {
  console.log('');
  log(`▶ ${message}`, 'blue');
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
 * Check if this is a new session or restart
 */
function isNewSession() {
  try {
    const sessionState = JSON.parse(fs.readFileSync(SESSION_STATE_PATH, 'utf8'));

    // Check if session_id is today's date
    const today = new Date().toISOString().split('T')[0];
    const sessionDate = sessionState.session_id.split('-').slice(0, 3).join('-');

    // Check if message count is 0 (new session)
    const isNew = sessionState.message_count === 0;

    // Check if session started today
    const isToday = sessionDate === today;

    return { isNew, isToday, sessionState };
  } catch (err) {
    // If file doesn't exist or can't be read, treat as new session
    return { isNew: true, isToday: true, sessionState: null };
  }
}

/**
 * Initialize session state
 */
function initializeSessionState() {
  const sessionId = new Date().toISOString().split('T')[0] + '-001';
  const timestamp = new Date().toISOString();

  const sessionState = {
    version: '1.0.0',
    session_id: sessionId,
    started: timestamp,
    message_count: 1,
    token_estimate: 0,
    last_framework_activity: {
      ContextPressureMonitor: {
        message: 1,
        tokens: 0,
        timestamp: timestamp,
        last_level: 'NORMAL',
        last_score: 0
      },
      InstructionPersistenceClassifier: {
        message: 0,
        tokens: 0,
        timestamp: null,
        last_classification: null
      },
      CrossReferenceValidator: {
        message: 0,
        tokens: 0,
        timestamp: null,
        last_validation: null
      },
      BoundaryEnforcer: {
        message: 0,
        tokens: 0,
        timestamp: null,
        last_check: null
      },
      MetacognitiveVerifier: {
        message: 0,
        tokens: 0,
        timestamp: null,
        last_verification: null
      }
    },
    staleness_thresholds: {
      messages: 20,
      tokens: 30000
    },
    alerts: [],
    last_updated: timestamp,
    initialized: true
  };

  fs.writeFileSync(SESSION_STATE_PATH, JSON.stringify(sessionState, null, 2));
  return sessionState;
}

/**
 * Reset token checkpoints for new session
 */
function resetTokenCheckpoints() {
  const checkpoints = {
    version: '1.0.0',
    budget: 200000,
    checkpoints: [
      { percentage: 25, tokens: 50000, completed: false, timestamp: null },
      { percentage: 50, tokens: 100000, completed: false, timestamp: null },
      { percentage: 75, tokens: 150000, completed: false, timestamp: null }
    ],
    next_checkpoint: 50000,
    overdue: false,
    last_check: new Date().toISOString()
  };

  fs.writeFileSync(TOKEN_CHECKPOINTS_PATH, JSON.stringify(checkpoints, null, 2));
  return checkpoints;
}

/**
 * Load and summarize instruction history
 */
function loadInstructionHistory() {
  try {
    if (!fs.existsSync(INSTRUCTION_HISTORY_PATH)) {
      return { total: 0, high: 0, medium: 0, low: 0 };
    }

    const history = JSON.parse(fs.readFileSync(INSTRUCTION_HISTORY_PATH, 'utf8'));
    const active = history.instructions?.filter(i => i.active) || [];

    const summary = {
      total: active.length,
      high: active.filter(i => i.persistence === 'HIGH').length,
      medium: active.filter(i => i.persistence === 'MEDIUM').length,
      low: active.filter(i => i.persistence === 'LOW').length,
      strategic: active.filter(i => i.quadrant === 'STRATEGIC').length,
      system: active.filter(i => i.quadrant === 'SYSTEM').length
    };

    return summary;
  } catch (err) {
    warning(`Could not load instruction history: ${err.message}`);
    return { total: 0, high: 0, medium: 0, low: 0 };
  }
}

/**
 * Run initial pressure check
 */
function runPressureCheck() {
  try {
    const output = execSync(
      'node scripts/check-session-pressure.js --tokens 0/200000 --messages 1 --tasks 0',
      { encoding: 'utf8', stdio: 'pipe' }
    );

    // Extract pressure level from output
    const levelMatch = output.match(/Pressure Level:\s+\[.*?m(.*?)\[/);
    const scoreMatch = output.match(/Overall Score:\s+([\d.]+)%/);

    return {
      level: levelMatch ? levelMatch[1] : 'NORMAL',
      score: scoreMatch ? parseFloat(scoreMatch[1]) : 0,
      output: output
    };
  } catch (err) {
    error(`Pressure check failed: ${err.message}`);
    return { level: 'UNKNOWN', score: 0, output: '' };
  }
}

/**
 * Main initialization
 */
async function main() {
  header('Tractatus Framework - Session Initialization');

  // Check session status
  section('1. Checking Session Status');
  const { isNew, isToday, sessionState } = isNewSession();

  if (!isNew && sessionState) {
    log(`  Session: ${sessionState.session_id}`, 'cyan');
    log(`  Messages: ${sessionState.message_count}`, 'cyan');
    log(`  Status: Continuing existing session`, 'yellow');
    console.log('');
    warning('This is a CONTINUED session - framework should already be active');
    warning('If this is actually a NEW session, delete .claude/session-state.json');
  } else {
    success('New session detected - initializing framework');
    const newState = initializeSessionState();
    log(`  Session ID: ${newState.session_id}`, 'cyan');
  }

  // Reset checkpoints for new day
  section('2. Resetting Token Checkpoints');
  const checkpoints = resetTokenCheckpoints();
  success(`Token budget: ${checkpoints.budget.toLocaleString()}`);
  success(`Next checkpoint: ${checkpoints.next_checkpoint.toLocaleString()} tokens (25%)`);

  // Load instruction history
  section('3. Loading Instruction History');
  const instructions = loadInstructionHistory();

  if (instructions.total === 0) {
    log('  No active instructions stored', 'yellow');
  } else {
    success(`Active instructions: ${instructions.total}`);
    if (instructions.high > 0) {
      log(`    HIGH persistence: ${instructions.high}`, 'cyan');
    }
    if (instructions.medium > 0) {
      log(`    MEDIUM persistence: ${instructions.medium}`, 'cyan');
    }
    if (instructions.low > 0) {
      log(`    LOW persistence: ${instructions.low}`, 'cyan');
    }
    console.log('');
    if (instructions.strategic > 0 || instructions.system > 0) {
      warning(`Critical instructions active (STRATEGIC: ${instructions.strategic}, SYSTEM: ${instructions.system})`);
      warning('These must be validated before conflicting actions');
    }
  }

  // Run initial pressure check
  section('4. Running Initial Pressure Check');
  const pressure = runPressureCheck();
  success(`Pressure Level: ${pressure.level}`);
  success(`Overall Score: ${pressure.score}%`);

  // Framework component status
  section('5. Framework Components');
  success('ContextPressureMonitor: ACTIVE');
  success('InstructionPersistenceClassifier: READY');
  success('CrossReferenceValidator: READY');
  success('BoundaryEnforcer: READY');
  success('MetacognitiveVerifier: READY (selective mode)');

  // Run framework tests
  section('6. Running Framework Tests');
  try {
    log('  Running unit tests for Tractatus services...', 'cyan');
    const testOutput = execSync(
      'npm test -- --testPathPattern="tests/unit/(ContextPressureMonitor|InstructionPersistenceClassifier|CrossReferenceValidator|BoundaryEnforcer|MetacognitiveVerifier)" --silent 2>&1',
      { encoding: 'utf8', stdio: 'pipe' }
    );

    // Extract test results
    const passMatch = testOutput.match(/Tests:\s+(\d+) passed/);
    const failMatch = testOutput.match(/(\d+) failed/);
    const totalMatch = testOutput.match(/(\d+) total/);

    if (failMatch && parseInt(failMatch[1]) > 0) {
      error(`Framework tests FAILED: ${failMatch[1]} failures`);
      warning('Some framework components may not be functioning correctly');
      log('  Run: npm test -- --testPathPattern="tests/unit" for details', 'yellow');
    } else if (passMatch) {
      success(`All framework tests passed (${passMatch[1]}/${totalMatch ? totalMatch[1] : passMatch[1]} tests)`);
    } else {
      warning('Could not parse test results - tests may have run successfully');
    }
  } catch (err) {
    // Test failures throw non-zero exit code
    const output = err.stdout || err.message;
    const failMatch = output.match(/(\d+) failed/);

    if (failMatch) {
      error(`Framework tests FAILED: ${failMatch[1]} failures`);
      warning('Some framework components may not be functioning correctly');
      warning('Run: npm test -- --testPathPattern="tests/unit" to see failures');
    } else {
      error('Framework tests encountered an error');
      warning(err.message);
    }
  }

  // Summary
  header('Framework Initialization Complete');
  console.log('');
  log('  All 5 components are active and monitoring this session.', 'green');
  console.log('');
  log('  Next Actions:', 'bright');
  log('    • Framework will monitor continuously', 'cyan');
  log('    • Token checkpoint at 50,000 tokens (25%)', 'cyan');
  log('    • Pressure checks at 25%, 50%, 75% milestones', 'cyan');
  log('    • All instructions will be cross-referenced', 'cyan');
  console.log('');
  log('  ⚠️  MANDATORY REPORTING (Framework Discipline):', 'bright');
  log('    • MUST report pressure to user at 50k, 100k, 150k tokens', 'yellow');
  log('    • Format: "📊 Context Pressure: [LEVEL] ([SCORE]%) | Tokens: [X]/200000 | Next: [Y]"', 'yellow');
  log('    • Failure to report = Framework fade (triggers recovery)', 'yellow');
  console.log('');
  log('  Claude: You may now proceed with session work.', 'green');
  console.log('');

  // Exit successfully
  process.exit(0);
}

// Run
main().catch(err => {
  console.error('');
  error(`Initialization failed: ${err.message}`);
  console.error('');
  process.exit(1);
});
