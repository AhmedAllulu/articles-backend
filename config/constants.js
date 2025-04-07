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
  OPENAI_DISCOUNT_START: 16, // 4 PM in 24-hour format
  OPENAI_DISCOUNT_END: 24,   // 12 AM in 24-hour format
  API_RATE_LIMIT: 100,       // requests per 15 minutes
};