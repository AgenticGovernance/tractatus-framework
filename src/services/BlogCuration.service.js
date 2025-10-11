/**
 * Blog Curation Service
 *
 * AI-assisted blog content curation with mandatory human oversight.
 * Implements Tractatus framework boundary enforcement for content generation.
 *
 * Governance: TRA-OPS-0002 (AI suggests, human decides)
 * Boundary Rules:
 * - inst_016: NEVER fabricate statistics or make unverifiable claims
 * - inst_017: NEVER use absolute assurance terms (guarantee, ensures 100%, etc.)
 * - inst_018: NEVER claim production-ready status without evidence
 *
 * All AI-generated content MUST be reviewed and approved by a human before publication.
 */

const claudeAPI = require('./ClaudeAPI.service');
const BoundaryEnforcer = require('./BoundaryEnforcer.service');
const { getMemoryProxy } = require('./MemoryProxy.service');
const logger = require('../utils/logger.util');

class BlogCurationService {
  constructor() {
    // Initialize MemoryProxy for governance rule persistence and audit logging
    this.memoryProxy = getMemoryProxy();
    this.enforcementRules = {}; // Will load inst_016, inst_017, inst_018
    this.memoryProxyInitialized = false;

    // Editorial guidelines - core principles for blog content
    this.editorialGuidelines = {
      tone: 'Professional, informative, evidence-based',
      voice: 'Third-person objective (AI safety framework documentation)',
      style: 'Clear, accessible technical writing',
      principles: [
        'Transparency: Cite sources for all claims',
        'Honesty: Acknowledge limitations and unknowns',
        'Evidence: No fabricated statistics or unverifiable claims',
        'Humility: No absolute guarantees or 100% assurances',
        'Accuracy: Production status claims must have evidence'
      ],
      forbiddenPatterns: [
        'Fabricated statistics without sources',
        'Absolute terms: guarantee, ensures 100%, never fails, always works',
        'Unverified production claims: battle-tested (without evidence), industry-standard (without adoption metrics)',
        'Emotional manipulation or fear-mongering',
        'Misleading comparisons or false dichotomies'
      ],
      targetWordCounts: {
        short: '600-900 words',
        medium: '1000-1500 words',
        long: '1800-2500 words'
      }
    };
  }

  /**
   * Initialize MemoryProxy and load enforcement rules
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      await this.memoryProxy.initialize();

      // Load critical enforcement rules from memory
      const criticalRuleIds = ['inst_016', 'inst_017', 'inst_018'];
      let rulesLoaded = 0;

      for (const ruleId of criticalRuleIds) {
        const rule = await this.memoryProxy.getRule(ruleId);
        if (rule) {
          this.enforcementRules[ruleId] = rule;
          rulesLoaded++;
        } else {
          logger.warn(`[BlogCuration] Enforcement rule ${ruleId} not found in memory`);
        }
      }

      this.memoryProxyInitialized = true;

      logger.info('[BlogCuration] MemoryProxy initialized', {
        rulesLoaded,
        totalCriticalRules: criticalRuleIds.length
      });

      return {
        success: true,
        rulesLoaded,
        enforcementRules: Object.keys(this.enforcementRules)
      };

    } catch (error) {
      logger.error('[BlogCuration] Failed to initialize MemoryProxy', {
        error: error.message
      });
      // Continue with existing validation logic even if memory fails
      return {
        success: false,
        error: error.message,
        rulesLoaded: 0
      };
    }
  }

  /**
   * Draft a full blog post using AI
   *
   * @param {Object} params - Blog post parameters
   * @param {string} params.topic - Blog post topic/title
   * @param {string} params.audience - Target audience (researcher/implementer/advocate)
   * @param {string} params.length - Desired length (short/medium/long)
   * @param {string} params.focus - Optional focus area or angle
   * @returns {Promise<Object>} Draft blog post with metadata
   */
  async draftBlogPost(params) {
    const { topic, audience, length = 'medium', focus } = params;

    logger.info(`[BlogCuration] Drafting blog post: "${topic}" for ${audience}`);

    // 1. Boundary check - content generation requires human oversight
    const boundaryCheck = BoundaryEnforcer.enforce({
      description: 'Generate AI-drafted blog content for human review',
      text: 'Blog post will be queued for mandatory human approval before publication',
      classification: { quadrant: 'OPERATIONAL' },
      type: 'content_generation'
    });

    if (!boundaryCheck.allowed) {
      logger.warn(`[BlogCuration] Boundary check failed: ${boundaryCheck.reasoning}`);
      throw new Error(`Boundary violation: ${boundaryCheck.reasoning}`);
    }

    // 2. Build system prompt with editorial guidelines and Tractatus constraints
    const systemPrompt = this._buildSystemPrompt(audience);

    // 3. Build user prompt for blog post generation
    const userPrompt = this._buildDraftPrompt(topic, audience, length, focus);

    // 4. Call Claude API
    const messages = [{ role: 'user', content: userPrompt }];

    try {
      const response = await claudeAPI.sendMessage(messages, {
        system: systemPrompt,
        max_tokens: this._getMaxTokens(length),
        temperature: 0.7 // Balanced creativity and consistency
      });

      const content = claudeAPI.extractJSON(response);

      // 5. Validate generated content against Tractatus principles
      const validation = await this._validateContent(content);

      // 6. Return draft with validation results
      return {
        draft: content,
        validation,
        boundary_check: boundaryCheck,
        metadata: {
          generated_at: new Date(),
          model: response.model,
          usage: response.usage,
          audience,
          length,
          requires_human_approval: true
        }
      };

    } catch (error) {
      logger.error('[BlogCuration] Draft generation failed:', error);
      throw new Error(`Blog draft generation failed: ${error.message}`);
    }
  }

