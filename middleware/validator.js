// middleware/validator.js
const { check, validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');
const constants = require('../config/constants');
const countries = require('../config/countries');

/**
 * Process validation results
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const message = errors.array().map(error => error.msg).join('; ');
    throw new ValidationError(message);
  }
  
  next();
}

/**
 * Validate category and country parameters
 */
const validateCategoryAndCountry = [
  check('category')
    .isString()
    .trim()
    .isIn(constants.CATEGORIES)
    .withMessage(`Category must be one of: ${constants.CATEGORIES.join(', ')}`),
  
  check('countryCode')
    .isString()
    .trim()
    .custom(value => {
      const validCountryCodes = countries.map(country => country.code);
      if (!validCountryCodes.includes(value)) {
        throw new Error(`Country code must be one of: ${validCountryCodes.join(', ')}`);
      }
      return true;
    }),
  
  validate
];

/**
 * Validate article creation
 */
const validateArticleCreation = [
  ...validateCategoryAndCountry,
  
  check('title')
    .isString()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  
  check('content')
    .isString()
    .isLength({ min: 100 })
    .withMessage('Content must be at least 100 characters'),
  
  check('trend_keyword')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Trend keyword must be between 2 and 100 characters'),
  
  check('language')
    .isString()
    .trim()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language must be a valid ISO code'),
  
  validate
];

/**
 * Validate article update
 */
const validateArticleUpdate = [
  ...validateCategoryAndCountry,
  
  check('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),
  
  check('title')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  
  check('content')
    .optional()
    .isString()
    .isLength({ min: 100 })
    .withMessage('Content must be at least 100 characters'),
  
  check('image_url')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  validate
];

/**
 * Validate user registration
 */
const validateUserRegistration = [
  check('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  
  check('password')
    .isString()
    .isLength({ min: 8 })
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character')
    .withMessage('Password must be at least 8 characters and include uppercase, lowercase, number, and special character'),
  
  check('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  check('role')
    .optional()
    .isIn(['admin', 'editor'])
    .withMessage('Role must be either admin or editor'),
  
  validate
];

/**
 * Validate login credentials
 */
const validateLogin = [
  check('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  
  check('password')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Password is required'),
  
  validate
];

/**
 * Validate pagination parameters
 */
const validatePagination = [
  check('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  check('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  
  validate
];

module.exports = {
  validateCategoryAndCountry,
  validateArticleCreation,
  validateArticleUpdate,
  validateUserRegistration,
  validateLogin,
  validatePagination
};