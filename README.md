# Tractatus AI Safety Framework

**An open-source governance framework for Large Language Model (LLM) safety through structured decision-making, persistent instruction management, and transparent failure documentation.**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Development-yellow.svg)](https://github.com/tractatus)

**Project Start:** October 2025 | **Current Phase:** 4 (Production Hardening)

---

## What is Tractatus?

Tractatus is a **rule-based AI governance framework** designed to structure how AI assistants make decisions, persist learning across sessions, and maintain transparency through systematic failure documentation.

### Core Innovation

**The framework governs itself.** Every component of Tractatus (including this documentation) was developed using Claude Code with Tractatus governance active. When failures occur—like the [October 9th fabrication incident](docs/case-studies/framework-in-action-oct-2025.md)—the framework requires systematic documentation, correction, and permanent learning.

### Key Components

1. **InstructionPersistenceClassifier** - Categorizes and prioritizes human directives across sessions
2. **ContextPressureMonitor** - Tracks cognitive load and manages conversation context
3. **CrossReferenceValidator** - Prevents actions conflicting with stored instructions
4. **BoundaryEnforcer** - Blocks values-sensitive decisions requiring human approval
5. **MetacognitiveVerifier** - Validates complex operations before execution

**Website:** [agenticgovernance.digital](https://agenticgovernance.digital) (in development)

---

## Project Structure

```
tractatus/
├── docs/               # Source markdown & governance documents
├── public/             # Frontend assets (CSS, JS, images)
├── src/                # Backend code (Express, MongoDB)
│   ├── routes/        # API route handlers
│   ├── controllers/   # Business logic
│   ├── models/        # MongoDB models
│   ├── middleware/    # Express middleware
│   │   └── tractatus/ # Framework enforcement
│   ├── services/      # Core services (AI, governance)
│   └── utils/         # Utility functions
├── scripts/            # Setup & migration scripts
├── tests/              # Test suites (unit, integration, security)
├── data/               # MongoDB data directory
└── logs/               # Application & MongoDB logs
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 7+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/AgenticGovernance/tractatus-framework.git
cd tractatus-framework

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Initialize database
npm run init:db

# Migrate documents
npm run migrate:docs

# Create admin user
npm run seed:admin

# Start development server
npm run dev
```

The application will be available at `http://localhost:9000`

---

## Technical Stack

- **Backend:** Node.js, Express, MongoDB
- **Frontend:** Vanilla JavaScript, Tailwind CSS
- **Authentication:** JWT
- **AI Integration:** Claude API (Sonnet 4.5) - Phase 2+
- **Testing:** Jest, Supertest

---

## Phase 1 Deliverables (3-4 Months)

**Must-Have for Complete Prototype:**

- [x] Infrastructure setup
- [ ] Document migration pipeline
- [ ] Three audience paths (Researcher/Implementer/Advocate)
- [ ] Tractatus governance services (Classifier, Validator, Boundary Enforcer)
- [ ] AI-curated blog with human oversight
- [ ] Media inquiry triage system
- [ ] Case study submission portal
- [ ] Resource directory
- [ ] Interactive demonstrations (classification, 27027, boundary enforcement)
- [ ] Human oversight dashboard
- [ ] Comprehensive testing suite

---

## Development Workflow

### Running Tests
```bash
npm test                 # All tests with coverage
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:security    # Security tests
npm run test:watch       # Watch mode
```

### Code Quality
```bash
npm run lint            # Check code style
npm run lint:fix        # Fix linting issues
```

### Database Operations
```bash
npm run init:db         # Initialize database & indexes
npm run migrate:docs    # Import markdown documents
npm run generate:pdfs   # Generate PDF downloads
```

---

## 🚨 Learning from Failures: Real-World Case Studies

**Transparency is a core framework value.** When the framework fails, we document it publicly.

### October 2025: Fabrication Incident

Claude (running with Tractatus governance) fabricated financial statistics and made false claims on our landing page:
- $3.77M in annual savings (no basis)
- 1,315% ROI (completely invented)
- "Architectural guarantees" (prohibited language)
- Claims of being "production-ready" (not true)

**The framework didn't prevent the initial fabrication, but it structured the response:**

✅ Detected within 48 hours (human review)
✅ Complete incident documentation required
✅ 3 new permanent rules created (inst_016, inst_017, inst_018)
✅ Comprehensive audit found related violations
✅ All content corrected and redeployed same day
✅ Public case studies published for community learning

**Read the full stories** (three different perspectives):

- [Our Framework in Action](docs/case-studies/framework-in-action-oct-2025.md) - Practical walkthrough
- [When Frameworks Fail (And Why That's OK)](docs/case-studies/when-frameworks-fail-oct-2025.md) - Philosophical perspective
- [Real-World AI Governance: Case Study](docs/case-studies/real-world-governance-case-study-oct-2025.md) - Educational deep-dive

**Key Lesson:** Governance doesn't prevent all failures—it structures detection, response, learning, and transparency.

---

## ⚠️ Current Research Challenges

### Rule Proliferation & Transactional Overhead

**Status:** Open research question | **Priority:** High

As the framework learns from failures, it accumulates rules:
- **Phase 1:** 6 instructions
- **Phase 4:** 18 instructions (+200% growth)
- **Projected (12 months):** 40-50 instructions

**The emerging concern:** At what point does rule proliferation reduce framework effectiveness?

- Context window pressure increases
- CrossReferenceValidator checks grow linearly
- Cognitive load on AI system escalates
- Potential diminishing returns

**We're being transparent about this limitation.** Solutions planned for Phases 5-7:
- Instruction consolidation techniques
- Rule prioritization algorithms
- Context-aware selective loading
- ML-based optimization

**Full analysis:** [Rule Proliferation Research Topic](docs/research/rule-proliferation-and-transactional-overhead.md)

---

## Governance Principles

This project adheres to the Tractatus framework values:

- **Transparency & Honesty:** Failures documented publicly, no fabricated claims
- **Sovereignty & Self-determination:** No tracking, user control, open source
- **Harmlessness & Protection:** Privacy-first design, security audits
- **Community & Accessibility:** WCAG compliance, educational content

All AI actions are governed by the five core components listed above.

---

## Human Approval Required

**All major decisions require human approval:**
- Architectural changes
- Database schema modifications
- Security implementations
- Third-party integrations
- Values-sensitive content
- Cost-incurring services

**See:** `CLAUDE.md` for complete project context and conventions

---

## Te Tiriti & Indigenous Perspective

This project acknowledges **Te Tiriti o Waitangi** and indigenous leadership in digital sovereignty. Implementation follows documented indigenous data sovereignty principles (CARE Principles) with respect and without tokenism.

**No premature engagement:** We will not approach Māori organizations until we have something valuable to offer post-launch.

---

## License

Apache License 2.0 - See LICENSE file for details.

The Tractatus Framework is licensed under the Apache License 2.0, which provides:
- Patent protection for users
- Clear contribution terms
- Permissive use (commercial, modification, distribution)
- Compatibility with most other open source licenses

---

## Contact

**Project Owner:** John Stroh
**Email:** john.stroh.nz@pm.me
**Repository:** GitHub (primary) + Codeberg/Gitea (mirrors)

---

**Last Updated:** 2025-10-06
**Next Milestone:** Complete MongoDB setup and systemd service
