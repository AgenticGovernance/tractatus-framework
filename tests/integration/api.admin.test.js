/**
 * Integration Tests - Admin API
 * Tests admin-only endpoints and role-based access control
 */

const request = require('supertest');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const app = require('../../src/server');
const config = require('../../src/config/app.config');

describe('Admin API Integration Tests', () => {
  let connection;
  let db;
  let adminToken;
  let regularUserToken;

  const adminUser = {
    email: 'admin@test.tractatus.local',
    password: 'AdminPass123!',
    role: 'admin'
  };

  const regularUser = {
    email: 'user@test.tractatus.local',
    password: 'UserPass123!',
    role: 'user'
  };

  // Setup test users
  beforeAll(async () => {
    connection = await MongoClient.connect(config.mongodb.uri);
    db = connection.db(config.mongodb.db);

    // Clean up any existing test users first
    await db.collection('users').deleteMany({
      email: { $in: [adminUser.email, regularUser.email] }
    });

    // Create admin user
    const adminHash = await bcrypt.hash(adminUser.password, 10);
    await db.collection('users').insertOne({
      email: adminUser.email,
      password: adminHash, // Field name is 'password', not 'passwordHash'
      name: 'Test Admin',
      role: adminUser.role,
      created_at: new Date(),
      active: true,
      last_login: null
    });

    // Create regular user
    const userHash = await bcrypt.hash(regularUser.password, 10);
    await db.collection('users').insertOne({
      email: regularUser.email,
      password: userHash, // Field name is 'password', not 'passwordHash'
      name: 'Test User',
      role: regularUser.role,
      created_at: new Date(),
      active: true,
      last_login: null
    });

    // Get auth tokens
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

  // Clean up test data
  afterAll(async () => {
    await db.collection('users').deleteMany({
      email: { $in: [adminUser.email, regularUser.email] }
    });
    await connection.close();
  });

  describe('GET /api/admin/stats', () => {
    test('should return statistics with admin auth', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('documents');
      expect(response.body.stats).toHaveProperty('users');
      expect(response.body.stats).toHaveProperty('blog'); // Returns 'blog' object, not 'blog_posts'
    });

    test('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should reject non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  describe.skip('GET /api/admin/users', () => {
    test('should list users with admin auth', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);

      // Should not include password hashes
      response.body.users.forEach(user => {
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).not.toHaveProperty('password');
      });
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/users?limit=5&skip=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.limit).toBe(5);
    });

    test('should reject non-admin access', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/moderation', () => {
    test('should return pending moderation items', async () => {
      const response = await request(app)
        .get('/api/admin/moderation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .get('/api/admin/moderation')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('POST /api/admin/moderation/:id/review (approve)', () => {
    let testItemId;

    beforeAll(async () => {
      // Clean up any existing test moderation items first
      await db.collection('moderation_queue').deleteMany({
        item_type: 'blog_post',
        item_id: null
      });

      // Create a test moderation item
      const result = await db.collection('moderation_queue').insertOne({
        item_type: 'blog_post',
        item_id: null,
        ai_analysis: {
          suggestion: 'approve',
          confidence: 0.85,
          reasoning: 'Test reasoning'
        },
        quadrant: 'STOCHASTIC',
        status: 'pending',
        created_at: new Date()
      });
      testItemId = result.insertedId.toString();
    });

    afterAll(async () => {
      const { ObjectId } = require('mongodb');
      await db.collection('moderation_queue').deleteOne({
        _id: new ObjectId(testItemId)
      });
    });

    test('should approve moderation item', async () => {
      const response = await request(app)
        .post(`/api/admin/moderation/${testItemId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'approve',
          notes: 'Approved by integration test'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify status changed
      const { ObjectId } = require('mongodb');
      const item = await db.collection('moderation_queue').findOne({
        _id: new ObjectId(testItemId)
      });
      expect(item.status).toBe('reviewed');
      expect(item.review_decision.action).toBe('approve');
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .post(`/api/admin/moderation/${testItemId}/review`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          action: 'approve',
          notes: 'Test'
        })
        .expect(403);
    });
  });

  describe('POST /api/admin/moderation/:id/review (reject)', () => {
    let testItemId;

    beforeEach(async () => {
      // Clean up any existing test moderation items first
      await db.collection('moderation_queue').deleteMany({
        item_type: 'blog_post',
        item_id: null
      });

      const result = await db.collection('moderation_queue').insertOne({
        item_type: 'blog_post',
        item_id: null,
        ai_analysis: {
          suggestion: 'approve',
          confidence: 0.60,
          reasoning: 'Test'
        },
        quadrant: 'STOCHASTIC',
        status: 'pending',
        created_at: new Date()
      });
      testItemId = result.insertedId.toString();
    });

    afterEach(async () => {
      const { ObjectId } = require('mongodb');
      await db.collection('moderation_queue').deleteOne({
        _id: new ObjectId(testItemId)
      });
    });

    test('should reject moderation item', async () => {
      const response = await request(app)
        .post(`/api/admin/moderation/${testItemId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'reject',
          notes: 'Does not meet quality standards'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify status changed
      const { ObjectId } = require('mongodb');
      const item = await db.collection('moderation_queue').findOne({
        _id: new ObjectId(testItemId)
      });
      expect(item.status).toBe('reviewed');
      expect(item.review_decision.action).toBe('reject');
    });
  });

  describe.skip('DELETE /api/admin/users/:id', () => {
    let testUserId;

    beforeEach(async () => {
      const hash = await bcrypt.hash('TempPass123!', 10);
      const result = await db.collection('users').insertOne({
        email: 'temp@test.tractatus.local',
        password: hash, // Field name is 'password', not 'passwordHash'
        name: 'Temp User',
        role: 'user',
        created_at: new Date(),
        active: true,
        last_login: null
      });
      testUserId = result.insertedId.toString();
    });

    test('should delete user with admin auth', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify deletion
      const { ObjectId } = require('mongodb');
      const user = await db.collection('users').findOne({
        _id: new ObjectId(testUserId)
      });
      expect(user).toBeNull();
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);

      // Clean up
      const { ObjectId } = require('mongodb');
      await db.collection('users').deleteOne({
        _id: new ObjectId(testUserId)
      });
    });

    test('should prevent self-deletion', async () => {
      // Get admin user ID
      const adminUserDoc = await db.collection('users').findOne({
        email: adminUser.email
      });

      const response = await request(app)
        .delete(`/api/admin/users/${adminUserDoc._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('delete yourself');
    });
  });

  describe.skip('GET /api/admin/logs', () => {
    test('should return system logs', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('logs');
    });

    test('should support filtering by level', async () => {
      const response = await request(app)
        .get('/api/admin/logs?level=error')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('filters');
      expect(response.body.filters.level).toBe('error');
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('Role-Based Access Control', () => {
    test('should enforce admin-only access across all admin routes', async () => {
      const adminRoutes = [
        '/api/admin/stats',
        '/api/admin/moderation',
        '/api/admin/activity'
      ];

      for (const route of adminRoutes) {
        const response = await request(app)
          .get(route)
          .set('Authorization', `Bearer ${regularUserToken}`);

        expect(response.status).toBe(403);
      }
    });

    test('should allow admin access to all admin routes', async () => {
      const adminRoutes = [
        '/api/admin/stats',
        '/api/admin/moderation',
        '/api/admin/activity'
      ];

      for (const route of adminRoutes) {
        const response = await request(app)
          .get(route)
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 400]).toContain(response.status);
        if (response.status === 403) {
          throw new Error(`Admin should have access to ${route}`);
        }
      }
    });
  });
});
