// controllers/authController.js
const { User } = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { formatResponse } = require('../utils/responseFormatter');
const { ValidationError, UnauthorizedError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

/**
 * Register a new user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function register(req, res) {
  try {
    const { email, password, name, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    
    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }
    
    // Create new user
    const user = await User.create({
      email,
      password,
      name,
      role: role || 'editor'
    });
    
    logger.info(`New user registered: ${email}`);
    
    // Generate token for new user
    const token = generateToken(user);
    
    res.status(201).json(formatResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    }, 'User registered successfully'));
  } catch (error) {
    // If this is our validation error, pass it through
    if (error instanceof ValidationError) {
      throw error;
    }
    
    logger.error(`Error in register: ${error.message}`);
    res.status(500).json(formatResponse(null, 'Error registering user', 500));
  }
}

/**
 * Login user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findByEmail(email);
    
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }
    
    // Verify password
    const isPasswordValid = await User.verifyPassword(password, user.password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }
    
    // Update last login time
    await User.updateLastLogin(user.id);
    
    // Generate token
    const token = generateToken(user);
    
    // Log login action
    await User.logAction(
      user.id,
      'User login',
      req.ip,
      req.headers['user-agent']
    );
    
    // Return user data and token
    res.json(formatResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    }, 'Login successful'));
  } catch (error) {
    // If this is our unauthorized error, pass it through
    if (error instanceof UnauthorizedError) {
      res.status(401).json(formatResponse(null, error.message, 401));
      return;
    }
    
    logger.error(`Error in login: ${error.message}`);
    res.status(500).json(formatResponse(null, 'Error during login', 500));
  }
}

/**
 * Get current user profile
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    
    // Get user data
    const user = await User.findById(userId);
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    
    // Return user data without sensitive information
    res.json(formatResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.last_login
      }
    }));
  } catch (error) {
    logger.error(`Error in getProfile: ${error.message}`);
    
    if (error instanceof UnauthorizedError) {
      res.status(401).json(formatResponse(null, error.message, 401));
      return;
    }
    
    res.status(500).json(formatResponse(null, 'Error retrieving user profile', 500));
  }
}

/**
 * Change user password
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function changePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current password and new password are required');
    }
    
    // Get user
    const user = await User.findByEmail(req.user.email);
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    
    // Verify current password
    const isPasswordValid = await User.verifyPassword(currentPassword, user.password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }
    
    // Change password
    await User.changePassword(userId, newPassword);
    
    // Log password change
    await User.logAction(
      userId,
      'Password changed',
      req.ip,
      req.headers['user-agent']
    );
    
    res.json(formatResponse(null, 'Password changed successfully'));
  } catch (error) {
    logger.error(`Error in changePassword: ${error.message}`);
    
    if (error instanceof ValidationError) {
      res.status(400).json(formatResponse(null, error.message, 400));
      return;
    }
    
    if (error instanceof UnauthorizedError) {
      res.status(401).json(formatResponse(null, error.message, 401));
      return;
    }
    
    res.status(500).json(formatResponse(null, 'Error changing password', 500));
  }
}

module.exports = {
  register,
  login,
  getProfile,
  changePassword
};