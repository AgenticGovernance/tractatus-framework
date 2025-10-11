#!/usr/bin/env node

/**
 * Tractatus Framework - Public Sync Security Validator
 *
 * Scans files before syncing to public repository to prevent:
 * - Internal file paths
 * - Database names and connection strings
 * - Port numbers and infrastructure details
 * - Email addresses and credentials
 * - Cross-project references
 * - Internal URLs and IP addresses
 *
 * Exit codes:
 * 0 = PASS (safe to sync)
 * 1 = FAIL (security issues found, block sync)
 * 2 = ERROR (validation system failure)
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

// Security patterns to detect
const SECURITY_PATTERNS = [
  // Internal file paths
  {
    pattern: /\/home\/[a-zA-Z0-9_-]+\/projects\//gi,
    severity: 'HIGH',
    description: 'Internal file path detected',
    category: 'File Paths'
  },
  {
    pattern: /\/home\/[a-zA-Z0-9_-]+\//gi,
    severity: 'HIGH',
    description: 'Home directory path detected',
    category: 'File Paths'
  },

  // Database names and connection strings
  {
    pattern: /tractatus_dev|tractatus_prod|tractatus_test/gi,
    severity: 'HIGH',
    description: 'Database name detected',
    category: 'Database'
  },
  {
    pattern: /mongodb:\/\/[^\s]+/gi,
    severity: 'CRITICAL',
    description: 'MongoDB connection string detected',
    category: 'Database'
  },
  {
    pattern: /port:\s*27017/gi,
    severity: 'MEDIUM',
    description: 'MongoDB port number detected',
    category: 'Infrastructure'
  },

  // Port numbers and infrastructure
  {
    pattern: /port\s*(?:=|:)\s*(?:9000|3000|8080|5000)/gi,
    severity: 'MEDIUM',
    description: 'Application port number detected',
    category: 'Infrastructure'
  },
  {
    pattern: /localhost:\d+/gi,
    severity: 'MEDIUM',
    description: 'Localhost URL with port detected',
    category: 'Infrastructure'
  },

  // IP addresses and servers
  {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    severity: 'HIGH',
    description: 'IP address detected',
    category: 'Infrastructure',
    exceptions: ['0.0.0.0', '127.0.0.1', '255.255.255.255'] // Common non-sensitive IPs
  },
  {
    pattern: /vps-[a-zA-Z0-9-]+\.vps\.ovh\.net/gi,
    severity: 'CRITICAL',
    description: 'OVH VPS hostname detected',
    category: 'Infrastructure'
  },

  // Email addresses (except public ones)
  {
    pattern: /[a-zA-Z0-9._%+-]+@(?!example\.com|domain\.com|anthropic\.com|agenticgovernance\.org|pm\.me)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
    severity: 'MEDIUM',
    description: 'Personal email address detected',
    category: 'Personal Info'
  },

  // Systemd and process management
  {
    pattern: /tractatus(?:-dev|-prod)?\.service/gi,
    severity: 'MEDIUM',
    description: 'Systemd service name detected',
    category: 'Infrastructure'
  },
  {
    pattern: /pm2\s+(?:start|restart|stop|list)/gi,
    severity: 'LOW',
    description: 'PM2 process management command detected',
    category: 'Infrastructure'
  },

  // SSH and credentials
  {
    pattern: /ssh-rsa\s+[A-Za-z0-9+\/=]+/gi,
    severity: 'CRITICAL',
    description: 'SSH public key detected',
    category: 'Credentials'
  },
  {
    pattern: /-----BEGIN\s+(?:RSA\s+)?(?:PRIVATE|PUBLIC)\s+KEY-----/gi,
    severity: 'CRITICAL',
    description: 'SSH key block detected',
    category: 'Credentials'
  },
  {
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']?[^\s"']+/gi,
    severity: 'CRITICAL',
    description: 'Password detected',
    category: 'Credentials'
  },
  {
    pattern: /(?:api[-_]?key|apikey|access[-_]?token)\s*[:=]\s*["']?[^\s"']+/gi,
    severity: 'CRITICAL',
    description: 'API key or token detected',
    category: 'Credentials'
  },

  // Cross-project references
  {
    pattern: /\/projects\/(?:sydigital|family-history)\//gi,
    severity: 'HIGH',
    description: 'Cross-project reference detected',
    category: 'Project References'
  },

  // Internal documentation markers
  {
    pattern: /CLAUDE\.md|CLAUDE_.*_Guide\.md/gi,
    severity: 'HIGH',
    description: 'Internal documentation reference detected',
    category: 'Internal Docs'
  },
  {
    pattern: /SESSION-HANDOFF-.*\.md/gi,
    severity: 'HIGH',
    description: 'Session handoff document reference detected',
    category: 'Internal Docs'
  }
];

// Allowed patterns that should not trigger warnings
const ALLOWED_PATTERNS = [
  /\[DATABASE_NAME\]/gi,  // Placeholder used in sanitized examples
  /\[PORT\]/gi,           // Placeholder for ports
  /\[PATH\]/gi,           // Placeholder for paths
  /example\.com/gi,       // Example domain
  /localhost/gi           // Generic localhost reference without port
];

class PublicSyncValidator {
  constructor() {
    this.issues = [];
    this.filesScanned = 0;
    this.mode = process.env.SYNC_MODE || 'manual';
  }

  /**
   * Main validation entry point
   */
  async validate() {
    console.log(`${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}  Tractatus Public Sync - Security Validation${colors.reset}`);
    console.log(`${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}\n`);

    // Determine files to scan
    const filesToScan = await this.getFilesToSync();

    if (filesToScan.length === 0) {
      console.log(`${colors.yellow}⚠ No files to validate${colors.reset}\n`);
      return 0;
    }

    console.log(`${colors.cyan}📁 Files to validate: ${filesToScan.length}${colors.reset}\n`);

    // Scan each file
    for (const file of filesToScan) {
      await this.scanFile(file);
    }

    // Report results
    return this.reportResults();
  }

  /**
   * Get list of files that will be synced
   */
  async getFilesToSync() {
    const files = [];
    const baseDir = process.cwd();

    // Case studies
    const caseStudiesDir = path.join(baseDir, 'docs/case-studies');
    if (fs.existsSync(caseStudiesDir)) {
      const caseStudies = fs.readdirSync(caseStudiesDir)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(caseStudiesDir, f));
      files.push(...caseStudies);
    }

    // Research topics
    const researchDir = path.join(baseDir, 'docs/research');
    if (fs.existsSync(researchDir)) {
      const research = fs.readdirSync(researchDir)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(researchDir, f));
      files.push(...research);
    }

    // README (if marked as sanitized)
    const readme = path.join(baseDir, 'README.md');
    if (fs.existsSync(readme)) {
      const content = fs.readFileSync(readme, 'utf8');
      if (content.includes('<!-- PUBLIC_REPO_SAFE -->')) {
        files.push(readme);
      }
    }

    return files;
  }

  /**
   * Strip markdown code blocks from content
   */
  stripCodeBlocks(content) {
    // Remove fenced code blocks (```...```)
    let stripped = content.replace(/```[\s\S]*?```/g, '');
    // Remove inline code (`...`)
    stripped = stripped.replace(/`[^`]+`/g, '');
    return stripped;
  }

  /**
   * Check if a match is inside a code block
   */
  isInCodeBlock(content, match) {
    const matchIndex = content.indexOf(match);
    if (matchIndex === -1) return false;

    // Check if inside fenced code block
    const beforeMatch = content.substring(0, matchIndex);
    const fenceCount = (beforeMatch.match(/```/g) || []).length;
    if (fenceCount % 2 === 1) return true; // Odd number of fences = inside block

    // Check if inside inline code
    const lineStart = beforeMatch.lastIndexOf('\n') + 1;
    const lineEnd = content.indexOf('\n', matchIndex);
    const line = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
    const matchPos = matchIndex - lineStart;

    let inInlineCode = false;
    let backtickCount = 0;
    for (let i = 0; i < matchPos; i++) {
      if (line[i] === '`') backtickCount++;
    }
    return backtickCount % 2 === 1; // Odd number of backticks = inside inline code
  }

  /**
   * Scan a single file for security issues
   */
  async scanFile(filePath) {
    this.filesScanned++;
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    console.log(`${colors.cyan}▶ Scanning:${colors.reset} ${relativePath}`);

    // Check against each security pattern
    for (const { pattern, severity, description, category, exceptions } of SECURITY_PATTERNS) {
      const matches = content.match(pattern);

      if (matches) {
        // Filter out allowed patterns and exceptions
        const validMatches = matches.filter(match => {
          // Check if it's an exception
          if (exceptions && exceptions.some(exc => match.toLowerCase().includes(exc.toLowerCase()))) {
            return false;
          }

          // Check if it's an allowed pattern
          if (ALLOWED_PATTERNS.some(allowed => allowed.test(match))) {
            return false;
          }

          // For infrastructure patterns (ports, etc), skip if in code blocks
          if (category === 'Infrastructure' && this.isInCodeBlock(content, match)) {
            return false;
          }

          return true;
        });

        if (validMatches.length > 0) {
          this.issues.push({
            file: relativePath,
            severity,
            category,
            description,
            matches: validMatches,
            lineNumbers: this.getLineNumbers(content, validMatches)
          });
        }
      }
    }
  }

  /**
   * Get line numbers for matches
   */
  getLineNumbers(content, matches) {
    const lines = content.split('\n');
    const lineNumbers = [];

    for (const match of matches) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(match)) {
          lineNumbers.push(i + 1);
          break;
        }
      }
    }

    return lineNumbers;
  }

  /**
   * Report validation results
   */
  reportResults() {
    console.log(`\n${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}  Validation Results${colors.reset}`);
    console.log(`${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}\n`);

    console.log(`📊 Files scanned: ${this.filesScanned}`);
    console.log(`🔍 Issues found: ${this.issues.length}\n`);

    if (this.issues.length === 0) {
      console.log(`${colors.green}${colors.bright}✓ PASS${colors.reset} ${colors.green}All files passed security validation${colors.reset}\n`);
      console.log(`${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}\n`);
      return 0;
    }

    // Group issues by severity
    const critical = this.issues.filter(i => i.severity === 'CRITICAL');
    const high = this.issues.filter(i => i.severity === 'HIGH');
    const medium = this.issues.filter(i => i.severity === 'MEDIUM');
    const low = this.issues.filter(i => i.severity === 'LOW');

    // Report issues
    if (critical.length > 0) {
      console.log(`${colors.red}${colors.bright}🚨 CRITICAL Issues (${critical.length}):${colors.reset}`);
      this.printIssues(critical);
    }

    if (high.length > 0) {
      console.log(`${colors.red}${colors.bright}⚠ HIGH Severity Issues (${high.length}):${colors.reset}`);
      this.printIssues(high);
    }

    if (medium.length > 0) {
      console.log(`${colors.yellow}${colors.bright}⚠ MEDIUM Severity Issues (${medium.length}):${colors.reset}`);
      this.printIssues(medium);
    }

    if (low.length > 0) {
      console.log(`${colors.yellow}ℹ LOW Severity Issues (${low.length}):${colors.reset}`);
      this.printIssues(low);
    }

    console.log(`\n${colors.red}${colors.bright}✗ FAIL${colors.reset} ${colors.red}Security validation failed - sync blocked${colors.reset}\n`);
    console.log(`${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}\n`);

    return 1;
  }

  /**
   * Print issues in a formatted way
   */
  printIssues(issues) {
    for (const issue of issues) {
      console.log(`\n  ${colors.bright}${issue.file}${colors.reset}`);
      console.log(`  Category: ${issue.category}`);
      console.log(`  Issue: ${issue.description}`);
      console.log(`  Lines: ${issue.lineNumbers.join(', ')}`);
      console.log(`  Matches: ${issue.matches.slice(0, 3).join(', ')}${issue.matches.length > 3 ? '...' : ''}`);
    }
    console.log('');
  }
}

// Main execution
async function main() {
  try {
    const validator = new PublicSyncValidator();
    const exitCode = await validator.validate();
    process.exit(exitCode);
  } catch (error) {
    console.error(`${colors.red}${colors.bright}ERROR:${colors.reset} ${error.message}`);
    console.error(error.stack);
    process.exit(2);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = PublicSyncValidator;
