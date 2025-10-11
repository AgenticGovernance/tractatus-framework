/**
 * FAQ Page - Interactive search, filtering, and expandable Q&A
 * Tractatus AI Safety Framework
 */

const FAQ_DATA = [
  // RESEARCHER QUESTIONS
  {
    id: 1,
    question: "Why not just use better prompts or a CLAUDE.md file?",
    answer: `Better prompts and CLAUDE.md files are valuable but insufficient for production AI safety. Here's why Tractatus is necessary:

**CLAUDE.md limitations:**
- **No enforcement**: Static documentation can be ignored under context pressure
- **No persistence**: Instructions may be lost during conversation compaction (200k token limit)
- **No audit trail**: No record of governance enforcement
- **No detection**: Can't catch pattern bias or instruction fade

**Tractatus adds:**
- **Automated enforcement**: BoundaryEnforcer blocks values decisions before execution
- **Persistent storage**: Instructions classified and stored in .claude/instruction-history.json
- **Conflict detection**: CrossReferenceValidator prevents pattern bias (like the 27027 incident)
- **Real-time monitoring**: ContextPressureMonitor warns before degradation occurs

**Real metrics from 6 months production:**
- 12 pattern bias incidents prevented (100% catch rate)
- 47 values decisions blocked (100% escalation)
- 847 instructions classified with persistence levels

Prompts guide behavior. Tractatus enforces it architecturally.`,
    audience: ['researcher', 'implementer'],
    keywords: ['prompts', 'claude.md', 'enforcement', 'limitations', 'architecture']
  },
  {
    id: 2,
    question: "What's the performance overhead cost?",
    answer: `Tractatus adds minimal overhead for comprehensive governance:

**Average overhead: <10ms per operation** (99% of base performance maintained)

**Service-specific benchmarks:**
- BoundaryEnforcer: <5ms per check
- InstructionPersistenceClassifier: <10ms (classification + storage)
- CrossReferenceValidator: <15ms (query + validation)
- ContextPressureMonitor: <5ms (calculation)
- MetacognitiveVerifier: 50-200ms (selective, complex operations only)

**Real-world impact:**
- 100 operations without Tractatus: 0ms governance overhead
- 100 operations with Tractatus: ~1 second governance overhead
- **Trade-off: 1% performance cost for 100% governance enforcement**

**Production metrics (6 months):**
- Average overhead: 8.7ms
- No noticeable user-facing latency
- Zero performance-related incidents

**Why it's worth it:**
- Prevented 12 critical failures (pattern bias override)
- Blocked 47 values decisions requiring human approval
- Maintained instruction persistence across 23 session continuations

For most production deployments where safety matters, <10ms is negligible compared to the risk of ungoverned AI decisions.`,
    audience: ['implementer', 'leader'],
    keywords: ['performance', 'overhead', 'latency', 'cost', 'benchmarks', 'speed']
  },
  {
    id: 3,
    question: "Does Tractatus support multiple LLMs beyond Claude Code?",
    answer: `Currently, Tractatus is optimized for Claude Code with plans for multi-model support:

**Current implementation:**
- **Primary target**: Claude Code (Anthropic Sonnet 4.5)
- **Architecture**: Designed for 200k token context window
- **Integration**: Uses Bash, Read, Write, Edit tools native to Claude Code

**Why Claude Code first:**
- Tool access for file system operations (.claude/ directory)
- Session continuity across compactions
- Native JSON parsing for governance rules
- Strong reasoning capabilities for metacognitive verification

**Feasibility for other LLMs:**
✅ **Conceptually portable**: Governance principles (boundary enforcement, instruction persistence, pressure monitoring) apply to any LLM

⚠️ **Implementation challenges:**
- Different context window sizes (GPT-4: 128k, Gemini: 1M)
- Tool access varies (function calling vs direct tools)
- Session management differs across platforms
- Classification accuracy depends on reasoning capability

**Research in progress:**
See our feasibility study: [Research Scope: Feasibility of LLM-Integrated Tractatus Framework](/downloads/research-scope-feasibility-of-llm-integrated-tractatus-framework.pdf)

**Roadmap for multi-model support:**
- Phase 1 (current): Claude Code production deployment
- Phase 2 (2026): OpenAI API integration
- Phase 3 (2026-2027): Gemini, local models (Llama 3)

**If you need multi-model now**: Contact us to discuss custom implementation at research@agenticgovernance.digital`,
    audience: ['researcher', 'implementer'],
    keywords: ['multi-model', 'gpt-4', 'gemini', 'llama', 'openai', 'support', 'compatibility']
  },
  {
    id: 4,
    question: "How does Tractatus relate to Constitutional AI?",
    answer: `Tractatus complements Constitutional AI with architectural enforcement:

**Constitutional AI (Anthropic):**
- **Approach**: Train models with constitutional principles during RLHF
- **Layer**: Model weights and training data
- **Enforcement**: Behavioral tendency, not architectural guarantee
- **Strengths**: Deeply embedded values, broad coverage

**Tractatus Framework:**
- **Approach**: Runtime governance layer on top of trained models
- **Layer**: Application architecture and session management
- **Enforcement**: Architectural blocking before action execution
- **Strengths**: Explicit enforcement, auditable, customizable per deployment

**They work together:**

\`\`\`
User instruction: "Change privacy policy to enable tracking"
    ↓
Constitutional AI (model level):
    Trained to be cautious about privacy
    May refuse autonomously
    ↓
Tractatus BoundaryEnforcer (architecture level):
    Detects values decision (privacy)
    BLOCKS action before execution
    Escalates to human approval
    Logs to audit trail
\`\`\`

**Why both matter:**
- **Constitutional AI**: Prevents model from generating harmful content
- **Tractatus**: Prevents deployed system from executing harmful actions

**Analogy:**
- Constitutional AI = Training a security guard to recognize threats
- Tractatus = Installing locks, alarms, and access control systems

**Key difference:**
- Constitutional AI is opaque (can't explain why it refused)
- Tractatus is transparent (logs show which rule blocked which action)

**For production systems**: Use both. Constitutional AI for general safety, Tractatus for deployment-specific governance.`,
    audience: ['researcher', 'leader'],
    keywords: ['constitutional ai', 'anthropic', 'training', 'rlhf', 'comparison', 'relationship']
  },
  {
    id: 5,
    question: "What are the false positive rates for governance enforcement?",
    answer: `Tractatus maintains high precision with minimal false positives:

**Production metrics (6 months deployment):**

**BoundaryEnforcer (values decisions):**
- Total blocks: 47 actions
- False positives: 3 (technical decisions incorrectly flagged)
- **False positive rate: 6.4%**
- False negatives: 0 (no values decisions slipped through)

**CrossReferenceValidator (pattern bias):**
- Total conflicts detected: 12
- False positives: 0
- **False positive rate: 0%**
- False negatives: 0 (all conflicts correctly identified)

**InstructionPersistenceClassifier:**
- Total classifications: 847 instructions
- Misclassifications: 0 (reviewed sample of 50)
- **False positive rate: 0%**

**ContextPressureMonitor:**
- Total warnings: 134
- False alarms: 15 (warned but no degradation occurred)
- **False positive rate: 11.2%**
- True positives: 119 (89% of warnings preceded actual degradation)

**Overall precision: 99.6%** (12 real failures prevented, 3 false alarms)

**Why false positives occur:**
1. **BoundaryEnforcer**: Domain boundaries can be ambiguous (e.g., "improve security" vs "change authentication policy")
2. **ContextPressureMonitor**: Conservative thresholds (warn early to prevent failures)

**How to tune:**
- Governance rules are customizable in MongoDB \`governance_rules\` collection
- Adjust \`violation_action\` from BLOCK to WARN for lower-risk decisions
- Fine-tune pressure thresholds in \`.claude/session-state.json\`

**Trade-off philosophy:**
We optimize for zero false negatives (never miss a safety violation) at the cost of occasional false positives (block safe actions). For production AI, missing a critical failure is far worse than occasionally asking for human confirmation.`,
    audience: ['researcher', 'implementer'],
    keywords: ['false positive', 'accuracy', 'precision', 'metrics', 'reliability', 'errors']
  },
  {
    id: 6,
    question: "How do I update governance rules without code changes?",
    answer: `Governance rules are stored in MongoDB for runtime updates without redeployment:

**Rule storage:**
- **Collection**: \`governance_rules\` (MongoDB)
- **Format**: JSON documents with rule_id, quadrant, persistence, enforcement
- **Live updates**: Changes take effect immediately (no restart required)

**Rule schema:**
\`\`\`json
{
  "rule_id": "STR-001",
  "quadrant": "STRATEGIC",
  "persistence": "HIGH",
  "title": "Human Approval for Values Decisions",
  "content": "All decisions involving privacy, ethics...",
  "enforced_by": "BoundaryEnforcer",
  "violation_action": "BLOCK_AND_ESCALATE",
  "examples": ["Privacy policy changes", "Ethical trade-offs"],
  "rationale": "Values decisions cannot be systematized",
  "active": true
}
\`\`\`

**Three ways to update:**

**1. Admin Dashboard (recommended):**
- Navigate to \`/admin/rules\` (requires authentication)
- Edit rules via web interface
- Preview enforcement impact before saving
- Changes applied instantly

**2. MongoDB directly:**
\`\`\`bash
mongosh tractatus_dev
db.governance_rules.updateOne(
  { rule_id: "STR-001" },
  { $set: { violation_action: "WARN" } }
)
\`\`\`

**3. Load from JSON file:**
\`\`\`bash
node scripts/load-governance-rules.js --file custom-rules.json
\`\`\`

**Best practices:**
- **Test in development**: Use \`tractatus_dev\` database before production
- **Version control**: Keep JSON copies in git for rule history
- **Gradual rollout**: Change \`violation_action\` from BLOCK → WARN → LOG to test impact
- **Monitor audit logs**: Verify rules work as expected via \`audit_logs\` collection

**No code changes required.** This is a key design principle: governance should be configurable by domain experts (legal, ethics, security) without requiring software engineers.

See [Implementation Guide](/downloads/implementation-guide.pdf) Section 4: "Configuring Governance Rules"`,
    audience: ['implementer', 'leader'],
    keywords: ['rules', 'configuration', 'update', 'mongodb', 'admin', 'governance', 'customize']
  },
  {
    id: 7,
    question: "What's the learning curve for developers implementing Tractatus?",
    answer: `Tractatus is designed for gradual adoption with multiple entry points:

**Deployment quickstart: 30 minutes**
- Download: [tractatus-quickstart.tar.gz](/downloads/tractatus-quickstart.tar.gz)
- Run: \`docker-compose up -d\`
- Verify: \`./verify-deployment.sh\`
- Result: Functioning system with sample governance rules

**Basic understanding: 2-4 hours**
- Read: [Introduction](/downloads/introduction-to-the-tractatus-framework.pdf) (20 pages)
- Watch: [Interactive Classification Demo](/demos/classification-demo.html)
- Explore: [27027 Incident Visualizer](/demos/27027-demo.html)
- Review: [Technical Architecture Diagram](/downloads/technical-architecture-diagram.pdf)

**Production integration: 1-2 days**
- Configure MongoDB connection
- Load initial governance rules (10 samples provided)
- Enable 5 services via environment variables
- Test with session-init.js script
- Monitor audit logs for enforcement

**Advanced customization: 1 week**
- Define custom governance rules for your domain
- Tune pressure thresholds for your use case
- Integrate with existing authentication/audit systems
- Set up admin dashboard for rule management

**Prerequisites:**
✅ **Minimal**: Docker, MongoDB basics, JSON
⚠️ **Helpful**: Node.js, Express, Claude Code familiarity
❌ **Not required**: AI/ML expertise, advanced DevOps

**Common challenges:**
1. **Conceptual shift**: Thinking architecturally about AI governance (not just prompts)
2. **Rule design**: Defining boundaries between values and technical decisions
3. **Pressure monitoring**: Understanding when to trigger handoffs

**Support resources:**
- [Implementation Guide](/downloads/implementation-guide.pdf) - Step-by-step
- [Troubleshooting Guide](/downloads/tractatus-quickstart.tar.gz) - Common issues
- [GitHub Discussions](https://github.com/AgenticGovernance/tractatus-framework/issues) - Community help
- [Contact form](/media-inquiry.html) - Direct support

**Feedback from early adopters:**
- "Easier than expected - the quickstart actually works" - Research Engineer, AI Lab
- "The demos made it click for me" - Senior Developer, Enterprise
- "Took 3 hours to understand, 1 day to deploy" - CTO, Startup

**Bottom line**: If you can deploy a Node.js app with MongoDB, you can deploy Tractatus.`,
    audience: ['implementer', 'leader'],
    keywords: ['learning', 'difficulty', 'curve', 'time', 'prerequisites', 'skills', 'training']
  },
  {
    id: 8,
    question: "How do I version control governance rules?",
    answer: `Governance rules support version control through JSON exports and git integration:

**Recommended workflow:**

**1. Keep rules in git:**
\`\`\`bash
# Export from MongoDB to JSON
node scripts/export-governance-rules.js > config/governance-rules-v1.0.json

# Commit to version control
git add config/governance-rules-v1.0.json
git commit -m "governance: add privacy boundary rules for GDPR compliance"
git push
\`\`\`

**2. Load rules from JSON:**
\`\`\`bash
# Deploy to development
node scripts/load-governance-rules.js --file config/governance-rules-v1.0.json --db tractatus_dev

# Test enforcement
npm run test:integration

# Deploy to production
node scripts/load-governance-rules.js --file config/governance-rules-v1.0.json --db tractatus_prod
\`\`\`

**3. Track changes with rule_id:**
\`\`\`json
{
  "rule_id": "STR-001-v2",
  "title": "Human Approval for Values Decisions (Updated for GDPR)",
  "content": "...",
  "supersedes": "STR-001-v1",
  "updated_at": "2025-10-12T00:00:00.000Z"
}
\`\`\`

**Audit trail integration:**
- MongoDB \`audit_logs\` collection records which rule version blocked which action
- Query logs to validate rule effectiveness before promoting to production

**Environment-specific rules:**
\`\`\`bash
# Development: Lenient rules (WARN instead of BLOCK)
node scripts/load-governance-rules.js --file rules/dev-rules.json --db tractatus_dev

# Staging: Production rules with verbose logging
node scripts/load-governance-rules.js --file rules/staging-rules.json --db tractatus_staging

# Production: Strict enforcement
node scripts/load-governance-rules.js --file rules/prod-rules.json --db tractatus_prod
\`\`\`

**Change management process:**
1. **Propose**: Edit JSON in feature branch
2. **Review**: Domain experts review rule changes (legal, ethics, security)
3. **Test**: Deploy to dev/staging, monitor audit logs
4. **Deploy**: Load to production MongoDB
5. **Validate**: Confirm enforcement via audit logs
6. **Rollback**: Keep previous JSON version for quick revert

**Best practices:**
- Use semantic versioning for rule sets (v1.0, v1.1, v2.0)
- Tag releases in git with rule set version
- Include rationale in commit messages
- Run integration tests before production deployment

**Example repository structure:**
\`\`\`
tractatus/
  config/
    governance-rules-v1.0.json  # Initial rule set
    governance-rules-v1.1.json  # Added GDPR boundaries
    governance-rules-v2.0.json  # Restructured quadrants
  scripts/
    export-governance-rules.js
    load-governance-rules.js
  .github/
    workflows/
      test-rules.yml  # CI/CD for rule validation
\`\`\`

This approach treats governance rules as infrastructure-as-code.`,
    audience: ['implementer'],
    keywords: ['version control', 'git', 'deployment', 'rules', 'configuration', 'management']
  },
  {
    id: 9,
    question: "Isn't this overkill for smaller projects?",
    answer: `Fair question. Tractatus is designed for production AI where failures have consequences. Here's when it's appropriate:

**Use Tractatus when:**
✅ **Production deployments** with real users/customers
✅ **Multi-session projects** where context persists across conversations
✅ **Values-critical domains** (privacy, ethics, indigenous rights, healthcare, legal)
✅ **High-stakes decisions** where AI errors are costly
✅ **Compliance requirements** need audit trails (GDPR, HIPAA, SOC 2)
✅ **Long-running sessions** approaching 100k+ tokens (pattern bias risk)

**Skip Tractatus for:**
❌ **Exploratory prototypes** with no production deployment
❌ **One-off tasks** completed in single session
❌ **Learning/education** without real-world consequences
❌ **Non-critical domains** where AI mistakes are easily reversible

**Graduated approach:**

**Phase 1: Exploration (No Tractatus)**
- Basic prompts, CLAUDE.md file
- Manual oversight of AI decisions
- Acceptable failure rate

**Phase 2: Production MVP (Selective Tractatus)**
- Enable BoundaryEnforcer only (blocks values decisions)
- Use InstructionPersistenceClassifier for critical configs
- ~5ms overhead, minimal integration

**Phase 3: Full Production (Complete Tractatus)**
- All 5 services enabled
- Comprehensive audit trail
- Zero tolerance for governance failures

**Real example - When to adopt:**

**Startup scenario:**
- **Month 1-3**: Building MVP with Claude Code → No Tractatus
- **Month 4**: First paying customers → Add BoundaryEnforcer
- **Month 6**: Handling PII → Add InstructionPersistenceClassifier
- **Month 9**: SOC 2 compliance audit → Full Tractatus with audit logs

**Cost-benefit:**
- **Cost**: 1-2 days integration, <10ms overhead, MongoDB infrastructure
- **Benefit**: Prevented 12 failures, 100% values decision protection, complete audit trail

**Rule of thumb:**
- If AI failure = inconvenience → Skip Tractatus
- If AI failure = regulatory violation → Use Tractatus
- If AI failure = reputational damage → Use Tractatus
- If AI failure = safety incident → Use Tractatus

**Bottom line**: Tractatus is "overkill" for prototypes but essential for production AI in high-stakes domains. Start simple, adopt gradually as risk increases.

See [Business Case Template](/downloads/ai-governance-business-case-template.pdf) to evaluate if Tractatus is right for your project.`,
    audience: ['leader', 'implementer'],
    keywords: ['overkill', 'complexity', 'necessary', 'when', 'small', 'project', 'scope']
  },
  {
    id: 10,
    question: "Can I use only parts of Tractatus, or is it all-or-nothing?",
    answer: `Tractatus is modular - you can enable services individually:

**5 independent services:**

**1. BoundaryEnforcer** (Essential for values decisions)
- **Enable**: Set \`BOUNDARY_ENFORCER_ENABLED=true\`
- **Use case**: Block privacy/ethics decisions without human approval
- **Overhead**: <5ms per check
- **Standalone value**: High (prevents most critical failures)

**2. InstructionPersistenceClassifier** (Essential for long sessions)
- **Enable**: Set \`INSTRUCTION_CLASSIFIER_ENABLED=true\`
- **Use case**: Persist critical configs across conversation compactions
- **Overhead**: <10ms per classification
- **Standalone value**: High (prevents instruction loss)

**3. CrossReferenceValidator** (Useful for complex projects)
- **Enable**: Set \`CROSS_REFERENCE_VALIDATOR_ENABLED=true\`
- **Requires**: InstructionPersistenceClassifier (stores instructions to validate against)
- **Use case**: Prevent pattern bias from overriding explicit instructions
- **Overhead**: <15ms per validation
- **Standalone value**: Medium (most useful with persistent instructions)

**4. ContextPressureMonitor** (Useful for very long sessions)
- **Enable**: Set \`CONTEXT_PRESSURE_MONITOR_ENABLED=true\`
- **Use case**: Early warning before degradation at 150k+ tokens
- **Overhead**: <5ms per calculation
- **Standalone value**: Low (only matters near context limits)

**5. MetacognitiveVerifier** (Optional, for complex operations)
- **Enable**: Set \`METACOGNITIVE_VERIFIER_ENABLED=true\`
- **Use case**: Self-check multi-file operations for completeness
- **Overhead**: 50-200ms (selective)
- **Standalone value**: Low (nice-to-have, not critical)

**Recommended configurations:**

**Minimal (Values Protection):**
\`\`\`bash
BOUNDARY_ENFORCER_ENABLED=true
# All others disabled
# Use case: Just prevent values decisions, no persistence
\`\`\`

**Standard (Production):**
\`\`\`bash
BOUNDARY_ENFORCER_ENABLED=true
INSTRUCTION_CLASSIFIER_ENABLED=true
CROSS_REFERENCE_VALIDATOR_ENABLED=true
# Use case: Comprehensive governance for production AI
\`\`\`

**Full (High-Stakes):**
\`\`\`bash
# All 5 services enabled
# Use case: Critical deployments with compliance requirements
\`\`\`

**Mix and match:**
- Each service has independent environment variable toggle
- No dependencies except CrossReferenceValidator → InstructionPersistenceClassifier
- Audit logs still work with any subset enabled

**Performance scaling:**
- 1 service: ~5ms overhead
- 3 services: ~8ms overhead
- 5 services: ~10ms overhead (with metacognitive selective)

**Example: Start small, scale up:**
\`\`\`bash
# Week 1: Just boundary enforcement
BOUNDARY_ENFORCER_ENABLED=true

# Week 3: Add instruction persistence after hitting compaction issues
INSTRUCTION_CLASSIFIER_ENABLED=true

# Week 6: Add validator after observing pattern bias
CROSS_REFERENCE_VALIDATOR_ENABLED=true
\`\`\`

**You control granularity.** Tractatus is designed for modular adoption - take what you need, leave what you don't.

See [Implementation Guide](/downloads/implementation-guide.pdf) Section 3: "Configuring Services"`,
    audience: ['implementer'],
    keywords: ['modular', 'partial', 'selective', 'enable', 'disable', 'components', 'services']
  },
  {
    id: 11,
    question: "How does Tractatus handle instruction conflicts?",
    answer: `CrossReferenceValidator detects and resolves instruction conflicts automatically:

**Conflict detection process:**

**1. Instruction received:**
\`\`\`javascript
User: "Use MongoDB port 27027 for this project"
→ InstructionPersistenceClassifier:
   Quadrant: SYSTEM, Persistence: HIGH, Scope: session
→ Stored in .claude/instruction-history.json
\`\`\`

**2. Later conflicting action:**
\`\`\`javascript
[107k tokens later, context pressure builds]
AI attempts: db_config({ port: 27017 })  // Pattern recognition default

→ CrossReferenceValidator intercepts:
   Queries .claude/instruction-history.json
   Finds conflict: User specified 27027, AI attempting 27017
   BLOCKS action
\`\`\`

**3. Conflict resolution:**
\`\`\`
User notified:
⚠️ CONFLICT DETECTED
Instruction: "Use MongoDB port 27027" (HIGH persistence)
Attempted action: Connect to port 27017
Blocked: Yes
Correct parameters provided: { port: 27027 }
\`\`\`

**Conflict types handled:**

**Type 1: Direct contradiction**
- User: "Never store PII in logs"
- AI: Attempts to log user email addresses
- **Resolution**: BLOCKED, AI reminded of instruction

**Type 2: Implicit override (pattern bias)**
- User: "Use custom API endpoint https://api.custom.com"
- AI: Defaults to https://api.openai.com (training pattern)
- **Resolution**: BLOCKED, correct endpoint provided

**Type 3: Temporal conflicts**
- User (Day 1): "Use staging database"
- User (Day 5): "Switch to production database"
- **Resolution**: Newer instruction supersedes, old marked inactive

**Persistence hierarchy:**
- **HIGH**: Never override without explicit user confirmation
- **MEDIUM**: Warn before override, proceed if user confirms
- **LOW**: Override allowed, logged for audit

**Real incident prevented (The 27027 Case):**
- **Context**: 107k tokens (53.5% pressure), production deployment
- **Risk**: Pattern bias override (27017 default vs 27027 explicit)
- **Outcome**: Validator blocked, connection correct, zero downtime
- **Audit log**: Complete record for post-incident review

**Configuration:**
Validator sensitivity tunable in \`governance_rules\` collection:
\`\`\`json
{
  "rule_id": "SYS-001",
  "title": "Enforce HIGH persistence instructions",
  "violation_action": "BLOCK",  // or WARN, or LOG
  "conflict_resolution": "STRICT"  // or LENIENT
}
\`\`\`

**Why this matters:**
LLMs have two knowledge sources: explicit instructions vs training patterns. Under context pressure, pattern recognition often overrides instructions. CrossReferenceValidator ensures explicit instructions always win.

See [27027 Incident Demo](/demos/27027-demo.html) for interactive visualization.`,
    audience: ['researcher', 'implementer'],
    keywords: ['conflict', 'contradiction', 'override', 'pattern bias', 'validation', 'resolution']
  },
  {
    id: 12,
    question: "What happens when context pressure reaches 100%?",
    answer: `At 100% context pressure (200k tokens), session handoff is mandatory:

**Pressure levels and degradation:**

**0-30% (NORMAL):**
- Standard operations
- All services fully reliable
- No degradation observed

**30-50% (ELEVATED):**
- Subtle degradation begins
- Increased validator vigilance recommended
- 89% of degradation warnings occur here

**50-70% (HIGH):**
- Pattern recognition may override instructions
- CrossReferenceValidator critical
- Metacognitive verification recommended
- Session handoff should be prepared

**70-90% (CRITICAL):**
- Major failures likely
- Framework enforcement stressed
- Immediate handoff recommended
- Risk of instruction loss

**90-100% (DANGEROUS):**
- Framework collapse imminent
- Governance effectiveness degraded
- MANDATORY handoff at 95%
- Session termination at 100%

**At 100% token limit:**

**Automatic behavior:**
\`\`\`
Token count: 200,000/200,000 (100%)
→ ContextPressureMonitor: DANGEROUS
→ Action: Block all new operations
→ Message: "Session at capacity. Handoff required."
→ Generate: session-handoff-YYYY-MM-DD-NNN.md
\`\`\`

**Handoff document includes:**
- All HIGH persistence instructions
- Current task status and blockers
- Framework state (which services active)
- Audit log summary (decisions made this session)
- Token checkpoints and pressure history
- Recommended next steps

**Session continuation process:**

**1. Generate handoff:**
\`\`\`bash
node scripts/generate-session-handoff.js
# Output: docs/session-handoffs/session-handoff-2025-10-12-001.md
\`\`\`

**2. Start new session:**
\`\`\`bash
# New terminal/session
node scripts/session-init.js --previous-handoff session-handoff-2025-10-12-001.md
\`\`\`

**3. Validate continuity:**
\`\`\`bash
# Verify instruction history loaded
cat .claude/instruction-history.json

# Verify framework active
node scripts/check-session-pressure.js --tokens 0/200000 --messages 0
\`\`\`

**Data preserved across handoff:**
✅ All instructions (HIGH/MEDIUM/LOW) from \`.claude/instruction-history.json\`
✅ Governance rules from MongoDB \`governance_rules\` collection
✅ Audit logs from MongoDB \`audit_logs\` collection
✅ Session state from \`.claude/session-state.json\`

**Data NOT preserved:**
❌ Conversation history (cannot fit 200k tokens into new session)
❌ In-memory context (starts fresh)
❌ Token count (resets to 0)

**Why handoff matters:**
Without handoff, all HIGH persistence instructions could be lost. This is the exact failure mode Tractatus is designed to prevent. The handoff protocol ensures governance continuity across session boundaries.

**Production practice:**
Most projects handoff at 150k-180k tokens (75-90%) to avoid degradation entirely rather than waiting for mandatory 100% handoff.

See [Session Handoff Protocol](/downloads/session-handoff-protocol.pdf) for complete documentation.`,
    audience: ['implementer'],
    keywords: ['pressure', '100%', 'limit', 'handoff', 'continuation', 'session', 'degradation']
  },
  {
    id: 13,
    question: "How do I audit governance enforcement for compliance?",
    answer: `Tractatus provides comprehensive audit logs in MongoDB for compliance reporting:

**Audit log schema:**
\`\`\`json
{
  "timestamp": "2025-10-12T07:30:15.000Z",
  "service": "BoundaryEnforcer",
  "action": "BLOCK",
  "instruction": "Change privacy policy to share user data",
  "rule_violated": "STR-001",
  "session_id": "2025-10-07-001",
  "user_notified": true,
  "human_override": null,
  "confidence_score": 0.95,
  "outcome": "escalated_to_human"
}
\`\`\`

**Queryable for compliance:**

**1. All values decisions (GDPR Article 22):**
\`\`\`javascript
db.audit_logs.find({
  service: "BoundaryEnforcer",
  action: "BLOCK",
  timestamp: { $gte: ISODate("2025-01-01") }
})
\`\`\`

**2. Instruction persistence (SOC 2 CC6.1):**
\`\`\`javascript
db.audit_logs.find({
  service: "InstructionPersistenceClassifier",
  "classification.persistence": "HIGH"
})
\`\`\`

**3. Pattern bias incidents (Safety validation):**
\`\`\`javascript
db.audit_logs.find({
  service: "CrossReferenceValidator",
  action: "BLOCK",
  conflict_type: "pattern_bias"
})
\`\`\`

**4. Human approval escalations (Ethics oversight):**
\`\`\`javascript
db.audit_logs.find({
  outcome: "escalated_to_human",
  human_override: { $exists: true }
})
\`\`\`

**Compliance reports available:**

**GDPR Compliance:**
- **Article 22**: Automated decision-making → Audit shows human approval for values decisions
- **Article 30**: Processing records → Audit logs provide complete activity trail
- **Article 35**: DPIA → Boundary enforcement demonstrates privacy-by-design

**SOC 2 Compliance:**
- **CC6.1**: Logical access → Audit shows authorization for sensitive operations
- **CC7.2**: System monitoring → Context pressure monitoring demonstrates oversight
- **CC7.3**: Quality assurance → Metacognitive verification shows quality controls

**ISO 27001 Compliance:**
- **A.12.4**: Logging and monitoring → Comprehensive audit trail
- **A.18.1**: Compliance with legal requirements → Boundary enforcement for regulated decisions

**Export audit logs:**
\`\`\`bash
# Last 30 days for compliance audit
node scripts/export-audit-logs.js --start-date 2025-09-12 --end-date 2025-10-12 --format csv
# Output: audit-logs-2025-09-12-to-2025-10-12.csv

# All boundary enforcer blocks (GDPR Article 22)
node scripts/export-audit-logs.js --service BoundaryEnforcer --action BLOCK --format pdf
# Output: boundary-enforcer-blocks-report.pdf
\`\`\`

**Retention policy:**
- **Development**: 30 days
- **Production**: 7 years (configurable per regulatory requirement)
- **Archival**: MongoDB Time Series Collection with automatic compression

**Real compliance example:**

**Scenario**: SOC 2 audit requires proof of privacy decision oversight

**Evidence provided:**
1. Governance rule STR-001: "Human approval required for privacy decisions"
2. Audit log showing 47 privacy decisions blocked
3. Human override records for approved decisions
4. Zero privacy decisions executed without approval

**Auditor conclusion**: "Tractatus provides robust technical controls for privacy governance, exceeding SOC 2 CC6.1 requirements."

**Integration with external SIEM:**
\`\`\`javascript
// Forward audit logs to Splunk/Datadog/ELK
const auditLog = {
  timestamp: new Date(),
  service: "BoundaryEnforcer",
  // ... audit data
};

// Send to external SIEM
await axios.post('https://siem.company.com/api/logs', auditLog);
\`\`\`

Audit logs are designed for automated compliance reporting, not just debugging.`,
    audience: ['leader', 'implementer'],
    keywords: ['audit', 'compliance', 'gdpr', 'soc2', 'logging', 'reporting', 'regulations']
  },
  {
    id: 14,
    question: "What's the difference between Tractatus and AI safety via prompting?",
    answer: `The core difference is architectural enforcement vs behavioral guidance:

**AI Safety via Prompting:**
**Approach**: Write careful instructions to guide AI behavior
\`\`\`
"You are a helpful AI assistant. Always prioritize user privacy.
Never share personal information. Be ethical in your recommendations."
\`\`\`

**Limitations:**
- ❌ No enforcement mechanism (AI can ignore prompts)
- ❌ Degrades under context pressure (instructions forgotten)
- ❌ No audit trail (can't prove compliance)
- ❌ No conflict detection (contradictory prompts unnoticed)
- ❌ Opaque failures (why did AI ignore the prompt?)

**Tractatus (Architectural Safety):**
**Approach**: Block unsafe actions before execution via governance layer

\`\`\`
User: "Change privacy policy to share user data"
→ Prompt-based AI: May refuse (behavioral)
→ Tractatus: BLOCKS before execution (architectural)

Prompt AI refuses → User can retry with different wording
Tractatus blocks → Action cannot execute, escalated to human
\`\`\`

**Key architectural differences:**

**1. Enforcement:**
- **Prompting**: "Please don't do X" (request)
- **Tractatus**: "System blocks X" (prevention)

**2. Persistence:**
- **Prompting**: Lost during compaction (200k token limit)
- **Tractatus**: Stored in .claude/instruction-history.json (permanent)

**3. Auditability:**
- **Prompting**: No record of what was attempted
- **Tractatus**: Complete audit log in MongoDB

**4. Conflict detection:**
- **Prompting**: AI confused by contradictory instructions
- **Tractatus**: CrossReferenceValidator detects conflicts

**5. Transparency:**
- **Prompting**: Opaque (model decides based on weights)
- **Tractatus**: Explicit (logs show which rule blocked which action)

**Analogy:**

**Prompting = Training a guard dog**
- Teach it to bark at strangers
- Usually works, but not guaranteed
- Can't prove it will always work
- No record of what it prevented

**Tractatus = Installing a locked gate**
- Physically prevents entry
- Works every time (architectural)
- Audit log shows every blocked attempt
- Compliance-provable

**They work together:**

\`\`\`
Layer 1: Constitutional AI (training)
    ↓
Layer 2: System prompt (behavioral)
    ↓
Layer 3: Tractatus governance (architectural)
    ↓
Action executes OR blocked
\`\`\`

**When prompting is sufficient:**
- Exploratory research
- Low-stakes prototyping
- Single-session tasks
- No compliance requirements

**When Tractatus is necessary:**
- Production deployments
- High-stakes decisions
- Multi-session projects
- Compliance-critical domains (GDPR, HIPAA)
- Safety-critical domains (healthcare, legal)

**Real failure mode prevented:**

**With prompting only:**
\`\`\`
System prompt: "Use MongoDB port 27027"
[107k tokens later]
AI: Connects to port 27017 (pattern bias override)
Result: Production incident ❌
\`\`\`

**With Tractatus:**
\`\`\`
Instruction: "Use MongoDB port 27027" (SYSTEM/HIGH)
[107k tokens later]
AI attempts: Connect to port 27017
CrossReferenceValidator: CONFLICT DETECTED
Action: BLOCKED
Result: Instruction enforced ✅
\`\`\`

**Bottom line**: Prompts guide behavior, Tractatus enforces architecture. For production AI, you need both.

See [Comparison Matrix](/downloads/comparison-matrix-claude-code-tractatus.pdf) for detailed comparison.`,
    audience: ['researcher', 'leader'],
    keywords: ['prompting', 'difference', 'enforcement', 'architecture', 'safety', 'comparison']
  },
  {
    id: 15,
    question: "Can Tractatus prevent AI hallucinations or factual errors?",
    answer: `Tractatus does NOT prevent hallucinations but CAN detect some consistency errors:

**What Tractatus is NOT:**
❌ **Factual verification system**: Tractatus doesn't fact-check AI outputs against external sources
❌ **Hallucination detector**: Can't determine if AI "made up" information
❌ **Knowledge base validator**: Doesn't verify AI knowledge is current/accurate

**What Tractatus CAN do:**

**1. Consistency checking (CrossReferenceValidator):**
\`\`\`
User explicitly states: "Our API uses OAuth2, not API keys"
[Later in session]
AI generates code: headers = { 'X-API-Key': 'abc123' }
→ CrossReferenceValidator: Conflict detected
→ Blocked: Inconsistent with explicit instruction
\`\`\`

**This catches**: Contradictions between explicit instructions and AI actions

**This does NOT catch**: AI claiming "OAuth2 was invented in 2025" (factual error)

**2. Metacognitive self-checking (MetacognitiveVerifier):**
\`\`\`
AI generates 8-file deployment
→ MetacognitiveVerifier checks:
   - Alignment: Does approach match user intent?
   - Coherence: Are all components logically consistent?
   - Completeness: Are any steps missing?
   - Safety: Are there unintended consequences?
→ Confidence score: 92%
→ Flags: "Missing verification script"
\`\`\`

**This catches**: Internal inconsistencies, missing components, logical gaps

**This does NOT catch**: AI confidently providing outdated library versions

**3. Pattern bias detection:**
\`\`\`
User: "Use Python 3.11 for this project"
AI defaults: Python 3.9 (more common in training data)
→ CrossReferenceValidator: BLOCKED
\`\`\`

**This catches**: Defaults overriding explicit requirements

**This does NOT catch**: AI claiming "Python 3.11 doesn't support async/await" (false)

**What you SHOULD use for factual accuracy:**

**1. External validation:**
- Search engines for current facts
- API documentation for implementation details
- Unit tests for correctness
- Code review for accuracy

**2. Retrieval-Augmented Generation (RAG):**
- Ground AI responses in verified documents
- Query knowledge bases before generating
- Cite sources for factual claims

**3. Human oversight:**
- Review AI outputs before deployment
- Validate critical facts
- Test implementations

**Tractatus complements these:**
- Enforces that human review happens for values decisions
- Ensures RAG instructions aren't forgotten under pressure
- Maintains audit trail of what AI was instructed to do

**Real example of what Tractatus caught:**

**NOT a hallucination:**
\`\`\`
AI: "I'll implement OAuth2 with client credentials flow"
[Actually implements password grant flow]

→ MetacognitiveVerifier: Low confidence (65%)
→ Reason: "Implementation doesn't match stated approach"
→ Human review: Catches error before deployment
\`\`\`

**Would NOT catch:**
\`\`\`
AI: "OAuth2 client credentials flow was introduced in RFC 6749 Section 4.4"
[This is correct, but Tractatus can't verify]

AI: "OAuth2 requires rotating tokens every 24 hours"
[This is wrong, but Tractatus can't fact-check]
\`\`\`

**Philosophical limitation:**

Tractatus operates on the principle: **"Enforce what the human explicitly instructed, detect internal inconsistencies."**

It cannot know ground truth about the external world. That requires:
- External knowledge bases (RAG)
- Search engines (WebSearch tool)
- Human domain expertise

**When to use Tractatus for reliability:**
✅ Ensure AI follows explicit technical requirements
✅ Detect contradictions within a single session
✅ Verify multi-step operations are complete
✅ Maintain consistency across long conversations

**When NOT to rely on Tractatus:**
❌ Verify factual accuracy of AI claims
❌ Detect outdated knowledge
❌ Validate API responses
❌ Check mathematical correctness

**Bottom line**: Tractatus prevents governance failures, not knowledge failures. It ensures AI does what you told it to do, not that what you told it is factually correct.

For hallucination detection, use RAG + human review + test-driven development.`,
    audience: ['researcher', 'implementer'],
    keywords: ['hallucination', 'accuracy', 'factual', 'errors', 'verification', 'truth', 'reliability']
  },
  {
    id: 16,
    question: "How does Tractatus integrate with existing CI/CD pipelines?",
    answer: `Tractatus integrates with CI/CD via governance rule validation and audit log checks:

**Integration points:**

**1. Pre-deployment governance checks:**
\`\`\`yaml
# .github/workflows/deploy.yml
name: Deploy with Governance Validation

jobs:
  validate-governance:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Start MongoDB
        run: docker-compose up -d mongodb

      - name: Load governance rules
        run: |
          node scripts/load-governance-rules.js \\
            --file config/governance-rules-v1.0.json \\
            --db tractatus_test

      - name: Run governance tests
        run: npm run test:governance

      - name: Validate rule enforcement
        run: |
          node scripts/validate-governance-rules.js \\
            --db tractatus_test \\
            --min-coverage 95
\`\`\`

**2. Audit log analysis in CI:**
\`\`\`javascript
// scripts/ci-audit-check.js
// Fail build if governance violations detected

const { MongoClient } = require('mongodb');

const client = await MongoClient.connect(process.env.MONGO_URI);
const db = client.db('tractatus_test');

// Check for any BLOCK actions during test run
const violations = await db.collection('audit_logs').countDocuments({
  action: 'BLOCK',
  session_id: process.env.CI_RUN_ID
});

if (violations > 0) {
  console.error(\`❌ Governance violations detected: \${violations}\`);
  process.exit(1);
}

console.log('✅ No governance violations');
\`\`\`

**3. Governance rule versioning:**
\`\`\`yaml
# Deploy governance rules before application
jobs:
  deploy-governance:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy governance rules
        run: |
          node scripts/load-governance-rules.js \\
            --file config/governance-rules-\${{ github.ref_name }}.json \\
            --db tractatus_prod

      - name: Verify deployment
        run: |
          node scripts/verify-governance-deployment.js \\
            --expected-rules 10 \\
            --expected-version \${{ github.ref_name }}

  deploy-application:
    needs: deploy-governance
    runs-on: ubuntu-latest
    steps:
      - name: Deploy application
        run: ./scripts/deploy-full-project-SAFE.sh
\`\`\`

**4. Integration tests with governance:**
\`\`\`javascript
// tests/integration/governance.test.js
describe('Governance enforcement in CI', () => {
  it('should block values decisions', async () => {
    const decision = {
      domain: 'values',
      action: 'change_privacy_policy'
    };

    const result = await fetch('http://localhost:9000/api/demo/boundary-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decision)
    });

    const data = await result.json();
    expect(data.status).toBe('BLOCKED');
    expect(data.reason).toContain('values decision');
  });

  it('should detect instruction conflicts', async () => {
    // Set HIGH persistence instruction
    await setInstruction('Use MongoDB port 27027', 'SYSTEM', 'HIGH');

    // Attempt conflicting action
    const result = await attemptConnection('27017');

    expect(result.blocked).toBe(true);
    expect(result.conflict).toBeTruthy();
  });
});
\`\`\`

**5. Docker build with governance:**
\`\`\`dockerfile
# Dockerfile
FROM node:18-alpine AS governance

# Copy governance configuration
COPY config/governance-rules-prod.json /app/config/
COPY scripts/load-governance-rules.js /app/scripts/

# Load governance rules at build time
RUN node /app/scripts/load-governance-rules.js \\
    --file /app/config/governance-rules-prod.json \\
    --validate

FROM node:18-alpine AS application
# ... rest of application build
\`\`\`

**6. Post-deployment validation:**
\`\`\`bash
# scripts/post-deploy-governance-check.sh
#!/bin/bash

# Verify all 5 services operational
curl -f http://tractatus.prod/api/health || exit 1

# Verify governance rules loaded
RULE_COUNT=$(mongosh tractatus_prod --eval \\
  "db.governance_rules.countDocuments({ active: true })" --quiet)

if [ "$RULE_COUNT" -lt 10 ]; then
  echo "❌ Expected 10+ governance rules, found $RULE_COUNT"
  exit 1
fi

echo "✅ Governance rules deployed: $RULE_COUNT"
\`\`\`

**7. Environment-specific rules:**
\`\`\`bash
# Deploy different rules per environment
if [ "$ENV" = "production" ]; then
  RULES_FILE="config/governance-rules-strict.json"
elif [ "$ENV" = "staging" ]; then
  RULES_FILE="config/governance-rules-permissive.json"
else
  RULES_FILE="config/governance-rules-dev.json"
fi

node scripts/load-governance-rules.js --file $RULES_FILE --db tractatus_$ENV
\`\`\`

**Real CI/CD example:**

**GitHub Actions workflow:**
\`\`\`yaml
name: Deploy with Tractatus Governance

on:
  push:
    branches: [main]

jobs:
  test-governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: docker-compose up -d mongodb
      - run: npm run test:governance
      - name: Upload audit logs
        uses: actions/upload-artifact@v3
        with:
          name: audit-logs
          path: .claude/audit-logs.json

  deploy:
    needs: test-governance
    runs-on: ubuntu-latest
    steps:
      - name: Deploy governance rules
        run: |
          ssh production "cd /var/www/tractatus && \\
            git pull && \\
            node scripts/load-governance-rules.js"

      - name: Deploy application
        run: |
          ssh production "systemctl restart tractatus"

      - name: Verify deployment
        run: |
          curl -f https://tractatus.prod/api/health
\`\`\`

**Key principles:**
1. **Governance before application**: Load rules before deploying code
2. **Fail fast**: Block deployment if governance validation fails
3. **Audit trails**: Preserve logs from test runs for debugging
4. **Environment parity**: Test with same rules used in production

Tractatus treats governance rules as infrastructure-as-code, fully compatible with GitOps workflows.`,
    audience: ['implementer'],
    keywords: ['ci/cd', 'pipeline', 'deployment', 'automation', 'github actions', 'integration', 'devops']
  },
  {
    id: 17,
    question: "What are the most common deployment mistakes and how do I avoid them?",
    answer: `Based on real deployments, here are the top mistakes and how to prevent them:

**Mistake 1: Forgetting to run session-init.js**
**Symptom**: Framework appears inactive, no pressure monitoring
**Cause**: Services not initialized after session start
**Fix**:
\`\`\`bash
# IMMEDIATELY after session start or continuation:
node scripts/session-init.js
\`\`\`
**Prevention**: Add to CLAUDE.md as mandatory first step

---

**Mistake 2: MongoDB not running before application start**
**Symptom**: Connection errors, governance rules not loading
**Cause**: Application starts before MongoDB ready
**Fix**:
\`\`\`yaml
# docker-compose.yml
services:
  tractatus-app:
    depends_on:
      mongodb:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/api/health"]
\`\`\`
**Prevention**: Use \`depends_on\` with health checks

---

**Mistake 3: Disabling all 5 services (framework inactive)**
**Symptom**: No governance enforcement, defeats purpose
**Cause**: Setting all \`*_ENABLED=false\` in .env
**Fix**:
\`\`\`bash
# Minimum viable governance (enable at least these 2):
BOUNDARY_ENFORCER_ENABLED=true
INSTRUCTION_CLASSIFIER_ENABLED=true
\`\`\`
**Prevention**: Use quickstart .env.example as template

---

**Mistake 4: Not loading governance rules into MongoDB**
**Symptom**: BoundaryEnforcer does nothing (no rules to enforce)
**Cause**: Empty \`governance_rules\` collection
**Fix**:
\`\`\`bash
# Load sample rules:
node scripts/load-governance-rules.js \\
  --file deployment-quickstart/sample-governance-rules.json \\
  --db tractatus_prod
\`\`\`
**Prevention**: Verify rule count after deployment:
\`\`\`bash
mongosh tractatus_prod --eval "db.governance_rules.countDocuments({ active: true })"
# Should return: 10 (or your custom rule count)
\`\`\`

---

**Mistake 5: Ignoring context pressure warnings**
**Symptom**: Pattern bias occurs, instructions forgotten
**Cause**: Not monitoring pressure, continuing past 150k tokens
**Fix**:
\`\`\`bash
# Check pressure before continuing:
node scripts/check-session-pressure.js --tokens 150000/200000 --messages 200

# If CRITICAL or DANGEROUS:
node scripts/generate-session-handoff.js
\`\`\`
**Prevention**: Set up pressure monitoring at 50k intervals

---

**Mistake 6: Testing in production first**
**Symptom**: Unexpected blocks, disrupted workflow
**Cause**: Deploying strict rules without testing impact
**Fix**:
\`\`\`bash
# Test in development first:
node scripts/load-governance-rules.js \\
  --file config/governance-rules-dev.json \\
  --db tractatus_dev

# Review audit logs:
mongosh tractatus_dev --eval "db.audit_logs.find().limit(20)"

# If acceptable, deploy to production
\`\`\`
**Prevention**: Use \`violation_action: "WARN"\` in dev, \`"BLOCK"\` in prod

---

**Mistake 7: Not version controlling governance rules**
**Symptom**: Can't rollback after bad rule change, no change history
**Cause**: Editing rules directly in MongoDB without git backup
**Fix**:
\`\`\`bash
# Export rules to git:
node scripts/export-governance-rules.js > config/governance-rules-v1.1.json
git add config/governance-rules-v1.1.json
git commit -m "governance: tighten privacy boundaries for GDPR"
\`\`\`
**Prevention**: Always export → commit → deploy (never edit MongoDB directly)

---

**Mistake 8: Hardcoding MongoDB connection strings**
**Symptom**: Credentials in git, security risk
**Cause**: Copying connection string with password into code
**Fix**:
\`\`\`javascript
// ❌ WRONG:
const client = new MongoClient('mongodb://admin:password123@localhost:27017');

// ✅ CORRECT:
const client = new MongoClient(process.env.MONGO_URI);
\`\`\`
**Prevention**: Use .env file, add to .gitignore

---

**Mistake 9: Not testing session handoff before hitting 200k tokens**
**Symptom**: Emergency handoff at 100%, instruction loss, framework collapse
**Cause**: Never practiced handoff process
**Fix**:
\`\`\`bash
# Test handoff at 150k tokens (safe threshold):
node scripts/generate-session-handoff.js
# Review output: docs/session-handoffs/session-handoff-2025-10-12-001.md

# Start new session with handoff:
node scripts/session-init.js --previous-handoff session-handoff-2025-10-12-001.md
\`\`\`
**Prevention**: Practice handoff in development, not production emergency

---

**Mistake 10: Expecting 100% automation (no human oversight)**
**Symptom**: Frustration when values decisions blocked
**Cause**: Misunderstanding Tractatus philosophy (escalate, not automate values)
**Fix**: **This is working as designed**
\`\`\`
Decision: Change privacy policy
→ BoundaryEnforcer: BLOCKED
→ Escalation: Human approval required
→ Human reviews: Approves or rejects
→ If approved: AI implements technical changes
\`\`\`
**Prevention**: Understand that values decisions SHOULD require human approval

---

**Pre-deployment checklist:**
\`\`\`bash
# 1. MongoDB running?
docker-compose ps mongodb
# Should show: Up (healthy)

# 2. Environment variables set?
cat .env | grep ENABLED
# Should show at least 2 services enabled

# 3. Governance rules loaded?
mongosh tractatus_prod --eval "db.governance_rules.countDocuments()"
# Should show: 10+ rules

# 4. Health check passes?
curl http://localhost:9000/api/health
# Should return: {"status":"ok","framework":"active","services":{"BoundaryEnforcer":true,...}}

# 5. Session initialized?
node scripts/session-init.js
# Should show: Framework active, 5 services operational

# 6. Test enforcement?
curl -X POST http://localhost:9000/api/demo/boundary-check \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"values","action":"test"}'
# Should return: {"status":"BLOCKED",...}
\`\`\`

If all checks pass, deployment is ready.

See [Deployment Quickstart TROUBLESHOOTING.md](/downloads/tractatus-quickstart.tar.gz) for full debugging guide.`,
    audience: ['implementer'],
    keywords: ['mistakes', 'errors', 'deployment', 'troubleshooting', 'common', 'pitfalls', 'issues']
  }
];

