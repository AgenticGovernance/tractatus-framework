/**
 * Plan Reminder System
 * Scans for plan documents, tracks status, and reminds about reviews
 */

const fs = require('fs').promises;
const path = require('path');

const PLAN_REGISTRY = path.join(__dirname, '../.claude/plan-registry.json');
const PROJECT_ROOT = path.join(__dirname, '..');

// Only search within tractatus directory, exclude other projects
const SEARCH_DIRS = [
  path.join(PROJECT_ROOT, 'docs/plans'),
  path.join(PROJECT_ROOT, 'docs'),
  path.join(PROJECT_ROOT, 'docs/research'),
  path.join(PROJECT_ROOT, 'docs/planning'),
  path.join(PROJECT_ROOT, 'docs/governance')
];

// Exclude these directories and projects
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /sydigital/,
  /passport-consolidated/,
  /family-history/,
  /mysy/
];

// Plan document patterns
const PLAN_PATTERNS = [
  /plan.*\.md$/i,
  /roadmap.*\.md$/i,
  /session.*handoff.*\.md$/i,
  /priority.*\.md$/i,
  /-plan\.md$/i
];

/**
 * Parse plan metadata from markdown
 */
function parsePlanMetadata(content, filepath) {
  const metadata = {
    filepath: filepath,
    filename: path.basename(filepath),
    title: null,
    status: null,
    priority: null,
    created: null,
    due: null,
    review_schedule: null,
    next_review: null,
    owner: null,
    completeness: null,
    last_modified: null
  };

  // Extract title (first H1)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Extract metadata fields
  const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i);
  if (statusMatch) {
    metadata.status = statusMatch[1].trim();
  }

  const priorityMatch = content.match(/\*\*Priority:\*\*\s*(.+)/i);
  if (priorityMatch) {
    metadata.priority = priorityMatch[1].trim();
  }

  const createdMatch = content.match(/\*\*(?:Plan Created|Created):\*\*\s*(.+)/i);
  if (createdMatch) {
    metadata.created = createdMatch[1].trim();
  }

  const dueMatch = content.match(/\*\*(?:Target Completion|Due):\*\*\s*(.+)/i);
  if (dueMatch) {
    metadata.due = dueMatch[1].trim();
  }

  const reviewMatch = content.match(/\*\*Review Schedule:\*\*\s*(.+)/i);
  if (reviewMatch) {
    metadata.review_schedule = reviewMatch[1].trim();
  }

  const nextReviewMatch = content.match(/\*\*Next (?:Review|review):\*\*\s*(.+)/i);
  if (nextReviewMatch) {
    metadata.next_review = nextReviewMatch[1].trim();
  }

  const ownerMatch = content.match(/\*\*(?:Plan )?Owner:\*\*\s*(.+)/i);
  if (ownerMatch) {
    metadata.owner = ownerMatch[1].trim();
  }

  // Analyze completeness based on checkboxes
  const totalCheckboxes = (content.match(/\[[ x✓]\]/gi) || []).length;
  const checkedBoxes = (content.match(/\[[x✓]\]/gi) || []).length;

  if (totalCheckboxes > 0) {
    metadata.completeness = {
      total: totalCheckboxes,
      completed: checkedBoxes,
      percentage: Math.round((checkedBoxes / totalCheckboxes) * 100)
    };
  }

  return metadata;
}

/**
 * Scan directories for plan documents
 */
async function scanForPlans() {
  const plans = [];

  for (const dir of SEARCH_DIRS) {
    try {
      const items = await fs.readdir(dir, { recursive: true, withFileTypes: true });

      for (const item of items) {
        if (!item.isFile()) continue;

        const filename = item.name;
        const filepath = path.join(item.path || dir, filename);

        // Skip if matches exclusion patterns
        if (EXCLUDE_PATTERNS.some(pattern => pattern.test(filepath))) {
          continue;
        }

        const isPlan = PLAN_PATTERNS.some(pattern => pattern.test(filename));

        if (isPlan) {
          try {
            const content = await fs.readFile(filepath, 'utf-8');
            const stats = await fs.stat(filepath);

            const metadata = parsePlanMetadata(content, filepath);
            metadata.last_modified = stats.mtime.toISOString();
            metadata.file_size = stats.size;

            plans.push(metadata);
          } catch (err) {
            console.error(`  ✗ Error reading ${filepath}:`, err.message);
          }
        }
      }
    } catch (err) {
      // Directory might not exist, skip
      continue;
    }
  }

  return plans;
}

