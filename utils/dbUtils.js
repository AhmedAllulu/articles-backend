// utils/dbUtils.js
const logger = require('../config/logger');
const db = require('../db/connections');

/**
 * Transaction helper - executes multiple queries in a transaction
 * @param {string} category - Category
 * @param {string} countryCode - Country code
 * @param {Function} callback - Function that receives a client and executes queries
 * @returns {Promise<*>} Result of callback
 */
async function withTransaction(category, countryCode, callback) {
  const pool = db.getPool(category, countryCode);
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Set search path to appropriate schema
    const country = require('../config/countries').find(c => c.code === countryCode);
    await client.query(`SET search_path TO ${country.code.toLowerCase()}`);
    
    // Execute callback with client
    const result = await callback(client);
    
    // Commit transaction
    await client.query('COMMIT');
    
    return result;
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error(`Transaction error for ${category}/${countryCode}: ${error.message}`);
    throw error;
  } finally {
    // Release client back to pool
    client.release();
  }
}

/**
 * Create timestamp field SQL for migrations
 * @returns {string} SQL fragment for timestamp fields
 */
function timestampFields() {
  return `
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  `;
}

/**
 * Add timestamp trigger to a table
 * @param {Object} client - Database client
 * @param {string} tableName - Table name
 * @returns {Promise<void>}
 */
async function addTimestampTrigger(client, tableName) {
  // Create function if it doesn't exist
  await client.query(`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  // Create trigger
  await client.query(`
    DROP TRIGGER IF EXISTS update_${tableName}_updated_at ON ${tableName};
    CREATE TRIGGER update_${tableName}_updated_at
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
  `);
}

/**
 * Create UUID extension if not exists
 * @param {Object} client - Database client
 * @returns {Promise<void>}
 */
async function createUuidExtension(client) {
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
}

/**
 * Check if a column exists in a table
 * @param {string} category - Category
 * @param {string} countryCode - Country code
 * @param {string} tableName - Table name
 * @param {string} columnName - Column name
 * @returns {Promise<boolean>} True if column exists
 */
async function columnExists(category, countryCode, tableName, columnName) {
  const country = require('../config/countries').find(c => c.code === countryCode);
  const schema = country.code.toLowerCase();
  
  const result = await db.query(
    category,
    countryCode,
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = $1
      AND table_name = $2
      AND column_name = $3
    ) as exists;
    `,
    [schema, tableName, columnName]
  );
  
  return result.rows[0].exists;
}

/**
 * Safely add a column if it doesn't exist
 * @param {string} category - Category
 * @param {string} countryCode - Country code
 * @param {string} tableName - Table name
 * @param {string} columnDefinition - Column definition (e.g., "image_url TEXT")
 * @returns {Promise<void>}
 */
async function safeAddColumn(category, countryCode, tableName, columnDefinition) {
  const [columnName] = columnDefinition.split(' ');
  
  const exists = await columnExists(category, countryCode, tableName, columnName);
  
  if (!exists) {
    const country = require('../config/countries').find(c => c.code === countryCode);
    const schema = country.code.toLowerCase();
    
    await db.query(
      category,
      countryCode,
      `ALTER TABLE ${schema}.${tableName} ADD COLUMN ${columnDefinition};`
    );
    
    logger.info(`Added column ${columnName} to ${category}/${countryCode}.${tableName}`);
  }
}

module.exports = {
  withTransaction,
  timestampFields,
  addTimestampTrigger,
  createUuidExtension,
  columnExists,
  safeAddColumn
};