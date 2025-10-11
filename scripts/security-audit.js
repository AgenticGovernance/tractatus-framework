#!/usr/bin/env node
/**
 * Security Audit Script
 * Checks for common security vulnerabilities and best practices
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const issues = {
  critical: [],
  high: [],
  medium: [],
  low: [],
  info: []
};

function log(level, message, detail = '') {
  const levelColors = {
    CRITICAL: colors.red,
    HIGH: colors.red,
    MEDIUM: colors.yellow,
    LOW: colors.cyan,
    INFO: colors.blue,
    PASS: colors.green
  };

  const color = levelColors[level] || colors.reset;
  console.log(`${color}[${level}]${colors.reset} ${message}`);
  if (detail) {
    console.log(`  ${detail}`);
  }
}

function addIssue(severity, title, description, remediation) {
  const issue = { title, description, remediation };
  issues[severity].push(issue);
}

// ============================================================================
// 1. CHECK ENVIRONMENT VARIABLES
// ============================================================================
function checkEnvironmentVariables() {
  console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.cyan + '1. Environment Variables Security' + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset);

  const requiredSecrets = [
    'JWT_SECRET',
    'SESSION_SECRET',
    'MONGODB_URI'
  ];

  const envExamplePath = path.join(__dirname, '../.env.example');
  const envPath = path.join(__dirname, '../.env');

  // Check if .env.example exists
  if (!fs.existsSync(envExamplePath)) {
    addIssue('medium', 'Missing .env.example',
      '.env.example file not found',
      'Create .env.example with placeholder values for all required environment variables');
    log('MEDIUM', 'Missing .env.example file');
  } else {
    log('PASS', '.env.example file exists');
  }

  // Check if .env is in .gitignore
  const gitignorePath = path.join(__dirname, '../.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignoreContent.includes('.env')) {
      addIssue('critical', '.env not in .gitignore',
        '.env file might be committed to git',
        'Add .env to .gitignore immediately');
      log('CRITICAL', '.env not found in .gitignore');
    } else {
      log('PASS', '.env is in .gitignore');
    }
  }

  // Check for hardcoded secrets in code
  const srcDir = path.join(__dirname, '../src');
  try {
    const grepCmd = `grep -r -i "password\\s*=\\s*['\"]\\|secret\\s*=\\s*['\"]\\|api[_-]key\\s*=\\s*['\"]" ${srcDir} || true`;
    const result = execSync(grepCmd, { encoding: 'utf8' });
    if (result.trim()) {
      addIssue('critical', 'Hardcoded secrets detected',
        `Found potential hardcoded secrets:\n${result}`,
        'Remove hardcoded secrets and use environment variables');
      log('CRITICAL', 'Potential hardcoded secrets found');
      console.log(result);
    } else {
      log('PASS', 'No hardcoded secrets detected in src/');
    }
  } catch (err) {
    // grep returns non-zero if no matches, which is good
    log('PASS', 'No hardcoded secrets detected in src/');
  }
}

// ============================================================================
// 2. CHECK DEPENDENCIES FOR VULNERABILITIES
// ============================================================================
function checkDependencies() {
  console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.cyan + '2. Dependency Vulnerabilities' + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset);

  try {
    log('INFO', 'Running npm audit...');
    const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
    const audit = JSON.parse(auditResult);

    if (audit.vulnerabilities) {
      const vulns = audit.vulnerabilities;
      const critical = Object.values(vulns).filter(v => v.severity === 'critical').length;
      const high = Object.values(vulns).filter(v => v.severity === 'high').length;
      const moderate = Object.values(vulns).filter(v => v.severity === 'moderate').length;
      const low = Object.values(vulns).filter(v => v.severity === 'low').length;

      if (critical > 0) {
        addIssue('critical', 'Critical dependency vulnerabilities',
          `Found ${critical} critical vulnerabilities`,
          'Run npm audit fix or update vulnerable dependencies');
        log('CRITICAL', `${critical} critical vulnerabilities`);
      }
      if (high > 0) {
        addIssue('high', 'High severity dependency vulnerabilities',
          `Found ${high} high severity vulnerabilities`,
          'Run npm audit fix or update vulnerable dependencies');
        log('HIGH', `${high} high severity vulnerabilities`);
      }
      if (moderate > 0) {
        log('MEDIUM', `${moderate} moderate severity vulnerabilities`);
      }
      if (low > 0) {
        log('LOW', `${low} low severity vulnerabilities`);
      }

      if (critical === 0 && high === 0 && moderate === 0 && low === 0) {
        log('PASS', 'No known vulnerabilities in dependencies');
      }
    }
  } catch (err) {
    log('INFO', 'npm audit completed with findings (check above)');
  }
}

// ============================================================================
// 3. CHECK AUTHENTICATION & AUTHORIZATION
// ============================================================================
function checkAuthSecurity() {
  console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.cyan + '3. Authentication & Authorization' + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset);

  // Check JWT secret strength
  const jwtUtilPath = path.join(__dirname, '../src/utils/jwt.util.js');
  if (fs.existsSync(jwtUtilPath)) {
    const jwtContent = fs.readFileSync(jwtUtilPath, 'utf8');

    // Check if JWT_SECRET is required
    if (!jwtContent.includes('JWT_SECRET')) {
      addIssue('critical', 'JWT secret not configured',
        'JWT_SECRET environment variable not used',
        'Configure JWT_SECRET in environment variables');
      log('CRITICAL', 'JWT_SECRET not found in jwt.util.js');
    } else {
      log('PASS', 'JWT uses environment variable for secret');
    }

    // Check for secure JWT options
    if (!jwtContent.includes('expiresIn')) {
      addIssue('medium', 'JWT expiration not set',
        'Tokens may not expire',
        'Set expiresIn option for JWT tokens');
      log('MEDIUM', 'JWT expiration not configured');
    } else {
      log('PASS', 'JWT expiration configured');
    }
  }

  // Check password hashing
  const userModelPath = path.join(__dirname, '../src/models/User.model.js');
  if (fs.existsSync(userModelPath)) {
    const userContent = fs.readFileSync(userModelPath, 'utf8');

    if (!userContent.includes('bcrypt')) {
      addIssue('critical', 'Passwords not hashed',
        'bcrypt not found in User model',
        'Use bcrypt to hash passwords with salt rounds >= 10');
      log('CRITICAL', 'Password hashing (bcrypt) not found');
    } else {
      log('PASS', 'Passwords are hashed with bcrypt');

      // Check salt rounds
      const saltRoundsMatch = userContent.match(/bcrypt\.hash\([^,]+,\s*(\d+)/);
      if (saltRoundsMatch) {
        const rounds = parseInt(saltRoundsMatch[1]);
        if (rounds < 10) {
          addIssue('medium', 'Weak bcrypt salt rounds',
            `Salt rounds set to ${rounds}, should be >= 10`,
            'Increase bcrypt salt rounds to at least 10');
          log('MEDIUM', `Bcrypt salt rounds: ${rounds} (should be >= 10)`);
        } else {
          log('PASS', `Bcrypt salt rounds: ${rounds}`);
        }
      }
    }
  }

  // Check rate limiting
  const serverPath = path.join(__dirname, '../src/server.js');
  if (fs.existsSync(serverPath)) {
    const serverContent = fs.readFileSync(serverPath, 'utf8');

    if (!serverContent.includes('rateLimit') && !serverContent.includes('express-rate-limit')) {
      addIssue('high', 'No rate limiting',
        'Rate limiting not implemented',
        'Add express-rate-limit to prevent brute force attacks');
      log('HIGH', 'Rate limiting not found');
    } else {
      log('PASS', 'Rate limiting implemented');
    }
  }
}

// ============================================================================
// 4. CHECK INPUT VALIDATION
// ============================================================================
function checkInputValidation() {
  console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.cyan + '4. Input Validation & Sanitization' + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset);

  // Check for validation middleware
  const validationPath = path.join(__dirname, '../src/middleware/validation.middleware.js');
  if (!fs.existsSync(validationPath)) {
    addIssue('high', 'No validation middleware',
      'Input validation middleware not found',
      'Create validation middleware to sanitize user inputs');
    log('HIGH', 'Validation middleware not found');
  } else {
    log('PASS', 'Validation middleware exists');

    const validationContent = fs.readFileSync(validationPath, 'utf8');

    // Check for common validation functions
    const validations = ['validateEmail', 'validateRequired', 'validateObjectId'];
    validations.forEach(fn => {
      if (validationContent.includes(fn)) {
        log('PASS', `${fn} validation implemented`);
      } else {
        log('LOW', `${fn} validation not found`);
      }
    });
  }

  // Check for NoSQL injection protection
  const controllersDir = path.join(__dirname, '../src/controllers');
  if (fs.existsSync(controllersDir)) {
    try {
      const grepCmd = `grep -r "\\$where\\|\\$ne\\|\\$gt" ${controllersDir} || true`;
      const result = execSync(grepCmd, { encoding: 'utf8' });
      if (result.trim()) {
        addIssue('medium', 'Potential NoSQL injection vectors',
          'Direct use of MongoDB operators in controllers',
          'Sanitize user inputs before using in database queries');
        log('MEDIUM', 'Potential NoSQL injection vectors found');
      } else {
        log('PASS', 'No obvious NoSQL injection vectors');
      }
    } catch (err) {
      log('PASS', 'No obvious NoSQL injection vectors');
    }
  }
}

// ============================================================================
// 5. CHECK SECURITY HEADERS
// ============================================================================
function checkSecurityHeaders() {
  console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.cyan + '5. Security Headers' + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset);

  const serverPath = path.join(__dirname, '../src/server.js');
  if (fs.existsSync(serverPath)) {
    const serverContent = fs.readFileSync(serverPath, 'utf8');

    if (!serverContent.includes('helmet')) {
      addIssue('high', 'helmet middleware not used',
        'Security headers not configured',
        'Add helmet middleware to set security headers');
      log('HIGH', 'helmet middleware not found');
    } else {
      log('PASS', 'helmet middleware configured');
    }

    if (!serverContent.includes('cors')) {
      addIssue('medium', 'CORS not configured',
        'CORS middleware not found',
        'Configure CORS to restrict cross-origin requests');
      log('MEDIUM', 'CORS not configured');
    } else {
      log('PASS', 'CORS configured');
    }
  }
}

// ============================================================================
// 6. CHECK FILE PERMISSIONS
// ============================================================================
function checkFilePermissions() {
  console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.cyan + '6. File Permissions' + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset);

  const sensitiveFiles = [
    '.env',
    'package.json',
    'src/config/app.config.js'
  ];

  sensitiveFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const mode = (stats.mode & parseInt('777', 8)).toString(8);

      if (file === '.env' && mode !== '600') {
        addIssue('medium', `.env file permissions too permissive`,
          `File permissions: ${mode} (should be 600)`,
          `chmod 600 ${file}`);
        log('MEDIUM', `.env permissions: ${mode} (should be 600)`);
      } else {
        log('PASS', `${file} permissions: ${mode}`);
      }
    }
  });
}

// ============================================================================
// 7. CHECK LOGGING & ERROR HANDLING
// ============================================================================
function checkLoggingAndErrors() {
  console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.cyan + '7. Logging & Error Handling' + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset);

  const errorMiddlewarePath = path.join(__dirname, '../src/middleware/error.middleware.js');
  if (!fs.existsSync(errorMiddlewarePath)) {
    addIssue('medium', 'No error handling middleware',
      'Error middleware not found',
      'Create error handling middleware to sanitize error messages');
    log('MEDIUM', 'Error handling middleware not found');
  } else {
    const errorContent = fs.readFileSync(errorMiddlewarePath, 'utf8');

    // Check that stack traces are not exposed in production
    if (errorContent.includes('stack') && !errorContent.includes('NODE_ENV')) {
      addIssue('medium', 'Stack traces may be exposed',
        'Error handler may expose stack traces in production',
        'Only show stack traces in development environment');
      log('MEDIUM', 'Stack traces may be exposed in production');
    } else {
      log('PASS', 'Error handling configured properly');
    }
  }

  // Check logger configuration
  const loggerPath = path.join(__dirname, '../src/utils/logger.util.js');
  if (fs.existsSync(loggerPath)) {
    const loggerContent = fs.readFileSync(loggerPath, 'utf8');

    if (loggerContent.includes('password') || loggerContent.includes('token')) {
      log('LOW', 'Logger may log sensitive data - review logger.util.js');
    } else {
      log('PASS', 'Logger configuration looks safe');
    }
  }
}

// ============================================================================
// GENERATE REPORT
// ============================================================================
function generateReport() {
  console.log('\n' + colors.magenta + '='.repeat(80) + colors.reset);
  console.log(colors.magenta + 'SECURITY AUDIT SUMMARY' + colors.reset);
  console.log(colors.magenta + '='.repeat(80) + colors.reset);

  const totalIssues = issues.critical.length + issues.high.length +
                      issues.medium.length + issues.low.length;

  console.log(`\n${colors.cyan}Total Issues Found: ${totalIssues}${colors.reset}`);
  console.log(`  ${colors.red}Critical: ${issues.critical.length}${colors.reset}`);
  console.log(`  ${colors.red}High:     ${issues.high.length}${colors.reset}`);
  console.log(`  ${colors.yellow}Medium:   ${issues.medium.length}${colors.reset}`);
  console.log(`  ${colors.cyan}Low:      ${issues.low.length}${colors.reset}`);

  // Print critical issues
  if (issues.critical.length > 0) {
    console.log('\n' + colors.red + 'CRITICAL ISSUES:' + colors.reset);
    issues.critical.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${colors.red}${issue.title}${colors.reset}`);
      console.log(`   ${issue.description}`);
      console.log(`   ${colors.green}→ ${issue.remediation}${colors.reset}`);
    });
  }

  // Print high issues
  if (issues.high.length > 0) {
    console.log('\n' + colors.red + 'HIGH SEVERITY ISSUES:' + colors.reset);
    issues.high.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${colors.red}${issue.title}${colors.reset}`);
      console.log(`   ${issue.description}`);
      console.log(`   ${colors.green}→ ${issue.remediation}${colors.reset}`);
    });
  }

  // Print medium issues
  if (issues.medium.length > 0) {
    console.log('\n' + colors.yellow + 'MEDIUM SEVERITY ISSUES:' + colors.reset);
    issues.medium.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${colors.yellow}${issue.title}${colors.reset}`);
      console.log(`   ${issue.description}`);
      console.log(`   ${colors.green}→ ${issue.remediation}${colors.reset}`);
    });
  }

  // Overall status
  console.log('\n' + colors.magenta + '='.repeat(80) + colors.reset);
  if (issues.critical.length === 0 && issues.high.length === 0) {
    console.log(colors.green + '✓ No critical or high severity issues found' + colors.reset);
  } else {
    console.log(colors.red + '✗ Critical or high severity issues require immediate attention' + colors.reset);
  }
  console.log(colors.magenta + '='.repeat(80) + colors.reset + '\n');

  // Exit with error code if critical/high issues found
  process.exit((issues.critical.length + issues.high.length) > 0 ? 1 : 0);
}

// ============================================================================
// MAIN
// ============================================================================
function main() {
  console.log(colors.magenta + '\n' + '='.repeat(80));
  console.log('TRACTATUS SECURITY AUDIT');
  console.log('Checking for common security vulnerabilities and best practices');
  console.log('='.repeat(80) + colors.reset);

  checkEnvironmentVariables();
  checkDependencies();
  checkAuthSecurity();
  checkInputValidation();
  checkSecurityHeaders();
  checkFilePermissions();
  checkLoggingAndErrors();

  generateReport();
}

main();
