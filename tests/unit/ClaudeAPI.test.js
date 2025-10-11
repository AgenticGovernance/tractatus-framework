/**
 * Unit Tests - ClaudeAPI Service
 * Tests AI service methods with mocked API responses
 */

const ClaudeAPI = require('../../src/services/ClaudeAPI.service');

describe('ClaudeAPI Service', () => {
  let originalApiKey;
  let originalMakeRequest;

  beforeAll(() => {
    // Store original API key
    originalApiKey = ClaudeAPI.apiKey;
    // Ensure API key is set for tests
    ClaudeAPI.apiKey = 'test_api_key';
    // Store original _makeRequest for restoration
    originalMakeRequest = ClaudeAPI._makeRequest;
  });

  afterAll(() => {
    // Restore original API key and method
    ClaudeAPI.apiKey = originalApiKey;
    ClaudeAPI._makeRequest = originalMakeRequest;
  });

  beforeEach(() => {
    // Mock _makeRequest for each test
    ClaudeAPI._makeRequest = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with default model and max tokens', () => {
      expect(ClaudeAPI.model).toBeDefined();
      expect(ClaudeAPI.maxTokens).toBeDefined();
      expect(typeof ClaudeAPI.maxTokens).toBe('number');
    });

    test('should use environment variables for configuration', () => {
      expect(ClaudeAPI.apiVersion).toBe('2023-06-01');
      expect(ClaudeAPI.hostname).toBe('api.anthropic.com');
    });
  });

  describe('sendMessage()', () => {
    test('should throw error if API key not configured', async () => {
      const tempKey = ClaudeAPI.apiKey;
      ClaudeAPI.apiKey = null;

      await expect(
        ClaudeAPI.sendMessage([{ role: 'user', content: 'Test' }])
      ).rejects.toThrow('Claude API key not configured');

      ClaudeAPI.apiKey = tempKey;
    });

    test('should send message with default options', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response text' }],
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      ClaudeAPI._makeRequest.mockResolvedValue(mockResponse);

      const messages = [{ role: 'user', content: 'Test message' }];
      const response = await ClaudeAPI.sendMessage(messages);

      expect(ClaudeAPI._makeRequest).toHaveBeenCalledWith({
        model: ClaudeAPI.model,
        max_tokens: ClaudeAPI.maxTokens,
        messages: messages
      });
      expect(response).toEqual(mockResponse);
    });

    test('should send message with custom options', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      ClaudeAPI._makeRequest.mockResolvedValue(mockResponse);

      const messages = [{ role: 'user', content: 'Test' }];
      const options = {
        model: 'claude-3-opus-20240229',
        max_tokens: 2048,
        temperature: 0.7,
        system: 'You are a helpful assistant.'
      };

      await ClaudeAPI.sendMessage(messages, options);

      expect(ClaudeAPI._makeRequest).toHaveBeenCalledWith({
        model: options.model,
        max_tokens: options.max_tokens,
        messages: messages,
        system: options.system,
        temperature: options.temperature
      });
    });

    test('should log usage information', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 100, output_tokens: 50 }
      };

      ClaudeAPI._makeRequest.mockResolvedValue(mockResponse);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await ClaudeAPI.sendMessage([{ role: 'user', content: 'Test' }]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ClaudeAPI] Usage: 100 in, 50 out')
      );

      consoleSpy.mockRestore();
    });

    test('should handle API errors', async () => {
      ClaudeAPI._makeRequest.mockRejectedValue(new Error('API Error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        ClaudeAPI.sendMessage([{ role: 'user', content: 'Test' }])
      ).rejects.toThrow('API Error');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ClaudeAPI] Error:'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('extractTextContent()', () => {
    test('should extract text from valid response', () => {
      const response = {
        content: [
          { type: 'text', text: 'This is the response text' }
        ]
      };

      const text = ClaudeAPI.extractTextContent(response);
      expect(text).toBe('This is the response text');
    });

    test('should handle multiple content blocks', () => {
      const response = {
        content: [
          { type: 'tool_use', name: 'calculator' },
          { type: 'text', text: 'Answer is 42' }
        ]
      };

      const text = ClaudeAPI.extractTextContent(response);
      expect(text).toBe('Answer is 42');
    });

    test('should throw error for invalid response format', () => {
      expect(() => ClaudeAPI.extractTextContent(null)).toThrow('Invalid Claude API response format');
      expect(() => ClaudeAPI.extractTextContent({})).toThrow('Invalid Claude API response format');
      expect(() => ClaudeAPI.extractTextContent({ content: 'not an array' })).toThrow('Invalid Claude API response format');
    });

    test('should throw error when no text block found', () => {
      const response = {
        content: [
          { type: 'tool_use', name: 'calculator' }
        ]
      };

      expect(() => ClaudeAPI.extractTextContent(response)).toThrow('No text content in Claude API response');
    });
  });

  describe('extractJSON()', () => {
    test('should parse plain JSON', () => {
      const response = {
        content: [{ type: 'text', text: '{"key": "value", "number": 42}' }]
      };

      const json = ClaudeAPI.extractJSON(response);
      expect(json).toEqual({ key: 'value', number: 42 });
    });

    test('should handle JSON in markdown code block', () => {
      const response = {
        content: [{ type: 'text', text: '```json\n{"key": "value"}\n```' }]
      };

      const json = ClaudeAPI.extractJSON(response);
      expect(json).toEqual({ key: 'value' });
    });

    test('should handle JSON in generic code block', () => {
      const response = {
        content: [{ type: 'text', text: '```\n{"key": "value"}\n```' }]
      };

      const json = ClaudeAPI.extractJSON(response);
      expect(json).toEqual({ key: 'value' });
    });

    test('should throw error for invalid JSON', () => {
      const response = {
        content: [{ type: 'text', text: 'This is not JSON' }]
      };

      expect(() => ClaudeAPI.extractJSON(response)).toThrow('Failed to parse JSON from Claude response');
    });
  });

  describe('classifyInstruction()', () => {
    test('should classify instruction into quadrant', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            quadrant: 'STRATEGIC',
            persistence: 'HIGH',
            temporal_scope: 'PROJECT',
            verification_required: 'MANDATORY',
            explicitness: 0.9,
            reasoning: 'Sets long-term project direction'
          })
        }],
        usage: { input_tokens: 50, output_tokens: 100 }
      };

      ClaudeAPI._makeRequest.mockResolvedValue(mockResponse);

      const result = await ClaudeAPI.classifyInstruction('Always use TypeScript for new projects');

      expect(result.quadrant).toBe('STRATEGIC');
      expect(result.persistence).toBe('HIGH');
      expect(result.temporal_scope).toBe('PROJECT');
      expect(ClaudeAPI._makeRequest).toHaveBeenCalled();
    });
  });

  describe('generateBlogTopics()', () => {
    test('should generate blog topics for audience without theme', async () => {
      const mockTopics = [
        {
          title: 'Understanding AI Safety Through Sovereignty',
          subtitle: 'How Tractatus preserves human agency',
          word_count: 1200,
          key_points: ['sovereignty', 'agency', 'values'],
          tractatus_angle: 'Core principle'
        }
      ];

      ClaudeAPI._makeRequest.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTopics) }],
        usage: { input_tokens: 100, output_tokens: 200 }
      });

      const result = await ClaudeAPI.generateBlogTopics('researcher');

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('title');
      expect(ClaudeAPI._makeRequest).toHaveBeenCalled();
    });

    test('should generate blog topics with theme', async () => {
      const mockTopics = [
        { title: 'Topic 1', subtitle: 'Subtitle', word_count: 1000, key_points: [], tractatus_angle: 'Angle' }
      ];

      ClaudeAPI._makeRequest.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTopics) }],
        usage: { input_tokens: 100, output_tokens: 200 }
      });

      const result = await ClaudeAPI.generateBlogTopics('implementer', 'governance frameworks');

      expect(result).toEqual(mockTopics);
      const callArgs = ClaudeAPI._makeRequest.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('governance frameworks');
    });
  });

  describe('classifyMediaInquiry()', () => {
    test('should classify media inquiry by priority', async () => {
      const mockClassification = {
        priority: 'HIGH',
        reasoning: 'Major outlet with tight deadline',
        recommended_response_time: '24 hours',
        suggested_spokesperson: 'framework creator'
      };

      ClaudeAPI._makeRequest.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockClassification) }],
        usage: { input_tokens: 80, output_tokens: 100 }
      });

      const inquiry = {
        outlet: 'TechCrunch',
        request: 'Interview about AI safety frameworks',
        deadline: '2025-10-15'
      };

      const result = await ClaudeAPI.classifyMediaInquiry(inquiry);

      expect(result.priority).toBe('HIGH');
      expect(result.recommended_response_time).toBeDefined();
      expect(ClaudeAPI._makeRequest).toHaveBeenCalled();
    });

    test('should handle inquiry without deadline', async () => {
      const mockClassification = {
        priority: 'MEDIUM',
        reasoning: 'No urgent deadline',
        recommended_response_time: '3-5 days',
        suggested_spokesperson: 'technical expert'
      };

      ClaudeAPI._makeRequest.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockClassification) }],
        usage: { input_tokens: 60, output_tokens: 80 }
      });

      const inquiry = {
        outlet: 'Medium Blog',
        request: 'Feature article about AI governance'
      };

      const result = await ClaudeAPI.classifyMediaInquiry(inquiry);

      expect(result.priority).toBe('MEDIUM');
      const callArgs = ClaudeAPI._makeRequest.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Not specified');
    });
  });

  describe('draftMediaResponse()', () => {
    test('should draft response to media inquiry', async () => {
      const mockDraft = 'Thank you for your interest in the Tractatus AI Safety Framework...';

      ClaudeAPI._makeRequest.mockResolvedValue({
        content: [{ type: 'text', text: mockDraft }],
        usage: { input_tokens: 100, output_tokens: 150 }
      });

      const inquiry = {
        outlet: 'Wired Magazine',
        request: 'Expert quote on AI safety'
      };

      const result = await ClaudeAPI.draftMediaResponse(inquiry, 'HIGH');

      expect(typeof result).toBe('string');
      expect(result).toContain('Tractatus');
      expect(ClaudeAPI._makeRequest).toHaveBeenCalled();
    });
  });

  describe('analyzeCaseRelevance()', () => {
    test('should analyze case study relevance', async () => {
      const mockAnalysis = {
        relevance_score: 85,
        strengths: ['Clear evidence', 'Framework alignment'],
        weaknesses: ['Needs more detail'],
        recommended_action: 'PUBLISH',
        ethical_concerns: null,
        suggested_improvements: ['Add metrics']
      };

      ClaudeAPI._makeRequest.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 120, output_tokens: 180 }
      });

      const caseStudy = {
        title: 'AI System Prevented from Making Values Decision',
        description: 'Case study of boundary enforcement',
        evidence: 'System logs and decision audit trail'
      };

      const result = await ClaudeAPI.analyzeCaseRelevance(caseStudy);

      expect(result.relevance_score).toBe(85);
      expect(result.recommended_action).toBe('PUBLISH');
      expect(Array.isArray(result.strengths)).toBe(true);
    });

    test('should handle case study without evidence', async () => {
      const mockAnalysis = {
        relevance_score: 45,
        strengths: ['Interesting topic'],
        weaknesses: ['No evidence provided'],
        recommended_action: 'EDIT',
        ethical_concerns: null,
        suggested_improvements: ['Add concrete evidence']
      };

      ClaudeAPI._makeRequest.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 100, output_tokens: 140 }
      });

      const caseStudy = {
        title: 'Interesting AI Safety Case',
        description: 'A case that might be relevant'
      };

      const result = await ClaudeAPI.analyzeCaseRelevance(caseStudy);

      expect(result.relevance_score).toBeLessThan(60);
      const callArgs = ClaudeAPI._makeRequest.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Not provided');
    });
  });

  describe('curateResource()', () => {
    test('should curate external resource', async () => {
      const mockCuration = {
        recommended: true,
        category: 'PAPERS',
        alignment_score: 92,
        target_audience: ['researcher', 'implementer'],
        tags: ['AI safety', 'governance', 'frameworks'],
        reasoning: 'Highly aligned with Tractatus principles',
        concerns: null
      };

      ClaudeAPI._makeRequest.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockCuration) }],
        usage: { input_tokens: 90, output_tokens: 120 }
      });

      const resource = {
        url: 'https://example.com/paper',
        title: 'AI Safety Research Paper',
        description: 'Comprehensive framework for AI governance'
      };

      const result = await ClaudeAPI.curateResource(resource);

      expect(result.recommended).toBe(true);
      expect(result.category).toBe('PAPERS');
      expect(result.alignment_score).toBeGreaterThan(80);
      expect(Array.isArray(result.target_audience)).toBe(true);
    });

    test('should identify concerns in resources', async () => {
      const mockCuration = {
        recommended: false,
        category: 'ARTICLES',
        alignment_score: 35,
        target_audience: [],
        tags: ['AI'],
        reasoning: 'Conflicting values approach',
        concerns: ['Promotes full automation of values decisions', 'No human oversight']
      };

      ClaudeAPI._makeRequest.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockCuration) }],
        usage: { input_tokens: 80, output_tokens: 110 }
      });

      const resource = {
        url: 'https://example.com/article',
        title: 'Fully Automated AI Ethics',
        description: 'Let AI make all ethical decisions'
      };

      const result = await ClaudeAPI.curateResource(resource);

      expect(result.recommended).toBe(false);
      expect(result.concerns).toBeDefined();
      expect(Array.isArray(result.concerns)).toBe(true);
      expect(result.concerns.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors', async () => {
      ClaudeAPI._makeRequest.mockRejectedValue(new Error('Network timeout'));

      await expect(
        ClaudeAPI.sendMessage([{ role: 'user', content: 'Test' }])
      ).rejects.toThrow('Network timeout');
    });

    test('should handle malformed responses', async () => {
      ClaudeAPI._makeRequest.mockResolvedValue({
        content: [{ type: 'text', text: 'Not valid JSON' }],
        usage: { input_tokens: 10, output_tokens: 5 }
      });

      await expect(
        ClaudeAPI.classifyInstruction('Test instruction')
      ).rejects.toThrow('Failed to parse JSON from Claude response');
    });

    test('should handle empty responses gracefully', async () => {
      ClaudeAPI._makeRequest.mockResolvedValue({
        content: [],
        usage: { input_tokens: 10, output_tokens: 0 }
      });

      const response = await ClaudeAPI.sendMessage([{ role: 'user', content: 'Test' }]);

      // sendMessage doesn't validate content, it just returns the response
      expect(response.content).toEqual([]);

      // But extractTextContent should throw an error
      expect(() => ClaudeAPI.extractTextContent(response)).toThrow('No text content in Claude API response');
    });
  });

  describe('_makeRequest() [Private Method Testing]', () => {
    beforeEach(() => {
      // Restore original _makeRequest for these tests
      ClaudeAPI._makeRequest = originalMakeRequest;
    });

    afterEach(() => {
      // Re-mock for other tests
      ClaudeAPI._makeRequest = jest.fn();
    });

    test('should construct proper HTTPS request', () => {
      // This test verifies the method exists and has proper structure
      expect(typeof ClaudeAPI._makeRequest).toBe('function');

      const payload = {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Test' }]
      };

      // Verify the method accepts a payload parameter
      expect(() => ClaudeAPI._makeRequest(payload)).not.toThrow(TypeError);
    });

    test('should include required headers in request', () => {
      // Verify method signature and structure
      const methodString = ClaudeAPI._makeRequest.toString();
      expect(methodString).toContain('x-api-key');
      expect(methodString).toContain('anthropic-version');
      expect(methodString).toContain('Content-Type');
    });

    test('should use correct API endpoint', () => {
      const methodString = ClaudeAPI._makeRequest.toString();
      expect(methodString).toContain('/v1/messages');
      expect(methodString).toContain('443'); // HTTPS port
    });
  });

  describe('Service Integration', () => {
    test('should maintain singleton pattern', () => {
      const ClaudeAPI2 = require('../../src/services/ClaudeAPI.service');
      expect(ClaudeAPI).toBe(ClaudeAPI2);
    });

    test('should have all expected public methods', () => {
      expect(typeof ClaudeAPI.sendMessage).toBe('function');
      expect(typeof ClaudeAPI.extractTextContent).toBe('function');
      expect(typeof ClaudeAPI.extractJSON).toBe('function');
      expect(typeof ClaudeAPI.classifyInstruction).toBe('function');
      expect(typeof ClaudeAPI.generateBlogTopics).toBe('function');
      expect(typeof ClaudeAPI.classifyMediaInquiry).toBe('function');
      expect(typeof ClaudeAPI.draftMediaResponse).toBe('function');
      expect(typeof ClaudeAPI.analyzeCaseRelevance).toBe('function');
      expect(typeof ClaudeAPI.curateResource).toBe('function');
    });

    test('should expose private _makeRequest method for testing', () => {
      // Verify _makeRequest exists (even though private)
      expect(typeof ClaudeAPI._makeRequest).toBe('function');
    });
  });
});
