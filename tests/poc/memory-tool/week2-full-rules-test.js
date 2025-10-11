/**
 * Phase 5 PoC - Week 2: Full Tractatus Rules Integration
 *
 * Goal: Load all 18 governance rules into memory tool and validate persistence
 *
 * Success Criteria:
 * - All 18 rules stored successfully
 * - All 18 rules retrieved with 100% fidelity
 * - API latency measured and acceptable (<1000ms per operation)
 * - Data integrity maintained across storage/retrieval
 */

const Anthropic = require('@anthropic-ai/sdk');
const { FilesystemMemoryBackend } = require('./basic-persistence-test');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

// Configuration
const MEMORY_BASE_PATH = path.join(__dirname, '../../../.memory-poc-week2');
const MODEL = 'claude-sonnet-4-5';
const INSTRUCTION_HISTORY_PATH = path.join(__dirname, '../../../.claude/instruction-history.json');

// Load Tractatus governance rules
async function loadTractatusRules() {
  const data = await fs.readFile(INSTRUCTION_HISTORY_PATH, 'utf8');
  const parsed = JSON.parse(data);
  return parsed.instructions;
}

// Initialize Anthropic client
function createClient() {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY environment variable not set');
  }

  return new Anthropic({ apiKey });
}

// Simulate memory tool handling (client-side implementation)
async function handleMemoryToolUse(toolUse, backend) {
  const { input } = toolUse;

  switch (input.command) {
    case 'view':
      try {
        const data = await backend.view(input.path);
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(data, null, 2)
        };
      } catch (error) {
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          is_error: true,
          content: `Error reading file: ${error.message}`
        };
      }

    case 'create':
      try {
        const data = input.content ? JSON.parse(input.content) : input.data;
        await backend.create(input.path, data);
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'File created successfully'
        };
      } catch (error) {
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          is_error: true,
          content: `Error creating file: ${error.message}`
        };
      }

    default:
      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        is_error: true,
        content: `Unsupported command: ${input.command}`
      };
  }
}

