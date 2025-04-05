// scripts/db-init.js
require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../config/logger');
const constants = require('../config/constants');
const countries = require('../config/countries');

// Connection to postgres for creating databases
const pgPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: 'postgres', // Connect to default postgres database
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

/**
 * Initialize databases and schemas
 */
async function initializeDatabase() {
  logger.info('Starting database initialization');
  
  const client = await pgPool.connect();
  
  try {
    // Create admin database
    logger.info('Creating admin database...');
    await client.query(`CREATE DATABASE IF NOT EXISTS admin_db;`);
    
    // Create category databases
    for (const category of constants.CATEGORIES) {
      const dbName = `news_${category}`;
      logger.info(`Creating database: ${dbName}`);
      
      try {
        // Check if database exists
        const dbCheck = await client.query(
          `SELECT 1 FROM pg_database WHERE datname = $1`,
          [dbName]
        );
        
        if (dbCheck.rowCount === 0) {
          // Need to use template1 because we can't create a DB while connected to it
          await client.query(`CREATE DATABASE ${dbName} TEMPLATE template1;`);
          logger.info(`Created database: ${dbName}`);
        } else {
          logger.info(`Database ${dbName} already exists`);
        }
      } catch (error) {
        logger.error(`Error creating database ${dbName}: ${error.message}`);
      }
    }
    
    logger.info('Databases created successfully');
  } catch (error) {
    logger.error(`Error initializing databases: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
  
  // Initialize schemas for each database
  for (const category of constants.CATEGORIES) {
    const dbName = `news_${category}`;
    logger.info(`Initializing schemas for ${dbName}`);
    
    const categoryPool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: dbName,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });
    
    const categoryClient = await categoryPool.connect();
    
    try {
      // Create schemas for each country
      for (const country of countries) {
        const schema = country.code.toLowerCase();
        logger.info(`Creating schema: ${schema} in ${dbName}`);
        
        try {
          await categoryClient.query(`CREATE SCHEMA IF NOT EXISTS ${schema};`);
          
          // Create tables
          await categoryClient.query(`
            CREATE TABLE IF NOT EXISTS ${schema}.articles (
              id SERIAL PRIMARY KEY,
              title TEXT NOT NULL,
              content TEXT NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMP NULL,
              trend_keyword TEXT NOT NULL,
              language VARCHAR(5) NOT NULL,
              image_url TEXT
            );
            
            CREATE TABLE IF NOT EXISTS ${schema}.trends (
              id SERIAL PRIMARY KEY,
              keyword TEXT NOT NULL,
              status VARCHAR(10) DEFAULT 'not_used',
              created_at TIMESTAMP NOT NULL DEFAULT NOW(),
              used_at TIMESTAMP NULL,
              CONSTRAINT unique_keyword UNIQUE (keyword)
            );
          `);
          
          logger.info(`Created schema and tables for ${schema} in ${dbName}`);
        } catch (error) {
          logger.error(`Error creating schema ${schema} in ${dbName}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error initializing schemas for ${dbName}: ${error.message}`);
    } finally {
      categoryClient.release();
      await categoryPool.end();
    }
  }
  
  // Initialize admin database
  logger.info('Initializing admin database');
  
  const adminPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'admin_db',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });
  
  const adminClient = await adminPool.connect();
  
  try {
    // Create admin tables
    await adminClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'editor',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS access_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        ip_address VARCHAR(50),
        user_agent TEXT,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Check if admin user exists, create if not
    const adminCheck = await adminClient.query(
      `SELECT 1 FROM users WHERE email = 'admin@example.com'`
    );
    
    if (adminCheck.rowCount === 0) {
      // Create default admin user
      const bcrypt = require('bcrypt');
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash('Admin@123', saltRounds);
      
      await adminClient.query(
        `INSERT INTO users (email, password, name, role)
         VALUES ($1, $2, $3, $4)`,
        ['admin@example.com', hashedPassword, 'Administrator', 'admin']
      );
      
      logger.info('Created default admin user: admin@example.com');
      logger.info('Default password: Admin@123 (please change after first login)');
    }
    
    logger.info('Admin database initialized');
  } catch (error) {
    logger.error(`Error initializing admin database: ${error.message}`);
  } finally {
    adminClient.release();
    await adminPool.end();
  }
  
  // Close main connection
  await pgPool.end();
  
  logger.info('Database initialization completed successfully');
}

// Run if this script is executed directly
if (require.main === module) {
  initializeDatabase().then(() => {
    logger.info('Database initialization script completed');
    process.exit(0);
  }).catch(error => {
    logger.error(`Database initialization failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  initializeDatabase
};