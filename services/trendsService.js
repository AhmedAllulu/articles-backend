// services/trendsService.js
const logger = require('../config/logger');
const db = require('../db/connections');
const constants = require('../config/constants');

class TrendsService {

/**
   * Fetch trending keywords from Google Trends API
   * @param {string} category - Category to fetch trends for
   * @param {string} countryCode - Country code to fetch trends for
   * @param {number} limit - Maximum number of trends to fetch
   * @returns {Promise<Array<string>>} Array of trending keywords
   */
async fetchTrendingKeywords(category, countryCode, limit = 20) {
  try {
    logger.info(`Fetching trending keywords for ${category}/${countryCode}`);

    // Get language for the country
    const language = getLanguageForCountry(countryCode);

    // Use google-trends-api to fetch related queries
    const response = await googleTrends.relatedQueries({
      keyword: category, // Map category to keyword
      geo: countryCode, // Country code for geographic targeting
      hl: language, // Language for results
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    });

    // Parse the JSON response
    const data = JSON.parse(response);

    // Process response based on google-trends-api structure
    if (data && data.default && data.default.rankedList) {
      const trends = data.default.rankedList[0].rankedKeyword // Top related queries
        .map(item => item.query) // Extract the keyword
        .slice(0, limit); // Apply limit
      logger.info(`Fetched ${trends.length} trending keywords for ${category}/${countryCode}`);
      return trends;
    }

    logger.warn(`No trends found for ${category}/${countryCode}`);
    return [];
  } catch (error) {
    // If we're in development mode, generate mock trends for testing
    if (process.env.NODE_ENV === 'development') {
      logger.warn(`Error fetching trends, using mock data: ${error.message}`);
      return this._generateMockTrends(category, countryCode, limit);
    }

    logger.error(`Error fetching trends for ${category}/${countryCode}: ${error.message}`);
    throw error;
  }
}
  /**
   * Store trends in the database
   * @param {string} category - Category of the trends
   * @param {string} countryCode - Country code
   * @param {Array<string>} trends - Array of trending keywords
   * @returns {Promise<number>} Number of trends stored
   */
  async storeTrends(category, countryCode, trends) {
    try {
      logger.info(`Storing ${trends.length} trends for ${category}/${countryCode}`);
      
      let storedCount = 0;
      for (const keyword of trends) {
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
      
      logger.info(`Stored ${storedCount} trends for ${category}/${countryCode}`);
      return storedCount;
    } catch (error) {
      logger.error(`Error storing trends for ${category}/${countryCode}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get unused trends from the database
   * @param {string} category - Category to fetch trends for
   * @param {string} countryCode - Country code to fetch trends for
   * @param {number} limit - Maximum number of trends to return
   * @returns {Promise<Array>} Array of unused trend keywords
   */
  async getUnusedTrends(category, countryCode, limit = 10) {
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
      
      return result.rows.map(row => ({
        id: row.id,
        keyword: row.keyword
      }));
    } catch (error) {
      logger.error(`Error fetching unused trends for ${category}/${countryCode}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Mark a trend as used
   * @param {string} category - Category of the trend
   * @param {string} countryCode - Country code
   * @param {number} trendId - ID of the trend to mark as used
   */
  async markTrendAsUsed(category, countryCode, trendId) {
    try {
      await db.query(
        category,
        countryCode,
        `UPDATE trends SET status = $1, used_at = NOW() WHERE id = $2`,
        [constants.TREND_STATUS.USED, trendId]
      );
      
      logger.info(`Marked trend ${trendId} as used for ${category}/${countryCode}`);
    } catch (error) {
      logger.error(`Error marking trend ${trendId} as used for ${category}/${countryCode}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new TrendsService();