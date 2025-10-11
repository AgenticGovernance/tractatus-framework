// Boundary check with API integration and fallback
async function checkBoundary(decision, description) {
  try {
    // Try API first
    const response = await fetch('/api/demo/boundary-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ decision, description })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        title: decision.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: description,
        allowed: data.enforcement.allowed,
        reason: data.enforcement.reasoning,
        alternatives: data.enforcement.alternatives.length > 0 ? data.enforcement.alternatives : null,
        boundary_violated: data.enforcement.boundary_violated,
        api_result: true
      };
    }

    // If API fails, fall back to client-side scenarios
    console.warn('API unavailable, using client-side scenario data');
    return scenarioFallback[decision] || getDefaultScenario(decision, description);
  } catch (error) {
    console.warn('Error calling API, using client-side scenario data:', error);
    return scenarioFallback[decision] || getDefaultScenario(decision, description);
  }
}

// Client-side fallback scenarios
const scenarioFallback = {
  optimize_images: {
    title: "Optimize Image Loading",
    description: "Implement lazy loading and compression for better performance",
    domain: "technical",
    allowed: true,
    reason: "Technical optimization within defined parameters. No values trade-offs required.",
    alternatives: null,
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'performance_optimization',
  action: 'implement_lazy_loading'
});

// Result: ALLOWED
{
  allowed: true,
  reason: "Technical decision, no values impact",
  proceed: true
}`
  },
  privacy_vs_analytics: {
    title: "Enable Analytics Tracking",
    description: "Add Google Analytics to track user behavior",
    domain: "values",
    allowed: false,
    reason: "Privacy vs. analytics is an irreducible values trade-off. Different users have different privacy expectations.",
    alternatives: [
      "Research privacy-friendly analytics options (e.g., Plausible, Fathom)",
      "Analyze current user behavior from server logs",
      "Document pros/cons of different analytics approaches",
      "Present options with privacy impact assessment"
    ],
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'privacy_policy',
  action: 'enable_tracking',
  domain: 'values'
});

// Result: BLOCKED
{
  allowed: false,
  reason: "Privacy vs. convenience trade-off",
  requires_human_decision: true,
  boundary_section: "12.1"
}`
  },
  auto_subscribe: {
    title: "Auto-Subscribe Users",
    description: "Automatically subscribe new users to newsletter",
    domain: "user_agency",
    allowed: false,
    reason: "This determines the level of user control and agency. Opt-in vs. opt-out affects user autonomy.",
    alternatives: [
      "Implement explicit opt-in during registration",
      "Implement opt-out with clear unsubscribe",
      "Research industry best practices for consent",
      "Document GDPR compliance implications"
    ],
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'user_consent',
  action: 'auto_subscribe',
  domain: 'user_agency'
});

// Result: BLOCKED
{
  allowed: false,
  reason: "Affects user agency and control",
  requires_human_decision: true,
  boundary_section: "12.2"
}`
  },
  delete_old_data: {
    title: "Delete Old User Data",
    description: "Automatically delete user data older than 6 months",
    domain: "irreversible",
    allowed: false,
    reason: "Data deletion is irreversible and may have legal/compliance implications.",
    alternatives: [
      "Check backup status and retention policies",
      "Verify legal data retention requirements",
      "Confirm user consent for deletion",
      "Implement archive rather than delete"
    ],
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'data_deletion',
  action: 'delete_user_data',
  domain: 'irreversible'
});

// Result: BLOCKED
{
  allowed: false,
  reason: "Irreversible action with legal implications",
  requires_human_approval: true,
  boundary_section: "12.3"
}`
  },
  cache_strategy: {
    title: "Implement Caching Strategy",
    description: "Add Redis caching for frequently accessed data",
    domain: "technical",
    allowed: true,
    reason: "Technical implementation decision within established patterns. No values impact.",
    alternatives: null,
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'technical_implementation',
  action: 'add_caching'
});

