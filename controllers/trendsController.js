// controllers/trendsController.js
const Trend = require('../models/Trend');
const { formatResponse } = require('../utils/responseFormatter');
const logger = require('../config/logger');

/**
 * Get trending topics for public consumption
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getTrendingTopics(req, res) {
  try {
    const { category, countryCode } = req.params;
    const { limit = 10 } = req.query;
    
    // Validate params
    if (!category || !countryCode) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters', 400)
      );
    }
    
    // Get trends
    const trends = await Trend.getAll(
      category,
      countryCode,
      parseInt(limit, 10)
    );
    
    // Format for public consumption - only return keywords
    const trendKeywords = trends.map(trend => trend.keyword);
    
    return res.json(formatResponse({
      trends: trendKeywords,
      category,
      countryCode
    }));
  } catch (error) {
    logger.error(`Error in getTrendingTopics: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, 'Server error', 500)
    );
  }
}

/**
 * Get trend information by keyword
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getTrendByKeyword(req, res) {
  try {
    const { category, countryCode, keyword } = req.params;
    
    // Validate params
    if (!category || !countryCode || !keyword) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters', 400)
      );
    }
    
    // Query for the trend
    const db = require('../db/connections');
    const result = await db.query(
      category,
      countryCode,
      `SELECT * FROM trends WHERE keyword = $1`,
      [keyword]
    );
    
    const trend = result.rows[0];
    
    if (!trend) {
      return res.status(404).json(
        formatResponse(null, 'Trend not found', 404)
      );
    }
    
    // Query for articles with this trend
    const articlesResult = await db.query(
      category,
      countryCode,
      `SELECT id, title, SUBSTRING(content, 1, 200) as excerpt, created_at, image_url 
       FROM articles 
       WHERE trend_keyword = $1
       ORDER BY created_at DESC`,
      [keyword]
    );
    
    return res.json(formatResponse({
      trend,
      articles: articlesResult.rows,
      articlesCount: articlesResult.rowCount
    }));
  } catch (error) {
    logger.error(`Error in getTrendByKeyword: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, 'Server error', 500)
    );
  }
}

module.exports = {
  getTrendingTopics,
  getTrendByKeyword
};