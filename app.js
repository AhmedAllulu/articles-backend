// app.js (partial update to use consistent rate limiting)
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./config/logger');
const constants = require('./config/constants');
const rateLimiter = require('./middleware/rateLimiter');

// Import routes
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const developmentRoutes = require('./routes/development');

// Initialize express app
const app = express();

// Apply security middleware
app.use(helmet());

// Configure CORS
const corsOptions = {
  origin: Object.values(constants.WEBSITES).map(site => `https://${site}`),
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan('combined', { stream: { write: message => logger.http(message.trim()) } }));

// Rate limiting - Using the pre-configured limiters from middleware/rateLimiter.js
app.use('/api/', rateLimiter.apiLimiter);
app.use('/admin/', rateLimiter.strictLimiter);

// Public endpoints get more lenient rate limiting
app.use('/api/status', rateLimiter.publicLimiter);

// Routes
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// Only include development routes in development environment
if (process.env.NODE_ENV === 'development') {
  app.use('/dev', developmentRoutes);
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Not found',
      status: 404
    }
  });
});

module.exports = app;