// routes/development.js
const express = require('express');
const generationService = require('../services/generationService');
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
    const result = await generationService.generateArticlesForAll({
      forceDevelopment: true
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

// Export router
module.exports = router;