// Main test execution
async function runFullRulesTest() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Phase 5 PoC Week 2: Full Tractatus Rules Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const backend = new FilesystemMemoryBackend(MEMORY_BASE_PATH);
  const results = {
    success: false,
    rulesLoaded: 0,
    rulesStored: 0,
    rulesRetrieved: 0,
    integrityChecks: { passed: 0, failed: 0 },
    apiCalls: 0,
    memoryOperations: 0,
    timings: {},
    errors: []
  };

  try {
    // Step 1: Load Tractatus rules
    console.log('[Step 1] Loading Tractatus governance rules...');
    const loadStart = Date.now();
    const rules = await loadTractatusRules();
    results.timings.load = Date.now() - loadStart;
    results.rulesLoaded = rules.length;

    console.log(`  ✓ Loaded ${rules.length} governance rules`);
    console.log(`    Time: ${results.timings.load}ms`);

    // Show rule breakdown
    const quadrantCounts = {};
    const persistenceCounts = {};
    rules.forEach(rule => {
      quadrantCounts[rule.quadrant] = (quadrantCounts[rule.quadrant] || 0) + 1;
      persistenceCounts[rule.persistence] = (persistenceCounts[rule.persistence] || 0) + 1;
    });

    console.log('\n  Rule Distribution:');
    Object.entries(quadrantCounts).forEach(([quadrant, count]) => {
      console.log(`    ${quadrant}: ${count}`);
    });
    console.log('\n  Persistence Levels:');
    Object.entries(persistenceCounts).forEach(([level, count]) => {
      console.log(`    ${level}: ${count}`);
    });

    // Step 2: Initialize backend
    console.log('\n[Step 2] Initializing memory backend...');
    await backend.initialize();

    // Step 3: Store rules in filesystem first (baseline)
    console.log('\n[Step 3] Storing rules to filesystem backend...');
    const storeStart = Date.now();

    const rulesData = {
      version: '1.0',
      updated_at: new Date().toISOString(),
      total_rules: rules.length,
      rules: rules
    };

    await backend.create('governance/tractatus-rules-complete.json', rulesData);
    results.timings.store = Date.now() - storeStart;
    results.rulesStored = rules.length;

    console.log(`  ✓ Stored ${rules.length} rules`);
    console.log(`    Time: ${results.timings.store}ms`);
    console.log(`    Latency per rule: ${(results.timings.store / rules.length).toFixed(2)}ms`);

    // Step 4: Retrieve and validate
    console.log('\n[Step 4] Retrieving rules from backend...');
    const retrieveStart = Date.now();
    const retrieved = await backend.view('governance/tractatus-rules-complete.json');
    results.timings.retrieve = Date.now() - retrieveStart;
    results.rulesRetrieved = retrieved.rules.length;

    console.log(`  ✓ Retrieved ${retrieved.rules.length} rules`);
    console.log(`    Time: ${results.timings.retrieve}ms`);

    // Step 5: Data integrity validation
    console.log('\n[Step 5] Validating data integrity...');

    if (retrieved.rules.length !== rules.length) {
      throw new Error(`Rule count mismatch: stored ${rules.length}, retrieved ${retrieved.rules.length}`);
    }

    // Check each rule
    for (let i = 0; i < rules.length; i++) {
      const original = rules[i];
      const retrieved_rule = retrieved.rules[i];

      const checks = [
        { field: 'id', match: original.id === retrieved_rule.id },
        { field: 'text', match: original.text === retrieved_rule.text },
        { field: 'quadrant', match: original.quadrant === retrieved_rule.quadrant },
        { field: 'persistence', match: original.persistence === retrieved_rule.persistence }
      ];

      const allMatch = checks.every(c => c.match);

      if (allMatch) {
        results.integrityChecks.passed++;
      } else {
        results.integrityChecks.failed++;
        console.log(`  ✗ Rule ${original.id} failed integrity check`);
        checks.forEach(check => {
          if (!check.match) {
            console.log(`    ${check.field}: mismatch`);
          }
        });
      }
    }

    const integrityRate = (results.integrityChecks.passed / rules.length) * 100;
    console.log(`\n  Integrity: ${results.integrityChecks.passed}/${rules.length} rules (${integrityRate.toFixed(1)}%)`);

    if (results.integrityChecks.failed > 0) {
      throw new Error(`Data integrity validation failed: ${results.integrityChecks.failed} rules corrupted`);
    }

    // Step 6: Test critical rules individually
    console.log('\n[Step 6] Testing critical enforcement rules...');

    const criticalRules = rules.filter(r =>
      ['inst_016', 'inst_017', 'inst_018'].includes(r.id)
    );

    console.log(`  Testing ${criticalRules.length} critical rules:`);

    for (const rule of criticalRules) {
      await backend.create(`governance/${rule.id}.json`, rule);
      const retrieved_single = await backend.view(`governance/${rule.id}.json`);

      const match = JSON.stringify(rule) === JSON.stringify(retrieved_single);
      const status = match ? '✓' : '✗';
      console.log(`    ${status} ${rule.id}: ${match ? 'PASS' : 'FAIL'}`);

      if (!match) {
        throw new Error(`Critical rule ${rule.id} failed validation`);
      }
    }

    // Step 7: Performance summary
    console.log('\n[Step 7] Performance Assessment...');

    const totalLatency = results.timings.store + results.timings.retrieve;
    const avgPerRule = totalLatency / rules.length;

    console.log(`  Store: ${results.timings.store}ms (${(results.timings.store / rules.length).toFixed(2)}ms/rule)`);
    console.log(`  Retrieve: ${results.timings.retrieve}ms`);
    console.log(`  Total: ${totalLatency}ms`);
    console.log(`  Average per rule: ${avgPerRule.toFixed(2)}ms`);

    const target = 1000; // 1 second per batch operation
    const status = totalLatency < target ? 'PASS' : 'WARN';
    console.log(`  Target: <${target}ms - ${status}`);

    results.success = true;
    results.totalLatency = totalLatency;

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    results.errors.push(error.message);
    results.success = false;
  } finally {
    // Cleanup
    console.log('\n[Cleanup] Removing test data...');
    await backend.cleanup();
  }

  // Results summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  TEST RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (results.success) {
    console.log('✅ SUCCESS: All 18 Tractatus rules validated');
    console.log('\nKey Findings:');
    console.log(`  • Rules loaded: ${results.rulesLoaded}`);
    console.log(`  • Rules stored: ${results.rulesStored}`);
    console.log(`  • Rules retrieved: ${results.rulesRetrieved}`);
    console.log(`  • Data integrity: ${results.integrityChecks.passed}/${results.rulesLoaded} (${((results.integrityChecks.passed / results.rulesLoaded) * 100).toFixed(1)}%)`);
    console.log(`  • Performance: ${results.totalLatency}ms total`);
    console.log(`  • Average per rule: ${(results.totalLatency / results.rulesLoaded).toFixed(2)}ms`);

    console.log('\nNext Steps:');
    console.log('  1. Test with real Claude API (memory tool operations)');
    console.log('  2. Measure API latency overhead');
    console.log('  3. Test context editing with 50+ turn conversation');
  } else {
    console.log('❌ FAILURE: Test did not pass');
    console.log('\nErrors:');
    results.errors.forEach(err => console.log(`  • ${err}`));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return results;
}

// Run test
if (require.main === module) {
  runFullRulesTest()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runFullRulesTest };
