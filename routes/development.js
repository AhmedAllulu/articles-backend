// routes/development.js
const express = require('express');
const generationService = require('../services/generationService');
const trendsService = require('../services/trendsService');
const scheduler = require('../config/scheduler');
const constants = require('../config/constants');
const logger = require('../config/logger');

const router = express.Router();

// Development-only endpoints for testing
router.post('/generate-articles', async (req, res) => {
  try {
    const { category, countryCode, count } = req.body;
    
    if (!category || !countryCode) {
      return res.status(400).json({
        error: {
          message: 'Missing required parameters: category, countryCode',
          status: 400
        }
      });
    }
    
    const result = await generationService.generateArticlesForCategoryAndCountry(
      category,
      countryCode,
      count || 1
    );
    
    res.json(result);
  } catch (error) {
    logger.error(`Error in generate-articles: ${error.message}`);
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
});

router.post('/generate-all', async (req, res) => {
  try {
    const { maxArticles = 5, maxCombinations = 5 } = req.body;
    
    const result = await generationService.generateArticlesForAll({
      forceDevelopment: true,
      maxArticlesPerDay: maxArticles,
      maxCombinations: maxCombinations
    });
    
    res.json(result);
  } catch (error) {
    logger.error(`Error in generate-all: ${error.message}`);
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
});

// Add new endpoints for trend fetching
router.post('/fetch-trends', async (req, res) => {
  try {
    const { category, countryCode } = req.body;
    
    if (!category || !countryCode) {
      return res.status(400).json({
        error: {
          message: 'Missing required parameters: category, countryCode',
          status: 400
        }
      });
    }
    
    const result = await trendsService.fetchTrendingKeywords(
      category,
      countryCode
    );
    
    res.json(result);
  } catch (error) {
    logger.error(`Error in fetch-trends: ${error.message}`);
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
});

router.post('/fetch-all-trends', async (req, res) => {
  try {
    const result = await scheduler.runFetchTrendsJob();
    
    res.json(result);
  } catch (error) {
    logger.error(`Error in fetch-all-trends: ${error.message}`);
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
});

// Add endpoint for completing the full process
router.post('/full-process', async (req, res) => {
  try {
    logger.info('Starting full generation process: 1. Fetch trends, 2. Generate articles');
    
    // Step 1: Fetch all trends
    logger.info('Step 1: Fetching trends for all categories and countries');
    const trendsResult = await scheduler.runFetchTrendsJob();
    
    // Step 2: Generate articles
    logger.info('Step 2: Generating articles for all categories and countries');
    const articlesResult = await scheduler.runArticleGenerationJob({
      maxArticlesPerDay: 5, // Limit to 5 for development
      maxCombinations: 5
    });
    
    res.json({
      message: 'Full process completed successfully',
      trends: trendsResult,
      articles: articlesResult
    });
  } catch (error) {
    logger.error(`Error in full-process: ${error.message}`);
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
});

// Add endpoint to get generation stats
router.get('/generation-stats', async (req, res) => {
  try {
    // Get scheduler stats
    const schedulerStats = scheduler.getJobStats();
    
    // Get articles generated today
    const articlesGeneratedToday = await generationService.countArticlesGeneratedToday();
    
    res.json({
      date: new Date().toISOString(),
      articlesGeneratedToday,
      dailyQuota: constants.GENERATION.MAX_ARTICLES_PER_DAY,
      quotaRemaining: Math.max(0, constants.GENERATION.MAX_ARTICLES_PER_DAY - articlesGeneratedToday),
      scheduler: schedulerStats,
      constants: {
        maxArticlesPerDay: constants.GENERATION.MAX_ARTICLES_PER_DAY,
        maxPerCategory: constants.GENERATION.MAX_PER_CATEGORY,
        maxPerCountry: constants.GENERATION.MAX_PER_COUNTRY
      }
    });
  } catch (error) {
    logger.error(`Error in generation-stats: ${error.message}`);
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
});

// Export router
module.exports = router;