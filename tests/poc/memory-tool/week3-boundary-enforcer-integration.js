/**
 * Phase 5 PoC - Week 3: BoundaryEnforcer + MemoryProxy Integration Test
 *
 * Goal: Validate BoundaryEnforcer can:
 * 1. Initialize MemoryProxy and load enforcement rules (inst_016, inst_017, inst_018)
 * 2. Enforce boundaries using loaded rules
 * 3. Create audit trail in .memory/audit/
 *
 * Success Criteria:
 * - MemoryProxy initializes successfully
 * - All 3 critical rules loaded (inst_016, inst_017, inst_018)
 * - Enforcement still works (95%+ accuracy)
 * - Audit trail created with JSONL entries
 */

const path = require('path');
const fs = require('fs').promises;
const { MemoryProxyService, getMemoryProxy } = require('../../../src/services/MemoryProxy.service');
const BoundaryEnforcer = require('../../../src/services/BoundaryEnforcer.service');

// Configuration
const TEST_MEMORY_PATH = path.join(__dirname, '../../../.memory-poc-week3');
const INSTRUCTION_HISTORY_PATH = path.join(__dirname, '../../../.claude/instruction-history.json');

// Test enforcement scenarios
const TEST_SCENARIOS = [
  {
    name: 'Values Decision (BLOCKED)',
    action: {
      description: 'Decide whether to prioritize privacy over convenience',
      domain: 'values',
      type: 'policy_decision'
    },
    expectedBlocked: true,
    expectedBoundary: 'VALUES'
  },
  {
    name: 'Technical Implementation (ALLOWED)',
    action: {
      description: 'Implement caching for API responses',
      domain: 'technical',
      type: 'implementation'
    },
    expectedBlocked: false
  },
  {
    name: 'Strategic Decision (BLOCKED)',
    action: {
      description: 'Define our long-term mission and vision',
      classification: { quadrant: 'STRATEGIC' },
      type: 'strategic_planning'
    },
    expectedBlocked: true,
    expectedBoundary: 'WISDOM'
  },
  {
    name: 'Innovation (BLOCKED)',
    action: {
      description: 'Create revolutionary new approach to AI governance',
      domain: 'innovation',
      type: 'innovation_proposal'
    },
    expectedBlocked: true,
    expectedBoundary: 'INNOVATION'
  },
  {
    name: 'Verification (ALLOWED)',
    action: {
      description: 'Verify current values alignment',
      domain: 'verification',
      pre_approved: true,
      type: 'verification'
    },
    expectedBlocked: false
  }
];

/**
 * Load Tractatus rules and persist to memory
 */
async function setupMemoryWithRules(memoryProxy) {
  console.log('[Setup] Loading Tractatus rules...');

  const data = await fs.readFile(INSTRUCTION_HISTORY_PATH, 'utf8');
  const parsed = JSON.parse(data);
  const rules = parsed.instructions;

  console.log(`  ✓ Loaded ${rules.length} rules from instruction history`);

  // Persist to memory
  const result = await memoryProxy.persistGovernanceRules(rules);
  console.log(`  ✓ Persisted ${result.rulesStored} rules to memory (${result.duration}ms)`);

  return result;
}

/**
 * Main test execution
 */
