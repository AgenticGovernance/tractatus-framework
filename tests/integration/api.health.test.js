/**
 * Integration Tests - Health Check and Basic Infrastructure
 * Verifies server starts and basic endpoints respond
 */

const request = require('supertest');
const app = require('../../src/server');

describe('Health Check Integration Tests', () => {
  describe('GET /health', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api', () => {
    test('should return API documentation', async () => {
      const response = await request(app)
        .get('/api')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Tractatus AI Safety Framework API');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('endpoints');
    });
  });

  describe('GET /', () => {
    test('should return homepage', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('Tractatus AI Safety Framework');
      // Homepage serves HTML, not text with "Server Running"
      expect(response.headers['content-type']).toMatch(/html/);
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/this-route-does-not-exist')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health');

      // Helmet security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('CORS', () => {
    test('should handle CORS preflight', async () => {
      const response = await request(app)
        .options('/api/documents')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      // Should allow CORS
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('MongoDB Connection', () => {
    test('should connect to database', async () => {
      const response = await request(app)
        .get('/api/documents?limit=1')
        .expect(200);

      // If we get a successful response, MongoDB is connected
      expect(response.body).toHaveProperty('success');
    });
  });
});
