// scripts/migrations.js
require('dotenv').config();
const db = require('../db/connections');
const dbUtils = require('../utils/dbUtils');
const logger = require('../config/logger');
const constants = require('../config/constants');
const countries = require('../config/countries');

/**
 * Run all migrations
 */
async function runAllMigrations() {
  logger.info('Starting all migrations');
  
  // Initialize pools before using them
  db.initializePools();
  
  // Wait a moment for pools to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Ensure schemas exist
  await db.ensureSchemas();
  
  // Run migrations
  await addImageUrlColumn();
  await addUpdatedAtColumn();
  await initializeAdminDatabase();
  
  logger.info('All migrations completed');
  
  // Close database connections
  await db.closeAllPools();
  process.exit(0);
}

/**
 * Add image_url column to articles tables
 */
async function addImageUrlColumn() {
  logger.info('Starting migration: Add image_url column to articles tables');
  
  for (const category of constants.CATEGORIES) {
    for (const country of countries) {
      try {
        logger.info(`Processing ${category}/${country.code}`);
        
        // Initialize database connection if needed
        try {
          const pool = db.getPool(category, country.code);
          if (!pool) {
            throw new Error('Pool not initialized');
          }
        } catch (error) {
          logger.warn(`Pool not initialized for ${category}/${country.code}, initializing`);
          db.initializePools();
        }
        
        // Add column if it doesn't exist
        await dbUtils.safeAddColumn(
          category,
          country.code,
          'articles',
          'image_url TEXT'
        );
        
        logger.info(`Added image_url column to ${category}/${country.code}.articles`);
      } catch (error) {
        logger.error(`Error adding image_url column to ${category}/${country.code}.articles: ${error.message}`);
      }
    }
  }
  
  logger.info('Migration complete: Add image_url column to articles tables');
}

/**
 * Add updated_at column to articles tables
 */
async function addUpdatedAtColumn() {
  logger.info('Starting migration: Add updated_at column to articles tables');
  
  for (const category of constants.CATEGORIES) {
    for (const country of countries) {
      try {
        logger.info(`Processing ${category}/${country.code}`);
        
        // Add column if it doesn't exist
        await dbUtils.safeAddColumn(
          category,
          country.code,
          'articles',
          'updated_at TIMESTAMP'
        );
        
        // Set current values
        await db.query(
          category,
          country.code,
          `UPDATE articles SET updated_at = created_at WHERE updated_at IS NULL`
        );
        
        // Add trigger for automatic updates
        await dbUtils.withTransaction(category, country.code, async (client) => {
          await dbUtils.addTimestampTrigger(client, 'articles');
        });
        
        logger.info(`Added updated_at column to ${category}/${country.code}.articles`);
      } catch (error) {
        logger.error(`Error adding updated_at column to ${category}/${country.code}.articles: ${error.message}`);
      }
    }
  }
  
  logger.info('Migration complete: Add updated_at column to articles tables');
}

/**
 * Create admin database tables
 */
async function initializeAdminDatabase() {
  logger.info('Starting migration: Initialize admin database');
  
  try {
    const { initAdminDb } = require('../models/User');
    await initAdminDb();
    
    logger.info('Admin database initialized');
  } catch (error) {
    logger.error(`Error initializing admin database: ${error.message}`);
  }
}

/**
 * Run all migrations
 */
async function runAllMigrations() {
  logger.info('Starting all migrations');
  
  // Ensure schemas exist
  await db.ensureSchemas();
  
  // Run migrations
  await addImageUrlColumn();
  await addUpdatedAtColumn();
  await initializeAdminDatabase();
  
  logger.info('All migrations completed');
  
  // Close database connections
  await db.closeAllPools();
  process.exit(0);
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runAllMigrations().catch(error => {
    logger.error(`Migration error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  addImageUrlColumn,
  addUpdatedAtColumn,
  initializeAdminDatabase,
  runAllMigrations
};