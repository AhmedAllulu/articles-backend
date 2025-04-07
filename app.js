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

// ✅ Trust proxy if behind reverse proxy (like Nginx, Heroku, etc.)
app.set('trust proxy', 1);

// ✅ Optional HTTPS redirect middleware (enabled via env var)
if (process.env.ENFORCE_HTTPS === 'true') {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      next();
    } else {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  });
}

// ✅ Security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ✅ CORS configuration
const corsOrigins = Object.values(constants.WEBSITES).map(site => `https://${site}`);
if (process.env.NODE_ENV === 'development') {
  corsOrigins.push('https://localhost:8080');
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

// ✅ Parse requests with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ✅ Compression
app.use(compression({
  threshold: 0,
  level: 6,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// ✅ HTTP request logging
app.use(morgan('combined', {
  stream: {
    write: message => logger.http(message.trim())
  }
}));

// ✅ Static files (e.g. uploads)
app.use('/uploads', express.static(path.join(__dirname, './uploads'), {
  maxAge: '1d',
  etag: true
}));

// ✅ Rate limiting middleware
app.use('/api/', rateLimiter.apiLimiter);
app.use('/admin/', rateLimiter.strictLimiter);
app.use('/auth/', rateLimiter.apiLimiter);
app.use('/health', rateLimiter.publicLimiter);

// ✅ Swagger API docs
setupSwagger(app);

// ✅ Route definitions
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

// ✅ Development-only routes
if (process.env.NODE_ENV === 'development') {
  app.use('/dev', developmentRoutes);
}

// ✅ Not found and error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// ✅ Export app
module.exports = app;
