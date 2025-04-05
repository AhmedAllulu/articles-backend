// controllers/articleController.js
const Article = require('../models/Article');
const { formatResponse } = require('../utils/responseFormatter');
const logger = require('../config/logger');

/**
 * Get article by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getArticleById(req, res) {
  try {
    const { category, countryCode, id } = req.params;
    
    // Validate params
    if (!category || !countryCode || !id) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters', 400)
      );
    }
    
    const article = await Article.getById(category, countryCode, id);
    
    if (!article) {
      return res.status(404).json(
        formatResponse(null, 'Article not found', 404)
      );
    }
    
    return res.json(formatResponse(article));
  } catch (error) {
    logger.error(`Error in getArticleById: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, 'Server error', 500)
    );
  }
}

/**
 * Get latest articles
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getLatestArticles(req, res) {
  try {
    const { category, countryCode } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    // Validate params
    if (!category || !countryCode) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters', 400)
      );
    }
    
    // Get articles
    const articles = await Article.getLatest(
      category, 
      countryCode, 
      parseInt(limit, 10), 
      parseInt(offset, 10)
    );
    
    // Get total count for pagination
    const total = await Article.getCount(category, countryCode);
    
    return res.json(formatResponse({
      articles,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        hasMore: parseInt(offset, 10) + articles.length < total
      }
    }));
  } catch (error) {
    logger.error(`Error in getLatestArticles: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, 'Server error', 500)
    );
  }
}

/**
 * Search articles
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function searchArticles(req, res) {
  try {
    const { category, countryCode } = req.params;
    const { query, limit = 10 } = req.query;
    
    // Validate params
    if (!category || !countryCode || !query) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters', 400)
      );
    }
    
    const articles = await Article.search(
      category, 
      countryCode, 
      query, 
      parseInt(limit, 10)
    );
    
    return res.json(formatResponse({
      articles,
      query,
      count: articles.length
    }));
  } catch (error) {
    logger.error(`Error in searchArticles: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, 'Server error', 500)
    );
  }
}

/**
 * Update article (admin only)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function updateArticle(req, res) {
  try {
    const { category, countryCode, id } = req.params;
    const { title, content, image_url } = req.body;
    
    // Validate params
    if (!category || !countryCode || !id) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters', 400)
      );
    }
    
    // Check if article exists
    const article = await Article.getById(category, countryCode, id);
    
    if (!article) {
      return res.status(404).json(
        formatResponse(null, 'Article not found', 404)
      );
    }
    
    // Update article
    const updatedArticle = await Article.update(
      category,
      countryCode,
      id,
      { title, content, image_url }
    );
    
    return res.json(formatResponse(updatedArticle, 'Article updated successfully'));
  } catch (error) {
    logger.error(`Error in updateArticle: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, 'Server error', 500)
    );
  }
}

/**
 * Delete article (admin only)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function deleteArticle(req, res) {
  try {
    const { category, countryCode, id } = req.params;
    
    // Validate params
    if (!category || !countryCode || !id) {
      return res.status(400).json(
        formatResponse(null, 'Missing required parameters', 400)
      );
    }
    
    // Check if article exists
    const article = await Article.getById(category, countryCode, id);
    
    if (!article) {
      return res.status(404).json(
        formatResponse(null, 'Article not found', 404)
      );
    }
    
    // Delete article
    const success = await Article.delete(category, countryCode, id);
    
    if (success) {
      return res.json(formatResponse(null, 'Article deleted successfully'));
    } else {
      return res.status(500).json(
        formatResponse(null, 'Failed to delete article', 500)
      );
    }
  } catch (error) {
    logger.error(`Error in deleteArticle: ${error.message}`);
    return res.status(500).json(
      formatResponse(null, 'Server error', 500)
    );
  }
}

module.exports = {
  getArticleById,
  getLatestArticles,
  searchArticles,
  updateArticle,
  deleteArticle
};