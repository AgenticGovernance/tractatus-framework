#!/usr/bin/env node

/**
 * Import Coding Best Practice Rules
 *
 * Creates governance rules based on Phase 2 error analysis.
 * These rules prevent common coding errors like schema-code mismatches.
 *
 * Usage: node scripts/import-coding-rules.js
 */

const mongoose = require('mongoose');
const GovernanceRule = require('../src/models/GovernanceRule.model');
const fs = require('fs');
const path = require('path');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';

async function importRules() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database:', MONGODB_URI);

    // Load rules from JSON file
    const rulesFile = process.argv[2] || path.join(__dirname, '..', 'coding-best-practice-rules.json');
    const rulesData = JSON.parse(fs.readFileSync(rulesFile, 'utf-8'));

    console.log(`\n📋 Loaded ${rulesData.rules.length} rules from ${rulesFile}\n`);

    // Get current max inst_XXX number
    const existingRules = await GovernanceRule.find({ id: /^inst_\d+$/ })
      .sort({ id: -1 })
      .limit(1);

    let nextNumber = 1;
    if (existingRules.length > 0) {
      const lastId = existingRules[0].id; // e.g., "inst_020"
      nextNumber = parseInt(lastId.split('_')[1]) + 1;
    }

    console.log(`📊 Next available rule ID: inst_${String(nextNumber).padStart(3, '0')}\n`);

    const results = {
      created: [],
      skipped: [],
      failed: []
    };

    for (const ruleData of rulesData.rules) {
      const ruleId = `inst_${String(nextNumber).padStart(3, '0')}`;

      try {
        // Check if similar rule already exists (by text)
        const existing = await GovernanceRule.findOne({
          text: ruleData.text,
          active: true
        });

        if (existing) {
          console.log(`⏭️  SKIPPED: ${ruleId} - Similar rule exists (${existing.id})`);
          console.log(`   Text: ${ruleData.text.substring(0, 60)}...\n`);
          results.skipped.push({ ruleId, reason: `Similar to ${existing.id}` });
          continue;
        }

        // Create new rule
        const newRule = new GovernanceRule({
          id: ruleId,
          text: ruleData.text,
          quadrant: ruleData.quadrant,
          persistence: ruleData.persistence,
          category: ruleData.category,
          priority: ruleData.priority,
          scope: ruleData.scope,
          applicableProjects: ruleData.applicableProjects || ['*'],
          temporalScope: ruleData.temporalScope,
          examples: ruleData.examples || [],
          notes: ruleData.notes || '',
          relatedRules: ruleData.relatedRules || [],
          source: 'automated',
          createdBy: 'coding_best_practices_import',
          active: true,

          // AI optimization scores (placeholder - will be calculated by RuleOptimizer)
          clarityScore: null,
          specificityScore: null,
          actionabilityScore: null
        });

        await newRule.save();

        console.log(`✅ CREATED: ${ruleId}`);
        console.log(`   Quadrant: ${ruleData.quadrant} | Persistence: ${ruleData.persistence}`);
        console.log(`   Text: ${ruleData.text.substring(0, 80)}...`);
        console.log(`   Priority: ${ruleData.priority} | Scope: ${ruleData.scope}\n`);

        results.created.push({
          id: ruleId,
          text: ruleData.text.substring(0, 60)
        });

        nextNumber++;

      } catch (error) {
        console.error(`❌ FAILED: ${ruleId}`);
        console.error(`   Error: ${error.message}\n`);
        results.failed.push({
          ruleId,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Created:  ${results.created.length} rules`);
    console.log(`⏭️  Skipped:  ${results.skipped.length} rules`);
    console.log(`❌ Failed:   ${results.failed.length} rules`);
    console.log(`📋 Total:    ${rulesData.rules.length} rules processed\n`);

    if (results.created.length > 0) {
      console.log('Created Rules:');
      results.created.forEach(r => {
        console.log(`  - ${r.id}: ${r.text}...`);
      });
    }

    if (results.failed.length > 0) {
      console.log('\n❌ Failed Rules:');
      results.failed.forEach(r => {
        console.log(`  - ${r.ruleId}: ${r.error}`);
      });
    }

    console.log('\n✅ Import complete!');
    console.log(`📍 View rules: http://localhost:9000/admin/rule-manager.html\n`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run import
importRules();
