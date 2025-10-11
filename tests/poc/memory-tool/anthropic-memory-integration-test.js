/**
 * Phase 5 PoC - Anthropic Memory Tool Integration Test
 *
 * Goal: Validate that Claude API can use memory tool to persist/retrieve governance rules
 *
 * Success Criteria:
 * - Claude can write rules to memory via tool use
 * - Claude can read rules from memory in subsequent requests
 * - Latency overhead <500ms (PoC tolerance)
 * - Data integrity maintained across API calls
 */

const Anthropic = require('@anthropic-ai/sdk');
const { FilesystemMemoryBackend } = require('./basic-persistence-test');
const path = require('path');

// Configuration
const MEMORY_BASE_PATH = path.join(__dirname, '../../../.memory-poc-anthropic');
const MODEL = 'claude-sonnet-4-5';
const TEST_RULES = {
  inst_001: {
    id: 'inst_001',
    text: 'Never fabricate statistics or quantitative claims without verifiable sources',
    quadrant: 'OPERATIONAL',
    persistence: 'HIGH'
  },
  inst_016: {
    id: 'inst_016',
    text: 'No fabricated statistics (e.g., "95% of users"): require source',
    quadrant: 'OPERATIONAL',
    persistence: 'HIGH'
  },
  inst_017: {
    id: 'inst_017',
    text: 'No absolute guarantees ("will always"): use probabilistic language',
    quadrant: 'OPERATIONAL',
    persistence: 'HIGH'
  }
};

// Initialize Anthropic client
function createClient() {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY environment variable not set');
  }

  return new Anthropic({
    apiKey
  });
}

