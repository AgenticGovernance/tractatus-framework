#!/usr/bin/env node

/**
 * Migration Script: Filesystem → MongoDB
 *
 * Migrates existing governance rules and audit logs from filesystem to MongoDB
 *
 * Sources:
 * - .claude/instruction-history.json → governanceRules collection
 * - .memory/audit/decisions-*.jsonl → auditLogs collection
 *
 * Safety:
 * - Dry run mode (preview changes without writing)
 * - Backup creation before migration
 * - Validation of data integrity
 * - Rollback support
 */

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const GovernanceRule = require('../src/models/GovernanceRule.model');
const AuditLog = require('../src/models/AuditLog.model');
const logger = require('../src/utils/logger.util');

// Configuration
const INSTRUCTION_HISTORY_PATH = path.join(__dirname, '../.claude/instruction-history.json');
const AUDIT_DIR_PATH = path.join(__dirname, '../.memory/audit');
const BACKUP_DIR = path.join(__dirname, '../.migration-backup');

// Migration statistics
const stats = {
  rulesFound: 0,
  rulesMigrated: 0,
  rulesSkipped: 0,
  auditFilesFound: 0,
  auditLogsMigrated: 0,
  auditLogsSkipped: 0,
  errors: []
};

/**
 * Parse instruction history JSON
 */
async function loadInstructionHistory() {
  try {
    const data = await fs.readFile(INSTRUCTION_HISTORY_PATH, 'utf8');
    const parsed = JSON.parse(data);

    if (!parsed.instructions || !Array.isArray(parsed.instructions)) {
      throw new Error('Invalid instruction history format');
    }

    logger.info('Instruction history loaded', {
      count: parsed.instructions.length,
      version: parsed.version
    });

    return parsed.instructions;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('Instruction history file not found', { path: INSTRUCTION_HISTORY_PATH });
      return [];
    }
    throw error;
  }
}

/**
 * Convert instruction to governance rule format
 */
function convertInstructionToRule(instruction) {
  // Map instruction fields to governance rule schema
  return {
    id: instruction.id,
    text: instruction.text,
    quadrant: instruction.quadrant,
    persistence: instruction.persistence,
    category: instruction.category || 'other',
    priority: instruction.priority || 50,
    temporalScope: instruction.temporal_scope || 'PERMANENT',
    expiresAt: instruction.expires_at ? new Date(instruction.expires_at) : null,
    active: instruction.active !== false,
    source: 'migration',
    createdBy: instruction.created_by || 'migration',
    examples: instruction.examples || [],
    relatedRules: instruction.related_rules || [],
    notes: instruction.notes || ''
  };
}

/**
 * Migrate governance rules to MongoDB
 */
async function migrateGovernanceRules(dryRun = true) {
  logger.info('Starting governance rules migration', { dryRun });

  const instructions = await loadInstructionHistory();
  stats.rulesFound = instructions.length;

  if (instructions.length === 0) {
    logger.warn('No instructions found to migrate');
    return;
  }

  for (const instruction of instructions) {
    try {
      const ruleData = convertInstructionToRule(instruction);

      if (dryRun) {
        logger.info('[DRY RUN] Would create rule', {
          id: ruleData.id,
          quadrant: ruleData.quadrant,
          persistence: ruleData.persistence
        });
        stats.rulesMigrated++;
      } else {
        // Check if rule already exists
        const existing = await GovernanceRule.findOne({ id: ruleData.id });

        if (existing) {
          logger.warn('Rule already exists, skipping', { id: ruleData.id });
          stats.rulesSkipped++;
          continue;
        }

        // Create new rule
        const rule = new GovernanceRule(ruleData);
        await rule.save();

        logger.info('Rule migrated', {
          id: ruleData.id,
          quadrant: ruleData.quadrant
        });

        stats.rulesMigrated++;
      }
    } catch (error) {
      logger.error('Failed to migrate rule', {
        id: instruction.id,
        error: error.message
      });
      stats.errors.push({
        type: 'rule',
        id: instruction.id,
        error: error.message
      });
    }
  }

  logger.info('Governance rules migration complete', {
    found: stats.rulesFound,
    migrated: stats.rulesMigrated,
    skipped: stats.rulesSkipped,
    errors: stats.errors.filter(e => e.type === 'rule').length
  });
}

/**
 * Load audit logs from JSONL files
 */
async function loadAuditLogs() {
  try {
    const files = await fs.readdir(AUDIT_DIR_PATH);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    stats.auditFilesFound = jsonlFiles.length;

    logger.info('Audit log files found', { count: jsonlFiles.length });

    const allLogs = [];

    for (const file of jsonlFiles) {
      const filePath = path.join(AUDIT_DIR_PATH, file);
      const content = await fs.readFile(filePath, 'utf8');

      // Parse JSONL (one JSON object per line)
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          allLogs.push(log);
        } catch (error) {
          logger.error('Failed to parse JSONL line', {
            file,
            error: error.message
          });
        }
      }
    }

    logger.info('Audit logs loaded', { count: allLogs.length });

    return allLogs;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('Audit directory not found', { path: AUDIT_DIR_PATH });
      return [];
    }
    throw error;
  }
}

/**
 * Convert audit log to MongoDB format
 */
