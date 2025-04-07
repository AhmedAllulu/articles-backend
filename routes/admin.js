// routes/admin.js
const express = require('express');
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth.authenticate);

/**
 * @swagger
 * /api/admin/articles/generate:
 *   post:
 *     summary: Generate articles for a category and country
 *     tags: [Admin]
 *     description: Generate articles using existing trends for a specific category and country
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - countryCode
 *             properties:
 *               category:
 *                 $ref: '#/components/schemas/CategoryParam'
 *               countryCode:
 *                 $ref: '#/components/schemas/CountryCodeParam'
 *               count:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 default: 1
 *                 description: Number of articles to generate
 *     responses:
 *       200:
 *         description: Articles generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Articles generated successfully
 *                     count:
 *                       type: integer
 *                       example: 3
 *                     keywords:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["artificial intelligence", "blockchain", "quantum computing"]
 *                 message:
 *                   type: string
 *                   example: Success
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/articles/generate', adminController.generateArticles);

/**
 * @swagger
 * /api/admin/trends/{category}/{countryCode}:
 *   get:
 *     summary: Get trends for a specific category and country
 *     tags: [Admin]
 *     description: Retrieve stored trends for a specific category and country
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/categoryParam'
 *       - $ref: '#/components/parameters/countryCodeParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [used, not_used]
 *         description: Filter trends by usage status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           minimum: 1
 *         description: Maximum number of trends to return
 *     responses:
 *       200:
 *         description: Trends retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     trends:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Trend'
 *                     count:
 *                       type: integer
 *                       example: 25
 *                     category:
 *                       type: string
 *                       example: tech
 *                     countryCode:
 *                       type: string
 *                       example: US
 *                 message:
 *                   type: string
 *                   example: Success
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/trends/:category/:countryCode', adminController.getTrends);

// Add the new route for fetching all trends
/**
 * @swagger
 * /api/admin/trends/fetch-all:
 *   post:
 *     summary: Fetch trends for all categories and countries
 *     tags: [Admin]
 *     description: Fetch trending keywords for all categories and countries and store them in the database
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trends fetched and stored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: All trends fetched and stored successfully
 *                     results:
 *                       type: object
 *                 message:
 *                   type: string
 *                   example: Success
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/trends/fetch-all', auth.requireAdmin, adminController.fetchAllTrends);

/**
 * @swagger
 * /api/admin/trends/fetch:
 *   post:
 *     summary: Fetch new trends from external API
 *     tags: [Admin]
 *     description: Fetch trending keywords from external API and store them in the database
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - countryCode
 *             properties:
 *               category:
 *                 $ref: '#/components/schemas/CategoryParam'
 *               countryCode:
 *                 $ref: '#/components/schemas/CountryCodeParam'
 *     responses:
 *       200:
 *         description: Trends fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Trends fetched and stored successfully
 *                     fetched:
 *                       type: integer
 *                       example: 20
 *                     stored:
 *                       type: integer
 *                       example: 15
 *                 message:
 *                   type: string
 *                   example: Success
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/trends/fetch', adminController.fetchTrends);
/**
 * @swagger
 * /api/admin/generation/stats:
 *   get:
 *     summary: Get generation statistics
 *     tags: [Admin]
 *     description: Get daily and total generation statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Generation statistics retrieved successfully
 */
router.get('/generation/stats', auth.requireAdmin, async (req, res) => {
    try {
      // Get scheduler stats
      const schedulerStats = scheduler.getJobStats();
      
      // Get articles generated today
      const articlesGeneratedToday = await generationService.countArticlesGeneratedToday();
      
      res.json({
        success: true,
        data: {
          current: {
            date: new Date().toISOString(),
            articlesGeneratedToday,
            quotaRemaining: Math.max(0, schedulerStats.quotaInfo.dailyArticleQuota - articlesGeneratedToday)
          },
          scheduler: schedulerStats,
          activeJobs: {
            articleGeneration: scheduler.isJobRunning('articleGeneration'),
            trendFetching: scheduler.isJobRunning('trendFetching')
          }
        },
        message: 'Generation statistics retrieved successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error getting generation stats: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          message: error.message,
          status: 500
        },
        timestamp: new Date().toISOString()
      });
    }
  });
  
  /**
   * @swagger
   * /api/admin/generation/run:
   *   post:
   *     summary: Run article generation manually
   *     tags: [Admin]
   *     description: Manually trigger article generation with options
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               maxArticles:
   *                 type: integer
   *                 description: Maximum number of articles to generate
   *                 default: 5
   *               maxCombinations:
   *                 type: integer
   *                 description: Maximum number of category/country combinations
   *                 default: 5
   *     responses:
   *       200:
   *         description: Generation started successfully
   *       400:
   *         description: Invalid request parameters
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       500:
   *         description: Server error
   */
  router.post('/generation/run', auth.requireAdmin, async (req, res) => {
    try {
      const { maxArticles = 5, maxCombinations = 5 } = req.body;
      
      // Validate parameters
      if (maxArticles <= 0 || maxArticles > 25) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'maxArticles must be between 1 and 25',
            status: 400
          },
          timestamp: new Date().toISOString()
        });
      }
      
      if (maxCombinations <= 0 || maxCombinations > 35) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'maxCombinations must be between 1 and 35',
            status: 400
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Check if job is already running
      if (scheduler.isJobRunning('articleGeneration')) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Article generation is already running',
            status: 400
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Start generation in the background
      scheduler.runArticleGenerationJob({
        maxArticlesPerDay: maxArticles,
        maxCombinations: maxCombinations,
        forceDevelopment: true
      }).catch(error => {
        logger.error(`Error in manual generation: ${error.message}`);
      });
      
      // Return immediately
      res.json({
        success: true,
        data: {
          message: 'Article generation started in the background',
          options: {
            maxArticles,
            maxCombinations
          }
        },
        message: 'Generation started successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error starting generation: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          message: error.message,
          status: 500
        },
        timestamp: new Date().toISOString()
      });
    }
  });
  