  /**
   * Suggest blog topics based on audience and existing documents
   * (Fetches documents from site as context for topic generation)
   *
   * @param {string} audience - Target audience
   * @param {string} theme - Optional theme/focus
   * @returns {Promise<Array>} Topic suggestions with metadata
   */
  async suggestTopics(audience, theme = null) {
    logger.info(`[BlogCuration] Suggesting topics: audience=${audience}, theme=${theme || 'general'}`);

    try {
      // Fetch existing documents as context
      const Document = require('../models/Document.model');
      const documents = await Document.list({ limit: 20, skip: 0 });

      // Build context from document titles and summaries
      const documentContext = documents.map(doc => ({
        title: doc.title,
        slug: doc.slug,
        summary: doc.summary || doc.description || ''
      }));

      // Generate topics with document context
      const systemPrompt = `You are a content strategist for the Tractatus AI Safety Framework.
Your role is to suggest blog post topics that educate audiences about AI safety through sovereignty,
transparency, harmlessness, and community principles.

The framework prevents AI from making irreducible human decisions and requires human oversight
for all values-sensitive choices.

EXISTING DOCUMENTS ON SITE:
${documentContext.map(d => `- ${d.title}: ${d.summary}`).join('\n')}

Suggest topics that:
1. Complement existing content (don't duplicate)
2. Address gaps in current documentation
3. Provide practical insights for ${audience} audience
4. Maintain Tractatus principles (no fabricated stats, no absolute guarantees)`;

      const userPrompt = theme
        ? `Based on the existing documents above, suggest 5-7 NEW blog post topics for ${audience} audience focused on: ${theme}

For each topic, provide:
{
  "title": "compelling, specific title",
  "rationale": "why this topic fills a gap or complements existing content",
  "target_word_count": 800-1500,
  "key_points": ["3-5 bullet points"],
  "tractatus_angle": "how it relates to framework principles"
}

Respond with JSON array.`
        : `Based on the existing documents above, suggest 5-7 NEW blog post topics for ${audience} audience about the Tractatus AI Safety Framework.

For each topic, provide:
{
  "title": "compelling, specific title",
  "rationale": "why this topic fills a gap or complements existing content",
  "target_word_count": 800-1500,
  "key_points": ["3-5 bullet points"],
  "tractatus_angle": "how it relates to framework principles"
}

Respond with JSON array.`;

      const messages = [{ role: 'user', content: userPrompt }];

      const response = await claudeAPI.sendMessage(messages, {
        system: systemPrompt,
        max_tokens: 2048
      });

      const topics = claudeAPI.extractJSON(response);

      // Validate topics don't contain forbidden patterns
      const validatedTopics = topics.map(topic => ({
        ...topic,
        validation: this._validateTopicTitle(topic.title)
      }));

      return validatedTopics;

    } catch (error) {
      logger.error('[BlogCuration] Topic suggestion failed:', error);
      throw new Error(`Topic suggestion failed: ${error.message}`);
    }
  }

