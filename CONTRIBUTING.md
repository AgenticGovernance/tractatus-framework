# Contributing to Tractatus Framework

Thank you for your interest in contributing to the Tractatus Framework! This document provides guidelines for contributions.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How to Contribute](#how-to-contribute)
3. [Development Setup](#development-setup)
4. [Coding Standards](#coding-standards)
5. [Testing Requirements](#testing-requirements)
6. [Submitting Changes](#submitting-changes)
7. [Documentation](#documentation)
8. [Community](#community)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of background, identity, or experience level.

### Expected Behavior

- **Be respectful** - Treat all community members with respect and kindness
- **Be constructive** - Provide helpful feedback and focus on improving the project
- **Be collaborative** - Work together to solve problems and build better solutions
- **Be transparent** - Share your reasoning and be open about limitations

### Unacceptable Behavior

- Harassment, discrimination, or personal attacks
- Trolling, insulting comments, or unconstructive criticism
- Publishing others' private information without consent
- Any conduct that would be inappropriate in a professional setting

---

## How to Contribute

There are many ways to contribute to Tractatus:

### 1. Report Bugs

If you find a bug, please open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Your environment (OS, Node.js version, etc.)
- Relevant logs or error messages

### 2. Suggest Features

Feature requests are welcome! Please include:
- Clear use case and problem statement
- Proposed solution or approach
- Potential impact on existing functionality
- Any alternative solutions considered

### 3. Improve Documentation

Documentation improvements are highly valued:
- Fix typos or clarify explanations
- Add examples or tutorials
- Improve API documentation
- Translate to other languages

### 4. Submit Code

Code contributions should:
- Solve a specific problem or add clear value
- Follow our coding standards (see below)
- Include tests for new functionality
- Update relevant documentation

### 5. Share Case Studies

Real-world examples help the community learn:
- LLM failure modes you've encountered
- Successful Tractatus implementations
- Lessons learned from deployments
- Framework limitations discovered

---

## Development Setup

### Prerequisites

- **Node.js 18+** (tested on 18.x, 20.x)
- **MongoDB 7.x** (for local development)
- **Git** (version control)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/AgenticGovernance/tractatus-framework.git
cd tractatus-framework

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Initialize database
npm run init:db

# Start development server
npm run dev
```

### Verify Installation

```bash
# Run tests
npm test

# Check code style
npm run lint

# Build project
npm run build
```

---

## Coding Standards

### JavaScript Style

We follow **Standard JS** with minor modifications:

```javascript
// ✅ Good
const result = await validator.validate(action, { explicit_instructions });

// ❌ Bad
const result=await validator.validate(action,{explicit_instructions})
```

**Key principles:**
- Use semicolons consistently
- 2-space indentation
- camelCase for variables and functions
- PascalCase for classes and constructors
- UPPER_CASE for constants
- Descriptive variable names (no single letters except in loops)

### Service Architecture

All Tractatus services follow this pattern:

```javascript
class ServiceName {
  constructor(dependencies = {}) {
    this.db = dependencies.db;
    this.logger = dependencies.logger || console;
  }

  async performAction(input) {
    // 1. Validate input
    // 2. Core logic
    // 3. Return structured result
    return {
      status: 'success',
      data: result,
      metadata: { timestamp, version }
    };
  }
}

module.exports = ServiceName;
```

### Error Handling

```javascript
// Use descriptive error classes
class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

// Always include context
throw new ValidationError(
  'Instruction conflicts with existing rule',
  { ruleId: 'inst_005', conflictType: 'PORT_MISMATCH' }
);
```

### Comments

```javascript
// ✅ Good - Explains WHY
// Training patterns can override explicit instructions (27027 failure mode)
// so we must validate against stored directives before proceeding
const validation = await validator.check(action);

// ❌ Bad - States WHAT (obvious from code)
// Check the validation
const validation = await validator.check(action);
```

---

## Testing Requirements

### Test Coverage

- **Unit tests**: All services must have 80%+ coverage
- **Integration tests**: Critical workflows must be tested end-to-end
- **Edge cases**: Test failure modes explicitly

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode (during development)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Writing Tests

```javascript
describe('CrossReferenceValidator', () => {
  describe('validate()', () => {
    it('should reject actions conflicting with HIGH persistence instructions', async () => {
      // Arrange
      const validator = new CrossReferenceValidator({ db });
      await db.instructions.insert({
        text: 'MongoDB MUST use port 27027',
        persistence: 'HIGH'
      });

      // Act
      const result = await validator.validate({
        type: 'database_config',
        port: 27017
      });

      // Assert
      expect(result.status).toBe('REJECTED');
      expect(result.reason).toContain('conflicts with instruction');
    });
  });
});
```

---

## Submitting Changes

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code improvements
- `test/description` - Test additions

Examples:
- `feature/media-triage-service`
- `fix/context-pressure-calculation`
- `docs/update-api-examples`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `test` - Test additions or fixes
- `refactor` - Code refactoring
- `chore` - Maintenance tasks

**Examples:**

```
feat(validator): add scope creep detection to MetacognitiveVerifier

Implements algorithm to detect when proposed actions exceed
requested scope, triggering human review requirement.

Closes #42
```

```
fix(monitor): correct token pressure calculation at 75% threshold

Previous calculation used integer division causing premature
escalation warnings. Now uses float division for accuracy.

Fixes #89
```

### Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** following coding standards
3. **Add tests** for new functionality
4. **Update documentation** if needed
5. **Run tests** - ensure all pass
6. **Commit changes** with descriptive messages
7. **Push to your fork**
8. **Open a pull request** with:
   - Clear title and description
   - Link to related issues
   - Screenshots/examples if applicable
   - Confirmation that tests pass

### Pull Request Review

Your PR will be reviewed for:
- **Correctness** - Does it solve the problem?
- **Code quality** - Follows standards and best practices?
- **Tests** - Adequate coverage of new code?
- **Documentation** - Clear and complete?
- **Security** - No vulnerabilities introduced?

---

## Documentation

### Types of Documentation

1. **API Documentation** - JSDoc comments in code
2. **User Guides** - Markdown files in `docs/`
3. **Examples** - Code samples in `examples/`
4. **Case Studies** - Real-world scenarios in `docs/case-studies/`

### Writing Documentation

**Be clear and specific:**

```markdown
<!-- ✅ Good -->
The `CrossReferenceValidator` prevents the "27027 failure mode" where
AI training patterns override explicit user instructions. It validates
proposed actions against stored directives and blocks conflicts.

<!-- ❌ Bad -->
The validator checks stuff and prevents problems.
```

**Include examples:**

```markdown
### Example Usage

```javascript
const validator = new CrossReferenceValidator({ db });
const result = await validator.validate({
  type: 'database_config',
  port: 27017
});

if (result.status === 'REJECTED') {
  console.error(`Action blocked: ${result.reason}`);
}
```
```

---

## Community

### Getting Help

- **GitHub Issues** - Technical problems and bugs
- **GitHub Discussions** - Questions, ideas, and general discussion
- **Email** - john.stroh.nz@pm.me for private inquiries

### Staying Updated

- **Watch the repository** - Get notified of new releases and discussions
- **Follow announcements** - Check [agenticgovernance.digital](https://agenticgovernance.digital) for updates
- **Read the changelog** - Stay informed about changes

---

## License

By contributing to Tractatus Framework, you agree that your contributions will be licensed under the Apache License 2.0.

---

## Acknowledgments

Thank you for taking the time to contribute! Every contribution, no matter how small, helps make Tractatus better for everyone.

**Questions?** Don't hesitate to ask in GitHub Discussions or open an issue.

---

*This contributing guide follows Tractatus values: transparency, human agency, and architectural integrity.*
