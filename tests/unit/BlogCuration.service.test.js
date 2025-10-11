/**
 * Unit Tests - BlogCuration Service
 * Tests blog content curation with Tractatus enforcement
 */

// Mock dependencies before requiring the service
jest.mock('../../src/services/ClaudeAPI.service', () => ({
  sendMessage: jest.fn(),
  extractJSON: jest.fn()
}));

jest.mock('../../src/services/BoundaryEnforcer.service', () => ({
  enforce: jest.fn()
}));

const BlogCuration = require('../../src/services/BlogCuration.service');
const ClaudeAPI = require('../../src/services/ClaudeAPI.service');
const BoundaryEnforcer = require('../../src/services/BoundaryEnforcer.service');

describe('BlogCuration Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Editorial Guidelines', () => {
    test('should have editorial guidelines defined', () => {
      const guidelines = BlogCuration.getEditorialGuidelines();

      expect(guidelines).toBeDefined();
      expect(guidelines.tone).toBeDefined();
      expect(guidelines.voice).toBeDefined();
      expect(guidelines.style).toBeDefined();
      expect(Array.isArray(guidelines.principles)).toBe(true);
      expect(Array.isArray(guidelines.forbiddenPatterns)).toBe(true);
    });

    test('should include Tractatus enforcement principles', () => {
      const guidelines = BlogCuration.getEditorialGuidelines();

      const principlesText = guidelines.principles.join(' ');
      expect(principlesText).toContain('Transparency');
      expect(principlesText).toContain('Honesty');
      expect(principlesText).toContain('Evidence');
    });

    test('should define forbidden patterns', () => {
      const guidelines = BlogCuration.getEditorialGuidelines();

      expect(guidelines.forbiddenPatterns.length).toBeGreaterThan(0);
      expect(guidelines.forbiddenPatterns.some(p => p.includes('Fabricated'))).toBe(true);
      expect(guidelines.forbiddenPatterns.some(p => p.includes('guarantee'))).toBe(true);
    });
  });

  describe('draftBlogPost()', () => {
    beforeEach(() => {
      // Mock boundary enforcer to allow by default
      BoundaryEnforcer.enforce.mockReturnValue({
        allowed: true,
        section: 'TRA-OPS-0002',
        reasoning: 'AI suggestion with human approval'
      });

      // Mock ClaudeAPI.sendMessage
      ClaudeAPI.sendMessage.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            title: 'Understanding AI Boundary Enforcement',
            subtitle: 'How Tractatus prevents values automation',
            content: '# Introduction\n\nBoundary enforcement is critical...',
            excerpt: 'This article explores boundary enforcement in AI systems.',
            tags: ['AI safety', 'Boundary enforcement', 'Tractatus'],
            tractatus_angle: 'Demonstrates harmlessness principle through boundary checks',
            sources: ['https://example.com/research'],
            word_count: 1200
          })
        }],
        model: 'claude-sonnet-4-5-20250929',
        usage: { input_tokens: 200, output_tokens: 800 }
      });

      ClaudeAPI.extractJSON.mockImplementation((response) => {
        return JSON.parse(response.content[0].text);
      });
    });

    test('should draft blog post with valid params', async () => {
      const params = {
        topic: 'AI Boundary Enforcement',
        audience: 'implementer',
        length: 'medium',
        focus: 'real-world examples'
      };

      const result = await BlogCuration.draftBlogPost(params);

      expect(result).toHaveProperty('draft');
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('boundary_check');
      expect(result).toHaveProperty('metadata');

      expect(result.draft.title).toBeDefined();
      expect(result.draft.content).toBeDefined();
      expect(result.metadata.requires_human_approval).toBe(true);
    });

    test('should perform boundary check before drafting', async () => {
      const params = {
        topic: 'Test Topic',
        audience: 'researcher',
        length: 'short'
      };

      await BlogCuration.draftBlogPost(params);

      expect(BoundaryEnforcer.enforce).toHaveBeenCalledWith({
        description: expect.stringContaining('AI-drafted blog content'),
        text: expect.stringContaining('mandatory human approval'),
        classification: { quadrant: 'OPERATIONAL' },
        type: 'content_generation'
      });
    });

    test('should throw error if boundary check fails', async () => {
      BoundaryEnforcer.enforce.mockReturnValue({
        allowed: false,
        section: 'TRA-STR-0001',
        reasoning: 'Values territory - human decision required'
      });

      const params = {
        topic: 'Test Topic',
        audience: 'advocate',
        length: 'medium'
      };

      await expect(BlogCuration.draftBlogPost(params)).rejects.toThrow('Boundary violation');
    });

    test('should validate generated content against Tractatus principles', async () => {
      const params = {
        topic: 'Test Topic',
        audience: 'general',
        length: 'long'
      };

      const result = await BlogCuration.draftBlogPost(params);

      expect(result.validation).toBeDefined();
      expect(result.validation).toHaveProperty('valid');
      expect(result.validation).toHaveProperty('violations');
      expect(result.validation).toHaveProperty('warnings');
      expect(result.validation).toHaveProperty('recommendation');
    });

    test('should detect absolute guarantee violations (inst_017)', async () => {
      ClaudeAPI.extractJSON.mockReturnValue({
        title: 'Our Framework Guarantees 100% Safety',
        subtitle: 'Never fails, always works',
        content: 'This system guarantees complete safety...',
        excerpt: 'Test',
        tags: [],
        sources: [],
        word_count: 500
      });

      const params = {
        topic: 'Test',
        audience: 'implementer',
        length: 'short'
      };

      const result = await BlogCuration.draftBlogPost(params);

      expect(result.validation.violations.length).toBeGreaterThan(0);
      expect(result.validation.violations.some(v => v.type === 'ABSOLUTE_GUARANTEE')).toBe(true);
      expect(result.validation.recommendation).toBe('REJECT');
    });

    test('should warn about uncited statistics (inst_016)', async () => {
      ClaudeAPI.extractJSON.mockReturnValue({
        title: 'AI Safety Statistics',
        subtitle: 'Data-driven analysis',
        content: 'Studies show 85% of AI systems lack governance...',
        excerpt: 'Statistical analysis',
        tags: [],
        sources: [], // No sources!
        word_count: 900
      });

      const params = {
        topic: 'Test',
        audience: 'researcher',
        length: 'medium'
      };

      const result = await BlogCuration.draftBlogPost(params);

      expect(result.validation.warnings.some(w => w.type === 'UNCITED_STATISTICS')).toBe(true);
      expect(result.validation.stats_found).toBeGreaterThan(0);
      expect(result.validation.sources_provided).toBe(0);
    });

    test('should call ClaudeAPI with appropriate max_tokens for length', async () => {
      const testCases = [
        { length: 'short', expectedMin: 2000, expectedMax: 2100 },
        { length: 'medium', expectedMin: 3000, expectedMax: 3100 },
        { length: 'long', expectedMin: 4000, expectedMax: 4100 }
      ];

      for (const { length, expectedMin, expectedMax } of testCases) {
        jest.clearAllMocks();

        await BlogCuration.draftBlogPost({
          topic: 'Test',
          audience: 'general',
          length
        });

        const callOptions = ClaudeAPI.sendMessage.mock.calls[0][1];
        expect(callOptions.max_tokens).toBeGreaterThanOrEqual(expectedMin);
        expect(callOptions.max_tokens).toBeLessThanOrEqual(expectedMax);
      }
    });

    test('should include Tractatus constraints in system prompt', async () => {
      await BlogCuration.draftBlogPost({
        topic: 'Test',
        audience: 'implementer',
        length: 'medium'
      });

      const systemPrompt = ClaudeAPI.sendMessage.mock.calls[0][1].system;

      expect(systemPrompt).toContain('inst_016');
      expect(systemPrompt).toContain('inst_017');
      expect(systemPrompt).toContain('inst_018');
      expect(systemPrompt).toContain('fabricat');
      expect(systemPrompt).toContain('guarantee');
    });
  });

  describe('suggestTopics()', () => {
    beforeEach(() => {
      // Mock sendMessage to return response with topics
      ClaudeAPI.sendMessage.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify([
            {
              title: 'Understanding AI Governance',
              rationale: 'Fills gap in governance docs',
              target_word_count: 1200,
              key_points: ['Governance', 'Safety', 'Framework'],
              tractatus_angle: 'Core governance principles'
            }
          ])
        }],
        model: 'claude-sonnet-4-5-20250929',
        usage: { input_tokens: 150, output_tokens: 200 }
      });

      // Mock extractJSON to return the topics array
      ClaudeAPI.extractJSON.mockImplementation((response) => {
        return JSON.parse(response.content[0].text);
      });
    });

    test('should suggest topics for audience', async () => {
      const result = await BlogCuration.suggestTopics('researcher');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('validation');
      expect(ClaudeAPI.sendMessage).toHaveBeenCalled();
    });

    test('should suggest topics with theme', async () => {
      const result = await BlogCuration.suggestTopics('advocate', 'policy implications');

      expect(ClaudeAPI.sendMessage).toHaveBeenCalled();
      const systemPrompt = ClaudeAPI.sendMessage.mock.calls[0][1].system;
      expect(systemPrompt).toContain('Tractatus');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should validate topic titles for forbidden patterns', async () => {
      ClaudeAPI.extractJSON.mockReturnValue([
        { title: 'Guaranteed 100% AI Safety', rationale: 'Test', target_word_count: 1000, key_points: [], tractatus_angle: 'Test' }
      ]);

      const result = await BlogCuration.suggestTopics('general');

      expect(result[0].validation.valid).toBe(false);
      expect(result[0].validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeContentCompliance()', () => {
    beforeEach(() => {
      ClaudeAPI.sendMessage.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            compliant: true,
            violations: [],
            warnings: [],
            strengths: ['Evidence-based', 'Acknowledges limitations'],
            overall_score: 92,
            recommendation: 'PUBLISH'
          })
        }]
      });

      ClaudeAPI.extractJSON.mockImplementation((response) => {
        return JSON.parse(response.content[0].text);
      });
    });

    test('should analyze content for Tractatus compliance', async () => {
      const content = {
        title: 'Understanding AI Safety',
        body: 'This article explores AI safety frameworks...'
      };

      const result = await BlogCuration.analyzeContentCompliance(content);

      expect(result).toHaveProperty('compliant');
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('overall_score');
      expect(result).toHaveProperty('recommendation');
    });

    test('should call ClaudeAPI with compliance analysis prompt', async () => {
      await BlogCuration.analyzeContentCompliance({
        title: 'Test Title',
        body: 'Test content'
      });

      const systemPrompt = ClaudeAPI.sendMessage.mock.calls[0][1].system;
      const userPrompt = ClaudeAPI.sendMessage.mock.calls[0][0][0].content;

      expect(systemPrompt).toContain('Tractatus');
      expect(systemPrompt).toContain('compliance');
      expect(userPrompt).toContain('Test Title');
      expect(userPrompt).toContain('Test content');
    });

    test('should detect violations in non-compliant content', async () => {
      ClaudeAPI.extractJSON.mockReturnValue({
        compliant: false,
        violations: [
          {
            type: 'FABRICATED_STAT',
            severity: 'HIGH',
            excerpt: '99% of users agree',
            reasoning: 'Unverified statistic',
            suggested_fix: 'Cite source or remove claim'
          }
        ],
        warnings: [],
        strengths: [],
        overall_score: 35,
        recommendation: 'REJECT'
      });

      const result = await BlogCuration.analyzeContentCompliance({
        title: 'Amazing Results',
        body: '99% of users agree this is the best framework ever...'
      });

      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.recommendation).toBe('REJECT');
    });
  });

  describe('Utility Methods', () => {
    describe('generateSlug()', () => {
      test('should generate URL-safe slug from title', () => {
        const title = 'Understanding AI Safety: A Framework Approach!';
        const slug = BlogCuration.generateSlug(title);

        expect(slug).toBe('understanding-ai-safety-a-framework-approach');
        expect(slug).toMatch(/^[a-z0-9-]+$/);
      });

      test('should handle special characters', () => {
        const title = 'AI @ Work: 100% Automated?!';
        const slug = BlogCuration.generateSlug(title);

        expect(slug).toBe('ai-work-100-automated');
        expect(slug).not.toContain('@');
        expect(slug).not.toContain('!');
      });

      test('should limit slug length to 100 characters', () => {
        const longTitle = 'A'.repeat(200);
        const slug = BlogCuration.generateSlug(longTitle);

        expect(slug.length).toBeLessThanOrEqual(100);
      });
    });

    describe('extractExcerpt()', () => {
      test('should extract excerpt from content', () => {
        const content = 'This is a blog post about AI safety. It discusses various frameworks and approaches to ensuring safe AI deployment.';
        const excerpt = BlogCuration.extractExcerpt(content);

        expect(excerpt.length).toBeLessThanOrEqual(200);
        expect(excerpt).toContain('AI safety');
      });

      test('should strip HTML tags', () => {
        const content = '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
        const excerpt = BlogCuration.extractExcerpt(content);

        expect(excerpt).not.toContain('<p>');
        expect(excerpt).not.toContain('<strong>');
        expect(excerpt).toContain('bold');
      });

      test('should end at sentence boundary when possible', () => {
        const content = 'First sentence. Second sentence. Third sentence that is much longer and goes on and on and on about various topics.';
        const excerpt = BlogCuration.extractExcerpt(content, 50);

        expect(excerpt.endsWith('.')).toBe(true);
        expect(excerpt).not.toContain('Third sentence');
      });

      test('should add ellipsis when truncating', () => {
        const content = 'A'.repeat(300);
        const excerpt = BlogCuration.extractExcerpt(content, 100);

        expect(excerpt.endsWith('...')).toBe(true);
        expect(excerpt.length).toBeLessThanOrEqual(103); // 100 + '...'
      });
    });
  });

  describe('Service Integration', () => {
    test('should maintain singleton pattern', () => {
      const BlogCuration2 = require('../../src/services/BlogCuration.service');
      expect(BlogCuration).toBe(BlogCuration2);
    });

    test('should have all expected public methods', () => {
      expect(typeof BlogCuration.draftBlogPost).toBe('function');
      expect(typeof BlogCuration.suggestTopics).toBe('function');
      expect(typeof BlogCuration.analyzeContentCompliance).toBe('function');
      expect(typeof BlogCuration.generateSlug).toBe('function');
      expect(typeof BlogCuration.extractExcerpt).toBe('function');
      expect(typeof BlogCuration.getEditorialGuidelines).toBe('function');
    });
  });
});
