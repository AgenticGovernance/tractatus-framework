/**
 * Mongoose Connection Utility
 * Manages Mongoose ODM connection for MongoDB models
 */

const mongoose = require('mongoose');
const logger = require('./logger.util');

class MongooseConnection {
  constructor() {
    this.connected = false;
    this.uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';
  }

  /**
   * Connect to MongoDB using Mongoose
   */
  async connect(retries = 5) {
    if (this.connected) {
      return;
    }

    // Mongoose connection options
    const options = {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await mongoose.connect(this.uri, options);

        this.connected = true;
        logger.info(`✅ Mongoose connected to MongoDB`);

        // Handle connection events
        mongoose.connection.on('error', (err) => {
          logger.error('Mongoose connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
          logger.warn('Mongoose disconnected');
          this.connected = false;
        });

        mongoose.connection.on('reconnected', () => {
          logger.info('Mongoose reconnected');
          this.connected = true;
        });

        return;

      } catch (error) {
        logger.error(`Mongoose connection attempt ${attempt}/${retries} failed:`, error.message);

        if (attempt === retries) {
          throw new Error(`Failed to connect Mongoose after ${retries} attempts: ${error.message}`);
        }

        // Wait before retry (exponential backoff)
        await this.sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10000));
      }
    }
  }

  /**
   * Close Mongoose connection
   */
  async close() {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      this.connected = false;
      logger.info('Mongoose connection closed');
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Sleep utility for retry logic
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const mongooseConnection = new MongooseConnection();

module.exports = {
  connect: () => mongooseConnection.connect(),
  close: () => mongooseConnection.close(),
  isConnected: () => mongooseConnection.isConnected(),
  mongoose // Export mongoose instance for direct access if needed
};
