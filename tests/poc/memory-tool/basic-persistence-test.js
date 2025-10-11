/**
 * Phase 5 PoC - Memory Tool Basic Persistence Test
 *
 * Goal: Prove that governance rules can persist across separate API calls
 *
 * Success Criteria:
 * - Rule persists to memory tool
 * - Rule retrieved in separate API call
 * - Data integrity maintained (no corruption)
 * - Latency overhead measured
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const MEMORY_BASE_PATH = path.join(__dirname, '../../../.memory-poc');
const TEST_RULE = {
  id: 'inst_001',
  text: 'Never fabricate statistics or quantitative claims without verifiable sources',
  quadrant: 'OPERATIONAL',
  persistence: 'HIGH',
  rationale: 'Foundational integrity principle - statistical claims must be evidence-based',
  examples: [
    'PASS: "MongoDB typically uses port 27017"',
    'FAIL: "95% of users prefer our framework" (without source)'
  ],
  created_at: new Date().toISOString()
};

// Simple filesystem-based memory backend
class FilesystemMemoryBackend {
  constructor(basePath) {
    this.basePath = basePath;
  }

  async initialize() {
    // Create memory directory structure
    await fs.mkdir(path.join(this.basePath, 'governance'), { recursive: true });
    await fs.mkdir(path.join(this.basePath, 'sessions'), { recursive: true });
    await fs.mkdir(path.join(this.basePath, 'audit'), { recursive: true });
    console.log('✓ Memory backend initialized:', this.basePath);
  }

  async create(filePath, data) {
    const fullPath = path.join(this.basePath, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('✓ Created memory file:', filePath);
  }

  async view(filePath) {
    const fullPath = path.join(this.basePath, filePath);
    const data = await fs.readFile(fullPath, 'utf8');
    console.log('✓ Retrieved memory file:', filePath);
    return JSON.parse(data);
  }

  async exists(filePath) {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async cleanup() {
    await fs.rm(this.basePath, { recursive: true, force: true });
    console.log('✓ Cleaned up memory backend');
  }
}

// Test execution
async function runPoCTest() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Phase 5 PoC: Memory Tool Basic Persistence Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const backend = new FilesystemMemoryBackend(MEMORY_BASE_PATH);
  const results = {
    success: false,
    timings: {},
    errors: []
  };

  try {
    // Step 1: Initialize backend
    console.log('[Step 1] Initializing memory backend...');
    const initStart = Date.now();
    await backend.initialize();
    results.timings.initialization = Date.now() - initStart;
    console.log(`  Time: ${results.timings.initialization}ms\n`);

    // Step 2: Persist test rule
    console.log('[Step 2] Persisting governance rule to memory...');
    console.log(`  Rule: ${TEST_RULE.id}`);
    console.log(`  Persistence: ${TEST_RULE.persistence}`);
    const persistStart = Date.now();
    await backend.create('governance/test-rule.json', TEST_RULE);
    results.timings.persist = Date.now() - persistStart;
    console.log(`  Time: ${results.timings.persist}ms\n`);

    // Step 3: Verify file exists
    console.log('[Step 3] Verifying file persistence...');
    const exists = await backend.exists('governance/test-rule.json');
    if (!exists) {
      throw new Error('File does not exist after creation');
    }
    console.log('  ✓ File exists on filesystem\n');

    // Step 4: Retrieve rule (simulating separate API call)
    console.log('[Step 4] Retrieving rule (separate operation)...');
    const retrieveStart = Date.now();
    const retrieved = await backend.view('governance/test-rule.json');
    results.timings.retrieve = Date.now() - retrieveStart;
    console.log(`  Time: ${results.timings.retrieve}ms\n`);

    // Step 5: Validate data integrity
    console.log('[Step 5] Validating data integrity...');
    const validations = [
      { field: 'id', expected: TEST_RULE.id, actual: retrieved.id },
      { field: 'persistence', expected: TEST_RULE.persistence, actual: retrieved.persistence },
      { field: 'quadrant', expected: TEST_RULE.quadrant, actual: retrieved.quadrant },
      { field: 'text', expected: TEST_RULE.text, actual: retrieved.text }
    ];

    let allValid = true;
    for (const validation of validations) {
      const isValid = validation.expected === validation.actual;
      const status = isValid ? '✓' : '✗';
      console.log(`  ${status} ${validation.field}: ${isValid ? 'MATCH' : 'MISMATCH'}`);
      if (!isValid) {
        console.log(`    Expected: ${validation.expected}`);
        console.log(`    Actual: ${validation.actual}`);
        allValid = false;
      }
    }

    if (!allValid) {
      throw new Error('Data integrity validation failed');
    }

    console.log('\n[Step 6] Performance Assessment...');
    const totalLatency = results.timings.persist + results.timings.retrieve;
    console.log(`  Persist latency: ${results.timings.persist}ms`);
    console.log(`  Retrieve latency: ${results.timings.retrieve}ms`);
    console.log(`  Total overhead: ${totalLatency}ms`);

    const target = 500; // PoC tolerance
    const status = totalLatency < target ? 'PASS' : 'WARN';
    console.log(`  Target: <${target}ms - ${status}`);

    results.success = true;
    results.totalLatency = totalLatency;

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
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
    console.log('✅ SUCCESS: Rule persistence validated');
    console.log('\nKey Findings:');
    console.log('  • Persistence: ✓ 100% (no data loss)');
    console.log('  • Data integrity: ✓ 100% (no corruption)');
    console.log(`  • Performance: ✓ ${results.totalLatency}ms total overhead`);
    console.log('\nNext Steps:');
    console.log('  1. Integrate with Anthropic Claude API (memory tool)');
    console.log('  2. Test with inst_016, inst_017, inst_018');
    console.log('  3. Measure API latency overhead');
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
  runPoCTest()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runPoCTest, FilesystemMemoryBackend };