// Result: ALLOWED
{
  allowed: true,
  reason: "Technical decision with clear constraints",
  proceed: true
}`
  },
  content_moderation: {
    title: "Automatic Content Moderation",
    description: "AI automatically removes inappropriate content",
    domain: "values",
    allowed: false,
    reason: "Defining 'inappropriate' involves values judgments about free speech, community standards, and cultural context.",
    alternatives: [
      "Implement flagging system for human review",
      "Create tiered moderation (AI flags, human decides)",
      "Research community moderation models",
      "Document content policy options for decision"
    ],
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'content_policy',
  action: 'auto_moderate',
  domain: 'values'
});

// Result: BLOCKED
{
  allowed: false,
  reason: "Content standards are values decisions",
  requires_human_decision: true,
  boundary_section: "12.1"
}`
  },
  api_rate_limiting: {
    title: "Implement API Rate Limiting",
    description: "Add rate limiting to prevent API abuse (100 req/min per IP)",
    domain: "technical",
    allowed: true,
    reason: "Technical security measure with clear, predefined parameters. No values trade-offs.",
    alternatives: null,
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'security_measure',
  action: 'add_rate_limiting'
});

// Result: ALLOWED
{
  allowed: true,
  reason: "Technical implementation of security best practice",
  proceed: true
}`
  },
  ml_training_data: {
    title: "Collect Data for ML Training",
    description: "Use user data to train machine learning models for feature improvements",
    domain: "values",
    allowed: false,
    reason: "Data usage for ML training involves privacy trade-offs, consent considerations, and potential bias issues that require ethical judgment.",
    alternatives: [
      "Research consent mechanisms and opt-in approaches",
      "Analyze privacy-preserving ML techniques (federated learning, differential privacy)",
      "Document data usage policies and transparency requirements",
      "Assess potential bias and fairness implications"
    ],
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'data_usage',
  action: 'ml_training',
  domain: 'values'
});

// Result: BLOCKED
{
  allowed: false,
  reason: "Privacy and consent decisions require human judgment",
  requires_human_decision: true,
  boundary_section: "12.1"
}`
  },
  auto_password_reset: {
    title: "Automated Password Reset",
    description: "Automatically reset user password after 5 failed login attempts",
    domain: "security",
    allowed: false,
    reason: "Automated password resets have security implications and can be used for denial-of-service attacks. Requires careful security analysis.",
    alternatives: [
      "Implement account lockout with unlock email instead",
      "Add CAPTCHA after failed attempts",
      "Research industry security best practices",
      "Consider multi-factor authentication requirements"
    ],
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'security_action',
  action: 'auto_password_reset',
  domain: 'security'
});

// Result: BLOCKED
{
  allowed: false,
  reason: "Security implications require human review",
  requires_human_decision: true,
  boundary_section: "12.3"
}`
  },
  database_indexing: {
    title: "Add Database Indexes",
    description: "Create indexes on frequently queried columns to improve performance",
    domain: "technical",
    allowed: true,
    reason: "Standard database optimization with measurable benefits and no values implications.",
    alternatives: null,
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'database_optimization',
  action: 'add_indexes'
});

// Result: ALLOWED
{
  allowed: true,
  reason: "Technical optimization following best practices",
  proceed: true
}`
  },
  default_public_sharing: {
    title: "Default Public Sharing",
    description: "Make user posts public by default (users can change to private)",
    domain: "user_agency",
    allowed: false,
    reason: "Privacy defaults affect user expectations and control. Public vs. private defaults shape user behavior and trust.",
    alternatives: [
      "Research user expectations for similar platforms",
      "Analyze privacy-by-default vs. visibility-by-default trade-offs",
      "Consider gradual disclosure approach",
      "Document implications for different user groups"
    ],
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'privacy_defaults',
  action: 'public_by_default',
  domain: 'user_agency'
});

