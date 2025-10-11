/**
 * Authentication Controller
 * Handles user login and token verification
 */

const User = require('../models/User.model');
const { generateToken } = require('../utils/jwt.util');
const logger = require('../utils/logger.util');

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Authenticate user
    const user = await User.authenticate(email, password);

    if (!user) {
      logger.warn(`Failed login attempt for email: ${email}`);
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    });

    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during login'
    });
  }
}

/**
 * Verify token and get current user
 * GET /api/auth/me
 */
async function getCurrentUser(req, res) {
  try {
    // User is already attached to req by auth middleware
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at,
        last_login: user.last_login
      }
    });

  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

/**
 * Logout (client-side token removal, server logs it)
 * POST /api/auth/logout
 */
async function logout(req, res) {
  try {
    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred'
    });
  }
}

module.exports = {
  login,
  getCurrentUser,
  logout
};
