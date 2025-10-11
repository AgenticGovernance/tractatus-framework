/**
 * Unit Tests for InstructionPersistenceClassifier
 * Tests quadrant classification, persistence calculation, and verification requirements
 */

const classifier = require('../../src/services/InstructionPersistenceClassifier.service');

describe('InstructionPersistenceClassifier', () => {
  // Classifier is a singleton instance, no setup needed
  beforeEach(() => {
    // Could reset stats here if needed
  });

  describe('Quadrant Classification', () => {
    test('should classify strategic values statements as STRATEGIC', () => {
      const result = classifier.classify({
        text: 'Always prioritize user privacy over convenience',
        context: {},
        source: 'user'
      });

      expect(result.quadrant).toBe('STRATEGIC');
      expect(result.persistence).toBe('HIGH');
    });

    test('should classify explicit port specification as TACTICAL with HIGH persistence', () => {
      const result = classifier.classify({
        text: 'check port 27027',
        context: {},
        source: 'user'
      });

      expect(result.quadrant).toBe('TACTICAL');
      expect(result.persistence).toBe('HIGH');
      expect(result.verification_required).toBe('MANDATORY');
    });

    test('should classify technical code fixes as SYSTEM', () => {
      const result = classifier.classify({
        text: 'fix the syntax error in line 42',
        context: {},
        source: 'user'
      });

      expect(result.quadrant).toBe('SYSTEM');
      expect(result.persistence).toBe('MEDIUM');
    });

    test('should classify operational process instructions as OPERATIONAL', () => {
      const result = classifier.classify({
        text: 'for this project, always use React hooks instead of class components',
        context: {},
        source: 'user'
      });

      expect(result.quadrant).toBe('OPERATIONAL');
      expect(result.persistence).toBe('HIGH');
    });

    test('should classify exploratory requests as STOCHASTIC', () => {
      const result = classifier.classify({
        text: 'explore different approaches to implementing user authentication',
        context: {},
        source: 'user'
      });

      expect(result.quadrant).toBe('STOCHASTIC');
      expect(result.persistence).toBe('MEDIUM');
    });
  });

  describe('Persistence Level Calculation', () => {
    test('should assign HIGH persistence to explicit instructions with must/never', () => {
      const result = classifier.classify({
        text: 'you must never commit credentials to the repository',
        context: {},
        source: 'user'
      });

      expect(result.persistence).toBe('HIGH');
      expect(result.explicitness).toBeGreaterThan(0.7);
    });

    test('should assign MEDIUM persistence to general guidelines', () => {
      const result = classifier.classify({
        text: 'try to keep functions under 50 lines',
        context: {},
        source: 'user'
      });

      expect(result.persistence).toBe('MEDIUM');
    });

    test('should assign LOW persistence to one-time immediate actions', () => {
      const result = classifier.classify({
        text: 'print the current directory',
        context: {},
        source: 'user'
      });

      expect(result.persistence).toBe('LOW');
    });
  });

  describe('Verification Requirements', () => {
    test('should require MANDATORY verification for HIGH persistence STRATEGIC instructions', () => {
      const result = classifier.classify({
        text: 'Never deploy to production without human approval',
        context: {},
        source: 'user'
      });

      expect(result.verification_required).toBe('MANDATORY');
    });

    test('should require RECOMMENDED verification for MEDIUM persistence instructions', () => {
      const result = classifier.classify({
        text: 'prefer async/await over callbacks',
        context: {},
        source: 'user'
      });

      expect(['RECOMMENDED', 'MANDATORY']).toContain(result.verification_required);
    });

    test('should allow OPTIONAL verification for LOW persistence instructions', () => {
      const result = classifier.classify({
        text: 'show me the package.json file',
        context: {},
        source: 'user'
      });

      expect(['OPTIONAL', 'RECOMMENDED']).toContain(result.verification_required);
    });
  });

  describe('Temporal Scope Detection', () => {
    test('should detect PERMANENT scope for always/never statements', () => {
      const result = classifier.classify({
        text: 'Always validate user input before database queries',
        context: {},
        source: 'user'
      });

      expect(result.metadata.temporal_scope).toBe('PERMANENT');
    });

    test('should detect PROJECT scope for project-specific instructions', () => {
      const result = classifier.classify({
        text: 'For this project, use MongoDB on port 27027',
        context: {},
        source: 'user'
      });

      expect(result.metadata.temporal_scope).toBe('PROJECT');
    });

    test('should detect IMMEDIATE scope for right now statements', () => {
      const result = classifier.classify({
        text: 'right now, restart the development server',
        context: {},
        source: 'user'
      });

      expect(result.metadata.temporal_scope).toBe('IMMEDIATE');
    });

    test('should detect SESSION scope for context-specific instructions', () => {
      const result = classifier.classify({
        text: 'for the rest of this conversation, use verbose logging',
        context: {},
        source: 'user'
      });

      expect(result.metadata.temporal_scope).toBe('SESSION');
    });
  });

  describe('Explicitness Measurement', () => {
    test('should score high explicitness for instructions with explicit markers', () => {
      const result = classifier.classify({
        text: 'You must specifically use port 27027, not the default port',
        context: {},
        source: 'user'
      });

      expect(result.explicitness).toBeGreaterThan(0.8);
    });

    test('should score low explicitness for implicit suggestions', () => {
      const result = classifier.classify({
        text: 'maybe consider using port 27027',
        context: {},
        source: 'user'
      });

      expect(result.explicitness).toBeLessThan(0.5);
    });
  });

  describe('27027 Failure Mode Prevention', () => {
    test('should classify port specification with HIGH persistence and MANDATORY verification', () => {
      const result = classifier.classify({
        text: 'check MongoDB on port 27027 for the family-history collection',
        context: {},
        source: 'user'
      });

      expect(result.quadrant).toBe('TACTICAL');
      expect(result.persistence).toBe('HIGH');
      expect(result.verification_required).toBe('MANDATORY');
      expect(result.metadata.extracted_parameters).toHaveProperty('port', '27027');
    });

    test('should extract and preserve specific parameter values', () => {
      const result = classifier.classify({
        text: 'connect to database family_history on port 27027',
        context: {},
        source: 'user'
      });

      expect(result.metadata.extracted_parameters).toMatchObject({
        port: '27027',
        database: 'family_history'
      });
    });
  });

  describe('Metadata Preservation', () => {
    test('should preserve timestamp', () => {
      const before = new Date();
      const result = classifier.classify({
        text: 'test instruction',
        context: {},
        source: 'user'
      });
      const after = new Date();

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should preserve source attribution', () => {
      const result = classifier.classify({
        text: 'test instruction',
        context: {},
        source: 'user'
      });

      expect(result.source).toBe('user');
    });

    test('should include metadata object with all required fields', () => {
      const result = classifier.classify({
        text: 'Always use TypeScript for new projects',
        context: {},
        source: 'user'
      });

      expect(result.metadata).toHaveProperty('temporal_scope');
      expect(result.metadata).toHaveProperty('extracted_parameters');
      expect(result.metadata).toHaveProperty('context_snapshot');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty text gracefully', () => {
      const result = classifier.classify({
        text: '',
        context: {},
        source: 'user'
      });

      expect(result.quadrant).toBe('STOCHASTIC');
      expect(result.persistence).toBe('LOW');
    });

    test('should handle very long instructions', () => {
      const longText = 'Always ' + 'do this '.repeat(100) + 'when implementing features';
      const result = classifier.classify({
        text: longText,
        context: {},
        source: 'user'
      });

      expect(result.quadrant).toBeDefined();
      expect(result.persistence).toBeDefined();
    });

    test('should handle special characters and unicode', () => {
      const result = classifier.classify({
        text: 'Use emojis 🔒 for security-related messages',
        context: {},
        source: 'user'
      });

      expect(result.quadrant).toBeDefined();
      expect(result.text).toContain('🔒');
    });

    test('should handle code blocks in instructions', () => {
      const result = classifier.classify({
        text: 'Use this pattern: const foo = async () => { await bar(); }',
        context: {},
        source: 'user'
      });

      expect(result.quadrant).toBeDefined();
      expect(result.metadata.extracted_parameters).toBeDefined();
    });
  });

  describe('Classification Consistency', () => {
    test('should produce consistent results for identical inputs', () => {
      const text = 'Always validate user input before database operations';
      const result1 = classifier.classify({ text, context: {}, source: 'user' });
      const result2 = classifier.classify({ text, context: {}, source: 'user' });

      expect(result1.quadrant).toBe(result2.quadrant);
      expect(result1.persistence).toBe(result2.persistence);
      expect(result1.explicitness).toBe(result2.explicitness);
    });

    test('should handle variations in capitalization consistently', () => {
      const lower = classifier.classify({ text: 'always use https', context: {}, source: 'user' });
      const upper = classifier.classify({ text: 'ALWAYS USE HTTPS', context: {}, source: 'user' });

      expect(lower.quadrant).toBe(upper.quadrant);
      expect(lower.persistence).toBe(upper.persistence);
    });
  });

  describe('Context Integration', () => {
    test('should consider conversation context in classification', () => {
      const context = {
        recent_topics: ['security', 'authentication'],
        pressure_level: 'NORMAL'
      };

      const result = classifier.classify({
        text: 'never store passwords in plain text',
        context,
        source: 'user'
      });

      expect(result.quadrant).toBe('STRATEGIC');
      expect(result.persistence).toBe('HIGH');
    });

    test('should adjust verification requirements based on context pressure', () => {
      const highPressureContext = {
        token_usage: 0.9,
        errors_recent: 5,
        conversation_length: 100
      };

      const result = classifier.classify({
        text: 'update the database schema',
        context: highPressureContext,
        source: 'user'
      });

      // High pressure should increase verification requirements
      expect(['RECOMMENDED', 'MANDATORY']).toContain(result.verification_required);
    });
  });

  describe('Singleton Pattern', () => {
    test('should export singleton instance', () => {
      // Verify the exported object has the expected methods
      expect(typeof classifier.classify).toBe('function');
      expect(typeof classifier.getStats).toBe('function');
    });

    test('should maintain classification count across calls', () => {
      const initialCount = classifier.getStats().total_classifications;

      classifier.classify({ text: 'test', context: {}, source: 'user' });

      const newCount = classifier.getStats().total_classifications;

      expect(newCount).toBe(initialCount + 1);
    });
  });

  describe('Statistics Tracking', () => {
    test('should track classification statistics', () => {
      const stats = classifier.getStats();

      expect(stats).toHaveProperty('total_classifications');
      expect(stats).toHaveProperty('by_quadrant');
      expect(stats).toHaveProperty('by_persistence');
      expect(stats).toHaveProperty('by_verification');
    });

    test('should increment classification count after classify()', () => {
      const before = classifier.getStats().total_classifications;

      classifier.classify({
        text: 'test instruction',
        context: {},
        source: 'user'
      });

      const after = classifier.getStats().total_classifications;

      expect(after).toBe(before + 1);
    });
  });
});
