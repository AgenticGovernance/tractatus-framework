// Demo tab switching
function showDemo(demoId) {
  document.querySelectorAll('.demo-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.demo-tab').forEach(el => {
    el.classList.remove('border-blue-500', 'text-blue-600');
    el.classList.add('border-transparent', 'text-gray-500');
  });

  document.getElementById('demo-' + demoId).classList.remove('hidden');
  document.getElementById('tab-' + demoId).classList.remove('border-transparent', 'text-gray-500');
  document.getElementById('tab-' + demoId).classList.add('border-blue-500', 'text-blue-600');
}

// Classification API call with backend integration
async function classifyInstruction() {
  const text = document.getElementById('classify-input').value;
  if (!text) return;

  try {
    // Try to call the demo API
    const response = await fetch('/api/demo/classify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ instruction: text })
    });

    let result;
    if (response.ok) {
      const data = await response.json();
      result = {
        quadrant: data.classification.quadrant,
        persistence: data.classification.persistence,
        verification: data.classification.verification_required,
        explicitness: data.classification.explicitness.toFixed(2),
        humanOversight: data.classification.human_oversight || 'RECOMMENDED'
      };
    } else {
      // Fallback to client-side classification
      result = classifyClientSide(text);
    }

    document.getElementById('result-quadrant').textContent = result.quadrant;
    document.getElementById('result-quadrant-desc').textContent =
      result.quadrant === 'STRATEGIC' ? 'Long-term values & mission' :
      result.quadrant === 'TACTICAL' ? 'Immediate implementation' :
      result.quadrant === 'SYSTEM' ? 'Technical infrastructure' : 'Process & policy';
    document.getElementById('result-persistence').textContent = result.persistence;
    document.getElementById('result-verification').textContent = result.verification;
    document.getElementById('result-explicitness').textContent = result.explicitness;
    document.getElementById('result-oversight').textContent = result.humanOversight;

    document.getElementById('classify-result').classList.remove('hidden');
    document.getElementById('classify-result').classList.add('fade-in');
  } catch (error) {
    console.error('Classification error:', error);
    // Fallback on error
    const result = classifyClientSide(text);
    document.getElementById('result-quadrant').textContent = result.quadrant;
    document.getElementById('result-persistence').textContent = result.persistence;
    document.getElementById('classify-result').classList.remove('hidden');
  }
}

// Client-side fallback classification
function classifyClientSide(text) {
  return {
    quadrant: text.toLowerCase().includes('always') || text.toLowerCase().includes('never') ? 'STRATEGIC' :
             text.toLowerCase().includes('port') || text.toLowerCase().includes('check') ? 'TACTICAL' :
             text.toLowerCase().includes('code') ? 'SYSTEM' : 'OPERATIONAL',
    persistence: text.toLowerCase().includes('always') || text.toLowerCase().includes('never') ? 'HIGH' :
                text.match(/\d{4,}/) ? 'HIGH' : 'MEDIUM',
    verification: 'MANDATORY',
    explicitness: text.match(/\d{4,}/) ? '0.9' : '0.6',
    humanOversight: 'RECOMMENDED'
  };
}