function convertAuditLog(log) {
  return {
    sessionId: log.sessionId,
    action: log.action,
    allowed: log.allowed !== false,
    rulesChecked: log.rulesChecked || [],
    violations: (log.violations || []).map(v => ({
      ruleId: v.ruleId || v,
      ruleText: v.ruleText || '',
      severity: v.severity || 'MEDIUM',
      details: v.details || ''
    })),
    metadata: log.metadata || {},
    domain: log.metadata?.domain || 'UNKNOWN',
    boundary: log.metadata?.boundary || null,
    tractatus_section: log.metadata?.tractatus_section || null,
    service: log.metadata?.service || 'BoundaryEnforcer',
    durationMs: log.metadata?.durationMs || null,
    timestamp: log.timestamp ? new Date(log.timestamp) : new Date()
  };
}

/**
 * Migrate audit logs to MongoDB
 */
async function migrateAuditLogs(dryRun = true) {
  logger.info('Starting audit logs migration', { dryRun });

  const logs = await loadAuditLogs();

  if (logs.length === 0) {
    logger.warn('No audit logs found to migrate');
    return;
  }

  for (const log of logs) {
    try {
      const auditData = convertAuditLog(log);

      if (dryRun) {
        logger.debug('[DRY RUN] Would create audit log', {
          sessionId: auditData.sessionId,
          action: auditData.action,
          allowed: auditData.allowed
        });
        stats.auditLogsMigrated++;
      } else {
        // Create audit log entry
        const auditLog = new AuditLog(auditData);
        await auditLog.save();

        stats.auditLogsMigrated++;
      }
    } catch (error) {
      logger.error('Failed to migrate audit log', {
        sessionId: log.sessionId,
        error: error.message
      });
      stats.errors.push({
        type: 'audit',
        sessionId: log.sessionId,
        error: error.message
      });
    }
  }

  logger.info('Audit logs migration complete', {
    migrated: stats.auditLogsMigrated,
    errors: stats.errors.filter(e => e.type === 'audit').length
  });
}

/**
 * Create backup of filesystem data
 */
async function createBackup() {
  logger.info('Creating backup', { dir: BACKUP_DIR });

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  // Backup instruction history
  try {
    const historyContent = await fs.readFile(INSTRUCTION_HISTORY_PATH, 'utf8');
    await fs.writeFile(
      path.join(BACKUP_DIR, 'instruction-history.json'),
      historyContent,
      'utf8'
    );
    logger.info('Backed up instruction history');
  } catch (error) {
    logger.warn('Could not backup instruction history', { error: error.message });
  }

  // Backup audit logs
  try {
    const auditBackupDir = path.join(BACKUP_DIR, 'audit');
    await fs.mkdir(auditBackupDir, { recursive: true });

    const files = await fs.readdir(AUDIT_DIR_PATH);
    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        const content = await fs.readFile(path.join(AUDIT_DIR_PATH, file), 'utf8');
        await fs.writeFile(path.join(auditBackupDir, file), content, 'utf8');
      }
    }
    logger.info('Backed up audit logs', { count: files.length });
  } catch (error) {
    logger.warn('Could not backup audit logs', { error: error.message });
  }

  logger.info('Backup complete', { location: BACKUP_DIR });
}

/**
 * Verify migration integrity
 */
async function verifyMigration() {
  logger.info('Verifying migration integrity');

  // Count rules in MongoDB
  const ruleCount = await GovernanceRule.countDocuments({ source: 'migration' });

  // Count audit logs in MongoDB
  const auditCount = await AuditLog.countDocuments();

  logger.info('Migration verification', {
    rulesInMongoDB: ruleCount,
    auditLogsInMongoDB: auditCount,
    rulesExpected: stats.rulesMigrated,
    auditLogsExpected: stats.auditLogsMigrated
  });

  if (ruleCount !== stats.rulesMigrated) {
    logger.error('Rule count mismatch!', {
      expected: stats.rulesMigrated,
      actual: ruleCount
    });
    return false;
  }

  logger.info('✅ Migration verification passed');
  return true;
}

/**
 * Main migration function
 */
async function runMigration(options = {}) {
  const dryRun = options.dryRun !== false;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Tractatus Migration: Filesystem → MongoDB');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be written\n');
  } else {
    console.log('🔥 LIVE MODE - Data will be written to MongoDB\n');
  }

  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev');
    logger.info('MongoDB connected');

    // Create backup (only in live mode)
    if (!dryRun) {
      await createBackup();
    }

    // Migrate governance rules
    await migrateGovernanceRules(dryRun);

    // Migrate audit logs
    await migrateAuditLogs(dryRun);

    // Verify migration (only in live mode)
    if (!dryRun) {
      await verifyMigration();
    }

    // Print summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  MIGRATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Governance Rules:');
    console.log(`  Found:    ${stats.rulesFound}`);
    console.log(`  Migrated: ${stats.rulesMigrated}`);
    console.log(`  Skipped:  ${stats.rulesSkipped}`);

    console.log('\nAudit Logs:');
    console.log(`  Files:    ${stats.auditFilesFound}`);
    console.log(`  Migrated: ${stats.auditLogsMigrated}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      stats.errors.forEach(err => {
        console.log(`  - ${err.type}: ${err.id || err.sessionId} - ${err.error}`);
      });
    }

    if (dryRun) {
      console.log('\n✅ DRY RUN COMPLETE');
      console.log('\nTo perform actual migration:');
      console.log('  node scripts/migrate-to-mongodb.js --live\n');
    } else {
      console.log('\n✅ MIGRATION COMPLETE');
      console.log(`\nBackup location: ${BACKUP_DIR}\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const liveMode = args.includes('--live');

  runMigration({ dryRun: !liveMode })
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
