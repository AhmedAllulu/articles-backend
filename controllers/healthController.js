// controllers/healthController.js
const healthService = require('../services/healthService');
const logger = require('../config/logger');

/**
 * Get basic health status
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getBasicHealth(req, res) {
  try {
    // Simple health check that returns quickly
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    logger.error(`Error in getBasicHealth: ${error.message}`);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}

/**
 * Get detailed health status (requires authentication)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getDetailedHealth(req, res) {
  try {
    const healthStatus = await healthService.getHealthStatus();
    
    // Set status code based on health status
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error(`Error in getDetailedHealth: ${error.message}`);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}

module.exports = {
  getBasicHealth,
  getDetailedHealth
};