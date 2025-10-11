# Coding Best Practices - Governance Rules Summary

**Created**: 2025-10-11
**Context**: Lessons learned from Phase 2 Migration API validation error
**Analysis Document**: `docs/analysis/PHASE_2_ERROR_ANALYSIS.md`

---

## Overview

Following the Phase 2 migration API validation error (`source: 'claude_md_migration' is not a valid enum value`), a comprehensive root cause analysis was conducted. This analysis identified **5 major categories of preventable errors**:

1. **Schema-Code Mismatch** - Controller code not aligned with database schema
2. **Magic Strings** - Hardcoded string literals instead of constants
3. **Development Environment Cache** - Stale model definitions after schema changes
4. **Insufficient Testing** - No integration tests before declaring code complete
5. **Documentation Gaps** - Enum values not centrally documented

Based on this analysis, **10 governance rules** were created to prevent similar errors in future development.

---

## Created Governance Rules

### 1. **inst_021** - Centralized Constants for Enums
**Quadrant**: SYSTEM | **Persistence**: HIGH | **Priority**: 95

```
ALL database enum values MUST be defined in a centralized constants file
(src/constants/*.constants.js). Controllers and services MUST import constants,
NEVER use string literals for enum values.
```

**Examples**:
- ✅ GOOD: `source: GOVERNANCE_SOURCES.CLAUDE_MD_MIGRATION`
- ❌ BAD: `source: 'claude_md_migration'`

**Prevents**: Schema-code mismatches, typos, refactoring errors

---

### 2. **inst_022** - Pre-Save Validation
**Quadrant**: TACTICAL | **Persistence**: HIGH | **Priority**: 90

```
BEFORE saving any Mongoose model instance, code MUST validate enum field values
against the schema's allowed values. Use pre-save validation or explicit checks.
```

**Examples**:
- ✅ GOOD: `if (!ENUM_VALUES.includes(value)) throw new Error(...)`
- ❌ BAD: Directly calling `newModel.save()` without validation

**Prevents**: Runtime database validation errors, silent failures

---

### 3. **inst_023** - JSDoc Type Annotations
**Quadrant**: TACTICAL | **Persistence**: HIGH | **Priority**: 85

```
ALL functions that create or update database models MUST include JSDoc type
annotations specifying allowed enum values. Use @typedef for complex types.
```

**Examples**:
- ✅ GOOD: `@property {'user_instruction'|'framework_default'|'claude_md_migration'} source`
- ❌ BAD: `@property {string} source` (too vague)

**Prevents**: IDE type checking catches enum mismatches at dev-time

---

### 4. **inst_024** - Server Restart After Model Changes
**Quadrant**: OPERATIONAL | **Persistence**: HIGH | **Priority**: 80

```
AFTER modifying any Mongoose model schema (*.model.js files), developer MUST
restart the Node.js server to clear require() cache. Use nodemon for automatic restarts.
```

**Examples**:
- ✅ GOOD: `npm run dev` (uses nodemon, auto-restarts)
- ❌ BAD: Editing model and testing without restart

**Prevents**: Testing against stale cached models

---

### 5. **inst_025** - Constants File Structure
**Quadrant**: TACTICAL | **Persistence**: HIGH | **Priority**: 85

```
WHEN creating constants files for enums, MUST export both:
(1) Named object with constants (e.g., GOVERNANCE_SOURCES),
(2) Array of values (e.g., GOVERNANCE_SOURCE_VALUES).
Array MUST be used in model schema enum definition.
```

**Examples**:
- ✅ GOOD: `module.exports = { GOVERNANCE_SOURCES, GOVERNANCE_SOURCE_VALUES }`
- ✅ GOOD: Model uses `enum: GOVERNANCE_SOURCE_VALUES`

**Prevents**: Duplication of enum definitions

---

### 6. **inst_026** - Clear Validation Error Messages
**Quadrant**: TACTICAL | **Persistence**: MEDIUM | **Priority**: 70

```
ALL validation errors from Mongoose MUST include the invalid value and list of
valid values in the error message. Use custom error messages with {VALUES} placeholder.
```

**Examples**:
- ✅ GOOD: `enum: { values: [...], message: '{VALUE} not valid. Must be: {VALUES}' }`
- ❌ BAD: Generic "Validation failed" with no context

**Prevents**: Lengthy debugging sessions, unclear errors

---

### 7. **inst_027** - Integration Tests Before Completion
**Quadrant**: OPERATIONAL | **Persistence**: HIGH | **Priority**: 90

