/**
 * Currency Selector Component
 * Dropdown for selecting donation currency
 */

(function() {
  'use strict';

  // Currency selector HTML
  const selectorHTML = `
    <div id="currency-selector" class="bg-white shadow rounded-lg p-4 mb-8">
      <label for="currency-select" class="block text-sm font-medium text-gray-700 mb-2">
        Select Currency
      </label>
      <select
        id="currency-select"
        class="w-full md:w-64 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none text-base"
        aria-label="Select your preferred currency"
      >
        <option value="NZD">🇳🇿 NZD - NZ Dollar</option>
        <option value="USD">🇺🇸 USD - US Dollar</option>
        <option value="EUR">🇪🇺 EUR - Euro</option>
        <option value="GBP">🇬🇧 GBP - British Pound</option>
        <option value="AUD">🇦🇺 AUD - Australian Dollar</option>
        <option value="CAD">🇨🇦 CAD - Canadian Dollar</option>
        <option value="JPY">🇯🇵 JPY - Japanese Yen</option>
        <option value="CHF">🇨🇭 CHF - Swiss Franc</option>
        <option value="SGD">🇸🇬 SGD - Singapore Dollar</option>
        <option value="HKD">🇭🇰 HKD - Hong Kong Dollar</option>
      </select>
      <p class="text-xs text-gray-500 mt-2">
        Prices are automatically converted from NZD. Your selection is saved for future visits.
      </p>
    </div>
  `;

  // Initialize currency selector
  function initCurrencySelector() {
    // Find container (should have id="currency-selector-container")
    const container = document.getElementById('currency-selector-container');
    if (!container) {
      console.warn('Currency selector container not found');
      return;
    }

    // Insert selector HTML
    container.innerHTML = selectorHTML;

    // Get select element
    const select = document.getElementById('currency-select');

    // Set initial value from detected currency
    const detectedCurrency = detectUserCurrency();
    select.value = detectedCurrency;

    // Trigger initial price update
    if (typeof window.updatePricesForCurrency === 'function') {
      window.updatePricesForCurrency(detectedCurrency);
    }

    // Listen for changes
    select.addEventListener('change', function(e) {
      const newCurrency = e.target.value;

      // Save preference
      saveCurrencyPreference(newCurrency);

      // Update prices
      if (typeof window.updatePricesForCurrency === 'function') {
        window.updatePricesForCurrency(newCurrency);
      }
    });
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCurrencySelector);
  } else {
    initCurrencySelector();
  }

  // Expose init function globally
  window.initCurrencySelector = initCurrencySelector;

})();
