/**
 * Database Connection Utility
 * Manages MongoDB connection with reconnection logic
 */

const { MongoClient } = require('mongodb');
const logger = require('./logger.util');

class DatabaseConnection {
  constructor() {
    this.client = null;
    this.db = null;
    this.uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tractatus_dev';
    this.dbName = process.env.MONGODB_DB || 'tractatus_dev';
  }

  /**
   * Connect to MongoDB with retry logic
   */
  async connect(retries = 5) {
    if (this.client && this.client.topology && this.client.topology.isConnected()) {
      return this.db;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.client = new MongoClient(this.uri, {
          maxPoolSize: 10,
          minPoolSize: 2,
          maxIdleTimeMS: 30000,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });

        await this.client.connect();
        this.db = this.client.db(this.dbName);

        // Verify connection
        await this.db.admin().ping();

        logger.info(`✅ Connected to MongoDB: ${this.dbName}`);
        return this.db;

      } catch (error) {
        logger.error(`MongoDB connection attempt ${attempt}/${retries} failed:`, error.message);

        if (attempt === retries) {
          throw new Error(`Failed to connect to MongoDB after ${retries} attempts: ${error.message}`);
        }

        // Wait before retry (exponential backoff)
        await this.sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10000));
      }
    }
  }

  /**
   * Get database instance (connects if not connected)
   */
  async getDb() {
    if (!this.db) {
      await this.connect();
    }
    return this.db;
  }

  /**
   * Get collection
   */
  async getCollection(collectionName) {
    const db = await this.getDb();
    return db.collection(collectionName);
  }

  /**
   * Close connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      logger.info('MongoDB connection closed');
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.client && this.client.topology && this.client.topology.isConnected();
  }

  /**
   * Sleep utility for retry logic
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const dbConnection = new DatabaseConnection();

module.exports = {
  connect: () => dbConnection.connect(),
  getDb: () => dbConnection.getDb(),
  getCollection: (name) => dbConnection.getCollection(name),
  close: () => dbConnection.close(),
  isConnected: () => dbConnection.isConnected()
};
