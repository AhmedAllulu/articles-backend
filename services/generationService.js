// services/generationService.js
const logger = require('../config/logger');
const trendsService = require('./trendsService');
const openAiService = require('./openAiService');
const db = require('../db/connections');
const constants = require('../config/constants');
const countries = require('../config/countries');
const os = require('os'); // For memory stats if enabled

class GenerationService {
  /**
   * Generate articles for all categories and countries based on daily quota
   * @param {Object} options - Generation options
   * @param {boolean} options.forceDevelopment - Force generation regardless of conditions
   * @param {number} options.maxArticlesPerDay - Override the default max articles per day
   * @param {number} options.maxCombinations - Max number of category/country combinations to process
   * @returns {Promise<Object>} Generation statistics
   */
  async generateArticlesForAll(options = {}) {
    const startTime = Date.now();
    const startMemory = constants.LOGGING.INCLUDE_MEMORY_STATS ? process.memoryUsage() : null;
    
    // Default options
    const defaultOptions = {
      forceDevelopment: false,
      maxArticlesPerDay: constants.GENERATION.MAX_ARTICLES_PER_DAY,
      maxCombinations: null, // Default to unlimited
      prioritizeByUnused: true
    };
    
    options = { ...defaultOptions, ...options };
    
    logger.info(`Article generation started at ${new Date(startTime).toISOString()} with max articles: ${options.maxArticlesPerDay}`);
    
    if (constants.LOGGING.INCLUDE_MEMORY_STATS) {
      logger.info(`Initial memory usage: RSS=${this._formatBytes(startMemory.rss)}, Heap=${this._formatBytes(startMemory.heapUsed)}/${this._formatBytes(startMemory.heapTotal)}`);
    }
    
    const stats = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      byCategory: {},
      timing: {
        start: startTime,
        end: null,
        duration: null
      }
    };
    
    // Check how many articles we've already generated today
    const articlesGeneratedToday = await this.countArticlesGeneratedToday();
    logger.info(`Already generated ${articlesGeneratedToday} articles today`);
    
    // Calculate remaining quota
    const remainingQuota = Math.max(0, options.maxArticlesPerDay - articlesGeneratedToday);
    
    if (remainingQuota <= 0 && !options.forceDevelopment) {
      logger.info(`Daily article quota reached (${articlesGeneratedToday}/${options.maxArticlesPerDay}). Skipping generation.`);
      
      const endTime = Date.now();
      stats.timing.end = endTime;
      stats.timing.duration = endTime - startTime;
      
      return { 
        message: 'Skipped - Daily quota reached', 
        stats,
        quota: {
          total: options.maxArticlesPerDay,
          used: articlesGeneratedToday,
          remaining: 0
        }
      };
    }
    
    logger.info(`Starting article generation with remaining quota: ${remainingQuota}`);
    
    // 1. Find all combinations with unused trends
    const combinationsWithUnusedTrends = await this._findCombinationsWithUnusedTrends();
    
    if (combinationsWithUnusedTrends.length === 0) {
      logger.info('No combinations with unused trends found. Consider fetching new trends.');
      
      const endTime = Date.now();
      stats.timing.end = endTime;
      stats.timing.duration = endTime - startTime;
      
      return { 
        message: 'No unused trends available', 
        stats,
        quota: {
          total: options.maxArticlesPerDay,
          used: articlesGeneratedToday,
          remaining: remainingQuota
        }
      };
    }
    
    logger.info(`Found ${combinationsWithUnusedTrends.length} combinations with unused trends`);
    
    // 2. Prioritize combinations for article generation
    const prioritizedCombinations = await this._prioritizeCombinations(combinationsWithUnusedTrends);
    
    // 3. Limit the number of combinations based on options and quota
    const maxToProcess = options.maxCombinations ? 
      Math.min(options.maxCombinations, prioritizedCombinations.length, remainingQuota) : 
      Math.min(prioritizedCombinations.length, remainingQuota);
    
    const selectedCombinations = prioritizedCombinations.slice(0, maxToProcess);
    
    logger.info(`Selected ${selectedCombinations.length} combinations for article generation`);
    
