/**
 * Application Configuration
 */

module.exports = {
  // Server
  port: process.env.PORT || 9000,
  env: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'Tractatus',

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev',
    db: process.env.MONGODB_DB || 'tractatus_dev'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION',
    expiry: process.env.JWT_EXPIRY || '7d'
  },

  // Admin
  admin: {
    email: process.env.ADMIN_EMAIL || 'john.stroh.nz@pm.me'
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log'
  },

  // Feature Flags
  features: {
    aiCuration: process.env.ENABLE_AI_CURATION === 'true',
    mediaTriage: process.env.ENABLE_MEDIA_TRIAGE === 'true',
    caseSubmissions: process.env.ENABLE_CASE_SUBMISSIONS === 'true'
  },

  // Security
  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }
};
