/**
 * Tractatus Express Server
 * Main application entry point
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const config = require('./config/app.config');
const logger = require('./utils/logger.util');
const { connect: connectDb, close: closeDb } = require('./utils/db.util');
const { connect: connectMongoose, close: closeMongoose } = require('./utils/mongoose.util');
const { notFound, errorHandler } = require('./middleware/error.middleware');

// Create Express app
const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS
app.use(cors(config.cors));

// Raw body capture for Stripe webhooks (must be before JSON parser)
app.use('/api/koha/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body;
  next();
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(logger.request);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Static files
app.use(express.static('public'));

// Health check endpoint (minimal, no sensitive data)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API routes
const apiRoutes = require('./routes/index');
app.use('/api', apiRoutes);

// Homepage (temporary)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tractatus AI Safety Framework</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 { color: #2563eb; }
        .status { color: #059669; font-weight: bold; }
        code { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>Tractatus AI Safety Framework</h1>
      <p class="status">✓ Server Running</p>
      <p>Development environment for the Tractatus-Based LLM Safety Framework website.</p>

      <h2>Status</h2>
      <ul>
        <li>✓ MongoDB connected (port 27017)</li>
        <li>✓ Express server running (port ${config.port})</li>
        <li>✓ Database initialized (10 collections)</li>
        <li>✓ Core models implemented</li>
        <li>✓ API routes complete (auth, documents, blog, admin)</li>
        <li>⏳ Frontend (pending)</li>
      </ul>

      <h2>Available Endpoints</h2>
      <ul>
        <li><code>GET /health</code> - Health check</li>
        <li><code>GET /api</code> - API documentation</li>
        <li><code>POST /api/auth/login</code> - Admin login</li>
        <li><code>GET /api/documents</code> - List framework documents</li>
        <li><code>GET /api/blog</code> - List published blog posts</li>
        <li><code>GET /api/admin/stats</code> - System statistics (auth required)</li>
      </ul>

      <p><em>Phase 1 Development - Not for public use</em></p>
    </body>
    </html>
  `);
});

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Server startup
async function start() {
  try {
    // Connect to MongoDB (native driver)
    await connectDb();

    // Connect Mongoose (for ODM models)
    await connectMongoose();

    // Initialize governance services
    const BoundaryEnforcer = require('./services/BoundaryEnforcer.service');
    await BoundaryEnforcer.initialize();
    logger.info('✅ Governance services initialized');

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Tractatus server started`);
      logger.info(`✅ Environment: ${config.env}`);
      logger.info(`✅ Port: ${config.port}`);
      logger.info(`✅ MongoDB: ${config.mongodb.db}`);
      logger.info(`✨ Ready for development`);
      console.log(`\n🌐 http://localhost:${config.port}\n`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => shutdown(server));
    process.on('SIGINT', () => shutdown(server));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(server) {
  logger.info('Shutting down gracefully...');

  server.close(async () => {
    logger.info('HTTP server closed');

    await closeDb();
    logger.info('Native MongoDB connection closed');

    await closeMongoose();
    logger.info('Mongoose connection closed');

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Start server if run directly
if (require.main === module) {
  start();
}

module.exports = app;
