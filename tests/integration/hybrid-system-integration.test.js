/**
 * Hybrid System Integration Test
 *
 * Verifies complete integration of:
 * - MongoDB storage layer (GovernanceRule, AuditLog models)
 * - Anthropic Memory Tool API (context optimization)
 * - MemoryProxy v3 (hybrid architecture)
 * - BoundaryEnforcer (enforcement with hybrid backend)
 *
 * Success Criteria:
 * 1. ✅ MongoDB models work (CRUD operations)
 * 2. ✅ MemoryProxy loads rules from MongoDB
 * 3. ✅ BoundaryEnforcer enforces rules from MongoDB
 * 4. ✅ Audit trail writes to MongoDB
 * 5. ✅ Anthropic API integration functional (if API key present)
 * 6. ✅ Full end-to-end workflow
 */

require('dotenv').config();

const mongoose = require('mongoose');
const GovernanceRule = require('../../src/models/GovernanceRule.model');
const AuditLog = require('../../src/models/AuditLog.model');
const { MemoryProxyService } = require('../../src/services/MemoryProxy.service');
const BoundaryEnforcer = require('../../src/services/BoundaryEnforcer.service');

describe('Hybrid System Integration Test', () => {
  let memoryProxy;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB:', mongoose.connection.db.databaseName);

    // Debug: Check rule count immediately after connection
    const immediateCount = await GovernanceRule.countDocuments();
    console.log('🔍 Immediate rule count after connection:', immediateCount);
  });

  afterAll(async () => {
    await mongoose.connection.close();
    console.log('✅ Disconnected from MongoDB');
  });

  beforeEach(() => {
    memoryProxy = new MemoryProxyService();
  });

  // =====================================================
  // TEST 1: MongoDB Models Work
  // =====================================================

  describe('1. MongoDB Models', () => {
    test('should create GovernanceRule in MongoDB', async () => {
      const rule = await GovernanceRule.create({
        id: 'test_rule_001',
        text: 'Never fabricate statistics without verifiable sources',
        quadrant: 'OPERATIONAL',
        persistence: 'HIGH',
        category: 'content',
        priority: 90,
        active: true,
        source: 'test'
      });

      expect(rule._id).toBeDefined();
      expect(rule.id).toBe('test_rule_001');
      expect(rule.quadrant).toBe('OPERATIONAL');

      console.log('✅ Created GovernanceRule in MongoDB:', rule.id);

      // Cleanup
      await GovernanceRule.deleteOne({ id: 'test_rule_001' });
    });

    test('should create AuditLog in MongoDB', async () => {
      const log = await AuditLog.create({
        sessionId: 'test-session-001',
        action: 'boundary_enforcement',
        allowed: true,
        rulesChecked: ['inst_016', 'inst_017'],
        violations: [],
        domain: 'OPERATIONAL',
        service: 'BoundaryEnforcer'
      });

      expect(log._id).toBeDefined();
      expect(log.sessionId).toBe('test-session-001');
      expect(log.allowed).toBe(true);

      console.log('✅ Created AuditLog in MongoDB:', log._id);

      // Cleanup
      await AuditLog.deleteOne({ _id: log._id });
    });

    test('should query GovernanceRule by quadrant', async () => {
      // Create test rules
      await GovernanceRule.create({
        id: 'test_ops_001',
        text: 'Test operational rule',
        quadrant: 'OPERATIONAL',
        persistence: 'HIGH',
        active: true,
        source: 'test'
      });

      await GovernanceRule.create({
        id: 'test_str_001',
        text: 'Test strategic rule',
        quadrant: 'STRATEGIC',
        persistence: 'HIGH',
        active: true,
        source: 'test'
      });

      // Query by quadrant
      const opsRules = await GovernanceRule.findByQuadrant('OPERATIONAL');
      const strRules = await GovernanceRule.findByQuadrant('STRATEGIC');

      expect(opsRules.length).toBeGreaterThan(0);
      expect(strRules.length).toBeGreaterThan(0);

      console.log(`✅ Queried rules: ${opsRules.length} OPERATIONAL, ${strRules.length} STRATEGIC`);

      // Cleanup
      await GovernanceRule.deleteMany({ id: { $in: ['test_ops_001', 'test_str_001'] } });
    });
  });

  // =====================================================
  // TEST 2: MemoryProxy v3 Works with MongoDB
  // =====================================================

  describe('2. MemoryProxy v3 (MongoDB Backend)', () => {
    test('should initialize MemoryProxy', async () => {
      const result = await memoryProxy.initialize();

      expect(result).toBe(true);

      console.log('✅ MemoryProxy initialized');
    });

    test('should load governance rules from MongoDB', async () => {
      await memoryProxy.initialize();

      // Debug: Check direct query first
      const directCount = await GovernanceRule.countDocuments({ active: true });
      console.log(`🔍 Direct query count: ${directCount}`);

      const rules = await memoryProxy.loadGovernanceRules();

      console.log(`🔍 MemoryProxy returned: ${rules.length} rules`);

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);

      console.log(`✅ Loaded ${rules.length} governance rules from MongoDB`);
    });

    test('should get specific rule by ID', async () => {
      await memoryProxy.initialize();

      const rule = await memoryProxy.getRule('inst_016');

      if (rule) {
        expect(rule.id).toBe('inst_016');
        expect(rule.text).toBeDefined();
        console.log('✅ Retrieved inst_016:', rule.text.substring(0, 50) + '...');
      } else {
        console.warn('⚠️ inst_016 not found in database (may need migration)');
      }
    });

    test('should audit decision to MongoDB', async () => {
      await memoryProxy.initialize();

      const result = await memoryProxy.auditDecision({
        sessionId: 'integration-test-session',
        action: 'test_enforcement',
        allowed: true,
        rulesChecked: ['inst_016', 'inst_017'],
        violations: [],
        metadata: {
          test: true,
          framework: 'Tractatus'
        }
      });

      expect(result.success).toBe(true);
      expect(result.auditId).toBeDefined();

      console.log('✅ Audit decision written to MongoDB:', result.auditId);

      // Verify it was written
      const log = await AuditLog.findById(result.auditId);
      expect(log).toBeDefined();
      expect(log.sessionId).toBe('integration-test-session');

      // Cleanup
      await AuditLog.deleteOne({ _id: result.auditId });
    });

    test('should get audit statistics', async () => {
      await memoryProxy.initialize();

      // Create some test audit logs
      await AuditLog.create({
        sessionId: 'stats-test-001',
        action: 'test_action',
        allowed: true,
        rulesChecked: [],
        violations: []
      });

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();

      const stats = await memoryProxy.getAuditStatistics(startDate, endDate);

      if (stats) {
        expect(stats.totalDecisions).toBeGreaterThan(0);
        console.log('✅ Audit statistics:', {
          totalDecisions: stats.totalDecisions,
          allowed: stats.allowed,
          allowedRate: stats.allowedRate?.toFixed(1) + '%'
        });
      }

      // Cleanup
      await AuditLog.deleteOne({ sessionId: 'stats-test-001' });
    });
  });

  // =====================================================
  // TEST 3: BoundaryEnforcer Works with Hybrid System
  // =====================================================

  describe('3. BoundaryEnforcer Integration', () => {
    test('should initialize BoundaryEnforcer with MongoDB backend', async () => {
      const result = await BoundaryEnforcer.initialize();

      expect(result.success).toBeDefined();

      console.log('✅ BoundaryEnforcer initialized:', {
        success: result.success,
        rulesLoaded: result.rulesLoaded,
        rules: result.enforcementRules
      });
    });

    test('should enforce boundaries using MongoDB rules', async () => {
      await BoundaryEnforcer.initialize();

      // Test action that should be ALLOWED (operational)
      const allowedAction = {
        description: 'Generate AI-drafted blog content for human review',
        text: 'Blog post will be queued for mandatory human approval',
        classification: { quadrant: 'OPERATIONAL' },
        type: 'content_generation'
      };

      const allowedResult = BoundaryEnforcer.enforce(allowedAction, {
        sessionId: 'boundary-test-allowed'
      });

      expect(allowedResult.allowed).toBe(true);
      console.log('✅ ALLOWED action enforced correctly');

      // Test action that should be BLOCKED (values decision)
      const blockedAction = {
        description: 'Decide our core company values',
        text: 'We should prioritize privacy over profit',
        classification: { quadrant: 'STRATEGIC' },
        type: 'values_decision',
        domain: 'values'
      };

      const blockedResult = BoundaryEnforcer.enforce(blockedAction, {
        sessionId: 'boundary-test-blocked'
      });

      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.humanRequired).toBe(true);
      console.log('✅ BLOCKED action enforced correctly:', blockedResult.boundary);
    });

    test('should write audit trail to MongoDB', async () => {
      await BoundaryEnforcer.initialize();

      const action = {
        description: 'Test action for audit trail verification',
        classification: { quadrant: 'OPERATIONAL' },
        type: 'test'
      };

      const result = BoundaryEnforcer.enforce(action, {
        sessionId: 'audit-trail-test'
      });

      expect(result).toBeDefined();

      // Wait for async audit to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify audit log was created
      const auditLogs = await AuditLog.find({ sessionId: 'audit-trail-test' });

      expect(auditLogs.length).toBeGreaterThan(0);
      console.log(`✅ Audit trail verified: ${auditLogs.length} logs written to MongoDB`);

      // Cleanup
      await AuditLog.deleteMany({ sessionId: 'audit-trail-test' });
    });
  });

  // =====================================================
  // TEST 4: Anthropic API Integration (Optional)
  // =====================================================

  describe('4. Anthropic Memory Tool API', () => {
    test('should initialize Anthropic client if API key present', async () => {
      await memoryProxy.initialize();

      if (memoryProxy.anthropicEnabled) {
        expect(memoryProxy.anthropicClient).toBeDefined();
        console.log('✅ Anthropic Memory Client initialized (CORE COMPONENT)');

        const stats = memoryProxy.anthropicClient.getMemoryStats();
        console.log('   Anthropic API stats:', stats);
      } else {
        console.log('⚠️ Anthropic API not enabled (API key missing or disabled)');
        console.log('   This is ACCEPTABLE in development, but REQUIRED in production');
      }
    });

    test('should load rules for Anthropic memory tool', async () => {
      await memoryProxy.initialize();

      if (memoryProxy.anthropicEnabled && memoryProxy.anthropicClient) {
        const rulesData = await memoryProxy.anthropicClient.loadGovernanceRules();

        expect(rulesData).toBeDefined();
        expect(rulesData.rules).toBeDefined();
        expect(rulesData.total_rules).toBeGreaterThan(0);

        console.log(`✅ Loaded ${rulesData.total_rules} rules for Anthropic memory tool`);
        console.log('   Stats:', rulesData.stats);
      } else {
        console.log('⚠️ Skipping Anthropic memory tool test (not enabled)');
      }
    });
  });

  // =====================================================
  // TEST 5: End-to-End Workflow
  // =====================================================

  describe('5. End-to-End Hybrid System Workflow', () => {
    test('should complete full governance enforcement workflow', async () => {
      console.log('\n🔄 Starting end-to-end workflow test...\n');

      // Step 1: Initialize system
      console.log('Step 1: Initialize MemoryProxy and BoundaryEnforcer');
      await memoryProxy.initialize();
      await BoundaryEnforcer.initialize();
      console.log('✅ System initialized');

      // Step 2: Load rules from MongoDB
      console.log('\nStep 2: Load governance rules from MongoDB');
      const rules = await memoryProxy.loadGovernanceRules();
      expect(rules.length).toBeGreaterThan(0);
      console.log(`✅ Loaded ${rules.length} governance rules`);

      // Step 3: Enforce boundary
      console.log('\nStep 3: Test boundary enforcement');
      const action = {
        description: 'Generate blog post draft following inst_016 and inst_017',
        text: 'Create content with verifiable sources, no absolute guarantees',
        classification: { quadrant: 'OPERATIONAL' },
        type: 'content_generation'
      };

      const enforcementResult = BoundaryEnforcer.enforce(action, {
        sessionId: 'e2e-workflow-test'
      });

      expect(enforcementResult).toBeDefined();
      console.log(`✅ Enforcement decision: ${enforcementResult.allowed ? 'ALLOWED' : 'BLOCKED'}`);

      // Step 4: Verify audit trail
      console.log('\nStep 4: Verify audit trail written to MongoDB');
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for async audit

      const auditLogs = await AuditLog.find({ sessionId: 'e2e-workflow-test' });
      expect(auditLogs.length).toBeGreaterThan(0);
      console.log(`✅ ${auditLogs.length} audit entries created`);

      // Step 5: Query audit analytics
      console.log('\nStep 5: Query audit analytics');
      const stats = await memoryProxy.getAuditStatistics(
        new Date(Date.now() - 60000), // 1 minute ago
        new Date()
      );

      if (stats) {
        console.log(`✅ Analytics retrieved:`, {
          totalDecisions: stats.totalDecisions,
          allowedRate: stats.allowedRate?.toFixed(1) + '%'
        });
      }

      // Step 6: Anthropic API integration (if available)
      console.log('\nStep 6: Anthropic API integration');
      if (memoryProxy.anthropicEnabled) {
        console.log('✅ Anthropic Memory Tool API is ACTIVE (CORE COMPONENT)');
      } else {
        console.log('⚠️ Anthropic API not enabled (development mode)');
      }

      console.log('\n✅ End-to-end workflow COMPLETE!\n');

      // Cleanup
      await AuditLog.deleteMany({ sessionId: 'e2e-workflow-test' });
    });
  });

  // =====================================================
  // TEST 6: Performance and Scalability
  // =====================================================

  describe('6. Performance Verification', () => {
    test('should load rules in <100ms from cache', async () => {
      await memoryProxy.initialize();

      // First load (cold)
      const start1 = Date.now();
      await memoryProxy.loadGovernanceRules();
      const duration1 = Date.now() - start1;

      // Second load (cached)
      const start2 = Date.now();
      await memoryProxy.loadGovernanceRules();
      const duration2 = Date.now() - start2;

      console.log(`⏱️ Load times: Cold=${duration1}ms, Cached=${duration2}ms`);

      expect(duration2).toBeLessThan(100); // Cache should be fast
    });

    test('should handle concurrent audit writes', async () => {
      await memoryProxy.initialize();

      const concurrentWrites = 10;
      const promises = [];

      for (let i = 0; i < concurrentWrites; i++) {
        promises.push(
          memoryProxy.auditDecision({
            sessionId: `concurrent-test-${i}`,
            action: 'concurrent_write_test',
            allowed: true,
            rulesChecked: [],
            violations: []
          })
        );
      }

      const results = await Promise.all(promises);

      expect(results.length).toBe(concurrentWrites);
      expect(results.every(r => r.success)).toBe(true);

      console.log(`✅ ${concurrentWrites} concurrent writes completed successfully`);

      // Cleanup
      await AuditLog.deleteMany({ sessionId: /^concurrent-test-/ });
    });
  });
});