/**
 * Calculate review urgency
 */
function calculateUrgency(plan) {
  if (!plan.next_review) return 'unknown';

  try {
    const nextReview = new Date(plan.next_review);
    const now = new Date();
    const daysUntil = Math.ceil((nextReview - now) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return 'overdue';
    if (daysUntil === 0) return 'today';
    if (daysUntil <= 3) return 'this-week';
    if (daysUntil <= 14) return 'soon';
    return 'scheduled';
  } catch (err) {
    return 'unknown';
  }
}

/**
 * Determine plan health
 */
function assessPlanHealth(plan) {
  const issues = [];
  const now = new Date();

  // Check if status is active but stale (>30 days since last modified)
  if (plan.status && plan.status.toLowerCase().includes('active')) {
    const lastMod = new Date(plan.last_modified);
    const daysSinceUpdate = (now - lastMod) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate > 30) {
      issues.push(`Stale: No updates in ${Math.round(daysSinceUpdate)} days`);
    }
  }

  // Check if completion is low but due date approaching
  if (plan.completeness && plan.due) {
    try {
      const dueDate = new Date(plan.due);
      const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);

      if (daysUntilDue < 14 && plan.completeness.percentage < 50) {
        issues.push(`At risk: ${plan.completeness.percentage}% complete, due in ${Math.round(daysUntilDue)} days`);
      }
    } catch (err) {
      // Invalid date, skip
    }
  }

  // Check if review is overdue
  const urgency = calculateUrgency(plan);
  if (urgency === 'overdue') {
    issues.push('Review overdue');
  }

  // Check if no owner assigned
  if (!plan.owner || plan.owner.includes('TBD') || plan.owner.includes('assigned')) {
    issues.push('No owner assigned');
  }

  // Overall health assessment
  if (issues.length === 0) return { status: 'healthy', issues: [] };
  if (issues.length === 1) return { status: 'attention', issues };
  return { status: 'critical', issues };
}

/**
 * Update plan registry
 */
async function updateRegistry(plans) {
  // Deduplicate plans by filepath
  const uniquePlans = [];
  const seenPaths = new Set();

  for (const plan of plans) {
    if (!seenPaths.has(plan.filepath)) {
      seenPaths.add(plan.filepath);
      uniquePlans.push(plan);
    }
  }

  const registry = {
    version: '1.0.0',
    last_scan: new Date().toISOString(),
    total_plans: uniquePlans.length,
    plans: uniquePlans.map(plan => ({
      ...plan,
      urgency: calculateUrgency(plan),
      health: assessPlanHealth(plan)
    }))
  };

  await fs.writeFile(PLAN_REGISTRY, JSON.stringify(registry, null, 2));
  return registry;
}

/**
 * Display plan reminders
 */
