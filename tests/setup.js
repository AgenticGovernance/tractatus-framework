/**
 * Jest Test Setup
 * Loads .env.test before running tests and cleans test database
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Note: We don't clean the database here in setup.js because:
// 1. It runs for every test file in parallel, causing race conditions
// 2. Each test suite should handle its own cleanup in beforeAll/beforeEach
// 3. See tests/helpers/cleanup.js for cleanup utilities
