/**
 * Variable Substitution Service
 *
 * Handles extraction and substitution of variables in governance rule text.
 * Transforms template rules like "Use ${DB_NAME} database" into context-specific
 * rules like "Use tractatus_dev database" based on project context.
 *
 * Algorithm:
 * 1. Extract all ${VAR_NAME} placeholders from text
 * 2. Query VariableValue collection for project-specific values
 * 3. Build substitution map
 * 4. Replace placeholders with actual values
 * 5. Return rendered text + metadata
 */

const VariableValue = require('../models/VariableValue.model');
const GovernanceRule = require('../models/GovernanceRule.model');

class VariableSubstitutionService {
  /**
   * Extract variable names from text
   * @param {string} text - Text containing ${VAR_NAME} placeholders
   * @returns {Array<string>} - Unique variable names found
   *
   * @example
   * extractVariables("Use ${DB_NAME} on port ${DB_PORT}")
   * // Returns: ['DB_NAME', 'DB_PORT']
   */
  extractVariables(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Regex to match ${VAR_NAME} where VAR_NAME is UPPER_SNAKE_CASE
    const regex = /\$\{([A-Z][A-Z0-9_]*)\}/g;
    const matches = [...text.matchAll(regex)];

    // Extract variable names and remove duplicates
    const variableNames = matches.map(match => match[1]);
    return [...new Set(variableNames)];
  }

  /**
   * Substitute variables in text for specific project
   * @param {string} text - Template text with ${VAR} placeholders
   * @param {string} projectId - Project identifier
   * @param {Object} options - Options for substitution
   * @param {boolean} options.strict - If true, throw error on missing values (default: false)
   * @param {boolean} options.trackUsage - If true, increment usage counters (default: false)
   * @returns {Promise<{renderedText: string, variables: Array, hasAllValues: boolean}>}
   *
   * @example
   * await substituteVariables(
   *   "Use ${DB_NAME} on port ${DB_PORT}",
   *   "tractatus"
   * )
   * // Returns: {
   * //   renderedText: "Use tractatus_dev on port 27017",
   * //   variables: [
   * //     {name: 'DB_NAME', value: 'tractatus_dev', missing: false},
   * //     {name: 'DB_PORT', value: '27017', missing: false}
   * //   ],
   * //   hasAllValues: true
   * // }
   */
  async substituteVariables(text, projectId, options = {}) {
    const { strict = false, trackUsage = false } = options;

    // Handle empty or invalid input
    if (!text || typeof text !== 'string') {
      return {
        renderedText: text || '',
        variables: [],
        hasAllValues: true
      };
    }

    // Extract variable names
    const variableNames = this.extractVariables(text);

    // If no variables, return original text
    if (variableNames.length === 0) {
      return {
        renderedText: text,
        variables: [],
        hasAllValues: true
      };
    }

    // Fetch values from database
    const values = await VariableValue.findValues(projectId, variableNames);

    // Build substitution map and track which values are found
    const substitutionMap = {};
    const foundVariables = new Set();

    values.forEach(v => {
      substitutionMap[v.variableName] = v.value;
      foundVariables.add(v.variableName);

      // Increment usage counter if requested
      if (trackUsage) {
        v.incrementUsage().catch(err => {
          console.error(`Failed to increment usage for ${v.variableName}:`, err);
        });
      }
    });

    // Check for missing values
    const missingVariables = variableNames.filter(name => !foundVariables.has(name));

    // In strict mode, throw error if any values are missing
    if (strict && missingVariables.length > 0) {
      throw new Error(
        `Missing variable values for project "${projectId}": ${missingVariables.join(', ')}`
      );
    }

    // Replace ${VAR} with actual values
    // If value not found, keep placeholder (or use empty string in strict mode)
    const renderedText = text.replace(
      /\$\{([A-Z][A-Z0-9_]*)\}/g,
      (match, varName) => {
        if (substitutionMap[varName] !== undefined) {
          return substitutionMap[varName];
        }
        // Keep placeholder if value not found (non-strict mode)
        return match;
      }
    );

    // Build metadata about variables used
    const variables = variableNames.map(name => ({
      name,
      value: substitutionMap[name] || null,
      missing: !foundVariables.has(name)
    }));

    return {
      renderedText,
      variables,
      hasAllValues: missingVariables.length === 0
    };
  }

  /**
   * Substitute variables in a governance rule object
   * @param {Object} rule - GovernanceRule document
   * @param {string} projectId - Project identifier
   * @param {Object} options - Substitution options
   * @returns {Promise<Object>} - Rule with renderedText added
   */
  async substituteRule(rule, projectId, options = {}) {
    const result = await this.substituteVariables(rule.text, projectId, options);

    return {
      ...rule.toObject(),
      renderedText: result.renderedText,
      substitutionMetadata: {
        variables: result.variables,
        hasAllValues: result.hasAllValues,
        projectId
      }
    };
  }

