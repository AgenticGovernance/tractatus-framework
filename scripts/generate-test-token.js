#!/usr/bin/env node
/**
 * Generate Test JWT Token
 * Creates a valid JWT token for testing Rule Manager API
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

// Admin user from database
const payload = {
  userId: '68e3a6fb21af2fd194bf4b50',
  email: 'admin@tractatus.local',
  role: 'admin'
};

const token = jwt.sign(payload, JWT_SECRET, {
  expiresIn: JWT_EXPIRY,
  audience: 'tractatus-admin',
  issuer: 'tractatus'
});

console.log('\n=== Test JWT Token ===\n');
console.log('Token:', token);
console.log('\nUse in Authorization header:');
console.log(`Authorization: Bearer ${token}`);
console.log('\nExpires in:', JWT_EXPIRY);
console.log('');
