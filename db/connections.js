// db/connections.js
const { Pool } = require('pg');
const logger = require('../config/logger');
const dbConfig = require('../config/database');
const constants = require('../config/constants');
const countries = require('../config/countries');

// Connection pools per category and country
const pools = {};

// Initialize pools for all categories and countries
function initializePools() {
  // Create connection pools for each category
  constants.CATEGORIES.forEach(category => {
    const dbName = `news_${category}`;
    const config = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: dbName,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20, // max clients in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
    
    pools[category] = new Pool(config);
    
    // Log when connection is established
    pools[category].on('connect', () => {
      logger.info(`Connected to ${category} database`);
    });
    
    // Log errors
    pools[category].on('error', (err) => {
      logger.error(`Database error in ${category}: ${err.message}`);
    });
  });
  
  logger.info('All database connection pools initialized');
}

// Get pool for specific category and country
function getPool(category) {
  if (!pools[category]) {
    throw new Error(`No pool exists for ${category}`);
  }
  
  return pools[category];
}

// Execute query on specific category and country
async function query(category, countryCode, text, params) {
  const pool = getPool(category);
  const start = Date.now();
  
  try {
    // Get client from the pool
    const client = await pool.connect();
    try {
      // Set schema for this connection
      const schema = countryCode.toLowerCase();
      await client.query('SET search_path TO $1', [schema]);
      
      // Execute the actual query
      const res = await client.query(text, params);
      
      const duration = Date.now() - start;
      logger.debug(`Executed query on ${category}/${countryCode}: ${text} (${duration}ms)`);
      
      return res;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error(`Query error on ${category}/${countryCode}: ${err.message}`);
    throw err;
  }
}


// Close all pools (for graceful shutdown)
async function closeAllPools() {
  for (const category of Object.keys(pools)) {
    await pools[category].end();
    logger.info(`Closed pool for ${category}`);
  }
  logger.info('All database connection pools closed');
}

// Create required schemas if they don't exist
async function ensureSchemas() {
  for (const category of constants.CATEGORIES) {
    for (const country of countries) {
      const pool = getPool(category, country.code);
      const client = await pool.connect();
      
      try {
        // Create schema if it doesn't exist - Safely using the lowercase country code
        const schema = country.code.toLowerCase();
        await client.query('CREATE SCHEMA IF NOT EXISTS $1:name', [schema]);
        
        // Create necessary tables in this schema using proper parameterized identifiers
        await client.query(`
          CREATE TABLE IF NOT EXISTS $1:name.articles (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            trend_keyword TEXT NOT NULL,
            language VARCHAR(5) NOT NULL,
            image_url TEXT
          )
        `, [schema]);
        
        await client.query(`
          CREATE TABLE IF NOT EXISTS $1:name.trends (
            id SERIAL PRIMARY KEY,
            keyword TEXT NOT NULL,
            status VARCHAR(10) DEFAULT 'not_used',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            used_at TIMESTAMP NULL,
            CONSTRAINT unique_keyword UNIQUE (keyword)
          )
        `, [schema]);
        
        logger.info(`Ensured schema and tables for ${category}/${country.code}`);
      } catch (err) {
        logger.error(`Failed to ensure schema for ${category}/${country.code}: ${err.message}`);
      } finally {
        client.release();
      }
    }
  }
}

module.exports = {
  initializePools,
  getPool,
  query,
  closeAllPools,
  ensureSchemas
};