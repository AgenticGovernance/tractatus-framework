/**
 * InstructionPersistenceClassifier MongoDB Integration Test
 *
 * Verifies:
 * 1. Classification works with MongoDB backend
 * 2. persist() method saves classifications to GovernanceRule collection
 * 3. Audit trail writes to AuditLog collection
 */

require('dotenv').config();

const mongoose = require('mongoose');
const GovernanceRule = require('../../src/models/GovernanceRule.model');
const AuditLog = require('../../src/models/AuditLog.model');
const classifier = require('../../src/services/InstructionPersistenceClassifier.service');

describe('InstructionPersistenceClassifier MongoDB Integration', () => {
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
    // Initialize classifier
    await classifier.initialize();
  });

  describe('Classification with MongoDB Backend', () => {
    test('should initialize with MemoryProxy and load reference rules', async () => {
      const result = await classifier.initialize();

      expect(result.success).toBe(true);
      expect(result.referenceRulesLoaded).toBeGreaterThan(0);

      console.log(`✅ Loaded ${result.referenceRulesLoaded} reference rules from MongoDB`);
    });

    test('should classify instruction', () => {
      const classification = classifier.classify({
        text: 'Always prioritize user privacy over convenience',
        source: 'user',
        timestamp: new Date()
      });

      expect(classification.text).toBeDefined();
      expect(classification.quadrant).toBe('STRATEGIC');
      expect(classification.persistence).toBe('HIGH');
      expect(classification.verification).toBe('MANDATORY');

      console.log('✅ Classification:', {
        quadrant: classification.quadrant,
        persistence: classification.persistence,
        verification: classification.verification
      });
    });
  });

  describe('persist() Method', () => {
    test('should persist classification to MongoDB', async () => {
      // Classify instruction
      const classification = classifier.classify({
        text: 'For this project, always validate user input with Joi schema',
        source: 'user',
        timestamp: new Date()
      });

      // Persist to MongoDB
      const result = await classifier.persist(classification, {
        id: 'test_persist_001',
        category: 'security',
        createdBy: 'test-suite',
        notes: 'Test persistence'
      });

      expect(result.success).toBe(true);
      expect(result.ruleId).toBe('test_persist_001');
      expect(result.rule).toBeDefined();

      console.log('✅ Persisted rule to MongoDB:', result.ruleId);

      // Verify it was saved
      const savedRule = await GovernanceRule.findOne({ id: 'test_persist_001' });
      expect(savedRule).toBeDefined();
      expect(savedRule.text).toBe(classification.text);
      expect(savedRule.quadrant).toBe('OPERATIONAL');
      expect(savedRule.persistence).toBe('HIGH');
      expect(savedRule.category).toBe('security');

      console.log('✅ Verified rule in MongoDB:', {
        id: savedRule.id,
        quadrant: savedRule.quadrant,
        persistence: savedRule.persistence
      });

      // Cleanup
      await GovernanceRule.deleteOne({ id: 'test_persist_001' });
    });

    test('should prevent duplicate rules', async () => {
      // Create initial classification
      const classification = classifier.classify({
        text: 'Never expose API keys in client-side code',
        source: 'user'
      });

      // First persist - should succeed
      const result1 = await classifier.persist(classification, {
        id: 'test_duplicate_001',
        category: 'security'
      });

      expect(result1.success).toBe(true);

      // Second persist with same ID - should fail
      const result2 = await classifier.persist(classification, {
        id: 'test_duplicate_001',
        category: 'security'
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Rule already exists');
      expect(result2.existed).toBe(true);

      console.log('✅ Duplicate rule correctly rejected');

      // Cleanup
      await GovernanceRule.deleteOne({ id: 'test_duplicate_001' });
    });

    test('should auto-generate ID if not provided', async () => {
      const classification = classifier.classify({
        text: 'Prefer async/await over callbacks',
        source: 'user'
      });

      const result = await classifier.persist(classification, {
        category: 'technical'
      });

      expect(result.success).toBe(true);
      expect(result.ruleId).toMatch(/^inst_\d+$/); // Auto-generated ID

      console.log('✅ Auto-generated ID:', result.ruleId);

      // Cleanup
      await GovernanceRule.deleteOne({ id: result.ruleId });
    });

    test('should map classification fields to GovernanceRule schema', async () => {
      const classification = classifier.classify({
        text: 'MongoDB port is 27017',
        source: 'user',
        timestamp: new Date()
      });

      const result = await classifier.persist(classification, {
        id: 'test_field_mapping_001',
        category: 'technical',
        notes: 'Verified field mapping'
      });

      expect(result.success).toBe(true);

      const savedRule = await GovernanceRule.findOne({ id: 'test_field_mapping_001' });

      // Verify field mapping
      expect(savedRule.quadrant).toBe(classification.quadrant);
      expect(savedRule.persistence).toBe(classification.persistence);
      expect(savedRule.priority).toBe(Math.round(classification.persistenceScore * 100));
      expect(savedRule.temporalScope).toBe(classification.metadata.temporalScope.toUpperCase());
      expect(savedRule.source).toBe('user_instruction');
      expect(savedRule.active).toBe(true);

      console.log('✅ Field mapping verified:', {
        quadrant: savedRule.quadrant,
        persistence: savedRule.persistence,
        priority: savedRule.priority,
        temporalScope: savedRule.temporalScope
      });

      // Cleanup
      await GovernanceRule.deleteOne({ id: 'test_field_mapping_001' });
    });
  });

  describe('Audit Trail Integration', () => {
    test('should write classification audit to MongoDB', async () => {
      // Wait a bit for async audit from previous test
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clear previous audit logs
      await AuditLog.deleteMany({ action: 'instruction_classification' });

      // Classify (triggers audit)
      const classification = classifier.classify({
        text: 'Test audit trail integration',
        source: 'user',
        context: { sessionId: 'classifier-audit-test' }
      });

      // Wait for async audit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify audit log
      const auditLogs = await AuditLog.find({
        sessionId: 'classifier-audit-test',
        action: 'instruction_classification'
      });

      expect(auditLogs.length).toBeGreaterThan(0);

      const auditLog = auditLogs[0];
      expect(auditLog.allowed).toBe(true); // Classification always allowed
      expect(auditLog.metadata.quadrant).toBe(classification.quadrant);
      expect(auditLog.metadata.persistence).toBe(classification.persistence);

      console.log('✅ Audit trail verified:', {
        sessionId: auditLog.sessionId,
        quadrant: auditLog.metadata.quadrant,
        persistence: auditLog.metadata.persistence
      });

      // Cleanup
      await AuditLog.deleteMany({ sessionId: 'classifier-audit-test' });
    });
  });

  describe('End-to-End: Classify + Persist + Verify', () => {
    test('should complete full classification workflow', async () => {
      console.log('\n🔄 Starting end-to-end classifier workflow...\n');

      // Step 1: Initialize
      console.log('Step 1: Initialize classifier with MongoDB');
      const initResult = await classifier.initialize();
      expect(initResult.success).toBe(true);
      console.log(`✅ Initialized with ${initResult.referenceRulesLoaded} reference rules`);

      // Step 2: Classify
      console.log('\nStep 2: Classify instruction');
      const classification = classifier.classify({
        text: 'For this project, use JWT tokens with 15-minute expiry',
        source: 'user',
        context: { sessionId: 'e2e-classifier-test' }
      });

      expect(classification.quadrant).toBe('OPERATIONAL');
      expect(classification.persistence).toBe('HIGH');
      console.log(`✅ Classified as ${classification.quadrant} / ${classification.persistence}`);

      // Step 3: Persist
      console.log('\nStep 3: Persist to MongoDB');
      const persistResult = await classifier.persist(classification, {
        id: 'test_e2e_001',
        category: 'security',
        createdBy: 'e2e-test',
        notes: 'End-to-end test'
      });

      expect(persistResult.success).toBe(true);
      console.log(`✅ Persisted as rule: ${persistResult.ruleId}`);

      // Step 4: Verify persistence
      console.log('\nStep 4: Verify rule in MongoDB');
      const savedRule = await GovernanceRule.findOne({ id: 'test_e2e_001' });
      expect(savedRule).toBeDefined();
      expect(savedRule.text).toBe(classification.text);
      console.log('✅ Rule verified in MongoDB');

      // Step 5: Verify audit trail
      console.log('\nStep 5: Verify audit trail');
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for async audit
      const auditLogs = await AuditLog.find({
        sessionId: 'e2e-classifier-test',
        action: 'instruction_classification'
      });
      expect(auditLogs.length).toBeGreaterThan(0);
      console.log(`✅ ${auditLogs.length} audit entries created`);

      console.log('\n✅ End-to-end workflow COMPLETE!\n');

      // Cleanup
      await GovernanceRule.deleteOne({ id: 'test_e2e_001' });
      await AuditLog.deleteMany({ sessionId: 'e2e-classifier-test' });
    });
  });
});
