// utils/languageUtils.js
const logger = require('../config/logger');
const countries = require('../config/countries');

/**
 * Get language code for a country
 * @param {string} countryCode - Country code
 * @returns {string} Language code
 */
function getLanguageForCountry(countryCode) {
  const country = countries.find(c => c.code === countryCode);
  
  if (!country) {
    logger.warn(`Unknown country code: ${countryCode}`);
    return 'en'; // Default to English
  }
  
  return country.language;
}

/**
 * Get countries for a language
 * @param {string} languageCode - Language code
 * @returns {Array<Object>} Countries with that language
 */
function getCountriesForLanguage(languageCode) {
  return countries.filter(c => c.language === languageCode);
}

/**
 * Generate a localized date string
 * @param {Date|string} date - Date object or string
 * @param {string} languageCode - Language code
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Localized date string
 */
function formatDate(date, languageCode, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat(languageCode, {
    ...defaultOptions,
    ...options
  }).format(dateObj);
}

/**
 * Format number according to locale
 * @param {number} num - Number to format
 * @param {string} languageCode - Language code
 * @param {Object} options - Intl.NumberFormat options
 * @returns {string} Formatted number
 */
function formatNumber(num, languageCode, options = {}) {
  return new Intl.NumberFormat(languageCode, options).format(num);
}

/**
 * Detect if text contains right-to-left languages
 * @param {string} text - Text to check
 * @returns {boolean} True if contains RTL script
 */
function isRTL(text) {
  const rtlRegex = /[\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  return rtlRegex.test(text);
}

/**
 * Get HTML dir attribute value based on language
 * @param {string} languageCode - Language code
 * @returns {string} "rtl" or "ltr"
 */
function getHTMLDir(languageCode) {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
  return rtlLanguages.includes(languageCode) ? 'rtl' : 'ltr';
}

/**
 * Create language-specific SEO metadata
 * @param {string} title - Page title
 * @param {string} languageCode - Language code
 * @returns {Object} SEO metadata
 */
function createSEOMetadata(title, languageCode) {
  return {
    title,
    htmlLang: languageCode,
    dir: getHTMLDir(languageCode)
  };
}

module.exports = {
  getLanguageForCountry,
  getCountriesForLanguage,
  formatDate,
  formatNumber,
  isRTL,
  getHTMLDir,
  createSEOMetadata
};