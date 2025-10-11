/**
 * Unit Tests for CrossReferenceValidator
 * Tests cross-reference validation to prevent pattern override of explicit instructions
 */

const validator = require('../../src/services/CrossReferenceValidator.service');
const classifier = require('../../src/services/InstructionPersistenceClassifier.service');

describe('CrossReferenceValidator', () => {
  beforeEach(() => {
    // Clear instruction history before each test
    if (validator.clearInstructions) {
      validator.clearInstructions();
    }
  });

  describe('27027 Failure Mode Prevention', () => {
    test('should detect conflict when action uses default port instead of explicit instruction', () => {
      // Simulate explicit user instruction
      const instruction = classifier.classify({
        text: 'check MongoDB on port 27027',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      // Simulate AI action using wrong port
      const action = {
        type: 'database_query',
        description: 'Connect to MongoDB',
        parameters: {
          port: 27017,
          database: 'family_history'
        }
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(result.status).toBe('REJECTED');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].parameter).toBe('port');
      expect(result.conflicts[0].severity).toBe('CRITICAL');
    });

    test('should approve action when port matches explicit instruction', () => {
      const instruction = classifier.classify({
        text: 'check MongoDB on port 27027',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      const action = {
        type: 'database_query',
        description: 'Connect to MongoDB',
        parameters: {
          port: 27027,
          database: 'family_history'
        }
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(result.status).toBe('APPROVED');
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('Conflict Detection', () => {
    test('should detect parameter conflicts between action and instruction', () => {
      const instruction = classifier.classify({
        text: 'use React for the frontend, not Vue',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      const action = {
        type: 'install_package',
        description: 'Install Vue.js framework',
        parameters: {
          package: 'vue',
          framework: 'vue'
        }
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(result.status).toBe('REJECTED');
      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    test('should not flag conflicts for unrelated actions', () => {
      const instruction = classifier.classify({
        text: 'use MongoDB on port 27027',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      const action = {
        type: 'file_write',
        description: 'Create package.json',
        parameters: {
          file: 'package.json',
          content: '{}'
        }
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(result.status).toBe('APPROVED');
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('Relevance Calculation', () => {
    test('should prioritize recent instructions over older ones', () => {
      const oldInstruction = classifier.classify({
        text: 'use port 27017',
        context: {},
        source: 'user',
        timestamp: new Date(Date.now() - 3600000) // 1 hour ago
      });

      const recentInstruction = classifier.classify({
        text: 'actually, use port 27027 instead',
        context: {},
        source: 'user',
        timestamp: new Date()
      });

      validator.addInstruction(oldInstruction);
      validator.addInstruction(recentInstruction);

      const action = {
        type: 'database_connect',
        description: 'Connect to database',
        parameters: {
          port: 27017
        }
      };

      const result = validator.validate(action, {
        recent_instructions: [oldInstruction, recentInstruction]
      });

      // Should conflict with recent instruction, not old one
      expect(result.status).toBe('REJECTED');
      expect(result.conflicts[0].instruction.text).toContain('27027');
    });

    test('should prioritize high-persistence instructions', () => {
      const lowPersistence = classifier.classify({
        text: 'try using port 8000',
        context: {},
        source: 'user'
      });

      const highPersistence = classifier.classify({
        text: 'you must use port 9000',
        context: {},
        source: 'user'
      });

      validator.addInstruction(lowPersistence);
      validator.addInstruction(highPersistence);

      const action = {
        type: 'start_server',
        description: 'Start development server',
        parameters: {
          port: 8000
        }
      };

      const result = validator.validate(action, {
        recent_instructions: [lowPersistence, highPersistence]
      });

      expect(result.status).toBe('REJECTED');
      expect(result.conflicts[0].instruction.text).toContain('must');
    });
  });

  describe('Conflict Severity Levels', () => {
    test('should assign CRITICAL severity to conflicts with HIGH persistence explicit instructions', () => {
      const instruction = classifier.classify({
        text: 'never use HTTP, always use HTTPS',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      const action = {
        type: 'api_request',
        description: 'Fetch data',
        parameters: {
          protocol: 'http',
          url: 'http://example.com'
        }
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(result.status).toBe('REJECTED');
      expect(result.conflicts[0].severity).toBe('CRITICAL');
    });

    test('should assign WARNING severity to conflicts with MEDIUM persistence instructions', () => {
      const instruction = classifier.classify({
        text: 'prefer using async/await over callbacks',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      const action = {
        type: 'code_generation',
        description: 'Generate function with callbacks',
        parameters: {
          pattern: 'callback'
        }
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(['WARNING', 'APPROVED']).toContain(result.status);
    });
  });

  describe('Lookback Window', () => {
    test('should only consider instructions within lookback window', () => {
      // Create 60 instructions
      for (let i = 0; i < 60; i++) {
        const instruction = classifier.classify({
          text: `instruction ${i}`,
          context: {},
          source: 'user'
        });
        validator.addInstruction(instruction);
      }

      // Most recent instruction says use port 27027
      const recentInstruction = classifier.classify({
        text: 'use port 27027',
        context: {},
        source: 'user'
      });
      validator.addInstruction(recentInstruction);

      const action = {
        type: 'database_connect',
        parameters: {
          port: 27017
        }
      };

      const result = validator.validate(action, {
        recent_instructions: validator.getRecentInstructions()
      });

      // Should detect conflict with recent instruction
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('Parameter Extraction', () => {
    test('should extract port numbers from action parameters', () => {
      const action = {
        type: 'database_connect',
        parameters: {
          host: 'localhost',
          port: 27017,
          database: 'test'
        }
      };

      const extracted = validator._extractActionParameters(action);

      expect(extracted).toHaveProperty('port', 27017);
    });

    test('should extract port numbers from action description', () => {
      const action = {
        type: 'database_connect',
        description: 'Connect to MongoDB on port 27017'
      };

      const extracted = validator._extractActionParameters(action);

      expect(extracted).toHaveProperty('port', '27017');
    });

    test('should extract database names from parameters', () => {
      const action = {
        type: 'query',
        parameters: {
          database: 'family_history',
          collection: 'users'
        }
      };

      const extracted = validator._extractActionParameters(action);

      expect(extracted).toHaveProperty('database', 'family_history');
    });
  });

  describe('Instruction Management', () => {
    test('should add instructions to history', () => {
      const instruction = classifier.classify({
        text: 'test instruction',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      const recent = validator.getRecentInstructions();
      expect(recent).toContainEqual(instruction);
    });

    test('should clear instruction history', () => {
      const instruction = classifier.classify({
        text: 'test instruction',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);
      expect(validator.getRecentInstructions().length).toBeGreaterThan(0);

      validator.clearInstructions();
      expect(validator.getRecentInstructions()).toHaveLength(0);
    });

    test('should maintain instruction order (most recent first)', () => {
      const first = classifier.classify({
        text: 'first',
        context: {},
        source: 'user'
      });
      const second = classifier.classify({
        text: 'second',
        context: {},
        source: 'user'
      });

      validator.addInstruction(first);
      validator.addInstruction(second);

      const recent = validator.getRecentInstructions();
      expect(recent[0].text).toBe('second');
      expect(recent[1].text).toBe('first');
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle multiple conflicting parameters', () => {
      const instruction = classifier.classify({
        text: 'connect to database family_history on host localhost port 27027',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      const action = {
        type: 'database_connect',
        parameters: {
          host: 'remotehost',
          port: 27017,
          database: 'other_db'
        }
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(result.status).toBe('REJECTED');
      expect(result.conflicts.length).toBeGreaterThan(1);
    });

    test('should handle partial matches correctly', () => {
      const instruction = classifier.classify({
        text: 'use port 27027',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      // Action that matches one parameter but not all
      const action = {
        type: 'database_connect',
        parameters: {
          port: 27027,
          ssl: false  // Not mentioned in instruction
        }
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(result.status).toBe('APPROVED');
    });
  });

  describe('Validation Decision Logic', () => {
    test('should reject when critical conflicts exist', () => {
      const instruction = classifier.classify({
        text: 'never delete user data without confirmation',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      const action = {
        type: 'delete_users',
        description: 'Delete all inactive users',
        parameters: {
          confirmed: false
        }
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(result.status).toBe('REJECTED');
      expect(result.required_action).toBe('REQUEST_CLARIFICATION');
    });

    test('should warn when minor conflicts exist', () => {
      const instruction = classifier.classify({
        text: 'consider using ESM imports instead of CommonJS',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      const action = {
        type: 'code_generation',
        description: 'Generate CommonJS module',
        parameters: {
          module_type: 'commonjs'
        }
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(['WARNING', 'APPROVED']).toContain(result.status);
    });

    test('should approve when no conflicts exist', () => {
      const instruction = classifier.classify({
        text: 'use TypeScript for new files',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      const action = {
        type: 'create_file',
        description: 'Create new TypeScript component',
        parameters: {
          extension: '.ts'
        }
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(result.status).toBe('APPROVED');
    });
  });

  describe('Edge Cases', () => {
    test('should handle validation with empty instruction history', () => {
      const action = {
        type: 'test',
        parameters: { port: 27017 }
      };

      const result = validator.validate(action, { recent_instructions: [] });

      expect(result.status).toBe('APPROVED');
      expect(result.conflicts).toHaveLength(0);
    });

    test('should handle action with no parameters', () => {
      const instruction = classifier.classify({
        text: 'test',
        context: {},
        source: 'user'
      });

      const action = {
        type: 'simple_action'
      };

      const result = validator.validate(action, { recent_instructions: [instruction] });

      expect(result.status).toBe('APPROVED');
    });

    test('should handle null or undefined action gracefully', () => {
      expect(() => {
        validator.validate(null, { recent_instructions: [] });
      }).not.toThrow();

      expect(() => {
        validator.validate(undefined, { recent_instructions: [] });
      }).not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    test('should export singleton instance with required methods', () => {
      expect(typeof validator.validate).toBe('function');
      expect(typeof validator.addInstruction).toBe('function');
      expect(typeof validator.getStats).toBe('function');
    });

    test('should maintain instruction history across calls', () => {
      const instruction = classifier.classify({
        text: 'test',
        context: {},
        source: 'user'
      });

      if (validator.addInstruction) {
        validator.addInstruction(instruction);

        if (validator.getRecentInstructions) {
          const history = validator.getRecentInstructions();
          expect(history).toBeDefined();
        }
      }
    });
  });

  describe('Statistics Tracking', () => {
    test('should track validation statistics', () => {
      const stats = validator.getStats();

      expect(stats).toHaveProperty('total_validations');
      expect(stats).toHaveProperty('conflicts_detected');
      expect(stats).toHaveProperty('rejections');
    });

    test('should increment validation count after validate()', () => {
      const before = validator.getStats().total_validations;

      validator.validate(
        { type: 'test', parameters: {} },
        { recent_instructions: [] }
      );

      const after = validator.getStats().total_validations;

      expect(after).toBe(before + 1);
    });

    test('should track conflict detection rate', () => {
      const instruction = classifier.classify({
        text: 'use port 27027',
        context: {},
        source: 'user'
      });

      validator.addInstruction(instruction);

      // Action with conflict
      validator.validate(
        { type: 'connect', parameters: { port: 27017 } },
        { recent_instructions: [instruction] }
      );

      const stats = validator.getStats();
      expect(stats.conflicts_detected).toBeGreaterThan(0);
    });
  });
});
