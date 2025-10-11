/**
 * Integration Tests - Governance API
 * Tests Tractatus framework testing endpoints
 */

const request = require('supertest');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const app = require('../../src/server');
const config = require('../../src/config/app.config');

describe('Governance API Integration Tests', () => {
  let connection;
  let db;
  let adminToken;
  let regularUserToken;

  const adminUser = {
    email: 'admin@governance.test.local',
    password: 'AdminGov123!',
    role: 'admin'
  };

  const regularUser = {
    email: 'user@governance.test.local',
    password: 'UserGov123!',
    role: 'user'
  };

  // Setup test users
  beforeAll(async () => {
    connection = await MongoClient.connect(config.mongodb.uri);
    db = connection.db(config.mongodb.db);

    // Clean up existing test users
    await db.collection('users').deleteMany({
      email: { $in: [adminUser.email, regularUser.email] }
    });

    // Create admin user
    const adminHash = await bcrypt.hash(adminUser.password, 10);
    await db.collection('users').insertOne({
      email: adminUser.email,
      password: adminHash,
      name: 'Test Admin',
      role: adminUser.role,
      created_at: new Date(),
      active: true
    });

    // Create regular user
    const userHash = await bcrypt.hash(regularUser.password, 10);
    await db.collection('users').insertOne({
      email: regularUser.email,
      password: userHash,
      name: 'Test User',
      role: regularUser.role,
      created_at: new Date(),
      active: true
    });

    // Get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminUser.email,
        password: adminUser.password
      });
    adminToken = adminLogin.body.token;

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: regularUser.email,
        password: regularUser.password
      });
    regularUserToken = userLogin.body.token;
  });

  // Clean up
  afterAll(async () => {
    await db.collection('users').deleteMany({
      email: { $in: [adminUser.email, regularUser.email] }
    });
    await connection.close();
  });

  describe('GET /api/governance', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/governance')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .get('/api/governance')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    test('should redirect HTML requests to API documentation', async () => {
      const response = await request(app)
        .get('/api/governance')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Accept', 'text/html')
        .expect(302);

      expect(response.headers.location).toContain('api-reference.html#governance');
    });

    test('should return JSON for JSON requests with admin auth', async () => {
      const response = await request(app)
        .get('/api/governance')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Accept', 'application/json')
        .expect(200);

      // Response is the framework object directly (not wrapped in success)
      expect(response.body).toHaveProperty('name', 'Tractatus Governance Framework');
      expect(response.body).toHaveProperty('operational', true);
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('GET /api/governance/status', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/governance/status')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .get('/api/governance/status')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    test('should return detailed framework status with admin auth', async () => {
      const response = await request(app)
        .get('/api/governance/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(typeof response.body.uptime).toBe('number');
    });
  });

  describe('POST /api/governance/classify', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/governance/classify')
        .send({ text: 'Test instruction' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .post('/api/governance/classify')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ text: 'Test instruction' })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    test('should reject request without text field', async () => {
      const response = await request(app)
        .post('/api/governance/classify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('text field is required');
    });

    test('should classify instruction with admin auth', async () => {
      const response = await request(app)
        .post('/api/governance/classify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'Always use TypeScript for new projects',
          context: { source: 'test' }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('classification');
      expect(response.body.classification).toHaveProperty('quadrant');
      expect(response.body.classification).toHaveProperty('persistence');
    });

    test('should classify without context parameter', async () => {
      const response = await request(app)
        .post('/api/governance/classify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'Run tests before committing'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.classification).toBeDefined();
    });
  });

  describe('POST /api/governance/validate', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/governance/validate')
        .send({ action: { type: 'test' } })
        .expect(401);
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .post('/api/governance/validate')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ action: { type: 'test' } })
        .expect(403);
    });

    test('should reject request without action field', async () => {
      const response = await request(app)
        .post('/api/governance/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('action object is required');
    });

    test('should validate action with admin auth', async () => {
      const response = await request(app)
        .post('/api/governance/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: {
            type: 'file-edit',
            description: 'Update configuration file',
            filePath: 'config.json'
          },
          context: {
            messages: []
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('validation');
      expect(response.body.validation).toHaveProperty('status');
      expect(response.body.validation).toHaveProperty('action');
    });

    test('should validate without context parameter', async () => {
      const response = await request(app)
        .post('/api/governance/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: {
            type: 'database',
            description: 'Update schema'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/governance/enforce', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/governance/enforce')
        .send({ action: { type: 'test' } })
        .expect(401);
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .post('/api/governance/enforce')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ action: { type: 'test' } })
        .expect(403);
    });

    test('should reject request without action field', async () => {
      const response = await request(app)
        .post('/api/governance/enforce')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('action object is required');
    });

    test('should enforce boundaries with admin auth', async () => {
      const response = await request(app)
        .post('/api/governance/enforce')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: {
            type: 'values',
            description: 'Define project values',
            decision: 'What are our core values?'
          },
          context: {}
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('enforcement');
      expect(response.body.enforcement).toHaveProperty('allowed');
      expect(response.body.enforcement).toHaveProperty('domain');
    });

    test('should enforce without context parameter', async () => {
      const response = await request(app)
        .post('/api/governance/enforce')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: {
            type: 'architecture',
            description: 'Change system architecture'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/governance/pressure', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/governance/pressure')
        .send({})
        .expect(401);
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .post('/api/governance/pressure')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({})
        .expect(403);
    });

    test('should analyze pressure with admin auth', async () => {
      const response = await request(app)
        .post('/api/governance/pressure')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          context: {
            tokenUsage: 100000,
            tokenBudget: 200000,
            messageCount: 50
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('pressure');
      expect(response.body.pressure).toHaveProperty('pressureLevel');
      expect(response.body.pressure).toHaveProperty('overall_score');
    });

    test('should use default context when not provided', async () => {
      const response = await request(app)
        .post('/api/governance/pressure')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pressure).toBeDefined();
    });
  });

  describe('POST /api/governance/verify', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/governance/verify')
        .send({ action: { type: 'test' } })
        .expect(401);
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .post('/api/governance/verify')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ action: { type: 'test' } })
        .expect(403);
    });

    test('should reject request without action field', async () => {
      const response = await request(app)
        .post('/api/governance/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('action object is required');
    });

    test('should verify action with admin auth', async () => {
      const response = await request(app)
        .post('/api/governance/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: {
            type: 'complex',
            description: 'Refactor authentication system',
            parameters: {
              files: ['auth.js', 'middleware.js'],
              changes: 'major'
            }
          },
          reasoning: {
            userGoal: 'Improve security',
            approach: 'Use JWT tokens'
          },
          context: {}
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('verification');
      expect(response.body.verification).toHaveProperty('checks');
      expect(response.body.verification.checks).toHaveProperty('alignment');
    });

    test('should verify without reasoning parameter', async () => {
      const response = await request(app)
        .post('/api/governance/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: {
            type: 'simple',
            description: 'Update README'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Admin-Only Access Control', () => {
    test('should enforce admin-only access across all governance routes', async () => {
      const governanceRoutes = [
        { method: 'get', path: '/api/governance/status' },
        { method: 'post', path: '/api/governance/classify', body: { text: 'test' } },
        { method: 'post', path: '/api/governance/validate', body: { action: { type: 'test' } } },
        { method: 'post', path: '/api/governance/enforce', body: { action: { type: 'test' } } },
        { method: 'post', path: '/api/governance/pressure', body: {} },
        { method: 'post', path: '/api/governance/verify', body: { action: { type: 'test' } } }
      ];

      for (const route of governanceRoutes) {
        const req = request(app)[route.method](route.path)
          .set('Authorization', `Bearer ${regularUserToken}`);

        if (route.body) {
          req.send(route.body);
        }

        const response = await req;
        expect(response.status).toBe(403);
      }
    });

    test('should allow admin access to all governance routes', async () => {
      const governanceRoutes = [
        { method: 'get', path: '/api/governance/status' },
        { method: 'post', path: '/api/governance/classify', body: { text: 'test' } },
        { method: 'post', path: '/api/governance/validate', body: { action: { type: 'test' } } },
        { method: 'post', path: '/api/governance/enforce', body: { action: { type: 'test' } } },
        { method: 'post', path: '/api/governance/pressure', body: {} },
        { method: 'post', path: '/api/governance/verify', body: { action: { type: 'test' } } }
      ];

      for (const route of governanceRoutes) {
        const req = request(app)[route.method](route.path)
          .set('Authorization', `Bearer ${adminToken}`);

        if (route.body) {
          req.send(route.body);
        }

        const response = await req;
        expect(response.status).toBe(200);
      }
    });
  });
});
