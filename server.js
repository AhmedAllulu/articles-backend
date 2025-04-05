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