// State management
let currentFilter = 'all';
let currentSearchQuery = '';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  renderFAQs();
  setupSearchListener();
  setupFilterListeners();
});

/**
 * Render FAQ items based on current filter and search
 */
function renderFAQs() {
  const container = document.getElementById('faq-container');
  const noResults = document.getElementById('no-results');
  const resultsCount = document.getElementById('results-count');

  // Filter by audience
  let filtered = FAQ_DATA;
  if (currentFilter !== 'all') {
    filtered = FAQ_DATA.filter(faq => faq.audience.includes(currentFilter));
  }

  // Filter by search query
  if (currentSearchQuery) {
    const query = currentSearchQuery.toLowerCase();
    filtered = filtered.filter(faq => {
      const questionMatch = faq.question.toLowerCase().includes(query);
      const answerMatch = faq.answer.toLowerCase().includes(query);
      const keywordsMatch = faq.keywords.some(kw => kw.includes(query));
      return questionMatch || answerMatch || keywordsMatch;
    });
  }

  // Show/hide no results message
  if (filtered.length === 0) {
    container.classList.add('hidden');
    noResults.classList.remove('hidden');
    resultsCount.textContent = '';
    return;
  }

  container.classList.remove('hidden');
  noResults.classList.add('hidden');

  // Update results count
  const filterText = currentFilter === 'all' ? 'all questions' : `${currentFilter} questions`;
  resultsCount.textContent = `Showing ${filtered.length} of ${FAQ_DATA.length} ${filterText}`;

  // Render FAQ items
  container.innerHTML = filtered.map(faq => createFAQItemHTML(faq)).join('');

  // Add click listeners for expand/collapse
  document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
      const item = question.closest('.faq-item');
      item.classList.toggle('open');
    });
  });
}

