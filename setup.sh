#!/bin/bash

# Add content to .env.example
cat > .env.example << 'END'
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_secure_password

# JWT Authentication
JWT_SECRET=your_very_secure_jwt_secret_key

# API Keys
TRENDS_API_URL=https://trends-api.example.com
TRENDS_API_KEY=your_trends_api_key

DEEPSEEK_API_URL=https://api.deepseek.com/v1/completions
DEEPSEEK_API_KEY=your_deepseek_api_key

# Logging
LOG_LEVEL=info
END

# Copy example env to .env
cp .env.example .env

# Create package.json with scripts
cat > package.json << 'END'
{
  "name": "articles-backend",
  "version": "1.0.0",
  "description": "Multi-language news article generation backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  },
  "keywords": [
    "news",
    "articles",
    "multilingual",
    "backend"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "axios": "^1.6.2",
    "bcrypt": "^5.1.1",
    "config": "^3.3.9",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.4",
    "helmet": "^7.1.0",
    "i18n": "^0.15.1",
    "joi": "^17.11.0",
    "jsonwebtoken": "^9.0.2",
    "knex": "^3.0.1",
    "moment": "^2.29.4",
    "morgan": "^1.10.0",
    "node-cron": "^3.0.3",
    "pg": "^8.11.3",
    "pg-pool": "^3.6.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.0.1"
  }
}
END

# Add content to config/countries.js
cat > config/countries.js << 'END'
module.exports = [
  { country: 'USA', code: 'US', language: 'en' },
  { country: 'UK', code: 'GB', language: 'en' },
  { country: 'Canada', code: 'CA', language: 'en' },
  { country: 'Germany', code: 'DE', language: 'de' },
  { country: 'France', code: 'FR', language: 'fr' },
  { country: 'Saudi Arabia', code: 'SA', language: 'ar' },
  { country: 'Australia', code: 'AU', language: 'en' }
];
END

# Add content to config/constants.js
cat > config/constants.js << 'END'
module.exports = {
  CATEGORIES: ['tech', 'sports', 'politics', 'health', 'general'],
  WEBSITES: {
    tech: 'news-tech.com',
    sports: 'news-sport.com',
    politics: 'news-politics.com',
    health: 'news-health.com',
    general: 'news-general.com'
  },
  TREND_STATUS: {
    USED: 'used',
    NOT_USED: 'not_used'
  },
  DEEPSEEK_DISCOUNT_START: 16, // 4 PM in 24-hour format
  DEEPSEEK_DISCOUNT_END: 24,   // 12 AM in 24-hour format
  API_RATE_LIMIT: 100,         // requests per 15 minutes
};
END

# Create basic server.js
cat > server.js << 'END'
require('dotenv').config();
const app = require('./app');
const logger = require('./config/logger');
const scheduler = require('./config/scheduler');
const db = require('./db/connections');

// Set port
const PORT = process.env.PORT || 3000;

// Initialize database connections
db.initializePools();

// Ensure necessary schemas and tables exist
db.ensureSchemas().then(() => {
  logger.info('Database schemas initialized');
}).catch(err => {
  logger.error(`Error initializing database schemas: ${err.message}`);
});

// Initialize scheduler in production
if (process.env.NODE_ENV === 'production') {
  scheduler.initScheduler();
  logger.info('Scheduler initialized');
}

// Start the server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Handle shutdown gracefully
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  logger.info('Shutting down server...');
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await db.closeAllPools();
      logger.info('Database connections closed');
      process.exit(0);
    } catch (err) {
      logger.error(`Error closing database connections: ${err.message}`);
      process.exit(1);
    }
  });
  
  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}
END

# Create basic app.js
cat > app.js << 'END'
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
END

# Create basic logger
cat > config/logger.js << 'END'
const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Tell winston that we want to link the colors
winston.addColors(colors);

// Custom format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define which transports we want to use
const transports = [
  // Console logger
  new winston.transports.Console(),
  // Error log file
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
  }),
  // All logs file
  new winston.transports.File({ 
    filename: path.join(__dirname, '../logs/combined.log') 
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports,
});

module.exports = logger;
END

echo "Basic project structure created successfully!"
