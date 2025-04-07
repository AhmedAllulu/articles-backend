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
    totalRuns: 0
  },
  trendFetching: {
    lastScheduled: null,
    lastStarted: null,
    lastCompleted: null,
    lastDuration: null,
    averageDuration: null,
    totalRuns: 0
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
  logger.info(`- Discount hours: ${constants.DEEPSEEK_DISCOUNT_START}-${constants.DEEPSEEK_DISCOUNT_END}`);
  
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
    if (jobStats[lockName].averageDuration === null) {
      jobStats[lockName].averageDuration = durationMs;
    } else {
      // Moving average calculation
      jobStats[lockName].averageDuration = 
        (jobStats[lockName].averageDuration * (jobStats[lockName].totalRuns - 1) + durationMs) / 
        jobStats[lockName].totalRuns;
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
      logger.info(`Job ${lockName} statistics: totalRuns=${jobStats[lockName].totalRuns}, avgDuration=${Math.round(jobStats[lockName].averageDuration)}ms`);
    }
  }
}

/**
 * Set up the production scheduler to run during discount hours
 */
function setupProductionScheduler() {
  logger.info('Setting up production scheduler');
  
  // Schedule article generation to run every hour during discount hours
  // This runs at 0 minutes of every hour between 16:00 and 23:00 (4 PM to 11 PM)
  const articleGenerationSchedule = `0 ${constants.DEEPSEEK_DISCOUNT_START}-${constants.DEEPSEEK_DISCOUNT_END-1} * * *`;
  cron.schedule(articleGenerationSchedule, async () => {
    try {
      logger.info(`Running scheduled article generation (cron: ${articleGenerationSchedule})`);
      const result = await executeWithLock('articleGeneration', async () => {
        logger.info('Starting scheduled article generation process');
        const generationResult = await generationService.generateArticlesForAll();
        logger.info(`Scheduled generation completed: ${JSON.stringify(generationResult.stats)}`);
        return generationResult;
      });
      
      if (result.skipped) {
        logger.warn(`Article generation was skipped: ${result.reason}`);
      } else {
        logger.info(`Article generation completed with stats: successful=${result.stats.successful}, failed=${result.stats.failed}, total=${result.stats.total}`);
      }
    } catch (error) {
      logger.error(`Critical error in scheduled article generation: ${error.message}`);
      logger.error(error.stack);
    }
  });
  
  // Schedule trend fetching to run at 8 AM and 2 PM every day
  // This ensures we have fresh trends before article generation starts
  const trendFetchingSchedule = '0 8,14 * * *';
  cron.schedule(trendFetchingSchedule, async () => {
    try {
      logger.info(`Running scheduled trend fetching (cron: ${trendFetchingSchedule})`);
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
  
  // Additional maintenance job to log statistics daily
  cron.schedule('0 0 * * *', () => {
    logger.info('========= DAILY SCHEDULER STATISTICS =========');
    logger.info(`Article Generation: runs=${jobStats.articleGeneration.totalRuns}, avgDuration=${Math.round(jobStats.articleGeneration.averageDuration)}ms`);
    logger.info(`Trend Fetching: runs=${jobStats.trendFetching.totalRuns}, avgDuration=${Math.round(jobStats.trendFetching.averageDuration)}ms`);
    logger.info('=============================================');
  });
  
  logger.info(`Production scheduler set up successfully with article generation at "${articleGenerationSchedule}" and trend fetching at "${trendFetchingSchedule}"`);
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
 * @returns {Promise<Object>} Result of the job
 */
async function runArticleGenerationJob() {
  return executeWithLock('articleGeneration', async () => {
    logger.info('Running manual article generation');
    const result = await generationService.generateArticlesForAll({
      forceDevelopment: true
    });
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