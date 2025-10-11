/**
 * Update Glossary with Phase 5 Terms
 * Adds: MemoryProxy, API Memory, Hybrid Architecture, BlogCuration
 */

const { MongoClient } = require('mongodb');
const marked = require('marked');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';
const DB_NAME = process.env.MONGODB_DB || 'tractatus_dev';

const NEW_TERMS = `

### MemoryProxy

**What it means:** A service that manages access to the persistence layer (MongoDB and optionally Anthropic API Memory) for all framework services.

**Why it matters:** Instead of each service connecting to the database independently, MemoryProxy provides a single, consistent interface. This ensures all services load the same governance rules and log decisions uniformly.

**Real-world analogy:** Think of it like a library's card catalog system. Instead of everyone wandering the stacks looking for books individually, they all use the same catalog system to find what they need efficiently and consistently.

**In Tractatus:** MemoryProxy loads the 18 governance rules from MongoDB when services initialize, provides methods to query rules by ID or category, and manages audit log writing. All 6 services (InstructionPersistenceClassifier, CrossReferenceValidator, BoundaryEnforcer, MetacognitiveVerifier, ContextPressureMonitor, BlogCuration) use MemoryProxy to access persistent storage.

**Technical detail:** Singleton pattern ensures all services share the same MongoDB connection pool and cached rules, improving performance and consistency.

---

### API Memory

**What it means:** Anthropic's API Memory system that enhances Claude conversations with automatic session context preservation across multiple interactions.

**Why it matters:** In Phase 5, we integrated API Memory as an *optional enhancement* to our MongoDB-based persistence. API Memory helps maintain conversation continuity, but MongoDB remains the required foundation for governance rules and audit trails.

**Real-world analogy:** Think of MongoDB as your permanent filing cabinet (required for records) and API Memory as sticky notes on your desk (helpful for current work but not the source of truth).

**In Tractatus:** API Memory provides session continuity for Claude Code conversations but does NOT replace persistent storage. Our architecture gracefully degrades—if API Memory is unavailable, all services continue functioning with MongoDB alone.

**Key distinction:** API Memory ≠ Persistent Storage. Governance rules MUST be in MongoDB for production systems.

---

### Hybrid Architecture

**What it means:** Our Phase 5 architecture that combines three memory layers: MongoDB (required), Anthropic API Memory (optional), and filesystem audit trails (debug).

**Why it matters:** This layered approach provides both reliability (MongoDB) and enhanced user experience (API Memory) without creating dependencies on external services. If any optional component fails, the system continues operating.

**Real-world analogy:** Like a car with multiple safety systems—airbags, seatbelts, crumple zones. If one system fails, the others still protect you.

**In Tractatus:**
- **MongoDB** (Layer 1 - Required): Persistent storage for governance rules, audit logs, session state
- **API Memory** (Layer 2 - Optional): Session continuity enhancement for Claude conversations
- **Filesystem** (Layer 3 - Debug): Local audit trail in \`.memory/audit/\` directory for development

This architecture achieved 100% framework integration in Phase 5 with zero breaking changes to existing functionality.

---

### BlogCuration

**What it means:** The sixth framework service (added in Phase 5) that validates blog content and social media posts against inst_016-018 to prevent fabricated statistics, absolute guarantees, and unverified claims.

**Why it matters:** Marketing content can inadvertently include claims that damage credibility or constitute false advertising. BlogCuration prevents publication of content with governance violations.

**Real-world analogy:** Like having a legal compliance officer review every press release before publication to ensure no false or misleading claims.

**In Tractatus:** BlogCuration scans content for patterns like:
- **inst_016**: Fabricated statistics without sources ("95% of users report...")
- **inst_017**: Absolute guarantees about capabilities ("guaranteed 100% secure")
- **inst_018**: Unverified customer claims ("thousands of satisfied customers")

If violations are detected, publication is blocked until content is corrected. All validation attempts are logged to the audit trail with rule IDs and violation details.

**Integration:** BlogCuration shares enforcement logic with BoundaryEnforcer and loads rules via MemoryProxy, ensuring consistent governance across all content.

---`;

async function main() {
  console.log('=== Updating Glossary with Phase 5 Terms ===\n');

  let client;

  try {
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const collection = db.collection('documents');

    // Fetch current document
    const doc = await collection.findOne({ slug: 'tractatus-agentic-governance-system-glossary-of-terms' });

    if (!doc) {
      throw new Error('Glossary document not found');
    }

    console.log('Current document loaded');
    console.log(`Current length: ${doc.content_markdown.length} characters\n`);

    // Find insertion point (after existing service definitions, before "## Integration" or similar)
    let updated = doc.content_markdown;

    // Try to find a good insertion point
    const insertionPoints = [
      '### Context Pressure',
      '### Metacognitive Verification',
      '## Integration',
      '## Framework Components'
    ];

    let insertionPoint = -1;
    let foundSection = null;

    for (const point of insertionPoints) {
      const index = updated.indexOf(point);
      if (index > -1) {
        insertionPoint = index;
        foundSection = point;
        break;
      }
    }

    if (insertionPoint === -1) {
      // Fallback: insert before last section
      insertionPoint = updated.lastIndexOf('##');
    }

    if (insertionPoint > -1) {
      updated = updated.slice(0, insertionPoint) + NEW_TERMS + '\n\n' + updated.slice(insertionPoint);
      console.log(`✓ Inserted Phase 5 terms before: ${foundSection || 'last section'}`);
    } else {
      // Fallback: append to end
      updated = updated + '\n\n' + NEW_TERMS;
      console.log('✓ Appended Phase 5 terms to end');
    }

    // Update version and date in header
    updated = updated.replace('**Version:** 1.0', '**Version:** 1.1');
    updated = updated.replace('**Last Updated:** 2025-10-07', '**Last Updated:** 2025-10-11');

    console.log(`\nNew length: ${updated.length} characters`);
    console.log(`Change: +${updated.length - doc.content_markdown.length} characters\n`);

    // Regenerate HTML
    const content_html = marked.parse(updated);

    // Update document
    const result = await collection.updateOne(
      { slug: 'tractatus-agentic-governance-system-glossary-of-terms' },
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
      console.log('✓ Glossary updated in MongoDB');
      console.log('✓ Version updated to 1.1');
      console.log('✓ Date updated to 2025-10-11');
      console.log('\n=== Update Complete ===');

      console.log('\nPhase 5 terms added:');
      console.log('  - MemoryProxy');
      console.log('  - API Memory');
      console.log('  - Hybrid Architecture');
      console.log('  - BlogCuration');
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
