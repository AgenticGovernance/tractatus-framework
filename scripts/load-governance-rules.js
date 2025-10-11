#!/usr/bin/env node

/**
 * Load Governance Rules into Database
 *
 * Loads governance rules from JSON file into MongoDB
 *
 * Usage: node scripts/load-governance-rules.js <rules-file.json>
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_prod';

async function loadGovernanceRules(rulesFile) {
  console.log('🔧 Loading Governance Rules...\n');

  // Read rules file
  const rulesPath = path.resolve(process.cwd(), rulesFile);

  if (!fs.existsSync(rulesPath)) {
    console.error(`❌ Error: Rules file not found: ${rulesPath}`);
    process.exit(1);
  }

  let rulesData;
  try {
    const fileContent = fs.readFileSync(rulesPath, 'utf8');
    rulesData = JSON.parse(fileContent);
  } catch (error) {
    console.error(`❌ Error parsing rules file: ${error.message}`);
    process.exit(1);
  }

  if (!rulesData.rules || !Array.isArray(rulesData.rules)) {
    console.error('❌ Error: Invalid rules file format (missing "rules" array)');
    process.exit(1);
  }

  console.log(`📄 Found ${rulesData.rules.length} rules in ${path.basename(rulesFile)}`);

  // Connect to MongoDB
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');

    const db = client.db();
    const rulesCollection = db.collection('governance_rules');

    // Clear existing rules (optional - comment out to append instead)
    const deleteResult = await rulesCollection.deleteMany({});
    if (deleteResult.deletedCount > 0) {
      console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing rules\n`);
    }

    // Insert rules
    const rules = rulesData.rules.map(rule => ({
      ...rule,
      createdAt: new Date(),
      updatedAt: new Date(),
      active: true,
      source: 'manual_load',
      version: rulesData.version || '1.0.0'
    }));

    const insertResult = await rulesCollection.insertMany(rules);
    console.log(`✓ Inserted ${insertResult.insertedCount} governance rules\n`);

    // Create indexes
    await rulesCollection.createIndex({ rule_id: 1 }, { unique: true });
    await rulesCollection.createIndex({ quadrant: 1 });
    await rulesCollection.createIndex({ persistence: 1 });
    await rulesCollection.createIndex({ enforced_by: 1 });
    console.log('✓ Created indexes\n');

    // Summary
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                   Rules Loaded Successfully                        ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    // Count by quadrant
    const quadrantCounts = await rulesCollection.aggregate([
      { $group: { _id: '$quadrant', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    console.log('Rules by Quadrant:');
    quadrantCounts.forEach(({ _id, count }) => {
      console.log(`  ${_id}: ${count}`);
    });

    console.log('');

    // Count by service
    const serviceCounts = await rulesCollection.aggregate([
      { $group: { _id: '$enforced_by', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('Rules by Service:');
    serviceCounts.forEach(({ _id, count }) => {
      console.log(`  ${_id}: ${count}`);
    });

    console.log('\n✅ Governance rules successfully loaded!\n');

  } catch (error) {
    console.error('❌ Error loading rules:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Main
if (process.argv.length < 3) {
  console.error('Usage: node scripts/load-governance-rules.js <rules-file.json>');
  console.error('Example: node scripts/load-governance-rules.js deployment-quickstart/sample-governance-rules.json');
  process.exit(1);
}

const rulesFile = process.argv[2];
loadGovernanceRules(rulesFile);
