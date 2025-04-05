// middleware/errorHandler.js
const logger = require('../config/logger');
const { formatResponse } = require('../utils/responseFormatter');

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error(`${err.name}: ${err.message}`);
  logger.error(err.stack);
  
  // Default error status and message
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    status = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    status = 404;
    message = err.message || 'Resource not found';
  }
  
  // Send appropriate response to client
  res.status(status).json(formatResponse(null, message, status));
}

/**
 * Not found handler - catch 404 errors
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
function notFoundHandler(req, res) {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json(formatResponse(null, 'Route not found', 404));
}

/**
 * Async handler to avoid try/catch repetition
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Error class for validation errors
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Error class for unauthorized errors
 */
class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Error class for forbidden errors
 */
class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Error class for not found errors
 */
class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError
};