```
ALL new API endpoints MUST have integration tests that hit the real database
BEFORE marking the implementation complete. Test MUST include both success and failure cases.
```

**Examples**:
- ✅ GOOD: `tests/integration/migration.test.js` with database operations
- ❌ BAD: Marking API complete without integration tests

**Prevents**: Production deployment of broken code

---

### 8. **inst_028** - Schema Change Checklist
**Quadrant**: OPERATIONAL | **Persistence**: HIGH | **Priority**: 95

```
WHEN adding or modifying database schema enum fields, developer MUST:
(1) Update/create constants file,
(2) Update model to use constants,
(3) Write validation tests,
(4) Follow Schema Change Checklist in docs/developer/SCHEMA_CHANGE_CHECKLIST.md
```

**Examples**:
- ✅ GOOD: Updated constants, model, wrote tests
- ❌ BAD: Updated code without writing tests

**Prevents**: Forgotten steps in schema changes

---

### 9. **inst_029** - Enum Documentation
**Quadrant**: OPERATIONAL | **Persistence**: MEDIUM | **Priority**: 75

```
ALL enum value additions or changes MUST be documented in docs/developer/ENUM_VALUES.md
with table showing value, constant name, and description. Include instructions for adding new values.
```

**Examples**:
- ✅ GOOD: Updated ENUM_VALUES.md table when adding `claude_md_migration`
- ❌ BAD: Adding enum value without documentation

**Prevents**: Developers inventing new values without checking existing ones

---

### 10. **inst_030** - Test Before Declaring Complete
**Quadrant**: OPERATIONAL | **Persistence**: HIGH | **Priority**: 90

```
BEFORE declaring any code implementation 'complete', developer MUST run all relevant tests
and verify they pass. For database code, this MUST include integration tests with real database operations.
```

**Examples**:
- ✅ GOOD: `npm test && curl POST /api/endpoint` (verify works)
- ❌ BAD: Writing code and marking complete without testing

**Prevents**: Discovering errors during final testing phase instead of immediately

---

## Rule Categories by Quadrant

### SYSTEM (1 rule)
- **inst_021**: Centralized constants for enums

### TACTICAL (4 rules)
- **inst_022**: Pre-save validation
- **inst_023**: JSDoc type annotations
- **inst_025**: Constants file structure
- **inst_026**: Clear validation error messages

### OPERATIONAL (5 rules)
- **inst_024**: Server restart after model changes
- **inst_027**: Integration tests before completion
- **inst_028**: Schema change checklist
- **inst_029**: Enum documentation
- **inst_030**: Test before declaring complete

---

## Rule Categories by Persistence

### HIGH (8 rules)
- inst_021, inst_022, inst_023, inst_024, inst_025, inst_027, inst_028, inst_030

### MEDIUM (2 rules)
- inst_026, inst_029

---

## Implementation Checklist

When implementing these rules in a new project:

### Phase 1: File Structure Setup
- [ ] Create `src/constants/` directory
- [ ] Create constants files for all enum types
- [ ] Export both named object and values array
- [ ] Update models to import constants

### Phase 2: Code Quality
- [ ] Add JSDoc annotations to all database functions
- [ ] Add pre-save validation for enum fields
- [ ] Update error messages with {VALUES} placeholder

### Phase 3: Development Environment
- [ ] Install nodemon: `npm install --save-dev nodemon`
- [ ] Add dev script: `"dev": "nodemon src/server.js"`
- [ ] Document restart requirements in README

### Phase 4: Testing
- [ ] Write integration tests for all API endpoints
- [ ] Test success and failure cases
- [ ] Add test-before-complete to workflow

### Phase 5: Documentation
- [ ] Create `docs/developer/ENUM_VALUES.md`
- [ ] Create `docs/developer/SCHEMA_CHANGE_CHECKLIST.md`
- [ ] Document all enum values with tables
- [ ] Add "To Add New Value" instructions

---

## Real-World Application

### Example: Adding New Enum Value

**Scenario**: Need to add new source type `'api_import'` for rules imported from external API

**Following the Rules**:

1. **inst_021** - Update constants file:
```javascript
// src/constants/governance.constants.js
const GOVERNANCE_SOURCES = {
  USER_INSTRUCTION: 'user_instruction',
  FRAMEWORK_DEFAULT: 'framework_default',
  AUTOMATED: 'automated',
  MIGRATION: 'migration',
  CLAUDE_MD_MIGRATION: 'claude_md_migration',
  API_IMPORT: 'api_import',  // ✅ NEW
  TEST: 'test'
};
```

