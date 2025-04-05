// controllers/adminController.js
const generationService = require('../services/generationService');
const trendsService = require('../services/trendsService');
const Trend = require('../models/Trend');
const { formatResponse } = require('../utils/responseFormatter');
const logger = require('../config/logger');
const { User } = require('../models/User');

/**
 * Generate articles for a category and country
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function generateArticles(req, res) {
  try {
    const { category, countryCode, count = 1 } = req.body;
    
    // Validate params
    if (!category || !countryCode) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters: category, countryCode', 400)
      );
    }
    
    // Log action
    await User.logAction(
      req.user.id,
      `Generate articles: ${category}/${countryCode} (${count})`,
      req.ip,
      req.headers['user-agent']
    );
    
    // Generate articles
    try {
      const result = await generationService.generateArticlesForCategoryAndCountry(
        category,
        countryCode,
        parseInt(count, 10)
      );
      
      return res.json(formatResponse(result));
    } catch (error) {
      logger.error(`Article generation failed: ${error.message}`);
      return res.status(500).json(
        formatResponse(null, `Article generation failed: ${error.message}`, 500)
      );
    }
  } catch (error) {
    logger.error(`Error in generateArticles: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, error.message, 500)
    );
  }
}

/**
 * Get trends for a category and country
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getTrends(req, res) {
  try {
    const { category, countryCode } = req.params;
    const { status, limit = 100 } = req.query;
    
    // Validate params
    if (!category || !countryCode) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters: category, countryCode', 400)
      );
    }
    
    // Get trends
    try {
      const trends = await Trend.getAll(
        category,
        countryCode,
        parseInt(limit, 10),
        status
      );
      
      return res.json(formatResponse({
        trends,
        count: trends.length,
        category,
        countryCode
      }));
    } catch (error) {
      logger.error(`Failed to get trends: ${error.message}`);
      return res.status(500).json(
        formatResponse(null, `Failed to get trends: ${error.message}`, 500)
      );
    }
  } catch (error) {
    logger.error(`Error in getTrends: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, error.message, 500)
    );
  }
}

/**
 * Fetch new trends (disabled, use insert trends instead)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function fetchTrends(req, res) {
  try {
    // Log action
    await User.logAction(
      req.user.id,
      `Attempted to use disabled fetch trends endpoint`,
      req.ip,
      req.headers['user-agent']
    );
    
    return res.status(400).json(
      formatResponse(null, 'Automatic trend fetching is disabled. Please use the /trends/insert endpoint to manually add trends.', 400)
    );
  } catch (error) {
    logger.error(`Error in fetchTrends: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, error.message, 500)
    );
  }
}

/**
 * Generate articles from existing trends
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function generateArticlesFromTrends(req, res) {
  try {
    const { category, countryCode, count = 5 } = req.body;
    
    // Validate params
    if (!category || !countryCode) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters: category, countryCode', 400)
      );
    }
    
    // Log action
    await User.logAction(
      req.user.id,
      `Generate articles from existing trends: ${category}/${countryCode} (${count})`,
      req.ip,
      req.headers['user-agent']
    );
    
    try {
      // Check if we have unused trends
      const unusedTrends = await trendsService.getUnusedTrends(category, countryCode);
      
      if (unusedTrends.length === 0) {
        return res.json(formatResponse({
          message: 'No unused trends available. Please insert trends first using the /trends/insert endpoint.',
          count: 0
        }));
      }
      
      // Generate articles
      const result = await generationService.generateArticlesForCategoryAndCountry(
        category,
        countryCode,
        parseInt(count, 10)
      );
      
      return res.json(formatResponse({
        message: 'Articles generated successfully from existing trends',
        count: result.count,
        keywords: result.keywords || []
      }));
    } catch (error) {
      logger.error(`Failed to generate articles from trends: ${error.message}`);
      return res.status(500).json(
        formatResponse(null, `Failed to generate articles from trends: ${error.message}`, 500)
      );
    }
  } catch (error) {
    logger.error(`Error in generateArticlesFromTrends: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, error.message, 500)
    );
  }
}

/**
 * Get system statistics
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getStats(req, res) {
  try {
    // This would be implemented to gather statistics about articles, trends, etc.
    // For now, we return a placeholder response
    return res.json(formatResponse({
      message: 'Statistics endpoint',
      stats: {
        // This would be populated with real stats from the database
        placeholder: true
      }
    }));
  } catch (error) {
    logger.error(`Error in getStats: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, error.message, 500)
    );
  }
}
/**
 * Insert trends manually
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function insertTrends(req, res) {
  try {
    const { category, countryCode, trends } = req.body;
    
    // Validate params
    if (!category || !countryCode || !trends || !Array.isArray(trends) || trends.length === 0) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters: category, countryCode, trends (array)', 400)
      );
    }
    
    // Log action
    await User.logAction(
      req.user.id,
      `Insert trends: ${category}/${countryCode} (${trends.length} trends)`,
      req.ip,
      req.headers['user-agent']
    );
    
    try {
      // Store trends
      const storedCount = await trendsService.storeTrends(category, countryCode, trends);
      
      return res.json(formatResponse({
        message: 'Trends inserted successfully',
        submitted: trends.length,
        stored: storedCount,
        trends
      }));
    } catch (error) {
      logger.error(`Failed to insert trends: ${error.message}`);
      return res.status(500).json(
        formatResponse(null, `Failed to insert trends: ${error.message}`, 500)
      );
    }
  } catch (error) {
    logger.error(`Error in insertTrends: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, error.message, 500)
    );
  }
}

/**
 * Clean up old used trends
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function cleanupOldTrends(req, res) {
  try {
    const { olderThanDays = 30 } = req.body;
    
    // Log action
    await User.logAction(
      req.user.id,
      `Cleanup old trends: ${olderThanDays} days`,
      req.ip,
      req.headers['user-agent']
    );
    
    // Process each category and country
    const results = {};
    const constants = require('../config/constants');
    const countries = require('../config/countries');
    
    for (const category of constants.CATEGORIES) {
      results[category] = {};
      
      for (const country of countries) {
        try {
          const deletedCount = await Trend.deleteOldUsed(
            category,
            country.code,
            olderThanDays
          );
          
          results[category][country.code] = deletedCount;
        } catch (error) {
          logger.error(`Error cleaning up trends for ${category}/${country.code}: ${error.message}`);
          results[category][country.code] = `Error: ${error.message}`;
        }
      }
    }
    
    return res.json(formatResponse({
      message: 'Old trends cleanup completed',
      results
    }));
  } catch (error) {
    logger.error(`Error in cleanupOldTrends: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, error.message, 500)
    );
  }
}

// Add this to the exports at the bottom of the file
module.exports = {
  generateArticles,
  getTrends,
  fetchTrends,
  getStats,
  cleanupOldTrends,
  generateArticlesFromTrends,
  insertTrends
};