/**
 * @swagger
 * /api/admin/articles/generate-from-trends:
 *   post:
 *     summary: Fetch new trends and generate articles in one operation
 *     tags: [Admin]
 *     description: Combines fetching trends and generating articles into one operation for efficiency
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - countryCode
 *             properties:
 *               category:
 *                 $ref: '#/components/schemas/CategoryParam'
 *               countryCode:
 *                 $ref: '#/components/schemas/CountryCodeParam'
 *               count:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 default: 5
 *                 description: Maximum number of articles to generate
 *     responses:
 *       200:
 *         description: Trends fetched and articles generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Trends fetched and articles generated successfully
 *                     trends:
 *                       type: object
 *                       properties:
 *                         fetched:
 *                           type: integer
 *                           example: 20
 *                         stored:
 *                           type: integer
 *                           example: 15
 *                         used:
 *                           type: integer
 *                           example: 5
 *                         keywords:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["metaverse", "blockchain", "web3", "AI ethics", "quantum computing"]
 *                     articles:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 5
 *                         message:
 *                           type: string
 *                           example: Articles generated successfully
 *                 message:
 *                   type: string
 *                   example: Success
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/articles/generate-from-trends', adminController.generateArticlesFromTrends);

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get system statistics
 *     tags: [Admin]
 *     description: Get statistics about the system, including articles and trends
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Statistics endpoint
 *                     stats:
 *                       type: object
 *                       properties:
 *                         articles:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                               example: 1250
 *                             byCategory:
 *                               type: object
 *                         trends:
 *                           type: object
 *                           properties:
 *                             used:
 *                               type: integer
 *                               example: 425
 *                             unused:
 *                               type: integer
 *                               example: 175
 *                 message:
 *                   type: string
 *                   example: Success
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/stats', adminController.getStats);

/**
 * @swagger
 * /api/admin/trends/cleanup:
 *   post:
 *     summary: Clean up old used trends
 *     tags: [Admin]
 *     description: Delete old used trends from the database to maintain system performance
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               olderThanDays:
 *                 type: integer
 *                 minimum: 1
 *                 default: 30
 *                 description: Delete trends used more than this many days ago
 *     responses:
 *       200:
 *         description: Old trends cleanup completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Old trends cleanup completed
 *                     results:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         additionalProperties:
 *                           type: integer
 *                       example:
 *                         tech:
 *                           US: 15
 *                           GB: 12
 *                           DE: 8
 *                         sports:
 *                           US: 10
 *                           GB: 7
 *                           DE: 5
 *                 message:
 *                   type: string
 *                   example: Success
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/trends/cleanup', adminController.cleanupOldTrends);

/**
 * @swagger
 * /api/admin/trends/options:
 *   get:
 *     summary: Get available categories and countries
 *     tags: [Admin]
 *     description: Retrieve available categories and countries for trend operations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Options retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                             example: tech
 *                           label:
 *                             type: string
 *                             example: Tech
 *                           website:
 *                             type: string
 *                             example: news-tech.com
 *                     countries:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                             example: US
 *                           label:
 *                             type: string
 *                             example: USA
 *                           language:
 *                             type: string
 *                             example: en
 *                 message:
 *                   type: string
 *                   example: Success
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/trends/options', adminController.getTrendOptions);
/**
 * @swagger
 * /api/admin/trends/insert:
 *   post:
 *     summary: Insert trends for a specific category and country
 *     tags: [Admin]
 *     description: Insert trending keywords for a selected category and country
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - countryCode
 *               - trends
 *             properties:
 *               category:
 *                 $ref: '#/components/schemas/CategoryParam'
 *               countryCode:
 *                 $ref: '#/components/schemas/CountryCodeParam'
 *               trends:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["artificial intelligence", "quantum computing", "blockchain"]
 *     responses:
 *       200:
 *         description: Trends inserted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["artificial intelligence", "quantum computing", "blockchain"]
 *                     count:
 *                       type: integer
 *                       example: 3
 *                     category:
 *                       type: string
 *                       example: tech
 *                     countryCode:
 *                       type: string
 *                       example: US
 *                 message:
 *                   type: string
 *                   example: Success
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/trends/insert', adminController.insertTrends);

module.exports = router;