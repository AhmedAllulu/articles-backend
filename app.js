const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./config/logger');
const constants = require('./config/constants');

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

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: constants.API_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests, please try again later.'
  }
});
app.use('/api/', apiLimiter);

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
