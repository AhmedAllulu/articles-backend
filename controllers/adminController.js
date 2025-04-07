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
 * Fetch new trends from external API
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
      `Fetch trends for ${category}/${countryCode}`,
      req.ip,
      req.headers['user-agent']
    );
    
    // Fetch and store trends
    try {
      const result = await trendsService.fetchTrendingKeywords(category, countryCode);
      
      return res.json(formatResponse({
        message: 'Trends fetched and stored successfully',
        fetched: result.fetched,
        stored: result.stored,
        category,
        countryCode
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
 * Fetch trends for all categories and countries
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function fetchAllTrends(req, res) {
  try {
    // Log action
    await User.logAction(
      req.user.id,
      'Fetch trends for all categories and countries',
      req.ip,
      req.headers['user-agent']
    );
    
    // Fetch and store all trends
    try {
      const result = await trendsService.fetchAndStoreAllTrends();
      
      return res.json(formatResponse({
        message: 'All trends fetched and stored successfully',
        results: result.results
      }));
    } catch (error) {
      logger.error(`Failed to fetch all trends: ${error.message}`);
      return res.status(500).json(
        formatResponse(null, `Failed to fetch all trends: ${error.message}`, 500)
      );
    }
  } catch (error) {
    logger.error(`Error in fetchAllTrends: ${error.message}`);
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
// Updated insertTrends function in controllers/adminController.js
/**
 * Insert trends manually for a selected category and country
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function insertTrends(req, res) {
  try {
    const { category, countryCode, trends } = req.body;
    const constants = require('../config/constants');
    const countries = require('../config/countries');
    
    // Validate required parameters
    if (!category || !countryCode) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters: category, countryCode', 400)
      );
    }
    
    // Validate trends array
    if (!trends || !Array.isArray(trends) || trends.length === 0) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameter: trends (array)', 400)
      );
    }
    
    // Validate category
    if (!constants.CATEGORIES.includes(category)) {
      return res.status(400).json(
        formatResponse(null, `Invalid category: ${category}. Available options: ${constants.CATEGORIES.join(', ')}`, 400)
      );
    }
    
    // Validate country code
    if (!countries.some(c => c.code === countryCode)) {
      return res.status(400).json(
        formatResponse(null, `Invalid country code: ${countryCode}. Available options: ${countries.map(c => c.code).join(', ')}`, 400)
      );
    }
    
    // Log action
    await User.logAction(
      req.user.id,
      `Insert trends for ${category}/${countryCode} (${trends.length} trends)`,
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
        category,
        countryCode,
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
 * Get available categories and countries for trend operations
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getTrendOptions(req, res) {
  try {
    const constants = require('../config/constants');
    return res.json(formatResponse({
      categories: constants.CATEGORIES.map(category => ({
        value: category,
        label: category.charAt(0).toUpperCase() + category.slice(1),
        website: constants.WEBSITES[category]
      })),
      countries: countries.map(country => ({
        value: country.code,
        label: country.country,
        language: country.language
      }))
    }));
  } catch (error) {
    logger.error(`Error in getTrendOptions: ${error.message}`);
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
  fetchAllTrends,
  generateArticles,
  getTrends,
  fetchTrends,
  getStats,
  cleanupOldTrends,
  generateArticlesFromTrends,
  insertTrends,
  getTrendOptions
};