    // 4. Generate articles for each selected combination
    for (const combo of selectedCombinations) {
      const { category, countryCode, unusedCount } = combo;
      
      if (!stats.byCategory[category]) {
        stats.byCategory[category] = {
          total: 0,
          successful: 0,
          failed: 0,
          skipped: 0
        };
      }
      
      try {
        logger.info(`Processing ${category}/${countryCode} with ${unusedCount} unused trends`);
        
        // Get unused trend
        const unusedTrends = await trendsService.getUnusedTrends(category, countryCode, 1);
        
        if (unusedTrends.length === 0) {
          logger.warn(`No unused trends found for ${category}/${countryCode}, skipping`);
          stats.skipped++;
          stats.byCategory[category].skipped++;
          continue;
        }
        
        // Take the first unused trend
        const trend = unusedTrends[0];
        
        stats.total++;
        stats.byCategory[category].total++;
        
        const country = countries.find(c => c.code === countryCode);
        
        try {
          await this._generateArticleForTrend(category, country, trend);
          
          stats.successful++;
          stats.byCategory[category].successful++;
          
          logger.info(`Successfully generated article for ${category}/${countryCode} with keyword "${trend.keyword}"`);
        } catch (error) {
          stats.failed++;
          stats.byCategory[category].failed++;
          
          logger.error(`Failed to generate article for ${category}/${countryCode}/${trend.keyword}: ${error.message}`);
        }
        
        // Log memory usage periodically if enabled
        if (constants.LOGGING.INCLUDE_MEMORY_STATS) {
          const currentMemory = process.memoryUsage();
          logger.info(`Memory after processing ${category}/${countryCode}: RSS=${this._formatBytes(currentMemory.rss)}, Heap=${this._formatBytes(currentMemory.heapUsed)}/${this._formatBytes(currentMemory.heapTotal)}`);
        }
      } catch (error) {
        logger.error(`Error processing ${category}/${countryCode}: ${error.message}`);
      }
    }
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // Update timing stats
    stats.timing.end = endTime;
    stats.timing.duration = totalDuration;
    
    // Log final memory usage if enabled
    if (constants.LOGGING.INCLUDE_MEMORY_STATS) {
      const endMemory = process.memoryUsage();
      const memoryDiff = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed
      };
      
