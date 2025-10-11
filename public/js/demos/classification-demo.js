// Classification with API integration and fallback
async function classifyInstruction(text) {
  try {
    // Try API first
    const response = await fetch('/api/demo/classify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ instruction: text })
    });

    if (response.ok) {
      const data = await response.json();
      return data.classification;
    }

    // If API fails, fall back to client-side classification
    console.warn('API unavailable, using client-side classification');
    return classifyInstructionClientSide(text);
  } catch (error) {
    console.warn('Error calling API, using client-side classification:', error);
    return classifyInstructionClientSide(text);
  }
}

// Client-side fallback classification
function classifyInstructionClientSide(text) {
  const lower = text.toLowerCase();

  let quadrant, persistence, temporal, verification, explicitness, reasoning;

  // Detect quadrant
  if (lower.includes('privacy') || lower.includes('values') || lower.includes('mission') || lower.includes('ethics')) {
    quadrant = 'STRATEGIC';
    persistence = 'HIGH';
    temporal = 'PERMANENT';
    verification = 'MANDATORY';
    explicitness = 0.90;
    reasoning = 'Contains values-related keywords indicating strategic importance';
  } else if (lower.includes('port') || lower.includes('database') || lower.includes('mongodb') || lower.includes('server')) {
    quadrant = 'SYSTEM';
    persistence = 'HIGH';
    temporal = 'PROJECT';
    verification = 'MANDATORY';
    explicitness = 0.85;
    reasoning = 'Technical infrastructure configuration that must persist across project';
  } else if (lower.includes('all') || lower.includes('must') || lower.includes('always') && (lower.includes('api') || lower.includes('format'))) {
    quadrant = 'OPERATIONAL';
    persistence = 'MEDIUM';
    temporal = 'PROJECT';
    verification = 'REQUIRED';
    explicitness = 0.75;
    reasoning = 'Standard operating procedure for consistent project implementation';
  } else if (lower.includes('console.log') || lower.includes('debug') || lower.includes('here')) {
    quadrant = 'TACTICAL';
    persistence = 'LOW';
    temporal = 'TASK';
    verification = 'OPTIONAL';
    explicitness = 0.70;
    reasoning = 'Specific task-level instruction with limited temporal scope';
  } else if (lower.includes('explore') || lower.includes('try') || lower.includes('different approaches')) {
    quadrant = 'STOCHASTIC';
    persistence = 'VARIABLE';
    temporal = 'PHASE';
    verification = 'NONE';
    explicitness = 0.50;
    reasoning = 'Exploratory directive with open-ended outcome';
  } else {
    quadrant = 'OPERATIONAL';
    persistence = 'MEDIUM';
    temporal = 'PROJECT';
    verification = 'REQUIRED';
    explicitness = 0.65;
    reasoning = 'General instruction defaulting to operational classification';
  }

  return {
    quadrant,
    persistence,
    temporal_scope: temporal,
    verification_required: verification,
    explicitness,
    reasoning
  };
}

// Description mappings
const descriptions = {
  quadrant: {
    STRATEGIC: 'Mission-critical decisions affecting values, privacy, or core principles',
    OPERATIONAL: 'Standard procedures and conventions for consistent operation',
    TACTICAL: 'Specific tasks with defined scope and completion criteria',
    SYSTEM: 'Technical configuration and infrastructure settings',
    STOCHASTIC: 'Exploratory, creative, or experimental work with variable outcomes'
  },
  persistence: {
    HIGH: 'Must persist for entire project or permanently',
    MEDIUM: 'Should persist for project phase or major component',
    LOW: 'Applies to single task or session only',
    VARIABLE: 'Depends on context and outcomes'
  },
  temporal: {
    PERMANENT: 'Never expires, fundamental to project',
    PROJECT: 'Entire project lifespan',
    PHASE: 'Current development phase',
    SESSION: 'Current session only',
    TASK: 'Specific task only'
  }
};

// Event listeners
document.getElementById('classify-btn').addEventListener('click', async () => {
  const input = document.getElementById('instruction-input').value.trim();
  if (!input) return;

  // Show loading state
  const btn = document.getElementById('classify-btn');
  btn.disabled = true;
  btn.textContent = 'Classifying...';

  try {
    const result = await classifyInstruction(input);
    displayResults(result);
  } catch (error) {
    console.error('Classification error:', error);
    alert('Error classifying instruction. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Classify Instruction';
  }
});

document.querySelectorAll('.example-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const example = btn.getAttribute('data-example');
    document.getElementById('instruction-input').value = example;

    // Classify the example
    const classifyBtn = document.getElementById('classify-btn');
    classifyBtn.disabled = true;
    classifyBtn.textContent = 'Classifying...';

    try {
      const result = await classifyInstruction(example);
      displayResults(result);
    } catch (error) {
      console.error('Classification error:', error);
    } finally {
      classifyBtn.disabled = false;
      classifyBtn.textContent = 'Classify Instruction';
    }
  });
});

function displayResults(result) {
  // Show results container
  document.getElementById('results-container').classList.remove('hidden');
  document.getElementById('empty-state').classList.add('hidden');

  // Quadrant
  const quadrantEl = document.getElementById('result-quadrant');
  quadrantEl.textContent = result.quadrant;
  quadrantEl.className = `quadrant-badge quadrant-${result.quadrant}`;
  document.getElementById('result-quadrant-desc').textContent = descriptions.quadrant[result.quadrant];

  // Persistence
  const persistenceEl = document.getElementById('result-persistence');
  persistenceEl.textContent = result.persistence;
  persistenceEl.className = `px-4 py-2 rounded-lg text-white font-semibold persistence-${result.persistence}`;
  document.getElementById('result-persistence-desc').textContent = descriptions.persistence[result.persistence];

  const persistenceFill = document.getElementById('persistence-fill');
  const persistenceWidths = { HIGH: '100%', MEDIUM: '66%', LOW: '33%', VARIABLE: '50%' };
  persistenceFill.style.width = persistenceWidths[result.persistence];
  persistenceFill.className = `h-full transition-all duration-500 persistence-${result.persistence}`;

  // Temporal Scope
  document.getElementById('result-temporal').textContent = result.temporal_scope;
  document.getElementById('result-temporal-desc').textContent = descriptions.temporal[result.temporal_scope];

  // Verification
  document.getElementById('result-verification').textContent = result.verification_required;

  // Explicitness
  const explicitnessValue = typeof result.explicitness === 'number' ? result.explicitness : parseFloat(result.explicitness);
  document.getElementById('result-explicitness').textContent = explicitnessValue.toFixed(2);
  document.getElementById('explicitness-fill').style.width = (explicitnessValue * 100) + '%';

  const storageDecision = document.getElementById('storage-decision');
  if (explicitnessValue >= 0.6) {
    storageDecision.innerHTML = '<strong class="text-green-600">✓ Will be stored</strong> in persistent instruction database';
  } else {
    storageDecision.innerHTML = '<strong class="text-orange-600">⚠ Too vague</strong> to store - needs more explicit phrasing';
  }

  // Reasoning
  document.getElementById('result-reasoning').textContent = result.reasoning;
}