  /**
   * Analyze existing blog content for Tractatus compliance
   *
   * @param {Object} content - Blog post content {title, body}
   * @returns {Promise<Object>} Compliance analysis
   */
  async analyzeContentCompliance(content) {
    const { title, body } = content;

    logger.info(`[BlogCuration] Analyzing content compliance: "${title}"`);

    const systemPrompt = `You are a Tractatus Framework compliance auditor.
Analyze content for violations of these principles:

1. NEVER fabricate statistics or make unverifiable claims
2. NEVER use absolute assurance terms (guarantee, ensures 100%, never fails, always works)
3. NEVER claim production-ready status without concrete evidence
4. ALWAYS cite sources for statistics and claims
5. ALWAYS acknowledge limitations and unknowns

Return JSON with compliance analysis.`;

    const userPrompt = `Analyze this blog post for Tractatus compliance:

Title: ${title}

Content:
${body}

Respond with JSON:
{
  "compliant": true/false,
  "violations": [
    {
      "type": "FABRICATED_STAT|ABSOLUTE_CLAIM|UNVERIFIED_PRODUCTION|OTHER",
      "severity": "HIGH|MEDIUM|LOW",
      "excerpt": "problematic text snippet",
      "reasoning": "why this violates principles",
      "suggested_fix": "how to correct it"
    }
  ],
  "warnings": ["..."],
  "strengths": ["..."],
  "overall_score": 0-100,
  "recommendation": "PUBLISH|EDIT_REQUIRED|REJECT"
}`;

    const messages = [{ role: 'user', content: userPrompt }];

    try {
      const response = await claudeAPI.sendMessage(messages, {
        system: systemPrompt,
        max_tokens: 2048
      });

      return claudeAPI.extractJSON(response);

    } catch (error) {
      logger.error('[BlogCuration] Compliance analysis failed:', error);
      throw new Error(`Compliance analysis failed: ${error.message}`);
    }
  }

