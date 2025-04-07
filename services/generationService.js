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
   * Generate articles for all categories and countries
   * @param {Object} options - Generation options
   * @param {boolean} options.forceDevelopment - Force generation regardless of discount hours
   * @returns {Promise<Object>} Generation statistics
   */
  async generateArticlesForAll(options = {}) {
    const startTime = Date.now();
    const startMemory = constants.LOGGING.INCLUDE_MEMORY_STATS ? process.memoryUsage() : null;
    
    logger.info(`Article generation started at ${new Date(startTime).toISOString()}`);
    
    if (constants.LOGGING.INCLUDE_MEMORY_STATS) {
      logger.info(`Initial memory usage: RSS=${this._formatBytes(startMemory.rss)}, Heap=${this._formatBytes(startMemory.heapUsed)}/${this._formatBytes(startMemory.heapTotal)}`);
    }
    
    const stats = {
      total: 0,
      successful: 0,
      failed: 0,
      byCategory: {},
      timing: {
        start: startTime,
        end: null,
        duration: null
      }
    };
    
    // Check if we're in discount hours unless forceDevelopment is true
    if (!options.forceDevelopment) {
      const now = new Date();
      const hour = now.getHours();
      const isDiscountHour = hour >= constants.OpenAi_DISCOUNT_START && hour < constants.OpenAi_DISCOUNT_END;
      
      if (!isDiscountHour) {
        logger.info(`Not in discount hours. Current hour: ${hour}, discount hours: ${constants.OpenAi_DISCOUNT_START}-${constants.OpenAi_DISCOUNT_END}. Skipping generation.`);
        return { message: 'Skipped - Not in discount hours', stats };
      }
    }
    
    logger.info('Starting article generation for all categories and countries');
    
    // Process each category
    for (const category of constants.CATEGORIES) {
      const categoryStartTime = Date.now();
      logger.info(`Starting category: ${category} at ${new Date(categoryStartTime).toISOString()}`);
      
      stats.byCategory[category] = {
        total: 0,
        successful: 0,
        failed: 0,
        timing: {
          start: categoryStartTime,
          end: null,
          duration: null
        },
        countries: {}
      };
      
      // Process each country
      for (const country of countries) {
        const countryStartTime = Date.now();
        logger.info(`Processing ${category}/${country.code} at ${new Date(countryStartTime).toISOString()}`);
        
        stats.byCategory[category].countries[country.code] = {
          total: 0,
          successful: 0,
          failed: 0,
          timing: {
            start: countryStartTime,
            end: null,
            duration: null
          }
        };
        
        try {
          // Step 1: Fetch trends if needed
          const trendsStartTime = Date.now();
          try {
            await this._ensureTrendsExist(category, country.code);
            const trendsEndTime = Date.now();
            logger.info(`Trends check for ${category}/${country.code} completed in ${trendsEndTime - trendsStartTime}ms`);
          } catch (error) {
            const trendsEndTime = Date.now();
            logger.error(`Failed to ensure trends for ${category}/${country.code} after ${trendsEndTime - trendsStartTime}ms: ${error.message}`);
            continue; // Skip to next country if we can't get trends
          }
          
          // Step 2: Get unused trends
          const unusedTrendsStartTime = Date.now();
          let unusedTrends;
          try {
            unusedTrends = await trendsService.getUnusedTrends(category, country.code, 5);
            const unusedTrendsEndTime = Date.now();
            logger.info(`Retrieved ${unusedTrends.length} unused trends for ${category}/${country.code} in ${unusedTrendsEndTime - unusedTrendsStartTime}ms`);
          } catch (error) {
            const unusedTrendsEndTime = Date.now();
            logger.error(`Failed to get unused trends for ${category}/${country.code} after ${unusedTrendsEndTime - unusedTrendsStartTime}ms: ${error.message}`);
            continue; // Skip to next country if we can't get trends
          }
          
          if (unusedTrends.length === 0) {
            logger.info(`No unused trends for ${category}/${country.code}. Skipping.`);
            continue;
          }
          
          // Step 3: Generate articles for each trend
          for (let i = 0; i < unusedTrends.length; i++) {
            const trend = unusedTrends[i];
            const trendIndex = i + 1;
            const trendStartTime = Date.now();
            
            logger.info(`Generating article ${trendIndex}/${unusedTrends.length} for "${trend.keyword}" (${category}/${country.code})`);
            
            stats.total++;
            stats.byCategory[category].total++;
            stats.byCategory[category].countries[country.code].total++;
            
            try {
              await this._generateArticleForTrend(category, country, trend);
              
              const trendEndTime = Date.now();
              const trendDuration = trendEndTime - trendStartTime;
              logger.info(`Article ${trendIndex}/${unusedTrends.length} for "${trend.keyword}" (${category}/${country.code}) generated successfully in ${trendDuration}ms`);
              
              stats.successful++;
              stats.byCategory[category].successful++;
              stats.byCategory[category].countries[country.code].successful++;
            } catch (error) {
              const trendEndTime = Date.now();
              const trendDuration = trendEndTime - trendStartTime;
              
              stats.failed++;
              stats.byCategory[category].failed++;
              stats.byCategory[category].countries[country.code].failed++;
              
              logger.error(`Failed to generate article ${trendIndex}/${unusedTrends.length} for "${trend.keyword}" (${category}/${country.code}) after ${trendDuration}ms: ${error.message}`);
            }
            
            // Log memory usage periodically if enabled
            if (constants.LOGGING.INCLUDE_MEMORY_STATS && i % 2 === 0) {
              const currentMemory = process.memoryUsage();
              logger.info(`Memory after ${trendIndex}/${unusedTrends.length} articles for ${category}/${country.code}: RSS=${this._formatBytes(currentMemory.rss)}, Heap=${this._formatBytes(currentMemory.heapUsed)}/${this._formatBytes(currentMemory.heapTotal)}`);
            }
          }
        } catch (error) {
          logger.error(`Error processing ${category}/${country.code}: ${error.message}`);
        }
        
        const countryEndTime = Date.now();
        const countryDuration = countryEndTime - countryStartTime;
        
        // Update country timing stats
        stats.byCategory[category].countries[country.code].timing.end = countryEndTime;
        stats.byCategory[category].countries[country.code].timing.duration = countryDuration;
        
        logger.info(`Completed ${category}/${country.code} in ${countryDuration}ms (successful: ${stats.byCategory[category].countries[country.code].successful}, failed: ${stats.byCategory[category].countries[country.code].failed})`);
      }
      
      const categoryEndTime = Date.now();
      const categoryDuration = categoryEndTime - categoryStartTime;
      
      // Update category timing stats
      stats.byCategory[category].timing.end = categoryEndTime;
      stats.byCategory[category].timing.duration = categoryDuration;
      
      logger.info(`Completed category: ${category} in ${categoryDuration}ms (successful: ${stats.byCategory[category].successful}, failed: ${stats.byCategory[category].failed})`);
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
    
    logger.info(`Article generation completed in ${totalDuration}ms (successful: ${stats.successful}, failed: ${stats.failed}, total: ${stats.total})`);
    
    return { 
      message: 'Generation completed', 
      stats 
    };
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
      
      // Generate article using OpenAi
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
   * Check if unused trends exist in the database
   * @private
   * @param {string} category - Category
   * @param {string} countryCode - Country code
   */
  async _ensureTrendsExist(category, countryCode) {
    try {
      // Check if we have unused trends
      const unusedTrends = await trendsService.getUnusedTrends(category, countryCode, 1);
      
      // If we don't have any unused trends, throw an error
      if (unusedTrends.length === 0) {
        logger.warn(`No unused trends for ${category}/${countryCode}. Please insert trends first.`);
        throw new Error(`No unused trends available for ${category}/${countryCode}. Please insert trends using the admin API.`);
      }
    } catch (error) {
      logger.error(`Error checking for trends for ${category}/${countryCode}: ${error.message}`);
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
      
      // Ensure trends exist
      const trendsCheckStart = Date.now();
      await this._ensureTrendsExist(category, countryCode);
      const trendsCheckEnd = Date.now();
      
      logger.info(`Trends check for ${category}/${countryCode} completed in ${trendsCheckEnd - trendsCheckStart}ms`);
      
      // Get unused trends
      const fetchTrendsStart = Date.now();
      const unusedTrends = await trendsService.getUnusedTrends(category, countryCode, count);
      const fetchTrendsEnd = Date.now();
      
      logger.info(`Retrieved ${unusedTrends.length} unused trends for ${category}/${countryCode} in ${fetchTrendsEnd - fetchTrendsStart}ms`);
      
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