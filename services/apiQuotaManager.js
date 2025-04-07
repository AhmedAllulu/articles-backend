// services/apiQuotaManager.js
const logger = require('../config/logger');
const { Pool } = require('pg');
const db = require('../db/connections');

/**
 * API Quota Manager to optimize SERPAPI usage
 * Implements a priority-based, adaptive scheduling system with dynamic API key loading
 */
class ApiQuotaManager {
  constructor() {
    this.apiKeys = [];
    
    // Initialize tracking data
    this.lastFetchTimes = {};  // Stores the last time trends were fetched for each combination
    this.combinationPriorities = {}; // Stores priority scores for each combination
    this.currentMonthUsage = 0;  // Track monthly usage
    
    // Language groups - combinations that can potentially share trends
    this.languageGroups = {
      'en': ['US', 'GB', 'CA', 'AU'],
      'de': ['DE'],
      'fr': ['FR'],
      'ar': ['SA']
    };
    
    // Load API keys and initialize tracking
    this.loadApiKeys();
    this._initializeFromDatabase();
  }
  
  /**
   * Load API keys dynamically from environment variables
   */
  loadApiKeys() {
    // Clear existing keys
    this.apiKeys = [];
    
    // Load keys dynamically
    for (let i = 1; i <= 10; i++) { // Support up to 10 keys
      const keyName = i === 1 ? 'SERPAPI_API_KEY' : `SERPAPI_API_KEY${i}`;
      const keyValue = process.env[keyName];
      
      if (keyValue) {
        this.apiKeys.push({
          key: keyValue,
          usageCount: 0,
          maxMonthly: 100
        });
      }
    }
    
    // Update total monthly allocation (use 90% of total available)
    this.monthlyAllocation = Math.floor(this.apiKeys.length * 100 * 0.9);
    
    logger.info(`Loaded ${this.apiKeys.length} API keys with total monthly allocation of ${this.monthlyAllocation}`);
  }
  
  /**
   * Initialize quota tracking from database
   * @private
   */
  async _initializeFromDatabase() {
    try {
      // Connect to admin database to get quota usage
      const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: 'admin_db',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      });
      
      // Check if api_quota_tracking table exists, create if not
      await pool.query(`
        CREATE TABLE IF NOT EXISTS api_quota_tracking (
          id SERIAL PRIMARY KEY,
          api_key VARCHAR(255) NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          usage_count INTEGER NOT NULL DEFAULT 0,
          last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT unique_api_key_month UNIQUE (api_key, month, year)
        )
      `);
      
      // Get current month and year
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed
      const currentYear = now.getFullYear();
      
      // Get usage for current month
      for (const apiKey of this.apiKeys) {
        const result = await pool.query(
          `SELECT usage_count FROM api_quota_tracking 
           WHERE api_key = $1 AND month = $2 AND year = $3`,
          [apiKey.key, currentMonth, currentYear]
        );
        
        if (result.rowCount > 0) {
          apiKey.usageCount = result.rows[0].usage_count;
        } else {
          // Initialize record for new month
          await pool.query(
            `INSERT INTO api_quota_tracking (api_key, month, year, usage_count)
             VALUES ($1, $2, $3, 0)`,
            [apiKey.key, currentMonth, currentYear]
          );
        }
      }
      
      // Calculate current month usage
      this.currentMonthUsage = this.apiKeys.reduce((sum, key) => sum + key.usageCount, 0);
      
      logger.info(`API quota tracking initialized. Current month usage: ${this.currentMonthUsage}/${this.monthlyAllocation}`);
      