  /**
   * Substitute variables in multiple rules
   * @param {Array<Object>} rules - Array of GovernanceRule documents
   * @param {string} projectId - Project identifier
   * @param {Object} options - Substitution options
   * @returns {Promise<Array<Object>>} - Rules with renderedText added
   */
  async substituteRules(rules, projectId, options = {}) {
    return Promise.all(
      rules.map(rule => this.substituteRule(rule, projectId, options))
    );
  }

  /**
   * Get all unique variable names across all active rules
   * @returns {Promise<Array<{name: string, usageCount: number, rules: Array<string>}>>}
   */
  async getAllVariables() {
    const rules = await GovernanceRule.find({ active: true }, 'id text variables');

    // Build map of variable usage
    const variableMap = new Map();

    rules.forEach(rule => {
      if (rule.variables && rule.variables.length > 0) {
        rule.variables.forEach(varName => {
          if (!variableMap.has(varName)) {
            variableMap.set(varName, {
              name: varName,
              usageCount: 0,
              rules: []
            });
          }

          const varData = variableMap.get(varName);
          varData.usageCount += 1;
          varData.rules.push(rule.id);
        });
      }
    });

    // Convert map to sorted array
    return Array.from(variableMap.values())
      .sort((a, b) => b.usageCount - a.usageCount); // Sort by usage count descending
  }

  /**
   * Validate that a project has all required variable values
   * @param {string} projectId - Project identifier
   * @param {Array<string>} scope - Optional filter by scope (UNIVERSAL, PROJECT_SPECIFIC)
   * @returns {Promise<{complete: boolean, missing: Array<{variable: string, rules: Array<string>}>, total: number, defined: number}>}
   */
  async validateProjectVariables(projectId, scope = null) {
    // Get all rules applicable to this project
    const query = {
      active: true,
      $or: [
        { scope: 'UNIVERSAL' },
        { applicableProjects: projectId },
        { applicableProjects: '*' }
      ]
    };

    if (scope) {
      query.scope = scope;
    }

    const rules = await GovernanceRule.find(query, 'id text variables');

    // Collect all unique variables required
    const requiredVariables = new Map(); // varName => [ruleIds]

    rules.forEach(rule => {
      if (rule.variables && rule.variables.length > 0) {
        rule.variables.forEach(varName => {
          if (!requiredVariables.has(varName)) {
            requiredVariables.set(varName, []);
          }
          requiredVariables.get(varName).push(rule.id);
        });
      }
    });

    // Check which variables have values defined
    const varNames = Array.from(requiredVariables.keys());
    const definedValues = await VariableValue.findValues(projectId, varNames);
    const definedVarNames = new Set(definedValues.map(v => v.variableName));

    // Find missing variables
    const missing = [];
    requiredVariables.forEach((ruleIds, varName) => {
      if (!definedVarNames.has(varName)) {
        missing.push({
          variable: varName,
          rules: ruleIds,
          affectedRuleCount: ruleIds.length
        });
      }
    });

    return {
      complete: missing.length === 0,
      missing,
      total: varNames.length,
      defined: definedVarNames.size
    };
  }

  /**
   * Preview how a rule would look with current variable values
   * @param {string} ruleText - Rule template text
   * @param {string} projectId - Project identifier
   * @returns {Promise<{preview: string, missingVariables: Array<string>}>}
   */
  async previewRule(ruleText, projectId) {
    const result = await this.substituteVariables(ruleText, projectId);

    return {
      preview: result.renderedText,
      missingVariables: result.variables
        .filter(v => v.missing)
        .map(v => v.name)
    };
  }

  /**
   * Get suggested variable names from text (extract but don't substitute)
   * Useful for migration or rule creation
   * @param {string} text - Text to analyze
   * @returns {Array<{name: string, placeholder: string, positions: Array<number>}>}
   */
  getSuggestedVariables(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const regex = /\$\{([A-Z][A-Z0-9_]*)\}/g;
    const suggestions = new Map();
    let match;

    while ((match = regex.exec(text)) !== null) {
      const varName = match[1];
      const placeholder = match[0];
      const position = match.index;

      if (!suggestions.has(varName)) {
        suggestions.set(varName, {
          name: varName,
          placeholder,
          positions: []
        });
      }

      suggestions.get(varName).positions.push(position);
    }

    return Array.from(suggestions.values());
  }
}

// Export singleton instance
module.exports = new VariableSubstitutionService();
