#!/usr/bin/env node

/**
 * Migration Script: .claude/instruction-history.json → .memory/governance/
 *
 * Migrates Tractatus governance rules from legacy .claude/ directory
 * to new MemoryProxy-managed .memory/governance/ directory.
 *
 * Phase 5 PoC - Week 3: Production Migration
 *
 * Usage:
 *   node scripts/migrate-to-memory-proxy.js [--dry-run] [--backup]
 *
 * Options:
 *   --dry-run  Preview migration without making changes
 *   --backup   Create backup of source file before migration (default: true)
 *   --force    Skip confirmation prompts
 */

const fs = require('fs').promises;
const path = require('path');
const { MemoryProxyService } = require('../src/services/MemoryProxy.service');
const logger = require('../src/utils/logger.util');

// Configuration
const SOURCE_PATH = path.join(__dirname, '../.claude/instruction-history.json');
const BACKUP_DIR = path.join(__dirname, '../.claude/backups');
const MEMORY_BASE_PATH = path.join(__dirname, '../.memory');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const createBackup = !args.includes('--no-backup');
const forceMode = args.includes('--force');

/**
 * Validate source file exists and is readable
 */
async function validateSource() {
  try {
    const stats = await fs.stat(SOURCE_PATH);
    if (!stats.isFile()) {
      throw new Error('Source path is not a file');
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Source file not found: ${SOURCE_PATH}`);
    }
    throw new Error(`Cannot access source file: ${error.message}`);
  }
}

/**
 * Load rules from source file
 */
async function loadSourceRules() {
  try {
    const data = await fs.readFile(SOURCE_PATH, 'utf8');
    const parsed = JSON.parse(data);

    if (!parsed.instructions || !Array.isArray(parsed.instructions)) {
      throw new Error('Invalid source format: missing instructions array');
    }

    return parsed.instructions;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in source file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Create backup of source file
 */
async function createSourceBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `instruction-history-${timestamp}.json`);

  try {
    // Create backup directory if it doesn't exist
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Copy source file to backup
    await fs.copyFile(SOURCE_PATH, backupPath);

    console.log(`  ✓ Backup created: ${backupPath}`);
    return backupPath;
  } catch (error) {
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}

/**
 * Validate rules before migration
 */
function validateRules(rules) {
  const issues = [];

  rules.forEach((rule, index) => {
    if (!rule.id) {
      issues.push(`Rule ${index}: missing 'id' field`);
    }
    if (!rule.text) {
      issues.push(`Rule ${index}: missing 'text' field`);
    }
    if (!rule.quadrant) {
      issues.push(`Rule ${index}: missing 'quadrant' field`);
    }
    if (!rule.persistence) {
      issues.push(`Rule ${index}: missing 'persistence' field`);
    }
  });

  return issues;
}

/**
 * Analyze rules for migration preview
 */
function analyzeRules(rules) {
  const analysis = {
    total: rules.length,
    by_quadrant: {},
    by_persistence: {},
    active: 0,
    inactive: 0,
    critical_rules: []
  };

  rules.forEach(rule => {
    // Count by quadrant
    analysis.by_quadrant[rule.quadrant] = (analysis.by_quadrant[rule.quadrant] || 0) + 1;

    // Count by persistence
    analysis.by_persistence[rule.persistence] = (analysis.by_persistence[rule.persistence] || 0) + 1;

    // Count active/inactive
    if (rule.active !== false) {
      analysis.active++;
    } else {
      analysis.inactive++;
    }

    // Identify critical enforcement rules
    if (['inst_016', 'inst_017', 'inst_018'].includes(rule.id)) {
      analysis.critical_rules.push(rule.id);
    }
  });

  return analysis;
}

/**
 * Perform migration
 */
async function migrate(rules) {
  const memoryProxy = new MemoryProxyService({
    memoryBasePath: MEMORY_BASE_PATH
  });

  try {
    // Initialize MemoryProxy
    await memoryProxy.initialize();
    console.log('  ✓ MemoryProxy initialized');

    // Persist rules
    const result = await memoryProxy.persistGovernanceRules(rules);

    return result;
  } catch (error) {
    throw new Error(`Migration failed: ${error.message}`);
  }
}

/**
 * Verify migration success
 */
async function verifyMigration(originalRules) {
  const memoryProxy = new MemoryProxyService({
    memoryBasePath: MEMORY_BASE_PATH
  });

  try {
    await memoryProxy.initialize();

    // Load rules from memory
    const migratedRules = await memoryProxy.loadGovernanceRules();

    // Compare counts
    if (migratedRules.length !== originalRules.length) {
      throw new Error(`Rule count mismatch: expected ${originalRules.length}, got ${migratedRules.length}`);
    }

    // Verify critical rules
    const criticalRuleIds = ['inst_016', 'inst_017', 'inst_018'];
    for (const ruleId of criticalRuleIds) {
      const rule = await memoryProxy.getRule(ruleId);
      if (!rule) {
        throw new Error(`Critical rule ${ruleId} not found after migration`);
      }
    }

    // Verify data integrity for all rules
    for (let i = 0; i < originalRules.length; i++) {
      const original = originalRules[i];
      const migrated = migratedRules.find(r => r.id === original.id);

      if (!migrated) {
        throw new Error(`Rule ${original.id} missing after migration`);
      }

      // Check critical fields
      if (migrated.text !== original.text) {
        throw new Error(`Rule ${original.id}: text mismatch`);
      }
      if (migrated.quadrant !== original.quadrant) {
        throw new Error(`Rule ${original.id}: quadrant mismatch`);
      }
      if (migrated.persistence !== original.persistence) {
        throw new Error(`Rule ${original.id}: persistence mismatch`);
      }
    }

    return {
      success: true,
      rulesVerified: migratedRules.length,
      criticalRulesVerified: criticalRuleIds.length
    };

  } catch (error) {
    throw new Error(`Verification failed: ${error.message}`);
  }
}

/**
 * Confirm migration with user (unless --force)
 */
async function confirmMigration(analysis) {
  if (forceMode) {
    return true;
  }

  console.log('\n⚠️  Migration will:');
  console.log(`  • Copy ${analysis.total} rules to .memory/governance/`);
  console.log(`  • Preserve all rule metadata and fields`);
  if (createBackup) {
    console.log(`  • Create backup of source file in .claude/backups/`);
  }
  console.log('\nContinue? (yes/no): ');

  // Read user input
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    readline.question('', answer => {
      readline.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Main migration workflow
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Tractatus Governance Rules Migration');
  console.log('  .claude/ → .memory/governance/');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const results = {
    success: false,
    rulesLoaded: 0,
    rulesMigrated: 0,
    backupPath: null,
    errors: []
  };

  try {
    // Step 1: Validate source
    console.log('[Step 1] Validating source file...');
    await validateSource();
    console.log(`  ✓ Source exists: ${SOURCE_PATH}\n`);

    // Step 2: Load rules
    console.log('[Step 2] Loading governance rules...');
    const rules = await loadSourceRules();
    results.rulesLoaded = rules.length;
    console.log(`  ✓ Loaded ${rules.length} rules\n`);

    // Step 3: Validate rules
    console.log('[Step 3] Validating rule format...');
    const validationIssues = validateRules(rules);

    if (validationIssues.length > 0) {
      console.log('  ✗ Validation issues found:');
      validationIssues.forEach(issue => console.log(`    • ${issue}`));
      throw new Error('Rule validation failed');
    }

    console.log(`  ✓ All ${rules.length} rules valid\n`);

    // Step 4: Analyze rules
    console.log('[Step 4] Analyzing rules...');
    const analysis = analyzeRules(rules);

    console.log(`  Total: ${analysis.total} rules`);
    console.log(`  Active: ${analysis.active} | Inactive: ${analysis.inactive}`);
    console.log('\n  By Quadrant:');
    Object.entries(analysis.by_quadrant).forEach(([quadrant, count]) => {
      console.log(`    ${quadrant}: ${count}`);
    });
    console.log('\n  By Persistence:');
    Object.entries(analysis.by_persistence).forEach(([level, count]) => {
      console.log(`    ${level}: ${count}`);
    });
    console.log(`\n  Critical Rules: ${analysis.critical_rules.join(', ')}\n`);

    // Step 5: Confirm migration
    if (!isDryRun) {
      console.log('[Step 5] Confirming migration...');
      const confirmed = await confirmMigration(analysis);

      if (!confirmed) {
        console.log('\n❌ Migration cancelled by user\n');
        process.exit(0);
      }

      console.log('  ✓ Migration confirmed\n');
    } else {
      console.log('[Step 5] Skipping confirmation (dry-run mode)\n');
    }

    // Step 6: Create backup
    if (createBackup && !isDryRun) {
      console.log('[Step 6] Creating backup...');
      results.backupPath = await createSourceBackup();
      console.log();
    } else if (isDryRun) {
      console.log('[Step 6] Backup creation (skipped - dry-run)\n');
    } else {
      console.log('[Step 6] Backup creation (skipped - --no-backup)\n');
    }

    // Step 7: Migrate rules
    if (!isDryRun) {
      console.log('[Step 7] Migrating rules to MemoryProxy...');
      const migrationResult = await migrate(rules);
      results.rulesMigrated = migrationResult.rulesStored;

      console.log(`  ✓ Migrated ${migrationResult.rulesStored} rules`);
      console.log(`  Duration: ${migrationResult.duration}ms`);
      console.log(`  Path: ${migrationResult.path}\n`);
    } else {
      console.log('[Step 7] Migration (skipped - dry-run)\n');
    }

    // Step 8: Verify migration
    if (!isDryRun) {
      console.log('[Step 8] Verifying migration...');
      const verification = await verifyMigration(rules);

      console.log(`  ✓ Verified ${verification.rulesVerified} rules`);
      console.log(`  ✓ Critical rules: ${verification.criticalRulesVerified}/3\n`);
    } else {
      console.log('[Step 8] Verification (skipped - dry-run)\n');
    }

    results.success = true;

  } catch (error) {
    console.error(`\n✗ MIGRATION FAILED: ${error.message}\n`);
    if (error.stack && process.env.DEBUG) {
      console.error('Stack trace:', error.stack);
    }
    results.errors.push(error.message);
    results.success = false;
  }

  // Results summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MIGRATION RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (results.success) {
    if (isDryRun) {
      console.log('✅ DRY RUN SUCCESSFUL - Ready for actual migration');
      console.log('\nTo perform migration, run:');
      console.log('  node scripts/migrate-to-memory-proxy.js');
    } else {
      console.log('✅ MIGRATION SUCCESSFUL');
      console.log('\nSummary:');
      console.log(`  • Rules loaded: ${results.rulesLoaded}`);
      console.log(`  • Rules migrated: ${results.rulesMigrated}`);
      if (results.backupPath) {
        console.log(`  • Backup: ${results.backupPath}`);
      }
      console.log('\nNext Steps:');
      console.log('  1. Initialize services: await service.initialize()');
      console.log('  2. Verify services load rules from .memory/');
      console.log('  3. Monitor .memory/audit/ for decision logs');
    }
  } else {
    console.log('❌ MIGRATION FAILED');
    console.log('\nErrors:');
    results.errors.forEach(err => console.log(`  • ${err}`));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(results.success ? 0 : 1);
}

// Run migration
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };
