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
 * Fetch new trends
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function fetchTrends(req, res) {
  try {
    const { category, countryCode } = req.body;
    
    // Validate params
    if (!category || !countryCode) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters: category, countryCode', 400)
      );
    }
    
    // Log action
    await User.logAction(
      req.user.id,
      `Fetch trends: ${category}/${countryCode}`,
      req.ip,
      req.headers['user-agent']
    );
    
    try {
      // Fetch trends
      const trends = await trendsService.fetchTrendingKeywords(category, countryCode);
      
      if (trends.length === 0) {
        return res.json(formatResponse({
          message: 'No trends fetched',
          count: 0
        }));
      }
      
      // Store trends
      const storedCount = await Trend.storeMultiple(category, countryCode, trends);
      
      return res.json(formatResponse({
        message: 'Trends fetched and stored successfully',
        fetched: trends.length,
        stored: storedCount,
        trends
      }));
    } catch (error) {
      logger.error(`Failed to fetch trends: ${error.message}`);
      return res.status(500).json(
        formatResponse(null, `Failed to fetch trends: ${error.message}`, 500)
      );
    }
  } catch (error) {
    logger.error(`Error in fetchTrends: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, error.message, 500)
    );
  }
}

/**
 * Generate articles by fetching trends first, then generating articles
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
      `Generate articles from trends: ${category}/${countryCode} (${count})`,
      req.ip,
      req.headers['user-agent']
    );
    
    try {
      // Step 1: Fetch new trends
      logger.info(`Fetching trends for ${category}/${countryCode}`);
      const trends = await trendsService.fetchTrendingKeywords(category, countryCode);
      
      if (trends.length === 0) {
        return res.json(formatResponse({
          message: 'No trends fetched, cannot generate articles',
          count: 0
        }));
      }
      
      // Step 2: Store fetched trends
      const storedCount = await trendsService.storeTrends(category, countryCode, trends);
      logger.info(`Stored ${storedCount} new trends for ${category}/${countryCode}`);
      
      // Step 3: Generate articles
      const result = await generationService.generateArticlesForCategoryAndCountry(
        category,
        countryCode,
        parseInt(count, 10)
      );
      
      return res.json(formatResponse({
        message: 'Trends fetched and articles generated successfully',
        trends: {
          fetched: trends.length,
          stored: storedCount,
          used: result.count,
          keywords: result.keywords || []
        },
        articles: {
          count: result.count,
          message: result.message
        }
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

module.exports = {
  generateArticles,
  getTrends,
  fetchTrends,
  getStats,
  cleanupOldTrends,
  generateArticlesFromTrends
};