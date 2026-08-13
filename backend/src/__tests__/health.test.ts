import request from 'supertest';
import { createApp } from '../app';

describe('GET /api/v1/health', () => {
  const app = createApp();

  it('should return 200 OK with health status information', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('service', 'smartprior-ai-api');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
  });
});
