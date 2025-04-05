// controllers/articleController.js
const Article = require('../models/Article');
const { formatResponse } = require('../utils/responseFormatter');
const logger = require('../config/logger');
const { handleControllerError, withErrorHandling } = require('../utils/controllerUtils');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

/**
 * Get article by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getArticleById(req, res) {
  const { category, countryCode, id } = req.params;
  
  // Validate params
  if (!category || !countryCode || !id) {
    throw new ValidationError('Missing required parameters');
  }
  
  const article = await Article.getById(category, countryCode, id);
  
  if (!article) {
    throw new NotFoundError('Article not found');
  }
  
  return res.json(formatResponse(article));
}

/**
 * Get latest articles
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getLatestArticles(req, res) {
  const { category, countryCode } = req.params;
  const { limit = 10, offset = 0 } = req.query;
  
  // Validate params
  if (!category || !countryCode) {
    throw new ValidationError('Missing required parameters');
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
}

/**
 * Search articles
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function searchArticles(req, res) {
  const { category, countryCode } = req.params;
  const { query, limit = 10 } = req.query;
  
  // Validate params
  if (!category || !countryCode || !query) {
    throw new ValidationError('Missing required parameters');
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
}

/**
 * Update article (admin only)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function updateArticle(req, res) {
  const { category, countryCode, id } = req.params;
  const { title, content, image_url } = req.body;
  
  // Validate params
  if (!category || !countryCode || !id) {
    throw new ValidationError('Missing required parameters');
  }
  
  // Check if article exists
  const article = await Article.getById(category, countryCode, id);
  
  if (!article) {
    throw new NotFoundError('Article not found');
  }
  
  // Update article
  const updatedArticle = await Article.update(
    category,
    countryCode,
    id,
    { title, content, image_url }
  );
  
  return res.json(formatResponse(updatedArticle, 'Article updated successfully'));
}

/**
 * Delete article (admin only)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function deleteArticle(req, res) {
  const { category, countryCode, id } = req.params;
  
  // Validate params
  if (!category || !countryCode || !id) {
    throw new ValidationError('Missing required parameters');
  }
  
  // Check if article exists
  const article = await Article.getById(category, countryCode, id);
  
  if (!article) {
    throw new NotFoundError('Article not found');
  }
  
  // Delete article
  const success = await Article.delete(category, countryCode, id);
  
  if (success) {
    return res.json(formatResponse(null, 'Article deleted successfully'));
  } else {
    throw new Error('Failed to delete article');
  }
}

// Wrap all controller methods with standardized error handling
module.exports = {
  getArticleById: withErrorHandling(getArticleById, 'getArticleById'),
  getLatestArticles: withErrorHandling(getLatestArticles, 'getLatestArticles'),
  searchArticles: withErrorHandling(searchArticles, 'searchArticles'),
  updateArticle: withErrorHandling(updateArticle, 'updateArticle'),
  deleteArticle: withErrorHandling(deleteArticle, 'deleteArticle')
};