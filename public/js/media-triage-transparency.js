/**
 * Media Triage Transparency - Public Statistics Display
 * Demonstrates AI governance in practice with measurable transparency
 */

// Fetch and display triage statistics
async function loadTriageStats() {
  const loadingState = document.getElementById('loading-state');
  const statsContent = document.getElementById('stats-content');

  try {
    const response = await fetch('/api/media/triage-stats');
    const data = await response.json();

    if (!data.success) {
      throw new Error('Failed to load statistics');
    }

    const stats = data.statistics;

    // Hide loading, show content
    loadingState.classList.add('hidden');
    statsContent.classList.remove('hidden');

    // Update key metrics
    document.getElementById('stat-total').textContent = stats.total_triaged || 0;
    document.getElementById('stat-values').textContent = stats.involves_values_count || 0;

    // Update urgency distribution
    const totalUrgency = stats.by_urgency.high + stats.by_urgency.medium + stats.by_urgency.low || 1;

    const highPct = Math.round((stats.by_urgency.high / totalUrgency) * 100);
    const mediumPct = Math.round((stats.by_urgency.medium / totalUrgency) * 100);
    const lowPct = Math.round((stats.by_urgency.low / totalUrgency) * 100);

    document.getElementById('urgency-high-count').textContent = `${stats.by_urgency.high} inquiries (${highPct}%)`;
    document.getElementById('urgency-high-bar').style.width = `${highPct}%`;

    document.getElementById('urgency-medium-count').textContent = `${stats.by_urgency.medium} inquiries (${mediumPct}%)`;
    document.getElementById('urgency-medium-bar').style.width = `${mediumPct}%`;

    document.getElementById('urgency-low-count').textContent = `${stats.by_urgency.low} inquiries (${lowPct}%)`;
    document.getElementById('urgency-low-bar').style.width = `${lowPct}%`;

    // Update sensitivity distribution
    const totalSensitivity = stats.by_sensitivity.high + stats.by_sensitivity.medium + stats.by_sensitivity.low || 1;

    const sensHighPct = Math.round((stats.by_sensitivity.high / totalSensitivity) * 100);
    const sensMediumPct = Math.round((stats.by_sensitivity.medium / totalSensitivity) * 100);
    const sensLowPct = Math.round((stats.by_sensitivity.low / totalSensitivity) * 100);

    document.getElementById('sensitivity-high-count').textContent = `${stats.by_sensitivity.high} inquiries (${sensHighPct}%)`;
    document.getElementById('sensitivity-high-bar').style.width = `${sensHighPct}%`;

    document.getElementById('sensitivity-medium-count').textContent = `${stats.by_sensitivity.medium} inquiries (${sensMediumPct}%)`;
    document.getElementById('sensitivity-medium-bar').style.width = `${sensMediumPct}%`;

    document.getElementById('sensitivity-low-count').textContent = `${stats.by_sensitivity.low} inquiries (${sensLowPct}%)`;
    document.getElementById('sensitivity-low-bar').style.width = `${sensLowPct}%`;

    // Update framework compliance metrics
    document.getElementById('boundary-enforcements').textContent = stats.boundary_enforcements || 0;
    document.getElementById('avg-response-time').textContent = stats.avg_response_time_hours || 0;

  } catch (error) {
    console.error('Failed to load triage statistics:', error);

    // Show error message
    loadingState.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <svg class="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-red-800 font-medium mb-2">Failed to load statistics</p>
        <p class="text-sm text-red-600">Please try again later or contact support if the problem persists.</p>
      </div>
    `;
  }
}

// Load stats on page load
loadTriageStats();
