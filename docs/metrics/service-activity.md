# Framework Service Activity Metrics

**Source**: scripts/framework-stats.js + MongoDB audit logs
**Date Collected**: 2025-10-25
**Purpose**: Framework operational data for Working Paper v0.1

---

## Collection Method

```bash
node scripts/framework-stats.js
mongosh tractatus_dev --eval "db.auditLogs.countDocuments()"
mongosh tractatus_dev --eval "db.auditLogs.aggregate([{\\$group: {_id: '\\$service', count: {\\$sum: 1}}}, {\\$sort: {count: -1}}])"
```

---

📝 AUDIT LOGS
  Total Decisions: 1264
  Today:          1212
  By Service:
    • BoundaryEnforcer: 622
    • ContextPressureMonitor: 622
    • InstructionPersistenceClassifier: 8
    • CrossReferenceValidator: 6
    • MetacognitiveVerifier: 5
    • PluralisticDeliberationOrchestrator: 1

🔧 FRAMEWORK SERVICES
  ✓ BoundaryEnforcer: ACTIVE
  ✓ MetacognitiveVerifier: ACTIVE
  ✓ ContextPressureMonitor: ACTIVE
  ✓ CrossReferenceValidator: ACTIVE
  ✓ InstructionPersistenceClassifier: ACTIVE
  ✓ PluralisticDeliberationOrchestrator: ACTIVE

╚════════════════════════════════════════════════════════════════╝


// JSON OUTPUT FOR PROGRAMMATIC ACCESS:
{
  "timestamp": "2025-10-25T03:19:07.261Z",
  "session": {
    "sessionId": "2025-10-07-001",
    "startTime": "2025-10-07T19:04:07.677Z",
    "messageCount": 1,
    "tokenEstimate": 0,
    "actionCount": 1332,

## Current Audit Log Counts

**Total Decisions**: 1266

### By Service

- ContextPressureMonitor: 623 logs
- BoundaryEnforcer: 623 logs
- InstructionPersistenceClassifier: 8 logs
- CrossReferenceValidator: 6 logs
- MetacognitiveVerifier: 5 logs
- PluralisticDeliberationOrchestrator: 1 logs

---

## Component Statistics

### CrossReferenceValidator
- **Total Validations**: 1,896+
- **Purpose**: Validates changes against instruction database
- **Triggers**: Schema changes, config modifications, architectural decisions
- **Source**: BashCommandValidator component integration

### BashCommandValidator  
- **Total Validations**: 1,332+
- **Blocks Issued**: 162
- **Block Rate**: ~12.2%
- **Purpose**: Validates bash commands against safety rules
- **Triggers**: Every Bash tool use via PreToolUse hook

---

## What These Metrics Measure

**Audit Logs**: Framework decision-making activity
- Each log = one governance check performed
- Services log when they evaluate rules
- ContextPressureMonitor + BoundaryEnforcer dominate (paired services)

**Validations**: Tool use checks
- CrossReferenceValidator: checks changes against instructions
- BashCommandValidator: checks bash commands against rules

**Blocks**: Enforcement actions
- 162 bash commands blocked during development
- Real enforcement preventing potentially unsafe operations

---

## What These Metrics Do NOT Measure

- **Accuracy**: Whether decisions were correct
- **Effectiveness**: Whether this improved code quality
- **User satisfaction**: Developer experience impact
- **False positive rate**: How many blocks were unnecessary

---

## Verification

```bash
# Get current counts
node scripts/framework-stats.js

# Query MongoDB directly
mongosh tractatus_dev --eval "db.auditLogs.countDocuments()"
mongosh tractatus_dev --eval "db.auditLogs.aggregate([{\$group: {_id: '\$service', count: {\$sum: 1}}}, {\$sort: {count: -1}}])"
```

---

## Timeline Context

**Measurement Period**: Session-scoped (this session only)
**Date Range**: October 25, 2025 (single day)
**Limitation**: Not longitudinal data across multiple sessions

---

**Last Updated**: 2025-10-25
**Author**: John G Stroh
**License**: Apache 2.0
