/**
 * Migration: Enhance Governance Rules Schema
 * Adds multi-project governance fields to existing rules
 *
 * New fields:
 * - scope (UNIVERSAL | PROJECT_SPECIFIC)
 * - applicableProjects (array)
 * - variables (array)
 * - clarityScore, specificityScore, actionabilityScore
 * - validationStatus, lastValidated, validationResults
 * - usageStats
 * - optimizationHistory
 */

const mongoose = require('mongoose');
const GovernanceRule = require('../../src/models/GovernanceRule.model');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';

async function up() {
  console.log('🔄 Starting migration: 001-enhance-governance-rules');
  console.log('   Database:', MONGODB_URI);

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Get all existing rules (use lean() to get raw documents without schema defaults)
    const rules = await GovernanceRule.find({}).lean();
    console.log(`\n📊 Found ${rules.length} rules to migrate`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const ruleDoc of rules) {
      // Check if rule already has new fields in database (not just schema defaults)
      if (ruleDoc.scope !== undefined && ruleDoc.scope !== null) {
        console.log(`   ⏩ Skipping ${ruleDoc.id} (already migrated)`);
        skippedCount++;
        continue;
      }

      // Load the rule with Mongoose model to apply schema methods
      const rule = await GovernanceRule.findById(ruleDoc._id);

      // Auto-detect variables in rule text (${VAR_NAME} pattern)
      const variables = [];
      const varPattern = /\$\{([A-Z_]+)\}/g;
      let match;
      while ((match = varPattern.exec(rule.text)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }

      // Determine scope based on variables
      // If rule has variables, it's likely UNIVERSAL (will be customized per project)
      // If no variables and rule mentions specific values, it's PROJECT_SPECIFIC
      const hasVariables = variables.length > 0;
      const scope = hasVariables ? 'UNIVERSAL' : 'PROJECT_SPECIFIC';

      // Update rule with new fields
      rule.scope = scope;
      rule.applicableProjects = ['*']; // Apply to all projects by default
      rule.variables = variables;

      // Initialize AI optimization fields
      rule.clarityScore = null; // Will be calculated by AI optimizer
      rule.specificityScore = null;
      rule.actionabilityScore = null;
      rule.lastOptimized = null;
      rule.optimizationHistory = [];

      // Initialize validation fields
      rule.validationStatus = 'NOT_VALIDATED';
      rule.lastValidated = null;
      rule.validationResults = null;

      // Initialize usage stats
      rule.usageStats = {
        referencedInProjects: [],
        timesEnforced: 0,
        conflictsDetected: 0,
        lastEnforced: null
      };

      await rule.save();

      console.log(`   ✓ ${rule.id}: ${scope} (${variables.length} variables)`);
      updatedCount++;
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${rules.length}`);

    // Create indexes for new fields
    console.log('\n📊 Creating indexes for new fields...');
    await GovernanceRule.createIndexes();
    console.log('   ✓ Indexes created');

    return { success: true, updated: updatedCount, skipped: skippedCount };

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

async function down() {
  console.log('🔄 Rolling back migration: 001-enhance-governance-rules');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Remove new fields from all rules
    const result = await GovernanceRule.updateMany(
      {},
      {
        $unset: {
          scope: '',
          applicableProjects: '',
          variables: '',
          clarityScore: '',
          specificityScore: '',
          actionabilityScore: '',
          lastOptimized: '',
          optimizationHistory: '',
          validationStatus: '',
          lastValidated: '',
          validationResults: '',
          usageStats: ''
        }
      }
    );

    console.log(`✓ Rollback complete! Removed fields from ${result.modifiedCount} rules`);

    return { success: true, modified: result.modifiedCount };

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2] || 'up';

  if (command === 'up') {
    up()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else if (command === 'down') {
    down()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    console.error('Usage: node 001-enhance-governance-rules.js [up|down]');
    process.exit(1);
  }
}

module.exports = { up, down };
