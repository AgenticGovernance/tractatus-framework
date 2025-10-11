#!/usr/bin/env node
/**
 * Session Pressure Monitor Script
 *
 * Uses ContextPressureMonitor to analyze current session state and provide
 * recommendations for session management.
 *
 * This script demonstrates the Tractatus framework dogfooding itself - using
 * its own governance services to manage AI-assisted development sessions.
 *
 * Usage:
 *   node scripts/check-session-pressure.js [options]
 *
 * Options:
 *   --tokens <current>/<budget>   Current token usage (e.g., 89195/200000)
 *   --messages <count>            Number of messages in conversation
 *   --tasks <count>               Number of active tasks
 *   --errors <count>              Recent errors in last 10 minutes
 *   --json                        Output JSON format
 *   --verbose                     Show detailed analysis
 */

const monitor = require('../src/services/ContextPressureMonitor.service');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    tokenUsage: null,
    tokenBudget: null,
    messages: 0,
    tasks: 1,
    errors: 0,
    json: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tokens':
        const [current, budget] = args[++i].split('/').map(Number);
        options.tokenUsage = current;
        options.tokenBudget = budget;
        break;
      case '--messages':
        options.messages = parseInt(args[++i]);
        break;
      case '--tasks':
        options.tasks = parseInt(args[++i]);
        break;
      case '--errors':
        options.errors = parseInt(args[++i]);
        break;
      case '--json':
        options.json = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Session Pressure Monitor - Tractatus Framework

Usage:
  node scripts/check-session-pressure.js [options]

Options:
  --tokens <current>/<budget>   Token usage (e.g., 89195/200000)
  --messages <count>            Conversation length
  --tasks <count>               Active tasks
  --errors <count>              Recent errors
  --json                        JSON output
  --verbose                     Detailed analysis
  --help                        Show this help

Examples:
  # Check current session
  node scripts/check-session-pressure.js --tokens 89195/200000 --messages 28 --tasks 2

  # JSON output for automation
  node scripts/check-session-pressure.js --tokens 150000/200000 --json

  # Verbose analysis
  node scripts/check-session-pressure.js --tokens 180000/200000 --messages 50 --verbose
        `);
        process.exit(0);
    }
  }

  return options;
}

// Format pressure level with color
function formatLevel(level) {
  const colors = {
    NORMAL: '\x1b[32m',      // Green
    ELEVATED: '\x1b[33m',    // Yellow
    HIGH: '\x1b[35m',        // Magenta
    CRITICAL: '\x1b[31m',    // Red
    DANGEROUS: '\x1b[41m'    // Red background
  };
  const reset = '\x1b[0m';
  return `${colors[level] || ''}${level}${reset}`;
}

// Format recommendation with icon
function formatRecommendation(rec) {
  const icons = {
    CONTINUE_NORMAL: '✅',
    INCREASE_VERIFICATION: '⚠️',
    SUGGEST_CONTEXT_REFRESH: '🔄',
    MANDATORY_VERIFICATION: '🚨',
    IMMEDIATE_HALT: '🛑'
  };
  return `${icons[rec] || '•'} ${rec}`;
}

// Main analysis function
function analyzeSession(options) {
  // Build context object
  const context = {
    messages_count: options.messages,
    task_depth: options.tasks,
    errors_recent: options.errors
  };

  // Add token usage if provided
  if (options.tokenUsage && options.tokenBudget) {
    context.token_usage = options.tokenUsage / options.tokenBudget;
    context.token_limit = options.tokenBudget;
  }

  // Run analysis
  const analysis = monitor.analyzePressure(context);

  // Output results
  if (options.json) {
    console.log(JSON.stringify(analysis, null, 2));
  } else {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║         Tractatus Session Pressure Analysis                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Pressure Level
    console.log(`Pressure Level: ${formatLevel(analysis.level)}`);
    console.log(`Overall Score:  ${(analysis.overall_score * 100).toFixed(1)}%`);
    console.log(`Action:         ${analysis.action}\n`);

    // Metrics
    console.log('Metrics:');
    console.log(`  Token Usage:     ${(analysis.metrics.tokenUsage.score * 100).toFixed(1)}%`);
    console.log(`  Conversation:    ${(analysis.metrics.conversationLength.score * 100).toFixed(1)}%`);
    console.log(`  Task Complexity: ${(analysis.metrics.taskComplexity.score * 100).toFixed(1)}%`);
    console.log(`  Error Frequency: ${(analysis.metrics.errorFrequency.score * 100).toFixed(1)}%`);
    console.log(`  Instructions:    ${(analysis.metrics.instructionDensity.score * 100).toFixed(1)}%\n`);

    // Recommendations
    if (analysis.recommendations.length > 0) {
      console.log('Recommendations:');
      analysis.recommendations.forEach(rec => {
        console.log(`  ${formatRecommendation(rec)}`);
      });
      console.log();
    }

    // Warnings
    if (analysis.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      analysis.warnings.forEach(warning => {
        console.log(`  • ${warning}`);
      });
      console.log();
    }

    // Trend
    if (analysis.trend) {
      const trendIcons = {
        escalating: '📈 Escalating',
        improving: '📉 Improving',
        stable: '➡️  Stable'
      };
      console.log(`Trend: ${trendIcons[analysis.trend]}\n`);
    }

    // Verbose output
    if (options.verbose) {
      console.log('Detailed Metrics:');
      Object.entries(analysis.metrics).forEach(([name, metric]) => {
        console.log(`  ${name}:`);
        console.log(`    Raw: ${metric.raw}`);
        console.log(`    Normalized: ${metric.normalized.toFixed(3)}`);
        console.log(`    Threshold: ${metric.threshold}`);
        if (metric.factors) {
          console.log(`    Factors: ${metric.factors.join(', ')}`);
        }
      });
      console.log();
    }

    // Summary
    console.log('─────────────────────────────────────────────────────────────────');
    if (analysis.level === 'NORMAL') {
      console.log('✅ Session conditions are normal. Continue working.\n');
    } else if (analysis.level === 'ELEVATED') {
      console.log('⚠️  Pressure is elevated. Increase verification and monitoring.\n');
    } else if (analysis.level === 'HIGH') {
      console.log('🔄 Pressure is high. Consider refreshing context soon.\n');
    } else if (analysis.level === 'CRITICAL') {
      console.log('🚨 Critical pressure! Mandatory verification required.\n');
    } else if (analysis.level === 'DANGEROUS') {
      console.log('🛑 DANGEROUS conditions! Halt and refresh context immediately.\n');
    }
  }

  return analysis;
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();

  // Validate inputs
  if (options.tokenUsage === null) {
    console.error('Error: --tokens argument required');
    console.error('Usage: node scripts/check-session-pressure.js --tokens <current>/<budget>');
    console.error('Run with --help for more information');
    process.exit(1);
  }

  const analysis = analyzeSession(options);

  // Exit with appropriate code
  const exitCodes = {
    NORMAL: 0,
    ELEVATED: 0,
    HIGH: 1,
    CRITICAL: 2,
    DANGEROUS: 3
  };
  process.exit(exitCodes[analysis.level] || 0);
}

module.exports = { analyzeSession, parseArgs };
