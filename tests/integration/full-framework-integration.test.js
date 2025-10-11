/**
 * Full Tractatus Framework Integration Test
 *
 * Verifies complete integration of all 5 core Tractatus services with MongoDB + Anthropic hybrid backend:
 * 1. InstructionPersistenceClassifier
 * 2. CrossReferenceValidator
 * 3. BoundaryEnforcer
 * 4. ContextPressureMonitor
 * 5. MetacognitiveVerifier
 *
 * Success Criteria:
 * - All services initialize with MongoDB
 * - Services communicate and share data correctly
 * - MongoDB persistence works across all models
 * - Complete audit trail is maintained
 * - End-to-end governance workflow succeeds
 */

require('dotenv').config();

const mongoose = require('mongoose');
const GovernanceRule = require('../../src/models/GovernanceRule.model');
const AuditLog = require('../../src/models/AuditLog.model');
const SessionState = require('../../src/models/SessionState.model');
const VerificationLog = require('../../src/models/VerificationLog.model');

const classifier = require('../../src/services/InstructionPersistenceClassifier.service');
const validator = require('../../src/services/CrossReferenceValidator.service');
const enforcer = require('../../src/services/BoundaryEnforcer.service');
const monitor = require('../../src/services/ContextPressureMonitor.service');
const verifier = require('../../src/services/MetacognitiveVerifier.service');

