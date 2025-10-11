/**
 * Currency Configuration
 * Multi-currency support for Koha donation system
 *
 * Exchange rates based on NZD (New Zealand Dollar) as base currency
 * Update rates periodically or use live API
 */

// Base prices in NZD (in cents)
const BASE_PRICES_NZD = {
  tier_5: 500,    // $5 NZD
  tier_15: 1500,  // $15 NZD
  tier_50: 5000   // $50 NZD
};

// Exchange rates: 1 NZD = X currency
// Last updated: 2025-10-08
// Source: Manual calculation based on typical rates
const EXCHANGE_RATES = {
  NZD: 1.0,      // New Zealand Dollar (base)
  USD: 0.60,     // US Dollar
  EUR: 0.55,     // Euro
  GBP: 0.47,     // British Pound
  AUD: 0.93,     // Australian Dollar
  CAD: 0.82,     // Canadian Dollar
  JPY: 94.0,     // Japanese Yen
  CHF: 0.53,     // Swiss Franc
  SGD: 0.81,     // Singapore Dollar
  HKD: 4.68      // Hong Kong Dollar
};

// Currency metadata (symbols, formatting, names)
const CURRENCY_CONFIG = {
  NZD: {
    symbol: '$',
    code: 'NZD',
    name: 'NZ Dollar',
    decimals: 2,
    locale: 'en-NZ',
    flag: '🇳🇿'
  },
  USD: {
    symbol: '$',
    code: 'USD',
    name: 'US Dollar',
    decimals: 2,
    locale: 'en-US',
    flag: '🇺🇸'
  },
  EUR: {
    symbol: '€',
    code: 'EUR',
    name: 'Euro',
    decimals: 2,
    locale: 'de-DE',
    flag: '🇪🇺'
  },
  GBP: {
    symbol: '£',
    code: 'GBP',
    name: 'British Pound',
    decimals: 2,
    locale: 'en-GB',
    flag: '🇬🇧'
  },
  AUD: {
    symbol: '$',
    code: 'AUD',
    name: 'Australian Dollar',
    decimals: 2,
    locale: 'en-AU',
    flag: '🇦🇺'
  },
  CAD: {
    symbol: '$',
    code: 'CAD',
    name: 'Canadian Dollar',
    decimals: 2,
    locale: 'en-CA',
    flag: '🇨🇦'
  },
  JPY: {
    symbol: '¥',
    code: 'JPY',
    name: 'Japanese Yen',
    decimals: 0,  // JPY has no decimal places
    locale: 'ja-JP',
    flag: '🇯🇵'
  },
  CHF: {
    symbol: 'CHF',
    code: 'CHF',
    name: 'Swiss Franc',
    decimals: 2,
    locale: 'de-CH',
    flag: '🇨🇭'
  },
  SGD: {
    symbol: '$',
    code: 'SGD',
    name: 'Singapore Dollar',
    decimals: 2,
    locale: 'en-SG',
    flag: '🇸🇬'
  },
  HKD: {
    symbol: '$',
    code: 'HKD',
    name: 'Hong Kong Dollar',
    decimals: 2,
    locale: 'zh-HK',
    flag: '🇭🇰'
  }
};

// Supported currencies list (in display order)
const SUPPORTED_CURRENCIES = [
  'NZD',  // Default
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'JPY',
  'CHF',
  'SGD',
  'HKD'
];

/**
 * Convert NZD amount to target currency
 * @param {number} amountNZD - Amount in NZD cents
 * @param {string} targetCurrency - Target currency code
 * @returns {number} - Amount in target currency cents
 */
function convertFromNZD(amountNZD, targetCurrency) {
  const currency = targetCurrency.toUpperCase();

  if (!EXCHANGE_RATES[currency]) {
    throw new Error(`Unsupported currency: ${targetCurrency}`);
  }

  const rate = EXCHANGE_RATES[currency];
  const converted = Math.round(amountNZD * rate);

  return converted;
}

/**
 * Convert any currency amount to NZD
 * @param {number} amount - Amount in source currency cents
 * @param {string} sourceCurrency - Source currency code
 * @returns {number} - Amount in NZD cents
 */
function convertToNZD(amount, sourceCurrency) {
  const currency = sourceCurrency.toUpperCase();

  if (!EXCHANGE_RATES[currency]) {
    throw new Error(`Unsupported currency: ${sourceCurrency}`);
  }

  const rate = EXCHANGE_RATES[currency];
  const nzdAmount = Math.round(amount / rate);

  return nzdAmount;
}

/**
 * Get tier prices for a specific currency
 * @param {string} currency - Currency code
 * @returns {object} - Tier prices in target currency (cents)
 */
function getTierPrices(currency) {
  const tier5 = convertFromNZD(BASE_PRICES_NZD.tier_5, currency);
  const tier15 = convertFromNZD(BASE_PRICES_NZD.tier_15, currency);
  const tier50 = convertFromNZD(BASE_PRICES_NZD.tier_50, currency);

  return {
    tier_5: tier5,
    tier_15: tier15,
    tier_50: tier50
  };
}

/**
 * Format currency amount for display
 * @param {number} amountCents - Amount in cents
 * @param {string} currency - Currency code
 * @returns {string} - Formatted currency string (e.g., "$15.00", "¥1,400")
 */
function formatCurrency(amountCents, currency) {
  const config = CURRENCY_CONFIG[currency.toUpperCase()];

  if (!config) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  const amount = amountCents / 100;  // Convert cents to dollars

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals
  }).format(amount);
}

/**
 * Get currency display name with flag
 * @param {string} currency - Currency code
 * @returns {string} - Display name (e.g., "🇺🇸 USD - US Dollar")
 */
function getCurrencyDisplayName(currency) {
  const config = CURRENCY_CONFIG[currency.toUpperCase()];

  if (!config) {
    return currency.toUpperCase();
  }

  return `${config.flag} ${config.code} - ${config.name}`;
}

/**
 * Validate currency code
 * @param {string} currency - Currency code
 * @returns {boolean} - True if supported
 */
function isSupportedCurrency(currency) {
  return SUPPORTED_CURRENCIES.includes(currency.toUpperCase());
}

/**
 * Get exchange rate for a currency
 * @param {string} currency - Currency code
 * @returns {number} - Exchange rate (1 NZD = X currency)
 */
function getExchangeRate(currency) {
  return EXCHANGE_RATES[currency.toUpperCase()] || null;
}

/**
 * Detect currency from user location
 * This is a simplified version - in production, use IP geolocation API
 * @param {string} countryCode - ISO country code (e.g., 'US', 'GB')
 * @returns {string} - Suggested currency code
 */
function getCurrencyForCountry(countryCode) {
  const countryToCurrency = {
    'NZ': 'NZD',
    'US': 'USD',
    'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'NL': 'EUR',
    'GB': 'GBP',
    'AU': 'AUD',
    'CA': 'CAD',
    'JP': 'JPY',
    'CH': 'CHF',
    'SG': 'SGD',
    'HK': 'HKD'
  };

  return countryToCurrency[countryCode.toUpperCase()] || 'NZD';  // Default to NZD
}

module.exports = {
  BASE_PRICES_NZD,
  EXCHANGE_RATES,
  CURRENCY_CONFIG,
  SUPPORTED_CURRENCIES,
  convertFromNZD,
  convertToNZD,
  getTierPrices,
  formatCurrency,
  getCurrencyDisplayName,
  isSupportedCurrency,
  getExchangeRate,
  getCurrencyForCountry
};