function displayReminders(registry) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Plan Reminder System');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Last Scan: ${new Date(registry.last_scan).toLocaleString()}`);
  console.log(`Total Plans: ${registry.total_plans}\n`);

  // Group plans by urgency
  const overdue = registry.plans.filter(p => p.urgency === 'overdue');
  const today = registry.plans.filter(p => p.urgency === 'today');
  const thisWeek = registry.plans.filter(p => p.urgency === 'this-week');
  const critical = registry.plans.filter(p => p.health.status === 'critical');
  const attention = registry.plans.filter(p => p.health.status === 'attention');

  // Display overdue reviews
  if (overdue.length > 0) {
    console.log('🔴 OVERDUE REVIEWS:');
    overdue.forEach(plan => {
      console.log(`  • ${plan.title || plan.filename}`);
      console.log(`    Status: ${plan.status || 'Unknown'}`);
      console.log(`    Next Review: ${plan.next_review}`);
      console.log(`    File: ${path.relative(process.cwd(), plan.filepath)}`);
      if (plan.health.issues.length > 0) {
        plan.health.issues.forEach(issue => console.log(`    ⚠ ${issue}`));
      }
      console.log('');
    });
  }

  // Display today's reviews
  if (today.length > 0) {
    console.log('🟡 REVIEWS DUE TODAY:');
    today.forEach(plan => {
      console.log(`  • ${plan.title || plan.filename}`);
      console.log(`    Status: ${plan.status || 'Unknown'}`);
      console.log(`    File: ${path.relative(process.cwd(), plan.filepath)}`);
      console.log('');
    });
  }

  // Display this week's reviews
  if (thisWeek.length > 0) {
    console.log('🟢 REVIEWS THIS WEEK:');
    thisWeek.forEach(plan => {
      console.log(`  • ${plan.title || plan.filename}`);
      console.log(`    Next Review: ${plan.next_review}`);
      console.log(`    File: ${path.relative(process.cwd(), plan.filepath)}`);
      console.log('');
    });
  }

  // Display critical health issues
  if (critical.length > 0) {
    console.log('🚨 PLANS NEEDING ATTENTION:');
    critical.forEach(plan => {
      console.log(`  • ${plan.title || plan.filename}`);
      console.log(`    Status: ${plan.status || 'Unknown'}`);
      plan.health.issues.forEach(issue => console.log(`    ⚠ ${issue}`));
      console.log(`    File: ${path.relative(process.cwd(), plan.filepath)}`);
      console.log('');
    });
  }

  // Display plans needing attention (not critical)
  if (attention.length > 0 && critical.length === 0) {
    console.log('ℹ️  PLANS WITH MINOR ISSUES:');
    attention.forEach(plan => {
      console.log(`  • ${plan.title || plan.filename}`);
      plan.health.issues.forEach(issue => console.log(`    • ${issue}`));
      console.log('');
    });
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY:');
  console.log(`  Overdue Reviews: ${overdue.length}`);
  console.log(`  Due Today: ${today.length}`);
  console.log(`  Due This Week: ${thisWeek.length}`);
  console.log(`  Critical Health: ${critical.length}`);
  console.log(`  Needs Attention: ${attention.length}`);
  console.log(`  Healthy: ${registry.plans.filter(p => p.health.status === 'healthy').length}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Recommendations
  if (overdue.length > 0 || critical.length > 0) {
    console.log('📌 RECOMMENDED ACTIONS:');
    if (overdue.length > 0) {
      console.log('  1. Review overdue plans and update next_review dates');
    }
    if (critical.length > 0) {
      console.log('  2. Address critical health issues (stale plans, missing owners)');
    }
    console.log('  3. Update plan status and completeness checkboxes');
    console.log('  4. Run this reminder weekly to stay on track\n');
  }
}

/**
 * List all plans
 */
function listAllPlans(registry, options = {}) {
  console.log('\n📋 ALL TRACKED PLANS:\n');

  const sortedPlans = [...registry.plans];

  // Sort by status priority
  const statusPriority = {
    'active': 1,
    'in progress': 2,
    'pending': 3,
    'on hold': 4,
    'completed': 5,
    'cancelled': 6
  };

  sortedPlans.sort((a, b) => {
    const aStatus = (a.status || '').toLowerCase();
    const bStatus = (b.status || '').toLowerCase();
    const aPriority = statusPriority[aStatus] || 99;
    const bPriority = statusPriority[bStatus] || 99;
    return aPriority - bPriority;
  });

  sortedPlans.forEach((plan, index) => {
    console.log(`${index + 1}. ${plan.title || plan.filename}`);
    console.log(`   Status: ${plan.status || 'Unknown'} | Priority: ${plan.priority || 'Unknown'}`);

    if (plan.completeness) {
      console.log(`   Completeness: ${plan.completeness.completed}/${plan.completeness.total} (${plan.completeness.percentage}%)`);
    }

    if (plan.next_review) {
      console.log(`   Next Review: ${plan.next_review} (${plan.urgency})`);
    }

    if (plan.owner) {
      console.log(`   Owner: ${plan.owner}`);
    }

    if (plan.health.status !== 'healthy') {
      console.log(`   Health: ${plan.health.status}`);
      if (options.verbose) {
        plan.health.issues.forEach(issue => console.log(`     • ${issue}`));
      }
    }

    console.log(`   File: ${path.relative(process.cwd(), plan.filepath)}`);
    console.log('');
  });
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'remind';

  try {
    console.log('\nScanning for plan documents...');
    const plans = await scanForPlans();
    console.log(`✓ Found ${plans.length} plan documents\n`);

    const registry = await updateRegistry(plans);

    if (command === 'list') {
      listAllPlans(registry, { verbose: args.includes('--verbose') });
    } else {
      displayReminders(registry);
    }

    // Exit with code based on urgency
    if (registry.plans.some(p => p.urgency === 'overdue')) {
      process.exit(1); // Overdue plans found
    }

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (args.includes('--verbose')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { scanForPlans, updateRegistry, calculateUrgency, assessPlanHealth };
