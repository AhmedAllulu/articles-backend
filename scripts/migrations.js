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
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Ensure schemas exist
    try {
      await db.ensureSchemas();
      logger.info('Schemas verified');
    } catch (error) {
      logger.error(`Error ensuring schemas: ${error.message}`);
      // Continue with migrations anyway
    }
    
    // Run migrations
    await addImageUrlColumn();
    await addUpdatedAtColumn();
    await initializeAdminDatabase();
    
    logger.info('All migrations completed');
    
    // Close database connections
    await db.closeAllPools();
    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Migration error: ${error.message}`);
    console.error('Migration failed:', error.message);
    try {
      await db.closeAllPools();
    } catch (err) {
      logger.error(`Error closing pools: ${err.message}`);
    }
    process.exit(1);
  }
}

/**
 * Add image_url column to articles tables
 */
async function addImageUrlColumn() {
  logger.info('Starting migration: Add image_url column to articles tables');
  
  for (const category of constants.CATEGORIES) {
    logger.info(`Processing category: ${category}`);
    
    for (const country of countries) {
      try {
        logger.info(`Processing ${category}/${country.code}`);
        
        // Get db pool
        try {
          const pool = db.getPool(category);
          if (!pool) {
            throw new Error(`Pool not available for ${category}`);
          }
          
          // Add column if it doesn't exist
          await db.query(
            category,
            country.code,
            `DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = '${country.code.toLowerCase()}' 
                AND table_name = 'articles' 
                AND column_name = 'image_url'
              ) THEN
                ALTER TABLE ${country.code.toLowerCase()}.articles ADD COLUMN image_url TEXT;
              END IF;
            END $$;`
          );
          
          logger.info(`Processed image_url column for ${category}/${country.code}.articles`);
        } catch (error) {
          logger.error(`Error getting pool for ${category}: ${error.message}`);
        }
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
        await db.query(
          category,
          country.code,
          `DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_schema = '${country.code.toLowerCase()}' 
              AND table_name = 'articles' 
              AND column_name = 'updated_at'
            ) THEN
              ALTER TABLE ${country.code.toLowerCase()}.articles ADD COLUMN updated_at TIMESTAMP;
              UPDATE ${country.code.toLowerCase()}.articles SET updated_at = created_at WHERE updated_at IS NULL;
            END IF;
          END $$;`
        );
        
        // Add trigger function if it doesn't exist
        await db.query(
          category,
          country.code,
          `CREATE OR REPLACE FUNCTION ${country.code.toLowerCase()}.update_updated_at()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;`
        );
        
        // Create or replace trigger
        await db.query(
          category,
          country.code,
          `DROP TRIGGER IF EXISTS update_articles_updated_at ON ${country.code.toLowerCase()}.articles;
          CREATE TRIGGER update_articles_updated_at
          BEFORE UPDATE ON ${country.code.toLowerCase()}.articles
          FOR EACH ROW
          EXECUTE FUNCTION ${country.code.toLowerCase()}.update_updated_at();`
        );
        
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

// Run migrations if this script is executed directly
if (require.main === module) {
  console.log('Starting migrations...');
  runAllMigrations().catch(error => {
    logger.error(`Migration error: ${error.message}`);
    console.error('Migration error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  addImageUrlColumn,
  addUpdatedAtColumn,
  initializeAdminDatabase,
  runAllMigrations
};