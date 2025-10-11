/**
 * Integration Tests - Authentication API
 * Tests login, token verification, and JWT handling
 */

const request = require('supertest');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const app = require('../../src/server');
const config = require('../../src/config/app.config');

describe('Authentication API Integration Tests', () => {
  let connection;
  let db;
  const testUser = {
    email: 'test@tractatus.test',
    password: 'TestPassword123!',
    role: 'admin'
  };

  // Connect to database and create test user
  beforeAll(async () => {
    connection = await MongoClient.connect(config.mongodb.uri);
    db = connection.db(config.mongodb.db);

    // Clean up any existing test user first
    await db.collection('users').deleteOne({ email: testUser.email });

    // Create test user with hashed password
    const passwordHash = await bcrypt.hash(testUser.password, 10);
    await db.collection('users').insertOne({
      email: testUser.email,
      password: passwordHash, // Field name is 'password', not 'passwordHash'
      name: 'Test User',
      role: testUser.role,
      created_at: new Date(),
      active: true,
      last_login: null
    });
  });

  // Clean up test data
  afterAll(async () => {
    await db.collection('users').deleteOne({ email: testUser.email });
    await connection.close();
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('role', testUser.role);
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    test('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).not.toHaveProperty('token');
    });

    test('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@tractatus.test',
          password: 'AnyPassword123!'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should require email field', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: testUser.password
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should require password field', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: testUser.password
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    let validToken;

    beforeAll(async () => {
      // Get a valid token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      validToken = loginResponse.body.token;
    });

    test('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', testUser.email);
    });

    test('should reject missing token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should reject malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    let validToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      validToken = loginResponse.body.token;
    });

    test('should logout with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Token Expiry', () => {
    test('JWT should include expiry claim', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      const token = response.body.token;
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Decode token (without verification for inspection)
      const parts = token.split('.');
      expect(parts.length).toBe(3); // JWT has 3 parts
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      expect(payload).toHaveProperty('exp');
      expect(payload).toHaveProperty('iat');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });
  });

  describe('Security Headers', () => {
    test('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword'
        })
        .expect(401);

      // Should not reveal whether user exists
      expect(response.body.error).not.toContain('user');
      expect(response.body.error).not.toContain('password');
    });

    test('should include security headers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      // Check for security headers from helmet
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Rate Limiting', () => {
    test('should rate limit excessive login attempts', async () => {
      const requests = [];

      // Make 101 requests (rate limit is 100)
      for (let i = 0; i < 101; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'ratelimit@test.com',
              password: 'password'
            })
        );
      }

      const responses = await Promise.all(requests);

      // At least one should be rate limited
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    }, 30000); // Increase timeout for this test
  });
});
