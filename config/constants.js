// config/constants.js

module.exports = {
  CATEGORIES: ['tech', 'sports', 'politics', 'health', 'general'],
  WEBSITES: {
    tech: 'news-tech.com',
    sports: 'news-sport.com',
    politics: 'news-politics.com',
    health: 'news-health.com',
    general: 'news-general.com'
  },
  TREND_STATUS: {
    USED: 'used',
    NOT_USED: 'not_used'
  },
  DEEPSEEK_DISCOUNT_START: 16, // 4 PM in 24-hour format
  DEEPSEEK_DISCOUNT_END: 24,   // 12 AM in 24-hour format
  API_RATE_LIMIT: 100,         // requests per 15 minutes
  
  // Logging configuration
  LOGGING: {
    VERBOSE: process.env.VERBOSE_LOGGING === 'true' || false,
    INTERVAL_MS: parseInt(process.env.GENERATION_LOGS_INTERVAL || '60000', 10), // Log every minute by default
    DETAILED_TIMING: process.env.DETAILED_TIMING_LOGS === 'true' || false,
    INCLUDE_MEMORY_STATS: process.env.LOG_MEMORY_STATS === 'true' || false
  }
};