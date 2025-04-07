// services/optimizedGenerationService.js
const logger = require('../config/logger');
const optimizedTrendsService = require('./optimizedTrendsService');
const deepSeekService = require('./openAiService');
const db = require('../db/connections');
const constants = require('../config/constants');
const countries = require('../config/countries');
const apiQuotaManager = require('./apiQuotaManager');

class OptimizedGenerationService {
  /**
   * Generate articles with prioritization and quota awareness
   * @param {Object} options - Generation options
   * @param {boolean} options.forceDevelopment - Force generation regardless of discount hours
   * @param {number} options.maxCombinations - Maximum combinations to process (defaults to all)
   * @returns {Promise<Object>} Generation statistics
   */
  async generateArticlesForAll(options = {}) {
    const stats = {
      total: 0,
      successful: 0,
      failed: 0,
      byCategory: {},
      skipped: 0
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
    
    logger.info('Starting optimized article generation');
    
    // 1. First, get all combinations with unused trends
    const combinationsWithUnusedTrends = await this._findCombinationsWithUnusedTrends();
    
    if (combinationsWithUnusedTrends.length === 0) {
      logger.info('No combinations with unused trends found. Consider fetching new trends.');
      return { message: 'No unused trends available', stats };
    }
    
    logger.info(`Found ${combinationsWithUnusedTrends.length} combinations with unused trends`);
    
    // 2. Prioritize combinations for article generation
    const prioritizedCombinations = await this._prioritizeCombinations(combinationsWithUnusedTrends);
    
    // 3. Limit the number of combinations if requested
    const maxCombinations = options.maxCombinations || prioritizedCombinations.length;
    const selectedCombinations = prioritizedCombinations.slice(0, maxCombinations);
    
    logger.info(`Selected ${selectedCombinations.length} combinations for article generation`);
    
    // 4. Generate articles for each selected combination
    for (const combo of selectedCombinations) {
      const { category, countryCode, unusedCount } = combo;
      
      if (!stats.byCategory[category]) {
        stats.byCategory[category] = {
          total: 0,
          successful: 0,
          failed: 0
        };
      }
      
      try {
        logger.info(`Processing ${category}/${countryCode} with ${unusedCount} unused trends`);
        
        // Get unused trends
        const unusedTrends = await optimizedTrendsService.getUnusedTrends(category, countryCode, 1);
        
        if (unusedTrends.length === 0) {
          logger.warn(`No unused trends found for ${category}/${countryCode}, skipping`);
          stats.skipped++;
          continue;
        }
        
        // Take the first unused trend
        const trend = unusedTrends[0];
        
        stats.total++;
        stats.byCategory[category].total++;
        
        try {
          await this._generateArticleForTrend(category, countries.find(c => c.code === countryCode), trend);
          
          stats.successful++;
          stats.byCategory[category].successful++;
        } catch (error) {
          stats.failed++;
          stats.byCategory[category].failed++;
          logger.error(`Failed to generate article for ${category}/${countryCode}/${trend.keyword}: ${error.message}`);
        }
      } catch (error) {
        logger.error(`Error processing ${category}/${countryCode}: ${error.message}`);
      }
    }
    
    logger.info(`Optimized article generation completed. Stats: ${JSON.stringify(stats)}`);
    return { message: 'Generation completed', stats, selectedCombinations };
  }
  
  /**
   * Find all combinations with unused trends
   * @private
   * @returns {Promise<Array>} Array of combinations with unused trends
   */
  async _findCombinationsWithUnusedTrends() {
    const result = [];
    
    for (const category of constants.CATEGORIES) {
      for (const country of countries) {
        try {
          // Check if this combination has unused trends
          const unusedTrends = await db.query(
            category,
            country.code,
            `SELECT COUNT(*) FROM trends WHERE status = 'not_used'`
          );
          
          const unusedCount = parseInt(unusedTrends.rows[0].count, 10);
          
          if (unusedCount > 0) {
            result.push({
              category,
              countryCode: country.code,
              unusedCount
            });
          }
        } catch (error) {
          logger.error(`Error checking unused trends for ${category}/${country.code}: ${error.message}`);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Prioritize combinations for article generation
   * @private
   * @param {Array} combinations - Combinations with unused trends
   * @returns {Promise<Array>} Prioritized combinations
   */
  async _prioritizeCombinations(combinations) {
    // Create a copy to avoid modifying the original
    const prioritized = [...combinations];
    
    // Calculate priority for each combination
    for (const combo of prioritized) {
      try {
        // Factor 1: Number of articles in the last week (fewer articles = higher priority)
        const recentArticles = await db.query(
          combo.category,
          combo.countryCode,
          `SELECT COUNT(*) FROM articles WHERE created_at > NOW() - INTERVAL '7 days'`
        );
        
        const recentCount = parseInt(recentArticles.rows[0].count, 10);
        
        // Factor 2: Base importance of the combination
        const baseImportance = this._getBaseImportance(combo.category, combo.countryCode);
        
        // Calculate priority score (higher is better)
        combo.priorityScore = 
          baseImportance * 10 +  // Base importance (scale 0-10)
          Math.max(0, 5 - recentCount) * 2 +  // Recent articles factor (0-10)
          Math.min(10, combo.unusedCount / 2);  // Unused trends factor (0-10)
      } catch (error) {
        logger.error(`Error calculating priority for ${combo.category}/${combo.countryCode}: ${error.message}`);
        combo.priorityScore = 0; // Lowest priority if error
      }
    }
    
    // Sort by priority score (highest first)
    prioritized.sort((a, b) => b.priorityScore - a.priorityScore);
    
    return prioritized;
  }
  
  /**
   * Get base importance for a category-country combination
   * @private
   * @param {string} category - Content category
   * @param {string} countryCode - Country code
   * @returns {number} Base importance (0-1 scale)
   */
  _getBaseImportance(category, countryCode) {
    // These values should be adjusted based on your business priorities
    // Higher values indicate higher importance
    const categoryImportance = {
      'tech': 1.0,
      'general': 0.9,
      'politics': 0.8,
      'sports': 0.7,
      'health': 0.6
    };
    
    const countryImportance = {
      'US': 1.0,
      'GB': 0.9,
      'CA': 0.8,
      'AU': 0.8,
      'DE': 0.7,
      'FR': 0.7,
      'SA': 0.6
    };
    
    // Combine category and country importance (average)
    return (categoryImportance[category] || 0.5) + (countryImportance[countryCode] || 0.5) / 2;
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
      
      // Use articleService to create the article with image generation
      const articleService = require('./articleService');
      await articleService.createArticle(category, country.code, {
        title: article.title,
        content: article.content,
        trend_keyword: trend.keyword,
        language: country.language
      });
      
      // Mark the trend as used
      await optimizedTrendsService.markTrendAsUsed(category, country.code, trend.id);
      
      logger.info(`Successfully generated and stored article for ${category}/${country.code}/${trend.keyword}`);
    } catch (error) {
      logger.error(`Error generating article for ${category}/${country.code}/${trend.keyword}: ${error.message}`);
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
      
      // Get unused trends
      const unusedTrends = await optimizedTrendsService.getUnusedTrends(category, countryCode, count);
      
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

module.exports = new OptimizedGenerationService();