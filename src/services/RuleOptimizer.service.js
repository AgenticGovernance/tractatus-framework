/**
 * Rule Optimizer Service
 *
 * Analyzes governance rules for clarity, specificity, and actionability.
 * Provides optimization suggestions to improve rule quality.
 *
 * Part of Phase 2: AI Rule Optimizer & CLAUDE.md Analyzer
 */

class RuleOptimizer {
  constructor() {
    // Weak language that reduces rule clarity
    this.weakWords = [
      'try', 'maybe', 'consider', 'might', 'probably',
      'possibly', 'perhaps', 'could', 'should'
    ];

    // Strong imperatives that improve clarity
    this.strongWords = [
      'MUST', 'SHALL', 'REQUIRED', 'PROHIBITED',
      'NEVER', 'ALWAYS', 'MANDATORY'
    ];

    // Hedging phrases that reduce actionability
    this.hedgingPhrases = [
      'if possible', 'when convenient', 'as needed',
      'try to', 'attempt to', 'ideally'
    ];

    // Vague terms that reduce specificity
    this.vagueTerms = [
      'this project', 'the system', 'the application',
      'things', 'stuff', 'appropriately', 'properly',
      'correctly', 'efficiently'
    ];
  }

  /**
   * Analyze rule clarity (0-100)
   *
   * Measures how unambiguous and clear the rule is.
   * Penalizes weak language, rewards strong imperatives.
   *
   * @param {string} ruleText - The rule text to analyze
   * @returns {Object} { score: number, issues: string[], strengths: string[] }
   */
  analyzeClarity(ruleText) {
    let score = 100;
    const issues = [];
    const strengths = [];

    // Check for weak words (heavy penalty)
    this.weakWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(ruleText)) {
        score -= 15;
        issues.push(`Weak language detected: "${word}" - reduces clarity`);
      }
    });

    // Check for strong imperatives (bonus)
    const hasStrong = this.strongWords.some(word =>
      new RegExp(`\\b${word}\\b`).test(ruleText)
    );
    if (hasStrong) {
      strengths.push('Uses strong imperative language (MUST, SHALL, etc.)');
    } else {
      score -= 10;
      issues.push('No strong imperatives found - add MUST, SHALL, REQUIRED, etc.');
    }

    // Check for hedging phrases
    this.hedgingPhrases.forEach(phrase => {
      if (ruleText.toLowerCase().includes(phrase)) {
        score -= 10;
        issues.push(`Hedging detected: "${phrase}" - reduces certainty`);
      }
    });

    // Check for specificity indicators
    const hasVariables = /\$\{[A-Z_]+\}/.test(ruleText);
    const hasNumbers = /\d/.test(ruleText);

    if (hasVariables) {
      strengths.push('Uses variables for parameterization');
    } else if (!hasNumbers) {
      score -= 10;
      issues.push('No specific parameters (numbers or variables) - add concrete values');
    }

    // Check for context (WHO, WHAT, WHERE)
    if (ruleText.length < 20) {
      score -= 15;
      issues.push('Too brief - lacks context (WHO, WHAT, WHEN, WHERE)');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      strengths
    };
  }

  /**
   * Analyze rule specificity (0-100)
   *
   * Measures how concrete and specific the rule is.
   * Rewards explicit parameters, penalizes vague terms.
   *
   * @param {string} ruleText - The rule text to analyze
   * @returns {Object} { score: number, issues: string[], strengths: string[] }
   */
  analyzeSpecificity(ruleText) {
    let score = 100;
    const issues = [];
    const strengths = [];

    // Check for vague terms
    this.vagueTerms.forEach(term => {
      if (ruleText.toLowerCase().includes(term)) {
        score -= 12;
        issues.push(`Vague term: "${term}" - be more specific`);
      }
    });

    // Check for concrete parameters
    const hasVariables = /\$\{[A-Z_]+\}/.test(ruleText);
    const hasNumbers = /\d+/.test(ruleText);
    const hasPaths = /[\/\\][\w\/\\-]+/.test(ruleText);
    const hasUrls = /https?:\/\//.test(ruleText);
    const hasFilenames = /\.\w{2,4}/.test(ruleText);

    let specificityCount = 0;
    if (hasVariables) {
      strengths.push('Includes variables for parameterization');
      specificityCount++;
    }
    if (hasNumbers) {
      strengths.push('Includes specific numbers (ports, counts, etc.)');
      specificityCount++;
    }
    if (hasPaths) {
      strengths.push('Includes file paths or directories');
      specificityCount++;
    }
    if (hasUrls) {
      strengths.push('Includes URLs or domains');
      specificityCount++;
    }
    if (hasFilenames) {
      strengths.push('Includes specific filenames');
      specificityCount++;
    }

    if (specificityCount === 0) {
      score -= 20;
      issues.push('No concrete parameters - add numbers, paths, variables, or URLs');
    }

    // Check for examples (inline)
    if (ruleText.includes('e.g.') || ruleText.includes('example:')) {
      strengths.push('Includes examples for clarification');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      strengths
    };
  }

  /**
   * Analyze rule actionability (0-100)
   *
   * Measures how clearly the rule can be acted upon.
   * Checks for WHO, WHAT, WHEN, WHERE elements.
   *
   * @param {string} ruleText - The rule text to analyze
   * @returns {Object} { score: number, issues: string[], strengths: string[] }
   */
  analyzeActionability(ruleText) {
    let score = 100;
    const issues = [];
    const strengths = [];

    // Check for action elements
    const hasSubject = /\b(all|every|any|developer|user|system|database|api|file)\b/i.test(ruleText);
    const hasAction = /\b(use|create|delete|update|set|configure|deploy|test|validate)\b/i.test(ruleText);
    const hasObject = /\b(port|database|file|config|environment|variable|parameter)\b/i.test(ruleText);

    if (hasSubject) {
      strengths.push('Specifies WHO/WHAT should act');
    } else {
      score -= 15;
      issues.push('Missing subject - specify WHO or WHAT (e.g., "Database", "All files")');
    }

    if (hasAction) {
      strengths.push('Includes clear action verb');
    } else {
      score -= 15;
      issues.push('Missing action verb - specify WHAT TO DO (e.g., "use", "create", "delete")');
    }

    if (hasObject) {
      strengths.push('Specifies target object');
    } else {
      score -= 10;
      issues.push('Missing object - specify the target (e.g., "port 27017", "config file")');
    }

    // Check for conditions (IF-THEN structure)
    const hasConditional = /\b(if|when|unless|while|during|before|after)\b/i.test(ruleText);
    if (hasConditional) {
      strengths.push('Includes conditional logic (IF-THEN)');
    }

    // Check for exceptions (BUT, EXCEPT, UNLESS)
    const hasException = /\b(except|unless|but|excluding)\b/i.test(ruleText);
    if (hasException) {
      strengths.push('Defines exceptions or boundary conditions');
    }

    // Check for measurability
    const hasMeasurableOutcome = /\b(all|every|zero|100%|always|never|exactly)\b/i.test(ruleText);
    if (hasMeasurableOutcome) {
      strengths.push('Includes measurable outcome');
    } else {
      score -= 10;
      issues.push('Hard to verify - add measurable outcomes (e.g., "all", "never", "100%")');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      strengths
    };
  }

  /**
   * Suggest optimizations for a rule
   *
   * @param {string} ruleText - The rule text to optimize
   * @returns {Array<Object>} Array of suggestions with before/after
   */
  suggestOptimizations(ruleText) {
    const suggestions = [];

    // Suggest replacing weak language with strong imperatives
    this.weakWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(ruleText)) {
        let replacement = 'MUST';
        if (word === 'try' || word === 'attempt') replacement = 'MUST';
        else if (word === 'should') replacement = 'MUST';
        else if (word === 'consider') replacement = 'MUST';

        const optimized = ruleText.replace(
          new RegExp(`\\b${word}\\b`, 'i'),
          replacement
        );

        suggestions.push({
          type: 'weak_language',
          severity: 'high',
          original: word,
          before: ruleText,
          after: optimized,
          reason: `"${word}" is weak language - replaced with "${replacement}" for clarity`
        });
      }
    });

    // Suggest replacing vague terms with variables
    if (ruleText.toLowerCase().includes('this project')) {
      suggestions.push({
        type: 'vague_term',
        severity: 'medium',
        original: 'this project',
        before: ruleText,
        after: ruleText.replace(/this project/gi, '${PROJECT_NAME} project'),
        reason: '"this project" is vague - use ${PROJECT_NAME} variable for clarity'
      });
    }

    if (ruleText.toLowerCase().includes('the database') && !/\$\{DB_TYPE\}/.test(ruleText)) {
      suggestions.push({
        type: 'vague_term',
        severity: 'medium',
        original: 'the database',
        before: ruleText,
        after: ruleText.replace(/the database/gi, '${DB_TYPE} database'),
        reason: '"the database" is vague - specify ${DB_TYPE} for clarity'
      });
    }

    // Suggest adding strong imperatives if missing
    const hasStrong = this.strongWords.some(word =>
      new RegExp(`\\b${word}\\b`).test(ruleText)
    );
    if (!hasStrong && !ruleText.startsWith('MUST') && !ruleText.startsWith('SHALL')) {
      suggestions.push({
        type: 'missing_imperative',
        severity: 'high',
        original: ruleText.substring(0, 20) + '...',
        before: ruleText,
        after: 'MUST ' + ruleText.charAt(0).toLowerCase() + ruleText.slice(1),
        reason: 'No strong imperative - added "MUST" at start for clarity'
      });
    }

    // Suggest removing hedging
    this.hedgingPhrases.forEach(phrase => {
      if (ruleText.toLowerCase().includes(phrase)) {
        suggestions.push({
          type: 'hedging',
          severity: 'medium',
          original: phrase,
          before: ruleText,
          after: ruleText.replace(new RegExp(phrase, 'gi'), ''),
          reason: `"${phrase}" is hedging language - removed for certainty`
        });
      }
    });

    return suggestions;
  }

  /**
   * Auto-optimize a rule text
   *
   * @param {string} ruleText - The rule text to optimize
   * @param {Object} options - Optimization options
   * @param {string} options.mode - 'aggressive' (apply all) or 'conservative' (apply safe ones)
   * @returns {Object} { optimized: string, changes: Array, before: string, after: string }
   */
  optimize(ruleText, options = { mode: 'conservative' }) {
    const suggestions = this.suggestOptimizations(ruleText);
    let optimized = ruleText;
    const appliedChanges = [];

    suggestions.forEach(suggestion => {
      // In conservative mode, only apply high-severity changes
      if (options.mode === 'conservative' && suggestion.severity !== 'high') {
        return;
      }

      // Apply the optimization
      optimized = suggestion.after;
      appliedChanges.push({
        type: suggestion.type,
        original: suggestion.original,
        reason: suggestion.reason
      });
    });

    return {
      optimized,
      changes: appliedChanges,
      before: ruleText,
      after: optimized,
      improvementScore: this._calculateImprovement(ruleText, optimized)
    };
  }

  /**
   * Calculate improvement score between before and after
   *
   * @private
   * @param {string} before - Original rule text
   * @param {string} after - Optimized rule text
   * @returns {number} Improvement percentage
   */
  _calculateImprovement(before, after) {
    const scoreBefore = this.analyzeClarity(before).score;
    const scoreAfter = this.analyzeClarity(after).score;

    return Math.round(((scoreAfter - scoreBefore) / scoreBefore) * 100);
  }

  /**
   * Comprehensive rule analysis
   *
   * Runs all analysis types and returns complete report
   *
   * @param {string} ruleText - The rule text to analyze
   * @returns {Object} Complete analysis report
   */
  analyzeRule(ruleText) {
    const clarity = this.analyzeClarity(ruleText);
    const specificity = this.analyzeSpecificity(ruleText);
    const actionability = this.analyzeActionability(ruleText);
    const suggestions = this.suggestOptimizations(ruleText);

    // Calculate overall quality score (weighted average)
    const overallScore = Math.round(
      (clarity.score * 0.4) +
      (specificity.score * 0.3) +
      (actionability.score * 0.3)
    );

    return {
      overallScore,
      clarity: {
        score: clarity.score,
        grade: this._getGrade(clarity.score),
        issues: clarity.issues,
        strengths: clarity.strengths
      },
      specificity: {
        score: specificity.score,
        grade: this._getGrade(specificity.score),
        issues: specificity.issues,
        strengths: specificity.strengths
      },
      actionability: {
        score: actionability.score,
        grade: this._getGrade(actionability.score),
        issues: actionability.issues,
        strengths: actionability.strengths
      },
      suggestions,
      recommendedAction: this._getRecommendedAction(overallScore, suggestions)
    };
  }

  /**
   * Convert score to letter grade
   * @private
   */
  _getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Get recommended action based on score and suggestions
   * @private
   */
  _getRecommendedAction(score, suggestions) {
    if (score >= 90) {
      return 'Excellent - no changes needed';
    }
    if (score >= 80) {
      return 'Good - consider minor improvements';
    }
    if (score >= 70) {
      return 'Acceptable - improvements recommended';
    }
    if (score >= 60) {
      return 'Needs improvement - apply suggestions';
    }
    return 'Poor quality - significant rewrite needed';
  }
}

module.exports = new RuleOptimizer();
