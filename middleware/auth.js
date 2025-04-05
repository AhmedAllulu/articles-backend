// middleware/auth.js
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

/**
 * Middleware to authenticate JWT tokens
 */
function authenticate(req, res, next) {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    logger.warn('Authentication failed: No token provided');
    return res.status(401).json({
      error: {
        message: 'Authentication required',
        status: 401
      }
    });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user data to request
    req.user = decoded;
    
    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    logger.warn(`Authentication failed: ${error.message}`);
    return res.status(403).json({
      error: {
        message: 'Invalid or expired token',
        status: 403
      }
    });
  }
}

/**
 * Middleware to check if user has admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    logger.warn(`Authorization failed: User ${req.user?.id} is not an admin`);
    return res.status(403).json({
      error: {
        message: 'Admin access required',
        status: 403
      }
    });
  }
  
  next();
}

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '1d' // Token expires in 1 day
    }
  );
}

module.exports = {
  authenticate,
  requireAdmin,
  generateToken
};