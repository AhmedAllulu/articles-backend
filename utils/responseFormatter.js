// utils/responseFormatter.js

/**
 * Format API response consistently
 * @param {*} data - Response data
 * @param {string} message - Response message
 * @param {number} status - HTTP status code
 * @returns {Object} Formatted response object
 */
function formatResponse(data = null, message = 'Success', status = 200) {
    const isSuccess = status >= 200 && status < 300;
    
    const response = {
      success: isSuccess,
      status,
      timestamp: new Date().toISOString()
    };
    
    if (isSuccess) {
      response.data = data;
      response.message = message;
    } else {
      response.error = {
        message,
        status
      };
    }
    
    return response;
  }
  
  /**
   * Format error response
   * @param {Error} error - Error object
   * @param {number} status - HTTP status code
   * @returns {Object} Formatted error response
   */
  function formatErrorResponse(error, status = 500) {
    return formatResponse(null, error.message || 'Server error', status);
  }
  
  /**
   * Format pagination metadata
   * @param {number} total - Total number of items
   * @param {number} limit - Items per page
   * @param {number} offset - Current offset
   * @returns {Object} Pagination metadata
   */
  function formatPagination(total, limit, offset) {
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    
    return {
      total,
      limit,
      offset,
      currentPage,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    };
  }
  
  module.exports = {
    formatResponse,
    formatErrorResponse,
    formatPagination
  };