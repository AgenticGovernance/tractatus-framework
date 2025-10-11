/*
 * Copyright 2025 John G Stroh
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Audit Controller
 * Serves audit logs from MemoryProxy for analytics dashboard
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger.util');

/**
 * Get audit logs for analytics
 * GET /api/admin/audit-logs
 */
async function getAuditLogs(req, res) {
  try {
    const { days = 7, limit = 1000 } = req.query;

    // Calculate date range
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - parseInt(days));

    // Read audit files
    const auditDir = path.join(__dirname, '../../.memory/audit');
    const decisions = [];

    // Get all audit files in date range
    const files = await fs.readdir(auditDir);
    const auditFiles = files.filter(f => f.startsWith('decisions-') && f.endsWith('.jsonl'));

    for (const file of auditFiles) {
      const filePath = path.join(auditDir, file);
      const content = await fs.readFile(filePath, 'utf8');

      // Parse JSONL (one JSON object per line)
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const decision = JSON.parse(line);
          const decisionDate = new Date(decision.timestamp);

          if (decisionDate >= startDate) {
            decisions.push(decision);
          }
        } catch (parseError) {
          logger.error('Error parsing audit line:', parseError);
        }
      }
    }

    // Sort by timestamp (most recent first)
    decisions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply limit
    const limited = decisions.slice(0, parseInt(limit));

    res.json({
      success: true,
      decisions: limited,
      total: decisions.length,
      limited: limited.length,
      dateRange: {
        start: startDate.toISOString(),
        end: today.toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get audit analytics summary
 * GET /api/admin/audit-analytics
 */
async function getAuditAnalytics(req, res) {
  try {
    const { days = 7 } = req.query;

    // Get audit logs
    const auditLogsResponse = await getAuditLogs(req, { json: (data) => data });
    const decisions = auditLogsResponse.decisions;

    // Calculate analytics
    const analytics = {
      total: decisions.length,
      allowed: decisions.filter(d => d.allowed).length,
      blocked: decisions.filter(d => !d.allowed).length,
      violations: decisions.filter(d => d.violations && d.violations.length > 0).length,

      byAction: {},
      bySession: {},
      byDate: {},

      timeline: [],
      topViolations: [],

      dateRange: auditLogsResponse.dateRange
    };

    // Group by action
    decisions.forEach(d => {
      const action = d.action || 'unknown';
      analytics.byAction[action] = (analytics.byAction[action] || 0) + 1;
    });

    // Group by session
    decisions.forEach(d => {
      const session = d.sessionId || 'unknown';
      analytics.bySession[session] = (analytics.bySession[session] || 0) + 1;
    });

    // Group by date
    decisions.forEach(d => {
      const date = new Date(d.timestamp).toISOString().split('T')[0];
      analytics.byDate[date] = (analytics.byDate[date] || 0) + 1;
    });

    // Timeline (last 24 hours by hour)
    const hourCounts = {};
    decisions.forEach(d => {
      const hour = new Date(d.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    for (let i = 0; i < 24; i++) {
      analytics.timeline.push({
        hour: i,
        count: hourCounts[i] || 0
      });
    }

    // Top violations
    const violationCounts = {};
    decisions.forEach(d => {
      if (d.violations && d.violations.length > 0) {
        d.violations.forEach(v => {
          violationCounts[v] = (violationCounts[v] || 0) + 1;
        });
      }
    });

    analytics.topViolations = Object.entries(violationCounts)
      .map(([violation, count]) => ({ violation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    logger.error('Error calculating audit analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  getAuditLogs,
  getAuditAnalytics
};
