/**
 * Unit Tests for MetacognitiveVerifier
 * Tests metacognitive self-verification before action execution
 */

const verifier = require('../../src/services/MetacognitiveVerifier.service');

describe('MetacognitiveVerifier', () => {
  beforeEach(() => {
    // Verifier is a singleton instance
  });

  describe('Alignment Verification', () => {
    test('should verify action aligns with stated reasoning', () => {
      const action = {
        type: 'database_connect',
        parameters: { port: 27027 }
      };

      const reasoning = {
        explanation: 'User explicitly requested port 27027',
        evidence: ['user instruction: use port 27027']
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.checks.alignment.passed).toBe(true);
      expect(result.checks.alignment.score).toBeGreaterThan(0.7);
    });

    test('should detect misalignment between action and reasoning', () => {
      const action = {
        type: 'database_connect',
        parameters: { port: 27017 }
      };

      const reasoning = {
        explanation: 'User explicitly requested port 27027',
        evidence: ['user instruction: use port 27027']
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.checks.alignment.passed).toBe(false);
      expect(result.checks.alignment.issues).toContain('action parameters conflict with reasoning');
    });
  });

  describe('Coherence Verification', () => {
    test('should verify reasoning is internally consistent', () => {
      const action = {
        type: 'install_package',
        parameters: { package: 'react' }
      };

      const reasoning = {
        explanation: 'Installing React as requested',
        steps: [
          'User asked for React installation',
          'React is the appropriate package',
          'Install React via npm'
        ]
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.checks.coherence.passed).toBe(true);
      expect(result.checks.coherence.score).toBeGreaterThan(0.6);
    });

    test('should detect logical contradictions in reasoning', () => {
      const action = {
        type: 'install_package',
        parameters: { package: 'vue' }
      };

      const reasoning = {
        explanation: 'Installing React framework',
        steps: [
          'Install React',
          'Actually using Vue',
          'Run Vue installation'
        ]
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.checks.coherence.passed).toBe(false);
      expect(result.checks.coherence.issues).toContain('reasoning contains contradictions');
    });
  });

  describe('Completeness Verification', () => {
    test('should verify all necessary steps are included', () => {
      const action = {
        type: 'deploy',
        parameters: { environment: 'production' }
      };

      const reasoning = {
        explanation: 'Deploy to production',
        steps: [
          'Run tests',
          'Build production bundle',
          'Backup current version',
          'Deploy new version',
          'Verify deployment'
        ]
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.checks.completeness.passed).toBe(true);
      expect(result.checks.completeness.score).toBeGreaterThan(0.7);
    });

    test('should detect missing critical steps', () => {
      const action = {
        type: 'deploy',
        parameters: { environment: 'production' }
      };

      const reasoning = {
        explanation: 'Deploy to production',
        steps: [
          'Deploy new version'
        ]
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.checks.completeness.passed).toBe(false);
      expect(result.checks.completeness.missing_considerations).toContain('testing');
    });
  });

  describe('Safety Verification', () => {
    test('should verify safe operations pass safety check', () => {
      const action = {
        type: 'read_file',
        parameters: { file: 'config.json' }
      };

      const reasoning = {
        explanation: 'Reading configuration file to check settings'
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.checks.safety.passed).toBe(true);
      expect(result.checks.safety.risk_level).toBe('LOW');
    });

    test('should flag dangerous operations', () => {
      const action = {
        type: 'delete_all',
        parameters: { table: 'users' }
      };

      const reasoning = {
        explanation: 'Cleaning up user table'
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.checks.safety.passed).toBe(false);
      expect(result.checks.safety.risk_level).toBe('HIGH');
      expect(result.checks.safety.concerns).toContain('destructive operation');
    });

    test('should require explicit confirmation for risky actions', () => {
      const action = {
        type: 'modify_schema',
        parameters: { table: 'users' }
      };

      const reasoning = {
        explanation: 'Update database schema'
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.requires_confirmation).toBe(true);
      expect(result.checks.safety.risk_level).toMatch(/MEDIUM|HIGH/);
    });
  });

  describe('Alternative Consideration', () => {
    test('should verify alternatives were considered', () => {
      const action = {
        type: 'implementation',
        parameters: { approach: 'A' }
      };

      const reasoning = {
        explanation: 'Using approach A',
        alternatives_considered: [
          'Approach A: Fast but uses more memory',
          'Approach B: Slower but memory efficient',
          'Selected A for performance priority'
        ]
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.checks.alternatives.passed).toBe(true);
      expect(result.checks.alternatives.score).toBeGreaterThan(0.7);
    });

    test('should flag lack of alternative consideration', () => {
      const action = {
        type: 'implementation',
        parameters: { approach: 'A' }
      };

      const reasoning = {
        explanation: 'Using approach A',
        alternatives_considered: []
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.checks.alternatives.passed).toBe(false);
      expect(result.checks.alternatives.issues).toContain('no alternatives considered');
    });
  });

  describe('Overall Confidence Calculation', () => {
    test('should calculate high confidence when all checks pass', () => {
      const action = {
        type: 'safe_operation',
        parameters: { file: 'test.txt' }
      };

      const reasoning = {
        explanation: 'Safe file read operation',
        evidence: ['user requested', 'file exists', 'read-only'],
        steps: ['locate file', 'read contents', 'return data'],
        alternatives_considered: ['direct read', 'streamed read'],
        edgeCases: ['file not found', 'permission denied']
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.decision).toBe('PROCEED');
    });

    test('should calculate low confidence when checks fail', () => {
      const action = {
        type: 'risky_operation',
        parameters: { destructive: true }
      };

      const reasoning = {
        explanation: 'Maybe do this',
        evidence: [],
        steps: ['do it']
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.decision).toMatch(/BLOCK|REQUEST_CLARIFICATION|REQUIRE_REVIEW/);
    });

    test('should weight checks appropriately', () => {
      // Safety failures should heavily impact confidence
      const unsafeAction = {
        type: 'delete_database'
      };

      const reasoning = {
        explanation: 'Delete database',
        evidence: ['complete analysis'],
        steps: ['backup', 'delete', 'verify'],
        alternatives_considered: ['archive instead']
      };

      const result = verifier.verify(unsafeAction, reasoning, {});

      expect(result.confidence).toBeLessThan(0.6);
      expect(result.checks.safety.passed).toBe(false);
    });
  });

  describe('Pressure-Adjusted Verification', () => {
    test('should increase verification strictness under high pressure', () => {
      const action = {
        type: 'database_update',
        parameters: { table: 'users' }
      };

      const reasoning = {
        explanation: 'Update users table'
      };

      const lowPressure = { pressure_level: 'NORMAL' };
      const highPressure = { pressure_level: 'CRITICAL', token_usage: 0.9 };

      const lowResult = verifier.verify(action, reasoning, lowPressure);
      const highResult = verifier.verify(action, reasoning, highPressure);

      // High pressure should reduce confidence
      expect(highResult.confidence).toBeLessThan(lowResult.confidence);
      expect(highResult.pressure_adjustment).toBeLessThan(1.0);
    });

    test('should require higher confidence threshold under pressure', () => {
      const action = {
        type: 'moderate_risk',
        parameters: {}
      };

      const reasoning = {
        explanation: 'Moderate risk operation',
        evidence: ['some evidence']
      };

      const criticalPressure = {
        pressure_level: 'CRITICAL',
        errors_recent: 10
      };

      const result = verifier.verify(action, reasoning, criticalPressure);

      expect(result.threshold_adjusted).toBe(true);
      expect(result.required_confidence).toBeGreaterThan(0.7);
    });

    test('should block operations at DANGEROUS pressure', () => {
      const action = {
        type: 'any_operation'
      };

      const reasoning = {
        explanation: 'Well-reasoned action'
      };

      const dangerousPressure = {
        pressure_level: 'DANGEROUS',
        token_usage: 0.95
      };

      const result = verifier.verify(action, reasoning, dangerousPressure);

      expect(result.decision).toBe('BLOCK');
      expect(result.reason).toContain('pressure too high');
    });
  });

  describe('Verification Decisions', () => {
    test('should return PROCEED for high confidence actions', () => {
      const result = verifier._makeDecision(0.85, {});

      expect(result.decision).toBe('PROCEED');
      expect(result.requires_confirmation).toBe(false);
    });

    test('should return REQUEST_CONFIRMATION for medium confidence', () => {
      const result = verifier._makeDecision(0.65, {});

      expect(result.decision).toBe('REQUEST_CONFIRMATION');
      expect(result.requires_confirmation).toBe(true);
    });

    test('should return REQUEST_CLARIFICATION for low confidence', () => {
      const result = verifier._makeDecision(0.45, {});

      expect(result.decision).toBe('REQUEST_CLARIFICATION');
    });

    test('should return BLOCK for very low confidence', () => {
      const result = verifier._makeDecision(0.2, {});

      expect(result.decision).toBe('BLOCK');
    });
  });

  describe('27027 Failure Mode Prevention', () => {
    test('should detect when action conflicts with explicit instruction', () => {
      const action = {
        type: 'database_connect',
        parameters: { port: 27017 }
      };

      const reasoning = {
        explanation: 'Connecting to MongoDB on default port',
        evidence: ['MongoDB default is 27017']
      };

      const context = {
        explicit_instructions: [
          { text: 'use port 27027', timestamp: new Date() }
        ]
      };

      const result = verifier.verify(action, reasoning, context);

      expect(result.checks.alignment.passed).toBe(false);
      expect(result.decision).toMatch(/BLOCK|REQUEST_CLARIFICATION/);
    });

    test('should approve when action matches explicit instruction', () => {
      const action = {
        type: 'database_connect',
        parameters: { port: 27027 }
      };

      const reasoning = {
        explanation: 'Connecting to MongoDB on port 27027 as instructed',
        evidence: ['User explicitly said port 27027']
      };

      const context = {
        explicit_instructions: [
          { text: 'use port 27027', timestamp: new Date() }
        ]
      };

      const result = verifier.verify(action, reasoning, context);

      expect(result.checks.alignment.passed).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Evidence Quality Assessment', () => {
    test('should assess evidence quality', () => {
      const reasoning = {
        explanation: 'Action is needed',
        evidence: [
          'User explicitly requested this',
          'Documentation confirms approach',
          'Tests validate correctness'
        ]
      };

      const quality = verifier._assessEvidenceQuality(reasoning);

      expect(quality).toBeGreaterThan(0.7);
    });

    test('should penalize weak evidence', () => {
      const reasoning = {
        explanation: 'Action is needed',
        evidence: [
          'I think this is right',
          'Maybe this works'
        ]
      };

      const quality = verifier._assessEvidenceQuality(reasoning);

      expect(quality).toBeLessThan(0.5);
    });

    test('should penalize missing evidence', () => {
      const reasoning = {
        explanation: 'Action is needed',
        evidence: []
      };

      const quality = verifier._assessEvidenceQuality(reasoning);

      expect(quality).toBeLessThan(0.3);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null action gracefully', () => {
      expect(() => {
        verifier.verify(null, { explanation: 'test' }, {});
      }).not.toThrow();

      const result = verifier.verify(null, { explanation: 'test' }, {});
      expect(result.decision).toBe('BLOCK');
    });

    test('should handle null reasoning gracefully', () => {
      expect(() => {
        verifier.verify({ type: 'test' }, null, {});
      }).not.toThrow();

      const result = verifier.verify({ type: 'test' }, null, {});
      expect(result.decision).toBe('BLOCK');
    });

    test('should handle empty context gracefully', () => {
      const action = { type: 'test' };
      const reasoning = { explanation: 'test' };

      const result = verifier.verify(action, reasoning, {});

      expect(result).toBeDefined();
      expect(result.decision).toBeDefined();
    });
  });

  describe('Detailed Failure Analysis', () => {
    test('should provide detailed analysis for failed verifications', () => {
      const action = {
        type: 'risky_operation'
      };

      const reasoning = {
        explanation: 'unclear reasoning'
      };

      const result = verifier.verify(action, reasoning, {});

      expect(result.analysis).toBeDefined();
      expect(result.analysis.failed_checks).toBeDefined();
      expect(result.analysis.recommendations).toBeDefined();
    });

    test('should suggest improvements for low-confidence actions', () => {
      const action = {
        type: 'moderate_operation'
      };

      const reasoning = {
        explanation: 'Basic explanation',
        evidence: ['one piece of evidence']
      };

      const result = verifier.verify(action, reasoning, {});

      if (result.confidence < 0.7) {
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Singleton Pattern', () => {
    test('should export singleton instance with required methods', () => {
      expect(typeof verifier.verify).toBe('function');
      expect(typeof verifier.getStats).toBe('function');
    });

    test('should maintain verification history across calls', () => {
      verifier.verify({ type: 'test' }, { explanation: 'test' }, {});

      const stats = verifier.getStats();

      expect(stats.total_verifications).toBeDefined();
    });
  });

  describe('Statistics Tracking', () => {
    test('should track verification statistics', () => {
      const stats = verifier.getStats();

      expect(stats).toHaveProperty('total_verifications');
      expect(stats).toHaveProperty('by_decision');
      expect(stats).toHaveProperty('average_confidence');
    });

    test('should increment verification count after verify()', () => {
      const before = verifier.getStats().total_verifications;

      verifier.verify(
        { type: 'test' },
        { explanation: 'test' },
        {}
      );

      const after = verifier.getStats().total_verifications;

      expect(after).toBe(before + 1);
    });

    test('should track decision distribution', () => {
      verifier.verify(
        { type: 'safe', parameters: {} },
        { explanation: 'safe', evidence: ['good evidence'], steps: ['step 1'], alternatives_considered: ['alt'] },
        {}
      );

      verifier.verify(
        { type: 'unsafe' },
        { explanation: 'unclear' },
        {}
      );

      const stats = verifier.getStats();

      expect(stats.by_decision.PROCEED + stats.by_decision.BLOCK + stats.by_decision.REQUEST_CONFIRMATION + stats.by_decision.REQUEST_CLARIFICATION).toBeGreaterThan(0);
    });

    test('should calculate average confidence over time', () => {
      verifier.verify({ type: 'test1' }, { explanation: 'good', evidence: ['a', 'b'], steps: ['1'], alternatives_considered: ['x'] }, {});
      verifier.verify({ type: 'test2' }, { explanation: 'poor' }, {});

      const stats = verifier.getStats();

      expect(stats.average_confidence).toBeGreaterThan(0);
      expect(stats.average_confidence).toBeLessThan(1);
    });
  });

  describe('Reasoning Quality Metrics', () => {
    test('should score high-quality reasoning highly', () => {
      const reasoning = {
        explanation: 'Detailed explanation with clear reasoning about why this action is needed and how it aligns with user intent',
        evidence: [
          'User explicitly requested this action',
          'Documentation supports this approach',
          'Previous similar actions succeeded'
        ],
        steps: [
          'Validate preconditions',
          'Execute action',
          'Verify results',
          'Report completion'
        ],
        alternatives_considered: [
          'Alternative A: rejected because X',
          'Alternative B: rejected because Y',
          'Chosen approach: best because Z'
        ]
      };

      const score = verifier._assessReasoningQuality(reasoning);

      expect(score).toBeGreaterThan(0.8);
    });

    test('should score low-quality reasoning poorly', () => {
      const reasoning = {
        explanation: 'Do it',
        evidence: [],
        steps: []
      };

      const score = verifier._assessReasoningQuality(reasoning);

      expect(score).toBeLessThan(0.3);
    });
  });

  describe('Context-Aware Verification', () => {
    test('should consider recent errors in verification', () => {
      const action = { type: 'database_operation' };
      const reasoning = { explanation: 'database op' };

      const errorContext = {
        errors_recent: 5,
        last_error_type: 'database_connection'
      };

      const result = verifier.verify(action, reasoning, errorContext);

      // Should be more cautious after errors
      expect(result.confidence_adjustment).toBeLessThan(1.0);
    });

    test('should consider conversation length in verification', () => {
      const action = { type: 'operation' };
      const reasoning = { explanation: 'do operation' };

      const longConversation = {
        conversation_length: 100
      };

      const result = verifier.verify(action, reasoning, longConversation);

      // Long conversations should increase scrutiny
      expect(result.confidence_adjustment).toBeLessThan(1.0);
    });
  });
});
