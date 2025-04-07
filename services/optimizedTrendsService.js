// services/optimizedTrendsService.js
const axios = require('axios');
const logger = require('../config/logger');
const db = require('../db/connections');
const constants = require('../config/constants');
const { getLanguageForCountry } = require('../utils/languageUtils');
const countries = require('../config/countries');
const apiQuotaManager = require('./apiQuotaManager');

class OptimizedTrendsService {
  /**
   * Fetch trending keywords with quota management
   * @param {string} category - Category to fetch trends for
   * @param {string} countryCode - Country code to fetch trends for
   * @param {number} limit - Maximum number of trends to fetch
   * @returns {Promise<Object>} Object with fetched and stored counts
   */
  async fetchTrendingKeywords(category, countryCode, limit = 20) {
    try {
      // Check if we should fetch new trends or use existing ones
      const shouldFetch = await apiQuotaManager.shouldFetchNewTrends(category, countryCode);
      
      if (!shouldFetch) {
        // Return existing trends instead
        const existingTrends = await this.getUnusedTrends(category, countryCode);
        return {
          fetched: 0,
          stored: 0,
          existing: existingTrends.length,
          keywords: existingTrends.map(t => t.keyword),
          source: 'existing'
        };
      }
      
      // Get the next available API key
      const apiKey = apiQuotaManager.getNextApiKey();
      
      if (!apiKey) {
        logger.warn(`No API keys available for ${category}/${countryCode}. All quotas exhausted.`);
        
        // If no keys available, try to share trends from other countries
        const sharedCount = await apiQuotaManager.shareTrendsBetweenCountries();
        
        if (sharedCount > 0) {
          logger.info(`Shared ${sharedCount} trends between countries as fallback`);
          
          // Return existing trends after sharing
          const existingTrends = await this.getUnusedTrends(category, countryCode);
          return {
            fetched: 0,
            stored: 0,
            existing: existingTrends.length,
            shared: sharedCount,
            keywords: existingTrends.map(t => t.keyword),
            source: 'shared'
          };
        }
        
        throw new Error('API quota exhausted and no trends available to share');
      }
      
      logger.info(`Fetching trending keywords for ${category}/${countryCode} using SerpAPI (key: ${apiKey.substring(0, 8)}...)`);
      
      // Get country and language information
      const country = countries.find(c => c.code === countryCode) || countries[0];
      const language = country.language || 'en';
      
      // Create search query based on category
      const searchQuery = this._createSearchQueryForCategory(category);
      
      // Make API call to SerpAPI
      const response = await axios.get(process.env.SERPAPI_URL, {
        params: {
          api_key: apiKey,
          q: searchQuery,
          gl: countryCode.toLowerCase(), // Country for Google search
          hl: language, // Language
          num: 30, // Get more results to extract keywords from
        },
        timeout: 15000 // 15 second timeout
      });
      
      // Record API usage
      await apiQuotaManager.recordApiUsage(apiKey);
      
      // Record that this combination was updated
      apiQuotaManager.recordCombinationUpdate(category, countryCode);
      
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
        keywords: limitedKeywords,
        source: 'api'
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
    // Create different query variations to get better diversity
    const categoryQueries = {
      tech: [
        "latest technology trends news",
        "trending tech innovations",
        "new technology developments",
        "popular tech news this week",
        "breakthrough technology stories"
      ],
      sports: [
        "trending sports news today",
        "popular sports stories this week",
        "major sports events happening now",
        "trending athletes news",
        "sports headlines today"
      ],
      politics: [
        "current political events trending",
        "major political news stories",
        "trending government policies",
        "politics headlines this week",
        "important political developments"
      ],
      health: [
        "trending health topics news",
        "latest medical research breakthroughs",
        "health innovations trending now",
        "popular wellness topics",
        "important health discoveries"
      ],
      general: [
        "trending news topics today",
        "popular current events",
        "viral news stories this week",
        "most discussed news topics",
        "trending social issues"
      ]
    };
    
    // Get array of queries for this category, or fallback
    const queries = categoryQueries[category] || [`trending ${category} news topics`];
    
    // Pick a random query from the array to get variety
    const randomIndex = Math.floor(Math.random() * queries.length);
    return queries[randomIndex];
  }
  
  // [Rest of methods as in original TrendsService]
  
  /**
   * Run an optimized fetch of trends for all categories and countries
   * Prioritizes combinations based on need and API quota availability
   * @param {number} maxFetches - Maximum number of API calls to make
   * @returns {Promise<Object>} Results of the operation
   */
  async fetchOptimizedTrends(maxFetches = 10) {
    const results = {};
    let fetchCount = 0;
    
    logger.info(`Starting optimized trend fetching (max ${maxFetches} API calls)`);
    
    // First, try to share trends between countries to reduce API calls
    const sharedCount = await apiQuotaManager.shareTrendsBetweenCountries();
    
    if (sharedCount > 0) {
      logger.info(`Shared ${sharedCount} trends between countries`);
    }
    
    // Get combinations to update based on priority
    const combinationsToUpdate = await apiQuotaManager.getNextCombinationsToUpdate(maxFetches);
    
    if (combinationsToUpdate.length === 0) {
      logger.warn('No combinations selected for update - API quota may be exhausted');
      return {
        message: 'No combinations selected for update',
        fetches: 0,
        results: {}
      };
    }
    
    // Fetch trends for selected combinations
    for (const { category, countryCode } of combinationsToUpdate) {
      try {
        logger.info(`Fetching trends for ${category}/${countryCode} (priority selected)`);
        
        const result = await this.fetchTrendingKeywords(category, countryCode);
        
        // Only increment fetch count if we actually used the API
        if (result.source === 'api') {
          fetchCount++;
        }
        
        if (!results[category]) {
          results[category] = {};
        }
        
        results[category][countryCode] = result;
        
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error(`Error fetching trends for ${category}/${countryCode}: ${error.message}`);
        
        if (!results[category]) {
          results[category] = {};
        }
        
        results[category][countryCode] = { error: error.message };
      }
    }
    
    logger.info(`Completed optimized trend fetching. Made ${fetchCount} API calls.`);
    
    return {
      message: `Optimized trends fetched for ${combinationsToUpdate.length} combinations`,
      fetches: fetchCount,
      combinationsSelected: combinationsToUpdate,
      results
    };
  }
  
  /**
   * Create a monthly trend fetching schedule
   * This divides our monthly quota across all combinations
   * @returns {Object} Schedule information
   */
  createMonthlySchedule() {
    const constants = require('../config/constants');
    const countries = require('../config/countries');
    
    // Calculate total combinations
    const totalCombinations = constants.CATEGORIES.length * countries.length;
    
    // Allocate API calls per month (180 out of 200, reserving 20 for unexpected needs)
    const monthlyApiCalls = 180;
    
    // Determine how many times we can refresh each combination per month
    const refreshesPerCombination = Math.floor(monthlyApiCalls / totalCombinations);
    
    // Calculate days between refreshes (assuming 30-day month)
    const daysBetweenRefreshes = Math.floor(30 / refreshesPerCombination);
    
    // Calculate leftover API calls for priority combinations
    const leftoverCalls = monthlyApiCalls - (totalCombinations * refreshesPerCombination);
    
    // Create schedule
    const schedule = {
      totalCombinations,
      monthlyApiCalls,
      refreshesPerCombination,
      daysBetweenRefreshes,
      leftoverCalls,
      message: `Each combination will be refreshed approximately every ${daysBetweenRefreshes} days, with ${leftoverCalls} extra calls for priority combinations`
    };
    
    return schedule;
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
  
  // Include other methods from original trendsService
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
}

module.exports = new OptimizedTrendsService();