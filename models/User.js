// models/User.js
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const logger = require('../config/logger');

// Create a separate admin database connection
const adminPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: 'admin_db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 5, // smaller pool for admin operations
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize admin database tables
async function initAdminDb() {
  const client = await adminPool.connect();
  try {
    // Create users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'editor',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login TIMESTAMP
      )
    `);
    
    // Create access logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        ip_address VARCHAR(50),
        user_agent TEXT,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    logger.info('Admin database tables initialized');
  } catch (error) {
    logger.error(`Error initializing admin database: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

class User {
  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user object (without password)
   */
  static async create(userData) {
    const { email, password, name, role = 'editor' } = userData;
    
    try {
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Insert user
      const result = await adminPool.query(
        `INSERT INTO users (email, password, name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, role, created_at`,
        [email, hashedPassword, name, role]
      );
      
      logger.info(`User created: ${email}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating user: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} User object or null
   */
  static async findByEmail(email) {
    try {
      const result = await adminPool.query(
        `SELECT * FROM users WHERE email = $1`,
        [email]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding user by email: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Promise<Object>} User object or null
   */
  static async findById(id) {
    try {
      const result = await adminPool.query(
        `SELECT id, email, name, role, created_at, updated_at, last_login
         FROM users WHERE id = $1`,
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding user by ID: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Verify password
   * @param {string} plainPassword - Plain text password
   * @param {string} hashedPassword - Hashed password from database
   * @returns {Promise<boolean>} True if password matches
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
  
  /**
   * Update last login time
   * @param {number} userId - User ID
   * @returns {Promise<void>}
   */
  static async updateLastLogin(userId) {
    try {
      await adminPool.query(
        `UPDATE users SET last_login = NOW() WHERE id = $1`,
        [userId]
      );
    } catch (error) {
      logger.error(`Error updating last login: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Log user action
   * @param {number} userId - User ID
   * @param {string} action - Action performed
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent
   * @returns {Promise<void>}
   */
  static async logAction(userId, action, ipAddress, userAgent) {
    try {
      await adminPool.query(
        `INSERT INTO access_logs (user_id, action, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [userId, action, ipAddress, userAgent]
      );
    } catch (error) {
      logger.error(`Error logging user action: ${error.message}`);
      // Don't throw - we don't want to disrupt the application flow for logging errors
    }
  }
  
  /**
   * Change password
   * @param {number} userId - User ID
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} True if password was changed
   */
  static async changePassword(userId, newPassword) {
    try {
      // Hash new password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      // Update password
      const result = await adminPool.query(
        `UPDATE users 
         SET password = $1, updated_at = NOW() 
         WHERE id = $2
         RETURNING id`,
        [hashedPassword, userId]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error changing password: ${error.message}`);
      throw error;
    }
  }
}

module.exports = {
  User,
  initAdminDb
};