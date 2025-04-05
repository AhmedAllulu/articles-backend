// Create a new utility for standardized controller error handling
// utils/controllerUtils.js

const { formatResponse } = require('./responseFormatter');
const logger = require('../config/logger');
const { ValidationError, UnauthorizedError, ForbiddenError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Handle errors consistently across controllers
 * @param {Error} error - The error to handle
 * @param {string} logContext - Context for the error log (usually the function name)
 * @param {Object} res - Express response object
 */
function handleControllerError(error, logContext, res) {
  logger.error(`Error in ${logContext}: ${error.message}`);
  
  if (error instanceof ValidationError) {
    return res.status(400).json(formatResponse(null, error.message, 400));
  }
  
  if (error instanceof UnauthorizedError) {
    return res.status(401).json(formatResponse(null, error.message, 401));
  }
  
  if (error instanceof ForbiddenError) {
    return res.status(403).json(formatResponse(null, error.message, 403));
  }
  
  if (error instanceof NotFoundError) {
    return res.status(404).json(formatResponse(null, error.message, 404));
  }
  
  // Default to 500 Internal Server Error
  return res.status(500).json(formatResponse(null, 'Server error', 500));
}

/**
 * Create a wrapped controller function with standardized error handling
 * @param {Function} controllerFn - Controller function to wrap
 * @param {string} fnName - Function name for logging
 * @returns {Function} Wrapped controller function
 */
function withErrorHandling(controllerFn, fnName) {
  return async (req, res, next) => {
    try {
      await controllerFn(req, res, next);
    } catch (error) {
      handleControllerError(error, fnName, res);
    }
  };
}

module.exports = {
  handleControllerError,
  withErrorHandling
};