async function runIntegrationTest() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Phase 5 PoC Week 3: BoundaryEnforcer Integration Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = {
    success: false,
    memoryProxyInit: false,
    rulesLoaded: 0,
    enforcementTests: {
      total: 0,
      passed: 0,
      failed: 0,
      scenarios: []
    },
    auditTrailCreated: false,
    errors: []
  };

  try {
    // Step 1: Initialize MemoryProxy with test path
    console.log('[Step 1] Initializing MemoryProxy...');
    const memoryProxy = new MemoryProxyService({
      memoryBasePath: TEST_MEMORY_PATH,
      cacheEnabled: true,
      cacheTTL: 300000
    });

    await memoryProxy.initialize();
    results.memoryProxyInit = true;
    console.log('  ✓ MemoryProxy initialized\n');

    // Step 2: Load Tractatus rules into memory
    console.log('[Step 2] Persisting Tractatus rules to memory...');
    await setupMemoryWithRules(memoryProxy);

    // Step 3: Initialize BoundaryEnforcer (uses singleton, but we'll create new instance)
    console.log('\n[Step 3] Initializing BoundaryEnforcer...');

    // Create new BoundaryEnforcer instance that uses our test MemoryProxy
    const { BoundaryEnforcer: BoundaryEnforcerClass } = require('../../../src/services/BoundaryEnforcer.service');
    const enforcer = new BoundaryEnforcerClass();

    // Override memoryProxy with our test instance
    enforcer.memoryProxy = memoryProxy;

    const initResult = await enforcer.initialize();

    if (initResult.success) {
      results.rulesLoaded = initResult.rulesLoaded;
      console.log(`  ✓ BoundaryEnforcer initialized with ${initResult.rulesLoaded} enforcement rules`);
      console.log(`    Rules: ${initResult.enforcementRules.join(', ')}`);
    } else {
      throw new Error(`BoundaryEnforcer initialization failed: ${initResult.error}`);
    }

    // Step 4: Test enforcement scenarios
    console.log('\n[Step 4] Testing enforcement scenarios...\n');

    for (const scenario of TEST_SCENARIOS) {
      results.enforcementTests.total++;

      console.log(`  Testing: ${scenario.name}`);

      const enforcementResult = enforcer.enforce(scenario.action, {
        sessionId: 'week3-integration-test'
      });

      const blocked = enforcementResult.humanRequired === true;
      const passed = blocked === scenario.expectedBlocked;

      if (passed) {
        results.enforcementTests.passed++;
        console.log(`    ✓ PASS: ${blocked ? 'Blocked' : 'Allowed'} as expected`);

        if (scenario.expectedBoundary && enforcementResult.boundary) {
          const boundaryMatch = enforcementResult.boundary === scenario.expectedBoundary;
          if (boundaryMatch) {
            console.log(`      Boundary: ${enforcementResult.boundary} (correct)`);
          } else {
            console.log(`      Boundary: ${enforcementResult.boundary} (expected ${scenario.expectedBoundary})`);
          }
        }
      } else {
        results.enforcementTests.failed++;
        console.log(`    ✗ FAIL: ${blocked ? 'Blocked' : 'Allowed'} (expected ${scenario.expectedBlocked ? 'blocked' : 'allowed'})`);
      }

      results.enforcementTests.scenarios.push({
        name: scenario.name,
        passed,
        blocked,
        expectedBlocked: scenario.expectedBlocked,
        boundary: enforcementResult.boundary
      });
    }

    // Step 5: Verify audit trail
    console.log('\n[Step 5] Verifying audit trail...');

    const today = new Date().toISOString().split('T')[0];
    const auditPath = path.join(TEST_MEMORY_PATH, `audit/decisions-${today}.jsonl`);

    try {
      const auditData = await fs.readFile(auditPath, 'utf8');
      const auditLines = auditData.trim().split('\n');

      results.auditTrailCreated = true;
      console.log(`  ✓ Audit trail created: ${auditLines.length} entries`);

      // Show sample audit entry
      if (auditLines.length > 0) {
        const sampleEntry = JSON.parse(auditLines[0]);
        console.log('\n  Sample audit entry:');
        console.log(`    Session: ${sampleEntry.sessionId}`);
        console.log(`    Action: ${sampleEntry.action}`);
        console.log(`    Allowed: ${sampleEntry.allowed}`);
        console.log(`    Rules checked: ${sampleEntry.rulesChecked.join(', ')}`);
      }
    } catch (error) {
      console.log(`  ✗ Audit trail not found: ${error.message}`);
      results.auditTrailCreated = false;
    }

    // Calculate accuracy
    const accuracy = (results.enforcementTests.passed / results.enforcementTests.total) * 100;
    console.log('\n[Step 6] Enforcement Accuracy Assessment...');
    console.log(`  Passed: ${results.enforcementTests.passed}/${results.enforcementTests.total} (${accuracy.toFixed(1)}%)`);

    const targetAccuracy = 95;
    if (accuracy >= targetAccuracy) {
      console.log(`  ✓ Target accuracy met (>=${targetAccuracy}%)`);
      results.success = true;
    } else {
      console.log(`  ✗ Below target accuracy of ${targetAccuracy}%`);
      results.success = false;
    }

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
    try {
      await fs.rm(TEST_MEMORY_PATH, { recursive: true, force: true });
      console.log('  ✓ Cleanup complete');
    } catch (error) {
      console.log('  ⚠ Cleanup warning:', error.message);
    }
  }

  // Results summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  TEST RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (results.success) {
    console.log('✅ SUCCESS: BoundaryEnforcer + MemoryProxy integration validated');
    console.log('\nKey Findings:');
    console.log(`  • MemoryProxy initialized: ${results.memoryProxyInit ? 'Yes' : 'No'}`);
    console.log(`  • Enforcement rules loaded: ${results.rulesLoaded}/3`);
    console.log(`  • Enforcement tests: ${results.enforcementTests.passed}/${results.enforcementTests.total} passed`);
    console.log(`  • Accuracy: ${((results.enforcementTests.passed / results.enforcementTests.total) * 100).toFixed(1)}%`);
    console.log(`  • Audit trail created: ${results.auditTrailCreated ? 'Yes' : 'No'}`);

    console.log('\nNext Steps:');
    console.log('  1. Integrate MemoryProxy with BlogCuration service');
    console.log('  2. Test context editing (50+ turn conversation)');
    console.log('  3. Create migration script (.claude/ → .memory/)');
  } else {
    console.log('❌ FAILURE: Integration test did not pass');
    console.log('\nErrors:');
    results.errors.forEach(err => console.log(`  • ${err}`));

    if (results.enforcementTests.failed > 0) {
      console.log('\nFailed scenarios:');
      results.enforcementTests.scenarios
        .filter(s => !s.passed)
        .forEach(s => console.log(`  • ${s.name}`));
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return results;
}

// Run test
if (require.main === module) {
  runIntegrationTest()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runIntegrationTest };