2. **inst_028** - Follow checklist:
- ✅ Updated constants file
- ✅ Model already uses `GOVERNANCE_SOURCE_VALUES` (auto-includes new value)
- ✅ Write validation test

3. **inst_023** - Update JSDoc:
```javascript
/**
 * @property {'user_instruction'|'framework_default'|'automated'|'migration'|'claude_md_migration'|'api_import'|'test'} source
 */
```

4. **inst_027** - Write integration test:
```javascript
it('should create rule with api_import source', async () => {
  const rule = new GovernanceRule({
    source: GOVERNANCE_SOURCES.API_IMPORT  // ✅ Using constant
  });
  await expect(rule.save()).resolves.not.toThrow();
});
```

5. **inst_029** - Update documentation:
```markdown
| `api_import` | `GOVERNANCE_SOURCES.API_IMPORT` | Imported from external API |
```

6. **inst_024** - Restart server:
```bash
npm run dev  # Nodemon auto-restarts
```

7. **inst_030** - Test before declaring complete:
```bash
npm test  # All tests pass
curl POST /api/endpoint  # Verify endpoint works
```

**Result**: New enum value added safely with zero errors! 🎉

---

## Prevention Effectiveness

### Time Comparison

**Without These Rules** (Phase 2 actual experience):
- Writing code: 15 minutes
- Testing and discovering error: 5 minutes
- Debugging root cause: 15 minutes
- Fixing model: 2 minutes
- Discovering server cache issue: 10 minutes
- Restarting and re-testing: 3 minutes
- **Total: ~50 minutes**

**With These Rules** (estimated):
- Writing code with constants: 15 minutes
- Writing JSDoc annotations: 5 minutes
- Writing integration test: 10 minutes
- Running test (catches error immediately): 1 minute
- **Total: ~31 minutes**

**Time Saved**: 19 minutes per incident
**Error Rate**: Near zero (caught by tests before deployment)

---

## Error Prevention Matrix

| Error Type | Prevented By | How |
|------------|--------------|-----|
| **Schema-Code Mismatch** | inst_021, inst_022, inst_025 | Constants + validation |
| **Magic Strings** | inst_021, inst_023 | Centralized constants + types |
| **Stale Cache** | inst_024 | Auto-restart with nodemon |
| **Missing Tests** | inst_027, inst_030 | Required integration tests |
| **Unclear Errors** | inst_026 | Descriptive error messages |
| **Forgotten Steps** | inst_028 | Schema change checklist |
| **Undocumented Enums** | inst_029 | Mandatory documentation |

---

## Metrics & Monitoring

### Compliance Checks

**Automated (CI/CD Pipeline)**:
```bash
# Check for magic strings in controllers
grep -r "'user_instruction'" src/controllers/ && exit 1

# Verify constants files exist
test -f src/constants/governance.constants.js || exit 1

# Check JSDoc coverage
npm run check-jsdoc || exit 1

# Run integration tests
npm run test:integration || exit 1
```

**Manual Code Review**:
- [ ] All new enum values have constants
- [ ] All database functions have JSDoc
- [ ] All API endpoints have integration tests
- [ ] ENUM_VALUES.md updated

---

## Success Criteria

These rules are successful when:

1. ✅ Zero schema-code mismatch errors in production
2. ✅ All enum values defined in constants files
3. ✅ 100% integration test coverage for API endpoints
4. ✅ All database errors include helpful context
5. ✅ Developer onboarding time reduced (clear documentation)
6. ✅ Code review time reduced (self-checking code)

---

## Related Documents

- **Root Cause Analysis**: `docs/analysis/PHASE_2_ERROR_ANALYSIS.md`
- **Phase 2 Test Results**: `docs/testing/PHASE_2_TEST_RESULTS.md`
- **Schema Change Checklist**: `docs/developer/SCHEMA_CHANGE_CHECKLIST.md` (to be created)
- **Enum Values Reference**: `docs/developer/ENUM_VALUES.md` (to be created)

---

## Conclusion

The Phase 2 migration API error was a **blessing in disguise**. It revealed systemic weaknesses in development practices that, if left unchecked, would have caused repeated errors.

By creating these 10 governance rules, we've transformed a debugging session into a **permanent improvement** to code quality and developer experience.

**Prevention is cheaper than debugging.**

---

**Created By**: Claude Code Assistant
**Date**: 2025-10-11
**Status**: ✅ Active - All 10 rules enforced in tractatus_dev database