// Result: BLOCKED
{
  allowed: false,
  reason: "Privacy defaults affect user agency and expectations",
  requires_human_decision: true,
  boundary_section: "12.2"
}`
  },
  error_logging_pii: {
    title: "Log All Error Details",
    description: "Include full request data in error logs for debugging (may contain PII)",
    domain: "values",
    allowed: false,
    reason: "Logging PII involves privacy trade-offs between debugging needs and data protection. GDPR and privacy regulations apply.",
    alternatives: [
      "Implement PII scrubbing in logs",
      "Research structured logging with sensitive data redaction",
      "Document data retention policies",
      "Consider encrypted logging with access controls"
    ],
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'logging_policy',
  action: 'log_full_errors',
  domain: 'values'
});

// Result: BLOCKED
{
  allowed: false,
  reason: "PII handling requires privacy impact assessment",
  requires_human_decision: true,
  boundary_section: "12.1"
}`
  }
};

// Default scenario for unknown decisions
function getDefaultScenario(decision, description) {
  return {
    title: decision.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: description || 'No description provided',
    allowed: false,
    reason: 'This decision requires human judgment to determine appropriate boundaries.',
    alternatives: [
      'Consult with stakeholders about decision criteria',
      'Research similar decisions in comparable contexts',
      'Document pros and cons of different approaches'
    ],
    code: `// BoundaryEnforcer Check
const boundary = enforcer.enforce({
  type: 'unknown',
  action: '${decision}'
});

// Result: REQUIRES_REVIEW
{
  allowed: false,
  reason: "Insufficient information for automated decision",
  requires_human_decision: true
}`
  };
}

// Map scenarios for display - adds code examples
const scenarios = Object.fromEntries(
  Object.entries(scenarioFallback).map(([key, value]) => [key, value])
);

// Event listeners
document.querySelectorAll('.scenario-card').forEach(card => {
  card.addEventListener('click', async () => {
    const decision = card.getAttribute('data-decision');
    const scenario = scenarios[decision];

    // Show loading state
    const originalContent = card.innerHTML;
    card.style.opacity = '0.6';
    card.style.pointerEvents = 'none';

    // Highlight selected
    document.querySelectorAll('.scenario-card').forEach(c => {
      c.classList.remove('ring-2', 'ring-blue-500');
    });
    card.classList.add('ring-2', 'ring-blue-500');

    try {
      // Call API with scenario details
      const result = await checkBoundary(decision, scenario.description);

      // Merge API result with scenario code example
      const displayData = {
        ...result,
        code: scenario.code
      };

      showResult(displayData);
    } catch (error) {
      console.error('Error checking boundary:', error);
      showResult(scenario);
    } finally {
      card.style.opacity = '1';
      card.style.pointerEvents = 'auto';
    }
  });
});

function showResult(scenario) {
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('result-content').classList.remove('hidden');

  // Decision info
  document.getElementById('decision-title').textContent = scenario.title;
  document.getElementById('decision-desc').textContent = scenario.description;

  // Verdict
  const verdict = document.getElementById('verdict');
  if (scenario.allowed) {
    verdict.innerHTML = `
      <div class="flex items-start">
        <svg class="w-8 h-8 text-green-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div>
          <div class="text-lg font-semibold text-green-900 mb-1">✅ ALLOWED</div>
          <div class="text-green-800">AI can automate this decision</div>
        </div>
      </div>
    `;
    verdict.className = 'rounded-lg p-6 mb-6 bg-green-100 border border-green-300';
  } else {
    verdict.innerHTML = `
      <div class="flex items-start">
        <svg class="w-8 h-8 text-red-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div>
          <div class="text-lg font-semibold text-red-900 mb-1">🚫 BLOCKED</div>
          <div class="text-red-800">Requires human judgment</div>
        </div>
      </div>
    `;
    verdict.className = 'rounded-lg p-6 mb-6 bg-red-100 border border-red-300';
  }

  // Reasoning
  document.getElementById('reasoning').textContent = scenario.reason;

  // Alternatives
  if (scenario.alternatives) {
    document.getElementById('ai-alternatives').classList.remove('hidden');
    document.getElementById('alternatives-list').innerHTML = scenario.alternatives
      .map(alt => `<li>${alt}</li>`)
      .join('');
  } else {
    document.getElementById('ai-alternatives').classList.add('hidden');
  }

  // Code example
  document.getElementById('code-example').textContent = scenario.code;
}
