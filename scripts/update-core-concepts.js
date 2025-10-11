/**
 * Update Core Concepts Document for Phase 5
 * Updates service count, adds MongoDB, API Memory, BlogCuration service
 */

const { MongoClient } = require('mongodb');
const marked = require('marked');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';
const DB_NAME = process.env.MONGODB_DB || 'tractatus_dev';

const UPDATES = {
  // Update overview section
  oldOverview: 'The Tractatus framework consists of five interconnected services that work together to ensure AI operations remain within safe boundaries. Each service addresses a specific aspect of AI safety.',

  newOverview: `The Tractatus framework consists of six interconnected services that work together to ensure AI operations remain within safe boundaries. Each service addresses a specific aspect of AI safety.

**Current Status**: Production-ready (Phase 5 complete). All services integrated with MongoDB persistence and optional Anthropic API Memory enhancement.

**Architecture**: Hybrid memory system combining MongoDB (required persistent storage), Anthropic API Memory (optional session enhancement), and filesystem audit trails (debug logging). See the Architectural Overview document for complete technical details.`,

  // Add MongoDB persistence section after service 5
  mongodbSection: `

## 6. BlogCuration

### Purpose

Validates blog content and social media posts against inst_016-018 governance rules to prevent fabricated statistics, absolute guarantees, and unverified claims.

### The Problem It Solves

Marketing content can inadvertently include:
- Fabricated statistics without sources ("95% of users report...")
- Absolute guarantees ("guaranteed 100% secure")
- Unverified customer claims ("thousands of happy customers")

Without validation, these violations damage credibility and can constitute false advertising.

### How It Works

**Validation Process:**

1. **Rule Loading**: Loads inst_016, inst_017, inst_018 from MongoDB
2. **Content Analysis**: Scans text for violation patterns
3. **Violation Detection**: Identifies specific rule violations
4. **Blocking**: Prevents publication if violations found
5. **Audit Trail**: Logs all validation attempts to MongoDB

**Enforced Rules:**

- **inst_016**: No fabricated statistics without validation evidence
- **inst_017**: No absolute guarantees about capabilities
- **inst_018**: No unverified claims about users/customers

### Example Validation

\`\`\`javascript
const BlogCuration = require('./services/BlogCuration.service');

const blogPost = {
  title: "Why Choose Tractatus",
  content: "Join thousands of satisfied customers using our framework!"
};

const validation = await BlogCuration.validateContent(blogPost.content);

if (!validation.allowed) {
  console.log('Violation:', validation.violations[0]);
  // Output: "inst_018: Unverified claim about 'thousands of satisfied customers'"
}
\`\`\`

### Integration

- **MongoDB**: Loads governance rules, stores validation logs
- **BoundaryEnforcer**: Shares inst_016-018 enforcement logic
- **Audit Trail**: All validations logged to \`.memory/audit/decisions-{date}.jsonl\`

---

## MongoDB Persistence Architecture

**Phase 5 Achievement**: All services now persist to MongoDB for production reliability.

### Collections

1. **governanceRules**: 18 active instructions (inst_001 through inst_019)
2. **auditLogs**: Decision audit trail with full context
3. **sessionState**: Current session state and token tracking
4. **verificationLogs**: MetacognitiveVerifier confidence scores and decisions
5. **documents**: Framework documentation (this document)

### Benefits Over Filesystem

- **Fast indexed queries** by rule ID, quadrant, persistence level
- **Atomic updates** (no race conditions)
- **Aggregation for analytics** (violation patterns, usage stats)
- **Built-in replication** and backup
- **Transaction support** for multi-document operations

### API Memory Integration (Optional)

**Anthropic API Memory** provides session continuity but does NOT replace MongoDB:

- **MongoDB**: Required for persistent storage, production systems
- **API Memory**: Optional enhancement for conversation context
- **Architecture**: Hybrid system with graceful degradation

If API Memory is unavailable, all services continue functioning with MongoDB alone.

### Environment Setup

\`\`\`bash
# Required
MONGODB_URI=mongodb://localhost:27017/tractatus_dev
MONGODB_DB=tractatus_dev

# Optional (enables API Memory features)
CLAUDE_API_KEY=your_api_key_here
\`\`\`

See Implementation Guide for complete setup instructions.`,

  // Update "How Services Work Together" section
  oldWorkTogether: 'These five services form a complete governance framework',
  newWorkTogether: 'These six services form a complete governance framework'
};

async function main() {
  console.log('=== Updating Core Concepts Document ===\n');

  let client;

  try {
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const collection = db.collection('documents');

    // Fetch current document
    const doc = await collection.findOne({ slug: 'core-concepts-of-the-tractatus-framework' });

    if (!doc) {
      throw new Error('Core Concepts document not found');
    }

    console.log('Current document loaded');
    console.log(`Current length: ${doc.content_markdown.length} characters\n`);

    // Apply updates
    let updated = doc.content_markdown;

    // Update overview
    updated = updated.replace(UPDATES.oldOverview, UPDATES.newOverview);
    console.log('✓ Updated overview section');

    // Add BlogCuration and MongoDB sections before "How the Services Work Together"
    const insertionPoint = updated.indexOf('## How the Services Work Together');
    if (insertionPoint > -1) {
      updated = updated.slice(0, insertionPoint) + UPDATES.mongodbSection + '\n\n' + updated.slice(insertionPoint);
      console.log('✓ Added BlogCuration service section');
      console.log('✓ Added MongoDB Persistence Architecture section');
    } else {
      console.log('⚠ Could not find insertion point for BlogCuration section');
    }

    // Update "How the Services Work Together"
    updated = updated.replace('These five services form a complete governance framework', 'These six services form a complete governance framework');
    console.log('✓ Updated service count in integration section');

    console.log(`\nNew length: ${updated.length} characters`);
    console.log(`Change: +${updated.length - doc.content_markdown.length} characters\n`);

    // Regenerate HTML
    const content_html = marked.parse(updated);

    // Update document
    const result = await collection.updateOne(
      { slug: 'core-concepts-of-the-tractatus-framework' },
      {
        $set: {
          content_markdown: updated,
          content_html: content_html,
          'metadata.date_updated': new Date(),
          'metadata.version': '1.1'
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✓ Document updated in MongoDB');
      console.log('✓ Version updated to 1.1');
      console.log('\n=== Update Complete ===');
    } else {
      console.log('⚠ No changes made');
    }

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