  /**
   * Generate SEO-friendly slug from title
   *
   * @param {string} title - Blog post title
   * @returns {string} URL-safe slug
   */
  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }

  /**
   * Extract excerpt from blog content
   *
   * @param {string} content - Full blog content (HTML or markdown)
   * @param {number} maxLength - Maximum excerpt length (default 200)
   * @returns {string} Excerpt
   */
  extractExcerpt(content, maxLength = 200) {
    // Strip HTML/markdown tags
    const plainText = content
      .replace(/<[^>]*>/g, '')
      .replace(/[#*_`]/g, '')
      .trim();

    if (plainText.length <= maxLength) {
      return plainText;
    }

    // Find last complete sentence within maxLength
    const excerpt = plainText.substring(0, maxLength);
    const lastPeriod = excerpt.lastIndexOf('.');

    if (lastPeriod > maxLength * 0.5) {
      return excerpt.substring(0, lastPeriod + 1);
    }

    return excerpt.substring(0, maxLength).trim() + '...';
  }

  /**
   * Build system prompt with editorial guidelines
   * @private
   */
  _buildSystemPrompt(audience) {
    const audienceContext = {
      researcher: 'Academic researchers, AI safety specialists, technical analysts',
      implementer: 'Software engineers, system architects, technical decision-makers',
      advocate: 'Policy makers, ethicists, public stakeholders, non-technical audiences',
      general: 'Mixed audience with varying technical backgrounds'
    };

    return `You are a professional technical writer creating content for the Tractatus AI Safety Framework blog.

AUDIENCE: ${audienceContext[audience] || audienceContext.general}

TRACTATUS FRAMEWORK CORE PRINCIPLES:
1. What cannot be systematized must not be automated
2. AI must never make irreducible human decisions
3. Sovereignty: User agency over values and goals
4. Transparency: Explicit instructions, audit trails, governance logs
5. Harmlessness: Boundary enforcement prevents values automation
6. Community: Open frameworks, shared governance patterns

EDITORIAL GUIDELINES:
- Tone: ${this.editorialGuidelines.tone}
- Voice: ${this.editorialGuidelines.voice}
- Style: ${this.editorialGuidelines.style}

MANDATORY CONSTRAINTS (inst_016, inst_017, inst_018):
${this.editorialGuidelines.principles.map(p => `- ${p}`).join('\n')}

FORBIDDEN PATTERNS:
${this.editorialGuidelines.forbiddenPatterns.map(p => `- ${p}`).join('\n')}

OUTPUT FORMAT: JSON with structure:
{
  "title": "SEO-friendly title (60 chars max)",
  "subtitle": "Compelling subtitle (120 chars max)",
  "content": "Full blog post content in Markdown format",
  "excerpt": "Brief excerpt (150-200 chars)",
  "tags": ["tag1", "tag2", "tag3"],
  "tractatus_angle": "How this relates to framework principles",
  "sources": ["URL or reference for claims made"],
  "word_count": actual_word_count
}`;
  }

  /**
   * Build user prompt for blog post draft
   * @private
   */
  _buildDraftPrompt(topic, audience, length, focus) {
    const wordCount = {
      short: '600-900',
      medium: '1000-1500',
      long: '1800-2500'
    }[length] || '1000-1500';

    let prompt = `Write a blog post about: ${topic}

Target word count: ${wordCount} words
Audience: ${audience}`;

    if (focus) {
      prompt += `\nSpecific focus: ${focus}`;
    }

    prompt += `

Requirements:
1. Evidence-based: Cite sources for all statistics and claims
2. Honest: Acknowledge limitations, unknowns, trade-offs
3. No fabricated data or unverifiable claims
4. No absolute guarantees or 100% assurances
5. Clear connection to Tractatus framework principles
6. Actionable insights or takeaways for the ${audience} audience
7. SEO-friendly structure with headers, lists, and clear sections

Respond with JSON as specified in the system prompt.`;

    return prompt;
  }

  /**
   * Get max tokens based on target length
   * @private
   */
  _getMaxTokens(length) {
    const tokenMap = {
      short: 2048,
      medium: 3072,
      long: 4096
    };
    return tokenMap[length] || 3072;
  }

  /**
   * Validate content against Tractatus principles
   * @private
   */
  async _validateContent(content) {
    const violations = [];
    const warnings = [];

    const textToCheck = `${content.title} ${content.subtitle} ${content.content}`.toLowerCase();

    // Check for forbidden patterns (inst_016, inst_017, inst_018)
    const forbiddenTerms = {
      absolute_guarantees: ['guarantee', 'guarantees', 'guaranteed', 'ensures 100%', 'never fails', 'always works', '100% safe', '100% secure'],
      fabricated_stats: [], // Can't detect without external validation
      unverified_production: ['battle-tested', 'production-proven', 'industry-standard']
    };

    // Check absolute guarantees (inst_017)
    forbiddenTerms.absolute_guarantees.forEach(term => {
      if (textToCheck.includes(term)) {
        violations.push({
          type: 'ABSOLUTE_GUARANTEE',
          severity: 'HIGH',
          term,
          instruction: 'inst_017',
          message: `Forbidden absolute assurance term: "${term}"`
        });
      }
    });

    // Check unverified production claims (inst_018)
    forbiddenTerms.unverified_production.forEach(term => {
      if (textToCheck.includes(term) && (!content.sources || content.sources.length === 0)) {
        warnings.push({
          type: 'UNVERIFIED_CLAIM',
          severity: 'MEDIUM',
          term,
          instruction: 'inst_018',
          message: `Production claim "${term}" requires citation`
        });
      }
    });

    // Check for uncited statistics (inst_016)
    const statPattern = /\d+(\.\d+)?%/g;
    const statsFound = (content.content.match(statPattern) || []).length;

    if (statsFound > 0 && (!content.sources || content.sources.length === 0)) {
      warnings.push({
        type: 'UNCITED_STATISTICS',
        severity: 'HIGH',
        instruction: 'inst_016',
        message: `Found ${statsFound} statistics without sources - verify these are not fabricated`
      });
    }

    const isValid = violations.length === 0;

    const validationResult = {
      valid: isValid,
      violations,
      warnings,
      stats_found: statsFound,
      sources_provided: content.sources?.length || 0,
      recommendation: violations.length > 0 ? 'REJECT' :
                      warnings.length > 0 ? 'REVIEW_REQUIRED' :
                      'APPROVED'
    };

    // Audit validation decision
    this._auditValidationDecision(content, validationResult);

    return validationResult;
  }

  /**
   * Audit content validation decision to memory (async, non-blocking)
   * @private
   */
  _auditValidationDecision(content, validationResult) {
    // Only audit if MemoryProxy is initialized
    if (!this.memoryProxyInitialized) {
      return;
    }

    // Extract violation instruction IDs
    const violatedRules = [
      ...validationResult.violations.map(v => v.instruction),
      ...validationResult.warnings.map(w => w.instruction)
    ].filter(Boolean);

    // Audit asynchronously (don't block validation)
    this.memoryProxy.auditDecision({
      sessionId: 'blog-curation-service',
      action: 'content_validation',
      rulesChecked: Object.keys(this.enforcementRules),
      violations: violatedRules,
      allowed: validationResult.valid,
      metadata: {
        content_title: content.title,
        violation_count: validationResult.violations.length,
        warning_count: validationResult.warnings.length,
        stats_found: validationResult.stats_found,
        sources_provided: validationResult.sources_provided,
        recommendation: validationResult.recommendation
      }
    }).catch(error => {
      logger.error('[BlogCuration] Failed to audit validation decision', {
        error: error.message,
        title: content.title
      });
    });
  }

  /**
   * Validate topic title for forbidden patterns
   * @private
   */
  _validateTopicTitle(title) {
    const textToCheck = title.toLowerCase();
    const issues = [];

    // Check for absolute guarantees
    if (textToCheck.match(/guarantee|100%|never fail|always work/)) {
      issues.push('Contains absolute assurance language');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get editorial guidelines (for display in admin UI)
   *
   * @returns {Object} Editorial guidelines
   */
  getEditorialGuidelines() {
    return this.editorialGuidelines;
  }
}

// Export singleton instance
module.exports = new BlogCurationService();
