/**
 * Koha Transparency Dashboard
 * Real-time donation metrics with privacy-preserving analytics
 */

// Chart instances (global for updates)
let allocationChart = null;
let trendChart = null;

/**
 * Load and display transparency metrics
 */
async function loadMetrics() {
  try {
    const response = await fetch('/api/koha/transparency');
    const data = await response.json();

    if (data.success && data.data) {
      const metrics = data.data;

      // Update stats
      updateStats(metrics);

      // Update allocation chart
      updateAllocationChart(metrics);

      // Update progress bars (legacy display)
      animateProgressBars();

      // Display recent donors
      displayRecentDonors(metrics.recent_donors || []);

      // Update last updated time
      updateLastUpdated(metrics.last_updated);

    } else {
      throw new Error('Failed to load metrics');
    }

  } catch (error) {
    console.error('Error loading transparency metrics:', error);
    document.getElementById('recent-donors').innerHTML = `
      <div class="text-center py-8 text-red-600">
        Failed to load transparency data. Please try again later.
      </div>
    `;
  }
}

/**
 * Update stats display
 */
function updateStats(metrics) {
  document.getElementById('total-received').textContent = `$${metrics.total_received.toFixed(2)}`;
  document.getElementById('monthly-supporters').textContent = metrics.monthly_supporters;
  document.getElementById('monthly-revenue').textContent = `$${metrics.monthly_recurring_revenue.toFixed(2)}`;
  document.getElementById('onetime-count').textContent = metrics.one_time_donations || 0;

  // Calculate average
  const totalCount = metrics.monthly_supporters + (metrics.one_time_donations || 0);
  const avgDonation = totalCount > 0 ? metrics.total_received / totalCount : 0;
  document.getElementById('average-donation').textContent = `$${avgDonation.toFixed(2)}`;
}

/**
 * Update allocation pie chart
 */
function updateAllocationChart(metrics) {
  const ctx = document.getElementById('allocation-chart');
  if (!ctx) return;

  const allocation = metrics.allocation || {
    development: 0.4,
    hosting: 0.3,
    research: 0.2,
    community: 0.1
  };

  const data = {
    labels: ['Development (40%)', 'Hosting & Infrastructure (30%)', 'Research (20%)', 'Community (10%)'],
    datasets: [{
      data: [
        allocation.development * 100,
        allocation.hosting * 100,
        allocation.research * 100,
        allocation.community * 100
      ],
      backgroundColor: [
        '#3B82F6', // blue-600
        '#10B981', // green-600
        '#A855F7', // purple-600
        '#F59E0B'  // orange-600
      ],
      borderWidth: 2,
      borderColor: '#FFFFFF'
    }]
  };

  const config = {
    type: 'doughnut',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              return `${label}: ${value.toFixed(1)}%`;
            }
          }
        }
      }
    }
  };

  if (allocationChart) {
    allocationChart.data = data;
    allocationChart.update();
  } else {
    allocationChart = new Chart(ctx, config);
  }
}

/**
 * Animate progress bars (legacy display)
 */
function animateProgressBars() {
  setTimeout(() => {
    document.querySelectorAll('.progress-bar').forEach(bar => {
      const width = bar.getAttribute('data-width');
      bar.style.width = width + '%';
    });
  }, 100);
}

/**
 * Display recent donors
 */
function displayRecentDonors(donors) {
  const donorsContainer = document.getElementById('recent-donors');
  const noDonorsMessage = document.getElementById('no-donors');

  if (donors.length > 0) {
    const donorsHtml = donors.map(donor => {
      const date = new Date(donor.date);
      const dateStr = date.toLocaleDateString('en-NZ', { year: 'numeric', month: 'short' });
      const freqBadge = donor.frequency === 'monthly'
        ? '<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Monthly</span>'
        : '<span class="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">One-time</span>';

      // Format currency display
      const currency = (donor.currency || 'nzd').toUpperCase();
      const amountDisplay = `$${donor.amount.toFixed(2)} ${currency}`;

      // Show NZD equivalent if different currency
      const nzdEquivalent = currency !== 'NZD'
        ? `<div class="text-xs text-gray-500">≈ $${donor.amount_nzd.toFixed(2)} NZD</div>`
        : '';

      return `
        <div class="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span class="text-blue-600 font-semibold">${donor.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <div class="font-medium text-gray-900">${donor.name}</div>
              <div class="text-sm text-gray-500">${dateStr}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="font-semibold text-gray-900">${amountDisplay}</div>
            ${nzdEquivalent}
            ${freqBadge}
          </div>
        </div>
      `;
    }).join('');

    donorsContainer.innerHTML = donorsHtml;
    donorsContainer.style.display = 'block';
    if (noDonorsMessage) noDonorsMessage.style.display = 'none';
  } else {
    donorsContainer.style.display = 'none';
    if (noDonorsMessage) noDonorsMessage.style.display = 'block';
  }
}

/**
 * Update last updated timestamp
 */
function updateLastUpdated(timestamp) {
  const lastUpdated = new Date(timestamp);
  const elem = document.getElementById('last-updated');
  if (elem) {
    elem.textContent = `Last updated: ${lastUpdated.toLocaleString()}`;
  }
}

/**
 * Export transparency data as CSV
 */
async function exportCSV() {
  try {
    const response = await fetch('/api/koha/transparency');
    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error('Failed to load metrics for export');
    }

    const metrics = data.data;

    // Build CSV content
    let csv = 'Tractatus Koha Transparency Report\\n';
    csv += `Generated: ${new Date().toISOString()}\\n\\n`;

    csv += 'Metric,Value\\n';
    csv += `Total Received,${metrics.total_received}\\n`;
    csv += `Monthly Supporters,${metrics.monthly_supporters}\\n`;
    csv += `One-Time Donations,${metrics.one_time_donations || 0}\\n`;
    csv += `Monthly Recurring Revenue,${metrics.monthly_recurring_revenue}\\n\\n`;

    csv += 'Allocation Category,Percentage\\n';
    csv += `Development,${(metrics.allocation.development * 100).toFixed(1)}%\\n`;
    csv += `Hosting & Infrastructure,${(metrics.allocation.hosting * 100).toFixed(1)}%\\n`;
    csv += `Research,${(metrics.allocation.research * 100).toFixed(1)}%\\n`;
    csv += `Community,${(metrics.allocation.community * 100).toFixed(1)}%\\n\\n`;

    if (metrics.recent_donors && metrics.recent_donors.length > 0) {
      csv += 'Recent Public Supporters\\n';
      csv += 'Name,Date,Amount,Currency,Frequency\\n';
      metrics.recent_donors.forEach(donor => {
        csv += `"${donor.name}",${donor.date},${donor.amount},${donor.currency || 'NZD'},${donor.frequency}\\n`;
      });
    }

    // Create download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tractatus-transparency-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Error exporting CSV:', error);
    alert('Failed to export transparency data. Please try again.');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Load metrics
  loadMetrics();

  // Refresh every 5 minutes
  setInterval(loadMetrics, 5 * 60 * 1000);

  // Setup CSV export button
  const exportBtn = document.getElementById('export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCSV);
  }
});
