/**
 * CLAUDE.md Analyzer Service
 *
 * Parses CLAUDE.md files and extracts candidate governance rules.
 * Classifies statements by quality and provides migration recommendations.
 *
 * Part of Phase 2: AI Rule Optimizer & CLAUDE.md Analyzer
 */

const RuleOptimizer = require('./RuleOptimizer.service');

class ClaudeMdAnalyzer {
  constructor() {
    // Keywords for quadrant classification
    this.quadrantKeywords = {
      STRATEGIC: ['architecture', 'design', 'philosophy', 'approach', 'values', 'mission', 'vision', 'goal'],
      OPERATIONAL: ['workflow', 'process', 'procedure', 'convention', 'standard', 'practice', 'guideline'],
      TACTICAL: ['implementation', 'code', 'function', 'class', 'variable', 'syntax', 'pattern'],
      SYSTEM: ['port', 'database', 'server', 'infrastructure', 'deployment', 'environment', 'service'],
      STORAGE: ['state', 'session', 'cache', 'persistence', 'data', 'storage', 'memory']
    };

    // Imperative indicators (for HIGH persistence)
    this.imperatives = ['MUST', 'SHALL', 'REQUIRED', 'PROHIBITED', 'NEVER', 'ALWAYS', 'MANDATORY'];

    // Preference indicators (for MEDIUM persistence)
    this.preferences = ['SHOULD', 'RECOMMENDED', 'PREFERRED', 'ENCOURAGED'];

    // Suggestion indicators (for LOW persistence)
    this.suggestions = ['MAY', 'CAN', 'CONSIDER', 'TRY', 'MIGHT'];
  }

