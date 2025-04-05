// services/articleService.js
const Article = require('../models/Article');
const logger = require('../config/logger');
const imageService = require('./imageService');
const deepSeekService = require('./deepSeekService');
const { getLanguageForCountry } = require('../utils/languageUtils');

class ArticleService {
  /**
   * Create a new article
   * @param {string} category - Article category
   * @param {string} countryCode - Country code
   * @param {Object} articleData - Article data
   * @returns {Promise<Object>} Created article
   */
  async createArticle(category, countryCode, articleData) {
    try {
      logger.info(`Creating article in ${category}/${countryCode}`);
      
      // Generate image if not provided
      if (!articleData.image_url) {
        articleData.image_url = await imageService.generateImage(
          articleData.trend_keyword,
          articleData.title,
          articleData.language
        );
      }
      
      // Create article
      const article = await Article.create(category, countryCode, articleData);
      
      logger.info(`Article created: ${article.id}`);
      return article;
    } catch (error) {
      logger.error(`Error creating article: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate article from keyword
   * @param {string} category - Article category
   * @param {string} countryCode - Country code
   * @param {string} keyword - Keyword to generate article about
   * @returns {Promise<Object>} Generated article
   */
  async generateArticleFromKeyword(category, countryCode, keyword) {
    try {
      logger.info(`Generating article for ${category}/${countryCode}/${keyword}`);
      
      // Get language for country
      const language = getLanguageForCountry(countryCode);
      
      // Generate article using DeepSeek
      const generatedArticle = await deepSeekService.generateArticle(
        keyword,
        language,
        countryCode
      );
      
      // Generate image for article
      const imageUrl = await imageService.generateImage(
        keyword,
        generatedArticle.title,
        language
      );
      
      // Create article in database
      const articleData = {
        title: generatedArticle.title,
        content: generatedArticle.content,
        trend_keyword: keyword,
        language: language,
        image_url: imageUrl
      };
      
      const article = await this.createArticle(category, countryCode, articleData);
      
      logger.info(`Article generated and stored for ${category}/${countryCode}/${keyword}`);
      return article;
    } catch (error) {
      logger.error(`Error generating article for ${category}/${countryCode}/${keyword}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Refresh image for an article
   * @param {string} category - Article category
   * @param {string} countryCode - Country code
   * @param {number} articleId - Article ID
   * @returns {Promise<Object>} Updated article
   */
  async refreshArticleImage(category, countryCode, articleId) {
    try {
      const article = await Article.getById(category, countryCode, articleId);
      
      if (!article) {
        throw new Error(`Article not found: ${articleId}`);
      }
      
      // Generate new image
      const imageUrl = await imageService.generateImage(
        article.trend_keyword,
        article.title,
        article.language
      );
      
      // Update article with new image
      const updatedArticle = await Article.update(
        category,
        countryCode,
        articleId,
        { image_url: imageUrl }
      );
      
      logger.info(`Image refreshed for article ${articleId}`);
      return updatedArticle;
    } catch (error) {
      logger.error(`Error refreshing article image: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get latest articles with pagination
   * @param {string} category - Article category
   * @param {string} countryCode - Country code
   * @param {number} limit - Maximum number of articles
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Object>} Articles and pagination metadata
   */
  async getLatestArticles(category, countryCode, limit = 10, offset = 0) {
    try {
      const articles = await Article.getLatest(
        category,
        countryCode,
        limit,
        offset
      );
      
      const totalCount = await Article.getCount(category, countryCode);
      
      return {
        articles,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + articles.length < totalCount
        }
      };
    } catch (error) {
      logger.error(`Error getting latest articles: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Search articles
   * @param {string} category - Article category
   * @param {string} countryCode - Country code
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Matching articles
   */
  async searchArticles(category, countryCode, query, limit = 10) {
    try {
      return await Article.search(category, countryCode, query, limit);
    } catch (error) {
      logger.error(`Error searching articles: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ArticleService();