// Pressure calculation with API integration
async function updatePressure() {
  const tokens = parseInt(document.getElementById('token-slider').value);
  const messages = parseInt(document.getElementById('messages-slider').value);
  const errors = parseInt(document.getElementById('errors-slider').value);

  document.getElementById('token-value').textContent = tokens.toLocaleString();
  document.getElementById('messages-value').textContent = messages;
  document.getElementById('errors-value').textContent = errors;

  let level, percentage, message;

  try {
    // Try to call the API
    const response = await fetch('/api/demo/pressure-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tokens, messages, errors })
    });

    if (response.ok) {
      const data = await response.json();
      level = data.pressure.level;
      percentage = data.pressure.percentage;
      message = data.pressure.recommendations;
    } else {
      // Fallback to client-side calculation
      const result = calculatePressureClientSide(tokens, messages, errors);
      level = result.level;
      percentage = result.percentage;
      message = result.message;
    }
  } catch (error) {
    console.warn('Pressure API unavailable, using client-side calculation:', error);
    // Fallback to client-side calculation
    const result = calculatePressureClientSide(tokens, messages, errors);
    level = result.level;
    percentage = result.percentage;
    message = result.message;
  }

  // Update UI
  document.getElementById('pressure-percentage').textContent = percentage + '%';
  document.getElementById('pressure-bar').style.width = percentage + '%';

  let badgeClass, barClass;
  if (level === 'NORMAL') {
    badgeClass = 'bg-green-100 text-green-800';
    barClass = 'bg-green-500';
  } else if (level === 'ELEVATED') {
    badgeClass = 'bg-yellow-100 text-yellow-800';
    barClass = 'bg-yellow-500';
  } else if (level === 'HIGH') {
    badgeClass = 'bg-orange-100 text-orange-800';
    barClass = 'bg-orange-500';
  } else if (level === 'CRITICAL') {
    badgeClass = 'bg-red-100 text-red-800';
    barClass = 'bg-red-500';
  } else {
    badgeClass = 'bg-red-200 text-red-900';
    barClass = 'bg-red-700';
  }

  const badge = document.getElementById('pressure-badge');
  badge.textContent = level;
  badge.className = 'px-3 py-1 rounded-full text-sm font-medium ' + badgeClass;

  const bar = document.getElementById('pressure-bar');
  bar.className = 'h-3 rounded-full transition-all duration-300 ' + barClass;

  document.getElementById('pressure-recommendations').textContent = message;
}

// Client-side fallback pressure calculation
function calculatePressureClientSide(tokens, messages, errors) {
  const tokenPressure = (tokens / 200000) * 0.35;
  const messagePressure = Math.min(messages / 100, 1) * 0.25;
  const errorPressure = Math.min(errors / 3, 1) * 0.4;
  const totalPressure = tokenPressure + messagePressure + errorPressure;

  const percentage = Math.round(totalPressure * 100);

  let level, message;
  if (totalPressure < 0.3) {
    level = 'NORMAL';
    message = 'Operating normally. All systems green.';
  } else if (totalPressure < 0.5) {
    level = 'ELEVATED';
    message = 'Elevated pressure detected. Increased verification recommended.';
  } else if (totalPressure < 0.7) {
    level = 'HIGH';
    message = 'High pressure. Mandatory verification required for all actions.';
  } else if (totalPressure < 0.85) {
    level = 'CRITICAL';
    message = 'Critical pressure! Recommend context refresh or session restart.';
  } else {
    level = 'DANGEROUS';
    message = 'DANGEROUS CONDITIONS. Human intervention required. Action execution blocked.';
  }

  return { level, percentage, message };
}

// Initialize
updatePressure();

// Event listeners - CSP compliant
document.addEventListener('DOMContentLoaded', () => {
  // Demo tab switching
  document.querySelectorAll('.demo-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const demoId = tab.dataset.demo;
      showDemo(demoId);
    });
  });

  // Classify button
  const classifyButton = document.getElementById('classify-button');
  if (classifyButton) {
    classifyButton.addEventListener('click', classifyInstruction);
  }

  // Classify input - allow Enter key
  const classifyInput = document.getElementById('classify-input');
  if (classifyInput) {
    classifyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        classifyInstruction();
      }
    });
  }

  // Pressure sliders
  const tokenSlider = document.getElementById('token-slider');
  const messagesSlider = document.getElementById('messages-slider');
  const errorsSlider = document.getElementById('errors-slider');

  if (tokenSlider) tokenSlider.addEventListener('input', updatePressure);
  if (messagesSlider) messagesSlider.addEventListener('input', updatePressure);
  if (errorsSlider) errorsSlider.addEventListener('input', updatePressure);
});
