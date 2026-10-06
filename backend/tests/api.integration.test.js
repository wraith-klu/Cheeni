import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('Backend API Integration Tests', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  describe('GET /health', () => {
    it('returns 200 OK with server status and timestamp', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/auth/signup validation', () => {
    it('returns 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'incomplete@example.com' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('required');
    });

    it('returns 400 when password is too short', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Cheeni User',
          email: 'testuser@example.com',
          password: '123',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('6 characters');
    });
  });

  describe('POST /api/auth/signin validation', () => {
    it('returns 400 when email or password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'nouser@example.com' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Protected routes authorization', () => {
    it('rejects unauthenticated requests to /api/user/current with 401', async () => {
      const response = await request(app).get('/api/user/current');
      expect(response.status).toBe(401);
    });

    it('rejects unauthenticated requests to /api/assistant/history with 401', async () => {
      const response = await request(app).get('/api/assistant/history');
      expect(response.status).toBe(401);
    });
  });

  describe('Agent proxy routes', () => {
    it('public /api/agent/ping returns connection status', async () => {
      const response = await request(app).get('/api/agent/ping');
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('connected');
    });

    it('protected /api/agent/status rejects unauthenticated requests with 401', async () => {
      const response = await request(app).get('/api/agent/status');
      expect(response.status).toBe(401);
    });
  });

  describe('User Avatar Upload Validation', () => {
    it('rejects unauthorized upload requests with 401', async () => {
      const response = await request(app)
        .post('/api/user/update')
        .attach('assistantImage', Buffer.from('fake data'), 'test.exe');
      expect(response.status).toBe(401);
    });
  });
});
