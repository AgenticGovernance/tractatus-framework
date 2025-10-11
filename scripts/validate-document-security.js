#!/usr/bin/env node

/**
 * Document Security Validation Script
 * Validates that documents being deployed are appropriate for their visibility level
 *
 * This script is called before document import/deployment to prevent
 * accidental exposure of sensitive internal documentation.
 */

const SECURITY_KEYWORDS = {
  credentials: ['password', 'api_key', 'secret', 'token', 'mongodb_uri', 'stripe_secret', 'auth'],
  financial: ['stripe', 'payment', 'pricing', 'revenue', 'cost', 'billing'],
  vulnerability: ['security audit', 'vulnerability', 'exploit', 'cve-', 'penetration test'],
  infrastructure: ['deployment', 'server', 'ssh', 'production environment', 'database credentials']
};

/**
 * Classify document security level based on content and metadata
 */
function classifyDocumentSecurity(docConfig, contentMarkdown) {
  const classification = {
    contains_credentials: false,
    contains_financial_info: false,
    contains_vulnerability_info: false,
    contains_infrastructure_details: false,
    recommended_visibility: 'public'
  };

  const lowerContent = contentMarkdown.toLowerCase();
  const lowerTitle = docConfig.title.toLowerCase();

  // Check for credentials
  if (SECURITY_KEYWORDS.credentials.some(kw => lowerContent.includes(kw) || lowerTitle.includes(kw))) {
    classification.contains_credentials = true;
  }

  // Check for financial information
  if (SECURITY_KEYWORDS.financial.some(kw => lowerContent.includes(kw) || lowerTitle.includes(kw))) {
    classification.contains_financial_info = true;
  }

  // Check for vulnerability information
  if (SECURITY_KEYWORDS.vulnerability.some(kw => lowerContent.includes(kw) || lowerTitle.includes(kw))) {
    classification.contains_vulnerability_info = true;
  }

  // Check for infrastructure details
  if (SECURITY_KEYWORDS.infrastructure.some(kw => lowerContent.includes(kw) || lowerTitle.includes(kw))) {
    classification.contains_infrastructure_details = true;
  }

  // Determine recommended visibility
  if (classification.contains_credentials || classification.contains_vulnerability_info) {
    classification.recommended_visibility = 'confidential';
  } else if (classification.contains_financial_info || classification.contains_infrastructure_details) {
    classification.recommended_visibility = 'internal';
  }

  return classification;
}

/**
 * Validate document configuration before deployment
 */
function validateDocumentSecurity(docConfig, contentMarkdown) {
  const classification = classifyDocumentSecurity(docConfig, contentMarkdown);
  const visibility = docConfig.visibility || 'public';

  const issues = [];
  const warnings = [];

  // CRITICAL: Credentials or vulnerabilities marked as public
  if (visibility === 'public') {
    if (classification.contains_credentials) {
      issues.push('❌ BLOCKED: Document contains credentials but is marked public');
    }
    if (classification.contains_vulnerability_info) {
      issues.push('❌ BLOCKED: Document contains vulnerability information but is marked public');
    }
    if (classification.contains_financial_info) {
      warnings.push('⚠️  WARNING: Document contains financial information but is marked public');
    }
    if (classification.contains_infrastructure_details) {
      warnings.push('⚠️  WARNING: Document contains infrastructure details but is marked public');
    }
  }

  // Recommendations
  if (classification.recommended_visibility !== visibility) {
    warnings.push(`⚠️  RECOMMEND: Change visibility from '${visibility}' to '${classification.recommended_visibility}'`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    classification,
    recommended_visibility: classification.recommended_visibility
  };
}

module.exports = {
  classifyDocumentSecurity,
  validateDocumentSecurity,
  SECURITY_KEYWORDS
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node validate-document-security.js <title> <markdown-file>');
    process.exit(1);
  }

  const fs = require('fs');
  const title = args[0];
  const filePath = args[1];

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const result = validateDocumentSecurity({ title, visibility: 'public' }, content);

  console.log(`\n🔒 Security Validation: ${title}`);
  console.log('─'.repeat(60));

  if (result.issues.length > 0) {
    console.log('\nISSUES:');
    result.issues.forEach(issue => console.log(`  ${issue}`));
  }

  if (result.warnings.length > 0) {
    console.log('\nWARNINGS:');
    result.warnings.forEach(warning => console.log(`  ${warning}`));
  }

  console.log('\nCLASSIFICATION:');
  console.log(`  Credentials: ${result.classification.contains_credentials}`);
  console.log(`  Financial Info: ${result.classification.contains_financial_info}`);
  console.log(`  Vulnerabilities: ${result.classification.contains_vulnerability_info}`);
  console.log(`  Infrastructure: ${result.classification.contains_infrastructure_details}`);
  console.log(`  Recommended: ${result.classification.recommended_visibility}`);

  console.log('\n' + '─'.repeat(60));
  console.log(result.valid ? '✅ VALIDATION PASSED' : '❌ VALIDATION FAILED');
  console.log();

  process.exit(result.valid ? 0 : 1);
}
