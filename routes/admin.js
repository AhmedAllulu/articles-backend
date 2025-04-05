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
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["artificial intelligence", "metaverse", "blockchain"]
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
// Add this route definition to routes/admin.js

/**
 * @swagger
 * /api/admin/trends/insert:
 *   post:
 *     summary: Insert trends manually
 *     tags: [Admin]
 *     description: Insert trending keywords manually for a specific category and country
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
 *                 description: List of trend keywords to insert
 *     responses:
 *       200:
 *         description: Trends inserted successfully
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

// Add this right after the other trend-related routes
// Export router
module.exports = router;