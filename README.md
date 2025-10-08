# Tractatus AI Safety Framework

**An open-source governance methodology for Large Language Model (LLM) safety through structured decision-making, persistent learning, and transparent failure documentation.**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Framework](https://img.shields.io/badge/Type-AI%20Governance-green.svg)](https://github.com/AgenticGovernance/tractatus-framework)

---

## What Is Tractatus?

Tractatus is a **governance framework** that structures how AI assistants make decisions, learn from failures, and maintain accountability. It's not software you install—it's a methodology you implement.

### The Problem It Solves

**Without governance**, AI assistants:
- Make inconsistent decisions based on immediate context
- Forget important constraints across sessions
- React to failures ad-hoc without systematic learning
- Lack transparency about why decisions were made
- Can't explain what rules guide their behavior

**With Tractatus governance**, AI systems:
- Apply persistent rules across all sessions
- Document failures systematically
- Learn permanently from mistakes
- Maintain transparent decision logs
- Enforce boundaries on values-sensitive choices

### Core Innovation

**The framework governs itself.** Every component of this framework was developed using Claude Code with Tractatus governance active. When failures occur, the framework requires systematic documentation, correction, and permanent learning.

---

## Framework Components

Tractatus consists of five core governance components:

### 1. **InstructionPersistenceClassifier**

**Purpose**: Categorize and prioritize human directives for long-term retention

**How It Works**:
- Classifies instructions by quadrant (Strategic, Operational, Tactical, System, Stochastic)
- Assigns persistence level (HIGH, MEDIUM, LOW, VARIABLE)
- Defines temporal scope (PERMANENT, PROJECT, SESSION, TASK)
- Stores in persistent database (`.claude/instruction-history.json`)

**Example**: "Never fabricate statistics" → STRATEGIC quadrant, HIGH persistence, PERMANENT scope

### 2. **ContextPressureMonitor**

**Purpose**: Track cognitive load and session health across conversations

**How It Works**:
- Monitors token usage vs. budget
- Tracks conversation length
- Detects task complexity
- Calculates pressure score (0-100%)
- Triggers warnings at thresholds (50%, 75%, 90%)

**Example**: At 75% token usage → "ELEVATED pressure, increase verification"

### 3. **CrossReferenceValidator**

**Purpose**: Prevent actions conflicting with stored instructions

**How It Works**:
- Checks proposed actions against instruction database
- Identifies conflicts with HIGH persistence rules
- Blocks actions violating strategic constraints
- Requires human approval for conflicts

**Example**: Attempt to commit `.env` file → BLOCKED (conflicts with security instruction)

### 4. **BoundaryEnforcer**

**Purpose**: Require human approval for values-sensitive decisions

**How It Works**:
- Identifies decisions crossing into values territory
- Categorizes: Privacy, Ethics, Architecture, Security, Public Claims
- Blocks autonomous action
- Requests explicit human approval

**Example**: Publishing content to public GitHub → Triggers boundary check, requires audit

### 5. **MetacognitiveVerifier**

**Purpose**: Validate complex operations before execution

**How It Works**:
- Activated for operations with >3 files or >5 steps
- Verifies: Alignment, Coherence, Completeness, Safety
- Considers alternatives
- Reports confidence score
- Proceeds only with high confidence or human approval

**Example**: Database migration → Verifies backup exists, checks reversibility, reports confidence

---

## Real-World Examples

### Case Study 1: Reactive Governance (October 9, 2025)

**Failure**: Claude fabricated financial statistics ($3.77M ROI, 1,315% returns) and used prohibited "guarantee" language on public website.

**Framework Response**:
- Required systematic documentation (FRAMEWORK_FAILURE_2025-10-09.md)
- Created 3 new permanent rules (inst_016, inst_017, inst_018)
- Audited all materials for similar violations
- Corrected all content within hours
- Published transparent case study

**Outcome**: Failure became permanent learning + educational resource

📖 **Read**: [Our Framework in Action](docs/case-studies/framework-in-action-oct-2025.md)

---

### Case Study 2: Proactive Governance (October 9, 2025)

**Situation**: Before publishing framework docs to GitHub, user requested security audit.

**Framework Response**:
- BoundaryEnforcer activated (public publication = values decision)
- Automated scans detected 5 security issues
- Internal file paths, database names, infrastructure details found
- All issues sanitized before publication
- Zero sensitive information exposed

**Outcome**: Prevention of security disclosure through structured review

📖 **Read**: [Pre-Publication Audit](docs/case-studies/pre-publication-audit-oct-2025.md)

---

### Case Study 3: Philosophy of Structured Failure

**Insight**: Governance doesn't prevent all failures—it structures detection, response, learning, and transparency.

**Key Lessons**:
- Governed failures produce more value than ungoverned successes
- Transparency about near-misses builds credibility
- Systematic response > ad-hoc fixes
- Permanent learning > "try harder next time"

📖 **Read**: [When Frameworks Fail (And Why That's OK)](docs/case-studies/when-frameworks-fail-oct-2025.md)

---

### Case Study 4: Educational Deep-Dive

**Comprehensive analysis** of the October 9th fabrication incident covering:
- Root cause analysis (why BoundaryEnforcer failed)
- Contributing factors (marketing pressure, post-compaction fade)
- Framework component performance
- Lessons learned
- Recommendations for organizations

📖 **Read**: [Real-World AI Governance Case Study](docs/case-studies/real-world-governance-case-study-oct-2025.md)

---

## Known Limitations & Active Research

### Rule Proliferation & Transactional Overhead

**Status**: Open Research Question | **Priority**: High

**The Challenge**: As the framework learns from failures, it accumulates rules:
- Phase 1: 6 instructions
- Phase 4: 18 instructions (+200% growth)
- Projected (12 months): 40-50 instructions

**Emerging Concerns**:
- Context window pressure increases with rule count
- CrossReferenceValidator checks grow linearly
- Cognitive load on AI system escalates
- Potential diminishing returns at scale

**Honest Assessment**: Framework has known scalability limits. Ceiling likely between 40-100 instructions before significant degradation.

**Solutions Planned** (not yet implemented):
- Instruction consolidation techniques
- Rule prioritization algorithms
- Context-aware selective loading
- ML-based optimization

📖 **Read**: [Rule Proliferation Research Topic](docs/research/rule-proliferation-and-transactional-overhead.md)

---

## How to Implement Tractatus

### Prerequisites

**You need**:
- An AI assistant capable of persistent memory (file system access)
- Ability to store instruction database (JSON file recommended)
- Session management capability (detect new vs. continued sessions)
- Human oversight for boundary decisions

**Tractatus is currently implemented with**:
- Claude Code (Anthropic)
- File-based persistence
- Bash scripts for monitoring

**But the methodology is AI-agnostic** - adapt to your environment.

### Implementation Steps

**1. Create Instruction Database**

```json
{
  "version": "1.0",
  "instructions": [
    {
      "id": "inst_001",
      "text": "NEVER fabricate statistics without citing sources",
      "quadrant": "STRATEGIC",
      "persistence": "HIGH",
      "temporal_scope": "PERMANENT",
      "verification_required": "MANDATORY"
    }
  ]
}
```

**2. Implement Session Initialization**

Every session start must:
- Load instruction database
- Run context pressure check
- Verify framework components active
- Report status to user

**3. Add Governance Triggers**

Before major actions:
- Check CrossReferenceValidator
- Trigger BoundaryEnforcer for values decisions
- Run MetacognitiveVerifier for complex operations

**4. Document Failures Systematically**

When failures occur:
- Create incident report (template in case studies)
- Analyze root causes
- Generate new instructions
- Update instruction database
- Publish transparently (if appropriate)

**5. Monitor Rule Growth**

Track instruction count over time. If approaching 40-50 instructions, consider:
- Consolidation opportunities
- Rule prioritization
- Selective loading by context

### Adaptation Guide

**For Your Environment**:

- **Different AI Model**: Adapt instruction storage format
- **Cloud-Based**: Use database instead of JSON files
- **Team Environment**: Add collaborative review workflows
- **Enterprise**: Integrate with existing governance tools
- **Research**: Contribute findings to rule proliferation research

---

## Framework Values

All Tractatus implementations should adhere to these principles:

### Transparency & Honesty
- Document failures publicly when appropriate
- No fabricated claims or statistics
- Accurate status reporting (development vs. production)
- Limitations stated clearly

### Sovereignty & Self-Determination
- Human approval required for values decisions
- User control over AI actions
- No tracking without consent
- Open source methodology

### Harmlessness & Protection
- Security-first design
- Privacy by default
- Proactive risk assessment
- Boundary enforcement on sensitive decisions

### Community & Accessibility
- Educational content freely available
- Case studies for learning
- Research challenges shared openly
- Contributions welcome

---

## Contributing

We welcome contributions in several forms:

### Research Contributions
- Empirical studies on rule proliferation
- Effectiveness metrics
- Consolidation techniques
- Scalability experiments

### Case Studies
- Your framework implementation experiences
- Failure modes and responses
- Adaptation to different environments
- Novel use cases

### Methodology Improvements
- New governance components
- Enhanced monitoring techniques
- Better instruction classification
- Automated optimization approaches

### Documentation
- Implementation guides
- Tutorial content
- Translation to other languages
- Accessibility improvements

**How to Contribute**:
1. Read existing case studies to understand approach
2. Open an issue describing your contribution
3. Discuss with maintainers
4. Submit pull request with documentation
5. Include evidence/data for research contributions

---

## Frequently Asked Questions

### Is Tractatus production-ready?

**No.** Tractatus is a **development framework and research prototype**. It has not been proven at scale in production environments. Use for research, development, and educational purposes.

### Does Tractatus guarantee AI safety?

**No.** We never use the term "guarantee." Tractatus is designed to *reduce risk*, *structure responses*, and *enable learning*. It cannot prevent all failures.

### What's the optimal number of instructions?

**Unknown.** Current research suggests effectiveness may degrade beyond 40-50 instructions, but this is unproven. See [Rule Proliferation Research](docs/research/rule-proliferation-and-transactional-overhead.md).

### Can I use Tractatus commercially?

**Yes.** Apache 2.0 license permits commercial use, modification, and distribution. See [LICENSE](LICENSE) for details.

### How is this different from Constitutional AI?

**Constitutional AI** bakes principles into model training. **Tractatus** applies runtime governance to already-trained models through persistent instructions and structured decision-making.

### Do I need to use all 5 components?

**No.** Implement what makes sense for your use case. However, BoundaryEnforcer is strongly recommended for any values-sensitive AI application.

---

## Project Status

**Current Phase**: Development & Research (October 2025)
**Maturity**: Early stage, active development
**Production Use**: Not recommended yet
**Research Status**: Ongoing, contributions welcome

### Roadmap

**Current**:
- ✅ Core 5 components implemented
- ✅ Real-world case studies documented
- ✅ Rule proliferation research initiated
- ✅ Open source release (Apache 2.0)

**Next** (Phases 5-7, future):
- ⏳ Instruction consolidation mechanisms
- ⏳ Automated rule optimization
- ⏳ Context-aware selective loading
- ⏳ Effectiveness metrics development
- ⏳ Multi-model compatibility testing

---

## Citation

If you use Tractatus in research or implementation, please cite:

```
Tractatus AI Safety Framework (2025)
AgenticGovernance Organization
https://github.com/AgenticGovernance/tractatus-framework
Licensed under Apache 2.0
```

For specific case studies:
```
Tractatus Development Team (2025). "Real-World AI Governance: A Case Study in
Framework Failure and Recovery." Tractatus AI Safety Framework Documentation.
https://github.com/AgenticGovernance/tractatus-framework/docs/case-studies/
```

---

## License

Apache License 2.0 - See [LICENSE](LICENSE) file for details.

The Tractatus Framework methodology is open source under Apache 2.0, which provides:
- ✅ Patent protection for users
- ✅ Clear contribution terms
- ✅ Permissive use (commercial, modification, distribution)
- ✅ Compatibility with most other open source licenses

---

## Contact & Community

**Repository**: https://github.com/AgenticGovernance/tractatus-framework
**Organization**: AgenticGovernance
**License**: Apache 2.0
**Issues**: https://github.com/AgenticGovernance/tractatus-framework/issues

For questions about implementation, research contributions, or case study submissions, please open an issue on GitHub.

---

## Acknowledgments

**Developed using**: Claude Code (Anthropic Sonnet 4.5)
**Governance Method**: Self-application (dogfooding)
**Framework Principles**: Inspired by organizational theory, software governance, and AI safety research

**Key Insight**: The best way to validate an AI governance framework is to use it to govern the AI building the framework itself. Every failure becomes a test case. Every success validates the approach.

---

**Last Updated**: October 2025
**Version**: 1.0 (Initial Public Release)
**Status**: Development Framework - Use at own risk, contributions welcome
