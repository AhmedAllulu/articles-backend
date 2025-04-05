// routes/health.js
const express = require('express');
const healthController = require('../controllers/healthController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     description: Get basic application health status (public endpoint)
 *     responses:
 *       200:
 *         description: Basic health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', asyncHandler(healthController.getBasicHealth));

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     tags: [Health]
 *     description: Get detailed application health status (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 responseTime:
 *                   type: string
 *                   example: 120ms
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                     system:
 *                       type: object
 *                     memory:
 *                       type: object
 *                     disk:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       503:
 *         description: Service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unhealthy
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/detailed',
  authenticate,
  requireAdmin,
  asyncHandler(healthController.getDetailedHealth)
);

module.exports = router;