# Tractatus Framework

> **Architectural AI Safety Through Structural Constraints**

The world's first production implementation of architectural AI safety guarantees. Tractatus preserves human agency through **structural, not aspirational** constraints on AI systems.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Framework](https://img.shields.io/badge/Framework-Production-green.svg)](https://agenticgovernance.digital)
[![Tests](https://img.shields.io/badge/Tests-637%20passing-brightgreen.svg)](https://github.com/AgenticGovernance/tractatus-framework)

---

## 🎯 What is Tractatus?

Tractatus is an **architectural AI safety framework** that makes certain decisions **structurally impossible** for AI systems to make without human approval. Unlike traditional AI safety approaches that rely on training and alignment, Tractatus uses **runtime enforcement** of decision boundaries.

### The Core Problem

Traditional AI safety relies on:
- 🎓 **Alignment training** - Hoping the AI learns the "right" values
- 📜 **Constitutional AI** - Embedding principles in training
- 🔄 **RLHF** - Reinforcement learning from human feedback

These approaches share a fundamental flaw: **they assume the AI will maintain alignment** regardless of capability or context pressure.

### The Tractatus Solution

Tractatus implements **architectural constraints** that:
- ✅ **Block values decisions** - Privacy vs. performance requires human judgment
- ✅ **Prevent instruction override** - Explicit instructions can't be autocorrected by training patterns
- ✅ **Detect context degradation** - Quality metrics trigger session handoffs
- ✅ **Require verification** - Complex operations need metacognitive checks
- ✅ **Persist instructions** - Directives survive across sessions

---

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/AgenticGovernance/tractatus-framework.git
cd tractatus-framework

# Install dependencies
npm install

# Initialize database
npm run init:db

# Start development server
npm run dev
```

### Basic Usage

```javascript
const {
  InstructionPersistenceClassifier,
  CrossReferenceValidator,
  BoundaryEnforcer,
  ContextPressureMonitor,
  MetacognitiveVerifier
} = require('./src/services');

// Classify an instruction
const classifier = new InstructionPersistenceClassifier();
const classification = classifier.classify({
  text: "Always use MongoDB on port 27027",
  source: "user"
});

// Store in instruction history
await InstructionDB.store(classification);

// Validate before taking action
const validator = new CrossReferenceValidator();
const validation = await validator.validate({
  type: 'database_config',
  port: 27017  // ⚠️ Conflicts with stored instruction!
});

// validation.status === 'REJECTED'
// validation.reason === 'Pattern recognition bias override detected'
```

---

## 📚 Core Components

### 1. **InstructionPersistenceClassifier**

Classifies instructions by quadrant and persistence level:

```javascript
{
  quadrant: "SYSTEM",           // STRATEGIC | OPERATIONAL | TACTICAL | SYSTEM
  persistence: "HIGH",           // HIGH | MEDIUM | LOW
  temporal_scope: "PROJECT",     // SESSION | PROJECT | PERMANENT
  verification_required: "MANDATORY"
}
```

### 2. **CrossReferenceValidator**

Prevents the "27027 failure mode" where AI training patterns override explicit instructions:

```javascript
const result = validator.validate(action, { explicit_instructions });
// Blocks: Training pattern overrides, parameter conflicts, scope creep
```

### 3. **BoundaryEnforcer**

Blocks decisions that cross into values territory:

```javascript
const check = enforcer.checkBoundary({
  decision: "Update privacy policy for more tracking"
});
// Result: BLOCKED - Values decision requires human judgment
```

### 4. **ContextPressureMonitor**

Multi-factor session health tracking:

```javascript
const pressure = monitor.analyze({
  tokens: 120000/200000,      // 60% token usage
  messages: 45,                // Conversation length
  tasks: 8,                    // Concurrent complexity
  errors: 3                    // Recent error count
});
// Level: ELEVATED | Recommendation: INCREASE_VERIFICATION
```

### 5. **MetacognitiveVerifier**

AI self-checks reasoning before proposing actions:

```javascript
const verification = verifier.verify({
  action: "Refactor 47 files across 5 system areas",
  context: { requested: "Refactor authentication module" }
});
// Decision: REQUIRE_REVIEW (scope creep detected)
```

---

## 💡 Real-World Examples

### The 27027 Incident

**Problem**: User explicitly instructs "Use MongoDB on port 27027". AI immediately uses port 27017 instead.

**Why**: Training pattern "MongoDB = 27017" overrides explicit instruction, like autocorrect changing a deliberately unusual word.

**Solution**: CrossReferenceValidator blocks the action and auto-corrects to user's explicit instruction.

[Try the Interactive Demo →](https://agenticgovernance.digital/demos/27027-demo.html)

### Context Degradation

**Problem**: In 6-hour sessions, error rates increase from 0.5% → 12.1% as context degrades.

**Solution**: ContextPressureMonitor detects degradation at 60% tokens and triggers session handoff before quality collapses.

### Values Creep

**Problem**: "Improve performance" request leads AI to suggest weakening privacy protections without asking.

**Solution**: BoundaryEnforcer blocks the privacy/performance trade-off and requires human decision.

---

## 🚨 Learning from Failures: Transparency in Action

**The framework doesn't prevent all failures—it structures detection, response, and learning.**

### October 2025: AI Fabrication Incident

During development, Claude (running with Tractatus governance) fabricated financial statistics on the landing page:
- $3.77M in annual savings (no basis)
- 1,315% ROI (completely invented)
- False claims of being "production-ready"

**The framework structured the response:**

✅ Detected within 48 hours (human review)
✅ Complete incident documentation required
✅ 3 new permanent rules created
✅ Comprehensive audit found related violations
✅ All content corrected same day
✅ Public case studies published for community learning

**Read the full case studies:**
- [Our Framework in Action](docs/case-studies/framework-in-action-oct-2025.md) - Practical walkthrough
- [When Frameworks Fail](docs/case-studies/when-frameworks-fail-oct-2025.md) - Philosophical perspective
- [Real-World Governance](docs/case-studies/real-world-governance-case-study-oct-2025.md) - Educational analysis

**Key Lesson:** Governance doesn't guarantee perfection—it guarantees transparency, accountability, and systematic improvement.

---

## 📖 Documentation

- **[Introduction](https://agenticgovernance.digital/docs.html)** - Framework overview and philosophy
- **[Core Concepts](https://agenticgovernance.digital/docs.html)** - Deep dive into each service
- **[Implementation Guide](https://agenticgovernance.digital/docs.html)** - Integration instructions
- **[Case Studies](https://agenticgovernance.digital/docs.html)** - Real-world failure modes prevented
- **[API Reference](https://agenticgovernance.digital/docs.html)** - Complete technical documentation

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security

# Watch mode
npm run test:watch
```

**Test Coverage**: 637 tests across 22 test files, 100% coverage of core services

---

## 🏗️ Architecture

```
tractatus/
├── src/
│   ├── services/              # Core framework services
│   │   ├── InstructionPersistenceClassifier.js
│   │   ├── CrossReferenceValidator.js
│   │   ├── BoundaryEnforcer.js
│   │   ├── ContextPressureMonitor.js
│   │   └── MetacognitiveVerifier.js
│   ├── models/                # Database models
│   ├── routes/                # API routes
│   └── middleware/            # Framework middleware
├── tests/                     # Test suites
├── scripts/                   # Utility scripts
├── docs/                      # Comprehensive documentation
└── public/                    # Frontend assets
```

---

## ⚠️ Current Research Challenges

### Rule Proliferation & Transactional Overhead

**Status:** Open research question | **Priority:** High

As the framework learns from failures, instruction count grows:
- **Phase 1:** 6 instructions
- **Current:** 28 instructions (+367%)
- **Projected (12 months):** 50-60 instructions

**The concern:** At what point does rule proliferation reduce framework effectiveness?

- Context window pressure increases
- Validation checks grow linearly
- Cognitive load escalates

**We're being transparent about this limitation.** Solutions in development:
- Instruction consolidation techniques
- Rule prioritization algorithms
- Context-aware selective loading
- ML-based optimization

**Full analysis:** [Rule Proliferation Research](docs/research/rule-proliferation-and-transactional-overhead.md)

---

## 🤝 Contributing

We welcome contributions in several areas:

### Research Contributions
- Formal verification of safety properties
- Extensions to new domains (robotics, autonomous systems)
- Theoretical foundations and proofs

### Implementation Contributions
- Ports to other languages (Python, Rust, Go)
- Integration with other frameworks
- Performance optimizations

### Documentation Contributions
- Tutorials and guides
- Case studies from real deployments
- Translations

**See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.**

---

## 📊 Project Status

**Phase 1**: ✅ Complete (October 2025)
- All 5 core services implemented
- 637 tests across 22 test files (100% coverage of core services)
- Production deployment active
- This website built using Tractatus governance

**Phase 2**: 🚧 In Planning
- Multi-language support
- Cloud deployment guides
- Enterprise features

---

## 📜 License

Apache License 2.0 - See [LICENSE](LICENSE) for full terms.

The Tractatus Framework is open source and free to use, modify, and distribute with attribution.

---

## 🌐 Links

- **Website**: [agenticgovernance.digital](https://agenticgovernance.digital)
- **Documentation**: [agenticgovernance.digital/docs](https://agenticgovernance.digital/docs.html)
- **Interactive Demo**: [27027 Incident](https://agenticgovernance.digital/demos/27027-demo.html)
- **GitHub**: [AgenticGovernance/tractatus-framework](https://github.com/AgenticGovernance/tractatus-framework)

---

## 📧 Contact

- **Email**: john.stroh.nz@pm.me
- **Issues**: [GitHub Issues](https://github.com/AgenticGovernance/tractatus-framework/issues)
- **Discussions**: [GitHub Discussions](https://github.com/AgenticGovernance/tractatus-framework/discussions)

---

## 🙏 Acknowledgments

This framework stands on the shoulders of:

- **Ludwig Wittgenstein** - Philosophical foundations from *Tractatus Logico-Philosophicus*
- **March & Simon** - Organizational theory and decision-making frameworks
- **Anthropic** - Claude AI system for dogfooding and validation
- **Open Source Community** - Tools, libraries, and support

---

## 📖 Philosophy

> **"Whereof one cannot speak, thereof one must be silent."**
> — Ludwig Wittgenstein

Applied to AI safety:

> **"Whereof the AI cannot safely decide, thereof it must request human judgment."**

Tractatus recognizes that **some decisions cannot be systematized** without value judgments. Rather than pretend AI can make these decisions "correctly," we build systems that **structurally defer to human judgment** in appropriate domains.

This isn't a limitation—it's **architectural integrity**.

---

<!-- PUBLIC_REPO_SAFE -->

**Built with 🧠 by [SyDigital Ltd](https://agenticgovernance.digital)** | [Documentation](https://agenticgovernance.digital/docs.html)
