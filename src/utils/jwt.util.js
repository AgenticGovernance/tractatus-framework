/**
 * JWT Utility
 * Token generation and verification for admin authentication
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Generate JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
    issuer: 'tractatus',
    audience: 'tractatus-admin'
  });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'tractatus',
      audience: 'tractatus-admin'
    });
  } catch (error) {
    throw new Error(`Invalid token: ${error.message}`);
  }
}

/**
 * Decode token without verification (for debugging)
 */
function decodeToken(token) {
  return jwt.decode(token);
}

/**
 * Extract token from Authorization header
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  extractTokenFromHeader
};
