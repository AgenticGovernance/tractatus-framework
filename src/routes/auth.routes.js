/**
 * Authentication Routes
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { validateEmail, validateRequired } = require('../middleware/validation.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

// Rate limiter for login attempts (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 attempts per 15 minutes per IP
  message: 'Too many login attempts from this IP. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false // Count successful logins too (prevents credential stuffing)
});

/**
 * POST /api/auth/login
 * Login with email and password
 * Rate limited: 5 attempts per 15 minutes per IP
 */
router.post('/login',
  loginLimiter,
  validateRequired(['email', 'password']),
  validateEmail('email'),
  asyncHandler(authController.login)
);

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me',
  authenticateToken,
  asyncHandler(authController.getCurrentUser)
);

/**
 * POST /api/auth/logout
 * Logout (logs the event, client removes token)
 */
router.post('/logout',
  authenticateToken,
  asyncHandler(authController.logout)
);

module.exports = router;
