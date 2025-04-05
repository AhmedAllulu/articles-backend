// server.js with improved graceful shutdown
require('dotenv').config();
const app = require('./app');
const logger = require('./config/logger');
const db = require('./db/connections');
const { User, initAdminDb } = require('./models/User');
const scheduler = require('./config/scheduler');
const http = require('http');
const https = require('https');
const fs = require('fs');

// Set port
const PORT = process.env.PORT || 3300;
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds timeout for graceful shutdown

// Track ongoing requests
let ongoingRequests = 0;
let shuttingDown = false;

// Initialize database connections
async function startServer() {
  try {
    // Initialize database connections
    db.initializePools();
    logger.info('Database connection pools initialized');

    // Ensure necessary schemas and tables exist
    await db.ensureSchemas();
    logger.info('Database schemas initialized');

    // Initialize admin database
    await initAdminDb();
    logger.info('Admin database initialized');

    // Create the appropriate server based on environment
    let server;

    if (process.env.NODE_ENV === 'production') {
      try {
        const sslKeyPath = process.env.SSL_KEY_PATH;
        const sslCertPath = process.env.SSL_CERT_PATH;
        
        if (!sslKeyPath || !sslCertPath) {
          throw new Error('SSL paths not configured');
        }
        
        const options = {
          key: fs.readFileSync(sslKeyPath),
          cert: fs.readFileSync(sslCertPath),
        };
        
        server = https.createServer(options, app);
        logger.info('HTTPS server created with SSL certificates');
      } catch (error) {
        logger.error(`Failed to load SSL certificates: ${error.message}`);
        logger.warn('Falling back to HTTP server');
        server = http.createServer(app);
      }
    } else {
      server = http.createServer(app);
      logger.info('HTTP server created for development environment');
    }

    // Middleware to track ongoing requests
    app.use((req, res, next) => {
      if (shuttingDown) {
        // If we're shutting down, don't accept new requests
        res.status(503).json({
          success: false,
          error: {
            message: 'Server is shutting down',
            status: 503
          },
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      ongoingRequests++;
      
      // On request completion
      res.on('finish', () => {
        ongoingRequests--;
      });
      
      next();
    });

    // Start the server
    server.listen(PORT, () => {
      const protocol = process.env.NODE_ENV === 'production' ? 'HTTPS' : 'HTTP';
      logger.info(`Server running on ${protocol} port ${PORT} in ${process.env.NODE_ENV} mode`);
      logger.info(`API Documentation available at ${protocol.toLowerCase()}://localhost:${PORT}/api-docs`);
    });

    // Initialize scheduler in production
    if (process.env.NODE_ENV === 'production') {
      scheduler.initScheduler();
      logger.info('Scheduler initialized');
    }

    // Implement graceful shutdown
    const gracefulShutdown = async (signal) => {
      if (shuttingDown) return; // Prevent multiple shutdown calls
      
      shuttingDown = true;
      const startTime = Date.now();
      
      logger.info(`${signal} received, starting graceful shutdown...`);
      logger.info(`${ongoingRequests} requests still in progress`);
      
      // Create a timeout that will force exit if graceful shutdown takes too long
      const forceExit = setTimeout(() => {
        logger.error(`Forcing shutdown after timeout with ${ongoingRequests} requests still in progress`);
        process.exit(1);
      }, SHUTDOWN_TIMEOUT);
      
      // Wait for ongoing requests to complete
      setTimeout(async () => {
        // Close the HTTP server first to stop accepting new requests
        server.close(async () => {
          logger.info('HTTP server closed');
          
          try {
            // Close database connections
            await db.closeAllPools();
            logger.info('Database connections closed');
            
            const duration = Date.now() - startTime;
            logger.info(`Graceful shutdown completed in ${duration}ms`);
            
            clearTimeout(forceExit);
            process.exit(0);
          } catch (err) {
            logger.error(`Error closing database connections: ${err.message}`);
            clearTimeout(forceExit);
            process.exit(1);
          }
        });
      }, ongoingRequests > 0 ? 5000 : 0); // Wait 5 seconds if there are ongoing requests
    };

    // Handle shutdown gracefully
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start the server', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason, promise });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

startServer();