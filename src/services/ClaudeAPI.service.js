/**
 * Claude API Service
 *
 * Provides interface to Anthropic's Claude API for AI-powered features.
 * All AI operations go through this service to ensure consistent error handling,
 * rate limiting, and governance compliance.
 *
 * Usage:
 * const claudeAPI = require('./ClaudeAPI.service');
 * const response = await claudeAPI.sendMessage(messages, options);
 */

const https = require('https');

class ClaudeAPIService {
  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY;
    this.model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';
    this.maxTokens = parseInt(process.env.CLAUDE_MAX_TOKENS) || 4096;
    this.apiVersion = '2023-06-01';
    this.hostname = 'api.anthropic.com';

    if (!this.apiKey) {
      console.error('WARNING: CLAUDE_API_KEY not set in environment variables');
    }
  }

  /**
   * Send a message to Claude API
   *
   * @param {Array} messages - Array of message objects [{role: 'user', content: '...'}]
   * @param {Object} options - Optional overrides (model, max_tokens, temperature)
   * @returns {Promise<Object>} API response
   */
  async sendMessage(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('Claude API key not configured');
    }

    const payload = {
      model: options.model || this.model,
      max_tokens: options.max_tokens || this.maxTokens,
      messages: messages,
      ...(options.system && { system: options.system }),
      ...(options.temperature && { temperature: options.temperature })
    };

    try {
      const response = await this._makeRequest(payload);

      // Log usage for monitoring
      if (response.usage) {
        console.log(`[ClaudeAPI] Usage: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);
      }

      return response;
    } catch (error) {
      console.error('[ClaudeAPI] Error:', error.message);
      throw error;
    }
  }

  /**
   * Make HTTP request to Claude API
   *
   * @private
   * @param {Object} payload - Request payload
   * @returns {Promise<Object>} Parsed response
   */
  _makeRequest(payload) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payload);

      const options = {
        hostname: this.hostname,
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(data);
              resolve(response);
            } catch (error) {
              reject(new Error(`Failed to parse API response: ${error.message}`));
            }
          } else {
            reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request error: ${error.message}`));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Extract text content from Claude API response
   *
   * @param {Object} response - Claude API response
   * @returns {string} Extracted text content
   */
  extractTextContent(response) {
    if (!response || !response.content || !Array.isArray(response.content)) {
      throw new Error('Invalid Claude API response format');
    }

    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock) {
      throw new Error('No text content in Claude API response');
    }

    return textBlock.text;
  }

  /**
   * Parse JSON from Claude response (handles markdown code blocks)
   *
   * @param {Object} response - Claude API response
   * @returns {Object} Parsed JSON
   */
  extractJSON(response) {
    const text = this.extractTextContent(response);

    // Remove markdown code blocks if present
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse JSON from Claude response: ${error.message}\nText: ${jsonText}`);
    }
  }

  /**
   * Classify an instruction into Tractatus quadrants
   *
   * @param {string} instructionText - The instruction to classify
   * @returns {Promise<Object>} Classification result
   */
  async classifyInstruction(instructionText) {
    const messages = [{
      role: 'user',
      content: `Classify the following instruction into one of these quadrants: STRATEGIC, OPERATIONAL, TACTICAL, SYSTEM, or STOCHASTIC.

Instruction: "${instructionText}"

Respond with JSON only:
{
  "quadrant": "...",
  "persistence": "HIGH/MEDIUM/LOW",
  "temporal_scope": "PROJECT/SESSION/TASK",
  "verification_required": "MANDATORY/RECOMMENDED/NONE",
  "explicitness": 0.0-1.0,
  "reasoning": "brief explanation"
}`
    }];

    const response = await this.sendMessage(messages, { max_tokens: 1024 });
    return this.extractJSON(response);
  }

  /**
   * Generate blog topic suggestions
   *
   * @param {string} audience - Target audience (researcher/implementer/advocate)
   * @param {string} theme - Optional theme or focus area
   * @returns {Promise<Array>} Array of topic suggestions
   */
  async generateBlogTopics(audience, theme = null) {
    const systemPrompt = `You are a content strategist for the Tractatus AI Safety Framework.
Your role is to suggest blog post topics that educate audiences about AI safety through sovereignty,
transparency, harmlessness, and community principles.

The framework prevents AI from making irreducible human decisions and requires human oversight
for all values-sensitive choices.`;

    const userPrompt = theme
      ? `Suggest 5-7 blog post topics for ${audience} audience focused on: ${theme}

For each topic, provide:
- Title (compelling, specific)
- Subtitle (1 sentence)
- Target word count (800-1500)
- Key points to cover (3-5 bullets)
- Tractatus angle (how it relates to framework)

Respond with JSON array.`
      : `Suggest 5-7 blog post topics for ${audience} audience about the Tractatus AI Safety Framework.

For each topic, provide:
- Title (compelling, specific)
- Subtitle (1 sentence)
- Target word count (800-1500)
- Key points to cover (3-5 bullets)
- Tractatus angle (how it relates to framework)

Respond with JSON array.`;

    const messages = [{ role: 'user', content: userPrompt }];

    const response = await this.sendMessage(messages, {
      system: systemPrompt,
      max_tokens: 2048
    });

    return this.extractJSON(response);
  }

  /**
   * Classify media inquiry by priority
   *
   * @param {Object} inquiry - Media inquiry object {outlet, request, deadline}
   * @returns {Promise<Object>} Classification with priority and reasoning
   */
  async classifyMediaInquiry(inquiry) {
    const { outlet, request, deadline } = inquiry;

    const systemPrompt = `You are a media relations assistant for the Tractatus AI Safety Framework.
Classify media inquiries by priority (HIGH/MEDIUM/LOW) based on:
- Outlet credibility and reach
- Request type (interview, comment, feature)
- Deadline urgency
- Topic relevance to framework`;

    const userPrompt = `Classify this media inquiry:

Outlet: ${outlet}
Request: ${request}
Deadline: ${deadline || 'Not specified'}

Respond with JSON:
{
  "priority": "HIGH/MEDIUM/LOW",
  "reasoning": "brief explanation",
  "recommended_response_time": "hours or days",
  "suggested_spokesperson": "technical expert, policy lead, or framework creator"
}`;

    const messages = [{ role: 'user', content: userPrompt }];

    const response = await this.sendMessage(messages, {
      system: systemPrompt,
      max_tokens: 1024
    });

    return this.extractJSON(response);
  }

  /**
   * Draft suggested response to media inquiry
   * (ALWAYS requires human approval before sending - TRA-OPS-0003)
   *
   * @param {Object} inquiry - Media inquiry object
   * @param {string} priority - Priority classification
   * @returns {Promise<string>} Draft response text
   */
  async draftMediaResponse(inquiry, priority) {
    const { outlet, request } = inquiry;

    const systemPrompt = `You are drafting a suggested response to a media inquiry about the Tractatus AI Safety Framework.

IMPORTANT: This is a DRAFT only. A human will review and approve before sending.

Framework Core Principles:
1. What cannot be systematized must not be automated
2. AI must never make irreducible human decisions
3. Sovereignty: User agency over values and goals
4. Transparency: Explicit instructions, audit trails
5. Harmlessness: Boundary enforcement prevents values automation
6. Community: Open frameworks, shared governance`;

    const userPrompt = `Draft a ${priority} priority response to:

Outlet: ${outlet}
Request: ${request}

Requirements:
- Professional, informative tone
- 150-250 words
- Offer specific value (interview, technical details, case studies)
- Mention framework website: agenticgovernance.digital
- Include contact for follow-up

Respond with plain text (not JSON).`;

    const messages = [{ role: 'user', content: userPrompt }];

    const response = await this.sendMessage(messages, {
      system: systemPrompt,
      max_tokens: 1024
    });

    return this.extractTextContent(response);
  }

  /**
   * Analyze case study relevance
   *
   * @param {Object} caseStudy - Case study object {title, description, evidence}
   * @returns {Promise<Object>} Analysis with relevance score
   */
  async analyzeCaseRelevance(caseStudy) {
    const { title, description, evidence } = caseStudy;

    const systemPrompt = `You are evaluating case study submissions for the Tractatus AI Safety Framework.

Assess relevance based on:
1. Demonstrates framework principles (sovereignty, transparency, harmlessness)
2. Shows AI safety concerns addressed by Tractatus
3. Provides concrete evidence or examples
4. Offers insights valuable to community
5. Ethical considerations (privacy, consent, impact)

Score 0-100 where:
- 80-100: Highly relevant, publish with minor edits
- 60-79: Relevant, needs some editing
- 40-59: Somewhat relevant, major editing needed
- 0-39: Not relevant or low quality`;

    const userPrompt = `Analyze this case study submission:

Title: ${title}
Description: ${description}
Evidence: ${evidence || 'Not provided'}

Respond with JSON:
{
  "relevance_score": 0-100,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "recommended_action": "PUBLISH/EDIT/REJECT",
  "ethical_concerns": ["..."] or null,
  "suggested_improvements": ["..."]
}`;

    const messages = [{ role: 'user', content: userPrompt }];

    const response = await this.sendMessage(messages, {
      system: systemPrompt,
      max_tokens: 1536
    });

    return this.extractJSON(response);
  }

  /**
   * Curate external resources (websites, papers, tools)
   *
   * @param {Object} resource - Resource object {url, title, description}
   * @returns {Promise<Object>} Curation analysis
   */
  async curateResource(resource) {
    const { url, title, description } = resource;

    const systemPrompt = `You are curating external resources for the Tractatus AI Safety Framework resource directory.

Evaluate based on:
1. Alignment with framework values (sovereignty, transparency, harmlessness)
2. Quality and credibility of source
3. Relevance to AI safety, governance, or ethics
4. Usefulness to target audiences (researchers, implementers, advocates)

Categorize into:
- PAPERS: Academic research, technical documentation
- TOOLS: Software, frameworks, libraries
- ORGANIZATIONS: Aligned groups, communities
- STANDARDS: Regulatory frameworks, best practices
- ARTICLES: Blog posts, essays, commentaries`;

    const userPrompt = `Evaluate this resource for inclusion:

URL: ${url}
Title: ${title}
Description: ${description}

Respond with JSON:
{
  "recommended": true/false,
  "category": "PAPERS/TOOLS/ORGANIZATIONS/STANDARDS/ARTICLES",
  "alignment_score": 0-100,
  "target_audience": ["researcher", "implementer", "advocate"],
  "tags": ["..."],
  "reasoning": "brief explanation",
  "concerns": ["..."] or null
}`;

    const messages = [{ role: 'user', content: userPrompt }];

    const response = await this.sendMessage(messages, {
      system: systemPrompt,
      max_tokens: 1024
    });

    return this.extractJSON(response);
  }
}

// Export singleton instance
module.exports = new ClaudeAPIService();
