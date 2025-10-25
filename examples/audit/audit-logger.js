/**
 * Generic Audit Logging Pattern
 *
 * Purpose: Record governance decisions for analysis
 * Use Case: Track enforcement actions, analyze patterns
 *
 * This demonstrates the audit logging approach.
 */

class AuditLogger {
  constructor(config) {
    this.storage = config.storage;  // Database connection
    this.collection = config.collection || 'auditLogs';
  }

  /**
   * Record a governance decision
   */
  async record(entry) {
    const auditEntry = {
      audit_id: this.generateAuditId(),
      timestamp: new Date(),
      service: entry.service,
      decision: entry.decision,  // 'ALLOW', 'BLOCK', 'WARN'
      rule_id: entry.rule_id || null,
      context: this.sanitizeContext(entry.context),
      reason: entry.reason,
      metadata: entry.metadata || {}
    };

    // Store in database
    await this.storage.insert(this.collection, auditEntry);

    return auditEntry.audit_id;
  }

  /**
   * Query audit logs with filters
   */
  async query(filters) {
    const query = {};

    if (filters.service) {
      query.service = filters.service;
    }

    if (filters.decision) {
      query.decision = filters.decision;
    }

    if (filters.startDate) {
      query.timestamp = { $gte: new Date(filters.startDate) };
    }

    if (filters.endDate) {
      query.timestamp = query.timestamp || {};
      query.timestamp.$lte = new Date(filters.endDate);
    }

    return await this.storage.find(this.collection, query);
  }

  /**
   * Get statistics by service
   */
  async getServiceStats() {
    const pipeline = [
      {
        $group: {
          _id: '$service',
          total: { $sum: 1 },
          blocks: {
            $sum: { $cond: [{ $eq: ['$decision', 'BLOCK'] }, 1, 0] }
          }
        }
      },
      { $sort: { total: -1 } }
    ];

    return await this.storage.aggregate(this.collection, pipeline);
  }

  /**
   * Get block rate over time
   */
  async getBlockRate(startDate, endDate) {
    const logs = await this.query({ startDate, endDate });

    const total = logs.length;
    const blocks = logs.filter(l => l.decision === 'BLOCK').length;

    return {
      total,
      blocks,
      rate: total > 0 ? (blocks / total) * 100 : 0
    };
  }

  /**
   * Sanitize context to remove sensitive data
   */
  sanitizeContext(context) {
    if (!context) return null;

    // Remove sensitive fields
    const sanitized = { ...context };
    delete sanitized.credentials;
    delete sanitized.apiKeys;
    delete sanitized.passwords;

    // Truncate long strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 200) {
        sanitized[key] = sanitized[key].substring(0, 200) + '...';
      }
    });

    return sanitized;
  }

  /**
   * Generate unique audit ID
   */
  generateAuditId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `audit_${timestamp}${random}`;
  }
}

/**
 * Example Usage
 */
async function example() {
  const auditLogger = new AuditLogger({
    storage: yourDatabaseConnection,
    collection: 'auditLogs'
  });

  // Record a block decision
  const auditId = await auditLogger.record({
    service: 'BoundaryEnforcer',
    decision: 'BLOCK',
    rule_id: 'inst_001',
    context: {
      tool: 'Edit',
      file: 'config.json',
      action: 'modify_security_setting'
    },
    reason: 'Action violates security boundary',
    metadata: {
      user_override_requested: false
    }
  });

  console.log(`Logged decision: ${auditId}`);

  // Query blocks from last week
  const recentBlocks = await auditLogger.query({
    decision: 'BLOCK',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  });

  console.log(`Recent blocks: ${recentBlocks.length}`);

  // Get service statistics
  const stats = await auditLogger.getServiceStats();
  stats.forEach(s => {
    console.log(`${s._id}: ${s.total} decisions, ${s.blocks} blocks`);
  });
}

module.exports = { AuditLogger };
