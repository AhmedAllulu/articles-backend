// routes/api.js
const express = require('express');
const articleController = require('../controllers/articleController');
const trendsController = require('../controllers/trendsController');
const { validateCategoryAndCountry, validatePagination } = require('../middleware/validator');
const rateLimiter = require('../middleware/rateLimiter');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Apply rate limiting to all API routes
router.use(rateLimiter.apiLimiter);

// Articles routes
router.get(
  '/:category/:countryCode/articles',
  validateCategoryAndCountry,
  validatePagination,
  asyncHandler(articleController.getLatestArticles)
);

router.get(
  '/:category/:countryCode/articles/:id',
  validateCategoryAndCountry,
  asyncHandler(articleController.getArticleById)
);

router.get(
  '/:category/:countryCode/search',
  validateCategoryAndCountry,
  validatePagination,
  asyncHandler(articleController.searchArticles)
);

// Trends routes
router.get(
  '/:category/:countryCode/trends',
  validateCategoryAndCountry,
  asyncHandler(trendsController.getTrendingTopics)
);

router.get(
  '/:category/:countryCode/trends/:keyword',
  validateCategoryAndCountry,
  asyncHandler(trendsController.getTrendByKeyword)
);

// Status route - useful for health checks
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

module.exports = router;