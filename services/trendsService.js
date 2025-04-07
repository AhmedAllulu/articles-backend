// services/trendsService.js
const axios = require('axios');
const logger = require('../config/logger');
const db = require('../db/connections');
const constants = require('../config/constants');
const { getLanguageForCountry } = require('../utils/languageUtils');
const countries = require('../config/countries');

class TrendsService {
  /**
   * Fetch trending keywords from SerpAPI
   * @param {string} category - Category to fetch trends for
   * @param {string} countryCode - Country code to fetch trends for
   * @param {number} limit - Maximum number of trends to fetch
   * @returns {Promise<Object>} Object with fetched and stored counts
   */
  async fetchTrendingKeywords(category, countryCode, limit = 20) {
    try {
      logger.info(`Fetching trending keywords for ${category}/${countryCode} using SerpAPI`);
      
      // Get country and language information
      const country = countries.find(c => c.code === countryCode) || countries[0];
      const language = country.language || 'en';
      
      // Create search query based on category
      const searchQuery = this._createSearchQueryForCategory(category);
      
      // Make API call to SerpAPI
      const response = await axios.get(process.env.SERPAPI_URL, {
        params: {
          api_key: process.env.SERPAPI_API_KEY,
          q: searchQuery,
          gl: countryCode.toLowerCase(), // Country for Google search
          hl: language, // Language
          num: 30, // Get more results to extract keywords from
        },
        timeout: 15000 // 15 second timeout
      });
      
      // Extract keywords from SerpAPI response
      const keywords = this._extractKeywordsFromSerpResponse(response.data, category);
      
      // Limit the number of keywords
      const limitedKeywords = keywords.slice(0, limit);
      
      // Store keywords in database
      const storedCount = await this.storeTrends(category, countryCode, limitedKeywords);
      
      logger.info(`Successfully fetched ${limitedKeywords.length} keywords and stored ${storedCount} for ${category}/${countryCode}`);
      
      return {
        fetched: limitedKeywords.length,
        stored: storedCount,
        keywords: limitedKeywords
      };
    } catch (error) {
      logger.error(`Error fetching trends using SerpAPI: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Create search query based on category
   * @private
   * @param {string} category - Category to create query for
   * @returns {string} Search query
   */
  _createSearchQueryForCategory(category) {
    const categoryQueries = {
      tech: "latest technology trends news",
      sports: "trending sports news today",
      politics: "current political events trending",
      health: "trending health topics news",
      general: "trending news topics today"
    };
    
    return categoryQueries[category] || `trending ${category} news topics`;
  }
  
  /**
   * Extract keywords from SerpAPI response
   * @private
   * @param {Object} data - SerpAPI response data
   * @param {string} category - Category for context
   * @returns {Array<string>} Extracted keywords
   */
  _extractKeywordsFromSerpResponse(data, category) {
    const keywords = new Set();
    
    // Extract from organic results
    if (data.organic_results) {
      data.organic_results.forEach(result => {
        // Add title as potential keyword (after cleaning)
        if (result.title) {
          const cleanTitle = this._cleanKeyword(result.title, category);
          if (cleanTitle) keywords.add(cleanTitle);
        }
        
        // Extract from snippet if available
        if (result.snippet) {
          const phrases = this._extractPhrasesFromText(result.snippet);
          phrases.forEach(phrase => keywords.add(phrase));
        }
      });
    }
    
    // Extract from related searches if available
    if (data.related_searches) {
      data.related_searches.forEach(item => {
        if (item.query) {
          const cleanQuery = this._cleanKeyword(item.query, category);
          if (cleanQuery) keywords.add(cleanQuery);
        }
      });
    }
    
    // Extract from knowledge graph if available
    if (data.knowledge_graph && data.knowledge_graph.description) {
      const phrases = this._extractPhrasesFromText(data.knowledge_graph.description);
      phrases.forEach(phrase => keywords.add(phrase));
    }
    
    // Convert Set to Array and filter out any empty strings
    return Array.from(keywords).filter(Boolean);
  }
  
  /**
   * Clean keyword by removing category name and other noise
   * @private
   * @param {string} keyword - Raw keyword
   * @param {string} category - Category to remove from keyword
   * @returns {string} Cleaned keyword
   */
  _cleanKeyword(keyword, category) {
    if (!keyword) return '';
    
    // Remove the category name from the keyword
    let cleaned = keyword.toLowerCase()
      .replace(new RegExp(`\\b${category}\\b`, 'gi'), '')
      .replace(/news|latest|trending|update|today/gi, '')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .trim();
    
    // Remove extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Only return if it's not too short
    return cleaned.length > 3 ? cleaned : '';
  }
  
  /**
   * Extract meaningful phrases from text
   * @private
   * @param {string} text - Text to extract phrases from
   * @returns {Array<string>} Extracted phrases
   */
  _extractPhrasesFromText(text) {
    if (!text) return [];
    
    // Split text into sentences
    const sentences = text.split(/[.!?]+/);
    
    // Extract noun phrases (simplified approach)
    const phrases = [];
    sentences.forEach(sentence => {
      // Get 2-3 word combinations that might be meaningful
      const words = sentence.toLowerCase().split(/\s+/);
      
      // Extract 2-word phrases
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = words.slice(i, i + 2).join(' ');
        if (phrase.length > 5 && !/^\d+$/.test(phrase)) {
          phrases.push(phrase.trim());
        }
      }
      
      // Extract 3-word phrases
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = words.slice(i, i + 3).join(' ');
        if (phrase.length > 8 && !/^\d+$/.test(phrase)) {
          phrases.push(phrase.trim());
        }
      }
    });
    
    return phrases;
  }
  
  /**
   * Fetch and store trends for all categories and countries
   * @returns {Promise<Object>} Results of the operation
   */
  async fetchAndStoreAllTrends() {
    const results = {};
    
    logger.info('Starting to fetch trends for all categories and countries');
    
    for (const category of constants.CATEGORIES) {
      results[category] = {};
      
      for (const country of countries) {
        try {
          const result = await this.fetchTrendingKeywords(category, country.code);
          results[category][country.code] = result;
          
          // Add a short delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error(`Error fetching trends for ${category}/${country.code}: ${error.message}`);
          results[category][country.code] = { error: error.message };
        }
      }
    }
    
    logger.info('Completed fetching trends for all categories and countries');
    
    return {
      message: 'Trends fetched and stored for all categories and countries',
      results
    };
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