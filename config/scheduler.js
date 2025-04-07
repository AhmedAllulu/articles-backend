// config/scheduler.js
const cron = require('node-cron');
const logger = require('./logger');
const generationService = require('../services/generationService');
const trendsService = require('../services/trendsService');
const constants = require('./constants');

// Simple job locks to prevent overlapping executions
const jobLocks = {
  articleGeneration: false,
  trendFetching: false
};

// Track job statistics
const jobStats = {
  articleGeneration: {
    lastScheduled: null,
    lastStarted: null,
    lastCompleted: null,
    lastDuration: null,
    averageDuration: null,
    totalRuns: 0,
    todayRuns: 0,
    todayArticles: 0
  },
  trendFetching: {
    lastScheduled: null,
    lastStarted: null,
    lastCompleted: null,
    lastDuration: null,
    averageDuration: null,
    totalRuns: 0,
    todayRuns: 0
  }
};

// Configuration for verbose logging
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true' || false;
const GENERATION_LOGS_INTERVAL = parseInt(process.env.GENERATION_LOGS_INTERVAL || '60000', 10); // Default to 1 minute

/**
 * Initialize the scheduler for article generation
 */
function initScheduler() {
  logger.info('Initializing scheduler with configuration:');
  logger.info(`- Verbose logging: ${VERBOSE_LOGGING}`);
  logger.info(`- Logs interval: ${GENERATION_LOGS_INTERVAL}ms`);
  logger.info(`- Daily article quota: ${constants.GENERATION.MAX_ARTICLES_PER_DAY}`);
  
  // Reset daily counters at midnight
  setupDailyReset();
  
  if (process.env.NODE_ENV === 'production') {
    setupProductionScheduler();
  } else {
    setupDevelopmentScheduler();
  }
}

/**
 * Setup a cron job to reset daily counters at midnight
 */
function setupDailyReset() {
  cron.schedule('0 0 * * *', () => {
    logger.info('Resetting daily statistics at midnight');
    
    // Reset daily counters
    jobStats.articleGeneration.todayRuns = 0;
    jobStats.articleGeneration.todayArticles = 0;
    jobStats.trendFetching.todayRuns = 0;
    
    logger.info('Daily statistics reset complete');
  });
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
    return { skipped: true, reason: 'job_running' };
  }
  
  // Record scheduled time
  const scheduledTime = new Date();
  jobStats[lockName].lastScheduled = scheduledTime;
  logger.info(`Job ${lockName} scheduled at: ${scheduledTime.toISOString()}`);
  
  try {
    // Acquire lock
    jobLocks[lockName] = true;
    
    // Record start time and calculate delay from scheduling
    const startTime = new Date();
    jobStats[lockName].lastStarted = startTime;
    const delayMs = startTime - scheduledTime;
    logger.info(`Starting job: ${lockName} at ${startTime.toISOString()} (delay: ${delayMs}ms)`);
    
    // Setup progress interval logger if enabled
    let intervalId = null;
    let progressIntervals = 0;
    
    if (VERBOSE_LOGGING) {
      intervalId = setInterval(() => {
        if (jobLocks[lockName]) {
          progressIntervals++;
          const currentTime = new Date();
          const elapsedMs = currentTime - startTime;
          const elapsedMinutes = Math.floor(elapsedMs / 60000);
          const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
          logger.info(`Job ${lockName} still running after ${elapsedMinutes}m ${elapsedSeconds}s (interval #${progressIntervals})`);
        } else {
          // If the lock was released but the interval is still active, clear it
          clearInterval(intervalId);
        }
      }, GENERATION_LOGS_INTERVAL);
    }
    
    // Execute job with performance measurement
    const executionStartTime = process.hrtime.bigint();
    const result = await jobFunction();
    const executionEndTime = process.hrtime.bigint();
    const executionTimeNs = Number(executionEndTime - executionStartTime);
    const executionTimeMs = executionTimeNs / 1000000;
    
    // Record completion statistics
    const endTime = new Date();
    jobStats[lockName].lastCompleted = endTime;
    const durationMs = endTime - startTime;
    jobStats[lockName].lastDuration = durationMs;
    
    // Update average duration
    jobStats[lockName].totalRuns++;
    jobStats[lockName].todayRuns++;
    
    if (jobStats[lockName].averageDuration === null) {
      jobStats[lockName].averageDuration = durationMs;
    } else {
      // Moving average calculation
      jobStats[lockName].averageDuration = 
        (jobStats[lockName].averageDuration * (jobStats[lockName].totalRuns - 1) + durationMs) / 
        jobStats[lockName].totalRuns;
    }
    
    // Update article count if this is article generation
    if (lockName === 'articleGeneration' && result && result.stats) {
      jobStats.articleGeneration.todayArticles += result.stats.successful || 0;
    }
    
    logger.info(`Job ${lockName} completed successfully in ${durationMs}ms (execution: ${executionTimeMs.toFixed(2)}ms)`);
    
    // Clear the progress interval if it was set
    if (intervalId !== null) {
      clearInterval(intervalId);
      logger.debug(`Cleared interval logger for job ${lockName} after ${progressIntervals} updates`);
    }
    
    return {
      ...result,
      stats: {
        ...(result.stats || {}),
        scheduledAt: scheduledTime.toISOString(),
        startedAt: startTime.toISOString(),
        completedAt: endTime.toISOString(),
        delayMs,
        durationMs,
        executionTimeMs
      }
    };
  } catch (error) {
    const errorTime = new Date();
    const durationMs = errorTime - jobStats[lockName].lastStarted;
    logger.error(`Error in job ${lockName} after ${durationMs}ms: ${error.message}`);
    
    // Include additional error context for debugging
    logger.error(`Error context: scheduled=${jobStats[lockName].lastScheduled.toISOString()}, started=${jobStats[lockName].lastStarted.toISOString()}, failed=${errorTime.toISOString()}`);
    
    throw error;
  } finally {
    // Release lock
    jobLocks[lockName] = false;
    
    // If we want detailed statistics, log them
    if (VERBOSE_LOGGING) {
      logger.info(`Job ${lockName} statistics: totalRuns=${jobStats[lockName].totalRuns}, todayRuns=${jobStats[lockName].todayRuns}, avgDuration=${Math.round(jobStats[lockName].averageDuration)}ms`);
    }
  }
}

