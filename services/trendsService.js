// services/trendsService.js
const axios = require('axios');
const logger = require('../config/logger');
const countries = require('../config/countries');
const db = require('../db/connections');
const constants = require('../config/constants');
const googleTrends = require('google-trends-api'); // Consider adding this package for direct Google Trends access

class TrendsService {
  /**
   * Fetch trending keywords for a specific category and country
   * @param {string} category - Category to fetch trends for
   * @param {string} countryCode - Country code to fetch trends for
   * @returns {Promise<Array>} Array of trending keywords
   */
  async fetchTrendingKeywords(category, countryCode) {
    try {
      logger.info(`Fetching trends for ${category} in ${countryCode}`);
      
      // Approach 1: Using SerpAPI (if you've subscribed to their service)
      if (process.env.TRENDS_API_KEY && process.env.TRENDS_API_URL) {
        return await this._fetchTrendsUsingSerpApi(category, countryCode);
      }
      
      // Approach 2: Using the google-trends-api package (no API key required)
      return await this._fetchTrendsUsingGoogleTrendsApi(category, countryCode);
    } catch (error) {
      logger.error(`Error fetching trends for ${category}/${countryCode}: ${error.message}`);
      
      // Remove fallback to mock trends and just throw the error
      throw error;
    }
  }
  
  /**
   * Fetch trends using SerpAPI
   * @private
   * @param {string} category - Category to fetch trends for
   * @param {string} countryCode - Country code to fetch trends for
   * @returns {Promise<Array>} Array of trending keywords
   */
  async _fetchTrendsUsingSerpApi(category, countryCode) {
    try {
      const response = await axios.get(
        process.env.TRENDS_API_URL,
        {
          params: {
            api_key: process.env.TRENDS_API_KEY,
            category: this._mapCategoryToGoogleTrendsCategory(category),
            geo: countryCode,
            hl: countries.find(c => c.code === countryCode).language
          }
        }
      );
      
      if (response.data && response.data.interest_over_time && response.data.interest_over_time.topics) {
        const trends = response.data.interest_over_time.topics.map(topic => topic.title);
        logger.info(`Fetched ${trends.length} trends for ${category}/${countryCode} using SerpAPI`);
        return trends;
      }
      
      throw new Error(`No trends found for ${category}/${countryCode} using SerpAPI`);
    } catch (error) {
      logger.error(`Error fetching trends using SerpAPI: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Fetch trends using google-trends-api package
   * @private
   * @param {string} category - Category to fetch trends for
   * @param {string} countryCode - Country code to fetch trends for
   * @returns {Promise<Array>} Array of trending keywords
   */
  async _fetchTrendsUsingGoogleTrendsApi(category, countryCode) {
    try {
      // Using the google-trends-api package
      // Make sure to add this package: npm install google-trends-api
      
      // Map our category to Google Trends category
      const googleCategory = this._mapCategoryToGoogleTrendsCategory(category);
      
      // Get language based on country code
      const language = countries.find(c => c.code === countryCode).language;
      
      // Get daily trends
      const result = await googleTrends.dailyTrends({
        geo: countryCode,
        hl: language,
        category: googleCategory
      });
      
      const trendData = JSON.parse(result);
      
      if (trendData && trendData.default && trendData.default.trendingSearchesDays) {
        // Extract trending topics
        const trends = [];
        
        for (const day of trendData.default.trendingSearchesDays) {
          for (const search of day.trendingSearches) {
            trends.push(search.title.query);
          }
        }
        
        // Return unique trends
        const uniqueTrends = [...new Set(trends)];
        logger.info(`Fetched ${uniqueTrends.length} trends for ${category}/${countryCode} using google-trends-api`);
        
        if (uniqueTrends.length === 0) {
          throw new Error(`No trends found for ${category}/${countryCode} using google-trends-api`);
        }
        
        return uniqueTrends.slice(0, 20); // Limit to top 20
      }
      
      throw new Error(`Invalid response from google-trends-api for ${category}/${countryCode}`);
    } catch (error) {
      logger.error(`Error fetching trends using google-trends-api: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Map our categories to Google Trends categories
   * @private
   * @param {string} category - Our internal category
   * @returns {number} Google Trends category ID
   */
  _mapCategoryToGoogleTrendsCategory(category) {
    // Google Trends category mapping
    // See: https://github.com/pat310/google-trends-api/wiki/Google-Trends-Categories
    const categoryMap = {
      tech: 't',        // Tech category
      sports: 's',      // Sports category
      politics: 'n',    // News category
      health: 'h',      // Health category
      general: 'all'    // All categories
    };
    
    return categoryMap[category] || 'all';
  }
  
  // Removed _getMockTrendsForCategory method as it should not be used
  
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