/**
 * Error Handling Middleware
 */

const logger = require('../utils/logger.util');

/**
 * 404 Not Found handler
 */
function notFound(req, res, next) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, next) {
  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // MongoDB errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    if (err.code === 11000) {
      // Duplicate key error
      return res.status(409).json({
        error: 'Duplicate Entry',
        message: 'A resource with this value already exists'
      });
    }
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.errors
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Authentication token is invalid'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      message: 'Authentication token has expired'
    });
  }

  // Generic error response
  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An error occurred processing your request'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  notFound,
  errorHandler,
  asyncHandler
};
