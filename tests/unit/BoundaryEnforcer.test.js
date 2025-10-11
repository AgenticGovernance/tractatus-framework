/**
 * Unit Tests for BoundaryEnforcer
 * Tests Tractatus philosophical boundaries (12.1-12.7) enforcement
 */

const enforcer = require('../../src/services/BoundaryEnforcer.service');

describe('BoundaryEnforcer', () => {
  beforeEach(() => {
    // Enforcer is a singleton instance
  });

  describe('Tractatus 12.1 - Values Boundary', () => {
    test('should require human judgment for values decisions', () => {
      const decision = {
        type: 'values_change',
        description: 'Change privacy policy to prioritize convenience',
        domain: 'values'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(false);
      expect(result.human_required).toBe(true);
      expect(result.boundary).toBe('VALUES');
      expect(result.tractatus_section).toBe('12.1');
      expect(result.reason).toContain('Values cannot be automated');
    });

    test('should block AI from making values trade-offs', () => {
      const decision = {
        type: 'trade_off',
        description: 'Trade user privacy for performance',
        involves_values: true
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(false);
      expect(result.human_required).toBe(true);
    });

    test('should allow AI to verify alignment with existing values', () => {
      const decision = {
        type: 'verify_alignment',
        description: 'Check if action aligns with privacy values',
        domain: 'verification'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
      expect(result.human_required).toBe(false);
    });
  });

  describe('Tractatus 12.2 - Innovation Boundary', () => {
    test('should require human judgment for novel architectural decisions', () => {
      const decision = {
        type: 'architecture',
        description: 'Propose entirely new approach to authentication',
        novelty: 'high',
        domain: 'innovation'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(false);
      expect(result.human_required).toBe(true);
      expect(result.boundary).toBe('INNOVATION');
    });

    test('should allow AI to facilitate innovation within approved patterns', () => {
      const decision = {
        type: 'optimization',
        description: 'Optimize existing authentication flow',
        novelty: 'low'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Tractatus 12.3 - Wisdom Boundary', () => {
    test('should require human judgment for strategic direction changes', () => {
      const decision = {
        type: 'strategic_direction',
        description: 'Shift product focus to new market segment',
        domain: 'wisdom'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(false);
      expect(result.human_required).toBe(true);
      expect(result.boundary).toBe('WISDOM');
      expect(result.tractatus_section).toBe('12.3');
    });

    test('should allow AI to support wisdom with data analysis', () => {
      const decision = {
        type: 'data_analysis',
        description: 'Analyze market trends to inform strategy',
        domain: 'support'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Tractatus 12.4 - Purpose Boundary', () => {
    test('should require human judgment for defining project purpose', () => {
      const decision = {
        type: 'define_purpose',
        description: 'Define the core mission of the project',
        domain: 'purpose'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(false);
      expect(result.human_required).toBe(true);
      expect(result.boundary).toBe('PURPOSE');
    });

    test('should allow AI to preserve existing purpose in implementations', () => {
      const decision = {
        type: 'implementation',
        description: 'Implement feature according to stated purpose',
        domain: 'preservation'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Tractatus 12.5 - Meaning Boundary', () => {
    test('should require human judgment for determining significance', () => {
      const decision = {
        type: 'significance',
        description: 'Decide what makes this project meaningful',
        domain: 'meaning'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(false);
      expect(result.human_required).toBe(true);
      expect(result.boundary).toBe('MEANING');
    });

    test('should allow AI to recognize patterns related to meaning', () => {
      const decision = {
        type: 'pattern_recognition',
        description: 'Identify user engagement patterns',
        domain: 'recognition'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Tractatus 12.6 - Agency Boundary', () => {
    test('should require human judgment for decisions affecting human agency', () => {
      const decision = {
        type: 'agency_affecting',
        description: 'Automatically approve user requests',
        domain: 'agency',
        affects_human_choice: true
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(false);
      expect(result.human_required).toBe(true);
      expect(result.boundary).toBe('AGENCY');
      expect(result.tractatus_section).toBe('12.6');
    });

    test('should allow AI to respect human agency through notification', () => {
      const decision = {
        type: 'notify',
        description: 'Notify user of available options',
        respects_agency: true
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Boundary Detection', () => {
    test('should detect values-related keywords in decisions', () => {
      const decision = {
        description: 'Change our core values to prioritize speed'
      };

      const result = enforcer.enforce(decision);

      expect(result.human_required).toBe(true);
      expect(result.boundary).toBe('VALUES');
    });

    test('should detect wisdom-related keywords', () => {
      const decision = {
        description: 'Make strategic decision about company direction'
      };

      const result = enforcer.enforce(decision);

      expect(result.human_required).toBe(true);
      expect(['WISDOM', 'VALUES']).toContain(result.boundary);
    });

    test('should detect agency-affecting keywords', () => {
      const decision = {
        description: 'Remove user choice and automate approval'
      };

      const result = enforcer.enforce(decision);

      expect(result.human_required).toBe(true);
      expect(result.boundary).toBe('AGENCY');
    });
  });

  describe('Multi-Boundary Violations', () => {
    test('should detect when decision crosses multiple boundaries', () => {
      const decision = {
        type: 'major_change',
        description: 'Redefine project purpose and change core values',
        domain: ['purpose', 'values']
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(false);
      expect(result.human_required).toBe(true);
      expect(result.violated_boundaries.length).toBeGreaterThan(1);
    });

    test('should require most restrictive boundary when multiple apply', () => {
      const decision = {
        description: 'Strategic values decision affecting user agency'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(false);
      expect(result.human_required).toBe(true);
      expect(result.violated_boundaries.length).toBeGreaterThan(0);
    });
  });

  describe('Safe AI Operations', () => {
    test('should allow technical implementation decisions', () => {
      const decision = {
        type: 'technical',
        description: 'Optimize database query performance',
        domain: 'system'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
      expect(result.human_required).toBe(false);
    });

    test('should allow code generation within approved patterns', () => {
      const decision = {
        type: 'code_generation',
        description: 'Generate CRUD endpoints following existing patterns',
        domain: 'system'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
    });

    test('should allow data analysis and recommendations', () => {
      const decision = {
        type: 'analysis',
        description: 'Analyze logs and recommend optimizations',
        domain: 'support'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
    });

    test('should allow documentation improvements', () => {
      const decision = {
        type: 'documentation',
        description: 'Improve API documentation clarity',
        domain: 'support'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Boundary Enforcement with Context', () => {
    test('should consider user role in enforcement', () => {
      const decision = {
        type: 'values_change',
        description: 'Update privacy policy',
        domain: 'values'
      };

      const context = {
        user_role: 'admin',
        approval_status: 'approved'
      };

      const result = enforcer.enforce(decision, context);

      // Still requires human judgment, but context is noted
      expect(result.human_required).toBe(true);
      expect(result.context).toBeDefined();
    });

    test('should escalate dangerous operations regardless of context', () => {
      const decision = {
        type: 'values_change',
        description: 'Completely rewrite core values',
        domain: 'values'
      };

      const context = {
        pressure_level: 'CRITICAL'
      };

      const result = enforcer.enforce(decision, context);

      expect(result.allowed).toBe(false);
      expect(result.human_required).toBe(true);
      expect(result.escalation_required).toBe(true);
    });
  });

  describe('Boundary Explanations', () => {
    test('should provide clear explanation for VALUES boundary', () => {
      const decision = {
        domain: 'values',
        description: 'Change privacy settings'
      };

      const result = enforcer.enforce(decision);

      expect(result.reason).toContain('Values cannot be automated');
      expect(result.explanation).toBeDefined();
    });

    test('should provide Tractatus section reference', () => {
      const decision = {
        domain: 'agency',
        description: 'Remove user consent requirement'
      };

      const result = enforcer.enforce(decision);

      expect(result.tractatus_section).toBe('12.6');
      expect(result.principle).toContain('Agency cannot be simulated');
    });

    test('should suggest alternative approaches', () => {
      const decision = {
        domain: 'values',
        description: 'Automatically decide privacy policy'
      };

      const result = enforcer.enforce(decision);

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle decisions with no clear boundary', () => {
      const decision = {
        type: 'routine',
        description: 'Restart development server'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
      expect(result.boundary).toBeNull();
    });

    test('should handle null or undefined decision gracefully', () => {
      expect(() => {
        enforcer.enforce(null);
      }).not.toThrow();

      const result = enforcer.enforce(null);
      expect(result.allowed).toBe(false);
    });

    test('should handle decision with empty description', () => {
      const decision = {
        description: ''
      };

      const result = enforcer.enforce(decision);

      expect(result).toBeDefined();
    });
  });

  describe('Pre-approved Exceptions', () => {
    test('should allow pre-approved operations even if boundary-adjacent', () => {
      const decision = {
        domain: 'values',
        description: 'Verify compliance with stated values',
        pre_approved: true
      };

      const result = enforcer.enforce(decision);

      // Verification is allowed, modification is not
      expect(result.allowed).toBe(true);
    });

    test('should not allow modifications under pre-approval', () => {
      const decision = {
        domain: 'values',
        description: 'Modify core values',
        pre_approved: true
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(false);
      expect(result.human_required).toBe(true);
    });
  });

  describe('Audit Trail', () => {
    test('should create audit record for boundary violations', () => {
      const decision = {
        domain: 'values',
        description: 'Change security policy'
      };

      const result = enforcer.enforce(decision);

      expect(result.audit_record).toBeDefined();
      expect(result.audit_record.timestamp).toBeDefined();
      expect(result.audit_record.boundary_violated).toBe('VALUES');
    });

    test('should track all enforcement decisions', () => {
      enforcer.enforce({ type: 'test1' });
      enforcer.enforce({ type: 'test2' });

      const stats = enforcer.getStats();

      expect(stats.total_enforcements).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Integration with Classification', () => {
    test('should respect STRATEGIC quadrant as potential boundary violation', () => {
      const decision = {
        classification: {
          quadrant: 'STRATEGIC',
          persistence: 'HIGH'
        },
        description: 'Define long-term project direction'
      };

      const result = enforcer.enforce(decision);

      expect(result.human_required).toBe(true);
    });

    test('should allow SYSTEM and TACTICAL quadrants without boundary concerns', () => {
      const decision = {
        classification: {
          quadrant: 'SYSTEM',
          persistence: 'MEDIUM'
        },
        description: 'Optimize database indexes'
      };

      const result = enforcer.enforce(decision);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Singleton Pattern', () => {
    test('should export singleton instance with required methods', () => {
      expect(typeof enforcer.enforce).toBe('function');
      expect(typeof enforcer.getStats).toBe('function');
    });

    test('should maintain enforcement history across calls', () => {
      const beforeCount = enforcer.getStats().total_enforcements;

      enforcer.enforce({ type: 'test' });

      const afterCount = enforcer.getStats().total_enforcements;

      expect(afterCount).toBe(beforeCount + 1);
    });
  });

  describe('Statistics Tracking', () => {
    test('should track enforcement statistics', () => {
      const stats = enforcer.getStats();

      expect(stats).toHaveProperty('total_enforcements');
      expect(stats).toHaveProperty('boundaries_violated');
      expect(stats).toHaveProperty('human_required_count');
    });

    test('should track violations by boundary type', () => {
      enforcer.enforce({ domain: 'values', description: 'test1' });
      enforcer.enforce({ domain: 'agency', description: 'test2' });

      const stats = enforcer.getStats();

      expect(stats.by_boundary).toHaveProperty('VALUES');
      expect(stats.by_boundary).toHaveProperty('AGENCY');
    });

    test('should increment enforcement count after enforce()', () => {
      const before = enforcer.getStats().total_enforcements;

      enforcer.enforce({ type: 'test' });

      const after = enforcer.getStats().total_enforcements;

      expect(after).toBe(before + 1);
    });
  });

  describe('Safe Escalation Paths', () => {
    test('should provide escalation path for blocked decisions', () => {
      const decision = {
        domain: 'values',
        description: 'Redefine privacy policy',
        urgency: 'high'
      };

      const result = enforcer.enforce(decision);

      expect(result.escalation_path).toBeDefined();
      expect(result.escalation_path).toContain('human approval');
    });

    test('should suggest deferred execution for strategic decisions', () => {
      const decision = {
        classification: { quadrant: 'STRATEGIC' },
        description: 'Major architectural change'
      };

      const result = enforcer.enforce(decision);

      expect(result.suggested_action).toContain('defer');
    });
  });

  describe('inst_016-018: Content Validation (Honesty & Transparency)', () => {
    describe('inst_017: Absolute Guarantee Detection', () => {
      test('should block "guarantee" claims as VALUES violation', () => {
        const decision = {
          type: 'content_generation',
          description: 'This system guarantees 100% security for all users',
          classification: { quadrant: 'OPERATIONAL' }
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.human_required).toBe(true);
        expect(result.boundary).toBe('VALUES');
        expect(result.tractatus_section).toBe('inst_017');
        expect(result.principle).toContain('honesty requires evidence-based language');
      });

      test('should block "never fails" claims', () => {
        const decision = {
          description: 'Our framework never fails in production environments'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.violations[0].section).toBe('inst_017');
        expect(result.violations[0].violationType).toBe('ABSOLUTE_ASSURANCE');
      });

      test('should block "always works" claims', () => {
        const decision = {
          description: 'This solution always works and eliminates all errors'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.tractatus_section).toBe('inst_017');
      });

      test('should block "100% secure" claims', () => {
        const decision = {
          description: 'Platform provides 100% secure data protection'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.violations[0].violatedTerm).toContain('100%');
      });
    });

    describe('inst_016: Fabricated Statistics Detection', () => {
      test('should block percentage claims without sources', () => {
        const decision = {
          type: 'blog_post',
          description: 'Studies show 85% reduction in safety incidents',
          sources: []
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.human_required).toBe(true);
        expect(result.tractatus_section).toBe('inst_016');
        expect(result.violations[0].violationType).toBe('FABRICATED_STATISTIC');
      });

      test('should block ROI claims without sources', () => {
        const decision = {
          description: 'Implementation delivers 1315% ROI in first year'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.tractatus_section).toBe('inst_016');
      });

      test('should block dollar amount claims without sources', () => {
        const decision = {
          description: 'Save $3,770,000 annually with our framework'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.boundary).toBe('VALUES');
      });

      test('should block payback period claims without sources', () => {
        const decision = {
          description: 'Average payback period of 14 months'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.tractatus_section).toBe('inst_016');
      });

      test('should allow statistics with sources provided', () => {
        const decision = {
          description: 'Research shows 85% improvement in governance',
          sources: ['https://example.com/research-paper-2024']
        };

        const result = enforcer.enforce(decision);

        // Should NOT be blocked for statistics violation
        // May still be blocked for other reasons, but statistics violation should not appear
        if (!result.allowed) {
          const hasStatsViolation = result.violations?.some(v => v.section === 'inst_016');
          expect(hasStatsViolation).toBe(false);
        } else {
          expect(result.allowed).toBe(true);
        }
      });
    });

    describe('inst_018: Unverified Production Claims Detection', () => {
      test('should block "production-ready" without testing evidence', () => {
        const decision = {
          description: 'Our production-ready framework is ready for deployment'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.tractatus_section).toBe('inst_018');
        expect(result.violations[0].violationType).toBe('UNVERIFIED_PRODUCTION_CLAIM');
      });

      test('should block "battle-tested" without validation evidence', () => {
        const decision = {
          description: 'This battle-tested system has proven reliability'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.tractatus_section).toBe('inst_018');
      });

      test('should block "existing customers" without validation', () => {
        const decision = {
          description: 'Join our existing customers in enterprise AI governance'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.boundary).toBe('VALUES');
      });

      test('should allow production claims with testing evidence', () => {
        const decision = {
          description: 'Our production-ready framework has been validated',
          testing_evidence: 'comprehensive-test-report-2024.pdf'
        };

        const result = enforcer.enforce(decision);

        // Should NOT be blocked for inst_018 violation
        if (!result.allowed) {
          const hasProductionViolation = result.violations?.some(v => v.section === 'inst_018');
          expect(hasProductionViolation).toBe(false);
        } else {
          expect(result.allowed).toBe(true);
        }
      });

      test('should allow production claims with validation evidence', () => {
        const decision = {
          description: 'Validated through extensive field testing',
          validation_evidence: 'field-test-results.pdf'
        };

        const result = enforcer.enforce(decision);

        // Should NOT be blocked for inst_018 violation
        if (!result.allowed) {
          const hasProductionViolation = result.violations?.some(v => v.section === 'inst_018');
          expect(hasProductionViolation).toBe(false);
        } else {
          expect(result.allowed).toBe(true);
        }
      });
    });

    describe('Multiple Content Violations', () => {
      test('should detect first violation when multiple present', () => {
        const decision = {
          description: 'Guaranteed 100% success with 1500% ROI in battle-tested production deployment'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(false);
        expect(result.human_required).toBe(true);
        // Should detect at least the first violation (inst_017: guarantee)
        expect(result.tractatus_section).toBe('inst_017');
      });
    });

    describe('Content Without Violations', () => {
      test('should allow honest, evidence-based content', () => {
        const decision = {
          description: 'This framework helps teams implement AI governance with human oversight'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(true);
        expect(result.human_required).toBe(false);
      });

      test('should allow tentative language about capabilities', () => {
        const decision = {
          description: 'Initial experiments suggest possible performance optimizations'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(true);
      });

      test('should allow descriptive content without claims', () => {
        const decision = {
          description: 'The Tractatus framework provides a philosophical foundation for AI boundaries'
        };

        const result = enforcer.enforce(decision);

        expect(result.allowed).toBe(true);
      });
    });
  });
});
