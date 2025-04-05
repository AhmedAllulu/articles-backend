// routes/api.js
const express = require('express');
const articleController = require('../controllers/articleController');
const trendsController = require('../controllers/trendsController');
const { validateCategoryAndCountry, validatePagination } = require('../middleware/validator');
const rateLimiter = require('../middleware/rateLimiter');
const { asyncHandler } = require('../middleware/errorHandler');
// Add these annotations to routes/api.js
// Before the router definition:

/**
 * @swagger
 * /api/{category}/{countryCode}/articles:
 *   get:
 *     summary: Get latest articles
 *     tags: [Articles]
 *     description: Get the latest articles for a specific category and country
 *     parameters:
 *       - $ref: '#/components/parameters/categoryParam'
 *       - $ref: '#/components/parameters/countryCodeParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/offsetParam'
 *     responses:
 *       200:
 *         description: Articles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArticlesList'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/{category}/{countryCode}/articles/{id}:
 *   get:
 *     summary: Get article by ID
 *     tags: [Articles]
 *     description: Get a specific article by ID
 *     parameters:
 *       - $ref: '#/components/parameters/categoryParam'
 *       - $ref: '#/components/parameters/countryCodeParam'
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Article retrieved successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/{category}/{countryCode}/search:
 *   get:
 *     summary: Search articles
 *     tags: [Articles]
 *     description: Search articles by query
 *     parameters:
 *       - $ref: '#/components/parameters/categoryParam'
 *       - $ref: '#/components/parameters/countryCodeParam'
 *       - $ref: '#/components/parameters/searchQueryParam'
 *       - $ref: '#/components/parameters/limitParam'
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/{category}/{countryCode}/trends:
 *   get:
 *     summary: Get trending topics
 *     tags: [Trends]
 *     description: Get trending topics for a specific category and country
 *     parameters:
 *       - $ref: '#/components/parameters/categoryParam'
 *       - $ref: '#/components/parameters/countryCodeParam'
 *       - $ref: '#/components/parameters/limitParam'
 *     responses:
 *       200:
 *         description: Trends retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrendsList'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/{category}/{countryCode}/trends/{keyword}:
 *   get:
 *     summary: Get trend by keyword
 *     tags: [Trends]
 *     description: Get information about a specific trend by keyword
 *     parameters:
 *       - $ref: '#/components/parameters/categoryParam'
 *       - $ref: '#/components/parameters/countryCodeParam'
 *       - $ref: '#/components/parameters/keywordParam'
 *     responses:
 *       200:
 *         description: Trend information retrieved successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
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