      pool.end();
    } catch (error) {
      logger.error(`Error initializing API quota tracking: ${error.message}`);
      // Continue anyway - we'll track in memory if database fails
    }
  }
  
  /**
   * Calculate priority for a category-country combination
   * Higher score = higher priority for updating
   * @param {string} category - Content category
   * @param {string} countryCode - Country code
   * @returns {number} Priority score
   */
  async calculatePriority(category, countryCode) {
    const combination = `${category}:${countryCode}`;
    const now = Date.now();
    
    // Factor 1: Time since last update (more time = higher priority)
    const lastFetchTime = this.lastFetchTimes[combination] || 0;
    const hoursSinceLastFetch = (now - lastFetchTime) / (1000 * 60 * 60);
    
    // Factor 2: Content generation (get info from database)
    let contentUsage = 0;
    try {
      // Check how many articles were generated for this combination recently
      const result = await db.query(
        category,
        countryCode,
        `SELECT COUNT(*) FROM articles WHERE created_at > NOW() - INTERVAL '30 days'`
      );
      contentUsage = parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.warn(`Error getting content usage for ${combination}: ${error.message}`);
      // Continue with default value if query fails
    }
    
    // Factor 3: Base importance (can be adjusted manually for each combination)
    const baseImportance = this._getBaseImportance(category, countryCode);
    
    // Factor 4: Trend availability (more unused trends = lower priority)
    let unusedTrendsCount = 0;
    try {
      const result = await db.query(
        category,
        countryCode,
        `SELECT COUNT(*) FROM trends WHERE status = 'not_used'`
      );
      unusedTrendsCount = parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.warn(`Error getting unused trends for ${combination}: ${error.message}`);
      // Continue with default value if query fails
    }
    
    // Calculate priority score
    // Formula weights time since update heavily, while considering other factors
    const priorityScore = 
      (hoursSinceLastFetch * 5) +  // Time factor (strongest weight)
      (contentUsage * 0.5) +       // Usage factor (medium weight)
      (baseImportance * 10) +      // Base importance (high constant weight)
      (Math.max(0, 10 - unusedTrendsCount) * 2); // Unused trends factor (inverse relationship)
    
    // Store and return
    this.combinationPriorities[combination] = priorityScore;
    return priorityScore;
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
   * Get the next combinations to update based on priorities
   * @param {number} count - Number of combinations to return
   * @param {boolean} forceUpdate - If true, returns combinations even if monthly quota is nearly used
   * @returns {Promise<Array>} Array of {category, countryCode} objects
   */
  async getNextCombinationsToUpdate(count = 1, forceUpdate = false) {
    const constants = require('../config/constants');
    const countries = require('../config/countries');
    const allCombinations = [];
    
    // Calculate priorities for all combinations
    for (const category of constants.CATEGORIES) {
      for (const country of countries) {
        const priority = await this.calculatePriority(category, country.code);
        allCombinations.push({
          category,
          countryCode: country.code,
          priority
        });
      }
    }
    
    // Check if we have enough quota
    const remainingQuota = this.monthlyAllocation - this.currentMonthUsage;
    if (remainingQuota < count && !forceUpdate) {
      logger.warn(`Not enough API quota remaining. Used: ${this.currentMonthUsage}/${this.monthlyAllocation}`);
      return [];
    }
    
    // Sort by priority (highest first)
    allCombinations.sort((a, b) => b.priority - a.priority);
    
    // Apply language group optimizations
    const selectedCombinations = [];
    const selectedLanguages = new Set();
    
    // First pass: select highest priority combination from each language group
    for (const [language, countryCodes] of Object.entries(this.languageGroups)) {
      if (selectedCombinations.length >= count) break;
      
      // Find the highest priority combination for this language group
      const combinationsInLanguage = allCombinations.filter(c => 
        countryCodes.includes(c.countryCode));
      
      if (combinationsInLanguage.length > 0) {
        // Get the highest priority combination
        const highestPriority = combinationsInLanguage[0];
        selectedCombinations.push(highestPriority);
        selectedLanguages.add(language);
        
        // Remove selected combination from consideration
        const index = allCombinations.findIndex(c => 
          c.category === highestPriority.category && 
          c.countryCode === highestPriority.countryCode);
        if (index !== -1) {
          allCombinations.splice(index, 1);
        }
      }
    }
    
    // Second pass: fill remaining slots with highest priority combinations
    while (selectedCombinations.length < count && allCombinations.length > 0) {
      selectedCombinations.push(allCombinations.shift());
    }
    
    return selectedCombinations.map(c => ({
      category: c.category,
      countryCode: c.countryCode
    }));
  }
  
  /**
   * Increment API key usage and record in database
   * @param {string} apiKey - API key that was used
   * @returns {Promise<void>}
   */
  async recordApiUsage(apiKey) {
    // Find the API key in our tracking
    const keyObj = this.apiKeys.find(k => k.key === apiKey);
    if (!keyObj) {
      logger.warn(`Unknown API key used: ${apiKey}`);
      return;
    }
    
    // Increment usage count
    keyObj.usageCount++;
    this.currentMonthUsage++;
    
    try {
      // Update database
      const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: 'admin_db',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      });
      
      // Get current month and year
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      // Update usage count
      await pool.query(
        `UPDATE api_quota_tracking 
         SET usage_count = $1, last_updated = NOW()
         WHERE api_key = $2 AND month = $3 AND year = $4`,
        [keyObj.usageCount, apiKey, currentMonth, currentYear]
      );
      
      pool.end();
    } catch (error) {
      logger.error(`Error recording API usage: ${error.message}`);
      // Continue anyway - we're still tracking in memory
    }
    
    logger.info(`API key ${apiKey.substring(0, 8)}... usage incremented to ${keyObj.usageCount}/${keyObj.maxMonthly}`);
    logger.info(`Total monthly usage: ${this.currentMonthUsage}/${this.monthlyAllocation}`);
  }
  
  /**
   * Record that a combination was updated
   * @param {string} category - Content category
   * @param {string} countryCode - Country code
   */
  recordCombinationUpdate(category, countryCode) {
    const combination = `${category}:${countryCode}`;
    this.lastFetchTimes[combination] = Date.now();
  }
  
  /**
   * Get the next available API key with the least usage
   * @returns {string|null} API key or null if all keys are maxed out
   */
  getNextApiKey() {
    // Sort keys by usage (least used first)
    const sortedKeys = [...this.apiKeys].sort((a, b) => a.usageCount - b.usageCount);
    
    // Get the least used key that still has quota
    for (const keyObj of sortedKeys) {
      if (keyObj.usageCount < keyObj.maxMonthly) {
        return keyObj.key;
      }
    }
    
    // All keys are maxed out
    return null;
  }
  
  /**
   * Check if we should fetch trends for a combination or use existing ones
   * @param {string} category - Content category
   * @param {string} countryCode - Country code
   * @returns {Promise<boolean>} True if we should fetch new trends
   */
  async shouldFetchNewTrends(category, countryCode) {
    // Check unused trends count
    try {
      const result = await db.query(
        category,
        countryCode,
        `SELECT COUNT(*) FROM trends WHERE status = 'not_used'`
      );
      const unusedTrendsCount = parseInt(result.rows[0].count, 10);
      
      // If we have enough unused trends, don't fetch new ones
      if (unusedTrendsCount >= 15) {
        logger.info(`${category}/${countryCode} has ${unusedTrendsCount} unused trends. Skipping fetch.`);
        return false;
      }
    } catch (error) {
      logger.warn(`Error checking unused trends for ${category}/${countryCode}: ${error.message}`);
      // If we can't check, assume we need new trends
    }
    
    // Check time since last update
    const combination = `${category}:${countryCode}`;
    const lastFetchTime = this.lastFetchTimes[combination] || 0;
    const hoursSinceLastFetch = (Date.now() - lastFetchTime) / (1000 * 60 * 60);
    
    // If it's been less than 72 hours (3 days), don't fetch new trends
    if (hoursSinceLastFetch < 72) {
      logger.info(`${category}/${countryCode} was updated ${hoursSinceLastFetch.toFixed(1)} hours ago. Skipping fetch.`);
      return false;
    }
    
    // Check monthly quota
    if (this.currentMonthUsage >= this.monthlyAllocation) {
      logger.warn(`Monthly API quota reached (${this.currentMonthUsage}/${this.monthlyAllocation}). Skipping fetch.`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Share trends between similar language countries
   * For example, share trends from US to other English-speaking countries
   * @returns {Promise<number>} Number of trends shared
   */
  async shareTrendsBetweenCountries() {
    const constants = require('../config/constants');
    let totalShared = 0;
    
    for (const category of constants.CATEGORIES) {
      for (const [language, countryCodes] of Object.entries(this.languageGroups)) {
        // Skip single-country language groups
        if (countryCodes.length <= 1) continue;
        
        try {
          // Find the country with the most unused trends
          let sourceCountry = null;
          let maxUnusedTrends = 0;
          
          for (const countryCode of countryCodes) {
            const result = await db.query(
              category,
              countryCode,
              `SELECT COUNT(*) FROM trends WHERE status = 'not_used'`
            );
            const unusedTrendsCount = parseInt(result.rows[0].count, 10);
            
            if (unusedTrendsCount > maxUnusedTrends) {
              maxUnusedTrends = unusedTrendsCount;
              sourceCountry = countryCode;
            }
          }
          
          if (!sourceCountry || maxUnusedTrends < 10) {
            // Not enough trends to share
            continue;
          }
          
          // Get trends from source country
          const sourceTrends = await db.query(
            category,
            sourceCountry,
            `SELECT keyword FROM trends WHERE status = 'not_used' LIMIT 10`
          );
          
          // Share with other countries in the same language group
          for (const countryCode of countryCodes) {
            if (countryCode === sourceCountry) continue;
            
            // Check how many unused trends this country already has
            const targetResult = await db.query(
              category,
              countryCode,
              `SELECT COUNT(*) FROM trends WHERE status = 'not_used'`
            );
            const targetUnusedTrends = parseInt(targetResult.rows[0].count, 10);
            
            // Only share if target country has few trends
            if (targetUnusedTrends >= 5) continue;
            
            // Share trends (copy to target country)
            let sharedCount = 0;
            for (const trend of sourceTrends.rows) {
              try {
                const result = await db.query(
                  category,
                  countryCode,
                  `INSERT INTO trends (keyword, status) 
                   VALUES ($1, $2)
                   ON CONFLICT (keyword) DO NOTHING
                   RETURNING id`,
                  [trend.keyword, 'not_used']
                );
                
                if (result.rowCount > 0) {
                  sharedCount++;
                }
              } catch (error) {
                logger.error(`Error sharing trend "${trend.keyword}" from ${sourceCountry} to ${countryCode}: ${error.message}`);
              }
            }
            
            if (sharedCount > 0) {
              logger.info(`Shared ${sharedCount} trends from ${category}/${sourceCountry} to ${category}/${countryCode}`);
              totalShared += sharedCount;
            }
          }
        } catch (error) {
          logger.error(`Error sharing trends for ${category} in ${language}: ${error.message}`);
        }
      }
    }
    
    return totalShared;
  }
  
  /**
   * Update scheduling based on available API keys
   * @returns {Object} Scheduling information
   */
  updateScheduleBasedOnKeys() {
    const totalMonthlyQuota = this.apiKeys.length * 100;
    const usableQuota = Math.floor(totalMonthlyQuota * 0.9); // 90% of total
    
    // Calculate schedules
    const constants = require('../config/constants');
    const countries = require('../config/countries');
    const totalCombinations = constants.CATEGORIES.length * countries.length;
    
    // How many times per month we can update each combination
    const updatesPerCombination = Math.floor(usableQuota / totalCombinations);
    
    // Days between updates
    const daysBetweenUpdates = Math.max(1, Math.floor(30 / updatesPerCombination));
    
    logger.info(`With ${this.apiKeys.length} API keys, each combination can be updated every ${daysBetweenUpdates} days`);
    
    return {
      apiKeys: this.apiKeys.length,
      totalQuota: totalMonthlyQuota,
      usableQuota,
      totalCombinations,
      updatesPerCombination,
      daysBetweenUpdates
    };
  }
  
  /**
   * Get API quota statistics for admin dashboard
   * @returns {Object} API quota statistics
   */
  getQuotaStatistics() {
    return {
      apiKeys: this.apiKeys.map(key => ({
        // Show only first/last 4 chars for security
        key: `${key.key.substring(0, 4)}...${key.key.substring(key.key.length - 4)}`,
        usageCount: key.usageCount,
        maxMonthly: key.maxMonthly,
        remainingCalls: key.maxMonthly - key.usageCount,
        usagePercentage: Math.round((key.usageCount / key.maxMonthly) * 100)
      })),
      totalKeys: this.apiKeys.length,
      totalMonthlyQuota: this.apiKeys.length * 100,
      usableMonthlyQuota: this.monthlyAllocation,
      currentMonthUsage: this.currentMonthUsage,
      remainingMonthlyQuota: this.monthlyAllocation - this.currentMonthUsage,
      usagePercentage: Math.round((this.currentMonthUsage / this.monthlyAllocation) * 100),
      schedule: this.updateScheduleBasedOnKeys()
    };
  }
  
  /**
   * Force a reset of the API quota tracking
   * Useful for administrative purposes or debugging
   * @returns {Promise<Object>} Reset statistics
   */
  async forceResetQuotaTracking() {
    try {
      // Connect to admin database
      const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: 'admin_db',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      });
      
      // Get current month and year
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      // Reset all API keys for current month
      const results = await pool.query(
        `UPDATE api_quota_tracking 
         SET usage_count = 0, last_updated = NOW()
         WHERE month = $1 AND year = $2
         RETURNING api_key`,
        [currentMonth, currentYear]
      );
      
      // Reset local tracking
      for (const key of this.apiKeys) {
        key.usageCount = 0;
      }
      this.currentMonthUsage = 0;
      
      pool.end();
      
      logger.info(`API quota tracking forcefully reset for ${results.rowCount} keys`);
      
      return {
        resetKeys: results.rowCount,
        message: 'API quota tracking reset successfully'
      };
    } catch (error) {
      logger.error(`Error resetting API quota tracking: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ApiQuotaManager();