/**
 * Unit Tests - MemoryProxy Service
 * Tests memory-backed governance rule persistence and retrieval
 */

const { MemoryProxyService } = require('../../src/services/MemoryProxy.service');
const fs = require('fs').promises;
const path = require('path');

describe('MemoryProxyService', () => {
  let memoryProxy;
  const testMemoryPath = path.join(__dirname, '../../.memory-test');

  const testRules = [
    {
      id: 'inst_001',
      text: 'Test rule 1',
      quadrant: 'STRATEGIC',
      persistence: 'HIGH',
      active: true
    },
    {
      id: 'inst_002',
      text: 'Test rule 2',
      quadrant: 'OPERATIONAL',
      persistence: 'HIGH',
      active: true
    },
    {
      id: 'inst_003',
      text: 'Test rule 3',
      quadrant: 'SYSTEM',
      persistence: 'MEDIUM',
      active: true
    }
  ];

  beforeEach(async () => {
    memoryProxy = new MemoryProxyService({
      memoryBasePath: testMemoryPath,
      cacheEnabled: true,
      cacheTTL: 1000 // 1 second for testing
    });

    await memoryProxy.initialize();
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testMemoryPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('should create memory directory structure', async () => {
      const governanceDir = path.join(testMemoryPath, 'governance');
      const sessionsDir = path.join(testMemoryPath, 'sessions');
      const auditDir = path.join(testMemoryPath, 'audit');

      await expect(fs.access(governanceDir)).resolves.toBeUndefined();
      await expect(fs.access(sessionsDir)).resolves.toBeUndefined();
      await expect(fs.access(auditDir)).resolves.toBeUndefined();
    });
  });

  describe('persistGovernanceRules', () => {
    test('should persist rules successfully', async () => {
      const result = await memoryProxy.persistGovernanceRules(testRules);

      expect(result.success).toBe(true);
      expect(result.rulesStored).toBe(3);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.stats).toBeDefined();
      expect(result.stats.by_quadrant).toBeDefined();
      expect(result.stats.by_persistence).toBeDefined();
    });

    test('should create rules file on filesystem', async () => {
      await memoryProxy.persistGovernanceRules(testRules);

      const filePath = path.join(testMemoryPath, 'governance/tractatus-rules-v1.json');
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);

      expect(parsed.version).toBe('1.0');
      expect(parsed.total_rules).toBe(3);
      expect(parsed.rules).toHaveLength(3);
      expect(parsed.updated_at).toBeDefined();
    });

    test('should validate rule format', async () => {
      const invalidRules = [
        { id: 'test', text: 'missing required fields' }
      ];

      await expect(memoryProxy.persistGovernanceRules(invalidRules))
        .rejects
        .toThrow('Invalid rule format');
    });

    test('should reject empty rules array', async () => {
      await expect(memoryProxy.persistGovernanceRules([]))
        .rejects
        .toThrow('Cannot persist empty rules array');
    });

    test('should reject non-array input', async () => {
      await expect(memoryProxy.persistGovernanceRules({ invalid: 'input' }))
        .rejects
        .toThrow('Rules must be an array');
    });

    test('should update cache after persisting', async () => {
      await memoryProxy.persistGovernanceRules(testRules);

      const stats = memoryProxy.getCacheStats();
      expect(stats.entries).toBe(1);
      expect(stats.keys).toContain('governance-rules');
    });
  });

  describe('loadGovernanceRules', () => {
    beforeEach(async () => {
      await memoryProxy.persistGovernanceRules(testRules);
    });

    test('should load rules successfully', async () => {
      const rules = await memoryProxy.loadGovernanceRules();

      expect(rules).toHaveLength(3);
      expect(rules[0].id).toBe('inst_001');
      expect(rules[1].id).toBe('inst_002');
      expect(rules[2].id).toBe('inst_003');
    });

    test('should load from cache on second call', async () => {
      // First call - from filesystem
      await memoryProxy.loadGovernanceRules();

      // Second call - from cache (much faster)
      const startTime = Date.now();
      const rules = await memoryProxy.loadGovernanceRules();
      const duration = Date.now() - startTime;

      expect(rules).toHaveLength(3);
      expect(duration).toBeLessThan(5); // Cache should be very fast
    });

    test('should bypass cache when skipCache option is true', async () => {
      // Load to populate cache
      await memoryProxy.loadGovernanceRules();

      // Clear cache
      memoryProxy.clearCache();

      // Load with skipCache should work
      const rules = await memoryProxy.loadGovernanceRules({ skipCache: true });
      expect(rules).toHaveLength(3);
    });

    test('should return empty array if rules file does not exist', async () => {
      // Create new instance with different path
      const emptyProxy = new MemoryProxyService({
        memoryBasePath: path.join(testMemoryPath, 'empty')
      });
      await emptyProxy.initialize();

      const rules = await emptyProxy.loadGovernanceRules();
      expect(rules).toEqual([]);
    });

    test('should maintain data integrity across persist/load cycle', async () => {
      const rules = await memoryProxy.loadGovernanceRules();

      for (let i = 0; i < testRules.length; i++) {
        expect(rules[i].id).toBe(testRules[i].id);
        expect(rules[i].text).toBe(testRules[i].text);
        expect(rules[i].quadrant).toBe(testRules[i].quadrant);
        expect(rules[i].persistence).toBe(testRules[i].persistence);
      }
    });
  });

  describe('getRule', () => {
    beforeEach(async () => {
      await memoryProxy.persistGovernanceRules(testRules);
    });

    test('should get specific rule by ID', async () => {
      const rule = await memoryProxy.getRule('inst_002');

      expect(rule).toBeDefined();
      expect(rule.id).toBe('inst_002');
      expect(rule.text).toBe('Test rule 2');
      expect(rule.quadrant).toBe('OPERATIONAL');
    });

    test('should return null for non-existent rule', async () => {
      const rule = await memoryProxy.getRule('inst_999');
      expect(rule).toBeNull();
    });
  });

  describe('getRulesByQuadrant', () => {
    beforeEach(async () => {
      await memoryProxy.persistGovernanceRules(testRules);
    });

    test('should filter rules by quadrant', async () => {
      const strategicRules = await memoryProxy.getRulesByQuadrant('STRATEGIC');

      expect(strategicRules).toHaveLength(1);
      expect(strategicRules[0].id).toBe('inst_001');
      expect(strategicRules[0].quadrant).toBe('STRATEGIC');
    });

    test('should return empty array for non-existent quadrant', async () => {
      const rules = await memoryProxy.getRulesByQuadrant('NONEXISTENT');
      expect(rules).toEqual([]);
    });
  });

  describe('getRulesByPersistence', () => {
    beforeEach(async () => {
      await memoryProxy.persistGovernanceRules(testRules);
    });

    test('should filter rules by persistence level', async () => {
      const highRules = await memoryProxy.getRulesByPersistence('HIGH');

      expect(highRules).toHaveLength(2);
      expect(highRules.every(r => r.persistence === 'HIGH')).toBe(true);
    });

    test('should return empty array for non-existent persistence level', async () => {
      const rules = await memoryProxy.getRulesByPersistence('LOW');
      expect(rules).toEqual([]);
    });
  });

  describe('auditDecision', () => {
    test('should audit decision successfully', async () => {
      const decision = {
        sessionId: 'test-session-001',
        action: 'blog_post_generation',
        rulesChecked: ['inst_016', 'inst_017'],
        violations: [],
        allowed: true,
        metadata: {
          user: 'test-user',
          timestamp: new Date().toISOString()
        }
      };

      const result = await memoryProxy.auditDecision(decision);

      expect(result.success).toBe(true);
      expect(result.audited).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0); // Allow 0ms for very fast operations
      expect(result.path).toContain('audit/decisions-');
    });

    test('should create audit log file', async () => {
      const decision = {
        sessionId: 'test-session-002',
        action: 'test_action',
        allowed: true
      };

      await memoryProxy.auditDecision(decision);

      const today = new Date().toISOString().split('T')[0];
      const auditPath = path.join(testMemoryPath, `audit/decisions-${today}.jsonl`);

      const data = await fs.readFile(auditPath, 'utf8');
      const lines = data.trim().split('\n');
      const parsed = JSON.parse(lines[0]);

      expect(parsed.sessionId).toBe('test-session-002');
      expect(parsed.action).toBe('test_action');
      expect(parsed.allowed).toBe(true);
      expect(parsed.timestamp).toBeDefined();
    });

    test('should append multiple audit entries to same file', async () => {
      const decision1 = { sessionId: 'session-1', action: 'action-1', allowed: true };
      const decision2 = { sessionId: 'session-2', action: 'action-2', allowed: false };

      await memoryProxy.auditDecision(decision1);
      await memoryProxy.auditDecision(decision2);

      const today = new Date().toISOString().split('T')[0];
      const auditPath = path.join(testMemoryPath, `audit/decisions-${today}.jsonl`);

      const data = await fs.readFile(auditPath, 'utf8');
      const lines = data.trim().split('\n');

      expect(lines).toHaveLength(2);
    });

    test('should reject decision without required fields', async () => {
      const invalidDecision = { sessionId: 'test', /* missing action */ };

      await expect(memoryProxy.auditDecision(invalidDecision))
        .rejects
        .toThrow('Decision must include sessionId and action');
    });
  });

  describe('Cache Management', () => {
    test('should clear cache', async () => {
      await memoryProxy.persistGovernanceRules(testRules);

      expect(memoryProxy.getCacheStats().entries).toBe(1);

      memoryProxy.clearCache();

      expect(memoryProxy.getCacheStats().entries).toBe(0);
    });

    test('should expire cache after TTL', async () => {
      // Create proxy with 100ms TTL
      const shortTTLProxy = new MemoryProxyService({
        memoryBasePath: testMemoryPath,
        cacheEnabled: true,
        cacheTTL: 100
      });
      await shortTTLProxy.initialize();

      await shortTTLProxy.persistGovernanceRules(testRules);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should reload from filesystem (cache expired)
      const rules = await shortTTLProxy.loadGovernanceRules();
      expect(rules).toHaveLength(3);
    });

    test('should get cache statistics', () => {
      const stats = memoryProxy.getCacheStats();

      expect(stats.enabled).toBe(true);
      expect(stats.ttl).toBe(1000);
      expect(stats.entries).toBeGreaterThanOrEqual(0);
      expect(stats.keys).toBeDefined();
    });
  });
});
