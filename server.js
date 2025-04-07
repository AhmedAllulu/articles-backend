// server.js with improved graceful shutdown
require('dotenv').config();
const app = require('./app');
const logger = require('./config/logger');
const db = require('./db/connections');
const { User, initAdminDb } = require('./models/User');
const scheduler = require('./config/scheduler');
const https = require('https');
const fs = require('fs');

// Set port
const PORT = process.env.PORT || 3300;
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds timeout for graceful shutdown

// Track ongoing requests
let ongoingRequests = 0;
let shuttingDown = false;

// SSL configuration
const options = {
  key: fs.readFileSync("/etc/letsencrypt/live/chato-app.com/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/chato-app.com/fullchain.pem"),
};

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

    // Create HTTPS server
    let server;
    try {
      server = https.createServer(options, app);
      logger.info('HTTPS server created with SSL certificates');
    } catch (error) {
      logger.error(`Failed to load SSL certificates: ${error.message}`);
      throw error; // Exit if SSL fails, no HTTP fallback
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
      logger.info(`Server running on HTTPS port ${PORT}`);
      logger.info(`API Documentation available at https://localhost:${PORT}/api-docs`);
    });

    // Initialize scheduler
    scheduler.initScheduler();
    logger.info('Scheduler initialized');

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
        // Close the HTTPS server first to stop accepting new requests
        server.close(async () => {
          logger.info('HTTPS server closed');
          
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