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
  
  // Generation quotas
  GENERATION: {
    MAX_ARTICLES_PER_DAY: 25,   // Total articles to generate across all categories/countries
    MAX_PER_CATEGORY: 5,        // Maximum articles per category per day
    MAX_PER_COUNTRY: 5,         // Maximum articles per country per day
    MIN_UNUSED_TRENDS: 3,       // Minimum number of unused trends to consider a combination
    PRIORITY_FACTORS: {
      UNUSED_TRENDS_WEIGHT: 0.6,         // Weight for unused trends count
      DAYS_SINCE_LAST_ARTICLE_WEIGHT: 0.3, // Weight for days since last article
      BASE_IMPORTANCE_WEIGHT: 0.1        // Weight for base importance
    }
  },
  
  // API rate limiting
  API_RATE_LIMIT: 100,         // requests per 15 minutes
  
  // Logging configuration
  LOGGING: {
    VERBOSE: process.env.VERBOSE_LOGGING === 'true' || false,
    INTERVAL_MS: parseInt(process.env.GENERATION_LOGS_INTERVAL || '60000', 10), // Log every minute by default
    DETAILED_TIMING: process.env.DETAILED_TIMING_LOGS === 'true' || false,
    INCLUDE_MEMORY_STATS: process.env.LOG_MEMORY_STATS === 'true' || false
  }
};