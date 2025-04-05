// routes/admin.js
const express = require('express');
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth.authenticate);

// Admin endpoints
router.post('/articles/generate', adminController.generateArticles);
router.get('/trends/:category/:countryCode', adminController.getTrends);
router.post('/trends/fetch', adminController.fetchTrends);

// Export router
module.exports = router;