  /**
   * Parse CLAUDE.md content into structured sections
   *
   * @param {string} content - Raw CLAUDE.md content
   * @returns {Object} Parsed structure with sections
   */
  parse(content) {
    const lines = content.split('\n');
    const sections = [];
    let currentSection = null;

    lines.forEach((line, index) => {
      // Detect headings (# or ##)
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          level: headingMatch[1].length,
          title: headingMatch[2].trim(),
          content: [],
          lineStart: index
        };
      } else if (currentSection && line.trim()) {
        currentSection.content.push(line.trim());
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    return {
      totalLines: lines.length,
      sections,
      content: content
    };
  }

  /**
   * Extract candidate rules from parsed content
   *
   * @param {Object} parsedContent - Output from parse()
   * @returns {Array<Object>} Array of candidate rules
   */
  extractCandidateRules(parsedContent) {
    const candidates = [];

    parsedContent.sections.forEach(section => {
      section.content.forEach(statement => {
        // Skip very short statements
        if (statement.length < 15) return;

        // Detect if statement has imperative language
        const hasImperative = this.imperatives.some(word =>
          new RegExp(`\\b${word}\\b`).test(statement)
        );

        const hasPreference = this.preferences.some(word =>
          new RegExp(`\\b${word}\\b`, 'i').test(statement)
        );

        const hasSuggestion = this.suggestions.some(word =>
          new RegExp(`\\b${word}\\b`, 'i').test(statement)
        );

        // Only process statements with governance language
        if (!hasImperative && !hasPreference && !hasSuggestion) {
          return;
        }

        // Classify quadrant based on keywords
        const quadrant = this._classifyQuadrant(statement);

        // Classify persistence based on language strength
        let persistence = 'LOW';
        if (hasImperative) persistence = 'HIGH';
        else if (hasPreference) persistence = 'MEDIUM';

        // Detect parameters (ports, paths, etc.)
        const parameters = this._extractParameters(statement);

        // Analyze quality using RuleOptimizer
        const analysis = RuleOptimizer.analyzeRule(statement);

        // Determine quality tier
        let quality = 'TOO_NEBULOUS';
        let autoConvert = false;

        if (analysis.overallScore >= 80) {
          quality = 'HIGH';
          autoConvert = true;
        } else if (analysis.overallScore >= 60) {
          quality = 'NEEDS_CLARIFICATION';
          autoConvert = false;
        }

        // Generate optimized version
        const optimized = RuleOptimizer.optimize(statement, { mode: 'aggressive' });

        candidates.push({
          originalText: statement,
          sectionTitle: section.title,
          quadrant,
          persistence,
          parameters,
          quality,
          autoConvert,
          analysis: {
            clarityScore: analysis.clarity.score,
            specificityScore: analysis.specificity.score,
            actionabilityScore: analysis.actionability.score,
            overallScore: analysis.overallScore,
            issues: [
              ...analysis.clarity.issues,
              ...analysis.specificity.issues,
              ...analysis.actionability.issues
            ]
          },
          suggestedRule: {
            text: optimized.optimized,
            scope: this._determineScope(optimized.optimized),
            quadrant,
            persistence,
            variables: this._detectVariables(optimized.optimized),
            clarityScore: RuleOptimizer.analyzeRule(optimized.optimized).overallScore
          },
          improvements: analysis.suggestions.map(s => s.reason)
        });
      });
    });

    return candidates;
  }

  /**
   * Detect redundant rules
   *
   * @param {Array<Object>} candidates - Candidate rules
   * @returns {Array<Object>} Redundancy groups with merge suggestions
   */
  detectRedundancies(candidates) {
    const redundancies = [];
    const processed = new Set();

    for (let i = 0; i < candidates.length; i++) {
      if (processed.has(i)) continue;

      const similar = [];
      for (let j = i + 1; j < candidates.length; j++) {
        if (processed.has(j)) continue;

        const similarity = this._calculateSimilarity(
          candidates[i].originalText,
          candidates[j].originalText
        );

        if (similarity > 0.7) {
          similar.push(j);
        }
      }

      if (similar.length > 0) {
        const group = [candidates[i], ...similar.map(idx => candidates[idx])];
        similar.forEach(idx => processed.add(idx));
        processed.add(i);

        redundancies.push({
          rules: group.map(c => c.originalText),
          mergeSuggestion: this._suggestMerge(group)
        });
      }
    }

    return redundancies;
  }

  /**
   * Generate migration plan from analysis
   *
   * @param {Object} analysis - Complete analysis with candidates and redundancies
   * @returns {Object} Migration plan
   */
  generateMigrationPlan(analysis) {
    const { candidates, redundancies } = analysis;

    const highQuality = candidates.filter(c => c.quality === 'HIGH');
    const needsClarification = candidates.filter(c => c.quality === 'NEEDS_CLARIFICATION');
    const tooNebulous = candidates.filter(c => c.quality === 'TOO_NEBULOUS');

    return {
      summary: {
        totalStatements: candidates.length,
        highQuality: highQuality.length,
        needsClarification: needsClarification.length,
        tooNebulous: tooNebulous.length,
        redundancies: redundancies.length,
        autoConvertable: candidates.filter(c => c.autoConvert).length
      },
      steps: [
        {
          phase: 'Auto-Convert',
          count: highQuality.length,
          description: 'High-quality rules that can be auto-converted',
          rules: highQuality.map(c => c.suggestedRule)
        },
        {
          phase: 'Review & Clarify',
          count: needsClarification.length,
          description: 'Rules needing clarification before conversion',
          rules: needsClarification.map(c => ({
            original: c.originalText,
            suggested: c.suggestedRule,
            issues: c.analysis.issues,
            improvements: c.improvements
          }))
        },
        {
          phase: 'Manual Rewrite',
          count: tooNebulous.length,
          description: 'Statements too vague - require manual rewrite',
          rules: tooNebulous.map(c => ({
            original: c.originalText,
            suggestions: c.improvements
          }))
        },
        {
          phase: 'Merge Redundancies',
          count: redundancies.length,
          description: 'Similar rules that should be merged',
          groups: redundancies
        }
      ],
      estimatedTime: this._estimateMigrationTime(candidates, redundancies)
    };
  }

  /**
   * Analyze complete CLAUDE.md file
   *
   * @param {string} content - CLAUDE.md content
   * @returns {Object} Complete analysis
   */
  analyze(content) {
    const parsed = this.parse(content);
    const candidates = this.extractCandidateRules(parsed);
    const redundancies = this.detectRedundancies(candidates);
    const migrationPlan = this.generateMigrationPlan({ candidates, redundancies });

    return {
      parsed,
      candidates,
      redundancies,
      migrationPlan,
      quality: {
        highQuality: candidates.filter(c => c.quality === 'HIGH').length,
        needsClarification: candidates.filter(c => c.quality === 'NEEDS_CLARIFICATION').length,
        tooNebulous: candidates.filter(c => c.quality === 'TOO_NEBULOUS').length,
        averageScore: Math.round(
          candidates.reduce((sum, c) => sum + c.analysis.overallScore, 0) / candidates.length
        )
      }
    };
  }

  // ========== PRIVATE HELPER METHODS ==========

  /**
   * Classify statement into Tractatus quadrant
   * @private
   */
  _classifyQuadrant(statement) {
    const lower = statement.toLowerCase();
    let bestMatch = 'TACTICAL';
    let maxMatches = 0;

    for (const [quadrant, keywords] of Object.entries(this.quadrantKeywords)) {
      const matches = keywords.filter(keyword => lower.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = quadrant;
      }
    }

    return bestMatch;
  }

  /**
   * Extract parameters from statement (ports, paths, etc.)
   * @private
   */
  _extractParameters(statement) {
    const parameters = {};

    // Port numbers
    const portMatch = statement.match(/port\s+(\d+)/i);
    if (portMatch) {
      parameters.port = portMatch[1];
    }

    // Database types
    const dbMatch = statement.match(/\b(mongodb|postgresql|mysql|redis)\b/i);
    if (dbMatch) {
      parameters.database = dbMatch[1];
    }

    // Paths
    const pathMatch = statement.match(/[\/\\][\w\/\\.-]+/);
    if (pathMatch) {
      parameters.path = pathMatch[0];
    }

    // Environment
    const envMatch = statement.match(/\b(production|development|staging|test)\b/i);
    if (envMatch) {
      parameters.environment = envMatch[1];
    }

    return parameters;
  }

  /**
   * Detect variables in optimized text
   * @private
   */
  _detectVariables(text) {
    const matches = text.matchAll(/\$\{([A-Z_]+)\}/g);
    return Array.from(matches, m => m[1]);
  }

  /**
   * Determine if rule should be universal or project-specific
   * @private
   */
  _determineScope(text) {
    // If has variables, likely universal
    if (this._detectVariables(text).length > 0) {
      return 'UNIVERSAL';
    }

    // If references specific project name, project-specific
    if (/\b(tractatus|family-history|sydigital)\b/i.test(text)) {
      return 'PROJECT_SPECIFIC';
    }

    // Default to universal for reusability
    return 'UNIVERSAL';
  }

  /**
   * Calculate text similarity (Jaccard coefficient)
   * @private
   */
  _calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Suggest merged rule from similar rules
   * @private
   */
  _suggestMerge(group) {
    // Take the most specific rule as base
    const sorted = group.sort((a, b) =>
      b.analysis.specificityScore - a.analysis.specificityScore
    );

    return sorted[0].suggestedRule.text;
  }

  /**
   * Estimate time needed for migration
   * @private
   */
  _estimateMigrationTime(candidates, redundancies) {
    const autoConvert = candidates.filter(c => c.autoConvert).length;
    const needsReview = candidates.filter(c => !c.autoConvert && c.quality !== 'TOO_NEBULOUS').length;
    const needsRewrite = candidates.filter(c => c.quality === 'TOO_NEBULOUS').length;

    // Auto-convert: 1 min each (review)
    // Needs review: 5 min each (review + edit)
    // Needs rewrite: 10 min each (rewrite from scratch)
    // Redundancies: 3 min each (merge)

    const minutes = (autoConvert * 1) +
                   (needsReview * 5) +
                   (needsRewrite * 10) +
                   (redundancies.length * 3);

    return {
      minutes,
      hours: Math.round(minutes / 60 * 10) / 10,
      breakdown: {
        autoConvert: `${autoConvert} rules × 1 min = ${autoConvert} min`,
        needsReview: `${needsReview} rules × 5 min = ${needsReview * 5} min`,
        needsRewrite: `${needsRewrite} rules × 10 min = ${needsRewrite * 10} min`,
        redundancies: `${redundancies.length} groups × 3 min = ${redundancies.length * 3} min`
      }
    };
  }
}

module.exports = new ClaudeMdAnalyzer();