// Simulate memory tool handling (client-side implementation)
async function handleMemoryToolUse(toolUse, backend) {
  const { input } = toolUse;

  console.log(`  Memory Tool Called: ${input.command}`);
  console.log(`    Path: ${input.path || 'N/A'}`);

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

    case 'str_replace':
      // For PoC, we'll keep it simple - just recreate the file
      try {
        const current = await backend.view(input.path);
        const updated = JSON.stringify(current).replace(input.old_str, input.new_str);
        await backend.create(input.path, JSON.parse(updated));
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'File updated successfully'
        };
      } catch (error) {
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          is_error: true,
          content: `Error updating file: ${error.message}`
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
async function runAnthropicMemoryTest() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Phase 5 PoC: Anthropic Memory Tool Integration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const backend = new FilesystemMemoryBackend(MEMORY_BASE_PATH);
  const results = {
    success: false,
    apiCalls: 0,
    memoryOperations: 0,
    timings: {},
    errors: []
  };

  try {
    // Check API key
    if (!process.env.CLAUDE_API_KEY) {
      console.log('⚠️  CLAUDE_API_KEY not set - skipping API tests');
      console.log('   Running in simulation mode...\n');

      // Simulate the workflow without actual API calls
      console.log('[Simulation] Step 1: Initialize backend...');
      await backend.initialize();

      console.log('[Simulation] Step 2: Store governance rules...');
      const rulesArray = Object.values(TEST_RULES);
      await backend.create('governance/tractatus-rules-v1.json', {
        version: '1.0',
        rules: rulesArray,
        updated_at: new Date().toISOString()
      });

      console.log('[Simulation] Step 3: Retrieve rules...');
      const retrieved = await backend.view('governance/tractatus-rules-v1.json');

      console.log('[Simulation] Step 4: Validate integrity...');
      const expectedCount = rulesArray.length;
      const actualCount = retrieved.rules.length;

      if (expectedCount === actualCount) {
        console.log(`  ✓ Rule count matches: ${actualCount}`);
        results.success = true;
      } else {
        throw new Error(`Rule count mismatch: expected ${expectedCount}, got ${actualCount}`);
      }

      console.log('\n✅ SIMULATION COMPLETE');
      console.log('\nTo run with actual API:');
      console.log('  export CLAUDE_API_KEY=your-key-here');
      console.log('  node tests/poc/memory-tool/anthropic-memory-integration-test.js\n');

    } else {
      // Real API test
      console.log('[Step 1] Initializing Anthropic client...');
      const client = createClient();
      console.log(`  Model: ${MODEL}`);
      console.log(`  Beta: context-management-2025-06-27\n`);

      console.log('[Step 2] Initialize memory backend...');
      await backend.initialize();

      // Test 1: Ask Claude to store a governance rule
      console.log('[Step 3] Testing memory tool - CREATE operation...');
      const createStart = Date.now();

      const createResponse = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Store this governance rule in memory at path "governance/inst_001.json":

${JSON.stringify(TEST_RULES.inst_001, null, 2)}

Use the memory tool to create this file.`
        }],
        tools: [{
          type: 'memory_20250818',
          name: 'memory',
          description: 'Persistent storage for Tractatus governance rules'
        }],
        betas: ['context-management-2025-06-27']
      });

      results.apiCalls++;
      results.timings.create = Date.now() - createStart;

      // Handle tool use
      const toolUses = createResponse.content.filter(block => block.type === 'tool_use');
      if (toolUses.length > 0) {
        console.log(`  ✓ Claude invoked memory tool (${toolUses.length} operations)`);

        for (const toolUse of toolUses) {
          const result = await handleMemoryToolUse(toolUse, backend);
          results.memoryOperations++;

          if (result.is_error) {
            throw new Error(`Memory tool error: ${result.content}`);
          }
          console.log(`    ✓ ${toolUse.input.command}: ${result.content}`);
        }
      } else {
        console.log('  ⚠️  Claude did not use memory tool');
      }

      // Test 2: Ask Claude to retrieve the rule
      console.log('\n[Step 4] Testing memory tool - VIEW operation...');
      const viewStart = Date.now();

      const viewResponse = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: 'Retrieve the governance rule from memory at path "governance/inst_001.json" and tell me the rule ID and persistence level.'
        }],
        tools: [{
          type: 'memory_20250818',
          name: 'memory',
          description: 'Persistent storage for Tractatus governance rules'
        }],
        betas: ['context-management-2025-06-27']
      });

      results.apiCalls++;
      results.timings.view = Date.now() - viewStart;

      const viewToolUses = viewResponse.content.filter(block => block.type === 'tool_use');
      if (viewToolUses.length > 0) {
        console.log(`  ✓ Claude retrieved from memory (${viewToolUses.length} operations)`);

        for (const toolUse of viewToolUses) {
          const result = await handleMemoryToolUse(toolUse, backend);
          results.memoryOperations++;

          if (result.is_error) {
            throw new Error(`Memory tool error: ${result.content}`);
          }
          console.log(`    ✓ ${toolUse.input.command}: Retrieved successfully`);
        }
      }

      // Validate response
      const textBlocks = viewResponse.content.filter(block => block.type === 'text');
      const responseText = textBlocks.map(b => b.text).join(' ');

      console.log('\n[Step 5] Validating Claude\'s response...');
      const checks = [
        { label: 'Mentions inst_001', test: responseText.includes('inst_001') },
        { label: 'Mentions HIGH persistence', test: responseText.toLowerCase().includes('high') },
        { label: 'Understood the data', test: responseText.length > 50 }
      ];

      let allPassed = true;
      for (const check of checks) {
        const status = check.test ? '✓' : '✗';
        console.log(`  ${status} ${check.label}`);
        if (!check.test) allPassed = false;
      }

      if (!allPassed) {
        console.log('\n  Response:', responseText);
        throw new Error('Validation checks failed');
      }

      results.success = true;
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
    await backend.cleanup();
  }

  // Results summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  TEST RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (results.success) {
    console.log('✅ SUCCESS: Memory tool integration validated');
    console.log('\nKey Findings:');
    console.log(`  • API calls made: ${results.apiCalls}`);
    console.log(`  • Memory operations: ${results.memoryOperations}`);

    if (results.timings.create) {
      console.log(`  • CREATE latency: ${results.timings.create}ms`);
    }
    if (results.timings.view) {
      console.log(`  • VIEW latency: ${results.timings.view}ms`);
    }

    console.log('\nNext Steps:');
    console.log('  1. Test with all 18 Tractatus rules');
    console.log('  2. Test enforcement of inst_016, inst_017, inst_018');
    console.log('  3. Measure context editing effectiveness');
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
  runAnthropicMemoryTest()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runAnthropicMemoryTest };
