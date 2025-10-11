/**
 * Test Cleanup Helper
 * Provides utilities for cleaning up test data between runs
 */

const { MongoClient } = require('mongodb');
const config = require('../../src/config/app.config');

/**
 * Clean all collections in the test database
 * @returns {Promise<void>}
 */
async function cleanTestDatabase() {
  const connection = await MongoClient.connect(config.mongodb.uri);
  const db = connection.db(config.mongodb.db);

  try {
    // Only clean if we're in test environment
    if (config.env !== 'test' || !config.mongodb.db.includes('test')) {
      throw new Error('cleanTestDatabase() can only be used with test databases');
    }

    // Get all collections
    const collections = await db.listCollections().toArray();

    // Drop each collection
    for (const collection of collections) {
      await db.collection(collection.name).deleteMany({});
    }

    console.log(`✓ Cleaned ${collections.length} collections in ${config.mongodb.db}`);
  } finally {
    await connection.close();
  }
}

/**
 * Clean specific test documents by slug pattern
 * @param {string} slugPattern - Pattern to match (e.g., 'test-document-integration')
 * @returns {Promise<number>} - Number of documents deleted
 */
async function cleanTestDocuments(slugPattern) {
  const connection = await MongoClient.connect(config.mongodb.uri);
  const db = connection.db(config.mongodb.db);

  try {
    const result = await db.collection('documents').deleteMany({
      slug: { $regex: slugPattern }
    });
    return result.deletedCount;
  } finally {
    await connection.close();
  }
}

/**
 * Clean specific test users by email pattern
 * @param {string} emailPattern - Pattern to match (e.g., 'test@')
 * @returns {Promise<number>} - Number of users deleted
 */
async function cleanTestUsers(emailPattern) {
  const connection = await MongoClient.connect(config.mongodb.uri);
  const db = connection.db(config.mongodb.db);

  try {
    const result = await db.collection('users').deleteMany({
      email: { $regex: emailPattern }
    });
    return result.deletedCount;
  } finally {
    await connection.close();
  }
}

module.exports = {
  cleanTestDatabase,
  cleanTestDocuments,
  cleanTestUsers
};