/**
 * Set up the production scheduler to run daily with quota limits
 */
function setupProductionScheduler() {
  logger.info('Setting up production scheduler with quota-based generation');
  
  // Split the daily quota into two batches
  const morningBatchSize = Math.ceil(constants.GENERATION.MAX_ARTICLES_PER_DAY * 0.6); // 60% in the morning
  const eveningBatchSize = constants.GENERATION.MAX_ARTICLES_PER_DAY - morningBatchSize; // Remainder in the evening
  
  logger.info(`Article generation schedule: morning batch: ${morningBatchSize}, evening batch: ${eveningBatchSize}`);
  
  // Schedule morning article generation batch at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info(`Running morning article generation batch (max: ${morningBatchSize} articles)`);
      
      const result = await executeWithLock('articleGeneration', async () => {
        logger.info('Starting morning article generation process');
        
        const articlesGenerated = await generationService.countArticlesGeneratedToday();
        
        // Skip if we've already generated more than our morning quota
        if (articlesGenerated >= morningBatchSize) {
          logger.info(`Already generated ${articlesGenerated} articles today, skipping morning batch`);
          return { skipped: true, reason: 'quota_reached' };
        }
        
        // Calculate remaining quota for morning batch
        const remainingQuota = morningBatchSize - articlesGenerated;
        
        const generationResult = await generationService.generateArticlesForAll({
          maxArticlesPerDay: remainingQuota,
          maxCombinations: 10 // Limit to 10 combinations per batch for diversity
        });
        
        logger.info(`Morning generation completed: ${JSON.stringify(generationResult.stats)}`);
        return generationResult;
      });
      
      if (result.skipped) {
        logger.warn(`Morning article generation was skipped: ${result.reason}`);
      } else {
        logger.info(`Morning article generation completed with stats: successful=${result.stats.successful}, failed=${result.stats.failed}, total=${result.stats.total}`);
      }
    } catch (error) {
      logger.error(`Critical error in morning article generation: ${error.message}`);
      logger.error(error.stack);
    }
  });
  
  // Schedule evening article generation batch at 3 PM
  cron.schedule('0 15 * * *', async () => {
    try {
      logger.info(`Running evening article generation batch (max: ${eveningBatchSize} articles)`);
      
      const result = await executeWithLock('articleGeneration', async () => {
        logger.info('Starting evening article generation process');
        
        const articlesGenerated = await generationService.countArticlesGeneratedToday();
        
        // Skip if we've already generated more than our total daily quota
        if (articlesGenerated >= constants.GENERATION.MAX_ARTICLES_PER_DAY) {
          logger.info(`Already generated ${articlesGenerated} articles today, skipping evening batch`);
          return { skipped: true, reason: 'quota_reached' };
        }
        
        // Calculate remaining quota for evening batch
        const remainingQuota = constants.GENERATION.MAX_ARTICLES_PER_DAY - articlesGenerated;
        
        const generationResult = await generationService.generateArticlesForAll({
          maxArticlesPerDay: remainingQuota,
          maxCombinations: 10 // Limit to 10 combinations per batch for diversity
        });
        
        logger.info(`Evening generation completed: ${JSON.stringify(generationResult.stats)}`);
        return generationResult;
      });
      
      if (result.skipped) {
        logger.warn(`Evening article generation was skipped: ${result.reason}`);
      } else {
        logger.info(`Evening article generation completed with stats: successful=${result.stats.successful}, failed=${result.stats.failed}, total=${result.stats.total}`);
      }
    } catch (error) {
      logger.error(`Critical error in evening article generation: ${error.message}`);
      logger.error(error.stack);
    }
  });
  
  // Schedule trend fetching to run at 8 AM and 2 PM every day
  // This ensures we have fresh trends before article generation
  cron.schedule('0 8,14 * * *', async () => {
    try {
      logger.info('Running scheduled trend fetching');
      
      const result = await executeWithLock('trendFetching', async () => {
        logger.info('Starting scheduled trend fetching process');
        const fetchResult = await trendsService.fetchAndStoreAllTrends();
        logger.info(`Scheduled trend fetching completed for ${Object.keys(fetchResult.results || {}).length} categories`);
        return fetchResult;
      });
      
      if (result.skipped) {
        logger.warn(`Trend fetching was skipped: ${result.reason}`);
      }
    } catch (error) {
      logger.error(`Critical error in scheduled trend fetching: ${error.message}`);
      logger.error(error.stack);
    }
  });
  
  // Log summary statistics daily
  cron.schedule('50 23 * * *', () => {
    logger.info('========= DAILY SCHEDULER STATISTICS =========');
    logger.info(`Daily Article Generation: runs=${jobStats.articleGeneration.todayRuns}, articles=${jobStats.articleGeneration.todayArticles}, quota=${constants.GENERATION.MAX_ARTICLES_PER_DAY}, avgDuration=${Math.round(jobStats.articleGeneration.averageDuration)}ms`);
    logger.info(`Daily Trend Fetching: runs=${jobStats.trendFetching.todayRuns}, avgDuration=${Math.round(jobStats.trendFetching.averageDuration)}ms`);
    logger.info('=============================================');
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
  logger.info('Development mode: Use /dev/generate-articles, /dev/generate-all, /dev/fetch-trends, or /dev/full-process to manually trigger jobs');
}

/**
 * Run the fetch trends job manually
 * @returns {Promise<Object>} Result of the job
 */
async function runFetchTrendsJob() {
  return executeWithLock('trendFetching', async () => {
    logger.info('Running manual trend fetching');
    const result = await trendsService.fetchAndStoreAllTrends();
    logger.info('Manual trend fetching completed');
    return result;
  });
}

/**
 * Run the article generation job manually
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Result of the job
 */
async function runArticleGenerationJob(options = {}) {
  return executeWithLock('articleGeneration', async () => {
    logger.info('Running manual article generation');
    
    // Default options with force development
    const generationOptions = {
      forceDevelopment: true,
      ...options
    };
    
    const result = await generationService.generateArticlesForAll(generationOptions);
    logger.info(`Manual generation completed: ${JSON.stringify(result.stats)}`);
    return result;
  });
}

/**
 * Get job statistics
 * @returns {Object} Current job statistics
 */
function getJobStats() {
  return {
    ...jobStats,
    currentTime: new Date().toISOString(),
    activeJobs: {
      articleGeneration: jobLocks.articleGeneration,
      trendFetching: jobLocks.trendFetching
    },
    quotaInfo: {
      dailyArticleQuota: constants.GENERATION.MAX_ARTICLES_PER_DAY,
      articlesGeneratedToday: jobStats.articleGeneration.todayArticles,
      remaining: Math.max(0, constants.GENERATION.MAX_ARTICLES_PER_DAY - jobStats.articleGeneration.todayArticles)
    }
  };
}

module.exports = {
  initScheduler,
  // Export job lock status check for testing and manual execution
  isJobRunning: (jobName) => jobLocks[jobName] || false,
  // Export manual job runners
  runFetchTrendsJob,
  runArticleGenerationJob,
  // Export job statistics
  getJobStats
};