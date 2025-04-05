// app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const logger = require('./config/logger');
const constants = require('./config/constants');
const rateLimiter = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { setupSwagger } = require('./config/swagger');
const path = require('path');

// Import routes
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const developmentRoutes = require('./routes/development');

// Initialize express app
const app = express();

// Apply security middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Configure CORS
const corsOrigins = Object.values(constants.WEBSITES).map(site => `https://${site}`);
if (process.env.NODE_ENV === 'development') {
  corsOrigins.push('http://localhost:8080');
}

const corsOptions = {
  origin: process.env.NODE_ENV === 'development' ? '*' : corsOrigins,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Request parsing with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Compression middleware
app.use(compression({
  threshold: 0,
  level: 6,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Request logging
app.use(morgan('combined', { stream: { write: message => logger.http(message.trim()) } }));

// Middleware to track ongoing requests (moved to server.js)

// Static files for uploads with cache headers
app.use('/uploads', express.static(path.join(__dirname, './uploads'), {
  maxAge: '1d',
  etag: true
}));

// Apply rate limiting based on route type
app.use('/api/', rateLimiter.apiLimiter);
app.use('/admin/', rateLimiter.strictLimiter);
app.use('/auth/', rateLimiter.apiLimiter);
app.use('/health', rateLimiter.publicLimiter);

// Setup Swagger API documentation
setupSwagger(app);

// Routes
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);
app.use('/health', healthRoutes);

// Only include development routes in development environment
if (process.env.NODE_ENV === 'development') {
  app.use('/dev', developmentRoutes);
}

// 404 handler
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

module.exports = app;