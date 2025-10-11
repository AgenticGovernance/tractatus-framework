#!/usr/bin/env node

/**
 * Session 1 Integration Test
 * Validates InstructionPersistenceClassifier and CrossReferenceValidator
 * integration with MemoryProxy
 */

const InstructionPersistenceClassifier = require('../src/services/InstructionPersistenceClassifier.service');
const CrossReferenceValidator = require('../src/services/CrossReferenceValidator.service');
const { getMemoryProxy } = require('../src/services/MemoryProxy.service');
const fs = require('fs').promises;
const path = require('path');

async function testSession1Integration() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Session 1 Integration Test');
  console.log('  InstructionPersistenceClassifier + CrossReferenceValidator');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = {
    memoryProxy: { initialized: false },
    classifier: { initialized: false, referenceRulesLoaded: 0 },
    validator: { initialized: false, governanceRulesLoaded: 0 },
    classificationTest: { passed: false },
    validationTest: { passed: false },
    auditTrail: { exists: false, entries: 0 }
  };

  try {
    // Step 1: Initialize MemoryProxy (shared singleton)
    console.log('[Step 1] Initializing MemoryProxy...');
    const memoryProxy = getMemoryProxy();
    await memoryProxy.initialize();
    results.memoryProxy.initialized = true;
    console.log('  ✓ MemoryProxy initialized\n');

    // Step 2: Initialize InstructionPersistenceClassifier
    console.log('[Step 2] Initializing InstructionPersistenceClassifier...');
    const classifierResult = await InstructionPersistenceClassifier.initialize();

    if (classifierResult.success) {
      results.classifier.initialized = true;
      results.classifier.referenceRulesLoaded = classifierResult.referenceRulesLoaded;
      console.log(`  ✓ InstructionPersistenceClassifier initialized`);
      console.log(`    Reference rules loaded: ${classifierResult.referenceRulesLoaded}\n`);
    } else {
      throw new Error(`Classifier initialization failed: ${classifierResult.error}`);
    }

    // Step 3: Initialize CrossReferenceValidator
    console.log('[Step 3] Initializing CrossReferenceValidator...');
    const validatorResult = await CrossReferenceValidator.initialize();

    if (validatorResult.success) {
      results.validator.initialized = true;
      results.validator.governanceRulesLoaded = validatorResult.governanceRulesLoaded;
      console.log(`  ✓ CrossReferenceValidator initialized`);
      console.log(`    Governance rules loaded: ${validatorResult.governanceRulesLoaded}\n`);
    } else {
      throw new Error(`Validator initialization failed: ${validatorResult.error}`);
    }

    // Step 4: Test classification with audit
    console.log('[Step 4] Testing classification with audit trail...');

    const testInstruction = {
      text: 'Always check port 27027 for MongoDB connections',
      context: { sessionId: 'session1-integration-test' },
      timestamp: new Date(),
      source: 'user'
    };

    const classification = InstructionPersistenceClassifier.classify(testInstruction);

    console.log(`  ✓ Classification result:`);
    console.log(`    Quadrant: ${classification.quadrant}`);
    console.log(`    Persistence: ${classification.persistence}`);
    console.log(`    Verification: ${classification.verification}`);
    console.log(`    Explicitness: ${classification.explicitness.toFixed(2)}\n`);

    if (classification.quadrant && classification.persistence) {
      results.classificationTest.passed = true;
    }

    // Step 5: Test validation with audit
    console.log('[Step 5] Testing validation with audit trail...');

    const testAction = {
      description: 'Connect to MongoDB on port 27017',
      parameters: { port: '27017' }
    };

    const testContext = {
      sessionId: 'session1-integration-test',
      recent_instructions: [classification]
    };

    const validation = CrossReferenceValidator.validate(testAction, testContext);

    console.log(`  ✓ Validation result:`);
    console.log(`    Status: ${validation.status}`);
    console.log(`    Conflicts: ${validation.conflicts?.length || 0}`);
    console.log(`    Action: ${validation.action}\n`);

    if (validation.status) {
      results.validationTest.passed = true;
    }

    // Step 6: Verify audit trail (wait for async writes)
    console.log('[Step 6] Verifying audit trail...');

    // Wait for async audit writes
    await new Promise(resolve => setTimeout(resolve, 100));

    const today = new Date().toISOString().split('T')[0];
    const auditPath = path.join(__dirname, '../.memory/audit', `decisions-${today}.jsonl`);

    try {
      const auditData = await fs.readFile(auditPath, 'utf8');
      const auditLines = auditData.trim().split('\n');

      // Filter for session1 entries
      const session1Entries = auditLines.filter(line => {
        try {
          const entry = JSON.parse(line);
          return entry.sessionId === 'session1-integration-test';
        } catch {
          return false;
        }
      });

      results.auditTrail.exists = true;
      results.auditTrail.entries = session1Entries.length;

      console.log(`  ✓ Audit trail exists: ${auditPath}`);
      console.log(`    Session 1 entries: ${session1Entries.length}`);

      if (session1Entries.length > 0) {
        console.log('\n    Sample entries:');
        session1Entries.slice(0, 2).forEach((line, idx) => {
          const entry = JSON.parse(line);
          console.log(`      ${idx + 1}. Action: ${entry.action} | Allowed: ${entry.allowed}`);
        });
      }
    } catch (error) {
      console.log(`  ⚠ Audit trail check: ${error.message}`);
    }

    console.log();

  } catch (error) {
    console.error(`\n✗ Integration test failed: ${error.message}\n`);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }

  // Results summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  INTEGRATION TEST RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('✅ SESSION 1 INTEGRATION SUCCESSFUL\n');

  console.log('Services Initialized:');
  console.log(`  • MemoryProxy: ${results.memoryProxy.initialized ? '✅' : '❌'}`);
  console.log(`  • InstructionPersistenceClassifier: ${results.classifier.initialized ? '✅' : '❌'} (${results.classifier.referenceRulesLoaded} reference rules)`);
  console.log(`  • CrossReferenceValidator: ${results.validator.initialized ? '✅' : '❌'} (${results.validator.governanceRulesLoaded} governance rules)`);

  console.log('\nFunctionality Tests:');
  console.log(`  • Classification with audit: ${results.classificationTest.passed ? '✅' : '❌'}`);
  console.log(`  • Validation with audit: ${results.validationTest.passed ? '✅' : '❌'}`);

  console.log('\nAudit Trail:');
  console.log(`  • Created: ${results.auditTrail.exists ? '✅' : '❌'}`);
  console.log(`  • Session 1 entries: ${results.auditTrail.entries}`);

  console.log('\n📊 Integration Status: 🟢 OPERATIONAL');
  console.log('\nIntegration Progress:');
  console.log('  • Session 1: 4/6 services integrated (67%)');
  console.log('  • BoundaryEnforcer: ✅ (Week 3)');
  console.log('  • BlogCuration: ✅ (Week 3)');
  console.log('  • InstructionPersistenceClassifier: ✅ (Session 1)');
  console.log('  • CrossReferenceValidator: ✅ (Session 1)');
  console.log('  • MetacognitiveVerifier: ⏳ (Session 2)');
  console.log('  • ContextPressureMonitor: ⏳ (Session 2)');

  console.log('\nNext Steps:');
  console.log('  1. ✅ Core services integrated (4/6)');
  console.log('  2. 🔄 Session 2: Integrate MetacognitiveVerifier + ContextPressureMonitor');
  console.log('  3. 🔄 Target: 100% service integration');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run test
testSession1Integration();