      logger.info(`Final memory usage: RSS=${this._formatBytes(endMemory.rss)} (${this._formatDiff(memoryDiff.rss)}), Heap=${this._formatBytes(endMemory.heapUsed)} (${this._formatDiff(memoryDiff.heapUsed)})`);
    }
    
    logger.info(`Article generation completed in ${totalDuration}ms (successful: ${stats.successful}, failed: ${stats.failed}, skipped: ${stats.skipped}, total: ${stats.total})`);
    
    return { 
      message: 'Generation completed', 
      stats,
      quota: {
        total: options.maxArticlesPerDay,
        used: articlesGeneratedToday + stats.successful,
        remaining: Math.max(0, options.maxArticlesPerDay - (articlesGeneratedToday + stats.successful))
      }
    };
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
          
          // Only include combinations with at least the minimum number of unused trends
          if (unusedCount >= constants.GENERATION.MIN_UNUSED_TRENDS) {
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
        // Factor 1: Number of unused trends (more trends = higher priority)
        const unusedTrendsScore = combo.unusedCount;
        
        // Factor 2: Days since last article (more days = higher priority)
        const lastArticleQuery = await db.query(
          combo.category,
          combo.countryCode,
          `SELECT MAX(created_at) as last_created FROM articles`
        );
        
        const lastCreated = lastArticleQuery.rows[0].last_created;
        const daysSinceLastArticle = lastCreated ? 
          Math.ceil((Date.now() - new Date(lastCreated).getTime()) / (1000 * 60 * 60 * 24)) : 
          30; // Default to 30 if no articles
        
        // Factor 3: Base importance of the combination
        const baseImportance = this._getBaseImportance(combo.category, combo.countryCode);
        
        // Calculate priority score (higher is better)
        combo.priorityScore = 
          (unusedTrendsScore * constants.GENERATION.PRIORITY_FACTORS.UNUSED_TRENDS_WEIGHT) + 
          (daysSinceLastArticle * constants.GENERATION.PRIORITY_FACTORS.DAYS_SINCE_LAST_ARTICLE_WEIGHT) + 
          (baseImportance * constants.GENERATION.PRIORITY_FACTORS.BASE_IMPORTANCE_WEIGHT);
        
        // Add fields for debugging and transparency
        combo.daysSinceLastArticle = daysSinceLastArticle;
        combo.baseImportance = baseImportance;
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
    return ((categoryImportance[category] || 0.5) + (countryImportance[countryCode] || 0.5)) / 2;
  }
  
  /**
   * Generate an article for a single trend
   * @private
   * @param {string} category - Category
   * @param {Object} country - Country object
   * @param {Object} trend - Trend object
   */
  async _generateArticleForTrend(category, country, trend) {
    const steps = {
      start: Date.now(),
      generateArticle: null,
      createArticle: null,
      markTrend: null,
      end: null
    };
    
    try {
      if (constants.LOGGING.DETAILED_TIMING) {
        logger.debug(`Starting article generation for "${trend.keyword}" (${category}/${country.code})`);
      }
      
      // Generate article using OpenAI
      steps.generateArticle = Date.now();
      const generateStartTime = Date.now();
      
      const article = await openAiService.generateArticle(
        trend.keyword,
        country.language,
        country.code
      );
      
      const generateEndTime = Date.now();
      
      if (constants.LOGGING.DETAILED_TIMING) {
        logger.debug(`Content generation for "${trend.keyword}" took ${generateEndTime - generateStartTime}ms`);
      }
      
      // Use articleService to create the article with image generation
      steps.createArticle = Date.now();
      const createStartTime = Date.now();
      
      const articleService = require('./articleService');
      await articleService.createArticle(category, country.code, {
        title: article.title,
        content: article.content,
        trend_keyword: trend.keyword,
        language: country.language
      });
      
      const createEndTime = Date.now();
      
      if (constants.LOGGING.DETAILED_TIMING) {
        logger.debug(`Database storage for "${trend.keyword}" took ${createEndTime - createStartTime}ms`);
      }
      
      // Mark the trend as used
      steps.markTrend = Date.now();
      const markStartTime = Date.now();
      
      await trendsService.markTrendAsUsed(category, country.code, trend.id);
      
      const markEndTime = Date.now();
      steps.end = markEndTime;
      
      if (constants.LOGGING.DETAILED_TIMING) {
        logger.debug(`Marking trend "${trend.keyword}" as used took ${markEndTime - markStartTime}ms`);
        
        // Log detailed timing breakdown
        const timings = {
          total: steps.end - steps.start,
          initialization: steps.generateArticle - steps.start,
          contentGeneration: steps.createArticle - steps.generateArticle,
          dbStorage: steps.markTrend - steps.createArticle,
          markingUsed: steps.end - steps.markTrend
        };
        
        logger.debug(`Timing breakdown for "${trend.keyword}": init=${timings.initialization}ms, generation=${timings.contentGeneration}ms, storage=${timings.dbStorage}ms, marking=${timings.markingUsed}ms, total=${timings.total}ms`);
      }
    } catch (error) {
      steps.end = Date.now();
      
      if (constants.LOGGING.DETAILED_TIMING) {
        const failedAt = steps.markTrend ? 'marking trend as used' : 
                        steps.createArticle ? 'storing article' : 
                        steps.generateArticle ? 'generating content' : 
                        'initialization';
        
        logger.error(`Error generating article for "${trend.keyword}" during ${failedAt} after ${steps.end - steps.start}ms: ${error.message}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Count articles generated today
   * @returns {Promise<number>} Number of articles generated today
   */
  async countArticlesGeneratedToday() {
    let totalCount = 0;
    
    for (const category of constants.CATEGORIES) {
      for (const country of countries) {
        try {
          const result = await db.query(
            category,
            country.code,
            `SELECT COUNT(*) FROM articles WHERE created_at >= CURRENT_DATE`
          );
          
          totalCount += parseInt(result.rows[0].count, 10);
        } catch (error) {
          logger.warn(`Error counting today's articles for ${category}/${country.code}: ${error.message}`);
        }
      }
    }
    
    return totalCount;
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
    const startTime = Date.now();
    logger.info(`Article generation for ${category}/${countryCode} (count: ${count}) started at ${new Date(startTime).toISOString()}`);
    
    try {
      if (!constants.CATEGORIES.includes(category)) {
        throw new Error(`Invalid category: ${category}`);
      }
      
      const country = countries.find(c => c.code === countryCode);
      if (!country) {
        throw new Error(`Invalid country code: ${countryCode}`);
      }
      
      // Get unused trends
      const unusedTrends = await trendsService.getUnusedTrends(category, countryCode, count);
      
      if (unusedTrends.length === 0) {
        return { message: 'No unused trends available', count: 0 };
      }
      
      const results = [];
      
      // Generate articles
      for (let i = 0; i < unusedTrends.length; i++) {
        const trend = unusedTrends[i];
        const trendIndex = i + 1;
        const trendStartTime = Date.now();
        
        logger.info(`Generating article ${trendIndex}/${unusedTrends.length} for "${trend.keyword}" (${category}/${countryCode})`);
        
        try {
          await this._generateArticleForTrend(category, country, trend);
          
          const trendEndTime = Date.now();
          logger.info(`Article ${trendIndex}/${unusedTrends.length} for "${trend.keyword}" (${category}/${countryCode}) generated successfully in ${trendEndTime - trendStartTime}ms`);
          
          results.push(trend.keyword);
        } catch (error) {
          const trendEndTime = Date.now();
          logger.error(`Failed to generate article ${trendIndex}/${unusedTrends.length} for "${trend.keyword}" (${category}/${countryCode}) after ${trendEndTime - trendStartTime}ms: ${error.message}`);
        }
      }
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      
      logger.info(`Article generation for ${category}/${countryCode} completed in ${totalDuration}ms (generated: ${results.length}/${unusedTrends.length})`);
      
      return {
        message: 'Articles generated successfully',
        count: results.length,
        keywords: results,
        timing: {
          start: startTime,
          end: endTime,
          duration: totalDuration
        }
      };
    } catch (error) {
      const endTime = Date.now();
      logger.error(`Error in generateArticlesForCategoryAndCountry(${category}, ${countryCode}, ${count}) after ${endTime - startTime}ms: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Format bytes to human-readable format
   * @private
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Format memory difference
   * @private
   * @param {number} diff - Difference in bytes
   * @returns {string} Formatted string with sign
   */
  _formatDiff(diff) {
    const sign = diff >= 0 ? '+' : '';
    return sign + this._formatBytes(diff);
  }
}

module.exports = new GenerationService();