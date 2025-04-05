// models/Trend.js
const db = require('../db/connections');
const logger = require('../config/logger');
const constants = require('../config/constants');

class Trend {
  /**
   * Get all trends for a category and country
   * @param {string} category - Category of trends
   * @param {string} countryCode - Country code
   * @param {number} limit - Maximum number of trends to return
   * @param {string} status - Optional status filter
   * @returns {Promise<Array>} Array of trend objects
   */
  static async getAll(category, countryCode, limit = 100, status = null) {
    try {
      let query = `SELECT * FROM trends`;
      const params = [];
      
      if (status) {
        query += ` WHERE status = $1`;
        params.push(status);
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      
      const result = await db.query(category, countryCode, query, params);
      
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching trends for ${category}/${countryCode}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get unused trends
   * @param {string} category - Category of trends
   * @param {string} countryCode - Country code
   * @param {number} limit - Maximum number of trends to return
   * @returns {Promise<Array>} Array of unused trend objects
   */
  static async getUnused(category, countryCode, limit = 10) {
    try {
      const result = await db.query(
        category,
        countryCode,
        `SELECT id, keyword FROM trends 
         WHERE status = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [constants.TREND_STATUS.NOT_USED, limit]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching unused trends for ${category}/${countryCode}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Mark a trend as used
   * @param {string} category - Category of the trend
   * @param {string} countryCode - Country code
   * @param {number} id - ID of the trend
   * @returns {Promise<Object>} Updated trend object
   */
  static async markAsUsed(category, countryCode, id) {
    try {
      const result = await db.query(
        category,
        countryCode,
        `UPDATE trends 
         SET status = $1, used_at = NOW() 
         WHERE id = $2
         RETURNING *`,
        [constants.TREND_STATUS.USED, id]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error marking trend ${id} as used: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Store multiple trends
   * @param {string} category - Category of trends
   * @param {string} countryCode - Country code
   * @param {Array<string>} keywords - Array of trend keywords
   * @returns {Promise<number>} Number of trends stored
   */
  static async storeMultiple(category, countryCode, keywords) {
    try {
      let storedCount = 0;
      
      for (const keyword of keywords) {
        const result = await db.query(
          category,
          countryCode,
          `INSERT INTO trends (keyword, status) 
           VALUES ($1, $2)
           ON CONFLICT (keyword) DO NOTHING
           RETURNING id`,
          [keyword, constants.TREND_STATUS.NOT_USED]
        );
        
        if (result.rowCount > 0) {
          storedCount++;
        }
      }
      
      return storedCount;
    } catch (error) {
      logger.error(`Error storing trends for ${category}/${countryCode}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Delete old used trends
   * @param {string} category - Category of trends
   * @param {string} countryCode - Country code
   * @param {number} olderThanDays - Delete trends older than this many days
   * @returns {Promise<number>} Number of trends deleted
   */
  static async deleteOldUsed(category, countryCode, olderThanDays = 30) {
    try {
      const result = await db.query(
        category,
        countryCode,
        `DELETE FROM trends
         WHERE status = $1 
         AND used_at < NOW() - INTERVAL '${olderThanDays} days'
         RETURNING id`,
        [constants.TREND_STATUS.USED]
      );
      
      return result.rowCount;
    } catch (error) {
      logger.error(`Error deleting old trends for ${category}/${countryCode}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Trend;