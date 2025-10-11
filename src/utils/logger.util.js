/**
 * Logger Utility
 * Winston-based logging with file and console output
 */

const winston = require('winston');
const path = require('path');

const logLevel = process.env.LOG_LEVEL || 'info';
const logFile = process.env.LOG_FILE || path.join(__dirname, '../../logs/app.log');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
      : `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports: [
    // Console output (colored in development)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),

    // File output
    new winston.transports.File({
      filename: logFile,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Error file
    new winston.transports.File({
      filename: path.join(path.dirname(logFile), 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    })
  ]
});

// Add request logging method
logger.request = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });

  next();
};

module.exports = logger;
