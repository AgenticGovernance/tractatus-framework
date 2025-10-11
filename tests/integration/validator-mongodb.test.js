/**
 * CrossReferenceValidator MongoDB Integration Test
 *
 * Verifies:
 * 1. Validator works with MongoDB backend
 * 2. Loads governance rules from MongoDB
 * 3. Validates actions against MongoDB rules
 * 4. Writes audit trail to MongoDB
 */

require('dotenv').config();

const mongoose = require('mongoose');
const GovernanceRule = require('../../src/models/GovernanceRule.model');
const AuditLog = require('../../src/models/AuditLog.model');
const validator = require('../../src/services/CrossReferenceValidator.service');
const classifier = require('../../src/services/InstructionPersistenceClassifier.service');

describe('CrossReferenceValidator MongoDB Integration', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_test';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB:', mongoose.connection.db.databaseName);
  });

  afterAll(async () => {
    await mongoose.connection.close();
    console.log('✅ Disconnected from MongoDB');
  });

  beforeEach(async () => {
    // Initialize services
    await validator.initialize();
    await classifier.initialize();
  });

  describe('Initialization', () => {
    test('should initialize with MemoryProxy and load governance rules', async () => {
      const result = await validator.initialize();

      expect(result.success).toBe(true);
      expect(result.governanceRulesLoaded).toBeGreaterThan(0);

      console.log(`✅ Loaded ${result.governanceRulesLoaded} governance rules from MongoDB`);
    });
  });

  describe('Validation with MongoDB Rules', () => {
    test('should approve action with no conflicts', () => {
      const action = {
        description: 'Connect to MongoDB on port 27017',
        parameters: { port: '27017', database: 'tractatus_test' }
      };

      const context = {
        recent_instructions: []
      };

      const result = validator.validate(action, context);

      expect(result.status).toBe('APPROVED');
      expect(result.conflicts).toHaveLength(0);

      console.log('✅ Action approved:', result.message);
    });

    test('should detect critical conflict with explicit instruction', () => {
      // Create explicit instruction
      const instruction = classifier.classify({
        text: 'Always use port 27027 for this session',
        source: 'user',
        timestamp: new Date()
      });

      // Action with conflicting port
      const action = {
        description: 'Connect to MongoDB on port 27017',
        parameters: { port: '27017' }
      };

      const context = {
        recent_instructions: [instruction]
      };

      const result = validator.validate(action, context);

      expect(result.status).toBe('REJECTED');
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].severity).toBe('CRITICAL');
      expect(result.conflicts[0].parameter).toBe('port');

      console.log('✅ Critical conflict detected:', result.message);
    });

    test('should approve action that matches instruction', () => {
      // Create instruction
      const instruction = classifier.classify({
        text: 'Use database tractatus_test for testing',
        source: 'user',
        timestamp: new Date()
      });

      // Action that matches instruction
      const action = {
        description: 'Connect to database tractatus_test',
        parameters: { database: 'tractatus_test' }
      };

      const context = {
        recent_instructions: [instruction]
      };

      const result = validator.validate(action, context);

      expect(result.status).toBe('APPROVED');

      console.log('✅ Action approved (matches instruction):', result.message);
    });

    test('should detect semantic conflict with prohibition', () => {
      // Create HIGH persistence prohibition
      const instruction = classifier.classify({
        text: 'Never use port 27017, always use 27027',
        source: 'user',
        timestamp: new Date()
      });

      // Action that violates prohibition
      const action = {
        description: 'mongosh --port 27017',
        parameters: { port: '27017' }
      };

      const context = {
        recent_instructions: [instruction]
      };

      const result = validator.validate(action, context);

      expect(result.status).toBe('REJECTED');
      expect(result.conflicts.length).toBeGreaterThan(0);

      const hasProhibitionConflict = result.conflicts.some(c => c.type === 'prohibition');
      expect(hasProhibitionConflict).toBe(true);

      console.log('✅ Semantic prohibition conflict detected:', result.conflicts[0]);
    });
  });

  describe('Instruction History', () => {
    test('should cache and retrieve instructions', () => {
      validator.clearInstructions();

      const instruction1 = classifier.classify({
        text: 'Use database production',
        source: 'user',
        timestamp: new Date()
      });

      const instruction2 = classifier.classify({
        text: 'Connect to port 27017',
        source: 'user',
        timestamp: new Date()
      });

      validator.addInstruction(instruction1);
      validator.addInstruction(instruction2);

      const history = validator.getRecentInstructions();

      expect(history.length).toBe(2);
      expect(history[0].text).toBe(instruction2.text); // Most recent first

      console.log('✅ Instruction history working:', {
        count: history.length,
        mostRecent: history[0].text.substring(0, 30)
      });
    });

    test('should limit history to lookback window', () => {
      validator.clearInstructions();

      // Add more than lookbackWindow (100) instructions
      for (let i = 0; i < 150; i++) {
        const instruction = classifier.classify({
          text: `Instruction ${i}`,
          source: 'user',
          timestamp: new Date()
        });
        validator.addInstruction(instruction);
      }

      const history = validator.getRecentInstructions();

      expect(history.length).toBeLessThanOrEqual(validator.lookbackWindow);

      console.log('✅ History limited to lookback window:', {
        lookbackWindow: validator.lookbackWindow,
        actualCount: history.length
      });
    });
  });

  describe('Audit Trail Integration', () => {
    test('should write validation audit to MongoDB', async () => {
      // Clear previous audit logs
      await AuditLog.deleteMany({ action: 'cross_reference_validation' });

      // Create instruction
      const instruction = classifier.classify({
        text: 'Use port 9000',
        source: 'user',
        timestamp: new Date()
      });

      // Action with conflict
      const action = {
        description: 'Start server on port 3000',
        parameters: { port: '3000' }
      };

      const context = {
        sessionId: 'validator-audit-test',
        recent_instructions: [instruction]
      };

      const result = validator.validate(action, context);

      expect(result.status).toBe('REJECTED');

      // Wait for async audit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify audit log
      const auditLogs = await AuditLog.find({
        sessionId: 'validator-audit-test',
        action: 'cross_reference_validation'
      });

      expect(auditLogs.length).toBeGreaterThan(0);

      const auditLog = auditLogs[0];
      expect(auditLog.allowed).toBe(false); // Rejected
      expect(auditLog.metadata.validation_status).toBe('REJECTED');
      expect(auditLog.metadata.conflicts_found).toBeGreaterThan(0);

      console.log('✅ Validation audit trail verified:', {
        sessionId: auditLog.sessionId,
        status: auditLog.metadata.validation_status,
        conflicts: auditLog.metadata.conflicts_found
      });

      // Cleanup
      await AuditLog.deleteMany({ sessionId: 'validator-audit-test' });
    });
  });

  describe('Statistics', () => {
    test('should track validation statistics', () => {
      validator.clearInstructions();

      // Perform some validations
      const approvedAction = {
        description: 'Harmless action',
        parameters: {}
      };

      validator.validate(approvedAction, { recent_instructions: [] });

      const instruction = classifier.classify({
        text: 'Use database prod',
        source: 'user'
      });

      const rejectedAction = {
        description: 'Use database dev',
        parameters: { database: 'dev' }
      };

      validator.validate(rejectedAction, { recent_instructions: [instruction] });

      const stats = validator.getStats();

      expect(stats.total_validations).toBeGreaterThan(0);
      expect(stats.approvals).toBeGreaterThan(0);
      expect(stats.rejections).toBeGreaterThan(0);

      console.log('✅ Validation statistics:', {
        total: stats.total_validations,
        approvals: stats.approvals,
        rejections: stats.rejections,
        warnings: stats.warnings
      });
    });
  });

  describe('End-to-End: Validate with MongoDB Rules', () => {
    test('should complete full validation workflow', async () => {
      console.log('\n🔄 Starting end-to-end validator workflow...\n');

      // Step 1: Initialize
      console.log('Step 1: Initialize validator with MongoDB');
      const initResult = await validator.initialize();
      expect(initResult.success).toBe(true);
      console.log(`✅ Initialized with ${initResult.governanceRulesLoaded} rules`);

      // Step 2: Create instruction
      console.log('\nStep 2: Create user instruction');
      const instruction = classifier.classify({
        text: 'For this project, MongoDB port is 27017',
        source: 'user',
        context: { sessionId: 'e2e-validator-test' }
      });
      console.log(`✅ Instruction classified as ${instruction.quadrant} / ${instruction.persistence}`);

      // Step 3: Validate matching action (should pass)
      console.log('\nStep 3: Validate matching action');
      const matchingAction = {
        description: 'Connect to MongoDB on port 27017',
        parameters: { port: '27017' }
      };

      const matchingResult = validator.validate(matchingAction, {
        sessionId: 'e2e-validator-test',
        recent_instructions: [instruction]
      });

      expect(matchingResult.status).toBe('APPROVED');
      console.log('✅ Matching action APPROVED');

      // Step 4: Validate conflicting action (should reject)
      console.log('\nStep 4: Validate conflicting action');
      const conflictingAction = {
        description: 'Connect to MongoDB on port 27018',
        parameters: { port: '27018' }
      };

      const conflictingResult = validator.validate(conflictingAction, {
        sessionId: 'e2e-validator-test',
        recent_instructions: [instruction]
      });

      expect(conflictingResult.status).toBe('REJECTED');
      console.log('✅ Conflicting action REJECTED');

      // Step 5: Verify audit trail
      console.log('\nStep 5: Verify audit trail in MongoDB');
      await new Promise(resolve => setTimeout(resolve, 500));

      const auditLogs = await AuditLog.find({
        sessionId: 'e2e-validator-test',
        action: 'cross_reference_validation'
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      console.log(`✅ ${auditLogs.length} validation audit entries created`);

      console.log('\n✅ End-to-end validation workflow COMPLETE!\n');

      // Cleanup
      await AuditLog.deleteMany({ sessionId: 'e2e-validator-test' });
    });
  });
});
