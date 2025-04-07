// config/optimizedScheduler.js
const cron = require('node-cron');
const logger = require('./logger');
const optimizedTrendsService = require('../services/optimizedTrendsService');
const generationService = require('../services/generationService');
const apiQuotaManager = require('../services/apiQuotaManager');

// Simple job locks to prevent overlapping executions
const jobLocks = {
  articleGeneration: false,
  trendFetching: false
};

/**
 * Initialize the optimized scheduler for API usage
 */
function initOptimizedScheduler() {
  if (process.env.NODE_ENV === 'production') {
    setupProductionScheduler();
  } else {
    setupDevelopmentScheduler();
  }
}

/**
 * Execute a job with a lock to prevent overlapping executions
 * @param {string} lockName - Name of the lock
 * @param {Function} jobFunction - Function to execute
 * @returns {Promise<any>} Job result
 */
async function executeWithLock(lockName, jobFunction) {
  // Check if job is already running
  if (jobLocks[lockName]) {
    logger.warn(`Job ${lockName} is already running, skipping this execution`);
    return { skipped: true };
  }
  
  try {
    // Acquire lock
    jobLocks[lockName] = true;
    logger.info(`Starting job: ${lockName}`);
    
    // Execute job
    const result = await jobFunction();
    
    logger.info(`Job ${lockName} completed successfully`);
    return result;
  } catch (error) {
    logger.error(`Error in job ${lockName}: ${error.message}`);
    throw error;
  } finally {
    // Release lock
    jobLocks[lockName] = false;
  }
}

/**
 * Set up the production scheduler with optimized API usage
 * Divides trend fetching across the month to stay within API limits
 */
function setupProductionScheduler() {
  logger.info('Setting up optimized production scheduler');
  
  // Get the monthly schedule information
  const schedule = optimizedTrendsService.createMonthlySchedule();
  logger.info(`Monthly schedule: ${schedule.message}`);
  
  // Schedule trend fetching to run on specific days
  // This runs a batch of trend fetching 5-6 times per month (once every ~5 days)
  // Each batch uses ~35 API calls (1/6 of monthly quota)
  
  // Run trends fetching job every 5 days at 8 AM
  // This means we'll fetch trends approximately 6 times per month
  // With 35 combinations, that's about 6 combinations per run to stay within 200 monthly quota
  cron.schedule('0 8 */5 * *', async () => {
    try {
      await executeWithLock('trendFetching', async () => {
        logger.info('Running scheduled trend fetching (optimized batch)');
        // Fetch for 6 combinations based on priority
        const result = await optimizedTrendsService.fetchOptimizedTrends(6);
        logger.info(`Scheduled trend fetching completed. API calls used: ${result.fetches}`);
        return result;
      });
    } catch (error) {
      logger.error(`Error in scheduled trend fetching: ${error.message}`);
    }
  });
  
  // Schedule article generation based on discount hours
  // Run article generation during DeepSeek discount hours 
  // This runs at 0 minutes of every 2 hours between 16:00 and 23:00 (4 PM to 11 PM)
  cron.schedule('0 16-23/2 * * *', async () => {
    try {
      await executeWithLock('articleGeneration', async () => {
        logger.info('Running scheduled article generation');
        
        // Check if we have enough unused trends
        // We'll try to generate one article per category-country combination
        const result = await generationService.generateArticlesForAll({
          maxCombinations: 5 // Limit to 5 combinations per batch to avoid overloading
        });
        
        logger.info(`Scheduled generation completed: ${JSON.stringify(result.stats)}`);
        return result;
      });
    } catch (error) {
      logger.error(`Error in scheduled generation: ${error.message}`);
    }
  });
  
  // Schedule a monthly quota reset check at midnight on the 1st day of each month
  cron.schedule('0 0 1 * *', async () => {
    try {
      logger.info('Running monthly quota reset');
      
      // Re-initialize the API quota manager to reset counters for the new month
      await apiQuotaManager._initializeFromDatabase();
      
      logger.info('Monthly quota reset completed');
    } catch (error) {
      logger.error(`Error in monthly quota reset: ${error.message}`);
    }
  });
  
  // Schedule trend sharing to run daily at 3 AM
  // This helps maximize usage of existing trends without API calls
  cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('Running daily trend sharing between countries');
      
      const sharedCount = await apiQuotaManager.shareTrendsBetweenCountries();
      
      logger.info(`Daily trend sharing completed. Shared ${sharedCount} trends.`);
    } catch (error) {
      logger.error(`Error in daily trend sharing: ${error.message}`);
    }
  });
  
  logger.info('Optimized production scheduler set up successfully');
}

/**
 * Set up a development scheduler for testing
 */
function setupDevelopmentScheduler() {
  logger.info('Setting up development scheduler (not actively running jobs)');
  
  // In development mode, we don't automatically run the scheduler
  // Instead, we use the dev endpoints to manually trigger operations
}

/**
 * Run the optimized fetch trends job manually
 * @param {number} batchSize - Number of combinations to fetch
 * @returns {Promise<Object>} Result of the job
 */
async function runOptimizedFetchTrendsJob(batchSize = 6) {
  return executeWithLock('trendFetching', async () => {
    logger.info(`Running manual optimized trend fetching (batch size: ${batchSize})`);
    const result = await optimizedTrendsService.fetchOptimizedTrends(batchSize);
    logger.info(`Manual trend fetching completed. API calls used: ${result.fetches}`);
    return result;
  });
}

/**
 * Run the article generation job manually with optimizations
 * @param {number} maxCombinations - Maximum number of combinations to process
 * @returns {Promise<Object>} Result of the job
 */
async function runOptimizedArticleGenerationJob(maxCombinations = 5) {
  return executeWithLock('articleGeneration', async () => {
    logger.info(`Running manual article generation (max combinations: ${maxCombinations})`);
    const result = await generationService.generateArticlesForAll({
      forceDevelopment: true,
      maxCombinations
    });
    logger.info(`Manual generation completed: ${JSON.stringify(result.stats)}`);
    return result;
  });
}

/**
 * Run trend sharing manually
 * @returns {Promise<number>} Number of trends shared
 */
async function runTrendSharingJob() {
  logger.info('Running manual trend sharing between countries');
  
  const sharedCount = await apiQuotaManager.shareTrendsBetweenCountries();
  
  logger.info(`Manual trend sharing completed. Shared ${sharedCount} trends.`);
  return sharedCount;
}

/**
 * Get current API quota status
 * @returns {Object} API quota status
 */
function getApiQuotaStatus() {
  return {
    currentMonthUsage: apiQuotaManager.currentMonthUsage,
    monthlyAllocation: apiQuotaManager.monthlyAllocation,
    remaining: apiQuotaManager.monthlyAllocation - apiQuotaManager.currentMonthUsage,
    apiKeys: apiQuotaManager.apiKeys.map(key => ({
      keyPrefix: key.key.substring(0, 8) + '...',
      usageCount: key.usageCount,
      maxMonthly: key.maxMonthly,
      remaining: key.maxMonthly - key.usageCount
    })),
    schedule: optimizedTrendsService.createMonthlySchedule()
  };
}

module.exports = {
  initOptimizedScheduler,
  isJobRunning: (jobName) => jobLocks[jobName] || false,
  runOptimizedFetchTrendsJob,
  runOptimizedArticleGenerationJob,
  runTrendSharingJob,
  getApiQuotaStatus
};