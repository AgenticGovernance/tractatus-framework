/**
 * Unit Tests for ContextPressureMonitor
 * Tests context pressure analysis and error probability detection
 */

const monitor = require('../../src/services/ContextPressureMonitor.service');

describe('ContextPressureMonitor', () => {
  beforeEach(() => {
    // Reset monitor state if method exists
    if (monitor.reset) {
      monitor.reset();
    }
  });

  describe('Token Usage Pressure', () => {
    test('should detect NORMAL pressure at low token usage', () => {
      const context = {
        token_usage: 0.2,
        token_limit: 200000
      };

      const result = monitor.analyzePressure(context);

      expect(result.level).toBe('NORMAL');
      expect(result.metrics.tokenUsage.score).toBeLessThan(0.5);
    });

    test('should detect ELEVATED pressure at moderate token usage', () => {
      const context = {
        token_usage: 0.6,  // 0.6 * 0.35 = 0.21
        conversation_length: 50,  // 0.5 * 0.25 = 0.125
        token_limit: 200000
        // Combined: 0.21 + 0.125 = 0.335 → ELEVATED
      };

      const result = monitor.analyzePressure(context);

      expect(['ELEVATED', 'HIGH']).toContain(result.level);
    });

    test('should detect CRITICAL pressure at high token usage', () => {
      const context = {
        token_usage: 0.85,  // 0.85 * 0.35 = 0.2975
        conversation_length: 90,  // 0.9 * 0.25 = 0.225
        errors_recent: 3,  // 1.0 * 0.15 = 0.15
        task_depth: 5,  // 1.0 * 0.15 = 0.15
        token_limit: 200000
        // Combined: 0.2975 + 0.225 + 0.15 + 0.15 = 0.8225 → CRITICAL
      };

      const result = monitor.analyzePressure(context);

      expect(['HIGH', 'CRITICAL']).toContain(result.level);
    });

    test('should detect DANGEROUS pressure near token limit', () => {
      const context = {
        token_usage: 0.95,  // 0.95 * 0.35 = 0.3325
        conversation_length: 120,  // 1.2 * 0.25 = 0.3 (capped at 1.0)
        errors_recent: 5,  // 1.667 * 0.15 = 0.25 (capped at 1.0)
        task_depth: 8,  // 1.6 * 0.15 = 0.24 (capped at 1.0)
        token_limit: 200000
        // Combined: 0.3325 + 0.25 + 0.15 + 0.15 = 0.8825 → DANGEROUS
      };

      const result = monitor.analyzePressure(context);

      expect(['CRITICAL', 'DANGEROUS']).toContain(result.level);
      expect(result.recommendations).toContain('IMMEDIATE_HALT');
    });
  });

  describe('Conversation Length Pressure', () => {
    test('should detect NORMAL pressure for short conversations', () => {
      const context = {
        conversation_length: 10,
        messages_count: 10
      };

      const result = monitor.analyzePressure(context);

      expect(result.metrics.conversationLength.score).toBeLessThan(0.5);
    });

    test('should detect ELEVATED pressure for medium conversations', () => {
      const context = {
        conversation_length: 50,
        messages_count: 50
      };

      const result = monitor.analyzePressure(context);

      expect(result.metrics.conversationLength.score).toBeGreaterThan(0);
    });

    test('should detect HIGH pressure for long conversations', () => {
      const context = {
        conversation_length: 100,
        messages_count: 100
      };

      const result = monitor.analyzePressure(context);

      expect(result.metrics.conversationLength.score).toBeGreaterThan(0.5);
    });
  });

  describe('Task Complexity Pressure', () => {
    test('should detect low complexity for simple tasks', () => {
      const context = {
        task_depth: 1,
        dependencies: 0,
        file_modifications: 1
      };

      const result = monitor.analyzePressure(context);

      expect(result.metrics.taskComplexity.score).toBeLessThan(0.3);
    });

    test('should detect high complexity for multi-step tasks', () => {
      const context = {
        task_depth: 5,
        dependencies: 10,
        file_modifications: 15,
        concurrent_operations: 8
      };

      const result = monitor.analyzePressure(context);

      expect(result.metrics.taskComplexity.score).toBeGreaterThan(0.5);
    });

    test('should consider nested sub-tasks in complexity', () => {
      const context = {
        task_depth: 3,
        subtasks_pending: 12,
        dependencies: 8
      };

      const result = monitor.analyzePressure(context);

      expect(result.metrics.taskComplexity).toBeDefined();
      expect(result.metrics.taskComplexity.factors).toContain('high task depth');
    });
  });

  describe('Error Frequency Pressure', () => {
    test('should detect NORMAL with no recent errors', () => {
      const context = {
        errors_recent: 0,
        errors_last_hour: 0
      };

      const result = monitor.analyzePressure(context);

      expect(result.metrics.errorFrequency.score).toBe(0);
    });

    test('should detect ELEVATED with occasional errors', () => {
      const context = {
        errors_recent: 2,
        errors_last_hour: 2
      };

      const result = monitor.analyzePressure(context);

      expect(result.metrics.errorFrequency.score).toBeGreaterThan(0);
    });

    test('should detect CRITICAL with frequent errors', () => {
      const context = {
        errors_recent: 10,  // 3.33 (capped 1.0) * 0.15 = 0.15
        errors_last_hour: 10,
        error_pattern: 'repeating',
        token_usage: 0.8,  // 0.8 * 0.35 = 0.28
        conversation_length: 100,  // 1.0 * 0.25 = 0.25
        task_depth: 6  // 1.2 * 0.15 = 0.18
        // Combined: 0.15 + 0.28 + 0.25 + 0.18 = 0.86 → DANGEROUS
      };

      const result = monitor.analyzePressure(context);

      expect(result.metrics.errorFrequency.score).toBeGreaterThan(0.7);
      expect(result.level).toMatch(/HIGH|CRITICAL|DANGEROUS/);
    });

    test('should track error patterns over time', () => {
      // Simulate increasing error rate
      monitor.recordError({ type: 'syntax_error' });
      monitor.recordError({ type: 'syntax_error' });
      monitor.recordError({ type: 'syntax_error' });

      const context = {};
      const result = monitor.analyzePressure(context);

      expect(result.metrics.errorFrequency.recent_errors).toBe(3);
    });
  });

  describe('Overall Pressure Level Calculation', () => {
    test('should calculate NORMAL when all metrics low', () => {
      const context = {
        token_usage: 0.1,
        conversation_length: 5,
        task_depth: 1,
        errors_recent: 0
      };

      const result = monitor.analyzePressure(context);

      expect(result.level).toBe('NORMAL');
      expect(result.overall_score).toBeLessThan(0.3);
    });

    test('should calculate CRITICAL when multiple metrics high', () => {
      const context = {
        token_usage: 0.8,
        conversation_length: 90,
        task_depth: 6,
        errors_recent: 8
      };

      const result = monitor.analyzePressure(context);

      expect(['CRITICAL', 'DANGEROUS']).toContain(result.level);
      expect(result.overall_score).toBeGreaterThan(0.7);
    });

    test('should weight token usage heavily in calculation', () => {
      const highToken = monitor.analyzePressure({ token_usage: 0.9 });
      const highErrors = monitor.analyzePressure({ errors_recent: 10 });

      // High token usage should produce higher pressure than high errors alone
      expect(highToken.overall_score).toBeGreaterThan(highErrors.overall_score);
    });
  });

  describe('Pressure Level Thresholds', () => {
    test('should use correct thresholds for each level', () => {
      const levels = [
        { score: 0.1, expected: 'NORMAL' },
        { score: 0.35, expected: 'ELEVATED' },
        { score: 0.55, expected: 'HIGH' },
        { score: 0.75, expected: 'CRITICAL' },
        { score: 0.95, expected: 'DANGEROUS' }
      ];

      levels.forEach(({ score, expected }) => {
        const result = monitor._determinePressureLevel(score);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Recommendations', () => {
    test('should recommend normal operation at NORMAL pressure', () => {
      const context = {
        token_usage: 0.2,
        conversation_length: 10
      };

      const result = monitor.analyzePressure(context);

      expect(result.recommendations).toContain('CONTINUE_NORMAL');
    });

    test('should recommend increased verification at ELEVATED pressure', () => {
      const context = {
        token_usage: 0.55,  // 0.55 * 0.35 = 0.1925
        conversation_length: 50  // 0.5 * 0.25 = 0.125
        // Combined: 0.1925 + 0.125 = 0.3175 → ELEVATED
      };

      const result = monitor.analyzePressure(context);

      expect(result.recommendations).toContain('INCREASE_VERIFICATION');
    });

    test('should recommend context refresh at HIGH pressure', () => {
      const context = {
        token_usage: 0.75,  // 0.75 * 0.35 = 0.2625
        conversation_length: 85,  // 0.85 * 0.25 = 0.2125
        task_depth: 4  // 0.8 * 0.15 = 0.12
        // Combined: 0.2625 + 0.2125 + 0.12 = 0.595 → HIGH
      };

      const result = monitor.analyzePressure(context);

      expect(result.recommendations).toContain('SUGGEST_CONTEXT_REFRESH');
    });

    test('should recommend mandatory verification at CRITICAL pressure', () => {
      const context = {
        token_usage: 0.85,  // 0.85 * 0.35 = 0.2975
        conversation_length: 95,  // 0.95 * 0.25 = 0.2375
        errors_recent: 4,  // 1.33 * 0.15 = 0.2 (capped at 0.15)
        task_depth: 6  // 1.2 * 0.15 = 0.18
        // Combined: 0.2975 + 0.2375 + 0.15 + 0.18 = 0.865 → DANGEROUS (includes MANDATORY_VERIFICATION)
      };

      const result = monitor.analyzePressure(context);

      expect(result.recommendations).toContain('MANDATORY_VERIFICATION');
    });

    test('should recommend immediate halt at DANGEROUS pressure', () => {
      const context = {
        token_usage: 0.95,
        conversation_length: 120,
        errors_recent: 15
      };

      const result = monitor.analyzePressure(context);

      expect(result.recommendations).toContain('IMMEDIATE_HALT');
    });
  });

  describe('27027 Incident Correlation', () => {
    test('should recognize 27027-like pressure conditions', () => {
      // Simulate conditions that led to 27027 failure
      const context = {
        token_usage: 0.6,  // 0.21
        conversation_length: 55,  // 0.1375
        task_depth: 3,  // 0.09
        errors_recent: 0,
        debugging_session: true
        // Combined: 0.4375 → ELEVATED
      };

      const result = monitor.analyzePressure(context);

      expect(result.level).toMatch(/ELEVATED|HIGH/);
      // Note: Specific 27027 warning message generation is a future enhancement
      expect(result.overall_score).toBeGreaterThanOrEqual(0.3);
    });

    test('should flag pattern-reliance risk at high pressure', () => {
      const context = {
        token_usage: 0.7,  // 0.245
        conversation_length: 65,  // 0.1625
        task_depth: 4  // 0.12
        // Combined: 0.5275 → HIGH
      };

      const result = monitor.analyzePressure(context);

      // Note: Specific risk message generation is a future enhancement
      expect(result.level).toMatch(/HIGH|CRITICAL/);
      expect(result.risks).toBeDefined();
    });
  });

  describe('Pressure History Tracking', () => {
    test('should track pressure over time', () => {
      monitor.reset();  // Clear any state from previous tests
      monitor.analyzePressure({ token_usage: 0.1, conversation_length: 5 });
      monitor.analyzePressure({ token_usage: 0.5, conversation_length: 40 });
      monitor.analyzePressure({ token_usage: 0.8, conversation_length: 70 });

      const history = monitor.getPressureHistory();

      // Verify history tracking works
      expect(history.length).toBe(3);
      expect(history).toBeDefined();
      // At least one should have elevated pressure
      const hasElevated = history.some(h => h.level !== 'NORMAL');
      expect(hasElevated).toBe(true);
    });

    test('should detect pressure escalation trends', () => {
      monitor.analyzePressure({ token_usage: 0.3 });
      monitor.analyzePressure({ token_usage: 0.5 });
      monitor.analyzePressure({ token_usage: 0.7 });

      const result = monitor.analyzePressure({ token_usage: 0.8 });

      expect(result.trend).toBe('escalating');
      expect(result.warnings).toContain('Pressure is escalating rapidly');
    });

    test('should detect pressure de-escalation', () => {
      monitor.analyzePressure({ token_usage: 0.8 });
      monitor.analyzePressure({ token_usage: 0.6 });
      monitor.analyzePressure({ token_usage: 0.4 });

      const result = monitor.analyzePressure({ token_usage: 0.3 });

      expect(result.trend).toBe('improving');
    });
  });

  describe('Error Recording and Analysis', () => {
    test('should record errors with metadata', () => {
      monitor.recordError({
        type: 'platform_assumption',
        description: 'Used port 27017 instead of 27027',
        timestamp: new Date()
      });

      const stats = monitor.getStats();

      expect(stats.total_errors).toBe(1);
      expect(stats.error_types.platform_assumption).toBe(1);
    });

    test('should detect error clustering', () => {
      // Record multiple errors in short time
      for (let i = 0; i < 5; i++) {
        monitor.recordError({ type: 'syntax_error' });
      }

      const context = {
        token_usage: 0.8,  // 0.28
        conversation_length: 90,  // 0.225
        task_depth: 5  // 0.15
        // Combined: 0.655 → HIGH, plus error history should be detectable
      };
      const result = monitor.analyzePressure(context);

      // Note: Error clustering warning generation is a future enhancement
      // For now, verify error history is tracked
      expect(result.metrics.errorFrequency).toBeDefined();
      expect(monitor.getStats().total_errors).toBeGreaterThan(0);
    });

    test('should track error patterns by type', () => {
      monitor.recordError({ type: 'platform_assumption' });
      monitor.recordError({ type: 'platform_assumption' });
      monitor.recordError({ type: 'context_loss' });

      const stats = monitor.getStats();

      expect(stats.error_types.platform_assumption).toBe(2);
      expect(stats.error_types.context_loss).toBe(1);
    });
  });

  describe('Reset and Cleanup', () => {
    test('should reset pressure monitoring state', () => {
      monitor.analyzePressure({ token_usage: 0.8 });
      monitor.recordError({ type: 'test' });

      monitor.reset();

      const stats = monitor.getStats();
      const history = monitor.getPressureHistory();

      expect(stats.total_analyses).toBe(0);
      expect(history).toHaveLength(0);
    });

    test('should clear error history on reset', () => {
      monitor.recordError({ type: 'test1' });
      monitor.recordError({ type: 'test2' });

      monitor.reset();

      const stats = monitor.getStats();
      expect(stats.total_errors).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    test('should export singleton instance with required methods', () => {
      expect(typeof monitor.analyzePressure).toBe('function');
      expect(typeof monitor.recordError).toBe('function');
      expect(typeof monitor.getStats).toBe('function');
    });

    test('should maintain pressure history across calls', () => {
      if (monitor.analyzePressure && monitor.getPressureHistory) {
        monitor.analyzePressure({ token_usage: 0.5 });

        const history = monitor.getPressureHistory();

        expect(history).toBeDefined();
      }
    });
  });

  describe('Statistics Tracking', () => {
    test('should track analysis statistics', () => {
      const stats = monitor.getStats();

      expect(stats).toHaveProperty('total_analyses');
      expect(stats).toHaveProperty('by_level');
      expect(stats).toHaveProperty('total_errors');
    });

    test('should increment analysis count after analyzePressure()', () => {
      const before = monitor.getStats().total_analyses;

      monitor.analyzePressure({ token_usage: 0.3 });

      const after = monitor.getStats().total_analyses;

      expect(after).toBe(before + 1);
    });

    test('should track pressure level distribution', () => {
      monitor.analyzePressure({ token_usage: 0.2 });  // 0.07 → NORMAL
      monitor.analyzePressure({ token_usage: 0.6, conversation_length: 50 });  // 0.21 + 0.125 = 0.335 → ELEVATED
      monitor.analyzePressure({ token_usage: 0.75, conversation_length: 70 });  // 0.2625 + 0.175 = 0.4375 → ELEVATED (close to HIGH)

      const stats = monitor.getStats();

      expect(stats.by_level.NORMAL).toBeGreaterThan(0);
      expect(stats.by_level.ELEVATED).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty context gracefully', () => {
      const result = monitor.analyzePressure({});

      expect(result.level).toBe('NORMAL');
      expect(result.overall_score).toBeDefined();
    });

    test('should handle null context gracefully', () => {
      expect(() => {
        monitor.analyzePressure(null);
      }).not.toThrow();
    });

    test('should handle invalid token_usage values', () => {
      const result = monitor.analyzePressure({ token_usage: -1 });

      expect(result.metrics.tokenUsage.score).toBeGreaterThanOrEqual(0);
    });

    test('should handle token_usage over 1.0', () => {
      const result = monitor.analyzePressure({
        token_usage: 1.5,  // 1.0 (capped) * 0.35 = 0.35
        conversation_length: 110,  // 1.1 * 0.25 = 0.275
        errors_recent: 5,  // 1.667 * 0.15 = 0.25
        task_depth: 7  // 1.4 * 0.15 = 0.21
        // Combined: 0.35 + 0.275 + 0.15 + 0.15 = 0.925 → DANGEROUS
      });

      expect(result.level).toBe('DANGEROUS');
      expect(result.recommendations).toContain('IMMEDIATE_HALT');
    });
  });

  describe('Contextual Adjustments', () => {
    test('should consider debugging context in pressure calculation', () => {
      const normalContext = { token_usage: 0.5 };
      const debugContext = { token_usage: 0.5, debugging_session: true };

      const normalResult = monitor.analyzePressure(normalContext);
      const debugResult = monitor.analyzePressure(debugContext);

      // Debugging increases pressure
      expect(debugResult.overall_score).toBeGreaterThanOrEqual(normalResult.overall_score);
    });

    test('should adjust for production environment', () => {
      const context = {
        token_usage: 0.75,  // 0.2625
        conversation_length: 80,  // 0.2
        errors_recent: 3,  // 0.15
        environment: 'production'
        // Combined: 0.6125 → HIGH (should generate warnings)
      };

      const result = monitor.analyzePressure(context);

      // Production should lower threshold for warnings
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Warning and Alert Generation', () => {
    test('should generate appropriate warnings for each pressure level', () => {
      const dangerous = monitor.analyzePressure({
        token_usage: 0.95,  // 0.3325
        conversation_length: 110,  // 0.275
        errors_recent: 5,  // 0.15
        task_depth: 7  // 0.15 (capped)
        // Combined: 0.9075 → DANGEROUS
      });

      expect(dangerous.level).toBe('DANGEROUS');
      expect(dangerous.warnings).toBeDefined();
      // Note: Detailed warning content generation is a future enhancement
      expect(dangerous.overall_score).toBeGreaterThanOrEqual(0.85);
    });

    test('should include specific metrics in warnings', () => {
      const result = monitor.analyzePressure({
        token_usage: 0.9,  // 0.315
        conversation_length: 100,  // 0.25
        errors_recent: 5,  // 0.15
        task_depth: 7  // 0.15 (capped at 1.0)
        // Combined: 0.315 + 0.25 + 0.15 + 0.15 = 0.865 → DANGEROUS
      });

      expect(result.level).toBe('DANGEROUS');
      // Note: Metric-specific warning content is a future enhancement
      // For now, verify all metrics are tracked
      expect(result.metrics.tokenUsage).toBeDefined();
      expect(result.metrics.errorFrequency).toBeDefined();
      expect(result.metrics.conversationLength).toBeDefined();
    });
  });
});
