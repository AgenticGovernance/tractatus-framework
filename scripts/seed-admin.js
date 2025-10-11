#!/usr/bin/env node
/**
 * Seed Admin User Script
 * Creates the initial admin user for the Tractatus platform
 *
 * Usage: npm run seed:admin
 */

require('dotenv').config();

const readline = require('readline');
const { connect, close } = require('../src/utils/db.util');
const User = require('../src/models/User.model');
const logger = require('../src/utils/logger.util');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function seedAdmin() {
  try {
    console.log('\n=== Tractatus Admin User Setup ===\n');

    // Connect to database
    await connect();

    // Check if admin user already exists
    const existingAdmin = await User.findByEmail(process.env.ADMIN_EMAIL || 'admin@tractatus.local');

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists.');
      const overwrite = await question('Do you want to delete and recreate? (yes/no): ');

      if (overwrite.toLowerCase() !== 'yes') {
        console.log('Cancelled. No changes made.');
        await cleanup();
        return;
      }

      await User.deleteOne({ _id: existingAdmin._id });
      console.log('✅ Existing admin user deleted.');
    }

    // Get admin details
    console.log('\nEnter admin user details:');
    const name = await question('Name (default: Admin User): ') || 'Admin User';
    const email = await question(`Email (default: ${process.env.ADMIN_EMAIL || 'admin@tractatus.local'}): `)
                  || process.env.ADMIN_EMAIL
                  || 'admin@tractatus.local';

    // Password input (hidden)
    console.log('\n⚠️  Password will be visible. Use a development password only.');
    const password = await question('Password (min 8 chars): ');

    if (!password || password.length < 8) {
      console.error('❌ Password must be at least 8 characters.');
      await cleanup();
      return;
    }

    // Create admin user
    const admin = await User.create({
      name,
      email,
      password, // Will be hashed by the model
      role: 'admin',
      active: true
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('\nCredentials:');
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role:  ${admin.role}`);
    console.log(`  ID:    ${admin._id}`);
    console.log('\nYou can now login at: POST /api/auth/login');
    console.log('');

    logger.info(`Admin user created: ${admin.email}`);

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    logger.error('Admin seed error:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

async function cleanup() {
  rl.close();
  await close();
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n👋 Cancelled by user');
  await cleanup();
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  seedAdmin();
}

module.exports = seedAdmin;
