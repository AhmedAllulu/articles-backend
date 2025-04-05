// server.js with improved graceful shutdown
require('dotenv').config();
const app = require('./app');
const logger = require('./config/logger');
const scheduler = require('./config/scheduler');
const db = require('./db/connections');

// Set port
const PORT = process.env.PORT || 3000;

// Initialize database connections
db.initializePools();

// Track ongoing requests
let ongoingRequests = 0;
let shuttingDown = false;

// Middleware to track ongoing requests
app.use((req, res, next) => {
  if (shuttingDown) {
    // If we're shutting down, don't accept new requests
    res.status(503).json({
      error: {
        message: 'Server is shutting down',
        status: 503
      }
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
  if (shuttingDown) return; // Prevent multiple shutdown calls
  
  shuttingDown = true;
  const startTime = Date.now();
  
  logger.info('Shutting down server...');
  logger.info(`${ongoingRequests} requests still in progress`);
  
  // Give ongoing requests some time to complete
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
        process.exit(0);
      } catch (err) {
        logger.error(`Error closing database connections: ${err.message}`);
        process.exit(1);
      }
    });
  }, ongoingRequests > 0 ? 5000 : 0); // Wait 5 seconds if there are ongoing requests
  
  // Force shutdown after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error(`Forcing shutdown after timeout with ${ongoingRequests} requests still in progress`);
    process.exit(1);
  }, 30000);
}