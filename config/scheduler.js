// config/scheduler.js
const cron = require('node-cron');
const logger = require('./logger');
const generationService = require('../services/generationService');
const constants = require('./constants');

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
 * Set up the production scheduler to run during discount hours
 */
function setupProductionScheduler() {
  logger.info('Setting up production scheduler');
  
  // Schedule article generation to run every hour during discount hours
  // This runs at 0 minutes of every hour between 16:00 and 23:00 (4 PM to 11 PM)
  cron.schedule('0 16-23 * * *', async () => {
    logger.info('Running scheduled article generation');
    
    try {
      const result = await generationService.generateArticlesForAll();
      logger.info(`Scheduled generation completed: ${JSON.stringify(result.stats)}`);
    } catch (error) {
      logger.error(`Error in scheduled generation: ${error.message}`);
    }
  });
  
  // Schedule trend fetching to run at 8 AM and 2 PM every day
  // This ensures we have fresh trends before article generation starts
  cron.schedule('0 8,14 * * *', async () => {
    logger.info('Running scheduled trend fetching');
    
    try {
      for (const category of constants.CATEGORIES) {
        for (const country of require('./countries')) {
          try {
            const trendsService = require('../services/trendsService');
            const trends = await trendsService.fetchTrendingKeywords(category, country.code);
            
            if (trends.length > 0) {
              await trendsService.storeTrends(category, country.code, trends);
              logger.info(`Fetched and stored ${trends.length} trends for ${category}/${country.code}`);
            }
          } catch (error) {
            logger.error(`Error fetching trends for ${category}/${country.code}: ${error.message}`);
          }
        }
      }
      
      logger.info('Scheduled trend fetching completed');
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
  initScheduler
};
