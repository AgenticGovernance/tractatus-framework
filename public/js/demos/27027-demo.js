const steps = [
  {
    title: 'User Instruction',
    type: 'user',
    content: 'User: "find the lost conversation threads. 27027 family-history collection should be there"',
    code: null,
    description: 'User specifies MongoDB is on port 27027 (non-standard port where data is located)'
  },
  {
    title: 'AI Pattern Recognition Activates',
    type: 'info',
    content: 'AI Internal: Training data pattern detected: "MongoDB" → default port 27017',
    code: `// AI's learned pattern from training data:
// MongoDB almost always runs on port 27017
// Confidence: 99.8% (seen in millions of examples)
//
// User said: "port 27027"
// Pattern says: "port 27017"
//
// Pattern recognition OVERRIDES explicit instruction`,
    description: 'Strong training pattern conflicts with explicit user instruction'
  },
  {
    title: 'AI Executes Query (IMMEDIATE OVERRIDE)',
    type: 'ai',
    content: 'AI: "Let me check the database..."',
    code: `mongosh mongodb://localhost:27017/family_history
#                              ^^^^^ WRONG! User said 27027!

# AI's pattern recognition automatically "corrected"
# the user's explicit port specification
# MongoDB = port 27017 (99.8% confidence from training)`,
    description: 'AI immediately uses 27017 instead of 27027—pattern recognition autocorrected the explicit instruction'
  },
  {
    title: 'False Data Loss Alarm',
    type: 'error',
    content: '❌ Result: 0 conversation threads found → FALSE ALARM: "Data is lost!"',
    code: `# Checked port 27017 (wrong database instance)
db.conversations.countDocuments({})
→ 0 results

# AI concludes: "No data found. Data appears to be lost!"
# Initiates backup restore procedures
# User alarm about data integrity

# ACTUAL REALITY:
# Port 27027 (as user specified) has:
#   - 44 conversation threads
#   - 48 messages
#   - 100% data intact`,
    description: 'AI checked wrong port, found 0 results, falsely concluded data was lost—caused unnecessary panic'
  },
  {
    title: 'Root Cause: Pattern Recognition Bias',
    type: 'info',
    content: 'The AI never truly "heard" the instruction port 27027 because the training pattern "MongoDB = 27017" was so strong it autocorrected the input—like a spell-checker changing a deliberately unusual word.',
    code: null,
    description: 'This is NOT forgetting over time. It\'s immediate override by learned patterns.'
  },
  {
    title: 'Why This Is Dangerous',
    type: 'info',
    content: 'Key insight: This failure mode gets WORSE as AI capabilities increase!',
    code: `More training data → Stronger patterns → More confident overrides
Better models → More "knowledge" → More likely to "correct" humans
Longer context → Doesn't help (problem is immediate, not temporal)

This cannot be solved by:
✗ Better memory
✗ Longer context windows
✗ More training
✗ Prompting techniques

It requires ARCHITECTURAL constraints.`,
    description: 'Pattern recognition bias is a fundamental AI safety issue that training alone cannot solve'
  },
  {
    title: 'How Tractatus Prevents This (Step 1)',
    type: 'success',
    content: 'InstructionPersistenceClassifier recognizes explicit instruction:',
    code: `// When user says "27027 family-history collection should be there"
{
  text: "27027 family-history collection should be there",
  quadrant: "TACTICAL",
  persistence: "HIGH",  // Non-standard port = explicit override
  temporal_scope: "SESSION",
  verification_required: "MANDATORY",
  parameters: {
    port: "27027",
    database: "family_history",
    note: "Conflicts with training pattern (27017)"
  },
  explicitness: 0.92
}

// Stored in .claude/instruction-history.json
✓ Instruction persisted with HIGH priority`,
    description: 'Tractatus stores the explicit instruction before AI executes any database query'
  },
  {
    title: 'How Tractatus Prevents This (Step 2)',
    type: 'success',
    content: 'CrossReferenceValidator blocks the pattern override BEFORE execution:',
    code: `// When AI attempts to query with port 27017
CrossReferenceValidator.validate({
  action: "execute mongosh query",
  parameters: { port: "27017", database: "family_history" }
});

❌ VALIDATION FAILED
Proposed: port 27017
Instruction: port 27027 (recent, HIGH persistence)
Conflict: Pattern recognition attempting to override explicit instruction

Status: REJECTED

AI Alert: "You specified port 27027, but I was about to check
           default port 27017. Querying port 27027 as specified."

✓ Correct query executed:
  mongosh mongodb://localhost:27027/family_history
✓ Result: 44 conversation threads found (data intact!)`,
    description: 'Tractatus blocks the override and alerts the AI to use the explicit instruction'
  }
];

