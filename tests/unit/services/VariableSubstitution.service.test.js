/**
 * Variable Substitution Service - Unit Tests
 *
 * Tests the core variable substitution logic without database dependencies.
 * Integration tests will cover database interactions.
 */

const VariableSubstitutionService = require('../../../src/services/VariableSubstitution.service');

describe('VariableSubstitutionService', () => {
  describe('extractVariables', () => {
    it('should extract single variable from text', () => {
      const text = 'Use database ${DB_NAME}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['DB_NAME']);
    });

    it('should extract multiple variables from text', () => {
      const text = 'Use ${DB_NAME} on port ${DB_PORT} in ${ENVIRONMENT}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['DB_NAME', 'DB_PORT', 'ENVIRONMENT']);
    });

    it('should remove duplicate variables', () => {
      const text = 'Copy ${FILE_PATH} to ${FILE_PATH} backup';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['FILE_PATH']);
    });

    it('should handle text with no variables', () => {
      const text = 'No variables in this text';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual([]);
    });

    it('should handle empty string', () => {
      const result = VariableSubstitutionService.extractVariables('');

      expect(result).toEqual([]);
    });

    it('should handle null or undefined input', () => {
      expect(VariableSubstitutionService.extractVariables(null)).toEqual([]);
      expect(VariableSubstitutionService.extractVariables(undefined)).toEqual([]);
    });

    it('should only match UPPER_SNAKE_CASE variables', () => {
      const text = 'Valid: ${DB_NAME} ${API_KEY_2} Invalid: ${lowercase} ${Mixed_Case}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['DB_NAME', 'API_KEY_2']);
    });

    it('should match variables with numbers', () => {
      const text = 'Use ${DB_PORT_3306} and ${API_V2_KEY}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['DB_PORT_3306', 'API_V2_KEY']);
    });

    it('should ignore incomplete placeholders', () => {
      const text = 'Incomplete: ${ DB_NAME} ${DB_NAME } $DB_NAME';
      const result = VariableSubstitutionService.extractVariables(text);

      // Should find none because they don't match the strict pattern
      expect(result).toEqual([]);
    });

    it('should handle variables at start and end of text', () => {
      const text = '${START_VAR} middle text ${END_VAR}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['START_VAR', 'END_VAR']);
    });

    it('should handle multiline text', () => {
      const text = `
        Line 1 has \${VAR_1}
        Line 2 has \${VAR_2}
        Line 3 has \${VAR_3}
      `;
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['VAR_1', 'VAR_2', 'VAR_3']);
    });
  });

  describe('getSuggestedVariables', () => {
    it('should return variable metadata with positions', () => {
      const text = 'Use ${DB_NAME} and ${DB_PORT}';
      const result = VariableSubstitutionService.getSuggestedVariables(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'DB_NAME',
        placeholder: '${DB_NAME}',
        positions: expect.arrayContaining([expect.any(Number)])
      });
    });

    it('should track multiple occurrences of same variable', () => {
      const text = '${VAR} appears ${VAR} twice ${VAR}';
      const result = VariableSubstitutionService.getSuggestedVariables(text);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('VAR');
      expect(result[0].positions).toHaveLength(3);
    });

    it('should handle text with no variables', () => {
      const text = 'No variables here';
      const result = VariableSubstitutionService.getSuggestedVariables(text);

      expect(result).toEqual([]);
    });

    it('should handle empty or invalid input', () => {
      expect(VariableSubstitutionService.getSuggestedVariables(null)).toEqual([]);
      expect(VariableSubstitutionService.getSuggestedVariables(undefined)).toEqual([]);
      expect(VariableSubstitutionService.getSuggestedVariables('')).toEqual([]);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle text with special characters around variables', () => {
      const text = 'Path: /${BASE_PATH}/${SUB_PATH}/file.txt';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['BASE_PATH', 'SUB_PATH']);
    });

    it('should handle text with escaped characters', () => {
      const text = 'Use \\${NOT_A_VAR} and ${REAL_VAR}';
      const result = VariableSubstitutionService.extractVariables(text);

      // The service doesn't handle escaping, so both would be matched
      // This is expected behavior - escaping handled at different layer
      expect(result).toContain('REAL_VAR');
    });

    it('should handle very long variable names', () => {
      const longName = 'A'.repeat(100);
      const text = `Use \${${longName}}`;
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual([longName]);
    });

    it('should handle text with nested-looking braces', () => {
      const text = 'Not nested: ${VAR_1} { ${VAR_2} }';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['VAR_1', 'VAR_2']);
    });

    it('should handle Unicode text around variables', () => {
      const text = 'Unicode: 你好 ${VAR_NAME} 世界';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['VAR_NAME']);
    });

    it('should handle variables in JSON-like strings', () => {
      const text = '{"key": "${VALUE}", "port": ${PORT_NUMBER}}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['VALUE', 'PORT_NUMBER']);
    });

    it('should handle variables in SQL-like strings', () => {
      const text = 'SELECT * FROM ${TABLE_NAME} WHERE id = ${USER_ID}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['TABLE_NAME', 'USER_ID']);
    });

    it('should handle variables in shell-like strings', () => {
      const text = 'export PATH="${BIN_PATH}:$PATH"';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['BIN_PATH']);
    });
  });

  describe('Variable Name Validation', () => {
    it('should reject variables starting with numbers', () => {
      const text = '${123VAR} ${VAR123}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['VAR123']); // Only VAR123 is valid
    });

    it('should reject variables with special characters', () => {
      const text = '${VAR-NAME} ${VAR.NAME} ${VAR@NAME} ${VAR_NAME}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['VAR_NAME']); // Only underscores allowed
    });

    it('should reject lowercase variables', () => {
      const text = '${lowercase} ${UPPERCASE} ${MixedCase}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['UPPERCASE']);
    });

    it('should accept single letter variables', () => {
      const text = '${A} ${B} ${C}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('should handle consecutive underscores', () => {
      const text = '${VAR__NAME} ${VAR___NAME}';
      const result = VariableSubstitutionService.extractVariables(text);

      expect(result).toEqual(['VAR__NAME', 'VAR___NAME']);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle text with many variables efficiently', () => {
      const variableCount = 100;
      const variables = Array.from({ length: variableCount }, (_, i) => `VAR_${i}`);
      const text = variables.map(v => `\${${v}}`).join(' ');

      const startTime = Date.now();
      const result = VariableSubstitutionService.extractVariables(text);
      const endTime = Date.now();

      expect(result).toHaveLength(variableCount);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
    });

    it('should handle very long text efficiently', () => {
      const longText = 'Some text '.repeat(10000) + '${VAR_1} and ${VAR_2}';

      const startTime = Date.now();
      const result = VariableSubstitutionService.extractVariables(longText);
      const endTime = Date.now();

      expect(result).toEqual(['VAR_1', 'VAR_2']);
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});

// Note: Integration tests for substituteVariables, substituteRule, etc.
// will be in tests/integration/ as they require database mocking/setup
