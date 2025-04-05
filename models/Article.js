// models/Article.js
const db = require('../db/connections');
const logger = require('../config/logger');

class Article {
  /**
   * Get article by ID
   * @param {string} category - Category of the article
   * @param {string} countryCode - Country code 
   * @param {number} id - Article ID
   * @returns {Promise<Object>} Article object
   */
  static async getById(category, countryCode, id) {
    try {
      const result = await db.query(
        category,
        countryCode,
        `SELECT * FROM articles WHERE id = $1`,
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error fetching article by ID ${id}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get latest articles
   * @param {string} category - Category of articles
   * @param {string} countryCode - Country code
   * @param {number} limit - Maximum number of articles to return
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Array>} Array of article objects
   */
  static async getLatest(category, countryCode, limit = 10, offset = 0) {
    try {
      const result = await db.query(
        category,
        countryCode,
        `SELECT id, title, SUBSTRING(content, 1, 200) as excerpt, 
         created_at, trend_keyword, image_url, language 
         FROM articles 
         ORDER BY created_at DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching latest articles: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Search articles by keyword
   * @param {string} category - Category of articles
   * @param {string} countryCode - Country code
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of articles to return
   * @returns {Promise<Array>} Array of article objects
   */
  static async search(category, countryCode, query, limit = 10) {
    try {
      const result = await db.query(
        category,
        countryCode,
        `SELECT id, title, SUBSTRING(content, 1, 200) as excerpt, 
         created_at, trend_keyword, image_url
         FROM articles 
         WHERE title ILIKE $1 OR content ILIKE $1 OR trend_keyword ILIKE $1
         ORDER BY created_at DESC 
         LIMIT $2`,
        [`%${query}%`, limit]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error searching articles: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Create a new article
   * @param {string} category - Category of the article
   * @param {string} countryCode - Country code
   * @param {Object} articleData - Article data
   * @returns {Promise<Object>} Created article object
   */
  static async create(category, countryCode, articleData) {
    try {
      const { title, content, trend_keyword, language, image_url } = articleData;
      
      const result = await db.query(
        category,
        countryCode,
        `INSERT INTO articles (title, content, trend_keyword, language, image_url) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [title, content, trend_keyword, language, image_url]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating article: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update an article
   * @param {string} category - Category of the article
   * @param {string} countryCode - Country code
   * @param {number} id - Article ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated article object
   */
  static async update(category, countryCode, id, updateData) {
    try {
      const { title, content, image_url } = updateData;
      
      const result = await db.query(
        category,
        countryCode,
        `UPDATE articles 
         SET title = COALESCE($1, title), 
             content = COALESCE($2, content),
             image_url = COALESCE($3, image_url),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [title, content, image_url, id]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error updating article ${id}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Delete an article
   * @param {string} category - Category of the article
   * @param {string} countryCode - Country code
   * @param {number} id - Article ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async delete(category, countryCode, id) {
    try {
      const result = await db.query(
        category,
        countryCode,
        `DELETE FROM articles WHERE id = $1 RETURNING id`,
        [id]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting article ${id}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get article count
   * @param {string} category - Category of articles
   * @param {string} countryCode - Country code
   * @returns {Promise<number>} Count of articles
   */
  static async getCount(category, countryCode) {
    try {
      const result = await db.query(
        category,
        countryCode,
        `SELECT COUNT(*) as count FROM articles`,
        []
      );
      
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error(`Error counting articles: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Article;