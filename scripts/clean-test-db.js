#!/usr/bin/env node
/**
 * Clean Test Database
 * Removes all data from the test database before running tests
 *
 * Usage:
 *   node scripts/clean-test-db.js
 *   npm run test:clean  (if script added to package.json)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });

const { MongoClient } = require('mongodb');
const config = require('../src/config/app.config');

async function cleanTestDatabase() {
  console.log('🧹 Cleaning test database...\n');

  // Safety check
  if (config.env !== 'test') {
    console.error('❌ ERROR: NODE_ENV must be "test"');
    console.error(`   Current: ${config.env}`);
    process.exit(1);
  }

  if (!config.mongodb.db.includes('test')) {
    console.error('❌ ERROR: Database name must contain "test"');
    console.error(`   Current: ${config.mongodb.db}`);
    process.exit(1);
  }

  const connection = await MongoClient.connect(config.mongodb.uri);
  const db = connection.db(config.mongodb.db);

  try {
    console.log(`📊 Database: ${config.mongodb.db}`);
    console.log(`🔗 URI: ${config.mongodb.uri}\n`);

    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections\n`);

    if (collections.length === 0) {
      console.log('✨ Database is already empty\n');
      await connection.close();
      return;
    }

    // Clean each collection
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      if (count > 0) {
        await db.collection(collection.name).deleteMany({});
        console.log(`  ✓ Cleaned ${collection.name} (${count} documents)`);
      } else {
        console.log(`  · Skipped ${collection.name} (empty)`);
      }
    }

    console.log(`\n✅ Test database cleaned successfully\n`);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    await connection.close();
  }
}

// Run if called directly
if (require.main === module) {
  cleanTestDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { cleanTestDatabase };
