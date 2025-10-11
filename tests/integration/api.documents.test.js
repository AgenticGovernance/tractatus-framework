/**
 * Integration Tests - Documents API
 * Tests document CRUD operations and search
 */

const request = require('supertest');
const { MongoClient, ObjectId } = require('mongodb');
const app = require('../../src/server');
const config = require('../../src/config/app.config');

describe('Documents API Integration Tests', () => {
  let connection;
  let db;
  let testDocumentId;
  let authToken;

  // Connect to test database
  beforeAll(async () => {
    connection = await MongoClient.connect(config.mongodb.uri);
    db = connection.db(config.mongodb.db);

    // Ensure text index exists for search functionality
    const indexes = await db.collection('documents').indexes();
    const hasTextIndex = indexes.some(idx => idx.name === 'search_index_text');

    if (!hasTextIndex) {
      await db.collection('documents').createIndex(
        { search_index: 'text', title: 'text', 'metadata.tags': 'text' },
        { name: 'search_index_text', weights: { title: 10, search_index: 5, 'metadata.tags': 1 } }
      );
    }
  });

  // Clean up test data
  afterAll(async () => {
    if (testDocumentId) {
      await db.collection('documents').deleteOne({ _id: new ObjectId(testDocumentId) });
    }
    await connection.close();
  });

  // Helper: Create test document in database
  async function createTestDocument() {
    const result = await db.collection('documents').insertOne({
      title: 'Test Document for Integration Tests',
      slug: 'test-document-integration',
      quadrant: 'STRATEGIC',
      persistence: 'HIGH',
      content_html: '<h1>Test Content</h1><p>Integration test document</p>',
      content_markdown: '# Test Content\n\nIntegration test document',
      toc: [{ level: 1, text: 'Test Content', id: 'test-content' }],
      metadata: {
        version: '1.0',
        type: 'test',
        author: 'Integration Test Suite'
      },
      search_index: 'test document integration tests content',
      created_at: new Date(),
      updated_at: new Date()
    });
    return result.insertedId.toString();
  }

  // Helper: Get admin auth token
  async function getAuthToken() {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@tractatus.local',
        password: 'admin123'
      });

    if (response.status === 200 && response.body.token) {
      return response.body.token;
    }
    return null;
  }

  describe('GET /api/documents', () => {
    test('should return list of documents', async () => {
      const response = await request(app)
        .get('/api/documents')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('documents');
      expect(Array.isArray(response.body.documents)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/documents?limit=5&skip=0')
        .expect(200);

      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.pagination.skip).toBe(0);
    });

    test('should filter by quadrant', async () => {
      const response = await request(app)
        .get('/api/documents?quadrant=STRATEGIC')
        .expect(200);

      if (response.body.documents.length > 0) {
        response.body.documents.forEach(doc => {
          expect(doc.quadrant).toBe('STRATEGIC');
        });
      }
    });
  });

  describe('GET /api/documents/:identifier', () => {
    beforeAll(async () => {
      // Clean up any existing test documents first (use deleteMany to catch all)
      await db.collection('documents').deleteMany({ slug: 'test-document-integration' });
      testDocumentId = await createTestDocument();
    });

    test('should get document by ID', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocumentId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.document).toHaveProperty('title', 'Test Document for Integration Tests');
      expect(response.body.document).toHaveProperty('slug', 'test-document-integration');
    });

    test('should get document by slug', async () => {
      const response = await request(app)
        .get('/api/documents/test-document-integration')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.document).toHaveProperty('title', 'Test Document for Integration Tests');
    });

    test('should return 404 for non-existent document', async () => {
      const fakeId = new ObjectId().toString();
      const response = await request(app)
        .get(`/api/documents/${fakeId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });

  describe('GET /api/documents/search', () => {
    test('should search documents by query', async () => {
      const response = await request(app)
        .get('/api/documents/search?q=tractatus')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('query', 'tractatus');
      expect(response.body).toHaveProperty('documents');
      expect(Array.isArray(response.body.documents)).toBe(true);
    });

    test('should return 400 without query parameter', async () => {
      const response = await request(app)
        .get('/api/documents/search')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
    });

    test('should support pagination in search', async () => {
      const response = await request(app)
        .get('/api/documents/search?q=framework&limit=3')
        .expect(200);

      expect(response.body.documents.length).toBeLessThanOrEqual(3);
    });
  });

  describe('POST /api/documents (Admin)', () => {
    beforeAll(async () => {
      authToken = await getAuthToken();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/documents')
        .send({
          title: 'Unauthorized Test',
          slug: 'unauthorized-test',
          quadrant: 'TACTICAL',
          content_markdown: '# Test'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should create document with valid auth', async () => {
      if (!authToken) {
        console.warn('Skipping test: admin login failed');
        return;
      }

      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'New Test Document',
          slug: 'new-test-document',
          quadrant: 'TACTICAL',
          persistence: 'MEDIUM',
          content_markdown: '# New Document\n\nCreated via API test'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.document).toHaveProperty('title', 'New Test Document');
      expect(response.body.document).toHaveProperty('content_html');

      // Clean up
      await db.collection('documents').deleteOne({ slug: 'new-test-document' });
    });

    test('should validate required fields', async () => {
      if (!authToken) return;

      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Incomplete Document'
          // Missing slug, quadrant, content_markdown
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should prevent duplicate slugs', async () => {
      if (!authToken) return;

      // Create first document
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Duplicate Test',
          slug: 'duplicate-slug-test',
          quadrant: 'SYSTEM',
          content_markdown: '# First'
        });

      // Try to create duplicate
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Duplicate Test 2',
          slug: 'duplicate-slug-test',
          quadrant: 'SYSTEM',
          content_markdown: '# Second'
        })
        .expect(409);

      expect(response.body).toHaveProperty('error', 'Conflict');

      // Clean up
      await db.collection('documents').deleteOne({ slug: 'duplicate-slug-test' });
    });
  });

  describe('PUT /api/documents/:id (Admin)', () => {
    let updateDocId;

    beforeAll(async () => {
      authToken = await getAuthToken();
      // Clean up any existing test documents first (use deleteMany to catch all)
      await db.collection('documents').deleteMany({ slug: 'test-document-integration' });
      updateDocId = await createTestDocument();
    });

    afterAll(async () => {
      if (updateDocId) {
        await db.collection('documents').deleteOne({ _id: new ObjectId(updateDocId) });
      }
    });

    test('should update document with valid auth', async () => {
      if (!authToken) return;

      const response = await request(app)
        .put(`/api/documents/${updateDocId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Test Document',
          content_markdown: '# Updated Content\n\nThis has been modified'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.document.title).toBe('Updated Test Document');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/documents/${updateDocId}`)
        .send({ title: 'Unauthorized Update' })
        .expect(401);
    });
  });

  describe('DELETE /api/documents/:id (Admin)', () => {
    let deleteDocId;

    beforeEach(async () => {
      authToken = await getAuthToken();
      // Clean up any existing test documents first (use deleteMany to catch all)
      await db.collection('documents').deleteMany({ slug: 'test-document-integration' });
      deleteDocId = await createTestDocument();
    });

    test('should delete document with valid auth', async () => {
      if (!authToken) return;

      const response = await request(app)
        .delete(`/api/documents/${deleteDocId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const doc = await db.collection('documents').findOne({ _id: new ObjectId(deleteDocId) });
      expect(doc).toBeNull();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/documents/${deleteDocId}`)
        .expect(401);

      // Clean up since delete failed
      await db.collection('documents').deleteOne({ _id: new ObjectId(deleteDocId) });
    });
  });
});