let currentStep = -1;
let isPlaying = false;

function initTimeline() {
  const timeline = document.getElementById('timeline');
  timeline.innerHTML = steps.map((step, index) => `
    <div id="step-${index}" class="border-2 border-gray-300 bg-white rounded-lg p-6 transition-all duration-300">
      <div class="flex items-start">
        <div class="flex-shrink-0 mr-4">
          <div class="w-10 h-10 rounded-full ${getStepColor(step.type)} flex items-center justify-center text-white font-bold">
            ${index + 1}
          </div>
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">${step.title}</h3>
          <p class="text-gray-700 mb-3">${step.content}</p>
          ${step.code ? `<pre class="code-block">${escapeHtml(step.code)}</pre>` : ''}
          <p class="text-sm text-gray-500 mt-2 hidden step-description">${step.description}</p>
        </div>
      </div>
    </div>
  `).join('');
}

function getStepColor(type) {
  const colors = {
    user: 'bg-blue-500',
    ai: 'bg-purple-500',
    info: 'bg-gray-500',
    error: 'bg-red-500',
    success: 'bg-green-500'
  };
  return colors[type] || 'bg-gray-500';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function playScenario() {
  if (isPlaying) return;
  isPlaying = true;

  document.getElementById('start-btn').disabled = true;
  document.getElementById('progress-info').classList.remove('hidden');

  for (let i = 0; i <= steps.length - 1; i++) {
    await showStep(i);
    await delay(2500); // 2.5 second delay between steps
  }

  isPlaying = false;
  document.getElementById('start-btn').disabled = false;
  document.getElementById('start-btn').innerHTML = '▶ Replay';
}

async function showStep(index) {
  currentStep = index;

  // Mark previous steps as complete
  for (let i = 0; i < index; i++) {
    const stepEl = document.getElementById(`step-${i}`);
    stepEl.classList.remove('step-active');
    stepEl.classList.add('step-complete', 'border-green-500', 'bg-green-50');
  }

  // Mark current step as active
  const currentStepEl = document.getElementById(`step-${index}`);
  currentStepEl.classList.add('step-active', 'border-blue-500', 'bg-blue-50', 'fade-in');
  currentStepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Show description
  currentStepEl.querySelector('.step-description').classList.remove('hidden');

  // Handle error step
  if (steps[index].type === 'error') {
    currentStepEl.classList.remove('step-active', 'border-blue-500', 'bg-blue-50');
    currentStepEl.classList.add('step-error', 'border-red-500', 'bg-red-50');
  }

  // Update progress
  const progress = ((index + 1) / steps.length) * 100;
  document.getElementById('progress-bar').style.width = `${progress}%`;
  document.getElementById('progress-text').textContent = `${index + 1} / ${steps.length}`;
  document.getElementById('current-step-desc').textContent = steps[index].description;
}

function resetScenario() {
  currentStep = -1;
  isPlaying = false;

  // Reset all steps
  steps.forEach((_, index) => {
    const stepEl = document.getElementById(`step-${index}`);
    stepEl.className = 'border-2 border-gray-300 bg-white rounded-lg p-6 transition-all duration-300';
    stepEl.querySelector('.step-description').classList.add('hidden');
  });

  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('progress-text').textContent = `0 / ${steps.length}`;
  document.getElementById('current-step-desc').textContent = '';
  document.getElementById('progress-info').classList.add('hidden');
  document.getElementById('start-btn').innerHTML = '▶ Start Scenario';
  document.getElementById('start-btn').disabled = false;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Event listeners
document.getElementById('start-btn').addEventListener('click', playScenario);
document.getElementById('reset-btn').addEventListener('click', resetScenario);

// Initialize
initTimeline();