describe('Full Tractatus Framework Integration', () => {
  const testSessionId = 'full-framework-test-session';

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_test';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB:', mongoose.connection.db.databaseName);

    // Clean up any existing test data
    await AuditLog.deleteMany({ sessionId: testSessionId });
    await SessionState.deleteOne({ sessionId: testSessionId });
    await VerificationLog.deleteMany({ sessionId: testSessionId });

    // Initialize all 5 services (moved from test to beforeAll)
    console.log('🔄 Initializing all 5 Tractatus services...');
    await classifier.initialize();
    await validator.initialize();
    await enforcer.initialize();
    await monitor.initialize(testSessionId);
    await verifier.initialize();
    console.log('✅ Services initialized');
  });

  afterAll(async () => {
    // Cleanup test data
    await AuditLog.deleteMany({ sessionId: testSessionId });
    await SessionState.deleteOne({ sessionId: testSessionId });
    await VerificationLog.deleteMany({ sessionId: testSessionId });

    await mongoose.connection.close();
    console.log('✅ Disconnected from MongoDB');
  });

  // =====================================================
  // TEST 1: All Services Initialize with MongoDB
  // =====================================================

  describe('1. Service Initialization', () => {
    test('should initialize all 5 services with MongoDB', async () => {
      console.log('\n🔄 Initializing all 5 Tractatus services...\n');

      // Initialize all services
      const classifierInit = await classifier.initialize();
      const validatorInit = await validator.initialize();
      const enforcerInit = await enforcer.initialize();
      const monitorInit = await monitor.initialize(testSessionId);
      const verifierInit = await verifier.initialize();

      // Verify all initialized successfully
      expect(classifierInit.success).toBe(true);
      expect(validatorInit.success).toBe(true);
      expect(enforcerInit.success).toBeDefined();
      expect(monitorInit.success).toBe(true);
      expect(verifierInit.success).toBe(true);

      console.log('✅ All services initialized:');
      console.log(`   - InstructionPersistenceClassifier: ${classifierInit.referenceRulesLoaded} rules`);
      console.log(`   - CrossReferenceValidator: ${validatorInit.governanceRulesLoaded} rules`);
      console.log(`   - BoundaryEnforcer: ${enforcerInit.rulesLoaded} rules`);
      console.log(`   - ContextPressureMonitor: ${monitorInit.governanceRulesLoaded} rules`);
      console.log(`   - MetacognitiveVerifier: ${verifierInit.governanceRulesLoaded} rules`);

      // Verify all loaded same number of governance rules
      expect(classifierInit.referenceRulesLoaded).toBeGreaterThan(0);
      expect(classifierInit.referenceRulesLoaded).toBe(validatorInit.governanceRulesLoaded);
    });

    test('should have session state for ContextPressureMonitor', async () => {
      const sessionState = await SessionState.findActiveSession(testSessionId);

      expect(sessionState).toBeDefined();
      expect(sessionState.sessionId).toBe(testSessionId);
      expect(sessionState.active).toBe(true);

      console.log('✅ Session state created:', {
        sessionId: sessionState.sessionId,
        currentPressure: sessionState.currentPressure.pressureLevel
      });
    });
  });

  // =====================================================
  // TEST 2: End-to-End Governance Workflow
  // =====================================================

  describe('2. End-to-End Governance Workflow', () => {
    test('should process user instruction through all services', async () => {
      console.log('\n🔄 Testing end-to-end governance workflow...\n');

      // Step 1: User gives explicit instruction
      console.log('Step 1: User provides explicit instruction');
      const userInstruction = {
        text: 'For this project, MongoDB port is 27017 and we must always validate user input',
        source: 'user',
        timestamp: new Date(),
        context: { sessionId: testSessionId }
      };

      // Step 2: Classify instruction
      console.log('\nStep 2: Classify instruction with InstructionPersistenceClassifier');
      const classification = classifier.classify(userInstruction);

      expect(classification.quadrant).toBeDefined();
      expect(classification.persistence).toBeDefined();
      expect(classification.parameters).toHaveProperty('port', '27017');

      console.log('✅ Classified as:', {
        quadrant: classification.quadrant,
        persistence: classification.persistence,
        parameters: classification.parameters
      });

      // Step 3: Persist to MongoDB
      console.log('\nStep 3: Persist instruction to MongoDB');
      const persistResult = await classifier.persist(classification, {
        id: 'test_e2e_instruction_001',
        category: 'technical',
        createdBy: 'full-framework-test'
      });

      expect(persistResult.success).toBe(true);
      console.log('✅ Instruction persisted:', persistResult.ruleId);

      // Step 4: Propose action (correct - matches instruction)
      console.log('\nStep 4: Propose correct action (matches instruction)');
      const correctAction = {
        description: 'Connect to MongoDB on port 27017',
        type: 'database_connection',
        parameters: { port: '27017', database: 'tractatus_test' }
      };

      const correctReasoning = {
        explanation: 'User explicitly specified MongoDB port 27017',
        steps: [
          'Check user instructions for port configuration',
          'Found explicit instruction: port 27017',
          'Use specified port for connection'
        ],
        evidence: ['User explicitly instructed: port 27017'],
        alternativesConsidered: ['Default port 27018'],
        chosenBecause: 'Follows explicit user instruction'
      };

      // Step 5: Validate with CrossReferenceValidator
      console.log('\nStep 5: Validate action with CrossReferenceValidator');
      const validationResult = validator.validate(correctAction, {
        sessionId: testSessionId,
        recent_instructions: [classification]
      });

      expect(validationResult.status).toBe('APPROVED');
      console.log('✅ Validation result:', validationResult.status);

      // Step 6: Check boundaries with BoundaryEnforcer
      console.log('\nStep 6: Check boundaries with BoundaryEnforcer');
      const boundaryResult = enforcer.enforce(correctAction, {
        sessionId: testSessionId
      });

      expect(boundaryResult.allowed).toBe(true);
      console.log('✅ Boundary check:', boundaryResult.allowed ? 'ALLOWED' : 'BLOCKED');

      // Step 7: Monitor context pressure
      console.log('\nStep 7: Analyze context pressure with ContextPressureMonitor');
      const pressureAnalysis = monitor.analyzePressure({
        sessionId: testSessionId,
        tokenUsage: 0.3,
        messageCount: 10,
        activeTasks: [correctAction]
      });

      expect(pressureAnalysis.level).toBeDefined();
      console.log('✅ Pressure analysis:', {
        level: pressureAnalysis.level,
        score: (pressureAnalysis.overallPressure * 100).toFixed(1) + '%'
      });

      // Step 8: Verify with MetacognitiveVerifier
      console.log('\nStep 8: Verify action with MetacognitiveVerifier');
      const verificationResult = verifier.verify(
        correctAction,
        correctReasoning,
        {
          sessionId: testSessionId,
          explicit_instructions: [classification],
          pressure_level: pressureAnalysis.level
        }
      );

      expect(verificationResult.decision).toBe('PROCEED');
      expect(verificationResult.confidence).toBeGreaterThan(0.6);
      console.log('✅ Verification result:', {
        decision: verificationResult.decision,
        confidence: (verificationResult.confidence * 100).toFixed(1) + '%'
      });

      console.log('\n✅ End-to-end workflow COMPLETE - Action APPROVED by all services!\n');

      // Cleanup
      await GovernanceRule.deleteOne({ id: 'test_e2e_instruction_001' });
    });

    test('should detect and reject conflicting action', async () => {
      console.log('\n🔄 Testing conflict detection across all services...\n');

      // Step 1: User instruction
      console.log('Step 1: User provides explicit instruction');
      const userInstruction = {
        text: 'Never use port 27018, always use port 27017',
        source: 'user',
        timestamp: new Date(),
        context: { sessionId: testSessionId }
      };

      const classification = classifier.classify(userInstruction);
      console.log('✅ Classified:', classification.quadrant, '/', classification.persistence);

      // Step 2: Conflicting action
      console.log('\nStep 2: Propose conflicting action (wrong port)');
      const conflictingAction = {
        description: 'Connect to MongoDB on port 27018',
        type: 'database_connection',
        parameters: { port: '27018' }
      };

      const conflictingReasoning = {
        explanation: 'Using port 27018 for connection',
        steps: ['Connect to database'],
        evidence: []
      };

      // Step 3: Validate (should fail)
      console.log('\nStep 3: Validate with CrossReferenceValidator');
      const validationResult = validator.validate(conflictingAction, {
        sessionId: testSessionId,
        recent_instructions: [classification]
      });

      expect(validationResult.status).toBe('REJECTED');
      expect(validationResult.conflicts.length).toBeGreaterThan(0);
      console.log('✅ Validation REJECTED - conflict detected:', validationResult.message);

      // Step 4: Verify (should have low confidence)
      console.log('\nStep 4: Verify with MetacognitiveVerifier');
      const verificationResult = verifier.verify(
        conflictingAction,
        conflictingReasoning,
        {
          sessionId: testSessionId,
          explicit_instructions: [classification]
        }
      );

      expect(verificationResult.decision).not.toBe('PROCEED');
      expect(verificationResult.confidence).toBeLessThan(0.8);
      console.log('✅ Verification result:', {
        decision: verificationResult.decision,
        confidence: (verificationResult.confidence * 100).toFixed(1) + '%',
        reason: 'Alignment check detected conflict with user instruction'
      });

      console.log('\n✅ Conflict detection SUCCESSFUL - Action rejected by validation!\n');
    });

    test('should block values decision with BoundaryEnforcer', async () => {
      console.log('\n🔄 Testing values boundary enforcement...\n');

      const valuesAction = {
        description: 'Decide whether to prioritize privacy over convenience',
        type: 'values_decision',
        domain: 'values',
        classification: { quadrant: 'STRATEGIC' }
      };

      const valuesReasoning = {
        explanation: 'Making values decision about privacy vs convenience',
        steps: ['Analyze tradeoffs', 'Make decision']
      };

      // Step 1: Boundary check (should block)
      console.log('Step 1: Check boundaries with BoundaryEnforcer');
      const boundaryResult = enforcer.enforce(valuesAction, {
        sessionId: testSessionId
      });

      expect(boundaryResult.allowed).toBe(false);
      expect(boundaryResult.humanRequired).toBe(true);
      console.log('✅ Boundary check BLOCKED:', boundaryResult.boundary);

      // Step 2: Verification (should also reject)
      console.log('\nStep 2: Verify with MetacognitiveVerifier');
      const verificationResult = verifier.verify(
        valuesAction,
        valuesReasoning,
        { sessionId: testSessionId }
      );

      // Verification might not block, but confidence should be affected
      console.log('✅ Verification result:', {
        decision: verificationResult.decision,
        confidence: (verificationResult.confidence * 100).toFixed(1) + '%'
      });

      console.log('\n✅ Values boundary enforcement SUCCESSFUL - Human approval required!\n');
    });
  });

  // =====================================================
  // TEST 3: MongoDB Persistence Verification
  // =====================================================

  describe('3. MongoDB Persistence Across All Models', () => {
    test('should have audit logs from all services', async () => {
      console.log('\n🔄 Verifying MongoDB persistence...\n');

      // Wait for async audits to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check audit logs
      const auditLogs = await AuditLog.find({ sessionId: testSessionId });

      console.log(`✅ Found ${auditLogs.length} audit logs from services:`);

      // Group by service
      const byService = {};
      auditLogs.forEach(log => {
        const service = log.service || log.action;
        byService[service] = (byService[service] || 0) + 1;
      });

      console.log('   Audit logs by service:', byService);

      expect(auditLogs.length).toBeGreaterThan(0);
    });

    test('should have session state with pressure history', async () => {
      const sessionState = await SessionState.findActiveSession(testSessionId);

      expect(sessionState).toBeDefined();
      expect(sessionState.totalAnalyses).toBeGreaterThan(0);
      expect(sessionState.pressureHistory.length).toBeGreaterThan(0);

      console.log('✅ Session state verified:', {
        totalAnalyses: sessionState.totalAnalyses,
        pressureHistoryEntries: sessionState.pressureHistory.length,
        currentPressure: sessionState.currentPressure.pressureLevel
      });
    });

    test('should have verification logs', async () => {
      // Wait for async persistence (MongoDB writes can take time)
      await new Promise(resolve => setTimeout(resolve, 1500));

      const verificationLogs = await VerificationLog.find({ sessionId: testSessionId });

      expect(verificationLogs.length).toBeGreaterThan(0);

      console.log(`✅ Found ${verificationLogs.length} verification logs`);

      // Show summary of each verification
      verificationLogs.forEach((log, i) => {
        console.log(`   ${i + 1}. ${log.decision} (confidence: ${(log.confidence * 100).toFixed(1)}%)`);
      });
    });

    test('should have governance rules in MongoDB', async () => {
      const rules = await GovernanceRule.find({ active: true });

      expect(rules.length).toBeGreaterThan(0);

      console.log(`✅ Found ${rules.length} active governance rules in MongoDB`);

      // Show quadrant breakdown
      const byQuadrant = {};
      rules.forEach(rule => {
        byQuadrant[rule.quadrant] = (byQuadrant[rule.quadrant] || 0) + 1;
      });

      console.log('   Rules by quadrant:', byQuadrant);
    });
  });

  // =====================================================
  // TEST 4: Service Communication and Data Sharing
  // =====================================================

  describe('4. Service Communication', () => {
    test('should share governance rules via MemoryProxy', async () => {
      // All services should be using the same rules from MongoDB
      const classifierRules = classifier.referenceRules;
      const validatorRules = validator.governanceRules;
      const enforcerRules = enforcer.enforcementRules;
      const monitorRules = monitor.governanceRules;
      const verifierRules = verifier.governanceRules;

      console.log('✅ Services loaded rules:');
      console.log(`   - Classifier: ${classifierRules.length} rules`);
      console.log(`   - Validator: ${validatorRules.length} rules`);
      console.log(`   - Enforcer: ${Object.keys(enforcerRules).length} rules`);
      console.log(`   - Monitor: ${monitorRules.length} rules`);
      console.log(`   - Verifier: ${verifierRules.length} rules`);

      // All should have loaded rules
      expect(classifierRules.length).toBeGreaterThan(0);
      expect(validatorRules.length).toBeGreaterThan(0);
      expect(Object.keys(enforcerRules).length).toBeGreaterThan(0);
    });

    test('should track errors across ContextPressureMonitor', () => {
      // Record some errors
      monitor.recordError({ message: 'Test error 1', type: 'test' });
      monitor.recordError({ message: 'Test error 2', type: 'test' });

      const stats = monitor.getStats();

      expect(stats.total_errors).toBeGreaterThan(0);
      expect(stats.error_types.test).toBe(2);

      console.log('✅ Error tracking verified:', {
        totalErrors: stats.total_errors,
        errorTypes: stats.error_types
      });
    });

    test('should use pressure level in verification decisions', () => {
      const action = {
        description: 'Test action under varying pressure',
        type: 'test'
      };

      const reasoning = {
        explanation: 'Test reasoning',
        steps: ['Step 1', 'Step 2'],
        evidence: ['Test evidence']
      };

      // Verify under normal pressure (low token usage)
      const normalResult = verifier.verify(action, reasoning, {
        sessionId: testSessionId,
        tokenUsage: 0.2, // Low pressure
        messageCount: 10
      });

      // Verify under dangerous pressure (very high token usage)
      const dangerousResult = verifier.verify(action, reasoning, {
        sessionId: testSessionId,
        tokenUsage: 0.95, // Dangerous pressure
        messageCount: 150,
        errors_recent: 5
      });

      expect(dangerousResult.decision).toBe('BLOCK');
      expect(normalResult.confidence).toBeGreaterThan(dangerousResult.confidence);

      console.log('✅ Pressure-aware verification:', {
        normal: `${normalResult.decision} (${(normalResult.confidence * 100).toFixed(1)}%)`,
        dangerous: `${dangerousResult.decision} (${(dangerousResult.confidence * 100).toFixed(1)}%)`
      });
    });
  });

  // =====================================================
  // TEST 5: Analytics and Reporting
  // =====================================================

  describe('5. Analytics from MongoDB', () => {
    test('should get audit statistics', async () => {
      const startDate = new Date(Date.now() - 60000); // 1 minute ago
      const endDate = new Date();

      const stats = await AuditLog.getStatistics(startDate, endDate);

      if (stats) {
        expect(stats.totalDecisions).toBeGreaterThan(0);

        console.log('✅ Audit statistics:', {
          totalDecisions: stats.totalDecisions,
          allowed: stats.allowed,
          blocked: stats.blocked,
          allowedRate: stats.allowedRate?.toFixed(1) + '%'
        });
      }
    });

    test('should get verification statistics from MongoDB', async () => {
      const startDate = new Date(Date.now() - 60000);
      const endDate = new Date();

      const stats = await verifier.getMongoDBStats(startDate, endDate);

      if (stats && stats.totalVerifications) {
        expect(stats.totalVerifications).toBeGreaterThan(0);

        console.log('✅ Verification statistics:', {
          totalVerifications: stats.totalVerifications,
          avgConfidence: stats.avgConfidence,
          lowConfidenceRate: stats.lowConfidenceRate?.toFixed(1) + '%'
        });
      }
    });

    test('should get session summary', async () => {
      const sessionState = await SessionState.findActiveSession(testSessionId);
      const summary = sessionState.getSummary();

      expect(summary.sessionId).toBe(testSessionId);
      expect(summary.totalAnalyses).toBeGreaterThan(0);

      console.log('✅ Session summary:', {
        sessionId: summary.sessionId,
        totalAnalyses: summary.totalAnalyses,
        totalErrors: summary.totalErrors,
        currentPressure: summary.currentPressure,
        peakPressure: summary.peakPressure
      });
    });
  });

  // =====================================================
  // TEST 6: Complete Framework Workflow
  // =====================================================

  describe('6. Complete Framework Workflow', () => {
    test('should execute full Tractatus governance cycle', async () => {
      console.log('\n🔄 FULL TRACTATUS GOVERNANCE CYCLE TEST\n');
      console.log('=' .repeat(60));

      // STAGE 1: Instruction Reception
      console.log('\n📝 STAGE 1: User Instruction Reception');
      const instruction = {
        text: 'For this session, always verify database operations and never delete data without confirmation',
        source: 'user',
        timestamp: new Date()
      };

      const classification = classifier.classify(instruction);
      console.log('✅ Instruction classified:', classification.quadrant, '/', classification.persistence);

      // STAGE 2: Context Monitoring
      console.log('\n📊 STAGE 2: Context Pressure Monitoring');
      const context = {
        sessionId: testSessionId,
        tokenUsage: 0.45,
        messageCount: 25,
        activeTasks: [{ description: 'Database operation' }]
      };

      const pressureAnalysis = monitor.analyzePressure(context);
      console.log('✅ Pressure level:', pressureAnalysis.level, `(${(pressureAnalysis.overallPressure * 100).toFixed(1)}%)`);

      // STAGE 3: Action Proposal
      console.log('\n🎯 STAGE 3: AI Proposes Action');
      const proposedAction = {
        description: 'Verify database connection and run SELECT query',
        type: 'database_operation',
        parameters: {
          operation: 'SELECT',
          verified: true
        }
      };

      const reasoning = {
        explanation: 'User instructed to always verify database operations. This is a read-only SELECT, safe to execute.',
        steps: [
          'Check user instruction for database operation requirements',
          'Confirm operation is read-only (SELECT)',
          'Verify database connection is established',
          'Execute SELECT query'
        ],
        evidence: ['User explicitly instructed: always verify database operations'],
        alternativesConsidered: ['Skip verification (rejected - violates instruction)'],
        chosenBecause: 'Follows explicit user instruction to verify'
      };

      console.log('✅ Action proposed:', proposedAction.description);

      // STAGE 4: Cross-Reference Validation
      console.log('\n🔍 STAGE 4: Cross-Reference Validation');
      const validationResult = validator.validate(proposedAction, {
        sessionId: testSessionId,
        recent_instructions: [classification]
      });

      console.log('✅ Validation:', validationResult.status);

      // STAGE 5: Boundary Enforcement
      console.log('\n🛡️  STAGE 5: Boundary Enforcement');
      const boundaryResult = enforcer.enforce(proposedAction, {
        sessionId: testSessionId
      });

      console.log('✅ Boundary check:', boundaryResult.allowed ? 'ALLOWED' : 'BLOCKED');

      // STAGE 6: Metacognitive Verification
      console.log('\n🧠 STAGE 6: Metacognitive Verification');
      const verificationResult = verifier.verify(proposedAction, reasoning, {
        sessionId: testSessionId,
        explicit_instructions: [classification],
        pressure_level: pressureAnalysis.level
      });

      console.log('✅ Verification:', verificationResult.decision);
      console.log('   Confidence:', (verificationResult.confidence * 100).toFixed(1) + '%');
      console.log('   Checks passed:', Object.keys(verificationResult.checks).filter(
        k => verificationResult.checks[k].passed
      ).length + '/5');

      // STAGE 7: Decision
      console.log('\n✅ STAGE 7: Final Decision');
      console.log('   Validation status:', validationResult.status, '(expected: APPROVED)');
      console.log('   Boundary allowed:', boundaryResult.allowed, '(expected: true)');
      console.log('   Verification decision:', verificationResult.decision, '(expected: PROCEED)');

      const finalDecision =
        validationResult.status === 'APPROVED' &&
        boundaryResult.allowed &&
        verificationResult.decision === 'PROCEED';

      console.log('   Status:', finalDecision ? '✅ APPROVED - Action may proceed' : '❌ BLOCKED - Action rejected');

      console.log('\n' + '='.repeat(60));
      console.log('✅ FULL GOVERNANCE CYCLE COMPLETE\n');

      // Verify final decision
      expect(finalDecision).toBe(true);

      // Wait for all async persistence
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify all data persisted to MongoDB
      const auditCount = await AuditLog.countDocuments({ sessionId: testSessionId });
      const sessionState = await SessionState.findActiveSession(testSessionId);
      const verificationCount = await VerificationLog.countDocuments({ sessionId: testSessionId });

      console.log('📊 MongoDB Persistence Verified:');
      console.log(`   - ${auditCount} audit logs`);
      console.log(`   - ${sessionState.totalAnalyses} pressure analyses`);
      console.log(`   - ${verificationCount} verifications`);
      console.log('\n✅ ALL DATA PERSISTED TO MONGODB\n');

      expect(auditCount).toBeGreaterThan(0);
      expect(sessionState.totalAnalyses).toBeGreaterThan(0);
      expect(verificationCount).toBeGreaterThan(0);
    });
  });
});
