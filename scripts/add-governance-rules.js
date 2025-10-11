#!/usr/bin/env node

/**
 * Add inst_026 and inst_027 to Governance Rules Database
 * These rules emerged from blog implementation validation
 */

const mongoose = require('mongoose');
const GovernanceRule = require('../src/models/GovernanceRule.model');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';

const rules = [
  {
    id: 'inst_026',
    text: `Client-Side Code Quality Standards (OPERATIONAL)

All client-side JavaScript (public/js/**) must adhere to these quality standards:

1. **Framework Usage**: Use vanilla JavaScript unless framework is explicitly approved
   - No React, Vue, Angular without approval
   - Prefer native DOM APIs
   - Minimize external dependencies

2. **XSS Prevention**: Include HTML escaping for all user-generated content
   - Implement escapeHtml() function
   - Use textContent instead of innerHTML where possible
   - Sanitize all dynamic content before rendering

3. **URL Portability**: Use relative URLs (no hardcoded hosts)
   - ✓ Good: "/api/blog", "/blog.html"
   - ✗ Bad: "http://localhost:9000/api/blog", "https://agenticgovernance.digital/blog.html"
   - Ensures code works in dev, staging, and production

4. **Performance**: Implement debouncing for search inputs
   - Minimum 300ms debounce for search/filter inputs
   - Prevents excessive API calls and DOM updates
   - Use setTimeout/clearTimeout pattern

5. **Event Handling**: Use event delegation for dynamic elements
   - Attach listeners to parent containers
   - Use event.target.closest() for delegation
   - Prevents memory leaks from repeated listener attachment

6. **User Experience**: Include loading, error, and empty states
   - Loading: Spinner or skeleton UI
   - Error: User-friendly error message with recovery action
   - Empty: Helpful message explaining why no data exists

7. **Linting**: Pass ESLint validation with zero warnings
   - Run: npx eslint <file> --max-warnings 0
   - Fix all auto-fixable issues
   - Manually resolve remaining warnings

**Validation**:
- Check for escapeHtml() function
- grep for hardcoded URLs (localhost, production domain)
- Verify debounce implementation on search inputs
- Confirm event delegation usage
- Run ESLint with --max-warnings 0

**Boundary Classification**: TECHNICAL (safe for automation)
These are objective, testable code quality standards with no values component.`,

    quadrant: 'OPERATIONAL',
    persistence: 'MEDIUM',
    scope: 'PROJECT_SPECIFIC',
    applicableProjects: ['tractatus'],
    category: 'technical',
    priority: 70,
    temporalScope: 'PROJECT',
    source: 'user_instruction',
    createdBy: 'claude_code',
    active: true,
    notes: 'Created after blog implementation validation. Emerged from CSP violations in navbar.js and need for consistent client-side code quality.',
    examples: [
      'XSS Prevention: function escapeHtml(text) { const div = document.createElement("div"); div.textContent = text; return div.innerHTML; }',
      'Debouncing: let timeout; input.addEventListener("input", (e) => { clearTimeout(timeout); timeout = setTimeout(() => filter(e.target.value), 300); });',
      'Event Delegation: container.addEventListener("click", (e) => { const btn = e.target.closest(".btn"); if (btn) handleClick(btn); });'
    ],
    relatedRules: ['inst_008', 'inst_027']
  },

  {
    id: 'inst_027',
    text: `Production Deployment Checklist (TACTICAL)

Before deploying to production, verify ALL of the following:

**1. Code Cleanliness**
   - [ ] No console.log() statements (console.error() allowed for error handling)
   - [ ] No console.debug(), console.warn() in production code
   - [ ] No TODO, FIXME, DEBUG, HACK, or XXX comments
   - [ ] No commented-out code blocks

**2. Environment Independence**
   - [ ] No hardcoded localhost URLs
   - [ ] No hardcoded production URLs (use relative paths)
   - [ ] No hardcoded IP addresses
   - [ ] Environment variables used for configuration

**3. Security Validation**
   - [ ] CSP compliance (inst_008) validated on all HTML/JS files
   - [ ] No inline event handlers (onclick, onload, etc.)
   - [ ] No inline styles (use CSS classes)
   - [ ] No inline scripts
   - [ ] No javascript: URLs

**4. File Organization**
   - [ ] All files in production-ready locations (public/, src/)
   - [ ] No temporary files (.tmp, .bak, ~)
   - [ ] No development-only files
   - [ ] .rsyncignore excludes sensitive files

**5. Cache Busting**
   - [ ] CSS version parameter updated (?v=TIMESTAMP)
   - [ ] JavaScript version parameter updated (?v=TIMESTAMP)
   - [ ] Image version parameters if needed

**6. Sensitive Data Protection**
   - [ ] .env files NOT included in deployment
   - [ ] CLAUDE.md NOT included (verify in .rsyncignore)
   - [ ] Session state (.claude/) NOT included
   - [ ] No API keys, secrets, or credentials in code

**7. Testing**
   - [ ] Manual testing in development environment
   - [ ] All API endpoints return expected responses
   - [ ] Error states display correctly
   - [ ] Loading states work
   - [ ] Mobile responsive layout verified

**Validation Commands**:
\`\`\`bash
# Check for console statements
grep -r "console\\.log" public/ || echo "✓ No console.log found"

# Check for development comments
grep -r "TODO\\|FIXME\\|DEBUG" public/ || echo "✓ No dev comments found"

# Check for hardcoded URLs
grep -r "localhost\\|http://\\|https://" public/ | grep -v ".html" || echo "✓ No hardcoded URLs found"

# Verify CSP compliance
node scripts/pre-action-check.js file-edit public/index.html "Deployment validation"

# Verify .rsyncignore coverage
grep "CLAUDE.md" .rsyncignore && grep ".claude/" .rsyncignore && echo "✓ Sensitive files excluded"
\`\`\`

**Deployment Process**:
1. Run all validation commands above
2. Execute: ./scripts/deploy-full-project-SAFE.sh
3. Review dry-run output carefully
4. Confirm deployment
5. SSH to production and verify sensitive files NOT deployed
6. Restart service: sudo systemctl restart tractatus
7. Test production site: https://agenticgovernance.digital

**Boundary Classification**: TECHNICAL (automated checklist)
All checks are objective and can be automated. No values decisions required.`,

    quadrant: 'TACTICAL',
    persistence: 'HIGH',
    scope: 'UNIVERSAL',
    applicableProjects: ['*'],
    category: 'process',
    priority: 85,
    temporalScope: 'PERMANENT',
    source: 'user_instruction',
    createdBy: 'claude_code',
    active: true,
    notes: 'Created after blog implementation validation. Prevents common deployment errors like console.log statements, hardcoded URLs, and CSP violations from reaching production.',
    examples: [
      'Pre-deployment validation: grep -r "console.log" public/ && echo "FAIL: console.log found" && exit 1',
      'CSP validation: node scripts/pre-action-check.js file-edit public/blog.html "Deployment check"',
      'Sensitive file check: ssh production "ls /var/www/tractatus/CLAUDE.md 2>/dev/null && echo FAIL || echo OK"'
    ],
    relatedRules: ['inst_008', 'inst_026']
  }
];

async function addRules() {
  try {
    console.log('Connecting to MongoDB:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    for (const rule of rules) {
      console.log(`Adding ${rule.id}...`);

      // Check if rule already exists
      const existing = await GovernanceRule.findOne({ id: rule.id });

      if (existing) {
        console.log(`  ⚠ Rule ${rule.id} already exists. Updating...`);
        await GovernanceRule.updateOne({ id: rule.id }, rule);
        console.log(`  ✓ Updated ${rule.id}`);
      } else {
        await GovernanceRule.create(rule);
        console.log(`  ✓ Created ${rule.id}`);
      }

      console.log(`    Quadrant: ${rule.quadrant}`);
      console.log(`    Persistence: ${rule.persistence}`);
      console.log(`    Scope: ${rule.scope}`);
      console.log(`    Priority: ${rule.priority}`);
      console.log('');
    }

    console.log('✓ All rules added successfully!\n');

    // Show summary
    const allRules = await GovernanceRule.find({ active: true }).sort({ id: 1 });
    console.log(`Total active rules: ${allRules.length}`);
    console.log('Rule IDs:', allRules.map(r => r.id).join(', '));

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('Error adding rules:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

addRules();
