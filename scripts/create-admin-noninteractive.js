const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');

async function createAdmin() {
  const client = new MongoClient('mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('tractatus_dev');

    // Delete existing admin
    await db.collection('users').deleteOne({ email: 'admin@tractatus.local' });

    // Create new admin with hashed password
    const password = bcrypt.hashSync('tractatus2025', 12);
    await db.collection('users').insertOne({
      name: 'Admin User',
      email: 'admin@tractatus.local',
      password: password,
      role: 'admin',
      active: true,
      created_at: new Date()
    });

    console.log('✅ Admin user created: admin@tractatus.local / tractatus2025');
  } finally {
    await client.close();
  }
}

createAdmin().catch(console.error);
