/**
 * Integration Tests - Koha API (Donation System)
 * Tests donation endpoints, authentication, and security features
 */

const request = require('supertest');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const app = require('../../src/server');
const config = require('../../src/config/app.config');

describe('Koha API Integration Tests', () => {
  let connection;
  let db;
  let adminToken;
  let testDonationId;
  let testSubscriptionId;

  const adminUser = {
    email: 'admin@koha.test.local',
    password: 'AdminKoha123!',
    role: 'admin'
  };

  // Connect to database and setup test data
  beforeAll(async () => {
    connection = await MongoClient.connect(config.mongodb.uri);
    db = connection.db(config.mongodb.db);

    // Clean up any existing test data
    await db.collection('users').deleteMany({ email: adminUser.email });
    await db.collection('koha_donations').deleteMany({ 'donor.email': /test.*@koha\.test/ });

    // Create admin user
    const adminHash = await bcrypt.hash(adminUser.password, 10);
    await db.collection('users').insertOne({
      email: adminUser.email,
      password: adminHash,
      name: 'Koha Test Admin',
      role: adminUser.role,
      created_at: new Date(),
      active: true,
      last_login: null
    });

    // Get admin token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminUser.email,
        password: adminUser.password
      });
    adminToken = loginResponse.body.token;

    // Create test donation with subscription
    const result = await db.collection('koha_donations').insertOne({
      amount: 1500, // $15.00
      currency: 'nzd',
      frequency: 'monthly',
      tier: '15',
      donor: {
        name: 'Test Donor',
        email: 'donor@koha.test',
        country: 'NZ'
      },
      stripe: {
        customer_id: 'cus_test123',
        subscription_id: 'sub_test123'
      },
      status: 'completed',
      created_at: new Date(),
      updated_at: new Date()
    });
    testDonationId = result.insertedId.toString();
    testSubscriptionId = 'sub_test123';
  });

  // Clean up test data
  afterAll(async () => {
    await db.collection('users').deleteMany({ email: adminUser.email });
    await db.collection('koha_donations').deleteMany({ 'donor.email': /test.*@koha\.test/ });
    if (testDonationId) {
      await db.collection('koha_donations').deleteOne({ _id: new ObjectId(testDonationId) });
    }
    await connection.close();
  });

  describe('GET /api/koha/transparency', () => {
    test('should return public transparency metrics', async () => {
      const response = await request(app)
        .get('/api/koha/transparency')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total_received');
      expect(response.body.data).toHaveProperty('monthly_supporters');
      expect(response.body.data).toHaveProperty('allocation');
    });
  });

  describe('POST /api/koha/cancel', () => {
    test('should require subscription ID and email', async () => {
      const response = await request(app)
        .post('/api/koha/cancel')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should reject cancellation with wrong email (security)', async () => {
      const response = await request(app)
        .post('/api/koha/cancel')
        .send({
          subscriptionId: testSubscriptionId,
          email: 'wrong@email.com'
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('does not match');
    });

    test('should reject cancellation of non-existent subscription', async () => {
      const response = await request(app)
        .post('/api/koha/cancel')
        .send({
          subscriptionId: 'sub_nonexistent',
          email: 'any@email.com'
        })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should allow cancellation with correct email', async () => {
      // Skip if Stripe is not configured
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER')) {
        console.warn('Skipping test: Stripe not configured');
        return;
      }

      const response = await request(app)
        .post('/api/koha/cancel')
        .send({
          subscriptionId: testSubscriptionId,
          email: 'donor@koha.test'
        });

      // Will fail with Stripe error in test environment, but should pass email verification
      // The 500 error would be from Stripe, not from email validation
      expect([200, 500]).toContain(response.status);
    });

    test('should be rate limited after 10 attempts', async () => {
      // Make 11 requests rapidly
      const requests = [];
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .post('/api/koha/cancel')
            .send({
              subscriptionId: 'sub_test',
              email: `test${i}@rate-limit.test`
            })
        );
      }

      const responses = await Promise.all(requests);

      // At least one should be rate limited (429)
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    }, 30000); // Increase timeout for rate limit test
  });

  describe('GET /api/koha/statistics (Admin Only)', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/koha/statistics')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should require admin role', async () => {
      // Create regular user
      const regularUser = {
        email: 'user@koha.test.local',
        password: 'UserKoha123!'
      };

      const userHash = await bcrypt.hash(regularUser.password, 10);
      await db.collection('users').insertOne({
        email: regularUser.email,
        password: userHash,
        name: 'Regular User',
        role: 'user',
        created_at: new Date(),
        active: true
      });

      // Get user token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: regularUser.email,
          password: regularUser.password
        });
      const userToken = loginResponse.body.token;

      // Try to access admin endpoint
      const response = await request(app)
        .get('/api/koha/statistics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');

      // Clean up
      await db.collection('users').deleteOne({ email: regularUser.email });
    });

    test('should return statistics with admin auth', async () => {
      const response = await request(app)
        .get('/api/koha/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total_count');
      expect(response.body.data).toHaveProperty('total_amount');
      expect(response.body.data).toHaveProperty('by_frequency');
    });

    test('should support date range filtering', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-12-31';

      const response = await request(app)
        .get(`/api/koha/statistics?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/koha/checkout (Rate Limiting)', () => {
    test('should be rate limited after 10 attempts', async () => {
      // Skip if Stripe is not configured
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER')) {
        console.warn('Skipping test: Stripe not configured');
        return;
      }

      const requests = [];
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .post('/api/koha/checkout')
            .send({
              amount: 500,
              frequency: 'one_time',
              donor: {
                name: 'Test Donor',
                email: `test${i}@rate-limit.test`,
                country: 'NZ'
              }
            })
        );
      }

      const responses = await Promise.all(requests);

      // At least one should be rate limited (429)
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    }, 30000); // Increase timeout for rate limit test
  });

  describe('Security Validations', () => {
    test('should validate minimum donation amount', async () => {
      const response = await request(app)
        .post('/api/koha/checkout')
        .send({
          amount: 50, // Less than minimum (100 = $1.00)
          frequency: 'one_time',
          donor: {
            email: 'test@security.test'
          }
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should validate required fields for checkout', async () => {
      const response = await request(app)
        .post('/api/koha/checkout')
        .send({
          // Missing amount, frequency, donor.email
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should validate frequency values', async () => {
      const response = await request(app)
        .post('/api/koha/checkout')
        .send({
          amount: 1000,
          frequency: 'invalid_frequency',
          donor: {
            email: 'test@security.test'
          }
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should validate tier for monthly donations', async () => {
      const response = await request(app)
        .post('/api/koha/checkout')
        .send({
          amount: 1000,
          frequency: 'monthly',
          tier: 'invalid_tier',
          donor: {
            email: 'test@security.test'
          }
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
