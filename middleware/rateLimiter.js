// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

/**
 * Create a rate limiter middleware with custom settings
 * @param {Object} options - Rate limiter options
 * @returns {Function} Rate limiter middleware
 */
function createRateLimiter(options = {}) {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: 'Too many requests, please try again later.'
    },
    // Add custom handler to log rate limit hits
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit exceeded: ${req.ip} - ${req.method} ${req.originalUrl}`);
      res.status(options.statusCode).json(options.message);
    }
  };
  
  return rateLimit({
    ...defaultOptions,
    ...options
  });
}

/**
 * More strict rate limiter for sensitive endpoints
 */
const strictLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10 // 10 requests per hour
});

/**
 * Standard API rate limiter
 */
const apiLimiter = createRateLimiter();

/**
 * Less strict rate limiter for public endpoints
 */
const publicLimiter = createRateLimiter({
  max: 500 // 500 requests per 15 minutes
});

module.exports = {
  createRateLimiter,
  strictLimiter,
  apiLimiter,
  publicLimiter
};