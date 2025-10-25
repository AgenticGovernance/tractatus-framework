# Tractatus Framework

**Architectural Patterns for AI Development Governance**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Research](https://img.shields.io/badge/Research-Working%20Paper%20v0.1-yellow.svg)](docs/research-paper.md)
[![Status](https://img.shields.io/badge/Status-Early%20Research-orange.svg)](#disclaimer)

---

## Overview

This repository contains research documentation and generic code patterns demonstrating **architectural enforcement** for AI governance in development contexts. The patterns address "governance fade" - the gradual degradation of AI policy adherence over time.

**🔬 Research Focus**: Development-time governance (AI coding assistants, not runtime applications)

**📄 Full Research Paper**: [Working Paper v0.1](docs/research-paper.md)

**🌐 Interactive Version**: [agenticgovernance.digital](https://agenticgovernance.digital/docs.html)

---

## ⚠️ Important Disclaimer

### This is EARLY RESEARCH, not production software

**Limitations**:
- **Single Context**: Observations from one developer, one project, 19 days (October 6-25, 2025)
- **No Validation**: Findings have NOT been peer-reviewed or validated across contexts
- **Observational Only**: No controlled studies comparing effectiveness
- **Development-Time Only**: Runtime governance not evaluated
- **Patterns Not Product**: Generic examples, not ready-to-deploy code

**What We Can Claim**: Architectural patterns demonstrated feasibility in single deployment

**What We Cannot Claim**: Long-term effectiveness, generalizability, behavioral compliance validation

📋 **Full Limitations**: [docs/limitations.md](docs/limitations.md)

---

## What's Included

### 📚 Research Documentation

- **[Working Paper v0.1](docs/research-paper.md)**: Complete research paper (39KB, 814 lines)
  - Problem statement (governance fade)
  - Architecture patterns
  - Implementation approach
  - Early observations (with verified sources)
  - Comprehensive limitations

- **[Metrics & Verification](docs/metrics/)**: All data sources documented
  - Enforcement coverage progression (28% → 100%)
  - Framework activity metrics (1,294+ decisions)
  - Real-world enforcement examples (162 blocks)
  - Development timeline (git-verified)

- **[Diagrams](docs/diagrams/)**: Mermaid diagrams (architecture, hooks, lifecycle, coverage)

### 💻 Generic Code Patterns

**Note**: These are educational examples demonstrating viability, NOT production-ready implementations.

- **[Hook Patterns](examples/hooks/)**: PreToolUse validation pattern
- **[Session Lifecycle](examples/session-lifecycle/)**: Initialization pattern
- **[Audit Logging](examples/audit/)**: Decision tracking pattern
- **[Rule Database Schema](patterns/rule-database/)**: Persistent rule structure

---

## Core Concepts

### Governance Fade

AI systems learn patterns that override explicit instructions. Example: Claude learned "Warmup → session-init → ready" and skipped reading handoff documents despite explicit instructions.

### Architectural Enforcement

Instead of relying on AI voluntary compliance:

1. **Persistent Rule Database**: Structured storage with classification metadata
2. **Hook-Based Interception**: Validate actions before execution (PreToolUse hooks)
3. **Framework Services**: Specialized governance components (BoundaryEnforcer, ContextPressureMonitor, etc.)
4. **Continuous Auditing**: Log all governance decisions for analysis
5. **Meta-Enforcement**: Framework monitors itself for fade

### Key Pattern: Handoff Auto-Injection

**Problem**: Pattern recognition overrode instruction to read handoff document

**Solution**: Auto-inject handoff content during session initialization (make information unavoidable)

**Result**: Handoff context automatically displayed; no voluntary compliance needed

**Limitation**: Only tested once; long-term effectiveness unknown

---

## Quick Start (Educational Use)

### Understand the Research

```bash
# Read the working paper
cat docs/research-paper.md | less

# Review verified metrics
ls docs/metrics/

# View architecture diagram
cat docs/diagrams/architecture-overview.mmd
```

### Explore Code Patterns

```bash
# Hook validation pattern
node examples/hooks/pre-tool-use-validator.js

# Session lifecycle pattern
node examples/session-lifecycle/session-init-pattern.js

# Audit logging pattern
node examples/audit/audit-logger.js
```

### Adapt to Your Context

**CRITICAL**: These are generic patterns. To use in your project:

1. Implement your own rule database
2. Adapt hooks to your AI system
3. Customize enforcement logic
4. Add your own testing
5. **DO NOT** use as-is in production

---

## Architecture

### Four-Layer Enforcement

1. **Persistent Rule Database**
   - JSON schema with classification metadata
   - Quadrants: SYSTEM, PRIVACY, VALUES, RULES
   - Persistence levels: HIGH, MEDIUM, LOW

2. **Hook-Based Interception**
   - PreToolUse: Validate before execution
   - UserPromptSubmit: Classify new instructions
   - PostToolUse: Audit outcomes

3. **Framework Services** (6 components)
   - `BoundaryEnforcer`: Values-sensitive decisions
   - `ContextPressureMonitor`: Session quality
   - `CrossReferenceValidator`: Conflict detection
   - `InstructionPersistenceClassifier`: Rule categorization
   - `MetacognitiveVerifier`: Reasoning validation
   - `PluralisticDeliberationOrchestrator`: Stakeholder deliberation

4. **Audit & Analytics**
   - Decision logging to database
   - Service activity tracking
   - Block rate analysis

**Diagram**: [docs/diagrams/architecture-overview.mmd](docs/diagrams/architecture-overview.mmd)

---

## Research Findings

**From Single Deployment Context** (October 6-25, 2025):

### Enforcement Coverage

- **Baseline**: 11/39 rules (28%) had enforcement mechanisms
- **Wave 1-5 Deployment**: Progressive coverage increase
- **Final**: 40/40 rules (100%) enforced

**Limitation**: Coverage = hooks exist, NOT effectiveness proven

### Framework Activity

- **1,294 governance decisions** logged across 6 services
- **162 bash commands blocked** (12.2% block rate)
- **Handoff auto-injection** prevented pattern recognition override

**Limitation**: Activity ≠ accuracy; no validation of decision correctness

### Timeline

- **Project start**: October 6, 2025
- **Framework core**: October 7, 2025 (6 services)
- **Enforcement waves**: October 25, 2025 (28% → 100%)
- **Total duration**: 19 days

**Limitation**: Short timeline; long-term stability unknown

📊 **Full Metrics**: [docs/metrics/](docs/metrics/)

---

## Citation

### For Research Paper

```bibtex
@techreport{stroh2025tractatus_research,
  title = {Tractatus: Architectural Enforcement for AI Development Governance},
  author = {Stroh, John G},
  institution = {Agentic Governance Project},
  type = {Working Paper},
  number = {v0.1},
  year = {2025},
  month = {October},
  note = {Validation Ongoing. Single-context observations (Oct 6-25, 2025)},
  url = {https://github.com/AgenticGovernance/tractatus-framework}
}
```

### For Code Patterns

```bibtex
@misc{tractatus_patterns,
  title = {Tractatus Framework: Code Patterns for AI Governance},
  author = {Stroh, John G},
  year = {2025},
  howpublished = {\url{https://github.com/AgenticGovernance/tractatus-framework}},
  note = {Generic patterns from research; not production code}
}
```

---

## Contributing

We welcome:

- **Replication Studies**: Test patterns in your context and report results
- **Pattern Improvements**: Suggest enhancements to generic patterns
- **New Patterns**: Share architectural approaches you've discovered
- **Bug Reports**: Issues in code examples or documentation
- **Questions**: Open discussions about governance approaches

**Please**:
- Review [CONTRIBUTING.md](CONTRIBUTING.md) first
- Be honest about limitations in your contributions
- No overclaiming effectiveness without evidence
- Respect Apache 2.0 license

---

## Frequently Asked Questions

### Is this production-ready?

**NO.** This is early research with a working paper (v0.1) and generic code patterns. Do not use in production without:
- Extensive testing in your context
- Security audit
- Validation of effectiveness
- Peer review

### Can I use these patterns in my project?

**Yes**, but with caution:
- These are educational examples, not production code
- Adapt to your specific context
- Test thoroughly
- Understand limitations
- No warranty provided (see LICENSE)

### Will this prevent all governance violations?

**Unknown.** We observed 162 blocks in our context, but:
- No measurement of false positive rate
- No validation of long-term effectiveness
- No testing in other contexts
- Behavioral compliance not measured

### How do I cite this work?

Use the research paper citation for academic references, or the code patterns citation for technical implementations. See [Citation](#citation) section.

### Where can I learn more?

- **Full Paper**: [docs/research-paper.md](docs/research-paper.md)
- **Interactive Version**: https://agenticgovernance.digital/docs.html
- **Contact**: research@agenticgovernance.digital

---

## License

Copyright © 2025 John G Stroh

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for full text.

**Attribution Required**: If you use or adapt these patterns, please cite this work.

---

## Contact

**Research Inquiries**: research@agenticgovernance.digital

**Issues & Discussions**: Use GitHub Issues tab

**Website**: https://agenticgovernance.digital

---

**Last Updated**: 2025-10-25
**Version**: research-v0.1
**Status**: Early research - validation ongoing
