/**
 * Media Triage Service
 * AI-powered media inquiry triage with Tractatus governance
 *
 * GOVERNANCE PRINCIPLES:
 * - AI analyzes and suggests, humans decide
 * - All reasoning must be transparent
 * - Values decisions require human approval
 * - No auto-responses without human review
 * - Boundary enforcement for sensitive topics
 */

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger.util');

class MediaTriageService {
  constructor() {
    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY
    });

    // Topic sensitivity keywords (triggers boundary enforcement)
    this.SENSITIVE_TOPICS = [
      'values', 'ethics', 'strategic direction', 'partnerships',
      'te tiriti', 'māori', 'indigenous', 'governance philosophy',
      'framework limitations', 'criticism', 'controversy'
    ];

    // Urgency indicators
    this.URGENCY_INDICATORS = {
      high: ['urgent', 'asap', 'immediate', 'breaking', 'deadline today', 'deadline tomorrow'],
      medium: ['deadline this week', 'timely', 'soon'],
      low: ['no deadline', 'general inquiry', 'background']
    };
  }

  /**
   * Perform AI triage on media inquiry
   * Returns structured analysis for human review
   */
  async triageInquiry(inquiry) {
    try {
      logger.info(`AI triaging inquiry: ${inquiry._id}`);

      // Step 1: Analyze urgency
      const urgencyAnalysis = await this.analyzeUrgency(inquiry);

      // Step 2: Detect topic sensitivity
      const sensitivityAnalysis = await this.analyzeTopicSensitivity(inquiry);

      // Step 3: Check if involves values (BoundaryEnforcer)
      const valuesCheck = this.checkInvolvesValues(inquiry, sensitivityAnalysis);

      // Step 4: Generate suggested talking points
      const talkingPoints = await this.generateTalkingPoints(inquiry, sensitivityAnalysis);

      // Step 5: Draft response (ALWAYS requires human approval)
      const draftResponse = await this.generateDraftResponse(inquiry, talkingPoints, valuesCheck);

      // Step 6: Calculate suggested response time
      const suggestedResponseTime = this.calculateResponseTime(urgencyAnalysis, inquiry);

      // Compile triage result with full transparency
      const triageResult = {
        urgency: urgencyAnalysis.level,
        urgency_score: urgencyAnalysis.score,
        urgency_reasoning: urgencyAnalysis.reasoning,

        topic_sensitivity: sensitivityAnalysis.level,
        sensitivity_reasoning: sensitivityAnalysis.reasoning,

        involves_values: valuesCheck.involves_values,
        values_reasoning: valuesCheck.reasoning,
        boundary_enforcement: valuesCheck.boundary_enforcement,

        suggested_response_time: suggestedResponseTime,
        suggested_talking_points: talkingPoints,

        draft_response: draftResponse.content,
        draft_response_reasoning: draftResponse.reasoning,
        draft_requires_human_approval: true, // ALWAYS

        triaged_at: new Date(),
        ai_model: 'claude-3-5-sonnet-20241022',
        framework_compliance: {
          boundary_enforcer_checked: true,
          human_approval_required: true,
          reasoning_transparent: true
        }
      };

      logger.info(`Triage complete for inquiry ${inquiry._id}: urgency=${urgencyAnalysis.level}, values=${valuesCheck.involves_values}`);

      return triageResult;

    } catch (error) {
      logger.error('Media triage error:', error);
      throw new Error(`Triage failed: ${error.message}`);
    }
  }

  /**
   * Analyze urgency level of inquiry
   */
  async analyzeUrgency(inquiry) {
    const prompt = `Analyze the urgency of this media inquiry and provide a structured assessment.

INQUIRY DETAILS:
Subject: ${inquiry.inquiry.subject}
Message: ${inquiry.inquiry.message}
Deadline: ${inquiry.inquiry.deadline || 'Not specified'}
Outlet: ${inquiry.contact.outlet}

TASK:
1. Determine urgency level: HIGH, MEDIUM, or LOW
2. Provide urgency score (0-100)
3. Explain your reasoning

URGENCY GUIDELINES:
- HIGH (80-100): Breaking news, same-day deadline, crisis response
- MEDIUM (40-79): This week deadline, feature story, ongoing coverage
- LOW (0-39): No deadline, background research, general inquiry

Respond in JSON format:
{
  "level": "HIGH|MEDIUM|LOW",
  "score": 0-100,
  "reasoning": "2-3 sentence explanation"
}`;

    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;
      const analysis = JSON.parse(responseText);

      return {
        level: analysis.level.toLowerCase(),
        score: analysis.score,
        reasoning: analysis.reasoning
      };

    } catch (error) {
      logger.error('Urgency analysis error:', error);
      // Fallback to basic analysis
      return this.basicUrgencyAnalysis(inquiry);
    }
  }

  /**
   * Analyze topic sensitivity
   */
  async analyzeTopicSensitivity(inquiry) {
    const prompt = `Analyze the topic sensitivity of this media inquiry for an AI safety framework organization.

INQUIRY DETAILS:
Subject: ${inquiry.inquiry.subject}
Message: ${inquiry.inquiry.message}
Topics: ${inquiry.inquiry.topic_areas?.join(', ') || 'Not specified'}

TASK:
Determine if this inquiry touches on sensitive topics such as:
- Framework values or ethics
- Strategic partnerships
- Indigenous data sovereignty (Te Tiriti o Waitangi)
- Framework limitations or criticisms
- Controversial AI safety debates

Provide sensitivity level: HIGH, MEDIUM, or LOW

Respond in JSON format:
{
  "level": "HIGH|MEDIUM|LOW",
  "reasoning": "2-3 sentence explanation of why this topic is sensitive or not"
}`;

    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;
      const analysis = JSON.parse(responseText);

      return {
        level: analysis.level.toLowerCase(),
        reasoning: analysis.reasoning
      };

    } catch (error) {
      logger.error('Sensitivity analysis error:', error);
      // Fallback to keyword-based analysis
      return this.basicSensitivityAnalysis(inquiry);
    }
  }

  /**
   * Check if inquiry involves framework values (BoundaryEnforcer)
   */
  checkInvolvesValues(inquiry, sensitivityAnalysis) {
    // Keywords that indicate values territory
    const valuesKeywords = [
      'values', 'ethics', 'mission', 'principles', 'philosophy',
      'te tiriti', 'indigenous', 'sovereignty', 'partnership',
      'governance', 'strategy', 'direction', 'why tractatus'
    ];

    const combinedText = `${inquiry.inquiry.subject} ${inquiry.inquiry.message}`.toLowerCase();
    const hasValuesKeyword = valuesKeywords.some(keyword => combinedText.includes(keyword));
    const isHighSensitivity = sensitivityAnalysis.level === 'high';

    const involves_values = hasValuesKeyword || isHighSensitivity;

    return {
      involves_values,
      reasoning: involves_values
        ? 'This inquiry touches on framework values, strategic direction, or sensitive topics. Human approval required for any response (BoundaryEnforcer).'
        : 'This inquiry is operational/technical in nature. Standard response workflow applies.',
      boundary_enforcement: involves_values
        ? 'ENFORCED: Response must be reviewed and approved by John Stroh before sending.'
        : 'NOT_REQUIRED: Standard review process applies.',
      escalation_required: involves_values,
      escalation_reason: involves_values
        ? 'Values-sensitive topic detected by BoundaryEnforcer'
        : null
    };
  }

  /**
   * Generate suggested talking points
   */
  async generateTalkingPoints(inquiry, sensitivityAnalysis) {
    const prompt = `Generate 3-5 concise talking points for responding to this media inquiry about an AI safety framework.

INQUIRY DETAILS:
Subject: ${inquiry.inquiry.subject}
Message: ${inquiry.inquiry.message}
Sensitivity: ${sensitivityAnalysis.level}

GUIDELINES:
- Focus on factual, verifiable information
- Avoid speculation or aspirational claims
- Stay within established framework documentation
- Be honest about limitations
- NO fabricated statistics
- NO absolute guarantees

Respond with JSON array of talking points:
["Point 1", "Point 2", "Point 3", ...]`;

    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;
      const points = JSON.parse(responseText);

      return Array.isArray(points) ? points : [];

    } catch (error) {
      logger.error('Talking points generation error:', error);
      return [
        'Tractatus is a development-stage AI safety framework',
        'Focus on architectural safety guarantees and human oversight',
        'Open source and transparent governance'
      ];
    }
  }

  /**
   * Generate draft response (ALWAYS requires human approval)
   */
  async generateDraftResponse(inquiry, talkingPoints, valuesCheck) {
    const prompt = `Draft a professional response to this media inquiry. This draft will be reviewed and edited by humans before sending.

INQUIRY DETAILS:
From: ${inquiry.contact.name} (${inquiry.contact.outlet})
Subject: ${inquiry.inquiry.subject}
Message: ${inquiry.inquiry.message}

TALKING POINTS TO INCLUDE:
${talkingPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

VALUES CHECK:
${valuesCheck.involves_values ? '⚠️ This touches on framework values - response requires strategic approval' : 'Standard operational inquiry'}

GUIDELINES:
- Professional and helpful tone
- 2-3 paragraphs maximum
- Include contact info for follow-up
- Offer to provide additional resources
- Be honest about framework status (development stage)
- NO fabricated statistics or guarantees

Draft the response:`;

    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const draftContent = message.content[0].text;

      return {
        content: draftContent,
        reasoning: 'AI-generated draft based on talking points. MUST be reviewed and approved by human before sending.',
        requires_approval: true,
        approval_level: valuesCheck.involves_values ? 'STRATEGIC' : 'OPERATIONAL'
      };

    } catch (error) {
      logger.error('Draft response generation error:', error);
      return {
        content: `[DRAFT GENERATION FAILED - Manual response required]\n\nHi ${inquiry.contact.name},\n\nThank you for your inquiry about Tractatus. We'll get back to you shortly with a detailed response.\n\nBest regards,\nTractatus Team`,
        reasoning: 'Fallback template due to AI generation error',
        requires_approval: true,
        approval_level: 'OPERATIONAL'
      };
    }
  }

  /**
   * Calculate suggested response time in hours
   */
  calculateResponseTime(urgencyAnalysis, inquiry) {
    if (inquiry.inquiry.deadline) {
      const deadline = new Date(inquiry.inquiry.deadline);
      const now = new Date();
      const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);
      return Math.max(1, Math.floor(hoursUntilDeadline * 0.5)); // Aim for 50% of time to deadline
    }

    // Based on urgency score
    if (urgencyAnalysis.level === 'high') {
      return 4; // 4 hours
    } else if (urgencyAnalysis.level === 'medium') {
      return 24; // 1 day
    } else {
      return 72; // 3 days
    }
  }

  /**
   * Basic urgency analysis (fallback)
   */
  basicUrgencyAnalysis(inquiry) {
    const text = `${inquiry.inquiry.subject} ${inquiry.inquiry.message}`.toLowerCase();
    let score = 30; // Default low
    let level = 'low';

    // Check for urgency keywords
    for (const [urgencyLevel, keywords] of Object.entries(this.URGENCY_INDICATORS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          if (urgencyLevel === 'high') {
            score = 85;
            level = 'high';
          } else if (urgencyLevel === 'medium' && score < 60) {
            score = 60;
            level = 'medium';
          }
        }
      }
    }

    // Check deadline
    if (inquiry.inquiry.deadline) {
      const deadline = new Date(inquiry.inquiry.deadline);
      const now = new Date();
      const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);

      if (hoursUntilDeadline < 24) {
        score = 90;
        level = 'high';
      } else if (hoursUntilDeadline < 72) {
        score = 65;
        level = 'medium';
      }
    }

    return {
      level,
      score,
      reasoning: `Basic analysis based on keywords and deadline. Urgency level: ${level}.`
    };
  }

  /**
   * Basic sensitivity analysis (fallback)
   */
  basicSensitivityAnalysis(inquiry) {
    const text = `${inquiry.inquiry.subject} ${inquiry.inquiry.message}`.toLowerCase();
    let level = 'low';

    for (const keyword of this.SENSITIVE_TOPICS) {
      if (text.includes(keyword)) {
        level = 'high';
        break;
      }
    }

    return {
      level,
      reasoning: level === 'high'
        ? 'Topic involves potentially sensitive framework areas'
        : 'Standard operational inquiry'
    };
  }

  /**
   * Get triage statistics for transparency
   */
  async getTriageStats(inquiries) {
    const stats = {
      total_triaged: inquiries.length,
      by_urgency: {
        high: 0,
        medium: 0,
        low: 0
      },
      by_sensitivity: {
        high: 0,
        medium: 0,
        low: 0
      },
      involves_values_count: 0,
      boundary_enforcements: 0,
      avg_response_time_hours: 0,
      human_overrides: 0
    };

    for (const inquiry of inquiries) {
      if (inquiry.ai_triage) {
        // Count by urgency
        if (inquiry.ai_triage.urgency) {
          stats.by_urgency[inquiry.ai_triage.urgency]++;
        }

        // Count by sensitivity
        if (inquiry.ai_triage.topic_sensitivity) {
          stats.by_sensitivity[inquiry.ai_triage.topic_sensitivity]++;
        }

        // Count values involvements
        if (inquiry.ai_triage.involves_values) {
          stats.involves_values_count++;
          stats.boundary_enforcements++;
        }

        // Average response time
        if (inquiry.ai_triage.suggested_response_time) {
          stats.avg_response_time_hours += inquiry.ai_triage.suggested_response_time;
        }
      }
    }

    if (stats.total_triaged > 0) {
      stats.avg_response_time_hours = Math.round(stats.avg_response_time_hours / stats.total_triaged);
    }

    return stats;
  }
}

module.exports = new MediaTriageService();
