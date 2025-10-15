# Contributing to Tractatus

Thank you for your interest in contributing to the Tractatus AI Safety Framework! We welcome contributions that advance architectural AI safety through governance, transparency, and respect for human agency.

## 🌏 Our Values

Tractatus is grounded in these core principles:

- **Human Agency**: Technology should enhance, not replace, human decision-making
- **Transparency**: All governance mechanisms should be observable and understandable
- **Values Pluralism**: We respect diverse moral perspectives and cultural contexts
- **Safety First**: Architectural constraints take precedence over convenience
- **Te Tiriti Partnership**: We honor indigenous wisdom and partnership principles

All contributions should align with these values. If you're unsure whether your contribution fits, please open a discussion first.

## 🤝 Ways to Contribute

Tractatus welcomes diverse forms of contribution:

### Research & Theory
- Empirical validation of framework components
- Organizational theory analysis
- Comparative studies with other AI safety approaches
- Case studies of framework implementation
- Academic papers and citations

### Code & Implementation
- Bug fixes and performance improvements
- New framework components or features
- Testing and quality assurance
- Documentation improvements
- Example implementations

### Documentation
- Improving clarity and accessibility
- Translating documentation (especially Te Reo Māori)
- Creating tutorials and guides
- Adding code examples
- Correcting errors or outdated information

### Community
- Answering questions in discussions
- Helping new contributors
- Organizing meetups or study groups
- Creating educational content
- Sharing implementation experiences

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or 20.x
- MongoDB 5.0+
- Git
- Basic understanding of organizational theory (helpful but not required)

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork via GitHub UI, then clone your fork
   git clone git@github.com:YOUR_USERNAME/tractatus-framework.git
   cd tractatus-framework
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local MongoDB connection
   ```

4. **Initialize database**
   ```bash
   npm run init:db
   ```

5. **Run tests**
   ```bash
   npm test
   ```

6. **Start development server**
   ```bash
   npm start
   # Server runs on http://localhost:9000
   ```

### Understanding the Codebase

Key directories:
- `src/services/` - Six framework components (ContextPressureMonitor, etc.)
- `src/routes/` - API endpoints
- `src/models/` - MongoDB data models
- `public/` - Frontend HTML/JS (CSP-compliant, no inline handlers)
- `docs/` - Research papers and documentation
- `tests/` - Unit and integration tests

## 📝 Contribution Workflow

### 1. Create an Issue (Recommended)

Before starting work, create an issue to discuss your contribution:
- **Bug reports**: Use the bug report template
- **Features**: Use the feature request template
- **Research**: Use the research question template
- **Docs**: Use the documentation template

This helps avoid duplicate work and ensures alignment with project goals.

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
# or
git checkout -b docs/documentation-update
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `research/` - Research contributions
- `refactor/` - Code refactoring

### 3. Make Your Changes

Follow these guidelines:

**Code Style**:
- JavaScript: Use ES6+ features, async/await preferred
- Naming: camelCase for functions/variables, PascalCase for classes
- Comments: Explain *why*, not *what*
- No inline event handlers or styles (CSP compliance)

**Commit Messages**:
```
type(scope): brief description

Longer explanation if needed.

- Bullet points for multiple changes
- Reference issues with #123

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Your Name <your@email.com>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**Testing**:
- Add unit tests for new functions
- Add integration tests for API endpoints
- Ensure all tests pass: `npm test`
- Manual testing for UI changes

**Documentation**:
- Update relevant docs in `docs/`
- Add inline code comments for complex logic
- Update README if needed

### 4. Ensure CSP Compliance

All HTML/JS must follow Content Security Policy:
- ❌ No `onclick`, `onload`, `onchange` inline handlers
- ❌ No `<script>` tags without `src` attribute
- ❌ No inline `style` attributes
- ✅ Use `addEventListener` in external JS files
- ✅ Use CSS classes instead of inline styles

Check compliance:
```bash
node scripts/pre-action-check.js edit path/to/file.html "Description"
```

### 5. Submit Pull Request

```bash
git push origin feature/your-feature-name
```

Then open a PR on GitHub. The PR template will guide you through required information.

**PR Checklist**:
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] CSP compliance verified
- [ ] Values alignment confirmed
- [ ] No breaking changes (or clearly documented)
- [ ] Commit messages follow conventions

## 🧪 Testing Requirements

### Unit Tests
- Test individual functions in isolation
- Mock external dependencies
- Aim for >80% code coverage
- Located in `tests/unit/`

Example:
```javascript
describe('ContextPressureMonitor', () => {
  it('should calculate pressure correctly', () => {
    const monitor = new ContextPressureMonitor();
    const result = monitor.calculatePressure(10000, 200000);
    expect(result.level).toBe('NORMAL');
  });
});
```

### Integration Tests
- Test API endpoints end-to-end
- Use test database
- Located in `tests/integration/`

Run tests:
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm test                   # All tests
```

## 📚 Documentation Standards

### Code Documentation
- Use JSDoc for functions and classes
- Explain complex algorithms
- Document assumptions and edge cases

### Markdown Documentation
- Use clear headings and structure
- Include code examples
- Add links to related docs
- Keep language accessible (avoid unnecessary jargon)

### Research Documentation
- Cite sources properly
- Include methodology
- Provide data/evidence
- Acknowledge limitations

## ✅ Values Alignment Checklist

Before submitting, verify your contribution:

- [ ] **Respects human agency**: Does not automate decisions that should involve humans
- [ ] **Promotes transparency**: Mechanisms are observable and explainable
- [ ] **Considers diverse perspectives**: Doesn't assume single "correct" viewpoint
- [ ] **Enhances safety**: Adds constraints or validation, doesn't bypass them
- [ ] **Maintains architectural integrity**: Follows established patterns

If unsure, ask in the PR or discussion!

## 🚫 What We Don't Accept

- Contributions that bypass safety constraints
- Features that reduce transparency
- Code that violates CSP (inline handlers/scripts)
- Undocumented breaking changes
- Contributions without tests
- Plagiarized research or code
- Disrespectful or discriminatory content

## 🏆 Recognition

Contributors are recognized in:
- Project README contributors section
- Release notes for significant contributions
- Research papers (for research contributions)
- Annual community report

Public acknowledgment (opt-in):
- Koha transparency page for financial supporters
- Contributors page (coming soon)

## 📞 Getting Help

- **Questions**: Open a [Discussion](https://github.com/AgenticGovernance/tractatus-framework/discussions)
- **Bugs**: Open an [Issue](https://github.com/AgenticGovernance/tractatus-framework/issues)
- **Email**: support@agenticgovernance.digital
- **Documentation**: https://agenticgovernance.digital/docs

## 📜 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## 🎓 Learning Resources

New to Tractatus? Start here:
- [Introduction to Tractatus](https://agenticgovernance.digital/downloads/introduction-to-the-tractatus-framework.pdf)
- [Core Concepts](https://agenticgovernance.digital/downloads/core-concepts-of-the-tractatus-framework.pdf)
- [Implementation Guide](https://agenticgovernance.digital/downloads/implementation-guide.pdf)
- [Organizational Theory Foundations](https://agenticgovernance.digital/downloads/organizational-theory-foundations-of-the-tractatus-framework.pdf)

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

---

**Kia ora! Thank you for contributing to safer, more transparent AI systems.** 🌏