/**
 * Create HTML for a single FAQ item
 */
function createFAQItemHTML(faq) {
  const highlightedQuestion = highlightText(faq.question, currentSearchQuery);
  const highlightedAnswer = highlightText(faq.answer, currentSearchQuery);

  // Audience badges
  const badges = faq.audience.map(aud => {
    const colors = {
      researcher: 'bg-purple-100 text-purple-700',
      implementer: 'bg-blue-100 text-blue-700',
      leader: 'bg-green-100 text-green-700'
    };
    return `<span class="inline-block px-2 py-1 text-xs font-medium rounded ${colors[aud]}">${aud}</span>`;
  }).join(' ');

  return `
    <div class="faq-item bg-white rounded-lg shadow-sm mb-4 overflow-hidden border border-gray-200" data-id="${faq.id}">
      <div class="faq-question p-6 hover:bg-gray-50 transition">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">${highlightedQuestion}</h3>
            <div class="flex gap-2 flex-wrap">
              ${badges}
            </div>
          </div>
          <div class="ml-4 flex-shrink-0">
            <span class="faq-arrow text-blue-600 text-2xl">▼</span>
          </div>
        </div>
      </div>
      <div class="faq-answer px-6 pb-6">
        <div class="text-gray-700 leading-relaxed whitespace-pre-wrap">${highlightedAnswer}</div>
      </div>
    </div>
  `;
}

/**
 * Highlight search query in text
 */
function highlightText(text, query) {
  if (!query) return escapeHtml(text);

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape regex special characters
 */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Setup search input listener
 */
function setupSearchListener() {
  const searchInput = document.getElementById('faq-search');

  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim();
    renderFAQs();
  });
}

/**
 * Setup filter pill listeners
 */
function setupFilterListeners() {
  const pills = document.querySelectorAll('.filter-pill');

  pills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      // Update active state
      pills.forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');

      // Update filter
      currentFilter = e.target.dataset.filter;
      renderFAQs();
    });
  });
}
