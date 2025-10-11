/**
 * Integration Tests - Projects & Variables API
 * Tests multi-project governance with context-aware variable substitution
 */

const request = require('supertest');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const app = require('../../src/server');
const config = require('../../src/config/app.config');
const { connect: connectMongoose, close: closeMongoose } = require('../../src/utils/mongoose.util');

describe('Projects & Variables API Integration Tests', () => {
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

  // Setup test users and connection
  beforeAll(async () => {
    // Connect both native MongoDB driver and Mongoose
    connection = await MongoClient.connect(config.mongodb.uri);
    db = connection.db(config.mongodb.db);
    await connectMongoose();

    // Clean up any existing test users
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
      active: true,
      last_login: null
    });

    // Create regular user
    const userHash = await bcrypt.hash(regularUser.password, 10);
    await db.collection('users').insertOne({
      email: regularUser.email,
      password: userHash,
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

    // Clean up test projects and variables
    await db.collection('projects').deleteMany({
      id: /^test-project/
    });
    await db.collection('variableValues').deleteMany({
      projectId: /^test-project/
    });

    // Close connections
    await connection.close();
    await closeMongoose();
  });

  // ========== PROJECTS API TESTS ==========

  describe('POST /api/admin/projects', () => {
    afterEach(async () => {
      await db.collection('projects').deleteMany({
        id: /^test-project/
      });
    });

    test('should create new project with admin auth', async () => {
      const projectData = {
        id: 'test-project-1',
        name: 'Test Project 1',
        description: 'Test project for integration testing',
        techStack: {
          framework: 'Express',
          database: 'MongoDB',
          frontend: 'Vanilla JS'
        },
        repositoryUrl: 'https://github.com/test/test-project-1',
        active: true
      };

      const response = await request(app)
        .post('/api/admin/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(projectData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('project');
      expect(response.body.project.id).toBe(projectData.id);
      expect(response.body.project.name).toBe(projectData.name);
      expect(response.body.project.techStack.database).toBe('MongoDB');
      expect(response.body.project.createdBy).toBe(adminUser.email);
    });

    test('should reject duplicate project ID', async () => {
      const projectData = {
        id: 'test-project-duplicate',
        name: 'Test Project Duplicate'
      };

      // Create first project
      await request(app)
        .post('/api/admin/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(projectData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/admin/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(projectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Project already exists');
    });

    test('should reject request without required fields', async () => {
      const response = await request(app)
        .post('/api/admin/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: 'test-project-incomplete'
          // Missing 'name' field
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    test('should require admin authentication', async () => {
      const response = await request(app)
        .post('/api/admin/projects')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          id: 'test-project-auth',
          name: 'Test Project Auth'
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/projects', () => {
    beforeAll(async () => {
      // Clean up first
      await db.collection('projects').deleteMany({
        id: /^test-project-list/
      });

      // Create test projects
      await db.collection('projects').insertMany([
        {
          id: 'test-project-list-1',
          name: 'Test List Project 1',
          description: 'Active project',
          active: true,
          techStack: { database: 'MongoDB' },
          createdBy: adminUser.email,
          updatedBy: adminUser.email,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'test-project-list-2',
          name: 'Test List Project 2',
          description: 'Inactive project',
          active: false,
          techStack: { database: 'PostgreSQL' },
          createdBy: adminUser.email,
          updatedBy: adminUser.email,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'test-project-list-3',
          name: 'Test List Project 3',
          description: 'Active MongoDB project',
          active: true,
          techStack: { database: 'MongoDB' },
          createdBy: adminUser.email,
          updatedBy: adminUser.email,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    });

    afterAll(async () => {
      await db.collection('projects').deleteMany({
        id: /^test-project-list/
      });
    });

    test('should list all projects', async () => {
      const response = await request(app)
        .get('/api/admin/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('projects');
      expect(Array.isArray(response.body.projects)).toBe(true);
      expect(response.body.projects.length).toBeGreaterThanOrEqual(3);

      // Should include variable count
      response.body.projects.forEach(project => {
        expect(project).toHaveProperty('variableCount');
      });
    });

    test('should filter by active status', async () => {
      const response = await request(app)
        .get('/api/admin/projects?active=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.projects.forEach(project => {
        if (project.id.startsWith('test-project-list')) {
          expect(project.active).toBe(true);
        }
      });
    });

    test('should filter by database technology', async () => {
      const response = await request(app)
        .get('/api/admin/projects?database=MongoDB')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.projects.forEach(project => {
        if (project.id.startsWith('test-project-list')) {
          expect(project.techStack.database).toMatch(/MongoDB/i);
        }
      });
    });

    test('should require admin authentication', async () => {
      await request(app)
        .get('/api/admin/projects')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/projects/:id', () => {
    let testProjectId;

    beforeAll(async () => {
      const result = await db.collection('projects').insertOne({
        id: 'test-project-get',
        name: 'Test Get Project',
        description: 'Project for GET test',
        active: true,
        techStack: { database: 'MongoDB' },
        createdBy: adminUser.email,
        updatedBy: adminUser.email,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      testProjectId = 'test-project-get';
    });

    afterAll(async () => {
      await db.collection('projects').deleteOne({ id: testProjectId });
    });

    test('should get single project by ID', async () => {
      const response = await request(app)
        .get(`/api/admin/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('project');
      expect(response.body.project.id).toBe(testProjectId);
      expect(response.body).toHaveProperty('variables');
      expect(Array.isArray(response.body.variables)).toBe(true);
      expect(response.body).toHaveProperty('variableCount');
    });

    test('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/admin/projects/non-existent-project')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Project not found');
    });
  });

  describe('PUT /api/admin/projects/:id', () => {
    let testProjectId;

    beforeEach(async () => {
      await db.collection('projects').deleteOne({ id: 'test-project-update' });
      await db.collection('projects').insertOne({
        id: 'test-project-update',
        name: 'Test Update Project',
        description: 'Original description',
        active: true,
        techStack: { database: 'MongoDB' },
        createdBy: adminUser.email,
        updatedBy: adminUser.email,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      testProjectId = 'test-project-update';
    });

    afterEach(async () => {
      await db.collection('projects').deleteOne({ id: testProjectId });
    });

    test('should update project fields', async () => {
      const updates = {
        description: 'Updated description',
        techStack: {
          database: 'PostgreSQL',
          framework: 'Express'
        }
      };

      const response = await request(app)
        .put(`/api/admin/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.project.description).toBe(updates.description);
      expect(response.body.project.techStack.database).toBe('PostgreSQL');
      expect(response.body.project.updatedBy).toBe(adminUser.email);
    });

    test('should prevent changing project ID', async () => {
      const response = await request(app)
        .put(`/api/admin/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: 'different-id' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Cannot change project ID');
    });

    test('should return 404 for non-existent project', async () => {
      await request(app)
        .put('/api/admin/projects/non-existent-project')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Test' })
        .expect(404);
    });
  });

  describe('DELETE /api/admin/projects/:id', () => {
    let testProjectId;

    beforeEach(async () => {
      await db.collection('projects').deleteOne({ id: 'test-project-delete' });
      await db.collection('projects').insertOne({
        id: 'test-project-delete',
        name: 'Test Delete Project',
        description: 'Project for deletion test',
        active: true,
        techStack: { database: 'MongoDB' },
        createdBy: adminUser.email,
        updatedBy: adminUser.email,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      testProjectId = 'test-project-delete';

      // Add some test variables
      await db.collection('variableValues').insertMany([
        {
          projectId: testProjectId,
          variableName: 'TEST_VAR_1',
          value: 'test1',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          projectId: testProjectId,
          variableName: 'TEST_VAR_2',
          value: 'test2',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    });

    afterEach(async () => {
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('variableValues').deleteMany({ projectId: testProjectId });
    });

    test('should soft delete project (default)', async () => {
      const response = await request(app)
        .delete(`/api/admin/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('deactivated');

      // Verify project is deactivated
      const project = await db.collection('projects').findOne({ id: testProjectId });
      expect(project.active).toBe(false);

      // Verify variables are deactivated
      const variables = await db.collection('variableValues').find({ projectId: testProjectId }).toArray();
      variables.forEach(v => expect(v.active).toBe(false));
    });

    test('should hard delete project with ?hard=true', async () => {
      const response = await request(app)
        .delete(`/api/admin/projects/${testProjectId}?hard=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('permanently deleted');

      // Verify project is deleted
      const project = await db.collection('projects').findOne({ id: testProjectId });
      expect(project).toBeNull();

      // Verify variables are deleted
      const varCount = await db.collection('variableValues').countDocuments({ projectId: testProjectId });
      expect(varCount).toBe(0);
    });
  });

  describe('GET /api/admin/projects/stats', () => {
    test('should return project statistics', async () => {
      const response = await request(app)
        .get('/api/admin/projects/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('statistics');
      expect(typeof response.body.statistics).toBe('object');
    });

    test('should require admin authentication', async () => {
      await request(app)
        .get('/api/admin/projects/stats')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  // ========== VARIABLES API TESTS ==========

  describe('POST /api/admin/projects/:projectId/variables', () => {
    let testProjectId;

    beforeAll(async () => {
      await db.collection('projects').deleteOne({ id: 'test-project-vars' });
      await db.collection('projects').insertOne({
        id: 'test-project-vars',
        name: 'Test Variables Project',
        active: true,
        techStack: {},
        createdBy: adminUser.email,
        updatedBy: adminUser.email,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      testProjectId = 'test-project-vars';
    });

    afterAll(async () => {
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('variableValues').deleteMany({ projectId: testProjectId });
    });

    afterEach(async () => {
      await db.collection('variableValues').deleteMany({ projectId: testProjectId });
    });

    test('should create new variable', async () => {
      const variableData = {
        variableName: 'DB_NAME',
        value: 'test_database',
        description: 'Database name for testing',
        category: 'database',
        dataType: 'string'
      };

      const response = await request(app)
        .post(`/api/admin/projects/${testProjectId}/variables`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(variableData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('variable');
      expect(response.body.variable.variableName).toBe('DB_NAME');
      expect(response.body.variable.value).toBe(variableData.value);
      expect(response.body.variable.projectId).toBe(testProjectId);
    });

    test('should update existing variable (upsert)', async () => {
      // Create initial variable
      await request(app)
        .post(`/api/admin/projects/${testProjectId}/variables`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variableName: 'DB_PORT',
          value: '27017',
          description: 'Original port'
        });

      // Update the same variable
      const response = await request(app)
        .post(`/api/admin/projects/${testProjectId}/variables`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variableName: 'DB_PORT',
          value: '27018',
          description: 'Updated port'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.variable.value).toBe('27018');
      expect(response.body.variable.description).toBe('Updated port');

      // Verify only one document exists
      const count = await db.collection('variableValues').countDocuments({
        projectId: testProjectId,
        variableName: 'DB_PORT'
      });
      expect(count).toBe(1);
    });

    test('should validate UPPER_SNAKE_CASE variable names', async () => {
      const response = await request(app)
        .post(`/api/admin/projects/${testProjectId}/variables`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variableName: 'invalid-name',
          value: 'test'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Invalid variable name');
      expect(response.body.message).toContain('UPPER_SNAKE_CASE');
    });

    test('should return 404 for non-existent project', async () => {
      await request(app)
        .post('/api/admin/projects/non-existent/variables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variableName: 'TEST_VAR',
          value: 'test'
        })
        .expect(404);
    });
  });

  describe('GET /api/admin/projects/:projectId/variables', () => {
    let testProjectId;

    beforeAll(async () => {
      testProjectId = 'test-project-get-vars';
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('projects').insertOne({
        id: testProjectId,
        name: 'Test Get Variables Project',
        active: true,
        techStack: {},
        createdBy: adminUser.email,
        updatedBy: adminUser.email,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create test variables
      await db.collection('variableValues').insertMany([
        {
          projectId: testProjectId,
          variableName: 'DB_NAME',
          value: 'testdb',
          category: 'database',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          projectId: testProjectId,
          variableName: 'API_KEY',
          value: 'test-key-123',
          category: 'api',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          projectId: testProjectId,
          variableName: 'OLD_VAR',
          value: 'old-value',
          category: 'database',
          active: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    });

    afterAll(async () => {
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('variableValues').deleteMany({ projectId: testProjectId });
    });

    test('should get all variables for project', async () => {
      const response = await request(app)
        .get(`/api/admin/projects/${testProjectId}/variables`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('variables');
      expect(response.body.projectId).toBe(testProjectId);
      expect(Array.isArray(response.body.variables)).toBe(true);
      expect(response.body.total).toBeGreaterThanOrEqual(2);
    });

    test('should filter by category', async () => {
      const response = await request(app)
        .get(`/api/admin/projects/${testProjectId}/variables?category=database`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.variables.forEach(v => {
        expect(v.category).toBe('database');
      });
    });
  });

  describe('PUT /api/admin/projects/:projectId/variables/:variableName', () => {
    let testProjectId;

    beforeAll(async () => {
      testProjectId = 'test-project-update-var';
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('projects').insertOne({
        id: testProjectId,
        name: 'Test Update Variable Project',
        active: true,
        techStack: {},
        createdBy: adminUser.email,
        updatedBy: adminUser.email,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await db.collection('variableValues').insertOne({
        projectId: testProjectId,
        variableName: 'UPDATE_TEST',
        value: 'original',
        description: 'Original description',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    afterAll(async () => {
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('variableValues').deleteMany({ projectId: testProjectId });
    });

    test('should update variable value', async () => {
      const response = await request(app)
        .put(`/api/admin/projects/${testProjectId}/variables/UPDATE_TEST`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          value: 'updated',
          description: 'Updated description'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.variable.value).toBe('updated');
      expect(response.body.variable.description).toBe('Updated description');
    });

    test('should return 404 for non-existent variable', async () => {
      await request(app)
        .put(`/api/admin/projects/${testProjectId}/variables/NON_EXISTENT`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'test' })
        .expect(404);
    });
  });

  describe('DELETE /api/admin/projects/:projectId/variables/:variableName', () => {
    let testProjectId;

    beforeEach(async () => {
      testProjectId = 'test-project-delete-var';
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('projects').insertOne({
        id: testProjectId,
        name: 'Test Delete Variable Project',
        active: true,
        techStack: {},
        createdBy: adminUser.email,
        updatedBy: adminUser.email,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await db.collection('variableValues').insertOne({
        projectId: testProjectId,
        variableName: 'DELETE_TEST',
        value: 'test',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    afterEach(async () => {
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('variableValues').deleteMany({ projectId: testProjectId });
    });

    test('should soft delete variable', async () => {
      const response = await request(app)
        .delete(`/api/admin/projects/${testProjectId}/variables/DELETE_TEST`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('deactivated');

      // Verify it's deactivated
      const variable = await db.collection('variableValues').findOne({
        projectId: testProjectId,
        variableName: 'DELETE_TEST'
      });
      expect(variable.active).toBe(false);
    });

    test('should hard delete variable with ?hard=true', async () => {
      const response = await request(app)
        .delete(`/api/admin/projects/${testProjectId}/variables/DELETE_TEST?hard=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('permanently deleted');

      // Verify it's deleted
      const variable = await db.collection('variableValues').findOne({
        projectId: testProjectId,
        variableName: 'DELETE_TEST'
      });
      expect(variable).toBeNull();
    });
  });

  describe('POST /api/admin/projects/:projectId/variables/batch', () => {
    let testProjectId;

    beforeAll(async () => {
      testProjectId = 'test-project-batch';
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('projects').insertOne({
        id: testProjectId,
        name: 'Test Batch Variables Project',
        active: true,
        techStack: {},
        createdBy: adminUser.email,
        updatedBy: adminUser.email,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    afterAll(async () => {
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('variableValues').deleteMany({ projectId: testProjectId });
    });

    afterEach(async () => {
      await db.collection('variableValues').deleteMany({ projectId: testProjectId });
    });

    test('should batch upsert multiple variables', async () => {
      const variables = [
        { variableName: 'VAR_1', value: 'value1', description: 'First var' },
        { variableName: 'VAR_2', value: 'value2', description: 'Second var' },
        { variableName: 'VAR_3', value: 'value3', description: 'Third var' }
      ];

      const response = await request(app)
        .post(`/api/admin/projects/${testProjectId}/variables/batch`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ variables })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.results.created.length).toBe(3);
      expect(response.body.results.failed.length).toBe(0);

      // Verify all created
      const count = await db.collection('variableValues').countDocuments({
        projectId: testProjectId,
        active: true
      });
      expect(count).toBe(3);
    });

    test('should handle mixed create/update in batch', async () => {
      // Create one variable first
      await db.collection('variableValues').insertOne({
        projectId: testProjectId,
        variableName: 'EXISTING_VAR',
        value: 'old',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const variables = [
        { variableName: 'EXISTING_VAR', value: 'updated' },
        { variableName: 'NEW_VAR', value: 'new' }
      ];

      const response = await request(app)
        .post(`/api/admin/projects/${testProjectId}/variables/batch`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ variables })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results.created.length + response.body.results.updated.length).toBe(2);
    });

    test('should report failures for invalid variables', async () => {
      const variables = [
        { variableName: 'VALID_VAR', value: 'valid' },
        { variableName: 'invalid-name', value: 'invalid' }  // Invalid name format
      ];

      const response = await request(app)
        .post(`/api/admin/projects/${testProjectId}/variables/batch`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ variables })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results.failed.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/admin/projects/:projectId/variables/validate', () => {
    let testProjectId;

    beforeAll(async () => {
      testProjectId = 'test-project-validate';
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('projects').insertOne({
        id: testProjectId,
        name: 'Test Validate Variables Project',
        active: true,
        techStack: {},
        createdBy: adminUser.email,
        updatedBy: adminUser.email,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    afterAll(async () => {
      await db.collection('projects').deleteOne({ id: testProjectId });
    });

    test('should validate project variables', async () => {
      const response = await request(app)
        .get(`/api/admin/projects/${testProjectId}/variables/validate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('projectId', testProjectId);
      expect(response.body).toHaveProperty('validation');
      expect(response.body.validation).toHaveProperty('complete');
      expect(response.body.validation).toHaveProperty('missing');
    });
  });

  describe('GET /api/admin/projects/variables/global', () => {
    test('should get all unique variable names', async () => {
      const response = await request(app)
        .get('/api/admin/projects/variables/global')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('variables');
      expect(Array.isArray(response.body.variables)).toBe(true);
      expect(response.body).toHaveProperty('statistics');
      expect(response.body.statistics).toHaveProperty('totalVariables');
      expect(response.body.statistics).toHaveProperty('usedInRules');
      expect(response.body.statistics).toHaveProperty('definedButUnused');
    });
  });

  // ========== INTEGRATION TESTS: PROJECT CONTEXT IN RULES API ==========

  describe('Integration: Project Context in Rules API', () => {
    let testProjectId;
    let testRuleId;

    beforeAll(async () => {
      testProjectId = 'test-project-rules-integration';

      // Clean up
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('variableValues').deleteMany({ projectId: testProjectId });
      await db.collection('governance_rules').deleteMany({ id: 'test-rule-vars' });

      // Create test project
      await db.collection('projects').insertOne({
        id: testProjectId,
        name: 'Test Rules Integration Project',
        active: true,
        techStack: {},
        createdBy: adminUser.email,
        updatedBy: adminUser.email,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create variables
      await db.collection('variableValues').insertMany([
        {
          projectId: testProjectId,
          variableName: 'DB_NAME',
          value: 'integration_test_db',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          projectId: testProjectId,
          variableName: 'DB_PORT',
          value: '27017',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      // Create rule with variables
      await db.collection('governance_rules').insertOne({
        id: 'test-rule-vars',
        text: 'Database MUST use ${DB_NAME} on port ${DB_PORT}',
        scope: 'PROJECT_SPECIFIC',
        applicableProjects: [testProjectId],
        variables: ['DB_NAME', 'DB_PORT'],
        quadrant: 'SYSTEM',
        persistence: 'HIGH',
        category: 'technical',
        priority: 90,
        active: true,
        validationStatus: 'NOT_VALIDATED',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      testRuleId = 'test-rule-vars';
    });

    afterAll(async () => {
      await db.collection('projects').deleteOne({ id: testProjectId });
      await db.collection('variableValues').deleteMany({ projectId: testProjectId });
      await db.collection('governance_rules').deleteOne({ id: testRuleId });
    });

    test('should return rules with substituted variables when projectId provided', async () => {
      const response = await request(app)
        .get(`/api/admin/rules?projectId=${testProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('rules');

      const testRule = response.body.rules.find(r => r.id === testRuleId);
      if (testRule) {
        expect(testRule).toHaveProperty('text'); // Template text
        expect(testRule).toHaveProperty('renderedText'); // Substituted text
        expect(testRule.renderedText).toBe('Database MUST use integration_test_db on port 27017');
        expect(testRule.text).toContain('${DB_NAME}');
        expect(testRule.text).toContain('${DB_PORT}');
      }
    });

    test('should return template text only when no projectId provided', async () => {
      const response = await request(app)
        .get('/api/admin/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      const testRule = response.body.rules.find(r => r.id === testRuleId);
      if (testRule) {
        expect(testRule).toHaveProperty('text');
        expect(testRule).not.toHaveProperty('renderedText');
        expect(testRule.text).toContain('${DB_NAME}');
      }
    });
  });
});
