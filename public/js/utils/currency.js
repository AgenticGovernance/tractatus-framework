/**
 * Currency Utilities (Client-Side)
 * Multi-currency support for Koha donation form
 */

// Base prices in NZD (in cents)
const BASE_PRICES_NZD = {
  tier_5: 500,    // $5 NZD
  tier_15: 1500,  // $15 NZD
  tier_50: 5000   // $50 NZD
};

// Exchange rates: 1 NZD = X currency
const EXCHANGE_RATES = {
  NZD: 1.0,
  USD: 0.60,
  EUR: 0.55,
  GBP: 0.47,
  AUD: 0.93,
  CAD: 0.82,
  JPY: 94.0,
  CHF: 0.53,
  SGD: 0.81,
  HKD: 4.68
};

// Currency metadata
const CURRENCY_CONFIG = {
  NZD: { symbol: '$', code: 'NZD', name: 'NZ Dollar', decimals: 2, flag: '🇳🇿' },
  USD: { symbol: '$', code: 'USD', name: 'US Dollar', decimals: 2, flag: '🇺🇸' },
  EUR: { symbol: '€', code: 'EUR', name: 'Euro', decimals: 2, flag: '🇪🇺' },
  GBP: { symbol: '£', code: 'GBP', name: 'British Pound', decimals: 2, flag: '🇬🇧' },
  AUD: { symbol: '$', code: 'AUD', name: 'Australian Dollar', decimals: 2, flag: '🇦🇺' },
  CAD: { symbol: '$', code: 'CAD', name: 'Canadian Dollar', decimals: 2, flag: '🇨🇦' },
  JPY: { symbol: '¥', code: 'JPY', name: 'Japanese Yen', decimals: 0, flag: '🇯🇵' },
  CHF: { symbol: 'CHF', code: 'CHF', name: 'Swiss Franc', decimals: 2, flag: '🇨🇭' },
  SGD: { symbol: '$', code: 'SGD', name: 'Singapore Dollar', decimals: 2, flag: '🇸🇬' },
  HKD: { symbol: '$', code: 'HKD', name: 'Hong Kong Dollar', decimals: 2, flag: '🇭🇰' }
};

// Supported currencies
const SUPPORTED_CURRENCIES = ['NZD', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CHF', 'SGD', 'HKD'];

/**
 * Convert NZD amount to target currency
 */
function convertFromNZD(amountNZD, targetCurrency) {
  const rate = EXCHANGE_RATES[targetCurrency];
  return Math.round(amountNZD * rate);
}

/**
 * Get tier prices for a currency
 */
function getTierPrices(currency) {
  return {
    tier_5: convertFromNZD(BASE_PRICES_NZD.tier_5, currency),
    tier_15: convertFromNZD(BASE_PRICES_NZD.tier_15, currency),
    tier_50: convertFromNZD(BASE_PRICES_NZD.tier_50, currency)
  };
}

/**
 * Format currency amount for display
 */
function formatCurrency(amountCents, currency) {
  const config = CURRENCY_CONFIG[currency];
  const amount = amountCents / 100;

  // For currencies with symbols that should come after (none in our list currently)
  // we could customize here, but Intl.NumberFormat handles it well

  try {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals
    }).format(amount);
  } catch (e) {
    // Fallback if Intl fails
    return `${config.symbol}${amount.toFixed(config.decimals)}`;
  }
}

/**
 * Get currency display name with flag
 */
function getCurrencyDisplayName(currency) {
  const config = CURRENCY_CONFIG[currency];
  return `${config.flag} ${config.code} - ${config.name}`;
}

/**
 * Detect user's currency from browser/location
 */
function detectUserCurrency() {
  // Try localStorage first
  const saved = localStorage.getItem('tractatus_currency');
  if (saved && SUPPORTED_CURRENCIES.includes(saved)) {
    return saved;
  }

  // Try to detect from browser language
  const lang = navigator.language || navigator.userLanguage || 'en-NZ';
  const langMap = {
    'en-US': 'USD',
    'en-GB': 'GBP',
    'en-AU': 'AUD',
    'en-CA': 'CAD',
    'en-NZ': 'NZD',
    'ja': 'JPY',
    'ja-JP': 'JPY',
    'de': 'EUR',
    'de-DE': 'EUR',
    'fr': 'EUR',
    'fr-FR': 'EUR',
    'de-CH': 'CHF',
    'en-SG': 'SGD',
    'zh-HK': 'HKD'
  };

  return langMap[lang] || langMap[lang.substring(0, 2)] || 'NZD';
}

/**
 * Save user's currency preference
 */
function saveCurrencyPreference(currency) {
  localStorage.setItem('tractatus_currency', currency);
}
