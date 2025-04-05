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
  // Create connection pools for each category and country
  constants.CATEGORIES.forEach(category => {
    pools[category] = {};
    
    countries.forEach(country => {
      const config = dbConfig.getConnectionConfig(category, country.code);
      pools[category][country.code] = new Pool(config);
      
      // Log when connection is established
      pools[category][country.code].on('connect', () => {
        logger.info(`Connected to ${category} database for ${country.country}`);
      });
      
      // Log errors
      pools[category][country.code].on('error', (err) => {
        logger.error(`Database error in ${category}/${country.country}: ${err.message}`);
      });
    });
  });
  
  logger.info('All database connection pools initialized');
}

// Get pool for specific category and country
function getPool(category, countryCode) {
  if (!pools[category] || !pools[category][countryCode]) {
    throw new Error(`No pool exists for ${category}/${countryCode}`);
  }
  
  return pools[category][countryCode];
}

// Execute query on specific category and country
async function query(category, countryCode, text, params) {
  const pool = getPool(category, countryCode);
  const start = Date.now();
  
  try {
    // Set search path to appropriate schema
    const client = await pool.connect();
    try {
      // Set schema for this connection
      const country = countries.find(c => c.code === countryCode);
      await client.query(`SET search_path TO ${country.code.toLowerCase()}`);
      
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
    for (const countryCode of Object.keys(pools[category])) {
      await pools[category][countryCode].end();
      logger.info(`Closed pool for ${category}/${countryCode}`);
    }
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
        // Create schema if it doesn't exist
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${country.code.toLowerCase()}`);
        
        // Create necessary tables in this schema
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${country.code.toLowerCase()}.articles (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            trend_keyword TEXT NOT NULL,
            language VARCHAR(5) NOT NULL
          )
        `);
        
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${country.code.toLowerCase()}.trends (
            id SERIAL PRIMARY KEY,
            keyword TEXT NOT NULL,
            status VARCHAR(10) DEFAULT 'not_used',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            used_at TIMESTAMP NULL
          )
        `);
        
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