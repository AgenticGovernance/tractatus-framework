/**
 * Authentication Middleware
 * JWT-based authentication for admin routes
 */

const { verifyToken, extractTokenFromHeader } = require('../utils/jwt.util');
const { User } = require('../models');
const logger = require('../utils/logger.util');

/**
 * Verify JWT token and attach user to request
 */
async function authenticateToken(req, res, next) {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found'
      });
    }

    if (!user.active) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User account is inactive'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    return res.status(401).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
}

/**
 * Check if user has required role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
}

/**
 * Optional authentication (attach user if token present, continue if not)
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);

      if (user && user.active) {
        req.user = user;
        req.userId = user._id;
      }
    }
  } catch (error) {
    // Silently fail - authentication is optional
    logger.debug('Optional auth failed:', error.message);
  }

  next();
}

/**
 * Require admin role (convenience function)
 */
const requireAdmin = requireRole('admin');

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  optionalAuth
};
