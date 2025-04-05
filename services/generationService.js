// services/generationService.js
const logger = require('../config/logger');
const trendsService = require('./trendsService');
const deepSeekService = require('./deepSeekService');
const db = require('../db/connections');
const constants = require('../config/constants');
const countries = require('../config/countries');

class GenerationService {
  /**
   * Generate articles for all categories and countries
   * @param {Object} options - Generation options
   * @param {boolean} options.forceDevelopment - Force generation regardless of discount hours
   * @returns {Promise<Object>} Generation statistics
   */
  async generateArticlesForAll(options = {}) {
    const stats = {
      total: 0,
      successful: 0,
      failed: 0,
      byCategory: {}
    };
    
    // Check if we're in discount hours unless forceDevelopment is true
    if (!options.forceDevelopment) {
      const now = new Date();
      const hour = now.getHours();
      const isDiscountHour = hour >= constants.DEEPSEEK_DISCOUNT_START && hour < constants.DEEPSEEK_DISCOUNT_END;
      
      if (!isDiscountHour) {
        logger.info('Not in discount hours. Skipping generation. Use forceDevelopment=true to override.');
        return { message: 'Skipped - Not in discount hours', stats };
      }
    }
    
    logger.info('Starting article generation for all categories and countries');
    
    // Process each category
    for (const category of constants.CATEGORIES) {
      stats.byCategory[category] = {
        total: 0,
        successful: 0,
        failed: 0
      };
      
      // Process each country
      for (const country of countries) {
        try {
          // Step 1: Fetch trends if needed
          await this._ensureTrendsExist(category, country.code);
          
          // Step 2: Get unused trends
          const unusedTrends = await trendsService.getUnusedTrends(category, country.code, 5);
          
          if (unusedTrends.length === 0) {
            logger.info(`No unused trends for ${category}/${country.code}. Skipping.`);
            continue;
          }
          
          // Step 3: Generate articles for each trend
          for (const trend of unusedTrends) {
            stats.total++;
            stats.byCategory[category].total++;
            
            try {
              await this._generateArticleForTrend(category, country, trend);
              
              stats.successful++;
              stats.byCategory[category].successful++;
            } catch (error) {
              stats.failed++;
              stats.byCategory[category].failed++;
              logger.error(`Failed to generate article for ${category}/${country.code}/${trend.keyword}: ${error.message}`);
            }
          }
        } catch (error) {
          logger.error(`Error processing ${category}/${country.code}: ${error.message}`);
        }
      }
    }
    
    logger.info(`Article generation completed. Stats: ${JSON.stringify(stats)}`);
    return { message: 'Generation completed', stats };
  }
  
  /**
   * Generate an article for a single trend
   * @private
   * @param {string} category - Category
   * @param {Object} country - Country object
   * @param {Object} trend - Trend object
   */
  async _generateArticleForTrend(category, country, trend) {
    try {
      logger.info(`Generating article for ${category}/${country.code}/${trend.keyword}`);
      
      // Generate article using DeepSeek
      const article = await deepSeekService.generateArticle(
        trend.keyword,
        country.language,
        country.code
      );
      
      // Store the article in the database
      await db.query(
        category,
        country.code,
        `INSERT INTO articles (title, content, trend_keyword, language) 
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [article.title, article.content, trend.keyword, country.language]
      );
      
      // Mark the trend as used
      await trendsService.markTrendAsUsed(category, country.code, trend.id);
      
      logger.info(`Successfully generated and stored article for ${category}/${country.code}/${trend.keyword}`);
    } catch (error) {
      logger.error(`Error generating article for ${category}/${country.code}/${trend.keyword}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Ensure trends exist in the database, fetch if needed
   * @private
   * @param {string} category - Category
   * @param {string} countryCode - Country code
   */
  async _ensureTrendsExist(category, countryCode) {
    try {
      // Check if we have unused trends
      const unusedTrends = await trendsService.getUnusedTrends(category, countryCode, 1);
      
      // If we don't have any unused trends, fetch new ones
      if (unusedTrends.length === 0) {
        logger.info(`No unused trends for ${category}/${countryCode}. Fetching new trends.`);
        
        const trends = await trendsService.fetchTrendingKeywords(category, countryCode);
        
        if (trends.length > 0) {
          await trendsService.storeTrends(category, countryCode, trends);
          logger.info(`Fetched and stored ${trends.length} new trends for ${category}/${countryCode}`);
        } else {
          logger.warn(`No trends fetched for ${category}/${countryCode}`);
        }
      }
    } catch (error) {
      logger.error(`Error ensuring trends for ${category}/${countryCode}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate articles for a specific category and country
   * Useful for development and testing
   * @param {string} category - Category
   * @param {string} countryCode - Country code
   * @param {number} count - Number of articles to generate
   * @returns {Promise<Object>} Generation result
   */
  async generateArticlesForCategoryAndCountry(category, countryCode, count = 1) {
    try {
      if (!constants.CATEGORIES.includes(category)) {
        throw new Error(`Invalid category: ${category}`);
      }
      
      const country = countries.find(c => c.code === countryCode);
      if (!country) {
        throw new Error(`Invalid country code: ${countryCode}`);
      }
      
      logger.info(`Generating ${count} articles for ${category}/${countryCode}`);
      
      // Ensure trends exist
      await this._ensureTrendsExist(category, countryCode);
      
      // Get unused trends
      const unusedTrends = await trendsService.getUnusedTrends(category, countryCode, count);
      
      if (unusedTrends.length === 0) {
        return { message: 'No unused trends available', count: 0 };
      }
      
      const results = [];
      
      // Generate articles
      for (const trend of unusedTrends) {
        await this._generateArticleForTrend(category, country, trend);
        results.push(trend.keyword);
      }
      
      return {
        message: 'Articles generated successfully',
        count: results.length,
        keywords: results
      };
    } catch (error) {
      logger.error(`Error in generateArticlesForCategoryAndCountry: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new GenerationService();