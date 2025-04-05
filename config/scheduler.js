// config/scheduler.js
const cron = require('node-cron');
const logger = require('./logger');
const generationService = require('../services/generationService');
const constants = require('./constants');

// Simple job locks to prevent overlapping executions
const jobLocks = {
  articleGeneration: false,
  trendFetching: false
};

/**
 * Initialize the scheduler for article generation
 */
function initScheduler() {
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
 * Set up the production scheduler to run during discount hours
 */
function setupProductionScheduler() {
  logger.info('Setting up production scheduler');
  
  // Schedule article generation to run every hour during discount hours
  // This runs at 0 minutes of every hour between 16:00 and 23:00 (4 PM to 11 PM)
  cron.schedule('0 16-23 * * *', async () => {
    try {
      await executeWithLock('articleGeneration', async () => {
        logger.info('Running scheduled article generation');
        const result = await generationService.generateArticlesForAll();
        logger.info(`Scheduled generation completed: ${JSON.stringify(result.stats)}`);
        return result;
      });
    } catch (error) {
      logger.error(`Error in scheduled generation: ${error.message}`);
    }
  });
  
  // Schedule trend fetching to run at 8 AM and 2 PM every day
  // This ensures we have fresh trends before article generation starts
  cron.schedule('0 8,14 * * *', async () => {
    try {
      await executeWithLock('trendFetching', async () => {
        logger.info('Running scheduled trend fetching');
        
        const results = {};
        for (const category of constants.CATEGORIES) {
          results[category] = {};
          
          for (const country of require('./countries')) {
            try {
              const trendsService = require('../services/trendsService');
              const trends = await trendsService.fetchTrendingKeywords(category, country.code);
              
              if (trends.length > 0) {
                await trendsService.storeTrends(category, country.code, trends);
                logger.info(`Fetched and stored ${trends.length} trends for ${category}/${country.code}`);
                results[category][country.code] = {
                  count: trends.length,
                  status: 'success'
                };
              } else {
                results[category][country.code] = {
                  count: 0,
                  status: 'no trends found'
                };
              }
            } catch (error) {
              logger.error(`Error fetching trends for ${category}/${country.code}: ${error.message}`);
              results[category][country.code] = {
                status: 'error',
                message: error.message
              };
            }
          }
        }
        
        logger.info('Scheduled trend fetching completed');
        return results;
      });
    } catch (error) {
      logger.error(`Error in scheduled trend fetching: ${error.message}`);
    }
  });
  
  logger.info('Production scheduler set up successfully');
}

/**
 * Set up a development scheduler for testing
 */
function setupDevelopmentScheduler() {
  logger.info('Setting up development scheduler (not actively running jobs)');
  
  // In development mode, we don't automatically run the scheduler
  // Instead, we use the dev endpoints to manually trigger article generation
}

module.exports = {
  initScheduler,
  // Export job lock status check for testing and manual execution
  isJobRunning: (jobName) => jobLocks[jobName] || false
};